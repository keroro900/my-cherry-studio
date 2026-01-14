/**
 * 群聊事件处理 Hook
 *
 * 统一处理群聊事件订阅和状态更新，避免多组件重复订阅
 */

import { loggerService } from '@logger'
import { groupChatPersistence, type GroupMessage as PersistentGroupMessage, type GroupSession } from '@renderer/services/GroupChatPersistenceService'
import { groupChatService, type GroupAgent, type GroupChatEvent, type GroupMessage } from '@renderer/services/GroupChatService'
import { useCallback, useEffect, useRef, useState } from 'react'

const logger = loggerService.withContext('useGroupChatEvents')

export interface UseGroupChatEventsOptions {
  sessionId: string | null
  /** 是否启用持久化 */
  enablePersistence?: boolean
  /** 滚动到底部的回调 */
  onScrollToBottom?: () => void
  /** 话题更新回调 */
  onTopicUpdate?: (topic: string) => void
  /** 聊天开始回调 */
  onChatStart?: () => void
  /** 聊天结束回调 */
  onChatEnd?: () => void
}

export interface UseGroupChatEventsReturn {
  /** Agent 列表 */
  agents: GroupAgent[]
  /** 更新 Agent 列表 */
  setAgents: React.Dispatch<React.SetStateAction<GroupAgent[]>>
  /** 消息列表 */
  messages: GroupMessage[]
  /** 更新消息列表 */
  setMessages: React.Dispatch<React.SetStateAction<GroupMessage[]>>
  /** 正在思考的 Agent ID 集合 */
  thinkingAgentIds: Set<string>
  /** 是否活跃 */
  isActive: boolean
  /** 设置是否活跃 */
  setIsActive: React.Dispatch<React.SetStateAction<boolean>>
  /** agents 的 ref (避免闭包问题) */
  agentsRef: React.MutableRefObject<GroupAgent[]>
}

/**
 * 群聊事件处理 Hook
 */
export function useGroupChatEvents(options: UseGroupChatEventsOptions): UseGroupChatEventsReturn {
  const { sessionId, enablePersistence = false, onScrollToBottom, onTopicUpdate, onChatStart, onChatEnd } = options

  // 状态
  const [agents, setAgents] = useState<GroupAgent[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [thinkingAgentIds, setThinkingAgentIds] = useState<Set<string>>(new Set())
  const [isActive, setIsActive] = useState(false)

  // Refs
  const agentsRef = useRef<GroupAgent[]>([])

  // 同步 agents 到 ref
  useEffect(() => {
    agentsRef.current = agents
  }, [agents])

  /**
   * 处理群聊事件
   */
  const handleEvent = useCallback(
    async (event: GroupChatEvent) => {
      if (event.sessionId !== sessionId) return

      logger.debug('GroupChat event received', { type: event.type })

      switch (event.type) {
        case 'agent:join':
          if (event.agent) {
            setAgents((prev) => {
              if (prev.some((a) => a.id === event.agent!.id)) {
                return prev
              }
              return [...prev, event.agent!]
            })
          }
          break

        case 'agent:leave':
          if (event.agentId) {
            setAgents((prev) => prev.filter((a) => a.id !== event.agentId))
          }
          break

        case 'agent:speak':
          if (event.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === event.message!.id)) {
                return prev
              }
              return [...prev, event.message!]
            })

            if (event.agentId) {
              setThinkingAgentIds((prev) => {
                const next = new Set(prev)
                next.delete(event.agentId!)
                return next
              })
            }

            onScrollToBottom?.()

            // 持久化消息
            if (enablePersistence) {
              try {
                await groupChatPersistence.saveMessage(event.message as unknown as PersistentGroupMessage, sessionId!)
              } catch (error) {
                logger.error('Failed to persist message', error as Error)
              }
            }
          }
          break

        case 'agent:thinking':
          if (event.agentId) {
            setAgents((prev) => prev.map((a) => (a.id === event.agentId ? { ...a, status: 'thinking' as const } : a)))
          }
          break

        case 'chat:start':
          setIsActive(true)
          onChatStart?.()

          // 持久化会话
          if (enablePersistence && event.config && sessionId) {
            try {
              const session: GroupSession = {
                id: sessionId,
                name: event.config.name || 'Group Chat',
                speakingMode: event.config.speakingMode || 'sequential',
                hostAgentId: event.config.hostAgentId,
                topic: event.topic,
                agentIds: agentsRef.current.map((a) => a.id),
                isActive: true,
                currentRound: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }
              await groupChatPersistence.saveSession(session)
            } catch (error) {
              logger.error('Failed to persist session', error as Error)
            }
          }
          break

        case 'chat:end':
          setIsActive(false)
          setThinkingAgentIds(new Set())
          onChatEnd?.()

          // 更新会话状态
          if (enablePersistence && sessionId) {
            try {
              await groupChatPersistence.updateSessionStatus(sessionId, false)
            } catch (error) {
              logger.error('Failed to update session status', error as Error)
            }
          }
          break

        case 'topic:updated':
          if (event.topic) {
            onTopicUpdate?.(event.topic)
          }
          break
      }
    },
    [sessionId, enablePersistence, onScrollToBottom, onTopicUpdate, onChatStart, onChatEnd]
  )

  // 订阅事件
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = groupChatService.subscribe(handleEvent)
    logger.info('Subscribed to group chat events', { sessionId })

    return () => {
      unsubscribe()
      logger.info('Unsubscribed from group chat events', { sessionId })
    }
  }, [sessionId, handleEvent])

  return {
    agents,
    setAgents,
    messages,
    setMessages,
    thinkingAgentIds,
    isActive,
    setIsActive,
    agentsRef
  }
}
