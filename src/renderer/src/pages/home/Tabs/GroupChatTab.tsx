/**
 * GroupChatTab - 群聊会话列表
 *
 * 显示群聊会话列表，支持创建和切换会话
 */

import { DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, TeamOutlined, ClearOutlined, CopyOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { groupChatService, type SessionInfo } from '@renderer/services/GroupChatService'
import { useAppDispatch } from '@renderer/store'
import {
  setActiveGroupChatSessionId,
  setActiveTopicOrSessionAction,
  setGroupChatAssistantIds
} from '@renderer/store/runtime'
import { cn } from '@renderer/utils'
import { Button, Dropdown, Empty, Input, List, Modal, Spin, Tag, message } from 'antd'
import type { MenuProps } from 'antd'
import { motion } from 'framer-motion'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('GroupChatTab')

const GroupChatTab: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { chat } = useRuntime()
  const { activeGroupChatSessionId } = chat

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // 重命名对话框状态
  const [renameModal, setRenameModal] = useState<{ visible: boolean; sessionId: string; currentName: string }>({
    visible: false,
    sessionId: '',
    currentName: ''
  })
  const [newName, setNewName] = useState('')

  /**
   * 加载会话列表
   */
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      const list = await groupChatService.listSessions()
      setSessions(list)
    } catch (error) {
      logger.error('Failed to load sessions', error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  /**
   * 订阅事件更新
   */
  useEffect(() => {
    const unsubscribe = groupChatService.subscribe((event) => {
      // 刷新列表 - 在会话状态变化或 Agent 加入/离开时
      if (
        event.type === 'chat:start' ||
        event.type === 'chat:end' ||
        event.type === 'agent:join' ||
        event.type === 'agent:leave' ||
        event.type === 'topic:updated'
      ) {
        loadSessions()
      }
    })

    return () => unsubscribe()
  }, [loadSessions])

  /**
   * 创建新会话
   */
  const handleCreate = async () => {
    try {
      setIsCreating(true)
      const result = await groupChatService.createSession({
        name: t('groupchat.new_session', '新群聊')
      })
      await loadSessions()
      handleSelect(result.sessionId)
    } catch (error) {
      logger.error('Failed to create session', error as Error)
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * 选择会话
   */
  const handleSelect = (sessionId: string) => {
    dispatch(setActiveGroupChatSessionId(sessionId))
    dispatch(setActiveTopicOrSessionAction('groupchat'))
    // 加载会话的助手列表
    groupChatService
      .getAgents(sessionId)
      .then((agents) => {
        dispatch(setGroupChatAssistantIds(agents.map((a) => a.id)))
      })
      .catch((error) => {
        logger.error('Failed to load session agents', error as Error)
      })
  }

  /**
   * 删除会话
   */
  const handleDelete = async (sessionId: string) => {
    try {
      await groupChatService.destroy(sessionId)
      if (activeGroupChatSessionId === sessionId) {
        dispatch(setActiveGroupChatSessionId(null))
        dispatch(setGroupChatAssistantIds([]))
      }
      await loadSessions()
      message.success(t('groupchat.deleted', '会话已删除'))
    } catch (error) {
      logger.error('Failed to delete session', error as Error)
      message.error(t('groupchat.delete_failed', '删除失败'))
    }
  }

  /**
   * 打开重命名对话框
   */
  const openRenameModal = (session: SessionInfo) => {
    setRenameModal({ visible: true, sessionId: session.id, currentName: session.name })
    setNewName(session.name)
  }

  /**
   * 执行重命名
   */
  const handleRename = async () => {
    if (!newName.trim()) {
      message.warning(t('groupchat.name_required', '名称不能为空'))
      return
    }

    try {
      // 调用重命名 API
      await groupChatService.updateSession(renameModal.sessionId, { name: newName.trim() })
      await loadSessions()
      setRenameModal({ visible: false, sessionId: '', currentName: '' })
      message.success(t('groupchat.renamed', '重命名成功'))
    } catch (error) {
      logger.error('Failed to rename session', error as Error)
      message.error(t('groupchat.rename_failed', '重命名失败'))
    }
  }

  /**
   * 清空会话消息
   */
  const handleClearMessages = async (sessionId: string) => {
    try {
      await groupChatService.clearMessages(sessionId)
      await loadSessions()
      message.success(t('groupchat.messages_cleared', '消息已清空'))
    } catch (error) {
      logger.error('Failed to clear messages', error as Error)
      message.error(t('groupchat.clear_failed', '清空失败'))
    }
  }

  /**
   * 复制会话
   */
  const handleDuplicate = async (session: SessionInfo) => {
    try {
      // 获取原会话的完整状态
      const state = await groupChatService.getState(session.id)
      // 创建新会话
      const result = await groupChatService.createSession({
        name: `${session.name} (副本)`,
        speakingMode: state.config?.speakingMode || 'mention'
      })
      // 添加相同的 agents
      for (const agent of state.agents) {
        await groupChatService.addAgent(result.sessionId, agent)
      }
      await loadSessions()
      message.success(t('groupchat.duplicated', '会话已复制'))
    } catch (error) {
      logger.error('Failed to duplicate session', error as Error)
      message.error(t('groupchat.duplicate_failed', '复制失败'))
    }
  }

  /**
   * 导出会话
   */
  const handleExport = async (sessionId: string) => {
    try {
      const state = await groupChatService.getState(sessionId)
      const messages = state.messages

      // 生成 Markdown 内容
      const markdown = messages.map(msg =>
        `### ${msg.agentName} (${new Date(msg.timestamp).toLocaleString()})\n\n${msg.content}\n`
      ).join('\n---\n\n')

      // 复制到剪贴板
      await navigator.clipboard.writeText(markdown)
      message.success(t('groupchat.exported', '已复制到剪贴板'))
    } catch (error) {
      logger.error('Failed to export session', error as Error)
      message.error(t('groupchat.export_failed', '导出失败'))
    }
  }

  /**
   * 获取右键菜单项
   */
  const getContextMenuItems = (session: SessionInfo): MenuProps['items'] => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: t('groupchat.rename', '重命名'),
      onClick: (e) => {
        e.domEvent.stopPropagation()
        openRenameModal(session)
      }
    },
    {
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: t('groupchat.duplicate', '复制'),
      onClick: (e) => {
        e.domEvent.stopPropagation()
        handleDuplicate(session)
      }
    },
    { type: 'divider' },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: t('groupchat.export', '导出'),
      onClick: (e) => {
        e.domEvent.stopPropagation()
        handleExport(session.id)
      }
    },
    { type: 'divider' },
    {
      key: 'clear',
      icon: <ClearOutlined />,
      label: t('groupchat.clear_messages', '清空消息'),
      onClick: (e) => {
        e.domEvent.stopPropagation()
        Modal.confirm({
          title: t('groupchat.clear_confirm_title', '确认清空'),
          content: t('groupchat.clear_confirm', '确定要清空此会话的所有消息吗？'),
          okText: t('common.confirm', '确定'),
          cancelText: t('common.cancel', '取消'),
          onOk: () => handleClearMessages(session.id)
        })
      }
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('groupchat.delete', '删除'),
      danger: true,
      onClick: (e) => {
        e.domEvent.stopPropagation()
        Modal.confirm({
          title: t('groupchat.delete_confirm_title', '确认删除'),
          content: t('groupchat.delete_confirm', '确定删除此会话？删除后无法恢复。'),
          okText: t('common.confirm', '确定'),
          cancelText: t('common.cancel', '取消'),
          okButtonProps: { danger: true },
          onOk: () => handleDelete(session.id)
        })
      }
    }
  ]

  if (isLoading) {
    return (
      <Container className="flex h-full items-center justify-center">
        <Spin />
      </Container>
    )
  }

  return (
    <motion.div className={cn('overflow-hidden', 'h-full', 'flex', 'flex-col')}>
      <Header>
        <Title>
          <TeamOutlined style={{ marginRight: 8 }} />
          {t('groupchat.title', '群聊')}
        </Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} loading={isCreating} onClick={handleCreate}>
          {t('groupchat.create', '新建')}
        </Button>
      </Header>

      <SessionList>
        {sessions.length === 0 ? (
          <Empty description={t('groupchat.empty', '暂无群聊会话')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={sessions}
            renderItem={(session) => (
              <Dropdown
                menu={{ items: getContextMenuItems(session) }}
                trigger={['contextMenu']}
              >
                <SessionItem $active={session.id === activeGroupChatSessionId} onClick={() => handleSelect(session.id)}>
                  <SessionInfo>
                    <SessionName>{session.name}</SessionName>
                    <SessionMeta>
                      <Tag color={session.isActive ? 'green' : 'default'}>
                        {session.isActive ? t('groupchat.active', '进行中') : t('groupchat.idle', '空闲')}
                      </Tag>
                      <span>
                        {session.agentCount} {t('groupchat.agents', '成员')}
                      </span>
                      <span>
                        {session.messageCount} {t('groupchat.messages', '条消息')}
                      </span>
                    </SessionMeta>
                  </SessionInfo>
                  <DeleteButton
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      Modal.confirm({
                        title: t('groupchat.delete_confirm_title', '确认删除'),
                        content: t('groupchat.delete_confirm', '确定删除此会话？删除后无法恢复。'),
                        okText: t('common.confirm', '确定'),
                        cancelText: t('common.cancel', '取消'),
                        okButtonProps: { danger: true },
                        onOk: () => handleDelete(session.id)
                      })
                    }}
                  />
                </SessionItem>
              </Dropdown>
            )}
          />
        )}
      </SessionList>
      {/* 重命名对话框 */}
      <Modal
        title={t('groupchat.rename', '重命名')}
        open={renameModal.visible}
        onOk={handleRename}
        onCancel={() => setRenameModal({ visible: false, sessionId: '', currentName: '' })}
        okText={t('common.confirm', '确定')}
        cancelText={t('common.cancel', '取消')}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('groupchat.name_placeholder', '输入新名称')}
          onPressEnter={handleRename}
          autoFocus
        />
      </Modal>
    </motion.div>
  )
}

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
`

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
`

const SessionList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`

const SessionItem = styled.div<{ $active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'var(--color-background-soft)')};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'var(--color-hover)')};
  }
`

const SessionInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const SessionName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const SessionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
`

const DeleteButton = styled(Button)`
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
`

export default memo(GroupChatTab)
