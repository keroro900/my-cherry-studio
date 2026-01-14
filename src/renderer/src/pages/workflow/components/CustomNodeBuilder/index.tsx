/**
 * 自定义节点构建器
 * Custom Node Builder
 *
 * 可视化创建和管理自定义节点
 */

import {
  Alert,
  Button,
  Card,
  Collapse,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Copy, Download, Edit, FileCode, FolderInput, Play, Plus, Save, Settings, Trash2, Upload } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import { customNodeRegistry } from '../../nodes/custom'
import type { CustomNodeDefinition, CustomNodeTemplate } from '../../nodes/custom/types'
import {
  BUILTIN_TEMPLATES,
  createDefaultCustomNodeDefinition,
  validateCustomNodeDefinition
} from '../../nodes/custom/types'

const { TextArea } = Input
const { Option: _Option } = Select
const { Panel } = Collapse

// 数据类型选项
const DATA_TYPE_OPTIONS = [
  { label: '任意', value: 'any' },
  { label: '文本', value: 'text' },
  { label: '图片', value: 'image' },
  { label: '图片列表', value: 'images' },
  { label: '视频', value: 'video' },
  { label: 'JSON', value: 'json' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' }
]

// 配置字段类型选项
const CONFIG_FIELD_TYPES = [
  { label: '文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '开关', value: 'checkbox' },
  { label: '选择器', value: 'select' },
  { label: '颜色', value: 'color' }
]

// 执行模式选项
const EXECUTION_MODES = [
  { label: '同步', value: 'sync' },
  { label: '异步 (支持 await)', value: 'async' }
]

// 错误处理策略
const ERROR_HANDLING_OPTIONS = [
  { label: '抛出错误', value: 'throw' },
  { label: '返回 null', value: 'null' },
  { label: '返回默认值', value: 'default' }
]

interface CustomNodeBuilderProps {
  visible: boolean
  onClose: () => void
  onSave?: () => void
}

/**
 * 自定义节点构建器组件
 */
export const CustomNodeBuilder = memo(function CustomNodeBuilder({ visible, onClose, onSave }: CustomNodeBuilderProps) {
  const [nodes, setNodes] = useState<CustomNodeDefinition[]>([])
  const [editingNode, setEditingNode] = useState<CustomNodeDefinition | null>(null)
  const [isEditorVisible, setIsEditorVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [form] = Form.useForm()

  // 加载节点列表
  const loadNodes = useCallback(() => {
    const allNodes = customNodeRegistry.getAllNodes()
    setNodes(allNodes)
  }, [])

  useEffect(() => {
    if (visible) {
      loadNodes()
    }
  }, [visible, loadNodes])

  // 创建新节点
  const handleCreate = useCallback(() => {
    const newNode = createDefaultCustomNodeDefinition()
    setEditingNode(newNode)
    form.setFieldsValue(newNode)
    setIsEditorVisible(true)
  }, [form])

  // 从模板创建
  const handleCreateFromTemplate = useCallback(
    (template: CustomNodeTemplate) => {
      const newNode: CustomNodeDefinition = {
        ...template.definition,
        id: `custom_${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true
      }
      setEditingNode(newNode)
      form.setFieldsValue(newNode)
      setIsEditorVisible(true)
    },
    [form]
  )

  // 编辑节点
  const handleEdit = useCallback(
    (node: CustomNodeDefinition) => {
      setEditingNode(node)
      form.setFieldsValue(node)
      setIsEditorVisible(true)
    },
    [form]
  )

  // 删除节点
  const handleDelete = useCallback(
    (id: string) => {
      if (customNodeRegistry.deleteNode(id)) {
        message.success('节点已删除')
        loadNodes()
        onSave?.()
      } else {
        message.error('删除失败')
      }
    },
    [loadNodes, onSave]
  )

  // 保存节点
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const node: CustomNodeDefinition = {
        ...editingNode!,
        ...values,
        updatedAt: Date.now()
      }

      // 验证
      const errors = validateCustomNodeDefinition(node)
      if (errors.length > 0) {
        message.error(errors.join('\n'))
        return
      }

      // 保存
      const isNew = !nodes.find((n) => n.id === node.id)
      if (isNew) {
        if (customNodeRegistry.addNode(node)) {
          message.success('节点创建成功')
        } else {
          message.error('创建失败')
          return
        }
      } else {
        if (customNodeRegistry.updateNode(node)) {
          message.success('节点更新成功')
        } else {
          message.error('更新失败')
          return
        }
      }

      setIsEditorVisible(false)
      setEditingNode(null)
      loadNodes()
      onSave?.()
    } catch (err) {
      console.error('Form validation failed:', err)
    }
  }, [editingNode, form, loadNodes, nodes, onSave])

  // 导出节点
  const handleExport = useCallback((id: string) => {
    const json = customNodeRegistry.exportNode(id)
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `custom_node_${id}.json`
      a.click()
      URL.revokeObjectURL(url)
      message.success('导出成功')
    }
  }, [])

  // 导出所有
  const handleExportAll = useCallback(() => {
    const json = customNodeRegistry.exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'custom_nodes_all.json'
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }, [])

  // 导入节点
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const result = customNodeRegistry.importNode(text)

      if (result.success) {
        message.success('导入成功')
        loadNodes()
        onSave?.()
      } else {
        message.error('导入失败: ' + (result.errors?.join(', ') || '未知错误'))
      }
    }
    input.click()
  }, [loadNodes, onSave])

  // 复制节点
  const handleDuplicate = useCallback(
    (node: CustomNodeDefinition) => {
      const newNode: CustomNodeDefinition = {
        ...node,
        id: `custom_${Date.now()}`,
        type: `${node.type}_copy`,
        label: `${node.label} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      if (customNodeRegistry.addNode(newNode)) {
        message.success('复制成功')
        loadNodes()
        onSave?.()
      }
    },
    [loadNodes, onSave]
  )

  // 测试代码
  const handleTestCode = useCallback(async () => {
    const code = form.getFieldValue('code')
    const executionMode = form.getFieldValue('executionMode')

    try {
      // 简单的语法检查
      if (executionMode === 'async') {
        new Function('inputs', 'config', 'outputs', 'console', 'utils', 'fetch', `return (async () => { ${code} })();`)
      } else {
        new Function('inputs', 'config', 'outputs', 'console', 'utils', `return (() => { ${code} })();`)
      }
      message.success('代码语法正确')
    } catch (err) {
      message.error(`语法错误: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form])

  // 表格列定义
  const columns: ColumnsType<CustomNodeDefinition> = [
    {
      title: '图标',
      dataIndex: 'icon',
      width: 60,
      render: (icon) => <span style={{ fontSize: 20 }}>{icon}</span>
    },
    {
      title: '名称',
      dataIndex: 'label',
      render: (label, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{record.type}</div>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<Edit size={14} />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="text" size="small" icon={<Copy size={14} />} onClick={() => handleDuplicate(record)} />
          </Tooltip>
          <Tooltip title="导出">
            <Button type="text" size="small" icon={<Download size={14} />} onClick={() => handleExport(record.id)} />
          </Tooltip>
          <Popconfirm
            title="确定删除此节点？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <Drawer
        title={
          <Space>
            <Settings size={18} />
            <span>自定义节点管理</span>
          </Space>
        }
        placement="right"
        width={800}
        open={visible}
        onClose={onClose}
        extra={
          <Space>
            <Button icon={<Upload size={14} />} onClick={handleImport}>
              导入
            </Button>
            <Button icon={<Download size={14} />} onClick={handleExportAll}>
              导出全部
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>
              新建节点
            </Button>
          </Space>
        }>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: (
                <Space>
                  <FileCode size={14} />
                  节点列表
                </Space>
              ),
              children: (
                <Table
                  dataSource={nodes}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: '暂无自定义节点，点击"新建节点"创建' }}
                />
              )
            },
            {
              key: 'templates',
              label: (
                <Space>
                  <FolderInput size={14} />
                  内置模板
                </Space>
              ),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {BUILTIN_TEMPLATES.map((template) => (
                    <Card
                      key={template.id}
                      size="small"
                      hoverable
                      onClick={() => handleCreateFromTemplate(template)}
                      style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{template.definition.icon}</span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{template.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                            {template.description}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            }
          ]}
        />
      </Drawer>

      {/* 节点编辑器 */}
      <Modal
        title={
          editingNode?.id.startsWith('custom_') && !nodes.find((n) => n.id === editingNode?.id)
            ? '创建自定义节点'
            : '编辑自定义节点'
        }
        open={isEditorVisible}
        onCancel={() => setIsEditorVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setIsEditorVisible(false)}>
            取消
          </Button>,
          <Button key="test" icon={<Play size={14} />} onClick={handleTestCode}>
            测试代码
          </Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} onClick={handleSave}>
            保存
          </Button>
        ]}>
        <Form form={form} layout="vertical" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <Collapse defaultActiveKey={['basic', 'code']} ghost>
            {/* 基本信息 */}
            <Panel header="基本信息" key="basic">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <Form.Item name="type" label="节点类型" rules={[{ required: true }]}>
                  <Input placeholder="my_node" addonBefore="custom_" />
                </Form.Item>
                <Form.Item name="label" label="显示名称" rules={[{ required: true }]}>
                  <Input placeholder="我的节点" />
                </Form.Item>
                <Form.Item name="icon" label="图标">
                  <Input placeholder="⚡" style={{ width: 80 }} />
                </Form.Item>
              </div>
              <Form.Item name="description" label="描述">
                <Input placeholder="节点功能描述" />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <Form.Item name="version" label="版本">
                  <Input placeholder="1.0.0" />
                </Form.Item>
                <Form.Item name="author" label="作者">
                  <Input placeholder="作者名称" />
                </Form.Item>
                <Form.Item name="enabled" label="启用" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            </Panel>

            {/* 输入端口 */}
            <Panel header="输入端口" key="inputs">
              <Form.List name="inputs">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Form.Item {...field} name={[field.name, 'id']} style={{ flex: 1, marginBottom: 0 }}>
                          <Input placeholder="端口 ID" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'label']} style={{ flex: 1, marginBottom: 0 }}>
                          <Input placeholder="显示名称" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'dataType']} style={{ width: 120, marginBottom: 0 }}>
                          <Select placeholder="数据类型" options={DATA_TYPE_OPTIONS} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'required']}
                          valuePropName="checked"
                          style={{ marginBottom: 0 }}>
                          <Switch checkedChildren="必填" unCheckedChildren="可选" />
                        </Form.Item>
                        <Button type="text" danger icon={<Trash2 size={14} />} onClick={() => remove(field.name)} />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ id: '', label: '', dataType: 'any', required: false })}
                      block>
                      添加输入端口
                    </Button>
                  </>
                )}
              </Form.List>
            </Panel>

            {/* 输出端口 */}
            <Panel header="输出端口" key="outputs">
              <Form.List name="outputs">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Form.Item {...field} name={[field.name, 'id']} style={{ flex: 1, marginBottom: 0 }}>
                          <Input placeholder="端口 ID" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'label']} style={{ flex: 1, marginBottom: 0 }}>
                          <Input placeholder="显示名称" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'dataType']} style={{ width: 120, marginBottom: 0 }}>
                          <Select placeholder="数据类型" options={DATA_TYPE_OPTIONS} />
                        </Form.Item>
                        <Button type="text" danger icon={<Trash2 size={14} />} onClick={() => remove(field.name)} />
                      </div>
                    ))}
                    <Button type="dashed" onClick={() => add({ id: '', label: '', dataType: 'any' })} block>
                      添加输出端口
                    </Button>
                  </>
                )}
              </Form.List>
            </Panel>

            {/* 配置字段 */}
            <Panel header="配置字段" key="configFields">
              <Form.List name="configFields">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Card key={field.key} size="small" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          <Form.Item {...field} name={[field.name, 'key']} label="字段名" style={{ marginBottom: 8 }}>
                            <Input placeholder="field_key" />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            name={[field.name, 'label']}
                            label="显示名称"
                            style={{ marginBottom: 8 }}>
                            <Input placeholder="字段标签" />
                          </Form.Item>
                          <Form.Item {...field} name={[field.name, 'type']} label="类型" style={{ marginBottom: 8 }}>
                            <Select options={CONFIG_FIELD_TYPES} />
                          </Form.Item>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Form.Item
                            {...field}
                            name={[field.name, 'default']}
                            label="默认值"
                            style={{ flex: 1, marginBottom: 0 }}>
                            <Input placeholder="默认值" />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            name={[field.name, 'required']}
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}>
                            <Switch checkedChildren="必填" unCheckedChildren="可选" />
                          </Form.Item>
                          <Button type="text" danger icon={<Trash2 size={14} />} onClick={() => remove(field.name)} />
                        </div>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ key: '', label: '', type: 'text', required: false })}
                      block>
                      添加配置字段
                    </Button>
                  </>
                )}
              </Form.List>
            </Panel>

            {/* 执行代码 */}
            <Panel header="执行代码" key="code">
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="代码说明"
                description={
                  <div style={{ fontSize: 12 }}>
                    <p>可用变量：</p>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li>
                        <code>inputs</code> - 所有输入数据对象
                      </li>
                      <li>
                        <code>config</code> - 节点配置对象
                      </li>
                      <li>
                        <code>outputs</code> - 设置额外输出 (outputs.xxx = value)
                      </li>
                      <li>
                        <code>console.log()</code> - 记录日志
                      </li>
                      <li>
                        <code>utils</code> - 工具函数 (parseJSON, stringify, delay, get, set...)
                      </li>
                      <li>
                        <code>fetch</code> - HTTP 请求 (异步模式)
                      </li>
                    </ul>
                    <p style={{ marginTop: 8 }}>
                      使用 <code>return</code> 返回主输出值
                    </p>
                  </div>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 12 }}>
                <Form.Item name="executionMode" label="执行模式">
                  <Select options={EXECUTION_MODES} />
                </Form.Item>
                <Form.Item name="timeout" label="超时时间 (秒)">
                  <InputNumber min={1} max={300} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="errorHandling" label="错误处理">
                  <Select options={ERROR_HANDLING_OPTIONS} />
                </Form.Item>
              </div>
              <Form.Item name="code" label="代码" rules={[{ required: true }]}>
                <TextArea
                  rows={15}
                  placeholder="// 在这里编写节点代码"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </Form.Item>
            </Panel>
          </Collapse>
        </Form>
      </Modal>
    </>
  )
})

export default CustomNodeBuilder
