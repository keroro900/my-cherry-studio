import type { ApiClient, Model } from '@types'

import type { FileMetadata } from './file'

export type KnowledgeItemType = 'file' | 'url' | 'note' | 'sitemap' | 'directory' | 'memory' | 'video'

export type KnowledgeItem = {
  id: string
  baseId?: string
  uniqueId?: string
  uniqueIds?: string[]
  type: KnowledgeItemType
  content: string | FileMetadata | FileMetadata[]
  remark?: string
  created_at: number
  updated_at: number
  processingStatus?: ProcessingStatus
  processingProgress?: number
  processingError?: string
  retryCount?: number
  isPreprocessed?: boolean
}

export type KnowledgeFileItem = KnowledgeItem & {
  type: 'file'
  content: FileMetadata
}

export const isKnowledgeFileItem = (item: KnowledgeItem): item is KnowledgeFileItem => {
  return item.type === 'file'
}

export type KnowledgeVideoItem = KnowledgeItem & {
  type: 'video'
  content: FileMetadata[]
}

export const isKnowledgeVideoItem = (item: KnowledgeItem): item is KnowledgeVideoItem => {
  return item.type === 'video'
}

export type KnowledgeNoteItem = KnowledgeItem & {
  type: 'note'
  content: string
  sourceUrl?: string
}

export const isKnowledgeNoteItem = (item: KnowledgeItem): item is KnowledgeNoteItem => {
  return item.type === 'note'
}

export type KnowledgeDirectoryItem = KnowledgeItem & {
  type: 'directory'
  content: string
}

export const isKnowledgeDirectoryItem = (item: KnowledgeItem): item is KnowledgeDirectoryItem => {
  return item.type === 'directory'
}

export type KnowledgeUrlItem = KnowledgeItem & {
  type: 'url'
  content: string
}

export const isKnowledgeUrlItem = (item: KnowledgeItem): item is KnowledgeUrlItem => {
  return item.type === 'url'
}

export type KnowledgeSitemapItem = KnowledgeItem & {
  type: 'sitemap'
  content: string
}

export const isKnowledgeSitemapItem = (item: KnowledgeItem): item is KnowledgeSitemapItem => {
  return item.type === 'sitemap'
}

export type KnowledgeGeneralItem = KnowledgeItem & {
  content: string
}

/**
 * 知识库类型
 */
export type KnowledgeType = 'general' | 'fashion'

export interface KnowledgeBase {
  id: string
  name: string
  model: Model
  dimensions?: number
  description?: string
  items: KnowledgeItem[]
  created_at: number
  updated_at: number
  version: number
  documentCount?: number
  chunkSize?: number
  chunkOverlap?: number
  threshold?: number
  rerankModel?: Model
  /**
   * 知识库类型 - 用于特殊处理逻辑
   * - general: 通用知识库
   * - fashion: 时尚知识库（支持服装图片分析、结构化元数据）
   */
  knowledgeType?: KnowledgeType
  // topN?: number
  // preprocessing?: boolean
  preprocessProvider?: {
    type: 'preprocess'
    provider: PreprocessProvider
  }
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export const PreprocessProviderIds = {
  doc2x: 'doc2x',
  mistral: 'mistral',
  mineru: 'mineru',
  'open-mineru': 'open-mineru',
  fashion: 'fashion'
} as const

export type PreprocessProviderId = keyof typeof PreprocessProviderIds

export const isPreprocessProviderId = (id: string): id is PreprocessProviderId => {
  return Object.hasOwn(PreprocessProviderIds, id)
}

export interface PreprocessProvider {
  id: PreprocessProviderId
  name: string
  apiKey?: string
  apiHost?: string
  model?: string
  options?: any
  quota?: number
}

export type KnowledgeBaseParams = {
  id: string
  dimensions?: number
  chunkSize?: number
  chunkOverlap?: number
  embedApiClient: ApiClient
  rerankApiClient?: ApiClient
  documentCount?: number
  knowledgeType?: KnowledgeType
  // preprocessing?: boolean
  preprocessProvider?: {
    type: 'preprocess'
    provider: PreprocessProvider
  }
}

export type KnowledgeReference = {
  id: number
  content: string
  sourceUrl: string
  type: KnowledgeItemType
  file?: FileMetadata
  metadata?: Record<string, any>
}

export interface KnowledgeSearchResult {
  pageContent: string
  score: number
  metadata: Record<string, any>
}

// ==================== Fashion 元数据类型 ====================

/**
 * 服装品类
 */
export type FashionCategory = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'accessories'

/**
 * 图案类型
 */
export type FashionPattern = 'solid' | 'stripes' | 'plaid' | 'floral' | 'abstract' | 'graphic' | 'geometric' | 'animal'

/**
 * 色调类型
 */
export type FashionColorTone = 'warm' | 'cool' | 'neutral'

/**
 * 版型类型
 */
export type FashionSilhouette = 'fitted' | 'relaxed' | 'oversized' | 'structured'

/**
 * 目标受众
 */
export type FashionTargetAudience = 'kids' | 'teens' | 'young adults' | 'adults'

/**
 * 性别
 */
export type FashionGender = 'male' | 'female' | 'unisex'

/**
 * 季节
 */
export type FashionSeason = 'spring' | 'summer' | 'fall' | 'winter'

/**
 * 价格区间
 */
export type FashionPriceSegment = 'budget' | 'mid-range' | 'premium'

/**
 * Fashion 元数据 - 服装属性
 * 用于结构化存储和检索服装信息
 */
export interface FashionMetadata {
  // 基础信息
  category?: FashionCategory
  subcategory?: string
  gender?: FashionGender
  targetAudience?: FashionTargetAudience

  // 颜色信息
  primaryColor?: string
  secondaryColors?: string[]
  colorTone?: FashionColorTone

  // 图案信息
  pattern?: FashionPattern
  patternDescription?: string

  // 款式信息
  silhouette?: FashionSilhouette
  neckline?: string
  sleeveLength?: string
  length?: string

  // 材质和设计
  material?: string[]
  designElements?: string[]

  // 风格和季节
  styleTags?: string[]
  season?: FashionSeason[]
  priceSegment?: FashionPriceSegment

  // 文字描述
  description?: string

  // 数据来源信息
  dataSource?: string
  captureDate?: string
  salesVolume?: number
  trendScore?: number

  // 原始数据（用于调试）
  rawResponse?: string
  parseError?: boolean
}

/**
 * Fashion 知识库 Item
 * 扩展 KnowledgeItem 添加 Fashion 专用元数据
 */
export type FashionKnowledgeItem = KnowledgeItem & {
  fashionMetadata?: FashionMetadata
}

/**
 * 检查 KnowledgeItem 是否为 Fashion 类型
 */
export const isFashionKnowledgeItem = (item: KnowledgeItem): item is FashionKnowledgeItem => {
  return 'fashionMetadata' in item && item.fashionMetadata !== undefined
}

/**
 * Fashion 知识库扩展配置
 */
export interface FashionKnowledgeBaseConfig {
  // 是否启用 Fashion 结构化检索
  enableStructuredSearch?: boolean
  // 默认品类过滤
  defaultCategory?: FashionCategory
  // 默认季节过滤
  defaultSeason?: FashionSeason
  // 默认目标受众
  defaultAudience?: FashionTargetAudience
}

/**
 * Fashion 搜索过滤条件
 */
export interface FashionSearchFilter {
  category?: FashionCategory | FashionCategory[]
  pattern?: FashionPattern | FashionPattern[]
  colorTone?: FashionColorTone
  primaryColor?: string
  season?: FashionSeason | FashionSeason[]
  gender?: FashionGender
  targetAudience?: FashionTargetAudience
  styleTags?: string[]
  priceSegment?: FashionPriceSegment
  // 趋势分数范围
  minTrendScore?: number
  maxTrendScore?: number
}

/**
 * Fashion 搜索结果
 * 扩展标准搜索结果，包含 Fashion 元数据
 */
export interface FashionSearchResult extends KnowledgeSearchResult {
  fashionMetadata?: FashionMetadata
}

/**
 * 从 KnowledgeSearchResult 提取 Fashion 元数据
 */
export const extractFashionMetadata = (result: KnowledgeSearchResult): FashionMetadata | undefined => {
  const meta = result.metadata
  if (!meta) return undefined

  // 检查是否有 Fashion 相关字段
  if (meta.category || meta.primaryColor || meta.pattern) {
    return {
      category: meta.category,
      subcategory: meta.subcategory,
      gender: meta.gender,
      targetAudience: meta.targetAudience,
      primaryColor: meta.primaryColor,
      secondaryColors: meta.secondaryColors,
      colorTone: meta.colorTone,
      pattern: meta.pattern,
      patternDescription: meta.patternDescription,
      silhouette: meta.silhouette,
      neckline: meta.neckline,
      sleeveLength: meta.sleeveLength,
      length: meta.length,
      material: meta.material,
      designElements: meta.designElements,
      styleTags: meta.styleTags,
      season: meta.season,
      priceSegment: meta.priceSegment,
      description: meta.description,
      dataSource: meta.dataSource,
      captureDate: meta.captureDate,
      salesVolume: meta.salesVolume,
      trendScore: meta.trendScore
    }
  }

  return undefined
}
