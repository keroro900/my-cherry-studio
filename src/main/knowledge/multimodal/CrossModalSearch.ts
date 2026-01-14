/**
 * 跨模态检索服务
 *
 * 支持:
 * - 文本搜图片
 * - 图片搜相似图片
 * - 图片搜文本描述
 * - 统一检索 (任意模态 → 任意模态)
 */

import { loggerService } from '@logger'

import type { MemoryVectorDb } from '../vector/MemoryVectorDb'
import { createMemoryVectorDb } from '../vector/MemoryVectorDb'
import type { MultimodalEmbeddingService } from './MultimodalEmbeddingService'
import { createMultimodalEmbeddingService } from './MultimodalEmbeddingService'
import type {
  ImageSearchResult,
  // InformationChain,
  Modality,
  MultimodalContent,
  MultimodalQuery,
  MultimodalSearchResult,
  TextSearchResult
} from './types'

const logger = loggerService.withContext('CrossModalSearch')

/**
 * 模态索引
 */
interface ModalityIndex {
  modality: Modality
  vectorDb: MemoryVectorDb
  itemCount: number
}

/**
 * 跨模态检索服务
 */
export class CrossModalSearchService {
  private embeddingService: MultimodalEmbeddingService
  private indices: Map<Modality, ModalityIndex> = new Map()

  constructor(embeddingService?: MultimodalEmbeddingService) {
    this.embeddingService = embeddingService || createMultimodalEmbeddingService()

    // 初始化各模态索引
    const modalities: Modality[] = ['text', 'image', 'video', 'audio']
    for (const m of modalities) {
      this.indices.set(m, {
        modality: m,
        vectorDb: createMemoryVectorDb({ path: `memory:${m}` }),
        itemCount: 0
      })
    }

    logger.info('CrossModalSearchService initialized')
  }

  /**
   * 添加内容到索引
   */
  async addContent(content: MultimodalContent, id?: string): Promise<string> {
    const index = this.indices.get(content.type)
    if (!index) {
      throw new Error(`Unknown modality: ${content.type}`)
    }

    // 生成嵌入
    const unified = await this.embeddingService.embed(content)

    // 生成 ID
    const contentId = id || `${content.type}_${Date.now()}_${index.itemCount}`

    // 添加到向量数据库
    await index.vectorDb.insertChunks(
      [
        {
          pageContent: typeof content.content === 'string' ? content.content : contentId,
          metadata: {
            ...content.metadata,
            id: contentId,
            modality: content.type
          }
        }
      ],
      [unified.embedding]
    )

    index.itemCount++

    logger.debug('Content added to index', { id: contentId, modality: content.type })
    return contentId
  }

  /**
   * 批量添加内容
   */
  async addContentBatch(contents: MultimodalContent[]): Promise<string[]> {
    const ids: string[] = []

    for (const content of contents) {
      const id = await this.addContent(content)
      ids.push(id)
    }

    return ids
  }

  /**
   * 文本搜图片
   */
  async searchImagesByText(query: string, topK: number = 10): Promise<ImageSearchResult[]> {
    const index = this.indices.get('image')
    if (!index || index.itemCount === 0) {
      return []
    }

    // 生成查询嵌入
    const queryEmbedding = await this.embeddingService.embed({
      type: 'text',
      content: query
    })

    // 搜索图片索引
    const results = await index.vectorDb.similaritySearch(queryEmbedding.embedding, topK)

    return results.map((r) => ({
      id: r.metadata?.id || r.id,
      score: r.score,
      imagePath: r.metadata?.path || r.pageContent || '',
      metadata: r.metadata
    }))
  }

  /**
   * 图片搜相似图片
   */
  async searchImagesByImage(imagePath: string, topK: number = 10): Promise<ImageSearchResult[]> {
    const index = this.indices.get('image')
    if (!index || index.itemCount === 0) {
      return []
    }

    // 生成图片嵌入
    const imageEmbedding = await this.embeddingService.embedImage(imagePath)

    // 搜索图片索引
    const results = await index.vectorDb.similaritySearch(imageEmbedding, topK)

    return results.map((r) => ({
      id: r.metadata?.id || r.id,
      score: r.score,
      imagePath: r.metadata?.path || r.pageContent || '',
      metadata: r.metadata
    }))
  }

  /**
   * 图片搜文本描述
   */
  async searchTextsByImage(imagePath: string, topK: number = 10): Promise<TextSearchResult[]> {
    const index = this.indices.get('text')
    if (!index || index.itemCount === 0) {
      return []
    }

    // 生成图片嵌入
    const imageEmbedding = await this.embeddingService.embedImage(imagePath)

    // 搜索文本索引
    const results = await index.vectorDb.similaritySearch(imageEmbedding, topK)

    return results.map((r) => ({
      id: r.metadata?.id || r.id,
      score: r.score,
      text: r.pageContent || '',
      metadata: r.metadata
    }))
  }

  /**
   * 统一检索 (任意模态 → 任意模态)
   */
  async search(query: MultimodalQuery, targetModalities?: Modality[]): Promise<MultimodalSearchResult[]> {
    const modalitiesToSearch = targetModalities || ['text', 'image', 'video', 'audio']

    // 生成查询嵌入
    const queryEmbedding = await this.embeddingService.embed({
      type: query.type,
      content: query.content
    })

    const allResults: MultimodalSearchResult[] = []
    const topK = query.options?.topK || 10

    // 在各模态索引中搜索
    for (const mod of modalitiesToSearch) {
      const index = this.indices.get(mod as Modality)
      if (!index || index.itemCount === 0) continue

      const results = await index.vectorDb.similaritySearch(queryEmbedding.embedding, topK)

      for (const r of results) {
        allResults.push({
          id: r.metadata?.id || r.id,
          modality: mod as Modality,
          score: r.score,
          content: r.pageContent || '',
          metadata: r.metadata
        })
      }
    }

    // 按分数排序
    allResults.sort((a, b) => b.score - a.score)

    // 应用阈值过滤
    const threshold = query.options?.threshold || 0
    const filteredResults = allResults.filter((r) => r.score >= threshold)

    return filteredResults.slice(0, topK)
  }

  /**
   * 获取索引统计
   */
  getStats(): Record<Modality, { itemCount: number }> {
    const stats: Record<string, { itemCount: number }> = {}

    for (const [m, index] of this.indices) {
      stats[m] = { itemCount: index.itemCount }
    }

    return stats as Record<Modality, { itemCount: number }>
  }

  /**
   * 清除所有索引
   */
  async clearAll(): Promise<void> {
    for (const [_m, index] of this.indices) {
      await index.vectorDb.reset()
      index.itemCount = 0
    }
    logger.info('All indices cleared')
  }

  /**
   * 清除特定模态索引
   */
  async clearModality(mod: Modality): Promise<void> {
    const index = this.indices.get(mod)
    if (index) {
      await index.vectorDb.reset()
      index.itemCount = 0
      logger.info('Modality index cleared', { modality: mod })
    }
  }
}

/**
 * 创建跨模态检索服务
 */
export function createCrossModalSearchService(embeddingService?: MultimodalEmbeddingService): CrossModalSearchService {
  return new CrossModalSearchService(embeddingService)
}

/**
 * 默认实例
 */
export const crossModalSearchService = new CrossModalSearchService()
