export const ASPECT_RATIOS = [
  {
    label: 'paintings.aspect_ratios.square',
    options: [
      {
        label: '1:1',
        value: 'ASPECT_1_1'
      }
    ]
  },
  {
    label: 'paintings.aspect_ratios.landscape',
    options: [
      {
        label: '1:2',
        value: 'ASPECT_1_2'
      },
      {
        label: '1:3',
        value: 'ASPECT_1_3'
      },
      {
        label: '2:3',
        value: 'ASPECT_2_3'
      },
      {
        label: '3:4',
        value: 'ASPECT_3_4'
      },
      {
        label: '4:5',
        value: 'ASPECT_4_5'
      },
      {
        label: '9:16',
        value: 'ASPECT_9_16'
      },
      {
        label: '10:16',
        value: 'ASPECT_10_16'
      }
    ]
  },
  {
    label: 'paintings.aspect_ratios.landscape',
    options: [
      {
        label: '2:1',
        value: 'ASPECT_2_1'
      },
      {
        label: '3:1',
        value: 'ASPECT_3_1'
      },
      {
        label: '3:2',
        value: 'ASPECT_3_2'
      },
      {
        label: '4:3',
        value: 'ASPECT_4_3'
      },
      {
        label: '5:4',
        value: 'ASPECT_5_4'
      },
      {
        label: '16:9',
        value: 'ASPECT_16_9'
      },
      {
        label: '16:10',
        value: 'ASPECT_16_10'
      }
    ]
  }
]

export const STYLE_TYPES = [
  {
    label: 'paintings.style_types.auto',
    value: 'AUTO'
  },
  {
    label: 'paintings.style_types.general',
    value: 'GENERAL'
  },
  {
    label: 'paintings.style_types.realistic',
    value: 'REALISTIC'
  },
  {
    label: 'paintings.style_types.design',
    value: 'DESIGN'
  },
  {
    label: 'paintings.style_types.3d',
    value: 'RENDER_3D',
    onlyV2: true // 仅V2模型支持
  },
  {
    label: 'paintings.style_types.anime',
    value: 'ANIME',
    onlyV2: true // 仅V2模型支持
  }
]

// V3模型支持的样式类型
export const V3_STYLE_TYPES = STYLE_TYPES.filter((style) => !style.onlyV2)

// 新增V3渲染速度选项
export const RENDERING_SPEED_OPTIONS = [
  {
    label: 'paintings.rendering_speeds.default',
    value: 'DEFAULT'
  },
  {
    label: 'paintings.rendering_speeds.turbo',
    value: 'TURBO'
  },
  {
    label: 'paintings.rendering_speeds.quality',
    value: 'QUALITY'
  }
]

export const QUALITY_OPTIONS = [
  { label: 'paintings.quality_options.auto', value: 'auto' },
  { label: 'paintings.quality_options.low', value: 'low' },
  { label: 'paintings.quality_options.medium', value: 'medium' },
  { label: 'paintings.quality_options.high', value: 'high' }
]

export const MODERATION_OPTIONS = [
  { label: 'paintings.moderation_options.auto', value: 'auto' },
  { label: 'paintings.moderation_options.low', value: 'low' }
]

export const BACKGROUND_OPTIONS = [
  { label: 'paintings.background_options.auto', value: 'auto' },
  { label: 'paintings.background_options.transparent', value: 'transparent' },
  { label: 'paintings.background_options.opaque', value: 'opaque' }
]

export const PERSON_GENERATION_OPTIONS = [
  { label: 'paintings.person_generation_options.allow_all', value: 'ALLOW_ALL' },
  { label: 'paintings.person_generation_options.allow_adult', value: 'ALLOW_ADULT' },
  { label: 'paintings.person_generation_options.allow_none', value: 'DONT_ALLOW' }
]

// ==================== 统一配置（工作流和绘画共用）====================

/**
 * 统一的图片尺寸选项 (1K/2K/4K 格式)
 * 用于 Gemini 图片生成和编辑
 */
export const IMAGE_SIZE_OPTIONS = [
  { label: '1K (1024px)', value: '1K' },
  { label: '2K (2048px)', value: '2K' },
  { label: '4K (4096px)', value: '4K' }
]

/**
 * 简化的宽高比选项
 * 用于工作流节点和绘画页面
 */
export const SIMPLE_ASPECT_RATIOS = [
  { label: '3:4 (电商标准)', value: '3:4' },
  { label: '1:1 (正方形)', value: '1:1' },
  { label: '4:3 (横向)', value: '4:3' },
  { label: '9:16 (竖屏)', value: '9:16' },
  { label: '16:9 (横屏)', value: '16:9' }
]

/**
 * 将简化宽高比转换为 API 格式
 */
export function aspectRatioToApiFormat(ratio: string): string {
  const mapping: Record<string, string> = {
    '1:1': 'ASPECT_1_1',
    '3:4': 'ASPECT_3_4',
    '4:3': 'ASPECT_4_3',
    '9:16': 'ASPECT_9_16',
    '16:9': 'ASPECT_16_9',
    '2:3': 'ASPECT_2_3',
    '3:2': 'ASPECT_3_2'
  }
  return mapping[ratio] || ratio
}

/**
 * 将 1K/2K/4K 尺寸转换为像素值
 */
export function imageSizeToPixels(size: string): number {
  switch (size) {
    case '1K':
      return 1024
    case '2K':
      return 2048
    case '4K':
      return 4096
    default:
      return 2048
  }
}
