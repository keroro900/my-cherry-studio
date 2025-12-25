/**
 * 食品摄影节点定义
 *
 * 专业食品产品摄影生成：
 * - 支持饮品、甜点、主菜、零食、原料
 * - 新鲜感与色彩控制
 * - 蒸汽/水珠等动态效果
 * - 摆盘与构图技巧
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const FoodPhotoNode: NodeDefinition = {
  metadata: {
    type: 'food_photo',
    label: '食品摄影',
    icon: '🍽️',
    category: 'image',
    version: '1.0.0',
    description: '专业食品产品摄影，支持新鲜感与动态效果控制',
    tags: ['image', 'food', 'product', 'gemini', 'photography']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '食品摄影提示词（可替代配置中的提示词）' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的食品产品图' }],

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

      // === 食品类别 ===
      {
        key: 'foodCategory',
        label: '食品类别',
        type: 'select',
        default: 'main_dish',
        options: [
          { label: '饮品', value: 'beverage' },
          { label: '甜点', value: 'dessert' },
          { label: '主菜', value: 'main_dish' },
          { label: '零食', value: 'snack' },
          { label: '原料', value: 'ingredient' }
        ],
        description: '选择食品类别'
      },

      // === 风格预设 ===
      {
        key: 'stylePreset',
        label: '风格预设',
        type: 'select',
        default: 'modern',
        options: [
          { label: '极简', value: 'minimalist' },
          { label: '乡村', value: 'rustic' },
          { label: '现代', value: 'modern' },
          { label: '传统', value: 'traditional' }
        ],
        description: '选择拍摄风格'
      },

      // === 氛围预设 ===
      {
        key: 'moodPreset',
        label: '氛围预设',
        type: 'select',
        default: 'warm',
        options: [
          { label: '温暖', value: 'warm' },
          { label: '清新', value: 'fresh' },
          { label: '舒适', value: 'cozy' },
          { label: '优雅', value: 'elegant' }
        ],
        description: '选择拍摄氛围'
      },

      // === 背景风格 ===
      {
        key: 'backgroundStyle',
        label: '背景风格',
        type: 'select',
        default: 'white',
        options: [
          { label: '纯白', value: 'white' },
          { label: '木质', value: 'wood' },
          { label: '大理石', value: 'marble' },
          { label: '深色', value: 'dark' },
          { label: '彩色', value: 'colorful' }
        ],
        description: '选择背景风格'
      },

      // === 动态效果 ===
      {
        key: 'enableSteam',
        label: '蒸汽效果',
        type: 'checkbox',
        default: false,
        description: '为热食添加蒸汽效果'
      },
      {
        key: 'enableDroplets',
        label: '水珠效果',
        type: 'checkbox',
        default: false,
        description: '添加新鲜水珠/凝结效果'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的拍摄要求...\n例如：强调食物的新鲜感和色彩',
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
    nodeType: 'food_photo',
    imageSize: '2K',
    aspectRatio: '1:1',
    foodCategory: 'main_dish',
    stylePreset: 'modern',
    moodPreset: 'warm',
    backgroundStyle: 'white',
    enableSteam: false,
    enableDroplets: false,
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 2,
    imageInputPorts: [
      { id: 'image_1', label: '食品图片', dataType: 'image', required: true, description: '需要拍摄的食品产品图' },
      { id: 'image_2', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as FoodPhotoExecutor }
export default FoodPhotoNode
