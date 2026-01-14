/**
 * VCP Agent 管理器组件
 *
 * 功能:
 * - Agent 列表展示与管理
 * - 变量编辑器
 * - 模板管理
 */

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
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
const { Panel } = Collapse

// ==================== 类型定义 ====================

interface VCPAgent {
  id: string
  name: string
  description?: string
  systemPrompt: string
  variables: Array<{ name: string; value: string; description?: string }>
  personality?: string
  background?: string
  greetingMessage?: string
  category?: string
  tags: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface PromptVariable {
  id: string
  name: string
  value: string
  description?: string
  category?: string
  scope?: 'global' | 'agent' | 'session'
  isSystem?: boolean
  createdAt: Date
  updatedAt: Date
}

interface PromptTemplate {
  id: string
  name: string
  content: string
  description?: string
  category?: string
  variables: string[]
  createdAt: Date
  updatedAt: Date
}

// ==================== 主组件 ====================

const AgentManager: FC = () => {
  const [agents, setAgents] = useState<VCPAgent[]>([])
  const [variables, setVariables] = useState<PromptVariable[]>([])
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [activeTab, setActiveTab] = useState('agents')
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<VCPAgent | null>(null)
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false)
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<VCPAgent | null>(null)
  const [editingVariable, setEditingVariable] = useState<PromptVariable | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)

  const [agentForm] = Form.useForm()
  const [variableForm] = Form.useForm()
  const [templateForm] = Form.useForm()

  // ==================== 数据加载 ====================

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsData, variablesData, templatesData] = await Promise.all([
        window.electron.ipcRenderer.invoke('vcp:agent:list'),
        window.electron.ipcRenderer.invoke('vcp:variable:list'),
        window.electron.ipcRenderer.invoke('vcp:template:list')
      ])
      // 注意：不同 IPC 返回格式不一致
      // vcp:agent:list 直接返回数组
      // vcp:variable:list 返回 { success, variables }
      // vcp:template:list 返回 { success, templates }
      setAgents(Array.isArray(agentsData) ? agentsData : [])
      setVariables(variablesData?.variables || [])
      setTemplates(templatesData?.templates || [])
    } catch (error) {
      console.error('Failed to load VCP data:', error)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ==================== Agent 操作 ====================

  const handleCreateAgent = () => {
    setEditingAgent(null)
    agentForm.resetFields()
    setIsAgentModalOpen(true)
  }

  const handleEditAgent = (agent: VCPAgent) => {
    setEditingAgent(agent)
    agentForm.setFieldsValue({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      personality: agent.personality,
      background: agent.background,
      greetingMessage: agent.greetingMessage,
      category: agent.category,
      tags: agent.tags
    })
    setIsAgentModalOpen(true)
  }

  const handleSaveAgent = async () => {
    try {
      const values = await agentForm.validateFields()

      if (editingAgent) {
        await window.electron.ipcRenderer.invoke('vcp:agent:update', {
          id: editingAgent.id,
          ...values
        })
        message.success('Agent 更新成功')
      } else {
        await window.electron.ipcRenderer.invoke('vcp:agent:create', values)
        message.success('Agent 创建成功')
      }

      setIsAgentModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save agent:', error)
      message.error('保存失败')
    }
  }

  const handleDeleteAgent = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:agent:delete', id)
      message.success('Agent 删除成功')
      loadData()
    } catch (error) {
      console.error('Failed to delete agent:', error)
      message.error('删除失败')
    }
  }

  const handleActivateAgent = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:agent:activate', id)
      message.success('Agent 已激活')
      loadData()
    } catch (error) {
      console.error('Failed to activate agent:', error)
      message.error('激活失败')
    }
  }

  const handleImportAgent = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:openFile', {
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      })

      if (result && result.filePath) {
        await window.electron.ipcRenderer.invoke('vcp:agent:import', result.filePath)
        message.success('导入成功')
        loadData()
      }
    } catch (error) {
      console.error('Failed to import agent:', error)
      message.error('导入失败')
    }
  }

  // ==================== 变量操作 ====================

  const handleCreateVariable = () => {
    setEditingVariable(null)
    variableForm.resetFields()
    setIsVariableModalOpen(true)
  }

  const handleEditVariable = (variable: PromptVariable) => {
    setEditingVariable(variable)
    variableForm.setFieldsValue({
      name: variable.name,
      value: variable.value,
      description: variable.description,
      category: variable.category,
      scope: variable.scope || 'global'
    })
    setIsVariableModalOpen(true)
  }

  const handleSaveVariable = async () => {
    try {
      const values = await variableForm.validateFields()

      if (editingVariable) {
        await window.electron.ipcRenderer.invoke('vcp:variable:update', {
          id: editingVariable.id,
          ...values
        })
        message.success('变量更新成功')
      } else {
        await window.electron.ipcRenderer.invoke('vcp:variable:create', values)
        message.success('变量创建成功')
      }

      setIsVariableModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save variable:', error)
      message.error('保存失败')
    }
  }

  const handleDeleteVariable = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:variable:delete', id)
      message.success('变量删除成功')
      loadData()
    } catch (error) {
      console.error('Failed to delete variable:', error)
      message.error('删除失败')
    }
  }

  // ==================== 模板操作 ====================

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    templateForm.resetFields()
    setIsTemplateModalOpen(true)
  }

  const handleEditTemplate = (template: PromptTemplate) => {
    setEditingTemplate(template)
    templateForm.setFieldsValue({
      name: template.name,
      content: template.content,
      description: template.description,
      category: template.category
    })
    setIsTemplateModalOpen(true)
  }

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields()

      if (editingTemplate) {
        await window.electron.ipcRenderer.invoke('vcp:template:update', {
          id: editingTemplate.id,
          ...values
        })
        message.success('模板更新成功')
      } else {
        await window.electron.ipcRenderer.invoke('vcp:template:create', values)
        message.success('模板创建成功')
      }

      setIsTemplateModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save template:', error)
      message.error('保存失败')
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:template:delete', id)
      message.success('模板删除成功')
      loadData()
    } catch (error) {
      console.error('Failed to delete template:', error)
      message.error('删除失败')
    }
  }

  const handleRenderTemplate = async (id: string) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('vcp:template:render', { id })
      Modal.info({
        title: '渲染结果',
        content: <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>{result}</pre>,
        width: 600
      })
    } catch (error) {
      console.error('Failed to render template:', error)
      message.error('渲染失败')
    }
  }

  // ==================== 渲染 ====================

  const renderAgentList = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateAgent}>
          新建 Agent
        </Button>
        <Button icon={<ImportOutlined />} onClick={handleImportAgent}>
          从文件导入
        </Button>
      </Space>

      {agents.length === 0 ? (
        <Empty description="暂无 Agent" />
      ) : (
        <Row gutter={[16, 16]}>
          {agents.map((agent) => (
            <Col xs={24} sm={12} lg={8} key={agent.id}>
              <AgentCard hoverable className={agent.isActive ? 'active' : ''} onClick={() => setSelectedAgent(agent)}>
                <Card.Meta
                  title={
                    <Space>
                      {agent.name}
                      {agent.isActive && <Badge status="success" text="激活" />}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                        {agent.description || agent.systemPrompt.substring(0, 100)}
                      </Paragraph>
                      <Space size={[4, 4]} wrap>
                        {agent.category && <Tag color="blue">{agent.category}</Tag>}
                        {agent.tags?.slice(0, 3).map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    </div>
                  }
                />
                <CardActions>
                  <Tooltip title="激活">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleActivateAgent(agent.id)
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditAgent(agent)
                      }}
                    />
                  </Tooltip>
                  <Popconfirm title="确定删除此 Agent?" onConfirm={() => handleDeleteAgent(agent.id)}>
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Tooltip>
                  </Popconfirm>
                </CardActions>
              </AgentCard>
            </Col>
          ))}
        </Row>
      )}

      {/* Agent 详情面板 */}
      {selectedAgent && (
        <AgentDetailPanel>
          <Divider />
          <Title level={5}>{selectedAgent.name} - 详细信息</Title>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="分类">{selectedAgent.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {selectedAgent.isActive ? (
                <Badge status="success" text="激活" />
              ) : (
                <Badge status="default" text="未激活" />
              )}
            </Descriptions.Item>
            <Descriptions.Item label="变量数量">{selectedAgent.variables?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedAgent.createdAt).toLocaleDateString()}
            </Descriptions.Item>
          </Descriptions>

          <Collapse style={{ marginTop: 16 }}>
            <Panel header="系统提示词" key="prompt">
              <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {selectedAgent.systemPrompt}
              </pre>
            </Panel>
            {selectedAgent.personality && (
              <Panel header="个性设定" key="personality">
                <Text>{selectedAgent.personality}</Text>
              </Panel>
            )}
            {selectedAgent.background && (
              <Panel header="背景故事" key="background">
                <Text>{selectedAgent.background}</Text>
              </Panel>
            )}
            {selectedAgent.greetingMessage && (
              <Panel header="问候语" key="greeting">
                <Text>{selectedAgent.greetingMessage}</Text>
              </Panel>
            )}
            {selectedAgent.variables && selectedAgent.variables.length > 0 && (
              <Panel header="变量" key="variables">
                <Table
                  size="small"
                  pagination={false}
                  dataSource={selectedAgent.variables}
                  columns={[
                    { title: '名称', dataIndex: 'name', key: 'name' },
                    { title: '值', dataIndex: 'value', key: 'value' },
                    { title: '描述', dataIndex: 'description', key: 'description' }
                  ]}
                  rowKey="name"
                />
              </Panel>
            )}
          </Collapse>
        </AgentDetailPanel>
      )}
    </div>
  )

  const renderVariableList = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateVariable}>
          新建变量
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={variables}
        rowKey="id"
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: PromptVariable) => (
              <Space>
                <Text code>{name}</Text>
                {record.isSystem && <Tag color="purple">系统</Tag>}
              </Space>
            )
          },
          {
            title: '值',
            dataIndex: 'value',
            key: 'value',
            ellipsis: true,
            render: (value: string) => <Text ellipsis>{value}</Text>
          },
          {
            title: '作用域',
            dataIndex: 'scope',
            key: 'scope',
            render: (scope: string) => {
              const colors: Record<string, string> = { global: 'blue', agent: 'green', session: 'orange' }
              return <Tag color={colors[scope] || 'default'}>{scope || 'global'}</Tag>
            }
          },
          {
            title: '分类',
            dataIndex: 'category',
            key: 'category'
          },
          {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true
          },
          {
            title: '操作',
            key: 'action',
            render: (_: unknown, record: PromptVariable) =>
              !record.isSystem && (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditVariable(record)}>
                    编辑
                  </Button>
                  <Popconfirm title="确定删除此变量?" onConfirm={() => handleDeleteVariable(record.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
          }
        ]}
      />
    </div>
  )

  const renderTemplateList = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<FileAddOutlined />} onClick={handleCreateTemplate}>
          新建模板
        </Button>
      </Space>

      <List
        loading={loading}
        dataSource={templates}
        renderItem={(template) => (
          <List.Item
            actions={[
              <Button
                key="render"
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleRenderTemplate(template.id)}>
                渲染
              </Button>,
              <Button
                key="copy"
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(template.content)
                  message.success('已复制到剪贴板')
                }}>
                复制
              </Button>,
              <Button
                key="edit"
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditTemplate(template)}>
                编辑
              </Button>,
              <Popconfirm key="delete" title="确定删除此模板?" onConfirm={() => handleDeleteTemplate(template.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            ]}>
            <List.Item.Meta
              title={
                <Space>
                  {template.name}
                  {template.category && <Tag color="blue">{template.category}</Tag>}
                </Space>
              }
              description={
                <div>
                  {template.description && <div style={{ marginBottom: 4 }}>{template.description}</div>}
                  <Space size={[4, 4]} wrap>
                    {template.variables?.map((v) => (
                      <Tag key={v} color="cyan">
                        {v}
                      </Tag>
                    ))}
                  </Space>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Container>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'agents', label: 'Agent 列表', children: renderAgentList() },
          { key: 'variables', label: '变量管理', children: renderVariableList() },
          { key: 'templates', label: '模板管理', children: renderTemplateList() }
        ]}
      />

      {/* Agent 编辑弹窗 */}
      <Modal
        title={editingAgent ? '编辑 Agent' : '新建 Agent'}
        open={isAgentModalOpen}
        onOk={handleSaveAgent}
        onCancel={() => setIsAgentModalOpen(false)}
        width={800}
        okText="保存"
        cancelText="取消">
        <Form form={agentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="Agent 名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Input placeholder="分类" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="Agent 描述" rows={2} />
          </Form.Item>
          <Form.Item name="systemPrompt" label="系统提示词" rules={[{ required: true, message: '请输入系统提示词' }]}>
            <TextArea placeholder="系统提示词 (支持 {{变量}} 语法)" rows={6} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personality" label="个性设定">
                <TextArea placeholder="个性描述" rows={3} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="background" label="背景故事">
                <TextArea placeholder="背景故事" rows={3} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="greetingMessage" label="问候语">
            <Input placeholder="开场问候语" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 变量编辑弹窗 */}
      <Modal
        title={editingVariable ? '编辑变量' : '新建变量'}
        open={isVariableModalOpen}
        onOk={handleSaveVariable}
        onCancel={() => setIsVariableModalOpen(false)}
        okText="保存"
        cancelText="取消">
        <Form form={variableForm} layout="vertical">
          <Form.Item name="name" label="变量名" rules={[{ required: true, message: '请输入变量名' }]}>
            <Input placeholder="变量名 (如: {{user_name}})" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
            <TextArea placeholder="变量值" rows={3} />
          </Form.Item>
          <Form.Item name="scope" label="作用域">
            <Select defaultValue="global">
              <Select.Option value="global">全局</Select.Option>
              <Select.Option value="agent">Agent 级别</Select.Option>
              <Select.Option value="session">会话级别</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="变量描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模板编辑弹窗 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={isTemplateModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setIsTemplateModalOpen(false)}
        width={700}
        okText="保存"
        cancelText="取消">
        <Form form={templateForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="模板名称" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="模板描述" />
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true, message: '请输入模板内容' }]}>
            <TextArea placeholder="模板内容 (支持 {{变量}} 语法)" rows={10} />
          </Form.Item>
        </Form>
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

const AgentCard = styled(Card)`
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

const AgentDetailPanel = styled.div`
  margin-top: 16px;
`

export default AgentManager
