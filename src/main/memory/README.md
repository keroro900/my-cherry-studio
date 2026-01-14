# Cherry Studio 增强记忆系统 (Enhanced Memory System)

> ✅ **代码整合完成** - 更新日期: 2026-01

## 🟢 实现完成状态

### 已完成的 TODO 项目

| 原行号 | 内容 | 状态 | 实现方式 |
|--------|------|:----:|----------|
| 246 | 集成 Embeddings 服务 | ✅ | 集成 UnifiedEmbeddingService |
| 250 | 调用嵌入服务 (embed) | ✅ | embedText() 方法 |
| 255 | 调用嵌入服务 (embedBatch) | ✅ | embedTexts() 方法 |
| 265 | 集成 LLM 提取服务 | ✅ | 集成 MCPBridge |
| 269 | 调用 LLM 提取 | ✅ | generateText() + JSON 解析 |
| 494 | 集成 TagMemoService 进行标签扩展 | ✅ | expandTags() 使用共现矩阵 |
| 503 | 集成 TagMemoService | ✅ | applyTagMemoBoost() PMI 算法 |
| 543 | 使用 LLM 或交叉编码器重排序 | ✅ | BM25 + 递归 Rerank 算法 |
| 564 | 实现真正的聚类算法 | ✅ | K-Means 风格聚类 |
| 681 | 存储到知识图谱 | ✅ | 实体和关系存储为记忆条目 |
| 796 | 实现哈希检查 | ✅ | findByHash() 方法 |

### 核心算法实现 (移植自 VCPToolBox)

| 算法 | 来源 | 位置 | 说明 |
|------|------|------|------|
| BM25 排序 | VCPToolBox LightMemo | `UnifiedMemoryService.rerankResults()` | k1=1.5, b=0.75 参数 |
| PMI 共现矩阵 | VCPToolBox KnowledgeBaseManager | `TagMemoService` | 标签共现增强 |
| 递归 Rerank | VCPToolBox DeepMemo | `UnifiedMemoryService.recursiveRerank()` | 分批递归精排 |
| 动态 Alpha/Beta | VCPToolBox _applyTagBoost | `TagMemoService.applyTagBoost()` | 指数增强 + 对数降噪 |
| RRF 融合 | VCPToolBox | `memory/utils/RRFUtils.ts` | 加权 RRF 算法 |

### 架构层次
```
VCP 服务层 (BuiltinServices)
        │
        ▼
   VCPMemoryAdapter  ←── VCP 统一入口
        │
        ▼
IntegratedMemoryCoordinator  ←── 协调层入口
        │
    ┌───┴────┬─────────┐
    ▼        ▼         ▼
UnifiedMemory  MemoryMaster  SelfLearning
Manager        Service       Service
```

### 模块推荐使用

| 组件 | 位置 | 状态 | 说明 |
|------|------|:----:|------|
| IntegratedMemoryCoordinator | `services/memory/` | ✅ 推荐 | **统一协调层入口** |
| VCPMemoryAdapter | `memory/adapters/` | ✅ 推荐 | VCP 服务层统一适配器 |
| UnifiedMemoryService | `memory/core/` | ✅ 可用 | 底层记忆服务 |
| TagMemoService | `knowledge/tagmemo/` | ✅ 可用 | 标签共现增强 |
| RRFUtils | `memory/utils/` | ✅ 使用 | 统一 RRF 融合 |

### RRF 算法 (已统一)

| 位置 | 状态 |
|------|:----:|
| `memory/utils/RRFUtils.ts` | ✅ 统一入口 |
| `knowledge/unified/RRFFusion.ts` | → 导入 utils |
| `knowledge/vcp/RRFUtils.ts` | → 导入 utils |

### 废弃迁移指南

| 废弃模块 | 替代方案 |
|---------|---------|
| `LightMemoService` (VCP) | `VCPMemoryAdapter.lightMemoSearch()` |
| `DeepMemoService` (VCP) | `DeepMemoRetriever.retrieve()` |
| `UnifiedMemoryManager` | `IntegratedMemoryCoordinator` |
| `MasterMemoryManager` | **已删除** - 使用 `IntegratedMemoryCoordinator` |

---

## 架构概述

增强记忆系统将现有分散的记忆功能统一为一个协调一致的系统，提供：

1. **统一入口** - 所有记忆操作通过 UnifiedMemoryService 进行
2. **多后端支持** - SQLite 向量数据库 + 内存向量索引
3. **智能检索** - WaveRAG + DeepMemo + TagMemo + 语义组检索
4. **自动提取** - 对话自动信息提取和存储
5. **深度回忆** - 跨会话历史检索

## 目录结构

```
src/main/memory/
├── README.md                        # 本文档
├── index.ts                         # 模块导出
├── types/
│   └── index.ts                     # 类型定义
├── core/
│   └── UnifiedMemoryService.ts      # 统一记忆服务（主入口）
├── storage/
│   ├── index.ts                     # 存储模块导出
│   ├── SQLiteStore.ts               # SQLite 持久化适配器
│   └── VectorIndexService.ts        # 向量索引服务
├── retrieval/
│   ├── index.ts                     # 检索模块导出
│   ├── DeepMemoRetriever.ts         # 深度回忆检索
│   └── SemanticGroupRetriever.ts    # 语义组检索
├── extraction/ (计划中)
│   ├── ConversationExtractor.ts     # 对话信息提取
│   ├── EntityExtractor.ts           # 实体提取
│   └── FactExtractor.ts             # 事实提取
└── learning/ (计划中)
    ├── FeedbackLearner.ts           # 反馈学习
    └── PatternLearner.ts            # 模式学习
```

## 快速开始

```typescript
import { unifiedMemory, addMemory, retrieveMemory, getRelevantContext } from '@main/memory'

// 初始化（通常在应用启动时调用）
await unifiedMemory.initialize()

// 添加记忆
await addMemory({
  content: '用户偏好使用 TypeScript 进行开发',
  type: 'preference',
  tags: ['programming', 'typescript'],
  importance: 8,
  confidence: 0.9
})

// 检索记忆
const result = await retrieveMemory({
  query: '用户的编程习惯',
  mode: 'waverag',
  topK: 10,
  boost: {
    tags: ['programming'],
    recency: true
  }
})

// 获取上下文注入
const context = await getRelevantContext('如何配置项目?')
```

## 核心类型

### MemoryType - 记忆类型

```typescript
type MemoryType =
  | 'fact'        // 事实：用户喜欢蓝色
  | 'preference'  // 偏好：偏好简洁回答
  | 'experience'  // 经验：上次项目的做法
  | 'knowledge'   // 知识：某个概念
  | 'event'       // 事件：发生过什么
  | 'entity'      // 实体：人、地点、物品
  | 'relation'    // 关系：A与B的关系
  | 'conversation' // 对话摘要
  | 'insight'     // 推断/洞察
```

### MemoryEntry - 记忆条目

```typescript
interface MemoryEntry {
  id: string
  content: string
  type: MemoryType
  hash?: string
  embedding?: number[]
  metadata: MemoryMetadata
  relations?: MemoryRelation[]
  createdAt: Date
  updatedAt: Date
  accessCount: number
  lastAccessedAt?: Date
}
```

### RetrievalMode - 检索模式

```typescript
type RetrievalMode =
  | 'semantic'   // 纯语义检索
  | 'hybrid'     // 混合检索 (BM25 + 向量)
  | 'exact'      // 精确匹配
  | 'waverag'    // WaveRAG 三阶段检索
  | 'deepmemo'   // 深度回忆
  | 'timeline'   // 时间线检索
```

## 核心服务

### 1. UnifiedMemoryService

统一入口，协调所有记忆操作：

```typescript
// 获取实例
const memory = UnifiedMemoryService.getInstance()

// 初始化
await memory.initialize(config?)

// 添加记忆
const entry = await memory.add({
  content: '...',
  type: 'fact',
  tags: ['tag1', 'tag2']
})

// 批量添加
const result = await memory.addBatch([...inputs])

// 检索记忆
const { entries, metadata } = await memory.retrieve({
  query: '...',
  mode: 'hybrid',
  topK: 10
})

// 获取相关上下文（用于注入对话）
const context = await memory.getRelevantContext('查询内容', 5)

// 按语义组搜索
const personal = await memory.searchBySemanticGroup('personal', '名字')

// 自动分组
const grouped = await memory.autoGroupMemories(entries)

// 更新和删除
await memory.update(id, { content: '...' })
await memory.delete(id)
```

### 2. DeepMemoRetriever

深度回忆检索器，提供跨会话历史搜索能力：

```typescript
const retriever = new DeepMemoRetriever(storeAccessor)

// 两阶段深度搜索
// Phase 1: Lens - 广度初筛
// Phase 2: Expansion - 语义扩展
// Phase 3: Focus - 精排
// Phase 4: Rerank - 多因素重排序
const result = await retriever.search('查询', {
  firstStageK: 50,
  enableClustering: true,
  clusterCount: 5
})

// 时间线搜索
const timeline = await retriever.searchTimeline('项目进展', {
  range: 'month'
})

// 关联发现
const relations = await retriever.discoverRelations(entryId)

// 主题聚类
const clusters = await retriever.clusterByTopic(entries, 5)
```

### 3. SemanticGroupRetriever

语义组检索器，基于预定义的语义分组进行检索：

```typescript
const retriever = new SemanticGroupRetriever(storeAccessor)

// 内置语义组
const GROUPS = {
  personal: '个人信息 - 名字、年龄、住址、职业',
  preferences: '偏好习惯 - 喜欢、讨厌、习惯',
  projects: '项目任务 - 项目、任务、截止日期',
  social: '社交关系 - 朋友、家人、同事',
  learning: '学习知识 - 学习、研究、课程',
  experiences: '经历体验 - 旅行、事件、记忆',
  health: '健康状况 - 健康、药物、锻炼',
  emotions: '情感状态 - 感觉、情绪、心情'
}

// 按语义组检索
const result = await retriever.search({
  groups: ['personal', 'preferences'],
  query: '用户信息',
  includeRelatedGroups: true
})

// 自动识别查询所属语义组
const matches = retriever.identifyGroups('我喜欢蓝色')

// 自动分类记忆
const classification = retriever.classifyMemory(entry)
```

### 4. SQLiteStore

SQLite 持久化存储适配器：

```typescript
const store = new SQLiteStore({
  userId: 'user-123'
})

await store.initialize()

// CRUD 操作
await store.add({ content: '...', type: 'fact' })
const entries = await store.search('查询', options)
await store.update(id, { content: '...' })
await store.delete(id)

// 特殊查询
await store.searchByType(['fact', 'preference'], '查询')
await store.searchByTags(['tag1', 'tag2'])
await store.searchByTimeRange({ start, end })
```

### 5. VectorIndexService

内存向量索引服务：

```typescript
const index = new VectorIndexService({
  dimensions: 1536,
  algorithm: 'cosine'  // 'cosine' | 'euclidean' | 'dotProduct'
})

// 添加向量
index.add(id, vector, entry)
index.addBatch([...])

// 搜索
const results = index.search(queryVector, {
  topK: 10,
  threshold: 0.5,
  filter: (entry) => entry.type === 'fact'
})

// 多向量搜索
const union = index.multiSearch(vectors, 'union')
const intersection = index.multiSearch(vectors, 'intersection')

// 聚类
const clusters = index.cluster(k)
const nearest = index.getNearestCluster(vector)

// 统计信息
const stats = index.getStats()
```

## 检索策略详解

### WaveRAG 三阶段检索

1. **Lens (广度)**: 提取查询标签，低阈值获取大量候选
2. **Expansion (扩展)**: 基于高频标签扩展查询词
3. **Focus (聚焦)**: 应用 TagMemo 增强精排

### DeepMemo 深度检索

1. **Lens**: 广度初筛获取候选集
2. **Expansion**: 语义扩展增加召回
3. **Focus**: 重计算相关性分数
4. **Rerank**: 多因素重排序（时间衰减、重要性、访问频率、置信度）

### 语义组检索

1. 自动识别查询所属语义组
2. 按组类型和关键词过滤
3. 可选包含关联组扩展检索

## 配置选项

```typescript
interface MemoryServiceConfig {
  enabled: boolean
  retrieval?: {
    defaultTopK: number
    defaultThreshold: number
    defaultMode: RetrievalMode
    enableTagMemo: boolean
  }
  cache?: {
    enabled: boolean
    ttlSeconds: number
    maxSize: number
  }
  deduplicationThreshold: number
  autoExtraction?: {
    enabled: boolean
    extractOnMessage: boolean
    extractTypes: MemoryType[]
  }
  embedding?: {
    model: string
    provider: string
    dimensions: number
  }
  defaultUserId?: string
}
```

## 与现有系统的集成

### 与 MemoryService 的关系

SQLiteStore 封装了现有的 MemoryService，提供统一接口：

```
UnifiedMemoryService
       │
       ├── SQLiteStore ──────► MemoryService (LibSQL)
       │
       └── VectorIndexService (内存索引)
```

### MCP Memory Server 适配

MCP Memory Server 可以调用统一记忆服务：

```typescript
// memory.ts 修改
import { unifiedMemory } from '@main/memory'

// 在 MCP 工具中使用
async handleCreateEntities(entities) {
  for (const entity of entities) {
    await unifiedMemory.add({
      content: entity.name,
      type: 'entity',
      tags: entity.observations
    })
  }
}
```

## 事件系统

```typescript
// 订阅事件
unifiedMemory.on('memory:added', (data) => {
  console.log('新记忆添加:', data.entry)
})

unifiedMemory.on('retrieval:completed', (data) => {
  console.log('检索完成:', data.resultCount)
})

unifiedMemory.on('extraction:completed', (data) => {
  console.log('提取完成:', data.memoriesExtracted)
})
```

## 性能考虑

1. **缓存层** - 热点查询结果缓存，可配置 TTL
2. **批量操作** - 支持批量写入和批量检索
3. **双索引** - SQLite 全文索引 + 内存向量索引
4. **懒加载** - 大型结果集分页加载
5. **去重机制** - 基于内容哈希和语义相似度去重

## 隐私和安全

1. **用户隔离** - 严格的用户 ID 隔离
2. **软删除** - 支持记忆遗忘和恢复
3. **敏感标记** - 敏感信息特殊处理（计划中）
4. **过期机制** - 支持记忆自动过期

## 后续计划

- [x] ~~信息提取模块 (ConversationExtractor)~~ ✅ 已集成 MCPBridge
- [x] ~~实体提取和关系抽取~~ ✅ 已实现
- [x] ~~BM25 关键词排序~~ ✅ 已实现
- [x] ~~TagMemo 标签扩展~~ ✅ 已集成
- [x] ~~递归 Rerank 重排序~~ ✅ 已实现
- [ ] 反馈学习机制增强
- [ ] 模式学习和预测
- [ ] 知识图谱可视化
- [ ] 导入/导出功能

---

*Last Updated: 2026-01*
