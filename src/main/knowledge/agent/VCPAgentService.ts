/**
 * VCP Agent 管理服务
 *
 * 功能:
 * - Agent 定义文件管理 (类似 VCP Agent/ 目录)
 * - 角色卡片 CRUD
 * - 提示词模板管理
 * - 与 Cherry 助手系统集成
 *
 * @version 2.0.0
 *
 * ## 重要：Agent/Assistant 融合计划
 *
 * Agent CRUD 方法已标记为 @deprecated，长期计划是使用 Redux 存储的 Assistant 替代。
 * 详见 docs/zh/AGENT-ASSISTANT-FUSION-PLAN.md
 *
 * 推荐迁移路径：
 * - Agent 数据应使用 `src/renderer/src/types/assistant.ts` 中的 normalizeAssistant()
 * - 新代码应使用 Redux store 中的 assistants slice
 * - 保留的功能：PromptVariable, PromptTemplate, resolveTemplateVariables()
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('VCPAgentService')

// ==================== 类型定义 ====================

/**
 * Agent 角色定义
 */
export interface VCPAgent {
  id: string
  name: string
  displayName: string
  avatar?: string
  description: string
  personality: string // 人格特质
  background: string // 背景故事
  systemPrompt: string
  greetingMessage?: string
  exampleDialogues?: string[] // 示例对话
  tags: string[]
  category: string
  isActive: boolean
  version: string
  createdAt: Date
  updatedAt: Date

  // VCP 特有配置
  vcpConfig?: {
    enableDiary?: boolean // 启用日记功能
    diaryBookName?: string // 关联的日记本
    knowledgeBaseId?: string // 关联的知识库 ID
    knowledgeBaseName?: string // 关联的知识库名称 (用于声明语法解析)
    enableMemory?: boolean // 启用长期记忆
    memoryWindowSize?: number
    enableTools?: string[] // 启用的工具列表
    contextInjections?: string[] // 上下文注入 ID
  }
}

/**
 * 提示词变量/模板
 */
export interface PromptVariable {
  id: string
  name: string // 变量名 (如 {{character_background}})
  value: string // 变量值
  description?: string
  category: string
  isSystem: boolean // 是否系统变量
  createdAt: Date
  updatedAt: Date
}

/**
 * VCP 模板变量上下文
 * 用于运行时传入的动态变量
 */
export interface VCPTemplateContext {
  /** 目标变量 (Tar*) - 如当前任务目标、用户输入等 */
  target?: Record<string, string>
  /** 会话变量 (Sar*) - 如会话ID、上下文历史等 */
  session?: Record<string, string>
  /** 自定义变量 (Var*) - 用户定义的变量 */
  custom?: Record<string, string>
  /** 日记数据 - {{AllCharacterDiariesData}} 等 */
  diary?: {
    allData?: string
    currentCharacter?: string
    entries?: string
  }
  /** 知识库数据 - [[kb_name]] 等检索结果 */
  knowledge?: Record<string, string>
}

/**
 * 提示词模板
 */
export interface PromptTemplate {
  id: string
  name: string
  content: string
  variables: string[] // 使用的变量名列表
  category: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Agent 创建请求
 */
export interface CreateAgentRequest {
  name: string
  displayName: string
  description: string
  personality: string
  background: string
  systemPrompt: string
  greetingMessage?: string
  exampleDialogues?: string[]
  tags?: string[]
  category?: string
  avatar?: string
  vcpConfig?: VCPAgent['vcpConfig']
}

// ==================== VCPAgentService ====================

export class VCPAgentService {
  private agents: Map<string, VCPAgent> = new Map()
  private variables: Map<string, PromptVariable> = new Map()
  private templates: Map<string, PromptTemplate> = new Map()
  private storagePath: string

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(app.getPath('userData'), 'Data', 'VCPAgents')
    this.ensureStorageDir()
    this.loadFromDisk()
    this.initSystemVariables()
  }

  // ==================== Agent 管理 ====================

  /**
   * 创建 Agent
   *
   * @deprecated 使用 Redux store 创建 Assistant 替代。
   * 详见 src/renderer/src/store/assistants.ts
   */
  async createAgent(request: CreateAgentRequest): Promise<VCPAgent> {
    const id = this.generateId()
    const now = new Date()

    const agent: VCPAgent = {
      id,
      name: this.sanitizeName(request.name),
      displayName: request.displayName,
      avatar: request.avatar,
      description: request.description,
      personality: request.personality,
      background: request.background,
      systemPrompt: request.systemPrompt,
      greetingMessage: request.greetingMessage,
      exampleDialogues: request.exampleDialogues,
      tags: request.tags || [],
      category: request.category || 'custom',
      isActive: true,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      vcpConfig: request.vcpConfig
    }

    this.agents.set(id, agent)
    await this.saveAgentFile(agent)
    await this.saveIndex()

    logger.info('Agent created', { id, name: agent.name })
    return agent
  }

  /**
   * 更新 Agent
   *
   * @deprecated 使用 Redux store 更新 Assistant 替代。
   */
  async updateAgent(id: string, updates: Partial<Omit<VCPAgent, 'id' | 'createdAt'>>): Promise<VCPAgent | null> {
    const agent = this.agents.get(id)
    if (!agent) return null

    Object.assign(agent, updates, { updatedAt: new Date() })

    // 版本递增
    const [major, minor, patch] = agent.version.split('.').map(Number)
    agent.version = `${major}.${minor}.${patch + 1}`

    await this.saveAgentFile(agent)
    await this.saveIndex()

    logger.info('Agent updated', { id, version: agent.version })
    return agent
  }

  /**
   * 删除 Agent
   *
   * @deprecated 使用 Redux store 删除 Assistant 替代。
   */
  async deleteAgent(id: string): Promise<boolean> {
    const agent = this.agents.get(id)
    if (!agent) return false

    // 删除文件
    const filePath = path.join(this.storagePath, 'definitions', `${agent.name}.json`)
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }

    this.agents.delete(id)
    await this.saveIndex()

    logger.info('Agent deleted', { id })
    return true
  }

  /**
   * 获取所有 Agent
   *
   * @deprecated 使用 Redux store 获取 assistants 替代。
   * 详见 src/renderer/src/store/assistants.ts
   */
  getAllAgents(): VCPAgent[] {
    return [...this.agents.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  /**
   * 按 ID 获取 Agent
   *
   * @deprecated 使用 Redux selector 获取 Assistant 替代。
   */
  getAgentById(id: string): VCPAgent | null {
    return this.agents.get(id) || null
  }

  /**
   * 按名称获取 Agent
   *
   * @deprecated 使用 Redux selector 获取 Assistant 替代。
   */
  getAgentByName(name: string): VCPAgent | null {
    return [...this.agents.values()].find((a) => a.name === name || a.displayName === name) || null
  }

  /**
   * 激活 Agent (设置为当前活跃 Agent)
   *
   * @deprecated 使用 Redux action 更新 Assistant.isActive 替代。
   */
  async activateAgent(id: string): Promise<VCPAgent | null> {
    const agent = this.agents.get(id)
    if (!agent) return null

    // 先将所有 Agent 设为非活跃
    for (const a of this.agents.values()) {
      if (a.isActive) {
        a.isActive = false
        a.updatedAt = new Date()
      }
    }

    // 激活目标 Agent
    agent.isActive = true
    agent.updatedAt = new Date()
    await this.saveIndex()

    logger.info('Agent activated', { id, name: agent.name })
    return agent
  }

  /**
   * 按分类获取 Agent
   *
   * @deprecated 使用 Redux selector 过滤 Assistant 替代。
   */
  getAgentsByCategory(category: string): VCPAgent[] {
    return [...this.agents.values()].filter((a) => a.category === category)
  }

  /**
   * 按标签获取 Agent
   *
   * @deprecated 使用 Redux selector 过滤 Assistant 替代。
   */
  getAgentsByTag(tag: string): VCPAgent[] {
    return [...this.agents.values()].filter((a) => a.tags.includes(tag))
  }

  /**
   * 获取 Agent 的完整系统提示词 (替换变量)
   */
  getAgentSystemPrompt(agentId: string): string {
    const agent = this.agents.get(agentId)
    if (!agent) return ''

    return this.resolveVariables(agent.systemPrompt)
  }

  // ==================== 变量管理 ====================

  /**
   * 创建变量
   */
  async createVariable(
    name: string,
    value: string,
    options?: { category?: string; description?: string }
  ): Promise<PromptVariable> {
    const id = this.generateId()
    const now = new Date()

    const variable: PromptVariable = {
      id,
      name: name.startsWith('{{') ? name : `{{${name}}}`,
      value,
      description: options?.description,
      category: options?.category || 'custom',
      isSystem: false,
      createdAt: now,
      updatedAt: now
    }

    this.variables.set(id, variable)
    await this.saveIndex()

    logger.info('Variable created', { id, name: variable.name })
    return variable
  }

  /**
   * 更新变量
   */
  async updateVariable(id: string, updates: { value?: string; description?: string }): Promise<PromptVariable | null> {
    const variable = this.variables.get(id)
    if (!variable || variable.isSystem) return null

    if (updates.value !== undefined) variable.value = updates.value
    if (updates.description !== undefined) variable.description = updates.description
    variable.updatedAt = new Date()

    await this.saveIndex()
    return variable
  }

  /**
   * 删除变量
   */
  async deleteVariable(id: string): Promise<boolean> {
    const variable = this.variables.get(id)
    if (!variable || variable.isSystem) return false

    this.variables.delete(id)
    await this.saveIndex()
    return true
  }

  /**
   * 获取所有变量
   */
  getAllVariables(): PromptVariable[] {
    return [...this.variables.values()]
  }

  /**
   * 解析文本中的变量 (基本版本)
   */
  resolveVariables(text: string): string {
    let result = text

    for (const variable of this.variables.values()) {
      result = result.replace(new RegExp(this.escapeRegex(variable.name), 'g'), variable.value)
    }

    return result
  }

  /**
   * VCP 模板变量解析 (增强版本)
   *
   * 支持的变量类型:
   * - {{Tar...}} - 目标变量 (如 {{TarUserInput}}, {{TarTaskGoal}})
   * - {{Var...}} - 自定义变量 (如 {{VarCharacterName}}, {{VarSetting}})
   * - {{Sar...}} - 会话变量 (如 {{SarSessionId}}, {{SarContextHistory}})
   * - {{AllCharacterDiariesData}} - 所有日记数据
   * - {{current_date}}, {{current_time}} 等系统变量
   *
   * @param text 要解析的文本
   * @param context 运行时上下文变量
   * @returns 解析后的文本
   */
  resolveTemplateVariables(text: string, context?: VCPTemplateContext): string {
    let result = text

    // 1. 解析目标变量 {{Tar...}}
    if (context?.target) {
      const tarPattern = /\{\{Tar(\w+)\}\}/g
      result = result.replace(tarPattern, (match, varName) => {
        return context.target?.[varName] ?? context.target?.[varName.toLowerCase()] ?? match
      })
    }

    // 2. 解析会话变量 {{Sar...}}
    if (context?.session) {
      const sarPattern = /\{\{Sar(\w+)\}\}/g
      result = result.replace(sarPattern, (match, varName) => {
        return context.session?.[varName] ?? context.session?.[varName.toLowerCase()] ?? match
      })
    }

    // 3. 解析自定义变量 {{Var...}}
    if (context?.custom) {
      const varPattern = /\{\{Var(\w+)\}\}/g
      result = result.replace(varPattern, (match, varName) => {
        return context.custom?.[varName] ?? context.custom?.[varName.toLowerCase()] ?? match
      })
    }

    // 4. 解析日记相关变量
    if (context?.diary) {
      if (context.diary.allData) {
        result = result.replace(/\{\{AllCharacterDiariesData\}\}/g, context.diary.allData)
      }
      if (context.diary.currentCharacter) {
        result = result.replace(/\{\{CurrentCharacterDiary\}\}/g, context.diary.currentCharacter)
      }
      if (context.diary.entries) {
        result = result.replace(/\{\{DiaryEntries\}\}/g, context.diary.entries)
      }
    }

    // 5. 解析知识库检索结果
    if (context?.knowledge) {
      for (const [kbName, content] of Object.entries(context.knowledge)) {
        // 支持 [[kb_name]] 语法的结果注入
        const pattern = new RegExp(`\\[\\[${this.escapeRegex(kbName)}\\]\\]`, 'g')
        result = result.replace(pattern, content)
        // 也支持 {{KB_kbName}} 格式
        result = result.replace(new RegExp(`\\{\\{KB_${this.escapeRegex(kbName)}\\}\\}`, 'gi'), content)
      }
    }

    // 6. 解析系统变量 (从 variables map)
    for (const variable of this.variables.values()) {
      // 对于系统变量，重新获取最新值
      if (variable.isSystem) {
        const freshValue = this.getSystemVariableValue(variable.name)
        result = result.replace(new RegExp(this.escapeRegex(variable.name), 'g'), freshValue)
      } else {
        result = result.replace(new RegExp(this.escapeRegex(variable.name), 'g'), variable.value)
      }
    }

    return result
  }

  /**
   * 获取系统变量的最新值
   */
  private getSystemVariableValue(varName: string): string {
    switch (varName) {
      case '{{current_date}}':
        return new Date().toLocaleDateString('zh-CN')
      case '{{current_time}}':
        return new Date().toLocaleTimeString('zh-CN')
      case '{{current_datetime}}':
        return new Date().toLocaleString('zh-CN')
      case '{{current_year}}':
        return String(new Date().getFullYear())
      case '{{current_month}}':
        return String(new Date().getMonth() + 1)
      case '{{current_season}}':
        return this.getCurrentSeason()
      case '{{random_greeting}}':
        return this.getRandomGreeting()
      default:
        return varName
    }
  }

  /**
   * 提取文本中使用的模板变量
   */
  extractTemplateVariables(text: string): {
    target: string[]
    session: string[]
    custom: string[]
    system: string[]
    knowledge: string[]
    other: string[]
  } {
    const result = {
      target: [] as string[],
      session: [] as string[],
      custom: [] as string[],
      system: [] as string[],
      knowledge: [] as string[],
      other: [] as string[]
    }

    // 提取 {{Tar...}}
    const tarMatches = text.match(/\{\{Tar\w+\}\}/g) || []
    result.target = [...new Set(tarMatches)]

    // 提取 {{Sar...}}
    const sarMatches = text.match(/\{\{Sar\w+\}\}/g) || []
    result.session = [...new Set(sarMatches)]

    // 提取 {{Var...}}
    const varMatches = text.match(/\{\{Var\w+\}\}/g) || []
    result.custom = [...new Set(varMatches)]

    // 提取 [[...]] 知识库引用
    const kbMatches = text.match(/\[\[[^\]]+\]\]/g) || []
    result.knowledge = [...new Set(kbMatches)]

    // 提取系统变量
    const systemPatterns = [
      '{{current_date}}',
      '{{current_time}}',
      '{{current_datetime}}',
      '{{current_year}}',
      '{{current_month}}',
      '{{current_season}}',
      '{{random_greeting}}',
      '{{AllCharacterDiariesData}}',
      '{{CurrentCharacterDiary}}',
      '{{DiaryEntries}}'
    ]
    for (const pattern of systemPatterns) {
      if (text.includes(pattern)) {
        result.system.push(pattern)
      }
    }

    // 提取其他 {{...}} 变量
    const allMatches = text.match(/\{\{[^}]+\}\}/g) || []
    for (const match of allMatches) {
      if (
        !result.target.includes(match) &&
        !result.session.includes(match) &&
        !result.custom.includes(match) &&
        !result.system.includes(match)
      ) {
        result.other.push(match)
      }
    }
    result.other = [...new Set(result.other)]

    return result
  }

  /**
   * 获取 Agent 的完整系统提示词 (带上下文解析)
   */
  getAgentSystemPromptWithContext(agentId: string, context?: VCPTemplateContext): string {
    const agent = this.agents.get(agentId)
    if (!agent) return ''

    return this.resolveTemplateVariables(agent.systemPrompt, context)
  }

  // ==================== 模板管理 ====================

  /**
   * 创建模板
   */
  async createTemplate(
    name: string,
    content: string,
    options?: { category?: string; description?: string }
  ): Promise<PromptTemplate> {
    const id = this.generateId()
    const now = new Date()

    // 提取使用的变量
    const variablePattern = /\{\{[^}]+\}\}/g
    const variables = (content.match(variablePattern) || []).map((v) => v)

    const template: PromptTemplate = {
      id,
      name,
      content,
      variables: [...new Set(variables)],
      category: options?.category || 'custom',
      description: options?.description,
      createdAt: now,
      updatedAt: now
    }

    this.templates.set(id, template)
    await this.saveIndex()

    logger.info('Template created', { id, name })
    return template
  }

  /**
   * 渲染模板
   */
  renderTemplate(templateId: string, overrides?: Record<string, string>): string {
    const template = this.templates.get(templateId)
    if (!template) return ''

    let result = template.content

    // 先用覆盖值替换
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        const varName = key.startsWith('{{') ? key : `{{${key}}}`
        result = result.replace(new RegExp(this.escapeRegex(varName), 'g'), value)
      }
    }

    // 再用默认变量替换
    return this.resolveVariables(result)
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): PromptTemplate[] {
    return [...this.templates.values()]
  }

  /**
   * 更新模板
   */
  async updateTemplate(
    id: string,
    updates: { name?: string; content?: string; description?: string; category?: string }
  ): Promise<PromptTemplate | null> {
    const template = this.templates.get(id)
    if (!template) return null

    if (updates.name !== undefined) template.name = updates.name
    if (updates.content !== undefined) {
      template.content = updates.content
      // 重新提取变量
      const variablePattern = /\{\{[^}]+\}\}/g
      template.variables = [...new Set(updates.content.match(variablePattern) || [])]
    }
    if (updates.description !== undefined) template.description = updates.description
    if (updates.category !== undefined) template.category = updates.category
    template.updatedAt = new Date()

    await this.saveIndex()
    return template
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string): Promise<boolean> {
    if (!this.templates.has(id)) return false
    this.templates.delete(id)
    await this.saveIndex()
    return true
  }

  // ==================== 导入导出 ====================

  /**
   * 导出 Agent 为 JSON
   *
   * @deprecated Agent CRUD 已废弃。导出功能保留用于 VCPToolBox 兼容。
   */
  exportAgent(agentId: string): string | null {
    const agent = this.agents.get(agentId)
    if (!agent) return null

    return JSON.stringify(agent, null, 2)
  }

  /**
   * 从 JSON 导入 Agent
   *
   * @deprecated Agent CRUD 已废弃。导入功能保留用于 VCPToolBox 兼容。
   * 建议导入后转换为 Assistant 存储到 Redux。
   */
  async importAgent(json: string): Promise<VCPAgent> {
    const data = JSON.parse(json) as VCPAgent

    // 生成新 ID
    const newAgent: VCPAgent = {
      ...data,
      id: this.generateId(),
      name: `${data.name}_imported_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.agents.set(newAgent.id, newAgent)
    await this.saveAgentFile(newAgent)
    await this.saveIndex()

    logger.info('Agent imported', { id: newAgent.id, name: newAgent.name })
    return newAgent
  }

  /**
   * 从 txt 文件导入 Agent (VCP 格式)
   *
   * @deprecated Agent CRUD 已废弃。导入功能保留用于 VCPToolBox 兼容。
   * 建议导入后转换为 Assistant 存储到 Redux。
   */
  async importFromTxt(filePath: string): Promise<VCPAgent> {
    const content = await fs.promises.readFile(filePath, 'utf8')

    // 解析 VCP Agent txt 格式
    const lines = content.split('\n')
    const parsed: Record<string, string> = {}
    let currentKey = ''
    let currentValue = ''

    for (const line of lines) {
      const match = line.match(/^##\s*(\w+)\s*:?\s*$/)
      if (match) {
        if (currentKey) {
          parsed[currentKey] = currentValue.trim()
        }
        currentKey = match[1].toLowerCase()
        currentValue = ''
      } else if (currentKey) {
        currentValue += line + '\n'
      }
    }
    if (currentKey) {
      parsed[currentKey] = currentValue.trim()
    }

    return this.createAgent({
      name: parsed.name || path.basename(filePath, '.txt'),
      displayName: parsed.displayname || parsed.name || 'Imported Agent',
      description: parsed.description || '',
      personality: parsed.personality || '',
      background: parsed.background || '',
      systemPrompt: parsed.systemprompt || parsed.prompt || content,
      greetingMessage: parsed.greeting,
      tags: parsed.tags?.split(',').map((t) => t.trim()) || [],
      category: parsed.category || 'imported'
    })
  }

  // ==================== 系统变量 ====================

  private initSystemVariables(): void {
    const systemVars: Array<{ name: string; getValue: () => string; description: string }> = [
      { name: '{{current_date}}', getValue: () => new Date().toLocaleDateString('zh-CN'), description: '当前日期' },
      { name: '{{current_time}}', getValue: () => new Date().toLocaleTimeString('zh-CN'), description: '当前时间' },
      { name: '{{current_datetime}}', getValue: () => new Date().toLocaleString('zh-CN'), description: '当前日期时间' },
      { name: '{{current_year}}', getValue: () => String(new Date().getFullYear()), description: '当前年份' },
      { name: '{{current_month}}', getValue: () => String(new Date().getMonth() + 1), description: '当前月份' },
      { name: '{{current_season}}', getValue: () => this.getCurrentSeason(), description: '当前季节' },
      { name: '{{random_greeting}}', getValue: () => this.getRandomGreeting(), description: '随机问候语' }
    ]

    for (const sv of systemVars) {
      const id = `sys_${sv.name.replace(/[{}]/g, '')}`
      this.variables.set(id, {
        id,
        name: sv.name,
        value: sv.getValue(),
        description: sv.description,
        category: 'system',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth()
    if (month >= 2 && month <= 4) return '春季'
    if (month >= 5 && month <= 7) return '夏季'
    if (month >= 8 && month <= 10) return '秋季'
    return '冬季'
  }

  private getRandomGreeting(): string {
    const greetings = ['你好！', '嗨！', '您好！', '很高兴见到你！', '有什么我能帮助你的吗？']
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // ==================== 工具方法 ====================

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex')
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private ensureStorageDir(): void {
    const dirs = [this.storagePath, path.join(this.storagePath, 'definitions')]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private async saveAgentFile(agent: VCPAgent): Promise<void> {
    const filePath = path.join(this.storagePath, 'definitions', `${agent.name}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(agent, null, 2), 'utf8')
  }

  private async saveIndex(): Promise<void> {
    const data = {
      agents: Object.fromEntries(this.agents),
      variables: Object.fromEntries([...this.variables.entries()].filter(([, v]) => !v.isSystem)),
      templates: Object.fromEntries(this.templates)
    }
    const filePath = path.join(this.storagePath, 'index.json')
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private loadFromDisk(): void {
    const filePath = path.join(this.storagePath, 'index.json')
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        if (data.agents) {
          for (const [key, value] of Object.entries(data.agents)) {
            this.agents.set(key, value as VCPAgent)
          }
        }
        if (data.variables) {
          for (const [key, value] of Object.entries(data.variables)) {
            this.variables.set(key, value as PromptVariable)
          }
        }
        if (data.templates) {
          for (const [key, value] of Object.entries(data.templates)) {
            this.templates.set(key, value as PromptTemplate)
          }
        }

        logger.info('Loaded agent data', {
          agents: this.agents.size,
          variables: this.variables.size,
          templates: this.templates.size
        })
      } catch (error) {
        logger.error('Failed to load agent data', { error: String(error) })
      }
    }
  }

  /**
   * 获取统计
   */
  getStats(): {
    agentCount: number
    variableCount: number
    templateCount: number
    categories: string[]
  } {
    const categories = [...new Set([...this.agents.values()].map((a) => a.category))]

    return {
      agentCount: this.agents.size,
      variableCount: this.variables.size,
      templateCount: this.templates.size,
      categories
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: VCPAgentService | null = null

export function getVCPAgentService(storagePath?: string): VCPAgentService {
  if (!serviceInstance) {
    serviceInstance = new VCPAgentService(storagePath)
  }
  return serviceInstance
}

export function createVCPAgentService(storagePath?: string): VCPAgentService {
  return new VCPAgentService(storagePath)
}
