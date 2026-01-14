import CodeEditor from '@renderer/components/CodeEditor'
import { ResetIcon } from '@renderer/components/Icons'
import { HStack } from '@renderer/components/Layout'
import TextBadge from '@renderer/components/TextBadge'
import { isMac, THEME_COLOR_PRESETS } from '@renderer/config/constant'
import { DEFAULT_SIDEBAR_ICONS } from '@renderer/config/sidebar'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useThemePreset } from '@renderer/hooks/useThemePreset'
import { useWallpaper } from '@renderer/hooks/useWallpaper'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import useUserTheme from '@renderer/hooks/useUserTheme'
import { useAppDispatch } from '@renderer/store'
import type { AssistantIconType } from '@renderer/store/settings'
import {
  setAssistantIconType,
  setClickAssistantToShowTopic,
  setCustomCss,
  setPinTopicsToTop,
  setShowTopicTime,
  setSidebarIcons
} from '@renderer/store/settings'
import { ThemeMode } from '@renderer/types'
import { Button, ColorPicker, Segmented, Select, Switch, Tooltip } from 'antd'
import { Image, Minus, Monitor, Moon, Palette, Plus, Settings2, Sun } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'
import SidebarIconsManager from './SidebarIconsManager'
import UnifiedPresetModal from './UnifiedPresetModal'
import WallpaperSettingsComponent from './WallpaperSettings'

const ColorCircleWrapper = styled.div`
  width: 24px;
  height: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`

const ColorCircle = styled.div<{ color: string; isActive?: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
  cursor: pointer;
  transform: translate(-50%, -50%);
  border: 2px solid ${(props) => (props.isActive ? 'var(--color-border)' : 'transparent')};
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`

const DisplaySettings: FC = () => {
  const {
    windowStyle,
    setWindowStyle,
    topicPosition,
    setTopicPosition,
    clickAssistantToShowTopic,
    showTopicTime,
    pinTopicsToTop,
    customCss,
    sidebarIcons,
    setTheme,
    assistantIconType,
    userTheme
  } = useSettings()
  const { navbarPosition, setNavbarPosition } = useNavbarPosition()
  const { theme, settedTheme } = useTheme()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [currentZoom, setCurrentZoom] = useState(1.0)
  const { setUserTheme } = useUserTheme()

  const [visibleIcons, setVisibleIcons] = useState(sidebarIcons?.visible || DEFAULT_SIDEBAR_ICONS)
  const [disabledIcons, setDisabledIcons] = useState(sidebarIcons?.disabled || [])
  const [fontList, setFontList] = useState<string[]>([])

  // 预设模态框状态
  const [presetModalOpen, setPresetModalOpen] = useState(false)

  // 获取当前预设信息
  const { activePresetId: activeThemePresetId } = useThemePreset()
  const { settings: wallpaperSettings, isEnabled: isWallpaperEnabled } = useWallpaper()
  const activeWallpaperPresetId = wallpaperSettings.activePresetId

  const handleWindowStyleChange = useCallback(
    (checked: boolean) => {
      setWindowStyle(checked ? 'transparent' : 'opaque')
    },
    [setWindowStyle]
  )

  const handleColorPrimaryChange = useCallback(
    (colorHex: string) => {
      setUserTheme({
        ...userTheme,
        colorPrimary: colorHex
      })
    },
    [setUserTheme, userTheme]
  )

  const handleReset = useCallback(() => {
    setVisibleIcons([...DEFAULT_SIDEBAR_ICONS])
    setDisabledIcons([])
    dispatch(setSidebarIcons({ visible: DEFAULT_SIDEBAR_ICONS, disabled: [] }))
  }, [dispatch])

  const themeOptions = useMemo(
    () => [
      {
        value: ThemeMode.light,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sun size={16} />
            <span>{t('settings.theme.light')}</span>
          </div>
        )
      },
      {
        value: ThemeMode.dark,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Moon size={16} />
            <span>{t('settings.theme.dark')}</span>
          </div>
        )
      },
      {
        value: ThemeMode.system,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Monitor size={16} />
            <span>{t('settings.theme.system')}</span>
          </div>
        )
      }
    ],
    [t]
  )

  useEffect(() => {
    // 初始化获取所有系统字体
    window.api.getSystemFonts().then((fonts: string[]) => {
      setFontList(fonts)
    })

    // 初始化获取当前缩放值
    window.api.handleZoomFactor(0).then((factor) => {
      setCurrentZoom(factor)
    })

    const handleResize = () => {
      window.api.handleZoomFactor(0).then((factor) => {
        setCurrentZoom(factor)
      })
    }
    // 添加resize事件监听
    window.addEventListener('resize', handleResize)

    // 清理事件监听，防止内存泄漏
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleZoomFactor = async (delta: number, reset: boolean = false) => {
    const zoomFactor = await window.api.handleZoomFactor(delta, reset)
    setCurrentZoom(zoomFactor)
  }

  const handleUserFontChange = useCallback(
    (value: string) => {
      setUserTheme({
        ...userTheme,
        userFontFamily: value
      })
    },
    [setUserTheme, userTheme]
  )

  const handleUserCodeFontChange = useCallback(
    (value: string) => {
      setUserTheme({
        ...userTheme,
        userCodeFontFamily: value
      })
    },
    [setUserTheme, userTheme]
  )

  const assistantIconTypeOptions = useMemo(
    () => [
      { value: 'model', label: t('settings.assistant.icon.type.model') },
      { value: 'emoji', label: t('settings.assistant.icon.type.emoji') },
      { value: 'none', label: t('settings.assistant.icon.type.none') }
    ],
    [t]
  )

  const renderFontOption = useCallback(
    (font: string) => (
      <Tooltip title={font} placement="left" mouseEnterDelay={0.5}>
        <div
          className="truncate"
          style={{
            fontFamily: font
          }}>
          {font}
        </div>
      </Tooltip>
    ),
    []
  )

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.display.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.theme.title')}</SettingRowTitle>
          <Segmented value={settedTheme} shape="round" onChange={setTheme} options={themeOptions} />
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.theme.color_primary')}</SettingRowTitle>
          <HStack gap="12px" alignItems="center">
            <HStack gap="12px">
              {THEME_COLOR_PRESETS.map((color) => (
                <ColorCircleWrapper key={color}>
                  <ColorCircle
                    color={color}
                    isActive={userTheme.colorPrimary === color}
                    onClick={() => handleColorPrimaryChange(color)}
                  />
                </ColorCircleWrapper>
              ))}
            </HStack>
            <ColorPicker
              style={{ fontFamily: 'inherit' }}
              className="color-picker"
              value={userTheme.colorPrimary}
              onChange={(color) => handleColorPrimaryChange(color.toHexString())}
              showText
              size="small"
              presets={[
                {
                  label: 'Presets',
                  colors: THEME_COLOR_PRESETS
                }
              ]}
            />
          </HStack>
        </SettingRow>
        {isMac && (
          <>
            <SettingDivider />
            <SettingRow>
              <SettingRowTitle>{t('settings.theme.window.style.transparent')}</SettingRowTitle>
              <Switch checked={windowStyle === 'transparent'} onChange={handleWindowStyleChange} />
            </SettingRow>
          </>
        )}
      </SettingGroup>
      {/* 主题与壁纸预设（合并） */}
      <SettingGroup theme={theme}>
        <SettingTitle style={{ justifyContent: 'flex-start', gap: 5 }}>
          {t('settings.display.presets.title', '预设主题')} <TextBadge text="New" />
        </SettingTitle>
        <SettingDivider />
        <PresetSummaryContainer>
          <PresetSummaryRow>
            <PresetSummaryItem>
              <PresetIcon>
                <Palette size={16} />
              </PresetIcon>
              <PresetInfo>
                <PresetLabel>{t('settings.theme.presets.title', '主题预设')}</PresetLabel>
                <PresetValue>
                  {activeThemePresetId
                    ? t(`settings.theme.preset.${activeThemePresetId.replace(/-/g, '_')}.name`, activeThemePresetId)
                    : t('settings.theme.presets.none', '自定义颜色')}
                </PresetValue>
              </PresetInfo>
            </PresetSummaryItem>
            <PresetSummaryItem>
              <PresetIcon>
                <Image size={16} />
              </PresetIcon>
              <PresetInfo>
                <PresetLabel>{t('settings.wallpaper.presets.title', '壁纸预设')}</PresetLabel>
                <PresetValue>
                  {activeWallpaperPresetId
                    ? t(`wallpaper.preset.${activeWallpaperPresetId.replace('preset-', '').replace(/-/g, '_')}`, activeWallpaperPresetId)
                    : isWallpaperEnabled
                      ? t('settings.wallpaper.custom', '自定义壁纸')
                      : t('settings.wallpaper.presets.none', '未启用')}
                </PresetValue>
              </PresetInfo>
            </PresetSummaryItem>
          </PresetSummaryRow>
          <Button type="primary" icon={<Settings2 size={14} />} onClick={() => setPresetModalOpen(true)}>
            {t('settings.display.presets.manage', '管理预设')}
          </Button>
        </PresetSummaryContainer>
      </SettingGroup>
      {/* 壁纸高级设置（仅在壁纸启用时显示详细选项） */}
      <SettingGroup theme={theme}>
        <SettingTitle style={{ justifyContent: 'flex-start', gap: 5 }}>
          {t('settings.wallpaper.advanced.title', '壁纸高级设置')}
        </SettingTitle>
        <SettingDivider />
        <WallpaperSettingsComponent />
      </SettingGroup>
      {/* 预设选择模态框 */}
      <UnifiedPresetModal open={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
      <SettingGroup theme={theme}>
        <SettingTitle style={{ justifyContent: 'flex-start', gap: 5 }}>
          {t('settings.display.navbar.title')} <TextBadge text="New" />
        </SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.display.navbar.position.label')}</SettingRowTitle>
          <Segmented
            value={navbarPosition}
            shape="round"
            onChange={setNavbarPosition}
            options={[
              { label: t('settings.display.navbar.position.left'), value: 'left' },
              { label: t('settings.display.navbar.position.top'), value: 'top' }
            ]}
          />
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.display.zoom.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.zoom.title')}</SettingRowTitle>
          <ZoomButtonGroup>
            <Button onClick={() => handleZoomFactor(-0.1)} icon={<Minus size="14" />} color="default" variant="text" />
            <ZoomValue>{Math.round(currentZoom * 100)}%</ZoomValue>
            <Button onClick={() => handleZoomFactor(0.1)} icon={<Plus size="14" />} color="default" variant="text" />
            <Button
              onClick={() => handleZoomFactor(0, true)}
              style={{ marginLeft: 8 }}
              icon={<ResetIcon size="14" />}
              color="default"
              variant="text"
            />
          </ZoomButtonGroup>
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <SettingTitle style={{ justifyContent: 'flex-start', gap: 5 }}>
          {t('settings.display.font.title')} <TextBadge text="New" />
        </SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.display.font.global')}</SettingRowTitle>
          <SelectRow>
            <Select
              style={{ width: 280 }}
              placeholder={t('settings.display.font.select')}
              options={[
                {
                  label: (
                    <span style={{ fontFamily: 'Ubuntu, -apple-system, system-ui, Arial, sans-serif' }}>
                      {t('settings.display.font.default')}
                    </span>
                  ),
                  value: ''
                },
                ...fontList.map((font) => ({ label: renderFontOption(font), value: font }))
              ]}
              value={userTheme.userFontFamily || ''}
              onChange={(font) => handleUserFontChange(font)}
              showSearch
              getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
            />
            <Button
              onClick={() => handleUserFontChange('')}
              style={{ marginLeft: 8 }}
              icon={<ResetIcon size="14" />}
              color="default"
              variant="text"
            />
          </SelectRow>
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.display.font.code')}</SettingRowTitle>
          <SelectRow>
            <Select
              style={{ width: 280 }}
              placeholder={t('settings.display.font.select')}
              options={[
                {
                  label: (
                    <span style={{ fontFamily: 'Ubuntu, -apple-system, system-ui, Arial, sans-serif' }}>
                      {t('settings.display.font.default')}
                    </span>
                  ),
                  value: ''
                },
                ...fontList.map((font) => ({ label: renderFontOption(font), value: font }))
              ]}
              value={userTheme.userCodeFontFamily || ''}
              onChange={(font) => handleUserCodeFontChange(font)}
              showSearch
              getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
            />
            <Button
              onClick={() => handleUserCodeFontChange('')}
              style={{ marginLeft: 8 }}
              icon={<ResetIcon size="14" />}
              color="default"
              variant="text"
            />
          </SelectRow>
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.display.topic.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.topic.position.label')}</SettingRowTitle>
          <Segmented
            value={topicPosition || 'right'}
            shape="round"
            onChange={setTopicPosition}
            options={[
              { value: 'left', label: t('settings.topic.position.left') },
              { value: 'right', label: t('settings.topic.position.right') }
            ]}
          />
        </SettingRow>
        <SettingDivider />
        {topicPosition === 'left' && (
          <>
            <SettingRow>
              <SettingRowTitle>{t('settings.advanced.auto_switch_to_topics')}</SettingRowTitle>
              <Switch
                checked={clickAssistantToShowTopic}
                onChange={(checked) => dispatch(setClickAssistantToShowTopic(checked))}
              />
            </SettingRow>
            <SettingDivider />
          </>
        )}
        <SettingRow>
          <SettingRowTitle>{t('settings.topic.show.time')}</SettingRowTitle>
          <Switch checked={showTopicTime} onChange={(checked) => dispatch(setShowTopicTime(checked))} />
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.topic.pin_to_top')}</SettingRowTitle>
          <Switch checked={pinTopicsToTop} onChange={(checked) => dispatch(setPinTopicsToTop(checked))} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.display.assistant.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.assistant.icon.type.label')}</SettingRowTitle>
          <Segmented
            value={assistantIconType}
            shape="round"
            onChange={(value) => dispatch(setAssistantIconType(value as AssistantIconType))}
            options={assistantIconTypeOptions}
          />
        </SettingRow>
      </SettingGroup>
      {navbarPosition === 'left' && (
        <SettingGroup theme={theme}>
          <SettingTitle
            style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('settings.display.sidebar.title')}</span>
            <ResetButtonWrapper>
              <Button onClick={handleReset}>{t('common.reset')}</Button>
            </ResetButtonWrapper>
          </SettingTitle>
          <SettingDivider />
          <SidebarIconsManager
            visibleIcons={visibleIcons}
            disabledIcons={disabledIcons}
            setVisibleIcons={setVisibleIcons}
            setDisabledIcons={setDisabledIcons}
          />
        </SettingGroup>
      )}
      <SettingGroup theme={theme}>
        <SettingTitle>
          {t('settings.display.custom.css.label')}
          <TitleExtra onClick={() => window.api.openWebsite('https://cherrycss.com/')}>
            {t('settings.display.custom.css.cherrycss')}
          </TitleExtra>
        </SettingTitle>
        <SettingDivider />
        <CodeEditor
          value={customCss}
          language="css"
          placeholder={t('settings.display.custom.css.placeholder')}
          onChange={(value) => dispatch(setCustomCss(value))}
          height="60vh"
          expanded={false}
          wrapped
          options={{
            autocompletion: true,
            lineNumbers: true,
            foldGutter: true,
            keymap: true
          }}
          style={{
            outline: '0.5px solid var(--color-border)',
            borderRadius: '5px'
          }}
        />
      </SettingGroup>
    </SettingContainer>
  )
}

const TitleExtra = styled.div`
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  opacity: 0.7;
`
const ResetButtonWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`
const ZoomButtonGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 210px;
`
const ZoomValue = styled.span`
  width: 40px;
  text-align: center;
  margin: 0 5px;
`

const SelectRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 380px;
`

// ==================== 预设摘要样式 ====================

const PresetSummaryContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const PresetSummaryRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`

const PresetSummaryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 200px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 10px;
  border: 1px solid var(--color-border);
`

const PresetIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-primary-bg);
  border-radius: 8px;
  color: var(--color-primary);
`

const PresetInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const PresetLabel = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const PresetValue = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

export default DisplaySettings
