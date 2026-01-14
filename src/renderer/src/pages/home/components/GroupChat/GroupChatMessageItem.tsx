/**
 * GroupChatMessageItem - 群聊消息项组件 (重构版)
 *
 * 复用普通聊天样式，移除 VCP 毛玻璃风格
 * Features:
 * - 与普通聊天一致的卡片样式
 * - Role-specific accent colors
 * - Enhanced action buttons
 */

import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  ReloadOutlined,
  SaveOutlined,
  SoundOutlined,
  TranslationOutlined
} from '@ant-design/icons'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import type { GroupMessage } from '@renderer/services/GroupChatService'
import type { MainTextMessageBlock } from '@renderer/types/newMessage'
import { MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import type { MenuProps } from 'antd'
import { Avatar, Button, Dropdown, message as antdMessage, Tooltip } from 'antd'
import { motion } from 'motion/react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

import Markdown from '../../Markdown/Markdown'
import { ROLE_COLORS, ROLE_LABELS } from './constants'

interface Props {
  message: GroupMessage
  isUser?: boolean
  isStreaming?: boolean
  avatar?: string
  /** 显示名称 */
  displayName?: string
  /** 角色标签 */
  roleLabel?: string
  /** 是否是最后一条消息 */
  isLastMessage?: boolean
  /** 重新回答回调 */
  onRedo?: (messageId: string, agentId: string) => void
  /** 删除消息回调 */
  onDelete?: (messageId: string) => void
  /** 编辑消息回调 */
  onEdit?: (messageId: string, newContent: string) => void
}

/**
 * 将群聊消息内容转换为 MainTextMessageBlock 格式
 * 以便复用原生 Markdown 组件
 */
function messageToBlock(message: GroupMessage, isStreaming: boolean): MainTextMessageBlock {
  return {
    id: message.id,
    messageId: message.id,
    type: MessageBlockType.MAIN_TEXT,
    content: message.content,
    status: isStreaming ? MessageBlockStatus.STREAMING : MessageBlockStatus.SUCCESS,
    createdAt: typeof message.timestamp === 'string' ? message.timestamp : message.timestamp.toISOString()
  }
}

const GroupChatMessageItem: React.FC<Props> = ({
  message,
  isUser = false,
  isStreaming = false,
  avatar,
  displayName,
  roleLabel,
  isLastMessage = false,
  onRedo,
  onDelete,
  onEdit
}) => {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  // 将消息转换为 block 格式
  const block = useMemo(() => messageToBlock(message, isStreaming), [message, isStreaming])

  // 格式化时间
  const formattedTime = useMemo(() => {
    const date = typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [message.timestamp])

  // 获取头像显示
  const avatarDisplay = useMemo(() => {
    if (isUser) {
      return '👤'
    }
    return avatar || message.agentName?.charAt(0) || '🤖'
  }, [isUser, avatar, message.agentName])

  const name = displayName || message.agentName

  // 获取角色颜色
  const roleColor = useMemo(() => {
    return roleLabel ? ROLE_COLORS[roleLabel] || ROLE_COLORS.participant : undefined
  }, [roleLabel])

  // 获取角色标签显示文本
  const roleLabelText = useMemo(() => {
    return roleLabel ? ROLE_LABELS[roleLabel] || roleLabel : undefined
  }, [roleLabel])

  // 处理复制消息
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      antdMessage.success(t('message.copied') || '已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      antdMessage.error(t('message.copy.failed') || '复制失败')
    }
  }, [message.content, t])

  // 处理重新回答
  const handleRedo = useCallback(() => {
    if (onRedo && message.id && message.agentId) {
      onRedo(message.id, message.agentId)
    }
  }, [onRedo, message.id, message.agentId])

  // 处理删除消息
  const handleDelete = useCallback(() => {
    if (onDelete && message.id) {
      onDelete(message.id)
    }
  }, [onDelete, message.id])

  // 处理编辑
  const handleEditStart = useCallback(() => {
    setEditContent(message.content)
    setIsEditing(true)
  }, [message.content])

  const handleEditSave = useCallback(() => {
    if (onEdit && message.id) {
      onEdit(message.id, editContent)
    }
    setIsEditing(false)
  }, [onEdit, message.id, editContent])

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
    setEditContent(message.content)
  }, [message.content])

  // 处理朗读
  const handleReadAloud = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message.content)
      utterance.lang = 'zh-CN'
      speechSynthesis.speak(utterance)
      antdMessage.info('开始朗读')
    } else {
      antdMessage.warning('您的浏览器不支持语音合成')
    }
  }, [message.content])

  // 是否显示操作按钮
  const showActions = !isStreaming

  // 更多菜单项
  const moreMenuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: t('common.edit') || '编辑',
        onClick: handleEditStart
      },
      {
        key: 'readAloud',
        icon: <SoundOutlined />,
        label: t('chat.message.read_aloud') || '朗读',
        onClick: handleReadAloud
      },
      { type: 'divider' },
      {
        key: 'save',
        icon: <SaveOutlined />,
        label: t('common.save') || '保存',
        children: [
          {
            key: 'saveToFile',
            label: t('chat.message.save_to_file') || '保存为文件'
          },
          {
            key: 'saveToNotes',
            label: t('chat.message.save_to_notes') || '保存到笔记'
          }
        ]
      }
    ]

    if (onDelete) {
      items.push(
        { type: 'divider' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: t('common.delete') || '删除',
          danger: true,
          onClick: handleDelete
        }
      )
    }

    return items
  }, [t, handleEditStart, handleReadAloud, handleDelete, onDelete])

  return (
    <MessageContainer
      $isUser={isUser}
      $roleColor={roleColor}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      as={motion.div}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}>
      {/* 消息头部 */}
      <MessageHeader>
        <AvatarWrapper $isUser={isUser} $roleColor={roleColor}>
          <Avatar
            size={36}
            style={{
              backgroundColor: isUser
                ? 'var(--color-primary)'
                : roleColor || 'var(--color-primary)'
            }}>
            {avatarDisplay}
          </Avatar>
        </AvatarWrapper>
        <HeaderInfo>
          <NameRow>
            <AgentName $roleColor={!isUser ? roleColor : undefined}>{name}</AgentName>
            {roleLabelText && !isUser && (
              <RoleTag $roleColor={roleColor}>
                {roleLabelText}
              </RoleTag>
            )}
          </NameRow>
          <TimeStamp>{formattedTime}</TimeStamp>
        </HeaderInfo>
      </MessageHeader>

      {/* 消息内容 */}
      <MessageContentStyled className="message-content-container">
        {isEditing ? (
          <EditContainer>
            <EditTextarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleEditSave()
                } else if (e.key === 'Escape') {
                  handleEditCancel()
                }
              }}
            />
            <EditActions>
              <Button size="small" onClick={handleEditCancel}>
                {t('common.cancel') || '取消'}
              </Button>
              <Button size="small" type="primary" onClick={handleEditSave}>
                {t('common.save') || '保存'}
              </Button>
            </EditActions>
          </EditContainer>
        ) : (
          <>
            <Markdown block={block} />
            {isStreaming && <StreamingIndicator />}
          </>
        )}
      </MessageContentStyled>

      {/* 操作按钮区域 - 悬浮显示或最后一条消息始终显示 */}
      {showActions && (isHovered || isLastMessage) && !isEditing && (
        <MessageFooter>
          <HorizontalScrollContainer>
            <ActionsContainer>
              <Tooltip title={copied ? t('message.copied') || '已复制' : t('common.copy') || '复制'}>
                <ActionButton
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  size="small"
                  type="text"
                  onClick={handleCopy}
                />
              </Tooltip>

              {!isUser && onRedo && (
                <Tooltip title={t('chat.message.regenerate') || '重新生成'}>
                  <ActionButton icon={<ReloadOutlined />} size="small" type="text" onClick={handleRedo} />
                </Tooltip>
              )}

              <Tooltip title={t('chat.message.translate') || '翻译'}>
                <ActionButton icon={<TranslationOutlined />} size="small" type="text" disabled />
              </Tooltip>

              <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
                <ActionButton icon={<MoreOutlined />} size="small" type="text" />
              </Dropdown>
            </ActionsContainer>
          </HorizontalScrollContainer>
        </MessageFooter>
      )}
    </MessageContainer>
  )
}

// Keyframe animations
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const streamingPulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
`

// ==================== Styled Components - 普通聊天风格 ====================

const MessageContainer = styled.div<{ $isUser?: boolean; $roleColor?: string }>`
  display: flex;
  flex-direction: column;
  padding: 10px;
  padding-bottom: 0;
  border-radius: 10px;
  margin-bottom: 4px;
  animation: ${fadeInUp} 0.2s ease-out;
  transition: background-color 0.3s ease;
  background: var(--color-background);
  color: var(--color-text);

  .menubar {
    opacity: 0;
    transition: opacity 0.2s ease;
    &.show {
      opacity: 1;
    }
  }

  &:hover {
    .menubar {
      opacity: 1;
    }
  }

  /* 高亮动画 */
  &.animation-locate-highlight {
    animation: highlight-pulse 1s ease-out;
  }

  @keyframes highlight-pulse {
    0% {
      background-color: var(--color-primary-light);
    }
    100% {
      background-color: transparent;
    }
  }
`

const MessageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 0;
`

const AvatarWrapper = styled.div<{ $isUser: boolean; $roleColor?: string }>`
  flex-shrink: 0;
  position: relative;

  .ant-avatar {
    border: 2px solid ${({ $isUser, $roleColor }) =>
      $isUser ? 'var(--color-primary)' : ($roleColor || 'var(--color-primary)')};
  }
`

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const AgentName = styled.span<{ $roleColor?: string }>`
  font-weight: 600;
  font-size: 13px;
  color: ${({ $roleColor }) => $roleColor || 'var(--color-text)'};
`

const RoleTag = styled.span<{ $roleColor?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: ${({ $roleColor }) =>
    $roleColor ? `${$roleColor}20` : 'var(--color-primary-soft)'};
  color: ${({ $roleColor }) => $roleColor || 'var(--color-primary)'};
  font-weight: 500;
`

const TimeStamp = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
`

const MessageContentStyled = styled.div`
  padding-left: 46px; /* Avatar size + gap */
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text);
  margin-top: 0;

  .markdown {
    margin: 0;
  }

  pre {
    margin: 8px 0;
    border-radius: 8px;
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
  }

  p {
    margin: 0 0 8px 0;

    &:last-child {
      margin-bottom: 0;
    }
  }

  code {
    background: var(--color-background-soft);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--color-primary);
  }

  blockquote {
    border-left: 3px solid var(--color-primary);
    padding-left: 14px;
    margin: 8px 0;
    color: var(--color-text-2);
    background: var(--color-background-soft);
    padding: 10px 14px;
    border-radius: 0 8px 8px 0;
  }
`

const MessageFooter = styled.div`
  padding-left: 46px;
  margin-top: 3px;
`

const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`

const ActionButton = styled(Button)`
  color: var(--color-text-2);
  padding: 4px 8px;
  height: auto;
  border-radius: 6px;

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  &:disabled {
    color: var(--color-text-3);
  }
`

const StreamingIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
  margin-left: 6px;
  font-size: 12px;
  animation: ${streamingPulse} 1s ease-in-out infinite;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
  }
`

const EditContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const EditTextarea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-soft);
  }
`

const EditActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export default memo(GroupChatMessageItem)
