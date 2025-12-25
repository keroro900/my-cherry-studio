/**
 * 趋势分析节点定义
 * Trend Analysis Node Definition
 *
 * 分析服装趋势，生成设计建议
 */

import type { NodeDefinition } from '../../base/types'
import { TrendAnalysisExecutor } from './executor'
import { getFashionCategoryOptions } from '../../../prompts/presets/fashionCategory'
import { getTrendDimensionOptions } from '../../../prompts/presets/trendDimension'

// 分析深度选项
const ANALYSIS_DEPTH_OPTIONS = [
  { label: '快速分析', value: 'quick' },
  { label: '标准分析', value: 'standard' },
  { label: '深度分析', value: 'deep' }
]

// 目标人群选项
const TARGET_AUDIENCE_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '儿童 (0-12岁)', value: 'kids' },
  { label: '青少年 (13-18岁)', value: 'teens' },
  { label: '年轻成人 (18-35岁)', value: 'young_adults' },
  { label: '成人 (35+)', value: 'adults' }
]

// 市场定位选项
const MARKET_POSITION_OPTIONS = [
  { label: '平价快时尚', value: 'budget' },
  { label: '中端市场', value: 'mid-range' },
  { label: '高端品质', value: 'premium' }
]

export const TrendAnalysisNode: NodeDefinition = {
  metadata: {
    type: 'trend_analysis',
    label: '趋势分析',
    icon: '📈',
    category: 'fashion',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '分析服装趋势，生成设计建议和推荐配色',
    tags: ['fashion', 'trend', 'analysis', 'design', 'suggestion']
  },

  inputs: [
    {
      id: 'knowledge_data',
      label: '知识库数据',
      dataType: 'json',
      required: true,
      description: '来自知识库检索节点的结果'
    },
    {
      id: 'reference_images',
      label: '参考图片',
      dataType: 'images',
      required: false,
      description: '可选的参考图片，用于辅助分析'
    }
  ],

  outputs: [
    {
      id: 'trend_report',
      label: '趋势报告',
      dataType: 'json',
      description: '完整的趋势分析报告（颜色、图案、版型、风格趋势）'
    },
    {
      id: 'design_suggestions',
      label: '设计建议',
      dataType: 'text',
      description: '格式化的设计建议文本'
    },
    {
      id: 'color_palette',
      label: '推荐配色',
      dataType: 'json',
      description: '推荐的颜色搭配方案'
    }
  ],

  configSchema: {
    fields: [
      // 模型选择
      {
        key: 'model',
        label: '分析模型',
        type: 'model-selector',
        required: true,
        description: '选择用于趋势分析的 AI 模型'
      },

      // 分析深度
      {
        key: 'analysisDepth',
        label: '分析深度',
        type: 'select',
        required: false,
        default: 'standard',
        options: ANALYSIS_DEPTH_OPTIONS,
        description: '分析的详细程度'
      },

      // 分析维度（多选）
      {
        key: 'dimensions',
        label: '分析维度',
        type: 'multi-select',
        required: false,
        default: ['color', 'pattern', 'silhouette', 'style'],
        options: getTrendDimensionOptions().map((opt) => ({
          label: opt.label,
          value: opt.value
        })),
        description: '选择要分析的趋势维度'
      },

      // 目标品类
      {
        key: 'targetCategory',
        label: '目标品类',
        type: 'select',
        required: false,
        options: [{ label: '全品类', value: '' }, ...getFashionCategoryOptions()],
        description: '指定分析的服装品类'
      },

      // 目标人群
      {
        key: 'targetAudience',
        label: '目标人群',
        type: 'select',
        required: false,
        default: 'all',
        options: TARGET_AUDIENCE_OPTIONS,
        description: '目标消费人群'
      },

      // 市场定位
      {
        key: 'marketPosition',
        label: '市场定位',
        type: 'select',
        required: false,
        default: 'budget',
        options: MARKET_POSITION_OPTIONS,
        description: '产品的市场定位'
      }
    ]
  },

  defaultConfig: {
    analysisDepth: 'standard',
    dimensions: ['color', 'pattern', 'silhouette', 'style'],
    targetAudience: 'all',
    marketPosition: 'budget'
  },

  executor: new TrendAnalysisExecutor()
}

// 导出类型
export type { TrendAnalysisNodeConfig } from './executor'
export { TrendAnalysisExecutor }
