/**
 * 眼镜试戴节点定义
 *
 * 虚拟眼镜/墨镜试戴效果生成：
 * - 支持眼镜、墨镜、太阳镜
 * - 准确的面部定位
 * - 自然的光影融合
 * - 真实的佩戴效果
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const EyewearTryonNode: NodeDefinition = {
  metadata: {
    type: 'eyewear_tryon',
    label: '眼镜试戴',
    icon: '👓',
    category: 'image',
    version: '1.0.0',
    description: '虚拟眼镜试戴，支持眼镜、墨镜、太阳镜等',
    tags: ['image', 'eyewear', 'glasses', 'tryon', 'virtual', 'gemini']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '试戴效果提示词' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
  ],

  outputs: [{ id: 'image', label: '图片', dataType: 'image', description: '生成的试戴效果图' }],

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
        default: '3:4',
        options: [
          { label: '3:4 竖版', value: '3:4' },
          { label: '1:1 正方形', value: '1:1' },
          { label: '4:3 横版', value: '4:3' },
          { label: '16:9 宽屏', value: '16:9' }
        ],
        description: '生成图片的宽高比'
      },

      // === 眼镜类型 ===
      {
        key: 'eyewearType',
        label: '眼镜类型',
        type: 'select',
        default: 'glasses',
        options: [
          { label: '普通眼镜', value: 'glasses' },
          { label: '墨镜', value: 'sunglasses' },
          { label: '太阳镜', value: 'aviator' },
          { label: '运动眼镜', value: 'sports' },
          { label: '复古眼镜', value: 'vintage' },
          { label: '猫眼眼镜', value: 'cat_eye' }
        ],
        description: '选择眼镜类型'
      },

      // === 镜框材质 ===
      {
        key: 'frameMaterial',
        label: '镜框材质',
        type: 'select',
        default: 'metal',
        options: [
          { label: '金属', value: 'metal' },
          { label: '塑料', value: 'plastic' },
          { label: '钛金属', value: 'titanium' },
          { label: '木质', value: 'wood' },
          { label: '无框', value: 'rimless' }
        ],
        description: '镜框材质风格'
      },

      // === 镜片效果 ===
      {
        key: 'lensEffect',
        label: '镜片效果',
        type: 'select',
        default: 'clear',
        options: [
          { label: '透明', value: 'clear' },
          { label: '渐变', value: 'gradient' },
          { label: '反光', value: 'reflective' },
          { label: '偏光', value: 'polarized' },
          { label: '变色', value: 'photochromic' }
        ],
        description: '镜片视觉效果'
      },

      // === 佩戴角度 ===
      {
        key: 'wearingAngle',
        label: '佩戴角度',
        type: 'select',
        default: 'front',
        options: [
          { label: '正面', value: 'front' },
          { label: '微侧', value: 'slight_angle' },
          { label: '3/4 侧面', value: 'three_quarter' },
          { label: '自动匹配', value: 'auto' }
        ],
        description: '眼镜佩戴角度'
      },

      // === 融合模式 ===
      {
        key: 'blendMode',
        label: '融合模式',
        type: 'select',
        default: 'natural',
        options: [
          { label: '自然', value: 'natural' },
          { label: '增强', value: 'enhanced' },
          { label: '柔和', value: 'subtle' }
        ],
        description: '眼镜与面部的融合方式'
      },

      // === 额外描述 ===
      {
        key: 'extraDescription',
        label: '额外描述',
        type: 'textarea',
        placeholder: '添加额外的效果要求...\n例如：强调镜框的质感',
        description: '补充试戴效果描述'
      },

      // === 图片输入端口 ===
      {
        key: 'imageInputPorts',
        label: '📷 图片输入',
        type: 'image-input-ports',
        min: 2,
        max: 5,
        description: '配置图片输入端口数量（至少需要人像和眼镜两张图）'
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
    nodeType: 'eyewear_tryon',
    imageSize: '2K',
    aspectRatio: '3:4',
    eyewearType: 'glasses',
    frameMaterial: 'metal',
    lensEffect: 'clear',
    wearingAngle: 'front',
    blendMode: 'natural',
    extraDescription: '',
    retryCount: 2,
    timeout: 180,
    imageInputCount: 3,
    imageInputPorts: [
      { id: 'image_1', label: '人像照片', dataType: 'image', required: true, description: '正面或侧面人像' },
      { id: 'image_2', label: '眼镜图片', dataType: 'image', required: true, description: '眼镜产品图' },
      { id: 'image_3', label: '效果参考', dataType: 'image', required: false, description: '可选的效果参考图' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as EyewearTryonExecutor }
export default EyewearTryonNode
