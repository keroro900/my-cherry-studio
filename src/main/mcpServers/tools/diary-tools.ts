/**
 * VCP 日记 MCP 工具 (重构版)
 *
 * 现在使用统一的 NoteService，而非独立的 DailyNoteService
 * 保持 VCP 兼容的 API 接口
 *
 * 提供给 AI 调用的日记管理工具:
 * - diary_write: 写入日记 (AI 生成笔记)
 * - diary_search: 搜索日记 (按标签)
 * - diary_organize: 整理日记 (AI 辅助)
 * - diary_stats: 获取统计
 */

import { getNoteService } from '../../services/notes'
import type { ToolDefinition, ToolExecuteContext, ToolResult } from '../types'

// ==================== 工具定义 ====================

export const diaryWriteTool: ToolDefinition = {
  name: 'diary_write',
  description: 'AI 写入笔记。会创建 Markdown 文件并添加元数据。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '写作提示/内容要求'
      },
      title: {
        type: 'string',
        description: '笔记标题'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '标签列表'
      },
      characterName: {
        type: 'string',
        description: '角色名 (可选，用于角色扮演风格写作)'
      },
      folder: {
        type: 'string',
        description: '目标文件夹 (相对路径)'
      }
    },
    required: ['prompt']
  }
}

export const diarySearchTool: ToolDefinition = {
  name: 'diary_search',
  description: '按标签搜索笔记。',
  inputSchema: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '要搜索的标签'
      },
      limit: {
        type: 'number',
        description: '返回条数限制，默认 20'
      }
    },
    required: ['tags']
  }
}

export const diaryOrganizeTool: ToolDefinition = {
  name: 'diary_organize',
  description: 'AI 辅助整理笔记。支持摘要、自动打标签、合并、拆分。',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['summarize', 'tag', 'merge', 'split'],
        description: '操作类型'
      },
      notePaths: {
        type: 'array',
        items: { type: 'string' },
        description: '目标笔记路径列表'
      },
      options: {
        type: 'object',
        description: '额外选项'
      }
    },
    required: ['type', 'notePaths']
  }
}

export const diaryStatsTool: ToolDefinition = {
  name: 'diary_stats',
  description: '获取笔记统计信息。',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}

// ==================== 工具执行器 ====================

export async function executeDiaryWrite(
  args: {
    prompt: string
    title?: string
    tags?: string[]
    characterName?: string
    folder?: string
  },
  _context: ToolExecuteContext
): Promise<ToolResult> {
  const service = getNoteService()

  try {
    const note = await service.aiWrite({
      prompt: args.prompt,
      title: args.title,
      tags: args.tags,
      characterName: args.characterName,
      targetFolder: args.folder
    })

    return {
      success: true,
      content: `笔记已创建\n路径: ${note.filePath}\n标题: ${note.title}\n标签: ${note.frontmatter.tags?.join(', ') || '无'}`
    }
  } catch (error) {
    return {
      success: false,
      content: `创建笔记失败: ${String(error)}`
    }
  }
}

export async function executeDiarySearch(
  args: {
    tags: string[]
    limit?: number
  },
  _context: ToolExecuteContext
): Promise<ToolResult> {
  const service = getNoteService()
  const limit = args.limit || 20

  try {
    const notes = await service.searchByTags(args.tags)
    const limited = notes.slice(0, limit)

    if (limited.length === 0) {
      return { success: true, content: `未找到包含标签 [${args.tags.join(', ')}] 的笔记` }
    }

    const content = limited
      .map(
        (n) =>
          `【${n.title}】(${n.filePath})\n${n.content.slice(0, 200)}...\n标签: ${n.frontmatter.tags?.join(', ') || '无'}`
      )
      .join('\n\n---\n\n')

    return { success: true, content: `找到 ${limited.length} 篇笔记:\n\n${content}` }
  } catch (error) {
    return {
      success: false,
      content: `搜索失败: ${String(error)}`
    }
  }
}

export async function executeDiaryOrganize(
  args: {
    type: 'summarize' | 'tag' | 'merge' | 'split'
    notePaths: string[]
    options?: Record<string, unknown>
  },
  _context: ToolExecuteContext
): Promise<ToolResult> {
  const service = getNoteService()

  try {
    const result = await service.aiOrganize({
      type: args.type,
      notePaths: args.notePaths,
      options: args.options
    })

    return { success: result.success, content: result.message }
  } catch (error) {
    return {
      success: false,
      content: `整理失败: ${String(error)}`
    }
  }
}

export async function executeDiaryStats(
  _args: Record<string, never>,
  _context: ToolExecuteContext
): Promise<ToolResult> {
  const service = getNoteService()

  try {
    const notes = await service.listAll()
    const aiNotes = await service.listAIGenerated()

    const allTags = new Set<string>()
    for (const note of notes) {
      if (note.frontmatter.tags) {
        note.frontmatter.tags.forEach((t) => allTags.add(t))
      }
    }

    return {
      success: true,
      content: `笔记统计:
- 总笔记数: ${notes.length}
- AI 生成笔记数: ${aiNotes.length}
- 标签总数: ${allTags.size}`
    }
  } catch (error) {
    return {
      success: false,
      content: `获取统计失败: ${String(error)}`
    }
  }
}

// ==================== 导出所有工具 ====================

export const DIARY_TOOLS: ToolDefinition[] = [diaryWriteTool, diarySearchTool, diaryOrganizeTool, diaryStatsTool]

export const DIARY_TOOL_EXECUTORS: Record<string, (args: any, context: ToolExecuteContext) => Promise<ToolResult>> = {
  diary_write: executeDiaryWrite,
  diary_search: executeDiarySearch,
  diary_organize: executeDiaryOrganize,
  diary_stats: executeDiaryStats
}
