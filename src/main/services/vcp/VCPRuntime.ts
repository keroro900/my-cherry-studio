/**
 * VCP Native Runtime - Core
 *
 * 原生插件运行时核心，完全替换 VCPToolBoxBridge 执行路径
 *
 * 架构：
 * - PluginRegistry: 清单加载 + 插件生命周期
 * - PluginExecutor: stdio/native/service 执行适配
 * - PlaceholderEngine: 变量/占位符解析与注入
 *
 * API：
 * - initialize(config): Promise<void>
 * - listPlugins(): VCPPlugin[]
 * - getPlugin(name): VCPPlugin | null
 * - executeTool(name, params, context): Promise<PluginExecutionResult>
 * - executePreprocessors(messages, context): Promise<messages>
 * - shutdown(): Promise<void>
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { PlaceholderEngine } from './PlaceholderEngine'
import { createPreprocessorChain, type PreprocessorChain } from './PreprocessorChain'
import type { PluginExecutor } from './PluginExecutor'
import { createPluginExecutor } from './PluginExecutor'
import { initializeBuiltinPlugins } from './PluginInitializer'
import type { PluginRegistry } from './PluginRegistry'
import { createPluginRegistry } from './PluginRegistry'
import { createStaticPluginScheduler, type StaticPluginScheduler } from './StaticPluginScheduler'
import type {
  ChatMessage,
  ParsedToolRequest,
  PlaceholderContext,
  PreprocessorResult,
  ToolRequestParseResult,
  VCPExecutionContext,
  VCPPlugin,
  VCPRuntimeConfig,
  VCPRuntimeEvent,
  VCPRuntimeEventListener,
  VCPToolResult
} from './types'
import { vcpDetectorService } from './VCPDetectorService'
import {
  purifyMessages as purifyMessagesUtil,
  type PurifierConfig,
  type PurifierMessage,
  type PurifierResult
} from './VCPSuperPurifier'

const logger = loggerService.withContext('VCPRuntime')

/**
 * VCP 原生运行时
 */
export class VCPRuntime {
  private static instance: VCPRuntime | null = null

  private config: VCPRuntimeConfig
  private registry: PluginRegistry | null = null
  private executor: PluginExecutor | null = null
  private placeholderEngine: PlaceholderEngine | null = null
  private preprocessorChain: PreprocessorChain | null = null
  private staticScheduler: StaticPluginScheduler | null = null

  private initialized: boolean = false
  private eventListeners: Set<VCPRuntimeEventListener> = new Set()

  private constructor(config: Partial<VCPRuntimeConfig>) {
    this.config = this.buildConfig(config)
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<VCPRuntimeConfig>): VCPRuntime {
    if (!VCPRuntime.instance) {
      VCPRuntime.instance = new VCPRuntime(config || {})
    }
    return VCPRuntime.instance
  }

  /**
   * 重置实例（用于测试）
   * 注意：此方法是异步的，需要 await
   */
  static async resetInstance(): Promise<void> {
    if (VCPRuntime.instance) {
      await VCPRuntime.instance.shutdown()
      VCPRuntime.instance = null
    }
  }

  /**
   * 构建配置
   */
  private buildConfig(partial: Partial<VCPRuntimeConfig>): VCPRuntimeConfig {
    const userData = app.getPath('userData')

    const defaultConfig: VCPRuntimeConfig = {
      pluginsDir: path.join(userData, 'vcp', 'plugins', 'user'),
      builtinPluginsDir: path.join(userData, 'vcp', 'plugins', 'builtin'),
      nativeOnly: false, // 启用 stdio 插件支持（synchronous/asynchronous 类型）
      debugMode: false,
      defaultTimeout: 30000,
      maxConcurrent: 5,
      async: {
        resultStorePath: path.join(userData, 'vcp', 'async-results'),
        maxWaitTime: 300000,
        cleanupInterval: 3600000
      },
      callback: {
        enabled: true,
        port: 19280,
        host: '127.0.0.1'
      },
      logging: {
        enabled: true,
        level: 'info',
        maxEntries: 1000
      }
    }

    return {
      ...defaultConfig,
      ...partial,
      async: { ...defaultConfig.async, ...partial.async },
      callback: { ...defaultConfig.callback, ...partial.callback },
      logging: { ...defaultConfig.logging, ...partial.logging }
    }
  }

  /**
   * 初始化运行时
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('VCPRuntime already initialized')
      return
    }

    logger.info('Initializing VCPRuntime...', { config: this.config })

    try {
      // 确保目录存在
      this.ensureDirectories()

      // 初始化内置插件（从外部目录复制到用户数据目录）
      const initResult = await initializeBuiltinPlugins()
      logger.info('Builtin plugins initialized', {
        copied: initResult.copied.length,
        skipped: initResult.skipped.length,
        failed: initResult.failed.length
      })

      // 初始化内置服务（原生 TypeScript 实现）
      const { initializeBuiltinServices } = await import('./BuiltinServices')
      const builtinServiceRegistry = await initializeBuiltinServices()
      logger.info('Builtin services initialized', {
        count: builtinServiceRegistry.getAll().length,
        services: builtinServiceRegistry.getAll().map((s) => s.name)
      })

      // 初始化 DetectorX/SuperDetectorX 检测器服务
      await vcpDetectorService.initialize()
      const detectorStats = vcpDetectorService.getStats()
      logger.info('VCPDetectorService initialized', {
        detectorRules: detectorStats.detectorRules.total,
        superDetectorRules: detectorStats.superDetectorRules.total
      })

      // 创建注册表
      this.registry = createPluginRegistry(this.config)

      // 加载所有插件
      await this.registry.loadAllPlugins()

      // 创建执行器
      this.executor = createPluginExecutor(this.config, this.registry)

      // 创建预处理器链
      this.preprocessorChain = createPreprocessorChain(this.registry, this.executor)
      await this.preprocessorChain.initialize()
      this.executor.setPreprocessorChain(this.preprocessorChain)
      logger.info('PreprocessorChain initialized')

      // 创建占位符引擎
      this.placeholderEngine = new PlaceholderEngine(this.registry, this.executor)
      await this.placeholderEngine.initialize()

      // 创建静态插件调度器
      this.staticScheduler = createStaticPluginScheduler(this.registry, this.executor, this.placeholderEngine)
      await this.staticScheduler.initialize()
      logger.info('StaticPluginScheduler initialized')

      this.initialized = true
      logger.info('VCPRuntime initialized successfully', {
        pluginCount: this.registry.size,
        builtinServiceCount: builtinServiceRegistry.getAll().length
      })
    } catch (error) {
      logger.error('Failed to initialize VCPRuntime', {
        error: error instanceof Error ? error : new Error(String(error))
      })
      throw error
    }
  }

  /**
   * 确保必要目录存在
   */
  private ensureDirectories(): void {
    const dirs = [this.config.pluginsDir, this.config.builtinPluginsDir, this.config.async.resultStorePath]

    for (const dir of dirs) {
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.debug('Created directory', { dir })
      }
    }
  }

  // ==================== 插件管理 ====================

  /**
   * 获取所有插件
   */
  listPlugins(): VCPPlugin[] {
    if (!this.registry) return []
    return this.registry.getAllPlugins()
  }

  /**
   * 获取启用的插件
   */
  listEnabledPlugins(): VCPPlugin[] {
    if (!this.registry) return []
    return this.registry.getEnabledPlugins()
  }

  /**
   * 获取单个插件
   */
  getPlugin(name: string): VCPPlugin | null {
    if (!this.registry) return null
    return this.registry.getPlugin(name)
  }

  /**
   * 检查插件是否存在
   */
  hasPlugin(name: string): boolean {
    if (!this.registry) return false
    return this.registry.has(name)
  }

  /**
   * 重新加载所有插件
   */
  async reloadPlugins(): Promise<void> {
    if (!this.registry) return
    await this.registry.loadAllPlugins()

    // 刷新占位符
    if (this.placeholderEngine) {
      await this.placeholderEngine.refreshStaticPlaceholders()
    }

    // 重新加载预处理器链
    if (this.preprocessorChain) {
      await this.preprocessorChain.reload()
    }

    // 重新加载静态插件调度器
    if (this.staticScheduler) {
      await this.staticScheduler.reload()
    }

    logger.info('Plugins reloaded', { count: this.registry.size })
  }

  /**
   * 重新加载单个插件
   */
  async reloadPlugin(name: string): Promise<boolean> {
    if (!this.registry) return false
    return this.registry.reloadPlugin(name)
  }

  /**
   * 获取执行器实例（用于访问异步任务状态）
   */
  getExecutor(): PluginExecutor | null {
    return this.executor
  }

  /**
   * 获取注册表实例
   */
  getRegistry(): PluginRegistry | null {
    return this.registry
  }

  /**
   * 获取预处理器链实例
   */
  getPreprocessorChain(): PreprocessorChain | null {
    return this.preprocessorChain
  }

  /**
   * 获取预处理器顺序
   */
  getPreprocessorOrder(): string[] {
    if (!this.preprocessorChain) return []
    return this.preprocessorChain.getOrder()
  }

  /**
   * 设置预处理器顺序
   */
  async setPreprocessorOrder(order: string[]): Promise<boolean> {
    if (!this.preprocessorChain) return false
    return this.preprocessorChain.setOrder(order)
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
    if (!this.preprocessorChain) return []
    return this.preprocessorChain.getPreprocessorInfo()
  }

  /**
   * 获取静态插件调度器
   */
  getStaticScheduler(): StaticPluginScheduler | null {
    return this.staticScheduler
  }

  // ==================== 工具执行 ====================

  /**
   * 执行工具
   */
  async executeTool(name: string, params: Record<string, any>, context?: VCPExecutionContext): Promise<VCPToolResult> {
    if (!this.initialized || !this.executor) {
      return {
        success: false,
        error: 'VCPRuntime not initialized'
      }
    }

    // 发送事件
    this.emitEvent({
      type: 'tool:start',
      request: { toolName: name, params, context }
    })

    try {
      const result = await this.executor.execute(name, params, context)

      // 发送完成事件
      this.emitEvent({
        type: 'tool:complete',
        request: { toolName: name, params, context },
        result
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // 发送错误事件
      this.emitEvent({
        type: 'tool:error',
        request: { toolName: name, params, context },
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  // ==================== 消息预处理 ====================

  /**
   * 执行所有预处理器
   */
  async executePreprocessors(messages: ChatMessage[]): Promise<PreprocessorResult> {
    if (!this.initialized || !this.executor) {
      return { messages, modified: false }
    }

    return this.executor.executeAllPreprocessors(messages)
  }

  // ==================== 占位符处理 ====================

  /**
   * 解析文本中的占位符
   */
  async resolvePlaceholders(text: string, context?: PlaceholderContext): Promise<string> {
    if (!this.initialized || !this.placeholderEngine) {
      return text
    }

    return this.placeholderEngine.resolve(text, context)
  }

  /**
   * 获取占位符值
   */
  getPlaceholderValue(placeholder: string): string | undefined {
    if (!this.placeholderEngine) return undefined
    return this.placeholderEngine.getStaticValue(placeholder)
  }

  /**
   * 设置占位符值
   */
  setPlaceholderValue(placeholder: string, value: string): void {
    if (!this.placeholderEngine) return
    this.placeholderEngine.setStaticValue(placeholder, value)
  }

  /**
   * 设置异步结果
   */
  setAsyncResult(pluginName: string, taskId: string, result: VCPToolResult): void {
    if (!this.placeholderEngine) return
    this.placeholderEngine.setAsyncResult(pluginName, taskId, result)
  }

  /**
   * 设置日记内容
   */
  setDiaryContent(diaryName: string, content: string): void {
    if (!this.placeholderEngine) return
    this.placeholderEngine.setDiaryContent(diaryName, content)
  }

  /**
   * 设置 VCPTavern 规则
   */
  setTavernRules(rules: Record<string, string>): void {
    if (!this.placeholderEngine) return
    this.placeholderEngine.setTavernRules(rules)
  }

  // ==================== 消息净化 (VCPToolBox 对标) ====================

  /**
   * 将 ChatMessage 转换为 PurifierMessage
   */
  private convertToPurifierMessages(messages: ChatMessage[]): PurifierMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text || '').join(''),
      timestamp: Date.now(),
      metadata: {}
    }))
  }

  /**
   * 净化消息列表
   * 支持去重、格式归一化、压缩等功能
   */
  async purifyMessages(messages: ChatMessage[], config?: Partial<PurifierConfig>): Promise<PurifierResult> {
    const purifierMessages = this.convertToPurifierMessages(messages)
    return purifyMessagesUtil(purifierMessages, config)
  }

  /**
   * 快速净化消息 (仅去重和归一化)
   */
  async purifyMessagesQuick(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const purifierMessages = this.convertToPurifierMessages(messages)
    const result = await purifyMessagesUtil(purifierMessages, {
      enableDeduplication: true,
      enableNormalization: true,
      enableCompression: false
    })
    return result.messages
  }

  // ==================== TOOL_REQUEST 解析 ====================

  /**
   * 解析 TOOL_REQUEST 块
   *
   * 支持格式：
   * <<<[TOOL_REQUEST]>>>
   * tool_name:「始」xxx「末」
   * param1:「始」value1「末」
   * <<<[END_TOOL_REQUEST]>>>
   */
  parseToolRequests(text: string): ToolRequestParseResult {
    const requests: ParsedToolRequest[] = []
    const errors: string[] = []

    // 匹配 TOOL_REQUEST 块
    const blockPattern = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g
    let blockMatch

    while ((blockMatch = blockPattern.exec(text)) !== null) {
      const blockContent = blockMatch[1]
      const startIndex = blockMatch.index
      const endIndex = blockMatch.index + blockMatch[0].length

      try {
        const parsed = this.parseToolRequestBlock(blockContent)
        requests.push({
          ...parsed,
          rawText: blockMatch[0],
          startIndex,
          endIndex
        })
      } catch (error) {
        errors.push(
          `Failed to parse TOOL_REQUEST at position ${startIndex}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    return {
      requests,
      hasError: errors.length > 0,
      errors
    }
  }

  /**
   * 解析单个 TOOL_REQUEST 块内容
   */
  private parseToolRequestBlock(content: string): Omit<ParsedToolRequest, 'rawText' | 'startIndex' | 'endIndex'> {
    const params: Record<string, string> = {}
    const rawParams: Record<string, string> = {}
    let pluginName = ''

    // 匹配 key:「始」value「末」 格式
    const kvPattern = /([a-zA-Z0-9_-]+)\s*[:：]\s*「始」([\s\S]*?)「末」/g
    let kvMatch

    while ((kvMatch = kvPattern.exec(content)) !== null) {
      const [, key, value] = kvMatch
      const normalizedKey = this.normalizeKey(key)

      // 保存原始 key
      rawParams[key] = value

      // 工具名特殊处理
      if (normalizedKey === 'tool_name' || normalizedKey === 'toolname') {
        pluginName = value.trim()
      } else {
        params[normalizedKey] = value
      }
    }

    // 如果没有找到 tool_name，尝试其他格式
    if (!pluginName) {
      // 尝试匹配 tool_name: xxx 格式（无「始」「末」）
      const simplePattern = /tool_name\s*[:：]\s*([^\n\r]+)/i
      const simpleMatch = content.match(simplePattern)
      if (simpleMatch) {
        pluginName = simpleMatch[1].trim()
      }
    }

    if (!pluginName) {
      throw new Error('Missing tool_name in TOOL_REQUEST')
    }

    return {
      pluginName,
      params,
      rawParams
    }
  }

  /**
   * Key 归一化
   * 统一转换为 snake_case 格式以确保与 VCPToolBox 兼容
   * 支持：camelCase, PascalCase, kebab-case, UPPER_CASE
   * 例如：imageSize, ImageSize, image-size, IMAGE_SIZE → image_size
   */
  private normalizeKey(key: string): string {
    return (
      key
        // 在大写字母前插入下划线 (处理 camelCase 和 PascalCase)
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        // 将连字符转为下划线
        .replace(/-/g, '_')
        // 转为小写
        .toLowerCase()
        // 移除重复的下划线
        .replace(/_+/g, '_')
        // 移除首尾下划线
        .replace(/^_|_$/g, '')
    )
  }

  /**
   * 格式化 TOOL_RESULT 块
   */
  formatToolResult(pluginName: string, result: VCPToolResult): string {
    if (result.success) {
      return `<<<[TOOL_RESULT]>>>
tool_name:「始」${pluginName}「末」
result:「始」${typeof result.output === 'string' ? result.output : JSON.stringify(result.output)}「末」
<<<[/TOOL_RESULT]>>>`
    } else {
      return `<<<[TOOL_ERROR]>>>
tool_name:「始」${pluginName}「末」
error:「始」${result.error || 'Unknown error'}「末」
<<<[/TOOL_ERROR]>>>`
    }
  }

  // ==================== 事件系统 ====================

  /**
   * 添加事件监听器
   */
  addEventListener(listener: VCPRuntimeEventListener): void {
    this.eventListeners.add(listener)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: VCPRuntimeEventListener): void {
    this.eventListeners.delete(listener)
  }

  /**
   * 发送事件
   */
  private emitEvent(event: VCPRuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        logger.warn('Event listener error', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  // ==================== 配置与状态 ====================

  /**
   * 获取配置
   */
  getConfig(): VCPRuntimeConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VCPRuntimeConfig>): void {
    this.config = this.buildConfig({ ...this.config, ...config })
  }

  /**
   * 保存插件配置到文件系统
   */
  async savePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const plugin = this.getPlugin(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // 配置文件存储在插件目录下的 user-config.json
    const configPath = path.join(plugin.basePath, 'user-config.json')

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      logger.info('Plugin config saved', { pluginId, configPath })
    } catch (error) {
      logger.error('Failed to save plugin config', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 加载插件配置（从文件系统）
   */
  loadPluginConfig(pluginId: string): Record<string, unknown> | null {
    const plugin = this.getPlugin(pluginId)
    if (!plugin) {
      return null
    }

    const configPath = path.join(plugin.basePath, 'user-config.json')

    if (!fs.existsSync(configPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.warn('Failed to load plugin config', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * 保存内置插件配置到统一存储
   */
  async saveBuiltinPluginConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const configDir = path.join(app.getPath('userData'), 'vcp', 'builtin-configs')

    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const configPath = path.join(configDir, `${pluginId}.json`)

    try {
      // 读取现有配置并合并
      let existingConfig: Record<string, unknown> = {}
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(content)
      }

      const mergedConfig = { ...existingConfig, ...config }
      fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8')
      logger.info('Builtin plugin config saved', { pluginId, configPath })
    } catch (error) {
      logger.error('Failed to save builtin plugin config', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 加载内置插件配置
   */
  loadBuiltinPluginConfig(pluginId: string): Record<string, unknown> | null {
    const configPath = path.join(app.getPath('userData'), 'vcp', 'builtin-configs', `${pluginId}.json`)

    if (!fs.existsSync(configPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.warn('Failed to load builtin plugin config', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取插件数量
   */
  getPluginCount(): number {
    return this.registry?.size || 0
  }

  /**
   * 获取运行状态
   */
  getStatus(): {
    initialized: boolean
    pluginCount: number
    runningProcesses: number
    debugMode: boolean
  } {
    return {
      initialized: this.initialized,
      pluginCount: this.registry?.size || 0,
      runningProcesses: 0, // stdio 已移除，不再跟踪运行中的进程
      debugMode: this.config.debugMode
    }
  }

  // ==================== 生命周期 ====================

  /**
   * 关闭运行时
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down VCPRuntime...')

    try {
      // 关闭静态插件调度器
      if (this.staticScheduler) {
        await this.staticScheduler.shutdown()
      }

      // 关闭内置服务
      try {
        const { getBuiltinServiceRegistry } = await import('./BuiltinServices')
        const builtinRegistry = getBuiltinServiceRegistry()
        await builtinRegistry.shutdown()
      } catch (error) {
        logger.warn('Error shutting down builtin services', {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // 取消所有运行中的进程
      if (this.executor) {
        this.executor.cleanup()
      }

      // 清空注册表
      if (this.registry) {
        this.registry.clear()
      }

      // 清空占位符缓存
      if (this.placeholderEngine) {
        this.placeholderEngine.clearAllCaches()
      }

      // 清空事件监听器
      this.eventListeners.clear()

      this.initialized = false
      logger.info('VCPRuntime shut down successfully')
    } catch (error) {
      logger.error('Error during VCPRuntime shutdown', {
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }
}

// ==================== 导出 ====================

let runtimeInstance: VCPRuntime | null = null

/**
 * 获取 VCP 运行时实例
 */
export function getVCPRuntime(config?: Partial<VCPRuntimeConfig>): VCPRuntime {
  if (!runtimeInstance) {
    runtimeInstance = VCPRuntime.getInstance(config)
  }
  return runtimeInstance
}

/**
 * 初始化 VCP 运行时
 */
export async function initializeVCPRuntime(config?: Partial<VCPRuntimeConfig>): Promise<VCPRuntime> {
  const runtime = getVCPRuntime(config)
  await runtime.initialize()
  return runtime
}

// 导出类型
export type { VCPPlugin, VCPToolResult, VCPExecutionContext, ParsedToolRequest, ToolRequestParseResult }

/**
 * VCP Key 归一化函数（导出供其他模块使用）
 *
 * 统一转换为 snake_case 格式以确保与 VCPToolBox 兼容
 * 支持：camelCase, PascalCase, kebab-case, UPPER_CASE
 *
 * 例如：imageSize, ImageSize, image-size, IMAGE_SIZE → image_size
 */
export function normalizeVCPKey(key: string): string {
  return (
    key
      // 在大写字母前插入下划线 (处理 camelCase 和 PascalCase)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      // 将连字符转为下划线
      .replace(/-/g, '_')
      // 转为小写
      .toLowerCase()
      // 移除重复的下划线
      .replace(/_+/g, '_')
      // 移除首尾下划线
      .replace(/^_|_$/g, '')
  )
}
