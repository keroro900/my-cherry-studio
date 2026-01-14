/**
 * VCP 日记服务类型定义
 */

import * as z from 'zod'

// ==================== Zod Schemas ====================

export const DiaryWriteSchema = z.object({
  characterName: z.string().describe('日记本名称/角色名'),
  content: z.string().describe('日记内容'),
  title: z.string().optional().describe('日记标题'),
  tags: z.array(z.string()).optional().describe('标签列表'),
  date: z.string().optional().describe('日期 (YYYY-MM-DD)'),
  isPublic: z.boolean().optional().default(false).describe('是否公开')
})

export const DiaryReadSchema = z.object({
  characterName: z.string().describe('日记本名称'),
  startDate: z.string().optional().describe('开始日期'),
  endDate: z.string().optional().describe('结束日期'),
  limit: z.number().optional().default(10).describe('返回条数')
})

export const DiaryEditSchema = z.object({
  entryId: z.string().describe('日记条目 ID'),
  content: z.string().optional().describe('新内容'),
  title: z.string().optional().describe('新标题'),
  tags: z.array(z.string()).optional().describe('新标签'),
  isPublic: z.boolean().optional().describe('是否公开')
})

export const DiarySearchSchema = z.object({
  tags: z.array(z.string()).describe('搜索标签'),
  characterName: z.string().optional().describe('限定日记本'),
  limit: z.number().optional().default(20).describe('返回条数')
})

export const DiaryOrganizeSchema = z.object({
  type: z.enum(['merge', 'split', 'tag', 'summarize', 'archive', 'share']).describe('操作类型'),
  targetIds: z.array(z.string()).describe('目标日记 ID'),
  options: z.record(z.string(), z.any()).optional().describe('额外选项')
})

export const DiaryInjectSchema = z.object({
  characterName: z.string().optional().describe('日记本名称'),
  format: z.enum(['text', 'json', 'markdown']).optional().default('text').describe('输出格式')
})

// ==================== Type Exports ====================

export type DiaryWriteArgs = z.infer<typeof DiaryWriteSchema>
export type DiaryReadArgs = z.infer<typeof DiaryReadSchema>
export type DiaryEditArgs = z.infer<typeof DiaryEditSchema>
export type DiarySearchArgs = z.infer<typeof DiarySearchSchema>
export type DiaryOrganizeArgs = z.infer<typeof DiaryOrganizeSchema>
export type DiaryInjectArgs = z.infer<typeof DiaryInjectSchema>

// ==================== Tool Context ====================

export interface ToolExecuteContext {
  sessionId?: string
  userId?: string
  workspaceId?: string
  [key: string]: any
}

export interface ToolResult {
  success: boolean
  content: string
  data?: any
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

/**
 * MCP 工具定义 (带 handler)
 */
export interface MCPToolDefinition extends ToolDefinition {
  handler: (args: any, context?: ToolExecuteContext) => Promise<any>
}
