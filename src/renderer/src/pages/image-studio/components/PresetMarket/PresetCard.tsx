/**
 * 预设卡片组件
 * PresetCard
 *
 * 展示单个预设的缩略图、名称、描述和操作按钮
 */

import { DeleteOutlined, HeartFilled, HeartOutlined, StarFilled } from '@ant-design/icons'
import { Button, Popconfirm, Tag, Tooltip } from 'antd'
import { Copy, Package, Pencil, Play } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { PRESET_CATEGORIES, type StudioPreset } from '../../types/preset-market'

// ============================================================================
// Props 定义
// ============================================================================

interface PresetCardProps {
  /** 预设数据 */
  preset: StudioPreset
  /** 是否选中 */
  isSelected?: boolean
  /** 点击卡片 */
  onClick?: () => void
  /** 应用预设 */
  onApply?: () => void
  /** 切换收藏 */
  onToggleFavorite?: () => void
  /** 删除预设（仅用户预设） */
  onDelete?: () => void
  /** 复制预设 */
  onDuplicate?: () => void
  /** 编辑预设（仅用户预设） */
  onEdit?: () => void
  /** 紧凑模式 */
  compact?: boolean
}

// ============================================================================
// 组件实现
// ============================================================================

export const PresetCard: FC<PresetCardProps> = ({
  preset,
  isSelected = false,
  onClick,
  onApply,
  onToggleFavorite,
  onDelete,
  onDuplicate,
  onEdit,
  compact = false
}) => {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language?.startsWith('en')

  // 获取分类元数据
  const categoryMeta = useMemo(() => PRESET_CATEGORIES[preset.category], [preset.category])

  // 获取模块标签颜色
  const moduleColor = useMemo(() => {
    switch (preset.module) {
      case 'ecom':
        return '#52c41a'
      case 'model':
        return '#1890ff'
      case 'pattern':
        return '#722ed1'
      default:
        return '#666'
    }
  }, [preset.module])

  // 获取模块标签文本
  const moduleLabel = useMemo(() => {
    switch (preset.module) {
      case 'ecom':
        return t('image_studio.modules.ecom')
      case 'model':
        return t('image_studio.modules.model')
      case 'pattern':
        return t('image_studio.modules.pattern')
      default:
        return preset.module
    }
  }, [preset.module, t])

  // 显示名称（根据语言）
  const displayName = useMemo(
    () => (isEnglish && preset.nameEn ? preset.nameEn : preset.name),
    [isEnglish, preset.name, preset.nameEn]
  )

  // 显示描述（根据语言）
  const displayDescription = useMemo(
    () => (isEnglish && preset.descriptionEn ? preset.descriptionEn : preset.description),
    [isEnglish, preset.description, preset.descriptionEn]
  )

  // 处理应用
  const handleApply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onApply?.()
    },
    [onApply]
  )

  // 处理收藏
  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleFavorite?.()
    },
    [onToggleFavorite]
  )

  // 处理复制
  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDuplicate?.()
    },
    [onDuplicate]
  )

  // 处理编辑
  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onEdit?.()
    },
    [onEdit]
  )

  if (compact) {
    return (
      <CompactCard $selected={isSelected} onClick={onClick}>
        <CompactHeader>
          <CompactIcon>{categoryMeta?.icon || '📦'}</CompactIcon>
          <CompactInfo>
            <CompactName>{displayName}</CompactName>
            <CompactMeta>
              <Tag color={moduleColor} style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                {moduleLabel}
              </Tag>
              {preset.usageCount > 0 && (
                <UsageCount>
                  <StarFilled /> {preset.usageCount}
                </UsageCount>
              )}
            </CompactMeta>
          </CompactInfo>
        </CompactHeader>
        <CompactActions>
          <Tooltip title={preset.isFavorite ? '取消收藏' : '收藏'}>
            <ActionButton onClick={handleToggleFavorite} $active={preset.isFavorite}>
              {preset.isFavorite ? <HeartFilled /> : <HeartOutlined />}
            </ActionButton>
          </Tooltip>
          <Tooltip title="应用预设">
            <Button type="primary" size="small" icon={<Play size={12} />} onClick={handleApply}>
              应用
            </Button>
          </Tooltip>
        </CompactActions>
      </CompactCard>
    )
  }

  return (
    <Card $selected={isSelected} onClick={onClick}>
      {/* 缩略图区域 */}
      <ThumbnailArea>
        {preset.thumbnail ? (
          <Thumbnail src={preset.thumbnail} alt={displayName} />
        ) : (
          <ThumbnailPlaceholder>
            <PlaceholderIcon>{categoryMeta?.icon || '📦'}</PlaceholderIcon>
          </ThumbnailPlaceholder>
        )}
        {/* 来源标记 */}
        {preset.source === 'builtin' && (
          <SourceBadge $type="builtin">
            <Package size={10} /> 内置
          </SourceBadge>
        )}
        {preset.source === 'user' && (
          <SourceBadge $type="user">
            <Package size={10} /> 自定义
          </SourceBadge>
        )}
        {/* 收藏按钮 */}
        <FavoriteButton onClick={handleToggleFavorite} $active={preset.isFavorite}>
          {preset.isFavorite ? <HeartFilled /> : <HeartOutlined />}
        </FavoriteButton>
      </ThumbnailArea>

      {/* 内容区域 */}
      <ContentArea>
        <Header>
          <Name title={displayName}>{displayName}</Name>
          <ModuleTag style={{ backgroundColor: moduleColor }}>{moduleLabel}</ModuleTag>
        </Header>

        <Description title={displayDescription}>{displayDescription}</Description>

        <TagRow>
          <CategoryTag>
            {categoryMeta?.icon} {isEnglish ? categoryMeta?.labelEn : categoryMeta?.label}
          </CategoryTag>
          {preset.usageCount > 0 && (
            <UsageBadge>
              <StarFilled /> {preset.usageCount}
            </UsageBadge>
          )}
        </TagRow>

        {/* 标签列表 */}
        {preset.tags.length > 0 && (
          <Tags>
            {preset.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} style={{ margin: 0, fontSize: 10 }}>
                {tag}
              </Tag>
            ))}
            {preset.tags.length > 3 && <MoreTags>+{preset.tags.length - 3}</MoreTags>}
          </Tags>
        )}

        {/* 提示词预览 - 优先显示新结构，兼容旧结构 */}
        {(preset.systemPrompt || preset.userPrompt || preset.promptTemplate) && (
          <PromptPreviewContainer>
            {/* 系统提示词 */}
            {preset.systemPrompt && (
              <PromptPreviewItem>
                <PromptLabel>
                  <span className="icon">🎭</span> 角色
                </PromptLabel>
                <PromptText title={preset.systemPrompt}>
                  {preset.systemPrompt.length > 40 ? `${preset.systemPrompt.slice(0, 40)}...` : preset.systemPrompt}
                </PromptText>
              </PromptPreviewItem>
            )}
            {/* 用户提示词 */}
            {(preset.userPrompt || (!preset.systemPrompt && preset.promptTemplate)) && (
              <PromptPreviewItem>
                <PromptLabel>
                  <span className="icon">📝</span> 需求
                </PromptLabel>
                <PromptText title={preset.userPrompt || preset.promptTemplate}>
                  {(() => {
                    const text = preset.userPrompt || preset.promptTemplate || ''
                    return text.length > 40 ? `${text.slice(0, 40)}...` : text
                  })()}
                </PromptText>
              </PromptPreviewItem>
            )}
          </PromptPreviewContainer>
        )}
      </ContentArea>

      {/* 操作按钮 */}
      <ActionsArea>
        <Button type="primary" icon={<Play size={14} />} onClick={handleApply} block>
          应用预设
        </Button>
        <ActionRow>
          <Tooltip title="复制预设">
            <Button type="text" size="small" icon={<Copy size={14} />} onClick={handleDuplicate} />
          </Tooltip>
          {onEdit && (
            <Tooltip title="编辑预设">
              <Button type="text" size="small" icon={<Pencil size={14} />} onClick={handleEdit} />
            </Tooltip>
          )}
          {onDelete && (
            <Popconfirm
              title="确定删除此预设吗？"
              onConfirm={(e) => {
                e?.stopPropagation()
                onDelete()
              }}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          )}
        </ActionRow>
      </ActionsArea>
    </Card>
  )
}

export default PresetCard

// ============================================================================
// 样式定义
// ============================================================================

const Card = styled.div<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`

const ThumbnailArea = styled.div`
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--color-background-soft);
  overflow: hidden;
`

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const ThumbnailPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-background-soft) 0%, var(--color-background-mute) 100%);
`

const PlaceholderIcon = styled.span`
  font-size: 48px;
  opacity: 0.6;
`

const SourceBadge = styled.span<{ $type: 'builtin' | 'user' }>`
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  background: ${(props) => (props.$type === 'builtin' ? 'var(--color-primary)' : '#52c41a')};
  color: white;
`

const FavoriteButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: ${(props) => (props.$active ? '#ff4d4f' : '#999')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: white;
    color: #ff4d4f;
    transform: scale(1.1);
  }
`

const ContentArea = styled.div`
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const Name = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`

const ModuleTag = styled.span`
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: white;
  flex-shrink: 0;
`

const Description = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const TagRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const CategoryTag = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-2);
`

const UsageBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #faad14;
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
`

const MoreTags = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  padding: 2px 6px;
`

const PromptPreviewContainer = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: var(--color-background-soft);
  border-radius: 6px;
  border-left: 3px solid var(--color-primary);
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PromptPreviewItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const PromptLabel = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  gap: 4px;

  .icon {
    font-size: 11px;
  }
`

const PromptText = styled.div`
  font-size: 11px;
  color: var(--color-text-2);
  line-height: 1.4;
  font-family: monospace;
  word-break: break-all;
`

const ActionsArea = styled.div`
  padding: 12px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ActionRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
`

// ============================================================================
// 紧凑模式样式
// ============================================================================

const CompactCard = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--color-background);
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-background-soft);
  }
`

const CompactHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
`

const CompactIcon = styled.span`
  font-size: 24px;
  flex-shrink: 0;
`

const CompactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const CompactName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CompactMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const UsageCount = styled.span`
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #faad14;
`

const CompactActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

const ActionButton = styled.button<{ $active?: boolean }>`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${(props) => (props.$active ? '#ff4d4f' : 'var(--color-text-3)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-mute);
    color: ${(props) => (props.$active ? '#ff4d4f' : 'var(--color-text-1)')};
  }
`
