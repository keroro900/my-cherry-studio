/**
 * 多模态类型定义
 */

/**
 * 模态类型
 */
export type Modality = 'text' | 'image' | 'video' | 'audio'

/**
 * 多模态内容
 */
export interface MultimodalContent {
  type: Modality
  content: string | Buffer
  metadata?: Record<string, any>
}

/**
 * 图片嵌入选项
 */
export interface ImageEmbedOptions {
  /** 目标尺寸 */
  targetSize?: number
  /** 是否归一化 */
  normalize?: boolean
}

/**
 * 视频嵌入选项
 */
export interface VideoEmbedOptions {
  /** 提取帧数 */
  frameCount?: number
  /** 采样策略: uniform(均匀) | keyframe(关键帧) */
  samplingStrategy?: 'uniform' | 'keyframe'
  /** 是否提取音频 */
  extractAudio?: boolean
}

/**
 * 音频嵌入选项
 */
export interface AudioEmbedOptions {
  /** 采样率 */
  sampleRate?: number
  /** 是否转录 */
  transcribe?: boolean
}

/**
 * 视频嵌入结果
 */
export interface VideoEmbedding {
  /** 帧嵌入 */
  frameEmbeddings: Array<{
    timestamp: number
    embedding: number[]
  }>
  /** 聚合嵌入 */
  aggregatedEmbedding: number[]
  /** 转录文本 (如果有音频) */
  transcription?: string
  /** 元数据 */
  metadata?: {
    duration: number
    frameCount: number
    resolution?: { width: number; height: number }
  }
}

/**
 * 音频嵌入结果
 */
export interface AudioEmbedding {
  /** 音频嵌入向量 */
  embedding: number[]
  /** 转录文本 */
  transcription?: string
  /** 元数据 */
  metadata?: {
    duration: number
    language?: string
  }
}

/**
 * 统一嵌入结果
 */
export interface UnifiedEmbedding {
  modality: Modality
  embedding: number[]
  metadata?: Record<string, any>
}

/**
 * 图片搜索结果
 */
export interface ImageSearchResult {
  id: string
  score: number
  imagePath: string
  metadata?: Record<string, any>
}

/**
 * 文本搜索结果
 */
export interface TextSearchResult {
  id: string
  score: number
  text: string
  metadata?: Record<string, any>
}

/**
 * 多模态搜索结果
 */
export interface MultimodalSearchResult {
  id: string
  modality: Modality
  score: number
  content: string | Buffer
  metadata?: Record<string, any>
}

/**
 * 多模态查询
 */
export interface MultimodalQuery {
  type: Modality
  content: string | Buffer
  options?: {
    topK?: number
    threshold?: number
  }
}

/**
 * 信息链节点
 */
export interface ChainNode {
  id: string
  modality: Modality
  content: any
  embedding?: number[]
  metadata: Record<string, any>
}

/**
 * 信息链边
 */
export interface ChainEdge {
  source: string
  target: string
  relation: 'similar' | 'describes' | 'references' | 'contains' | 'temporal'
  weight: number
  metadata?: Record<string, any>
}

/**
 * 信息链
 */
export interface InformationChain {
  nodes: ChainNode[]
  edges: ChainEdge[]
  metadata?: {
    createdAt: Date
    query?: string
    depth?: number
  }
}

/**
 * 多模态嵌入服务配置
 */
export interface MultimodalEmbeddingConfig {
  /** 图片嵌入提供者: clip | jina | bge */
  imageProvider?: 'clip' | 'jina' | 'bge'
  /** 文本嵌入提供者 */
  textProvider?: 'openai' | 'voyage' | 'ollama'
  /** 音频转录提供者 */
  audioProvider?: 'whisper' | 'local'
  /** API 密钥 */
  apiKey?: string
  /** 基础 URL */
  baseUrl?: string
}
