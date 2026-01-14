/**
 * VCP IPC Module - 统一 VCP IPC 处理器注册入口
 *
 * 整合分散的 VCP IPC 处理器，提供单一注册入口
 * 解决原有 7+ 文件分散注册的碎片化问题
 */

import { loggerService } from '@logger'

// 导入各个 VCP IPC 处理器
import { registerVCPIpcHandlers } from '../VCPIpcHandler'
import { registerExternalPluginIpcHandlers } from './ExternalPluginIpcHandler'
import { registerVCPDetectorIpcHandlers } from './VCPDetectorIpcHandler'
import { registerVCPInfoLogIpcHandlers } from './VCPInfoLogIpcHandler'
import { registerVCPPluginIpcHandlers } from './VCPPluginIpcHandler'
import { registerVCPPluginWindowIpcHandlers } from './VCPPluginWindowService'
import { registerVCPTemplateIpcHandlers } from './VCPTemplateIpcHandler'
import { registerVCPVariableIpcHandlers } from './VCPVariableIpcHandler'

const logger = loggerService.withContext('VCPIpcModule')

/**
 * VCP IPC 模块注册结果
 */
export interface VCPIpcRegistrationResult {
  success: boolean
  registeredModules: string[]
  failedModules: { name: string; error: string }[]
}

/**
 * 统一注册所有 VCP IPC 处理器
 *
 * 优点:
 * 1. 单一入口点 - 简化 ipc.ts 调用
 * 2. 统一错误处理 - 某个模块失败不影响其他模块
 * 3. 注册结果报告 - 清晰了解哪些模块成功/失败
 */
export function registerAllVCPIpcHandlers(): VCPIpcRegistrationResult {
  const result: VCPIpcRegistrationResult = {
    success: true,
    registeredModules: [],
    failedModules: []
  }

  const modules = [
    { name: 'VCPCore', register: registerVCPIpcHandlers },
    { name: 'VCPInfoLog', register: registerVCPInfoLogIpcHandlers },
    { name: 'VCPPlugin', register: registerVCPPluginIpcHandlers },
    { name: 'VCPPluginWindow', register: registerVCPPluginWindowIpcHandlers },
    { name: 'VCPVariable', register: registerVCPVariableIpcHandlers },
    { name: 'VCPTemplate', register: registerVCPTemplateIpcHandlers },
    { name: 'VCPDetector', register: registerVCPDetectorIpcHandlers },
    { name: 'ExternalPlugin', register: registerExternalPluginIpcHandlers }
  ]

  logger.info('Starting unified VCP IPC registration...', { moduleCount: modules.length })

  for (const module of modules) {
    try {
      module.register()
      result.registeredModules.push(module.name)
      logger.debug(`${module.name} IPC handlers registered`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.failedModules.push({ name: module.name, error: errorMessage })
      logger.error(`Failed to register ${module.name} IPC handlers`, { error: errorMessage })
    }
  }

  result.success = result.failedModules.length === 0

  if (result.success) {
    logger.info('All VCP IPC handlers registered successfully', {
      count: result.registeredModules.length
    })
  } else {
    logger.warn('Some VCP IPC handlers failed to register', {
      registered: result.registeredModules.length,
      failed: result.failedModules.length
    })
  }

  return result
}

/**
 * 获取 VCP IPC 模块状态
 */
export function getVCPIpcModuleInfo(): {
  modules: string[]
  description: string
} {
  return {
    modules: [
      'VCPCore - Agent, Search, Context, Diary 核心操作',
      'VCPInfoLog - VCPInfo/VCPLog 信息显示',
      'VCPPlugin - 插件管理和执行',
      'VCPPluginWindow - 插件窗口管理',
      'VCPVariable - 变量编辑器操作',
      'VCPTemplate - 模板管理操作',
      'VCPDetector - DetectorX/SuperDetectorX 规则管理',
      'ExternalPlugin - 外部插件安装/卸载/配置 (Phase 4.1)'
    ],
    description: '统一 VCP IPC 模块，整合 8 个分散的处理器文件'
  }
}
