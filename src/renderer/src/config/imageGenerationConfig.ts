/**
 * 图像生成模型配置
 *
 * 配置驱动的 UI 系统：
 * - 根据模型类型决定哪些参数显示/隐藏
 * - 定义每个参数的选项和默认值
 * - 统一绘画界面和工作流界面的配置
 *
 * 核心原则：
 * - 所有第三方中转服务都遵循 OpenAI 格式
 * - 使用配置驱动 UI 显隐，而非底层协议转换
 * - 请求按 DALL-E 格式发送，混传其他模型特有参数
 */

// ============================================================================
// 类型定义
// ============================================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'select'
  | 'switch'
  | 'seed'
  | 'aspectRatio'
  | 'images'

export interface FieldOption {
  label: string
  value: string | number
}

export interface FieldConfig {
  key: string
  type: FieldType
  label: string
  description?: string
  defaultValue?: any
  options?: FieldOption[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  group?: 'basic' | 'advanced' | 'style' | 'output'
}

export interface ModelConfig {
  /** 模型显示名称 */
  name?: string
  /** 支持的字段列表 */
  fields: string[]
  /** 字段覆盖配置 */
  fieldOverrides?: Record<string, Partial<FieldConfig>>
  /** 默认值覆盖 */
  defaults?: Record<string, any>
}

// ============================================================================
// 通用字段定义
// ============================================================================

export const FIELD_DEFINITIONS: Record<string, FieldConfig> = {
  // ==================== 基础字段 ====================
  prompt: {
    key: 'prompt',
    type: 'textarea',
    label: '提示词',
    description: '描述你想要生成的图片',
    placeholder: '描述你想要生成的图片...',
    group: 'basic'
  },
  negative_prompt: {
    key: 'negative_prompt',
    type: 'textarea',
    label: '反向提示词',
    description: '描述不希望出现在图像中的内容',
    placeholder: '不希望出现的内容...',
    group: 'advanced'
  },
  n: {
    key: 'n',
    type: 'number',
    label: '生成数量',
    description: '每次生成的图片数量',
    defaultValue: 1,
    min: 1,
    max: 10,
    group: 'basic'
  },

  // ==================== 尺寸字段 ====================
  aspect_ratio: {
    key: 'aspect_ratio',
    type: 'aspectRatio',
    label: '宽高比',
    defaultValue: '1:1',
    options: [
      { label: '1:1', value: '1:1' },
      { label: '3:4', value: '3:4' },
      { label: '4:3', value: '4:3' },
      { label: '9:16', value: '9:16' },
      { label: '16:9', value: '16:9' },
      { label: '2:3', value: '2:3' },
      { label: '3:2', value: '3:2' }
    ],
    group: 'basic'
  },
  size: {
    key: 'size',
    type: 'select',
    label: '图片尺寸',
    defaultValue: '1024x1024',
    options: [
      { label: '512x512', value: '512x512' },
      { label: '1024x1024', value: '1024x1024' },
      { label: '1536x1024', value: '1536x1024' },
      { label: '1024x1536', value: '1024x1536' }
    ],
    group: 'basic'
  },
  image_size: {
    key: 'image_size',
    type: 'select',
    label: '图片尺寸',
    defaultValue: '2K',
    options: [
      { label: '1K (1024px)', value: '1K' },
      { label: '2K (2048px)', value: '2K' },
      { label: '4K (4096px)', value: '4K' }
    ],
    group: 'basic'
  },

  // ==================== 高级字段 ====================
  seed: {
    key: 'seed',
    type: 'seed',
    label: '随机种子',
    description: '固定种子可生成相似结果',
    placeholder: '随机',
    group: 'advanced'
  },
  steps: {
    key: 'steps',
    type: 'slider',
    label: '推理步数',
    description: '更多步数通常产生更好的结果，但需要更长时间',
    defaultValue: 28,
    min: 1,
    max: 50,
    group: 'advanced'
  },
  guidance_scale: {
    key: 'guidance_scale',
    type: 'slider',
    label: '引导比例',
    description: '控制图像与提示词的匹配程度（CFG Scale）',
    defaultValue: 3.5,
    min: 1,
    max: 20,
    step: 0.5,
    group: 'advanced'
  },
  prompt_strength: {
    key: 'prompt_strength',
    type: 'slider',
    label: '提示词强度',
    description: '图生图时的提示词强度（1.0=完全销毁原图信息）',
    defaultValue: 0.8,
    min: 0,
    max: 1,
    step: 0.1,
    group: 'advanced'
  },

  // ==================== 质量字段 ====================
  quality: {
    key: 'quality',
    type: 'select',
    label: '质量',
    defaultValue: 'standard',
    options: [
      { label: '标准', value: 'standard' },
      { label: '高清', value: 'hd' }
    ],
    group: 'basic'
  },

  // ==================== 风格字段 ====================
  style: {
    key: 'style',
    type: 'select',
    label: '风格',
    defaultValue: 'vivid',
    options: [
      { label: '生动', value: 'vivid' },
      { label: '自然', value: 'natural' }
    ],
    group: 'style'
  },
  style_preset: {
    key: 'style_preset',
    type: 'select',
    label: '风格预设',
    options: [
      { label: '无', value: '' },
      { label: '3D模型', value: '3d-model' },
      { label: '胶片', value: 'analog-film' },
      { label: '动漫', value: 'anime' },
      { label: '电影', value: 'cinematic' },
      { label: '漫画', value: 'comic-book' },
      { label: '数字艺术', value: 'digital-art' },
      { label: '增强', value: 'enhance' },
      { label: '奇幻艺术', value: 'fantasy-art' },
      { label: '等距', value: 'isometric' },
      { label: '线稿', value: 'line-art' },
      { label: '低多边形', value: 'low-poly' },
      { label: '粘土', value: 'modeling-compound' },
      { label: '霓虹朋克', value: 'neon-punk' },
      { label: '折纸', value: 'origami' },
      { label: '摄影', value: 'photographic' },
      { label: '像素艺术', value: 'pixel-art' }
    ],
    group: 'style'
  },
  style_type: {
    key: 'style_type',
    type: 'select',
    label: '风格类型',
    options: [
      { label: '自动', value: 'AUTO' },
      { label: '通用', value: 'GENERAL' },
      { label: '写实', value: 'REALISTIC' },
      { label: '设计', value: 'DESIGN' },
      { label: '3D', value: 'RENDER_3D' },
      { label: '动漫', value: 'ANIME' }
    ],
    group: 'style'
  },
  wanx_style: {
    key: 'wanx_style',
    type: 'select',
    label: '风格',
    defaultValue: '<auto>',
    options: [
      { label: '自动', value: '<auto>' },
      { label: '摄影', value: '<photography>' },
      { label: '人像', value: '<portrait>' },
      { label: '3D卡通', value: '<3d cartoon>' },
      { label: '动漫', value: '<anime>' },
      { label: '油画', value: '<oil painting>' },
      { label: '水彩', value: '<watercolor>' },
      { label: '素描', value: '<sketch>' },
      { label: '国画', value: '<chinese painting>' },
      { label: '扁平插画', value: '<flat illustration>' }
    ],
    group: 'style'
  },

  // ==================== 安全字段 ====================
  moderation: {
    key: 'moderation',
    type: 'select',
    label: '内容审核',
    defaultValue: 'auto',
    options: [
      { label: '自动', value: 'auto' },
      { label: '宽松', value: 'low' }
    ],
    group: 'advanced'
  },
  safety_tolerance: {
    key: 'safety_tolerance',
    type: 'slider',
    label: '安全容忍度',
    description: '1=最严格，6=最宽松',
    defaultValue: 2,
    min: 1,
    max: 6,
    group: 'advanced'
  },
  person_generation: {
    key: 'person_generation',
    type: 'select',
    label: '人物生成',
    defaultValue: 'allow_adult',
    options: [
      { label: '禁止', value: 'dont_allow' },
      { label: '仅成人', value: 'allow_adult' },
      { label: '允许全部', value: 'allow_all' }
    ],
    group: 'advanced'
  },

  // ==================== 输出字段 ====================
  output_format: {
    key: 'output_format',
    type: 'select',
    label: '输出格式',
    defaultValue: 'webp',
    options: [
      { label: 'WebP', value: 'webp' },
      { label: 'JPEG', value: 'jpg' },
      { label: 'PNG', value: 'png' }
    ],
    group: 'output'
  },
  output_quality: {
    key: 'output_quality',
    type: 'slider',
    label: '输出质量',
    description: '图像压缩质量（PNG不适用）',
    defaultValue: 80,
    min: 0,
    max: 100,
    group: 'output'
  },

  // ==================== 参考图片 ====================
  reference_images: {
    key: 'reference_images',
    type: 'images',
    label: '参考图片',
    description: '上传参考图片进行图生图',
    group: 'basic'
  },

  // ==================== 开关选项 ====================
  prompt_enhance: {
    key: 'prompt_enhance',
    type: 'switch',
    label: '提示词增强',
    description: '使用 AI 自动优化提示词',
    defaultValue: false,
    group: 'advanced'
  },
  go_fast: {
    key: 'go_fast',
    type: 'switch',
    label: '快速模式',
    description: '使用优化加速（启用后结果可能不确定）',
    defaultValue: true,
    group: 'advanced'
  },

  // ==================== Midjourney 特有 ====================
  stylize: {
    key: 'stylize',
    type: 'slider',
    label: '风格化',
    description: '风格化强度',
    defaultValue: 100,
    min: 0,
    max: 1000,
    group: 'style'
  },
  chaos: {
    key: 'chaos',
    type: 'slider',
    label: '混乱度',
    description: '结果的变化程度',
    defaultValue: 0,
    min: 0,
    max: 100,
    group: 'advanced'
  },
  weird: {
    key: 'weird',
    type: 'slider',
    label: '怪异度',
    description: '实验性怪异程度',
    defaultValue: 0,
    min: 0,
    max: 3000,
    group: 'advanced'
  },

  // ==================== Stability AI 特有 ====================
  sampler: {
    key: 'sampler',
    type: 'select',
    label: '采样器',
    options: [
      { label: 'K_EULER', value: 'K_EULER' },
      { label: 'K_EULER_ANCESTRAL', value: 'K_EULER_ANCESTRAL' },
      { label: 'K_DPM_2', value: 'K_DPM_2' },
      { label: 'K_DPM_2_ANCESTRAL', value: 'K_DPM_2_ANCESTRAL' },
      { label: 'K_DPMPP_2M', value: 'K_DPMPP_2M' },
      { label: 'K_DPMPP_2S_ANCESTRAL', value: 'K_DPMPP_2S_ANCESTRAL' },
      { label: 'DDIM', value: 'DDIM' },
      { label: 'DDPM', value: 'DDPM' }
    ],
    group: 'advanced'
  }
}

// ============================================================================
// 模型配置映射
// ============================================================================

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // ==================== Google Gemini / Imagen ====================
  'gemini-image': {
    name: 'Google Gemini Imagen',
    fields: ['prompt', 'aspect_ratio', 'image_size', 'n', 'person_generation', 'reference_images'],
    fieldOverrides: {
      n: { max: 4, description: '生成图像数量（最多4张）' },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' },
          { label: '9:16', value: '9:16' },
          { label: '16:9', value: '16:9' }
        ]
      },
      image_size: {
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
        ],
        description: '图片尺寸（4K需要更长生成时间）'
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      image_size: '2K',
      n: 1,
      person_generation: 'allow_adult'
    }
  },

  // ==================== Google Gemini Image Edit ====================
  'gemini-image-edit': {
    name: 'Google Gemini Image Edit',
    fields: ['prompt', 'aspect_ratio', 'image_size', 'n', 'person_generation', 'reference_images'],
    fieldOverrides: {
      n: { max: 4, description: '生成图像数量（最多4张）' },
      reference_images: {
        label: '参考图片（必需）',
        description: '上传需要编辑的图片，支持多张参考图'
      },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' },
          { label: '9:16', value: '9:16' },
          { label: '16:9', value: '16:9' }
        ]
      },
      image_size: {
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
        ],
        description: '输出图片尺寸（4K需要更长生成时间）'
      },
      prompt: {
        description: '描述你想要对图片进行的编辑操作'
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      image_size: '2K',
      n: 1,
      person_generation: 'allow_adult'
    }
  },

  // ==================== OpenAI DALL-E 3 ====================
  'openai-dalle3': {
    name: 'OpenAI DALL-E 3',
    fields: ['prompt', 'size', 'quality', 'style', 'reference_images'],
    fieldOverrides: {
      size: {
        options: [
          { label: '1024x1024', value: '1024x1024' },
          { label: '1792x1024 (横向)', value: '1792x1024' },
          { label: '1024x1792 (纵向)', value: '1024x1792' }
        ]
      },
      quality: {
        options: [
          { label: '标准', value: 'standard' },
          { label: '高清', value: 'hd' }
        ]
      }
    },
    defaults: {
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      n: 1
    }
  },

  // ==================== OpenAI DALL-E 2 ====================
  'openai-dalle2': {
    name: 'OpenAI DALL-E 2',
    fields: ['prompt', 'size', 'n', 'reference_images'],
    fieldOverrides: {
      size: {
        options: [
          { label: '256x256', value: '256x256' },
          { label: '512x512', value: '512x512' },
          { label: '1024x1024', value: '1024x1024' }
        ]
      },
      n: { max: 10 }
    },
    defaults: {
      size: '1024x1024',
      n: 1
    }
  },

  // ==================== OpenAI gpt-image-1 ====================
  'openai-gpt-image': {
    name: 'OpenAI GPT Image',
    fields: ['prompt', 'size', 'n', 'quality', 'moderation', 'reference_images'],
    fieldOverrides: {
      size: {
        options: [
          { label: '自动', value: 'auto' },
          { label: '1024x1024', value: '1024x1024' },
          { label: '1536x1024', value: '1536x1024' },
          { label: '1024x1536', value: '1024x1536' }
        ]
      },
      n: { max: 10 },
      quality: {
        options: [
          { label: '自动', value: 'auto' },
          { label: '高', value: 'high' },
          { label: '中', value: 'medium' },
          { label: '低', value: 'low' }
        ]
      }
    },
    defaults: {
      size: 'auto',
      quality: 'auto',
      moderation: 'auto',
      n: 1
    }
  },

  // ==================== Flux Pro ====================
  'flux-pro': {
    name: 'Flux Pro',
    fields: [
      'prompt',
      'aspect_ratio',
      'seed',
      'guidance_scale',
      'safety_tolerance',
      'prompt_enhance',
      'output_format',
      'output_quality',
      'reference_images'
    ],
    fieldOverrides: {
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '3:2', value: '3:2' },
          { label: '2:3', value: '2:3' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' }
        ]
      },
      guidance_scale: { min: 2, max: 5, defaultValue: 3, label: '引导强度' }
    },
    defaults: {
      aspect_ratio: '1:1',
      guidance_scale: 3,
      safety_tolerance: 2,
      prompt_enhance: false,
      output_format: 'webp',
      output_quality: 80
    }
  },

  // ==================== Flux Dev ====================
  'flux-dev': {
    name: 'Flux Dev',
    fields: [
      'prompt',
      'aspect_ratio',
      'n',
      'seed',
      'steps',
      'guidance_scale',
      'prompt_strength',
      'go_fast',
      'output_format',
      'output_quality',
      'reference_images'
    ],
    fieldOverrides: {
      n: { max: 4 },
      steps: { defaultValue: 28, min: 1, max: 50 },
      guidance_scale: { min: 0, max: 10, defaultValue: 3.5, step: 0.5 },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '21:9', value: '21:9' },
          { label: '9:21', value: '9:21' },
          { label: '3:2', value: '3:2' },
          { label: '2:3', value: '2:3' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' }
        ]
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      n: 1,
      steps: 28,
      guidance_scale: 3.5,
      prompt_strength: 0.8,
      go_fast: true,
      output_format: 'webp',
      output_quality: 80
    }
  },

  // ==================== Flux Schnell ====================
  'flux-schnell': {
    name: 'Flux Schnell',
    fields: ['prompt', 'aspect_ratio', 'n', 'seed', 'go_fast', 'output_format', 'output_quality', 'reference_images'],
    fieldOverrides: {
      n: { max: 4 },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '21:9', value: '21:9' },
          { label: '9:21', value: '9:21' },
          { label: '3:2', value: '3:2' },
          { label: '2:3', value: '2:3' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' }
        ]
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      n: 1,
      go_fast: true,
      output_format: 'webp',
      output_quality: 80
    }
  },

  // ==================== Stability AI SDXL ====================
  'stability-sdxl': {
    name: 'Stability AI SDXL',
    fields: [
      'prompt',
      'negative_prompt',
      'aspect_ratio',
      'n',
      'seed',
      'steps',
      'guidance_scale',
      'sampler',
      'style_preset'
    ],
    fieldOverrides: {
      n: { max: 10, label: '生成数量' },
      steps: { defaultValue: 40, min: 10, max: 50 },
      guidance_scale: { defaultValue: 7, min: 0, max: 35, label: 'CFG Scale' },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '21:9', value: '21:9' },
          { label: '9:21', value: '9:21' },
          { label: '2:3', value: '2:3' },
          { label: '3:2', value: '3:2' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' }
        ]
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      n: 1,
      steps: 40,
      guidance_scale: 7
    }
  },

  // ==================== Stability AI SD3 ====================
  'stability-sd3': {
    name: 'Stability AI SD3',
    fields: ['prompt', 'negative_prompt', 'aspect_ratio', 'n', 'seed', 'steps', 'guidance_scale', 'style_preset'],
    fieldOverrides: {
      n: { max: 10 },
      steps: { defaultValue: 30, min: 10, max: 50 },
      guidance_scale: { defaultValue: 7, min: 0, max: 35 }
    },
    defaults: {
      aspect_ratio: '1:1',
      n: 1,
      steps: 30,
      guidance_scale: 7
    }
  },

  // ==================== Midjourney ====================
  midjourney: {
    name: 'Midjourney',
    fields: ['prompt', 'aspect_ratio', 'seed', 'quality', 'stylize', 'chaos', 'weird', 'style'],
    fieldOverrides: {
      quality: {
        options: [
          { label: '0.25x (快速)', value: '0.25' },
          { label: '0.5x', value: '0.5' },
          { label: '1x (标准)', value: '1' },
          { label: '2x (高质量)', value: '2' }
        ],
        defaultValue: '1'
      },
      style: {
        options: [
          { label: '默认', value: '' },
          { label: 'Raw', value: 'raw' },
          { label: 'Scenic', value: 'scenic' },
          { label: 'Expressive', value: 'expressive' },
          { label: 'Cute', value: 'cute' }
        ]
      },
      aspect_ratio: {
        options: [
          { label: '1:1', value: '1:1' },
          { label: '2:3', value: '2:3' },
          { label: '3:2', value: '3:2' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' }
        ]
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      quality: '1',
      stylize: 100,
      chaos: 0,
      weird: 0
    }
  },

  // ==================== 智谱 CogView-4 ====================
  'zhipu-cogview4': {
    name: '智谱 CogView-4',
    fields: ['prompt', 'negative_prompt', 'size', 'n', 'quality', 'seed'],
    fieldOverrides: {
      n: { max: 4 },
      size: {
        options: [
          { label: '1024x1024', value: '1024x1024' },
          { label: '768x1344', value: '768x1344' },
          { label: '864x1152', value: '864x1152' },
          { label: '1344x768', value: '1344x768' },
          { label: '1152x864', value: '1152x864' }
        ]
      },
      quality: {
        options: [
          { label: '标准', value: 'standard' },
          { label: '高清', value: 'hd' }
        ]
      }
    },
    defaults: {
      size: '1024x1024',
      quality: 'standard',
      n: 1
    }
  },

  // ==================== 智谱 CogView-3 ====================
  'zhipu-cogview3': {
    name: '智谱 CogView-3',
    fields: ['prompt', 'size', 'n', 'seed'],
    fieldOverrides: {
      n: { max: 4 },
      size: {
        options: [
          { label: '1024x1024', value: '1024x1024' },
          { label: '768x1344', value: '768x1344' },
          { label: '864x1152', value: '864x1152' },
          { label: '1344x768', value: '1344x768' },
          { label: '1152x864', value: '1152x864' }
        ]
      }
    },
    defaults: {
      size: '1024x1024',
      n: 1
    }
  },

  // ==================== 通义万相 Wanx ====================
  wanx: {
    name: '通义万相',
    fields: ['prompt', 'negative_prompt', 'size', 'n', 'seed', 'wanx_style', 'reference_images'],
    fieldOverrides: {
      n: { max: 4 },
      size: {
        options: [
          { label: '1024x1024', value: '1024*1024' },
          { label: '720x1280', value: '720*1280' },
          { label: '768x1152', value: '768*1152' },
          { label: '1280x720', value: '1280*720' }
        ]
      }
    },
    defaults: {
      size: '1024*1024',
      n: 1,
      wanx_style: '<auto>'
    }
  },

  // ==================== DMXAPI / Seedream ====================
  dmxapi: {
    name: 'DMXAPI Seedream',
    fields: ['prompt', 'aspect_ratio', 'size', 'n', 'seed', 'style_type', 'reference_images'],
    fieldOverrides: {
      n: { max: 4 },
      style_type: {
        options: [
          { label: '无', value: '' },
          { label: '吉卜力', value: '吉卜力' },
          { label: '皮克斯', value: '皮克斯' },
          { label: '绒线玩偶', value: '绒线玩偶' },
          { label: '水彩画', value: '水彩画' },
          { label: '卡通插画', value: '卡通插画' },
          { label: '3D卡通', value: '3D卡通' },
          { label: '日系动漫', value: '日系动漫' },
          { label: '木雕', value: '木雕' },
          { label: '唯美古风', value: '唯美古风' },
          { label: '2.5D动画', value: '2.5D动画' },
          { label: '清新日漫', value: '清新日漫' },
          { label: '黏土', value: '黏土' },
          { label: '浮世绘', value: '浮世绘' },
          { label: '毛毡', value: '毛毡' },
          { label: '美式复古', value: '美式复古' },
          { label: '赛博朋克', value: '赛博朋克' },
          { label: '素描', value: '素描' }
        ]
      }
    },
    defaults: {
      aspect_ratio: '1:1',
      n: 1
    }
  },

  // ==================== SiliconFlow 通用 ====================
  siliconflow: {
    name: 'SiliconFlow',
    fields: [
      'prompt',
      'negative_prompt',
      'size',
      'n',
      'seed',
      'steps',
      'guidance_scale',
      'prompt_enhance',
      'reference_images'
    ],
    fieldOverrides: {
      n: { max: 4 },
      steps: { defaultValue: 20, max: 50 },
      guidance_scale: { defaultValue: 7.5, max: 15 },
      size: {
        options: [
          { label: '512x512', value: '512x512' },
          { label: '768x768', value: '768x768' },
          { label: '1024x1024', value: '1024x1024' },
          { label: '768x1024', value: '768x1024' },
          { label: '1024x768', value: '1024x768' }
        ]
      }
    },
    defaults: {
      size: '1024x1024',
      steps: 20,
      guidance_scale: 7.5,
      n: 1
    }
  },

  // ==================== 通用配置（默认）====================
  default: {
    name: '通用',
    fields: ['prompt', 'negative_prompt', 'aspect_ratio', 'n', 'seed', 'steps', 'guidance_scale', 'reference_images'],
    defaults: {
      aspect_ratio: '1:1',
      steps: 25,
      guidance_scale: 7.5,
      n: 1
    }
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 根据模型 ID 推断配置类型
 */
export function inferModelConfigType(modelId: string, providerId?: string): string {
  const lowerModelId = modelId.toLowerCase()
  const lowerProviderId = (providerId || '').toLowerCase()

  // Gemini / Imagen
  // 优先匹配 edit 类型
  if (lowerModelId.includes('gemini') && lowerModelId.includes('image') && lowerModelId.includes('edit'))
    return 'gemini-image-edit'
  if (lowerModelId.includes('gemini') && lowerModelId.includes('image')) return 'gemini-image'
  if (lowerModelId.includes('imagen') && lowerModelId.includes('edit')) return 'gemini-image-edit'
  if (lowerModelId.includes('imagen')) return 'gemini-image'

  // DALL-E 3
  if (lowerModelId.includes('dall-e-3') || lowerModelId === 'dalle-3') return 'openai-dalle3'

  // DALL-E 2
  if (lowerModelId.includes('dall-e-2') || lowerModelId === 'dalle-2') return 'openai-dalle2'

  // GPT Image
  if (lowerModelId.includes('gpt-image') || lowerModelId.includes('gpt-4-image')) return 'openai-gpt-image'

  // Flux 系列
  if (lowerModelId.includes('flux-pro') || lowerModelId.includes('flux-1.1-pro')) return 'flux-pro'
  if (lowerModelId.includes('flux-dev')) return 'flux-dev'
  if (lowerModelId.includes('flux-schnell') || lowerModelId.includes('flux-fast')) return 'flux-schnell'
  if (lowerModelId.includes('flux')) return 'flux-dev' // 默认 flux-dev

  // Stability AI
  if (lowerModelId.includes('sdxl') || lowerModelId.includes('stable-diffusion-xl')) return 'stability-sdxl'
  if (lowerModelId.includes('sd3') || lowerModelId.includes('stable-diffusion-3')) return 'stability-sd3'
  if (lowerModelId.includes('stability') || lowerModelId.includes('stable-diffusion')) return 'stability-sdxl'

  // Midjourney
  if (lowerModelId.includes('midjourney') || lowerModelId.includes('mj')) return 'midjourney'

  // 智谱 CogView
  if (lowerModelId.includes('cogview-4') || lowerModelId.includes('cogview4')) return 'zhipu-cogview4'
  if (lowerModelId.includes('cogview')) return 'zhipu-cogview3'
  if (lowerProviderId.includes('zhipu')) return 'zhipu-cogview4'

  // 通义万相
  if (lowerModelId.includes('wanx') || lowerModelId.includes('tongyi') || lowerModelId.includes('wanxiang'))
    return 'wanx'

  // DMXAPI
  if (lowerProviderId.includes('dmxapi') || lowerModelId.includes('seedream')) return 'dmxapi'

  // SiliconFlow
  if (lowerProviderId.includes('silicon') || lowerProviderId.includes('siliconflow')) return 'siliconflow'

  return 'default'
}

/**
 * 获取模型的字段配置
 */
export function getModelFieldConfigs(modelId: string, providerId?: string): FieldConfig[] {
  const configType = inferModelConfigType(modelId, providerId)
  const modelConfig = MODEL_CONFIGS[configType] || MODEL_CONFIGS['default']

  return modelConfig.fields
    .map((fieldKey) => {
      const baseField = FIELD_DEFINITIONS[fieldKey]
      if (!baseField) return null

      // 应用字段覆盖
      const override = modelConfig.fieldOverrides?.[fieldKey]
      if (override) {
        return { ...baseField, ...override }
      }

      return baseField
    })
    .filter((f): f is FieldConfig => f !== null)
}

/**
 * 获取模型的默认值
 */
export function getModelDefaults(modelId: string, providerId?: string): Record<string, any> {
  const configType = inferModelConfigType(modelId, providerId)
  const modelConfig = MODEL_CONFIGS[configType] || MODEL_CONFIGS['default']

  const defaults: Record<string, any> = {}

  // 先从字段定义获取默认值
  for (const fieldKey of modelConfig.fields) {
    const field = FIELD_DEFINITIONS[fieldKey]
    if (field?.defaultValue !== undefined) {
      defaults[fieldKey] = field.defaultValue
    }
  }

  // 再应用模型特定的默认值覆盖
  if (modelConfig.defaults) {
    Object.assign(defaults, modelConfig.defaults)
  }

  return defaults
}

/**
 * 按分组获取字段
 */
export function getFieldsByGroup(
  fields: FieldConfig[],
  group: 'basic' | 'advanced' | 'style' | 'output'
): FieldConfig[] {
  return fields.filter((f) => f.group === group)
}

/**
 * 获取模型配置的显示名称
 */
export function getModelConfigName(modelId: string, providerId?: string): string {
  const configType = inferModelConfigType(modelId, providerId)
  const modelConfig = MODEL_CONFIGS[configType]
  return modelConfig?.name || modelId
}
