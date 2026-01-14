/**
 * RAG 真实搜索测试 - 搜索今天的笔记
 *
 * 测试流程:
 * 1. AI 生成 RAG 搜索请求
 * 2. 实际执行搜索（读取文件系统）
 * 3. 返回搜索结果给用户
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/RAGRealSearch.test.ts
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

// ==================== 笔记读取 ====================

interface NoteEntry {
  fileName: string
  filePath: string
  title: string
  date: string
  tags: string[]
  content: string
  preview: string
}

function parseYamlFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml: Record<string, any> = {}
  const lines = match[1].split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      let value = line.slice(colonIndex + 1).trim()

      // 处理数组格式 ["a", "b"]
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          yaml[key] = JSON.parse(value)
        } catch {
          yaml[key] = value
        }
      } else if (value.startsWith('"') && value.endsWith('"')) {
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

  function scanDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) return

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const frontmatter = parseYamlFrontmatter(content)

          // 提取正文内容（去除 frontmatter）
          const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)/)
          const body = bodyMatch ? bodyMatch[1] : content

          notes.push({
            fileName: entry.name,
            filePath: fullPath.replace(NOTES_DIR, '').replace(/\\/g, '/'),
            title: frontmatter.title || entry.name.replace('.md', ''),
            date: frontmatter.date || '',
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
            content: body,
            preview: body.slice(0, 200).replace(/\n/g, ' ')
          })
        } catch (error) {
          console.error(`读取笔记失败: ${fullPath}`, error)
        }
      }
    }
  }

  scanDir(NOTES_DIR)
  return notes
}

function searchNotes(query: string, notes: NoteEntry[]): NoteEntry[] {
  const keywords = query.toLowerCase().split(/\s+/)

  return notes.filter((note) => {
    const searchText = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase()
    return keywords.some((kw) => searchText.includes(kw))
  })
}

function getTodayNotes(notes: NoteEntry[]): NoteEntry[] {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return notes.filter((note) => note.date === todayStr || note.fileName.startsWith(String(today.getDate()).padStart(2, '0')))
}

// ==================== AI 调用 ====================

async function callSiliconFlowAI(systemPrompt: string, userMessage: string): Promise<{ success: boolean; content?: string; error?: string }> {
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
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ==================== 测试 ====================

describe.skipIf(!hasApiKey)('RAG 真实搜索测试', () => {
  it('应该搜索并显示今天写的所有笔记', async () => {
    console.log('\n==========================================')
    console.log('     RAG 真实搜索 - 今天的笔记')
    console.log('==========================================\n')

    // 1. 读取所有笔记
    const allNotes = readAllNotes()
    console.log(`[笔记库] 共有 ${allNotes.length} 篇笔记\n`)

    // 2. 筛选今天的笔记
    const todayNotes = getTodayNotes(allNotes)
    console.log(`[今天的笔记] 找到 ${todayNotes.length} 篇\n`)

    if (todayNotes.length === 0) {
      console.log('今天还没有写笔记。')
      return
    }

    // 3. 显示今天的笔记
    console.log('==========================================')
    console.log('           今天写的笔记列表')
    console.log('==========================================\n')

    for (let i = 0; i < todayNotes.length; i++) {
      const note = todayNotes[i]
      console.log(`📝 [${i + 1}] ${note.title}`)
      console.log(`   日期: ${note.date}`)
      console.log(`   标签: ${note.tags.join(', ') || '无'}`)
      console.log(`   路径: ${note.filePath}`)
      console.log(`   预览: ${note.preview.slice(0, 100)}...`)
      console.log('')
    }

    expect(todayNotes.length).toBeGreaterThan(0)

    // 4. 让 AI 总结今天的笔记
    console.log('==========================================')
    console.log('        AI 总结今天的笔记内容')
    console.log('==========================================\n')

    const notesContent = todayNotes.map((n, i) => `
## 笔记 ${i + 1}: ${n.title}
标签: ${n.tags.join(', ')}
内容:
${n.content.slice(0, 500)}
`).join('\n---\n')

    const aiResult = await callSiliconFlowAI(
      '你是一个笔记助手，请根据用户提供的笔记内容进行总结。',
      `以下是我今天写的笔记，请帮我做一个简要总结：\n\n${notesContent}`
    )

    if (aiResult.success) {
      console.log('[AI 总结]\n')
      console.log(aiResult.content)
    }

    expect(aiResult.success).toBe(true)
  }, 120000)

  it('应该搜索 VCP 相关的笔记', async () => {
    console.log('\n==========================================')
    console.log('     RAG 搜索 - VCP 相关笔记')
    console.log('==========================================\n')

    const allNotes = readAllNotes()
    const vcpNotes = searchNotes('VCP 协议', allNotes)

    console.log(`[搜索结果] 找到 ${vcpNotes.length} 篇 VCP 相关笔记\n`)

    for (const note of vcpNotes) {
      console.log(`📝 ${note.title}`)
      console.log(`   标签: ${note.tags.join(', ')}`)
      console.log(`   预览: ${note.preview.slice(0, 100)}...`)
      console.log('')
    }

    expect(vcpNotes.length).toBeGreaterThan(0)
  })

  it('应该搜索学习相关的笔记', async () => {
    console.log('\n==========================================')
    console.log('     RAG 搜索 - 学习相关笔记')
    console.log('==========================================\n')

    const allNotes = readAllNotes()
    const learningNotes = searchNotes('学习', allNotes)

    console.log(`[搜索结果] 找到 ${learningNotes.length} 篇学习相关笔记\n`)

    for (const note of learningNotes) {
      console.log(`📝 ${note.title}`)
      console.log(`   标签: ${note.tags.join(', ')}`)
      console.log(`   日期: ${note.date}`)
      console.log('')
    }

    expect(learningNotes.length).toBeGreaterThan(0)
  })

  it('应该让 AI 生成搜索请求并执行', async () => {
    console.log('\n==========================================')
    console.log('   AI 生成搜索请求 + 执行搜索')
    console.log('==========================================\n')

    // 1. 让 AI 生成搜索请求
    const systemPrompt = `你是一个 AI 助手，可以使用以下工具搜索笔记：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」搜索关键词「末」
<<<[END_TOOL_REQUEST]>>>

当用户询问时，使用工具进行搜索。`

    const aiResult = await callSiliconFlowAI(systemPrompt, '搜索今天写的关于 VCP 和 TypeScript 的笔记')
    expect(aiResult.success).toBe(true)

    console.log('[AI 生成的搜索请求]')
    console.log(aiResult.content?.slice(0, 400))
    console.log('')

    // 2. 解析 VCP 请求
    const vcpRequests = parseVCPToolRequest(aiResult.content || '')
    console.log(`[解析结果] ${vcpRequests.length} 个工具调用\n`)

    // 3. 执行搜索
    const allNotes = readAllNotes()

    for (const req of vcpRequests) {
      if (req.params.query) {
        console.log(`[执行搜索] query: "${req.params.query}"`)

        const results = searchNotes(req.params.query, allNotes)
        console.log(`[搜索结果] 找到 ${results.length} 篇笔记\n`)

        for (const note of results.slice(0, 5)) {
          console.log(`  📝 ${note.title}`)
          console.log(`     ${note.preview.slice(0, 80)}...`)
          console.log('')
        }
      }
    }
  }, 60000)
})

describe('笔记读取测试', () => {
  it('应该能读取笔记目录', () => {
    const notes = readAllNotes()
    console.log(`\n读取到 ${notes.length} 篇笔记`)

    if (notes.length > 0) {
      console.log('\n前 3 篇笔记:')
      for (const note of notes.slice(0, 3)) {
        console.log(`- ${note.title} (${note.date})`)
      }
    }

    expect(notes).toBeDefined()
  })
})
