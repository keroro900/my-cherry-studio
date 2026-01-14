/**
 * Quality Guardian IPC Handler
 *
 * 为渲染进程提供质量守护服务的 IPC 接口
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { safeHandle } from '../ipc/IpcHandlerFactory'
import { getOptimizationEngine } from './OptimizationEngine'
import { getQualityCore, initializeQualityCore } from './QualityCore'
import type { OptimizationRequest, QualityContentType, QualityEvaluationRequest } from './types'

const logger = loggerService.withContext('QualityIpcHandler')

/**
 * 注册 Quality Guardian IPC handlers
 */
export function registerQualityIpcHandlers(): void {
  logger.info('Registering Quality Guardian IPC handlers...')

  // ==================== 质量评估 ====================

  // 评估内容质量
  ipcMain.handle(IpcChannel.Quality_Evaluate, async (_event, request: QualityEvaluationRequest) => {
    return safeHandle('quality:evaluate', async () => {
      const core = getQualityCore()
      const metrics = await core.evaluate(request)
      return { success: true, metrics }
    })
  })

  // ==================== 优化 ====================

  // 优化内容
  ipcMain.handle(IpcChannel.Quality_Optimize, async (_event, request: OptimizationRequest) => {
    return safeHandle('quality:optimize', async () => {
      const engine = getOptimizationEngine()
      const result = await engine.optimize(request)
      return {
        success: result.success,
        optimizedContent: result.optimizedContent,
        improvements: result.improvements,
        changes: result.changes,
        requiresUserApproval: result.requiresUserApproval,
        iterations: result.iterations,
        error: result.error
      }
    })
  })

  // 优化提示词（专用接口）
  ipcMain.handle(
    IpcChannel.Quality_Optimize + ':prompt',
    async (
      _event,
      params: {
        prompt: string
        targetType: 'image_generation' | 'text_generation' | 'code_generation'
        context?: Record<string, unknown>
      }
    ) => {
      return safeHandle('quality:optimizePrompt', async () => {
        const engine = getOptimizationEngine()
        const optimized = await engine.optimizePrompt(params.prompt, params.targetType, params.context)
        return { success: true, optimizedPrompt: optimized }
      })
    }
  )

  // ==================== 历史记录 ====================

  // 获取质量历史
  ipcMain.handle(IpcChannel.Quality_GetHistory, async (_event, params: { contentId: string }) => {
    return safeHandle('quality:getHistory', async () => {
      const core = getQualityCore()
      const history = await core.getHistory(params.contentId)
      return { success: true, history }
    })
  })

  // 获取优化历史
  ipcMain.handle(IpcChannel.Quality_GetHistory + ':optimization', async (_event, params: { contentId: string }) => {
    return safeHandle('quality:getOptimizationHistory', async () => {
      const engine = getOptimizationEngine()
      const history = engine.getOptimizationHistory(params.contentId)
      return { success: true, history }
    })
  })

  // ==================== 自动修复 ====================

  // 应用自动修复
  ipcMain.handle(IpcChannel.Quality_ApplyFix, async (_event, params: { fixId: string; approve?: boolean }) => {
    return safeHandle('quality:applyFix', async () => {
      const engine = getOptimizationEngine()

      if (params.approve !== undefined) {
        // 处理审批响应
        engine.handleApprovalResponse(params.fixId, params.approve)
        return {
          success: true,
          message: params.approve ? '修复已批准' : '修复已拒绝',
          fixId: params.fixId
        }
      }

      // 获取待审批列表
      const pending = engine.getPendingApprovals()
      return {
        success: true,
        pendingApprovals: pending
      }
    })
  })

  // ==================== 对比 ====================

  // 对比两个内容的质量
  ipcMain.handle(
    IpcChannel.Quality_Compare,
    async (
      _event,
      params: {
        content1: string
        content2: string
        contentType: QualityContentType
      }
    ) => {
      return safeHandle('quality:compare', async () => {
        const core = getQualityCore()

        const [metrics1, metrics2] = await Promise.all([
          core.evaluate({ contentType: params.contentType, content: params.content1 }),
          core.evaluate({ contentType: params.contentType, content: params.content2 })
        ])

        const diff = metrics2.overallScore - metrics1.overallScore
        const winner = diff > 0 ? 'content2' : diff < 0 ? 'content1' : 'tie'

        return {
          success: true,
          content1: metrics1,
          content2: metrics2,
          difference: diff,
          winner
        }
      })
    }
  )

  // ==================== 检查器信息 ====================

  // 获取可用的检查器
  ipcMain.handle(IpcChannel.Quality_GetCheckers, async () => {
    return safeHandle('quality:getCheckers', () => {
      const core = getQualityCore()
      const checkers = core.getRegisteredCheckers()
      return {
        success: true,
        checkers: checkers.map((c) => ({
          contentType: c.contentType,
          name: c.name,
          supportedChecks: c.getSupportedChecks()
        }))
      }
    })
  })

  // ==================== 统计信息 ====================

  // 获取统计信息
  ipcMain.handle(IpcChannel.Quality_GetCheckers + ':stats', async () => {
    return safeHandle('quality:getStats', () => {
      const core = getQualityCore()
      const engine = getOptimizationEngine()
      return {
        success: true,
        core: core.getStats(),
        optimization: engine.getStats()
      }
    })
  })

  // ==================== 初始化 ====================

  // 初始化质量服务
  ipcMain.handle(IpcChannel.Quality_Initialize, async () => {
    return safeHandle('quality:initialize', async () => {
      await initializeQualityCore()
      // OptimizationEngine 使用单例模式，自动初始化
      getOptimizationEngine()
      return { success: true, message: 'Quality Guardian initialized' }
    })
  })

  logger.info('Quality Guardian IPC handlers registered')
}
