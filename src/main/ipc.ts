/**
 * IPC Entry Point
 * IPC 入口点
 *
 * 此文件现在作为 IPC 注册的入口点，负责：
 * 1. 调用模块化的 IPC 处理器 (src/main/ipc/)
 * 2. 注册外部模块的 IPC 处理器 (VCP, Tavern, Memory, etc.)
 * 3. 设置窗口事件监听器
 *
 * 模块化重构说明：
 * - 原有 1500+ 行的 ipc.ts 已拆分为 8 个独立模块
 * - 每个模块负责一个功能域的 IPC 处理器
 * - 参考 VCPChat 的模块化 IPC 模式
 */

import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { registerModularIpcHandlers } from './ipc/index'
import { registerAgentInvokeIpcHandlers } from './services/AgentInvokeIpcHandler'
import { apiServerService } from './services/ApiServerService'
import AppUpdater from './services/AppUpdater'
import { registerCanvasIpcHandlers } from './services/CanvasIpcHandler'
import { registerContextIntelligenceIpcHandlers } from './services/ContextIntelligenceIpcHandler'
import { registerFlowLockIpcHandlers } from './services/FlowLockIpcHandler'
import { registerGroupChatIpcHandlers } from './services/GroupChatIpcHandler'
import { registerAllMemoryIpcHandlers } from './services/memory/MemoryIpcModule'
import powerMonitorService from './services/PowerMonitorService'
import { SelectionService } from './services/SelectionService'
import storeSyncService from './services/StoreSyncService'
import { initializeTavernModule, registerTavernIpcHandlers } from './services/tavern'
import { registerAllVCPIpcHandlers } from './services/vcp'
import { getVCPCallbackServer } from './services/VCPCallbackServer'
import { registerWebSocketIpcHandlers } from './services/WebSocketIpcHandler'
import { windowService } from './services/WindowService'
import { registerUnifiedKnowledgeIpcHandlers } from './knowledge/unified'
import { registerQualityIpcHandlers } from './services/quality/QualityIpcHandler'
import { registerTimeParserIpcHandlers } from './ipc/timeParserIpc'
import { registerSemanticGroupIpcHandlers } from './ipc/semanticGroupIpc'
import { registerVCPForumIpcHandlers } from './services/VCPForumIpcHandler'
import { registerNativeVCPIpcHandlers } from './services/NativeVCPIpcHandler'

const logger = loggerService.withContext('IPC')

export function registerIpc(mainWindow: BrowserWindow, app: Electron.App) {
  const appUpdater = new AppUpdater()

  // ============================================================
  // 1. Register shutdown handlers for power monitor
  // ============================================================
  powerMonitorService.registerShutdownHandler(() => {
    appUpdater.setAutoUpdate(false)
  })

  powerMonitorService.registerShutdownHandler(() => {
    const mw = windowService.getMainWindow()
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send(IpcChannel.App_SaveData)
    }
  })

  // ============================================================
  // 2. Register modular IPC handlers (core modules)
  // ============================================================
  const modularResult = registerModularIpcHandlers(mainWindow, app)
  if (!modularResult.success) {
    logger.warn('Some modular IPC handlers failed to register', {
      results: modularResult.registrationResults
    })
  }

  // ============================================================
  // 3. Register window event handlers
  // ============================================================
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(IpcChannel.Windows_MaximizedChanged, true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(IpcChannel.Windows_MaximizedChanged, false)
  })

  // ============================================================
  // 4. Register service-level IPC handlers
  // ============================================================
  storeSyncService.registerIpcHandler()
  SelectionService.registerIpcHandler()
  apiServerService.registerIpcHandlers()

  // ============================================================
  // 5. Register VCP IPC handlers (统一模块)
  // ============================================================
  try {
    logger.info('Starting unified VCP IPC handler registration...')
    const vcpResult = registerAllVCPIpcHandlers()
    if (vcpResult.success) {
      logger.info('All VCP IPC handlers registered successfully', {
        modules: vcpResult.registeredModules
      })
    } else {
      logger.warn('Some VCP IPC handlers failed to register', {
        registered: vcpResult.registeredModules,
        failed: vcpResult.failedModules
      })
    }

    // 自动初始化 VCPRuntime
    const { getVCPRuntime } = require('./services/vcp')
    const vcpRuntime = getVCPRuntime()
    vcpRuntime
      .initialize()
      .then(() => {
        logger.info('VCPRuntime auto-initialized successfully (unified protocol ready)')
      })
      .catch((error: Error) => {
        logger.error('Failed to auto-initialize VCPRuntime', error)
      })
  } catch (error) {
    logger.error('Failed to register VCP IPC handlers', error as Error)
  }

  // ============================================================
  // 5.1 Register VCP Forum direct IPC handlers
  // ============================================================
  try {
    logger.info('Starting VCP Forum IPC handler registration...')
    registerVCPForumIpcHandlers()
    logger.info('VCP Forum IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register VCP Forum IPC handlers', error as Error)
  }

  // ============================================================
  // 5.2 Register Native VCP IPC handlers (Rust 原生模块)
  // ============================================================
  try {
    logger.info('Starting Native VCP IPC handler registration...')
    registerNativeVCPIpcHandlers()
    logger.info('Native VCP IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Native VCP IPC handlers', error as Error)
  }

  // ============================================================
  // 6. Register Tavern IPC handlers (VCPTavern Native)
  // ============================================================
  try {
    logger.info('Starting Tavern IPC handler registration...')
    registerTavernIpcHandlers()
    logger.info('Tavern IPC handlers registered successfully')
    initializeTavernModule()
      .then(() => {
        logger.info('Tavern module services initialized successfully')
      })
      .catch((error) => {
        logger.error('Failed to initialize Tavern module services', error as Error)
      })
  } catch (error) {
    logger.error('Failed to register Tavern IPC handlers', error as Error)
  }

  // ============================================================
  // 7. Register All Memory IPC handlers (统一注册，同步加载避免竞态条件)
  // ============================================================
  try {
    logger.info('Starting unified Memory IPC handler registration...')
    const memoryResult = registerAllMemoryIpcHandlers()
    if (memoryResult.success) {
      logger.info('All Memory IPC handlers registered successfully', {
        modules: memoryResult.registeredModules
      })
    } else {
      logger.warn('Some Memory IPC handlers failed', {
        failed: memoryResult.failedModules
      })
    }
  } catch (error) {
    logger.error('Failed to register Memory IPC handlers', error as Error)
  }

  // ============================================================
  // 8. Register other async-loaded IPC handlers (改为同步以避免竞态)
  // ============================================================

  // DailyNoteWrite IPC handlers
  import('./services/notes/DailyNoteWriteIpcHandler')
    .then(({ registerDailyNoteWriteIpcHandlers }) => {
      logger.info('Starting DailyNoteWrite IPC handler registration...')
      registerDailyNoteWriteIpcHandlers()
      logger.info('DailyNoteWrite IPC handlers registered successfully')
    })
    .catch((error) => {
      logger.error('Failed to register DailyNoteWrite IPC handlers', error as Error)
    })

  // Knowledge File Watcher IPC handlers
  import('./services/KnowledgeWatcherIpcHandler')
    .then(({ registerKnowledgeWatcherIpcHandlers }) => {
      logger.info('Starting Knowledge Watcher IPC handler registration...')
      registerKnowledgeWatcherIpcHandlers()
      logger.info('Knowledge Watcher IPC handlers registered successfully')
    })
    .catch((error) => {
      logger.error('Failed to register Knowledge Watcher IPC handlers', error as Error)
    })

  // FsShell IPC handlers
  import('./services/FsShellIpcHandler')
    .then(({ initFsShellIpcHandler }) => {
      logger.info('Starting FsShell IPC handler registration...')
      initFsShellIpcHandler()
      logger.info('FsShell IPC handlers registered successfully')
    })
    .catch((error) => {
      logger.error('Failed to register FsShell IPC handlers', error as Error)
    })

  // ============================================================
  // 9. Register sync-loaded external IPC handlers
  // ============================================================

  // Context Intelligence IPC handlers
  try {
    logger.info('Starting Context Intelligence IPC handler registration...')
    registerContextIntelligenceIpcHandlers()
    logger.info('Context Intelligence IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Context Intelligence IPC handlers', error as Error)
  }

  // GroupChat IPC handlers
  try {
    logger.info('Starting GroupChat IPC handler registration...')
    registerGroupChatIpcHandlers()
    logger.info('GroupChat IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register GroupChat IPC handlers', error as Error)
  }

  // FlowLock IPC handlers
  try {
    logger.info('Starting FlowLock IPC handler registration...')
    registerFlowLockIpcHandlers()
    logger.info('FlowLock IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register FlowLock IPC handlers', error as Error)
  }

  // Agent Invoke IPC handlers
  try {
    logger.info('Starting Agent Invoke IPC handler registration...')
    registerAgentInvokeIpcHandlers()
    logger.info('Agent Invoke IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Agent Invoke IPC handlers', error as Error)
  }

  // WebSocket IPC handlers
  try {
    logger.info('Starting WebSocket IPC handler registration...')
    registerWebSocketIpcHandlers()
    logger.info('WebSocket IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register WebSocket IPC handlers', error as Error)
  }

  // Canvas IPC handlers
  try {
    logger.info('Starting Canvas IPC handler registration...')
    registerCanvasIpcHandlers(mainWindow)
    logger.info('Canvas IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Canvas IPC handlers', error as Error)
  }

  // Unified Knowledge IPC handlers
  try {
    logger.info('Starting Unified Knowledge IPC handler registration...')
    registerUnifiedKnowledgeIpcHandlers()
    logger.info('Unified Knowledge IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Unified Knowledge IPC handlers', error as Error)
  }

  // Quality Guardian IPC handlers
  try {
    logger.info('Starting Quality Guardian IPC handler registration...')
    registerQualityIpcHandlers()
    logger.info('Quality Guardian IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register Quality Guardian IPC handlers', error as Error)
  }

  // TimeExpressionParser IPC handlers
  try {
    logger.info('Starting TimeExpressionParser IPC handler registration...')
    registerTimeParserIpcHandlers()
    logger.info('TimeExpressionParser IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register TimeExpressionParser IPC handlers', error as Error)
  }

  // SemanticGroupService IPC handlers
  try {
    logger.info('Starting SemanticGroupService IPC handler registration...')
    registerSemanticGroupIpcHandlers()
    logger.info('SemanticGroupService IPC handlers registered successfully')
  } catch (error) {
    logger.error('Failed to register SemanticGroupService IPC handlers', error as Error)
  }

  // ============================================================
  // 10. Initialize VCP Callback Server
  // ============================================================
  try {
    logger.info('Starting VCP Callback Server...')
    const callbackServer = getVCPCallbackServer()
    callbackServer.registerIpcHandlers()
    callbackServer
      .start()
      .then((port) => {
        logger.info('VCP Callback Server started successfully', { port })
      })
      .catch((error) => {
        logger.error('Failed to start VCP Callback Server', error as Error)
      })
  } catch (error) {
    logger.error('Failed to initialize VCP Callback Server', error as Error)
  }

  // ============================================================
  // 11. Additional standalone handlers
  // ============================================================
  ipcMain.handle(IpcChannel.APP_CrashRenderProcess, () => {
    mainWindow.webContents.forcefullyCrashRenderer()
  })

  logger.info('All IPC handlers registration completed')
}
