/**
 * 硅基流动 (SiliconFlow) 综合集成测试
 *
 * 测试内容:
 * 1. 基础 AI 调用
 * 2. 助手协同调用 (invoke_agent)
 * 3. VCP 内置服务调用 (DeepMemo)
 * 4. RAG/记忆搜索功能
 *
 * 配置环境变量后运行:
 * SILICONFLOW_API_KEY=sk-xxx yarn test:renderer --run src/renderer/src/services/__tests__/SiliconFlowIntegration.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest'

import AiProvider from '@renderer/aiCore'
import type { Assistant, Model, Provider } from '@renderer/types'

// 硅基流动配置
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_API_HOST = 'https://api.siliconflow.cn/v1'

// 测试超时
const AI_TIMEOUT = 120000

// 检查是否配置了 API Key
const hasApiKey = SILICONFLOW_API_KEY.length > 0

// 硅基流动 Provider 配置
const siliconFlowProvider: Provider = {
  id: 'siliconflow-test',
  name: 'SiliconFlow Test',
  type: 'openai', // 兼容 OpenAI API 格式
  apiKey: SILICONFLOW_API_KEY,
  apiHost: SILICONFLOW_API_HOST,
  models: [],
  enabled: true
}

// 可用模型列表
const models = {
  qwen: { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B', provider: 'siliconflow' } as Model,
  qwen3: { id: 'Qwen/Qwen3-8B', name: 'Qwen3-8B', provider: 'siliconflow' } as Model,
  deepseekV3: { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', provider: 'siliconflow' } as Model,
  glm: { id: 'THUDM/GLM-4-9B-0414', name: 'GLM-4-9B', provider: 'siliconflow' } as Model
}

describe.skipIf(!hasApiKey)('硅基流动综合集成测试', () => {
  beforeAll(() => {
    console.log('\n' + '='.repeat(60))
    console.log('  硅基流动 (SiliconFlow) 综合集成测试')
    console.log('='.repeat(60))
    console.log(`API Host: ${SILICONFLOW_API_HOST}`)
    console.log(`API Key: ${SILICONFLOW_API_KEY.slice(0, 10)}...`)
  })

  // ============================================
  // 第一部分: 基础 AI 调用测试
  // ============================================
  describe('基础 AI 调用', () => {
    it(
      '应该能调用 Qwen 模型',
      async () => {
        console.log('\n--- 测试 Qwen2.5-7B-Instruct ---')

        const assistant: Assistant = {
          id: 'test-qwen',
          name: '测试助手',
          prompt: '你是一个简洁的助手。用一个词或数字回答问题。',
          model: models.qwen,
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
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant,
          messages: '1+1=?',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-qwen'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`模型: ${models.qwen.id}`)
        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(0)
      },
      AI_TIMEOUT
    )

    it(
      '应该能调用 DeepSeek-V3 模型',
      async () => {
        console.log('\n--- 测试 DeepSeek-V3 ---')

        const assistant: Assistant = {
          id: 'test-deepseek',
          name: '测试助手',
          prompt: '你是一个简洁的助手。直接回答，不要解释。',
          model: models.deepseekV3,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0,
            contextCount: 1,
            maxTokens: 100,
            streamOutput: false
          } as any
        }

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant,
          messages: '中国的首都是哪里？',
          streamOutput: false,
          callType: 'chat',
          topicId: 'test-deepseek'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`模型: ${models.deepseekV3.id}`)
        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response).toMatch(/北京/i)
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第二部分: 助手协同调用测试
  // ============================================
  describe('助手协同调用 (invoke_agent)', () => {
    it(
      '模拟翻译助手被调用',
      async () => {
        console.log('\n--- 模拟 invoke_agent: 翻译助手 ---')

        // 模拟一个翻译助手
        const translatorAssistant: Assistant = {
          id: 'translator',
          name: '翻译专家',
          prompt: `你是一个专业的翻译助手。
当收到翻译请求时，直接输出翻译结果，不需要解释。
中文翻译成英文，英文翻译成中文。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          collaboration: {
            canInitiate: false,
            canDelegate: true,
            maxConcurrentTasks: 3,
            responseStyle: 'concise'
          },
          settings: {
            temperature: 0.3,
            contextCount: 1,
            maxTokens: 200,
            streamOutput: false
          } as any
        }

        // 模拟 invoke_agent 调用
        const invokeRequest = {
          agent_name: '翻译专家',
          request: '请翻译: 人工智能正在改变世界'
        }

        console.log(`调用助手: ${invokeRequest.agent_name}`)
        console.log(`请求内容: ${invokeRequest.request}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: translatorAssistant,
          messages: invokeRequest.request,
          streamOutput: false,
          callType: 'chat',
          topicId: 'invoke-translator'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`翻译结果: ${response}`)

        expect(response).toBeDefined()
        expect(response.toLowerCase()).toMatch(/artificial|intelligence|ai|world|changing/i)
        console.log('✓ 翻译助手调用成功')
      },
      AI_TIMEOUT
    )

    it(
      '模拟代码专家被调用',
      async () => {
        console.log('\n--- 模拟 invoke_agent: 代码专家 ---')

        const codeExpertAssistant: Assistant = {
          id: 'code-expert',
          name: '代码专家',
          prompt: `你是一个代码审查专家。
分析代码时，简洁指出主要问题，不超过3点。
格式: 问题1: xxx`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          collaboration: {
            canInitiate: false,
            canDelegate: true,
            maxConcurrentTasks: 3,
            responseStyle: 'detailed'
          },
          settings: {
            temperature: 0.2,
            contextCount: 1,
            maxTokens: 300,
            streamOutput: false
          } as any
        }

        const codeSnippet = `
function fetchData(url) {
  var data = null;
  fetch(url).then(r => r.json()).then(d => { data = d; });
  return data;
}
`

        console.log(`调用助手: 代码专家`)
        console.log(`代码片段: ${codeSnippet.trim().slice(0, 50)}...`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: codeExpertAssistant,
          messages: `请审查这段代码:\n${codeSnippet}`,
          streamOutput: false,
          callType: 'chat',
          topicId: 'invoke-code-expert'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`审查结果: ${response.slice(0, 200)}...`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(20)
        console.log('✓ 代码专家调用成功')
      },
      AI_TIMEOUT
    )

    it(
      '模拟主脑助手协调多个子助手',
      async () => {
        console.log('\n--- 模拟主脑协调 (Main Brain Orchestration) ---')

        // 主脑助手：负责分析任务并决定调用哪个子助手
        const mainBrainAssistant: Assistant = {
          id: 'main-brain',
          name: '主脑',
          prompt: `你是一个智能任务协调器（主脑）。
你有以下子助手可以调用:
- 翻译专家: 负责中英文翻译
- 代码专家: 负责代码审查和分析
- 数据分析师: 负责数据处理和可视化建议

当用户提出任务时，你需要:
1. 分析任务类型
2. 决定需要调用哪个子助手
3. 输出格式: [INVOKE:助手名称] 任务描述

示例:
用户: 帮我翻译这段话
输出: [INVOKE:翻译专家] 请将以下内容翻译成英文...`,
          model: models.qwen,
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
            maxTokens: 500,
            streamOutput: false
          } as any
        }

        const userTask = '我有一段Python代码需要优化，同时代码里的注释需要翻译成英文'

        console.log(`用户任务: ${userTask}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: mainBrainAssistant,
          messages: userTask,
          streamOutput: false,
          callType: 'chat',
          topicId: 'main-brain-orchestration'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`主脑决策: ${response}`)

        expect(response).toBeDefined()
        // 应该识别出需要调用代码专家或翻译专家
        expect(response).toMatch(/代码|翻译|INVOKE|专家/i)
        console.log('✓ 主脑协调测试成功')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第三部分: VCP 内置服务调用模拟
  // ============================================
  describe('VCP 内置服务调用', () => {
    it(
      '模拟 DeepMemo 服务 - 记忆存储',
      async () => {
        console.log('\n--- 模拟 VCP: DeepMemo 记忆存储 ---')

        // 模拟 AI 使用 DeepMemo 工具存储记忆
        const memoAssistant: Assistant = {
          id: 'memo-assistant',
          name: '记忆助手',
          prompt: `你是一个具有长期记忆能力的助手。
当用户告诉你重要信息时，你会使用 deep_memo_write 工具来存储。
存储格式:
<<<[TOOL_REQUEST]>>>
{"tool": "deep_memo_write", "params": {"content": "记忆内容", "tags": ["标签1", "标签2"]}}
<<<[END_TOOL_REQUEST]>>>

回复时先确认已记录信息。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.3,
            contextCount: 3,
            maxTokens: 500,
            streamOutput: false
          } as any
        }

        const userMessage = '请记住：我的生日是12月25日，我喜欢喝咖啡'

        console.log(`用户消息: ${userMessage}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: memoAssistant,
          messages: userMessage,
          streamOutput: false,
          callType: 'chat',
          topicId: 'deep-memo-write'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        // 应该包含工具调用格式或确认记录
        const hasToolCall = response.includes('TOOL_REQUEST') || response.includes('deep_memo')
        const hasConfirmation = response.match(/记|已|好的|明白|知道/i)
        expect(hasToolCall || hasConfirmation).toBe(true)
        console.log('✓ DeepMemo 存储模拟成功')
      },
      AI_TIMEOUT
    )

    it(
      '模拟 DeepMemo 服务 - 记忆检索',
      async () => {
        console.log('\n--- 模拟 VCP: DeepMemo 记忆检索 ---')

        const memoSearchAssistant: Assistant = {
          id: 'memo-search-assistant',
          name: '记忆搜索助手',
          prompt: `你是一个具有记忆检索能力的助手。
当用户询问过去的信息时，你需要使用 deep_memo_search 工具来搜索记忆。
工具调用格式:
<<<[TOOL_REQUEST]>>>
{"tool": "deep_memo_search", "params": {"query": "搜索关键词", "limit": 5}}
<<<[END_TOOL_REQUEST]>>>

假设你找到了以下记忆:
- 用户生日是12月25日
- 用户喜欢喝咖啡

请基于这些记忆回答用户问题。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.3,
            contextCount: 3,
            maxTokens: 500,
            streamOutput: false
          } as any
        }

        const userQuery = '你还记得我的生日吗？'

        console.log(`用户查询: ${userQuery}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: memoSearchAssistant,
          messages: userQuery,
          streamOutput: false,
          callType: 'chat',
          topicId: 'deep-memo-search'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        // 应该提到生日或12月25日
        expect(response).toMatch(/12月25|生日|记得|是的/i)
        console.log('✓ DeepMemo 检索模拟成功')
      },
      AI_TIMEOUT
    )
  })

  // ============================================
  // 第四部分: RAG 和 AI Memo 功能测试
  // ============================================
  describe('RAG 和 AI Memo 功能', () => {
    it(
      '模拟 RAG 知识库检索增强',
      async () => {
        console.log('\n--- 模拟 RAG: 知识库检索增强 ---')

        // 模拟已检索到的知识库内容
        const retrievedContext = `
[知识库检索结果]
1. Cherry Studio 是一个桌面 AI 助手应用
2. 支持多种 AI 模型: OpenAI, Claude, Gemini, 硅基流动等
3. 提供工作流编辑器，支持可视化节点编程
4. 支持 MCP (Model Context Protocol) 协议
5. 内置 VCP (Virtual Context Protocol) 用于工具调用
`

        const ragAssistant: Assistant = {
          id: 'rag-assistant',
          name: 'RAG助手',
          prompt: `你是一个基于知识库的问答助手。
以下是从知识库中检索到的相关内容:
${retrievedContext}

请基于以上知识库内容回答用户问题。如果知识库中没有相关信息，请说明。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.2,
            contextCount: 1,
            maxTokens: 300,
            streamOutput: false
          } as any
        }

        const userQuestion = 'Cherry Studio 支持哪些 AI 模型？'

        console.log(`用户问题: ${userQuestion}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: ragAssistant,
          messages: userQuestion,
          streamOutput: false,
          callType: 'chat',
          topicId: 'rag-qa'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        // 应该基于检索内容回答
        expect(response).toMatch(/OpenAI|Claude|Gemini|硅基/i)
        console.log('✓ RAG 知识库检索成功')
      },
      AI_TIMEOUT
    )

    it(
      '模拟 AI Memo 智能记忆提取',
      async () => {
        console.log('\n--- 模拟 AI Memo: 智能记忆提取 ---')

        // 模拟一段对话历史
        const conversationHistory = `
[历史对话摘要]
- 用户是一名软件工程师，专注于前端开发
- 用户目前在做一个 Electron 应用项目
- 用户偏好使用 TypeScript 和 React
- 用户的工作时间通常是早上9点到晚上6点
- 用户周末喜欢骑自行车
`

        const memoExtractAssistant: Assistant = {
          id: 'memo-extract-assistant',
          name: '记忆提取助手',
          prompt: `你是一个智能记忆管理助手。
你能够从对话历史中提取关键信息并形成用户画像。

已知用户信息:
${conversationHistory}

当用户问问题时，请结合已知信息给出个性化回答。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.3,
            contextCount: 3,
            maxTokens: 400,
            streamOutput: false
          } as any
        }

        const userQuestion = '你了解我吗？能总结一下你对我的了解吗？'

        console.log(`用户问题: ${userQuestion}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: memoExtractAssistant,
          messages: userQuestion,
          streamOutput: false,
          callType: 'chat',
          topicId: 'ai-memo-extract'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        // 应该提取出用户画像信息
        expect(response).toMatch(/软件|工程师|前端|Electron|TypeScript|React|周末|自行车/i)
        console.log('✓ AI Memo 记忆提取成功')
      },
      AI_TIMEOUT
    )

    it(
      '模拟统一记忆搜索 (IntegratedMemoryCoordinator)',
      async () => {
        console.log('\n--- 模拟 IntegratedMemoryCoordinator ---')

        // 模拟多源记忆整合
        const integratedMemory = `
[统一记忆搜索结果]
来源: DeepMemo
- 用户喜欢咖啡
- 用户生日12月25日

来源: 知识库 (RAG)
- Cherry Studio 支持工作流编辑
- 支持 VCP 协议

来源: 对话历史
- 用户是前端工程师
- 正在开发 Electron 应用

来源: 标签记忆 (TagMemo)
- 相关标签: #编程 #咖啡爱好者 #12月生日
`

        const coordinatorAssistant: Assistant = {
          id: 'memory-coordinator',
          name: '记忆协调器',
          prompt: `你是一个统一记忆协调器，能够整合多个记忆源的信息。

可用的记忆源:
1. DeepMemo - 用户显式要求记住的信息
2. RAG知识库 - 项目相关文档
3. 对话历史 - 过去的交流记录
4. TagMemo - 基于标签的记忆索引

当前整合的记忆:
${integratedMemory}

请基于所有记忆源给用户一个综合性的回答。`,
          model: models.qwen,
          topics: [],
          messages: [],
          type: 'assistant',
          settings: {
            temperature: 0.3,
            contextCount: 5,
            maxTokens: 500,
            streamOutput: false
          } as any
        }

        const userQuestion = '根据你对我的了解，给我一些今天的建议'

        console.log(`用户问题: ${userQuestion}`)

        const startTime = Date.now()
        const aiProvider = new AiProvider(siliconFlowProvider)
        const result = await aiProvider.completions({
          assistant: coordinatorAssistant,
          messages: userQuestion,
          streamOutput: false,
          callType: 'chat',
          topicId: 'integrated-memory'
        })

        const elapsed = Date.now() - startTime
        const response = result.getText?.() || ''

        console.log(`耗时: ${elapsed}ms`)
        console.log(`响应: ${response}`)

        expect(response).toBeDefined()
        expect(response.length).toBeGreaterThan(50)
        // 应该整合多个记忆源的信息
        console.log('✓ 统一记忆搜索成功')
      },
      AI_TIMEOUT
    )
  })
})

// 无 API Key 时显示配置说明
describe.runIf(!hasApiKey)('硅基流动 API Key 配置说明', () => {
  it('显示如何配置 API Key', () => {
    console.log('\n')
    console.log('='.repeat(60))
    console.log('  硅基流动测试需要配置 API Key')
    console.log('='.repeat(60))
    console.log('\n方法 1: 命令行环境变量')
    console.log('  SILICONFLOW_API_KEY=sk-xxx yarn test:renderer --run ...')
    console.log('\n方法 2: 创建 .env.test 文件')
    console.log('  VITE_SILICONFLOW_API_KEY=sk-xxx')
    console.log('\n硅基流动 API 地址:')
    console.log('  https://api.siliconflow.cn/v1')
    console.log('='.repeat(60))

    expect(true).toBe(true)
  })
})
