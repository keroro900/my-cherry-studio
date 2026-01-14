/**
 * VCP Tavern Editor - 注入预设编辑器
 *
 * 功能:
 * - 预设 CRUD 操作
 * - 注入规则管理
 * - 规则拖拽排序
 * - 条件触发设置
 * - 预设激活/停用
 *
 * 使用 window.api.tavern.* 预设相关 API
 *
 * @created Phase 8 - 补充缺失的 UI 界面
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import { type FC, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('VCPTavernEditor')

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

// ==================== 类型定义 ====================

interface InjectionContent {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface InjectionCondition {
  type: 'keyword' | 'regex' | 'context_length' | 'message_count'
  value: string | number
  negate?: boolean
}

interface InjectionRule {
  id: string
  name: string
  enabled: boolean
  type: 'relative' | 'depth'
  relativePosition?: 'before' | 'after'
  relativeTarget?: 'system' | 'last_user' | 'last_assistant' | 'first_user'
  depth?: number
  content: InjectionContent
  conditions?: InjectionCondition[]
  priority: number
}

interface TavernPreset {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  rules: InjectionRule[]
  enabled: boolean
}

interface PresetListItem {
  id: string
  name: string
  type: string
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div`
  padding: 24px;
  height: 100%;
  overflow-y: auto;
`

const PresetCard = styled(Card)`
  margin-bottom: 16px;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
  }

  &.active {
    border-color: var(--color-success);
    border-width: 2px;
  }
`

const RuleCard = styled(Card)`
  margin-bottom: 12px;
  background: var(--color-bg-soft);

  .ant-card-head {
    min-height: 44px;
    padding: 0 12px;
  }

  .ant-card-body {
    padding: 12px;
  }
`

const DragHandle = styled.div`
  cursor: grab;
  padding: 4px 8px;
  color: var(--color-text-secondary);

  &:hover {
    color: var(--color-primary);
  }
`

const RuleContent = styled.div`
  background: var(--color-bg-container);
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 8px;
  font-family: monospace;
  white-space: pre-wrap;
  max-height: 100px;
  overflow-y: auto;
`

// ==================== 上下文可视化样式 ====================

const ContextPreviewContainer = styled.div`
  margin-top: 24px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const ContextPreviewHeader = styled.div`
  background: var(--color-bg-soft);
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const ContextPreviewBody = styled.div`
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
`

const MessageItem = styled.div<{ $role: string; $injected?: boolean }>`
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 8px;
  background: ${(props) =>
    props.$injected
      ? props.$role === 'system'
        ? 'rgba(82, 196, 26, 0.1)'
        : props.$role === 'user'
          ? 'rgba(24, 144, 255, 0.1)'
          : 'rgba(250, 173, 20, 0.1)'
      : 'var(--color-bg-soft)'};
  border: ${(props) =>
    props.$injected
      ? props.$role === 'system'
        ? '2px dashed #52c41a'
        : props.$role === 'user'
          ? '2px dashed #1890ff'
          : '2px dashed #faad14'
      : '1px solid var(--color-border)'};
  position: relative;
`

const MessageRole = styled.div<{ $role: string }>`
  font-weight: 600;
  font-size: 12px;
  color: ${(props) =>
    props.$role === 'system' ? '#52c41a' : props.$role === 'user' ? '#1890ff' : '#faad14'};
  margin-bottom: 8px;
  text-transform: uppercase;
`

const MessageContent = styled.div`
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--color-text);
`

const InjectedBadge = styled(Tag)`
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
`

// ==================== 上下文可视化组件 ====================

interface ContextPreviewProps {
  preset: TavernPreset | null
}

interface PreviewMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  injected?: boolean
  ruleName?: string
}

const sampleConversation: PreviewMessage[] = [
  { role: 'system', content: '你是一个有帮助的AI助手。' },
  { role: 'user', content: '你好，请介绍一下你自己。' },
  { role: 'assistant', content: '你好！我是一个AI助手，很高兴见到你。' },
  { role: 'user', content: '你能做什么？' }
]

const ContextPreview: FC<ContextPreviewProps> = ({ preset }) => {
  const [showPreview, setShowPreview] = useState(true)

  // 应用注入规则到示例对话
  const applyPresetToConversation = useCallback((): PreviewMessage[] => {
    if (!preset || !preset.enabled) return sampleConversation

    const result: PreviewMessage[] = sampleConversation.map((msg) => ({ ...msg }))

    const enabledRules = preset.rules.filter((r) => r.enabled)
    // 按优先级排序（高优先级先应用）
    enabledRules.sort((a, b) => b.priority - a.priority)

    for (const rule of enabledRules) {
      const injectedMessage: PreviewMessage = {
        ...rule.content,
        injected: true,
        ruleName: rule.name
      }

      if (rule.type === 'relative') {
        let targetIndex = -1
        const target = rule.relativeTarget || 'system'
        const position = rule.relativePosition || 'after'

        switch (target) {
          case 'system':
            targetIndex = result.findIndex((m) => m.role === 'system')
            break
          case 'first_user':
            targetIndex = result.findIndex((m) => m.role === 'user')
            break
          case 'last_user':
            for (let i = result.length - 1; i >= 0; i--) {
              if (result[i].role === 'user') {
                targetIndex = i
                break
              }
            }
            break
          case 'last_assistant':
            for (let i = result.length - 1; i >= 0; i--) {
              if (result[i].role === 'assistant') {
                targetIndex = i
                break
              }
            }
            break
        }

        if (targetIndex !== -1) {
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
          result.splice(insertIndex, 0, injectedMessage)
        }
      } else if (rule.type === 'depth') {
        const depth = rule.depth ?? 0
        const insertIndex = Math.max(0, result.length - depth)
        result.splice(insertIndex, 0, injectedMessage)
      }
    }

    return result
  }, [preset])

  const previewMessages = applyPresetToConversation()

  return (
    <ContextPreviewContainer>
      <ContextPreviewHeader>
        <Space>
          <Text strong>上下文可视化预览</Text>
          <Tag color="blue">{previewMessages.length} 条消息</Tag>
          {preset && (
            <Tag color={preset.enabled ? 'success' : 'default'}>
              {preset.enabled ? '预设已启用' : '预设未启用'}
            </Tag>
          )}
        </Space>
        <Button type="text" size="small" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? '收起' : '展开'}
        </Button>
      </ContextPreviewHeader>
      {showPreview && (
        <ContextPreviewBody>
          {previewMessages.length > 0 ? (
            previewMessages.map((msg, index) => (
              <MessageItem key={index} $role={msg.role} $injected={msg.injected}>
                <MessageRole $role={msg.role}>{msg.role}</MessageRole>
                <MessageContent>
                  {msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content}
                </MessageContent>
                {msg.injected && (
                  <InjectedBadge color="green">
                    注入: {msg.ruleName || '规则'}
                  </InjectedBadge>
                )}
              </MessageItem>
            ))
          ) : (
            <Empty description="没有消息" />
          )}
        </ContextPreviewBody>
      )}
    </ContextPreviewContainer>
  )
}

// ==================== 主组件 ====================

export const VCPTavernEditor: FC = () => {
  const [form] = Form.useForm()
  const [ruleForm] = Form.useForm()

  // 状态
  const [presets, setPresets] = useState<PresetListItem[]>([])
  const [selectedPreset, setSelectedPreset] = useState<TavernPreset | null>(null)
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [ruleModalVisible, setRuleModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<InjectionRule | null>(null)

  // ==================== 数据加载 ====================

  const loadPresets = useCallback(async () => {
    logger.info('loadPresets: Starting to load presets')

    try {
      setLoading(true)

      // 检查 API 是否可用
      if (!window.api?.tavern?.listPresets) {
        logger.error('Tavern API not available - window.api.tavern.listPresets is undefined')
        message.error('Tavern API 未加载，请检查应用是否正确启动')
        setLoading(false)
        return
      }

      logger.info('loadPresets: Calling window.api.tavern.listPresets()')
      const result = await window.api.tavern.listPresets()
      logger.info('loadPresets: listPresets returned', { success: result?.success, dataLength: result?.data?.length })

      if (result.success && result.data) {
        // 转换数据格式以匹配 PresetListItem
        const presetList = (result.data as any[]).map((preset) => ({
          id: preset.id,
          name: preset.name,
          type: preset.type || 'custom'
        }))
        setPresets(presetList)
        logger.info('loadPresets: Set presets successfully', { count: presetList.length })
      } else {
        logger.warn('listPresets returned no data or failed', { result })
        if (result.error) {
          message.warning('加载预设列表返回错误: ' + result.error)
        }
      }

      // 获取当前激活的预设
      logger.info('loadPresets: Getting active preset')
      const activeResult = await window.api.tavern.getActivePreset()
      if (activeResult.success && activeResult.data) {
        const preset = activeResult.data as TavernPreset
        setActivePresetId(preset.id)
        logger.info('loadPresets: Active preset found', { id: preset.id })
      } else {
        logger.info('loadPresets: No active preset')
      }

      logger.info('loadPresets: Load complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to load presets', { error: errorMessage, stack: (error as Error)?.stack })
      message.error('加载预设列表失败: ' + errorMessage)
    } finally {
      logger.info('loadPresets: Setting loading to false')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // ==================== 操作处理 ====================

  const handleSelectPreset = useCallback(async (presetId: string) => {
    try {
      const result = await window.api.tavern.getPreset(presetId)
      if (result.success && result.data) {
        setSelectedPreset(result.data as TavernPreset)
      }
    } catch (error) {
      logger.error('Failed to load preset', { error })
      message.error('加载预设失败')
    }
  }, [])

  const handleActivatePreset = useCallback(
    async (presetId: string) => {
      try {
        const result = await window.api.tavern.activatePreset(presetId)
        if (result.success) {
          setActivePresetId(presetId)
          message.success('预设已激活')
        }
      } catch (error) {
        logger.error('Failed to activate preset', { error })
        message.error('激活预设失败')
      }
    },
    []
  )

  const handleDeactivatePreset = useCallback(async () => {
    try {
      const result = await window.api.tavern.deactivatePreset()
      if (result.success) {
        setActivePresetId(null)
        message.success('预设已停用')
      }
    } catch (error) {
      logger.error('Failed to deactivate preset', { error })
      message.error('停用预设失败')
    }
  }, [])

  const handleCreatePreset = useCallback(() => {
    setSelectedPreset(null)
    form.resetFields()
    form.setFieldsValue({ name: '', description: '' })
    setEditModalVisible(true)
  }, [form])

  const handleEditPreset = useCallback(() => {
    if (!selectedPreset) return
    form.setFieldsValue({
      name: selectedPreset.name,
      description: selectedPreset.description
    })
    setEditModalVisible(true)
  }, [form, selectedPreset])

  const handleSavePreset = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const preset: TavernPreset = selectedPreset
        ? {
            ...selectedPreset,
            name: values.name,
            description: values.description,
            updatedAt: new Date()
          }
        : {
            id: `preset_${Date.now()}`,
            name: values.name,
            description: values.description,
            createdAt: new Date(),
            updatedAt: new Date(),
            rules: [],
            enabled: true
          }

      const result = await window.api.tavern.savePreset(preset)
      if (result.success) {
        message.success(selectedPreset ? '预设已更新' : '预设已创建')
        setEditModalVisible(false)
        setSelectedPreset(preset)
        await loadPresets()
      }
    } catch (error) {
      logger.error('Failed to save preset', { error })
      message.error('保存预设失败')
    } finally {
      setSaving(false)
    }
  }, [form, loadPresets, selectedPreset])

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        const result = await window.api.tavern.deletePreset(presetId)
        if (result.success) {
          message.success('预设已删除')
          if (selectedPreset?.id === presetId) {
            setSelectedPreset(null)
          }
          if (activePresetId === presetId) {
            setActivePresetId(null)
          }
          await loadPresets()
        }
      } catch (error) {
        logger.error('Failed to delete preset', { error })
        message.error('删除预设失败')
      }
    },
    [activePresetId, loadPresets, selectedPreset]
  )

  // ==================== 规则操作 ====================

  const handleAddRule = useCallback(() => {
    setEditingRule(null)
    ruleForm.resetFields()
    ruleForm.setFieldsValue({
      name: '新规则',
      enabled: true,
      type: 'relative',
      relativePosition: 'after',
      relativeTarget: 'system',
      depth: 1,
      contentRole: 'system',
      contentText: ''
    })
    setRuleModalVisible(true)
  }, [ruleForm])

  const handleEditRule = useCallback(
    (rule: InjectionRule) => {
      setEditingRule(rule)
      ruleForm.setFieldsValue({
        name: rule.name,
        enabled: rule.enabled,
        type: rule.type,
        relativePosition: rule.relativePosition,
        relativeTarget: rule.relativeTarget,
        depth: rule.depth || 1,
        contentRole: rule.content.role,
        contentText: rule.content.content
      })
      setRuleModalVisible(true)
    },
    [ruleForm]
  )

  const handleSaveRule = useCallback(async () => {
    if (!selectedPreset) return

    try {
      const values = await ruleForm.validateFields()
      setSaving(true)

      const rule: InjectionRule = {
        id: editingRule?.id || `rule_${Date.now()}`,
        name: values.name,
        enabled: values.enabled,
        type: values.type,
        relativePosition: values.type === 'relative' ? values.relativePosition : undefined,
        relativeTarget: values.type === 'relative' ? values.relativeTarget : undefined,
        depth: values.type === 'depth' ? values.depth : undefined,
        content: {
          role: values.contentRole,
          content: values.contentText
        },
        priority: editingRule?.priority || selectedPreset.rules.length
      }

      const updatedRules = editingRule
        ? selectedPreset.rules.map((r) => (r.id === editingRule.id ? rule : r))
        : [...selectedPreset.rules, rule]

      const updatedPreset = {
        ...selectedPreset,
        rules: updatedRules,
        updatedAt: new Date()
      }

      const result = await window.api.tavern.savePreset(updatedPreset)
      if (result.success) {
        message.success(editingRule ? '规则已更新' : '规则已添加')
        setRuleModalVisible(false)
        setSelectedPreset(updatedPreset)
      }
    } catch (error) {
      logger.error('Failed to save rule', { error })
      message.error('保存规则失败')
    } finally {
      setSaving(false)
    }
  }, [editingRule, ruleForm, selectedPreset])

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      if (!selectedPreset) return

      try {
        const updatedRules = selectedPreset.rules.filter((r) => r.id !== ruleId)
        const updatedPreset = {
          ...selectedPreset,
          rules: updatedRules,
          updatedAt: new Date()
        }

        const result = await window.api.tavern.savePreset(updatedPreset)
        if (result.success) {
          message.success('规则已删除')
          setSelectedPreset(updatedPreset)
        }
      } catch (error) {
        logger.error('Failed to delete rule', { error })
        message.error('删除规则失败')
      }
    },
    [selectedPreset]
  )

  const handleToggleRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      if (!selectedPreset) return

      const updatedRules = selectedPreset.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
      const updatedPreset = {
        ...selectedPreset,
        rules: updatedRules,
        updatedAt: new Date()
      }

      const result = await window.api.tavern.savePreset(updatedPreset)
      if (result.success) {
        setSelectedPreset(updatedPreset)
      }
    },
    [selectedPreset]
  )

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <PanelContainer>
        <Spin size="large" tip="加载中...">
          <div style={{ height: 400 }} />
        </Spin>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer>
      {/* 标题和操作 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <ThunderboltOutlined /> VCP 注入预设编辑器
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadPresets}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreatePreset}>
              新建预设
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 预设列表 */}
        <Col span={8}>
          <Card title="预设列表" size="small">
            {presets.length > 0 ? (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    size="small"
                    className={activePresetId === preset.id ? 'active' : ''}
                    onClick={() => handleSelectPreset(preset.id)}
                    extra={
                      <Space size="small" onClick={(e) => e.stopPropagation()}>
                        {activePresetId === preset.id ? (
                          <Tooltip title="停用">
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseCircleOutlined />}
                              onClick={handleDeactivatePreset}
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip title="激活">
                            <Button
                              type="text"
                              size="small"
                              icon={<CheckCircleOutlined />}
                              onClick={() => handleActivatePreset(preset.id)}
                            />
                          </Tooltip>
                        )}
                        <Popconfirm
                          title="确定删除此预设？"
                          onConfirm={() => handleDeletePreset(preset.id)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    }>
                    <Space>
                      <Text strong>{preset.name}</Text>
                      {activePresetId === preset.id && (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          激活
                        </Tag>
                      )}
                    </Space>
                  </PresetCard>
                ))}
              </div>
            ) : (
              <Empty description="暂无预设" />
            )}
          </Card>
        </Col>

        {/* 预设详情 */}
        <Col span={16}>
          {selectedPreset ? (
            <Card
              title={
                <Space>
                  <Text strong>{selectedPreset.name}</Text>
                  <Badge count={selectedPreset.rules.length} showZero color="blue" />
                </Space>
              }
              extra={
                <Space>
                  <Button icon={<EditOutlined />} onClick={handleEditPreset}>
                    编辑
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>
                    添加规则
                  </Button>
                </Space>
              }>
              {selectedPreset.description && (
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  {selectedPreset.description}
                </Paragraph>
              )}

              {selectedPreset.rules.length > 0 ? (
                <div>
                  {selectedPreset.rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      size="small"
                      title={
                        <Space>
                          <DragHandle>
                            <HolderOutlined />
                          </DragHandle>
                          <Text strong>{rule.name}</Text>
                          <Tag color={rule.type === 'relative' ? 'blue' : 'purple'}>
                            {rule.type === 'relative' ? '相对注入' : '深度注入'}
                          </Tag>
                          <Tag color={rule.content.role === 'system' ? 'green' : 'orange'}>
                            {rule.content.role}
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space size="small">
                          <Switch
                            size="small"
                            checked={rule.enabled}
                            onChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditRule(rule)} />
                          <Popconfirm title="确定删除此规则？" onConfirm={() => handleDeleteRule(rule.id)}>
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      }>
                      <div>
                        {rule.type === 'relative' ? (
                          <Text type="secondary">
                            在 <Tag>{rule.relativeTarget}</Tag> {rule.relativePosition === 'before' ? '之前' : '之后'}
                            注入
                          </Text>
                        ) : (
                          <Text type="secondary">
                            在深度 <Tag>{rule.depth}</Tag> 处注入
                          </Text>
                        )}
                        <RuleContent>{rule.content.content.slice(0, 200)}...</RuleContent>
                      </div>
                    </RuleCard>
                  ))}
                </div>
              ) : (
                <Empty description='暂无规则，点击"添加规则"开始' />
              )}

              {/* 上下文可视化预览 */}
              <ContextPreview preset={selectedPreset} />
            </Card>
          ) : (
            <Card>
              <Empty description="请选择一个预设或创建新预设" />
            </Card>
          )}
        </Col>
      </Row>

      {/* 编辑预设弹窗 */}
      <Modal
        title={selectedPreset ? '编辑预设' : '新建预设'}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSavePreset}
        confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="预设名称" rules={[{ required: true, message: '请输入预设名称' }]}>
            <Input placeholder="输入预设名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="输入预设描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑规则弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={handleSaveRule}
        confirmLoading={saving}
        width={600}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="输入规则名称" />
          </Form.Item>

          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="type" label="注入类型">
            <Radio.Group>
              <Radio.Button value="relative">相对注入</Radio.Button>
              <Radio.Button value="depth">深度注入</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'relative' ? (
                <>
                  <Form.Item name="relativePosition" label="相对位置">
                    <Select
                      options={[
                        { value: 'before', label: '之前' },
                        { value: 'after', label: '之后' }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="relativeTarget" label="目标">
                    <Select
                      options={[
                        { value: 'system', label: '系统提示' },
                        { value: 'last_user', label: '最后的用户消息' },
                        { value: 'last_assistant', label: '最后的助手消息' },
                        { value: 'first_user', label: '第一条用户消息' }
                      ]}
                    />
                  </Form.Item>
                </>
              ) : (
                <Form.Item name="depth" label="深度">
                  <InputNumber min={1} placeholder="输入深度值" style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item name="contentRole" label="注入角色">
            <Select
              options={[
                { value: 'system', label: 'system' },
                { value: 'user', label: 'user' },
                { value: 'assistant', label: 'assistant' }
              ]}
            />
          </Form.Item>

          <Form.Item
            name="contentText"
            label="注入内容"
            rules={[{ required: true, message: '请输入注入内容' }]}>
            <TextArea rows={6} placeholder="输入要注入的消息内容" />
          </Form.Item>
        </Form>
      </Modal>
    </PanelContainer>
  )
}

export default VCPTavernEditor
