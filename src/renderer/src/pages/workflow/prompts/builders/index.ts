/**
 * 构建器模块统一导出
 * Builders Module Unified Exports
 *
 * Layer 3: 构建器层
 * 每个构建器针对特定类型的图片生成任务
 */

// 基类
export { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

// 电商图构建器
export { type EcomConfig, type EcomDetailType, EcomPromptBuilder, type EcomPromptJson } from './EcomPromptBuilder'

// 模特图构建器
export { type ModelConfig, ModelPromptBuilder, type ModelPromptJson } from './ModelPromptBuilder'

// 图案构建器
export {
  getPatternStyleOptions,
  getPatternStylePreset,
  ORGANIC_LAYOUT_RULES,
  PATTERN_STYLE_PRESETS,
  type PatternAnalysis,
  type PatternConfig,
  PatternPromptBuilder,
  type PatternPromptJson,
  type PatternStylePreset,
  SEAMLESS_REQUIREMENTS,
  SMART_SCALING_RULES
} from './PatternPromptBuilder'

// 珠宝摄影构建器
export { type JewelryConfig, JewelryPromptBuilder, type JewelryPromptJson } from './JewelryPromptBuilder'

// 食品摄影构建器
export { type FoodConfig, FoodPromptBuilder, type FoodPromptJson } from './FoodPromptBuilder'

// 产品场景构建器
export {
  type ProductSceneConfig,
  ProductScenePromptBuilder,
  type ProductScenePromptJson
} from './ProductScenePromptBuilder'

// 首饰试戴构建器
export {
  type JewelryTryonConfig,
  JewelryTryonPromptBuilder,
  type JewelryTryonPromptJson
} from './JewelryTryonPromptBuilder'

// 眼镜试戴构建器
export {
  type EyewearTryonConfig,
  EyewearTryonPromptBuilder,
  type EyewearTryonPromptJson
} from './EyewearTryonPromptBuilder'

// 鞋类展示构建器
export {
  type FootwearDisplayConfig,
  FootwearDisplayPromptBuilder,
  type FootwearDisplayPromptJson
} from './FootwearDisplayPromptBuilder'

// 美妆产品构建器
export {
  type CosmeticsPhotoConfig,
  CosmeticsPhotoPromptBuilder,
  type CosmeticsPhotoPromptJson
} from './CosmeticsPhotoPromptBuilder'

// 家具场景构建器
export {
  type FurnitureSceneConfig,
  FurnitureScenePromptBuilder,
  type FurnitureScenePromptJson
} from './FurnitureScenePromptBuilder'

// 电子产品构建器
export {
  type ElectronicsPhotoConfig,
  ElectronicsPhotoPromptBuilder,
  type ElectronicsPhotoPromptJson
} from './ElectronicsPhotoPromptBuilder'

// 导出类型
export type { BuildResult, GarmentAnalysis, PromptModule } from './PromptBuilder'
