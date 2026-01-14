/**
 * App IPC Handlers
 * 应用程序相关的 IPC 处理器
 *
 * 包含: 应用信息、代理设置、语言、主题、更新、缓存等
 */

import fs from 'node:fs'
import { arch } from 'node:os'
import path from 'node:path'

import { loggerService } from '@logger'
import { isLinux, isMac, isPortable, isWin } from '@main/constant'
import { handleZoomFactor } from '@main/utils/zoom'
import type { UpgradeChannel } from '@shared/config/constant'
import { IpcChannel } from '@shared/IpcChannel'
import type { Notification, ThemeMode } from '@types'
import checkDiskSpace from 'check-disk-space'
import type { ProxyConfig } from 'electron'
import { BrowserWindow, dialog, ipcMain, session, shell, systemPreferences, webContents } from 'electron'
import fontList from 'font-list'

import { configManager } from '../services/ConfigManager'
import { fileStorage as fileManager } from '../services/FileStorage'
import type NotificationService from '../services/NotificationService'
import powerMonitorService from '../services/PowerMonitorService'
import { proxyManager } from '../services/ProxyManager'
import appService from '../services/AppService'
import type AppUpdater from '../services/AppUpdater'
import { themeService } from '../services/ThemeService'
import { windowService } from '../services/WindowService'
import { calculateDirectorySize, getResourcePath } from '../utils'
import {
  getCacheDir,
  getConfigDir,
  getFilesDir,
  getNotesDir,
  hasWritePermission,
  isPathInside,
  untildify
} from '../utils/file'
import { updateAppDataConfig } from '../utils/init'

const logger = loggerService.withContext('AppIpc')

export interface AppIpcContext {
  mainWindow: BrowserWindow
  app: Electron.App
  appUpdater: AppUpdater
  notificationService: NotificationService
}

let preventQuitListener: ((event: Electron.Event) => void) | null = null

export function registerAppIpcHandlers(context: AppIpcContext) {
  const { mainWindow, app, appUpdater, notificationService } = context

  // Register shutdown handlers
  powerMonitorService.registerShutdownHandler(() => {
    appUpdater.setAutoUpdate(false)
  })

  powerMonitorService.registerShutdownHandler(() => {
    const mw = windowService.getMainWindow()
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send(IpcChannel.App_SaveData)
    }
  })

  // App Info
  ipcMain.handle(IpcChannel.App_Info, () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    filesPath: getFilesDir(),
    notesPath: getNotesDir(),
    configPath: getConfigDir(),
    appDataPath: app.getPath('userData'),
    resourcesPath: getResourcePath(),
    logsPath: logger.getLogsDir(),
    arch: arch(),
    isPortable: isWin && 'PORTABLE_EXECUTABLE_DIR' in process.env,
    installPath: path.dirname(app.getPath('exe'))
  }))

  // Proxy
  ipcMain.handle(IpcChannel.App_Proxy, async (_, proxy: string, bypassRules?: string) => {
    let proxyConfig: ProxyConfig

    if (proxy === 'system') {
      proxyConfig = { mode: 'system' }
    } else if (proxy) {
      proxyConfig = { mode: 'fixed_servers', proxyRules: proxy, proxyBypassRules: bypassRules }
    } else {
      proxyConfig = { mode: 'direct' }
    }

    await proxyManager.configureProxy(proxyConfig)
  })

  // Basic app controls
  ipcMain.handle(IpcChannel.App_Reload, () => mainWindow.reload())
  ipcMain.handle(IpcChannel.App_Quit, () => app.quit())
  ipcMain.handle(IpcChannel.Open_Website, (_, url: string) => shell.openExternal(url))

  // Update
  ipcMain.handle(IpcChannel.App_QuitAndInstall, () => appUpdater.quitAndInstall())
  ipcMain.handle(IpcChannel.App_CheckForUpdate, async () => {
    return await appUpdater.checkForUpdates()
  })

  // Language
  ipcMain.handle(IpcChannel.App_SetLanguage, (_, language) => {
    configManager.setLanguage(language)
  })

  // Spell check
  ipcMain.handle(IpcChannel.App_SetEnableSpellCheck, (_, isEnable: boolean) => {
    const webviews = webContents.getAllWebContents()
    webviews.forEach((webview) => {
      webview.session.setSpellCheckerEnabled(isEnable)
    })
  })

  ipcMain.handle(IpcChannel.App_SetSpellCheckLanguages, (_, languages: string[]) => {
    if (languages.length === 0) {
      return
    }
    const windows = BrowserWindow.getAllWindows()
    windows.forEach((window) => {
      window.webContents.session.setSpellCheckerLanguages(languages)
    })
    configManager.set('spellCheckLanguages', languages)
  })

  // Launch settings
  ipcMain.handle(IpcChannel.App_SetLaunchOnBoot, (_, isLaunchOnBoot: boolean) => {
    appService.setAppLaunchOnBoot(isLaunchOnBoot)
  })

  ipcMain.handle(IpcChannel.App_SetLaunchToTray, (_, isActive: boolean) => {
    configManager.setLaunchToTray(isActive)
  })

  ipcMain.handle(IpcChannel.App_SetTray, (_, isActive: boolean) => {
    configManager.setTray(isActive)
  })

  ipcMain.handle(IpcChannel.App_SetTrayOnClose, (_, isActive: boolean) => {
    configManager.setTrayOnClose(isActive)
  })

  // Auto update settings
  ipcMain.handle(IpcChannel.App_SetAutoUpdate, (_, isActive: boolean) => {
    appUpdater.setAutoUpdate(isActive)
    configManager.setAutoUpdate(isActive)
  })

  ipcMain.handle(IpcChannel.App_SetTestPlan, async (_, isActive: boolean) => {
    logger.info(`set test plan: ${isActive}`)
    if (isActive !== configManager.getTestPlan()) {
      appUpdater.cancelDownload()
      configManager.setTestPlan(isActive)
    }
  })

  ipcMain.handle(IpcChannel.App_SetTestChannel, async (_, channel: UpgradeChannel) => {
    logger.info(`set test channel: ${channel}`)
    if (channel !== configManager.getTestChannel()) {
      appUpdater.cancelDownload()
      configManager.setTestChannel(channel)
    }
  })

  // Mac specific
  if (isMac) {
    ipcMain.handle(IpcChannel.App_MacIsProcessTrusted, (): boolean => {
      return systemPreferences.isTrustedAccessibilityClient(false)
    })

    ipcMain.handle(IpcChannel.App_MacRequestProcessTrust, (): boolean => {
      return systemPreferences.isTrustedAccessibilityClient(true)
    })
  }

  // Full screen
  ipcMain.handle(IpcChannel.App_SetFullScreen, (_, value: boolean): void => {
    mainWindow.setFullScreen(value)
  })

  ipcMain.handle(IpcChannel.App_IsFullScreen, (): boolean => {
    return mainWindow.isFullScreen()
  })

  // System Fonts
  ipcMain.handle(IpcChannel.App_GetSystemFonts, async () => {
    try {
      const fonts = await fontList.getFonts()
      return fonts.map((font: string) => font.replace(/^"(.*)"$/, '$1')).filter((font: string) => font.length > 0)
    } catch (error) {
      logger.error('Failed to get system fonts:', error as Error)
      return []
    }
  })

  // Theme
  ipcMain.handle(IpcChannel.App_SetTheme, (_, theme: ThemeMode) => {
    themeService.setTheme(theme)
  })

  // Zoom
  ipcMain.handle(IpcChannel.App_HandleZoomFactor, (_, delta: number, reset: boolean = false) => {
    const windows = BrowserWindow.getAllWindows()
    handleZoomFactor(windows, delta, reset)
    return configManager.getZoomFactor()
  })

  // Clear cache
  ipcMain.handle(IpcChannel.App_ClearCache, async () => {
    const sessions = [session.defaultSession, session.fromPartition('persist:webview')]

    try {
      await Promise.all(
        sessions.map(async (sess) => {
          await sess.clearCache()
          await sess.clearStorageData({
            storages: ['cookies', 'filesystem', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
          })
        })
      )
      await fileManager.clearTemp()
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to clear cache:', error)
      return { success: false, error: error.message }
    }
  })

  // Get cache size
  ipcMain.handle(IpcChannel.App_GetCacheSize, async () => {
    const cachePath = getCacheDir()
    logger.info(`Calculating cache size for path: ${cachePath}`)

    try {
      const sizeInBytes = await calculateDirectorySize(cachePath)
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)
      return `${sizeInMB}`
    } catch (error: any) {
      logger.error(`Failed to calculate cache size for ${cachePath}: ${error.message}`)
      return '0'
    }
  })

  // Stop quit app
  ipcMain.handle(IpcChannel.App_SetStopQuitApp, (_, stop: boolean = false, reason: string = '') => {
    if (stop) {
      if (!preventQuitListener) {
        preventQuitListener = (event: Electron.Event) => {
          event.preventDefault()
          notificationService.sendNotification({
            title: reason,
            message: reason
          } as Notification)
        }
        app.on('before-quit', preventQuitListener)
      }
    } else {
      if (preventQuitListener) {
        app.removeListener('before-quit', preventQuitListener)
        preventQuitListener = null
      }
    }
  })

  // Select app data path
  ipcMain.handle(IpcChannel.App_Select, async (_, options: Electron.OpenDialogOptions) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(options)
      if (canceled || filePaths.length === 0) {
        return null
      }
      return filePaths[0]
    } catch (error: any) {
      logger.error('Failed to select app data path:', error)
      return null
    }
  })

  // Path operations
  ipcMain.handle(IpcChannel.App_HasWritePermission, async (_, filePath: string) => {
    return await hasWritePermission(filePath)
  })

  ipcMain.handle(IpcChannel.App_ResolvePath, async (_, filePath: string) => {
    return path.resolve(untildify(filePath))
  })

  ipcMain.handle(IpcChannel.App_IsPathInside, async (_, childPath: string, parentPath: string) => {
    return isPathInside(childPath, parentPath)
  })

  // Set app data path
  ipcMain.handle(IpcChannel.App_SetAppDataPath, async (_, filePath: string) => {
    updateAppDataConfig(filePath)
    app.setPath('userData', filePath)
  })

  ipcMain.handle(IpcChannel.App_GetDataPathFromArgs, () => {
    return process.argv
      .slice(1)
      .find((arg) => arg.startsWith('--new-data-path='))
      ?.split('--new-data-path=')[1]
  })

  ipcMain.handle(IpcChannel.App_FlushAppData, () => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.session.flushStorageData()
      w.webContents.session.cookies.flushStore()
      w.webContents.session.closeAllConnections()
    })

    session.defaultSession.flushStorageData()
    session.defaultSession.cookies.flushStore()
    session.defaultSession.closeAllConnections()
  })

  ipcMain.handle(IpcChannel.App_IsNotEmptyDir, async (_, dirPath: string) => {
    return fs.readdirSync(dirPath).length > 0
  })

  // Copy user data
  ipcMain.handle(IpcChannel.App_Copy, async (_, oldPath: string, newPath: string, occupiedDirs: string[] = []) => {
    try {
      await fs.promises.cp(oldPath, newPath, {
        recursive: true,
        filter: (src) => {
          if (occupiedDirs.some((dir) => src.startsWith(path.resolve(dir)))) {
            return false
          }
          return true
        }
      })
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to copy user data:', error)
      return { success: false, error: error.message }
    }
  })

  // Relaunch app
  ipcMain.handle(IpcChannel.App_RelaunchApp, (_, options?: Electron.RelaunchOptions) => {
    if (isLinux && process.env.APPIMAGE) {
      logger.info(`Relaunching app with options: ${process.env.APPIMAGE}`, options)
      options = options || {}
      options.execPath = process.env.APPIMAGE
      options.args = options.args || []
      options.args.unshift('--appimage-extract-and-run')
    }

    if (isWin && isPortable) {
      options = options || {}
      options.execPath = process.env.PORTABLE_EXECUTABLE_FILE
      options.args = options.args || []
    }

    app.relaunch(options)
    app.exit(0)
  })

  // Disk info
  ipcMain.handle(IpcChannel.App_GetDiskInfo, async (_, directoryPath: string) => {
    try {
      const diskSpace = await checkDiskSpace(directoryPath)
      logger.debug('disk space', diskSpace)
      const { free, size } = diskSpace
      return { free, size }
    } catch (error) {
      logger.error('check disk space error', error as Error)
      return null
    }
  })

  // Hardware acceleration
  ipcMain.handle(IpcChannel.App_SetDisableHardwareAcceleration, (_, isDisable: boolean) => {
    configManager.setDisableHardwareAcceleration(isDisable)
  })

  // Quote to main
  ipcMain.handle(IpcChannel.App_QuoteToMain, (_, text: string) => windowService.quoteToMainWindow(text))

  // Crash renderer (for testing)
  ipcMain.handle(IpcChannel.APP_CrashRenderProcess, () => {
    mainWindow.webContents.forcefullyCrashRenderer()
  })

  logger.info('App IPC handlers registered successfully')
}
