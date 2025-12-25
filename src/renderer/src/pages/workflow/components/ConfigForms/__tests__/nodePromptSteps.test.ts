/**
 * nodePromptSteps 属性测试
 *
 * **Property 3: 提示词步骤完整性**
 * *For any* 支持提示词编辑的节点类型，调用对应的 getXxxPromptSteps 函数应该返回非空的步骤数组
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
 */

import { describe, expect, it } from 'vitest'

import {
  getEcomNodePromptSteps,
  getGeminiEditPromptSteps,
  getGeminiGeneratePromptSteps,
  getPatternNodePromptSteps,
  getPromptStepsForNode,
  getUnifiedEcomPromptSteps,
  getUnifiedModelPromptSteps,
  getUnifiedPatternPromptSteps,
  getVideoPromptSteps,
  type NodePromptConfig,
  type PromptStep
} from '../nodePromptSteps'

describe('nodePromptSteps', () => {
  // 辅助函数：验证步骤结构
  function validateStepStructure(step: PromptStep) {
    expect(step.id).toBeDefined()
    expect(typeof step.id).toBe('string')
    expect(step.id.length).toBeGreaterThan(0)

    expect(step.label).toBeDefined()
    expect(typeof step.label).toBe('string')
    expect(step.label.length).toBeGreaterThan(0)

    expect(step.prompt).toBeDefined()
    expect(typeof step.prompt).toBe('string')

    expect(step.defaultPrompt).toBeDefined()
    expect(typeof step.defaultPrompt).toBe('string')
  }

  describe('Property 3: 提示词步骤完整性', () => {
    describe('getGeminiGeneratePromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_generate',
          config: {}
        }
        const steps = getGeminiGeneratePromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it('应该包含 system 和 user 步骤', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_generate',
          config: {}
        }
        const steps = getGeminiGeneratePromptSteps(params)

        const stepIds = steps.map((s) => s.id)
        expect(stepIds).toContain('system')
        expect(stepIds).toContain('user')
      })

      it('每个步骤应该有正确的结构', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_generate',
          config: {}
        }
        const steps = getGeminiGeneratePromptSteps(params)

        steps.forEach(validateStepStructure)
      })

      it('应该支持 customPrompts 覆盖', () => {
        const customSystem = '自定义系统提示词'
        const customUser = '自定义用户提示词'
        const params: NodePromptConfig = {
          nodeType: 'gemini_generate',
          config: {},
          customPrompts: {
            system: customSystem,
            user: customUser
          }
        }
        const steps = getGeminiGeneratePromptSteps(params)

        const systemStep = steps.find((s) => s.id === 'system')
        const userStep = steps.find((s) => s.id === 'user')

        expect(systemStep?.prompt).toBe(customSystem)
        expect(userStep?.prompt).toBe(customUser)
        // 默认值应该保持不变
        expect(systemStep?.defaultPrompt).not.toBe(customSystem)
        expect(userStep?.defaultPrompt).not.toBe(customUser)
      })

      it('应该将 constraintPrompt 添加到系统提示词', () => {
        const constraint = '必须保持服装颜色不变'
        const params: NodePromptConfig = {
          nodeType: 'gemini_generate',
          config: { constraintPrompt: constraint }
        }
        const steps = getGeminiGeneratePromptSteps(params)

        const systemStep = steps.find((s) => s.id === 'system')
        expect(systemStep?.defaultPrompt).toContain(constraint)
      })
    })

    describe('getGeminiEditPromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_edit',
          config: {}
        }
        const steps = getGeminiEditPromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it('应该包含 main 和 negative 步骤', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_edit',
          config: {}
        }
        const steps = getGeminiEditPromptSteps(params)

        const stepIds = steps.map((s) => s.id)
        expect(stepIds).toContain('main')
        expect(stepIds).toContain('negative')
      })
    })

    describe('getEcomNodePromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_ecom',
          config: {}
        }
        const steps = getEcomNodePromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it('应该包含主图、背面图、细节图和移动端步骤', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_ecom',
          config: {}
        }
        const steps = getEcomNodePromptSteps(params)

        const stepIds = steps.map((s) => s.id)
        expect(stepIds).toContain('main')
        expect(stepIds).toContain('back')
        expect(stepIds).toContain('mobile')
        // 8 种细节图
        expect(stepIds).toContain('detail_collar')
        expect(stepIds).toContain('detail_sleeve')
        expect(stepIds).toContain('detail_hem')
        expect(stepIds).toContain('detail_print')
      })

      it('应该有 11 个步骤（主图 + 背面 + 8细节 + 移动端）', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_ecom',
          config: {}
        }
        const steps = getEcomNodePromptSteps(params)

        expect(steps.length).toBe(11)
      })
    })

    describe('getPatternNodePromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_pattern',
          config: {}
        }
        const steps = getPatternNodePromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it('应该包含 pattern、graphic 和 mockup 步骤', () => {
        const params: NodePromptConfig = {
          nodeType: 'gemini_pattern',
          config: {}
        }
        const steps = getPatternNodePromptSteps(params)

        const stepIds = steps.map((s) => s.id)
        expect(stepIds).toContain('pattern')
        expect(stepIds).toContain('graphic')
        expect(stepIds).toContain('mockup')
      })
    })

    describe('getUnifiedModelPromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'unified_prompt',
          config: { outputMode: 'model' }
        }
        const steps = getUnifiedModelPromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })
    })

    describe('getUnifiedPatternPromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'unified_prompt',
          config: { outputMode: 'pattern' }
        }
        const steps = getUnifiedPatternPromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })
    })

    describe('getUnifiedEcomPromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'unified_prompt',
          config: { outputMode: 'ecom' }
        }
        const steps = getUnifiedEcomPromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })
    })

    describe('getVideoPromptSteps', () => {
      it('应该返回非空的步骤数组', () => {
        const params: NodePromptConfig = {
          nodeType: 'video_prompt',
          config: {}
        }
        const steps = getVideoPromptSteps(params)

        expect(steps).toBeDefined()
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it('应该包含 system 和 user 步骤', () => {
        const params: NodePromptConfig = {
          nodeType: 'video_prompt',
          config: {}
        }
        const steps = getVideoPromptSteps(params)

        const stepIds = steps.map((s) => s.id)
        expect(stepIds).toContain('system')
        expect(stepIds).toContain('user')
      })
    })
  })

  describe('getPromptStepsForNode 统一入口', () => {
    it('应该正确路由 gemini_generate 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_generate',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
      expect(steps.map((s) => s.id)).toContain('system')
    })

    it('应该正确路由 gemini_generate_model 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_generate_model',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
    })

    it('应该正确路由 gemini_model_from_clothes 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_model_from_clothes',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
    })

    it('应该正确路由 gemini_edit 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_edit',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
      expect(steps.map((s) => s.id)).toContain('main')
    })

    it('应该正确路由 gemini_ecom 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_ecom',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBe(11)
    })

    it('应该正确路由 gemini_pattern 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'gemini_pattern',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBe(3)
    })

    it('应该正确路由 unified_prompt 节点（model 模式）', () => {
      const params: NodePromptConfig = {
        nodeType: 'unified_prompt',
        config: { outputMode: 'model' }
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
    })

    it('应该正确路由 video_prompt 节点', () => {
      const params: NodePromptConfig = {
        nodeType: 'video_prompt',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps.length).toBeGreaterThan(0)
    })

    it('未知节点类型应该返回空数组', () => {
      const params: NodePromptConfig = {
        nodeType: 'unknown_node_type',
        config: {}
      }
      const steps = getPromptStepsForNode(params)

      expect(steps).toEqual([])
    })
  })
})
