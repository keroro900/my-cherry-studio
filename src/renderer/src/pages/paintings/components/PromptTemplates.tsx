/**
 * 提示词模板选择组件
 *
 * 功能：
 * - 按类别浏览模板
 * - 搜索模板
 * - 快速应用模板
 * - 组合多个模板
 * - 保存自定义模板
 */

import { DeleteOutlined, PlusOutlined, SearchOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Input, message, Modal, Popconfirm, Tabs, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import {
  BUILTIN_TEMPLATES,
  getTemplatesByCategory,
  PROMPT_CATEGORIES,
  type PromptCategory,
  type PromptTemplate
} from '../config/promptTemplates'

const logger = loggerService.withContext('PromptTemplates')

// ============================================================================
// 本地存储 Key
// ============================================================================

const CUSTOM_TEMPLATES_KEY = 'art-studio-custom-templates'
const FAVORITES_KEY = 'art-studio-template-favorites'

// ============================================================================
// 样式组件
// ============================================================================

const Container = styled.div`
  width: 360px;
  height: 450px;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-radius: 8px;
`

const Header = styled.div`
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 8px;
`

const SearchInput = styled(Input)`
  flex: 1;
`

const AddButton = styled(Button)`
  flex-shrink: 0;
`

const TabsWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .ant-tabs {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .ant-tabs-content-holder {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--color-scrollbar-thumb);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--color-scrollbar-thumb-hover);
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  .ant-tabs-nav {
    margin-bottom: 0;
    padding: 0 8px;
    flex-shrink: 0;
  }

  .ant-tabs-tab {
    padding: 8px 6px;
    font-size: 11px;
  }
`

const TemplateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
`

const TemplateCard = styled.div<{ $selected?: boolean }>`
  padding: 10px 12px;
  border-radius: 8px;
  background: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'var(--color-background-soft)')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-background-mute);
  }
`

const TemplateHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`

const TemplateName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const TemplateActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ActionIcon = styled.span`
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }

  &.favorite {
    color: var(--color-warning);
  }

  &.delete {
    color: var(--color-error);
  }
`

const TemplatePrompt = styled.div`
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
`

const TagsWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const StyledTag = styled(Tag)`
  font-size: 10px;
  padding: 0 4px;
  line-height: 16px;
  margin: 0;
`

const CustomTag = styled(Tag)`
  font-size: 10px;
  padding: 0 4px;
  line-height: 16px;
  margin: 0;
  background: var(--color-primary);
  color: white;
  border: none;
`

const EmptyState = styled.div`
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
  font-size: 12px;
`

const SelectedCount = styled.div`
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`

const ApplyButton = styled.span`
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ModalLabel = styled.div`
  font-size: 12px;
  color: var(--color-text);
  margin-bottom: 4px;
`

// ============================================================================
// Props 定义
// ============================================================================

export interface PromptTemplatesProps {
  /** 应用模板回调 */
  onApply: (prompt: string, negativePrompt?: string) => void
  /** 是否支持多选 */
  multiSelect?: boolean
  /** 当前语言 */
  locale?: 'zh' | 'en'
  /** 当前提示词（用于保存模板） */
  currentPrompt?: string
  /** 当前负面提示词 */
  currentNegativePrompt?: string
}

// ============================================================================
// 自定义模板类型
// ============================================================================

interface CustomTemplate extends PromptTemplate {
  isCustom: true
  createdAt: number
}

// ============================================================================
// 组件实现
// ============================================================================

export const PromptTemplates: FC<PromptTemplatesProps> = memo(function PromptTemplates({
  onApply,
  multiSelect = false,
  locale = 'zh',
  currentPrompt = '',
  currentNegativePrompt = ''
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('')
  const [newTemplateNegativePrompt, setNewTemplateNegativePrompt] = useState('')

  // 从本地存储加载自定义模板和收藏
  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
      if (savedTemplates) {
        setCustomTemplates(JSON.parse(savedTemplates))
      }
      const savedFavorites = localStorage.getItem(FAVORITES_KEY)
      if (savedFavorites) {
        setFavorites(new Set(JSON.parse(savedFavorites)))
      }
    } catch (e) {
      logger.error('Failed to load templates from localStorage:', e as Error)
    }
  }, [])

  // 保存自定义模板到本地存储
  const saveCustomTemplates = useCallback((templates: CustomTemplate[]) => {
    setCustomTemplates(templates)
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
  }, [])

  // 保存收藏到本地存储
  const saveFavorites = useCallback((favs: Set<string>) => {
    setFavorites(favs)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]))
  }, [])

  // 所有模板（内置 + 自定义）
  const allTemplates = useMemo(() => {
    return [...customTemplates, ...BUILTIN_TEMPLATES]
  }, [customTemplates])

  // 搜索模板
  const searchInTemplates = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase()
      return allTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.nameEn?.toLowerCase().includes(lowerQuery) ||
          t.prompt.toLowerCase().includes(lowerQuery) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      )
    },
    [allTemplates]
  )

  // 获取显示的模板列表
  const displayTemplates = useMemo(() => {
    if (searchQuery) {
      return searchInTemplates(searchQuery)
    }
    if (activeCategory === 'all') {
      return allTemplates
    }
    if (activeCategory === 'favorites') {
      return allTemplates.filter((t) => favorites.has(t.id))
    }
    if (activeCategory === 'custom') {
      return customTemplates
    }
    return getTemplatesByCategory(activeCategory as PromptCategory)
  }, [searchQuery, activeCategory, favorites, allTemplates, customTemplates, searchInTemplates])

  // 处理模板点击
  const handleTemplateClick = useCallback(
    (template: PromptTemplate) => {
      if (multiSelect) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(template.id)) {
            next.delete(template.id)
          } else {
            next.add(template.id)
          }
          return next
        })
      } else {
        // 单选模式，直接应用
        const prompt = locale === 'en' ? template.promptEn || template.prompt : template.prompt
        const negativePrompt =
          locale === 'en' ? template.negativePromptEn || template.negativePrompt : template.negativePrompt
        onApply(prompt, negativePrompt)
      }
    },
    [multiSelect, locale, onApply]
  )

  // 切换收藏
  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation()
      const next = new Set(favorites)
      if (next.has(templateId)) {
        next.delete(templateId)
      } else {
        next.add(templateId)
      }
      saveFavorites(next)
    },
    [favorites, saveFavorites]
  )

  // 删除自定义模板
  const handleDeleteTemplate = useCallback(
    (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation()
      const newTemplates = customTemplates.filter((t) => t.id !== templateId)
      saveCustomTemplates(newTemplates)
      message.success('模板已删除')
    },
    [customTemplates, saveCustomTemplates]
  )

  // 应用选中的模板
  const handleApplySelected = useCallback(() => {
    const selectedTemplates = allTemplates.filter((t) => selectedIds.has(t.id))
    const prompts = selectedTemplates.map((t) => (locale === 'en' ? t.promptEn || t.prompt : t.prompt))
    const negativePrompts = selectedTemplates
      .map((t) => (locale === 'en' ? t.negativePromptEn || t.negativePrompt : t.negativePrompt))
      .filter(Boolean)

    onApply(prompts.join(', '), negativePrompts.join(', ') || undefined)
    setSelectedIds(new Set())
  }, [selectedIds, locale, onApply, allTemplates])

  // 打开添加模板弹窗
  const handleOpenAddModal = useCallback(() => {
    setNewTemplateName('')
    setNewTemplatePrompt(currentPrompt)
    setNewTemplateNegativePrompt(currentNegativePrompt)
    setIsModalOpen(true)
  }, [currentPrompt, currentNegativePrompt])

  // 保存新模板
  const handleSaveTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      message.warning('请输入模板名称')
      return
    }
    if (!newTemplatePrompt.trim()) {
      message.warning('请输入提示词')
      return
    }

    const newTemplate: CustomTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      category: 'custom',
      prompt: newTemplatePrompt.trim(),
      negativePrompt: newTemplateNegativePrompt.trim() || undefined,
      tags: ['自定义'],
      isCustom: true,
      createdAt: Date.now()
    }

    saveCustomTemplates([newTemplate, ...customTemplates])
    setIsModalOpen(false)
    message.success('模板已保存')
  }, [newTemplateName, newTemplatePrompt, newTemplateNegativePrompt, customTemplates, saveCustomTemplates])

  // 构建 Tab 项
  const tabItems = useMemo(
    () => [
      { key: 'all', label: '全部' },
      { key: 'custom', label: '🎨 我的' },
      { key: 'favorites', label: '⭐ 收藏' },
      ...PROMPT_CATEGORIES.map((cat) => ({
        key: cat.id,
        label: `${cat.icon} ${locale === 'en' ? cat.nameEn : cat.name}`
      }))
    ],
    [locale]
  )

  // 渲染模板卡片
  const renderTemplateCard = (template: PromptTemplate & { isCustom?: boolean }) => {
    const isSelected = selectedIds.has(template.id)
    const isFavorite = favorites.has(template.id)
    const name = locale === 'en' ? template.nameEn || template.name : template.name
    const prompt = locale === 'en' ? template.promptEn || template.prompt : template.prompt

    return (
      <TemplateCard key={template.id} $selected={isSelected} onClick={() => handleTemplateClick(template)}>
        <TemplateHeader>
          <TemplateName>{name}</TemplateName>
          <TemplateActions>
            <ActionIcon className="favorite" onClick={(e) => handleToggleFavorite(e, template.id)}>
              {isFavorite ? <StarFilled /> : <StarOutlined />}
            </ActionIcon>
            {template.isCustom && (
              <Popconfirm
                title="确定删除此模板？"
                onConfirm={(e) => handleDeleteTemplate(e as any, template.id)}
                okButtonProps={{ danger: true }}
                placement="left">
                <ActionIcon className="delete" onClick={(e) => e.stopPropagation()}>
                  <DeleteOutlined />
                </ActionIcon>
              </Popconfirm>
            )}
          </TemplateActions>
        </TemplateHeader>
        <Tooltip title={prompt} placement="top">
          <TemplatePrompt>{prompt}</TemplatePrompt>
        </Tooltip>
        <TagsWrapper>
          {template.isCustom && <CustomTag>自定义</CustomTag>}
          {template.tags.slice(0, 3).map((tag) => (
            <StyledTag key={tag}>{tag}</StyledTag>
          ))}
        </TagsWrapper>
      </TemplateCard>
    )
  }

  return (
    <Container>
      <Header>
        <SearchInput
          placeholder="搜索模板..."
          prefix={<SearchOutlined style={{ color: 'var(--color-text-secondary)' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
        />
        <Tooltip title="保存当前提示词为模板">
          <AddButton type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenAddModal}>
            保存
          </AddButton>
        </Tooltip>
      </Header>

      <TabsWrapper>
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          size="small"
          items={tabItems.map((item) => ({
            key: item.key,
            label: item.label,
            children: (
              <TemplateList>
                {displayTemplates.length > 0 ? (
                  displayTemplates.map(renderTemplateCard)
                ) : (
                  <EmptyState>
                    {searchQuery ? '未找到匹配的模板' : activeCategory === 'custom' ? '暂无自定义模板' : '暂无模板'}
                  </EmptyState>
                )}
              </TemplateList>
            )
          }))}
        />
      </TabsWrapper>

      {multiSelect && selectedIds.size > 0 && (
        <SelectedCount>
          <span>已选择 {selectedIds.size} 个模板</span>
          <ApplyButton onClick={handleApplySelected}>应用</ApplyButton>
        </SelectedCount>
      )}

      {/* 添加模板弹窗 */}
      <Modal
        title="保存为模板"
        open={isModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setIsModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={400}>
        <ModalContent>
          <div>
            <ModalLabel>模板名称 *</ModalLabel>
            <Input
              placeholder="输入模板名称"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          </div>
          <div>
            <ModalLabel>提示词 *</ModalLabel>
            <Input.TextArea
              placeholder="输入提示词"
              value={newTemplatePrompt}
              onChange={(e) => setNewTemplatePrompt(e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <ModalLabel>负面提示词（可选）</ModalLabel>
            <Input.TextArea
              placeholder="输入负面提示词"
              value={newTemplateNegativePrompt}
              onChange={(e) => setNewTemplateNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>
        </ModalContent>
      </Modal>
    </Container>
  )
})

export default PromptTemplates
