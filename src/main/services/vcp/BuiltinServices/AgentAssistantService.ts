/**
 * Agent Assistant Service (Builtin)
 *
 * 多 Agent 协作服务，支持：
 * - 即时通讯：立即调用指定 Agent
 * - 定时通讯：安排未来时间执行的任务
 * - 临时通讯：不保留上下文的单次对话
 * - 上下文历史：为每个 Agent 会话维护独立的对话历史
 * - 消息队列：通过 UnifiedAgentService 管理 Agent 间消息
 * - 任务委托：支持任务创建和委托给其他 Agent
 *
 * @author Cherry Studio Team
 * @unified 2026-01 统一架构，集成 UnifiedAgentService
 */

import { loggerService } from '@logger'
import { getUnifiedAgentService } from '@main/services/UnifiedAgentService'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService, PluginModelConfig } from './index'

const logger = loggerService.withContext('VCP:AgentAssistantService')

interface AgentConfig {
  name: string
  chineseName?: string
  modelId?: string
  providerId?: string
  systemPrompt: string
  description: string
}

interface ConversationHistory {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ScheduledTask {
  id: string
  agentName: string
  prompt: string
  scheduledTime: Date
  createdAt: Date
  status: 'pending' | 'executed' | 'cancelled'
}

// 上下文历史配置
const CONTEXT_CONFIG = {
  MAX_HISTORY_ROUNDS: 10,
  CONTEXT_TTL_HOURS: 24
}

export class AgentAssistantService implements IBuiltinService {
  name = 'AgentAssistant'
  displayName = 'Agent 助手 (内置)'
  description = '多 Agent 协作系统，支持即时通讯、定时通讯、临时通讯和上下文历史管理。'
  version = '2.1.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'agent'

  documentation = `# Agent 助手

多 Agent 协作插件，支持调用其他专门的 Agent 来处理任务。

## 功能特性

- **即时通讯**: 立即向指定 Agent 发送消息并获取回复
- **定时通讯**: 安排在未来指定时间执行的通讯任务
- **临时通讯**: 不保留上下文历史的单次对话
- **上下文管理**: 为每个 Agent 会话维护独立的对话历史

## 配置

- \`AGENTS_CONFIG\`: Agent 配置列表 (JSON 格式)
- \`MAX_HISTORY_ROUNDS\`: 最大历史轮数 (默认 10)
- \`CONTEXT_TTL_HOURS\`: 上下文有效期 (默认 24 小时)

## 命令

### InvokeAgent
调用指定的 Agent 进行协作。

**参数:**
- agent_name (string, 必需): Agent 名称
- prompt (string, 必需): 提示词/任务描述
- timely_contact (string, 可选): 定时发送时间 (YYYY-MM-DD-HH:mm)
- temporary_contact (boolean, 可选): 是否为临时通讯 (不保留上下文)

**调用格式:**
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentAssistant「末」
agent_name:「始」小助手「末」
prompt:「始」请帮我查询今天的天气情况「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### ListAgents
列出所有可用的 Agent。

### GetScheduledTasks
获取所有定时任务列表。

### CancelScheduledTask
取消指定的定时任务。
`

  configSchema = {
    AGENTS_CONFIG: {
      type: 'string',
      description: 'Agent 配置列表 (JSON 格式)',
      default: '[]'
    },
    MAX_HISTORY_ROUNDS: {
      type: 'number',
      description: '最大对话历史轮数',
      default: 10
    },
    CONTEXT_TTL_HOURS: {
      type: 'number',
      description: '上下文有效期 (小时)',
      default: 24
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'InvokeAgent',
      description: `调用指定的 Agent 进行协作。

参数:
- agent_name (字符串, 必需): 目标 Agent 的名称
- prompt (字符串, 必需): 发送给 Agent 的消息内容
- timely_contact (字符串, 可选): 定时发送时间，格式 YYYY-MM-DD-HH:mm
- temporary_contact (布尔, 可选): 设为 true 则不保留上下文历史

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentAssistant「末」
agent_name:「始」助手名称「末」
prompt:「始」您的问题或任务「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'agent_name', type: 'string', required: true, description: 'Agent 名称' },
        { name: 'prompt', type: 'string', required: true, description: '任务描述' },
        { name: 'timely_contact', type: 'string', required: false, description: '定时发送时间 (YYYY-MM-DD-HH:mm)' },
        { name: 'temporary_contact', type: 'boolean', required: false, description: '是否为临时通讯 (不保留上下文)' }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentAssistant「末」
agent_name:「始」通用助手「末」
prompt:「始」请帮我分析这段代码的性能问题「末」
<<<[END_TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'ListAgents',
      description: '列出所有可用的 Agent',
      parameters: []
    },
    {
      commandIdentifier: 'GetScheduledTasks',
      description: '获取所有定时任务列表',
      parameters: []
    },
    {
      commandIdentifier: 'CancelScheduledTask',
      description: '取消指定的定时任务',
      parameters: [
        { name: 'task_id', type: 'string', required: true, description: '任务 ID' }
      ]
    },
    // === UnifiedAgentService 集成命令 ===
    {
      commandIdentifier: 'SendAgentMessage',
      description: `发送消息给指定 Agent（通过统一消息队列）。

参数:
- to_agent_id (字符串, 必需): 目标 Agent ID
- message (字符串, 必需): 消息内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentAssistant「末」
command:「始」SendAgentMessage「末」
to_agent_id:「始」assistant_xxx「末」
message:「始」请帮我处理这个任务「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'to_agent_id', type: 'string', required: true, description: '目标 Agent ID' },
        { name: 'message', type: 'string', required: true, description: '消息内容' }
      ]
    },
    {
      commandIdentifier: 'CreateTask',
      description: `创建并委托任务给其他 Agent。

参数:
- description (字符串, 必需): 任务描述
- target_agent_id (字符串, 可选): 指定目标 Agent，不指定则自动选择
- priority (字符串, 可选): 优先级 (low/normal/high/urgent)
- type (字符串, 可选): 任务类型 (query/action/analyze/summarize/delegate)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentAssistant「末」
command:「始」CreateTask「末」
description:「始」分析这段代码的性能问题「末」
priority:「始」high「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'description', type: 'string', required: true, description: '任务描述' },
        { name: 'target_agent_id', type: 'string', required: false, description: '目标 Agent ID' },
        { name: 'priority', type: 'string', required: false, description: '优先级' },
        { name: 'type', type: 'string', required: false, description: '任务类型' }
      ]
    },
    {
      commandIdentifier: 'GetPendingMessages',
      description: '获取当前 Agent 的待处理消息',
      parameters: []
    },
    {
      commandIdentifier: 'ListAllAgents',
      description: '列出所有统一管理的 Agent（包括 Assistant 和 VCPAgent）',
      parameters: []
    }
  ]

  supportsModel = true
  modelConfig?: PluginModelConfig
  systemPrompt: string = 'You are a helpful assistant.'

  private agents: Map<string, AgentConfig> = new Map()
  private conversationHistory: Map<string, ConversationHistory[]> = new Map()
  private scheduledTasks: Map<string, ScheduledTask> = new Map()
  private taskTimers: Map<string, NodeJS.Timeout> = new Map()
  private maxHistoryRounds = CONTEXT_CONFIG.MAX_HISTORY_ROUNDS
  private contextTtlHours = CONTEXT_CONFIG.CONTEXT_TTL_HOURS

  async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config) {
      this.setConfig(config)
    }

    // 默认 Agent (测试用)
    if (this.agents.size === 0) {
      this.registerAgent({
        name: 'GeneralAssistant',
        chineseName: '通用助手',
        systemPrompt: 'You are a helpful general assistant.',
        description: '通用目的助手，可以处理各种常见任务。'
      })
    }

    // 启动定期清理过期上下文的任务
    this.startContextCleanup()

    logger.info('AgentAssistantService initialized', {
      agentCount: this.agents.size,
      maxHistoryRounds: this.maxHistoryRounds,
      contextTtlHours: this.contextTtlHours
    })
  }

  setConfig(config: Record<string, unknown>): void {
    // 解析 Agent 配置
    if (config.AGENTS_CONFIG) {
      try {
        const agentsList = JSON.parse(String(config.AGENTS_CONFIG))
        if (Array.isArray(agentsList)) {
          this.agents.clear()
          agentsList.forEach((a) => this.registerAgent(a))
        }
      } catch (e) {
        logger.warn('Failed to parse AGENTS_CONFIG', { error: e })
      }
    }

    // 更新配置参数
    if (typeof config.MAX_HISTORY_ROUNDS === 'number') {
      this.maxHistoryRounds = config.MAX_HISTORY_ROUNDS
    }
    if (typeof config.CONTEXT_TTL_HOURS === 'number') {
      this.contextTtlHours = config.CONTEXT_TTL_HOURS
    }
  }

  private registerAgent(agent: Record<string, unknown>) {
    const name = String(agent.name || '')
    if (name) {
      this.agents.set(name, {
        name,
        chineseName: agent.chineseName as string | undefined,
        modelId: agent.modelId as string | undefined,
        providerId: agent.providerId as string | undefined,
        systemPrompt: String(agent.systemPrompt || ''),
        description: String(agent.description || '')
      })

      // 如果有中文名，也注册中文名映射
      if (agent.chineseName) {
        this.agents.set(String(agent.chineseName), this.agents.get(name)!)
      }
    }
  }

  setModelConfig(modelConfig: PluginModelConfig): void {
    this.modelConfig = modelConfig
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    switch (command) {
      // 新命令名
      case 'InvokeAgent':
      // VCPToolBox 兼容别名
      case 'AskMaidAgent':
        return await this.invokeAgent(
          params.agent_name as string,
          params.prompt as string,
          params.timely_contact as string | undefined,
          params.temporary_contact === true || params.temporary_contact === 'true'
        )

      case 'ListAgents':
        return this.listAgents()

      case 'GetScheduledTasks':
        return this.getScheduledTasks()

      case 'CancelScheduledTask':
        return this.cancelScheduledTask(params.task_id as string)

      // === UnifiedAgentService 集成命令 ===
      case 'SendAgentMessage':
        return await this.sendAgentMessage(
          params.to_agent_id as string,
          params.message as string
        )

      case 'CreateTask':
        return await this.createAgentTask(
          params.description as string,
          params.target_agent_id as string | undefined,
          params.priority as string | undefined,
          params.type as string | undefined
        )

      case 'GetPendingMessages':
        return this.getPendingMessages()

      case 'ListAllAgents':
        return await this.listAllUnifiedAgents()

      default:
        return { success: false, error: `Unknown command: ${command}. Available: InvokeAgent, ListAgents, GetScheduledTasks, CancelScheduledTask, SendAgentMessage, CreateTask, GetPendingMessages, ListAllAgents (alias: AskMaidAgent)` }
    }
  }

  /**
   * 调用 Agent
   */
  private async invokeAgent(
    agentName: string,
    prompt: string,
    timelyContact?: string,
    temporaryContact?: boolean
  ): Promise<BuiltinServiceResult> {
    if (!agentName) {
      return { success: false, error: '参数错误: agent_name 是必需的' }
    }
    if (!prompt) {
      return { success: false, error: '参数错误: prompt 是必需的' }
    }

    // 处理定时任务
    if (timelyContact) {
      return this.scheduleTask(agentName, prompt, timelyContact)
    }

    // 即时通讯
    return this.executeImmediateCall(agentName, prompt, temporaryContact)
  }

  /**
   * 执行即时通讯
   */
  private async executeImmediateCall(
    agentName: string,
    prompt: string,
    temporaryContact?: boolean
  ): Promise<BuiltinServiceResult> {
    const agentConfig = this.agents.get(agentName)
    const targetSystemPrompt = agentConfig?.systemPrompt || this.systemPrompt || 'You are a helpful assistant.'

    // 获取或创建对话历史 (临时通讯不使用历史)
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    const historyKey = `${agentName}:default`

    if (!temporaryContact) {
      const storedHistory = this.conversationHistory.get(historyKey) || []
      // 清理过期历史
      const validHistory = this.filterExpiredHistory(storedHistory)
      // 转换为模型调用格式
      history = validHistory.slice(-this.maxHistoryRounds * 2).map((h) => ({
        role: h.role,
        content: h.content
      }))
    }

    // 调用模型
    const { getBuiltinServiceRegistry } = await import('./index')
    const registry = getBuiltinServiceRegistry()

    const effectiveSystemPrompt = `${targetSystemPrompt}\n\n(Acting as Agent: ${agentConfig?.chineseName || agentName})`

    const result = await registry.callServiceModel(this.name, {
      userMessage: prompt,
      systemPrompt: effectiveSystemPrompt,
      history
    })

    if (result.success && result.content) {
      // 保存对话历史 (非临时通讯)
      if (!temporaryContact) {
        const currentHistory = this.conversationHistory.get(historyKey) || []
        const now = Date.now()

        currentHistory.push({ role: 'user', content: prompt, timestamp: now })
        currentHistory.push({ role: 'assistant', content: result.content, timestamp: now })

        // 限制历史长度
        while (currentHistory.length > this.maxHistoryRounds * 2) {
          currentHistory.shift()
        }

        this.conversationHistory.set(historyKey, currentHistory)
      }

      logger.info('Agent invoked successfully', {
        agentName,
        temporaryContact,
        historyLength: history.length
      })

      return {
        success: true,
        output: result.content,
        data: {
          agentName,
          agentDescription: agentConfig?.description,
          temporaryContact,
          historyRounds: temporaryContact ? 0 : Math.floor(history.length / 2) + 1
        }
      }
    } else {
      return { success: false, error: result.error || 'Agent 调用失败' }
    }
  }

  /**
   * 安排定时任务
   */
  private scheduleTask(agentName: string, prompt: string, timelyContact: string): BuiltinServiceResult {
    // 解析时间 (格式: YYYY-MM-DD-HH:mm)
    const match = timelyContact.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})$/)
    if (!match) {
      return {
        success: false,
        error: '定时时间格式错误，正确格式: YYYY-MM-DD-HH:mm (例如 2025-01-15-14:30)'
      }
    }

    const [, year, month, day, hour, minute] = match
    const scheduledTime = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    )

    if (scheduledTime.getTime() <= Date.now()) {
      return { success: false, error: '定时时间必须是未来时间' }
    }

    // 创建任务
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const task: ScheduledTask = {
      id: taskId,
      agentName,
      prompt,
      scheduledTime,
      createdAt: new Date(),
      status: 'pending'
    }

    this.scheduledTasks.set(taskId, task)

    // 设置定时器
    const delay = scheduledTime.getTime() - Date.now()
    const timer = setTimeout(async () => {
      await this.executeScheduledTask(taskId)
    }, delay)

    this.taskTimers.set(taskId, timer)

    logger.info('Scheduled task created', {
      taskId,
      agentName,
      scheduledTime: scheduledTime.toISOString(),
      delayMs: delay
    })

    // 格式化时间显示
    const formattedTime = scheduledTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

    return {
      success: true,
      output: `✅ 定时任务已创建！\n\n**任务详情:**\n- 任务 ID: ${taskId}\n- 目标 Agent: ${agentName}\n- 执行时间: ${formattedTime}\n- 消息内容: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}\n\n届时系统将自动执行此任务。`,
      data: {
        taskId,
        agentName,
        scheduledTime: scheduledTime.toISOString(),
        status: 'pending'
      }
    }
  }

  /**
   * 执行定时任务
   */
  private async executeScheduledTask(taskId: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId)
    if (!task || task.status !== 'pending') {
      return
    }

    logger.info('Executing scheduled task', { taskId, agentName: task.agentName })

    try {
      const result = await this.executeImmediateCall(task.agentName, task.prompt, false)

      task.status = 'executed'

      // 通过 WebSocket 推送结果 (使用统一 API Server WebSocket)
      try {
        const { apiServer } = await import('../../../apiServer')
        const wsServer = apiServer.getWebSocketServer()
        if (wsServer) {
          const { WebSocketMessageType } = await import('../../../apiServer/websocket/types')
          wsServer.broadcast({
            type: WebSocketMessageType.CUSTOM,
            data: {
              event: 'scheduled_task_completed',
              taskId,
              agentName: task.agentName,
              result: result.success ? result.output : result.error,
              success: result.success,
              timestamp: new Date().toISOString()
            }
          })
        }
      } catch {
        // WebSocket 服务可能不可用，忽略
      }

      logger.info('Scheduled task executed', { taskId, success: result.success })
    } catch (error) {
      task.status = 'executed'
      logger.error('Scheduled task failed', { taskId, error: String(error) })
    }

    // 清理定时器
    this.taskTimers.delete(taskId)
  }

  /**
   * 列出所有可用 Agent
   */
  private listAgents(): BuiltinServiceResult {
    const agentList = Array.from(new Set(this.agents.values())).map((agent) => ({
      name: agent.name,
      chineseName: agent.chineseName,
      description: agent.description,
      hasCustomModel: !!agent.modelId
    }))

    const output = agentList.length > 0
      ? `**可用 Agent 列表 (${agentList.length} 个):**\n\n${agentList
          .map((a, i) => `${i + 1}. **${a.chineseName || a.name}** (${a.name})\n   ${a.description || '无描述'}`)
          .join('\n\n')}`
      : '当前没有配置任何 Agent。请在插件配置中添加 AGENTS_CONFIG。'

    return {
      success: true,
      output,
      data: { agents: agentList }
    }
  }

  /**
   * 获取定时任务列表
   */
  private getScheduledTasks(): BuiltinServiceResult {
    const tasks = Array.from(this.scheduledTasks.values())
      .filter((t) => t.status === 'pending')
      .map((t) => ({
        id: t.id,
        agentName: t.agentName,
        prompt: t.prompt.substring(0, 50) + (t.prompt.length > 50 ? '...' : ''),
        scheduledTime: t.scheduledTime.toISOString(),
        createdAt: t.createdAt.toISOString()
      }))

    const output = tasks.length > 0
      ? `**待执行定时任务 (${tasks.length} 个):**\n\n${tasks
          .map((t) => `- [${t.id}] → ${t.agentName} @ ${new Date(t.scheduledTime).toLocaleString('zh-CN')}`)
          .join('\n')}`
      : '当前没有待执行的定时任务。'

    return {
      success: true,
      output,
      data: { tasks }
    }
  }

  /**
   * 取消定时任务
   */
  private cancelScheduledTask(taskId: string): BuiltinServiceResult {
    const task = this.scheduledTasks.get(taskId)
    if (!task) {
      return { success: false, error: `任务 ${taskId} 不存在` }
    }

    if (task.status !== 'pending') {
      return { success: false, error: `任务 ${taskId} 已${task.status === 'executed' ? '执行' : '取消'}` }
    }

    // 取消定时器
    const timer = this.taskTimers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.taskTimers.delete(taskId)
    }

    task.status = 'cancelled'

    logger.info('Scheduled task cancelled', { taskId })

    return {
      success: true,
      output: `✅ 任务 ${taskId} 已取消`,
      data: { taskId, status: 'cancelled' }
    }
  }

  // ==================== UnifiedAgentService 集成方法 ====================

  /**
   * 发送消息给指定 Agent (通过统一消息队列)
   */
  private async sendAgentMessage(toAgentId: string, message: string): Promise<BuiltinServiceResult> {
    if (!toAgentId) {
      return { success: false, error: '参数错误: to_agent_id 是必需的' }
    }
    if (!message) {
      return { success: false, error: '参数错误: message 是必需的' }
    }

    try {
      const unifiedService = getUnifiedAgentService()
      await unifiedService.initialize()

      // 使用当前服务作为发送者 ID
      const fromAgentId = `builtin_${this.name}`

      const agentMessage = await unifiedService.sendMessage(fromAgentId, toAgentId, message, {
        source: 'AgentAssistantService',
        timestamp: new Date().toISOString()
      })

      logger.info('Agent message sent via UnifiedAgentService', {
        from: fromAgentId,
        to: toAgentId,
        messageId: agentMessage.id
      })

      return {
        success: true,
        output: `✅ 消息已发送给 Agent ${toAgentId}\n\n**消息 ID:** ${agentMessage.id}\n**内容:** ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
        data: {
          messageId: agentMessage.id,
          fromAgentId,
          toAgentId,
          timestamp: agentMessage.timestamp
        }
      }
    } catch (error) {
      logger.error('Failed to send agent message', error as Error)
      return {
        success: false,
        error: `发送消息失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 创建并委托任务给其他 Agent
   */
  private async createAgentTask(
    description: string,
    targetAgentId?: string,
    priority?: string,
    taskType?: string
  ): Promise<BuiltinServiceResult> {
    if (!description) {
      return { success: false, error: '参数错误: description 是必需的' }
    }

    try {
      const unifiedService = getUnifiedAgentService()
      await unifiedService.initialize()

      const fromAgentId = `builtin_${this.name}`

      const validPriorities = ['low', 'normal', 'high', 'urgent'] as const
      const validTypes = ['query', 'action', 'analyze', 'summarize', 'delegate'] as const

      const task = await unifiedService.createTask(fromAgentId, description, {
        targetAgentId,
        type: validTypes.includes(taskType as any) ? (taskType as any) : 'query',
        priority: validPriorities.includes(priority as any) ? (priority as any) : 'normal'
      })

      logger.info('Agent task created via UnifiedAgentService', {
        taskId: task.id,
        from: fromAgentId,
        assigned: task.assignedAgentId
      })

      return {
        success: true,
        output: `✅ 任务已创建${task.assignedAgentId ? `并分配给 Agent ${task.assignedAgentId}` : ''}\n\n**任务 ID:** ${task.id}\n**描述:** ${description}\n**优先级:** ${task.priority}\n**状态:** ${task.status}`,
        data: {
          taskId: task.id,
          fromAgentId,
          assignedAgentId: task.assignedAgentId,
          status: task.status,
          priority: task.priority,
          type: task.type
        }
      }
    } catch (error) {
      logger.error('Failed to create agent task', error as Error)
      return {
        success: false,
        error: `创建任务失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 获取当前 Agent 的待处理消息
   */
  private getPendingMessages(): BuiltinServiceResult {
    try {
      const unifiedService = getUnifiedAgentService()
      const agentId = `builtin_${this.name}`

      const messages = unifiedService.getPendingMessages(agentId)

      if (messages.length === 0) {
        return {
          success: true,
          output: '当前没有待处理的消息。',
          data: { messages: [] }
        }
      }

      const messageList = messages.map((m, i) => {
        const time = new Date(m.timestamp).toLocaleString('zh-CN')
        return `${i + 1}. [${m.type}] 来自 ${m.fromAgentId}\n   时间: ${time}\n   内容: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
      }).join('\n\n')

      return {
        success: true,
        output: `**待处理消息 (${messages.length} 条):**\n\n${messageList}`,
        data: {
          messages: messages.map((m) => ({
            id: m.id,
            from: m.fromAgentId,
            type: m.type,
            preview: m.content.substring(0, 100),
            timestamp: m.timestamp
          }))
        }
      }
    } catch (error) {
      logger.error('Failed to get pending messages', error as Error)
      return {
        success: false,
        error: `获取消息失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 列出所有统一管理的 Agent
   */
  private async listAllUnifiedAgents(): Promise<BuiltinServiceResult> {
    try {
      const unifiedService = getUnifiedAgentService()
      await unifiedService.initialize()

      const agents = await unifiedService.getAllAgents()

      if (agents.length === 0) {
        return {
          success: true,
          output: '当前没有注册的统一 Agent。',
          data: { agents: [] }
        }
      }

      const agentList = agents.map((a, i) => {
        const typeLabel = a.type === 'assistant' ? '助手' : a.type === 'vcp' ? 'VCP' : a.type
        const status = a.enabled ? '🟢 活跃' : '⚪ 禁用'
        return `${i + 1}. **${a.name}** (${typeLabel})\n   ${status} | 优先级: ${a.priority}\n   专长: ${a.expertise.length > 0 ? a.expertise.join(', ') : '无'}`
      }).join('\n\n')

      return {
        success: true,
        output: `**统一 Agent 列表 (${agents.length} 个):**\n\n${agentList}`,
        data: {
          total: agents.length,
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            enabled: a.enabled,
            priority: a.priority,
            expertise: a.expertise
          }))
        }
      }
    } catch (error) {
      logger.error('Failed to list unified agents', error as Error)
      return {
        success: false,
        error: `获取 Agent 列表失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 过滤过期的对话历史
   */
  private filterExpiredHistory(history: ConversationHistory[]): ConversationHistory[] {
    const cutoffTime = Date.now() - this.contextTtlHours * 60 * 60 * 1000
    return history.filter((h) => h.timestamp > cutoffTime)
  }

  /**
   * 启动定期清理过期上下文
   */
  private startContextCleanup(): void {
    // 每小时清理一次过期上下文
    setInterval(
      () => {
        for (const [key, history] of this.conversationHistory.entries()) {
          const validHistory = this.filterExpiredHistory(history)
          if (validHistory.length === 0) {
            this.conversationHistory.delete(key)
          } else if (validHistory.length !== history.length) {
            this.conversationHistory.set(key, validHistory)
          }
        }

        // 清理已完成的定时任务 (保留 24 小时)
        const taskCutoff = Date.now() - 24 * 60 * 60 * 1000
        for (const [taskId, task] of this.scheduledTasks.entries()) {
          if (task.status !== 'pending' && task.createdAt.getTime() < taskCutoff) {
            this.scheduledTasks.delete(taskId)
          }
        }
      },
      60 * 60 * 1000
    )
  }

  async shutdown(): Promise<void> {
    // 清理所有定时器
    for (const timer of this.taskTimers.values()) {
      clearTimeout(timer)
    }
    this.taskTimers.clear()

    logger.info('AgentAssistantService shutdown')
  }
}
