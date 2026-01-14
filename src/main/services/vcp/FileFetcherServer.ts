/**
 * FileFetcherServer - 分布式文件获取服务
 *
 * 完整移植自 VCPToolBox/FileFetcherServer.js
 *
 * 核心功能：
 * 1. 处理 file:// 协议的文件获取
 * 2. 本地缓存管理 (SHA256 哈希键)
 * 3. 分布式 WebSocket 请求回退
 * 4. 快速循环检测防止无限循环
 * 5. 失败请求缓存
 *
 * @author Cherry Studio Team
 * @see external/VCPToolBox/FileFetcherServer.js
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('FileFetcherServer')

// ==================== 类型定义 ====================

/**
 * 文件获取结果
 */
export interface FetchResult {
  /** 文件数据 */
  buffer: Buffer
  /** MIME 类型 */
  mimeType: string
  /** 是否来自缓存 */
  fromCache: boolean
  /** 来源 (local/remote/cache) */
  source: 'local' | 'remote' | 'cache'
}

/**
 * 失败缓存项
 */
interface FailedCacheEntry {
  timestamp: number
  error: string
}

/**
 * WebSocket 服务器接口 (用于分布式请求)
 */
export interface WebSocketServerInterface {
  findServerByIp(ip: string): string | null
  executeDistributedTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown>,
    timeout: number
  ): Promise<{
    status: string
    fileData?: string
    mimeType?: string
    error?: string
  }>
}

/**
 * FileFetcherServer 配置
 */
interface FileFetcherConfig {
  /** 缓存目录 */
  cacheDir: string
  /** 缓存过期时间 (毫秒) */
  cacheExpirationMs: number
  /** 快速循环检测间隔 (毫秒) */
  reqCacheExpirationMs: number
  /** 分布式请求超时 (毫秒) */
  distributedTimeout: number
}

// ==================== MIME 类型映射 ====================

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',

  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',

  // Data
  '.bin': 'application/octet-stream',
  '.exe': 'application/octet-stream',
  '.dll': 'application/octet-stream'
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: FileFetcherConfig = {
  cacheDir: path.join(app.getPath('userData'), '.file_cache'),
  cacheExpirationMs: 30000, // 30秒内防止重复失败请求
  reqCacheExpirationMs: 5000, // 5秒内重复请求视为潜在循环
  distributedTimeout: 60000 // 60秒超时
}

// ==================== 服务实现 ====================

/**
 * 分布式文件获取服务
 */
export class FileFetcherServer {
  private static instance: FileFetcherServer

  /** 失败请求缓存 */
  private failedFetchCache: Map<string, FailedCacheEntry> = new Map()

  /** 快速循环检测缓存 */
  private recentRequests: Map<string, number> = new Map()

  /** WebSocket 服务器引用 */
  private webSocketServer: WebSocketServerInterface | null = null

  /** 配置 */
  private config: FileFetcherConfig

  /** 是否已初始化 */
  private initialized: boolean = false

  private constructor(config: Partial<FileFetcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ensureCacheDir()
  }

  static getInstance(config?: Partial<FileFetcherConfig>): FileFetcherServer {
    if (!FileFetcherServer.instance) {
      FileFetcherServer.instance = new FileFetcherServer(config)
    }
    return FileFetcherServer.instance
  }

  // ==================== 初始化 ====================

  private ensureCacheDir(): void {
    try {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true })
        logger.info('Cache directory created', { path: this.config.cacheDir })
      }
    } catch (error) {
      logger.error('Failed to create cache directory', error as Error)
    }
  }

  /**
   * 初始化服务并注入 WebSocket 服务器依赖
   */
  initialize(wss: WebSocketServerInterface): void {
    if (!wss || typeof wss.findServerByIp !== 'function' || typeof wss.executeDistributedTool !== 'function') {
      throw new Error('FileFetcherServer initialization failed: Invalid WebSocketServer instance')
    }

    this.webSocketServer = wss
    this.initialized = true
    logger.info('FileFetcherServer initialized and linked with WebSocketServer')
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  // ==================== 核心文件获取 ====================

  /**
   * 获取文件
   *
   * @param fileUrl 文件 URL (file://...)
   * @param requestIp 发起请求的客户端 IP
   */
  async fetchFile(fileUrl: string, requestIp?: string): Promise<FetchResult> {
    // 快速循环检测
    this.checkForLoopDetection(fileUrl)

    // 协议检查
    if (!fileUrl.startsWith('file://')) {
      throw new Error('FileFetcher only supports file:// protocol')
    }

    // 计算缓存键
    const cacheKey = crypto.createHash('sha256').update(fileUrl).digest('hex')
    let originalExtension = ''

    try {
      const url = new URL(fileUrl)
      originalExtension = path.extname(url.pathname)
    } catch (e) {
      logger.warn('Could not parse pathname from URL to get extension', { fileUrl })
    }

    const cachedFilePath = path.join(this.config.cacheDir, cacheKey + originalExtension)

    // 1. 尝试从本地缓存读取
    try {
      const buffer = fs.readFileSync(cachedFilePath)
      const mimeType = getMimeType(cachedFilePath)
      logger.debug('File read from local cache', { cachedFilePath, originalUrl: fileUrl })

      return {
        buffer,
        mimeType,
        fromCache: true,
        source: 'cache'
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw new Error(`Unexpected error reading cached file: ${e.message}`)
      }
      logger.debug('Cache miss for URL', { fileUrl })
    }

    // 2. 尝试直接读取本地文件
    try {
      const localPath = this.fileUrlToPath(fileUrl)
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath)
        const mimeType = getMimeType(localPath)

        // 写入缓存
        this.writeToCache(cachedFilePath, buffer)

        logger.debug('File read from local path', { localPath })

        return {
          buffer,
          mimeType,
          fromCache: false,
          source: 'local'
        }
      }
    } catch (e) {
      logger.debug('Local file not accessible, will try remote', { fileUrl })
    }

    // 3. 从分布式服务器获取
    return this.fetchFromRemote(fileUrl, requestIp, cachedFilePath, originalExtension)
  }

  /**
   * 将 file:// URL 转换为本地路径
   */
  private fileUrlToPath(fileUrl: string): string {
    try {
      const url = new URL(fileUrl)
      let filePath = decodeURIComponent(url.pathname)

      // Windows 路径处理
      if (process.platform === 'win32') {
        // 移除开头的 /
        if (filePath.startsWith('/')) {
          filePath = filePath.slice(1)
        }
        // 替换正斜杠为反斜杠
        filePath = filePath.replace(/\//g, '\\')
      }

      return filePath
    } catch (e) {
      throw new Error(`Invalid file URL: ${fileUrl}`)
    }
  }

  /**
   * 快速循环检测
   */
  private checkForLoopDetection(fileUrl: string): void {
    const now = Date.now()

    if (this.recentRequests.has(fileUrl)) {
      const lastRequestTime = this.recentRequests.get(fileUrl)!
      if (now - lastRequestTime < this.config.reqCacheExpirationMs) {
        this.recentRequests.set(fileUrl, now)
        throw new Error(
          `Duplicate request for '${fileUrl}' detected within ${this.config.reqCacheExpirationMs}ms. ` +
            'Operation aborted to prevent infinite loop.'
        )
      }
    }

    this.recentRequests.set(fileUrl, now)

    // 清理过期的请求记录
    setTimeout(() => {
      if (this.recentRequests.get(fileUrl) === now) {
        this.recentRequests.delete(fileUrl)
      }
    }, this.config.reqCacheExpirationMs * 2)
  }

  /**
   * 从分布式服务器获取文件
   */
  private async fetchFromRemote(
    fileUrl: string,
    requestIp: string | undefined,
    cachedFilePath: string,
    originalExtension: string
  ): Promise<FetchResult> {
    // 检查失败缓存
    const cachedFailure = this.failedFetchCache.get(fileUrl)
    if (cachedFailure && Date.now() - cachedFailure.timestamp < this.config.cacheExpirationMs) {
      throw new Error(`File fetch failed recently, aborting to prevent loop. Error: ${cachedFailure.error}`)
    }
    this.failedFetchCache.delete(fileUrl)

    // 验证条件
    if (!requestIp) {
      throw new Error('Cannot determine request source: missing requestIp')
    }

    if (!this.webSocketServer) {
      throw new Error('FileFetcherServer not initialized')
    }

    // 查找目标服务器
    const serverId = this.webSocketServer.findServerByIp(requestIp)
    if (!serverId) {
      throw new Error(`No known distributed server found for IP [${requestIp}]`)
    }

    logger.info('Determined file source server', { serverId, ip: requestIp })

    try {
      // 执行分布式工具调用
      const result = await this.webSocketServer.executeDistributedTool(
        serverId,
        'internal_request_file',
        { fileUrl },
        this.config.distributedTimeout
      )

      if (result && result.status === 'success' && result.fileData) {
        logger.info('Successfully fetched file from server', { serverId, fileUrl })

        const buffer = Buffer.from(result.fileData, 'base64')

        // 写入本地缓存
        this.writeToCache(cachedFilePath, buffer)

        const mimeType = result.mimeType || getMimeType(originalExtension) || 'application/octet-stream'

        return {
          buffer,
          mimeType,
          fromCache: false,
          source: 'remote'
        }
      } else {
        const errorMsg = result?.error || 'Unknown error'
        throw new Error(`Failed to fetch file from server ${serverId}: ${errorMsg}`)
      }
    } catch (error: any) {
      // 缓存失败
      this.failedFetchCache.set(fileUrl, {
        timestamp: Date.now(),
        error: error.message
      })
      throw new Error(`Error requesting file via WebSocket from server ${serverId}: ${error.message}`)
    }
  }

  /**
   * 写入缓存
   */
  private writeToCache(cachedFilePath: string, buffer: Buffer): void {
    try {
      fs.writeFileSync(cachedFilePath, buffer)
      logger.debug('File cached locally', { path: cachedFilePath })
    } catch (error) {
      logger.error('Failed to write file to cache', error as Error)
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<number> {
    let cleared = 0
    try {
      const files = fs.readdirSync(this.config.cacheDir)
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(this.config.cacheDir, file))
          cleared++
        } catch (e) {
          logger.warn('Failed to delete cache file', { file })
        }
      }
      logger.info('Cache cleared', { filesDeleted: cleared })
    } catch (error) {
      logger.error('Failed to clear cache', error as Error)
    }
    return cleared
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    cacheDir: string
    fileCount: number
    totalSize: number
  } {
    let fileCount = 0
    let totalSize = 0

    try {
      const files = fs.readdirSync(this.config.cacheDir)
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(this.config.cacheDir, file))
          if (stat.isFile()) {
            fileCount++
            totalSize += stat.size
          }
        } catch (e) {
          // Ignore
        }
      }
    } catch (error) {
      logger.error('Failed to get cache stats', error as Error)
    }

    return {
      cacheDir: this.config.cacheDir,
      fileCount,
      totalSize
    }
  }

  /**
   * 清理过期缓存 (基于最后访问时间)
   */
  async cleanupExpiredCache(maxAgeMs: number): Promise<number> {
    let cleaned = 0
    const now = Date.now()

    try {
      const files = fs.readdirSync(this.config.cacheDir)
      for (const file of files) {
        try {
          const filePath = path.join(this.config.cacheDir, file)
          const stat = fs.statSync(filePath)
          if (stat.isFile() && now - stat.atimeMs > maxAgeMs) {
            fs.unlinkSync(filePath)
            cleaned++
          }
        } catch (e) {
          // Ignore individual file errors
        }
      }
      logger.info('Expired cache cleanup completed', { filesRemoved: cleaned })
    } catch (error) {
      logger.error('Failed to cleanup expired cache', error as Error)
    }

    return cleaned
  }

  // ==================== 工具方法 ====================

  /**
   * 检查文件是否已缓存
   */
  isFileCached(fileUrl: string): boolean {
    const cacheKey = crypto.createHash('sha256').update(fileUrl).digest('hex')
    let originalExtension = ''

    try {
      const url = new URL(fileUrl)
      originalExtension = path.extname(url.pathname)
    } catch (e) {
      // Ignore
    }

    const cachedFilePath = path.join(this.config.cacheDir, cacheKey + originalExtension)
    return fs.existsSync(cachedFilePath)
  }

  /**
   * 预缓存文件
   */
  async precacheFile(localPath: string): Promise<string> {
    const fileUrl = `file://${localPath.replace(/\\/g, '/')}`
    const cacheKey = crypto.createHash('sha256').update(fileUrl).digest('hex')
    const ext = path.extname(localPath)
    const cachedFilePath = path.join(this.config.cacheDir, cacheKey + ext)

    const buffer = fs.readFileSync(localPath)
    fs.writeFileSync(cachedFilePath, buffer)

    logger.debug('File precached', { localPath, cachedFilePath })
    return cachedFilePath
  }
}

// ==================== 导出 ====================

let serverInstance: FileFetcherServer | null = null

export function getFileFetcherServer(config?: Partial<FileFetcherConfig>): FileFetcherServer {
  if (!serverInstance) {
    serverInstance = FileFetcherServer.getInstance(config)
  }
  return serverInstance
}

export default FileFetcherServer
