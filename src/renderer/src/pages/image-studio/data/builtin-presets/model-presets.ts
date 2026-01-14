/**
 * 模特模块内置预设
 * Model Module Builtin Presets
 */

import type { StudioPreset } from '../../types/preset-market'

/**
 * 模特模块内置预设列表
 */
export const MODEL_PRESETS: StudioPreset[] = [
  // ============================================================================
  // 童装模特预设
  // ============================================================================
  {
    id: 'model_kids_small_asian',
    name: '小童模特 - 亚洲',
    nameEn: 'Toddler Model - Asian',
    description: '3-6岁亚洲小童模特，适合童装展示',
    descriptionEn: 'Asian toddler model (3-6 years) for kids clothing',
    module: 'model',
    category: 'kids_clothing',
    tags: ['小童', '亚洲', '模特', '3-6岁', 'toddler', 'asian'],
    config: {
      ageGroup: 'small_kid',
      gender: 'female',
      ethnicity: 'asian',
      ethnicityPreset: 'asian',
      scenePreset: 'indoor',
      poseStyle: 'natural',
      styleMode: 'daily',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Adorable 4-year-old Asian girl, natural smile, soft indoor lighting, wearing the clothing naturally, warm home setting',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_kids_big_asian',
    name: '大童模特 - 亚洲',
    nameEn: 'Older Kids Model - Asian',
    description: '7-12岁亚洲大童模特，适合童装展示',
    descriptionEn: 'Asian older kids model (7-12 years) for kids clothing',
    module: 'model',
    category: 'kids_clothing',
    tags: ['大童', '亚洲', '模特', '7-12岁', 'kids', 'asian'],
    config: {
      ageGroup: 'big_kid',
      gender: 'female',
      ethnicity: 'asian',
      ethnicityPreset: 'asian',
      scenePreset: 'indoor',
      poseStyle: 'natural',
      styleMode: 'daily',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Cheerful 9-year-old Asian girl, confident posture, natural expression, soft studio lighting, wearing the clothing elegantly',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_kids_small_caucasian',
    name: '小童模特 - 欧美',
    nameEn: 'Toddler Model - Caucasian',
    description: '3-6岁欧美小童模特',
    descriptionEn: 'Caucasian toddler model (3-6 years)',
    module: 'model',
    category: 'kids_clothing',
    tags: ['小童', '欧美', '模特', '3-6岁', 'toddler', 'caucasian'],
    config: {
      ageGroup: 'small_kid',
      gender: 'female',
      ethnicity: 'caucasian',
      ethnicityPreset: 'caucasian',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_kids_boy_outdoor',
    name: '男童户外模特',
    nameEn: 'Boys Outdoor Model',
    description: '男童户外场景模特图',
    descriptionEn: 'Boys model in outdoor setting',
    module: 'model',
    category: 'kids_clothing',
    tags: ['男童', '户外', '模特', 'boy', 'outdoor'],
    config: {
      ageGroup: 'big_kid',
      gender: 'male',
      ethnicity: 'asian',
      ethnicityPreset: 'asian',
      scenePreset: 'outdoor',
      poseStyle: 'natural',
      styleMode: 'daily',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Active 8-year-old Asian boy, playful outdoor setting, natural sunlight, energetic pose, wearing casual clothing',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 成人女装模特预设
  // ============================================================================
  {
    id: 'model_adult_female_asian',
    name: '成人女装模特 - 亚洲',
    nameEn: 'Adult Female Model - Asian',
    description: '亚洲成年女性模特，适合女装展示',
    descriptionEn: "Asian adult female model for women's clothing",
    module: 'model',
    category: 'adult_clothing',
    tags: ['成人', '女装', '亚洲', '模特', 'adult', 'female', 'asian'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'asian',
      ethnicityPreset: 'asian',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Elegant Asian woman in her 20s, professional model pose, studio lighting, wearing the clothing with grace and confidence',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_adult_female_caucasian',
    name: '成人女装模特 - 欧美',
    nameEn: 'Adult Female Model - Caucasian',
    description: '欧美成年女性模特，适合女装展示',
    descriptionEn: "Caucasian adult female model for women's clothing",
    module: 'model',
    category: 'adult_clothing',
    tags: ['成人', '女装', '欧美', '模特', 'adult', 'female', 'caucasian'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'caucasian',
      ethnicityPreset: 'caucasian',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_adult_female_editorial',
    name: '女装时尚大片风',
    nameEn: "Women's Fashion Editorial",
    description: '时尚杂志大片风格的女装展示',
    descriptionEn: "Fashion magazine editorial style for women's clothing",
    module: 'model',
    category: 'adult_clothing',
    tags: ['时尚', '大片', '女装', '杂志', 'fashion', 'editorial'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '4K',
      aspectRatio: '2:3'
    },
    promptTemplate:
      'High fashion editorial photography, dramatic lighting, confident model pose, Vogue magazine aesthetic, avant-garde styling',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 成人男装模特预设
  // ============================================================================
  {
    id: 'model_adult_male_asian',
    name: '成人男装模特 - 亚洲',
    nameEn: 'Adult Male Model - Asian',
    description: '亚洲成年男性模特，适合男装展示',
    descriptionEn: "Asian adult male model for men's clothing",
    module: 'model',
    category: 'adult_clothing',
    tags: ['成人', '男装', '亚洲', '模特', 'adult', 'male', 'asian'],
    config: {
      ageGroup: 'adult',
      gender: 'male',
      ethnicity: 'asian',
      ethnicityPreset: 'asian',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Stylish Asian man in his 20s, relaxed confident pose, clean studio background, wearing the clothing with modern appeal',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_adult_male_business',
    name: '男装商务风',
    nameEn: "Men's Business Style",
    description: '商务正装风格的男装展示',
    descriptionEn: "Business formal style for men's clothing",
    module: 'model',
    category: 'adult_clothing',
    tags: ['商务', '正装', '男装', '职业', 'business', 'formal'],
    config: {
      ageGroup: 'adult',
      gender: 'male',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Professional business portrait, confident executive pose, clean neutral background, sophisticated tailored clothing',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 运动服装模特预设
  // ============================================================================
  {
    id: 'model_sportswear_female',
    name: '女性运动服模特',
    nameEn: 'Female Sportswear Model',
    description: '女性运动服装的动感展示',
    descriptionEn: "Dynamic display for women's sportswear",
    module: 'model',
    category: 'sportswear',
    tags: ['运动', '健身', '女性', 'sportswear', 'fitness', 'female'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Athletic female model, dynamic fitness pose, energetic expression, bright studio lighting, activewear aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_sportswear_male',
    name: '男性运动服模特',
    nameEn: 'Male Sportswear Model',
    description: '男性运动服装的动感展示',
    descriptionEn: "Dynamic display for men's sportswear",
    module: 'model',
    category: 'sportswear',
    tags: ['运动', '健身', '男性', 'sportswear', 'fitness', 'male'],
    config: {
      ageGroup: 'adult',
      gender: 'male',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'outdoor',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Athletic male model, powerful fitness pose, outdoor training setting, natural sunlight, sportswear brand aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 内衣/泳装预设
  // ============================================================================
  {
    id: 'model_underwear_elegant',
    name: '内衣优雅风',
    nameEn: 'Underwear Elegant Style',
    description: '内衣的优雅展示风格',
    descriptionEn: 'Elegant style for underwear display',
    module: 'model',
    category: 'underwear',
    tags: ['内衣', '优雅', '女性', 'underwear', 'elegant', 'lingerie'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'studio',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Elegant lingerie photography, soft romantic lighting, tasteful and sophisticated pose, luxury brand aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'model_swimwear_beach',
    name: '泳装海滩风',
    nameEn: 'Swimwear Beach Style',
    description: '泳装的海滩场景展示',
    descriptionEn: 'Beach setting for swimwear display',
    module: 'model',
    category: 'underwear',
    tags: ['泳装', '海滩', '度假', 'swimwear', 'beach', 'vacation'],
    config: {
      ageGroup: 'adult',
      gender: 'female',
      ethnicity: 'mixed',
      ethnicityPreset: 'mixed',
      scenePreset: 'outdoor',
      poseStyle: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    },
    promptTemplate:
      'Tropical beach setting, golden hour lighting, relaxed vacation pose, crystal clear water background, summer vibes',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  }
]
