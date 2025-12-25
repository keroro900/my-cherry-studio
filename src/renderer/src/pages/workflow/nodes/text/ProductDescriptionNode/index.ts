/**
 * 产品描述生成节点
 * Product Description Node
 *
 * 使用AI生成多语言产品描述、卖点列表和SEO关键词
 * 支持多个电商平台的风格优化
 */

import type { NodeDefinition } from '../../base/types'
import { ProductDescriptionExecutor } from './executor'
import { FORMAT_OPTIONS, LANGUAGE_OPTIONS, PLATFORM_OPTIONS, TONE_OPTIONS } from './prompts'

export const ProductDescriptionNode: NodeDefinition = {
  metadata: {
    type: 'product_description',
    label: '产品描述生成',
    icon: '📝',
    category: 'text',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: 'AI生成多语言产品描述、卖点列表和SEO关键词，支持多个电商平台风格',
    tags: ['text', 'ecommerce', 'description', 'seo', 'copywriting']
  },

  inputs: [
    {
      id: 'productInfo',
      label: '产品信息',
      dataType: 'text',
      required: true,
      description: '产品的基本信息、规格、材质等'
    },
    {
      id: 'features',
      label: '特点描述',
      dataType: 'text',
      required: false,
      description: '产品的关键特点和卖点'
    },
    {
      id: 'image',
      label: '产品图片',
      dataType: 'image',
      required: false,
      description: '可选的产品图片，用于视觉分析增强描述准确性'
    }
  ],

  outputs: [
    {
      id: 'title',
      label: '产品标题',
      dataType: 'text',
      description: 'SEO优化的产品标题'
    },
    {
      id: 'description',
      label: '产品描述',
      dataType: 'text',
      description: '完整的产品描述'
    },
    {
      id: 'bullets',
      label: '卖点列表',
      dataType: 'json',
      description: '产品卖点数组'
    },
    {
      id: 'seoKeywords',
      label: 'SEO关键词',
      dataType: 'json',
      description: 'SEO关键词数组'
    },
    {
      id: 'json',
      label: '完整JSON',
      dataType: 'json',
      description: '完整的输出JSON对象'
    }
  ],

  configSchema: {
    fields: [
      // ========== 模型选择 ==========
      {
        key: 'model',
        label: '文本模型',
        type: 'model-selector',
        required: true,
        description: '选择用于生成产品描述的AI模型'
      },

      // ========== 平台设置 ==========
      {
        key: 'platform',
        label: '目标平台',
        type: 'select',
        required: true,
        default: 'general',
        options: PLATFORM_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择目标电商平台，将应用平台特定的优化'
      },

      // ========== 语言设置 ==========
      {
        key: 'language',
        label: '输出语言',
        type: 'select',
        required: true,
        default: 'zh-CN',
        options: LANGUAGE_OPTIONS.map((l) => ({ label: l.name, value: l.id })),
        description: '选择产品描述的输出语言'
      },

      // ========== 风格设置 ==========
      {
        key: 'toneStyle',
        label: '文案风格',
        type: 'select',
        required: true,
        default: 'professional',
        options: TONE_OPTIONS.map((t) => ({ label: t.name, value: t.id })),
        description: '选择文案的语气和风格'
      },

      // ========== 输出设置 ==========
      {
        key: 'outputFormat',
        label: '输出格式',
        type: 'select',
        required: false,
        default: 'full_listing',
        options: FORMAT_OPTIONS.map((f) => ({ label: f.name, value: f.id })),
        description: '选择输出的格式类型'
      },
      {
        key: 'includeSEO',
        label: '包含SEO关键词',
        type: 'checkbox',
        required: false,
        default: true,
        description: '是否生成SEO优化关键词'
      },

      // ========== 长度限制 ==========
      {
        key: 'bulletCount',
        label: '卖点数量',
        type: 'number',
        required: false,
        default: 5,
        min: 3,
        max: 10,
        description: '生成的卖点数量'
      },
      {
        key: 'maxTitleLength',
        label: '标题最大字符数',
        type: 'number',
        required: false,
        default: 150,
        min: 50,
        max: 300,
        description: '产品标题的最大字符长度'
      },
      {
        key: 'maxDescriptionLength',
        label: '描述最大字符数',
        type: 'number',
        required: false,
        default: 2000,
        min: 500,
        max: 10000,
        description: '产品描述的最大字符长度'
      },

      // ========== 高级设置 ==========
      {
        key: 'temperature',
        label: '创意度',
        type: 'number',
        required: false,
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
        description: '较高的值会产生更有创意的结果'
      }
    ]
  },

  defaultConfig: {
    platform: 'general',
    language: 'zh-CN',
    toneStyle: 'professional',
    outputFormat: 'full_listing',
    includeSEO: true,
    bulletCount: 5,
    maxTitleLength: 150,
    maxDescriptionLength: 2000,
    temperature: 0.7
  },

  executor: new ProductDescriptionExecutor()
}

export { ProductDescriptionExecutor } from './executor'
export type { ProductDescriptionConfig, ProductDescriptionOutput } from './types'
export default ProductDescriptionNode
