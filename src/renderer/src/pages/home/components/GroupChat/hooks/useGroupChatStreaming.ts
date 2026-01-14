/**
 * 群聊流式渲染 Hook
 *
 * 统一管理 StreamManager 的初始化和订阅，避免多组件重复设置
 */

import { getStreamManager, type StreamingMessage } from '@renderer/services/GroupChatStreamManager'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseGroupChatStreamingOptions {
  sessionId: string | null
  /** 滚动到底部的回调 */
  onScrollToBottom?: () => void
}

export interface UseGroupChatStreamingReturn {
  /** 流式消息列表 */
  streamingMessages: StreamingMessage[]
  /** 正在思考的 Agent ID 集合 */
  thinkingAgentIds: Set<string>
  /** StreamManager 引用 */
  streamManagerRef: React.MutableRefObject<ReturnType<typeof getStreamManager> | null>
}

/**
 * 群聊流式渲染 Hook
 */
export function useGroupChatStreaming(options: UseGroupChatStreamingOptions): UseGroupChatStreamingReturn {
  const { sessionId, onScrollToBottom } = options

  // 流式消息状态
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([])
  const [thinkingAgentIds, setThinkingAgentIds] = useState<Set<string>>(new Set())

  // StreamManager 引用
  const streamManagerRef = useRef<ReturnType<typeof getStreamManager> | null>(null)

  // 稳定的 scrollToBottom 引用
  const scrollToBottomRef = useRef(onScrollToBottom)
  useEffect(() => {
    scrollToBottomRef.current = onScrollToBottom
  }, [onScrollToBottom])

  const scrollToBottom = useCallback(() => {
    scrollToBottomRef.current?.()
  }, [])

  // 初始化 StreamManager
  useEffect(() => {
    if (!sessionId) return

    // 获取或创建会话对应的 StreamManager 实例
    const streamManager = getStreamManager(sessionId)
    streamManagerRef.current = streamManager

    // 使用 subscribe 订阅渲染回调（支持多订阅者）
    const unsubscribe = streamManager.subscribe({
      onRender: (messages) => {
        setStreamingMessages([...messages])
        scrollToBottom()
      },
      onComplete: (messageId, _finalContent) => {
        // 完成时从流式消息列表中移除
        setStreamingMessages((prev) => prev.filter((m) => m.messageId !== messageId))
      },
      onThinking: (agentId, _agentName) => {
        setThinkingAgentIds((prev) => new Set(prev).add(agentId))
      },
      onThinkingEnd: (agentId) => {
        setThinkingAgentIds((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
      }
    })

    return () => {
      unsubscribe()
      streamManagerRef.current = null
    }
  }, [sessionId, scrollToBottom])

  return {
    streamingMessages,
    thinkingAgentIds,
    streamManagerRef
  }
}
