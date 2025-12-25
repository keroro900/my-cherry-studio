/**
 * 统一预设类型定义
 * Unified Preset Type Definitions
 *
 * 所有预设类型的单一来源（Single Source of Truth）
 */

// ==================== 年龄段预设类型 ====================

/**
 * 年龄段预设
 */
export interface AgePreset {
  /** 英文描述 */
  en: string
  /** 年龄范围描述 */
  ageRange: string
  /** 默认年龄 */
  defaultAge: number
  /** 姿势描述 */
  pose: string
  /** 表情描述 */
  expression: string
}

// ==================== 性别预设类型 ====================

/**
 * 性别预设
 */
export interface GenderPreset {
  /** 英文描述 */
  en: string
  /** 标签（boy/girl） */
  label: string
  /** 特征描述 */
  features: string
}

// ==================== 场景预设类型 ====================

/**
 * 场景预设
 */
export interface ScenePreset {
  /** 英文描述 */
  en: string
  /** 灯光描述 */
  lighting: string
  /** 背景描述 */
  background: string
  /** 道具描述 */
  props: string
  /** 前景描述（可选） */
  foreground?: string
  /** 中景描述（可选） */
  midground?: string
  /** 构图描述（可选） */
  composition?: string
  /** 视觉风格（可选） */
  visual_style?: string
}

// ==================== 人种预设类型 ====================

/**
 * 人种预设
 */
export interface EthnicityPreset {
  /** 英文描述 */
  en: string
  /** 详细描述 */
  description: string
}

// ==================== 姿势预设类型 ====================

/**
 * 姿势预设
 */
export interface PosePreset {
  /** 英文描述 */
  en: string
  /** 详细描述 */
  description: string
}

// ==================== 电商平台预设类型 ====================

/**
 * 电商平台风格预设
 */
export interface EcomPlatformPreset {
  /** 预设 ID */
  id: string
  /** 预设名称 */
  name: string
  /** 平台标识 */
  platform: string
  /** 描述 */
  description: string
  /** 系统提示词 */
  systemPrompt: string
  /** 风格关键词 */
  styleKeywords: string[]
  /** 灯光风格 */
  lighting: string
  /** 背景风格 */
  background: string
  /** 姿势风格 */
  pose: string
  /** 色调风格 */
  colorTone: string
  /** 相机参数 */
  cameraParams: string
}

// ==================== 图案风格预设类型 ====================

/**
 * 图案风格预设
 */
export interface PatternStylePreset {
  /** 预设 ID */
  id: string
  /** 预设名称 */
  name: string
  /** 中文名称 */
  nameZh: string
  /** 风格描述 */
  description: string
  /** 风格关键词 */
  keywords: string[]
  /** 提示词模板 */
  promptTemplate: string
}

// ==================== 电商布局类型 ====================

/**
 * 电商图布局类型
 */
export type EcomLayoutType = 'flatlay' | 'hanging'

/**
 * 电商图填充类型
 */
export type EcomFillType = 'filled' | 'flat'

/**
 * 电商细节图类型
 */
export type EcomDetailType = 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'

// ==================== 提示词块类型 ====================

/**
 * 提示词构建块
 */
export interface PromptBlock {
  /** 块名称 */
  name: string
  /** 块内容 */
  content: string
  /** 优先级（可选） */
  priority?: number
}

/**
 * 提示词构建配置
 */
export interface PromptBuilderConfig {
  /** 是否包含核心概念 */
  includeCore?: boolean
  /** 是否包含主题规则 */
  includeTheme?: boolean
  /** 是否包含 JSON 约束 */
  includeJsonConstraints?: boolean
  /** 自定义约束 */
  customConstraints?: string
}
