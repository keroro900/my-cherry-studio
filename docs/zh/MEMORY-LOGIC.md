# 记忆系统代码逻辑

> **目的**: 帮助开发者理解记忆系统的调用层次和数据流

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      UI Layer (Renderer)                        │
│  页面组件 → Redux Store → IPC 调用                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ IPC
┌───────────────────────────▼─────────────────────────────────────┐
│                    IPC Layer (Main Process)                     │
│  MemoryIpcModule 统一注册 6 个 Handler                           │
│  ├── AdvancedMemoryIpcHandler (LightMemo/DeepMemo/MeshMemo)     │
│  ├── UnifiedMemoryIpcHandler                                    │
│  ├── AIMemoIpcHandler                                           │
│  ├── IntegratedMemoryIpcHandler                                 │
│  ├── MemoryMasterIpcHandler                                     │
│  └── SelfLearningIpcHandler                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 调用
┌───────────────────────────▼─────────────────────────────────────┐
│                  VCP BuiltinServices (废弃中)                    │
│  LightMemoService, DeepMemoService  ─→ 迁移到下层                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 调用
┌───────────────────────────▼─────────────────────────────────────┐
│               IntegratedMemoryCoordinator                       │
│               ═══════════════════════════                       │
│               【推荐入口】统一协调记忆检索、标签、学习             │
│                                                                 │
│  职责:                                                          │
│  • 多后端调度 (diary/lightmemo/deepmemo/knowledge/memory)       │
│  • RRF 结果融合                                                 │
│  • SelfLearning 权重应用                                        │
│  • 查询记录和反馈学习                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 编排
┌───────────────────────────▼─────────────────────────────────────┐
│                    Algorithm Layer                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge/lightMemo/LightMemoService.ts                  │   │
│  │ • BM25 关键词检索                                        │   │
│  │ • 向量语义检索                                           │   │
│  │ • 分数融合 (bm25Weight + semanticWeight)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge/deepMemo/DeepMemoService.ts                    │   │
│  │ • Tantivy 全文搜索 (或 BM25 fallback)                    │   │
│  │ • 向量语义检索                                           │   │
│  │ • Reranker 精排                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge/tagmemo/index.ts                               │   │
│  │ • PMI 共现矩阵                                          │   │
│  │ • Tag Boost 算法                                        │   │
│  │ • 标签扩展                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge/tagmemo/SelfLearningService.ts                 │   │
│  │ • 学习权重调整                                          │   │
│  │ • 反馈记录                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 存储
┌───────────────────────────▼─────────────────────────────────────┐
│                     Storage Layer                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ services/memory/MemoryService.ts                         │   │
│  │ • LibSQL 数据库                                          │   │
│  │ • 向量存储                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ memory/storage/VectorIndexService.ts                     │   │
│  │ • 内存向量索引                                          │   │
│  │ • 余弦相似度搜索                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 检索流程详解

### 1. 智能搜索流程

```
用户查询
    │
    ▼
IntegratedMemoryCoordinator.intelligentSearch(query, options)
    │
    ├── 1. 解析搜索选项 (backends, topK, applyLearning)
    │
    ├── 2. 并行调用各后端
    │      ├── diary: DiaryService
    │      ├── lightmemo: LightMemoService
    │      ├── deepmemo: DeepMemoService
    │      ├── knowledge: KnowledgeService
    │      └── memory: MemoryService
    │
    ├── 3. RRF 结果融合
    │      └── rrfFuse(allResults, { k: 60 })
    │
    ├── 4. 应用 SelfLearning 权重
    │      └── selfLearning.applyWeights(results, query)
    │
    ├── 5. 可选: 记录查询
    │      └── selfLearning.recordQuery(query)
    │
    └── 6. 返回排序结果
```

### 2. LightMemo 检索流程

```
query + queryEmbedding
    │
    ▼
LightMemoService.search(query, queryEmbedding, config)
    │
    ├── 1. BM25 关键词搜索
    │      └── bm25Index.search(query, k1, b)
    │
    ├── 2. 向量语义搜索 (如果有 embedding)
    │      └── cosineSimilarity(queryEmbedding, docEmbedding)
    │
    ├── 3. 分数融合
    │      └── score = bm25Weight * bm25 + semanticWeight * semantic
    │
    └── 4. 可选: 快速重排序
           └── applyQuickRerank(query, results)
```

### 3. DeepMemo 两阶段检索

```
query + queryEmbedding
    │
    ▼
DeepMemoService.search(query, queryEmbedding, config)
    │
    ├── Phase 1: 关键词检索 (Tantivy 或 BM25 fallback)
    │      └── keywordSearch(query, initialTopK)
    │
    ├── Phase 2: 向量语义检索
    │      └── semanticSearch(queryEmbedding, initialTopK)
    │
    ├── Phase 3: 分数融合
    │      └── fuseResults(keywordScores, semanticScores, weights)
    │
    └── Phase 4: Rerank (可选)
           └── rerankFn(query, fusedResults) 或 defaultRerank
```

---

## 新增功能开发指南

### 添加新检索策略

1. **在 `knowledge/` 下创建新模块**
   ```
   knowledge/
   └── newStrategy/
       ├── index.ts
       └── NewStrategyService.ts
   ```

2. **实现标准检索接口**
   ```typescript
   export class NewStrategyService {
     async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
       // 实现检索逻辑
     }
   }
   ```

3. **在 IntegratedMemoryCoordinator 中注册**
   ```typescript
   // IntegratedMemoryCoordinator.ts
   case 'newstrategy':
     results = await this.newStrategySearch(query, options)
     break
   ```

4. **不要创建新的"统一入口"** ❌

### 添加新 IPC 通道

1. **在现有 Handler 中添加**
   ```typescript
   // 选择最相关的 Handler，如 IntegratedMemoryIpcHandler.ts
   ipcMain.handle('IntegratedMemory_NewFeature', async (_, params) => {
     return await coordinator.newFeature(params)
   })
   ```

2. **在 MemoryIpcModule 中确认注册**
   ```typescript
   // 确保 Handler 已在 modules 数组中
   const modules = [
     { name: 'IntegratedMemory', register: registerIntegratedMemoryIpcHandlers },
     // ...
   ]
   ```

3. **在 IpcChannel.ts 中添加常量**
   ```typescript
   IntegratedMemory_NewFeature = 'IntegratedMemory_NewFeature'
   ```

---

## 关键文件快速索引

| 功能 | 文件路径 |
|------|---------|
| 协调器入口 | `services/memory/IntegratedMemoryCoordinator.ts` |
| 轻量检索 | `knowledge/lightMemo/LightMemoService.ts` |
| 深度检索 | `knowledge/deepMemo/DeepMemoService.ts` |
| 标签增强 | `knowledge/tagmemo/index.ts` |
| 自学习 | `knowledge/tagmemo/SelfLearningService.ts` |
| RRF 融合 | `memory/utils/RRFUtils.ts` |
| 类型定义 | `memory/types/index.ts` |
| IPC 注册 | `services/memory/MemoryIpcModule.ts` |
| 存储服务 | `services/memory/MemoryService.ts` |

---

*最后更新: 2026-01*
