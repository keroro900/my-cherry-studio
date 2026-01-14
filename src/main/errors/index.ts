/**
 * 统一错误处理模块
 *
 * 提供一致的错误类型、错误码和错误处理机制
 * 兼容 MCP SDK 的 McpError 格式
 *
 * @module errors
 */

// 基础错误码 (兼容 MCP ErrorCode)
export enum PluginErrorCode {
  // 通用错误 (1xxx)
  Unknown = 1000,
  Internal = 1001,
  NotFound = 1002,
  AlreadyExists = 1003,
  PermissionDenied = 1004,
  Timeout = 1005,
  Cancelled = 1006,

  // 验证错误 (2xxx)
  InvalidParams = 2000,
  InvalidFormat = 2001,
  MissingRequired = 2002,
  OutOfRange = 2003,
  TypeMismatch = 2004,

  // MCP 错误 (3xxx)
  MCPConnectionFailed = 3000,
  MCPServerNotFound = 3001,
  MCPToolNotFound = 3002,
  MCPMethodNotFound = 3003,
  MCPProtocolError = 3004,
  MCPAuthRequired = 3005,
  MCPAuthFailed = 3006,

  // VCP 错误 (4xxx)
  VCPProtocolError = 4000,
  VCPParseError = 4001,
  VCPExecutionError = 4002,
  VCPConfigError = 4003,

  // 插件错误 (5xxx)
  PluginNotFound = 5000,
  PluginLoadFailed = 5001,
  PluginExecutionFailed = 5002,
  PluginConfigInvalid = 5003,
  PluginVersionMismatch = 5004,

  // 网络错误 (6xxx)
  NetworkError = 6000,
  NetworkTimeout = 6001,
  NetworkUnreachable = 6002
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 可恢复的警告 */
  Warning = 'warning',
  /** 操作失败但可重试 */
  Error = 'error',
  /** 系统级致命错误 */
  Fatal = 'fatal'
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /** 错误发生的服务/模块名 */
  service?: string
  /** 操作名称 */
  operation?: string
  /** 相关实体 ID */
  entityId?: string
  /** 原始错误 */
  cause?: Error | unknown
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 用户友好的错误信息配置
 */
export interface UserFriendlyMessage {
  /** 简短标题 */
  title: string
  /** 详细描述 */
  description?: string
  /** 建议的操作 */
  suggestion?: string
  /** 是否可重试 */
  retryable?: boolean
}

/**
 * 插件系统基础错误类
 *
 * 所有插件相关错误的基类，提供统一的错误格式和处理机制
 */
export class PluginError extends Error {
  /** 错误码 */
  public readonly code: PluginErrorCode
  /** 严重级别 */
  public readonly severity: ErrorSeverity
  /** 错误上下文 */
  public readonly context: ErrorContext
  /** 用户友好信息 */
  public readonly userMessage?: UserFriendlyMessage
  /** 时间戳 */
  public readonly timestamp: Date

  constructor(
    code: PluginErrorCode,
    message: string,
    options?: {
      severity?: ErrorSeverity
      context?: ErrorContext
      userMessage?: UserFriendlyMessage
    }
  ) {
    super(message)
    this.name = 'PluginError'
    this.code = code
    this.severity = options?.severity ?? ErrorSeverity.Error
    this.context = options?.context ?? {}
    this.userMessage = options?.userMessage
    this.timestamp = new Date()

    // 保持原型链
    Object.setPrototypeOf(this, new.target.prototype)

    // 捕获堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * 转换为 JSON 格式 (用于日志和 API 响应)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      userMessage: this.userMessage,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    }
  }

  /**
   * 获取用户友好的消息
   */
  getUserMessage(): string {
    if (this.userMessage) {
      let msg = this.userMessage.title
      if (this.userMessage.description) {
        msg += `: ${this.userMessage.description}`
      }
      if (this.userMessage.suggestion) {
        msg += ` (${this.userMessage.suggestion})`
      }
      return msg
    }
    return this.message
  }

  /**
   * 是否可重试
   */
  isRetryable(): boolean {
    return this.userMessage?.retryable ?? false
  }

  /**
   * 包装原始错误
   */
  static wrap(error: unknown, code?: PluginErrorCode, context?: ErrorContext): PluginError {
    if (error instanceof PluginError) {
      return error
    }

    const message = error instanceof Error ? error.message : String(error)
    return new PluginError(code ?? PluginErrorCode.Unknown, message, {
      context: {
        ...context,
        cause: error
      }
    })
  }
}

/**
 * MCP 相关错误
 */
export class MCPError extends PluginError {
  /** MCP 服务器信息 */
  public readonly serverInfo?: { id: string; name: string; type?: string }

  constructor(
    code: PluginErrorCode,
    message: string,
    options?: {
      severity?: ErrorSeverity
      context?: ErrorContext
      userMessage?: UserFriendlyMessage
      serverInfo?: { id: string; name: string; type?: string }
    }
  ) {
    super(code, message, options)
    this.name = 'MCPError'
    this.serverInfo = options?.serverInfo
  }

  /**
   * 从 MCP SDK 错误创建
   */
  static fromMcpError(error: { code: number; message: string }, serverInfo?: { id: string; name: string }): MCPError {
    // 映射 MCP SDK ErrorCode 到 PluginErrorCode
    const codeMap: Record<number, PluginErrorCode> = {
      [-32700]: PluginErrorCode.VCPParseError, // ParseError
      [-32600]: PluginErrorCode.InvalidParams, // InvalidRequest
      [-32601]: PluginErrorCode.MCPMethodNotFound, // MethodNotFound
      [-32602]: PluginErrorCode.InvalidParams, // InvalidParams
      [-32603]: PluginErrorCode.Internal // InternalError
    }

    const pluginCode = codeMap[error.code] ?? PluginErrorCode.MCPProtocolError

    return new MCPError(pluginCode, error.message, {
      serverInfo,
      context: {
        metadata: { originalCode: error.code }
      }
    })
  }

  /**
   * 连接失败错误
   */
  static connectionFailed(serverInfo: { id: string; name: string }, cause?: Error): MCPError {
    return new MCPError(PluginErrorCode.MCPConnectionFailed, `Failed to connect to MCP server: ${serverInfo.name}`, {
      severity: ErrorSeverity.Error,
      serverInfo,
      context: { cause },
      userMessage: {
        title: 'Connection Failed',
        description: `Cannot connect to server "${serverInfo.name}"`,
        suggestion: 'Check if the server is running and configuration is correct',
        retryable: true
      }
    })
  }

  /**
   * 服务器未找到错误
   */
  static serverNotFound(serverId: string): MCPError {
    return new MCPError(PluginErrorCode.MCPServerNotFound, `MCP server not found: ${serverId}`, {
      context: { entityId: serverId },
      userMessage: {
        title: 'Server Not Found',
        description: `Server with ID "${serverId}" does not exist`,
        suggestion: 'Please check the server configuration'
      }
    })
  }

  /**
   * 工具未找到错误
   */
  static toolNotFound(toolName: string, serverName?: string): MCPError {
    return new MCPError(
      PluginErrorCode.MCPToolNotFound,
      `Tool not found: ${toolName}${serverName ? ` on server ${serverName}` : ''}`,
      {
        context: { entityId: toolName },
        userMessage: {
          title: 'Tool Not Found',
          description: `The tool "${toolName}" is not available`,
          suggestion: 'Make sure the server is connected and the tool is enabled'
        }
      }
    )
  }

  /**
   * 认证错误
   */
  static authRequired(serverInfo: { id: string; name: string }): MCPError {
    return new MCPError(PluginErrorCode.MCPAuthRequired, `Authentication required for server: ${serverInfo.name}`, {
      serverInfo,
      userMessage: {
        title: 'Authentication Required',
        description: `Server "${serverInfo.name}" requires authentication`,
        suggestion: 'Please complete the OAuth flow',
        retryable: true
      }
    })
  }
}

/**
 * VCP 协议错误
 */
export class VCPError extends PluginError {
  /** VCP 请求信息 */
  public readonly requestInfo?: { toolName: string; action?: string }

  constructor(
    code: PluginErrorCode,
    message: string,
    options?: {
      severity?: ErrorSeverity
      context?: ErrorContext
      userMessage?: UserFriendlyMessage
      requestInfo?: { toolName: string; action?: string }
    }
  ) {
    super(code, message, options)
    this.name = 'VCPError'
    this.requestInfo = options?.requestInfo
  }

  /**
   * 协议解析错误
   */
  static parseError(message: string, rawContent?: string): VCPError {
    return new VCPError(PluginErrorCode.VCPParseError, `Failed to parse VCP request: ${message}`, {
      context: { metadata: { rawContent: rawContent?.substring(0, 500) } },
      userMessage: {
        title: 'Protocol Parse Error',
        description: 'Invalid VCP request format'
      }
    })
  }

  /**
   * 执行错误
   */
  static executionError(toolName: string, cause?: Error): VCPError {
    return new VCPError(PluginErrorCode.VCPExecutionError, `VCP tool execution failed: ${toolName}`, {
      requestInfo: { toolName },
      context: { cause },
      userMessage: {
        title: 'Execution Failed',
        description: `Tool "${toolName}" failed to execute`,
        retryable: true
      }
    })
  }
}

/**
 * 验证错误
 */
export class ValidationError extends PluginError {
  /** 验证失败的字段 */
  public readonly fields?: Array<{ field: string; message: string }>

  constructor(
    message: string,
    options?: {
      code?: PluginErrorCode
      fields?: Array<{ field: string; message: string }>
      context?: ErrorContext
    }
  ) {
    super(options?.code ?? PluginErrorCode.InvalidParams, message, {
      severity: ErrorSeverity.Warning,
      context: options?.context
    })
    this.name = 'ValidationError'
    this.fields = options?.fields
  }

  /**
   * 必填字段缺失
   */
  static missingRequired(fieldName: string): ValidationError {
    return new ValidationError(`Required field missing: ${fieldName}`, {
      code: PluginErrorCode.MissingRequired,
      fields: [{ field: fieldName, message: 'This field is required' }]
    })
  }

  /**
   * 格式无效
   */
  static invalidFormat(fieldName: string, expected: string): ValidationError {
    return new ValidationError(`Invalid format for ${fieldName}: expected ${expected}`, {
      code: PluginErrorCode.InvalidFormat,
      fields: [{ field: fieldName, message: `Expected format: ${expected}` }]
    })
  }

  /**
   * 从 Zod 错误创建
   */
  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const fields = zodError.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }))
    return new ValidationError('Validation failed', {
      code: PluginErrorCode.InvalidParams,
      fields
    })
  }
}

/**
 * 错误处理工具函数
 */
export const ErrorUtils = {
  /**
   * 判断是否为可重试错误
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof PluginError) {
      return error.isRetryable()
    }
    // 网络错误通常可重试
    if (error instanceof Error) {
      const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE']
      return retryableCodes.some((code) => error.message.includes(code))
    }
    return false
  },

  /**
   * 获取用户友好消息
   */
  getUserMessage(error: unknown): string {
    if (error instanceof PluginError) {
      return error.getUserMessage()
    }
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  },

  /**
   * 获取错误码
   */
  getErrorCode(error: unknown): PluginErrorCode {
    if (error instanceof PluginError) {
      return error.code
    }
    return PluginErrorCode.Unknown
  },

  /**
   * 安全执行并包装错误
   */
  async safeExecute<T>(
    fn: () => Promise<T>,
    options?: {
      errorCode?: PluginErrorCode
      context?: ErrorContext
      fallback?: T
    }
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (options?.fallback !== undefined) {
        return options.fallback
      }
      throw PluginError.wrap(error, options?.errorCode, options?.context)
    }
  }
}
