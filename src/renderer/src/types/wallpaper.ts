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

// ==================== 效果类型定义 ====================

/**
 * 侧边栏玻璃效果设置
 */
export interface SidebarGlassEffect {
  enabled: boolean
  startColor: string // rgba
  endColor: string // rgba
  tintColor: string // rgba
  blurAmount: number // px (0-20)
  saturation: number // 1.0-2.0
}

/**
 * 聊天气泡装饰效果设置
 */
export interface ChatBubbleEffect {
  enabled: boolean
  shadowEnabled: boolean
  accentLineEnabled: boolean
  accentLineColor: string // rgba
}

/**
 * 内容遮罩效果设置
 */
export interface ContentOverlayEffect {
  enabled: boolean
  startColor: string // rgba
  endColor: string // rgba
}

/**
 * 输入栏样式效果设置
 */
export interface InputBarEffect {
  enabled: boolean
  backgroundColor: string // rgba
  borderColor: string // rgba
  focusColor: string // rgba
}

/**
 * 代码块样式效果设置
 */
export interface CodeBlockEffect {
  enabled: boolean
  backgroundColor: string // rgba
  borderColor: string // rgba
}

/**
 * 壁纸效果集合
 */
export interface WallpaperEffects {
  sidebarGlass: SidebarGlassEffect
  chatBubble: ChatBubbleEffect
  contentOverlay: ContentOverlayEffect
  inputBar: InputBarEffect
  codeBlock: CodeBlockEffect
}

// ==================== 预设主题类型定义 ====================

/**
 * 壁纸预设主题
 */
export interface WallpaperPreset {
  id: string
  name: string // i18n key
  thumbnail: string // 预览图URL或渐变
  wallpaperUrl?: string // 壁纸图片URL
  wallpaperGradient?: string // 或CSS渐变
  effects: Partial<WallpaperEffects>
  themeMode?: 'light' | 'dark' | 'both'
}

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

  /** 效果设置 */
  effects: WallpaperEffects

  /** 当前使用的预设ID */
  activePresetId?: string
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

// ==================== 默认效果设置 ====================

/**
 * 默认侧边栏玻璃效果（深色模式）
 */
export const DEFAULT_SIDEBAR_GLASS_EFFECT_DARK: SidebarGlassEffect = {
  enabled: true,
  startColor: 'rgba(30, 30, 30, 0.65)',
  endColor: 'rgba(30, 30, 30, 0.35)',
  tintColor: 'rgba(70, 150, 230, 0.12)',
  blurAmount: 5,
  saturation: 1.2
}

/**
 * 默认侧边栏玻璃效果（亮色模式）
 */
export const DEFAULT_SIDEBAR_GLASS_EFFECT_LIGHT: SidebarGlassEffect = {
  enabled: true,
  startColor: 'rgba(255, 255, 255, 0.65)',
  endColor: 'rgba(255, 255, 255, 0.35)',
  tintColor: 'rgba(59, 130, 246, 0.18)',
  blurAmount: 5,
  saturation: 1.2
}

/**
 * 默认聊天气泡效果（深色模式）
 */
export const DEFAULT_CHAT_BUBBLE_EFFECT_DARK: ChatBubbleEffect = {
  enabled: true,
  shadowEnabled: true,
  accentLineEnabled: true,
  accentLineColor: 'rgba(70, 150, 230, 0.5)'
}

/**
 * 默认聊天气泡效果（亮色模式）
 */
export const DEFAULT_CHAT_BUBBLE_EFFECT_LIGHT: ChatBubbleEffect = {
  enabled: true,
  shadowEnabled: true,
  accentLineEnabled: true,
  accentLineColor: 'rgba(60, 130, 220, 0.5)'
}

/**
 * 默认内容遮罩效果（深色模式）
 */
export const DEFAULT_CONTENT_OVERLAY_EFFECT_DARK: ContentOverlayEffect = {
  enabled: true,
  startColor: 'rgba(10, 75, 122, 0.2)',
  endColor: 'rgba(10, 75, 122, 0.3)'
}

/**
 * 默认内容遮罩效果（亮色模式）
 */
export const DEFAULT_CONTENT_OVERLAY_EFFECT_LIGHT: ContentOverlayEffect = {
  enabled: true,
  startColor: 'rgba(240, 245, 245, 0.2)',
  endColor: 'rgba(220, 230, 230, 0.3)'
}

/**
 * 默认输入栏效果（深色模式）
 */
export const DEFAULT_INPUT_BAR_EFFECT_DARK: InputBarEffect = {
  enabled: true,
  backgroundColor: 'rgba(45, 48, 54, 0.65)',
  borderColor: 'rgba(70, 75, 82, 0.6)',
  focusColor: 'rgba(70, 150, 230, 0.9)'
}

/**
 * 默认输入栏效果（亮色模式）
 */
export const DEFAULT_INPUT_BAR_EFFECT_LIGHT: InputBarEffect = {
  enabled: true,
  backgroundColor: 'rgba(250, 250, 250, 0.65)',
  borderColor: 'rgba(200, 205, 210, 0.6)',
  focusColor: 'rgba(60, 130, 220, 0.9)'
}

/**
 * 默认代码块效果（深色模式）
 */
export const DEFAULT_CODE_BLOCK_EFFECT_DARK: CodeBlockEffect = {
  enabled: true,
  backgroundColor: 'rgba(40, 43, 50, 0.7)',
  borderColor: 'rgba(255, 255, 255, 0.1)'
}

/**
 * 默认代码块效果（亮色模式）
 */
export const DEFAULT_CODE_BLOCK_EFFECT_LIGHT: CodeBlockEffect = {
  enabled: true,
  backgroundColor: 'rgba(242, 245, 248, 0.7)',
  borderColor: 'rgba(0, 0, 0, 0.07)'
}

/**
 * 默认壁纸效果（深色模式）
 */
export const DEFAULT_WALLPAPER_EFFECTS_DARK: WallpaperEffects = {
  sidebarGlass: DEFAULT_SIDEBAR_GLASS_EFFECT_DARK,
  chatBubble: DEFAULT_CHAT_BUBBLE_EFFECT_DARK,
  contentOverlay: DEFAULT_CONTENT_OVERLAY_EFFECT_DARK,
  inputBar: DEFAULT_INPUT_BAR_EFFECT_DARK,
  codeBlock: DEFAULT_CODE_BLOCK_EFFECT_DARK
}

/**
 * 默认壁纸效果（亮色模式）
 */
export const DEFAULT_WALLPAPER_EFFECTS_LIGHT: WallpaperEffects = {
  sidebarGlass: DEFAULT_SIDEBAR_GLASS_EFFECT_LIGHT,
  chatBubble: DEFAULT_CHAT_BUBBLE_EFFECT_LIGHT,
  contentOverlay: DEFAULT_CONTENT_OVERLAY_EFFECT_LIGHT,
  inputBar: DEFAULT_INPUT_BAR_EFFECT_LIGHT,
  codeBlock: DEFAULT_CODE_BLOCK_EFFECT_LIGHT
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
  excludeWorkflow: true,
  effects: DEFAULT_WALLPAPER_EFFECTS_DARK
}

// ==================== 预设主题 ====================

/**
 * 内置壁纸预设主题
 * 壁纸来源：Wallhaven (https://wallhaven.cc)
 */
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  // ==================== 二次元壁纸预设 ====================
  {
    id: 'preset-pink-anime',
    name: 'wallpaper.preset.pink_anime',
    thumbnail: 'https://w.wallhaven.cc/full/gw/wallhaven-gww6me.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/gw/wallhaven-gww6me.png',
    themeMode: 'light',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 240, 245, 0.7)',
        endColor: 'rgba(255, 228, 235, 0.4)',
        tintColor: 'rgba(255, 105, 180, 0.15)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(255, 105, 180, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 245, 248, 0.15)',
        endColor: 'rgba(255, 228, 235, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 250, 252, 0.7)',
        borderColor: 'rgba(255, 182, 193, 0.5)',
        focusColor: 'rgba(255, 105, 180, 0.8)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(255, 245, 248, 0.75)',
        borderColor: 'rgba(255, 182, 193, 0.3)'
      }
    }
  },
  {
    id: 'preset-sunset-anime',
    name: 'wallpaper.preset.sunset_anime',
    thumbnail: 'https://w.wallhaven.cc/full/qr/wallhaven-qrr195.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/qr/wallhaven-qrr195.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 200, 150, 0.6)',
        endColor: 'rgba(255, 150, 100, 0.35)',
        tintColor: 'rgba(255, 140, 0, 0.12)',
        blurAmount: 5,
        saturation: 1.4
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(255, 140, 0, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 200, 150, 0.15)',
        endColor: 'rgba(255, 100, 50, 0.2)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 245, 235, 0.7)',
        borderColor: 'rgba(255, 180, 100, 0.5)',
        focusColor: 'rgba(255, 140, 0, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(255, 248, 240, 0.75)',
        borderColor: 'rgba(255, 180, 100, 0.25)'
      }
    }
  },
  {
    id: 'preset-starry-night',
    name: 'wallpaper.preset.starry_night',
    thumbnail: 'https://w.wallhaven.cc/full/je/wallhaven-jew9dy.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/je/wallhaven-jew9dy.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(15, 25, 45, 0.7)',
        endColor: 'rgba(10, 15, 35, 0.4)',
        tintColor: 'rgba(100, 150, 255, 0.1)',
        blurAmount: 6,
        saturation: 1.2
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 150, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(10, 20, 50, 0.2)',
        endColor: 'rgba(5, 10, 30, 0.35)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(20, 30, 55, 0.7)',
        borderColor: 'rgba(80, 120, 200, 0.4)',
        focusColor: 'rgba(100, 150, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(15, 25, 50, 0.8)',
        borderColor: 'rgba(80, 120, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-cyber-anime',
    name: 'wallpaper.preset.cyber_anime',
    thumbnail: 'https://w.wallhaven.cc/full/ml/wallhaven-mll7j1.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/ml/wallhaven-mll7j1.jpg',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(20, 20, 35, 0.75)',
        endColor: 'rgba(15, 15, 30, 0.45)',
        tintColor: 'rgba(0, 255, 255, 0.08)',
        blurAmount: 5,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(0, 255, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(0, 20, 40, 0.2)',
        endColor: 'rgba(20, 0, 40, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(25, 25, 45, 0.75)',
        borderColor: 'rgba(0, 200, 200, 0.35)',
        focusColor: 'rgba(0, 255, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(20, 20, 40, 0.85)',
        borderColor: 'rgba(0, 200, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-rain-anime',
    name: 'wallpaper.preset.rain_anime',
    thumbnail: 'https://w.wallhaven.cc/full/21/wallhaven-21z1jy.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/21/wallhaven-21z1jy.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(40, 50, 60, 0.7)',
        endColor: 'rgba(30, 40, 50, 0.4)',
        tintColor: 'rgba(100, 150, 200, 0.1)',
        blurAmount: 8,
        saturation: 1.1
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 150, 200, 0.45)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(30, 40, 55, 0.25)',
        endColor: 'rgba(25, 35, 50, 0.35)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(35, 45, 60, 0.75)',
        borderColor: 'rgba(100, 140, 180, 0.4)',
        focusColor: 'rgba(100, 180, 230, 0.8)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(30, 40, 55, 0.8)',
        borderColor: 'rgba(100, 140, 180, 0.2)'
      }
    }
  },
  {
    id: 'preset-vocaloid',
    name: 'wallpaper.preset.vocaloid',
    thumbnail: 'https://w.wallhaven.cc/full/w5/wallhaven-w51qzx.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/w5/wallhaven-w51qzx.png',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(0, 200, 200, 0.2)',
        endColor: 'rgba(0, 150, 200, 0.15)',
        tintColor: 'rgba(0, 200, 200, 0.1)',
        blurAmount: 6,
        saturation: 1.4
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(57, 197, 187, 0.6)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(0, 180, 180, 0.1)',
        endColor: 'rgba(0, 150, 200, 0.15)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(240, 255, 255, 0.7)',
        borderColor: 'rgba(0, 180, 180, 0.4)',
        focusColor: 'rgba(57, 197, 187, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(240, 255, 255, 0.75)',
        borderColor: 'rgba(0, 180, 180, 0.25)'
      }
    }
  },
  // ==================== 日本动漫角色壁纸预设 ====================
  {
    id: 'preset-genshin-impact',
    name: 'wallpaper.preset.genshin_impact',
    thumbnail: 'https://w.wallhaven.cc/full/3q/wallhaven-3q3z59.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/3q/wallhaven-3q3z59.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(60, 90, 140, 0.6)',
        endColor: 'rgba(40, 70, 120, 0.35)',
        tintColor: 'rgba(100, 180, 255, 0.12)',
        blurAmount: 6,
        saturation: 1.35
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 180, 255, 0.55)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(50, 100, 150, 0.15)',
        endColor: 'rgba(30, 80, 130, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(240, 248, 255, 0.7)',
        borderColor: 'rgba(100, 150, 200, 0.5)',
        focusColor: 'rgba(100, 180, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(240, 248, 255, 0.75)',
        borderColor: 'rgba(100, 150, 200, 0.25)'
      }
    }
  },
  {
    id: 'preset-honkai-starrail',
    name: 'wallpaper.preset.honkai_starrail',
    thumbnail: 'https://w.wallhaven.cc/full/5y/wallhaven-5yy188.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/5y/wallhaven-5yy188.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(30, 20, 60, 0.7)',
        endColor: 'rgba(20, 15, 45, 0.4)',
        tintColor: 'rgba(160, 100, 255, 0.1)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(160, 100, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(40, 20, 80, 0.2)',
        endColor: 'rgba(30, 15, 60, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(40, 30, 70, 0.75)',
        borderColor: 'rgba(140, 100, 200, 0.4)',
        focusColor: 'rgba(160, 100, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(35, 25, 60, 0.8)',
        borderColor: 'rgba(140, 100, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-honkai-impact',
    name: 'wallpaper.preset.honkai_impact',
    thumbnail: 'https://w.wallhaven.cc/full/w5/wallhaven-w515e7.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/w5/wallhaven-w515e7.jpg',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(25, 35, 55, 0.7)',
        endColor: 'rgba(20, 25, 45, 0.4)',
        tintColor: 'rgba(80, 150, 255, 0.1)',
        blurAmount: 5,
        saturation: 1.25
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(80, 150, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(20, 40, 70, 0.2)',
        endColor: 'rgba(15, 30, 55, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(30, 40, 60, 0.75)',
        borderColor: 'rgba(80, 130, 200, 0.4)',
        focusColor: 'rgba(80, 150, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(25, 35, 55, 0.8)',
        borderColor: 'rgba(80, 130, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-blue-archive',
    name: 'wallpaper.preset.blue_archive',
    thumbnail: 'https://w.wallhaven.cc/full/po/wallhaven-polkwm.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/po/wallhaven-polkwm.png',
    themeMode: 'light',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(230, 245, 255, 0.7)',
        endColor: 'rgba(200, 230, 255, 0.4)',
        tintColor: 'rgba(100, 180, 255, 0.15)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(59, 130, 246, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(230, 245, 255, 0.15)',
        endColor: 'rgba(200, 230, 255, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(248, 252, 255, 0.75)',
        borderColor: 'rgba(100, 180, 255, 0.4)',
        focusColor: 'rgba(59, 130, 246, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(245, 250, 255, 0.8)',
        borderColor: 'rgba(100, 180, 255, 0.2)'
      }
    }
  },
  {
    id: 'preset-spy-family',
    name: 'wallpaper.preset.spy_family',
    thumbnail: 'https://w.wallhaven.cc/full/je/wallhaven-jeemey.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/je/wallhaven-jeemey.png',
    themeMode: 'light',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 240, 245, 0.7)',
        endColor: 'rgba(255, 220, 235, 0.4)',
        tintColor: 'rgba(255, 100, 150, 0.12)',
        blurAmount: 6,
        saturation: 1.35
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(255, 100, 150, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 245, 250, 0.12)',
        endColor: 'rgba(255, 230, 240, 0.22)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 252, 254, 0.75)',
        borderColor: 'rgba(255, 150, 180, 0.45)',
        focusColor: 'rgba(255, 100, 150, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(255, 250, 252, 0.8)',
        borderColor: 'rgba(255, 150, 180, 0.2)'
      }
    }
  },
  {
    id: 'preset-fate-sakura',
    name: 'wallpaper.preset.fate_sakura',
    thumbnail: 'https://w.wallhaven.cc/full/zp/wallhaven-zpzgyj.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/zp/wallhaven-zpzgyj.png',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(200, 150, 180, 0.6)',
        endColor: 'rgba(180, 130, 160, 0.35)',
        tintColor: 'rgba(255, 180, 200, 0.12)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(200, 100, 150, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 200, 220, 0.15)',
        endColor: 'rgba(255, 180, 200, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 248, 252, 0.7)',
        borderColor: 'rgba(200, 150, 180, 0.45)',
        focusColor: 'rgba(200, 100, 150, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(255, 245, 250, 0.75)',
        borderColor: 'rgba(200, 150, 180, 0.2)'
      }
    }
  },
  {
    id: 'preset-nier-automata',
    name: 'wallpaper.preset.nier_automata',
    thumbnail: 'https://w.wallhaven.cc/full/21/wallhaven-2117pm.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/21/wallhaven-2117pm.jpg',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(50, 45, 40, 0.7)',
        endColor: 'rgba(40, 35, 30, 0.4)',
        tintColor: 'rgba(200, 180, 150, 0.08)',
        blurAmount: 5,
        saturation: 1.1
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(200, 180, 150, 0.45)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(60, 55, 50, 0.2)',
        endColor: 'rgba(45, 40, 35, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(55, 50, 45, 0.75)',
        borderColor: 'rgba(180, 160, 130, 0.4)',
        focusColor: 'rgba(200, 180, 150, 0.8)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(50, 45, 40, 0.8)',
        borderColor: 'rgba(180, 160, 130, 0.2)'
      }
    }
  },
  {
    id: 'preset-anime-fantasy',
    name: 'wallpaper.preset.anime_fantasy',
    thumbnail: 'https://w.wallhaven.cc/full/qr/wallhaven-qrrk27.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/qr/wallhaven-qrrk27.png',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(70, 100, 140, 0.65)',
        endColor: 'rgba(50, 80, 120, 0.35)',
        tintColor: 'rgba(120, 180, 220, 0.12)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 160, 220, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(80, 120, 160, 0.15)',
        endColor: 'rgba(60, 100, 140, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(245, 250, 255, 0.7)',
        borderColor: 'rgba(100, 150, 200, 0.45)',
        focusColor: 'rgba(100, 160, 220, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(242, 248, 255, 0.75)',
        borderColor: 'rgba(100, 150, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-anime-dreamy',
    name: 'wallpaper.preset.anime_dreamy',
    thumbnail: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp8gm.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp8gm.jpg',
    themeMode: 'light',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 250, 240, 0.7)',
        endColor: 'rgba(255, 240, 220, 0.4)',
        tintColor: 'rgba(255, 200, 150, 0.12)',
        blurAmount: 7,
        saturation: 1.25
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(220, 160, 100, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 248, 235, 0.15)',
        endColor: 'rgba(255, 240, 220, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 252, 248, 0.75)',
        borderColor: 'rgba(220, 180, 130, 0.45)',
        focusColor: 'rgba(220, 160, 100, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(255, 250, 245, 0.8)',
        borderColor: 'rgba(220, 180, 130, 0.2)'
      }
    }
  },
  {
    id: 'preset-anime-ocean',
    name: 'wallpaper.preset.anime_ocean',
    thumbnail: 'https://w.wallhaven.cc/full/k8/wallhaven-k88yl7.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/k8/wallhaven-k88yl7.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(60, 140, 180, 0.6)',
        endColor: 'rgba(40, 120, 160, 0.35)',
        tintColor: 'rgba(80, 200, 220, 0.12)',
        blurAmount: 6,
        saturation: 1.35
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(60, 180, 200, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(80, 160, 200, 0.15)',
        endColor: 'rgba(60, 140, 180, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(240, 252, 255, 0.7)',
        borderColor: 'rgba(80, 180, 200, 0.45)',
        focusColor: 'rgba(60, 180, 200, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(238, 250, 255, 0.75)',
        borderColor: 'rgba(80, 180, 200, 0.2)'
      }
    }
  },
  {
    id: 'preset-jujutsu-kaisen',
    name: 'wallpaper.preset.jujutsu_kaisen',
    thumbnail: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp688.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp688.jpg',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(20, 15, 35, 0.75)',
        endColor: 'rgba(15, 10, 30, 0.45)',
        tintColor: 'rgba(120, 80, 180, 0.1)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(120, 80, 180, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(30, 20, 50, 0.2)',
        endColor: 'rgba(20, 15, 40, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(30, 25, 50, 0.75)',
        borderColor: 'rgba(120, 80, 180, 0.4)',
        focusColor: 'rgba(120, 80, 180, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(25, 20, 45, 0.8)',
        borderColor: 'rgba(120, 80, 180, 0.2)'
      }
    }
  },
  {
    id: 'preset-chainsaw-man',
    name: 'wallpaper.preset.chainsaw_man',
    thumbnail: 'https://w.wallhaven.cc/full/ml/wallhaven-mllxq1.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/ml/wallhaven-mllxq1.jpg',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(40, 20, 20, 0.75)',
        endColor: 'rgba(30, 15, 15, 0.45)',
        tintColor: 'rgba(200, 60, 60, 0.08)',
        blurAmount: 5,
        saturation: 1.2
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(200, 80, 80, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(50, 20, 20, 0.2)',
        endColor: 'rgba(40, 15, 15, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(45, 25, 25, 0.75)',
        borderColor: 'rgba(180, 70, 70, 0.4)',
        focusColor: 'rgba(200, 80, 80, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(40, 20, 20, 0.8)',
        borderColor: 'rgba(180, 70, 70, 0.2)'
      }
    }
  },
  {
    id: 'preset-my-hero-academia',
    name: 'wallpaper.preset.my_hero_academia',
    thumbnail: 'https://w.wallhaven.cc/full/w5/wallhaven-w552jx.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/w5/wallhaven-w552jx.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(50, 120, 50, 0.6)',
        endColor: 'rgba(40, 100, 40, 0.35)',
        tintColor: 'rgba(100, 200, 100, 0.1)',
        blurAmount: 6,
        saturation: 1.35
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(80, 180, 80, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(60, 130, 60, 0.15)',
        endColor: 'rgba(50, 110, 50, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(245, 255, 245, 0.7)',
        borderColor: 'rgba(80, 160, 80, 0.45)',
        focusColor: 'rgba(80, 180, 80, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(242, 255, 242, 0.75)',
        borderColor: 'rgba(80, 160, 80, 0.2)'
      }
    }
  },
  {
    id: 'preset-anime-landscape',
    name: 'wallpaper.preset.anime_landscape',
    thumbnail: 'https://w.wallhaven.cc/full/yq/wallhaven-yq58m7.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/yq/wallhaven-yq58m7.png',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(60, 80, 60, 0.6)',
        endColor: 'rgba(50, 70, 50, 0.35)',
        tintColor: 'rgba(120, 180, 100, 0.1)',
        blurAmount: 7,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 160, 80, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(80, 100, 70, 0.15)',
        endColor: 'rgba(70, 90, 60, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(248, 255, 245, 0.7)',
        borderColor: 'rgba(100, 150, 80, 0.45)',
        focusColor: 'rgba(100, 160, 80, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(245, 252, 242, 0.75)',
        borderColor: 'rgba(100, 150, 80, 0.2)'
      }
    }
  },
  {
    id: 'preset-chainsaw-power',
    name: 'wallpaper.preset.chainsaw_power',
    thumbnail: 'https://w.wallhaven.cc/full/gw/wallhaven-gwwg13.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/gw/wallhaven-gwwg13.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 200, 180, 0.25)',
        endColor: 'rgba(200, 150, 130, 0.15)',
        tintColor: 'rgba(255, 180, 150, 0.08)',
        blurAmount: 5,
        saturation: 1.25
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(255, 180, 150, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(60, 40, 35, 0.2)',
        endColor: 'rgba(50, 35, 30, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(55, 40, 35, 0.75)',
        borderColor: 'rgba(200, 150, 130, 0.4)',
        focusColor: 'rgba(255, 180, 150, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(50, 38, 33, 0.8)',
        borderColor: 'rgba(200, 150, 130, 0.2)'
      }
    }
  },
  // ==================== 渐变预设（保持兼容） ====================
  {
    id: 'preset-gradient-light',
    name: 'wallpaper.preset.gradient_light',
    thumbnail: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    wallpaperGradient: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    themeMode: 'light',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 255, 255, 0.75)',
        endColor: 'rgba(255, 255, 255, 0.45)',
        tintColor: 'transparent',
        blurAmount: 8,
        saturation: 1.0
      },
      chatBubble: {
        enabled: false,
        shadowEnabled: false,
        accentLineEnabled: false,
        accentLineColor: 'transparent'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(255, 255, 255, 0.1)',
        endColor: 'rgba(255, 255, 255, 0.2)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        focusColor: 'rgba(59, 130, 246, 0.8)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(245, 247, 250, 0.8)',
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }
    }
  },
  {
    id: 'preset-gradient-dark',
    name: 'wallpaper.preset.gradient_dark',
    thumbnail: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    wallpaperGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(26, 26, 46, 0.75)',
        endColor: 'rgba(22, 33, 62, 0.45)',
        tintColor: 'transparent',
        blurAmount: 8,
        saturation: 1.0
      },
      chatBubble: {
        enabled: false,
        shadowEnabled: false,
        accentLineEnabled: false,
        accentLineColor: 'transparent'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(0, 0, 0, 0.1)',
        endColor: 'rgba(0, 0, 0, 0.2)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(30, 30, 50, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        focusColor: 'rgba(70, 150, 230, 0.8)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(26, 26, 46, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }
    }
  },
  // ==================== 更多动漫角色预设 ====================
  {
    id: 'preset-gojo-satoru',
    name: 'wallpaper.preset.gojo_satoru',
    thumbnail: 'https://w.wallhaven.cc/full/je/wallhaven-jew8zp.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/je/wallhaven-jew8zp.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(100, 150, 220, 0.3)',
        endColor: 'rgba(60, 100, 180, 0.2)',
        tintColor: 'rgba(150, 200, 255, 0.1)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 180, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(30, 50, 80, 0.2)',
        endColor: 'rgba(20, 35, 60, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(30, 45, 70, 0.75)',
        borderColor: 'rgba(100, 150, 220, 0.4)',
        focusColor: 'rgba(100, 180, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(25, 40, 65, 0.8)',
        borderColor: 'rgba(100, 150, 220, 0.2)'
      }
    }
  },
  {
    id: 'preset-makima',
    name: 'wallpaper.preset.makima',
    thumbnail: 'https://w.wallhaven.cc/full/qr/wallhaven-qrj2o7.png',
    wallpaperUrl: 'https://w.wallhaven.cc/full/qr/wallhaven-qrj2o7.png',
    themeMode: 'dark',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(200, 100, 80, 0.25)',
        endColor: 'rgba(150, 70, 60, 0.15)',
        tintColor: 'rgba(255, 100, 80, 0.08)',
        blurAmount: 5,
        saturation: 1.25
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(220, 100, 80, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(50, 30, 30, 0.2)',
        endColor: 'rgba(40, 25, 25, 0.3)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(50, 35, 35, 0.75)',
        borderColor: 'rgba(180, 100, 80, 0.4)',
        focusColor: 'rgba(220, 100, 80, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(45, 30, 30, 0.8)',
        borderColor: 'rgba(180, 100, 80, 0.2)'
      }
    }
  },
  {
    id: 'preset-fate-saber',
    name: 'wallpaper.preset.fate_saber',
    thumbnail: 'https://w.wallhaven.cc/full/6l/wallhaven-6llrl7.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/6l/wallhaven-6llrl7.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(255, 215, 100, 0.3)',
        endColor: 'rgba(200, 170, 80, 0.2)',
        tintColor: 'rgba(255, 220, 150, 0.1)',
        blurAmount: 6,
        saturation: 1.3
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(255, 200, 100, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(80, 70, 50, 0.15)',
        endColor: 'rgba(60, 50, 35, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(250, 245, 230, 0.7)',
        borderColor: 'rgba(200, 170, 100, 0.45)',
        focusColor: 'rgba(220, 180, 80, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(252, 248, 235, 0.75)',
        borderColor: 'rgba(200, 170, 100, 0.2)'
      }
    }
  },
  {
    id: 'preset-anime-top',
    name: 'wallpaper.preset.anime_top',
    thumbnail: 'https://w.wallhaven.cc/full/d6/wallhaven-d69eom.jpg',
    wallpaperUrl: 'https://w.wallhaven.cc/full/d6/wallhaven-d69eom.jpg',
    themeMode: 'both',
    effects: {
      sidebarGlass: {
        enabled: true,
        startColor: 'rgba(150, 200, 255, 0.35)',
        endColor: 'rgba(100, 150, 220, 0.2)',
        tintColor: 'rgba(180, 220, 255, 0.1)',
        blurAmount: 7,
        saturation: 1.35
      },
      chatBubble: {
        enabled: true,
        shadowEnabled: true,
        accentLineEnabled: true,
        accentLineColor: 'rgba(100, 180, 255, 0.5)'
      },
      contentOverlay: {
        enabled: true,
        startColor: 'rgba(50, 80, 120, 0.15)',
        endColor: 'rgba(40, 60, 100, 0.25)'
      },
      inputBar: {
        enabled: true,
        backgroundColor: 'rgba(240, 248, 255, 0.7)',
        borderColor: 'rgba(100, 160, 220, 0.45)',
        focusColor: 'rgba(100, 180, 255, 0.85)'
      },
      codeBlock: {
        enabled: true,
        backgroundColor: 'rgba(245, 250, 255, 0.75)',
        borderColor: 'rgba(100, 160, 220, 0.2)'
      }
    }
  }
]

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
