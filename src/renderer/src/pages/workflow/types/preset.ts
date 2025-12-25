/**
 * 工作流节点配置预设
 * 用于保存和加载常用的节点配置
 */

// 注意：不能从 './index' 导入，因为 index.ts 会 re-export preset.ts，导致循环依赖
// 这里使用字符串类型来避免重复定义枚举

/**
 * 配置预设
 */
export interface NodePreset {
  id: string
  name: string
  description?: string
  nodeType: string // 节点类型字符串，对应 WorkflowNodeType 枚举值
  config: Record<string, any> // 节点配置，与 WorkflowNodeData['config'] 类型一致
  createdAt: number
  updatedAt: number
  tags?: string[]
  icon?: string
}

/**
 * 预设分类
 */
export interface PresetCategory {
  id: string
  name: string
  presets: NodePreset[]
}

/**
 * 预设存储结构
 */
export interface PresetStorage {
  version: number
  presets: Record<string, NodePreset>
  categories: Record<string, PresetCategory>
}
