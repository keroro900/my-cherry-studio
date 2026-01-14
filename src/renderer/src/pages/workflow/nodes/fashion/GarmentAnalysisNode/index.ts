/**
 * 服装分析节点定义
 * Garment Analysis Node Definition
 *
 * 分析服装图片，提取颜色、图案、款式等结构化属性
 */

import { getFashionCategoryOptions } from '../../../prompts/presets/fashionCategory'
import type { NodeDefinition } from '../../base/types'
import { GarmentAnalysisExecutor } from './executor'

// 分析粒度选项
const DETAIL_LEVEL_OPTIONS = [
  { label: '基础分析', value: 'basic' },
  { label: '标准分析', value: 'standard' },
  { label: '详细分析', value: 'detailed' }
]

// 语言选项
const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' }
]

export const GarmentAnalysisNode: NodeDefinition = {
  metadata: {
    type: 'garment_analysis',
    label: '服装分析',
    icon: '👔',
    category: 'fashion',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '分析服装图片，提取颜色、图案、款式等结构化属性',
    tags: ['fashion', 'analysis', 'garment', 'clothing', 'attributes']
  },

  inputs: [
    {
      id: 'image',
      label: '服装图片',
      dataType: 'image',
      required: true,
      description: '要分析的服装图片'
    }
  ],

  outputs: [
    {
      id: 'attributes',
      label: '服装属性',
      dataType: 'json',
      description: '提取的服装属性 JSON（品类、颜色、图案、版型等）'
    },
    {
      id: 'colors',
      label: '颜色信息',
      dataType: 'json',
      description: '颜色提取结果（主色、辅色、色调）'
    },
    {
      id: 'description',
      label: '文字描述',
      dataType: 'text',
      description: '服装的文字描述摘要'
    }
  ],

  configSchema: {
    fields: [
      // 模型选择
      {
        key: 'model',
        label: '视觉模型',
        type: 'model-selector',
        required: true,
        description: '选择用于分析图片的视觉模型（推荐 Gemini、GPT-4V、Claude）'
      },

      // 分析粒度
      {
        key: 'detailLevel',
        label: '分析粒度',
        type: 'select',
        required: false,
        default: 'standard',
        options: DETAIL_LEVEL_OPTIONS,
        description: '分析的详细程度'
      },

      // 目标品类（可选，用于引导分析）
      {
        key: 'targetCategory',
        label: '目标品类',
        type: 'select',
        required: false,
        options: [{ label: '自动识别', value: '' }, ...getFashionCategoryOptions()],
        description: '指定服装品类可以提高分析准确性'
      },

      // 颜色提取
      {
        key: 'extractColors',
        label: '提取颜色',
        type: 'checkbox',
        default: true,
        description: '是否提取颜色信息'
      },

      // 图案提取
      {
        key: 'extractPatterns',
        label: '提取图案',
        type: 'checkbox',
        default: true,
        description: '是否提取图案信息'
      },

      // 输出语言
      {
        key: 'outputLanguage',
        label: '输出语言',
        type: 'select',
        required: false,
        default: 'en',
        options: LANGUAGE_OPTIONS,
        description: '分析结果的输出语言'
      }
    ]
  },

  defaultConfig: {
    detailLevel: 'standard',
    extractColors: true,
    extractPatterns: true,
    outputLanguage: 'en'
  },

  executor: new GarmentAnalysisExecutor()
}

// 导出类型
export type { GarmentAnalysisNodeConfig } from './executor'
export { GarmentAnalysisExecutor }
