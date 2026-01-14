/**
 * 壁纸高级设置组件
 * Wallpaper Advanced Settings Component
 *
 * 提供壁纸的高级自定义选项（来源、参数、效果）
 * 壁纸的开启/关闭通过 UnifiedPresetModal 控制
 */

import { useWallpaper } from '@renderer/hooks/useWallpaper'
import { useAppDispatch } from '@renderer/store'
import { clearWallpaperPreset, resetWallpaperEffects, setWallpaperEffect } from '@renderer/store/settings'
import type {
  BuiltInWallpaper,
  ChatBubbleEffect,
  CodeBlockEffect,
  ContentOverlayEffect,
  InputBarEffect,
  SidebarGlassEffect,
  WallpaperDisplayMode,
  WallpaperEffects
} from '@renderer/types/wallpaper'
import { DEFAULT_WALLPAPER_SETTINGS } from '@renderer/types/wallpaper'
import { Button, Collapse, ColorPicker, Input, Segmented, Slider, Switch, Tooltip } from 'antd'
import type { Color } from 'antd/es/color-picker'
import { Image, Link, RefreshCw, Upload } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingRow, SettingRowTitle } from '..'
import { useTheme } from '../../../context/ThemeProvider'

/**
 * 内置壁纸画廊
 */
const BuiltInWallpaperGallery: FC<{
  wallpapers: BuiltInWallpaper[]
  selectedId?: string
  onSelect: (id: string) => void
}> = ({ wallpapers, selectedId, onSelect }) => {
  const { t } = useTranslation()

  // 按分类分组
  const gradientWallpapers = wallpapers.filter((w) => w.category === 'gradient')

  return (
    <GalleryContainer>
      <GalleryTitle>{t('settings.wallpaper.builtin.gradient', '渐变壁纸')}</GalleryTitle>
      <GalleryGrid>
        {gradientWallpapers.map((wallpaper) => (
          <GalleryItem
            key={wallpaper.id}
            $isSelected={selectedId === wallpaper.id}
            $background={wallpaper.thumbnail}
            onClick={() => onSelect(wallpaper.id)}>
            <GalleryItemOverlay $isSelected={selectedId === wallpaper.id}>
              {selectedId === wallpaper.id && '✓'}
            </GalleryItemOverlay>
          </GalleryItem>
        ))}
      </GalleryGrid>
    </GalleryContainer>
  )
}

/**
 * 壁纸高级设置组件
 */
const WallpaperSettingsComponent: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const {
    settings,
    isEnabled,
    builtInWallpapers,
    setWallpaperSource,
    setDisplayMode,
    setBlur,
    setOpacity,
    setBrightness,
    setExcludeWorkflow,
    selectLocalFile,
    resetWallpaperParams
  } = useWallpaper()

  // 确保 effects 存在，使用默认值作为后备
  const effects = settings.effects || DEFAULT_WALLPAPER_SETTINGS.effects

  const [urlInput, setUrlInput] = useState(settings.url || '')

  // 来源选项（不含 none，因为禁用壁纸通过预设控制）
  const sourceOptions = [
    { value: 'builtin', label: t('settings.wallpaper.source.builtin', '内置'), icon: <Image size={14} /> },
    { value: 'local', label: t('settings.wallpaper.source.local', '本地'), icon: <Upload size={14} /> },
    { value: 'url', label: t('settings.wallpaper.source.url', 'URL'), icon: <Link size={14} /> }
  ]

  // 显示模式选项
  const displayModeOptions = [
    { value: 'cover', label: t('settings.wallpaper.mode.cover', '填充') },
    { value: 'contain', label: t('settings.wallpaper.mode.contain', '适应') },
    { value: 'center', label: t('settings.wallpaper.mode.center', '居中') },
    { value: 'tile', label: t('settings.wallpaper.mode.tile', '平铺') }
  ]

  // 处理来源切换
  const handleSourceChange = useCallback(
    (source: string) => {
      setWallpaperSource(source as 'local' | 'url' | 'builtin')
      // 用户手动更改设置时，清除预设关联
      dispatch(clearWallpaperPreset())
    },
    [setWallpaperSource, dispatch]
  )

  // 处理本地文件选择
  const handleSelectLocal = useCallback(async () => {
    await selectLocalFile()
    dispatch(clearWallpaperPreset())
  }, [selectLocalFile, dispatch])

  // 处理 URL 输入
  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      setWallpaperSource('url', urlInput.trim())
      dispatch(clearWallpaperPreset())
    }
  }, [urlInput, setWallpaperSource, dispatch])

  // 处理内置壁纸选择
  const handleBuiltInSelect = useCallback(
    (id: string) => {
      setWallpaperSource('builtin', id)
      dispatch(clearWallpaperPreset())
    },
    [setWallpaperSource, dispatch]
  )

  // 处理效果更新
  const handleEffectChange = useCallback(
    <K extends keyof WallpaperEffects>(key: K, value: Partial<WallpaperEffects[K]>) => {
      dispatch(setWallpaperEffect({ key, value } as { key: K; value: Partial<WallpaperEffects[K]> }))
      dispatch(clearWallpaperPreset())
    },
    [dispatch]
  )

  // 处理重置效果
  const handleResetEffects = useCallback(() => {
    dispatch(resetWallpaperEffects(isDark ? 'dark' : 'light'))
  }, [dispatch, isDark])

  // 如果壁纸未启用，显示提示
  if (!isEnabled) {
    return (
      <DisabledHint>
        <span>💡</span>
        <span>{t('settings.wallpaper.hint.disabled', '请先在「预设主题」中选择一个壁纸预设来启用壁纸功能')}</span>
      </DisabledHint>
    )
  }

  // 效果设置折叠面板项
  const effectsCollapseItems = [
    {
      key: 'sidebarGlass',
      label: t('settings.wallpaper.effects.sidebarGlass.title', '侧边栏玻璃效果'),
      children: (
        <SidebarGlassEffectSettings
          effect={effects.sidebarGlass}
          onChange={(value) => handleEffectChange('sidebarGlass', value)}
        />
      )
    },
    {
      key: 'chatBubble',
      label: t('settings.wallpaper.effects.chatBubble.title', '聊天气泡装饰'),
      children: (
        <ChatBubbleEffectSettings
          effect={effects.chatBubble}
          onChange={(value) => handleEffectChange('chatBubble', value)}
        />
      )
    },
    {
      key: 'contentOverlay',
      label: t('settings.wallpaper.effects.contentOverlay.title', '内容遮罩'),
      children: (
        <ContentOverlayEffectSettings
          effect={effects.contentOverlay}
          onChange={(value) => handleEffectChange('contentOverlay', value)}
        />
      )
    },
    {
      key: 'inputBar',
      label: t('settings.wallpaper.effects.inputBar.title', '输入栏样式'),
      children: (
        <InputBarEffectSettings effect={effects.inputBar} onChange={(value) => handleEffectChange('inputBar', value)} />
      )
    },
    {
      key: 'codeBlock',
      label: t('settings.wallpaper.effects.codeBlock.title', '代码块样式'),
      children: (
        <CodeBlockEffectSettings
          effect={effects.codeBlock}
          onChange={(value) => handleEffectChange('codeBlock', value)}
        />
      )
    }
  ]

  return (
    <Container>
      {/* 自定义来源（覆盖预设壁纸） */}
      <SectionTitle>{t('settings.wallpaper.customSource.title', '自定义壁纸来源')}</SectionTitle>
      <SectionHint>{t('settings.wallpaper.customSource.hint', '更换壁纸来源会覆盖预设中的壁纸图片')}</SectionHint>

      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.source.label', '壁纸来源')}</SettingRowTitle>
        <Segmented
          value={settings.source}
          onChange={handleSourceChange}
          options={sourceOptions.map((opt) => ({
            value: opt.value,
            label: (
              <SourceOption>
                {opt.icon}
                <span>{opt.label}</span>
              </SourceOption>
            )
          }))}
        />
      </SettingRow>

      {/* 内置壁纸画廊 */}
      {settings.source === 'builtin' && (
        <>
          <SettingDivider />
          <BuiltInWallpaperGallery
            wallpapers={builtInWallpapers}
            selectedId={settings.builtInId}
            onSelect={handleBuiltInSelect}
          />
        </>
      )}

      {/* 本地文件选择 */}
      {settings.source === 'local' && (
        <>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.wallpaper.local.file', '本地文件')}</SettingRowTitle>
            <LocalFileRow>
              <LocalFilePath>{settings.localPath || t('settings.wallpaper.local.none', '未选择')}</LocalFilePath>
              <Button onClick={handleSelectLocal} icon={<Upload size={14} />}>
                {t('settings.wallpaper.local.select', '选择')}
              </Button>
            </LocalFileRow>
          </SettingRow>
        </>
      )}

      {/* URL 输入 */}
      {settings.source === 'url' && (
        <>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.wallpaper.url.input', '图片 URL')}</SettingRowTitle>
            <UrlInputRow>
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onPressEnter={handleUrlSubmit}
              />
              <Button onClick={handleUrlSubmit}>{t('common.apply', '应用')}</Button>
            </UrlInputRow>
          </SettingRow>
        </>
      )}

      <SettingDivider />

      {/* 显示参数 */}
      <SectionTitle>{t('settings.wallpaper.display.title', '显示参数')}</SectionTitle>

      {/* 显示模式 */}
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.displayMode', '显示模式')}</SettingRowTitle>
        <Segmented
          value={settings.displayMode}
          onChange={(value) => setDisplayMode(value as WallpaperDisplayMode)}
          options={displayModeOptions}
        />
      </SettingRow>

      <SettingDivider />

      {/* 模糊度 */}
      <SettingRow>
        <SettingRowTitle>
          {t('settings.wallpaper.blur', '模糊度')}
          <SliderValue>{settings.blur}px</SliderValue>
        </SettingRowTitle>
        <SliderContainer>
          <Slider min={0} max={20} value={settings.blur} onChange={setBlur} style={{ width: 200 }} />
        </SliderContainer>
      </SettingRow>

      <SettingDivider />

      {/* 透明度 */}
      <SettingRow>
        <SettingRowTitle>
          {t('settings.wallpaper.opacity', '透明度')}
          <SliderValue>{settings.opacity}%</SliderValue>
        </SettingRowTitle>
        <SliderContainer>
          <Slider min={0} max={100} value={settings.opacity} onChange={setOpacity} style={{ width: 200 }} />
        </SliderContainer>
      </SettingRow>

      <SettingDivider />

      {/* 亮度 */}
      <SettingRow>
        <SettingRowTitle>
          {t('settings.wallpaper.brightness', '亮度')}
          <SliderValue>{settings.brightness}%</SliderValue>
        </SettingRowTitle>
        <SliderContainer>
          <Slider min={50} max={150} value={settings.brightness} onChange={setBrightness} style={{ width: 200 }} />
        </SliderContainer>
      </SettingRow>

      <SettingDivider />

      {/* 排除工作流 */}
      <SettingRow>
        <SettingRowTitle>
          <Tooltip title={t('settings.wallpaper.excludeWorkflow.tip', '工作流模块需要清晰的画布，建议保持开启')}>
            <span>{t('settings.wallpaper.excludeWorkflow.label', '工作流模块排除壁纸')}</span>
          </Tooltip>
        </SettingRowTitle>
        <Switch checked={settings.excludeWorkflow} onChange={setExcludeWorkflow} />
      </SettingRow>

      <SettingDivider />

      {/* 重置参数 */}
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.reset', '重置参数')}</SettingRowTitle>
        <Button onClick={resetWallpaperParams}>{t('settings.wallpaper.resetToDefault', '恢复默认')}</Button>
      </SettingRow>

      <SettingDivider />

      {/* 效果设置 */}
      <EffectsSection>
        <EffectsHeader>
          <EffectsTitle>{t('settings.wallpaper.effects.title', '效果设置')}</EffectsTitle>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={handleResetEffects}>
            {t('settings.wallpaper.effects.reset', '重置效果')}
          </Button>
        </EffectsHeader>
        <StyledCollapse items={effectsCollapseItems} ghost accordion />
      </EffectsSection>
    </Container>
  )
}

// ==================== 样式 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
`

const DisabledHint = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: var(--color-background-soft);
  border-radius: 10px;
  color: var(--color-text-2);
  font-size: 13px;

  span:first-child {
    font-size: 20px;
  }
`

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
`

const SectionHint = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 12px;
`

const SourceOption = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const GalleryContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
`

const GalleryTitle = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
`

const GalleryItem = styled.div<{ $isSelected: boolean; $background: string }>`
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: ${(props) => props.$background};
  border: 2px solid ${(props) => (props.$isSelected ? 'var(--color-primary)' : 'transparent')};
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`

const GalleryItemOverlay = styled.div<{ $isSelected: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => (props.$isSelected ? 'rgba(0, 0, 0, 0.3)' : 'transparent')};
  color: white;
  font-size: 18px;
  font-weight: bold;
`

/**
 * 颜色选择器封装
 */
const ColorSetting: FC<{
  label: string
  value: string
  onChange: (color: string) => void
}> = ({ label, value, onChange }) => {
  const handleChange = useCallback(
    (_: Color, hex: string) => {
      onChange(hex)
    },
    [onChange]
  )

  return (
    <SettingRow>
      <SettingRowTitle>{label}</SettingRowTitle>
      <ColorPicker value={value} onChange={handleChange} showText format="rgb" />
    </SettingRow>
  )
}

/**
 * 侧边栏玻璃效果设置
 */
const SidebarGlassEffectSettings: FC<{
  effect: SidebarGlassEffect
  onChange: (value: Partial<SidebarGlassEffect>) => void
}> = ({ effect, onChange }) => {
  const { t } = useTranslation()

  return (
    <>
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.effects.enabled', '启用')}</SettingRowTitle>
        <Switch checked={effect.enabled} onChange={(enabled) => onChange({ enabled })} />
      </SettingRow>
      {effect.enabled && (
        <>
          <ColorSetting
            label={t('settings.wallpaper.effects.sidebarGlass.startColor', '渐变起始色')}
            value={effect.startColor}
            onChange={(startColor) => onChange({ startColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.sidebarGlass.endColor', '渐变结束色')}
            value={effect.endColor}
            onChange={(endColor) => onChange({ endColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.sidebarGlass.tintColor', '色调')}
            value={effect.tintColor}
            onChange={(tintColor) => onChange({ tintColor })}
          />
          <SettingRow>
            <SettingRowTitle>
              {t('settings.wallpaper.effects.sidebarGlass.blurAmount', '模糊度')}
              <SliderValue>{effect.blurAmount}px</SliderValue>
            </SettingRowTitle>
            <Slider
              min={0}
              max={20}
              value={effect.blurAmount}
              onChange={(blurAmount) => onChange({ blurAmount })}
              style={{ width: 150 }}
            />
          </SettingRow>
          <SettingRow>
            <SettingRowTitle>
              {t('settings.wallpaper.effects.sidebarGlass.saturation', '饱和度')}
              <SliderValue>{effect.saturation.toFixed(1)}</SliderValue>
            </SettingRowTitle>
            <Slider
              min={1.0}
              max={2.0}
              step={0.1}
              value={effect.saturation}
              onChange={(saturation) => onChange({ saturation })}
              style={{ width: 150 }}
            />
          </SettingRow>
        </>
      )}
    </>
  )
}

/**
 * 聊天气泡装饰效果设置
 */
const ChatBubbleEffectSettings: FC<{
  effect: ChatBubbleEffect
  onChange: (value: Partial<ChatBubbleEffect>) => void
}> = ({ effect, onChange }) => {
  const { t } = useTranslation()

  return (
    <>
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.effects.enabled', '启用')}</SettingRowTitle>
        <Switch checked={effect.enabled} onChange={(enabled) => onChange({ enabled })} />
      </SettingRow>
      {effect.enabled && (
        <>
          <SettingRow>
            <SettingRowTitle>{t('settings.wallpaper.effects.chatBubble.shadow', '阴影效果')}</SettingRowTitle>
            <Switch checked={effect.shadowEnabled} onChange={(shadowEnabled) => onChange({ shadowEnabled })} />
          </SettingRow>
          <SettingRow>
            <SettingRowTitle>{t('settings.wallpaper.effects.chatBubble.accentLine', '强调线')}</SettingRowTitle>
            <Switch
              checked={effect.accentLineEnabled}
              onChange={(accentLineEnabled) => onChange({ accentLineEnabled })}
            />
          </SettingRow>
          {effect.accentLineEnabled && (
            <ColorSetting
              label={t('settings.wallpaper.effects.chatBubble.accentLineColor', '强调线颜色')}
              value={effect.accentLineColor}
              onChange={(accentLineColor) => onChange({ accentLineColor })}
            />
          )}
        </>
      )}
    </>
  )
}

/**
 * 内容遮罩效果设置
 */
const ContentOverlayEffectSettings: FC<{
  effect: ContentOverlayEffect
  onChange: (value: Partial<ContentOverlayEffect>) => void
}> = ({ effect, onChange }) => {
  const { t } = useTranslation()

  return (
    <>
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.effects.enabled', '启用')}</SettingRowTitle>
        <Switch checked={effect.enabled} onChange={(enabled) => onChange({ enabled })} />
      </SettingRow>
      {effect.enabled && (
        <>
          <ColorSetting
            label={t('settings.wallpaper.effects.contentOverlay.startColor', '遮罩起始色')}
            value={effect.startColor}
            onChange={(startColor) => onChange({ startColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.contentOverlay.endColor', '遮罩结束色')}
            value={effect.endColor}
            onChange={(endColor) => onChange({ endColor })}
          />
        </>
      )}
    </>
  )
}

/**
 * 输入栏样式效果设置
 */
const InputBarEffectSettings: FC<{
  effect: InputBarEffect
  onChange: (value: Partial<InputBarEffect>) => void
}> = ({ effect, onChange }) => {
  const { t } = useTranslation()

  return (
    <>
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.effects.enabled', '启用')}</SettingRowTitle>
        <Switch checked={effect.enabled} onChange={(enabled) => onChange({ enabled })} />
      </SettingRow>
      {effect.enabled && (
        <>
          <ColorSetting
            label={t('settings.wallpaper.effects.inputBar.backgroundColor', '背景色')}
            value={effect.backgroundColor}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.inputBar.borderColor', '边框色')}
            value={effect.borderColor}
            onChange={(borderColor) => onChange({ borderColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.inputBar.focusColor', '聚焦色')}
            value={effect.focusColor}
            onChange={(focusColor) => onChange({ focusColor })}
          />
        </>
      )}
    </>
  )
}

/**
 * 代码块样式效果设置
 */
const CodeBlockEffectSettings: FC<{
  effect: CodeBlockEffect
  onChange: (value: Partial<CodeBlockEffect>) => void
}> = ({ effect, onChange }) => {
  const { t } = useTranslation()

  return (
    <>
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.effects.enabled', '启用')}</SettingRowTitle>
        <Switch checked={effect.enabled} onChange={(enabled) => onChange({ enabled })} />
      </SettingRow>
      {effect.enabled && (
        <>
          <ColorSetting
            label={t('settings.wallpaper.effects.codeBlock.backgroundColor', '背景色')}
            value={effect.backgroundColor}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
          />
          <ColorSetting
            label={t('settings.wallpaper.effects.codeBlock.borderColor', '边框色')}
            value={effect.borderColor}
            onChange={(borderColor) => onChange({ borderColor })}
          />
        </>
      )}
    </>
  )
}

const LocalFileRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const LocalFilePath = styled.div`
  max-width: 200px;
  font-size: 12px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const UrlInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 300px;
`

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
`

const SliderValue = styled.span`
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-3);
  min-width: 50px;
`

// ==================== 效果设置样式 ====================

const EffectsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const EffectsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const EffectsTitle = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`

const StyledCollapse = styled(Collapse)`
  .ant-collapse-header {
    padding: 8px 12px !important;
    background: var(--color-background-soft);
    border-radius: 8px !important;
  }

  .ant-collapse-content-box {
    padding: 12px !important;
  }
`

export default WallpaperSettingsComponent
