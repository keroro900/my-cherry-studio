/**
 * 壁纸设置组件
 * Wallpaper Settings Component
 */

import { useWallpaper } from '@renderer/hooks/useWallpaper'
import type { BuiltInWallpaper, WallpaperDisplayMode } from '@renderer/types/wallpaper'
import { Button, Input, Segmented, Slider, Switch, Tooltip } from 'antd'
import { Image, Link, Palette, Upload } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingRow, SettingRowTitle } from '..'

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
 * 壁纸设置组件
 */
const WallpaperSettingsComponent: FC = () => {
  const { t } = useTranslation()
  const {
    settings,
    isEnabled,
    builtInWallpapers,
    toggleWallpaper,
    setWallpaperSource,
    setDisplayMode,
    setBlur,
    setOpacity,
    setBrightness,
    setExcludeWorkflow,
    selectLocalFile,
    resetWallpaperParams
  } = useWallpaper()

  const [urlInput, setUrlInput] = useState(settings.url || '')

  // 来源选项
  const sourceOptions = [
    { value: 'none', label: t('settings.wallpaper.source.none', '无'), icon: <Palette size={14} /> },
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
      if (source === 'none') {
        toggleWallpaper(false)
      } else {
        setWallpaperSource(source as 'local' | 'url' | 'builtin')
      }
    },
    [toggleWallpaper, setWallpaperSource]
  )

  // 处理本地文件选择
  const handleSelectLocal = useCallback(async () => {
    await selectLocalFile()
  }, [selectLocalFile])

  // 处理 URL 输入
  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      setWallpaperSource('url', urlInput.trim())
    }
  }, [urlInput, setWallpaperSource])

  // 处理内置壁纸选择
  const handleBuiltInSelect = useCallback(
    (id: string) => {
      setWallpaperSource('builtin', id)
    },
    [setWallpaperSource]
  )

  return (
    <Container>
      {/* 启用开关 */}
      <SettingRow>
        <SettingRowTitle>{t('settings.wallpaper.enable', '启用壁纸')}</SettingRowTitle>
        <Switch checked={isEnabled} onChange={toggleWallpaper} />
      </SettingRow>

      {isEnabled && (
        <>
          <SettingDivider />

          {/* 来源选择 */}
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

          {settings.source !== 'none' && (
            <>
              <SettingDivider />

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
                  <Slider
                    min={50}
                    max={150}
                    value={settings.brightness}
                    onChange={setBrightness}
                    style={{ width: 200 }}
                  />
                </SliderContainer>
              </SettingRow>

              <SettingDivider />

              {/* 排除工作流 */}
              <SettingRow>
                <SettingRowTitle>
                  <Tooltip
                    title={t('settings.wallpaper.excludeWorkflow.tip', '工作流模块需要清晰的画布，建议保持开启')}>
                    <span>{t('settings.wallpaper.excludeWorkflow', '工作流模块排除壁纸')}</span>
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
            </>
          )}
        </>
      )}
    </Container>
  )
}

// ==================== 样式 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
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

export default WallpaperSettingsComponent
