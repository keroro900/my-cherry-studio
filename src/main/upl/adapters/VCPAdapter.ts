/**
 * VCP 协议适配器
 *
 * 与 VCPToolBox 后端进行通信
 *
 * @module upl/adapters/VCPAdapter
 */

import { loggerService } from '@logger'
import { net } from 'electron'

import { VCPError } from '../../errors'
import type {
  PluginCapabilities,
  UnifiedPluginMetadata,
  UnifiedToolOutput,
  VCPToolRequest,
  VCPToolResponse
} from '../index'
import { BaseUnifiedExecutor, type PluginProtocol } from '../index'

const logger = loggerService.withContext('VCPAdapter')

// ==================== VCP 配置类型 ====================

/**
 * VCP 服务器配置
 */
export interface VCPServerConfig {
  /** 服务器 ID */
  id: string
  /** 服务器名称 */
  name: string
  /** 服务器 URL */
  baseUrl: string
  /** API 密钥 */
  apiKey?: string
  /** 请求超时 (ms) */
  timeout?: number
  /** 是否启用 */
  enabled?: boolean
}

/**
 * VCP 插件信息
 */
export interface VCPPluginInfo {
  /** 插件名称 */
  name: string
  /** 显示名称 */
  displayName?: string
  /** 描述 */
  description?: string
  /** 版本 */
  version?: string
  /** 类型 */
  type: 'static' | 'synchronous' | 'asynchronous' | 'service' | 'hybridservice' | 'messagePreprocessor'
  /** 分类 */
  category?: string
  /** 是否启用 */
  enabled: boolean
  /** 需要配置 */
  requiresConfig?: boolean
  /** 服务端点 */
  serverEndpoint?: string
}

/**
 * VCP 工具信息
 */
export interface VCPToolInfo {
  /** 工具名称 */
  name: string
  /** 描述 */
  description?: string
  /** 参数 schema */
  parameters?: Record<string, unknown>
  /** 所属插件 */
  pluginName: string
}

// ==================== VCP 执行器 ====================

/**
 * VCP 执行器
 *
 * 封装 VCPToolBox 服务器的调用能力
 */
export class VCPExecutor extends BaseUnifiedExecutor {
  readonly id: string
  readonly protocol: PluginProtocol = 'vcp'

  private config: VCPServerConfig
  private pluginCache: Map<string, VCPPluginInfo> = new Map()
  private toolCache: Map<string, VCPToolInfo> = new Map()
  private lastRefresh: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(config: VCPServerConfig) {
    super()
    this.id = `vcp:${config.id}`
    this.config = config
  }

  /**
   * 发送 HTTP 请求
   */
  private async fetch(endpoint: string, options?: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>)
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    try {
      const response = await net.fetch(url, {
        ...options,
        headers
      })

      return response
    } catch (error) {
      logger.error('VCP fetch failed', { url, error })
      throw VCPError.executionError('network', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput> {
    const startTime = Date.now()

    try {
      // 构建 VCP 请求格式
      const vcpRequest: VCPToolRequest = {
        toolName,
        action: 'call_tool',
        arguments: args
      }

      // 调用 VCP API
      const response = await this.fetch('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'vcp-tool',
          messages: [
            {
              role: 'user',
              content: this.formatVCPRequest(vcpRequest)
            }
          ],
          stream: false
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          contentType: 'error',
          content: `VCP request failed: ${response.status} - ${errorText}`,
          executionTime: Date.now() - startTime
        }
      }

      const data = await response.json()

      // 解析响应
      const assistantMessage = data.choices?.[0]?.message?.content || ''
      const vcpResponse = this.parseVCPResponse(assistantMessage)

      return {
        success: vcpResponse.success,
        contentType: vcpResponse.success ? 'json' : 'error',
        content: vcpResponse.success ? vcpResponse.result : vcpResponse.error,
        executionTime: vcpResponse.executionTime || Date.now() - startTime,
        metadata: {
          server: this.config.name,
          tool: toolName
        }
      }
    } catch (error) {
      logger.error('VCP tool call failed', {
        server: this.config.name,
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
   * 格式化 VCP 请求
   */
  private formatVCPRequest(request: VCPToolRequest): string {
    const lines = [
      '<<<[TOOL_REQUEST]>>>',
      `tool_name:「始」${request.toolName}「末」`,
      `action:「始」${request.action || 'call_tool'}「末」`
    ]

    if (Object.keys(request.arguments).length > 0) {
      lines.push(`arguments:「始」${JSON.stringify(request.arguments)}「末」`)
    }

    lines.push('<<<[END_TOOL_REQUEST]>>>')

    return lines.join('\n')
  }

  /**
   * 解析 VCP 响应
   */
  private parseVCPResponse(content: string): VCPToolResponse {
    // 检查是否包含 VCP 响应格式
    const responseMatch = content.match(/<<<\[TOOL_RESPONSE\]>>>([\s\S]*?)<<<\[END_TOOL_RESPONSE\]>>>/)

    if (responseMatch) {
      const responseContent = responseMatch[1]
      const params: Record<string, string> = {}

      // 解析参数
      const paramPattern = /(\w+):「始」([\s\S]*?)「末」/g
      let match: RegExpExecArray | null
      while ((match = paramPattern.exec(responseContent)) !== null) {
        params[match[1]] = match[2]
      }

      const success = params['status'] === 'success'

      let result: unknown = params['result']
      if (result && typeof result === 'string') {
        try {
          result = JSON.parse(result)
        } catch {
          // 保持字符串格式
        }
      }

      return {
        success,
        result: success ? result : undefined,
        error: success ? undefined : params['error'],
        executionTime: params['execution_time'] ? parseInt(params['execution_time']) : undefined
      }
    }

    // 如果没有标准格式，尝试解析 JSON
    try {
      const json = JSON.parse(content)
      return {
        success: !json.error,
        result: json.result || json,
        error: json.error
      }
    } catch {
      // 返回原始内容
      return {
        success: true,
        result: content
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
    if (this.toolCache.size > 0 && now - this.lastRefresh < this.CACHE_TTL) {
      return Array.from(this.toolCache.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters
      }))
    }

    try {
      // 获取插件列表
      const plugins = await this.listPlugins()

      // 对于每个插件，尝试获取工具列表
      const tools: VCPToolInfo[] = []

      for (const plugin of plugins) {
        if (plugin.enabled) {
          // 添加插件作为工具
          tools.push({
            name: plugin.name,
            description: plugin.description,
            pluginName: plugin.name
          })
        }
      }

      // 更新缓存
      this.toolCache.clear()
      for (const tool of tools) {
        this.toolCache.set(tool.name, tool)
      }
      this.lastRefresh = now

      return tools.map((t) => ({
        name: t.name,
        description: t.description
      }))
    } catch (error) {
      logger.error('Failed to list VCP tools', {
        server: this.config.name,
        error
      })
      return []
    }
  }

  /**
   * 列出插件
   */
  async listPlugins(): Promise<VCPPluginInfo[]> {
    // 检查缓存
    if (this.pluginCache.size > 0 && Date.now() - this.lastRefresh < this.CACHE_TTL) {
      return Array.from(this.pluginCache.values())
    }

    try {
      const response = await this.fetch('/api/plugins')

      if (!response.ok) {
        logger.warn('Failed to fetch VCP plugins', { status: response.status })
        return []
      }

      const data = await response.json()
      const plugins: VCPPluginInfo[] = Array.isArray(data) ? data : data.plugins || []

      // 更新缓存
      this.pluginCache.clear()
      for (const plugin of plugins) {
        this.pluginCache.set(plugin.name, plugin)
      }

      return plugins
    } catch (error) {
      logger.error('Failed to list VCP plugins', { error })
      return []
    }
  }

  /**
   * 检查服务器连接
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await this.fetch('/health')
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 获取服务器配置
   */
  getConfig(): VCPServerConfig {
    return { ...this.config }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.pluginCache.clear()
    this.toolCache.clear()
    this.lastRefresh = 0
  }
}

// ==================== VCP 适配器 ====================

/**
 * VCP 适配器
 *
 * 管理多个 VCP 服务器的执行器
 */
export class VCPAdapter {
  private executors: Map<string, VCPExecutor> = new Map()

  /**
   * 注册 VCP 服务器
   */
  register(config: VCPServerConfig): VCPExecutor {
    const executor = new VCPExecutor(config)
    this.executors.set(config.id, executor)

    logger.info('VCP server registered', {
      serverId: config.id,
      serverName: config.name
    })

    return executor
  }

  /**
   * 注销 VCP 服务器
   */
  unregister(serverId: string): boolean {
    const deleted = this.executors.delete(serverId)
    if (deleted) {
      logger.info('VCP server unregistered', { serverId })
    }
    return deleted
  }

  /**
   * 获取执行器
   */
  getExecutor(serverId: string): VCPExecutor | undefined {
    return this.executors.get(serverId)
  }

  /**
   * 获取所有执行器
   */
  getAllExecutors(): VCPExecutor[] {
    return Array.from(this.executors.values())
  }

  /**
   * 调用工具 (自动查找服务器)
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput> {
    // 尝试在所有服务器中查找工具
    for (const executor of this.executors.values()) {
      if (await executor.isToolAvailable(toolName)) {
        return executor.callTool(toolName, args)
      }
    }

    return {
      success: false,
      contentType: 'error',
      content: `Tool not found: ${toolName}`
    }
  }

  /**
   * 处理 VCP 请求
   */
  async handleVCPRequest(request: VCPToolRequest): Promise<VCPToolResponse> {
    const startTime = Date.now()

    // 尝试在所有服务器中查找工具
    for (const executor of this.executors.values()) {
      if (await executor.isToolAvailable(request.toolName)) {
        return executor.callVCP(request)
      }
    }

    return {
      success: false,
      error: `Tool not found: ${request.toolName}`,
      executionTime: Date.now() - startTime
    }
  }

  /**
   * 列出所有插件
   */
  async listAllPlugins(): Promise<
    Array<{
      serverId: string
      serverName: string
      plugins: VCPPluginInfo[]
    }>
  > {
    const result: Array<{
      serverId: string
      serverName: string
      plugins: VCPPluginInfo[]
    }> = []

    for (const executor of this.executors.values()) {
      const config = executor.getConfig()
      const plugins = await executor.listPlugins()

      result.push({
        serverId: config.id,
        serverName: config.name,
        plugins
      })
    }

    return result
  }

  /**
   * 将 VCP 服务器转换为统一插件元数据
   */
  toPluginMetadata(config: VCPServerConfig): UnifiedPluginMetadata {
    const capabilities: PluginCapabilities = {
      tools: true,
      preprocessing: true,
      asyncCallback: true
    }

    return {
      id: `vcp:${config.id}`,
      name: config.name,
      displayName: config.name,
      version: '1.0.0',
      protocol: 'vcp',
      type: 'tool',
      capabilities,
      enabled: config.enabled ?? false
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    for (const executor of this.executors.values()) {
      executor.clearCache()
    }
    logger.info('All VCP caches cleared')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    serverCount: number
    activeCount: number
  } {
    let activeCount = 0

    for (const executor of this.executors.values()) {
      const config = executor.getConfig()
      if (config.enabled) {
        activeCount++
      }
    }

    return {
      serverCount: this.executors.size,
      activeCount
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 VCP 适配器
 */
export function createVCPAdapter(): VCPAdapter {
  return new VCPAdapter()
}
