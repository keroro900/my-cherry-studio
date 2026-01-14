/**
 * WorldBookEditor - 世界书编辑器
 *
 * 提供世界书条目的编辑功能
 * 支持添加、编辑、删除条目，以及条目属性配置
 */

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { WorldBook, WorldBookEntry } from './types'

const { TextArea } = Input
const { Text, Title } = Typography

interface Props {
  /** 世界书数据 */
  worldBook?: WorldBook
  /** 是否只读 */
  readonly?: boolean
  /** 变更回调 */
  onChange?: (worldBook: WorldBook) => void
}

/**
 * 创建默认条目
 */
function createDefaultEntry(id: number): WorldBookEntry {
  return {
    id,
    keys: [],
    secondary_keys: [],
    content: '',
    enabled: true,
    position: 'before_char',
    depth: 4,
    priority: 10,
    constant: false,
    case_sensitive: false,
    comment: ''
  }
}

/**
 * 世界书编辑器组件
 */
const WorldBookEditor: FC<Props> = ({ worldBook, readonly = false, onChange }) => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<WorldBookEntry[]>([])
  const [editingEntry, setEditingEntry] = useState<WorldBookEntry | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 初始化条目列表
  useEffect(() => {
    if (worldBook?.entries) {
      setEntries(worldBook.entries)
    } else {
      setEntries([])
    }
  }, [worldBook])

  // 通知变更
  const notifyChange = useCallback(
    (newEntries: WorldBookEntry[]) => {
      if (onChange) {
        onChange({
          ...worldBook,
          entries: newEntries
        } as WorldBook)
      }
    },
    [worldBook, onChange]
  )

  // 添加条目
  const handleAddEntry = useCallback(() => {
    const maxId = entries.reduce((max, e) => Math.max(max, e.id || 0), 0)
    const newEntry = createDefaultEntry(maxId + 1)
    setEditingEntry(newEntry)
    form.setFieldsValue({
      ...newEntry,
      keys: newEntry.keys.join(', '),
      secondary_keys: newEntry.secondary_keys.join(', ')
    })
    setEditModalVisible(true)
  }, [entries, form])

  // 编辑条目
  const handleEditEntry = useCallback(
    (entry: WorldBookEntry) => {
      setEditingEntry(entry)
      form.setFieldsValue({
        ...entry,
        keys: entry.keys.join(', '),
        secondary_keys: entry.secondary_keys.join(', ')
      })
      setEditModalVisible(true)
    },
    [form]
  )

  // 删除条目
  const handleDeleteEntry = useCallback(
    (entry: WorldBookEntry) => {
      const newEntries = entries.filter((e) => e.id !== entry.id)
      setEntries(newEntries)
      notifyChange(newEntries)
    },
    [entries, notifyChange]
  )

  // 保存条目
  const handleSaveEntry = useCallback(async () => {
    try {
      const values = await form.validateFields()

      const updatedEntry: WorldBookEntry = {
        ...editingEntry!,
        keys: values.keys
          .split(/[,，]/)
          .map((k: string) => k.trim())
          .filter(Boolean),
        secondary_keys: values.secondary_keys
          ? values.secondary_keys
              .split(/[,，]/)
              .map((k: string) => k.trim())
              .filter(Boolean)
          : [],
        content: values.content,
        enabled: values.enabled,
        position: values.position,
        depth: values.depth,
        priority: values.priority,
        constant: values.constant,
        case_sensitive: values.case_sensitive,
        comment: values.comment
      }

      const existingIndex = entries.findIndex((e) => e.id === updatedEntry.id)
      let newEntries: WorldBookEntry[]

      if (existingIndex >= 0) {
        newEntries = [...entries]
        newEntries[existingIndex] = updatedEntry
      } else {
        newEntries = [...entries, updatedEntry]
      }

      setEntries(newEntries)
      notifyChange(newEntries)
      setEditModalVisible(false)
      setEditingEntry(null)
    } catch {
      // 表单验证失败
    }
  }, [editingEntry, entries, form, notifyChange])

  // 切换条目启用状态
  const handleToggleEnabled = useCallback(
    (entry: WorldBookEntry) => {
      const newEntries = entries.map((e) => (e.id === entry.id ? { ...e, enabled: !e.enabled } : e))
      setEntries(newEntries)
      notifyChange(newEntries)
    },
    [entries, notifyChange]
  )

  // 渲染条目卡片
  const renderEntryCard = (entry: WorldBookEntry, index: number) => {
    return (
      <EntryCard key={entry.id || index} $enabled={entry.enabled}>
        <EntryHeader>
          <EntryInfo>
            <Switch
              size="small"
              checked={entry.enabled}
              onChange={() => handleToggleEnabled(entry)}
              disabled={readonly}
            />
            <EntryTitle>
              {entry.comment || t('vcp.tavern.worldbook.entry', '条目')} #{entry.id || index + 1}
            </EntryTitle>
            {entry.constant && (
              <Tag color="purple" style={{ marginLeft: 8 }}>
                {t('vcp.tavern.worldbook.constant', '常驻')}
              </Tag>
            )}
            <PositionTag position={entry.position}>
              {entry.position === 'before_char'
                ? t('vcp.tavern.worldbook.beforeChar', '角色前')
                : entry.position === 'after_char'
                  ? t('vcp.tavern.worldbook.afterChar', '角色后')
                  : t('vcp.tavern.worldbook.depth', '深度') + `: ${entry.depth}`}
            </PositionTag>
          </EntryInfo>
          {!readonly && (
            <Space>
              <Tooltip title={t('vcp.tavern.worldbook.edit', '编辑')}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditEntry(entry)} />
              </Tooltip>
              <Popconfirm
                title={t('vcp.tavern.worldbook.confirmDelete', '确定删除此条目？')}
                onConfirm={() => handleDeleteEntry(entry)}
                okText={t('common.confirm', '确定')}
                cancelText={t('common.cancel', '取消')}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )}
        </EntryHeader>
        <EntryBody>
          <KeywordsRow>
            <Text type="secondary">{t('vcp.tavern.worldbook.keys', '关键词')}:</Text>
            {entry.keys.length > 0 ? (
              entry.keys.map((key, i) => (
                <Tag key={i} color="blue">
                  {key}
                </Tag>
              ))
            ) : (
              <Text type="secondary" italic>
                {t('vcp.tavern.worldbook.noKeys', '无关键词')}
              </Text>
            )}
          </KeywordsRow>
          {entry.secondary_keys && entry.secondary_keys.length > 0 && (
            <KeywordsRow>
              <Text type="secondary">{t('vcp.tavern.worldbook.secondaryKeys', '次要关键词')}:</Text>
              {entry.secondary_keys.map((key, i) => (
                <Tag key={i} color="green">
                  {key}
                </Tag>
              ))}
            </KeywordsRow>
          )}
          <ContentPreview>{entry.content.slice(0, 200) + (entry.content.length > 200 ? '...' : '')}</ContentPreview>
        </EntryBody>
      </EntryCard>
    )
  }

  return (
    <Container>
      <Header>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {t('vcp.tavern.worldbook.title', '世界书')}
          </Title>
          <Text type="secondary">
            {t('vcp.tavern.worldbook.count', '共 {{count}} 个条目', { count: entries.length })}
          </Text>
        </div>
        {!readonly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEntry}>
            {t('vcp.tavern.worldbook.addEntry', '添加条目')}
          </Button>
        )}
      </Header>

      <EntryList>
        {entries.length === 0 ? (
          <Empty description={t('vcp.tavern.worldbook.empty', '暂无世界书条目')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
            {!readonly && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEntry}>
                {t('vcp.tavern.worldbook.addFirst', '添加第一个条目')}
              </Button>
            )}
          </Empty>
        ) : (
          entries.map((entry, index) => renderEntryCard(entry, index))
        )}
      </EntryList>

      {/* 编辑弹窗 */}
      <Modal
        title={
          editingEntry?.id && entries.some((e) => e.id === editingEntry.id)
            ? t('vcp.tavern.worldbook.editEntry', '编辑条目')
            : t('vcp.tavern.worldbook.addEntry', '添加条目')
        }
        open={editModalVisible}
        onOk={handleSaveEntry}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingEntry(null)
        }}
        width={640}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}>
        <Form form={form} layout="vertical">
          <Form.Item name="comment" label={t('vcp.tavern.worldbook.comment', '备注/名称')}>
            <Input placeholder={t('vcp.tavern.worldbook.commentPlaceholder', '条目的备注或名称...')} />
          </Form.Item>

          <Form.Item
            name="keys"
            label={t('vcp.tavern.worldbook.keys', '关键词')}
            rules={[{ required: true, message: t('vcp.tavern.worldbook.keysRequired', '请输入至少一个关键词') }]}
            extra={t('vcp.tavern.worldbook.keysHint', '多个关键词用逗号分隔，任意一个匹配即触发')}>
            <Input placeholder={t('vcp.tavern.worldbook.keysPlaceholder', '魔法, 咒语, 法术...')} />
          </Form.Item>

          <Form.Item
            name="secondary_keys"
            label={t('vcp.tavern.worldbook.secondaryKeys', '次要关键词')}
            extra={t('vcp.tavern.worldbook.secondaryKeysHint', '可选，需要同时满足主关键词和次要关键词才触发')}>
            <Input placeholder={t('vcp.tavern.worldbook.secondaryKeysPlaceholder', '火焰, 冰霜...')} />
          </Form.Item>

          <Form.Item
            name="content"
            label={t('vcp.tavern.worldbook.content', '内容')}
            rules={[{ required: true, message: t('vcp.tavern.worldbook.contentRequired', '请输入条目内容') }]}>
            <TextArea
              rows={6}
              placeholder={t('vcp.tavern.worldbook.contentPlaceholder', '当关键词被触发时注入的内容...')}
            />
          </Form.Item>

          <SettingsRow>
            <Form.Item name="position" label={t('vcp.tavern.worldbook.position', '注入位置')} style={{ flex: 1 }}>
              <Select>
                <Select.Option value="before_char">{t('vcp.tavern.worldbook.beforeChar', '角色描述前')}</Select.Option>
                <Select.Option value="after_char">{t('vcp.tavern.worldbook.afterChar', '角色描述后')}</Select.Option>
                <Select.Option value="depth">{t('vcp.tavern.worldbook.depthMode', '按深度注入')}</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="depth" label={t('vcp.tavern.worldbook.depth', '深度')} style={{ width: 100 }}>
              <InputNumber min={0} max={100} />
            </Form.Item>

            <Form.Item name="priority" label={t('vcp.tavern.worldbook.priority', '优先级')} style={{ width: 100 }}>
              <InputNumber min={0} max={100} />
            </Form.Item>
          </SettingsRow>

          <CheckboxRow>
            <Form.Item name="enabled" valuePropName="checked" noStyle>
              <Checkbox>{t('vcp.tavern.worldbook.enabled', '启用')}</Checkbox>
            </Form.Item>
            <Form.Item name="constant" valuePropName="checked" noStyle>
              <Checkbox>{t('vcp.tavern.worldbook.constant', '常驻（始终注入）')}</Checkbox>
            </Form.Item>
            <Form.Item name="case_sensitive" valuePropName="checked" noStyle>
              <Checkbox>{t('vcp.tavern.worldbook.caseSensitive', '区分大小写')}</Checkbox>
            </Form.Item>
          </CheckboxRow>
        </Form>
      </Modal>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const EntryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const EntryCard = styled.div<{ $enabled?: boolean }>`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  opacity: ${(props) => (props.$enabled ? 1 : 0.6)};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const EntryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const EntryInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const EntryTitle = styled.span`
  font-weight: 500;
  color: var(--color-text);
`

const PositionTag = styled(Tag)<{ position: string }>`
  margin-left: 4px;
  font-size: 11px;
`

const EntryBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const KeywordsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  .ant-tag {
    margin: 0;
  }
`

const ContentPreview = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  padding: 8px 12px;
  background: var(--color-background);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
`

const SettingsRow = styled.div`
  display: flex;
  gap: 16px;
`

const CheckboxRow = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 8px;
`

export default WorldBookEditor
