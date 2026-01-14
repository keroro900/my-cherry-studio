/**
 * TimelineGeneratorService - 全自动 Timeline 总结生成器 (内置)
 *
 * 自动监控日记文件夹，将新日记总结为时间线事件，并增量更新到角色的 Timeline 文件中。
 *
 * 功能：
 * - 监控日记变化，检测新增内容
 * - 使用 AI 自动生成日记摘要
 * - 将摘要转换为时间线事件
 * - 增量更新角色 Timeline 文件
 * - 支持自定义摘要 prompt 和模型
 *
 * 基于 VCPToolBox TimelineGenerator 插件原生化实现
 *
 * @author Cherry Studio Team
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { loggerService } from '@logger'

import { getPluginModelService } from '../PluginModelService'
import type { PluginModelConfig } from '../types'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService, ModelCallRequest, ModelCallResult } from './types'

const logger = loggerService.withContext('VCP:TimelineGeneratorService')

// 时间线事件
interface TimelineEvent {
  id: string
  date: string
  title: string
  content: string
  category: string
  sourceType: 'diary' | 'manual' | 'auto'
  sourcePath?: string
  createdAt: string
  tags?: string[]
}

// 角色时间线
interface CharacterTimeline {
  characterId: string
  characterName: string
  events: TimelineEvent[]
  lastUpdated: string
}

// 日记处理记录
interface ProcessedDiary {
  path: string
  hash: string // 内容哈希，用于检测变化
  processedAt: string
  eventId?: string
}

// 服务配置
interface TimelineConfig {
  // 是否启用自动处理
  enabled: boolean
  // 摘要系统提示词
  summarySystemPrompt: string
  // 摘要最大 tokens
  summaryMaxTokens: number
  // 最大处理队列
  maxSummaryQueue: number
  // 最小内容长度（字符）
  minContentLength: number
  // 最大重试次数
  maxRetryAttempts: number
  // 自动分类
  autoCategories: string[]
}

// 服务数据
interface TimelineData {
  config: TimelineConfig
  timelines: Map<string, CharacterTimeline>
  processedDiaries: ProcessedDiary[]
  pendingQueue: Array<{ path: string; characterId: string; content: string }>
}

// 默认配置
const DEFAULT_CONFIG: TimelineConfig = {
  enabled: true,
  summarySystemPrompt: `你是一个专业的日记摘要助手。请将以下日记内容总结为一个简洁的时间线事件。

要求：
1. 提取日记的核心事件和情感
2. 生成一个简短的标题（10-20字）
3. 生成一段摘要（50-100字）
4. 识别适当的分类标签

请以 JSON 格式返回：
{
  "title": "事件标题",
  "summary": "事件摘要",
  "category": "分类（如：日常、工作、学习、情感、旅行等）",
  "tags": ["标签1", "标签2"]
}`,
  summaryMaxTokens: 500,
  maxSummaryQueue: 10,
  minContentLength: 50,
  maxRetryAttempts: 3,
  autoCategories: ['日常', '工作', '学习', '情感', '旅行', '社交', '创作', '其他']
}

export class TimelineGeneratorService implements IBuiltinService {
  name = 'TimelineGenerator'
  displayName = '全自动 Timeline 总结生成器 (内置)'
  description = '自动监控日记文件夹，将新日记总结为时间线事件，并增量更新到角色的 Timeline 文件中。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'diary'

  // 支持模型绑定
  supportsModel = true
  modelConfig?: PluginModelConfig

  documentation = `# 全自动 Timeline 总结生成器

自动将日记内容总结为时间线事件，帮助 AI 角色建立长期记忆。

## 工作流程

1. 监控日记变化（新增或修改）
2. 使用 AI 生成日记摘要
3. 将摘要转换为时间线事件
4. 保存到角色的 Timeline 文件

## 命令列表

### GenerateSummary
手动为指定日记内容生成摘要。

参数:
- content (字符串, 必需): 日记内容
- characterId (字符串, 可选): 角色 ID

### AddEvent
手动添加时间线事件。

参数:
- characterId (字符串, 必需): 角色 ID
- date (字符串, 必需): 事件日期 (YYYY-MM-DD)
- title (字符串, 必需): 事件标题
- content (字符串, 必需): 事件内容
- category (字符串, 可选): 分类
- tags (数组, 可选): 标签

### GetTimeline
获取角色的时间线。

参数:
- characterId (字符串, 必需): 角色 ID
- startDate (字符串, 可选): 开始日期
- endDate (字符串, 可选): 结束日期
- limit (数字, 可选): 最大数量

### ProcessDiary
处理日记内容并添加到时间线。

参数:
- characterId (字符串, 必需): 角色 ID
- content (字符串, 必需): 日记内容
- date (字符串, 可选): 日记日期

### SetConfig
设置服务配置。

### GetConfig
获取当前配置。

### GetStats
获取统计信息。
`

  configSchema = {
    enabled: {
      type: 'boolean',
      description: '是否启用自动处理',
      default: true
    },
    summarySystemPrompt: {
      type: 'string',
      description: '摘要生成的系统提示词',
      default: DEFAULT_CONFIG.summarySystemPrompt
    },
    summaryMaxTokens: {
      type: 'number',
      description: '摘要最大 tokens',
      default: 500,
      min: 100,
      max: 2000
    },
    minContentLength: {
      type: 'number',
      description: '最小内容长度（字符）',
      default: 50,
      min: 10,
      max: 500
    },
    maxRetryAttempts: {
      type: 'number',
      description: '最大重试次数',
      default: 3,
      min: 1,
      max: 10
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'GenerateSummary',
      description: `为日记内容生成摘要。

参数:
- content (字符串, 必需): 日记内容
- characterId (字符串, 可选): 角色 ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」GenerateSummary「末」
content:「始」日记内容...「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'content', type: 'string', required: true, description: '日记内容' },
        { name: 'characterId', type: 'string', required: false, description: '角色 ID' }
      ]
    },
    {
      commandIdentifier: 'AddEvent',
      description: `手动添加时间线事件。

参数:
- characterId (字符串, 必需): 角色 ID
- date (字符串, 必需): 事件日期
- title (字符串, 必需): 事件标题
- content (字符串, 必需): 事件内容
- category (字符串, 可选): 分类
- tags (数组, 可选): 标签

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」AddEvent「末」
characterId:「始」角色ID「末」
date:「始」2024-01-01「末」
title:「始」事件标题「末」
content:「始」事件内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'characterId', type: 'string', required: true, description: '角色 ID' },
        { name: 'date', type: 'string', required: true, description: '事件日期' },
        { name: 'title', type: 'string', required: true, description: '事件标题' },
        { name: 'content', type: 'string', required: true, description: '事件内容' },
        { name: 'category', type: 'string', required: false, description: '分类', default: '其他' },
        { name: 'tags', type: 'array', required: false, description: '标签' }
      ]
    },
    {
      commandIdentifier: 'GetTimeline',
      description: `获取角色的时间线。

参数:
- characterId (字符串, 必需): 角色 ID
- startDate (字符串, 可选): 开始日期
- endDate (字符串, 可选): 结束日期
- limit (数字, 可选): 最大数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」GetTimeline「末」
characterId:「始」角色ID「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'characterId', type: 'string', required: true, description: '角色 ID' },
        { name: 'startDate', type: 'string', required: false, description: '开始日期' },
        { name: 'endDate', type: 'string', required: false, description: '结束日期' },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 50 }
      ]
    },
    {
      commandIdentifier: 'ProcessDiary',
      description: `处理日记内容并添加到时间线。

参数:
- characterId (字符串, 必需): 角色 ID
- content (字符串, 必需): 日记内容
- date (字符串, 可选): 日记日期

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」ProcessDiary「末」
characterId:「始」角色ID「末」
content:「始」日记内容...「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'characterId', type: 'string', required: true, description: '角色 ID' },
        { name: 'content', type: 'string', required: true, description: '日记内容' },
        { name: 'date', type: 'string', required: false, description: '日记日期' }
      ]
    },
    {
      commandIdentifier: 'SetConfig',
      description: `设置服务配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」SetConfig「末」
enabled:「始」true「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'enabled', type: 'boolean', required: false, description: '是否启用' },
        { name: 'summaryMaxTokens', type: 'number', required: false, description: '摘要最大 tokens' },
        { name: 'minContentLength', type: 'number', required: false, description: '最小内容长度' }
      ]
    },
    {
      commandIdentifier: 'GetConfig',
      description: `获取当前配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」GetConfig「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetStats',
      description: `获取统计信息。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」GetStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'DeleteEvent',
      description: `删除时间线事件。

参数:
- characterId (字符串, 必需): 角色 ID
- eventId (字符串, 必需): 事件 ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」TimelineGenerator「末」
command:「始」DeleteEvent「末」
characterId:「始」角色ID「末」
eventId:「始」事件ID「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'characterId', type: 'string', required: true, description: '角色 ID' },
        { name: 'eventId', type: 'string', required: true, description: '事件 ID' }
      ]
    }
  ]

  private dataDir: string = ''
  private data: TimelineData = {
    config: { ...DEFAULT_CONFIG },
    timelines: new Map(),
    processedDiaries: [],
    pendingQueue: []
  }

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dataDir = path.join(userDataPath, 'vcp-timeline')

    // 确保目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }

    // 加载配置
    await this.loadConfig()

    // 加载所有时间线
    await this.loadAllTimelines()

    logger.info('TimelineGeneratorService initialized', { dataDir: this.dataDir })
  }

  setConfig(config: Record<string, unknown>): void {
    if (config.enabled !== undefined) {
      this.data.config.enabled = Boolean(config.enabled)
    }
    if (typeof config.summarySystemPrompt === 'string') {
      this.data.config.summarySystemPrompt = config.summarySystemPrompt
    }
    if (typeof config.summaryMaxTokens === 'number') {
      this.data.config.summaryMaxTokens = Math.max(100, Math.min(2000, config.summaryMaxTokens))
    }
    if (typeof config.minContentLength === 'number') {
      this.data.config.minContentLength = Math.max(10, Math.min(500, config.minContentLength))
    }
    if (typeof config.maxRetryAttempts === 'number') {
      this.data.config.maxRetryAttempts = Math.max(1, Math.min(10, config.maxRetryAttempts))
    }
    if (typeof config.maxSummaryQueue === 'number') {
      this.data.config.maxSummaryQueue = Math.max(1, Math.min(50, config.maxSummaryQueue))
    }
    if (Array.isArray(config.autoCategories)) {
      this.data.config.autoCategories = config.autoCategories.map(String)
    }

    this.saveConfig().catch((err) => logger.warn('Failed to save config', { error: err }))
    logger.info('TimelineGenerator config updated', { config: this.data.config })
  }

  setModelConfig(modelConfig: PluginModelConfig): void {
    this.modelConfig = modelConfig
    logger.info('TimelineGenerator model config set', { modelConfig })
  }

  async callModel(request: ModelCallRequest): Promise<ModelCallResult> {
    if (!this.modelConfig || !this.modelConfig.enabled) {
      return {
        success: false,
        error: 'Model binding not enabled for TimelineGenerator'
      }
    }

    const modelService = getPluginModelService()
    return modelService.callModel(this.modelConfig, request)
  }

  private async loadConfig(): Promise<void> {
    const configPath = path.join(this.dataDir, 'config.json')
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        const loaded = JSON.parse(content)
        this.data.config = { ...DEFAULT_CONFIG, ...loaded }
      }
    } catch (error) {
      logger.warn('Failed to load timeline config', { error })
    }
  }

  private async saveConfig(): Promise<void> {
    const configPath = path.join(this.dataDir, 'config.json')
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.data.config, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save timeline config', { error })
    }
  }

  private async loadAllTimelines(): Promise<void> {
    try {
      const files = fs.readdirSync(this.dataDir)
      for (const file of files) {
        if (file.startsWith('timeline_') && file.endsWith('.json')) {
          const filePath = path.join(this.dataDir, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          const timeline = JSON.parse(content) as CharacterTimeline
          this.data.timelines.set(timeline.characterId, timeline)
        }
      }
      logger.debug('Loaded timelines', { count: this.data.timelines.size })
    } catch (error) {
      logger.warn('Failed to load timelines', { error })
    }
  }

  private async saveTimeline(characterId: string): Promise<void> {
    const timeline = this.data.timelines.get(characterId)
    if (!timeline) return

    const filePath = path.join(this.dataDir, `timeline_${characterId}.json`)
    try {
      timeline.lastUpdated = new Date().toISOString()
      fs.writeFileSync(filePath, JSON.stringify(timeline, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save timeline', { characterId, error })
    }
  }

  private getOrCreateTimeline(characterId: string, characterName?: string): CharacterTimeline {
    let timeline = this.data.timelines.get(characterId)
    if (!timeline) {
      timeline = {
        characterId,
        characterName: characterName || characterId,
        events: [],
        lastUpdated: new Date().toISOString()
      }
      this.data.timelines.set(characterId, timeline)
    }
    return timeline
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      let result: BuiltinServiceResult

      switch (command) {
        case 'GenerateSummary':
          result = await this.generateSummary(params)
          break
        case 'AddEvent':
          result = await this.addEvent(params)
          break
        case 'GetTimeline':
          result = await this.getTimeline(params)
          break
        case 'ProcessDiary':
          result = await this.processDiary(params)
          break
        case 'SetConfig':
          result = await this.setConfigCommand(params)
          break
        case 'GetConfig':
          result = this.getConfigCommand()
          break
        case 'GetStats':
          result = this.getStats()
          break
        case 'DeleteEvent':
          result = await this.deleteEvent(params)
          break
        default:
          result = {
            success: false,
            error: `Unknown command: ${command}. Available: GenerateSummary, AddEvent, GetTimeline, ProcessDiary, SetConfig, GetConfig, GetStats, DeleteEvent`
          }
      }

      return { ...result, executionTimeMs: Date.now() - startTime }
    } catch (error) {
      logger.error('TimelineGeneratorService execution failed', { command, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 命令实现 ====================

  /**
   * 生成日记摘要
   */
  private async generateSummary(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const content = String(params.content || '')

    if (!content || content.length < this.data.config.minContentLength) {
      return {
        success: false,
        error: `内容长度不足，需要至少 ${this.data.config.minContentLength} 个字符`
      }
    }

    // 检查是否有模型绑定
    if (!this.modelConfig || !this.modelConfig.enabled) {
      // 如果没有模型绑定，返回简单摘要
      const title = content.slice(0, 20) + (content.length > 20 ? '...' : '')
      const summary = content.slice(0, 100) + (content.length > 100 ? '...' : '')

      return {
        success: true,
        output: `📝 简单摘要生成（未绑定 AI 模型）\n\n标题: ${title}\n摘要: ${summary}`,
        data: {
          title,
          summary,
          category: '其他',
          tags: [],
          aiGenerated: false
        }
      }
    }

    // 使用 AI 生成摘要
    try {
      const result = await this.callModel({
        userMessage: content,
        systemPrompt: this.data.config.summarySystemPrompt,
        maxTokens: this.data.config.summaryMaxTokens
      })

      if (!result.success || !result.content) {
        throw new Error(result.error || 'AI 生成失败')
      }

      // 解析 AI 响应
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          success: true,
          output: `📝 AI 摘要生成成功\n\n标题: ${parsed.title}\n分类: ${parsed.category}\n摘要: ${parsed.summary}\n标签: ${(parsed.tags || []).join(', ')}`,
          data: {
            title: parsed.title || '无标题',
            summary: parsed.summary || content.slice(0, 100),
            category: parsed.category || '其他',
            tags: parsed.tags || [],
            aiGenerated: true,
            usage: result.usage
          }
        }
      }

      // 如果无法解析 JSON，使用原始响应
      return {
        success: true,
        output: `📝 AI 摘要:\n\n${result.content}`,
        data: {
          title: content.slice(0, 20),
          summary: result.content,
          category: '其他',
          tags: [],
          aiGenerated: true,
          usage: result.usage
        }
      }
    } catch (error) {
      logger.warn('AI summary generation failed', { error })
      return {
        success: false,
        error: `AI 摘要生成失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 添加时间线事件
   */
  private async addEvent(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const characterId = String(params.characterId || '')
    const date = String(params.date || new Date().toISOString().split('T')[0])
    const title = String(params.title || '')
    const content = String(params.content || '')
    const category = String(params.category || '其他')
    const tags = Array.isArray(params.tags) ? params.tags.map(String) : []

    if (!characterId || !title || !content) {
      return { success: false, error: '缺少必需参数: characterId, title, content' }
    }

    const timeline = this.getOrCreateTimeline(characterId)

    const event: TimelineEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date,
      title,
      content,
      category,
      sourceType: 'manual',
      createdAt: new Date().toISOString(),
      tags
    }

    timeline.events.push(event)

    // 按日期排序
    timeline.events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    await this.saveTimeline(characterId)

    return {
      success: true,
      output: `✅ 时间线事件已添加\n\n事件 ID: ${event.id}\n日期: ${date}\n标题: ${title}`,
      data: { event }
    }
  }

  /**
   * 获取时间线
   */
  private async getTimeline(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const characterId = String(params.characterId || '')
    const startDate = params.startDate ? String(params.startDate) : undefined
    const endDate = params.endDate ? String(params.endDate) : undefined
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50))

    if (!characterId) {
      return { success: false, error: '缺少 characterId 参数' }
    }

    const timeline = this.data.timelines.get(characterId)

    if (!timeline || timeline.events.length === 0) {
      return {
        success: true,
        output: `📅 ${characterId} 的时间线为空`,
        data: { characterId, events: [], total: 0 }
      }
    }

    let events = [...timeline.events]

    // 日期筛选
    if (startDate) {
      events = events.filter((e) => e.date >= startDate)
    }
    if (endDate) {
      events = events.filter((e) => e.date <= endDate)
    }

    // 限制数量
    events = events.slice(0, limit)

    // 格式化输出
    let output = `📅 ${timeline.characterName || characterId} 的时间线\n\n`
    output += `共 ${timeline.events.length} 个事件${startDate || endDate ? '（已筛选）' : ''}\n\n`

    for (const event of events) {
      output += `---\n`
      output += `**${event.date}** [${event.category}]\n`
      output += `### ${event.title}\n`
      output += `${event.content}\n`
      if (event.tags && event.tags.length > 0) {
        output += `🏷️ ${event.tags.join(', ')}\n`
      }
      output += '\n'
    }

    return {
      success: true,
      output,
      data: {
        characterId,
        characterName: timeline.characterName,
        events,
        total: timeline.events.length,
        filtered: events.length
      }
    }
  }

  /**
   * 处理日记并添加到时间线
   */
  private async processDiary(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const characterId = String(params.characterId || '')
    const content = String(params.content || '')
    const date = params.date ? String(params.date) : new Date().toISOString().split('T')[0]

    if (!characterId || !content) {
      return { success: false, error: '缺少必需参数: characterId, content' }
    }

    if (content.length < this.data.config.minContentLength) {
      return {
        success: false,
        error: `内容长度不足，需要至少 ${this.data.config.minContentLength} 个字符`
      }
    }

    // 生成摘要
    const summaryResult = await this.generateSummary({ content, characterId })

    if (!summaryResult.success || !summaryResult.data) {
      return {
        success: false,
        error: `摘要生成失败: ${summaryResult.error}`
      }
    }

    const summaryData = summaryResult.data as {
      title: string
      summary: string
      category: string
      tags: string[]
    }

    // 添加到时间线
    const addResult = await this.addEvent({
      characterId,
      date,
      title: summaryData.title,
      content: summaryData.summary,
      category: summaryData.category,
      tags: summaryData.tags
    })

    if (!addResult.success) {
      return addResult
    }

    return {
      success: true,
      output: `✅ 日记已处理并添加到时间线\n\n${summaryResult.output}\n\n${addResult.output}`,
      data: {
        summary: summaryData,
        event: (addResult.data as { event: TimelineEvent }).event
      }
    }
  }

  /**
   * 删除事件
   */
  private async deleteEvent(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const characterId = String(params.characterId || '')
    const eventId = String(params.eventId || '')

    if (!characterId || !eventId) {
      return { success: false, error: '缺少必需参数: characterId, eventId' }
    }

    const timeline = this.data.timelines.get(characterId)
    if (!timeline) {
      return { success: false, error: `角色 ${characterId} 的时间线不存在` }
    }

    const index = timeline.events.findIndex((e) => e.id === eventId)
    if (index === -1) {
      return { success: false, error: `事件 ${eventId} 不存在` }
    }

    const deleted = timeline.events.splice(index, 1)[0]
    await this.saveTimeline(characterId)

    return {
      success: true,
      output: `✅ 事件已删除: ${deleted.title}`,
      data: { deleted }
    }
  }

  /**
   * 设置配置命令
   */
  private async setConfigCommand(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    this.setConfig(params)

    return {
      success: true,
      output: '✅ Timeline 生成器配置已更新',
      data: { config: this.data.config }
    }
  }

  /**
   * 获取配置命令
   */
  private getConfigCommand(): BuiltinServiceResult {
    return {
      success: true,
      output: `📋 Timeline 生成器当前配置:\n\n${JSON.stringify(this.data.config, null, 2)}`,
      data: { config: this.data.config }
    }
  }

  /**
   * 获取统计
   */
  private getStats(): BuiltinServiceResult {
    let totalEvents = 0
    const characterStats: Array<{ id: string; name: string; eventCount: number }> = []

    for (const [id, timeline] of this.data.timelines) {
      totalEvents += timeline.events.length
      characterStats.push({
        id,
        name: timeline.characterName,
        eventCount: timeline.events.length
      })
    }

    const output = `📊 Timeline 生成器统计

角色数量: ${this.data.timelines.size}
总事件数: ${totalEvents}
待处理队列: ${this.data.pendingQueue.length}

各角色事件数:
${characterStats.map((s) => `- ${s.name}: ${s.eventCount} 个事件`).join('\n')}

配置:
- 启用: ${this.data.config.enabled ? '是' : '否'}
- 模型绑定: ${this.modelConfig?.enabled ? '是' : '否'}
`

    return {
      success: true,
      output,
      data: {
        characterCount: this.data.timelines.size,
        totalEvents,
        pendingQueueSize: this.data.pendingQueue.length,
        characterStats,
        modelEnabled: this.modelConfig?.enabled || false
      }
    }
  }

  async shutdown(): Promise<void> {
    // 保存所有时间线
    for (const characterId of this.data.timelines.keys()) {
      await this.saveTimeline(characterId)
    }
    await this.saveConfig()
    logger.info('TimelineGeneratorService shutdown')
  }
}
