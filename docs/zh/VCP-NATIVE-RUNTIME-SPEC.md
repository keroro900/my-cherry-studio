# VCP 原生运行时规范（深度规格）

本文档定义 Cherry Studio 内建 VCP 运行时（VCPRuntime）与插件执行体系的完整规格。目标是完全替代 `external/VCPToolBox` 运行时，同时保持与 VCPToolBox 生态的协议与清单兼容。

## 1. 目标与范围
- 兼容 VCPToolBox 插件清单、TOOL_REQUEST 语法、异步占位符机制。
- 支持 WebSocket 推送、分布式插件、FileAPI 超栈追踪、特殊模型穿透与任务调度。
- 统一 VCP/MCP/Native 工具执行入口，并可与 Cherry Studio Provider 体系协作。

## 2. 架构概览

```
Renderer (vcpContextPlugin)
  → window.api.vcpUnified.executeTool
Main
  → UnifiedPluginManager
    → VCPRuntime
      → PluginRegistry
      → PluginExecutor
      → PreprocessorChain
      → AsyncTaskManager
      → PlaceholderEngine
      → VCPFileAPI
      → WebSocketHub
      → DistributedRouter
```

## 3. 插件清单规范（plugin-manifest.json）

### 3.1 核心字段
- `name`: 唯一标识（工具名）
- `displayName`: UI 显示名称
- `version`: 插件版本
- `description`: 插件简介
- `pluginType`: `static | messagePreprocessor | synchronous | asynchronous | service | hybridservice`
- `entryPoint.command`: stdio 插件执行入口（如 `python script.py`）
- `communication.protocol`: `stdio` 或 `direct`

### 3.2 配置蓝图（configSchema）
- 描述插件配置项的结构与默认值
- 运行时合并全局配置与插件私有 `.env` 后注入插件

### 3.3 能力声明（capabilities）
- `systemPromptPlaceholders`: static 插件占位符数组
- `invocationCommands`: 用于 AI 指令描述的命令数组（关键）

`invocationCommands` 建议字段：
- `command`: 内部命令名（如 `submit`）
- `description`: 给 AI 的能力说明（含参数与示例）
- `example`: 可选示例

### 3.4 WebSocket 推送配置（webSocketPush）
用于异步回调或同步结果推送到前端：
- `enabled`: boolean
- `usePluginResultAsMessage`: boolean
- `messageType`: string（当不直接用 result 作为消息时）
- `targetClientType`: string|null（消息订阅过滤）

### 3.5 分布式字段
- `isDistributed`: boolean
- `serverId`: string（由 DistributedRouter 注入）

### 3.6 示例（缩略）
```
{
  "name": "SciCalculator",
  "displayName": "科学计算器",
  "pluginType": "synchronous",
  "entryPoint": { "command": "python script.py" },
  "communication": { "protocol": "stdio" },
  "capabilities": {
    "invocationCommands": [
      {
        "command": "eval",
        "description": "输入表达式并返回计算结果",
        "example": "<<<[TOOL_REQUEST]>>>\ntool_name:「始」SciCalculator「末」, expression:「始」1+2「末」\n<<<[END_TOOL_REQUEST]>>>"
      }
    ]
  },
  "webSocketPush": {
    "enabled": false
  }
}
```

### 3.7 运行时插件管理器能力
- `staticPlaceholderValues`: 静态占位符缓存
- `messagePreprocessors`: 预处理器注册表
- `serviceModules`: service/hybridservice 模块
- `scheduledJobs`: 定时任务与周期任务

## 4. 插件执行协议

### 4.1 stdio（synchronous）
- 入参：运行时将参数序列化为 JSON 写入 stdin
- 出参：插件必须输出 JSON，格式：
```
{
  "status": "success" | "error",
  "result": "string" | { ... },
  "error": "string",
  "messageForAI": "string",
  "base64": "string"
}
```
- `result` 可为对象，若 `webSocketPush.usePluginResultAsMessage` 为 true，直接作为 WS 消息体

### 4.2 stdio（asynchronous）
- **初始响应**：插件必须立即输出 JSON（含 `requestId` 与 `messageForAI`）
- **后台执行**：插件自行处理长耗时任务
- **回调**：向 `/plugin-callback/:pluginName/:taskId` POST JSON

回调 JSON 示例：
```
{
  "requestId": "unique_task_id_123",
  "status": "Succeed",
  "pluginName": "MyAsyncPlugin",
  "message": "任务完成提示",
  "videoUrl": "http://example.com/video.mp4"
}
```

### 4.3 messagePreprocessor
- 执行于模型调用前，链式处理消息数组
- 支持拖拽调整顺序（与 AdminPanel 兼容）

### 4.4 service / hybridservice
- `service`：注册独立 HTTP 路由
- `hybridservice`：兼具预处理与服务接口（如 VCPTavern）

### 4.5 消息预处理管线顺序（对齐 VCPToolBox）
- 1) VCPTavern：注入 Preset/WorldBook/Character（system/user/hidden）
- 2) 变量替换：`{{Date}}` / `{{agent:*}}` / `{{VCP_*}}` / `{{EmojiList}}`
- 3) 多模态预处理：图片/音频/视频 → `image_url`/Base64
- 4) RAG 检索与注入：KnowledgeService/UnifiedMemoryManager
- 5) 其他 messagePreprocessor：按 `preprocessorOrder` 顺序执行

### 4.6 VCP 工具调用循环
```
while depth < maxRecursion:
  call model(messages)
  if no TOOL_REQUEST: break
  parse TOOL_REQUEST → VCPRuntime.executeTool
  append TOOL_RESULT/ERROR (+base64) to messages
  if async: insert {{VCP_ASYNC_RESULT::Plugin::TaskId}}
  depth++
```
- 结果中的 `base64` 统一经 VCPFileAPI 渲染/回传
- 每次调用写入 VCPLog，并绑定 `traceId/taskId`

## 5. 异步闭环与占位符
- 结果文件路径：`VCPAsyncResults/{pluginName}-{taskId}.json`
- 占位符：`{{VCP_ASYNC_RESULT::PluginName::TaskId}}`
- 替换逻辑：结果存在即替换；不存在显示“待更新”提示
- 并行推送：若配置 `webSocketPush`，回调结果将同步推送到前端

## 6. WebSocketHub（统一推送）
- 统一承载 VCPLog / AgentMessage / 异步回调消息
- 通过 `clientType` 过滤定向广播
- 支持订阅类型示例：`VCPLog`, `AgentMessage`, `RAGObserver`

## 6.1 群聊流式事件（GroupChatEvent）
- 事件类型：
  - `agent:thinking` — Agent 开始思考
  - `agent:stream` — 流式输出更新（携带 `messageId`, `chunk`, `accumulatedContent`）
  - `agent:speak` — 消息完成（携带完整 `message` 对象，使用相同 `messageId`）
  - `chat:start` / `chat:end` — 群聊会话开始/结束
  - `agent:join` / `agent:leave` — Agent 加入/离开
- 消息关联：预生成 `messageId`，流式更新与最终消息使用相同 ID
- 状态管理：使用 `useRef` 分离流式状态，避免 React 状态批量更新问题

## 7. 分布式执行（DistributedRouter）
- 分布式节点通过 WebSocket 发送 `register_tools`
- 主服务器标记 `isDistributed: true` 并记录 `serverId`
- 调用时使用 `execute_tool` 消息转发至节点
- 节点回传结果后唤醒挂起请求

## 8. VCPFileAPI v4.0（超栈追踪）
- 文件路径可来自任意分布式节点
- 主服务器优先本地读取，否则通过 `FileFetcherServer` 走 WS 拉取
- 内部协议：`internal_request_file` → Base64 返回
- 调用透明化：自动将 `file://` 参数替换为 DataURI 重试

## 9. 特殊模型穿透（SpecialModelRouter）
- `WhitelistImageModel`: 图像模型绕过标准链路，必要时注入 `generationConfig`
- `WhitelistEmbeddingModel`: 向量模型请求/响应原样转发
- 白名单命中时跳过预处理与工具循环

## 10. 任务调度
- 接口：`/v1/schedule_task`
- 支持延迟触发与循环任务
- 任务内可封装任意 TOOL_REQUEST 指令

## 11. 变量与提示词引擎（PlaceholderEngine）
- `{{Agent*}}`: 角色模板基座
- `{{Tar*}}`: 最高优先级模板组合
- `{{Var*}}`: 全局替换变量
- `{{Sar*}}`: 模型条件注入（SarModelX/SarPromptX）
- `.txt` 外部变量：从 `TVStxt/` 加载
- 支持缓存与文件变更刷新（避免重复读取）
- `{{VCPAllTools}}` / `{{VCPToolName}}`：自动生成工具描述
- `{{ShowBase64}}`: 跳过图像预处理

## 12. MCP 兼容（MCPO）
- 通过 MCPO 插件将 MCP 调用格式实时转换为 VCP 指令
- MCP 插件无需修改即可挂载到 VCP Runtime

## 13. 可观测性与日志
- `VCPLogService` 记录工具调用链
- WebSocket 实时推送日志与系统事件
- 分布式调用必须携带 traceId 与 serverId

## 14. 验收标准
- stdio 同步插件可执行并返回 JSON
- 异步插件占位符闭环可用
- WebSocketPush 消息可投递
- 分布式工具注册与调用可用
- WhitelistModel 路由有效
- 变量替换与 Tar/Var/Sar 生效
