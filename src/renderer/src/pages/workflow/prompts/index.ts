/**
 * 提示词模块统一入口
 * Prompts Module Main Entry
 *
 * 所有提示词相关的导出都应该从这里获取
 * 这是提示词系统的单一来源（Single Source of Truth）
 */

// ==================== 统一服务导出 ====================

export {
  type PromptBuildContext,
  type PromptResult,
  PromptService,
  type PromptTemplates,
  type SupportedNodeType
} from './PromptService'

// ==================== 预设导出 ====================

export {
  // 年龄预设
  AGE_PRESETS,
  // 类型
  type AgePreset,
  type EcomDetailType,
  type EcomFillType,
  type EcomLayoutType,
  type EcomPlatformPreset,
  // 人种预设
  ETHNICITY_PRESETS,
  type EthnicityPreset,
  // 性别预设
  GENDER_PRESETS,
  type GenderPreset,
  getAgePreset,
  getAgePresetKeys,
  getEthnicityPreset,
  getEthnicityPresetKeys,
  getGenderPreset,
  getGenderPresetKeys,
  getPosePreset,
  getPosePresetKeys,
  getScenePreset,
  getScenePresetKeys,
  type PatternStylePreset,
  // 姿势预设
  POSE_PRESETS,
  type PosePreset,
  type PromptBlock,
  type PromptBuilderConfig,
  // 场景预设
  SCENE_PRESETS,
  type ScenePreset
} from './presets'

// ==================== 核心提示词导出 ====================

export {
  ALL_OUTPUT_SCHEMA,
  ECOM_GENERAL_RULES,
  ECOM_OUTPUT_SCHEMA,
  getOutputSchema,
  getRequiredFields,
  // JSON 约束
  HARD_JSON_OUTPUT_CONSTRAINTS,
  HARD_RULES,
  MODEL_OUTPUT_SCHEMA,
  PATTERN_OUTPUT_SCHEMA,
  PROFESSIONAL_STYLING_RULES,
  // 核心概念
  RECREATION_CONCEPT,
  REFERENCE_IMAGE_ANALYSIS,
  // SHEIN/TEMU 风格
  SHEIN_TEMU_SWEET_STYLE,
  // 主题规则
  THEME_BACKGROUND_RULES
} from './core'

// ==================== 构建器导出 ====================

export {
  type BasePromptJson,
  type BuildResult,
  type EcomConfig,
  EcomPromptBuilder,
  type EcomPromptJson,
  type GarmentAnalysis,
  type ModelConfig,
  ModelPromptBuilder,
  type ModelPromptJson,
  PromptBuilder,
  type PromptBuilderOptions,
  type PromptModule
} from './builders'

// ==================== 模块导出 ====================

export {
  AnalysisModule,
  ECOM_ANALYSIS_PROMPT,
  FillModule,
  LayoutModule,
  MODEL_ANALYSIS_PROMPT,
  ModelModule,
  PATTERN_ANALYSIS_PROMPT,
  QualityModule,
  ThemeModule
} from './modules'

// ==================== 电商模块导出 ====================

export {
  ECOM_DETAIL_PROMPTS,
  ECOM_LAYOUT_PROMPTS,
  ECOM_PROFESSIONAL_STYLING_RULES,
  ECOM_STYLE_PRESETS,
  ECOM_THEME_BACKGROUND_RULES,
  getEcomDetailPrompt,
  getEcomLayoutPrompt,
  getEcomStylePreset
} from './ecom'
