/**
 * 主题预设选择器组件
 * Theme Preset Selector Component
 */

import { useThemePreset } from '@renderer/hooks/useThemePreset'
import type { ThemeCategory, ThemePreset } from '@renderer/types/theme'
import { Tooltip } from 'antd'
import { Check, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

/**
 * 主题预设卡片
 */
const ThemePresetCard: FC<{
  preset: ThemePreset
  isActive: boolean
  onSelect: () => void
}> = ({ preset, isActive, onSelect }) => {
  const { t } = useTranslation()

  // 获取分类图标
  const getCategoryIcon = (category: ThemeCategory) => {
    switch (category) {
      case 'anime':
        return '✨'
      case 'nature':
        return '🌿'
      case 'professional':
        return '💼'
      case 'custom':
        return '🎨'
      default:
        return '🎯'
    }
  }

  return (
    <CardContainer $isActive={isActive} $primaryColor={preset.colors.colorPrimary} onClick={onSelect}>
      {/* 颜色预览 */}
      <ColorPreview>
        <ColorStrip $color={preset.colors.colorPrimary} />
        <ColorStrip $color={preset.colors.colorBgBase} />
        <ColorStrip $color={preset.colors.colorText} />
        <ColorStrip $color={preset.colors.colorBorder} />
      </ColorPreview>

      {/* 主题信息 */}
      <CardContent>
        <CardTitle>
          <span>{getCategoryIcon(preset.category)}</span>
          <span>{t(preset.name, preset.name)}</span>
        </CardTitle>
        {preset.description && <CardDescription>{t(preset.description, preset.description)}</CardDescription>}

        {/* 效果标签 */}
        {preset.effects && (
          <EffectTags>
            {preset.effects.glassEffect && (
              <Tooltip title={t('settings.theme.effect.glass', '玻璃效果')}>
                <EffectTag>🪟</EffectTag>
              </Tooltip>
            )}
            {preset.effects.gradientAccents && (
              <Tooltip title={t('settings.theme.effect.gradient', '渐变强调')}>
                <EffectTag>🌈</EffectTag>
              </Tooltip>
            )}
            {preset.effects.borderRadius === 'large' && (
              <Tooltip title={t('settings.theme.effect.rounded', '大圆角')}>
                <EffectTag>⭕</EffectTag>
              </Tooltip>
            )}
          </EffectTags>
        )}
      </CardContent>

      {/* 选中标记 */}
      {isActive && (
        <ActiveBadge>
          <Check size={12} />
        </ActiveBadge>
      )}
    </CardContainer>
  )
}

/**
 * 主题预设选择器
 */
const ThemePresetSelector: FC = () => {
  const { t } = useTranslation()
  const { activePresetId, allThemePresets, setPreset } = useThemePreset()

  // 按分类分组
  const groupedPresets = useMemo(() => {
    const groups: Record<ThemeCategory, ThemePreset[]> = {
      default: [],
      anime: [],
      nature: [],
      professional: [],
      custom: []
    }

    allThemePresets.forEach((preset) => {
      groups[preset.category].push(preset)
    })

    return groups
  }, [allThemePresets])

  // 处理选择 - 点击时应用主题
  const handleSelect = useCallback(
    (presetId: string) => {
      if (activePresetId === presetId) {
        // 取消选择，恢复默认
        setPreset(null)
      } else {
        // 应用选中的主题
        setPreset(presetId)
      }
    },
    [activePresetId, setPreset]
  )

  // 渲染分类
  const renderCategory = (category: ThemeCategory, presets: ThemePreset[]) => {
    if (presets.length === 0) return null

    const categoryLabels: Record<ThemeCategory, string> = {
      default: t('settings.theme.category.default', '默认'),
      anime: t('settings.theme.category.anime', '二次元'),
      nature: t('settings.theme.category.nature', '自然'),
      professional: t('settings.theme.category.professional', '专业'),
      custom: t('settings.theme.category.custom', '自定义')
    }

    return (
      <CategorySection key={category}>
        <CategoryTitle>
          {category === 'anime' && <Sparkles size={14} />}
          {categoryLabels[category]}
        </CategoryTitle>
        <PresetGrid>
          {presets.map((preset) => (
            <ThemePresetCard
              key={preset.id}
              preset={preset}
              isActive={activePresetId === preset.id}
              onSelect={() => handleSelect(preset.id)}
            />
          ))}
        </PresetGrid>
      </CategorySection>
    )
  }

  return (
    <Container>
      <Header>
        <Title>{t('settings.theme.presets.title', '主题预设')}</Title>
        <Subtitle>{t('settings.theme.presets.desc', '点击选择一个预设主题')}</Subtitle>
      </Header>

      <Content>
        {/* 无主题选项 */}
        <NoThemeOption $isActive={!activePresetId} onClick={() => setPreset(null)}>
          <span>🎨</span>
          <span>{t('settings.theme.presets.none', '使用自定义颜色')}</span>
          {!activePresetId && (
            <ActiveBadge>
              <Check size={12} />
            </ActiveBadge>
          )}
        </NoThemeOption>

        {/* 分类列表 */}
        {renderCategory('default', groupedPresets.default)}
        {renderCategory('anime', groupedPresets.anime)}
        {renderCategory('nature', groupedPresets.nature)}
        {renderCategory('professional', groupedPresets.professional)}
        {renderCategory('custom', groupedPresets.custom)}
      </Content>
    </Container>
  )
}

// ==================== 样式 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Title = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`

const Subtitle = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const CategorySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const CategoryTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
`

const CardContainer = styled.div<{ $isActive: boolean; $primaryColor: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 2px solid ${(props) => (props.$isActive ? props.$primaryColor : 'var(--color-border)')};
  background: var(--color-background);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(props) => props.$primaryColor};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`

const ColorPreview = styled.div`
  display: flex;
  height: 24px;
`

const ColorStrip = styled.div<{ $color: string }>`
  flex: 1;
  background: ${(props) => props.$color};
`

const CardContent = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const CardDescription = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const EffectTags = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 4px;
`

const EffectTag = styled.span`
  font-size: 12px;
  cursor: help;
`

const ActiveBadge = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`

const NoThemeOption = styled.div<{ $isActive: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 2px solid ${(props) => (props.$isActive ? 'var(--color-primary)' : 'var(--color-border)')};
  background: var(--color-background);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  span:first-child {
    font-size: 16px;
  }

  span:last-child:not(:first-child) {
    font-size: 13px;
    color: var(--color-text);
  }
`

export default ThemePresetSelector
