/**
 * 统一预设选择模态框
 * Unified Preset Selection Modal
 *
 * 壁纸预设 = 主题预设（包含壁纸图片 + 完整组件样式CSS）
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setWallpaperActivePresetId } from '@renderer/store/settings'
import type { WallpaperPresetV2 } from '@renderer/types/wallpaperPresetCss'
import { WALLPAPER_PRESETS_V2 } from '@renderer/types/wallpaperPresets'
import { Modal } from 'antd'
import { Check, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useTheme } from '../../../context/ThemeProvider'

interface UnifiedPresetModalProps {
  open: boolean
  onClose: () => void
}

/**
 * 壁纸预设卡片
 */
const WallpaperPresetCard: FC<{
  preset: WallpaperPresetV2
  isActive: boolean
  onSelect: () => void
}> = ({ preset, isActive, onSelect }) => {
  const { t } = useTranslation()

  const getModeIcon = (mode?: 'light' | 'dark' | 'both') => {
    if (mode === 'light') return '☀️'
    if (mode === 'dark') return '🌙'
    return '🌓'
  }

  // 检查是否为渐变壁纸（thumbnail 包含 linear-gradient）
  const isGradient = preset.thumbnail.includes('linear-gradient')

  return (
    <WallpaperCard $isActive={isActive} onClick={onSelect}>
      <WallpaperThumbnail $background={isGradient ? preset.thumbnail : `url(${preset.thumbnail})`} />
      <CardContent>
        <CardTitle>
          <span>{getModeIcon(preset.themeMode)}</span>
          <TruncatedName>{t(preset.name, preset.name.split('.').pop() || preset.name)}</TruncatedName>
        </CardTitle>
      </CardContent>
      {isActive && (
        <ActiveBadge>
          <Check size={12} />
        </ActiveBadge>
      )}
    </WallpaperCard>
  )
}

/**
 * 统一预设选择模态框
 */
const UnifiedPresetModal: FC<UnifiedPresetModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 当前选中的预设ID
  const activePresetId = useAppSelector((state) => state.settings.wallpaper?.activePresetId)

  // 过滤壁纸预设（根据当前主题模式）
  const filteredPresets = useMemo(() => {
    return WALLPAPER_PRESETS_V2.filter(
      (preset) => !preset.themeMode || preset.themeMode === (isDark ? 'dark' : 'light') || preset.themeMode === 'both'
    )
  }, [isDark])

  // 按类型分组
  const groupedPresets = useMemo(() => {
    const anime: WallpaperPresetV2[] = []
    const gradient: WallpaperPresetV2[] = []

    filteredPresets.forEach((preset) => {
      if (preset.thumbnail.includes('linear-gradient')) {
        gradient.push(preset)
      } else {
        anime.push(preset)
      }
    })

    return { anime, gradient }
  }, [filteredPresets])

  // 处理预设选择
  const handlePresetSelect = useCallback(
    (presetId: string | undefined) => {
      dispatch(setWallpaperActivePresetId(presetId))
    },
    [dispatch]
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('settings.display.presets.title', '预设主题')}
      width={720}
      footer={null}
      centered
      styles={{
        body: { maxHeight: '70vh', overflowY: 'auto', padding: '16px 24px' }
      }}>
      <ModalContent>
        {/* 提示信息 */}
        <HintText>{t('settings.wallpaper.presets.hint', '选择一个预设主题，包含壁纸图片和完整的组件样式。自定义CSS可以覆盖预设样式。')}</HintText>

        {/* 无预设选项 */}
        <NoPresetOption $isActive={!activePresetId} onClick={() => handlePresetSelect(undefined)}>
          <span>🚫</span>
          <span>{t('settings.wallpaper.presets.none', '不使用预设')}</span>
          {!activePresetId && (
            <ActiveBadge>
              <Check size={12} />
            </ActiveBadge>
          )}
        </NoPresetOption>

        {/* 动漫壁纸预设 */}
        {groupedPresets.anime.length > 0 && (
          <CategorySection>
            <CategoryTitle>
              <Sparkles size={14} />
              {t('settings.wallpaper.category.anime', '动漫壁纸')}
            </CategoryTitle>
            <WallpaperGrid>
              {groupedPresets.anime.map((preset) => (
                <WallpaperPresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  onSelect={() => handlePresetSelect(preset.id)}
                />
              ))}
            </WallpaperGrid>
          </CategorySection>
        )}

        {/* 渐变壁纸预设 */}
        {groupedPresets.gradient.length > 0 && (
          <CategorySection>
            <CategoryTitle>
              <span>🌈</span>
              {t('settings.wallpaper.category.gradient', '渐变壁纸')}
            </CategoryTitle>
            <WallpaperGrid>
              {groupedPresets.gradient.map((preset) => (
                <WallpaperPresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  onSelect={() => handlePresetSelect(preset.id)}
                />
              ))}
            </WallpaperGrid>
          </CategorySection>
        )}
      </ModalContent>
    </Modal>
  )
}

// ==================== 样式 ====================

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const HintText = styled.div`
  font-size: 13px;
  color: var(--color-text-3);
  line-height: 1.5;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const CategorySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const CategoryTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
`

const WallpaperGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
`

const WallpaperCard = styled.div<{ $isActive: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 2px solid ${(props) => (props.$isActive ? 'var(--color-primary)' : 'var(--color-border)')};
  background: var(--color-background);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`

const WallpaperThumbnail = styled.div<{ $background: string }>`
  aspect-ratio: 16 / 10;
  background: ${(props) => props.$background};
  background-size: cover;
  background-position: center;
`

const CardContent = styled.div`
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
`

const TruncatedName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

const NoPresetOption = styled.div<{ $isActive: boolean }>`
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

export default UnifiedPresetModal
