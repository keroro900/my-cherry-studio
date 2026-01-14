# Cherry Studio 独立架构说明

## 概述

Cherry Studio 已实现**完全独立**的知识库检索系统，不依赖 VCPToolBox 后端服务器。
所有核心功能均使用纯 TypeScript 实现，可在 Electron 环境中独立运行。

---

## 已实现的独立功能

### 1. 向量数据库

| 实现 | 文件 | 说明 | 状态 |
|------|------|------|------|
| **MemoryVectorDb** | `vector/MemoryVectorDb.ts` | 纯 TypeScript HNSW 向量索引 | ✅ 完整实现 |
| **VexusAdapter** | `vector/VexusAdapter.ts` | Rust 原生模块适配器 (可选) | ✅ 有 Mock fallback |
| **USearchAdapter** | `vector/USearchAdapter.ts` | usearch npm 包适配器 | ✅ 可选 |
| **LibSqlDbAdapter** | `vector/LibSqlDbAdapter.ts` | embedjs-libsql 适配器 | ✅ 可选 |

**推荐**: 中小规模数据集 (<100k 向量) 使用 `MemoryVectorDb`，无需任何原生依赖。

### 2. TagMemo 标签共现增强

| 实现 | 文件 | 说明 | 状态 |
|------|------|------|------|
| **PMICooccurrenceMatrix** | `tagmemo/index.ts` | PMI 共现矩阵，支持多跳扩展 | ✅ 完整实现 |
| **NativeTagMemoService** | `tagmemo/index.ts` | 动态 Alpha/Beta Tag Boost | ✅ 完整实现 |

**核心算法**:
- 基于 VCPToolBox `_buildCooccurrenceMatrix` 和 `_applyTagBoost` 重写
- PMI (Pointwise Mutual Information) 标签关联强度计算
- 动态 Alpha: [1.5, 3.5] 范围，基于标签匹配强度自适应
- 动态 Beta: 模糊查询时提高降噪常数
- 多跳标签扩展 (2 层默认，0.7 衰减因子)

### 3. 检索服务

| 实现 | 文件 | 说明 | 状态 |
|------|------|------|------|
| **LightMemoService** | `lightMemo/` | BM25 + 向量混合搜索 | ✅ 完整实现 |
| **DeepMemoService** | `deepMemo/` | 双层检索 + Rerank | ✅ 完整实现 |
| **GenericMeshMemoService** | `meshMemo/` | 过滤-召回 + MMR 多样性 | ✅ 完整实现 |
| **WaveRAGService** | `waverag/` | 三阶段 Lens-Expansion-Focus | ✅ 完整实现 |
| **VCPSearchService** | `vcp/VCPSearchService.ts` | 统一搜索接口 | ✅ 独立实现 |

### 4. Reranker 重排服务

| 实现 | 文件 | 说明 |
|------|------|------|
| **JinaStrategy** | `reranker/strategies/` | Jina Reranker API |
| **VoyageStrategy** | `reranker/strategies/` | Voyage Reranker API |
| **BailianStrategy** | `reranker/strategies/` | 阿里百炼 Reranker |
| **TeiStrategy** | `reranker/strategies/` | TEI 本地 Reranker |
| **DefaultStrategy** | `reranker/strategies/` | 基于相似度的快速重排 |

### 5. 时间感知与语义组

| 实现 | 文件 | 说明 |
|------|------|------|
| **TimeAwareSearch** | `search/TimeAwareSearch.ts` | 时间衰减、时间范围过滤 |
| **SemanticGroupSearch** | `search/SemanticGroupSearch.ts` | 语义组匹配增强 |

---

## 架构对比

### 之前 (依赖 VCPToolBox)

```
Cherry Studio (Electron)
    ↓ HTTP/WebSocket
VCPToolBox (Node.js 后端服务器)
    ├── KnowledgeBaseManager.js (知识库)
    ├── Plugin.js (插件管理)
    └── rust-vexus-lite (向量引擎)
```

**问题**:
- 需要额外运行后端进程
- 架构复杂，调试困难
- 代码分散在两个项目

### 现在 (完全独立)

```
Cherry Studio (Electron)
├── src/main/knowledge/
│   ├── vector/MemoryVectorDb.ts      ← 纯 TS HNSW
│   ├── tagmemo/index.ts              ← 纯 TS TagMemo
│   ├── lightMemo/                    ← 纯 TS BM25 + RAG
│   ├── deepMemo/                     ← 纯 TS 双层检索
│   ├── meshMemo/                     ← 纯 TS 过滤召回
│   ├── waverag/                      ← 纯 TS Wave RAG
│   └── reranker/                     ← 多策略重排
└── src/renderer/src/aiCore/          ← AI 中间件
```

**优势**:
- 单一进程，部署简单
- 所有代码 TypeScript，类型安全
- 无外部服务依赖
- 便于调试和扩展

---

## 功能对照表

| VCPToolBox 功能 | Cherry Studio 实现 | 状态 |
|-----------------|-------------------|------|
| `_buildCooccurrenceMatrix()` | `PMICooccurrenceMatrix.buildFromDocuments()` | ✅ |
| `_applyTagBoost()` | `NativeTagMemoService.applyTagBoost()` | ✅ |
| `tagCooccurrenceMatrix` | `PMICooccurrenceMatrix` | ✅ |
| VexusIndex (Rust) | `MemoryVectorDb` (纯 TS) 或 `VexusAdapter` | ✅ |
| BM25 搜索 | `LightMemoService` | ✅ |
| 多阶段检索 | `DeepMemoService` | ✅ |
| 过滤-召回 | `GenericMeshMemoService` | ✅ |
| 插件系统 | MCP (Model Context Protocol) | ✅ 不同实现 |

---

## 使用示例

### TagMemo 使用

```typescript
import { createTagMemoService } from '@main/knowledge/tagmemo'

const tagMemo = createTagMemoService({
  enabled: true,
  alphaRange: [1.5, 3.5],
  betaBase: 2,
  maxExpansionDepth: 2
})

// 从文档初始化共现矩阵
await tagMemo.initialize([
  { id: 'doc1', tags: ['时尚', '夏季', '连衣裙'] },
  { id: 'doc2', tags: ['时尚', '春季', '外套'] },
  { id: 'doc3', tags: ['夏季', '短裤', '休闲'] }
])

// 搜索增强
const query = '夏季时尚穿搭'
const tags = tagMemo.extractTagsFromQuery(query)
const boostedResults = await tagMemo.applyTagBoost(query, tags, searchResults)
```

### VCPSearchService 使用

```typescript
import { createVCPSearchService } from '@main/knowledge/vcp/VCPSearchService'

const searchService = createVCPSearchService()

const result = await searchService.search(knowledgeBaseAccessor, '夏季连衣裙推荐', {
  mode: 'rag',
  topK: 10,
  tagMemo: true,
  timeAware: true,
  timeRange: 'month'
})

console.log(result.results)
console.log(result.metadata.enhancementsApplied) // ['tagMemo', 'timeAware']
```

---

## 待完成功能

| 功能 | 来源 | 优先级 | 说明 |
|------|------|--------|------|
| 日记系统 | VCPToolBox DailyNote* | 中 | 已有 `DailyNoteService` 框架 |
| 科学计算器 | VCPToolBox SciCalculator | 低 | 可通过 MCP 实现 |
| 搜索插件 | VCPToolBox Google/Tavily | 低 | 可通过 MCP 实现 |

---

## 总结

Cherry Studio 现在拥有**完全独立**的知识库检索能力：

1. **向量搜索**: 纯 TypeScript HNSW 实现
2. **TagMemo**: 纯 TypeScript PMI 共现矩阵 + 动态 Boost
3. **多级检索**: LightMemo / DeepMemo / MeshMemo / WaveRAG
4. **重排服务**: 多策略 Reranker
5. **增强功能**: 时间感知 + 语义组匹配

不再需要运行 VCPToolBox 后端服务器。

---

**文档版本**: 2.0
**更新日期**: 2024-12-30
**作者**: Cherry Studio Team
