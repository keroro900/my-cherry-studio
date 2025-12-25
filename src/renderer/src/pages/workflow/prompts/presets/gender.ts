/**
 * 性别预设（单一来源）
 * Gender Presets (Single Source of Truth)
 *
 * - female: 女性
 * - male: 男性
 */

import type { GenderPreset } from './types'

export const GENDER_PRESETS: Record<string, GenderPreset> = {
  female: {
    en: 'female',
    label: 'girl',
    features: 'healthy natural look, age-appropriate appearance'
  },
  male: {
    en: 'male',
    label: 'boy',
    features: 'healthy natural look, age-appropriate appearance'
  }
} as const

/**
 * 获取性别预设
 */
export function getGenderPreset(key: string): GenderPreset | undefined {
  return GENDER_PRESETS[key]
}

/**
 * 获取所有性别键
 */
export function getGenderPresetKeys(): string[] {
  return Object.keys(GENDER_PRESETS)
}
