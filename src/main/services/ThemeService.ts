import { IpcChannel } from '@shared/IpcChannel'
import { ThemeMode } from '@types'

import { titleBarOverlayDark, titleBarOverlayLight } from '../config'
import { configManager } from './ConfigManager'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronNativeTheme: typeof import('electron').nativeTheme | undefined
let electronBrowserWindow: typeof import('electron').BrowserWindow | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron')
  electronNativeTheme = electron.nativeTheme
  electronBrowserWindow = electron.BrowserWindow
} catch {
  // electron 未就绪
}

class ThemeService {
  private theme: ThemeMode = ThemeMode.system
  constructor() {
    this.theme = configManager.getTheme()

    if (!electronNativeTheme) {
      return
    }

    if (this.theme === ThemeMode.dark || this.theme === ThemeMode.light || this.theme === ThemeMode.system) {
      electronNativeTheme.themeSource = this.theme
    } else {
      // 兼容旧版本
      configManager.setTheme(ThemeMode.system)
      electronNativeTheme.themeSource = ThemeMode.system
    }
    electronNativeTheme.on('updated', this.themeUpdatadHandler.bind(this))
  }

  themeUpdatadHandler() {
    if (!electronBrowserWindow || !electronNativeTheme) return

    electronBrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed() && win.setTitleBarOverlay) {
        try {
          win.setTitleBarOverlay(electronNativeTheme!.shouldUseDarkColors ? titleBarOverlayDark : titleBarOverlayLight)
        } catch (error) {
          // don't throw error if setTitleBarOverlay failed
          // Because it may be called with some windows have some title bar
        }
      }
      win.webContents.send(
        IpcChannel.ThemeUpdated,
        electronNativeTheme!.shouldUseDarkColors ? ThemeMode.dark : ThemeMode.light
      )
    })
  }

  setTheme(theme: ThemeMode) {
    if (theme === this.theme) {
      return
    }

    this.theme = theme
    if (electronNativeTheme) {
      electronNativeTheme.themeSource = theme
    }
    configManager.setTheme(theme)
  }
}

export const themeService = new ThemeService()
