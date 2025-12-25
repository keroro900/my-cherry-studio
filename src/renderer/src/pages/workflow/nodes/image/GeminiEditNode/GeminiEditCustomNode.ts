/**
 * Gemini 自定义编辑节点定义
 *
 * 与 GeminiEditNode 共享执行器，但默认使用自定义模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiEditExecutor } from './executor'

export const GeminiEditCustomNode: NodeDefinition = {
  metadata: {
    type: 'gemini_edit_custom',
    label: 'Gemini 自定义编辑',
    icon: '🎨',
    category: 'image',
    version: '1.0.0',
    description: '使用 Gemini 编辑图片（自定义提示词）',
    tags: ['image', 'edit', 'gemini', 'ai', 'custom']
  },

  inputs: [
    { id: 'baseImage', label: '基础图片', dataType: 'image', required: true, description: '要编辑的图片' },
    { id: 'referenceImage', label: '参考图片', dataType: 'image', description: '风格参考图' },
    { id: 'promptJson', label: '提示词 JSON', dataType: 'json', description: '从智能提示词节点传入的结构化提示词' },
    { id: 'customPrompt', label: '自定义提示词', dataType: 'text', description: '外部传入的文本提示词' }
  ],

  outputs: [
    { id: 'editedImage', label: '编辑后图片', dataType: 'image', description: '编辑后的图片' },
    { id: 'metadata', label: '元数据', dataType: 'json', description: '编辑信息' }
  ],

  configSchema: {
    fields: [
      {
        key: 'imageSize',
        label: '图片尺寸',
        type: 'select',
        default: '2K',
        description: '输出图片分辨率',
        options: [
          { label: '1K (1024px) - 快速预览', value: '1K' },
          { label: '2K (2048px) - 标准商用', value: '2K' },
          { label: '4K (4096px) - 高清大图', value: '4K' }
        ]
      },
      {
        key: 'aspectRatio',
        label: '宽高比',
        type: 'select',
        default: '3:4',
        options: [
          { label: '1:1 正方形', value: '1:1' },
          { label: '3:4 竖版', value: '3:4' },
          { label: '4:3 横版', value: '4:3' },
          { label: '9:16 手机竖屏', value: '9:16' },
          { label: '16:9 宽屏', value: '16:9' },
          { label: '4:5 Instagram', value: '4:5' }
        ]
      },
      {
        key: 'customPrompt',
        label: '编辑提示词',
        type: 'textarea',
        placeholder: '描述你想要的编辑效果...\n例如：将背景替换为海滩场景，保持人物不变',
        description: '详细描述编辑需求，AI 将按此执行'
      },
      {
        key: 'negativePrompt',
        label: '负面提示词',
        type: 'textarea',
        placeholder: '不希望出现的元素...',
        description: '排除不想要的内容'
      },
      {
        key: 'preserveSubject',
        label: '保留主体',
        type: 'checkbox',
        default: true,
        description: '编辑时保留图片中的主要对象'
      },
      {
        key: 'styleStrength',
        label: '风格强度',
        type: 'select',
        default: 'medium',
        description: '编辑对原图的影响程度',
        options: [
          { label: '轻微 - 保留原图更多细节', value: 'light' },
          { label: '适中 - 平衡原图与编辑', value: 'medium' },
          { label: '强烈 - 更大幅度修改', value: 'strong' }
        ]
      },
      {
        key: 'seed',
        label: '种子值',
        type: 'number',
        placeholder: '留空则随机',
        description: '固定种子可生成相似结果'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成失败时的重试次数'
      }
    ]
  },

  defaultConfig: {
    mode: 'custom', // 自定义模式
    imageSize: '2K',
    aspectRatio: '3:4',
    customPrompt: '',
    negativePrompt: '',
    preserveSubject: true,
    styleStrength: 'medium',
    retryCount: 2
  },

  executor: new GeminiEditExecutor()
}

export default GeminiEditCustomNode
