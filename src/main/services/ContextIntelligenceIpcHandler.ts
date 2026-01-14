/**
 * Context Intelligence IPC Handler
 *
 * 处理上下文净化器和幻觉抑制器的 IPC 请求
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import {
  createContextPurifier,
  getContextPurifier,
  type PurifierConfig,
  type PurifyResult
} from '../knowledge/context/ContextPurifier'
import {
  createHallucinationSuppressor,
  getHallucinationSuppressor,
  type KnowledgeReference,
  type SuppressionResult,
  type SuppressorConfig
} from '../knowledge/context/HallucinationSuppressor'

const logger = loggerService.withContext('ContextIntelligenceIpcHandler')

/**
 * 净化请求参数
 */
interface PurifyRequest {
  content: string
  config?: Partial<PurifierConfig>
}

/**
 * 幻觉抑制请求参数
 */
interface SuppressRequest {
  text: string
  context?: {
    conversationHistory?: string[]
    knowledgeBase?: KnowledgeReference[]
    userQuery?: string
  }
  config?: Partial<SuppressorConfig>
}

/**
 * 注册 Context Intelligence IPC 处理器
 */
export function registerContextIntelligenceIpcHandlers(): void {
  logger.info('Registering Context Intelligence IPC handlers')

  // ====================
  // Context Purifier
  // ====================

  // 净化上下文
  ipcMain.handle(IpcChannel.Context_Purify, async (_event, request: PurifyRequest): Promise<PurifyResult> => {
    try {
      logger.debug('Purify request received', { contentLength: request.content.length })

      // 如果提供了配置，创建新实例；否则使用单例
      const purifier = request.config ? createContextPurifier(request.config) : getContextPurifier()

      const result = purifier.purify(request.content)

      logger.info('Purification complete', {
        originalLength: result.originalLength,
        purifiedLength: result.purifiedLength,
        modificationsCount: result.modifications.length
      })

      return result
    } catch (error) {
      logger.error('Purification failed', error as Error)
      throw error
    }
  })

  // 获取净化器配置
  ipcMain.handle(IpcChannel.Context_Purify_GetConfig, async (): Promise<Required<PurifierConfig>> => {
    try {
      const purifier = getContextPurifier()
      return purifier.getConfig()
    } catch (error) {
      logger.error('Failed to get purifier config', error as Error)
      throw error
    }
  })

  // 更新净化器配置
  ipcMain.handle(
    IpcChannel.Context_Purify_UpdateConfig,
    async (_event, config: Partial<PurifierConfig>): Promise<void> => {
      try {
        const purifier = getContextPurifier()
        purifier.updateConfig(config)
        logger.info('Purifier config updated', { keys: Object.keys(config) })
      } catch (error) {
        logger.error('Failed to update purifier config', error as Error)
        throw error
      }
    }
  )

  // ====================
  // Hallucination Suppressor
  // ====================

  // 抑制幻觉
  ipcMain.handle(
    IpcChannel.Context_Hallucination_Suppress,
    async (_event, request: SuppressRequest): Promise<SuppressionResult> => {
      try {
        logger.debug('Suppression request received', { textLength: request.text.length })

        // 如果提供了配置，创建新实例；否则使用单例
        const suppressor = request.config ? createHallucinationSuppressor(request.config) : getHallucinationSuppressor()

        const result = await suppressor.suppress(request.text, request.context)

        logger.info('Suppression complete', {
          detectionsCount: result.detections.length,
          overallConfidence: result.overallConfidence,
          wasModified: result.wasModified
        })

        return result
      } catch (error) {
        logger.error('Suppression failed', error as Error)
        throw error
      }
    }
  )

  // 获取抑制器配置
  ipcMain.handle(IpcChannel.Context_Hallucination_GetConfig, async (): Promise<Required<SuppressorConfig>> => {
    try {
      const suppressor = getHallucinationSuppressor()
      return suppressor.getConfig()
    } catch (error) {
      logger.error('Failed to get suppressor config', error as Error)
      throw error
    }
  })

  // 更新抑制器配置
  ipcMain.handle(
    IpcChannel.Context_Hallucination_UpdateConfig,
    async (_event, config: Partial<SuppressorConfig>): Promise<void> => {
      try {
        const suppressor = getHallucinationSuppressor()
        suppressor.updateConfig(config)
        logger.info('Suppressor config updated', { keys: Object.keys(config) })
      } catch (error) {
        logger.error('Failed to update suppressor config', error as Error)
        throw error
      }
    }
  )

  logger.info('Context Intelligence IPC handlers registered')
}
