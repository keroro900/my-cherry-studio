/**
 * 全局壁纸组件
 * Global Wallpaper Component
 *
 * 作为全局背景层渲染，不影响主题系统
 * Renders as a global background layer without affecting the theme system
 */

import { loggerService } from '@logger'
import { useAppSelector } from '@renderer/store'
import type { WallpaperSettings } from '@renderer/types/wallpaper'
import {
  BUILT_IN_WALLPAPERS,
  DEFAULT_WALLPAPER_SETTINGS,
  WALLPAPER_REPEAT_VALUES,
  WALLPAPER_SIZE_VALUES
} from '@renderer/types/wallpaper'
import type { CSSProperties, FC } from 'react'
import { useMemo } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('GlobalWallpaper')

/**
 * 获取壁纸的 CSS background 值
 */
function getWallpaperBackground(settings: WallpaperSettings): string {
  if (!settings.enabled || settings.source === 'none') {
    return 'none'
  }

  switch (settings.source) {
    case 'local':
      if (settings.localPath) {
        // 本地文件需要使用 file:// 协议
        return `url("file://${settings.localPath.replace(/\\/g, '/')}")`
      }
      return 'none'

    case 'url':
      if (settings.url) {
        return `url("${settings.url}")`
      }
      return 'none'

    case 'builtin':
      if (settings.builtInId) {
        const builtin = BUILT_IN_WALLPAPERS.find((w) => w.id === settings.builtInId)
        if (builtin) {
          // 内置壁纸可能是渐变或图片路径
          if (builtin.fullPath.startsWith('linear-gradient') || builtin.fullPath.startsWith('radial-gradient')) {
            return builtin.fullPath
          }
          return `url("${builtin.fullPath}")`
        }
      }
      return 'none'

    default:
      return 'none'
  }
}

/**
 * 全局壁纸组件
 * 渲染在应用最底层，作为全局背景
 */
export const GlobalWallpaper: FC = () => {
  const wallpaperSettings = useAppSelector((state) => state.settings.wallpaper) || DEFAULT_WALLPAPER_SETTINGS

  // 计算壁纸样式
  const wallpaperStyle = useMemo((): CSSProperties => {
    if (!wallpaperSettings.enabled || wallpaperSettings.source === 'none') {
      logger.debug('Disabled or no source')
      return { display: 'none' }
    }

    const backgroundValue = getWallpaperBackground(wallpaperSettings)
    logger.debug('backgroundValue:', backgroundValue)
    if (backgroundValue === 'none') {
      return { display: 'none' }
    }

    // 判断是渐变还是图片
    const isGradient = backgroundValue.startsWith('linear-gradient') || backgroundValue.startsWith('radial-gradient')

    if (isGradient) {
      // 渐变壁纸：只使用 backgroundImage
      const style = {
        backgroundImage: backgroundValue,
        filter: `blur(${wallpaperSettings.blur}px) brightness(${wallpaperSettings.brightness}%)`,
        opacity: wallpaperSettings.opacity / 100
      }
      logger.debug('Gradient style:', style)
      return style
    }

    // 图片壁纸：使用分开的属性，避免与简写属性冲突
    return {
      backgroundImage: backgroundValue,
      backgroundSize: WALLPAPER_SIZE_VALUES[wallpaperSettings.displayMode],
      backgroundPosition: 'center',
      backgroundRepeat: WALLPAPER_REPEAT_VALUES[wallpaperSettings.displayMode],
      filter: `blur(${wallpaperSettings.blur}px) brightness(${wallpaperSettings.brightness}%)`,
      opacity: wallpaperSettings.opacity / 100
    }
  }, [wallpaperSettings])

  // 如果壁纸未启用，不渲染任何内容
  if (!wallpaperSettings.enabled || wallpaperSettings.source === 'none') {
    return null
  }

  return <WallpaperLayer style={wallpaperStyle} />
}

/**
 * 壁纸层样式
 * 使用 fixed 定位覆盖整个视口
 * 注意：z-index: -1 在某些情况下不起作用，改用 z-index: 0 并确保在 DOM 中最先渲染
 * 重要：使用 flex: 0 0 0 确保不参与 flex 布局计算
 */
const WallpaperLayer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease;
  /* 确保不参与 flex 布局 */
  flex: 0 0 0;
  min-width: 0;
  min-height: 0;
`

export default GlobalWallpaper
