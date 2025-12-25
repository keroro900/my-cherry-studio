/**
 * 图片生成策略模块
 * Image Generation Strategies Module
 *
 * 统一导出所有策略相关的类型、接口和实例
 *
 * **Feature: executor-strategy-pattern, Phase 3.2**
 */

// ==================== 核心接口和基类 ====================

export type {
  ImageGenerationParams,
  // 核心接口
  ImageGenerationStrategy,
  OutputMapping,
  StrategyContext
} from './ImageGenerationStrategy'
export {
  // 基类
  BaseImageGenerationStrategy,
  // 策略注册表
  strategyRegistry
} from './ImageGenerationStrategy'

// ==================== 具体策略实现 ====================

export { EcomStrategy, ecomStrategy } from './EcomStrategy'
export { GeneralStrategy, generalStrategy } from './GeneralStrategy'
export { ModelStrategy, modelStrategy } from './ModelStrategy'
export { PatternStrategy, patternStrategy } from './PatternStrategy'

// ==================== 注册模块 ====================

export {
  getStrategyRegistrySummary,
  registerAllStrategies
} from './registerStrategies'
