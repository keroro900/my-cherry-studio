/**
 * WikidataBackend - Wikidata SPARQL 后端
 *
 * 提供 Wikidata 知识库的查询能力：
 * - SPARQL 查询执行
 * - 实体搜索
 * - 实体详情获取
 * - 多语言支持
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import type {
  BackendConnectionConfig,
  BackendStatus,
  ExternalSearchOptions,
  ExternalSearchResult,
  WikidataEntity
} from './ExternalKnowledgeBackend'
import { SparqlKnowledgeBackend } from './ExternalKnowledgeBackend'

const logger = loggerService.withContext('WikidataBackend')

// ==================== 类型定义 ====================

/**
 * Wikidata 连接配置
 */
export interface WikidataConfig extends BackendConnectionConfig {
  /** 默认语言 */
  language?: string
  /** 是否使用缓存 */
  cacheEnabled?: boolean
  /** 缓存 TTL (秒) */
  cacheTTL?: number
  /** 用户代理 */
  userAgent?: string
}

/**
 * SPARQL 查询结果
 */
interface SparqlResult {
  head: { vars: string[] }
  results: {
    bindings: Array<
      Record<
        string,
        {
          type: 'uri' | 'literal' | 'bnode'
          value: string
          'xml:lang'?: string
          datatype?: string
        }
      >
    >
  }
}

/**
 * Wikidata API 搜索结果
 */
interface WikidataSearchResponse {
  searchinfo?: { search: string }
  search?: Array<{
    id: string
    title: string
    label: string
    description?: string
    match: { type: string; text: string }
  }>
  success?: number
}

// ==================== WikidataBackend 实现 ====================

export class WikidataBackend extends SparqlKnowledgeBackend {
  readonly type = 'wikidata' as const
  readonly name = 'Wikidata Knowledge Base'

  /** 默认 SPARQL 端点 */
  private static readonly DEFAULT_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

  /** 默认 API 端点 */
  private static readonly DEFAULT_API_ENDPOINT = 'https://www.wikidata.org/w/api.php'

  /** 缓存 */
  private cache: Map<string, { data: unknown; expiry: number }> = new Map()

  /** 统计信息 */
  private stats = {
    totalQueries: 0,
    totalTime: 0,
    cacheHits: 0
  }

  constructor(config: WikidataConfig) {
    super({
      ...config,
      endpoint: config.endpoint || WikidataBackend.DEFAULT_SPARQL_ENDPOINT
    })
  }

  // ==================== 生命周期方法 ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('WikidataBackend already initialized')
      return
    }

    try {
      // 验证连接
      const status = await this.checkConnection()
      if (!status.connected) {
        throw new Error(`Failed to connect to Wikidata: ${status.error}`)
      }

      this.initialized = true
      logger.info('WikidataBackend initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize WikidataBackend', error as Error)
      throw error
    }
  }

  async close(): Promise<void> {
    this.cache.clear()
    this.initialized = false
    logger.info('WikidataBackend closed')
  }

  async checkConnection(): Promise<BackendStatus> {
    const status: BackendStatus = {
      connected: false,
      healthy: false,
      lastCheck: new Date()
    }

    try {
      // 执行简单查询测试连接
      const testQuery = 'SELECT ?item WHERE { ?item wdt:P31 wd:Q5 } LIMIT 1'
      await this.executeSparql(testQuery)

      status.connected = true
      status.healthy = true
      status.version = 'Wikidata SPARQL'
      status.stats = {
        totalQueries: this.stats.totalQueries,
        avgResponseTime: this.stats.totalQueries > 0 ? this.stats.totalTime / this.stats.totalQueries : 0,
        cacheHitRate: this.stats.totalQueries > 0 ? this.stats.cacheHits / this.stats.totalQueries : 0
      }
    } catch (error) {
      status.error = String(error)
    }

    return status
  }

  // ==================== 搜索方法 ====================

  async search(query: string, options?: ExternalSearchOptions): Promise<ExternalSearchResult[]> {
    const language = options?.language || (this.config as WikidataConfig).language || 'en'
    const limit = options?.limit || 10

    try {
      const entities = await this.searchEntities(query, language, limit)

      return entities.map((entity, index) => ({
        id: entity.qid,
        title: entity.label,
        content: entity.description || '',
        score: 1.0 - index * 0.05,
        sourceType: 'wikidata' as const,
        rawData: options?.includeRawData ? entity : undefined,
        metadata: {
          qid: entity.qid,
          aliases: entity.aliases
        }
      }))
    } catch (error) {
      logger.error('Wikidata search failed', error as Error)
      throw error
    }
  }

  async getEntity(id: string): Promise<ExternalSearchResult | null> {
    try {
      const entity = await this.getWikidataEntity(id)

      if (!entity) {
        return null
      }

      return {
        id: entity.qid,
        title: entity.label,
        content: entity.description || '',
        score: 1.0,
        sourceType: 'wikidata',
        metadata: {
          qid: entity.qid,
          aliases: entity.aliases,
          claims: entity.claims,
          sitelinks: entity.sitelinks
        }
      }
    } catch (error) {
      logger.error('Wikidata getEntity failed', error as Error)
      throw error
    }
  }

  // ==================== SPARQL 特定方法 ====================

  async executeSparql(sparql: string): Promise<unknown> {
    const cacheKey = `sparql:${sparql}`
    const cached = this.getFromCache(cacheKey)
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    const startTime = Date.now()

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/sparql-results+json',
          'User-Agent': (this.config as WikidataConfig).userAgent || 'CherryStudio/1.0'
        },
        body: `query=${encodeURIComponent(sparql)}`
      })

      if (!response.ok) {
        throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as SparqlResult

      this.updateStats(Date.now() - startTime)
      this.setToCache(cacheKey, result)

      return result.results.bindings
    } catch (error) {
      logger.error('SPARQL execution failed', { sparql, error: error as Error })
      throw error
    }
  }

  async getWikidataEntity(qid: string): Promise<WikidataEntity | null> {
    // 规范化 QID
    const normalizedQid = qid.toUpperCase().startsWith('Q') ? qid.toUpperCase() : `Q${qid}`

    const cacheKey = `entity:${normalizedQid}`
    const cached = this.getFromCache(cacheKey) as WikidataEntity | undefined
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    const language = (this.config as WikidataConfig).language || 'en'

    try {
      const url = new URL(WikidataBackend.DEFAULT_API_ENDPOINT)
      url.searchParams.set('action', 'wbgetentities')
      url.searchParams.set('ids', normalizedQid)
      url.searchParams.set('languages', language)
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': (this.config as WikidataConfig).userAgent || 'CherryStudio/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Wikidata API failed: ${response.status}`)
      }

      const data = (await response.json()) as {
        entities?: Record<
          string,
          {
            labels?: Record<string, { value: string }>
            descriptions?: Record<string, { value: string }>
            aliases?: Record<string, Array<{ value: string }>>
            claims?: Record<string, unknown[]>
            sitelinks?: Record<string, { title: string }>
          }
        >
      }

      const entityData = data.entities?.[normalizedQid]
      if (!entityData) {
        return null
      }

      const entity: WikidataEntity = {
        qid: normalizedQid,
        label: entityData.labels?.[language]?.value || normalizedQid,
        description: entityData.descriptions?.[language]?.value,
        aliases: entityData.aliases?.[language]?.map((a) => a.value),
        claims: entityData.claims,
        sitelinks: entityData.sitelinks
          ? Object.fromEntries(Object.entries(entityData.sitelinks).map(([k, v]) => [k, v.title]))
          : undefined
      }

      this.setToCache(cacheKey, entity)
      return entity
    } catch (error) {
      logger.error('getWikidataEntity failed', { qid: normalizedQid, error: error as Error })
      throw error
    }
  }

  async searchEntities(query: string, language?: string, limit?: number): Promise<WikidataEntity[]> {
    const lang = language || (this.config as WikidataConfig).language || 'en'
    const maxResults = limit || 10

    const cacheKey = `search:${lang}:${query}:${maxResults}`
    const cached = this.getFromCache(cacheKey) as WikidataEntity[] | undefined
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    const startTime = Date.now()

    try {
      const url = new URL(WikidataBackend.DEFAULT_API_ENDPOINT)
      url.searchParams.set('action', 'wbsearchentities')
      url.searchParams.set('search', query)
      url.searchParams.set('language', lang)
      url.searchParams.set('limit', String(maxResults))
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': (this.config as WikidataConfig).userAgent || 'CherryStudio/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Wikidata search failed: ${response.status}`)
      }

      const data = (await response.json()) as WikidataSearchResponse

      const entities: WikidataEntity[] =
        data.search?.map((item) => ({
          qid: item.id,
          label: item.label,
          description: item.description
        })) || []

      this.updateStats(Date.now() - startTime)
      this.setToCache(cacheKey, entities)

      return entities
    } catch (error) {
      logger.error('searchEntities failed', { query, error: error as Error })
      throw error
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取实体的属性值
   * @param qid 实体 QID
   * @param propertyId 属性 ID (如 P31 = instance of)
   */
  async getPropertyValue(qid: string, propertyId: string): Promise<unknown[]> {
    const sparql = `
      SELECT ?value ?valueLabel WHERE {
        wd:${qid} wdt:${propertyId} ?value.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${(this.config as WikidataConfig).language || 'en'}". }
      }
    `

    const results = (await this.executeSparql(sparql)) as Array<{
      value: { value: string }
      valueLabel?: { value: string }
    }>

    return results.map((r) => ({
      id: r.value.value.split('/').pop(),
      label: r.valueLabel?.value
    }))
  }

  /**
   * 查找具有特定属性值的实体
   * @param propertyId 属性 ID
   * @param value 属性值 (QID 或字面量)
   * @param limit 返回数量
   */
  async findEntitiesByProperty(propertyId: string, value: string, limit: number = 10): Promise<WikidataEntity[]> {
    const valueExpr = value.startsWith('Q') ? `wd:${value}` : `"${value}"`

    const sparql = `
      SELECT ?item ?itemLabel ?itemDescription WHERE {
        ?item wdt:${propertyId} ${valueExpr}.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${(this.config as WikidataConfig).language || 'en'}". }
      }
      LIMIT ${limit}
    `

    const results = (await this.executeSparql(sparql)) as Array<{
      item: { value: string }
      itemLabel?: { value: string }
      itemDescription?: { value: string }
    }>

    return results.map((r) => ({
      qid: r.item.value.split('/').pop() || '',
      label: r.itemLabel?.value || '',
      description: r.itemDescription?.value
    }))
  }

  // ==================== 缓存方法 ====================

  private getFromCache(key: string): unknown | undefined {
    if (!(this.config as WikidataConfig).cacheEnabled) {
      return undefined
    }

    const cached = this.cache.get(key)
    if (!cached) {
      return undefined
    }

    if (Date.now() > cached.expiry) {
      this.cache.delete(key)
      return undefined
    }

    return cached.data
  }

  private setToCache(key: string, data: unknown): void {
    if (!(this.config as WikidataConfig).cacheEnabled) {
      return
    }

    const ttl = ((this.config as WikidataConfig).cacheTTL || 3600) * 1000
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    })
  }

  private updateStats(responseTime: number): void {
    this.stats.totalQueries++
    this.stats.totalTime += responseTime
  }
}

// ==================== 导出 ====================

let backendInstance: WikidataBackend | null = null

export function getWikidataBackend(config?: WikidataConfig): WikidataBackend {
  if (!backendInstance && config) {
    backendInstance = new WikidataBackend(config)
  }

  if (!backendInstance) {
    throw new Error('WikidataBackend not configured')
  }

  return backendInstance
}

export function resetWikidataBackend(): void {
  if (backendInstance) {
    backendInstance.close().catch((e) => logger.error('Failed to close WikidataBackend', e as Error))
    backendInstance = null
  }
}
