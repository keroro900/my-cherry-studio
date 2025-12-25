/**
 * 全局样式 Provider
 * Global Style Provider
 *
 * 在应用启动时应用主题预设和壁纸设置
 * Applies theme presets and wallpaper settings on app startup
 */

import { BUILT_IN_THEME_PRESETS, getThemeColors } from '@renderer/config/themePresets'
import { applyThemeColors, clearThemeColors } from '@renderer/hooks/useThemePreset'
import { useAppSelector } from '@renderer/store'
import type { WallpaperSettings } from '@renderer/types/wallpaper'
import { DEFAULT_WALLPAPER_SETTINGS } from '@renderer/types/wallpaper'
import type { PropsWithChildren } from 'react'
import { useEffect, useMemo } from 'react'

import { useTheme } from './ThemeProvider'

// applyThemeColors 和 clearThemeColors 从 useThemePreset 导入，避免代码重复

/**
 * 应用壁纸设置
 * 只负责管理 body 的 CSS class 和 CSS 变量，实际渲染由 GlobalWallpaper 组件处理
 */
function applyWallpaperSettings(settings: WallpaperSettings) {
  if (!settings.enabled || settings.source === 'none') {
    // 禁用壁纸 - 移除相关 class 和 CSS 变量
    document.body.classList.remove('wallpaper-enabled')
    document.body.classList.remove('wallpaper-exclude-workflow')
    document.documentElement.style.removeProperty('--wallpaper-bg-opacity')
    return
  }

  // 启用壁纸 - 添加 class 让 body 背景透明
  document.body.classList.add('wallpaper-enabled')

  // 设置组件背景透明度 CSS 变量
  // opacity 是壁纸图片的透明度(0-100)，组件背景透明度使用相反的逻辑
  // 壁纸越不透明(opacity 高)，组件背景应该越透明，让壁纸更可见
  // 计算公式: 组件透明度 = 1 - (壁纸透明度 * 0.5) / 100
  // 例如: 壁纸 100% -> 组件 0.5, 壁纸 50% -> 组件 0.75, 壁纸 0% -> 组件 1.0
  const bgOpacity = 1 - (settings.opacity * 0.5) / 100
  document.documentElement.style.setProperty('--wallpaper-bg-opacity', bgOpacity.toFixed(2))

  // 工作流排除
  if (settings.excludeWorkflow) {
    document.body.classList.add('wallpaper-exclude-workflow')
  } else {
    document.body.classList.remove('wallpaper-exclude-workflow')
  }
}

/**
 * 全局样式 Provider 组件
 */
export const GlobalStyleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 获取主题预设设置
  const activeThemePresetId = useAppSelector((state) => state.settings.activeThemePresetId)
  const customThemePresets = useAppSelector((state) => state.settings.customThemePresets) || []

  // 获取壁纸设置
  const wallpaperSettings = useAppSelector((state) => state.settings.wallpaper) || DEFAULT_WALLPAPER_SETTINGS

  // 合并内置和自定义主题
  const allThemePresets = useMemo(() => {
    return [...BUILT_IN_THEME_PRESETS, ...(customThemePresets || [])]
  }, [customThemePresets])

  // 当前激活的主题预设
  const activePreset = useMemo(() => {
    if (!activeThemePresetId) return null
    return allThemePresets.find((p) => p.id === activeThemePresetId) || null
  }, [activeThemePresetId, allThemePresets])

  // 应用主题预设
  useEffect(() => {
    if (activePreset) {
      const colors = getThemeColors(activePreset, isDark)
      applyThemeColors(colors, activePreset.effects)
    } else {
      clearThemeColors()
    }
  }, [activePreset, isDark])

  // 应用壁纸设置
  useEffect(() => {
    if (wallpaperSettings) {
      applyWallpaperSettings(wallpaperSettings)
    }
  }, [wallpaperSettings])

  return <>{children}</>
}

export default GlobalStyleProvider
