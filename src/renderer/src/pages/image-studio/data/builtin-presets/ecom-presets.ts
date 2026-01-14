/**
 * 电商模块内置预设
 * Ecom Module Builtin Presets
 */

import type { StudioPreset } from '../../types/preset-market'

/**
 * 电商模块内置预设列表
 */
export const ECOM_PRESETS: StudioPreset[] = [
  // ============================================================================
  // 童装类预设
  // ============================================================================
  {
    id: 'ecom_kids_flatlay_shein',
    name: '童装平铺 SHEIN 风',
    nameEn: 'Kids Clothing Flat Lay - SHEIN Style',
    description: '适合童装电商主图，SHEIN 风格的专业平铺拍摄效果',
    descriptionEn: 'Professional flat lay for kids clothing e-commerce, SHEIN style',
    module: 'ecom',
    category: 'kids_clothing',
    tags: ['童装', '平铺', 'SHEIN', '电商主图', 'flat lay', 'kids'],
    config: {
      layout: 'flat_lay',
      fillMode: 'filled',
      stylePreset: 'shein',
      imageSize: '2K',
      aspectRatio: '3:4',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    systemPrompt:
      '你是一位专业的童装电商摄影师，擅长 SHEIN 风格的平铺拍摄。你的作品以干净、明亮、专业著称，能够准确展示童装的设计细节和材质特点，帮助提升产品转化率。',
    userPrompt:
      "Professional flat lay photography of children's clothing on pure white background, soft even lighting, no shadows, clean and minimal style, SHEIN e-commerce aesthetic",
    promptTemplate:
      "Professional flat lay photography of children's clothing on pure white background, soft even lighting, no shadows, clean and minimal style, SHEIN e-commerce aesthetic",
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'ecom_kids_model_daily',
    name: '童装模特实拍 - 日常风',
    nameEn: 'Kids Model Shot - Daily Style',
    description: '童装模特实拍效果，自然日常风格',
    descriptionEn: 'Kids clothing model shot with natural daily style',
    module: 'ecom',
    category: 'kids_clothing',
    tags: ['童装', '模特', '日常', '实拍', 'model shot', 'kids'],
    config: {
      layout: 'model_shot',
      fillMode: 'filled',
      stylePreset: 'auto',
      imageSize: '2K',
      aspectRatio: '3:4',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    systemPrompt:
      '你是一位专业的儿童摄影师，擅长捕捉孩子自然可爱的瞬间。你的作品温馨、自然，能够完美展示童装的穿着效果，让家长产生购买欲望。',
    userPrompt:
      'Professional model photography of child wearing the clothing, natural indoor setting, soft window light, authentic and warm atmosphere',
    promptTemplate:
      'Professional model photography of child wearing the clothing, natural indoor setting, soft window light, authentic and warm atmosphere',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'ecom_kids_complete_set',
    name: '童装电商套图',
    nameEn: 'Kids E-commerce Complete Set',
    description: '包含主图、背面图、细节图的完整电商套图',
    descriptionEn: 'Complete e-commerce set including front, back, and detail shots',
    module: 'ecom',
    category: 'kids_clothing',
    tags: ['童装', '套图', '细节', '完整', 'complete set'],
    config: {
      layout: 'flat_lay',
      fillMode: 'filled',
      stylePreset: 'shein',
      imageSize: '2K',
      aspectRatio: '3:4',
      enableBack: true,
      enableDetail: true,
      detailTypes: ['collar', 'sleeve', 'texture'],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 成人服装预设
  // ============================================================================
  {
    id: 'ecom_adult_hanging',
    name: '成人服装悬挂图',
    nameEn: 'Adult Clothing Hanging Shot',
    description: '适合成人服装详情页的悬挂展示图',
    descriptionEn: 'Hanging display shot for adult clothing detail pages',
    module: 'ecom',
    category: 'adult_clothing',
    tags: ['成人', '悬挂', '详情页', 'hanging', 'adult'],
    config: {
      layout: 'hanging',
      fillMode: 'flat',
      stylePreset: 'minimal',
      imageSize: '2K',
      aspectRatio: '3:4',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Professional hanging shot of clothing on invisible hanger, pure white background, soft studio lighting, clean minimal aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'ecom_adult_premium',
    name: '高端服装产品图',
    nameEn: 'Premium Clothing Product Shot',
    description: '高端服装的精品产品图，适合奢侈品牌',
    descriptionEn: 'Premium product shot for luxury clothing brands',
    module: 'ecom',
    category: 'adult_clothing',
    tags: ['高端', '奢侈', '精品', 'premium', 'luxury'],
    config: {
      layout: 'flat_lay',
      fillMode: 'filled',
      stylePreset: 'premium',
      imageSize: '4K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Luxury fashion photography, premium fabric texture visible, sophisticated lighting, high-end editorial aesthetic, magazine quality',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'ecom_adult_temu',
    name: 'TEMU 风格产品图',
    nameEn: 'TEMU Style Product Shot',
    description: 'TEMU 平台风格的产品图',
    descriptionEn: 'Product shot in TEMU platform style',
    module: 'ecom',
    category: 'adult_clothing',
    tags: ['TEMU', '电商', '产品图', 'temu style'],
    config: {
      layout: 'flat_lay',
      fillMode: 'filled',
      stylePreset: 'temu',
      imageSize: '2K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 运动服装预设
  // ============================================================================
  {
    id: 'ecom_sportswear_action',
    name: '运动服装动感风',
    nameEn: 'Sportswear Action Style',
    description: '运动服装的动感展示风格',
    descriptionEn: 'Dynamic action style for sportswear',
    module: 'ecom',
    category: 'sportswear',
    tags: ['运动', '动感', '活力', 'sportswear', 'action'],
    config: {
      layout: 'model_shot',
      fillMode: 'filled',
      stylePreset: 'auto',
      imageSize: '2K',
      aspectRatio: '3:4',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Dynamic sportswear photography, energetic pose, bright studio lighting, clean athletic aesthetic, fitness lifestyle vibe',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 配饰类预设
  // ============================================================================
  {
    id: 'ecom_accessories_bag',
    name: '包包产品图',
    nameEn: 'Bag Product Shot',
    description: '包包、手袋的专业产品图',
    descriptionEn: 'Professional product shot for bags and handbags',
    module: 'ecom',
    category: 'accessories',
    tags: ['包包', '手袋', '配饰', 'bag', 'handbag', 'accessories'],
    config: {
      layout: 'none',
      fillMode: 'none',
      stylePreset: 'minimal',
      imageSize: '2K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Professional product photography of handbag, pure white background, studio lighting highlighting texture and details, luxury fashion aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 鞋履类预设
  // ============================================================================
  {
    id: 'ecom_footwear_sneaker',
    name: '运动鞋产品图',
    nameEn: 'Sneaker Product Shot',
    description: '运动鞋的专业产品摄影',
    descriptionEn: 'Professional product photography for sneakers',
    module: 'ecom',
    category: 'footwear',
    tags: ['鞋子', '运动鞋', '球鞋', 'sneaker', 'shoes', 'footwear'],
    config: {
      layout: 'none',
      fillMode: 'none',
      stylePreset: 'auto',
      imageSize: '2K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Professional sneaker photography, dynamic angle, clean white background, highlighting design details and materials, urban streetwear aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 食品类预设
  // ============================================================================
  {
    id: 'ecom_food_hero',
    name: '食品主图',
    nameEn: 'Food Hero Shot',
    description: '食品产品的主图摄影风格',
    descriptionEn: 'Hero shot style for food products',
    module: 'ecom',
    category: 'food',
    tags: ['食品', '美食', '主图', 'food', 'hero shot'],
    config: {
      layout: 'none',
      fillMode: 'none',
      stylePreset: 'auto',
      imageSize: '2K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Appetizing food photography, fresh and vibrant colors, soft natural lighting, mouth-watering presentation, clean modern aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 电子产品预设
  // ============================================================================
  {
    id: 'ecom_electronics_minimal',
    name: '电子产品极简风',
    nameEn: 'Electronics Minimal Style',
    description: '电子产品的极简风格产品图',
    descriptionEn: 'Minimal style product shot for electronics',
    module: 'ecom',
    category: 'electronics',
    tags: ['电子产品', '数码', '极简', 'electronics', 'minimal', 'tech'],
    config: {
      layout: 'none',
      fillMode: 'none',
      stylePreset: 'minimal',
      imageSize: '2K',
      aspectRatio: '1:1',
      enableBack: false,
      enableDetail: false,
      detailTypes: [],
      useSystemPrompt: true,
      professionalRetouch: true
    },
    promptTemplate:
      'Clean tech product photography, minimalist composition, soft gradient background, precise lighting highlighting product design, Apple-style aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  }
]
