/**
 * RAG 能力测试 - 读取笔记、知识库和全局记忆
 *
 * 测试内容:
 * 1. DeepMemo - 深度记忆搜索 (两阶段: Tantivy + Reranker)
 * 2. LightMemo - 统一记忆搜索 (多后端融合)
 * 3. DailyNoteWrite RAGSearch - 日记 RAG 检索
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/RAGCapabilityTest.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// ==================== 配置 ====================

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
const MODEL = 'Qwen/Qwen3-8B'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// ==================== VCP 协议 ====================

const VCP_TOOL_REQUEST_START = '<<<[TOOL_REQUEST]>>>'
const VCP_TOOL_REQUEST_END = '<<<[END_TOOL_REQUEST]>>>'

interface ParsedVCPRequest {
  tool_name: string
  command: string
  params: Record<string, string>
}

function parseVCPToolRequest(text: string): ParsedVCPRequest[] {
  const results: ParsedVCPRequest[] = []

  const startTag = VCP_TOOL_REQUEST_START.replace(/[<>[\]]/g, '\\$&')
  const endTag = VCP_TOOL_REQUEST_END.replace(/[<>[\]]/g, '\\$&')
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: ParsedVCPRequest = {
      tool_name: '',
      command: '',
      params: {}
    }

    const lines = content.split('\n')
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      let keyMatch = trimmedLine.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) {
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

// ==================== AI 调用 ====================

interface AICallResult {
  success: boolean
  content?: string
  error?: string
}

async function callSiliconFlowAI(systemPrompt: string, userMessage: string): Promise<AICallResult> {
  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `API error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    return { success: true, content }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ==================== RAG 系统提示词 ====================

const RAG_SYSTEM_PROMPT = `你是一个 AI 助手，拥有以下记忆和检索工具：

## 1. DeepMemo - 深度记忆搜索
用于搜索历史对话、学习笔记、项目记录等深度记忆。
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」搜索内容「末」
finalK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 2. LightMemo - 统一记忆搜索
跨多个后端搜索（日记、笔记、知识库、记忆）。
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」LightMemo「末」
command:「始」SearchRAG「末」
query:「始」搜索内容「末」
k:「始」10「末」
backends:「始」diary,lightmemo,deepmemo,knowledge「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 3. DailyNoteWrite - 日记 RAG 搜索
专门搜索日记内容。
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」搜索内容「末」
topK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

当用户询问需要检索信息时，请选择合适的工具进行搜索。可以同时使用多个工具。`

// ==================== 测试用例 ====================

describe.skipIf(!hasApiKey)('RAG 能力测试 - 真实 AI 调用', () => {
  beforeAll(() => {
    console.log('\n==========================================')
    console.log('       RAG 能力测试 - 硅基流动 API')
    console.log('==========================================')
    console.log(`模型: ${MODEL}`)
  })

  afterAll(() => {
    console.log('\n==========================================')
    console.log('              RAG 测试完成')
    console.log('==========================================')
  })

  it('应该让 AI 使用 DeepMemo 搜索深度记忆', async () => {
    console.log('\n--- 测试 1: DeepMemo 深度记忆搜索 ---')

    const userMessage = '帮我搜索一下我之前关于 VCP 协议的学习笔记。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 400)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    // 应该有搜索请求
    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查是否使用了 DeepMemo
    const deepMemoRequest = vcpRequests.find((r) => r.tool_name === 'DeepMemo')
    if (deepMemoRequest) {
      console.log(`[DeepMemo] command: ${deepMemoRequest.command}`)
      console.log(`[DeepMemo] query: ${deepMemoRequest.params.query}`)
      expect(deepMemoRequest.command).toBe('DeepSearch')
      expect(deepMemoRequest.params.query).toBeDefined()
    } else {
      // AI 可能选择了其他工具
      const anySearch = vcpRequests.find(
        (r) => r.params.query && r.params.query.toLowerCase().includes('vcp')
      )
      expect(anySearch).toBeDefined()
      console.log(`[使用工具] ${anySearch?.tool_name} - ${anySearch?.command}`)
    }
  }, 60000)

  it('应该让 AI 使用 LightMemo 进行统一搜索', async () => {
    console.log('\n--- 测试 2: LightMemo 统一记忆搜索 ---')

    const userMessage = '搜索所有关于 TypeScript 的内容，包括日记、笔记和知识库。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 400)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查是否使用了 LightMemo
    const lightMemoRequest = vcpRequests.find((r) => r.tool_name === 'LightMemo')
    if (lightMemoRequest) {
      console.log(`[LightMemo] command: ${lightMemoRequest.command}`)
      console.log(`[LightMemo] query: ${lightMemoRequest.params.query}`)
      console.log(`[LightMemo] backends: ${lightMemoRequest.params.backends || '默认'}`)
      expect(lightMemoRequest.command).toBe('SearchRAG')
    }

    // AI 的响应应该包含 TypeScript 相关内容
    expect(aiResult.content?.toLowerCase()).toContain('typescript')
  }, 60000)

  it('应该让 AI 使用 DailyNoteWrite RAGSearch 搜索日记', async () => {
    console.log('\n--- 测试 3: DailyNoteWrite RAG 日记搜索 ---')

    const userMessage = '查找我最近写的关于学习的日记。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 400)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查是否使用了 DailyNoteWrite RAGSearch
    const diaryRequest = vcpRequests.find((r) => r.tool_name === 'DailyNoteWrite')
    if (diaryRequest) {
      console.log(`[DailyNoteWrite] command: ${diaryRequest.command}`)
      console.log(`[DailyNoteWrite] query: ${diaryRequest.params.query}`)
      expect(['RAGSearch', 'SearchNotes', 'GetRecent']).toContain(diaryRequest.command)
    }
  }, 60000)

  it('应该让 AI 组合使用多个 RAG 工具', async () => {
    console.log('\n--- 测试 4: 多工具组合搜索 ---')

    const userMessage = '我想回顾一下最近的学习内容，请同时搜索我的日记、深度记忆和知识库。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 500)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    // 应该有多个工具调用或者使用 LightMemo 的多后端
    const toolNames = vcpRequests.map((r) => r.tool_name)
    console.log(`[工具列表] ${toolNames.join(', ')}`)

    // 至少使用一个搜索工具
    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查是否包含搜索相关的调用
    const hasSearch = vcpRequests.some(
      (r) =>
        r.command === 'DeepSearch' ||
        r.command === 'SearchRAG' ||
        r.command === 'RAGSearch' ||
        r.command === 'search'
    )
    expect(hasSearch).toBe(true)
  }, 60000)

  it('应该让 AI 根据时间范围搜索记忆', async () => {
    console.log('\n--- 测试 5: 时间范围搜索 ---')

    const userMessage = '查找我上周关于项目的所有记录。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 400)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查是否有时间相关的参数
    for (const req of vcpRequests) {
      console.log(`[${req.tool_name}] ${req.command}`)
      if (req.params.timeExpression) {
        console.log(`  时间表达式: ${req.params.timeExpression}`)
      }
      if (req.params.query) {
        console.log(`  查询: ${req.params.query}`)
      }
    }
  }, 60000)

  it('应该让 AI 搜索特定标签的内容', async () => {
    console.log('\n--- 测试 6: 标签搜索 ---')

    const userMessage = '搜索所有带有"学习"和"技术"标签的笔记。'

    const aiResult = await callSiliconFlowAI(RAG_SYSTEM_PROMPT, userMessage)
    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 400)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查搜索参数是否包含标签信息
    for (const req of vcpRequests) {
      console.log(`[${req.tool_name}] ${req.command}`)
      console.log(`  参数: ${JSON.stringify(req.params)}`)
    }
  }, 60000)
})

describe('RAG VCP 格式解析测试', () => {
  it('应该解析 DeepMemo 搜索格式', () => {
    const text = `
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」VCP 协议学习笔记「末」
initialK:「始」30「末」
finalK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`

    const results = parseVCPToolRequest(text)
    expect(results.length).toBe(1)
    expect(results[0].tool_name).toBe('DeepMemo')
    expect(results[0].command).toBe('DeepSearch')
    expect(results[0].params.query).toBe('VCP 协议学习笔记')
    expect(results[0].params.initialK).toBe('30')
    expect(results[0].params.finalK).toBe('5')
  })

  it('应该解析 LightMemo 搜索格式', () => {
    const text = `
<<<[TOOL_REQUEST]>>>
tool_name:「始」LightMemo「末」
command:「始」SearchRAG「末」
query:「始」TypeScript 最佳实践「末」
k:「始」10「末」
backends:「始」diary,lightmemo,knowledge「末」
<<<[END_TOOL_REQUEST]>>>`

    const results = parseVCPToolRequest(text)
    expect(results.length).toBe(1)
    expect(results[0].tool_name).toBe('LightMemo')
    expect(results[0].command).toBe('SearchRAG')
    expect(results[0].params.query).toBe('TypeScript 最佳实践')
    expect(results[0].params.backends).toBe('diary,lightmemo,knowledge')
  })

  it('应该解析 DailyNoteWrite RAGSearch 格式', () => {
    const text = `
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」最近的学习心得「末」
timeExpression:「始」过去一周「末」
topK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`

    const results = parseVCPToolRequest(text)
    expect(results.length).toBe(1)
    expect(results[0].tool_name).toBe('DailyNoteWrite')
    expect(results[0].command).toBe('RAGSearch')
    expect(results[0].params.query).toBe('最近的学习心得')
    expect(results[0].params.timeExpression).toBe('过去一周')
  })

  it('应该解析多个 RAG 工具调用', () => {
    const text = `
我会同时搜索多个数据源：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」项目架构「末」
<<<[END_TOOL_REQUEST]>>>

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」项目进展「末」
<<<[END_TOOL_REQUEST]>>>

搜索完成后会汇总结果。`

    const results = parseVCPToolRequest(text)
    expect(results.length).toBe(2)
    expect(results[0].tool_name).toBe('DeepMemo')
    expect(results[1].tool_name).toBe('DailyNoteWrite')
  })
})
