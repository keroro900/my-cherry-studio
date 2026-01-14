/**
 * IPC Module Entry Point
 * IPC 模块入口
 *
 * 模块化组织的 IPC 处理器
 * 参考 VCPChat 的模块化模式，将原有的 1500+ 行 ipc.ts 拆分为独立模块
 */

import type { BrowserWindow } from 'electron'

import { loggerService } from '@logger'

import AppUpdater from '../services/AppUpdater'
import NotificationService from '../services/NotificationService'
import { registerAppIpcHandlers, type AppIpcContext } from './appIpc'
import { registerBackupIpcHandlers } from './backupIpc'
import { registerFileIpcHandlers } from './fileIpc'
import { registerGitIpcHandlers } from './gitIpc'
import { registerMcpIpcHandlers } from './mcpIpc'
import { registerTerminalIpcHandlers } from './terminalIpc'
import { registerMemoryIpcHandlers } from './memoryIpc'
import { registerMiscIpcHandlers } from './miscIpc'
import { registerTraceIpcHandlers } from './traceIpc'
import { registerWindowIpcHandlers } from './windowIpc'
import { registerStickerIpcHandlers } from './stickerIpc'
import { registerPluginVariableIpcHandlers } from '../services/vcp/PluginVariableRegistry'

const logger = loggerService.withContext('IpcIndex')

/**
 * Register all modular IPC handlers
 * 注册所有模块化的 IPC 处理器
 */
export function registerModularIpcHandlers(mainWindow: BrowserWindow, app: Electron.App) {
  const registrationResults: { module: string; success: boolean; error?: Error }[] = []

  // Create shared services
  const appUpdater = new AppUpdater()
  const notificationService = new NotificationService()

  // App IPC handlers (requires context)
  try {
    const appContext: AppIpcContext = { mainWindow, app, appUpdater, notificationService }
    registerAppIpcHandlers(appContext)
    registrationResults.push({ module: 'app', success: true })
  } catch (error) {
    logger.error('Failed to register App IPC handlers', error as Error)
    registrationResults.push({ module: 'app', success: false, error: error as Error })
  }

  // Backup IPC handlers
  try {
    registerBackupIpcHandlers()
    registrationResults.push({ module: 'backup', success: true })
  } catch (error) {
    logger.error('Failed to register Backup IPC handlers', error as Error)
    registrationResults.push({ module: 'backup', success: false, error: error as Error })
  }

  // File IPC handlers
  try {
    registerFileIpcHandlers()
    registrationResults.push({ module: 'file', success: true })
  } catch (error) {
    logger.error('Failed to register File IPC handlers', error as Error)
    registrationResults.push({ module: 'file', success: false, error: error as Error })
  }

  // Memory IPC handlers
  try {
    registerMemoryIpcHandlers()
    registrationResults.push({ module: 'memory', success: true })
  } catch (error) {
    logger.error('Failed to register Memory IPC handlers', error as Error)
    registrationResults.push({ module: 'memory', success: false, error: error as Error })
  }

  // Window IPC handlers
  try {
    registerWindowIpcHandlers(mainWindow)
    registrationResults.push({ module: 'window', success: true })
  } catch (error) {
    logger.error('Failed to register Window IPC handlers', error as Error)
    registrationResults.push({ module: 'window', success: false, error: error as Error })
  }

  // MCP IPC handlers
  try {
    registerMcpIpcHandlers()
    registrationResults.push({ module: 'mcp', success: true })
  } catch (error) {
    logger.error('Failed to register MCP IPC handlers', error as Error)
    registrationResults.push({ module: 'mcp', success: false, error: error as Error })
  }

  // Trace IPC handlers
  try {
    registerTraceIpcHandlers()
    registrationResults.push({ module: 'trace', success: true })
  } catch (error) {
    logger.error('Failed to register Trace IPC handlers', error as Error)
    registrationResults.push({ module: 'trace', success: false, error: error as Error })
  }

  // Misc IPC handlers
  try {
    registerMiscIpcHandlers(mainWindow)
    registrationResults.push({ module: 'misc', success: true })
  } catch (error) {
    logger.error('Failed to register Misc IPC handlers', error as Error)
    registrationResults.push({ module: 'misc', success: false, error: error as Error })
  }

  // Git IPC handlers
  try {
    registerGitIpcHandlers()
    registrationResults.push({ module: 'git', success: true })
  } catch (error) {
    logger.error('Failed to register Git IPC handlers', error as Error)
    registrationResults.push({ module: 'git', success: false, error: error as Error })
  }

  // Terminal IPC handlers
  try {
    registerTerminalIpcHandlers()
    registrationResults.push({ module: 'terminal', success: true })
  } catch (error) {
    logger.error('Failed to register Terminal IPC handlers', error as Error)
    registrationResults.push({ module: 'terminal', success: false, error: error as Error })
  }

  // Sticker IPC handlers
  try {
    registerStickerIpcHandlers()
    registrationResults.push({ module: 'sticker', success: true })
  } catch (error) {
    logger.error('Failed to register Sticker IPC handlers', error as Error)
    registrationResults.push({ module: 'sticker', success: false, error: error as Error })
  }

  // Plugin Variable IPC handlers
  try {
    registerPluginVariableIpcHandlers()
    registrationResults.push({ module: 'plugin-variable', success: true })
  } catch (error) {
    logger.error('Failed to register Plugin Variable IPC handlers', error as Error)
    registrationResults.push({ module: 'plugin-variable', success: false, error: error as Error })
  }

  // Log summary
  const successCount = registrationResults.filter((r) => r.success).length
  const failCount = registrationResults.filter((r) => !r.success).length

  if (failCount === 0) {
    logger.info('All modular IPC handlers registered successfully', {
      modules: registrationResults.map((r) => r.module)
    })
  } else {
    logger.warn('Some modular IPC handlers failed to register', {
      success: successCount,
      failed: failCount,
      failedModules: registrationResults.filter((r) => !r.success).map((r) => r.module)
    })
  }

  return {
    success: failCount === 0,
    registrationResults
  }
}

// Re-export individual handlers for granular control
export { registerAppIpcHandlers } from './appIpc'
export { registerBackupIpcHandlers } from './backupIpc'
export { registerFileIpcHandlers } from './fileIpc'
export { registerGitIpcHandlers } from './gitIpc'
export { registerMcpIpcHandlers } from './mcpIpc'
export { registerMemoryIpcHandlers } from './memoryIpc'
export { registerMiscIpcHandlers } from './miscIpc'
export { registerTerminalIpcHandlers } from './terminalIpc'
export { registerTraceIpcHandlers } from './traceIpc'
export { registerWindowIpcHandlers } from './windowIpc'
export { registerStickerIpcHandlers } from './stickerIpc'
export { registerPluginVariableIpcHandlers } from '../services/vcp/PluginVariableRegistry'
