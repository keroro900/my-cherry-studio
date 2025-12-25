interface CacheItem<T> {
  data: T
  timestamp: number
  duration: number
  lastAccess: number
}

// 默认最大缓存数量
const DEFAULT_MAX_SIZE = 500

export class CacheService {
  private static cache: Map<string, CacheItem<any>> = new Map()
  private static maxSize: number = DEFAULT_MAX_SIZE

  /**
   * 设置最大缓存数量
   * @param size 最大数量
   */
  static setMaxSize(size: number): void {
    this.maxSize = size
    this.evictIfNeeded()
  }

  /**
   * LRU 淘汰：当缓存超过最大数量时，删除最久未访问的项
   */
  private static evictIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return

    // 按 lastAccess 排序，删除最旧的
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess)

    const toRemove = this.cache.size - this.maxSize
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Set cache
   * @param key Cache key
   * @param data Cache data
   * @param duration Cache duration (in milliseconds)
   */
  static set<T>(key: string, data: T, duration: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      duration,
      lastAccess: now
    })

    // 检查是否需要淘汰
    this.evictIfNeeded()
  }

  /**
   * Get cache
   * @param key Cache key
   * @returns Returns data if cache exists and not expired, otherwise returns null
   */
  static get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const now = Date.now()
    if (now - item.timestamp > item.duration) {
      this.remove(key)
      return null
    }

    // 更新 lastAccess 时间，实现 LRU
    item.lastAccess = now

    return item.data
  }

  /**
   * Remove specific cache
   * @param key Cache key
   */
  static remove(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    this.cache.clear()
  }

  /**
   * Check if cache exists and is valid
   * @param key Cache key
   * @returns boolean
   */
  static has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    const now = Date.now()
    if (now - item.timestamp > item.duration) {
      this.remove(key)
      return false
    }

    // 更新 lastAccess 时间
    item.lastAccess = now

    return true
  }

  /**
   * 获取当前缓存数量
   */
  static size(): number {
    return this.cache.size
  }

  /**
   * 清理所有过期的缓存项
   */
  static cleanup(): void {
    const now = Date.now()
    const keysToRemove: string[] = []

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.duration) {
        keysToRemove.push(key)
      }
    })

    keysToRemove.forEach((key) => this.cache.delete(key))
  }
}
