/**
 * Tavern IPC 处理器
 *
 * 注册所有 Tavern 相关的 IPC 通道
 * 提供角色卡、世界书、预设的跨进程通信接口
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import { getCharacterCardService } from './CharacterCardService'
import { getPresetManager } from './PresetManager'
import { getTavernCardParser } from './TavernCardParser'
import { getWorldBookEngine } from './WorldBookEngine'
import type {
  CharacterCard,
  CharacterCardExportOptions,
  CharacterCardImportOptions,
  CharacterCardListItem,
  CharacterCardSearchParams,
  TavernIpcResponse,
  TavernPreset,
  WorldBookMatchOptions,
  WorldBookMatchResult
} from './types'

const logger = loggerService.withContext('TavernIpcHandler')

// ============================================================================
// IPC 通道名称常量
// ============================================================================

export const TavernIpcChannels = {
  // 角色卡
  CARD_LIST: 'tavern:card:list',
  CARD_GET: 'tavern:card:get',
  CARD_CREATE: 'tavern:card:create',
  CARD_UPDATE: 'tavern:card:update',
  CARD_DELETE: 'tavern:card:delete',
  CARD_IMPORT: 'tavern:card:import',
  CARD_EXPORT: 'tavern:card:export',
  CARD_ACTIVATE: 'tavern:card:activate',
  CARD_DEACTIVATE: 'tavern:card:deactivate',
  CARD_GET_ACTIVE: 'tavern:card:getActive',
  CARD_TOGGLE_FAVORITE: 'tavern:card:toggleFavorite',

  // 世界书
  WORLDBOOK_MATCH: 'tavern:worldbook:match',
  WORLDBOOK_LOAD: 'tavern:worldbook:load',
  WORLDBOOK_UNLOAD: 'tavern:worldbook:unload',
  WORLDBOOK_LIST: 'tavern:worldbook:list',
  WORLDBOOK_STATS: 'tavern:worldbook:stats',

  // 预设
  PRESET_LIST: 'tavern:preset:list',
  PRESET_GET: 'tavern:preset:get',
  PRESET_SAVE: 'tavern:preset:save',
  PRESET_DELETE: 'tavern:preset:delete',
  PRESET_ACTIVATE: 'tavern:preset:activate',
  PRESET_DEACTIVATE: 'tavern:preset:deactivate',
  PRESET_GET_ACTIVE: 'tavern:preset:getActive',
  PRESET_APPLY: 'tavern:preset:apply', // 应用预设到消息
  PRESET_CREATE_DIRECTOR: 'tavern:preset:createDirector',
  PRESET_CREATE_ROLEPLAY: 'tavern:preset:createRoleplay',

  // 解析
  PARSE_PNG: 'tavern:parse:png',
  PARSE_JSON: 'tavern:parse:json'
} as const

// ============================================================================
// Handler 实现
// ============================================================================

/**
 * 注册所有 Tavern IPC 处理器
 */
export function registerTavernIpcHandlers(): void {
  logger.info('Registering Tavern IPC handlers')

  // 角色卡处理器
  registerCardHandlers()

  // 世界书处理器
  registerWorldBookHandlers()

  // 预设处理器
  registerPresetHandlers()

  // 解析处理器
  registerParseHandlers()

  logger.info('Tavern IPC handlers registered')
}

/**
 * 注销所有 Tavern IPC 处理器
 */
export function unregisterTavernIpcHandlers(): void {
  const allChannels = Object.values(TavernIpcChannels)
  for (const channel of allChannels) {
    ipcMain.removeHandler(channel)
  }
  logger.info('Tavern IPC handlers unregistered')
}

// ============================================================================
// 角色卡处理器
// ============================================================================

function registerCardHandlers(): void {
  const service = getCharacterCardService()

  // 列出角色卡
  ipcMain.handle(
    TavernIpcChannels.CARD_LIST,
    async (_, params?: CharacterCardSearchParams): Promise<TavernIpcResponse<CharacterCardListItem[]>> => {
      try {
        const cards = await service.list(params)
        return { success: true, data: cards }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 获取角色卡
  ipcMain.handle(TavernIpcChannels.CARD_GET, async (_, id: string): Promise<TavernIpcResponse<CharacterCard>> => {
    try {
      const card = await service.get(id)
      if (!card) {
        return { success: false, error: `Card not found: ${id}` }
      }
      return { success: true, data: card }
    } catch (error) {
      return handleError(error)
    }
  })

  // 创建角色卡
  ipcMain.handle(
    TavernIpcChannels.CARD_CREATE,
    async (_, name: string, data?: Partial<CharacterCard>): Promise<TavernIpcResponse<CharacterCard>> => {
      try {
        const card = await service.create(name, data)
        return { success: true, data: card }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 更新角色卡
  ipcMain.handle(
    TavernIpcChannels.CARD_UPDATE,
    async (_, id: string, updates: Partial<CharacterCard>): Promise<TavernIpcResponse<CharacterCard>> => {
      try {
        const card = await service.update(id, updates)
        if (!card) {
          return { success: false, error: `Card not found: ${id}` }
        }
        return { success: true, data: card }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 删除角色卡
  ipcMain.handle(TavernIpcChannels.CARD_DELETE, async (_, id: string): Promise<TavernIpcResponse<boolean>> => {
    try {
      const success = await service.delete(id)
      return { success, data: success }
    } catch (error) {
      return handleError(error)
    }
  })

  // 导入角色卡
  ipcMain.handle(
    TavernIpcChannels.CARD_IMPORT,
    async (_, options: CharacterCardImportOptions): Promise<TavernIpcResponse<CharacterCard>> => {
      try {
        const card = await service.import(options)
        if (!card) {
          return { success: false, error: 'Failed to import card' }
        }
        return { success: true, data: card }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 导出角色卡
  ipcMain.handle(
    TavernIpcChannels.CARD_EXPORT,
    async (_, id: string, options: CharacterCardExportOptions): Promise<TavernIpcResponse<string>> => {
      try {
        const outputPath = await service.export(id, options)
        if (!outputPath) {
          return { success: false, error: 'Failed to export card' }
        }
        return { success: true, data: outputPath }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 激活角色卡
  ipcMain.handle(TavernIpcChannels.CARD_ACTIVATE, async (_, id: string): Promise<TavernIpcResponse<CharacterCard>> => {
    try {
      const card = await service.activate(id)
      if (!card) {
        return { success: false, error: `Card not found: ${id}` }
      }
      return { success: true, data: card }
    } catch (error) {
      return handleError(error)
    }
  })

  // 停用角色卡
  ipcMain.handle(TavernIpcChannels.CARD_DEACTIVATE, async (): Promise<TavernIpcResponse<void>> => {
    try {
      await service.deactivate()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 获取活跃角色卡
  ipcMain.handle(TavernIpcChannels.CARD_GET_ACTIVE, async (): Promise<TavernIpcResponse<CharacterCard | null>> => {
    try {
      const card = service.getActive()
      return { success: true, data: card }
    } catch (error) {
      return handleError(error)
    }
  })

  // 切换收藏
  ipcMain.handle(TavernIpcChannels.CARD_TOGGLE_FAVORITE, async (_, id: string): Promise<TavernIpcResponse<boolean>> => {
    try {
      const isFavorite = await service.toggleFavorite(id)
      return { success: true, data: isFavorite }
    } catch (error) {
      return handleError(error)
    }
  })
}

// ============================================================================
// 世界书处理器
// ============================================================================

function registerWorldBookHandlers(): void {
  const engine = getWorldBookEngine()

  // 匹配世界书
  ipcMain.handle(
    TavernIpcChannels.WORLDBOOK_MATCH,
    async (
      _,
      text: string,
      bookId?: string,
      options?: WorldBookMatchOptions
    ): Promise<TavernIpcResponse<WorldBookMatchResult[]>> => {
      try {
        const matches = engine.matchText(text, bookId, options)
        return { success: true, data: matches }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 加载世界书
  ipcMain.handle(
    TavernIpcChannels.WORLDBOOK_LOAD,
    async (_, bookId: string, book: unknown): Promise<TavernIpcResponse<void>> => {
      try {
        engine.loadBook(bookId, book as any)
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 卸载世界书
  ipcMain.handle(TavernIpcChannels.WORLDBOOK_UNLOAD, async (_, bookId: string): Promise<TavernIpcResponse<void>> => {
    try {
      engine.unloadBook(bookId)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 列出已加载的世界书
  ipcMain.handle(TavernIpcChannels.WORLDBOOK_LIST, async (): Promise<TavernIpcResponse<string[]>> => {
    try {
      const books = engine.listBooks()
      return { success: true, data: books }
    } catch (error) {
      return handleError(error)
    }
  })

  // 获取统计信息
  ipcMain.handle(
    TavernIpcChannels.WORLDBOOK_STATS,
    async (): Promise<TavernIpcResponse<{ bookCount: number; entryCount: number; keywordCount: number }>> => {
      try {
        const stats = engine.getStats()
        return { success: true, data: stats }
      } catch (error) {
        return handleError(error)
      }
    }
  )
}

// ============================================================================
// 预设处理器
// ============================================================================

function registerPresetHandlers(): void {
  const manager = getPresetManager()

  // 列出预设
  ipcMain.handle(TavernIpcChannels.PRESET_LIST, async (): Promise<TavernIpcResponse<TavernPreset[]>> => {
    try {
      logger.info('IPC: PRESET_LIST called')
      const presets = await manager.list()
      logger.info('IPC: PRESET_LIST returning', { count: presets.length })
      return { success: true, data: presets }
    } catch (error) {
      logger.error('IPC: PRESET_LIST failed', { error: error instanceof Error ? error.message : String(error) })
      return handleError(error)
    }
  })

  // 获取预设
  ipcMain.handle(TavernIpcChannels.PRESET_GET, async (_, id: string): Promise<TavernIpcResponse<TavernPreset>> => {
    try {
      const preset = await manager.get(id)
      if (!preset) {
        return { success: false, error: `Preset not found: ${id}` }
      }
      return { success: true, data: preset }
    } catch (error) {
      return handleError(error)
    }
  })

  // 保存预设
  ipcMain.handle(TavernIpcChannels.PRESET_SAVE, async (_, preset: TavernPreset): Promise<TavernIpcResponse<void>> => {
    try {
      await manager.save(preset)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除预设
  ipcMain.handle(TavernIpcChannels.PRESET_DELETE, async (_, id: string): Promise<TavernIpcResponse<boolean>> => {
    try {
      const success = await manager.delete(id)
      return { success, data: success }
    } catch (error) {
      return handleError(error)
    }
  })

  // 激活预设
  ipcMain.handle(TavernIpcChannels.PRESET_ACTIVATE, async (_, id: string): Promise<TavernIpcResponse<TavernPreset>> => {
    try {
      const preset = await manager.activate(id)
      if (!preset) {
        return { success: false, error: `Preset not found: ${id}` }
      }
      return { success: true, data: preset }
    } catch (error) {
      return handleError(error)
    }
  })

  // 停用预设
  ipcMain.handle(TavernIpcChannels.PRESET_DEACTIVATE, async (): Promise<TavernIpcResponse<void>> => {
    try {
      manager.deactivate()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 获取活跃预设
  ipcMain.handle(TavernIpcChannels.PRESET_GET_ACTIVE, async (): Promise<TavernIpcResponse<TavernPreset | null>> => {
    try {
      const preset = manager.getActive()
      return { success: true, data: preset }
    } catch (error) {
      return handleError(error)
    }
  })

  // 创建导演模式预设
  ipcMain.handle(
    TavernIpcChannels.PRESET_CREATE_DIRECTOR,
    async (_, name: string, instructions: string): Promise<TavernIpcResponse<TavernPreset>> => {
      try {
        const preset = await manager.createDirectorPreset(name, instructions)
        return { success: true, data: preset }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 创建角色扮演预设
  ipcMain.handle(
    TavernIpcChannels.PRESET_CREATE_ROLEPLAY,
    async (_, name: string, systemPrefix?: string, systemSuffix?: string): Promise<TavernIpcResponse<TavernPreset>> => {
      try {
        const preset = await manager.createRoleplayPreset(name, systemPrefix, systemSuffix)
        return { success: true, data: preset }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 应用预设到消息列表
  ipcMain.handle(
    TavernIpcChannels.PRESET_APPLY,
    async (
      _,
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      presetId?: string
    ): Promise<TavernIpcResponse<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>> => {
      try {
        const result = manager.applyPreset(messages, presetId)
        return { success: true, data: result }
      } catch (error) {
        return handleError(error)
      }
    }
  )
}

// ============================================================================
// 解析处理器
// ============================================================================

function registerParseHandlers(): void {
  const parser = getTavernCardParser()

  // 解析 PNG 文件
  ipcMain.handle(TavernIpcChannels.PARSE_PNG, async (_, filePath: string): Promise<TavernIpcResponse<unknown>> => {
    try {
      const result = await parser.parseFromFile(filePath)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true, data: result.card }
    } catch (error) {
      return handleError(error)
    }
  })

  // 解析 JSON 字符串
  ipcMain.handle(TavernIpcChannels.PARSE_JSON, async (_, jsonStr: string): Promise<TavernIpcResponse<unknown>> => {
    try {
      const result = parser.parseFromJson(jsonStr)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true, data: result.card }
    } catch (error) {
      return handleError(error)
    }
  })
}

// ============================================================================
// 辅助函数
// ============================================================================

function handleError(error: unknown): TavernIpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error)
  logger.error('IPC handler error', { error: message })
  return { success: false, error: message }
}
