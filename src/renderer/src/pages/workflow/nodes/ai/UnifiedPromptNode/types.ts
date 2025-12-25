/**
 * 统一提示词节点 - 类型定义
 */

import type { OutputMode } from '../../../types/prompt-json'

/**
 * 风格模式
 */
export type StyleMode = 'daily' | 'commercial'

/**
 * 年龄段
 */
export type AgeGroup = 'small_kid' | 'big_kid' | 'adult'

/**
 * 性别
 */
export type Gender = 'male' | 'female'

/**
 * 场景预设
 */
export type ScenePreset = 'home' | 'outdoor' | 'studio'

/**
 * 人种预设
 */
export type EthnicityPreset = 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed'

/**
 * 姿态预设
 */
export type PosePreset = 'natural' | 'sitting' | 'playing'

/**
 * 图案类型
 */
export type PatternType = 'seamless' | 'placement' | 'allover'

/**
 * 图案风格
 */
export type PatternStyle = 'auto' | 'kawaii' | 'sporty' | 'preppy' | 'ip_theme' | 'sweet' | 'geometric' | 'text'

/**
 * 展示模式
 */
export type DisplayMode = 'flat_lay' | 'hanger' | 'scene' | 'model'

/**
 * 平台风格
 */
export type PlatformStyle = 'shein' | 'temu' | 'amazon' | 'taobao' | 'xiaohongshu'

/**
 * 填充模式（电商图）
 * - none: AI 自由发挥
 * - random: 随机选择
 * - filled: 有填充（Ghost Mannequin）
 * - flat: 自然平铺
 */
export type FillMode = 'none' | 'random' | 'filled' | 'flat'

/**
 * 布局模式（电商图）
 * - none: AI 自由发挥
 * - random: 随机选择
 * - flat_lay: 平铺图
 * - hanging: 挂拍图
 */
export type LayoutMode = 'none' | 'random' | 'flat_lay' | 'hanging'

/**
 * 统一提示词节点配置
 */
export interface UnifiedPromptNodeConfig {
  // 模型选择（新格式）
  model?: {
    id: string
    provider: string
  } | null
  // 兼容旧格式
  providerId?: string
  modelId?: string

  // 输出模式（核心）
  outputMode: OutputMode

  // 通用配置
  ageGroup: AgeGroup
  gender: Gender

  // 模特模式专用
  styleMode?: StyleMode
  scenePreset?: ScenePreset
  ethnicityPreset?: EthnicityPreset
  posePreset?: PosePreset

  // 图案模式专用
  patternType?: PatternType
  patternStyle?: PatternStyle

  // 电商图模式专用
  displayMode?: DisplayMode
  platformStyle?: PlatformStyle
  fillMode?: FillMode
  layoutMode?: LayoutMode

  // 通用高级配置
  constraintPrompt?: string
  visualAnchors?: string
  temperature?: number

  // 用户自定义提示词（UI 编辑后保存）
  customPrompts?: Record<string, string>
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: UnifiedPromptNodeConfig = {
  model: null, // 自动选择视觉模型
  outputMode: 'model',
  ageGroup: 'small_kid',
  gender: 'female',
  styleMode: 'daily',
  scenePreset: 'home',
  ethnicityPreset: 'asian',
  posePreset: 'natural',
  patternType: 'seamless',
  patternStyle: 'auto',
  displayMode: 'flat_lay',
  platformStyle: 'shein',
  fillMode: 'none', // 默认 AI 自由发挥
  layoutMode: 'none', // 默认 AI 自由发挥
  temperature: 0.7
}
