/**
 * 年龄段预设（单一来源）
 * Age Presets (Single Source of Truth)
 *
 * - small_kid: 小童（4-7岁）- 天真可爱、好奇心强
 * - big_kid: 大童（8-12岁）- 活力自信、青春活泼
 * - adult: 成人（20-28岁）- 专业优雅、自然自信
 */

import type { AgePreset } from './types'

export const AGE_PRESETS: Record<string, AgePreset> = {
  small_kid: {
    en: 'adorable child aged 4-7 years old',
    ageRange: '4-7 year old child',
    defaultAge: 6,
    pose: 'natural playful stance, curious body language',
    expression: 'innocent, happy, bright eyes with genuine child-like joy'
  },
  big_kid: {
    en: 'energetic child aged 8-12 years old',
    ageRange: '8-12 year old child',
    defaultAge: 10,
    pose: 'confident natural pose, relaxed shoulders',
    expression: 'friendly smile, confident gaze, youthful enthusiasm'
  },
  adult: {
    en: 'young adult model aged 20-28 years old',
    ageRange: 'adult',
    defaultAge: 25,
    pose: 'professional model stance, elegant posture',
    expression: 'natural confident expression, approachable look'
  }
} as const

/**
 * 获取年龄段预设
 */
export function getAgePreset(key: string): AgePreset | undefined {
  return AGE_PRESETS[key]
}

/**
 * 获取所有年龄段键
 */
export function getAgePresetKeys(): string[] {
  return Object.keys(AGE_PRESETS)
}
