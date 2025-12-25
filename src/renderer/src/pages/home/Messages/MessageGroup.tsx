import { loggerService } from '@logger'
import Scrollbar from '@renderer/components/Scrollbar'
import { MessageEditingProvider } from '@renderer/context/MessageEditingContext'
import { useChatContext } from '@renderer/hooks/useChatContext'
import { useMessageOperations } from '@renderer/hooks/useMessageOperations'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { MultiModelMessageStyle } from '@renderer/store/settings'
import type { Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { classNames } from '@renderer/utils'
import { scrollIntoView } from '@renderer/utils/dom'
import { Popover } from 'antd'
import type { ComponentProps } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import { useChatMaxWidth } from '../Chat'
import MessageItem from './Message'
import MessageGroupMenuBar from './MessageGroupMenuBar'

const logger = loggerService.withContext('MessageGroup')
interface Props {
  messages: (Message & { index: number })[]
  topic: Topic
  registerMessageElement?: (id: string, element: HTMLElement | null) => void
}

const MessageGroup = ({ messages, topic, registerMessageElement }: Props) => {
  const messageLength = messages.length

  // Hooks
  const { editMessage } = useMessageOperations(topic)
  const { multiModelMessageStyle: multiModelMessageStyleSetting, gridColumns, gridPopoverTrigger } = useSettings()
  const { isMultiSelectMode } = useChatContext(topic)
  const maxWidth = useChatMaxWidth()
  const { setTimeoutTimer } = useTimer()

  const isGrouped = isMultiSelectMode ? false : messageLength > 1 && messages.every((m) => m.role === 'assistant')

  // States
  const [_multiModelMessageStyle, setMultiModelMessageStyle] = useState<MultiModelMessageStyle>(
    messages[0].multiModelMessageStyle || multiModelMessageStyleSetting
  )
  const [selectedIndex, setSelectedIndex] = useState(messageLength - 1)

  // 对于单模型消息，采用简单的样式，避免 overflow 影响内部的 sticky 效果
  const multiModelMessageStyle = useMemo(
    () => (messageLength < 2 ? 'fold' : _multiModelMessageStyle),
    [_multiModelMessageStyle, messageLength]
  )

  const isGrid = multiModelMessageStyle === 'grid'

  const selectedMessageId = useMemo(() => {
    if (messages.length === 1) return messages[0]?.id
    const selectedMessage = messages.find((message) => message.foldSelected)
    if (selectedMessage) {
      return selectedMessage.id
    }
    return messages[0]?.id
  }, [messages])

  const setSelectedMessage = useCallback(
    (message: Message) => {
      // 前一个
      editMessage(selectedMessageId, { foldSelected: false })
      // 当前选中的消息
      editMessage(message.id, { foldSelected: true })

      setTimeoutTimer(
        'setSelectedMessage',
        () => {
          const messageElement = document.getElementById(`message-${message.id}`)
          if (messageElement) {
            scrollIntoView(messageElement, { behavior: 'smooth', block: 'start', container: 'nearest' })
          }
        },
        200
      )
    },
    [editMessage, selectedMessageId, setTimeoutTimer]
  )
  // 添加对流程图节点点击事件的监听
  useEffect(() => {
    // 只在组件挂载和消息数组变化时添加监听器
    if (!isGrouped || messageLength <= 1) return

    const handleFlowNavigate = (event: CustomEvent) => {
      const { messageId } = event.detail

      // 查找对应的消息在当前消息组中的索引
      const targetIndex = messages.findIndex((msg) => msg.id === messageId)

      // 如果找到消息且不是当前选中的索引，则切换标签
      if (targetIndex !== -1 && targetIndex !== selectedIndex) {
        setSelectedIndex(targetIndex)

        // 使用setSelectedMessage函数来切换标签，这是处理foldSelected的关键
        const targetMessage = messages[targetIndex]
        if (targetMessage) {
          setSelectedMessage(targetMessage)
        }
      }
    }

    // 添加事件监听器
    document.addEventListener('flow-navigate-to-message', handleFlowNavigate as EventListener)

    // 清理函数
    return () => {
      document.removeEventListener('flow-navigate-to-message', handleFlowNavigate as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedIndex, isGrouped, messageLength])

  // 使用 ref 存储最新的 messages 和 setSelectedMessage，避免事件监听器重复注册
  const messagesRef = useRef(messages)
  const setSelectedMessageRef = useRef(setSelectedMessage)

  useEffect(() => {
    messagesRef.current = messages
    setSelectedMessageRef.current = setSelectedMessage
  }, [messages, setSelectedMessage])

  // 添加对LOCATE_MESSAGE事件的监听 - 优化版本：使用 ref 避免重复订阅
  useEffect(() => {
    // 为每个消息注册一个定位事件监听器
    // 使用数组存储取消订阅函数
    const unsubscribers: Array<() => void> = []

    const registerHandler = (messageId: string) => {
      const eventName = EVENT_NAMES.LOCATE_MESSAGE + ':' + messageId

      const handler = () => {
        const currentMessages = messagesRef.current
        const currentSetSelectedMessage = setSelectedMessageRef.current
        const message = currentMessages.find((m) => m.id === messageId)
        if (!message) return

        // 检查消息是否处于可见状态
        const element = document.getElementById(`message-${messageId}`)
        if (element) {
          const display = window.getComputedStyle(element).display

          if (display === 'none') {
            // 如果消息隐藏，先切换标签
            currentSetSelectedMessage(message)
          } else {
            // 直接滚动
            scrollIntoView(element, { behavior: 'smooth', block: 'start', container: 'nearest' })
          }
        }
      }

      // Emittery.on 返回取消订阅函数
      const unsubscribe = EventEmitter.on(eventName, handler)
      unsubscribers.push(unsubscribe)
    }

    // 注册当前所有消息的监听器
    messages.forEach((message) => registerHandler(message.id))

    // 清理函数 - 调用所有取消订阅函数
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
    // 只依赖 messages 的 id 列表变化，而不是整个 messages 数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.map((m) => m.id).join(',')])

  useEffect(() => {
    messages.forEach((message) => {
      const element = document.getElementById(`message-${message.id}`)
      element && registerMessageElement?.(message.id, element)
    })
    return () => messages.forEach((message) => registerMessageElement?.(message.id, null))
  }, [messages, registerMessageElement])

  const onUpdateUseful = useCallback(
    (msgId: string) => {
      const message = messages.find((msg) => msg.id === msgId)
      if (!message) {
        logger.error("the message to update doesn't exist in this group")
        return
      }
      if (message.useful) {
        editMessage(msgId, { useful: undefined })
        return
      } else {
        const toResetUsefulMsgs = messages.filter((msg) => msg.id !== msgId && msg.useful)
        toResetUsefulMsgs.forEach(async (msg) => {
          editMessage(msg.id, {
            useful: undefined
          })
        })
        editMessage(msgId, { useful: true })
      }
    },
    [editMessage, messages]
  )

  const groupContextMessageId = useMemo(() => {
    // NOTE: 旧数据可能存在一组消息有多个useful的情况，只取第一个，不再另作迁移
    // find first useful
    const usefulMsg = messages.find((msg) => msg.useful)
    if (usefulMsg) {
      return usefulMsg.id
    } else if (messages.length > 0) {
      return messages[0].id
    } else {
      logger.warn('Empty message group')
      return ''
    }
  }, [messages])

  const renderMessage = useCallback(
    (message: Message & { index: number }) => {
      const isGridGroupMessage = isGrid && message.role === 'assistant' && isGrouped
      const messageProps = {
        isGrouped,
        message,
        topic,
        index: message.index
      } satisfies ComponentProps<typeof MessageItem>

      const messageContent = (
        <MessageWrapper
          id={`message-${message.id}`}
          key={message.id}
          className={classNames([
            {
              [multiModelMessageStyle]: message.role === 'assistant' && messages.length > 1,
              selected: message.id === selectedMessageId
            }
          ])}>
          <MessageItem
            onUpdateUseful={onUpdateUseful}
            isGroupContextMessage={isGrouped && message.id === groupContextMessageId}
            {...messageProps}
          />
        </MessageWrapper>
      )

      if (isGridGroupMessage) {
        return (
          <Popover
            key={message.id}
            destroyOnHidden
            content={
              <MessageWrapper
                className={classNames([
                  'in-popover',
                  {
                    [multiModelMessageStyle]: message.role === 'assistant' && messages.length > 1,
                    selected: message.id === selectedMessageId
                  }
                ])}>
                <MessageItem onUpdateUseful={onUpdateUseful} {...messageProps} />
              </MessageWrapper>
            }
            trigger={gridPopoverTrigger}
            styles={{
              root: { maxWidth: '60vw', overflowY: 'auto', zIndex: 1000 },
              body: { padding: 2 }
            }}>
            {messageContent}
          </Popover>
        )
      }

      return messageContent
    },
    [
      isGrid,
      isGrouped,
      topic,
      multiModelMessageStyle,
      messages,
      selectedMessageId,
      onUpdateUseful,
      groupContextMessageId,
      gridPopoverTrigger
    ]
  )

  return (
    <MessageEditingProvider>
      <GroupContainer
        id={messages[0].askId ? `message-group-${messages[0].askId}` : undefined}
        className={classNames([multiModelMessageStyle, { 'multi-select-mode': isMultiSelectMode }])}
        style={{ maxWidth }}>
        <GridContainer
          $count={messageLength}
          $gridColumns={gridColumns}
          className={classNames([multiModelMessageStyle, { 'multi-select-mode': isMultiSelectMode }])}>
          {messages.map(renderMessage)}
        </GridContainer>
        {isGrouped && (
          <MessageGroupMenuBar
            multiModelMessageStyle={multiModelMessageStyle}
            setMultiModelMessageStyle={(style) => {
              setMultiModelMessageStyle(style)
              messages.forEach((message) => {
                editMessage(message.id, { multiModelMessageStyle: style })
              })
            }}
            messages={messages}
            selectMessageId={selectedMessageId}
            setSelectedMessage={setSelectedMessage}
            topic={topic}
          />
        )}
      </GroupContainer>
    </MessageEditingProvider>
  )
}

const GroupContainer = styled.div`
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width) - var(--assistants-width) - 20px);
  }
  &.horizontal,
  &.grid {
    padding: 4px 10px;
    .group-menu-bar {
      margin-left: 0;
      margin-right: 0;
    }
  }
  &.multi-select-mode {
    padding: 5px 10px;
  }
`

const GridContainer = styled(Scrollbar)<{ $count: number; $gridColumns: number }>`
  width: 100%;
  display: grid;
  overflow-y: visible;
  gap: 16px;

  &.horizontal {
    padding-bottom: 4px;
    grid-template-columns: repeat(${({ $count }) => $count}, minmax(420px, 1fr));
    overflow-x: auto;
  }
  &.fold,
  &.vertical {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 8px;
  }
  &.grid {
    grid-template-columns: repeat(
      ${({ $count, $gridColumns }) => ($count > 1 ? $gridColumns || 2 : 1)},
      minmax(0, 1fr)
    );
    grid-template-rows: auto;
  }

  &.multi-select-mode {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 10px;
    .grid {
      height: auto;
    }
    .message {
      border: 0.5px solid var(--color-border);
      border-radius: 10px;
      padding: 10px;
      .message-content-container {
        max-height: 200px;
        overflow-y: hidden !important;
      }
      .MessageFooter {
        display: none;
      }
    }
  }
`

interface MessageWrapperProps {
  $isInPopover?: boolean
}

const MessageWrapper = styled.div<MessageWrapperProps>`
  &.horizontal {
    padding: 1px;
    overflow-y: auto;
    .message {
      height: 100%;
      border: 0.5px solid var(--color-border);
      border-radius: 10px;
    }
    .message-content-container {
      flex: 1;
      padding-left: 0;
      max-height: calc(100vh - 350px);
      overflow-y: auto !important;
      margin-right: -10px;
    }
    .MessageFooter {
      margin-left: 0;
      margin-top: 2px;
      margin-bottom: 2px;
    }
  }
  &.grid {
    display: block;
    height: 300px;
    overflow-y: hidden;
    border: 0.5px solid var(--color-border);
    border-radius: 10px;
    cursor: pointer;
    .message {
      height: 100%;
    }
    .message-content-container {
      overflow: hidden;
      padding-left: 0;
      flex: 1;
      pointer-events: none;
    }
    .MessageFooter {
      margin-left: 0;
      margin-top: 2px;
      margin-bottom: 2px;
    }
  }
  &.in-popover {
    height: auto;
    border: none;
    max-height: 50vh;
    overflow-y: auto;
    cursor: default;
    .message-content-container {
      padding-left: 0;
      pointer-events: auto;
    }
    .MessageFooter {
      margin-left: 0;
    }
  }
  &.fold {
    display: none;
    &.selected {
      display: inline-block;
    }
  }
`

export default memo(MessageGroup)
