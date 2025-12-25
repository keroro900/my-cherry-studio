/**
 * 图片引用服务
 * Image Reference Service
 *
 * 管理图片引用的解析和转换，支持延迟加载
 * 仅在需要时（如发起 API 请求）才将引用解析为 Base64
 *
 * 性能优化目标：
 * - 节点间传递使用轻量引用（~100 bytes）而非 Base64（~数 MB）
 * - 大幅降低内存占用
 * - 提升大图处理稳定性
 *
 * @module services/ImageRefService
 */

import { loggerService } from '@logger'

import {
  createBase64Ref,
  createFileRef,
  createImageRef,
  type ImageData,
  type ImageRef,
  isImageRef
} from '../types/core'

// ============================================================================
// 日志配置
// ============================================================================

const DEBUG_MODE = process.env.NODE_ENV === 'development'
const baseLogger = loggerService.withContext('ImageRefService')

const logger = {
  debug: DEBUG_MODE ? baseLogger.debug.bind(baseLogger) : () => {},
  info: DEBUG_MODE ? baseLogger.info.bind(baseLogger) : () => {},
  warn: baseLogger.warn.bind(baseLogger),
  error: baseLogger.error.bind(baseLogger)
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 解析后的图片数据
 */
export interface ResolvedImage {
  /** Base64 数据（不含 data: 前缀） */
  base64: string
  /** MIME 类型 */
  mimeType: string
  /** 原始引用（用于追溯） */
  ref?: ImageRef
}

/**
 * 解析选项
 */
export interface ResolveOptions {
  /** 是否包含 data URL 前缀（默认 false） */
  includeDataPrefix?: boolean
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number
  /** 取消信号 */
  signal?: AbortSignal
}

// ============================================================================
// ImageRefService 类
// ============================================================================

/**
 * 图片引用服务
 *
 * 提供：
 * - resolve: 将 ImageRef 或 string 解析为 Base64
 * - resolveMany: 批量解析多个图片
 * - createRef: 从各种来源创建 ImageRef
 * - toDataUrl: 将 ImageRef 转换为 data URL
 */
class ImageRefServiceClass {
  /**
   * 解析单个图片引用为 Base64
   *
   * @param image - ImageRef 或字符串（兼容旧代码）
   * @param options - 解析选项
   * @returns 解析后的图片数据
   */
  async resolve(image: ImageData, options?: ResolveOptions): Promise<ResolvedImage> {
    const startTime = Date.now()

    try {
      // 如果是字符串，先转换为 ImageRef
      const ref = isImageRef(image) ? image : createImageRef(image)

      logger.debug('[resolve] 开始解析图片引用', {
        type: ref.type,
        valuePreview: ref.value.substring(0, 50)
      })

      let base64: string
      let mimeType: string = ref.mimeType || 'image/jpeg'

      switch (ref.type) {
        case 'base64':
          // 已经是 Base64，直接返回
          base64 = ref.value
          break

        case 'file':
          // 从本地文件读取
          const fileResult = await this.resolveFileRef(ref, options)
          base64 = fileResult.base64
          mimeType = fileResult.mimeType
          break

        case 'blob':
          // 从 Blob URL 读取
          const blobResult = await this.resolveBlobRef(ref, options)
          base64 = blobResult.base64
          mimeType = blobResult.mimeType
          break

        case 'url':
          // 从远程 URL 下载
          const urlResult = await this.resolveUrlRef(ref, options)
          base64 = urlResult.base64
          mimeType = urlResult.mimeType
          break

        case 'storage':
          // 从 Cherry Studio 存储读取
          const storageResult = await this.resolveStorageRef(ref, options)
          base64 = storageResult.base64
          mimeType = storageResult.mimeType
          break

        default:
          throw new Error(`不支持的图片引用类型: ${(ref as any).type}`)
      }

      // 如果需要 data URL 前缀
      if (options?.includeDataPrefix) {
        base64 = `data:${mimeType};base64,${base64}`
      }

      logger.debug('[resolve] 图片解析完成', {
        type: ref.type,
        mimeType,
        base64Length: base64.length,
        duration: Date.now() - startTime
      })

      return { base64, mimeType, ref }
    } catch (error) {
      logger.error('[resolve] 图片解析失败', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      })
      throw error
    }
  }

  /**
   * 批量解析多个图片引用
   *
   * @param images - 图片数组（ImageRef 或 string）
   * @param options - 解析选项
   * @returns 解析后的 Base64 数组
   */
  async resolveMany(images: ImageData[], options?: ResolveOptions): Promise<string[]> {
    const startTime = Date.now()

    logger.info('[resolveMany] 开始批量解析图片', { count: images.length })

    const results = await Promise.all(
      images.map(async (image) => {
        try {
          const resolved = await this.resolve(image, { ...options, includeDataPrefix: false })
          return resolved.base64
        } catch (error) {
          logger.warn('[resolveMany] 单张图片解析失败，跳过', {
            error: error instanceof Error ? error.message : String(error)
          })
          return null
        }
      })
    )

    // 过滤掉失败的结果
    const validResults = results.filter((r): r is string => r !== null)

    logger.info('[resolveMany] 批量解析完成', {
      total: images.length,
      success: validResults.length,
      failed: images.length - validResults.length,
      duration: Date.now() - startTime
    })

    return validResults
  }

  /**
   * 将 ImageRef 转换为 data URL
   *
   * @param image - ImageRef 或字符串
   * @returns data URL
   */
  async toDataUrl(image: ImageData): Promise<string> {
    const resolved = await this.resolve(image, { includeDataPrefix: true })
    return resolved.base64
  }

  /**
   * 从各种来源创建 ImageRef
   *
   * @param source - 图片来源（路径、URL、Base64 等）
   * @param options - 额外选项
   * @returns ImageRef
   */
  createRef(source: string, options?: Partial<Omit<ImageRef, '__imageRef' | 'type' | 'value'>>): ImageRef {
    return createImageRef(source, options)
  }

  /**
   * 检查值是否为 ImageRef
   */
  isRef(value: unknown): value is ImageRef {
    return isImageRef(value)
  }

  /**
   * 归一化图片数据
   * 如果是 ImageRef 则保持不变，如果是字符串则转换为 ImageRef
   * 用于确保输出统一为 ImageRef 格式
   */
  normalize(image: ImageData): ImageRef {
    return isImageRef(image) ? image : createImageRef(image)
  }

  /**
   * 从 API 响应创建图片引用
   * 用于处理 AI 服务返回的图片数据
   *
   * @param responseData - API 返回的图片数据（可能是 Base64 或 URL）
   * @returns ImageRef
   */
  fromApiResponse(responseData: string): ImageRef {
    // API 响应通常是 data URL 或纯 Base64
    if (responseData.startsWith('data:')) {
      return createBase64Ref(responseData)
    }
    if (responseData.startsWith('http://') || responseData.startsWith('https://')) {
      return createImageRef(responseData)
    }
    // 假设是纯 Base64
    return createBase64Ref(responseData)
  }

  // ============================================================================
  // 私有方法 - 各种引用类型的解析
  // ============================================================================

  /**
   * 解析文件路径引用
   */
  private async resolveFileRef(
    ref: ImageRef,
    _options?: ResolveOptions
  ): Promise<{ base64: string; mimeType: string }> {
    const filePath = ref.value

    logger.debug('[resolveFileRef] 读取本地文件', { filePath })

    try {
      // 使用 Electron IPC 读取文件
      const result = await window.api.file.read(filePath)

      if (!result) {
        throw new Error(`文件读取失败: ${filePath}`)
      }

      // result 可能是 Buffer 或 base64 字符串
      let base64: string
      if (typeof result === 'string') {
        // 如果已经是 base64 或 data URL
        if (result.startsWith('data:')) {
          const match = result.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            return { base64: match[2], mimeType: match[1] }
          }
        }
        base64 = result
      } else if (result instanceof ArrayBuffer || result instanceof Uint8Array) {
        // 将 ArrayBuffer 转换为 base64
        const bytes = new Uint8Array(result instanceof ArrayBuffer ? result : result.buffer)
        base64 = this.arrayBufferToBase64(bytes)
      } else {
        throw new Error('不支持的文件读取结果类型')
      }

      // 根据文件扩展名推断 MIME 类型
      const mimeType = ref.mimeType || this.getMimeTypeFromPath(filePath)

      return { base64, mimeType }
    } catch (error) {
      logger.error('[resolveFileRef] 文件读取失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`无法读取图片文件: ${filePath}`)
    }
  }

  /**
   * 解析 Blob URL 引用
   */
  private async resolveBlobRef(ref: ImageRef, options?: ResolveOptions): Promise<{ base64: string; mimeType: string }> {
    const blobUrl = ref.value

    logger.debug('[resolveBlobRef] 读取 Blob URL', { blobUrl })

    try {
      const response = await fetch(blobUrl, { signal: options?.signal })
      const blob = await response.blob()

      const base64 = await this.blobToBase64(blob)
      const mimeType = blob.type || ref.mimeType || 'image/jpeg'

      return { base64, mimeType }
    } catch (error) {
      logger.error('[resolveBlobRef] Blob 读取失败', {
        blobUrl,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`无法读取 Blob URL: ${blobUrl}`)
    }
  }

  /**
   * 解析远程 URL 引用
   */
  private async resolveUrlRef(ref: ImageRef, options?: ResolveOptions): Promise<{ base64: string; mimeType: string }> {
    const url = ref.value

    logger.debug('[resolveUrlRef] 下载远程图片', { url })

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 30000)

      // 合并外部取消信号
      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort())
      }

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const base64 = await this.blobToBase64(blob)
      const mimeType = blob.type || response.headers.get('content-type')?.split(';')[0] || ref.mimeType || 'image/jpeg'

      return { base64, mimeType }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`图片下载超时: ${url}`)
      }
      logger.error('[resolveUrlRef] 远程图片下载失败', {
        url,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`无法下载图片: ${url}`)
    }
  }

  /**
   * 解析 Cherry Studio 存储引用
   */
  private async resolveStorageRef(
    ref: ImageRef,
    _options?: ResolveOptions
  ): Promise<{ base64: string; mimeType: string }> {
    const storageId = ref.value

    logger.debug('[resolveStorageRef] 读取存储图片', { storageId })

    try {
      // 使用 Cherry Studio 的文件存储 API
      // base64Image 返回 { mime: string; base64: string; data: string; }
      const result = await window.api?.file?.base64Image?.(storageId)

      if (!result) {
        throw new Error(`存储图片不存在: ${storageId}`)
      }

      // result 是一个对象 { mime, base64, data }
      // Cherry Studio API 返回的是对象格式
      const resultObj = result as { mime?: string; base64?: string; data?: string }
      if (resultObj.base64) {
        return {
          base64: resultObj.base64,
          mimeType: resultObj.mime || ref.mimeType || 'image/jpeg'
        }
      }

      // 如果 base64 字段不存在，尝试使用 data 字段
      if (resultObj.data) {
        return {
          base64: resultObj.data,
          mimeType: resultObj.mime || ref.mimeType || 'image/jpeg'
        }
      }

      throw new Error(`存储结果格式不正确: 缺少 base64 或 data 字段`)
    } catch (error) {
      logger.error('[resolveStorageRef] 存储图片读取失败', {
        storageId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`无法读取存储图片: ${storageId}`)
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * Blob 转 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        // 移除 data URL 前缀
        const base64 = result.split(',')[1] || result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Blob 转换失败'))
      reader.readAsDataURL(blob)
    })
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 从文件路径获取 MIME 类型
   */
  private getMimeTypeFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon'
    }
    return mimeMap[ext || ''] || 'image/jpeg'
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const ImageRefService = new ImageRefServiceClass()

// 导出类型和工具函数
export { createBase64Ref, createFileRef, createImageRef, type ImageData, type ImageRef, isImageRef }
