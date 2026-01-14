/**
 * Agent 调用链集成测试
 *
 * 测试 Agent 调用的集成场景:
 * - 完整调用链
 * - 工具定义格式验证
 * - 协作配置检查
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock store
vi.mock('@renderer/store', () => ({
  default: {
    getState: vi.fn(() => ({
      assistants: {
        assistants: [
          {
            id: 'caller-assistant',
            name: '主调用助手',
            description: '通用助手',
            prompt: '你是一个通用助手',
            collaboration: { canInitiate: true, canDelegate: true }
          },
          {
            id: 'translator-assistant',
            name: '翻译专家',
            description: '专业翻译',
            prompt: '你是一个专业翻译',
            collaboration: { canInitiate: false, canDelegate: true }
          },
          {
            id: 'code-expert',
            name: '代码专家',
            description: '代码分析',
            prompt: '你是一个编程专家',
            collaboration: { canInitiate: false, canDelegate: true }
          }
        ]
      }
    }))
  }
}))

// Mock AssistantService
vi.mock('../AssistantService', () => ({
  getProviderByModel: vi.fn(() => ({
    id: 'openai',
    name: 'OpenAI',
    apiKey: 'test-key',
    apiHost: 'https://api.openai.com'
  }))
}))

// Mock AiProvider
vi.mock('@renderer/aiCore', () => ({
  default: vi.fn().mockImplementation(() => ({
    completions: vi.fn().mockResolvedValue({
      getText: () => '这是模拟的 AI 回复'
    })
  }))
}))

// 导入被测试的服务
import {
  createInvokeAgentTool,
  getInvokableAssistants,
  handleInvokeAgentToolCall,
  invokeAssistant,
  isCollaborationEnabled
} from '../AssistantInvocationService'

describe('Agent 调用链集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('完整调用链测试', () => {
    it('应该能够发现并调用其他助手', async () => {
      // 步骤 1: 获取可调用的助手列表
      const invokableAssistants = getInvokableAssistants('caller-assistant')
      expect(invokableAssistants.length).toBeGreaterThan(0)
      expect(invokableAssistants.find((a) => a.id === 'translator-assistant')).toBeDefined()

      // 步骤 2: 创建工具定义
      const tool = createInvokeAgentTool('caller-assistant')
      expect(tool.name).toBe('invoke_agent')
      expect(tool.description).toContain('翻译专家')

      // 步骤 3: 执行调用
      const result = await invokeAssistant('翻译专家', '翻译 Hello', {
        callerAssistantId: 'caller-assistant'
      })

      expect(result.success).toBe(true)
      expect(result.assistantId).toBe('translator-assistant')
      expect(result.response).toBeDefined()
    })

    it('应该能够处理工具调用格式', async () => {
      const toolCallResult = await handleInvokeAgentToolCall(
        {
          agent_name: '翻译专家',
          request: '翻译 Hello',
          include_system_prompt: true
        },
        'caller-assistant'
      )

      expect(toolCallResult).toContain('翻译专家')
      expect(toolCallResult).toContain('的回复')
    })

    it('应该能够处理调用失败情况', async () => {
      const result = await invokeAssistant('不存在的助手', '测试', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('未找到助手')
    })

    it('应该能够通过 ID 和名称查找助手', async () => {
      // 通过名称
      const result1 = await invokeAssistant('翻译专家', '测试', {})
      expect(result1.success).toBe(true)
      expect(result1.assistantId).toBe('translator-assistant')

      // 通过 ID
      const result2 = await invokeAssistant('translator-assistant', '测试', {})
      expect(result2.success).toBe(true)
      expect(result2.assistantId).toBe('translator-assistant')
    })

    it('应该支持并发调用多个助手', async () => {
      const [translateResult, codeResult] = await Promise.all([
        invokeAssistant('翻译专家', '翻译测试', {}),
        invokeAssistant('代码专家', '代码审查测试', {})
      ])

      expect(translateResult.success).toBe(true)
      expect(translateResult.assistantName).toBe('翻译专家')

      expect(codeResult.success).toBe(true)
      expect(codeResult.assistantName).toBe('代码专家')
    })
  })

  describe('协作配置检查', () => {
    it('canInitiate=true 时应启用协作', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: true, canDelegate: false }
      } as any

      expect(isCollaborationEnabled(assistant)).toBe(true)
    })

    it('canDelegate=true 时应启用协作', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: false, canDelegate: true }
      } as any

      expect(isCollaborationEnabled(assistant)).toBe(true)
    })

    it('两者都为 false 时应禁用协作', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: false, canDelegate: false }
      } as any

      expect(isCollaborationEnabled(assistant)).toBe(false)
    })

    it('无 collaboration 配置时应禁用协作', () => {
      const assistant = {
        id: 'test',
        name: 'Test'
      } as any

      expect(isCollaborationEnabled(assistant)).toBe(false)
    })
  })

  describe('工具定义格式', () => {
    it('invoke_agent 工具应符合 MCP Tool 规范', () => {
      const tool = createInvokeAgentTool('caller-assistant')

      // 必需字段
      expect(tool.id).toBe('invoke_agent')
      expect(tool.name).toBe('invoke_agent')
      expect(tool.description).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.serverName).toBe('built-in')
      expect(tool.serverId).toBe('assistant-invocation')
      expect(tool.type).toBe('mcp')
      expect(tool.isBuiltIn).toBe(true)

      // inputSchema 结构
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.properties).toHaveProperty('agent_name')
      expect(tool.inputSchema.properties).toHaveProperty('request')
      expect(tool.inputSchema.required).toContain('agent_name')
      expect(tool.inputSchema.required).toContain('request')
    })

    it('工具描述应包含可调用的助手', () => {
      const tool = createInvokeAgentTool('caller-assistant')

      // 应包含其他助手
      expect(tool.description).toContain('翻译专家')
      expect(tool.description).toContain('代码专家')
    })

    it('工具描述应排除调用者自身', () => {
      const tool = createInvokeAgentTool('caller-assistant')

      // 不应包含自己
      expect(tool.description).not.toContain('主调用助手')
    })
  })

  describe('执行时间跟踪', () => {
    it('应该记录执行时间', async () => {
      const result = await invokeAssistant('翻译专家', '测试', {})

      expect(result.executionTimeMs).toBeDefined()
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0)
    })
  })
})
