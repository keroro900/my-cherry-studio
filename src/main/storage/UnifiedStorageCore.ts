/**
 * 统一存储核心 - 参照 VCPToolBox KnowledgeBaseManager
 *
 * 核心职责:
 * 1. 单 SQLite 数据库 (统一 schema)
 * 2. VexusAdapter 向量索引
 * 3. TagMemo 共现矩阵 (单例)
 * 4. 依赖注入接口 (VCP 风格)
 *
 * @module storage/UnifiedStorageCore
 */

import type { Client } from '@libsql/client'
import { createClient } from '@libsql/client'
import { loggerService } from '@logger'
import { DATA_PATH } from '@main/config'
import Embeddings from '@main/knowledge/embedjs/embeddings/Embeddings'
import { getTagMemoService, type TagMemoService } from '@main/knowledge/tagmemo'
import {
  CharacterIndexManager,
  createVexusAdapter,
  type VexusAdapter
} from '@main/knowledge/vector/VexusAdapter'
import { makeSureDirExists } from '@main/utils'
import { getEmbeddingDimensions } from '@main/utils/EmbeddingDimensions'
import type { ApiClient } from '@types'
import crypto from 'crypto'
import path from 'path'

const logger = loggerService.withContext('UnifiedStorageCore')

// ==================== 类型定义 ====================

export interface UnifiedStorageConfig {
  /** 数据库路径 (相对于 DATA_PATH) */
  dbPath?: string
  /** 向量维度 */
  vectorDimensions?: number
  /** 向量索引容量 */
  vectorCapacity?: number
  /** 是否启用 TagMemo */
  enableTagMemo?: boolean
  /** Embedding API 客户端 */
  embedApiClient?: ApiClient
  /** Embedding 维度 */
  embeddingDimensions?: number
}

export interface ChunkData {
  id?: string
  content: string
  source: 'knowledge' | 'memory' | 'diary'
  fileId?: string
  embedding?: number[]
  tags?: string[]
  metadata?: Record<string, unknown>
  characterName?: string
  userId?: string
  agentId?: string
  /** embedjs Loader 唯一标识 */
  uniqueLoaderId?: string
  /** 来源类型: file|url|note|sitemap */
  loaderType?: string
}

export interface ChunkResult {
  id: string
  content: string
  source: 'knowledge' | 'memory' | 'diary'
  score: number
  fileId?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  characterName?: string
  /** 用户 ID */
  userId?: string
  /** Agent/Assistant ID (VCP 角色记忆隔离) */
  agentId?: string
  /** embedjs Loader 唯一标识 */
  uniqueLoaderId?: string
  /** 来源类型 */
  loaderType?: string
  /** 创建时间 */
  createdAt?: string
}

export interface SearchOptions {
  source?: 'knowledge' | 'memory' | 'diary' | 'all'
  knowledgeBaseId?: string
  characterName?: string
  userId?: string
  agentId?: string
  topK?: number
  threshold?: number
  enableTagBoost?: boolean
  /** 运行时 Embedding API 客户端 (优先于全局配置) */
  embedApiClient?: ApiClient
}

export interface FileData {
  id?: string
  path: string
  filename: string
  source: 'knowledge' | 'memory' | 'diary'
  metadata?: Record<string, unknown>
}

export interface FileResult {
  id: string
  path: string
  filename: string
  source: 'knowledge' | 'memory' | 'diary'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface TagData {
  name: string
  embedding?: number[]
  frequency?: number
}

export interface TagResult {
  id: string
  name: string
  embedding?: number[]
  frequency: number
}

/**
 * 统一存储依赖接口 (VCP 风格依赖注入)
 */
export interface UnifiedStorageDependencies {
  db: Client
  vectorIndex: VexusAdapter
  characterIndexManager: CharacterIndexManager
  tagMemo: TagMemoService
  getSingleEmbedding: (text: string) => Promise<number[]>
  applyTagBoost: (
    query: string,
    tags: string[],
    results: ChunkResult[]
  ) => Promise<ChunkResult[]>
}

// ==================== SQL 语句 ====================

const SQL = {
  // 表创建
  createTables: {
    files: `
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        filename TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('knowledge', 'memory', 'diary')),
        knowledge_base_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        metadata TEXT
      )
    `,
    chunks: `
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_id TEXT,
        content TEXT NOT NULL,
        embedding BLOB,
        source TEXT NOT NULL CHECK (source IN ('knowledge', 'memory', 'diary')),
        character_name TEXT,
        user_id TEXT,
        agent_id TEXT,
        knowledge_base_id TEXT,
        unique_loader_id TEXT,
        loader_type TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `,
    tags: `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        embedding BLOB,
        frequency INTEGER DEFAULT 0
      )
    `,
    chunkTags: `
      CREATE TABLE IF NOT EXISTS chunk_tags (
        chunk_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (chunk_id, tag_id),
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `,
    // 从 MemoryService 迁移的记忆表 (保持兼容)
    memories: `
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        agent_id TEXT,
        content TEXT NOT NULL,
        hash TEXT UNIQUE,
        embedding BLOB,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0,
        metadata TEXT
      )
    `,
    memoryHistory: `
      CREATE TABLE IF NOT EXISTS memory_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        previous_value TEXT,
        new_value TEXT,
        action TEXT NOT NULL CHECK (action IN ('ADD', 'UPDATE', 'DELETE')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      )
    `,
    // KV 存储 (通用配置)
    kvStore: `
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `
  },
  // 索引创建
  createIndexes: {
    filesSource: 'CREATE INDEX IF NOT EXISTS idx_files_source ON files(source)',
    filesKnowledgeBase: 'CREATE INDEX IF NOT EXISTS idx_files_kb ON files(knowledge_base_id)',
    chunksSource: 'CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source)',
    chunksFileId: 'CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id)',
    chunksCharacter: 'CREATE INDEX IF NOT EXISTS idx_chunks_character ON chunks(character_name)',
    chunksUser: 'CREATE INDEX IF NOT EXISTS idx_chunks_user ON chunks(user_id)',
    chunksKnowledgeBase: 'CREATE INDEX IF NOT EXISTS idx_chunks_kb ON chunks(knowledge_base_id)',
    chunksLoaderId: 'CREATE INDEX IF NOT EXISTS idx_chunks_loader_id ON chunks(unique_loader_id)',
    chunksKbLoader: 'CREATE INDEX IF NOT EXISTS idx_chunks_kb_loader ON chunks(knowledge_base_id, unique_loader_id)',
    tagsName: 'CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)',
    memoriesUser: 'CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)',
    memoriesAgent: 'CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id)',
    memoriesHash: 'CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(hash)',
    memoriesCreated: 'CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)'
  },
  // 数据操作
  chunks: {
    insert: `
      INSERT INTO chunks (id, file_id, content, embedding, source, character_name, user_id, agent_id, knowledge_base_id, unique_loader_id, loader_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    search: `
      SELECT id, file_id, content, source, character_name, user_id, agent_id, knowledge_base_id, unique_loader_id, loader_type, metadata, created_at, updated_at
      FROM chunks
      WHERE source = ? OR ? = 'all'
    `,
    getById: 'SELECT * FROM chunks WHERE id = ?',
    delete: 'DELETE FROM chunks WHERE id = ?',
    deleteByFileId: 'DELETE FROM chunks WHERE file_id = ?',
    deleteByKnowledgeBase: 'DELETE FROM chunks WHERE knowledge_base_id = ?',
    deleteByLoaderId: 'DELETE FROM chunks WHERE unique_loader_id = ? AND knowledge_base_id = ?',
    getByLoaderId: 'SELECT * FROM chunks WHERE unique_loader_id = ?',
    countByFilter: 'SELECT COUNT(*) as count FROM chunks WHERE 1=1',
    searchKnowledge: `
      SELECT id, file_id, content, source, character_name, knowledge_base_id, unique_loader_id, loader_type, metadata, created_at
      FROM chunks
      WHERE source = 'knowledge' AND knowledge_base_id = ?
    `
  },
  files: {
    insert: `
      INSERT INTO files (id, path, filename, source, knowledge_base_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    getById: 'SELECT * FROM files WHERE id = ?',
    getByPath: 'SELECT * FROM files WHERE path = ?',
    delete: 'DELETE FROM files WHERE id = ?',
    deleteByKnowledgeBase: 'DELETE FROM files WHERE knowledge_base_id = ?'
  },
  tags: {
    insert: 'INSERT OR IGNORE INTO tags (id, name, embedding, frequency) VALUES (?, ?, ?, ?)',
    updateFrequency: 'UPDATE tags SET frequency = frequency + 1 WHERE name = ?',
    getByName: 'SELECT * FROM tags WHERE name = ?',
    getAll: 'SELECT * FROM tags ORDER BY frequency DESC'
  },
  chunkTags: {
    insert: 'INSERT OR REPLACE INTO chunk_tags (chunk_id, tag_id, weight) VALUES (?, ?, ?)',
    getByChunk: `
      SELECT t.id, t.name, t.frequency, ct.weight
      FROM chunk_tags ct
      JOIN tags t ON ct.tag_id = t.id
      WHERE ct.chunk_id = ?
    `,
    getByTag: `
      SELECT c.id, c.content, c.source, ct.weight
      FROM chunk_tags ct
      JOIN chunks c ON ct.chunk_id = c.id
      WHERE ct.tag_id = ?
    `
  },
  kv: {
    get: 'SELECT value FROM kv_store WHERE key = ?',
    set: `
      INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `,
    delete: 'DELETE FROM kv_store WHERE key = ?'
  }
}

// ==================== UnifiedStorageCore 实现 ====================

/**
 * 统一存储核心
 *
 * 单例模式，提供:
 * - 统一 SQLite 数据库
 * - VexusAdapter 向量索引
 * - CharacterIndexManager 多角色索引
 * - TagMemo 共现矩阵集成
 * - VCP 风格依赖注入
 */
export class UnifiedStorageCore {
  private static instance: UnifiedStorageCore | null = null

  private db: Client | null = null
  private vectorIndex: VexusAdapter | null = null
  private vectorIndexPath: string | null = null // 主向量索引持久化路径
  private characterIndexManager: CharacterIndexManager | null = null
  private tagMemo: TagMemoService | null = null
  private embeddings: Embeddings | null = null

  private config: Required<UnifiedStorageConfig>
  private isInitialized = false

  private constructor() {
    this.config = {
      dbPath: 'unified.db',
      vectorDimensions: 1536,
      vectorCapacity: 100000,
      enableTagMemo: true,
      embedApiClient: undefined as unknown as ApiClient,
      embeddingDimensions: 1536
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): UnifiedStorageCore {
    if (!UnifiedStorageCore.instance) {
      UnifiedStorageCore.instance = new UnifiedStorageCore()
    }
    return UnifiedStorageCore.instance
  }

  /**
   * 重置单例 (仅用于测试)
   */
  public static reset(): void {
    if (UnifiedStorageCore.instance) {
      UnifiedStorageCore.instance.close()
      UnifiedStorageCore.instance = null
    }
  }

  /**
   * 初始化统一存储
   */
  public async initialize(config?: Partial<UnifiedStorageConfig>): Promise<void> {
    if (this.isInitialized) {
      logger.debug('UnifiedStorageCore already initialized')
      return
    }

    // 合并配置
    if (config) {
      this.config = { ...this.config, ...config }
    }

    try {
      // 1. 初始化数据库
      await this.initDatabase()

      // 2. 初始化向量索引
      await this.initVectorIndex()

      // 3. 初始化 TagMemo (单例)
      if (this.config.enableTagMemo) {
        this.tagMemo = getTagMemoService()
        logger.debug('TagMemo singleton connected')
      }

      // 4. 初始化 Embeddings (如果配置了)
      if (this.config.embedApiClient) {
        await this.initEmbeddings()
      }

      this.isInitialized = true
      logger.info('UnifiedStorageCore initialized successfully', {
        dbPath: this.config.dbPath,
        vectorDimensions: this.config.vectorDimensions,
        tagMemoEnabled: this.config.enableTagMemo
      })
    } catch (error) {
      logger.error('Failed to initialize UnifiedStorageCore', error as Error)
      throw error
    }
  }

  /**
   * 初始化数据库
   */
  private async initDatabase(): Promise<void> {
    const dbDir = path.join(DATA_PATH, 'UnifiedStorage')
    makeSureDirExists(dbDir)

    const dbPath = path.join(dbDir, this.config.dbPath)

    this.db = createClient({
      url: `file:${dbPath}`,
      intMode: 'number'
    })

    // 创建所有表
    for (const [name, sql] of Object.entries(SQL.createTables)) {
      try {
        await this.db.execute(sql)
        logger.debug(`Created table: ${name}`)
      } catch (error) {
        logger.error(`Failed to create table ${name}`, error as Error)
        throw error
      }
    }

    // 数据库迁移：为旧数据库添加缺失的列
    await this.runMigrations()

    // 创建索引
    for (const [name, sql] of Object.entries(SQL.createIndexes)) {
      try {
        await this.db.execute(sql)
      } catch (error) {
        logger.warn(`Failed to create index ${name}`, error as Error)
      }
    }

    logger.debug('Database initialized', { path: dbPath })
  }

  /**
   * 运行数据库迁移
   * 为旧数据库添加缺失的列
   */
  private async runMigrations(): Promise<void> {
    // 获取 chunks 表的列信息
    const columnsResult = await this.db!.execute('PRAGMA table_info(chunks)')
    const existingColumns = new Set(
      columnsResult.rows.map((row: Record<string, unknown>) => row.name as string)
    )

    // 定义需要检查的列
    const requiredColumns = [
      { name: 'unique_loader_id', type: 'TEXT' },
      { name: 'loader_type', type: 'TEXT' },
      { name: 'user_id', type: 'TEXT' },
      { name: 'agent_id', type: 'TEXT' },
      { name: 'knowledge_base_id', type: 'TEXT' }
    ]

    // 添加缺失的列
    for (const col of requiredColumns) {
      if (!existingColumns.has(col.name)) {
        try {
          await this.db!.execute(`ALTER TABLE chunks ADD COLUMN ${col.name} ${col.type}`)
          logger.info(`Migration: Added column '${col.name}' to chunks table`)
        } catch (error) {
          // 列可能已存在（竞态条件），忽略错误
          logger.debug(`Migration: Column '${col.name}' might already exist`, { error: String(error) })
        }
      }
    }
  }

  /**
   * 初始化向量索引
   */
  private async initVectorIndex(): Promise<void> {
    const indexDir = path.join(DATA_PATH, 'UnifiedStorage', 'vectors')
    makeSureDirExists(indexDir)

    // 主向量索引路径
    this.vectorIndexPath = path.join(indexDir, 'main.usearch')

    // 创建主向量索引
    this.vectorIndex = createVexusAdapter(
      this.config.vectorDimensions,
      this.config.vectorCapacity
    )

    // 尝试加载已有的主索引
    if (this.vectorIndex.isNativeMode()) {
      try {
        const { existsSync } = await import('fs')
        if (existsSync(this.vectorIndexPath)) {
          await this.vectorIndex.load(this.vectorIndexPath)
          const stats = await this.vectorIndex.stats()
          logger.info('Loaded existing main vector index', {
            path: this.vectorIndexPath,
            totalVectors: stats.totalVectors,
            dimensions: stats.dimensions
          })
        }
      } catch (error) {
        logger.warn('Failed to load existing main vector index, starting fresh', {
          error: (error as Error).message
        })
      }
    }

    // 创建多角色索引管理器
    this.characterIndexManager = new CharacterIndexManager(
      indexDir,
      this.config.vectorDimensions,
      this.config.vectorCapacity
    )

    logger.debug('Vector index initialized', {
      dimensions: this.config.vectorDimensions,
      capacity: this.config.vectorCapacity
    })
  }

  /**
   * 初始化 Embeddings
   */
  private async initEmbeddings(): Promise<void> {
    if (!this.config.embedApiClient) {
      return
    }

    this.embeddings = new Embeddings({
      embedApiClient: this.config.embedApiClient,
      dimensions: this.config.embeddingDimensions
    })

    await this.embeddings.init()
    logger.debug('Embeddings initialized')
  }

  /**
   * 设置 Embedding 配置 (运行时更新)
   * 如果不提供 dimensions，会自动从已知模型映射中获取
   *
   * @param embedApiClient - Embedding API 客户端
   * @param dimensions - 向量维度 (可选，自动检测)
   * @param reinitVectorIndex - 是否重新初始化向量索引 (默认 false)
   */
  public async setEmbeddingConfig(
    embedApiClient: ApiClient,
    dimensions?: number,
    reinitVectorIndex: boolean = false
  ): Promise<void> {
    this.config.embedApiClient = embedApiClient

    // 如果未提供维度，从模型名称自动检测
    const effectiveDimensions = dimensions || getEmbeddingDimensions(embedApiClient.model)
    this.config.embeddingDimensions = effectiveDimensions

    // 重新初始化 Embeddings
    this.embeddings = new Embeddings({
      embedApiClient: this.config.embedApiClient,
      dimensions: this.config.embeddingDimensions
    })
    await this.embeddings.init()

    // 如果需要重新初始化向量索引
    if (reinitVectorIndex) {
      await this.reinitVectorIndex(effectiveDimensions)
    }

    logger.debug('Embedding config updated', {
      model: embedApiClient.model,
      dimensions: this.config.embeddingDimensions,
      autoDetected: !dimensions,
      reinitVectorIndex
    })
  }

  /**
   * 重新初始化向量索引 (用于维度变更后)
   * 注意：这会清空当前索引，需要重新嵌入数据
   */
  public async reinitVectorIndex(newDimensions: number): Promise<void> {
    const indexDir = path.join(DATA_PATH, 'UnifiedStorage', 'vectors')
    makeSureDirExists(indexDir)

    // 更新配置中的维度
    this.config.vectorDimensions = newDimensions

    // 重新创建主向量索引
    this.vectorIndex = createVexusAdapter(
      newDimensions,
      this.config.vectorCapacity
    )

    // 重新创建多角色索引管理器
    this.characterIndexManager = new CharacterIndexManager(
      indexDir,
      newDimensions,
      this.config.vectorCapacity
    )

    logger.info('Vector index reinitialized with new dimensions', {
      dimensions: newDimensions,
      capacity: this.config.vectorCapacity
    })
  }

  /**
   * 保存向量索引到磁盘 (手动触发)
   * 用于定期保存防止崩溃时数据丢失
   */
  public async saveVectorIndex(): Promise<void> {
    if (!this.vectorIndex || !this.vectorIndexPath) {
      logger.debug('No vector index to save')
      return
    }

    if (!this.vectorIndex.isNativeMode()) {
      logger.debug('Skipping save: vector index is in mock mode')
      return
    }

    try {
      await this.vectorIndex.save(this.vectorIndexPath)
      const stats = await this.vectorIndex.stats()
      logger.info('Saved main vector index', {
        path: this.vectorIndexPath,
        totalVectors: stats.totalVectors
      })
    } catch (error) {
      logger.error('Failed to save main vector index', {
        error: (error as Error).message
      })
    }

    // 同时保存角色索引
    if (this.characterIndexManager) {
      await this.characterIndexManager.saveAll()
    }
  }

  // ==================== 核心操作 ====================

  /**
   * 生成单个 Embedding (带维度验证)
   */
  public async getSingleEmbedding(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error('Embeddings not initialized. Call setEmbeddingConfig first.')
    }
    const embedding = await this.embeddings.embedQuery(text)

    // 维度验证: 检测 API 返回的实际维度与配置的维度是否匹配
    const actualDimensions = embedding.length
    const expectedDimensions = this.config.vectorDimensions

    if (actualDimensions !== expectedDimensions) {
      const errorMsg = `Dimension mismatch: expected ${expectedDimensions}, got ${actualDimensions}. ` +
        `Your embedding provider may be using a different model. ` +
        `Configure vectorDimensions=${actualDimensions} or use a model that returns ${expectedDimensions} dimensions.`
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    return embedding
  }

  /**
   * 获取当前配置的向量维度
   */
  public getVectorDimensions(): number {
    return this.config.vectorDimensions
  }

  /**
   * 验证嵌入服务配置 (不实际插入数据)
   * 返回实际的嵌入维度，用于诊断配置问题
   */
  public async validateEmbeddingConfig(): Promise<{
    success: boolean
    actualDimensions: number
    expectedDimensions: number
    message: string
  }> {
    if (!this.embeddings) {
      return {
        success: false,
        actualDimensions: 0,
        expectedDimensions: this.config.vectorDimensions,
        message: 'Embeddings not initialized'
      }
    }

    try {
      // 使用简短的测试文本生成嵌入
      const testEmbedding = await this.embeddings.embedQuery('Test embedding dimensions')
      const actualDimensions = testEmbedding.length
      const expectedDimensions = this.config.vectorDimensions

      if (actualDimensions !== expectedDimensions) {
        return {
          success: false,
          actualDimensions,
          expectedDimensions,
          message: `Dimension mismatch: API returns ${actualDimensions} dimensions, but vector index is configured for ${expectedDimensions}. ` +
            `Either change the embedding model or rebuild the index with ${actualDimensions} dimensions.`
        }
      }

      return {
        success: true,
        actualDimensions,
        expectedDimensions,
        message: 'Embedding configuration is valid'
      }
    } catch (error) {
      return {
        success: false,
        actualDimensions: 0,
        expectedDimensions: this.config.vectorDimensions,
        message: `Embedding test failed: ${(error as Error).message}`
      }
    }
  }

  /**
   * 插入文本块
   */
  public async insertChunk(data: ChunkData): Promise<string> {
    this.ensureInitialized()

    const id = data.id || crypto.randomUUID()
    let embedding = data.embedding

    // 如果没有提供 embedding，尝试生成
    if (!embedding && this.embeddings) {
      try {
        embedding = await this.getSingleEmbedding(data.content)
      } catch (error) {
        logger.warn('Failed to generate embedding for chunk', error as Error)
      }
    }

    // 插入到数据库
    await this.db!.execute({
      sql: SQL.chunks.insert,
      args: [
        id,
        data.fileId || null,
        data.content,
        embedding ? this.embeddingToBlob(embedding) : null,
        data.source,
        data.characterName || null,
        data.userId || null,
        data.agentId || null,
        data.metadata?.knowledgeBaseId as string || null,
        data.uniqueLoaderId || null,
        data.loaderType || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    })

    // 插入到向量索引 (如果有 embedding)
    if (embedding) {
      if (data.characterName && this.characterIndexManager) {
        // 使用角色索引 (VexusAdapter 需要数组格式)
        await this.characterIndexManager.insertByCharacter(
          data.characterName,
          [embedding],
          [id]
        )
      } else if (this.vectorIndex) {
        // 使用主索引 (VexusAdapter 需要数组格式: vectors, ids)
        await this.vectorIndex.insert([embedding], [id])
      }
    }

    // 处理标签
    if (data.tags && data.tags.length > 0) {
      await this.addTagsToChunk(id, data.tags)
    }

    logger.debug('Chunk inserted', { id, source: data.source, hasEmbedding: !!embedding })
    return id
  }

  /**
   * 向量搜索
   * 支持按 source、userId、agentId、characterName 过滤
   * 支持运行时 embedApiClient 参数 (优先于全局配置)
   */
  public async searchChunks(
    query: string,
    options: SearchOptions = {}
  ): Promise<ChunkResult[]> {
    this.ensureInitialized()

    const {
      source = 'all',
      characterName,
      userId,
      agentId,
      topK = 10,
      threshold = 0.5,
      enableTagBoost = true,
      embedApiClient
    } = options

    // 如果传入了运行时 embedApiClient，临时设置
    let tempEmbeddings: Embeddings | null = null
    if (embedApiClient) {
      try {
        const dimensions = getEmbeddingDimensions(embedApiClient.model)
        tempEmbeddings = new Embeddings({
          embedApiClient,
          dimensions
        })
        await tempEmbeddings.init()
        logger.debug('Using runtime embedApiClient', {
          model: embedApiClient.model,
          dimensions
        })
      } catch (error) {
        logger.warn('Failed to initialize runtime embeddings, falling back to global config', error as Error)
      }
    }

    // 使用临时 embeddings 或全局 embeddings
    const activeEmbeddings = tempEmbeddings || this.embeddings

    // 生成查询向量
    let queryEmbedding: number[]
    try {
      if (!activeEmbeddings) {
        throw new Error('Embeddings not initialized. Call setEmbeddingConfig first or pass embedApiClient in options.')
      }
      queryEmbedding = await activeEmbeddings.embedQuery(query)
    } catch (error) {
      logger.error('Failed to generate query embedding', error as Error)
      // 降级到文本搜索
      return await this.textSearchChunks(query, options)
    }

    // 向量搜索
    let vectorResults: Array<{ id: string; score: number }> = []

    if (characterName && this.characterIndexManager) {
      // 角色特定搜索
      const results = await this.characterIndexManager.searchByCharacter(
        characterName,
        queryEmbedding,
        topK * 2 // 多取一些用于后续过滤
      )
      vectorResults = results.map(r => ({
        id: String(r.id),
        score: r.score
      }))
    } else if (this.vectorIndex) {
      // 主索引搜索
      const results = await this.vectorIndex.search(queryEmbedding, topK * 2)
      vectorResults = results.map(r => ({
        id: String(r.id),
        score: r.score
      }))
    }

    // 过滤低分结果
    vectorResults = vectorResults.filter(r => r.score >= threshold)

    if (vectorResults.length === 0) {
      return []
    }

    // 从数据库获取完整数据 (带 userId/agentId 过滤)
    const chunkIds = vectorResults.map(r => r.id)
    const chunks = await this.getChunksByIds(chunkIds, { userId, agentId })

    // 合并分数
    let results: ChunkResult[] = chunks.map(chunk => {
      const vectorResult = vectorResults.find(r => r.id === chunk.id)
      return {
        ...chunk,
        score: vectorResult?.score || 0
      }
    })

    // 按 source 过滤
    if (source !== 'all') {
      results = results.filter(r => r.source === source)
    }

    // 应用 TagMemo 增强
    if (enableTagBoost && this.tagMemo) {
      const queryTags = this.tagMemo.extractTagsFromQuery(query)
      if (queryTags.length > 0) {
        results = await this.applyTagBoost(query, queryTags, results)
        logger.debug('TagMemo boost applied', { queryTags, resultCount: results.length })
      }
    }

    // 排序并限制数量
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  /**
   * 带 TagMemo 增强的搜索 (直接调用)
   */
  public async searchWithTagBoost(
    query: string,
    options: SearchOptions = {}
  ): Promise<ChunkResult[]> {
    return this.searchChunks(query, { ...options, enableTagBoost: true })
  }

  /**
   * 文本搜索 (降级方案)
   */
  private async textSearchChunks(
    query: string,
    options: SearchOptions = {}
  ): Promise<ChunkResult[]> {
    const { source = 'all', userId, agentId, topK = 10 } = options
    const conditions: string[] = ['content LIKE ?']
    const args: (string | number)[] = [`%${query}%`]

    // 按 source 过滤
    if (source !== 'all') {
      conditions.push('source = ?')
      args.push(source)
    }

    // 按 userId 过滤
    if (userId) {
      conditions.push('user_id = ?')
      args.push(userId)
    }

    // 按 agentId 过滤
    if (agentId) {
      conditions.push('agent_id = ?')
      args.push(agentId)
    }

    args.push(topK)

    const result = await this.db!.execute({
      sql: `
        SELECT id, file_id, content, source, character_name, user_id, agent_id, metadata
        FROM chunks
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args
    })

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      content: row.content as string,
      source: row.source as 'knowledge' | 'memory' | 'diary',
      score: 0.5, // 文本搜索默认分数
      fileId: row.file_id as string | undefined,
      characterName: row.character_name as string | undefined,
      userId: row.user_id as string | undefined,
      agentId: row.agent_id as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    }))
  }

  /**
   * 根据 ID 列表获取 chunks
   * 支持按 userId/agentId 过滤
   */
  private async getChunksByIds(
    ids: string[],
    filter?: { userId?: string; agentId?: string }
  ): Promise<ChunkResult[]> {
    if (ids.length === 0) return []

    const placeholders = ids.map(() => '?').join(',')
    const conditions: string[] = [`id IN (${placeholders})`]
    const args: (string | null)[] = [...ids]

    // 按 userId 过滤
    if (filter?.userId) {
      conditions.push('user_id = ?')
      args.push(filter.userId)
    }

    // 按 agentId 过滤 (VCP 角色记忆隔离)
    if (filter?.agentId) {
      conditions.push('agent_id = ?')
      args.push(filter.agentId)
    }

    const result = await this.db!.execute({
      sql: `
        SELECT id, file_id, content, source, character_name, user_id, agent_id, metadata
        FROM chunks
        WHERE ${conditions.join(' AND ')}
      `,
      args
    })

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      content: row.content as string,
      source: row.source as 'knowledge' | 'memory' | 'diary',
      score: 0,
      fileId: row.file_id as string | undefined,
      characterName: row.character_name as string | undefined,
      userId: row.user_id as string | undefined,
      agentId: row.agent_id as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    }))
  }

  /**
   * 列出 chunks (不需要向量搜索)
   * 用于记忆列表等场景
   */
  public async listChunks(options: {
    source?: 'knowledge' | 'memory' | 'diary' | 'all'
    userId?: string
    agentId?: string
    limit?: number
    offset?: number
  } = {}): Promise<ChunkResult[]> {
    this.ensureInitialized()

    const { source = 'all', userId, agentId, limit = 100, offset = 0 } = options
    const conditions: string[] = []
    const args: (string | number)[] = []

    // 按 source 过滤
    if (source !== 'all') {
      conditions.push('source = ?')
      args.push(source)
    }

    // 按 userId 过滤
    if (userId) {
      conditions.push('user_id = ?')
      args.push(userId)
    }

    // 按 agentId 过滤
    if (agentId) {
      conditions.push('agent_id = ?')
      args.push(agentId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await this.db!.execute({
      sql: `
        SELECT id, file_id, content, source, character_name, user_id, agent_id, metadata, created_at
        FROM chunks
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limit, offset]
    })

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      content: row.content as string,
      source: row.source as 'knowledge' | 'memory' | 'diary',
      score: 1.0,
      fileId: row.file_id as string | undefined,
      characterName: row.character_name as string | undefined,
      userId: row.user_id as string | undefined,
      agentId: row.agent_id as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      createdAt: row.created_at as string | undefined
    }))
  }

  // ==================== 标签操作 ====================

  /**
   * 为 chunk 添加标签
   */
  public async addTagsToChunk(chunkId: string, tags: string[]): Promise<void> {
    this.ensureInitialized()

    for (const tagName of tags) {
      const normalizedTag = tagName.toLowerCase().trim()
      if (!normalizedTag) continue

      // 确保标签存在
      const tagId = crypto.randomUUID()
      await this.db!.execute({
        sql: SQL.tags.insert,
        args: [tagId, normalizedTag, null, 1]
      })

      // 更新频率 (如果已存在)
      await this.db!.execute({
        sql: SQL.tags.updateFrequency,
        args: [normalizedTag]
      })

      // 获取实际的 tag ID
      const tagResult = await this.db!.execute({
        sql: SQL.tags.getByName,
        args: [normalizedTag]
      })

      if (tagResult.rows.length > 0) {
        const actualTagId = (tagResult.rows[0] as Record<string, unknown>).id as string

        // 创建关联
        await this.db!.execute({
          sql: SQL.chunkTags.insert,
          args: [chunkId, actualTagId, 1.0]
        })
      }
    }

    // 更新 TagMemo 共现矩阵
    if (this.tagMemo && tags.length > 1) {
      const matrix = this.tagMemo.getCooccurrenceMatrix()
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          matrix.addRelation(tags[i], tags[j])
        }
      }
    }
  }

  /**
   * 获取 chunk 的标签
   */
  public async getTagsForChunk(chunkId: string): Promise<string[]> {
    this.ensureInitialized()

    const result = await this.db!.execute({
      sql: SQL.chunkTags.getByChunk,
      args: [chunkId]
    })

    return result.rows.map((row: Record<string, unknown>) => row.name as string)
  }

  /**
   * 应用 TagMemo 增强
   */
  private async applyTagBoost(
    query: string,
    tags: string[],
    results: ChunkResult[]
  ): Promise<ChunkResult[]> {
    if (!this.tagMemo || tags.length === 0 || results.length === 0) {
      return results
    }

    // 转换为 KnowledgeSearchResult 格式调用 TagMemo
    const searchResults = results.map(r => ({
      pageContent: r.content,
      score: r.score,
      metadata: r.metadata || {}
    }))

    const boostedResults = await this.tagMemo.applyTagBoost(query, tags, searchResults)

    // 合并回 ChunkResult
    return results.map((result, i) => ({
      ...result,
      score: boostedResults[i]?.score || result.score
    }))
  }

  // ==================== 文件操作 ====================

  /**
   * 插入文件记录
   */
  public async insertFile(data: FileData): Promise<string> {
    this.ensureInitialized()

    const id = data.id || crypto.randomUUID()

    await this.db!.execute({
      sql: SQL.files.insert,
      args: [
        id,
        data.path,
        data.filename,
        data.source,
        data.metadata?.knowledgeBaseId as string || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    })

    return id
  }

  /**
   * 删除文件及其 chunks
   */
  public async deleteFile(fileId: string): Promise<void> {
    this.ensureInitialized()

    await this.db!.execute({
      sql: SQL.chunks.deleteByFileId,
      args: [fileId]
    })

    await this.db!.execute({
      sql: SQL.files.delete,
      args: [fileId]
    })
  }

  // ==================== KV 存储 ====================

  /**
   * 获取 KV 值
   */
  public async kvGet<T = string>(key: string): Promise<T | null> {
    this.ensureInitialized()

    const result = await this.db!.execute({
      sql: SQL.kv.get,
      args: [key]
    })

    if (result.rows.length === 0) return null

    const value = (result.rows[0] as Record<string, unknown>).value as string
    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  }

  /**
   * 设置 KV 值
   */
  public async kvSet<T = string>(key: string, value: T): Promise<void> {
    this.ensureInitialized()

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

    await this.db!.execute({
      sql: SQL.kv.set,
      args: [key, stringValue]
    })
  }

  /**
   * 删除 KV 值
   */
  public async kvDelete(key: string): Promise<void> {
    this.ensureInitialized()

    await this.db!.execute({
      sql: SQL.kv.delete,
      args: [key]
    })
  }

  // ==================== 依赖注入 (VCP 风格) ====================

  /**
   * 获取所有依赖 (用于服务适配器)
   */
  public getDependencies(): UnifiedStorageDependencies {
    this.ensureInitialized()

    return {
      db: this.db!,
      vectorIndex: this.vectorIndex!,
      characterIndexManager: this.characterIndexManager!,
      tagMemo: this.tagMemo!,
      getSingleEmbedding: this.getSingleEmbedding.bind(this),
      applyTagBoost: this.applyTagBoost.bind(this)
    }
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): Client {
    this.ensureInitialized()
    return this.db!
  }

  /**
   * 获取向量索引
   */
  public getVectorIndex(): VexusAdapter {
    this.ensureInitialized()
    return this.vectorIndex!
  }

  /**
   * 获取角色索引管理器
   */
  public getCharacterIndexManager(): CharacterIndexManager {
    this.ensureInitialized()
    return this.characterIndexManager!
  }

  /**
   * 获取 TagMemo 服务
   */
  public getTagMemo(): TagMemoService | null {
    return this.tagMemo
  }

  /**
   * 获取 TagMemo 服务 (别名)
   */
  public getTagMemoService(): TagMemoService | null {
    return this.tagMemo
  }

  /**
   * 获取 TagMemo 统计信息
   */
  public getTagMemoStats(): { totalTags: number; totalRelations: number; totalDocuments: number } | null {
    if (!this.tagMemo) return null
    const stats = this.tagMemo.getStats()
    return {
      totalTags: stats?.tagCount || 0,
      totalRelations: stats?.relationCount || 0,
      totalDocuments: stats?.documentCount || 0
    }
  }

  // ==================== Chunk 管理 (MemoryService 支持) ====================

  /**
   * 删除单个 chunk
   */
  public async deleteChunk(id: string): Promise<void> {
    this.ensureInitialized()

    // 先从向量索引删除
    if (this.vectorIndex) {
      try {
        await this.vectorIndex.delete([id])
      } catch {
        // 向量索引可能没有这个 ID，忽略错误
      }
    }

    // 从数据库删除
    await this.db!.execute({
      sql: SQL.chunks.delete,
      args: [id]
    })

    logger.debug('Chunk deleted', { id })
  }

  /**
   * 更新 chunk
   */
  public async updateChunk(
    id: string,
    data: { content?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    this.ensureInitialized()

    const updates: string[] = []
    const args: (string | Uint8Array | null)[] = []

    if (data.content !== undefined) {
      updates.push('content = ?')
      args.push(data.content)

      // 如果内容变化，重新生成 embedding
      if (this.embeddings) {
        try {
          const newEmbedding = await this.getSingleEmbedding(data.content)
          updates.push('embedding = ?')
          args.push(this.embeddingToBlob(newEmbedding))

          // 更新向量索引
          if (this.vectorIndex) {
            await this.vectorIndex.delete([id])
            await this.vectorIndex.insert([newEmbedding], [id])
          }
        } catch (error) {
          logger.warn('Failed to update embedding', error as Error)
        }
      }
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?')
      args.push(JSON.stringify(data.metadata))
    }

    updates.push("updated_at = datetime('now')")
    args.push(id)

    if (updates.length === 0) return

    await this.db!.execute({
      sql: `UPDATE chunks SET ${updates.join(', ')} WHERE id = ?`,
      args
    })

    logger.debug('Chunk updated', { id })
  }

  /**
   * 按条件删除 chunks
   * 支持按 agentId 过滤 (VCP 角色记忆隔离)
   */
  public async deleteChunksByFilter(filter: {
    source?: 'knowledge' | 'memory' | 'diary'
    userId?: string
    agentId?: string
    characterName?: string
    knowledgeBaseId?: string
  }): Promise<number> {
    this.ensureInitialized()

    const conditions: string[] = []
    const args: string[] = []

    if (filter.source) {
      conditions.push('source = ?')
      args.push(filter.source)
    }
    if (filter.userId) {
      conditions.push('user_id = ?')
      args.push(filter.userId)
    }
    if (filter.agentId) {
      conditions.push('agent_id = ?')
      args.push(filter.agentId)
    }
    if (filter.characterName) {
      conditions.push('character_name = ?')
      args.push(filter.characterName)
    }
    if (filter.knowledgeBaseId) {
      conditions.push('knowledge_base_id = ?')
      args.push(filter.knowledgeBaseId)
    }

    if (conditions.length === 0) {
      throw new Error('At least one filter condition is required')
    }

    // 先获取要删除的 IDs (用于从向量索引删除)
    const idsResult = await this.db!.execute({
      sql: `SELECT id FROM chunks WHERE ${conditions.join(' AND ')}`,
      args
    })

    const ids = idsResult.rows.map((row: Record<string, unknown>) => row.id as string)

    // 从向量索引删除
    if (this.vectorIndex && ids.length > 0) {
      try {
        await this.vectorIndex.delete(ids)
      } catch {
        // 忽略向量索引错误
      }
    }

    // 从数据库删除
    const result = await this.db!.execute({
      sql: `DELETE FROM chunks WHERE ${conditions.join(' AND ')}`,
      args
    })

    logger.debug('Chunks deleted by filter', { filter, count: result.rowsAffected })
    return result.rowsAffected
  }

  /**
   * 获取记忆用户统计
   */
  public async getMemoryUserStats(): Promise<Array<{
    userId: string
    memoryCount: number
    lastMemoryDate: string
  }>> {
    this.ensureInitialized()

    const result = await this.db!.execute(`
      SELECT
        user_id as userId,
        COUNT(*) as memoryCount,
        MAX(created_at) as lastMemoryDate
      FROM chunks
      WHERE source = 'memory' AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY lastMemoryDate DESC
    `)

    return result.rows.map((row: Record<string, unknown>) => ({
      userId: (row.userId as string) || 'default-user',
      memoryCount: row.memoryCount as number,
      lastMemoryDate: (row.lastMemoryDate as string) || new Date().toISOString()
    }))
  }

  /**
   * 获取记忆 Agent 统计 (VCP 角色记忆隔离)
   * 列出所有有记忆的 Agent 及其统计信息
   */
  public async getMemoryAgentStats(userId?: string): Promise<Array<{
    agentId: string
    memoryCount: number
    lastMemoryDate: string
  }>> {
    this.ensureInitialized()

    let sql = `
      SELECT
        agent_id as agentId,
        COUNT(*) as memoryCount,
        MAX(created_at) as lastMemoryDate
      FROM chunks
      WHERE source = 'memory' AND agent_id IS NOT NULL
    `
    const args: string[] = []

    if (userId) {
      sql += ' AND user_id = ?'
      args.push(userId)
    }

    sql += ' GROUP BY agent_id ORDER BY lastMemoryDate DESC'

    const result = await this.db!.execute({ sql, args })

    return result.rows.map((row: Record<string, unknown>) => ({
      agentId: (row.agentId as string) || 'default-agent',
      memoryCount: row.memoryCount as number,
      lastMemoryDate: (row.lastMemoryDate as string) || new Date().toISOString()
    }))
  }

  // ==================== 知识库专用方法 (embedjs 适配) ====================

  /**
   * 插入知识库 chunk (embedjs VectorDatabase 接口适配)
   * @param knowledgeBaseId 知识库 ID
   * @param data chunk 数据
   */
  public async insertKnowledgeChunk(
    knowledgeBaseId: string,
    data: {
      content: string
      embedding: number[]
      uniqueLoaderId: string
      loaderType?: string
      metadata?: Record<string, unknown>
    }
  ): Promise<string> {
    return this.insertChunk({
      content: data.content,
      source: 'knowledge',
      embedding: data.embedding,
      uniqueLoaderId: data.uniqueLoaderId,
      loaderType: data.loaderType || 'file',
      metadata: {
        ...data.metadata,
        knowledgeBaseId
      }
    })
  }

  /**
   * 搜索知识库 chunks (向量搜索)
   * @param queryEmbedding 查询向量
   * @param knowledgeBaseId 知识库 ID
   * @param options 搜索选项
   */
  public async searchKnowledge(
    queryEmbedding: number[],
    knowledgeBaseId: string,
    options: { topK?: number; enableTagBoost?: boolean } = {}
  ): Promise<ChunkResult[]> {
    this.ensureInitialized()

    const { topK = 10, enableTagBoost = true } = options

    // 向量搜索
    let vectorResults: Array<{ id: string; score: number }> = []

    if (this.vectorIndex) {
      const results = await this.vectorIndex.search(queryEmbedding, topK * 2)
      vectorResults = results.map(r => ({
        id: String(r.id),
        score: r.score
      }))
    }

    if (vectorResults.length === 0) {
      return []
    }

    // 从数据库获取完整数据，同时过滤知识库
    const chunkIds = vectorResults.map(r => r.id)
    const placeholders = chunkIds.map(() => '?').join(',')

    const result = await this.db!.execute({
      sql: `
        SELECT id, file_id, content, source, character_name, knowledge_base_id,
               unique_loader_id, loader_type, metadata
        FROM chunks
        WHERE id IN (${placeholders})
          AND source = 'knowledge'
          AND knowledge_base_id = ?
      `,
      args: [...chunkIds, knowledgeBaseId]
    })

    // 合并分数
    let results: ChunkResult[] = result.rows.map((row: Record<string, unknown>) => {
      const vectorResult = vectorResults.find(r => r.id === row.id)
      return {
        id: row.id as string,
        content: row.content as string,
        source: row.source as 'knowledge' | 'memory' | 'diary',
        score: vectorResult?.score || 0,
        fileId: row.file_id as string | undefined,
        uniqueLoaderId: row.unique_loader_id as string | undefined,
        loaderType: row.loader_type as string | undefined,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
      }
    })

    // 应用 TagMemo 增强
    if (enableTagBoost && this.tagMemo && results.length > 0) {
      // 从 metadata 提取查询上下文进行标签增强
      const searchResults = results.map(r => ({
        pageContent: r.content,
        score: r.score,
        metadata: r.metadata || {}
      }))

      // 获取相关标签
      const allTags = new Set<string>()
      for (const r of results) {
        const chunkTags = await this.getTagsForChunk(r.id)
        chunkTags.forEach(t => allTags.add(t))
      }

      if (allTags.size > 0) {
        const boostedResults = await this.tagMemo.applyTagBoost('', Array.from(allTags), searchResults)
        results = results.map((result, i) => ({
          ...result,
          score: boostedResults[i]?.score || result.score
        }))
      }
    }

    // 排序并限制数量
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  /**
   * 根据 Loader ID 删除 chunks (embedjs 适配)
   * @param uniqueLoaderId Loader 唯一标识
   * @param knowledgeBaseId 知识库 ID
   */
  public async deleteByLoaderId(uniqueLoaderId: string, knowledgeBaseId: string): Promise<number> {
    this.ensureInitialized()

    // 先获取要删除的 IDs (用于从向量索引删除)
    const idsResult = await this.db!.execute({
      sql: 'SELECT id FROM chunks WHERE unique_loader_id = ? AND knowledge_base_id = ?',
      args: [uniqueLoaderId, knowledgeBaseId]
    })

    const ids = idsResult.rows.map((row: Record<string, unknown>) => row.id as string)

    // 从向量索引删除
    if (this.vectorIndex && ids.length > 0) {
      try {
        await this.vectorIndex.delete(ids)
      } catch {
        // 忽略向量索引错误
      }
    }

    // 从数据库删除
    const result = await this.db!.execute({
      sql: SQL.chunks.deleteByLoaderId,
      args: [uniqueLoaderId, knowledgeBaseId]
    })

    logger.debug('Chunks deleted by loader ID', {
      uniqueLoaderId,
      knowledgeBaseId,
      count: result.rowsAffected
    })
    return result.rowsAffected
  }

  /**
   * 获取 Loader 的所有 chunks
   * @param uniqueLoaderId Loader 唯一标识
   */
  public async getLoaderChunks(uniqueLoaderId: string): Promise<ChunkResult[]> {
    this.ensureInitialized()

    const result = await this.db!.execute({
      sql: SQL.chunks.getByLoaderId,
      args: [uniqueLoaderId]
    })

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      content: row.content as string,
      source: row.source as 'knowledge' | 'memory' | 'diary',
      score: 0,
      fileId: row.file_id as string | undefined,
      uniqueLoaderId: row.unique_loader_id as string | undefined,
      loaderType: row.loader_type as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    }))
  }

  /**
   * 统计 chunks 数量 (带过滤条件)
   * @param filter 过滤条件
   */
  public async countChunks(filter?: {
    source?: 'knowledge' | 'memory' | 'diary'
    knowledgeBaseId?: string
    uniqueLoaderId?: string
  }): Promise<number> {
    this.ensureInitialized()

    const conditions: string[] = ['1=1']
    const args: string[] = []

    if (filter?.source) {
      conditions.push('source = ?')
      args.push(filter.source)
    }
    if (filter?.knowledgeBaseId) {
      conditions.push('knowledge_base_id = ?')
      args.push(filter.knowledgeBaseId)
    }
    if (filter?.uniqueLoaderId) {
      conditions.push('unique_loader_id = ?')
      args.push(filter.uniqueLoaderId)
    }

    const result = await this.db!.execute({
      sql: `SELECT COUNT(*) as count FROM chunks WHERE ${conditions.join(' AND ')}`,
      args
    })

    return (result.rows[0] as Record<string, unknown>).count as number
  }

  /**
   * 重置知识库 (删除所有 chunks)
   * @param knowledgeBaseId 知识库 ID
   */
  public async resetKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    this.ensureInitialized()

    // 先获取要删除的 IDs
    const idsResult = await this.db!.execute({
      sql: 'SELECT id FROM chunks WHERE knowledge_base_id = ? AND source = ?',
      args: [knowledgeBaseId, 'knowledge']
    })

    const ids = idsResult.rows.map((row: Record<string, unknown>) => row.id as string)

    // 从向量索引删除
    if (this.vectorIndex && ids.length > 0) {
      try {
        await this.vectorIndex.delete(ids)
      } catch {
        // 忽略向量索引错误
      }
    }

    // 从数据库删除
    await this.db!.execute({
      sql: 'DELETE FROM chunks WHERE knowledge_base_id = ? AND source = ?',
      args: [knowledgeBaseId, 'knowledge']
    })

    logger.debug('Knowledge base reset', { knowledgeBaseId, deletedCount: ids.length })
  }

  // ==================== 辅助方法 ====================

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('UnifiedStorageCore not initialized. Call initialize() first.')
    }
  }

  /**
   * Embedding 转 Blob
   */
  private embeddingToBlob(embedding: number[]): Uint8Array {
    const buffer = new ArrayBuffer(embedding.length * 4)
    const view = new Float32Array(buffer)
    for (let i = 0; i < embedding.length; i++) {
      view[i] = embedding[i]
    }
    return new Uint8Array(buffer)
  }

  /**
   * 关闭连接
   */
  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }

    if (this.characterIndexManager) {
      await this.characterIndexManager.saveAll()
      this.characterIndexManager.dispose()
      this.characterIndexManager = null
    }

    // 保存主向量索引到磁盘
    if (this.vectorIndex && this.vectorIndexPath) {
      if (this.vectorIndex.isNativeMode()) {
        try {
          await this.vectorIndex.save(this.vectorIndexPath)
          const stats = await this.vectorIndex.stats()
          logger.info('Saved main vector index', {
            path: this.vectorIndexPath,
            totalVectors: stats.totalVectors
          })
        } catch (error) {
          logger.error('Failed to save main vector index', {
            error: (error as Error).message
          })
        }
      }
      this.vectorIndex = null
    }

    this.vectorIndexPath = null
    this.isInitialized = false
    logger.info('UnifiedStorageCore closed')
  }

  /**
   * 获取统计信息
   */
  public async getStats(): Promise<{
    chunkCount: number
    fileCount: number
    tagCount: number
    memoryCount: number
  }> {
    this.ensureInitialized()

    const [chunks, files, tags, memories] = await Promise.all([
      this.db!.execute('SELECT COUNT(*) as count FROM chunks'),
      this.db!.execute('SELECT COUNT(*) as count FROM files'),
      this.db!.execute('SELECT COUNT(*) as count FROM tags'),
      this.db!.execute('SELECT COUNT(*) as count FROM memories WHERE is_deleted = 0')
    ])

    return {
      chunkCount: (chunks.rows[0] as Record<string, unknown>).count as number,
      fileCount: (files.rows[0] as Record<string, unknown>).count as number,
      tagCount: (tags.rows[0] as Record<string, unknown>).count as number,
      memoryCount: (memories.rows[0] as Record<string, unknown>).count as number
    }
  }
}

// ==================== 导出 ====================

/**
 * 获取 UnifiedStorageCore 单例
 */
export function getUnifiedStorage(): UnifiedStorageCore {
  return UnifiedStorageCore.getInstance()
}

export default UnifiedStorageCore
