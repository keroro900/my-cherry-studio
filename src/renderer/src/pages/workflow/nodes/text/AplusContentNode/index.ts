/**
 * A+ 内容 / 详情页生成节点
 * A+ Content / Detail Page Node
 *
 * 专业级电商详情页内容生成：
 * - 亚马逊 A+ 页面（Enhanced Brand Content）
 * - 淘宝/天猫详情页
 * - Shopify / 独立站产品页
 * - 支持多图深度分析、结构化内容、多语言输出
 */

import type { NodeDefinition } from '../../base/types'
import { AplusContentExecutor } from './executor'
import type { AplusLanguage, AplusModuleType, ContentStyle, EcommercePlatform } from './types'
import {
  APLUS_LANGUAGE_LABELS,
  APLUS_MODULES,
  CONTENT_STYLE_LABELS,
  PLATFORM_LABELS,
  PRICE_POSITION_LABELS,
  PRODUCT_CATEGORIES
} from './types'

// 生成模块类型选项
const MODULE_TYPE_OPTIONS = Object.entries(APLUS_MODULES).map(([id, module]) => ({
  label: module.name,
  value: id,
  description: module.description
}))

// 生成语言选项
const LANGUAGE_OPTIONS = Object.entries(APLUS_LANGUAGE_LABELS).map(([value, label]) => ({
  label,
  value
}))

// 生成风格选项
const STYLE_OPTIONS = Object.entries(CONTENT_STYLE_LABELS).map(([value, label]) => ({
  label,
  value
}))

// 生成平台选项
const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
  label,
  value
}))

// 生成价格定位选项
const PRICE_OPTIONS = Object.entries(PRICE_POSITION_LABELS).map(([value, label]) => ({
  label,
  value
}))

export const AplusContentNode: NodeDefinition = {
  metadata: {
    type: 'aplus_content',
    label: '详情页生成',
    icon: '📄',
    category: 'text',
    version: '2.0.0',
    author: 'Cherry Studio',
    description: '专业级电商详情页内容生成，支持多图分析和多平台适配',
    tags: ['text', 'amazon', 'aplus', 'ecommerce', 'content', 'detail-page', 'seo']
  },

  inputs: [
    {
      id: 'productInfo',
      label: '产品信息',
      dataType: 'text',
      required: false,
      description: '产品名称、特点、卖点等文本信息'
    },
    {
      id: 'promptJson',
      label: '提示词 JSON',
      dataType: 'json',
      required: false,
      description: '从智能提示词节点传入的结构化 JSON'
    }
    // 动态图片端口通过 imageInputPorts 配置
  ],

  outputs: [
    {
      id: 'modules',
      label: '模块内容',
      dataType: 'json',
      description: '所有详情页模块的结构化内容'
    },
    {
      id: 'pageSummary',
      label: '页面摘要',
      dataType: 'text',
      description: '详情页的整体内容策略摘要'
    },
    {
      id: 'fullContent',
      label: '完整文本',
      dataType: 'text',
      description: '所有模块的格式化文本内容'
    },
    {
      id: 'seoKeywords',
      label: 'SEO 关键词',
      dataType: 'json',
      description: '提取的 SEO 关键词及其使用建议'
    },
    {
      id: 'imageSuggestions',
      label: '图片建议',
      dataType: 'json',
      description: '每个模块的图片拍摄/设计建议'
    },
    {
      id: 'rawJson',
      label: '原始 JSON',
      dataType: 'json',
      description: '原始 JSON 响应数据'
    }
  ],

  configSchema: {
    fields: [
      // ========== 模型选择 ==========
      {
        key: 'providerId',
        label: 'AI 提供商',
        type: 'model-selector',
        required: true,
        description: '选择支持视觉分析的 AI 模型（如 GPT-4o、Claude 3.5、Gemini）'
      },

      // ========== 平台选择 ==========
      {
        key: 'platform',
        label: '目标平台',
        type: 'select',
        required: true,
        default: 'amazon',
        options: PLATFORM_OPTIONS,
        description: '选择电商平台，不同平台有不同的内容规范'
      },

      // ========== 模块配置 ==========
      {
        key: 'moduleTypes',
        label: '内容模块',
        type: 'select',
        required: true,
        multiple: true,
        default: ['standard_header', 'standard_image_text', 'standard_four_image'],
        options: MODULE_TYPE_OPTIONS,
        description: '选择要生成的详情页模块类型（可多选）'
      },

      // ========== 产品信息 ==========
      {
        key: 'productCategory',
        label: '产品类目',
        type: 'select',
        required: false,
        options: PRODUCT_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
        description: '帮助生成更精准的行业术语和卖点'
      },
      {
        key: 'pricePosition',
        label: '价格定位',
        type: 'select',
        required: false,
        default: 'mid',
        options: PRICE_OPTIONS,
        description: '影响内容的调性和用词'
      },

      // ========== 内容风格 ==========
      {
        key: 'contentStyle',
        label: '内容风格',
        type: 'select',
        required: true,
        default: 'professional',
        options: STYLE_OPTIONS,
        description: '选择内容的写作风格'
      },

      // ========== 语言设置 ==========
      {
        key: 'language',
        label: '输出语言',
        type: 'select',
        required: true,
        default: 'en-US',
        options: LANGUAGE_OPTIONS,
        description: '生成内容的语言'
      },

      // ========== 品牌信息 ==========
      {
        key: 'brandName',
        label: '品牌名称',
        type: 'text',
        required: false,
        placeholder: '输入品牌名称',
        description: '用于内容中的品牌提及'
      },
      {
        key: 'keywords',
        label: '关键词',
        type: 'textarea',
        required: false,
        placeholder: '输入要包含的关键词，用逗号分隔',
        description: '需要自然融入内容的关键词'
      },
      {
        key: 'targetAudience',
        label: '目标受众',
        type: 'text',
        required: false,
        placeholder: '如：25-45岁女性消费者',
        description: '帮助调整内容的语气和关注点'
      },

      // ========== 图片输入 ==========
      {
        key: 'imageInputPorts',
        label: '📷 产品图片',
        type: 'image-input-ports',
        min: 1,
        max: 8,
        description: '上传多张产品图片进行深度分析，提取卖点和特征'
      },

      // ========== 高级功能开关 ==========
      {
        key: 'enableDeepAnalysis',
        label: '深度图片分析',
        type: 'checkbox',
        default: true,
        description: '对每张图片进行深度分析，提取更丰富的产品信息'
      },
      {
        key: 'enableSeoKeywords',
        label: '生成 SEO 关键词',
        type: 'checkbox',
        default: true,
        description: '自动提取和建议 SEO 优化关键词'
      },
      {
        key: 'enableImageSuggestions',
        label: '生成图片建议',
        type: 'checkbox',
        default: true,
        description: '为每个模块生成具体的图片拍摄/设计建议'
      },

      // ========== 高级设置 ==========
      {
        key: 'temperature',
        label: '创意度',
        type: 'number',
        required: false,
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.1,
        description: '较高的值产生更有创意的内容'
      }
    ]
  },

  defaultConfig: {
    platform: 'amazon' as EcommercePlatform,
    moduleTypes: ['standard_header', 'standard_image_text', 'standard_four_image'] as AplusModuleType[],
    contentStyle: 'professional' as ContentStyle,
    language: 'en-US' as AplusLanguage,
    pricePosition: 'mid',
    enableDeepAnalysis: true,
    enableSeoKeywords: true,
    enableImageSuggestions: true,
    temperature: 0.7,
    imageInputCount: 4,
    imageInputPorts: [
      { id: 'image_1', label: '主图', dataType: 'image' as const, required: true, description: '产品主图' },
      { id: 'image_2', label: '细节图', dataType: 'image' as const, required: false, description: '产品细节特写' },
      { id: 'image_3', label: '场景图', dataType: 'image' as const, required: false, description: '使用场景展示' },
      { id: 'image_4', label: '参考图', dataType: 'image' as const, required: false, description: '风格或竞品参考' }
    ]
  },

  executor: new AplusContentExecutor()
}

export { AplusContentExecutor } from './executor'
export type {
  AplusContentConfig,
  AplusContentOutput,
  AplusModuleContent,
  AplusModuleType,
  EcommercePlatform
} from './types'
export {
  APLUS_LANGUAGE_LABELS,
  APLUS_MODULES,
  CONTENT_STYLE_LABELS,
  PLATFORM_LABELS,
  PRICE_POSITION_LABELS,
  PRODUCT_CATEGORIES
} from './types'
export default AplusContentNode
