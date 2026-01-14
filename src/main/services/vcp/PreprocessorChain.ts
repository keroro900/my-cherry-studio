/**
 * VCP 预处理器链管理器
 *
 * 管理 messagePreprocessor 类型插件的有序执行：
 * - 从 userData/vcp/preprocessor_order.json 加载/保存顺序
 * - 按顺序执行预处理器
 * - 支持热重载
 * - 合并新发现的预处理器到顺序末尾
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import type { PluginExecutor } from './PluginExecutor'
import type { PluginRegistry } from './PluginRegistry'
import type { ChatMessage, PreprocessorChainOrder, PreprocessorResult, VCPPlugin } from './types'

const logger = loggerService.withContext('VCP:PreprocessorChain')

/**
 * 预处理器链配置
 */
export interface PreprocessorChainConfig {
  /** 顺序文件路径 */
  orderFilePath: string
  /** 变更时自动保存 */
  autoSaveOnChange: boolean
}

/**
 * 预处理器链管理器
 */
export class PreprocessorChain {
  private registry: PluginRegistry
  private executor: PluginExecutor
  private config: PreprocessorChainConfig

  private preprocessorOrder: string[] = []
  private isInitialized: boolean = false

  constructor(registry: PluginRegistry, executor: PluginExecutor, config?: Partial<PreprocessorChainConfig>) {
    this.registry = registry
    this.executor = executor

    const userData = app.getPath('userData')
    this.config = {
      orderFilePath: config?.orderFilePath || path.join(userData, 'vcp', 'preprocessor_order.json'),
      autoSaveOnChange: config?.autoSaveOnChange ?? true
    }
  }

  /**
   * 初始化预处理器链
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('PreprocessorChain already initialized')
      return
    }

    logger.info('Initializing PreprocessorChain...')

    // 确保目录存在
    const orderDir = path.dirname(this.config.orderFilePath)
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true })
    }

    // 加载保存的顺序
    const savedOrder = await this.loadOrder()

    // 获取当前可用的预处理器
    const availablePreprocessors = this.getAvailablePreprocessors()
    const availableSet = new Set(availablePreprocessors.map((p) => p.manifest.name))

    // 合并顺序：保留已保存的有效插件，追加新发现的插件
    const finalOrder: string[] = []
    const usedNames = new Set<string>()

    // 1. 按保存的顺序添加仍然存在的预处理器
    for (const name of savedOrder) {
      if (availableSet.has(name) && !usedNames.has(name)) {
        finalOrder.push(name)
        usedNames.add(name)
      }
    }

    // 2. 追加新发现的预处理器（按优先级排序）
    const newPreprocessors = availablePreprocessors
      .filter((p) => !usedNames.has(p.manifest.name))
      .sort((a, b) => {
        const priorityA = a.manifest.preprocessorPriority ?? 100
        const priorityB = b.manifest.preprocessorPriority ?? 100
        return priorityA - priorityB
      })

    for (const plugin of newPreprocessors) {
      finalOrder.push(plugin.manifest.name)
    }

    this.preprocessorOrder = finalOrder

    // 保存合并后的顺序
    if (this.config.autoSaveOnChange && newPreprocessors.length > 0) {
      await this.saveOrder()
    }

    this.isInitialized = true
    logger.info('PreprocessorChain initialized', {
      order: this.preprocessorOrder,
      total: this.preprocessorOrder.length
    })
  }

  /**
   * 获取可用的预处理器插件
   */
  private getAvailablePreprocessors(): VCPPlugin[] {
    return this.registry.getPluginsByType('messagePreprocessor')
  }

  /**
   * 获取按顺序排列的预处理器
   */
  getOrderedPreprocessors(): VCPPlugin[] {
    const plugins: VCPPlugin[] = []

    for (const name of this.preprocessorOrder) {
      const plugin = this.registry.getPlugin(name)
      if (plugin && plugin.enabled && plugin.manifest.pluginType === 'messagePreprocessor') {
        plugins.push(plugin)
      }
    }

    return plugins
  }

  /**
   * 获取当前顺序
   */
  getOrder(): string[] {
    return [...this.preprocessorOrder]
  }

  /**
   * 设置新顺序
   */
  async setOrder(order: string[]): Promise<boolean> {
    // 验证所有名称都是有效的预处理器
    const available = new Set(this.getAvailablePreprocessors().map((p) => p.manifest.name))
    const invalidNames = order.filter((name) => !available.has(name))

    if (invalidNames.length > 0) {
      logger.warn('Invalid preprocessor names in order', { invalidNames })
      return false
    }

    // 去重
    const uniqueOrder = [...new Set(order)]

    // 追加未包含的预处理器
    for (const name of available) {
      if (!uniqueOrder.includes(name)) {
        uniqueOrder.push(name)
      }
    }

    this.preprocessorOrder = uniqueOrder

    if (this.config.autoSaveOnChange) {
      await this.saveOrder()
    }

    logger.info('Preprocessor order updated', { order: this.preprocessorOrder })
    return true
  }

  /**
   * 按顺序执行预处理器链
   */
  async executeChain(messages: ChatMessage[]): Promise<PreprocessorResult> {
    const orderedPreprocessors = this.getOrderedPreprocessors()

    if (orderedPreprocessors.length === 0) {
      return { messages, modified: false }
    }

    let currentMessages = messages
    let anyModified = false
    const allMetadata: Record<string, any> = {}

    logger.debug('Executing preprocessor chain', {
      count: orderedPreprocessors.length,
      names: orderedPreprocessors.map((p) => p.manifest.name)
    })

    for (const plugin of orderedPreprocessors) {
      try {
        const startTime = Date.now()
        const result = await this.executor.executePreprocessor(plugin, currentMessages)
        const duration = Date.now() - startTime

        if (result.modified) {
          currentMessages = result.messages
          anyModified = true

          if (result.metadata) {
            allMetadata[plugin.manifest.name] = result.metadata
          }

          logger.debug('Preprocessor modified messages', {
            name: plugin.manifest.name,
            duration,
            messageCount: result.messages.length
          })
        }
      } catch (error) {
        logger.error('Preprocessor execution failed', {
          name: plugin.manifest.name,
          error: error instanceof Error ? error.message : String(error)
        })
        // 继续执行下一个预处理器
      }
    }

    return {
      messages: currentMessages,
      modified: anyModified,
      metadata: Object.keys(allMetadata).length > 0 ? allMetadata : undefined
    }
  }

  /**
   * 重新加载预处理器链
   */
  async reload(): Promise<void> {
    this.isInitialized = false
    await this.initialize()
  }

  /**
   * 保存顺序到文件
   */
  private async saveOrder(): Promise<void> {
    try {
      const orderData: PreprocessorChainOrder = {
        version: 1,
        order: this.preprocessorOrder,
        updatedAt: Date.now()
      }

      await fs.promises.writeFile(this.config.orderFilePath, JSON.stringify(orderData, null, 2), 'utf-8')

      logger.debug('Saved preprocessor order', { path: this.config.orderFilePath })
    } catch (error) {
      logger.error('Failed to save preprocessor order', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 从文件加载顺序
   */
  private async loadOrder(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.config.orderFilePath)) {
        logger.debug('Preprocessor order file not found, using empty order')
        return []
      }

      const content = await fs.promises.readFile(this.config.orderFilePath, 'utf-8')
      const data = JSON.parse(content) as PreprocessorChainOrder

      if (data.version !== 1) {
        logger.warn('Unknown preprocessor order version', { version: data.version })
        return []
      }

      if (!Array.isArray(data.order)) {
        logger.warn('Invalid preprocessor order format')
        return []
      }

      logger.debug('Loaded preprocessor order', { order: data.order })
      return data.order
    } catch (error) {
      logger.error('Failed to load preprocessor order', {
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * 获取预处理器信息列表（用于 UI）
   */
  getPreprocessorInfo(): Array<{
    name: string
    displayName: string
    description: string
    enabled: boolean
    order: number
  }> {
    const available = this.getAvailablePreprocessors()
    const orderMap = new Map(this.preprocessorOrder.map((name, index) => [name, index]))

    return available.map((plugin) => ({
      name: plugin.manifest.name,
      displayName: plugin.manifest.displayName || plugin.manifest.name,
      description: plugin.manifest.description || '',
      enabled: plugin.enabled,
      order: orderMap.get(plugin.manifest.name) ?? 999
    }))
  }
}

/**
 * 创建预处理器链实例
 */
export function createPreprocessorChain(
  registry: PluginRegistry,
  executor: PluginExecutor,
  config?: Partial<PreprocessorChainConfig>
): PreprocessorChain {
  return new PreprocessorChain(registry, executor, config)
}
