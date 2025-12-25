/**
 * 通用预设卡片组件
 *
 * 统一所有预设选择器的卡片样式和交互行为。
 *
 * 功能特性：
 * 1. 统一的选中态和悬停效果
 * 2. 支持标题、描述、标签、预览
 * 3. 支持复制和应用操作
 * 4. 响应式网格布局
 * 5. 支持占位符预览图（基于 category 生成渐变 + emoji）
 * 6. 支持收藏按钮
 * 7. 支持分类徽章
 *
 * @module components/ConfigForms/PresetCard
 * @refactored Phase 2.1/2.2 - 添加占位符预览、收藏按钮、分类徽章
 */

import { CopyOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Button, Card, message, Tag, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

// ==================== 分类视觉配置 ====================

/** 分类对应的渐变色和 emoji */
const CATEGORY_VISUALS: Record<string, { gradient: string; emoji: string }> = {
  pattern: { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '🎨' },
  commercial: { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '📸' },
  lifestyle: { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', emoji: '🌿' },
  artistic: { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', emoji: '✨' },
  model: { gradient: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)', emoji: '👤' },
  scene: { gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', emoji: '🏞️' },
  ethnicity: { gradient: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)', emoji: '🌍' },
  default: { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', emoji: '📦' }
}

/** 分类对应的标签颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  pattern: 'purple',
  commercial: 'magenta',
  lifestyle: 'cyan',
  artistic: 'gold',
  model: 'blue',
  scene: 'green',
  ethnicity: 'orange',
  default: 'default'
}

/** 分类对应的中文显示名 */
const CATEGORY_LABELS: Record<string, string> = {
  pattern: '图案',
  commercial: '商拍',
  lifestyle: '生活',
  artistic: '艺术',
  model: '模特',
  scene: '场景',
  ethnicity: '人种',
  default: '预设'
}

// ==================== 样式组件 ====================

const StyledCard = styled(Card)<{ $isSelected?: boolean }>`
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid ${({ $isSelected }) => ($isSelected ? 'var(--color-primary)' : 'transparent')};
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: var(--color-primary);
  }

  .ant-card-body {
    padding: 0 !important;
  }
`

const PreviewContainer = styled.div<{ $gradient: string }>`
  position: relative;
  width: 100%;
  height: 80px;
  background: ${({ $gradient }) => $gradient};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const PreviewEmoji = styled.span`
  font-size: 32px;
  opacity: 0.9;
`

const FavoriteButton = styled.button<{ $isFavorite?: boolean }>`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;

  &:hover {
    transform: scale(1.1);
    background: white;
  }

  .anticon {
    font-size: 14px;
    color: ${({ $isFavorite }) => ($isFavorite ? '#ff4d4f' : 'var(--ant-color-text-tertiary)')};
  }
`

const CategoryBadge = styled(Tag)`
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 10px;
  padding: 0 6px;
  margin: 0;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
`

const CardContent = styled.div`
  padding: 10px;
`

const CardTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--ant-color-text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CardDescription = styled.div`
  font-size: 11px;
  color: var(--ant-color-text-tertiary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CardTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
`

const CardPreview = styled.div`
  font-size: 10px;
  color: var(--ant-color-text-quaternary);
  background: var(--ant-color-bg-elevated);
  padding: 6px 8px;
  border-radius: 4px;
  margin-top: 6px;
  max-height: 40px;
  overflow: hidden;
  line-height: 1.4;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;
`

// ==================== 类型定义 ====================

export type PresetCategory = 'pattern' | 'commercial' | 'lifestyle' | 'artistic' | 'model' | 'scene' | 'ethnicity'

export interface PresetCardProps {
  /** 预设 ID（用于收藏等功能） */
  id?: string
  /** 卡片标题 */
  title: string
  /** 卡片描述（可选） */
  description?: string
  /** 标签列表（可选） */
  tags?: Array<{ text: string; color?: string }>
  /** 预览文本（可选，仅在无预览图时显示） */
  preview?: string

  // 预览占位符
  /** 分类类型（用于生成占位符预览） */
  category?: PresetCategory
  /** 自定义预览图片 URL（覆盖占位符） */
  previewImage?: string
  /** 是否显示预览区域（默认 false 保持向后兼容） */
  showPreview?: boolean

  // 分类徽章
  /** 分类标签显示名（可选，默认根据 category 自动生成） */
  categoryLabel?: string
  /** 分类徽章颜色（可选，默认根据 category 自动映射） */
  categoryColor?: string

  // 收藏功能
  /** 是否已收藏 */
  isFavorite?: boolean
  /** 收藏切换回调 */
  onFavoriteToggle?: (id: string) => void

  // 交互
  /** 是否选中 */
  isSelected?: boolean
  /** 点击卡片回调 */
  onClick?: () => void
  /** 双击卡片回调 */
  onDoubleClick?: () => void

  // 操作
  /** 复制内容（可选，有值时显示复制按钮） */
  copyContent?: string
  /** 应用按钮文本（可选，有值时显示应用按钮） */
  applyButtonText?: string
  /** 应用回调 */
  onApply?: () => void

  /** 自定义内容区域 */
  children?: ReactNode
}

// ==================== 主组件 ====================

/**
 * 通用预设卡片组件
 *
 * @example
 * // 基础用法（向后兼容）
 * <PresetCard
 *   title="Y2K 千禧辣妹"
 *   description="酸性/散点/重叠 - 霓虹与金属色"
 *   isSelected={selectedId === 'y2k'}
 *   onClick={() => handleSelect('y2k')}
 * />
 *
 * @example
 * // 带预览图和收藏
 * <PresetCard
 *   id="y2k"
 *   title="Y2K 千禧辣妹"
 *   description="酸性/散点/重叠"
 *   category="pattern"
 *   showPreview
 *   isFavorite={favorites.includes('y2k')}
 *   onFavoriteToggle={toggleFavorite}
 *   tags={[{ text: '潮流', color: 'purple' }]}
 *   onClick={() => handleSelect('y2k')}
 * />
 *
 * @example
 * // 自定义预览图
 * <PresetCard
 *   title="商拍场景"
 *   category="commercial"
 *   showPreview
 *   previewImage="/images/commercial-preview.jpg"
 *   categoryLabel="商业摄影"
 *   categoryColor="magenta"
 * />
 */
function PresetCard({
  id,
  title,
  description,
  tags,
  preview,
  category,
  previewImage,
  showPreview = false,
  categoryLabel,
  categoryColor,
  isFavorite = false,
  onFavoriteToggle,
  isSelected = false,
  onClick,
  onDoubleClick,
  copyContent,
  applyButtonText,
  onApply,
  children
}: PresetCardProps) {
  // 计算视觉配置
  const visual = useMemo(() => {
    const cat = category || 'default'
    return CATEGORY_VISUALS[cat] || CATEGORY_VISUALS.default
  }, [category])

  const badgeColor = useMemo(() => {
    if (categoryColor) return categoryColor
    const cat = category || 'default'
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS.default
  }, [category, categoryColor])

  const badgeLabel = useMemo(() => {
    if (categoryLabel) return categoryLabel
    const cat = category || 'default'
    return CATEGORY_LABELS[cat] || CATEGORY_LABELS.default
  }, [category, categoryLabel])

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (copyContent) {
        navigator.clipboard.writeText(copyContent)
        message.success('已复制提示词')
      }
    },
    [copyContent]
  )

  const handleApply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onApply?.()
    },
    [onApply]
  )

  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (id && onFavoriteToggle) {
        onFavoriteToggle(id)
      }
    },
    [id, onFavoriteToggle]
  )

  return (
    <StyledCard $isSelected={isSelected} onClick={onClick} onDoubleClick={onDoubleClick}>
      {/* 预览区域 */}
      {showPreview && (
        <PreviewContainer $gradient={visual.gradient}>
          {previewImage ? <PreviewImage src={previewImage} alt={title} /> : <PreviewEmoji>{visual.emoji}</PreviewEmoji>}

          {/* 收藏按钮 */}
          {onFavoriteToggle && id && (
            <FavoriteButton $isFavorite={isFavorite} onClick={handleFavoriteClick}>
              {isFavorite ? <HeartFilled /> : <HeartOutlined />}
            </FavoriteButton>
          )}

          {/* 分类徽章 */}
          {category && <CategoryBadge color={badgeColor}>{badgeLabel}</CategoryBadge>}
        </PreviewContainer>
      )}

      {/* 内容区域 */}
      <CardContent>
        <CardTitle>
          <span>{title}</span>
          {copyContent && (
            <Tooltip title="复制提示词">
              <CopyOutlined onClick={handleCopy} style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)' }} />
            </Tooltip>
          )}
        </CardTitle>

        {description && <CardDescription>{description}</CardDescription>}

        {tags && tags.length > 0 && (
          <CardTags>
            {tags.slice(0, 3).map((tag, i) => (
              <Tag key={i} color={tag.color || 'blue'} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                {tag.text}
              </Tag>
            ))}
          </CardTags>
        )}

        {preview && !showPreview && <CardPreview>{preview}</CardPreview>}

        {children}

        {applyButtonText && onApply && (
          <ActionButtons>
            <Button size="small" type="primary" block onClick={handleApply}>
              {applyButtonText}
            </Button>
          </ActionButtons>
        )}
      </CardContent>
    </StyledCard>
  )
}

export default memo(PresetCard)

// ==================== 导出样式组件和配置供外部使用 ====================

export {
  ActionButtons,
  CardContent,
  CardDescription,
  CardPreview,
  CardTags,
  CardTitle,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_VISUALS,
  CategoryBadge,
  FavoriteButton,
  PreviewContainer,
  PreviewEmoji,
  PreviewImage,
  StyledCard
}
