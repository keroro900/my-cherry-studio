/**
 * Neo4jBackend - Neo4j 知识图谱后端
 *
 * 提供 Neo4j 图数据库的查询能力：
 * - Cypher 查询执行
 * - 图遍历
 * - 实体搜索
 * - 关系发现
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import type {
  BackendConnectionConfig,
  BackendStatus,
  ExternalSearchOptions,
  ExternalSearchResult,
  GraphNode,
  GraphRelation,
  GraphTraversalResult
} from './ExternalKnowledgeBackend'
import { GraphKnowledgeBackend } from './ExternalKnowledgeBackend'

const logger = loggerService.withContext('Neo4jBackend')

// ==================== 类型定义 ====================

/**
 * Neo4j 连接配置
 */
export interface Neo4jConfig extends BackendConnectionConfig {
  /** 数据库名 */
  database?: string
  /** 是否加密连接 */
  encrypted?: boolean
}

/**
 * Neo4j 查询结果
 */
interface Neo4jQueryResult {
  records: Array<{
    keys: string[]
    get: (key: string) => unknown
    toObject: () => Record<string, unknown>
  }>
  summary: {
    counters: {
      nodesCreated: () => number
      nodesDeleted: () => number
      relationshipsCreated: () => number
      relationshipsDeleted: () => number
    }
    resultAvailableAfter: { toNumber: () => number }
    resultConsumedAfter: { toNumber: () => number }
  }
}

// ==================== Neo4jBackend 实现 ====================

export class Neo4jBackend extends GraphKnowledgeBackend {
  readonly type = 'neo4j' as const
  readonly name = 'Neo4j Knowledge Graph'

  private driver: unknown = null
  private session: unknown = null
  // neo4j-driver is optional, dynamically imported
  private neo4jModule: unknown = null

  /** 统计信息 */
  private stats = {
    totalQueries: 0,
    totalTime: 0
  }

  constructor(config: Neo4jConfig) {
    super(config)
  }

  // ==================== 生命周期方法 ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Neo4jBackend already initialized')
      return
    }

    try {
      // 动态导入 neo4j-driver (可选依赖)
      // @ts-expect-error - neo4j-driver is optional, may not be installed
      this.neo4jModule = await import('neo4j-driver')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const neo4j = (this.neo4jModule as any).default || this.neo4jModule

      // 构建认证
      let auth
      if (this.config.auth?.username && this.config.auth?.password) {
        auth = neo4j.auth.basic(this.config.auth.username, this.config.auth.password)
      }

      // 创建驱动
      this.driver = neo4j.driver(this.config.endpoint, auth, {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: this.config.timeout || 30000,
        encrypted: (this.config as Neo4jConfig).encrypted ?? false
      })

      // 验证连接
      await (this.driver as { verifyConnectivity: () => Promise<void> }).verifyConnectivity()

      this.initialized = true
      logger.info('Neo4jBackend initialized successfully', { endpoint: this.config.endpoint })
    } catch (error) {
      logger.error('Failed to initialize Neo4jBackend', error as Error)
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.session) {
      await (this.session as { close: () => Promise<void> }).close()
      this.session = null
    }

    if (this.driver) {
      await (this.driver as { close: () => Promise<void> }).close()
      this.driver = null
    }

    this.initialized = false
    logger.info('Neo4jBackend closed')
  }

  async checkConnection(): Promise<BackendStatus> {
    const status: BackendStatus = {
      connected: false,
      healthy: false,
      lastCheck: new Date()
    }

    try {
      if (!this.driver) {
        status.error = 'Driver not initialized'
        return status
      }

      await (this.driver as { verifyConnectivity: () => Promise<void> }).verifyConnectivity()

      // 获取版本信息
      const session = this.getSession()
      const result = await this.runQuery(session, 'CALL dbms.components() YIELD name, versions RETURN name, versions')
      if (result.records.length > 0) {
        const record = result.records[0]
        status.version = String((record.toObject() as { versions: string[] }).versions?.[0] || 'unknown')
      }

      status.connected = true
      status.healthy = true
      status.stats = {
        totalQueries: this.stats.totalQueries,
        avgResponseTime: this.stats.totalQueries > 0 ? this.stats.totalTime / this.stats.totalQueries : 0
      }
    } catch (error) {
      status.error = String(error)
    }

    return status
  }

  // ==================== 搜索方法 ====================

  async search(query: string, options?: ExternalSearchOptions): Promise<ExternalSearchResult[]> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const limit = options?.limit || 10
    const session = this.getSession()

    try {
      // 使用全文索引搜索 (如果可用) 或基本模糊匹配
      const cypher = `
        MATCH (n)
        WHERE any(prop in keys(n) WHERE toString(n[prop]) CONTAINS $query)
        RETURN n, labels(n) as labels
        LIMIT $limit
      `

      const startTime = Date.now()
      const result = await this.runQuery(session, cypher, { query, limit })
      this.updateStats(Date.now() - startTime)

      return result.records.map((record, index) => {
        const node = record.get('n') as { identity: { toNumber: () => number }; properties: Record<string, unknown> }
        const labels = record.get('labels') as string[]

        return {
          id: String(node.identity.toNumber()),
          title: String(node.properties.name || node.properties.title || `Node ${index + 1}`),
          content: JSON.stringify(node.properties),
          score: 1.0 - index * 0.1,
          sourceType: 'neo4j' as const,
          rawData: options?.includeRawData ? record.toObject() : undefined,
          metadata: {
            labels,
            properties: node.properties
          }
        }
      })
    } catch (error) {
      logger.error('Neo4j search failed', error as Error)
      throw error
    }
  }

  async getEntity(id: string): Promise<ExternalSearchResult | null> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const session = this.getSession()

    try {
      const cypher = `
        MATCH (n)
        WHERE id(n) = $id
        RETURN n, labels(n) as labels
      `

      const result = await this.runQuery(session, cypher, { id: parseInt(id) })

      if (result.records.length === 0) {
        return null
      }

      const record = result.records[0]
      const node = record.get('n') as { identity: { toNumber: () => number }; properties: Record<string, unknown> }
      const labels = record.get('labels') as string[]

      return {
        id: String(node.identity.toNumber()),
        title: String(node.properties.name || node.properties.title || `Node ${id}`),
        content: JSON.stringify(node.properties),
        score: 1.0,
        sourceType: 'neo4j',
        metadata: { labels, properties: node.properties }
      }
    } catch (error) {
      logger.error('Neo4j getEntity failed', error as Error)
      throw error
    }
  }

  // ==================== 图谱特定方法 ====================

  async executeCypher(cypher: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const session = this.getSession()
    const startTime = Date.now()

    try {
      const result = await this.runQuery(session, cypher, params)
      this.updateStats(Date.now() - startTime)

      return result.records.map((r) => r.toObject())
    } catch (error) {
      logger.error('Cypher execution failed', { cypher, error: error as Error })
      throw error
    }
  }

  async traverseRelations(nodeId: string, depth: number = 2, relationTypes?: string[]): Promise<GraphTraversalResult> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const session = this.getSession()

    try {
      // 构建关系类型过滤
      const relFilter = relationTypes?.length ? `:${relationTypes.join('|')}` : ''

      const cypher = `
        MATCH path = (start)-[r${relFilter}*1..${depth}]-(end)
        WHERE id(start) = $nodeId
        WITH nodes(path) as nodes, relationships(path) as rels
        UNWIND nodes as n
        WITH collect(DISTINCT n) as allNodes, rels
        UNWIND rels as r
        RETURN allNodes, collect(DISTINCT r) as allRels
      `

      const result = await this.runQuery(session, cypher, { nodeId: parseInt(nodeId) })

      if (result.records.length === 0) {
        return { nodes: [], relations: [] }
      }

      const record = result.records[0]
      const nodes = (
        record.get('allNodes') as Array<{
          identity: { toNumber: () => number }
          labels: string[]
          properties: Record<string, unknown>
        }>
      ).map((n) => ({
        id: String(n.identity.toNumber()),
        labels: n.labels,
        properties: n.properties
      }))

      const relations = (
        record.get('allRels') as Array<{
          identity: { toNumber: () => number }
          type: string
          start: { toNumber: () => number }
          end: { toNumber: () => number }
          properties: Record<string, unknown>
        }>
      ).map((r) => ({
        id: String(r.identity.toNumber()),
        type: r.type,
        startNodeId: String(r.start.toNumber()),
        endNodeId: String(r.end.toNumber()),
        properties: r.properties
      }))

      return { nodes, relations }
    } catch (error) {
      logger.error('Neo4j traverseRelations failed', error as Error)
      throw error
    }
  }

  async getNode(nodeId: string): Promise<GraphNode | null> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const session = this.getSession()

    try {
      const cypher = `
        MATCH (n)
        WHERE id(n) = $nodeId
        RETURN n, labels(n) as labels
      `

      const result = await this.runQuery(session, cypher, { nodeId: parseInt(nodeId) })

      if (result.records.length === 0) {
        return null
      }

      const record = result.records[0]
      const node = record.get('n') as { identity: { toNumber: () => number }; properties: Record<string, unknown> }
      const labels = record.get('labels') as string[]

      return {
        id: String(node.identity.toNumber()),
        labels,
        properties: node.properties
      }
    } catch (error) {
      logger.error('Neo4j getNode failed', error as Error)
      throw error
    }
  }

  async getNodeRelations(
    nodeId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<GraphRelation[]> {
    if (!this.initialized) {
      throw new Error('Neo4jBackend not initialized')
    }

    const session = this.getSession()

    try {
      let cypher: string

      switch (direction) {
        case 'incoming':
          cypher = `
            MATCH (n)<-[r]-(m)
            WHERE id(n) = $nodeId
            RETURN r, id(startNode(r)) as startId, id(endNode(r)) as endId
          `
          break
        case 'outgoing':
          cypher = `
            MATCH (n)-[r]->(m)
            WHERE id(n) = $nodeId
            RETURN r, id(startNode(r)) as startId, id(endNode(r)) as endId
          `
          break
        default:
          cypher = `
            MATCH (n)-[r]-(m)
            WHERE id(n) = $nodeId
            RETURN r, id(startNode(r)) as startId, id(endNode(r)) as endId
          `
      }

      const result = await this.runQuery(session, cypher, { nodeId: parseInt(nodeId) })

      return result.records.map((record) => {
        const rel = record.get('r') as {
          identity: { toNumber: () => number }
          type: string
          properties: Record<string, unknown>
        }

        return {
          id: String(rel.identity.toNumber()),
          type: rel.type,
          startNodeId: String((record.get('startId') as { toNumber: () => number }).toNumber()),
          endNodeId: String((record.get('endId') as { toNumber: () => number }).toNumber()),
          properties: rel.properties
        }
      })
    } catch (error) {
      logger.error('Neo4j getNodeRelations failed', error as Error)
      throw error
    }
  }

  // ==================== 辅助方法 ====================

  private getSession(): unknown {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized')
    }

    const database = (this.config as Neo4jConfig).database

    return (this.driver as { session: (opts?: { database?: string }) => unknown }).session(
      database ? { database } : undefined
    )
  }

  private async runQuery(
    session: unknown,
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<Neo4jQueryResult> {
    try {
      const result = await (
        session as { run: (q: string, p?: Record<string, unknown>) => Promise<Neo4jQueryResult> }
      ).run(cypher, params)
      return result
    } finally {
      await (session as { close: () => Promise<void> }).close()
    }
  }

  private updateStats(responseTime: number): void {
    this.stats.totalQueries++
    this.stats.totalTime += responseTime
  }
}

// ==================== 导出 ====================

let backendInstance: Neo4jBackend | null = null

export function getNeo4jBackend(config?: Neo4jConfig): Neo4jBackend {
  if (!backendInstance && config) {
    backendInstance = new Neo4jBackend(config)
  }

  if (!backendInstance) {
    throw new Error('Neo4jBackend not configured')
  }

  return backendInstance
}

export function resetNeo4jBackend(): void {
  if (backendInstance) {
    backendInstance.close().catch((e) => logger.error('Failed to close Neo4jBackend', e as Error))
    backendInstance = null
  }
}
