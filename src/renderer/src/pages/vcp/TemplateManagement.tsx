/**
 * TemplateManagement - 模板管理组件
 *
 * 在 VCP Dashboard 中提供模板的统一管理
 *
 * 功能：
 * - 提示词模板 CRUD
 * - 模板分类管理
 * - 模板预览和测试
 * - 变量插值支持
 */

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import Scrollbar from '@renderer/components/Scrollbar'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text, Paragraph } = Typography

const logger = loggerService.withContext('TemplateManagement')

// 模板类型定义
interface PromptTemplate {
  id: string
  name: string
  content: string
  description?: string
  category?: string
  createdAt?: number
  updatedAt?: number
}

// 分类颜色
const CATEGORY_COLORS: Record<string, string> = {
  system: 'blue',
  agent: 'green',
  chat: 'orange',
  tool: 'purple',
  custom: 'default'
}

/**
 * 模板管理组件
 */
const TemplateManagement: FC = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // 状态
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(null)

  /**
   * 加载模板列表
   */
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.electron.ipcRenderer.invoke('vcp:template:list')
      setTemplates(data?.templates || [])
    } catch (error) {
      logger.error('Failed to load templates', error as Error)
      message.error(t('vcp.templates.load_failed', '加载模板失败'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  /**
   * 创建模板
   */
  const handleCreate = () => {
    setEditingTemplate(null)
    form.resetFields()
    form.setFieldsValue({ category: 'custom' })
    setIsModalOpen(true)
  }

  /**
   * 编辑模板
   */
  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template)
    form.setFieldsValue({
      name: template.name,
      content: template.content,
      description: template.description,
      category: template.category || 'custom'
    })
    setIsModalOpen(true)
  }

  /**
   * 预览模板
   */
  const handlePreview = (template: PromptTemplate) => {
    setPreviewTemplate(template)
    setIsPreviewOpen(true)
  }

  /**
   * 保存模板
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (editingTemplate) {
        await window.electron.ipcRenderer.invoke('vcp:template:update', {
          id: editingTemplate.id,
          ...values
        })
        message.success(t('vcp.templates.update_success', '模板更新成功'))
      } else {
        await window.electron.ipcRenderer.invoke('vcp:template:create', values)
        message.success(t('vcp.templates.create_success', '模板创建成功'))
      }

      setIsModalOpen(false)
      loadTemplates()
    } catch (error) {
      logger.error('Failed to save template', error as Error)
      message.error(t('vcp.templates.save_failed', '保存失败'))
    }
  }

  /**
   * 删除模板
   */
  const handleDelete = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:template:delete', id)
      message.success(t('vcp.templates.delete_success', '模板删除成功'))
      loadTemplates()
    } catch (error) {
      logger.error('Failed to delete template', error as Error)
      message.error(t('vcp.templates.delete_failed', '删除失败'))
    }
  }

  /**
   * 复制模板内容
   */
  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content)
    message.success(t('common.copied', '已复制'))
  }

  // 过滤模板
  const filteredTemplates = templates.filter((t) => {
    if (searchText) {
      const search = searchText.toLowerCase()
      if (
        !t.name.toLowerCase().includes(search) &&
        !t.content.toLowerCase().includes(search) &&
        !(t.description || '').toLowerCase().includes(search)
      ) {
        return false
      }
    }
    if (categoryFilter !== 'all' && t.category !== categoryFilter) {
      return false
    }
    return true
  })

  // 提取模板中的变量
  const extractVariables = (content: string): string[] => {
    const pattern = /\{\{([^}]+)\}\}/g
    const matches = content.match(pattern) || []
    return [...new Set(matches)]
  }

  // 统计数据
  const categoryStats = templates.reduce(
    (acc, t) => {
      const cat = t.category || 'custom'
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // 模板表格列
  const columns = [
    {
      title: t('vcp.templates.name', '模板名'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: PromptTemplate) => (
        <Space>
          <FileTextOutlined style={{ color: 'var(--color-primary)' }} />
          <Text strong>{text}</Text>
          {extractVariables(record.content).length > 0 && (
            <Tag color="blue" style={{ fontSize: 10 }}>
              {extractVariables(record.content).length} 变量
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: t('vcp.templates.category', '分类'),
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => <Tag color={CATEGORY_COLORS[cat] || 'default'}>{cat || 'custom'}</Tag>
    },
    {
      title: t('vcp.templates.content', '内容预览'),
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => (
        <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 300 }}>
          {text}
        </Text>
      )
    },
    {
      title: t('vcp.templates.description', '描述'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 150
    },
    {
      title: t('common.actions', '操作'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: PromptTemplate) => (
        <Space>
          <Tooltip title={t('vcp.templates.preview', '预览')}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} />
          </Tooltip>
          <Tooltip title={t('common.copy', '复制')}>
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyContent(record.content)} />
          </Tooltip>
          <Tooltip title={t('common.edit', '编辑')}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title={t('vcp.templates.delete_confirm', '确定删除此模板？')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm', '确定')}
            cancelText={t('common.cancel', '取消')}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {t('vcp.dashboard.templates.title', '模板管理')}
        </Title>
        <Text type="secondary">
          {t('vcp.dashboard.templates.description', '管理 VCP 提示词模板，支持变量插值和模板渲染。')}
        </Text>
      </Header>

      <Content>
        {/* 模板说明 */}
        <Alert
          type="info"
          showIcon
          message={t('vcp.templates.usage_title', '模板使用说明')}
          description={
            <div>
              <Paragraph style={{ margin: 0 }}>
                模板中可以使用 <code>{`{{变量名}}`}</code> 语法引用变量，在渲染时会自动替换为对应的值。
              </Paragraph>
              <Paragraph style={{ margin: '8px 0 0 0' }}>
                常用变量：<code>{`{{Date}}`}</code> <code>{`{{Time}}`}</code> <code>{`{{UserName}}`}</code> 等
              </Paragraph>
            </div>
          }
          style={{ marginBottom: 16 }}
        />

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.templates.total', '模板总数')}
                value={templates.length}
                prefix={<FileTextOutlined />}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.templates.category_system', '系统模板')}
                value={categoryStats.system || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.templates.category_agent', 'Agent 模板')}
                value={categoryStats.agent || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </StatCard>
          </Col>
          <Col span={6}>
            <StatCard>
              <Statistic
                title={t('vcp.templates.category_custom', '自定义模板')}
                value={categoryStats.custom || 0}
                valueStyle={{ color: '#722ed1' }}
              />
            </StatCard>
          </Col>
        </Row>

        {/* 模板列表 */}
        <SectionCard
          title={
            <Space>
              <span>{t('vcp.templates.list', '模板列表')}</span>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading} />
            </Space>
          }
          extra={
            <Space>
              <Input
                placeholder={t('vcp.templates.search', '搜索模板...')}
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
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'system', label: '系统' },
                  { value: 'agent', label: 'Agent' },
                  { value: 'chat', label: '对话' },
                  { value: 'tool', label: '工具' },
                  { value: 'custom', label: '自定义' }
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                {t('vcp.templates.create', '新建模板')}
              </Button>
            </Space>
          }>
          {filteredTemplates.length === 0 ? (
            <Empty
              description={
                searchText ? t('vcp.templates.no_results', '未找到匹配的模板') : t('vcp.templates.empty', '暂无模板')
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={handleCreate}>
                {t('vcp.templates.create_first', '创建第一个模板')}
              </Button>
            </Empty>
          ) : (
            <Table
              dataSource={filteredTemplates}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              loading={loading}
            />
          )}
        </SectionCard>
      </Content>

      {/* 模板编辑弹窗 */}
      <Modal
        title={editingTemplate ? t('vcp.templates.edit', '编辑模板') : t('vcp.templates.create', '新建模板')}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={700}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label={t('vcp.templates.name', '模板名')}
                rules={[{ required: true, message: t('vcp.templates.name_required', '请输入模板名') }]}>
                <Input placeholder="例如: 代码审查模板、翻译助手模板" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label={t('vcp.templates.category', '分类')}>
                <Select
                  options={[
                    { value: 'system', label: '系统' },
                    { value: 'agent', label: 'Agent' },
                    { value: 'chat', label: '对话' },
                    { value: 'tool', label: '工具' },
                    { value: 'custom', label: '自定义' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="content"
            label={
              <Space>
                {t('vcp.templates.content', '模板内容')}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  使用 {`{{变量名}}`} 语法插入变量
                </Text>
              </Space>
            }
            rules={[{ required: true, message: t('vcp.templates.content_required', '请输入模板内容') }]}>
            <Input.TextArea
              rows={10}
              placeholder={`例如:\n你是一个专业的 {{Role}}，擅长 {{Expertise}}。\n当前日期: {{Date}}\n\n请帮我完成以下任务...`}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item name="description" label={t('vcp.templates.description', '描述')}>
            <Input.TextArea rows={2} placeholder="模板的用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模板预览弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            {t('vcp.templates.preview', '模板预览')}
            {previewTemplate && <Text type="secondary">- {previewTemplate.name}</Text>}
          </Space>
        }
        open={isPreviewOpen}
        onCancel={() => setIsPreviewOpen(false)}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => previewTemplate && copyContent(previewTemplate.content)}>
            {t('common.copy', '复制')}
          </Button>,
          <Button key="close" onClick={() => setIsPreviewOpen(false)}>
            {t('common.close', '关闭')}
          </Button>
        ]}
        width={700}>
        {previewTemplate && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text type="secondary">{t('vcp.templates.category', '分类')}:</Text>{' '}
                <Tag color={CATEGORY_COLORS[previewTemplate.category || 'custom']}>
                  {previewTemplate.category || 'custom'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text type="secondary">{t('vcp.templates.variables', '变量')}:</Text>{' '}
                {extractVariables(previewTemplate.content).map((v) => (
                  <Tag key={v} color="blue" style={{ margin: 2 }}>
                    {v}
                  </Tag>
                ))}
                {extractVariables(previewTemplate.content).length === 0 && <Text type="secondary">无</Text>}
              </Col>
            </Row>
            {previewTemplate.description && (
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {previewTemplate.description}
              </Paragraph>
            )}
            <PreviewContent>{previewTemplate.content}</PreviewContent>
          </div>
        )}
      </Modal>
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

const PreviewContent = styled.pre`
  background: var(--color-background-soft);
  padding: 16px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
`

export default TemplateManagement
