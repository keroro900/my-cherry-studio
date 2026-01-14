/**
 * GroupChat IPC Handler
 *
 * 提供群聊功能的 IPC 接口
 * 连接 renderer 进程与 GroupChatOrchestrator
 */

import { loggerService } from '@logger'
import type { GroupChatOrchestrator } from '@main/knowledge/agent/GroupChatOrchestrator'
import {
  createGroupChatOrchestrator,
  type GroupAgent,
  type GroupChatConfig,
  type GroupChatEvent
} from '@main/knowledge/agent/GroupChatOrchestrator'
import { getUnifiedAgentAdapter } from '@main/knowledge/agent/UnifiedAgentAdapter'
import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow, ipcMain } from 'electron'

import { safeHandle } from './ipc'

const logger = loggerService.withContext('GroupChatIpcHandler')

// Active group chat sessions
const activeSessions: Map<string, GroupChatOrchestrator> = new Map()

/**
 * 广播事件到 renderer
 */
function broadcastEvent(event: GroupChatEvent & { sessionId: string }): void {
  try {
    const serializedEvent = JSON.parse(
      JSON.stringify(event, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString()
        }
        return value
      })
    )

    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('groupchat:event', serializedEvent)
      }
    })
  } catch (error) {
    logger.error('Failed to broadcast group chat event', error as Error)
  }
}

/**
 * 注册 GroupChat IPC handlers
 */
export function registerGroupChatIpcHandlers(): void {
  logger.info('Registering GroupChat IPC handlers...')

  // 创建群聊会话
  ipcMain.handle(IpcChannel.GroupChat_Create, async (_event, config: Partial<GroupChatConfig>) => {
    return safeHandle('groupchat:create', () => {
      const orchestrator = createGroupChatOrchestrator(config)
      const sessionId = orchestrator.getState().config.id

      // 订阅事件并广播
      orchestrator.subscribe((event) => {
        broadcastEvent({ ...event, sessionId })
      })

      activeSessions.set(sessionId, orchestrator)
      logger.info('Group chat session created', { sessionId })

      return {
        sessionId,
        config: orchestrator.getState().config
      }
    })
  })

  // 添加 Agent 到群聊
  ipcMain.handle(
    IpcChannel.GroupChat_AddAgent,
    async (
      _event,
      params: { sessionId: string; agent: Omit<GroupAgent, 'status' | 'speakCount' | 'visibleMessageIds'> }
    ) => {
      return safeHandle('groupchat:addAgent', () => {
        const orchestrator = activeSessions.get(params.sessionId)
        if (!orchestrator) {
          throw new Error(`Session not found: ${params.sessionId}`)
        }

        orchestrator.addAgent(params.agent)
        return { success: true }
      })
    }
  )

  // 从 UnifiedAgent 添加
  ipcMain.handle(
    IpcChannel.GroupChat_AddUnifiedAgent,
    async (_event, params: { sessionId: string; agentId: string }) => {
      return safeHandle('groupchat:addUnifiedAgent', () => {
        const orchestrator = activeSessions.get(params.sessionId)
        if (!orchestrator) {
          throw new Error(`Session not found: ${params.sessionId}`)
        }

        const adapter = getUnifiedAgentAdapter()
        const unifiedAgent = adapter.getAgent(params.agentId)
        if (!unifiedAgent) {
          throw new Error(`UnifiedAgent not found: ${params.agentId}`)
        }

        const groupAgent = adapter.toGroupAgent(unifiedAgent)
        orchestrator.addAgent(groupAgent)

        // 添加调试日志
        const state = orchestrator.getState()
        logger.info('Agent added to group chat', {
          sessionId: params.sessionId,
          agentId: params.agentId,
          agentName: groupAgent.displayName,
          currentAgentCount: state.agents.size,
          allAgentIds: Array.from(state.agents.keys())
        })

        return { success: true, agent: groupAgent }
      })
    }
  )

  // 批量添加 Agents
  ipcMain.handle(IpcChannel.GroupChat_AddAgents, async (_event, params: { sessionId: string; agentIds: string[] }) => {
    return safeHandle('groupchat:addAgents', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      const adapter = getUnifiedAgentAdapter()
      const added: GroupAgent[] = []

      for (const agentId of params.agentIds) {
        const unifiedAgent = adapter.getAgent(agentId)
        if (unifiedAgent) {
          const groupAgent = adapter.toGroupAgent(unifiedAgent)
          orchestrator.addAgent(groupAgent)
          added.push(groupAgent)
        }
      }

      return { success: true, added }
    })
  })

  // 移除 Agent
  ipcMain.handle(IpcChannel.GroupChat_RemoveAgent, async (_event, params: { sessionId: string; agentId: string }) => {
    return safeHandle('groupchat:removeAgent', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      orchestrator.removeAgent(params.agentId)
      return { success: true }
    })
  })

  // 开始群聊
  ipcMain.handle(IpcChannel.GroupChat_Start, async (_event, params: { sessionId: string; topic?: string }) => {
    return safeHandle('groupchat:start', async () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      await orchestrator.start(params.topic)
      return { success: true }
    })
  })

  // 结束群聊
  ipcMain.handle(IpcChannel.GroupChat_End, async (_event, params: { sessionId: string }) => {
    return safeHandle('groupchat:end', async () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      await orchestrator.end()
      const state = orchestrator.getState()

      return {
        success: true,
        summary: state.summary,
        messageCount: state.messages.length
      }
    })
  })

  // 处理用户输入
  ipcMain.handle(
    IpcChannel.GroupChat_HandleUserInput,
    async (_event, params: { sessionId: string; content: string; userId?: string }) => {
      return safeHandle('groupchat:handleUserInput', async () => {
        const orchestrator = activeSessions.get(params.sessionId)
        if (!orchestrator) {
          throw new Error(`Session not found: ${params.sessionId}`)
        }

        const decisions = await orchestrator.handleUserInput(params.content, params.userId)
        return { decisions }
      })
    }
  )

  // 请求 Agent 发言
  ipcMain.handle(
    IpcChannel.GroupChat_RequestSpeak,
    async (_event, params: { sessionId: string; agentId: string; context: string }) => {
      return safeHandle('groupchat:requestSpeak', async () => {
        const orchestrator = activeSessions.get(params.sessionId)
        if (!orchestrator) {
          throw new Error(`Session not found: ${params.sessionId}`)
        }

        const message = await orchestrator.requestSpeak(params.agentId, params.context)
        return { message }
      })
    }
  )

  // 获取会话状态
  ipcMain.handle(IpcChannel.GroupChat_GetState, async (_event, params: { sessionId: string }) => {
    return safeHandle('groupchat:getState', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      const state = orchestrator.getState()
      return {
        config: state.config,
        agents: orchestrator.getAgents(),
        messages: orchestrator.getMessages(),
        currentRound: state.currentRound,
        isActive: state.isActive,
        topic: state.topic
      }
    })
  })

  // 获取消息历史
  ipcMain.handle(IpcChannel.GroupChat_GetMessages, async (_event, params: { sessionId: string }) => {
    return safeHandle('groupchat:getMessages', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      return orchestrator.getMessages()
    })
  })

  // 获取 Agents 列表
  ipcMain.handle(IpcChannel.GroupChat_GetAgents, async (_event, params: { sessionId: string }) => {
    return safeHandle('groupchat:getAgents', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      return orchestrator.getAgents()
    })
  })

  // 销毁会话
  ipcMain.handle(IpcChannel.GroupChat_Destroy, async (_event, params: { sessionId: string }) => {
    return safeHandle('groupchat:destroy', () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (orchestrator) {
        activeSessions.delete(params.sessionId)
        logger.info('Group chat session destroyed', { sessionId: params.sessionId })
      }
      return { success: true }
    })
  })

  // 获取活跃会话列表
  ipcMain.handle(IpcChannel.GroupChat_ListSessions, async () => {
    return safeHandle('groupchat:listSessions', () => {
      const sessions = Array.from(activeSessions.entries()).map(([id, orchestrator]) => {
        const state = orchestrator.getState()
        const agentIds = Array.from(state.agents.keys())
        logger.debug('Session info', {
          id,
          name: state.config.name,
          agentCount: state.agents.size,
          agentIds
        })
        return {
          id,
          name: state.config.name,
          isActive: state.isActive,
          agentCount: state.agents.size,
          messageCount: state.messages.length
        }
      })
      return sessions
    })
  })

  // 适配 Assistant 为 UnifiedAgent
  ipcMain.handle(
    IpcChannel.GroupChat_AdaptAssistant,
    async (
      _event,
      params: {
        assistant: {
          id: string
          name: string
          prompt: string
          emoji?: string
          description?: string
          model?: { id: string }
          tags?: string[]
          enableMemory?: boolean
        }
      }
    ) => {
      return safeHandle('groupchat:adaptAssistant', () => {
        const adapter = getUnifiedAgentAdapter()
        const unifiedAgent = adapter.fromAssistant(params.assistant)
        return unifiedAgent
      })
    }
  )

  // 获取所有 UnifiedAgents
  ipcMain.handle(IpcChannel.GroupChat_GetUnifiedAgents, async () => {
    return safeHandle('groupchat:getUnifiedAgents', () => {
      const adapter = getUnifiedAgentAdapter()
      return adapter.getAllAgents()
    })
  })

  // 中断正在进行的请求
  ipcMain.handle(IpcChannel.GroupChat_Interrupt, async (_event, params: { sessionId: string; agentId?: string }) => {
    return safeHandle('groupchat:interrupt', async () => {
      const orchestrator = activeSessions.get(params.sessionId)
      if (!orchestrator) {
        throw new Error(`Session not found: ${params.sessionId}`)
      }

      await orchestrator.interrupt(params.agentId)
      logger.info('Group chat interrupted', { sessionId: params.sessionId, agentId: params.agentId })
      return { success: true }
    })
  })

  // 重新回复消息
  ipcMain.handle(
    IpcChannel.GroupChat_RedoMessage,
    async (_event, params: { sessionId: string; messageId: string; agentId: string }) => {
      return safeHandle('groupchat:redoMessage', async () => {
        const orchestrator = activeSessions.get(params.sessionId)
        if (!orchestrator) {
          throw new Error(`Session not found: ${params.sessionId}`)
        }

        const newMessage = await orchestrator.redoMessage(params.messageId, params.agentId)
        logger.info('Message redo requested', {
          sessionId: params.sessionId,
          messageId: params.messageId,
          agentId: params.agentId
        })
        return { success: true, message: newMessage }
      })
    }
  )

  logger.info('GroupChat IPC handlers registered successfully')
}

/**
 * 获取活跃会话数量
 */
export function getActiveSessionCount(): number {
  return activeSessions.size
}

/**
 * 清理所有会话
 */
export function clearAllSessions(): void {
  for (const [id] of activeSessions) {
    activeSessions.delete(id)
  }
  logger.info('All group chat sessions cleared')
}
