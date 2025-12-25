/**
 * 预设选项一致性属性测试
 * Property-Based Tests for Preset Consistency
 *
 * **Feature: ui-prompt-optimization, Property 8: 预设选项一致性**
 * **Feature: ui-prompt-optimization, Property 9: 预设选项来源统一**
 * **Validates: Requirements 9.3, 10.4**
 */

import { describe, expect, it } from 'vitest'

// 从 constants/presets 导入 UI 选项（配置表单使用）
import {
  AGE_OPTIONS,
  AGE_PRESETS as CONSTANTS_AGE_PRESETS,
  ETHNICITY_OPTIONS,
  ETHNICITY_PRESETS as CONSTANTS_ETHNICITY_PRESETS,
  GENDER_OPTIONS,
  GENDER_PRESETS as CONSTANTS_GENDER_PRESETS,
  POSE_OPTIONS,
  POSE_PRESETS as CONSTANTS_POSE_PRESETS,
  SCENE_OPTIONS,
  SCENE_PRESETS as CONSTANTS_SCENE_PRESETS,
  STYLE_MODE_OPTIONS,
  STYLE_MODE_PRESETS as CONSTANTS_STYLE_MODE_PRESETS
} from '../../../constants/presets'
// 从 prompts/presets 导入提示词数据（执行器使用）
import {
  AGE_PRESETS as PROMPTS_AGE_PRESETS,
  ETHNICITY_PRESETS as PROMPTS_ETHNICITY_PRESETS,
  GENDER_PRESETS as PROMPTS_GENDER_PRESETS,
  POSE_PRESETS as PROMPTS_POSE_PRESETS,
  SCENE_PRESETS as PROMPTS_SCENE_PRESETS
} from '../../presets'
// 从 PatternPromptBuilder 导入图案预设
import { getPatternStyleOptions, PATTERN_STYLE_PRESETS } from '../PatternPromptBuilder'

// ==================== Property 8: 预设选项一致性 ====================

describe('Property 8: 预设选项一致性', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 8: 预设选项一致性**
   * **Validates: Requirements 9.3**
   *
   * *For any* PromptBuilder 支持的预设 ID，
   * 对应的配置表单 SHALL 在预设选项列表中包含该 ID
   */

  describe('PatternPromptBuilder 预设与 UI 选项一致性', () => {
    it('should have all PATTERN_STYLE_PRESETS available in getPatternStyleOptions', () => {
      const presetIds = Object.keys(PATTERN_STYLE_PRESETS)
      const options = getPatternStyleOptions()
      const optionValues = options.map((opt) => opt.value)

      for (const presetId of presetIds) {
        expect(optionValues).toContain(presetId)
      }
    })

    it('should have matching labels for all pattern style presets', () => {
      const options = getPatternStyleOptions()

      for (const option of options) {
        const preset = PATTERN_STYLE_PRESETS[option.value]
        expect(preset).toBeDefined()
        expect(option.label).toBe(preset.name)
        expect(option.labelZh).toBe(preset.nameZh)
      }
    })
  })

  describe('年龄预设一致性', () => {
    it('should have all prompts AGE_PRESETS keys in constants AGE_PRESETS', () => {
      const promptsKeys = Object.keys(PROMPTS_AGE_PRESETS)
      const constantsKeys = Object.keys(CONSTANTS_AGE_PRESETS)

      // prompts/presets 中的所有键都应该在 constants/presets 中存在
      for (const key of promptsKeys) {
        expect(constantsKeys).toContain(key)
      }
    })

    it('should have all AGE_OPTIONS ids in AGE_PRESETS (excluding random)', () => {
      const presetKeys = Object.keys(CONSTANTS_AGE_PRESETS)

      for (const option of AGE_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })

  describe('性别预设一致性', () => {
    it('should have all prompts GENDER_PRESETS keys in constants GENDER_PRESETS', () => {
      const promptsKeys = Object.keys(PROMPTS_GENDER_PRESETS)
      const constantsKeys = Object.keys(CONSTANTS_GENDER_PRESETS)

      for (const key of promptsKeys) {
        expect(constantsKeys).toContain(key)
      }
    })

    it('should have all GENDER_OPTIONS ids in GENDER_PRESETS (excluding random)', () => {
      const presetKeys = Object.keys(CONSTANTS_GENDER_PRESETS)

      for (const option of GENDER_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })

  describe('场景预设一致性', () => {
    it('should have all prompts SCENE_PRESETS keys in constants SCENE_PRESETS', () => {
      const promptsKeys = Object.keys(PROMPTS_SCENE_PRESETS)
      const constantsKeys = Object.keys(CONSTANTS_SCENE_PRESETS)

      for (const key of promptsKeys) {
        expect(constantsKeys).toContain(key)
      }
    })

    it('should have all SCENE_OPTIONS ids in SCENE_PRESETS (excluding random)', () => {
      const presetKeys = Object.keys(CONSTANTS_SCENE_PRESETS)

      for (const option of SCENE_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })

  describe('人种预设一致性', () => {
    it('should have all prompts ETHNICITY_PRESETS keys in constants ETHNICITY_PRESETS', () => {
      const promptsKeys = Object.keys(PROMPTS_ETHNICITY_PRESETS)
      const constantsKeys = Object.keys(CONSTANTS_ETHNICITY_PRESETS)

      for (const key of promptsKeys) {
        expect(constantsKeys).toContain(key)
      }
    })

    it('should have all ETHNICITY_OPTIONS ids in ETHNICITY_PRESETS (excluding random)', () => {
      const presetKeys = Object.keys(CONSTANTS_ETHNICITY_PRESETS)

      for (const option of ETHNICITY_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })

  describe('姿态预设一致性', () => {
    it('should have all prompts POSE_PRESETS keys in constants POSE_PRESETS', () => {
      const promptsKeys = Object.keys(PROMPTS_POSE_PRESETS)
      const constantsKeys = Object.keys(CONSTANTS_POSE_PRESETS)

      for (const key of promptsKeys) {
        expect(constantsKeys).toContain(key)
      }
    })

    it('should have all POSE_OPTIONS ids in POSE_PRESETS (excluding random)', () => {
      const presetKeys = Object.keys(CONSTANTS_POSE_PRESETS)

      for (const option of POSE_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })
})

// ==================== Property 9: 预设选项来源统一 ====================

describe('Property 9: 预设选项来源统一', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 9: 预设选项来源统一**
   * **Validates: Requirements 10.4**
   *
   * *For any* 配置表单显示的场景/年龄/性别选项，
   * SHALL 与 UnifiedPromptNode 使用的选项定义相同
   */

  describe('constants/presets 与 prompts/presets 数据一致性', () => {
    it('should have consistent age preset data between constants and prompts', () => {
      const promptsKeys = Object.keys(PROMPTS_AGE_PRESETS)

      for (const key of promptsKeys) {
        const promptsPreset = PROMPTS_AGE_PRESETS[key]
        const constantsPreset = CONSTANTS_AGE_PRESETS[key]

        expect(constantsPreset).toBeDefined()
        // 验证关键字段一致
        expect(constantsPreset.en).toBe(promptsPreset.en)
        expect(constantsPreset.ageRange).toBe(promptsPreset.ageRange)
        expect(constantsPreset.defaultAge).toBe(promptsPreset.defaultAge)
      }
    })

    it('should have consistent gender preset data between constants and prompts', () => {
      const promptsKeys = Object.keys(PROMPTS_GENDER_PRESETS)

      for (const key of promptsKeys) {
        const promptsPreset = PROMPTS_GENDER_PRESETS[key]
        const constantsPreset = CONSTANTS_GENDER_PRESETS[key]

        expect(constantsPreset).toBeDefined()
        expect(constantsPreset.en).toBe(promptsPreset.en)
        expect(constantsPreset.label).toBe(promptsPreset.label)
      }
    })

    it('should have consistent scene preset data between constants and prompts', () => {
      const promptsKeys = Object.keys(PROMPTS_SCENE_PRESETS)

      for (const key of promptsKeys) {
        const promptsPreset = PROMPTS_SCENE_PRESETS[key]
        const constantsPreset = CONSTANTS_SCENE_PRESETS[key]

        expect(constantsPreset).toBeDefined()
        expect(constantsPreset.en).toBe(promptsPreset.en)
        expect(constantsPreset.lighting).toBe(promptsPreset.lighting)
        expect(constantsPreset.background).toBe(promptsPreset.background)
      }
    })

    it('should have consistent ethnicity preset data between constants and prompts', () => {
      const promptsKeys = Object.keys(PROMPTS_ETHNICITY_PRESETS)

      for (const key of promptsKeys) {
        const promptsPreset = PROMPTS_ETHNICITY_PRESETS[key]
        const constantsPreset = CONSTANTS_ETHNICITY_PRESETS[key]

        expect(constantsPreset).toBeDefined()
        expect(constantsPreset.en).toBe(promptsPreset.en)
        expect(constantsPreset.description).toBe(promptsPreset.description)
      }
    })

    it('should have consistent pose preset data between constants and prompts', () => {
      const promptsKeys = Object.keys(PROMPTS_POSE_PRESETS)

      for (const key of promptsKeys) {
        const promptsPreset = PROMPTS_POSE_PRESETS[key]
        const constantsPreset = CONSTANTS_POSE_PRESETS[key]

        expect(constantsPreset).toBeDefined()
        expect(constantsPreset.en).toBe(promptsPreset.en)
        expect(constantsPreset.description).toBe(promptsPreset.description)
      }
    })
  })

  describe('UI 选项列表完整性', () => {
    it('should have AGE_OPTIONS for all common age groups', () => {
      const requiredAgeGroups = ['small_kid', 'big_kid', 'adult']
      const optionIds = AGE_OPTIONS.map((opt) => opt.id)

      for (const ageGroup of requiredAgeGroups) {
        expect(optionIds).toContain(ageGroup)
      }
    })

    it('should have GENDER_OPTIONS for all genders', () => {
      const requiredGenders = ['female', 'male']
      const optionIds = GENDER_OPTIONS.map((opt) => opt.id)

      for (const gender of requiredGenders) {
        expect(optionIds).toContain(gender)
      }
    })

    it('should have SCENE_OPTIONS for all common scenes', () => {
      const requiredScenes = ['home', 'outdoor', 'studio']
      const optionIds = SCENE_OPTIONS.map((opt) => opt.id)

      for (const scene of requiredScenes) {
        expect(optionIds).toContain(scene)
      }
    })

    it('should have STYLE_MODE_OPTIONS for daily and commercial modes', () => {
      const requiredModes = ['daily', 'commercial']
      const optionIds = STYLE_MODE_OPTIONS.map((opt) => opt.id)

      for (const mode of requiredModes) {
        expect(optionIds).toContain(mode)
      }
    })

    it('should have STYLE_MODE_PRESETS data for all STYLE_MODE_OPTIONS', () => {
      const presetKeys = Object.keys(CONSTANTS_STYLE_MODE_PRESETS)

      for (const option of STYLE_MODE_OPTIONS) {
        if (option.id !== 'random') {
          expect(presetKeys).toContain(option.id)
        }
      }
    })
  })
})

// ==================== 辅助测试：预设数据结构验证 ====================

describe('预设数据结构验证', () => {
  it('should have valid AgePreset structure', () => {
    for (const [, preset] of Object.entries(CONSTANTS_AGE_PRESETS)) {
      expect(preset.en).toBeDefined()
      expect(typeof preset.en).toBe('string')
      expect(preset.ageRange).toBeDefined()
      expect(typeof preset.defaultAge).toBe('number')
      expect(preset.pose).toBeDefined()
      expect(preset.expression).toBeDefined()
    }
  })

  it('should have valid GenderPreset structure', () => {
    for (const [, preset] of Object.entries(CONSTANTS_GENDER_PRESETS)) {
      expect(preset.en).toBeDefined()
      expect(preset.label).toBeDefined()
      expect(preset.features).toBeDefined()
    }
  })

  it('should have valid ScenePreset structure', () => {
    for (const [, preset] of Object.entries(CONSTANTS_SCENE_PRESETS)) {
      expect(preset.en).toBeDefined()
      expect(preset.lighting).toBeDefined()
      expect(preset.background).toBeDefined()
      expect(preset.props).toBeDefined()
    }
  })

  it('should have valid PatternStylePreset structure', () => {
    for (const [key, preset] of Object.entries(PATTERN_STYLE_PRESETS)) {
      expect(preset.id).toBe(key)
      expect(preset.name).toBeDefined()
      expect(preset.nameZh).toBeDefined()
      expect(preset.description).toBeDefined()
      expect(preset.keywords).toBeInstanceOf(Array)
      expect(preset.colorPalette).toBeInstanceOf(Array)
      expect(preset.elements).toBeInstanceOf(Array)
    }
  })
})
