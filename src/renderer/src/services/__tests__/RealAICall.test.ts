/**
 * 真实 AI API 调用测试
 *
 * 使用环境变量配置 API Key 进行真实调用
 *
 * 配置环境变量后运行:
 * OPENAI_API_KEY=sk-xxx yarn test:renderer --run src/renderer/src/services/__tests__/RealAICall.test.ts
 *
 * 或在 .env.test 文件中配置
 */
import { describe, expect, it } from 'vitest'

import AiProvider from '@renderer/aiCore'
import type { Assistant, Model, Provider } from '@renderer/types'

// 从环境变量获取配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || ''
const OPENAI_API_HOST =
  process.env.OPENAI_API_HOST || process.env.VITE_OPENAI_API_HOST || 'https://api.openai.com/v1'

// 测试超时
const AI_TIMEOUT = 60000

// 检查是否配置了 API Key
const hasApiKey = OPENAI_API_KEY.length > 0

describe.skipIf(!hasApiKey)('真实 AI API 调用测试', () => {
  // 构造测试用 Provider
  const testProvider: Provider = {
    id: 'openai-test',
    name: 'OpenAI Test',
    type: 'openai',
    apiKey: OPENAI_API_KEY,
    apiHost: OPENAI_API_HOST,
    models: [],
    enabled: true
  }

  // 测试用模型
  const testModel: Model = {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai'
  }

  it(
    '应该能直接调用 OpenAI API',
    async () => {
      console.log('\n=== 真实 OpenAI API 调用测试 ===')
      console.log(`API Host: ${OPENAI_API_HOST}`)
      console.log(`Model: ${testModel.id}`)
      console.log(`API Key: ${OPENAI_API_KEY.slice(0, 10)}...`)

      const testAssistant: Assistant = {
        id: 'test-real-ai',
        name: '测试助手',
        prompt: '你是一个简洁的助手。用一个词或数字回答问题。',
        model: testModel,
        topics: [],
        messages: [],
        type: 'assistant',
        settings: {
          temperature: 0,
          contextCount: 1,
          maxTokens: 50,
          streamOutput: false
        } as any
      }

      const startTime = Date.now()

      try {
        const aiProvider = new AiProvider(testProvider)
        const result = await aiProvider.completions({
          assistant: testAssistant,
          messages: '1+1=?',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-real-ai'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`\n=== 调用成功 ===`)
        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(0)

        // 验证响应包含 "2"
        if (response.includes('2')) {
          console.log('✓ 数学计算正确')
        }
      } catch (error: any) {
        console.error('\n=== 调用失败 ===')
        console.error(`错误: ${error.message}`)

        // 分析错误类型
        if (error.message.includes('401')) {
          console.error('原因: API Key 无效')
        } else if (error.message.includes('429')) {
          console.error('原因: 请求频率限制')
        } else if (error.message.includes('fetch')) {
          console.error('原因: 网络连接问题')
        }

        throw error
      }
    },
    AI_TIMEOUT
  )

  it(
    '模拟助手间调用 - 翻译场景',
    async () => {
      console.log('\n=== 模拟助手间调用 - 翻译 ===')

      const translatorAssistant: Assistant = {
        id: 'test-translator',
        name: '翻译专家',
        prompt:
          '你是专业翻译。收到中文请翻译成英文，收到英文请翻译成中文。只输出翻译结果，不解释。',
        model: testModel,
        topics: [],
        messages: [],
        type: 'assistant',
        settings: {
          temperature: 0.3,
          contextCount: 1,
          maxTokens: 100,
          streamOutput: false
        } as any
      }

      const startTime = Date.now()

      try {
        const aiProvider = new AiProvider(testProvider)
        const result = await aiProvider.completions({
          assistant: translatorAssistant,
          messages: '你好，世界！',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-translate'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`输入: 你好，世界！`)
        console.log(`翻译: ${response}`)

        expect(response).toBeDefined()
        expect(response.toLowerCase()).toMatch(/hello|world/i)
        console.log('✓ 翻译结果包含英文')
      } catch (error: any) {
        console.error(`翻译失败: ${error.message}`)
        throw error
      }
    },
    AI_TIMEOUT
  )

  it(
    '模拟助手间调用 - 代码审查场景',
    async () => {
      console.log('\n=== 模拟助手间调用 - 代码审查 ===')

      const codeReviewerAssistant: Assistant = {
        id: 'test-code-reviewer',
        name: '代码专家',
        prompt: '你是代码审查专家。简洁地指出代码问题，一句话概括。',
        model: testModel,
        topics: [],
        messages: [],
        type: 'assistant',
        settings: {
          temperature: 0.2,
          contextCount: 1,
          maxTokens: 150,
          streamOutput: false
        } as any
      }

      const codeSnippet = `
function add(a, b) {
  return a + b
}
`

      const startTime = Date.now()

      try {
        const aiProvider = new AiProvider(testProvider)
        const result = await aiProvider.completions({
          assistant: codeReviewerAssistant,
          messages: `请审查这段代码并指出任何问题:\n${codeSnippet}`,
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-code-review'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`审查结果: ${response.slice(0, 200)}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(0)
        console.log('✓ 代码审查完成')
      } catch (error: any) {
        console.error(`代码审查失败: ${error.message}`)
        throw error
      }
    },
    AI_TIMEOUT
  )
})

// 无 API Key 时显示配置说明
describe.runIf(!hasApiKey)('API Key 配置说明', () => {
  it('显示如何配置 API Key', () => {
    console.log('\n')
    console.log('='.repeat(60))
    console.log('  真实 AI 调用测试需要配置 API Key')
    console.log('='.repeat(60))
    console.log('\n方法 1: 命令行环境变量')
    console.log('  OPENAI_API_KEY=sk-xxx yarn test:renderer --run ...')
    console.log('\n方法 2: 创建 .env.test 文件')
    console.log('  VITE_OPENAI_API_KEY=sk-xxx')
    console.log('  VITE_OPENAI_API_HOST=https://api.openai.com')
    console.log('\n方法 3: 使用兼容 OpenAI 的其他 API')
    console.log('  OPENAI_API_HOST=https://your-proxy.com')
    console.log('='.repeat(60))

    expect(true).toBe(true)
  })
})
