# Cherry Studio 架构与文件作用（cherry-studio 目录）

本文件按目录列举 Cherry Studio（Electron + React + TypeScript + Vite + Playwright）的主要文件作用，覆盖 cherry-studio 下的源码、配置、脚本、资源与测试。对存在大量同构组件的目录，使用“同名模式”说明（如 `*.test.tsx` 为对应组件的单测）。

## 顶层与通用配置
- `package.json`：工作区定义、依赖、脚本入口。
- `yarn.lock`：依赖锁定。
- `tsconfig*.json` / `vitest.config.ts` / `playwright.config.ts` / `electron.vite.config.ts` / `eslint.config.mjs`：TypeScript、单测、E2E、Electron 打包与静态检查配置。
- `electron-builder.yml` / `dev-app-update.yml` / `app-upgrade-config.json` / `config/app-upgrade-segments.json`：安装包、自动更新及分组配置。
- `LICENSE`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`CONTRIBUTING.md`、`AGENTS.md`、`CLAUDE.md`、`WORKFLOW_EVOLUTION_ROADMAP.md`、`README.md`：协议、治理、路线与快速概览。
- `.env.example`、`biome.jsonc`：环境变量示例与 Biome 配置。

## 构建产物与安装资源
- `build/`：安装器资源（`icon.*`、`tray_icon*`、`logo.png`）、NSIS 安装脚本、Mac 权限清单。
- `build/icons/`：各尺寸图标。
- `resources/cherry-studio/*.html`：隐私、许可、发布说明静态页。
- `resources/scripts/*`：bun/uv/ovms 安装脚本、通用下载脚本。
- `resources/data/agents-*.json`：预置助手清单。
- `resources/database/drizzle/*`：Drizzle 迁移 SQL 及 meta。

## 文档
- `docs/README.md`、`docs/en/*`、`docs/zh/*`、`docs/assets/images/*`：多语言开发指引、参考、流程图与 i18n 截图。

## 自动化脚本
- `scripts/*.js`、`scripts/*.ts`：构建前后钩子（`before-pack.js`、`after-pack.js`）、代码签名、版本生成、i18n 同步与校验、Cloudflare/Feishu 通知、排序与自定义扩展检查；`__tests__/sort.test.ts` 为脚本测试。

## 测试
- `tests/main.setup.ts`、`renderer.setup.ts`、`__mocks__/*`：Vitest 启动与依赖模拟。
- `tests/apis/*.http`：HTTP 接口示例。
- `tests/e2e/*`：Playwright 配置、fixtures（`electron.fixture.ts`）、页面对象（`pages/*.ts`）、规格（navigation、settings、chat 等）。

## packages 子仓
- `packages/shared`：跨进程/模块工具与配置（`IpcChannel.ts`、`utils.ts`、`config/*`）以及 `anthropic/`、`agents/claudecode/` 类型定义。
- `packages/ai-sdk-provider`：AI SDK provider 适配层（`src/index.ts`、`cherryin-provider.ts`），含 TS 配置与 README。
- `packages/aiCore`：核心 AI SDK 封装（`src/index.ts`、`types.ts`、测试 fixtures/mocks/helpers、`setupVitest.ts`、`AI_SDK_ARCHITECTURE.md`、`vitest.config.ts`）。
- `packages/extension-table-plus`：富文本表格扩展（`src/table/*`、`row/*`、`cell/*`、`header/*`、`kit`、`utilities/*`），附 README 与变更记录。
- `packages/mcp-trace`：追踪 SDK
  - `trace-core`: span 处理器（`processors/*`）、核心（`core/*`）、导出器（`exporters/*`）、类型定义。
  - `trace-web`: Web 侧 tracer（`index.ts`、`TopicContextManager.ts` 等）。
  - `trace-node`: Node 侧 tracer。

## 主进程（`src/main`）
- 入口与配置：`index.ts`（Electron 启动与窗口管理）、`bootstrap.ts`（初始化）、`config.ts`、`constant.ts`、`ipc.ts`（主渲染通信）、`electron.d.ts`、`env.d.ts`。
- API Server：`apiServer/server.ts`、`config.ts`、`services/*`（models/messages/mcp/chat-completion 等）、`utils/*`（流控制、MCP 工具）。
- 配置/集成：`configs/SelectionConfig.ts`；`integration/cherryai/*`、`integration/nutstore/*`。
- 知识与 MCP：`knowledge/*`（嵌入/预处理/reranker 管线）；`mcpServers/*`（内置 MCP server 适配器：filesystem、workflow、brave-search、didi、memory、python 等，`factory.ts` 统一注册）。
- 服务层：`services/*.ts` 为独立能力（更新、菜单、代理、窗口、托盘、主题、选择、搜索、OCR、WebDAV/S3/Obsidian/Nutstore/Redux 同步、ProtocolClient、PowerMonitor、WebSocket、版本、备份、代码工具、MCP、SpanCache、OvmsManager、MistralClientManager 等）。
  - `services/agents/*`：代理系统（Drizzle 配置、接口定义、插件、具体服务实现；`services/claudecode/*` 提供 ClaudeCode 工具链与测试）。
  - `services/memory/*`：记忆存取与查询。
  - `services/ocr/builtin/*`：Tesseract/System/Ov/Ppocr OCR 适配器基类与实现。
  - `services/remotefile/*`：远程文件服务（OpenAI/Mistral/Gemini 等）。
  - `services/urlschema/*`：自定义协议处理（MCP、Provider 安装）。
  - `services/__tests__/*`：服务层单测。
- 工具库：`utils/*`（文件/压缩/加解密、进程、系统信息、环境变量、Markdown 解析、OCR/MCP 适配、知识库助手、窗口与缩放工具），`__tests__` 覆盖 AES/文件/MCP/ZIP。

## 渲染进程（`src/renderer`）
- HTML 入口：`index.html`、`miniWindow.html`、`selectionAction.html`、`selectionToolbar.html`、`traceWindow.html`。
- 入口代码：`App.tsx`、`entryPoint.tsx`、`Router.tsx`、`init.ts`、`env.d.ts`。
- 主题与上下文：`context/*`（Theme、StyleSheet、Notification、MessageEditing、CodeStyle、Antd provider）。
- 资源与样式：`assets/styles/*.css`（全局、动画、Antd 覆盖、markdown、滚动条、选择工具栏、Tailwind 基础等），`assets` 目录承载静态资源。
- 国际化：`i18n/index.ts`、`label.ts`、`locales/*.json`、`translate/*.json` 与 README。
- 配置：`config/providers.ts`、`sidebar.ts`、`translate.ts`、`ocr.ts`、`webSearchProviders.ts`、`prompts.ts`、`preprocessProviders.ts`、`registry/messageMenubar.ts`；`config/models/*` 及其测试；`config/translate` 等。
- 数据库：`databases/index.ts`、`upgrades.ts`。
- API 封装：`api/agent.ts` 等。
- 队列与服务：`queue/*`、`services/*`（与渲染层逻辑相关的状态、请求、处理）。
- Hooks/工具：`hooks/*`、`utils/*`、`types/*`、`tools/*`（前端工具条/通用方法）。
- Workers：`workers/pyodide.worker.ts`、`shiki-stream.worker.ts`。
- Trace：`trace/*`（与 mcp-trace 集成）。
- Providers：`providers/*`（前端 provider 管理）。
- 窗口：`windows/selection/*`（选择工具栏入口与组件）。

### 渲染侧核心 AI 层（`src/renderer/src/aiCore`）
- `provider/*`：模型提供方配置、初始化、常量，含单测。
- `middleware/*`：推理/工具选择/Gemini/Qwen/OpenRouter 等中间件。
- `utils/*`：推理、图像、MCP、选项、websearch 工具及测试。
- `legacy/*`：旧版客户端与中间件栈（OpenAI/Anthropic/Gemini/AwsBedrock 等 clients，middleware 组合与规格文档）。
- `trace/*`：AI SDK 与 trace 的适配器及测试。

### 通用组件（`src/renderer/src/components`）
- 顶层组件：`CodeViewer.tsx`、`ContentSearch.tsx`、`CollapsibleSearchBar.tsx`、`DynamicImageForm.tsx`、`ImageViewer.tsx`、`ModelSelector.tsx`、`ThinkingEffect.tsx`、`TranslateButton.tsx`、`Backup/Export` 相关（Obsidian/S3/WebDAV/Nutstore）、`LocalBackupManager.tsx` 等。
- 子目录：ActionTools、Alert、Avatar、Buttons、CodeBlockView、CodeEditor/Toolbar、ContextMenu、DND、DraggableList、EditableNumber、EmojiPicker、HealthStatusIndicator、Icons、Layout、ListItem、MarkdownEditor、MinApp、OAuth、Popups、Preview、ProviderLogoPicker、QuickPanel、RichEditor、Scrollbar、Tab、Tags、TooltipIcons、TopView、VirtualList、WindowControls、`__tests__`（对应组件的单测）。

### 页面（`src/renderer/src/pages`）
- `home/`：聊天主界面。包括
  - `Inputbar/*`（核心输入框、附件/提及/工具按钮组件与 hooks、工具注册器、Token 显示等；`tools/*.tsx` 各类工具按钮，`tools/components/*.tsx` 对应弹窗与按钮）。
  - `Messages/Blocks/*`（思维/错误/图片/视频/工具/引用等消息块，含测试与快照）。
  - `Markdown/*`（渲染器与插件、表格、链接，及测试）。
  - `Messages/Tools/MessageAgentTools/*`：聊天工具结果渲染器。
- `settings/`：设置中心。模块包括
  - ProviderSettings（各云/本地模型配置、模型列表/编辑弹窗、OAuth、GPU/Bedrock/OVMS/LMStudio 等），
  - AgentSettings（代理描述、模型、提示、工具、插件、头像、目录权限等），
  - AssistantSettings、MemorySettings、SelectionAssistantSettings（组件/弹窗/钩子），
  - ToolSettings（ApiServerSettings），
  - ModelSettings、DataSettings（导入导出/Notion/Joplin/备份）、DocProcessSettings（OCR/预处理各 provider 配置）、About/Shortcut/QuickPhrase/QuickAssistant 等。
  - MCPSettings（MCP server/工具/资源列表、内置 server 列表、安装指引等）。
- `workflow/`：工作流编排。包括
  - `components/Canvas/*`（React Flow 画布、边样式、数据边定义、样式 CSS）。
  - `components/Nodes/*`（AI/Text/Image/Video/Output/Turbo/CherryWorkflow/DynamicHandles 等节点组件与动画/样式）。
  - `components/Panels/*`（配置/节点/折叠面板，含备份文件）。
  - `components/ConfigForms/*`（工作流节点配置表单、主题样式 `FormTheme.css`）。
  - 样式与主题：`styles/themes.ts`、`styles/*.css`。
  - 服务层：`services/WorkflowStorage.ts`、`WorkflowResultStorage.ts`。
  - 页面入口：`WorkflowCanvas.tsx` 等。
- `paintings/`：绘画/图像生成，包含多 provider 页面（Aihubmix/Zhipu/OVMS/Dmxapi/NewApi/TokenFlux/Silicon）、路由入口、组件（Sidebar/Canvas/Artboard/ImageUploader/ProviderSelect 等）、配置（`config/*.ts(x)`）和工具。
- `store/assistants/presets/*`：助手模板商店页面与组件。
- `knowledge/`：知识库页面与测试/快照。
- `launchpad`、`memory`、`notes`、`files`、`history`、`translate`、`code`、`minapps` 等：对应功能页组件与逻辑。

### 其他前端目录
- `api/`、`handler/`、`providers/`、`services/`、`queue/`：渲染层接口、事件处理、provider 封装、业务服务与队列实现。
- `store/`：全局状态管理。
- `windows/selection/*`：选择工具栏窗口入口及组件。
- `workers/*`：前端 worker（Pyodide、Shiki 流式渲染）。

## 预加载与主线程桥接
- `src/preload/index.ts`、`preload.d.ts`：预加载脚本暴露安全 API 给渲染层。

## 打包/资源清单
- `build/*.png|ico|icns` 与 `build/icons/*`：应用图标。
- `resources/scripts/*`、`resources/data/*`、`resources/database/*`：安装脚本、预置数据、数据库迁移。

## 备注
- 本文件以目录和文件名语义描述作用；大量同构组件（如设置页下的众多 `*.tsx` 表单、`*.test.tsx`/`*.snap`）遵循同一职责模式，未重复展开但已按目录标注用途。若需深入某个子目录，可按名称快速定位。
