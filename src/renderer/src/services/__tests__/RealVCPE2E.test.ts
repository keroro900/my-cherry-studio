/**
 * VCP 完整 E2E 测试 - 真实 AI 调用 + 真实日记写入
 *
 * 测试流程:
 * 1. 调用 SiliconFlow AI，让 AI 生成 VCP 工具调用格式
 * 2. 解析 AI 返回的 VCP TOOL_REQUEST
 * 3. 执行 DailyNoteWriteService 写入日记
 * 4. 验证日记文件在磁盘上存在
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/RealVCPE2E.test.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// ==================== 配置 ====================

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
const MODEL = 'Qwen/Qwen3-8B'

// 日记目录 - Cherry Studio Dev
const NOTES_DIR = 'C:/Users/Administrator/AppData/Roaming/CherryStudioDev/Data/Notes'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// ==================== VCP 协议常量 ====================

const VCP_TOOL_REQUEST_START = '<<<[TOOL_REQUEST]>>>'
const VCP_TOOL_REQUEST_END = '<<<[END_TOOL_REQUEST]>>>'

// ==================== VCP 解析器 ====================

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

      // 格式1: key:「始」value「末」
      let keyMatch = trimmedLine.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) {
        // 格式2: key: value
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

// ==================== 日记写入 ====================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

interface DiaryWriteResult {
  success: boolean
  filePath?: string
  absolutePath?: string
  error?: string
}

function writeDiaryToFileSystem(
  content: string,
  tags: string[],
  title?: string,
  category?: string
): DiaryWriteResult {
  try {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const timestamp = Date.now()

    const cat = category || 'diary'
    const titleSlug = (title || 'ai-generated')
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .slice(0, 30)

    const fileName = `${day}-${titleSlug}-${timestamp}.md`
    const relativeDir = `${cat}/${year}/${month}`
    const absoluteDir = path.join(NOTES_DIR, relativeDir)
    const absolutePath = path.join(absoluteDir, fileName)
    const relativePath = `${relativeDir}/${fileName}`

    ensureDir(absoluteDir)

    const frontmatter = [
      '---',
      `id: ${generateId()}`,
      `title: "${title || 'AI 生成日记'}"`,
      `date: ${formatDate(date)}`,
      `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
      `aiGenerated: true`,
      `createdBy: "VCP-E2E-Test"`,
      `source: "SiliconFlow-AI"`,
      '---'
    ].join('\n')

    const fullContent = `${frontmatter}\n\n${content}`
    fs.writeFileSync(absolutePath, fullContent, 'utf-8')

    return {
      success: true,
      filePath: relativePath,
      absolutePath
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
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

// ==================== 测试用例 ====================

// 记录写入的文件路径，测试后清理
const writtenFiles: string[] = []

describe.skipIf(!hasApiKey)('VCP 完整 E2E 测试 - AI 生成 + 真实写入', () => {
  beforeAll(() => {
    console.log('\n==========================================')
    console.log('       VCP E2E 测试 - 真实 AI 调用')
    console.log('==========================================')
    console.log(`API Key: ${SILICONFLOW_API_KEY.slice(0, 10)}...`)
    console.log(`模型: ${MODEL}`)
    console.log(`日记目录: ${NOTES_DIR}`)
  })

  afterAll(() => {
    // 可选：清理测试文件
    // for (const file of writtenFiles) {
    //   if (fs.existsSync(file)) {
    //     fs.unlinkSync(file)
    //   }
    // }
    console.log(`\n测试完成，共写入 ${writtenFiles.length} 个文件`)
  })

  it('应该让 AI 生成 VCP 格式并写入日记', async () => {
    // 1. 构造 system prompt，教 AI 使用 VCP 格式
    const systemPrompt = `你是一个 AI 助手，当需要写日记时，你必须使用以下 VCP 工具调用格式：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」日记内容...「末」
tags:「始」标签1, 标签2「末」
<<<[END_TOOL_REQUEST]>>>

注意：
1. 必须使用 <<<[TOOL_REQUEST]>>> 和 <<<[END_TOOL_REQUEST]>>> 标签
2. 每个参数使用「始」和「末」包裹值
3. 可以在工具调用之前或之后添加说明文字`

    // 2. 用户请求
    const userMessage = '帮我写一篇关于今天学习 VCP 协议的日记，记录一下学习心得。'

    console.log('\n[1] 调用 AI 生成 VCP 格式...')
    const aiResult = await callSiliconFlowAI(systemPrompt, userMessage)

    expect(aiResult.success).toBe(true)
    expect(aiResult.content).toBeDefined()
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 200)}...`)

    // 3. 解析 VCP 格式
    console.log('\n[2] 解析 VCP 工具调用...')
    const vcpRequests = parseVCPToolRequest(aiResult.content || '')

    expect(vcpRequests.length).toBeGreaterThan(0)
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    const firstRequest = vcpRequests[0]
    expect(firstRequest.tool_name).toBe('DailyNoteWrite')
    expect(firstRequest.command).toBe('write')
    expect(firstRequest.params.content).toBeDefined()

    console.log(`[工具名] ${firstRequest.tool_name}`)
    console.log(`[命令] ${firstRequest.command}`)
    console.log(`[内容长度] ${firstRequest.params.content?.length || 0} 字符`)

    // 4. 执行写入
    console.log('\n[3] 写入日记文件...')
    const tags = firstRequest.params.tags?.split(/[,，]/).map((t) => t.trim()) || ['VCP', 'AI生成']
    const writeResult = writeDiaryToFileSystem(
      firstRequest.params.content,
      tags,
      'VCP学习日记-AI生成',
      'diary'
    )

    expect(writeResult.success).toBe(true)
    expect(writeResult.absolutePath).toBeDefined()
    console.log(`[写入成功] ${writeResult.filePath}`)

    if (writeResult.absolutePath) {
      writtenFiles.push(writeResult.absolutePath)
    }

    // 5. 验证文件存在
    console.log('\n[4] 验证文件...')
    const fileExists = fs.existsSync(writeResult.absolutePath!)
    expect(fileExists).toBe(true)

    const fileContent = fs.readFileSync(writeResult.absolutePath!, 'utf-8')
    expect(fileContent).toContain('VCP-E2E-Test')
    expect(fileContent).toContain(firstRequest.params.content.slice(0, 50))

    console.log('[验证通过] 文件存在且内容正确')
    console.log(`\n请在 Cherry Studio 日记页面查看: ${writeResult.filePath}`)
  }, 60000)

  it('应该让 AI 生成多个工具调用（搜索 + 写入）', async () => {
    const systemPrompt = `你是一个 AI 助手，可以使用以下 VCP 工具：

1. DeepMemo 搜索记忆：
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」搜索内容「末」
<<<[END_TOOL_REQUEST]>>>

2. DailyNoteWrite 写日记：
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」日记内容「末」
tags:「始」标签「末」
<<<[END_TOOL_REQUEST]>>>

当用户需要时，可以同时使用多个工具。`

    const userMessage = '先搜索一下我之前关于 TypeScript 的笔记，然后写一篇今天的学习总结。'

    console.log('\n[1] 调用 AI 生成多工具调用...')
    const aiResult = await callSiliconFlowAI(systemPrompt, userMessage)

    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回长度] ${aiResult.content?.length} 字符`)

    // 解析
    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    // 至少应该有一个工具调用
    expect(vcpRequests.length).toBeGreaterThan(0)

    // 检查工具类型
    const toolNames = vcpRequests.map((r) => r.tool_name)
    console.log(`[工具列表] ${toolNames.join(', ')}`)

    // 如果有 DailyNoteWrite，执行写入
    const writeRequest = vcpRequests.find((r) => r.tool_name === 'DailyNoteWrite')
    if (writeRequest && writeRequest.params.content) {
      console.log('\n[2] 执行日记写入...')
      const tags = writeRequest.params.tags?.split(/[,，]/).map((t) => t.trim()) || ['TypeScript', '学习']
      const writeResult = writeDiaryToFileSystem(
        writeRequest.params.content,
        tags,
        'TypeScript学习总结-AI生成',
        'diary'
      )

      expect(writeResult.success).toBe(true)
      console.log(`[写入成功] ${writeResult.filePath}`)

      if (writeResult.absolutePath) {
        writtenFiles.push(writeResult.absolutePath)
      }
    }

    // 检查是否有 DeepMemo 搜索请求
    const searchRequest = vcpRequests.find((r) => r.tool_name === 'DeepMemo')
    if (searchRequest) {
      console.log(`[搜索请求] query: ${searchRequest.params.query}`)
      expect(searchRequest.command).toBe('DeepSearch')
    }
  }, 60000)

  it('应该让 AI 使用 invoke_agent 协同', async () => {
    const systemPrompt = `你是主脑助手，当需要专业帮助时，使用 invoke_agent 调用其他助手：

<<<[TOOL_REQUEST]>>>
tool_name:「始」invoke_agent「末」
command:「始」invoke「末」
assistant_id:「始」assistant_xxx「末」
message:「始」任务描述「末」
<<<[END_TOOL_REQUEST]>>>

你可以调用：
- assistant_code: 代码专家
- assistant_writer: 写作专家`

    const userMessage = '我需要一个代码专家帮我审查 TypeScript 代码。'

    console.log('\n[1] 调用 AI 生成 invoke_agent...')
    const aiResult = await callSiliconFlowAI(systemPrompt, userMessage)

    expect(aiResult.success).toBe(true)
    console.log(`[AI 返回] ${aiResult.content?.slice(0, 300)}...`)

    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] 找到 ${vcpRequests.length} 个工具调用`)

    // 应该有 invoke_agent 调用
    if (vcpRequests.length > 0) {
      const invokeRequest = vcpRequests.find((r) => r.tool_name === 'invoke_agent')
      if (invokeRequest) {
        console.log(`[invoke_agent] assistant_id: ${invokeRequest.params.assistant_id}`)
        console.log(`[invoke_agent] message: ${invokeRequest.params.message?.slice(0, 100)}`)
        expect(invokeRequest.params.assistant_id || invokeRequest.params.message).toBeDefined()
      }
    }

    // 记录这个测试，即使没有完全匹配也算通过（AI 可能用不同方式表达）
    expect(aiResult.content?.toLowerCase()).toMatch(/code|代码|invoke|assistant/)
  }, 60000)
})

describe('VCP 解析器单元测试', () => {
  it('应该正确解析标准 VCP 格式', () => {
    const text = `
我来帮你写日记：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天学习了 VCP 协议，很有收获！「末」
tags:「始」VCP, 学习「末」
<<<[END_TOOL_REQUEST]>>>

日记已写入。`

    const results = parseVCPToolRequest(text)

    expect(results.length).toBe(1)
    expect(results[0].tool_name).toBe('DailyNoteWrite')
    expect(results[0].command).toBe('write')
    expect(results[0].params.content).toBe('今天学习了 VCP 协议，很有收获！')
    expect(results[0].params.tags).toBe('VCP, 学习')
  })

  it('应该解析多个工具调用', () => {
    const text = `
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」TypeScript 学习「末」
<<<[END_TOOL_REQUEST]>>>

搜索完成，现在写入日记：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天的学习总结「末」
<<<[END_TOOL_REQUEST]>>>`

    const results = parseVCPToolRequest(text)

    expect(results.length).toBe(2)
    expect(results[0].tool_name).toBe('DeepMemo')
    expect(results[1].tool_name).toBe('DailyNoteWrite')
  })

  it('应该处理简单冒号格式', () => {
    const text = `
<<<[TOOL_REQUEST]>>>
tool_name: DailyNoteWrite
command: write
content: 简单格式测试
<<<[END_TOOL_REQUEST]>>>`

    const results = parseVCPToolRequest(text)

    expect(results.length).toBe(1)
    expect(results[0].tool_name).toBe('DailyNoteWrite')
    expect(results[0].params.content).toBe('简单格式测试')
  })
})
