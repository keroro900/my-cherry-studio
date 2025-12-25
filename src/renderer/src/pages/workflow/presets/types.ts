/**
 * 预设注册表类型定义
 * Preset Registry Type Definitions
 *
 * 提供"单一事实来源"（Single Source of Truth）的预设系统，
 * 消除 UI 选项与提示词模板的重复定义。
 *
 * @module presets/types
 */

/**
 * 预设定义接口
 * PresetDefinition Interface
 *
 * 每个预设包含 UI 显示信息和提示词模板片段
 */
export interface PresetDefinition {
  /** 唯一标识符 */
  id: string
  /** UI 显示名称 */
  label: string
  /** 悬停提示/描述 */
  description?: string
  /** 系统提示词片段 */
  systemPromptBlock?: string
  /** 用户提示词片段 */
  userPromptBlock?: string
}

/**
 * 预设类别接口
 * PresetCategory Interface
 *
 * 泛型 T 约束预设 ID 类型，确保类型安全
 *
 * @template T 预设 ID 类型
 */
export interface PresetCategory<T extends string = string> {
  /** 类别 ID */
  categoryId: string
  /** 类别显示名称 */
  categoryLabel: string
  /** 预设映射表 */
  presets: Record<T, PresetDefinition>
  /**
   * 获取下拉选项列表
   * 用于 UI 表单的 Select 组件
   */
  getOptions(): Array<{ id: T; name: string; description?: string }>
  /**
   * 获取指定预设的提示词片段
   * @param id 预设 ID
   */
  getPromptBlocks(id: T): { system?: string; user?: string }
  /**
   * 获取预设定义
   * @param id 预设 ID
   */
  getPreset(id: T): PresetDefinition | undefined
}

/**
 * 创建预设类别的工厂函数
 * Factory function to create PresetCategory
 *
 * @param categoryId 类别 ID
 * @param categoryLabel 类别显示名称
 * @param presets 预设映射表
 * @returns PresetCategory 实例
 */
export function createPresetCategory<T extends string>(
  categoryId: string,
  categoryLabel: string,
  presets: Record<T, PresetDefinition>
): PresetCategory<T> {
  return {
    categoryId,
    categoryLabel,
    presets,

    getOptions(): Array<{ id: T; name: string; description?: string }> {
      return Object.entries(presets).map(([id, preset]) => ({
        id: id as T,
        name: (preset as PresetDefinition).label,
        description: (preset as PresetDefinition).description
      }))
    },

    getPromptBlocks(id: T): { system?: string; user?: string } {
      const preset = presets[id]
      if (!preset) {
        return {}
      }
      return {
        system: preset.systemPromptBlock,
        user: preset.userPromptBlock
      }
    },

    getPreset(id: T): PresetDefinition | undefined {
      return presets[id]
    }
  }
}

// ==================== 电商预设类型 ====================

/**
 * 布局模式类型
 * Layout Mode Types
 *
 * 非真人拍摄方式：
 * - none: AI 自由发挥
 * - random: 随机选择
 * - flat_lay: 平铺图（俯视90度）
 * - hanging: 隐形挂拍（衣架悬挂）
 * - ghost_mannequin: 隐形人台（3D立体）
 * - hanger_visible: 可见衣架展示
 * - creative_flat_lay: 创意平铺（带道具组合）
 * - styled_set: 造型搭配展示（多件服装组合）
 * - detail_closeup: 细节特写
 * - texture_focus: 面料质感特写
 * - studio_white: 纯白背景棚拍
 * - folded: 折叠展示
 *
 * 真人模式：
 * - on_model: 真人模特
 * - lifestyle: 场景生活照
 */
export type LayoutModeId =
  | 'none'
  | 'random'
  // 非真人拍摄方式
  | 'flat_lay'
  | 'hanging'
  | 'ghost_mannequin'
  | 'hanger_visible'
  | 'creative_flat_lay'
  | 'styled_set'
  | 'detail_closeup'
  | 'texture_focus'
  | 'studio_white'
  | 'folded'
  // 真人模式
  | 'on_model'
  | 'lifestyle'

/**
 * 解析后的布局模式（不包含 random）
 */
export type ResolvedLayoutModeId =
  | 'none'
  // 非真人拍摄方式
  | 'flat_lay'
  | 'hanging'
  | 'ghost_mannequin'
  | 'hanger_visible'
  | 'creative_flat_lay'
  | 'styled_set'
  | 'detail_closeup'
  | 'texture_focus'
  | 'studio_white'
  | 'folded'
  // 真人模式
  | 'on_model'
  | 'lifestyle'

/**
 * 填充模式类型
 * Fill Mode Types
 *
 * - none: AI 自由发挥
 * - random: 随机选择
 * - filled: 3D 立体填充（Ghost Mannequin）
 * - flat: 自然平铺
 * - stuffed: 填充物填充（纸巾/气囊）
 * - pinned: 别针固定造型
 * - invisible_form: 隐形支撑架
 */
export type FillModeId = 'none' | 'random' | 'filled' | 'flat' | 'stuffed' | 'pinned' | 'invisible_form'

/**
 * 解析后的填充模式（不包含 random）
 */
export type ResolvedFillModeId = 'none' | 'filled' | 'flat' | 'stuffed' | 'pinned' | 'invisible_form'

/**
 * 光影模式类型
 * Lighting Mode Types
 *
 * - auto: AI 自动选择
 * - soft_box: 柔光箱（均匀柔和）
 * - rim_light: 轮廓光（边缘分离）
 * - natural_window: 自然窗光
 * - high_key: 高调光（明亮清新）
 * - low_key: 低调光（深沉质感）
 * - three_point: 三点布光
 */
export type LightingModeId =
  | 'auto'
  | 'soft_box'
  | 'rim_light'
  | 'natural_window'
  | 'high_key'
  | 'low_key'
  | 'three_point'

// ==================== 模特预设类型 ====================

/**
 * 年龄段类型
 */
export type AgeGroupId = 'random' | 'small_kid' | 'big_kid' | 'teen' | 'young_adult' | 'adult' | 'mature'

/**
 * 性别类型
 */
export type GenderId = 'random' | 'female' | 'male' | 'unisex'

/**
 * 场景类型
 */
export type SceneId = 'random' | 'studio' | 'home' | 'outdoor' | 'playground' | 'nature' | string

/**
 * 人种类型
 */
export type EthnicityId = 'random' | 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed' | string

/**
 * 姿态类型
 */
export type PoseId = 'random' | 'natural' | 'sitting' | 'playing' | 'walking' | 'confident' | 'editorial' | string

/**
 * 风格模式类型
 */
export type StyleModeId = 'random' | 'daily' | 'commercial' | string

// ==================== 图案预设类型 ====================

/**
 * 图案类型
 */
export type PatternTypeId = 'random' | 'seamless' | 'placement' | 'allover'

/**
 * 图案风格类型
 */
export type PatternStyleId =
  | 'random'
  | 'auto'
  | 'kawaii'
  | 'sporty'
  | 'preppy'
  | 'ip_theme'
  | 'sweet'
  | 'geometric'
  | 'text'

/**
 * 复杂预设分类类型
 * Complex Preset Category Types
 *
 * 用于 PromptPresetSelector 等需要分类/标签/搜索的场景
 */
export type ComplexPresetCategory = 'pattern' | 'commercial' | 'lifestyle' | 'artistic'

// ==================== 扩展预设定义接口 ====================

/**
 * 年龄段扩展预设定义
 * Extended Age Preset Definition
 *
 * 【Single Source of Truth】
 * UI 选项和提示词构建共用此定义
 */
export interface AgePresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 年龄范围描述 */
  ageRange: string
  /** 默认年龄（用于 JSON 输出） */
  defaultAge: number
  /** 姿态描述 */
  pose: string
  /** 表情描述 */
  expression: string
}

/**
 * 性别扩展预设定义
 * Extended Gender Preset Definition
 */
export interface GenderPresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 英文标签（用于模特描述，如 girl/boy） */
  genderLabel: string
  /** 外观特征描述 */
  features: string
}

/**
 * 场景扩展预设定义
 * Extended Scene Preset Definition
 */
export interface ScenePresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 光照描述 */
  lighting: string
  /** 背景描述 */
  background: string
  /** 道具描述 */
  props: string
  /** 前景描述（用于模特模式） */
  foreground?: string
  /** 中景描述（用于模特模式） */
  midground?: string
  /** 构图描述 */
  composition?: string
  /** 视觉风格 */
  visual_style?: string
}

/**
 * 人种扩展预设定义
 * Extended Ethnicity Preset Definition
 */
export interface EthnicityPresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 详细外观描述 */
  detailedDescription: string
}

/**
 * 姿态扩展预设定义
 * Extended Pose Preset Definition
 */
export interface PosePresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 详细姿态描述 */
  detailedDescription: string
}

/**
 * 风格模式扩展预设定义
 * Extended Style Mode Preset Definition
 */
export interface StyleModePresetDefinition extends PresetDefinition {
  /** 风格描述 */
  styleDescription: string
  /** 质量要求 */
  quality: string
}

// ==================== 复杂预设定义接口（支持 tags/category/preview）====================

/**
 * 图案风格扩展预设定义
 * Pattern Style Extended Preset Definition
 *
 * 用于 PromptPresetSelector 等需要完整提示词、标签、分类的场景
 *
 * 【SSOT 模式】
 * 添加新预设只需在注册表中添加一条记录，UI 自动同步：
 * - getOptions() 自动包含新选项
 * - 搜索/标签过滤自动生效
 * - 分类 Tab 自动包含
 */
export interface PatternStylePresetDefinition extends PresetDefinition {
  /** 英文名称（用于国际化） */
  nameEn: string
  /** 完整提示词模板 */
  prompt: string
  /** 搜索/过滤用标签 */
  tags: string[]
  /** 分类（用于 Tab 过滤） */
  category: ComplexPresetCategory
  /** 预览图 URL（可选） */
  preview?: string
}

/**
 * 商拍场景扩展预设定义
 * Commercial Scene Extended Preset Definition
 */
export interface CommercialScenePresetDefinition extends PresetDefinition {
  /** 场景分类 */
  category: 'indoor' | 'outdoor' | 'studio'
  /** 场景提示词 */
  scenePrompt: string
  /** 光照提示词 */
  lightingPrompt: string
  /** 氛围提示词 */
  moodPrompt: string
  /** 搜索/过滤用标签（可选） */
  tags?: string[]
  /** 预览图 URL（可选） */
  preview?: string
}

/**
 * 模特类型扩展预设定义
 * Model Type Extended Preset Definition
 */
export interface ModelTypePresetDefinition extends PresetDefinition {
  /** 年龄段 */
  ageGroup: 'small_kid' | 'big_kid' | 'teen' | 'adult'
  /** 性别 */
  gender: 'male' | 'female' | 'unisex'
  /** 身体描述提示词 */
  bodyPrompt: string
  /** 姿势提示词 */
  posePrompt: string
  /** 搜索/过滤用标签（可选） */
  tags?: string[]
  /** 预览图 URL（可选） */
  preview?: string
}

/**
 * 扩展人种预设定义（带提示词）
 * Extended Ethnicity Preset Definition with Prompt
 */
export interface ExtendedEthnicityPresetDefinition extends PresetDefinition {
  /** 英文描述（用于提示词） */
  en: string
  /** 完整提示词 */
  prompt: string
  /** 搜索/过滤用标签（可选） */
  tags?: string[]
}
