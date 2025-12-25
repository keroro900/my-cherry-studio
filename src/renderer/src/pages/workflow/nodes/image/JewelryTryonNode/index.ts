/**
 * 首饰试戴节点定义
 *
 * 虚拟首饰试戴效果生成：
 * - 支持项链、耳环、手链、戒指、手表
 * - 准确的佩戴位置
 * - 自然的光影融合
 * - 真实的佩戴效果
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const JewelryTryonNode: NodeDefinition = {
  metadata: {
    type: 'jewelry_tryon',
    label: '首饰试戴',
    icon: '💍',
    category: 'image',
    version: '1.0.0',
    description: '虚拟首饰试戴，支持项链、耳环、手链等',
    tags: ['image', 'jewelry', 'tryon', 'virtual', 'gemini']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '试戴效果提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的试戴效果图' }],

  configSchema: {
    fields: [
      // === 模型选择 ===
      {
        key: 'providerId',
        label: 'Provider',
        type: 'model-selector',
        modelFilter: 'image-generation',
        description: '选择 Gemini 图片生成服务'
      },

      // === 图片尺寸 ===
      {
        key: 'imageSize',
        label: '图片尺寸',
        type: 'select',
        default: '2K',
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
        ],
        description: '生成图片的分辨率'
      },
      {
        key: 'aspectRatio',
        label: '宽高比',
        type: 'select',
        default: '3:4',
        options: [
          { label: '3:4 竖版', value: '3:4' },
          { label: '1:1 正方形', value: '1:1' },
          { label: '4:3 横版', value: '4:3' },
          { label: '9:16 手机屏', value: '9:16' }
        ],
        description: '生成图片的宽高比'
      },

      // === 首饰类型 ===
      {
        key: 'jewelryType',
        label: '首饰类型',
        type: 'select',
        default: 'necklace',
        options: [
          { label: '项链', value: 'necklace' },
          { label: '耳环', value: 'earring' },
          { label: '手链', value: 'bracelet' },
          { label: '戒指', value: 'ring' },
          { label: '手表', value: 'watch' }
        ],
        description: '选择首饰类型'
      },

      // === 佩戴位置 ===
      {
        key: 'position',
        label: '佩戴位置',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动', value: 'auto' },
          { label: '居中', value: 'centered' },
          { label: '偏左', value: 'left' },
          { label: '偏右', value: 'right' }
        ],
        description: '首饰佩戴位置偏好'
      },

      // === 融合模式 ===
      {
        key: 'blendMode',
        label: '融合模式',
        type: 'select',
        default: 'natural',
        options: [
          { label: '自然', value: 'natural' },
          { label: '增强', value: 'enhanced' },
          { label: '柔和', value: 'subtle' }
        ],
        description: '首饰与模特的融合方式'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的效果要求...\n例如：强调钻石的闪耀效果',
        description: '补充试戴效果描述'
      },

      // === 图片输入端口 ===
      {
        key: 'imageInputPorts',
        label: '📷 图片输入',
        type: 'image-input-ports',
        min: 2,
        max: 5,
        description: '配置图片输入端口数量（至少需要模特和首饰两张图）'
      },

      // === 高级选项 ===
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成失败时自动重试'
      },
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 180,
        min: 60,
        max: 300,
        description: '单次生成的最大等待时间（秒）'
      }
    ]
  },

  defaultConfig: {
    nodeType: 'jewelry_tryon',
    imageSize: '2K',
    aspectRatio: '3:4',
    jewelryType: 'necklace',
    position: 'auto',
    blendMode: 'natural',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 3,
    imageInputPorts: [
      { id: 'image_1', label: '模特照片', dataType: 'image', required: true, description: '模特照片' },
      { id: 'image_2', label: '首饰图片', dataType: 'image', required: true, description: '首饰产品图' },
      { id: 'image_3', label: '效果参考', dataType: 'image', required: false, description: '可选的效果参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as JewelryTryonExecutor }
export default JewelryTryonNode
