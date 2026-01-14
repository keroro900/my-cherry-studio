/**
 * VCPToolBridge - Crew 工具调用与 VCP/MCP 桥接
 *
 * 为 Crew 提供统一的工具调用接口：
 * - 列出所有可用工具（VCP + MCP）
 * - 执行工具调用
 * - 异步任务管理
 * - 权限检查集成
 */

import { loggerService } from '@logger'

import { PermissionManager } from '../sandbox/PermissionManager'
import { VCPEventBridge } from './VCPEventBridge'
import { VCPLogBridge } from './VCPLogBridge'

const logger = loggerService.withContext('VCPToolBridge')

// ==================== 类型定义 ====================

/**
 * 工具定义
 */
interface ToolDefinition {
  name: string
  description: string
  source: 'vcp' | 'mcp' | 'builtin'
  plugin?: string
  parameters?: Array<{
    name: string
    description: string
    required: boolean
    type: string
    default?: unknown
  }>
}

/**
 * 工具执行结果
 */
interface ToolResult {
  success: boolean
  output?: string
  data?: unknown
  error?: string
  duration?: number
  async?: boolean
  taskId?: string
}

/**
 * 异步任务状态
 */
interface AsyncTaskStatus {
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout'
  progress?: number
  result?: unknown
  error?: string
  createdAt: number
  completedAt?: number
}

/**
 * 桥接配置
 */
interface VCPToolBridgeConfig {
  /** 是否启用权限检查 */
  enablePermissionCheck: boolean
  /** 默认超时（毫秒） */
  defaultTimeout: number
  /** 是否记录工具调用日志 */
  logToolCalls: boolean
  /** 会话 ID */
  sessionId?: string
}

// ==================== 工具桥接器实现 ====================

class VCPToolBridgeImpl {
  private config: VCPToolBridgeConfig = {
    enablePermissionCheck: true,
    defaultTimeout: 60000,
    logToolCalls: true
  }
  private toolCache: Map<string, ToolDefinition[]> = new Map()
  private pendingTasks: Map<string, AsyncTaskStatus> = new Map()

  /**
   * 初始化桥接器
   */
  initialize(config?: Partial<VCPToolBridgeConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    logger.debug('Initialized', { config: this.config })
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): void {
    this.config.sessionId = sessionId
  }

  // ==================== 工具列表 ====================

  /**
   * 获取所有可用工具
   */
  async listAvailableTools(refresh: boolean = false): Promise<ToolDefinition[]> {
    if (!refresh && this.toolCache.has('all')) {
      return this.toolCache.get('all')!
    }

    const tools: ToolDefinition[] = []

    // 获取 VCP 工具
    try {
      const vcpTools = await this.listVCPTools()
      tools.push(...vcpTools)
    } catch (error) {
      console.warn('[VCPToolBridge] Failed to list VCP tools:', error)
    }

    // 获取 MCP 工具
    try {
      const mcpTools = await this.listMCPTools()
      tools.push(...mcpTools)
    } catch (error) {
      console.warn('[VCPToolBridge] Failed to list MCP tools:', error)
    }

    // 添加内置工具
    tools.push(...this.getBuiltinTools())

    // 缓存结果
    this.toolCache.set('all', tools)

    return tools
  }

  /**
   * 按名称搜索工具
   */
  async findTool(name: string): Promise<ToolDefinition | null> {
    const tools = await this.listAvailableTools()
    return (
      tools.find(
        (t) => t.name.toLowerCase() === name.toLowerCase() || t.name.toLowerCase().includes(name.toLowerCase())
      ) || null
    )
  }

  /**
   * 按源获取工具
   */
  async getToolsBySource(source: 'vcp' | 'mcp' | 'builtin'): Promise<ToolDefinition[]> {
    const tools = await this.listAvailableTools()
    return tools.filter((t) => t.source === source)
  }

  // ==================== 工具执行 ====================

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    options?: {
      async?: boolean
      timeout?: number
      source?: string
    }
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const sessionId = this.config.sessionId || 'default'

    // 日志记录
    if (this.config.logToolCalls) {
      VCPLogBridge.info('tool', `执行工具: ${toolName}`, { params })
      VCPEventBridge.emitToolCall(sessionId, toolName, params, options?.source || 'crew')
    }

    // 权限检查
    if (this.config.enablePermissionCheck) {
      const hasPermission = await this.checkToolPermission(toolName, params)
      if (!hasPermission) {
        const result: ToolResult = {
          success: false,
          error: `权限被拒绝: ${toolName}`,
          duration: Date.now() - startTime
        }
        this.logToolResult(toolName, result)
        return result
      }
    }

    try {
      // 查找工具
      const tool = await this.findTool(toolName)
      if (!tool) {
        throw new Error(`工具未找到: ${toolName}`)
      }

      // 根据来源执行
      let result: ToolResult

      switch (tool.source) {
        case 'vcp':
          result = await this.executeVCPTool(tool, params, options)
          break
        case 'mcp':
          result = await this.executeMCPTool(tool, params, options)
          break
        case 'builtin':
          result = await this.executeBuiltinTool(tool, params)
          break
        default:
          throw new Error(`未知工具源: ${tool.source}`)
      }

      result.duration = Date.now() - startTime
      this.logToolResult(toolName, result)

      return result
    } catch (error) {
      const result: ToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      }
      this.logToolResult(toolName, result)
      return result
    }
  }

  /**
   * 执行后台任务
   */
  async executeAsync(toolName: string, params: Record<string, unknown>): Promise<string> {
    const result = await this.executeTool(toolName, params, { async: true })

    if (result.taskId) {
      this.pendingTasks.set(result.taskId, {
        taskId: result.taskId,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    return result.taskId || ''
  }

  // ==================== 异步任务管理 ====================

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<AsyncTaskStatus | null> {
    // 先检查本地缓存
    const cached = this.pendingTasks.get(taskId)

    try {
      // 从 VCP 获取最新状态
      if (window.api?.vcpTool?.getTaskStatus) {
        const result = await window.api.vcpTool.getTaskStatus(taskId)
        if (result?.success && result.data) {
          const status: AsyncTaskStatus = {
            taskId,
            status: result.data.status || 'pending',
            progress: result.data.progress,
            result: result.data.result,
            error: result.data.error,
            createdAt: cached?.createdAt || Date.now(),
            completedAt: result.data.completedAt
          }

          // 更新缓存
          this.pendingTasks.set(taskId, status)

          return status
        }
      }
    } catch (error) {
      console.warn('[VCPToolBridge] Failed to get task status:', error)
    }

    return cached || null
  }

  /**
   * 等待任务完成
   */
  async waitForTask(taskId: string, options?: { timeout?: number; pollInterval?: number }): Promise<AsyncTaskStatus> {
    const timeout = options?.timeout || this.config.defaultTimeout
    const pollInterval = options?.pollInterval || 1000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getTaskStatus(taskId)

      if (!status) {
        throw new Error(`任务未找到: ${taskId}`)
      }

      if (status.status === 'completed' || status.status === 'error') {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error(`任务超时: ${taskId}`)
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      if (window.api?.vcpTool?.cancelTask) {
        const result = await window.api.vcpTool.cancelTask(taskId)
        if (result?.success) {
          this.pendingTasks.delete(taskId)
          return true
        }
      }
    } catch (error) {
      console.warn('[VCPToolBridge] Failed to cancel task:', error)
    }
    return false
  }

  /**
   * 获取所有待处理任务
   */
  getPendingTasks(): AsyncTaskStatus[] {
    return Array.from(this.pendingTasks.values()).filter((t) => t.status === 'pending' || t.status === 'running')
  }

  // ==================== 私有方法 ====================

  private async listVCPTools(): Promise<ToolDefinition[]> {
    if (!window.api?.vcpTool?.listDefinitions) {
      return []
    }

    const result = await window.api.vcpTool.listDefinitions()
    if (!result || !Array.isArray(result)) {
      return []
    }

    return result.map((def: any) => ({
      name: def.commandIdentifier || def.name,
      description: def.description || '',
      source: 'vcp' as const,
      plugin: def.pluginName,
      parameters: def.parameters
    }))
  }

  private async listMCPTools(): Promise<ToolDefinition[]> {
    // 使用 VCP 统一 API 获取所有插件（包括 MCP 转换的）
    if (window.api?.vcpUnified?.getAllPlugins) {
      try {
        const result = await window.api.vcpUnified.getAllPlugins()
        if (result.success && result.data) {
          // 过滤出 MCP 协议的插件
          const mcpPlugins = result.data.filter((p) => p.protocol === 'mcp' || p.source === 'mcp')
          return mcpPlugins.map((plugin) => ({
            name: plugin.name,
            description: plugin.description || '',
            source: 'mcp' as const,
            plugin: plugin.serverId
          }))
        }
      } catch (error) {
        logger.warn('Failed to list MCP tools via VCP unified API:', error as Error)
      }
    }

    // 回退：使用 MCPO Bridge 获取 VCP 格式的定义
    if (window.api?.mcpoBridge?.getVCPDefinitions) {
      try {
        const result = await window.api.mcpoBridge.getVCPDefinitions()
        if (result.success && result.data) {
          return result.data.map((def) => ({
            name: def.name,
            description: def.description || '',
            source: 'mcp' as const,
            parameters: def.params?.map((p) => ({
              name: p.name,
              description: p.description || '',
              required: p.required || false,
              type: p.type || 'string'
            }))
          }))
        }
      } catch (error) {
        logger.warn('Failed to list MCP tools via MCPO Bridge:', error as Error)
      }
    }

    return []
  }

  private getBuiltinTools(): ToolDefinition[] {
    return [
      {
        name: 'read_file',
        description: '读取文件内容',
        source: 'builtin',
        parameters: [{ name: 'path', description: '文件路径', required: true, type: 'string' }]
      },
      {
        name: 'write_file',
        description: '写入文件内容',
        source: 'builtin',
        parameters: [
          { name: 'path', description: '文件路径', required: true, type: 'string' },
          { name: 'content', description: '文件内容', required: true, type: 'string' }
        ]
      },
      {
        name: 'execute_command',
        description: '执行 Shell 命令',
        source: 'builtin',
        parameters: [
          { name: 'command', description: '命令', required: true, type: 'string' },
          { name: 'cwd', description: '工作目录', required: false, type: 'string' }
        ]
      },
      {
        name: 'list_directory',
        description: '列出目录内容',
        source: 'builtin',
        parameters: [{ name: 'path', description: '目录路径', required: true, type: 'string' }]
      },
      {
        name: 'search_files',
        description: '搜索文件',
        source: 'builtin',
        parameters: [
          { name: 'pattern', description: 'Glob 模式', required: true, type: 'string' },
          { name: 'path', description: '搜索目录', required: false, type: 'string' }
        ]
      }
    ]
  }

  private async executeVCPTool(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    options?: { async?: boolean; timeout?: number }
  ): Promise<ToolResult> {
    if (!window.api?.vcpTool?.execute) {
      return { success: false, error: 'VCP 工具 API 不可用' }
    }

    // Convert params to string format for VCP API
    const stringParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      stringParams[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }

    // Use async execution if requested
    if (options?.async && window.api.vcpTool.executeAsync) {
      const asyncResult = await window.api.vcpTool.executeAsync(tool.name, stringParams)
      return {
        success: asyncResult?.success || false,
        output: asyncResult?.output,
        data: asyncResult?.data,
        error: asyncResult?.error,
        async: true,
        taskId: asyncResult?.taskId
      }
    }

    const result = await window.api.vcpTool.execute(tool.name, stringParams)

    return {
      success: result?.success || false,
      output: result?.output,
      data: result?.data,
      error: result?.error,
      async: false
    }
  }

  private async executeMCPTool(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    _options?: { timeout?: number }
  ): Promise<ToolResult> {
    // 使用 VCP 统一 API 执行工具（自动路由到正确协议）
    if (window.api?.vcpUnified?.executeTool) {
      try {
        const result = await window.api.vcpUnified.executeTool({
          toolName: tool.name,
          params,
          source: 'mcp'
        })

        if (result.success) {
          return {
            success: true,
            output: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
            data: result.output
          }
        } else {
          return {
            success: false,
            error: result.error || 'Tool execution failed'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    // 回退：使用 MCPO Bridge 执行
    if (window.api?.mcpoBridge?.executeTool) {
      try {
        // 转换参数为字符串格式
        const stringParams: Record<string, string> = {}
        for (const [key, value] of Object.entries(params)) {
          stringParams[key] = typeof value === 'string' ? value : JSON.stringify(value)
        }

        const result = await window.api.mcpoBridge.executeTool(tool.name, stringParams)

        if (result.success) {
          return {
            success: true,
            output: result.output,
            data: result.data
          }
        } else {
          return {
            success: false,
            error: result.error || 'Tool execution failed'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return {
      success: false,
      error: `MCP 工具执行 API 不可用: ${tool.name}`
    }
  }

  private async executeBuiltinTool(tool: ToolDefinition, params: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (tool.name) {
        case 'read_file':
          return await this.builtinReadFile(params.path as string)
        case 'write_file':
          return await this.builtinWriteFile(params.path as string, params.content as string)
        case 'execute_command':
          return await this.builtinExecuteCommand(params.command as string, params.cwd as string)
        case 'list_directory':
          return await this.builtinListDirectory(params.path as string)
        case 'search_files':
          return await this.builtinSearchFiles(params.pattern as string, params.path as string)
        default:
          return { success: false, error: `未知内置工具: ${tool.name}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async builtinReadFile(path: string): Promise<ToolResult> {
    if (window.api?.fs?.readText) {
      try {
        const content = await window.api.fs.readText(path)
        return { success: true, output: content, data: { path, content } }
      } catch (error) {
        return { success: false, error: `读取文件失败: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    return { success: false, error: 'FS API 不可用' }
  }

  private async builtinWriteFile(path: string, content: string): Promise<ToolResult> {
    if (window.api?.file?.write) {
      try {
        await window.api.file.write(path, content)
        return { success: true, output: `文件写入成功: ${path}`, data: { path, size: content.length } }
      } catch (error) {
        return { success: false, error: `写入文件失败: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    return { success: false, error: '文件写入 API 不可用' }
  }

  private async builtinExecuteCommand(command: string, cwd?: string): Promise<ToolResult> {
    if (window.api?.shell?.execute) {
      try {
        const result = await window.api.shell.execute(command, { cwd })
        return {
          success: result.success,
          output: result.stdout || result.stderr,
          data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          error: result.success ? undefined : result.stderr || `Exit code: ${result.exitCode}`
        }
      } catch (error) {
        return { success: false, error: `命令执行失败: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    return { success: false, error: 'Shell 执行 API 不可用' }
  }

  private async builtinListDirectory(path: string): Promise<ToolResult> {
    if (window.api?.file?.listDirectory) {
      try {
        const entries = await window.api.file.listDirectory(path, {
          includeFiles: true,
          includeDirectories: true,
          maxDepth: 1
        })
        if (Array.isArray(entries)) {
          const formatted = entries
            .map((e: { name: string; isDirectory?: boolean }) => `${e.isDirectory ? '[D]' : '[F]'} ${e.name}`)
            .join('\n')
          return { success: true, output: formatted, data: entries }
        }
        return { success: true, output: JSON.stringify(entries), data: entries }
      } catch (error) {
        return { success: false, error: `列出目录失败: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    return { success: false, error: '目录列表 API 不可用' }
  }

  private async builtinSearchFiles(pattern: string, basePath?: string): Promise<ToolResult> {
    // 使用 VCP 统一 API 调用文件搜索工具
    if (window.api?.vcpUnified?.executeTool) {
      try {
        const result = await window.api.vcpUnified.executeTool({
          toolName: 'glob',
          params: { pattern, path: basePath },
          source: 'native'
        })
        if (result.success) {
          return { success: true, output: String(result.output), data: result.output }
        }
      } catch (error) {
        logger.debug('VCP glob search failed:', error as Error)
      }
    }
    return { success: false, error: '文件搜索 API 不可用' }
  }

  private async checkToolPermission(toolName: string, params: Record<string, unknown>): Promise<boolean> {
    // 文件操作
    if (['read_file', 'write_file', 'list_directory', 'search_files'].includes(toolName)) {
      const path = params.path as string
      const type =
        toolName === 'read_file' || toolName === 'list_directory' || toolName === 'search_files'
          ? 'file_read'
          : 'file_write'
      return PermissionManager.requestPermission(type, { path }, 'VCPToolBridge')
    }

    // 命令执行
    if (toolName === 'execute_command') {
      const command = params.command as string
      return PermissionManager.requestPermission('shell_execute', { command }, 'VCPToolBridge')
    }

    // 其他工具默认允许
    return true
  }

  private logToolResult(toolName: string, result: ToolResult): void {
    if (!this.config.logToolCalls) return

    const sessionId = this.config.sessionId || 'default'

    if (result.success) {
      VCPLogBridge.success('tool', `工具执行成功: ${toolName}`, {
        duration: result.duration,
        output: result.output?.slice(0, 200)
      })
    } else {
      VCPLogBridge.error('tool', `工具执行失败: ${toolName}`, {
        error: result.error,
        duration: result.duration
      })
    }

    VCPEventBridge.emitToolResult(sessionId, toolName, result.success, result.data, result.duration)
  }
}

// ==================== 导出 ====================

export const VCPToolBridge = new VCPToolBridgeImpl()

export type { ToolDefinition, ToolResult, AsyncTaskStatus, VCPToolBridgeConfig }

export default VCPToolBridge
