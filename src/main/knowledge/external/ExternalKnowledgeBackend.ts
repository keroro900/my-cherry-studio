/**
 * ExternalKnowledgeBackend - 外部知识后端抽象接口
 *
 * 定义外部知识源的统一接口：
 * - Neo4j 知识图谱
 * - Wikidata/DBpedia SPARQL
 * - Elasticsearch 全文搜索
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('ExternalKnowledgeBackend')

// ==================== 类型定义 ====================

/**
 * 外部知识源类型
 */
export type ExternalSourceType = 'neo4j' | 'wikidata' | 'elasticsearch'

/**
 * 搜索结果
 */
export interface ExternalSearchResult {
  /** 结果 ID */
  id: string
  /** 标题/名称 */
  title: string
  /** 内容/描述 */
  content: string
  /** 相关性得分 */
  score: number
  /** 来源类型 */
  sourceType: ExternalSourceType
  /** 原始数据 */
  rawData?: unknown
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 图节点 (用于 Neo4j)
 */
export interface GraphNode {
  /** 节点 ID */
  id: string
  /** 标签 */
  labels: string[]
  /** 属性 */
  properties: Record<string, unknown>
}

/**
 * 图关系 (用于 Neo4j)
 */
export interface GraphRelation {
  /** 关系 ID */
  id: string
  /** 关系类型 */
  type: string
  /** 起始节点 ID */
  startNodeId: string
  /** 结束节点 ID */
  endNodeId: string
  /** 属性 */
  properties: Record<string, unknown>
}

/**
 * 图遍历结果
 */
export interface GraphTraversalResult {
  nodes: GraphNode[]
  relations: GraphRelation[]
}

/**
 * 实体信息 (用于 Wikidata)
 */
export interface WikidataEntity {
  /** QID (如 Q42) */
  qid: string
  /** 标签 */
  label: string
  /** 描述 */
  description?: string
  /** 别名 */
  aliases?: string[]
  /** 属性声明 */
  claims?: Record<string, unknown[]>
  /** 站点链接 */
  sitelinks?: Record<string, string>
}

/**
 * 搜索选项
 */
export interface ExternalSearchOptions {
  /** 返回数量限制 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 语言 */
  language?: string
  /** 过滤条件 */
  filters?: Record<string, unknown>
  /** 是否包含原始数据 */
  includeRawData?: boolean
  /** 超时 (毫秒) */
  timeout?: number
}

/**
 * 后端连接配置
 */
export interface BackendConnectionConfig {
  /** 端点 URL */
  endpoint: string
  /** 认证信息 */
  auth?: {
    type: 'basic' | 'apikey' | 'bearer'
    username?: string
    password?: string
    apiKey?: string
    token?: string
  }
  /** 超时设置 (毫秒) */
  timeout?: number
  /** 重试次数 */
  retries?: number
  /** 是否启用缓存 */
  cacheEnabled?: boolean
  /** 缓存 TTL (秒) */
  cacheTTL?: number
}

/**
 * 后端状态
 */
export interface BackendStatus {
  /** 是否已连接 */
  connected: boolean
  /** 是否健康 */
  healthy: boolean
  /** 最后检查时间 */
  lastCheck: Date
  /** 版本信息 */
  version?: string
  /** 错误信息 */
  error?: string
  /** 统计信息 */
  stats?: {
    totalQueries: number
    avgResponseTime: number
    cacheHitRate?: number
  }
}

// ==================== 抽象接口 ====================

/**
 * 外部知识后端抽象接口
 */
export abstract class ExternalKnowledgeBackend {
  /** 后端类型 */
  abstract readonly type: ExternalSourceType

  /** 后端名称 */
  abstract readonly name: string

  /** 连接配置 */
  protected config: BackendConnectionConfig

  /** 是否已初始化 */
  protected initialized: boolean = false

  constructor(config: BackendConnectionConfig) {
    this.config = config
  }

  // ==================== 生命周期方法 ====================

  /**
   * 初始化后端
   */
  abstract initialize(): Promise<void>

  /**
   * 关闭后端连接
   */
  abstract close(): Promise<void>

  /**
   * 检查连接状态
   */
  abstract checkConnection(): Promise<BackendStatus>

  // ==================== 搜索方法 ====================

  /**
   * 搜索
   * @param query 查询字符串
   * @param options 搜索选项
   */
  abstract search(query: string, options?: ExternalSearchOptions): Promise<ExternalSearchResult[]>

  /**
   * 获取单个实体
   * @param id 实体 ID
   */
  abstract getEntity(id: string): Promise<ExternalSearchResult | null>

  // ==================== 辅助方法 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BackendConnectionConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info(`${this.name} config updated`)
  }

  /**
   * 获取当前配置
   */
  getConfig(): BackendConnectionConfig {
    return { ...this.config }
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 构建请求头
   */
  protected buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'basic':
          if (this.config.auth.username && this.config.auth.password) {
            const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString(
              'base64'
            )
            headers['Authorization'] = `Basic ${credentials}`
          }
          break
        case 'apikey':
          if (this.config.auth.apiKey) {
            headers['X-API-Key'] = this.config.auth.apiKey
          }
          break
        case 'bearer':
          if (this.config.auth.token) {
            headers['Authorization'] = `Bearer ${this.config.auth.token}`
          }
          break
      }
    }

    return headers
  }
}

// ==================== 图谱后端扩展接口 ====================

/**
 * 图谱后端接口 (用于 Neo4j)
 */
export abstract class GraphKnowledgeBackend extends ExternalKnowledgeBackend {
  /**
   * 执行 Cypher 查询
   * @param cypher Cypher 查询语句
   * @param params 参数
   */
  abstract executeCypher(cypher: string, params?: Record<string, unknown>): Promise<unknown>

  /**
   * 图遍历
   * @param nodeId 起始节点 ID
   * @param depth 遍历深度
   * @param relationTypes 关系类型过滤
   */
  abstract traverseRelations(nodeId: string, depth?: number, relationTypes?: string[]): Promise<GraphTraversalResult>

  /**
   * 获取节点
   * @param nodeId 节点 ID
   */
  abstract getNode(nodeId: string): Promise<GraphNode | null>

  /**
   * 获取节点的关系
   * @param nodeId 节点 ID
   * @param direction 关系方向
   */
  abstract getNodeRelations(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<GraphRelation[]>
}

// ==================== SPARQL 后端扩展接口 ====================

/**
 * SPARQL 后端接口 (用于 Wikidata)
 */
export abstract class SparqlKnowledgeBackend extends ExternalKnowledgeBackend {
  /**
   * 执行 SPARQL 查询
   * @param sparql SPARQL 查询语句
   */
  abstract executeSparql(sparql: string): Promise<unknown>

  /**
   * 获取 Wikidata 实体
   * @param qid 实体 QID (如 Q42)
   */
  abstract getWikidataEntity(qid: string): Promise<WikidataEntity | null>

  /**
   * 搜索实体
   * @param query 搜索关键词
   * @param language 语言代码
   * @param limit 返回数量
   */
  abstract searchEntities(query: string, language?: string, limit?: number): Promise<WikidataEntity[]>
}

// ==================== 全文搜索后端扩展接口 ====================

/**
 * 全文搜索后端接口 (用于 Elasticsearch)
 */
export abstract class FulltextKnowledgeBackend extends ExternalKnowledgeBackend {
  /**
   * 执行 DSL 查询
   * @param dsl Elasticsearch DSL 查询
   * @param index 索引名
   */
  abstract executeDsl(dsl: Record<string, unknown>, index?: string): Promise<unknown>

  /**
   * 多字段搜索
   * @param query 查询字符串
   * @param fields 搜索字段
   * @param options 选项
   */
  abstract multiFieldSearch(
    query: string,
    fields?: string[],
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult[]>

  /**
   * 获取索引信息
   * @param index 索引名
   */
  abstract getIndexInfo(index?: string): Promise<{
    name: string
    docCount: number
    sizeBytes: number
    mappings?: Record<string, unknown>
  }>

  /**
   * 检查索引是否存在
   * @param index 索引名
   */
  abstract indexExists(index: string): Promise<boolean>
}

// ==================== 导出 ====================

// 注意：logger 不再导出，每个后端应创建自己的 logger 实例以获得更好的日志上下文
