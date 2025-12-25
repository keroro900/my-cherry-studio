/**
 * PromptBuilder 核心概念属性测试
 * Property-Based Tests for PromptBuilder Core Concepts
 *
 * **Feature: ui-prompt-optimization, Property 1: PromptBuilder 核心概念包含**
 * **Validates: Requirements 1.4**
 */

import { describe, expect, it } from 'vitest'

import { EcomPromptBuilder, ModelPromptBuilder, PatternPromptBuilder } from '../index'

// ==================== Property 1: PromptBuilder 核心概念包含 ====================

describe('Property 1: PromptBuilder 核心概念包含', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 1: PromptBuilder 核心概念包含**
   * **Validates: Requirements 1.4**
   *
   * *For any* PromptBuilder 实例调用 `withCore()` 和 `withHardRules()` 后，
   * 构建的提示词 SHALL 包含 RE-CREATION 概念和 HARD_RULES 内容
   */

  describe('EcomPromptBuilder', () => {
    it('should include RE-CREATION concept when withCore() is called', () => {
      // 运行 50 次随机测试
      for (let i = 0; i < 50; i++) {
        const layouts: Array<'flat_lay' | 'hanging'> = ['flat_lay', 'hanging']
        const fills: Array<'filled' | 'flat'> = ['filled', 'flat']

        const builder = new EcomPromptBuilder({
          config: {
            layout: layouts[Math.floor(Math.random() * layouts.length)],
            fillMode: fills[Math.floor(Math.random() * fills.length)],
            useSystemPrompt: true // 确保启用核心概念
          }
        })
        const { prompt } = builder.build()

        // 验证提示词包含 RE-CREATION 概念（不区分大小写）
        expect(prompt.toLowerCase()).toContain('re-creation')
      }
    })

    it('should include HARD_RULES when withHardRules() is called', () => {
      const builder = new EcomPromptBuilder({
        config: {
          layout: 'flat_lay',
          fillMode: 'filled',
          useSystemPrompt: true
        }
      })
      const { prompt } = builder.build()

      // 验证提示词包含硬性规则的关键内容
      expect(prompt).toContain('Hard Rules')
      expect(prompt).toContain('Data Consistency')
    })

    it('should NOT include core concepts when useSystemPrompt is false', () => {
      const builder = new EcomPromptBuilder({
        config: {
          layout: 'flat_lay',
          fillMode: 'filled',
          useSystemPrompt: false
        }
      })
      const { prompt } = builder.build()

      // 验证提示词不包含核心概念
      expect(prompt.toLowerCase()).not.toContain('re-creation')
      expect(prompt).not.toContain('Hard Rules')
    })
  })

  describe('ModelPromptBuilder', () => {
    it('should include RE-CREATION concept by default', () => {
      for (let i = 0; i < 50; i++) {
        const ageGroups: Array<'small_kid' | 'big_kid' | 'adult'> = ['small_kid', 'big_kid', 'adult']
        const genders: Array<'male' | 'female'> = ['male', 'female']

        const builder = new ModelPromptBuilder({
          preset: 'daily',
          config: {
            ageGroup: ageGroups[Math.floor(Math.random() * ageGroups.length)],
            gender: genders[Math.floor(Math.random() * genders.length)]
          }
        })
        const { prompt } = builder.build()

        // 验证提示词包含 RE-CREATION 概念
        expect(prompt.toLowerCase()).toContain('re-creation')
      }
    })

    it('should include HARD_RULES by default', () => {
      const builder = new ModelPromptBuilder({
        preset: 'daily',
        config: {
          ageGroup: 'big_kid',
          gender: 'female'
        }
      })
      const { prompt } = builder.build()

      // 验证提示词包含硬性规则
      expect(prompt).toContain('Hard Rules')
    })
  })

  describe('PatternPromptBuilder', () => {
    it('should include RE-CREATION concept by default', () => {
      for (let i = 0; i < 50; i++) {
        const patternTypes: Array<'seamless' | 'graphic'> = ['seamless', 'graphic']

        const builder = new PatternPromptBuilder({
          config: {
            patternType: patternTypes[Math.floor(Math.random() * patternTypes.length)]
          }
        })
        const { prompt } = builder.build()

        // 验证提示词包含 RE-CREATION 概念
        expect(prompt.toLowerCase()).toContain('re-creation')
      }
    })

    it('should include HARD_RULES by default', () => {
      const builder = new PatternPromptBuilder({
        config: {
          patternType: 'seamless'
        }
      })
      const { prompt } = builder.build()

      // 验证提示词包含硬性规则
      expect(prompt).toContain('Hard Rules')
    })
  })
})

// ==================== Property 2: 用户约束正确应用 ====================

describe('Property 2: 用户约束正确应用', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 2: 用户约束正确应用**
   * **Validates: Requirements 2.4**
   *
   * *For any* 节点配置包含非空的 constraintPrompt，
   * 构建的最终提示词 SHALL 包含该约束文本
   */

  it('should include user constraint in EcomPromptBuilder', () => {
    const constraints = [
      'Keep it minimalist',
      'Use pastel colors only',
      'Make it look premium',
      'Add vintage feel',
      'Focus on texture details'
    ]

    for (const constraint of constraints) {
      const builder = new EcomPromptBuilder({
        config: {
          layout: 'flat_lay',
          styleConstraint: constraint
        }
      })
      const { prompt } = builder.build()

      expect(prompt).toContain('User Constraint')
      expect(prompt).toContain(constraint)
    }
  })

  it('should include user constraint in PatternPromptBuilder', () => {
    const constraints = [
      'Make it cute and playful',
      'Use only geometric shapes',
      'Add sparkle effects',
      'Keep density low'
    ]

    for (const constraint of constraints) {
      const builder = new PatternPromptBuilder({
        config: {
          patternType: 'seamless',
          styleConstraint: constraint
        }
      })
      const { prompt } = builder.build()

      expect(prompt).toContain('User Constraint')
      expect(prompt).toContain(constraint)
    }
  })

  it('should include user constraint via withConstraint method', () => {
    const constraint = 'Custom constraint via method'

    const ecomBuilder = new EcomPromptBuilder({ config: { layout: 'flat_lay' } })
    ecomBuilder.withConstraint(constraint)
    const { prompt: ecomPrompt } = ecomBuilder.build()
    expect(ecomPrompt).toContain(constraint)

    const patternBuilder = new PatternPromptBuilder({ config: { patternType: 'seamless' } })
    patternBuilder.withConstraint(constraint)
    const { prompt: patternPrompt } = patternBuilder.build()
    expect(patternPrompt).toContain(constraint)
  })

  it('should NOT include constraint block when constraint is empty', () => {
    const builder = new EcomPromptBuilder({
      config: {
        layout: 'flat_lay',
        styleConstraint: ''
      }
    })
    const { prompt } = builder.build()

    // 空约束不应该添加 User Constraint 块
    expect(prompt).not.toContain('User Constraint')
  })

  it('should NOT include constraint block when constraint is whitespace only', () => {
    const builder = new PatternPromptBuilder({
      config: {
        patternType: 'seamless',
        styleConstraint: '   '
      }
    })
    const { prompt } = builder.build()

    // 纯空白约束不应该添加 User Constraint 块
    expect(prompt).not.toContain('User Constraint')
  })
})

// ==================== 构建结果来源测试 ====================

describe('BuildResult source 属性', () => {
  it('should return source=promptJson when full_prompt is provided', () => {
    const builder = new EcomPromptBuilder({
      promptJson: {
        full_prompt: 'A complete prompt from upstream'
      },
      config: { layout: 'flat_lay' }
    })
    const { source } = builder.build()

    expect(source).toBe('promptJson')
  })

  it('should return source=preset when preset is specified', () => {
    const builder = new PatternPromptBuilder({
      preset: 'kawaii',
      config: { patternType: 'seamless' }
    })
    const { source } = builder.build()

    expect(source).toBe('preset')
  })

  it('should return source=preset when no promptJson or preset', () => {
    const builder = new EcomPromptBuilder({
      config: { layout: 'flat_lay' }
    })
    const { source } = builder.build()

    expect(source).toBe('preset')
  })
})
