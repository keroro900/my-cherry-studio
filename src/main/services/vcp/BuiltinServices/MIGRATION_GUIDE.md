# VCP 插件迁移指南 - 转换为 BuiltinService

本文档指导如何将 VCPToolBox 插件转换为 Cherry Studio 原生 BuiltinService。

## 一、概述

### 1.1 什么是 BuiltinService

BuiltinService 是 Cherry Studio 的原生 TypeScript 服务实现，替代外部 Node.js/Python 插件进程，直接在 Electron 主进程中运行。

**优势：**
- 无需启动子进程，性能更好
- TypeScript 类型安全
- 与 Cherry Studio 深度集成
- 统一的日志和错误处理

### 1.2 文件位置

```
cherry-studio/src/main/services/vcp/BuiltinServices/
├── index.ts                    # 注册表和类型定义
├── YourNewService.ts           # 新服务文件
└── ...其他服务
```

## 二、迁移步骤

### 步骤 1: 分析原始插件

读取 VCPToolBox 插件的以下文件：
- `plugin-manifest.json` - 插件元数据和命令定义
- `*.js` 或 `*.mjs` - 实现代码
- `config.env` - 配置项

**关键信息提取：**
```json
// plugin-manifest.json 示例
{
  "name": "PluginName",
  "displayName": "插件显示名",
  "description": "插件描述",
  "pluginType": "synchronous",
  "configSchema": {
    "API_KEY": "string",
    "TIMEOUT": "integer"
  },
  "capabilities": {
    "invocationCommands": [
      {
        "commandIdentifier": "CommandName",
        "description": "命令描述...",
        "example": "<<<[TOOL_REQUEST]>>>..."
      }
    ]
  }
}
```

### 步骤 2: 创建 Service 文件

在 `BuiltinServices/` 目录创建 `YourServiceName.ts`：

```typescript
/**
 * 服务名称 (内置)
 *
 * 从 VCPToolBox/Plugin/PluginName 转换
 * 功能描述
 */

import { app } from 'electron'  // 如需访问 app 路径
import fs from 'fs/promises'     // 如需文件操作
import path from 'path'          // 如需路径操作

import { loggerService } from '@logger'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService, PluginModelConfig } from './index'

const logger = loggerService.withContext('VCP:YourServiceName')

// 定义参数接口
interface CommandParams {
  param1: string
  param2?: number
}

/**
 * 服务实现类
 */
export class YourServiceName implements IBuiltinService {
  // ========== 必需属性 ==========
  name = 'PluginName'                          // 与原插件 name 一致
  displayName = '显示名称 (内置)'
  description = '服务描述'
  version = '1.0.0'
  type = 'builtin_service' as const

  // ========== 可选属性 ==========
  author = 'Cherry Studio'
  category = 'utilities'  // utilities | image | media | search | development | memory | ai

  documentation = `# 服务名称

功能描述...

## 命令列表

### CommandName
命令描述

## 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| param1 | string | 是 | 参数说明 |

## 使用示例

\\\`\\\`\\\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」PluginName「末」,
command:「始」CommandName「末」,
param1:「始」value「末」
<<<[END_TOOL_REQUEST]>>>
\\\`\\\`\\\`
`

  // ========== 模型支持 (可选) ==========
  supportsModel = false  // 如需绑定 AI 模型设为 true
  modelConfig?: PluginModelConfig

  // ========== 配置 Schema ==========
  configSchema = {
    API_KEY: {
      type: 'string',
      required: true,
      description: 'API 密钥'
    },
    TIMEOUT: {
      type: 'number',
      required: false,
      default: 30000,
      description: '超时毫秒数'
    }
  }

  // ========== 工具定义 ==========
  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'CommandName',
      description: `命令描述...

参数:
- param1 (字符串, 必需): 参数说明
- param2 (数字, 可选): 参数说明`,
      parameters: [
        { name: 'param1', type: 'string', required: true, description: '参数说明' },
        { name: 'param2', type: 'number', required: false, description: '参数说明' }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」PluginName「末」,
command:「始」CommandName「末」,
param1:「始」value「末」
<<<[END_TOOL_REQUEST]>>>`
    }
  ]

  // ========== 私有属性 ==========
  private config: Record<string, unknown> = {}

  // ========== 生命周期方法 ==========
  async initialize(): Promise<void> {
    logger.info('YourServiceName initialized')
  }

  async shutdown(): Promise<void> {
    logger.info('YourServiceName shutdown')
  }

  setConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config }
  }

  // ========== 执行入口 ==========
  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    logger.debug('YourServiceName executing', { command, params })

    try {
      switch (command) {
        case 'CommandName':
          return await this.handleCommand(params as unknown as CommandParams)
        default:
          return { success: false, error: `Unknown command: ${command}` }
      }
    } catch (error) {
      logger.error('YourServiceName execution failed', { command, error })
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // ========== 命令处理方法 ==========
  private async handleCommand(params: CommandParams): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    // 参数验证
    if (!params.param1) {
      return { success: false, error: '缺少 param1 参数' }
    }

    // 获取配置
    const apiKey = this.config.API_KEY as string
    if (!apiKey) {
      return { success: false, error: '缺少 API_KEY 配置' }
    }

    try {
      // 实现业务逻辑...
      const result = await this.doSomething(params.param1)

      return {
        success: true,
        output: `操作成功: ${result}`,
        data: { result },
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: `操作失败: ${error instanceof Error ? error.message : String(error)}`,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ========== 私有辅助方法 ==========
  private async doSomething(input: string): Promise<string> {
    // 实现具体逻辑
    return input
  }
}
```

### 步骤 3: 注册服务

编辑 `BuiltinServices/index.ts`，在 `registerBuiltinServices()` 方法末尾添加：

```typescript
    try {
      // N. 服务描述
      const { YourServiceName } = await import('./YourServiceName')
      this.register(new YourServiceName())
    } catch (error) {
      logger.warn('Failed to load YourServiceName', { error: String(error) })
    }
```

### 步骤 4: 类型检查

运行以下命令验证：

```bash
cd cherry-studio
yarn typecheck:node
```

## 三、常见模式

### 3.1 HTTP API 调用

```typescript
private async callApi(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const apiKey = this.config.API_KEY as string

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`)
  }

  return response.json()
}
```

### 3.2 文件保存

```typescript
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

private outputDir: string = ''

async initialize(): Promise<void> {
  this.outputDir = path.join(app.getPath('userData'), 'vcp', 'your-service')
  await fs.mkdir(this.outputDir, { recursive: true })
}

private async saveFile(buffer: Buffer, extension: string): Promise<string> {
  const fileName = `${uuidv4()}.${extension}`
  const filePath = path.join(this.outputDir, fileName)
  await fs.writeFile(filePath, buffer)
  return filePath
}
```

### 3.3 支持模型绑定

```typescript
supportsModel = true
modelConfig?: PluginModelConfig

setModelConfig(modelConfig: PluginModelConfig): void {
  this.modelConfig = modelConfig
}

private async callBoundModel(prompt: string): Promise<string> {
  if (!this.modelConfig?.enabled) {
    throw new Error('未配置模型')
  }

  const { getBuiltinServiceRegistry } = await import('./index')
  const registry = getBuiltinServiceRegistry()

  const result = await registry.callServiceModel(this.name, {
    userMessage: prompt,
    systemPrompt: '你是一个助手...'
  })

  if (!result.success) {
    throw new Error(result.error || '模型调用失败')
  }

  return result.content || ''
}
```

### 3.4 平台特定服务

```typescript
// 仅 Windows
async initialize(): Promise<void> {
  if (process.platform !== 'win32') {
    logger.warn('This service is only available on Windows')
  }
}

async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
  if (process.platform !== 'win32') {
    return { success: false, error: '此服务仅支持 Windows 平台' }
  }
  // ...
}

// 注册时检查
try {
  if (process.platform === 'win32') {
    const { WindowsOnlyService } = await import('./WindowsOnlyService')
    this.register(new WindowsOnlyService())
  }
} catch (error) {
  logger.warn('Failed to load WindowsOnlyService', { error: String(error) })
}
```

### 3.5 长耗时后台任务 (如 ProjectAnalyst)

对于需要长时间运行（如遍历分析大量文件）的任务，不能阻塞主线程。

**推荐方案：**
1.  **使用 `setImmediate` 异步执行**：将繁重任务放在 `setImmediate` 回调中，允许服务方法立即返回任务 ID。
2.  **分批处理 (Batching)**：不要一次性启动所有 Promise，使用分批处理或并发控制（如 `p-limit` 或简单的 `for` 循环切片）来限制并发数，防止 IO/网络拥塞。
3.  **状态日志**：将任务进度写入日志文件或数据库，供前端轮询查询。

```typescript
// 示例：后台分批处理
async execute(command: string, params: any) {
  if (command === 'StartTask') {
    const taskId = Date.now().toString()
    this.runBackgroundTask(taskId) // 不等待，立即返回
    return { success: true, data: { taskId } }
  }
}

private async runBackgroundTask(taskId: string) {
  setImmediate(async () => {
    try {
      const items = await this.getAllItems()
      const batchSize = 5
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await Promise.all(batch.map(item => this.processItem(item)))
        await this.logProgress(taskId, i + batch.length, items.length)
      }
    } catch (error) {
      logger.error('Task failed', { taskId, error })
    }
  })
}
```

## 四、分类参考

| category | 说明 | 示例 |
|----------|------|------|
| `utilities` | 通用工具 | 计算器、文件树、随机数 |
| `image` | 图像处理 | 图片生成、编辑 |
| `media` | 媒体相关 | 视频生成、音乐、B站 |
| `search` | 搜索服务 | Google、Tavily |
| `development` | 开发工具 | 代码搜索、PowerShell |
| `memory` | 记忆系统 | RAG、日记、深度记忆 |
| `ai` | AI 增强 | 模型选择、质量守护 |
| `information` | 资讯服务 | 天气、热榜 |
| `network` | 网络工具 | URL 获取 |

## 五、检查清单

- [ ] 服务名称与原插件一致
- [ ] 所有命令都已实现
- [ ] 参数验证完整
- [ ] 错误处理得当
- [ ] 配置项正确定义
- [ ] 文档完整 (documentation 字段)
- [ ] 已在 index.ts 注册
- [ ] 类型检查通过 (`yarn typecheck:node`)

## 六、参考服务

可参考以下已实现的服务：

| 服务 | 复杂度 | 特点 |
|------|--------|------|
| `AnimeFinderService` | 简单 | HTTP API 调用 |
| `SciCalculatorService` | 简单 | 本地计算，动态导入 |
| `QwenImageGenService` | 中等 | 图片生成+保存 |
| `ProjectAnalystService` | 中等 | 文件系统+AI 总结 |
| `PowerShellExecutorService` | 中等 | 子进程+平台限制 |
| `MagiAgentService` | 复杂 | 多模型协作 |
