/**
 * 壁纸 Hook
 * Wallpaper Hook
 *
 * 用于应用和管理壁纸设置
 */

import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setWallpaper } from '@renderer/store/settings'
import type { WallpaperDisplayMode, WallpaperSettings } from '@renderer/types/wallpaper'
import { BUILT_IN_WALLPAPERS, DEFAULT_WALLPAPER_SETTINGS } from '@renderer/types/wallpaper'
import { useCallback, useEffect } from 'react'

const logger = loggerService.withContext('Wallpaper')

// 注意：壁纸渲染现在通过 GlobalStyleProvider 在 body 上应用 CSS 变量实现
// 效果控制通过 CSS class 实现（sidebar-glass-enabled, chat-bubble-decoration-enabled 等）

/**
 * 应用壁纸设置
 * 只负责管理 body 的 CSS class，实际渲染由 GlobalStyleProvider 和 CSS 变量处理
 */
function applyWallpaperSettings(settings: WallpaperSettings) {
  if (!settings.enabled || settings.source === 'none') {
    // 禁用壁纸 - 移除相关 class
    document.body.classList.remove('wallpaper-enabled')
    document.body.classList.remove('wallpaper-exclude-workflow')
    return
  }

  // 启用壁纸 - 添加 class 让 body 背景透明
  document.body.classList.add('wallpaper-enabled')

  // 工作流排除
  if (settings.excludeWorkflow) {
    document.body.classList.add('wallpaper-exclude-workflow')
  } else {
    document.body.classList.remove('wallpaper-exclude-workflow')
  }
}

/**
 * 壁纸 Hook
 */
export function useWallpaper() {
  const dispatch = useAppDispatch()
  const wallpaperSettings = useAppSelector((state) => state.settings.wallpaper) || DEFAULT_WALLPAPER_SETTINGS

  // 应用壁纸设置
  useEffect(() => {
    if (wallpaperSettings) {
      applyWallpaperSettings(wallpaperSettings)
    }
  }, [wallpaperSettings])

  // 更新壁纸设置
  const updateWallpaper = useCallback(
    (settings: Partial<WallpaperSettings>) => {
      dispatch(setWallpaper(settings))
    },
    [dispatch]
  )

  // 启用/禁用壁纸
  const toggleWallpaper = useCallback(
    (enabled: boolean) => {
      if (enabled && wallpaperSettings.source === 'none') {
        // 如果启用壁纸但没有选择来源，自动选择第一个内置壁纸
        // 同时重置为默认的显示参数
        const firstBuiltin = BUILT_IN_WALLPAPERS[0]
        if (firstBuiltin) {
          dispatch(
            setWallpaper({
              enabled: true,
              source: 'builtin',
              builtInId: firstBuiltin.id,
              // 确保使用合理的默认值
              opacity: 100,
              brightness: 100,
              blur: 0
            })
          )
          return
        }
      }
      dispatch(setWallpaper({ enabled }))
    },
    [dispatch, wallpaperSettings.source]
  )

  // 设置壁纸来源
  const setWallpaperSource = useCallback(
    (source: WallpaperSettings['source'], value?: string) => {
      const update: Partial<WallpaperSettings> = { source, enabled: source !== 'none' }

      // 如果是新选择壁纸来源，重置为合理的默认参数
      if (source !== 'none' && source !== wallpaperSettings.source) {
        update.opacity = 100
        update.brightness = 100
        update.blur = 0
      }

      switch (source) {
        case 'local':
          update.localPath = value
          break
        case 'url':
          update.url = value
          break
        case 'builtin':
          update.builtInId = value
          break
      }

      dispatch(setWallpaper(update))
    },
    [dispatch, wallpaperSettings.source]
  )

  // 重置壁纸参数为默认值
  const resetWallpaperParams = useCallback(() => {
    dispatch(
      setWallpaper({
        opacity: 100,
        brightness: 100,
        blur: 0,
        displayMode: 'cover'
      })
    )
  }, [dispatch])

  // 设置显示模式
  const setDisplayMode = useCallback(
    (mode: WallpaperDisplayMode) => {
      dispatch(setWallpaper({ displayMode: mode }))
    },
    [dispatch]
  )

  // 设置模糊度
  const setBlur = useCallback(
    (blur: number) => {
      dispatch(setWallpaper({ blur: Math.max(0, Math.min(20, blur)) }))
    },
    [dispatch]
  )

  // 设置透明度
  const setOpacity = useCallback(
    (opacity: number) => {
      dispatch(setWallpaper({ opacity: Math.max(0, Math.min(100, opacity)) }))
    },
    [dispatch]
  )

  // 设置亮度
  const setBrightness = useCallback(
    (brightness: number) => {
      dispatch(setWallpaper({ brightness: Math.max(50, Math.min(150, brightness)) }))
    },
    [dispatch]
  )

  // 设置是否排除工作流
  const setExcludeWorkflow = useCallback(
    (exclude: boolean) => {
      dispatch(setWallpaper({ excludeWorkflow: exclude }))
    },
    [dispatch]
  )

  // 选择本地文件
  const selectLocalFile = useCallback(async () => {
    try {
      const result = await window.api.file.select({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
      })
      if (result && result.length > 0) {
        // result 返回的是 FileType 数组，需要获取 path
        const filePath = typeof result[0] === 'string' ? result[0] : result[0].path
        if (filePath) {
          setWallpaperSource('local', filePath)
          return filePath
        }
      }
    } catch (error) {
      logger.error('Failed to select wallpaper file:', error as Error)
    }
    return null
  }, [setWallpaperSource])

  // 预览壁纸（临时应用，不保存）
  const previewWallpaper = useCallback(
    (settings: Partial<WallpaperSettings>) => {
      const previewSettings = { ...wallpaperSettings, ...settings }
      applyWallpaperSettings(previewSettings)
    },
    [wallpaperSettings]
  )

  // 恢复当前设置
  const restoreWallpaper = useCallback(() => {
    applyWallpaperSettings(wallpaperSettings)
  }, [wallpaperSettings])

  return {
    // 状态
    settings: wallpaperSettings,
    isEnabled: wallpaperSettings.enabled,
    builtInWallpapers: BUILT_IN_WALLPAPERS,

    // 操作
    updateWallpaper,
    toggleWallpaper,
    setWallpaperSource,
    setDisplayMode,
    setBlur,
    setOpacity,
    setBrightness,
    setExcludeWorkflow,
    selectLocalFile,
    resetWallpaperParams,

    // 预览
    previewWallpaper,
    restoreWallpaper
  }
}

export default useWallpaper
