/**
 * 终端服务
 *
 * 提供增强的终端会话管理，支持：
 * - 持久会话
 * - 流式输出
 * - 进程管理
 * - 多终端实例
 *
 * 注：当前使用 child_process 实现，后续可升级为 node-pty
 */

import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'

import { loggerService } from '@logger'

const logger = loggerService.withContext('TerminalService')

// ==================== 类型定义 ====================

export interface TerminalSession {
  id: string
  cwd: string
  shell: string
  process: ChildProcess | null
  isRunning: boolean
  createdAt: number
  lastActivity: number
}

export interface TerminalOutput {
  sessionId: string
  type: 'stdout' | 'stderr' | 'exit' | 'error'
  data: string
  timestamp: number
}

export interface ExecuteOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
}

// ==================== 终端服务 ====================

class TerminalServiceImpl extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map()
  private outputBuffers: Map<string, string[]> = new Map()
  private defaultShell: string

  constructor() {
    super()
    this.defaultShell = this.detectShell()
    logger.info('TerminalService initialized', { shell: this.defaultShell })
  }

  /**
   * 检测系统默认 Shell
   */
  private detectShell(): string {
    const platform = process.platform

    if (platform === 'win32') {
      // Windows: 优先 PowerShell，其次 cmd
      return process.env.ComSpec || 'powershell.exe'
    } else if (platform === 'darwin') {
      // macOS: 优先 zsh
      return process.env.SHELL || '/bin/zsh'
    } else {
      // Linux: 优先 bash
      return process.env.SHELL || '/bin/bash'
    }
  }

  /**
   * 创建终端会话
   */
  createSession(cwd?: string, shell?: string): TerminalSession {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const sessionCwd = cwd || process.env.HOME || process.cwd()
    const sessionShell = shell || this.defaultShell

    const session: TerminalSession = {
      id,
      cwd: sessionCwd,
      shell: sessionShell,
      process: null,
      isRunning: false,
      createdAt: Date.now(),
      lastActivity: Date.now()
    }

    this.sessions.set(id, session)
    this.outputBuffers.set(id, [])

    logger.info('Terminal session created', { id, cwd: sessionCwd, shell: sessionShell })

    return session
  }

  /**
   * 执行命令
   */
  async executeCommand(
    sessionId: string,
    command: string,
    options: ExecuteOptions = {}
  ): Promise<{ success: boolean; output: string; exitCode: number | null }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { success: false, output: 'Session not found', exitCode: -1 }
    }

    // 如果有正在运行的进程，先终止
    if (session.process && session.isRunning) {
      this.killProcess(sessionId)
    }

    return new Promise((resolve) => {
      const cwd = options.cwd || session.cwd
      const env = { ...process.env, ...options.env }
      const timeout = options.timeout || 120000 // 默认 2 分钟

      let stdout = ''
      let stderr = ''
      let timeoutId: NodeJS.Timeout | null = null

      // 根据平台构建命令
      const isWindows = process.platform === 'win32'
      let shellCmd: string
      let shellArgs: string[]

      if (isWindows) {
        if (session.shell.toLowerCase().includes('powershell')) {
          shellCmd = 'powershell.exe'
          shellArgs = ['-NoProfile', '-Command', command]
        } else {
          shellCmd = 'cmd.exe'
          shellArgs = ['/c', command]
        }
      } else {
        shellCmd = session.shell
        shellArgs = ['-c', command]
      }

      const proc = spawn(shellCmd, shellArgs, {
        cwd,
        env,
        shell: false,
        windowsHide: true
      })

      session.process = proc
      session.isRunning = true
      session.lastActivity = Date.now()

      // 设置超时
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (session.isRunning) {
            this.killProcess(sessionId)
            stderr += '\n[Process timed out]'
          }
        }, timeout)
      }

      // 处理输出
      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        session.lastActivity = Date.now()

        // 发送流式输出事件
        this.emit('output', {
          sessionId,
          type: 'stdout',
          data: text,
          timestamp: Date.now()
        } as TerminalOutput)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderr += text
        session.lastActivity = Date.now()

        this.emit('output', {
          sessionId,
          type: 'stderr',
          data: text,
          timestamp: Date.now()
        } as TerminalOutput)
      })

      proc.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)

        session.isRunning = false
        session.process = null
        session.lastActivity = Date.now()

        // 更新工作目录（如果是 cd 命令）
        const cdMatch = command.match(/^cd\s+(.+)$/i)
        if (cdMatch && code === 0) {
          const newPath = cdMatch[1].trim().replace(/["']/g, '')
          if (path.isAbsolute(newPath)) {
            session.cwd = newPath
          } else {
            session.cwd = path.resolve(session.cwd, newPath)
          }
        }

        this.emit('output', {
          sessionId,
          type: 'exit',
          data: String(code ?? 0),
          timestamp: Date.now()
        } as TerminalOutput)

        const output = stdout + (stderr ? `\n${stderr}` : '')
        resolve({
          success: code === 0,
          output: output.trim(),
          exitCode: code
        })
      })

      proc.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)

        session.isRunning = false
        session.process = null

        this.emit('output', {
          sessionId,
          type: 'error',
          data: error.message,
          timestamp: Date.now()
        } as TerminalOutput)

        resolve({
          success: false,
          output: error.message,
          exitCode: -1
        })
      })
    })
  }

  /**
   * 终止进程
   */
  killProcess(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || !session.process) {
      return false
    }

    try {
      if (process.platform === 'win32') {
        // Windows: 使用 taskkill 强制终止进程树
        spawn('taskkill', ['/pid', String(session.process.pid), '/T', '/F'])
      } else {
        // Unix: 发送 SIGTERM
        session.process.kill('SIGTERM')

        // 如果 SIGTERM 不起作用，1 秒后发送 SIGKILL
        setTimeout(() => {
          if (session.isRunning && session.process) {
            session.process.kill('SIGKILL')
          }
        }, 1000)
      }

      session.isRunning = false
      logger.info('Process killed', { sessionId })
      return true
    } catch (error) {
      logger.error('Failed to kill process', { sessionId, error })
      return false
    }
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    if (session.process && session.isRunning) {
      this.killProcess(sessionId)
    }

    this.sessions.delete(sessionId)
    this.outputBuffers.delete(sessionId)

    logger.info('Terminal session closed', { sessionId })
    return true
  }

  /**
   * 更新会话工作目录
   */
  setCwd(sessionId: string, cwd: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.cwd = cwd
    session.lastActivity = Date.now()
    return true
  }

  /**
   * 获取会话工作目录
   */
  getCwd(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.cwd
  }

  /**
   * 清理所有会话
   */
  cleanup(): void {
    for (const [sessionId] of this.sessions) {
      this.closeSession(sessionId)
    }
    logger.info('All terminal sessions cleaned up')
  }
}

// 单例
let terminalServiceInstance: TerminalServiceImpl | null = null

export function getTerminalService(): TerminalServiceImpl {
  if (!terminalServiceInstance) {
    terminalServiceInstance = new TerminalServiceImpl()
  }
  return terminalServiceInstance
}

export default { getTerminalService }
