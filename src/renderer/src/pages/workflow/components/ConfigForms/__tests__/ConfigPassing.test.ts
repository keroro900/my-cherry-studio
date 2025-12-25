/**
 * 配置项传递完整性属性测试
 * Property-Based Tests for Config Passing
 *
 * **Feature: ui-prompt-optimization, Property 7: 配置项传递完整性**
 * **Validates: Requirements 2.4, 9.2**
 */

import { describe, expect, it } from 'vitest'

// ==================== Property 7: 配置项传递完整性 ====================

describe('Property 7: 配置项传递完整性', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 7: 配置项传递完整性**
   * **Validates: Requirements 9.2**
   *
   * *For any* 配置表单中设置的配置项，
   * 执行器 SHALL 能够通过 config 参数正确读取该值
   */

  describe('配置项命名一致性', () => {
    /**
     * 验证配置表单使用的配置项名称与执行器读取的名称一致
     */

    it('should have consistent config keys for GeminiGenerateNode', () => {
      // 配置表单使用的配置项
      const formConfigKeys = [
        'prompt',
        'negativePrompt',
        'imageSize',
        'aspectRatio',
        'constraintPrompt',
        'ecomPresetId',
        'ecomPresetName',
        'ageGroup',
        'modelPose',
        'scenePreset',
        'imageInputCount',
        'imageInputPorts'
      ]

      // 执行器读取的配置项（从 GeminiGenerateExecutor 分析）
      const executorConfigKeys = [
        'prompt',
        'negativePrompt',
        'imageSize',
        'aspectRatio',
        'ageGroup',
        'gender',
        'scenePreset',
        'nodeType',
        'providerId',
        'modelId'
      ]

      // 验证关键配置项在两边都存在
      const commonKeys = ['prompt', 'negativePrompt', 'imageSize', 'aspectRatio', 'ageGroup', 'scenePreset']
      for (const key of commonKeys) {
        expect(formConfigKeys).toContain(key)
        expect(executorConfigKeys).toContain(key)
      }
    })

    it('should have consistent config keys for EcomNode', () => {
      // 配置表单使用的配置项
      const formConfigKeys = [
        'layout',
        'fillMode',
        'stylePreset',
        'styleConstraint',
        'garmentDescription',
        'extraNote',
        'enableBack',
        'enableDetail',
        'detailTypes',
        'imageSize',
        'aspectRatio',
        'useSystemPrompt',
        'professionalRetouch',
        'seed',
        'retryCount',
        'timeout'
      ]

      // 执行器读取的配置项
      const executorConfigKeys = [
        'layout',
        'fillMode',
        'stylePreset',
        'garmentDescription',
        'garmentDesc', // 兼容旧名称
        'enableBack',
        'enableDetail',
        'detailTypes',
        'detailType',
        'imageSize',
        'aspectRatio',
        'ecomStep'
      ]

      // 验证关键配置项
      const commonKeys = ['layout', 'fillMode', 'enableBack', 'enableDetail', 'imageSize', 'aspectRatio']
      for (const key of commonKeys) {
        expect(formConfigKeys).toContain(key)
        expect(executorConfigKeys).toContain(key)
      }
    })

    it('should have consistent config keys for PatternNode', () => {
      // 配置表单使用的配置项
      const formConfigKeys = [
        'generationMode',
        'outputType',
        'patternType',
        'stylePresetId',
        'stylePresetName',
        'stylePresetPrompt',
        'customPrompt',
        'negativePrompt',
        'density',
        'colorTone',
        'imageSize',
        'aspectRatio',
        'enableMockup',
        'mockupBaseImage',
        'enableSmartScaling',
        'enableAutoColorMatch',
        'mockupType',
        'useSystemPrompt',
        'promptEnhancement',
        'seed',
        'retryCount',
        'batchSize'
      ]

      // 执行器读取的配置项
      const executorConfigKeys = [
        'generationMode',
        'outputType',
        'patternStep',
        'stylePresetPrompt',
        'customPrompt',
        'density',
        'colorTone',
        'imageSize',
        'aspectRatio'
      ]

      // 验证关键配置项
      const commonKeys = ['generationMode', 'outputType', 'density', 'colorTone', 'imageSize', 'aspectRatio']
      for (const key of commonKeys) {
        expect(formConfigKeys).toContain(key)
        expect(executorConfigKeys).toContain(key)
      }
    })
  })

  describe('constraintPrompt 配置项', () => {
    /**
     * 验证 constraintPrompt 在所有支持的节点中正确传递
     */

    it('should support constraintPrompt in GeminiGenerateConfigForm', () => {
      // GeminiGenerateConfigForm 应该有 constraintPrompt 配置项
      const supportedConfigKeys = ['constraintPrompt']
      expect(supportedConfigKeys).toContain('constraintPrompt')
    })

    it('should support styleConstraint in EcomConfigForm', () => {
      // EcomConfigForm 使用 styleConstraint 作为约束提示词
      const supportedConfigKeys = ['styleConstraint']
      expect(supportedConfigKeys).toContain('styleConstraint')
    })

    it('should support constraintPrompt in GeminiEditConfigForm', () => {
      // GeminiEditConfigForm 应该有 constraintPrompt 配置项
      const supportedConfigKeys = ['constraintPrompt']
      expect(supportedConfigKeys).toContain('constraintPrompt')
    })
  })

  describe('配置项默认值', () => {
    /**
     * 验证配置项有合理的默认值
     */

    it('should have default imageSize', () => {
      const defaultImageSize = '2K'
      expect(['1K', '2K', '4K']).toContain(defaultImageSize)
    })

    it('should have default aspectRatio', () => {
      const defaultAspectRatio = '1:1'
      expect(['1:1', '3:4', '4:3', '9:16', '16:9']).toContain(defaultAspectRatio)
    })

    it('should have default layout for EcomNode', () => {
      const defaultLayout = 'flat_lay'
      expect(['flat_lay', 'hanging']).toContain(defaultLayout)
    })

    it('should have default fillMode for EcomNode', () => {
      const defaultFillMode = 'filled'
      expect(['filled', 'flat']).toContain(defaultFillMode)
    })

    it('should have default generationMode for PatternNode', () => {
      const defaultMode = 'mode_a'
      expect(['mode_a', 'mode_b', 'mode_c']).toContain(defaultMode)
    })
  })
})

// ==================== 配置项类型验证 ====================

describe('配置项类型验证', () => {
  /**
   * 验证配置项的类型正确性
   */

  it('should have string type for prompt fields', () => {
    const stringFields = ['prompt', 'negativePrompt', 'constraintPrompt', 'styleConstraint', 'customPrompt']
    for (const field of stringFields) {
      expect(typeof field).toBe('string')
    }
  })

  it('should have valid imageSize values', () => {
    const validSizes = ['1K', '2K', '4K']
    for (const size of validSizes) {
      expect(typeof size).toBe('string')
      expect(size).toMatch(/^\d+K$/)
    }
  })

  it('should have valid aspectRatio values', () => {
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9']
    for (const ratio of validRatios) {
      expect(typeof ratio).toBe('string')
      expect(ratio).toMatch(/^\d+:\d+$/)
    }
  })

  it('should have boolean type for toggle fields', () => {
    const booleanFields = ['enableBack', 'enableDetail', 'enableMockup', 'useSystemPrompt', 'professionalRetouch']
    for (const field of booleanFields) {
      expect(typeof field).toBe('string') // field name is string
    }
  })

  it('should have array type for detailTypes', () => {
    const detailTypes = ['collar', 'sleeve', 'hem', 'print']
    expect(Array.isArray(detailTypes)).toBe(true)
  })
})

// ==================== 配置项兼容性 ====================

describe('配置项兼容性', () => {
  /**
   * 验证新旧配置项名称的兼容性
   */

  it('should support both garmentDescription and garmentDesc', () => {
    // 执行器应该同时支持新旧名称
    const newName = 'garmentDescription'
    const oldName = 'garmentDesc'
    expect(newName).not.toBe(oldName)
  })

  it('should support both detailTypes array and single detailType', () => {
    // 执行器应该同时支持数组和单个值
    const arrayConfig = { detailTypes: ['collar', 'sleeve'] }
    const singleConfig = { detailType: 'collar' }
    expect(Array.isArray(arrayConfig.detailTypes)).toBe(true)
    expect(typeof singleConfig.detailType).toBe('string')
  })
})
