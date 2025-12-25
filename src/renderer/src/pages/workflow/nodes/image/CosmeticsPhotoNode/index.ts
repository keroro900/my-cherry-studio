/**
 * 美妆产品摄影节点定义
 *
 * 专业美妆产品摄影生成：
 * - 支持口红、眼影、粉底、护肤品等
 * - 产品光泽与质感表现
 * - 标签清晰度控制
 * - 专业商拍品质
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const CosmeticsPhotoNode: NodeDefinition = {
  metadata: {
    type: 'cosmetics_photo',
    label: '美妆产品',
    icon: '💄',
    category: 'image',
    version: '1.0.0',
    description: '专业美妆产品摄影，支持各类化妆品和护肤品',
    tags: ['image', 'cosmetics', 'beauty', 'product', 'gemini', 'photography']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '美妆产品摄影提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的美妆产品图' }],

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

      // === 产品类型 ===
      {
        key: 'cosmeticsType',
        label: '产品类型',
        type: 'select',
        default: 'lipstick',
        options: [
          { label: '口红/唇膏', value: 'lipstick' },
          { label: '眼影盘', value: 'eyeshadow' },
          { label: '粉底液', value: 'foundation' },
          { label: '香水', value: 'perfume' },
          { label: '护肤品', value: 'skincare' },
          { label: '美甲', value: 'nail' },
          { label: '套装', value: 'set' }
        ],
        description: '选择美妆产品类型'
      },

      // === 产品质感 ===
      {
        key: 'productTexture',
        label: '产品质感',
        type: 'select',
        default: 'glossy',
        options: [
          { label: '光泽', value: 'glossy' },
          { label: '哑光', value: 'matte' },
          { label: '丝绒', value: 'velvet' },
          { label: '珠光', value: 'shimmer' },
          { label: '透明', value: 'transparent' }
        ],
        description: '产品表面质感'
      },

      // === 展示风格 ===
      {
        key: 'displayStyle',
        label: '展示风格',
        type: 'select',
        default: 'product',
        options: [
          { label: '产品特写', value: 'product' },
          { label: '场景氛围', value: 'lifestyle' },
          { label: '平铺布局', value: 'flatlay' },
          { label: '悬浮效果', value: 'floating' },
          { label: '使用效果', value: 'application' }
        ],
        description: '产品展示风格'
      },

      // === 背景风格 ===
      {
        key: 'backgroundStyle',
        label: '背景风格',
        type: 'select',
        default: 'white',
        options: [
          { label: '纯白背景', value: 'white' },
          { label: '粉色背景', value: 'pink' },
          { label: '渐变背景', value: 'gradient' },
          { label: '大理石', value: 'marble' },
          { label: '花卉装饰', value: 'floral' }
        ],
        description: '选择背景风格'
      },

      // === 光线设置 ===
      {
        key: 'lightingStyle',
        label: '光线风格',
        type: 'select',
        default: 'soft',
        options: [
          { label: '柔和自然', value: 'soft' },
          { label: '高光对比', value: 'high_contrast' },
          { label: '梦幻光晕', value: 'dreamy' },
          { label: '专业棚拍', value: 'studio' }
        ],
        description: '选择光线风格'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的拍摄要求...\n例如：强调产品的奢华质感',
        description: '补充拍摄细节描述'
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
    nodeType: 'cosmetics_photo',
    imageSize: '2K',
    aspectRatio: '1:1',
    cosmeticsType: 'lipstick',
    productTexture: 'glossy',
    displayStyle: 'product',
    backgroundStyle: 'white',
    lightingStyle: 'soft',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 2,
    imageInputPorts: [
      { id: 'image_1', label: '产品图片', dataType: 'image', required: true, description: '美妆产品原图' },
      { id: 'image_2', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as CosmeticsPhotoExecutor }
export default CosmeticsPhotoNode
