/**
 * UnifiedAssistantManager - 统一助手管理组件
 *
 * 在 VCP Dashboard 中直接使用原生 Assistant 系统
 * 融合 Agent 与 Assistant，实现 "助手即智能体"
 *
 * 功能：
 * - 使用 Redux store 管理助手
 * - 支持从助手库选择预设
 * - 支持 VCP profile 配置（personality, background, greetingMessage）
 * - 支持群聊配置
 * - 兼容 VCPToolBox 格式导入/导出
 */

import {
  BookOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons'
import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAssistants } from '@renderer/hooks/useAssistant'
import AssistantSettingsPopup from '@renderer/pages/settings/AssistantSettings'
import { getDefaultAssistant } from '@renderer/services/AssistantService'
import type { Assistant } from '@renderer/types'
import {
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import { Brain, Sparkles, UserCog } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { v4 as uuid } from 'uuid'

const { Title, Text } = Typography

/**
 * 统一助手管理组件
 */
const UnifiedAssistantManager: FC = () => {
  const { t } = useTranslation()
  const { assistants, addAssistant, removeAssistant, copyAssistant } = useAssistants()

  // 状态
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showGroupChatOnly, setShowGroupChatOnly] = useState(false)

  // 过滤助手
  const filteredAssistants = useMemo(() => {
    return assistants.filter((a) => {
      // 搜索过滤
      if (searchText) {
        const search = searchText.toLowerCase()
        if (
          !a.name.toLowerCase().includes(search) &&
          !(a.description || '').toLowerCase().includes(search) &&
          !(a.profile?.personality || '').toLowerCase().includes(search)
        ) {
          return false
        }
      }

      // 分类过滤
      if (categoryFilter !== 'all' && a.category !== categoryFilter) {
        return false
      }

      // 群聊过滤
      if (showGroupChatOnly && !a.groupChat?.enabled) {
        return false
      }

      return true
    })
  }, [assistants, searchText, categoryFilter, showGroupChatOnly])

  // 统计数据
  const stats = useMemo(() => {
    const groupChatEnabled = assistants.filter((a) => a.groupChat?.enabled).length
    const withProfile = assistants.filter((a) => a.profile?.personality || a.profile?.background).length
    const withMemory = assistants.filter((a) => a.memory?.enabled).length

    return {
      total: assistants.length,
      groupChatEnabled,
      withProfile,
      withMemory
    }
  }, [assistants])

  // 创建新助手
  const handleCreate = useCallback(() => {
    const newAssistant: Assistant = {
      ...getDefaultAssistant(),
      id: uuid(),
      name: t('assistants.new_assistant', '新助手'),
      description: '',
      profile: {
        personality: '',
        background: '',
        greetingMessage: ''
      },
      groupChat: {
        enabled: false,
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        priority: 5
      }
    }

    addAssistant(newAssistant)
    message.success(t('assistants.created', '助手创建成功'))

    // 打开编辑弹窗
    setTimeout(() => {
      AssistantSettingsPopup.show({ assistant: newAssistant, tab: 'vcp' })
    }, 100)
  }, [addAssistant, t])

  // 从助手库选择
  const handleSelectFromLibrary = useCallback(async () => {
    const assistant = await AddAssistantPopup.show()
    if (assistant) {
      message.success(t('assistants.created', '助手创建成功'))
      // 打开 VCP 配置
      setTimeout(() => {
        AssistantSettingsPopup.show({ assistant, tab: 'vcp' })
      }, 100)
    }
  }, [t])

  // 编辑助手
  const handleEdit = useCallback((assistant: Assistant) => {
    AssistantSettingsPopup.show({ assistant, tab: 'vcp' })
  }, [])

  // 复制助手
  const handleCopy = useCallback(
    (assistant: Assistant) => {
      const copied = copyAssistant(assistant)
      if (copied) {
        message.success(t('assistants.copied', '助手已复制'))
      }
    },
    [copyAssistant, t]
  )

  // 删除助手
  const handleDelete = useCallback(
    (id: string) => {
      removeAssistant(id)
      message.success(t('assistants.deleted', '助手已删除'))
    },
    [removeAssistant, t]
  )

  // 导入 VCP Agent 格式
  const handleImport = useCallback(async () => {
    try {
      const result = await window.api.file.open({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result && result.content) {
        // 解析 JSON 内容
        const content = new TextDecoder('utf-8').decode(result.content)
        const importedData = JSON.parse(content)

        // 支持数组格式或单个对象
        const agentList = Array.isArray(importedData) ? importedData : [importedData]

        for (const importedAgent of agentList) {
          // 转换 VCPAgent 为 Assistant
          const newAssistant: Assistant = {
            ...getDefaultAssistant(),
            id: uuid(),
            name: importedAgent.name || importedAgent.displayName || '导入的助手',
            description: importedAgent.description || '',
            prompt: importedAgent.systemPrompt || importedAgent.prompt || '',
            emoji: importedAgent.avatar || importedAgent.emoji || '🤖',
            tags: importedAgent.tags || [],
            category: importedAgent.category || 'custom',
            profile: {
              personality: importedAgent.personality || '',
              background: importedAgent.background || '',
              greetingMessage: importedAgent.greetingMessage || '',
              exampleDialogues: importedAgent.exampleDialogues?.map(
                (d: string | { user: string; assistant: string }) =>
                  typeof d === 'string' ? { user: '', assistant: d } : d
              )
            },
            memory: {
              enabled: importedAgent.vcpConfig?.enableMemory || false,
              diaryBookName: importedAgent.vcpConfig?.diaryBookName,
              windowSize: importedAgent.vcpConfig?.memoryWindowSize
            },
            vcpConfig: {
              enabled: true,
              knowledgeBaseId: importedAgent.vcpConfig?.knowledgeBaseId,
              knowledgeBaseName: importedAgent.vcpConfig?.knowledgeBaseName,
              contextInjections: importedAgent.vcpConfig?.contextInjections
            }
          }

          addAssistant(newAssistant)
        }

        message.success(t('assistants.imported', `成功导入 ${agentList.length} 个助手`))
      }
    } catch (error) {
      console.error('Import failed:', error)
      message.error(t('assistants.import_failed', '导入失败，请检查文件格式'))
    }
  }, [addAssistant, t])

  // 导出为 VCP Agent 格式
  const handleExport = useCallback(
    async (assistant: Assistant) => {
      try {
        // 转换 Assistant 为 VCPAgent 格式
        const vcpAgent = {
          id: assistant.id,
          name: assistant.name,
          displayName: assistant.name,
          avatar: assistant.emoji,
          description: assistant.description || '',
          personality: assistant.profile?.personality || '',
          background: assistant.profile?.background || '',
          systemPrompt: assistant.prompt,
          greetingMessage: assistant.profile?.greetingMessage,
          exampleDialogues: assistant.profile?.exampleDialogues?.map((d) => d.assistant),
          tags: assistant.tags || [],
          category: assistant.category || 'custom',
          isActive: assistant.isActive,
          version: assistant.version || '1.0.0',
          vcpConfig: {
            enableDiary: !!assistant.memory?.diaryBookName,
            diaryBookName: assistant.memory?.diaryBookName,
            knowledgeBaseId: assistant.vcpConfig?.knowledgeBaseId,
            knowledgeBaseName: assistant.vcpConfig?.knowledgeBaseName,
            enableMemory: assistant.memory?.enabled,
            memoryWindowSize: assistant.memory?.windowSize,
            contextInjections: assistant.vcpConfig?.contextInjections
          }
        }

        const content = JSON.stringify(vcpAgent, null, 2)
        await window.api.file.save(`${assistant.name}.json`, new TextEncoder().encode(content), {
          filters: [{ name: 'JSON Files', extensions: ['json'] }]
        })
        message.success(t('assistants.exported', '导出成功'))
      } catch (error) {
        console.error('Export failed:', error)
        message.error(t('assistants.export_failed', '导出失败'))
      }
    },
    [t]
  )

  // 获取分类选项
  const categories = useMemo(() => {
    const cats = new Set(assistants.map((a) => a.category).filter(Boolean))
    return ['all', ...Array.from(cats)]
  }, [assistants])

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          {t('vcp.dashboard.agents.title', '助手管理')}
        </Title>
        <Text type="secondary">
          {t('vcp.dashboard.agents.description', '统一管理所有助手/智能体，支持 VCP 人格配置和群聊协作。')}
        </Text>
      </Header>

      <Content>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <StatCard>
              <Statistic title={t('vcp.agents.total', '助手总数')} value={stats.total} prefix={<UserOutlined />} />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.agents.groupchat_enabled', '群聊就绪')}
                value={stats.groupChatEnabled}
                valueStyle={{ color: '#52c41a' }}
                prefix={<TeamOutlined />}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.agents.with_profile', '有人设')}
                value={stats.withProfile}
                valueStyle={{ color: '#1890ff' }}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.agents.with_memory', '有记忆')}
                value={stats.withMemory}
                valueStyle={{ color: '#722ed1' }}
              />
            </StatCard>
          </Col>
        </Row>

        {/* 工具栏 */}
        <ToolBar>
          <Space>
            <Input
              placeholder={t('vcp.agents.search', '搜索助手...')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 120 }}
              options={categories.map((c) => ({
                value: c,
                label: c === 'all' ? t('common.all', '全部') : c
              }))}
            />
            <Space>
              <Text type="secondary">{t('vcp.agents.groupchat_only', '仅群聊')}</Text>
              <Switch checked={showGroupChatOnly} onChange={setShowGroupChatOnly} size="small" />
            </Space>
          </Space>
          <Space>
            <Tooltip title={t('vcp.agents.import', '导入 VCP Agent')}>
              <Button icon={<ImportOutlined />} onClick={handleImport}>
                {t('common.import', '导入')}
              </Button>
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'blank',
                    icon: <PlusOutlined />,
                    label: t('vcp.agents.create_blank', '空白助手'),
                    onClick: handleCreate
                  },
                  {
                    key: 'library',
                    icon: <BookOutlined />,
                    label: t('vcp.agents.from_library', '从助手库选择'),
                    onClick: handleSelectFromLibrary
                  }
                ]
              }}
              placement="bottomRight">
              <Button type="primary" icon={<PlusOutlined />}>
                {t('vcp.agents.create', '新建助手')}
              </Button>
            </Dropdown>
          </Space>
        </ToolBar>

        {/* 助手列表 */}
        {filteredAssistants.length === 0 ? (
          <Empty
            description={
              searchText ? t('vcp.agents.no_results', '未找到匹配的助手') : t('vcp.agents.empty', '暂无助手')
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 60 }}>
            <Button type="primary" onClick={handleCreate}>
              {t('vcp.agents.create_first', '创建第一个助手')}
            </Button>
          </Empty>
        ) : (
          <AssistantList>
            {filteredAssistants.map((assistant) => (
              <AssistantCard key={assistant.id}>
                <CardHeader>
                  <Avatar size={40} style={{ backgroundColor: 'var(--color-primary-bg)' }}>
                    {assistant.emoji || assistant.name.charAt(0)}
                  </Avatar>
                  <CardInfo>
                    <CardTitle>
                      <Text strong>{assistant.name}</Text>
                      {assistant.groupChat?.enabled && (
                        <Tag color="green" style={{ marginLeft: 8 }}>
                          <TeamOutlined /> {t('vcp.agents.groupchat', '群聊')}
                        </Tag>
                      )}
                    </CardTitle>
                    <CardDesc>
                      {assistant.description ||
                        assistant.profile?.personality ||
                        t('vcp.agents.no_description', '暂无描述')}
                    </CardDesc>
                  </CardInfo>
                  <CardActions>
                    <Tooltip title={t('common.edit', '编辑')}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(assistant)} />
                    </Tooltip>
                    <Tooltip title={t('vcp.agents.settings', '设置')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => AssistantSettingsPopup.show({ assistant })}
                      />
                    </Tooltip>
                    <Tooltip title={t('common.copy', '复制')}>
                      <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(assistant)} />
                    </Tooltip>
                    <Tooltip title={t('common.export', '导出')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<ExportOutlined />}
                        onClick={() => handleExport(assistant)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('vcp.agents.delete_confirm', '确定删除此助手？')}
                      onConfirm={() => handleDelete(assistant.id)}
                      okText={t('common.confirm', '确定')}
                      cancelText={t('common.cancel', '取消')}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </CardActions>
                </CardHeader>

                <CardBody>
                  {/* VCP 特性标签 */}
                  <TagsRow>
                    {assistant.category && <Tag color="blue">{assistant.category}</Tag>}
                    {assistant.profile?.personality && (
                      <Tag color="purple">{t('vcp.agents.has_personality', '有人设')}</Tag>
                    )}
                    {assistant.memory?.enabled && <Tag color="cyan">{t('vcp.agents.has_memory', '有记忆')}</Tag>}
                    {assistant.profile?.greetingMessage && (
                      <Tag color="orange">{t('vcp.agents.has_greeting', '有问候')}</Tag>
                    )}
                    {assistant.groupChat?.role && assistant.groupChat.enabled && (
                      <Tag color="green">
                        {t(`vcp.groupchat.role.${assistant.groupChat.role}`, assistant.groupChat.role)}
                      </Tag>
                    )}
                  </TagsRow>

                  {/* VCP 快捷配置按钮 */}
                  <QuickActions>
                    <Tooltip title={t('vcp.profile.title', '人格配置')}>
                      <QuickActionBtn
                        size="small"
                        icon={<UserCog size={14} />}
                        $active={!!assistant.profile?.personality}
                        onClick={() => AssistantSettingsPopup.show({ assistant, tab: 'vcp' })}
                      />
                    </Tooltip>
                    <Tooltip title={t('vcp.memory.title', '记忆搜索')}>
                      <QuickActionBtn
                        size="small"
                        icon={<Brain size={14} />}
                        $active={!!assistant.memory?.enabled}
                        onClick={() => AssistantSettingsPopup.show({ assistant, tab: 'memory' })}
                      />
                    </Tooltip>
                    <Tooltip title={t('vcp.collaboration.title', 'Agent 协作')}>
                      <QuickActionBtn
                        size="small"
                        icon={<Sparkles size={14} />}
                        $active={!!assistant.collaboration?.canInitiate}
                        onClick={() => AssistantSettingsPopup.show({ assistant, tab: 'vcp' })}
                      />
                    </Tooltip>
                    <Tooltip title={t('vcp.agents.groupchat_config', '群聊配置')}>
                      <QuickActionBtn
                        size="small"
                        icon={<TeamOutlined />}
                        $active={!!assistant.groupChat?.enabled}
                        onClick={() => AssistantSettingsPopup.show({ assistant, tab: 'groupchat' })}
                      />
                    </Tooltip>
                  </QuickActions>
                </CardBody>
              </AssistantCard>
            ))}
          </AssistantList>
        )}
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

const ToolBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const AssistantList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`

const AssistantCard = styled(Card)`
  cursor: default;

  .ant-card-body {
    padding: 16px;
  }

  &:hover {
    border-color: var(--color-primary);
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
`

const CardDesc = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const CardActions = styled.div`
  display: flex;
  gap: 2px;
`

const CardBody = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
`

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const QuickActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
`

const QuickActionBtn = styled(Button)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${(props) => (props.$active ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-2)')};

  &:hover {
    background: var(--color-primary-bg);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

export default UnifiedAssistantManager
