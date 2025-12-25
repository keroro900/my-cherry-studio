/**
 * 姿势预设（单一来源）
 * Pose Presets (Single Source of Truth)
 *
 * - natural: 自然站立（放松、自然）
 * - sitting: 坐姿（舒适、放松）
 * - playing: 玩耍（动态、活力）
 * - walking: 行走（自然步态）
 */

import type { PosePreset } from './types'

export const POSE_PRESETS: Record<string, PosePreset> = {
  natural: {
    en: 'natural standing or walking, relaxed and authentic expression',
    description: 'standing naturally with relaxed posture, arms at sides or slightly bent'
  },
  sitting: {
    en: 'naturally sitting or crouching, comfortable and relaxed',
    description: 'sitting comfortably on chair or floor, relaxed position'
  },
  playing: {
    en: 'playful or active pose, full of energy and childlike joy',
    description: 'dynamic playful pose, mid-action movement, energetic'
  },
  walking: {
    en: 'natural walking motion, casual stride',
    description: 'natural walking motion, one foot slightly forward, casual stride'
  },
  confident: {
    en: 'confident pose, hands on hips or strong stance',
    description: 'confident posture, shoulders back, slight chin up'
  },
  editorial: {
    en: 'editorial fashion pose, magazine-worthy',
    description: 'stylized pose, artistic angles, refined hands placement'
  },
  hands_on_hips: {
    en: 'hands on hips, strong posture',
    description: 'both hands on hips, confident body language'
  },
  cross_arms: {
    en: 'arms crossed, cool vibe',
    description: 'arms gently crossed, relaxed confident stance'
  },
  looking_back: {
    en: 'looking back over shoulder',
    description: 'turning slightly, looking back with playful expression'
  },
  running: {
    en: 'running motion, dynamic energy',
    description: 'mid-run pose, one foot lifted, energetic'
  },
  jumping: {
    en: 'jumping pose, cheerful',
    description: 'mid-jump, joyful expression and dynamic limbs'
  },
  leaning: {
    en: 'leaning against object',
    description: 'casual leaning, relaxed posture'
  }
} as const

/**
 * 获取姿势预设
 */
export function getPosePreset(key: string): PosePreset | undefined {
  return POSE_PRESETS[key]
}

/**
 * 获取所有姿势键
 */
export function getPosePresetKeys(): string[] {
  return Object.keys(POSE_PRESETS)
}
