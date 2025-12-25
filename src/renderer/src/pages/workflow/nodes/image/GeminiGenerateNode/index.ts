/**
 * Gemini 图片生成节点定义 v2.0
 *
 * 深度优化版本，支持：
 * - 批量生成
 * - 参考图片输入
 * - 多种尺寸和比例
 * - 风格预设
 * - 种子控制
 *
 * **Feature: executor-strategy-pattern**
 * 现在支持两种执行器：
 * - GeminiGenerateExecutor (deprecated): 原有的条件分支执行器
 * - StrategyBasedExecutor: 基于策略模式的新执行器
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from './executor'
import { StrategyBasedExecutor } from './StrategyBasedExecutor'

export const GeminiGenerateNode: NodeDefinition = {
  metadata: {
    type: 'gemini_generate',
    label: 'Gemini 生成',
    icon: '✨',
    category: 'image',
    version: '2.0.0',
    description: '使用 Gemini 生成图片，支持批量生成和参考图片',
    tags: ['image', 'generate', 'gemini', 'ai', 'batch']
  },

  // 静态输入端口 + 动态图片输入端口
  // prompt 和 promptJson 是固定的，图片输入通过 imageInputCount 动态管理
  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '图片生成提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从视觉提示词节点传入的 JSON' }
  ],

  outputs: [
    { id: 'image', label: '生成图片', dataType: 'image', description: '第一张生成的图片' },
    { id: 'images', label: '全部图片', dataType: 'images', description: '批量生成的所有图片' },
    { id: 'metadata', label: '元数据', dataType: 'json', description: '生成参数和结果信息' }
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
          { label: '9:16 手机竖屏', value: '9:16' },
          { label: '16:9 宽屏', value: '16:9' },
          { label: '2:3 海报竖版', value: '2:3' },
          { label: '3:2 海报横版', value: '3:2' }
        ],
        description: '生成图片的宽高比'
      },

      // === 批量生成 ===
      {
        key: 'batchSize',
        label: '批量数量',
        type: 'number',
        default: 1,
        min: 1,
        max: 4,
        description: '一次生成的图片数量 (1-4)'
      },
      {
        key: 'variationStrength',
        label: '变体强度',
        type: 'number',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
        description: '批量生成时各图片之间的差异程度',
        showWhen: { field: 'batchSize', value: [2, 3, 4] }
      },

      // === 提示词配置 ===
      {
        key: 'prompt',
        label: '默认提示词',
        type: 'textarea',
        placeholder: '输入图片生成提示词...\n描述你想要生成的图片内容',
        description: '当没有上游提示词输入时使用'
      },
      {
        key: 'negativePrompt',
        label: '负面提示词',
        type: 'textarea',
        placeholder: 'blur, low quality, distorted...',
        description: '描述不希望出现的内容'
      },
      {
        key: 'promptEnhancement',
        label: '提示词增强',
        type: 'checkbox',
        default: false,
        description: '自动优化提示词以获得更好的结果'
      },

      // === 风格预设 ===
      {
        key: 'stylePreset',
        label: '风格预设',
        type: 'select',
        default: 'none',
        options: [
          { label: '无预设', value: 'none' },
          { label: '写实摄影', value: 'photographic' },
          { label: '数字艺术', value: 'digital-art' },
          { label: '动漫风格', value: 'anime' },
          { label: '油画风格', value: 'oil-painting' },
          { label: '水彩风格', value: 'watercolor' },
          { label: '3D 渲染', value: '3d-render' },
          { label: '像素艺术', value: 'pixel-art' },
          { label: '线稿', value: 'line-art' }
        ],
        description: '预设的艺术风格'
      },

      // === 高级选项 ===
      {
        key: 'seed',
        label: '种子值',
        type: 'number',
        placeholder: '留空则随机',
        description: '固定种子可生成相似结果'
      },
      {
        key: 'temperature',
        label: '创意度',
        type: 'number',
        default: 1.0,
        min: 0.1,
        max: 2.0,
        step: 0.1,
        description: '较高值产生更有创意的结果'
      },
      {
        key: 'useReferenceImages',
        label: '使用参考图片',
        type: 'checkbox',
        default: true,
        description: '是否使用输入的参考图片'
      },
      {
        key: 'referenceWeight',
        label: '参考图权重',
        type: 'number',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
        description: '参考图片对生成结果的影响程度',
        showWhen: { field: 'useReferenceImages', value: true }
      },

      // === 重试选项 ===
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成失败时的重试次数'
      },
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 120,
        min: 30,
        max: 300,
        description: '单次生成的最大等待时间（秒）'
      }
    ]
  },

  defaultConfig: {
    imageSize: '2K',
    aspectRatio: '1:1',
    batchSize: 1,
    variationStrength: 0.5,
    prompt: '',
    negativePrompt: '',
    promptEnhancement: false,
    stylePreset: 'none',
    temperature: 1.0,
    useReferenceImages: true,
    referenceWeight: 0.5,
    retryCount: 2,
    timeout: 120,
    // 动态图片输入端口配置
    imageInputCount: 1
  },

  // 使用策略模式执行器（推荐）
  // 如需回退到旧执行器：new GeminiGenerateExecutor()
  executor: new StrategyBasedExecutor()
}

// 导出执行器（StrategyBasedExecutor 为推荐）
export { StrategyBasedExecutor }
/** @deprecated 请使用 StrategyBasedExecutor */
export { GeminiGenerateExecutor }
export default GeminiGenerateNode
