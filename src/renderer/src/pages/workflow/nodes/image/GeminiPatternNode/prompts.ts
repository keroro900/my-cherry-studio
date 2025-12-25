/**
 * GeminiPatternNode 专用提示词
 * Gemini Pattern Node Prompts
 *
 * 用于图案/印花生成的提示词模板
 *
 * 【功能】
 * - 无缝图案生成 (seamless)
 * - T恤大图设计 (graphic/placement)
 * - Mockup 贴图生成
 * - 平铺预览生成
 *
 * 【核心概念】
 * - 有机散落布局（无网格、无行列）
 * - 无缝拼贴要求（边缘完美对接）
 * - 智能面料比例（5-8cm 元素尺寸）
 */

// ==================== 类型定义 ====================

export interface GeminiPatternPromptConfig {
  patternType?: string
  generationMode?: 'mode_a' | 'mode_b' | 'mode_c'
  density?: 'sparse' | 'medium' | 'dense'
  colorTone?: string
  symmetryMode?: string
  useSystemPrompt?: boolean
  enableSmartScaling?: boolean
  enableAutoColorMatch?: boolean
  stylePresetPrompt?: string
  customPrompt?: string
  negativePrompt?: string
  promptEnhancement?: boolean
  imageSize?: string
  aspectRatio?: string
  outputType?: string
  mockupType?: string
}

// ==================== 图案类型预设 ====================

/**
 * 图案类型提示词
 * Pattern Type Prompts
 *
 * - seamless: 无缝重复图案（面料印花、壁纸、纺织品）
 * - tshirt_front: T恤正面图案（居中构图、视觉冲击）
 * - allover: 满印图案（全覆盖设计、无明显重复边界）
 * - geometric: 几何图案（干净线条、数学精确、规则形状）
 * - floral: 花卉图案（植物元素、花朵、叶子、自然形态）
 * - abstract: 抽象图案（非具象形状、艺术表达）
 * - cartoon: 卡通/角色图案（可爱角色、趣味元素、插画风）
 * - ethnic: 民族/传统图案（文化图腾、传统符号、传承设计）
 * - animal: 动物图案（动物形象、野生动物图案、自然灵感）
 * - food: 食物图案（食物插画、美食主题）
 */
export const PATTERN_TYPE_PROMPTS: Record<string, { style: string; elements: string; usage: string }> = {
  seamless: {
    style: 'Seamless repeating pattern',
    elements: 'perfectly tileable edges, continuous design flow',
    usage: 'suitable for fabric printing, wallpaper, textile'
  },
  tshirt_front: {
    style: 'T-shirt front graphic design',
    elements: 'centered composition, bold visual impact',
    usage: 'suitable for screen printing, DTG printing'
  },
  allover: {
    style: 'All-over print pattern',
    elements: 'full coverage design, no obvious repeat boundaries',
    usage: 'suitable for full garment printing'
  },
  geometric: {
    style: 'Geometric pattern',
    elements: 'clean lines, mathematical precision, regular shapes',
    usage: 'modern, minimalist applications'
  },
  floral: {
    style: 'Floral pattern',
    elements: 'botanical elements, flowers, leaves, natural forms',
    usage: 'feminine, natural, romantic applications'
  },
  abstract: {
    style: 'Abstract pattern',
    elements: 'non-representational shapes, artistic expression',
    usage: 'creative, artistic applications'
  },
  cartoon: {
    style: 'Cartoon/Character pattern',
    elements: 'cute characters, playful elements, fun illustrations',
    usage: "children's products, casual wear"
  },
  ethnic: {
    style: 'Ethnic/Traditional pattern',
    elements: 'cultural motifs, traditional symbols, heritage designs',
    usage: 'cultural fashion, traditional textiles'
  },
  animal: {
    style: 'Animal pattern',
    elements: 'animal figures, wildlife motifs, nature-inspired',
    usage: "casual wear, children's clothing"
  },
  food: {
    style: 'Food pattern',
    elements: 'food illustrations, culinary themes, delicious motifs',
    usage: 'kitchen textiles, casual apparel'
  }
}

// ==================== 密度预设 ====================

/**
 * 密度提示词
 * Density Prompts
 *
 * - sparse: 稀疏分布（充足留白、元素间呼吸空间）
 * - medium: 中等分布（平衡间距、视觉和谐）
 * - dense: 密集排列（丰富饱满、最大覆盖）
 */
export const DENSITY_PROMPTS: Record<string, string> = {
  sparse: 'sparse distribution with generous white space, breathing room between elements',
  medium: 'balanced distribution, harmonious spacing, visually pleasing density',
  dense: 'dense arrangement, rich and full, maximum coverage with minimal gaps'
}

// ==================== 色调预设 ====================

/**
 * 色调提示词
 * Color Tone Prompts
 *
 * - warm: 暖色系（红、橙、黄、大地色）
 * - cool: 冷色系（蓝、绿、紫、清新色）
 * - monochrome: 单色系（单色变化、优雅简约）
 * - colorful: 多彩色系（丰富多样、活力四射）
 * - pastel: 粉彩色系（柔和粉彩、梦幻轻柔）
 * - vintage: 复古色系（哑光色调、怀旧感）
 * - neon: 霓虹色系（明亮霓虹、高对比、大胆活力）
 */
export const COLOR_TONE_PROMPTS: Record<string, string> = {
  warm: 'warm color palette: reds, oranges, yellows, earthy tones',
  cool: 'cool color palette: blues, greens, purples, fresh tones',
  monochrome: 'monochromatic scheme, single color variations, elegant simplicity',
  colorful: 'vibrant multi-color palette, rich and diverse hues',
  pastel: 'soft pastel colors, gentle and dreamy tones',
  vintage: 'vintage color palette, muted tones, nostalgic feel',
  neon: 'bright neon colors, high contrast, bold and energetic'
}

// ==================== 对称模式预设 ====================

/**
 * 对称模式提示词
 * Symmetry Prompts
 *
 * - none: 无对称
 * - horizontal: 水平对称（左右镜像）
 * - vertical: 垂直对称（上下镜像）
 * - quarter: 四分之一对称（四折旋转）
 * - radial: 径向对称（从中心发散）
 * - rotational: 旋转对称（180度旋转）
 */
export const SYMMETRY_PROMPTS: Record<string, string> = {
  none: '',
  horizontal: 'horizontally symmetrical design, mirrored left to right',
  vertical: 'vertically symmetrical design, mirrored top to bottom',
  quarter: 'quarter-turn symmetry, four-fold rotational pattern',
  radial: 'radial symmetry, emanating from center',
  rotational: '180-degree rotational symmetry'
}

// ==================== 生成模式预设 ====================

/**
 * 生成模式提示词
 * Mode Prompts
 *
 * - mode_a: 元素重组模式（提取参考图元素，重新组合成新图案）
 * - mode_b: 纯无缝化模式（将参考图转换为无缝可平铺图案）
 * - mode_c: 设计大师模式（纯文本驱动，无需参考图）
 */
export const MODE_PROMPTS: Record<string, string> = {
  mode_a:
    'Extract elements from reference images and recombine them into a new pattern design. Maintain the core visual elements while creating fresh arrangements.',
  mode_b:
    'Convert the reference image into a seamless tileable pattern. Focus on making the pattern perfectly repeatable without visible seams.',
  mode_c:
    'Pure text-driven design. Create an original pattern based solely on the text description without any reference images. Be creative and innovative.'
}

// ==================== 核心规则提示词 ====================

/**
 * 无缝图案核心要求
 * Seamless Pattern Core Requirements
 */
export const SEAMLESS_REQUIREMENTS = `[Seamless Requirements - CRITICAL]
- Tile must be perfectly seamless horizontally and vertically
- Any motif touching an edge must continue EXACTLY on the opposite edge
- No seams, borders, fade-outs or vignettes at the tile edges
- Resolution and detail must be high enough for fabric printing

[Print Behavior]
- Visual density should feel balanced when tiled many times
- Motifs should remain readable but not oversized
- Pattern should feel like real clothing fabric

[Repeat Integrity Checklist]
- Edge-wrapped motifs must align pixel-perfect across opposite edges
- Avoid linear rows/columns even at large tiling
- Keep micro-fillers consistent to reduce visible repetition`

/**
 * 有机排版规则
 * Organic Layout Rules
 */
export const ORGANIC_LAYOUT_RULES = `[Organic Layout - IMPORTANT]
- Organic, multi-directional tossed layout (no clear 'up' or 'down')
- Avoid any visible grid, rows or columns
- Use a mix of large, medium and small motif sizes
- Distribute motifs with natural variation in spacing
- Avoid obvious repetition or 'checkerboard' feel`

/**
 * T恤大图要求
 * Graphic Design Requirements
 */
export const GRAPHIC_REQUIREMENTS = `[Graphic Design Requirements]
- Single, centered composition with strong visual hierarchy
- Clean 2D vector / illustration style with crisp edges and controlled contrast
- High-quality rendering suitable for commercial printing (300 DPI equivalent detail)
- Isolated on a pure white background (no mannequins, no mockups, no extra shadows)
- No extra UI elements, watermarks, logos or text unless explicitly requested
- Readable silhouette and hierarchy at typical viewing distance (3-5 feet)
- Sharp, well-defined edges suitable for screen printing or DTG`

/**
 * 智能面料比例规则
 * Smart Fabric Scaling Rules
 */
export const SMART_SCALING_RULES = `[Smart Fabric Scaling - CRITICAL for Mockup]
- DO NOT STRETCH one copy of the pattern to cover the whole garment
- ACTION: TILE & REPEAT the pattern many times across the entire surface
- Calculate a realistic fabric scale: motifs should be about 5-8 cm tall in real life
- Motifs must look delicate and detailed, not giant, blurry or pixelated`

// ==================== 提示词构建函数 ====================

/**
 * 构建图案生成提示词
 * Build Pattern Prompt
 *
 * @param config - 节点配置
 * @param outputMode - 输出模式 ('seamless' | 'graphic')
 * @param variantIndex - 变体索引
 * @returns 完整的图案生成提示词
 */
export function buildPatternPrompt(
  config: GeminiPatternPromptConfig,
  outputMode: 'seamless' | 'graphic' = 'seamless',
  variantIndex: number = 0
): string {
  void variantIndex
  const parts: string[] = []

  // 1. System Instruction: 角色定位
  if (config.useSystemPrompt) {
    if (outputMode === 'seamless') {
      parts.push(`[Role: Expert Textile Designer]
You create seamless commercial all-over prints for fabric using advanced pattern generation capabilities.`)
    } else {
      parts.push(`[Role: Expert Fashion Graphic Designer]
You design commercial-ready T-shirt 'placement prints' (large chest graphics) using advanced image generation capabilities.`)
    }
  }

  // 2. 图案类型
  const patternType = PATTERN_TYPE_PROMPTS[config.patternType || 'seamless'] || PATTERN_TYPE_PROMPTS.seamless
  parts.push(`[Pattern Style]
Style: ${patternType.style}
Elements: ${patternType.elements}
Usage: ${patternType.usage}`)

  // 3. 生成模式
  const modePrompt = MODE_PROMPTS[config.generationMode || 'mode_a'] || MODE_PROMPTS.mode_a
  parts.push(`[Generation Mode]
${modePrompt}`)

  // 4. 无缝图案核心要求 / T恤大图要求
  if (outputMode === 'seamless') {
    parts.push(SEAMLESS_REQUIREMENTS)
    parts.push(ORGANIC_LAYOUT_RULES)
  } else {
    parts.push(GRAPHIC_REQUIREMENTS)
  }

  // 5. 密度
  const densityPrompt = DENSITY_PROMPTS[config.density || 'medium'] || DENSITY_PROMPTS.medium
  parts.push(`[Density]
${densityPrompt}`)

  // 6. 色调
  if (config.colorTone && config.colorTone !== 'auto') {
    const colorPrompt = COLOR_TONE_PROMPTS[config.colorTone]
    if (colorPrompt) {
      parts.push(`[Color Palette]
${colorPrompt}`)
    }
  }

  // 7. 对称模式
  if (config.symmetryMode && config.symmetryMode !== 'none') {
    const symmetryPrompt = SYMMETRY_PROMPTS[config.symmetryMode]
    if (symmetryPrompt) {
      parts.push(`[Symmetry]
${symmetryPrompt}`)
    }
  }

  // 8. 智能面料比例 (用于 Mockup)
  if (config.enableSmartScaling) {
    parts.push(SMART_SCALING_RULES)
  }

  // 9. 风格预设
  if (config.stylePresetPrompt) {
    parts.push(`[Style Preset]
${config.stylePresetPrompt}`)
  }

  // 10. 自定义描述
  if (config.customPrompt) {
    parts.push(`[Custom Description]
${config.customPrompt}`)
  }

  // 11. 提示词增强
  if (config.promptEnhancement) {
    parts.push(`[Quality Enhancement]
High resolution, professional quality, suitable for commercial printing.
Clean design, well-balanced composition, visually appealing.
Ensure color accuracy and print-ready color separation.`)
  }

  // 12. 技术规格
  parts.push(`[Technical Specifications]
Resolution: ${config.imageSize || '2K'}
Aspect ratio: ${config.aspectRatio || '1:1'}`)

  // 13. 输出要求
  parts.push(`[Output Requirements]
Generate the image directly. Do not output any text descriptions, dialogue, or JSON format. Start generating pixel data immediately.`)

  return parts.join('\n\n')
}

/**
 * 构建平铺预览提示词
 * Build Tiled Preview Prompt
 *
 * @param config - 节点配置
 * @returns 平铺预览提示词
 */
export function buildTiledPreviewPrompt(config: GeminiPatternPromptConfig): string {
  const parts: string[] = []

  parts.push('Generate a 3x3 tiled preview showing how the seamless pattern repeats.')
  parts.push('Show 9 tiles arranged in a grid to demonstrate the seamless tiling effect.')
  parts.push('The pattern should flow continuously across all tiles with no visible seams.')

  // 继承主要配置
  const patternType = PATTERN_TYPE_PROMPTS[config.patternType || 'seamless'] || PATTERN_TYPE_PROMPTS.seamless
  parts.push(`Pattern style: ${patternType.style}`)

  if (config.colorTone && config.colorTone !== 'auto') {
    const colorPrompt = COLOR_TONE_PROMPTS[config.colorTone]
    if (colorPrompt) {
      parts.push(colorPrompt)
    }
  }

  parts.push(`${config.imageSize || '2K'} resolution, 1:1 square format.`)

  return parts.join(' ')
}

/**
 * 构建套装 Mockup 提示词
 * Build Set Mockup Prompt
 *
 * 包含：自动配色 + 智能面料比例
 *
 * @param config - 节点配置
 * @returns 套装 Mockup 提示词
 */
export function buildSetMockupPrompt(config: GeminiPatternPromptConfig): string {
  const parts: string[] = []

  parts.push(`[Role: Professional E-commerce Retoucher]
You create high-quality product photos for fashion e-commerce.

[Task]
Combine the inputs into a cohesive "Pajama / Fashion Set" product photo: a shirt and pants shown together, with realistic lighting and fabric behaviour.

[Inputs]
- Image 1: White base garment (shirt + pants) on studio background.
- Image 2: Graphic for the shirt chest (placement print).
- Image 3: Seamless pattern tile for the pants.`)

  // 步骤1：智能配色（如果启用）
  if (config.enableAutoColorMatch) {
    parts.push(`
STEP 1: SMART COLOR MATCHING (Dyeing)
- Analyze the DOMINANT BACKGROUND COLOR of the pattern in Image 3.
- DYE ONLY THE SHIRT area in Image 1 to match that background color as closely as possible.
- Preserve fabric texture, shading and highlights of the shirt; do not paint a flat block of color.
- Keep the background and pants color unchanged unless affected naturally by reflections.`)
  }

  // 步骤2：上衣大图贴图
  parts.push(`
STEP 2: UPPER GARMENT (Placement Print)
- Place Image 2 on the centre chest of the ${config.enableAutoColorMatch ? 'dyed' : 'white'} shirt in Image 1.
- Treat Image 2 as a print on the fabric, not as a sticker.
- Wrap the graphic naturally over wrinkles and folds using a realistic warp.
- Blend mode: similar to Multiply/Overlay so the shirt's wrinkles and shadows remain visible through the print.
- Do NOT distort the design excessively; keep the design readable.
- Prefer medium scale for the chest graphic; avoid oversized prints.`)

  // 步骤3：下装无缝图案贴图（智能面料比例）
  if (config.enableSmartScaling) {
    parts.push(`
STEP 3: LOWER GARMENT (Smart Fabric Scaling) -- CRITICAL
- Apply Image 3 (pattern tile) to the pants.
- Treat Image 3 as a REPEATABLE TILE, not a single large image.

- **SCALING RULES (Smart Fabric Scaling)**
  - **DO NOT STRETCH** one copy of the pattern to cover the whole leg.
  - **ACTION: TILE & REPEAT** the pattern many times across the entire pants surface.
  - Calculate a realistic fabric scale: in real life, motifs such as characters or flowers should be about 5–8 cm tall.
  - Motifs must look delicate and detailed, not giant, blurry or pixelated.

- **MAPPING & WRAP**
  - Wrap the tiled pattern naturally around the curves and folds of the pants.
  - Follow fabric perspective, leg shape and wrinkles.
  - Preserve existing shading and highlights of the pants so it still looks like real cloth.
  - Avoid visible seams or misaligned edges when wrapping.`)
  } else {
    parts.push(`
STEP 3: LOWER GARMENT
- Apply Image 3 (pattern tile) to the pants.
- Wrap the pattern naturally around the curves and folds of the pants.
- Follow fabric perspective, leg shape and wrinkles.
- Preserve existing shading and highlights of the pants.`)
  }

  // 最终效果
  parts.push(`
[Final Polish]
- Ensure the lighting on both shirt and pants prints matches the original studio lighting.
- Avoid halos, visible edges, or unnatural glow around the prints.
- The final result must look like a real photo, not a collage or render.
- Keep overall colour harmony between top and bottom; use the pattern background as the shirt dye reference.

[Output Requirements]
Generate the image directly. Do not output any text descriptions, dialogue, or JSON format. Start generating pixel data immediately.`)

  return parts.join('\n')
}

/**
 * 构建单品 Mockup 提示词
 * Build Single Mockup Prompt
 *
 * @param config - 节点配置
 * @returns 单品 Mockup 提示词
 */
export function buildSingleMockupPrompt(config: GeminiPatternPromptConfig): string {
  const parts: string[] = []

  parts.push(`[Role: Professional E-commerce Retoucher]
You create clean, realistic product photos for fashion e-commerce.

[Task]
Apply the pattern texture (Image 2) onto the garment in Image 1 to create a believable printed fabric.

[Inputs]
- Image 1: Base garment on a studio background.
- Image 2: Seamless pattern tile.`)

  // 智能面料比例
  if (config.enableSmartScaling) {
    parts.push(`
[Scaling - Smart Fabric Scaling]
- Treat Image 2 as a REPEATABLE TILE, not a single image.
- **DO NOT STRETCH** one copy of the pattern to fill the entire garment.
- **TILE the pattern** to a realistic fabric scale: motifs should be comfortably readable but not giant.
- In real life, motifs should be about 5-8 cm tall.
- Motifs must look delicate and detailed, not blurry or pixelated.`)
  } else {
    parts.push(`
[Scaling]
- Treat Image 2 as a REPEATABLE TILE, not a single image.
- TILE the pattern to a realistic fabric scale: motifs should be comfortably readable but not giant.
- Do NOT stretch one copy of the pattern to fill the entire garment.`)
  }

  parts.push(`
[Mapping]
- Wrap the tiled pattern naturally around the garment, following its shape and folds.
- Preserve and reuse the garment's original shadows, highlights and wrinkles.
- Avoid obvious repetition seams or mismatched edges.
- Ensure the tiled pattern scale reflects realistic fabric motif size.

[Constraints]
- Keep the background and overall lighting of the original photo.
- No extra logos, text, watermarks or UI elements.
- Maintain original studio lighting and background cleanliness.

[Output Requirements]
Generate the image directly. Do not output any text descriptions, dialogue, or JSON format. Start generating pixel data immediately.`)

  return parts.join('\n')
}

/**
 * 构建负面提示词
 * Build Negative Prompt
 *
 * @param config - 节点配置
 * @returns 负面提示词
 */
export function buildNegativePrompt(config: GeminiPatternPromptConfig): string {
  const negatives = [
    // 质量问题
    'blurry',
    'low quality',
    'distorted',
    'pixelated',
    'artifacts',
    'watermarks',
    'text',
    'logos',
    'signatures',
    // 颜色问题
    'muddy colors',
    'color bleeding',
    'oversaturated',
    'washed out'
  ]

  // 无缝图案特定排除
  if (config.patternType === 'seamless' || config.outputType?.includes('pattern')) {
    negatives.push(
      // 无缝问题
      'visible seams',
      'edge misalignment',
      'discontinuous pattern',
      'obvious repeat boundaries',
      'broken elements at edges',
      'mismatched edges',
      'visible tile borders',
      // 排版问题
      'grid pattern',
      'checkerboard feel',
      'linear rows',
      'obvious columns',
      'mechanical repetition',
      'unnatural spacing'
    )
  }

  // T恤大图特定排除
  if (config.outputType?.includes('graphic')) {
    negatives.push(
      'all-over pattern',
      'scattered tiny icons',
      'no focal point',
      'busy background',
      'cluttered composition'
    )
  }

  // 用户自定义排除
  if (config.negativePrompt) {
    negatives.push(config.negativePrompt)
  }

  return negatives.join(', ')
}

// ==================== 图案风格预设库 ====================

/**
 * 图案风格预设类型
 * Pattern Style Preset Type
 *
 * 适用于图案生成节点的风格选择
 */
export interface PatternStylePreset {
  id: string
  name: string
  nameEn: string
  category: 'pattern' | 'commercial' | 'lifestyle' | 'artistic'
  description: string
  prompt: string
  tags: string[]
}

/**
 * 图案风格预设 - 适用于图案生成节点
 * Pattern Style Presets - for Pattern Generation Node
 *
 * 参考自专业图案脚本的 100+ 风格预设
 */
export const PATTERN_STYLE_PRESETS: PatternStylePreset[] = [
  // ========== 潮流时尚 ==========
  {
    id: 'y2k_acid',
    name: 'Y2K 千禧辣妹',
    nameEn: 'Y2K Club Girl',
    category: 'pattern',
    description: '酸性/散点/重叠 - 霓虹与金属色',
    prompt:
      'Style: Acid Y2K club graphic. Layout: chaotic tossed icons, overlaps and sticker clusters. Colors: neon and chrome. Elements: flames, butterflies, tribal swirls and chrome hearts. Vibe: spicy and over-the-top.',
    tags: ['潮流', '复古', '霓虹']
  },
  {
    id: 'boho_cottagecore',
    name: 'Boho 波西米亚',
    nameEn: 'Boho Cottagecore',
    category: 'pattern',
    description: '自然/碎花/错落 - 温暖大地色',
    prompt:
      'Style: cottagecore boho. Layout: slightly irregular clusters and trails. Colors: warm earthy pastels. Elements: wildflowers, leaves and mushrooms. Vibe: soft, free and natural.',
    tags: ['自然', '田园', '温暖']
  },
  {
    id: 'retro_70s',
    name: 'Retro 70s 复古',
    nameEn: '70s Groovy',
    category: 'pattern',
    description: '流动/波浪/紧凑 - 橙棕色系',
    prompt:
      'Style: 1970s groovy. Layout: dense, flowing bands and flowers with almost no empty space. Colors: orange, brown, mustard and cream. Elements: wavy stripes, daisies and warped checks. Vibe: trippy and warm.',
    tags: ['复古', '70年代', '流动']
  },
  {
    id: 'streetwear',
    name: 'Streetwear 街头',
    nameEn: 'Urban Streetwear',
    category: 'pattern',
    description: '涂鸦/堆叠/硬朗 - 高对比度',
    prompt:
      'Style: urban streetwear. Layout: layered tags and sticker-bomb clusters. Colors: high-contrast brights on dark base. Elements: graffiti marks, spray drips and bold lettering. Vibe: tough and energetic.',
    tags: ['街头', '涂鸦', '潮流']
  },

  // ========== 童趣可爱 ==========
  {
    id: 'cute_cartoon',
    name: 'Cute Cartoon 童趣',
    nameEn: 'Dopamine Kids Cartoon',
    category: 'pattern',
    description: '跳跃/大小对比 - 糖果色',
    prompt:
      'Style: dopamine-kids cartoon. Layout: playful tossed icons with big–small contrast. Colors: candy brights. Elements: cute animals, sweets and toys. Vibe: bubbly, silly and fun.',
    tags: ['童趣', '可爱', '糖果色']
  },
  {
    id: 'dino_party',
    name: 'Dino Party 恐龙派对',
    nameEn: 'Dinosaur Party',
    category: 'pattern',
    description: '恐龙/足迹/岩石 - 柔和绿蓝橙',
    prompt:
      'Style: cute dinosaur party. Layout: tossed dinos walking in different directions with small filler icons. Colors: soft greens, blues and oranges. Elements: chubby dinos, footprints, rocks and volcanoes. Vibe: adventurous but friendly.',
    tags: ['恐龙', '冒险', '男童']
  },
  {
    id: 'unicorn_dream',
    name: 'Unicorn Dream 独角兽梦境',
    nameEn: 'Unicorn Princess',
    category: 'pattern',
    description: '独角兽/彩虹/公主 - 柔和彩虹',
    prompt:
      'Style: magical unicorn princess. Layout: light, airy tossed motifs with floating clouds. Colors: pastel rainbow and iridescent accents. Elements: unicorns, rainbows, hearts, stars and tiaras. Vibe: dreamy and sweet.',
    tags: ['独角兽', '梦幻', '女童']
  },
  {
    id: 'space_explorer',
    name: 'Space Explorer 太空冒险',
    nameEn: 'Kids Space Adventure',
    category: 'pattern',
    description: '宇航员/星球/飞船 - 深蓝霓虹',
    prompt:
      'Style: kids space adventure. Layout: full all-over galaxy with orbiting elements. Colors: navy or black night sky with neon accents. Elements: astronauts, rockets, planets, UFOs and stars. Vibe: curious, techy and bold.',
    tags: ['太空', '科技', '男童']
  },
  {
    id: 'candy_shop',
    name: 'Candy Shop 糖果屋',
    nameEn: 'Candy Shop Dopamine',
    category: 'pattern',
    description: '糖果/棒棒糖/棋盘格 - 高饱和粉薄荷',
    prompt:
      'Style: candy shop dopamine. Layout: repeating candy clusters with checkerboard pieces. Colors: saturated pink, mint, lemon and lilac. Elements: lollipops, wrapped candies, gummies and check tiles. Vibe: sugar-rush and playful.',
    tags: ['糖果', '多巴胺', '甜美']
  },
  {
    id: 'kawaii_animal',
    name: 'Kawaii 软萌动物乐园',
    nameEn: 'Kawaii Animal Parade',
    category: 'pattern',
    description: '熊/兔/狗 - 柔和粉棕线稿',
    prompt:
      'Style: kawaii animal parade. Layout: evenly spaced tossed characters with tiny icons between. Colors: soft pastels with brown line art. Elements: bears, bunnies, puppies, snacks and tiny hearts. Vibe: ultra-cute and gentle.',
    tags: ['可爱', '日系', '软萌']
  },

  // ========== 运动主题 ==========
  {
    id: 'racing_car',
    name: 'Racing Car 赛道赛车',
    nameEn: 'Racing Cars',
    category: 'pattern',
    description: '赛车/闪电/格纹 - 红黄黑白',
    prompt:
      'Style: boyish racing fun. Layout: diagonal motion with speed lines and badges. Colors: red, yellow, black and white. Elements: race cars, checkered flags, numbers and lightning bolts. Vibe: fast, sporty and loud.',
    tags: ['赛车', '运动', '男童']
  },
  {
    id: 'sport_varsity',
    name: 'Sport Varsity 校园运动',
    nameEn: 'Varsity Sports',
    category: 'pattern',
    description: '球类/字母/徽章 - 藏青红灰',
    prompt:
      'Style: varsity college sports. Layout: badges and numbers scattered with balls and stripes. Colors: navy, red, grey and mustard. Elements: varsity letters, footballs, basketballs and stripes. Vibe: athletic and classic.',
    tags: ['运动', '校园', '美式']
  },
  {
    id: 'basketball_court',
    name: 'Basketball Court 篮球场',
    nameEn: 'Basketball Kids',
    category: 'pattern',
    description: '篮球/篮筐/数字 - 橙黑白',
    prompt:
      'Style: basketball kids. Layout: diagonal motion with court lines. Colors: orange, black, white. Elements: balls, hoops, numbers. Vibe: sporty and bold.',
    tags: ['篮球', '运动', '动感']
  },
  {
    id: 'soccer_field',
    name: 'Soccer Field 足球场',
    nameEn: 'Soccer Kids',
    category: 'pattern',
    description: '足球/球门/球衣 - 草绿白黑',
    prompt:
      'Style: soccer kids. Layout: pitch cues with icon toss. Colors: grass green, white, black. Elements: balls, goals, jersey badges. Vibe: classic and active.',
    tags: ['足球', '运动', '经典']
  },

  // ========== 海洋主题 ==========
  {
    id: 'mermaid_ocean',
    name: 'Mermaid Ocean 人鱼海底',
    nameEn: 'Mermaid Fantasy',
    category: 'pattern',
    description: '美人鱼/贝壳/波纹 - 水蓝紫珠光',
    prompt:
      'Style: under-sea mermaid fantasy. Layout: flowing vertical waves with drifting motifs. Colors: aqua, teal, lilac and pearly highlights. Elements: mermaids, shells, sea plants and bubbles. Vibe: calm, magical and fluid.',
    tags: ['海洋', '美人鱼', '梦幻']
  },
  {
    id: 'ocean_sailor',
    name: 'Ocean Sailor 航海小水手',
    nameEn: 'Nautical Sailor',
    category: 'pattern',
    description: '条纹/锚/船 - 藏青白红浅蓝',
    prompt:
      'Style: nautical sailor. Layout: stripes combined with scattered icons. Colors: navy, white, red and light blue. Elements: anchors, boats, life rings and steering wheels. Vibe: fresh, marine and tidy.',
    tags: ['航海', '水手', '清爽']
  },
  {
    id: 'ocean_friends',
    name: 'Ocean Friends 海洋伙伴',
    nameEn: 'Ocean Kids',
    category: 'pattern',
    description: '鲸鱼/海豚/海龟 - 水蓝藏青珊瑚',
    prompt:
      'Style: ocean kids. Layout: scattered sea animals with bubbles. Colors: aqua, navy, coral. Elements: whales, dolphins, turtles. Vibe: calm and cute.',
    tags: ['海洋', '动物', '可爱']
  },

  // ========== 动物主题 ==========
  {
    id: 'jungle_safari',
    name: 'Jungle Safari 丛林探险',
    nameEn: 'Jungle Safari',
    category: 'pattern',
    description: '狮子/老虎/长颈鹿 - 绿棕沙色',
    prompt:
      'Style: jungle safari. Layout: medium-density tossed animals among dense foliage. Colors: greens, warm browns and sandy yellow. Elements: lions, tigers, giraffes, big leaves and paw prints. Vibe: wild but kid-friendly.',
    tags: ['丛林', '动物', '冒险']
  },
  {
    id: 'forest_friends',
    name: 'Forest Friends 森林伙伴',
    nameEn: 'Woodland Friends',
    category: 'pattern',
    description: '狐狸/鹿/松鼠 - 灰绿锈色',
    prompt:
      'Style: woodland kids. Layout: medium density motifs with leaf fillers. Colors: sage, rust, cream and brown. Elements: foxes, deer, squirrels, acorns. Vibe: warm and natural.',
    tags: ['森林', '动物', '温暖']
  },
  {
    id: 'farm_friends',
    name: 'Farm Friends 农场伙伴',
    nameEn: 'Farm Friends',
    category: 'pattern',
    description: '奶牛/小鸡/稻草人 - 奶油绿蓝',
    prompt:
      'Style: friendly farm. Layout: evenly tossed animals and tools with micro fillers. Colors: cream, tan, grass green and sky blue. Elements: cows, chicks, tractors, straw bales. Vibe: wholesome and sunny.',
    tags: ['农场', '动物', '阳光']
  },
  {
    id: 'arctic_friends',
    name: 'Arctic Friends 北极伙伴',
    nameEn: 'Arctic Friends',
    category: 'pattern',
    description: '企鹅/海豹/雪花 - 冰蓝白紫',
    prompt:
      'Style: arctic cute. Layout: sparse airy scatter with snowflake fillers. Colors: icy blue, navy, white and lilac. Elements: penguins, seals, igloos, snow. Vibe: cool and gentle.',
    tags: ['北极', '冬季', '可爱']
  },
  {
    id: 'pet_pals',
    name: 'Pet Pals 宠物伙伴',
    nameEn: 'Pet Parade',
    category: 'pattern',
    description: '小狗/小猫/骨头 - 柔和中性糖果色',
    prompt:
      'Style: pet parade. Layout: balanced tossed with bones and yarn fillers. Colors: soft neutrals with candy accents. Elements: puppies, kittens, bowls, toys. Vibe: cozy and playful.',
    tags: ['宠物', '可爱', '温馨']
  },

  // ========== 交通工具 ==========
  {
    id: 'construction_vehicles',
    name: 'Construction 工程车队',
    nameEn: 'Construction Vehicles',
    category: 'pattern',
    description: '挖掘机/卡车 - 黄橙蓝灰',
    prompt:
      'Style: construction truck kid. Layout: medium-density tossed vehicles on simple ground hints. Colors: yellow, orange, blue and grey. Elements: diggers, dump trucks, cones and signs. Vibe: busy, mechanical and fun.',
    tags: ['工程', '车辆', '男童']
  },
  {
    id: 'fire_rescue',
    name: 'Fire Rescue 消防救援',
    nameEn: 'Fire Rescue',
    category: 'pattern',
    description: '消防车/头盔 - 火红黄灰藏青',
    prompt:
      'Style: rescue squad. Layout: diagonal ladders and truck icons. Colors: fire red, yellow, grey and navy. Elements: fire trucks, helmets, hydrants. Vibe: strong and friendly.',
    tags: ['消防', '英雄', '男童']
  },
  {
    id: 'airplane_sky',
    name: 'Airplane Sky 飞机天空',
    nameEn: 'Aviation Kids',
    category: 'pattern',
    description: '飞机/螺旋桨 - 天蓝红白银',
    prompt:
      'Style: aviation kids. Layout: wavy flight paths with cloud fillers. Colors: sky blue, red, white and silver. Elements: planes, propellers, towers. Vibe: breezy and bright.',
    tags: ['飞机', '天空', '冒险']
  },
  {
    id: 'train_station',
    name: 'Train Station 火车站',
    nameEn: 'Train Play',
    category: 'pattern',
    description: '火车头/车厢/铁轨 - 炭灰红黄蓝',
    prompt:
      'Style: train play. Layout: brick repeat hints with icons. Colors: charcoal, red, yellow, blue. Elements: engines, carriages, tracks, signals. Vibe: classic and cute.',
    tags: ['火车', '交通', '男童']
  },

  // ========== 节日主题 ==========
  {
    id: 'holiday_xmas',
    name: 'Holiday Xmas 圣诞节日',
    nameEn: 'Christmas Holiday',
    category: 'pattern',
    description: '圣诞树/驯鹿/礼物 - 红绿金',
    prompt:
      'Style: cute Christmas kids. Layout: medium-density festive icons on a snowy base. Colors: red, green, cream and gold. Elements: trees, reindeer, stockings, gifts and snowflakes. Vibe: cozy, celebratory and bright.',
    tags: ['圣诞', '节日', '冬季']
  },
  {
    id: 'halloween_spooky',
    name: 'Halloween 万圣节萌鬼',
    nameEn: 'Spooky Cute Halloween',
    category: 'pattern',
    description: '南瓜/蝙蝠/鬼魂 - 紫橙黑绿',
    prompt:
      'Style: spooky-cute Halloween. Layout: tossed characters with small filler icons. Colors: purple, orange, black and acid green. Elements: smiling ghosts, pumpkins, bats and candies. Vibe: playful, not scary.',
    tags: ['万圣节', '节日', '可爱']
  },
  {
    id: 'birthday_fun',
    name: 'Birthday Fun 生日乐趣',
    nameEn: 'Birthday Party',
    category: 'pattern',
    description: '蛋糕/蜡烛/礼物 - 糖果明亮色',
    prompt:
      'Style: birthday set. Layout: cakes and hats tossed with sparks. Colors: candy brights. Elements: cakes, candles, gifts. Vibe: celebratory and sweet.',
    tags: ['生日', '派对', '庆祝']
  },

  // ========== 简约几何 ==========
  {
    id: 'minimalist_geometry',
    name: 'Minimalist 极简几何',
    nameEn: 'Minimalist Geometry',
    category: 'pattern',
    description: '非对齐/留白 - 柔和中性色',
    prompt:
      'Style: modern minimalist geometry. Layout: asymmetrical floating shapes with lots of negative space. Colors: limited muted palette. Elements: dots, squiggles and blocks. Vibe: clean, design-driven and calm.',
    tags: ['极简', '几何', '现代']
  },
  {
    id: 'polka_dots',
    name: 'Polka Dots 圆点乐园',
    nameEn: 'Polka Dot Fun',
    category: 'pattern',
    description: '圆点/星星/爱心 - 原色或柔和色',
    prompt:
      'Style: dot play. Layout: dot fields with cute icons sparingly. Colors: primaries or pastels. Elements: dots, mini stars, hearts. Vibe: classic and bubbly.',
    tags: ['圆点', '经典', '简约']
  },
  {
    id: 'rainbow_hearts',
    name: 'Rainbow Hearts 彩虹小爱心',
    nameEn: 'Rainbow Hearts',
    category: 'pattern',
    description: '爱心/星星/彩虹 - 彩虹渐变',
    prompt:
      'Style: rainbow heart repeat. Layout: simple, even tossed icons and micro icons. Colors: rainbow gradients on a light base. Elements: hearts, stars, sparkles and smiles. Vibe: optimistic, friendly and simple.',
    tags: ['彩虹', '爱心', '乐观']
  },

  // ========== 食物主题 ==========
  {
    id: 'fruit_crush',
    name: 'Fruit Crush 多巴胺水果',
    nameEn: 'Fruity Dopamine',
    category: 'pattern',
    description: '草莓/樱桃/柠檬 - 高饱和果色',
    prompt:
      'Style: fruity dopamine. Layout: bold tossed fruits with some overlapping for depth. Colors: bright reds, oranges, yellows and greens. Elements: strawberries, cherries, oranges, lemons and juice drops. Vibe: juicy, fresh and fun.',
    tags: ['水果', '多巴胺', '清新']
  },
  {
    id: 'ice_cream_land',
    name: 'Ice Cream Land 冰淇淋王国',
    nameEn: 'Ice Cream Kingdom',
    category: 'pattern',
    description: '甜筒/冰棒/彩色糖 - 薄荷草莓香草',
    prompt:
      'Style: ice cream kids. Layout: cone and scoop toss with drips. Colors: mint, strawberry, vanilla, chocolate. Elements: cones, popsicles, sprinkles. Vibe: cool and happy.',
    tags: ['冰淇淋', '甜品', '清凉']
  },
  {
    id: 'sweet_bakery',
    name: 'Sweet Bakery 甜品面包房',
    nameEn: 'Bakery Treats',
    category: 'pattern',
    description: '甜甜圈/牛角包/蛋糕 - 奶油粉棕',
    prompt:
      'Style: bakery cute. Layout: sticker clusters of pastries. Colors: cream, pink, chocolate brown. Elements: donuts, croissants, cupcakes. Vibe: cozy and sweet.',
    tags: ['烘焙', '甜品', '温馨']
  },

  // ========== 梦幻柔和 ==========
  {
    id: 'pastel_dream',
    name: 'Pastel Dream 淡彩梦境',
    nameEn: 'Pastel Dream',
    category: 'pattern',
    description: '渐变/云朵/星星 - 婴儿粉紫薄荷蓝',
    prompt:
      'Style: pastel gradient dreamcore. Layout: very soft, low-contrast tossed shapes. Colors: baby pink, lavender, mint and sky blue. Elements: clouds, moons and tiny stars. Vibe: sleepy, soft and soothing.',
    tags: ['梦幻', '柔和', '治愈']
  },
  {
    id: 'fairy_forest',
    name: 'Fairy Forest 仙子花园',
    nameEn: 'Fairy Woodland',
    category: 'pattern',
    description: '精灵/花朵/蘑菇 - 灰粉鼠尾草金',
    prompt:
      'Style: fairy woodland. Layout: clusters of florals and fairy characters with open breathing space. Colors: dusty pink, sage, cream and gold accents. Elements: fairies, mushrooms and tiny flowers. Vibe: whimsical and gentle.',
    tags: ['仙子', '花园', '梦幻']
  },
  {
    id: 'princess_garden',
    name: 'Princess Garden 公主花园',
    nameEn: 'Princess Pastel',
    category: 'pattern',
    description: '皇冠/魔杖/蝴蝶结 - 腮红紫薄荷珍珠',
    prompt:
      'Style: princess pastel. Layout: airy sparkle fillers around icons. Colors: blush, lilac, mint and pearl. Elements: tiaras, wands, bows, roses. Vibe: dreamy and elegant.',
    tags: ['公主', '优雅', '梦幻']
  },
  {
    id: 'rainbow_cloud',
    name: 'Rainbow Cloud 彩虹云朵',
    nameEn: 'Rainbow Pastel',
    category: 'pattern',
    description: '彩虹/云朵/闪光 - 柔和彩虹白底',
    prompt:
      'Style: rainbow pastel. Layout: airy cloud scatter with arcs. Colors: pastel rainbow and white. Elements: rainbows, clouds, sparkles. Vibe: soft and optimistic.',
    tags: ['彩虹', '云朵', '治愈']
  },
  {
    id: 'moon_stars',
    name: 'Moon & Stars 月亮星星',
    nameEn: 'Night Kids',
    category: 'pattern',
    description: '月亮/星星/彗星 - 藏青金奶油紫',
    prompt:
      'Style: night kids. Layout: scattered moons and stars with dots. Colors: navy, gold, cream and lilac. Elements: crescent moons, stars, comets. Vibe: sleepy and magical.',
    tags: ['月亮', '星星', '夜晚']
  },

  // ========== 动漫风格 ==========
  {
    id: 'anime_girl',
    name: 'Anime Girl 可爱二次元',
    nameEn: 'Soft Anime Shoujo',
    category: 'pattern',
    description: '大眼女主/蝴蝶结 - 柔和粉紫蓝',
    prompt:
      'Style: soft anime shoujo. Layout: large character heads with smaller icons floating around. Colors: pastel pinks, purples and blues. Elements: big-eyed girls, ribbons, sparkles and lace hearts. Vibe: dreamy, pretty and trendy.',
    tags: ['动漫', '少女', '日系']
  },
  {
    id: 'pixel_gamer',
    name: 'Pixel Gamer 像素游戏',
    nameEn: 'Retro Pixel Gamer',
    category: 'pattern',
    description: '像素/手柄/文字块 - 霓虹暗底',
    prompt:
      'Style: retro pixel gamer. Layout: almost-grid but slightly broken for organic feel. Colors: neon brights on dark or bright cyan and magenta. Elements: pixel hearts, controllers, 8-bit icons and score blocks. Vibe: arcade, techy and energetic.',
    tags: ['像素', '游戏', '复古']
  },
  {
    id: 'comic_pop',
    name: 'Comic Pop 漫画格子',
    nameEn: 'Pop Art Comic',
    category: 'pattern',
    description: '对话框/爆炸/网点 - 原色黑线',
    prompt:
      'Style: pop-art comic. Layout: overlapping panels and bursts that still behave as an all-over. Colors: primary red, blue and yellow with black lines. Elements: speech bubbles, pow-bang bursts and halftone dots. Vibe: loud, humorous and graphic.',
    tags: ['漫画', '波普', '图形']
  },

  // ========== 自然季节 ==========
  {
    id: 'autumn_leaves',
    name: 'Autumn Leaves 秋叶',
    nameEn: 'Autumn Kids',
    category: 'pattern',
    description: '落叶/橡果/蘑菇 - 锈色芥末橄榄奶油',
    prompt:
      'Style: autumn kids. Layout: leaf scatter with acorns. Colors: rust, mustard, olive, cream. Elements: leaves, acorns, mushrooms. Vibe: warm and natural.',
    tags: ['秋天', '自然', '温暖']
  },
  {
    id: 'spring_bloom',
    name: 'Spring Bloom 春日花开',
    nameEn: 'Spring Florals',
    category: 'pattern',
    description: '花朵/蝴蝶/花蕾 - 腮红紫薄荷柠檬',
    prompt:
      'Style: spring florals. Layout: light blossoms with butterflies. Colors: blush, lilac, mint, lemon. Elements: flowers, buds, butterflies. Vibe: fresh and gentle.',
    tags: ['春天', '花朵', '清新']
  },
  {
    id: 'summer_splash',
    name: 'Summer Splash 夏日飞溅',
    nameEn: 'Summer Kids',
    category: 'pattern',
    description: '水花/拖鞋/冰棒 - 水蓝阳光黄珊瑚',
    prompt:
      'Style: summer kids. Layout: water splashes with beach icons. Colors: aqua, sunny yellow, coral. Elements: waves, flip-flops, ice lollies. Vibe: bright and fun.',
    tags: ['夏天', '海滩', '清凉']
  },
  {
    id: 'snow_day',
    name: 'Snow Day 下雪啦',
    nameEn: 'Snow Kids',
    category: 'pattern',
    description: '雪人/手套/雪橇 - 冰蓝白红点缀',
    prompt:
      'Style: snow kids. Layout: snow dots and winter icons evenly tossed. Colors: icy blues, white, red accents. Elements: snowmen, mittens, sleds. Vibe: cozy and festive.',
    tags: ['冬天', '雪', '节日']
  },
  {
    id: 'butterfly_garden',
    name: 'Butterfly Garden 蝴蝶花园',
    nameEn: 'Butterfly Kids',
    category: 'pattern',
    description: '蝴蝶/花朵/闪光 - 柔和翅膀色绿色',
    prompt:
      'Style: butterfly kids. Layout: light flutter scatter with florals. Colors: pastel wings and greens. Elements: butterflies, flowers, sparkles. Vibe: gentle and pretty.',
    tags: ['蝴蝶', '花园', '女童']
  },

  // ========== 更多风格 ==========
  {
    id: 'bug_explorer',
    name: 'Bug Explorer 小虫探险',
    nameEn: 'Garden Bugs',
    category: 'pattern',
    description: '瓢虫/蜻蜓/甲虫 - 草绿红黑阳光黄',
    prompt:
      'Style: garden bugs. Layout: light multi-directional scatter with leaves and dots. Colors: grass green, red, black, sunshine yellow. Elements: ladybugs, dragonflies, beetles. Vibe: curious and bright.',
    tags: ['昆虫', '自然', '探索']
  },
  {
    id: 'space_robots',
    name: 'Space Robots 太空机器人',
    nameEn: 'Tech Kids Robots',
    category: 'pattern',
    description: '机器人/齿轮/卫星 - 钴蓝银霓虹绿',
    prompt:
      'Style: tech kids. Layout: semi-structured orbit paths with robot badges. Colors: cobalt, silver, neon green. Elements: robots, gears, satellites. Vibe: futuristic and fun.',
    tags: ['机器人', '科技', '男童']
  },
  {
    id: 'pirate_adventure',
    name: 'Pirate Adventure 海盗冒险',
    nameEn: 'Pirate Kids',
    category: 'pattern',
    description: '海盗船/宝藏/骷髅 - 黑红金海蓝',
    prompt:
      'Style: pirate kids. Layout: diagonal motion with maps and ropes. Colors: black, red, gold and ocean blue. Elements: skulls, ships, treasure chests. Vibe: bold and adventurous.',
    tags: ['海盗', '冒险', '男童']
  },
  {
    id: 'knight_castle',
    name: 'Knight Castle 骑士城堡',
    nameEn: 'Medieval Play',
    category: 'pattern',
    description: '骑士/龙/城堡 - 宝蓝深红金石灰',
    prompt:
      'Style: medieval play. Layout: badges and shields evenly tossed. Colors: royal blue, crimson, gold and stone grey. Elements: knights, dragons, castles. Vibe: heroic and tidy.',
    tags: ['骑士', '冒险', '男童']
  },
  {
    id: 'super_minis',
    name: 'Super Minis 迷你英雄',
    nameEn: 'Mini Superheroes',
    category: 'pattern',
    description: '披风/面具/徽章 - 原色明亮黑',
    prompt:
      'Style: mini superhero kids. Layout: action badges and lightning scatter. Colors: primary brights with black. Elements: capes, masks, emblems. Vibe: energetic and clean.',
    tags: ['英雄', '动作', '男童']
  },
  {
    id: 'skate_park',
    name: 'Skate Park 滑板公园',
    nameEn: 'Skate Kids',
    category: 'pattern',
    description: '滑板/轮子/涂鸦 - 黑霓虹点缀',
    prompt:
      'Style: skate kids. Layout: dynamic badges with sparks. Colors: black, neon accents. Elements: boards, wheels, graffiti marks. Vibe: edgy and fun.',
    tags: ['滑板', '街头', '潮流']
  },
  {
    id: 'camping_night',
    name: 'Camping Night 露营之夜',
    nameEn: 'Camping Kids',
    category: 'pattern',
    description: '帐篷/篝火/灯笼 - 深绿藏青棕褐',
    prompt:
      'Style: camping kids. Layout: tents and badges under stars. Colors: deep green, navy, tan. Elements: tents, fires, lanterns. Vibe: cozy and adventurous.',
    tags: ['露营', '自然', '冒险']
  },
  {
    id: 'bee_buzz',
    name: 'Bee Buzz 小蜜蜂',
    nameEn: 'Bee Kids',
    category: 'pattern',
    description: '蜜蜂/蜂巢/花朵 - 黄黑白',
    prompt:
      'Style: bee kids. Layout: honeycomb hints with bees. Colors: yellow, black, white. Elements: bees, hives, flowers. Vibe: busy and friendly.',
    tags: ['蜜蜂', '自然', '可爱']
  },
  {
    id: 'sunshine_smile',
    name: 'Sunshine Smile 阳光笑脸',
    nameEn: 'Smiley Sun',
    category: 'pattern',
    description: '笑脸/太阳/光芒 - 向日葵黄橙天蓝',
    prompt:
      'Style: smile icons. Layout: medium density face icons with tiny stars. Colors: sunflower yellow, orange, sky blue. Elements: smiley faces, suns, rays. Vibe: bright and cheerful.',
    tags: ['笑脸', '阳光', '快乐']
  },
  {
    id: 'watercolor_soft',
    name: 'Watercolor Soft 水彩柔和',
    nameEn: 'Soft Watercolor',
    category: 'pattern',
    description: '水彩/花朵/小动物 - 柔和水彩淡色',
    prompt:
      'Style: soft watercolor. Layout: airy clusters with gentle edges. Colors: pale pastels, diluted brights. Elements: clouds, florals, small animals. Vibe: dreamy and calm.',
    tags: ['水彩', '柔和', '艺术']
  },
  {
    id: 'trex_kids',
    name: 'Trex Kids 霸王龙童趣',
    nameEn: 'T-Rex Kids',
    category: 'pattern',
    description: '霸王龙/骨头/脚印 - 绿橙黑',
    prompt:
      'Style: T-rex kids. Layout: bold dino heads with tracks. Colors: green, orange, black. Elements: T-rex, bones, footprints. Vibe: loud and fun.',
    tags: ['恐龙', '霸王龙', '男童']
  },
  {
    id: 'baby_icons',
    name: 'Baby Icons 婴童图标',
    nameEn: 'Baby Icons',
    category: 'pattern',
    description: '奶瓶/摇铃/云朵 - 奶白腮红薄荷',
    prompt:
      'Style: baby icons. Layout: pacifiers and toys tossed. Colors: milk white, blush, mint. Elements: bottles, rattles, clouds. Vibe: gentle and clean.',
    tags: ['婴童', '简约', '柔和']
  },
  {
    id: 'fairground',
    name: 'Fairground 嘉年华',
    nameEn: 'Fair Kids',
    category: 'pattern',
    description: '旋转木马/气球/门票 - 明亮白底',
    prompt:
      'Style: fair kids. Layout: rides and treats tossed. Colors: brights and whites. Elements: carousels, balloons, tickets. Vibe: joyful and dense.',
    tags: ['嘉年华', '游乐场', '欢乐']
  },
  {
    id: 'sticker_collage',
    name: 'Sticker Collage 贴纸拼贴',
    nameEn: 'Sticker Bomb',
    category: 'pattern',
    description: '标签/标记/图标 - 混合明亮',
    prompt:
      'Style: sticker-bomb. Layout: overlapping sticker clusters. Colors: mixed brights. Elements: labels, tags, icons. Vibe: chaotic but readable.',
    tags: ['贴纸', '拼贴', '潮流']
  },
  {
    id: 'emoji_party',
    name: 'Emoji Party 表情派对',
    nameEn: 'Emoji Kids',
    category: 'pattern',
    description: '表情/爱心/星星 - 黄底明亮色',
    prompt:
      'Style: emoji kids. Layout: medium density faces with stickers. Colors: yellow base with brights. Elements: emojis, hearts, stars. Vibe: humorous and simple.',
    tags: ['表情', '趣味', '简单']
  },
  {
    id: 'galaxy_gradient',
    name: 'Galaxy Gradient 星系渐变',
    nameEn: 'Space Gradient',
    category: 'pattern',
    description: '星系/星球/彗星 - 深蓝霓虹渐变',
    prompt:
      'Style: space gradient. Layout: full all-over star field with icons. Colors: deep navy to neon gradient. Elements: planets, rings, comets. Vibe: dreamy and techy.',
    tags: ['星系', '渐变', '科幻']
  },
  {
    id: 'hologram_dream',
    name: 'Hologram Dream 全息梦境',
    nameEn: 'Holographic Kids',
    category: 'pattern',
    description: '宝石/星星/碎片 - 珍珠彩虹',
    prompt:
      'Style: holographic kids. Layout: airy motifs with rainbow sheen hint. Colors: pearl rainbow. Elements: gems, stars, shards. Vibe: magical and sleek.',
    tags: ['全息', '梦幻', '潮流']
  }
]

// ==================== 图案风格工具函数 ====================

/**
 * 根据分类获取图案风格预设
 */
export function getPatternPresetsByCategory(category?: string): PatternStylePreset[] {
  if (!category) return PATTERN_STYLE_PRESETS
  return PATTERN_STYLE_PRESETS.filter((preset) => preset.category === category)
}

/**
 * 根据标签搜索图案风格预设
 */
export function searchPatternPresets(keyword: string): PatternStylePreset[] {
  const lowerKeyword = keyword.toLowerCase()
  return PATTERN_STYLE_PRESETS.filter(
    (preset) =>
      preset.name.toLowerCase().includes(lowerKeyword) ||
      preset.nameEn.toLowerCase().includes(lowerKeyword) ||
      preset.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword))
  )
}

/**
 * 根据ID获取图案风格预设
 */
export function getPatternStylePresetById(id: string): PatternStylePreset | undefined {
  return PATTERN_STYLE_PRESETS.find((preset) => preset.id === id)
}

/**
 * 构建完整的图案生成提示词
 */
export function buildPatternStylePrompt(
  stylePreset: PatternStylePreset,
  customElements?: string,
  colorScheme?: string
): string {
  let prompt = stylePreset.prompt

  if (customElements) {
    prompt += ` Additional elements: ${customElements}.`
  }

  if (colorScheme) {
    prompt += ` Color scheme preference: ${colorScheme}.`
  }

  return prompt
}

// ==================== 向后兼容常量（从 nodePrompts.ts 迁移）====================

/**
 * 图案生成节点的系统提示词
 * Pattern Generation System Prompt
 *
 * 用于 GeminiGenerateNode 中的 gemini_pattern 模式
 */
export const PATTERN_SYSTEM_PROMPT = `[Role: Expert Textile Designer]
You create seamless commercial all-over prints for fabric using advanced pattern generation capabilities.

[Core Responsibilities]
1. Extract elements from reference images to generate seamlessly tileable fabric patterns
2. Ensure unified style and visual harmony
3. Adapt to garment printing application scenarios
4. Generate truly commercial-grade patterns usable for fabric printing

[Seamless Requirements]
- Tile must be perfectly seamless horizontally and vertically
- Any motif touching an edge must continue exactly on the opposite edge
- No seams, borders, fade-outs or vignettes at the tile edges
- Resolution and detail must be high enough for fabric printing

[Layout Rules]
- Organic, multi-directional tossed layout (no clear 'up' or 'down')
- Avoid any visible grid, rows or columns
- Use a mix of large, medium and small motif sizes
- Distribute motifs with natural variation in spacing; avoid obvious repetition or 'checkerboard' feel

[Print Behavior]
- Visual density should feel balanced when tiled many times
- Motifs should remain readable but not oversized; pattern should feel like real clothing fabric

[Repeat Integrity Checklist]
- Edge-wrapped motifs must align pixel-perfect across opposite edges
- Avoid linear rows/columns even at large tiling
- Keep micro-fillers consistent to reduce visible repetition

[Mode A: Element Remix - Reference + Prompt]
- Extract useful motifs from the reference (characters, icons, florals, shapes)
- Remix them into a fresh, dynamic seamless all-over pattern
- Maintain the essence of the reference while improving composition and repeat quality
- Use varied scale and rotation so the pattern feels organic and less mechanical
- Normalise colours to match the preset/reference for coherent set usage

[Mode B: Pure Seamless - Reference Only]
- Use elements from the reference image as motifs
- Rearrange and adapt them into a technically perfect seamless repeat
- Preserve the original style, colour palette and mood as much as possible
- Clean up any awkward overlaps, tangents or negative spaces
- Focus on structure, repeat and layout quality

[Style Presets Library]

**Y2K Millennium**: Acid Y2K club graphic. Layout: chaotic tossed icons, overlaps and sticker clusters. Colors: neon and chrome. Elements: flames, butterflies, tribal swirls and chrome hearts.

**Boho**: Cottagecore boho. Layout: slightly irregular clusters and trails. Colors: warm earthy pastels. Elements: wildflowers, leaves and mushrooms.

**Retro 70s**: 1970s groovy. Layout: dense, flowing bands and flowers with almost no empty space. Colors: orange, brown, mustard and cream. Elements: wavy stripes, daisies and warped checks.

**Cute Cartoon**: Dopamine-kids cartoon. Layout: playful tossed icons with big–small contrast. Colors: candy brights. Elements: cute animals, sweets and toys.

**Dino Party**: Cute dinosaur party. Layout: tossed dinos walking in different directions with small filler icons. Colors: soft greens, blues and oranges. Elements: chubby dinos, footprints, rocks and volcanoes.

**Unicorn Dream**: Magical unicorn princess. Layout: light, airy tossed motifs with floating clouds. Colors: pastel rainbow and iridescent accents. Elements: unicorns, rainbows, hearts, stars and tiaras.

**Space Explorer**: Kids space adventure. Layout: full all-over galaxy with orbiting elements. Colors: navy or black night sky with neon accents. Elements: astronauts, rockets, planets, UFOs and stars.

**Kawaii Animal Parade**: Kawaii animal parade. Layout: evenly spaced tossed characters with tiny icons between. Colors: soft pastels with brown line art. Elements: bears, bunnies, puppies, snacks and tiny hearts.

[Technical Requirements]
- High resolution, clear details
- Clean edges, no aliasing
- Moderate color saturation, no distortion
- Ensure perfect edge alignment when seamlessly tiled

[Output Requirements]
Generate seamless patterns directly usable for fabric printing, including:
- Pattern theme and style
- Element composition and layout
- Color scheme
- Verified seamless tiling effect`

/**
 * 向后兼容的 GEMINI_GENERATE_PROMPTS 常量
 * 供 GeminiGenerateNode/executor.ts 使用
 */
export const GEMINI_GENERATE_PROMPTS = {
  gemini_pattern: {
    nodeType: 'gemini_pattern',
    displayName: '图案设计专家',
    category: '图像生成',
    description: '专门设计和生成各类图案、纹理、装饰元素',
    systemPrompt: PATTERN_SYSTEM_PROMPT,
    userPromptTemplate: '设计一个符合要求的无缝图案'
  }
} as const
