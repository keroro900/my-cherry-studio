/**
 * 预设模块统一导出
 * Presets Module Unified Exports
 *
 * 所有预设的单一来源（Single Source of Truth）
 * 其他文件应该从这里导入，而不是从原始定义文件导入
 */

// 类型导出
export type {
  AgePreset,
  EcomDetailType,
  EcomFillType,
  EcomLayoutType,
  EcomPlatformPreset,
  EthnicityPreset,
  GenderPreset,
  PatternStylePreset,
  PosePreset,
  PromptBlock,
  PromptBuilderConfig,
  ScenePreset
} from './types'

// 年龄预设
export { AGE_PRESETS, getAgePreset, getAgePresetKeys } from './age'

// 性别预设
export { GENDER_PRESETS, getGenderPreset, getGenderPresetKeys } from './gender'

// 场景预设
export { getScenePreset, getScenePresetKeys, SCENE_PRESETS } from './scene'

// 人种预设
export { ETHNICITY_PRESETS, getEthnicityPreset, getEthnicityPresetKeys } from './ethnicity'

// 姿势预设
export { getPosePreset, getPosePresetKeys, POSE_PRESETS } from './pose'

// Fashion 服装品类预设
export {
  FASHION_CATEGORY_PRESETS,
  type FashionCategoryPreset,
  getFashionCategoryOptions,
  getFashionCategoryPreset,
  getFashionCategoryPresetKeys
} from './fashionCategory'

// Fashion 趋势维度预设
export {
  buildDimensionAnalysisPrompt,
  getTrendDimensionOptions,
  getTrendDimensionPreset,
  getTrendDimensionPresetKeys,
  TREND_DIMENSION_PRESETS,
  type TrendDimensionPreset
} from './trendDimension'
