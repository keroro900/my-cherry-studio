/**
 * 增强记忆系统 - 类型定义
 *
 * @module memory/types
 */

// ==================== 基础类型 ====================

/**
 * 记忆类型枚举
 */
export type MemoryType =
  | 'fact' // 事实：用户喜欢蓝色
  | 'preference' // 偏好：偏好简洁回答
  | 'experience' // 经验：上次项目的做法
  | 'knowledge' // 知识：某个概念
  | 'event' // 事件：发生过什么
  | 'entity' // 实体：人、地点、物品
  | 'relation' // 关系：A与B的关系
  | 'conversation' // 对话摘要
  | 'insight' // 推断/洞察

/**
 * 记忆来源
 * @extends VCPToolBox 兼容: 添加 'diary' 类型
 */
export type MemorySource = 'conversation' | 'explicit' | 'inferred' | 'imported' | 'diary'

/**
 * 记忆后端类型
 *
 * 支持的存储/检索后端:
 * - diary: VCPToolBox 日记/笔记 (TagMemo + rust-vexus)
 * - memory: 全局会话记忆
 * - lightmemo: BM25 + RAG + Rerank
 * - deepmemo: Tantivy + Reranker
 * - meshmemo: 多维网状聚合搜索
 * - knowledge: 知识库
 * - notes: 备忘录
 * - unified: UnifiedStorageCore (统一搜索，自动 TagMemo 增强)
 */
export type MemoryBackendType =
  | 'diary'
  | 'memory'
  | 'lightmemo'
  | 'deepmemo'
  | 'meshmemo'
  | 'knowledge'
  | 'notes'
  | 'unified'

/**
 * 时间范围
 */
export interface TimeRange {
  range: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  startDate?: Date
  endDate?: Date
  /** @alias startDate - 向后兼容 */
  start?: Date
  /** @alias endDate - 向后兼容 */
  end?: Date
}

/**
 * 记忆关系
 */
export interface MemoryRelation {
  id: string
  sourceId: string
  targetId: string
  relationType: string
  weight: number
  metadata?: Record<string, unknown>
  createdAt: Date
}

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  /** 来源 */
  source: MemorySource
  /** 置信度 (0-1) */
  confidence: number
  /** 标签 */
  tags: string[]
  /** 用户 ID */
  userId?: string
  /** Agent ID */
  agentId?: string
  /** 会话 ID */
  sessionId?: string
  /** 原始时间戳 */
  timestamp?: Date
  /** 过期时间 */
  expiresAt?: Date
  /** 重要性 (1-10) */
  importance: number
  /** 自定义字段 */
  custom?: Record<string, unknown>
  /** 关联实体 (人名、地点等) */
  entities?: string[]
  /** 关联关系 */
  relations?: MemoryRelation[]
  /** 上下文信息 */
  context?: string
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 唯一 ID */
  id: string
  /** 内容 */
  content: string
  /** 类型 */
  type: MemoryType
  /** 哈希 (用于去重) */
  hash?: string
  /** 向量嵌入 */
  embedding?: number[]
  /** 元数据 */
  metadata: MemoryMetadata
  /** 关联关系 */
  relations?: MemoryRelation[]
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 访问次数 */
  accessCount: number
  /** 最后访问时间 */
  lastAccessedAt?: Date
  /** 是否已删除 */
  isDeleted?: boolean
  /** VCPToolBox 兼容: 角色/日记本名称 */
  characterName?: string
  /** VCPToolBox 兼容: 日记本名称 (别名) */
  diaryName?: string
}

/**
 * 带评分的记忆条目
 */
export interface ScoredMemoryEntry extends MemoryEntry {
  /** 相关性得分 */
  score: number
  /** 匹配原因 */
  matchReason?: string
  /** 匹配的片段 */
  highlights?: string[]
}

// ==================== 添加操作 ====================

/**
 * 添加记忆选项
 */
export interface AddMemoryInput {
  /** 内容 */
  content: string
  /** 类型 */
  type?: MemoryType
  /** 标签 */
  tags?: string[]
  /** 用户 ID */
  userId?: string
  /** Agent ID */
  agentId?: string
  /** 会话 ID */
  sessionId?: string
  /** 重要性 */
  importance?: number
  /** 来源 */
  source?: MemorySource
  /** 置信度 */
  confidence?: number
  /** 关联实体 */
  entities?: string[]
  /** 自定义元数据 */
  customMetadata?: Record<string, unknown>
  /** 完整元数据对象 (用于直接传入) */
  metadata?: Partial<MemoryMetadata>
}

/**
 * 批量添加结果
 */
export interface AddMemoryResult {
  /** 成功添加的条目 */
  added: MemoryEntry[]
  /** 跳过的条目 (重复) */
  skipped: number
  /** 失败的条目 */
  failed: Array<{ input: AddMemoryInput; error: string }>
}

/**
 * 创建记忆的简化返回类型
 *
 * 用于创建操作的返回值，包含必要的标识信息
 *
 * @see MemoryEntry 完整记忆条目类型
 */
export interface CreatedMemoryEntry {
  /** 唯一 ID */
  id: string
  /** 内容 */
  content: string
  /** 标题 */
  title?: string
  /** 标签 */
  tags: string[]
  /** 存储后端 */
  backend: MemoryBackendType
  /** 创建时间 */
  createdAt: Date
  /** 附加元数据 */
  metadata?: Record<string, unknown>
}

// ==================== 检索操作 ====================

/**
 * 检索模式
 */
export type RetrievalMode =
  | 'semantic' // 纯语义检索
  | 'hybrid' // 混合检索 (BM25 + 向量)
  | 'exact' // 精确匹配
  | 'waverag' // WaveRAG 三阶段检索
  | 'deepmemo' // 深度回忆
  | 'timeline' // 时间线检索

/**
 * 检索过滤器
 */
export interface RetrievalFilters {
  /** 类型过滤 */
  types?: MemoryType[]
  /** 标签过滤 (AND) */
  tags?: string[]
  /** 标签过滤 (OR) */
  tagsOr?: string[]
  /** 用户 ID */
  userId?: string
  /** Agent ID */
  agentId?: string
  /** 会话 ID */
  sessionId?: string
  /** 最小重要性 */
  minImportance?: number
  /** 最小置信度 */
  minConfidence?: number
  /** 排除 ID */
  excludeIds?: string[]
}

/**
 * 检索增强选项
 */
export interface RetrievalBoost {
  /** 增强的标签 */
  tags?: string[]
  /** 增强的类型 */
  types?: MemoryType[]
  /** 最近性增强 */
  recency?: boolean
  /** 访问频率增强 */
  frequency?: boolean
  /** 自定义增强函数 */
  custom?: (entry: MemoryEntry) => number
}

/**
 * 检索选项
 */
export interface RetrievalOptions {
  /** 查询文本 */
  query: string
  /** 检索模式 */
  mode?: RetrievalMode
  /** 返回数量 */
  topK?: number
  /** 相似度阈值 */
  threshold?: number
  /** 时间范围 */
  timeRange?: TimeRange
  /** 过滤器 */
  filters?: RetrievalFilters
  /** 增强选项 */
  boost?: RetrievalBoost
  /** 是否包含关系 */
  includeRelations?: boolean
  /** 语义组 */
  semanticGroups?: string[]
  /** 是否启用 TagMemo */
  enableTagMemo?: boolean
}

/**
 * 检索元数据
 */
export interface RetrievalMetadata {
  /** 找到的总数 */
  totalFound: number
  /** 耗时 (ms) */
  timeElapsed: number
  /** 使用的策略 */
  strategy: string
  /** 扩展的标签 */
  expansions?: string[]
  /** 应用的过滤器 */
  appliedFilters?: string[]
  /** 是否命中缓存 */
  cached?: boolean
  /** 匹配的语义组 */
  groups?: string[]
  /** 错误信息 */
  error?: string
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  /** 结果条目 */
  entries: ScoredMemoryEntry[]
  /** 元数据 */
  metadata: RetrievalMetadata
}

// ==================== 深度回忆 ====================

/**
 * 深度搜索选项
 */
export interface DeepSearchOptions extends RetrievalOptions {
  /** 第一阶段候选数量 */
  firstStageK?: number
  /** 是否启用聚类 */
  enableClustering?: boolean
  /** 聚类数量 */
  clusterCount?: number
  /** 是否包含时间线 */
  includeTimeline?: boolean
}

/**
 * 主题聚类
 */
export interface TopicCluster {
  /** 聚类 ID */
  id: string
  /** 主题标签 */
  topic: string
  /** 条目 */
  entries: ScoredMemoryEntry[]
  /** 代表性摘要 */
  summary?: string
  /** 时间跨度 */
  timeSpan?: {
    start: Date
    end: Date
  }
}

// ==================== 语义组 ====================

/**
 * 语义组定义
 */
export interface SemanticGroupDefinition {
  /** 组 ID */
  id: string
  /** 组名称 */
  name: string
  /** 描述 */
  description?: string
  /** 关键词 */
  keywords: string[]
  /** 相关类型 */
  types?: MemoryType[]
  /** 权重 */
  weight?: number
  /** 优先级 (用于排序) */
  priority?: number
  /** 显示颜色 */
  color?: string
}

/**
 * 预定义语义组
 */
export const SEMANTIC_GROUPS: Record<string, SemanticGroupDefinition> = {
  personal: {
    id: 'personal',
    name: '个人信息',
    keywords: ['name', 'age', 'location', 'occupation', 'birthday', 'email', 'phone'],
    types: ['fact', 'entity']
  },
  preferences: {
    id: 'preferences',
    name: '偏好习惯',
    keywords: ['likes', 'dislikes', 'prefer', 'favorite', 'style', 'habits'],
    types: ['preference']
  },
  projects: {
    id: 'projects',
    name: '项目工作',
    keywords: ['project', 'work', 'code', 'task', 'deadline', 'meeting', 'team'],
    types: ['event', 'experience']
  },
  knowledge: {
    id: 'knowledge',
    name: '知识概念',
    keywords: ['concept', 'definition', 'theory', 'principle', 'how', 'what', 'why'],
    types: ['knowledge', 'fact']
  },
  events: {
    id: 'events',
    name: '事件日程',
    keywords: ['meeting', 'appointment', 'date', 'schedule', 'plan', 'reminder'],
    types: ['event']
  },
  relationships: {
    id: 'relationships',
    name: '人际关系',
    keywords: ['friend', 'colleague', 'family', 'contact', 'person', 'people'],
    types: ['entity', 'relation']
  }
}

/**
 * 分组后的记忆
 */
export interface GroupedMemories {
  /** 按组分类的记忆 */
  groups: Map<string, ScoredMemoryEntry[]>
  /** 未分组的记忆 */
  ungrouped: ScoredMemoryEntry[]
}

// ==================== 对话提取 ====================

/**
 * 对话消息 (简化版)
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
}

/**
 * 提取结果
 */
export interface ExtractionResult {
  /** 提取的记忆 */
  memories: AddMemoryInput[]
  /** 提取的实体 */
  entities: Array<{
    name: string
    type: string
    attributes?: Record<string, unknown>
  }>
  /** 提取的关系 */
  relations: Array<{
    from: string
    to: string
    type: string
  }>
  /** 对话摘要 */
  summary?: string
}

// ==================== 配置 ====================

/**
 * 记忆服务配置
 */
export interface MemoryServiceConfig {
  /** 是否启用 */
  enabled: boolean
  /** 默认用户 ID */
  defaultUserId?: string
  /** 嵌入模型配置 */
  embedding?: {
    model: string
    provider: string
    dimensions?: number
  }
  /** 自动提取配置 */
  autoExtraction?: {
    enabled: boolean
    minMessages?: number
    extractEntities?: boolean
    extractPreferences?: boolean
  }
  /** 检索默认配置 */
  retrieval?: {
    defaultTopK?: number
    defaultThreshold?: number
    defaultMode?: RetrievalMode
    enableTagMemo?: boolean
  }
  /** 去重阈值 */
  deduplicationThreshold?: number
  /** 缓存配置 */
  cache?: {
    enabled: boolean
    ttlSeconds?: number
    maxSize?: number
  }
}

// ==================== 事件 ====================

/**
 * 记忆事件类型
 */
export type MemoryEventType =
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'memory:accessed'
  | 'extraction:completed'
  | 'retrieval:completed'

/**
 * 记忆事件
 */
export interface MemoryEvent {
  type: MemoryEventType
  timestamp: Date
  data: Record<string, unknown>
}

// ==================== VCPToolBox 兼容类型 ====================

/**
 * TagMemo 增强信息
 * 移植自 VCPToolBox TagBoostResult
 */
export interface TagBoostInfo {
  /** 原始分数 */
  originalScore: number
  /** 增强后分数 */
  boostedScore: number
  /** 匹配的标签 */
  matchedTags: string[]
  /** 扩展标签 (通过共现矩阵) */
  expansionTags?: string[]
  /** 增强因子 */
  boostFactor: number
  /** Tag 匹配总分 (spike score) */
  tagMatchScore: number
  /** 详细的 spike 计算信息 */
  spikeDetails?: Array<{
    tag: string
    weight: number
    globalFreq: number
    score: number
  }>
}

/**
 * 带 TagMemo 增强的记忆条目
 */
export interface TagBoostedMemoryEntry extends ScoredMemoryEntry {
  /** TagMemo 增强信息 */
  tagBoostInfo?: TagBoostInfo
}

/**
 * 角色/日记本配置
 */
export interface CharacterConfig {
  /** 角色名称 */
  name: string
  /** 日记本路径 */
  diaryPath?: string
  /** 向量索引路径 */
  indexPath?: string
  /** 向量维度 */
  dimensions?: number
  /** 索引容量 */
  capacity?: number
  /** 是否启用 TagMemo */
  enableTagMemo?: boolean
}

/**
 * AIMemo 合成结果
 */
export interface AIMemoSynthesisResult {
  /** 合成后的记忆内容 */
  synthesizedMemory: string
  /** 原始搜索结果 */
  rawResults: ScoredMemoryEntry[]
  /** 是否来自缓存 */
  fromCache: boolean
  /** 处理耗时 (ms) */
  durationMs?: number
}

// ==================== 统一记忆管理器类型 ====================
// 从 UnifiedMemoryManager 迁移的类型，用于统一入口

/**
 * VCP 高级检索语法选项
 * @see DeepMemo 高级检索语法
 */
export interface VCPAdvancedSearchOptions {
  /** 精确短语搜索 (用引号包裹) */
  exactPhrase?: string
  /** 正向加权关键词 */
  boostKeywords?: string[]
  /** 负向排除关键词 */
  excludeKeywords?: string[]
  /** OR 逻辑关键词组 */
  orKeywords?: string[]
  /** 时间范围过滤 */
  timeRange?: {
    start?: Date
    end?: Date
  }
  /** Tag 过滤 */
  tags?: string[]
  /** 启用 Reranker 精排 */
  useReranker?: boolean
  /** Reranker 模型 ID */
  rerankerModelId?: string
}

/**
 * 统一搜索结果
 */
export interface UnifiedSearchResult {
  id: string
  content: string
  score: number
  backend: MemoryBackendType
  metadata?: Record<string, unknown>
  sourceFile?: string
  matchedTags?: string[]
  /** VCP TagMemo 增强信息 */
  tagBoostInfo?: {
    boostFactor: number
    spikeCount: number
    totalSpikeScore: number
  }
}

/**
 * 统一搜索选项
 */
export interface UnifiedSearchOptions {
  /** 要搜索的后端列表，不指定则搜索所有 */
  backends?: MemoryBackendType[]
  /** 每个后端返回的最大结果数 */
  topK?: number
  /** 最低相关性分数 (0-1) */
  threshold?: number
  /** 用户 ID (用于 memory 过滤) */
  userId?: string
  /** Agent ID (用于 memory 过滤) */
  agentId?: string
  /** 角色名称 (用于 unified/diary 过滤) */
  characterName?: string
  /** 知识库 ID (用于 knowledge 过滤) */
  knowledgeBaseId?: string
  /** 日记本名称 (用于 diary/VCP 过滤) */
  diaryName?: string
  /** 是否启用 RRF 融合排序 */
  useRRF?: boolean
  /** RRF k 参数 */
  rrfK?: number
  /** VCP 高级检索选项 */
  vcpAdvanced?: VCPAdvancedSearchOptions
  /** TagMemo boost 系数 (0-1, 默认 0.5) */
  tagBoost?: number
  /** Embedding API 客户端 (用于 knowledge 后端) */
  embedApiClient?: import('@types').ApiClient
  /** Reranker API 客户端 (用于搜索结果重排序) */
  rerankApiClient?: import('@types').ApiClient
  /** 时间范围过滤 (由 TimeParser 自动生成或手动指定) */
  timeRange?: { start: Date; end: Date }
}

/**
 * 后端状态信息
 */
export interface BackendStatus {
  backend: MemoryBackendType
  available: boolean
  documentCount: number
  lastUpdated?: Date
  error?: string
}

/**
 * 统一管理器统计
 */
export interface UnifiedMemoryStats {
  backends: BackendStatus[]
  totalDocuments: number
  lastQueryTime?: Date
}
