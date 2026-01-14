/**
 * Electron 延迟导入模块
 *
 * 解决 rolldown-vite 7.3.0 中 electron 模块在打包时未正确初始化的问题。
 * 所有需要在模块顶层访问 electron API 的地方应使用此模块。
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const electron = require('electron') as typeof import('electron')

export const app = electron.app
export const ipcMain = electron.ipcMain
export const BrowserWindow = electron.BrowserWindow
export const nativeTheme = electron.nativeTheme
export const shell = electron.shell
export const dialog = electron.dialog
export const screen = electron.screen
export const session = electron.session
export const net = electron.net
export const crashReporter = electron.crashReporter
export const globalShortcut = electron.globalShortcut
export const Tray = electron.Tray
export const Menu = electron.Menu
export const MenuItem = electron.MenuItem
export const clipboard = electron.clipboard
export const powerMonitor = electron.powerMonitor
export const safeStorage = electron.safeStorage
export const systemPreferences = electron.systemPreferences
export const Notification = electron.Notification
export const protocol = electron.protocol
export const nativeImage = electron.nativeImage
export const desktopCapturer = electron.desktopCapturer
export const MessageChannelMain = electron.MessageChannelMain
export const webContents = electron.webContents

// 默认导出整个 electron 对象
export default electron
