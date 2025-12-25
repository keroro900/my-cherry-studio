/**
 * 壁纸设置类型定义
 * Wallpaper Settings Type Definitions
 */

/**
 * 壁纸来源类型
 */
export type WallpaperSource = 'none' | 'local' | 'url' | 'builtin'

/**
 * 壁纸显示模式
 */
export type WallpaperDisplayMode = 'cover' | 'contain' | 'stretch' | 'tile' | 'center'

/**
 * 内置壁纸分类
 */
export type BuiltInWallpaperCategory = 'anime' | 'nature' | 'abstract' | 'gradient'

/**
 * 壁纸设置
 */
export interface WallpaperSettings {
  /** 是否启用壁纸 */
  enabled: boolean

  /** 壁纸来源 */
  source: WallpaperSource

  /** URL 地址（source 为 'url' 时使用） */
  url?: string

  /** 本地文件路径（source 为 'local' 时使用） */
  localPath?: string

  /** 内置壁纸 ID（source 为 'builtin' 时使用） */
  builtInId?: string

  /** 显示模式 */
  displayMode: WallpaperDisplayMode

  /** 模糊度 (0-20 px) */
  blur: number

  /** 透明度 (0-100 %) */
  opacity: number

  /** 亮度 (50-150 %) */
  brightness: number

  /** 是否排除工作流模块 */
  excludeWorkflow: boolean
}

/**
 * 内置壁纸定义
 */
export interface BuiltInWallpaper {
  id: string
  name: string // i18n key
  thumbnail: string
  fullPath: string
  category: BuiltInWallpaperCategory
}

/**
 * 壁纸显示模式对应的 CSS background-size 值
 */
export const WALLPAPER_SIZE_VALUES: Record<WallpaperDisplayMode, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: '100% 100%',
  tile: 'auto',
  center: 'auto'
}

/**
 * 壁纸显示模式对应的 CSS background-repeat 值
 */
export const WALLPAPER_REPEAT_VALUES: Record<WallpaperDisplayMode, string> = {
  cover: 'no-repeat',
  contain: 'no-repeat',
  stretch: 'no-repeat',
  tile: 'repeat',
  center: 'no-repeat'
}

/**
 * 默认壁纸设置
 */
export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  enabled: false,
  source: 'none',
  displayMode: 'cover',
  blur: 0,
  opacity: 100,
  brightness: 100,
  excludeWorkflow: true
}

/**
 * 内置壁纸列表（占位，实际图片需要后续添加）
 */
export const BUILT_IN_WALLPAPERS: BuiltInWallpaper[] = [
  // 渐变壁纸（纯 CSS 渐变，无需图片文件）
  {
    id: 'gradient-sakura',
    name: 'wallpaper.builtin.gradient_sakura',
    thumbnail: 'linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 50%, #FFE4E1 100%)',
    fullPath: 'linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 50%, #FFE4E1 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-sky',
    name: 'wallpaper.builtin.gradient_sky',
    thumbnail: 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 50%, #E0FFFF 100%)',
    fullPath: 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 50%, #E0FFFF 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-lavender',
    name: 'wallpaper.builtin.gradient_lavender',
    thumbnail: 'linear-gradient(135deg, #E6E6FA 0%, #DDA0DD 50%, #DA70D6 100%)',
    fullPath: 'linear-gradient(135deg, #E6E6FA 0%, #DDA0DD 50%, #DA70D6 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-mint',
    name: 'wallpaper.builtin.gradient_mint',
    thumbnail: 'linear-gradient(135deg, #98FB98 0%, #90EE90 50%, #00FA9A 100%)',
    fullPath: 'linear-gradient(135deg, #98FB98 0%, #90EE90 50%, #00FA9A 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-sunset',
    name: 'wallpaper.builtin.gradient_sunset',
    thumbnail: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)',
    fullPath: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-neon',
    name: 'wallpaper.builtin.gradient_neon',
    thumbnail: 'linear-gradient(135deg, #0D0D1A 0%, #1A1A2E 50%, #2D2D4A 100%)',
    fullPath: 'linear-gradient(135deg, #0D0D1A 0%, #1A1A2E 50%, #2D2D4A 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-ocean',
    name: 'wallpaper.builtin.gradient_ocean',
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fullPath: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    category: 'gradient'
  },
  {
    id: 'gradient-forest',
    name: 'wallpaper.builtin.gradient_forest',
    thumbnail: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
    fullPath: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
    category: 'gradient'
  }
]
