/**
 * VCP 插件窗口服务
 *
 * 提供独立的 VCP 插件管理窗口
 */

import { loggerService } from '@logger'
import { isDev } from '@main/constant'
import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import * as path from 'path'

import { ConfigKeys, configManager } from '../ConfigManager'

const logger = loggerService.withContext('VCPPluginWindowService')

let vcpPluginWindow: BrowserWindow | null = null

/**
 * 打开 VCP 插件管理窗口
 */
export function openVCPPluginWindow() {
  // 如果窗口已存在，聚焦
  if (vcpPluginWindow && !vcpPluginWindow.isDestroyed()) {
    vcpPluginWindow.focus()
    return
  }

  logger.info('Opening VCP Plugin Window')

  vcpPluginWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    closable: true,
    focusable: true,
    movable: true,
    hasShadow: true,
    roundedCorners: true,
    maximizable: true,
    minimizable: true,
    resizable: true,
    title: 'VCP 插件管理',
    frame: true,
    titleBarOverlay: nativeTheme.shouldUseDarkColors
      ? { color: '#1f1f1f', symbolColor: '#ffffff', height: 40 }
      : { color: '#ffffff', symbolColor: '#000000', height: 40 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141414' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev ? true : false
    }
  })

  // 加载页面
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    vcpPluginWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/vcpPluginWindow.html')
  } else {
    vcpPluginWindow.loadFile(path.join(__dirname, '../renderer/vcpPluginWindow.html'))
  }

  // 窗口关闭事件
  vcpPluginWindow.on('closed', () => {
    configManager.unsubscribe(ConfigKeys.Language, setLanguageCallback)
    configManager.unsubscribe(ConfigKeys.Theme, setThemeCallback)
    try {
      vcpPluginWindow?.destroy()
    } finally {
      vcpPluginWindow = null
    }
  })

  // 加载完成后发送初始数据
  vcpPluginWindow.webContents.on('did-finish-load', () => {
    vcpPluginWindow!.webContents.send('set-language', {
      lang: configManager.get(ConfigKeys.Language)
    })
    vcpPluginWindow!.webContents.send('set-theme', {
      isDark: nativeTheme.shouldUseDarkColors
    })

    // 订阅语言和主题变化
    configManager.subscribe(ConfigKeys.Language, setLanguageCallback)
    configManager.subscribe(ConfigKeys.Theme, setThemeCallback)
  })

  logger.info('VCP Plugin Window opened')
}

/**
 * 关闭 VCP 插件管理窗口
 */
export function closeVCPPluginWindow() {
  if (vcpPluginWindow && !vcpPluginWindow.isDestroyed()) {
    vcpPluginWindow.close()
  }
}

/**
 * 获取 VCP 插件窗口实例
 */
export function getVCPPluginWindow(): BrowserWindow | null {
  return vcpPluginWindow
}

// 语言变化回调
const setLanguageCallback = (lang: string) => {
  if (vcpPluginWindow && !vcpPluginWindow.isDestroyed()) {
    vcpPluginWindow.webContents.send('set-language', { lang })
  }
}

// 主题变化回调
const setThemeCallback = () => {
  if (vcpPluginWindow && !vcpPluginWindow.isDestroyed()) {
    vcpPluginWindow.webContents.send('set-theme', {
      isDark: nativeTheme.shouldUseDarkColors
    })
  }
}

/**
 * 注册 VCP 插件窗口 IPC 处理器
 */
export function registerVCPPluginWindowIpcHandlers() {
  ipcMain.handle('vcp:openPluginWindow', () => {
    openVCPPluginWindow()
    return { success: true }
  })

  ipcMain.handle('vcp:closePluginWindow', () => {
    closeVCPPluginWindow()
    return { success: true }
  })

  logger.info('VCP Plugin Window IPC handlers registered')
}
