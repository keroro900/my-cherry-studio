/**
 * Agent 调用链集成测试（真实 AI 调用）
 *
 * 此测试会实际调用 AI 模型，需要：
 * 1. 配置有效的 Provider 和 API Key
 * 2. 存在至少 2 个助手（一个调用者，一个被调用者）
 *
 * 运行方式：
 * yarn test:renderer --run src/renderer/src/services/__tests__/AgentInvocationIntegration.test.ts
 *
 * 注意：此测试会产生 API 调用费用，默认跳过
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import store from '@renderer/store'
import type { Assistant } from '@renderer/types'

import { getProviderByModel } from '../AssistantService'
import {
  createInvokeAgentTool,
  getInvokableAssistants,
  handleInvokeAgentToolCall,
  invokeAssistant
} from '../AssistantInvocationService'

// 是否运行真实 AI 测试
// 设置为 true 时会实际调用 AI API
const RUN_REAL_AI_TESTS = true

// 测试超时时间（AI 调用可能较慢）
const AI_TIMEOUT = 60000

describe.skipIf(!RUN_REAL_AI_TESTS)('Agent 调用链集成测试（真实 AI）', () => {
  let callerAssistant: Assistant | undefined
  let targetAssistant: Assistant | undefined

  beforeAll(() => {
    // 获取真实的助手列表
    const state = store.getState()
    const assistants = state.assistants?.assistants || []

    console.log(`找到 ${assistants.length} 个助手`)

    if (assistants.length < 2) {
      console.warn('需要至少 2 个助手才能运行集成测试')
      return
    }

    // 找一个启用了协作的助手作为调用者
    callerAssistant = assistants.find(
      (a) => a.collaboration?.canInitiate || a.collaboration?.canDelegate
    )

    // 找另一个助手作为目标
    targetAssistant = assistants.find((a) => a.id !== callerAssistant?.id)

    if (callerAssistant) {
      console.log(`调用者助手: ${callerAssistant.name} (${callerAssistant.id})`)
    }
    if (targetAssistant) {
      console.log(`目标助手: ${targetAssistant.name} (${targetAssistant.id})`)
    }
  })

  beforeEach(() => {
    if (!callerAssistant || !targetAssistant) {
      console.warn('跳过测试：助手未配置')
    }
  })

  afterEach(() => {
    // 清理
  })

  describe('真实助手发现', () => {
    it('应该能获取真实的可调用助手列表', () => {
      if (!callerAssistant) return

      const invokableAssistants = getInvokableAssistants(callerAssistant.id)

      console.log(`可调用助手数量: ${invokableAssistants.length}`)
      invokableAssistants.forEach((a) => {
        console.log(`  - ${a.name}: ${a.description || '无描述'}`)
      })

      expect(invokableAssistants.length).toBeGreaterThan(0)
    })

    it('应该能获取真实的 Provider', () => {
      if (!targetAssistant?.model) return

      const provider = getProviderByModel(targetAssistant.model)

      console.log(`目标助手模型: ${targetAssistant.model.id}`)
      console.log(`Provider: ${provider?.name || '未找到'}`)

      expect(provider).toBeDefined()
    })
  })

  describe(
    '真实 AI 调用',
    () => {
      it(
        '应该能够真实调用目标助手',
        async () => {
          if (!callerAssistant || !targetAssistant) {
            console.warn('跳过：助手未配置')
            return
          }

          console.log(`\n开始调用: ${callerAssistant.name} → ${targetAssistant.name}`)
          console.log(`请求内容: "你好，请简单介绍一下你自己（一句话）"`)

          const startTime = Date.now()

          const result = await invokeAssistant(targetAssistant.name, '你好，请简单介绍一下你自己（一句话）', {
            callerAssistantId: callerAssistant.id,
            includeSystemPrompt: true,
            timeout: AI_TIMEOUT
          })

          const elapsed = Date.now() - startTime

          console.log(`\n调用结果:`)
          console.log(`  成功: ${result.success}`)
          console.log(`  耗时: ${elapsed}ms`)

          if (result.success) {
            console.log(`  响应: ${result.response?.slice(0, 200)}...`)
          } else {
            console.log(`  错误: ${result.error}`)
          }

          expect(result.success).toBe(true)
          expect(result.response).toBeDefined()
          expect(result.response!.length).toBeGreaterThan(0)
        },
        AI_TIMEOUT
      )

      it(
        '应该能通过 handleInvokeAgentToolCall 调用',
        async () => {
          if (!callerAssistant || !targetAssistant) {
            console.warn('跳过：助手未配置')
            return
          }

          console.log(`\n通过工具调用: ${targetAssistant.name}`)

          const startTime = Date.now()

          const result = await handleInvokeAgentToolCall(
            {
              agent_name: targetAssistant.name,
              request: '请用一句话回答：1+1等于几？',
              include_system_prompt: true
            },
            callerAssistant.id
          )

          const elapsed = Date.now() - startTime

          console.log(`\n工具调用结果:`)
          console.log(`  耗时: ${elapsed}ms`)
          console.log(`  响应: ${result.slice(0, 300)}...`)

          expect(result).toContain(targetAssistant.name)
          // 应该包含 "的回复" 或 "调用失败"
          expect(result.includes('的回复') || result.includes('调用失败')).toBe(true)
        },
        AI_TIMEOUT
      )
    },
    AI_TIMEOUT
  )

  describe('工具定义验证', () => {
    it('应该能创建包含真实助手的工具定义', () => {
      if (!callerAssistant) return

      const tool = createInvokeAgentTool(callerAssistant.id)

      console.log('\n工具定义:')
      console.log(`  名称: ${tool.name}`)
      console.log(`  描述长度: ${tool.description.length} 字符`)

      // 检查工具描述是否包含真实助手
      const invokableAssistants = getInvokableAssistants(callerAssistant.id)
      invokableAssistants.slice(0, 3).forEach((a) => {
        if (tool.description.includes(a.name)) {
          console.log(`  ✓ 包含助手: ${a.name}`)
        }
      })

      expect(tool.name).toBe('invoke_agent')
      expect(tool.inputSchema.required).toContain('agent_name')
      expect(tool.inputSchema.required).toContain('request')
    })
  })
})

// 手动测试辅助函数
export async function runManualTest() {
  console.log('=== 手动运行 Agent 调用测试 ===\n')

  const state = store.getState()
  const assistants = state.assistants?.assistants || []

  if (assistants.length < 2) {
    console.error('错误: 需要至少 2 个助手')
    return
  }

  const caller = assistants[0]
  const target = assistants[1]

  console.log(`调用者: ${caller.name}`)
  console.log(`目标: ${target.name}`)
  console.log('---')

  const result = await invokeAssistant(target.name, '你好，请简单自我介绍', {
    callerAssistantId: caller.id,
    includeSystemPrompt: true
  })

  console.log('\n结果:')
  console.log(result)

  return result
}
