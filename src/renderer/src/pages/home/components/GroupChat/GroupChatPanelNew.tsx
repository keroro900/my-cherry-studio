/**
 * GroupChatPanelNew - 群聊面板 (使用原生消息系统)
 *
 * 整合原生消息组件的群聊面板：
 * - 使用 GroupChatMessagesContainer 渲染消息
 * - 使用 GroupChatInputbar 输入
 * - 通过 useGroupChatNativeMessages 桥接事件到 Redux
 */

import { PlusOutlined, CloseOutlined, CrownOutlined, LoadingOutlined, UserOutlined, CommentOutlined, ThunderboltOutlined, StopOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { useRuntime } from '@renderer/hooks/useRuntime'
import type { AgentConfig, GroupChatCoordinator } from '@renderer/services/GroupChatCoordinator'
import { getGroupChatCoordinator, destroyGroupChatCoordinator } from '@renderer/services/GroupChatCoordinator'
import { groupChatService, type GroupAgent, type SpeakingMode, type GroupChatConfig } from '@renderer/services/GroupChatService'
import { getProviderByModel, getDefaultModel } from '@renderer/services/AssistantService'
import type { Assistant, FileMetadata } from '@renderer/types'
import { Avatar, Button, Dropdown, Space, Tag, Tooltip, Badge, message } from 'antd'
import type { FC } from 'react'
import type { MenuProps } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css, keyframes } from 'styled-components'

import GroupChatMessagesContainer from '../../Messages/GroupChatMessagesContainer'
import GroupChatInputbar from '../../Inputbar/GroupChatInputbar'
import { useGroupChatNativeMessages } from './hooks/useGroupChatNativeMessages'
import GroupChatSettingsPanel, { type GroupChatSettings } from './GroupChatSettingsPanel'

const logger = loggerService.withContext('GroupChatPanelNew')

export interface GroupChatPanelNewProps {
  /** 初始配置 */
  initialConfig?: Partial<GroupChatConfig>
  /** 可用的助手列表 */
  availableAssistants?: Assistant[]
}

/**
 * 群聊面板（原生消息系统版本）
 */
export const GroupChatPanelNew: FC<GroupChatPanelNewProps> = ({
  initialConfig,
  availableAssistants: propAssistants
}) => {
  const { t } = useTranslation()
  const { chat } = useRuntime()
  const { activeGroupChatSessionId } = chat
  const { assistants: defaultAssistants } = useAssistants()

  // 使用传入的或默认的助手列表
  const availableAssistants = propAssistants ?? defaultAssistants

  // 会话状态
  const [sessionId, setSessionId] = useState<string | null>(activeGroupChatSessionId)
  const [isActive, setIsActive] = useState(false)
  const [agents, setAgents] = useState<GroupAgent[]>([])
  const [enableFlowLock, setEnableFlowLock] = useState(false)
  const [topic, setTopic] = useState(initialConfig?.name || '群聊')

  // 群聊设置
  const [settings, setSettings] = useState<GroupChatSettings>({
    speakingMode: initialConfig?.speakingMode || 'mention',
    groupPrompt: initialConfig?.groupPrompt || '',
    invitePrompt: initialConfig?.invitePromptTemplate || '',
    useUnifiedModel: initialConfig?.useUnifiedModel || false,
    unifiedModel: initialConfig?.unifiedModel,
    enableContextSanitizer: initialConfig?.enableContextSanitizer || false
  })

  // Refs
  const coordinatorRef = useRef<GroupChatCoordinator | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current.querySelector('#messages')
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }
    }
  }, [])

  // 使用原生消息 Hook
  const { thinkingAgentIds, sendUserMessage } = useGroupChatNativeMessages({
    sessionId,
    agents,
    onScrollToBottom: scrollToBottom
  })

  /**
   * 初始化会话
   */
  const initSession = useCallback(async () => {
    if (sessionId) return sessionId

    try {
      const result = await groupChatService.createSession({
        ...initialConfig,
        speakingMode: settings.speakingMode,
        name: topic,
        groupPrompt: settings.groupPrompt,
        invitePromptTemplate: settings.invitePrompt,
        useUnifiedModel: settings.useUnifiedModel,
        unifiedModel: settings.unifiedModel,
        enableContextSanitizer: settings.enableContextSanitizer
      })

      setSessionId(result.sessionId)
      logger.info('Group chat session created', { sessionId: result.sessionId })

      // 初始化协调器
      const coordinator = getGroupChatCoordinator(result.sessionId, {
        enableFlowLock,
        topicName: topic,
        onTopicUpdated: setTopic,
        onAgentStatusChange: (agentId, status) => {
          setAgents(prev => prev.map(a =>
            a.id === agentId ? { ...a, status } : a
          ))
        },
        onError: (error) => {
          logger.error('Coordinator error', error)
        }
      })

      await coordinator.waitForInit()
      coordinatorRef.current = coordinator

      return result.sessionId
    } catch (error) {
      logger.error('Failed to create session', error as Error)
      return null
    }
  }, [sessionId, initialConfig, settings, topic, enableFlowLock])

  /**
   * 创建完整的 GroupAgent
   */
  const createGroupAgent = (assistant: Assistant, role: GroupAgent['role'] = 'participant'): GroupAgent => {
    return {
      id: assistant.id,
      name: assistant.name,
      displayName: assistant.name,
      role,
      status: 'idle',
      expertise: assistant.tags || [],
      systemPrompt: assistant.prompt || '',
      triggerKeywords: [],
      priority: role === 'host' ? 100 : 50,
      speakCount: 0,
      visibleMessageIds: []
    }
  }

  /**
   * 添加 Agent 到群聊
   */
  const addAgent = useCallback(async (assistant: Assistant, role: GroupAgent['role'] = 'participant') => {
    const sid = await initSession()
    if (!sid) return

    // 创建 GroupAgent
    const model = assistant.model || getDefaultModel()
    const provider = getProviderByModel(model)
    const agent = createGroupAgent(assistant, role)

    // 创建完整的 AgentConfig
    const agentConfig: AgentConfig = {
      ...agent,
      assistant,
      provider
    }

    // 添加到协调器
    coordinatorRef.current?.addAgent(agentConfig)

    // 更新本地状态
    setAgents(prev => {
      if (prev.some(a => a.id === agent.id)) {
        return prev
      }
      return [...prev, agent]
    })

    // 同步到服务
    await groupChatService.addAgent(sid, agent)

    logger.info('Agent added', { agentId: agent.id, agentName: agent.displayName })
  }, [initSession])

  /**
   * 移除 Agent
   */
  const removeAgent = useCallback(async (agentId: string) => {
    if (!sessionId) return

    coordinatorRef.current?.removeAgent(agentId)
    setAgents(prev => prev.filter(a => a.id !== agentId))
    await groupChatService.removeAgent(sessionId, agentId)

    logger.info('Agent removed', { agentId })
  }, [sessionId])

  /**
   * 设置 Host
   */
  const setHost = useCallback((agentId: string) => {
    setAgents(prev => prev.map(a => ({
      ...a,
      role: a.id === agentId ? 'host' : (a.role === 'host' ? 'participant' : a.role),
      priority: a.id === agentId ? 100 : 50
    })))
  }, [])

  /**
   * 开始群聊
   */
  const startChat = useCallback(async () => {
    const sid = await initSession()
    if (!sid) return

    await groupChatService.start(sid, topic)
    setIsActive(true)

    if (enableFlowLock) {
      coordinatorRef.current?.enableFlowLock()
    }

    logger.info('Group chat started', { sessionId: sid })
  }, [initSession, topic, enableFlowLock])

  /**
   * 结束群聊
   */
  const endChat = useCallback(async () => {
    if (!sessionId) return

    coordinatorRef.current?.disableFlowLock()
    await coordinatorRef.current?.end()
    setIsActive(false)

    logger.info('Group chat ended', { sessionId })
  }, [sessionId])

  /**
   * 发送消息
   */
  const handleSendMessage = useCallback(async (content: string, files?: FileMetadata[]) => {
    // 确保会话存在
    let currentSessionId = sessionId
    if (!currentSessionId) {
      currentSessionId = await initSession()
      if (!currentSessionId) {
        logger.error('Failed to create session for message')
        return
      }
    }

    // 确保群聊已开始
    if (!isActive) {
      await startChat()
    }

    // 确保协调器已初始化
    if (!coordinatorRef.current) {
      logger.error('Coordinator not initialized')
      return
    }

    // 添加用户消息到原生存储
    sendUserMessage(content)

    // 通过协调器处理 AI 响应
    try {
      logger.info('Sending message to coordinator', {
        content: content.slice(0, 50),
        agentCount: coordinatorRef.current.getAgents().length
      })
      await coordinatorRef.current.handleUserInput(content, 'user', files)
    } catch (error) {
      logger.error('Failed to handle user input', error as Error)
    }
  }, [sessionId, isActive, startChat, sendUserMessage, initSession])

  /**
   * 中断响应
   */
  const handleInterrupt = useCallback(() => {
    logger.info('Interrupt requested')
  }, [])

  /**
   * 切换心流锁
   */
  const handleToggleFlowLock = useCallback(() => {
    setEnableFlowLock(prev => {
      const newValue = !prev
      if (newValue) {
        coordinatorRef.current?.enableFlowLock()
      } else {
        coordinatorRef.current?.disableFlowLock()
      }
      return newValue
    })
  }, [])

  /**
   * 邀请 Agent 发言
   */
  const handleInviteAgent = useCallback((agentId: string) => {
    if (sessionId) {
      coordinatorRef.current?.requestAgentSpeak(agentId, '请分享你的看法')
    }
  }, [sessionId])

  // 获取未添加的助手
  const availableToAdd = availableAssistants.filter(
    a => !agents.some(agent => agent.id === a.id)
  )

  // 添加助手下拉菜单
  const addAgentMenuItems = availableToAdd.map(assistant => ({
    key: assistant.id,
    label: assistant.name,
    onClick: () => addAgent(assistant)
  }))

  /**
   * 获取 Agent 右键菜单项
   */
  const getAgentContextMenu = (agent: GroupAgent): MenuProps['items'] => {
    const items: MenuProps['items'] = []

    // 邀请发言（群聊进行中时可用）
    if (isActive) {
      items.push({
        key: 'invite',
        icon: <CommentOutlined />,
        label: t('groupchat.invite_speak', '邀请发言'),
        onClick: () => handleInviteAgent(agent.id)
      })
    }

    // 角色设置
    items.push({
      key: 'role',
      icon: <UserOutlined />,
      label: t('groupchat.set_role', '设置角色'),
      children: [
        {
          key: 'role-host',
          label: t('groupchat.role_host', '主持人'),
          icon: <CrownOutlined style={{ color: '#faad14' }} />,
          disabled: agent.role === 'host',
          onClick: () => setHost(agent.id)
        },
        {
          key: 'role-participant',
          label: t('groupchat.role_participant', '参与者'),
          disabled: agent.role === 'participant',
          onClick: () => setAgents(prev => prev.map(a =>
            a.id === agent.id ? { ...a, role: 'participant', priority: 50 } : a
          ))
        },
        {
          key: 'role-expert',
          label: t('groupchat.role_expert', '专家'),
          disabled: agent.role === 'expert',
          onClick: () => setAgents(prev => prev.map(a =>
            a.id === agent.id ? { ...a, role: 'expert', priority: 75 } : a
          ))
        },
        {
          key: 'role-observer',
          label: t('groupchat.role_observer', '观察者'),
          disabled: agent.role === 'observer',
          onClick: () => setAgents(prev => prev.map(a =>
            a.id === agent.id ? { ...a, role: 'observer', priority: 25 } : a
          ))
        }
      ]
    })

    // 分隔线
    items.push({ type: 'divider' })

    // 移除（群聊未开始时可用）
    if (!isActive) {
      items.push({
        key: 'remove',
        icon: <CloseOutlined />,
        label: t('groupchat.remove_agent', '移除'),
        danger: true,
        onClick: () => removeAgent(agent.id)
      })
    }

    return items
  }

  /**
   * 获取 Agent 状态颜色
   */
  const getAgentStatusColor = (agent: GroupAgent): string => {
    if (thinkingAgentIds.has(agent.id)) return '#1890ff' // 思考中 - 蓝色
    if (agent.status === 'speaking') return '#52c41a' // 发言中 - 绿色
    if (agent.status === 'active') return '#faad14' // 活跃 - 黄色
    return '#d9d9d9' // 空闲 - 灰色
  }

  /**
   * 获取角色标签
   */
  const getRoleBadge = (role: GroupAgent['role']) => {
    switch (role) {
      case 'host':
        return { text: t('groupchat.role_host', '主持'), color: '#faad14' }
      case 'expert':
        return { text: t('groupchat.role_expert', '专家'), color: '#1890ff' }
      case 'observer':
        return { text: t('groupchat.role_observer', '观察'), color: '#8c8c8c' }
      default:
        return null
    }
  }

  // 同步 activeGroupChatSessionId
  useEffect(() => {
    if (activeGroupChatSessionId && activeGroupChatSessionId !== sessionId) {
      setSessionId(activeGroupChatSessionId)
    }
  }, [activeGroupChatSessionId, sessionId])

  // 清理
  useEffect(() => {
    return () => {
      if (sessionId) {
        destroyGroupChatCoordinator(sessionId)
      }
    }
  }, [sessionId])

  /**
   * 加载现有会话数据
   * 当切换到已存在的会话时，从 GroupChatService 加载状态
   */
  useEffect(() => {
    let isMounted = true

    const loadSessionState = async () => {
      if (!sessionId) return

      try {
        const state = await groupChatService.getState(sessionId)

        if (!isMounted) return

        logger.info('Loaded existing session state', {
          sessionId,
          agentCount: state.agents.length,
          isActive: state.isActive,
          topic: state.topic
        })

        // 更新状态
        setAgents(state.agents)
        setIsActive(state.isActive)
        if (state.topic) {
          setTopic(state.topic)
        }

        // 初始化或获取协调器
        const coordinator = getGroupChatCoordinator(sessionId, {
          enableFlowLock,
          topicName: state.topic || '群聊',
          onTopicUpdated: setTopic,
          onAgentStatusChange: (agentId, status) => {
            setAgents(prev => prev.map(a =>
              a.id === agentId ? { ...a, status } : a
            ))
          },
          onError: (error) => {
            logger.error('Coordinator error', error)
          }
        })

        await coordinator.waitForInit()

        if (!isMounted) return

        coordinatorRef.current = coordinator

        // 将 agents 添加到协调器
        for (const agent of state.agents) {
          const assistant = availableAssistants.find(a => a.id === agent.id)
          if (assistant) {
            const model = assistant.model || getDefaultModel()
            const provider = getProviderByModel(model)
            const agentConfig: AgentConfig = {
              ...agent,
              assistant,
              provider
            }
            coordinator.addAgent(agentConfig)
          } else {
            // 即使找不到 assistant，也尝试添加基本配置
            logger.warn('Assistant not found for agent', { agentId: agent.id })
          }
        }

        logger.info('Session state loaded and coordinator initialized', {
          sessionId,
          coordinatorAgentCount: coordinator.getAgents().length
        })
      } catch (error) {
        logger.error('Failed to load session state', error as Error)
      }
    }

    loadSessionState()

    return () => {
      isMounted = false
    }
  }, [sessionId, availableAssistants, enableFlowLock])

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <HeaderTitle $flowLockActive={enableFlowLock}>
          <span>💬</span>
          <TopicName>{topic}</TopicName>
          {isActive && <ActiveBadge>{t('groupchat.active', '进行中')}</ActiveBadge>}
          {enableFlowLock && (
            <FlowLockIndicator>
              <ThunderboltOutlined />
              {t('groupchat.flowlock_active', '心流锁')}
            </FlowLockIndicator>
          )}
        </HeaderTitle>
        <HeaderActions>
          {/* 心流锁开关 */}
          <Tooltip title={enableFlowLock ? t('groupchat.disable_flowlock', '关闭心流锁') : t('groupchat.enable_flowlock', '开启心流锁')}>
            <FlowLockButton
              type={enableFlowLock ? 'primary' : 'text'}
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={handleToggleFlowLock}
              $active={enableFlowLock}
            />
          </Tooltip>
          {/* 设置面板 */}
          <GroupChatSettingsPanel
            settings={settings}
            onChange={setSettings}
            disabled={isActive}
          />
          {/* 结束按钮（仅在进行中显示） */}
          {isActive && (
            <Button size="small" icon={<StopOutlined />} onClick={endChat}>
              {t('groupchat.end', '结束')}
            </Button>
          )}
        </HeaderActions>
      </Header>

      {/* Agent 选择和邀请区域 */}
      <AgentSelectorContainer>
        <Space wrap size={8}>
          {agents.map(agent => {
            const roleBadge = getRoleBadge(agent.role)
            const isThinking = thinkingAgentIds.has(agent.id)
            return (
              <Dropdown
                key={agent.id}
                menu={{ items: getAgentContextMenu(agent) }}
                trigger={['contextMenu']}
              >
                <AgentTag $isThinking={isThinking}>
                  <Badge
                    dot
                    color={getAgentStatusColor(agent)}
                    offset={[-2, 2]}
                  >
                    <Avatar size="small" style={{ marginRight: 4 }}>
                      {agent.displayName[0]}
                    </Avatar>
                  </Badge>
                  <span style={{ marginLeft: 4 }}>{agent.displayName}</span>
                  {isThinking && (
                    <LoadingOutlined style={{ marginLeft: 4, color: '#1890ff' }} spin />
                  )}
                  {roleBadge && (
                    <Tag
                      color={roleBadge.color}
                      style={{ marginLeft: 4, fontSize: 10, padding: '0 4px', lineHeight: '14px' }}
                    >
                      {roleBadge.text}
                    </Tag>
                  )}
                  {agent.role === 'host' && !roleBadge && (
                    <Tooltip title={t('groupchat.role_host', '主持人')}>
                      <CrownOutlined style={{ color: '#faad14', marginLeft: 4 }} />
                    </Tooltip>
                  )}
                  {!isActive && (
                    <CloseOutlined
                      style={{ marginLeft: 4, cursor: 'pointer', fontSize: 10, opacity: 0.6 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAgent(agent.id)
                      }}
                    />
                  )}
                </AgentTag>
              </Dropdown>
            )
          })}
          {!isActive && availableToAdd.length > 0 && (
            <Dropdown menu={{ items: addAgentMenuItems }} trigger={['click']}>
              <Button size="small" icon={<PlusOutlined />}>
                {t('groupchat.add_agent', '添加助手')}
              </Button>
            </Dropdown>
          )}
        </Space>
        {agents.length < 2 && (
          <HintText>{t('groupchat.min_agents_hint', '请至少添加 2 个助手以开始群聊')}</HintText>
        )}
        {agents.length >= 2 && !isActive && (
          <HintText>{t('groupchat.ready_hint', '直接发送消息即可开始群聊')}</HintText>
        )}
      </AgentSelectorContainer>

      {/* 邀请发言按钮区域（邀请模式时显示） */}
      {isActive && settings.speakingMode === 'invitation' && agents.length > 0 && (
        <InviteButtonsContainer>
          <InviteLabel>{t('groupchat.invite_to_speak', '邀请发言')}:</InviteLabel>
          <InviteButtonsGrid>
            {agents.map(agent => {
              const isThinking = thinkingAgentIds.has(agent.id)
              return (
                <InviteButton
                  key={agent.id}
                  onClick={() => handleInviteAgent(agent.id)}
                  disabled={isThinking}
                  $isThinking={isThinking}
                >
                  <Avatar size={24}>{agent.displayName[0]}</Avatar>
                  <span>{agent.displayName}</span>
                  {isThinking && <LoadingOutlined spin />}
                </InviteButton>
              )
            })}
          </InviteButtonsGrid>
        </InviteButtonsContainer>
      )}

      {/* 消息区域 */}
      <MessagesArea ref={messagesContainerRef}>
        {sessionId && (
          <GroupChatMessagesContainer sessionId={sessionId} />
        )}
        {!sessionId && (
          <EmptyState>
            <span>👥</span>
            <p>{t('groupchat.empty_hint', '添加助手并开始群聊')}</p>
          </EmptyState>
        )}
      </MessagesArea>

      {/* 输入区域 */}
      <InputArea>
        <GroupChatInputbar
          sessionId={sessionId || ''}
          agents={agents}
          isLoading={thinkingAgentIds.size > 0}
          enableFlowLock={enableFlowLock}
          onSendMessage={handleSendMessage}
          onInterrupt={handleInterrupt}
          onToggleFlowLock={handleToggleFlowLock}
          onInviteAgent={handleInviteAgent}
          thinkingAgentIds={thinkingAgentIds}
        />
      </InputArea>
    </Container>
  )
}

// Styled Components
const flowLockGlow = keyframes`
  0%, 100% {
    text-shadow: 0 0 5px rgba(250, 173, 20, 0.5), 0 0 10px rgba(250, 173, 20, 0.3);
  }
  50% {
    text-shadow: 0 0 10px rgba(250, 173, 20, 0.8), 0 0 20px rgba(250, 173, 20, 0.5);
  }
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
`

const HeaderTitle = styled.div<{ $flowLockActive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  ${props => props.$flowLockActive && css`
    animation: ${flowLockGlow} 2s ease-in-out infinite;
  `}
`

const TopicName = styled.span`
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ActiveBadge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-success);
  color: white;
`

const FlowLockIndicator = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, #faad14 0%, #fa8c16 100%);
  color: white;
  animation: ${flowLockGlow} 2s ease-in-out infinite;
`

const FlowLockButton = styled(Button)<{ $active?: boolean }>`
  ${props => props.$active && css`
    background: linear-gradient(135deg, #faad14 0%, #fa8c16 100%);
    border-color: #fa8c16;
    &:hover {
      background: linear-gradient(135deg, #ffc53d 0%, #fa8c16 100%);
      border-color: #fa8c16;
    }
  `}
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const AgentSelectorContainer = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
`

const AgentTag = styled(Tag)<{ $isThinking?: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  margin: 0;
  cursor: pointer;
  transition: all 0.2s;
  ${props => props.$isThinking && css`
    background: var(--color-primary-soft);
    border-color: var(--color-primary);
    animation: pulse 1.5s ease-in-out infinite;
  `}

  &:hover {
    background: var(--color-hover);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`

const HintText = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 8px;
`

const InviteButtonsContainer = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-mute);
`

const InviteLabel = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  margin-bottom: 8px;
`

const InviteButtonsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const InviteButton = styled.button<{ $isThinking?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  color: var(--color-text);

  ${props => props.$isThinking && css`
    background: var(--color-primary-soft);
    border-color: var(--color-primary);
    cursor: not-allowed;
  `}

  &:hover:not(:disabled) {
    background: var(--color-primary-soft);
    border-color: var(--color-primary);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
  }
`

const MessagesArea = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
  gap: 12px;

  span {
    font-size: 48px;
  }

  p {
    font-size: 14px;
  }
`

const InputArea = styled.div`
  border-top: 1px solid var(--color-border);
`

export default GroupChatPanelNew
