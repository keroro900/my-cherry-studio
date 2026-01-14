/**
 * AssistantInvocationService - 助手间调用服务
 *
 * 允许 AI 在普通对话中调用其他助手
 * 复用 VCP 的 AgentInvokeService 架构
 *
 * 功能:
 * - 创建 invoke_agent 工具供 AI 使用
 * - 同步调用其他助手并获取响应
 * - 异步调用支持（带回调）
 */

import { loggerService } from '@logger'
import store from '@renderer/store'
import type { Assistant, MCPTool } from '@renderer/types'
import { v4 as uuidv4 } from 'uuid'

import AiProvider from '../aiCore'
import { getProviderByModel } from './AssistantService'

const logger = loggerService.withContext('AssistantInvocationService')

/**
 * 助手调用结果
 */
export interface AssistantInvocationResult {
  success: boolean
  response?: string
  error?: string
  assistantId: string
  assistantName: string
  executionTimeMs?: number
}

/**
 * 异步任务状态
 */
export interface AsyncInvocationTask {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  targetAssistantId: string
  targetAssistantName: string
  prompt: string
  result?: AssistantInvocationResult
  createdAt: Date
  completedAt?: Date
  callerAssistantId?: string
}

// 异步任务存储
const asyncTasks = new Map<string, AsyncInvocationTask>()

// 任务完成回调
const taskCallbacks = new Map<string, (result: AssistantInvocationResult) => void>()

/**
 * 获取所有可调用的助手列表
 * 排除当前助手自身
 */
export function getInvokableAssistants(currentAssistantId?: string): Assistant[] {
  const assistants = store.getState().assistants.assistants || []
  return assistants.filter((a) => {
    // 排除自己
    if (currentAssistantId && a.id === currentAssistantId) {
      return false
    }
    // 只包含启用了协作的助手
    // 暂时放宽限制，所有助手都可被调用
    return true
  })
}

/**
 * 调用另一个助手
 */
export async function invokeAssistant(
  targetAssistantId: string,
  prompt: string,
  options?: {
    callerAssistantId?: string
    includeSystemPrompt?: boolean
    timeout?: number
  }
): Promise<AssistantInvocationResult> {
  const startTime = Date.now()

  try {
    // 获取目标助手
    const assistants = store.getState().assistants.assistants || []
    const targetAssistant = assistants.find(
      (a) =>
        a.id === targetAssistantId ||
        a.name === targetAssistantId ||
        a.name?.toLowerCase() === targetAssistantId.toLowerCase()
    )

    if (!targetAssistant) {
      return {
        success: false,
        error: `未找到助手: ${targetAssistantId}`,
        assistantId: targetAssistantId,
        assistantName: targetAssistantId,
        executionTimeMs: Date.now() - startTime
      }
    }

    logger.info('Invoking assistant', {
      targetId: targetAssistant.id,
      targetName: targetAssistant.name,
      caller: options?.callerAssistantId
    })

    // 获取 Provider
    const provider = getProviderByModel(targetAssistant.model)
    if (!provider) {
      return {
        success: false,
        error: `无法获取助手的模型提供商`,
        assistantId: targetAssistant.id,
        assistantName: targetAssistant.name,
        executionTimeMs: Date.now() - startTime
      }
    }

    // 调用 AI
    const aiProvider = new AiProvider(provider)
    const result = await aiProvider.completions({
      assistant: {
        ...targetAssistant,
        // 如果不包含系统提示词，使用简单描述
        prompt:
          options?.includeSystemPrompt !== false && targetAssistant.prompt
            ? targetAssistant.prompt
            : `你是 ${targetAssistant.name}。请直接回答问题。`
      },
      messages: prompt,
      streamOutput: false,
      callType: 'chat',
      topicId: `invoke_${targetAssistant.id}_${Date.now()}`
    })

    const response = result.getText?.() || ''

    logger.info('Assistant invocation completed', {
      targetId: targetAssistant.id,
      responseLength: response.length,
      executionTimeMs: Date.now() - startTime
    })

    return {
      success: true,
      response,
      assistantId: targetAssistant.id,
      assistantName: targetAssistant.name,
      executionTimeMs: Date.now() - startTime
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Assistant invocation failed', { targetAssistantId, error: errorMessage })

    return {
      success: false,
      error: errorMessage,
      assistantId: targetAssistantId,
      assistantName: targetAssistantId,
      executionTimeMs: Date.now() - startTime
    }
  }
}

/**
 * 创建 invoke_agent 工具定义
 * 用于普通助手对话
 */
export function createInvokeAgentTool(currentAssistantId?: string): MCPTool {
  const invokableAssistants = getInvokableAssistants(currentAssistantId)

  // 构建可用助手列表描述
  const assistantDescriptions = invokableAssistants
    .slice(0, 10) // 限制显示数量
    .map((a) => `- ${a.name}: ${a.description || '通用助手'}`)
    .join('\n')

  const moreHint = invokableAssistants.length > 10 ? `\n... 及更多 (共 ${invokableAssistants.length} 个助手)` : ''

  return {
    id: 'invoke_agent',
    name: 'invoke_agent',
    description: `调用另一个助手来处理特定任务。当你需要其他助手的专业能力时使用此工具。

可调用的助手:
${assistantDescriptions}${moreHint}

使用场景:
- 需要图片生成能力时，调用图片助手
- 需要代码专业意见时，调用代码专家
- 需要翻译时，调用翻译助手
- 需要其他专业领域的帮助时

注意: 每次只能调用一个助手，等待其响应后再决定下一步。`,
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: '要调用的助手名称（必须是上述列表中的名称）'
        },
        request: {
          type: 'string',
          description: '发送给该助手的请求内容，要清晰描述你需要什么'
        },
        include_system_prompt: {
          type: 'boolean',
          description: '是否使用目标助手的系统提示词',
          default: true
        }
      },
      required: ['agent_name', 'request']
    },
    serverName: 'built-in',
    serverId: 'assistant-invocation',
    type: 'mcp',
    isBuiltIn: true
  }
}

/**
 * 处理 invoke_agent 工具调用
 */
export async function handleInvokeAgentToolCall(
  args: { agent_name: string; request: string; include_system_prompt?: boolean },
  callerAssistantId?: string
): Promise<string> {
  const result = await invokeAssistant(args.agent_name, args.request, {
    callerAssistantId,
    includeSystemPrompt: args.include_system_prompt !== false
  })

  if (result.success && result.response) {
    return `[${result.assistantName} 的回复]\n${result.response}`
  } else {
    return `[调用失败] ${result.error}`
  }
}

/**
 * 检查助手是否启用了协作功能
 */
export function isCollaborationEnabled(assistant: Assistant): boolean {
  return !!(assistant.collaboration?.canDelegate || assistant.collaboration?.canInitiate)
}

// ==================== 异步调用支持 ====================

/**
 * 异步调用另一个助手
 * 立即返回任务 ID，后台执行调用
 */
export async function invokeAssistantAsync(
  targetAssistantId: string,
  prompt: string,
  options?: {
    callerAssistantId?: string
    includeSystemPrompt?: boolean
    onComplete?: (result: AssistantInvocationResult) => void
  }
): Promise<string> {
  const taskId = uuidv4()

  // 获取目标助手信息
  const assistants = store.getState().assistants.assistants || []
  const targetAssistant = assistants.find(
    (a) =>
      a.id === targetAssistantId ||
      a.name === targetAssistantId ||
      a.name?.toLowerCase() === targetAssistantId.toLowerCase()
  )

  const task: AsyncInvocationTask = {
    id: taskId,
    status: 'pending',
    targetAssistantId,
    targetAssistantName: targetAssistant?.name || targetAssistantId,
    prompt,
    createdAt: new Date(),
    callerAssistantId: options?.callerAssistantId
  }

  asyncTasks.set(taskId, task)

  if (options?.onComplete) {
    taskCallbacks.set(taskId, options.onComplete)
  }

  logger.info('Async assistant invocation started', { taskId, targetAssistantId })

  // 异步执行
  executeAsyncTask(task, options).catch((error) => {
    logger.error('Async task execution failed', { taskId, error: String(error) })
  })

  return taskId
}

/**
 * 执行异步任务
 */
async function executeAsyncTask(task: AsyncInvocationTask, options?: { includeSystemPrompt?: boolean }): Promise<void> {
  task.status = 'running'

  try {
    const result = await invokeAssistant(task.targetAssistantId, task.prompt, {
      callerAssistantId: task.callerAssistantId,
      includeSystemPrompt: options?.includeSystemPrompt
    })

    task.status = result.success ? 'completed' : 'failed'
    task.result = result
    task.completedAt = new Date()

    logger.info('Async task completed', {
      taskId: task.id,
      status: task.status,
      executionTimeMs: result.executionTimeMs
    })

    // 触发回调
    const callback = taskCallbacks.get(task.id)
    if (callback) {
      callback(result)
      taskCallbacks.delete(task.id)
    }
  } catch (error) {
    task.status = 'failed'
    task.result = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      assistantId: task.targetAssistantId,
      assistantName: task.targetAssistantName
    }
    task.completedAt = new Date()

    logger.error('Async task failed', { taskId: task.id, error: String(error) })
  }
}

/**
 * 获取异步任务状态
 */
export function getAsyncTaskStatus(taskId: string): AsyncInvocationTask | null {
  return asyncTasks.get(taskId) || null
}

/**
 * 获取异步任务结果
 */
export function getAsyncTaskResult(taskId: string): AssistantInvocationResult | null {
  const task = asyncTasks.get(taskId)
  return task?.result || null
}

/**
 * 列出所有异步任务
 */
export function listAsyncTasks(status?: AsyncInvocationTask['status']): AsyncInvocationTask[] {
  const tasks = Array.from(asyncTasks.values())
  if (status) {
    return tasks.filter((t) => t.status === status)
  }
  return tasks
}

/**
 * 清理已完成的任务（保留最近 N 个）
 */
export function cleanupAsyncTasks(keepCount: number = 50): number {
  const tasks = Array.from(asyncTasks.entries())
    .filter(([_, t]) => t.status === 'completed' || t.status === 'failed')
    .sort((a, b) => (b[1].completedAt?.getTime() || 0) - (a[1].completedAt?.getTime() || 0))

  const toRemove = tasks.slice(keepCount)
  toRemove.forEach(([id]) => {
    asyncTasks.delete(id)
    taskCallbacks.delete(id)
  })

  if (toRemove.length > 0) {
    logger.debug('Cleaned up async tasks', { count: toRemove.length })
  }

  return toRemove.length
}

/**
 * 创建包含异步支持的 invoke_agent 工具定义
 */
export function createInvokeAgentToolWithAsync(currentAssistantId?: string): MCPTool {
  const invokableAssistants = getInvokableAssistants(currentAssistantId)

  const assistantDescriptions = invokableAssistants
    .slice(0, 10)
    .map((a) => `- ${a.name}: ${a.description || '通用助手'}`)
    .join('\n')

  const moreHint = invokableAssistants.length > 10 ? `\n... 及更多 (共 ${invokableAssistants.length} 个助手)` : ''

  return {
    id: 'invoke_agent',
    name: 'invoke_agent',
    description: `调用另一个助手来处理特定任务。

可调用的助手:
${assistantDescriptions}${moreHint}

支持两种模式:
- sync (默认): 同步调用，等待结果返回
- async: 异步调用，立即返回任务ID，稍后查询结果

使用场景:
- 需要图片生成能力时，调用图片助手
- 需要代码专业意见时，调用代码专家
- 需要翻译时，调用翻译助手
- 长时间任务可使用异步模式`,
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: '要调用的助手名称'
        },
        request: {
          type: 'string',
          description: '发送给该助手的请求内容'
        },
        mode: {
          type: 'string',
          enum: ['sync', 'async'],
          description: '调用模式: sync=同步等待结果, async=异步返回任务ID',
          default: 'sync'
        },
        include_system_prompt: {
          type: 'boolean',
          description: '是否使用目标助手的系统提示词',
          default: true
        }
      },
      required: ['agent_name', 'request']
    },
    serverName: 'built-in',
    serverId: 'assistant-invocation',
    type: 'mcp',
    isBuiltIn: true
  }
}

/**
 * 处理 invoke_agent 工具调用（支持异步）
 */
export async function handleInvokeAgentToolCallWithAsync(
  args: {
    agent_name: string
    request: string
    mode?: 'sync' | 'async'
    include_system_prompt?: boolean
  },
  callerAssistantId?: string
): Promise<string> {
  const mode = args.mode || 'sync'

  if (mode === 'async') {
    const taskId = await invokeAssistantAsync(args.agent_name, args.request, {
      callerAssistantId,
      includeSystemPrompt: args.include_system_prompt !== false
    })

    return `[异步任务已创建]\n任务ID: ${taskId}\n使用 get_agent_task_status 工具查询结果`
  } else {
    const result = await invokeAssistant(args.agent_name, args.request, {
      callerAssistantId,
      includeSystemPrompt: args.include_system_prompt !== false
    })

    if (result.success && result.response) {
      return `[${result.assistantName} 的回复]\n${result.response}`
    } else {
      return `[调用失败] ${result.error}`
    }
  }
}

/**
 * 创建 get_agent_task_status 工具定义
 */
export function createGetTaskStatusTool(): MCPTool {
  return {
    id: 'get_agent_task_status',
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
    serverName: 'built-in',
    serverId: 'assistant-invocation',
    type: 'mcp',
    isBuiltIn: true
  }
}

/**
 * 处理 get_agent_task_status 工具调用
 */
export function handleGetTaskStatusToolCall(args: { task_id: string }): string {
  const task = getAsyncTaskStatus(args.task_id)

  if (!task) {
    return `[错误] 未找到任务: ${args.task_id}`
  }

  if (task.status === 'completed' && task.result?.success) {
    return `[任务完成]\n状态: ${task.status}\n助手: ${task.targetAssistantName}\n回复:\n${task.result.response}`
  } else if (task.status === 'failed') {
    return `[任务失败]\n状态: ${task.status}\n助手: ${task.targetAssistantName}\n错误: ${task.result?.error}`
  } else {
    return `[任务进行中]\n状态: ${task.status}\n助手: ${task.targetAssistantName}\n创建时间: ${task.createdAt.toLocaleString()}`
  }
}

export default {
  getInvokableAssistants,
  invokeAssistant,
  invokeAssistantAsync,
  createInvokeAgentTool,
  createInvokeAgentToolWithAsync,
  createGetTaskStatusTool,
  handleInvokeAgentToolCall,
  handleInvokeAgentToolCallWithAsync,
  handleGetTaskStatusToolCall,
  getAsyncTaskStatus,
  getAsyncTaskResult,
  listAsyncTasks,
  cleanupAsyncTasks,
  isCollaborationEnabled
}
