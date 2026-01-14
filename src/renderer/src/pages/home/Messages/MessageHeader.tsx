import EmojiAvatar from '@renderer/components/Avatar/EmojiAvatar'
import { HStack } from '@renderer/components/Layout'
import UserPopup from '@renderer/components/Popups/UserPopup'
import { APP_NAME, AppLogo, isLocalAi } from '@renderer/config/env'
import { getModelLogoById } from '@renderer/config/models'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useAgent } from '@renderer/hooks/agents/useAgent'
import useAvatar from '@renderer/hooks/useAvatar'
import { useChatContext } from '@renderer/hooks/useChatContext'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useMessageStyle, useSettings } from '@renderer/hooks/useSettings'
import { getMessageModelId } from '@renderer/services/MessagesService'
import { getModelName } from '@renderer/services/ModelService'
import type { Assistant, Model, Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { firstLetter, isEmoji, removeLeadingEmoji } from '@renderer/utils'
import { Avatar, Checkbox, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { Sparkle } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ROLE_COLORS, ROLE_LABELS } from '../components/GroupChat/constants'

interface Props {
  message: Message
  assistant: Assistant
  model?: Model
  topic: Topic
  isGroupContextMessage?: boolean
}

const getAvatarSource = (isLocalAi: boolean, modelId: string | undefined) => {
  if (isLocalAi) return AppLogo
  return modelId ? getModelLogoById(modelId) : undefined
}

const MessageHeader: FC<Props> = memo(({ assistant, model, message, topic, isGroupContextMessage }) => {
  const avatar = useAvatar()
  const { theme } = useTheme()
  const { userName, sidebarIcons } = useSettings()
  const { chat } = useRuntime()
  const { activeTopicOrSession, activeAgentId } = chat
  const { agent } = useAgent(activeAgentId)
  const isAgentView = activeTopicOrSession === 'session'
  const { t } = useTranslation()
  const { isBubbleStyle } = useMessageStyle()
  const { openMinappById } = useMinappPopup()

  const { isMultiSelectMode, selectedMessageIds, handleSelectMessage } = useChatContext(topic)

  const isSelected = selectedMessageIds?.includes(message.id)

  // 检测是否为群聊消息
  const isGroupChatMessage = !!message.groupChatAgentId

  const avatarSource = useMemo(() => {
    // 群聊消息使用 Agent 头像
    if (isGroupChatMessage && message.groupChatAgentAvatar) {
      return message.groupChatAgentAvatar
    }
    return getAvatarSource(isLocalAi, getMessageModelId(message))
  }, [message, isGroupChatMessage])

  const getUserName = useCallback(() => {
    // 群聊消息直接使用 Agent 名称
    if (isGroupChatMessage) {
      return message.groupChatAgentName || t('common.unknown')
    }

    if (isLocalAi && message.role !== 'user') {
      return APP_NAME
    }

    if (isAgentView && message.role === 'assistant') {
      return agent?.name ?? t('common.unknown')
    }

    if (message.role === 'assistant') {
      return getModelName(model) || getMessageModelId(message) || ''
    }

    return userName || t('common.you')
  }, [agent?.name, isAgentView, message, model, t, userName, isGroupChatMessage])

  const isAssistantMessage = message.role === 'assistant'
  const isUserMessage = message.role === 'user'
  const showMinappIcon = sidebarIcons.visible.includes('minapp')

  const avatarName = useMemo(() => {
    // 群聊消息使用 Agent 名称的首字母
    if (isGroupChatMessage && message.groupChatAgentName) {
      return firstLetter(message.groupChatAgentName).toUpperCase()
    }
    return firstLetter(assistant?.name).toUpperCase()
  }, [assistant?.name, isGroupChatMessage, message.groupChatAgentName])
  const username = useMemo(() => removeLeadingEmoji(getUserName()), [getUserName])

  const showMiniApp = useCallback(() => {
    // 群聊消息不显示 Miniapp
    if (isGroupChatMessage) return
    showMinappIcon && model?.provider && openMinappById(model.provider)
    // because don't need openMinappById to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.provider, showMinappIcon, isGroupChatMessage])

  const userNameJustifyContent = useMemo(() => {
    if (!isBubbleStyle) return 'flex-start'
    if (isUserMessage && !isMultiSelectMode) return 'flex-end'
    return 'flex-start'
  }, [isBubbleStyle, isUserMessage, isMultiSelectMode])

  // 群聊角色标签颜色
  const roleColor = useMemo(() => {
    if (isGroupChatMessage && message.groupChatAgentRole) {
      return ROLE_COLORS[message.groupChatAgentRole] || '#2db7f5'
    }
    return undefined
  }, [isGroupChatMessage, message.groupChatAgentRole])

  // 群聊角色标签
  const roleLabel = useMemo(() => {
    if (isGroupChatMessage && message.groupChatAgentRole) {
      return ROLE_LABELS[message.groupChatAgentRole] || message.groupChatAgentRole
    }
    return undefined
  }, [isGroupChatMessage, message.groupChatAgentRole])

  return (
    <Container className="message-header">
      {isAssistantMessage || isGroupChatMessage ? (
        <Avatar
          src={avatarSource}
          size={35}
          style={{
            borderRadius: '25%',
            cursor: showMinappIcon && !isGroupChatMessage ? 'pointer' : 'default',
            border: isLocalAi ? '1px solid var(--color-border-soft)' : 'none',
            filter: theme === 'dark' ? 'invert(0.05)' : undefined,
            // 群聊消息添加角色颜色边框
            ...(isGroupChatMessage && roleColor ? { border: `2px solid ${roleColor}` } : {})
          }}
          onClick={showMiniApp}>
          {avatarName}
        </Avatar>
      ) : (
        <>
          {isEmoji(avatar) ? (
            <EmojiAvatar onClick={() => UserPopup.show()} size={35} fontSize={20}>
              {avatar}
            </EmojiAvatar>
          ) : (
            <Avatar
              src={avatar}
              size={35}
              style={{ borderRadius: '25%', cursor: 'pointer' }}
              onClick={() => UserPopup.show()}
            />
          )}
        </>
      )}
      <UserWrap>
        <HStack alignItems="center" justifyContent={userNameJustifyContent} gap={6}>
          <UserName isBubbleStyle={isBubbleStyle} theme={theme}>
            {username}
          </UserName>
          {/* 群聊角色标签 */}
          {isGroupChatMessage && roleLabel && (
            <Tag color={roleColor} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
              {roleLabel}
            </Tag>
          )}
          {isGroupContextMessage && (
            <Tooltip title={t('chat.message.useful.tip')}>
              <Sparkle fill="var(--color-primary)" strokeWidth={0} size={18} />
            </Tooltip>
          )}
        </HStack>
        <InfoWrap className="message-header-info-wrap">
          <MessageTime>{dayjs(message?.updatedAt ?? message.createdAt).format('MM/DD HH:mm')}</MessageTime>
        </InfoWrap>
      </UserWrap>
      {isMultiSelectMode && (
        <Checkbox
          checked={isSelected}
          onChange={(e) => handleSelectMessage(message.id, e.target.checked)}
          style={{ position: 'absolute', right: 0, top: 0 }}
        />
      )}
    </Container>
  )
})

MessageHeader.displayName = 'MessageHeader'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  position: relative;
  margin-bottom: 10px;
`

const UserWrap = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
`

const InfoWrap = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`

const UserName = styled.span<{ isBubbleStyle?: boolean; theme?: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => (props.isBubbleStyle && props.theme === 'dark' ? 'white' : 'var(--color-text)')};
`

const MessageTime = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
`

export default MessageHeader
