/**
 * 提示词优化节点
 *
 * 专门用于优化 AI 提示词
 * 支持图片生成、文本生成、代码生成等多种场景
 */

import type { NodeDefinition } from '../../base/types'
import { PromptOptimizerExecutor } from './executor'

export const PromptOptimizerNode: NodeDefinition = {
  metadata: {
    type: 'prompt_optimizer',
    label: '提示词优化',
    icon: '✨',
    category: 'flow',
    version: '1.0.0',
    description: '智能优化 AI 提示词，提升生成效果',
    tags: ['prompt', 'optimize', 'AI', 'enhancement']
  },

  inputs: [
    {
      id: 'prompt',
      label: '原始提示词',
      dataType: 'text',
      required: true,
      description: '需要优化的原始提示词'
    },
    {
      id: 'context',
      label: '上下文',
      dataType: 'text',
      required: false,
      description: '额外的上下文信息'
    },
    {
      id: 'reference_image',
      label: '参考图片',
      dataType: 'image',
      required: false,
      description: '用于提取风格的参考图片'
    }
  ],

  outputs: [
    {
      id: 'optimized_prompt',
      label: '优化后提示词',
      dataType: 'text',
      description: '优化后的提示词'
    },
    {
      id: 'alternatives',
      label: '备选方案',
      dataType: 'json',
      description: '备选的优化方案列表'
    },
    {
      id: 'improvement',
      label: '改进说明',
      dataType: 'text',
      description: '优化的改进说明'
    },
    {
      id: 'before_score',
      label: '优化前分数',
      dataType: 'number',
      description: '原始提示词的质量分数'
    },
    {
      id: 'after_score',
      label: '优化后分数',
      dataType: 'number',
      description: '优化后提示词的质量分数'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'targetType',
        label: '目标用途',
        type: 'select',
        required: true,
        default: 'image_generation',
        options: [
          { label: '图片生成', value: 'image_generation' },
          { label: '文本生成', value: 'text_generation' },
          { label: '代码生成', value: 'code_generation' },
          { label: '对话聊天', value: 'chat' }
        ],
        description: '提示词的目标用途'
      },
      {
        key: 'style',
        label: '优化风格',
        type: 'select',
        default: 'moderate',
        options: [
          { label: '保守 (小幅增强)', value: 'conservative' },
          { label: '适中 (平衡增强)', value: 'moderate' },
          { label: '激进 (大幅增强)', value: 'aggressive' }
        ],
        description: '优化的激进程度'
      },
      {
        key: 'language',
        label: '输出语言',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动 (保持原语言)', value: 'auto' },
          { label: '中文', value: 'zh' },
          { label: '英文', value: 'en' }
        ],
        description: '优化后提示词的语言'
      },
      {
        key: 'addQualityTags',
        label: '添加质量标签',
        type: 'checkbox',
        default: true,
        description: '自动添加高质量相关的标签'
      },
      {
        key: 'addStyleTags',
        label: '添加风格标签',
        type: 'checkbox',
        default: true,
        description: '根据内容自动添加风格标签'
      },
      {
        key: 'maxLength',
        label: '最大长度',
        type: 'number',
        default: 500,
        min: 50,
        max: 2000,
        description: '优化后提示词的最大字符数'
      },
      {
        key: 'alternativeCount',
        label: '备选方案数量',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成的备选优化方案数量'
      }
    ]
  },

  configUI: {
    hideModelSelector: false,
    showPromptEditor: false
  },

  defaultConfig: {
    targetType: 'image_generation',
    style: 'moderate',
    language: 'auto',
    addQualityTags: true,
    addStyleTags: true,
    maxLength: 500,
    alternativeCount: 2
  },

  executor: new PromptOptimizerExecutor()
}

export { PromptOptimizerExecutor }
export default PromptOptimizerNode
