/**
 * 主题预设 Hook
 * Theme Preset Hook
 *
 * 用于应用和管理主题预设
 */

import { BUILT_IN_THEME_PRESETS, getThemeColors, getThemePresetById } from '@renderer/config/themePresets'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addCustomThemePreset, removeCustomThemePreset, setActiveThemePreset } from '@renderer/store/settings'
import type { ThemeColors, ThemePreset } from '@renderer/types/theme'
import { BORDER_RADIUS_VALUES, SHADOW_VALUES } from '@renderer/types/theme'
import { useCallback, useEffect, useMemo } from 'react'

/**
 * 将主题颜色应用到 CSS 变量
 * 同时更新 --theme-* 和 Cherry 原有的 --color-* 变量，确保全局生效
 * 使用 body 的 inline style 以获得更高优先级
 */
export function applyThemeColors(colors: ThemeColors, effects?: ThemePreset['effects']) {
  const root = document.documentElement
  const body = document.body

  // 辅助函数：同时设置到 root 和 body
  const setVar = (name: string, value: string) => {
    root.style.setProperty(name, value)
    body.style.setProperty(name, value)
  }

  // ========== 主色调 ==========
  setVar('--theme-color-primary', colors.colorPrimary)
  setVar('--theme-color-primary-hover', colors.colorPrimaryHover)
  setVar('--theme-color-primary-active', colors.colorPrimaryActive)
  setVar('--theme-color-primary-bg', colors.colorPrimaryBg)
  setVar('--color-primary', colors.colorPrimary)
  setVar('--color-primary-soft', colors.colorPrimaryHover)
  setVar('--color-primary-mute', colors.colorPrimaryBg)
  setVar('--ant-color-primary', colors.colorPrimary)
  setVar('--ant-color-primary-hover', colors.colorPrimaryHover)
  setVar('--ant-color-primary-active', colors.colorPrimaryActive)
  setVar('--ant-color-primary-bg', colors.colorPrimaryBg)

  // ========== 背景色 ==========
  setVar('--theme-bg-base', colors.colorBgBase)
  setVar('--theme-bg-container', colors.colorBgContainer)
  setVar('--theme-bg-elevated', colors.colorBgElevated)
  setVar('--theme-bg-layout', colors.colorBgLayout)
  setVar('--theme-bg-spotlight', colors.colorBgSpotlight)
  setVar('--color-background', colors.colorBgBase)
  setVar('--color-background-soft', colors.colorBgElevated)
  setVar('--color-background-mute', colors.colorBgSpotlight)
  setVar('--color-group-background', colors.colorBgContainer)
  setVar('--modal-background', colors.colorBgElevated)
  setVar('--navbar-background', colors.colorBgLayout)
  setVar('--navbar-background-mac', colors.colorBgLayout)
  setVar('--ant-color-bg-base', colors.colorBgBase)
  setVar('--ant-color-bg-container', colors.colorBgContainer)
  setVar('--ant-color-bg-elevated', colors.colorBgElevated)
  setVar('--ant-color-bg-layout', colors.colorBgLayout)
  setVar('--ant-color-bg-spotlight', colors.colorBgSpotlight)
  // Tailwind 变量
  setVar('--background', colors.colorBgBase)

  // ========== 文字色 ==========
  setVar('--theme-text-primary', colors.colorText)
  setVar('--theme-text-secondary', colors.colorTextSecondary)
  setVar('--theme-text-tertiary', colors.colorTextTertiary)
  setVar('--theme-text-quaternary', colors.colorTextQuaternary)
  setVar('--color-text', colors.colorText)
  setVar('--color-text-1', colors.colorText)
  setVar('--color-text-2', colors.colorTextSecondary)
  setVar('--color-text-3', colors.colorTextTertiary)
  setVar('--color-text-secondary', colors.colorTextSecondary)
  setVar('--ant-color-text', colors.colorText)
  setVar('--ant-color-text-secondary', colors.colorTextSecondary)
  setVar('--ant-color-text-tertiary', colors.colorTextTertiary)
  setVar('--ant-color-text-quaternary', colors.colorTextQuaternary)
  // Tailwind 变量
  setVar('--foreground', colors.colorText)

  // ========== 边框色 ==========
  setVar('--theme-border', colors.colorBorder)
  setVar('--theme-border-secondary', colors.colorBorderSecondary)
  setVar('--color-border', colors.colorBorder)
  setVar('--color-border-soft', colors.colorBorderSecondary)
  setVar('--color-frame-border', colors.colorBorder)
  setVar('--ant-color-border', colors.colorBorder)
  setVar('--ant-color-border-secondary', colors.colorBorderSecondary)
  // Tailwind 变量
  setVar('--border', colors.colorBorder)

  // ========== 状态色 ==========
  setVar('--theme-color-success', colors.colorSuccess)
  setVar('--theme-color-warning', colors.colorWarning)
  setVar('--theme-color-error', colors.colorError)
  setVar('--theme-color-info', colors.colorInfo)
  setVar('--color-error', colors.colorError)
  setVar('--color-status-success', colors.colorSuccess)
  setVar('--color-status-error', colors.colorError)
  setVar('--color-status-warning', colors.colorWarning)
  setVar('--ant-color-success', colors.colorSuccess)
  setVar('--ant-color-warning', colors.colorWarning)
  setVar('--ant-color-error', colors.colorError)
  setVar('--ant-color-info', colors.colorInfo)

  // ========== 链接色和高亮色 ==========
  setVar('--color-link', colors.colorLink)
  setVar('--ant-color-link', colors.colorLink)
  if (colors.colorHighlight) {
    setVar('--color-background-highlight', colors.colorHighlight)
  }

  // ========== 效果 ==========
  if (effects) {
    // 圆角
    const borderRadius = BORDER_RADIUS_VALUES[effects.borderRadius]
    setVar('--list-item-border-radius', borderRadius)
    setVar('--ant-border-radius', borderRadius)
    setVar('--ant-border-radius-lg', borderRadius)
    setVar('--radius', borderRadius)

    // 阴影强度
    const shadow = SHADOW_VALUES[effects.shadowIntensity]
    setVar('--theme-shadow-default', shadow)
    setVar('--ant-box-shadow', shadow)

    // 玻璃效果
    if (effects.glassEffect) {
      body.classList.add('theme-glass-enabled')
      setVar('--inner-glow-opacity', '0.4')
    } else {
      body.classList.remove('theme-glass-enabled')
      root.style.removeProperty('--inner-glow-opacity')
      body.style.removeProperty('--inner-glow-opacity')
    }

    // 渐变强调
    if (effects.gradientAccents) {
      body.classList.add('theme-gradient-enabled')
    } else {
      body.classList.remove('theme-gradient-enabled')
    }
  }

  // 标记主题预设已应用
  body.classList.add('theme-preset-active')
}

/**
 * 清除主题预设的 CSS 变量
 * 移除所有由主题预设设置的变量，恢复到默认状态
 */
export function clearThemeColors() {
  const root = document.documentElement
  const body = document.body

  // 所有需要清除的变量
  const properties = [
    // 主题变量
    '--theme-color-primary',
    '--theme-color-primary-hover',
    '--theme-color-primary-active',
    '--theme-color-primary-bg',
    '--theme-bg-base',
    '--theme-bg-container',
    '--theme-bg-elevated',
    '--theme-bg-layout',
    '--theme-bg-spotlight',
    '--theme-text-primary',
    '--theme-text-secondary',
    '--theme-text-tertiary',
    '--theme-text-quaternary',
    '--theme-border',
    '--theme-border-secondary',
    '--theme-color-success',
    '--theme-color-warning',
    '--theme-color-error',
    '--theme-color-info',
    '--theme-shadow-default',
    // Cherry 原有变量
    '--color-primary',
    '--color-primary-soft',
    '--color-primary-mute',
    '--color-background',
    '--color-background-soft',
    '--color-background-mute',
    '--color-group-background',
    '--modal-background',
    '--navbar-background',
    '--navbar-background-mac',
    '--color-text',
    '--color-text-1',
    '--color-text-2',
    '--color-text-3',
    '--color-text-secondary',
    '--color-border',
    '--color-border-soft',
    '--color-frame-border',
    '--color-error',
    '--color-status-success',
    '--color-status-error',
    '--color-status-warning',
    '--color-link',
    '--color-background-highlight',
    '--inner-glow-opacity',
    // Ant Design 变量
    '--ant-color-primary',
    '--ant-color-primary-hover',
    '--ant-color-primary-active',
    '--ant-color-primary-bg',
    '--ant-color-bg-base',
    '--ant-color-bg-container',
    '--ant-color-bg-elevated',
    '--ant-color-bg-layout',
    '--ant-color-bg-spotlight',
    '--ant-color-text',
    '--ant-color-text-secondary',
    '--ant-color-text-tertiary',
    '--ant-color-text-quaternary',
    '--ant-color-border',
    '--ant-color-border-secondary',
    '--ant-color-success',
    '--ant-color-warning',
    '--ant-color-error',
    '--ant-color-info',
    '--ant-color-link',
    '--ant-border-radius',
    '--ant-border-radius-lg',
    '--ant-box-shadow',
    '--list-item-border-radius',
    // Tailwind 变量
    '--background',
    '--foreground',
    '--border',
    '--radius'
  ]

  // 从 root 和 body 上都移除变量
  properties.forEach((prop) => {
    root.style.removeProperty(prop)
    body.style.removeProperty(prop)
  })
  body.classList.remove('theme-glass-enabled', 'theme-gradient-enabled', 'theme-preset-active')
}

/**
 * 主题预设 Hook
 */
export function useThemePreset() {
  const dispatch = useAppDispatch()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const activeThemePresetId = useAppSelector((state) => state.settings.activeThemePresetId)
  const customThemePresets = useAppSelector((state) => state.settings.customThemePresets) || []

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

  // 设置激活的主题预设
  const setPreset = useCallback(
    (presetId: string | null) => {
      dispatch(setActiveThemePreset(presetId))
    },
    [dispatch]
  )

  // 添加自定义主题
  const addPreset = useCallback(
    (preset: ThemePreset) => {
      dispatch(addCustomThemePreset(preset))
    },
    [dispatch]
  )

  // 删除自定义主题
  const deletePreset = useCallback(
    (presetId: string) => {
      // 如果删除的是当前激活的主题，先清除激活状态
      if (activeThemePresetId === presetId) {
        dispatch(setActiveThemePreset(null))
      }
      dispatch(removeCustomThemePreset(presetId))
    },
    [dispatch, activeThemePresetId]
  )

  // 预览主题（临时应用，不保存）
  const previewPreset = useCallback(
    (presetId: string | null) => {
      if (presetId) {
        const preset = allThemePresets.find((p) => p.id === presetId)
        if (preset) {
          const colors = getThemeColors(preset, isDark)
          applyThemeColors(colors, preset.effects)
        }
      } else if (activePreset) {
        // 恢复当前激活的主题
        const colors = getThemeColors(activePreset, isDark)
        applyThemeColors(colors, activePreset.effects)
      } else {
        clearThemeColors()
      }
    },
    [allThemePresets, activePreset, isDark]
  )

  return {
    // 状态
    activePresetId: activeThemePresetId,
    activePreset,
    allThemePresets,
    builtInPresets: BUILT_IN_THEME_PRESETS,
    customPresets: customThemePresets,

    // 操作
    setPreset,
    addPreset,
    deletePreset,
    previewPreset,

    // 工具函数
    getPresetById: getThemePresetById,
    getThemeColors
  }
}

export default useThemePreset
