/**
 * GroupChatMessagesContainer - 群聊消息容器
 *
 * 复用原生消息渲染系统，展示群聊消息
 * - 使用原生 Message.tsx 组件渲染
 * - 支持无限滚动
 * - 支持流式消息显示
 */

import { loggerService } from '@logger'
import ContextMenu from '@renderer/components/ContextMenu'
import { LoadingIcon } from '@renderer/components/Icons'
import { LOAD_MORE_COUNT } from '@renderer/config/constant'
import { MessageEditingProvider } from '@renderer/context/MessageEditingContext'
import useScrollPosition from '@renderer/hooks/useScrollPosition'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectMessagesForGroupChat, newMessagesActions } from '@renderer/store/newMessage'
import { TopicType } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfiniteScroll from 'react-infinite-scroll-component'
import styled from 'styled-components'

import { useChatMaxWidth } from '../Chat'
import MessageItem from './Message'
import NarrowLayout from './NarrowLayout'
import { MessagesContainer, ScrollContainer } from './shared'

const logger = loggerService.withContext('GroupChatMessagesContainer')

interface GroupChatMessagesContainerProps {
  /** 群聊会话 ID */
  sessionId: string
  /** 组件更新回调 */
  onComponentUpdate?: () => void
  /** 首次更新回调 */
  onFirstUpdate?: () => void
}

/**
 * 群聊消息容器
 * 使用原生消息系统渲染群聊消息
 */
const GroupChatMessagesContainer: React.FC<GroupChatMessagesContainerProps> = ({
  sessionId,
  onComponentUpdate,
  onFirstUpdate
}) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const maxWidth = useChatMaxWidth()
  const { setTimeoutTimer } = useTimer()
  const { messageNavigation } = useSettings()

  // 滚动位置管理
  const { containerRef: scrollContainerRef, handleScroll: handleScrollPosition } = useScrollPosition(
    `groupchat-${sessionId}`
  )

  // 从 Redux store 获取群聊消息
  const messages = useAppSelector((state) => selectMessagesForGroupChat(state, sessionId))

  // 显示状态
  const [displayMessages, setDisplayMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const displayCount = useAppSelector((state) => state.messages.displayCount)

  const messagesRef = useRef<Message[]>(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 计算显示的消息
  useEffect(() => {
    const newDisplayMessages = computeDisplayMessages(messages, 0, displayCount)
    setDisplayMessages(newDisplayMessages)
    setHasMore(messages.length > displayCount)
  }, [messages, displayCount])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0 })
        }
      })
    }
  }, [scrollContainerRef])

  // 加载更多消息
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoadingMore) return

    setIsLoadingMore(true)
    setTimeoutTimer(
      'loadMoreGroupMessages',
      () => {
        const currentLength = displayMessages.length
        const newMessages = computeDisplayMessages(messages, currentLength, LOAD_MORE_COUNT)

        setDisplayMessages((prev) => [...prev, ...newMessages])
        setHasMore(currentLength + LOAD_MORE_COUNT < messages.length)
        setIsLoadingMore(false)
      },
      300
    )
  }, [displayMessages.length, hasMore, isLoadingMore, messages, setTimeoutTimer])

  // 首次更新回调
  useEffect(() => {
    onFirstUpdate?.()
  }, [onFirstUpdate])

  // 组件更新回调
  useEffect(() => {
    requestAnimationFrame(() => onComponentUpdate?.())
  }, [onComponentUpdate])

  // 渲染单条消息
  const renderMessage = useCallback(
    (message: Message, index: number) => {
      // 创建群聊专用的 topic 对象，包含 type 以启用正确的消息工具栏配置
      const groupChatTopic = {
        id: sessionId,
        name: '群聊',
        type: TopicType.GroupChat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return (
        <MessageWrapper key={message.id} id={`message-${message.id}`}>
          <MessageItem
            message={message}
            topic={groupChatTopic as any}
            index={index}
            isGrouped={false}
          />
        </MessageWrapper>
      )
    },
    [sessionId]
  )

  // 按时间分组消息（群聊不需要像普通消息那样按 askId 分组）
  const groupedMessages = useMemo(() => {
    // 群聊消息按时间顺序显示，倒序排列（最新的在前）
    return [...displayMessages].reverse()
  }, [displayMessages])

  if (messages.length === 0) {
    return (
      <MessagesContainer
        id="messages"
        className="messages-container"
        ref={scrollContainerRef}
        onScroll={handleScrollPosition}>
        <EmptyState>
          <span>💬</span>
          <p>{t('groupchat.empty_messages', '开始群聊后，消息将显示在这里')}</p>
        </EmptyState>
      </MessagesContainer>
    )
  }

  return (
    <MessageEditingProvider>
      <MessagesContainer
        id="messages"
        className="messages-container"
        ref={scrollContainerRef}
        onScroll={handleScrollPosition}>
        <NarrowLayout style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          <InfiniteScroll
            dataLength={displayMessages.length}
            next={loadMoreMessages}
            hasMore={hasMore}
            loader={null}
            scrollableTarget="messages"
            inverse
            style={{ overflow: 'visible' }}>
            <ContextMenu>
              <ScrollContainer>
                <GroupContainer style={{ maxWidth }}>
                  {groupedMessages.map((message, index) => renderMessage(message, index))}
                </GroupContainer>
                {isLoadingMore && (
                  <LoaderContainer>
                    <LoadingIcon color="var(--color-text-2)" />
                  </LoaderContainer>
                )}
              </ScrollContainer>
            </ContextMenu>
          </InfiniteScroll>
        </NarrowLayout>
      </MessagesContainer>
    </MessageEditingProvider>
  )
}

/**
 * 计算要显示的消息
 */
const computeDisplayMessages = (messages: Message[], startIndex: number, displayCount: number) => {
  const reversedMessages = [...messages].reverse()

  if (reversedMessages.length - startIndex <= displayCount) {
    return reversedMessages.slice(startIndex)
  }

  return reversedMessages.slice(startIndex, startIndex + displayCount)
}

const GroupContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const MessageWrapper = styled.div`
  .message {
    border-radius: 10px;
  }
`

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 10px;
  width: 100%;
  background: var(--color-background);
  pointer-events: none;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
  font-size: 14px;
  gap: 8px;

  span {
    font-size: 48px;
  }
`

export default memo(GroupChatMessagesContainer)
