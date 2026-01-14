/**
 * 统一缓存模块
 *
 * 导出统一缓存工厂和相关类型
 */

export {
  createFileCache,
  createMemoryCache,
  UnifiedCacheFactory,
  type CacheAdapter,
  type CacheOptions,
  type CacheStats
} from './UnifiedCacheFactory'
