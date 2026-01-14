/**
 * UnifiedCacheFactory - 统一缓存工厂
 *
 * 解决缓存系统碎片化问题：
 * - 统一缓存接口
 * - 支持多种后端 (memory, file, indexeddb)
 * - LRU + TTL 策略
 * - 缓存统计
 *
 * 替代分散的缓存实现:
 * - CacheService (Main/Renderer)
 * - EmbeddingCache
 * - SpanCacheService
 * - PluginCacheStore
 * - 各处 new Map()
 */

import { loggerService } from '@logger'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('UnifiedCacheFactory')

// ==================== 类型定义 ====================

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  value: T
  createdAt: number
  expiresAt?: number
  accessCount: number
  lastAccessedAt: number
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  hitRate: number
  evictions: number
}

/**
 * 缓存配置
 */
export interface CacheOptions {
  /** 缓存后端类型 */
  backend: 'memory' | 'file'
  /** 最大条目数 */
  maxSize?: number
  /** 默认 TTL (毫秒) */
  defaultTTL?: number
  /** 缓存名称 (用于文件后端) */
  name?: string
  /** 缓存目录 (文件后端) */
  cacheDir?: string
  /** 是否启用 LRU 淘汰 */
  lru?: boolean
}

/**
 * 统一缓存适配器接口
 */
export interface CacheAdapter<T = unknown> {
  get(key: string): Promise<T | null>
  set(key: string, value: T, ttl?: number): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  keys(): Promise<string[]>
  size(): Promise<number>
  stats(): CacheStats
}

// ==================== 内存缓存实现 ====================

class MemoryCache<T = unknown> implements CacheAdapter<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private accessOrder: string[] = []
  private readonly maxSize: number
  private readonly defaultTTL: number
  private readonly lru: boolean

  private _stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 0,
    hitRate: 0,
    evictions: 0
  }

  constructor(options: CacheOptions) {
    this.maxSize = options.maxSize ?? 1000
    this.defaultTTL = options.defaultTTL ?? 3600000 // 1 hour
    this.lru = options.lru ?? true
    this._stats.maxSize = this.maxSize
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      this._stats.misses++
      this.updateHitRate()
      return null
    }

    // 检查过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this._stats.misses++
      this._stats.size = this.cache.size
      this.updateHitRate()
      return null
    }

    // 更新访问信息
    entry.accessCount++
    entry.lastAccessedAt = Date.now()
    this._stats.hits++
    this.updateHitRate()

    // LRU: 移到末尾
    if (this.lru) {
      this.moveToEnd(key)
    }

    return entry.value
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : this.defaultTTL ? Date.now() + this.defaultTTL : undefined,
      accessCount: 0,
      lastAccessedAt: Date.now()
    }

    this.cache.set(key, entry)
    this._stats.size = this.cache.size

    if (this.lru) {
      this.moveToEnd(key)
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this._stats.size = this.cache.size
      return false
    }
    return true
  }

  async delete(key: string): Promise<boolean> {
    const result = this.cache.delete(key)
    this._stats.size = this.cache.size
    if (this.lru) {
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
    }
    return result
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []
    this._stats.size = 0
    this._stats.hits = 0
    this._stats.misses = 0
    this._stats.evictions = 0
    this._stats.hitRate = 0
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys())
  }

  async size(): Promise<number> {
    return this.cache.size
  }

  stats(): CacheStats {
    return { ...this._stats }
  }

  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
  }

  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
        this._stats.evictions++
        this._stats.size = this.cache.size
      }
    }
  }

  private updateHitRate(): void {
    const total = this._stats.hits + this._stats.misses
    this._stats.hitRate = total > 0 ? this._stats.hits / total : 0
  }
}

// ==================== 文件缓存实现 ====================

class FileCache<T = unknown> implements CacheAdapter<T> {
  private readonly cacheDir: string
  private readonly maxSize: number
  private readonly defaultTTL: number
  private indexCache: Map<string, { expiresAt?: number; createdAt: number }> = new Map()

  private _stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 0,
    hitRate: 0,
    evictions: 0
  }

  constructor(options: CacheOptions) {
    this.cacheDir = options.cacheDir ?? path.join(process.cwd(), '.cache', options.name ?? 'default')
    this.maxSize = options.maxSize ?? 10000
    this.defaultTTL = options.defaultTTL ?? 86400000 // 24 hours
    this._stats.maxSize = this.maxSize

    // 确保目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }

    // 加载索引
    this.loadIndex()
  }

  async get(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key)
    const indexEntry = this.indexCache.get(key)

    if (!indexEntry) {
      this._stats.misses++
      this.updateHitRate()
      return null
    }

    // 检查过期
    if (indexEntry.expiresAt && Date.now() > indexEntry.expiresAt) {
      await this.delete(key)
      this._stats.misses++
      this.updateHitRate()
      return null
    }

    try {
      if (!fs.existsSync(filePath)) {
        this.indexCache.delete(key)
        this._stats.misses++
        this.updateHitRate()
        return null
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      this._stats.hits++
      this.updateHitRate()
      return JSON.parse(content) as T
    } catch {
      this._stats.misses++
      this.updateHitRate()
      return null
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // 检查容量
    if (this.indexCache.size >= this.maxSize && !this.indexCache.has(key)) {
      await this.evictOldest()
    }

    const filePath = this.getFilePath(key)
    const expiresAt = ttl ? Date.now() + ttl : this.defaultTTL ? Date.now() + this.defaultTTL : undefined

    fs.writeFileSync(filePath, JSON.stringify(value), 'utf-8')

    this.indexCache.set(key, {
      createdAt: Date.now(),
      expiresAt
    })

    this._stats.size = this.indexCache.size
    this.saveIndex()
  }

  async has(key: string): Promise<boolean> {
    const entry = this.indexCache.get(key)
    if (!entry) return false
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key)
      return false
    }
    return fs.existsSync(this.getFilePath(key))
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key)
    this.indexCache.delete(key)
    this._stats.size = this.indexCache.size
    this.saveIndex()

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    // 删除所有缓存文件
    for (const key of this.indexCache.keys()) {
      const filePath = this.getFilePath(key)
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch {
        // 忽略删除错误
      }
    }

    this.indexCache.clear()
    this._stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: this.maxSize,
      hitRate: 0,
      evictions: 0
    }
    this.saveIndex()
  }

  async keys(): Promise<string[]> {
    return Array.from(this.indexCache.keys())
  }

  async size(): Promise<number> {
    return this.indexCache.size
  }

  stats(): CacheStats {
    return { ...this._stats }
  }

  private getFilePath(key: string): string {
    // 使用 hash 避免文件名问题
    const hash = this.hashKey(key)
    return path.join(this.cacheDir, `${hash}.json`)
  }

  private hashKey(key: string): string {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  private loadIndex(): void {
    const indexPath = path.join(this.cacheDir, '_index.json')
    try {
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8')
        const data = JSON.parse(content) as Array<[string, { expiresAt?: number; createdAt: number }]>
        this.indexCache = new Map(data)
        this._stats.size = this.indexCache.size
      }
    } catch {
      logger.warn('Failed to load cache index')
    }
  }

  private saveIndex(): void {
    const indexPath = path.join(this.cacheDir, '_index.json')
    try {
      const data = Array.from(this.indexCache.entries())
      fs.writeFileSync(indexPath, JSON.stringify(data), 'utf-8')
    } catch {
      logger.warn('Failed to save cache index')
    }
  }

  private async evictOldest(): Promise<void> {
    // 找到最旧的条目
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.indexCache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      await this.delete(oldestKey)
      this._stats.evictions++
    }
  }

  private updateHitRate(): void {
    const total = this._stats.hits + this._stats.misses
    this._stats.hitRate = total > 0 ? this._stats.hits / total : 0
  }
}

// ==================== 工厂实现 ====================

/**
 * 统一缓存工厂
 */
export class UnifiedCacheFactory {
  private static instances: Map<string, CacheAdapter> = new Map()

  /**
   * 创建缓存实例
   */
  static create<T = unknown>(options: CacheOptions): CacheAdapter<T> {
    const key = `${options.backend}:${options.name ?? 'default'}`

    if (this.instances.has(key)) {
      return this.instances.get(key) as CacheAdapter<T>
    }

    let cache: CacheAdapter<T>

    switch (options.backend) {
      case 'memory':
        cache = new MemoryCache<T>(options)
        break
      case 'file':
        cache = new FileCache<T>(options)
        break
      default:
        throw new Error(`Unknown cache backend: ${options.backend}`)
    }

    this.instances.set(key, cache as CacheAdapter)
    logger.info('Cache created', { backend: options.backend, name: options.name })

    return cache
  }

  /**
   * 获取或创建缓存
   */
  static getOrCreate<T = unknown>(name: string, options?: Partial<CacheOptions>): CacheAdapter<T> {
    const key = `${options?.backend ?? 'memory'}:${name}`

    if (this.instances.has(key)) {
      return this.instances.get(key) as CacheAdapter<T>
    }

    return this.create<T>({
      backend: options?.backend ?? 'memory',
      name,
      ...options
    })
  }

  /**
   * 获取所有缓存统计
   */
  static getAllStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {}
    for (const [key, cache] of this.instances) {
      result[key] = cache.stats()
    }
    return result
  }

  /**
   * 清除所有缓存
   */
  static async clearAll(): Promise<void> {
    for (const cache of this.instances.values()) {
      await cache.clear()
    }
    logger.info('All caches cleared')
  }

  /**
   * 销毁缓存实例
   */
  static destroy(name: string, backend: 'memory' | 'file' = 'memory'): void {
    const key = `${backend}:${name}`
    this.instances.delete(key)
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建内存缓存
 */
export function createMemoryCache<T = unknown>(
  name: string,
  options?: Omit<CacheOptions, 'backend' | 'name'>
): CacheAdapter<T> {
  return UnifiedCacheFactory.create<T>({
    backend: 'memory',
    name,
    ...options
  })
}

/**
 * 创建文件缓存
 */
export function createFileCache<T = unknown>(
  name: string,
  options?: Omit<CacheOptions, 'backend' | 'name'>
): CacheAdapter<T> {
  return UnifiedCacheFactory.create<T>({
    backend: 'file',
    name,
    ...options
  })
}

export default UnifiedCacheFactory
