/**
 * 工作流节点主题类型定义
 * Workflow Node Theme Type Definitions
 */

/**
 * 节点分类
 */
export type NodeCategory = 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output' | 'external' | 'custom'

/**
 * 节点样式配置
 */
export interface WorkflowNodeStyle {
  /** 边框圆角 (px) */
  borderRadius: number
  /** 边框宽度 (px) */
  borderWidth: number
  /** 内边距 */
  padding: string
  /** 阴影 */
  shadow: string
  /** 背景模糊 (px) - 用于玻璃效果 */
  backdropBlur: number
  /** 是否使用渐变背景 */
  gradient: boolean
  /** 渐变方向 (deg) */
  gradientAngle?: number
}

/**
 * Handle 样式配置
 */
export interface WorkflowHandleStyle {
  /** Handle 大小 (px) */
  size: number
  /** 边框宽度 (px) */
  borderWidth: number
  /** 是否启用发光效果 */
  glow: boolean
  /** 发光颜色 */
  glowColor?: string
  /** 发光强度 (px) */
  glowIntensity?: number
}

/**
 * 动画配置
 */
export interface WorkflowAnimationConfig {
  /** 是否启用动画 */
  enabled: boolean
  /** 悬停缩放比例 */
  hoverScale: number
  /** 是否启用弹跳效果 */
  bounceEffect: boolean
  /** 运行时是否脉冲 */
  pulseOnRunning: boolean
  /** 过渡时间 (ms) */
  transitionDuration?: number
  /** 过渡曲线 */
  transitionEasing?: string
}

/**
 * 完整的工作流节点主题
 */
export interface WorkflowNodeTheme {
  /** 主题 ID */
  id: string
  /** 主题名称 (用于代码引用) */
  name: string
  /** 显示名称 (用于 UI) */
  displayName: string
  /** 描述 */
  description?: string
  /** 是否为内置主题 */
  isBuiltIn: boolean

  /** 节点样式 */
  nodeStyle: WorkflowNodeStyle
  /** Handle 样式 */
  handleStyle: WorkflowHandleStyle
  /** 动画配置 */
  animation: WorkflowAnimationConfig

  /** 分类颜色覆盖 */
  categoryColors?: Partial<Record<NodeCategory, string>>

  /** 边颜色 */
  edgeColor?: string
  /** 选中时的边框颜色 */
  selectedBorderColor?: string
}

/**
 * 默认节点样式
 */
export const DEFAULT_NODE_STYLE: WorkflowNodeStyle = {
  borderRadius: 10,
  borderWidth: 1,
  padding: '10px 12px',
  shadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  backdropBlur: 0,
  gradient: false
}

/**
 * 默认 Handle 样式
 */
export const DEFAULT_HANDLE_STYLE: WorkflowHandleStyle = {
  size: 12,
  borderWidth: 2,
  glow: false
}

/**
 * 默认动画配置
 */
export const DEFAULT_ANIMATION_CONFIG: WorkflowAnimationConfig = {
  enabled: false,
  hoverScale: 1.0,
  bounceEffect: false,
  pulseOnRunning: true,
  transitionDuration: 200,
  transitionEasing: 'ease'
}
