/**
 * 家具场景节点定义
 *
 * 家具产品室内场景合成：
 * - 支持沙发、床具、桌椅、柜子等
 * - 室内空间感营造
 * - 光影与风格匹配
 * - 专业家居摄影品质
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const FurnitureSceneNode: NodeDefinition = {
  metadata: {
    type: 'furniture_scene',
    label: '家具场景',
    icon: '🛋️',
    category: 'image',
    version: '1.0.0',
    description: '家具产品室内场景合成，支持多种风格和空间',
    tags: ['image', 'furniture', 'interior', 'scene', 'gemini', 'photography']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '家具场景摄影提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的家具场景图' }],

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
        default: '16:9',
        options: [
          { label: '1:1 正方形', value: '1:1' },
          { label: '4:3 横版', value: '4:3' },
          { label: '16:9 宽屏', value: '16:9' },
          { label: '3:4 竖版', value: '3:4' }
        ],
        description: '生成图片的宽高比'
      },

      // === 家具类型 ===
      {
        key: 'furnitureType',
        label: '家具类型',
        type: 'select',
        default: 'sofa',
        options: [
          { label: '沙发', value: 'sofa' },
          { label: '床具', value: 'bed' },
          { label: '餐桌椅', value: 'dining' },
          { label: '书桌', value: 'desk' },
          { label: '柜子', value: 'cabinet' },
          { label: '椅子', value: 'chair' },
          { label: '茶几', value: 'coffee_table' }
        ],
        description: '选择家具类型'
      },

      // === 场景风格 ===
      {
        key: 'sceneStyle',
        label: '场景风格',
        type: 'select',
        default: 'modern',
        options: [
          { label: '现代简约', value: 'modern' },
          { label: '北欧风格', value: 'scandinavian' },
          { label: '中式传统', value: 'chinese' },
          { label: '工业风', value: 'industrial' },
          { label: '日式', value: 'japanese' },
          { label: '美式乡村', value: 'farmhouse' },
          { label: '轻奢', value: 'luxury' }
        ],
        description: '室内场景风格'
      },

      // === 房间类型 ===
      {
        key: 'roomType',
        label: '房间类型',
        type: 'select',
        default: 'living_room',
        options: [
          { label: '客厅', value: 'living_room' },
          { label: '卧室', value: 'bedroom' },
          { label: '餐厅', value: 'dining_room' },
          { label: '书房', value: 'study' },
          { label: '办公室', value: 'office' }
        ],
        description: '放置家具的房间类型'
      },

      // === 光线氛围 ===
      {
        key: 'lightingMood',
        label: '光线氛围',
        type: 'select',
        default: 'natural',
        options: [
          { label: '自然光', value: 'natural' },
          { label: '温馨暖光', value: 'warm' },
          { label: '明亮通透', value: 'bright' },
          { label: '氛围灯光', value: 'ambient' },
          { label: '黄昏光线', value: 'golden_hour' }
        ],
        description: '场景光线氛围'
      },

      // === 空间大小 ===
      {
        key: 'spaceSize',
        label: '空间大小',
        type: 'select',
        default: 'medium',
        options: [
          { label: '紧凑空间', value: 'compact' },
          { label: '中等空间', value: 'medium' },
          { label: '宽敞空间', value: 'spacious' },
          { label: '开放式', value: 'open' }
        ],
        description: '室内空间大小'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的场景要求...\n例如：窗外有城市景观',
        description: '补充场景细节描述'
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
    nodeType: 'furniture_scene',
    imageSize: '2K',
    aspectRatio: '16:9',
    furnitureType: 'sofa',
    sceneStyle: 'modern',
    roomType: 'living_room',
    lightingMood: 'natural',
    spaceSize: 'medium',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 3,
    imageInputPorts: [
      { id: 'image_1', label: '家具产品', dataType: 'image', required: true, description: '家具产品图片' },
      { id: 'image_2', label: '场景参考', dataType: 'image', required: false, description: '可选的场景参考图' },
      { id: 'image_3', label: '风格参考', dataType: 'image', required: false, description: '可选的风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as FurnitureSceneExecutor }
export default FurnitureSceneNode
