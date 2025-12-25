/**
 * 统一视频生成节点定义
 *
 * 支持多种视频生成模型：
 * - OpenAI Sora
 * - Google Veo
 * - Kling AI
 * - Runway Gen-3
 * - Pika Labs
 * - MiniMax
 * - 其他兼容 OpenAI 视频 API 的服务
 *
 * 特性：
 * - 文生视频 + 图生视频
 * - 动态模型列表（从 Provider 获取）
 * - 异步任务轮询
 * - 进度回调
 */

import type { NodeDefinition } from '../../base/types'
import { UnifiedVideoGenerationExecutor } from './executor'

export const UnifiedVideoGenerationNode: NodeDefinition = {
  metadata: {
    type: 'unified_video_generation',
    label: '视频生成',
    icon: '🎬',
    category: 'video',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '使用 AI 模型生成视频，支持文生视频和图生视频',
    tags: ['video', 'ai', 'generation', 'text2video', 'image2video', 'sora', 'veo', 'kling']
  },

  inputs: [
    {
      id: 'prompt',
      label: '提示词',
      dataType: 'text',
      description: '描述要生成的视频内容'
    },
    {
      id: 'image',
      label: '首帧图片',
      dataType: 'image',
      description: '图生视频模式的源图片（可选）'
    },
    {
      id: 'imageEnd',
      label: '尾帧图片',
      dataType: 'image',
      description: '视频结束时的目标图片（可选）'
    },
    {
      id: 'negativePrompt',
      label: '负面提示词',
      dataType: 'text',
      description: '描述不希望出现的内容（可选）'
    },
    {
      id: 'promptJson',
      label: '提示词 JSON',
      dataType: 'json',
      description: '从提示词节点传入的 JSON（包含 video_prompt 字段）'
    }
  ],

  outputs: [
    {
      id: 'video',
      label: '生成视频',
      dataType: 'video',
      description: '生成的视频 URL'
    },
    {
      id: 'metadata',
      label: '元数据',
      dataType: 'json',
      description: '生成参数和任务信息'
    }
  ],

  configSchema: {
    fields: [
      // === 模型配置 ===
      {
        key: 'model',
        label: '视频模型',
        type: 'model-selector',
        required: true,
        modelFilter: 'video-generation',
        description: '选择视频生成模型'
      },

      // === 生成模式 ===
      {
        key: 'mode',
        label: '生成模式',
        type: 'select',
        default: 'text2video',
        options: [
          { label: '文生视频', value: 'text2video' },
          { label: '图生视频', value: 'image2video' }
        ],
        description: '选择生成模式'
      },

      // === 视频参数 ===
      {
        key: 'duration',
        label: '视频时长（秒）',
        type: 'select',
        default: 5,
        options: [
          { label: '4 秒', value: 4 },
          { label: '5 秒', value: 5 },
          { label: '8 秒', value: 8 },
          { label: '10 秒', value: 10 },
          { label: '12 秒', value: 12 }
        ],
        description: '生成视频的时长'
      },
      {
        key: 'aspectRatio',
        label: '宽高比',
        type: 'select',
        default: '16:9',
        options: [
          { label: '16:9 横屏', value: '16:9' },
          { label: '9:16 竖屏', value: '9:16' },
          { label: '1:1 方形', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '3:4', value: '3:4' }
        ],
        description: '视频宽高比'
      },
      {
        key: 'resolution',
        label: '分辨率',
        type: 'select',
        default: '1080p',
        options: [
          { label: '720p', value: '720p' },
          { label: '1080p', value: '1080p' },
          { label: '4K', value: '4k' }
        ],
        description: '视频分辨率'
      },

      // === 提示词配置 ===
      {
        key: 'useUpstreamPrompt',
        label: '使用上游提示词',
        type: 'checkbox',
        default: true,
        description: '优先使用上游节点的提示词'
      },
      {
        key: 'videoPrompt',
        label: '视频提示词',
        type: 'textarea',
        placeholder: '描述视频内容、动作、镜头运动...',
        description: '详细描述期望的视频效果',
        showWhen: {
          field: 'useUpstreamPrompt',
          value: false
        }
      },
      {
        key: 'negativePrompt',
        label: '负面提示词',
        type: 'textarea',
        placeholder: 'blur, distort, low quality...',
        description: '描述不希望出现的元素'
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
        key: 'cfgScale',
        label: '引导比例',
        type: 'number',
        default: 7,
        min: 1,
        max: 20,
        step: 0.5,
        description: '提示词对生成结果的影响程度'
      },
      {
        key: 'timeout',
        label: '超时时间（秒）',
        type: 'number',
        default: 600,
        min: 60,
        max: 1800,
        description: '最大等待时间'
      }
    ]
  },

  defaultConfig: {
    mode: 'text2video',
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    useUpstreamPrompt: true,
    videoPrompt: '',
    negativePrompt: 'blur, distort, low quality, deformed',
    cfgScale: 7,
    timeout: 600
  },

  executor: new UnifiedVideoGenerationExecutor()
}

export { UnifiedVideoGenerationExecutor }
export default UnifiedVideoGenerationNode
