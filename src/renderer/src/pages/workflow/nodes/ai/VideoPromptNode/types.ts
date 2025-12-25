/**
 * 视频提示词节点 - 类型定义
 */

/**
 * 视频时长
 */
export type VideoDuration = '5s' | '10s'

/**
 * 动作类型
 */
export type MotionType = 'gentle' | 'playful' | 'static'

/**
 * 视频提示词节点配置
 */
export interface VideoPromptNodeConfig {
  // 模型选择
  providerId?: string
  modelId?: string

  // 视频配置
  duration: VideoDuration
  motionType: MotionType

  // 约束配置
  noTurning: boolean // 禁止转身
  noFastMotion: boolean // 禁止快速动作

  // 高级配置
  constraintPrompt?: string
  temperature?: number

  // 用户自定义提示词（UI 编辑后保存）
  customPrompts?: Record<string, string>
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: VideoPromptNodeConfig = {
  duration: '5s',
  motionType: 'gentle',
  noTurning: true,
  noFastMotion: true,
  temperature: 0.7
}
