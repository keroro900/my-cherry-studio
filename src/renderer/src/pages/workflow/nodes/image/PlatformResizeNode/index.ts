/**
 * 平台尺寸适配节点
 * Platform Resize Node
 *
 * 将产品图片一键适配到各电商平台的规格尺寸
 * 支持多平台批量处理
 */

import type { NodeDefinition } from '../../base/types'
import { PlatformResizeExecutor } from './executor'
import { PLATFORM_SPECS } from './types'

// 生成平台选项
const PLATFORM_OPTIONS = Object.entries(PLATFORM_SPECS).map(([id, spec]) => ({
  label: spec.name,
  value: id,
  description: spec.description
}))

export const PlatformResizeNode: NodeDefinition = {
  metadata: {
    type: 'platform_resize',
    label: '平台尺寸适配',
    icon: '📐',
    category: 'image',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '将产品图片一键适配到各电商平台的规格尺寸，支持批量处理',
    tags: ['image', 'resize', 'ecommerce', 'platform', 'batch']
  },

  inputs: [
    {
      id: 'image',
      label: '输入图片',
      dataType: 'image',
      required: true,
      description: '需要调整尺寸的产品图片'
    }
  ],

  outputs: [
    {
      id: 'image',
      label: '输出图片',
      dataType: 'image',
      description: '调整尺寸后的图片'
    },
    {
      id: 'images',
      label: '批量输出',
      dataType: 'images',
      description: '批量模式下的多平台图片数组'
    },
    {
      id: 'width',
      label: '宽度',
      dataType: 'number',
      description: '输出图片宽度'
    },
    {
      id: 'height',
      label: '高度',
      dataType: 'number',
      description: '输出图片高度'
    }
  ],

  configSchema: {
    fields: [
      // ========== 目标平台 ==========
      {
        key: 'targetPlatform',
        label: '目标平台',
        type: 'select',
        required: true,
        default: 'amazon_main',
        options: PLATFORM_OPTIONS,
        description: '选择目标电商平台'
      },

      // ========== 缩放设置 ==========
      {
        key: 'scaleMode',
        label: '缩放模式',
        type: 'select',
        required: true,
        default: 'fit',
        options: [
          { label: '适应 (保持比例，可能留白)', value: 'fit' },
          { label: '填充 (保持比例，可能裁剪)', value: 'fill' },
          { label: '拉伸 (可能变形)', value: 'stretch' },
          { label: '包含 (完整显示)', value: 'contain' }
        ],
        description: '图片缩放方式'
      },
      {
        key: 'maintainAspectRatio',
        label: '保持宽高比',
        type: 'checkbox',
        required: false,
        default: true,
        description: '保持原图片的宽高比例'
      },

      // ========== 背景设置 ==========
      {
        key: 'backgroundFill',
        label: '背景填充',
        type: 'select',
        required: true,
        default: 'white',
        options: [
          { label: '白色', value: 'white' },
          { label: '黑色', value: 'black' },
          { label: '透明', value: 'transparent' },
          { label: '模糊背景', value: 'blur' },
          { label: '自定义颜色', value: 'color' }
        ],
        description: '留白区域的填充方式'
      },
      {
        key: 'backgroundColor',
        label: '自定义背景色',
        type: 'text',
        required: false,
        default: '#FFFFFF',
        description: '当背景填充为"自定义颜色"时使用（如 #FFFFFF）'
      },

      // ========== 输出设置 ==========
      {
        key: 'outputFormat',
        label: '输出格式',
        type: 'select',
        required: true,
        default: 'jpg',
        options: [
          { label: 'JPG', value: 'jpg' },
          { label: 'PNG', value: 'png' },
          { label: 'WebP', value: 'webp' }
        ],
        description: '输出图片格式'
      },
      {
        key: 'quality',
        label: '输出质量',
        type: 'number',
        required: false,
        default: 90,
        min: 1,
        max: 100,
        description: '图片压缩质量（1-100）'
      },

      // ========== 自定义尺寸 ==========
      {
        key: 'customWidth',
        label: '自定义宽度',
        type: 'number',
        required: false,
        default: 1000,
        min: 100,
        max: 10000,
        description: '当平台选择"自定义尺寸"时的宽度'
      },
      {
        key: 'customHeight',
        label: '自定义高度',
        type: 'number',
        required: false,
        default: 1000,
        min: 100,
        max: 10000,
        description: '当平台选择"自定义尺寸"时的高度'
      },

      // ========== 批量模式 ==========
      {
        key: 'batchMode',
        label: '批量模式',
        type: 'checkbox',
        required: false,
        default: false,
        description: '同时生成多个平台尺寸'
      }
    ]
  },

  defaultConfig: {
    targetPlatform: 'amazon_main',
    scaleMode: 'fit',
    backgroundFill: 'white',
    outputFormat: 'jpg',
    quality: 90,
    maintainAspectRatio: true,
    batchMode: false,
    customWidth: 1000,
    customHeight: 1000
  },

  executor: new PlatformResizeExecutor()
}

export { PlatformResizeExecutor } from './executor'
export type { PlatformResizeConfig, PlatformResizeOutput } from './types'
export { PLATFORM_SPECS } from './types'
export default PlatformResizeNode
