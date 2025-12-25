/**
 * 内置主题预设配置
 * Built-in Theme Presets Configuration
 */

import type { ThemeColors, ThemePreset } from '@renderer/types/theme'

/**
 * Cherry 默认主题 - 浅色
 */
const cherryDefaultLight: ThemeColors = {
  colorPrimary: '#00b96b',
  colorPrimaryHover: '#36c98a',
  colorPrimaryActive: '#009456',
  colorPrimaryBg: '#e6f7ef',
  colorBgBase: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f5f5f5',
  colorBgSpotlight: '#fafafa',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
  colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
  colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
  colorBorder: 'rgba(0, 0, 0, 0.1)',
  colorBorderSecondary: 'rgba(0, 0, 0, 0.06)',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#1890ff',
  colorLink: '#1677ff',
  colorHighlight: 'rgba(255, 255, 0, 0.5)'
}

/**
 * Cherry 默认主题 - 深色
 */
const cherryDefaultDark: ThemeColors = {
  colorPrimary: '#00b96b',
  colorPrimaryHover: '#36c98a',
  colorPrimaryActive: '#009456',
  colorPrimaryBg: 'rgba(0, 185, 107, 0.15)',
  colorBgBase: '#181818',
  colorBgContainer: '#1f1f1f',
  colorBgElevated: '#252525',
  colorBgLayout: '#141414',
  colorBgSpotlight: '#2a2a2a',
  colorText: 'rgba(255, 255, 245, 0.9)',
  colorTextSecondary: 'rgba(235, 235, 245, 0.7)',
  colorTextTertiary: 'rgba(235, 235, 245, 0.5)',
  colorTextQuaternary: 'rgba(235, 235, 245, 0.3)',
  colorBorder: 'rgba(255, 255, 255, 0.1)',
  colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#1890ff',
  colorLink: '#338cff',
  colorHighlight: 'rgba(255, 255, 0, 0.3)'
}

/**
 * 樱花粉主题 - 浅色
 */
const sakuraPinkLight: ThemeColors = {
  colorPrimary: '#FF69B4',
  colorPrimaryHover: '#FF85C1',
  colorPrimaryActive: '#E05A9E',
  colorPrimaryBg: '#FFF0F5',
  colorBgBase: '#FFFAFA',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFF5F8',
  colorBgLayout: '#FFF0F5',
  colorBgSpotlight: '#FFE4EC',
  colorText: 'rgba(80, 40, 60, 0.9)',
  colorTextSecondary: 'rgba(120, 80, 100, 0.75)',
  colorTextTertiary: 'rgba(150, 100, 130, 0.6)',
  colorTextQuaternary: 'rgba(180, 140, 160, 0.45)',
  colorBorder: 'rgba(255, 105, 180, 0.2)',
  colorBorderSecondary: 'rgba(255, 105, 180, 0.1)',
  colorSuccess: '#7CB342',
  colorWarning: '#FFB74D',
  colorError: '#E57373',
  colorInfo: '#64B5F6',
  colorLink: '#F06292',
  colorHighlight: 'rgba(255, 182, 193, 0.6)'
}

/**
 * 樱花粉主题 - 深色
 */
const sakuraPinkDark: ThemeColors = {
  colorPrimary: '#FF69B4',
  colorPrimaryHover: '#FF85C1',
  colorPrimaryActive: '#E05A9E',
  colorPrimaryBg: 'rgba(255, 105, 180, 0.15)',
  colorBgBase: '#1A1215',
  colorBgContainer: '#251A1F',
  colorBgElevated: '#2D2025',
  colorBgLayout: '#150F12',
  colorBgSpotlight: '#352830',
  colorText: 'rgba(255, 240, 245, 0.9)',
  colorTextSecondary: 'rgba(255, 220, 235, 0.7)',
  colorTextTertiary: 'rgba(255, 200, 220, 0.5)',
  colorTextQuaternary: 'rgba(255, 180, 200, 0.3)',
  colorBorder: 'rgba(255, 105, 180, 0.25)',
  colorBorderSecondary: 'rgba(255, 105, 180, 0.12)',
  colorSuccess: '#7CB342',
  colorWarning: '#FFB74D',
  colorError: '#E57373',
  colorInfo: '#64B5F6',
  colorLink: '#FF85C1',
  colorHighlight: 'rgba(255, 105, 180, 0.3)'
}

/**
 * 天空蓝主题 - 浅色
 */
const skyBlueLight: ThemeColors = {
  colorPrimary: '#0EA5E9',
  colorPrimaryHover: '#38BDF8',
  colorPrimaryActive: '#0284C7',
  colorPrimaryBg: '#E0F2FE',
  colorBgBase: '#F0F9FF',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#F8FCFF',
  colorBgLayout: '#E0F2FE',
  colorBgSpotlight: '#BAE6FD',
  colorText: 'rgba(15, 23, 42, 0.9)',
  colorTextSecondary: 'rgba(51, 65, 85, 0.75)',
  colorTextTertiary: 'rgba(100, 116, 139, 0.6)',
  colorTextQuaternary: 'rgba(148, 163, 184, 0.45)',
  colorBorder: 'rgba(14, 165, 233, 0.2)',
  colorBorderSecondary: 'rgba(14, 165, 233, 0.1)',
  colorSuccess: '#22C55E',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#3B82F6',
  colorLink: '#0284C7',
  colorHighlight: 'rgba(186, 230, 253, 0.6)'
}

/**
 * 天空蓝主题 - 深色
 */
const skyBlueDark: ThemeColors = {
  colorPrimary: '#0EA5E9',
  colorPrimaryHover: '#38BDF8',
  colorPrimaryActive: '#0284C7',
  colorPrimaryBg: 'rgba(14, 165, 233, 0.15)',
  colorBgBase: '#0C1929',
  colorBgContainer: '#132337',
  colorBgElevated: '#1A2D45',
  colorBgLayout: '#081420',
  colorBgSpotlight: '#1E3A5F',
  colorText: 'rgba(240, 249, 255, 0.9)',
  colorTextSecondary: 'rgba(186, 230, 253, 0.7)',
  colorTextTertiary: 'rgba(125, 211, 252, 0.5)',
  colorTextQuaternary: 'rgba(56, 189, 248, 0.3)',
  colorBorder: 'rgba(14, 165, 233, 0.25)',
  colorBorderSecondary: 'rgba(14, 165, 233, 0.12)',
  colorSuccess: '#22C55E',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#3B82F6',
  colorLink: '#38BDF8',
  colorHighlight: 'rgba(14, 165, 233, 0.3)'
}

/**
 * 薰衣草紫主题 - 浅色
 */
const lavenderPurpleLight: ThemeColors = {
  colorPrimary: '#8B5CF6',
  colorPrimaryHover: '#A78BFA',
  colorPrimaryActive: '#7C3AED',
  colorPrimaryBg: '#EDE9FE',
  colorBgBase: '#FAF5FF',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#F5F3FF',
  colorBgLayout: '#EDE9FE',
  colorBgSpotlight: '#DDD6FE',
  colorText: 'rgba(46, 16, 101, 0.9)',
  colorTextSecondary: 'rgba(88, 28, 135, 0.7)',
  colorTextTertiary: 'rgba(124, 58, 237, 0.5)',
  colorTextQuaternary: 'rgba(167, 139, 250, 0.4)',
  colorBorder: 'rgba(139, 92, 246, 0.2)',
  colorBorderSecondary: 'rgba(139, 92, 246, 0.1)',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#F43F5E',
  colorInfo: '#6366F1',
  colorLink: '#7C3AED',
  colorHighlight: 'rgba(221, 214, 254, 0.6)'
}

/**
 * 薰衣草紫主题 - 深色
 */
const lavenderPurpleDark: ThemeColors = {
  colorPrimary: '#8B5CF6',
  colorPrimaryHover: '#A78BFA',
  colorPrimaryActive: '#7C3AED',
  colorPrimaryBg: 'rgba(139, 92, 246, 0.15)',
  colorBgBase: '#13111C',
  colorBgContainer: '#1C1827',
  colorBgElevated: '#252033',
  colorBgLayout: '#0F0D15',
  colorBgSpotlight: '#2D2640',
  colorText: 'rgba(250, 245, 255, 0.9)',
  colorTextSecondary: 'rgba(221, 214, 254, 0.7)',
  colorTextTertiary: 'rgba(196, 181, 253, 0.5)',
  colorTextQuaternary: 'rgba(167, 139, 250, 0.3)',
  colorBorder: 'rgba(139, 92, 246, 0.25)',
  colorBorderSecondary: 'rgba(139, 92, 246, 0.12)',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#F43F5E',
  colorInfo: '#6366F1',
  colorLink: '#A78BFA',
  colorHighlight: 'rgba(139, 92, 246, 0.3)'
}

/**
 * 霓虹赛博主题 - 深色（此主题只有深色模式）
 */
const neonCyberDark: ThemeColors = {
  colorPrimary: '#00FFFF',
  colorPrimaryHover: '#33FFFF',
  colorPrimaryActive: '#00CCCC',
  colorPrimaryBg: 'rgba(0, 255, 255, 0.1)',
  colorBgBase: '#0D0D1A',
  colorBgContainer: '#1A1A2E',
  colorBgElevated: '#252542',
  colorBgLayout: '#0A0A14',
  colorBgSpotlight: '#2D2D4A',
  colorText: 'rgba(255, 255, 255, 0.95)',
  colorTextSecondary: 'rgba(200, 200, 255, 0.8)',
  colorTextTertiary: 'rgba(150, 150, 200, 0.6)',
  colorTextQuaternary: 'rgba(100, 100, 150, 0.4)',
  colorBorder: 'rgba(0, 255, 255, 0.3)',
  colorBorderSecondary: 'rgba(0, 255, 255, 0.15)',
  colorSuccess: '#00FF88',
  colorWarning: '#FFAA00',
  colorError: '#FF4466',
  colorInfo: '#00AAFF',
  colorLink: '#FF00FF',
  colorHighlight: 'rgba(0, 255, 255, 0.3)'
}

/**
 * 薄荷绿主题 - 浅色
 */
const mintGreenLight: ThemeColors = {
  colorPrimary: '#14B8A6',
  colorPrimaryHover: '#2DD4BF',
  colorPrimaryActive: '#0D9488',
  colorPrimaryBg: '#CCFBF1',
  colorBgBase: '#F0FDFA',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#F5FFFE',
  colorBgLayout: '#ECFDF5',
  colorBgSpotlight: '#D1FAE5',
  colorText: 'rgba(6, 78, 59, 0.9)',
  colorTextSecondary: 'rgba(20, 83, 45, 0.75)',
  colorTextTertiary: 'rgba(34, 197, 94, 0.6)',
  colorTextQuaternary: 'rgba(74, 222, 128, 0.45)',
  colorBorder: 'rgba(20, 184, 166, 0.2)',
  colorBorderSecondary: 'rgba(20, 184, 166, 0.1)',
  colorSuccess: '#22C55E',
  colorWarning: '#EAB308',
  colorError: '#EF4444',
  colorInfo: '#06B6D4',
  colorLink: '#0D9488',
  colorHighlight: 'rgba(209, 250, 229, 0.6)'
}

/**
 * 薄荷绿主题 - 深色
 */
const mintGreenDark: ThemeColors = {
  colorPrimary: '#14B8A6',
  colorPrimaryHover: '#2DD4BF',
  colorPrimaryActive: '#0D9488',
  colorPrimaryBg: 'rgba(20, 184, 166, 0.15)',
  colorBgBase: '#0D1A18',
  colorBgContainer: '#142523',
  colorBgElevated: '#1B302D',
  colorBgLayout: '#091412',
  colorBgSpotlight: '#1F3D38',
  colorText: 'rgba(240, 253, 250, 0.9)',
  colorTextSecondary: 'rgba(204, 251, 241, 0.7)',
  colorTextTertiary: 'rgba(153, 246, 228, 0.5)',
  colorTextQuaternary: 'rgba(94, 234, 212, 0.3)',
  colorBorder: 'rgba(20, 184, 166, 0.25)',
  colorBorderSecondary: 'rgba(20, 184, 166, 0.12)',
  colorSuccess: '#22C55E',
  colorWarning: '#EAB308',
  colorError: '#EF4444',
  colorInfo: '#06B6D4',
  colorLink: '#2DD4BF',
  colorHighlight: 'rgba(20, 184, 166, 0.3)'
}

/**
 * 内置主题预设列表
 */
export const BUILT_IN_THEME_PRESETS: ThemePreset[] = [
  // Cherry 默认
  {
    id: 'cherry-default',
    name: 'settings.theme.preset.default.name',
    description: 'settings.theme.preset.default.desc',
    category: 'default',
    isBuiltIn: true,
    colors: cherryDefaultLight,
    darkColors: cherryDefaultDark,
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'light',
      glassEffect: false,
      gradientAccents: false
    }
  },

  // 樱花粉
  {
    id: 'sakura-pink',
    name: 'settings.theme.preset.sakura.name',
    description: 'settings.theme.preset.sakura.desc',
    category: 'anime',
    isBuiltIn: true,
    colors: sakuraPinkLight,
    darkColors: sakuraPinkDark,
    effects: {
      borderRadius: 'large',
      shadowIntensity: 'light',
      glassEffect: true,
      gradientAccents: true
    }
  },

  // 天空蓝
  {
    id: 'sky-blue',
    name: 'settings.theme.preset.sky.name',
    description: 'settings.theme.preset.sky.desc',
    category: 'nature',
    isBuiltIn: true,
    colors: skyBlueLight,
    darkColors: skyBlueDark,
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'medium',
      glassEffect: false,
      gradientAccents: false
    }
  },

  // 薰衣草紫
  {
    id: 'lavender-purple',
    name: 'settings.theme.preset.lavender.name',
    description: 'settings.theme.preset.lavender.desc',
    category: 'anime',
    isBuiltIn: true,
    colors: lavenderPurpleLight,
    darkColors: lavenderPurpleDark,
    effects: {
      borderRadius: 'large',
      shadowIntensity: 'light',
      glassEffect: true,
      gradientAccents: true
    }
  },

  // 霓虹赛博（仅深色）
  {
    id: 'anime-neon',
    name: 'settings.theme.preset.neon.name',
    description: 'settings.theme.preset.neon.desc',
    category: 'anime',
    isBuiltIn: true,
    colors: neonCyberDark, // 浅色模式也使用深色配色
    darkColors: neonCyberDark,
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'strong',
      glassEffect: true,
      gradientAccents: true
    }
  },

  // 薄荷绿
  {
    id: 'mint-green',
    name: 'settings.theme.preset.mint.name',
    description: 'settings.theme.preset.mint.desc',
    category: 'nature',
    isBuiltIn: true,
    colors: mintGreenLight,
    darkColors: mintGreenDark,
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'light',
      glassEffect: false,
      gradientAccents: false
    }
  }
]

/**
 * 根据 ID 获取主题预设
 */
export function getThemePresetById(id: string): ThemePreset | undefined {
  return BUILT_IN_THEME_PRESETS.find((preset) => preset.id === id)
}

/**
 * 获取主题预设的颜色（根据当前主题模式）
 */
export function getThemeColors(preset: ThemePreset, isDark: boolean): ThemeColors {
  if (isDark && preset.darkColors) {
    return preset.darkColors
  }
  return preset.colors
}

/**
 * 主题分类标签
 */
export const THEME_CATEGORY_LABELS: Record<string, string> = {
  default: 'settings.theme.category.default',
  anime: 'settings.theme.category.anime',
  nature: 'settings.theme.category.nature',
  professional: 'settings.theme.category.professional',
  custom: 'settings.theme.category.custom'
}
