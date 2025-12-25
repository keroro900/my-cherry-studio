/**
 * 文件输入节点执行器
 *
 * 处理视频、音频、文档等多种文件类型的输入
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

interface FileInputConfig {
  allowedTypes?: string[]
  maxFileSize?: number
  multiple?: boolean
  files?: Array<{
    path: string
    name: string
    type: string
    size: number
  }>
}

export class FileInputExecutor extends BaseNodeExecutor {
  constructor() {
    super('file_input')
  }

  async execute(
    _inputs: Record<string, any>,
    config: FileInputConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行文件输入节点')

    try {
      const files = config.files || []

      if (files.length === 0) {
        return this.error('未选择任何文件', Date.now() - startTime)
      }

      this.log(context, '文件列表', {
        fileCount: files.length,
        files: files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
      })

      // 验证文件类型
      const allowedTypes = config.allowedTypes || ['video', 'audio', 'document']
      for (const file of files) {
        if (!this.isTypeAllowed(file.type, allowedTypes)) {
          return this.error(`文件类型不支持: ${file.name} (${file.type})`, Date.now() - startTime)
        }
      }

      // 验证文件大小
      const maxSize = (config.maxFileSize || 100) * 1024 * 1024 // MB to bytes
      for (const file of files) {
        if (file.size > maxSize) {
          return this.error(
            `文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB > ${config.maxFileSize}MB)`,
            Date.now() - startTime
          )
        }
      }

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', { duration: `${duration}ms` })

      // 输出文件路径和信息
      if (config.multiple && files.length > 1) {
        return this.success(
          {
            file: files.map((f) => f.path),
            fileInfo: files.map((f) => ({
              name: f.name,
              type: f.type,
              size: f.size,
              path: f.path
            }))
          },
          duration
        )
      } else {
        const file = files[0]
        return this.success(
          {
            file: file.path,
            fileInfo: {
              name: file.name,
              type: file.type,
              size: file.size,
              path: file.path
            }
          },
          duration
        )
      }
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  private isTypeAllowed(fileType: string, allowedTypes: string[]): boolean {
    if (allowedTypes.includes('all')) return true

    const typeMapping: Record<string, string[]> = {
      video: ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac'],
      document: [
        'application/pdf',
        'application/msword',
        'text/plain',
        'application/vnd.openxmlformats-officedocument'
      ],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    }

    for (const allowedType of allowedTypes) {
      const mimeTypes = typeMapping[allowedType] || []
      if (mimeTypes.some((mime) => fileType.startsWith(mime.split('/')[0]) || fileType === mime)) {
        return true
      }
    }

    return false
  }
}

export default FileInputExecutor
