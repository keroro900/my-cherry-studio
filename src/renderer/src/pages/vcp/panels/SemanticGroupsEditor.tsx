/**
 * Semantic Groups Editor - 语义组编辑器
 *
 * 功能:
 * - 语义组 CRUD 操作
 * - 关键词管理
 * - 组统计信息
 * - 缓存预热
 *
 * 使用 window.api.semanticGroup.* API
 *
 * @created Phase 6 - 添加缺失的 AdminPanel 功能
 */

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  TagsOutlined,
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
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('SemanticGroupsEditor')

const { Text, Title } = Typography
const { TextArea } = Input

// ==================== 类型定义 ====================

interface SemanticGroup {
  id: string
  name: string
  description?: string
  keywords: string[]
  priority?: number
  color?: string
}

interface SemanticGroupStats {
  totalGroups: number
  cachedVectors: number
  cacheHitRate: number
  lastCacheUpdate?: string
}

interface EditingGroup extends Partial<SemanticGroup> {
  keywordsText?: string
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const StatsRow = styled.div`
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  flex-wrap: wrap;
`

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`

const KeywordTag = styled(Tag)`
  margin: 2px;
`

const GroupCard = styled(Card)`
  margin-bottom: 12px;

  .ant-card-head {
    min-height: 40px;
    padding: 0 12px;
  }

  .ant-card-body {
    padding: 12px;
  }
`

const KeywordsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 100px;
  overflow-y: auto;
`

// ==================== 主组件 ====================

const SemanticGroupsEditor: FC = () => {
  const { t } = useTranslation()

  // 状态
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<SemanticGroup[]>([])
  const [stats, setStats] = useState<SemanticGroupStats | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState<EditingGroup | null>(null)
  const [form] = Form.useForm()

  // 加载语义组列表
  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.semanticGroup.listGroups()
      if (result.success && result.groups) {
        setGroups(result.groups)
        logger.info('Loaded semantic groups', { count: result.groups.length })
      } else {
        logger.warn('Failed to load semantic groups', { error: result.error })
      }
    } catch (error) {
      logger.error('Error loading semantic groups', { error })
      message.error('加载语义组失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载统计信息
  const loadStats = useCallback(async () => {
    try {
      const result = await window.api.semanticGroup.getStats()
      if (result.success && result.stats) {
        setStats(result.stats)
      }
    } catch (error) {
      logger.error('Error loading stats', { error })
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadGroups()
    loadStats()
  }, [loadGroups, loadStats])

  // 预热缓存
  const handleWarmCache = useCallback(async () => {
    try {
      message.loading({ content: '正在预热缓存...', key: 'warmCache' })
      const result = await window.api.semanticGroup.warmCache()
      if (result.success) {
        message.success({ content: `缓存预热完成，已缓存 ${result.cachedCount} 个向量`, key: 'warmCache' })
        loadStats()
      } else {
        message.error({ content: result.error || '缓存预热失败', key: 'warmCache' })
      }
    } catch (error) {
      logger.error('Error warming cache', { error })
      message.error({ content: '缓存预热失败', key: 'warmCache' })
    }
  }, [loadStats])

  // 清除缓存
  const handleClearCache = useCallback(async () => {
    try {
      const result = await window.api.semanticGroup.clearCache()
      if (result.success) {
        message.success('缓存已清除')
        loadStats()
      } else {
        message.error(result.error || '清除缓存失败')
      }
    } catch (error) {
      logger.error('Error clearing cache', { error })
      message.error('清除缓存失败')
    }
  }, [loadStats])

  // 打开新建对话框
  const handleAdd = useCallback(() => {
    setEditingGroup({
      id: `group-${Date.now()}`,
      name: '',
      description: '',
      keywords: [],
      keywordsText: '',
      priority: 1,
      color: '#1890ff'
    })
    form.resetFields()
    setEditModalVisible(true)
  }, [form])

  // 打开编辑对话框
  const handleEdit = useCallback(
    (group: SemanticGroup) => {
      setEditingGroup({
        ...group,
        keywordsText: group.keywords.join('\n')
      })
      form.setFieldsValue({
        name: group.name,
        description: group.description,
        keywordsText: group.keywords.join('\n'),
        priority: group.priority || 1,
        color: group.color || '#1890ff'
      })
      setEditModalVisible(true)
    },
    [form]
  )

  // 保存语义组
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const keywords = (values.keywordsText || '')
        .split('\n')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)

      if (keywords.length === 0) {
        message.warning('请至少添加一个关键词')
        return
      }

      const groupData = {
        id: editingGroup?.id || `group-${Date.now()}`,
        name: values.name,
        description: values.description,
        keywords,
        priority: values.priority || 1,
        color: values.color || '#1890ff'
      }

      const result = await window.api.semanticGroup.addGroup(groupData)
      if (result.success) {
        message.success('语义组保存成功')
        setEditModalVisible(false)
        loadGroups()
        loadStats()
      } else {
        message.error(result.error || '保存失败')
      }
    } catch (error) {
      logger.error('Error saving group', { error })
      message.error('保存失败')
    }
  }, [form, editingGroup, loadGroups, loadStats])

  // 删除语义组
  const handleDelete = useCallback(
    async (groupId: string) => {
      try {
        const result = await window.api.semanticGroup.removeGroup({ groupId })
        if (result.success) {
          message.success('语义组已删除')
          loadGroups()
          loadStats()
        } else {
          message.error(result.error || '删除失败')
        }
      } catch (error) {
        logger.error('Error deleting group', { error })
        message.error('删除失败')
      }
    },
    [loadGroups, loadStats]
  )

  // 表格列定义
  const columns: ColumnsType<SemanticGroup> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record: SemanticGroup) => (
        <Space>
          {record.color && <Badge color={record.color} />}
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (desc: string) => <Text type="secondary">{desc || '-'}</Text>
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (keywords: string[]) => (
        <KeywordsContainer>
          {keywords.slice(0, 10).map((kw, idx) => (
            <KeywordTag key={idx} color="blue">
              {kw}
            </KeywordTag>
          ))}
          {keywords.length > 10 && <KeywordTag>+{keywords.length - 10}</KeywordTag>}
        </KeywordsContainer>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center',
      render: (priority: number) => <Badge count={priority || 1} style={{ backgroundColor: '#52c41a' }} />
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: SemanticGroup) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确定删除此语义组？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}>
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <PanelContainer>
      {/* 头部 */}
      <HeaderBar>
        <Space>
          <TagsOutlined style={{ fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            语义组编辑器
          </Title>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>
            新建语义组
          </Button>
          <Tooltip title="刷新">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadGroups()
                loadStats()
              }}
            />
          </Tooltip>
        </Space>
      </HeaderBar>

      {/* 统计信息 */}
      <StatsRow>
        <Statistic title="语义组数量" value={stats?.totalGroups || groups.length} prefix={<TagsOutlined />} />
        <Statistic title="已缓存向量" value={stats?.cachedVectors || 0} prefix={<ThunderboltOutlined />} />
        <Statistic
          title="缓存命中率"
          value={stats?.cacheHitRate ? `${(stats.cacheHitRate * 100).toFixed(1)}%` : '-'}
        />
        <Space>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={handleWarmCache}>
            预热缓存
          </Button>
          <Popconfirm title="确定清除所有缓存？" onConfirm={handleClearCache} okText="确定" cancelText="取消">
            <Button size="small" danger>
              清除缓存
            </Button>
          </Popconfirm>
        </Space>
      </StatsRow>

      {/* 内容区域 */}
      <ContentArea>
        <Spin spinning={loading}>
          {groups.length === 0 ? (
            <Empty description="暂无语义组" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                创建第一个语义组
              </Button>
            </Empty>
          ) : (
            <Table
              columns={columns}
              dataSource={groups}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ y: 'calc(100vh - 350px)' }}
            />
          )}
        </Spin>
      </ContentArea>

      {/* 编辑对话框 */}
      <Modal
        title={editingGroup?.name ? `编辑语义组: ${editingGroup.name}` : '新建语义组'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ priority: 1, color: '#1890ff' }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入语义组名称' }]}>
                <Input placeholder="例如: color_warm, pattern_floral" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input placeholder="语义组的描述信息" />
          </Form.Item>

          <Form.Item
            name="keywordsText"
            label="关键词 (每行一个)"
            rules={[{ required: true, message: '请输入关键词' }]}
            extra="每行输入一个关键词，支持中英文">
            <TextArea
              rows={8}
              placeholder={`红色
橙色
黄色
coral
burgundy`}
            />
          </Form.Item>

          <Form.Item name="color" label="标识颜色">
            <Input type="color" style={{ width: 80, height: 32 }} />
          </Form.Item>
        </Form>
      </Modal>
    </PanelContainer>
  )
}

export default SemanticGroupsEditor
