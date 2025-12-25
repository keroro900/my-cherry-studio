/**
 * 产品描述生成节点类型定义
 * Product Description Node Types
 *
 * 使用文本模型生成多语言产品描述、卖点列表和SEO关键词
 */

/**
 * 目标平台类型
 */
export type PlatformType = 'amazon' | 'shopify' | 'taobao' | 'shein' | 'temu' | 'general'

/**
 * 输出语言
 */
export type OutputLanguage = 'zh-CN' | 'en-US' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'multi'

/**
 * 文案风格
 */
export type ToneStyle = 'professional' | 'casual' | 'luxury' | 'playful' | 'technical' | 'emotional'

/**
 * 输出格式
 */
export type OutputFormat = 'title_bullets' | 'paragraph' | 'full_listing' | 'json'

/**
 * 产品描述节点配置
 */
export interface ProductDescriptionConfig {
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** 目标平台 */
  platform: PlatformType
  /** 输出语言 */
  language: OutputLanguage
  /** 文案风格 */
  toneStyle: ToneStyle
  /** 输出格式 */
  outputFormat: OutputFormat
  /** 是否包含 SEO 关键词 */
  includeSEO: boolean
  /** 卖点数量 */
  bulletCount: number
  /** 标题最大字符数 */
  maxTitleLength: number
  /** 描述最大字符数 */
  maxDescriptionLength: number
  /** 自定义提示词 */
  customPrompts?: {
    system?: string
    user?: string
  }
  /** 温度参数 */
  temperature?: number
}

/**
 * 产品描述输出结构
 */
export interface ProductDescriptionOutput {
  /** 产品标题 */
  title: string
  /** 产品描述 */
  description: string
  /** 卖点列表 */
  bullets: string[]
  /** SEO 关键词 */
  seoKeywords: string[]
  /** 原始 JSON（完整输出） */
  rawJson: Record<string, any>
}

/**
 * 平台配置信息
 */
export interface PlatformConfig {
  /** 平台 ID */
  id: PlatformType
  /** 平台名称 */
  name: string
  /** 标题最大长度 */
  maxTitleLength: number
  /** 描述最大长度 */
  maxDescriptionLength: number
  /** 卖点数量 */
  bulletCount: number
  /** 平台特色关键词 */
  styleKeywords: string
}

/**
 * 平台配置映射
 */
export const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    maxTitleLength: 200,
    maxDescriptionLength: 2000,
    bulletCount: 5,
    styleKeywords: 'SEO-optimized, keyword-rich, feature-benefit focused'
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    maxTitleLength: 150,
    maxDescriptionLength: 5000,
    bulletCount: 4,
    styleKeywords: 'Brand storytelling, lifestyle-focused, emotional appeal'
  },
  taobao: {
    id: 'taobao',
    name: '淘宝/天猫',
    maxTitleLength: 60,
    maxDescriptionLength: 3000,
    bulletCount: 5,
    styleKeywords: '促销关键词、详情卖点、情感共鸣'
  },
  shein: {
    id: 'shein',
    name: 'SHEIN',
    maxTitleLength: 100,
    maxDescriptionLength: 1000,
    bulletCount: 4,
    styleKeywords: 'Trendy, fashion-forward, youthful appeal'
  },
  temu: {
    id: 'temu',
    name: 'TEMU',
    maxTitleLength: 120,
    maxDescriptionLength: 1500,
    bulletCount: 5,
    styleKeywords: 'Value-focused, practical benefits, clear specifications'
  },
  general: {
    id: 'general',
    name: '通用',
    maxTitleLength: 150,
    maxDescriptionLength: 2000,
    bulletCount: 5,
    styleKeywords: 'Clear, informative, professional'
  }
}

/**
 * 语言标签映射
 */
export const LANGUAGE_LABELS: Record<OutputLanguage, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English (US)',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  multi: '多语言'
}

/**
 * 风格标签映射
 */
export const TONE_STYLE_LABELS: Record<ToneStyle, string> = {
  professional: '专业',
  casual: '休闲',
  luxury: '奢华',
  playful: '活泼',
  technical: '技术',
  emotional: '情感'
}
