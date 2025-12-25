/**
 * 工作流节点主题配置
 * Workflow Node Theme Configuration
 *
 * 包含多个二次元风格的节点主题
 */

import type { WorkflowNodeTheme } from '../types/workflowTheme'

/**
 * 内置工作流主题列表
 */
export const WORKFLOW_THEMES: WorkflowNodeTheme[] = [
  // Cherry 默认主题
  {
    id: 'cherry-default',
    name: 'cherry-default',
    displayName: 'Cherry 默认',
    description: '简约优雅的默认风格',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 10,
      borderWidth: 1,
      padding: '10px 12px',
      shadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      backdropBlur: 0,
      gradient: false
    },
    handleStyle: {
      size: 12,
      borderWidth: 2,
      glow: false
    },
    animation: {
      enabled: false,
      hoverScale: 1.0,
      bounceEffect: false,
      pulseOnRunning: true
    }
  },

  // 可爱粉彩主题
  {
    id: 'kawaii-pastel',
    name: 'kawaii-pastel',
    displayName: '可爱粉彩',
    description: '柔和的粉彩色调，大圆角，弹跳动画',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 20,
      borderWidth: 2,
      padding: '14px 18px',
      shadow: '0 6px 20px rgba(255, 182, 193, 0.3)',
      backdropBlur: 8,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 16,
      borderWidth: 3,
      glow: true,
      glowColor: 'rgba(255, 182, 193, 0.6)',
      glowIntensity: 10
    },
    animation: {
      enabled: true,
      hoverScale: 1.03,
      bounceEffect: true,
      pulseOnRunning: true,
      transitionDuration: 300,
      transitionEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    },
    categoryColors: {
      input: '#FFB6C1',
      ai: '#DDA0DD',
      image: '#98FB98',
      video: '#87CEEB',
      flow: '#FFDAB9',
      output: '#F0E68C',
      external: '#E6E6FA'
    },
    edgeColor: '#FFB6C1',
    selectedBorderColor: '#FF69B4'
  },

  // 霓虹赛博主题
  {
    id: 'neon-cyber',
    name: 'neon-cyber',
    displayName: '霓虹赛博',
    description: '深色背景，霓虹发光效果',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 8,
      borderWidth: 2,
      padding: '12px 16px',
      shadow: '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
      backdropBlur: 12,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 14,
      borderWidth: 2,
      glow: true,
      glowColor: 'rgba(0, 255, 255, 0.8)',
      glowIntensity: 15
    },
    animation: {
      enabled: true,
      hoverScale: 1.02,
      bounceEffect: false,
      pulseOnRunning: true,
      transitionDuration: 200,
      transitionEasing: 'ease-out'
    },
    categoryColors: {
      input: '#00FFFF',
      ai: '#FF00FF',
      image: '#00FF00',
      video: '#FF6600',
      flow: '#FFFF00',
      output: '#FF0066',
      external: '#6600FF'
    },
    edgeColor: '#00FFFF',
    selectedBorderColor: '#FF00FF'
  },

  // 吉卜力森林主题
  {
    id: 'ghibli-forest',
    name: 'ghibli-forest',
    displayName: '吉卜力森林',
    description: '自然绿色调，温暖柔和',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 16,
      borderWidth: 2,
      padding: '14px 18px',
      shadow: '0 4px 16px rgba(76, 175, 80, 0.2)',
      backdropBlur: 4,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 14,
      borderWidth: 3,
      glow: true,
      glowColor: 'rgba(139, 195, 74, 0.5)',
      glowIntensity: 8
    },
    animation: {
      enabled: true,
      hoverScale: 1.02,
      bounceEffect: true,
      pulseOnRunning: true,
      transitionDuration: 350,
      transitionEasing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    },
    categoryColors: {
      input: '#8BC34A',
      ai: '#4CAF50',
      image: '#CDDC39',
      video: '#009688',
      flow: '#795548',
      output: '#FF9800',
      external: '#607D8B'
    },
    edgeColor: '#8BC34A',
    selectedBorderColor: '#4CAF50'
  },

  // 樱花梦境主题
  {
    id: 'sakura-dream',
    name: 'sakura-dream',
    displayName: '樱花梦境',
    description: '浪漫樱花粉，梦幻玻璃效果',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 24,
      borderWidth: 2,
      padding: '16px 20px',
      shadow: '0 8px 32px rgba(255, 105, 180, 0.25)',
      backdropBlur: 10,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 16,
      borderWidth: 3,
      glow: true,
      glowColor: 'rgba(255, 182, 193, 0.7)',
      glowIntensity: 12
    },
    animation: {
      enabled: true,
      hoverScale: 1.04,
      bounceEffect: true,
      pulseOnRunning: true,
      transitionDuration: 400,
      transitionEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    },
    categoryColors: {
      input: '#FFB7C5',
      ai: '#FF69B4',
      image: '#DDA0DD',
      video: '#BA55D3',
      flow: '#F0E68C',
      output: '#FFD700',
      external: '#E6E6FA'
    },
    edgeColor: '#FFB7C5',
    selectedBorderColor: '#FF69B4'
  },

  // 极简白主题
  {
    id: 'minimal-white',
    name: 'minimal-white',
    displayName: '极简白',
    description: '干净简洁的白色风格',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 12,
      borderWidth: 1,
      padding: '12px 16px',
      shadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
      backdropBlur: 0,
      gradient: false
    },
    handleStyle: {
      size: 10,
      borderWidth: 2,
      glow: false
    },
    animation: {
      enabled: false,
      hoverScale: 1.0,
      bounceEffect: false,
      pulseOnRunning: true
    },
    categoryColors: {
      input: '#64B5F6',
      ai: '#7986CB',
      image: '#81C784',
      video: '#FFB74D',
      flow: '#90A4AE',
      output: '#4DB6AC',
      external: '#A1887F'
    },
    edgeColor: '#90A4AE',
    selectedBorderColor: '#1976D2'
  },

  // 午夜极光主题
  {
    id: 'midnight-aurora',
    name: 'midnight-aurora',
    displayName: '午夜极光',
    description: '深紫色配极光色调，神秘优雅',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 16,
      borderWidth: 2,
      padding: '14px 18px',
      shadow: '0 4px 20px rgba(138, 43, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      backdropBlur: 12,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 14,
      borderWidth: 2,
      glow: true,
      glowColor: 'rgba(138, 43, 226, 0.6)',
      glowIntensity: 12
    },
    animation: {
      enabled: true,
      hoverScale: 1.02,
      bounceEffect: false,
      pulseOnRunning: true,
      transitionDuration: 250,
      transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    },
    categoryColors: {
      input: '#9B59B6',
      ai: '#8E44AD',
      image: '#1ABC9C',
      video: '#E74C3C',
      flow: '#F39C12',
      output: '#3498DB',
      external: '#95A5A6'
    },
    edgeColor: '#9B59B6',
    selectedBorderColor: '#E74C3C'
  },

  // 海洋微风主题
  {
    id: 'ocean-breeze',
    name: 'ocean-breeze',
    displayName: '海洋微风',
    description: '平静的海洋蓝色系，清新舒适',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 18,
      borderWidth: 2,
      padding: '14px 18px',
      shadow: '0 6px 24px rgba(52, 152, 219, 0.25)',
      backdropBlur: 8,
      gradient: true,
      gradientAngle: 180
    },
    handleStyle: {
      size: 14,
      borderWidth: 2,
      glow: true,
      glowColor: 'rgba(52, 152, 219, 0.5)',
      glowIntensity: 10
    },
    animation: {
      enabled: true,
      hoverScale: 1.02,
      bounceEffect: true,
      pulseOnRunning: true,
      transitionDuration: 350,
      transitionEasing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    },
    categoryColors: {
      input: '#3498DB',
      ai: '#2980B9',
      image: '#1ABC9C',
      video: '#9B59B6',
      flow: '#F1C40F',
      output: '#2ECC71',
      external: '#7F8C8D'
    },
    edgeColor: '#3498DB',
    selectedBorderColor: '#2ECC71'
  },

  // 日落渐变主题
  {
    id: 'sunset-gradient',
    name: 'sunset-gradient',
    displayName: '日落渐变',
    description: '温暖的日落色彩，活力温馨',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 20,
      borderWidth: 2,
      padding: '14px 18px',
      shadow: '0 6px 24px rgba(230, 126, 34, 0.25)',
      backdropBlur: 6,
      gradient: true,
      gradientAngle: 135
    },
    handleStyle: {
      size: 14,
      borderWidth: 2,
      glow: true,
      glowColor: 'rgba(230, 126, 34, 0.5)',
      glowIntensity: 10
    },
    animation: {
      enabled: true,
      hoverScale: 1.03,
      bounceEffect: true,
      pulseOnRunning: true,
      transitionDuration: 300,
      transitionEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    },
    categoryColors: {
      input: '#E67E22',
      ai: '#D35400',
      image: '#F39C12',
      video: '#C0392B',
      flow: '#F1C40F',
      output: '#27AE60',
      external: '#8E44AD'
    },
    edgeColor: '#E67E22',
    selectedBorderColor: '#C0392B'
  },

  // 单色优雅主题
  {
    id: 'monochrome-elegant',
    name: 'monochrome-elegant',
    displayName: '单色优雅',
    description: '精致的灰度配色，专业简约',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 12,
      borderWidth: 1,
      padding: '12px 16px',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      backdropBlur: 4,
      gradient: false
    },
    handleStyle: {
      size: 12,
      borderWidth: 2,
      glow: false
    },
    animation: {
      enabled: false,
      hoverScale: 1.01,
      bounceEffect: false,
      pulseOnRunning: true,
      transitionDuration: 200,
      transitionEasing: 'ease'
    },
    categoryColors: {
      input: '#2C3E50',
      ai: '#34495E',
      image: '#7F8C8D',
      video: '#95A5A6',
      flow: '#BDC3C7',
      output: '#1ABC9C',
      external: '#9B59B6'
    },
    edgeColor: '#7F8C8D',
    selectedBorderColor: '#1ABC9C'
  },

  // 电商专业主题 (参考 e-com-flow-ai)
  {
    id: 'ecom-professional',
    name: 'ecom-professional',
    displayName: '电商专业',
    description: '深色专业风格，适合电商自动化工作流',
    isBuiltIn: true,
    nodeStyle: {
      borderRadius: 12,
      borderWidth: 1,
      padding: '12px 16px',
      shadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      backdropBlur: 0,
      gradient: false
    },
    handleStyle: {
      size: 12,
      borderWidth: 2,
      glow: false
    },
    animation: {
      enabled: false,
      hoverScale: 1.0,
      bounceEffect: false,
      pulseOnRunning: true,
      transitionDuration: 200,
      transitionEasing: 'ease'
    },
    categoryColors: {
      input: '#f59e0b',
      ai: '#818cf8',
      image: '#f472b6',
      video: '#a78bfa',
      flow: '#64748b',
      output: '#10b981',
      external: '#06b6d4'
    },
    edgeColor: '#6366f1',
    selectedBorderColor: '#818cf8'
  }
]

/**
 * 根据 ID 获取工作流主题
 */
export function getWorkflowThemeById(id: string): WorkflowNodeTheme | undefined {
  return WORKFLOW_THEMES.find((theme) => theme.id === id)
}

/**
 * 获取默认工作流主题
 */
export function getDefaultWorkflowTheme(): WorkflowNodeTheme {
  return WORKFLOW_THEMES[0]
}

/**
 * 获取分类颜色
 */
export function getCategoryColor(theme: WorkflowNodeTheme, category: string, defaultColor: string = '#1890ff'): string {
  if (theme.categoryColors && category in theme.categoryColors) {
    return theme.categoryColors[category as keyof typeof theme.categoryColors] || defaultColor
  }
  return defaultColor
}
