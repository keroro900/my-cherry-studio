/**
 * GeminiEcomNode 专用提示词
 * Gemini E-commerce Node Prompts
 *
 * 【重要】此文件为向后兼容层
 * 新代码应直接从 '../../../prompts' 导入
 */

// ==================== 从统一模块重新导出 ====================

// 从新预设注册表导入
export { SCENE_PRESETS, STYLE_MODE_PRESETS } from '../../../presets'
export {
  ECOM_DETAIL_PROMPTS,
  ECOM_LAYOUT_PROMPTS,
  ECOM_PROFESSIONAL_STYLING_RULES,
  ECOM_STYLE_PRESETS,
  ECOM_THEME_BACKGROUND_RULES,
  HARD_RULES,
  RECREATION_CONCEPT
} from '../../../prompts'

// ==================== 类型定义 ====================

export interface GeminiEcomPromptConfig {
  layout?: 'flat_lay' | 'hanging' | 'model'
  fillMode?: 'filled' | 'flat'
  stylePreset?: string
  garmentDescription?: string
  styleConstraint?: string
  extraNote?: string
  useSystemPrompt?: boolean
  imageSize?: string
  aspectRatio?: string
  professionalRetouch?: boolean
}

export interface EcomReferenceHints {
  isSet: boolean
  hasExtraRefs: boolean
}

/** 电商图布局类型 */
export type EcomLayoutType = 'flatlay' | 'hanging'

/** 电商图填充类型 */
export type EcomFillType = 'filled' | 'flat'

/** 电商细节图类型 */
export type EcomDetailType = 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'

// ==================== 向后兼容的别名 ====================

import {
  ECOM_DETAIL_PROMPTS,
  ECOM_LAYOUT_PROMPTS,
  ECOM_PROFESSIONAL_STYLING_RULES as _PROFESSIONAL_STYLING_RULES,
  ECOM_STYLE_PRESETS,
  ECOM_THEME_BACKGROUND_RULES as _THEME_BACKGROUND_RULES,
  RECREATION_CONCEPT as _RECREATION_CONCEPT
} from '../../../prompts'

// ==================== 填充模式提示词 ====================

export const GHOST_MANNEQUIN_RULES = `[Ghost Mannequin 3D Effect - CRITICAL REQUIREMENT]
Create visible internal volume and fullness, simulating professional ghost mannequin / invisible mannequin photography technique.
Imagine the clothes worn by an invisible child, using tissue paper or crepe paper filling technique:
- Body, chest, back, shoulders, sleeves, and pant legs all have air or filling support
- Form soft, rounded three-dimensional volume like real wearing posture
- Even if input reference shows flat garment, you MUST recreate it with 3D volume

[3D Detail Requirements]
- Collar, sleeve cuffs, pant legs must show reasonable inner shadows (inner shadow)
- Clear outline and contact shadow between garment and background for depth perception
- PROHIBIT paper-flat appearance - must have lift-off effect with perceivable distance from background
- Shoulders, chest, back should have natural bulge forming ergonomic 3D contour`

export const NATURAL_FLAT_RULES = `[Natural Flat Lay Mode - No Filling]
Let clothes lay flat naturally with slight flatness, but arrange hem, sleeves, and pant legs very neatly.
Maintain fabric thickness - not paper-thin like a sticker.
Focus on clean lines and professional styling.`

// ==================== 布局和填充文案 ====================

export const ECOM_LAYOUT_TEXT: Record<EcomLayoutType, string> = {
  flatlay: `[Layout Mode: Flat Lay - SHEIN/TEMU Standard]
Re-edit the input garment reference images into a SHEIN/TEMU style top-down flat lay e-commerce main image.
- Camera angle: Top-down view (90° vertical), professional product photography position
- Surface: Flat surface (white table, light background board, or themed blanket)
- Proportion: Maintain authentic garment proportions, no stretching or distortion
- Composition: Rule of thirds, garment centered with space for theme-matched props`,

  hanging: `[Layout Mode: Hanging Shot - SHEIN/TEMU Standard]
Re-edit the input garment reference images into a SHEIN/TEMU style hanging e-commerce main image.
- Hanger: Simple wooden or minimalist white hanger
- Drape: Natural hanging drape showing garment flow and fabric weight
- Camera: Front eye-level view with slight angle (5-10 degrees)
- Background: Clean simple background with theme-coordinated color`
}

export const ECOM_FILL_TEXT: Record<EcomFillType, string> = {
  filled: `[Ghost Mannequin 3D Effect - CRITICAL REQUIREMENT]
Create visible internal volume and fullness, simulating professional ghost mannequin / invisible mannequin photography technique.
Imagine the garment worn by an invisible child, using tissue paper or crepe paper filling technique:
- Body, chest, back, shoulders, sleeves, and pant legs all have air or filling support inside
- Form soft, rounded three-dimensional volume, like real wearing posture
- Even if input reference shows flat garment, you MUST recreate it with 3D volume

[3D Detail Requirements]
- Collar, cuffs, pant legs must show reasonable inner shadows (inner shadow effect)
- Clear outline and contact shadow between garment and background for depth perception
- Garment must NOT look paper-flat, must have lift-off effect from background
- Shoulders and chest should have natural bulge forming ergonomic 3D contour

[Professional Retouching - CRITICAL]
- REDUCE all unnecessary wrinkles and messiness
- Keep ONLY necessary structural folds (sleeve cuffs, pant leg natural gathering)
- REMOVE shipping creases, random folding dead creases, unnatural twists
- Silhouette must be clear, neat, 3D with smooth lines

[Strict Prohibition]
NO real human body, models, mannequins, or any body parts visible - only the garment itself.`,

  flat: `[Natural Flat Lay Mode - No Filling]
- Let garment lay naturally flat without strong internal filling
- Fabric appears slightly flat but maintain realistic thickness
- Hem, sleeves, pant legs must be arranged very neatly and smoothly
- Still must have fabric thickness - cannot look paper-thin like a sticker
- Clean professional retouching, clear silhouette lines`
}

// ==================== 其他常量 ====================

export const ECOM_STYLING_RULES = _PROFESSIONAL_STYLING_RULES
export const ECOM_AUTO_STYLE_RULES = _THEME_BACKGROUND_RULES

export const ECOM_KEEP_CLOTHES_RULES = `[Data Consistency - 100% Garment Detail Reproduction]
- Strictly preserve: colors, patterns, print text, IP character designs and positions
- Strictly preserve: fabric texture, silhouette proportions, collar/sleeve/pant length
- DO NOT modify patterns, DO NOT move patterns to background, DO NOT arbitrarily scale
- Only this one set appears in the output, plus optional props (shoes, hats, toys, books)
- NO real human body, models, mannequins, or any body parts visible`

export const ECOM_NEGATIVE_PROMPT =
  'text, watermark, logo, writing, letters, signature, low quality, lowres, blurry, bad anatomy, human body, human model, mannequin, face, hands, limbs, deformed, distorted, disfigured, bad proportions, muddy colors, dark shadows, underexposed, multiple outfits, pile of clothes, messy background, illustration, painting, cartoon, 3d render style, flat paper look'

export const ECOM_LIGHTING_TEXT = `[Lighting and Texture Requirements]
- Use soft, even studio lighting (soft studio lighting), clean and bright image, natural and accurate colors
- Lighting should have depth and dimension, creating realistic 3D feel
- Garment must have realistic fabric texture and material feel, fabric weave clearly visible but not over-sharpened
- Maintain natural light-shadow transitions, avoid overly flat appearance

[Negative Prompts - Prohibited Elements]
${ECOM_NEGATIVE_PROMPT}`

// ==================== 细节图提示词 ====================

export const ECOM_DETAIL_PROMPTS_LEGACY: Record<EcomDetailType, string> = {
  collar: `[Detail Type: Collar Close-up]
Zoom into the collar area to show collar design details:
- Collar type (crew neck, V-neck, polo collar, mandarin collar, etc.)
- Stitching craft and seam lines
- Collar material and texture
- Decorations (lace, embroidery, prints) if present must be clearly shown
Maintain same lighting and background style as main image.`,

  sleeve: `[Detail Type: Cuff Close-up]
Zoom into the cuff area to show cuff design details:
- Cuff style (ribbed, folded, elastic, etc.)
- Stitching craft
- Cuff material and texture
- Decorations if present must be clearly shown
Maintain same lighting and background style as main image.`,

  hem: `[Detail Type: Hem Close-up]
Zoom into the hem area to show hem design details:
- Hem style (straight, curved, split, etc.)
- Stitching craft and seam lines
- Hem material and texture
- Decorations if present must be clearly shown
Maintain same lighting and background style as main image.`,

  print: `[Detail Type: Print Close-up]
Zoom into the print/pattern area to show print design details:
- Print design and colors
- Printing technique (screen print, heat transfer, embroidery, etc.)
- Print texture and layers
- Print completeness and clarity
Maintain same lighting and background style as main image.`,

  waistband: `[Detail Type: Waistband Close-up]
Zoom into the waistband area to show waistband design details:
- Waistband style (elastic, drawstring, button, etc.)
- Waistband width and elasticity
- Stitching craft
- Decorations if present must be clearly shown
Maintain same lighting and background style as main image.`,

  fabric: `[Detail Type: Fabric Texture Close-up]
Zoom in to show fabric texture details:
- Fabric material (cotton, polyester, blend, etc.)
- Fabric weave and texture pattern
- Fabric feel and tactile quality representation
- Fabric sheen and breathability representation
Maintain same lighting and background style as main image.`,

  ankle: `[Detail Type: Ankle/Pant Leg Close-up]
Zoom into the pant leg/ankle area to show design details:
- Pant leg style (straight, tapered, cuffed, etc.)
- Stitching craft
- Pant leg material and texture
- Decorations if present must be clearly shown
Maintain same lighting and background style as main image.`,

  backneck: `[Detail Type: Back Neck Close-up]
Zoom into the back neck area to show back neck design details:
- Back neck style and design
- Label/tag position and style
- Back neck stitching craft
- Decorations if present must be clearly shown
Maintain same lighting and background style as main image.`
}

// ==================== 辅助函数 ====================

/** 根据服装描述生成风格提示 */
export function buildStyleHints(garmentDesc: string): string {
  const desc = (garmentDesc || '').toLowerCase()
  const zh = garmentDesc || ''
  const hints: string[] = []

  if (desc.includes('kpop') || desc.includes('k-pop') || zh.includes('韩')) {
    hints.push('整体风格偏 Kpop / 韩系童装，版型略宽松，搭配简洁有一点潮流感。')
  }
  if (['睡衣', '家居', '居家', '睡裙'].some((k) => zh.includes(k))) {
    hints.push('这是睡衣 / 家居服，整体氛围要柔软、放松、温暖。')
  }
  if (['运动', '球服', '篮球', '足球', '训练'].some((k) => zh.includes(k))) {
    hints.push('风格偏运动 / 活力，构图可以更有动感。')
  }
  if (['校服', '制服'].some((k) => zh.includes(k))) {
    hints.push('这是校服 / 制服类型单品，整体气质要干净、端正。')
  }
  if (['女童', '公主', '草莓', '樱桃', '爱心', '蕾丝'].some((k) => zh.includes(k))) {
    hints.push('整体偏女童可爱 / 甜美风，颜色可以稍微偏粉嫩、奶油色。')
  }

  if (!hints.length) return ''
  return `\n\n风格补充说明（根据服装描述自动推断）：\n${hints.map((h) => `- ${h}`).join('\n')}`
}

// ==================== 向后兼容的提示词构建函数 ====================

/**
 * 构建电商主图提示词
 * @deprecated 新代码请使用 EcomPromptBuilder
 */
export function buildEcomMainPrompt(
  layout: EcomLayoutType = 'flatlay',
  fill: EcomFillType = 'filled',
  garmentDesc: string = ''
): string {
  const layoutText = ECOM_LAYOUT_TEXT[layout]
  const fillText = ECOM_FILL_TEXT[fill]
  const styleHints = buildStyleHints(garmentDesc)

  return `[Role: Professional Kids' Clothing E-commerce Photographer and Retoucher - SHEIN/TEMU Specialist]

You need to re-create professional e-commerce main images based on input garment reference images.

${_RECREATION_CONCEPT}

[Reference Images - IMPORTANT]
- Image 1: TOP garment front view (must appear in the output)
- Image 2: BOTTOM garment front view (must appear in the output if provided)
- Image 3+: Back views, detail shots, or print references (for reference only)

${layoutText}

${fillText}
${styleHints}

${ECOM_STYLING_RULES}

${ECOM_AUTO_STYLE_RULES}

${ECOM_KEEP_CLOTHES_RULES}

${ECOM_LIGHTING_TEXT}

${garmentDesc ? `[Garment Description]\n${garmentDesc}` : ''}`
}

/**
 * 构建电商背面图提示词
 * @deprecated 新代码请使用 EcomPromptBuilder
 */
export function buildEcomBackPrompt(): string {
  return `[Back View Generation - Same Scene Style]

Generate a back view photo of the garment based on the main image scene style.

[Core Requirements]
1. Maintain exactly the same scene, background, props and lighting style as the main image
2. Only change the garment orientation to show the back design
3. Strictly reproduce all back details: patterns, prints, text, silhouette
4. Maintain the same composition ratio and visual style`
}

/**
 * 构建电商细节图提示词
 * @deprecated 新代码请使用 EcomPromptBuilder
 */
export function buildEcomDetailPrompt(detailType: EcomDetailType): string {
  const detailPrompt = ECOM_DETAIL_PROMPTS_LEGACY[detailType]

  return `[Detail Close-up Generation - Same Scene Style]

Generate a detail close-up photo of the garment based on the main image scene style.

${detailPrompt}

[Core Requirements]
1. Zoom in and focus on the specified detail area
2. Maintain consistent lighting and background style with main image
3. Details must be clearly visible, showing craftsmanship and texture`
}

// ==================== 新版提示词构建函数 ====================

/**
 * 构建主图提示词（新版）
 */
export function buildMainPrompt(
  config: GeminiEcomPromptConfig,
  _index: number = 0,
  referenceHints?: EcomReferenceHints
): string {
  const isSet = !!referenceHints?.isSet
  const hasExtraRefs = !!referenceHints?.hasExtraRefs
  const parts: string[] = []

  parts.push(_RECREATION_CONCEPT)

  if (config.useSystemPrompt) {
    parts.push(`[Role: Professional Kids' Clothing E-commerce Photographer and Retoucher]`)
  }

  parts.push(`[Reference Images - IMPORTANT]
- Image 1: TOP garment front view (must appear in the output)
${isSet ? '- Image 2: BOTTOM garment front view (must appear in the output)' : ''}
${hasExtraRefs ? '- Additional images: for reference only' : ''}`)

  const layout = ECOM_LAYOUT_PROMPTS[config.layout || 'flat_lay'] || ECOM_LAYOUT_PROMPTS.flat_lay
  if (config.layout === 'flat_lay') {
    parts.push(`[Flat Lay Photography Mode - SHEIN/TEMU Standard]
Camera angle: Top-down view (90° vertical)
Composition: Rule of thirds, garment centered`)
  } else {
    parts.push(`[${layout.pose}]\n${layout.angle}, ${layout.arrangement}`)
  }

  parts.push(config.fillMode === 'filled' ? GHOST_MANNEQUIN_RULES : NATURAL_FLAT_RULES)
  parts.push(_PROFESSIONAL_STYLING_RULES)

  if (config.stylePreset === 'auto' || !config.stylePreset) {
    parts.push(`[Style Auto-Detection]\n${_THEME_BACKGROUND_RULES}`)
  } else {
    const stylePreset = ECOM_STYLE_PRESETS[config.stylePreset] || ECOM_STYLE_PRESETS.shein
    parts.push(`[Style: ${config.stylePreset}]
Background: ${stylePreset.background}
Props: ${stylePreset.props}
Lighting: ${stylePreset.lighting}`)
  }

  if (config.garmentDescription) {
    parts.push(`[Garment Description]\n${config.garmentDescription}`)
  }
  if (config.styleConstraint) {
    parts.push(`[Custom Style Constraint]\n${config.styleConstraint}`)
  }

  parts.push(`[Quality] ${config.imageSize || '2K'}, ${config.aspectRatio || '3:4'}, sharp, accurate colors.`)
  parts.push(`[Strict Prohibitions] NO human body, NO watermarks, NO multiple outfits`)

  if (config.extraNote) {
    parts.push(`[Extra] ${config.extraNote}`)
  }

  parts.push(`[Output] Generate image directly.`)

  return parts.join('\n\n')
}

/**
 * 构建背面图提示词（新版）
 */
export function buildBackPrompt(
  config: GeminiEcomPromptConfig,
  hasBackReference: boolean = false,
  referenceHints?: EcomReferenceHints
): string {
  const base = buildMainPrompt(config, 0, referenceHints)

  if (hasBackReference) {
    return `${base}

BACK VIEW GENERATION with reference images:
- The last image(s) are BACK VIEW reference photos
- Generate a professional back view matching the front view style`
  } else {
    return `${base}

BACK VIEW GENERATION (inferred):
- Generate a professional back view based on front view style
- Infer back design from the garment style`
  }
}

/**
 * 构建细节图提示词（新版）
 */
export function buildDetailPrompt(config: GeminiEcomPromptConfig, detailType: string): string {
  const detail = ECOM_DETAIL_PROMPTS[detailType] || ECOM_DETAIL_PROMPTS.collar
  const parts: string[] = []

  parts.push(`Macro detail shot: ${detail.focus}`)
  parts.push(detail.requirement)
  parts.push('Extreme close-up, sharp focus, high detail visibility.')
  parts.push('Soft even lighting to show texture and quality.')

  if (config.professionalRetouch) {
    parts.push('Professional product photography quality.')
  }

  parts.push(`${config.imageSize || '2K'} resolution, 1:1 square format.`)

  return parts.join(' ')
}

/**
 * 构建移动端版本提示词
 */
export function buildMobilePrompt(config: GeminiEcomPromptConfig, referenceHints?: EcomReferenceHints): string {
  const base = buildMainPrompt(config, 0, referenceHints)
  return `${base} MOBILE VERSION: Compact composition for small screens. 1:1 square format.`
}

/**
 * 构建负面提示词
 */
export function buildNegativePrompt(_config: GeminiEcomPromptConfig, referenceHints?: EcomReferenceHints): string {
  const isSet = !!referenceHints?.isSet
  const outfitNegatives = isSet ? ['missing top', 'missing bottom', 'incomplete set'] : ['multiple outfits']

  return [
    'text',
    'watermark',
    'logo',
    'low quality',
    'blurry',
    'human body',
    'mannequin',
    'face',
    'hands',
    ...outfitNegatives,
    'illustration',
    'painting',
    'cartoon'
  ].join(', ')
}
