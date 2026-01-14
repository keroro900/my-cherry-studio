/**
 * UnifiedCache - 统一缓存系统
 *
 * 为 VCP 变量系统提供统一的缓存管理，支持：
 * - TTL（过期时间）控制
 * - 按前缀失效
 * - 文件监听自动失效（可选）
 * - 缓存统计
 *
 * 应用场景：
 * - PlaceholderEngine 变量值缓存
 * - TVStxt 文件内容缓存
 * - 插件变量缓存
 *
 * @example
 * ```typescript
 * const cache = new UnifiedCache<string>({ defaultTTL: 60000 })
 *
 * // 设置缓存
 * cache.set('VarA', 'value A')
 * cache.set('VarB', 'value B', 30000) // 自定义 TTL
 *
 * // 获取缓存
 * const value = cache.get('VarA')
 *
 * // 失效缓存
 * cache.invalidate('VarA')
 * cache.invalidateByPrefix('Var') // 失效所有 Var 开头的缓存
 * ```
 */

import { loggerService } from '@main/services/LoggerService'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('UnifiedCache')

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  /** 缓存值 */
  value: T
  /** 过期时间戳 */
  expiresAt: number
  /** 创建时间戳 */
  createdAt: number
  /** 最后访问时间戳 */
  lastAccessedAt: number
  /** 访问次数 */
  hitCount: number
}

/**
 * 缓存配置
 */
export interface UnifiedCacheOptions {
  /** 默认 TTL（毫秒），默认 60000 (1分钟) */
  defaultTTL?: number
  /** 最大缓存条目数，默认 1000 */
  maxSize?: number
  /** 是否启用文件监听，默认 false */
  enableFileWatch?: boolean
  /** 清理间隔（毫秒），默认 60000 (1分钟) */
  cleanupInterval?: number
  /** 缓存名称（用于日志） */
  name?: string
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 当前缓存条目数 */
  size: number
  /** 命中次数 */
  hits: number
  /** 未命中次数 */
  misses: number
  /** 命中率 */
  hitRate: number
  /** 过期清理次数 */
  evictions: number
  /** 最老条目的创建时间 */
  oldestEntryTime?: number
}

/**
 * 统一缓存类
 */
export class UnifiedCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private fileWatchers: Map<string, fs.FSWatcher> = new Map()
  private cleanupTimer: NodeJS.Timeout | null = null

  private readonly defaultTTL: number
  private readonly maxSize: number
  private readonly enableFileWatch: boolean
  private readonly name: string

  // 统计信息
  private hits: number = 0
  private misses: number = 0
  private evictions: number = 0

  /**
   * 创建统一缓存实例
   * @param options 缓存配置
   */
  constructor(options: UnifiedCacheOptions = {}) {
    this.defaultTTL = options.defaultTTL ?? 60000
    this.maxSize = options.maxSize ?? 1000
    this.enableFileWatch = options.enableFileWatch ?? false
    this.name = options.name ?? 'UnifiedCache'

    // 启动定期清理
    const cleanupInterval = options.cleanupInterval ?? 60000
    this.startCleanup(cleanupInterval)

    logger.debug(`${this.name} initialized`, {
      defaultTTL: this.defaultTTL,
      maxSize: this.maxSize,
      enableFileWatch: this.enableFileWatch
    })
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 自定义 TTL（毫秒），不传则使用默认值
   */
  set(key: string, value: T, ttl?: number): void {
    // 检查是否需要清理空间
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    const now = Date.now()
    const effectiveTTL = ttl ?? this.defaultTTL

    this.cache.set(key, {
      value,
      expiresAt: now + effectiveTTL,
      createdAt: now,
      lastAccessedAt: now,
      hitCount: 0
    })
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值，如果不存在或已过期则返回 undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return undefined
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      this.evictions++
      return undefined
    }

    // 更新访问统计
    entry.lastAccessedAt = Date.now()
    entry.hitCount++
    this.hits++

    return entry.value
  }

  /**
   * 检查缓存是否存在且有效
   * @param key 缓存键
   * @returns 是否存在有效缓存
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * 失效单个缓存
   * @param key 缓存键
   * @returns 是否成功删除
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key)

    // 同时停止文件监听
    const watcher = this.fileWatchers.get(key)
    if (watcher) {
      watcher.close()
      this.fileWatchers.delete(key)
    }

    return deleted
  }

  /**
   * 按前缀失效缓存
   * @param prefix 键前缀
   * @returns 失效的缓存数量
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.invalidate(key)
        count++
      }
    }
    if (count > 0) {
      logger.debug(`${this.name}: Invalidated ${count} entries by prefix "${prefix}"`)
    }
    return count
  }

  /**
   * 按模式失效缓存
   * @param pattern 正则表达式模式
   * @returns 失效的缓存数量
   */
  invalidateByPattern(pattern: RegExp): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.invalidate(key)
        count++
      }
    }
    if (count > 0) {
      logger.debug(`${this.name}: Invalidated ${count} entries by pattern`)
    }
    return count
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    // 停止所有文件监听
    for (const watcher of this.fileWatchers.values()) {
      watcher.close()
    }
    this.fileWatchers.clear()

    const size = this.cache.size
    this.cache.clear()

    // 重置统计
    this.hits = 0
    this.misses = 0
    this.evictions = 0

    logger.info(`${this.name}: Cleared ${size} entries`)
  }

  /**
   * 刷新缓存 TTL
   * @param key 缓存键
   * @param ttl 新的 TTL（毫秒），不传则使用默认值
   * @returns 是否成功刷新
   */
  refresh(key: string, ttl?: number): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    entry.expiresAt = Date.now() + (ttl ?? this.defaultTTL)
    return true
  }

  /**
   * 获取或设置缓存（带异步获取器）
   * @param key 缓存键
   * @param getter 异步获取器函数
   * @param ttl 自定义 TTL（毫秒）
   * @returns 缓存值或新获取的值
   */
  async getOrSet(key: string, getter: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await getter()
    this.set(key, value, ttl)
    return value
  }

  /**
   * 监听文件变化，自动失效关联缓存
   * @param filePath 文件路径
   * @param key 关联的缓存键
   */
  watchFile(filePath: string, key: string): void {
    if (!this.enableFileWatch) {
      logger.debug(`${this.name}: File watching disabled, skipping watch for ${filePath}`)
      return
    }

    // 如果已经在监听，先停止
    const existingWatcher = this.fileWatchers.get(key)
    if (existingWatcher) {
      existingWatcher.close()
    }

    try {
      const absolutePath = path.resolve(filePath)
      const watcher = fs.watch(absolutePath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          logger.debug(`${this.name}: File changed, invalidating cache`, { key, filePath })
          this.invalidate(key)
        }
      })

      watcher.on('error', (error) => {
        logger.warn(`${this.name}: File watcher error`, { key, filePath, error: String(error) })
        this.fileWatchers.delete(key)
      })

      this.fileWatchers.set(key, watcher)
      logger.debug(`${this.name}: Watching file for cache invalidation`, { key, filePath })
    } catch (error) {
      logger.warn(`${this.name}: Failed to watch file`, { key, filePath, error: String(error) })
    }
  }

  /**
   * 停止监听文件
   * @param key 关联的缓存键
   */
  unwatchFile(key: string): void {
    const watcher = this.fileWatchers.get(key)
    if (watcher) {
      watcher.close()
      this.fileWatchers.delete(key)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses
    let oldestTime: number | undefined

    for (const entry of this.cache.values()) {
      if (!oldestTime || entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
      }
    }

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      evictions: this.evictions,
      oldestEntryTime: oldestTime
    }
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 停止所有文件监听
    for (const watcher of this.fileWatchers.values()) {
      watcher.close()
    }
    this.fileWatchers.clear()

    // 清空缓存
    this.cache.clear()

    logger.info(`${this.name}: Destroyed`)
  }

  /**
   * 启动定期清理过期条目
   */
  private startCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, interval)

    // 允许进程退出
    this.cleanupTimer.unref()
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): number {
    const now = Date.now()
    let count = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        this.evictions++
        count++
      }
    }

    if (count > 0) {
      logger.debug(`${this.name}: Cleaned up ${count} expired entries`)
    }

    return count
  }

  /**
   * 驱逐最老的条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.invalidate(oldestKey)
      this.evictions++
      logger.debug(`${this.name}: Evicted oldest entry`, { key: oldestKey })
    }
  }
}

/**
 * 创建变量缓存实例
 * @param ttl 默认 TTL（毫秒），默认 5 分钟
 */
export function createVariableCache(ttl: number = 300000): UnifiedCache<string> {
  return new UnifiedCache<string>({
    defaultTTL: ttl,
    maxSize: 500,
    name: 'VariableCache'
  })
}

/**
 * 创建 TVStxt 文件缓存实例
 * @param ttl 默认 TTL（毫秒），默认 1 分钟
 */
export function createTvsTxtCache(ttl: number = 60000): UnifiedCache<string> {
  return new UnifiedCache<string>({
    defaultTTL: ttl,
    maxSize: 100,
    enableFileWatch: true,
    name: 'TvsTxtCache'
  })
}

/**
 * 创建插件变量缓存实例
 * @param ttl 默认 TTL（毫秒），默认 1 分钟
 */
export function createPluginVariableCache(ttl: number = 60000): UnifiedCache<string> {
  return new UnifiedCache<string>({
    defaultTTL: ttl,
    maxSize: 200,
    name: 'PluginVariableCache'
  })
}

export default UnifiedCache
