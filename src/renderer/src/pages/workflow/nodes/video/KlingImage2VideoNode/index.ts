/**
 * Kling 图生视频节点定义 v2.0
 *
 * 深度优化版本，基于 Kling AI 官方 API 文档：
 * - 多模型版本支持 (v1, v1.5, v1.6, v2, v2.1)
 * - 完整参数配置 (cfg_scale, duration, negative_prompt)
 * - 尾帧图片支持 (tail_image)
 * - 专业级视频生成
 *
 * API 参考: https://app.klingai.com/cn/dev/document-api/apiReference/model/imageToVideo
 */

import type { NodeDefinition } from '../../base/types'
import { KlingImage2VideoExecutor } from './executor'

export const KlingImage2VideoNode: NodeDefinition = {
  metadata: {
    type: 'kling_image2video',
    label: 'Kling 图生视频',
    icon: '🎬',
    category: 'video',
    version: '2.0.0',
    description: '使用 Kling AI 将图片转换为视频，支持多模型版本和专业参数控制',
    tags: ['video', 'kling', 'ai', 'image2video', 'animation']
  },

  inputs: [
    {
      id: 'image',
      label: '输入图片',
      dataType: 'image',
      required: true,
      description: '要转换为视频的图片（作为首帧）'
    },
    {
      id: 'tailImage',
      label: '尾帧图片',
      dataType: 'image',
      required: false,
      description: '视频结束时的目标图片（可选，用于控制动画终点）'
    },
    {
      id: 'videoPrompt',
      label: '视频提示词',
      dataType: 'text',
      description: '描述视频中的动作和运动'
    },
    {
      id: 'promptJson',
      label: '提示词JSON',
      dataType: 'json',
      description: '从视觉提示词节点传入的 JSON（包含 video_prompt 字段）'
    }
  ],

  outputs: [
    {
      id: 'video',
      label: '生成视频',
      dataType: 'video',
      description: '生成的视频文件 URL'
    },
    {
      id: 'metadata',
      label: '元数据',
      dataType: 'json',
      description: '视频生成参数和任务信息'
    }
  ],

  configSchema: {
    fields: [
      // 注意：模型版本、质量模式、视频时长等从外部服务设置获取
      // 在执行器中读取 externalServices.kling 配置

      // === 提示词配置 ===
      {
        key: 'useUpstreamPrompt',
        label: '使用上游提示词',
        type: 'checkbox',
        default: true,
        description: '优先使用上游节点的 video_prompt 字段'
      },
      {
        key: 'videoPrompt',
        label: '视频提示词',
        type: 'textarea',
        placeholder:
          '描述视频中的动作、镜头运动、表情变化等...\n例如: The girl smiles gently and waves her hand, camera slowly zooms in',
        description: '详细描述期望的动画效果'
      },
      {
        key: 'negativePrompt',
        label: '负面提示词',
        type: 'textarea',
        placeholder: 'blur, distort, low quality, deformed...',
        description: '描述不希望出现的元素'
      },

      // === 尾帧控制 ===
      {
        key: 'useTailImage',
        label: '使用尾帧图片',
        type: 'checkbox',
        default: false,
        description: '使用尾帧图片控制视频结束画面'
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
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 300,
        min: 60,
        max: 600,
        description: '最大等待时间（秒）'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成失败时的重试次数'
      }
    ]
  },

  defaultConfig: {
    // 模型版本、质量模式、视频时长从外部服务设置获取
    useUpstreamPrompt: true,
    videoPrompt: '',
    negativePrompt: 'blur, distort, low quality, deformed, ugly',
    useTailImage: false
  },

  executor: new KlingImage2VideoExecutor()
}

export { KlingImage2VideoExecutor }
export default KlingImage2VideoNode
