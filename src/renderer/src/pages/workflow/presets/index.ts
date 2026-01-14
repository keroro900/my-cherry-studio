/**
 * 预设注册表入口
 * Preset Registry Entry
 *
 * 统一导出所有预设类别和工具函数
 *
 * @module presets
 */

// ==================== 类型导出 ====================
export type {
  // 模特类型
  AgeGroupId,
  // 扩展预设定义接口
  AgePresetDefinition,
  // 复杂预设定义接口（支持 tags/category/preview）
  CommercialScenePresetDefinition,
  // 复杂预设分类类型
  ComplexPresetCategory,
  EthnicityId,
  EthnicityPresetDefinition,
  ExtendedEthnicityPresetDefinition,
  // 电商类型
  FillModeId,
  GenderId,
  GenderPresetDefinition,
  LayoutModeId,
  // 光影类型
  LightingModeId,
  ModelTypePresetDefinition,
  // 图案类型
  PatternStyleId,
  PatternStylePresetDefinition,
  PatternTypeId,
  PoseId,
  PosePresetDefinition,
  // 基础类型
  PresetCategory,
  PresetDefinition,
  ResolvedFillModeId,
  ResolvedLayoutModeId,
  SceneId,
  ScenePresetDefinition,
  StyleModeId,
  StyleModePresetDefinition
} from './types'

// 工厂函数
export { createPresetCategory } from './types'

// ==================== 电商预设 ====================
export {
  FILL_MODE_PRESETS,
  getFillModeSystemPromptBlock,
  getFillModeUserPromptBlock,
  getGhostMannequinSection,
  // 提示词片段获取函数
  getLayoutSystemPromptBlock,
  getLayoutUserPromptBlock,
  // 光影模式
  getLightingSystemPromptBlock,
  getLightingUserPromptBlock,
  // 预设类别
  LAYOUT_PRESETS,
  LIGHTING_PRESETS,
  type PlatformStyleId,
  resolveFillMode,
  resolveLayoutMode,
  // 解析函数
  resolveLightingMode,
  resolvePlatformStyle
} from './ecom'

// ==================== 模特预设 ====================
export {
  // 预设类别
  AGE_PRESETS,
  ETHNICITY_PRESETS,
  GENDER_PRESETS,
  // 兼容旧接口的辅助函数
  getAgePreset,
  getEthnicityPreset,
  getGenderPreset,
  getPosePreset,
  getScenePreset,
  getStyleModePreset,
  POSE_PRESETS,
  // 解析函数
  resolveAgeGroup,
  resolveEthnicity,
  resolveGender,
  resolvePose,
  resolveScene,
  resolveStyleMode,
  SCENE_PRESETS,
  STYLE_MODE_PRESETS
} from './model'

// ==================== 图案预设 ====================
export {
  // 复杂图案风格预设（支持 tags/category/preview）
  COMPLEX_PATTERN_STYLE_PRESETS,
  getPatternStyleSystemPromptBlock,
  getPatternStyleUserPromptBlock,
  // 提示词片段获取函数
  getPatternTypeSystemPromptBlock,
  getPatternTypeUserPromptBlock,
  PATTERN_STYLE_PRESETS,
  // 预设类别
  PATTERN_TYPE_PRESETS,
  resolvePatternStyle,
  // 解析函数
  resolvePatternType
} from './pattern'

// ==================== 电商风格预设 ====================
export {
  ECOM_STYLE_PRESETS,
  type EcomStyleId,
  type EcomStylePresetDefinition,
  getEcomStylePreset
} from './ecomStyle'

// ==================== 商拍预设（场景/模特/人种）====================
export {
  // 商拍场景预设
  COMMERCIAL_SCENE_PRESETS,
  // 扩展人种预设（带提示词）
  EXTENDED_ETHNICITY_PRESETS,
  // 模特类型预设
  MODEL_TYPE_PRESETS
} from './commercial'
