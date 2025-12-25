/**
 * Gemini 图片编辑节点定义
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiEditExecutor } from './executor'

export const GeminiEditNode: NodeDefinition = {
  metadata: {
    type: 'gemini_edit',
    label: 'Gemini 编辑',
    icon: '✂️',
    category: 'image',
    version: '2.0.0',
    description: '使用 Gemini 编辑图片（模特换装/场景变换）',
    tags: ['image', 'edit', 'gemini', 'ai', 'model']
  },

  inputs: [
    { id: 'baseImage', label: '基础图片', dataType: 'image', required: true, description: '要编辑的图片' },
    { id: 'clothesImage', label: '服装图片', dataType: 'image', description: '服装参考图' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从视觉提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'editedImage', label: '编辑后图片', dataType: 'image', description: '编辑后的图片' }],

  configSchema: {
    fields: [
      {
        key: 'providerId',
        label: 'Provider',
        type: 'model-selector',
        modelFilter: 'image-generation',
        description: '选择 Gemini 图片生成服务'
      },
      {
        key: 'mode',
        label: '编辑模式',
        type: 'select',
        default: 'preset',
        options: [
          { label: '预设模式 (推荐)', value: 'preset' },
          { label: '自定义模式', value: 'custom' }
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
          { label: '9:16 手机竖屏', value: '9:16' },
          { label: '16:9 宽屏', value: '16:9' }
        ]
      },
      // 预设模式 - 模特配置
      {
        key: 'ageGroup',
        label: '年龄段',
        type: 'select',
        default: 'big_kid',
        options: [
          { label: '小童 (4-7岁)', value: 'small_kid' },
          { label: '大童 (8-12岁)', value: 'big_kid' },
          { label: '成人 (20-28岁)', value: 'adult' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        default: 'female',
        options: [
          { label: '👧 女', value: 'female' },
          { label: '👦 男', value: 'male' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      {
        key: 'ethnicityPreset',
        label: '人种预设',
        type: 'select',
        default: 'asian',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '亚洲人', value: 'asian' },
          { label: '欧美白人', value: 'caucasian' },
          { label: '非裔', value: 'african_american' },
          { label: '拉丁裔', value: 'hispanic' },
          { label: '混血', value: 'mixed' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      // 预设模式 - 风格配置
      {
        key: 'styleMode',
        label: '拍摄风格',
        type: 'select',
        default: 'daily',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '📱 日常感 (iPhone抓拍)', value: 'daily' },
          { label: '📸 商拍感 (专业棚拍)', value: 'commercial' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      {
        key: 'scenePreset',
        label: '场景预设',
        type: 'select',
        default: 'home',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '🏠 室内家居', value: 'home' },
          { label: '🌳 户外自然', value: 'outdoor' },
          { label: '📷 专业摄影棚', value: 'studio' },
          { label: '🎠 儿童游乐场', value: 'playground' },
          { label: '🌸 自然风光', value: 'nature' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      {
        key: 'posePreset',
        label: '姿态预设',
        type: 'select',
        default: 'natural',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '自然站立', value: 'natural' },
          { label: '坐姿', value: 'sitting' },
          { label: '玩耍', value: 'playing' },
          { label: '行走', value: 'walking' }
        ],
        showWhen: { field: 'mode', value: 'preset' }
      },
      // 自定义模式
      {
        key: 'customPrompt',
        label: '自定义提示词',
        type: 'textarea',
        placeholder: '输入详细的编辑提示词...',
        showWhen: { field: 'mode', value: 'custom' }
      }
    ]
  },

  defaultConfig: {
    mode: 'preset',
    imageSize: '2K',
    aspectRatio: '3:4',
    ageGroup: 'big_kid',
    gender: 'female',
    ethnicityPreset: 'asian',
    styleMode: 'daily',
    scenePreset: 'home',
    posePreset: 'natural'
  },

  executor: new GeminiEditExecutor()
}

export { GeminiEditExecutor }
export { GeminiEditCustomNode } from './GeminiEditCustomNode'
export default GeminiEditNode
