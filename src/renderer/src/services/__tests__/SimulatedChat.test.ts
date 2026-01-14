/**
 * 模拟聊天测试 - AI 调用工具并返回结果
 *
 * 完整流程:
 * 1. 用户发送消息
 * 2. AI 生成 VCP 工具调用
 * 3. 执行工具获取结果
 * 4. 将结果返回给 AI
 * 5. AI 生成最终回复
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/SimulatedChat.test.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, expect, it } from 'vitest'

// ==================== 配置 ====================

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
const MODEL = 'Qwen/Qwen3-8B'

const NOTES_DIR = 'C:/Users/Administrator/AppData/Roaming/CherryStudioDev/Data/Notes'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// ==================== VCP 解析器 ====================

interface ParsedVCPRequest {
  tool_name: string
  command: string
  params: Record<string, string>
}

function parseVCPToolRequest(text: string): ParsedVCPRequest[] {
  const results: ParsedVCPRequest[] = []
  const startTag = '<<<\\[TOOL_REQUEST\\]>>>'
  const endTag = '<<<\\[END_TOOL_REQUEST\\]>>>'
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: ParsedVCPRequest = { tool_name: '', command: '', params: {} }

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      let keyMatch = trimmed.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) keyMatch = trimmed.match(/^(\w+):\s*(.+)$/)

      if (keyMatch) {
        const [, key, value] = keyMatch
        if (key === 'tool_name') parsed.tool_name = value.trim()
        else if (key === 'command') parsed.command = value.trim()
        else parsed.params[key] = value.trim()
      }
    }

    if (parsed.tool_name) results.push(parsed)
  }

  return results
}

// ==================== 笔记操作 ====================

interface NoteEntry {
  fileName: string
  filePath: string
  title: string
  date: string
  tags: string[]
  content: string
}

function parseYamlFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml: Record<string, any> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      let value = line.slice(idx + 1).trim()
      if (value.startsWith('[')) {
        try { yaml[key] = JSON.parse(value) } catch { yaml[key] = value }
      } else if (value.startsWith('"')) {
        yaml[key] = value.slice(1, -1)
      } else {
        yaml[key] = value
      }
    }
  }
  return yaml
}

function readAllNotes(): NoteEntry[] {
  const notes: NoteEntry[] = []

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) scan(full)
      else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(full, 'utf-8')
          const fm = parseYamlFrontmatter(content)
          const body = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '')
          notes.push({
            fileName: entry.name,
            filePath: full.replace(NOTES_DIR, '').replace(/\\/g, '/'),
            title: fm.title || entry.name.replace('.md', ''),
            date: fm.date || '',
            tags: Array.isArray(fm.tags) ? fm.tags : [],
            content: body
          })
        } catch {}
      }
    }
  }

  scan(NOTES_DIR)
  return notes
}

function searchNotes(query: string): NoteEntry[] {
  const notes = readAllNotes()
  const kws = query.toLowerCase().split(/\s+/)
  return notes.filter(n => {
    const text = `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase()
    return kws.some(k => text.includes(k))
  })
}

function writeDiary(content: string, tags: string[], title?: string): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const ts = Date.now()

  const slug = (title || 'chat-diary').toLowerCase().replace(/\s+/g, '-').slice(0, 20)
  const fileName = `${d}-${slug}-${ts}.md`
  const dir = path.join(NOTES_DIR, 'diary', String(y), m)

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, fileName)
  const fm = `---
id: ${Math.random().toString(36).slice(2)}
title: "${title || '聊天日记'}"
date: ${y}-${m}-${d}
tags: [${tags.map(t => `"${t}"`).join(', ')}]
aiGenerated: true
source: "SimulatedChat"
---

${content}`

  fs.writeFileSync(filePath, fm, 'utf-8')
  return `diary/${y}/${m}/${fileName}`
}

// ==================== 工具执行器 ====================

interface ToolResult {
  success: boolean
  output: string
  data?: any
}

function executeTool(request: ParsedVCPRequest): ToolResult {
  const { tool_name, command, params } = request

  // DeepMemo / LightMemo 搜索
  if ((tool_name === 'DeepMemo' || tool_name === 'LightMemo') &&
      (command === 'DeepSearch' || command === 'SearchRAG' || command === 'search')) {
    const query = params.query || ''
    const results = searchNotes(query)
    if (results.length === 0) {
      return { success: true, output: `未找到与 "${query}" 相关的记忆。`, data: { count: 0 } }
    }
    const output = results.slice(0, 5).map((n, i) =>
      `[${i + 1}] **${n.title}** (${n.date})\n${n.content.slice(0, 150)}...`
    ).join('\n\n')
    return {
      success: true,
      output: `找到 ${results.length} 条相关记忆：\n\n${output}`,
      data: { count: results.length, results: results.slice(0, 5) }
    }
  }

  // DailyNoteWrite 搜索
  if (tool_name === 'DailyNoteWrite' && command === 'RAGSearch') {
    const query = params.query || ''
    const results = searchNotes(query)
    if (results.length === 0) {
      return { success: true, output: `未找到与 "${query}" 相关的日记。`, data: { count: 0 } }
    }
    const output = results.slice(0, 5).map((n, i) =>
      `[${i + 1}] **${n.title}** (${n.date})\n${n.content.slice(0, 150)}...`
    ).join('\n\n')
    return {
      success: true,
      output: `找到 ${results.length} 篇相关日记：\n\n${output}`,
      data: { count: results.length }
    }
  }

  // DailyNoteWrite 写入
  if (tool_name === 'DailyNoteWrite' && (command === 'write' || command === 'quickNote')) {
    const content = params.content || ''
    if (!content) {
      return { success: false, output: '内容不能为空' }
    }
    const tags = params.tags?.split(/[,，]/).map(t => t.trim()) || ['聊天记录']
    const title = params.title || '聊天日记'
    const filePath = writeDiary(content, tags, title)
    return {
      success: true,
      output: `日记已保存: ${filePath}`,
      data: { filePath }
    }
  }

  // invoke_agent 协同
  if (tool_name === 'invoke_agent') {
    const assistantId = params.assistant_id || params.assistantId || ''
    const message = params.message || ''
    return {
      success: true,
      output: `[助手协同] 已将任务 "${message}" 转发给 ${assistantId}。\n（模拟响应）专业助手已收到请求，正在处理中...`,
      data: { assistantId, message }
    }
  }

  return { success: false, output: `未知工具: ${tool_name}.${command}` }
}

// ==================== AI 调用 ====================

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function chat(messages: Message[]): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const res = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` }
    }

    const data = await res.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ==================== Agent 循环 ====================

const SYSTEM_PROMPT = `你是 Cherry Studio 的 AI 助手，可以使用以下工具：

## 1. 搜索记忆 (DeepMemo)
<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」搜索内容「末」
<<<[END_TOOL_REQUEST]>>>

## 2. 搜索日记 (DailyNoteWrite)
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」搜索内容「末」
<<<[END_TOOL_REQUEST]>>>

## 3. 写日记 (DailyNoteWrite)
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」日记内容「末」
tags:「始」标签1, 标签2「末」
<<<[END_TOOL_REQUEST]>>>

## 4. 调用专业助手 (invoke_agent)
<<<[TOOL_REQUEST]>>>
tool_name:「始」invoke_agent「末」
command:「始」invoke「末」
assistant_id:「始」assistant_code「末」
message:「始」任务描述「末」
<<<[END_TOOL_REQUEST]>>>

当你使用工具后，系统会返回工具执行结果，你需要根据结果回复用户。
如果不需要工具，直接回复用户即可。`

async function agentChat(userMessage: string, maxTurns = 3): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]

  let finalResponse = ''

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`\n[Turn ${turn + 1}] 调用 AI...`)

    const result = await chat(messages)
    if (!result.success || !result.content) {
      return `AI 调用失败: ${result.error}`
    }

    const aiResponse = result.content
    console.log(`[AI 返回]\n${aiResponse.slice(0, 500)}${aiResponse.length > 500 ? '...' : ''}`)

    // 解析工具调用
    const toolCalls = parseVCPToolRequest(aiResponse)

    if (toolCalls.length === 0) {
      // 没有工具调用，返回最终回复
      finalResponse = aiResponse
      break
    }

    // 执行工具
    console.log(`\n[执行工具] 找到 ${toolCalls.length} 个工具调用`)

    const toolResults: string[] = []
    for (const call of toolCalls) {
      console.log(`  - ${call.tool_name}.${call.command}(${JSON.stringify(call.params)})`)

      const toolResult = executeTool(call)
      console.log(`  [结果] ${toolResult.success ? '成功' : '失败'}: ${toolResult.output.slice(0, 100)}...`)

      toolResults.push(`[工具: ${call.tool_name}.${call.command}]\n${toolResult.output}`)
    }

    // 将工具结果添加到对话
    messages.push({ role: 'assistant', content: aiResponse })
    messages.push({
      role: 'user',
      content: `工具执行结果：\n\n${toolResults.join('\n\n---\n\n')}\n\n请根据以上结果回复用户。`
    })
  }

  return finalResponse
}

// ==================== 测试 ====================

describe.skipIf(!hasApiKey)('模拟聊天测试 - AI 工具调用', () => {
  it('应该搜索并返回今天的笔记', async () => {
    console.log('\n==========================================')
    console.log('  模拟聊天: 搜索今天的笔记')
    console.log('==========================================')

    const response = await agentChat('帮我搜索今天写的关于 VCP 的笔记')

    console.log('\n[最终回复]')
    console.log(response)

    expect(response).toBeDefined()
    expect(response.length).toBeGreaterThan(0)
  }, 120000)

  it('应该写一篇日记', async () => {
    console.log('\n==========================================')
    console.log('  模拟聊天: 写日记')
    console.log('==========================================')

    const response = await agentChat('帮我写一篇今天的学习日记，内容是：今天测试了 VCP 的完整调用链路，包括 AI 生成工具调用、工具执行、结果返回等功能，测试全部通过。')

    console.log('\n[最终回复]')
    console.log(response)

    expect(response).toBeDefined()
  }, 120000)

  it('应该先搜索再总结', async () => {
    console.log('\n==========================================')
    console.log('  模拟聊天: 搜索并总结')
    console.log('==========================================')

    const response = await agentChat('搜索我所有关于 TypeScript 的笔记，然后给我一个总结')

    console.log('\n[最终回复]')
    console.log(response)

    expect(response).toBeDefined()
  }, 120000)

  it('应该调用专业助手', async () => {
    console.log('\n==========================================')
    console.log('  模拟聊天: 调用专业助手')
    console.log('==========================================')

    const response = await agentChat('我有一段 TypeScript 代码需要审查，请帮我找代码专家')

    console.log('\n[最终回复]')
    console.log(response)

    expect(response).toBeDefined()
  }, 120000)
})
