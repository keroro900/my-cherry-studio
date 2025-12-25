/**
 * 电商风格预设注册表
 * E-commerce Style Preset Registry
 *
 * 包含：
 * - SHEIN 风格
 * - TEMU 风格
 * - Amazon 风格
 * - 淘宝风格
 * - 小红书风格
 *
 * 【Single Source of Truth】
 * UI 选项自动从此注册表生成，添加/删除预设时 UI 自动同步
 *
 * @module presets/ecomStyle
 */

import { createPresetCategory } from './types'

// ==================== 类型定义 ====================

/**
 * 电商风格预设 ID
 */
export type EcomStyleId = 'shein' | 'temu' | 'amazon' | 'taobao' | 'xiaohongshu'

/**
 * 扩展的预设定义，包含电商特有字段
 */
export interface EcomStylePresetDefinition {
  /** 唯一标识符 */
  id: string
  /** UI 显示名称 */
  label: string
  /** 平台名称 */
  platform: string
  /** 悬停提示/描述 */
  description: string
  /** 系统提示词 */
  systemPromptBlock: string
  /** 风格关键词 */
  styleKeywords: string[]
  /** 光线设置 */
  lighting: string
  /** 背景设置 */
  background: string
  /** 姿势建议 */
  pose: string
  /** 色调 */
  colorTone: string
  /** 相机参数 */
  cameraParams: string
}

// ==================== 预设定义 ====================

const ECOM_STYLE_PRESET_DEFINITIONS: Record<EcomStyleId, EcomStylePresetDefinition> = {
  shein: {
    id: 'shein',
    label: 'SHEIN 风格',
    platform: 'SHEIN',
    description: '年轻时尚、色彩鲜艳、活力四射的快时尚风格',
    systemPromptBlock: `You are a fashion photographer specializing in SHEIN-style e-commerce photography.

SHEIN Style Guidelines:
- Target audience: Young women (18-30), trendy and fashion-forward
- Aesthetic: Fresh, vibrant, Instagram-worthy
- Colors: Bright, saturated, eye-catching
- Mood: Playful, confident, youthful energy
- Background: Clean gradients, soft pastels, or trendy urban settings
- Poses: Dynamic, natural, social media friendly
- Lighting: Soft, flattering, minimal shadows

Key characteristics:
1. High color saturation
2. Clean, uncluttered backgrounds
3. Natural, relatable poses
4. Youthful energy and confidence
5. Instagram-ready composition`,
    styleKeywords: ['trendy', 'youthful', 'vibrant', 'instagram-worthy', 'fast-fashion'],
    lighting: 'soft studio lighting with minimal shadows, bright and even',
    background: 'clean white/gray gradient or soft pastel colors',
    pose: 'natural, confident, dynamic poses with slight movement',
    colorTone: 'bright, saturated, warm undertones',
    cameraParams: '85mm lens, f/2.8, eye-level angle, full body or 3/4 shot'
  },

  temu: {
    id: 'temu',
    label: 'TEMU 风格',
    platform: 'TEMU',
    description: '实惠亲民、清晰展示产品细节的实用风格',
    systemPromptBlock: `You are a product photographer specializing in TEMU-style e-commerce photography.

TEMU Style Guidelines:
- Target audience: Value-conscious shoppers of all ages
- Aesthetic: Clean, clear, product-focused
- Colors: Natural, true-to-life colors
- Mood: Approachable, trustworthy, practical
- Background: Pure white or light gray for clarity
- Poses: Simple, clear product display
- Lighting: Even, shadow-free, detail-revealing

Key characteristics:
1. Crystal clear product visibility
2. True-to-life color representation
3. Multiple angle suggestions
4. Detail-focused composition
5. Clean, distraction-free backgrounds`,
    styleKeywords: ['clear', 'practical', 'value', 'detail-focused', 'trustworthy'],
    lighting: 'bright, even lighting with soft shadows for depth',
    background: 'pure white (#FFFFFF) or light gray seamless',
    pose: 'simple, clear poses that showcase the garment structure',
    colorTone: 'natural, true-to-life, neutral white balance',
    cameraParams: '50mm lens, f/5.6, straight-on angle, full body shot'
  },

  amazon: {
    id: 'amazon',
    label: 'Amazon 风格',
    platform: 'Amazon',
    description: '专业标准、高质量、建立信任感的商业风格',
    systemPromptBlock: `You are a professional e-commerce photographer following Amazon's image guidelines.

Amazon Style Guidelines:
- Target audience: Mainstream consumers seeking quality
- Aesthetic: Professional, trustworthy, high-quality
- Colors: Accurate, consistent color representation
- Mood: Professional, reliable, premium feel
- Background: Pure white (RGB 255,255,255) required
- Poses: Professional, product-focused
- Lighting: Professional studio lighting

Key characteristics:
1. Pure white background (mandatory)
2. Product fills 85% of frame
3. Professional, consistent lighting
4. No props or distracting elements
5. High resolution and sharp focus

Amazon Technical Requirements:
- Main image: Pure white background
- Minimum 1000px on longest side
- Product fills at least 85% of frame
- No text, logos, or watermarks`,
    styleKeywords: ['professional', 'premium', 'trustworthy', 'high-quality', 'standard'],
    lighting: 'professional 3-point studio lighting, soft and even',
    background: 'pure white (RGB 255,255,255)',
    pose: 'professional, straight posture, product clearly visible',
    colorTone: 'accurate, consistent, professional color grading',
    cameraParams: '70mm lens, f/8, eye-level, full body with product filling 85% of frame'
  },

  taobao: {
    id: 'taobao',
    label: '淘宝风格',
    platform: '淘宝',
    description: '生活化场景、亲和力强的国内电商风格',
    systemPromptBlock: `You are a lifestyle photographer specializing in Taobao-style e-commerce photography.

Taobao Style Guidelines:
- Target audience: Chinese consumers, diverse age groups
- Aesthetic: Lifestyle-oriented, relatable, warm
- Colors: Warm, inviting, lifestyle-appropriate
- Mood: Friendly, approachable, aspirational
- Background: Lifestyle settings, home environments, outdoor scenes
- Poses: Natural, everyday life scenarios
- Lighting: Natural or warm artificial lighting

Key characteristics:
1. Lifestyle context and scenarios
2. Warm, inviting atmosphere
3. Relatable, everyday settings
4. Natural, candid poses
5. Story-telling composition`,
    styleKeywords: ['lifestyle', 'warm', 'relatable', 'chinese-style', 'everyday'],
    lighting: 'warm natural light or soft artificial lighting',
    background: 'lifestyle settings: home, cafe, park, street',
    pose: 'natural, candid, everyday life scenarios',
    colorTone: 'warm, slightly desaturated, film-like',
    cameraParams: '35mm lens, f/2.0, candid angle, environmental portrait'
  },

  xiaohongshu: {
    id: 'xiaohongshu',
    label: '小红书风格',
    platform: '小红书',
    description: '精致美学、氛围感强的社交电商风格',
    systemPromptBlock: `You are an aesthetic photographer specializing in Xiaohongshu (RED) style content.

Xiaohongshu Style Guidelines:
- Target audience: Young Chinese women (18-35), aesthetic-conscious
- Aesthetic: Refined, atmospheric, "高级感" (premium feel)
- Colors: Muted, sophisticated color palette
- Mood: Dreamy, aspirational, lifestyle-focused
- Background: Aesthetic settings, cafes, art spaces, nature
- Poses: Elegant, effortless, magazine-worthy
- Lighting: Soft, diffused, golden hour preferred

Key characteristics:
1. "高级感" (premium, sophisticated feel)
2. Muted, harmonious color palette
3. Atmospheric, dreamy quality
4. Elegant, effortless poses
5. Aesthetic background settings
6. Film-like color grading`,
    styleKeywords: ['aesthetic', 'premium', 'dreamy', 'sophisticated', 'xiaohongshu'],
    lighting: 'soft diffused light, golden hour, window light',
    background: 'aesthetic settings: minimalist interiors, cafes, art galleries, nature',
    pose: 'elegant, effortless, slightly candid, magazine-worthy',
    colorTone: 'muted, sophisticated, film-like, slight desaturation',
    cameraParams: '50mm lens, f/1.8, artistic angle, 3/4 or portrait shot'
  }
}

// ==================== 创建预设类别 ====================

/**
 * 电商风格预设注册表
 *
 * 使用方法：
 * - ECOM_STYLE_PRESETS.getOptions() - 获取下拉选项列表
 * - ECOM_STYLE_PRESETS.getPreset(id) - 获取完整预设定义
 * - ECOM_STYLE_PRESETS.getPromptBlocks(id) - 获取提示词片段
 */
export const ECOM_STYLE_PRESETS = {
  ...createPresetCategory<EcomStyleId>('ecom_style', '电商风格', ECOM_STYLE_PRESET_DEFINITIONS as any),

  /**
   * 获取完整的电商风格预设（包含所有扩展字段）
   */
  getFullPreset(id: EcomStyleId): EcomStylePresetDefinition | undefined {
    return ECOM_STYLE_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): EcomStylePresetDefinition[] {
    return Object.values(ECOM_STYLE_PRESET_DEFINITIONS)
  },

  /**
   * 构建完整的风格提示词
   */
  buildStylePrompt(id: EcomStyleId, additionalConstraints?: string): string {
    const preset = ECOM_STYLE_PRESET_DEFINITIONS[id]
    if (!preset) return ''

    let prompt = preset.systemPromptBlock

    prompt += `\n\nStyle Details:
- Lighting: ${preset.lighting}
- Background: ${preset.background}
- Pose: ${preset.pose}
- Color Tone: ${preset.colorTone}
- Camera: ${preset.cameraParams}`

    if (additionalConstraints) {
      prompt += `\n\nAdditional Constraints:\n${additionalConstraints}`
    }

    return prompt
  }
}

// ==================== 解析函数 ====================

/**
 * 根据 ID 获取电商风格预设
 * @deprecated 使用 ECOM_STYLE_PRESETS.getFullPreset(id) 替代
 */
export function getEcomStylePreset(id: string): EcomStylePresetDefinition | undefined {
  return ECOM_STYLE_PRESET_DEFINITIONS[id as EcomStyleId]
}
