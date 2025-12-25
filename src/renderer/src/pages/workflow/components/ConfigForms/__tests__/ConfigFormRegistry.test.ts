/**
 * ConfigFormRegistry 属性测试
 * Property-Based Tests for ConfigFormRegistry
 *
 * **Feature: ui-prompt-optimization, Property 10: 节点类型表单映射**
 * **Validates: Requirements 11.2**
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { WorkflowNodeType } from '../../../nodes/definitions/node-types'
import { type ConfigFormProps, configFormRegistry } from '../ConfigFormRegistry'

// 模拟组件用于测试
const MockGeminiGenerateForm = (() => null) as unknown as React.ComponentType<ConfigFormProps>
const MockGeminiEditForm = (() => null) as unknown as React.ComponentType<ConfigFormProps>
const MockEcomForm = (() => null) as unknown as React.ComponentType<ConfigFormProps>
const MockPatternForm = (() => null) as unknown as React.ComponentType<ConfigFormProps>
const MockUnifiedPromptForm = (() => null) as unknown as React.ComponentType<ConfigFormProps>

/**
 * 为测试注册模拟表单
 */
function registerMockForms(): void {
  // Gemini 图像生成节点
  configFormRegistry.register({
    nodeTypes: [
      WorkflowNodeType.GEMINI_GENERATE,
      WorkflowNodeType.GEMINI_GENERATE_MODEL,
      WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES
    ],
    component: MockGeminiGenerateForm,
    priority: 0,
    description: 'Gemini 图像生成节点配置表单'
  })

  // Gemini 图像编辑节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_EDIT, WorkflowNodeType.GEMINI_EDIT_CUSTOM],
    component: MockGeminiEditForm,
    priority: 0,
    description: 'Gemini 图像编辑节点配置表单'
  })

  // 电商图像生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_ECOM],
    component: MockEcomForm,
    priority: 0,
    description: '电商图像生成节点配置表单'
  })

  // 图案生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_PATTERN],
    component: MockPatternForm,
    priority: 0,
    description: '图案生成节点配置表单'
  })

  // 智能提示词节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.UNIFIED_PROMPT],
    component: MockUnifiedPromptForm,
    priority: 0,
    description: '智能提示词节点配置表单'
  })
}

// ==================== Property 10: 节点类型表单映射 ====================

describe('Property 10: 节点类型表单映射', () => {
  /**
   * **Feature: ui-prompt-optimization, Property 10: 节点类型表单映射**
   * **Validates: Requirements 11.2**
   *
   * *For any* 已注册的节点类型，ConfigPanel SHALL 渲染对应的配置表单组件
   */

  beforeEach(() => {
    // 清除之前的注册并注册模拟表单
    configFormRegistry.clear()
    registerMockForms()
  })

  describe('默认表单注册', () => {
    it('should have form registered for GEMINI_GENERATE', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_GENERATE)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_GENERATE_MODEL', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_GENERATE_MODEL)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_MODEL_FROM_CLOTHES', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_EDIT', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_EDIT)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_EDIT_CUSTOM', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_EDIT_CUSTOM)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_ECOM', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_ECOM)
      expect(form).not.toBeNull()
    })

    it('should have form registered for GEMINI_PATTERN', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.GEMINI_PATTERN)
      expect(form).not.toBeNull()
    })

    it('should have form registered for UNIFIED_PROMPT', () => {
      const form = configFormRegistry.getForm(WorkflowNodeType.UNIFIED_PROMPT)
      expect(form).not.toBeNull()
    })
  })

  describe('表单映射一致性', () => {
    it('should return same form for related node types', () => {
      const generateForm = configFormRegistry.getForm(WorkflowNodeType.GEMINI_GENERATE)
      const generateModelForm = configFormRegistry.getForm(WorkflowNodeType.GEMINI_GENERATE_MODEL)
      const modelFromClothesForm = configFormRegistry.getForm(WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES)

      // 这三个节点类型应该使用相同的表单组件
      expect(generateForm).toBe(MockGeminiGenerateForm)
      expect(generateModelForm).toBe(MockGeminiGenerateForm)
      expect(modelFromClothesForm).toBe(MockGeminiGenerateForm)
    })

    it('should return same form for edit node types', () => {
      const editForm = configFormRegistry.getForm(WorkflowNodeType.GEMINI_EDIT)
      const editCustomForm = configFormRegistry.getForm(WorkflowNodeType.GEMINI_EDIT_CUSTOM)

      // 这两个节点类型应该使用相同的表单组件
      expect(editForm).toBe(MockGeminiEditForm)
      expect(editCustomForm).toBe(MockGeminiEditForm)
    })
  })

  describe('hasForm 方法', () => {
    it('should return true for registered node types', () => {
      expect(configFormRegistry.hasForm(WorkflowNodeType.GEMINI_GENERATE)).toBe(true)
      expect(configFormRegistry.hasForm(WorkflowNodeType.GEMINI_ECOM)).toBe(true)
      expect(configFormRegistry.hasForm(WorkflowNodeType.GEMINI_PATTERN)).toBe(true)
    })

    it('should return false for unregistered node types', () => {
      expect(configFormRegistry.hasForm('unknown_node_type')).toBe(false)
      expect(configFormRegistry.hasForm('')).toBe(false)
    })
  })

  describe('getRegisteredNodeTypes 方法', () => {
    it('should return all registered node types', () => {
      const nodeTypes = configFormRegistry.getRegisteredNodeTypes()

      expect(nodeTypes).toContain(WorkflowNodeType.GEMINI_GENERATE)
      expect(nodeTypes).toContain(WorkflowNodeType.GEMINI_EDIT)
      expect(nodeTypes).toContain(WorkflowNodeType.GEMINI_ECOM)
      expect(nodeTypes).toContain(WorkflowNodeType.GEMINI_PATTERN)
      expect(nodeTypes).toContain(WorkflowNodeType.UNIFIED_PROMPT)
    })
  })

  describe('getAll 方法', () => {
    it('should return all registrations', () => {
      const registrations = configFormRegistry.getAll()

      expect(registrations.length).toBeGreaterThan(0)
      expect(registrations.every((r) => r.nodeTypes.length > 0)).toBe(true)
      expect(registrations.every((r) => r.component !== null)).toBe(true)
    })
  })
})

// ==================== 注册机制测试 ====================

describe('ConfigFormRegistry 注册机制', () => {
  // 使用独立的注册表实例进行测试
  let testRegistry: typeof configFormRegistry

  beforeEach(() => {
    // 创建新的注册表实例用于测试
    // 注意：由于 configFormRegistry 是单例，这里我们测试其行为
    testRegistry = configFormRegistry
  })

  describe('优先级覆盖', () => {
    it('should allow higher priority registration to override', () => {
      // 创建一个模拟组件
      const MockComponent1 = (() => null) as unknown as React.ComponentType<ConfigFormProps>
      const MockComponent2 = (() => null) as unknown as React.ComponentType<ConfigFormProps>

      // 注册一个测试节点类型
      const testNodeType = 'test_priority_node'

      // 先注册低优先级
      testRegistry.register({
        nodeTypes: [testNodeType],
        component: MockComponent1,
        priority: 0
      })

      // 再注册高优先级
      testRegistry.register({
        nodeTypes: [testNodeType],
        component: MockComponent2,
        priority: 10
      })

      // 应该返回高优先级的组件
      const form = testRegistry.getForm(testNodeType)
      expect(form).toBe(MockComponent2)
    })

    it('should not override with lower priority', () => {
      const MockComponent1 = (() => null) as unknown as React.ComponentType<ConfigFormProps>
      const MockComponent2 = (() => null) as unknown as React.ComponentType<ConfigFormProps>

      const testNodeType = 'test_priority_node_2'

      // 先注册高优先级
      testRegistry.register({
        nodeTypes: [testNodeType],
        component: MockComponent1,
        priority: 10
      })

      // 再注册低优先级
      testRegistry.register({
        nodeTypes: [testNodeType],
        component: MockComponent2,
        priority: 0
      })

      // 应该仍然返回高优先级的组件
      const form = testRegistry.getForm(testNodeType)
      expect(form).toBe(MockComponent1)
    })
  })

  describe('多节点类型注册', () => {
    it('should register same component for multiple node types', () => {
      const MockComponent = (() => null) as unknown as React.ComponentType<ConfigFormProps>

      const nodeTypes = ['multi_test_1', 'multi_test_2', 'multi_test_3']

      testRegistry.register({
        nodeTypes,
        component: MockComponent,
        priority: 0
      })

      // 所有节点类型应该返回相同的组件
      for (const nodeType of nodeTypes) {
        expect(testRegistry.getForm(nodeType)).toBe(MockComponent)
      }
    })
  })
})
