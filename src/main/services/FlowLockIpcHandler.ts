/**
 * FlowLock IPC Handler
 *
 * 处理 FlowLock 和 AutoContinue 相关的 IPC 调用
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { type AutoContinueSession, getAutoContinueService } from '../knowledge/flow/AutoContinueService'
import {
  type DeviationResult,
  type FlowLock,
  getFlowLockService,
  type LockReason,
  type TopicContext
} from '../knowledge/flow/FlowLockService'

const logger = loggerService.withContext('FlowLockIpcHandler')

export function registerFlowLockIpcHandlers(): void {
  const flowLockService = getFlowLockService()

  // 创建锁
  ipcMain.handle(
    IpcChannel.FlowLock_Create,
    async (
      _event,
      params: {
        sessionId: string
        topicContext: TopicContext
        reason: LockReason
        options?: {
          timeout?: number
          deviationThreshold?: number
          maxDeviations?: number
        }
      }
    ): Promise<FlowLock> => {
      logger.debug('FlowLock_Create', { sessionId: params.sessionId, topic: params.topicContext.topicName })
      return flowLockService.createLock(params.sessionId, params.topicContext, params.reason, params.options)
    }
  )

  // 获取锁
  ipcMain.handle(IpcChannel.FlowLock_Get, async (_event, sessionId: string): Promise<FlowLock | undefined> => {
    return flowLockService.getLock(sessionId)
  })

  // 解锁
  ipcMain.handle(
    IpcChannel.FlowLock_Unlock,
    async (_event, params: { sessionId: string; reason?: string }): Promise<boolean> => {
      logger.debug('FlowLock_Unlock', params)
      return flowLockService.unlock(params.sessionId, params.reason)
    }
  )

  // 延长锁定时间
  ipcMain.handle(
    IpcChannel.FlowLock_Extend,
    async (_event, params: { sessionId: string; additionalTime: number }): Promise<boolean> => {
      logger.debug('FlowLock_Extend', params)
      return flowLockService.extendLock(params.sessionId, params.additionalTime)
    }
  )

  // 检测偏离
  ipcMain.handle(
    IpcChannel.FlowLock_DetectDeviation,
    async (_event, params: { sessionId: string; content: string }): Promise<DeviationResult> => {
      return flowLockService.detectDeviation(params.sessionId, params.content)
    }
  )

  // 检测是否应该触发锁定
  ipcMain.handle(
    IpcChannel.FlowLock_ShouldTriggerLock,
    async (
      _event,
      content: string
    ): Promise<{
      shouldLock: boolean
      confidence: number
      suggestedTopic?: string
    }> => {
      return flowLockService.shouldTriggerLock(content)
    }
  )

  // 检测是否应该解锁
  ipcMain.handle(IpcChannel.FlowLock_ShouldTriggerUnlock, async (_event, content: string): Promise<boolean> => {
    return flowLockService.shouldTriggerUnlock(content)
  })

  // 获取所有活跃的锁
  ipcMain.handle(IpcChannel.FlowLock_GetActiveLocks, async (): Promise<FlowLock[]> => {
    return flowLockService.getActiveLocks()
  })

  // 更新话题上下文
  ipcMain.handle(
    IpcChannel.FlowLock_UpdateContext,
    async (_event, params: { sessionId: string; updates: Partial<TopicContext> }): Promise<boolean> => {
      logger.debug('FlowLock_UpdateContext', { sessionId: params.sessionId })
      return flowLockService.updateTopicContext(params.sessionId, params.updates)
    }
  )

  logger.info('FlowLock IPC handlers registered')

  // ==================== AutoContinue IPC Handlers ====================

  const autoContinueService = getAutoContinueService()

  // 启动自动续写
  ipcMain.handle(
    IpcChannel.AutoContinue_Start,
    async (
      _event,
      params: {
        agentId: string
        topicId: string
        options?: {
          customPrompt?: string
          maxRetries?: number
          maxContinues?: number
          continueDelay?: number
          startImmediately?: boolean
        }
      }
    ): Promise<AutoContinueSession> => {
      logger.debug('AutoContinue_Start', { agentId: params.agentId, topicId: params.topicId })
      return autoContinueService.start(params.agentId, params.topicId, params.options)
    }
  )

  // 停止自动续写
  ipcMain.handle(
    IpcChannel.AutoContinue_Stop,
    async (_event, params: { sessionId: string; reason?: string }): Promise<boolean> => {
      logger.debug('AutoContinue_Stop', params)
      return autoContinueService.stop(params.sessionId, params.reason)
    }
  )

  // 暂停自动续写
  ipcMain.handle(IpcChannel.AutoContinue_Pause, async (_event, sessionId: string): Promise<boolean> => {
    logger.debug('AutoContinue_Pause', { sessionId })
    return autoContinueService.pause(sessionId)
  })

  // 恢复自动续写
  ipcMain.handle(IpcChannel.AutoContinue_Resume, async (_event, sessionId: string): Promise<boolean> => {
    logger.debug('AutoContinue_Resume', { sessionId })
    return autoContinueService.resume(sessionId)
  })

  // 获取会话
  ipcMain.handle(
    IpcChannel.AutoContinue_GetSession,
    async (_event, sessionId: string): Promise<AutoContinueSession | undefined> => {
      return autoContinueService.getSession(sessionId)
    }
  )

  // 获取所有活动会话
  ipcMain.handle(IpcChannel.AutoContinue_GetActiveSessions, async (): Promise<AutoContinueSession[]> => {
    return autoContinueService.getActiveSessions()
  })

  // 消息完成回调
  ipcMain.handle(
    IpcChannel.AutoContinue_OnMessageComplete,
    async (_event, params: { agentId: string; topicId: string }): Promise<void> => {
      logger.debug('AutoContinue_OnMessageComplete', params)
      autoContinueService.onMessageComplete(params.agentId, params.topicId)
    }
  )

  // 设置自定义提示词
  ipcMain.handle(
    IpcChannel.AutoContinue_SetCustomPrompt,
    async (_event, params: { sessionId: string; prompt: string | undefined }): Promise<boolean> => {
      logger.debug('AutoContinue_SetCustomPrompt', { sessionId: params.sessionId })
      return autoContinueService.setCustomPrompt(params.sessionId, params.prompt)
    }
  )

  // 检查是否处于活动状态
  ipcMain.handle(
    IpcChannel.AutoContinue_IsActive,
    async (_event, params: { agentId: string; topicId: string }): Promise<boolean> => {
      return autoContinueService.isActive(params.agentId, params.topicId)
    }
  )

  logger.info('AutoContinue IPC handlers registered')
}
