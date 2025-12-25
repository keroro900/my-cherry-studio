/**
 * 统一预设常量文件（向后兼容层）
 * Unified Presets Constants (Backward Compatibility Layer)
 *
 * ⚠️ 注意：核心预设定义已迁移到 presets/ 模块
 * 新代码应直接从 '../presets' 导入
 *
 * 此文件保留的内容：
 * - PRESETS_VERSION 版本标识
 * - *_OPTIONS 列表（用于表单下拉选项）
 * - 商拍/模特/人种复杂预设（PromptPresetSelector 使用）
 * - 布局/填充模式解析函数（向后兼容）
 *
 * @deprecated 核心预设请从 '../presets' 导入
 * @module constants/presets
 */

// ==================== 版本标识 ====================

export const PRESETS_VERSION = 'v2'

// ==================== 类型定义（向后兼容）====================
// 这些类型已迁移到 presets/types.ts，这里保留用于向后兼容

/**
 * @deprecated 使用 AgePresetDefinition from '../presets'
 */
export interface AgePreset {
  en: string
  ageRange: string
  defaultAge: number
  pose: string
  expression: string
}

/**
 * @deprecated 使用 GenderPresetDefinition from '../presets'
 */
export interface GenderPreset {
  en: string
  label: string
  features: string
}

/**
 * @deprecated 使用 ScenePresetDefinition from '../presets'
 */
export interface ScenePreset {
  en: string
  lighting: string
  background: string
  props: string
  foreground?: string
  midground?: string
  composition?: string
  visual_style?: string
}

/**
 * @deprecated 使用 EthnicityPresetDefinition from '../presets'
 */
export interface EthnicityPreset {
  en: string
  description: string
}

/**
 * @deprecated 使用 PosePresetDefinition from '../presets'
 */
export interface PosePreset {
  en: string
  description: string
}

/**
 * @deprecated 使用 StyleModePresetDefinition from '../presets'
 */
export interface StyleModePreset {
  description: string
  quality: string
}

// ==================== 核心预设（从新注册表重新导出）====================
// 这些预设的 Single Source of Truth 在 presets/ 模块
// 这里仅为向后兼容而重新导出

import {
  AGE_PRESETS as NEW_AGE_PRESETS,
  ETHNICITY_PRESETS as NEW_ETHNICITY_PRESETS,
  GENDER_PRESETS as NEW_GENDER_PRESETS,
  getAgePreset as newGetAgePreset,
  getEthnicityPreset as newGetEthnicityPreset,
  getGenderPreset as newGetGenderPreset,
  getPosePreset as newGetPosePreset,
  getScenePreset as newGetScenePreset,
  getStyleModePreset as newGetStyleModePreset,
  POSE_PRESETS as NEW_POSE_PRESETS,
  SCENE_PRESETS as NEW_SCENE_PRESETS,
  STYLE_MODE_PRESETS as NEW_STYLE_MODE_PRESETS
} from '../presets'

// 转换新预设格式到旧格式的辅助函数
function convertAgePresets(): Record<string, AgePreset> {
  const result: Record<string, AgePreset> = {}
  for (const [key, value] of Object.entries(NEW_AGE_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      en: preset.en || '',
      ageRange: preset.ageRange || '',
      defaultAge: preset.defaultAge || 0,
      pose: preset.pose || '',
      expression: preset.expression || ''
    }
  }
  return result
}

function convertGenderPresets(): Record<string, GenderPreset> {
  const result: Record<string, GenderPreset> = {}
  for (const [key, value] of Object.entries(NEW_GENDER_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      en: preset.en || '',
      label: preset.genderLabel || preset.label || '',
      features: preset.features || ''
    }
  }
  return result
}

function convertScenePresets(): Record<string, ScenePreset> {
  const result: Record<string, ScenePreset> = {}
  for (const [key, value] of Object.entries(NEW_SCENE_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      en: preset.en || '',
      lighting: preset.lighting || '',
      background: preset.background || '',
      props: preset.props || '',
      foreground: preset.foreground,
      midground: preset.midground,
      composition: preset.composition,
      visual_style: preset.visual_style
    }
  }
  return result
}

function convertEthnicityPresets(): Record<string, EthnicityPreset> {
  const result: Record<string, EthnicityPreset> = {}
  for (const [key, value] of Object.entries(NEW_ETHNICITY_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      en: preset.en || '',
      description: preset.detailedDescription || preset.description || ''
    }
  }
  return result
}

function convertPosePresets(): Record<string, PosePreset> {
  const result: Record<string, PosePreset> = {}
  for (const [key, value] of Object.entries(NEW_POSE_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      en: preset.en || '',
      description: preset.detailedDescription || preset.description || ''
    }
  }
  return result
}

function convertStyleModePresets(): Record<string, StyleModePreset> {
  const result: Record<string, StyleModePreset> = {}
  for (const [key, value] of Object.entries(NEW_STYLE_MODE_PRESETS.presets)) {
    if (key === 'random') continue
    const preset = value as any
    result[key] = {
      description: preset.styleDescription || preset.description || '',
      quality: preset.quality || ''
    }
  }
  return result
}

/**
 * @deprecated 使用 AGE_PRESETS from '../presets'
 */
export const AGE_PRESETS: Record<string, AgePreset> = convertAgePresets()

/**
 * @deprecated 使用 GENDER_PRESETS from '../presets'
 */
export const GENDER_PRESETS: Record<string, GenderPreset> = convertGenderPresets()

/**
 * @deprecated 使用 SCENE_PRESETS from '../presets'
 */
export const SCENE_PRESETS: Record<string, ScenePreset> = convertScenePresets()

/**
 * @deprecated 使用 ETHNICITY_PRESETS from '../presets'
 */
export const ETHNICITY_PRESETS: Record<string, EthnicityPreset> = convertEthnicityPresets()

/**
 * @deprecated 使用 POSE_PRESETS from '../presets'
 */
export const POSE_PRESETS: Record<string, PosePreset> = convertPosePresets()

/**
 * @deprecated 使用 STYLE_MODE_PRESETS from '../presets'
 */
export const STYLE_MODE_PRESETS: Record<string, StyleModePreset> = convertStyleModePresets()

// ==================== 下拉选项列表（用于配置表单）====================
/**
 * 下拉选项列表 - 从预设注册表自动生成
 *
 * 这些选项列表现在从 presets/ 模块的注册表自动生成，确保 SSOT（单一数据源）。
 * 任何预设的增删改都会自动反映在这些选项列表中。
 *
 * 使用方式：
 * - 在配置表单的 Select/Dropdown 组件中使用这些选项
 * - 选项结构：{ id: string, name: string, description?: string }
 *
 * 注意：
 * - 不要手动修改这些列表，它们是从注册表自动生成的
 * - 如需添加新选项，请在对应的 presets/*.ts 文件中添加预设定义
 */

/**
 * 年龄段选项列表
 * @see presets/model.ts - AGE_PRESETS
 */
export const AGE_OPTIONS = NEW_AGE_PRESETS.getOptions()

/**
 * 性别选项列表
 * @see presets/model.ts - GENDER_PRESETS
 */
export const GENDER_OPTIONS = NEW_GENDER_PRESETS.getOptions()

/**
 * 场景选项列表
 * @see presets/model.ts - SCENE_PRESETS
 */
export const SCENE_OPTIONS = NEW_SCENE_PRESETS.getOptions()

/**
 * 人种选项列表
 * @see presets/model.ts - ETHNICITY_PRESETS
 */
export const ETHNICITY_OPTIONS = NEW_ETHNICITY_PRESETS.getOptions()

/**
 * 姿态选项列表
 * @see presets/model.ts - POSE_PRESETS
 */
export const POSE_OPTIONS = NEW_POSE_PRESETS.getOptions()

/**
 * 风格模式选项列表
 * @see presets/model.ts - STYLE_MODE_PRESETS
 */
export const STYLE_MODE_OPTIONS = NEW_STYLE_MODE_PRESETS.getOptions()

// ==================== 辅助函数（从新注册表委托）====================

/**
 * @deprecated 使用 getAgePreset from '../presets'
 */
export function getAgePreset(ageGroup: string): AgePreset {
  const preset = newGetAgePreset(ageGroup)
  if (!preset) return AGE_PRESETS.big_kid
  const { id: _id, label: _l, description: _d, systemPromptBlock: _s, userPromptBlock: _u, ...rest } = preset
  return rest as AgePreset
}

/**
 * @deprecated 使用 getGenderPreset from '../presets'
 */
export function getGenderPreset(gender: string): GenderPreset {
  const preset = newGetGenderPreset(gender)
  if (!preset) return GENDER_PRESETS.female
  return {
    en: preset.en || '',
    label: preset.genderLabel || '',
    features: preset.features || ''
  }
}

/**
 * @deprecated 使用 getScenePreset from '../presets'
 */
export function getScenePreset(scene: string): ScenePreset {
  const preset = newGetScenePreset(scene)
  if (!preset) return SCENE_PRESETS.home
  const { id: _id, label: _l, description: _d, systemPromptBlock: _s, userPromptBlock: _u, ...rest } = preset
  return rest as ScenePreset
}

/**
 * @deprecated 使用 getEthnicityPreset from '../presets'
 */
export function getEthnicityPreset(ethnicity: string): EthnicityPreset {
  const preset = newGetEthnicityPreset(ethnicity)
  if (!preset) return ETHNICITY_PRESETS.asian
  const {
    id: _id,
    label: _l,
    description: _d,
    systemPromptBlock: _s,
    userPromptBlock: _u,
    en,
    detailedDescription
  } = preset
  return { en, description: detailedDescription } as EthnicityPreset
}

/**
 * @deprecated 使用 getPosePreset from '../presets'
 */
export function getPosePreset(pose: string): PosePreset {
  const preset = newGetPosePreset(pose)
  if (!preset) return POSE_PRESETS.natural
  const {
    id: _id,
    label: _l,
    description: _d,
    systemPromptBlock: _s,
    userPromptBlock: _u,
    en,
    detailedDescription
  } = preset
  return { en, description: detailedDescription } as PosePreset
}

/**
 * @deprecated 使用 getStyleModePreset from '../presets'
 */
export function getStyleModePreset(styleMode: string): StyleModePreset {
  const preset = newGetStyleModePreset(styleMode)
  if (!preset) return STYLE_MODE_PRESETS.daily
  return {
    description: preset.styleDescription || '',
    quality: preset.quality || ''
  }
}

// ==================== 智能提示词节点专用选项（UnifiedPromptNode）====================

/**
 * 图案类型选项列表
 */
export const PATTERN_TYPE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机图案类型' },
  { id: 'seamless', name: '无缝拼贴', description: 'Seamlessly repeatable pattern' },
  { id: 'placement', name: '定位印花', description: 'Single placement design (chest print)' },
  { id: 'allover', name: '满印图案', description: 'Full garment coverage pattern' }
]

/**
 * 图案风格选项列表
 */
export const PATTERN_STYLE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机图案风格' },
  { id: 'auto', name: '自动检测', description: 'Automatically detect style from image' },
  { id: 'kawaii', name: '卡哇伊可爱', description: 'Japanese cute style' },
  { id: 'sporty', name: '运动动感', description: 'Athletic sports style' },
  { id: 'preppy', name: '学院风', description: 'Classic collegiate style' },
  { id: 'ip_theme', name: 'IP主题', description: 'Character/IP based theme' },
  { id: 'sweet', name: '甜美浪漫', description: 'Sweet romantic style' },
  { id: 'geometric', name: '几何图形', description: 'Geometric shapes pattern' },
  { id: 'text', name: '字体排版', description: 'Text/slogan based pattern' }
]

/**
 * 展示模式选项列表
 */
export const DISPLAY_MODE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机展示模式' },
  { id: 'flat_lay', name: '平铺图', description: 'Top-down flat lay display' },
  { id: 'hanger', name: '挂拍图', description: 'Hanger suspended display' },
  { id: 'scene', name: '场景造型', description: 'Theme scene display' },
  { id: 'model', name: '模特展示', description: 'Model wearing display' }
]

/**
 * 平台风格选项列表
 */
export const PLATFORM_STYLE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机平台风格' },
  { id: 'shein', name: 'SHEIN', description: 'Young, fashionable lifestyle style' },
  { id: 'temu', name: 'TEMU', description: 'Value-focused practical style' },
  { id: 'amazon', name: 'Amazon', description: 'Professional standard style' },
  { id: 'taobao', name: '淘宝', description: 'Detailed showcase style' },
  { id: 'xiaohongshu', name: '小红书', description: 'Aesthetic lifestyle style' }
]

/**
 * 填充模式选项列表（电商图用）
 */
export const FILL_MODE_OPTIONS = [
  { id: 'none', name: '无（自由发挥）', description: 'AI decides the best styling technique' },
  { id: 'random', name: '随机选择', description: '随机填充模式' },
  { id: 'filled', name: '立体填充', description: 'Ghost mannequin effect, garment has 3D form' },
  { id: 'flat', name: '自然平铺', description: 'Garment naturally flat, slightly flat fabric' }
]

/**
 * 布局模式选项列表（电商图用）
 */
export const LAYOUT_MODE_OPTIONS = [
  { id: 'none', name: '无（自由发挥）', description: 'AI decides the best layout' },
  { id: 'random', name: '随机选择', description: '随机布局模式' },
  { id: 'flat_lay', name: '平铺图', description: 'Top-down flat lay main image' },
  { id: 'hanging', name: '挂拍图', description: 'Hanger hanging main image' }
]

// ==================== 商拍场景预设（已迁移到 presets/commercial.ts）====================
// 这些导出保留用于向后兼容，新代码应从 '../presets' 导入

import {
  COMMERCIAL_SCENE_PRESETS as NEW_COMMERCIAL_SCENE_PRESETS,
  EXTENDED_ETHNICITY_PRESETS as NEW_EXTENDED_ETHNICITY_PRESETS,
  MODEL_TYPE_PRESETS as NEW_MODEL_TYPE_PRESETS
} from '../presets'
import type {
  CommercialScenePresetDefinition,
  ExtendedEthnicityPresetDefinition,
  ModelTypePresetDefinition
} from '../presets/types'

/**
 * @deprecated 使用 CommercialScenePresetDefinition from '../presets/types'
 */
export interface CommercialScenePreset {
  id: string
  name: string
  category: 'indoor' | 'outdoor' | 'studio'
  description: string
  scenePrompt: string
  lightingPrompt: string
  moodPrompt: string
}

/**
 * @deprecated 使用 COMMERCIAL_SCENE_PRESETS from '../presets'
 */
export const COMMERCIAL_SCENE_PRESETS: CommercialScenePreset[] = NEW_COMMERCIAL_SCENE_PRESETS.getAll().map(
  (preset: CommercialScenePresetDefinition) => ({
    id: preset.id,
    name: preset.label,
    category: preset.category,
    description: preset.description || '',
    scenePrompt: preset.scenePrompt,
    lightingPrompt: preset.lightingPrompt,
    moodPrompt: preset.moodPrompt
  })
)

// ==================== 模特类型预设（已迁移到 presets/commercial.ts）====================

/**
 * @deprecated 使用 ModelTypePresetDefinition from '../presets/types'
 */
export interface ModelTypePreset {
  id: string
  name: string
  ageGroup: 'small_kid' | 'big_kid' | 'teen' | 'adult'
  gender: 'male' | 'female' | 'unisex'
  description: string
  bodyPrompt: string
  posePrompt: string
}

/**
 * @deprecated 使用 MODEL_TYPE_PRESETS from '../presets'
 */
export const MODEL_TYPE_PRESETS: ModelTypePreset[] = NEW_MODEL_TYPE_PRESETS.getAll().map(
  (preset: ModelTypePresetDefinition) => ({
    id: preset.id,
    name: preset.label,
    ageGroup: preset.ageGroup,
    gender: preset.gender,
    description: preset.description || '',
    bodyPrompt: preset.bodyPrompt,
    posePrompt: preset.posePrompt
  })
)

// ==================== 人种预设扩展（已迁移到 presets/commercial.ts）====================

/**
 * @deprecated 使用 ExtendedEthnicityPresetDefinition from '../presets/types'
 */
export interface ExtendedEthnicityPreset {
  id: string
  name: string
  description: string
  prompt: string
}

/**
 * @deprecated 使用 EXTENDED_ETHNICITY_PRESETS from '../presets'
 */
export const EXTENDED_ETHNICITY_PRESETS: ExtendedEthnicityPreset[] = NEW_EXTENDED_ETHNICITY_PRESETS.getAll().map(
  (preset: ExtendedEthnicityPresetDefinition) => ({
    id: preset.id,
    name: preset.label,
    description: preset.description || '',
    prompt: preset.prompt
  })
)

// ==================== 布局/填充模式解析函数（向后兼容）====================
// 新代码应使用 resolveLayoutMode / resolveFillMode from '../presets/ecom'

import { resolveFillMode as newResolveFillMode, resolveLayoutMode as newResolveLayoutMode } from '../presets/ecom'
import type { ResolvedFillModeId, ResolvedLayoutModeId } from '../presets/types'

/**
 * 布局模式类型
 * @deprecated 使用 LayoutModeId from '../presets/types'
 */
export type LayoutMode = 'none' | 'flat_lay' | 'hanging' | 'random'
export type ResolvedLayoutMode = ResolvedLayoutModeId

/**
 * 填充模式类型
 * @deprecated 使用 FillModeId from '../presets/types'
 */
export type FillMode = 'none' | 'filled' | 'flat' | 'random'
export type ResolvedFillMode = ResolvedFillModeId

/**
 * @deprecated 使用 resolveLayoutMode from '../presets/ecom'
 */
export function resolveLayoutMode(mode: LayoutMode | string | undefined | null): ResolvedLayoutMode {
  return newResolveLayoutMode(mode as any)
}

/**
 * @deprecated 使用 resolveFillMode from '../presets/ecom'
 */
export function resolveFillMode(mode: FillMode | string | undefined | null): ResolvedFillMode {
  return newResolveFillMode(mode as any)
}

// ==================== 提示词工具函数 ====================

/**
 * 构建商拍场景提示词
 */
export function buildCommercialPrompt(
  scene: CommercialScenePreset,
  modelType: ModelTypePreset,
  ethnicity: ExtendedEthnicityPreset,
  additionalDetails?: string
): string {
  const parts = [
    modelType.bodyPrompt,
    ethnicity.prompt,
    modelType.posePrompt,
    scene.scenePrompt,
    scene.lightingPrompt,
    scene.moodPrompt
  ]

  if (additionalDetails) {
    parts.push(additionalDetails)
  }

  return parts.join('. ') + '.'
}
