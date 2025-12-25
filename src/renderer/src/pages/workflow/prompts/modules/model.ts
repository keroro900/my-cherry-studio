/**
 * 模特模块
 * Model Module
 *
 * 处理模特相关属性：年龄、性别、人种、姿态等
 * 用于模特图生成
 */

import type { PromptModule } from './types'

/**
 * 年龄段映射
 */
const AGE_TEXTS: Record<string, string> = {
  toddler: '2-4 years old toddler, chubby cute features',
  child: '5-8 years old child, playful and innocent',
  tween: '9-12 years old pre-teen, growing and confident',
  teen: '13-17 years old teenager, youthful and trendy',
  young_adult: '18-25 years old young adult, fresh and vibrant',
  adult: '26-35 years old adult, mature and professional'
}

/**
 * 性别映射
 */
const GENDER_TEXTS: Record<string, string> = {
  boy: 'Male model, boyish features',
  girl: 'Female model, girly features',
  neutral: 'Gender-neutral presentation'
}

/**
 * 人种映射
 */
const ETHNICITY_TEXTS: Record<string, string> = {
  asian: 'Asian ethnicity, East Asian features',
  caucasian: 'Caucasian ethnicity, European features',
  african: 'African ethnicity, dark skin tone',
  hispanic: 'Hispanic ethnicity, Latin features',
  mixed: 'Mixed ethnicity, diverse features',
  south_asian: 'South Asian ethnicity, Indian subcontinent features'
}

/**
 * 姿态映射
 */
const POSE_TEXTS: Record<string, string> = {
  standing_front: 'Standing front view, natural relaxed pose',
  standing_side: 'Standing side view, profile angle',
  standing_3_4: 'Standing 3/4 angle, dynamic look',
  walking: 'Walking pose, mid-stride, natural movement',
  sitting: 'Sitting pose, casual and comfortable',
  playing: 'Playful active pose, childlike energy'
}

/**
 * 模特模块
 */
export const ModelModule = {
  /**
   * 获取完整的模特描述模块
   */
  get(options: { age?: string; gender?: string; ethnicity?: string; pose?: string }): PromptModule {
    const { age = 'child', gender = 'girl', ethnicity = 'asian', pose = 'standing_front' } = options

    const parts = [
      '[Model Description]',
      AGE_TEXTS[age] || AGE_TEXTS.child,
      GENDER_TEXTS[gender] || GENDER_TEXTS.girl,
      ETHNICITY_TEXTS[ethnicity] || ETHNICITY_TEXTS.asian,
      POSE_TEXTS[pose] || POSE_TEXTS.standing_front,
      'Natural expression, camera-ready appearance.'
    ]

    return {
      type: 'model',
      text: parts.join('\n'),
      priority: 75
    }
  },

  /**
   * 获取年龄模块
   */
  getAge(age: string): PromptModule {
    return {
      type: 'age',
      text: AGE_TEXTS[age] || AGE_TEXTS.child,
      priority: 76
    }
  },

  /**
   * 获取性别模块
   */
  getGender(gender: string): PromptModule {
    return {
      type: 'gender',
      text: GENDER_TEXTS[gender] || GENDER_TEXTS.girl,
      priority: 76
    }
  },

  /**
   * 获取人种模块
   */
  getEthnicity(ethnicity: string): PromptModule {
    return {
      type: 'ethnicity',
      text: ETHNICITY_TEXTS[ethnicity] || ETHNICITY_TEXTS.asian,
      priority: 76
    }
  },

  /**
   * 获取姿态模块
   */
  getPose(pose: string): PromptModule {
    return {
      type: 'pose',
      text: POSE_TEXTS[pose] || POSE_TEXTS.standing_front,
      priority: 74
    }
  },

  /**
   * 获取所有可用选项
   */
  getOptions(): {
    ages: string[]
    genders: string[]
    ethnicities: string[]
    poses: string[]
  } {
    return {
      ages: Object.keys(AGE_TEXTS),
      genders: Object.keys(GENDER_TEXTS),
      ethnicities: Object.keys(ETHNICITY_TEXTS),
      poses: Object.keys(POSE_TEXTS)
    }
  }
}
