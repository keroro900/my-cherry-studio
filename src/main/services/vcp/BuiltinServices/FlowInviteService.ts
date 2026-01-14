/**
 * FlowInvite 内置服务
 *
 * AI 自我心跳驱动总线 - 实现 AI 的主观能动性：
 * - AI 可以设定一个自定义提示词，以指定时间间隔不断触发自己
 * - 支持动态调整心跳间隔和提示词
 * - 支持条件触发和上下文携带
 * - 实现 AI 的自主行动能力
 *
 * 使用场景:
 * - AI 定期检查任务进度
 * - AI 主动监控系统状态
 * - AI 按计划执行重复性工作
 * - AI 维护自我状态和记忆
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { BrowserWindow } from 'electron'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:FlowInvite')

// ==================== 类型定义 ====================

/**
 * 心跳配置
 */
interface HeartbeatConfig {
  id: string
  name: string
  prompt: string
  intervalMs: number
  enabled: boolean
  createdAt: number
  lastTriggeredAt?: number
  triggerCount: number
  context?: Record<string, unknown>
  condition?: string // 可选的触发条件表达式
  maxTriggers?: number // 最大触发次数，0=无限
}

/**
 * 心跳执行结果
 */
interface HeartbeatResult {
  heartbeatId: string
  triggeredAt: number
  success: boolean
  response?: string
  error?: string
}

// ==================== FlowInviteService 实现 ====================

export class FlowInviteService implements IBuiltinService {
  name = 'FlowInvite'
  displayName = '自我心跳总线 (内置)'
  description =
    'AI 自我心跳驱动总线：让 AI 可以设定自定义提示词和时间间隔来触发自己，实现主观能动性和自主行动能力。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'meta'

  private heartbeats: Map<string, HeartbeatConfig> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private results: HeartbeatResult[] = []
  private maxResultsHistory = 100

  configSchema = {
    defaultIntervalMs: {
      type: 'number',
      default: 60000,
      description: '默认心跳间隔 (毫秒)'
    },
    minIntervalMs: {
      type: 'number',
      default: 10000,
      description: '最小心跳间隔 (毫秒)'
    },
    maxHeartbeats: {
      type: 'number',
      default: 10,
      description: '最大同时运行的心跳数'
    }
  }

  documentation = `# 自我心跳总线服务

让 AI 能够自主触发自己，实现主观能动性。

## 核心概念

FlowInvite 允许 AI 设置一个"心跳"，以固定间隔向自己发送消息，从而实现：
- 定期自我检查
- 主动任务推进
- 状态监控
- 计划执行

## 命令

### Start
启动一个新的心跳。

### Stop
停止指定的心跳。

### Adjust
调整心跳的间隔或提示词。

### List
列出所有活跃的心跳。

### GetHistory
获取心跳触发历史。

## 使用示例

AI 可以这样启动一个心跳来监控自己的任务：

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」Start「末」
name:「始」任务监控「末」
prompt:「始」检查当前任务进度，如果有待处理的事项请提醒用户「末」
intervalMs:「始」300000「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`
`

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'Start',
      description: `启动一个新的心跳。

参数:
- name (字符串, 必需): 心跳名称
- prompt (字符串, 必需): 触发时发送给 AI 的提示词
- intervalMs (数字, 可选): 心跳间隔毫秒数，默认 60000
- context (JSON, 可选): 携带的上下文数据
- condition (字符串, 可选): 触发条件表达式
- maxTriggers (数字, 可选): 最大触发次数，0=无限

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」Start「末」
name:「始」定期自检「末」
prompt:「始」现在是自检时间，请检查：1. 待办事项 2. 系统状态 3. 用户消息「末」
intervalMs:「始」60000「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'name', description: '心跳名称', required: true, type: 'string' },
        { name: 'prompt', description: '触发提示词', required: true, type: 'string' },
        { name: 'intervalMs', description: '间隔毫秒数', required: false, type: 'number' },
        { name: 'context', description: '上下文数据', required: false, type: 'string' },
        { name: 'condition', description: '触发条件', required: false, type: 'string' },
        { name: 'maxTriggers', description: '最大触发次数', required: false, type: 'number' }
      ]
    },
    {
      commandIdentifier: 'Stop',
      description: `停止指定的心跳。

参数:
- id (字符串, 可选): 心跳 ID
- name (字符串, 可选): 心跳名称 (如果不提供 ID)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」Stop「末」
name:「始」定期自检「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'id', description: '心跳 ID', required: false, type: 'string' },
        { name: 'name', description: '心跳名称', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Adjust',
      description: `调整心跳配置。

参数:
- id (字符串, 必需): 心跳 ID
- intervalMs (数字, 可选): 新的间隔
- prompt (字符串, 可选): 新的提示词
- enabled (布尔, 可选): 是否启用

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」Adjust「末」
id:「始」hb_xxx「末」
intervalMs:「始」120000「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'id', description: '心跳 ID', required: true, type: 'string' },
        { name: 'intervalMs', description: '新间隔', required: false, type: 'number' },
        { name: 'prompt', description: '新提示词', required: false, type: 'string' },
        { name: 'enabled', description: '是否启用', required: false, type: 'boolean' }
      ]
    },
    {
      commandIdentifier: 'List',
      description: `列出所有心跳。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」List「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetHistory',
      description: `获取心跳触发历史。

参数:
- id (字符串, 可选): 特定心跳的历史
- limit (数字, 可选): 返回数量，默认 10

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」GetHistory「末」
limit:「始」20「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'id', description: '心跳 ID', required: false, type: 'string' },
        { name: 'limit', description: '返回数量', required: false, type: 'number' }
      ]
    },
    {
      commandIdentifier: 'StopAll',
      description: `停止所有心跳。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」FlowInvite「末」
command:「始」StopAll「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    }
  ]

  async initialize(): Promise<void> {
    logger.info('FlowInviteService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'Start':
          return await this.startHeartbeat(params)

        case 'Stop':
          return await this.stopHeartbeat(params)

        case 'Adjust':
          return await this.adjustHeartbeat(params)

        case 'List':
          return await this.listHeartbeats()

        case 'GetHistory':
          return await this.getHistory(params)

        case 'StopAll':
          return await this.stopAllHeartbeats()

        default:
          return { success: false, error: `Unknown command: ${command}` }
      }
    } catch (error) {
      logger.error('FlowInvite command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 启动心跳
   */
  private async startHeartbeat(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const name = String(params.name || '').trim()
    const prompt = String(params.prompt || '').trim()

    if (!name || !prompt) {
      return { success: false, error: '需要 name 和 prompt 参数' }
    }

    // 检查数量限制
    if (this.heartbeats.size >= 10) {
      return { success: false, error: '已达到最大心跳数量限制 (10)' }
    }

    // 检查名称是否重复
    for (const hb of this.heartbeats.values()) {
      if (hb.name === name) {
        return { success: false, error: `心跳 "${name}" 已存在` }
      }
    }

    const intervalMs = Math.max(10000, Number(params.intervalMs) || 60000)
    const maxTriggers = Number(params.maxTriggers) || 0

    let context: Record<string, unknown> | undefined
    if (params.context) {
      try {
        context = typeof params.context === 'string' ? JSON.parse(params.context) : params.context
      } catch {
        context = undefined
      }
    }

    const id = `hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    const config: HeartbeatConfig = {
      id,
      name,
      prompt,
      intervalMs,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
      context,
      condition: params.condition ? String(params.condition) : undefined,
      maxTriggers
    }

    this.heartbeats.set(id, config)
    this.startTimer(config)

    logger.info('Heartbeat started', { id, name, intervalMs })

    return {
      success: true,
      output: `心跳 "${name}" 已启动！
ID: ${id}
间隔: ${intervalMs}ms (${(intervalMs / 1000).toFixed(1)}秒)
${maxTriggers > 0 ? `最大触发次数: ${maxTriggers}` : ''}`,
      data: { id, name, intervalMs, enabled: true }
    }
  }

  /**
   * 停止心跳
   */
  private async stopHeartbeat(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    let config: HeartbeatConfig | undefined

    if (params.id) {
      config = this.heartbeats.get(String(params.id))
    } else if (params.name) {
      const name = String(params.name)
      for (const hb of this.heartbeats.values()) {
        if (hb.name === name) {
          config = hb
          break
        }
      }
    }

    if (!config) {
      return { success: false, error: '未找到指定的心跳' }
    }

    this.stopTimer(config.id)
    this.heartbeats.delete(config.id)

    logger.info('Heartbeat stopped', { id: config.id, name: config.name })

    return {
      success: true,
      output: `心跳 "${config.name}" 已停止`,
      data: { id: config.id, name: config.name, triggerCount: config.triggerCount }
    }
  }

  /**
   * 调整心跳
   */
  private async adjustHeartbeat(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const id = String(params.id || '')
    const config = this.heartbeats.get(id)

    if (!config) {
      return { success: false, error: `心跳 ${id} 不存在` }
    }

    const changes: string[] = []

    if (params.intervalMs !== undefined) {
      const newInterval = Math.max(10000, Number(params.intervalMs))
      if (newInterval !== config.intervalMs) {
        config.intervalMs = newInterval
        changes.push(`间隔: ${newInterval}ms`)

        // 重启定时器
        if (config.enabled) {
          this.stopTimer(id)
          this.startTimer(config)
        }
      }
    }

    if (params.prompt !== undefined) {
      config.prompt = String(params.prompt)
      changes.push('提示词已更新')
    }

    if (params.enabled !== undefined) {
      const wasEnabled = config.enabled
      config.enabled = Boolean(params.enabled)

      if (wasEnabled && !config.enabled) {
        this.stopTimer(id)
        changes.push('已暂停')
      } else if (!wasEnabled && config.enabled) {
        this.startTimer(config)
        changes.push('已恢复')
      }
    }

    if (changes.length === 0) {
      return { success: true, output: '无需调整', data: config }
    }

    logger.info('Heartbeat adjusted', { id, changes })

    return {
      success: true,
      output: `心跳 "${config.name}" 已调整:\n${changes.join('\n')}`,
      data: config
    }
  }

  /**
   * 列出心跳
   */
  private async listHeartbeats(): Promise<BuiltinServiceResult> {
    const heartbeats = Array.from(this.heartbeats.values())

    if (heartbeats.length === 0) {
      return {
        success: true,
        output: '当前没有活跃的心跳。使用 Start 命令创建一个心跳来实现自主行动！',
        data: { heartbeats: [] }
      }
    }

    const output =
      `活跃心跳 (${heartbeats.length} 个):\n\n` +
      heartbeats
        .map(
          (hb, i) =>
            `${i + 1}. ${hb.name} [${hb.enabled ? '运行中' : '已暂停'}]
   ID: ${hb.id}
   间隔: ${hb.intervalMs}ms
   已触发: ${hb.triggerCount} 次
   上次触发: ${hb.lastTriggeredAt ? new Date(hb.lastTriggeredAt).toLocaleString() : '尚未触发'}`
        )
        .join('\n\n')

    return { success: true, output, data: { heartbeats } }
  }

  /**
   * 获取历史
   */
  private async getHistory(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const id = params.id ? String(params.id) : undefined
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10))

    let results = this.results

    if (id) {
      results = results.filter((r) => r.heartbeatId === id)
    }

    results = results.slice(-limit)

    if (results.length === 0) {
      return {
        success: true,
        output: '暂无触发历史',
        data: { results: [] }
      }
    }

    const output =
      `心跳触发历史 (最近 ${results.length} 条):\n\n` +
      results
        .map(
          (r) =>
            `[${new Date(r.triggeredAt).toLocaleString()}] ${r.heartbeatId}
  ${r.success ? '✓ 成功' : '✗ 失败: ' + r.error}`
        )
        .join('\n')

    return { success: true, output, data: { results } }
  }

  /**
   * 停止所有心跳
   */
  private async stopAllHeartbeats(): Promise<BuiltinServiceResult> {
    const count = this.heartbeats.size

    for (const id of this.timers.keys()) {
      this.stopTimer(id)
    }

    this.heartbeats.clear()

    logger.info('All heartbeats stopped', { count })

    return {
      success: true,
      output: `已停止 ${count} 个心跳`,
      data: { stoppedCount: count }
    }
  }

  // ==================== 定时器管理 ====================

  private startTimer(config: HeartbeatConfig): void {
    const timer = setInterval(() => {
      this.triggerHeartbeat(config)
    }, config.intervalMs)

    this.timers.set(config.id, timer)

    logger.debug('Timer started', { id: config.id, intervalMs: config.intervalMs })
  }

  private stopTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(id)
      logger.debug('Timer stopped', { id })
    }
  }

  private async triggerHeartbeat(config: HeartbeatConfig): Promise<void> {
    // 检查是否达到最大触发次数
    const maxTriggers = config.maxTriggers ?? 0
    if (maxTriggers > 0 && config.triggerCount >= maxTriggers) {
      this.stopTimer(config.id)
      config.enabled = false
      logger.info('Heartbeat reached max triggers', { id: config.id, maxTriggers })
      return
    }

    // 检查条件 (简单实现)
    if (config.condition) {
      // TODO: 实现条件表达式评估
      logger.debug('Condition check', { id: config.id, condition: config.condition })
    }

    config.lastTriggeredAt = Date.now()
    config.triggerCount++

    const result: HeartbeatResult = {
      heartbeatId: config.id,
      triggeredAt: Date.now(),
      success: false
    }

    try {
      // 发送消息到渲染进程
      await this.sendToRenderer(config)
      result.success = true
      result.response = 'Heartbeat triggered'

      logger.info('Heartbeat triggered', { id: config.id, name: config.name, count: config.triggerCount })
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      logger.error('Heartbeat trigger failed', { id: config.id, error: result.error })
    }

    // 记录结果
    this.results.push(result)
    if (this.results.length > this.maxResultsHistory) {
      this.results = this.results.slice(-this.maxResultsHistory)
    }
  }

  /**
   * 发送心跳消息到渲染进程
   */
  private async sendToRenderer(config: HeartbeatConfig): Promise<void> {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows.find((w) => !w.isDestroyed())

    if (!mainWindow) {
      throw new Error('No active window')
    }

    // 发送心跳事件到渲染进程
    mainWindow.webContents.send('vcp:flowinvite:trigger', {
      id: config.id,
      name: config.name,
      prompt: config.prompt,
      context: config.context,
      triggerCount: config.triggerCount,
      timestamp: Date.now()
    })
  }

  async shutdown(): Promise<void> {
    // 停止所有定时器
    for (const id of this.timers.keys()) {
      this.stopTimer(id)
    }

    logger.info('FlowInviteService shutdown')
  }
}
