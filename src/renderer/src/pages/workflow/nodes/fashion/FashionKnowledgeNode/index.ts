/**
 * 知识库检索节点定义
 * Fashion Knowledge Node Definition
 *
 * 从知识库检索服装趋势和设计参考
 */

import type { NodeDefinition } from '../../base/types'
import { FashionKnowledgeExecutor } from './executor'

// 查询类型选项
const QUERY_TYPE_OPTIONS = [
  { label: '综合分析', value: 'comprehensive' },
  { label: '颜色趋势', value: 'color' },
  { label: '图案趋势', value: 'pattern' },
  { label: '款式趋势', value: 'style' },
  { label: '相似搜索', value: 'similar' }
]

export const FashionKnowledgeNode: NodeDefinition = {
  metadata: {
    type: 'fashion_knowledge',
    label: '时尚知识库',
    icon: '📚',
    category: 'fashion',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '从知识库检索服装趋势和设计参考',
    tags: ['fashion', 'knowledge', 'rag', 'search', 'trend']
  },

  inputs: [
    {
      id: 'query',
      label: '查询内容',
      dataType: 'text',
      required: false,
      description: '文本查询关键词或问题'
    },
    {
      id: 'image',
      label: '参考图片',
      dataType: 'image',
      required: false,
      description: '可选的参考图片，系统会先分析图片再进行搜索'
    }
  ],

  outputs: [
    {
      id: 'results',
      label: '检索结果',
      dataType: 'json',
      description: '结构化的检索结果（包含颜色、图案、风格统计）'
    },
    {
      id: 'summary',
      label: '摘要',
      dataType: 'text',
      description: '检索结果的文字摘要'
    },
    {
      id: 'references',
      label: '参考图片',
      dataType: 'images',
      description: '检索到的参考图片列表'
    }
  ],

  configSchema: {
    fields: [
      // 知识库选择
      {
        key: 'knowledgeBaseId',
        label: '知识库',
        type: 'knowledge-base-selector',
        required: true,
        description: '选择要检索的 Fashion 知识库'
      },

      // 查询类型
      {
        key: 'queryType',
        label: '查询类型',
        type: 'select',
        required: false,
        default: 'comprehensive',
        options: QUERY_TYPE_OPTIONS,
        description: '选择检索的侧重点'
      },

      // 返回数量
      {
        key: 'topK',
        label: '返回数量',
        type: 'number',
        default: 10,
        min: 1,
        max: 50,
        description: '返回的最大结果数量'
      },

      // 启用重排序
      {
        key: 'enableRerank',
        label: '启用重排序',
        type: 'checkbox',
        default: true,
        description: '使用重排序模型优化结果排序'
      },

      // 视觉模型（用于图片分析）
      {
        key: 'model',
        label: '视觉模型',
        type: 'model-selector',
        required: false,
        description: '可选：用于分析参考图片的视觉模型'
      },

      // 过滤条件
      {
        key: 'filters',
        label: '过滤条件',
        type: 'textarea',
        required: false,
        placeholder: 'category: tops\nseason: summer',
        description: '可选的过滤条件（YAML 格式）'
      }
    ]
  },

  defaultConfig: {
    queryType: 'comprehensive',
    topK: 10,
    enableRerank: true
  },

  executor: new FashionKnowledgeExecutor()
}

// 导出类型
export type { FashionKnowledgeNodeConfig } from './executor'
export { FashionKnowledgeExecutor }
