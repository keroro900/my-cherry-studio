/**
 * 人种预设（单一来源）
 * Ethnicity Presets (Single Source of Truth)
 *
 * - asian: 亚洲人（东亚特征、自然肤色）
 * - caucasian: 白人/欧洲人（白皙肤色）
 * - african_american: 非裔美国人（深色肤色）
 * - hispanic: 拉丁裔（温暖肤色）
 * - mixed: 混血（多元特征）
 */

import type { EthnicityPreset } from './types'

export const ETHNICITY_PRESETS: Record<string, EthnicityPreset> = {
  asian: {
    en: 'Asian',
    description: 'East Asian ethnicity with natural skin tone'
  },
  caucasian: {
    en: 'Caucasian/White',
    description: 'Caucasian/European features with fair skin'
  },
  african_american: {
    en: 'African American',
    description: 'African American features with beautiful dark skin tone'
  },
  hispanic: {
    en: 'Hispanic/Latino',
    description: 'Hispanic/Latino features with warm skin tone'
  },
  mixed: {
    en: 'Mixed ethnicity',
    description: 'beautiful mixed ethnicity features'
  }
} as const

/**
 * 获取人种预设
 */
export function getEthnicityPreset(key: string): EthnicityPreset | undefined {
  return ETHNICITY_PRESETS[key]
}

/**
 * 获取所有人种键
 */
export function getEthnicityPresetKeys(): string[] {
  return Object.keys(ETHNICITY_PRESETS)
}
