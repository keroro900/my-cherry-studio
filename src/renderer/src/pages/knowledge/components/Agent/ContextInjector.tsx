/**
 * VCPTavern 上下文注入器组件
 *
 * 功能:
 * - 注入规则管理
 * - 预设管理
 * - 触发条件配置
 * - 注入测试
 */

import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const { TextArea } = Input
const { Text, Title, Paragraph } = Typography

// ==================== 类型定义 ====================

type InjectionPosition =
  | 'system_prefix'
  | 'system_suffix'
  | 'context_prefix'
  | 'context_suffix'
  | 'user_prefix'
  | 'user_suffix'
  | 'assistant_prefix'
  | 'hidden'

type TriggerType = 'always' | 'keyword' | 'regex' | 'turn_count' | 'time_based' | 'random' | 'context_length' | 'custom'

interface TriggerCondition {
  type: TriggerType
  value: string | number | boolean | Record<string, any>
  negate?: boolean
}

interface InjectionRule {
  id: string
  name: string
  description?: string
  position: InjectionPosition
  content: string
  priority: number
  triggers: TriggerCondition[]
  triggerLogic: 'and' | 'or'
  isActive: boolean
  cooldown?: number
  maxTriggers?: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface VCPTavernPreset {
  id: string
  name: string
  description?: string
  rules: InjectionRule[]
  isActive: boolean
  targetAgents?: string[]
  createdAt: Date
  updatedAt: Date
}

interface InjectionResult {
  position: InjectionPosition
  content: string
  ruleId: string
  ruleName: string
}

// ==================== 常量 ====================

const POSITION_OPTIONS = [
  { value: 'system_prefix', label: '系统提示词开头', color: 'blue' },
  { value: 'system_suffix', label: '系统提示词结尾', color: 'cyan' },
  { value: 'context_prefix', label: '上下文开头', color: 'green' },
  { value: 'context_suffix', label: '上下文结尾', color: 'lime' },
  { value: 'user_prefix', label: '用户消息前', color: 'orange' },
  { value: 'user_suffix', label: '用户消息后', color: 'gold' },
  { value: 'assistant_prefix', label: '助手消息前', color: 'purple' },
  { value: 'hidden', label: '隐藏注入', color: 'default' }
]

const TRIGGER_TYPE_OPTIONS = [
  { value: 'always', label: '始终触发' },
  { value: 'keyword', label: '关键词触发' },
  { value: 'regex', label: '正则匹配' },
  { value: 'turn_count', label: '对话轮次' },
  { value: 'time_based', label: '时间触发' },
  { value: 'random', label: '随机触发' },
  { value: 'context_length', label: '上下文长度' }
]

// ==================== 主组件 ====================

const ContextInjector: FC = () => {
  const [rules, setRules] = useState<InjectionRule[]>([])
  const [presets, setPresets] = useState<VCPTavernPreset[]>([])
  const [activeTab, setActiveTab] = useState('rules')
  const [loading, setLoading] = useState(false)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<InjectionRule | null>(null)
  const [editingPreset, setEditingPreset] = useState<VCPTavernPreset | null>(null)
  const [testResults, setTestResults] = useState<InjectionResult[]>([])

  const [ruleForm] = Form.useForm()
  const [presetForm] = Form.useForm()
  const [testForm] = Form.useForm()

  // ==================== 数据加载 ====================

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesData, presetsData] = await Promise.all([
        window.electron.ipcRenderer.invoke('vcp:injector:rule:list'),
        window.electron.ipcRenderer.invoke('vcp:injector:preset:list')
      ])
      setRules(rulesData || [])
      setPresets(presetsData || [])
    } catch (error) {
      console.error('Failed to load injector data:', error)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ==================== 规则操作 ====================

  const handleCreateRule = () => {
    setEditingRule(null)
    ruleForm.resetFields()
    ruleForm.setFieldsValue({
      priority: 5,
      triggerLogic: 'and',
      triggers: [{ type: 'always', value: true }]
    })
    setIsRuleModalOpen(true)
  }

  const handleEditRule = (rule: InjectionRule) => {
    setEditingRule(rule)
    ruleForm.setFieldsValue({
      name: rule.name,
      description: rule.description,
      position: rule.position,
      content: rule.content,
      priority: rule.priority,
      triggerLogic: rule.triggerLogic,
      triggers: rule.triggers,
      cooldown: rule.cooldown,
      maxTriggers: rule.maxTriggers,
      tags: rule.tags
    })
    setIsRuleModalOpen(true)
  }

  const handleSaveRule = async () => {
    try {
      const values = await ruleForm.validateFields()

      if (editingRule) {
        await window.electron.ipcRenderer.invoke('vcp:injector:rule:update', {
          id: editingRule.id,
          ...values
        })
        message.success('规则更新成功')
      } else {
        await window.electron.ipcRenderer.invoke('vcp:injector:rule:create', values)
        message.success('规则创建成功')
      }

      setIsRuleModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save rule:', error)
      message.error('保存失败')
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:rule:delete', id)
      message.success('规则删除成功')
      loadData()
    } catch (error) {
      console.error('Failed to delete rule:', error)
      message.error('删除失败')
    }
  }

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:rule:toggle', { id, isActive })
      loadData()
    } catch (error) {
      console.error('Failed to toggle rule:', error)
      message.error('切换失败')
    }
  }

  // ==================== 预设操作 ====================

  const handleCreatePreset = () => {
    setEditingPreset(null)
    presetForm.resetFields()
    setIsPresetModalOpen(true)
  }

  const handleCreateDirectorPreset = async () => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:preset:createDirector')
      message.success('导演模式预设创建成功')
      loadData()
    } catch (error) {
      console.error('Failed to create director preset:', error)
      message.error('创建失败')
    }
  }

  const handleCreateRoleplayPreset = async () => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:preset:createRoleplay')
      message.success('角色扮演预设创建成功')
      loadData()
    } catch (error) {
      console.error('Failed to create roleplay preset:', error)
      message.error('创建失败')
    }
  }

  const handleActivatePreset = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:preset:activate', id)
      message.success('预设已激活')
      loadData()
    } catch (error) {
      console.error('Failed to activate preset:', error)
      message.error('激活失败')
    }
  }

  const handleDeletePreset = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:injector:preset:delete', id)
      message.success('预设删除成功')
      loadData()
    } catch (error) {
      console.error('Failed to delete preset:', error)
      message.error('删除失败')
    }
  }

  // ==================== 测试 ====================

  const handleTest = () => {
    testForm.resetFields()
    testForm.setFieldsValue({
      turnCount: 1,
      lastUserMessage: '',
      contextLength: 0
    })
    setTestResults([])
    setIsTestModalOpen(true)
  }

  const handleExecuteTest = async () => {
    try {
      const values = await testForm.validateFields()
      const results = await window.electron.ipcRenderer.invoke('vcp:injector:execute', values)
      setTestResults(results || [])
    } catch (error) {
      console.error('Failed to execute test:', error)
      message.error('测试失败')
    }
  }

  // ==================== 渲染 ====================

  const getPositionTag = (position: InjectionPosition) => {
    const option = POSITION_OPTIONS.find((o) => o.value === position)
    return <Tag color={option?.color || 'default'}>{option?.label || position}</Tag>
  }

  const renderRuleList = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRule}>
          新建规则
        </Button>
        <Button icon={<ExperimentOutlined />} onClick={handleTest}>
          测试注入
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={rules}
        rowKey="id"
        columns={[
          {
            title: '状态',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 80,
            render: (isActive: boolean, record: InjectionRule) => (
              <Switch size="small" checked={isActive} onChange={(checked) => handleToggleRule(record.id, checked)} />
            )
          },
          {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: InjectionRule) => (
              <Space>
                <Text strong>{name}</Text>
                <Badge count={record.priority} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            )
          },
          {
            title: '注入位置',
            dataIndex: 'position',
            key: 'position',
            render: (position: InjectionPosition) => getPositionTag(position)
          },
          {
            title: '触发条件',
            dataIndex: 'triggers',
            key: 'triggers',
            render: (triggers: TriggerCondition[], record: InjectionRule) => (
              <Space size={[4, 4]} wrap>
                {triggers.map((t, i) => (
                  <Tag key={i} color={t.negate ? 'red' : 'default'}>
                    {t.negate && '非 '}
                    {TRIGGER_TYPE_OPTIONS.find((o) => o.value === t.type)?.label || t.type}
                  </Tag>
                ))}
                {triggers.length > 1 && (
                  <Tag color="purple">{record.triggerLogic === 'and' ? '全部满足' : '任一满足'}</Tag>
                )}
              </Space>
            )
          },
          {
            title: '冷却/限制',
            key: 'limits',
            render: (_: unknown, record: InjectionRule) => (
              <Space>
                {record.cooldown && <Text type="secondary">{record.cooldown}s冷却</Text>}
                {record.maxTriggers && <Text type="secondary">最多{record.maxTriggers}次</Text>}
              </Space>
            )
          },
          {
            title: '操作',
            key: 'action',
            render: (_: unknown, record: InjectionRule) => (
              <Space>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRule(record)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除此规则?" onConfirm={() => handleDeleteRule(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '8px 0' }}>
              <Title level={5}>注入内容</Title>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                {record.content}
              </pre>
              {record.tags && record.tags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">标签: </Text>
                  {record.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  )

  const renderPresetList = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreatePreset}>
          新建预设
        </Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleCreateDirectorPreset}>
          创建导演模式
        </Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleCreateRoleplayPreset}>
          创建角色扮演增强
        </Button>
      </Space>

      {presets.length === 0 ? (
        <Empty description="暂无预设" />
      ) : (
        <Row gutter={[16, 16]}>
          {presets.map((preset) => (
            <Col xs={24} sm={12} lg={8} key={preset.id}>
              <PresetCard hoverable className={preset.isActive ? 'active' : ''}>
                <Card.Meta
                  title={
                    <Space>
                      {preset.name}
                      {preset.isActive && <Badge status="success" text="激活" />}
                    </Space>
                  }
                  description={
                    <div>
                      {preset.description && (
                        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                          {preset.description}
                        </Paragraph>
                      )}
                      <div>包含 {preset.rules.length} 条规则</div>
                    </div>
                  }
                />
                <CardActions>
                  <Tooltip title="激活">
                    <Button
                      type="text"
                      size="small"
                      icon={preset.isActive ? <CheckCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={() => handleActivatePreset(preset.id)}
                      disabled={preset.isActive}
                    />
                  </Tooltip>
                  <Popconfirm title="确定删除此预设?" onConfirm={() => handleDeletePreset(preset.id)}>
                    <Tooltip title="删除">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </CardActions>
              </PresetCard>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )

  return (
    <Container>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'rules', label: '注入规则', children: renderRuleList() },
          { key: 'presets', label: '预设管理', children: renderPresetList() }
        ]}
      />

      {/* 规则编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={isRuleModalOpen}
        onOk={handleSaveRule}
        onCancel={() => setIsRuleModalOpen(false)}
        width={800}
        okText="保存"
        cancelText="取消">
        <Form form={ruleForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="规则名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position" label="注入位置" rules={[{ required: true, message: '请选择注入位置' }]}>
                <Select placeholder="选择注入位置">
                  {POSITION_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      <Tag color={opt.color}>{opt.label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input placeholder="规则描述" />
          </Form.Item>

          <Form.Item name="content" label="注入内容" rules={[{ required: true, message: '请输入注入内容' }]}>
            <TextArea placeholder="注入内容 (支持 {{变量}} 语法)" rows={4} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="priority" label="优先级">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cooldown" label="冷却时间 (秒)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxTriggers" label="最大触发次数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="triggerLogic" label="触发逻辑">
            <Select>
              <Select.Option value="and">全部满足 (AND)</Select.Option>
              <Select.Option value="or">任一满足 (OR)</Select.Option>
            </Select>
          </Form.Item>

          <Form.List name="triggers">
            {(fields, { add, remove }) => (
              <>
                <Divider orientation="left">触发条件</Divider>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={16} key={key} align="middle">
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true }]}>
                        <Select placeholder="触发类型">
                          {TRIGGER_TYPE_OPTIONS.map((opt) => (
                            <Select.Option key={opt.value} value={opt.value}>
                              {opt.label}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item {...restField} name={[name, 'value']}>
                        <Input placeholder="触发值 (关键词/正则/数值等)" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'negate']} valuePropName="checked">
                        <Switch checkedChildren="取反" unCheckedChildren="正常" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ type: 'always', value: true })}
                  block
                  icon={<PlusOutlined />}>
                  添加触发条件
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item name="tags" label="标签" style={{ marginTop: 16 }}>
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 预设编辑弹窗 */}
      <Modal
        title={editingPreset ? '编辑预设' : '新建预设'}
        open={isPresetModalOpen}
        onOk={async () => {
          try {
            const values = await presetForm.validateFields()

            // 从规则ID获取完整规则对象
            const selectedRules = rules.filter((r) => values.ruleIds?.includes(r.id))

            if (editingPreset) {
              // 更新现有预设
              await window.electron.ipcRenderer.invoke('vcp:injector:preset:update', {
                id: editingPreset.id,
                name: values.name,
                description: values.description,
                rules: selectedRules,
                targetAgents: values.targetAgents
              })
              message.success('预设更新成功')
            } else {
              // 创建新预设
              await window.electron.ipcRenderer.invoke('vcp:injector:preset:create', {
                name: values.name,
                description: values.description,
                rules: selectedRules,
                targetAgents: values.targetAgents
              })
              message.success('预设创建成功')
            }

            setIsPresetModalOpen(false)
            presetForm.resetFields()
            loadData()
          } catch (error) {
            console.error('Failed to save preset:', error)
            message.error('保存失败')
          }
        }}
        onCancel={() => setIsPresetModalOpen(false)}
        okText="保存"
        cancelText="取消">
        <Form form={presetForm} layout="vertical">
          <Form.Item name="name" label="预设名称" rules={[{ required: true, message: '请输入预设名称' }]}>
            <Input placeholder="预设名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea placeholder="预设描述" rows={3} />
          </Form.Item>
          <Form.Item name="ruleIds" label="包含规则">
            <Select mode="multiple" placeholder="选择要包含的规则">
              {rules.map((rule) => (
                <Select.Option key={rule.id} value={rule.id}>
                  {rule.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试弹窗 */}
      <Modal
        title="测试注入"
        open={isTestModalOpen}
        onCancel={() => setIsTestModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsTestModalOpen(false)}>
            关闭
          </Button>,
          <Button key="test" type="primary" icon={<ExperimentOutlined />} onClick={handleExecuteTest}>
            执行测试
          </Button>
        ]}
        width={700}>
        <Form form={testForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="turnCount" label="对话轮次">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contextLength" label="上下文长度">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="lastUserMessage" label="最后一条用户消息">
            <TextArea placeholder="模拟用户消息内容" rows={3} />
          </Form.Item>
        </Form>

        <Divider />

        <Title level={5}>测试结果</Title>
        {testResults.length === 0 ? (
          <Empty description="暂无触发的注入规则" />
        ) : (
          <div>
            {testResults.map((result, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8 }}>
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="规则">{result.ruleName}</Descriptions.Item>
                  <Descriptions.Item label="位置">{getPositionTag(result.position)}</Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">注入内容:</Text>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      background: '#f5f5f5',
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 4
                    }}>
                    {result.content}
                  </pre>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </Container>
  )
}

// ==================== 样式 ====================

const Container = styled.div`
  padding: 16px;
  height: 100%;
  overflow-y: auto;
`

const PresetCard = styled(Card)`
  &.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
  }

  .ant-card-meta-description {
    color: var(--color-text-2);
  }
`

const CardActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
`

export default ContextInjector
