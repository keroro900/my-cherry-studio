/**
 * 提示词模板配置
 *
 * 内置中英文提示词模板，支持：
 * - 风格模板
 * - 主题模板
 * - 光影模板
 * - 构图模板
 * - 质量增强模板
 */

// ============================================================================
// 类型定义
// ============================================================================

export type PromptTemplateCategory = 'style' | 'subject' | 'lighting' | 'composition' | 'quality' | 'custom'

export interface PromptTemplate {
  id: string
  name: string
  nameEn?: string
  category: PromptTemplateCategory
  prompt: string
  promptEn?: string
  negativePrompt?: string
  negativePromptEn?: string
  tags: string[]
  icon?: string
  isBuiltIn: boolean
}

// ============================================================================
// 风格模板
// ============================================================================

export const STYLE_TEMPLATES: PromptTemplate[] = [
  {
    id: 'chinese-painting',
    name: '国画风格',
    nameEn: 'Chinese Painting',
    category: 'style',
    prompt: '中国传统水墨画风格，留白意境，写意笔触，宣纸质感，淡雅色调',
    promptEn:
      'Traditional Chinese ink painting style, artistic blank space, freehand brushwork, rice paper texture, elegant color tones',
    tags: ['国画', '水墨', '传统', '东方'],
    icon: '🎨',
    isBuiltIn: true
  },
  {
    id: 'anime',
    name: '日系动漫',
    nameEn: 'Anime Style',
    category: 'style',
    prompt: '日系动漫风格，精致的眼睛，柔和的色彩，细腻的线条，二次元',
    promptEn: 'Japanese anime style, detailed eyes, soft colors, delicate lines, 2D illustration',
    negativePrompt: '真实照片，3D渲染',
    negativePromptEn: 'realistic photo, 3D render',
    tags: ['动漫', '二次元', '日系'],
    icon: '🌸',
    isBuiltIn: true
  },
  {
    id: 'oil-painting',
    name: '油画风格',
    nameEn: 'Oil Painting',
    category: 'style',
    prompt: '古典油画风格，厚重的笔触，丰富的色彩层次，画布纹理，艺术感',
    promptEn: 'Classical oil painting style, thick brushstrokes, rich color layers, canvas texture, artistic',
    tags: ['油画', '古典', '艺术'],
    icon: '🖼️',
    isBuiltIn: true
  },
  {
    id: 'watercolor',
    name: '水彩风格',
    nameEn: 'Watercolor',
    category: 'style',
    prompt: '水彩画风格，透明感，色彩晕染，柔和边缘，清新淡雅',
    promptEn: 'Watercolor painting style, transparency, color bleeding, soft edges, fresh and elegant',
    tags: ['水彩', '清新', '淡雅'],
    icon: '💧',
    isBuiltIn: true
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    nameEn: 'Cyberpunk',
    category: 'style',
    prompt: '赛博朋克风格，霓虹灯光，未来科技感，暗色调，高对比度，雨夜城市',
    promptEn: 'Cyberpunk style, neon lights, futuristic technology, dark tones, high contrast, rainy night city',
    tags: ['赛博朋克', '未来', '科幻', '霓虹'],
    icon: '🌃',
    isBuiltIn: true
  },
  {
    id: 'ghibli',
    name: '吉卜力风格',
    nameEn: 'Ghibli Style',
    category: 'style',
    prompt: '吉卜力工作室风格，温暖的色调，细腻的背景，梦幻感，宫崎骏',
    promptEn: 'Studio Ghibli style, warm tones, detailed backgrounds, dreamy atmosphere, Miyazaki',
    tags: ['吉卜力', '宫崎骏', '动画'],
    icon: '🏰',
    isBuiltIn: true
  },
  {
    id: 'pixel-art',
    name: '像素艺术',
    nameEn: 'Pixel Art',
    category: 'style',
    prompt: '像素艺术风格，复古游戏感，8位色彩，清晰的像素边缘',
    promptEn: 'Pixel art style, retro game aesthetic, 8-bit colors, crisp pixel edges',
    tags: ['像素', '复古', '游戏'],
    icon: '👾',
    isBuiltIn: true
  },
  {
    id: 'minimalist',
    name: '极简主义',
    nameEn: 'Minimalist',
    category: 'style',
    prompt: '极简主义风格，简洁的线条，大面积留白，单色或双色调，现代感',
    promptEn: 'Minimalist style, clean lines, large white space, monochrome or duotone, modern',
    tags: ['极简', '现代', '简约'],
    icon: '⬜',
    isBuiltIn: true
  },
  {
    id: 'vintage',
    name: '复古风格',
    nameEn: 'Vintage',
    category: 'style',
    prompt: '复古风格，褪色效果，胶片质感，暖色调，怀旧氛围',
    promptEn: 'Vintage style, faded effect, film grain, warm tones, nostalgic atmosphere',
    tags: ['复古', '怀旧', '胶片'],
    icon: '📷',
    isBuiltIn: true
  },
  {
    id: '3d-cartoon',
    name: '3D卡通',
    nameEn: '3D Cartoon',
    category: 'style',
    prompt: '3D卡通风格，皮克斯风格，圆润的造型，鲜艳的色彩，可爱',
    promptEn: '3D cartoon style, Pixar style, rounded shapes, vibrant colors, cute',
    tags: ['3D', '卡通', '皮克斯'],
    icon: '🎬',
    isBuiltIn: true
  }
]

// ============================================================================
// 主题模板
// ============================================================================

export const SUBJECT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'portrait',
    name: '人像摄影',
    nameEn: 'Portrait Photography',
    category: 'subject',
    prompt: '专业人像摄影，精致的面部特征，自然的表情，柔和的背景虚化',
    promptEn: 'Professional portrait photography, refined facial features, natural expression, soft bokeh background',
    negativePrompt: '变形，模糊，低质量',
    negativePromptEn: 'deformed, blurry, low quality',
    tags: ['人像', '摄影', '肖像'],
    icon: '👤',
    isBuiltIn: true
  },
  {
    id: 'landscape',
    name: '风景摄影',
    nameEn: 'Landscape Photography',
    category: 'subject',
    prompt: '壮丽的自然风景，广角视角，丰富的层次，黄金时刻光线',
    promptEn: 'Magnificent natural landscape, wide angle view, rich layers, golden hour lighting',
    tags: ['风景', '自然', '摄影'],
    icon: '🏔️',
    isBuiltIn: true
  },
  {
    id: 'architecture',
    name: '建筑摄影',
    nameEn: 'Architecture Photography',
    category: 'subject',
    prompt: '现代建筑摄影，对称构图，几何线条，透视感，专业建筑摄影',
    promptEn:
      'Modern architecture photography, symmetrical composition, geometric lines, perspective, professional architectural photography',
    tags: ['建筑', '城市', '现代'],
    icon: '🏛️',
    isBuiltIn: true
  },
  {
    id: 'food',
    name: '美食摄影',
    nameEn: 'Food Photography',
    category: 'subject',
    prompt: '精美的美食摄影，诱人的色泽，精致的摆盘，浅景深',
    promptEn: 'Exquisite food photography, appetizing colors, elegant plating, shallow depth of field',
    tags: ['美食', '摄影', '餐饮'],
    icon: '🍽️',
    isBuiltIn: true
  },
  {
    id: 'product',
    name: '产品摄影',
    nameEn: 'Product Photography',
    category: 'subject',
    prompt: '专业产品摄影，干净的背景，精确的光影，商业品质',
    promptEn: 'Professional product photography, clean background, precise lighting, commercial quality',
    tags: ['产品', '商业', '电商'],
    icon: '📦',
    isBuiltIn: true
  },
  {
    id: 'fantasy-creature',
    name: '奇幻生物',
    nameEn: 'Fantasy Creature',
    category: 'subject',
    prompt: '奇幻生物设计，独特的造型，丰富的细节，神秘感，概念艺术',
    promptEn: 'Fantasy creature design, unique form, rich details, mysterious, concept art',
    tags: ['奇幻', '生物', '概念'],
    icon: '🐉',
    isBuiltIn: true
  }
]

// ============================================================================
// 光影模板
// ============================================================================

export const LIGHTING_TEMPLATES: PromptTemplate[] = [
  {
    id: 'golden-hour',
    name: '黄金时刻',
    nameEn: 'Golden Hour',
    category: 'lighting',
    prompt: '黄金时刻光线，温暖的阳光，柔和的阴影，金色光晕',
    promptEn: 'Golden hour lighting, warm sunlight, soft shadows, golden glow',
    tags: ['黄金时刻', '日落', '温暖'],
    icon: '🌅',
    isBuiltIn: true
  },
  {
    id: 'studio-lighting',
    name: '影棚灯光',
    nameEn: 'Studio Lighting',
    category: 'lighting',
    prompt: '专业影棚灯光，三点布光，柔光箱，干净的阴影',
    promptEn: 'Professional studio lighting, three-point lighting, softbox, clean shadows',
    tags: ['影棚', '专业', '布光'],
    icon: '💡',
    isBuiltIn: true
  },
  {
    id: 'dramatic',
    name: '戏剧光影',
    nameEn: 'Dramatic Lighting',
    category: 'lighting',
    prompt: '戏剧性光影，强烈的明暗对比，伦勃朗光，情绪感',
    promptEn: 'Dramatic lighting, strong contrast, Rembrandt lighting, moody',
    tags: ['戏剧', '对比', '情绪'],
    icon: '🎭',
    isBuiltIn: true
  },
  {
    id: 'backlight',
    name: '逆光效果',
    nameEn: 'Backlight',
    category: 'lighting',
    prompt: '逆光效果，轮廓光，光晕，剪影效果，梦幻感',
    promptEn: 'Backlight effect, rim light, lens flare, silhouette, dreamy',
    tags: ['逆光', '轮廓', '梦幻'],
    icon: '✨',
    isBuiltIn: true
  },
  {
    id: 'neon',
    name: '霓虹灯光',
    nameEn: 'Neon Lighting',
    category: 'lighting',
    prompt: '霓虹灯光效果，彩色光源，反射，夜景氛围',
    promptEn: 'Neon lighting effect, colorful light sources, reflections, night atmosphere',
    tags: ['霓虹', '夜景', '彩色'],
    icon: '🌈',
    isBuiltIn: true
  }
]

// ============================================================================
// 构图模板
// ============================================================================

export const COMPOSITION_TEMPLATES: PromptTemplate[] = [
  {
    id: 'rule-of-thirds',
    name: '三分法构图',
    nameEn: 'Rule of Thirds',
    category: 'composition',
    prompt: '三分法构图，主体位于交叉点，平衡的画面',
    promptEn: 'Rule of thirds composition, subject at intersection points, balanced frame',
    tags: ['三分法', '构图', '平衡'],
    icon: '📐',
    isBuiltIn: true
  },
  {
    id: 'symmetry',
    name: '对称构图',
    nameEn: 'Symmetrical Composition',
    category: 'composition',
    prompt: '完美对称构图，中心对称，镜像效果，庄重感',
    promptEn: 'Perfect symmetrical composition, center symmetry, mirror effect, solemn',
    tags: ['对称', '中心', '平衡'],
    icon: '⚖️',
    isBuiltIn: true
  },
  {
    id: 'leading-lines',
    name: '引导线构图',
    nameEn: 'Leading Lines',
    category: 'composition',
    prompt: '引导线构图，视觉引导，透视线条，深度感',
    promptEn: 'Leading lines composition, visual guidance, perspective lines, depth',
    tags: ['引导线', '透视', '深度'],
    icon: '↗️',
    isBuiltIn: true
  },
  {
    id: 'close-up',
    name: '特写镜头',
    nameEn: 'Close-up Shot',
    category: 'composition',
    prompt: '特写镜头，细节展示，浅景深，主体突出',
    promptEn: 'Close-up shot, detail showcase, shallow depth of field, prominent subject',
    tags: ['特写', '细节', '微距'],
    icon: '🔍',
    isBuiltIn: true
  },
  {
    id: 'birds-eye',
    name: '鸟瞰视角',
    nameEn: "Bird's Eye View",
    category: 'composition',
    prompt: '鸟瞰视角，俯视角度，全景展示，独特视角',
    promptEn: "Bird's eye view, overhead angle, panoramic display, unique perspective",
    tags: ['鸟瞰', '俯视', '全景'],
    icon: '🦅',
    isBuiltIn: true
  }
]

// ============================================================================
// 质量增强模板
// ============================================================================

export const QUALITY_TEMPLATES: PromptTemplate[] = [
  {
    id: 'high-quality',
    name: '高质量增强',
    nameEn: 'High Quality',
    category: 'quality',
    prompt: '超高清，8K分辨率，精细细节，专业摄影，获奖作品',
    promptEn: 'Ultra HD, 8K resolution, fine details, professional photography, award winning',
    negativePrompt: '低质量，模糊，噪点，压缩伪影',
    negativePromptEn: 'low quality, blurry, noise, compression artifacts',
    tags: ['高清', '质量', '专业'],
    icon: '⭐',
    isBuiltIn: true
  },
  {
    id: 'photorealistic',
    name: '照片级真实',
    nameEn: 'Photorealistic',
    category: 'quality',
    prompt: '照片级真实感，超写实，真实光影，自然纹理，RAW照片',
    promptEn: 'Photorealistic, hyperrealistic, realistic lighting, natural textures, RAW photo',
    negativePrompt: '卡通，绘画，插画，CG',
    negativePromptEn: 'cartoon, painting, illustration, CG',
    tags: ['真实', '写实', '照片'],
    icon: '📸',
    isBuiltIn: true
  },
  {
    id: 'artistic',
    name: '艺术感增强',
    nameEn: 'Artistic Enhancement',
    category: 'quality',
    prompt: '艺术感，美学构图，色彩和谐，视觉冲击力，大师作品',
    promptEn: 'Artistic, aesthetic composition, color harmony, visual impact, masterpiece',
    tags: ['艺术', '美学', '大师'],
    icon: '🎨',
    isBuiltIn: true
  },
  {
    id: 'cinematic',
    name: '电影感',
    nameEn: 'Cinematic',
    category: 'quality',
    prompt: '电影感，宽银幕比例，电影调色，景深效果，大片质感',
    promptEn: 'Cinematic, widescreen aspect ratio, film color grading, depth of field, blockbuster quality',
    tags: ['电影', '大片', '调色'],
    icon: '🎬',
    isBuiltIn: true
  }
]

// ============================================================================
// 导出所有模板
// ============================================================================

export const ALL_TEMPLATES: PromptTemplate[] = [
  ...STYLE_TEMPLATES,
  ...SUBJECT_TEMPLATES,
  ...LIGHTING_TEMPLATES,
  ...COMPOSITION_TEMPLATES,
  ...QUALITY_TEMPLATES
]

// 按分类获取模板
export function getTemplatesByCategory(category: PromptTemplateCategory): PromptTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category)
}

// 搜索模板
export function searchTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase()
  return ALL_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.nameEn?.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

// 获取模板的完整提示词（根据语言）
export function getTemplatePrompt(template: PromptTemplate, lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en' && template.promptEn ? template.promptEn : template.prompt
}

// 获取模板的反向提示词（根据语言）
export function getTemplateNegativePrompt(template: PromptTemplate, lang: 'zh' | 'en' = 'zh'): string | undefined {
  if (lang === 'en' && template.negativePromptEn) {
    return template.negativePromptEn
  }
  return template.negativePrompt
}

// 分类信息
export const CATEGORY_INFO: Record<PromptTemplateCategory, { name: string; nameEn: string; icon: string }> = {
  style: { name: '风格', nameEn: 'Style', icon: '🎨' },
  subject: { name: '主题', nameEn: 'Subject', icon: '📷' },
  lighting: { name: '光影', nameEn: 'Lighting', icon: '💡' },
  composition: { name: '构图', nameEn: 'Composition', icon: '📐' },
  quality: { name: '质量', nameEn: 'Quality', icon: '⭐' },
  custom: { name: '自定义', nameEn: 'Custom', icon: '✏️' }
}
