/**
 * 工作流核心类型定义
 *
 * 统一管理所有核心类型，避免重复定义
 *
 * @version 2.1
 * @created 2024-12-11
 * @updated 2024-12-19 添加 ImageRef 图片引用类型（性能优化）
 */

// ==================== 图片引用类型 (性能优化) ====================

/**
 * 图片引用类型
 * 在节点间传递时使用引用而非完整的 Base64 数据
 *
 * 支持的引用类型：
 * - file: 本地文件路径
 * - blob: Blob URL (blob:xxx)
 * - storage: Cherry Studio 文件存储 ID (UUID)
 * - url: 远程 URL (http/https)
 * - base64: 内联 Base64 数据 (仅用于小图或兼容性)
 *
 * 使用场景：
 * - 节点输出图片时，创建 ImageRef 而非存储完整 Base64
 * - 节点间通过 ImageRef 传递，内存占用极低
 * - 仅在 WorkflowAiService 发起 API 请求时，才解析为 Base64
 */
export interface ImageRef {
  /** 引用类型标识，用于快速识别 */
  __imageRef: true

  /** 引用类型 */
  type: 'file' | 'blob' | 'storage' | 'url' | 'base64'

  /** 引用值（路径、URL、ID 或 Base64） */
  value: string

  /** MIME 类型（可选，用于优化） */
  mimeType?: string

  /** 原始文件名（可选，用于导出） */
  filename?: string

  /** 图片尺寸（可选，用于预览和优化） */
  dimensions?: { width: number; height: number }

  /** 文件大小（字节，可选） */
  size?: number

  /** 创建时间戳 */
  createdAt?: number
}

/**
 * 检查值是否为 ImageRef
 */
export function isImageRef(value: unknown): value is ImageRef {
  return typeof value === 'object' && value !== null && '__imageRef' in value && (value as ImageRef).__imageRef === true
}

/**
 * 创建文件路径引用
 */
export function createFileRef(
  filePath: string,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  return {
    __imageRef: true,
    type: 'file',
    value: filePath,
    createdAt: Date.now(),
    ...options
  }
}

/**
 * 创建 Blob URL 引用
 */
export function createBlobRef(
  blobUrl: string,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  return {
    __imageRef: true,
    type: 'blob',
    value: blobUrl,
    createdAt: Date.now(),
    ...options
  }
}

/**
 * 创建存储 ID 引用
 */
export function createStorageRef(
  storageId: string,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  return {
    __imageRef: true,
    type: 'storage',
    value: storageId,
    createdAt: Date.now(),
    ...options
  }
}

/**
 * 创建 URL 引用
 */
export function createUrlRef(
  url: string,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  return {
    __imageRef: true,
    type: 'url',
    value: url,
    createdAt: Date.now(),
    ...options
  }
}

/**
 * 创建 Base64 引用（仅用于小图或兼容性）
 */
export function createBase64Ref(
  base64: string,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  // 如果已经是 data URL，提取 MIME 类型
  let mimeType = options?.mimeType
  let pureBase64 = base64

  if (base64.startsWith('data:')) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      mimeType = mimeType || match[1]
      pureBase64 = match[2]
    }
  }

  return {
    __imageRef: true,
    type: 'base64',
    value: pureBase64,
    mimeType: mimeType || 'image/jpeg',
    createdAt: Date.now(),
    ...options
  }
}

/**
 * 从任意图片数据智能创建引用
 * 自动检测输入类型并创建合适的引用
 */
export function createImageRef(
  imageData: string | ImageRef,
  options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>
): ImageRef {
  // 已经是 ImageRef
  if (isImageRef(imageData)) {
    return imageData
  }

  // HTTP/HTTPS URL
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return createUrlRef(imageData, options)
  }

  // Blob URL
  if (imageData.startsWith('blob:')) {
    return createBlobRef(imageData, options)
  }

  // File 协议
  if (imageData.startsWith('file://')) {
    return createFileRef(imageData.replace('file://', ''), options)
  }

  // UUID 格式（Cherry Studio 存储 ID）
  if (/^[a-f0-9-]{36}$/i.test(imageData)) {
    return createStorageRef(imageData, options)
  }

  // Data URL 或纯 Base64
  if (imageData.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(imageData)) {
    return createBase64Ref(imageData, options)
  }

  // 假设是本地文件路径
  return createFileRef(imageData, options)
}

/**
 * 图片数据类型：可以是字符串（兼容旧代码）或 ImageRef
 */
export type ImageData = string | ImageRef

// ==================== 执行结果类型 ====================

/**
 * 节点执行结果 - 统一版本
 *
 * 合并了之前在多个文件中重复定义的 NodeExecutionResult
 */
export interface NodeExecutionResult {
  /** 节点ID（可选，在执行器内部使用时可能不需要） */
  nodeId?: string
  /** 执行状态 */
  status: 'success' | 'error' | 'skipped'
  /** 输出数据 (handleId -> value) */
  outputs: Record<string, any>
  /** 错误信息（当 status 为 'error' 时） */
  errorMessage?: string
  /** 执行时长（毫秒） */
  duration?: number
  /** 元数据（扩展信息） */
  metadata?: Record<string, any>
}

/**
 * 节点执行上下文
 *
 * 提供节点执行时需要的上下文信息
 */
export interface NodeExecutionContext {
  /** 节点ID */
  nodeId: string
  /** 工作流ID */
  workflowId: string
  /** 执行批次ID（批处理时使用） */
  batchId?: string
  /** 当前批次索引（批处理时使用） */
  batchIndex?: number
  /** 总批次数量（批处理时使用） */
  totalBatches?: number
  /** 日志函数（向后兼容） */
  log: (message: string, data?: Record<string, any>) => void
  /** 日志回调函数（新版本） */
  onLog?: (level: 'info' | 'warn' | 'error', message: string, data?: any) => void
  /** 进度回调函数 */
  onProgress?: (progress: number, message?: string) => void
  /** 取消信号（向后兼容：abortSignal） */
  abortSignal?: AbortSignal
  /** 取消信号（新版本：signal） */
  signal?: AbortSignal
  /** 额外的上下文数据 */
  extra?: Record<string, any>
}

/**
 * 工作流执行上下文
 *
 * 管理整个工作流执行过程中的状态
 */
export interface WorkflowExecutionContext {
  /** 工作流ID */
  workflowId: string
  /** 执行ID（每次执行唯一） */
  executionId: string
  /** 节点输出缓存 (nodeId -> outputs) */
  nodeOutputs: Map<string, Record<string, any>>
  /** 节点执行结果 (nodeId -> result) */
  nodeResults: Map<string, NodeExecutionResult>
  /** 执行开始时间 */
  startTime: number
  /** 当前执行的节点ID */
  currentNodeId?: string
  /** 执行状态 */
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  /** 全局错误信息 */
  errorMessage?: string
  /** 批处理上下文（如果是批处理执行） */
  batchContext?: BatchExecutionContext
  /** 取消信号 */
  signal?: AbortSignal
  /** 执行配置 */
  config?: WorkflowExecutionConfig
}

/**
 * 批处理执行上下文
 */
export interface BatchExecutionContext {
  /** 批次ID */
  batchId: string
  /** 当前批次索引 */
  currentBatchIndex: number
  /** 总批次数量 */
  totalBatches: number
  /** 批次数据 */
  batches: BatchItem[]
  /** 批次结果 */
  batchResults: BatchResult[]
}

/**
 * 批次项目
 */
export interface BatchItem {
  /** 批次项目ID */
  id: string
  /** 批次名称 */
  name?: string
  /** 输入数据 */
  inputs: Record<string, any>
  /** 批次索引 */
  index: number
}

/**
 * 批次执行结果
 */
export interface BatchResult {
  /** 批次项目ID */
  batchId: string
  /** 批次索引 */
  index: number
  /** 执行状态 */
  status: 'success' | 'error' | 'skipped'
  /** 输出数据 */
  outputs: Record<string, any>
  /** 执行时长 */
  duration: number
  /** 错误信息 */
  errorMessage?: string
  /** 开始时间 */
  startTime: number
  /** 结束时间 */
  endTime: number
}

/**
 * 工作流执行配置
 */
export interface WorkflowExecutionConfig {
  /** 是否启用并发执行 */
  enableConcurrency?: boolean
  /** 最大并发数 */
  maxConcurrency?: number
  /** 超时时间（毫秒） */
  timeout?: number
  /** 失败时是否停止执行 */
  stopOnFailure?: boolean
  /** 是否跳过错误节点 */
  skipErrorNodes?: boolean
  /** 重试配置 */
  retryConfig?: RetryConfig
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
  /** 指数退避因子 */
  backoffFactor?: number
  /** 需要重试的错误类型 */
  retryableErrors?: string[]
}

// ==================== 节点执行器接口 ====================

/**
 * 节点执行器接口 - 统一版本
 */
export interface NodeExecutor {
  /**
   * 执行节点
   * @param inputs 输入数据（从上游节点传递）
   * @param config 节点配置
   * @param context 执行上下文
   */
  execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult>
}

// ==================== 验证和检查类型 ====================

/**
 * 预检查结果
 */
export interface PreflightResult {
  /** 检查是否通过 */
  success: boolean
  /** 错误列表 */
  errors: PreflightIssue[]
  /** 警告列表 */
  warnings: PreflightIssue[]
  /** 建议列表 */
  suggestions: PreflightIssue[]
}

/**
 * 预检查问题
 */
export interface PreflightIssue {
  /** 问题类型 */
  type: 'error' | 'warning' | 'suggestion'
  /** 问题代码 */
  code: string
  /** 问题描述 */
  message: string
  /** 相关节点ID */
  nodeId?: string
  /** 建议修复方案 */
  suggestion?: string
  /** 是否可自动修复 */
  autoFixable?: boolean
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为成功的执行结果
 */
export function isSuccessResult(result: NodeExecutionResult): boolean {
  return result.status === 'success'
}

/**
 * 检查是否为错误的执行结果
 */
export function isErrorResult(result: NodeExecutionResult): boolean {
  return result.status === 'error'
}

/**
 * 检查是否为跳过的执行结果
 */
export function isSkippedResult(result: NodeExecutionResult): boolean {
  return result.status === 'skipped'
}

// ==================== 工厂函数 ====================

/**
 * 创建成功的执行结果
 */
export function createSuccessResult(
  outputs: Record<string, any>,
  duration?: number,
  nodeId?: string
): NodeExecutionResult {
  return {
    nodeId,
    status: 'success',
    outputs,
    duration
  }
}

/**
 * 创建错误的执行结果
 */
export function createErrorResult(errorMessage: string, duration?: number, nodeId?: string): NodeExecutionResult {
  return {
    nodeId,
    status: 'error',
    outputs: {},
    errorMessage,
    duration
  }
}

/**
 * 创建跳过的执行结果
 */
export function createSkippedResult(reason?: string, duration?: number, nodeId?: string): NodeExecutionResult {
  return {
    nodeId,
    status: 'skipped',
    outputs: {},
    errorMessage: reason,
    duration
  }
}

// ==================== 图片预览工具函数 ====================

/**
 * 获取 ImageRef 的快速预览 URL
 *
 * 用于 UI 预览场景，不需要完整解析
 * - base64 类型：返回 data URL
 * - url 类型：直接返回 URL
 * - 其他类型：返回 value（需要后续处理）
 *
 * @param image - ImageData (string 或 ImageRef)
 * @returns 可用于 img.src 的字符串
 */
export function getImagePreviewUrl(image: ImageData): string {
  if (!image) return ''

  // 字符串直接返回
  if (typeof image === 'string') {
    return image
  }

  // ImageRef 类型
  if (isImageRef(image)) {
    switch (image.type) {
      case 'base64': {
        // 构建 data URL
        const mimeType = image.mimeType || 'image/jpeg'
        return 'data:' + mimeType + ';base64,' + image.value
      }

      case 'url':
        // 直接使用 URL
        return image.value

      case 'file':
        // 本地文件路径转为 file:// URL
        if (image.value.startsWith('file://')) {
          return image.value
        }
        // Windows 路径
        if (/^[A-Za-z]:\\/.test(image.value)) {
          return 'file:///' + image.value.replace(/\\/g, '/')
        }
        return 'file://' + image.value

      case 'blob':
        // Blob URL 直接返回
        return image.value

      case 'storage':
        // 存储 ID 需要通过 API 加载，返回空或占位符
        // UI 组件应该检测到这个并显示加载状态
        return ''

      default:
        return ''
    }
  }

  return ''
}
