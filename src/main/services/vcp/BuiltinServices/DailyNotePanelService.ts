/**
 * DailyNotePanelService - 日记面板路由胶水服务
 *
 * 作为 VCP 工具暴露日记面板操作功能:
 * - OpenPanel: 打开日记面板 (通知 UI)
 * - GetStats: 获取日记统计信息
 * - ListNotebooks: 列出所有日记本
 * - NavigateToEntry: 导航到指定日记条目
 *
 * 该服务是一个轻量级胶水层，主要用于 AI 与 UI 的联动。
 * 实际的日记 CRUD 操作请使用 DailyNoteWriteService。
 */

import { loggerService } from '@logger'
import { BrowserWindow } from 'electron'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'
import { getNoteService } from '../../notes/NoteService'

const logger = loggerService.withContext('VCP:DailyNotePanelService')

/**
 * 日记面板服务
 */
export class DailyNotePanelService implements IBuiltinService {
  name = 'DailyNotePanel'
  displayName = '日记面板服务 (内置)'
  description = '日记面板路由胶水服务，提供面板打开、条目导航、统计获取等功能。用于 AI 与日记 UI 的联动。'
  version = '1.0.0'
  type = 'builtin_service' as const
  category = 'diary'
  author = 'Cherry Studio'

  // 工具定义
  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'OpenPanel',
      description: '打开日记面板界面。可指定模式：character(角色日记)、global(全局日记)、memory(记忆管理)。',
      parameters: [
        {
          name: 'mode',
          description: '面板模式: character(角色日记)、global(全局日记)、memory(记忆管理)',
          required: false,
          type: 'string',
          default: 'global'
        },
        {
          name: 'characterName',
          description: '角色名称（mode=character 时使用）',
          required: false,
          type: 'string'
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNotePanel「末」
command:「始」OpenPanel「末」
params:「始」{"mode": "global"}「末」
<<<[/TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'GetStats',
      description: '获取日记系统统计信息，包括日记本数量、条目数量、标签数量等。',
      parameters: [],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNotePanel「末」
command:「始」GetStats「末」
params:「始」{}「末」
<<<[/TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'ListNotebooks',
      description: '列出所有日记本（按角色名分组）。',
      parameters: [
        {
          name: 'includeStats',
          description: '是否包含每个日记本的条目统计',
          required: false,
          type: 'boolean',
          default: true
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNotePanel「末」
command:「始」ListNotebooks「末」
params:「始」{"includeStats": true}「末」
<<<[/TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'NavigateToEntry',
      description: '导航到指定的日记条目。会打开日记面板并定位到该条目。',
      parameters: [
        {
          name: 'entryPath',
          description: '日记条目路径',
          required: false,
          type: 'string'
        },
        {
          name: 'entryId',
          description: '日记条目 ID（与 entryPath 二选一）',
          required: false,
          type: 'string'
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNotePanel「末」
command:「始」NavigateToEntry「末」
params:「始」{"entryPath": "diary/2024-01-01-日记.md"}「末」
<<<[/TOOL_REQUEST]>>>`
    }
  ]

  // 文档
  documentation = `
# 日记面板服务

日记面板服务是一个路由胶水层，用于连接 AI 与日记面板 UI。

## 使用场景

- 当用户说"打开日记"时，调用 OpenPanel 打开面板
- 当用户询问"我有多少条日记"时，调用 GetStats 获取统计
- 当用户说"查看昨天的日记"时，先搜索再调用 NavigateToEntry 导航

## 注意

- 实际的日记读写操作请使用 DailyNoteWrite 服务
- 此服务仅用于 UI 导航和统计查询
`

  systemPrompt = `你可以使用 DailyNotePanel 服务与日记面板 UI 进行交互：
- OpenPanel: 打开日记面板界面
- GetStats: 获取日记统计信息
- ListNotebooks: 列出所有日记本
- NavigateToEntry: 导航到指定日记条目

注意：日记的实际读写请使用 DailyNoteWrite 服务。`

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    logger.info('DailyNotePanelService initialized')
  }

  /**
   * 执行命令
   */
  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    logger.debug('DailyNotePanelService execute', { command, params })

    try {
      switch (command) {
        case 'OpenPanel':
          return this.handleOpenPanel(params)

        case 'GetStats':
          return this.handleGetStats()

        case 'ListNotebooks':
          return this.handleListNotebooks(params)

        case 'NavigateToEntry':
          return this.handleNavigateToEntry(params)

        default:
          return {
            success: false,
            error: `Unknown command: ${command}. Available commands: OpenPanel, GetStats, ListNotebooks, NavigateToEntry`
          }
      }
    } catch (error) {
      logger.error('DailyNotePanelService execution failed', { command, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 打开日记面板
   */
  private async handleOpenPanel(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const mode = (params.mode as string) || 'global'
    const characterName = params.characterName as string | undefined

    // 通知主窗口打开日记面板
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      mainWindow.webContents.send('vcp:open-diary-panel', {
        mode,
        characterName
      })

      return {
        success: true,
        data: {
          message: `日记面板已打开，模式: ${mode}`,
          mode,
          characterName
        }
      }
    }

    return {
      success: false,
      error: '无法找到主窗口'
    }
  }

  /**
   * 获取日记统计
   */
  private async handleGetStats(): Promise<BuiltinServiceResult> {
    try {
      const noteService = getNoteService()
      const allNotes = await noteService.listAll()

      // 统计日记本（按 characterName 分组）
      const notebooks = new Set<string>()
      const tags = new Set<string>()
      let publicCount = 0

      for (const note of allNotes) {
        const charName = note.frontmatter.characterName || '全局'
        notebooks.add(charName)

        if (note.frontmatter.tags) {
          for (const tag of note.frontmatter.tags) {
            tags.add(tag)
          }
        }

        if (!note.frontmatter.characterName) {
          publicCount++
        }
      }

      const stats = {
        bookCount: notebooks.size,
        entryCount: allNotes.length,
        publicEntryCount: publicCount,
        tagCount: tags.size,
        notebooks: Array.from(notebooks)
      }

      return {
        success: true,
        data: stats
      }
    } catch (error) {
      logger.error('Failed to get diary stats', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 列出所有日记本
   */
  private async handleListNotebooks(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const includeStats = params.includeStats !== false

    try {
      const noteService = getNoteService()
      const allNotes = await noteService.listAll()

      // 按 characterName 分组
      const notebookMap = new Map<
        string,
        {
          name: string
          noteCount: number
          latestMtime: number
          tags: Set<string>
        }
      >()

      for (const note of allNotes) {
        const charName = note.frontmatter.characterName || '全局'

        if (!notebookMap.has(charName)) {
          notebookMap.set(charName, {
            name: charName,
            noteCount: 0,
            latestMtime: 0,
            tags: new Set()
          })
        }

        const notebook = notebookMap.get(charName)!
        notebook.noteCount++

        const mtime = note.updatedAt.getTime()
        if (mtime > notebook.latestMtime) {
          notebook.latestMtime = mtime
        }

        if (note.frontmatter.tags) {
          for (const tag of note.frontmatter.tags) {
            notebook.tags.add(tag)
          }
        }
      }

      const notebooks = Array.from(notebookMap.values())
        .map((nb) => ({
          name: nb.name,
          noteCount: includeStats ? nb.noteCount : undefined,
          latestMtime: includeStats ? nb.latestMtime : undefined,
          tagCount: includeStats ? nb.tags.size : undefined
        }))
        .sort((a, b) => (b.latestMtime || 0) - (a.latestMtime || 0))

      return {
        success: true,
        data: {
          notebooks,
          totalCount: notebooks.length
        }
      }
    } catch (error) {
      logger.error('Failed to list notebooks', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 导航到指定日记条目
   */
  private async handleNavigateToEntry(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const entryPath = params.entryPath as string | undefined
    const entryId = params.entryId as string | undefined

    if (!entryPath && !entryId) {
      return {
        success: false,
        error: '需要提供 entryPath 或 entryId'
      }
    }

    // 通知主窗口导航到指定条目
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      mainWindow.webContents.send('vcp:navigate-diary-entry', {
        entryPath,
        entryId
      })

      return {
        success: true,
        data: {
          message: '正在导航到日记条目',
          entryPath,
          entryId
        }
      }
    }

    return {
      success: false,
      error: '无法找到主窗口'
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    logger.info('DailyNotePanelService shutdown')
  }
}
