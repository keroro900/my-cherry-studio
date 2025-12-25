/**
 * 主题预设类型定义
 * Theme Preset Type Definitions
 */

/**
 * 主题分类
 */
export type ThemeCategory = 'default' | 'anime' | 'nature' | 'professional' | 'custom'

/**
 * 边框圆角大小
 */
export type BorderRadiusSize = 'small' | 'medium' | 'large' | 'round'

/**
 * 阴影强度
 */
export type ShadowIntensity = 'none' | 'light' | 'medium' | 'strong'

/**
 * 主题颜色配置
 */
export interface ThemeColors {
  // 主色调
  colorPrimary: string
  colorPrimaryHover: string
  colorPrimaryActive: string
  colorPrimaryBg: string

  // 背景色
  colorBgBase: string
  colorBgContainer: string
  colorBgElevated: string
  colorBgLayout: string
  colorBgSpotlight: string

  // 文字色
  colorText: string
  colorTextSecondary: string
  colorTextTertiary: string
  colorTextQuaternary: string

  // 边框色
  colorBorder: string
  colorBorderSecondary: string

  // 状态色
  colorSuccess: string
  colorWarning: string
  colorError: string
  colorInfo: string

  // 特殊色
  colorLink: string
  colorHighlight: string
}

/**
 * 主题效果配置
 */
export interface ThemeEffects {
  borderRadius: BorderRadiusSize
  shadowIntensity: ShadowIntensity
  glassEffect: boolean
  gradientAccents: boolean
}

/**
 * 主题字体配置
 */
export interface ThemeFonts {
  fontFamily?: string
  codeFontFamily?: string
  fontSize?: number
}

/**
 * 完整主题预设定义
 */
export interface ThemePreset {
  id: string
  name: string // i18n key
  description?: string // i18n key
  category: ThemeCategory
  colors: ThemeColors
  darkColors?: ThemeColors // 深色模式颜色（可选，不提供则自动生成）
  effects?: ThemeEffects
  fonts?: ThemeFonts
  isBuiltIn: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 主题预设元数据（用于列表展示）
 */
export interface ThemePresetMeta {
  id: string
  name: string
  description?: string
  category: ThemeCategory
  colorPrimary: string
  colorBgBase: string
  isBuiltIn: boolean
}

/**
 * 边框圆角值映射
 */
export const BORDER_RADIUS_VALUES: Record<BorderRadiusSize, string> = {
  small: '4px',
  medium: '8px',
  large: '12px',
  round: '9999px'
}

/**
 * 阴影值映射
 */
export const SHADOW_VALUES: Record<ShadowIntensity, string> = {
  none: 'none',
  light: '0 1px 2px rgba(0, 0, 0, 0.05)',
  medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
  strong: '0 10px 15px rgba(0, 0, 0, 0.15)'
}
