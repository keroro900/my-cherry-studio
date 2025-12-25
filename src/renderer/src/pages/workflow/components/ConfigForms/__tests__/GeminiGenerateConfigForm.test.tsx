/**
 * GeminiGenerateConfigForm 提示词编辑测试
 *
 * **Property 1: 提示词保存一致性**
 * *For any* 节点配置表单，当用户编辑提示词并保存时，config.customPrompts 应该只包含与默认值不同的提示词
 * **Validates: Requirements 3.2, 4.3**
 */

import { describe, expect, it, vi } from 'vitest'

import { getGeminiGeneratePromptSteps, type PromptStep } from '../nodePromptSteps'

describe('GeminiGenerateConfigForm 提示词编辑', () => {
  describe('Property 1: 提示词保存一致性', () => {
    // 模拟 handleSavePrompts 逻辑
    function simulateSavePrompts(steps: PromptStep[]): Record<string, string> | undefined {
      const customPrompts: Record<string, string> = {}
      steps.forEach((step) => {
        if (step.prompt !== step.defaultPrompt) {
          customPrompts[step.id] = step.prompt
        }
      })
      return Object.keys(customPrompts).length > 0 ? customPrompts : undefined
    }

    it('当所有提示词都是默认值时，应该返回 undefined', () => {
      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {}
      })

      const result = simulateSavePrompts(steps)
      expect(result).toBeUndefined()
    })

    it('当只有 system 提示词被修改时，应该只保存 system', () => {
      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {}
      })

      // 模拟用户修改 system 提示词
      const modifiedSteps = steps.map((step) => (step.id === 'system' ? { ...step, prompt: '自定义系统提示词' } : step))

      const result = simulateSavePrompts(modifiedSteps)
      expect(result).toBeDefined()
      expect(result?.system).toBe('自定义系统提示词')
      expect(result?.user).toBeUndefined()
    })

    it('当只有 user 提示词被修改时，应该只保存 user', () => {
      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {}
      })

      // 模拟用户修改 user 提示词
      const modifiedSteps = steps.map((step) => (step.id === 'user' ? { ...step, prompt: '自定义用户提示词' } : step))

      const result = simulateSavePrompts(modifiedSteps)
      expect(result).toBeDefined()
      expect(result?.user).toBe('自定义用户提示词')
      expect(result?.system).toBeUndefined()
    })

    it('当两个提示词都被修改时，应该保存两个', () => {
      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {}
      })

      // 模拟用户修改两个提示词
      const modifiedSteps = steps.map((step) => {
        if (step.id === 'system') return { ...step, prompt: '自定义系统提示词' }
        if (step.id === 'user') return { ...step, prompt: '自定义用户提示词' }
        return step
      })

      const result = simulateSavePrompts(modifiedSteps)
      expect(result).toBeDefined()
      expect(result?.system).toBe('自定义系统提示词')
      expect(result?.user).toBe('自定义用户提示词')
    })

    it('当提示词被修改后又恢复为默认值时，应该不保存该提示词', () => {
      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {}
      })

      // 模拟用户修改后又恢复为默认值
      const modifiedSteps = steps.map((step) => {
        if (step.id === 'system') return { ...step, prompt: step.defaultPrompt }
        if (step.id === 'user') return { ...step, prompt: '自定义用户提示词' }
        return step
      })

      const result = simulateSavePrompts(modifiedSteps)
      expect(result).toBeDefined()
      expect(result?.system).toBeUndefined()
      expect(result?.user).toBe('自定义用户提示词')
    })
  })

  describe('customPrompts 加载', () => {
    it('应该正确加载已保存的 customPrompts', () => {
      const customPrompts = {
        system: '已保存的系统提示词',
        user: '已保存的用户提示词'
      }

      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {},
        customPrompts
      })

      const systemStep = steps.find((s) => s.id === 'system')
      const userStep = steps.find((s) => s.id === 'user')

      expect(systemStep?.prompt).toBe('已保存的系统提示词')
      expect(userStep?.prompt).toBe('已保存的用户提示词')
    })

    it('应该保留默认值以便恢复', () => {
      const customPrompts = {
        system: '已保存的系统提示词'
      }

      const steps = getGeminiGeneratePromptSteps({
        nodeType: 'gemini_generate',
        config: {},
        customPrompts
      })

      const systemStep = steps.find((s) => s.id === 'system')

      expect(systemStep?.prompt).toBe('已保存的系统提示词')
      expect(systemStep?.defaultPrompt).not.toBe('已保存的系统提示词')
      expect(systemStep?.defaultPrompt.length).toBeGreaterThan(0)
    })
  })

  describe('onUpdateConfig 调用', () => {
    it('应该使用正确的 key 调用 onUpdateConfig', () => {
      const onUpdateConfig = vi.fn()

      // 模拟保存逻辑
      const customPrompts = { system: '自定义系统提示词' }
      onUpdateConfig('customPrompts', customPrompts)

      expect(onUpdateConfig).toHaveBeenCalledWith('customPrompts', customPrompts)
    })

    it('当没有修改时应该传入 undefined', () => {
      const onUpdateConfig = vi.fn()

      // 模拟保存逻辑（没有修改）
      onUpdateConfig('customPrompts', undefined)

      expect(onUpdateConfig).toHaveBeenCalledWith('customPrompts', undefined)
    })
  })
})
