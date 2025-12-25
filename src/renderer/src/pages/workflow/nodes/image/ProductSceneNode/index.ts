/**
 * 产品场景合成节点定义
 *
 * 将产品融入指定场景：
 * - 支持摄影棚、户外、生活场景、极简、奢华
 * - 光影融合与匹配
 * - 透视与比例协调
 * - 风格一致性
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const ProductSceneNode: NodeDefinition = {
  metadata: {
    type: 'product_scene',
    label: '产品场景',
    icon: '🏞️',
    category: 'image',
    version: '1.0.0',
    description: '将产品融入指定场景，支持光影匹配与自然融合',
    tags: ['image', 'product', 'scene', 'composite', 'gemini']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '场景合成提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的场景合成图' }],

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
        default: '1:1',
        options: [
          { label: '1:1 正方形', value: '1:1' },
          { label: '3:4 竖版', value: '3:4' },
          { label: '4:3 横版', value: '4:3' },
          { label: '16:9 宽屏', value: '16:9' }
        ],
        description: '生成图片的宽高比'
      },

      // === 场景类型 ===
      {
        key: 'sceneType',
        label: '场景类型',
        type: 'select',
        default: 'studio',
        options: [
          { label: '摄影棚', value: 'studio' },
          { label: '户外', value: 'outdoor' },
          { label: '生活场景', value: 'lifestyle' },
          { label: '极简', value: 'minimalist' },
          { label: '奢华', value: 'luxury' }
        ],
        description: '选择场景类型'
      },

      // === 光影风格 ===
      {
        key: 'lightingStyle',
        label: '光影风格',
        type: 'select',
        default: 'natural',
        options: [
          { label: '自然光', value: 'natural' },
          { label: '摄影棚', value: 'studio' },
          { label: '戏剧', value: 'dramatic' },
          { label: '柔和', value: 'soft' }
        ],
        description: '选择光影风格'
      },

      // === 氛围风格 ===
      {
        key: 'moodStyle',
        label: '氛围风格',
        type: 'select',
        default: 'professional',
        options: [
          { label: '专业', value: 'professional' },
          { label: '温暖', value: 'warm' },
          { label: '冷调', value: 'cool' },
          { label: '活力', value: 'vibrant' }
        ],
        description: '选择氛围风格'
      },

      // === 产品类型 ===
      {
        key: 'productType',
        label: '产品类型',
        type: 'select',
        default: 'general',
        options: [
          { label: '通用产品', value: 'general' },
          { label: '时尚服饰', value: 'fashion' },
          { label: '电子产品', value: 'electronics' },
          { label: '美妆护肤', value: 'cosmetics' },
          { label: '家居生活', value: 'home' }
        ],
        description: '选择产品类别'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的场景要求...\n例如：夕阳下的海边场景',
        description: '补充场景细节描述'
      },

      // === 图片输入端口 ===
      {
        key: 'imageInputPorts',
        label: '📷 图片输入',
        type: 'image-input-ports',
        min: 1,
        max: 5,
        description: '配置图片输入端口数量'
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
    nodeType: 'product_scene',
    imageSize: '2K',
    aspectRatio: '1:1',
    sceneType: 'studio',
    lightingStyle: 'natural',
    moodStyle: 'professional',
    productType: 'general',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 3,
    imageInputPorts: [
      { id: 'image_1', label: '产品图', dataType: 'image', required: true, description: '需要合成的产品图' },
      { id: 'image_2', label: '场景参考', dataType: 'image', required: false, description: '可选的场景参考图' },
      { id: 'image_3', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as ProductSceneExecutor }
export default ProductSceneNode
