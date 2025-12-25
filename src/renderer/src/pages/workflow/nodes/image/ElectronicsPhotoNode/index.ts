/**
 * 3C产品摄影节点定义
 *
 * 专业电子产品摄影生成：
 * - 支持手机、电脑、耳机、相机等
 * - 反光表面处理
 * - 屏幕内容展示
 * - 科技感氛围营造
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const ElectronicsPhotoNode: NodeDefinition = {
  metadata: {
    type: 'electronics_photo',
    label: '3C产品',
    icon: '📱',
    category: 'image',
    version: '1.0.0',
    description: '专业电子产品摄影，支持各类3C产品展示',
    tags: ['image', 'electronics', '3C', 'tech', 'product', 'gemini', 'photography']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '3C产品摄影提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的3C产品图' }],

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
          { label: '4:3 横版', value: '4:3' },
          { label: '16:9 宽屏', value: '16:9' },
          { label: '3:4 竖版', value: '3:4' }
        ],
        description: '生成图片的宽高比'
      },

      // === 产品类型 ===
      {
        key: 'electronicsType',
        label: '产品类型',
        type: 'select',
        default: 'smartphone',
        options: [
          { label: '智能手机', value: 'smartphone' },
          { label: '笔记本电脑', value: 'laptop' },
          { label: '平板电脑', value: 'tablet' },
          { label: '耳机', value: 'headphones' },
          { label: '智能手表', value: 'smartwatch' },
          { label: '相机', value: 'camera' },
          { label: '游戏机', value: 'gaming' },
          { label: '智能家居', value: 'smart_home' }
        ],
        description: '选择电子产品类型'
      },

      // === 展示风格 ===
      {
        key: 'displayStyle',
        label: '展示风格',
        type: 'select',
        default: 'product',
        options: [
          { label: '产品特写', value: 'product' },
          { label: '使用场景', value: 'lifestyle' },
          { label: '悬浮展示', value: 'floating' },
          { label: '分解展示', value: 'exploded' },
          { label: '多角度', value: 'multi_angle' }
        ],
        description: '产品展示风格'
      },

      // === 表面效果 ===
      {
        key: 'surfaceEffect',
        label: '表面效果',
        type: 'select',
        default: 'glossy',
        options: [
          { label: '光亮反射', value: 'glossy' },
          { label: '哑光磨砂', value: 'matte' },
          { label: '金属质感', value: 'metallic' },
          { label: '玻璃透明', value: 'glass' }
        ],
        description: '产品表面效果'
      },

      // === 光线风格 ===
      {
        key: 'lightingStyle',
        label: '光线风格',
        type: 'select',
        default: 'studio',
        options: [
          { label: '专业棚拍', value: 'studio' },
          { label: '科技蓝光', value: 'tech_blue' },
          { label: '渐变彩光', value: 'gradient' },
          { label: '自然光', value: 'natural' },
          { label: '霓虹光效', value: 'neon' }
        ],
        description: '选择光线风格'
      },

      // === 屏幕内容 ===
      {
        key: 'screenContent',
        label: '屏幕内容',
        type: 'select',
        default: 'blank',
        options: [
          { label: '空白/关闭', value: 'blank' },
          { label: '应用界面', value: 'app_ui' },
          { label: '壁纸', value: 'wallpaper' },
          { label: '产品展示', value: 'product_display' },
          { label: '自定义', value: 'custom' }
        ],
        description: '屏幕显示内容（适用于有屏设备）'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的拍摄要求...\n例如：强调产品的超薄设计',
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
    nodeType: 'electronics_photo',
    imageSize: '2K',
    aspectRatio: '1:1',
    electronicsType: 'smartphone',
    displayStyle: 'product',
    surfaceEffect: 'glossy',
    lightingStyle: 'studio',
    screenContent: 'blank',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 2,
    imageInputPorts: [
      { id: 'image_1', label: '产品图片', dataType: 'image', required: true, description: '电子产品原图' },
      { id: 'image_2', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as ElectronicsPhotoExecutor }
export default ElectronicsPhotoNode
