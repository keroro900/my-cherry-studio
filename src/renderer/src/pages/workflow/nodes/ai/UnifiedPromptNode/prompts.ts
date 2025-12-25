/**
 * 统一提示词节点 - 系统提示词模板 v4.0
 * Unified Prompt Node - System Prompt Templates v4.0
 *
 * 三种输出模式：
 * - model: 模特图（让模特穿上服装）
 * - pattern: 图案提示词（提取/生成图案）
 * - ecom: 电商图（平铺图/挂拍图）
 *
 * v4.0 深度优化：
 * - RE-CREATION 概念（提取细节，重新设计摆放）
 * - 主题匹配背景（主题服装不要用纯白背景）
 * - 专业服装造型规则
 * - 所有提示词使用纯英文
 *
 * 【重要】核心提示词常量统一从 prompts/core 导入
 * 本文件只保留构建函数和节点特定逻辑
 */

// ==================== 从统一预设模块导入（Single Source of Truth）====================
// 所有预设从 presets/ 模块导入，确保 UI 和提示词构建的一致性
import {
  // 预设注册表
  AGE_PRESETS,
  ETHNICITY_PRESETS,
  FILL_MODE_PRESETS,
  GENDER_PRESETS,
  LAYOUT_PRESETS,
  PATTERN_STYLE_PRESETS,
  PATTERN_TYPE_PRESETS,
  POSE_PRESETS,
  // 解析函数（处理 random 和标准化）
  resolveAgeGroup,
  resolveEthnicity,
  resolveGender,
  resolvePlatformStyle,
  resolvePose,
  resolveScene,
  resolveStyleMode,
  SCENE_PRESETS,
  STYLE_MODE_PRESETS
} from '../../../presets'
import type { UnifiedPromptNodeConfig } from './types'

// ==================== 导出下拉选项列表（用于配置表单）====================
// 使用注册表的 getOptions() 方法自动生成选项列表

/** 年龄段选项列表 */
export const AGE_OPTIONS = AGE_PRESETS.getOptions()

/** 性别选项列表 */
export const GENDER_OPTIONS = GENDER_PRESETS.getOptions()

/** 场景选项列表 */
export const SCENE_OPTIONS = SCENE_PRESETS.getOptions()

/** 人种选项列表 */
export const ETHNICITY_OPTIONS = ETHNICITY_PRESETS.getOptions()

/** 姿态选项列表 */
export const POSE_OPTIONS = POSE_PRESETS.getOptions()

/** 风格模式选项列表 */
export const STYLE_MODE_OPTIONS = STYLE_MODE_PRESETS.getOptions()

/** 图案类型选项列表 */
export const PATTERN_TYPE_OPTIONS = PATTERN_TYPE_PRESETS.getOptions()

/** 图案风格选项列表 */
export const PATTERN_STYLE_OPTIONS = PATTERN_STYLE_PRESETS.getOptions()

/** 布局模式选项列表（电商图用）*/
export const LAYOUT_MODE_OPTIONS = LAYOUT_PRESETS.getOptions()

/** 填充模式选项列表（电商图用）*/
export const FILL_MODE_OPTIONS = FILL_MODE_PRESETS.getOptions()

/** 展示模式选项列表 */
export const DISPLAY_MODE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机展示模式' },
  { id: 'flat_lay', name: '平铺图', description: 'Top-down flat lay display' },
  { id: 'hanger', name: '挂拍图', description: 'Hanger suspended display' },
  { id: 'scene', name: '场景造型', description: 'Theme scene display' },
  { id: 'model', name: '模特展示', description: 'Model wearing display' }
]

/** 平台风格选项列表 */
export const PLATFORM_STYLE_OPTIONS = [
  { id: 'random', name: '随机选择', description: '随机平台风格' },
  { id: 'shein', name: 'SHEIN', description: 'Young, fashionable lifestyle style' },
  { id: 'temu', name: 'TEMU', description: 'Value-focused practical style' },
  { id: 'amazon', name: 'Amazon', description: 'Professional standard style' },
  { id: 'taobao', name: '淘宝', description: 'Detailed showcase style' },
  { id: 'xiaohongshu', name: '小红书', description: 'Aesthetic lifestyle style' }
]

// ==================== 向后兼容的别名导出 ====================
// 旧代码可能使用 _PRESETS 后缀，这里创建别名
export {
  AGE_PRESETS,
  ETHNICITY_PRESETS,
  FILL_MODE_PRESETS,
  GENDER_PRESETS,
  LAYOUT_PRESETS as LAYOUT_MODE_PRESETS,
  PATTERN_STYLE_PRESETS,
  PATTERN_TYPE_PRESETS,
  POSE_PRESETS,
  SCENE_PRESETS,
  STYLE_MODE_PRESETS
} from '../../../presets'

// 别名（保持旧的命名约定）
export const DISPLAY_MODE_PRESETS = DISPLAY_MODE_OPTIONS
export const PLATFORM_STYLE_PRESETS = PLATFORM_STYLE_OPTIONS

// ==================== 从统一核心模块导入基础提示词 ====================
// 这是提示词系统的单一来源（Single Source of Truth）

import {
  HARD_JSON_OUTPUT_CONSTRAINTS as CORE_HARD_JSON_OUTPUT_CONSTRAINTS,
  HARD_RULES as CORE_HARD_RULES,
  PROFESSIONAL_STYLING_RULES as CORE_PROFESSIONAL_STYLING_RULES,
  RECREATION_CONCEPT as CORE_RECREATION_CONCEPT,
  SHEIN_TEMU_SWEET_STYLE as CORE_SHEIN_TEMU_SWEET_STYLE,
  THEME_BACKGROUND_RULES as CORE_THEME_BACKGROUND_RULES
} from '../../../prompts/core'

// 重新导出核心常量，保持向后兼容
export const RECREATION_CONCEPT = CORE_RECREATION_CONCEPT
export const HARD_RULES = CORE_HARD_RULES
export const THEME_BACKGROUND_RULES = CORE_THEME_BACKGROUND_RULES
export const PROFESSIONAL_STYLING_RULES = CORE_PROFESSIONAL_STYLING_RULES
export const SHEIN_TEMU_SWEET_STYLE = CORE_SHEIN_TEMU_SWEET_STYLE
export const HARD_JSON_OUTPUT_CONSTRAINTS = CORE_HARD_JSON_OUTPUT_CONSTRAINTS

function withHardJsonConstraints(prompt: string): string {
  return `${prompt}\n\n${HARD_JSON_OUTPUT_CONSTRAINTS}`
}

// ==================== 构图和填充模式规则 ====================

/**
 * 按布局类型的构图规则
 *
 * flat_lay（平铺图）：
 * - 相机角度：正上方俯拍 90 度（鸟瞰视角）
 * - 三分法构图，服装略微偏离中心以留出道具空间
 * - 服装占画面约 70%
 * - 角落留空放置主题相关道具
 *
 * hanging（挂拍图）：
 * - 相机角度：平视正面，略微倾斜 5-10 度
 * - 简约木质或白色衣架
 * - 自然垂坠展示服装流动感和面料重量
 */
export const COMPOSITION_RULES = {
  flat_lay: `
[Flat Lay Composition]
- Camera angle: Top-down view at 90 degrees (bird's eye view)
- Rule of thirds composition, garment slightly off-center for prop space
- Garment fills approximately 70% of frame
- Leave corner spaces for theme-matched props
- Background surface flat and even (no wrinkles in backdrop)
- Garment professionally styled with slight natural angles (3-8 degrees)
`,
  hanging: `
[Hanging Shot Composition]
- Camera angle: Eye-level front view, slight angle (5-10 degrees)
- Simple wooden or minimalist white hanger
- Natural drape showing garment flow and fabric weight
- Proportions maintained, no stretching
- Clean simple background with theme-coordinated color
- Hanger should be subtle, not prominent
`
}

/**
 * 填充模式规则（3D 立体感 vs 自然平铺）
 *
 * filled（有填充 - Ghost Mannequin 效果）：
 * - 模拟专业隐形模特/中空模特摄影技术
 * - 想象服装穿在看不见的小孩身上，内部有空气或填充物支撑
 * - 身体、胸部、背部、肩部、袖子和裤腿都有三维体积
 * - 领口、袖口、裤脚必须有合理的内部阴影
 * - 服装不能看起来像纸片一样扁平
 *
 * flat（自然平铺 - 无填充）：
 * - 让服装自然平铺，没有强烈的内部填充
 * - 面料略显扁平但保持真实厚度
 * - 下摆、袖子、裤腿必须整理得非常平整顺滑
 * - 仍然要有面料厚度，不能像贴纸一样薄
 */
export const FILL_MODE_RULES = {
  filled: `
[Ghost Mannequin 3D Effect - Core Requirement]
Create visible internal volume and fullness, simulating professional ghost mannequin / invisible mannequin photography technique.
Imagine the garment worn by an invisible child, using tissue paper or crepe paper filling technique:
- Body, chest, back, shoulders, sleeves, and pant legs all have air or filling support inside
- Form soft, rounded three-dimensional volume, like real wearing posture
- Collar, cuffs, pant legs must show reasonable inner shadows (inner shadow effect)
- Clear outline and contact shadow between garment and background for depth perception
- Garment must NOT look paper-flat, must have lift-off effect from background
- Shoulders and chest should have natural bulge forming ergonomic 3D contour
`,
  flat: `
[Natural Flat Lay Mode - No Filling]
- Let garment lay naturally flat without strong internal filling
- Fabric appears slightly flat but maintain realistic thickness
- Hem, sleeves, pant legs must be arranged very neatly and smoothly
- Still must have fabric thickness - cannot look paper-thin like a sticker
- Clean professional retouching, clear silhouette lines
- Natural fabric drape without artificial puffiness
`
}

// ==================== 模特模式系统提示词 ====================

/**
 * 模特模式 - 日常/生活风格系统提示词
 * v4.0: RE-CREATION 概念 + 主题匹配背景
 *
 * 角色：专业儿童时尚摄影师 - SHEIN/TEMU "甜区" 风格专家
 * 任务：为童装电商创建真实感模特照片
 *
 * 核心要求：
 * 1. 100% 精确还原服装（颜色、图案、印花、文字）
 * 2. 真实感模特 - SHEIN/TEMU "可爱小孩" 标准
 * 3. 模特-服装协同（模特表情/姿态要匹配服装主题）
 * 4. 主题一致环境（背景必须与服装主题相关）
 * 5. 场景中的道具 - 生活感
 */
const MODEL_DAILY_PROMPT = `[Role: Professional Children's Fashion Photographer - SHEIN/TEMU Sweet Zone Specialist]
You create photorealistic model photos for children's clothing e-commerce, specializing in the "sweet zone" aesthetic popular on SHEIN and TEMU.

${RECREATION_CONCEPT}

[Reference Images - IMPORTANT]
- Image 1: TOP garment front view (must appear in the output)
- Image 2: BOTTOM garment front view (must appear in the output if provided)
- Image 3+: Back views, detail shots, or print references (for reference only, not additional garments)
Note: Each image contains a SINGLE garment piece. Top and bottom are provided separately.

[Input Analysis - CRITICAL FIRST STEP]
Before generating any prompt, carefully analyze the garment:
1. **Garment Type**: Identify if it's sleepwear/pajamas, sportswear, casual, formal, etc.
2. **Print/Pattern Theme**: Look for IP characters (Harry Potter, dinosaurs, unicorns, cars), sports motifs (soccer, basketball), sweet motifs (hearts, strawberries, bows)
3. **Color Palette**: Note dominant colors to coordinate with background and props
4. **Style Vibe**: Cute/kawaii, sporty/athletic, street/cool, sweet/romantic, magical/fantasy

${THEME_BACKGROUND_RULES}

${SHEIN_TEMU_SWEET_STYLE}

[Core Requirements - CRITICAL]
1. **EXACT GARMENT REPRODUCTION**
   - Every color, pattern, print, and text must be 100% faithful to the input
   - No modifications, no "improvements", no artistic interpretation
   - If the garment has a cartoon character, reproduce it EXACTLY - same pose, same expression
   - Fabric texture must match: cotton jersey, fleece, denim, etc.

2. **PHOTOREALISTIC MODEL - SHEIN/TEMU "Cute Kid" Standard**
   - Natural, adorable child who looks genuinely happy and comfortable
   - Candid expression - caught mid-smile or mid-laugh, not stiff posed
   - Real skin texture with natural childhood features (rosy cheeks, bright eyes)
   - No overly smooth, airbrushed, or doll-like appearance
   - Hair should look naturally styled, not salon-perfect

3. **MODEL-GARMENT SYNERGY**
   - Model's energy should MATCH the garment's theme:
     * Harry Potter pajamas → Curious, magical expression, maybe reading a spell book
     * Soccer pajamas → Playful, sporty kid, maybe kicking motion or soccer pose
     * Princess dress → Dreamy, happy girl, twirling or graceful pose
     * Dinosaur outfit → Adventurous, curious kid, maybe roaring or exploring
     * Sweet/cute print → Soft, gentle expression, hugging pose or shy smile

4. **THEME-COHERENT ENVIRONMENT - CRITICAL**
   - Background MUST relate to the garment's theme, NOT generic studio
   - Harry Potter theme → Magical study room, owls, spell books, candles, Hogwarts atmosphere
   - Soccer/Football theme → Living room with soccer posters, soccer balls on floor, green elements
   - Dinosaur theme → Bedroom with dino toys, prehistoric decorations, adventure books
   - Princess/Unicorn → Fairy-tale corner, sparkly decorations, soft pink/purple tones
   - General pajamas → Cozy bedroom, soft blankets, bedtime story books, plush toys

5. **PROPS IN SCENE - LIFESTYLE FEEL**
   - Child should naturally interact with theme-related props
   - Not holding props stiffly, but playing with them or near them
   - Props scattered naturally in the scene (on floor, on furniture)
   - Creates a "candid moment captured" feel

[Visual Quality Standards]
- iPhone photo aesthetic - looks like a parent captured a cute moment
- Natural window light preferred, soft and flattering
- Warm color temperature for indoor shots
- Slight depth of field (background softly blurred)
- No flash photography look

[Strict Prohibitions]
- Do NOT change any garment details from the input
- Do NOT create cartoon/illustration/anime style
- Do NOT use plain white/gray studio backgrounds for themed garments
- Do NOT add elements unrelated to the garment theme
- Do NOT over-beautify or smooth the model's skin
- Do NOT generate stiff, formal poses

**Output Format (CRITICAL)**:
- Output MUST be a single valid JSON object
- Do NOT wrap in markdown code fences
- Do NOT add explanations before or after
- Start with { and end with }
- Ensure valid JSON syntax for JSON.parse()`

/**
 * 模特模式 - 商业/目录风格系统提示词
 * 专业影棚级质量
 *
 * 角色：商业儿童时尚摄影师
 * 任务：为高端童装品牌创建目录级模特照片
 *
 * 核心要求：
 * 1. 100% 精确还原服装
 * 2. 专业模特展示 - 杂志级
 * 3. 影棚灯光卓越 - 三点布光
 * 4. 商业构图 + 主题考虑
 */
const MODEL_COMMERCIAL_PROMPT = `[Role: Commercial Children's Fashion Photographer]
You create high-end, catalog-grade model photos for premium children's clothing brands.

${RECREATION_CONCEPT}

[Reference Images - IMPORTANT]
- Image 1: TOP garment front view (must appear in the output)
- Image 2: BOTTOM garment front view (must appear in the output if provided)
- Image 3+: Back views, detail shots, or print references (for reference only, not additional garments)
Note: Each image contains a SINGLE garment piece. Top and bottom are provided separately.
Your task: Meticulously observe and reproduce ALL garment details with absolute precision

${HARD_RULES}

[Core Requirements - COMMERCIAL GRADE]
1. **EXACT GARMENT REPRODUCTION**
   - Every detail must be 100% faithful to the input
   - Colors must be accurate for commercial photography standards
   - Fabric texture and quality must be clearly visible

2. **PROFESSIONAL MODEL PRESENTATION**
   - Magazine-quality child model with polished appearance
   - Confident, professional posing suitable for catalogs
   - Clean, well-groomed styling appropriate for the garment
   - Model's look should still match the garment's theme/vibe

3. **STUDIO LIGHTING EXCELLENCE**
   - Professional three-point lighting setup
   - Soft key light with balanced fill
   - Minimal harsh shadows, even skin tones
   - Catchlights in eyes for professional portrait quality

4. **COMMERCIAL COMPOSITION WITH THEME CONSIDERATION**
   - Balanced, centered framing suitable for catalog crops
   - Background can be simple but should complement garment theme colors
   - Appropriate negative space for text overlays
   - Props minimal but theme-relevant if garment has strong theme

[Quality Standards]
- High-end e-commerce standard, catalog-ready
- Clean, professional, and polished appearance
- Consistent lighting across the garment
- Sharp focus on garment details

**Output Format (CRITICAL)**:
- Output MUST be a single valid JSON object
- Do NOT wrap in markdown code fences
- Do NOT add explanations before or after
- Start with { and end with }
- Ensure valid JSON syntax for JSON.parse()`

/**
 * 构建模特模式系统提示词
 *
 * @param config - 节点配置（包含 styleMode、scenePreset、constraintPrompt 等）
 * @returns 完整的系统提示词字符串
 *
 * 根据 styleMode 选择基础提示词：
 * - daily: 日常/生活风格（iPhone 抓拍美学）
 * - commercial: 商业/目录风格（专业影棚级）
 *
 * 根据 scenePreset 添加场景配置：
 * - home: 室内家居场景
 * - outdoor: 户外自然场景
 * - studio: 专业影棚
 */
export function buildModelSystemPrompt(config: UnifiedPromptNodeConfig): string {
  // 解析 styleMode，处理 random 和标准化
  const styleMode = resolveStyleMode(config.styleMode || 'daily')
  // commercial 模式使用商业提示词，其他模式使用日常模式作为基础
  const basePrompt = styleMode === 'commercial' ? MODEL_COMMERCIAL_PROMPT : MODEL_DAILY_PROMPT

  let fullPrompt = basePrompt

  /**
   * 风格模式修饰符
   *
   * 针对非 daily/commercial 的风格模式，追加特定的视觉风格指引。
   * 这些修饰符会叠加在基础提示词之上，微调输出的视觉效果。
   *
   * 支持的风格模式：
   * - celebrity: 明星同款 - 高端时尚编辑风格，锐利对比
   * - film: 胶片复古 - 颗粒感和怀旧色调，柔和高光
   * - japanese: 日系清新 - 过曝高光和空气感，极简构图
   * - cinematic: 电影宽幅 - 叙事构图和电影级调色
   */
  const styleModeModifiers: Record<string, string> = {
    celebrity: `
[Style Modifier: Celebrity Look / High-End Editorial]
- High-end fashion editorial atmosphere, fashionable poses
- Premium texture, sharp contrast and trendy composition
- Model should exude confidence and fashion-forward energy
- Lighting can be more dramatic with intentional shadows
- Consider magazine cover-worthy angles`,
    film: `
[Style Modifier: Film Vintage / Retro Aesthetic]
- Film-like nostalgic style with visible grain texture
- Soft, desaturated color tones
- Soft highlights and gentle shadows
- Vintage color palette similar to analog photography
- Slightly faded blacks and lifted shadows`,
    japanese: `
[Style Modifier: Japanese Fresh / Airy Style]
- Japanese ethereal refreshing aesthetic with overexposed highlights
- Oxygen-like brightness with clean whites
- Soft pastel color accents
- Minimalist, clean composition
- Light and airy atmosphere`,
    cinematic: `
[Style Modifier: Cinematic Widescreen / Narrative Style]
- Cinematic widescreen narrative composition
- Film-grade color grading with rich tones
- Narrative framing suggesting a story moment
- Widescreen aspect ratio composition hints
- Dramatic but natural lighting`
  }

  // 为非 daily/commercial 模式添加风格修饰符
  if (styleMode !== 'daily' && styleMode !== 'commercial' && styleModeModifiers[styleMode]) {
    fullPrompt += styleModeModifiers[styleMode]
  }

  /**
   * 场景配置表
   *
   * 每个场景包含6个视觉层次的描述（用于指导 AI 生成）：
   * - foreground: 前景元素描述
   * - midground: 中景环境描述
   * - background: 背景描述
   * - composition: 构图风格
   * - lighting: 光线条件
   * - visual_style: 视觉风格
   *
   * 支持的场景：
   * - home: 室内家居 - 温馨舒适的家庭环境
   * - outdoor: 户外场景 - 公园、操场等自然户外
   * - studio: 专业影棚 - 干净专业的摄影棚
   * - playground: 游乐场 - 色彩丰富的儿童游乐设施
   * - nature: 自然风景 - 森林、花海等自然景观
   * - beach: 海边度假 - 阳光沙滩的度假氛围
   * - urban: 城市街景 - 现代都市街拍风格
   * - campus: 校园青春 - 学校操场、教室等场景
   * - sakura: 樱花季节 - 浪漫的春日樱花场景
   * - gallery: 艺术画廊 - 精致的艺术展览空间
   *
   * 注意：提示词内容保持英文以确保 AI 生成效果
   */
  const sceneConfigs: Record<
    string,
    {
      foreground: string
      midground: string
      background: string
      composition: string
      lighting: string
      visual_style: string
    }
  > = {
    home: {
      foreground:
        'Natural living environment details like carpet texture, floor material, furniture edges. MUST include theme-related decorative elements.',
      midground:
        'Cozy indoor environment with sofa, windows, furniture. Soft lighting creates comfortable atmosphere. MUST include theme-related elements.',
      background:
        'Softly blurred indoor background with walls, artwork, bookshelves creating authentic home feel. MUST include theme-related decorations.',
      composition: 'iPhone-style smartphone photography, natural angle, slightly candid authentic perspective',
      lighting: 'Soft natural light from windows, warm ambient indoor light, no harsh shadows',
      visual_style: 'Authentic natural smartphone photo quality, slight film grain, natural color reproduction'
    },
    outdoor: {
      foreground:
        'Outdoor ground details like grass texture, pavement, steps. Include theme-related elements where appropriate.',
      midground: 'Park or playground environment with slides, swings, trees. Natural light and shadows.',
      background: 'Blurred outdoor background with buildings, sky, distant scenery',
      composition: 'iPhone-style outdoor photography, natural angle capturing child in outdoor activity',
      lighting: 'Natural daylight, can be bright sunshine or soft overcast light depending on mood',
      visual_style: 'Authentic outdoor photo quality, natural lighting variation, realistic skin texture'
    },
    studio: {
      foreground: 'Clean studio floor or backdrop, neat and professional',
      midground: 'Professional studio environment with soft even lighting',
      background:
        'Simple background, can be solid color or slightly blurred set. Color should complement garment theme.',
      composition: 'Professional studio shot, balanced composition highlighting garment and model',
      lighting: 'Soft studio lighting, evenly illuminating subject, minimal shadows, professional lighting setup',
      visual_style: 'High-quality professional photography, clean and sharp, accurate colors, e-commerce ready'
    },
    playground: {
      foreground: 'Playground safety surfacing, rubber mats, or colorful floor tiles',
      midground: 'Playground equipment like slides, swings, climbing frames. Cheerful atmosphere.',
      background: 'Colorful playground environment with blue sky, trees in distance',
      composition: 'Dynamic candid shot capturing playful energy and movement',
      lighting: 'Bright natural daylight, cheerful warm tones, minimal shadows',
      visual_style: 'Vibrant, energetic photo quality, capturing childhood joy and activity'
    },
    nature: {
      foreground: 'Natural ground elements like grass, fallen leaves, flower petals, small rocks',
      midground: 'Forest path, flower meadow, or natural landscape with vegetation',
      background: 'Blurred nature backdrop with trees, sky, distant mountains or fields',
      composition: 'Natural outdoor photography with organic framing and golden hour feel',
      lighting: 'Golden hour sunlight, warm and soft, dappled light through trees',
      visual_style: 'Warm, dreamy nature photography with soft bokeh and natural colors'
    },
    beach: {
      foreground: 'Sandy beach texture, shells, small beach toys, footprints in sand',
      midground: 'Beach scene with waves, beach umbrella, towels, sandcastle elements',
      background: 'Blue ocean horizon, clear sky, distant sailboats or palm trees',
      composition: 'Vacation-style photography with relaxed framing and summer vibe',
      lighting: 'Bright sunlight, golden reflections on water, warm beach atmosphere',
      visual_style: 'Warm, vibrant summer palette, beach vacation aesthetic'
    },
    urban: {
      foreground: 'Street textures like pavement, curb, urban ground details',
      midground: 'Contemporary buildings, street elements, cafes, shop windows',
      background: 'Modern city skyline, architectural elements, urban atmosphere',
      composition: 'Street style photography with trendy urban framing',
      lighting: 'Natural daylight with urban reflections, or evening neon glow',
      visual_style: 'Trendy, slightly high-contrast urban photography style'
    },
    campus: {
      foreground: 'Campus ground like brick paths, grass lawn, fallen leaves',
      midground: 'School buildings, lockers, sports fields, library steps',
      background: 'Academic buildings, campus trees, school yard atmosphere',
      composition: 'Youthful academic photography with fresh, energetic framing',
      lighting: 'Soft daylight, classroom or yard light, scholarly atmosphere',
      visual_style: 'Clean, friendly, academic photography tone'
    },
    sakura: {
      foreground: 'Fallen sakura petals on ground, grass, stone path',
      midground: 'Cherry blossom trees in full bloom, petals floating in air',
      background: 'Dreamy pink sakura canopy, soft sky, traditional elements',
      composition: 'Romantic spring photography with soft, dreamy framing',
      lighting: 'Soft golden hour or overcast soft light, pink-tinted ambiance',
      visual_style: 'Pastel, dreamy, romantic spring aesthetic'
    },
    gallery: {
      foreground: 'Clean gallery floor, minimal artistic elements',
      midground: 'White walls with artworks, minimalist sculptures, refined decor',
      background: 'Art gallery interior with sophisticated lighting and clean lines',
      composition: 'Aesthetic editorial photography with refined, artistic framing',
      lighting: 'Soft spot-lit highlights, gallery lighting ambiance',
      visual_style: 'Refined, sophisticated, editorial art photography'
    }
  }

  // 解析 scenePreset，处理 random 和标准化
  const scenePreset = resolveScene(config.scenePreset || 'home')
  const sceneConfig = sceneConfigs[scenePreset] || sceneConfigs.home

  fullPrompt += `

[Scene and Composition - ${scenePreset} style]
- **Foreground**: ${sceneConfig.foreground}
- **Midground**: ${sceneConfig.midground}
- **Background**: ${sceneConfig.background}
- **Composition**: ${sceneConfig.composition}
- **Lighting**: ${sceneConfig.lighting}
- **Visual Style**: ${sceneConfig.visual_style}`

  // NOTE: constraintPrompt 不再在此处自动嵌入
  // 改为在执行器中动态追加，确保配置表单修改始终生效

  return withHardJsonConstraints(fullPrompt)
}

/**
 * 构建模特模式用户提示词
 * Build Model Mode User Prompt
 *
 * 根据配置参数生成结构化的用户提示词，指导 AI 输出特定格式的 JSON
 *
 * 【配置项映射】
 * - ageGroup: 年龄段 → 决定模特年龄描述和岁数
 * - gender: 性别 → boy/girl 标签
 * - scenePreset: 场景预设 → 场景描述文字
 * - ethnicityPreset: 人种预设 → 人种描述文字
 * - posePreset: 姿态预设 → 姿态要求描述
 *
 * 【JSON 输出字段说明】
 * - type/version: 类型和版本标识
 * - age_years/gender/age_group: 模特基本信息
 * - ethnicity/appearance: 外貌描述
 * - subject: 服装详细描述（最重要！）
 * - garment_style/colors/patterns: 服装分类信息
 * - ip_character: IP 角色名（如有）
 * - scene_preset/foreground/midground/background: 场景分层描述
 * - pose/expression: 姿态和表情
 * - composition/visual_guidance: 构图和视觉指引
 * - color_tone/lighting_mood: 色调和光影氛围
 * - camera_params: 相机参数
 * - has_hat/has_mask: 是否有帽子/口罩
 * - ip_brand/ip_desc: 品牌/IP 信息
 * - hpsv3_score: HPS v3 评分（90-99）
 * - caption: 完整的图像生成提示词
 * - video_prompt: 视频生成提示词
 */
export function buildModelUserPrompt(config: UnifiedPromptNodeConfig): string {
  // 解析所有预设值，处理 random 和标准化
  const ageKey = resolveAgeGroup(config.ageGroup || 'small_kid')
  const ageLabelMap = {
    small_kid: '4-7 year old child',
    big_kid: '8-12 year old child',
    teen: '13-17 year old teenager',
    young_adult: '18-25 year old young adult',
    adult: 'adult',
    mature: '40+ year old adult'
  }
  const ageLabel = ageLabelMap[ageKey] || ageLabelMap.small_kid

  const ageYearsMap = {
    small_kid: 6,
    big_kid: 8,
    teen: 15,
    young_adult: 22,
    adult: 25,
    mature: 45
  }
  const ageYears = ageYearsMap[ageKey] || ageYearsMap.small_kid

  // 解析 gender，处理 random 和标准化
  const gender = resolveGender(config.gender || 'female')
  const genderLabel = gender === 'male' ? 'boy' : gender === 'female' ? 'girl' : 'kid'

  // 解析 scenePreset，处理 random 和标准化
  const sceneKey = resolveScene(config.scenePreset || 'home')
  // 场景标签映射 - 仅包含 sceneConfigs 中定义的有效场景
  const sceneLabelMap: Record<string, string> = {
    home: 'indoor home scene',
    outdoor: 'outdoor natural scene',
    studio: 'professional studio',
    playground: 'colorful children\'s playground',
    nature: 'natural forest setting',
    beach: 'beach vacation scene',
    urban: 'modern city street scene',
    campus: 'school campus scene',
    sakura: 'spring cherry blossom scene',
    gallery: 'art gallery aesthetic scene'
  }
  const sceneLabel = sceneLabelMap[sceneKey] || sceneLabelMap.home

  // 解析 ethnicityPreset，处理 random 和标准化
  const ethnicityKey = resolveEthnicity(config.ethnicityPreset || 'asian')
  const ethnicityLabelMap = {
    asian: 'Asian',
    caucasian: 'Caucasian/White',
    african_american: 'African American',
    hispanic: 'Hispanic/Latino',
    mixed: 'Mixed ethnicity',
    middle_eastern: 'Middle Eastern',
    south_asian: 'South Asian',
    south_east_asian: 'Southeast Asian',
    east_african: 'East African',
    east_european: 'Eastern European',
    north_european: 'Northern European',
    polynesian: 'Polynesian',
    native_american: 'Native American',
    mediterranean: 'Mediterranean'
  }
  const ethnicityLabel = ethnicityLabelMap[ethnicityKey] || ethnicityLabelMap.asian

  // 解析 posePreset，处理 random 和标准化
  const poseKey = resolvePose(config.posePreset || 'natural')
  const poseLabelMap = {
    natural: 'natural standing or walking, relaxed and authentic expression',
    sitting: 'naturally sitting or crouching, comfortable and relaxed',
    playing: 'playful or active pose, full of energy and childlike joy',
    walking: 'natural walking motion, casual stride',
    confident: 'confident pose, strong posture',
    editorial: 'editorial fashion pose, magazine-worthy',
    hands_on_hips: 'hands on hips, confident stance',
    cross_arms: 'arms crossed, cool vibe',
    looking_back: 'looking back over shoulder',
    running: 'running motion, dynamic energy',
    jumping: 'jumping pose, cheerful',
    leaning: 'leaning against object, relaxed posture'
  }
  const poseLabel = poseLabelMap[poseKey] || poseLabelMap.natural

  return `Analyze this garment image and generate a prompt for a ${ageLabel} ${genderLabel} model in a ${sceneLabel}.
Ethnicity preference: ${ethnicityLabel}
Pose requirement: ${poseLabel}

**IMPORTANT**:
- Carefully observe ALL patterns, text, IP characters on the garment - must reproduce exactly
- Infer model's appearance and hairstyle based on garment style
- Background decorations MUST be highly related to garment theme (e.g., Harry Potter → magical study room, Soccer → sports props)

**Output requirement**: Output pure JSON directly, no markdown code blocks, no extra text.

Output the following JSON structure (output directly without code block wrapper):
{
  "type": "model",
  "version": "2.0",
  "age_years": ${ageYears},
  "gender": "${gender}",
  "age_group": "${ageKey}",
  "ethnicity": "<ethnicity description in English>",
  "appearance": "<appearance description in English, including hair, skin, body type, inferred from garment style>",
  "subject": "<detailed garment description in English, including style, color, material, patterns, text, IP characters>",
  "garment_style": "<style category: cute/sporty/casual/formal/ip_theme>",
  "garment_colors": ["<color1>", "<color2>"],
  "garment_patterns": ["<pattern1>", "<pattern2>"],
  "ip_character": "<IP character name if present, or null>",
  "scene_preset": "${sceneKey}",
  "foreground": "<foreground description with theme-related decorations>",
  "midground": "<midground description with theme-related elements>",
  "background": "<background description with theme-related decorations>",
  "pose": "<pose description in English>",
  "expression": "<expression description in English>",
  "composition": "<composition description in English>",
  "visual_guidance": "<visual guidance in English>",
  "color_tone": "<color tone in English>",
  "lighting_mood": "<lighting mood in English>",
  "camera_params": "<camera parameters in English>",
  "has_hat": <boolean>,
  "has_mask": <boolean>,
  "ip_brand": "<brand name if recognizable, or null>",
  "ip_desc": "<brand/IP description if applicable>",
  "hpsv3_score": <number between 90 and 99>,
  "caption": "<complete image generation prompt in English, one paragraph, emphasizing garment accuracy and natural model>",
  "video_prompt": "<video generation prompt in English, describing gentle motion without turning around>"
}`
}

// ==================== 图案模式系统提示词 ====================
// PATTERN MODE SYSTEM PROMPTS

/**
 * 图案模式系统提示词
 * Pattern Mode System Prompt
 *
 * 【角色】专业纺织图案设计师
 * 【任务】为童装面料印花创建商业级无缝图案
 *
 * 【布局原则 - 关键】
 * 1. 有机散落布局（Organic Tossed Layout）
 *    - 多方向随机散布，无明显上下方向
 *    - 绝对不能有可见的网格、行、列
 *    - 混合大（主角）、中（配角）、小（填充）三种尺寸的元素
 *    - 间距自然变化，避免机械重复
 *
 * 2. 无缝拼贴要求（Seamless Tile Requirements）
 *    - 水平和垂直方向都必须完美无缝
 *    - 任何触及边缘的元素必须在对边精确延续
 *    - 边缘不能有接缝、边框、渐隐或晕影
 *
 * 3. 印花效果（Print Behavior）
 *    - 4x4 以上平铺时视觉密度感觉均衡
 *    - 元素保持可辨识但不过大
 *    - 图案应该像真实服装面料（约 5-8cm 元素比例）
 *
 * 【元素组成】
 * - 主角元素（大）：2-4 个主要角色/元素，约 30% 视觉权重
 * - 配角元素（中）：辅助元素，约 40% 视觉权重
 * - 微型填充（小）：点、星、小图标，约 30% 视觉权重
 *
 * 【配色和风格标准】
 * - 适合 4-12 岁儿童的配色
 * - 考虑性别但不刻板
 * - 高饱和度符合 SHEIN/TEMU 美学
 * - 干净矢量风格或柔和水彩风格（保持一致）
 *
 * 【质量标准】
 * - 印刷就绪，等效 300 DPI 细节
 * - 边缘干净，无锯齿
 * - 线条粗细一致
 * - 可分色
 *
 * 【禁止项】
 * - 不要创建网格状或明显重复的布局
 * - 元素不要过大（应该在实际面料上好看）
 * - 不要混合不兼容的风格（如像素艺术和水彩）
 * - 除非特别要求，不要包含文字
 */
const PATTERN_SYSTEM_PROMPT = `[Role: Expert Textile Pattern Designer]
You create commercial-grade seamless patterns for children's clothing fabric printing.

[Layout Principles - CRITICAL]
1. **ORGANIC TOSSED LAYOUT**
   - Multi-directional scattered arrangement (no clear 'up' or 'down')
   - Absolutely NO visible grid, rows, or columns
   - Mix of large (hero), medium (secondary), and small (filler) motifs
   - Natural variation in spacing - avoid mechanical repetition

2. **SEAMLESS TILE REQUIREMENTS**
   - Perfect horizontal AND vertical seamlessness
   - Any motif touching an edge MUST continue EXACTLY on the opposite edge
   - NO seams, borders, fade-outs, or vignettes at tile edges
   - Edge-wrapped motifs must align pixel-perfect across opposite edges

3. **PRINT BEHAVIOR**
   - Visual density must feel balanced when tiled 4x4 or larger
   - Motifs should remain readable but not oversized
   - Pattern should feel like real clothing fabric at ~5-8cm motif scale
   - Avoid obvious repetition or 'checkerboard' feel even at large tiling

[Motif Composition]
- **Hero Motifs (Large)**: 2-4 main characters/elements, ~30% of visual weight
- **Secondary Motifs (Medium)**: Supporting elements, ~40% of visual weight
- **Micro Fillers (Small)**: Dots, stars, tiny icons, ~30% of visual weight
- Fillers should bridge gaps WITHOUT creating obvious grids

[Color & Style Standards]
- Age-appropriate palettes for kids (4-12 years)
- Gender-considered but not stereotypical
- High saturation for SHEIN/TEMU aesthetic
- Clear, clean vector style OR soft watercolor style - be consistent

[Quality Standards]
- Print-ready, 300 DPI equivalent detail
- Clean edges, no anti-aliasing artifacts
- Consistent line weight throughout
- Color separation ready

[Strict Prohibitions]
- Do NOT create grid-based or obviously repeating layouts
- Do NOT make motifs too large (they should look good on actual fabric)
- Do NOT mix incompatible styles (e.g., pixel art with watercolor)
- Do NOT include text unless specifically requested

**Output Format (CRITICAL)**:
- Output MUST be a single valid JSON object
- Do NOT wrap in markdown code fences
- Do NOT add explanations before or after
- Start with { and end with }
- Ensure valid JSON syntax for JSON.parse()`

/**
 * 构建图案模式系统提示词
 * Build Pattern Mode System Prompt
 *
 * 根据配置参数动态拼接图案生成的系统提示词
 *
 * 【图案类型 patternType】
 * - seamless: 无缝拼贴图案（全身印花用）
 * - placement: 定位印花（胸前/背后单独图案）
 * - allover: 满印图案（有机非重复布局）
 *
 * 【图案风格 patternStyle】
 * - kawaii: 卡哇伊可爱风（大眼睛、柔和粉彩、Q版）
 * - sporty: 运动动感风（球类、数字、徽章、条纹）
 * - preppy: 学院风（校队字母、足球、篮球、条纹）
 * - ip_theme: IP角色主题（基于参考IP角色提取和混搭元素）
 * - sweet: 甜美浪漫风（花朵、爱心、蝴蝶结、蕾丝）
 * - geometric: 几何现代风（点、波浪线、色块、三角形）
 * - text: 字体排版风（字母、数字、符号、对话框）
 */
export function buildPatternSystemPrompt(config: UnifiedPromptNodeConfig): string {
  let fullPrompt = PATTERN_SYSTEM_PROMPT

  // 图案类型指引
  // Pattern type guidance
  const patternTypeGuide = {
    seamless: `[Pattern Type: Seamless Tileable]
- Generate a seamless tileable pattern suitable for all-over fabric printing.
- Tile must be perfectly seamless horizontally and vertically.
- Any motif touching an edge must continue exactly on the opposite edge.`,
    placement: `[Pattern Type: Placement Print]
- Generate a placement print design suitable for chest/front placement on garments.
- Single, centered composition with clean edges.
- Clean 2D vector / illustration style with crisp edges.
- Isolated on a pure white background.`,
    allover: `[Pattern Type: All-Over Print]
- Generate an all-over print pattern with organic, non-repeating layout.
- Multi-directional tossed layout with varied motif sizes.
- Balanced visual density when applied to full garment.`
  }[config.patternType || 'seamless']

  fullPrompt += `\n\n${patternTypeGuide}`

  // 风格指引
  // Style guidance
  if (config.patternStyle && config.patternStyle !== 'auto') {
    const styleGuide: Record<string, string> = {
      kawaii: `[Style: Kawaii Cute]
- Cute, adorable characters with big eyes, soft pastel colors, chibi style.
- Elements: bears, bunnies, puppies, snacks, tiny hearts.
- Colors: soft pastels with brown line art.
- Vibe: ultra-cute and gentle.`,
      sporty: `[Style: Sporty Dynamic]
- Dynamic, energetic, bold colors, athletic motifs.
- Elements: balls, numbers, badges, stripes, lightning bolts.
- Colors: red, blue, yellow, black, white.
- Vibe: fast, sporty and loud.`,
      preppy: `[Style: Preppy Varsity]
- Classic, collegiate, varsity letters, stripes, clean lines.
- Elements: varsity letters, footballs, basketballs, stripes.
- Colors: navy, red, grey, mustard.
- Vibe: athletic and classic.`,
      ip_theme: `[Style: IP Character Theme]
- Character-based, IP-inspired, recognizable mascots.
- Extract and remix motifs from the reference IP character.
- Match the style, line quality, coloring and mood exactly.
- Vibe: themed and cohesive.`,
      sweet: `[Style: Sweet Romantic]
- Romantic, feminine, flowers, hearts, ribbons.
- Elements: flowers, hearts, bows, sparkles, lace.
- Colors: blush, lilac, mint, pearl.
- Vibe: dreamy and elegant.`,
      geometric: `[Style: Geometric Modern]
- Abstract shapes, patterns, modern, clean.
- Elements: dots, squiggles, blocks, triangles, circles.
- Colors: limited muted palette or bold primaries.
- Vibe: clean, design-driven and calm.`,
      text: `[Style: Typography Focus]
- Typography-focused, slogans, letters, fonts.
- Elements: letters, numbers, symbols, speech bubbles.
- Colors: primaries with white or black.
- Vibe: smart and playful.`
    }
    fullPrompt += `\n\n${styleGuide[config.patternStyle] || ''}`
  }

  // NOTE: constraintPrompt 不再在此处自动嵌入
  // 改为在执行器中动态追加，确保配置表单修改始终生效

  return withHardJsonConstraints(fullPrompt)
}

/**
 * 构建图案模式用户提示词
 * Build Pattern Mode User Prompt
 *
 * 根据配置参数生成结构化的用户提示词，指导 AI 输出图案设计 JSON
 *
 * 【JSON 输出字段说明】
 * - type/version: 类型和版本标识
 * - pattern_style: 图案风格分类
 * - pattern_type: 图案类型（seamless/placement/allover）
 * - target_gender/target_age: 目标性别和年龄
 * - main_elements: 主要元素列表
 * - secondary_elements: 次要元素列表
 * - micro_fillers: 微型填充元素列表
 * - ip_character/ip_description: IP角色信息
 * - color_palette: 配色方案（十六进制）
 * - color_mood: 配色氛围（pastel/vibrant/muted/neon/earth/monochrome）
 * - background_color: 背景色
 * - density: 密度（sparse/medium/dense）
 * - layout: 布局方式（tossed/clustered/scattered/flowing/grid_broken）
 * - symmetry: 对称性（none/horizontal/vertical/radial/diagonal）
 * - scale: 元素尺寸（small/medium/large）
 * - line_style: 线条风格（clean_vector/hand_drawn/watercolor/pixel/3d）
 * - seamless_required: 是否需要无缝
 * - print_ready: 是否印刷就绪
 * - resolution_hint: 分辨率提示
 * - style_prompt: 风格描述提示词
 * - element_prompt: 元素描述提示词
 * - layout_prompt: 布局描述提示词
 * - color_prompt: 配色描述提示词
 * - technical_prompt: 技术要求提示词
 * - full_prompt: 完整的图案生成提示词
 * - hpsv3_score: HPS v3 评分（90-99）
 */
export function buildPatternUserPrompt(config: UnifiedPromptNodeConfig): string {
  // 修复：正确处理 unisex 性别，映射为 'kids'
  const genderLabel = config.gender === 'male' ? 'boys' : config.gender === 'female' ? 'girls' : 'kids'

  const ageKey = config.ageGroup || 'small_kid'
  // 修复：扩展 ageLabelMap 覆盖所有新增年龄段
  const ageLabelMap: Record<string, string> = {
    small_kid: '4-7',
    big_kid: '8-12',
    teen: '13-17',
    young_adult: '18-25',
    adult: 'adult',
    mature: '26+'
  }
  const ageLabel = ageLabelMap[ageKey] || ageLabelMap.small_kid
  const pt = (config as any).patternType
  const patternType = pt === 'random' ? 'seamless' : pt || 'seamless'

  // 修复：target_gender 正确处理 unisex (kids) 情况
  const targetGender = genderLabel === 'boys' ? 'boy' : genderLabel === 'kids' ? 'unisex' : 'girl'

  return `Analyze this reference image and extract pattern design information. Generate a pattern prompt for ${ageLabel} year old ${genderLabel} clothing.

**IMPORTANT**:
- Carefully observe pattern elements, colors, and style in the reference
- If there's an IP character, must identify and describe it
- Adjust output based on style constraints

**Output requirement**: Output pure JSON directly, no markdown code blocks, no extra text.

Output the following JSON structure (output directly without code block wrapper):
{
  "type": "pattern",
  "version": "2.0",
  "pattern_style": "<kawaii|sporty|preppy|ip_theme|sweet|geometric|text>",
  "pattern_type": "${patternType}",
  "target_gender": "${targetGender}",
  "target_age": "${ageLabel}",
  "main_elements": ["<element1>", "<element2>"],
  "secondary_elements": ["<element1>", "<element2>"],
  "micro_fillers": ["<filler1>", "<filler2>"],
  "ip_character": "<character name or null>",
  "ip_description": "<IP character description if applicable>",
  "color_palette": ["#XXXXXX", "#XXXXXX"],
  "color_mood": "<pastel|vibrant|muted|neon|earth|monochrome>",
  "background_color": "#XXXXXX",
  "density": "<sparse|medium|dense>",
  "layout": "<tossed|clustered|scattered|flowing|grid_broken>",
  "symmetry": "<none|horizontal|vertical|radial|diagonal>",
  "scale": "<small|medium|large>",
  "line_style": "<clean_vector|hand_drawn|watercolor|pixel|3d>",
  "seamless_required": ${patternType === 'seamless'},
  "print_ready": true,
  "resolution_hint": "1024x1024",
  "style_prompt": "<complete style description for pattern generation in English>",
  "element_prompt": "<detailed element description in English>",
  "layout_prompt": "<layout and composition description in English>",
  "color_prompt": "<color scheme description in English>",
  "technical_prompt": "<technical requirements for printing in English>",
  "full_prompt": "<complete pattern generation prompt combining all aspects in English>",
  "hpsv3_score": <number between 90 and 99>
}`
}

// ==================== 电商模式系统提示词 ====================
// E-COMMERCE MODE SYSTEM PROMPTS

/**
 * 电商模式系统提示词
 * E-commerce Mode System Prompt
 *
 * v4.0 深度优化版：RE-CREATION 概念 + 主题匹配背景 + 专业造型规则
 *
 * 【角色】专业童装电商摄影师和修图师 - SHEIN/TEMU 专家
 * 【任务】创建高质量的平铺图和挂拍图，用于童装电商主图
 *
 * 【核心要求 - 关键】
 * 1. 100% 忠实还原服装
 *    - 颜色、图案、印花、文字必须与输入完全一致
 *    - 不修改、不"改进"、不进行艺术演绎
 *    - IP 角色必须精确还原 - 相同姿势、颜色、表情
 *
 * 2. 专业重新造型的平铺/挂拍
 *    - 不要复制参考图的摆放 - 要专业重新造型
 *    - 干净、无褶皱的展示（去除运输褶皱）
 *    - 只保留自然的结构性褶皱
 *    - 服装占画面约 70%
 *    - 略微倾斜 3-8 度增加动感
 *
 * 3. 主题协调的背景和道具 - 关键差异点
 *    这是 SHEIN/TEMU 照片区别于普通产品图的关键：
 *    - 哈利波特主题：魔法书、猫头鹰、魔杖、羊皮卷、蜡烛
 *    - 足球主题：2-3 个不同大小的足球、迷你球门、草地元素
 *    - 恐龙主题：2-3 个恐龙玩具、绿植、小石头、冒险书籍
 *    - 公主/独角兽主题：闪亮魔杖、小皇冠、彩虹元素
 *    - 普通睡衣：配套毛绒玩具、柔软毯子背景、眼罩、床头书
 *
 * 4. 道具摆放规则
 *    - 道具放在角落和边缘，绝不遮挡服装
 *    - 对角线布局：左上到右下流动
 *    - 部分道具可以略微裁切在画面边缘（自然感）
 *    - 比例适当 - 道具看起来大小合理
 *    - 最多 3-5 个道具，不要过于拥挤
 *
 * 5. 光影和色彩
 *    - 柔和均匀的光线，阴影最小化
 *    - 温暖主题略微偏暖色温
 *    - 颜色准确（不过饱和）
 *    - 干净、明亮、专业的外观
 *
 * 【禁止项】
 * - 不要修改服装的设计、颜色或图案
 * - 主题服装不要用纯白无道具背景（只有极简纯色服装才用）
 * - 不要用无关/不相关的道具
 * - 不要道具过多
 * - 不要让道具重叠或遮挡服装
 * - 不要用刺眼的影棚灯光
 * - 不要复制参考图的摆放 - 必须专业重新造型
 */
const ECOM_SYSTEM_PROMPT = `[Role: Professional Kids' Clothing E-commerce Photographer and Retoucher - SHEIN/TEMU Specialist]
You create high-quality flat lay and hanging product photos for children's clothing e-commerce, specializing in SHEIN/TEMU professional product photography standards.

${RECREATION_CONCEPT}

${HARD_RULES}

${PROFESSIONAL_STYLING_RULES}

${THEME_BACKGROUND_RULES}

${SHEIN_TEMU_SWEET_STYLE}

[Input Analysis - CRITICAL FIRST STEP]
Before generating any prompt, carefully analyze the garment:
1. **Garment Type**: Is it a SET (top + bottom), single TOP, single BOTTOM, dress, or outerwear?
2. **Category**: Sleepwear/Pajamas, Sportswear, Casual, Formal, Loungewear?
3. **Print/Pattern Theme**: IP characters (Harry Potter, dinosaurs, unicorns), sports motifs, sweet motifs, geometric, solid?
4. **Color Palette**: Note dominant colors for background/prop coordination
5. **Material**: Cotton, fleece, denim, knit - affects how it should look filled/flat

[Core Requirements - CRITICAL]
1. **100% FAITHFUL GARMENT REPRODUCTION**
   - Every color, pattern, print, and text must be EXACTLY as input
   - NO modifications, NO "improvements", NO artistic interpretation
   - IP characters must be reproduced exactly - same pose, colors, expression
   - Fabric texture must be realistic and match the original

2. **PROFESSIONAL RE-STYLED FLAT LAY / HANGING**
   - DO NOT copy reference image positioning - professionally re-style
   - Clean, wrinkle-free presentation (remove shipping creases)
   - Keep only natural structural folds (sleeve bends, natural drape)
   - Garment fills the frame appropriately (~70% of image)
   - Proper proportions maintained - no stretching or distortion
   - Slight angles (3-8 degrees) for dynamic feel

3. **THEME-COHERENT BACKGROUND AND PROPS - THE KEY DIFFERENTIATOR**
   This is what makes SHEIN/TEMU photos stand out from generic product shots:

   **For Harry Potter/Wizarding themed garments**:
   - MUST include: Spell books, owls, magic wands, parchment scrolls, candles
   - Background: Dark wood desk, magical study room atmosphere, Hogwarts feel
   - Color scheme: Dark burgundy, gold, navy blue accents

   **For Soccer/Football themed garments**:
   - MUST include: 2-3 soccer balls of different sizes
   - Consider adding: Mini goal net, whistle, green grass mat accent, cone markers
   - Background: White/cream fuzzy blanket with grass elements OR green grass-like surface

   **For Dinosaur themed garments**:
   - MUST include: 2-3 plastic dinosaur toys (T-Rex, Triceratops, etc.)
   - Consider adding: Green leaves/plants, small rocks, adventure books
   - Background: Beige/cream fuzzy blanket with earthy accents

   **For Princess/Unicorn themed garments**:
   - MUST include: Sparkly wand, small crown, rainbow elements
   - Consider adding: Flowers, glitter accents, tulle fabric
   - Background: Soft pink or lavender fuzzy blanket

   **For General Sleepwear/Pajamas**:
   - MUST include: Matching plush toy (related to print theme), soft blanket as background
   - Consider adding: Eye mask, bedside book, small pillow
   - Background: Fluffy white or cream blanket, cozy bedroom feel

4. **PROP ARRANGEMENT RULES**
   - Props placed in corners and sides, NEVER covering the garment
   - Diagonal arrangement: top-left to bottom-right flow
   - Some props can be slightly cropped at frame edge (natural feel)
   - Scale appropriate - props should look realistic size
   - 3-5 props maximum, don't overcrowd

5. **LIGHTING & COLOR**
   - Soft, even lighting with minimal shadows
   - Slightly warm color temperature for cozy themes
   - Colors accurate to the garment (no oversaturation)
   - Clean, bright, professional appearance

[Strict Prohibitions]
- Do NOT modify the garment's design, colors, or patterns
- Do NOT use plain white background with NO props for themed garments (only for truly minimalist solid-color garments)
- Do NOT use generic/unrelated props
- Do NOT overcrowd with props
- Do NOT let props overlap or cover the garment
- Do NOT use harsh studio lighting
- Do NOT copy reference image positioning - must re-style professionally

**Output Format (CRITICAL)**:
- Output MUST be a single valid JSON object
- Do NOT wrap in markdown code fences
- Do NOT add explanations before or after
- Start with { and end with }
- Ensure valid JSON syntax for JSON.parse()`

/**
 * 构建电商模式系统提示词
 * Build E-commerce Mode System Prompt
 *
 * 根据配置参数动态拼接电商图生成的系统提示词
 *
 * 【布局模式 layoutMode】
 * - flat_lay: 平铺图（俯拍 90 度，服装自然平放在平面上）
 * - hanger: 挂拍图（正面平视，服装挂在衣架上自然垂坠）
 *
 * 【填充模式 fillMode】
 * - filled: 有填充（Ghost Mannequin 隐形模特效果，服装有立体感）
 * - flat: 自然平铺（无填充，面料略显扁平但保持厚度）
 *
 * 【平台风格 platformStyle】
 * - shein: SHEIN 风格（年轻时尚、Instagram 感、生活方式展示）
 * - temu: TEMU 风格（性价比展示、产品清晰可见、简洁但不无聊）
 * - amazon: Amazon 风格（干净专业、白底标准、产品为主）
 * - taobao: 淘宝风格（详细展示、生活场景融入、丰富道具组合）
 * - xiaohongshu: 小红书风格（审美驱动、博主风格、精致有品味）
 *
 * 【智能背景和道具规则】
 * 根据服装的颜色、图案、IP角色和整体风格氛围，自动决定场景和道具：
 * - IP 主题服装：必须设计与该 IP 角色风格和氛围相关的背景和道具
 * - 睡衣/家居服：使用毯子、床品或针织毯背景，配上与服装 IP 或图案相关的毛绒玩具和枕头
 * - 甜美/可爱风格：使用桌布、托盘、小甜点、水果、花朵作为道具
 * - 街头/运动风格：使用水泥地、木箱、铁丝网、工业风背景
 * - 极简/纯色风格：使用干净白墙或浅灰背景，道具最少（仅限真正的纯色服装）
 */
export function buildEcomSystemPrompt(config: UnifiedPromptNodeConfig): string {
  let fullPrompt = ECOM_SYSTEM_PROMPT

  // 布局模式指引
  // Layout mode guidance
  const layoutModeValue = config.layoutMode || 'none'
  const layoutModeGuide =
    layoutModeValue === 'none'
      ? `[Layout Mode: AI DECIDES]
You have creative freedom to choose the best layout based on garment type:
- For sets, casual items, sleepwear → Consider Flat Lay (top-down view)
- For dresses, formal items, outerwear → Consider Hanging Shot (front view on hanger)
- Analyze the garment and decide the optimal presentation
${COMPOSITION_RULES.flat_lay}
${COMPOSITION_RULES.hanging}`
      : layoutModeValue === 'random'
        ? `[Layout Mode: RANDOM - Will be chosen at execution]
Either Flat Lay or Hanging Shot will be randomly selected at generation time.
${COMPOSITION_RULES.flat_lay}
${COMPOSITION_RULES.hanging}`
        : {
            flat_lay: `[Layout Mode: Flat Lay]
${COMPOSITION_RULES.flat_lay}
- Re-style the garment into a SHEIN/TEMU style top-down flat lay e-commerce main image
- Camera shoots from directly above, entire outfit naturally laid on a flat surface
- Proportions normal, no stretching or distortion`,
            hanging: `[Layout Mode: Hanging Shot]
${COMPOSITION_RULES.hanging}
- Re-style the garment into a SHEIN/TEMU style hanger hanging e-commerce main image
- Entire outfit hung on wooden or minimalist hanger, front facing, naturally draping
- Proportions normal, no stretching or distortion`
          }[layoutModeValue] || ''

  fullPrompt += `\n\n${layoutModeGuide}`

  // 填充模式指引
  // Fill mode guidance
  const fillModeValue = config.fillMode || 'none'
  const fillModeGuide =
    fillModeValue === 'none'
      ? `[Fill Mode: AI DECIDES]
You have creative freedom to choose the best styling technique based on garment type:
- For structured garments (jackets, dresses, blazers) → Consider Ghost Mannequin for 3D volumetric effect
- For casual/soft garments (t-shirts, pajamas, knitwear) → Consider Natural Flat styling
- Analyze the garment and decide the optimal presentation
${FILL_MODE_RULES.filled}
${FILL_MODE_RULES.flat}`
      : fillModeValue === 'random'
        ? `[Fill Mode: RANDOM - Will be chosen at execution]
Either Ghost Mannequin (filled) or Natural Flat will be randomly selected at generation time.
${FILL_MODE_RULES.filled}
${FILL_MODE_RULES.flat}`
        : {
            filled: `[Fill Mode: Ghost Mannequin Effect]
${FILL_MODE_RULES.filled}`,
            flat: `[Fill Mode: Natural Flat]
${FILL_MODE_RULES.flat}`
          }[fillModeValue] || ''

  fullPrompt += `\n\n${fillModeGuide}`

  // 平台风格指引
  // Platform style guidance
  // 使用 resolvePlatformStyle 处理 random 值，确保不会拼接 undefined
  const resolvedPlatformStyle = resolvePlatformStyle(config.platformStyle || 'shein')
  const platformGuide = {
    shein: `[Platform Style: SHEIN]
- Young, fashionable, Instagram-worthy aesthetic appealing to young parents
- Background and props must be refined with atmosphere feel
- Overall style leans towards lifestyle showcase
- Theme-matched props are ESSENTIAL for themed garments`,
    temu: `[Platform Style: TEMU]
- Focus on value-for-money presentation, product clearly visible
- Practical display method highlighting the product itself
- Background simple but not boring
- Still include theme-relevant props for themed garments`,
    amazon: `[Platform Style: Amazon]
- Clean, professional, white background standard
- Product-focused, minimal distracting elements
- High clarity, details visible
- For themed garments, subtle theme-colored background acceptable`,
    taobao: `[Platform Style: Taobao]
- Detailed showcase, multiple angles consideration
- Life scene integration
- Rich prop combinations
- Theme-matched atmosphere creation`,
    xiaohongshu: `[Platform Style: Xiaohongshu/RED]
- Aesthetic-driven, lifestyle style showcase
- Influencer/blogger style presentation
- Refined, tasteful atmosphere
- Strong theme-coherent prop and background design`
  }[resolvedPlatformStyle]

  fullPrompt += `\n\n${platformGuide}`

  // 智能背景和道具规则
  // Smart background and prop rules
  fullPrompt += `

[Smart Background and Props Rules - AUTO-DETECT]
Based on garment's colors, patterns, IP characters and overall style atmosphere, automatically determine scene and props:
- **IP themed garments**: MUST design background and props according to that IP character's style and atmosphere, creating immersive IP feel
- **Sleepwear/Loungewear**: Use blankets, bedding or knit blanket background, paired with plush toys and pillows related to garment IP or pattern
- **Sweet/Cute style**: Use tablecloth, tray, small desserts, fruits, flowers as props
- **Street/Sports style**: Use concrete floor, wooden crates, wire mesh, industrial-style background
- **Minimalist/Solid color style**: Use clean white wall or light gray background with minimal props (ONLY for truly plain garments)

**Key Requirements**:
1. Background and props MUST highly match garment style and theme
2. Props must be reasonably placed, NEVER covering the garment main body
3. STRICTLY FORBIDDEN to change garment patterns - only change background and props
4. Reference images provide garment information only - positioning must be professionally re-designed`

  // NOTE: constraintPrompt 不再在此处自动嵌入
  // 改为在执行器中动态追加，确保配置表单修改始终生效

  return withHardJsonConstraints(fullPrompt)
}

/**
 * 构建电商模式用户提示词
 * Build E-commerce Mode User Prompt
 *
 * 根据配置参数生成结构化的用户提示词，指导 AI 输出电商图 JSON
 *
 * 【配置优先级】
 * - 'none' 保持为 'none'，让下游图片生成节点的 EcomPromptBuilder 处理 AI 自由发挥
 * - 'random' 保持为 'random'，让下游节点在执行时随机选择
 * - 其他值直接传递
 *
 * 【JSON 输出字段说明】
 * - type/version: 类型和版本标识
 * - layout_mode: 布局模式（none/flat_lay/hanging/random）
 * - fill_mode: 填充模式（none/filled/flat/random）
 * - platform_style: 平台风格
 * - garment_type: 服装类型（set/top/bottom/dress/outerwear/accessories）
 * - garment_style: 服装风格（cute/sporty/casual/formal/ip_theme/sleepwear/streetwear）
 * - garment_colors/patterns: 服装颜色和图案
 * - has_print/print_description: 是否有印花及描述
 * - ip_character/ip_description: IP角色信息
 * - background_type/color/material: 背景类型、颜色、材质
 * - suggested_props: 建议道具列表（与主题匹配）
 * - prop_placement: 道具摆放位置（corners/sides/scattered/minimal/none）
 * - prop_theme: 道具主题描述
 * - lighting_style: 光照风格（natural_soft/studio_even|warm_ambient/dramatic/flat）
 * - shadow_style: 阴影风格（minimal/soft/dramatic/none）
 * - composition: 构图方式
 * - garment_angle: 服装倾斜角度（0-45度）
 * - styling_notes: 造型注意事项（必须提及重新造型）
 * - background_prompt: 背景描述提示词（必须匹配服装主题）
 * - props_prompt: 道具描述提示词（必须与主题协调）
 * - lighting_prompt: 光照描述提示词
 * - composition_prompt: 构图和造型描述提示词
 * - full_prompt: 完整的电商图生成提示词（强调 RE-CREATION 概念）
 * - hpsv3_score: HPS v3 评分（90-99）
 */
export function buildEcomUserPrompt(config: UnifiedPromptNodeConfig): string {
  const lm = (config as any).layoutMode
  const fm = (config as any).fillMode
  const ps = (config as any).platformStyle

  // 'none' 保持为 'none'（AI 自由发挥）
  // 'random' 保持为 'random'（下游节点随机）
  // undefined/null 默认为 'none'
  const layoutMode = lm || 'none'
  const fillMode = fm || 'none'
  // 使用 resolvePlatformStyle 处理 random，随机选择平台风格
  const platformStyle = resolvePlatformStyle(ps)

  // 根据 layoutMode 生成描述标签
  const layoutLabel =
    layoutMode === 'none'
      ? 'product shot (AI decides best layout)'
      : layoutMode === 'random'
        ? 'product shot (randomly chosen layout)'
        : layoutMode === 'hanging'
          ? 'hanging shot'
          : 'flat lay'

  // 根据 fillMode 生成描述标签
  const fillLabel =
    fillMode === 'none'
      ? 'appropriate styling (AI decides)'
      : fillMode === 'random'
        ? 'appropriate styling (randomly chosen)'
        : fillMode === 'flat'
          ? 'natural flat (no filling)'
          : 'filled (Ghost Mannequin effect)'

  // 根据 layoutMode 生成 JSON 中的值和提示
  const layoutHint =
    layoutMode === 'none'
      ? '"layout_mode": "none", // AI decides the best layout based on garment type'
      : layoutMode === 'random'
        ? '"layout_mode": "random", // Will be randomly chosen at generation time'
        : `"layout_mode": "${layoutMode}",`

  // 根据 fillMode 生成 JSON 中的值和提示
  const fillHint =
    fillMode === 'none'
      ? '"fill_mode": "none", // AI decides the best styling technique based on garment'
      : fillMode === 'random'
        ? '"fill_mode": "random", // Will be randomly chosen at generation time'
        : `"fill_mode": "${fillMode}",`

  return `Analyze this garment image and generate a SHEIN/TEMU style e-commerce ${layoutLabel} prompt.
Fill mode: ${fillLabel}

**IMPORTANT - RE-CREATION CONCEPT**:
- Reference image provides garment DETAIL INFORMATION only (colors, patterns, prints, silhouette)
- You must PROFESSIONALLY RE-STYLE the garment positioning (do NOT copy reference layout)
- Background and props MUST be highly related to garment theme (e.g., Harry Potter pajamas → magical study room props, Soccer prints → soccer balls)
- Remove all messy wrinkles from reference, output professionally styled positioning

**Output requirement**: Output pure JSON directly, no markdown code blocks, no extra text.

Output the following JSON structure (output directly without code block wrapper):
{
  "type": "ecom",
  "version": "2.0",
  ${layoutHint}
  ${fillHint}
  "platform_style": "${platformStyle}",
  "garment_type": "<set|top|bottom|dress|outerwear|accessories>",
  "garment_style": "<cute|sporty|casual|formal|ip_theme|sleepwear|streetwear>",
  "garment_colors": ["<color1>", "<color2>"],
  "garment_patterns": ["<pattern1>", "<pattern2>"],
  "has_print": <boolean>,
  "print_description": "<print description if applicable>",
  "ip_character": "<IP character name if present, or null>",
  "ip_description": "<IP character description if applicable>",
  "background_type": "<white_fur|wood_texture|knit_fabric|colored_wall|gradient|studio_white|lifestyle_scene|blanket|bedding|magical_study|grass_surface>",
  "background_color": "<hex color or null>",
  "background_material": "<material description matching garment theme>",
  "suggested_props": ["<prop1 matching theme>", "<prop2 matching theme>"],
  "prop_placement": "<corners|sides|scattered|minimal|none>",
  "prop_theme": "<theme description matching garment style>",
  "lighting_style": "<natural_soft|studio_even|warm_ambient|dramatic|flat>",
  "shadow_style": "<minimal|soft|dramatic|none>",
  "composition": "<45_degree|top_down|front_straight|angled>",
  "garment_angle": <0-45>,
  "styling_notes": "<professional styling and arrangement notes - must mention re-styling from reference>",
  "background_prompt": "<detailed background description for image generation in English - must match garment theme>",
  "props_prompt": "<detailed props description in English - must be theme-coherent>",
  "lighting_prompt": "<detailed lighting description in English>",
  "composition_prompt": "<detailed composition and styling description in English>",
  "full_prompt": "<complete e-commerce photo generation prompt in English, combining all aspects, emphasizing RE-CREATION concept>",
  "hpsv3_score": <number between 90 and 99>
}`
}

// ==================== 全模式输出系统提示词 ====================
// ALL MODES OUTPUT SYSTEM PROMPTS

/**
 * 构建全模式系统提示词
 * Build All Modes System Prompt
 *
 * 【功能】一次性生成三种类型的提示词
 * 1. MODEL PROMPT - 用于生成穿着服装的模特照片
 * 2. PATTERN PROMPT - 用于生成相似的图案/印花
 * 3. ECOM PROMPT - 用于生成电商产品图
 *
 * 【输出格式】包含三个子对象的 JSON
 */
export function buildAllModesSystemPrompt(
  config: UnifiedPromptNodeConfig,
  overrides?: { model?: string; pattern?: string; ecom?: string }
): string {
  const modelPrompt = overrides?.model || buildModelSystemPrompt(config)
  const patternPrompt = overrides?.pattern || buildPatternSystemPrompt(config)
  const ecomPrompt = overrides?.ecom || buildEcomSystemPrompt(config)

  return `You are a comprehensive AI assistant for children's clothing e-commerce.
Your task is to analyze clothing images and generate THREE types of structured prompts:

1. MODEL PROMPT - For generating model photos wearing the garment
2. PATTERN PROMPT - For generating similar patterns/prints
3. ECOM PROMPT - For generating e-commerce product photos

${modelPrompt}

---

${patternPrompt}

---

${ecomPrompt}

Output must be a JSON object containing all three prompt types.

**Output Format Requirements (CRITICAL)**:
- You MUST output only a valid JSON object
- Do NOT use markdown code blocks (\`\`\`json or \`\`\`)
- Do NOT add any explanatory text before or after JSON
- Start directly with { and end with }
- Ensure JSON syntax is completely correct, parseable by JSON.parse()`
}

/**
 * 构建全模式用户提示词
 * Build All Modes User Prompt
 *
 * 生成一个包含 model、pattern、ecom 三个子 JSON 的用户提示词
 */
export function buildAllModesUserPrompt(
  config: UnifiedPromptNodeConfig,
  overrides?: { model?: string; pattern?: string; ecom?: string }
): string {
  const modelPrompt = overrides?.model || buildModelUserPrompt(config)
  const patternPrompt = overrides?.pattern || buildPatternUserPrompt(config)
  const ecomPrompt = overrides?.ecom || buildEcomUserPrompt(config)

  // Helper to extract JSON part if it matches the standard template
  const extractJsonPart = (p: string) => {
    const parts = p.split('Output the following JSON structure (output directly without code block wrapper):')
    if (parts.length > 1) return parts[1].trim()
    return p // Fallback if structure is different
  }

  return `Analyze this clothing image and generate all three types of prompts.

**Output requirement**: Output pure JSON directly, no markdown code blocks, no extra text.

Output the following JSON structure (output directly without code block wrapper):
{
  "type": "all",
  "version": "1.0",
  "model": ${extractJsonPart(modelPrompt)},
  "pattern": ${extractJsonPart(patternPrompt)},
  "ecom": ${extractJsonPart(ecomPrompt)}
}`
}
