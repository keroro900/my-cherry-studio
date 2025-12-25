/**
 * Gemini 模特生成节点定义
 *
 * 两种模式：
 * - GeminiGenerateModelNode: 从 promptJson 生成模特图片
 * - GeminiModelFromClothesNode: 从衣服图片生成模特穿着效果
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiModelExecutor } from './executor'

/**
 * Gemini 模特生成节点（从 promptJson）
 * 接收视觉分析节点输出的 promptJson，生成模特穿着效果
 */
export const GeminiGenerateModelNode: NodeDefinition = {
  metadata: {
    type: 'gemini_generate_model',
    label: 'Gemini 模特生成',
    icon: '👔',
    category: 'image',
    version: '1.0.0',
    description: '根据视觉分析的 JSON 描述生成模特穿着效果',
    tags: ['image', 'model', 'gemini', 'ai', 'fashion']
  },

  inputs: [
    {
      id: 'promptJson',
      label: '提示词JSON',
      dataType: 'json',
      required: true,
      description: '从视觉提示词节点传入的服装分析 JSON'
    },
    {
      id: 'clothesImage',
      label: '服装图片',
      dataType: 'image',
      description: '可选的服装参考图片'
    }
  ],

  outputs: [
    { id: 'modelImage', label: '模特图片', dataType: 'image', description: '生成的模特穿着效果图' },
    { id: 'image', label: '图片', dataType: 'image', description: '生成的图片（兼容输出）' }
  ],

  configSchema: {
    fields: [
      {
        key: 'providerId',
        label: '模型服务',
        type: 'model-selector',
        modelFilter: 'image-generation',
        description: '选择 Gemini 图片生成服务'
      },
      {
        key: 'ageGroup',
        label: '年龄段',
        type: 'select',
        default: 'adult',
        options: [
          { label: '小童 (3-7岁)', value: 'small_kid' },
          { label: '大童 (8-12岁)', value: 'big_kid' },
          { label: '成人', value: 'adult' }
        ]
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        default: 'female',
        options: [
          { label: '女', value: 'female' },
          { label: '男', value: 'male' }
        ]
      },
      {
        key: 'scenePreset',
        label: '场景',
        type: 'select',
        default: 'home',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '室内家居', value: 'home' },
          { label: '户外场景', value: 'outdoor' },
          { label: '纯色背景', value: 'studio' },
          { label: '城市街景', value: 'urban' }
        ]
      },
      {
        key: 'imageSize',
        label: '图片尺寸',
        type: 'select',
        default: '2K',
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
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
          { label: '9:16 手机竖屏', value: '9:16' }
        ]
      }
    ]
  },

  prompts: {
    systemPrompt: `你是一个专业的时尚摄影 AI，擅长根据服装描述生成高质量的模特穿着效果图。

核心要求：
1. 严格按照服装描述中的款式、颜色、材质生成图片
2. 模特应该自然、有吸引力，符合品牌调性
3. 光线和构图应该专业，适合电商或时尚杂志使用
4. 保持服装细节的准确性

输出规格：
- 高清晰度图片
- 自然的肤色和表情
- 合适的背景和氛围`
  },

  defaultConfig: {
    ageGroup: 'adult',
    gender: 'female',
    scenePreset: 'home',
    imageSize: '2K',
    aspectRatio: '3:4'
  },

  executor: new GeminiModelExecutor('gemini_generate_model')
}

/**
 * Gemini 从衣服生成模特节点
 * 直接从衣服图片生成模特穿着效果（无需 promptJson）
 */
export const GeminiModelFromClothesNode: NodeDefinition = {
  metadata: {
    type: 'gemini_model_from_clothes',
    label: 'Gemini 衣服穿搭',
    icon: '👗',
    category: 'image',
    version: '1.0.0',
    description: '从服装图片直接生成模特穿着效果',
    tags: ['image', 'model', 'gemini', 'ai', 'fashion', 'clothes']
  },

  inputs: [
    {
      id: 'clothesImage',
      label: '服装图片',
      dataType: 'image',
      required: true,
      description: '需要生成穿着效果的服装图片'
    },
    {
      id: 'promptJson',
      label: '提示词 JSON',
      dataType: 'json',
      description: '从智能提示词节点传入的结构化提示词'
    },
    {
      id: 'prompt',
      label: '附加提示',
      dataType: 'text',
      description: '可选的附加描述或风格要求'
    }
  ],

  outputs: [
    { id: 'modelImage', label: '模特图片', dataType: 'image', description: '生成的模特穿着效果图' },
    { id: 'image', label: '图片', dataType: 'image', description: '生成的图片（兼容输出）' }
  ],

  configSchema: {
    fields: [
      {
        key: 'providerId',
        label: '模型服务',
        type: 'model-selector',
        modelFilter: 'image-generation',
        description: '选择 Gemini 图片生成服务'
      },
      {
        key: 'ageGroup',
        label: '年龄段',
        type: 'select',
        default: 'adult',
        options: [
          { label: '小童 (3-7岁)', value: 'small_kid' },
          { label: '大童 (8-12岁)', value: 'big_kid' },
          { label: '成人', value: 'adult' }
        ]
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        default: 'female',
        options: [
          { label: '女', value: 'female' },
          { label: '男', value: 'male' }
        ]
      },
      {
        key: 'scenePreset',
        label: '场景',
        type: 'select',
        default: 'home',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '室内家居', value: 'home' },
          { label: '户外场景', value: 'outdoor' },
          { label: '纯色背景', value: 'studio' },
          { label: '城市街景', value: 'urban' }
        ]
      },
      {
        key: 'poseStyle',
        label: '姿态风格',
        type: 'select',
        default: 'natural',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '自然随意', value: 'natural' },
          { label: '时尚造型', value: 'fashion' },
          { label: '商业正式', value: 'commercial' },
          { label: '活泼动感', value: 'dynamic' }
        ]
      },
      {
        key: 'imageSize',
        label: '图片尺寸',
        type: 'select',
        default: '2K',
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
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
          { label: '9:16 手机竖屏', value: '9:16' }
        ]
      },
      {
        key: 'additionalPrompt',
        label: '附加描述',
        type: 'textarea',
        placeholder: '可选：添加额外的风格或场景描述...'
      }
    ]
  },

  prompts: {
    systemPrompt: `你是一个专业的虚拟试衣 AI，擅长将服装图片转换为模特穿着效果图。

核心要求：
1. 保持服装的所有细节：颜色、图案、材质、款式
2. 生成自然真实的模特形象
3. 服装穿着效果要合理，无变形或失真
4. 光线自然，阴影合理

关键注意事项：
- 服装的 IP 图案/印花必须完整保留
- 模特体型要与服装尺寸匹配
- 面料质感要真实呈现`
  },

  defaultConfig: {
    ageGroup: 'adult',
    gender: 'female',
    scenePreset: 'home',
    poseStyle: 'natural',
    imageSize: '2K',
    aspectRatio: '3:4'
  },

  executor: new GeminiModelExecutor('gemini_model_from_clothes')
}

export { GeminiModelExecutor }
export default GeminiGenerateModelNode
