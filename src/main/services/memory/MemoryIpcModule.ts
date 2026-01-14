/**
 * Memory IPC Module - 统一记忆系统 IPC 处理器注册入口
 *
 * 整合分散的记忆系统 IPC 处理器，提供单一注册入口
 *
 * ## 清理说明 (2026-01-09)
 *
 * 已移除以下废弃模块：
 * - AdvancedMemoryIpcHandler → 功能已整合到 IntegratedMemoryCoordinator
 * - UnifiedMemoryIpcHandler → 功能已整合到 IntegratedMemoryCoordinator
 * - AIMemoIpcHandler → 功能已整合到 IntegratedMemoryCoordinator
 * - MemoryMasterIpcHandler → 功能已整合到 IntegratedMemoryCoordinator
 * - SelfLearningIpcHandler → 功能已整合到 IntegratedMemoryCoordinator
 * - DeprecatedMemoryIpcCompat → 兼容层已移除，前端已迁移到新API
 *
 * 保留的模块：
 * - IntegratedMemoryIpcHandler - 统一记忆协调器入口
 * - MemoryBrainIpcHandler - 记忆大脑 (神经重排/WaveRAG)
 */

import { loggerService } from '@logger'

// 核心 IPC 处理器
import { registerIntegratedMemoryIpcHandlers } from './IntegratedMemoryIpcHandler'
import { registerMemoryBrainIpcHandlers } from './MemoryBrainIpcHandler'

const logger = loggerService.withContext('MemoryIpcModule')

/**
 * Memory IPC 模块注册结果
 */
export interface MemoryIpcRegistrationResult {
  success: boolean
  registeredModules: string[]
  failedModules: { name: string; error: string }[]
}

/**
 * 统一注册所有记忆系统 IPC 处理器
 *
 * 优点:
 * 1. 单一入口点 - 简化 ipc.ts 调用
 * 2. 统一错误处理 - 某个模块失败不影响其他模块
 * 3. 注册结果报告 - 清晰了解哪些模块成功/失败
 */
export function registerAllMemoryIpcHandlers(): MemoryIpcRegistrationResult {
  const result: MemoryIpcRegistrationResult = {
    success: true,
    registeredModules: [],
    failedModules: []
  }

  // 核心模块
  const modules = [
    { name: 'IntegratedMemory', register: registerIntegratedMemoryIpcHandlers },
    { name: 'MemoryBrain', register: registerMemoryBrainIpcHandlers }
  ]

  logger.info('Starting unified Memory IPC registration...', { moduleCount: modules.length })

  for (const module of modules) {
    try {
      logger.debug(`Attempting to register ${module.name} IPC handlers...`)
      module.register()
      result.registeredModules.push(module.name)
      logger.info(`${module.name} IPC handlers registered successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      result.failedModules.push({ name: module.name, error: errorMessage })
      logger.error(`Failed to register ${module.name} IPC handlers`, {
        error: errorMessage,
        stack: errorStack
      })
    }
  }

  result.success = result.failedModules.length === 0

  if (result.success) {
    logger.info('All Memory IPC handlers registered successfully', {
      count: result.registeredModules.length,
      modules: result.registeredModules
    })
  } else {
    logger.warn('Some Memory IPC handlers failed to register', {
      registered: result.registeredModules.length,
      failed: result.failedModules.length,
      failedModules: result.failedModules
    })
  }

  return result
}

/**
 * 获取 Memory IPC 模块状态
 */
export function getMemoryIpcModuleInfo(): {
  modules: string[]
  description: string
} {
  return {
    modules: [
      'IntegratedMemory - 统一记忆协调器 (整合 LightMemo/DeepMemo/MeshMemo/MemoryMaster/SelfLearning)',
      'MemoryBrain - 记忆大脑 (神经重排/WaveRAG/追踪)'
    ],
    description: '统一记忆系统 IPC 模块 (已清理废弃模块)'
  }
}
