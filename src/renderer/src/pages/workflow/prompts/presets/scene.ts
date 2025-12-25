/**
 * 场景预设（单一来源）
 * Scene Presets (Single Source of Truth)
 *
 * - home: 室内家居场景（温馨、自然光、生活感）
 * - outdoor: 户外自然场景（明亮、自然、活力）
 * - studio: 专业影棚（三点布光、干净背景、商业级）
 * - playground: 儿童游乐场（活泼、彩色、动感）
 * - nature: 自然风景（金色时光、浪漫、温暖）
 */

import type { ScenePreset } from './types'

export const SCENE_PRESETS: Record<string, ScenePreset> = {
  home: {
    en: 'cozy indoor home setting',
    lighting: 'soft natural window light with warm ambient fill, golden hour quality',
    background: 'modern minimalist living room or bedroom, clean and tidy',
    props: 'comfortable furniture, soft cushions, warm blankets',
    foreground:
      'Natural living environment details like carpet texture, floor material, furniture edges. MUST include theme-related decorative elements.',
    midground:
      'Cozy indoor environment with sofa, windows, furniture. Soft lighting creates comfortable atmosphere. MUST include theme-related elements.',
    composition: 'iPhone-style smartphone photography, natural angle, slightly candid authentic perspective',
    visual_style: 'Authentic natural smartphone photo quality, slight film grain, natural color reproduction'
  },
  outdoor: {
    en: 'bright outdoor natural setting',
    lighting: 'natural daylight, soft diffused sunlight, no harsh shadows',
    background: 'lush green park or garden with blurred bokeh',
    props: 'natural greenery, flowers, playground elements',
    foreground:
      'Outdoor ground details like grass texture, pavement, steps. Include theme-related elements where appropriate.',
    midground: 'Park or playground environment with slides, swings, trees. Natural light and shadows.',
    composition: 'iPhone-style outdoor photography, natural angle capturing child in outdoor activity',
    visual_style: 'Authentic outdoor photo quality, natural lighting variation, realistic skin texture'
  },
  studio: {
    en: 'professional photography studio',
    lighting: 'three-point studio lighting, soft key light with fill and rim',
    background: 'clean white or light gray seamless backdrop',
    props: 'minimal, professional product photography setup',
    foreground: 'Clean studio floor or backdrop, neat and professional',
    midground: 'Professional studio environment with soft even lighting',
    composition: 'Professional studio shot, balanced composition highlighting garment and model',
    visual_style: 'High-quality professional photography, clean and sharp, accurate colors, e-commerce ready'
  },
  playground: {
    en: 'colorful children playground',
    lighting: 'bright natural daylight, cheerful atmosphere',
    background: 'playground equipment, slides, swings with safety surfacing',
    props: 'playground toys, balls, colorful elements'
  },
  nature: {
    en: 'beautiful natural outdoor scene',
    lighting: 'golden hour sunlight, warm and soft',
    background: 'forest path, flower meadow, or beach scene',
    props: 'natural elements, flowers, leaves, beach accessories'
  }
} as const

/**
 * 获取场景预设
 */
export function getScenePreset(key: string): ScenePreset | undefined {
  return SCENE_PRESETS[key]
}

/**
 * 获取所有场景键
 */
export function getScenePresetKeys(): string[] {
  return Object.keys(SCENE_PRESETS)
}
