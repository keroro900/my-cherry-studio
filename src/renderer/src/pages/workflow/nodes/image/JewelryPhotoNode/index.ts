/**
 * 珠宝摄影节点定义
 *
 * 专业珠宝产品摄影生成：
 * - 支持戒指、项链、耳环、手链、手表
 * - 金属表面光线控制
 * - 宝石折射与火彩捕捉
 * - 微距摄影技术
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const JewelryPhotoNode: NodeDefinition = {
  metadata: {
    type: 'jewelry_photo',
    label: '珠宝摄影',
    icon: '💎',
    category: 'image',
    version: '1.0.0',
    description: '专业珠宝产品摄影，支持金属与宝石光线控制',
    tags: ['image', 'jewelry', 'product', 'gemini', 'photography']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '珠宝摄影提示词（可替代配置中的提示词）' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
    // 图片输入端口通过 imageInputPorts 动态配置
  ],

  outputs: [
    { id: 'image', label: '图片', dataType: 'image', description: '生成的珠宝产品图' }
  ],

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

      // === 珠宝类型 ===
      {
        key: 'jewelryType',
        label: '珠宝类型',
        type: 'select',
        default: 'ring',
        options: [
          { label: '戒指', value: 'ring' },
          { label: '项链', value: 'necklace' },
          { label: '耳环', value: 'earring' },
          { label: '手链', value: 'bracelet' },
          { label: '手表', value: 'watch' }
        ],
        description: '选择珠宝类型'
      },

      // === 金属类型 ===
      {
        key: 'metalType',
        label: '金属类型',
        type: 'select',
        default: 'gold',
        options: [
          { label: '黄金', value: 'gold' },
          { label: '白银', value: 'silver' },
          { label: '铂金', value: 'platinum' },
          { label: '玫瑰金', value: 'rose_gold' }
        ],
        description: '选择金属材质'
      },

      // === 宝石类型 ===
      {
        key: 'stoneType',
        label: '宝石类型',
        type: 'select',
        default: 'diamond',
        options: [
          { label: '钻石', value: 'diamond' },
          { label: '红宝石', value: 'ruby' },
          { label: '蓝宝石', value: 'sapphire' },
          { label: '祖母绿', value: 'emerald' },
          { label: '珍珠', value: 'pearl' },
          { label: '无宝石', value: 'none' }
        ],
        description: '选择镶嵌宝石类型'
      },

      // === 光线设置 ===
      {
        key: 'lightingSetup',
        label: '光线设置',
        type: 'select',
        default: 'soft_box',
        options: [
          { label: '柔光箱', value: 'soft_box' },
          { label: '环形灯', value: 'ring_light' },
          { label: '自然光', value: 'natural' },
          { label: '戏剧光', value: 'dramatic' }
        ],
        description: '选择拍摄光线设置'
      },

      // === 背景风格 ===
      {
        key: 'backgroundStyle',
        label: '背景风格',
        type: 'select',
        default: 'white',
        options: [
          { label: '纯白背景', value: 'white' },
          { label: '黑色背景', value: 'black' },
          { label: '渐变背景', value: 'gradient' },
          { label: '生活场景', value: 'lifestyle' }
        ],
        description: '选择背景风格'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的拍摄要求...\n例如：特别强调钻石的火彩效果',
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
    nodeType: 'jewelry_photo', // 标识节点类型，用于执行器判断
    imageSize: '2K',
    aspectRatio: '1:1',
    jewelryType: 'ring',
    metalType: 'gold',
    stoneType: 'diamond',
    lightingSetup: 'soft_box',
    backgroundStyle: 'white',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 2,
    imageInputPorts: [
      { id: 'image_1', label: '珠宝图片', dataType: 'image', required: true, description: '需要拍摄的珠宝产品图' },
      { id: 'image_2', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as JewelryPhotoExecutor }
export default JewelryPhotoNode
