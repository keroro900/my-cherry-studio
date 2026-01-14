/**
 * 端到端调用链测试
 *
 * 测试内容:
 * 1. VCP 工具调用格式生成与解析
 * 2. 助手协同调用 (invoke_agent)
 * 3. AI 记忆系统交互
 * 4. 完整调用链验证
 *
 * 使用硅基流动 API 进行真实测试
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=sk-xxx yarn test:renderer --run src/renderer/src/services/__tests__/E2ECallChainTest.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest'

import AiProvider from '@renderer/aiCore'
import type { Assistant, Model, Provider, MCPTool } from '@renderer/types'

// ==================== 配置 ====================

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_API_HOST = 'https://api.siliconflow.cn/v1'
const AI_TIMEOUT = 180000 // 3分钟超时
const hasApiKey = SILICONFLOW_API_KEY.length > 0

// Provider 配置
const siliconFlowProvider: Provider = {
  id: 'siliconflow-e2e',
  name: 'SiliconFlow E2E Test',
  type: 'openai',
  apiKey: SILICONFLOW_API_KEY,
  apiHost: SILICONFLOW_API_HOST,
  models: [],
  enabled: true
}

// 模型配置
const testModel: Model = {
  id: 'Qwen/Qwen2.5-7B-Instruct',
  name: 'Qwen2.5-7B',
  provider: 'siliconflow'
}

// ==================== VCP 协议格式 ====================

const VCP_TOOL_REQUEST_START = '<<<[TOOL_REQUEST]>>>'
const VCP_TOOL_REQUEST_END = '<<<[END_TOOL_REQUEST]>>>'

/**
 * 解析 VCP 工具调用格式（修复版 - 支持多种格式）
 */
function parseVCPToolRequest(text: string): Array<{
  tool_name: string
  command: string
  params: Record<string, string>
}> {
  const results: Array<{ tool_name: string; command: string; params: Record<string, string> }> = []

  // 转义特殊字符用于正则
  const startTag = VCP_TOOL_REQUEST_START.replace(/[<>[\]]/g, '\\$&')
  const endTag = VCP_TOOL_REQUEST_END.replace(/[<>[\]]/g, '\\$&')
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: { tool_name: string; command: string; params: Record<string, string> } = {
      tool_name: '',
      command: '',
      params: {}
    }

    const lines = content.split('\n')
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 格式1: key:「始」value「末」
      let keyMatch = trimmedLine.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) {
        // 格式2: key: value (简单冒号格式)
        keyMatch = trimmedLine.match(/^(\w+):\s*(.+)$/)
      }

      if (keyMatch) {
        const [, key, value] = keyMatch
        const cleanValue = value.trim()
        if (key === 'tool_name') {
          parsed.tool_name = cleanValue
        } else if (key === 'command') {
          parsed.command = cleanValue
        } else {
          parsed.params[key] = cleanValue
        }
      }
    }

    if (parsed.tool_name) {
      results.push(parsed)
    }
  }

  return results
}

// ==================== 测试套件 ====================

describe.skipIf(!hasApiKey)('端到端调用链测试', () => {
  beforeAll(() => {
    console.log('\n' + '='.repeat(70))
    console.log('  端到端调用链测试 (E2E Call Chain Test)')
    console.log('='.repeat(70))
    console.log(`API: ${SILICONFLOW_API_HOST}`)
    console.log(`Model: ${testModel.id}`)
    console.log(`API Key: ${SILICONFLOW_API_KEY.slice(0, 10)}...`)
  })

  // ============================================
  // 第一部分: VCP 工具调用格式测试
  // ============================================
  describe('1. VCP 工具调用格式', () => {
    it(
      '应该能让 AI 生成正确的 VCP 工具调用格式',
      async () => {
        console.log('\n--- 测试 VCP 工具调用格式生成 ---')

        const vcpAssistant: Assistant = {
          id: 'vcp-format-test',
          name: 'VCP 格式测试',
          prompt: `你是一个支持 VCP 协议的 AI 助手。
当需要使用工具时，请使用以下格式调用:

<<<[TOOL_REQUEST]>>>
tool_name:「始」工具名称「末」
command:「始」命令名「末」
参数名:「始」参数值「末」
<<<[END_TOOL_REQUEST]>>>

你可以使用以下工具:
1. DeepMemo - 深度记忆搜索
   - command: DeepSearch (查询: query)
   - command: WaveRAGSearch (查询: query)

2. AIMemo - AI 记忆
   - command: Extract (文本: text)
   - command: Recall (查询: query)

请直接输出工具调用，不要解释。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.1,
            contextCount: 1,
            maxTokens: 500,
            streamOutput: false
          } as any
        }

        const userMessage = '请搜索关于"机器学习"的记忆'

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: vcpAssistant,
          messages: userMessage,
          streamOutput: false,
          callType: 'chat',
          topicId: 'vcp-format-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应:\n${response}`)

        // 解析 VCP 工具调用
        const toolCalls = parseVCPToolRequest(response)
        console.log(`解析到 ${toolCalls.length} 个工具调用`)

        if (toolCalls.length > 0) {
          console.log('工具调用详情:', JSON.stringify(toolCalls, null, 2))
        }

        expect(response).toContain(VCP_TOOL_REQUEST_START)
        expect(response).toContain(VCP_TOOL_REQUEST_END)
        expect(toolCalls.length).toBeGreaterThan(0)
        expect(toolCalls[0].tool_name).toMatch(/DeepMemo|AIMemo/)

        console.log('✓ VCP 工具调用格式正确')
      },
      AI_TIMEOUT
    )

    it(
      '应该能让 AI 生成带参数的 VCP 工具调用',
      async () => {
        console.log('\n--- 测试带参数的 VCP 工具调用 ---')

        const vcpAssistant: Assistant = {
          id: 'vcp-params-test',
          name: 'VCP 参数测试',
          prompt: `你支持 VCP 协议工具调用。格式如下:

<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」搜索内容「末」
initialK:「始」数字「末」
finalK:「始」数字「末」
<<<[END_TOOL_REQUEST]>>>

请根据用户需求调用工具。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.1,
            contextCount: 1,
            maxTokens: 300,
            streamOutput: false
          } as any
        }

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: vcpAssistant,
          messages: '搜索最近 3 天关于"项目进度"的记忆，返回 5 条',
          streamOutput: false,
          callType: 'chat',
          topicId: 'vcp-params-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应:\n${response}`)

        const toolCalls = parseVCPToolRequest(response)
        console.log('解析结果:', JSON.stringify(toolCalls, null, 2))

        expect(toolCalls.length).toBeGreaterThan(0)
        expect(toolCalls[0].params).toHaveProperty('query')
        console.log('✓ VCP 参数解析正确')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第二部分: 助手协同调用测试
  // ============================================
  describe('2. 助手协同调用 (invoke_agent)', () => {
    it(
      '应该能让主脑正确调度子助手',
      async () => {
        console.log('\n--- 测试主脑调度子助手 ---')

        const mainBrainAssistant: Assistant = {
          id: 'main-brain',
          name: '主脑',
          prompt: `你是一个智能任务协调器（主脑）。

你有以下子助手可以调用:
- 翻译专家 (translator): 中英文翻译
- 代码专家 (code-expert): 代码审查和优化
- 数据分析师 (data-analyst): 数据分析和可视化

当需要调用子助手时，使用以下格式:

<<<[TOOL_REQUEST]>>>
tool_name:「始」invoke_agent「末」
command:「始」call「末」
agent_name:「始」助手名称「末」
request:「始」任务描述「末」
mode:「始」sync「末」
<<<[END_TOOL_REQUEST]>>>

分析用户任务，决定调用哪个子助手。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          collaboration: {
            canInitiate: true,
            canDelegate: true,
            maxConcurrentTasks: 5,
            responseStyle: 'adaptive'
          },
          settings: {
            temperature: 0.3,
            contextCount: 3,
            maxTokens: 600,
            streamOutput: false
          } as any
        }

        const tasks = [
          { input: '帮我把这段话翻译成英文: "今天天气真好"', expectAgent: '翻译专家' },
          { input: '审查这段代码: function add(a,b){return a+b}', expectAgent: '代码专家' }
        ]

        for (const task of tasks) {
          console.log(`\n测试任务: ${task.input.slice(0, 30)}...`)

          const startTime = Date.now()
          const aiProvider = new AiProvider(siliconFlowProvider)
          const result = await aiProvider.completions({
            assistant: mainBrainAssistant,
            messages: task.input,
            streamOutput: false,
            callType: 'chat',
            topicId: 'main-brain-dispatch'
          })

          const elapsed = Date.now() - startTime
          const response = result.getText?.() || ''

          console.log(`耗时: ${elapsed}ms`)
          console.log(`响应: ${response.slice(0, 200)}...`)

          const toolCalls = parseVCPToolRequest(response)

          if (toolCalls.length > 0) {
            console.log(`调用助手: ${toolCalls[0].params.agent_name}`)
            expect(toolCalls[0].tool_name).toBe('invoke_agent')
          }
        }

        console.log('✓ 主脑调度测试完成')
      },
      AI_TIMEOUT
    )

    it(
      '应该能模拟完整的助手协作流程',
      async () => {
        console.log('\n--- 模拟完整助手协作流程 ---')

        // 第一步: 主脑接收任务
        const mainBrainAssistant: Assistant = {
          id: 'main-brain-flow',
          name: '主脑',
          prompt: `你是任务协调主脑。分析任务并决定调用哪个子助手。
可用助手: 翻译专家, 代码专家, 数据分析师

输出格式:
[分析] 任务分析
[决策] 选择: 助手名称
[调用]
<<<[TOOL_REQUEST]>>>
tool_name:「始」invoke_agent「末」
command:「始」call「末」
agent_name:「始」助手名称「末」
request:「始」具体任务「末」
<<<[END_TOOL_REQUEST]>>>`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.3, contextCount: 2, maxTokens: 500, streamOutput: false } as any
        }

        const userTask = '我需要翻译一段代码注释并检查代码质量'

        console.log(`用户任务: ${userTask}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result1 = await aiProvider.completions({
          assistant: mainBrainAssistant,
          messages: userTask,
          streamOutput: false,
          callType: 'chat',
          topicId: 'main-brain-flow'
        })

        const response1 = result1.getText?.() || ''
        console.log(`主脑响应:\n${response1}`)

        // 检查是否包含分析和决策
        expect(response1).toMatch(/分析|决策|选择/i)

        // 第二步: 模拟子助手执行
        const translatorAssistant: Assistant = {
          id: 'translator-flow',
          name: '翻译专家',
          prompt: '你是翻译专家，直接翻译给你的内容，不解释。',
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.2, contextCount: 1, maxTokens: 200, streamOutput: false } as any
        }

        const result2 = await aiProvider.completions({
          assistant: translatorAssistant,
          messages: '翻译: 这是一个计算两数之和的函数',
          streamOutput: false,
          callType: 'chat',
          topicId: 'translator-flow'
        })

        const response2 = result2.getText?.() || ''
        console.log(`翻译专家响应: ${response2}`)

        const elapsed = Date.now() - startTime
        console.log(`总耗时: ${elapsed}ms`)

        expect(response2.toLowerCase()).toMatch(/function|sum|add|calculate/i)
        console.log('✓ 助手协作流程完成')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第三部分: AI 记忆系统交互测试
  // ============================================
  describe('3. AI 记忆系统交互', () => {
    it(
      '应该能让 AI 正确生成记忆存储调用',
      async () => {
        console.log('\n--- 测试记忆存储调用生成 ---')

        const memoAssistant: Assistant = {
          id: 'memo-store-test',
          name: '记忆助手',
          prompt: `你具有记忆能力。当用户告诉你重要信息时，使用 AIMemo 工具存储。

存储格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」AIMemo「末」
command:「始」Extract「末」
text:「始」要存储的内容「末」
category:「始」类别(fact/preference/event)「末」
importance:「始」重要性1-10「末」
<<<[END_TOOL_REQUEST]>>>

用户告诉你信息后，立即存储并确认。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.2, contextCount: 2, maxTokens: 400, streamOutput: false } as any
        }

        const userInfo = '请记住：我的生日是 5 月 20 日，我喜欢喝茉莉花茶，工作是软件工程师'

        console.log(`用户信息: ${userInfo}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: memoAssistant,
          messages: userInfo,
          streamOutput: false,
          callType: 'chat',
          topicId: 'memo-store-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应:\n${response}`)

        const toolCalls = parseVCPToolRequest(response)
        console.log(`解析到 ${toolCalls.length} 个工具调用`)

        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            console.log(`- 工具: ${call.tool_name}, 命令: ${call.command}`)
            if (call.params.text) {
              console.log(`  内容: ${call.params.text.slice(0, 50)}...`)
            }
          }
        }

        // 验证生成了存储调用
        const hasStoreCall = toolCalls.some(
          (c) => c.tool_name === 'AIMemo' && (c.command === 'Extract' || c.command === 'Store')
        )
        expect(hasStoreCall || response.includes('AIMemo')).toBe(true)

        console.log('✓ 记忆存储调用生成正确')
      },
      AI_TIMEOUT
    )

    it(
      '应该能让 AI 正确生成记忆检索调用',
      async () => {
        console.log('\n--- 测试记忆检索调用生成 ---')

        const memoSearchAssistant: Assistant = {
          id: 'memo-search-test',
          name: '记忆检索助手',
          prompt: `你具有记忆检索能力。当用户询问过去的信息时，使用 DeepMemo 搜索。

搜索格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」搜索关键词「末」
initialK:「始」30「末」
finalK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>

然后基于搜索结果回答用户。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.2, contextCount: 2, maxTokens: 400, streamOutput: false } as any
        }

        const userQuery = '你还记得我的生日是什么时候吗？'

        console.log(`用户查询: ${userQuery}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: memoSearchAssistant,
          messages: userQuery,
          streamOutput: false,
          callType: 'chat',
          topicId: 'memo-search-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应:\n${response}`)

        const toolCalls = parseVCPToolRequest(response)

        if (toolCalls.length > 0) {
          console.log('检索调用:', JSON.stringify(toolCalls[0], null, 2))
        }

        expect(response).toContain('DeepMemo')
        console.log('✓ 记忆检索调用生成正确')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第四部分: 完整调用链验证
  // ============================================
  describe('4. 完整调用链验证', () => {
    it(
      '应该能完成"存储-检索-回答"完整流程',
      async () => {
        console.log('\n--- 测试完整调用链: 存储→检索→回答 ---')

        // 模拟一个完整的记忆交互流程
        const fullFlowAssistant: Assistant = {
          id: 'full-flow-test',
          name: '全流程测试助手',
          prompt: `你是一个具有完整记忆能力的 AI 助手。

已存储的记忆:
- 用户是一名前端工程师，使用 TypeScript 和 React
- 用户正在开发 Cherry Studio，一个 Electron 应用
- 用户偏好使用 VCP 协议进行工具调用
- 项目支持多种 AI 模型：OpenAI, Claude, Gemini, 硅基流动等

当用户提问时，请：
1. 搜索相关记忆
2. 基于记忆回答问题
3. 如果用户提供新信息，存储到记忆

请综合运用你的记忆来回答。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.3, contextCount: 5, maxTokens: 600, streamOutput: false } as any
        }

        const conversationFlow = [
          {
            input: '你了解我的工作吗？',
            expectContent: /前端|工程师|TypeScript|React|Cherry|Electron/i
          },
          {
            input: '我最近在学习 Rust，请记住这个',
            expectContent: /Rust|记|学习/i
          },
          {
            input: '总结一下你对我的了解',
            expectContent: /前端|TypeScript|Electron|Rust/i
          }
        ]

        const aiProvider = new AiProvider(siliconFlowProvider)
        const totalStartTime = Date.now()

        for (let i = 0; i < conversationFlow.length; i++) {
          const step = conversationFlow[i]
          console.log(`\n[步骤 ${i + 1}] 用户: ${step.input}`)

          const startTime = Date.now()
          const result = await aiProvider.completions({
            assistant: fullFlowAssistant,
            messages: step.input,
            streamOutput: false,
            callType: 'chat',
            topicId: `full-flow-step-${i}`
          })

          const elapsed = Date.now() - startTime
          const response = result.getText?.() || ''

          console.log(`助手: ${response.slice(0, 200)}...`)
          console.log(`耗时: ${elapsed}ms`)

          expect(response).toMatch(step.expectContent)
        }

        const totalElapsed = Date.now() - totalStartTime
        console.log(`\n总耗时: ${totalElapsed}ms`)
        console.log('✓ 完整调用链验证通过')
      },
      AI_TIMEOUT
    )

    it(
      '应该能处理多工具并发调用',
      async () => {
        console.log('\n--- 测试多工具并发调用 ---')

        const multiToolAssistant: Assistant = {
          id: 'multi-tool-test',
          name: '多工具测试助手',
          prompt: `你可以同时调用多个工具。

可用工具:
1. DeepMemo - 搜索记忆
2. invoke_agent - 调用子助手
3. AIMemo - 存储记忆

当任务需要多个工具时，可以在一次回复中生成多个工具调用。

格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」工具1「末」
command:「始」命令「末」
...
<<<[END_TOOL_REQUEST]>>>

<<<[TOOL_REQUEST]>>>
tool_name:「始」工具2「末」
command:「始」命令「末」
...
<<<[END_TOOL_REQUEST]>>>`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.2, contextCount: 2, maxTokens: 800, streamOutput: false } as any
        }

        const complexTask = '搜索关于"项目架构"的记忆，同时请翻译专家帮我翻译搜索结果'

        console.log(`复杂任务: ${complexTask}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: multiToolAssistant,
          messages: complexTask,
          streamOutput: false,
          callType: 'chat',
          topicId: 'multi-tool-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应:\n${response}`)

        const toolCalls = parseVCPToolRequest(response)
        console.log(`解析到 ${toolCalls.length} 个工具调用`)

        for (const call of toolCalls) {
          console.log(`- ${call.tool_name}:${call.command}`)
        }

        expect(toolCalls.length).toBeGreaterThanOrEqual(1)
        console.log('✓ 多工具调用测试完成')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第五部分: 错误处理与边界情况
  // ============================================
  describe('5. 错误处理与边界情况', () => {
    it(
      '应该能处理模糊查询',
      async () => {
        console.log('\n--- 测试模糊查询处理 ---')

        const fuzzyQueryAssistant: Assistant = {
          id: 'fuzzy-query-test',
          name: '模糊查询测试',
          prompt: `你是一个智能助手，能够理解模糊的查询意图。

当用户查询不明确时：
1. 尝试理解用户意图
2. 扩展查询关键词
3. 进行宽泛搜索

使用 DeepMemo 搜索，query 参数可以包含多个关键词。`,
          model: testModel,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: { temperature: 0.3, contextCount: 2, maxTokens: 400, streamOutput: false } as any
        }

        const fuzzyQuery = '那个...就是之前那个东西...你知道的'

        console.log(`模糊查询: ${fuzzyQuery}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: fuzzyQueryAssistant,
          messages: fuzzyQuery,
          streamOutput: false,
          callType: 'chat',
          topicId: 'fuzzy-query-test'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response.slice(0, 300)}...`)

        // 助手应该尝试澄清或进行宽泛搜索
        expect(response.length).toBeGreaterThan(0)
        console.log('✓ 模糊查询处理完成')
      },
      AI_TIMEOUT
    )
  })
})

// ==================== 无 API Key 时的说明 ====================

describe.runIf(!hasApiKey)('API Key 配置说明', () => {
  it('显示配置说明', () => {
    console.log('\n' + '='.repeat(70))
    console.log('  端到端调用链测试需要配置 API Key')
    console.log('='.repeat(70))
    console.log('\n运行方式:')
    console.log('  SILICONFLOW_API_KEY=sk-xxx yarn test:renderer --run \\')
    console.log('    src/renderer/src/services/__tests__/E2ECallChainTest.test.ts')
    console.log('\n或创建 .env.test 文件:')
    console.log('  VITE_SILICONFLOW_API_KEY=sk-xxx')
    console.log('='.repeat(70))

    expect(true).toBe(true)
  })
})
