/**
 * 提示词模板配置
 *
 * 内置中英文提示词模板，按类别组织
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface PromptTemplate {
  id: string
  name: string
  nameEn?: string
  category: PromptCategory
  prompt: string
  promptEn?: string
  negativePrompt?: string
  negativePromptEn?: string
  tags: string[]
  preview?: string // 预览图 URL
}

export type PromptCategory =
  | 'style' // 风格
  | 'subject' // 主题
  | 'lighting' // 光照
  | 'composition' // 构图
  | 'quality' // 质量增强
  | 'character' // 人物
  | 'scene' // 场景
  | 'custom' // 自定义

export interface PromptCategoryInfo {
  id: PromptCategory
  name: string
  nameEn: string
  icon: string
}

// ============================================================================
// 类别定义
// ============================================================================

export const PROMPT_CATEGORIES: PromptCategoryInfo[] = [
  { id: 'style', name: '风格', nameEn: 'Style', icon: '🎨' },
  { id: 'subject', name: '主题', nameEn: 'Subject', icon: '🖼️' },
  { id: 'lighting', name: '光照', nameEn: 'Lighting', icon: '💡' },
  { id: 'composition', name: '构图', nameEn: 'Composition', icon: '📐' },
  { id: 'quality', name: '质量', nameEn: 'Quality', icon: '✨' },
  { id: 'character', name: '人物', nameEn: 'Character', icon: '👤' },
  { id: 'scene', name: '场景', nameEn: 'Scene', icon: '🏞️' },
  { id: 'custom', name: '自定义', nameEn: 'Custom', icon: '⚙️' }
]

// ============================================================================
// 内置模板
// ============================================================================

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  // ==================== 风格模板 ====================
  {
    id: 'style-chinese-painting',
    name: '国画风格',
    nameEn: 'Chinese Painting',
    category: 'style',
    prompt: '中国传统水墨画风格，留白意境，写意笔触，宣纸质感，淡雅色调',
    promptEn:
      'Traditional Chinese ink painting style, artistic blank space, freehand brushwork, rice paper texture, elegant color tones',
    tags: ['国画', '水墨', '传统', '东方']
  },
  {
    id: 'style-anime',
    name: '日系动漫',
    nameEn: 'Anime Style',
    category: 'style',
    prompt: '日本动漫风格，精致的线条，明亮的色彩，大眼睛，细腻的阴影',
    promptEn: 'Japanese anime style, refined linework, vibrant colors, large expressive eyes, delicate shading',
    tags: ['动漫', '日系', '二次元']
  },
  {
    id: 'style-ghibli',
    name: '吉卜力风格',
    nameEn: 'Ghibli Style',
    category: 'style',
    prompt: '吉卜力工作室风格，温暖的色调，梦幻的氛围，细腻的背景，童话般的场景',
    promptEn: 'Studio Ghibli style, warm color palette, dreamy atmosphere, detailed backgrounds, fairytale-like scenes',
    tags: ['吉卜力', '宫崎骏', '动画']
  },
  {
    id: 'style-oil-painting',
    name: '油画风格',
    nameEn: 'Oil Painting',
    category: 'style',
    prompt: '古典油画风格，厚重的笔触，丰富的色彩层次，光影对比强烈，画布质感',
    promptEn:
      'Classical oil painting style, thick brushstrokes, rich color layers, strong light and shadow contrast, canvas texture',
    tags: ['油画', '古典', '艺术']
  },
  {
    id: 'style-watercolor',
    name: '水彩风格',
    nameEn: 'Watercolor',
    category: 'style',
    prompt: '水彩画风格，透明的色彩，柔和的边缘，自然的晕染效果，清新淡雅',
    promptEn: 'Watercolor style, transparent colors, soft edges, natural bleeding effects, fresh and elegant',
    tags: ['水彩', '清新', '艺术']
  },
  {
    id: 'style-cyberpunk',
    name: '赛博朋克',
    nameEn: 'Cyberpunk',
    category: 'style',
    prompt: '赛博朋克风格，霓虹灯光，未来都市，高科技低生活，雨夜氛围，紫色和青色色调',
    promptEn:
      'Cyberpunk style, neon lights, futuristic cityscape, high-tech low-life, rainy night atmosphere, purple and cyan tones',
    tags: ['赛博朋克', '未来', '科幻']
  },
  {
    id: 'style-pixel-art',
    name: '像素艺术',
    nameEn: 'Pixel Art',
    category: 'style',
    prompt: '像素艺术风格，复古游戏画面，8位色彩，清晰的像素边缘，怀旧感',
    promptEn: 'Pixel art style, retro game graphics, 8-bit colors, crisp pixel edges, nostalgic feel',
    tags: ['像素', '复古', '游戏']
  },
  {
    id: 'style-3d-cartoon',
    name: '3D卡通',
    nameEn: '3D Cartoon',
    category: 'style',
    prompt: '3D卡通渲染风格，皮克斯动画质感，圆润的造型，鲜艳的色彩，柔和的光照',
    promptEn: '3D cartoon rendering style, Pixar animation quality, rounded shapes, vibrant colors, soft lighting',
    tags: ['3D', '卡通', '皮克斯']
  },

  // ==================== 质量增强模板 ====================
  {
    id: 'quality-masterpiece',
    name: '大师级质量',
    nameEn: 'Masterpiece Quality',
    category: 'quality',
    prompt: '杰作，最高质量，超高分辨率，精细细节，专业摄影，8K',
    promptEn: 'masterpiece, best quality, ultra high resolution, fine details, professional photography, 8K',
    negativePrompt: '低质量，模糊，噪点，变形，水印',
    negativePromptEn: 'low quality, blurry, noise, deformed, watermark',
    tags: ['质量', '高清', '专业']
  },
  {
    id: 'quality-photorealistic',
    name: '照片级真实',
    nameEn: 'Photorealistic',
    category: 'quality',
    prompt: '照片级真实感，超写实，精细的皮肤纹理，自然光照，景深效果，RAW照片',
    promptEn: 'photorealistic, hyperrealistic, fine skin texture, natural lighting, depth of field, RAW photo',
    negativePrompt: '卡通，绘画，插画，CG，3D渲染',
    negativePromptEn: 'cartoon, painting, illustration, CG, 3D render',
    tags: ['写实', '照片', '真实']
  },
  {
    id: 'quality-cinematic',
    name: '电影级画面',
    nameEn: 'Cinematic',
    category: 'quality',
    prompt: '电影级画面，宽银幕比例，电影调色，戏剧性光照，景深，镜头光晕',
    promptEn:
      'cinematic shot, widescreen aspect ratio, film color grading, dramatic lighting, depth of field, lens flare',
    tags: ['电影', '大片', '专业']
  },

  // ==================== 光照模板 ====================
  {
    id: 'lighting-golden-hour',
    name: '黄金时刻',
    nameEn: 'Golden Hour',
    category: 'lighting',
    prompt: '黄金时刻光照，温暖的阳光，长影子，金色光芒，日落氛围',
    promptEn: 'golden hour lighting, warm sunlight, long shadows, golden glow, sunset atmosphere',
    tags: ['光照', '日落', '温暖']
  },
  {
    id: 'lighting-studio',
    name: '影棚灯光',
    nameEn: 'Studio Lighting',
    category: 'lighting',
    prompt: '专业影棚灯光，三点布光，柔光箱，干净的背景，均匀的照明',
    promptEn: 'professional studio lighting, three-point lighting, softbox, clean background, even illumination',
    tags: ['影棚', '专业', '人像']
  },
  {
    id: 'lighting-dramatic',
    name: '戏剧性光照',
    nameEn: 'Dramatic Lighting',
    category: 'lighting',
    prompt: '戏剧性光照，强烈的明暗对比，伦勃朗光，侧光，神秘氛围',
    promptEn: 'dramatic lighting, strong chiaroscuro, Rembrandt lighting, side light, mysterious atmosphere',
    tags: ['戏剧', '对比', '艺术']
  },
  {
    id: 'lighting-neon',
    name: '霓虹灯光',
    nameEn: 'Neon Lighting',
    category: 'lighting',
    prompt: '霓虹灯光效果，彩色光源，反射，夜晚城市，紫色和粉色光芒',
    promptEn: 'neon lighting effect, colorful light sources, reflections, night city, purple and pink glow',
    tags: ['霓虹', '夜景', '城市']
  },

  // ==================== 构图模板 ====================
  {
    id: 'composition-portrait',
    name: '人像特写',
    nameEn: 'Portrait Close-up',
    category: 'composition',
    prompt: '人像特写，面部细节，浅景深，背景虚化，眼神光',
    promptEn: 'portrait close-up, facial details, shallow depth of field, bokeh background, catchlight in eyes',
    tags: ['人像', '特写', '摄影']
  },
  {
    id: 'composition-wide-angle',
    name: '广角全景',
    nameEn: 'Wide Angle',
    category: 'composition',
    prompt: '广角镜头，全景视角，宏大场景，透视感强，环境展示',
    promptEn: 'wide angle lens, panoramic view, grand scene, strong perspective, environmental shot',
    tags: ['广角', '全景', '风景']
  },
  {
    id: 'composition-birds-eye',
    name: '鸟瞰视角',
    nameEn: "Bird's Eye View",
    category: 'composition',
    prompt: '鸟瞰视角，俯视角度，航拍效果，几何图案，城市规划',
    promptEn: "bird's eye view, overhead angle, aerial shot, geometric patterns, urban planning",
    tags: ['鸟瞰', '俯视', '航拍']
  },
  {
    id: 'composition-symmetry',
    name: '对称构图',
    nameEn: 'Symmetrical',
    category: 'composition',
    prompt: '完美对称构图，中心对称，镜像效果，平衡感，建筑摄影',
    promptEn: 'perfect symmetrical composition, central symmetry, mirror effect, balanced, architectural photography',
    tags: ['对称', '平衡', '建筑']
  },

  // ==================== 人物模板 ====================
  {
    id: 'character-beautiful-woman',
    name: '美丽女性',
    nameEn: 'Beautiful Woman',
    category: 'character',
    prompt: '美丽的年轻女性，精致的五官，自然妆容，优雅气质，柔和的表情',
    promptEn: 'beautiful young woman, delicate features, natural makeup, elegant temperament, soft expression',
    negativePrompt: '变形，丑陋，多余的肢体',
    negativePromptEn: 'deformed, ugly, extra limbs',
    tags: ['女性', '人像', '美丽']
  },
  {
    id: 'character-handsome-man',
    name: '帅气男性',
    nameEn: 'Handsome Man',
    category: 'character',
    prompt: '帅气的年轻男性，轮廓分明，自信的眼神，阳刚气质，整洁的外表',
    promptEn: 'handsome young man, defined features, confident gaze, masculine temperament, neat appearance',
    negativePrompt: '变形，丑陋，多余的肢体',
    negativePromptEn: 'deformed, ugly, extra limbs',
    tags: ['男性', '人像', '帅气']
  },

  // ==================== 场景模板 ====================
  {
    id: 'scene-fantasy-forest',
    name: '奇幻森林',
    nameEn: 'Fantasy Forest',
    category: 'scene',
    prompt: '奇幻森林场景，巨大的古树，发光的蘑菇，神秘的雾气，精灵的居所',
    promptEn: 'fantasy forest scene, giant ancient trees, glowing mushrooms, mysterious mist, elven dwelling',
    tags: ['奇幻', '森林', '魔法']
  },
  {
    id: 'scene-futuristic-city',
    name: '未来都市',
    nameEn: 'Futuristic City',
    category: 'scene',
    prompt: '未来都市景观，高耸的摩天大楼，飞行汽车，全息广告，科技感十足',
    promptEn:
      'futuristic cityscape, towering skyscrapers, flying cars, holographic advertisements, high-tech atmosphere',
    tags: ['未来', '城市', '科幻']
  },
  {
    id: 'scene-cozy-interior',
    name: '温馨室内',
    nameEn: 'Cozy Interior',
    category: 'scene',
    prompt: '温馨的室内场景，柔和的灯光，舒适的家具，绿植装饰，温暖的氛围',
    promptEn: 'cozy interior scene, soft lighting, comfortable furniture, plant decorations, warm atmosphere',
    tags: ['室内', '温馨', '家居']
  },
  {
    id: 'scene-underwater',
    name: '海底世界',
    nameEn: 'Underwater World',
    category: 'scene',
    prompt: '海底世界场景，珊瑚礁，热带鱼群，阳光透过水面，蓝色调',
    promptEn: 'underwater world scene, coral reef, tropical fish school, sunlight through water surface, blue tones',
    tags: ['海底', '水下', '自然']
  }
]

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 按类别获取模板
 */
export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.category === category)
}

/**
 * 搜索模板
 */
export function searchTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase()
  return BUILTIN_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.nameEn?.toLowerCase().includes(lowerQuery) ||
      t.prompt.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * 获取模板的本地化文本
 */
export function getLocalizedTemplate(
  template: PromptTemplate,
  locale: 'zh' | 'en' = 'zh'
): { name: string; prompt: string; negativePrompt?: string } {
  if (locale === 'en') {
    return {
      name: template.nameEn || template.name,
      prompt: template.promptEn || template.prompt,
      negativePrompt: template.negativePromptEn || template.negativePrompt
    }
  }
  return {
    name: template.name,
    prompt: template.prompt,
    negativePrompt: template.negativePrompt
  }
}

/**
 * 组合多个模板
 */
export function combineTemplates(templates: PromptTemplate[], separator = ', '): string {
  return templates.map((t) => t.prompt).join(separator)
}
