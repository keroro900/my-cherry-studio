# VCP 融合审查评估报告（VCPToolBox / VCPChat / Cherry Studio）

生成时间: 2025-01-05
**更新时间: 2025-12-29**

## 1. 审查范围

- VCPToolBox: `external/VCPToolBox`
- VCPChat: `external/VCPChat`
- Cherry Studio 本地架构文档: `cherry-studio/docs/VCP-ARCHITECTURE.md`
- Cherry Studio 关键实现代码 (见各问题定位)

## 2. 审查方法与约束

- 静态代码与文档审查为主，未运行应用
- 以"功能链路可达 / 入口缺失 / 参数不匹配"为判定依据
- UI 证据来自本地截图文件（见"截图证据索引"）

## 3. 总体结论（摘要）

- ✅ 已完成: VCP 日记 4 种声明模式、VCP Agent 管理、Context 注入、VCP 工具调用桥接、ShowVCP 调试、**AdvancedMemory 参数修复**、**FlowLock 全栈实现 (后端+UI)**、**DeepMemo Tantivy 适配**、**异步插件回调闭环 (VCPCallbackServer)**、**VCPToolResult 消息渲染**、**TOOL_REQUEST Key 归一化**、**VCPAgent 模板变量注入**、**动态 K 值语法 (kFactor)**、**对话分支（Topic 级）**
- ⚠️ 部分完成: 上下文智能 (仅 VCP 链路生效)、多 Agent 协同（仅服务/IPC/MCP，缺群聊工具暴露与 UI 入口）、知识库标签/语义组/重建索引 UI 占位、工作流/人类工具箱执行链路缺口、多模态音视频解析未实现、群聊提示词工程未接入、Agent/变量/VCPTavern 与文件化管理未对齐
- ❌ 未完成/缺失: 全局搜索、语音/TTS、共享工作区（Canvas/协作文件）、VCPFileAPI/分布式节点、vcpInfo/vcpLog UI 入口、VCPChat 插件窗口入口、VCPToolBox 管理面板/动态插件注入（含 Agent/TVStxt/VCPTavern 编辑器）

## 4. 功能实现评估（按模块）

### 4.1 协议与插件体系

- 状态: ✅ 已完成
- 已实现
  - TOOL_REQUEST 解析与 MCP 工具调用桥接: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
  - 异步结果占位符替换: `cherry-studio/src/main/services/VCPAsyncResultsService.ts`
  - **Key 归一化**: normalizeVCPKey 支持大小写、下划线、连字符等变体
  - **异步回调 HTTP 端点**: `cherry-studio/src/main/services/VCPCallbackServer.ts` (端口 6006)
- 次要差异
  - service/hybrid 插件体系未引入: 参考 `external/VCPToolBox/README.md`
  - VCPToolBox 插件清单/动态注入（Plugin.js + plugin-manifest.json）未接入，Cherry Studio 仅基于 MCP 服务器工具调用  
    参考: `external/VCPToolBox/Plugin.js`, `external/VCPToolBox/README.md`

### 4.2 工具结果渲染

- 状态: ✅ 已完成
- 已实现
  - VCPToolResult 组件: `cherry-studio/src/renderer/src/pages/home/Messages/Tools/VCPToolResult.tsx`
  - Markdown 集成: `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx` 自动检测并渲染 `<<<[TOOL_RESULT]>>>` 和 `<<<[TOOL_ERROR]>>>` 块
- 次要差异
  - VCPChat 使用 `[[VCP调用结果信息汇总:...VCP调用结果结束]]` 结果块，Cherry Studio 未识别该格式  
    参考: `external/VCPChat/modules/messageRenderer.js`, `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`

### 4.3 日记/知识检索

- 状态: 部分实现
- 已实现
  - 4 种声明语法 + 修饰符解析: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`
  - 动态 K 值语法 `[[kb:1.5]]` 已解析为 kFactor 并参与 topK 计算: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`
  - VCPSearchService 统一检索: `cherry-studio/src/main/knowledge/vcp/VCPSearchService.ts`
- 主要差异
  - 日记 UI 的标签/语义组/重建索引为占位实现，未完成持久化与同步入口  
    参考: `cherry-studio/src/renderer/src/pages/knowledge/items/KnowledgeDiary.tsx`
  - `::TimeRange(...)` 解析与执行链路不一致（TimeRange 解析为字符串，但检索只接受枚举范围，且 parseTimeInQuery 未剔除时间表达式）  
    参考: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`, `cherry-studio/src/main/knowledge/search/TimeAwareSearch.ts`, `cherry-studio/src/main/knowledge/vcp/VCPSearchService.ts`
  - VCPToolBox RAGDiaryPlugin 的时间表达式解析支持多表达式/时区/范围去重，Cherry Studio 未对齐  
    参考: `external/VCPToolBox/Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js`

### 4.4 AdvancedMemory（Light/Deep/Mesh）

- 状态: ✅ **已修复** (2025-12-29)
- 修复内容
  - UI 传参形态已修正: `getDocumentCount({ backend })`, `clear({ backend })`
  - LightMemo/DeepMemo 搜索参数已修正: `config: { topK }` / `config: { finalTopK }`
  - MeshMemo 搜索参数已修正: `queryEmbedding: [], config: { query, finalTopK }`
  - DeepMemo 默认使用 TantivyLikeAdapter 提供增强全文检索
- 相关文件
  - UI: `cherry-studio/src/renderer/src/pages/settings/MemorySettings/AdvancedMemorySettings.tsx`
  - Preload API: `cherry-studio/src/preload/index.ts`
  - IPC Handler: `cherry-studio/src/main/services/AdvancedMemoryIpcHandler.ts`
  - TantivyLikeAdapter: `cherry-studio/src/main/knowledge/deepMemo/TantivyLikeAdapter.ts`
- 主要差异
  - 全局记忆/跨端同步未接入 VCPToolBox 后端，记忆与向量库存储为本地 DB  
    参考: `cherry-studio/src/main/services/memory/MemoryService.ts`, `cherry-studio/src/main/knowledge/vector/LibSqlDbAdapter.ts`

### 4.5 VCP Agent 与上下文注入

- 状态: ✅ **已完成** (2025-12-29)
- 已实现
  - VCPAgent CRUD: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`
  - ContextInjectorService: `cherry-studio/src/main/knowledge/agent/ContextInjectorService.ts`
  - **模板变量解析**: `resolveTemplateVariables` 在 vcpContextPlugin.ts 第 461-476 行调用
  - 支持 `{{Tar*}}`、`{{Sar*}}`、`{{Var*}}` 变量自动替换

#### 4.5.1 Agent 管理器（角色/模板/变量）

- 状态: 部分实现
- 已实现
  - Agent/变量/模板可视化管理 + IPC: `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`
  - 数据存储与导入: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`
- 主要差异
  - 未对齐 VCPToolBox 的 `Agent/` 目录与 agent-map 机制，Cherry Studio 存储为 userData JSON；仅支持 .txt 导入，不支持 .txt 在线编辑/目录管理  
    参考: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`, `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`, `external/VCPToolBox/AdminPanel/js/agent-manager.js`

#### 4.5.2 高级变量编辑器（TVStxt）

- 状态: 未实现
- 主要差异
  - 变量管理仅维护内部变量表，未对齐 VCPToolBox `TVStxt/` 目录的 .txt 文件编辑/保存  
    参考: `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`, `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`, `external/VCPToolBox/AdminPanel/js/tvs-editor.js`, `external/VCPToolBox/TVStxt/`

#### 4.5.3 VCPTavern 上下文注入器

- 状态: 部分实现
- 已实现
  - 上下文注入 UI + 规则/预设管理: `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/ContextInjector.tsx`
  - 注入服务与触发引擎: `cherry-studio/src/main/knowledge/agent/ContextInjectorService.ts`
- 主要差异
  - 规则/预设存储在 userData，格式与 VCPToolBox `VCPTavern` 的 `presets/*.json` 不兼容，未解析 `{{VCPTavern::Preset}}` 触发语法  
    参考: `cherry-studio/src/main/knowledge/agent/ContextInjectorService.ts`, `external/VCPToolBox/Plugin/VCPTavern/VCPTavern.js`
  - 未接入 VCPToolBox AdminPanel 的 VCPTavern 编辑器  
    参考: `external/VCPToolBox/AdminPanel/vcptavern_editor.html`

### 4.6 上下文智能（净化/抑制）

- 状态: 已接入，但仅在 VCP 插件链路生效
- 证据
  - IPC: `cherry-studio/src/main/services/ContextIntelligenceIpcHandler.ts`
  - 调用入口: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`

### 4.7 群聊与协作

- 状态: 主要功能已实现
- 已实现
  - GroupChatOrchestrator + UI: `cherry-studio/src/main/knowledge/agent/GroupChatOrchestrator.ts`,
    `cherry-studio/src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx`
- 主要差异
  - 群聊提示词模板引擎存在但未接入: `cherry-studio/src/main/knowledge/agent/GroupPromptTemplateEngine.ts`
  - groupPrompt/invitePrompt 未暴露到群聊配置或 UI，GroupAgentRunner 的 invitePrompt 能力未被实际使用  
    参考: `cherry-studio/src/renderer/src/services/GroupChatService.ts`, `cherry-studio/src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx`, `cherry-studio/src/renderer/src/services/GroupAgentRunner.ts`
  - 共享文件工作区未实现（VCPChat 核心特性）

#### 4.7.1 多 Agent 协同（AgentCollab / 任务下发）

- 状态: 部分实现（服务/IPC/MCP 已就绪，但未形成端到端）
- 已实现
  - AgentCollaborationService: 消息/任务/投票/知识共享模型与 API: `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
  - IPC Handler: `cherry-studio/src/main/services/VCPIpcHandler.ts`
  - MCP Server & Tools: `cherry-studio/src/main/mcpServers/agent-collab.ts`, `cherry-studio/src/main/mcpServers/tools/agent-tools.ts`
- 主要差异 / 缺陷
  - GroupChat 内置工具未暴露 agent-collab（注释与实现不一致），群聊模型无法调用协同工具: `cherry-studio/src/main/knowledge/agent/GroupChatOrchestrator.ts`
  - 前端无协同入口/面板，仅存在 label/type 常量，无法创建/派发/追踪任务: `cherry-studio/src/renderer/src/i18n/label.ts`, `cherry-studio/src/renderer/src/types/index.ts`
  - `collab_send_message` messageType 枚举缺少 `task_assign`/`vote_*`，与服务端类型不一致: `cherry-studio/src/main/mcpServers/tools/agent-tools.ts`, `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
  - `findBestAgentForTask` 在 requiredSkills 为空时除以 0，可能导致 NaN 并分配失败: `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
  - 协同数据仅内存持有（messages/tasks/votes/knowledge），重启丢失且缺乏回收策略: `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`

### 4.8 Flow Lock（心流锁）

- 状态: ✅ **全栈实现完成** (2025-12-29)
- 已实现功能
  - 话题锁定服务: 支持创建、获取、解锁、延长、偏离检测
  - AI 触发: 自动检测用户意图触发锁定/解锁
  - 超时机制: 自动过期和清理
  - IPC 通道: 9 个完整的 IPC 接口
  - Preload API: `window.api.flowLock.*` 完整暴露
  - **UI 组件**: FlowLockIndicator 已集成到聊天导航栏
  - **状态 Hook**: useFlowLock 管理锁定状态
- 相关文件
  - Service: `cherry-studio/src/main/knowledge/flow/FlowLockService.ts`
  - IPC Handler: `cherry-studio/src/main/services/FlowLockIpcHandler.ts`
  - IPC 通道: `cherry-studio/packages/shared/IpcChannel.ts`
  - Preload: `cherry-studio/src/preload/index.ts`
  - **UI Component**: `cherry-studio/src/renderer/src/components/FlowLock/FlowLockIndicator.tsx`
  - **Hook**: `cherry-studio/src/renderer/src/hooks/useFlowLock.ts`
  - **集成**: `cherry-studio/src/renderer/src/pages/home/components/ChatNavbarContent.tsx`

### 4.9 实时状态与日志（vcpInfo/vcpLog）

- 状态: 服务与 Hook 完成，但缺 UI 入口
- 证据
  - Hook: `cherry-studio/src/renderer/src/hooks/useVCPInfo.ts`
  - Preload: `cherry-studio/src/preload/index.ts`
  - UI 仅有 ShowVCP 面板: `cherry-studio/src/renderer/src/components/VCP/VCPDebugPanel.tsx`
  - 对比: VCPToolBox 日志面板示例: `external/VCPToolBox/示例2.jpg`

### 4.10 VCPChat 特色能力（多模态/语音/插件窗口）

- 状态: 多数未迁移
- 主要缺失
  - TTS、语音输入、插件窗口、全局搜索、共享工作区/Canvas
  - 对话分支：Cherry Studio 已支持 Topic 级分支，但群聊/Canvas 分支未对齐  
    参考: `cherry-studio/src/renderer/src/hooks/useMessageOperations.ts`, `cherry-studio/src/renderer/src/pages/home/Messages/MessageMenubar.tsx`, `external/VCPChat/modules/chatManager.js`
  - 参考: `external/VCPChat/README.md`

### 4.11 VCP API 暴露与架构符合度

- 状态: 部分实现
- 已实现
  - vcpInfo/vcpLog/vcpCallback 已通过 window.api 暴露: `cherry-studio/src/preload/index.ts`
- 主要差异
  - 架构文档要求 `window.api.vcp.agent.* / vcp.injector.* / vcp.diary.*`，当前未暴露，前端依赖直接 `ipcRenderer.invoke('vcp:*')`  
    参考: `cherry-studio/docs/VCP-ARCHITECTURE.md`, `cherry-studio/src/preload/index.ts`, `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`

### 4.12 工作流/人类工具箱（Workflow / VCPHumanToolBox）

- 状态: 部分实现
- 主要差异
  - MCP 工作流服务端执行链路未实现，当前仅返回调试数据: `cherry-studio/src/main/mcpServers/workflow.ts`
  - Renderer 侧工作流执行仍为 TODO，占位返回: `cherry-studio/src/renderer/src/services/MCPBridgeHandler.ts`

### 4.13 多模态处理与渲染

- 状态: 部分实现
- 主要差异
  - Markdown 渲染限制 HTML 元素，禁用 `iframe/script`，未包含 `video/audio/canvas`，VCPChat 复杂多媒体气泡难以完整渲染  
    参考: `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`
  - 多模态嵌入的音视频转录/抽帧未实现  
    参考: `cherry-studio/src/main/knowledge/multimodal/MultimodalEmbeddingService.ts`

### 4.14 全局搜索/本地搜索

- 状态: 未完成
- 主要差异
  - LocalSearchProvider 未实现 URL 解析逻辑，实际调用会抛错  
    参考: `cherry-studio/src/renderer/src/providers/WebSearchProvider/LocalSearchProvider.ts`

## 5. 关键问题清单（含定位）

### P0

- ~~AdvancedMemory UI 与 API 参数不一致，MeshMemo 直接不可用~~
  ✅ **已修复** (2025-12-29): UI 传参形态已修正，DeepMemo 增加 TantivyLikeAdapter
- ~~异步插件回调闭环缺失（无法写回结果）~~
  ✅ **已完成** (2025-12-29): VCPCallbackServer HTTP端点实现，监听 :6006 端口
  证据: `cherry-studio/src/main/services/VCPCallbackServer.ts`,
  `cherry-studio/src/renderer/src/hooks/useVCPAsyncNotification.ts`

### P1

- ~~TOOL_REQUEST 解析未实现 key 归一化，`-` 等字符键名无法解析~~
  ✅ **已验证** (2025-12-29): normalizeVCPKey 支持 `[\w-]+` 格式，大小写/下划线/连字符均兼容
  证据: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
- ~~TOOL_RESULT/TOOL_ERROR 结构化渲染未接入消息链路~~
  ✅ **已验证** (2025-12-29): Markdown.tsx 已集成 VCPToolResult 组件，支持结构化渲染
  证据: `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`
- ~~VCPAgent 模板变量未渲染进系统提示词~~
  ✅ **已验证** (2025-12-29): resolveTemplateVariables 完整实现 Tar/Sar/Var 变量
  证据: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`,
  `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
- 多 Agent 协同任务下发链路未贯通（GroupChat 未暴露 agent-collab 工具 + 前端无入口）
  证据: `cherry-studio/src/main/knowledge/agent/GroupChatOrchestrator.ts`,
  `cherry-studio/src/renderer/src/i18n/label.ts`,
  `cherry-studio/src/renderer/src/types/index.ts`
- 群聊提示词工程未接入（groupPrompt/invitePrompt/模板引擎未暴露）
  证据: `cherry-studio/src/renderer/src/services/GroupChatService.ts`,
  `cherry-studio/src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx`,
  `cherry-studio/src/main/knowledge/agent/GroupPromptTemplateEngine.ts`
- Agent 管理器未对齐 VCPToolBox `Agent/` 目录与 .txt 在线编辑能力
  证据: `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`,
  `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`,
  `external/VCPToolBox/AdminPanel/js/agent-manager.js`
- 高级变量编辑器（TVStxt）未接入
  证据: `external/VCPToolBox/AdminPanel/js/tvs-editor.js`, `external/VCPToolBox/TVStxt/`,
  `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`
- VCPTavern 预设兼容性缺失（与 VCPToolBox 预设格式/触发语法不一致）
  证据: `cherry-studio/src/main/knowledge/agent/ContextInjectorService.ts`,
  `external/VCPToolBox/Plugin/VCPTavern/VCPTavern.js`
- 知识库标签/语义组/重建索引 UI 仅占位，未接入持久化/同步
  证据: `cherry-studio/src/renderer/src/pages/knowledge/items/KnowledgeDiary.tsx`
- 工作流/人类工具箱执行链路未落地（MCP workflow 仅占位）
  证据: `cherry-studio/src/main/mcpServers/workflow.ts`,
  `cherry-studio/src/renderer/src/services/MCPBridgeHandler.ts`
- 本地搜索 Provider 未实现解析逻辑，调用会直接抛错
  证据: `cherry-studio/src/renderer/src/providers/WebSearchProvider/LocalSearchProvider.ts`

### P2

- ~~FlowLock 服务已实现但 UI/对话流未接入~~
  ✅ **全栈已完成** (2025-12-29): Service/IPC/Preload/UI 全部实现
  证据: `cherry-studio/src/main/knowledge/flow/FlowLockService.ts`,
  `cherry-studio/src/main/services/FlowLockIpcHandler.ts`,
  `cherry-studio/src/preload/index.ts`,
  `cherry-studio/src/renderer/src/components/FlowLock/FlowLockIndicator.tsx`,
  `cherry-studio/src/renderer/src/hooks/useFlowLock.ts`
- vcpInfo/vcpLog Hook 未接入 UI
  证据: `cherry-studio/src/renderer/src/hooks/useVCPInfo.ts`
- `::TimeRange(...)` 解析/执行链路缺口（含 parseTimeInQuery 未剔除表达式）
  证据: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`,
  `cherry-studio/src/main/knowledge/search/TimeAwareSearch.ts`,
  `cherry-studio/src/main/knowledge/vcp/VCPSearchService.ts`
- VCPChat 结果块格式不兼容（`[[VCP调用结果信息汇总:...]]` 未被渲染）
  证据: `external/VCPChat/modules/messageRenderer.js`,
  `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`
- VCP API 暴露与架构文档不一致（缺少 `window.api.vcp.*`）
  证据: `cherry-studio/docs/VCP-ARCHITECTURE.md`,
  `cherry-studio/src/preload/index.ts`,
  `cherry-studio/src/renderer/src/pages/knowledge/components/Agent/AgentManager.tsx`
- `collab_send_message` messageType 枚举缺少 `task_assign`/`vote_*`，与服务端不一致
  证据: `cherry-studio/src/main/mcpServers/tools/agent-tools.ts`,
  `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
- `findBestAgentForTask` 在 requiredSkills 为空时除以 0
  证据: `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
- 协同数据仅内存持有（messages/tasks/votes/knowledge），缺持久化/回收策略
  证据: `cherry-studio/src/main/knowledge/agent/AgentCollaborationService.ts`
- 多模态嵌入的音视频转录/抽帧未实现
  证据: `cherry-studio/src/main/knowledge/multimodal/MultimodalEmbeddingService.ts`
- Markdown 渲染限制多媒体元素，复杂气泡无法完整呈现
  证据: `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`
- 记忆/向量库仅本地持久化，未见跨端/分布式同步
  证据: `cherry-studio/src/main/services/memory/MemoryService.ts`,
  `cherry-studio/src/main/knowledge/vector/LibSqlDbAdapter.ts`

## 6. UI 一致性审查（含截图证据）

- VCPChat 工具气泡与富渲染能力未对齐，Cherry Studio 当前仅文本标记  
  证据: `external/VCPChat/assets/E1.jpg`
- VCPChat 插件窗口与协作画布能力缺入口  
  证据: `external/VCPChat/assets/E7.png`
- 多 Agent 协同入口/面板缺失（当前无可截图入口）  
  证据: `cherry-studio/src/renderer/src/i18n/label.ts`, `cherry-studio/src/renderer/src/types/index.ts`
- 富多媒体渲染能力与 VCPChat 差异大（HTML 元素限制，音视频/iframe 无法直接渲染）  
  证据: `cherry-studio/src/renderer/src/pages/home/Markdown/Markdown.tsx`
- VCPToolBox 管理面板功能未融入 Cherry Studio 设置体系  
  证据: `external/VCPToolBox/示例1.jpg`
- VCPToolBox 的 Agent/TVStxt/VCPTavern 编辑器未集成  
  证据: `external/VCPToolBox/AdminPanel/js/agent-manager.js`, `external/VCPToolBox/AdminPanel/js/tvs-editor.js`, `external/VCPToolBox/AdminPanel/vcptavern_editor.html`
- VCPToolBox 日志/监控 UI 与 Cherry Studio 仅调试面板存在风格与入口差异  
  证据: `external/VCPToolBox/示例2.jpg`

## 7. 改进建议与时间估算（单人粗估）

1. ~~修正 AdvancedMemory UI 入参与 MeshMemo 数据流（0.5-1 天）~~ ✅ 已完成
2. ~~TOOL_REQUEST key 归一化 + 解析增强（0.5-1 天）~~ ✅ 已验证完成
3. ~~VCPToolResult 接入消息渲染链（0.5 天）~~ ✅ 已验证完成
4. ~~VCPAgent 模板/变量注入系统提示词（0.5 天）~~ ✅ 已验证完成
5. ~~异步插件回调闭环（HTTP 回调 + 结果持久化 + 可视化）（1-2 天）~~ ✅ 已完成
6. ~~FlowLock 前端入口与对话流接入（1-2 天）~~ ✅ 已完成 (2025-12-29)
7. 多 Agent 协同链路打通（GroupChat 工具暴露 + 入口/面板）（1-2 天）
8. 协同协议对齐与容错（messageType 补齐、requiredSkills 空数组保护）（0.5 天）
9. 协同数据持久化/回收策略（0.5-1 天）
10. 群聊提示词工程接入（groupPrompt/invitePrompt + 模板引擎）（1-2 天）
11. Agent 管理器对齐 Agent/ 目录与 .txt 在线编辑（1-2 天）
12. 高级变量编辑器对齐 TVStxt（0.5-1 天）
13. VCPTavern 预设兼容与 AdminPanel 对接（1-2 天）
14. 知识库标签/语义组/重建索引入口完善（1-2 天）
15. 工作流/人类工具箱 MCP 执行链路落地（2-3 天）
16. vcpInfo/vcpLog 可视化入口（0.5-1 天）
17. TimeRange/时间表达式对齐（含 parseTimeInQuery 清理 + RAGDiaryPlugin 对齐）（0.5-1 天）
18. 兼容 VCPChat 结果块 `[[VCP调用结果信息汇总]]`（0.5 天）
19. 补齐 `window.api.vcp.*` 统一桥接层（0.5-1 天）
20. 全局搜索/本地搜索 Provider 实现（0.5-1 天）
21. 多模态音视频解析/转录能力补齐（1-3 天）
22. 语音/TTS 功能迁移（3-5 天）
23. 共享工作区/Canvas（2-3 天）

## 8. 本次更新记录 (2025-12-29)

### 已完成修复

| 问题 | 状态 | 修复内容 |
|------|------|----------|
| AdvancedMemory 参数不匹配 | ✅ P0 已修复 | UI 传参形态修正，搜索参数结构修正 |
| DeepMemo Tantivy 适配 | ✅ 新增 | TantivyLikeAdapter: BM25+评分、CJK分词、倒排索引 |
| FlowLock 后端 | ✅ 完成 | Service/IPC Handler/Preload API 全部实现 |
| FlowLock UI | ✅ 完成 | FlowLockIndicator 组件、useFlowLock Hook、ChatNavbar 集成 |
| GroupChat 工具调用 | ✅ 修复 | SimpleMCPTool 接口，MCPBridge 方法调用 |
| **异步插件回调闭环** | ✅ P0 已完成 | VCPCallbackServer HTTP端点、IPC通道、Preload API |
| **VCPToolResult 消息渲染** | ✅ P1 已验证 | Markdown组件已集成VCPToolResult解析 |
| **TOOL_REQUEST Key归一化** | ✅ P1 已验证 | normalizeVCPKey支持多种键名格式 |
| **VCPAgent 模板变量注入** | ✅ P1 已验证 | resolveTemplateVariables支持Tar/Sar/Var变量 |
| **动态 K 值语法 (kFactor)** | ✅ 已验证 | DiaryModeParser 支持 `kb:1.5` 解析并映射 topK |
| **对话分支（Topic 级）** | ✅ 已验证 | MessageMenubar 入口 + createTopicBranch 逻辑 |

### 新增文件

- `src/main/knowledge/deepMemo/TantivyLikeAdapter.ts` - 增强型全文检索适配器
- `src/main/knowledge/flow/FlowLockService.ts` - 话题锁定服务
- `src/main/knowledge/flow/index.ts` - Flow 模块导出
- `src/main/services/FlowLockIpcHandler.ts` - FlowLock IPC 处理器
- `src/renderer/src/components/FlowLock/FlowLockIndicator.tsx` - FlowLock UI 组件
- `src/renderer/src/components/FlowLock/index.ts` - FlowLock 组件导出
- `src/renderer/src/hooks/useFlowLock.ts` - FlowLock 状态管理 Hook
- **`src/main/services/VCPCallbackServer.ts`** - 异步插件回调HTTP服务器
- **`src/renderer/src/hooks/useVCPAsyncNotification.ts`** - 异步回调通知Hook

### 更新文件

- `packages/shared/IpcChannel.ts` - 新增 VCP_Callback_* 和 VCP_Async_Callback 通道
- `src/main/ipc.ts` - 初始化 VCPCallbackServer
- `src/preload/index.ts` - 暴露 vcpCallback API

## 9. 截图证据索引

- VCPChat 工具气泡与富渲染: `../../../external/VCPChat/assets/E1.jpg`
- VCPChat 插件窗口/协作画布: `../../../external/VCPChat/assets/E7.png`
- VCPToolBox 管理面板: `../../../external/VCPToolBox/示例1.jpg`
- VCPToolBox 日志/监控面板: `../../../external/VCPToolBox/示例2.jpg`
- 多 Agent 协同入口缺失：暂无截图（需补拍）
- 多媒体渲染差异（video/audio/iframe）：暂无截图（需补拍）
- Agent/TVStxt/VCPTavern 编辑器差异：暂无截图（需补拍）

## 10. 待确认问题

- 异步插件回调是否由外部服务承接？若已有入口，请提供路径或配置
- FlowLock 是否计划接入群聊/普通聊天/全局模式？需要哪种交互策略
- 共享工作区是必须迁移能力还是后续可选功能
- 对话分支是否需覆盖群聊/Canvas 工作区
- 是否需要兼容 VCPChat 的结果块格式（`[[VCP调用结果信息汇总]]`）
- 多 Agent 协同是否需要独立面板或群聊内调用？是否需要任务/消息持久化策略？
- 工作流/人类工具箱是对齐 VCPChat 还是采用 Cherry Studio 工作流？是否需要开放给 VCP 工具调用？
- Agent/TVStxt/VCPTavern 是否需要对齐 VCPToolBox 文件化目录与 AdminPanel UI？
