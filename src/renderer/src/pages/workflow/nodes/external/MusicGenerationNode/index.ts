/**
 * Music Generation Node
 * 音乐生成节点
 *
 * 支持多种音乐生成服务：
 * - Suno (AI 音乐生成)
 * - Udio (AI 音乐生成)
 * - 自定义 API
 */

import type { NodeDefinition } from '../../base/types'
import { MusicGenerationExecutor } from './executor'

export const MusicGenerationNode: NodeDefinition = {
  metadata: {
    type: 'music_generation',
    label: '音乐生成',
    icon: '🎵',
    category: 'external',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: 'AI 音乐生成（支持 Suno、Udio 等服务）',
    tags: ['external', 'music', 'audio', 'suno', 'udio', 'ai', 'generation']
  },

  inputs: [
    {
      id: 'lyrics',
      label: '歌词',
      dataType: 'text',
      required: false,
      description: '歌曲歌词（Custom 模式必填）'
    },
    {
      id: 'style',
      label: '音乐风格',
      dataType: 'text',
      required: false,
      description: '音乐风格标签，如 "pop, electronic, upbeat"'
    },
    {
      id: 'title',
      label: '歌曲标题',
      dataType: 'text',
      required: false,
      description: '生成的歌曲标题'
    },
    {
      id: 'description',
      label: '音乐描述',
      dataType: 'text',
      required: false,
      description: '音乐创作描述（Description 模式使用）'
    },
    {
      id: 'continueFrom',
      label: '续写源 ID',
      dataType: 'text',
      required: false,
      description: '要继续生成的音频 ID（Continuation 模式使用）'
    }
  ],

  outputs: [
    {
      id: 'results',
      label: '生成结果',
      dataType: 'json',
      description: '音乐生成结果数组 [{id, title, audioUrl, ...}]'
    },
    {
      id: 'audioUrl',
      label: '音频 URL',
      dataType: 'text',
      description: '主音频文件 URL'
    },
    {
      id: 'success',
      label: '是否成功',
      dataType: 'boolean',
      description: '生成是否成功'
    },
    {
      id: 'taskId',
      label: '任务 ID',
      dataType: 'text',
      description: '生成任务 ID，可用于后续查询'
    }
  ],

  configSchema: {
    fields: [
      // ========== 基本配置 ==========
      {
        key: 'provider',
        label: '服务提供商',
        type: 'select',
        required: true,
        default: 'suno',
        options: [
          { label: 'Suno', value: 'suno' },
          { label: 'Udio', value: 'udio' },
          { label: '自定义 API', value: 'custom_api' }
        ],
        description: '选择音乐生成服务提供商'
      },
      {
        key: 'mode',
        label: '生成模式',
        type: 'select',
        required: true,
        default: 'description',
        options: [
          { label: '描述生成', value: 'description' },
          { label: '自定义歌词', value: 'custom' },
          { label: '续写扩展', value: 'continuation' }
        ],
        description: '音乐生成方式'
      },

      // ========== API 配置 ==========
      {
        key: 'apiUrl',
        label: 'API 地址',
        type: 'text',
        required: false,
        placeholder: 'https://api.suno.ai',
        description: 'API 服务地址（可选，使用默认地址）'
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: false,
        placeholder: '输入 API Key',
        description: 'API 认证密钥'
      },

      // ========== 生成选项 ==========
      {
        key: 'instrumental',
        label: '纯音乐',
        type: 'checkbox',
        default: false,
        description: '生成纯音乐（无人声）'
      },
      {
        key: 'duration',
        label: '音乐时长',
        type: 'number',
        required: false,
        default: 120,
        min: 30,
        max: 300,
        description: '音乐时长（秒），30-300 秒'
      },

      // ========== 等待配置 ==========
      {
        key: 'waitForCompletion',
        label: '等待完成',
        type: 'checkbox',
        default: true,
        description: '等待音乐生成完成后返回'
      },
      {
        key: 'pollInterval',
        label: '轮询间隔',
        type: 'number',
        required: false,
        default: 5000,
        min: 1000,
        max: 30000,
        description: '状态查询间隔（毫秒）'
      },
      {
        key: 'maxWaitTime',
        label: '最大等待时间',
        type: 'number',
        required: false,
        default: 300,
        min: 60,
        max: 600,
        description: '最大等待时间（秒）'
      }
    ]
  },

  defaultConfig: {
    provider: 'suno',
    mode: 'description',
    instrumental: false,
    duration: 120,
    waitForCompletion: true,
    pollInterval: 5000,
    maxWaitTime: 300
  },

  executor: new MusicGenerationExecutor()
}

export { MusicGenerationExecutor } from './executor'
export default MusicGenerationNode
