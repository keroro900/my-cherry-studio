/**
 * 统一协议层 (Unified Plugin Layer)
 *
 * 融合 MCP 和 VCP 协议，提供统一的插件调用接口
 *
 * @module upl
 */

import { loggerService } from '@logger'

import { VCPError } from '../errors'

const logger = loggerService.withContext('UPL')

// ==================== 统一插件类型 ====================

/**
 * 底层协议类型
 */
export type PluginProtocol = 'mcp' | 'vcp' | 'hybrid'

/**
 * 统一插件类型 (融合 MCP 和 VCP 6种类型)
 */
export type UnifiedPluginType =
  | 'static' // 静态数据注入 (VCP)
  | 'preprocessor' // 消息预处理器 (VCP)
  | 'tool' // 工具调用 (MCP + VCP sync/async)
  | 'service' // HTTP 服务 (VCP service)
  | 'resource' // 资源提供 (MCP resources)
  | 'prompt' // 提示词模板 (MCP prompts)

/**
 * 插件能力声明
 */
export interface PluginCapabilities {
  /** 是否支持工具调用 */
  tools?: boolean
  /** 是否支持资源访问 */
  resources?: boolean
  /** 是否支持提示词 */
  prompts?: boolean
  /** 是否支持采样 */
  sampling?: boolean
  /** 是否支持消息预处理 */
  preprocessing?: boolean
  /** 是否支持异步回调 */
  asyncCallback?: boolean
}

/**
 * 统一插件元数据
 */
export interface UnifiedPluginMetadata {
  /** 插件 ID */
  id: string
  /** 插件名称 */
  name: string
  /** 显示名称 */
  displayName?: string
  /** 版本号 */
  version: string
  /** 描述 */
  description?: string
  /** 底层协议 */
  protocol: PluginProtocol
  /** 插件类型 */
  type: UnifiedPluginType
  /** 能力声明 */
  capabilities: PluginCapabilities
  /** 分类 */
  category?: string
  /** 标签 */
  tags?: string[]
  /** Logo URL */
  logoUrl?: string
  /** 提供商 */
  provider?: string
  /** 是否启用 */
  enabled: boolean
  /** 是否需要配置 */
  requiresConfig?: boolean
}

// ==================== 工具调用类型 ====================

/**
 * 统一工具输入
 */
export interface UnifiedToolInput {
  /** 工具名称 */
  toolName: string
  /** 参数 */
  arguments: Record<string, unknown>
  /** 调用 ID */
  callId?: string
  /** 超时 (ms) */
  timeout?: number
}

/**
 * 统一工具输出
 */
export interface UnifiedToolOutput {
  /** 是否成功 */
  success: boolean
  /** 内容类型 */
  contentType: 'text' | 'json' | 'binary' | 'error'
  /** 内容 */
  content: unknown
  /** 执行时间 (ms) */
  executionTime?: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}

// ==================== VCP 协议类型 ====================

/**
 * VCP 工具请求 (从 <<<[TOOL_REQUEST]>>> 解析)
 */
export interface VCPToolRequest {
  /** 工具名称 */
  toolName: string
  /** 操作 (如 call_tool, list_tools) */
  action?: string
  /** 工具参数 */
  arguments: Record<string, unknown>
  /** 原始请求文本 */
  rawRequest?: string
}

/**
 * VCP 工具响应
 */
export interface VCPToolResponse {
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  result?: unknown
  /** 错误信息 */
  error?: string
  /** 执行时间 */
  executionTime?: number
}

// ==================== VCP 协议解析器 ====================

/**
 * VCP 指令协议解析器
 *
 * 解析 VCPToolBox 风格的工具请求格式：
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」MCPO「末」,
 * action:「始」call_tool「末」,
 * ...
 * <<<[END_TOOL_REQUEST]>>>
 */
export class VCPProtocolParser {
  private static readonly REQUEST_PATTERN = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g
  private static readonly PARAM_PATTERN = /(\w+):「始」([\s\S]*?)「末」/g

  /**
   * 解析文本中的所有 VCP 请求
   */
  parse(text: string): VCPToolRequest[] {
    const requests: VCPToolRequest[] = []

    // 重置正则匹配位置
    VCPProtocolParser.REQUEST_PATTERN.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = VCPProtocolParser.REQUEST_PATTERN.exec(text)) !== null) {
      try {
        const request = this.parseRequest(match[1], match[0])
        requests.push(request)
      } catch (error) {
        logger.warn('Failed to parse VCP request', { error, rawContent: match[0].substring(0, 200) })
      }
    }

    return requests
  }

  /**
   * 解析单个请求内容
   */
  private parseRequest(content: string, rawRequest: string): VCPToolRequest {
    const params: Record<string, string> = {}

    // 重置正则匹配位置
    VCPProtocolParser.PARAM_PATTERN.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = VCPProtocolParser.PARAM_PATTERN.exec(content)) !== null) {
      const key = match[1].trim()
      const value = match[2].trim()
      params[key] = value
    }

    const toolName = params['tool_name']
    if (!toolName) {
      throw VCPError.parseError('Missing tool_name parameter', content)
    }

    // 解析 arguments (可能是 JSON 字符串)
    let args: Record<string, unknown> = {}
    if (params['arguments']) {
      try {
        args = JSON.parse(params['arguments'])
      } catch {
        // 如果不是 JSON，尝试作为单个值处理
        args = { value: params['arguments'] }
      }
    }

    // 收集其他参数作为 arguments
    const reservedKeys = ['tool_name', 'action', 'arguments']
    for (const [key, value] of Object.entries(params)) {
      if (!reservedKeys.includes(key)) {
        args[key] = value
      }
    }

    return {
      toolName,
      action: params['action'],
      arguments: args,
      rawRequest
    }
  }

  /**
   * 格式化 VCP 响应
   */
  formatResponse(response: VCPToolResponse): string {
    const lines = ['<<<[TOOL_RESPONSE]>>>']

    if (response.success) {
      lines.push(`status:「始」success「末」`)
      if (response.result !== undefined) {
        const resultStr =
          typeof response.result === 'object' ? JSON.stringify(response.result, null, 2) : String(response.result)
        lines.push(`result:「始」${resultStr}「末」`)
      }
    } else {
      lines.push(`status:「始」error「末」`)
      lines.push(`error:「始」${response.error || 'Unknown error'}「末」`)
    }

    if (response.executionTime !== undefined) {
      lines.push(`execution_time:「始」${response.executionTime}ms「末」`)
    }

    lines.push('<<<[END_TOOL_RESPONSE]>>>')

    return lines.join('\n')
  }

  /**
   * 检查文本是否包含 VCP 请求
   */
  hasVCPRequest(text: string): boolean {
    return text.includes('<<<[TOOL_REQUEST]>>>')
  }

  /**
   * 清理文本中的 VCP 请求 (返回干净的文本)
   */
  cleanText(text: string): string {
    return text.replace(VCPProtocolParser.REQUEST_PATTERN, '').trim()
  }
}

// ==================== 统一执行器接口 ====================

/**
 * 统一执行器接口
 *
 * 支持 MCP 和 VCP 两种调用风格
 */
export interface UnifiedExecutor {
  /** 执行器 ID */
  readonly id: string

  /** 支持的协议 */
  readonly protocol: PluginProtocol

  /**
   * MCP 风格调用 - 结构化参数
   */
  callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput>

  /**
   * VCP 风格调用 - 解析请求对象
   */
  callVCP(request: VCPToolRequest): Promise<VCPToolResponse>

  /**
   * 统一调用 - 自动选择协议
   */
  execute(input: UnifiedToolInput): Promise<UnifiedToolOutput>

  /**
   * 列出可用工具
   */
  listTools(): Promise<
    Array<{
      name: string
      description?: string
      inputSchema?: Record<string, unknown>
    }>
  >

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName: string): Promise<boolean>
}

// ==================== 基础执行器实现 ====================

/**
 * 抽象基础执行器
 */
export abstract class BaseUnifiedExecutor implements UnifiedExecutor {
  abstract readonly id: string
  abstract readonly protocol: PluginProtocol

  protected readonly vcpParser = new VCPProtocolParser()

  abstract callTool(toolName: string, args: Record<string, unknown>): Promise<UnifiedToolOutput>

  async callVCP(request: VCPToolRequest): Promise<VCPToolResponse> {
    const startTime = Date.now()

    try {
      const output = await this.callTool(request.toolName, request.arguments)

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

  async execute(input: UnifiedToolInput): Promise<UnifiedToolOutput> {
    const startTime = Date.now()

    try {
      const result = await this.callTool(input.toolName, input.arguments)
      return {
        ...result,
        executionTime: result.executionTime || Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        contentType: 'error',
        content: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      }
    }
  }

  abstract listTools(): Promise<
    Array<{
      name: string
      description?: string
      inputSchema?: Record<string, unknown>
    }>
  >

  async isToolAvailable(toolName: string): Promise<boolean> {
    try {
      const tools = await this.listTools()
      return tools.some((t) => t.name === toolName)
    } catch {
      return false
    }
  }
}

// ==================== 插件注册表 ====================

/**
 * 统一插件注册表
 */
export class UnifiedPluginRegistry {
  private static instance: UnifiedPluginRegistry
  private plugins: Map<string, UnifiedPluginMetadata> = new Map()
  private executors: Map<string, UnifiedExecutor> = new Map()

  private constructor() {}

  static getInstance(): UnifiedPluginRegistry {
    if (!UnifiedPluginRegistry.instance) {
      UnifiedPluginRegistry.instance = new UnifiedPluginRegistry()
    }
    return UnifiedPluginRegistry.instance
  }

  /**
   * 注册插件
   */
  register(metadata: UnifiedPluginMetadata, executor: UnifiedExecutor): void {
    if (this.plugins.has(metadata.id)) {
      logger.warn('Plugin already registered, overwriting', { pluginId: metadata.id })
    }

    this.plugins.set(metadata.id, metadata)
    this.executors.set(metadata.id, executor)

    logger.info('Plugin registered', {
      pluginId: metadata.id,
      name: metadata.name,
      protocol: metadata.protocol,
      type: metadata.type
    })
  }

  /**
   * 注销插件
   */
  unregister(pluginId: string): boolean {
    const deleted = this.plugins.delete(pluginId)
    this.executors.delete(pluginId)

    if (deleted) {
      logger.info('Plugin unregistered', { pluginId })
    }

    return deleted
  }

  /**
   * 获取插件元数据
   */
  getPlugin(pluginId: string): UnifiedPluginMetadata | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * 获取执行器
   */
  getExecutor(pluginId: string): UnifiedExecutor | undefined {
    return this.executors.get(pluginId)
  }

  /**
   * 列出所有插件
   */
  listPlugins(filter?: {
    protocol?: PluginProtocol
    type?: UnifiedPluginType
    enabled?: boolean
    category?: string
  }): UnifiedPluginMetadata[] {
    let result = Array.from(this.plugins.values())

    if (filter) {
      if (filter.protocol) {
        result = result.filter((p) => p.protocol === filter.protocol)
      }
      if (filter.type) {
        result = result.filter((p) => p.type === filter.type)
      }
      if (filter.enabled !== undefined) {
        result = result.filter((p) => p.enabled === filter.enabled)
      }
      if (filter.category) {
        result = result.filter((p) => p.category === filter.category)
      }
    }

    return result
  }

  /**
   * 按协议查找插件
   */
  findByProtocol(protocol: PluginProtocol): UnifiedPluginMetadata[] {
    return this.listPlugins({ protocol })
  }

  /**
   * 按类型查找插件
   */
  findByType(type: UnifiedPluginType): UnifiedPluginMetadata[] {
    return this.listPlugins({ type })
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.plugins.clear()
    this.executors.clear()
    logger.info('Plugin registry cleared')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number
    byProtocol: Record<PluginProtocol, number>
    byType: Record<UnifiedPluginType, number>
    enabled: number
    disabled: number
  } {
    const plugins = Array.from(this.plugins.values())

    const byProtocol: Record<PluginProtocol, number> = { mcp: 0, vcp: 0, hybrid: 0 }
    const byType: Record<UnifiedPluginType, number> = {
      static: 0,
      preprocessor: 0,
      tool: 0,
      service: 0,
      resource: 0,
      prompt: 0
    }

    let enabled = 0
    let disabled = 0

    for (const plugin of plugins) {
      byProtocol[plugin.protocol]++
      byType[plugin.type]++
      if (plugin.enabled) {
        enabled++
      } else {
        disabled++
      }
    }

    return {
      total: plugins.length,
      byProtocol,
      byType,
      enabled,
      disabled
    }
  }
}

// ==================== 导出 ====================

export const vcpParser = new VCPProtocolParser()
export const pluginRegistry = UnifiedPluginRegistry.getInstance()

// 重新导出子模块
export * from './adapters'
export {
  dynamicConfigEngine,
  DynamicConfigEngine,
  type VariableContext,
  type DiaryDeclaration
} from './DynamicConfigEngine'
