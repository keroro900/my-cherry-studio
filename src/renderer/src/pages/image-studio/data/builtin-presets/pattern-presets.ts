/**
 * 图案模块内置预设
 * Pattern Module Builtin Presets
 */

import type { StudioPreset } from '../../types/preset-market'

/**
 * 图案模块内置预设列表
 */
export const PATTERN_PRESETS: StudioPreset[] = [
  // ============================================================================
  // 花卉图案预设
  // ============================================================================
  {
    id: 'pattern_floral_romantic',
    name: '浪漫花卉图案',
    nameEn: 'Romantic Floral Pattern',
    description: '浪漫风格的花卉无缝图案，适合女装/童装',
    descriptionEn: "Romantic style floral seamless pattern for women's/kids clothing",
    module: 'pattern',
    category: 'pattern_floral',
    tags: ['花卉', '浪漫', '无缝', '女装', 'floral', 'romantic', 'seamless'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'soft',
      stylePreset: 'romantic',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Romantic floral seamless pattern, soft pastel colors, roses and peonies, watercolor style, feminine aesthetic',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_floral_ditsy',
    name: '碎花小花图案',
    nameEn: 'Ditsy Floral Pattern',
    description: '密集碎花无缝图案，适合日常服装',
    descriptionEn: 'Dense ditsy floral pattern for everyday clothing',
    module: 'pattern',
    category: 'pattern_floral',
    tags: ['碎花', '小花', '密集', 'ditsy', 'floral', 'small'],
    config: {
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      density: 'dense',
      colorTone: 'bright',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Ditsy floral pattern, tiny scattered flowers, bright cheerful colors, vintage cottage style, seamless repeat',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_floral_tropical',
    name: '热带植物图案',
    nameEn: 'Tropical Botanical Pattern',
    description: '热带植物风格的图案，适合度假风服装',
    descriptionEn: 'Tropical botanical pattern for vacation wear',
    module: 'pattern',
    category: 'pattern_floral',
    tags: ['热带', '植物', '度假', 'tropical', 'botanical', 'vacation'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'bright',
      stylePreset: 'tropical',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Tropical botanical pattern, palm leaves and monstera, vibrant green and pink, Hawaiian vacation style, seamless tile',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 几何图案预设
  // ============================================================================
  {
    id: 'pattern_geometric_modern',
    name: '现代几何图案',
    nameEn: 'Modern Geometric Pattern',
    description: '现代简约风格的几何无缝图案',
    descriptionEn: 'Modern minimalist geometric seamless pattern',
    module: 'pattern',
    category: 'pattern_geometric',
    tags: ['几何', '现代', '简约', 'geometric', 'modern', 'minimal'],
    config: {
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'high_contrast',
      stylePreset: 'modern',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Modern geometric pattern, clean lines and shapes, bold contrast colors, Scandinavian minimalist style, seamless repeat',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_geometric_stripes',
    name: '条纹图案',
    nameEn: 'Stripe Pattern',
    description: '经典条纹图案，适合多种服装',
    descriptionEn: 'Classic stripe pattern for various clothing',
    module: 'pattern',
    category: 'pattern_geometric',
    tags: ['条纹', '经典', '简约', 'stripes', 'classic', 'simple'],
    config: {
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      density: 'sparse',
      colorTone: 'auto',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Classic stripe pattern, clean parallel lines, navy and white nautical style, timeless elegant design, seamless',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_geometric_retro',
    name: '复古几何图案',
    nameEn: 'Retro Geometric Pattern',
    description: '70年代复古风格的几何图案',
    descriptionEn: '70s retro style geometric pattern',
    module: 'pattern',
    category: 'pattern_geometric',
    tags: ['复古', '几何', '70年代', 'retro', 'vintage', '70s'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'auto',
      stylePreset: 'retro',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Retro 70s geometric pattern, groovy curves and circles, warm orange brown palette, vintage disco aesthetic, seamless tile',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 抽象图案预设
  // ============================================================================
  {
    id: 'pattern_abstract_watercolor',
    name: '水彩抽象图案',
    nameEn: 'Watercolor Abstract Pattern',
    description: '水彩风格的抽象艺术图案',
    descriptionEn: 'Watercolor style abstract art pattern',
    module: 'pattern',
    category: 'pattern_abstract',
    tags: ['水彩', '抽象', '艺术', 'watercolor', 'abstract', 'art'],
    config: {
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'soft',
      stylePreset: 'artistic',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Watercolor abstract pattern, soft flowing colors, artistic brush strokes, dreamy ethereal quality, seamless design',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_abstract_marble',
    name: '大理石纹理图案',
    nameEn: 'Marble Texture Pattern',
    description: '高端大理石纹理图案',
    descriptionEn: 'Premium marble texture pattern',
    module: 'pattern',
    category: 'pattern_abstract',
    tags: ['大理石', '纹理', '高端', 'marble', 'texture', 'luxury'],
    config: {
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      density: 'sparse',
      colorTone: 'auto',
      stylePreset: 'luxury',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Luxury marble texture, elegant veins and swirls, white gold accents, premium natural stone aesthetic, seamless tile',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 卡通图案预设
  // ============================================================================
  {
    id: 'pattern_cartoon_cute',
    name: '可爱卡通图案',
    nameEn: 'Cute Cartoon Pattern',
    description: '可爱风格的卡通图案，适合童装',
    descriptionEn: 'Cute cartoon pattern for kids clothing',
    module: 'pattern',
    category: 'pattern_cartoon',
    tags: ['卡通', '可爱', '童装', 'cartoon', 'cute', 'kids'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'bright',
      stylePreset: 'cute',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Cute cartoon pattern, adorable animals and characters, bright cheerful colors, kawaii style, seamless repeat for kids',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_cartoon_dinosaur',
    name: '恐龙图案',
    nameEn: 'Dinosaur Pattern',
    description: '可爱恐龙图案，适合男童装',
    descriptionEn: 'Cute dinosaur pattern for boys clothing',
    module: 'pattern',
    category: 'pattern_cartoon',
    tags: ['恐龙', '男童', '卡通', 'dinosaur', 'boys', 'cartoon'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'bright',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Cute dinosaur pattern, friendly cartoon dinos, green blue color palette, fun playful style, seamless for boys clothing',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_cartoon_unicorn',
    name: '独角兽图案',
    nameEn: 'Unicorn Pattern',
    description: '梦幻独角兽图案，适合女童装',
    descriptionEn: 'Dreamy unicorn pattern for girls clothing',
    module: 'pattern',
    category: 'pattern_cartoon',
    tags: ['独角兽', '女童', '梦幻', 'unicorn', 'girls', 'fantasy'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'soft',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Magical unicorn pattern, rainbow pastel colors, dreamy fantasy style, stars and sparkles, seamless for girls clothing',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },

  // ============================================================================
  // 季节性图案预设
  // ============================================================================
  {
    id: 'pattern_seasonal_christmas',
    name: '圣诞节图案',
    nameEn: 'Christmas Pattern',
    description: '圣诞节主题的节日图案',
    descriptionEn: 'Christmas themed holiday pattern',
    module: 'pattern',
    category: 'pattern_seasonal',
    tags: ['圣诞', '节日', '冬季', 'christmas', 'holiday', 'winter'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'bright',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Christmas holiday pattern, snowflakes trees reindeer, red green gold colors, festive cozy feel, seamless tile',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_seasonal_halloween',
    name: '万圣节图案',
    nameEn: 'Halloween Pattern',
    description: '万圣节主题的节日图案',
    descriptionEn: 'Halloween themed holiday pattern',
    module: 'pattern',
    category: 'pattern_seasonal',
    tags: ['万圣节', '节日', '秋季', 'halloween', 'holiday', 'autumn'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'dark',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Halloween pattern, pumpkins ghosts bats, orange purple black colors, spooky fun style, seamless repeat',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  },
  {
    id: 'pattern_seasonal_spring',
    name: '春季花园图案',
    nameEn: 'Spring Garden Pattern',
    description: '春季花园主题的清新图案',
    descriptionEn: 'Fresh spring garden themed pattern',
    module: 'pattern',
    category: 'pattern_seasonal',
    tags: ['春季', '花园', '清新', 'spring', 'garden', 'fresh'],
    config: {
      generationMode: 'mode_a',
      outputType: 'set',
      patternType: 'seamless',
      density: 'medium',
      colorTone: 'bright',
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    },
    promptTemplate:
      'Spring garden pattern, blooming flowers butterflies, fresh green pink colors, cheerful renewal theme, seamless design',
    source: 'builtin',
    usageCount: 0,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0'
  }
]
