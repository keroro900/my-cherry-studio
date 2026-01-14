/**
 * Agent 调用 MCP 工具
 *
 * 提供 VCP 风格的 Agent 调用功能:
 * - invoke_agent: 调用其他 Agent (同步/异步)
 * - get_agent_task_status: 获取异步任务状态
 * - list_available_agents: 列出可用的 Agent
 *
 * 这些工具可通过 VCP TOOL_REQUEST 或 MCP 协议调用
 * 使用 MCP Bridge 调用 Renderer 进程的 AI 服务
 */

import { loggerService } from '@logger'

import {
  type AgentInvokeContext,
  type AgentInvokeOptions,
  type AgentInvokeResult,
  getAgentInvokeService,
  type InvokableAgent
} from '../../knowledge/agent/AgentInvokeService'
import { getVCPAgentService } from '../../knowledge/agent/VCPAgentService'
import { MCPBridge } from '../shared/MCPBridge'
import type { MCPToolDefinition } from '../types'

const logger = loggerService.withContext('InvokeAgentTools')

/**
 * 通过 MCP Bridge 执行 Agent 调用
 * 使用 Cherry Studio 的模型服务
 */
async function executeAgentViaBridge(
  agent: InvokableAgent,
  prompt: string,
  options?: { includeSystemPrompt?: boolean }
): Promise<AgentInvokeResult> {
  const bridge = MCPBridge.getInstance()
  const startTime = Date.now()

  try {
    // 构建系统提示词
    const systemPrompt =
      options?.includeSystemPrompt !== false && agent.systemPrompt
        ? agent.systemPrompt
        : `你是 ${agent.displayName}。${agent.description || ''}`

    // 通过 MCP Bridge 调用模型生成文本
    const response = await bridge.generateText({
      systemPrompt,
      userPrompt: prompt
    })

    return {
      requestId: `agent_${Date.now()}`,
      status: 'success',
      response,
      executionTimeMs: Date.now() - startTime,
      completedAt: new Date()
    }
  } catch (error) {
    logger.error('Agent invocation via bridge failed', { agentId: agent.id, error: String(error) })

    return {
      requestId: `agent_${Date.now()}`,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - startTime
    }
  }
}

/**
 * 初始化 Agent Invoke Service 的执行器
 * 使用 MCP Bridge 作为底层调用机制
 */
function initializeExecutor(): void {
  const service = getAgentInvokeService()
  const agentService = getVCPAgentService()

  // 设置 Agent 提供者
  service.setAgentProvider((idOrName: string) => {
    let agent = agentService.getAgentById(idOrName)
    if (!agent) {
      agent = agentService.getAgentByName(idOrName)
    }
    if (!agent) return null

    return {
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      systemPrompt: agent.systemPrompt,
      description: agent.description,
      isActive: agent.isActive
    }
  })

  // 设置执行器
  service.setExecutor({
    async execute(request, agent) {
      return executeAgentViaBridge(agent, request.prompt, {
        includeSystemPrompt: request.options?.includeSystemPrompt
      })
    }
  })

  logger.info('Agent invoke executor initialized with MCP Bridge')
}

// 延迟初始化（在首次使用时）
let executorInitialized = false
function ensureExecutorInitialized(): void {
  if (!executorInitialized) {
    initializeExecutor()
    executorInitialized = true
  }
}

/**
 * Agent 调用工具定义
 */
export const invokeAgentTools: MCPToolDefinition[] = [
  {
    name: 'invoke_agent',
    description: `调用另一个 Agent 来处理任务。使用 Cherry Studio 配置的模型服务。

支持两种模式:
- sync: 同步调用，等待结果返回
- async: 异步调用，立即返回任务ID，稍后查询结果

可用于:
- 让专业 Agent 处理特定领域问题
- 多 Agent 协作完成复杂任务
- 任务分发和结果汇总

VCP TOOL_REQUEST 格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」invoke_agent「末」
agent_id:「始」目标Agent ID或名称「末」
prompt:「始」要发送给Agent的问题或任务「末」
mode:「始」sync「末」
<<<[END_TOOL_REQUEST]>>>`,
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: '目标 Agent 的 ID 或名称'
        },
        prompt: {
          type: 'string',
          description: '发送给目标 Agent 的提示词/问题'
        },
        mode: {
          type: 'string',
          enum: ['sync', 'async'],
          description: '调用模式: sync=同步等待结果, async=异步返回任务ID',
          default: 'sync'
        },
        caller_agent_id: {
          type: 'string',
          description: '调用者 Agent ID (可选)'
        },
        session_id: {
          type: 'string',
          description: '会话 ID (可选，用于上下文传递)'
        },
        timeout: {
          type: 'number',
          description: '超时时间(毫秒)，仅同步模式有效',
          default: 60000
        },
        include_system_prompt: {
          type: 'boolean',
          description: '是否使用目标 Agent 的系统提示词',
          default: true
        },
        callback_url: {
          type: 'string',
          description: '异步回调 URL (仅异步模式)'
        }
      },
      required: ['agent_id', 'prompt']
    },
    handler: async (args: {
      agent_id: string
      prompt: string
      mode?: 'sync' | 'async'
      caller_agent_id?: string
      session_id?: string
      timeout?: number
      include_system_prompt?: boolean
      callback_url?: string
    }) => {
      // 确保执行器已初始化
      ensureExecutorInitialized()

      const service = getAgentInvokeService()
      const mode = args.mode || 'sync'

      const context: AgentInvokeContext = {
        sessionId: args.session_id
      }

      const options: AgentInvokeOptions & {
        callerAgentId?: string
        context?: AgentInvokeContext
        callbackUrl?: string
      } = {
        timeout: args.timeout,
        includeSystemPrompt: args.include_system_prompt !== false,
        callerAgentId: args.caller_agent_id,
        context,
        callbackUrl: args.callback_url
      }

      if (mode === 'sync') {
        const result = await service.invokeSync(args.agent_id, args.prompt, options)
        return {
          success: result.status === 'success',
          status: result.status,
          response: result.response,
          error: result.error,
          usage: result.usage,
          execution_time_ms: result.executionTimeMs
        }
      } else {
        const taskId = await service.invokeAsync(args.agent_id, args.prompt, options)
        return {
          success: true,
          mode: 'async',
          task_id: taskId,
          message: '异步任务已创建，使用 get_agent_task_status 查询结果'
        }
      }
    }
  },

  {
    name: 'get_agent_task_status',
    description: '获取异步 Agent 调用任务的状态和结果',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务 ID (由 invoke_agent 异步模式返回)'
        }
      },
      required: ['task_id']
    },
    handler: async (args: { task_id: string }) => {
      ensureExecutorInitialized()

      const service = getAgentInvokeService()
      const task = service.getTaskStatus(args.task_id)

      if (!task) {
        return {
          success: false,
          error: `Task not found: ${args.task_id}`
        }
      }

      return {
        success: true,
        task_id: task.id,
        status: task.status,
        result: task.result
          ? {
              status: task.result.status,
              response: task.result.response,
              error: task.result.error,
              usage: task.result.usage,
              execution_time_ms: task.result.executionTimeMs
            }
          : null,
        created_at: task.createdAt.toISOString(),
        updated_at: task.updatedAt.toISOString()
      }
    }
  },

  {
    name: 'list_available_agents',
    description: '列出所有可用于调用的 Agent (来自 VCPAgentService)',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '按分类筛选 (可选)'
        },
        include_inactive: {
          type: 'boolean',
          description: '是否包含未激活的 Agent',
          default: false
        }
      }
    },
    handler: async (args: { category?: string; include_inactive?: boolean }) => {
      const agentService = getVCPAgentService()
      let agents = agentService.getAllAgents()

      // 筛选
      if (!args.include_inactive) {
        agents = agents.filter((a) => a.isActive)
      }
      if (args.category) {
        agents = agents.filter((a) => a.category === args.category)
      }

      return {
        success: true,
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          display_name: a.displayName,
          description: a.description,
          category: a.category,
          is_active: a.isActive,
          tags: a.tags,
          has_system_prompt: !!a.systemPrompt
        })),
        count: agents.length
      }
    }
  },

  {
    name: 'list_agent_tasks',
    description: '列出所有 Agent 调用任务',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed'],
          description: '按状态筛选 (可选)'
        },
        limit: {
          type: 'number',
          description: '返回数量限制',
          default: 50
        }
      }
    },
    handler: async (args: { status?: 'pending' | 'running' | 'completed' | 'failed'; limit?: number }) => {
      ensureExecutorInitialized()

      const service = getAgentInvokeService()
      let tasks = service.listTasks(args.status)

      // 限制数量
      const limit = args.limit || 50
      tasks = tasks.slice(0, limit)

      return {
        success: true,
        tasks: tasks.map((t) => ({
          id: t.id,
          target_agent_id: t.request.targetAgentId,
          status: t.status,
          created_at: t.createdAt.toISOString(),
          updated_at: t.updatedAt.toISOString(),
          has_result: !!t.result
        })),
        count: tasks.length
      }
    }
  }
]

export default invokeAgentTools
