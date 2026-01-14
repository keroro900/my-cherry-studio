/**
 * Window IPC Handlers
 * 窗口控制相关的 IPC 处理器
 *
 * 包含: 窗口大小、最大化/最小化、MiniWindow 等
 */

import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from '@shared/config/constant'
import { loggerService } from '@logger'
import { windowService } from '../services/WindowService'

const logger = loggerService.withContext('WindowIpc')

export function registerWindowIpcHandlers(mainWindow: BrowserWindow) {
  const checkMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window does not exist or has been destroyed')
    }
  }

  // Window size
  ipcMain.handle(IpcChannel.Windows_SetMinimumSize, (_, width: number, height: number) => {
    checkMainWindow()
    mainWindow.setMinimumSize(width, height)
  })

  ipcMain.handle(IpcChannel.Windows_ResetMinimumSize, () => {
    checkMainWindow()
    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
    const [width, height] = mainWindow.getSize() ?? [MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT]
    if (width < MIN_WINDOW_WIDTH) {
      mainWindow.setSize(MIN_WINDOW_WIDTH, height)
    }
  })

  ipcMain.handle(IpcChannel.Windows_GetSize, () => {
    checkMainWindow()
    const [width, height] = mainWindow.getSize() ?? [MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT]
    return [width, height]
  })

  // Window controls
  ipcMain.handle(IpcChannel.Windows_Minimize, () => {
    checkMainWindow()
    mainWindow.minimize()
  })

  ipcMain.handle(IpcChannel.Windows_Maximize, () => {
    checkMainWindow()
    mainWindow.maximize()
  })

  ipcMain.handle(IpcChannel.Windows_Unmaximize, () => {
    checkMainWindow()
    mainWindow.unmaximize()
  })

  ipcMain.handle(IpcChannel.Windows_Close, () => {
    checkMainWindow()
    mainWindow.close()
  })

  ipcMain.handle(IpcChannel.Windows_IsMaximized, () => {
    checkMainWindow()
    return mainWindow.isMaximized()
  })

  // Send maximized state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(IpcChannel.Windows_MaximizedChanged, true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(IpcChannel.Windows_MaximizedChanged, false)
  })

  // Mini window
  ipcMain.handle(IpcChannel.MiniWindow_Show, () => windowService.showMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Hide, () => windowService.hideMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Close, () => windowService.closeMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Toggle, () => windowService.toggleMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_SetPin, (_, isPinned) => windowService.setPinMiniWindow(isPinned))

  logger.info('Window IPC handlers registered successfully')
}
