/**
 * 节点注册中心
 *
 * 管理所有节点的注册、查找和加载
 * 支持内置节点和自定义节点的热加载
 */

import { loggerService } from '@logger'

import type { NodeCategory, NodeDefinition, NodeRegistryEntry } from './types'

const logger = loggerService.withContext('NodeRegistry')

/**
 * 节点注册中心
 * 单例模式，管理所有节点定义
 */
class NodeRegistry {
  private static instance: NodeRegistry
  private nodes: Map<string, NodeRegistryEntry> = new Map()
  private initialized = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry()
    }
    return NodeRegistry.instance
  }

  /**
   * 初始化注册中心
   * 加载所有内置节点
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    logger.info('Initializing NodeRegistry...')

    // 加载内置节点
    await this.loadBuiltinNodes()

    this.initialized = true
    logger.info('NodeRegistry initialized', { nodeCount: this.nodes.size })
  }

  /**
   * 加载内置节点
   */
  private async loadBuiltinNodes(): Promise<void> {
    // 动态导入内置节点
    // 这里会在后续添加具体的节点导入
    try {
      // 示例：加载输入节点
      // const { ImageInputNode } = await import('../input/ImageInputNode')
      // this.register(ImageInputNode)

      logger.info('Builtin nodes loaded')
    } catch (error) {
      logger.error('Failed to load builtin nodes', { error })
    }
  }

  /**
   * 注册节点
   * @param skipIfExists 如果节点已存在，是否跳过（默认 true，避免 HMR 重复警告）
   */
  register(
    definition: NodeDefinition,
    source: 'builtin' | 'custom' = 'builtin',
    filePath?: string,
    skipIfExists = true
  ): void {
    const { type } = definition.metadata

    if (this.nodes.has(type)) {
      if (skipIfExists) {
        // 静默跳过，避免 HMR 时产生大量警告
        return
      }
      logger.warn('Node type already registered, overwriting', { type })
    }

    this.nodes.set(type, {
      definition,
      loadedAt: Date.now(),
      source,
      filePath
    })

    logger.info('Node registered', {
      type,
      label: definition.metadata.label,
      category: definition.metadata.category,
      source
    })
  }

  /**
   * 注销节点
   */
  unregister(type: string): boolean {
    const deleted = this.nodes.delete(type)
    if (deleted) {
      logger.info('Node unregistered', { type })
    }
    return deleted
  }

  /**
   * 获取节点定义
   */
  get(type: string): NodeDefinition | undefined {
    return this.nodes.get(type)?.definition
  }

  /**
   * 获取节点注册表项
   */
  getEntry(type: string): NodeRegistryEntry | undefined {
    return this.nodes.get(type)
  }

  /**
   * 检查节点是否已注册
   */
  has(type: string): boolean {
    return this.nodes.has(type)
  }

  /**
   * 获取所有节点类型
   */
  getAllTypes(): string[] {
    return Array.from(this.nodes.keys())
  }

  /**
   * 获取所有节点定义
   */
  getAll(): NodeDefinition[] {
    return Array.from(this.nodes.values()).map((entry) => entry.definition)
  }

  /**
   * 按分类获取节点
   */
  getByCategory(category: NodeCategory): NodeDefinition[] {
    return this.getAll().filter((def) => def.metadata.category === category)
  }

  /**
   * 按标签搜索节点
   */
  searchByTags(tags: string[]): NodeDefinition[] {
    return this.getAll().filter((def) => {
      const nodeTags = def.metadata.tags || []
      return tags.some((tag) => nodeTags.includes(tag))
    })
  }

  /**
   * 搜索节点（按名称或描述）
   */
  search(query: string): NodeDefinition[] {
    const lowerQuery = query.toLowerCase()
    return this.getAll().filter((def) => {
      const { label, description, tags } = def.metadata
      return (
        label.toLowerCase().includes(lowerQuery) ||
        description?.toLowerCase().includes(lowerQuery) ||
        tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      )
    })
  }

  /**
   * 获取节点分类列表
   */
  getCategories(): { category: NodeCategory; count: number }[] {
    const categoryMap = new Map<NodeCategory, number>()

    for (const entry of this.nodes.values()) {
      const category = entry.definition.metadata.category
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
    }

    return Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count
    }))
  }

  /**
   * 加载自定义节点（从文件路径）
   * 支持热加载
   */
  async loadCustomNode(filePath: string): Promise<boolean> {
    try {
      logger.info('Loading custom node', { filePath })

      // 动态导入节点模块
      // 注意：在 Electron 环境中，需要使用特殊的加载方式
      const module = await import(/* @vite-ignore */ filePath)

      // 检查模块是否导出了节点定义
      const definition = module.default || module.nodeDefinition
      if (!definition || !definition.metadata?.type) {
        logger.error('Invalid node module', { filePath })
        return false
      }

      // 注册节点
      this.register(definition, 'custom', filePath)
      return true
    } catch (error) {
      logger.error('Failed to load custom node', { filePath, error })
      return false
    }
  }

  /**
   * 重新加载自定义节点
   */
  async reloadCustomNode(type: string): Promise<boolean> {
    const entry = this.nodes.get(type)
    if (!entry || entry.source !== 'custom' || !entry.filePath) {
      logger.warn('Cannot reload node', { type, reason: 'Not a custom node or no file path' })
      return false
    }

    // 先注销
    this.unregister(type)

    // 重新加载
    return this.loadCustomNode(entry.filePath)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number
    builtin: number
    custom: number
    byCategory: Record<NodeCategory, number>
  } {
    let builtin = 0
    let custom = 0
    const byCategory: Record<string, number> = {}

    for (const entry of this.nodes.values()) {
      if (entry.source === 'builtin') {
        builtin++
      } else {
        custom++
      }

      const category = entry.definition.metadata.category
      byCategory[category] = (byCategory[category] || 0) + 1
    }

    return {
      total: this.nodes.size,
      builtin,
      custom,
      byCategory: byCategory as Record<NodeCategory, number>
    }
  }

  /**
   * 清空注册中心
   */
  clear(): void {
    this.nodes.clear()
    this.initialized = false
    logger.info('NodeRegistry cleared')
  }
}

// 导出单例
export const nodeRegistry = NodeRegistry.getInstance()

export default NodeRegistry
