/**
 * VCPVariableService - VCP 变量管理服务
 *
 * 管理 VCP 系统中的各类变量：
 * - 系统变量 (Date, Time, Festival) - 只读
 * - 用户自定义变量 (Var) - 全局变量
 * - 模板变量 (Tar) - 模板组合
 * - 条件变量 (Sar) - 模型条件匹配
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { loggerService } from '@main/services/LoggerService'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('VCPVariableService')

/**
 * 系统变量定义 - 只读，由 PlaceholderEngine 自动解析
 */
const SYSTEM_VARIABLES: Array<Omit<PromptVariable, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Date',
    value: '{{Date}} - 由系统自动填充当前日期',
    description: '当前日期，格式：YYYY/M/D',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Time',
    value: '{{Time}} - 由系统自动填充当前时间',
    description: '当前时间，格式：HH:mm:ss',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Today',
    value: '{{Today}} - 由系统自动填充完整日期',
    description: '完整日期描述，如：2025年1月2日 星期四',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Year',
    value: '{{Year}} - 由系统自动填充年份',
    description: '当前年份',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Month',
    value: '{{Month}} - 由系统自动填充月份',
    description: '当前月份（01-12）',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Day',
    value: '{{Day}} - 由系统自动填充日期',
    description: '当前日期（01-31）',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Weekday',
    value: '{{Weekday}} - 由系统自动填充星期',
    description: '当前星期几（日/一/二/三/四/五/六）',
    category: '系统变量',
    scope: 'global'
  },
  {
    name: 'Festival',
    value: '{{Festival}} - 由系统自动填充节日',
    description: '当前节日（如：元旦、春节、国庆等）',
    category: '系统变量',
    scope: 'global'
  }
]

/**
 * 默认变量定义 - 从 VCPToolBox 原生化，适配 Cherry Studio BuiltinServices
 * 这些变量在首次启动时自动创建
 */
const DEFAULT_VARIABLES: Array<Omit<PromptVariable, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'VarUser',
    value: '主人',
    description: '用户称呼，可自定义',
    category: '基础变量',
    scope: 'global'
  },
  {
    name: 'VarUserInfo',
    value: '',
    description: '用户个人信息描述',
    category: '基础变量',
    scope: 'global'
  },
  {
    name: 'VarSystemInfo',
    value: `【当前时间信息】
日期：{{Date}}
时间：{{Time}}
星期：{{Today}}
节日/节气：{{Festival}}`,
    description: '系统时间信息变量，包含日期时间等动态信息（由 PlaceholderEngine 递归解析）',
    category: '基础变量',
    scope: 'global'
  },
  {
    name: 'VarDailyNoteGuide',
    value: `本客户端已搭载长期记忆功能。通过 DailyNoteWrite 内置服务创建/更新日记，会被 RAG 系统记录。

1. 创建日记：
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」日记内容 (Markdown 格式)「末」
tags:「始」标签1,标签2「末」
category:「始」diary「末」
characterName:「始」角色名「末」
<<<[END_TOOL_REQUEST]>>>

2. 快速笔记：
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」quickNote「末」
content:「始」简短笔记内容「末」
<<<[END_TOOL_REQUEST]>>>

3. 更新日记：
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」update「末」
target:「始」需要替换的旧内容（至少15字符）「末」
replace:「始」新内容「末」
<<<[END_TOOL_REQUEST]>>>

日记的主要功能是学习和反思，仅当产生有价值的话题或学习到新知识时使用。`,
    description: '日记功能使用指南（DailyNoteWrite 内置服务）',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarSearchGuide',
    value: `Cherry Studio 提供多种搜索服务：

1. LightMemo - 智能 RAG 搜索（本地记忆/知识库）
<<<[TOOL_REQUEST]>>>
tool_name:「始」LightMemo「末」
command:「始」SearchRAG「末」
query:「始」搜索关键词「末」
<<<[END_TOOL_REQUEST]>>>

2. GoogleSearch - 谷歌搜索
<<<[TOOL_REQUEST]>>>
tool_name:「始」GoogleSearch「末」
command:「始」GoogleSearch「末」
query:「始」搜索内容「末」
<<<[END_TOOL_REQUEST]>>>

3. TavilySearch - Tavily 搜索
<<<[TOOL_REQUEST]>>>
tool_name:「始」TavilySearch「末」
command:「始」TavilySearch「末」
query:「始」搜索内容「末」
<<<[END_TOOL_REQUEST]>>>`,
    description: '搜索服务使用指南',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarFileTool',
    value: `文件操作工具（FileOperator 内置服务）：

1. 读取文件：
<<<[TOOL_REQUEST]>>>
tool_name:「始」FileOperator「末」
command:「始」ReadFile「末」
filePath:「始」文件路径「末」
<<<[END_TOOL_REQUEST]>>>

2. 写入文件：
<<<[TOOL_REQUEST]>>>
tool_name:「始」FileOperator「末」
command:「始」WriteFile「末」
filePath:「始」文件路径「末」
content:「始」文件内容「末」
<<<[END_TOOL_REQUEST]>>>

3. 列出目录：
<<<[TOOL_REQUEST]>>>
tool_name:「始」FileOperator「末」
command:「始」ListDirectory「末」
directoryPath:「始」目录路径「末」
<<<[END_TOOL_REQUEST]>>>

4. 获取文件信息：
<<<[TOOL_REQUEST]>>>
tool_name:「始」FileOperator「末」
command:「始」FileInfo「末」
filePath:「始」文件路径「末」
<<<[END_TOOL_REQUEST]>>>`,
    description: '文件操作工具指南（FileOperator 内置服务）',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarUrlFetch',
    value: `网页内容获取（UrlFetch 内置服务）：

<<<[TOOL_REQUEST]>>>
tool_name:「始」UrlFetch「末」
command:「始」UrlFetch「末」
url:「始」https://example.com「末」
extract_type:「始」text「末」
<<<[END_TOOL_REQUEST]>>>

extract_type 可选：text（纯文本）、markdown（Markdown 格式）、html（原始 HTML）`,
    description: '网页爬取工具指南（UrlFetch 内置服务）',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarMemoryMaster',
    value: `记忆大师服务（MemoryMaster 内置服务）：

1. AI 自动标签：
<<<[TOOL_REQUEST]>>>
tool_name:「始」MemoryMaster「末」
command:「始」AutoTag「末」
content:「始」需要打标签的内容「末」
maxTags:「始」5「末」
<<<[END_TOOL_REQUEST]>>>

2. 创建记忆：
<<<[TOOL_REQUEST]>>>
tool_name:「始」MemoryMaster「末」
command:「始」CreateMemory「末」
content:「始」记忆内容「末」
tags:「始」标签1,标签2「末」
<<<[END_TOOL_REQUEST]>>>

3. 获取热门标签：
<<<[TOOL_REQUEST]>>>
tool_name:「始」MemoryMaster「末」
command:「始」GetTopTags「末」
count:「始」20「末」
<<<[END_TOOL_REQUEST]>>>`,
    description: '记忆大师服务指南（AI自动标签、记忆管理）',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarImageGen',
    value: `图片生成服务（ImageGeneration 内置服务）：

<<<[TOOL_REQUEST]>>>
tool_name:「始」ImageGeneration「末」
command:「始」generate「末」
prompt:「始」图片描述「末」
backend:「始」gemini「末」
aspect_ratio:「始」1:1「末」
<<<[END_TOOL_REQUEST]>>>

支持后端：gemini、dall-e、comfyui、qwen、flux、auto（自动选择）`,
    description: '图片生成服务指南（多后端支持）',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarAgentMessage',
    value: `Agent 消息服务（AgentMessage 内置服务）：

向用户发送消息：
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentMessage「末」
command:「始」SendMessage「末」
message:「始」消息内容「末」
Maid:「始」角色名「末」
<<<[END_TOOL_REQUEST]>>>

Maid 可选，用于标识发送者/角色名称。`,
    description: 'Agent 消息推送服务',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarRendering',
    value: `你可以使用 HTML/CSS 进行富文本渲染。将内容包裹在 <div> 元素中，使用内联样式创建美观的界面。

支持：
- CSS 动画效果（@keyframes）
- 交互按钮（<button onclick="input('内容')">）
- 数据可视化（SVG、Grid 布局）
- 代码块（<pre><code>...</code></pre>）

注意：工具调用保持原始 <<<[TOOL_REQUEST]>>> 格式，无需添加样式。`,
    description: 'DIV 渲染模式指南',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarVCPForum',
    value: `VCP 论坛服务（VCPForum 内置服务）：

1. 发帖：
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」CreatePost「末」
maid:「始」角色名「末」
board:「始」板块名「末」
title:「始」帖子标题「末」
content:「始」正文内容「末」
<<<[END_TOOL_REQUEST]>>>

2. 读帖：
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」ReadPost「末」
post_uid:「始」帖子ID「末」
<<<[END_TOOL_REQUEST]>>>`,
    description: 'VCP 论坛服务指南',
    category: '功能指南',
    scope: 'global'
  },
  {
    name: 'VarToolFormat',
    value: `VCP 工具调用统一格式：

<<<[TOOL_REQUEST]>>>
tool_name:「始」工具名「末」
command:「始」命令「末」
参数名:「始」参数值「末」
<<<[END_TOOL_REQUEST]>>>

使用「始」「末」包裹参数以兼容富文本。
主动判断当前需求，灵活调用各类工具。`,
    description: 'VCP 工具调用格式说明',
    category: '基础变量',
    scope: 'global'
  }
]

/**
 * 变量类型定义
 * @deprecated 使用 VCPVariable (from '@shared/variables') 替代
 * @see VCPVariable 统一的变量接口
 */
export interface PromptVariable {
  id: string
  name: string
  value: string
  description?: string
  category?: string
  scope?: 'global' | 'agent' | 'session'
  createdAt?: number
  updatedAt?: number
}

// 变量存储
interface VariableStore {
  variables: PromptVariable[]
  lastUpdated: number
}

/**
 * VCP 变量管理服务
 */
class VCPVariableService {
  private static instance: VCPVariableService
  private variables: Map<string, PromptVariable> = new Map()
  private storePath: string
  private initialized = false

  private constructor() {
    const userDataPath = electronApp ? electronApp.getPath('userData') : path.join(os.tmpdir(), 'cherry-studio-data')
    this.storePath = path.join(userDataPath, 'Data', 'vcp-variables.json')
  }

  static getInstance(): VCPVariableService {
    if (!VCPVariableService.instance) {
      VCPVariableService.instance = new VCPVariableService()
    }
    return VCPVariableService.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.loadFromDisk()
      this.initialized = true
      logger.info('VCPVariableService initialized', { count: this.variables.size })
    } catch (error) {
      logger.error('Failed to initialize VCPVariableService', error as Error)
      this.initialized = true // 即使失败也标记为已初始化，使用空数据
    }
  }

  /**
   * 从磁盘加载变量
   */
  private async loadFromDisk(): Promise<void> {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const store: VariableStore = JSON.parse(data)
        this.variables.clear()
        for (const variable of store.variables) {
          this.variables.set(variable.id, variable)
        }
      }

      // 如果没有变量，创建默认变量
      if (this.variables.size === 0) {
        await this.createDefaultVariables()
      }
    } catch (error) {
      logger.warn('Failed to load variables from disk', error as Error)
      // 尝试创建默认变量
      if (this.variables.size === 0) {
        await this.createDefaultVariables()
      }
    }
  }

  /**
   * 创建默认变量
   */
  private async createDefaultVariables(): Promise<void> {
    logger.info('Creating default VCP variables...')
    const now = Date.now()

    // 创建系统变量（只读）
    for (const sysVar of SYSTEM_VARIABLES) {
      const newVariable: PromptVariable = {
        ...sysVar,
        id: `sys_${sysVar.name.toLowerCase()}`,
        createdAt: now,
        updatedAt: now
      }
      this.variables.set(newVariable.id, newVariable)
    }

    // 创建用户自定义变量
    for (const defaultVar of DEFAULT_VARIABLES) {
      const newVariable: PromptVariable = {
        ...defaultVar,
        id: `var_${now}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now
      }
      this.variables.set(newVariable.id, newVariable)
    }

    await this.saveToDisk()
    logger.info('Default VCP variables created', {
      systemVars: SYSTEM_VARIABLES.length,
      userVars: DEFAULT_VARIABLES.length,
      total: SYSTEM_VARIABLES.length + DEFAULT_VARIABLES.length
    })
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const store: VariableStore = {
        variables: Array.from(this.variables.values()),
        lastUpdated: Date.now()
      }
      fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2))
    } catch (error) {
      logger.error('Failed to save variables to disk', error as Error)
    }
  }

  /**
   * 获取所有变量
   */
  async list(): Promise<PromptVariable[]> {
    await this.initialize()
    return Array.from(this.variables.values())
  }

  /**
   * 获取单个变量
   */
  async get(id: string): Promise<PromptVariable | undefined> {
    await this.initialize()
    return this.variables.get(id)
  }

  /**
   * 根据名称获取变量
   */
  async getByName(name: string): Promise<PromptVariable | undefined> {
    await this.initialize()
    return Array.from(this.variables.values()).find((v) => v.name === name)
  }

  /**
   * 创建变量
   */
  async create(variable: Omit<PromptVariable, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptVariable> {
    await this.initialize()

    const now = Date.now()
    const newVariable: PromptVariable = {
      ...variable,
      id: `var_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now
    }

    this.variables.set(newVariable.id, newVariable)
    await this.saveToDisk()

    logger.info('Variable created', { id: newVariable.id, name: newVariable.name })
    return newVariable
  }

  /**
   * 更新变量
   */
  async update(id: string, updates: Partial<PromptVariable>): Promise<PromptVariable | undefined> {
    await this.initialize()

    const existing = this.variables.get(id)
    if (!existing) {
      logger.warn('Variable not found for update', { id })
      return undefined
    }

    const updated: PromptVariable = {
      ...existing,
      ...updates,
      id: existing.id, // 保持 ID 不变
      createdAt: existing.createdAt, // 保持创建时间不变
      updatedAt: Date.now()
    }

    this.variables.set(id, updated)
    await this.saveToDisk()

    logger.info('Variable updated', { id, name: updated.name })
    return updated
  }

  /**
   * 删除变量
   */
  async delete(id: string): Promise<boolean> {
    await this.initialize()

    if (!this.variables.has(id)) {
      logger.warn('Variable not found for delete', { id })
      return false
    }

    this.variables.delete(id)
    await this.saveToDisk()

    logger.info('Variable deleted', { id })
    return true
  }

  /**
   * 按作用域获取变量
   */
  async listByScope(scope: 'global' | 'agent' | 'session'): Promise<PromptVariable[]> {
    await this.initialize()
    return Array.from(this.variables.values()).filter((v) => v.scope === scope)
  }

  /**
   * 解析变量值 (替换变量占位符)
   */
  async resolveValue(template: string): Promise<string> {
    await this.initialize()

    let result = template

    // 替换用户定义的变量 {{Var:name}}
    const varPattern = /\{\{Var:(\w+)\}\}/g
    result = result.replace(varPattern, (match, name) => {
      const variable = Array.from(this.variables.values()).find((v) => v.name === name)
      return variable?.value ?? match
    })

    return result
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number
    byScope: Record<string, number>
  }> {
    await this.initialize()

    const byScope: Record<string, number> = {
      global: 0,
      agent: 0,
      session: 0
    }

    for (const variable of this.variables.values()) {
      const scope = variable.scope || 'global'
      byScope[scope] = (byScope[scope] || 0) + 1
    }

    return {
      total: this.variables.size,
      byScope
    }
  }

  // ============================================================================
  // 插件变量支持 - 用于 PluginVariableRegistry 适配器模式
  // ============================================================================

  /**
   * 注册插件变量（由 PluginVariableRegistry 调用）
   * 插件变量存储在内存中，不持久化到磁盘
   *
   * @param params 插件变量参数
   * @returns 是否注册成功
   */
  registerPluginVariable(params: {
    name: string
    value: string
    description?: string
    pluginId?: string
    cacheTTL?: number
  }): boolean {
    const { name, value, description, pluginId, cacheTTL } = params

    // 验证变量名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      logger.warn('Invalid plugin variable name format', { name })
      return false
    }

    const now = Date.now()
    const existingByName = Array.from(this.variables.values()).find((v) => v.name === name)

    if (existingByName) {
      // 更新已存在的变量
      existingByName.value = value
      existingByName.description = description
      existingByName.updatedAt = now
      logger.debug('Plugin variable updated', { name, pluginId })
    } else {
      // 创建新变量（插件变量不持久化）
      const newVariable: PromptVariable = {
        id: `plugin_${name}_${now}`,
        name,
        value,
        description,
        category: '插件变量',
        scope: 'global',
        createdAt: now,
        updatedAt: now
      }
      this.variables.set(newVariable.id, newVariable)
      logger.debug('Plugin variable registered', { name, pluginId, cacheTTL })
    }

    return true
  }

  /**
   * 注销插件变量
   *
   * @param name 变量名
   * @returns 是否注销成功
   */
  unregisterPluginVariable(name: string): boolean {
    const variable = Array.from(this.variables.values()).find(
      (v) => v.name === name && v.category === '插件变量'
    )

    if (variable) {
      this.variables.delete(variable.id)
      logger.debug('Plugin variable unregistered', { name })
      return true
    }

    return false
  }

  /**
   * 获取所有插件变量
   */
  getPluginVariables(): PromptVariable[] {
    return Array.from(this.variables.values()).filter((v) => v.category === '插件变量')
  }

  // ============================================================================
  // .env 格式导入/导出支持
  // ============================================================================

  /**
   * 分析 .env 导入内容，返回冲突列表供用户确认
   *
   * @param envContent .env 文件内容
   * @returns 导入分析结果，包含冲突列表
   */
  async analyzeEnvImport(envContent: string): Promise<{
    created: number
    updated: number
    skipped: number
    total: number
    conflicts: Array<{
      name: string
      existingValue: string
      newValue: string
      existingId: string
    }>
  }> {
    await this.initialize()

    // 延迟导入避免循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EnvConfigLoader } = require('./EnvConfigLoader')
    const loader = new EnvConfigLoader()
    const imported = loader.parseEnvContent(envContent)

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      total: imported.length,
      conflicts: [] as Array<{
        name: string
        existingValue: string
        newValue: string
        existingId: string
      }>
    }

    for (const variable of imported) {
      if (!variable.name || !variable.value) continue

      const existing = Array.from(this.variables.values()).find((v) => v.name === variable.name)

      if (existing) {
        // 值相同则跳过
        if (existing.value === variable.value) {
          result.skipped++
        } else {
          // 值不同，添加到冲突列表
          result.conflicts.push({
            name: variable.name,
            existingValue: existing.value,
            newValue: variable.value,
            existingId: existing.id
          })
        }
      } else {
        result.created++
      }
    }

    logger.info('Analyzed env import', {
      total: result.total,
      created: result.created,
      conflicts: result.conflicts.length,
      skipped: result.skipped
    })

    return result
  }

  /**
   * 执行 .env 导入
   *
   * @param envContent .env 文件内容
   * @param conflictResolutions 冲突处理决定 (name -> 'keep' | 'replace' | 'skip')
   * @returns 导入结果
   */
  async executeEnvImport(
    envContent: string,
    conflictResolutions: Map<string, 'keep' | 'replace' | 'skip'>
  ): Promise<{
    created: number
    updated: number
    skipped: number
    total: number
  }> {
    await this.initialize()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EnvConfigLoader } = require('./EnvConfigLoader')
    const loader = new EnvConfigLoader()
    const imported = loader.parseEnvContent(envContent)

    let created = 0
    let updated = 0
    let skipped = 0

    for (const variable of imported) {
      if (!variable.name || !variable.value) {
        skipped++
        continue
      }

      const existing = Array.from(this.variables.values()).find((v) => v.name === variable.name)

      if (existing) {
        const resolution = conflictResolutions.get(variable.name) ?? 'skip'

        if (resolution === 'replace') {
          await this.update(existing.id, { value: variable.value })
          updated++
        } else {
          skipped++
        }
      } else {
        // 创建新变量
        await this.create({
          name: variable.name,
          value: variable.value,
          description: variable.description,
          category: variable.category || '自定义变量',
          scope: variable.scope || 'global'
        })
        created++
      }
    }

    logger.info('Executed env import', { created, updated, skipped, total: imported.length })

    return { created, updated, skipped, total: imported.length }
  }

  /**
   * 导出变量为 .env 格式
   *
   * @param filter 可选的过滤条件
   * @returns .env 格式的字符串
   */
  async exportToEnv(filter?: {
    categories?: string[]
    namePrefix?: string
  }): Promise<string> {
    await this.initialize()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EnvConfigLoader } = require('./EnvConfigLoader')
    const loader = new EnvConfigLoader()

    let variablesToExport = Array.from(this.variables.values())

    // 应用过滤
    if (filter?.categories && filter.categories.length > 0) {
      variablesToExport = variablesToExport.filter((v) => v.category && filter.categories!.includes(v.category))
    }

    if (filter?.namePrefix) {
      variablesToExport = variablesToExport.filter((v) => v.name.startsWith(filter.namePrefix!))
    }

    // 排除系统变量（只读）
    variablesToExport = variablesToExport.filter((v) => v.category !== '系统变量')

    // 转换为导出格式
    const exportData = variablesToExport.map((v) => ({
      name: v.name,
      value: v.value,
      description: v.description,
      category: v.category
    }))

    logger.info('Exporting variables to env format', { count: exportData.length })

    return loader.exportToEnv(exportData)
  }
}

export const vcpVariableService = VCPVariableService.getInstance()
export default vcpVariableService
