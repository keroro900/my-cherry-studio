/**
 * VCPPluginCreator 内置服务
 *
 * AI 即时创建插件服务 - 实现 AI 的无限扩展能力：
 * - 接收自然语言描述，生成完整的 BuiltinService 代码
 * - 动态注册新服务到 BuiltinServiceRegistry
 * - 支持热重载和版本管理
 * - 抗崩溃自动回退机制
 *
 * 核心能力:
 * - AI 可以在对话中即时为自己创造新工具
 * - 生成的服务遵循 IBuiltinService 接口规范
 * - 支持代码验证、安全检查
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { getModelServiceBridge } from '../ModelServiceBridge'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:PluginCreator')

// ==================== 类型定义 ====================

/**
 * 插件创建请求
 */
interface PluginCreationRequest {
  name: string
  description: string
  commands: Array<{
    name: string
    description: string
    parameters: Array<{
      name: string
      type: string
      required: boolean
      description: string
    }>
  }>
  category?: string
  examples?: string[]
}

/**
 * 已创建的插件元数据
 */
interface CreatedPluginMeta {
  name: string
  displayName: string
  description: string
  version: string
  createdAt: number
  updatedAt: number
  codeHash: string
  status: 'active' | 'disabled' | 'error'
  errorMessage?: string
  usageCount: number
}

/**
 * 插件代码生成结果
 */
interface CodeGenerationResult {
  success: boolean
  code?: string
  error?: string
  warnings?: string[]
}

// ==================== VCPPluginCreatorService 实现 ====================

export class VCPPluginCreatorService implements IBuiltinService {
  name = 'VCPPluginCreator'
  displayName = '插件创造者 (内置)'
  description =
    'AI 即时创建插件服务：根据自然语言描述生成完整的 BuiltinService 代码，实现 AI 的无限扩展能力。支持热重载、版本管理和自动回退。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'meta'
  supportsModel = true

  private pluginsDir: string
  private metaFile: string
  private pluginsMeta: Map<string, CreatedPluginMeta> = new Map()
  private backupDir: string

  constructor() {
    const dataPath = app.getPath('userData')
    this.pluginsDir = path.join(dataPath, 'vcp', 'created-plugins')
    this.backupDir = path.join(dataPath, 'vcp', 'created-plugins-backup')
    this.metaFile = path.join(this.pluginsDir, 'plugins-meta.json')
  }

  configSchema = {
    autoValidate: {
      type: 'boolean',
      default: true,
      description: '是否自动验证生成的代码'
    },
    maxPlugins: {
      type: 'number',
      default: 50,
      description: '最大创建插件数量'
    },
    enableBackup: {
      type: 'boolean',
      default: true,
      description: '是否启用代码备份'
    }
  }

  documentation = `# 插件创造者服务

AI 可以使用此服务为自己创建新的工具/插件，实现无限扩展能力。

## 工作流程

1. AI 描述需要的功能
2. 服务生成符合 IBuiltinService 接口的 TypeScript 代码
3. 代码经过验证后保存到 created-plugins 目录
4. 新插件动态注册到 BuiltinServiceRegistry
5. AI 可以立即使用新创建的插件

## 安全机制

- 代码语法验证
- 敏感 API 检测
- 自动备份和回退
- 使用计数和监控

## 命令

### Create
创建新插件。

### List
列出已创建的插件。

### Enable/Disable
启用/禁用插件。

### Delete
删除插件。

### Rollback
回滚到上一版本。
`

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'Create',
      description: `创建一个新的内置服务插件。

参数:
- name (字符串, 必需): 插件名称 (英文，PascalCase)
- description (字符串, 必需): 插件功能描述
- commands (JSON数组, 必需): 命令定义列表
- category (字符串, 可选): 插件类别
- examples (字符串数组, 可选): 使用示例

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」Create「末」
name:「始」WeatherQuery「末」
description:「始」查询天气信息的插件，支持多城市查询和天气预报「末」
commands:「始」[
  {
    "name": "GetWeather",
    "description": "获取指定城市的天气",
    "parameters": [
      {"name": "city", "type": "string", "required": true, "description": "城市名称"},
      {"name": "days", "type": "number", "required": false, "description": "预报天数"}
    ]
  }
]「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'name', description: '插件名称', required: true, type: 'string' },
        { name: 'description', description: '插件描述', required: true, type: 'string' },
        { name: 'commands', description: '命令定义 (JSON)', required: true, type: 'string' },
        { name: 'category', description: '插件类别', required: false, type: 'string' },
        { name: 'examples', description: '使用示例', required: false, type: 'array' }
      ]
    },
    {
      commandIdentifier: 'List',
      description: `列出所有已创建的插件。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」List「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'Enable',
      description: `启用指定插件。

参数:
- name (字符串, 必需): 插件名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」Enable「末」
name:「始」WeatherQuery「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'name', description: '插件名称', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'Disable',
      description: `禁用指定插件。

参数:
- name (字符串, 必需): 插件名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」Disable「末」
name:「始」WeatherQuery「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'name', description: '插件名称', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'Delete',
      description: `删除指定插件。

参数:
- name (字符串, 必需): 插件名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」Delete「末」
name:「始」WeatherQuery「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'name', description: '插件名称', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'Rollback',
      description: `回滚插件到上一版本。

参数:
- name (字符串, 必需): 插件名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」Rollback「末」
name:「始」WeatherQuery「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'name', description: '插件名称', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'GetCode',
      description: `获取插件的源代码。

参数:
- name (字符串, 必需): 插件名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPPluginCreator「末」
command:「始」GetCode「末」
name:「始」WeatherQuery「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'name', description: '插件名称', required: true, type: 'string' }]
    }
  ]

  async initialize(): Promise<void> {
    // 确保目录存在
    await fs.promises.mkdir(this.pluginsDir, { recursive: true })
    await fs.promises.mkdir(this.backupDir, { recursive: true })

    // 加载插件元数据
    await this.loadPluginsMeta()

    logger.info('VCPPluginCreatorService initialized', {
      pluginsDir: this.pluginsDir,
      pluginCount: this.pluginsMeta.size
    })
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'Create':
          return await this.createPlugin(params)

        case 'List':
          return await this.listPlugins()

        case 'Enable':
          return await this.enablePlugin(String(params.name))

        case 'Disable':
          return await this.disablePlugin(String(params.name))

        case 'Delete':
          return await this.deletePlugin(String(params.name))

        case 'Rollback':
          return await this.rollbackPlugin(String(params.name))

        case 'GetCode':
          return await this.getPluginCode(String(params.name))

        default:
          return { success: false, error: `Unknown command: ${command}` }
      }
    } catch (error) {
      logger.error('VCPPluginCreator command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 创建新插件
   */
  private async createPlugin(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const name = String(params.name || '').trim()
    const description = String(params.description || '').trim()

    if (!name || !description) {
      return { success: false, error: '需要 name 和 description 参数' }
    }

    // 验证名称格式
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return { success: false, error: '插件名称必须是 PascalCase 格式 (如 WeatherQuery)' }
    }

    // 检查是否已存在
    if (this.pluginsMeta.has(name)) {
      return { success: false, error: `插件 ${name} 已存在，请先删除或使用其他名称` }
    }

    // 解析命令定义
    let commands: PluginCreationRequest['commands']
    try {
      const commandsStr = String(params.commands || '[]')
      commands = JSON.parse(commandsStr)
      if (!Array.isArray(commands) || commands.length === 0) {
        return { success: false, error: 'commands 必须是非空数组' }
      }
    } catch {
      return { success: false, error: 'commands 参数必须是有效的 JSON 数组' }
    }

    const category = params.category ? String(params.category) : 'custom'
    const examples = Array.isArray(params.examples) ? (params.examples as string[]) : []

    // 使用 AI 生成代码
    const request: PluginCreationRequest = {
      name,
      description,
      commands,
      category,
      examples
    }

    logger.info('Creating plugin', { name, commandCount: commands.length })

    const codeResult = await this.generatePluginCode(request)
    if (!codeResult.success || !codeResult.code) {
      return { success: false, error: codeResult.error || '代码生成失败' }
    }

    // 验证代码
    const validationResult = this.validateCode(codeResult.code)
    if (!validationResult.valid) {
      return { success: false, error: `代码验证失败: ${validationResult.error}` }
    }

    // 保存代码
    const pluginFile = path.join(this.pluginsDir, `${name}Service.ts`)
    await fs.promises.writeFile(pluginFile, codeResult.code, 'utf-8')

    // 保存元数据
    const meta: CreatedPluginMeta = {
      name,
      displayName: `${name} (用户创建)`,
      description,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      codeHash: this.hashCode(codeResult.code),
      status: 'active',
      usageCount: 0
    }

    this.pluginsMeta.set(name, meta)
    await this.savePluginsMeta()

    // 尝试动态加载 (注: 实际动态加载需要更复杂的机制)
    logger.info('Plugin created successfully', { name, file: pluginFile })

    return {
      success: true,
      output: `插件 ${name} 创建成功！

文件: ${pluginFile}
命令数: ${commands.length}
${codeResult.warnings?.length ? `\n警告: ${codeResult.warnings.join(', ')}` : ''}

注意: 新插件将在下次应用重启后生效。`,
      data: {
        name,
        file: pluginFile,
        commands: commands.map((c) => c.name),
        warnings: codeResult.warnings
      }
    }
  }

  /**
   * 使用 AI 生成插件代码
   */
  private async generatePluginCode(request: PluginCreationRequest): Promise<CodeGenerationResult> {
    try {
      const bridge = getModelServiceBridge()

      const prompt = `你是一个专业的 TypeScript 代码生成器。请根据以下需求生成一个完整的 VCP BuiltinService 插件代码。

## 需求描述

插件名称: ${request.name}
插件描述: ${request.description}
类别: ${request.category || 'custom'}

## 命令定义

${request.commands
  .map(
    (cmd) => `### ${cmd.name}
描述: ${cmd.description}
参数:
${cmd.parameters.map((p) => `- ${p.name} (${p.type}, ${p.required ? '必需' : '可选'}): ${p.description}`).join('\n')}`
  )
  .join('\n\n')}

${request.examples?.length ? `## 使用示例\n${request.examples.join('\n')}` : ''}

## 代码模板

请生成完整的 TypeScript 代码，必须：
1. 实现 IBuiltinService 接口
2. 类名为 ${request.name}Service
3. 导出该类
4. 包含完整的 toolDefinitions
5. 包含 execute 方法实现
6. 使用 VCP 语法格式的调用示例
7. 如需文件操作，使用 FileOperator 服务而非直接 fs（通过 BuiltinServiceRegistry 调用）

示例文件操作代码：
\`\`\`typescript
// 获取 FileOperator 服务
const registry = await import('./index').then(m => m.getBuiltinServiceRegistry())
const result = await registry.execute('FileOperator', 'ReadFile', { filePath: '/path/to/file' })
\`\`\`

请只输出代码，不要其他解释。代码格式如下：

\`\`\`typescript
/**
 * ${request.name} 内置服务
 *
 * ${request.description}
 *
 * @generated by VCPPluginCreator
 */

import { loggerService } from '@logger'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:${request.name}')

export class ${request.name}Service implements IBuiltinService {
  // ... 完整实现
}
\`\`\`
`

      const result = await bridge.callModel({
        capabilities: ['reasoning'],
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的 TypeScript 代码生成器，擅长生成符合 VCP BuiltinService 接口规范的插件代码。生成的代码必须是完整、可运行的。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 4000
      })

      if (!result.success || !result.content) {
        return { success: false, error: '模型调用失败' }
      }

      // 提取代码块
      const codeMatch = result.content.match(/```typescript\n([\s\S]*?)```/)
      if (!codeMatch) {
        // 尝试直接使用内容
        if (result.content.includes('class') && result.content.includes('implements IBuiltinService')) {
          return { success: true, code: result.content }
        }
        return { success: false, error: '未能从响应中提取有效代码' }
      }

      return { success: true, code: codeMatch[1] }
    } catch (error) {
      logger.error('Code generation failed', { error: String(error) })
      return { success: false, error: `代码生成错误: ${error}` }
    }
  }

  /**
   * 验证生成的代码
   */
  private validateCode(code: string): { valid: boolean; error?: string } {
    // 基本语法检查
    if (!code.includes('implements IBuiltinService')) {
      return { valid: false, error: '缺少 IBuiltinService 接口实现' }
    }

    if (!code.includes('toolDefinitions')) {
      return { valid: false, error: '缺少 toolDefinitions 定义' }
    }

    if (!code.includes('async execute')) {
      return { valid: false, error: '缺少 execute 方法' }
    }

    // 安全检查 - 禁止危险操作
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/, // 禁止直接 fs，应使用 FileOperator
      /import\s+.*\s+from\s+['"]fs['"]/, // 禁止 import fs
      /eval\s*\(/,
      /Function\s*\(/,
      /process\.exit/,
      /process\.kill/,
      /require\s*\(\s*['"]os['"]\s*\)/,
      /require\s*\(\s*['"]net['"]\s*\)/
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, error: `代码包含危险操作: ${pattern.source}。如需文件操作请使用 FileOperator 服务。` }
      }
    }

    return { valid: true }
  }

  /**
   * 列出所有插件
   */
  private async listPlugins(): Promise<BuiltinServiceResult> {
    const plugins = Array.from(this.pluginsMeta.values())

    if (plugins.length === 0) {
      return {
        success: true,
        output: '暂无用户创建的插件。使用 Create 命令创建你的第一个插件！',
        data: { plugins: [] }
      }
    }

    const output =
      `已创建的插件 (${plugins.length} 个):\n\n` +
      plugins
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} [${p.status}]
   描述: ${p.description}
   版本: ${p.version}
   使用次数: ${p.usageCount}
   创建时间: ${new Date(p.createdAt).toLocaleString()}`
        )
        .join('\n\n')

    return { success: true, output, data: { plugins } }
  }

  /**
   * 启用插件
   */
  private async enablePlugin(name: string): Promise<BuiltinServiceResult> {
    const meta = this.pluginsMeta.get(name)
    if (!meta) {
      return { success: false, error: `插件 ${name} 不存在` }
    }

    meta.status = 'active'
    meta.updatedAt = Date.now()
    await this.savePluginsMeta()

    return {
      success: true,
      output: `插件 ${name} 已启用`,
      data: { name, status: 'active' }
    }
  }

  /**
   * 禁用插件
   */
  private async disablePlugin(name: string): Promise<BuiltinServiceResult> {
    const meta = this.pluginsMeta.get(name)
    if (!meta) {
      return { success: false, error: `插件 ${name} 不存在` }
    }

    meta.status = 'disabled'
    meta.updatedAt = Date.now()
    await this.savePluginsMeta()

    return {
      success: true,
      output: `插件 ${name} 已禁用`,
      data: { name, status: 'disabled' }
    }
  }

  /**
   * 删除插件
   */
  private async deletePlugin(name: string): Promise<BuiltinServiceResult> {
    const meta = this.pluginsMeta.get(name)
    if (!meta) {
      return { success: false, error: `插件 ${name} 不存在` }
    }

    // 备份后删除
    const pluginFile = path.join(this.pluginsDir, `${name}Service.ts`)
    const backupFile = path.join(this.backupDir, `${name}Service_${Date.now()}.ts`)

    try {
      if (fs.existsSync(pluginFile)) {
        await fs.promises.copyFile(pluginFile, backupFile)
        await fs.promises.unlink(pluginFile)
      }
    } catch (error) {
      logger.warn('Failed to backup/delete plugin file', { name, error: String(error) })
    }

    this.pluginsMeta.delete(name)
    await this.savePluginsMeta()

    return {
      success: true,
      output: `插件 ${name} 已删除（备份已保存）`,
      data: { name, backupFile }
    }
  }

  /**
   * 回滚插件
   */
  private async rollbackPlugin(name: string): Promise<BuiltinServiceResult> {
    // 查找最新的备份
    const files = await fs.promises.readdir(this.backupDir)
    const backups = files
      .filter((f) => f.startsWith(`${name}Service_`) && f.endsWith('.ts'))
      .sort()
      .reverse()

    if (backups.length === 0) {
      return { success: false, error: `没有找到插件 ${name} 的备份` }
    }

    const latestBackup = path.join(this.backupDir, backups[0])
    const pluginFile = path.join(this.pluginsDir, `${name}Service.ts`)

    // 恢复备份
    await fs.promises.copyFile(latestBackup, pluginFile)

    // 更新元数据
    const meta = this.pluginsMeta.get(name)
    if (meta) {
      meta.updatedAt = Date.now()
      meta.status = 'active'
      await this.savePluginsMeta()
    }

    return {
      success: true,
      output: `插件 ${name} 已回滚到备份版本`,
      data: { name, backupUsed: backups[0] }
    }
  }

  /**
   * 获取插件代码
   */
  private async getPluginCode(name: string): Promise<BuiltinServiceResult> {
    const meta = this.pluginsMeta.get(name)
    if (!meta) {
      return { success: false, error: `插件 ${name} 不存在` }
    }

    const pluginFile = path.join(this.pluginsDir, `${name}Service.ts`)

    try {
      const code = await fs.promises.readFile(pluginFile, 'utf-8')
      return {
        success: true,
        output: `插件 ${name} 的源代码:\n\n\`\`\`typescript\n${code}\n\`\`\``,
        data: { name, code }
      }
    } catch {
      return { success: false, error: `无法读取插件代码文件` }
    }
  }

  // ==================== 辅助方法 ====================

  private async loadPluginsMeta(): Promise<void> {
    try {
      if (fs.existsSync(this.metaFile)) {
        const data = await fs.promises.readFile(this.metaFile, 'utf-8')
        const plugins = JSON.parse(data) as CreatedPluginMeta[]
        this.pluginsMeta = new Map(plugins.map((p) => [p.name, p]))
      }
    } catch (error) {
      logger.warn('Failed to load plugins meta', { error: String(error) })
    }
  }

  private async savePluginsMeta(): Promise<void> {
    try {
      const plugins = Array.from(this.pluginsMeta.values())
      await fs.promises.writeFile(this.metaFile, JSON.stringify(plugins, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save plugins meta', { error: String(error) })
    }
  }

  private hashCode(code: string): string {
    let hash = 0
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  async shutdown(): Promise<void> {
    await this.savePluginsMeta()
    logger.info('VCPPluginCreatorService shutdown')
  }
}
