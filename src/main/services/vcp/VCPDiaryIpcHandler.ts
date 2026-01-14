/**
 * VCPDiaryIpcHandler - VCP 日记管理 IPC 处理器
 *
 * 连接 preload vcpDiary API 到 NoteService
 */

import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { loggerService } from '@main/services/LoggerService'
import { getNoteService, type NoteFrontmatter } from '@main/services/notes/NoteService'

const logger = loggerService.withContext('VCPDiaryIpcHandler')

/**
 * 注册 VCP Diary IPC 处理器
 */
export function registerVCPDiaryIpcHandlers(): void {
  logger.info('Registering VCP Diary IPC handlers')

  // 清理已存在的 handlers（防止热重载导致的重复注册）
  const diaryChannels = [
    IpcChannel.VCP_Diary_List,
    IpcChannel.VCP_Diary_Read,
    IpcChannel.VCP_Diary_Write,
    IpcChannel.VCP_Diary_Edit,
    IpcChannel.VCP_Diary_Delete,
    IpcChannel.VCP_Diary_GetStats,
    IpcChannel.VCP_Diary_Search,
    IpcChannel.VCP_Diary_ParseDeclarations,
    IpcChannel.VCP_Diary_Summarize,
    IpcChannel.VCP_Diary_SyncToKnowledge
  ]

  for (const channel of diaryChannels) {
    try {
      ipcMain.removeHandler(channel)
    } catch (error) {
      // 忽略 handler 不存在的错误
    }
  }

  const noteService = getNoteService()

  // ==================== 日记列表 ====================

  // 列出所有日记
  ipcMain.handle(
    IpcChannel.VCP_Diary_List,
    async (
      _event,
      args: {
        characterName?: string
        category?: string
        tags?: string[]
        limit?: number
        offset?: number
      } = {}
    ) => {
      try {
        let notes = await noteService.listAll()

        // 按角色名称过滤
        if (args.characterName) {
          notes = notes.filter((n) => n.frontmatter.characterName === args.characterName)
        }

        // 按分类过滤
        if (args.category) {
          notes = notes.filter((n) => n.frontmatter.category === args.category)
        }

        // 按标签过滤
        if (args.tags && args.tags.length > 0) {
          const tagSet = new Set(args.tags.map((t) => t.toLowerCase()))
          notes = notes.filter((n) => n.frontmatter.tags?.some((t) => tagSet.has(t.toLowerCase())))
        }

        // 按日期排序（最新在前）
        notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

        // 分页
        const offset = args.offset || 0
        const limit = args.limit || 50
        const total = notes.length
        notes = notes.slice(offset, offset + limit)

        return {
          success: true,
          entries: notes.map((n) => ({
            id: n.id,
            path: n.filePath,
            title: n.title,
            contentPreview: n.content.slice(0, 200),
            tags: n.frontmatter.tags || [],
            characterName: n.frontmatter.characterName,
            category: n.frontmatter.category,
            date: n.frontmatter.date,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString()
          })),
          totalEntries: total
        }
      } catch (error) {
        logger.error('Failed to list diary entries', error as Error)
        return { success: false, error: String(error), entries: [] }
      }
    }
  )

  // ==================== 读取日记 ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Read,
    async (
      _event,
      args: {
        entryPath: string
      }
    ) => {
      try {
        const note = await noteService.read(args.entryPath)

        if (!note) {
          return { success: false, error: 'Entry not found' }
        }

        return {
          success: true,
          entry: {
            id: note.id,
            path: note.filePath,
            title: note.title,
            content: note.content,
            tags: note.frontmatter.tags || [],
            characterName: note.frontmatter.characterName,
            category: note.frontmatter.category,
            date: note.frontmatter.date,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString()
          }
        }
      } catch (error) {
        logger.error('Failed to read diary entry', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== 写入日记 ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Write,
    async (
      _event,
      args: {
        title: string
        content: string
        tags?: string[]
        characterName?: string
        category?: string
        date?: string
      }
    ) => {
      try {
        // 生成文件名
        const dateStr = args.date || new Date().toISOString().split('T')[0]
        const safeTitle = args.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50)
        const fileName = `${dateStr}-${safeTitle}.md`

        // 构建 frontmatter
        const frontmatter: NoteFrontmatter = {
          tags: args.tags || [],
          date: args.date,
          characterName: args.characterName,
          category: args.category
        }

        const note = await noteService.write(fileName, args.content, frontmatter)

        return {
          success: true,
          entry: {
            path: note.filePath,
            title: note.title,
            tags: note.frontmatter.tags || []
          }
        }
      } catch (error) {
        logger.error('Failed to write diary entry', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== 编辑日记 ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Edit,
    async (
      _event,
      args: {
        entryPath: string
        content?: string
        tags?: string[]
      }
    ) => {
      try {
        // 读取现有内容
        const existing = await noteService.read(args.entryPath)
        if (!existing) {
          return { success: false, error: 'Entry not found' }
        }

        // 更新内容和标签
        const newContent = args.content ?? existing.content
        const newFrontmatter: NoteFrontmatter = {
          ...existing.frontmatter,
          tags: args.tags ?? existing.frontmatter.tags
        }

        await noteService.write(args.entryPath, newContent, newFrontmatter)

        return { success: true }
      } catch (error) {
        logger.error('Failed to edit diary entry', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== 删除日记 ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Delete,
    async (
      _event,
      args: {
        entryPath: string
      }
    ) => {
      try {
        const deleted = await noteService.delete(args.entryPath)

        if (!deleted) {
          return { success: false, error: 'Entry not found or could not be deleted' }
        }

        return { success: true, message: 'Entry deleted successfully' }
      } catch (error) {
        logger.error('Failed to delete diary entry', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== 获取统计 ====================

  ipcMain.handle(IpcChannel.VCP_Diary_GetStats, async () => {
    try {
      const notes = await noteService.listAll()

      // 收集所有唯一标签
      const allTags = new Set<string>()
      const characterCounts = new Map<string, number>()

      for (const note of notes) {
        if (note.frontmatter.tags) {
          for (const tag of note.frontmatter.tags) {
            allTags.add(tag)
          }
        }

        if (note.frontmatter.characterName) {
          const count = characterCounts.get(note.frontmatter.characterName) || 0
          characterCounts.set(note.frontmatter.characterName, count + 1)
        }
      }

      return {
        success: true,
        stats: {
          // 前端 DailyNotePanel 期望的字段名
          bookCount: characterCounts.size,
          entryCount: notes.length,
          publicEntryCount: 0, // 暂不区分公开/私有日记
          tagCount: allTags.size,
          // 额外信息
          totalEntries: notes.length,
          totalCharacters: characterCounts.size,
          totalTags: allTags.size,
          entriesByCharacter: Object.fromEntries(characterCounts)
        }
      }
    } catch (error) {
      logger.error('Failed to get diary stats', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== 搜索日记 ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Search,
    async (
      _event,
      args: {
        query: string
        characterName?: string
        tags?: string[]
        limit?: number
        injectMode?: boolean
      }
    ) => {
      try {
        // 使用全文搜索
        let results = await noteService.fullTextSearch(args.query, {
          limit: (args.limit || 10) * 2 // 多取一些用于过滤
        })

        // 按角色名称过滤
        if (args.characterName) {
          results = results.filter((n) => n.frontmatter.characterName === args.characterName)
        }

        // 按标签过滤
        if (args.tags && args.tags.length > 0) {
          const tagSet = new Set(args.tags.map((t) => t.toLowerCase()))
          results = results.filter((n) => n.frontmatter.tags?.some((t) => tagSet.has(t.toLowerCase())))
        }

        // 限制结果数量
        results = results.slice(0, args.limit || 10)

        // 如果是注入模式，返回简化格式
        if (args.injectMode) {
          return {
            success: true,
            injections: results.map((n) => `【${n.title}】\n${n.content.slice(0, 500)}`),
            cleanedText: args.query
          }
        }

        return {
          success: true,
          results: results.map((n) => ({
            id: n.id,
            path: n.filePath,
            title: n.title,
            contentPreview: n.content.slice(0, 300),
            tags: n.frontmatter.tags || [],
            characterName: n.frontmatter.characterName,
            date: n.frontmatter.date,
            score: n.searchScore
          }))
        }
      } catch (error) {
        logger.error('Failed to search diary entries', error as Error)
        return { success: false, error: String(error), results: [] }
      }
    }
  )

  logger.info('VCP Diary IPC handlers registered')
}
