/**
 * 向量索引管理器
 *
 * 参照 VCPToolBox rebuild_vector_indexes.js 实现，提供:
 * - 维度不匹配检测
 * - 向量索引重建
 * - 从 SQLite 恢复向量数据
 *
 * @module storage/VectorIndexManager
 */

import { loggerService } from '@logger'
import { DATA_PATH } from '@main/config'
import Embeddings from '@main/knowledge/embedjs/embeddings/Embeddings'
import type { CharacterIndexManager} from '@main/knowledge/vector/VexusAdapter';
import { createCharacterIndexManager } from '@main/knowledge/vector/VexusAdapter'
import { getEmbeddingDimensions } from '@main/utils/EmbeddingDimensions'
import type { ApiClient } from '@types'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import path from 'path'

import { getUnifiedStorage } from './UnifiedStorageCore'

const logger = loggerService.withContext('VectorIndexManager')

// ==================== 类型定义 ====================

/**
 * 维度不匹配检测结果
 */
export interface DimensionMismatchResult {
  /** 是否存在不匹配 */
  hasMismatch: boolean
  /** 索引当前维度 */
  indexDimension: number
  /** 配置的维度 (来自 embedding 模型) */
  configDimension: number
  /** 模型名称 */
  modelId?: string
  /** 详细信息 */
  details?: string
}

/**
 * 索引重建结果
 */
export interface RebuildResult {
  /** 是否成功 */
  success: boolean
  /** 重建的记录数 */
  rebuiltCount: number
  /** 错误信息列表 */
  errors: string[]
  /** 耗时 (ms) */
  durationMs: number
  /** 新索引维度 */
  newDimensions: number
}

/**
 * 重建进度回调
 */
export type RebuildProgressCallback = (progress: {
  phase: 'deleting' | 'reading' | 'embedding' | 'inserting' | 'complete'
  current: number
  total: number
  message: string
}) => void

/**
 * 日记本索引统计
 */
export interface DiaryIndexStats {
  /** 日记本名称 */
  diaryName: string
  /** 向量数量 */
  totalVectors: number
  /** 向量维度 */
  dimensions: number
  /** 是否使用原生模式 */
  isNative: boolean
}

/**
 * 日记本索引重建结果
 */
export interface DiaryRebuildResult {
  /** 是否成功 */
  success: boolean
  /** 日记本名称 */
  diaryName: string
  /** 重建的记录数 */
  rebuiltCount: number
  /** 错误信息 */
  error?: string
  /** 耗时 (ms) */
  durationMs: number
}

// ==================== VectorIndexManager 实现 ====================

/**
 * 向量索引管理器
 */
export class VectorIndexManager {
  private static instance: VectorIndexManager | null = null
  private diaryIndexManager: CharacterIndexManager | null = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): VectorIndexManager {
    if (!VectorIndexManager.instance) {
      VectorIndexManager.instance = new VectorIndexManager()
    }
    return VectorIndexManager.instance
  }

  /**
   * 获取或创建日记本索引管理器
   */
  private getDiaryIndexManager(dimensions: number = 1536): CharacterIndexManager {
    const basePath = path.join(DATA_PATH, 'UnifiedStorage', 'diary-indices')
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }

    // 如果维度变化，需要重新创建管理器
    if (this.diaryIndexManager) {
      return this.diaryIndexManager
    }

    this.diaryIndexManager = createCharacterIndexManager(basePath, dimensions, 50000)
    logger.info('DiaryIndexManager initialized', { basePath, dimensions })
    return this.diaryIndexManager
  }

  /**
   * 检测维度不匹配
   *
   * @param embedApiClient - Embedding API 客户端 (用于获取配置维度)
   * @returns 维度不匹配检测结果
   */
  public async detectDimensionMismatch(
    embedApiClient?: ApiClient
  ): Promise<DimensionMismatchResult> {
    try {
      const storage = getUnifiedStorage()

      // 获取向量索引
      const vectorIndex = storage.getVectorIndex()
      if (!vectorIndex) {
        return {
          hasMismatch: false,
          indexDimension: 0,
          configDimension: 0,
          details: 'Vector index not initialized'
        }
      }

      // 获取索引当前维度
      const stats = await vectorIndex.stats()
      const indexDimension = stats.dimensions

      // 获取配置维度
      let configDimension = 1536 // 默认值
      let modelId: string | undefined

      if (embedApiClient) {
        modelId = embedApiClient.model
        configDimension = getEmbeddingDimensions(modelId)
      }

      const hasMismatch = indexDimension !== configDimension && indexDimension > 0

      logger.debug('Dimension mismatch check', {
        indexDimension,
        configDimension,
        modelId,
        hasMismatch
      })

      return {
        hasMismatch,
        indexDimension,
        configDimension,
        modelId,
        details: hasMismatch
          ? `索引维度 (${indexDimension}) 与配置维度 (${configDimension}) 不匹配`
          : undefined
      }
    } catch (error) {
      logger.error('Failed to detect dimension mismatch', error as Error)
      return {
        hasMismatch: false,
        indexDimension: 0,
        configDimension: 0,
        details: `检测失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 自动检测嵌入模型的实际输出维度
   *
   * 通过发送测试文本获取实际返回的向量维度
   * 用于处理代理服务可能返回不同维度的情况
   *
   * 重要：不传 dimensions 参数！
   * - OpenAI text-embedding-3-* 模型支持维度截断
   * - 如果传入 dimensions 参数，API 会返回被截断的维度
   * - 我们需要获取原生维度，所以不传 dimensions
   * - 这与前端 InputEmbeddingDimension 刷新按钮的行为一致
   *
   * @param embedApiClient - Embedding API 客户端
   * @returns 实际维度
   */
  private async detectActualDimensions(embedApiClient: ApiClient): Promise<number> {
    const expectedDimensions = getEmbeddingDimensions(embedApiClient.model)

    try {
      logger.info('Detecting actual embedding dimensions...', {
        model: embedApiClient.model,
        expectedDimensions
      })

      // 创建临时 Embeddings 实例进行测试
      // 重要：不传 dimensions 参数，让 API 返回原生维度
      // 这与前端 OpenAIBaseClient.getEmbeddingDimensions() 行为一致
      const testEmbeddings = new Embeddings({
        embedApiClient,
        dimensions: undefined  // 不传 dimensions，获取原生维度
      })
      await testEmbeddings.init()

      // 发送测试文本
      const testVector = await testEmbeddings.embedQuery('dimension detection test')
      const actualDimensions = testVector.length

      if (actualDimensions !== expectedDimensions) {
        logger.warn('Embedding dimensions mismatch detected!', {
          model: embedApiClient.model,
          expected: expectedDimensions,
          actual: actualDimensions,
          message: '代理服务/模型返回的维度与预期不同，将使用实际检测到的维度'
        })
      } else {
        logger.info('Embedding dimensions verified', { dimensions: actualDimensions })
      }

      return actualDimensions
    } catch (error) {
      logger.error('Failed to detect actual dimensions, using expected', {
        error: (error as Error).message,
        expectedDimensions
      })
      return expectedDimensions
    }
  }

  /**
   * 重建所有向量索引
   *
   * 参照 VCPToolBox rebuild_vector_indexes.js 实现:
   * 1. 删除所有 .usearch 文件
   * 2. 从 SQLite 读取所有 chunks
   * 3. 使用新的 embedding 模型重新生成向量
   * 4. 插入到新索引
   *
   * @param embedApiClient - Embedding API 客户端
   * @param onProgress - 进度回调
   * @returns 重建结果
   */
  public async rebuildAllIndexes(
    embedApiClient: ApiClient,
    onProgress?: RebuildProgressCallback
  ): Promise<RebuildResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let rebuiltCount = 0

    // 自动检测实际维度（处理代理服务返回不同维度的情况）
    onProgress?.({
      phase: 'reading',
      current: 0,
      total: 1,
      message: '正在检测嵌入模型实际维度...'
    })

    const newDimensions = await this.detectActualDimensions(embedApiClient)

    logger.info('Starting vector index rebuild', {
      model: embedApiClient.model,
      newDimensions,
      detectedViaApi: true
    })

    try {
      // Phase 1: 删除旧索引文件
      onProgress?.({
        phase: 'deleting',
        current: 0,
        total: 1,
        message: '正在删除旧索引文件...'
      })

      await this.deleteOldIndexFiles()

      // Phase 1.5: 重新初始化向量索引 (使用新维度)
      const storage = getUnifiedStorage()
      logger.info('Reinitializing vector index with new dimensions', { newDimensions })
      await storage.setEmbeddingConfig(embedApiClient, newDimensions, true) // reinitVectorIndex = true

      // 验证新维度
      const vectorIndex = storage.getVectorIndex()
      const statsAfterReinit = await vectorIndex.stats()
      logger.info('Vector index after reinit', { dimensions: statsAfterReinit.dimensions, totalVectors: statsAfterReinit.totalVectors })

      // Phase 2: 初始化新的 Embeddings
      onProgress?.({
        phase: 'embedding',
        current: 0,
        total: 1,
        message: '正在初始化新的嵌入模型...'
      })

      const embeddings = new Embeddings({
        embedApiClient,
        dimensions: newDimensions
      })
      await embeddings.init()

      // Phase 3: 从 SQLite 读取所有 chunks
      onProgress?.({
        phase: 'reading',
        current: 0,
        total: 1,
        message: '正在读取数据库记录...'
      })

      const db = storage.getDatabase()

      // 查询所有有内容的 chunks (只选择必要列，兼容旧版数据库)
      const chunksResult = await db.execute(`
        SELECT id, content
        FROM chunks
        WHERE content IS NOT NULL AND content != ''
      `)

      const totalChunks = chunksResult.rows.length
      logger.info(`Found ${totalChunks} chunks to re-embed`)

      if (totalChunks === 0) {
        onProgress?.({
          phase: 'complete',
          current: 0,
          total: 0,
          message: '没有需要重建的记录'
        })

        return {
          success: true,
          rebuiltCount: 0,
          errors: [],
          durationMs: Date.now() - startTime,
          newDimensions
        }
      }

      // Phase 4: 重新生成向量并更新数据库
      const batchSize = 10
      const batches = Math.ceil(totalChunks / batchSize)

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, totalChunks)
        const batchChunks = chunksResult.rows.slice(start, end)

        onProgress?.({
          phase: 'inserting',
          current: end,
          total: totalChunks,
          message: `正在处理 ${end}/${totalChunks} 条记录...`
        })

        // 批量生成 embeddings
        const contents = batchChunks.map((c: Record<string, unknown>) => c.content as string)
        let newEmbeddings: number[][]

        try {
          newEmbeddings = await embeddings.embedDocuments(contents)
        } catch (error) {
          const errorMsg = `Batch ${batchIndex + 1} embedding failed: ${(error as Error).message}`
          logger.error(errorMsg)
          errors.push(errorMsg)
          continue
        }

        // 更新数据库中的 embedding
        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i] as Record<string, unknown>
          const embedding = newEmbeddings[i]

          if (!embedding) {
            errors.push(`Failed to generate embedding for chunk ${chunk.id}`)
            continue
          }

          try {
            // 转换为 Blob
            const buffer = new ArrayBuffer(embedding.length * 4)
            const view = new Float32Array(buffer)
            for (let j = 0; j < embedding.length; j++) {
              view[j] = embedding[j]
            }
            const embeddingBlob = new Uint8Array(buffer)

            // 更新数据库
            await db.execute({
              sql: `UPDATE chunks SET embedding = ?, updated_at = datetime('now') WHERE id = ?`,
              args: [embeddingBlob, chunk.id as string]
            })

            rebuiltCount++
          } catch (error) {
            const errorMsg = `Failed to update chunk ${chunk.id}: ${(error as Error).message}`
            logger.error(errorMsg)
            errors.push(errorMsg)
          }
        }

        // 插入到向量索引
        try {
          const vectorIndex = storage.getVectorIndex()
          const ids = batchChunks.map((c: Record<string, unknown>) => c.id as string)
          await vectorIndex.insert(newEmbeddings, ids)
        } catch (error) {
          const errorMsg = `Failed to insert batch ${batchIndex + 1} into vector index: ${(error as Error).message}`
          logger.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Phase 5: 保存索引到磁盘
      onProgress?.({
        phase: 'complete',
        current: totalChunks,
        total: totalChunks,
        message: `正在保存索引到磁盘...`
      })

      // 保存重建后的索引
      await storage.saveVectorIndex()

      onProgress?.({
        phase: 'complete',
        current: totalChunks,
        total: totalChunks,
        message: `重建完成: ${rebuiltCount}/${totalChunks} 条记录`
      })

      const durationMs = Date.now() - startTime
      logger.info('Vector index rebuild completed', {
        rebuiltCount,
        totalChunks,
        errors: errors.length,
        durationMs
      })

      return {
        success: errors.length === 0,
        rebuiltCount,
        errors,
        durationMs,
        newDimensions
      }
    } catch (error) {
      const errorMsg = `Rebuild failed: ${(error as Error).message}`
      logger.error(errorMsg, error as Error)
      errors.push(errorMsg)

      return {
        success: false,
        rebuiltCount,
        errors,
        durationMs: Date.now() - startTime,
        newDimensions
      }
    }
  }

  /**
   * 从 SQLite 恢复向量索引
   * 使用 Rust native 的 recoverFromSqlite 方法
   *
   * @param tableType - 表类型 ('chunks' | 'tags')
   * @param filterDiaryName - 可选的日记本过滤
   * @returns 恢复的记录数
   */
  public async recoverFromDatabase(
    tableType: 'chunks' | 'tags' = 'chunks',
    filterDiaryName?: string
  ): Promise<number> {
    try {
      const storage = getUnifiedStorage()
      const vectorIndex = storage.getVectorIndex()

      // 获取数据库路径
      const dbPath = path.join(DATA_PATH, 'UnifiedStorage', 'unified.db')

      if (!existsSync(dbPath)) {
        logger.warn('Database file not found', { dbPath })
        return 0
      }

      // 调用 Rust native 恢复方法
      await vectorIndex.recoverFromSqlite(dbPath, tableType, filterDiaryName)

      // 获取恢复后的统计
      const stats = await vectorIndex.stats()
      logger.info('Vector index recovered from database', {
        tableType,
        totalVectors: stats.totalVectors
      })

      return stats.totalVectors
    } catch (error) {
      logger.error('Failed to recover from database', error as Error)
      throw error
    }
  }

  /**
   * 删除所有旧索引文件
   */
  private async deleteOldIndexFiles(): Promise<void> {
    const indexDir = path.join(DATA_PATH, 'UnifiedStorage', 'vectors')

    if (!existsSync(indexDir)) {
      return
    }

    try {
      const files = readdirSync(indexDir)
      let deletedCount = 0

      for (const file of files) {
        if (file.endsWith('.usearch') || file.endsWith('.mapping.json')) {
          const filePath = path.join(indexDir, file)
          unlinkSync(filePath)
          deletedCount++
          logger.debug('Deleted old index file', { file })
        }
      }

      logger.info('Old index files deleted', { deletedCount })
    } catch (error) {
      logger.error('Failed to delete old index files', error as Error)
      throw error
    }
  }

  /**
   * 获取索引统计信息
   */
  public async getIndexStats(): Promise<{
    totalVectors: number
    dimensions: number
    isNative: boolean
  }> {
    try {
      const storage = getUnifiedStorage()
      const vectorIndex = storage.getVectorIndex()

      const stats = await vectorIndex.stats()
      const isNative = vectorIndex.isNativeMode?.() ?? false

      return {
        totalVectors: stats.totalVectors,
        dimensions: stats.dimensions,
        isNative
      }
    } catch (error) {
      logger.error('Failed to get index stats', error as Error)
      return {
        totalVectors: 0,
        dimensions: 0,
        isNative: false
      }
    }
  }

  /**
   * 验证索引健康状态
   */
  public async validateIndexHealth(): Promise<{
    isHealthy: boolean
    issues: string[]
  }> {
    const issues: string[] = []

    try {
      const storage = getUnifiedStorage()
      const db = storage.getDatabase()
      const vectorIndex = storage.getVectorIndex()

      // 检查数据库 chunks 数量
      const dbResult = await db.execute(
        'SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL'
      )
      const dbChunkCount = (dbResult.rows[0] as Record<string, unknown>).count as number

      // 检查向量索引数量
      const stats = await vectorIndex.stats()

      // 比较数量
      if (dbChunkCount !== stats.totalVectors) {
        issues.push(
          `数据库记录 (${dbChunkCount}) 与索引记录 (${stats.totalVectors}) 不一致`
        )
      }

      // 检查维度
      if (stats.dimensions === 0) {
        issues.push('向量索引维度为 0')
      }

      return {
        isHealthy: issues.length === 0,
        issues
      }
    } catch (error) {
      issues.push(`健康检查失败: ${(error as Error).message}`)
      return {
        isHealthy: false,
        issues
      }
    }
  }

  // ==================== 日记本索引管理 ====================

  /**
   * 获取所有日记本名称 (从数据库查询)
   */
  public async listDiaryNames(): Promise<string[]> {
    try {
      const storage = getUnifiedStorage()
      const db = storage.getDatabase()

      // 查询所有不同的 diary_name
      const result = await db.execute(`
        SELECT DISTINCT source_id as diary_name
        FROM chunks
        WHERE source = 'diary' AND source_id IS NOT NULL
      `)

      return result.rows.map((r: Record<string, unknown>) => r.diary_name as string).filter(Boolean)
    } catch (error) {
      logger.error('Failed to list diary names', error as Error)
      return []
    }
  }

  /**
   * 获取日记本索引统计
   */
  public async getDiaryIndexStats(dimensions: number = 1536): Promise<DiaryIndexStats[]> {
    try {
      const manager = this.getDiaryIndexManager(dimensions)
      const allStats = await manager.getAllStats()

      const result: DiaryIndexStats[] = []
      for (const [diaryName, stats] of allStats) {
        result.push({
          diaryName,
          totalVectors: stats.totalVectors,
          dimensions: stats.dimensions,
          isNative: stats.isNative
        })
      }

      return result
    } catch (error) {
      logger.error('Failed to get diary index stats', error as Error)
      return []
    }
  }

  /**
   * 重建单个日记本的向量索引
   *
   * 使用 Rust 原生 recoverFromSqlite 实现高效恢复
   *
   * @param diaryName - 日记本名称
   * @param embedApiClient - Embedding API 客户端
   * @param onProgress - 进度回调
   */
  public async rebuildDiaryIndex(
    diaryName: string,
    embedApiClient: ApiClient,
    onProgress?: RebuildProgressCallback
  ): Promise<DiaryRebuildResult> {
    const startTime = Date.now()

    // 自动检测实际维度
    const dimensions = await this.detectActualDimensions(embedApiClient)

    logger.info('Starting diary index rebuild', { diaryName, model: embedApiClient.model, dimensions })

    try {
      onProgress?.({
        phase: 'reading',
        current: 0,
        total: 1,
        message: `正在读取日记本 "${diaryName}" 的记录...`
      })

      const storage = getUnifiedStorage()
      const db = storage.getDatabase()

      // 查询该日记本的所有 chunks
      const chunksResult = await db.execute({
        sql: `
          SELECT id, content
          FROM chunks
          WHERE source = 'diary' AND source_id = ? AND content IS NOT NULL AND content != ''
        `,
        args: [diaryName]
      })

      const totalChunks = chunksResult.rows.length
      if (totalChunks === 0) {
        logger.info('No chunks to rebuild for diary', { diaryName })
        return {
          success: true,
          diaryName,
          rebuiltCount: 0,
          durationMs: Date.now() - startTime
        }
      }

      // Phase 2: 初始化嵌入模型
      onProgress?.({
        phase: 'embedding',
        current: 0,
        total: totalChunks,
        message: '正在初始化嵌入模型...'
      })

      const embeddings = new Embeddings({
        embedApiClient,
        dimensions
      })
      await embeddings.init()

      // Phase 3: 获取日记本索引管理器
      const manager = this.getDiaryIndexManager(dimensions)

      // Phase 4: 批量处理并更新
      const batchSize = 10
      const batches = Math.ceil(totalChunks / batchSize)
      let rebuiltCount = 0

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, totalChunks)
        const batchChunks = chunksResult.rows.slice(start, end)

        onProgress?.({
          phase: 'inserting',
          current: end,
          total: totalChunks,
          message: `正在处理 ${end}/${totalChunks} 条记录...`
        })

        // 批量生成 embeddings
        const contents = batchChunks.map((c: Record<string, unknown>) => c.content as string)
        const ids = batchChunks.map((c: Record<string, unknown>) => c.id as string)

        try {
          const newEmbeddings = await embeddings.embedDocuments(contents)

          // 插入到日记本索引
          await manager.insertByCharacter(diaryName, newEmbeddings, ids)
          rebuiltCount += newEmbeddings.length
        } catch (error) {
          logger.error(`Batch ${batchIndex + 1} embedding failed`, error as Error)
        }
      }

      // 保存索引
      await manager.saveCharacterIndex(diaryName)

      onProgress?.({
        phase: 'complete',
        current: totalChunks,
        total: totalChunks,
        message: `日记本 "${diaryName}" 索引重建完成: ${rebuiltCount}/${totalChunks}`
      })

      return {
        success: true,
        diaryName,
        rebuiltCount,
        durationMs: Date.now() - startTime
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      logger.error('Diary index rebuild failed', { diaryName, error: errorMsg })
      return {
        success: false,
        diaryName,
        rebuiltCount: 0,
        error: errorMsg,
        durationMs: Date.now() - startTime
      }
    }
  }

  /**
   * 重建所有日记本的向量索引
   *
   * @param embedApiClient - Embedding API 客户端
   * @param onProgress - 进度回调
   */
  public async rebuildAllDiaryIndexes(
    embedApiClient: ApiClient,
    onProgress?: RebuildProgressCallback
  ): Promise<{
    success: boolean
    results: DiaryRebuildResult[]
    totalRebuilt: number
    durationMs: number
  }> {
    const startTime = Date.now()
    const results: DiaryRebuildResult[] = []
    let totalRebuilt = 0

    try {
      // 获取所有日记本名称
      const diaryNames = await this.listDiaryNames()
      logger.info('Starting all diary indexes rebuild', { count: diaryNames.length })

      for (let i = 0; i < diaryNames.length; i++) {
        const diaryName = diaryNames[i]

        onProgress?.({
          phase: 'embedding',
          current: i + 1,
          total: diaryNames.length,
          message: `正在重建日记本 "${diaryName}" (${i + 1}/${diaryNames.length})...`
        })

        const result = await this.rebuildDiaryIndex(diaryName, embedApiClient)
        results.push(result)
        totalRebuilt += result.rebuiltCount
      }

      onProgress?.({
        phase: 'complete',
        current: diaryNames.length,
        total: diaryNames.length,
        message: `所有日记本索引重建完成: ${totalRebuilt} 条记录`
      })

      return {
        success: results.every((r) => r.success),
        results,
        totalRebuilt,
        durationMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error('Failed to rebuild all diary indexes', error as Error)
      return {
        success: false,
        results,
        totalRebuilt,
        durationMs: Date.now() - startTime
      }
    }
  }

  /**
   * 使用 Rust 原生方法从 SQLite 恢复日记本索引
   *
   * 参照 VCPToolBox rebuild_vector_indexes.js
   * 直接调用 Rust native recoverFromSqlite
   *
   * @param diaryName - 日记本名称 (可选，为空则恢复所有)
   */
  public async recoverDiaryFromSqlite(diaryName?: string): Promise<{
    success: boolean
    recoveredCount: number
    error?: string
  }> {
    try {
      const storage = getUnifiedStorage()
      const vectorIndex = storage.getVectorIndex()

      const dbPath = path.join(DATA_PATH, 'UnifiedStorage', 'unified.db')
      if (!existsSync(dbPath)) {
        return {
          success: false,
          recoveredCount: 0,
          error: 'Database file not found'
        }
      }

      // 调用 Rust 原生恢复方法
      // 传入 filterDiaryName 可以只恢复特定日记本
      await vectorIndex.recoverFromSqlite(dbPath, 'chunks', diaryName)

      const stats = await vectorIndex.stats()
      logger.info('Diary index recovered from SQLite', { diaryName, totalVectors: stats.totalVectors })

      return {
        success: true,
        recoveredCount: stats.totalVectors
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      logger.error('Failed to recover diary from SQLite', { diaryName, error: errorMsg })
      return {
        success: false,
        recoveredCount: 0,
        error: errorMsg
      }
    }
  }

  /**
   * 在日记本索引中搜索
   *
   * @param diaryName - 日记本名称
   * @param queryVector - 查询向量
   * @param topK - 返回结果数量
   */
  public async searchDiaryIndex(
    diaryName: string,
    queryVector: number[],
    topK: number,
    dimensions: number = 1536
  ): Promise<Array<{ id: string; score: number }>> {
    try {
      const manager = this.getDiaryIndexManager(dimensions)
      return manager.searchByCharacter(diaryName, queryVector, topK)
    } catch (error) {
      logger.error('Failed to search diary index', { diaryName, error: (error as Error).message })
      return []
    }
  }

  /**
   * 跨日记本搜索
   *
   * @param diaryNames - 日记本名称列表 (为空则搜索所有)
   * @param queryVector - 查询向量
   * @param topK - 返回结果数量
   */
  public async searchAcrossDiaries(
    diaryNames: string[],
    queryVector: number[],
    topK: number,
    dimensions: number = 1536
  ): Promise<Array<{ id: string; score: number; diaryName: string }>> {
    try {
      const manager = this.getDiaryIndexManager(dimensions)

      // 如果没有指定日记本，搜索所有已加载的
      const searchDiaries = diaryNames.length > 0 ? diaryNames : manager.listLoadedCharacters()

      const results = await manager.searchAcrossCharacters(searchDiaries, queryVector, topK)

      // 将 characterName 映射为 diaryName
      return results.map((r) => ({
        id: r.id,
        score: r.score,
        diaryName: r.characterName
      }))
    } catch (error) {
      logger.error('Failed to search across diaries', error as Error)
      return []
    }
  }

  /**
   * 保存所有日记本索引
   */
  public async saveDiaryIndexes(): Promise<void> {
    if (this.diaryIndexManager) {
      await this.diaryIndexManager.saveAll()
      logger.info('All diary indexes saved')
    }
  }

  /**
   * 清理日记本索引管理器资源
   */
  public async disposeDiaryIndexManager(save: boolean = true): Promise<void> {
    if (this.diaryIndexManager) {
      await this.diaryIndexManager.dispose(save)
      this.diaryIndexManager = null
      logger.info('DiaryIndexManager disposed')
    }
  }
}

// ==================== 导出 ====================

/**
 * 获取 VectorIndexManager 单例
 */
export function getVectorIndexManager(): VectorIndexManager {
  return VectorIndexManager.getInstance()
}

export default VectorIndexManager
