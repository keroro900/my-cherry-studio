/**
 * DailyNoteWrite IPC Handler
 *
 * 为渲染进程提供 Agent 日记写入的 IPC 接口
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { getDailyNoteWritePlugin, type AgentWriteParams } from './DailyNoteWritePlugin'
import { getNoteService } from './NoteService'
import { safeHandle } from '../ipc'

const logger = loggerService.withContext('DailyNoteWriteIpcHandler')

/**
 * 注册 DailyNoteWrite IPC handlers
 */
export function registerDailyNoteWriteIpcHandlers(): void {
  logger.info('Registering DailyNoteWrite IPC handlers...')

  const plugin = getDailyNoteWritePlugin()

  // Agent 写入日记
  ipcMain.handle(IpcChannel.Note_AgentWrite, async (_event, params: AgentWriteParams) => {
    return safeHandle('note:agent-write', async () => {
      const result = await plugin.agentWrite(params)
      return result
    })
  })

  // 获取插件定义
  ipcMain.handle(IpcChannel.Note_GetPluginDefinition, async () => {
    return safeHandle('note:get-plugin-definition', () => {
      const definition = plugin.getToolDefinition()
      return { success: true, definition }
    })
  })

  // 获取插件配置
  ipcMain.handle(IpcChannel.Note_GetPluginConfig, async () => {
    return safeHandle('note:get-plugin-config', () => {
      const config = plugin.getConfig()
      return { success: true, config }
    })
  })

  // 更新插件配置
  ipcMain.handle(
    IpcChannel.Note_UpdatePluginConfig,
    async (
      _event,
      params: {
        config: {
          defaultCategory?: string
          autoTagEnabled?: boolean
          minAutoTagLength?: number
          dateFormat?: string
        }
      }
    ) => {
      return safeHandle('note:update-plugin-config', () => {
        plugin.updateConfig(params.config)
        return { success: true }
      })
    }
  )

  // ==================== Notes Search IPC Handlers ====================

  const noteService = getNoteService()

  // 全文搜索
  ipcMain.handle(
    IpcChannel.Note_FullTextSearch,
    async (
      _event,
      params: {
        query: string
        limit?: number
        minScore?: number
      }
    ) => {
      return safeHandle('note:full-text-search', async () => {
        const results = await noteService.fullTextSearch(params.query, {
          limit: params.limit,
          minScore: params.minScore
        })
        return {
          success: true,
          results: results.map((note) => ({
            id: note.id,
            filePath: note.filePath,
            title: note.title,
            content: note.content.slice(0, 500), // 只返回前 500 字符
            tags: note.frontmatter.tags,
            searchScore: note.searchScore,
            updatedAt: note.updatedAt.toISOString()
          }))
        }
      })
    }
  )

  // 初始化搜索索引
  ipcMain.handle(IpcChannel.Note_InitSearchIndex, async () => {
    return safeHandle('note:init-search-index', async () => {
      const result = await noteService.initializeSearchIndex()
      return result
    })
  })

  // 获取搜索统计
  ipcMain.handle(IpcChannel.Note_GetSearchStats, async () => {
    return safeHandle('note:get-search-stats', async () => {
      const stats = await noteService.getSearchStats()
      return { success: true, stats }
    })
  })

  // 列出所有笔记
  ipcMain.handle(
    'note:list-all',
    async (
      _event,
      params?: {
        limit?: number
        includeContent?: boolean
      }
    ) => {
      return safeHandle('note:list-all', async () => {
        const allNotes = await noteService.listAll()
        const limit = params?.limit || 100
        const includeContent = params?.includeContent ?? true

        // 按更新时间排序
        const sortedNotes = allNotes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

        return {
          success: true,
          notes: sortedNotes.slice(0, limit).map((note) => ({
            id: note.id,
            filePath: note.filePath,
            title: note.title,
            content: includeContent ? note.content.slice(0, 500) : '',
            tags: note.frontmatter.tags,
            characterName: note.frontmatter.characterName,
            isPublic: note.frontmatter.isPublic,
            updatedAt: note.updatedAt.toISOString(),
            createdAt: note.createdAt.toISOString()
          })),
          total: allNotes.length
        }
      })
    }
  )

  logger.info('DailyNoteWrite IPC handlers registered successfully')
}
