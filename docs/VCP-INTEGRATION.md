# VCP 插件系统集成指南

本文档介绍 Cherry Studio 中集成的 VCP (Virtual Context Protocol) 插件系统，该系统基于 VCPToolBox 项目适配实现，支持 VCP 和 MCP 双协议。

## 概述

VCP 插件系统是 Cherry Studio 的"元协议"平台核心，实现了：
- **VCP 协议**：支持 6 种插件类型
- **MCP 协议**：完全兼容现有 MCP 工具
- **双向转换**：VCP ↔ MCP 协议互转
- **Canvas 协同编辑**：实时文件编辑与同步

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                  Cherry Studio                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Unified Plugin Manager                │   │
│  │  ┌───────────────┐    ┌───────────────┐         │   │
│  │  │  VCP Engine   │◄──►│  MCP Engine   │         │   │
│  │  │ (VCPToolBox)  │    │ (现有实现)     │         │   │
│  │  └───────┬───────┘    └───────┬───────┘         │   │
│  │          │                    │                  │   │
│  │  ┌───────▼───────┐    ┌───────▼───────┐         │   │
│  │  │ MCPO Bridge   │◄──►│ VCP Adapter   │         │   │
│  │  │ (MCP→VCP)     │    │ (VCP→MCP)     │         │   │
│  │  └───────────────┘    └───────────────┘         │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌───────────────────────▼───────────────────────┐     │
│  │              Plugin Registry                   │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │     │
│  │  │VCP插件  │ │MCP插件  │ │混合插件 │         │     │
│  │  │(内置+   │ │(现有)   │ │(双协议) │         │     │
│  │  │下载)    │ │         │ │         │         │     │
│  │  └─────────┘ └─────────┘ └─────────┘         │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## VCP 插件类型

| 类型 | 说明 | 用例 |
|------|------|------|
| `static` | 定时执行，更新占位符 | 当前时间、天气、系统状态 |
| `synchronous` | 同步执行，等待结果 | 搜索、计算、文件操作 |
| `asynchronous` | 异步执行，返回 taskId | 图片生成、视频处理 |
| `messagePreprocessor` | 消息预处理器 | 翻译、格式化、敏感词过滤 |
| `service` | HTTP 路由服务 | API 端点、Webhook |
| `hybridservice` | 混合服务 | 同时支持调用和端点 |

## VCP 协议格式

### 工具请求格式

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」plugin_name「末」
param1:「始」value1「末」
param2:「始」value2「末」
<<<[END_TOOL_REQUEST]>>>
```

### 工具结果格式

```
<<<[TOOL_RESULT]>>>
{
  "success": true,
  "output": "结果内容",
  "data": {}
}
<<<[/TOOL_RESULT]>>>
```

## 文件结构

```
src/main/knowledge/vcp/
├── index.ts                 # 模块导出
├── types.ts                 # 类型定义
├── PluginManager.ts         # 插件管理器
├── MCPOBridge.ts            # MCP→VCP 桥接
├── VCPAdapter.ts            # VCP→MCP 适配
└── UnifiedPluginManager.ts  # 统一管理器

~/.cherry-studio/
└── plugins/
    ├── registry.json        # 已安装插件列表
    ├── builtin/             # 内置插件
    └── downloaded/          # 下载的插件
```

## IPC 通道

### 插件管理

| 通道 | 说明 |
|------|------|
| `vcp:plugin:initialize` | 初始化插件管理器 |
| `vcp:plugin:list` | 获取所有插件列表 |
| `vcp:plugin:get` | 获取单个插件信息 |
| `vcp:plugin:enable` | 启用插件 |
| `vcp:plugin:disable` | 禁用插件 |
| `vcp:plugin:reload` | 重新加载插件 |
| `vcp:plugin:getPlaceholders` | 获取静态插件占位符 |

### 工具执行

| 通道 | 说明 |
|------|------|
| `vcp:tool:execute` | 同步执行工具 |
| `vcp:tool:executeAsync` | 异步执行工具 |
| `vcp:tool:getTaskStatus` | 获取异步任务状态 |
| `vcp:tool:getTaskResult` | 获取异步任务结果 |
| `vcp:tool:listDefinitions` | 获取工具定义列表 |

### 统一管理

| 通道 | 说明 |
|------|------|
| `vcp:unified:initialize` | 初始化统一管理器 |
| `vcp:unified:getAllPlugins` | 获取所有插件（统一视图）|
| `vcp:unified:getPluginsByProtocol` | 按协议获取插件 |
| `vcp:unified:executeTool` | 执行工具（自动路由）|
| `vcp:unified:getToolDefinitions` | 获取所有工具定义 |

### 分布式服务

| 通道 | 说明 |
|------|------|
| `vcp:distributed:register` | 注册分布式工具 |
| `vcp:distributed:unregister` | 注销分布式工具 |
| `vcp:distributed:getServers` | 获取服务器列表 |
| `vcp:distributed:getServerTools` | 获取服务器工具 |

## 使用示例

### 在 Renderer 中调用插件

```typescript
// 初始化插件系统
await window.api.invoke('vcp:unified:initialize')

// 获取所有插件
const { data: plugins } = await window.api.invoke('vcp:unified:getAllPlugins')

// 执行工具
const result = await window.api.invoke('vcp:unified:executeTool', {
  name: 'web_search',
  arguments: {
    query: '搜索内容'
  }
})
```

### 创建 VCP 插件

1. 在 `~/.cherry-studio/plugins/downloaded/` 创建插件目录
2. 创建 `manifest.json`:

```json
{
  "name": "my_plugin",
  "displayName": "我的插件",
  "description": "插件描述",
  "version": "1.0.0",
  "pluginType": "synchronous",
  "params": [
    {
      "name": "input",
      "description": "输入参数",
      "type": "string",
      "required": true
    }
  ],
  "entryPoint": {
    "type": "script",
    "script": "index.js"
  }
}
```

3. 创建 `index.js`:

```javascript
module.exports = {
  execute: async (params) => {
    const { input } = params
    // 处理逻辑
    return {
      success: true,
      output: `处理结果: ${input}`
    }
  }
}
```

## WebSocket 消息类型

VCP 系统扩展了以下 WebSocket 消息类型用于分布式通信：

### 分布式服务器消息
- `distributed_register` - 注册分布式服务器
- `distributed_unregister` - 注销分布式服务器
- `distributed_tool_list` - 工具列表同步
- `distributed_tool_call` - 远程工具调用
- `distributed_tool_result` - 工具执行结果
- `distributed_heartbeat` - 心跳检测

### 插件管理消息
- `plugin_registered` - 插件已注册
- `plugin_unregistered` - 插件已注销
- `plugin_enabled` - 插件已启用
- `plugin_disabled` - 插件已禁用
- `plugins_reloaded` - 插件已重载

## 协议转换

### MCPO Bridge (MCP → VCP)

将 MCP 工具调用转换为 VCP 格式：

```typescript
// MCP 格式
{
  name: "tool_name",
  arguments: { param1: "value1" }
}

// 转换为 VCP 格式
<<<[TOOL_REQUEST]>>>
tool_name:「始」tool_name「末」
param1:「始」value1「末」
<<<[END_TOOL_REQUEST]>>>
```

### VCP Adapter (VCP → MCP)

将 VCP 插件暴露为 MCP 工具：

```typescript
// VCP 插件定义
{
  name: "my_plugin",
  params: [{ name: "input", type: "string" }]
}

// 转换为 MCP 工具定义
{
  name: "my_plugin",
  description: "...",
  inputSchema: {
    type: "object",
    properties: {
      input: { type: "string" }
    }
  }
}
```

## 开发注意事项

1. **插件路径**：内置插件放在 `builtin/`，用户下载的放在 `downloaded/`
2. **热重载**：支持 chokidar 文件监控，修改插件后自动重载
3. **异步任务**：使用 `taskId` 追踪异步执行状态
4. **分布式**：通过 WebSocket 连接远程 VCP 节点执行插件

## 许可证

VCPToolBox 使用 CC BY-NC-SA 4.0 许可证，在发布时需标注来源。

## 相关链接

- [VCPToolBox 项目](https://github.com/example/VCPToolBox)
- [MCP 协议规范](https://modelcontextprotocol.io/)

---

# Canvas 协同编辑模块

Canvas 是 Cherry Studio 集成的实时协同编辑模块，基于 VCPChat 的 Canvas 功能移植实现。

## 功能特性

- **多语言支持**：JavaScript、TypeScript、Python、Markdown、HTML、CSS、JSON 等 25+ 种语言
- **实时编辑**：基于 CodeMirror 6 的现代化编辑器
- **版本控制**：自动保存版本快照，支持历史回溯
- **文件监控**：chokidar 监控外部文件变更
- **自动保存**：可配置的自动保存间隔

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Canvas Module                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              CanvasPage (React)                  │    │
│  │  ┌───────────────┐    ┌───────────────┐         │    │
│  │  │  File List    │    │ CanvasEditor  │         │    │
│  │  │  (Sidebar)    │    │ (CodeMirror)  │         │    │
│  │  └───────────────┘    └───────────────┘         │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                     IPC Channels                         │
│                          │                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │            CanvasService (Main)                  │    │
│  │  ┌───────────────┐    ┌───────────────┐         │    │
│  │  │ File Manager  │    │ Version Ctrl  │         │    │
│  │  └───────────────┘    └───────────────┘         │    │
│  │  ┌───────────────┐    ┌───────────────┐         │    │
│  │  │ File Watcher  │    │ WebSocket Sync│         │    │
│  │  │ (chokidar)    │    │               │         │    │
│  │  └───────────────┘    └───────────────┘         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 文件结构

```
src/renderer/src/pages/canvas/
├── CanvasPage.tsx       # 主页面组件
├── CanvasEditor.tsx     # CodeMirror 编辑器
└── types.ts             # 类型定义

src/main/services/
├── CanvasService.ts     # 文件管理服务
└── CanvasIpcHandler.ts  # IPC 处理器
```

## IPC 通道

### 文件管理

| 通道 | 说明 |
|------|------|
| `canvas:getHistory` | 获取文件历史记录 |
| `canvas:loadFile` | 加载文件内容 |
| `canvas:saveFile` | 保存文件 |
| `canvas:createFile` | 创建新文件 |
| `canvas:deleteFile` | 删除文件 |
| `canvas:renameFile` | 重命名文件 |
| `canvas:listFiles` | 列出所有文件 |

### 版本控制

| 通道 | 说明 |
|------|------|
| `canvas:getVersions` | 获取版本列表 |
| `canvas:restoreVersion` | 恢复到指定版本 |
| `canvas:createSnapshot` | 创建版本快照 |

### 实时同步

| 通道 | 说明 |
|------|------|
| `canvas:startSync` | 启动文件监控 |
| `canvas:stopSync` | 停止文件监控 |
| `canvas:getSyncState` | 获取同步状态 |
| `canvas:externalChange` | 外部文件变更事件 |

## 使用示例

### 访问 Canvas 页面

Canvas 页面位于 `/canvas` 路由，可以通过侧边栏导航访问。

### 在 Renderer 中调用 Canvas API

```typescript
// 获取历史记录
const { data: files } = await window.api.invoke('canvas:getHistory')

// 加载文件
const { data: file } = await window.api.invoke('canvas:loadFile', '/path/to/file.js')

// 保存文件
await window.api.invoke('canvas:saveFile', {
  path: '/path/to/file.js',
  content: 'console.log("Hello")',
  createVersion: true
})

// 创建新文件
const { data: newFile } = await window.api.invoke('canvas:createFile', 'script.js')
```

### 监听外部文件变更

```typescript
// 在 React 组件中
useEffect(() => {
  const handleExternalChange = (_, data: { filePath: string; content: string }) => {
    console.log('File changed externally:', data.filePath)
    // 更新编辑器内容
  }

  window.api.on('canvas:externalChange', handleExternalChange)

  return () => {
    window.api.off('canvas:externalChange', handleExternalChange)
  }
}, [])
```

## 支持的文件类型

| 扩展名 | 语言 |
|--------|------|
| `.js`, `.jsx` | JavaScript |
| `.ts`, `.tsx` | TypeScript |
| `.py` | Python |
| `.md` | Markdown |
| `.html` | HTML |
| `.css`, `.scss` | CSS |
| `.json` | JSON |
| `.yaml`, `.yml` | YAML |
| `.xml` | XML |
| `.sql` | SQL |
| `.go` | Go |
| `.rs` | Rust |
| `.java` | Java |
| `.c`, `.cpp`, `.h` | C/C++ |
| `.vue` | Vue |
| `.svelte` | Svelte |
| `.sh`, `.bash` | Shell |
| `.txt` | Plain Text |

## 配置选项

编辑器支持以下配置：

```typescript
interface CanvasEditorConfig {
  theme: 'light' | 'dark'
  fontSize: number
  tabSize: number
  lineNumbers: boolean
  wordWrap: boolean
  autoSave: boolean
  autoSaveInterval: number // 毫秒
}
```

## WebSocket 消息类型

Canvas 模块使用以下 WebSocket 消息类型进行实时同步：

- `canvas_sync` - 全量同步
- `canvas_update` - 增量更新
- `canvas_cursor` - 光标位置
- `canvas_selection` - 选区同步

## 数据存储

Canvas 文件存储在用户数据目录下：

```
~/.cherry-studio/
└── canvas/
    ├── .history.json     # 历史记录
    ├── .versions/        # 版本快照
    └── *.js, *.py, ...   # 用户文件
```
