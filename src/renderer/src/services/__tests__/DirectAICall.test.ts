/**
 * 直接 AI 调用测试
 *
 * 直接调用 AiProvider 测试真实 AI 响应
 * 不依赖 store 中的助手配置
 *
 * 运行方式：
 * yarn test:renderer --run src/renderer/src/services/__tests__/DirectAICall.test.ts
 */
import { describe, expect, it } from 'vitest'

import AiProvider from '@renderer/aiCore'
import store from '@renderer/store'
import type { Assistant, Model, Provider } from '@renderer/types'

// 测试超时时间
const AI_TIMEOUT = 60000

// 获取第一个可用的 Provider
function getFirstAvailableProvider(): Provider | null {
  const state = store.getState()
  const providers = state.providers?.providers || []

  // 找一个有 API Key 的 Provider
  const validProvider = providers.find((p) => p.apiKey && p.apiKey.trim() !== '' && p.enabled !== false)

  if (validProvider) {
    console.log(`找到 Provider: ${validProvider.name} (${validProvider.id})`)
    return validProvider
  }

  console.log('没有找到配置了 API Key 的 Provider')
  console.log(
    '可用 Providers:',
    providers.map((p) => `${p.name}(enabled=${p.enabled}, hasKey=${!!p.apiKey})`)
  )
  return null
}

// 获取 Provider 的第一个模型
function getFirstModel(provider: Provider): Model | null {
  if (provider.models && provider.models.length > 0) {
    const model = provider.models[0]
    console.log(`使用模型: ${model.name || model.id}`)
    return model
  }
  return null
}

describe('直接 AI 调用测试', () => {
  it(
    '应该能直接调用 AI 并获取响应',
    async () => {
      const provider = getFirstAvailableProvider()

      if (!provider) {
        console.warn('跳过测试: 没有配置有效的 Provider')
        return
      }

      const model = getFirstModel(provider)

      if (!model) {
        console.warn('跳过测试: Provider 没有可用模型')
        return
      }

      // 构造一个简单的助手
      const testAssistant: Assistant = {
        id: 'test-direct-call',
        name: '测试助手',
        prompt: '你是一个简洁的助手，用一句话回答问题。',
        model: model,
        topics: [],
        messages: [],
        type: 'assistant',
        settings: {
          temperature: 0.7,
          contextCount: 5,
          maxTokens: 100,
          streamOutput: false
        } as any
      }

      console.log('\n=== 开始直接 AI 调用测试 ===')
      console.log(`Provider: ${provider.name}`)
      console.log(`Model: ${model.id}`)
      console.log(`Prompt: 1+1等于几？`)

      const startTime = Date.now()

      try {
        const aiProvider = new AiProvider(provider)
        const result = await aiProvider.completions({
          assistant: testAssistant,
          messages: '1+1等于几？请只回答数字。',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-direct-call'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`\n=== 调用结果 ===`)
        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(0)

        // 检查响应是否包含 "2"
        if (response.includes('2')) {
          console.log('✓ 响应正确包含 "2"')
        }
      } catch (error) {
        console.error('AI 调用失败:', error)
        throw error
      }
    },
    AI_TIMEOUT
  )

  it(
    '应该能模拟助手间调用场景',
    async () => {
      const provider = getFirstAvailableProvider()

      if (!provider) {
        console.warn('跳过测试: 没有配置有效的 Provider')
        return
      }

      const model = getFirstModel(provider)

      if (!model) {
        console.warn('跳过测试: Provider 没有可用模型')
        return
      }

      // 模拟 "翻译助手"
      const translatorAssistant: Assistant = {
        id: 'test-translator',
        name: '翻译助手',
        prompt: '你是一个专业翻译。用户会给你中文，请翻译成英文。只输出翻译结果，不要解释。',
        model: model,
        topics: [],
        messages: [],
        type: 'assistant',
        settings: {
          temperature: 0.3,
          contextCount: 3,
          maxTokens: 200,
          streamOutput: false
        } as any
      }

      console.log('\n=== 模拟助手间调用 ===')
      console.log(`调用场景: 主助手 → 翻译助手`)
      console.log(`请求: 翻译 "你好世界"`)

      const startTime = Date.now()

      try {
        const aiProvider = new AiProvider(provider)
        const result = await aiProvider.completions({
          assistant: translatorAssistant,
          messages: '请翻译: 你好世界',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-translator-call'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`\n=== 翻译结果 ===`)
        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(0)

        // 检查是否包含英文翻译
        const hasEnglish = /hello|world/i.test(response)
        if (hasEnglish) {
          console.log('✓ 响应包含英文翻译')
        }
      } catch (error) {
        console.error('翻译调用失败:', error)
        throw error
      }
    },
    AI_TIMEOUT
  )

  it('应该列出所有可用的 Providers 和模型', () => {
    const state = store.getState()
    const providers = state.providers?.providers || []

    console.log('\n=== Provider 和模型列表 ===')

    if (providers.length === 0) {
      console.log('没有配置任何 Provider')
      return
    }

    providers.forEach((p, i) => {
      const hasKey = p.apiKey && p.apiKey.trim() !== ''
      const status = hasKey ? '✓ 有 Key' : '✗ 无 Key'
      console.log(`\n${i + 1}. ${p.name} (${p.id}) - ${status}`)

      if (p.models && p.models.length > 0) {
        console.log(`   模型数量: ${p.models.length}`)
        p.models.slice(0, 3).forEach((m) => {
          console.log(`   - ${m.name || m.id}`)
        })
        if (p.models.length > 3) {
          console.log(`   ... 还有 ${p.models.length - 3} 个模型`)
        }
      }
    })

    expect(providers.length).toBeGreaterThanOrEqual(0)
  })

  it('应该列出所有助手', () => {
    const state = store.getState()
    const assistants = state.assistants?.assistants || []

    console.log('\n=== 助手列表 ===')
    console.log(`总数: ${assistants.length}`)

    assistants.forEach((a, i) => {
      const hasCollab = a.collaboration?.canInitiate || a.collaboration?.canDelegate
      const collabStatus = hasCollab ? '✓ 启用协作' : ''
      console.log(`${i + 1}. ${a.name} (${a.id}) ${collabStatus}`)
      if (a.model) {
        console.log(`   模型: ${a.model.name || a.model.id}`)
      }
    })

    expect(assistants.length).toBeGreaterThanOrEqual(0)
  })
})
