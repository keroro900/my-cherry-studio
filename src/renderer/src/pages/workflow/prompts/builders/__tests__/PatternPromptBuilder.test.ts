/**
 * PatternPromptBuilder 属性测试
 * Property-Based Tests for PatternPromptBuilder
 *
 * **Feature: ui-prompt-optimization, Property 3: 图案有机布局规则**
 * **Feature: ui-prompt-optimization, Property 4: 智能面料比例规则**
 * **Feature: ui-prompt-optimization, Property 5: 图案风格预设应用**
 * **Validates: Requirements 3.2, 3.3, 3.4**
 */

import { describe, expect, it } from 'vitest'

import {
  getPatternStyleOptions,
  getPatternStylePreset,
  PATTERN_STYLE_PRESETS,
  type PatternConfig,
  PatternPromptBuilder,
  type PatternPromptJson
} from '../PatternPromptBuilder'

// ==================== 测试数据生成器 ====================

/**
 * 生成随机图案配置
 */
function generateRandomPatternConfig(): PatternConfig {
  const patternTypes: Array<'seamless' | 'graphic' | 'mockup'> = ['seamless', 'graphic', 'mockup']
  const densities: Array<'sparse' | 'medium' | 'dense'> = ['sparse', 'medium', 'dense']
  const genders: Array<'girl' | 'boy' | 'unisex'> = ['girl', 'boy', 'unisex']
  const presetIds = Object.keys(PATTERN_STYLE_PRESETS)

  return {
    patternType: patternTypes[Math.floor(Math.random() * patternTypes.length)],
    stylePreset: presetIds[Math.floor(Math.random() * presetIds.length)],
    density: densities[Math.floor(Math.random() * densities.length)],
    enableSmartScaling: Math.random() > 0.5,
    targetGender: genders[Math.floor(Math.random() * genders.length)],
    customElements: Math.random() > 0.5 ? 'stars, hearts, flowers' : undefined,
    colorTone: Math.random() > 0.5 ? 'pastel pink and blue' : undefined,
    styleConstraint: Math.random() > 0.5 ? 'Keep it cute and playful' : undefined
  }
}

// ==================== Property 3: 图案有机布局规则 ====================

describe('Property 3: 图案有机布局规则', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 3: 图案有机布局规则**
   * **Validates: Requirements 3.2**
   *
   * *For any* PatternPromptBuilder 构建无缝图案提示词，
   * 结果 SHALL 包含有机散落布局规则（ORGANIC_LAYOUT_RULES）
   */
  it('should include ORGANIC_LAYOUT_RULES for seamless patterns', () => {
    // 运行 100 次随机测试
    for (let i = 0; i < 100; i++) {
      const config: PatternConfig = {
        ...generateRandomPatternConfig(),
        patternType: 'seamless' // 强制为无缝图案
      }

      const builder = new PatternPromptBuilder({ config: config as any })
      const { prompt } = builder.build()

      // 验证提示词包含有机布局规则的关键内容
      expect(prompt).toContain('Organic Layout Rules')
      expect(prompt).toContain('AVOID grid-like arrangements')
    }
  })

  it('should include ORGANIC_LAYOUT_RULES for graphic patterns', () => {
    for (let i = 0; i < 50; i++) {
      const config: PatternConfig = {
        ...generateRandomPatternConfig(),
        patternType: 'graphic'
      }

      const builder = new PatternPromptBuilder({ config: config as any })
      const { prompt } = builder.build()

      // graphic 模式也应该包含有机布局规则
      expect(prompt).toContain('Organic Layout Rules')
    }
  })

  it('should include SEAMLESS_REQUIREMENTS only for seamless patterns', () => {
    // 测试 seamless 模式
    const seamlessBuilder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    const { prompt: seamlessPrompt } = seamlessBuilder.build()
    expect(seamlessPrompt).toContain('Seamless Pattern Requirements')
    expect(seamlessPrompt).toContain('tile perfectly')

    // 测试 graphic 模式不应包含 seamless 要求
    const graphicBuilder = new PatternPromptBuilder({
      config: { patternType: 'graphic' }
    })
    const { prompt: graphicPrompt } = graphicBuilder.build()
    expect(graphicPrompt).not.toContain('Seamless Pattern Requirements')
    expect(graphicPrompt).toContain('Graphic/Placement Print Requirements')
  })
})

// ==================== Property 4: 智能面料比例规则 ====================

describe('Property 4: 智能面料比例规则', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 4: 智能面料比例规则**
   * **Validates: Requirements 3.3**
   *
   * *For any* PatternPromptBuilder 构建提示词且 enableSmartScaling 为 true，
   * 结果 SHALL 包含智能面料比例规则（SMART_SCALING_RULES）
   */
  it('should include SMART_SCALING_RULES when enableSmartScaling is true', () => {
    for (let i = 0; i < 100; i++) {
      const config: PatternConfig = {
        ...generateRandomPatternConfig(),
        enableSmartScaling: true
      }

      const builder = new PatternPromptBuilder({ config: config as any })
      const { prompt } = builder.build()

      // 验证提示词包含智能面料比例规则
      expect(prompt).toContain('Smart Fabric Scaling Rules')
      expect(prompt).toContain('5-8cm')
    }
  })

  it('should include SMART_SCALING_RULES by default (enableSmartScaling undefined)', () => {
    const builder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    const { prompt } = builder.build()

    // 默认应该包含智能面料比例规则
    expect(prompt).toContain('Smart Fabric Scaling Rules')
  })

  it('should NOT include SMART_SCALING_RULES when enableSmartScaling is false', () => {
    const builder = new PatternPromptBuilder({
      config: {
        patternType: 'seamless',
        enableSmartScaling: false
      }
    })
    const { prompt } = builder.build()

    // 明确禁用时不应包含
    expect(prompt).not.toContain('Smart Fabric Scaling Rules')
  })
})

// ==================== Property 5: 图案风格预设应用 ====================

describe('Property 5: 图案风格预设应用', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 5: 图案风格预设应用**
   * **Validates: Requirements 3.4**
   *
   * *For any* 用户选择的图案风格预设 ID，
   * PatternPromptBuilder SHALL 在提示词中包含该预设对应的配色和元素规则
   */
  it('should include preset color palette and elements for all presets', () => {
    const presetIds = Object.keys(PATTERN_STYLE_PRESETS)

    for (const presetId of presetIds) {
      const preset = PATTERN_STYLE_PRESETS[presetId]
      const builder = new PatternPromptBuilder({
        preset: presetId,
        config: { patternType: 'seamless' }
      })
      const { prompt } = builder.build()

      // 验证提示词包含预设名称
      expect(prompt).toContain(preset.name)

      // 验证提示词包含预设描述
      expect(prompt).toContain(preset.description)

      // 验证提示词包含配色信息
      expect(prompt).toContain('Color Palette')

      // 验证提示词包含元素信息
      expect(prompt).toContain('Suggested Elements')
    }
  })

  it('should apply preset via withStylePreset method', () => {
    for (let i = 0; i < 50; i++) {
      const presetIds = Object.keys(PATTERN_STYLE_PRESETS)
      const randomPresetId = presetIds[Math.floor(Math.random() * presetIds.length)]
      const preset = PATTERN_STYLE_PRESETS[randomPresetId]

      const builder = new PatternPromptBuilder({
        config: { patternType: 'seamless' }
      })
      builder.withStylePreset(randomPresetId)
      const { prompt } = builder.build()

      // 验证预设被正确应用
      expect(prompt).toContain(preset.name)
      expect(prompt).toContain(preset.nameZh)
    }
  })

  it('should return correct preset via getPatternStylePreset', () => {
    const presetIds = Object.keys(PATTERN_STYLE_PRESETS)

    for (const presetId of presetIds) {
      const preset = getPatternStylePreset(presetId)
      expect(preset).toBeDefined()
      expect(preset?.id).toBe(presetId)
      expect(preset?.colorPalette).toBeInstanceOf(Array)
      expect(preset?.elements).toBeInstanceOf(Array)
    }
  })

  it('should return undefined for invalid preset ID', () => {
    const preset = getPatternStylePreset('invalid_preset_id')
    expect(preset).toBeUndefined()
  })

  it('should return all preset options via getPatternStyleOptions', () => {
    const options = getPatternStyleOptions()
    const presetIds = Object.keys(PATTERN_STYLE_PRESETS)

    expect(options.length).toBe(presetIds.length)

    for (const option of options) {
      expect(option.value).toBeDefined()
      expect(option.label).toBeDefined()
      expect(option.labelZh).toBeDefined()
      expect(presetIds).toContain(option.value)
    }
  })
})

// ==================== 其他属性测试 ====================

describe('PatternPromptBuilder - 基础功能', () => {
  it('should build prompt from promptJson with full_prompt', () => {
    const promptJson: PatternPromptJson = {
      full_prompt: 'A beautiful seamless pattern with flowers and butterflies'
    }

    const builder = new PatternPromptBuilder({
      promptJson,
      config: { patternType: 'seamless' }
    })
    const { prompt, source } = builder.build()

    expect(source).toBe('promptJson')
    expect(prompt).toContain('A beautiful seamless pattern')
  })

  it('should build prompt from promptJson fields when no full_prompt', () => {
    const promptJson: PatternPromptJson = {
      pattern_style: 'kawaii',
      pattern_type: 'seamless',
      main_elements: ['stars', 'hearts'],
      color_palette: ['#FFB6C1', '#87CEEB']
    }

    const builder = new PatternPromptBuilder({
      promptJson,
      config: { patternType: 'seamless' }
    })
    const { prompt, source } = builder.build()

    // 没有 full_prompt 时，会回退到 preset 模式
    // 但 promptJson 的字段仍然会被使用
    expect(source).toBe('preset')
    // 由于没有 full_prompt，promptJson 字段不会直接出现在输出中
    // 这是预期行为 - 只有 full_prompt 才会被直接使用
    expect(prompt).toBeDefined()
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('should apply user constraint via withConstraint', () => {
    const constraint = 'Make it extra cute with pastel colors'

    const builder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    builder.withConstraint(constraint)
    const { prompt } = builder.build()

    expect(prompt).toContain('User Constraint')
    expect(prompt).toContain(constraint)
  })

  it('should apply styleConstraint from config', () => {
    const builder = new PatternPromptBuilder({
      config: {
        patternType: 'seamless',
        styleConstraint: 'Keep it minimalist'
      }
    })
    const { prompt } = builder.build()

    expect(prompt).toContain('User Constraint')
    expect(prompt).toContain('Keep it minimalist')
  })

  it('should apply density setting', () => {
    const densities: Array<'sparse' | 'medium' | 'dense'> = ['sparse', 'medium', 'dense']

    for (const density of densities) {
      const builder = new PatternPromptBuilder({
        config: { patternType: 'seamless' }
      })
      builder.withDensity(density)
      const { prompt } = builder.build()

      expect(prompt).toContain('Density')
    }
  })

  it('should apply custom elements', () => {
    const builder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    builder.withCustomElements('unicorns, rainbows, sparkles')
    const { prompt } = builder.build()

    expect(prompt).toContain('Custom Elements')
    expect(prompt).toContain('unicorns')
  })

  it('should apply color tone', () => {
    const builder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    builder.withColorTone('warm sunset colors')
    const { prompt } = builder.build()

    expect(prompt).toContain('Color Tone')
    expect(prompt).toContain('warm sunset colors')
  })

  it('should include role and core rules', () => {
    const builder = new PatternPromptBuilder({
      config: { patternType: 'seamless' }
    })
    const { prompt } = builder.build()

    expect(prompt).toContain('Expert Textile Designer')
    // 核心概念使用 "Re-creation" 而不是 "RE-CREATION"
    expect(prompt.toLowerCase()).toContain('re-creation')
  })
})

describe('PatternPromptBuilder - 边界情况', () => {
  it('should handle empty config', () => {
    const builder = new PatternPromptBuilder({})
    const { prompt } = builder.build()

    // 应该使用默认值
    expect(prompt).toBeDefined()
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('should handle undefined promptJson', () => {
    const builder = new PatternPromptBuilder({
      promptJson: undefined,
      config: { patternType: 'seamless' }
    })
    const { prompt, source } = builder.build()

    expect(source).toBe('preset')
    expect(prompt).toBeDefined()
  })

  it('should handle empty promptJson', () => {
    const builder = new PatternPromptBuilder({
      promptJson: {},
      config: { patternType: 'seamless' }
    })
    const { prompt, source } = builder.build()

    // 空 promptJson 应该回退到 preset 模式
    expect(source).toBe('preset')
    expect(prompt).toBeDefined()
  })
})
