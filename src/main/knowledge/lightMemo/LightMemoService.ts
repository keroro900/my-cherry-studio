/**
 * LightMemo - 轻量级检索服务 (Native Only)
 *
 * 使用 Rust Native 模块实现 BM25 + 向量检索:
 * - Tantivy BM25 关键词检索 (~10ms for 100k docs)
 * - Native VectorStore 向量语义检索
 * - 分数融合
 *
 * 🚀 强制使用 Rust 原生实现 (native-vcp)
 * 不提供 TypeScript fallback
 *
 * @version 2.0.0
 */

import { loggerService } from '@logger'

import {
  createSearchEngine,
  createVectorStore,
  isNativeModuleAvailable,
  type SearchDocument as NativeSearchDocument
} from '@main/services/native'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('LightMemoService')

// ==================== 类型定义 ====================

/**
 * 文档条目
 */
export interface LightMemoDocument {
  id: string
  content: string
  embedding?: number[]
  metadata?: Record<string, unknown>
}

/**
 * 搜索结果
 */
export interface LightMemoSearchResult {
  id: string
  content: string
  score: number
  bm25Score: number
  semanticScore: number
  metadata?: Record<string, unknown>
}

/**
 * 检索配置
 */
export interface LightMemoConfig {
  /** BM25 权重 (0-1, 默认 0.3) */
  bm25Weight?: number
  /** 语义权重 (0-1, 默认 0.7) */
  semanticWeight?: number
  /** 返回数量 */
  topK?: number
  /** 最低分数阈值 */
  threshold?: number
}

// ==================== LightMemo 服务 (Native Only) ====================

/**
 * LightMemo 服务 - Rust Native 实现
 *
 * 使用 Tantivy 进行 BM25 搜索，VectorStore 进行向量搜索
 * 必须有 native-vcp 模块支持
 */
export class LightMemoService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nativeSearchEngine: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nativeVectorStore: any
  private documents: Map<string, LightMemoDocument> = new Map()
  private indexPath: string
  private vectorDim: number

  constructor(options?: { indexPath?: string; vectorDim?: number }) {
    this.indexPath = options?.indexPath || path.join(app.getPath('userData'), 'native-vcp', 'lightmemo-index')
    this.vectorDim = options?.vectorDim || 1536

    // 必须有 Native 模块
    if (!isNativeModuleAvailable()) {
      throw new Error('LightMemoService requires native-vcp module (not available)')
    }

    // 尝试初始化搜索引擎，带锁冲突恢复
    this.nativeSearchEngine = this.initSearchEngineWithRetry()
    this.nativeVectorStore = createVectorStore(this.vectorDim)
    logger.info('LightMemoService initialized (Rust native)', {
      indexPath: this.indexPath,
      vectorDim: this.vectorDim
    })
  }

  /**
   * 初始化搜索引擎，带锁冲突恢复
   */
  private initSearchEngineWithRetry(): any {
    try {
      return createSearchEngine(this.indexPath)
    } catch (error: any) {
      const errorMsg = String(error?.message || error)

      // 检查是否是锁冲突
      if (errorMsg.includes('LockBusy') || errorMsg.includes('index lock') || errorMsg.includes('Lockfile')) {
        logger.warn('Index lock conflict detected, attempting recovery...', { indexPath: this.indexPath })

        // 尝试清理锁文件
        if (this.clearLockFile()) {
          try {
            // 重试一次
            return createSearchEngine(this.indexPath)
          } catch (retryError) {
            logger.error('Failed to recover from lock conflict', { error: String(retryError) })
            throw new Error(`Failed to initialize LightMemoService: index locked. Please restart the application.`)
          }
        }
      }

      throw new Error(`Failed to initialize LightMemoService native backend: ${error}`)
    }
  }

  /**
   * 清理遗留的锁文件
   */
  private clearLockFile(): boolean {
    const lockPath = path.join(this.indexPath, '.tantivy-writer.lock')
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath)
        logger.warn('Cleared stale Tantivy lock file', { path: lockPath })
        return true
      }
    } catch (error) {
      logger.warn('Failed to clear lock file', { path: lockPath, error: String(error) })
    }
    return false
  }

  /**
   * 添加文档
   */
  addDocument(doc: LightMemoDocument): void {
    this.documents.set(doc.id, doc)

    const nativeDoc: NativeSearchDocument = {
      id: doc.id,
      content: doc.content,
      title: (doc.metadata?.title as string) || undefined,
      tags: (doc.metadata?.tags as string[]) || undefined
    }
    this.nativeSearchEngine.addDocument(nativeDoc)

    // 如果有向量，添加到 VectorStore
    if (doc.embedding && this.nativeVectorStore) {
      this.nativeVectorStore.add(doc.id, doc.embedding)
    }
  }

  /**
   * 批量添加文档
   */
  addDocuments(docs: LightMemoDocument[]): void {
    for (const doc of docs) {
      this.documents.set(doc.id, doc)
    }

    const nativeDocs: NativeSearchDocument[] = docs.map((doc) => ({
      id: doc.id,
      content: doc.content,
      title: (doc.metadata?.title as string) || undefined,
      tags: (doc.metadata?.tags as string[]) || undefined
    }))
    this.nativeSearchEngine.addDocuments(nativeDocs)

    // 添加向量
    for (const doc of docs) {
      if (doc.embedding) {
        this.nativeVectorStore.add(doc.id, doc.embedding)
      }
    }
  }

  /**
   * 提交索引更改
   */
  commit(): void {
    this.nativeSearchEngine.commit()
  }

  /**
   * 构建索引 (兼容旧 API，在 native 模式下等同于 commit)
   */
  buildIndex(): void {
    this.commit()
  }

  /**
   * 搜索
   */
  async search(
    query: string,
    queryEmbedding?: number[],
    config: LightMemoConfig = {}
  ): Promise<LightMemoSearchResult[]> {
    const { bm25Weight = 0.3, semanticWeight = 0.7, topK = 10, threshold = 0 } = config

    const startTime = Date.now()

    // 1. BM25 搜索 (Tantivy)
    const bm25Results = this.nativeSearchEngine.search(query, topK * 3)
    const bm25Scores = new Map<string, number>()
    const maxBm25 = bm25Results.length > 0 ? bm25Results[0].score : 0.001

    for (const r of bm25Results) {
      bm25Scores.set(r.id, r.score / maxBm25) // 归一化
    }

    // 2. 向量搜索 (如果有查询向量)
    const semanticScores = new Map<string, number>()
    if (queryEmbedding && this.nativeVectorStore) {
      const vectorResults = this.nativeVectorStore.search(queryEmbedding, topK * 3)
      for (const r of vectorResults) {
        semanticScores.set(r.id, r.score)
      }
    }

    // 3. 融合分数
    const allIds = new Set([...bm25Scores.keys(), ...semanticScores.keys()])
    const results: LightMemoSearchResult[] = []

    for (const id of allIds) {
      const doc = this.documents.get(id)
      if (!doc) continue

      const bm25 = bm25Scores.get(id) || 0
      const semantic = semanticScores.get(id) || 0

      let score: number
      if (queryEmbedding && semanticScores.size > 0) {
        score = bm25Weight * bm25 + semanticWeight * semantic
      } else {
        score = bm25
      }

      if (score >= threshold) {
        results.push({
          id,
          content: doc.content,
          score,
          bm25Score: bm25,
          semanticScore: semantic,
          metadata: doc.metadata
        })
      }
    }

    results.sort((a, b) => b.score - a.score)

    const durationMs = Date.now() - startTime
    logger.debug('LightMemo search completed', {
      query: query.substring(0, 50),
      resultCount: results.length,
      durationMs
    })

    return results.slice(0, topK)
  }

  /**
   * 清空所有文档和索引
   */
  clear(): void {
    this.documents.clear()
    this.nativeVectorStore?.clear()
    // SearchEngine 没有 clear 方法，需要重新初始化
  }

  /**
   * 获取文档数量
   */
  getDocumentCount(): number {
    return this.documents.size
  }

  /**
   * 获取统计信息
   */
  getStats(): { documentCount: number; indexPath: string } {
    return {
      documentCount: this.documents.size,
      indexPath: this.indexPath
    }
  }
}

// ==================== 单例管理 ====================

let serviceInstance: LightMemoService | null = null

/**
 * 获取 LightMemo 服务实例 (单例)
 */
export function getLightMemoService(): LightMemoService {
  if (!serviceInstance) {
    serviceInstance = new LightMemoService()
  }
  return serviceInstance
}

/**
 * 创建新的 LightMemo 服务实例
 */
export function createLightMemoService(options?: {
  indexPath?: string
  vectorDim?: number
}): LightMemoService {
  return new LightMemoService(options)
}

// ==================== 兼容旧 API ====================

/**
 * @deprecated 使用 LightMemoService 代替
 */
export const NativeLightMemoService = LightMemoService

/**
 * @deprecated 使用 getLightMemoService() 代替
 */
export const getNativeLightMemoService = getLightMemoService

/**
 * @deprecated 使用 createLightMemoService() 代替
 */
export const createNativeLightMemoService = createLightMemoService
