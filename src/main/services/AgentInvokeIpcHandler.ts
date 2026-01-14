/**
 * Agent Invoke IPC Handler
 *
 * 注册 VCP 风格 Agent 调用的 IPC 处理器
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import {
  type AgentInvokeContext,
  type AgentInvokeOptions,
  getAgentInvokeService,
  type InvokableAgent
} from '../knowledge/agent/AgentInvokeService'
import { getVCPAgentService } from '../knowledge/agent/VCPAgentService'

const logger = loggerService.withContext('AgentInvokeIpcHandler')

/**
 * 将 VCPAgent 转换为 InvokableAgent
 */
function toInvokableAgent(
  agent: ReturnType<ReturnType<typeof getVCPAgentService>['getAgentById']>
): InvokableAgent | null {
  if (!agent) return null

  return {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    systemPrompt: agent.systemPrompt,
    description: agent.description,
    isActive: agent.isActive
  }
}

/**
 * 注册 Agent Invoke IPC 处理器
 */
export function registerAgentInvokeIpcHandlers(): void {
  const invokeService = getAgentInvokeService()
  const agentService = getVCPAgentService()

  // 设置 Agent 提供者
  invokeService.setAgentProvider((idOrName: string) => {
    // 先按 ID 查找
    let agent = agentService.getAgentById(idOrName)
    if (!agent) {
      // 再按名称查找
      agent = agentService.getAgentByName(idOrName)
    }
    return toInvokableAgent(agent)
  })

  logger.info('Agent provider set for invoke service')

  // 同步调用 Agent
  ipcMain.handle(
    IpcChannel.AgentInvoke_Sync,
    async (
      _,
      args: {
        targetAgentId: string
        prompt: string
        callerAgentId?: string
        context?: AgentInvokeContext
        options?: AgentInvokeOptions
      }
    ) => {
      try {
        logger.info('Sync agent invoke request', { targetAgentId: args.targetAgentId })

        const result = await invokeService.invokeSync(args.targetAgentId, args.prompt, {
          ...args.options,
          callerAgentId: args.callerAgentId,
          context: args.context
        })

        return { success: result.status === 'success', result }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Sync agent invoke failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 异步调用 Agent
  ipcMain.handle(
    IpcChannel.AgentInvoke_Async,
    async (
      _,
      args: {
        targetAgentId: string
        prompt: string
        callerAgentId?: string
        context?: AgentInvokeContext
        options?: AgentInvokeOptions
        callbackUrl?: string
      }
    ) => {
      try {
        logger.info('Async agent invoke request', { targetAgentId: args.targetAgentId })

        const taskId = await invokeService.invokeAsync(args.targetAgentId, args.prompt, {
          ...args.options,
          callerAgentId: args.callerAgentId,
          context: args.context,
          callbackUrl: args.callbackUrl
        })

        return { success: true, taskId }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Async agent invoke failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 获取任务状态
  ipcMain.handle(IpcChannel.AgentInvoke_GetTaskStatus, async (_, taskId: string) => {
    try {
      const task = invokeService.getTaskStatus(taskId)
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` }
      }
      return { success: true, task }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Get task status failed', { taskId, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  })

  // 获取任务结果
  ipcMain.handle(IpcChannel.AgentInvoke_GetTaskResult, async (_, taskId: string) => {
    try {
      const result = invokeService.getTaskResult(taskId)
      if (!result) {
        return { success: false, error: `Task result not found: ${taskId}` }
      }
      return { success: true, result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Get task result failed', { taskId, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  })

  // 列出任务
  ipcMain.handle(
    IpcChannel.AgentInvoke_ListTasks,
    async (_, args?: { status?: 'pending' | 'running' | 'completed' | 'failed' }) => {
      try {
        const tasks = invokeService.listTasks(args?.status)
        return { success: true, tasks }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('List tasks failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 列出可用 Agent
  ipcMain.handle(
    IpcChannel.AgentInvoke_ListAvailableAgents,
    async (_, args?: { category?: string; includeInactive?: boolean }) => {
      try {
        let agents = agentService.getAllAgents()

        // 筛选
        if (!args?.includeInactive) {
          agents = agents.filter((a) => a.isActive)
        }
        if (args?.category) {
          agents = agents.filter((a) => a.category === args.category)
        }

        const invokableAgents = agents.map((a) => toInvokableAgent(a)).filter((a): a is InvokableAgent => a !== null)

        return { success: true, agents: invokableAgents }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('List available agents failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  logger.info('Agent Invoke IPC handlers registered')
}
