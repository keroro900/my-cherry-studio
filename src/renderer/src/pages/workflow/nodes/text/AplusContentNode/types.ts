/**
 * A+ 内容 / 详情页生成节点类型定义
 * A+ Content / Detail Page Node Types
 *
 * 专业级电商详情页内容生成：
 * - 亚马逊 A+ 页面（Enhanced Brand Content）
 * - 淘宝/天猫详情页
 * - Shopify / 独立站产品页
 * - SHEIN / Temu 等跨境平台
 *
 * 支持：多图分析、结构化内容、多语言、SEO 优化
 */

import type { PortDefinition } from '../../base/types'

/**
 * 电商平台类型
 */
export type EcommercePlatform =
  | 'amazon'     // 亚马逊 A+
  | 'taobao'     // 淘宝/天猫
  | 'shopify'    // Shopify 独立站
  | 'shein'      // SHEIN
  | 'temu'       // Temu
  | 'aliexpress' // 速卖通
  | 'general'    // 通用格式

/**
 * A+ 模块类型
 */
export type AplusModuleType =
  | 'standard_header'
  | 'standard_image_text'
  | 'standard_four_image'
  | 'standard_comparison'
  | 'standard_text'
  | 'standard_single_image'
  | 'premium_header'
  | 'premium_video'

/**
 * A+ 模块定义
 */
export interface AplusModule {
  type: AplusModuleType
  name: string
  description: string
  maxCharacters: {
    headline?: number
    body?: number
    caption?: number
  }
  imageRequirements?: {
    count: number
    recommendedSize: string
  }
}

/**
 * A+ 模块规格
 */
export const APLUS_MODULES: Record<AplusModuleType, AplusModule> = {
  standard_header: {
    type: 'standard_header',
    name: '标准品牌头图',
    description: '品牌故事的开篇，包含大图和标题',
    maxCharacters: { headline: 150 },
    imageRequirements: { count: 1, recommendedSize: '970x600' }
  },
  standard_image_text: {
    type: 'standard_image_text',
    name: '图文模块',
    description: '左图右文或上图下文布局',
    maxCharacters: { headline: 160, body: 1000 },
    imageRequirements: { count: 1, recommendedSize: '300x300' }
  },
  standard_four_image: {
    type: 'standard_four_image',
    name: '四图模块',
    description: '展示四个产品特点或场景',
    maxCharacters: { caption: 160 },
    imageRequirements: { count: 4, recommendedSize: '220x220' }
  },
  standard_comparison: {
    type: 'standard_comparison',
    name: '对比表格',
    description: '产品对比或规格表格',
    maxCharacters: { headline: 160, body: 500 }
  },
  standard_text: {
    type: 'standard_text',
    name: '纯文本模块',
    description: '详细产品描述文本',
    maxCharacters: { headline: 160, body: 2000 }
  },
  standard_single_image: {
    type: 'standard_single_image',
    name: '单图模块',
    description: '单张大图展示',
    maxCharacters: {},
    imageRequirements: { count: 1, recommendedSize: '970x300' }
  },
  premium_header: {
    type: 'premium_header',
    name: '高级品牌头图',
    description: '高级 A+ 的交互式头图',
    maxCharacters: { headline: 100, body: 500 },
    imageRequirements: { count: 1, recommendedSize: '1464x600' }
  },
  premium_video: {
    type: 'premium_video',
    name: '视频模块',
    description: '高级 A+ 的视频展示',
    maxCharacters: { headline: 100, caption: 300 }
  }
}

/**
 * 内容风格
 */
export type ContentStyle = 'professional' | 'emotional' | 'technical' | 'lifestyle' | 'premium'

/**
 * 输出语言
 */
export type AplusLanguage = 'en-US' | 'de-DE' | 'fr-FR' | 'it-IT' | 'es-ES' | 'ja-JP' | 'zh-CN'

/**
 * A+ 内容配置
 */
export interface AplusContentConfig {
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** 目标平台 */
  platform: EcommercePlatform
  /** 模块类型列表 */
  moduleTypes: AplusModuleType[]
  /** 内容风格 */
  contentStyle: ContentStyle
  /** 输出语言 */
  language: AplusLanguage
  /** 品牌名称 */
  brandName?: string
  /** 产品关键词 */
  keywords?: string
  /** 目标受众 */
  targetAudience?: string
  /** 产品类目 */
  productCategory?: string
  /** 价格定位 */
  pricePosition?: 'budget' | 'mid' | 'premium' | 'luxury'
  /** 是否启用深度图片分析 */
  enableDeepAnalysis?: boolean
  /** 是否生成 SEO 关键词 */
  enableSeoKeywords?: boolean
  /** 是否生成图片建议 */
  enableImageSuggestions?: boolean
  /** 动态图片输入端口配置 */
  imageInputPorts?: PortDefinition[]
  /** 图片输入数量 */
  imageInputCount?: number
  /** 温度参数 */
  temperature?: number
  /** 自定义提示词 */
  customPrompts?: {
    system?: string
    user?: string
  }
}

/**
 * 单个模块的输出内容
 */
export interface AplusModuleContent {
  type: AplusModuleType
  moduleName: string
  headline?: string
  body?: string
  captions?: string[]
  imageCount?: number
  imageSuggestions?: string[]
}

/**
 * A+ 内容输出
 */
export interface AplusContentOutput {
  /** 所有模块内容 */
  modules: AplusModuleContent[]
  /** 页面整体描述 */
  pageSummary: string
  /** 原始 JSON */
  rawJson: Record<string, any>
}

/**
 * 语言标签映射
 */
export const APLUS_LANGUAGE_LABELS: Record<AplusLanguage, string> = {
  'en-US': 'English (US)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'it-IT': 'Italiano',
  'es-ES': 'Español',
  'ja-JP': '日本語',
  'zh-CN': '简体中文'
}

/**
 * 风格标签映射
 */
export const CONTENT_STYLE_LABELS: Record<ContentStyle, string> = {
  professional: '专业',
  emotional: '情感',
  technical: '技术',
  lifestyle: '生活方式',
  premium: '高端奢华'
}

/**
 * 平台标签映射
 */
export const PLATFORM_LABELS: Record<EcommercePlatform, string> = {
  amazon: '亚马逊 A+',
  taobao: '淘宝/天猫',
  shopify: 'Shopify 独立站',
  shein: 'SHEIN',
  temu: 'Temu',
  aliexpress: '速卖通',
  general: '通用格式'
}

/**
 * 价格定位标签
 */
export const PRICE_POSITION_LABELS: Record<string, string> = {
  budget: '性价比',
  mid: '中端',
  premium: '高端',
  luxury: '奢侈品'
}

/**
 * 产品类目列表
 */
export const PRODUCT_CATEGORIES = [
  { value: 'electronics', label: '电子产品' },
  { value: 'fashion', label: '时尚服饰' },
  { value: 'beauty', label: '美妆个护' },
  { value: 'home', label: '家居家具' },
  { value: 'food', label: '食品饮料' },
  { value: 'sports', label: '运动户外' },
  { value: 'toys', label: '玩具母婴' },
  { value: 'jewelry', label: '珠宝首饰' },
  { value: 'auto', label: '汽车用品' },
  { value: 'other', label: '其他' }
] as const
