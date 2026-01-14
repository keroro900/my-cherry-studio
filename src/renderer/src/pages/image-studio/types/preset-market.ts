/**
 * 预设市场类型定义
 * Preset Market Type Definitions
 *
 * 用于 Image Studio 模块的配置预设管理
 */

import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from './index'

// ============================================================================
// 预设分类
// ============================================================================

/**
 * 预设分类 - 按应用场景划分
 */
export type PresetCategory =
  // 服装类
  | 'kids_clothing' // 童装
  | 'adult_clothing' // 成人服装
  | 'sportswear' // 运动服装
  | 'underwear' // 内衣
  // 配饰类
  | 'accessories' // 配饰（包包、首饰等）
  | 'footwear' // 鞋履
  | 'eyewear' // 眼镜
  // 其他商品
  | 'cosmetics' // 美妆
  | 'food' // 食品
  | 'electronics' // 电子产品
  | 'furniture' // 家具
  | 'jewelry' // 珠宝
  // 图案类
  | 'pattern_floral' // 花卉图案
  | 'pattern_geometric' // 几何图案
  | 'pattern_abstract' // 抽象图案
  | 'pattern_cartoon' // 卡通图案
  | 'pattern_seasonal' // 季节性图案
  // 通用
  | 'custom' // 自定义

/**
 * 分类元数据
 */
export interface PresetCategoryMeta {
  id: PresetCategory
  label: string
  labelEn: string
  icon: string
  description?: string
  parentCategory?: PresetCategory
}

/**
 * 预设分类映射表
 */
export const PRESET_CATEGORIES: Record<PresetCategory, PresetCategoryMeta> = {
  kids_clothing: {
    id: 'kids_clothing',
    label: '童装',
    labelEn: 'Kids Clothing',
    icon: '👶',
    description: '儿童服装电商图和模特图'
  },
  adult_clothing: {
    id: 'adult_clothing',
    label: '成人服装',
    labelEn: 'Adult Clothing',
    icon: '👔',
    description: '成人服装电商图和模特图'
  },
  sportswear: {
    id: 'sportswear',
    label: '运动服装',
    labelEn: 'Sportswear',
    icon: '🏃',
    description: '运动服饰类'
  },
  underwear: {
    id: 'underwear',
    label: '内衣',
    labelEn: 'Underwear',
    icon: '👙',
    description: '内衣/泳装类'
  },
  accessories: {
    id: 'accessories',
    label: '配饰',
    labelEn: 'Accessories',
    icon: '👜',
    description: '包包、皮带、帽子等配饰'
  },
  footwear: {
    id: 'footwear',
    label: '鞋履',
    labelEn: 'Footwear',
    icon: '👟',
    description: '鞋子、靴子等'
  },
  eyewear: {
    id: 'eyewear',
    label: '眼镜',
    labelEn: 'Eyewear',
    icon: '👓',
    description: '眼镜、太阳镜等'
  },
  cosmetics: {
    id: 'cosmetics',
    label: '美妆',
    labelEn: 'Cosmetics',
    icon: '💄',
    description: '化妆品、护肤品等'
  },
  food: {
    id: 'food',
    label: '食品',
    labelEn: 'Food',
    icon: '🍔',
    description: '食品饮料摄影'
  },
  electronics: {
    id: 'electronics',
    label: '电子产品',
    labelEn: 'Electronics',
    icon: '📱',
    description: '电子产品、数码配件'
  },
  furniture: {
    id: 'furniture',
    label: '家具',
    labelEn: 'Furniture',
    icon: '🪑',
    description: '家具、家居用品'
  },
  jewelry: {
    id: 'jewelry',
    label: '珠宝',
    labelEn: 'Jewelry',
    icon: '💎',
    description: '珠宝首饰摄影'
  },
  pattern_floral: {
    id: 'pattern_floral',
    label: '花卉图案',
    labelEn: 'Floral Pattern',
    icon: '🌸',
    description: '花卉、植物类图案'
  },
  pattern_geometric: {
    id: 'pattern_geometric',
    label: '几何图案',
    labelEn: 'Geometric Pattern',
    icon: '🔷',
    description: '几何、条纹类图案'
  },
  pattern_abstract: {
    id: 'pattern_abstract',
    label: '抽象图案',
    labelEn: 'Abstract Pattern',
    icon: '🎨',
    description: '抽象艺术类图案'
  },
  pattern_cartoon: {
    id: 'pattern_cartoon',
    label: '卡通图案',
    labelEn: 'Cartoon Pattern',
    icon: '🐻',
    description: '卡通、可爱风图案'
  },
  pattern_seasonal: {
    id: 'pattern_seasonal',
    label: '季节图案',
    labelEn: 'Seasonal Pattern',
    icon: '🎄',
    description: '节日、季节性图案'
  },
  custom: {
    id: 'custom',
    label: '自定义',
    labelEn: 'Custom',
    icon: '⚙️',
    description: '用户自定义预设'
  }
}

// ============================================================================
// 预设定义
// ============================================================================

/**
 * 预设来源
 */
export type PresetSource = 'builtin' | 'user' | 'community'

/**
 * 模块配置联合类型
 */
export type ModuleConfig = EcomModuleConfig | ModelModuleConfig | PatternModuleConfig

/**
 * 图片工坊预设
 */
export interface StudioPreset {
  /** 唯一标识 */
  id: string

  /** 预设名称 */
  name: string

  /** 预设名称（英文） */
  nameEn?: string

  /** 描述 */
  description: string

  /** 描述（英文） */
  descriptionEn?: string

  /** 所属模块 */
  module: StudioModule

  /** 分类 */
  category: PresetCategory

  /** 搜索标签 */
  tags: string[]

  /** 预览图 URL（可选） */
  thumbnail?: string

  /** 模块配置 */
  config: ModuleConfig

  /**
   * 系统提示词 - 角色定位
   * 定义 AI 的角色、专业背景和行为规范
   * 例如："你是一位专业的电商产品摄影师，擅长..."
   */
  systemPrompt?: string

  /**
   * 用户提示词 - 实际需求
   * 描述具体的图片生成要求和细节
   * 例如："纯白背景，柔和光线，产品居中展示..."
   */
  userPrompt?: string

  /**
   * @deprecated 使用 systemPrompt 和 userPrompt 代替
   * 保留用于向后兼容
   */
  promptTemplate?: string

  // ============== 元数据 ==============

  /** 来源 */
  source: PresetSource

  /** 使用次数统计 */
  usageCount: number

  /** 是否收藏 */
  isFavorite: boolean

  /** 创建时间 */
  createdAt: number

  /** 更新时间 */
  updatedAt: number

  /** 版本号 */
  version?: string

  /** 作者（用户预设） */
  author?: string
}

/**
 * 预设创建参数
 */
export interface CreatePresetParams {
  name: string
  description: string
  module: StudioModule
  category: PresetCategory
  tags?: string[]
  config: ModuleConfig
  /** 系统提示词 - 角色定位 */
  systemPrompt?: string
  /** 用户提示词 - 实际需求 */
  userPrompt?: string
  /** @deprecated 使用 systemPrompt 和 userPrompt 代替 */
  promptTemplate?: string
  thumbnail?: string
}

/**
 * 预设更新参数
 */
export interface UpdatePresetParams {
  id: string
  name?: string
  description?: string
  category?: PresetCategory
  tags?: string[]
  config?: ModuleConfig
  /** 系统提示词 - 角色定位 */
  systemPrompt?: string
  /** 用户提示词 - 实际需求 */
  userPrompt?: string
  /** @deprecated 使用 systemPrompt 和 userPrompt 代替 */
  promptTemplate?: string
  thumbnail?: string
  isFavorite?: boolean
}

// ============================================================================
// 预设筛选与搜索
// ============================================================================

/**
 * 预设筛选条件
 */
export interface PresetFilter {
  /** 模块筛选 */
  module?: StudioModule | 'all'

  /** 分类筛选 */
  category?: PresetCategory | 'all'

  /** 来源筛选 */
  source?: PresetSource | 'all'

  /** 仅显示收藏 */
  favoritesOnly?: boolean

  /** 搜索关键词 */
  keyword?: string

  /** 标签筛选 */
  tags?: string[]
}

/**
 * 预设排序方式
 */
export type PresetSortBy = 'name' | 'usageCount' | 'createdAt' | 'updatedAt'

/**
 * 预设排序选项
 */
export interface PresetSortOptions {
  sortBy: PresetSortBy
  ascending: boolean
}

/**
 * 预设列表查询参数
 */
export interface PresetQueryParams extends PresetFilter, PresetSortOptions {
  /** 分页 - 页码 */
  page?: number

  /** 分页 - 每页数量 */
  pageSize?: number
}

/**
 * 预设列表查询结果
 */
export interface PresetQueryResult {
  /** 预设列表 */
  presets: StudioPreset[]

  /** 总数 */
  total: number

  /** 当前页码 */
  page: number

  /** 每页数量 */
  pageSize: number

  /** 是否有更多 */
  hasMore: boolean
}

// ============================================================================
// 预设市场状态
// ============================================================================

/**
 * 预设市场状态
 */
export interface PresetMarketState {
  /** 内置预设列表（缓存） */
  builtinPresets: StudioPreset[]

  /** 用户预设列表 */
  userPresets: StudioPreset[]

  /** 当前筛选条件 */
  filter: PresetFilter

  /** 排序选项 */
  sort: PresetSortOptions

  /** 加载状态 */
  isLoading: boolean

  /** 错误信息 */
  error?: string

  /** 弹窗是否打开 */
  isModalOpen: boolean

  /** 当前选中的预设 */
  selectedPresetId?: string
}

/**
 * 预设市场默认状态
 */
export const DEFAULT_PRESET_MARKET_STATE: PresetMarketState = {
  builtinPresets: [],
  userPresets: [],
  filter: {
    module: 'all',
    category: 'all',
    source: 'all',
    favoritesOnly: false
  },
  sort: {
    sortBy: 'usageCount',
    ascending: false
  },
  isLoading: false,
  isModalOpen: false
}

// ============================================================================
// 预设导入导出
// ============================================================================

/**
 * 预设导出格式
 */
export interface PresetExportData {
  /** 格式版本 */
  version: string

  /** 导出时间 */
  exportedAt: number

  /** 预设列表 */
  presets: Omit<StudioPreset, 'usageCount' | 'isFavorite'>[]
}

/**
 * 预设导入结果
 */
export interface PresetImportResult {
  /** 成功数量 */
  successCount: number

  /** 失败数量 */
  failedCount: number

  /** 跳过数量（重复） */
  skippedCount: number

  /** 导入的预设 ID */
  importedIds: string[]

  /** 错误信息 */
  errors: Array<{ presetName: string; error: string }>
}
