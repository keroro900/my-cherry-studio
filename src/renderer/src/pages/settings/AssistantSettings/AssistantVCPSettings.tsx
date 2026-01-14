/**
 * 助手 VCP 设置
 *
 * VCP 高级配置：统一记忆搜索、人格配置、Agent 协作
 * 助手即智能体 - 无需单独选择 VCP Agent
 */

import { InfoCircleOutlined, PlusOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import type { Assistant, AssistantSettings } from '@renderer/types'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Input,
  message,
  Select,
  Slider,
  Space,
  Switch,
  Tooltip,
  Typography
} from 'antd'
import { BookOpen, Database, Layers, MessageSquare, Network, Sparkles, Users, UserCog, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Text } = Typography

// 角色卡列表项类型
interface CharacterCardListItem {
  id: string
  name: string
  avatar?: string
  creator?: string
  tags?: string[]
}

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  updateAssistantSettings: (settings: AssistantSettings) => void
}

const AssistantVCPSettings: React.FC<Props> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()

  // 切换 VCP 启用状态
  const handleVCPToggle = (enabled: boolean) => {
    updateAssistant({
      ...assistant,
      vcpConfig: {
        ...assistant.vcpConfig,
        enabled
      }
    })
  }

  const isVCPEnabled = assistant.vcpConfig?.enabled ?? false

  return (
    <Container>
      <HeaderContainer>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          VCP Agent
          <Tooltip title={t('vcp.settings.description', '启用 VCP 高级功能：记忆搜索、人格配置、Agent 协作')}>
            <InfoIcon />
          </Tooltip>
        </div>
        <Space>
          <Switch checked={isVCPEnabled} onChange={handleVCPToggle} />
        </Space>
      </HeaderContainer>

      {isVCPEnabled && (
        <Alert
          type="info"
          message={t('vcp.settings.info_title', 'VCP 上下文注入')}
          description={t(
            'vcp.settings.info_desc_new',
            '启用 VCP 后，此助手将具备统一记忆搜索、人格定制、Agent 协作等高级功能。'
          )}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* VCP 高级配置 - 只有启用 VCP 时才可用 */}
      <DisabledOverlay disabled={!isVCPEnabled}>
        <Collapse
          style={{ marginTop: 16 }}
          defaultActiveKey={isVCPEnabled ? ['unified-memory'] : []}
          collapsible={isVCPEnabled ? undefined : 'disabled'}
          items={[
            {
              key: 'unified-memory',
              label: (
                <HStack style={{ gap: 8, alignItems: 'center' }}>
                  <Sparkles size={16} />
                  {t('vcp.memory.title', '记忆设置')}
                </HStack>
              ),
              children: <UnifiedMemoryConfig assistant={assistant} updateAssistant={updateAssistant} disabled={!isVCPEnabled} />
            },
            {
              key: 'vcp-profile',
              label: (
                <HStack style={{ gap: 8, alignItems: 'center' }}>
                  <UserCog size={16} />
                  {t('vcp.profile.title', '人格配置')}
                </HStack>
              ),
              children: <VCPProfileConfig assistant={assistant} updateAssistant={updateAssistant} disabled={!isVCPEnabled} />
            },
            {
              key: 'agent-collaboration',
              label: (
                <HStack style={{ gap: 8, alignItems: 'center' }}>
                  <Users size={16} />
                  {t('vcp.collaboration.title', 'Agent 协作配置')}
                </HStack>
              ),
              children: <AgentCollaborationConfig assistant={assistant} updateAssistant={updateAssistant} disabled={!isVCPEnabled} />
            }
          ]}
        />
      </DisabledOverlay>

      {!isVCPEnabled && (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}>
          {t('vcp.settings.enable_hint', '开启 VCP Agent 以使用以下高级功能')}
        </Text>
      )}
    </Container>
  )
}

// ==================== 统一记忆配置组件 ====================

interface UnifiedMemoryConfigProps {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  disabled?: boolean
}

const UnifiedMemoryConfig: React.FC<UnifiedMemoryConfigProps> = ({ assistant, updateAssistant, disabled }) => {
  const { t } = useTranslation()
  const memoryConfig: Partial<NonNullable<Assistant['memory']>> = assistant.memory || {}

  const updateMemoryConfig = (updates: Partial<NonNullable<Assistant['memory']>>) => {
    updateAssistant({
      ...assistant,
      memory: {
        enabled: memoryConfig.enabled ?? false,
        ...memoryConfig,
        ...updates
      }
    })
  }

  const backendOptions = [
    { value: 'diary', label: 'VCP Diary (TagMemo)', icon: <BookOpen size={14} /> },
    { value: 'lightmemo', label: 'LightMemo (BM25)', icon: <Layers size={14} /> },
    { value: 'deepmemo', label: 'DeepMemo (Tantivy)', icon: <Database size={14} /> },
    { value: 'meshmemo', label: 'MeshMemo (Vector)', icon: <Network size={14} /> },
    { value: 'memory', label: 'Memory (mem0)', icon: <Sparkles size={14} /> },
    { value: 'knowledge', label: 'Knowledge Base', icon: <Database size={14} /> }
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert
        type="info"
        message={t('vcp.memory.info', '统一记忆搜索会在对话时自动检索相关记忆并注入上下文')}
        showIcon
        style={{ marginBottom: 8 }}
      />

      {/* 启用开关 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.memory.enable', '启用统一记忆搜索')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.memory.enable_desc', '对话时自动检索多个记忆后端')}
          </Text>
        </div>
        <Switch
          checked={memoryConfig.enableUnifiedSearch ?? false}
          onChange={(checked) => updateMemoryConfig({ enableUnifiedSearch: checked })}
        />
      </MemoryConfigRow>

      {memoryConfig.enableUnifiedSearch && (
        <>
          {/* 后端选择 */}
          <MemoryConfigRow>
            <div>
              <Text strong>{t('vcp.memory.backends', '记忆后端')}</Text>
            </div>
            <Checkbox.Group
              value={memoryConfig.backends || ['diary', 'lightmemo', 'deepmemo', 'meshmemo']}
              onChange={(values) => updateMemoryConfig({ backends: values as any[] })}>
              <Space direction="vertical">
                {backendOptions.map((opt) => (
                  <Checkbox key={opt.value} value={opt.value}>
                    <HStack style={{ gap: 6, alignItems: 'center' }}>
                      {opt.icon}
                      <span>{opt.label}</span>
                    </HStack>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </MemoryConfigRow>

          {/* TagMemo 设置 */}
          <Card size="small" style={{ marginTop: 8 }}>
            <HStack style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <Zap size={16} />
              <Text strong>{t('vcp.memory.tagmemo', 'TagMemo 设置')}</Text>
            </HStack>

            <MemoryConfigRow>
              <div>
                <Text>{t('vcp.memory.tag_boost', 'Tag 增强系数')}</Text>
                <Text code style={{ marginLeft: 8 }}>
                  {(memoryConfig.tagBoost ?? 0.5).toFixed(2)}
                </Text>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={memoryConfig.tagBoost ?? 0.5}
                onChange={(value) => updateMemoryConfig({ tagBoost: value })}
                style={{ width: 120 }}
              />
            </MemoryConfigRow>

            <MemoryConfigRow>
              <div>
                <Text>{t('vcp.memory.use_rrf', '使用 RRF 融合')}</Text>
              </div>
              <Switch
                checked={memoryConfig.useRRF ?? true}
                onChange={(checked) => updateMemoryConfig({ useRRF: checked })}
              />
            </MemoryConfigRow>

            <MemoryConfigRow>
              <div>
                <Text>{t('vcp.memory.diary_filter', '日记本过滤')}</Text>
              </div>
              <Input
                placeholder={t('vcp.memory.diary_filter_placeholder', '留空表示搜索全部')}
                value={memoryConfig.diaryNameFilter || ''}
                onChange={(e) => updateMemoryConfig({ diaryNameFilter: e.target.value || undefined })}
                style={{ width: 150 }}
                allowClear
              />
            </MemoryConfigRow>

            <MemoryConfigRow>
              <div>
                <Text>{t('vcp.memory.top_k', '结果数量')}</Text>
              </div>
              <Select
                value={memoryConfig.topK ?? 5}
                onChange={(value) => updateMemoryConfig({ topK: value })}
                style={{ width: 100 }}
                options={[
                  { value: 3, label: '3' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' }
                ]}
              />
            </MemoryConfigRow>
          </Card>
        </>
      )}
    </Space>
  )
}

// ==================== VCP 人格配置组件 ====================

interface VCPProfileConfigProps {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  disabled?: boolean
}

const VCPProfileConfig: React.FC<VCPProfileConfigProps> = ({ assistant, updateAssistant, disabled }) => {
  const { t } = useTranslation()
  const profile = assistant.profile || {}

  // 角色卡列表状态
  const [characterCards, setCharacterCards] = useState<CharacterCardListItem[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(profile.characterCardId)

  // 加载角色卡列表
  const loadCharacterCards = useCallback(async () => {
    if (!window.api?.tavern?.listCards) return

    try {
      setLoadingCards(true)
      const result = await window.api.tavern.listCards()
      if (result.success && result.data) {
        setCharacterCards(result.data as CharacterCardListItem[])
      }
    } catch (error) {
      console.error('Failed to load character cards:', error)
    } finally {
      setLoadingCards(false)
    }
  }, [])

  useEffect(() => {
    loadCharacterCards()
  }, [loadCharacterCards])

  // 同步选中状态
  useEffect(() => {
    setSelectedCardId(profile.characterCardId)
  }, [profile.characterCardId])

  const updateProfile = (updates: Partial<NonNullable<Assistant['profile']>>) => {
    updateAssistant({
      ...assistant,
      profile: {
        ...profile,
        ...updates
      }
    })
  }

  // 选择角色卡时自动填充人格数据
  const handleSelectCharacterCard = useCallback(
    async (cardId: string | undefined) => {
      setSelectedCardId(cardId)

      if (!cardId) {
        // 清除角色卡绑定
        updateProfile({ characterCardId: undefined })
        return
      }

      // 加载角色卡详情并填充
      try {
        const result = await window.api.tavern.getCard(cardId)
        if (result.success && result.data) {
          const card = result.data as any
          const cardData = card.data || {}

          // 自动填充人格数据
          updateProfile({
            characterCardId: cardId,
            personality: cardData.personality || card.personality || undefined,
            background: cardData.scenario || cardData.description || card.description || undefined,
            greetingMessage: cardData.first_mes || cardData.greeting || card.first_mes || undefined,
            traits: card.tags || undefined
          })

          message.success(t('vcp.profile.card_applied', `已应用角色卡: ${card.name}`))
        }
      } catch (error) {
        console.error('Failed to load character card:', error)
        message.error(t('vcp.profile.card_load_failed', '加载角色卡失败'))
      }
    },
    [updateProfile, t]
  )

  const addExampleDialogue = () => {
    const dialogues = profile.exampleDialogues || []
    updateProfile({
      exampleDialogues: [...dialogues, { user: '', assistant: '' }]
    })
  }

  const updateExampleDialogue = (index: number, field: 'user' | 'assistant', value: string) => {
    const dialogues = [...(profile.exampleDialogues || [])]
    dialogues[index] = { ...dialogues[index], [field]: value }
    updateProfile({ exampleDialogues: dialogues })
  }

  const removeExampleDialogue = (index: number) => {
    const dialogues = (profile.exampleDialogues || []).filter((_, i) => i !== index)
    updateProfile({ exampleDialogues: dialogues })
  }

  const toneOptions = [
    { value: 'formal', label: t('vcp.profile.tone_formal', '正式') },
    { value: 'casual', label: t('vcp.profile.tone_casual', '随意') },
    { value: 'playful', label: t('vcp.profile.tone_playful', '活泼') },
    { value: 'professional', label: t('vcp.profile.tone_professional', '专业') }
  ]

  // 查找当前选中的角色卡
  const selectedCard = characterCards.find((c) => c.id === selectedCardId)

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert
        type="info"
        message={t('vcp.profile.info', '人格配置用于定义 Agent 的角色特征和对话风格')}
        showIcon
        style={{ marginBottom: 8 }}
      />

      {/* 角色卡选择器 */}
      <Card size="small" style={{ marginBottom: 12, background: 'var(--color-background-soft)' }}>
        <HStack style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <UserOutlined />
          <Text strong>{t('vcp.profile.character_card', '绑定角色卡')}</Text>
          <Tooltip title={t('vcp.profile.character_card_tip', '选择一个角色卡自动填充人格配置，或手动编辑下方字段')}>
            <InfoCircleOutlined style={{ color: 'var(--color-text-3)' }} />
          </Tooltip>
        </HStack>

        <Select
          style={{ width: '100%' }}
          placeholder={t('vcp.profile.select_card', '选择角色卡（可选）')}
          value={selectedCardId}
          onChange={handleSelectCharacterCard}
          loading={loadingCards}
          allowClear
          showSearch
          optionFilterProp="label"
          options={characterCards.map((card) => ({
            value: card.id,
            label: card.name,
            card
          }))}
          optionRender={(option) => {
            const card = option.data.card as CharacterCardListItem
            return (
              <HStack style={{ gap: 8, alignItems: 'center' }}>
                {card.avatar ? (
                  <Avatar src={`file://${card.avatar}`} size={24} />
                ) : (
                  <Avatar size={24} style={{ backgroundColor: '#1890ff' }}>
                    {card.name.charAt(0).toUpperCase()}
                  </Avatar>
                )}
                <span>{card.name}</span>
                {card.creator && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    by {card.creator}
                  </Text>
                )}
              </HStack>
            )
          }}
        />

        {selectedCard && (
          <div style={{ marginTop: 8 }}>
            <HStack style={{ gap: 8, alignItems: 'center' }}>
              {selectedCard.avatar ? (
                <Avatar src={`file://${selectedCard.avatar}`} size={32} />
              ) : (
                <Avatar size={32} style={{ backgroundColor: '#52c41a' }}>
                  {selectedCard.name.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div>
                <Text strong>{selectedCard.name}</Text>
                {selectedCard.tags && selectedCard.tags.length > 0 && (
                  <div>
                    {selectedCard.tags.slice(0, 3).map((tag) => (
                      <Text key={tag} type="secondary" style={{ fontSize: 11, marginRight: 4 }}>
                        #{tag}
                      </Text>
                    ))}
                  </div>
                )}
              </div>
            </HStack>
          </div>
        )}
      </Card>

      {/* 人格特质 */}
      <MemoryConfigRow>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.profile.personality', '人格特质')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.profile.personality_desc', '描述 Agent 的性格和行为方式')}
          </Text>
        </div>
      </MemoryConfigRow>
      <Input.TextArea
        rows={2}
        placeholder={t('vcp.profile.personality_placeholder', '例如：热情友好、善于倾听、逻辑清晰...')}
        value={profile.personality || ''}
        onChange={(e) => updateProfile({ personality: e.target.value || undefined })}
      />

      {/* 背景故事 */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.profile.background', '背景故事')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.profile.background_desc', 'Agent 的背景设定和经历')}
          </Text>
        </div>
      </MemoryConfigRow>
      <Input.TextArea
        rows={3}
        placeholder={t('vcp.profile.background_placeholder', '例如：作为一位资深技术专家...')}
        value={profile.background || ''}
        onChange={(e) => updateProfile({ background: e.target.value || undefined })}
      />

      {/* 问候语 */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.profile.greeting', '问候语')}</Text>
        </div>
      </MemoryConfigRow>
      <Input
        placeholder={t('vcp.profile.greeting_placeholder', '对话开始时的问候语')}
        value={profile.greetingMessage || ''}
        onChange={(e) => updateProfile({ greetingMessage: e.target.value || undefined })}
      />

      {/* 语气风格 */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div>
          <Text strong>{t('vcp.profile.tone', '语气风格')}</Text>
        </div>
        <Select
          style={{ width: 120 }}
          placeholder={t('vcp.profile.tone_placeholder', '选择风格')}
          value={profile.tone}
          onChange={(value) => updateProfile({ tone: value })}
          options={toneOptions}
          allowClear
        />
      </MemoryConfigRow>

      {/* 人设标签 */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.profile.traits', '人设标签')}</Text>
        </div>
      </MemoryConfigRow>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder={t('vcp.profile.traits_placeholder', '输入标签并回车')}
        value={profile.traits || []}
        onChange={(values) => updateProfile({ traits: values })}
      />

      {/* 示例对话 */}
      <Card size="small" style={{ marginTop: 12 }}>
        <HStack style={{ gap: 8, alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
          <HStack style={{ gap: 8, alignItems: 'center' }}>
            <MessageSquare size={16} />
            <Text strong>{t('vcp.profile.example_dialogues', '示例对话')}</Text>
          </HStack>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addExampleDialogue}>
            {t('vcp.profile.add_dialogue', '添加')}
          </Button>
        </HStack>

        {(profile.exampleDialogues || []).length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vcp.profile.no_dialogues', '暂无示例对话')} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {(profile.exampleDialogues || []).map((dialogue, index) => (
              <Card key={index} size="small" style={{ background: 'var(--color-background-soft)' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('vcp.profile.user_says', '用户说:')}
                    </Text>
                    <Input
                      placeholder={t('vcp.profile.user_placeholder', '用户的消息')}
                      value={dialogue.user}
                      onChange={(e) => updateExampleDialogue(index, 'user', e.target.value)}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('vcp.profile.assistant_says', '助手回复:')}
                    </Text>
                    <Input.TextArea
                      rows={2}
                      placeholder={t('vcp.profile.assistant_placeholder', '助手的回复')}
                      value={dialogue.assistant}
                      onChange={(e) => updateExampleDialogue(index, 'assistant', e.target.value)}
                    />
                  </div>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeExampleDialogue(index)}>
                    {t('vcp.profile.remove_dialogue', '删除')}
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  )
}

// ==================== Agent 协作配置组件 ====================

interface AgentCollaborationConfigProps {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  disabled?: boolean
}

const AgentCollaborationConfig: React.FC<AgentCollaborationConfigProps> = ({ assistant, updateAssistant, disabled }) => {
  const { t } = useTranslation()
  const collaborationConfig = assistant.collaboration || {}

  const updateCollaboration = (updates: Partial<NonNullable<Assistant['collaboration']>>) => {
    updateAssistant({
      ...assistant,
      collaboration: {
        ...collaborationConfig,
        ...updates
      }
    })
  }

  const responseStyleOptions = [
    { value: 'concise', label: t('vcp.collaboration.style_concise', '简洁') },
    { value: 'detailed', label: t('vcp.collaboration.style_detailed', '详细') },
    { value: 'adaptive', label: t('vcp.collaboration.style_adaptive', '自适应') }
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert
        type="info"
        message={t('vcp.collaboration.info', '配置此助手与其他 Agent 的协作方式')}
        showIcon
        style={{ marginBottom: 8 }}
      />

      {/* 主动发起协作 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.collaboration.can_initiate', '主动发起协作')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.collaboration.can_initiate_desc', '允许此 Agent 主动调用其他 Agent')}
          </Text>
        </div>
        <Switch
          checked={collaborationConfig.canInitiate ?? true}
          onChange={(checked) => updateCollaboration({ canInitiate: checked })}
        />
      </MemoryConfigRow>

      {/* 委托任务 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.collaboration.can_delegate', '委托任务')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.collaboration.can_delegate_desc', '允许此 Agent 将任务委托给其他 Agent')}
          </Text>
        </div>
        <Switch
          checked={collaborationConfig.canDelegate ?? false}
          onChange={(checked) => updateCollaboration({ canDelegate: checked })}
        />
      </MemoryConfigRow>

      {/* 最大并发任务数 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.collaboration.max_tasks', '最大并发任务')}</Text>
        </div>
        <Select
          value={collaborationConfig.maxConcurrentTasks ?? 3}
          onChange={(value) => updateCollaboration({ maxConcurrentTasks: value })}
          style={{ width: 80 }}
          options={[
            { value: 1, label: '1' },
            { value: 3, label: '3' },
            { value: 5, label: '5' },
            { value: 10, label: '10' }
          ]}
        />
      </MemoryConfigRow>

      {/* 响应风格 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.collaboration.response_style', '响应风格')}</Text>
        </div>
        <Select
          value={collaborationConfig.responseStyle ?? 'adaptive'}
          onChange={(value) => updateCollaboration({ responseStyle: value })}
          style={{ width: 100 }}
          options={responseStyleOptions}
        />
      </MemoryConfigRow>

      {/* 消息前缀 */}
      <MemoryConfigRow>
        <div>
          <Text strong>{t('vcp.collaboration.message_prefix', '消息前缀')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.collaboration.message_prefix_desc', '协作消息的标识前缀')}
          </Text>
        </div>
      </MemoryConfigRow>
      <Input
        placeholder={t('vcp.collaboration.message_prefix_placeholder', '例如: [来自助手A]')}
        value={collaborationConfig.messagePrefix || ''}
        onChange={(e) => updateCollaboration({ messagePrefix: e.target.value || undefined })}
      />

      {/* 允许协作的 Agent */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.collaboration.allowed_agents', '允许协作的 Agent')}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {t('vcp.collaboration.allowed_agents_desc', '留空表示允许与所有 Agent 协作')}
          </Text>
        </div>
      </MemoryConfigRow>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder={t('vcp.collaboration.allowed_agents_placeholder', '输入 Agent ID 并回车')}
        value={collaborationConfig.allowedAgents || []}
        onChange={(values) => updateCollaboration({ allowedAgents: values })}
      />

      {/* 禁止协作的 Agent */}
      <MemoryConfigRow style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <Text strong>{t('vcp.collaboration.blocked_agents', '禁止协作的 Agent')}</Text>
        </div>
      </MemoryConfigRow>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder={t('vcp.collaboration.blocked_agents_placeholder', '输入 Agent ID 并回车')}
        value={collaborationConfig.blockedAgents || []}
        onChange={(values) => updateCollaboration({ blockedAgents: values })}
      />
    </Space>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const InfoIcon = styled(InfoCircleOutlined)`
  margin-left: 6px;
  font-size: 14px;
  color: var(--color-text-2);
  cursor: help;
`

const MemoryConfigRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }
`

// 禁用遮罩层 - 当 disabled 为 true 时显示灰色半透明效果
const DisabledOverlay = styled.div<{ disabled?: boolean }>`
  position: relative;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
  transition: opacity 0.2s ease;

  ${(props) =>
    props.disabled &&
    `
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: transparent;
      cursor: not-allowed;
    }
  `}
`

export default AssistantVCPSettings
