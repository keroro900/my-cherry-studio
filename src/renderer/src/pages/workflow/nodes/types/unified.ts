/**
 * 统一类型定义
 *
 * 此文件作为节点类型系统的单一真相来源，统一了两个定义源：
 * - nodes/definitions/index.ts (旧系统 - 已废弃)
 * - nodes/base/types.ts (现代系统 - 推荐)
 *
 * 使用方法：
 * ```typescript
 * import { WorkflowNodeType, PortDataType, NodeDefinition } from '../types/unified'
 * ```
 *
 * @module nodes/types/unified
 */

// =============================================================================
// 从定义模块导出 WorkflowNodeType 枚举（这是需要保留的）
// =============================================================================
export { WorkflowNodeType } from '../definitions'

// =============================================================================
// 统一的端口数据类型
// 合并了 definitions/index.ts 和 base/types.ts 中的定义
// =============================================================================

/**
 * 端口数据类型
 *
 * 统一定义，包含所有支持的数据类型：
 * - text: 文本字符串
 * - image: 单张图片 (base64 或路径)
 * - images: 图片数组
 * - video: 视频文件
 * - json: JSON 对象
 * - any: 任意类型
 * - boolean: 布尔值
 * - number: 数字
 */
export type PortDataType = 'text' | 'image' | 'images' | 'video' | 'json' | 'any' | 'boolean' | 'number'

/**
 * 旧版数据类型别名
 * @deprecated 请使用 PortDataType
 */
export type WorkflowDataType = PortDataType

// =============================================================================
// 从现代类型系统重导出
// =============================================================================

// 节点定义相关
export type {
  // 节点配置类型
  AINodeConfig,
  ConfigSection,
  ImageGenerateNodeConfig,
  ImageInputNodeConfig,
  NodeCategory,
  NodeConfigField,
  NodeConfigSchema,
  // 配置 UI 相关
  NodeConfigUI,
  NodeDefinition,
  NodeMetadata,
  NodePort,
  // 提示词相关
  NodePromptConfig,
  NodeRegistryEntry,
  OutputNodeConfig,
  PromptPreset,
  PromptStepDefinition,
  VisionPromptNodeConfig
} from '../base/types'

// 执行相关
export type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '../../types/core'

// =============================================================================
// 从旧定义系统导出（保持向后兼容）
// =============================================================================

/**
 * 旧版节点句柄接口
 * @deprecated 请使用 NodePort from '../base/types'
 */
export type { NodeHandle } from '../definitions'

// 节点配置类型（旧系统）- 保持向后兼容
export type {
  ConditionConfig,
  FolderPathItem,
  ImageEditConfig,
  ImageFileInfo,
  ImageGenerateConfig,
  ImageInputConfig,
  ImageMatchMode,
  ImageToVideoConfig,
  ListNodeConfig,
  LoopNodeConfig,
  OutputConfig,
  PipeNodeConfig,
  SwitchNodeConfig,
  TextInputConfig,
  VisionPromptConfig
} from '../definitions'

// =============================================================================
// 类型守卫和工具函数
// =============================================================================

/**
 * 检查数据类型是否为图片类型
 */
export function isImageType(dataType: PortDataType): boolean {
  return dataType === 'image' || dataType === 'images'
}

/**
 * 检查数据类型是否兼容
 * @param source 源端口数据类型
 * @param target 目标端口数据类型
 */
export function isTypeCompatible(source: PortDataType, target: PortDataType): boolean {
  // any 类型兼容所有类型
  if (source === 'any' || target === 'any') {
    return true
  }

  // 完全匹配
  if (source === target) {
    return true
  }

  // images 可以连接到 image（取第一张）
  if (source === 'images' && target === 'image') {
    return true
  }

  // image 可以连接到 images（包装成数组）
  if (source === 'image' && target === 'images') {
    return true
  }

  return false
}

/**
 * 获取数据类型的显示标签
 */
export function getDataTypeLabel(dataType: PortDataType): string {
  const labels: Record<PortDataType, string> = {
    text: '文本',
    image: '图片',
    images: '图片组',
    video: '视频',
    json: 'JSON',
    any: '任意',
    boolean: '布尔',
    number: '数字'
  }
  return labels[dataType] || dataType
}

/**
 * 获取数据类型的颜色（用于 UI 显示）
 */
export function getDataTypeColor(dataType: PortDataType): string {
  const colors: Record<PortDataType, string> = {
    text: '#10b981', // 绿色
    image: '#f59e0b', // 橙色
    images: '#f97316', // 深橙色
    video: '#8b5cf6', // 紫色
    json: '#3b82f6', // 蓝色
    any: '#6b7280', // 灰色
    boolean: '#ec4899', // 粉色
    number: '#06b6d4' // 青色
  }
  return colors[dataType] || '#6b7280'
}
