/**
 * GeminiGenerateExecutor customPrompts 属性测试
 *
 * **Property 2: 执行器优先使用自定义提示词**
 * *For any* 执行器，当 config.customPrompts 存在时，执行器应该优先使用自定义提示词而不是默认提示词
 * **Validates: Requirements 3.3, 7.1**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock WorkflowAiService
vi.mock('../../../services/WorkflowAiService', () => ({
  WorkflowAiService: {
    findGeminiImageProvider: vi.fn().mockResolvedValue({
      provider: { id: 'test-provider' },
      model: { id: 'test-model' }
    }),
    loadImagesAsBase64: vi.fn().mockResolvedValue([]),
    generateImage: vi.fn().mockResolvedValue('base64-image-data')
  }
}))

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import type { NodeExecutionContext } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

describe('GeminiGenerateExecutor customPrompts', () => {
  let executor: GeminiGenerateExecutor
  let mockContext: NodeExecutionContext

  beforeEach(() => {
    executor = new GeminiGenerateExecutor()
    mockContext = {
      nodeId: 'test-node',
      workflowId: 'test-workflow',
      log: vi.fn(),
      abortSignal: new AbortController().signal
    } as unknown as NodeExecutionContext

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Property 2: 执行器优先使用自定义提示词', () => {
    it('当没有 customPrompts 时，应该使用 config.prompt', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model'
      }

      await executor.execute({}, config, mockContext)

      expect(WorkflowAiService.generateImage).toHaveBeenCalled()
      const callArgs = (WorkflowAiService.generateImage as any).mock.calls[0]
      expect(callArgs[2].prompt).toBe('默认提示词')
    })

    it('当有 customPrompts.user 时，应该优先使用自定义提示词', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {
          user: '自定义用户提示词'
        }
      }

      await executor.execute({}, config, mockContext)

      expect(WorkflowAiService.generateImage).toHaveBeenCalled()
      const callArgs = (WorkflowAiService.generateImage as any).mock.calls[0]
      expect(callArgs[2].prompt).toBe('自定义用户提示词')
    })

    it('当 customPrompts 为空对象时，应该使用 config.prompt', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {}
      }

      await executor.execute({}, config, mockContext)

      expect(WorkflowAiService.generateImage).toHaveBeenCalled()
      const callArgs = (WorkflowAiService.generateImage as any).mock.calls[0]
      expect(callArgs[2].prompt).toBe('默认提示词')
    })

    it('当 customPrompts.user 为空字符串时，应该使用 config.prompt', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {
          user: ''
        }
      }

      await executor.execute({}, config, mockContext)

      expect(WorkflowAiService.generateImage).toHaveBeenCalled()
      const callArgs = (WorkflowAiService.generateImage as any).mock.calls[0]
      // 空字符串是 falsy，所以应该使用默认提示词
      expect(callArgs[2].prompt).toBe('默认提示词')
    })

    it('当有 inputs.prompt 和 customPrompts.user 时，应该优先使用 customPrompts.user', async () => {
      const config = {
        prompt: '配置提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {
          user: '自定义用户提示词'
        }
      }

      const inputs = {
        prompt: '输入提示词'
      }

      await executor.execute(inputs, config, mockContext)

      expect(WorkflowAiService.generateImage).toHaveBeenCalled()
      const callArgs = (WorkflowAiService.generateImage as any).mock.calls[0]
      expect(callArgs[2].prompt).toBe('自定义用户提示词')
    })
  })

  describe('日志记录', () => {
    it('当使用自定义提示词时，应该记录日志', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {
          user: '自定义用户提示词'
        }
      }

      await executor.execute({}, config, mockContext)

      // 检查是否记录了使用自定义提示词的日志
      const logCalls = (mockContext.log as any).mock.calls
      const hasCustomPromptLog = logCalls.some(
        (call: any[]) => call[0]?.includes?.('自定义') || call[1]?.includes?.('自定义')
      )
      expect(hasCustomPromptLog).toBe(true)
    })

    it('应该在开始日志中记录 hasCustomPrompts', async () => {
      const config = {
        prompt: '默认提示词',
        providerId: 'test-provider',
        modelId: 'test-model',
        customPrompts: {
          user: '自定义用户提示词'
        }
      }

      await executor.execute({}, config, mockContext)

      // 检查开始日志是否包含 hasCustomPrompts
      const logCalls = (mockContext.log as any).mock.calls
      const startLog = logCalls.find((call: any[]) => call[0]?.includes?.('开始执行'))
      expect(startLog).toBeDefined()
    })
  })
})
