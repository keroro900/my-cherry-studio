/**
 * 电商图生成专用提示词和预设
 * E-commerce Image Generation Prompts and Presets
 *
 * 从 GeminiEcomNode/executor.ts 提取的内联常量
 */

// ==================== 风格预设 ====================

/**
 * 电商平台风格预设
 */
export const ECOM_STYLE_PRESETS: Record<string, { background: string; props: string; lighting: string; mood: string }> =
  {
    shein: {
      background: 'Clean white or light gray gradient background',
      props: 'Minimalist, no props or few fashion accessories',
      lighting: 'Soft even professional studio lighting',
      mood: 'Young fashionable, vibrant colors, Instagram-worthy aesthetic'
    },
    temu: {
      background: 'Pure white or light colored scene background',
      props: 'Practical scene props, emphasizing value',
      lighting: 'Bright and clear, product-focused',
      mood: 'Affordable friendly, clear display, emphasizing product details'
    },
    amazon: {
      background: 'Pure white background (#FFFFFF)',
      props: 'No props, product as main focus',
      lighting: 'Even white light, no shadows',
      mood: 'Professional e-commerce standard, clear and accurate'
    },
    taobao: {
      background: 'Lifestyle scene or solid color background',
      props: 'Daily life props, warm and cozy feel',
      lighting: 'Natural soft light',
      mood: 'Lifestyle scene, approachable and friendly'
    },
    xiaohongshu: {
      background: 'Refined scene background with atmosphere',
      props: 'Refined small items, coffee, flowers, magazines',
      lighting: 'Soft side light with depth',
      mood: 'Refined aesthetics, atmospheric, premium feel'
    },
    sweet: {
      background: 'Light pink or cream warm background',
      props: 'Strawberries, cherries, teddy bears, bows',
      lighting: 'Soft warm light',
      mood: 'Sweet and cute, warm and soft, girly charm'
    },
    pajamas: {
      background: 'Cozy bedroom scene, bedding and blankets',
      props: 'Pillows, blankets, eye masks, night lights',
      lighting: 'Warm soft light',
      mood: 'Cozy relaxing, comfortable homey atmosphere'
    },
    sporty: {
      background: 'Sports venue or outdoor scene',
      props: 'Sports equipment, water bottles, athletic accessories',
      lighting: 'Bright energetic light',
      mood: 'Dynamic and active, healthy and positive'
    },
    street: {
      background: 'Urban street or industrial style scene',
      props: 'Skateboard, graffiti wall, cool accessories',
      lighting: 'Strong contrast light',
      mood: 'Street cool vibe, bold personality'
    },
    kpop: {
      background: 'Clean modern background',
      props: 'Korean style items, minimalist accessories',
      lighting: 'Soft even light',
      mood: 'K-pop trendy, clean fashion, neat and stylish'
    },
    school: {
      background: 'Campus or library scene',
      props: 'Books, stationery, backpacks',
      lighting: 'Bright natural light',
      mood: 'Student vibe, neat and proper, youthful energy'
    },
    ip_theme: {
      background: 'Theme background designed based on IP character',
      props: 'Related IP merchandise and character elements',
      lighting: 'Lighting matching IP atmosphere',
      mood: 'Unified theme, character immersion'
    },
    summer: {
      background: 'Beach ocean or outdoor grass field',
      props: 'Sunglasses, straw hats, cold drinks, beach balls',
      lighting: 'Bright sunny light',
      mood: 'Summer refreshing, vacation atmosphere'
    }
  }

// ==================== 布局模式提示词 ====================

/**
 * 电商图布局模式提示词
 */
export const ECOM_LAYOUT_PROMPTS: Record<string, { pose: string; angle: string; arrangement: string }> = {
  flat_lay: {
    pose: 'Garment laid flat, naturally arranged',
    angle: 'Top-down view photography',
    arrangement: 'Top and bottom coordinated display, complete set effect'
  },
  hanging: {
    pose: 'Hanger shot, natural drape',
    angle: 'Front eye-level view',
    arrangement: 'Display garment silhouette and drape'
  },
  model: {
    pose: 'Invisible mannequin wearing effect',
    angle: 'Front view with slight angle',
    arrangement: 'Display wearing effect with body volume'
  }
}

// ==================== 细节类型提示词 ====================

/**
 * 电商细节图类型提示词
 */
export const ECOM_DETAIL_PROMPTS: Record<string, { focus: string; requirement: string }> = {
  collar: {
    focus: 'Collar close-up',
    requirement: 'Show collar design, stitching craft, inner label'
  },
  print: {
    focus: 'Print/pattern detail',
    requirement: 'Macro shot showing print ink texture, color saturation'
  },
  fabric: {
    focus: 'Fabric texture',
    requirement: 'Show weave texture, fabric thickness, tactile quality'
  },
  button: {
    focus: 'Button/zipper detail',
    requirement: 'Show button material, stitching craft'
  },
  pocket: {
    focus: 'Pocket/waistband detail',
    requirement: 'Show functional design, decorative details'
  },
  sleeve: {
    focus: 'Cuff detail',
    requirement: 'Show cuff stitching, elastic ribbing'
  },
  hem: {
    focus: 'Hem detail',
    requirement: 'Show stitching quality, drape effect'
  },
  ankle: {
    focus: 'Ankle/pant leg detail',
    requirement: 'Show pant leg hem, elastic design, stitching craft'
  }
}

// ==================== 主题背景规则（从 core 重新导出）====================

// 从核心模块导入，避免重复定义
import { PROFESSIONAL_STYLING_RULES, THEME_BACKGROUND_RULES } from '../core/themes'

/**
 * 电商图主题背景规则（别名导出，保持向后兼容）
 * @see THEME_BACKGROUND_RULES in prompts/core/themes.ts
 */
export const ECOM_THEME_BACKGROUND_RULES = THEME_BACKGROUND_RULES

/**
 * 电商图专业造型规则（别名导出，保持向后兼容）
 * @see PROFESSIONAL_STYLING_RULES in prompts/core/themes.ts
 */
export const ECOM_PROFESSIONAL_STYLING_RULES = PROFESSIONAL_STYLING_RULES

// ==================== 辅助函数 ====================

/**
 * 获取风格预设
 */
export function getEcomStylePreset(
  styleId: string
): { background: string; props: string; lighting: string; mood: string } | undefined {
  return ECOM_STYLE_PRESETS[styleId]
}

/**
 * 获取布局提示词
 */
export function getEcomLayoutPrompt(
  layoutId: string
): { pose: string; angle: string; arrangement: string } | undefined {
  return ECOM_LAYOUT_PROMPTS[layoutId]
}

/**
 * 获取细节提示词
 */
export function getEcomDetailPrompt(detailId: string): { focus: string; requirement: string } | undefined {
  return ECOM_DETAIL_PROMPTS[detailId]
}
