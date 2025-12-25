/**
 * 商拍预设注册表
 * Commercial Preset Registry
 *
 * 包含：
 * - 商拍场景预设 (COMMERCIAL_SCENE_PRESETS)
 * - 模特类型预设 (MODEL_TYPE_PRESETS)
 * - 扩展人种预设 (EXTENDED_ETHNICITY_PRESETS)
 *
 * 【SSOT 模式】
 * 添加新预设只需在注册表中添加一条记录，UI 自动同步：
 * - getOptions() 自动包含新选项
 * - getPresetsByCategory() 按分类过滤
 * - searchPresets() 搜索标签和名称
 *
 * @module presets/commercial
 */

import {
  type CommercialScenePresetDefinition,
  type ExtendedEthnicityPresetDefinition,
  type ModelTypePresetDefinition
} from './types'

// ==================== 商拍场景预设 ====================

const COMMERCIAL_SCENE_DEFINITIONS: Record<string, CommercialScenePresetDefinition> = {
  studio_white: {
    id: 'studio_white',
    label: '白色影棚',
    description: '专业纯白背景，适合产品展示',
    category: 'studio',
    scenePrompt: 'pure white studio background, clean minimal setup',
    lightingPrompt: 'soft studio lighting, even illumination, no harsh shadows',
    moodPrompt: 'professional, clean, commercial',
    tags: ['影棚', '专业', '纯白', '产品']
  },
  studio_gradient: {
    id: 'studio_gradient',
    label: '渐变影棚',
    description: '柔和渐变背景，高级感',
    category: 'studio',
    scenePrompt: 'gradient studio background, soft transition from light to dark',
    lightingPrompt: 'professional three-point lighting, soft key light',
    moodPrompt: 'elegant, modern, sophisticated',
    tags: ['影棚', '渐变', '高级', '优雅']
  },
  home_living: {
    id: 'home_living',
    label: '居家客厅',
    description: '温馨家居氛围，适合家居服',
    category: 'indoor',
    scenePrompt: 'cozy living room, comfortable sofa, warm home interior',
    lightingPrompt: 'natural window light, warm ambient lighting',
    moodPrompt: 'comfortable, relaxed, homey',
    tags: ['室内', '家居', '温馨', '客厅']
  },
  home_bedroom: {
    id: 'home_bedroom',
    label: '卧室场景',
    description: '柔和卧室氛围，适合睡衣',
    category: 'indoor',
    scenePrompt: 'soft bedroom setting, comfortable bed, cozy atmosphere',
    lightingPrompt: 'soft morning light through curtains, warm tones',
    moodPrompt: 'peaceful, relaxing, intimate',
    tags: ['室内', '卧室', '温馨', '睡衣']
  },
  outdoor_park: {
    id: 'outdoor_park',
    label: '公园草地',
    description: '自然草地场景，适合休闲服装',
    category: 'outdoor',
    scenePrompt: 'lush green park, grass field, trees in background',
    lightingPrompt: 'golden hour sunlight, dappled shadows through leaves',
    moodPrompt: 'natural, fresh, playful',
    tags: ['室外', '公园', '自然', '休闲']
  },
  outdoor_beach: {
    id: 'outdoor_beach',
    label: '海滩沙滩',
    description: '阳光沙滩，适合夏季服装',
    category: 'outdoor',
    scenePrompt: 'beautiful sandy beach, blue ocean, clear sky',
    lightingPrompt: 'bright sunshine, beach reflections',
    moodPrompt: 'sunny, vacation, carefree',
    tags: ['室外', '海滩', '夏季', '度假']
  },
  outdoor_urban: {
    id: 'outdoor_urban',
    label: '城市街景',
    description: '现代城市背景，适合潮流服装',
    category: 'outdoor',
    scenePrompt: 'modern city street, urban architecture, contemporary setting',
    lightingPrompt: 'natural daylight, urban lighting mix',
    moodPrompt: 'modern, urban, trendy',
    tags: ['室外', '城市', '街景', '潮流']
  },
  outdoor_garden: {
    id: 'outdoor_garden',
    label: '花园小径',
    description: '花园环境，适合春夏服装',
    category: 'outdoor',
    scenePrompt: 'beautiful garden path, blooming flowers, greenery',
    lightingPrompt: 'soft diffused sunlight, natural colors',
    moodPrompt: 'romantic, fresh, elegant',
    tags: ['室外', '花园', '春夏', '浪漫']
  }
}

/**
 * 商拍场景预设注册表
 * Commercial Scene Preset Registry
 */
export const COMMERCIAL_SCENE_PRESETS = {
  /** 所有预设定义 */
  presets: COMMERCIAL_SCENE_DEFINITIONS,

  /**
   * 获取下拉选项列表（兼容旧格式）
   */
  getOptions(): Array<{ id: string; name: string; description?: string }> {
    return Object.values(COMMERCIAL_SCENE_DEFINITIONS).map((preset) => ({
      id: preset.id,
      name: preset.label,
      description: preset.description
    }))
  },

  /**
   * 获取所有预设列表（兼容旧的数组格式）
   */
  getAll(): CommercialScenePresetDefinition[] {
    return Object.values(COMMERCIAL_SCENE_DEFINITIONS)
  },

  /**
   * 获取指定预设
   */
  getPreset(id: string): CommercialScenePresetDefinition | undefined {
    return COMMERCIAL_SCENE_DEFINITIONS[id]
  },

  /**
   * 按分类获取预设列表
   */
  getPresetsByCategory(category?: 'indoor' | 'outdoor' | 'studio'): CommercialScenePresetDefinition[] {
    const all = Object.values(COMMERCIAL_SCENE_DEFINITIONS)
    if (!category) return all
    return all.filter((preset) => preset.category === category)
  },

  /**
   * 搜索预设（按名称、描述、标签）
   */
  searchPresets(keyword: string): CommercialScenePresetDefinition[] {
    const kw = keyword.toLowerCase()
    return Object.values(COMMERCIAL_SCENE_DEFINITIONS).filter(
      (preset) =>
        preset.label.toLowerCase().includes(kw) ||
        (preset.description && preset.description.toLowerCase().includes(kw)) ||
        (preset.tags && preset.tags.some((tag) => tag.toLowerCase().includes(kw)))
    )
  }
}

// ==================== 模特类型预设 ====================

const MODEL_TYPE_DEFINITIONS: Record<string, ModelTypePresetDefinition> = {
  small_kid_girl: {
    id: 'small_kid_girl',
    label: '小童女孩 (3-7岁)',
    description: '可爱活泼的小女孩',
    ageGroup: 'small_kid',
    gender: 'female',
    bodyPrompt: 'cute little girl, 3-7 years old, healthy and cheerful',
    posePrompt: 'natural playful pose, innocent expression, happy mood',
    tags: ['小童', '女孩', '可爱']
  },
  small_kid_boy: {
    id: 'small_kid_boy',
    label: '小童男孩 (3-7岁)',
    description: '活泼可爱的小男孩',
    ageGroup: 'small_kid',
    gender: 'male',
    bodyPrompt: 'cute little boy, 3-7 years old, energetic and happy',
    posePrompt: 'natural active pose, bright expression, adventurous mood',
    tags: ['小童', '男孩', '活泼']
  },
  big_kid_girl: {
    id: 'big_kid_girl',
    label: '大童女孩 (8-12岁)',
    description: '青春活力的女孩',
    ageGroup: 'big_kid',
    gender: 'female',
    bodyPrompt: 'young girl, 8-12 years old, healthy and confident',
    posePrompt: 'natural confident pose, friendly expression',
    tags: ['大童', '女孩', '青春']
  },
  big_kid_boy: {
    id: 'big_kid_boy',
    label: '大童男孩 (8-12岁)',
    description: '阳光活力的男孩',
    ageGroup: 'big_kid',
    gender: 'male',
    bodyPrompt: 'young boy, 8-12 years old, energetic and sporty',
    posePrompt: 'natural sporty pose, confident expression',
    tags: ['大童', '男孩', '阳光']
  },
  teen_girl: {
    id: 'teen_girl',
    label: '青少年女孩 (13-17岁)',
    description: '时尚青春的少女',
    ageGroup: 'teen',
    gender: 'female',
    bodyPrompt: 'teenage girl, 13-17 years old, trendy and stylish',
    posePrompt: 'fashionable pose, confident expression',
    tags: ['青少年', '女孩', '时尚']
  },
  teen_boy: {
    id: 'teen_boy',
    label: '青少年男孩 (13-17岁)',
    description: '帅气阳光的少年',
    ageGroup: 'teen',
    gender: 'male',
    bodyPrompt: 'teenage boy, 13-17 years old, cool and athletic',
    posePrompt: 'casual cool pose, confident expression',
    tags: ['青少年', '男孩', '帅气']
  },
  adult_woman: {
    id: 'adult_woman',
    label: '成年女性 (18-30岁)',
    description: '时尚优雅的年轻女性',
    ageGroup: 'adult',
    gender: 'female',
    bodyPrompt: 'young woman, 18-30 years old, elegant and fashionable',
    posePrompt: 'professional model pose, confident and stylish',
    tags: ['成人', '女性', '优雅']
  },
  adult_man: {
    id: 'adult_man',
    label: '成年男性 (18-30岁)',
    description: '时尚帅气的年轻男性',
    ageGroup: 'adult',
    gender: 'male',
    bodyPrompt: 'young man, 18-30 years old, fit and stylish',
    posePrompt: 'professional model pose, confident and cool',
    tags: ['成人', '男性', '帅气']
  }
}

/**
 * 模特类型预设注册表
 * Model Type Preset Registry
 */
export const MODEL_TYPE_PRESETS = {
  /** 所有预设定义 */
  presets: MODEL_TYPE_DEFINITIONS,

  /**
   * 获取下拉选项列表
   */
  getOptions(): Array<{ id: string; name: string; description?: string }> {
    return Object.values(MODEL_TYPE_DEFINITIONS).map((preset) => ({
      id: preset.id,
      name: preset.label,
      description: preset.description
    }))
  },

  /**
   * 获取所有预设列表（兼容旧的数组格式）
   */
  getAll(): ModelTypePresetDefinition[] {
    return Object.values(MODEL_TYPE_DEFINITIONS)
  },

  /**
   * 获取指定预设
   */
  getPreset(id: string): ModelTypePresetDefinition | undefined {
    return MODEL_TYPE_DEFINITIONS[id]
  },

  /**
   * 按年龄段获取预设列表
   */
  getPresetsByAgeGroup(ageGroup?: 'small_kid' | 'big_kid' | 'teen' | 'adult'): ModelTypePresetDefinition[] {
    const all = Object.values(MODEL_TYPE_DEFINITIONS)
    if (!ageGroup) return all
    return all.filter((preset) => preset.ageGroup === ageGroup)
  },

  /**
   * 按性别获取预设列表
   */
  getPresetsByGender(gender?: 'male' | 'female' | 'unisex'): ModelTypePresetDefinition[] {
    const all = Object.values(MODEL_TYPE_DEFINITIONS)
    if (!gender) return all
    return all.filter((preset) => preset.gender === gender)
  },

  /**
   * 搜索预设
   */
  searchPresets(keyword: string): ModelTypePresetDefinition[] {
    const kw = keyword.toLowerCase()
    return Object.values(MODEL_TYPE_DEFINITIONS).filter(
      (preset) =>
        preset.label.toLowerCase().includes(kw) ||
        (preset.description && preset.description.toLowerCase().includes(kw)) ||
        (preset.tags && preset.tags.some((tag) => tag.toLowerCase().includes(kw)))
    )
  }
}

// ==================== 扩展人种预设（带提示词）====================

const EXTENDED_ETHNICITY_DEFINITIONS: Record<string, ExtendedEthnicityPresetDefinition> = {
  asian: {
    id: 'asian',
    label: '亚洲人',
    description: '东亚人种特征',
    en: 'Asian',
    prompt: 'Asian ethnicity, East Asian features, natural Asian skin tone',
    tags: ['亚洲', '东亚']
  },
  caucasian: {
    id: 'caucasian',
    label: '欧美白人',
    description: '白人特征',
    en: 'Caucasian',
    prompt: 'Caucasian ethnicity, European features, fair skin',
    tags: ['欧美', '白人']
  },
  african_american: {
    id: 'african_american',
    label: '非裔',
    description: '非裔特征',
    en: 'African American',
    prompt: 'African American ethnicity, Black features, dark skin tone',
    tags: ['非裔', '黑人']
  },
  mixed: {
    id: 'mixed',
    label: '混血',
    description: '混血儿特征',
    en: 'Mixed',
    prompt: 'Mixed ethnicity, diverse features, beautiful mixed heritage',
    tags: ['混血', '多元']
  },
  hispanic: {
    id: 'hispanic',
    label: '拉丁裔',
    description: '拉丁美洲人特征',
    en: 'Hispanic',
    prompt: 'Hispanic/Latino ethnicity, Latin features, warm skin tone',
    tags: ['拉丁裔', '西班牙裔']
  },
  middle_eastern: {
    id: 'middle_eastern',
    label: '中东人',
    description: '中东人特征',
    en: 'Middle Eastern',
    prompt: 'Middle Eastern ethnicity, Middle Eastern features, warm olive skin tone',
    tags: ['中东', '阿拉伯']
  },
  south_asian: {
    id: 'south_asian',
    label: '南亚人',
    description: '南亚人特征',
    en: 'South Asian',
    prompt: 'South Asian ethnicity, South Asian features, brown skin tone',
    tags: ['南亚', '印度']
  },
  south_east_asian: {
    id: 'south_east_asian',
    label: '东南亚人',
    description: '东南亚人特征',
    en: 'Southeast Asian',
    prompt: 'Southeast Asian ethnicity, Southeast Asian features, warm skin tone',
    tags: ['东南亚', '泰国', '越南']
  }
}

/**
 * 扩展人种预设注册表
 * Extended Ethnicity Preset Registry
 */
export const EXTENDED_ETHNICITY_PRESETS = {
  /** 所有预设定义 */
  presets: EXTENDED_ETHNICITY_DEFINITIONS,

  /**
   * 获取下拉选项列表
   */
  getOptions(): Array<{ id: string; name: string; description?: string }> {
    return Object.values(EXTENDED_ETHNICITY_DEFINITIONS).map((preset) => ({
      id: preset.id,
      name: preset.label,
      description: preset.description
    }))
  },

  /**
   * 获取所有预设列表（兼容旧的数组格式）
   */
  getAll(): ExtendedEthnicityPresetDefinition[] {
    return Object.values(EXTENDED_ETHNICITY_DEFINITIONS)
  },

  /**
   * 获取指定预设
   */
  getPreset(id: string): ExtendedEthnicityPresetDefinition | undefined {
    return EXTENDED_ETHNICITY_DEFINITIONS[id]
  },

  /**
   * 搜索预设
   */
  searchPresets(keyword: string): ExtendedEthnicityPresetDefinition[] {
    const kw = keyword.toLowerCase()
    return Object.values(EXTENDED_ETHNICITY_DEFINITIONS).filter(
      (preset) =>
        preset.label.toLowerCase().includes(kw) ||
        preset.en.toLowerCase().includes(kw) ||
        (preset.description && preset.description.toLowerCase().includes(kw)) ||
        (preset.tags && preset.tags.some((tag) => tag.toLowerCase().includes(kw)))
    )
  }
}
