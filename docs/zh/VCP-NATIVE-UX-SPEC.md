# VCP 原生 UX 融合规范（深度规格）

本文档定义 VCP 高级能力在 Cherry Studio UI 层的完整融合规范，目标是让用户感知为“原生能力”，体验对齐 VCPChat。

## 1. 目标
- 群聊、记忆、工具、工作流、FlowLock 等入口统一
- 工具执行与日记渲染具备 VCP 视觉语言
- 多模态渲染与 VCPChat 接近（图片/音频/视频/HTML/Mermaid）

## 2. 消息渲染总则

### 2.1 工具调用气泡（ToolUse）
- 识别 `<<<[TOOL_REQUEST]>>> ... <<<[END_TOOL_REQUEST]>>>`
- 提取 `tool_name:「始」...「末」` 作为展示名
- 输出 `vcp-tool-use-bubble`，默认展示摘要，内部含 `<pre>` 完整指令

### 2.2 工具结果气泡（ToolResult）
- 识别 `[[VCP调用结果信息汇总:...VCP调用结果结束]]`
- 按 `- key: value` 解析内容
- 生成 `vcp-tool-result-bubble collapsible`：
  - Header: tool 名 + 状态
  - Body: key/value 列表
  - Footer: 额外文本
- 图片 URL 自动转为预览图 + 点击放大

### 2.3 日记气泡（DailyNote）
- 识别 `<<<DailyNoteStart>>>...<<<DailyNoteEnd>>>`
- 或识别 DailyNote tool create 指令
- 渲染 `maid-diary-bubble`，展示 Maid/Date/Content

### 2.4 Canvas 占位符
- `{{VCPChatCanvas}}` → `vcp-chat-canvas-placeholder`（显示协同中提示）

### 2.5 交互标记
- `[[点击按钮:xxx]]` 渲染为用户点击气泡

### 2.6 渲染增强开关
- `enableAgentBubbleTheme`: 注入 `{{VarDivRender}}` 以启用个性气泡主题
- `enableContextSanitizer`: HTML → Markdown 净化（按 depth 跳过最近 N 条 AI）

### 2.7 表情占位符
- `{{EmojiList}}` 渲染为表情候选列表（与 VCPChat 行为一致）

## 3. 群聊 UI 规范

### 3.1 群组配置结构
- `id`, `name`, `avatar`, `avatarCalculatedColor`
- `members`: AgentId[]
- `mode`: `sequential | naturerandom | invite_only`
- `memberTags`: `{ [agentId]: "tag1,tag2" }`
- `groupPrompt`, `invitePrompt`
- `useUnifiedModel`, `unifiedModel`
- `topics`: `{ id, name, createdAt }[]`

### 3.2 存储路径
- 配置：`<APP_DATA_ROOT>/AgentGroups/<groupId>/config.json`
- 历史：`<USER_DATA>/<groupId>/topics/<topicId>/history.json`

### 3.3 发言标记
格式：
```
[发言者的发言]: 内容
```
规则：用户与 Agent 不需要自己输出，系统统一注入。

### 3.4 发言模式细则
- `sequential`：按成员顺序逐个发言
- `naturerandom`：
  - 触发优先级：@角色名 → @Tag/关键词 → @所有人 → 概率发言 → 保底发言
  - 上下文窗口默认 8 条
  - tag 命中提高发言概率（0.85）
- `invite_only`：仅通过“邀请按钮”触发

### 3.5 GroupPrompt / InvitePrompt
- `invitePrompt` 支持 `{{VCPChatAgentName}}`
- `groupPrompt` 支持：
  - `{{VCPChatGroupSessionWatcher}}`（注入会话 JSON）
  - `{{VCPChatCanvas}}`（在最后一条用户消息中注入 canvas 内容）

### 3.6 群聊消息与附件
- 用户消息历史保存原始文本
- 对 AI 发送时附加文件内容：
  - 文本文件追加到内容
  - 非文本文件提示“无法预览”
  - 图片/音频/视频生成 `image_url`（仅首帧）

### 3.7 流式事件规范
- 通道：`vcp-stream-event` / `agent:stream`
- 事件类型：`agent_thinking`, `agent:stream`, `agent:speak`, `error`
- `agent_thinking` → 创建思考气泡/状态指示
- `agent:stream` → 流式输出更新（携带 `messageId`, `chunk`, `accumulatedContent`）
- `agent:speak` → 完成并落盘 history（使用相同 `messageId` 关联流式消息）
- 兼容映射：`start`/`data`/`end` 事件映射为 `agent_thinking`/`agent:stream`/`agent:speak`

#### 3.7.1 流式消息实现细节
- **状态管理**：使用 `useRef` 分离流式状态，避免 React 状态批量更新导致的渲染问题
- **消息关联**：预生成 `messageId`，流式更新与最终消息使用相同 ID
- **重渲染触发**：使用 `streamingTrigger` 状态强制 UI 更新
- **清理逻辑**：`agent:speak` 到达时清除 `streamingMessageRef`

### 3.8 话题自动总结
- 满足最小消息数后触发
- 仅当话题为默认标题（如“主要群聊”）时更新
- 结果清洗：去标点、限长

### 3.9 群聊设置 UI
- 群组名称/头像
- 成员选择与 tag 输入
- 模式选择 + unified model 开关
- groupPrompt / invitePrompt 文本域
- 话题管理：创建/重命名/删除/导出 Markdown

### 3.10 邀请按钮 UI
- invite-only 模式显示成员按钮（头像+名称）
- 点击触发 `inviteAgentToSpeak`

### 3.11 中断与重试
- `interruptGroupRequest`：中断当前群聊流式输出并停止后续 agent 调用
- `redoGroupChatMessage`：重放上一轮消息（保持相同 topic 与上下文）
- UI 入口：消息项「重试」+ 群聊栏「停止」按钮

## 4. 记忆与日记 UI（Memo）

### 4.1 布局
- 左侧文件夹列表 + 拖拽排序
- 中央卡片网格（preview + lastModified）
- 右侧编辑器（Markdown + KaTeX）

### 4.2 交互
- 搜索范围切换（文件夹/全局）
- 隐藏文件夹与隐藏管理
- 批量模式（删除/移动）
- 编辑器右键菜单（撤销/剪切/复制/粘贴）

### 4.3 写入动作
- “新建日记”调用 DailyNote tool
- 保存走 Admin API

## 5. FlowLock UI
- 标题发光 + 随机旋转动效
- 添加“播放”emoji 指示
- 支持 AI 与用户双向控制
- 重试策略提示（失败自动停止）

## 6. RAG Observer UI
- 独立窗口订阅 VCPLog WebSocket
- 展示检索细节与元思考链
- 支持主题同步（light/dark）
- 连接地址：`${vcpLogUrl}/vcpinfo/VCP_Key=${vcpLogKey}`

## 7. Assistant 窗口
- 选中文本唤起助手窗口
- 预设动作（翻译/总结/解释/搜索等）
- 独立消息流但复用同一渲染器

## 8. 管理与配置 UI
- 插件中心：启停、版本、描述、配置编辑
- 预处理器顺序拖拽（messagePreprocessor）
- 高级变量编辑器（TVStxt / Tar/Var/Sar）
- RAG Tags / 语义组管理面板
- VCPLog 订阅与日志查看
- 统一工作台（调用链/日志/异步任务可视化与筛选）
- Agent 正则规则编辑（历史/渲染/深度/content 数组）
- 主题选择与主题生成器入口
- VchatCLI 终端入口（含授权执行流程）

## 9. 多模态体验
- 图片/音频/视频气泡内直接播放
- Base64 内容可被模型“看到”
- 渲染器支持 HTML/Mermaid/KaTeX/Three.js 等

## 10. VCPChat 特性对齐清单（参考 `external/VCPChat/README.md`）
- 统一工作台：调用链路/日志/异步任务统一可视化，支持筛选与追踪
- 工具调用 UX：可展开气泡 + 任务完成回流 + 系统级通知
- 多 Agent 群体协作：清晰发言标记、邀请/自然随机/顺序模式、Agent 可委派任务
- VCPFileAPI/Base64 直通：工具返回 Base64 可直接渲染与传递
- 上下文管理兼容（SillyTavern）：Preset/Character Card/World Book、注入规则可视化与拖拽排序
- Agent 管理强化：话题导出/重命名/排序
- 群聊增强：中断/重试、话题自动总结
- 语音相关：语音聊天 + TTS + 多语音模型配置
- 多媒体交互：表情/音频/视频/HTML/Mermaid 等渲染与动效
- ComfyGen/图像工作流管理面板

## 11. 验收标准
- 群聊体验与 VCPChat 对齐（模式/提示/事件/按钮）
- ToolUse/ToolResult/Diary 气泡视觉一致
- Memo UI 支持搜索、编辑、批量操作
- FlowLock 与 RAG Observer 可用
