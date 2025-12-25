/**
 * 自定义节点注册表
 * Custom Node Registry
 *
 * 管理用户创建的自定义节点：
 * - 加载/保存自定义节点定义
 * - 动态注册到主节点注册表
 * - 支持导入/导出
 */

import { loggerService } from '@logger'

import type { NodeDefinition, PortDefinition } from '../base/types'
import { nodeRegistry } from '../base'
import { CustomNodeExecutor } from './CustomNodeExecutor'
import type { CustomNodeDefinition, CustomNodeStorage, CustomPortConfig } from './types'
import { createDefaultCustomNodeDefinition, validateCustomNodeDefinition } from './types'

const logger = loggerService.withContext('CustomNodeRegistry')
const STORAGE_KEY = 'cherry_workflow_custom_nodes'

/**
 * 自定义节点注册表
 */
class CustomNodeRegistryClass {
  private nodes: Map<string, CustomNodeDefinition> = new Map()
  private executors: Map<string, CustomNodeExecutor> = new Map()
  private initialized = false

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 从本地存储加载
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const storage: CustomNodeStorage = JSON.parse(stored)
        for (const def of storage.nodes) {
          if (def.enabled) {
            this.registerNode(def)
          }
        }
        logger.info('加载自定义节点', { count: this.nodes.size })
      }
    } catch (error) {
      logger.warn('加载自定义节点失败', { error: String(error) })
    }

    this.initialized = true
  }

  /**
   * 注册自定义节点
   */
  registerNode(definition: CustomNodeDefinition): boolean {
    const errors = validateCustomNodeDefinition(definition)
    if (errors.length > 0) {
      logger.warn('节点定义验证失败', { type: definition.type, errors })
      return false
    }

    const nodeType = `custom_${definition.type}`

    // 创建执行器
    const executor = new CustomNodeExecutor(definition)
    this.executors.set(nodeType, executor)

    // 创建节点定义
    const nodeDefinition = this.convertToNodeDefinition(definition)

    // 注册到主注册表
    try {
      nodeRegistry.register(nodeDefinition, 'custom')
      this.nodes.set(definition.id, definition)
      logger.info('注册自定义节点', { type: nodeType, label: definition.label })
      return true
    } catch (error) {
      logger.warn('注册节点失败', { type: nodeType, error: String(error) })
      return false
    }
  }

  /**
   * 注销自定义节点
   */
  unregisterNode(id: string): boolean {
    const definition = this.nodes.get(id)
    if (!definition) return false

    const nodeType = `custom_${definition.type}`

    // 从主注册表移除
    nodeRegistry.unregister(nodeType)

    // 清理本地缓存
    this.nodes.delete(id)
    this.executors.delete(nodeType)

    logger.info('注销自定义节点', { type: nodeType })
    return true
  }

  /**
   * 更新自定义节点
   */
  updateNode(definition: CustomNodeDefinition): boolean {
    // 先注销旧的
    this.unregisterNode(definition.id)
    // 重新注册
    return this.registerNode(definition)
  }

  /**
   * 获取所有自定义节点
   */
  getAllNodes(): CustomNodeDefinition[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 获取单个自定义节点
   */
  getNode(id: string): CustomNodeDefinition | undefined {
    return this.nodes.get(id)
  }

  /**
   * 获取节点执行器
   */
  getExecutor(nodeType: string): CustomNodeExecutor | undefined {
    return this.executors.get(nodeType)
  }

  /**
   * 保存到本地存储
   */
  save(): void {
    const storage: CustomNodeStorage = {
      nodes: Array.from(this.nodes.values()),
      version: 1,
      lastUpdated: Date.now()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
    logger.info('保存自定义节点', { count: storage.nodes.length })
  }

  /**
   * 创建新节点
   */
  createNode(): CustomNodeDefinition {
    return createDefaultCustomNodeDefinition()
  }

  /**
   * 添加并保存节点
   */
  addNode(definition: CustomNodeDefinition): boolean {
    if (this.registerNode(definition)) {
      this.save()
      return true
    }
    return false
  }

  /**
   * 删除节点
   */
  deleteNode(id: string): boolean {
    if (this.unregisterNode(id)) {
      this.save()
      return true
    }
    return false
  }

  /**
   * 导出节点定义
   */
  exportNode(id: string): string | null {
    const node = this.nodes.get(id)
    if (!node) return null

    return JSON.stringify(node, null, 2)
  }

  /**
   * 导出所有节点
   */
  exportAll(): string {
    const storage: CustomNodeStorage = {
      nodes: Array.from(this.nodes.values()),
      version: 1,
      lastUpdated: Date.now()
    }
    return JSON.stringify(storage, null, 2)
  }

  /**
   * 导入节点定义
   */
  importNode(json: string): { success: boolean; errors?: string[] } {
    try {
      const parsed = JSON.parse(json)

      // 检查是否是单个节点还是存储对象
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        // 批量导入
        const results: string[] = []
        for (const def of parsed.nodes) {
          const errors = validateCustomNodeDefinition(def)
          if (errors.length > 0) {
            results.push(`${def.type}: ${errors.join(', ')}`)
          } else {
            // 生成新 ID 避免冲突
            def.id = `custom_${Date.now()}_${Math.random().toString(36).slice(2)}`
            def.createdAt = Date.now()
            def.updatedAt = Date.now()
            this.registerNode(def)
          }
        }
        this.save()
        return results.length > 0 ? { success: true, errors: results } : { success: true }
      } else {
        // 单个节点导入
        const errors = validateCustomNodeDefinition(parsed)
        if (errors.length > 0) {
          return { success: false, errors }
        }

        // 生成新 ID
        parsed.id = `custom_${Date.now()}`
        parsed.createdAt = Date.now()
        parsed.updatedAt = Date.now()

        if (this.addNode(parsed)) {
          return { success: true }
        }
        return { success: false, errors: ['注册失败'] }
      }
    } catch (error) {
      return { success: false, errors: ['JSON 解析失败: ' + String(error)] }
    }
  }

  /**
   * 转换为标准节点定义
   */
  private convertToNodeDefinition(def: CustomNodeDefinition): NodeDefinition {
    const nodeType = `custom_${def.type}`
    const executor = this.executors.get(nodeType)

    if (!executor) {
      throw new Error(`Executor not found for ${nodeType}`)
    }

    return {
      metadata: {
        type: nodeType,
        label: def.label,
        icon: def.icon,
        category: def.category === 'custom' ? 'flow' : def.category,
        version: def.version,
        author: def.author || 'Custom',
        description: def.description,
        tags: ['custom', ...(def.tags || [])]
      },
      inputs: def.inputs.map(this.convertPort),
      outputs: def.outputs.map(this.convertPort),
      configSchema: {
        fields: def.configFields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          default: field.default,
          placeholder: field.placeholder,
          description: field.description,
          min: field.min,
          max: field.max,
          options: field.options
        }))
      },
      defaultConfig: def.defaultConfig,
      executor
    }
  }

  /**
   * 转换端口定义
   */
  private convertPort(port: CustomPortConfig): PortDefinition {
    return {
      id: port.id,
      label: port.label,
      dataType: port.dataType,
      required: port.required,
      description: port.description
    }
  }
}

// 单例
export const customNodeRegistry = new CustomNodeRegistryClass()

// 导出类型
export type { CustomNodeDefinition, CustomNodeStorage }
