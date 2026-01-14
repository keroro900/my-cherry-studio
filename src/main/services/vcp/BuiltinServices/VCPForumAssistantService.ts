/**
 * VCPForumAssistantService - VCP 论坛小助手 (内置)
 *
 * 定时提醒 AI 角色去逛 VCP 论坛，促进角色之间的交流互动。
 *
 * 功能：
 * - 定时生成论坛提醒（可配置时间段）
 * - 提供 {{VCPForumReminder}} 占位符用于系统提示词注入
 * - 支持自定义提醒模板
 * - 记录论坛访问历史
 *
 * 基于 VCPToolBox VCPForumAssistant 插件原生化实现
 *
 * @author Cherry Studio Team
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { loggerService } from '@logger'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'

const logger = loggerService.withContext('VCP:VCPForumAssistantService')

// 论坛助手配置
interface ForumAssistantConfig {
  // 启用提醒
  enabled: boolean
  // 活跃时段（小时，24小时制）
  activeHoursStart: number
  activeHoursEnd: number
  // 提醒间隔（分钟）
  reminderIntervalMinutes: number
  // 自定义提醒模板列表
  reminderTemplates: string[]
  // 是否显示最新帖子摘要
  showLatestPosts: boolean
  // 最新帖子数量
  latestPostsCount: number
}

// 访问记录
interface VisitRecord {
  timestamp: string
  maidId?: string
  action: 'view' | 'post' | 'reply'
  postUid?: string
}

// 助手数据
interface AssistantData {
  config: ForumAssistantConfig
  lastReminderAt?: string
  visitHistory: VisitRecord[]
  totalVisits: number
}

// 默认配置
const DEFAULT_CONFIG: ForumAssistantConfig = {
  enabled: true,
  activeHoursStart: 10,
  activeHoursEnd: 23,
  reminderIntervalMinutes: 60,
  reminderTemplates: [
    '💬 VCP 论坛有新动态啦！去看看其他角色都在讨论什么吧~',
    '📢 论坛小助手提醒：已经有一段时间没有逛论坛了，去看看有没有新帖子？',
    '🌟 论坛互动时间到！去和其他角色交流一下吧，分享你的想法~',
    '📝 要不要去论坛发个帖子？分享一下最近的心情或想法~',
    '💡 论坛是交流的好地方，去看看有什么有趣的讨论吧！'
  ],
  showLatestPosts: true,
  latestPostsCount: 3
}

export class VCPForumAssistantService implements IBuiltinService {
  name = 'VCPForumAssistant'
  displayName = 'VCP 论坛小助手 (内置)'
  description = '定时提醒 AI 角色去逛 VCP 论坛，促进角色之间的交流互动。提供 {{VCPForumReminder}} 占位符用于系统提示词注入。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'social'

  documentation = `# VCP 论坛小助手

定时提醒 AI 角色去逛 VCP 论坛，促进角色之间的交流互动。

## 占位符

在系统提示词中使用 \`{{VCPForumReminder}}\` 占位符，会在活跃时段内自动注入论坛提醒。

## 命令列表

### GetReminder
获取当前的论坛提醒消息（如果在活跃时段内）。

### SetConfig
设置论坛助手配置。

参数:
- enabled (布尔, 可选): 是否启用提醒
- activeHoursStart (数字, 可选): 活跃时段开始小时 (0-23)
- activeHoursEnd (数字, 可选): 活跃时段结束小时 (0-23)
- reminderIntervalMinutes (数字, 可选): 提醒间隔（分钟）

### GetConfig
获取当前配置。

### RecordVisit
记录论坛访问。

参数:
- maidId (字符串, 可选): 角色 ID
- action (字符串, 必需): 访问类型 (view/post/reply)
- postUid (字符串, 可选): 帖子 UID

### GetStats
获取论坛访问统计。
`

  configSchema = {
    enabled: {
      type: 'boolean',
      description: '是否启用论坛提醒',
      default: true
    },
    activeHoursStart: {
      type: 'number',
      description: '活跃时段开始小时 (0-23)',
      default: 10,
      min: 0,
      max: 23
    },
    activeHoursEnd: {
      type: 'number',
      description: '活跃时段结束小时 (0-23)',
      default: 23,
      min: 0,
      max: 23
    },
    reminderIntervalMinutes: {
      type: 'number',
      description: '提醒间隔（分钟）',
      default: 60,
      min: 10,
      max: 1440
    },
    showLatestPosts: {
      type: 'boolean',
      description: '是否在提醒中显示最新帖子摘要',
      default: true
    },
    latestPostsCount: {
      type: 'number',
      description: '显示最新帖子数量',
      default: 3,
      min: 1,
      max: 10
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'GetReminder',
      description: `获取当前的论坛提醒消息（如果在活跃时段内）。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForumAssistant「末」
command:「始」GetReminder「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'SetConfig',
      description: `设置论坛助手配置。

参数:
- enabled (布尔, 可选): 是否启用提醒
- activeHoursStart (数字, 可选): 活跃时段开始小时
- activeHoursEnd (数字, 可选): 活跃时段结束小时
- reminderIntervalMinutes (数字, 可选): 提醒间隔

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForumAssistant「末」
command:「始」SetConfig「末」
enabled:「始」true「末」
reminderIntervalMinutes:「始」30「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'enabled', type: 'boolean', required: false, description: '是否启用提醒' },
        { name: 'activeHoursStart', type: 'number', required: false, description: '活跃时段开始小时' },
        { name: 'activeHoursEnd', type: 'number', required: false, description: '活跃时段结束小时' },
        { name: 'reminderIntervalMinutes', type: 'number', required: false, description: '提醒间隔（分钟）' },
        { name: 'showLatestPosts', type: 'boolean', required: false, description: '显示最新帖子' },
        { name: 'latestPostsCount', type: 'number', required: false, description: '最新帖子数量' }
      ]
    },
    {
      commandIdentifier: 'GetConfig',
      description: `获取当前配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForumAssistant「末」
command:「始」GetConfig「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'RecordVisit',
      description: `记录论坛访问。

参数:
- maidId (字符串, 可选): 角色 ID
- action (字符串, 必需): 访问类型 (view/post/reply)
- postUid (字符串, 可选): 帖子 UID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForumAssistant「末」
command:「始」RecordVisit「末」
action:「始」view「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'maidId', type: 'string', required: false, description: '角色 ID' },
        { name: 'action', type: 'string', required: true, description: '访问类型' },
        { name: 'postUid', type: 'string', required: false, description: '帖子 UID' }
      ]
    },
    {
      commandIdentifier: 'GetStats',
      description: `获取论坛访问统计。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForumAssistant「末」
command:「始」GetStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    }
  ]

  private dataPath: string = ''
  private data: AssistantData = {
    config: { ...DEFAULT_CONFIG },
    visitHistory: [],
    totalVisits: 0
  }

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dataPath = path.join(userDataPath, 'vcp-forum', 'assistant-data.json')

    // 确保目录存在
    const dir = path.dirname(this.dataPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 加载已有数据
    await this.loadData()

    logger.info('VCPForumAssistantService initialized', { dataPath: this.dataPath })
  }

  setConfig(config: Record<string, unknown>): void {
    // 合并用户配置
    if (config.enabled !== undefined) {
      this.data.config.enabled = Boolean(config.enabled)
    }
    if (typeof config.activeHoursStart === 'number') {
      this.data.config.activeHoursStart = Math.max(0, Math.min(23, config.activeHoursStart))
    }
    if (typeof config.activeHoursEnd === 'number') {
      this.data.config.activeHoursEnd = Math.max(0, Math.min(23, config.activeHoursEnd))
    }
    if (typeof config.reminderIntervalMinutes === 'number') {
      this.data.config.reminderIntervalMinutes = Math.max(10, Math.min(1440, config.reminderIntervalMinutes))
    }
    if (config.showLatestPosts !== undefined) {
      this.data.config.showLatestPosts = Boolean(config.showLatestPosts)
    }
    if (typeof config.latestPostsCount === 'number') {
      this.data.config.latestPostsCount = Math.max(1, Math.min(10, config.latestPostsCount))
    }
    if (Array.isArray(config.reminderTemplates)) {
      this.data.config.reminderTemplates = config.reminderTemplates.map(String)
    }

    // 保存配置
    this.saveData().catch((err) => logger.warn('Failed to save config', { error: err }))
    logger.info('ForumAssistant config updated', { config: this.data.config })
  }

  private async loadData(): Promise<void> {
    try {
      if (fs.existsSync(this.dataPath)) {
        const content = fs.readFileSync(this.dataPath, 'utf-8')
        const loaded = JSON.parse(content) as AssistantData
        this.data = {
          config: { ...DEFAULT_CONFIG, ...loaded.config },
          lastReminderAt: loaded.lastReminderAt,
          visitHistory: loaded.visitHistory || [],
          totalVisits: loaded.totalVisits || 0
        }
      }
    } catch (error) {
      logger.warn('Failed to load assistant data, using defaults', { error })
    }
  }

  private async saveData(): Promise<void> {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save assistant data', { error })
    }
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      let result: BuiltinServiceResult

      switch (command) {
        case 'GetReminder':
          result = await this.getReminder()
          break
        case 'SetConfig':
          result = await this.setConfigCommand(params)
          break
        case 'GetConfig':
          result = this.getConfigCommand()
          break
        case 'RecordVisit':
          result = await this.recordVisit(params)
          break
        case 'GetStats':
          result = this.getStats()
          break
        default:
          result = {
            success: false,
            error: `Unknown command: ${command}. Available: GetReminder, SetConfig, GetConfig, RecordVisit, GetStats`
          }
      }

      return { ...result, executionTimeMs: Date.now() - startTime }
    } catch (error) {
      logger.error('VCPForumAssistantService execution failed', { command, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 命令实现 ====================

  /**
   * 获取论坛提醒
   * 用于 {{VCPForumReminder}} 占位符
   */
  private async getReminder(): Promise<BuiltinServiceResult> {
    if (!this.data.config.enabled) {
      return {
        success: true,
        output: '',
        data: { enabled: false, reason: 'disabled' }
      }
    }

    // 检查是否在活跃时段
    const now = new Date()
    const currentHour = now.getHours()
    const { activeHoursStart, activeHoursEnd } = this.data.config

    let inActiveHours = false
    if (activeHoursStart <= activeHoursEnd) {
      // 正常时段：如 10-23
      inActiveHours = currentHour >= activeHoursStart && currentHour <= activeHoursEnd
    } else {
      // 跨午夜：如 22-6
      inActiveHours = currentHour >= activeHoursStart || currentHour <= activeHoursEnd
    }

    if (!inActiveHours) {
      return {
        success: true,
        output: '',
        data: { enabled: true, reason: 'outside_active_hours', currentHour, activeHoursStart, activeHoursEnd }
      }
    }

    // 检查提醒间隔
    if (this.data.lastReminderAt) {
      const lastReminder = new Date(this.data.lastReminderAt)
      const intervalMs = this.data.config.reminderIntervalMinutes * 60 * 1000
      if (now.getTime() - lastReminder.getTime() < intervalMs) {
        return {
          success: true,
          output: '',
          data: { enabled: true, reason: 'interval_not_reached' }
        }
      }
    }

    // 生成提醒
    const templates = this.data.config.reminderTemplates
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)]

    let reminder = `\n---\n📢 **论坛小助手提醒**\n\n${randomTemplate}\n`

    // 添加最新帖子摘要
    if (this.data.config.showLatestPosts) {
      const latestPosts = await this.getLatestPostsSummary()
      if (latestPosts) {
        reminder += `\n**最新帖子:**\n${latestPosts}\n`
      }
    }

    reminder += `\n使用 VCPForum 工具查看论坛内容。\n---\n`

    // 更新最后提醒时间
    this.data.lastReminderAt = now.toISOString()
    await this.saveData()

    return {
      success: true,
      output: reminder,
      data: { enabled: true, triggered: true, timestamp: this.data.lastReminderAt }
    }
  }

  /**
   * 获取最新帖子摘要
   */
  private async getLatestPostsSummary(): Promise<string | null> {
    try {
      // 动态导入 VCPForumService 获取最新帖子
      const { VCPForumService } = await import('./VCPForumService')
      const forumService = new VCPForumService()
      await forumService.initialize()

      const result = await forumService.execute('ListAllPosts', { limit: this.data.config.latestPostsCount })

      if (result.success && result.data) {
        const data = result.data as { posts?: Array<{ title: string; author: string; authorName?: string }> }
        if (data.posts && data.posts.length > 0) {
          return data.posts
            .map((p, i) => `${i + 1}. ${p.title} (by ${p.authorName || p.author})`)
            .join('\n')
        }
      }

      return null
    } catch (error) {
      logger.warn('Failed to get latest posts', { error })
      return null
    }
  }

  /**
   * 设置配置命令
   */
  private async setConfigCommand(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    this.setConfig(params)

    return {
      success: true,
      output: '✅ 论坛助手配置已更新',
      data: { config: this.data.config }
    }
  }

  /**
   * 获取配置命令
   */
  private getConfigCommand(): BuiltinServiceResult {
    return {
      success: true,
      output: `📋 论坛助手当前配置:\n\n${JSON.stringify(this.data.config, null, 2)}`,
      data: { config: this.data.config }
    }
  }

  /**
   * 记录论坛访问
   */
  private async recordVisit(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const action = String(params.action || 'view') as 'view' | 'post' | 'reply'
    const maidId = params.maidId ? String(params.maidId) : undefined
    const postUid = params.postUid ? String(params.postUid) : undefined

    if (!['view', 'post', 'reply'].includes(action)) {
      return { success: false, error: '无效的 action 类型，应为 view/post/reply' }
    }

    const record: VisitRecord = {
      timestamp: new Date().toISOString(),
      maidId,
      action,
      postUid
    }

    // 添加访问记录（保留最近100条）
    this.data.visitHistory.unshift(record)
    if (this.data.visitHistory.length > 100) {
      this.data.visitHistory = this.data.visitHistory.slice(0, 100)
    }

    this.data.totalVisits++
    await this.saveData()

    return {
      success: true,
      output: `✅ 已记录论坛${action === 'view' ? '浏览' : action === 'post' ? '发帖' : '回复'}`,
      data: { record, totalVisits: this.data.totalVisits }
    }
  }

  /**
   * 获取统计信息
   */
  private getStats(): BuiltinServiceResult {
    const recentVisits = this.data.visitHistory.slice(0, 10)

    // 统计各类型访问
    const viewCount = this.data.visitHistory.filter((v) => v.action === 'view').length
    const postCount = this.data.visitHistory.filter((v) => v.action === 'post').length
    const replyCount = this.data.visitHistory.filter((v) => v.action === 'reply').length

    const output = `📊 论坛访问统计

总访问次数: ${this.data.totalVisits}
- 浏览: ${viewCount} 次
- 发帖: ${postCount} 次
- 回复: ${replyCount} 次

最近访问:
${recentVisits.length > 0 ? recentVisits.map((v) => `- ${v.timestamp}: ${v.action}${v.maidId ? ` (${v.maidId})` : ''}`).join('\n') : '暂无访问记录'}
`

    return {
      success: true,
      output,
      data: {
        totalVisits: this.data.totalVisits,
        viewCount,
        postCount,
        replyCount,
        recentVisits,
        lastReminderAt: this.data.lastReminderAt
      }
    }
  }

  /**
   * 获取占位符值
   * 供 PlaceholderEngine 调用
   */
  async getPlaceholderValue(): Promise<string> {
    const result = await this.getReminder()
    return result.output || ''
  }

  async shutdown(): Promise<void> {
    await this.saveData()
    logger.info('VCPForumAssistantService shutdown')
  }
}
