/**
 * AssistantInvocationService 测试
 *
 * 测试助手间协作调用功能
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultCollaboration } from '@renderer/types'

import {
  createGetTaskStatusTool,
  createInvokeAgentTool,
  createInvokeAgentToolWithAsync,
  getAsyncTaskStatus,
  getInvokableAssistants,
  handleGetTaskStatusToolCall,
  handleInvokeAgentToolCall,
  handleInvokeAgentToolCallWithAsync,
  invokeAssistant,
  invokeAssistantAsync,
  isCollaborationEnabled
} from '../AssistantInvocationService'

// Mock store
vi.mock('@renderer/store', () => ({
  default: {
    getState: vi.fn(() => ({
      assistants: {
        assistants: [
          {
            id: 'assistant-1',
            name: '翻译助手',
            description: '专业翻译',
            prompt: '你是一个专业翻译',
            collaboration: { canInitiate: true, canDelegate: false }
          },
          {
            id: 'assistant-2',
            name: '代码专家',
            description: '代码分析',
            prompt: '你是一个代码专家',
            collaboration: { canInitiate: true, canDelegate: true }
          },
          {
            id: 'assistant-3',
            name: '默认助手',
            description: '通用助手'
            // 无 collaboration 配置
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

describe('AssistantInvocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isCollaborationEnabled', () => {
    it('应该在 canInitiate 为 true 时返回 true', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: true, canDelegate: false }
      }
      expect(isCollaborationEnabled(assistant as any)).toBe(true)
    })

    it('应该在 canDelegate 为 true 时返回 true', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: false, canDelegate: true }
      }
      expect(isCollaborationEnabled(assistant as any)).toBe(true)
    })

    it('应该在没有 collaboration 配置时返回 false', () => {
      const assistant = {
        id: 'test',
        name: 'Test'
      }
      expect(isCollaborationEnabled(assistant as any)).toBe(false)
    })

    it('应该在 collaboration 全为 false 时返回 false', () => {
      const assistant = {
        id: 'test',
        name: 'Test',
        collaboration: { canInitiate: false, canDelegate: false }
      }
      expect(isCollaborationEnabled(assistant as any)).toBe(false)
    })
  })

  describe('getInvokableAssistants', () => {
    it('应该返回所有助手（排除自己）', () => {
      const assistants = getInvokableAssistants('assistant-1')
      expect(assistants.length).toBe(2)
      expect(assistants.find((a) => a.id === 'assistant-1')).toBeUndefined()
    })

    it('不传 ID 时应该返回所有助手', () => {
      const assistants = getInvokableAssistants()
      expect(assistants.length).toBe(3)
    })
  })

  describe('createInvokeAgentTool', () => {
    it('应该创建正确的工具定义', () => {
      const tool = createInvokeAgentTool('assistant-1')

      expect(tool.name).toBe('invoke_agent')
      expect(tool.id).toBe('invoke_agent')
      expect(tool.inputSchema.properties).toHaveProperty('agent_name')
      expect(tool.inputSchema.properties).toHaveProperty('request')
      expect(tool.inputSchema.required).toContain('agent_name')
      expect(tool.inputSchema.required).toContain('request')
    })

    it('工具描述应该包含可调用的助手列表', () => {
      const tool = createInvokeAgentTool('assistant-1')

      expect(tool.description).toContain('翻译助手')
      expect(tool.description).not.toContain('assistant-1') // 排除自己
    })
  })

  describe('createInvokeAgentToolWithAsync', () => {
    it('应该创建支持异步模式的工具定义', () => {
      const tool = createInvokeAgentToolWithAsync('assistant-1')

      expect(tool.name).toBe('invoke_agent')
      expect(tool.inputSchema.properties).toHaveProperty('mode')
      const properties = tool.inputSchema.properties as Record<string, { enum?: string[] }>
      expect(properties.mode.enum).toContain('sync')
      expect(properties.mode.enum).toContain('async')
    })
  })

  describe('createGetTaskStatusTool', () => {
    it('应该创建任务状态查询工具', () => {
      const tool = createGetTaskStatusTool()

      expect(tool.name).toBe('get_agent_task_status')
      expect(tool.inputSchema.properties).toHaveProperty('task_id')
      expect(tool.inputSchema.required).toContain('task_id')
    })
  })

  describe('invokeAssistant', () => {
    it('应该能够调用目标助手并返回结果', async () => {
      const result = await invokeAssistant('翻译助手', '翻译: Hello World')

      expect(result.success).toBe(true)
      expect(result.assistantName).toBe('翻译助手')
      expect(result.response).toBeDefined()
    })

    it('应该在找不到助手时返回错误', async () => {
      const result = await invokeAssistant('不存在的助手', '测试')

      expect(result.success).toBe(false)
      expect(result.error).toContain('未找到助手')
    })
  })

  describe('handleInvokeAgentToolCall', () => {
    it('应该处理工具调用并返回格式化结果', async () => {
      const result = await handleInvokeAgentToolCall({
        agent_name: '翻译助手',
        request: '翻译: Hello'
      })

      expect(result).toContain('翻译助手 的回复')
    })
  })

  describe('handleInvokeAgentToolCallWithAsync', () => {
    it('同步模式应该等待结果', async () => {
      const result = await handleInvokeAgentToolCallWithAsync({
        agent_name: '翻译助手',
        request: '翻译: Hello',
        mode: 'sync'
      })

      expect(result).toContain('翻译助手 的回复')
    })

    it('异步模式应该返回任务 ID', async () => {
      const result = await handleInvokeAgentToolCallWithAsync({
        agent_name: '翻译助手',
        request: '翻译: Hello',
        mode: 'async'
      })

      expect(result).toContain('异步任务已创建')
      expect(result).toContain('任务ID')
    })
  })

  describe('invokeAssistantAsync', () => {
    it('应该返回任务 ID 并在后台执行', async () => {
      const taskId = await invokeAssistantAsync('翻译助手', '翻译: Hello')

      expect(taskId).toBeDefined()
      expect(typeof taskId).toBe('string')

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100))

      const status = getAsyncTaskStatus(taskId)
      expect(status).toBeDefined()
      expect(['pending', 'running', 'completed', 'failed']).toContain(status?.status)
    })
  })

  describe('handleGetTaskStatusToolCall', () => {
    it('应该返回任务不存在的错误', () => {
      const result = handleGetTaskStatusToolCall({ task_id: 'non-existent' })
      expect(result).toContain('未找到任务')
    })
  })
})

describe('createDefaultCollaboration', () => {
  it('应该创建默认协作配置', () => {
    const collaboration = createDefaultCollaboration()

    expect(collaboration.canInitiate).toBe(true)
    expect(collaboration.canDelegate).toBe(false)
    expect(collaboration.maxConcurrentTasks).toBe(3)
    expect(collaboration.responseStyle).toBe('adaptive')
  })
})
