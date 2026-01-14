# VCP 知识库与记忆系统架构指南

> 深入理解 Cherry Studio 中知识库、全局记忆与 VCP 系统的协调关系

---

## 目录

1. [系统总览](#1-系统总览)
2. [两套记忆系统的区别](#2-两套记忆系统的区别)
3. [四种高级记忆后端](#3-四种高级记忆后端)
4. [VCP 搜索服务统一入口](#4-vcp-搜索服务统一入口)
5. [日记模式语法详解](#5-日记模式语法详解)
6. [实际使用路径](#6-实际使用路径)
7. [常见问题排查](#7-常见问题排查)

---

## 1. 系统总览

Cherry Studio 包含两套独立的记忆/检索系统：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cherry Studio 记忆/检索系统                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────┐   │
│  │      全局记忆系统            │    │        VCP 知识检索系统           │   │
│  │  (Global Memory)            │    │    (Knowledge Retrieval)         │   │
│  │                             │    │                                  │   │
│  │  • 对话自动记忆              │    │  • 知识库 RAG 检索               │   │
│  │  • 用户偏好存储              │    │  • 日记声明语法                  │   │
│  │  • 向量存储 (LibSQL)         │    │  • 多后端检索引擎                │   │
│  │  • 按用户隔离                │    │  • Agent 上下文增强              │   │
│  └─────────────────────────────┘    └──────────────────────────────────┘   │
│              │                                   │                          │
│              ▼                                   ▼                          │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────┐   │
│  │      MemoryService          │    │      VCPSearchService            │   │
│  │  src/main/services/         │    │  src/main/knowledge/vcp/         │   │
│  └─────────────────────────────┘    └──────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 两套记忆系统的区别

### 2.1 全局记忆 (Global Memory)

**用途**: 存储对话中的重要信息，跨会话持久化

**入口**: 设置 → 记忆设置

**功能**:
- 自动/手动添加记忆条目
- 按用户隔离存储
- 向量语义检索
- 在对话中自动注入相关记忆

**存储**: LibSQL 数据库 (`memories.db`)

**代码位置**:
- 服务: `src/main/services/MemoryService.ts`
- UI: `src/renderer/src/pages/settings/MemorySettings/`

### 2.2 VCP 知识检索 (Knowledge Retrieval)

**用途**: 从知识库中检索相关内容，增强 AI 回复

**入口**: 知识库页面 → 选择知识库 → VCP 日记 / Agent 管理 / 上下文注入

**功能**:
- 四种检索后端 (LightMemo/DeepMemo/MeshMemo/TagMemo)
- 日记声明语法控制检索策略
- Agent 系统提示词模板
- 上下文注入规则

**存储**: 各知识库独立的向量索引

**代码位置**:
- 后端服务: `src/main/knowledge/`
- UI: `src/renderer/src/pages/knowledge/components/`

### 2.3 协调关系

两套系统**独立运行**，但可以**协同增强** AI 上下文：

```
用户消息
    │
    ├──► 全局记忆检索 ──► 相关记忆条目
    │                          │
    ├──► VCP 知识检索 ──► 相关知识片段
    │                          │
    └──────────────────────────┼──► 合并注入到对话上下文
                               │
                               ▼
                          AI 生成回复
```

---

## 3. 四种高级记忆后端

### 3.1 后端对比表

| 后端 | 算法 | 适用场景 | 性能 | 特点 |
|------|------|----------|------|------|
| **LightMemo** | BM25 + 向量 | 中小规模文档 | ⚡ 最快 | 纯 JS 实现，低延迟 |
| **DeepMemo** | Tantivy/BM25 + Rerank | 大规模文档 | 🔍 最精准 | 支持自定义 Reranker |
| **MeshMemo** | 过滤 + 向量 + MMR | 结构化数据 | 📊 最灵活 | 12 种过滤操作符 |
| **TagMemo** | 共现矩阵 + 标签网络 | 标签丰富数据 | 🏷️ 最智能 | 标签自动扩展 |

### 3.2 LightMemo 详解

**工作原理**:
1. BM25 关键词匹配 (权重 30%)
2. 向量语义相似度 (权重 70%)
3. 可选的快速重排

**配置参数**:
```typescript
{
  k1: 1.5,           // BM25 词频饱和度
  b: 0.75,           // 文档长度归一化
  bm25Weight: 0.3,   // BM25 权重
  semanticWeight: 0.7, // 语义权重
  quickRerank: true  // 快速重排
}
```

**使用场景**: 日常知识库检索，小型 FAQ 系统

### 3.3 DeepMemo 详解

**工作原理**:
1. TantivyLikeAdapter 全文检索 (BM25+)
2. 向量语义检索
3. 可选的 Reranker 精排

**配置参数**:
```typescript
{
  keywordWeight: 0.4,    // 关键词权重
  semanticWeight: 0.6,   // 语义权重
  enableRerank: true,    // 启用精排
  finalTopK: 10          // 最终返回数量
}
```

**使用场景**: 技术文档检索，学术论文搜索

### 3.4 MeshMemo 详解

**工作原理**:
1. 元数据过滤 (支持复杂条件)
2. 向量召回
3. MMR 多样性采样
4. 可选时间衰减

**过滤操作符**:
| 操作符 | 说明 | 示例 |
|--------|------|------|
| `equals` | 精确匹配 | `category: "技术"` |
| `contains` | 包含 | `tags: ["AI", "ML"]` |
| `in` | 在列表中 | `status: ["active", "pending"]` |
| `range` | 范围 | `price: [100, 500]` |
| `regex` | 正则 | `title: /^VCP.*$/` |
| `any_of` | 任一匹配 | 多条件 OR |
| `all_of` | 全部匹配 | 多条件 AND |

**使用场景**: 电商商品检索，结构化数据库查询

### 3.5 TagMemo 详解

**工作原理**:
1. **Lens 阶段**: 从查询中提取标签
2. **Expansion 阶段**: 通过共现矩阵扩展相关标签
3. **Focus 阶段**: Spike Enhancement 突出重要标签

**Spike Enhancement 公式**:
```
spiked_weight = weight^α / log(global_freq + β)

其中:
α = 1.0 + (1 - avg_score) * 0.5  // 动态 alpha
β = 1.0 + avg_score * 2.0         // 动态 beta
```

**使用场景**: 时尚推荐，标签丰富的内容检索

---

## 4. VCP 搜索服务统一入口

### 4.1 VCPSearchService 架构

```
┌────────────────────────────────────────────────────────────────┐
│                      VCPSearchService                          │
│                  (统一搜索入口 + RRF 融合)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │LightMemo │  │DeepMemo  │  │MeshMemo  │  │TagMemo   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       │              │             │             │             │
│       └──────────────┼─────────────┼─────────────┘             │
│                      ▼             ▼                           │
│              ┌──────────────────────────┐                      │
│              │    RRF 融合 (k=60)       │                      │
│              └──────────────────────────┘                      │
│                          │                                     │
│  ┌───────────────────────┼───────────────────────────────────┐ │
│  │                  增强模块                                  │ │
│  │  ├─ TimeAwareSearch (时间感知)                            │ │
│  │  ├─ SemanticGroupSearch (语义组)                          │ │
│  │  ├─ DiaryModeParser (日记语法解析)                        │ │
│  │  └─ TagMemo (标签网络增强)                                │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 搜索配置

```typescript
interface VCPSearchConfig {
  // 搜索模式
  mode?: 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'

  // 后端选择
  backend?: 'lightmemo' | 'deepmemo' | 'meshmemo' | 'auto'

  // 时间感知
  timeAware?: boolean
  timeRange?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'
  timeDecay?: boolean

  // 语义组增强
  semanticGroups?: string[]

  // TagMemo 增强
  tagMemo?: boolean
  tagMemoThreshold?: number  // 默认 0.65

  // RRF 融合
  rrfEnabled?: boolean
  rrfK?: number  // 默认 60

  // 结果限制
  topK?: number
  threshold?: number
}
```

---

## 5. 日记模式语法详解

### 5.1 四种基础声明

| 语法 | 模式 | 触发条件 | 适用场景 |
|------|------|----------|----------|
| `{{知识库}}` | fulltext | 始终注入 | 小型知识库，全文引用 |
| `[[知识库]]` | rag | 始终检索 | 大型知识库，语义检索 |
| `<<知识库>>` | threshold_fulltext | 相似度达标 | 条件性全文注入 |
| `《《知识库》》` | threshold_rag | 相似度达标 | 条件性 RAG 检索 |

### 5.2 修饰符语法

**格式**: `[[知识库::修饰符1::修饰符2]]`

| 修饰符 | 功能 | 示例 |
|--------|------|------|
| `::Time` | 时间感知，优先近期内容 | `[[日记::Time]]` |
| `::Group` | 使用默认语义组 | `[[时尚::Group]]` |
| `::Group(a,b,c)` | 自定义语义组 | `[[时尚::Group(颜色,风格)]]` |
| `::TagMemo0.7` | 标签网络增强 (阈值 0.7) | `[[知识库::TagMemo0.65]]` |
| `::K10` / `::TopK10` | 限制返回数量 | `[[文档::K5]]` |
| `::Threshold0.8` | 相似度阈值 | `[[文档::Threshold0.6]]` |
| `::Rerank` | 启用精排 | `[[文档::Rerank]]` |
| `::LightMemo` | 使用 LightMemo 后端 | `[[知识库::LightMemo]]` |
| `::DeepMemo` | 使用 DeepMemo 后端 | `[[知识库::DeepMemo]]` |
| `::MeshMemo` | 使用 MeshMemo 后端 | `[[知识库::MeshMemo]]` |

### 5.3 组合示例

```markdown
# 时尚推荐场景
[[时尚日记::Time::TagMemo0.6::K5::Group(颜色,风格,场合)]]

# 技术文档检索
[[技术文档::DeepMemo::Threshold0.8::Rerank]]

# 多知识库组合
请参考以下资料：
[[产品手册::K3]]
[[FAQ文档::TagMemo0.7]]
{{最新公告}}
```

---

## 6. 实际使用路径

### 6.1 场景一：创建智能 Agent

1. **进入 Agent 管理**
   - 知识库页面 → 选择知识库 → Agent 管理 Tab

2. **创建 Agent**
   - 点击"新建 Agent"
   - 填写名称、描述
   - 编写系统提示词（可使用日记声明和变量）

3. **系统提示词示例**
   ```markdown
   你是 {{VarAssistantName}}，一位专业的 {{VarExpertise}} 顾问。

   当前时间：{{current_datetime}}

   参考以下知识：
   [[产品文档::Time::K5]]
   {{FAQ知识库}}

   用户问题：{{TarUserInput}}
   ```

4. **激活 Agent**
   - 点击"激活"按钮
   - Agent 将在对话中自动应用

### 6.2 场景二：配置上下文注入

1. **进入上下文注入**
   - 知识库页面 → 选择知识库 → 上下文注入 Tab

2. **创建注入规则**
   - 点击"新建规则"
   - 设置注入位置（系统提示词开头/结尾、用户消息前/后等）
   - 设置触发条件（始终触发、关键词触发、正则匹配等）
   - 编写注入内容

3. **注入位置说明**
   | 位置 | 效果 |
   |------|------|
   | 系统提示词开头 | 在 AI 指令最前面插入 |
   | 系统提示词结尾 | 在 AI 指令最后面插入 |
   | 用户消息前 | 在用户输入前插入背景信息 |
   | 用户消息后 | 在用户输入后追加说明 |
   | 隐藏注入 | 注入但不在界面显示 |

4. **使用预设**
   - "导演模式" - 适合故事创作
   - "角色扮演增强" - 适合角色扮演场景

### 6.3 场景三：使用高级记忆后端

1. **进入高级记忆设置**
   - 设置 → 记忆设置 → 高级记忆

2. **测试各后端**
   - 选择后端类型（LightMemo/DeepMemo/MeshMemo）
   - 输入测试查询
   - 查看检索结果和性能

3. **在日记声明中指定后端**
   ```markdown
   [[知识库::DeepMemo::Rerank]]  # 使用 DeepMemo + 精排
   [[知识库::MeshMemo]]          # 使用 MeshMemo
   ```

---

## 7. 常见问题排查

### Q1: 知识库检索没有结果

**排查步骤**:
1. 确认知识库名称正确（区分大小写）
2. 确认知识库已建立索引
3. 尝试降低 `::Threshold` 值
4. 检查开发者工具控制台错误

### Q2: Agent 没有生效

**排查步骤**:
1. 确认 Agent 已激活（绿色状态）
2. 确认在正确的知识库下创建
3. 检查系统提示词语法是否正确

### Q3: 模板变量没有替换

**排查步骤**:
1. 检查变量格式：`{{VarName}}`
2. 确认变量已在"变量管理"中定义
3. 检查变量作用域（全局/Agent级/会话级）

### Q4: 日记声明语法高亮不正确

**原因**: 编辑器可能需要刷新
**解决**: 切换到其他 Tab 再切回来

### Q5: 上下文注入规则不触发

**排查步骤**:
1. 确认规则状态为"激活"
2. 使用"测试注入"功能验证条件
3. 检查触发条件是否正确配置

---

## 附录：关键文件索引

### 后端服务

| 服务 | 路径 | 功能 |
|------|------|------|
| VCPSearchService | `src/main/knowledge/vcp/VCPSearchService.ts` | 统一搜索入口 |
| LightMemoService | `src/main/knowledge/lightMemo/LightMemoService.ts` | BM25+向量检索 |
| DeepMemoService | `src/main/knowledge/deepMemo/DeepMemoService.ts` | Tantivy+Rerank |
| MeshMemoService | `src/main/knowledge/meshMemo/GenericMeshMemoService.ts` | 过滤+向量+MMR |
| TagMemoService | `src/main/knowledge/tagmemo/TagMemoService.ts` | 标签网络 |
| VCPAgentService | `src/main/knowledge/agent/VCPAgentService.ts` | Agent 管理 |
| ContextInjectorService | `src/main/knowledge/agent/ContextInjectorService.ts` | 上下文注入 |
| DiaryModeParser | `src/main/knowledge/modes/DiaryModeParser.ts` | 日记语法解析 |

### 前端组件

| 组件 | 路径 | 功能 |
|------|------|------|
| KnowledgeContent | `src/renderer/src/pages/knowledge/KnowledgeContent.tsx` | 知识库主页 |
| DiaryEditor | `src/renderer/src/pages/knowledge/components/Diary/DiaryEditor.tsx` | 日记编辑器 |
| AgentManager | `src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx` | Agent 管理 |
| ContextInjector | `src/renderer/src/pages/knowledge/components/Agent/ContextInjector.tsx` | 上下文注入 |
| AdvancedMemorySettings | `src/renderer/src/pages/settings/MemorySettings/AdvancedMemorySettings.tsx` | 高级记忆设置 |

### IPC 通道

| 类别 | 通道前缀 |
|------|----------|
| Agent 管理 | `VCP_Agent_*` |
| 变量管理 | `VCP_Variable_*` |
| 模板管理 | `VCP_Template_*` |
| 注入规则 | `VCP_Injector_Rule_*` |
| 注入预设 | `VCP_Injector_Preset_*` |
| 日记操作 | `VCP_Diary_*` |
| 搜索操作 | `VCP_Search_*` |

---

> 更多技术细节请参考 [VCP-ARCHITECTURE.md](../VCP-ARCHITECTURE.md) 和 [VCP-USER-GUIDE.md](./VCP-USER-GUIDE.md)
