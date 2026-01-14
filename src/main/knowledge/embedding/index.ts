/**
 * 统一嵌入服务模块
 *
 * 提供:
 * - UnifiedEmbeddingService: 单例嵌入服务
 * - EmbeddingCache: LRU + TTL 缓存
 * - 便捷函数: embedText, embedTexts
 *
 * 用法:
 * ```typescript
 * import { getEmbeddingService, embedText } from '@main/knowledge/embedding'
 *
 * // 方式1: 使用服务实例
 * const service = getEmbeddingService()
 * service.setDefaultConfig({ apiClient, targetDimension: 1536 })
 * const result = await service.embedText('Hello')
 *
 * // 方式2: 使用便捷函数
 * const embedding = await embedText('Hello', { apiClient })
 * ```
 */

export { EmbeddingCache } from './EmbeddingCache'
export type { EmbeddingConfig, EmbeddingResult } from './UnifiedEmbeddingService'
export {
  embedText,
  embedTexts,
  getEmbeddingService,
  UnifiedEmbeddingService
} from './UnifiedEmbeddingService'
