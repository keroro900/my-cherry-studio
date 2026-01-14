/**
 * GroupChatManagement - 群聊管理组件
 *
 * 在 VCP Dashboard 中提供群聊会话的管理视图
 * 统一入口：实际群聊在 Home → 群聊 Tab 中进行
 *
 * 功能：
 * - 显示会话列表和统计
 * - 查看助手群聊配置状态
 * - 提供跳转到 Home 群聊的入口
 */

import {
  DeleteOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { groupChatService, type SessionInfo } from '@renderer/services/GroupChatService'
import { useAppDispatch } from '@renderer/store'
import {
  setActiveGroupChatSessionId,
  setActiveTopicOrSessionAction,
  setGroupChatAssistantIds
} from '@renderer/store/runtime'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  List,
  message,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

const { Title, Text, Paragraph } = Typography

const logger = loggerService.withContext('GroupChatManagement')

/**
 * 群聊管理组件
 */
const GroupChatManagement: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { assistants } = useAssistants()

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // 计算启用群聊的助手数量
  const groupChatEnabledAssistants = assistants.filter((a) => a.groupChat?.enabled !== false)

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
   * 创建新会话并跳转
   */
  const handleCreateAndGo = async () => {
    try {
      setIsCreating(true)
      const result = await groupChatService.createSession({
        name: t('groupchat.new_session', '新群聊')
      })
      await loadSessions()
      // 设置活动会话并跳转
      dispatch(setActiveGroupChatSessionId(result.sessionId))
      dispatch(setActiveTopicOrSessionAction('groupchat'))
      navigate('/')
    } catch (error) {
      logger.error('Failed to create session', error as Error)
      message.error(t('groupchat.create_failed', '创建会话失败'))
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * 选择会话并跳转到 Home
   */
  const handleSelectAndGo = async (sessionId: string) => {
    try {
      // 加载会话的助手列表
      const agents = await groupChatService.getAgents(sessionId)
      dispatch(setActiveGroupChatSessionId(sessionId))
      dispatch(setGroupChatAssistantIds(agents.map((a) => a.id)))
      dispatch(setActiveTopicOrSessionAction('groupchat'))
      navigate('/')
    } catch (error) {
      logger.error('Failed to select session', error as Error)
    }
  }

  /**
   * 删除会话
   */
  const handleDelete = async (sessionId: string) => {
    try {
      await groupChatService.destroy(sessionId)
      await loadSessions()
      message.success(t('groupchat.delete_success', '会话已删除'))
    } catch (error) {
      logger.error('Failed to delete session', error as Error)
      message.error(t('groupchat.delete_failed', '删除失败'))
    }
  }

  /**
   * 跳转到助手设置
   */
  const handleGoToAssistantSettings = () => {
    // 跳转到首页，用户可以在助手设置中配置群聊参数
    navigate('/')
  }

  // 统计数据
  const activeSessions = sessions.filter((s) => s.isActive).length
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)

  return (
    <Container>
      {/* 头部说明 */}
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          {t('vcp.dashboard.groupchat.title', '群聊管理')}
        </Title>
        <Text type="secondary">
          {t('vcp.dashboard.groupchat.description', '管理多 Agent 群聊会话，配置发言模式、成员标签、统一模型等。')}
        </Text>
      </Header>

      <Content>
        {/* 统一入口提示 */}
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={t('vcp.dashboard.groupchat.unified_entry', '统一入口')}
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                群聊对话在 <strong>首页 → 群聊</strong> 标签中进行。此页面用于：
              </Paragraph>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>查看和管理群聊会话</li>
                <li>查看助手群聊配置状态</li>
                <li>快速创建新会话并跳转</li>
              </ul>
            </div>
          }
          action={
            <Button type="primary" icon={<ExportOutlined />} onClick={() => navigate('/')}>
              {t('vcp.dashboard.groupchat.go_to_chat', '前往群聊')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('groupchat.stats.sessions', '会话总数')}
                value={sessions.length}
                prefix={<TeamOutlined />}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('groupchat.stats.active', '进行中')}
                value={activeSessions}
                valueStyle={{ color: activeSessions > 0 ? '#52c41a' : undefined }}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic title={t('groupchat.stats.messages', '消息总数')} value={totalMessages} />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('groupchat.stats.enabled_assistants', '可用助手')}
                value={groupChatEnabledAssistants.length}
                suffix={`/ ${assistants.length}`}
                prefix={<UserOutlined />}
              />
            </StatCard>
          </Col>
        </Row>

        {/* 会话列表 */}
        <SectionCard
          title={
            <Space>
              <span>{t('groupchat.sessions', '群聊会话')}</span>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={loadSessions} loading={isLoading} />
            </Space>
          }
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateAndGo}
              loading={isCreating}>
              {t('groupchat.create_and_go', '新建并进入')}
            </Button>
          }>
          {sessions.length === 0 ? (
            <Empty description={t('groupchat.empty', '暂无群聊会话')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={handleCreateAndGo} loading={isCreating}>
                {t('groupchat.create_first', '创建第一个群聊')}
              </Button>
            </Empty>
          ) : (
            <List
              dataSource={sessions}
              renderItem={(session) => (
                <SessionItem onClick={() => handleSelectAndGo(session.id)}>
                  <List.Item.Meta
                    avatar={
                      <Badge dot color={session.isActive ? 'green' : 'default'}>
                        <Avatar icon={<TeamOutlined />} />
                      </Badge>
                    }
                    title={
                      <Space>
                        <span>{session.name}</span>
                        <Tag color={session.isActive ? 'green' : 'default'}>
                          {session.isActive ? t('groupchat.active', '进行中') : t('groupchat.idle', '空闲')}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space size="middle">
                        <span>
                          {session.agentCount} {t('groupchat.agents', '成员')}
                        </span>
                        <span>
                          {session.messageCount} {t('groupchat.messages', '条消息')}
                        </span>
                      </Space>
                    }
                  />
                  <Space>
                    <Tooltip title={t('groupchat.enter', '进入群聊')}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<ExportOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectAndGo(session.id)
                        }}>
                        {t('common.enter', '进入')}
                      </Button>
                    </Tooltip>
                    <Popconfirm
                      title={t('groupchat.delete_confirm', '确定删除此会话？')}
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        handleDelete(session.id)
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText={t('common.confirm', '确定')}
                      cancelText={t('common.cancel', '取消')}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                </SessionItem>
              )}
            />
          )}
        </SectionCard>

        {/* 助手配置状态 */}
        <SectionCard
          title={t('groupchat.assistant_config', '助手群聊配置')}
          extra={
            <Tooltip title={t('groupchat.config_tip', '在助手设置中配置群聊参数')}>
              <Button type="text" size="small" icon={<SettingOutlined />} onClick={handleGoToAssistantSettings}>
                {t('groupchat.configure', '配置')}
              </Button>
            </Tooltip>
          }>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {t(
              'groupchat.assistant_config_desc',
              '每个助手可以单独配置群聊角色、专业领域、触发关键词和发言优先级。点击助手查看详情。'
            )}
          </Paragraph>
          <AssistantGrid>
            {groupChatEnabledAssistants.slice(0, 8).map((assistant) => (
              <AssistantCard key={assistant.id} size="small">
                <Space>
                  <Avatar size="small">{assistant.emoji || assistant.name[0]}</Avatar>
                  <div>
                    <div style={{ fontWeight: 500 }}>{assistant.name}</div>
                    <Space size={4}>
                      <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                        {assistant.groupChat?.role || 'participant'}
                      </Tag>
                      {assistant.groupChat?.priority && assistant.groupChat.priority > 70 && (
                        <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
                          高优先级
                        </Tag>
                      )}
                    </Space>
                  </div>
                </Space>
              </AssistantCard>
            ))}
            {groupChatEnabledAssistants.length > 8 && (
              <MoreCard onClick={handleGoToAssistantSettings}>
                +{groupChatEnabledAssistants.length - 8} {t('common.more', '更多')}
              </MoreCard>
            )}
          </AssistantGrid>
        </SectionCard>

        {/* 功能说明 */}
        <SectionCard title={t('groupchat.features', '群聊功能')}>
          <FeatureGrid>
            <FeatureItem>
              <FeatureIcon>🎯</FeatureIcon>
              <div>
                <strong>{t('groupchat.feature.modes', '发言模式')}</strong>
                <div>{t('groupchat.feature.modes_desc', '顺序、随机、@提及、关键词触发、邀请、共识')}</div>
              </div>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>🤝</FeatureIcon>
              <div>
                <strong>{t('groupchat.feature.collab', 'Agent 协同')}</strong>
                <div>{t('groupchat.feature.collab_desc', 'AI 可主动调用其他 Agent 协助')}</div>
              </div>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>🔄</FeatureIcon>
              <div>
                <strong>{t('groupchat.feature.flowlock', '心流锁模式')}</strong>
                <div>{t('groupchat.feature.flowlock_desc', 'AI 可在静默期主动发言')}</div>
              </div>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>⚙️</FeatureIcon>
              <div>
                <strong>{t('groupchat.feature.unified', '统一模型')}</strong>
                <div>{t('groupchat.feature.unified_desc', '所有成员使用同一模型')}</div>
              </div>
            </FeatureItem>
          </FeatureGrid>
        </SectionCard>
      </Content>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);

  h4 {
    margin-bottom: 4px;
  }
`

const Content = styled.div`
  padding: 16px 24px;
  flex: 1;
`

const StatCard = styled(Card)`
  .ant-statistic-title {
    font-size: 13px;
  }
  .ant-statistic-content-value {
    font-size: 24px;
  }
`

const SectionCard = styled(Card)`
  margin-bottom: 16px;

  .ant-card-head {
    min-height: 40px;
    padding: 0 16px;
  }

  .ant-card-head-title {
    font-size: 14px;
    padding: 12px 0;
  }

  .ant-card-body {
    padding: 16px;
  }
`

const SessionItem = styled(List.Item)`
  cursor: pointer;
  padding: 12px !important;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px solid transparent !important;
  transition: all 0.2s;

  &:hover {
    background: var(--color-hover);
    border-color: var(--color-border) !important;
  }
`

const AssistantGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`

const AssistantCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }

  .ant-card-body {
    padding: 12px;
  }
`

const MoreCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-3);
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
`

const FeatureItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--color-text-1);
  }

  div {
    font-size: 12px;
    color: var(--color-text-3);
  }
`

const FeatureIcon = styled.span`
  font-size: 24px;
`

export default GroupChatManagement
