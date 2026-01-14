/**
 * FsShellIpcHandler - 文件系统和 Shell 执行 IPC 处理器
 *
 * 提供以下功能：
 * - 文件信息获取 (stat)
 * - 文件存在检查 (exists)
 * - 文件删除 (unlink)
 * - 目录创建 (mkdir)
 * - 文件/目录重命名 (rename)
 * - Shell 命令执行 (execute)
 * - 进程终止 (kill)
 */

import { ipcMain } from 'electron'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { IpcChannel } from '@shared/IpcChannel'
import { loggerService } from '@logger'
import { isWin } from '../constant'
import { findGitBash } from '../utils/process'

const logger = loggerService.withContext('FsShellIpcHandler')

// 存储运行中的进程
const runningProcesses = new Map<number, ChildProcess>()

/**
 * Shell 执行选项
 */
interface ShellExecuteOptions {
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

/**
 * Shell 执行结果
 */
interface ShellExecuteResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
  pid?: number
}

/**
 * 文件信息结果
 */
interface StatResult {
  size: number
  mtime: number
  ctime: number
  birthtime: number
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
  mode: number
}

/**
 * 初始化 IPC 处理器
 */
export function initFsShellIpcHandler(): void {
  logger.info('Initializing FsShellIpcHandler')

  // ==================== 文件系统操作 ====================

  /**
   * 获取文件信息
   */
  ipcMain.handle(IpcChannel.Fs_Stat, async (_, filePath: string): Promise<StatResult | null> => {
    try {
      const resolvedPath = resolvePath(filePath)
      const stats = await fs.promises.stat(resolvedPath)
      const lstat = await fs.promises.lstat(resolvedPath)

      return {
        size: stats.size,
        mtime: stats.mtime.getTime(),
        ctime: stats.ctime.getTime(),
        birthtime: stats.birthtime.getTime(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: lstat.isSymbolicLink(),
        mode: stats.mode
      }
    } catch (error) {
      logger.debug('fs:stat failed', { filePath, error: String(error) })
      return null
    }
  })

  /**
   * 检查文件是否存在
   */
  ipcMain.handle(IpcChannel.Fs_Exists, async (_, filePath: string): Promise<boolean> => {
    try {
      const resolvedPath = resolvePath(filePath)
      await fs.promises.access(resolvedPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  })

  /**
   * 删除文件
   */
  ipcMain.handle(IpcChannel.Fs_Unlink, async (_, filePath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const resolvedPath = resolvePath(filePath)

      // 安全检查：不允许删除系统目录
      if (isSystemPath(resolvedPath)) {
        return { success: false, error: '不允许删除系统文件' }
      }

      const stats = await fs.promises.stat(resolvedPath)
      if (stats.isDirectory()) {
        await fs.promises.rm(resolvedPath, { recursive: true })
      } else {
        await fs.promises.unlink(resolvedPath)
      }

      logger.info('File deleted', { path: resolvedPath })
      return { success: true }
    } catch (error) {
      logger.error('fs:unlink failed', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 创建目录
   */
  ipcMain.handle(
    IpcChannel.Fs_Mkdir,
    async (_, dirPath: string, options?: { recursive?: boolean }): Promise<{ success: boolean; error?: string }> => {
      try {
        const resolvedPath = resolvePath(dirPath)
        await fs.promises.mkdir(resolvedPath, { recursive: options?.recursive ?? true })
        logger.info('Directory created', { path: resolvedPath })
        return { success: true }
      } catch (error) {
        logger.error('fs:mkdir failed', { dirPath, error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 重命名/移动文件或目录
   */
  ipcMain.handle(
    IpcChannel.Fs_Rename,
    async (_, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const resolvedOldPath = resolvePath(oldPath)
        const resolvedNewPath = resolvePath(newPath)

        // 安全检查
        if (isSystemPath(resolvedOldPath) || isSystemPath(resolvedNewPath)) {
          return { success: false, error: '不允许操作系统文件' }
        }

        await fs.promises.rename(resolvedOldPath, resolvedNewPath)
        logger.info('File renamed', { from: resolvedOldPath, to: resolvedNewPath })
        return { success: true }
      } catch (error) {
        logger.error('fs:rename failed', { oldPath, newPath, error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== Shell 执行 ====================

  /**
   * 执行 Shell 命令
   */
  ipcMain.handle(
    IpcChannel.Shell_Execute,
    async (_, command: string, options?: ShellExecuteOptions): Promise<ShellExecuteResult> => {
      const startTime = Date.now()
      const cwd = options?.cwd || process.cwd()
      const timeout = options?.timeout || 60000 // 默认 60 秒

      logger.info('Executing shell command', { command, cwd })

      return new Promise((resolve) => {
        let stdout = ''
        let stderr = ''
        let killed = false

        // 确定使用哪个 shell
        let shell: string
        let shellArgs: string[]

        if (isWin) {
          // Windows: 优先使用 Git Bash，否则使用 cmd
          const gitBash = findGitBash()
          if (gitBash) {
            shell = gitBash
            shellArgs = ['-c', command]
          } else {
            shell = process.env.COMSPEC || 'cmd.exe'
            shellArgs = ['/c', command]
          }
        } else {
          // Unix: 使用用户的默认 shell 或 /bin/sh
          shell = process.env.SHELL || '/bin/sh'
          shellArgs = ['-c', command]
        }

        const child = spawn(shell, shellArgs, {
          cwd,
          env: { ...process.env, ...options?.env },
          stdio: ['ignore', 'pipe', 'pipe']
        })

        // 存储进程以便后续终止
        if (child.pid) {
          runningProcesses.set(child.pid, child)
        }

        // 设置超时
        const timeoutId = setTimeout(() => {
          if (!killed) {
            killed = true
            child.kill('SIGKILL')
            logger.warn('Shell command timed out', { command, timeout })
          }
        }, timeout)

        // 收集输出
        child.stdout?.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', (code, signal) => {
          clearTimeout(timeoutId)
          if (child.pid) {
            runningProcesses.delete(child.pid)
          }

          const result: ShellExecuteResult = {
            success: code === 0 && !killed,
            stdout,
            stderr,
            exitCode: code ?? -1,
            signal: signal ?? undefined,
            pid: child.pid
          }

          logger.debug('Shell command completed', {
            command,
            exitCode: code,
            duration: Date.now() - startTime
          })

          resolve(result)
        })

        child.on('error', (error) => {
          clearTimeout(timeoutId)
          if (child.pid) {
            runningProcesses.delete(child.pid)
          }

          resolve({
            success: false,
            stdout,
            stderr: error.message,
            exitCode: -1,
            pid: child.pid
          })
        })
      })
    }
  )

  /**
   * 终止进程
   */
  ipcMain.handle(IpcChannel.Shell_Kill, async (_, pid: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const child = runningProcesses.get(pid)
      if (child) {
        child.kill('SIGKILL')
        runningProcesses.delete(pid)
        logger.info('Process killed', { pid })
        return { success: true }
      } else {
        // 尝试使用系统命令终止进程
        try {
          process.kill(pid, 'SIGKILL')
          logger.info('Process killed via system', { pid })
          return { success: true }
        } catch {
          return { success: false, error: `进程 ${pid} 不存在或无法终止` }
        }
      }
    } catch (error) {
      logger.error('shell:kill failed', { pid, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  logger.info('FsShellIpcHandler initialized')
}

// ==================== 辅助函数 ====================

/**
 * 解析文件路径
 */
function resolvePath(filePath: string): string {
  // 处理 ~ 路径
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return path.resolve(filePath)
}

/**
 * 检查是否是系统保护路径
 */
function isSystemPath(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath).toLowerCase()

  // Windows 系统路径
  if (isWin) {
    const systemPaths = [
      'c:\\windows',
      'c:\\program files',
      'c:\\program files (x86)',
      'c:\\users\\default',
      'c:\\users\\public'
    ]
    return systemPaths.some((p) => normalizedPath.startsWith(p))
  }

  // Unix 系统路径
  const systemPaths = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/etc', '/var', '/boot', '/sys', '/proc']
  return systemPaths.some((p) => normalizedPath.startsWith(p))
}

export default initFsShellIpcHandler
