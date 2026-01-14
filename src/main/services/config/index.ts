/**
 * 统一配置模块
 *
 * 导出统一配置服务和相关类型
 */

export {
  getUnifiedConfigService,
  initializeConfigService,
  type AdvancedConfig,
  type AIConfig,
  type AppConfig,
  type ConfigChangeEvent,
  type ConfigSchema,
  type MemoryConfig,
  type UIConfig,
  type UnifiedConfigService,
  type VectorConfig
} from './UnifiedConfigService'

export {
  getUnifiedModelConfigService,
  initializeUnifiedModelConfigService,
  type EmbeddingModelConfig,
  type GlobalModelConfig,
  type ModelIdentifier,
  type ModelScene,
  type ProviderConfig,
  type RerankModelConfig,
  type UnifiedModelConfigService
} from './UnifiedModelConfigService'
