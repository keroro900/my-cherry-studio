/**
 * 鞋类展示节点定义
 *
 * 鞋类产品穿着效果展示：
 * - 支持各种鞋类产品
 * - 真实的穿着场景
 * - 自然的光影效果
 * - 专业的产品展示
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const FootwearDisplayNode: NodeDefinition = {
  metadata: {
    type: 'footwear_display',
    label: '鞋类展示',
    icon: '👟',
    category: 'image',
    version: '1.0.0',
    description: '鞋类产品穿着效果展示，支持多种场景',
    tags: ['image', 'footwear', 'shoes', 'display', 'product', 'gemini']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '展示效果提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的展示效果图' }],

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
          { label: '4:3 横版', value: '4:3' },
          { label: '3:4 竖版', value: '3:4' },
          { label: '16:9 宽屏', value: '16:9' }
        ],
        description: '生成图片的宽高比'
      },

      // === 鞋类类型 ===
      {
        key: 'footwearType',
        label: '鞋类类型',
        type: 'select',
        default: 'sneakers',
        options: [
          { label: '运动鞋', value: 'sneakers' },
          { label: '跑步鞋', value: 'running' },
          { label: '休闲鞋', value: 'casual' },
          { label: '皮鞋', value: 'leather' },
          { label: '高跟鞋', value: 'heels' },
          { label: '靴子', value: 'boots' },
          { label: '凉鞋', value: 'sandals' },
          { label: '拖鞋', value: 'slippers' }
        ],
        description: '选择鞋类类型'
      },

      // === 展示模式 ===
      {
        key: 'displayMode',
        label: '展示模式',
        type: 'select',
        default: 'worn',
        options: [
          { label: '穿着效果', value: 'worn' },
          { label: '模特穿鞋', value: 'model_wearing' },
          { label: '单品展示', value: 'product' },
          { label: '场景展示', value: 'lifestyle' },
          { label: '细节特写', value: 'detail' }
        ],
        description: '产品展示方式'
      },

      // === 场景设置 ===
      {
        key: 'sceneType',
        label: '场景类型',
        type: 'select',
        default: 'studio',
        options: [
          { label: '摄影棚', value: 'studio' },
          { label: '城市街道', value: 'urban' },
          { label: '户外自然', value: 'outdoor' },
          { label: '运动场地', value: 'sports' },
          { label: '办公室', value: 'office' },
          { label: '家居', value: 'home' }
        ],
        description: '展示场景类型'
      },

      // === 视角 ===
      {
        key: 'viewAngle',
        label: '拍摄视角',
        type: 'select',
        default: 'side',
        options: [
          { label: '侧面', value: 'side' },
          { label: '正面', value: 'front' },
          { label: '45度角', value: 'angle_45' },
          { label: '俯视', value: 'top' },
          { label: '低角度', value: 'low' }
        ],
        description: '产品拍摄视角'
      },

      // === 光影效果 ===
      {
        key: 'lightingStyle',
        label: '光影风格',
        type: 'select',
        default: 'soft',
        options: [
          { label: '柔和自然', value: 'soft' },
          { label: '高对比', value: 'high_contrast' },
          { label: '戏剧性', value: 'dramatic' },
          { label: '明亮清新', value: 'bright' }
        ],
        description: '光影效果风格'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的展示要求...\n例如：突出鞋底设计细节',
        description: '补充展示效果描述'
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
    nodeType: 'footwear_display',
    imageSize: '2K',
    aspectRatio: '1:1',
    footwearType: 'sneakers',
    displayMode: 'worn',
    sceneType: 'studio',
    viewAngle: 'side',
    lightingStyle: 'soft',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 3,
    imageInputPorts: [
      { id: 'image_1', label: '鞋类产品', dataType: 'image', required: true, description: '鞋类产品图片' },
      {
        id: 'image_2',
        label: '模特照片',
        dataType: 'image',
        required: false,
        description: '模特全身/脚部照片（模特穿鞋模式必需）'
      },
      { id: 'image_3', label: '场景参考', dataType: 'image', required: false, description: '可选的场景或风格参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as FootwearDisplayExecutor }
export default FootwearDisplayNode
