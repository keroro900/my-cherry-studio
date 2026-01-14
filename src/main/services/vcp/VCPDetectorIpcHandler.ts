/**
 * VCPDetectorIpcHandler - VCP 检测器系统 IPC 处理器
 *
 * 处理渲染进程发来的检测器管理请求：
 * - DetectorX 规则管理（系统提示词转化）
 * - SuperDetectorX 规则管理（全局上下文转化）
 * - 规则导入/导出（config.env 格式）
 * - 规则测试和统计
 */

import { loggerService } from '@main/services/LoggerService'
import { ipcMain } from 'electron'

import {
  vcpDetectorService,
  type DetectorRule,
  type DetectorConfig
} from './VCPDetectorService'

const logger = loggerService.withContext('VCPDetectorIpcHandler')

/**
 * 注册检测器 IPC 处理器
 */
export function registerVCPDetectorIpcHandlers(): void {
  logger.info('Registering VCP Detector IPC handlers')

  // ==================== 规则列表 ====================

  /**
   * 获取所有规则
   */
  ipcMain.handle('vcp:detector:getAllRules', async () => {
    try {
      const rules = vcpDetectorService.getAllRules()
      return { success: true, ...rules }
    } catch (error) {
      logger.error('Failed to get all rules', error as Error)
      return { success: false, error: String(error), detector: [], superDetector: [] }
    }
  })

  // ==================== 规则 CRUD ====================

  /**
   * 添加规则
   */
  ipcMain.handle(
    'vcp:detector:addRule',
    async (
      _event,
      rule: Omit<DetectorRule, 'id' | 'hitCount' | 'createdAt' | 'updatedAt'>
    ) => {
      try {
        const newRule = await vcpDetectorService.addRule(rule)
        return { success: true, rule: newRule }
      } catch (error) {
        logger.error('Failed to add rule', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 更新规则
   */
  ipcMain.handle(
    'vcp:detector:updateRule',
    async (_event, data: { id: string } & Partial<DetectorRule>) => {
      try {
        const { id, ...updates } = data
        const rule = await vcpDetectorService.updateRule(id, updates)
        if (!rule) {
          return { success: false, error: 'Rule not found' }
        }
        return { success: true, rule }
      } catch (error) {
        logger.error('Failed to update rule', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 删除规则
   */
  ipcMain.handle('vcp:detector:deleteRule', async (_event, id: string) => {
    try {
      const deleted = await vcpDetectorService.deleteRule(id)
      return { success: deleted, error: deleted ? undefined : 'Rule not found' }
    } catch (error) {
      logger.error('Failed to delete rule', error as Error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * 启用/禁用规则
   */
  ipcMain.handle(
    'vcp:detector:toggleRule',
    async (_event, data: { id: string; enabled: boolean }) => {
      try {
        const success = await vcpDetectorService.toggleRule(data.id, data.enabled)
        return { success, error: success ? undefined : 'Rule not found' }
      } catch (error) {
        logger.error('Failed to toggle rule', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 重置为预设规则
   */
  ipcMain.handle('vcp:detector:resetToPresets', async () => {
    try {
      await vcpDetectorService.resetToPresets()
      return { success: true }
    } catch (error) {
      logger.error('Failed to reset to presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  ipcMain.handle('vcp:detector:getConfig', async () => {
    try {
      const config = vcpDetectorService.getConfig()
      return { success: true, config }
    } catch (error) {
      logger.error('Failed to get config', error as Error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * 更新配置
   */
  ipcMain.handle(
    'vcp:detector:updateConfig',
    async (_event, updates: Partial<DetectorConfig>) => {
      try {
        await vcpDetectorService.updateConfig(updates)
        return { success: true }
      } catch (error) {
        logger.error('Failed to update config', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  ipcMain.handle('vcp:detector:getStats', async () => {
    try {
      const stats = vcpDetectorService.getStats()
      return { success: true, stats }
    } catch (error) {
      logger.error('Failed to get stats', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== 导入/导出 ====================

  /**
   * 从 config.env 格式导入规则
   */
  ipcMain.handle('vcp:detector:importFromEnv', async (_event, envContent: string) => {
    try {
      const result = await vcpDetectorService.importFromEnv(envContent)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to import from env', error as Error)
      return { success: false, error: String(error), imported: 0, errors: [] }
    }
  })

  /**
   * 导出为 config.env 格式
   */
  ipcMain.handle('vcp:detector:exportToEnv', async () => {
    try {
      const envContent = vcpDetectorService.exportToEnv()
      return { success: true, content: envContent }
    } catch (error) {
      logger.error('Failed to export to env', error as Error)
      return { success: false, error: String(error), content: '' }
    }
  })

  // ==================== 测试功能 ====================

  /**
   * 测试 DetectorX 转化
   */
  ipcMain.handle(
    'vcp:detector:testDetectorX',
    async (_event, data: { text: string; modelId?: string }) => {
      try {
        const result = vcpDetectorService.applyDetectorX(data.text, data.modelId)
        return { success: true, result }
      } catch (error) {
        logger.error('Failed to test DetectorX', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 测试 SuperDetectorX 转化
   */
  ipcMain.handle(
    'vcp:detector:testSuperDetectorX',
    async (_event, data: { text: string; modelId?: string }) => {
      try {
        const result = vcpDetectorService.applySuperDetectorX(data.text, data.modelId)
        return { success: true, result }
      } catch (error) {
        logger.error('Failed to test SuperDetectorX', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 测试完整转化流程（DetectorX + SuperDetectorX）
   */
  ipcMain.handle(
    'vcp:detector:testFull',
    async (_event, data: { text: string; modelId?: string; isSystemPrompt?: boolean }) => {
      try {
        let result = data.text
        const transformResults: Array<{
          type: 'detector' | 'super_detector'
          result: ReturnType<typeof vcpDetectorService.applyDetectorX>
        }> = []

        // 如果是系统提示词，先应用 DetectorX
        if (data.isSystemPrompt) {
          const detectorResult = vcpDetectorService.applyDetectorX(result, data.modelId)
          result = detectorResult.text
          transformResults.push({ type: 'detector', result: detectorResult })
        }

        // 应用 SuperDetectorX
        const superResult = vcpDetectorService.applySuperDetectorX(result, data.modelId)
        result = superResult.text
        transformResults.push({ type: 'super_detector', result: superResult })

        return {
          success: true,
          originalText: data.text,
          transformedText: result,
          transformResults
        }
      } catch (error) {
        logger.error('Failed to test full transformation', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  logger.info('VCP Detector IPC handlers registered', {
    channels: [
      'vcp:detector:getAllRules',
      'vcp:detector:addRule',
      'vcp:detector:updateRule',
      'vcp:detector:deleteRule',
      'vcp:detector:toggleRule',
      'vcp:detector:resetToPresets',
      'vcp:detector:getConfig',
      'vcp:detector:updateConfig',
      'vcp:detector:getStats',
      'vcp:detector:importFromEnv',
      'vcp:detector:exportToEnv',
      'vcp:detector:testDetectorX',
      'vcp:detector:testSuperDetectorX',
      'vcp:detector:testFull'
    ]
  })
}
