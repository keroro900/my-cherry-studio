/**
 * 策略注册模块
 * Strategy Registration Module
 *
 * 负责初始化和注册所有图片生成策略到全局注册表
 *
 * **Feature: executor-strategy-pattern, Phase 3.2e**
 */

import { loggerService } from '@logger'

import { ecomStrategy } from './EcomStrategy'
import { generalStrategy } from './GeneralStrategy'
import { strategyRegistry } from './ImageGenerationStrategy'
import { modelStrategy } from './ModelStrategy'
import { patternStrategy } from './PatternStrategy'

const logger = loggerService.withContext('StrategyRegistry')

/**
 * 注册所有图片生成策略
 *
 * 策略注册顺序：
 * 1. ModelStrategy - 模特图（gemini_generate_model, gemini_model_from_clothes）
 * 2. EcomStrategy - 电商图（gemini_ecom）
 * 3. PatternStrategy - 图案（gemini_pattern）
 * 4. GeneralStrategy - 通用图片（gemini_generate）作为默认回退
 *
 * 注意：策略按照节点类型映射，同一个节点类型只能有一个策略
 */
export function registerAllStrategies(): void {
  // 防止重复注册
  if (strategyRegistry.isInitialized()) {
    return
  }

  // 注册专用策略（按优先级排序）
  strategyRegistry.register(modelStrategy)
  strategyRegistry.register(ecomStrategy)
  strategyRegistry.register(patternStrategy)

  // 注册通用策略（作为 gemini_generate 的处理器）
  strategyRegistry.register(generalStrategy)

  // 标记已初始化
  strategyRegistry.markInitialized()

  // 调试日志
  if (process.env.NODE_ENV === 'development') {
    const supportedTypes = strategyRegistry.getSupportedNodeTypes()
    logger.debug('已注册的节点类型:', supportedTypes)
  }
}

/**
 * 获取策略注册表状态摘要
 */
export function getStrategyRegistrySummary(): {
  initialized: boolean
  supportedNodeTypes: string[]
  strategyCount: number
} {
  return {
    initialized: strategyRegistry.isInitialized(),
    supportedNodeTypes: strategyRegistry.getSupportedNodeTypes(),
    strategyCount: new Set(strategyRegistry.getSupportedNodeTypes().map((type) => strategyRegistry.get(type)?.name))
      .size
  }
}

// ==================== 导出 ====================

export {
  ecomStrategy,
  // 具体策略
  generalStrategy,
  modelStrategy,
  patternStrategy,
  // 策略注册表
  strategyRegistry
}

// 重导出类型和接口
export type {
  ImageGenerationParams,
  ImageGenerationStrategy,
  OutputMapping,
  StrategyContext
} from './ImageGenerationStrategy'
export { BaseImageGenerationStrategy } from './ImageGenerationStrategy'
