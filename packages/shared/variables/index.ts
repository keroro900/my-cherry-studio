/**
 * 统一变量系统
 *
 * 提供跨进程的变量解析能力，供 renderer 和 main 共同使用
 *
 * 使用示例：
 * ```typescript
 * import { resolveBasicSyncVariables, containsVariables } from '@shared/variables'
 *
 * // 检查是否包含变量
 * if (containsVariables(text)) {
 *   // 解析基础同步变量
 *   const result = resolveBasicSyncVariables(text, { modelName: 'GPT-4' })
 *   console.log(result.text)
 * }
 * ```
 */

// ============================================================================
// 新版统一类型导出（推荐使用）
// ============================================================================
export type {
  VCPVariable,
  VCPVariableInput,
  VCPVariableUpdate,
  VariableScope,
  VariableSource,
  VariableCategoryType,
  DynamicValueGetter,
  ImportConflict,
  ImportResult
} from './types'

export { VARIABLE_CATEGORIES } from './types'

// ============================================================================
// 旧版类型导出（保持向后兼容，标记为 @deprecated）
// ============================================================================
export type {
  VariableCategory,
  VariableDefinition,
  VariableContext,
  VariableResolveResult
} from './types'

// 常量导出
export { BASIC_VARIABLES, DYNAMIC_VARIABLE_PATTERNS, buildVariableMap, getSupportedVariablePlaceholders } from './types'

// 工具函数导出
export { getChineseWeekday, getShortWeekday, getGreeting, escapeRegExp } from './BasicVariables'

// 变量值获取
export { getDateTimeVariables, getCulturalVariables, getFestivalInfo } from './BasicVariables'

// 变量解析
export { resolveBasicSyncVariables } from './BasicVariables'

// 变量检测
export { containsVariables, containsVCPVariables, extractVariablePlaceholders } from './BasicVariables'
