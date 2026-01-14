/**
 * TagMemo 服务
 *
 * 重新导出适配器中的类型和函数，保持与原有导入路径的兼容性。
 * TagMemo 现已完全原生化，不再依赖外部 VCPToolBox。
 */

export * from './index'
export { createTagMemoService, getTagMemoService, resetTagMemoService } from './index'
export type { CooccurrenceMatrix, TagBoostResult, TagMemoConfig, TagMemoService } from './index'
