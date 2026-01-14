/**
 * Music Generation Node Types
 * 音乐生成节点类型定义
 */

/**
 * 音乐生成模式
 */
export type MusicGenerationMode = 'custom' | 'description' | 'continuation'

/**
 * 音乐生成提供商
 */
export type MusicProvider = 'suno' | 'udio' | 'custom_api'

/**
 * 音乐生成节点配置
 */
export interface MusicGenerationNodeConfig {
  /** 提供商 */
  provider: MusicProvider
  /** 生成模式 */
  mode: MusicGenerationMode
  /** API 地址（自定义 API 模式） */
  apiUrl?: string
  /** API Key */
  apiKey?: string
  /** 是否为纯音乐（无歌词） */
  instrumental: boolean
  /** 音乐时长（秒） */
  duration?: number
  /** 是否等待完成 */
  waitForCompletion: boolean
  /** 轮询间隔（毫秒） */
  pollInterval: number
  /** 最大等待时间（秒） */
  maxWaitTime: number
}

/**
 * 音乐生成请求参数
 */
export interface MusicGenerationRequest {
  /** 歌词（custom 模式） */
  lyrics?: string
  /** 音乐风格 */
  style?: string
  /** 歌曲标题 */
  title?: string
  /** 音乐描述（description 模式） */
  description?: string
  /** 继续生成的音频 ID（continuation 模式） */
  continueFrom?: string
  /** 是否为纯音乐 */
  instrumental?: boolean
  /** 时长 */
  duration?: number
}

/**
 * 音乐生成结果
 */
export interface MusicGenerationResult {
  /** 生成的音乐 ID */
  id: string
  /** 音乐标题 */
  title: string
  /** 音乐风格标签 */
  tags?: string[]
  /** 音频 URL */
  audioUrl?: string
  /** 封面图 URL */
  coverUrl?: string
  /** 歌词 */
  lyrics?: string
  /** 生成状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 音乐时长（秒） */
  duration?: number
  /** 创建时间 */
  createdAt?: string
  /** 错误信息 */
  error?: string
}

/**
 * 音乐生成节点输出
 */
export interface MusicGenerationNodeOutput {
  /** 生成结果列表 */
  results: MusicGenerationResult[]
  /** 主音乐 URL */
  audioUrl?: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 任务 ID（用于后续查询） */
  taskId?: string
}
