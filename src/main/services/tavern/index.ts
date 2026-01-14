/**
 * VCPTavern 模块入口
 *
 * 提供角色卡、世界书、预设等功能的统一导出
 */

// ============================================================================
// 类型导出
// ============================================================================

export * from './types'

// ============================================================================
// 服务导出
// ============================================================================

// TavernCardParser - PNG 解析器
export {
  TavernCardParser,
  getTavernCardParser,
  createDefaultV2Card,
  createDefaultV2Data,
  createDefaultV3Card,
  createDefaultV3Data,
  type ParseResult
} from './TavernCardParser'

// CharacterCardService - 角色卡服务
export {
  CharacterCardService,
  getCharacterCardService,
  resetCharacterCardService
} from './CharacterCardService'

// WorldBookEngine - 世界书引擎
export {
  WorldBookEngine,
  getWorldBookEngine,
  resetWorldBookEngine,
  type ChatMessage
} from './WorldBookEngine'

// PresetManager - 预设管理器
export {
  PresetManager,
  getPresetManager,
  resetPresetManager
} from './PresetManager'

// TavernAssistantBridge - 酒馆-助手桥接
export {
  TavernAssistantBridge,
  getTavernAssistantBridge,
  createTavernAssistantBridge,
  type TavernAssistant,
  type ContextInjectionRule,
  type BridgeOptions
} from './TavernAssistantBridge'

// TavernIpcHandler - IPC 处理器
export {
  registerTavernIpcHandlers,
  unregisterTavernIpcHandlers,
  TavernIpcChannels
} from './TavernIpcHandler'

// ============================================================================
// 初始化函数
// ============================================================================

import { loggerService } from '@logger'

import { getCharacterCardService } from './CharacterCardService'
import { getPresetManager } from './PresetManager'
import { unregisterTavernIpcHandlers } from './TavernIpcHandler'

const logger = loggerService.withContext('TavernModule')

/**
 * 初始化 Tavern 模块
 * 注意: IPC handlers 应由 ipc.ts 调用 registerTavernIpcHandlers() 注册
 *       此函数仅初始化服务层（CharacterCardService, PresetManager）
 */
export async function initializeTavernModule(): Promise<void> {
  const startTime = Date.now()
  logger.info('Initializing Tavern module')

  try {
    // 初始化服务 - 按顺序，CharacterCardService 通常较慢（需要创建预设角色卡）
    logger.info('Initializing CharacterCardService...')
    await getCharacterCardService().initialize()
    logger.info('CharacterCardService initialized', { elapsedMs: Date.now() - startTime })

    logger.info('Initializing PresetManager...')
    await getPresetManager().initialize()
    logger.info('PresetManager initialized', { elapsedMs: Date.now() - startTime })

    // 注意: IPC 处理器由 ipc.ts 单独注册，避免重复注册
    // registerTavernIpcHandlers() 已在 ipc.ts 中调用

    logger.info('Tavern module initialized successfully', { totalElapsedMs: Date.now() - startTime })
  } catch (error) {
    logger.error('Failed to initialize Tavern module', {
      error,
      elapsedMs: Date.now() - startTime
    })
    throw error
  }
}

/**
 * 关闭 Tavern 模块
 */
export async function shutdownTavernModule(): Promise<void> {
  logger.info('Shutting down Tavern module')

  try {
    // 注销 IPC 处理器
    unregisterTavernIpcHandlers()

    // 关闭服务
    await getCharacterCardService().shutdown()
    await getPresetManager().shutdown()

    logger.info('Tavern module shutdown successfully')
  } catch (error) {
    logger.error('Failed to shutdown Tavern module', { error })
    throw error
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

import { getWorldBookEngine } from './WorldBookEngine'
import type { WorldBookMatchResult } from './types'

/**
 * 获取当前活跃角色卡的系统提示词
 */
export function getActiveCharacterSystemPrompt(): string | null {
  const card = getCharacterCardService().getActive()
  if (!card) return null

  const parts: string[] = []

  // 角色描述
  if (card.data.description) {
    parts.push(card.data.description)
  }

  // 性格
  if (card.data.personality) {
    parts.push(`Personality: ${card.data.personality}`)
  }

  // 场景
  if (card.data.scenario) {
    parts.push(`Scenario: ${card.data.scenario}`)
  }

  // 系统提示词
  if (card.data.system_prompt) {
    parts.push(card.data.system_prompt)
  }

  return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * 获取当前活跃角色卡的首条消息
 */
export function getActiveCharacterFirstMessage(): string | null {
  const card = getCharacterCardService().getActive()
  if (!card) return null

  return card.data.first_mes || null
}

/**
 * 获取当前活跃角色卡的示例对话
 */
export function getActiveCharacterExampleDialogue(): string | null {
  const card = getCharacterCardService().getActive()
  if (!card) return null

  return card.data.mes_example || null
}

/**
 * 匹配当前活跃角色卡的世界书
 */
export function matchActiveWorldBook(text: string): WorldBookMatchResult[] {
  const card = getCharacterCardService().getActive()
  if (!card?.data.character_book) return []

  const cardId = getCharacterCardService().getActiveId()
  if (!cardId) return []

  return getWorldBookEngine().matchText(text, cardId)
}

/**
 * 检查是否有活跃角色卡
 */
export function hasActiveCharacter(): boolean {
  return getCharacterCardService().getActiveId() !== null
}

/**
 * 获取活跃角色卡信息 (简略)
 */
export function getActiveCharacterInfo(): { id: string; name: string; avatar?: string } | null {
  const card = getCharacterCardService().getActive()
  if (!card) return null

  return {
    id: card.id,
    name: card.name,
    avatar: card.avatar
  }
}
