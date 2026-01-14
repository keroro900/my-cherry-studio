/**
 * CharacterCardEditor - 角色卡编辑器
 *
 * 提供角色卡的在线编辑功能，支持编辑所有字段
 * 包含基本信息、角色数据、系统设置、标签管理等
 */

import { SaveOutlined } from '@ant-design/icons'
import { Avatar, Button, Drawer, Form, Input, message, Space, Spin, Tabs, Tag, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { CharacterCard, WorldBook } from './types'
import WorldBookEditor from './WorldBookEditor'

const { TextArea } = Input
const { Text, Title } = Typography

interface Props {
  /** 要编辑的角色卡 */
  card: CharacterCard | null
  /** 是否可见 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 保存回调 */
  onSave: (id: string, updates: Partial<CharacterCard>) => Promise<CharacterCard | null>
}

/**
 * 角色卡编辑器组件
 */
const CharacterCardEditor: FC<Props> = ({ card, visible, onClose, onSave }) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [worldBook, setWorldBook] = useState<WorldBook | undefined>(undefined)

  // 当卡片变化时重置表单
  useEffect(() => {
    if (card && visible) {
      form.setFieldsValue({
        name: card.name,
        description: card.data.description,
        personality: card.data.personality,
        scenario: card.data.scenario,
        first_mes: card.data.first_mes,
        mes_example: card.data.mes_example,
        system_prompt: card.data.system_prompt,
        post_history_instructions: card.data.post_history_instructions,
        tags: card.data.tags || [],
        customTags: card.customTags || [],
        creator: card.data.creator || '',
        creator_notes: card.data.creator_notes || ''
      })
      setWorldBook(card.data.character_book)
      setHasChanges(false)
    }
  }, [card, visible, form])

  // 处理表单值变化
  const handleValuesChange = useCallback(() => {
    setHasChanges(true)
  }, [])

  // 处理世界书变化
  const handleWorldBookChange = useCallback((newWorldBook: WorldBook) => {
    setWorldBook(newWorldBook)
    setHasChanges(true)
  }, [])

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!card) return

    try {
      await form.validateFields()
      const values = form.getFieldsValue()

      setSaving(true)

      const updates: Partial<CharacterCard> = {
        name: values.name,
        data: {
          ...card.data,
          name: values.name,
          description: values.description,
          personality: values.personality,
          scenario: values.scenario,
          first_mes: values.first_mes,
          mes_example: values.mes_example,
          system_prompt: values.system_prompt,
          post_history_instructions: values.post_history_instructions,
          tags: values.tags,
          creator: values.creator,
          creator_notes: values.creator_notes,
          character_book: worldBook
        },
        customTags: values.customTags
      }

      const result = await onSave(card.id, updates)
      if (result) {
        message.success(t('vcp.tavern.editor.saveSuccess', '保存成功'))
        setHasChanges(false)
        onClose()
      }
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }, [card, form, onSave, onClose, t, worldBook])

  // 处理关闭
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm(t('vcp.tavern.editor.unsavedChanges', '有未保存的更改，确定要关闭吗？'))) {
        onClose()
      }
    } else {
      onClose()
    }
  }, [hasChanges, onClose, t])

  // 添加标签
  const handleAddTag = useCallback(
    (field: 'tags' | 'customTags') => {
      if (!newTag.trim()) return

      const currentTags = form.getFieldValue(field) || []
      if (!currentTags.includes(newTag.trim())) {
        form.setFieldsValue({
          [field]: [...currentTags, newTag.trim()]
        })
        setHasChanges(true)
      }
      setNewTag('')
    },
    [newTag, form]
  )

  // 删除标签
  const handleRemoveTag = useCallback(
    (field: 'tags' | 'customTags', tagToRemove: string) => {
      const currentTags = form.getFieldValue(field) || []
      form.setFieldsValue({
        [field]: currentTags.filter((tag: string) => tag !== tagToRemove)
      })
      setHasChanges(true)
    },
    [form]
  )

  // 渲染标签输入区
  const renderTagsInput = (field: 'tags' | 'customTags', label: string) => {
    const tags: string[] = form.getFieldValue(field) || []

    return (
      <TagSection>
        <Text type="secondary">{label}</Text>
        <TagsContainer>
          {tags.map((tag) => (
            <Tag key={tag} closable onClose={() => handleRemoveTag(field, tag)}>
              {tag}
            </Tag>
          ))}
          <Input
            size="small"
            placeholder={t('vcp.tavern.editor.addTag', '添加标签...')}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onPressEnter={() => handleAddTag(field)}
            style={{ width: 120 }}
          />
        </TagsContainer>
      </TagSection>
    )
  }

  if (!card) return null

  const tabItems = [
    {
      key: 'basic',
      label: t('vcp.tavern.editor.tabs.basic', '基本信息'),
      children: (
        <TabContent>
          <Form.Item
            name="name"
            label={t('vcp.tavern.editor.name', '角色名称')}
            rules={[{ required: true, message: t('vcp.tavern.editor.nameRequired', '请输入角色名称') }]}>
            <Input placeholder={t('vcp.tavern.editor.namePlaceholder', '角色的名称')} />
          </Form.Item>

          <Form.Item name="creator" label={t('vcp.tavern.editor.creator', '创作者')}>
            <Input placeholder={t('vcp.tavern.editor.creatorPlaceholder', '角色卡的创作者')} />
          </Form.Item>

          <Form.Item name="description" label={t('vcp.tavern.editor.description', '角色描述')}>
            <TextArea
              rows={4}
              placeholder={t('vcp.tavern.editor.descriptionPlaceholder', '描述角色的外貌、背景等信息...')}
            />
          </Form.Item>

          <Form.Item name="personality" label={t('vcp.tavern.editor.personality', '性格特征')}>
            <TextArea
              rows={4}
              placeholder={t('vcp.tavern.editor.personalityPlaceholder', '描述角色的性格特点、行为方式...')}
            />
          </Form.Item>

          <Form.Item name="creator_notes" label={t('vcp.tavern.editor.creatorNotes', '创作者备注')}>
            <TextArea
              rows={3}
              placeholder={t('vcp.tavern.editor.creatorNotesPlaceholder', '给使用者的提示和建议...')}
            />
          </Form.Item>
        </TabContent>
      )
    },
    {
      key: 'scenario',
      label: t('vcp.tavern.editor.tabs.scenario', '场景设定'),
      children: (
        <TabContent>
          <Form.Item name="scenario" label={t('vcp.tavern.editor.scenario', '场景背景')}>
            <TextArea
              rows={4}
              placeholder={t('vcp.tavern.editor.scenarioPlaceholder', '描述对话发生的场景和背景...')}
            />
          </Form.Item>

          <Form.Item name="first_mes" label={t('vcp.tavern.editor.firstMessage', '开场白')}>
            <TextArea
              rows={6}
              placeholder={t('vcp.tavern.editor.firstMessagePlaceholder', '角色的第一条消息/问候语...')}
            />
          </Form.Item>

          <Form.Item name="mes_example" label={t('vcp.tavern.editor.messageExamples', '对话示例')}>
            <TextArea
              rows={8}
              placeholder={t(
                'vcp.tavern.editor.messageExamplesPlaceholder',
                '提供对话示例帮助 AI 理解角色的说话风格...\n格式：<START>\n{{user}}: 用户消息\n{{char}}: 角色回复'
              )}
            />
          </Form.Item>
        </TabContent>
      )
    },
    {
      key: 'system',
      label: t('vcp.tavern.editor.tabs.system', '系统设置'),
      children: (
        <TabContent>
          <Form.Item name="system_prompt" label={t('vcp.tavern.editor.systemPrompt', '系统提示词')}>
            <TextArea
              rows={6}
              placeholder={t('vcp.tavern.editor.systemPromptPlaceholder', '系统级的角色扮演指令...')}
            />
          </Form.Item>

          <Form.Item
            name="post_history_instructions"
            label={t('vcp.tavern.editor.postHistoryInstructions', '历史后指令')}>
            <TextArea
              rows={4}
              placeholder={t(
                'vcp.tavern.editor.postHistoryInstructionsPlaceholder',
                '在对话历史之后添加的额外指令（可选）...'
              )}
            />
          </Form.Item>

          <InfoCard>
            <Text type="secondary">
              {t(
                'vcp.tavern.editor.systemInfo',
                '系统提示词会在对话开始时发送给 AI，历史后指令会在对话历史之后追加。这些设置会影响 AI 如何理解和扮演角色。'
              )}
            </Text>
          </InfoCard>
        </TabContent>
      )
    },
    {
      key: 'tags',
      label: t('vcp.tavern.editor.tabs.tags', '标签管理'),
      children: (
        <TabContent>
          <Form.Item name="tags" noStyle>
            <input type="hidden" />
          </Form.Item>
          {renderTagsInput('tags', t('vcp.tavern.editor.originalTags', '原始标签'))}

          <Form.Item name="customTags" noStyle>
            <input type="hidden" />
          </Form.Item>
          {renderTagsInput('customTags', t('vcp.tavern.editor.customTags', '自定义标签'))}

          <InfoCard style={{ marginTop: 16 }}>
            <Text type="secondary">
              {t('vcp.tavern.editor.tagsInfo', '原始标签来自角色卡创作者，自定义标签由您添加用于个人分类管理。')}
            </Text>
          </InfoCard>
        </TabContent>
      )
    },
    {
      key: 'worldbook',
      label: t('vcp.tavern.editor.tabs.worldbook', '世界书'),
      children: (
        <TabContent>
          <WorldBookEditor worldBook={worldBook} onChange={handleWorldBookChange} />
        </TabContent>
      )
    }
  ]

  return (
    <Drawer
      title={
        <DrawerHeader>
          {card.avatar ? (
            <Avatar src={`file://${card.avatar}`} size={40} />
          ) : (
            <Avatar size={40} style={{ backgroundColor: 'var(--color-primary)' }}>
              {card.name.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <HeaderInfo>
            <Title level={5} style={{ margin: 0 }}>
              {t('vcp.tavern.editor.title', '编辑角色卡')}
            </Title>
            <Text type="secondary">{card.name}</Text>
          </HeaderInfo>
        </DrawerHeader>
      }
      open={visible}
      onClose={handleClose}
      width={720}
      extra={
        <Space>
          <Button onClick={handleClose}>{t('common.cancel', '取消')}</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!hasChanges}>
            {t('common.save', '保存')}
          </Button>
        </Space>
      }
      destroyOnClose>
      <Spin spinning={saving}>
        <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
          <Tabs items={tabItems} />
        </Form>
      </Spin>
    </Drawer>
  )
}

// ==================== 样式组件 ====================

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
`

const TabContent = styled.div`
  padding: 16px 0;
`

const TagSection = styled.div`
  margin-bottom: 16px;
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  min-height: 48px;

  .ant-tag {
    margin: 0;
  }
`

const InfoCard = styled.div`
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border-left: 3px solid var(--color-primary);
`

export default CharacterCardEditor
