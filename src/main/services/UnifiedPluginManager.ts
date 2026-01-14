/**
 * 统一插件管理器
 *
 * 核心目标：统一管理所有插件，提供单一入口
 *
 * 执行优先级架构:
 * 1. BuiltinServiceRegistry - 78+ 内置 TypeScript 服务（优先级最高）
 * 2. VCPRuntime - VCP 插件 + MCP 桥接工具
 * 3. Native fallback - 少量内置工具（time/date/diary_search）
 *
 * 调用流程:
 * UnifiedPluginManager.executeTool
 *   ↓ (1) tryExecuteBuiltinService
 *   ┌────────────────────────────┐
 *   │ BuiltinServiceRegistry     │ ← 78+ TypeScript 服务
 *   │ (无需外部进程/VCPRuntime)   │
 *   └────────────────────────────┘
 *   ↓ (2) executeViaVCP
 *   ┌────────────────────────────┐
 *   │   VCP 插件注册表           │
 *   │  ┌──────┐ ┌──────┐        │
 *   │  │ VCP  │ │ MCP  │        │
 *   │  │插件  │ │桥接  │        │
 *   │  └──────┘ └──────┘        │
 *   └────────────────────────────┘
 *   ↓ (3) tryExecuteNative
 *   ┌────────────────────────────┐
 *   │ Native fallback            │ ← time/date/diary_search
 *   └────────────────────────────┘
 */

import { loggerService } from '@logger'
import type { MCPServer } from '@types'

import MCPService from './MCPService'
import { reduxService } from './ReduxService'
import { getVCPRuntime, normalizeVCPKey, type MCPServerInterface, type VCPPlugin, type VCPToolResult } from './vcp'
import { ensureBuiltinServicesInitialized } from './vcp/BuiltinServices'

const logger = loggerService.withContext('UnifiedPluginManager')

// ==================== 类型定义 ====================

/**
 * 统一插件源类型
 */
export type PluginSource = 'mcp' | 'vcp' | 'native'

/**
 * 统一插件类型（映射 VCP 的 8 种类型）
 */
export type UnifiedPluginType =
  | 'static' // 启动时执行，返回静态值
  | 'synchronous' // 同步执行，立即返回结果
  | 'asynchronous' // 异步执行，通过回调返回结果
  | 'messagePreprocessor' // 消息预处理器
  | 'service' // 后台服务
  | 'hybridservice' // 混合服务
  | 'mcp_tool' // MCP 工具（旧版兼容）
  | 'mcp_bridge' // MCP 桥接插件（彻底 VCP 化）
  | 'builtin_service' // 内置服务（Cherry Studio 原生实现）

/**
 * 统一插件信息
 */
export interface UnifiedPlugin {
  id: string
  name: string
  displayName: string
  description: string
  source: PluginSource
  type: UnifiedPluginType
  enabled: boolean
  serverId?: string // MCP 服务器 ID
  serverName?: string // MCP 服务器名称
  inputSchema?: Record<string, any>
  capabilities?: {
    systemPromptPlaceholders?: Array<{ placeholder: string; description?: string }>
    toolFunctions?: Array<{ name: string; description?: string }>
  }
}

/**
 * 工具执行请求
 */
export interface ToolExecutionRequest {
  toolName: string
  params: Record<string, any>
  requestId?: string
  source?: PluginSource // 指定源（可选，不指定则自动路由）
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean
  output?: string | any
  error?: string
  source: PluginSource
  taskId?: string // 异步任务 ID
  executionTimeMs?: number
  /** 内部标记：工具未找到 */
  _pluginNotFound?: boolean
}

// ==================== UnifiedPluginManager ====================

class UnifiedPluginManager {
  private static instance: UnifiedPluginManager | null = null
  private mcpService: typeof MCPService | null = null
  private pluginCache: Map<string, UnifiedPlugin> = new Map()
  private cacheTimestamp = 0
  private readonly CACHE_TTL = 30000 // 30 秒缓存

  private constructor() {
    logger.info('UnifiedPluginManager created')
  }

  static getInstance(): UnifiedPluginManager {
    if (!UnifiedPluginManager.instance) {
      UnifiedPluginManager.instance = new UnifiedPluginManager()
    }
    return UnifiedPluginManager.instance
  }

  /**
   * 初始化统一插件管理器
   *
   * 彻底 VCP 化：自动将 MCP 服务器桥接为 VCP 插件
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing UnifiedPluginManager (VCP-first mode)...')

      // 初始化 MCP 服务
      this.mcpService = MCPService

      // 初始化原生 VCP 运行时
      const vcpRuntime = getVCPRuntime()
      try {
        await vcpRuntime.initialize()
        logger.info('VCPRuntime initialized successfully', {
          pluginCount: vcpRuntime.getPluginCount()
        })
      } catch (error) {
        logger.warn('VCPRuntime initialization failed, VCP plugins will be unavailable', {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // 彻底 VCP 化：将 MCP 服务器桥接为 VCP 插件
      await this.bridgeMCPServers()

      // 预加载插件列表
      await this.refreshPluginCache()

      logger.info('UnifiedPluginManager initialized (VCP-first)', {
        totalPlugins: this.pluginCache.size,
        vcpPlugins: vcpRuntime.getPluginCount()
      })

      return true
    } catch (error) {
      logger.error('Failed to initialize UnifiedPluginManager:', error as Error)
      return false
    }
  }

  /**
   * 彻底 VCP 化：将 MCP 服务器桥接为 VCP 插件
   */
  private async bridgeMCPServers(): Promise<void> {
    if (!this.mcpService) return

    const servers = await reduxService.select<MCPServer[]>('state.mcp.servers')
    if (!servers || servers.length === 0) {
      logger.debug('No MCP servers to bridge')
      return
    }

    const vcpRuntime = getVCPRuntime()
    const registry = vcpRuntime.getRegistry()
    if (!registry) return

    let totalBridged = 0

    for (const server of servers) {
      if (!server.isActive) continue

      try {
        // 创建 MCP 服务器接口适配器
        const mcpAdapter: MCPServerInterface = {
          id: server.id,
          name: server.name,
          isActive: server.isActive,
          listTools: async () => {
            const tools = await this.mcpService!.listTools(null as any, server)
            return (
              tools?.map((t: any) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema || { type: 'object', properties: {} }
              })) || []
            )
          },
          executeTool: async (name: string, args: Record<string, any>) => {
            const response = await this.mcpService!.callTool(null as any, {
              server,
              name,
              args
            })
            return {
              content: response?.content || [{ type: 'text', text: '' }],
              isError: response?.isError
            }
          }
        }

        // 注册到 VCP 运行时
        const count = await registry.registerMCPServer(mcpAdapter)
        totalBridged += count
      } catch (error) {
        logger.warn('Failed to bridge MCP server', {
          server: server.name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.info('MCP servers bridged to VCP', { totalBridged })
  }

  /**
   * 获取所有统一插件列表
   */
  async getAllPlugins(forceRefresh = false): Promise<UnifiedPlugin[]> {
    if (forceRefresh || this.isCacheExpired()) {
      await this.refreshPluginCache()
    }
    return Array.from(this.pluginCache.values())
  }

  /**
   * 按源获取插件
   */
  async getPluginsBySource(source: PluginSource): Promise<UnifiedPlugin[]> {
    const allPlugins = await this.getAllPlugins()
    return allPlugins.filter((p) => p.source === source)
  }

  /**
   * 查找插件
   *
   * 支持多种查找方式:
   * 1. 精确匹配 (name 或 id)
   * 2. displayName 匹配 (容错：AI 可能使用中文显示名)
   * 3. MCP 工具名别名匹配 (mcp_server_tool → tool)
   * 4. 归一化键匹配 (camelCase/kebab-case → snake_case)
   * 5. 大小写不敏感匹配
   * 6. 模糊匹配（包含）
   */
  async findPlugin(toolName: string): Promise<UnifiedPlugin | null> {
    const allPlugins = await this.getAllPlugins()

    // 1. 精确匹配
    let plugin = allPlugins.find((p) => p.name === toolName || p.id === toolName)
    if (plugin) return plugin

    // 2. displayName 精确匹配 (容错机制)
    // AI 可能使用中文显示名（如 "RAG日记本检索器"）而不是工具 ID（"RAGDiaryPlugin"）
    plugin = allPlugins.find((p) => p.displayName === toolName)
    if (plugin) {
      logger.debug('Plugin found via displayName match', {
        requested: toolName,
        matched: plugin.name
      })
      return plugin
    }

    // 3. MCP 工具名别名匹配
    // MCP 桥接后的名称格式: mcp_{serverId}_{originalToolName}
    // 尝试匹配原始工具名
    if (toolName.startsWith('mcp_')) {
      // 提取可能的原始工具名（去掉 mcp_ 前缀和服务器 ID）
      const parts = toolName.split('_')
      if (parts.length >= 3) {
        // mcp_serverId_toolName → toolName
        const originalToolName = parts.slice(2).join('_')
        plugin = allPlugins.find(
          (p) => p.name === originalToolName || (p.source === 'mcp' && p.name.endsWith('_' + originalToolName))
        )
        if (plugin) return plugin
      }
    } else {
      // 反向查找：用户输入的是原始工具名，查找 MCP 桥接后的名称
      plugin = allPlugins.find(
        (p) => p.source === 'mcp' && (p.name.endsWith('_' + toolName) || (p.inputSchema && p.name.includes(toolName)))
      )
      if (plugin) return plugin
    }

    // 3. 归一化键匹配
    const normalizedToolName = normalizeVCPKey(toolName)
    plugin = allPlugins.find(
      (p) => normalizeVCPKey(p.name) === normalizedToolName || normalizeVCPKey(p.id) === normalizedToolName
    )
    if (plugin) return plugin

    // 4. 大小写不敏感匹配
    const lowerName = toolName.toLowerCase()
    plugin = allPlugins.find((p) => p.name.toLowerCase() === lowerName || p.id.toLowerCase() === lowerName)
    if (plugin) return plugin

    // 5. 模糊匹配（包含）
    plugin = allPlugins.find((p) => p.name.toLowerCase().includes(lowerName) || p.id.toLowerCase().includes(lowerName))

    return plugin || null
  }

  /**
   * 统一工具执行入口
   *
   * 执行优先级:
   * 1. BuiltinServiceRegistry - 78+ 内置 TypeScript 服务（无需外部进程）
   * 2. VCPRuntime - VCP 插件 + MCP 桥接工具
   * 3. Native fallback - 少量内置工具（time/date/diary_search）
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now()

    logger.debug('Executing tool via unified manager', {
      toolName: request.toolName,
      requestId: request.requestId
    })

    try {
      // 1. 优先检查 BuiltinServiceRegistry（78+ 内置服务）
      const builtinResult = await this.tryExecuteBuiltinService(request, startTime)
      if (builtinResult.success || !builtinResult._serviceNotFound) {
        const { _serviceNotFound, ...result } = builtinResult
        return result
      }

      // 2. 尝试通过 VCPRuntime 执行（VCP 插件 + MCP 桥接）
      const vcpResult = await this.executeViaVCP(request, startTime)
      if (vcpResult.success || !vcpResult._pluginNotFound) {
        const { _pluginNotFound, ...result } = vcpResult
        return result
      }

      // 3. 后备：尝试内置工具（time/date/diary_search）
      const nativeResult = await this.tryExecuteNative(request, startTime)
      if (nativeResult.success) {
        return nativeResult
      }

      return {
        success: false,
        error: `Tool not found: ${request.toolName}. Checked: BuiltinServices, VCPRuntime, Native.`,
        source: 'vcp',
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error('Tool execution failed:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'vcp',
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 尝试通过 BuiltinServiceRegistry 执行
   * 支持 78+ 内置 TypeScript 服务
   *
   * 支持两种 toolName 格式:
   * 1. ServiceName:CommandName (如 VCPForum:CreatePost) - 推荐格式
   * 2. ServiceName + params.command (如 toolName=VCPForum, command=CreatePost) - 兼容格式
   */
  private async tryExecuteBuiltinService(
    request: ToolExecutionRequest,
    startTime: number
  ): Promise<ToolExecutionResult & { _serviceNotFound?: boolean }> {
    try {
      const registry = await ensureBuiltinServicesInitialized()

      // 解析 toolName，支持 ServiceName:CommandName 格式
      let serviceName = request.toolName
      let command = (request.params.command as string) || (request.params.cmd as string) || 'default'

      // 检查是否是 ServiceName:CommandName 格式
      if (request.toolName.includes(':')) {
        const parts = request.toolName.split(':')
        serviceName = parts[0]
        // 如果 toolName 中包含 command，优先使用它
        if (parts[1]) {
          command = parts[1]
        }
        logger.debug('Parsed ServiceName:CommandName format', {
          original: request.toolName,
          serviceName,
          command
        })
      }

      // 检查服务是否存在
      if (!registry.has(serviceName)) {
        return {
          success: false,
          error: 'Service not found',
          source: 'native',
          executionTimeMs: Date.now() - startTime,
          _serviceNotFound: true
        }
      }

      logger.debug('Executing via BuiltinServiceRegistry', {
        serviceName,
        command,
        originalToolName: request.toolName
      })

      const result = await registry.execute(serviceName, command, request.params)

      return {
        success: result.success,
        output: result.data ?? result.error,
        error: result.error,
        source: 'native',
        executionTimeMs: result.executionTimeMs || Date.now() - startTime
      }
    } catch (error) {
      logger.debug('BuiltinService execution failed', {
        toolName: request.toolName,
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'native',
        executionTimeMs: Date.now() - startTime,
        _serviceNotFound: true
      }
    }
  }

  /**
   * 通过 VCP 运行时执行（彻底 VCP 化核心）
   *
   * 增强的工具查找：使用 findPlugin 支持别名和归一化匹配
   */
  private async executeViaVCP(request: ToolExecutionRequest, startTime: number): Promise<ToolExecutionResult> {
    try {
      const vcpRuntime = getVCPRuntime()

      // 自动初始化 VCPRuntime（懒加载）
      if (!vcpRuntime.isInitialized()) {
        logger.info('VCPRuntime not initialized, auto-initializing...')
        try {
          await vcpRuntime.initialize()
          logger.info('VCPRuntime auto-initialized successfully', {
            pluginCount: vcpRuntime.getPluginCount()
          })
        } catch (initError) {
          logger.error('VCPRuntime auto-initialization failed', { error: String(initError) })
          return {
            success: false,
            error: `VCPRuntime initialization failed: ${String(initError)}`,
            source: 'vcp',
            executionTimeMs: Date.now() - startTime
          }
        }
      }

      // 使用增强的 findPlugin 支持别名和归一化查找
      let actualToolName = request.toolName
      const plugin = await this.findPlugin(request.toolName)

      if (!plugin) {
        // 直接检查 VCPRuntime 是否有该插件
        if (!vcpRuntime.hasPlugin(request.toolName)) {
          return {
            success: false,
            error: `Plugin not found: ${request.toolName}`,
            source: 'vcp',
            executionTimeMs: Date.now() - startTime,
            _pluginNotFound: true
          }
        }
      } else {
        // 使用查找到的插件名称（可能是别名解析后的名称）
        actualToolName = plugin.name
        logger.debug('Tool name resolved via findPlugin', {
          original: request.toolName,
          resolved: actualToolName
        })
      }

      // 通过 VCPRuntime 统一执行
      const result: VCPToolResult = await vcpRuntime.executeTool(actualToolName, request.params, {
        source: 'chat',
        traceId: request.requestId
      })

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        taskId: result.taskId,
        source: 'vcp',
        executionTimeMs: result.executionTimeMs || Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution error',
        source: 'vcp',
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 尝试执行内置工具
   */
  private async tryExecuteNative(request: ToolExecutionRequest, startTime: number): Promise<ToolExecutionResult> {
    const toolName = request.toolName.toLowerCase()

    switch (toolName) {
      case 'get_time':
      case 'time':
      case '获取时间':
        return {
          success: true,
          output: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
          source: 'native',
          executionTimeMs: Date.now() - startTime
        }

      case 'get_date':
      case 'date':
      case '获取日期':
        return {
          success: true,
          output: new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
          source: 'native',
          executionTimeMs: Date.now() - startTime
        }

      case 'diary_search':
      case 'search_diary':
      case '搜索日记':
        try {
          const { getNoteService } = await import('./notes/NoteService')
          const noteService = getNoteService()
          const tags = (request.params.tags as string)?.split(',').map((t) => t.trim()) || []
          const results = await noteService.searchByTags(tags)
          return {
            success: true,
            output: results.map((r) => `[${r.createdAt.toLocaleDateString()}] ${r.content}`).join('\n\n---\n\n'),
            source: 'native',
            executionTimeMs: Date.now() - startTime
          }
        } catch (error) {
          return {
            success: false,
            error: `日记搜索失败: ${error instanceof Error ? error.message : String(error)}`,
            source: 'native',
            executionTimeMs: Date.now() - startTime
          }
        }

      default:
        return {
          success: false,
          error: 'Tool not found',
          source: 'native',
          executionTimeMs: Date.now() - startTime
        }
    }
  }

  /**
   * 刷新插件缓存
   *
   * 彻底 VCP 化：只从 VCPRuntime 加载（包括桥接的 MCP 工具）
   */
  private async refreshPluginCache(): Promise<void> {
    this.pluginCache.clear()

    // 加载所有 VCP 插件（包括桥接的 MCP 工具）
    await this.loadVCPPlugins()

    this.cacheTimestamp = Date.now()

    logger.debug('Plugin cache refreshed (VCP-first)', {
      totalPlugins: this.pluginCache.size
    })
  }

  /**
   * 加载 VCP 插件（包括桥接的 MCP 工具）
   */
  private async loadVCPPlugins(): Promise<void> {
    try {
      const vcpRuntime = getVCPRuntime()

      if (!vcpRuntime.isInitialized()) {
        logger.debug('VCPRuntime not initialized, skipping plugin loading')
        return
      }

      const plugins: VCPPlugin[] = vcpRuntime.listPlugins()

      for (const plugin of plugins) {
        // 判断是否为 MCP 桥接插件
        const isMCPBridge = plugin.manifest.pluginType === 'mcp_bridge'

        const unifiedPlugin: UnifiedPlugin = {
          id: isMCPBridge
            ? `mcp:${plugin.mcpBridge?.serverId}:${plugin.mcpBridge?.toolName}`
            : `vcp:${plugin.manifest.name}`,
          name: plugin.manifest.name,
          displayName: plugin.manifest.displayName || plugin.manifest.name,
          description: plugin.manifest.description || '',
          source: isMCPBridge ? 'mcp' : 'vcp', // 保持兼容性：桥接插件显示为 mcp 来源
          type: plugin.manifest.pluginType,
          enabled: plugin.enabled,
          capabilities: plugin.manifest.capabilities,
          serverId: plugin.mcpBridge?.serverId,
          serverName: plugin.mcpBridge?.serverName,
          inputSchema: plugin.mcpBridge?.inputSchema
        }

        this.pluginCache.set(unifiedPlugin.id, unifiedPlugin)
        // 也用 name 作为键，方便查找
        this.pluginCache.set(plugin.manifest.name, unifiedPlugin)

        // MCP 桥接插件也用原始工具名注册
        if (isMCPBridge && plugin.mcpBridge?.toolName) {
          this.pluginCache.set(plugin.mcpBridge.toolName, unifiedPlugin)
        }
      }
    } catch (error) {
      logger.warn('Failed to load VCP plugins:', error as Error)
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isCacheExpired(): boolean {
    return Date.now() - this.cacheTimestamp > this.CACHE_TTL
  }

  /**
   * 关闭统一插件管理器
   */
  async shutdown(): Promise<void> {
    try {
      // 关闭原生 VCP 运行时
      const vcpRuntime = getVCPRuntime()
      await vcpRuntime.shutdown()

      this.pluginCache.clear()
      logger.info('UnifiedPluginManager shut down')
    } catch (error) {
      logger.error('Error during shutdown:', error as Error)
    }
  }

  // ==================== 占位符相关 ====================

  /**
   * 解析占位符
   */
  async resolvePlaceholders(text: string): Promise<string> {
    const vcpRuntime = getVCPRuntime()
    if (!vcpRuntime.isInitialized()) return text
    return vcpRuntime.resolvePlaceholders(text)
  }

  /**
   * 获取占位符值
   */
  getPlaceholderValue(placeholder: string): string | undefined {
    const vcpRuntime = getVCPRuntime()
    if (!vcpRuntime.isInitialized()) return undefined
    return vcpRuntime.getPlaceholderValue(placeholder)
  }

  // ==================== TOOL_REQUEST 解析 ====================

  /**
   * 解析 TOOL_REQUEST 块
   */
  parseToolRequests(text: string) {
    const vcpRuntime = getVCPRuntime()
    return vcpRuntime.parseToolRequests(text)
  }

  /**
   * 格式化 TOOL_RESULT 块
   */
  formatToolResult(pluginName: string, result: ToolExecutionResult): string {
    const vcpRuntime = getVCPRuntime()
    return vcpRuntime.formatToolResult(pluginName, {
      success: result.success,
      output: result.output,
      error: result.error,
      taskId: result.taskId,
      executionTimeMs: result.executionTimeMs
    })
  }
}

// ==================== 导出 ====================

let managerInstance: UnifiedPluginManager | null = null

export function getUnifiedPluginManager(): UnifiedPluginManager {
  if (!managerInstance) {
    managerInstance = UnifiedPluginManager.getInstance()
  }
  return managerInstance
}

export async function initializeUnifiedPluginManager(): Promise<boolean> {
  const manager = getUnifiedPluginManager()
  return manager.initialize()
}

export { UnifiedPluginManager }
