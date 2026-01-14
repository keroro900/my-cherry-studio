/**
 * AssistantGroupChatSettings - 群聊设置
 *
 * 配置助手在群聊中的行为和角色
 */

import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Assistant } from '@renderer/types'
import { Alert, Button, Card, Form, InputNumber, Select, Space, Statistic, Switch, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Partial<Assistant>) => void
}

// 群聊角色选项
const ROLE_OPTIONS = [
  { value: 'participant', label: '参与者', description: '普通群聊成员' },
  { value: 'host', label: '主持人', description: '主导讨论方向，总结观点' },
  { value: 'expert', label: '专家', description: '提供专业意见' },
  { value: 'moderator', label: '协调者', description: '协调讨论，解决冲突' },
  { value: 'observer', label: '观察者', description: '只观察不主动发言' }
]

// 协作服务统计信息类型
interface CollabStats {
  messageCount: number
  taskCount: number
  votingSessionCount: number
  knowledgeEntryCount: number
  agentCount: number
}

const AssistantGroupChatSettings: FC<Props> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()
  const [collabStats, setCollabStats] = useState<CollabStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // 获取当前群聊配置，如果不存在则使用默认值
  const groupChat = assistant.groupChat || {
    enabled: true,
    role: 'participant' as const,
    expertise: [],
    triggerKeywords: [],
    priority: 50,
    speakingPreferences: {
      maxResponseLength: 500,
      preferredTopics: [],
      avoidTopics: []
    }
  }

  const updateGroupChat = useCallback(
    (updates: Partial<typeof groupChat>) => {
      updateAssistant({
        groupChat: {
          ...groupChat,
          ...updates
        }
      })
    },
    [groupChat, updateAssistant]
  )

  const updateSpeakingPreferences = useCallback(
    (updates: Partial<typeof groupChat.speakingPreferences>) => {
      updateGroupChat({
        speakingPreferences: {
          ...groupChat.speakingPreferences,
          ...updates
        }
      })
    },
    [groupChat.speakingPreferences, updateGroupChat]
  )

  // 加载协作服务统计信息
  const loadCollabStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const stats = await window.electron.ipcRenderer.invoke('agent:collab:getStats')
      setCollabStats(stats)
    } catch (error) {
      console.error('Failed to load collab stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    loadCollabStats()
  }, [loadCollabStats])

  return (
    <Container>
      <Alert
        type="info"
        message={t('groupchat.settings.info', '配置此助手在多Agent群聊中的行为和角色')}
        style={{ marginBottom: 16 }}
        showIcon
      />

      {/* Agent 协作服务统计 */}
      <Card
        size="small"
        title={
          <Space>
            <span>{t('groupchat.settings.collab_stats', 'Agent 协作服务状态')}</span>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={isLoadingStats} />}
              onClick={loadCollabStats}
              disabled={isLoadingStats}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}>
        {collabStats ? (
          <Space size="large" wrap>
            <Statistic
              title={t('groupchat.stats.agents', '已注册Agent')}
              value={collabStats.agentCount}
              valueStyle={{ fontSize: 18 }}
            />
            <Statistic
              title={t('groupchat.stats.messages', '消息数')}
              value={collabStats.messageCount}
              valueStyle={{ fontSize: 18 }}
            />
            <Statistic
              title={t('groupchat.stats.tasks', '任务数')}
              value={collabStats.taskCount}
              valueStyle={{ fontSize: 18 }}
            />
            <Statistic
              title={t('groupchat.stats.voting', '投票会话')}
              value={collabStats.votingSessionCount}
              valueStyle={{ fontSize: 18 }}
            />
            <Statistic
              title={t('groupchat.stats.knowledge', '共享知识')}
              value={collabStats.knowledgeEntryCount}
              valueStyle={{ fontSize: 18 }}
            />
          </Space>
        ) : (
          <span style={{ color: 'var(--color-text-3)' }}>
            {isLoadingStats ? t('common.loading', '加载中...') : t('groupchat.stats.unavailable', '统计信息不可用')}
          </span>
        )}
      </Card>

      <Form layout="vertical">
        {/* 启用群聊 */}
        <Form.Item
          label={
            <LabelWithTooltip>
              {t('groupchat.settings.enabled', '启用群聊')}
              <Tooltip title={t('groupchat.settings.enabled_tip', '允许此助手加入群聊会话')}>
                <InfoCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-3)' }} />
              </Tooltip>
            </LabelWithTooltip>
          }>
          <Switch checked={groupChat.enabled} onChange={(checked) => updateGroupChat({ enabled: checked })} />
        </Form.Item>

        {/* 群聊角色 */}
        <Form.Item label={t('groupchat.settings.role', '群聊角色')}>
          <Select
            value={groupChat.role}
            onChange={(value) => updateGroupChat({ role: value })}
            disabled={!groupChat.enabled}
            options={ROLE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <div>
                  <span>{opt.label}</span>
                  <RoleDescription>{opt.description}</RoleDescription>
                </div>
              )
            }))}
          />
        </Form.Item>

        {/* 专业领域 */}
        <Form.Item
          label={
            <LabelWithTooltip>
              {t('groupchat.settings.expertise', '专业领域')}
              <Tooltip title={t('groupchat.settings.expertise_tip', '助手的专业领域标签，用于智能匹配和发言决策')}>
                <InfoCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-3)' }} />
              </Tooltip>
            </LabelWithTooltip>
          }>
          <Select
            mode="tags"
            value={groupChat.expertise}
            onChange={(values) => updateGroupChat({ expertise: values })}
            disabled={!groupChat.enabled}
            placeholder={t('groupchat.settings.expertise_placeholder', '输入专业领域标签，按回车添加')}
            tokenSeparators={[',', '，']}
          />
          <TagHint>{t('groupchat.settings.expertise_examples', '例如: AI, 编程, 设计, 产品管理')}</TagHint>
        </Form.Item>

        {/* 触发关键词 */}
        <Form.Item
          label={
            <LabelWithTooltip>
              {t('groupchat.settings.keywords', '触发关键词')}
              <Tooltip title={t('groupchat.settings.keywords_tip', '当对话中出现这些关键词时，助手更可能被邀请发言')}>
                <InfoCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-3)' }} />
              </Tooltip>
            </LabelWithTooltip>
          }>
          <Select
            mode="tags"
            value={groupChat.triggerKeywords}
            onChange={(values) => updateGroupChat({ triggerKeywords: values })}
            disabled={!groupChat.enabled}
            placeholder={t('groupchat.settings.keywords_placeholder', '输入触发关键词，按回车添加')}
            tokenSeparators={[',', '，']}
          />
        </Form.Item>

        {/* 发言优先级 */}
        <Form.Item
          label={
            <LabelWithTooltip>
              {t('groupchat.settings.priority', '发言优先级')}
              <Tooltip title={t('groupchat.settings.priority_tip', '优先级越高，在多人竞争发言时越优先 (1-100)')}>
                <InfoCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-3)' }} />
              </Tooltip>
            </LabelWithTooltip>
          }>
          <InputNumber
            min={1}
            max={100}
            value={groupChat.priority}
            onChange={(value) => updateGroupChat({ priority: value || 50 })}
            disabled={!groupChat.enabled}
            style={{ width: 120 }}
          />
          <PriorityHint>
            <Tag color={groupChat.priority > 70 ? 'red' : groupChat.priority > 40 ? 'orange' : 'green'}>
              {groupChat.priority > 70 ? '高优先级' : groupChat.priority > 40 ? '中优先级' : '低优先级'}
            </Tag>
          </PriorityHint>
        </Form.Item>

        <SectionTitle>{t('groupchat.settings.speaking_preferences', '发言偏好')}</SectionTitle>

        {/* 最大回复长度 */}
        <Form.Item label={t('groupchat.settings.max_response_length', '最大回复长度')}>
          <InputNumber
            min={50}
            max={2000}
            step={50}
            value={groupChat.speakingPreferences?.maxResponseLength || 500}
            onChange={(value) => updateSpeakingPreferences({ maxResponseLength: value || 500 })}
            disabled={!groupChat.enabled}
            style={{ width: 120 }}
            addonAfter={t('common.characters', '字符')}
          />
        </Form.Item>

        {/* 偏好话题 */}
        <Form.Item label={t('groupchat.settings.preferred_topics', '偏好话题')}>
          <Select
            mode="tags"
            value={groupChat.speakingPreferences?.preferredTopics || []}
            onChange={(values) => updateSpeakingPreferences({ preferredTopics: values })}
            disabled={!groupChat.enabled}
            placeholder={t('groupchat.settings.preferred_topics_placeholder', '助手更愿意参与的话题')}
            tokenSeparators={[',', '，']}
          />
        </Form.Item>

        {/* 回避话题 */}
        <Form.Item label={t('groupchat.settings.avoid_topics', '回避话题')}>
          <Select
            mode="tags"
            value={groupChat.speakingPreferences?.avoidTopics || []}
            onChange={(values) => updateSpeakingPreferences({ avoidTopics: values })}
            disabled={!groupChat.enabled}
            placeholder={t('groupchat.settings.avoid_topics_placeholder', '助手尽量不参与的话题')}
            tokenSeparators={[',', '，']}
          />
        </Form.Item>
      </Form>
    </Container>
  )
}

// Styled Components
const Container = styled.div`
  padding: 0;
`

const LabelWithTooltip = styled.span`
  display: flex;
  align-items: center;
`

const RoleDescription = styled.span`
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-3);
`

const TagHint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
`

const PriorityHint = styled.span`
  margin-left: 12px;
`

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
`

export default AssistantGroupChatSettings
