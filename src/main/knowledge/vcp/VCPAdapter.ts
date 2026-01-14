/**
 * VCP Adapter - VCP 到 MCP 的协议适配器
 *
 * 让 VCP 插件可以作为 MCP 工具使用
 * Cherry Studio 现有的 MCP 客户端可以调用 VCP 插件
 *
 * v2.0.0: 迁移至 VCPRuntime，移除对 PluginManager 的依赖
 */

import { loggerService } from '@logger'

import { getVCPRuntime } from '../../services/vcp/VCPRuntime'
import type { VCPPlugin as NativeVCPPlugin } from '../../services/vcp/types'
import type { MCPToolCall, MCPToolDefinition, MCPToolResult, VCPFullPlugin, VCPPluginExecutor } from './types'
import { mcpToVCPParams, vcpToMCPResult, vcpToMCPToolDefinition } from './types'

const logger = loggerService.withContext('VCPAdapter')

/**
 * 将 VCPRuntime 的 VCPPlugin 转换为 VCPFullPlugin 格式
 * 用于兼容现有代码
 */
function nativePluginToFullPlugin(plugin: NativeVCPPlugin): VCPFullPlugin {
  const manifest = plugin.manifest

  // 从 capabilities.toolFunctions 提取参数定义
  const params =
    manifest.capabilities?.toolFunctions?.flatMap((fn) => {
      if (!fn.parameters?.properties) return []
      return Object.entries(fn.parameters.properties).map(([name, prop]) => ({
        name,
        description: prop.description || '',
        type: (prop.type as 'string' | 'number' | 'boolean' | 'object' | 'array') || 'string',
        required: fn.parameters?.required?.includes(name) || false,
        default: prop.default,
        enum: prop.enum
      }))
    }) || []

  // 创建执行器代理（通过 VCPRuntime 执行）
  const executor: VCPPluginExecutor = {
    async execute(execParams) {
      const runtime = getVCPRuntime()
      const result = await runtime.executeTool(manifest.name, execParams)
      return {
        success: result.success,
        output: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
        data: result.data,
        error: result.error,
        taskId: result.taskId,
        executionTimeMs: result.executionTimeMs
      }
    }
  }

  return {
    id: manifest.name,
    name: manifest.name,
    displayName: manifest.displayName || manifest.name,
    description: manifest.description || '',
    version: manifest.version || '1.0.0',
    author: manifest.author,
    type: manifest.pluginType,
    params,
    executor,
    enabled: plugin.enabled,
    loadedAt: new Date()
  }
}

/**
 * VCPRuntime 插件管理器适配接口
 * 兼容旧 VCPPluginManager 接口
 */
interface VCPRuntimeAdapter {
  getAllPlugins(): VCPFullPlugin[]
  getEnabledPlugins(): VCPFullPlugin[]
  getPlugin(name: string): VCPFullPlugin | undefined
}

/**
 * MCP 工具处理器类型
 */
export type MCPToolHandler = (args: Record<string, unknown>) => Promise<MCPToolResult>

/**
 * 适配后的 MCP 工具
 */
export interface AdaptedMCPTool {
  /** 工具定义 */
  definition: MCPToolDefinition
  /** 工具处理器 */
  handler: MCPToolHandler
  /** 源 VCP 插件 ID */
  sourcePluginId: string
}

/**
 * 创建 VCPRuntime 适配器
 * 将 VCPRuntime 包装为兼容 VCPPluginManager 的接口
 */
function createRuntimeAdapter(): VCPRuntimeAdapter {
  return {
    getAllPlugins(): VCPFullPlugin[] {
      const runtime = getVCPRuntime()
      return runtime.listPlugins().map(nativePluginToFullPlugin)
    },
    getEnabledPlugins(): VCPFullPlugin[] {
      const runtime = getVCPRuntime()
      return runtime.listEnabledPlugins().map(nativePluginToFullPlugin)
    },
    getPlugin(name: string): VCPFullPlugin | undefined {
      const runtime = getVCPRuntime()
      const plugin = runtime.getPlugin(name)
      return plugin ? nativePluginToFullPlugin(plugin) : undefined
    }
  }
}

/**
 * VCP Adapter - 将 VCP 插件暴露为 MCP 工具
 *
 * 设计目标：
 * 1. Cherry Studio 现有的 MCP 客户端可以调用 VCP 插件
 * 2. 第三方 MCP 客户端也可以通过此适配器调用 VCP 插件
 * 3. 保持完整的 MCP 协议兼容性
 *
 * v2.0.0: 使用 VCPRuntime 替代 PluginManager
 */
export class VCPAdapter {
  /** 运行时适配器 */
  private runtimeAdapter: VCPRuntimeAdapter

  /** 已适配的 MCP 工具缓存 */
  private adaptedTools: Map<string, AdaptedMCPTool> = new Map()

  /** 工具名称到 VCP 插件 ID 的映射 */
  private toolNameToPluginId: Map<string, string> = new Map()

  /** 调试模式 */
  private debugMode = process.env.DEBUG_VCP_ADAPTER === 'true'

  constructor(runtimeAdapter?: VCPRuntimeAdapter) {
    this.runtimeAdapter = runtimeAdapter || createRuntimeAdapter()
  }

  /**
   * 将 VCP 插件暴露为 MCP 工具
   */
  exposeAsVCPTool(vcpPlugin: VCPFullPlugin): AdaptedMCPTool {
    // 使用类型定义中的转换函数生成 MCP 工具定义
    const mcpDefinition = vcpToMCPToolDefinition(vcpPlugin)

    // 创建处理器
    const handler: MCPToolHandler = async (args) => {
      return this.executeVCPPlugin(vcpPlugin, args)
    }

    const adaptedTool: AdaptedMCPTool = {
      definition: mcpDefinition,
      handler,
      sourcePluginId: vcpPlugin.id
    }

    // 缓存
    this.adaptedTools.set(mcpDefinition.name, adaptedTool)
    this.toolNameToPluginId.set(mcpDefinition.name, vcpPlugin.id)

    if (this.debugMode) {
      logger.debug(`Exposed VCP plugin as MCP tool: ${vcpPlugin.name}`)
    }

    return adaptedTool
  }

  /**
   * 批量暴露 VCP 插件
   */
  exposeAllPlugins(): AdaptedMCPTool[] {
    const plugins = this.runtimeAdapter.getAllPlugins()
    const tools: AdaptedMCPTool[] = []

    for (const plugin of plugins) {
      // 只暴露同步和异步类型的插件
      if (plugin.type === 'synchronous' || plugin.type === 'asynchronous') {
        try {
          const tool = this.exposeAsVCPTool(plugin)
          tools.push(tool)
        } catch (error) {
          logger.error(`Failed to expose plugin ${plugin.name}`, { error: String(error) })
        }
      }
    }

    logger.info(`Exposed ${tools.length} VCP plugins as MCP tools`)
    return tools
  }

  /**
   * 执行 VCP 插件
   */
  private async executeVCPPlugin(plugin: VCPFullPlugin, args: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      // 将 MCP 参数转换为 VCP 格式
      const vcpParams = mcpToVCPParams(args)

      // 执行 VCP 插件
      const result = await plugin.executor.execute(vcpParams)

      // 将 VCP 结果转换为 MCP 格式
      return vcpToMCPResult(result)
    } catch (error) {
      logger.error(`Error executing VCP plugin ${plugin.name}`, { error: String(error) })

      return {
        content: [
          {
            type: 'text',
            text: `Error executing plugin: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * 通过 MCP 工具名称执行工具
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const adaptedTool = this.adaptedTools.get(toolName)

    if (!adaptedTool) {
      return {
        content: [{ type: 'text', text: `Tool "${toolName}" not found` }],
        isError: true
      }
    }

    return adaptedTool.handler(args)
  }

  /**
   * 处理 MCP 工具调用
   */
  async handleMCPToolCall(toolCall: MCPToolCall): Promise<MCPToolResult> {
    return this.executeTool(toolCall.name, toolCall.arguments)
  }

  /**
   * 获取所有 MCP 工具定义
   */
  getToolDefinitions(): MCPToolDefinition[] {
    return Array.from(this.adaptedTools.values()).map((t) => t.definition)
  }

  /**
   * 获取适配后的工具
   */
  getAdaptedTool(toolName: string): AdaptedMCPTool | undefined {
    return this.adaptedTools.get(toolName)
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return this.adaptedTools.has(toolName)
  }

  /**
   * 获取工具对应的 VCP 插件 ID
   */
  getSourcePluginId(toolName: string): string | undefined {
    return this.toolNameToPluginId.get(toolName)
  }

  /**
   * 刷新工具列表 (当插件列表变化时调用)
   */
  refresh(): void {
    this.adaptedTools.clear()
    this.toolNameToPluginId.clear()
    this.exposeAllPlugins()
    logger.info('VCP Adapter tools refreshed')
  }

  /**
   * 移除指定插件的适配
   */
  removePlugin(pluginId: string): void {
    for (const [toolName, tool] of this.adaptedTools.entries()) {
      if (tool.sourcePluginId === pluginId) {
        this.adaptedTools.delete(toolName)
        this.toolNameToPluginId.delete(toolName)
      }
    }
  }

  /**
   * 生成 MCP 工具列表响应 (符合 MCP 协议)
   */
  generateToolListResponse(): { tools: MCPToolDefinition[] } {
    return {
      tools: this.getToolDefinitions()
    }
  }

  /**
   * 生成 MCP 工具调用响应 (符合 MCP 协议)
   */
  async generateToolCallResponse(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{
    content: MCPToolResult['content']
    isError?: boolean
  }> {
    const result = await this.executeTool(toolName, args)
    return {
      content: result.content,
      isError: result.isError
    }
  }
}

/**
 * MCP 服务器适配器
 *
 * 将 VCPAdapter 封装为 MCP 服务器接口
 * 可被 Cherry Studio 的 MCP 客户端直接使用
 *
 * v2.0.0: 使用 VCPRuntime
 */
export class VCPAsMCPServer {
  /** VCP 适配器 */
  private adapter: VCPAdapter

  /** 服务器名称 */
  public readonly name: string

  /** 服务器描述 */
  public readonly description: string

  constructor(options?: {
    name?: string
    description?: string
    runtimeAdapter?: VCPRuntimeAdapter
  }) {
    this.name = options?.name || 'vcp-plugins'
    this.description = options?.description || 'VCP Plugins as MCP Tools'
    this.adapter = new VCPAdapter(options?.runtimeAdapter)
  }

  /**
   * 初始化服务器
   */
  async initialize(): Promise<void> {
    this.adapter.exposeAllPlugins()
    logger.info(`VCP as MCP Server "${this.name}" initialized`)
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    return this.adapter.getToolDefinitions()
  }

  /**
   * 执行工具
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    return this.adapter.executeTool(name, args)
  }

  /**
   * 处理工具调用请求
   */
  async handleToolCall(request: { name: string; arguments: Record<string, unknown> }): Promise<MCPToolResult> {
    return this.adapter.handleMCPToolCall(request)
  }

  /**
   * 刷新工具列表
   */
  refresh(): void {
    this.adapter.refresh()
  }

  /**
   * 获取底层适配器
   */
  getAdapter(): VCPAdapter {
    return this.adapter
  }
}

/** 单例实例 */
let vcpAdapterInstance: VCPAdapter | null = null
let vcpAsMCPServerInstance: VCPAsMCPServer | null = null

/**
 * 获取 VCP Adapter 实例
 */
export function getVCPAdapter(): VCPAdapter {
  if (!vcpAdapterInstance) {
    vcpAdapterInstance = new VCPAdapter()
  }
  return vcpAdapterInstance
}

/**
 * 获取 VCP as MCP Server 实例
 */
export function getVCPAsMCPServer(): VCPAsMCPServer {
  if (!vcpAsMCPServerInstance) {
    vcpAsMCPServerInstance = new VCPAsMCPServer()
  }
  return vcpAsMCPServerInstance
}

/**
 * 创建新的 VCP Adapter 实例
 */
export function createVCPAdapter(runtimeAdapter?: VCPRuntimeAdapter): VCPAdapter {
  vcpAdapterInstance = new VCPAdapter(runtimeAdapter)
  return vcpAdapterInstance
}

/**
 * 创建新的 VCP as MCP Server 实例
 */
export function createVCPAsMCPServer(options?: {
  name?: string
  description?: string
  runtimeAdapter?: VCPRuntimeAdapter
}): VCPAsMCPServer {
  vcpAsMCPServerInstance = new VCPAsMCPServer(options)
  return vcpAsMCPServerInstance
}
