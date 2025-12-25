/**
 * 核心提示词模块统一导出
 * Core Prompts Module Unified Exports
 */

// 核心概念
export {
  HARD_JSON_OUTPUT_CONSTRAINTS,
  HARD_RULES,
  RECREATION_CONCEPT,
  REFERENCE_IMAGE_ANALYSIS
} from './concepts'

// 主题规则
export {
  ECOM_GENERAL_RULES,
  PROFESSIONAL_STYLING_RULES,
  SHEIN_TEMU_SWEET_STYLE,
  THEME_BACKGROUND_RULES
} from './themes'

// JSON 约束
export {
  ALL_OUTPUT_SCHEMA,
  ECOM_OUTPUT_SCHEMA,
  getOutputSchema,
  getRequiredFields,
  HARD_JSON_OUTPUT_CONSTRAINTS as JSON_OUTPUT_CONSTRAINTS,
  MODEL_OUTPUT_SCHEMA,
  PATTERN_OUTPUT_SCHEMA
} from './json-constraints'
