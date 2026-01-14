/**
 * ElasticsearchBackend - Elasticsearch 全文搜索后端
 *
 * 提供 Elasticsearch 的查询能力：
 * - DSL 查询执行
 * - 多字段全文搜索
 * - 聚合分析
 * - 索引管理
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import type {
  BackendConnectionConfig,
  BackendStatus,
  ExternalSearchOptions,
  ExternalSearchResult
} from './ExternalKnowledgeBackend'
import { FulltextKnowledgeBackend } from './ExternalKnowledgeBackend'

const logger = loggerService.withContext('ElasticsearchBackend')

// ==================== 类型定义 ====================

/**
 * Elasticsearch 连接配置
 */
export interface ElasticsearchConfig extends BackendConnectionConfig {
  /** 默认索引 */
  defaultIndex?: string
  /** 索引模式 */
  indexPattern?: string
  /** 云 ID (Elastic Cloud) */
  cloudId?: string
}

/**
 * Elasticsearch 搜索响应
 */
interface EsSearchResponse {
  took: number
  timed_out: boolean
  hits: {
    total: { value: number; relation: string } | number
    max_score: number | null
    hits: Array<{
      _index: string
      _id: string
      _score: number
      _source: Record<string, unknown>
      highlight?: Record<string, string[]>
    }>
  }
  aggregations?: Record<string, unknown>
}

/**
 * Elasticsearch 索引信息
 */
interface EsIndexInfo {
  [indexName: string]: {
    aliases: Record<string, unknown>
    mappings: Record<string, unknown>
    settings: {
      index: {
        number_of_shards: string
        number_of_replicas: string
        uuid: string
        creation_date: string
      }
    }
  }
}

/**
 * Elasticsearch Cat 索引响应
 */
interface EsCatIndexResponse {
  health: string
  status: string
  index: string
  uuid: string
  pri: string
  rep: string
  'docs.count': string
  'docs.deleted': string
  'store.size': string
  'pri.store.size': string
}

// ==================== ElasticsearchBackend 实现 ====================

export class ElasticsearchBackend extends FulltextKnowledgeBackend {
  readonly type = 'elasticsearch' as const
  readonly name = 'Elasticsearch Search Engine'

  /** 统计信息 */
  private stats = {
    totalQueries: 0,
    totalTime: 0
  }

  constructor(config: ElasticsearchConfig) {
    super(config)
  }

  // ==================== 生命周期方法 ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('ElasticsearchBackend already initialized')
      return
    }

    try {
      // 验证连接
      const status = await this.checkConnection()
      if (!status.connected) {
        throw new Error(`Failed to connect to Elasticsearch: ${status.error}`)
      }

      this.initialized = true
      logger.info('ElasticsearchBackend initialized successfully', { endpoint: this.config.endpoint })
    } catch (error) {
      logger.error('Failed to initialize ElasticsearchBackend', error as Error)
      throw error
    }
  }

  async close(): Promise<void> {
    this.initialized = false
    logger.info('ElasticsearchBackend closed')
  }

  async checkConnection(): Promise<BackendStatus> {
    const status: BackendStatus = {
      connected: false,
      healthy: false,
      lastCheck: new Date()
    }

    try {
      const response = await this.request('GET', '/')

      if (response.ok) {
        const data = (await response.json()) as {
          version?: { number: string }
          cluster_name?: string
        }

        status.connected = true
        status.healthy = true
        status.version = data.version?.number || 'unknown'
        status.stats = {
          totalQueries: this.stats.totalQueries,
          avgResponseTime: this.stats.totalQueries > 0 ? this.stats.totalTime / this.stats.totalQueries : 0
        }
      } else {
        status.error = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      status.error = String(error)
    }

    return status
  }

  // ==================== 搜索方法 ====================

  async search(query: string, options?: ExternalSearchOptions): Promise<ExternalSearchResult[]> {
    const limit = options?.limit || 10
    const offset = options?.offset || 0

    return this.multiFieldSearch(query, undefined, { ...options, limit, offset })
  }

  async getEntity(id: string): Promise<ExternalSearchResult | null> {
    const index = (this.config as ElasticsearchConfig).defaultIndex || '*'

    try {
      // 使用 _search 而非 _doc 以支持通配符索引
      const dsl = {
        query: {
          ids: { values: [id] }
        },
        size: 1
      }

      const result = await this.executeDsl(dsl, index)
      const hits = (result as EsSearchResponse).hits.hits

      if (hits.length === 0) {
        return null
      }

      const hit = hits[0]
      return {
        id: hit._id,
        title: String(hit._source.title || hit._source.name || hit._id),
        content: JSON.stringify(hit._source),
        score: hit._score || 1.0,
        sourceType: 'elasticsearch',
        metadata: {
          index: hit._index,
          source: hit._source
        }
      }
    } catch (error) {
      logger.error('Elasticsearch getEntity failed', error as Error)
      throw error
    }
  }

  // ==================== 全文搜索特定方法 ====================

  async executeDsl(dsl: Record<string, unknown>, index?: string): Promise<unknown> {
    const targetIndex =
      index ||
      (this.config as ElasticsearchConfig).defaultIndex ||
      (this.config as ElasticsearchConfig).indexPattern ||
      '*'

    const startTime = Date.now()

    try {
      const response = await this.request('POST', `/${targetIndex}/_search`, dsl)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Elasticsearch query failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      this.updateStats(Date.now() - startTime)

      return result
    } catch (error) {
      logger.error('Elasticsearch DSL execution failed', { index: targetIndex, error: error as Error })
      throw error
    }
  }

  async multiFieldSearch(
    query: string,
    fields?: string[],
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult[]> {
    const index =
      (this.config as ElasticsearchConfig).defaultIndex || (this.config as ElasticsearchConfig).indexPattern || '*'
    const limit = options?.limit || 10
    const offset = options?.offset || 0

    const dsl: Record<string, unknown> = {
      query: {
        multi_match: {
          query,
          fields: fields || ['*'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      },
      from: offset,
      size: limit,
      highlight: {
        fields: fields ? Object.fromEntries(fields.map((f) => [f, {}])) : { '*': {} },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      }
    }

    // 添加过滤条件
    if (options?.filters && Object.keys(options.filters).length > 0) {
      dsl.query = {
        bool: {
          must: [dsl.query],
          filter: Object.entries(options.filters).map(([key, value]) => ({
            term: { [key]: value }
          }))
        }
      }
    }

    const result = (await this.executeDsl(dsl, index)) as EsSearchResponse

    return result.hits.hits.map((hit) => {
      // 构建高亮内容
      let content = ''
      if (hit.highlight) {
        content = Object.values(hit.highlight).flat().join(' ... ')
      } else {
        // 取前 200 字符
        const source = hit._source
        const textFields = ['content', 'text', 'body', 'description', 'summary']
        for (const field of textFields) {
          if (source[field] && typeof source[field] === 'string') {
            content = (source[field] as string).slice(0, 200)
            break
          }
        }
        if (!content) {
          content = JSON.stringify(source).slice(0, 200)
        }
      }

      return {
        id: hit._id,
        title: String(hit._source.title || hit._source.name || hit._id),
        content,
        score: hit._score || 0,
        sourceType: 'elasticsearch' as const,
        rawData: options?.includeRawData ? hit : undefined,
        metadata: {
          index: hit._index,
          highlight: hit.highlight
        }
      }
    })
  }

  async getIndexInfo(index?: string): Promise<{
    name: string
    docCount: number
    sizeBytes: number
    mappings?: Record<string, unknown>
  }> {
    const targetIndex = index || (this.config as ElasticsearchConfig).defaultIndex

    if (!targetIndex) {
      throw new Error('Index name required')
    }

    try {
      // 获取索引统计
      const statsResponse = await this.request('GET', `/_cat/indices/${targetIndex}?format=json`)
      if (!statsResponse.ok) {
        throw new Error(`Failed to get index stats: ${statsResponse.status}`)
      }

      const stats = (await statsResponse.json()) as EsCatIndexResponse[]
      if (stats.length === 0) {
        throw new Error(`Index ${targetIndex} not found`)
      }

      const indexStats = stats[0]

      // 获取 mappings
      const mappingResponse = await this.request('GET', `/${targetIndex}/_mapping`)
      let mappings: Record<string, unknown> | undefined

      if (mappingResponse.ok) {
        const mappingData = (await mappingResponse.json()) as EsIndexInfo
        mappings = mappingData[targetIndex]?.mappings
      }

      return {
        name: targetIndex,
        docCount: parseInt(indexStats['docs.count'] || '0'),
        sizeBytes: this.parseSizeString(indexStats['store.size'] || '0'),
        mappings
      }
    } catch (error) {
      logger.error('getIndexInfo failed', { index: targetIndex, error: error as Error })
      throw error
    }
  }

  async indexExists(index: string): Promise<boolean> {
    try {
      const response = await this.request('HEAD', `/${index}`)
      return response.ok
    } catch {
      return false
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 执行聚合查询
   */
  async aggregate(
    aggregations: Record<string, unknown>,
    query?: Record<string, unknown>,
    index?: string
  ): Promise<Record<string, unknown>> {
    const targetIndex = index || (this.config as ElasticsearchConfig).defaultIndex || '*'

    const dsl: Record<string, unknown> = {
      size: 0,
      aggs: aggregations
    }

    if (query) {
      dsl.query = query
    }

    const result = (await this.executeDsl(dsl, targetIndex)) as EsSearchResponse
    return result.aggregations || {}
  }

  /**
   * 获取字段的 term 分布
   */
  async getTermDistribution(
    field: string,
    size: number = 10,
    index?: string
  ): Promise<Array<{ key: string; count: number }>> {
    const aggregations = {
      field_terms: {
        terms: {
          field,
          size
        }
      }
    }

    const result = await this.aggregate(aggregations, undefined, index)
    const buckets = (result.field_terms as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || []

    return buckets.map((b) => ({
      key: b.key,
      count: b.doc_count
    }))
  }

  /**
   * 模糊搜索
   */
  async fuzzySearch(query: string, field: string, options?: ExternalSearchOptions): Promise<ExternalSearchResult[]> {
    const index = (this.config as ElasticsearchConfig).defaultIndex || '*'
    const limit = options?.limit || 10

    const dsl = {
      query: {
        fuzzy: {
          [field]: {
            value: query,
            fuzziness: 'AUTO'
          }
        }
      },
      size: limit
    }

    const result = (await this.executeDsl(dsl, index)) as EsSearchResponse

    return result.hits.hits.map((hit) => ({
      id: hit._id,
      title: String(hit._source.title || hit._source.name || hit._id),
      content: String(hit._source[field] || ''),
      score: hit._score || 0,
      sourceType: 'elasticsearch' as const,
      metadata: { index: hit._index }
    }))
  }

  // ==================== 辅助方法 ====================

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<Response> {
    const url = `${this.config.endpoint}${path}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.buildAuthHeaders()
    }

    const options: RequestInit = {
      method,
      headers
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(body)
    }

    return fetch(url, options)
  }

  private parseSizeString(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)([kmgtKMGT]?[bB]?)$/)
    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = (match[2] || 'b').toLowerCase()

    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024
    }

    return value * (multipliers[unit] || 1)
  }

  private updateStats(responseTime: number): void {
    this.stats.totalQueries++
    this.stats.totalTime += responseTime
  }
}

// ==================== 导出 ====================

let backendInstance: ElasticsearchBackend | null = null

export function getElasticsearchBackend(config?: ElasticsearchConfig): ElasticsearchBackend {
  if (!backendInstance && config) {
    backendInstance = new ElasticsearchBackend(config)
  }

  if (!backendInstance) {
    throw new Error('ElasticsearchBackend not configured')
  }

  return backendInstance
}

export function resetElasticsearchBackend(): void {
  if (backendInstance) {
    backendInstance.close().catch((e) => logger.error('Failed to close ElasticsearchBackend', e as Error))
    backendInstance = null
  }
}
