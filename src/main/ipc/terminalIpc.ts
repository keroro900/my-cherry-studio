/**
 * Terminal IPC 处理器
 *
 * 提供终端服务的 IPC 通道：
 * - 会话管理（创建、关闭、列表）
 * - 命令执行
 * - 进程控制
 * - 流式输出事件
 */

import { BrowserWindow, ipcMain } from 'electron'

import { loggerService } from '@logger'

import { getTerminalService, type TerminalOutput } from '../services/TerminalService'

const logger = loggerService.withContext('TerminalIpc')

/**
 * 注册终端 IPC 处理器
 */
export function registerTerminalIpcHandlers(): void {
  const terminalService = getTerminalService()

  // ==================== 会话管理 ====================

  /**
   * 创建终端会话
   */
  ipcMain.handle('terminal:createSession', async (_event, cwd?: string, shell?: string) => {
    try {
      const session = terminalService.createSession(cwd, shell)
      return {
        success: true,
        session: {
          id: session.id,
          cwd: session.cwd,
          shell: session.shell,
          isRunning: session.isRunning,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }
      }
    } catch (error) {
      logger.error('Failed to create terminal session', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 关闭终端会话
   */
  ipcMain.handle('terminal:closeSession', async (_event, sessionId: string) => {
    try {
      const result = terminalService.closeSession(sessionId)
      return { success: result }
    } catch (error) {
      logger.error('Failed to close terminal session', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 获取会话信息
   */
  ipcMain.handle('terminal:getSession', async (_event, sessionId: string) => {
    try {
      const session = terminalService.getSession(sessionId)
      if (!session) {
        return { success: false, error: 'Session not found' }
      }
      return {
        success: true,
        session: {
          id: session.id,
          cwd: session.cwd,
          shell: session.shell,
          isRunning: session.isRunning,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }
      }
    } catch (error) {
      logger.error('Failed to get terminal session', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 获取所有会话
   */
  ipcMain.handle('terminal:getAllSessions', async () => {
    try {
      const sessions = terminalService.getAllSessions()
      return {
        success: true,
        sessions: sessions.map((s) => ({
          id: s.id,
          cwd: s.cwd,
          shell: s.shell,
          isRunning: s.isRunning,
          createdAt: s.createdAt,
          lastActivity: s.lastActivity
        }))
      }
    } catch (error) {
      logger.error('Failed to get all terminal sessions', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ==================== 命令执行 ====================

  /**
   * 执行命令
   */
  ipcMain.handle(
    'terminal:executeCommand',
    async (
      _event,
      sessionId: string,
      command: string,
      options?: { cwd?: string; env?: Record<string, string>; timeout?: number }
    ) => {
      try {
        const result = await terminalService.executeCommand(sessionId, command, options)
        return {
          success: result.success,
          output: result.output,
          exitCode: result.exitCode
        }
      } catch (error) {
        logger.error('Failed to execute command', error as Error)
        return { success: false, output: (error as Error).message, exitCode: -1 }
      }
    }
  )

  /**
   * 终止进程
   */
  ipcMain.handle('terminal:killProcess', async (_event, sessionId: string) => {
    try {
      const result = terminalService.killProcess(sessionId)
      return { success: result }
    } catch (error) {
      logger.error('Failed to kill process', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ==================== 工作目录 ====================

  /**
   * 设置工作目录
   */
  ipcMain.handle('terminal:setCwd', async (_event, sessionId: string, cwd: string) => {
    try {
      const result = terminalService.setCwd(sessionId, cwd)
      return { success: result }
    } catch (error) {
      logger.error('Failed to set terminal cwd', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 获取工作目录
   */
  ipcMain.handle('terminal:getCwd', async (_event, sessionId: string) => {
    try {
      const cwd = terminalService.getCwd(sessionId)
      if (!cwd) {
        return { success: false, error: 'Session not found' }
      }
      return { success: true, cwd }
    } catch (error) {
      logger.error('Failed to get terminal cwd', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ==================== 流式输出事件 ====================

  /**
   * 订阅终端输出
   * 渲染进程调用此方法后，主进程会将输出通过 'terminal:output' 事件发送
   */
  ipcMain.handle('terminal:subscribe', async (event, sessionId: string) => {
    try {
      const webContents = event.sender
      const window = BrowserWindow.fromWebContents(webContents)

      if (!window) {
        return { success: false, error: 'Window not found' }
      }

      // 创建输出监听器
      const outputHandler = (output: TerminalOutput) => {
        if (output.sessionId === sessionId && !webContents.isDestroyed()) {
          webContents.send('terminal:output', output)
        }
      }

      // 添加监听器
      terminalService.on('output', outputHandler)

      // 当窗口关闭时移除监听器
      window.once('closed', () => {
        terminalService.off('output', outputHandler)
      })

      return { success: true }
    } catch (error) {
      logger.error('Failed to subscribe to terminal output', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 取消订阅终端输出
   */
  ipcMain.handle('terminal:unsubscribe', async (_event, _sessionId: string) => {
    // 监听器会在窗口关闭时自动移除
    // 这里只是提供一个显式取消订阅的接口
    return { success: true }
  })

  // ==================== 清理 ====================

  /**
   * 清理所有会话
   */
  ipcMain.handle('terminal:cleanup', async () => {
    try {
      terminalService.cleanup()
      return { success: true }
    } catch (error) {
      logger.error('Failed to cleanup terminal sessions', error as Error)
      return { success: false, error: (error as Error).message }
    }
  })

  logger.info('Terminal IPC handlers registered')
}

export default { registerTerminalIpcHandlers }
