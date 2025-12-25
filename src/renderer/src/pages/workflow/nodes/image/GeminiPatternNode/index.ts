/**
 * Gemini 图案生成节点定义
 *
 * 专业图案生成：
 * - 无缝图案 (seamless)
 * - T恤大图 (graphic/placement)
 * - 元素派生
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const GeminiPatternNode: NodeDefinition = {
  metadata: {
    type: 'gemini_pattern',
    label: '图案生成',
    icon: '🎨',
    category: 'image',
    version: '1.0.0',
    description: '专业图案生成：无缝图案/T恤图案/元素派生',
    tags: ['image', 'pattern', 'seamless', 'gemini', 'textile']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '图案生成提示词（可替代配置中的提示词）' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' },
    { id: 'reference_1', label: '参考图 1', dataType: 'image', description: '主要参考图片' },
    { id: 'reference_2', label: '参考图 2', dataType: 'image', description: '额外参考图片' },
    { id: 'reference_3', label: '参考图 3', dataType: 'image', description: '额外参考图片' }
  ],

  outputs: [
    { id: 'patternImage', label: '无缝图案', dataType: 'image', description: '生成的无缝可平铺图案' },
    { id: 'graphicImage', label: 'T恤大图', dataType: 'image', description: '生成的T恤胸前图案' },
    { id: 'image', label: '图片', dataType: 'image', description: '主输出图片' },
    { id: 'images', label: '全部图片', dataType: 'images', description: '批量生成的所有图片' }
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

      // === 生成模式 ===
      {
        key: 'generationMode',
        label: '生成模式',
        type: 'select',
        default: 'mode_a',
        options: [
          { label: 'Mode A: 元素重组', value: 'mode_a' },
          { label: 'Mode B: 纯无缝化', value: 'mode_b' },
          { label: 'Mode C: 设计大师', value: 'mode_c' }
        ],
        description: '选择图案生成方式'
      },

      // === 输出类型 ===
      {
        key: 'outputType',
        label: '输出类型',
        type: 'select',
        default: 'pattern_only',
        options: [
          { label: '仅生成无缝图案', value: 'pattern_only' },
          { label: '套装: 大图 + 无缝', value: 'set' }
        ],
        description: '选择输出内容'
      },

      // === 图案类型 ===
      {
        key: 'patternType',
        label: '图案类型',
        type: 'select',
        default: 'seamless',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '无缝图案', value: 'seamless' },
          { label: '几何图案', value: 'geometric' },
          { label: '花卉图案', value: 'floral' },
          { label: '抽象图案', value: 'abstract' },
          { label: '卡通角色', value: 'cartoon' },
          { label: '动物主题', value: 'animal' },
          { label: '食物主题', value: 'food' },
          { label: '从参考图派生', value: 'derived' }
        ],
        description: '选择图案风格类型'
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
          { label: '3:4 纵向', value: '3:4' },
          { label: '4:3 横向', value: '4:3' },
          { label: '9:16 竖屏', value: '9:16' }
        ],
        description: '生成图片的宽高比'
      },

      // === 图案参数 ===
      {
        key: 'density',
        label: '图案密度',
        type: 'select',
        default: 'medium',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '稀疏 (留白多)', value: 'sparse' },
          { label: '适中 (推荐)', value: 'medium' },
          { label: '密集 (填充满)', value: 'dense' }
        ],
        description: '元素的分布疏密程度'
      },
      {
        key: 'colorTone',
        label: '色调风格',
        type: 'select',
        default: 'auto',
        options: [
          { label: '无（自由发挥）', value: 'none' },
          { label: '自动匹配', value: 'auto' },
          { label: '明亮活泼', value: 'bright' },
          { label: '柔和淡雅', value: 'soft' },
          { label: '深色沉稳', value: 'dark' },
          { label: '高对比度', value: 'contrast' }
        ],
        description: '整体色彩倾向'
      },

      // === 提示词配置 ===
      {
        key: 'customPrompt',
        label: '额外描述',
        type: 'textarea',
        placeholder: '补充说明...\n例如：增加一些星星元素，整体色调偏暖',
        description: '补充风格预设之外的细节要求'
      },
      {
        key: 'negativePrompt',
        label: '负面提示词',
        type: 'textarea',
        placeholder: '例如：文字、水印、模糊、变形、人脸',
        description: '不希望出现的元素'
      },

      // === 高级选项 ===
      {
        key: 'useSystemPrompt',
        label: '使用系统提示词',
        type: 'checkbox',
        default: true,
        description: '启用专业图案生成提示词'
      },
      {
        key: 'promptEnhancement',
        label: '提示词增强',
        type: 'checkbox',
        default: false,
        description: 'AI 自动优化和扩展提示词'
      },
      {
        key: 'seed',
        label: '种子值',
        type: 'number',
        placeholder: '留空则随机',
        description: '固定种子可生成相似结果'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 1,
        min: 0,
        max: 3,
        description: '生成失败时自动重试'
      },
      {
        key: 'batchSize',
        label: '批量数量',
        type: 'number',
        default: 1,
        min: 1,
        max: 10,
        description: '每个参考图生成的变体数'
      }
    ]
  },

  defaultConfig: {
    nodeType: 'gemini_pattern', // 标识节点类型，用于执行器判断
    imageSize: '2K',
    aspectRatio: '1:1',
    generationMode: 'mode_a',
    outputType: 'pattern_only',
    patternType: 'seamless',
    imageInputCount: 1,
    stylePresetId: '',
    stylePresetName: '',
    stylePresetPrompt: '',
    customPrompt: '',
    negativePrompt: '',
    density: 'medium',
    colorTone: 'auto',
    useSystemPrompt: true,
    promptEnhancement: false,
    retryCount: 1,
    batchSize: 1
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as GeminiPatternExecutor }
export default GeminiPatternNode
