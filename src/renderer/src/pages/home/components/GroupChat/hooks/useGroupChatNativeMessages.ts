/**
 * useGroupChatNativeMessages - 群聊原生消息 Hook
 *
 * 将群聊事件转换为原生 Message/Block 并存储到 Redux
 * 作为 GroupChatService 与原生消息系统的桥接层
 */

import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { upsertOneBlock, updateOneBlock } from '@renderer/store/messageBlock'
import { newMessagesActions, selectMessagesForGroupChat } from '@renderer/store/newMessage'
import { groupChatService, type GroupAgent, type GroupChatEvent, type GroupMessage } from '@renderer/services/GroupChatService'
import {
  createStreamingMessage,
  createUserMessage,
  groupMessageToNative,
  parseMentions
} from '@renderer/services/GroupChatMessageAdapter'
import type { Message, MainTextMessageBlock } from '@renderer/types/newMessage'
import { MessageBlockStatus, MessageBlockType, AssistantMessageStatus } from '@renderer/types/newMessage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { throttle } from 'lodash'

const logger = loggerService.withContext('useGroupChatNativeMessages')

export interface UseGroupChatNativeMessagesOptions {
  /** 群聊会话 ID */
  sessionId: string | null
  /** 可用的 Agent 列表 */
  agents: GroupAgent[]
  /** 滚动到底部回调 */
  onScrollToBottom?: () => void
}

export interface UseGroupChatNativeMessagesReturn {
  /** 原生消息列表 */
  messages: Message[]
  /** 正在流式输出的 Block ID 映射 (agentId -> blockId) */
  streamingBlocks: Map<string, string>
  /** 正在思考的 Agent ID 集合 */
  thinkingAgentIds: Set<string>
  /** 发送用户消息 */
  sendUserMessage: (content: string) => void
}

/**
 * 群聊原生消息 Hook
 * 订阅 GroupChatService 事件，转换并存储到 Redux
 */
export function useGroupChatNativeMessages(
  options: UseGroupChatNativeMessagesOptions
): UseGroupChatNativeMessagesReturn {
  const { sessionId, agents, onScrollToBottom } = options
  const dispatch = useAppDispatch()

  // 从 Redux 获取原生消息
  const messages = useAppSelector((state) =>
    sessionId ? selectMessagesForGroupChat(state, sessionId) : []
  )

  // 流式状态
  const [streamingBlocks, setStreamingBlocks] = useState<Map<string, string>>(new Map())
  const [thinkingAgentIds, setThinkingAgentIds] = useState<Set<string>>(new Set())

  // Refs for stable callbacks
  const agentsRef = useRef(agents)
  useEffect(() => {
    agentsRef.current = agents
  }, [agents])

  // 节流的 block 更新函数
  const throttledBlockUpdates = useRef<Map<string, ReturnType<typeof throttle>>>(new Map())

  const getThrottledBlockUpdate = useCallback((blockId: string) => {
    if (!throttledBlockUpdates.current.has(blockId)) {
      const throttledFn = throttle(
        (content: string) => {
          dispatch(updateOneBlock({
            id: blockId,
            changes: {
              content,
              status: MessageBlockStatus.STREAMING
            }
          }))
        },
        150, // 150ms 节流，与原生系统一致
        { leading: true, trailing: true }
      )
      throttledBlockUpdates.current.set(blockId, throttledFn)
    }
    return throttledBlockUpdates.current.get(blockId)!
  }, [dispatch])

  /**
   * 发送用户消息
   */
  const sendUserMessage = useCallback((content: string) => {
    if (!sessionId) return

    const { message, blocks } = createUserMessage(content, sessionId)

    // 添加消息到 Redux
    dispatch(newMessagesActions.addMessage({ topicId: sessionId, message }))

    // 添加 blocks 到 Redux
    for (const block of blocks) {
      dispatch(upsertOneBlock(block))
    }

    onScrollToBottom?.()
    logger.debug('User message added to native store', { messageId: message.id })
  }, [sessionId, dispatch, onScrollToBottom])

  /**
   * 处理群聊事件
   */
  const handleEvent = useCallback(async (event: GroupChatEvent) => {
    if (event.sessionId !== sessionId) return

    switch (event.type) {
      case 'agent:thinking': {
        if (event.agentId) {
          setThinkingAgentIds(prev => new Set(prev).add(event.agentId!))

          // 找到对应的 Agent
          const agent = agentsRef.current.find(a => a.id === event.agentId)
          if (agent) {
            // 创建流式消息占位
            const { message, blocks, blockId } = createStreamingMessage(agent, sessionId!)

            // 添加到 Redux
            dispatch(newMessagesActions.addMessage({ topicId: sessionId!, message }))
            for (const block of blocks) {
              dispatch(upsertOneBlock(block))
            }

            // 记录流式 Block ID
            setStreamingBlocks(prev => new Map(prev).set(event.agentId!, blockId))

            logger.debug('Streaming message created', {
              agentId: event.agentId,
              messageId: message.id,
              blockId
            })
          }
        }
        break
      }

      case 'agent:stream': {
        if (event.agentId && event.accumulatedContent !== undefined) {
          const blockId = streamingBlocks.get(event.agentId)
          if (blockId) {
            // 使用节流更新 block 内容
            const throttledUpdate = getThrottledBlockUpdate(blockId)
            throttledUpdate(event.accumulatedContent)
          }
        }
        break
      }

      case 'agent:speak': {
        if (event.message && event.agentId) {
          // 移除思考状态
          setThinkingAgentIds(prev => {
            const next = new Set(prev)
            next.delete(event.agentId!)
            return next
          })

          // 检查是否已有流式消息（需要完成它）
          const existingBlockId = streamingBlocks.get(event.agentId)

          if (existingBlockId) {
            // 完成流式消息：更新 block 状态为 SUCCESS
            dispatch(updateOneBlock({
              id: existingBlockId,
              changes: {
                content: event.message.content,
                status: MessageBlockStatus.SUCCESS
              }
            }))

            // 更新消息状态为 SUCCESS
            // 找到对应的消息 ID
            const messageId = messages.find(m =>
              m.groupChatAgentId === event.agentId &&
              m.status === AssistantMessageStatus.PROCESSING
            )?.id

            if (messageId) {
              dispatch(newMessagesActions.updateMessage({
                topicId: sessionId!,
                messageId,
                updates: { status: AssistantMessageStatus.SUCCESS }
              }))
            }

            // 清理流式状态
            setStreamingBlocks(prev => {
              const next = new Map(prev)
              next.delete(event.agentId!)
              return next
            })

            // 清理节流函数
            const throttledFn = throttledBlockUpdates.current.get(existingBlockId)
            if (throttledFn) {
              throttledFn.flush()
              throttledBlockUpdates.current.delete(existingBlockId)
            }

            logger.debug('Streaming message completed', {
              agentId: event.agentId,
              blockId: existingBlockId
            })
          } else {
            // 没有流式消息，直接创建完整消息（用于非流式或错误恢复）
            const agent = agentsRef.current.find(a => a.id === event.agentId) || null
            const { message, blocks } = groupMessageToNative(
              event.message,
              agent,
              sessionId!
            )

            // 检查消息是否已存在
            const exists = messages.some(m => m.id === message.id)
            if (!exists) {
              dispatch(newMessagesActions.addMessage({ topicId: sessionId!, message }))
              for (const block of blocks) {
                dispatch(upsertOneBlock(block))
              }
              logger.debug('Complete message added', { messageId: message.id })
            }
          }

          onScrollToBottom?.()
        }
        break
      }

      case 'chat:end': {
        // 清理所有流式状态
        setThinkingAgentIds(new Set())
        setStreamingBlocks(new Map())

        // 清理所有节流函数
        for (const [, fn] of throttledBlockUpdates.current) {
          fn.flush()
        }
        throttledBlockUpdates.current.clear()
        break
      }
    }
  }, [sessionId, dispatch, streamingBlocks, getThrottledBlockUpdate, messages, onScrollToBottom])

  // 订阅群聊事件
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = groupChatService.subscribe(handleEvent)
    logger.info('Subscribed to group chat events for native messages', { sessionId })

    return () => {
      unsubscribe()
      // 清理节流函数
      for (const [, fn] of throttledBlockUpdates.current) {
        fn.cancel()
      }
      throttledBlockUpdates.current.clear()
      logger.info('Unsubscribed from group chat events', { sessionId })
    }
  }, [sessionId, handleEvent])

  return {
    messages,
    streamingBlocks,
    thinkingAgentIds,
    sendUserMessage
  }
}
