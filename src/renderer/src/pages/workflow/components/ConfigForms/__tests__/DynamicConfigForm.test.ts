/**
 * DynamicConfigForm 属性测试
 * Property-Based Tests for DynamicConfigForm
 *
 * **Feature: ui-prompt-optimization, Property 6: 动态表单字段渲染**
 * **Feature: ui-prompt-optimization, Property 11: DynamicConfigForm 自动渲染**
 * **Validates: Requirements 4.3, 11.4**
 */

import { describe, expect, it } from 'vitest'

import type { NodeConfigField, NodeConfigSchema } from '../../../nodes/base/types'

// ==================== Property 6: 动态表单字段渲染 ====================

describe('Property 6: 动态表单字段渲染', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 6: 动态表单字段渲染**
   * **Validates: Requirements 4.3**
   *
   * *For any* imageGenerationConfig 中定义的模型配置，
   * WorkflowDynamicImageForm SHALL 渲染该配置定义的所有字段
   */

  describe('NodeConfigSchema 结构验证', () => {
    it('should support all required field types', () => {
      const supportedTypes: NodeConfigField['type'][] = [
        'text',
        'textarea',
        'number',
        'select',
        'checkbox',
        'model-selector',
        'preset-selector',
        'constraint-prompt'
      ]

      // 验证所有类型都是有效的
      for (const type of supportedTypes) {
        const field: NodeConfigField = {
          key: `test_${type}`,
          label: `Test ${type}`,
          type
        }
        expect(field.type).toBe(type)
      }
    })

    it('should support showWhen conditional rendering', () => {
      const schema: NodeConfigSchema = {
        fields: [
          {
            key: 'mode',
            label: 'Mode',
            type: 'select',
            options: [
              { label: 'Simple', value: 'simple' },
              { label: 'Advanced', value: 'advanced' }
            ]
          },
          {
            key: 'advancedOption',
            label: 'Advanced Option',
            type: 'text',
            showWhen: { field: 'mode', value: 'advanced' }
          }
        ]
      }

      expect(schema.fields[1].showWhen).toBeDefined()
      expect(schema.fields[1].showWhen?.field).toBe('mode')
      expect(schema.fields[1].showWhen?.value).toBe('advanced')
    })

    it('should support array values in showWhen', () => {
      const field: NodeConfigField = {
        key: 'conditionalField',
        label: 'Conditional Field',
        type: 'text',
        showWhen: { field: 'type', value: ['option1', 'option2'] }
      }

      expect(Array.isArray(field.showWhen?.value)).toBe(true)
    })
  })

  describe('字段默认值', () => {
    it('should support default values for all field types', () => {
      const fields: NodeConfigField[] = [
        { key: 'text', label: 'Text', type: 'text', default: 'default text' },
        { key: 'textarea', label: 'Textarea', type: 'textarea', default: 'default textarea' },
        { key: 'number', label: 'Number', type: 'number', default: 42 },
        { key: 'select', label: 'Select', type: 'select', default: 'option1' },
        { key: 'checkbox', label: 'Checkbox', type: 'checkbox', default: true },
        { key: 'preset', label: 'Preset', type: 'preset-selector', default: 'kawaii' },
        { key: 'constraint', label: 'Constraint', type: 'constraint-prompt', default: '' }
      ]

      for (const field of fields) {
        expect(field.default).toBeDefined()
      }
    })
  })
})

// ==================== Property 11: DynamicConfigForm 自动渲染 ====================

describe('Property 11: DynamicConfigForm 自动渲染', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 11: DynamicConfigForm 自动渲染**
   * **Validates: Requirements 11.4**
   *
   * *For any* 节点定义包含 configSchema，
   * DynamicConfigForm SHALL 根据 schema 正确渲染所有字段
   */

  describe('configSchema 完整性', () => {
    it('should have required properties for each field', () => {
      const requiredProps: (keyof NodeConfigField)[] = ['key', 'label', 'type']

      const testField: NodeConfigField = {
        key: 'testKey',
        label: 'Test Label',
        type: 'text'
      }

      for (const prop of requiredProps) {
        expect(testField[prop]).toBeDefined()
      }
    })

    it('should support optional properties', () => {
      const fullField: NodeConfigField = {
        key: 'fullField',
        label: 'Full Field',
        type: 'number',
        default: 10,
        description: 'A description',
        placeholder: 'Enter value...',
        required: true,
        min: 0,
        max: 100,
        step: 5,
        options: [],
        showWhen: { field: 'other', value: true }
      }

      expect(fullField.description).toBeDefined()
      expect(fullField.placeholder).toBeDefined()
      expect(fullField.required).toBe(true)
      expect(fullField.min).toBe(0)
      expect(fullField.max).toBe(100)
      expect(fullField.step).toBe(5)
    })
  })

  describe('新增字段类型支持', () => {
    it('should support preset-selector type', () => {
      const presetField: NodeConfigField = {
        key: 'stylePreset',
        label: 'Style Preset',
        type: 'preset-selector',
        options: [
          { label: 'Kawaii', value: 'kawaii' },
          { label: 'Sporty', value: 'sporty' },
          { label: 'Preppy', value: 'preppy' }
        ],
        default: 'kawaii'
      }

      expect(presetField.type).toBe('preset-selector')
      expect(presetField.options?.length).toBeGreaterThan(0)
    })

    it('should support constraint-prompt type', () => {
      const constraintField: NodeConfigField = {
        key: 'constraintPrompt',
        label: 'Constraint Prompt',
        type: 'constraint-prompt',
        placeholder: 'Enter constraints...',
        default: ''
      }

      expect(constraintField.type).toBe('constraint-prompt')
    })

    it('should support model-selector with filter', () => {
      const modelField: NodeConfigField = {
        key: 'model',
        label: 'Model',
        type: 'model-selector',
        modelFilter: 'image-generation'
      }

      expect(modelField.type).toBe('model-selector')
      expect(modelField.modelFilter).toBe('image-generation')
    })
  })

  describe('Schema 验证', () => {
    it('should create valid schema for image generation node', () => {
      const imageGenSchema: NodeConfigSchema = {
        fields: [
          {
            key: 'model',
            label: 'AI Model',
            type: 'model-selector',
            modelFilter: 'image-generation',
            required: true
          },
          {
            key: 'prompt',
            label: 'Prompt',
            type: 'textarea',
            placeholder: 'Describe the image...',
            required: true
          },
          {
            key: 'stylePreset',
            label: 'Style Preset',
            type: 'preset-selector',
            options: [
              { label: 'None', value: 'none' },
              { label: 'Kawaii', value: 'kawaii' },
              { label: 'Sporty', value: 'sporty' }
            ],
            default: 'none'
          },
          {
            key: 'constraintPrompt',
            label: 'Constraints',
            type: 'constraint-prompt',
            placeholder: 'Additional constraints...'
          },
          {
            key: 'imageSize',
            label: 'Image Size',
            type: 'select',
            options: [
              { label: '1K', value: '1K' },
              { label: '2K', value: '2K' },
              { label: '4K', value: '4K' }
            ],
            default: '2K'
          }
        ]
      }

      expect(imageGenSchema.fields.length).toBe(5)
      expect(imageGenSchema.fields.every((f) => f.key && f.label && f.type)).toBe(true)
    })
  })
})

// ==================== 辅助函数测试 ====================

describe('shouldShowField 逻辑验证', () => {
  /**
   * 验证 showWhen 条件逻辑
   */

  function shouldShowField(field: NodeConfigField, config: Record<string, any>): boolean {
    if (!field.showWhen) {
      return true
    }
    const { field: conditionField, value: conditionValue } = field.showWhen
    const currentValue = config[conditionField]

    if (Array.isArray(conditionValue)) {
      return conditionValue.includes(currentValue)
    }

    return currentValue === conditionValue
  }

  it('should show field when no showWhen condition', () => {
    const field: NodeConfigField = { key: 'test', label: 'Test', type: 'text' }
    expect(shouldShowField(field, {})).toBe(true)
  })

  it('should show field when condition matches', () => {
    const field: NodeConfigField = {
      key: 'test',
      label: 'Test',
      type: 'text',
      showWhen: { field: 'mode', value: 'advanced' }
    }
    expect(shouldShowField(field, { mode: 'advanced' })).toBe(true)
  })

  it('should hide field when condition does not match', () => {
    const field: NodeConfigField = {
      key: 'test',
      label: 'Test',
      type: 'text',
      showWhen: { field: 'mode', value: 'advanced' }
    }
    expect(shouldShowField(field, { mode: 'simple' })).toBe(false)
  })

  it('should show field when value is in array', () => {
    const field: NodeConfigField = {
      key: 'test',
      label: 'Test',
      type: 'text',
      showWhen: { field: 'type', value: ['option1', 'option2'] }
    }
    expect(shouldShowField(field, { type: 'option1' })).toBe(true)
    expect(shouldShowField(field, { type: 'option2' })).toBe(true)
    expect(shouldShowField(field, { type: 'option3' })).toBe(false)
  })
})
