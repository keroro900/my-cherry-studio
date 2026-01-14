/**
 * LRU + TTL 嵌入缓存
 *
 * 特点:
 * - LRU 淘汰策略 (最近最少使用)
 * - TTL 过期机制
 * - 命中率统计
 *
 * 架构说明:
 * 此类是 @main/services/cache/UnifiedCacheFactory 的同步特化版本。
 * UnifiedCacheFactory 提供异步接口，适用于通用缓存场景。
 * EmbeddingCache 提供同步接口，专门用于嵌入向量的高频访问。
 *
 * 两者共享相同的设计模式 (LRU + TTL)，保持代码一致性。
 */

interface CacheEntry {
  embedding: number[]
  createdAt: number
}

interface CacheConfig {
  maxSize: number
  ttlMs: number
}

interface CacheStats {
  size: number
  hitRate: number
  hits: number
  misses: number
  evictions: number
}

/**
 * 嵌入向量缓存 (同步版本)
 *
 * 使用 Map 的插入顺序特性实现 LRU:
 * - get 时将条目移到末尾
 * - 容量满时删除最旧条目 (Map 开头)
 *
 * 与 UnifiedCacheFactory.MemoryCache 算法一致，
 * 但提供同步接口以避免嵌入操作中的 async/await 开销。
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map()
  private accessOrder: string[] = []
  private config: CacheConfig
  private hits: number = 0
  private misses: number = 0
  private evictions: number = 0

  constructor(config: CacheConfig) {
    this.config = config
  }

  /**
   * 获取缓存条目
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // TTL 检查
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      this.misses++
      return null
    }

    // LRU: 移动到末尾
    this.moveToEnd(key)

    this.hits++
    return entry
  }

  /**
   * 设置缓存条目
   */
  set(key: string, entry: CacheEntry): void {
    // 如果 key 已存在，先删除 (确保插入到末尾)
    if (this.cache.has(key)) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    }

    // LRU 淘汰: 容量满时删除最旧条目
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, entry)
    this.accessOrder.push(key)
  }

  /**
   * 检查 key 是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // TTL 检查
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return false
    }

    return true
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key)
    if (existed) {
      this.removeFromAccessOrder(key)
    }
    return existed
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions
    }
  }

  /**
   * 清理过期条目
   */
  prune(): number {
    const now = Date.now()
    let pruned = 0

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        pruned++
      }
    }

    return pruned
  }

  /**
   * 获取当前大小
   */
  get size(): number {
    return this.cache.size
  }

  // ==================== LRU 辅助方法 ====================

  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
        this.evictions++
      }
    }
  }
}
