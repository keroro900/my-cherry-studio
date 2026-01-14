/**
 * TerminalTools - 终端执行工具集
 *
 * 为 Crew 提供 Shell 命令执行能力：
 * - 同步/异步命令执行
 * - 任务管理
 * - 进程控制
 * - 权限集成
 */

import { PermissionManager } from '../sandbox/PermissionManager'
import { SandboxManager } from '../sandbox/SandboxManager'
import { VCPLogBridge } from '../bridge/VCPLogBridge'

// ==================== 类型定义 ====================

/**
 * 命令执行结果
 */
interface ExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  signal?: string
}

/**
 * 后台任务状态
 */
interface TaskStatus {
  taskId: string
  command: string
  status: 'running' | 'completed' | 'error' | 'killed'
  pid?: number
  startTime: number
  endTime?: number
  stdout?: string
  stderr?: string
  exitCode?: number
}

/**
 * 执行选项
 */
interface ExecuteOptions {
  /** 工作目录 */
  cwd?: string
  /** 超时（毫秒） */
  timeout?: number
  /** 环境变量 */
  env?: Record<string, string>
  /** 是否捕获输出 */
  captureOutput?: boolean
}

// ==================== 终端工具实现 ====================

class TerminalToolsImpl {
  private backgroundTasks: Map<string, TaskStatus> = new Map()
  private defaultTimeout = 60000 // 60 秒

  /**
   * 执行命令（同步等待）
   */
  async execute(command: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    const startTime = Date.now()
    const cwd = options?.cwd || SandboxManager.getCurrentWorkspacePath() || '.'

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission(
      'shell_execute',
      { command, description: `在 ${cwd} 执行命令` },
      'TerminalTools'
    )
    if (!hasPermission) {
      return {
        success: false,
        stdout: '',
        stderr: `权限被拒绝: ${command}`,
        exitCode: -1,
        duration: Date.now() - startTime
      }
    }

    VCPLogBridge.info('terminal', `执行命令: ${command}`, { cwd })

    // 使用 shell.execute API
    if (window.api?.shell?.execute) {
      const result = await window.api.shell.execute(command, {
        cwd,
        timeout: options?.timeout,
        env: options?.env
      })

      const duration = Date.now() - startTime
      VCPLogBridge.debug('terminal', `命令完成: ${command}`, {
        exitCode: result.exitCode,
        duration
      })

      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
        signal: result.signal
      }
    }

    // API 不可用
    VCPLogBridge.error('terminal', `Shell API 不可用: ${command}`)
    return {
      success: false,
      stdout: '',
      stderr: 'Shell 执行 API 暂不可用。请通过其他方式执行命令。',
      exitCode: -1,
      duration: Date.now() - startTime
    }
  }

  /**
   * 后台执行命令
   */
  async executeBackground(command: string, options?: ExecuteOptions): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const cwd = options?.cwd || SandboxManager.getCurrentWorkspacePath() || '.'

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission(
      'shell_execute',
      { command, description: `在 ${cwd} 后台执行命令` },
      'TerminalTools'
    )
    if (!hasPermission) {
      throw new Error(`权限被拒绝: ${command}`)
    }

    VCPLogBridge.info('terminal', `后台执行: ${command}`, { taskId, cwd })

    // 创建任务状态
    const taskStatus: TaskStatus = {
      taskId,
      command,
      status: 'running',
      startTime: Date.now()
    }
    this.backgroundTasks.set(taskId, taskStatus)

    // 异步执行
    this.runBackgroundTask(taskId, command, options)

    return taskId
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    return this.backgroundTasks.get(taskId) || null
  }

  /**
   * 等待任务完成
   */
  async waitForTask(taskId: string, timeout?: number): Promise<TaskStatus> {
    const maxWait = timeout || this.defaultTimeout
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      const status = this.backgroundTasks.get(taskId)
      if (!status) {
        throw new Error(`任务不存在: ${taskId}`)
      }

      if (status.status !== 'running') {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error(`任务超时: ${taskId}`)
  }

  /**
   * 终止进程
   */
  async killProcess(taskId: string): Promise<void> {
    const task = this.backgroundTasks.get(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }

    if (task.status !== 'running') {
      VCPLogBridge.warn('terminal', `任务已结束: ${taskId}`)
      return
    }

    VCPLogBridge.warn('terminal', `终止任务: ${taskId}`, { command: task.command })

    // 使用 shell.kill API
    if (task.pid && window.api?.shell?.kill) {
      const result = await window.api.shell.kill(task.pid)
      if (!result.success) {
        VCPLogBridge.error('terminal', `终止进程失败: ${task.pid}`, { error: result.error })
      }
    }

    task.status = 'killed'
    task.endTime = Date.now()
    this.backgroundTasks.set(taskId, task)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): TaskStatus[] {
    return Array.from(this.backgroundTasks.values())
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): TaskStatus[] {
    return this.getAllTasks().filter((t) => t.status === 'running')
  }

  /**
   * 清理已完成的任务
   */
  cleanupTasks(): void {
    const toDelete: string[] = []

    for (const [id, task] of this.backgroundTasks) {
      if (task.status !== 'running') {
        toDelete.push(id)
      }
    }

    toDelete.forEach((id) => this.backgroundTasks.delete(id))
    VCPLogBridge.debug('terminal', `清理任务: ${toDelete.length} 个`)
  }

  // ==================== 便捷方法 ====================

  /**
   * 执行 npm 命令
   */
  async npm(args: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    const packageManager = this.detectPackageManager()
    return this.execute(`${packageManager} ${args}`, options)
  }

  /**
   * 执行 git 命令
   */
  async git(args: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    return this.execute(`git ${args}`, options)
  }

  /**
   * 执行 Python 命令
   */
  async python(args: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    const python = process.platform === 'win32' ? 'python' : 'python3'
    return this.execute(`${python} ${args}`, options)
  }

  /**
   * 执行多个命令（顺序）
   */
  async executeSequence(commands: string[], options?: ExecuteOptions): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    for (const command of commands) {
      const result = await this.execute(command, options)
      results.push(result)

      // 如果命令失败，停止执行
      if (!result.success) {
        break
      }
    }

    return results
  }

  /**
   * 执行带重试的命令
   */
  async executeWithRetry(
    command: string,
    options?: ExecuteOptions & { retries?: number; delay?: number }
  ): Promise<ExecutionResult> {
    const maxRetries = options?.retries || 3
    const delay = options?.delay || 1000
    let lastResult: ExecutionResult | null = null

    for (let i = 0; i < maxRetries; i++) {
      lastResult = await this.execute(command, options)

      if (lastResult.success) {
        return lastResult
      }

      if (i < maxRetries - 1) {
        VCPLogBridge.warn('terminal', `命令失败，重试 ${i + 2}/${maxRetries}: ${command}`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return lastResult!
  }

  // ==================== 私有方法 ====================

  private async runBackgroundTask(taskId: string, command: string, options?: ExecuteOptions): Promise<void> {
    try {
      const result = await this.execute(command, options)

      const task = this.backgroundTasks.get(taskId)
      if (task) {
        task.status = result.success ? 'completed' : 'error'
        task.endTime = Date.now()
        task.stdout = result.stdout
        task.stderr = result.stderr
        task.exitCode = result.exitCode
        this.backgroundTasks.set(taskId, task)
      }
    } catch (error) {
      const task = this.backgroundTasks.get(taskId)
      if (task) {
        task.status = 'error'
        task.endTime = Date.now()
        task.stderr = error instanceof Error ? error.message : String(error)
        task.exitCode = -1
        this.backgroundTasks.set(taskId, task)
      }
    }
  }

  private detectPackageManager(): string {
    const workspace = SandboxManager.getCurrentWorkspace()
    if (workspace?.packageManager) {
      return workspace.packageManager
    }

    // 默认使用 npm
    return 'npm'
  }
}

// ==================== 导出 ====================

export const TerminalTools = new TerminalToolsImpl()

export type { ExecutionResult, TaskStatus, ExecuteOptions }

export default TerminalTools
