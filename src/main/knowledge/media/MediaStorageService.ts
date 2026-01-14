/**
 * 媒体存储管理服务
 *
 * 功能:
 * - 图像 Base64 存储管理
 * - 媒体文件索引
 * - 存储空间清理
 * - 媒体检索
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('MediaStorageService')

// ==================== 类型定义 ====================

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document'

/**
 * 图像格式
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg'

/**
 * 媒体记录
 */
export interface MediaRecord {
  id: string
  type: MediaType
  format: string
  filename: string
  size: number // 字节数
  base64Size: number // Base64 编码后大小
  hash: string // 内容 SHA256
  tags: string[]
  source: string // 来源 (如 "ImageProcessor", "upload", "screenshot")
  metadata?: Record<string, any>
  createdAt: Date
  lastAccessedAt: Date
}

/**
 * 媒体存储统计
 */
export interface MediaStorageStats {
  totalCount: number
  totalSize: number
  totalBase64Size: number
  byType: Record<MediaType, { count: number; size: number }>
  bySource: Record<string, { count: number; size: number }>
  oldestRecord?: Date
  newestRecord?: Date
}

/**
 * 媒体搜索条件
 */
export interface MediaSearchFilter {
  type?: MediaType
  format?: string
  source?: string
  tags?: string[]
  minSize?: number
  maxSize?: number
  dateFrom?: Date
  dateTo?: Date
}

// ==================== MediaStorageService ====================

export class MediaStorageService {
  private records: Map<string, MediaRecord> = new Map()
  private storagePath: string
  private mediaDir: string

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(process.cwd(), 'data', 'media')
    this.mediaDir = path.join(this.storagePath, 'files')
    this.ensureStorageDir()
    this.loadIndex()
  }

  // ==================== 存储操作 ====================

  /**
   * 存储 Base64 媒体
   */
  async storeBase64(
    base64Data: string,
    options: {
      type: MediaType
      format: string
      filename?: string
      source: string
      tags?: string[]
      metadata?: Record<string, any>
    }
  ): Promise<MediaRecord> {
    const { type, format, filename, source, tags = [], metadata } = options

    // 移除 data URL 前缀
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '')

    // 计算哈希检查重复
    const hash = crypto.createHash('sha256').update(cleanBase64).digest('hex')
    const existing = this.findByHash(hash)
    if (existing) {
      existing.lastAccessedAt = new Date()
      await this.saveIndex()
      return existing
    }

    // 解码获取实际大小
    const buffer = Buffer.from(cleanBase64, 'base64')
    const actualSize = buffer.length
    const base64Size = cleanBase64.length

    // 生成文件名
    const id = crypto.randomBytes(8).toString('hex')
    const finalFilename = filename || `${id}.${format}`
    const filePath = path.join(this.mediaDir, finalFilename)

    // 保存文件
    await fs.promises.writeFile(filePath, buffer)

    // 创建记录
    const record: MediaRecord = {
      id,
      type,
      format,
      filename: finalFilename,
      size: actualSize,
      base64Size,
      hash,
      tags,
      source,
      metadata,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    }

    this.records.set(id, record)
    await this.saveIndex()

    logger.info('Media stored', {
      id,
      type,
      format,
      size: actualSize,
      source
    })

    return record
  }

  /**
   * 获取 Base64 媒体
   */
  async getBase64(id: string): Promise<{ record: MediaRecord; base64: string } | null> {
    const record = this.records.get(id)
    if (!record) return null

    const filePath = path.join(this.mediaDir, record.filename)
    if (!fs.existsSync(filePath)) {
      logger.warn('Media file not found', { id, filename: record.filename })
      return null
    }

    const buffer = await fs.promises.readFile(filePath)
    const base64 = buffer.toString('base64')

    // 更新访问时间
    record.lastAccessedAt = new Date()
    await this.saveIndex()

    return {
      record,
      base64: `data:${this.getMimeType(record.type, record.format)};base64,${base64}`
    }
  }

  /**
   * 删除媒体
   */
  async delete(id: string): Promise<boolean> {
    const record = this.records.get(id)
    if (!record) return false

    // 删除文件
    const filePath = path.join(this.mediaDir, record.filename)
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }

    // 删除记录
    this.records.delete(id)
    await this.saveIndex()

    logger.info('Media deleted', { id })
    return true
  }

  /**
   * 批量删除
   */
  async deleteMany(ids: string[]): Promise<number> {
    let count = 0
    for (const id of ids) {
      if (await this.delete(id)) {
        count++
      }
    }
    return count
  }

  // ==================== 检索操作 ====================

  /**
   * 获取所有记录
   */
  getAllRecords(): MediaRecord[] {
    return [...this.records.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * 按条件搜索
   */
  search(filter: MediaSearchFilter): MediaRecord[] {
    let results = [...this.records.values()]

    if (filter.type) {
      results = results.filter((r) => r.type === filter.type)
    }

    if (filter.format) {
      results = results.filter((r) => r.format === filter.format)
    }

    if (filter.source) {
      results = results.filter((r) => r.source === filter.source)
    }

    if (filter.tags?.length) {
      results = results.filter((r) => filter.tags!.some((t) => r.tags.includes(t)))
    }

    if (filter.minSize !== undefined) {
      results = results.filter((r) => r.size >= filter.minSize!)
    }

    if (filter.maxSize !== undefined) {
      results = results.filter((r) => r.size <= filter.maxSize!)
    }

    if (filter.dateFrom) {
      results = results.filter((r) => new Date(r.createdAt) >= filter.dateFrom!)
    }

    if (filter.dateTo) {
      results = results.filter((r) => new Date(r.createdAt) <= filter.dateTo!)
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * 按哈希查找
   */
  findByHash(hash: string): MediaRecord | undefined {
    return [...this.records.values()].find((r) => r.hash === hash)
  }

  /**
   * 按标签查找
   */
  findByTags(tags: string[]): MediaRecord[] {
    return [...this.records.values()].filter((r) => tags.some((t) => r.tags.includes(t)))
  }

  // ==================== 清理操作 ====================

  /**
   * 清理过期媒体
   */
  async cleanupOldMedia(daysOld: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const toDelete = [...this.records.values()].filter((r) => new Date(r.lastAccessedAt) < cutoffDate)

    let count = 0
    for (const record of toDelete) {
      if (await this.delete(record.id)) {
        count++
      }
    }

    logger.info('Cleaned up old media', { daysOld, deletedCount: count })
    return count
  }

  /**
   * 清理孤立文件 (索引中不存在的文件)
   */
  async cleanupOrphanedFiles(): Promise<number> {
    const indexedFilenames = new Set([...this.records.values()].map((r) => r.filename))
    const files = await fs.promises.readdir(this.mediaDir)

    let count = 0
    for (const file of files) {
      if (!indexedFilenames.has(file)) {
        const filePath = path.join(this.mediaDir, file)
        await fs.promises.unlink(filePath)
        count++
        logger.debug('Deleted orphaned file', { filename: file })
      }
    }

    logger.info('Cleaned up orphaned files', { deletedCount: count })
    return count
  }

  /**
   * 清理重复媒体 (保留最新的)
   */
  async cleanupDuplicates(): Promise<number> {
    const hashGroups = new Map<string, MediaRecord[]>()

    for (const record of this.records.values()) {
      const existing = hashGroups.get(record.hash) || []
      existing.push(record)
      hashGroups.set(record.hash, existing)
    }

    let count = 0
    for (const [_hash, records] of hashGroups) {
      if (records.length > 1) {
        // 按创建时间排序，保留最新的
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        const toDelete = records.slice(1)

        for (const record of toDelete) {
          if (await this.delete(record.id)) {
            count++
          }
        }
      }
    }

    logger.info('Cleaned up duplicates', { deletedCount: count })
    return count
  }

  // ==================== 统计 ====================

  /**
   * 获取存储统计
   */
  getStats(): MediaStorageStats {
    const records = [...this.records.values()]

    const byType: Record<MediaType, { count: number; size: number }> = {
      image: { count: 0, size: 0 },
      video: { count: 0, size: 0 },
      audio: { count: 0, size: 0 },
      document: { count: 0, size: 0 }
    }

    const bySource: Record<string, { count: number; size: number }> = {}

    let totalSize = 0
    let totalBase64Size = 0
    let oldestDate: Date | undefined
    let newestDate: Date | undefined

    for (const record of records) {
      totalSize += record.size
      totalBase64Size += record.base64Size

      // 按类型统计
      byType[record.type].count++
      byType[record.type].size += record.size

      // 按来源统计
      if (!bySource[record.source]) {
        bySource[record.source] = { count: 0, size: 0 }
      }
      bySource[record.source].count++
      bySource[record.source].size += record.size

      // 日期范围
      const createdAt = new Date(record.createdAt)
      if (!oldestDate || createdAt < oldestDate) oldestDate = createdAt
      if (!newestDate || createdAt > newestDate) newestDate = createdAt
    }

    return {
      totalCount: records.length,
      totalSize,
      totalBase64Size,
      byType,
      bySource,
      oldestRecord: oldestDate,
      newestRecord: newestDate
    }
  }

  /**
   * 格式化大小
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  // ==================== 工具方法 ====================

  private getMimeType(type: MediaType, format: string): string {
    if (type === 'image') {
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml'
      }
      return mimeMap[format] || 'image/png'
    }

    if (type === 'video') {
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime'
      }
      return mimeMap[format] || 'video/mp4'
    }

    if (type === 'audio') {
      const mimeMap: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg'
      }
      return mimeMap[format] || 'audio/mpeg'
    }

    return 'application/octet-stream'
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true })
    }
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true })
    }
  }

  private async saveIndex(): Promise<void> {
    const data = Object.fromEntries(this.records)
    const filePath = path.join(this.storagePath, 'index.json')
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private loadIndex(): void {
    const filePath = path.join(this.storagePath, 'index.json')
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        for (const [key, value] of Object.entries(data)) {
          this.records.set(key, value as MediaRecord)
        }
        logger.info('Loaded media index', { count: this.records.size })
      } catch (error) {
        logger.error('Failed to load media index', { error: String(error) })
      }
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: MediaStorageService | null = null

export function getMediaStorageService(storagePath?: string): MediaStorageService {
  if (!serviceInstance) {
    serviceInstance = new MediaStorageService(storagePath)
  }
  return serviceInstance
}

export function createMediaStorageService(storagePath?: string): MediaStorageService {
  return new MediaStorageService(storagePath)
}
