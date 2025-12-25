/**
 * 自定义节点模块
 * Custom Node Module
 *
 * 支持用户在 UI 端创建和管理自定义节点
 */

export { CustomNodeExecutor } from './CustomNodeExecutor'
export { customNodeRegistry } from './CustomNodeRegistry'
export type { CustomNodeDefinition, CustomNodeStorage } from './CustomNodeRegistry'
export {
  BUILTIN_TEMPLATES,
  createDefaultCustomNodeDefinition,
  validateCustomNodeDefinition
} from './types'
export type {
  CodeExecutionMode,
  CustomConfigField,
  CustomNodeTemplate,
  CustomPortConfig,
  ErrorHandlingStrategy
} from './types'
