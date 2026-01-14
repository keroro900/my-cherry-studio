// don't reorder this file, it's used to initialize the app data dir and
// other which should be run before the main process is ready
// eslint-disable-next-line
import './bootstrap'

import '@main/config'

import { loggerService } from '@logger'
import { replaceDevtoolsFont } from '@main/utils/windowUtil'
import { isDev, isLinux, isWin } from './constant'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
let electronCrashReporter: typeof import('electron').crashReporter | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron')
  electronApp = electron.app
  electronCrashReporter = electron.crashReporter
} catch {
  // electron 未就绪
}

import process from 'node:process'

import { registerIpc } from './ipc'
import { agentService } from './services/agents'
import { apiServerService } from './services/ApiServerService'
import { appMenuService } from './services/AppMenuService'
import { configManager } from './services/ConfigManager'
import { lanTransferClientService } from './services/lanTransfer'
import mcpService from './services/MCPService'
import { localTransferService } from './services/LocalTransferService'
import { nodeTraceService } from './services/NodeTraceService'
import powerMonitorService from './services/PowerMonitorService'
import {
  CHERRY_STUDIO_PROTOCOL,
  handleProtocolUrl,
  registerProtocolClient,
  setupAppImageDeepLink
} from './services/ProtocolClient'
import selectionService, { initSelectionService } from './services/SelectionService'
import { registerShortcuts } from './services/ShortcutService'
import { TrayService } from './services/TrayService'
import { versionService } from './services/VersionService'
import { windowService } from './services/WindowService'
import { initWebviewHotkeys } from './services/WebviewService'
import { getUnifiedStorage } from './storage'
import { runAsyncFunction } from './utils'
import { isOvmsSupported } from './services/OvmsManager'
import { preloadNativeModules } from './knowledge/native'

const logger = loggerService.withContext('MainEntry')

// enable local crash reports
if (electronCrashReporter) {
  electronCrashReporter.start({
    companyName: 'CherryHQ',
    productName: 'CherryStudio',
    submitURL: '',
    uploadToServer: false
  })
}

/**
 * Disable hardware acceleration if setting is enabled
 */
const disableHardwareAcceleration = configManager.getDisableHardwareAcceleration()
if (disableHardwareAcceleration && electronApp) {
  electronApp.disableHardwareAcceleration()
}

/**
 * Disable chromium's window animations
 * main purpose for this is to avoid the transparent window flashing when it is shown
 * (especially on Windows for SelectionAssistant Toolbar)
 * Know Issue: https://github.com/electron/electron/issues/12130#issuecomment-627198990
 */
if (isWin && electronApp) {
  electronApp.commandLine.appendSwitch('wm-window-animations-disabled')
}

/**
 * Enable GlobalShortcutsPortal for Linux Wayland Protocol
 * see: https://www.electronjs.org/docs/latest/api/global-shortcut
 */
if (isLinux && process.env.XDG_SESSION_TYPE === 'wayland' && electronApp) {
  electronApp.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
}

// DocumentPolicyIncludeJSCallStacksInCrashReports: Enable features for unresponsive renderer js call stacks
// EarlyEstablishGpuChannel,EstablishGpuChannelAsync: Enable features for early establish gpu channel
// speed up the startup time
// https://github.com/microsoft/vscode/pull/241640/files
if (electronApp) {
  electronApp.commandLine.appendSwitch(
    'enable-features',
    'DocumentPolicyIncludeJSCallStacksInCrashReports,EarlyEstablishGpuChannel,EstablishGpuChannelAsync'
  )
  electronApp.on('web-contents-created', (_, webContents) => {
    webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Document-Policy': ['include-js-call-stacks-in-crash-reports']
        }
      })
    })

    webContents.on('unresponsive', async () => {
      // Interrupt execution and collect call stack from unresponsive renderer
      logger.error('Renderer unresponsive start')
      const callStack = await webContents.mainFrame.collectJavaScriptCallStack()
      logger.error(`Renderer unresponsive js call stack\n ${callStack}`)
    })
  })
}

// in production mode, handle uncaught exception and unhandled rejection globally
if (!isDev) {
  // handle uncaught exception
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error)
  })

  // handle unhandled rejection
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`)
  })
}

// Check for single instance lock
if (!electronApp || !electronApp.requestSingleInstanceLock()) {
  electronApp?.quit()
  process.exit(0)
} else {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.

  electronApp.whenReady().then(async () => {
    // Record current version for tracking
    // A preparation for v2 data refactoring
    versionService.recordCurrentVersion()

    initWebviewHotkeys()
    // Set app user model id for windows
    electronApp!.setAppUserModelId(import.meta.env.VITE_MAIN_BUNDLE_ID || 'com.kangfenmao.CherryStudio')

    // Mac: Hide dock icon before window creation when launch to tray is set
    const isLaunchToTray = configManager.getLaunchToTray()
    if (isLaunchToTray) {
      electronApp!.dock?.hide()
    }

    const mainWindow = windowService.createMainWindow()
    new TrayService()

    // Setup macOS application menu
    appMenuService?.setupApplicationMenu()

    nodeTraceService.init()
    powerMonitorService.init()

    // 🚀 预加载原生模块 (Rust 层)
    // 确保 TagMemo 等服务使用 Rust 实现而非 TypeScript fallback
    try {
      const nativeStatus = await preloadNativeModules()
      if (nativeStatus.loaded) {
        logger.info('✅ Native modules preloaded', {
          features: nativeStatus.features,
          loadTime: nativeStatus.loadTime + 'ms',
          version: nativeStatus.version
        })
      } else {
        logger.warn('⚠️ Native modules not available, using TypeScript fallback', {
          error: nativeStatus.error
        })
      }
    } catch (nativeError: any) {
      logger.warn('Native module preload failed (non-critical):', nativeError)
    }

    // 初始化统一存储核心 (Phase 6)
    runAsyncFunction(async () => {
      try {
        const unifiedStorage = getUnifiedStorage()
        await unifiedStorage.initialize({
          vectorDimensions: 1536,
          enableTagMemo: true
        })
        logger.info('UnifiedStorageCore initialized successfully')
      } catch (error: any) {
        logger.warn('Failed to initialize UnifiedStorageCore:', error)
      }
    })

    electronApp!.on('activate', function () {
      const mainWindow = windowService.getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) {
        windowService.createMainWindow()
      } else {
        windowService.showMainWindow()
      }
    })

    registerShortcuts(mainWindow)

    await registerIpc(mainWindow, electronApp!)
    localTransferService.startDiscovery({ resetList: true })

    replaceDevtoolsFont(mainWindow)

    // Setup deep link for AppImage on Linux
    await setupAppImageDeepLink()

    if (isDev) {
      // 延迟导入 electron-devtools-installer 以避免模块加载时 electron 未初始化
      import('electron-devtools-installer')
        .then(({ default: installExtension, REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS }) => {
          installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS])
            .then((name) => logger.info(`Added Extension:  ${name}`))
            .catch((err) => logger.error('An error occurred: ', err))
        })
        .catch((err) => logger.warn('Failed to load devtools installer:', err))
    }

    //start selection assistant service
    initSelectionService()

    runAsyncFunction(async () => {
      // Start API server if enabled or if agents exist
      try {
        const config = await apiServerService.getCurrentConfig()
        logger.info('API server config:', config)

        // Check if there are any agents
        let shouldStart = config.enabled
        if (!shouldStart) {
          try {
            const { total } = await agentService.listAgents({ limit: 1 })
            if (total > 0) {
              shouldStart = true
              logger.info(`Detected ${total} agent(s), auto-starting API server`)
            }
          } catch (error: any) {
            logger.warn('Failed to check agent count:', error)
          }
        }

        if (shouldStart) {
          await apiServerService.start()
        }
      } catch (error: any) {
        logger.error('Failed to check/start API server:', error)
      }
    })
  })

  registerProtocolClient(electronApp!)

  // macOS specific: handle protocol when app is already running

  electronApp!.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  const handleOpenUrl = (args: string[]) => {
    const url = args.find((arg) => arg.startsWith(CHERRY_STUDIO_PROTOCOL + '://'))
    if (url) handleProtocolUrl(url)
  }

  // for windows to start with url
  handleOpenUrl(process.argv)

  // Listen for second instance
  electronApp!.on('second-instance', (_event, argv) => {
    windowService.showMainWindow()

    // Protocol handler for Windows/Linux
    // The commandLine is an array of strings where the last item might be the URL
    handleOpenUrl(argv)
  })

  electronApp!.on('browser-window-created', async (_, window) => {
    // 延迟导入以避免模块加载时 electron.app 未定义的问题
    const { optimizer } = await import('@electron-toolkit/utils')
    optimizer.watchWindowShortcuts(window)
  })

  electronApp!.on('before-quit', () => {
    ;(electronApp as any).isQuitting = true

    // quit selection service
    if (selectionService) {
      selectionService.quit()
    }

    lanTransferClientService.dispose()
    localTransferService.dispose()
  })

  electronApp!.on('will-quit', async () => {
    // 简单的资源清理，不阻塞退出流程
    if (isOvmsSupported) {
      const { ovmsManager } = await import('./services/OvmsManager')
      if (ovmsManager) {
        await ovmsManager.stopOvms()
      } else {
        logger.warn('Unexpected behavior: undefined ovmsManager, but OVMS should be supported.')
      }
    }

    try {
      await mcpService.cleanup()
      await apiServerService.stop()
    } catch (error) {
      logger.warn('Error cleaning up MCP service:', error as Error)
    }

    // 保存 TagMemo 共现矩阵
    try {
      const { getTagMemoService } = await import('./knowledge/tagmemo')
      const tagMemoService = getTagMemoService()
      if ('forceSave' in tagMemoService) {
        await (tagMemoService as { forceSave: () => Promise<void> }).forceSave()
      }
    } catch (error) {
      logger.warn('Error saving TagMemo:', error as Error)
    }

    // 关闭统一存储核心
    try {
      const { getUnifiedStorage } = await import('./storage')
      const unifiedStorage = getUnifiedStorage()
      await unifiedStorage.close()
      logger.info('UnifiedStorageCore closed successfully')
    } catch (error) {
      logger.warn('Error closing UnifiedStorageCore:', error as Error)
    }

    // finish the logger
    logger.finish()
  })

  // In this file you can include the rest of your app"s specific main process
  // code. You can also put them in separate files and require them here.
}
