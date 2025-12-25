/**
 * RunningHub 换装节点定义 v2.0
 *
 * 深度优化版本，基于 RunningHub API 文档：
 * - 工作流应用选择
 * - 多输入端口支持
 * - 动态参数绑定
 * - 多输出结果
 *
 * API 参考: https://www.runninghub.cn/runninghub-api-doc-cn
 */

import type { NodeDefinition } from '../../base/types'
import { RunningHubExecutor } from './executor'

export const RunningHubNode: NodeDefinition = {
  metadata: {
    type: 'runninghub_app',
    label: 'RunningHub 换装',
    icon: '👗',
    category: 'external',
    version: '2.0.0',
    description: 'RunningHub ComfyUI 云端工作流，支持虚拟换装、图像处理等应用',
    tags: ['image', 'runninghub', 'virtual-tryon', 'external', 'comfyui']
  },

  inputs: [
    {
      id: 'modelImage',
      label: '模特图片',
      dataType: 'image',
      required: true,
      description: '模特人物图片'
    },
    {
      id: 'clothesImage',
      label: '服装图片',
      dataType: 'image',
      description: '要换上的服装图片'
    },
    {
      id: 'maskImage',
      label: '遮罩图片',
      dataType: 'image',
      description: '可选的遮罩区域'
    },
    {
      id: 'promptJson',
      label: '提示词JSON',
      dataType: 'json',
      description: '从视觉提示词节点传入的 JSON'
    },
    {
      id: 'customPrompt',
      label: '自定义提示词',
      dataType: 'text',
      description: '额外的生成提示词'
    }
  ],

  outputs: [
    {
      id: 'images',
      label: '输出图片',
      dataType: 'images',
      description: '生成的所有图片'
    },
    {
      id: 'image',
      label: '主图片',
      dataType: 'image',
      description: '第一张生成图片'
    },
    {
      id: 'metadata',
      label: '元数据',
      dataType: 'json',
      description: '任务信息和返回数据'
    }
  ],

  configSchema: {
    fields: [
      // === 应用配置 ===
      {
        key: 'webappId',
        label: '应用 ID',
        type: 'text',
        placeholder: '输入 RunningHub 应用 ID',
        description: 'RunningHub 工作流应用的唯一标识（从 RunningHub 控制台获取）'
      },
      {
        key: 'workflowName',
        label: '工作流名称',
        type: 'text',
        placeholder: '工作流名称（用于显示）',
        description: '可选，用于在界面上显示工作流名称'
      },

      // === 参数绑定 ===
      {
        key: 'autoBinding',
        label: '自动绑定',
        type: 'checkbox',
        default: true,
        description: '自动将输入端口绑定到工作流参数'
      },
      {
        key: 'inputBindings',
        label: '输入绑定配置',
        type: 'textarea',
        placeholder: '{\n  "modelImage": "LoadImage_1",\n  "clothesImage": "LoadImage_2"\n}',
        description: 'JSON 格式的输入端口到工作流节点的映射（高级用户）'
      },

      // === 工作流模式 ===
      {
        key: 'workflowMode',
        label: '工作流模式',
        type: 'select',
        default: 'tryon',
        description: '预设的工作流类型',
        options: [
          { label: '虚拟换装 (Virtual Try-on)', value: 'tryon' },
          { label: '图像生成 (Image Generation)', value: 'generation' },
          { label: '图像编辑 (Image Editing)', value: 'editing' },
          { label: '自定义 (Custom)', value: 'custom' }
        ]
      },

      // === 高级选项 ===
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 300,
        min: 60,
        max: 900,
        description: '最大等待时间（秒）'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '失败时的重试次数'
      },
      {
        key: 'pollingInterval',
        label: '轮询间隔',
        type: 'number',
        default: 3,
        min: 1,
        max: 10,
        description: '检查任务状态的间隔（秒）'
      }
    ]
  },

  defaultConfig: {
    webappId: '',
    workflowName: '',
    autoBinding: true,
    inputBindings: '',
    workflowMode: 'tryon',
    timeout: 300,
    retryCount: 2,
    pollingInterval: 3
  },

  executor: new RunningHubExecutor()
}

export { RunningHubExecutor }
export default RunningHubNode
