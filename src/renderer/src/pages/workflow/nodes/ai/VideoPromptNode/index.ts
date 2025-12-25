/**
 * 视频提示词节点
 *
 * 根据输入图片生成视频提示词，核心约束：
 * - 禁止转身（AI视频转身容易崩）
 * - 支持 5秒/10秒 视频
 */

import type { NodeDefinition } from '../../base/types'
import { VideoPromptExecutor } from './executor'
import { DURATION_PRESETS, MOTION_TYPE_PRESETS } from './prompts'

export const VideoPromptNode: NodeDefinition = {
  metadata: {
    type: 'video_prompt',
    label: '视频提示词',
    icon: '🎬',
    category: 'ai',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '根据输入图片生成AI视频提示词，自动约束禁止转身等危险动作',
    tags: ['ai', 'prompt', 'video', 'motion']
  },

  inputs: [
    {
      id: 'image',
      label: '输入图片',
      dataType: 'image',
      required: true,
      description: '模特图或产品图'
    },
    {
      id: 'image_2',
      label: '参考图片 (可选)',
      dataType: 'image',
      required: false,
      description: '可选的参考图片'
    }
  ],

  outputs: [
    {
      id: 'promptJson',
      label: '提示词 JSON',
      dataType: 'json',
      description: '结构化的视频提示词数据'
    },
    {
      id: 'videoPrompt',
      label: '视频提示词',
      dataType: 'text',
      description: '完整的视频生成提示词'
    },
    {
      id: 'motionSequence',
      label: '动作序列',
      dataType: 'json',
      description: '动作序列数组'
    },
    {
      id: 'safetyNotes',
      label: '安全提示',
      dataType: 'text',
      description: '安全检查提示'
    }
  ],

  configSchema: {
    fields: [
      // ========== 模型选择 ==========
      {
        key: 'providerId',
        label: '模型服务',
        type: 'model-selector',
        required: false,
        description: '选择具体的模型服务，留空则自动选择'
      },

      // ========== 视频配置 ==========
      {
        key: 'duration',
        label: '视频时长',
        type: 'select',
        required: true,
        default: '5s',
        options: DURATION_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择视频时长'
      },
      {
        key: 'motionType',
        label: '动作风格',
        type: 'select',
        required: true,
        default: 'gentle',
        options: MOTION_TYPE_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        description: '选择动作风格'
      },

      // ========== 约束配置 ==========
      {
        key: 'noTurning',
        label: '禁止转身',
        type: 'checkbox',
        required: false,
        default: true,
        description: '禁止模特转身、转体、旋转（强烈建议开启）'
      },
      {
        key: 'noFastMotion',
        label: '禁止快速动作',
        type: 'checkbox',
        required: false,
        default: true,
        description: '禁止跳跃、奔跑等快速动作'
      },

      // ========== 高级配置 ==========
      {
        key: 'constraintPrompt',
        label: '额外约束',
        type: 'textarea',
        required: false,
        placeholder: '自定义约束条件，例如：保持微笑、头发要飘动等',
        description: '自定义约束条件'
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
    duration: '5s',
    motionType: 'gentle',
    noTurning: true,
    noFastMotion: true,
    temperature: 0.7
  },

  executor: new VideoPromptExecutor()
}

export { VideoPromptExecutor } from './executor'
export type { VideoPromptNodeConfig } from './types'
export default VideoPromptNode
