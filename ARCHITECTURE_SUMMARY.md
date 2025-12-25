# Cherry Studio 架构概览（主应用 + 工作流模块）

本文基于现有代码深入阅读后的总结，覆盖主工程架构、核心目录、IPC/服务层、AI Core，以及工作流子系统的结构与问题点。

## 技术栈
- Electron 38 + React 19 + TypeScript
- 构建：electron-vite、Rolldown
- 状态：Redux Toolkit + Redux Persist
- UI：Ant Design 5、Tailwind CSS、styled-components
- 数据：Dexie (IndexedDB)、Drizzle ORM (SQLite)

## 顶层目录与模块
- `src/main/`：Electron 主进程
  - `ipc.ts`：IPC 通信注册中心（200+ 通道）
  - `services/`：主进程服务（文件/选择/MCP/知识库/备份/窗口等）
  - `mcpServers/`：内置 MCP servers
  - `apiServer/`：内置 API server
  - `knowledge/`：知识库处理
- `src/preload/`：预加载脚本（IPC 桥）
- `src/renderer/src/`：渲染进程 React 应用
  - `pages/`：页面
  - `components/`：通用组件（70+）
  - `store/`：Redux slices（约 24 个）
  - `hooks/`：自定义 hooks（70+）
  - `aiCore/`：AI SDK 核心（provider/middleware/legacy clients）
  - `types/`：类型定义
- `packages/`（monorepo）
  - `aiCore/`：AI SDK 封装
  - `shared/`：跨进程共享代码
  - `mcp-trace/`：MCP 追踪

## Redux 架构
- 约 24 个 slice：`assistants`, `settings`, `llm`, `mcp`, `workflow`, `messages`, `messageBlocks`, …（其余 17 个）
- 持久化黑名单：`runtime`, `messages`, `messageBlocks`, `tabs`, `toolPermissions`, `workflow`
- 跨窗口同步：`assistants/`, `settings/`, `llm/`, `selectionStore/`, `note/`, `workflow/`, `externalServices/`

## IPC 通信（主进程）
- 核心：`src/main/ipc.ts`
- 通道示例：
  - App：`App_Info`, `App_Proxy`, `App_Reload`
  - File：`File_Open`, `File_Save`, `File_Upload`
  - MCP：`Mcp_ListTools`, `Mcp_CallTool`
  - Knowledge：`KnowledgeBase_Create`, `KnowledgeBase_Search`
  - Memory：`Memory_Add`, `Memory_Search`
  - Backup：`Backup_Backup`, `Backup_RestoreFromWebdav`
  - Window：`Windows_Minimize`, `MiniWindow_Show`
  - Trace：`TRACE_SAVE_DATA`, `TRACE_OPEN_WINDOW`

## 主进程服务层（示例）
- `FileStorage.ts` (~52KB)：文件存储管理
- `SelectionService.ts` (~51KB)：文本选择助手
- `MCPService.ts`：MCP 协议管理
- `KnowledgeService.ts`：知识库 RAG
- `BackupManager.ts`：备份（WebDAV/S3/本地）
- `WindowService.ts`：多窗口管理

## 渲染进程服务层（示例）
- `services/StoreSyncService`：跨窗口状态同步
- `services/ApiService`：API 调用封装
- `services/EventService`：事件总线

## AI Core
- 目录：`src/renderer/src/aiCore/`
- 结构：`provider/`、`middleware/`、`tools/`、`plugins/`、`chunk/`、`legacy/clients/`
- 主要文件：`index_new.ts`（新版实现）、`legacy/clients`（OpenAI/Anthropic/Gemini/AWS Bedrock/Mistral/Ollama 等）
- 支持 15+ Provider，采用中间件流水线与工厂模式。

---

# 工作流模块架构

## 目录结构
```
workflow/
├── WorkflowPage.tsx          # 主页面（三栏：节点/画布/配置 + 工具栏 + 状态）
├── types/                    # 类型 & NODE_REGISTRY
│   ├── index.ts              # 核心类型
│   ├── advanced-nodes.ts     # List/Pipe/Switch/Loop
│   └── node-factory.ts       # 节点工厂
├── engine/
│   ├── WorkflowEngine.ts     # 核心执行引擎（~2200 行）
│   └── AdvancedNodeExecutor.ts
├── store/                    # Redux slice（workflow 状态）
├── hooks/                    # useWorkflow / useWorkflowHistory
├── services/                 # WorkflowStorage (localStorage), WorkflowResultStorage (IndexedDB)
├── clients/                  # Gemini/Kling/RunningHub 等
├── components/
│   ├── Canvas/               # ReactFlow 画布
│   ├── Nodes/                # 各类节点组件
│   ├── Panels/               # Node/Config/Status
│   ├── ConfigForms/          # 25+ 表单
│   ├── Toolbar/              # 工具栏
│   └── ContextMenu/          # 右键菜单
└── utils/                    # 工具函数
```

## 组件关系（简版）
- `WorkflowPage` 三栏布局：左 NodePanel（节点库）、中 WorkflowCanvas（ReactFlow）+ StatusPanel、右 ConfigPanel（配置）。
- 顶部 `WorkflowToolbar`：运行/停止、保存/加载、导入/导出、自动布局等。

## 节点类型示例
- 输入：`IMAGE_INPUT`, `TEXT_INPUT`, `FILE_INPUT`
- AI：`QWEN_PROMPT`, `VISION_PROMPT`
- 图像：`GEMINI_EDIT`, `GEMINI_GENERATE`, `GEMINI_PATTERN`, `GEMINI_ECOM`
- 视频：`KLING_IMAGE2VIDEO`
- 外部：`RUNNINGHUB_APP`
- 流程：`CONDITION`, `SUBFLOW`
- 输出：`OUTPUT`

## 引擎流程（WorkflowEngine）
1. 点击“运行” → `buildExecutionOrder()` 做拓扑排序。
2. 对每个节点：
   - `collectInputs()`：按连线收集上游输出
   - `executeNode()`：按节点类型调用执行器
   - `nodeOutputs.set()`：存储输出供下游使用
3. 自动导出未连接的输出。
- 数据传递基于 Edge 连线，而非步骤 ID。

## 已知问题/改进点
- `WorkflowEngine.ts` 体积过大，建议拆分执行器。
- `advanced-nodes`（List/Pipe/Switch/Loop）未注册到 `NODE_REGISTRY`。
- `SUBFLOW` 类型缺少执行逻辑（嵌套未实现）。
- 画布本地状态 + Redux 双向同步复杂，建议简化。
- 执行前缺少完整性校验。

## UI/样式注意
- 工作流页根容器需带 `className="workflow-root"` 以使主题/样式作用域生效（Toolbar、ReactFlow 样式依赖此作用域）。

---

# 快速认知要点
- Monorepo + Yarn workspaces；Electron 主/预/渲染三层；Redux 切片化状态；服务层封装主/渲染能力；AI Core 采用中间件流水线；IPC 通道集中注册并配套服务层。
- 工作流模块基于 ReactFlow + 自研执行引擎，节点/表单/面板/工具栏分层清晰，可按类型/连线实现数据流与执行。
