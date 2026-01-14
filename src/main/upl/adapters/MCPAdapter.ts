/**
 * MCP 协议适配器
 *
 * 将 MCP 服务器封装为统一协议层的执行器
 *
 * @module upl/adapters/MCPAdapter
 */

import { loggerService } from '@logger'
import type { MCPServer, MCPTool } from '@types'

import { MCPError } from '../../errors'
import type {
  PluginCapabilities,
  UnifiedPluginMetadata,
  UnifiedToolOutput,
  VCPToolRequest,
  VCPToolResponse
} from '../index'
import { BaseUnifiedExecutor, type PluginProtocol } from '../index'

const logger = loggerService.withContext('MCPAdapter')

// ==================== MCP 服务接口 ====================

/**
 * MCP 服务接口 (用于依赖注入)
 */
export interface IMCPService {
  initClient(server: MCPServer): Promise<unknown>
  listTools(event: Electron.IpcMainInvokeEvent | null, server: MCPServer): Promise<MCPTool[]>
  callTool(
    event: Electron.IpcMainInvokeEvent | null,
    args: { server: MCPServer; name: string; args: unknown; callId?: string }
  ): Promise<unknown>
  checkMcpConnectivity(event: Electron.IpcMainInvokeEvent | null, server: MCPServer): Promise<boolean>
}

// ==================== MCP 执行器 ====================

/**
 * MCP 执行器
 *
 * 封装单个 MCP 服务器的调用能力
 */
export class MCPExecutor extends BaseUnifiedExecutor {
  readonly id: string
  readonly protocol: PluginProtocol = 'mcp'

  private server: MCPServer
  private mcpService: IMCPService
  private toolCache: Map<string, MCPTool> = new Map()
  private lastToolRefresh: number = 0
  private readonly TOOL_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(server: MCPServer, mcpService: IMCPService) {
    super()
    this.id = `mcp:${server.id}`
    this.server = server
    this.mcpService = mcpService
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput> {
    const startTime = Date.now()

    try {
      // 验证工具是否存在
      if (!(await this.isToolAvailable(toolName))) {
        throw MCPError.toolNotFound(toolName, this.server.name)
      }

      logger.debug('Calling MCP tool', {
        server: this.server.name,
        tool: toolName
      })

      const result = await this.mcpService.callTool(null, {
        server: this.server,
        name: toolName,
        args
      })

      // 解析结果
      const response = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean }

      if (response.isError) {
        const errorText = response.content?.find((c) => c.type === 'text')?.text || 'Unknown error'
        return {
          success: false,
          contentType: 'error',
          content: errorText,
          executionTime: Date.now() - startTime
        }
      }

      // 提取内容
      const textContent = response.content?.find((c) => c.type === 'text')?.text
      let content: unknown = textContent

      // 尝试解析 JSON
      if (textContent) {
        try {
          content = JSON.parse(textContent)
        } catch {
          // 保持文本格式
        }
      }

      return {
        success: true,
        contentType: typeof content === 'object' ? 'json' : 'text',
        content,
        executionTime: Date.now() - startTime,
        metadata: {
          server: this.server.name,
          tool: toolName
        }
      }
    } catch (error) {
      logger.error('MCP tool call failed', {
        server: this.server.name,
        tool: toolName,
        error
      })

      return {
        success: false,
        contentType: 'error',
        content: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<
    Array<{
      name: string
      description?: string
      inputSchema?: Record<string, unknown>
    }>
  > {
    // 检查缓存
    const now = Date.now()
    if (this.toolCache.size > 0 && now - this.lastToolRefresh < this.TOOL_CACHE_TTL) {
      return Array.from(this.toolCache.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>
      }))
    }

    try {
      const tools = await this.mcpService.listTools(null, this.server)

      // 更新缓存
      this.toolCache.clear()
      for (const tool of tools) {
        this.toolCache.set(tool.name, tool)
      }
      this.lastToolRefresh = now

      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>
      }))
    } catch (error) {
      logger.error('Failed to list MCP tools', {
        server: this.server.name,
        error
      })
      return []
    }
  }

  /**
   * 检查工具是否可用
   */
  async isToolAvailable(toolName: string): Promise<boolean> {
    // 先检查缓存
    if (this.toolCache.has(toolName)) {
      return true
    }

    // 刷新工具列表
    await this.listTools()
    return this.toolCache.has(toolName)
  }

  /**
   * 检查服务器连接
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      return await this.mcpService.checkMcpConnectivity(null, this.server)
    } catch {
      return false
    }
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): MCPServer {
    return { ...this.server }
  }

  /**
   * 清除工具缓存
   */
  clearCache(): void {
    this.toolCache.clear()
    this.lastToolRefresh = 0
  }
}

// ==================== MCP 适配器 ====================

/**
 * MCP 适配器
 *
 * 管理多个 MCP 服务器的执行器
 */
export class MCPAdapter {
  private executors: Map<string, MCPExecutor> = new Map()
  private mcpService: IMCPService

  constructor(mcpService: IMCPService) {
    this.mcpService = mcpService
  }

  /**
   * 注册 MCP 服务器
   */
  register(server: MCPServer): MCPExecutor {
    const executor = new MCPExecutor(server, this.mcpService)
    this.executors.set(server.id, executor)

    logger.info('MCP server registered', {
      serverId: server.id,
      serverName: server.name
    })

    return executor
  }

  /**
   * 注销 MCP 服务器
   */
  unregister(serverId: string): boolean {
    const deleted = this.executors.delete(serverId)
    if (deleted) {
      logger.info('MCP server unregistered', { serverId })
    }
    return deleted
  }

  /**
   * 获取执行器
   */
  getExecutor(serverId: string): MCPExecutor | undefined {
    return this.executors.get(serverId)
  }

  /**
   * 获取所有执行器
   */
  getAllExecutors(): MCPExecutor[] {
    return Array.from(this.executors.values())
  }

  /**
   * 查找工具
   *
   * 在所有服务器中查找指定名称的工具
   */
  async findTool(toolName: string): Promise<{ executor: MCPExecutor; tool: unknown } | undefined> {
    for (const executor of this.executors.values()) {
      if (await executor.isToolAvailable(toolName)) {
        const tools = await executor.listTools()
        const tool = tools.find((t) => t.name === toolName)
        if (tool) {
          return { executor, tool }
        }
      }
    }
    return undefined
  }

  /**
   * 调用工具 (自动查找服务器)
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput> {
    const result = await this.findTool(toolName)

    if (!result) {
      return {
        success: false,
        contentType: 'error',
        content: `Tool not found: ${toolName}`
      }
    }

    return result.executor.callTool(toolName, args)
  }

  /**
   * 处理 VCP 请求
   */
  async handleVCPRequest(request: VCPToolRequest): Promise<VCPToolResponse> {
    const startTime = Date.now()

    try {
      // 查找工具
      const result = await this.findTool(request.toolName)

      if (!result) {
        return {
          success: false,
          error: `Tool not found: ${request.toolName}`,
          executionTime: Date.now() - startTime
        }
      }

      // 执行工具
      const output = await result.executor.callTool(request.toolName, request.arguments)

      return {
        success: output.success,
        result: output.content,
        executionTime: output.executionTime || Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * 列出所有工具
   */
  async listAllTools(): Promise<
    Array<{
      serverId: string
      serverName: string
      tools: Array<{
        name: string
        description?: string
      }>
    }>
  > {
    const result: Array<{
      serverId: string
      serverName: string
      tools: Array<{ name: string; description?: string }>
    }> = []

    for (const executor of this.executors.values()) {
      const serverInfo = executor.getServerInfo()
      const tools = await executor.listTools()

      result.push({
        serverId: serverInfo.id,
        serverName: serverInfo.name,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description
        }))
      })
    }

    return result
  }

  /**
   * 将 MCP 服务器转换为统一插件元数据
   */
  toPluginMetadata(server: MCPServer): UnifiedPluginMetadata {
    const capabilities: PluginCapabilities = {
      tools: true,
      resources: true,
      prompts: true
    }

    return {
      id: `mcp:${server.id}`,
      name: server.name,
      displayName: server.name,
      version: server.dxtVersion || '1.0.0',
      description: server.description,
      protocol: 'mcp',
      type: 'tool',
      capabilities,
      category: server.tags?.[0],
      tags: server.tags,
      logoUrl: server.logoUrl,
      provider: server.provider,
      enabled: server.isActive ?? false,
      requiresConfig: server.shouldConfig
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    for (const executor of this.executors.values()) {
      executor.clearCache()
    }
    logger.info('All MCP caches cleared')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    serverCount: number
    activeCount: number
    totalTools: number
  } {
    let activeCount = 0
    let totalTools = 0

    for (const executor of this.executors.values()) {
      const server = executor.getServerInfo()
      if (server.isActive) {
        activeCount++
      }
      // 工具计数需要异步，这里先返回缓存数量
    }

    return {
      serverCount: this.executors.size,
      activeCount,
      totalTools
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 MCP 适配器
 */
export function createMCPAdapter(mcpService: IMCPService): MCPAdapter {
  return new MCPAdapter(mcpService)
}
