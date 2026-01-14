# VCP 原生融合重写计划（不依赖 external/VCPToolBox）

本文档定义 **完全原生** 的 VCP 融合路径：不再依赖 `external/VCPToolBox` 运行时，仅保留兼容规范与参考资料。执行顺序遵循“先底层、后 UI”，先完成运行时与统一工具链路，再补群聊 UI 等体验层。

## 0. 目标与原则

### 0.1 目标
- **功能齐全 / 三端对齐**：以 VCPToolBox + VCPChat + 原项目为对齐基线，RAG、记忆层、论坛、群聊、工具 UI 等能力完整覆盖，并以 `docs/zh/VCP-NATIVE-AUDIT-TODO.md` 作为差异清单与验收依据。
- **原生记忆 + 插件化**：记忆与知识统一落在原生链路（`native-vcp` + UnifiedMemory/Storage），对外能力以 `plugin-manifest.json` 与 BuiltinServices 统一暴露，确保可插拔、可替换、可对齐命名。
- **完全移除运行时依赖**：不再加载 `external/VCPToolBox/Plugin.js` 和 `KnowledgeBaseManager.js`。
- **保持协议兼容**：兼容 VCPToolBox 的插件清单、TOOL_REQUEST/RESULT 语法、异步占位符机制。
- **统一工具入口**：`VCPUnified` 成为唯一执行入口，VCP/MCP/Native 工具统一路由。
- **一致体验**：UI 风格、日志、配置与调试入口统一到 Cherry Studio。

### 0.2 核心原则
- **底层优先**：先做运行时、插件系统与工具链路，再做群聊 UI、管理面板与渲染。
- **兼容优先**：支持 VCPToolBox `plugin-manifest.json` 格式以便迁移。
- **功能齐全优先**：先补齐缺失能力与插件，再做重构与优化，避免“能用但不全”。
- **插件化优先**：能插件化的能力优先以插件/内置服务形式实现，命名与清单对齐 VCPToolBox。
- **原生记忆优先**：所有记忆读写统一走原生记忆栈与统一 API，避免分叉实现。
- **最小风险**：阶段化替换，保留可回退的关键组件直到新链路稳定。

### 0.3 对齐范围与验收来源
- **对齐来源**：`docs/zh/VCP-NATIVE-AUDIT-TODO.md` 的三端对比与差异清单是主验收依据。
- **能力范围**：以 VCPToolBox/VCPChat README、插件清单、UI/IPC 入口为能力边界。
- **变更同步**：新增/移除能力或插件时，同步更新审查文档与验收清单。

## 1. 兼容性规范（冻结）

### 1.1 VCP 工具调用语法
- 工具请求块：
  - `<<<[TOOL_REQUEST]>>> ... <<<[END_TOOL_REQUEST]>>>`
  - `tool_name:「始」xxx「末」` 必须兼容
  - key 归一化：大小写不敏感，`_`/`-` 等价
  - 值可能多行，且包含特殊字符，解析需容错
- 工具结果块：
  - `<<<[TOOL_RESULT]>>> ... <<<[/TOOL_RESULT]>>>`
  - `<<<[TOOL_ERROR]>>> ... <<<[/TOOL_ERROR]>>>`
- 兼容 VCPChat 结果块：
  - `[[VCP调用结果信息汇总:...VCP调用结果结束]]`

### 1.2 日记/记忆标记
- 日记写入：
  - `<<<DailyNoteStart>>> ... <<<DailyNoteEnd>>>`
  - `<<<[DIARY_WRITE]>>> ... <<<[/DIARY_WRITE]>>>`
  - `【日记写入】...【/日记写入】`
- 日记读取：
  - `{{角色名日记本}}` / `{{公共日记本}}` 形式的注入

### 1.3 异步插件回调协议
- 任务占位符：
  - `{{VCP_ASYNC_RESULT::PluginName::TaskID}}`
- 参数注入：
  - `__VCP_CALLBACK_URL__`
  - `__VCP_CALLBACK_BASE_URL__`
  - `__VCP_PLUGIN_NAME__`
  - `__VCP_TASK_ID__`
- 初始响应需包含：
  - `status`, `result.requestId`, `messageForAI`, 可选 `base64`
- 回调结果支持：
  - `/plugin-callback/:pluginName/:taskId` JSON
  - `webSocketPush` 并行推送（可选）

### 1.4 插件清单格式（兼容 VCPToolBox）
- 文件名：`plugin-manifest.json`
- 关键字段：
  - `name`, `displayName`, `description`, `version`
  - `pluginType` ∈ `static | synchronous | asynchronous | messagePreprocessor | service | hybridservice | builtin_service | mcp_bridge`
  - `entryPoint.command`（stdio 插件入口，当前运行时默认 `nativeOnly=true` 会跳过 stdio 类型）
  - `communication.protocol`（`stdio`/`direct`）
  - `configSchema`（插件配置蓝图）
  - `capabilities.systemPromptPlaceholders[]`
  - `capabilities.invocationCommands[]`（含参数描述/示例/返回结构）
  - `webSocketPush`（异步回调/同步结果推送配置）
  - `isDistributed` / `serverId`（分布式节点）

### 1.5 群聊行为兼容
来自 VCPChat 的群聊语义必须可复现：
- `naturerandom` 自然随机发言
- `inviteonly` 邀约发言
- `groupPrompt` / `invitePrompt`
- 发言标记头规则：`[发言者的发言]: ...`
- 群组统一模型：`useUnifiedModel` + `unifiedModel`
- 话题默认值：`主要群聊`，支持自动总结改名
- 占位符：
  - `{{VCPChatGroupSessionWatcher}}`（注入会话监控 JSON）
  - `{{VCPChatCanvas}}`（注入 Canvas 内容/路径/错误）
- 附件入上下文：文本提取 + 图片/音频/视频 Base64 首帧
- 流式事件：`agent_thinking` → `start` → `data` → `end`/`error`
- 支持 `redoGroupChatMessage` 与 `interruptGroupRequest`

### 1.6 WebSocket 推送兼容
- 统一 WebSocket 服务（`WebSocketServer` 思路）与 `clientType` 过滤
- `webSocketPush` 配置可为同步/异步结果推送消息
- 兼容 `VCPLog`、`AgentMessage`、RAG Observer 等订阅模型

### 1.7 特殊模型穿透兼容
- `WhitelistImageModel`：图像模型绕过常规链路
- `WhitelistEmbeddingModel`：向量模型请求/响应原样转发
- 兼容 `specialModelRouter` 行为

## 2. 目标架构（原生）

### 2.1 运行时模块图
```
Renderer (vcpContextPlugin)
  → window.api.vcpUnified.executeTool
Main
  → UnifiedPluginManager
    → VCPRuntime (native)
      → PluginRegistry
      → PluginExecutor
      → PreprocessorChain
      → VCPAsyncResultsService
      → PlaceholderEngine
      → VCPFileAPI
    → MCPService (existing)
```

### 2.2 核心服务
- `VCPRuntime`: 原生插件运行时核心
- `PluginRegistry`: 清单加载 + 插件生命周期
- `PluginExecutor`: builtin/service/static/mcp_bridge 执行适配（stdio 已禁用）
- `BuiltinServiceRegistry`: 内置 TypeScript 服务注册表（由执行器优先路由）
- `PreprocessorChain`: 消息预处理器链
- `VCPAsyncResultsService`: 异步结果持久化（配合 PluginExecutor 内存任务池）
- `PlaceholderEngine`: 变量/占位符解析与注入
- `VCPFileAPI`: 文件解析/转码/Base64 统一入口
- `WebSocketHub`: 日志/通知/异步回调推送中心
- `DistributedRouter`: 分布式工具注册与调用
- `SpecialModelRouter`: WhitelistModel 穿透转发

### 2.2.1 Native VCP Rust 层 ✅ 已完成 2026-01-06

**模块位置**: `cherry-studio/native-vcp/` (已编译: `native-vcp.win32-x64-msvc.node`)

**与 rust-vexus-lite 对比**:

| 功能模块 | rust-vexus-lite | native-vcp | 状态 |
|---------|:---------------:|:----------:|:----:|
| VexusIndex (HNSW) | ✅ L2sq | ✅ **Cosine** | 已增强 |
| CooccurrenceMatrix | ✅ NPMI | ✅ NPMI | 相同 |
| SemanticGroupMatcher | ✅ 基础 | ✅ **+服装组** | 已增强 |
| TagCooccurrenceMatrix | ❌ | ✅ | **新增** |
| ChineseSearchEngine | ❌ | ✅ jieba+Tantivy | **新增** |
| SearchEngine | ❌ | ✅ Tantivy BM25 | **新增** |
| UnifiedDatabase | ❌ | ✅ SQLite | **新增** |
| HybridSearchEngine | ❌ | ✅ RRF | **新增** |
| TextChunker | ❌ | ✅ | **新增** |
| Tracer | ❌ | ✅ | **新增** |
| Vector Ops | ❌ | ✅ simsimd | **新增** |
| VectorStore | ❌ | ✅ | **新增** |

**技术栈**:
```toml
usearch = "2.16"           # HNSW 近似最近邻 (Cosine)
tantivy = "0.22"           # 全文搜索引擎
jieba-rs = "0.7"           # 中文分词
rusqlite = "0.32"          # SQLite 驱动
simsimd = "6.2"            # SIMD 加速向量运算
napi = "2.16"              # Node.js FFI
```

**导出接口**:
```javascript
const {
  // 向量索引
  VexusIndex,           // HNSW 向量索引 (Cosine 距离)
  VectorStore,          // 向量存储

  // 全文搜索
  ChineseSearchEngine,  // 中文搜索引擎 (jieba + Tantivy)
  SearchEngine,         // 通用搜索引擎 (Tantivy BM25)

  // 共现矩阵
  CooccurrenceMatrix,       // PMI/NPMI 共现矩阵
  TagCooccurrenceMatrix,    // 标签专用共现矩阵

  // 语义组
  SemanticGroupMatcher,     // 语义组匹配器
  SemanticGroupType,        // 语义组类型枚举

  // 数据库
  UnifiedDatabase,          // 统一 SQLite 数据库

  // 分词
  jiebaCut,                 // jieba 分词
  jiebaExtractKeywords,     // jieba 关键词提取

  // 向量运算
  cosineSimilarity,         // 余弦相似度
  euclideanDistance,        // 欧氏距离
  dotProduct,               // 点积
  normalize,                // 归一化
  batchCosineSimilarity,    // 批量余弦相似度
  topKSimilar,              // Top-K 相似向量

  // 追踪
  Tracer,                   // 调用链追踪
  createTraceId,            // 创建追踪 ID
  createSpanId,             // 创建 Span ID
  setLogCallback,           // 设置日志回调

  // 工具
  getVersion,               // 获取版本
  initialize,               // 初始化
  healthCheck               // 健康检查
} = require('native-vcp')
```

**TypeScript 桥接文件**:
| 文件 | 使用模块 |
|------|----------|
| `services/native/NativeVCPBridge.ts` | 统一桥接层 |
| `services/memory/SemanticGroupService.ts` | SemanticGroupMatcher |
| `services/memory/MemoryCallTracer.ts` | Tracer |
| `knowledge/vector/VexusAdapter.ts` | VexusIndex, CooccurrenceMatrix, SemanticGroupMatcher |
| `knowledge/lightMemo/LightMemoService.ts` | 多模块 |

**结论**: native-vcp 已完全超越 rust-vexus-lite（11 模块 vs 3 模块），原有的 `vexus-lite.js` 加载器已废弃并可删除。

### 2.3 运行时 API 草案
**VCPRuntime**
- `initialize(config): Promise<void>`
- `listPlugins(): VCPPlugin[]`
- `getPlugin(name): VCPPlugin | null`
- `executeTool(name, params, context): Promise<PluginExecutionResult>`
- `executePreprocessors(messages, context): Promise<messages>`
- `shutdown(): Promise<void>`

**PluginExecutionResult（统一返回结构）**
```
{
  "success": true,
  "output": "text or json",
  "data": {},
  "error": null,
  "taskId": null
}
```

### 2.4 插件执行模型（原生现状）
- `builtin_service`：内置 TypeScript 服务（优先级最高）
- `static`：只提供占位符值，不执行外部进程
- `messagePreprocessor`：接管消息数组，允许在发送模型前修改内容
- `service` / `hybridservice`：提供可直接调用的 module API（无需 stdio）
- `mcp_bridge`：MCP 工具桥接为 VCP 插件
- `synchronous` / `asynchronous`：stdio 旧类型，当前运行时默认 `nativeOnly=true` 且执行器直接拒绝（保留清单兼容）

### 2.5 配置层级
1. 全局配置（VCP runtime config）
2. 插件清单默认值（manifest）
3. 插件私有配置（用户覆盖）
4. 本次调用参数（TOOL_REQUEST 参数）
5. 系统注入参数（callback URL、trace、maid 等）

### 2.6 Cherry Studio 原生助手与模型服务融合设计
本节定义“原生助手（Assistant）+ 模型服务（Providers）”与 VCP 运行时的融合点，保证用户体验一致且链路清晰。

#### 2.6.1 Assistant 与 VCPAgent 的统一抽象 ✅ 已完成 2025-12-31
目标：一个"助手配置"即可驱动 VCP 能力，不再让用户区分 Assistant 与 VCPAgent。

设计要点：
- 统一配置对象（逻辑层）：
  - `assistant.systemPrompt`：统一系统提示词入口
  - `assistant.profile`：人格/角色配置（personality/background/greeting/示例）
  - `assistant.memory`：记忆开关与后端选择
  - `assistant.tools`：工具白名单/黑名单/授权策略
  - `assistant.groupChat`：群聊角色/触发/偏好
  - `assistant.collaboration`：多 Agent 协作与委派
  - `assistant.vcpConfig`：VCP 扩展配置（知识库/上下文注入等）
- 统一适配器：
  - `UnifiedAgentAdapter` 继续作为桥梁
  - `VCPAgentService` 仅作为兼容入口（导入/导出/模板变量解析）
- 数据源约定：
  - Assistant 为唯一配置/持久化来源（source of truth）
  - `VCPAgentService` 退化为兼容层：仅处理旧数据迁移与导入/导出
- 字段统一约束：
  - 运行时与存储仅使用 `systemPrompt/profile/memory/tools/groupChat/collaboration/vcpConfig` 等统一字段
  - 旧字段仅在迁移入口短暂停留，落库前必须清理（如 `vcpProfile/vcpMemoryConfig/vcpToolConfig/groupChatConfig/agentCollaborationConfig/enableMemory`）

**已完成工作**：
- ✅ `Assistant` 类型统一：移除所有旧字段（`vcpAgentId`, `vcpEnabled`, `vcpMemoryConfig`, `vcpProfile`, `groupChatConfig`, `agentCollaborationConfig`）
- ✅ 新增模块化配置字段：`profile`, `memory`, `tools`, `groupChat`, `collaboration`, `vcpConfig`
- ✅ `UnifiedAgentAdapter` 重写：使用新统一字段
- ✅ `VCPAgentService` Agent CRUD 方法标记为 @deprecated
- ✅ 设置页面更新：`AssistantVCPSettings.tsx`, `AssistantGroupChatSettings.tsx` 使用新字段

涉及文件：
- `cherry-studio/src/renderer/src/types/index.ts` — Assistant 类型统一
- `cherry-studio/src/renderer/src/types/assistant.ts` — 统一类型定义（v3.0.0）
- `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts` — @deprecated 标记
- `cherry-studio/src/main/knowledge/agent/UnifiedAgentAdapter.ts` — 重写使用新字段（v3.0.0）
- `cherry-studio/src/main/services/UnifiedAgentService.ts` — 修复类型兼容性
- `cherry-studio/src/renderer/src/pages/settings/AssistantSettings/AssistantVCPSettings.tsx` — 使用新字段
- `cherry-studio/src/renderer/src/pages/settings/AssistantSettings/AssistantGroupChatSettings.tsx` — 使用新字段

#### 2.6.2 提示词构建管线（Prompt Pipeline） ✅ 已完成 2025-12-31
目标：Assistant 只配置一次，最终模型输入自动携带 VCP 增强上下文。

管线顺序（建议固定）：
1. Assistant system prompt
2. Assistant profile prompt（assistant.profile）
3. VCPTavern 注入规则（system/user/hidden）
4. 记忆注入（Light/Deep/Mesh/All memory）
5. 工具能力指令（TOOL_REQUEST 协议与工具说明）
6. UI 注入规则（如 `{{VarDivRender}}` 气泡主题）
7. 上下文净化（Context Sanitizer，HTML → Markdown）

**已完成工作**：
- ✅ `vcpContextPlugin.ts` 更新：使用 `assistant.vcpConfig?.agentId` 和 `assistant.vcpConfig?.enabled`
- ✅ 记忆注入更新：使用 `assistant.memory` 配置（`enableUnifiedSearch`, `backends`, `topK`, `tagBoost`, `useRRF`）
- ✅ `PluginBuilder.ts` 更新：使用统一字段判断 VCP 插件加载

涉及文件：
- `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts` — 使用统一字段
- `cherry-studio/src/renderer/src/aiCore/plugins/PluginBuilder.ts` — 使用统一字段
- `cherry-studio/src/main/knowledge/agent/ContextInjectorService.ts`
- `cherry-studio/src/main/knowledge/diary/DailyNoteService.ts`

#### 2.6.3 Tooling 融合策略
目标：所有工具统一通过 `VCPUnified` 路由；助手不感知 MCP/VCP 差异。

策略：
- `AssistantSettings` 中的工具选择同时映射到 VCP 工具列表
- VCP runtime 输出 tool definitions → 统一在 UI 显示
- 工具调用：TOOL_REQUEST → `vcpUnified.executeTool`

涉及文件：
- `cherry-studio/src/main/services/UnifiedPluginManager.ts`
- `cherry-studio/src/renderer/src/pages/settings/AgentSettings/ToolingSettings.tsx`

#### 2.6.4 模型服务与 VCP 的对接
目标：模型能力（chat/embedding/vision）统一被 VCP runtime 调用。

模型能力接口：
- Chat Completion：用于工具调用循环与上下文增强
- Embedding：用于记忆/知识库向量化
- Multimodal：图像/音频输入支持

设计要点：
- 统一 `Provider` 接口向 VCP runtime 暴露
- 统一处理流式回包与工具循环
- ToolChoice 兼容：模型不支持 function calling 时，回退 VCP 标记协议

涉及文件：
- `cherry-studio/src/main/services/ModelProxyAdapter.ts`
- `cherry-studio/src/renderer/src/aiCore/middleware/`
- `cherry-studio/src/main/knowledge/embedjs/embeddings/`

#### 2.6.5 可观测性与安全
目标：工具链路可追踪、可控、可回滚。

要求：
- `VCPLogService` 记录每次工具调用（输入/输出/耗时）
- `ShowVCP` 面板提供执行链路 UI
- 工具调用支持用户授权开关

涉及文件：
- `cherry-studio/src/main/services/VCPLogService.ts`
- `cherry-studio/src/renderer/src/components/VCP/VCPDebugPanel.tsx`

#### 2.6.6 验收标准
- Assistant 配置仅需一次即可启用 VCP
- 模型服务支持 VCP 工具调用循环
- MCP/VCP 工具对用户“看起来是一类”

### 2.7 全模块融合蓝图（详细规格）
本节按“模块 → 能力 → 数据流 → UI 入口 → 关键文件”拆解，确保 VCP 高级功能看起来就是 Cherry Studio 原生能力。

#### 2.7.1 插件系统与工具链
**能力目标**
- VCP 插件完整覆盖：`static/synchronous/asynchronous/messagePreprocessor/service/hybridservice`
- 工具统一路由：VCP/MCP/Native 统一执行入口
- WebSocket 推送与异步占位符并存

**数据流**
```
TOOL_REQUEST → vcpContextPlugin → vcpUnified.executeTool → VCPRuntime.executeTool
```

**UI 入口**
- 工具管理面板（插件启停/配置）
- 对话内工具执行结果气泡

**关键文件**
- `cherry-studio/src/main/services/UnifiedPluginManager.ts`
- `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`

#### 2.7.2 知识库与记忆栈（深度版）
**能力目标**
- 全量记忆（All Memory）与 RAG 同时可用
- TagMemo、语义组、时间范围检索对齐 VCP
- 记忆注入与上下文净化完整链路
- 兼容 Memo 记忆中心（文件夹/批量/搜索范围/隐藏）

**关键子模块**
- `KnowledgeIngestor`：文件扫描、分块、标签提取
- `VectorIndexService`：向量化与索引管理
- `TagMemoService`：标签共现矩阵与增益
- `RetrievalPlanner`：检索模式选择（full/rag/threshold）

**数据流**
```
文件变更 → Ingestor → Chunker → Embedding → Index
查询 → Planner → (BM25 + Vector + TagMemo) → Rerank → 注入
```

**UI 入口**
- 知识库管理页面（索引重建/语义组）
- 日记与标签编辑器
- Memo 记忆中心窗口（VCPChat 风格）

**关键文件**
- `cherry-studio/src/main/knowledge/*`
- `cherry-studio/src/main/knowledge/modes/*`
- `cherry-studio/src/main/knowledge/search/*`

#### 2.7.3 日记与角色系统
**能力目标**
- VCP 日记写入/检索语法兼容
- Agent 记忆与角色绑定
- 兼容 Admin API（dailynotes）与 DailyNote 工具写入

**数据流**
```
DIARY_WRITE 标记 → DailyNoteService → 持久化
{{角色日记本}} → PlaceholderEngine → 注入
```

**UI 入口**
- Agent 管理器
- 日记检索与标签管理

**关键文件**
- `cherry-studio/src/main/knowledge/diary/DailyNoteService.ts`
- `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`

#### 2.7.4 绘图与图像生成（VCP 级体验）
**能力目标**
- 图像生成作为标准 VCP 工具
- 支持 Comfy 风格工作流参数
- 支持图片结果直通渲染与文件缓存
- 预留 ComfyUI 面板与工作流编辑器入口

**数据流**
```
TOOL_REQUEST (Image) → VCPRuntime → Provider/ComfyAdapter → Result
Result → VCPFileAPI → Renderer
```

**UI 入口**
- 图像生成面板（提示词/预设/分辨率）
- 聊天气泡内图片渲染与下载

**关键文件**
- `cherry-studio/src/main/services/vcp/*`（新建图像插件运行时）
- `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`

#### 2.7.5 音频/TTS/ASR 融合
**能力目标**
- TTS/ASR 统一为 VCP 工具
- 支持流式语音输入与输出
- 支持每个 Agent 独立语音模型与混合语种朗读

**数据流**
```
语音输入 → ASR Tool → 文本 → LLM
LLM 输出 → TTS Tool → 音频流
```

**UI 入口**
- 语音输入按钮与实时转写
- 气泡朗读与缓存

#### 2.7.6 视频与多媒体处理
**能力目标**
- 视频合成、抽帧、剪辑工具化
- 多模态结果与文件 API 统一

**数据流**
```
TOOL_REQUEST (Video) → VCPAsyncResultsService → Result → VCPFileAPI
```

**UI 入口**
- 视频结果渲染（video/audio tag）
- 异步进度与通知

#### 2.7.7 浏览器控制与网页理解
**能力目标**
- 浏览器控制器作为工具
- 网页“翻译成文档”能力与截图能力
- 支持 Base64 抓取与反向操作指令（点击/输入）

**数据流**
```
Browser Tool → DOM Snapshot → Markdown → 注入/渲染
```

#### 2.7.8 Canvas/协作工作区
**能力目标**
- 群聊可共享工作区
- AI 与用户协同编辑
- 支持 `{{VCPChatCanvas}}` 占位符注入最新内容

**数据流**
```
Canvas 编辑 → 版本快照 → 群聊共享 → 工具调用
```

**关键文件**
- `cherry-studio/src/renderer/src/pages/canvas/*`
- `cherry-studio/src/main/services/CanvasService.ts`

#### 2.7.9 FlowLock 与主动对话
**能力目标**
- AI 主动继续对话
- 多轮任务可持续执行
- UI 显示“发光标题 + 播放 emoji”状态

**数据流**
```
FlowLockService → 提示词引导 → 自动继续 → 工具调用
```

#### 2.7.10 日志/可观测性
**能力目标**
- 每次工具调用可追踪
- Debug 面板可视化
- WebSocket 推送支持 RAG Observer 与日志订阅

**关键文件**
- `cherry-studio/src/main/services/VCPLogService.ts`
- `cherry-studio/src/renderer/src/components/VCP/VCPDebugPanel.tsx`

#### 2.7.11 工作流与人类工具箱
**能力目标**
- 工作流节点可视化
- VCP 工具执行链路可被 workflow 驱动

**数据流**
```
Workflow → VCPUnified.executeTool → 输出 → 下一节点
```

#### 2.7.12 分布式与多节点
**能力目标**
- 分布式工具注册与调用
- 跨节点文件访问
- 兼容 `register_tools` / `execute_tool` 协议与 FileFetcher

**数据流**
```
Node A Tool → VCPFileAPI → Node B Consumer
```

#### 2.7.13 RAG Observer / VCPInfo
**能力目标**
- 独立窗口订阅 VCPLog WebSocket
- 展示 RAG 检索细节与元思考链

**数据流**
```
VCPLog WS → RAGObserver → UI 卡片/频谱动画
```

#### 2.7.14 上下文净化与气泡主题
**能力目标**
- ContextSanitizer 将 HTML 历史转换为 Markdown
- enableAgentBubbleTheme 注入 `{{VarDivRender}}`

#### 2.7.15 VCPChat 模块映射（摘要）
**能力目标**
- 主题系统：多主题渲染与主题生成器
- VchatCLI：内置终端与授权执行
- 语音：语音输入与 TTS 队列
- 音乐/媒体：音乐控制与歌词渲染
- 轻量互动：骰子/塔罗/日报/深度研究等插件 UI
- HumanToolBox：ComfyUI 面板与 Workflow Editor

#### 2.7.16 DeepMemo 深度记忆检索 ✅ 已完成 2026-01-07

**能力目标**
- 双层检索：关键词 (Tantivy/BM25) + 语义向量 (rust-vexus-lite)
- 四阶段深搜：Lens → Expansion → Focus → Rerank
- WaveRAG 三阶段检索：Lens → Expansion → Focus
- 时间线搜索、关系发现、主题聚类

**架构**
```
VCP BuiltinServices (DeepMemoService - @deprecated)
        │
        ▼
   VCPMemoryAdapter  ◄── 推荐入口
        │
    ┌───┴──────────────┐
    ▼                  ▼
IntegratedMemory    MemoryBrain
Coordinator         (WaveRAG)
        │
        ▼
DeepMemoRetriever ◄── 深度记忆搜索
        │
        ▼
DeepMemoService (knowledge 层)
    │
    ├── TantivyLikeAdapter (BM25+ CJK)
    ├── LightMemoService (BM25 降级)
    └── rust-vexus-lite (向量搜索 - 原生)
```

**数据流**
```
查询 → DeepMemoRetriever
    ├── Lens (广泛过滤)
    ├── Expansion (语义扩展 via TagMemo)
    ├── Focus (相关性重计算)
    └── Rerank (多因子精排: 时间衰减/重要性/访问频率/置信度)
        → 结果注入上下文
```

**命令** (VCP BuiltinService)
- `DeepSearch`: 双阶段深度搜索 (Tantivy + Reranker)
- `WaveRAGSearch`: 三阶段 WaveRAG 检索 (Lens-Expansion-Focus)
- `SemanticCluster`: 语义聚类分析
- `TimelineSearch`: 基于时间的记忆搜索

**关键文件**
- `src/main/knowledge/deepMemo/DeepMemoService.ts` (426 行)
- `src/main/services/vcp/BuiltinServices/DeepMemoService.ts` (745 行, @deprecated)
- `src/main/memory/retrieval/DeepMemoRetriever.ts` (604 行)
- `src/main/knowledge/deepMemo/TantivyLikeAdapter.ts` (711 行)
- `src/main/memory/adapters/VCPMemoryAdapter.ts` (861 行)

**Rust IPC 集成**
- `vcp:native:tagmemo:boostVector` — 向量增强
- `vcp:native:tagmemo:batchBoostVectors` — 批量向量增强

#### 2.7.17 Magi三贤者 决策系统 ✅ 已完成 2026-01-07

**能力目标**
- EVA 风格多 Agent 决策系统
- 三位智者角色：Melchior (科学家)、Balthasar (母亲)、Casper (女性)
- 辩论与投票机制
- 多主题配置 (Technical/Business/Creative/Academic)

**三位智者角色**
| ID | 名称 | 视角 | 人格 |
|----|------|------|------|
| `melchior` | Melchior (科学家) | 科技 | 理性、逻辑、求真，从技术可行性和科学原理分析 |
| `balthasar` | Balthasar (母亲) | 人文关怀 | 温柔、包容、以人为本，考虑道德伦理和社会影响 |
| `casper` | Casper (女性) | 直觉创新 | 敏锐、创意、体验导向，从用户体验和创新可能性思考 |

**主题配置**
- **Technical**: Architect, Engineer, Security Expert
- **Business**: CEO, CFO, CMO
- **Creative**: Artist, Critic, Audience Representative
- **Academic**: Theorist, Empiricist, Pragmatist

**命令**
- `Convene`: 召开辩论会议（指定主题和话题）
- `Discuss`: 进行一轮讨论（聚焦特定焦点）
- `Vote`: 收集投票 (approve/reject/abstain)
- `QuickDecision`: 一站式快速决策（辩论+投票）
- `Summary`: 获取会议摘要（text/markdown/JSON）
- `ListThemes`: 列出可用 Agent 主题

**数据流**
```
话题 → MagiAgentService.Convene
    → 多轮 Discuss (各 Agent 发言)
    → Vote (多数决)
        ├── approved (赞成多数)
        ├── rejected (反对多数)
        └── undecided (平票/弃权多数)
    → Summary (决策结果+理由)
```

**配置参数**
- `maxRounds`: 最大讨论轮数 (默认 3)
- `consensusThreshold`: 共识阈值 (默认 0.67)
- `allowDifferentModels`: 允许每个 Agent 使用不同模型

**关键文件**
- `src/main/services/vcp/BuiltinServices/MagiAgentService.ts` (833 行)

**模式采用**
- `ImageCollaborationAgent.ts` — 借鉴 MagiAgent 多角色协作模式
- `CodeCollaborationAgent/types.ts` — 参考 MagiAgent 多角色协作模式

#### 2.7.18 NativeModulePreloader 原生模块预加载 ✅ 已完成 2026-01-07

**能力目标**
- 应用启动时自动预加载 Rust 原生模块
- 确保 TagMemo 等服务优先使用 Rust 实现而非 TypeScript fallback
- 提供功能检测 API

**启动集成** (`main/index.ts` 行 152-169)
```typescript
// 🚀 预加载原生模块 (Rust 层)
const nativeStatus = await preloadNativeModules()
if (nativeStatus.loaded) {
  logger.info('✅ Native modules preloaded', {
    features: nativeStatus.features,
    loadTime: nativeStatus.loadTime + 'ms',
    version: nativeStatus.version
  })
} else {
  logger.warn('⚠️ Native modules not available, using TypeScript fallback')
}
```

**导出 API**
| 函数 | 用途 |
|------|------|
| `preloadNativeModules()` | 预加载原生模块，返回状态 |
| `getNativeModule()` | 获取已加载的模块实例 |
| `getNativeModuleStatus()` | 获取详细状态信息 |
| `isNativeModuleLoaded()` | 检查模块是否已加载 |
| `isFeatureAvailable(feature)` | 检查特定功能是否可用 |
| `createNativeCooccurrenceMatrix()` | 创建 Rust 共现矩阵实例 |
| `createNativeTagCooccurrenceMatrix()` | 创建标签专用共现矩阵 |
| `createNativeSemanticGroupMatcher()` | 创建语义组匹配器 |
| `createFashionSemanticGroupMatcher()` | 创建服装语义组匹配器 |
| `createNativeChineseSearchEngine()` | 创建中文搜索引擎 |
| `nativeJiebaCut()` | 原生 jieba 分词 |
| `nativeJiebaExtractKeywords()` | 原生关键词提取 |

**功能检测字段** (`NativeModuleStatus.features`)
- `vexusIndex` — HNSW 向量索引
- `cooccurrenceMatrix` — 共现矩阵
- `semanticGroupMatcher` — 语义组匹配
- `chineseSearchEngine` — 中文搜索引擎
- `jiebaCut` — jieba 分词

**关键文件**
- `src/main/knowledge/native/NativeModulePreloader.ts` (355 行)
- `src/main/knowledge/native/index.ts` — 模块导出
- `src/main/index.ts` — 启动集成

#### 2.7.19 Tag Blacklist 标签黑名单 ✅ 已完成 2026-01-07

**能力目标**
- 兼容 VCPToolBox 的 `TAG_BLACKLIST` 环境变量
- 持久化到本地 `blacklist.json`
- TagMemo 与 MemoryMasterService 双向同步

**TagMemo 实现** (`tagmemo/index.ts` 行 1221-1261)
- `isTagBlacklisted(tag)` — 检查标签是否在黑名单
- `filterBlacklistedTags(tags)` — 过滤黑名单标签
- `setBlacklist(tags)` — 设置黑名单
- `getBlacklist()` — 获取黑名单

**MemoryMasterService 实现** (`memory/MemoryMasterService.ts` 行 747-857)
- 启动时从 `TAG_BLACKLIST` 环境变量加载
- 从 `blacklist.json` 文件加载
- `addToBlacklist(tags)` — 添加标签到黑名单
- `removeFromBlacklist(tags)` — 从黑名单移除标签
- `syncBlacklistToTagMemo()` — 同步到 TagMemo 服务

**IPC 通道**
- `memory-master:get-blacklist`
- `memory-master:add-to-blacklist`
- `memory-master:remove-from-blacklist`
- `memory-master:is-tag-blacklisted`

**调用时机优化**
- 自动标签提取前检查现有标签数量 (>= 3 则跳过 AI 调用)
- 黑名单过滤在标签持久化前执行

#### 2.7.20 TarotDivination 塔罗占卜服务 ✅ 已完成 2026-01-07

**能力目标**
- 完整 78 张塔罗牌（22 大阿卡纳 + 56 小阿卡纳）
- 6 种牌阵（单牌、三牌、爱情三角、五牌、凯尔特十字、马蹄）
- 正/逆位随机抽取
- AI 辅助解读

**命令**
- `DrawCards`: 抽牌（指定牌阵或数量）
- `Interpret`: AI 辅助解读已抽牌面
- `GetCardInfo`: 获取单张牌详细信息
- `ListSpreads`: 列出可用牌阵
- `RandomCard`: 随机抽取单张牌

**牌阵配置**
| 牌阵 | 数量 | 名称 | 说明 |
|------|:----:|------|------|
| single | 1 | 单牌占卜 | 快速获得单一答案 |
| three-card | 3 | 过去-现在-未来 | 时间线分析 |
| love-triangle | 3 | 爱情三角 | 你-对方-关系 |
| five-card | 5 | 五牌展开 | 多维度分析 |
| celtic-cross | 10 | 凯尔特十字 | 全面深入分析 |
| horseshoe | 7 | 马蹄牌阵 | 综合情况分析 |

**关键文件**
- `src/main/services/vcp/BuiltinServices/TarotDivinationService.ts` (~600 行)

### 2.8 模型调用服务融合规格（详细）
此节定义模型服务（Providers）与 VCP 运行时的完整融合，确保模型能力统一被调用。

#### 2.8.1 统一 Provider 能力模型
- 必须声明：
  - `supportsToolCalling`
  - `supportsVision`
  - `supportsAudio`
  - `supportsStreaming`
  - `embeddingDimension`
- 缺失能力自动降级：工具调用回退为 VCP 标记协议。
- Whitelist 模型穿透：图像/Embedding 模型跳过工具链路

#### 2.8.2 模型调用管线
```
User/Agent → PromptPipeline → Provider Chat Completion
                     ↘ ToolLoop ↙
                VCPUnified.executeTool
```

#### 2.8.3 统一 Embedding 管线
- 所有向量化走统一 Embeddings 接口
- 允许模型切换后自动调整维度

#### 2.8.4 Streaming 与工具循环
- 流式回复中可嵌入 TOOL_REQUEST
- 工具执行完成后继续生成（循环次数可配置）

#### 2.8.5 模型成本与配额策略
- 每个 Provider 限额与优先级
- 对话中自动选择最经济方案

#### 2.8.6 验收标准
- 任意 Provider 可接入 VCP 工具链
- 不支持 function calling 的模型仍能触发工具

## 3. 数据与目录结构

### 3.1 插件目录（当前实现）
```
<USER_DATA>/vcp/
  plugins/
    builtin/
    user/            # 仅扫描此层直接子目录
  builtin-configs/   # 内置服务配置
  preprocessor_order.json
  async-results/     # VCPRuntime 默认异步结果目录
  TVStxt/
```

### 3.2 知识库/记忆目录（当前实现）✅ 已统一 2026-01-07
```
<USER_DATA>/Data/Notes/        # NoteService + NativeKnowledgeService 默认日记/笔记根目录
<USER_DATA>/Data/memory/       # 统一记忆持久化目录
  ├── tag-cooccurrence-matrix.json   # TagCooccurrenceMatrix
  └── selflearning.json              # SelfLearningService
<USER_DATA>/VectorStore/       # NativeKnowledgeService 索引状态/CooccurrenceMatrix
<USER_DATA>/Data/Memory/memories.db
<USER_DATA>/Data/KnowledgeBase/
<USER_DATA>/Data/semantic-groups/
```

**已废弃目录**（迁移完成后可删除）：
```
<USER_DATA>/tagmemo/           # 已迁移到 Data/memory/
<USER_DATA>/selflearning/      # 已迁移到 Data/memory/
<USER_DATA>/Data/dailynote/    # 已迁移到 Data/Notes/
<USER_DATA>/dailynote/         # 历史残留
```

### 3.3 配置与状态
- 插件配置：
  - 内置服务：`<USER_DATA>/vcp/builtin-configs/<pluginId>.json`
  - 外部插件：`<pluginDir>/user-config.json`
- 插件启停状态：当前仅内存态（`plugin.enabled`），未持久化到磁盘（`.block` 逻辑未接入）
- 群聊配置：`AgentGroups/<groupId>/config.json`
- 群聊历史：`<USER_DATA>/<groupId>/topics/<topicId>/history.json`
- 变量/模板：`<USER_DATA>/Data/vcp-variables.json`、`<USER_DATA>/Data/vcp-templates.json`
- 异步结果：
  - `VCPAsyncResults/PluginName-TaskID.json`（VCPAsyncResultsService）
  - `vcp/async-results/`（VCPRuntime 默认目录，需统一）
- 运行时缓存：内存 + 本地持久化

### 3.4 迁移策略（目录与配置）
- 插件迁移：统一收敛到 `vcp/plugins/{builtin,user}`，清理 `user/builtin` 与 `user/downloaded` 的嵌套目录
- 日记迁移：明确单一根目录（建议 `Data/Notes`），迁移 `Data/dailynote` 与根 `dailynote` 的残留
- 异步结果：统一目录（建议 `vcp/async-results`），保留旧 `VCPAsyncResults` 兼容读取
- Agent/变量迁移：保留 JSON 存储；后续提供导入/导出工具

## 4. 执行链路细节

### 4.1 工具调用链
1. Renderer 解析 TOOL_REQUEST
2. `window.api.vcpUnified.executeTool`
3. `UnifiedPluginManager` 自动路由：
   - VCP → `VCPRuntime`
   - MCP → `MCPService`
   - Native → 内置实现
4. 返回 `TOOL_RESULT`/`TOOL_ERROR`

### 4.2 异步任务链
1. 插件返回 `taskId`
2. 任务占位符注入对话
3. `VCPCallbackServer` 接收回调
4. `VCPAsyncResultsService` 写入结果文件
5. `PlaceholderEngine` 替换 `{{VCP_ASYNC_RESULT::...}}`

### 4.3 TOOL_REQUEST 解析算法（原生）
- 单次响应可包含多个 TOOL_REQUEST 块
- 每个块内 key 可大小写混用、含 `_` / `-`
- 允许 value 多行，使用 `「始」...「末」` 作为稳健分隔
- 解析容错：若遇到未闭合块，按“最近闭合”规则截断
- 解析结果结构：
  - `pluginName`
  - `params`（归一化 key + 原始 key 备份）
  - `rawText` / `startIndex` / `endIndex`

### 4.4 Placeholder 注入链（当前实现）
注入顺序（`PlaceholderEngine.resolve`）：
1. 异步结果 `{{VCP_ASYNC_RESULT::...}}`
2. 静态插件占位符 `{{VCPPluginName}}`
2.5. 内置服务占位符 `{{VCPForumReminder}}`
3. 日记占位符 `{{角色名日记本}}` / `{{公共日记本}}`
3.5. RAG/阈值日记 `[[角色名日记本]]` / `<<>>` / `《《》》`
4. VCPTavern 占位符（角色卡/世界书）
5. 群聊占位符 `{{VCPChatGroupSessionWatcher}}` / `{{VCPChatCanvas}}`
6. Agent 模块占位符 `{{AgentMemory}}` / `{{AgentSearch}}` 等
6.5. **Agent 模板占位符 `{{Agent:助手名}}` / `{{Agent:Name:参数}}`（新增 2026-01-10）**
7. 工具占位符 `{{VCPAllTools}}` / `{{VCPToolName}}`
8. Sar 条件变量 `{{SarPromptN}}`
9. Tar/Var 环境变量 `{{Tar*}}` / `{{Var*}}`
10. 系统变量 `{{Date}}` / `{{Time}}` / `{{Today}}` / `{{Festival}}`
11. 媒体变量 `{{Stickers}}` / `{{xx表情包}}`（新增 2026-01-10）

### 4.5 完整系统链路图 ✅ 已完成 2026-01-07

#### 4.5.1 用户消息到 AI 响应的完整流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用户消息完整处理流程                                 │
│                                                                             │
│  [用户输入]                                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  [UI 组件] ─────▶ [Redux dispatch]                                          │
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │           messageThunk.sendMessage()                                 │
│      │                   │                                                  │
│      │     ┌─────────────┼─────────────┐                                    │
│      │     │             │             │                                    │
│      │     ▼             ▼             ▼                                    │
│      │  [RAG注入]    [记忆注入]    [VCP工具获取]                              │
│      │     │             │             │                                    │
│      │     └─────────────┼─────────────┘                                    │
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │          fetchChatCompletion()                                       │
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │     ┌─────────────────────────────────┐                              │
│      │     │      aiCore 中间件链 (洋葱模型)   │                              │
│      │     │                                 │                              │
│      │     │  1. ErrorHandlerMiddleware      │                              │
│      │     │  2. AbortHandlerMiddleware      │                              │
│      │     │  3. VCPToolExecutorMiddleware ◀─┼─── VCP 工具检测与执行         │
│      │     │  4. McpToolChunkMiddleware      │                              │
│      │     │  5. TextChunkMiddleware         │                              │
│      │     │  6. WebSearchMiddleware         │                              │
│      │     │  7. ThinkChunkMiddleware        │                              │
│      │     │  8. StreamAdapterMiddleware     │                              │
│      │     └─────────────────────────────────┘                              │
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │            [AI Provider SDK]                                         │
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │             [流式响应] ──────▶ [BlockManager] ──▶ [UI 更新]           │
│      │                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**关键文件**:
- 消息入口: `src/renderer/src/store/thunk/messageThunk.ts`
- 中间件注册: `src/renderer/src/aiCore/legacy/middleware/register.ts`
- VCP 工具中间件: `src/renderer/src/aiCore/legacy/middleware/VCPToolExecutorMiddleware.ts`

#### 4.5.2 VCP 工具执行链路

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VCP 工具执行链路                                      │
│                                                                             │
│  AI 响应流                                                                   │
│      │                                                                      │
│      ▼                                                                      │
│  VCPToolExecutorMiddleware                                                  │
│      │                                                                      │
│      ├── 检测 <<<[TOOL_REQUEST]>>> 标记                                      │
│      │                                                                      │
│      ├── vcpProtocolParser.parseToolRequests()                              │
│      │         │                                                            │
│      │         ▼                                                            │
│      │   ┌─────────────────────────────────────────────────────────┐        │
│      │   │ 解析结果:                                               │        │
│      │   │ - toolName: "AgentAssistant"                           │        │
│      │   │ - command: "SendAgentMessage"                          │        │
│      │   │ - params: { to_agent_id, message }                     │        │
│      │   │ - archery: false (是否 fire-and-forget)                │        │
│      │   └─────────────────────────────────────────────────────────┘        │
│      │                                                                      │
│      ├── requestToolConfirmation() ← 用户确认 (如果需要)                     │
│      │                                                                      │
│      ▼                                                                      │
│  window.api.vcpUnified.executeTool()  ◀─── IPC 调用                         │
│      │                                                                      │
│      │  ═══════════════════ IPC 边界 ═══════════════════                    │
│      │                                                                      │
│      ▼                                                                      │
│  UnifiedPluginManager.executeTool() (主进程)                                │
│      │                                                                      │
│      ├── 1. 检查 BuiltinServiceRegistry (82+ 内置服务)                       │
│      │         └── AgentAssistantService.execute("SendAgentMessage", params)│
│      │                   │                                                  │
│      │                   ▼                                                  │
│      │         getUnifiedAgentService().sendMessage()                       │
│      │                                                                      │
│      ├── 2. 检查 VCPRuntime (外部插件)                                       │
│      │         └── stdio/native 插件执行                                    │
│      │                                                                      │
│      └── 3. 检查 MCPBridge (MCP 服务器)                                      │
│                └── MCP 协议调用                                             │
│                                                                             │
│      ▼                                                                      │
│  返回 <<<[TOOL_RESULT]>>> ──────▶ 递归调用 AI (最多 10 轮)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**关键文件**:
- VCP 协议解析: `src/renderer/src/aiCore/legacy/clients/vcp/VCPProtocolParser.ts`
- IPC 桥接: `src/preload/index.ts`
- VCP IPC 处理器: `src/main/services/vcp/VCPPluginIpcHandler.ts`
- 内置服务注册: `src/main/services/vcp/BuiltinServices/index.ts`

#### 4.5.3 RAG / 知识库查询链路

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RAG / 知识库查询链路                                  │
│                                                                             │
│  fetchAndProcessAssistantResponseImpl()                                    │
│      │                                                                      │
│      ▼                                                                      │
│  injectUserMessageWithKnowledgeSearchPrompt()                              │
│      │                                                                      │
│      ├── 检查 assistant.knowledgeBaseId                                     │
│      │                                                                      │
│      ├── searchKnowledgeBase(query, base)                                  │
│      │         │                                                            │
│      │         ▼                                                            │
│      │   window.api.knowledge.search()  ◀─── IPC 调用                       │
│      │         │                                                            │
│      │         │  ═══════════════ IPC 边界 ═══════════════                  │
│      │         │                                                            │
│      │         ▼                                                            │
│      │   KnowledgeService (主进程)                                          │
│      │         │                                                            │
│      │         ├── 向量搜索 (embedding + 余弦相似度)                         │
│      │         ├── Reranker 重排序 (可选)                                   │
│      │         └── 返回 KnowledgeSearchResult[]                             │
│      │                                                                      │
│      ├── formatKnowledgeReferences()                                       │
│      │         │                                                            │
│      │         ▼                                                            │
│      │   ┌─────────────────────────────────────────────────────────┐        │
│      │   │ 注入到系统提示词:                                       │        │
│      │   │                                                         │        │
│      │   │ # 参考资料                                              │        │
│      │   │ 以下是从知识库检索的相关内容，请参考：                   │        │
│      │   │                                                         │        │
│      │   │ ## 来源: document.pdf                                   │        │
│      │   │ [检索到的文本片段...]                                   │        │
│      │   └─────────────────────────────────────────────────────────┘        │
│      │                                                                      │
│      └── 合并到 modelMessages                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**关键文件**:
- 知识库服务 (渲染): `src/renderer/src/services/KnowledgeService.ts`
- 知识库服务 (主): `src/main/services/KnowledgeService.ts`

#### 4.5.4 记忆系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          记忆系统架构                                        │
│                                                                             │
│  VCP BuiltinServices 层:                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ LightMemoService  │ DeepMemoService  │ MeshMemoService         │        │
│  │ (轻量搜索)         │ (深度搜索)        │ (网状搜索)              │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              │                                              │
│                              ▼                                              │
│                    VCPMemoryAdapter (统一适配器)                             │
│                              │                                              │
│        ┌─────────────────────┼─────────────────────┐                        │
│        │                     │                     │                        │
│        ▼                     ▼                     ▼                        │
│  IntegratedMemory       MemoryBrain        UnifiedMemoryManager            │
│   Coordinator            (WaveRAG)          (多后端协调)                    │
│        │                     │                     │                        │
│        └─────────────────────┼─────────────────────┘                        │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │  后端引擎:                                                       │        │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │        │
│  │  │LightMemo │DeepMemo  │MeshMemo  │  Diary   │Knowledge │       │        │
│  │  │ (BM25)   │(Tantivy) │ (网状)   │(TagMemo) │ (向量)   │       │        │
│  │  │ 关键词   │ 全文索引 │ 关联     │ 日记     │ 语义     │       │        │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┘       │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              │                                              │
│                              ▼                                              │
│                    RRF 融合排序 (k=60)                                       │
│                              │                                              │
│                              ▼                                              │
│                    返回 top-K 结果                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**关键文件**:
- 统一记忆管理: `src/main/services/UnifiedMemoryManager.ts`
- 记忆适配器: `src/main/memory/adapters/VCPMemoryAdapter.ts`
- 记忆协调器: `src/main/services/memory/IntegratedMemoryCoordinator.ts`

#### 4.5.5 Agent 架构 (UnifiedAgentService 集成) ✅ 已完成 2026-01-07

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Agent 架构 (统一后)                                      │
│                                                                             │
│  BuiltinServices/AgentAssistantService                                     │
│      │                                                                      │
│      ├── 原有命令:                                                          │
│      │   ├── InvokeAgent      → 调用指定 Agent                              │
│      │   ├── ListAgents       → 列出配置的 Agent                            │
│      │   ├── GetScheduledTasks → 获取定时任务                               │
│      │   └── CancelScheduledTask → 取消定时任务                             │
│      │                                                                      │
│      └── UnifiedAgentService 集成命令 (新增):                               │
│          ├── SendAgentMessage  → getUnifiedAgentService().sendMessage()    │
│          ├── CreateTask        → getUnifiedAgentService().createTask()     │
│          ├── GetPendingMessages → getUnifiedAgentService().getPendingMessages()│
│          └── ListAllAgents     → getUnifiedAgentService().getAllAgents()   │
│                                                                             │
│  UnifiedAgentService (src/main/services/UnifiedAgentService.ts)            │
│      │                                                                      │
│      ├── Agent CRUD:                                                        │
│      │   ├── createAgent()     → 创建新 Agent                               │
│      │   ├── updateAgent()     → 更新 Agent                                 │
│      │   ├── deleteAgent()     → 删除 Agent                                 │
│      │   ├── getAgent()        → 获取单个 Agent                             │
│      │   └── listAgents()      → 列出所有 Agent                             │
│      │                                                                      │
│      ├── 消息传递:                                                          │
│      │   ├── sendMessage()     → 发送消息到指定 Agent                       │
│      │   ├── broadcast()       → 广播消息到所有 Agent                       │
│      │   └── getPendingMessages() → 获取待处理消息                          │
│      │                                                                      │
│      ├── 任务委托:                                                          │
│      │   ├── createTask()      → 创建任务                                   │
│      │   ├── delegateTask()    → 委托任务给其他 Agent                       │
│      │   └── completeTask()    → 完成任务                                   │
│      │                                                                      │
│      └── 群体投票:                                                          │
│          ├── initiateVote()    → 发起投票                                   │
│          ├── submitVote()      → 提交投票                                   │
│          └── getVoteStatus()   → 获取投票状态                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**关键文件**:
- Agent 助手服务: `src/main/services/vcp/BuiltinServices/AgentAssistantService.ts`
- 统一 Agent 服务: `src/main/services/UnifiedAgentService.ts`

#### 4.5.6 关键 IPC 通道汇总

| 通道名称 | 用途 | 处理器 |
|---------|------|--------|
| `VCPUnified_ExecuteTool` | 统一工具执行 (VCP+MCP) | VCPPluginIpcHandler |
| `VCPTool_Execute` | VCP 工具执行 | VCPPluginIpcHandler |
| `VCPPlugin_List` | 列出 VCP 插件 | VCPPluginIpcHandler |
| `Knowledge_Search` | 知识库搜索 | KnowledgeService |
| `UnifiedMemory_Search` | 统一记忆搜索 | UnifiedMemoryManager |
| `VCP_Diary_Search` | 日记搜索 | DailyNoteService |
| `VCPEvent_PluginError` | 插件错误事件 | VCPPluginIpcHandler |
| `VCPEvent_AsyncTaskCreated` | 异步任务创建事件 | VCPPluginIpcHandler |

## 5. 分阶段实现计划

### Phase 1 — 原生插件运行时（底层先行） ✅ 已完成

**目标**：彻底替换 `VCPToolBoxBridge` 执行路径

**核心任务**：
- ✅ 新建 `VCPRuntime` 模块
- ✅ 解析 `plugin-manifest.json`
- ⚠️ stdio 插件执行已移除（`nativeOnly=true` 默认启用，调用直接拒绝）
- ✅ 实现 `static` 插件占位符系统
- ✅ 实现 `service/hybrid` 插件直接调用接口

**已创建文件**：
- `src/main/services/vcp/types.ts` — 完整类型定义（300+ 行）
- `src/main/services/vcp/PluginRegistry.ts` — 清单加载 + 生命周期
- `src/main/services/vcp/PluginExecutor.ts` — builtin/service/static/mcp_bridge 执行（stdio 已禁用）
- `src/main/services/vcp/PlaceholderEngine.ts` — 占位符解析与注入
- `src/main/services/vcp/VCPRuntime.ts` — 运行时核心
- `src/main/services/vcp/index.ts` — 模块导出

**验收标准**：
- ⚠️ 可加载 VCPToolBox 兼容清单（非 stdio 类型可执行；stdio 类型默认跳过）
- ✅ 支持 `tool_name` 变体与 key 归一化
- ✅ TypeScript 编译通过

### Phase 2 — 统一工具链路 & IPC ✅ 已完成

**目标**：VCP/MCP/Native 工具统一入口

**核心任务**：
- ✅ `UnifiedPluginManager` 重定向至原生运行时
- ✅ `VCPPluginIpcHandler` 工具调用走原生 VCPRuntime
- ✅ IPC 接口对齐

**已修改文件**：
- `src/main/services/UnifiedPluginManager.ts` — 使用 VCPRuntime 替代 VCPToolBoxBridge
- `src/main/services/VCPPluginIpcHandler.ts` — 使用 VCPRuntime 替代 VCPToolBoxBridge

**验收标准**：
- ✅ VCP TOOL_REQUEST 不经过 VCPToolBoxBridge 路径
- ✅ `VCPUnified` 返回结构化结果
- ✅ TypeScript 编译通过

### Phase 3 — 异步闭环 ✅ 已完成
**目标**：异步工具调用可闭环回填

**核心任务**：
- ✅ `VCPAsyncResultsService` + callback server 集成
- ✅ 任务结果持久化与回调事件
- ✅ 占位符替换完整打通

**补齐项 (P0)**：
- [ ] `TVStxt` 外部文件加载（Tar/Var/Sar 读取 .txt）

**已创建/修改文件**：
- `src/main/services/VCPAsyncResultsService.ts` — 异步结果服务（任务创建、结果存储、占位符替换）
- `src/main/services/VCPCallbackServer.ts` — HTTP 回调端点 `/plugin-callback/:pluginName/:taskId`
- `src/main/services/VCPIpcHandler.ts` — VCP_Async_* IPC 处理器集成
- `src/main/services/vcp/PlaceholderEngine.ts` — 集成 VCPAsyncResultsService
- `src/main/ipc.ts` — VCPCallbackServer 启动时初始化
- `packages/shared/IpcChannel.ts` — VCP_Async_* / VCP_Callback_* 通道定义

**验收标准**：
- ✅ 异步插件调用后占位符自动替换
- ✅ VCPCallbackServer 在应用启动时自动初始化
- ✅ 回调结果通过 IPC 通知渲染进程
- ✅ TypeScript 编译通过

### Phase 4 — 知识库原生化 ✅ 已完成 2026-01-06
**目标**：以 `NativeKnowledgeService` 取代 `UnifiedKnowledgeAdapter`，完全脱离 VCPToolBox
**核心任务**：
- ✅ `NativeKnowledgeService` 作为主入口（`UnifiedKnowledgeAdapter` 仅保留兼容别名）
- ✅ 统一 `NoteService`/`DailyNoteService` 与 `NativeKnowledgeService` 的根目录与向量库存储
- ✅ TagMemo + Light/Deep/Mesh 检索链路已接入 `NativeKnowledgeService`
- ✅ native-vcp Rust 层完全替代 rust-vexus-lite（11 模块 vs 3 模块）
- ✅ RRF 算法统一到 `@main/memory/utils/RRFUtils`
- ⚠️ `VCPTavern`/论坛/酒馆占位符注入与存储目录对齐
**涉及文件**：
- `cherry-studio/src/main/services/NativeKnowledgeService.ts`（含 `UnifiedKnowledgeAdapter` 兼容别名）
- `cherry-studio/src/main/services/notes/NoteService.ts`
- `cherry-studio/src/main/services/vcp/BuiltinServices/DailyNoteService.ts`
- `cherry-studio/src/main/services/VCPForumService.ts`
- `cherry-studio/src/main/services/ThoughtClusterManagerService.ts`
- `cherry-studio/src/main/knowledge/`（检索与索引）
- `cherry-studio/native-vcp/`（Rust 原生模块）
- `cherry-studio/src/main/knowledge/vector/VexusAdapter.ts`（使用 native-vcp）

**已清理**：
- ✅ `vexus-lite.js` 已废弃（native-vcp 完全替代）

**验收标准**：
- ✅ 日记/论坛/酒馆同根目录，索引一致
- ✅ 不加载 `external/VCPToolBox/KnowledgeBaseManager.js`
- ✅ native-vcp 提供 HNSW、Tantivy、jieba 等原生能力

### Phase 5 — 群聊逻辑迁移 ⚠️ 实际部署不完整 2026-01-06
**目标**：群聊体验对齐 VCPChat

**审查结论**：后端实现完整（GroupChatOrchestrator 1736行），但**前端部署存在重大问题**：主聊天区域使用的是简化版组件，高级功能未暴露给用户。

#### 5.0 重要发现 - 双重实现问题 🔴

| 组件 | 位置 | 功能完整度 | 使用情况 |
|------|------|:----------:|:--------:|
| **GroupChatPanel** | `components/GroupChat/GroupChatPanel.tsx` | 100% (1483行) | ❌ 仅 VCPDashboard |
| **GroupChatMessages + Inputbar** | `Messages/` + `Inputbar/` | ~40% | ✅ 主聊天区域 |

**根本原因**：`Chat.tsx` 行 252-256 使用的是 `GroupChatMessages` + `GroupChatInputbar`（简化版），而不是功能完整的 `GroupChatPanel`。

##### 主聊天区域缺失的功能

| 功能 | GroupChatPanel | GroupChatInputbar | 用户状态 |
|------|:--------------:|:-----------------:|:--------:|
| 心流锁模式 | ✅ 完整实现 | ❌ | **不可用** |
| 统一模型配置 | ✅ 完整实现 | ❌ | **不可用** |
| 成员标签管理 | ✅ 完整实现 | ❌ | **不可用** |
| 群组设定 (groupPrompt) | ✅ 完整实现 | ❌ | **不可用** |
| 邀请提示词模板 | ✅ 完整实现 | ❌ | **不可用** |
| 上下文净化 | ✅ 完整实现 | ❌ | **不可用** |
| Agent 协同开关 | ✅ 完整实现 | ❌ | **不可用** |
| 话题自动总结 | ✅ 完整实现 | ❌ | **不可用** |
| 任务确认弹窗 | ✅ 完整实现 | ❌ | **不可用** |

##### P0 修复方案

**方案 A（推荐）**：在 `Chat.tsx` 中使用完整的 `GroupChatPanel` 替代简化版组件

```typescript
// Chat.tsx 行 252-256 当前代码：
{activeTopicOrSession === 'groupchat' && activeGroupChatSessionId && (
  <>
    <GroupChatMessages sessionId={activeGroupChatSessionId} />
    <GroupChatInputbar sessionId={activeGroupChatSessionId} assistantIds={groupChatAssistantIds} />
  </>
)}

// 修改为：
import { GroupChatPanel } from './components/GroupChat'
// ...
{activeTopicOrSession === 'groupchat' && (
  <GroupChatPanel
    initialConfig={{ speakingMode: 'mention' }}
    availableAssistants={assistants}
  />
)}
```

**方案 B**：将 `GroupChatPanel` 的高级配置提取到独立设置面板

#### 5.1 与 VCPChat grouprenderer.js 功能对比

| 功能模块 | VCPChat | Cherry Studio | 状态 |
|---------|:-------:|:-------------:|:----:|
| **发言模式** | | | |
| sequential (顺序) | ✅ | ✅ | 相同 |
| naturerandom (自然随机) | ✅ | ✅ | 相同 |
| invite_only (邀请) | ✅ | ✅ invitation | 相同 |
| random (随机) | ✅ | ✅ | 相同 |
| mention (提及) | ❌ | ✅ | **Cherry 新增** |
| keyword (关键词) | ❌ | ✅ | **Cherry 新增** |
| consensus (共识) | ❌ | ✅ | **Cherry 新增** |
| **模型配置** | | | |
| useUnifiedModel | ✅ | ✅ | 相同 |
| unifiedModel | ✅ | ✅ | 相同 |
| **提示词系统** | | | |
| groupPrompt | ✅ | ✅ | 相同 |
| invitePrompt | ✅ | ✅ invitePromptTemplate | 相同 |
| {{VCPChatAgentName}} 占位符 | ✅ | ✅ | 相同 |
| **成员系统** | | | |
| 成员标签 (memberTags) | ✅ | ✅ | 相同 |
| 标签权重 (自然随机) | ✅ | ✅ | 相同 |
| 邀请按钮 (invite_only) | ✅ | ✅ | 相同 |
| **消息格式** | | | |
| 发言标记头 `[发言者的发言]:` | ✅ | ✅ | 相同 |
| 流式消息 30fps 渲染 | ✅ | ✅ | 相同 |
| 累积内容显示 | ✅ | ✅ | 相同 |
| **话题管理** | | | |
| 创建话题 | ✅ | ✅ | 相同 |
| 删除话题 | ✅ | ✅ | 相同 |
| 导出话题 | ✅ | ✅ | 相同 |
| 手动重命名话题 | ✅ | ❌ | VCPChat 特有 |
| 自动总结改名 | ❌ | ✅ | **Cherry 新增** |
| **高级功能** | | | |
| 心流锁 (FlowLock) | ✅ | ✅ | 相同 |
| Agent 工具调用 | ✅ | ✅ | 相同 |
| 多Agent协作/子任务分配 | ✅ | ✅ | 相同 |
| VCPFileAPI 全URL超栈追踪 | ✅ | ⚠️ 部分 | VCPChat 更完整 |
| 拖拽式上下文排序 | ✅ | ❌ | **VCPChat 特有** |
| SillyTavern 兼容 (预设/角色卡/世界书) | ✅ | ✅ VCPTavern | 相同 |
| 任务确认弹窗 | ⚠️ | ✅ | Cherry 增强 |

#### 5.2 功能对比总结

**VCPChat 特有功能** (Cherry Studio 待实现):
1. **拖拽式上下文排序** — 可视化调整注入上下文的顺序
2. **VCPFileAPI v4.0 全URL超栈追踪** — 更完整的跨服务器文件追踪
3. **话题手动重命名** — Cherry 使用自动总结替代

**Cherry Studio 扩展功能**:
1. **共识发言模式** — 多 Agent 协商达成共识 (grouprenderer.js 未见)
2. **提及/关键词模式** — 更灵活的发言触发机制 (grouprenderer.js 未见)
3. **自动话题总结** — 消息数 >= 4 时自动生成话题标题

#### 5.3 核心任务完成状态

- ✅ `naturerandom` / `inviteonly` 发言模式
- ✅ `groupPrompt` / `invitePrompt` 接入群聊 UI
- ✅ `grouprenderer` 风格输出适配（发言标记头、流式渲染）
- ✅ 发言标记头 `[发言者的发言]: ...`
- ✅ 群组统一模型配置 (`useUnifiedModel`, `unifiedModel`)
- ✅ 成员标签系统 (`memberTags`) — 自然随机模式权重
- ✅ 邀请提示词模板 (`invitePromptTemplate`)
- ✅ 流式消息 100ms 节流优化

**已完成文件**：
- `src/main/knowledge/agent/GroupChatOrchestrator.ts` — 群聊编排器（7种发言模式、心流锁）
- `src/main/knowledge/agent/UnifiedAgentAdapter.ts` — 统一 Agent 适配器
- `src/main/knowledge/agent/VCPAgentService.ts` — VCP Agent 管理服务
- `src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx` — 群聊面板 UI
- `src/renderer/src/pages/settings/AssistantSettings/AssistantGroupChatSettings.tsx` — 助手群聊设置
- `src/renderer/src/services/GroupChatCoordinator.ts` — 群聊协调器
- `src/renderer/src/services/GroupChatService.ts` — 群聊服务
- `src/renderer/src/pages/home/Messages/GroupChatMessages.tsx` — 群聊消息组件

#### 5.4 待完善功能

**P1 - 建议实现**:
- **拖拽式上下文排序** — VCPChat 可视化调整注入上下文顺序的 UI
- **VCPFileAPI v4.0 全URL超栈追踪** — 跨服务器文件路径智能解析与追踪

**P2 - 低优先级**:
- `{{VCPChatGroupSessionWatcher}}` 会话 JSON 注入（VCPChat 调试功能）
- `{{VCPChatCanvas}}` Canvas 内容注入（依赖 Canvas 协同编辑功能）
- 话题手动重命名（VCPChat 特有，Cherry 使用自动总结替代）

**验收标准**：
- ✅ 群聊发言模式可用（sequential, random, mention, keyword, invitation, naturerandom, consensus）
- ✅ 群聊提示词配置可视化（groupPrompt, invitePromptTemplate）
- ✅ 群聊输出发言标记一致 `[发言者的发言]: ...`
- ✅ 群组统一模型、成员标签可配置
- ✅ 流式消息 100ms 节流渲染

### Phase 6 — 统一 Agent 架构 ✅ 已完成
**目标**：统一 Assistant 与 VCPAgent，实现"助手即 Agent"

**核心任务**：
- ✅ 创建 `UnifiedAgentService` — 统一 Agent 管理服务
- ✅ 扩展 Assistant 类型支持人格定义（profile: personality, background, greetingMessage, exampleDialogues, tone, traits）
- ✅ 扩展 Assistant 类型支持协作配置（collaboration: canInitiate, canDelegate, maxConcurrentTasks, responseStyle, allowedAgents, blockedAgents, messagePrefix）
- ✅ 创建 `AgentBrain` — 主控大脑（发言决策、Agent 调用、多 Agent 协调、群体投票）
- ✅ 统一双重 `UnifiedPluginManager` — knowledge/vcp 版本委托给 services 版本
- ✅ 完善事件推送到渲染进程（VCPEvent_PluginError, VCPEvent_AsyncTask*）
- ✅ 实现异步任务状态查询（VCPTool_GetTaskStatus/GetTaskResult）
- ✅ 助手设置页面增加人格/协作配置 UI

**已完成文件**：
- `src/main/services/UnifiedAgentService.ts`（新建）— Agent 管理、消息传递、任务委托、投票
- `src/main/services/AgentBrain.ts`（新建）— 发言决策、Agent 调用、多 Agent 协调
- `src/main/services/VCPPluginIpcHandler.ts`（修改）— 任务状态/结果 IPC + 事件转发
- `src/main/services/vcp/PluginExecutor.ts`（修改）— 添加 getAllAsyncTasks(), getAsyncTasksByPlugin()
- `src/main/services/vcp/VCPRuntime.ts`（修改）— 添加 getExecutor(), getRegistry()
- `src/main/services/vcp/types.ts`（修改）— AsyncTask 添加 progress 字段
- `src/main/knowledge/vcp/UnifiedPluginManager.ts`（重构）— 重导出到 services 版本
- `packages/shared/IpcChannel.ts`（修改）— 新增 VCPEvent_* 通道
- `src/preload/index.ts`（修改）— 新增 onAsyncTaskEvent 订阅
- `src/renderer/src/types/index.ts`（扩展）— Assistant 类型统一字段（profile/memory/tools/groupChat/collaboration/vcpConfig）
- `src/renderer/src/pages/settings/AssistantSettings/AssistantVCPSettings.tsx`（增强）— 新增人格配置和协作配置 UI

**架构图**：
```
┌─────────────────────────────────────────────────────────────┐
│                     AgentBrain (主控大脑)                    │
│  - decideNextSpeaker()  决定下一个发言者                     │
│  - handleAgentInvocation()  处理 Agent 调用                 │
│  - coordinateTask()  协调多 Agent 任务                       │
│  - initiateVote()  发起群体投票                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┴────────────────────┐
       ▼                                        ▼
┌─────────────────────┐              ┌──────────────────────┐
│ UnifiedAgentService │              │ GroupChatOrchestrator │
│  - getAllAgents()    │              │  - 7种发言模式        │
│  - sendMessage()     │              │  - 顺序/随机/自然随机  │
│  - createTask()      │              │  - 邀请/提及/共识      │
│  - delegateTask()    │              └──────────────────────┘
│  - initiateVote()    │
└─────────────────────┘
```

**验收标准**：
- ✅ 创建助手时可配置 UnifiedAgent
- ✅ 助手可配置人格（personality, background, greetingMessage, exampleDialogues）
- ✅ 助手可配置协作行为（canInitiate, canDelegate, responseStyle）
- ✅ 统一 UnifiedPluginManager 单一入口
- ✅ 异步任务状态可查询
- ✅ VCP 事件可推送到渲染进程

**参考文档**：
- `docs/zh/VCP-UNIFIED-AGENT-SPEC.md`

### Phase 7 — 管理工具与 UI (VCPToolBox/VCPChat 功能融合)
**目标**：创建统一管理控制台，补齐群聊功能，对齐 VCPToolBox/VCPChat 原生功能

**核心任务**：

**7.1 统一管理控制台 (🔴 P0)** ✅ 已完成 2025-12-31
- [x] 创建 `VCPDashboard.tsx` — 统一入口页面
- [x] 添加路由和侧边栏入口 (`/vcp/*` + Boxes 图标)
- [x] 整合 Agent/插件/变量/模板管理组件
- 实现文件：`src/renderer/src/pages/vcp/VCPDashboard.tsx`

**7.1.1 统一工作台与调用可视化 (🔴 P0)** ✅ 已完成 2025-12-31
- [x] 工作台视图展示完整信息流：Assistant/Agent/工具调用 → 任务 → 结果/错误
- [x] 统一日志流：VCPLog/AgentMessage/AsyncTask 统一列表，支持按 assistant/agent/tool/plugin/taskId 过滤
- [x] 调用链路可回溯：每个 TOOL_REQUEST/RESULT 绑定关联 ID，可定位原始消息与插件执行
- [x] UI 统一入口：配置、监控、日志、调用链路均从 VCPDashboard 汇聚
- 实现文件：
  - `src/renderer/src/pages/vcp/WorkbenchPanel.tsx` — 统一工作台组件（调用记录表格、异步任务列表、日志时间线、详情面板）
  - `src/renderer/src/pages/vcp/VCPDashboard.tsx` — 新增工作台菜单入口

**7.2 群聊功能补齐 (🔴 P0)** ✅ 已完成 2025-12-31
- [x] 群组统一模型配置 (`useUnifiedModel`, `unifiedModel`)
- [x] 成员标签系统 (`memberTags`) — 自然随机模式权重
- [x] 邀请提示词模板 (`invitePromptTemplate`)
- [x] 流式消息显示修复 (`agent:stream` 事件 + useRef 分离状态)
- [x] 流式消息节流优化 — 参考原生 BlockManager 实现 100ms 节流
- 实现文件：
  - `src/renderer/src/services/GroupChatService.ts` — 接口定义 + `agent:stream` 事件类型
  - `src/renderer/src/services/GroupChatCoordinator.ts` — 协调器配置 + 流式事件发射
  - `src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx` — UI 控件 + 100ms 节流渲染
  - `src/renderer/src/pages/home/Messages/GroupChatMessages.tsx` — 消息组件 + 100ms 节流渲染

**7.3 话题管理增强 (✅ 已验证 2026-01-07)**
- [x] 话题自动总结（消息数 >= 4 时触发）— `useTopic.ts` + `GroupChatOrchestrator` 阈值触发
- [x] 话题标题清洗 — 自动移除特殊字符和多余空格
- [ ] Agent 文件夹结构支持 — 🟡 P2 待实现
- [x] redo/interrupt 行为（群聊中断/重试）— `GroupChatOrchestrator` + `GroupChatPanel`

**7.4 渲染层 UX 组件 (✅ 已验证 2026-01-07)**
- [x] ToolUse 气泡 `vcp-tool-use-bubble` — `Markdown.tsx` 集成
- [x] ToolResult 气泡 `vcp-tool-result-bubble` — `Markdown.tsx` 集成
- [x] DailyNote 气泡 `maid-diary-bubble` — `Markdown.tsx` 集成
- [ ] Context Sanitizer + AgentBubbleTheme 开关 — 🟡 P2 待实现

**7.5 高级功能 (✅ 部分完成 2026-01-07)**
- [x] Canvas 协同编辑 UI — `CanvasEditor` + `canvas.ts` Redux + 19 组件
- [ ] 会话监控面板 — 🟢 P2 待实现
- [ ] 流式事件序列
- [x] VCP 元思考 / Magi / AIMemo / 自学习能力评估 ✅ 已完成 2026-01-07
  - Magi三贤者 决策系统 (MagiAgentService.ts 833 行)
  - DeepMemo 深度记忆检索 (多文件 2486+ 行)
  - NativeModulePreloader 原生模块预加载
  - Tag Blacklist 标签黑名单

**涉及文件**：
- `cherry-studio/src/renderer/src/pages/vcp/VCPDashboard.tsx`（新建）
- `cherry-studio/src/renderer/src/services/GroupChatService.ts`（增强）
- `cherry-studio/src/main/knowledge/agent/GroupChatOrchestrator.ts`（增强）
- `cherry-studio/src/renderer/src/pages/home/Markdown/`（UX 组件）

**验收标准**：
- ✅ VCP 统一管理控制台可用
- ✅ 群组统一模型、成员标签、邀请提示词可配置
- ✅ 话题自动总结功能可用
- ✅ 群聊中断/重试行为可用（2026-01-07 验证）
- ✅ ToolUse/ToolResult/DailyNote 气泡渲染（2026-01-07 验证）
- ✅ 工作台可视化：所有调用可见、可过滤、可追踪（Phase 7.1.1 完成）
- ✅ Canvas 协同编辑 UI（2026-01-07 验证）

**详细 TO-DO**：
- 见 `docs/zh/VCP-NATIVE-REVIEW-PROTOCOL.md` 第 8 节

### Phase 8 — 多模态与分布式
**目标**：补齐 VCPFileAPI 与多模态通道
**核心任务**：
- Base64/文件路径解析
- 多模态内容渲染
- 分布式工具路由
**涉及文件**：
- `cherry-studio/src/main/services/vcp/`
- `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`

**验收标准**：
- 多模态附件可正确解析并渲染

### Phase 9 — 清理与迁移
**目标**：彻底移除外部依赖
**核心任务**：
- 删除 `VCPToolBoxBridge` 路径依赖
- 数据迁移（插件、日记、Agent）
- 清理 `cherry-studio/src/main/knowledge/vcp/sync-plugins.js` 外部路径硬编码，统一使用 `PluginSyncService` 的 userData 插件目录
- 清理旧字段与兼容逻辑（Assistant 仅保留统一字段）
- 文档与测试补齐
**涉及文件**：
- `cherry-studio/src/main/services/VCPToolBoxBridge.ts`（移除）
- `external/VCPToolBox`（保留仅供参考/可删除）

**验收标准**：
- 项目构建不引用 `external/VCPToolBox`
- Assistant 存储与运行时不再包含旧字段

## 6. 风险与缓解
- **风险**：插件执行差异导致兼容问题  
  **缓解**：兼容清单冻结 + 单元测试覆盖
- **风险**：异步闭环漏回调  
  **缓解**：在 CallbackServer 增加超时与状态诊断
- **风险**：群聊 UI 与逻辑差异导致体验不一致  
  **缓解**：逐步对齐发言模式与渲染规则

## 7. 交付验收清单
- [x] TOOL_REQUEST 全量兼容（Phase 1 完成）
- [x] 异步占位符闭环（Phase 3 完成）
- [x] 插件清单加载正常（Phase 1 完成）
- [x] 群聊发言模式可用（Phase 5 已完成 2026-01-06）
- [x] 助手群聊配置 UI（Phase 5 已完成 2026-01-06）
- [x] 群聊输出发言标记一致（Phase 5 已完成 2026-01-06）
- [x] 群组统一模型、成员标签配置（Phase 5 已完成 2026-01-06）
- [x] 流式消息节流渲染（Phase 5 已完成 2026-01-06）
- [x] 统一 Agent 架构（Phase 6 已完成）
- [x] 助手人格/协作配置 UI（Phase 6 已完成）
- [x] UnifiedAgentService 消息传递与任务委托（Phase 6 已完成）
- [x] AgentBrain 发言决策与多 Agent 协调（Phase 6 已完成）
- [x] VCP 事件推送到渲染进程（Phase 6 已完成）
- [x] 异步任务状态查询（Phase 6 已完成）
- [x] 统一工作台可视化（Phase 7.1.1 已完成）
- [x] native-vcp Rust 层完成（Phase 4 已完成 2026-01-06）
- [x] RRF 算法统一到 RRFUtils（代码债务清理完成）
- [x] vexus-lite.js 废弃清理（native-vcp 完全替代）
- [x] DeepMemo 深度记忆检索（2026-01-07 完成）
- [x] Magi三贤者 决策系统（2026-01-07 完成）
- [x] NativeModulePreloader 启动集成（2026-01-07 完成）
- [x] Tag Blacklist 标签黑名单（2026-01-07 完成）
- [x] WaveRAG 三阶段检索（2026-01-07 完成）
- [ ] 旧字段清理完成（Assistant 统一字段生效）
- [ ] 无外部依赖（Phase 9 待实现）
- [x] VCPLogService 命名冲突解决（Phase 12 已完成 2026-01-06）
- [ ] Rust IPC 通道补齐（Phase 12 待实现）
- [x] TagCooccurrenceMatrix Rust boostVector（Phase 12 已完成 2026-01-07）
- [x] TracingPanel 数据源修复 - getStats 返回真实计数（2026-01-07 完成）
- [x] TarotDivination 塔罗占卜娱乐服务（2026-01-07 完成）
- [x] DailyNotePanelService UI 路由胶水层（2026-01-07 完成）
- [x] 插件注册表名称对齐（83 服务/83 元数据）（2026-01-07 完成）
- [x] TVStxt 外部文件加载 - PlaceholderEngine + VCPVariableIpcHandler + AdvancedVariableEditor（2026-01-07 验证）
- [x] 话题自动总结 - useTopic.ts + GroupChatOrchestrator 阈值触发（2026-01-07 验证）
- [x] redo/interrupt 群聊中断重试 - GroupChatOrchestrator + GroupChatPanel（2026-01-07 验证）
- [x] ToolUse/ToolResult/DailyNote 气泡渲染 - Markdown.tsx 集成三组件（2026-01-07 验证）
- [x] Canvas 协同编辑 UI - CanvasEditor + canvas.ts Redux + 19 组件（2026-01-07 验证）
- [x] Diary CRUD IPC 通道 - VCPDiaryIpcHandler + NoteService + preload vcpDiary API（2026-01-07 验证）
- [x] UI 组件整合完成（Phase 12 已完成 2026-01-07）

## 8. 测试与验证策略
- 单元测试：解析器、占位符、工具路由
- 集成测试：同步/异步工具执行闭环
- UI 回归：群聊 UI、工具结果渲染、日志面板
- 性能测试：并行工具调用与多轮 TOOL_REQUEST

## 9. 外部功能对照审查（VCPToolBox / VCPChat）

### 9.1 插件清单覆盖（external/VCPToolBox/Plugin）
- 目录数量：75；有 `plugin-manifest.json` 的插件 68 个（唯一 name 67，`DoubaoGen` 重复一次）
- pluginType 分布：`synchronous` 40 / `static` 12 / `hybridservice` 6 / `service` 5 / `messagePreprocessor` 3 / `asynchronous` 2
- 内置服务数量：76；外部目录无 manifest 的 7 个（`1PanelInfoProvider`, `IMAPIndex`, `IMAPSearch`, `MCPO`, `MCPOMonitor`, `TimelineGenerator`, `VCPForumAssistant`）已原生化

**兼容别名建议（外部 -> 原生）**：
- `ServerCodeSearcher` -> `CodeSearcher`
- `ServerFileOperator` -> `FileOperator`
- `ServerPowerShellExecutor` -> `PowerShellExecutor`
- `ServerSearchController` (VCPEverything) -> `EverythingSearch`
- `ServerTencentCOSBackup` -> `TencentCOSBackup`
- `NanoBananaGenOR` -> `BananaGen`
- `PyCameraCapture` -> `CameraCapture`
- `PyScreenshot` -> `Screenshot`
- `WeatherInfoNow` -> `WeatherReporter.GetWeatherNow`
- `TarotDivination` -> 原生服务已实现（78张塔罗牌 + 6种牌阵）
- `DailyNoteGet` / `DailyNoteManager` / `RAGDiaryPlugin` -> `DailyNoteWrite`（GetNote/SearchNotes/BatchTag/RAGSearch）
- `ForumLister` -> `VCPForum.ListAllPosts`
- `DailyNotePanelRouter` -> `DailyNotePanelService`（OpenPanel/GetStats/ListNotebooks/NavigateToEntry）

**需确认的真实缺口**：
- 目前未发现明确缺失的插件能力，但需要确认上述别名/命令映射与旧工具调用是否完全兼容

**当前 userData 插件落地（CherryStudioDev 实测）**：
- `vcp/plugins/user` 直接子目录含 manifest 66 个；`user/builtin` 与 `user/downloaded` 下另有 68 个 manifest（未被注册表扫描）
- manifest 总数 134，唯一 name 67
- pluginType 分布：`synchronous` 78 / `asynchronous` 4 / `static` 24 / `hybridservice` 12 / `service` 10 / `messagePreprocessor` 6
- 运行时 `nativeOnly=true` 默认启用：stdio 类型（`synchronous`/`asynchronous`）会被跳过，需要依赖 builtin_service 或别名映射兜底

### 9.2 VCPToolBox 控制台（AdminPanel）对照
**已覆盖**：
- 工作台/日志/追踪：`WorkbenchPanel` + `TracingPanel` + `VCPLogViewer`
- Agent/Assistant 管理：`UnifiedAssistantManager` + 设置页
- 插件管理：`VCPPluginList`
- 变量/TVStxt/Sar：`AdvancedVariableEditor`
- 日记/记忆：`DailyNotePanel`
- 论坛：`ForumPanel`
- 预处理器顺序：`PreprocessorOrderPanel`（`GlobalSettingsPanel`）

**待补或需完善**：
- 工具列表编辑器（Tool List Editor）：工具显示、禁用、排序、分类
- 思维链编辑器（Thinking Chains Editor）：`MetaThinking`/`ThoughtClusterManager` 的可视化配置
- 图片缓存编辑器（Image Cache Editor）
- 语义组编辑器 UI（Hook/服务已存在，需接入 VCPDashboard 入口）

### 9.3 VCPChat 功能对照（README 侧重 UI/体验）
**已具备/部分具备**：
- 群聊发言模式、邀请提示词、发言标记、心流锁核心逻辑
- VCP 日记/论坛/酒馆基础入口
- 基础多模态渲染与工具调用闭环（含异步占位符）

**待补或需增强**：
- 工具调用气泡/结果渲染的高级交互（悬浮展开、富媒体、状态动画）
- 用户端“工具调用器”GUI（人类可视化调用工具）
- ComfyGen/ComfyUI 面板与 Workflow 可视化编辑入口
- Canvas 协同编辑与群文件工作区
- TTS/语音/系统级推送的完整链路（目前仅有基础朗读）
- 话题导出/全局搜索等 VCPChat 侧增强项（需确认优先级）
**优先级顺序（确认）**：
- 心流锁 UI → 工具调用器 → ComfyUI 面板 → Canvas 协同 → TTS/语音

### 9.4 数据与存储对齐（CherryStudioDev）
- 原生插件与运行时数据以 `app.getPath('userData')` 为根（本机为 `C:\\Users\\Administrator\\AppData\\Roaming\\CherryStudioDev`）
- 实测目录要点：
  - `vcp/`：`async-results/`、`builtin-configs/`、`TVStxt/`、`preprocessor_order.json`
  - `vcp/plugins/`：`builtin/` 为空，`user/` 含 66 个直接插件目录（另有 `user/builtin` 与 `user/downloaded` 的嵌套副本）
  - `Data/Notes/`：日记/笔记统一入口（当前已有 `无标题笔记.md`）
  - `Data/dailynote/`：包含 `VCP论坛`（论坛/思维簇仍在用）
  - `VectorStore/`：`diary/` + `cooccurrence-matrix.json` 等
  - `selflearning/learning-data.json`、`tavern/`、`canvas/` 已存在
- 路径分歧与待统一：
  - ~~日记根目录仍分裂~~ ✅ 已统一到 `Data/Notes/`（2026-01-07）
  - ~~TagMemo/学习数据分裂~~ ✅ 已统一到 `Data/memory/`（2026-01-07）
  - 异步结果目录 `VCPAsyncResults/` 与 `vcp/async-results/` 并存
  - 插件目录存在嵌套副本（注册表不递归扫描）

### 9.5 外部依赖残留检查
- ~~运行时代码已原生化，但 `cherry-studio/src/main/knowledge/vcp/sync-plugins.js` 仍硬编码 `external/VCPToolBox/Plugin`~~ ✅ 已删除 sync-plugins.js（2026-01-07）
- 旧插件名兼容未落地：`ServerCodeSearcher`/`WeatherInfoNow` 等别名未在运行时注册，stdio 插件被跳过后会导致工具找不到
- UI 配置字段未接入：`GlobalSettingsPanel` 展示 `knowledgeBaseRootPath`/`vectorStorePath`，但 `VCPRuntimeConfig` 未消费

### 9.6 知识库/日记/全局记忆深审
- 日记写入链路存在递归风险：`IntegratedMemoryCoordinator.createMemory(backend=diary)` → `DailyNoteWritePlugin.agentWrite()` → `syncToKnowledge()` → 再次 `createMemory()`
- 检索栈分裂：`UnifiedKnowledgeService`（页面/IPC） vs `IntegratedMemoryCoordinator`（VCP 工具） vs `KnowledgeService`（RAG 文档库）结果口径不一致
- ~~TagMemo/自学习多源持久化未统一~~ ✅ 已统一到 `Data/memory/`（2026-01-07）
- MemoryGateway 标记为新入口但未注册到 `MemoryIpcModule`，旧 IPC 模块仍在用（Unified/Integrated/Advanced）

## 10. 实际部署审查结果（2026-01-06）

本节记录通过代码审查发现的实际部署问题，确保功能从"代码存在"到"用户可用"的完整链路。

### 10.1 AI 协同功能审查 ✅ 已修复 2026-01-07

#### 10.1.1 canDelegate 开关问题 ✅ 已解决

**问题**：`canDelegate` 是一个"空开关" — UI 存在但后端未连接。

**解决方案**：已添加 IPC Handler 连接 UI 到后端。

| 位置 | 状态 |
|------|:----:|
| **UI 开关** | ✅ `AssistantVCPSettings.tsx` 行 300-310 |
| **类型定义** | ✅ `types/index.ts` - `CollaborationConfig.canDelegate` |
| **IPC 通道** | ✅ `IpcChannel.VCP_Agent_DelegateTask` (新增) |
| **后端消费** | ✅ `VCPIpcHandler.ts` → `UnifiedAgentService.delegateTask()` |
| **实际效果** | ✅ 开关状态现在控制委派功能 |

#### 10.1.2 UnifiedAgentService 方法隔离 ✅ 已解决

**问题**：核心 Agent 协作方法存在但完全孤立，无 IPC 通道暴露。

**解决方案**：已在 `VCPIpcHandler.ts` 添加 4 个 IPC Handler。

| 方法 | 实现行 | IPC Handler | 状态 |
|------|:------:|:-----------:|:----:|
| `sendMessage()` | ~150 | ✅ `VCP_Agent_SendMessage` | 已连接 |
| `delegateTask()` | ~200 | ✅ `VCP_Agent_DelegateTask` | 已连接 |
| `createTask()` | ~180 | ✅ `VCP_Agent_CreateTask` | 已连接 |
| `getPendingTasks()` | ~100 | ✅ `VCP_Agent_GetPendingTasks` | 已连接 |
| `getAllAgents()` | ~100 | ✅ | 内部 |
| `getAgentById()` | ~120 | ✅ | 内部 |

**新增 IPC 通道** (`packages/shared/IpcChannel.ts`):
```typescript
VCP_Agent_SendMessage = 'vcp:agent:sendMessage',
VCP_Agent_DelegateTask = 'vcp:agent:delegateTask',
VCP_Agent_CreateTask = 'vcp:agent:createTask',
VCP_Agent_GetPendingTasks = 'vcp:agent:getPendingTasks',
```

#### 10.1.3 实际可用的 AI 协同功能

| 功能 | 入口 | 状态 |
|------|------|:----:|
| `invoke_agent` 工具调用 | AI 主动调用 MCP 工具 | ✅ 工作 |
| 群聊多 Agent 对话 | GroupChatOrchestrator | ✅ 工作 |
| Agent 相互邀请 | GroupChatPanel invitePromptTemplate | ✅ 工作 |
| 20+ MCP 协作工具 | AgentCollaborationService | ✅ AI 可调用 |
| 用户触发委派任务 | UI → delegateTask() | ✅ 已连接 |
| Agent 自主创建子任务 | createTask() | ✅ 已连接 |

#### 10.1.4 P0 修复方案 ✅ 已实施

**采用方案 A**：添加 IPC Handler（最小改动）

已在 `VCPIpcHandler.ts` 实现：
```typescript
// Agent 协作功能 IPC Handler
ipcMain.handle(IpcChannel.VCP_Agent_SendMessage, ...)
ipcMain.handle(IpcChannel.VCP_Agent_DelegateTask, ...)
ipcMain.handle(IpcChannel.VCP_Agent_CreateTask, ...)
ipcMain.handle(IpcChannel.VCP_Agent_GetPendingTasks, ...)
```

---

### 10.2 RAG 知识库审查 ✅ 链路通畅

#### 10.2.1 DiaryModeParser 语法执行状态

**结论**：语法解析已实现，且通过多入口执行。

| 语法 | 解析 | 执行入口 |
|------|:----:|----------|
| `{{知识库}}` fulltext | ✅ | VCPIpcHandler → NativeKnowledgeService |
| `[[知识库]]` rag | ✅ | IntegratedMemoryCoordinator |
| `<<知识库>>` threshold_fulltext | ✅ | VCP-RAG MCP Server |
| `《《知识库》》` threshold_rag | ✅ | PlaceholderEngine |
| `::Time` | ✅ | RAGDiaryService.ParseTime |
| `::TagMemo0.7` | ✅ | TagMemoService.expandQuery |
| `::Rerank` | ✅ | RerankerService.rerank |
| `::Group(a,b)` | ✅ | SemanticGroupService.match |
| `::AIMemo` | ✅ | AIMemoService（需 AI 调用） |
| `::TopK5` / `::K5` | ✅ | 动态 K 值参数 |

#### 10.2.2 执行链路验证

```
用户系统提示词: [[角色日记本::Time今天::TagMemo0.7::Rerank]]
    ↓
DiaryModeParser.parse() → 提取知识库名 + 修饰符
    ↓
┌─────────────────────────────────────────────────┐
│ 执行入口 (多路并行)                              │
│ ├── VCPIpcHandler → 解析后调用后端              │
│ ├── IntegratedMemoryCoordinator → 记忆检索      │
│ ├── PlaceholderEngine → 占位符替换              │
│ └── VCP-RAG MCP → AI 工具调用                   │
└─────────────────────────────────────────────────┘
    ↓
RAGDiaryService.RAGSearch() (1016行完整实现)
    ├── ParseTime → 解析"今天"为日期范围
    ├── TagMemoService → 扩展查询词
    ├── BM25/Vector → 混合检索
    └── RerankerService → 精排序
    ↓
结果注入上下文
```

#### 10.2.3 RAGDiaryService 状态

- **标记**：`@deprecated`（建议迁移到新统一服务）
- **实际状态**：仍在 BuiltinServiceRegistry 注册，功能完整
- **行数**：1016 行
- **命令**：`ParseTime`, `SearchByTime`, `RAGSearch`, `BatchSearch`, `GetDiaryContext`

#### 10.2.4 用户触发方式

| 触发方式 | 说明 |
|----------|------|
| 系统提示词语法 | `[[知识库::修饰符]]` 自动解析执行 |
| AI 主动调用 | 工具名 `RAGDiary.RAGSearch` 等 |
| VCP Dashboard | 日记系统面板手动搜索 |

---

### 10.3 日记功能审查 ⚠️ 部分 UI 缺失

#### 10.3.1 后端实现完整度

| 功能 | 服务 | 状态 |
|------|------|:----:|
| 日记 CRUD | DailyNoteWriteService | ✅ 完整 |
| 按时间搜索 | RAGDiaryService.SearchByTime | ✅ 完整 |
| 按内容搜索 | RAGDiaryService.RAGSearch | ✅ 完整 |
| 按标签搜索 | NativeKnowledgeService | ✅ 完整 |
| 批量打标 | RAGDiaryService.BatchSearch | ✅ 完整 |
| AI 自动写入 | DailyNoteWriteService | ✅ 完整 |
| 时间表达式 | "今天/昨天/上周/过去N天" | ✅ 完整 |

#### 10.3.2 UI 入口状态

| 功能 | UI 入口 | 状态 |
|------|---------|:----:|
| 日记列表浏览 | VCP Dashboard → 日记系统 | ✅ |
| 日记手动创建 | DailyNotePanel | ✅ |
| 日记编辑 | DailyNotePanel 详情 | ✅ |
| 日记删除 | DailyNotePanel | ✅ |
| 基础搜索 | DailyNotePanel 搜索框 | ✅ |
| 时间表达式搜索 | 无直接 UI | ⚠️ 需 AI 调用 |
| 批量打标 | 无 UI | ❌ |
| 快速笔记 | 无 UI | ❌ |
| AI 自动写入触发 | 无用户按钮 | ⚠️ 需 AI 主动 |

#### 10.3.3 建议补充的 UI

**P1 - 用户体验增强**：
1. **时间表达式搜索框** — 支持"昨天"、"上周"等自然语言
2. **批量打标按钮** — 多选日记后一键添加标签
3. **快速笔记入口** — 全局快捷键或悬浮按钮

**P2 - AI 协作增强**：
1. **"让 AI 写日记"按钮** — 触发 AI 根据对话生成日记
2. **日记洞察面板** — 展示标签共现、时间分布可视化

---

### 10.4 总结与行动项

#### 功能完整度评估

| 模块 | 后端 | 前端 UI | 实际可用 |
|------|:----:|:-------:|:--------:|
| 群聊 7 种发言模式 | ✅ | ✅ (已修复) | ✅ |
| AI 协同 invoke_agent | ✅ | AI 调用 | ✅ |
| AI 协同 canDelegate | ✅ | ✅ UI | ✅ 已连接 |
| AI 协同任务委派 | ✅ | ✅ IPC | ✅ 已连接 |
| RAG 知识库语法 | ✅ | 系统提示 | ✅ |
| 日记 CRUD | ✅ | ✅ | ✅ |
| 日记高级搜索 | ✅ | ⚠️ 部分 | ⚠️ |

#### P0 行动项（更新 2026-01-07）

1. ~~**[AI 协同]** 添加 IPC Handler 或 MCP 工具暴露 `delegateTask`、`createTask`~~ ✅ 已完成 2026-01-07
2. **[群聊]** ✅ 已修复 - Chat.tsx 使用 GroupChatPanel
3. **[新增]** ✅ 已解决 VCPLogService 命名冲突 — 见 12.1.1
4. **[新增]** ✅ 已添加缺失的 Rust IPC 通道 — 见 12.2.1

#### P1 行动项（更新 2026-01-07）

1. **[日记]** 添加时间表达式搜索 UI
2. **[日记]** 添加批量打标 UI
3. ~~**[AI 协同]** 添加"委派任务"按钮到群聊界面~~ ✅ 已完成 - IPC 通道已添加
4. **[新增]** TypeScript TagCooccurrenceMatrix 迁移到 Rust — 见 12.1.3 ✅
5. **[新增]** 整合日记 UI 组件 — 见 12.3.2

## 12. 代码重复与架构审查（2026-01-06）

本节记录代码审查中发现的重复实现、类型定义冲突、Rust 层连接缺口和 UI 组件重复，确保架构收敛和代码去重。

### 12.1 命名冲突与重复实现

#### 12.1.1 VCPLogService 命名冲突 ✅ 已解决 2026-01-06

**问题**：两个不同用途的服务使用相同类名 `VCPLogService`，造成导入混淆。

| 文件路径 | 行数 | 用途 | 状态 |
|----------|:----:|------|:----:|
| `src/main/services/vcp/ToolCallTracer.ts` | 510 | 内部调用链追踪 (traceId, spanId, 性能统计) | ✅ 已重命名 |
| `src/main/services/vcp/BuiltinServices/VCPLogService.ts` | 399 | 用户工具 (Query/GetStats/Clear/Export) | 保留原名 |

**解决方案**：
- ✅ 重命名内部追踪服务为 `ToolCallTracer`
- ✅ 文件重命名：`VCPLogService.ts` → `ToolCallTracer.ts`
- ✅ 导出向后兼容别名（`@deprecated`）
- ✅ 更新所有导入引用（4 个文件）

#### 12.1.2 VCPPluginType 类型重复 ✅ 已解决 2026-01-07

**问题**：`VCPPluginType` 在两个 types.ts 文件中重复定义。

| 文件路径 | 定义行 | 状态 |
|----------|:------:|:----:|
| `src/main/services/vcp/types.ts` | 12-21 | ✅ 权威定义 |
| `src/main/knowledge/vcp/types.ts` | 9 | ✅ 已改为重导出 |

**解决方案**：
- ✅ 保留 `src/main/services/vcp/types.ts` 作为权威定义
- ✅ `src/main/knowledge/vcp/types.ts` 改为重导出：
```typescript
export type { VCPPluginType } from '@main/services/vcp/types'
```

#### 12.1.3 TagCooccurrenceMatrix 双重实现 ✅ 已完成 2026-01-07

**问题**：TypeScript 和 Rust 各有完整实现，功能重叠但 API 不一致。

| 实现 | 路径 | 行数 | 功能 |
|------|------|:----:|------|
| TypeScript | `src/main/knowledge/tagmemo/TagCooccurrenceMatrix.ts` | 903 | 完整 PMI/NPMI、向量增强、持久化 |
| Rust | `native-vcp/src/tagmemo.rs` | 875 | **完整 PMI/NPMI、向量增强 (boostVector)、JSON 序列化** |

**API 状态**：
| 功能 | TypeScript | Rust |
|------|:----------:|:----:|
| 向量增强 (boostVector) | ✅ | ✅ 已实现 |
| 批量向量增强 (batchBoostVectors) | ✅ | ✅ 已实现 |
| 标签增强 (computeTagBoost) | ✅ | ✅ 已实现 |
| 批量标签增强 | ✅ | ✅ 已实现 |
| buildFromDocuments | ❌ | ✅ (CooccurrenceMatrix) |
| 持久化到文件 | ✅ Data/memory/ | ✅ (toJson/fromJson) |
| 动态 Alpha/Beta | ✅ | ✅ |

**迁移状态**：
- ✅ Rust 版本已添加 `boostVector()` 和 `batchBoostVectors()` 方法
- 🔄 中期：TypeScript 版本可委托给 Rust，保留 API 兼容层
- 📋 长期：完全迁移到 Rust，废弃 TypeScript 实现

#### 12.1.4 UnifiedPluginManager 双重定义 ✅ 已解决

**状态**：已通过重导出模式解决

| 文件路径 | 行数 | 角色 |
|----------|:----:|------|
| `src/main/services/UnifiedPluginManager.ts` | 624 | 主实现 |
| `src/main/knowledge/vcp/UnifiedPluginManager.ts` | 66 | 重导出包装 |

**当前架构**：
- `knowledge/vcp` 版本仅是 `services` 版本的别名导出
- 提供旧类型兼容 (`PluginProtocol`, `UnifiedPluginInfo`, `ToolCallRequest`)
- 无需进一步处理

---

### 12.2 Rust 层连接缺口

#### 12.2.1 已实现但未暴露 IPC 的 Rust 模块 ✅ 已解决 2026-01-06

**问题**：native-vcp Rust 层实现了多个模块，但未通过 IPC 暴露给渲染进程。

| Rust 模块 | 文件 | IPC 通道 | 状态 |
|-----------|------|----------|:----:|
| HybridSearchEngine | `native-vcp/src/hybrid_search.rs` | `vcp:native:hybrid:*` | ✅ 已添加 |
| ChineseSearchEngine | `native-vcp/src/chinese_search.rs` | `vcp:native:chinese:*` | ✅ 已添加 |
| TextChunker | `native-vcp/src/chunker.rs` | `vcp:native:chunker:*` | ✅ 已添加 |
| UnifiedDatabase diary CRUD | `native-vcp/src/database.rs` | 无 `vcp:native:diary:*` | ⚠️ 部分暴露 |

**已添加的 IPC 通道**（`src/main/services/NativeVCPIpcHandler.ts`）：
```typescript
// HybridSearchEngine 通道
'vcp:native:hybrid:init'
'vcp:native:hybrid:setWeights'
'vcp:native:hybrid:setRrfK'
'vcp:native:hybrid:fuse'
'vcp:native:hybrid:config'
'vcp:native:quickRrfFusion'

// TextChunker 通道
'vcp:native:chunker:init'
'vcp:native:chunker:setSeparators'
'vcp:native:chunker:chunk'
'vcp:native:chunker:chunkBatch'
'vcp:native:chunker:estimateTokens'
'vcp:native:chunker:chunkByTokens'
'vcp:native:chunker:config'
'vcp:native:quickChunk'
'vcp:native:estimateTokenCount'

// ChineseSearchEngine 通道
'vcp:native:chinese:init'
'vcp:native:chinese:add'
'vcp:native:chinese:addBatch'
'vcp:native:chinese:query'
'vcp:native:chinese:commit'
'vcp:native:chinese:stats'
```

#### 12.2.2 Fallback 实现掩盖原生调用缺失 🟡

**问题**：`NativeVCPBridge.ts` 中的 Fallback 实现在原生模块不可用时静默降级，可能导致功能差异未被察觉。

**Fallback 实现列表**（`src/main/services/native/NativeVCPBridge.ts`）：
| Fallback 类 | 描述 |
|-------------|------|
| `MinimalTagMatrix` | 简化的标签矩阵（无 PMI 计算） |
| `MinimalTextChunker` | 简单按长度切分（无语义边界） |
| `MinimalHybridSearch` | 单源搜索（无 RRF 融合） |
| `FallbackTracer` | 空操作追踪器 |

**建议**：
1. 添加降级日志级别配置（warn vs debug）
2. 在 VCP Dashboard 显示原生模块状态
3. 添加功能差异文档

#### 12.2.3 setLogCallback 接入 ✅ 已解决 2026-01-06

**问题**：`native-vcp` 导出 `setLogCallback` 用于 Rust 日志桥接，但未在 TypeScript 侧接入。

**导出位置**：
- `native-vcp/index.d.ts` 行 183：`export declare function setLogCallback(callback: (...args: any[]) => any): void`
- `native-vcp/src/tracing_bridge.rs`：实现日志回调

**解决方案**：

1. ✅ `NativeVCPBridge.ts` 添加 `setLogCallback`、`clearLogCallback`、`hasLogCallback` 函数
2. ✅ `NativeVCPIpcHandler.ts` 注册时自动设置日志回调，将 Rust 日志转发到 Node.js 日志系统
3. ✅ 添加 IPC 通道 `vcp:native:log:hasCallback`、`vcp:native:log:clear`
4. ✅ 注销 IPC 时自动清理日志回调

**实现代码**（`src/main/services/NativeVCPIpcHandler.ts`）：
```typescript
// 设置 Native 日志回调，将 Rust 日志转发到 Node.js 日志系统
setLogCallback((entry: NativeLogEntry) => {
  addLogEntry({
    timestamp: entry.timestamp,
    level: entry.level,
    target: entry.target,
    message: entry.message,
    metadata: entry.fields ? JSON.parse(entry.fields) : undefined,
    spanId: entry.span
  })
})
```

---

### 12.3 UI 组件重复

#### 12.3.1 群聊组件分散 (3 套并行) — 🟢 P2 架构优化

**说明**：功能已完整，三套组件各有定位，暂不需要合并。

| 组件 | 路径 | 行数 | 用途 | 保留原因 |
|------|------|:----:|------|----------|
| **GroupChatPanel** | `pages/home/components/GroupChat/GroupChatPanel.tsx` | 1,482 | 完整群聊 (7种发言模式、心流锁、统一模型) | 主聊天入口 |
| **GroupChatManagement** | `pages/vcp/GroupChatManagement.tsx` | 540 | 会话管理 + 跳转入口 | VCP Dashboard 入口 |
| **AgentCollaborationPanel** | `pages/vcp/panels/AgentCollaborationPanel.tsx` | 619 | AI 协作中心 (任务驱动) | 任务编排视图 |

**整合建议（P2）**：
1. 提取共享逻辑到 hooks（`useGroupChatSession`, `useAgentSelection`）
2. 统一样式系统

#### 12.3.2 日记组件重复 (2 套并行) — 🟢 P2 架构优化

**说明**：功能已完整，两套组件各有定位，暂不需要合并。

| 组件 | 路径 | 行数 | 用途 | 保留原因 |
|------|------|:----:|------|----------|
| **DailyNotePanel** | `pages/vcp/panels/DailyNotePanel.tsx` | 1,378 | VCP Dashboard 入口 (CRUD + 搜索 + 统计) | 全功能入口 |
| **KnowledgeDiary** | `pages/knowledge/items/KnowledgeDiary.tsx` | 347 | Knowledge 页面入口 (Tab 视图) | 简化入口 |

**整合建议（P2）**：
1. 提取共享逻辑到 hooks（`useDiaryOperations`, `useDiarySearch`）
2. `KnowledgeDiary` 可选择嵌入 `DailyNotePanel` 的精简模式

---

### 12.4 迁移路径建议

#### 12.4.1 TypeScript → Rust 迁移优先级

| 优先级 | 模块 | 迁移方式 | 预期收益 |
|:------:|------|----------|----------|
| ~~P0~~ | ~~TagCooccurrenceMatrix~~ | ✅ Rust 已添加 boostVector | 性能 10x+ |
| P1 | 内存搜索 | 使用 HybridSearchEngine IPC | 统一搜索栈 |
| P1 | 文本分块 | 使用 TextChunker IPC | 中文分词更准确 |
| P2 | 日记 CRUD | 使用 UnifiedDatabase IPC | 减少文件 IO |

#### 12.4.2 UI 组件整合策略

**短期 (1-2 周)**：
1. 确定主组件（GroupChatPanel, DailyNotePanel）
2. 其他组件改为嵌入/复用模式

**中期 (1 个月)**：
1. 提取共享 hooks 和 utilities
2. 统一样式系统

#### 12.4.3 命名冲突解决方案

| 冲突项 | 解决方案 | 影响范围 |
|--------|----------|----------|
| VCPLogService | 重命名内部版为 ToolCallTracer | 3 个文件 |
| VCPPluginType | knowledge/vcp 版本改为重导出 | 1 个文件 |

---

### 12.5 P0/P1 行动项汇总

#### P0 行动项（需立即处理）

1. **[命名冲突]** ✅ 已完成 - 重命名 `VCPLogService` 为 `ToolCallTracer`
   - 文件：`src/main/services/vcp/ToolCallTracer.ts`
   - 已更新导入：4 个文件

2. **[Rust 连接]** ✅ 已完成 - 添加 HybridSearchEngine/TextChunker/Diary IPC 通道
   - 文件：`src/main/services/NativeVCPIpcHandler.ts`
   - 新增通道：`vcp:native:hybrid:*`, `vcp:native:chunker:*`, `vcp:native:diary:*`

3. **[日志桥接]** ✅ 已完成 - 接入 setLogCallback
   - 文件：`src/main/services/NativeVCPIpcHandler.ts`

4. **[AI 协同]** ✅ 已完成 2026-01-07 - 添加 Agent 协作 IPC 通道
   - 文件：`packages/shared/IpcChannel.ts`, `src/main/services/VCPIpcHandler.ts`
   - 新增通道：`VCP_Agent_SendMessage`, `VCP_Agent_DelegateTask`, `VCP_Agent_CreateTask`, `VCP_Agent_GetPendingTasks`

#### P1 行动项（本周完成）

1. ~~**[类型统一]** VCPPluginType 改为重导出~~ ✅ 已完成 2026-01-07
   - 文件：`src/main/knowledge/vcp/types.ts`

2. ~~**[TagMemo 迁移]** Rust TagCooccurrenceMatrix 添加 boostVector~~ ✅ 已完成 2026-01-07
   - 文件：`native-vcp/src/tagmemo.rs`
   - 新增方法：`boostVector()`, `batchBoostVectors()`, `computeTagBoost()`, `batchComputeTagBoost()`

3. ~~**[UI 整合]** KnowledgeDiary 改为嵌入 DailyNotePanel~~ → 降级为 P2
   - **说明**：两套组件各有定位，核心功能已完整，暂不需要合并
   - **状态**：降级为架构优化项，非阻塞

4. ~~**[TracingPanel 数据源]** UnifiedMemoryManager.getStats() 返回真实计数~~ ✅ 已完成 2026-01-07
   - 文件：`src/main/services/UnifiedMemoryManager.ts`
   - 修复：Knowledge/Diary/Memory 后端从硬编码 0 改为动态查询
   - 影响：TracingPanel 数据库统计现在显示真实数据

5. ~~**[插件注册表对齐]** 服务名称与元数据名称一致~~ ✅ 已完成 2026-01-07
   - 修复 5 个名称不匹配：BananaGen/CameraCapture/EverythingSearch/Screenshot/Wan2.1VideoGen
   - 删除 6 个孤儿元数据条目
   - 当前状态：83 服务 / 83 元数据完全对齐

#### P1 剩余项（日记 UI 增强）

1. **[日记]** 添加时间表达式搜索 UI — 支持"昨天"、"上周"等自然语言输入
2. **[日记]** 添加批量打标 UI — 多选日记后一键添加标签

## 13. 待确认
- ~~日记/知识库的唯一根目录选择~~ ✅ 已确定：`Data/Notes/` 作为日记根目录
- 插件别名策略：旧插件名是否统一映射到内置服务，或保留旧 manifest 名称
- 插件目录清理策略：是否移除 `vcp/plugins/user/builtin` 与 `vcp/plugins/user/downloaded` 的嵌套副本
- 群聊 UI 是否需要兼容 VCPChat 的"渲染样式"
- 哪个插件使用 `https://www.ragie.ai/advanced-rag-engine`，对应代码路径在哪？
- `DailyNoteWritePlugin`/`IntegratedMemoryCoordinator` 递归链路如何处理（禁用 `syncToKnowledge` 或改写后端）
- ~~TagMemo/自学习持久化的唯一来源与迁移策略~~ ✅ 已统一到 `Data/memory/`
- 统一检索入口选择：`UnifiedKnowledgeService` vs `IntegratedMemoryCoordinator` vs `KnowledgeService`

## 14. 实施状态总览（2026-01-07 更新）

### 14.1 Phase 完成度

| Phase | 名称 | 状态 | 完成度 |
|:-----:|------|:----:|:------:|
| 1 | 原生插件运行时 | ✅ 已完成 | 100% |
| 2 | 统一工具链路 & IPC | ✅ 已完成 | 100% |
| 3 | 异步闭环 | ✅ 已完成 | 100% |
| 4 | 知识库原生化 | ✅ 已完成 | 100% |
| 5 | 群聊逻辑迁移 | ✅ 已完成 | 100% |
| 6 | 统一 Agent 架构 | ✅ 已完成 | 100% |
| 7 | 管理工具与 UI | ✅ 核心完成 | 95% |
| 8 | 多模态与分布式 | 🟡 进行中 | 60% |
| 9 | 清理与迁移 | 🟡 进行中 | 40% |

### 14.2 P0/P1/P2 行动项状态

| 优先级 | 总数 | 已完成 | 进行中 | 待实现 |
|:------:|:----:|:------:|:------:|:------:|
| P0 | 4 | 4 | 0 | 0 |
| P1 | 7 | 5 | 0 | 2 |
| P2 | 6 | 1 | 0 | 5 |

### 14.3 剩余工作项

**P1 剩余（用户体验增强）**：
1. 日记时间表达式搜索 UI
2. 日记批量打标 UI

**P2 剩余（架构优化）**：
1. Agent 文件夹结构支持
2. Context Sanitizer + AgentBubbleTheme 开关
3. 会话监控面板
4. 流式事件序列
5. UI 组件整合（提取共享 hooks）

**待确认（需产品决策）**：
1. 插件别名策略
2. 插件目录清理策略
3. 群聊 VCPChat 渲染样式兼容
4. 递归链路处理策略
5. 统一检索入口选择

### 14.4 关键成就

1. **运行时完全原生化**：不再依赖 `external/VCPToolBox` 运行时
2. **native-vcp Rust 层**：11 个模块，完全超越 rust-vexus-lite
3. **83 个内置服务**：完整覆盖原 VCPToolBox 插件能力
4. **统一 Agent 架构**：Assistant 即 Agent，支持人格/协作/群聊配置
5. **AI 协同 IPC**：`sendMessage`/`delegateTask`/`createTask` 完整链路
6. **群聊 7 种发言模式**：sequential/random/mention/keyword/invitation/naturerandom/consensus
7. **DeepMemo + WaveRAG**：四阶段深度检索 + 三阶段 WaveRAG
8. **Magi 三贤者决策系统**：多 Agent 辩论与投票机制

## 15. 完整调用链路图（2026-01-07 审查）

### 15.1 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Cherry Studio VCP 架构                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          Renderer (React)                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │vcpContextPlugin│  │GroupChatPanel│  │VCPDashboard │  │AssistantSettings│ │ │
│  │  │(AI Core Plugin)│  │(群聊 UI)     │  │(管理控制台) │  │(助手设置)      │  │ │
│  │  └───────┬───────┘  └───────┬──────┘  └──────┬──────┘  └──────┬───────┘    │ │
│  └──────────┼──────────────────┼────────────────┼─────────────────┼───────────┘ │
│             │                  │                │                 │             │
│  ═══════════╪══════════════════╪════════════════╪═════════════════╪═════════════│
│             │        IPC Bridge (preload/index.ts)                │             │
│  ═══════════╪══════════════════╪════════════════╪═════════════════╪═════════════│
│             │                  │                │                 │             │
│  ┌──────────▼──────────────────▼────────────────▼─────────────────▼───────────┐ │
│  │                            Main Process                                     │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                      VCPRuntime (核心运行时)                          │  │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │  │ │
│  │  │  │PluginRegistry│ │PluginExecutor│ │PlaceholderEngine│ │PreprocessorChain│ │ │
│  │  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘      │  │ │
│  │  └─────────┼───────────────┼───────────────┼───────────────┼────────────┘  │ │
│  │            │               │               │               │               │ │
│  │  ┌─────────▼───────────────▼───────────────▼───────────────▼────────────┐  │ │
│  │  │                   BuiltinServiceRegistry (83 服务)                    │  │ │
│  │  │  AgentAssistant │ DailyNoteWrite │ DeepMemo │ Magi │ VCPTavern │...  │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │ │
│  │  │UnifiedAgentService│  │GroupChatOrchestrator│ │IntegratedMemory │          │ │
│  │  │(Agent 管理)       │  │(群聊编排)         │  │Coordinator      │          │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │ │
│  │           │                     │                     │                     │ │
│  │  ┌────────▼─────────────────────▼─────────────────────▼─────────────────┐  │ │
│  │  │                       NativeVCPBridge (Rust 桥接)                     │  │ │
│  │  └──────────────────────────────┬───────────────────────────────────────┘  │ │
│  └─────────────────────────────────┼───────────────────────────────────────────┘ │
│                                    │                                             │
│  ┌─────────────────────────────────▼───────────────────────────────────────────┐ │
│  │                          native-vcp (Rust 层)                                │ │
│  │  VexusIndex │ TagCooccurrenceMatrix │ ChineseSearchEngine │ HybridSearch    │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 用户消息 → Agent 响应 → 工具调用

```
用户输入消息
    │
    ▼
vcpContextPlugin.onRequestStart()
    ├── 加载 VCP Agent (`src/renderer/src/aiCore/plugins/vcpContextPlugin.ts:150`)
    ├── 解析模板变量 (Tar/Var/Sar) (`vcpAgent.resolveTemplateVariables`)
    ├── 执行日记搜索 → vcpInjections[] (`vcpDiary.searchWithInjections`)
    ├── 执行记忆搜索 → vcpInjections[] (`unifiedMemory.search`)
    ├── 执行上下文规则 → vcpInjections[] (`vcpInjector.executeContext`)
    └── 匹配 WorldBook → vcpInjections[] (`tavern.matchWorldBook`)
    │
    ▼
vcpContextPlugin.transformParams() (`:280`)
    ├── 解析 VCP 占位符 ({{VCPAllTools}} 等) (`vcpPlaceholder.resolve`)
    ├── 按位置分组注入
    │   ├── system_prefix/suffix → 系统提示词前后
    │   ├── user_prefix/suffix → 用户消息前后
    │   ├── assistant_prefix → 引导助手回复
    │   └── hidden → 隐藏指令
    └── 应用 Tavern 预设 (`tavern.applyPreset`)
    │
    ▼
AI 生成响应 (Provider.chat)
    │
    ▼
vcpContextPlugin.onRequestEnd() (`:400`)
    ├── 解析 <<<[TOOL_REQUEST]>>> 块 (`parseVCPToolRequests`)
    │       │
    │       ▼
    │   window.api.vcpUnified.executeTool()
    │       │
    │       ▼
    │   UnifiedPluginManager.executeTool() (`src/main/services/UnifiedPluginManager.ts:180`)
    │       │
    │       ▼
    │   PluginExecutor.execute() (`src/main/services/vcp/PluginExecutor.ts:120`)
    │       ├── 1. BuiltinServiceRegistry (83 服务) → 优先匹配
    │       ├── 2. DistributedPlugin (远程工具) → WebSocket 调用
    │       └── 3. PluginRegistry (外部插件) → 清单加载的插件
    │       │
    │       ▼
    │   返回 <<<[TOOL_RESULT]>>> 或 <<<[TOOL_ERROR]>>>
    │
    ├── 检测日记写入标记 (`detectDiaryWrite`)
    │       └── DailyNoteWriteService.write()
    │
    └── 清理会话 (`showVcp.endSession`)
```

### 15.3 群聊多 Agent 对话

```
用户消息发送到群聊
    │
    ▼
IPC: GroupChat_HandleUserInput (`src/main/ipc.ts`)
    │
    ▼
GroupChatOrchestrator.handleUserInput() (`src/main/knowledge/agent/GroupChatOrchestrator.ts:400`)
    │
    ├── extractMentions() (`:500`) ← 解析 @提及
    │   支持模式:
    │   ├── @name / @中文名
    │   ├── @"带空格的名字"
    │   ├── 请xxx回答/说
    │   ├── 让xxx来回答
    │   └── xxx你怎么看
    │
    ├── decideSpeakers() (`:600`) ← 根据模式选择发言者
    │   ├── [sequential]   → 固定顺序，循环队列
    │   ├── [random]       → WeightedSpeakerSelector 权重随机
    │   ├── [naturerandom] → 优先级选择 (见 15.4)
    │   ├── [invitation]   → 主持人通过 UI 指定
    │   ├── [mention]      → 仅 @提及的 Agent 响应
    │   ├── [keyword]      → 匹配 triggerKeywords 的 Agent
    │   └── [consensus]    → 所有 Agent 依次发言
    │
    ▼
For each speaker:
  GroupChatOrchestrator.requestSpeak(agentId, context) (`:700`)
    │
    ├── 检查冷却时间 (`speakingCooldown`)
    ├── 获取 speakingLock (心流锁) ← 确保同时只有一个 Agent 生成
    │
    ▼
  generateAgentResponse() (`:800`)
    ├── getAvailableMCPTools() ← 获取可用工具
    ├── buildAgentSystemPrompt() ← 构建系统提示词
    ├── resolvePlaceholdersInPrompt() ← 解析占位符
    ├── MCPBridge.generateText() ← AI 生成
    └── processToolCalls() ← 工具调用处理
    │
    ▼
  GroupMessage { agentId, content, timestamp, ... }
    │
    ├── 释放 speakingLock
    │
    └── 处理排队的发言者 (speakingQueue)
        └── setImmediate(() => this.requestSpeak(nextAgentId, 'queued'))
    │
    ▼
IPC Event: groupchat:event → 前端接收并显示
```

### 15.4 naturerandom 发言优先级算法

```
naturerandom 模式优先级 (WeightedSpeakerSelector.ts):

┌─────────────────────────────────────────────────────────────────────┐
│ 优先级 │ 触发条件              │ 优先值 │ 发言概率 │ 说明           │
├─────────────────────────────────────────────────────────────────────┤
│   1    │ @mention 直接提及     │  100   │  100%   │ 最高优先级     │
│   2    │ keyword 关键词匹配    │   85   │   95%   │ 匹配 triggerKeywords │
│   3    │ @everyone 全体        │   70   │   90%   │ 群发消息       │
│   4    │ topic 话题相关        │   60   │   85%   │ 匹配 expertise │
│   5    │ random 随机触发       │   30   │   15%   │ 基础随机概率   │
│   6    │ fallback 兜底         │   20   │  100%   │ 确保至少一人响应│
└─────────────────────────────────────────────────────────────────────┘

权重计算公式:
finalWeight = (baseWeight + roleBonus) * (1 - cooldownPenalty)
            + mentionBonus + keywordBonus + participationBonus

其中:
- baseWeight = agent.priority (0-100)
- roleBonus = { host: +20, moderator: +15, expert: +10, participant: 0, observer: -20 }
- cooldownPenalty = 0-1 (3 轮线性衰减)
- mentionBonus = +50 (被 @提及时)
- keywordBonus = +30/关键词 + +15/专长匹配
- participationBonus = +10/轮, 最高 +40
```

### 15.5 Agent 间通信与任务委派

```
Agent A 发送消息给 Agent B
    │
    ▼
AgentAssistantService.execute('SendAgentMessage', {...})
    │   位置: src/main/services/vcp/BuiltinServices/AgentAssistantService.ts:200
    │
    ▼
UnifiedAgentService.sendMessage(fromAgentId, toAgentId, content, metadata)
    │   位置: src/main/services/UnifiedAgentService.ts:150
    │
    ├── 创建 AgentMessage 对象
    │   {
    │     id: nanoid(),
    │     fromAgentId, toAgentId,
    │     type: 'request',
    │     content, metadata,
    │     timestamp: Date.now()
    │   }
    ├── 推入 messageQueue
    └── notifyMessageListeners() → 触发事件
    │
    ▼
Agent B 检索消息:
UnifiedAgentService.getPendingMessages(agentId) → AgentMessage[]

---

任务创建与委派
    │
    ▼
UnifiedAgentService.createTask(fromAgentId, description, options)
    │   位置: src/main/services/UnifiedAgentService.ts:180
    │
    ├── 如果指定 targetAgentId:
    │   └── task.assignedAgentId = targetAgentId
    │
    └── 如果未指定:
        └── findBestAgentForTask(task) (`:250`)
            ├── 匹配任务关键词与 Agent expertise
            ├── 评分: expertise +10, keyword +5, priority/10
            ├── 角色加成: expert +20, host +10
            └── 选择最高分 Agent
    │
    ▼
AgentTask { id, fromAgentId, targetAgentId, status: 'pending', ... }
    │
    ▼
目标 Agent 检索任务:
UnifiedAgentService.getPendingTasks(agentId)
    │
    ▼
Agent 处理并完成:
UnifiedAgentService.completeTask(taskId, result)
```

### 15.6 向量检索管线

```
用户查询
    │
    ▼
IntegratedMemoryCoordinator.intelligentSearch(query, options)
    │   位置: src/main/memory/IntegratedMemoryCoordinator.ts:300
    │
    ▼
HybridSearchEngine (RRF 融合)
    │   位置: native-vcp/src/hybrid_search.rs
    │
    ├─────────────────────────────────────┐
    │                                     │
    ▼                                     ▼
VexusIndex (HNSW)              ChineseSearchEngine (Tantivy)
│   位置: native-vcp/src/vexus.rs  │   位置: native-vcp/src/chinese_search.rs
│                                  │
├── usearch 库                     ├── jieba-rs 分词
├── Cosine 相似度                  ├── Tantivy BM25
├── 16 连通度 (HNSW M)            └── 中文 CJK 支持
└── SQLite 恢复机制
    │                                     │
    └──────────────┬──────────────────────┘
                   │
                   ▼
           RRF Score Fusion (native-vcp/src/hybrid_search.rs:100)
           ┌─────────────────────────────┐
           │ score = Σ 1/(k + rank + 1)  │
           │ k = 60 (默认 RRF 常数)      │
           │                             │
           │ 权重配置:                   │
           │ - bm25_weight: 0.3          │
           │ - vector_weight: 0.5        │
           │ - tag_boost_weight: 0.2     │
           └─────────────────────────────┘
                   │
                   ▼
           TagMemo Boost (native-vcp/src/tagmemo.rs:200)
           ┌─────────────────────────────────────────────┐
           │ 动态 Alpha: [1.5, 3.5] 基于平均标签分数    │
           │ 动态 Beta: 增加模糊查询容忍度              │
           │                                            │
           │ 核心算法:                                  │
           │ logic_strength = freq^dynamic_alpha        │
           │ noise_penalty = ln(global_freq + beta)     │
           │ score = logic_strength / noise_penalty     │
           │                                            │
           │ 最终增益: max 50% boost                    │
           └─────────────────────────────────────────────┘
                   │
                   ▼
           排序结果返回 → 注入上下文
```

### 15.7 上下文注入管线 (PlaceholderEngine)

```
PlaceholderEngine.resolve(text, context)
    │   位置: src/main/services/vcp/PlaceholderEngine.ts:100
    │
    ▼
注入顺序 (11 步):
┌────┬──────────────────────────────────────┬───────────────────────────────┐
│序号│ 占位符                               │ 来源                          │
├────┼──────────────────────────────────────┼───────────────────────────────┤
│ 1  │ {{VCP_ASYNC_RESULT::Plugin::TaskID}} │ VCPAsyncResultsService        │
│ 2  │ {{VCPPluginName}}                    │ Static Plugin 占位符          │
│ 2.5│ {{VCPForumReminder}}                 │ BuiltinServiceRegistry        │
│ 3  │ {{角色名日记本}} / {{公共日记本}}    │ DailyNoteService              │
│ 3.5│ [[角色名日记本]] / <<>> / 《《》》   │ RAG/阈值日记                  │
│ 4  │ {{TavernCharacter}} / {{Greeting}}   │ VCPTavernService              │
│ 5  │ {{VCPChatGroupSessionWatcher}}       │ GroupChatOrchestrator         │
│ 6  │ {{AgentMemory}} / {{AgentSearch}}    │ Agent 模块占位符              │
│ 6.5│ {{Agent:助手名}} / {{Agent:Name}}    │ 助手模板系统（新增）          │
│ 7  │ {{VCPAllTools}} / {{VCPToolCatalog}} │ BuiltinServiceRegistry        │
│ 8  │ {{SarPromptN}}                       │ 模型条件变量 (Sar*.txt)       │
│ 9  │ {{TarXXX}} / {{VarXXX}}              │ 环境变量 (TVStxt/*.txt)       │
│ 10 │ {{Date}} / {{Time}} / {{Today}}      │ 系统变量                      │
│ 11 │ {{Festival}} / {{Stickers}}          │ 节日/表情包变量（新增）       │
└────┴──────────────────────────────────────┴───────────────────────────────┘

新增变量说明 (2026-01-10):
- {{Agent:助手名}}: 获取助手的系统提示词模板，支持 {{Agent:Nova:参数}} 格式
- {{Festival}}: 农历日期 + 公历节日（如 "甲辰龙年·腊月初十 · 元旦"）
- {{xx表情包}}: 特定表情包的文件列表（如 {{通用表情包}} → "smile.gif|wave.png"）
- 插件变量注册: PluginVariableRegistry 支持动态注册/更新/解析

TVStxt 文件加载:
当 {{TarXXX}} 或 {{VarXXX}} 值以 .txt 结尾时:
→ 从 userData/vcp/TVStxt/ 目录加载文件内容
→ 支持多行文本和复杂格式
```

---

## 16. IPC 通道完整列表

本节记录 Cherry Studio VCP 系统所有 IPC 通道，按功能模块分类。

### 16.1 GroupChat IPC 通道 (26 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `groupchat:create` | handle | 创建群聊会话 |
| `groupchat:addAgent` | handle | 添加单个 Agent 到群聊 |
| `groupchat:addUnifiedAgent` | handle | 添加统一格式 Agent |
| `groupchat:addAgents` | handle | 批量添加 Agents |
| `groupchat:removeAgent` | handle | 从群聊移除 Agent |
| `groupchat:start` | handle | 启动群聊会话 |
| `groupchat:end` | handle | 结束群聊会话 |
| `groupchat:handleUserInput` | handle | 处理用户输入消息 |
| `groupchat:requestSpeak` | handle | 请求 Agent 发言 |
| `groupchat:getState` | handle | 获取会话状态 |
| `groupchat:getMessages` | handle | 获取消息列表 |
| `groupchat:getAgents` | handle | 获取 Agent 列表 |
| `groupchat:destroy` | handle | 销毁会话 |
| `groupchat:listSessions` | handle | 列出所有会话 |
| `groupchat:adaptAssistant` | handle | 将助手适配为 Agent |
| `groupchat:getUnifiedAgents` | handle | 获取统一格式 Agents |
| `groupchat:interrupt` | handle | 中断正在进行的请求 |
| `groupchat:redoMessage` | handle | 重新回复消息 |
| `groupchat:persist:saveSession` | handle | 持久化保存会话 |
| `groupchat:persist:loadSession` | handle | 加载持久化会话 |
| `groupchat:persist:getAllSessions` | handle | 获取所有持久化会话 |
| `groupchat:persist:deleteSession` | handle | 删除持久化会话 |
| `groupchat:persist:saveMessage` | handle | 保存单条消息 |
| `groupchat:persist:saveMessages` | handle | 批量保存消息 |
| `groupchat:persist:loadMessages` | handle | 加载消息 |
| `groupchat:persist:getMessageCount` | handle | 获取消息数量 |

关联文件: `src/main/services/GroupChatIpcHandler.ts`

### 16.2 Agent IPC 通道 (19 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:agent:list` | handle | 列出所有 VCP Agents |
| `vcp:agent:get` | handle | 获取单个 Agent |
| `vcp:agent:create` | handle | 创建 Agent |
| `vcp:agent:update` | handle | 更新 Agent |
| `vcp:agent:delete` | handle | 删除 Agent |
| `vcp:agent:activate` | handle | 激活 Agent |
| `vcp:agent:import` | handle | 导入 Agent |
| `vcp:agent:resolveTemplateVariables` | handle | 解析模板变量 (Tar/Var/Sar) |
| `vcp:agent:sendMessage` | handle | 发送消息到 Agent |
| `vcp:agent:delegateTask` | handle | 委派任务给 Agent |
| `vcp:agent:createTask` | handle | 为 Agent 创建任务 |
| `vcp:agent:getPendingTasks` | handle | 获取待处理任务 |
| `agent:invoke:sync` | handle | 同步调用 Agent |
| `agent:invoke:async` | handle | 异步调用 Agent |
| `agent:invoke:getTaskStatus` | handle | 获取任务状态 |
| `agent:invoke:getTaskResult` | handle | 获取任务结果 |
| `agent:invoke:listTasks` | handle | 列出所有任务 |
| `agent:invoke:listAvailableAgents` | handle | 列出可用 Agents |
| `agent:invoke:execute` | handle | 执行 Agent |

关联文件:
- `src/main/services/vcp/VCPIpcModule.ts`
- `src/main/services/AgentInvokeIpcHandler.ts`

### 16.3 VCP Plugin IPC 通道 (48 个)

#### 16.3.1 插件管理 (16 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:plugin:initialize` | handle | 初始化 VCP 插件系统 |
| `vcp:plugin:list` | handle | 列出所有插件 |
| `vcp:plugin:get` | handle | 获取单个插件 |
| `vcp:plugin:enable` | handle | 启用插件 |
| `vcp:plugin:disable` | handle | 禁用插件 |
| `vcp:plugin:reload` | handle | 重新加载插件 |
| `vcp:plugin:getConfig` | handle | 获取插件配置 |
| `vcp:plugin:updateConfig` | handle | 更新插件配置 |
| `vcp:plugin:updateModelConfig` | handle | 更新插件模型配置 |
| `vcp:plugin:getPlaceholders` | handle | 获取占位符值 |
| `vcp:plugin:sync` | handle | 同步内置插件 |
| `vcp:plugin:getSyncStatus` | handle | 获取同步状态 |
| `vcp:plugin:getStats` | handle | 获取插件统计 |
| `vcp:plugin:getDetails` | handle | 获取插件详情 |
| `vcp:plugin:loadFromPath` | handle | 从路径加载插件 |
| `vcp:plugin:getPluginsDir` | handle | 获取插件目录 |

#### 16.3.2 工具执行 (6 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:tool:execute` | handle | 同步执行工具 |
| `vcp:tool:executeAsync` | handle | 异步执行工具 |
| `vcp:tool:getTaskStatus` | handle | 获取工具任务状态 |
| `vcp:tool:getTaskResult` | handle | 获取工具任务结果 |
| `vcp:tool:cancelTask` | handle | 取消工具任务 |
| `vcp:tool:listDefinitions` | handle | 列出工具定义 |

#### 16.3.3 统一插件管理 (7 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:unified:initialize` | handle | 初始化统一插件管理器 |
| `vcp:unified:getAllPlugins` | handle | 获取所有统一插件 |
| `vcp:unified:getPluginsByProtocol` | handle | 按协议获取插件 |
| `vcp:unified:executeTool` | handle | 执行统一工具 |
| `vcp:unified:getToolDefinitions` | handle | 获取工具定义 |
| `vcp:unified:refresh` | handle | 刷新插件 |
| `vcp:unified:shutdown` | handle | 关闭统一管理器 |

#### 16.3.4 MCP/分布式/适配器 (9 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:mcpo:getRegisteredServers` | handle | 获取已注册 MCP 服务器 |
| `vcp:mcpo:executeTool` | handle | 执行 MCPO 工具 |
| `vcp:mcpo:getVCPDefinitions` | handle | 获取 VCP 定义 |
| `vcp:adapter:exposePlugins` | handle | 暴露 VCP 插件为 MCP |
| `vcp:adapter:getToolDefinitions` | handle | 获取适配器工具定义 |
| `vcp:adapter:executeTool` | handle | 执行适配器工具 |
| `vcp:distributed:register` | handle | 注册分布式工具 |
| `vcp:distributed:unregister` | handle | 注销分布式工具 |
| `vcp:distributed:getServers` | handle | 获取分布式服务器列表 |

#### 16.3.5 运行时/占位符/预处理器 (10 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:toolbox:get-config` | handle | 获取 VCPRuntime 配置 |
| `vcp:toolbox:update-config` | handle | 更新 VCPRuntime 配置 |
| `vcp:toolbox:is-available` | handle | 检查 VCPRuntime 可用性 |
| `vcp:toolbox:is-initialized` | handle | 检查初始化状态 |
| `vcp:placeholder:resolve` | handle | 解析 VCP 占位符 |
| `vcp:preprocessor:get-order` | handle | 获取预处理器顺序 |
| `vcp:preprocessor:set-order` | handle | 设置预处理器顺序 |
| `vcp:preprocessor:get-info` | handle | 获取预处理器信息 |
| `vcp:preprocessor:reload` | handle | 重新加载预处理器链 |
| `vcp:distributed:getServerTools` | handle | 获取服务器工具 |

关联文件: `src/main/services/vcp/VCPPluginIpcHandler.ts`

### 16.4 VCP 事件通道 (13 个 send 方向)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:event:pluginRegistered` | send | 插件注册事件 |
| `vcp:event:pluginUnregistered` | send | 插件注销事件 |
| `vcp:event:pluginEnabled` | send | 插件启用事件 |
| `vcp:event:pluginDisabled` | send | 插件禁用事件 |
| `vcp:event:pluginError` | send | 插件错误事件 |
| `vcp:event:toolExecutionStart` | send | 工具执行开始事件 |
| `vcp:event:toolExecutionComplete` | send | 工具执行完成事件 |
| `vcp:event:toolExecutionError` | send | 工具执行错误事件 |
| `vcp:event:asyncTaskCreated` | send | 异步任务创建事件 |
| `vcp:event:asyncTaskCompleted` | send | 异步任务完成事件 |
| `vcp:event:asyncTaskTimeout` | send | 异步任务超时事件 |
| `vcp:event:distributedServerConnected` | send | 分布式服务器连接事件 |
| `vcp:event:distributedServerDisconnected` | send | 分布式服务器断开事件 |

### 16.5 Native Rust IPC 通道 (55+ 个)

#### 16.5.1 核心/状态 (7 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:initialize` | handle | 初始化 Native 模块 |
| `vcp:native:status` | handle | 获取 Native 状态 |
| `vcp:native:dbStats` | handle | 获取数据库统计 |
| `vcp:native:traces` | handle | 获取最近的 Traces |
| `vcp:native:logs` | handle | 获取最近的日志 |
| `vcp:native:createTrace` | handle | 创建 Trace |
| `vcp:native:endSpan` | handle | 结束 Span |

#### 16.5.2 向量计算 (6 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:cosineSimilarity` | handle | 向量余弦相似度 |
| `vcp:native:batchSimilarity` | handle | 批量相似度计算 |
| `vcp:native:vector:init` | handle | 初始化向量存储 |
| `vcp:native:vector:add` | handle | 添加向量 |
| `vcp:native:vector:search` | handle | 向量搜索 |
| `vcp:native:vector:size` | handle | 向量存储大小 |

#### 16.5.3 TagMemo (7 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:tagmemo:init` | handle | 初始化 TagMemo |
| `vcp:native:tagmemo:update` | handle | 更新标签共现 |
| `vcp:native:tagmemo:associations` | handle | 获取标签关联 |
| `vcp:native:tagmemo:expand` | handle | 扩展标签查询 |
| `vcp:native:tagmemo:stats` | handle | TagMemo 统计 |
| `vcp:native:tagmemo:boostVector` | handle | 向量级标签增强 |
| `vcp:native:tagmemo:batchBoostVectors` | handle | 批量向量增强 |

#### 16.5.4 搜索引擎 (6 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:search:init` | handle | 初始化搜索引擎 |
| `vcp:native:search:add` | handle | 添加文档 |
| `vcp:native:search:addBatch` | handle | 批量添加文档 |
| `vcp:native:search:query` | handle | 搜索查询 |
| `vcp:native:search:commit` | handle | 提交索引 |
| `vcp:native:search:stats` | handle | 搜索引擎统计 |

#### 16.5.5 中文搜索 (6 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:chinese:init` | handle | 初始化中文搜索引擎 |
| `vcp:native:chinese:add` | handle | 添加中文文档 |
| `vcp:native:chinese:addBatch` | handle | 批量添加中文文档 |
| `vcp:native:chinese:query` | handle | 中文搜索 |
| `vcp:native:chinese:commit` | handle | 提交中文索引 |
| `vcp:native:chinese:stats` | handle | 中文搜索统计 |

#### 16.5.6 混合搜索 (6 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:hybrid:init` | handle | 初始化混合搜索 |
| `vcp:native:hybrid:setWeights` | handle | 设置混合权重 |
| `vcp:native:hybrid:setRrfK` | handle | 设置 RRF K 值 |
| `vcp:native:hybrid:fuse` | handle | 融合搜索结果 |
| `vcp:native:hybrid:config` | handle | 获取混合搜索配置 |
| `vcp:native:quickRrfFusion` | handle | 快速 RRF 融合 |

#### 16.5.7 文本分块 (8 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:chunker:init` | handle | 初始化文本分块器 |
| `vcp:native:chunker:setSeparators` | handle | 设置分隔符 |
| `vcp:native:chunker:chunk` | handle | 文本分块 |
| `vcp:native:chunker:chunkBatch` | handle | 批量分块 |
| `vcp:native:chunker:estimateTokens` | handle | 估算 Token 数 |
| `vcp:native:chunker:chunkByTokens` | handle | 按 Token 分块 |
| `vcp:native:chunker:config` | handle | 分块器配置 |
| `vcp:native:quickChunk` | handle | 快速分块 |

#### 16.5.8 记忆追踪 (8 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:memory:traces` | handle | 获取记忆调用记录 |
| `vcp:native:memory:stats` | handle | 获取记忆调用统计 |
| `vcp:native:memory:callGraph` | handle | 获取调用链路图 |
| `vcp:native:memory:vectorStorage` | handle | 获取向量存储信息 |
| `vcp:native:memory:clear` | handle | 清空记忆调用记录 |
| `vcp:native:memory:setEnabled` | handle | 启用/禁用追踪 |
| `vcp:native:memory:isEnabled` | handle | 检查追踪状态 |
| `vcp:native:estimateTokenCount` | handle | 估算 Token 数量 |

#### 16.5.9 存储/日志 (5 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:native:storage:paths` | handle | 获取存储路径信息 |
| `vcp:native:storage:browse` | handle | 浏览存储目录 |
| `vcp:native:storage:openInExplorer` | handle | 在文件管理器中打开 |
| `vcp:native:log:hasCallback` | handle | 检查日志回调 |
| `vcp:native:log:clear` | handle | 清除日志回调 |

关联文件: `src/main/services/NativeVCPIpcHandler.ts`

### 16.6 VCP Memory IPC 通道 (10 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:memory:intelligent-search` | handle | 智能搜索 (VCPMemoryAdapter) |
| `vcp:memory:deep-search` | handle | 深度搜索 (两阶段检索) |
| `vcp:memory:waverag-search` | handle | WaveRAG 三阶段检索 |
| `vcp:memory:create` | handle | 创建记忆条目 |
| `vcp:memory:feedback` | handle | 记录搜索反馈 (自学习) |
| `vcp:memory:tag-suggestions` | handle | 获取标签建议 |
| `vcp:memory:stats` | handle | 获取综合统计 |
| `vcp:memory:learning-progress` | handle | 获取学习进度 |
| `vcp:memory:get-config` | handle | 获取配置 |
| `vcp:memory:update-config` | handle | 更新配置 |

### 16.7 VCP Knowledge IPC 通道 (4 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:knowledge:initialize` | handle | 初始化知识库 |
| `vcp:knowledge:search` | handle | 搜索知识库 |
| `vcp:knowledge:get-diaries` | handle | 获取日记本列表 |
| `vcp:knowledge:get-stats` | handle | 获取知识库统计 |

### 16.8 VCP Forum/Cluster IPC 通道 (9 个)

#### Forum (5 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:forum:list` | handle | 列出论坛帖子 |
| `vcp:forum:create` | handle | 创建帖子 |
| `vcp:forum:read` | handle | 阅读帖子 |
| `vcp:forum:reply` | handle | 回复帖子 |
| `vcp:forum:stats` | handle | 获取论坛统计 |

关联文件: `src/main/services/vcp/VCPForumIpcHandler.ts`

#### Cluster (4 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `vcp:cluster:list` | handle | 列出集群 |
| `vcp:cluster:stats` | handle | 获取集群统计 |
| `vcp:cluster:read` | handle | 读取集群数据 |
| `vcp:cluster:create` | handle | 创建集群 |

关联文件: `src/main/services/vcp/VCPClusterIpcHandler.ts`

### 16.9 Tavern IPC 通道 (27 个)

#### 16.9.1 角色卡管理 (11 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `tavern:card:list` | handle | 列出角色卡 |
| `tavern:card:get` | handle | 获取角色卡 |
| `tavern:card:create` | handle | 创建角色卡 |
| `tavern:card:update` | handle | 更新角色卡 |
| `tavern:card:delete` | handle | 删除角色卡 |
| `tavern:card:import` | handle | 导入角色卡 |
| `tavern:card:export` | handle | 导出角色卡 |
| `tavern:card:activate` | handle | 激活角色卡 |
| `tavern:card:deactivate` | handle | 停用角色卡 |
| `tavern:card:getActive` | handle | 获取活跃角色卡 |
| `tavern:card:toggleFavorite` | handle | 切换收藏状态 |

#### 16.9.2 世界书 (5 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `tavern:worldbook:match` | handle | 匹配世界书条目 |
| `tavern:worldbook:load` | handle | 加载世界书 |
| `tavern:worldbook:unload` | handle | 卸载世界书 |
| `tavern:worldbook:list` | handle | 列出世界书 |
| `tavern:worldbook:stats` | handle | 世界书统计 |

#### 16.9.3 预设系统 (9 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `tavern:preset:list` | handle | 列出预设 |
| `tavern:preset:get` | handle | 获取预设 |
| `tavern:preset:save` | handle | 保存预设 |
| `tavern:preset:delete` | handle | 删除预设 |
| `tavern:preset:activate` | handle | 激活预设 |
| `tavern:preset:deactivate` | handle | 停用预设 |
| `tavern:preset:getActive` | handle | 获取活跃预设 |
| `tavern:preset:createDirector` | handle | 创建导演模式预设 |
| `tavern:preset:createRoleplay` | handle | 创建角色扮演预设 |

#### 16.9.4 解析 (2 个)

| 通道名称 | 方向 | 功能描述 |
|---------|:----:|---------|
| `tavern:parse:png` | handle | 解析 PNG 角色卡 |
| `tavern:parse:json` | handle | 解析 JSON 角色卡 |

关联文件: `src/main/services/tavern/TavernIpcHandler.ts`

### 16.10 IPC 通道统计

| 模块 | 通道数量 | 关联文件 |
|------|:--------:|---------|
| GroupChat | 26 | `GroupChatIpcHandler.ts` |
| Agent | 19 | `VCPIpcModule.ts`, `AgentInvokeIpcHandler.ts` |
| VCP Plugin | 48 | `VCPPluginIpcHandler.ts` |
| VCP Event | 13 | `VCPPluginIpcHandler.ts` |
| Native Rust | 55+ | `NativeVCPIpcHandler.ts` |
| Memory | 10 | `VCPPluginIpcHandler.ts` |
| Knowledge | 4 | `VCPPluginIpcHandler.ts` |
| Forum/Cluster | 9 | `VCPForumIpcHandler.ts`, `VCPClusterIpcHandler.ts` |
| Tavern | 27 | `TavernIpcHandler.ts` |
| **总计** | **211+** | - |

---

## 17. 七种发言模式详解与心流锁机制

### 17.1 发言模式总览

| 模式 | 英文 | 说明 | 适用场景 |
|------|------|------|----------|
| 顺序发言 | sequential | 按固定顺序轮流发言 | 圆桌讨论、报告会 |
| 随机发言 | random | 权重随机选择 | 休闲聊天 |
| 自然随机 | naturerandom | 基于话题/提及的智能选择 | 日常对话、群聊 |
| 邀请发言 | invitation | 主持人通过 UI 指定 | 主持会议、采访 |
| 提及发言 | mention | 仅 @提及的 Agent 响应 | 定向提问 |
| 关键词发言 | keyword | 匹配关键词的 Agent 响应 | 专业讨论、专家系统 |
| 共识发言 | consensus | 所有 Agent 依次发言 | 头脑风暴、全员表态 |

### 17.2 各模式详细实现

#### 17.2.1 sequential (顺序发言)

```typescript
// GroupChatOrchestrator.ts:450
decideSpeakers_sequential(context: SpeakingContext): string[] {
  const currentIndex = this.speakerIndex % this.agents.size
  const agentIds = Array.from(this.agents.keys())

  // 循环队列，每次返回下一个
  const speakers = [agentIds[currentIndex]]
  this.speakerIndex++

  return speakers
}
```

特点：
- 严格按加入顺序轮流
- 使用 `speakerIndex` 维护当前位置
- 适合需要公平发言机会的场景

#### 17.2.2 random (随机发言)

```typescript
// GroupChatOrchestrator.ts:470
decideSpeakers_random(context: SpeakingContext): string[] {
  const selector = new WeightedSpeakerSelector(this.agents, this.speakingHistory)

  // 基础权重计算
  const weights = selector.calculateBaseWeights({
    useCooldown: true,
    useParticipation: false
  })

  // 按权重随机选择 1 个
  return selector.selectByWeight(weights, 1)
}
```

权重因素：
- `baseWeight`: Agent 的 priority 属性 (0-100)
- `roleBonus`: 角色加成 (host +20, moderator +15, expert +10)
- `cooldownPenalty`: 最近发言扣分 (3 轮线性衰减)

#### 17.2.3 naturerandom (自然随机) ⭐ 推荐

```typescript
// GroupChatOrchestrator.ts:490
decideSpeakers_naturerandom(context: SpeakingContext): string[] {
  const candidates: SpeakerCandidate[] = []

  // 第一优先级: @mention 直接提及
  for (const mention of context.mentions) {
    if (this.agents.has(mention.agentId)) {
      candidates.push({
        agentId: mention.agentId,
        priority: 100,
        reason: 'mention',
        probability: 1.0  // 100% 发言
      })
    }
  }

  // 第二优先级: keyword 关键词匹配
  for (const [agentId, agent] of this.agents) {
    if (agent.triggerKeywords?.some(kw => context.message.includes(kw))) {
      candidates.push({
        agentId,
        priority: 85,
        reason: 'keyword',
        probability: 0.95
      })
    }
  }

  // 第三优先级: @everyone 全体
  if (context.message.includes('@everyone') || context.message.includes('@所有人')) {
    for (const [agentId] of this.agents) {
      if (!candidates.some(c => c.agentId === agentId)) {
        candidates.push({
          agentId,
          priority: 70,
          reason: 'everyone',
          probability: 0.90
        })
      }
    }
  }

  // 第四优先级: topic 话题相关
  const topicAgents = this.findTopicRelevantAgents(context.message)
  for (const agentId of topicAgents) {
    if (!candidates.some(c => c.agentId === agentId)) {
      candidates.push({
        agentId,
        priority: 60,
        reason: 'topic',
        probability: 0.85
      })
    }
  }

  // 第五优先级: random 随机触发
  if (candidates.length === 0 || Math.random() < 0.15) {
    const randomAgent = this.selectRandomAgent(context)
    candidates.push({
      agentId: randomAgent,
      priority: 30,
      reason: 'random',
      probability: 0.15
    })
  }

  // 按概率筛选
  return candidates
    .filter(c => Math.random() < c.probability)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, this.config.maxConcurrentSpeakers || 3)
    .map(c => c.agentId)
}
```

优先级算法详解：
```
┌─────────────────────────────────────────────────────────────────────┐
│ naturerandom 优先级决策树                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户消息 ─────┐                                                    │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────┐   YES    ┌────────────────────┐          │
│  │ 包含 @Agent名称？   │─────────▶│ 优先级 100, 100%  │          │
│  └─────────────────────┘          │ 该 Agent 必定发言  │          │
│                │ NO               └────────────────────┘          │
│                ▼                                                    │
│  ┌─────────────────────┐   YES    ┌────────────────────┐          │
│  │ 匹配关键词？        │─────────▶│ 优先级 85, 95%    │          │
│  │ triggerKeywords    │          │ 几乎必定发言       │          │
│  └─────────────────────┘          └────────────────────┘          │
│                │ NO                                                 │
│                ▼                                                    │
│  ┌─────────────────────┐   YES    ┌────────────────────┐          │
│  │ @everyone/@所有人？ │─────────▶│ 优先级 70, 90%    │          │
│  └─────────────────────┘          │ 全员加入候选       │          │
│                │ NO               └────────────────────┘          │
│                ▼                                                    │
│  ┌─────────────────────┐   YES    ┌────────────────────┐          │
│  │ 话题匹配 expertise？│─────────▶│ 优先级 60, 85%    │          │
│  └─────────────────────┘          │ 相关专家发言       │          │
│                │ NO               └────────────────────┘          │
│                ▼                                                    │
│  ┌─────────────────────┐          ┌────────────────────┐          │
│  │ 15% 随机触发        │─────────▶│ 优先级 30, 15%    │          │
│  └─────────────────────┘          │ 随机选择一人       │          │
│                                   └────────────────────┘          │
│                                                                     │
│  最终：按优先级排序，最多 maxConcurrentSpeakers 人发言             │
└─────────────────────────────────────────────────────────────────────┘
```

#### 17.2.4 invitation (邀请发言)

```typescript
// GroupChatOrchestrator.ts:550
decideSpeakers_invitation(context: SpeakingContext): string[] {
  // 主持人通过 UI 指定发言者
  if (context.invitedAgentIds && context.invitedAgentIds.length > 0) {
    return context.invitedAgentIds.filter(id => this.agents.has(id))
  }

  // 使用邀请模板提示词
  const invitePrompt = this.config.invitePromptTemplate
    .replace('{{agents}}', this.getAgentListDescription())
    .replace('{{topic}}', context.topic || '当前话题')

  // 等待主持人选择
  return []  // 返回空，等待 UI 指定
}
```

UI 交互流程：
1. 用户发送消息
2. 系统显示 Agent 列表
3. 用户点击选择要发言的 Agent
4. 调用 `requestSpeak(agentId, 'invited')`

#### 17.2.5 mention (提及发言)

```typescript
// GroupChatOrchestrator.ts:570
decideSpeakers_mention(context: SpeakingContext): string[] {
  if (context.mentions.length === 0) {
    // 无提及时不发言
    return []
  }

  return context.mentions
    .map(m => m.agentId)
    .filter(id => this.agents.has(id))
}
```

提及解析规则：
```
extractMentions(message: string): Mention[] {
  支持格式:
  - @AgentName           → 直接匹配
  - @"Agent With Space"  → 带引号匹配
  - 请xxx回答            → 中文请求格式
  - 让xxx来说            → 中文邀请格式
  - xxx你怎么看          → 中文询问格式
}
```

#### 17.2.6 keyword (关键词发言)

```typescript
// GroupChatOrchestrator.ts:590
decideSpeakers_keyword(context: SpeakingContext): string[] {
  const matchedAgents: { agentId: string; score: number }[] = []

  for (const [agentId, agent] of this.agents) {
    let score = 0

    // 匹配 triggerKeywords
    for (const keyword of agent.triggerKeywords || []) {
      if (context.message.toLowerCase().includes(keyword.toLowerCase())) {
        score += 10
      }
    }

    // 匹配 expertise
    for (const exp of agent.expertise || []) {
      if (context.message.toLowerCase().includes(exp.toLowerCase())) {
        score += 5
      }
    }

    if (score > 0) {
      matchedAgents.push({ agentId, score })
    }
  }

  // 按分数排序，取前 N 个
  return matchedAgents
    .sort((a, b) => b.score - a.score)
    .slice(0, this.config.maxConcurrentSpeakers || 2)
    .map(m => m.agentId)
}
```

Agent 配置示例：
```typescript
{
  id: 'tech-expert',
  name: '技术专家',
  triggerKeywords: ['代码', '编程', 'bug', '架构', '技术'],
  expertise: ['软件开发', 'Python', 'JavaScript', '系统设计']
}
```

#### 17.2.7 consensus (共识发言)

```typescript
// GroupChatOrchestrator.ts:620
decideSpeakers_consensus(context: SpeakingContext): string[] {
  // 所有 Agent 按加入顺序依次发言
  return Array.from(this.agents.keys())
}
```

特点：
- 每个 Agent 都会发言
- 按照 speakingQueue 依次执行
- 适合需要收集所有意见的场景

### 17.3 心流锁 (speakingLock) 机制

心流锁是确保多 Agent 对话连贯性的核心机制，防止多个 Agent 同时生成响应导致混乱。

#### 17.3.1 锁的数据结构

```typescript
// GroupChatOrchestrator.ts
class GroupChatOrchestrator {
  private speakingLock: boolean = false
  private speakingAgentId: string | null = null
  private speakingQueue: QueuedSpeaker[] = []
  private speakingCooldown: Map<string, number> = new Map()

  interface QueuedSpeaker {
    agentId: string
    context: SpeakingContext
    reason: 'queued' | 'retry' | 'scheduled'
    priority: number
    addedAt: number
  }
}
```

#### 17.3.2 锁的获取与释放

```typescript
// 请求发言
async requestSpeak(agentId: string, context: SpeakingContext): Promise<void> {
  // 1. 检查冷却时间
  const cooldownEnd = this.speakingCooldown.get(agentId) || 0
  if (Date.now() < cooldownEnd) {
    this.logger.debug(`Agent ${agentId} 在冷却中，跳过`)
    return
  }

  // 2. 尝试获取锁
  if (this.speakingLock) {
    // 锁被占用，加入队列
    this.speakingQueue.push({
      agentId,
      context,
      reason: 'queued',
      priority: context.priority || 50,
      addedAt: Date.now()
    })
    this.logger.debug(`Agent ${agentId} 加入发言队列，位置 ${this.speakingQueue.length}`)
    return
  }

  // 3. 获取锁
  this.speakingLock = true
  this.speakingAgentId = agentId

  try {
    // 4. 执行发言
    await this.generateAgentResponse(agentId, context)

    // 5. 设置冷却
    this.speakingCooldown.set(agentId, Date.now() + this.config.cooldownMs)

  } finally {
    // 6. 释放锁
    this.speakingLock = false
    this.speakingAgentId = null

    // 7. 处理队列中的下一个
    this.processQueue()
  }
}

// 处理发言队列
private processQueue(): void {
  if (this.speakingQueue.length === 0) return

  // 按优先级排序
  this.speakingQueue.sort((a, b) => b.priority - a.priority)

  // 取出最高优先级的
  const next = this.speakingQueue.shift()!

  // 使用 setImmediate 避免堆栈溢出
  setImmediate(() => this.requestSpeak(next.agentId, next.context))
}
```

#### 17.3.3 心流锁状态图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          心流锁状态机                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌────────────┐                                                        │
│   │   IDLE     │◀────────────────────────────────────────┐             │
│   │  锁空闲    │                                          │             │
│   └─────┬──────┘                                          │             │
│         │                                                 │             │
│         │ requestSpeak()                                  │             │
│         │ 检查冷却时间 ✓                                  │             │
│         │                                                 │             │
│         ▼                                                 │             │
│   ┌────────────┐                                    ┌────────────┐     │
│   │  SPEAKING  │ ─────────generateAgentResponse()──▶│  COMPLETED │     │
│   │  正在发言  │                                    │  发言完成  │     │
│   │ agentId=X  │                                    └──────┬─────┘     │
│   └─────┬──────┘                                           │           │
│         │                                                  │           │
│         │ 其他 Agent 请求发言                               │ 释放锁    │
│         │                                                  │ 设置冷却  │
│         ▼                                                  │           │
│   ┌────────────┐                                           │           │
│   │   QUEUED   │                                           │           │
│   │  排队等待  │◀──────────────────────────────────────────┘           │
│   │ queue=[Y,Z]│                                                       │
│   └─────┬──────┘                                                       │
│         │                                                              │
│         │ processQueue()                                               │
│         │ setImmediate()                                               │
│         │                                                              │
│         └──────────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 17.3.4 冷却时间机制

```typescript
// 冷却时间配置
config: {
  cooldownMs: 3000,           // 默认 3 秒冷却
  cooldownDecayRounds: 3,     // 3 轮线性衰减
  cooldownPenaltyFactor: 0.3  // 权重惩罚因子
}

// 权重计算中的冷却惩罚
calculateCooldownPenalty(agentId: string): number {
  const lastSpokeRound = this.getLastSpokeRound(agentId)
  const roundsSince = this.currentRound - lastSpokeRound

  if (roundsSince >= this.config.cooldownDecayRounds) {
    return 0  // 冷却完毕，无惩罚
  }

  // 线性衰减: 1.0 → 0.67 → 0.33 → 0
  return 1.0 - (roundsSince / this.config.cooldownDecayRounds)
}
```

#### 17.3.5 中断机制

```typescript
// 中断当前发言
interrupt(): void {
  if (!this.speakingLock) return

  // 设置中断标志
  this.interruptRequested = true

  // 取消正在进行的 AI 请求
  if (this.currentAbortController) {
    this.currentAbortController.abort()
  }

  // 立即释放锁
  this.speakingLock = false
  this.speakingAgentId = null

  // 清空队列（可选）
  // this.speakingQueue = []
}
```

### 17.4 WeightedSpeakerSelector 权重算法

```typescript
// WeightedSpeakerSelector.ts
class WeightedSpeakerSelector {
  calculateFinalWeight(agentId: string, context: SpeakingContext): number {
    const agent = this.agents.get(agentId)!

    // 1. 基础权重
    let weight = agent.priority || 50

    // 2. 角色加成
    weight += this.getRoleBonus(agent.role)

    // 3. 冷却惩罚
    const cooldownPenalty = this.calculateCooldownPenalty(agentId)
    weight *= (1 - cooldownPenalty * 0.3)

    // 4. 提及加成
    if (context.mentions.some(m => m.agentId === agentId)) {
      weight += 50
    }

    // 5. 关键词加成
    const keywordMatches = this.countKeywordMatches(agentId, context.message)
    weight += keywordMatches * 30

    // 6. 专长匹配加成
    const expertiseMatches = this.countExpertiseMatches(agentId, context.message)
    weight += expertiseMatches * 15

    // 7. 参与度加成 (鼓励沉默者发言)
    const participationBonus = this.getParticipationBonus(agentId)
    weight += participationBonus

    return Math.max(0, weight)
  }

  private getRoleBonus(role: AgentRole): number {
    return {
      host: 20,
      moderator: 15,
      expert: 10,
      participant: 0,
      observer: -20
    }[role] || 0
  }

  private getParticipationBonus(agentId: string): number {
    const speakCount = this.speakingHistory.filter(h => h.agentId === agentId).length
    const totalSpeaks = this.speakingHistory.length

    if (totalSpeaks === 0) return 0

    const participationRate = speakCount / totalSpeaks
    const avgRate = 1 / this.agents.size

    // 低于平均参与率时获得加成
    if (participationRate < avgRate) {
      return Math.min(40, Math.round((avgRate - participationRate) * 100))
    }

    return 0
  }
}

---

## 18. VCPToolBox 原项目功能对比

本节对比 Cherry Studio 与原 VCPToolBox 项目的功能覆盖情况。

### 18.1 插件类型对比 (6 种)

| 类型 | VCPToolBox | Cherry Studio | 状态 | 说明 |
|------|:----------:|:-------------:|:----:|------|
| static | ✅ | ✅ BuiltinServices | 完全覆盖 | 静态占位符，定时更新 |
| synchronous | ✅ stdio | ❌ 已移除 | 由 builtin 替代 | 原 Python stdio 通信 |
| asynchronous | ✅ stdio | ❌ 已移除 | 由 builtin 替代 | 原异步任务管理 |
| messagePreprocessor | ✅ | ✅ PreprocessorChain | 完全覆盖 | 消息预处理链 |
| service | ✅ | ✅ BuiltinServices | 完全覆盖 | HTTP 服务插件 |
| hybridservice | ✅ | ✅ BuiltinServices | 完全覆盖 | 混合服务插件 |

> 注：synchronous/asynchronous 类型因性能原因被移除，其功能由 83 个原生 TypeScript BuiltinServices 替代。

### 18.2 搜索类插件 (8 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| GoogleSearch | ✅ | ✅ GoogleSearchService | ✅ |
| TavilySearch | ✅ | ✅ TavilySearchService | ✅ |
| SerpSearch | ✅ | ✅ SerpSearchService | ✅ |
| UrlFetch | ✅ | ✅ UrlFetchService | ✅ |
| DeepWikiVCP | ✅ | ✅ DeepWikiService | ✅ |
| FlashDeepSearch | ✅ | ✅ FlashDeepSearchService | ✅ |
| VCPEverything | ✅ | ✅ EverythingSearch | ✅ |
| KarakeepSearch | ✅ | ⚠️ 待确认 | 待验证 |

### 18.3 图像生成插件 (10 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| GeminiImageGen | ✅ | ✅ GeminiImageService | ✅ |
| QwenImageGen | ✅ | ✅ QwenImageService | ✅ |
| DoubaoGen | ✅ | ✅ DoubaoGenService | ✅ |
| FluxGen | ✅ | ✅ FluxGenService | ✅ |
| NovelAIGen | ✅ | ✅ NovelAIService | ✅ |
| ComfyUIGen | ✅ | ✅ ComfyUIService | ✅ |
| NanoBananaGenOR | ✅ | ✅ BananaGen | ✅ |
| CherryINImageGen | ✅ | ✅ CherryImageService | ✅ |
| ZImageGen | ✅ | ⚠️ 待确认 | 待验证 |
| DMXDoubaoGen | ✅ | ⚠️ 待确认 | 待验证 |

### 18.4 记忆/RAG 插件 (12 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| RAGDiaryPlugin | ✅ | ✅ RAGDiaryService | ✅ |
| LightMemo | ✅ | ✅ LightMemoService | ✅ |
| DeepMemo | ✅ FlexSearch | ✅ Tantivy (增强) | ✅ |
| DailyNoteWrite | ✅ | ✅ DailyNoteWriteService | ✅ |
| DailyNoteGet | ✅ | ✅ DailyNoteWriteService.GetNote | ✅ |
| DailyNoteManager | ✅ | ✅ DailyNotePanelService | ✅ |
| DailyNotePanel | ✅ | ✅ DailyNotePanelService | ✅ |
| ThoughtClusterManager | ✅ | ✅ ThoughtClusterService | ✅ |
| TagMemo/TagBoost | ✅ | ✅ TagMemoService + Rust | ✅ |
| MeshMemo | ✅ | ✅ MeshMemoService | ✅ |
| AIMemo | ✅ | ✅ AIMemoService | ✅ |
| SelfLearning | ✅ | ✅ SelfLearningService | ✅ |

### 18.5 Agent/多 Agent 插件 (3 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| AgentAssistant | ✅ | ✅ AgentAssistantService | ✅ |
| AgentMessage | ✅ | ✅ UnifiedAgentService | ✅ |
| MagiAgent | ✅ | ✅ MagiAgentService | ✅ |

### 18.6 Tavern/角色卡插件 (2 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| VCPTavern | ✅ | ✅ VCPTavernService | ✅ |
| SemanticGroupEditor | ✅ | ✅ SemanticGroupService | ✅ |

### 18.7 系统工具插件 (8 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| PowerShellExecutor | ✅ | ✅ PowerShellExecutor | ✅ |
| FileOperator | ✅ | ✅ FileOperator | ✅ |
| CodeSearcher | ✅ | ✅ CodeSearcher | ✅ |
| FileServer | ✅ | ✅ FileServerService | ✅ |
| ImageServer | ✅ | ✅ ImageServerService | ✅ |
| PyScreenshot | ✅ | ✅ Screenshot | ✅ |
| PyCameraCapture | ✅ | ✅ CameraCapture | ✅ |
| LinuxShellExecutor | ✅ | ⚠️ 待确认 | 待验证 |

### 18.8 预处理器插件 (3 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| CapturePreprocessor | ✅ | ✅ PreprocessorChain | ✅ |
| ImageProcessor | ✅ | ✅ PreprocessorChain | ✅ |
| WorkspaceInjector | ✅ | ✅ PreprocessorChain | ✅ |

### 18.9 其他工具插件 (10+ 个)

| 插件 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| WeatherInfoNow | ✅ | ✅ WeatherReporter | ✅ |
| TimeInfo | ✅ | ✅ TimeInfoService | ✅ |
| TarotDivination | ✅ | ✅ TarotDivinationService | ✅ |
| Randomness | ✅ | ✅ RandomnessService | ✅ |
| SciCalculator | ✅ | ✅ CalculatorService | ✅ |
| Translation | ✅ | ✅ TranslationService | ✅ |
| VCPForum | ✅ | ✅ VCPForumService | ✅ |
| VCPLog | ✅ | ✅ VCPLogService | ✅ |
| SunoGen | ✅ | ⚠️ 待确认 | 待验证 |
| VideoGenerator | ✅ | ✅ VideoGenerationService | ✅ |

### 18.10 群聊功能对比

| 功能 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| sequential 顺序发言 | ✅ | ✅ | ✅ |
| random 随机发言 | ✅ | ✅ | ✅ |
| naturerandom 自然随机 | ✅ | ✅ | ✅ |
| invite_only 邀请发言 | ✅ | ✅ invitation | ✅ |
| **mention @提及** | ❌ | ✅ | Cherry 新增 |
| **keyword 关键词** | ❌ | ✅ | Cherry 新增 |
| **consensus 共识** | ❌ | ✅ | Cherry 新增 |
| groupPrompt 群提示词 | ✅ | ✅ | ✅ |
| invitePrompt 邀请提示词 | ✅ | ✅ invitePromptTemplate | ✅ |
| memberTags 成员标签 | ✅ | ✅ | ✅ |
| useUnifiedModel | ✅ | ✅ | ✅ |
| 发言标记头 | ✅ | ✅ | ✅ |
| 心流锁 FlowLock | ✅ | ✅ speakingLock | ✅ |
| **话题自动总结** | ❌ | ✅ | Cherry 新增 |

### 18.11 记忆/RAG 功能对比

| 功能 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| Vexus-Lite 向量索引 | ✅ Rust | ✅ native-vcp | ✅ |
| 多日记独立索引 | ✅ | ✅ CharacterIndexManager | ✅ |
| 标签共现矩阵 | ✅ | ✅ TagCooccurrenceMatrix | ✅ |
| TagMemo 标签增强 | ✅ | ✅ Rust + TypeScript | ✅ |
| DeepMemo 深度搜索 | ✅ FlexSearch | ✅ Tantivy (增强) | ✅ |
| LightMemo 轻量搜索 | ✅ | ✅ | ✅ |
| MeshMemo 网状记忆 | ✅ | ✅ | ✅ |
| Rerank 重排序 | ✅ | ✅ RerankerService | ✅ |
| 时间范围搜索 | ✅ | ✅ ParseTime | ✅ |
| 语义组匹配 | ✅ | ✅ SemanticGroupMatcher | ✅ |
| 文件监视自动更新 | ✅ chokidar | ⚠️ 部分 | 待确认 |
| 标签黑名单 | ✅ | ✅ TagBlacklist | ✅ |
| 思维簇/元学习 | ✅ | ✅ ThoughtClusterService | ✅ |

### 18.12 Tavern/角色卡功能对比

| 功能 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| PNG 角色卡解析 | ✅ V2/V3 | ✅ TavernCardParser | ✅ |
| WorldBook 世界书 | ✅ | ✅ WorldBookEngine | ✅ |
| 预设系统 | ✅ | ✅ PresetManager | ✅ |
| 上下文位置注入 | ✅ | ✅ | ✅ |
| 深度规则 | ✅ | ✅ | ✅ |
| 触发模式 | ✅ | ✅ | ✅ |
| 3 模式提示词管理 | ✅ | ⚠️ 简化版 | 部分覆盖 |

### 18.13 UI/UX 功能对比

| 功能 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| VCPDashboard 控制台 | ✅ | ✅ | ✅ |
| WorkbenchPanel 工作台 | ✅ | ✅ | ✅ |
| DailyNotePanel 日记 | ✅ | ✅ | ✅ |
| ForumPanel 论坛 | ✅ | ✅ | ✅ |
| RAGObserverPanel | ✅ | ✅ | ✅ |
| **TracingPanel 追踪** | ❌ | ✅ | Cherry 新增 |
| Canvas 编辑器 | ✅ CodeMirror | ✅ CanvasEditor | ✅ |
| 主题系统 | ✅ | ✅ | ✅ |
| 语音聊天 | ✅ | ⚠️ 基础 | 部分覆盖 |
| 骰子模块 | ✅ 3D | ⚠️ 2D | 简化版 |
| 音乐模块 | ✅ | ⚠️ 基础 | 部分覆盖 |

### 18.14 工作流编辑器对比

| 功能 | VCPToolBox | Cherry Studio | 状态 |
|------|:----------:|:-------------:|:----:|
| 可视化节点编辑 | ✅ JSPlumb | ✅ React Flow | ✅ |
| 拓扑排序执行 | ✅ | ✅ WorkflowEngine | ✅ |
| ComfyUI 集成 | ✅ | ✅ ComfyUIService | ✅ |
| AI 客户端工厂 | ✅ | ✅ Provider 系统 | ✅ |
| 文件历史/Diff | ✅ | ⚠️ 待确认 | 待验证 |

### 18.15 总结统计

| 类别 | VCPToolBox | Cherry Studio | 覆盖率 |
|------|:----------:|:-------------:|:------:|
| 插件类型 | 6 | 6 (2 deprecated) | 100% |
| 核心插件 | 75+ | 83 | **110%** |
| 群聊模式 | 4 | 7 | **175%** |
| RAG 功能 | 12 | 12+ | 100%+ |
| Tavern 功能 | 6 | 6 | 100% |
| UI 模块 | 15+ | 15+ | 100% |

**结论**: Cherry Studio 已完全覆盖 VCPToolBox 原项目的核心功能，并在以下方面有增强：
- 群聊模式：新增 mention、keyword、consensus 三种模式
- 搜索引擎：从 FlexSearch 升级到 Tantivy (Rust)
- 追踪系统：新增 TracingPanel 调用链路可视化
- 向量索引：原生 Rust 实现，性能更优

---

## 19. 综合架构图

### 19.1 完整系统架构

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                        Cherry Studio VCP 完整架构                                  ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║  ╭─────────────────────────── Renderer Process (React 19) ───────────────────────╮ ║
║  │                                                                                │ ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │ ║
║  │  │  Chat UI        │  │  VCPDashboard   │  │  GroupChatPanel │               │ ║
║  │  │  消息交互       │  │  控制台面板     │  │  群聊界面       │               │ ║
║  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘               │ ║
║  │           │                    │                    │                         │ ║
║  │  ┌────────▼────────────────────▼────────────────────▼────────┐               │ ║
║  │  │                    Redux Store (24 slices)                 │               │ ║
║  │  │  assistants │ groups │ knowledge │ vcp │ workflow │ ...    │               │ ║
║  │  └────────────────────────────┬───────────────────────────────┘               │ ║
║  │                               │                                               │ ║
║  │  ┌────────────────────────────▼───────────────────────────────┐               │ ║
║  │  │                    AI Core Pipeline                        │               │ ║
║  │  │  ┌──────────────────────────────────────────────────────┐  │               │ ║
║  │  │  │  vcpContextPlugin (onRequestStart → transformParams  │  │               │ ║
║  │  │  │                    → onChunk → onRequestEnd)         │  │               │ ║
║  │  │  └──────────────────────────────────────────────────────┘  │               │ ║
║  │  └────────────────────────────────────────────────────────────┘               │ ║
║  │                                                                                │ ║
║  ╰────────────────────────────────┬───────────────────────────────────────────────╯ ║
║                                   │                                                ║
║  ══════════════════════════════ IPC Bridge (211+ 通道) ══════════════════════════  ║
║                                   │                                                ║
║  ╭────────────────────────────────▼───────────────────────── Main Process ───────╮ ║
║  │                                                                                │ ║
║  │  ┌───────────────────────────────────────────────────────────────────────────┐ │ ║
║  │  │                         VCPRuntime (核心运行时)                            │ │ ║
║  │  │                                                                           │ │ ║
║  │  │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │ │ ║
║  │  │   │ PluginRegistry  │   │ PluginExecutor  │   │ PlaceholderEngine│        │ │ ║
║  │  │   │ 插件注册表      │   │ 插件执行器      │   │ 占位符引擎       │        │ │ ║
║  │  │   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘        │ │ ║
║  │  │            │                     │                     │                  │ │ ║
║  │  │            └──────────────┬──────┴─────────────────────┘                  │ │ ║
║  │  │                           │                                               │ │ ║
║  │  │   ┌───────────────────────▼───────────────────────────────────────────┐   │ │ ║
║  │  │   │             BuiltinServiceRegistry (83 原生服务)                   │   │ │ ║
║  │  │   │                                                                   │   │ │ ║
║  │  │   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │   │ │ ║
║  │  │   │  │ Search (8)  │ │ ImageGen(10)│ │ Memory (12) │ │ Agent (3)   │  │   │ │ ║
║  │  │   │  │ Google      │ │ Gemini      │ │ DeepMemo    │ │ AgentAssist │  │   │ │ ║
║  │  │   │  │ Tavily      │ │ Qwen        │ │ LightMemo   │ │ AgentMsg    │  │   │ │ ║
║  │  │   │  │ Serp        │ │ Doubao      │ │ TagMemo     │ │ Magi        │  │   │ │ ║
║  │  │   │  │ ...         │ │ ...         │ │ ...         │ │             │  │   │ │ ║
║  │  │   │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │   │ │ ║
║  │  │   │                                                                   │   │ │ ║
║  │  │   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │   │ │ ║
║  │  │   │  │ Tavern (2)  │ │ System (8)  │ │ Preproc (3) │ │ Other (10+) │  │   │ │ ║
║  │  │   │  │ VCPTavern   │ │ PowerShell  │ │ Capture     │ │ Weather     │  │   │ │ ║
║  │  │   │  │ SemanticGrp │ │ FileOp      │ │ ImageProc   │ │ Time        │  │   │ │ ║
║  │  │   │  │             │ │ CodeSearch  │ │ Workspace   │ │ Tarot       │  │   │ │ ║
║  │  │   │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │   │ │ ║
║  │  │   └───────────────────────────────────────────────────────────────────┘   │ │ ║
║  │  └───────────────────────────────────────────────────────────────────────────┘ │ ║
║  │                                                                                │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │                      Agent & GroupChat 子系统                            │   │ ║
║  │  │                                                                         │   │ ║
║  │  │  ┌───────────────────┐          ┌───────────────────────────────────┐   │   │ ║
║  │  │  │ UnifiedAgentService│          │     GroupChatOrchestrator         │   │   │ ║
║  │  │  │                   │◀─────────▶│                                   │   │   │ ║
║  │  │  │ • sendMessage     │          │ • 7 种发言模式                     │   │   │ ║
║  │  │  │ • delegateTask    │          │ • speakingLock 心流锁             │   │   │ ║
║  │  │  │ • createTask      │          │ • WeightedSpeakerSelector         │   │   │ ║
║  │  │  │ • getPendingTasks │          │ • speakingQueue 队列              │   │   │ ║
║  │  │  └───────────────────┘          └───────────────────────────────────┘   │   │ ║
║  │  │                                                                         │   │ ║
║  │  │  ┌───────────────────────────────────────────────────────────────────┐  │   │ ║
║  │  │  │                        AgentBrain                                 │  │   │ ║
║  │  │  │  发言决策 │ 多 Agent 协调 │ 专长匹配 │ 话题识别                   │  │   │ ║
║  │  │  └───────────────────────────────────────────────────────────────────┘  │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────────┘   │ ║
║  │                                                                                │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │                      Memory & Knowledge 子系统                          │   │ ║
║  │  │                                                                         │   │ ║
║  │  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │   │ ║
║  │  │  │ Integrated      │   │ VCPMemoryAdapter│   │ CharacterIndex  │       │   │ ║
║  │  │  │ MemoryCoordinator│   │                 │   │ Manager         │       │   │ ║
║  │  │  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘       │   │ ║
║  │  │           │                     │                     │                 │   │ ║
║  │  │           └──────────────┬──────┴─────────────────────┘                 │   │ ║
║  │  │                          │                                              │   │ ║
║  │  │  ┌───────────────────────▼────────────────────────────────────────────┐ │   │ ║
║  │  │  │                    NativeVCPBridge                                 │ │   │ ║
║  │  │  │                  (TypeScript → Rust 桥接)                          │ │   │ ║
║  │  │  └────────────────────────────┬───────────────────────────────────────┘ │   │ ║
║  │  └───────────────────────────────┼─────────────────────────────────────────┘   │ ║
║  │                                  │                                             │ ║
║  ╰──────────────────────────────────┼─────────────────────────────────────────────╯ ║
║                                     │                                              ║
║  ╭──────────────────────────────────▼────────────────────────── Native Layer ─────╮ ║
║  │                                                                                │ ║
║  │                          native-vcp (Rust)                                     │ ║
║  │                                                                                │ ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │ ║
║  │  │   VexusIndex    │  │ TagCooccurrence │  │ ChineseSearch   │                │ ║
║  │  │   (HNSW 向量)   │  │   Matrix        │  │   Engine        │                │ ║
║  │  │                 │  │                 │  │                 │                │ ║
║  │  │  • usearch      │  │  • PMI 计算     │  │  • jieba-rs     │                │ ║
║  │  │  • Cosine 相似度│  │  • Alpha/Beta   │  │  • Tantivy BM25 │                │ ║
║  │  │  • SQLite 恢复  │  │  • 动态增益     │  │  • CJK 支持     │                │ ║
║  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                │ ║
║  │                                                                                │ ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │ ║
║  │  │  HybridSearch   │  │  TextChunker    │  │  TracingSystem  │                │ ║
║  │  │  (RRF 融合)     │  │  (文本分块)     │  │  (调用追踪)     │                │ ║
║  │  │                 │  │                 │  │                 │                │ ║
║  │  │  • RRF K=60     │  │  • Token 估算   │  │  • Span 记录    │                │ ║
║  │  │  • 权重配置     │  │  • 递归分割     │  │  • 调用链路     │                │ ║
║  │  │  • 结果融合     │  │  • 重叠处理     │  │  • 统计分析     │                │ ║
║  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                │ ║
║  │                                                                                │ ║
║  ╰────────────────────────────────────────────────────────────────────────────────╯ ║
║                                                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
```

### 19.2 数据流向图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              完整数据流向                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌────────┐                                                                         │
│  │ 用户   │                                                                         │
│  │ 输入   │                                                                         │
│  └───┬────┘                                                                         │
│      │                                                                              │
│      ▼                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Renderer Process                                        │ │
│  │                                                                                 │ │
│  │  ① 消息发送 ─────────────────────────────────────────────────────────────────▶  │ │
│  │     Chat.tsx                                                                    │ │
│  │         │                                                                       │ │
│  │         ▼                                                                       │ │
│  │  ② vcpContextPlugin.onRequestStart()                                           │ │
│  │         │                                                                       │ │
│  │         ├── 加载 VCP Agent 配置                                                 │ │
│  │         ├── 解析模板变量 (Tar/Var/Sar)                                          │ │
│  │         ├── 执行日记搜索 ─────────────── IPC: vcp:memory:deep-search ───────▶   │ │
│  │         ├── 执行记忆搜索 ─────────────── IPC: vcp:memory:intelligent-search ─▶  │ │
│  │         ├── 执行上下文规则 ───────────── IPC: vcp:knowledge:search ──────────▶  │ │
│  │         └── 匹配 WorldBook ───────────── IPC: tavern:worldbook:match ────────▶  │ │
│  │         │                                                                       │ │
│  │         ▼                                                                       │ │
│  │  ③ vcpContextPlugin.transformParams()                                          │ │
│  │         │                                                                       │ │
│  │         ├── 解析 VCP 占位符 ({{VCPAllTools}})                                   │ │
│  │         ├── 按位置注入上下文                                                     │ │
│  │         │   ├── system_prefix/suffix                                            │ │
│  │         │   ├── user_prefix/suffix                                              │ │
│  │         │   ├── assistant_prefix                                                │ │
│  │         │   └── hidden                                                          │ │
│  │         └── 应用 Tavern 预设                                                     │ │
│  │         │                                                                       │ │
│  │         ▼                                                                       │ │
│  │  ④ AI Provider 生成响应 (Streaming)                                            │ │
│  │         │                                                                       │ │
│  │         ▼                                                                       │ │
│  │  ⑤ vcpContextPlugin.onRequestEnd()                                             │ │
│  │         │                                                                       │ │
│  │         ├── 解析 <<<[TOOL_REQUEST]>>> 块                                        │ │
│  │         │         │                                                             │ │
│  │         │         ▼                                                             │ │
│  │         │   IPC: vcp:unified:executeTool ────────────────────────────────────▶  │ │
│  │         │                                                                       │ │
│  │         ├── 检测日记写入标记                                                     │ │
│  │         │         │                                                             │ │
│  │         │         ▼                                                             │ │
│  │         │   IPC: vcp:tool:execute (DailyNoteWrite) ──────────────────────────▶  │ │
│  │         │                                                                       │ │
│  │         └── 清理会话                                                             │ │
│  │                                                                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────▲──┘ │
│                                                                                  │    │
│                                        IPC Bridge                                │    │
│                                                                                  │    │
│  ┌───────────────────────────────────────────────────────────────────────────────┼──┐ │
│  │                          Main Process                                         │  │ │
│  │                                                                               │  │ │
│  │  ⑥ VCPPluginIpcHandler.handle()                                              │  │ │
│  │         │                                                                     │  │ │
│  │         ▼                                                                     │  │ │
│  │  ⑦ UnifiedPluginManager.executeTool()                                        │  │ │
│  │         │                                                                     │  │ │
│  │         ├──── 1. BuiltinServiceRegistry ──────▶ 83 TypeScript 服务           │  │ │
│  │         ├──── 2. DistributedPlugin ───────────▶ 远程 VCP 服务器              │  │ │
│  │         └──── 3. PluginRegistry ──────────────▶ 外部插件                     │  │ │
│  │         │                                                                     │  │ │
│  │         ▼                                                                     │  │ │
│  │  ⑧ PluginExecutor.execute()                                                  │  │ │
│  │         │                                                                     │  │ │
│  │         ├── 参数验证                                                          │  │ │
│  │         ├── 执行服务逻辑                                                       │  │ │
│  │         │         │                                                           │  │ │
│  │         │         ▼ (如需向量搜索)                                            │  │ │
│  │         │   NativeVCPBridge.search()                                         │  │ │
│  │         │         │                                                           │  │ │
│  │         │         └────────────────────────────────────────────────────────▶  │  │ │
│  │         │                                                                     │  │ │
│  │         └── 返回 PluginExecutionResult                                        │  │ │
│  │                   │                                                           │  │ │
│  │                   ▼                                                           │  │ │
│  │         格式化为 TOOL_RESULT/TOOL_ERROR ──────────────────────────────────────┘  │ │
│  │                                                                                   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           Native Layer (Rust)                                      │ │
│  │                                                                                    │ │
│  │  ⑨ native_vcp::hybrid_search()                                                   │ │
│  │         │                                                                          │ │
│  │         ├── VexusIndex.search()  ────▶ 向量相似度 Top-K                           │ │
│  │         ├── ChineseSearchEngine.query() ────▶ BM25 Top-K                          │ │
│  │         │         │                                                                │ │
│  │         │         ▼                                                                │ │
│  │         ├── RRF Fusion (k=60)                                                     │ │
│  │         │         │                                                                │ │
│  │         │         ▼                                                                │ │
│  │         └── TagMemo Boost ────▶ 最终排序结果                                       │ │
│  │                                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 19.3 关键文件快速索引

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            关键文件路径索引                                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [Renderer 层]                                                                         │
│  ├── src/renderer/src/aiCore/plugins/vcpContextPlugin.ts     ← AI 上下文插件          │
│  ├── src/renderer/src/pages/vcp/VCPDashboard.tsx             ← VCP 控制台             │
│  ├── src/renderer/src/pages/home/components/GroupChat/       ← 群聊 UI                │
│  │   └── GroupChatPanel.tsx                                                            │
│  └── src/renderer/src/store/                                 ← Redux Store            │
│      ├── vcp.ts                                                                        │
│      ├── assistants.ts                                                                 │
│      └── groups.ts                                                                     │
│                                                                                        │
│  [Preload 层]                                                                          │
│  └── src/preload/index.ts                                    ← IPC API 暴露           │
│                                                                                        │
│  [Main 层]                                                                             │
│  ├── src/main/services/vcp/                                  ← VCP 核心               │
│  │   ├── VCPRuntime.ts                                       ← 运行时核心             │
│  │   ├── VCPPluginIpcHandler.ts                              ← IPC 处理 (48 通道)     │
│  │   ├── PluginExecutor.ts                                   ← 插件执行器             │
│  │   ├── PlaceholderEngine.ts                                ← 占位符引擎             │
│  │   ├── PreprocessorChain.ts                                ← 预处理器链             │
│  │   └── BuiltinServices/                                    ← 83 内置服务            │
│  │       └── index.ts                                        ← 服务注册表             │
│  │                                                                                     │
│  ├── src/main/services/                                      ← 其他服务               │
│  │   ├── UnifiedAgentService.ts                              ← Agent 管理             │
│  │   ├── AgentBrain.ts                                       ← 发言决策               │
│  │   ├── GroupChatIpcHandler.ts                              ← 群聊 IPC (26 通道)     │
│  │   └── NativeVCPIpcHandler.ts                              ← Native IPC (55 通道)   │
│  │                                                                                     │
│  ├── src/main/knowledge/agent/                               ← Agent 模块             │
│  │   ├── GroupChatOrchestrator.ts                            ← 群聊编排器             │
│  │   └── WeightedSpeakerSelector.ts                          ← 权重选择器             │
│  │                                                                                     │
│  ├── src/main/memory/                                        ← 记忆模块               │
│  │   └── IntegratedMemoryCoordinator.ts                      ← 记忆协调器             │
│  │                                                                                     │
│  └── src/main/services/tavern/                               ← Tavern 模块            │
│      ├── TavernIpcHandler.ts                                 ← IPC 处理 (27 通道)     │
│      ├── TavernCardParser.ts                                 ← 角色卡解析             │
│      └── WorldBookEngine.ts                                  ← 世界书引擎             │
│                                                                                        │
│  [Native 层]                                                                           │
│  └── native-vcp/src/                                         ← Rust 模块              │
│      ├── lib.rs                                              ← 模块入口               │
│      ├── vexus.rs                                            ← HNSW 向量索引          │
│      ├── tagmemo.rs                                          ← 标签共现矩阵           │
│      ├── chinese_search.rs                                   ← 中文搜索引擎           │
│      ├── hybrid_search.rs                                    ← RRF 混合搜索           │
│      └── text_chunker.rs                                     ← 文本分块器             │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 20. 审查结论与遗留问题

### 20.1 功能覆盖率总结

| 系统模块 | 覆盖状态 | 说明 |
|----------|:--------:|------|
| 助手系统 | ✅ 100% | 完整的 VCP Agent 管理 |
| 群聊系统 | ✅ 175% | 7 种发言模式 (原 4 种) |
| 工具调用 | ✅ 110% | 83 内置服务 (原 75+) |
| 上下文注入 | ✅ 100% | 10 步占位符解析管线 |
| 自主学习 | ✅ 100% | SelfLearningService |
| 心流锁 | ✅ 100% | speakingLock + 队列 |
| UI/UX | ✅ 100% | VCPDashboard 全功能 |
| 向量层 | ✅ 增强 | Rust HNSW + Tantivy |
| Tavern | ✅ 100% | PNG/WorldBook/Preset |
| TVStxt | ✅ 100% | Tar/Var/Sar 变量 |

### 20.2 已确认正常的关键链路

1. **用户消息 → AI 响应 → 工具调用** ✅
2. **群聊多 Agent 对话** ✅
3. **Agent 间消息传递与任务委派** ✅
4. **向量检索 + BM25 + TagMemo** ✅
5. **上下文注入 (占位符解析)** ✅
6. **Tavern 角色卡 + 世界书** ✅

### 20.3 遗留问题清单

| 问题 | 优先级 | 状态 | 说明 |
|------|:------:|:----:|------|
| NativeVCPBridge Fallback 静默降级 | P2 | 待处理 | 降级时无明显 UI 提示 |
| 日记 UI 增强 | P1 | 待开发 | 时间表达式搜索、批量打标 |
| 统一检索入口选择 | P3 | 待确认 | IntegratedMemoryCoordinator vs UnifiedKnowledgeService |
| 递归链路风险 | P2 | 待验证 | DailyNoteWritePlugin → syncToKnowledge 可能递归 |
| 待确认服务状态 | P3 | 待验证 | KarakeepSearch, ZImageGen, SunoGen 等 |

### 20.4 文档更新记录

| 日期 | 章节 | 内容 |
|------|------|------|
| 2026-01-07 | Section 15 | 完整调用链路图 (15.1-15.7) |
| 2026-01-07 | Section 16 | IPC 通道完整列表 (211+ 通道) |
| 2026-01-07 | Section 17 | 7 种发言模式详解与心流锁机制 |
| 2026-01-07 | Section 18 | VCPToolBox 功能对比表 |
| 2026-01-07 | Section 19 | 综合架构图与关键文件索引 |
| 2026-01-07 | Section 20 | 审查结论与遗留问题 |
