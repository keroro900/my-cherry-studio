/**
 * VCP Native Runtime - Plugin Executor
 *
 * 负责插件执行，支持多种执行模型：
 * - builtin_service: 内置 TypeScript 服务（优先级最高）
 * - stdio: 通过 stdin/stdout 与外部进程通信（synchronous/asynchronous）
 * - direct: 直接调用 Node.js 模块（service/hybridservice）
 * - static: 返回占位符值
 * - mcp_bridge: MCP 工具桥接执行（彻底 VCP 化）
 */

import { spawn } from 'child_process'

import { loggerService } from '@logger'

import { ensureBuiltinServicesInitialized, getBuiltinServiceRegistry } from './BuiltinServices'
import type { PreprocessorChain } from './PreprocessorChain'
import type { PluginRegistry } from './PluginRegistry'
import type {
  AsyncTask,
  ChatMessage,
  PreprocessorResult,
  VCPExecutionContext,
  VCPPlugin,
  VCPRuntimeConfig,
  VCPToolResult
} from './types'

const logger = loggerService.withContext('VCP:PluginExecutor')

// 异步任务 TTL (1 小时)
const ASYNC_TASK_TTL_MS = 60 * 60 * 1000
// 清理间隔 (10 分钟)
const ASYNC_TASK_CLEANUP_INTERVAL_MS = 10 * 60 * 1000

// 延迟导入 ShowVCPService 避免循环依赖
let showVCPService: { logCallStart: Function; logCallEnd: Function } | null = null
async function getShowVCPService() {
  if (!showVCPService) {
    try {
      const { getShowVCPService: getService } = await import('./ShowVCPService')
      showVCPService = getService()
    } catch {
      // ShowVCPService 不可用，忽略
    }
  }
  return showVCPService
}

/**
 * 插件执行器
 */
export class PluginExecutor {
  private registry: PluginRegistry
  private asyncTasks: Map<string, AsyncTask> = new Map()
  private preprocessorChain: PreprocessorChain | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(_config: VCPRuntimeConfig, registry: PluginRegistry) {
    this.registry = registry
    this.startAsyncTaskCleanup()
  }

  /**
   * 启动异步任务自动清理定时器
   */
  private startAsyncTaskCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredAsyncTasks()
    }, ASYNC_TASK_CLEANUP_INTERVAL_MS)
    // 防止定时器阻止进程退出
    this.cleanupTimer.unref?.()
  }

  /**
   * 清理过期的异步任务
   */
  private cleanupExpiredAsyncTasks(): void {
    const now = Date.now()
    let cleanedCount = 0
    for (const [taskId, task] of this.asyncTasks) {
      // 只清理已完成或已失败的任务，且超过 TTL
      if (task.status !== 'pending' && now - task.updatedAt > ASYNC_TASK_TTL_MS) {
        this.asyncTasks.delete(taskId)
        cleanedCount++
      }
    }
    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired async tasks', { count: cleanedCount })
    }
  }

  /**
   * 设置预处理器链
   */
  setPreprocessorChain(chain: PreprocessorChain): void {
    this.preprocessorChain = chain
  }

  /**
   * 执行工具调用
   */
  async execute(
    pluginName: string,
    params: Record<string, any>,
    context?: VCPExecutionContext
  ): Promise<VCPToolResult> {
    const startTime = Date.now()

    // 记录调用开始到 ShowVCP
    const showVCP = await getShowVCPService()
    const callId = showVCP?.logCallStart('tool_call', pluginName, params) as string | undefined

    try {
      // 支持 PluginName:CommandName 格式 (如 FRPSInfoProvider:GetServerInfo)
      let actualPluginName = pluginName
      let extractedCommand = ''
      const colonIndex = pluginName.indexOf(':')
      if (colonIndex > 0 && colonIndex < pluginName.length - 1) {
        actualPluginName = pluginName.substring(0, colonIndex)
        extractedCommand = pluginName.substring(colonIndex + 1)
        logger.debug('Parsed PluginName:CommandName format', {
          original: pluginName,
          plugin: actualPluginName,
          command: extractedCommand
        })
      }

      // 1. 优先检查内置服务（builtin_service 类型），确保已初始化
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      if (builtinRegistry.has(actualPluginName)) {
        logger.debug('Executing builtin service', { name: actualPluginName })
        // 优先使用提取的命令，然后是 params.command/tool_command
        // 如果都为空，使用 'default' 让服务自己决定默认行为
        const command = extractedCommand || String(params.command || params.tool_command || 'default')

        const result = await builtinRegistry.execute(actualPluginName, command, params)
        const vcpResult = {
          success: result.success,
          output: result.output,
          data: result.data as Record<string, any> | undefined,
          error: result.error,
          executionTimeMs: Date.now() - startTime
        }

        // 记录调用结束到 ShowVCP
        if (callId && showVCP) {
          showVCP.logCallEnd(callId, vcpResult.output, vcpResult.error)
        }

        return vcpResult
      }

      // 2. 检查分布式远程工具
      try {
        const { getDistributedPlugin } = await import('../../apiServer/websocket/plugins/DistributedPlugin')
        const distributedPlugin = getDistributedPlugin()
        if (distributedPlugin && distributedPlugin.isRemoteTool(actualPluginName)) {
          logger.debug('Executing distributed remote tool', { name: actualPluginName })
          const result = await distributedPlugin.callRemoteTool(actualPluginName, params)
          const vcpResult = {
            success: result.success,
            output: result.output,
            data: result.data as Record<string, any> | undefined,
            error: result.error,
            executionTimeMs: result.executionTimeMs || Date.now() - startTime
          }

          if (callId && showVCP) {
            showVCP.logCallEnd(callId, vcpResult.output, vcpResult.error)
          }

          return vcpResult
        }
      } catch {
        // 分布式插件可能未初始化，继续尝试其他方式
      }

      // 3. 回退到外部插件
      const plugin = this.registry.getPlugin(actualPluginName)
      if (!plugin) {
        const error = `Plugin not found: ${actualPluginName}`
        if (callId && showVCP) {
          showVCP.logCallEnd(callId, undefined, error)
        }
        return {
          success: false,
          error,
          executionTimeMs: Date.now() - startTime
        }
      }

      if (!plugin.enabled) {
        const error = `Plugin is disabled: ${actualPluginName}`
        if (callId && showVCP) {
          showVCP.logCallEnd(callId, undefined, error)
        }
        return {
          success: false,
          error,
          executionTimeMs: Date.now() - startTime
        }
      }

      if (plugin.error) {
        const error = `Plugin has error: ${plugin.error}`
        if (callId && showVCP) {
          showVCP.logCallEnd(callId, undefined, error)
        }
        return {
          success: false,
          error,
          executionTimeMs: Date.now() - startTime
        }
      }

      logger.debug('Executing plugin', {
        name: actualPluginName,
        type: plugin.manifest.pluginType,
        params: Object.keys(params)
      })

      let result: VCPToolResult

      switch (plugin.manifest.pluginType) {
        case 'static':
          result = await this.executeStatic(plugin, params)
          break

        case 'synchronous':
        case 'asynchronous':
          // stdio 插件执行
          result = await this.executeStdio(plugin, params, context)
          break

        case 'service':
        case 'hybridservice':
          result = await this.executeService(plugin, params, context)
          break

        case 'mcp_bridge':
          // 彻底 VCP 化：MCP 工具通过桥接执行
          result = await this.executeMCPBridge(plugin, params)
          break

        case 'builtin_service':
          // 内置服务类型（理论上不会到这里，因为上面已经优先处理）
          // 这是一个后备路径
          {
            const builtinReg = getBuiltinServiceRegistry()
            const command = String(params.command || params.tool_command || '')
            const builtinResult = await builtinReg.execute(plugin.manifest.name, command, params)
            result = {
              success: builtinResult.success,
              output: builtinResult.output,
              data: builtinResult.data as Record<string, any> | undefined,
              error: builtinResult.error
            }
          }
          break

        case 'messagePreprocessor':
          // 预处理器不能作为工具调用
          result = {
            success: false,
            error: 'Message preprocessor cannot be executed as a tool',
            executionTimeMs: Date.now() - startTime
          }
          break

        default:
          result = {
            success: false,
            error: `Unknown plugin type: ${plugin.manifest.pluginType}`,
            executionTimeMs: Date.now() - startTime
          }
      }

      result.executionTimeMs = Date.now() - startTime

      // 记录调用结束到 ShowVCP
      if (callId && showVCP) {
        showVCP.logCallEnd(callId, result.output, result.error)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Plugin execution error', {
        plugin: pluginName,
        error: error instanceof Error ? error : new Error(String(error))
      })

      // 记录调用失败到 ShowVCP
      if (callId && showVCP) {
        showVCP.logCallEnd(callId, undefined, errorMessage)
      }

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 执行静态插件（返回占位符值）
   */
  private async executeStatic(plugin: VCPPlugin, params: Record<string, any>): Promise<VCPToolResult> {
    const placeholders = plugin.manifest.capabilities?.systemPromptPlaceholders || []

    if (placeholders.length === 0) {
      return {
        success: false,
        error: 'No placeholders defined for static plugin'
      }
    }

    // 如果指定了占位符名，返回特定占位符
    if (params.placeholder) {
      const ph = placeholders.find((p) => p.placeholder === params.placeholder)
      if (ph) {
        return {
          success: true,
          output: ph.defaultValue || `[${ph.placeholder}]`
        }
      }
    }

    // 返回第一个占位符的值
    const firstPlaceholder = placeholders[0]
    return {
      success: true,
      output: firstPlaceholder.defaultValue || `[${firstPlaceholder.placeholder}]`
    }
  }

  /**
   * 执行 stdio 插件（synchronous/asynchronous）
   *
   * 通过 spawn 子进程执行外部命令，使用 stdin/stdout 进行通信
   * 参考 VCPToolBox Plugin.js 的 executePlugin 方法实现
   */
  private async executeStdio(
    plugin: VCPPlugin,
    params: Record<string, any>,
    _context?: VCPExecutionContext
  ): Promise<VCPToolResult> {
    const manifest = plugin.manifest
    const entryPoint = manifest.entryPoint

    if (!entryPoint?.command) {
      return {
        success: false,
        error: `Plugin ${manifest.name} missing entryPoint.command for stdio execution`
      }
    }

    // 解析命令和参数
    const commandParts = entryPoint.command.split(/\s+/)
    const command = commandParts[0]
    const args = [...(commandParts.slice(1) || []), ...(entryPoint.args || [])]

    // 构建环境变量（合并全局配置和插件配置）
    const env: Record<string, string> = {
      ...process.env,
      PLUGIN_NAME: manifest.name,
      PLUGIN_NAME_FOR_CALLBACK: manifest.name
    }

    // 添加插件配置到环境变量
    if (plugin.userConfig) {
      for (const [key, value] of Object.entries(plugin.userConfig)) {
        if (value !== undefined && value !== null) {
          env[key] = String(value)
        }
      }
    }

    // 设置超时（同步默认60s，异步默认1800s）
    const isAsync = manifest.pluginType === 'asynchronous'
    const defaultTimeout = isAsync ? 1800000 : 60000
    const timeout = manifest.communication?.timeout || entryPoint.timeout || defaultTimeout

    logger.debug('Executing stdio plugin', {
      plugin: manifest.name,
      command,
      args,
      timeout,
      isAsync,
      cwd: plugin.basePath
    })

    return new Promise<VCPToolResult>((resolve) => {
      const startTime = Date.now()
      let stdout = ''
      let stderr = ''
      let resolved = false
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
          timeoutHandle = null
        }
      }

      const resolveOnce = (result: VCPToolResult) => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve(result)
        }
      }

      try {
        const childProcess = spawn(command, args, {
          cwd: plugin.basePath,
          env,
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        // 设置超时
        timeoutHandle = setTimeout(() => {
          if (!resolved) {
            childProcess.kill('SIGKILL')
            resolveOnce({
              success: false,
              error: `Plugin ${manifest.name} execution timed out after ${timeout}ms`,
              executionTimeMs: Date.now() - startTime
            })
          }
        }, timeout)

        // 收集 stdout
        childProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString()
          stdout += chunk

          // 异步插件：尝试解析第一个有效 JSON 响应后立即返回
          if (isAsync && !resolved) {
            try {
              const parsed = this.parseStdioOutput(stdout)
              if (parsed) {
                resolveOnce({
                  success: parsed.status === 'success',
                  output: parsed.result,
                  error: parsed.error,
                  taskId: parsed.taskId,
                  executionTimeMs: Date.now() - startTime
                })
              }
            } catch {
              // 继续收集数据
            }
          }
        })

        // 收集 stderr
        childProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        // 写入参数到 stdin
        const inputJson = JSON.stringify(params)
        childProcess.stdin?.write(inputJson)
        childProcess.stdin?.end()

        // 进程退出
        childProcess.on('close', (code) => {
          if (resolved) return

          const executionTimeMs = Date.now() - startTime

          // 尝试解析输出
          const parsed = this.parseStdioOutput(stdout)

          if (parsed) {
            resolveOnce({
              success: parsed.status === 'success',
              output: parsed.result,
              error: parsed.error,
              taskId: parsed.taskId,
              executionTimeMs
            })
          } else if (code === 0) {
            // 非 JSON 输出，直接返回 stdout
            resolveOnce({
              success: true,
              output: stdout.trim() || '执行成功',
              executionTimeMs
            })
          } else {
            resolveOnce({
              success: false,
              error: stderr.trim() || stdout.trim() || `Process exited with code ${code}`,
              executionTimeMs
            })
          }
        })

        // 进程错误
        childProcess.on('error', (err) => {
          resolveOnce({
            success: false,
            error: `Failed to start plugin process: ${err.message}`,
            executionTimeMs: Date.now() - startTime
          })
        })
      } catch (error) {
        resolveOnce({
          success: false,
          error: `Failed to execute plugin: ${error instanceof Error ? error.message : String(error)}`,
          executionTimeMs: Date.now() - startTime
        })
      }
    })
  }

  /**
   * 解析 stdio 插件输出
   * 支持格式: { status: "success"|"error", result: ..., error: ..., taskId: ... }
   */
  private parseStdioOutput(output: string): {
    status: 'success' | 'error'
    result?: string
    error?: string
    taskId?: string
  } | null {
    const trimmed = output.trim()
    if (!trimmed) return null

    // 尝试找到最后一个有效的 JSON 对象
    const lines = trimmed.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.status === 'success' || parsed.status === 'error') {
            return {
              status: parsed.status,
              result: typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result),
              error: parsed.error,
              taskId: parsed.taskId
            }
          }
        } catch {
          // 继续尝试其他行
        }
      }
    }

    // 尝试解析整个输出为 JSON
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.status === 'success' || parsed.status === 'error') {
        return {
          status: parsed.status,
          result: typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result),
          error: parsed.error,
          taskId: parsed.taskId
        }
      }
    } catch {
      // 不是有效 JSON
    }

    return null
  }

  /**
   * 执行服务插件
   */
  private async executeService(
    plugin: VCPPlugin,
    params: Record<string, any>,
    context?: VCPExecutionContext
  ): Promise<VCPToolResult> {
    if (!plugin.serviceModule) {
      return {
        success: false,
        error: 'Service module not loaded'
      }
    }

    const module = plugin.serviceModule

    // 尝试多种调用方式
    const callMethods = ['processToolCall', 'execute', 'run', 'call', 'handle']

    for (const method of callMethods) {
      if (typeof module[method] === 'function') {
        try {
          const result = await module[method](plugin.manifest.name, params, context)
          return this.normalizeServiceResult(result)
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    }

    // 如果模块本身是函数（可能是动态导入的模块）
    // 使用 unknown 避免 TypeScript 控制流分析导致的 never 类型
    const moduleAsUnknown = module as unknown
    if (typeof moduleAsUnknown === 'function') {
      try {
        const result = await (
          moduleAsUnknown as (params: Record<string, any>, context?: VCPExecutionContext) => Promise<any>
        )(params, context)
        return this.normalizeServiceResult(result)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    // 如果有 default 导出
    if (typeof module.default === 'function') {
      try {
        const result = await module.default(params, context)
        return this.normalizeServiceResult(result)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return {
      success: false,
      error: 'No callable method found in service module'
    }
  }

  /**
   * 规范化服务结果
   */
  private normalizeServiceResult(result: any): VCPToolResult {
    if (result === null || result === undefined) {
      return { success: true, output: '' }
    }

    if (typeof result === 'string') {
      return { success: true, output: result }
    }

    if (typeof result === 'object') {
      if (result.success !== undefined) {
        return {
          success: result.success,
          output: result.output || result.result,
          data: result.data,
          error: result.error,
          taskId: result.taskId
        }
      }

      return {
        success: true,
        output: JSON.stringify(result),
        data: result
      }
    }

    return {
      success: true,
      output: String(result)
    }
  }

  /**
   * 执行 MCP 桥接插件（彻底 VCP 化核心）
   *
   * 通过预注册的处理器直接调用 MCP 工具
   */
  private async executeMCPBridge(plugin: VCPPlugin, params: Record<string, any>): Promise<VCPToolResult> {
    if (!plugin.mcpBridge) {
      return {
        success: false,
        error: 'MCP bridge configuration not found'
      }
    }

    const { handler, serverName, toolName } = plugin.mcpBridge

    logger.debug('Executing MCP bridge plugin', {
      plugin: plugin.manifest.name,
      server: serverName,
      tool: toolName
    })

    try {
      // 直接调用预注册的处理器
      const result = await handler(params)
      return result
    } catch (error) {
      logger.error('MCP bridge execution error', {
        plugin: plugin.manifest.name,
        error: error instanceof Error ? error : new Error(String(error))
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行消息预处理器
   */
  async executePreprocessor(plugin: VCPPlugin, messages: ChatMessage[]): Promise<PreprocessorResult> {
    if (plugin.manifest.pluginType !== 'messagePreprocessor') {
      return { messages, modified: false }
    }

    // 服务模式预处理器
    if (plugin.serviceModule) {
      const preprocessMethods = ['preprocessMessages', 'preprocess', 'process']

      for (const method of preprocessMethods) {
        if (typeof plugin.serviceModule[method] === 'function') {
          try {
            const result = await plugin.serviceModule[method](messages)
            if (Array.isArray(result)) {
              return { messages: result, modified: true }
            }
            if (result && Array.isArray(result.messages)) {
              return {
                messages: result.messages,
                modified: result.modified !== false,
                metadata: result.metadata
              }
            }
          } catch (error) {
            logger.error('Preprocessor error', {
              plugin: plugin.manifest.name,
              error: error instanceof Error ? error : new Error(String(error))
            })
          }
        }
      }
    }

    // stdio 模式预处理器已移除，不再支持
    // 如需预处理功能，请使用 service 模式或 builtin_service 类型

    return { messages, modified: false }
  }

  /**
   * 执行所有预处理器
   * 如果设置了 PreprocessorChain，则委托给它按顺序执行
   */
  async executeAllPreprocessors(messages: ChatMessage[]): Promise<PreprocessorResult> {
    // 优先使用预处理器链（支持排序）
    if (this.preprocessorChain) {
      return this.preprocessorChain.executeChain(messages)
    }

    // 回退：无序执行所有预处理器
    const preprocessors = this.registry.getPluginsByType('messagePreprocessor')
    let currentMessages = messages
    let anyModified = false
    const allMetadata: Record<string, any> = {}

    for (const preprocessor of preprocessors) {
      const result = await this.executePreprocessor(preprocessor, currentMessages)
      if (result.modified) {
        currentMessages = result.messages
        anyModified = true
        if (result.metadata) {
          allMetadata[preprocessor.manifest.name] = result.metadata
        }
      }
    }

    return {
      messages: currentMessages,
      modified: anyModified,
      metadata: Object.keys(allMetadata).length > 0 ? allMetadata : undefined
    }
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 获取异步任务
   */
  getAsyncTask(taskId: string): AsyncTask | undefined {
    return this.asyncTasks.get(taskId)
  }

  /**
   * 获取所有异步任务
   */
  getAllAsyncTasks(): AsyncTask[] {
    return Array.from(this.asyncTasks.values())
  }

  /**
   * 通过插件名获取异步任务
   */
  getAsyncTasksByPlugin(pluginName: string): AsyncTask[] {
    return Array.from(this.asyncTasks.values()).filter((task) => task.pluginName === pluginName)
  }

  /**
   * 创建异步任务
   */
  createAsyncTask(pluginName: string, metadata?: Record<string, any>): AsyncTask {
    const task: AsyncTask = {
      taskId: this.generateTaskId(),
      pluginName,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata
    }
    this.asyncTasks.set(task.taskId, task)
    return task
  }

  /**
   * 更新异步任务
   */
  updateAsyncTask(taskId: string, update: Partial<AsyncTask>): boolean {
    const task = this.asyncTasks.get(taskId)
    if (!task) return false

    Object.assign(task, update, { updatedAt: Date.now() })
    return true
  }

  /**
   * 完成异步任务
   */
  completeAsyncTask(taskId: string, result: VCPToolResult): boolean {
    return this.updateAsyncTask(taskId, {
      status: result.success ? 'completed' : 'failed',
      result,
      error: result.error
    })
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.asyncTasks.clear()
  }
}

/**
 * 创建插件执行器实例
 */
export function createPluginExecutor(config: VCPRuntimeConfig, registry: PluginRegistry): PluginExecutor {
  return new PluginExecutor(config, registry)
}
