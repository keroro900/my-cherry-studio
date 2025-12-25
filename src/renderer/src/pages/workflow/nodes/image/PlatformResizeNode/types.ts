/**
 * 平台尺寸适配节点类型定义
 * Platform Resize Node Types
 *
 * 将产品图片一键适配到各电商平台的规格尺寸
 */

/**
 * 支持的平台类型
 */
export type PlatformId =
  | 'amazon_main'
  | 'amazon_secondary'
  | 'shopify_square'
  | 'shopify_portrait'
  | 'taobao_main'
  | 'taobao_detail'
  | 'shein'
  | 'temu'
  | 'instagram_square'
  | 'instagram_portrait'
  | 'instagram_landscape'
  | 'facebook'
  | 'pinterest'
  | 'custom'

/**
 * 平台尺寸规格
 */
export interface PlatformSpec {
  id: PlatformId
  name: string
  description: string
  width: number
  height: number
  aspectRatio: string
  category: 'ecommerce' | 'social'
}

/**
 * 预定义的平台尺寸规格
 */
export const PLATFORM_SPECS: Record<PlatformId, PlatformSpec> = {
  // 电商平台
  amazon_main: {
    id: 'amazon_main',
    name: 'Amazon 主图',
    description: '1:1 正方形，1600x1600px 或更高',
    width: 2000,
    height: 2000,
    aspectRatio: '1:1',
    category: 'ecommerce'
  },
  amazon_secondary: {
    id: 'amazon_secondary',
    name: 'Amazon 副图',
    description: '多角度展示，1600x1600px',
    width: 1600,
    height: 1600,
    aspectRatio: '1:1',
    category: 'ecommerce'
  },
  shopify_square: {
    id: 'shopify_square',
    name: 'Shopify 正方形',
    description: '1:1 正方形，2048x2048px',
    width: 2048,
    height: 2048,
    aspectRatio: '1:1',
    category: 'ecommerce'
  },
  shopify_portrait: {
    id: 'shopify_portrait',
    name: 'Shopify 竖版',
    description: '2:3 竖版，1365x2048px',
    width: 1365,
    height: 2048,
    aspectRatio: '2:3',
    category: 'ecommerce'
  },
  taobao_main: {
    id: 'taobao_main',
    name: '淘宝主图',
    description: '1:1 正方形，800x800px',
    width: 800,
    height: 800,
    aspectRatio: '1:1',
    category: 'ecommerce'
  },
  taobao_detail: {
    id: 'taobao_detail',
    name: '淘宝详情图',
    description: '宽度790px，高度不限',
    width: 790,
    height: 1200,
    aspectRatio: 'auto',
    category: 'ecommerce'
  },
  shein: {
    id: 'shein',
    name: 'SHEIN',
    description: '3:4 竖版，900x1200px',
    width: 900,
    height: 1200,
    aspectRatio: '3:4',
    category: 'ecommerce'
  },
  temu: {
    id: 'temu',
    name: 'TEMU',
    description: '1:1 正方形，1500x1500px',
    width: 1500,
    height: 1500,
    aspectRatio: '1:1',
    category: 'ecommerce'
  },

  // 社交媒体
  instagram_square: {
    id: 'instagram_square',
    name: 'Instagram 正方形',
    description: '1:1 正方形，1080x1080px',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    category: 'social'
  },
  instagram_portrait: {
    id: 'instagram_portrait',
    name: 'Instagram 竖版',
    description: '4:5 竖版，1080x1350px',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    category: 'social'
  },
  instagram_landscape: {
    id: 'instagram_landscape',
    name: 'Instagram 横版',
    description: '1.91:1 横版，1080x566px',
    width: 1080,
    height: 566,
    aspectRatio: '1.91:1',
    category: 'social'
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    description: '1:1 或 4:5，1200x1200px',
    width: 1200,
    height: 1200,
    aspectRatio: '1:1',
    category: 'social'
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    description: '2:3 竖版，1000x1500px',
    width: 1000,
    height: 1500,
    aspectRatio: '2:3',
    category: 'social'
  },
  custom: {
    id: 'custom',
    name: '自定义尺寸',
    description: '手动指定宽高',
    width: 1000,
    height: 1000,
    aspectRatio: 'custom',
    category: 'ecommerce'
  }
}

/**
 * 缩放模式
 */
export type ScaleMode = 'fit' | 'fill' | 'stretch' | 'contain'

/**
 * 背景填充方式
 */
export type BackgroundFill = 'white' | 'black' | 'transparent' | 'blur' | 'color'

/**
 * 平台尺寸适配配置
 */
export interface PlatformResizeConfig {
  /** 目标平台 */
  targetPlatform: PlatformId
  /** 缩放模式 */
  scaleMode: ScaleMode
  /** 背景填充方式 */
  backgroundFill: BackgroundFill
  /** 自定义背景颜色（当 backgroundFill 为 color 时） */
  backgroundColor?: string
  /** 自定义宽度（当 targetPlatform 为 custom 时） */
  customWidth?: number
  /** 自定义高度（当 targetPlatform 为 custom 时） */
  customHeight?: number
  /** 输出质量（1-100） */
  quality: number
  /** 输出格式 */
  outputFormat: 'jpg' | 'png' | 'webp'
  /** 保持原始比例 */
  maintainAspectRatio: boolean
  /** 批量模式：生成多个平台尺寸 */
  batchMode: boolean
  /** 批量模式下的目标平台列表 */
  batchPlatforms?: PlatformId[]
}

/**
 * 输出结果
 */
export interface PlatformResizeOutput {
  /** 处理后的图片 */
  image: string
  /** 输出宽度 */
  width: number
  /** 输出高度 */
  height: number
  /** 平台 ID */
  platform: PlatformId
  /** 平台名称 */
  platformName: string
}
