/**
 * 节点注册系统适配器
 *
 * 提供统一的节点访问接口
 * 所有节点现在都通过 NodeRegistry 现代系统管理
 */

import { loggerService } from '@logger'

import type { WorkflowNodeType } from '../../types'
import { initializeNodeSystem } from '..'
import type { LegacyNodeDefinition } from '../definitions/node-types'
import { nodeRegistry } from './NodeRegistry'
import type { NodeDefinition as ModernNodeDefinition } from './types'

const logger = loggerService.withContext('NodeRegistryAdapter')

/**
 * 节点注册系统适配器
 *
 * 统一访问节点注册系统
 */
export class NodeRegistryAdapter {
  private static initialized = false

  static isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 初始化适配器
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    logger.info('初始化节点注册系统适配器...')

    // 确保新系统已初始化（注册中心自身）
    await nodeRegistry.initialize()

    // 注册现代 @nodes 内置节点
    await initializeNodeSystem()

    this.initialized = true

    logger.info('节点注册系统适配器初始化完成', {
      modernNodeCount: nodeRegistry.getAllTypes().length
    })
  }

  // ==================== 类型转换工具 ====================

  /**
   * 将 Modern 定义转换为 Legacy 格式
   */
  static convertModernToLegacy(modernDef: ModernNodeDefinition): LegacyNodeDefinition {
    return {
      type: modernDef.metadata.type as any,
      label: modernDef.metadata.label,
      icon: modernDef.metadata.icon,
      category: modernDef.metadata.category,
      description: modernDef.metadata.description || '',
      defaultInputs: modernDef.inputs.map((p) => ({
        id: p.id,
        label: p.label,
        dataType: p.dataType as any,
        required: p.required,
        multiple: p.multiple
      })),
      defaultOutputs: modernDef.outputs.map((p) => ({
        id: p.id,
        label: p.label,
        dataType: p.dataType as any,
        required: p.required,
        multiple: p.multiple
      })),
      defaultConfig: modernDef.defaultConfig || {}
    }
  }

  // ==================== 统一访问接口 ====================

  /**
   * 获取节点定义
   */
  static getNodeDefinition(
    nodeType: WorkflowNodeType | string
  ): LegacyNodeDefinition | ModernNodeDefinition | undefined {
    return nodeRegistry.get(nodeType)
  }

  /**
   * 检查节点是否存在
   */
  static hasNode(nodeType: WorkflowNodeType | string): boolean {
    return nodeRegistry.has(nodeType)
  }

  /**
   * 获取所有可用的节点类型
   */
  static getAllNodeTypes(): WorkflowNodeType[] {
    return nodeRegistry.getAllTypes() as WorkflowNodeType[]
  }

  /**
   * 按分类获取节点
   */
  static getNodesByCategory(category: string): (LegacyNodeDefinition | ModernNodeDefinition)[] {
    return nodeRegistry.getByCategory(category as any)
  }

  /**
   * 搜索节点
   */
  static searchNodes(query: string): (LegacyNodeDefinition | ModernNodeDefinition)[] {
    return nodeRegistry.search(query)
  }

  /**
   * 获取迁移状态
   */
  static getMigrationStatus() {
    const modernCount = nodeRegistry.getAllTypes().length

    return {
      total: modernCount,
      migrated: modernCount,
      remaining: 0,
      modern: modernCount,
      progress: 1.0
    }
  }
}

// 导出单例实例
export const nodeRegistryAdapter = NodeRegistryAdapter
