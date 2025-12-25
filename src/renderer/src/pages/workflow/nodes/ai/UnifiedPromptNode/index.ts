/**
 * 统一提示词节点
 *
 * 合并 VisionPromptNode 和 QwenPromptNode，支持三种输出模式：
 * - model: 模特提示词 JSON
 * - pattern: 图案提示词 JSON
 * - ecom: 电商图提示词 JSON
 */

import type { NodeDefinition } from '../../base/types'
import { UnifiedPromptExecutor } from './executor'
import {
  AGE_OPTIONS,
  DISPLAY_MODE_OPTIONS,
  ETHNICITY_OPTIONS,
  FILL_MODE_OPTIONS,
  GENDER_OPTIONS,
  LAYOUT_MODE_OPTIONS,
  PATTERN_STYLE_OPTIONS,
  PATTERN_TYPE_OPTIONS,
  PLATFORM_STYLE_OPTIONS,
  POSE_OPTIONS,
  SCENE_OPTIONS,
  STYLE_MODE_OPTIONS
} from './prompts'

export const UnifiedPromptNode: NodeDefinition = {
  metadata: {
    type: 'unified_prompt',
    label: '智能提示词',
    icon: '🎯',
    category: 'ai',
    version: '2.0.0',
    author: 'Cherry Studio',
    description: '统一的AI提示词生成节点，支持模特/图案/电商图三种输出模式',
    tags: ['ai', 'prompt', 'vision', 'unified', 'model', 'pattern', 'ecom']
  },

  inputs: [
    {
      id: 'image_1',
      label: '图片 1 (主图)',
      dataType: 'image',
      required: true,
      description: '主要分析的图片'
    },
    {
      id: 'image_2',
      label: '图片 2 (可选)',
      dataType: 'image',
      required: false,
      description: '可选的参考图片'
    },
    {
      id: 'image_3',
      label: '图片 3 (可选)',
      dataType: 'image',
      required: false,
      description: '可选的参考图片'
    }
  ],

  // 输出端口：统一使用 promptJson，不再根据 outputMode 动态调整
  // 这样可以避免切换模式时边连接失效的问题
  outputs: [
    {
      id: 'promptJson',
      label: '提示词 JSON',
      dataType: 'json',
      description: '生成的提示词 JSON（根据输出模式不同，内容格式会有所不同）'
    },
    {
      id: 'videoPrompt',
      label: '视频提示词',
      dataType: 'text',
      description: '从 JSON 中提取的视频生成提示词（仅模特模式可用）'
    }
  ],

  configSchema: {
    fields: [
      // ========== 动态输入端口 ==========
      {
        key: 'imageInputCount',
        label: '图片输入数量',
        type: 'number',
        default: 3,
        min: 1,
        max: 10,
        description: '配置图片输入端口数量（1-10）'
      },

      // ========== 模型选择 ==========
      {
        key: 'model',
        label: '视觉模型',
        type: 'model-selector',
        required: false,
        description: '选择用于分析图片的视觉模型（如 Gemini、GPT-4V、Claude、Qwen-VL 等）'
      },

      // ========== 输出模式（核心）==========
      {
        key: 'outputMode',
        label: '输出模式',
        type: 'select',
        required: true,
        default: 'model',
        options: [
          { label: '🧑 模特提示词', value: 'model' },
          { label: '🎨 图案提示词', value: 'pattern' },
          { label: '📸 电商图提示词', value: 'ecom' },
          { label: '📦 全部输出', value: 'all' }
        ],
        description: '选择生成的提示词类型，决定使用哪个系统提示词'
      },

      // ========== 通用配置 ==========
      {
        key: 'ageGroup',
        label: '年龄段',
        type: 'select',
        required: false,
        default: 'small_kid',
        options: AGE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '目标年龄段'
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        required: false,
        default: 'female',
        options: GENDER_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '目标性别'
      },

      // ========== 模特模式专用 ==========
      {
        key: 'styleMode',
        label: '风格模式',
        type: 'select',
        required: false,
        default: 'daily',
        options: STYLE_MODE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择拍摄风格',
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },
      {
        key: 'scenePreset',
        label: '场景预设',
        type: 'select',
        required: false,
        default: 'home',
        options: SCENE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择场景类型',
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },
      {
        key: 'ethnicityPreset',
        label: '人种预设',
        type: 'select',
        required: false,
        default: 'asian',
        options: ETHNICITY_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择模特人种',
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },
      {
        key: 'posePreset',
        label: '姿态预设',
        type: 'select',
        required: false,
        default: 'natural',
        options: POSE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择模特姿态',
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },

      // ========== 图案模式专用 ==========
      {
        key: 'patternType',
        label: '图案类型',
        type: 'select',
        required: false,
        default: 'seamless',
        options: PATTERN_TYPE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择图案类型',
        showWhen: { field: 'outputMode', value: ['pattern', 'all'] }
      },
      {
        key: 'patternStyle',
        label: '图案风格',
        type: 'select',
        required: false,
        default: 'auto',
        options: PATTERN_STYLE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择图案风格，自动模式会根据图片识别',
        showWhen: { field: 'outputMode', value: ['pattern', 'all'] }
      },

      // ========== 电商图模式专用 ==========
      {
        key: 'displayMode',
        label: '展示模式',
        type: 'select',
        required: false,
        default: 'flat_lay',
        options: DISPLAY_MODE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择电商图展示方式',
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },
      {
        key: 'platformStyle',
        label: '平台风格',
        type: 'select',
        required: false,
        default: 'shein',
        options: PLATFORM_STYLE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择目标电商平台风格',
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },
      {
        key: 'layoutMode',
        label: '布局模式',
        type: 'select',
        required: false,
        default: 'flat_lay',
        options: LAYOUT_MODE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择电商图布局方式',
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },
      {
        key: 'fillMode',
        label: '填充模式',
        type: 'select',
        required: false,
        default: 'filled',
        options: FILL_MODE_OPTIONS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择服装填充效果',
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },

      // ========== 通用高级配置 ==========
      {
        key: 'visualAnchors',
        label: '视觉锚点 (Visual Anchors)',
        type: 'textarea',
        required: false,
        placeholder: '例如：必须保留胸口刺绣细节、保持天鹅绒材质质感...',
        description: '强制 AI 注意的关键视觉特征，防止在重绘中丢失'
      },
      {
        key: 'constraintPrompt',
        label: '约束提示词',
        type: 'textarea',
        required: false,
        placeholder: '自定义约束条件，例如：双手叉腰、眼神看向镜头、背景需要有绿植等',
        description: '自定义约束条件，会添加到系统提示词中'
      },
      {
        key: 'temperature',
        label: '创意度',
        type: 'number',
        required: false,
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
        description: '较高的值会产生更有创意的结果'
      }
    ]
  },

  defaultConfig: {
    imageInputCount: 3,
    model: null, // 自动选择视觉模型
    outputMode: 'model',
    // 统一输出端口配置（不再根据 outputMode 动态变化）
    outputPorts: [
      { id: 'promptJson', label: '提示词 JSON', dataType: 'json', description: '生成的提示词 JSON' },
      { id: 'videoPrompt', label: '视频提示词', dataType: 'text', description: '从 JSON 中提取的视频生成提示词' }
    ],
    ageGroup: 'small_kid',
    gender: 'female',
    styleMode: 'daily',
    scenePreset: 'home',
    ethnicityPreset: 'asian',
    posePreset: 'natural',
    patternType: 'seamless',
    patternStyle: 'auto',
    displayMode: 'flat_lay',
    platformStyle: 'shein',
    layoutMode: 'flat_lay',
    fillMode: 'filled',
    temperature: 0.7
  },

  executor: new UnifiedPromptExecutor()
}

export { UnifiedPromptExecutor } from './executor'
export type { UnifiedPromptNodeConfig } from './types'
export default UnifiedPromptNode
