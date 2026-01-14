/**
 * GroupChatInputbar - 群聊输入栏组件
 *
 * 基于 InputbarCore 实现的群聊专用输入栏
 * 支持:
 * - @提及助手
 * - 心流锁控制
 * - 邀请发言
 * - 文件拖放
 */

import { LoadingOutlined, StopOutlined, ThunderboltOutlined, UserAddOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { useInputText } from '@renderer/hooks/useInputText'
import { useTextareaResize } from '@renderer/hooks/useTextareaResize'
import { useTimer } from '@renderer/hooks/useTimer'
import type { GroupAgent } from '@renderer/services/GroupChatService'
import type { Assistant, FileType, Model } from '@renderer/types'
import { TopicType } from '@renderer/types'
import type { FileMetadata } from '@renderer/types'
import { getSendMessageShortcutLabel } from '@renderer/utils/input'
import { imageExts, documentExts, textExts } from '@shared/config/constant'
import { Button, Space, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { InputbarCore } from './components/InputbarCore'
import { InputbarToolsProvider, useInputbarToolsState, useInputbarToolsDispatch } from './context/InputbarToolsProvider'
import InputbarTools from './InputbarTools'
import { getInputbarConfig } from './registry'

const logger = loggerService.withContext('GroupChatInputbar')

export interface GroupChatInputbarProps {
  /** 群聊会话 ID */
  sessionId: string
  /** 可用的 Agent 列表 */
  agents: GroupAgent[]
  /** 是否正在加载（有 Agent 思考中） */
  isLoading?: boolean
  /** 是否启用心流锁 */
  enableFlowLock?: boolean
  /** 发送消息回调 */
  onSendMessage: (content: string, files?: FileMetadata[]) => Promise<void>
  /** 中断回调 */
  onInterrupt?: () => void
  /** 切换心流锁回调 */
  onToggleFlowLock?: () => void
  /** 触发心流锁回调 */
  onTriggerFlowLock?: () => void
  /** 邀请 Agent 发言回调 */
  onInviteAgent?: (agentId: string) => void
  /** 正在思考的 Agent ID 列表 */
  thinkingAgentIds?: Set<string>
  /** 助手对象（用于工具显示） */
  assistant?: Assistant
}

/**
 * 群聊输入栏组件
 */
const GroupChatInputbar: FC<GroupChatInputbarProps> = (props) => {
  const actionsRef = useRef({
    resizeTextArea: () => {},
    onTextChange: (_updater: React.SetStateAction<string> | ((prev: string) => string)) => {},
    toggleExpanded: () => {}
  })

  const initialState = useMemo(
    () => ({
      mentionedModels: [] as Model[],
      selectedKnowledgeBases: [],
      files: [] as FileType[],
      isExpanded: false
    }),
    []
  )

  return (
    <InputbarToolsProvider
      initialState={initialState}
      actions={{
        resizeTextArea: () => actionsRef.current.resizeTextArea(),
        onTextChange: (updater) => actionsRef.current.onTextChange(updater),
        addNewTopic: () => {},
        clearTopic: () => {},
        onNewContext: () => {},
        toggleExpanded: () => actionsRef.current.toggleExpanded()
      }}>
      <GroupChatInputbarInner {...props} actionsRef={actionsRef} />
    </InputbarToolsProvider>
  )
}

interface InnerProps extends GroupChatInputbarProps {
  actionsRef: React.MutableRefObject<{
    resizeTextArea: () => void
    onTextChange: (updater: React.SetStateAction<string> | ((prev: string) => string)) => void
    toggleExpanded: (nextState?: boolean) => void
  }>
}

const GroupChatInputbarInner: FC<InnerProps> = ({
  sessionId,
  agents,
  isLoading = false,
  enableFlowLock = false,
  onSendMessage,
  onInterrupt,
  onToggleFlowLock,
  onTriggerFlowLock,
  onInviteAgent,
  thinkingAgentIds = new Set(),
  assistant,
  actionsRef
}) => {
  const scope = TopicType.GroupChat
  const config = getInputbarConfig(scope)

  const { t } = useTranslation()
  const { setTimeoutTimer } = useTimer()
  const [isSending, setIsSending] = useState(false)

  // 文本状态管理
  const { text, setText, isEmpty: inputEmpty } = useInputText({ initialValue: '' })
  const {
    textareaRef,
    resize: resizeTextArea,
    focus: focusTextarea,
    setExpanded,
    isExpanded: textareaIsExpanded,
    customHeight,
    setCustomHeight
  } = useTextareaResize({ maxHeight: 500, minHeight: 30 })

  const { files } = useInputbarToolsState()
  const { setFiles, setIsExpanded } = useInputbarToolsDispatch()

  const syncExpandedState = useCallback(
    (expanded: boolean) => {
      setExpanded(expanded)
      setIsExpanded(expanded)
    },
    [setExpanded, setIsExpanded]
  )

  const handleToggleExpanded = useCallback(
    (nextState?: boolean) => {
      const target = typeof nextState === 'boolean' ? nextState : !textareaIsExpanded
      syncExpandedState(target)
      focusTextarea()
    },
    [focusTextarea, syncExpandedState, textareaIsExpanded]
  )

  // 更新 actionsRef
  useEffect(() => {
    actionsRef.current = {
      resizeTextArea,
      onTextChange: setText,
      toggleExpanded: handleToggleExpanded
    }
  }, [resizeTextArea, setText, actionsRef, handleToggleExpanded])

  // 发送条件
  const noAgents = agents.length < 2
  const sendDisabled = (inputEmpty && files.length === 0) || noAgents || isSending

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (sendDisabled) return

    setIsSending(true)
    try {
      const messageContent = text.trim()
      const uploadedFiles = files.length > 0 ? files as FileMetadata[] : undefined

      await onSendMessage(messageContent, uploadedFiles)

      // 清空输入
      setText('')
      setFiles([])
      setTimeoutTimer('groupchat_clear', () => resizeTextArea(), 0)
    } catch (error) {
      logger.error('Failed to send group chat message:', error as Error)
    } finally {
      setIsSending(false)
    }
  }, [sendDisabled, text, files, onSendMessage, setText, setFiles, setTimeoutTimer, resizeTextArea])

  // 支持的文件类型
  const supportedExts = useMemo(() => {
    return [...imageExts, ...documentExts, ...textExts]
  }, [])

  // 创建假的 assistant 对象用于工具显示
  const stubAssistant = useMemo<Assistant>(() => {
    return assistant || {
      id: `groupchat-${sessionId}`,
      name: '群聊',
      prompt: '',
      topics: [],
      type: 'assistant',
      tags: [],
      enableWebSearch: false
    } as Assistant
  }, [assistant, sessionId])

  // 左侧工具栏
  const leftToolbar = useMemo(() => {
    return (
      <ToolbarGroup>
        {config.showTools && <InputbarTools scope={scope} assistantId={stubAssistant.id} />}
      </ToolbarGroup>
    )
  }, [config.showTools, scope, stubAssistant.id])

  // 右侧工具栏（群聊专用）
  const rightToolbar = useMemo(() => {
    const hasThinkingAgents = thinkingAgentIds.size > 0

    return (
      <Space size={4}>
        {/* 心流锁切换按钮 */}
        {onToggleFlowLock && (
          <Tooltip title={enableFlowLock ? '关闭心流锁 (Ctrl+Shift+F)' : '开启心流锁 (Ctrl+Shift+F)'}>
            <Button
              type={enableFlowLock ? 'primary' : 'text'}
              size="small"
              icon={<ThunderboltOutlined className={enableFlowLock ? 'flowlock-playing-emoji' : ''} />}
              onClick={onToggleFlowLock}
              style={enableFlowLock ? { background: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : {}}
            />
          </Tooltip>
        )}

        {/* 邀请发言按钮 */}
        {onInviteAgent && agents.length > 0 && (
          <Tooltip title="邀请助手发言">
            <Button
              type="text"
              size="small"
              icon={<UserAddOutlined />}
              disabled={hasThinkingAgents}
              onClick={() => {
                // 默认邀请第一个 Agent 或 host
                const hostAgent = agents.find((a) => a.role === 'host')
                const targetAgent = hostAgent || agents[0]
                if (targetAgent) {
                  onInviteAgent(targetAgent.id)
                }
              }}
            />
          </Tooltip>
        )}

        {/* 中断按钮 */}
        {onInterrupt && hasThinkingAgents && (
          <Tooltip title="中断响应">
            <Button
              type="text"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={onInterrupt}
            />
          </Tooltip>
        )}
      </Space>
    )
  }, [enableFlowLock, onToggleFlowLock, onInviteAgent, onInterrupt, agents, thinkingAgentIds])

  // 顶部内容（思考状态指示）
  const topContent = useMemo(() => {
    if (thinkingAgentIds.size === 0) return null

    const thinkingAgents = agents.filter((a) => thinkingAgentIds.has(a.id))
    if (thinkingAgents.length === 0) return null

    return (
      <ThinkingIndicator>
        <LoadingOutlined spin style={{ marginRight: 8 }} />
        {thinkingAgents.map((a) => a.displayName || a.name).join(', ')} 思考中...
      </ThinkingIndicator>
    )
  }, [agents, thinkingAgentIds])

  // Placeholder
  const placeholderText = useMemo(() => {
    if (noAgents) {
      return t('groupchat.input.no_agents', '请至少添加 2 个助手')
    }
    return config.placeholder || t('groupchat.input.placeholder', '输入消息，使用 @名称 提及特定助手...')
  }, [noAgents, config.placeholder, t])

  // 焦点
  useEffect(() => {
    if (!document.querySelector('.topview-fullscreen-container')) {
      focusTextarea()
    }
  }, [focusTextarea])

  return (
    <InputbarCore
      scope={TopicType.GroupChat}
      text={text}
      onTextChange={setText}
      textareaRef={textareaRef}
      height={customHeight}
      onHeightChange={setCustomHeight}
      resizeTextArea={resizeTextArea}
      focusTextarea={focusTextarea}
      placeholder={placeholderText}
      supportedExts={supportedExts}
      onPause={onInterrupt}
      isLoading={isLoading || isSending}
      handleSendMessage={handleSendMessage}
      leftToolbar={leftToolbar}
      rightToolbar={rightToolbar}
      topContent={topContent}
      forceEnableQuickPanelTriggers
    />
  )
}

const ToolbarGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--color-warning);
  background: var(--color-warning-bg);
  border-radius: 4px;
  margin-bottom: 4px;
`

export default GroupChatInputbar
