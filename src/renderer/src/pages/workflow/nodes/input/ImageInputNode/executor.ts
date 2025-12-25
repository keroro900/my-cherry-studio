/**
 * 图片输入节点执行器 v2.0
 *
 * 深度优化版本，支持：
 * - 多种输入模式（拖拽上传、文件夹、URL）
 * - 批量图片处理
 * - 图片筛选和排序
 * - 动态输出端口
 * - 自然排序算法
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { ImageInputNodeConfig, NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface ImageInfo {
  path: string
  name: string
  baseName: string
  extension: string
  size?: number
  modified?: number
}

export class ImageInputExecutor extends BaseNodeExecutor {
  constructor() {
    super('image_input')
  }

  async execute(
    _inputs: Record<string, any>,
    config: ImageInputNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    void _inputs
    const startTime = Date.now()

    try {
      this.log(context, '开始执行图片输入节点 v2.0')

      // 收集图片
      let images: ImageInfo[] = []
      const inputMode = config.inputMode || 'upload'

      switch (inputMode) {
        case 'upload':
          images = this.collectUploadedImages(config)
          break
        case 'folder':
          images = await this.collectFolderImages(config, context)
          break
        case 'url':
          images = this.collectUrlImages(config)
          break
        default:
          images = this.collectUploadedImages(config)
      }

      this.log(context, `收集到 ${images.length} 张图片`, { inputMode })

      // 应用筛选
      if (config.fileFilter) {
        images = this.filterImages(images, config.fileFilter)
        this.log(context, `筛选后剩余 ${images.length} 张图片`)
      }

      // 应用排序
      images = this.sortImages(images, config.sortBy || 'name', config.sortOrder || 'asc')

      // 应用数量限制
      const maxImages = config.maxImages || 100
      if (images.length > maxImages) {
        images = images.slice(0, maxImages)
        this.log(context, `限制为 ${maxImages} 张图片`)
      }

      // 构建输出
      const imagePaths = images.map((img) => img.path)
      const outputs: Record<string, any> = {
        images: imagePaths,
        all_images: imagePaths, // 兼容旧版
        count: String(imagePaths.length),
        metadata: {
          inputMode,
          totalImages: imagePaths.length,
          sortBy: config.sortBy,
          sortOrder: config.sortOrder,
          images: images.map((img) => ({
            name: img.name,
            path: img.path,
            size: img.size
          }))
        }
      }

      // 生成单图输出端口
      const outputPorts = config.outputPorts || 3
      for (let i = 0; i < outputPorts; i++) {
        const portId = `image_${i + 1}`
        outputs[portId] = imagePaths[i] || null
      }

      // 文件夹模式：生成每个文件夹的输出
      if (inputMode === 'folder' && config.folderPaths && config.folderPaths.length > 0) {
        config.folderPaths.forEach((folder, index) => {
          const folderImages = folder.images?.map((img) => img.path) || []
          outputs[`folder_${index + 1}`] = folderImages[0] || null
          outputs[`folder_${index + 1}_all`] = folderImages
        })
      }

      const duration = Date.now() - startTime
      this.log(context, '图片输入完成', {
        imageCount: imagePaths.length,
        duration: `${duration}ms`
      })

      return this.success(outputs, duration)
    } catch (error) {
      this.logError(context, '图片输入失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 收集上传的图片
   */
  private collectUploadedImages(config: ImageInputNodeConfig): ImageInfo[] {
    if (!config.uploadedImages || config.uploadedImages.length === 0) {
      return []
    }

    return config.uploadedImages.map((img) => ({
      path: img.path,
      name: img.name || this.getFileName(img.path),
      baseName: this.getBaseName(img.path),
      extension: this.getExtension(img.path),
      size: img.size
    }))
  }

  /**
   * 收集文件夹中的图片
   */
  private async collectFolderImages(config: ImageInputNodeConfig, context: NodeExecutionContext): Promise<ImageInfo[]> {
    const images: ImageInfo[] = []

    if (!config.folderPaths || config.folderPaths.length === 0) {
      return images
    }

    for (const folder of config.folderPaths) {
      if (folder.images && folder.images.length > 0) {
        for (const img of folder.images) {
          images.push({
            path: img.path,
            name: img.name || this.getFileName(img.path),
            baseName: img.baseName || this.getBaseName(img.path),
            extension: this.getExtension(img.path),
            size: img.size
          })
        }
      }
    }

    this.log(context, `从 ${config.folderPaths.length} 个文件夹收集图片`)
    return images
  }

  /**
   * 收集 URL 图片
   */
  private collectUrlImages(config: ImageInputNodeConfig): ImageInfo[] {
    const imageUrls = config.imageUrls
    if (!imageUrls) {
      return []
    }

    const urls = imageUrls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')))

    return urls.map((url) => ({
      path: url,
      name: this.getFileName(url),
      baseName: this.getBaseName(url),
      extension: this.getExtension(url)
    }))
  }

  /**
   * 筛选图片
   */
  private filterImages(images: ImageInfo[], filter: string): ImageInfo[] {
    if (!filter) return images

    // 解析筛选规则
    const patterns = filter
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0)

    if (patterns.length === 0) return images

    return images.filter((img) => {
      const ext = img.extension.toLowerCase()
      const name = img.name.toLowerCase()

      return patterns.some((pattern) => {
        // 支持 *.ext 格式
        if (pattern.startsWith('*.')) {
          return ext === pattern.substring(1)
        }
        // 支持 .ext 格式
        if (pattern.startsWith('.')) {
          return ext === pattern
        }
        // 支持文件名包含
        return name.includes(pattern)
      })
    })
  }

  /**
   * 排序图片
   */
  private sortImages(images: ImageInfo[], sortBy: string, sortOrder: string): ImageInfo[] {
    const sorted = [...images]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'natural':
          comparison = this.naturalCompare(a.name, b.name)
          break
        case 'modified':
          comparison = (a.modified || 0) - (b.modified || 0)
          break
        case 'size':
          comparison = (a.size || 0) - (b.size || 0)
          break
        default:
          comparison = a.name.localeCompare(b.name)
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return sorted
  }

  /**
   * 自然排序比较（处理数字）
   * 例如: img1, img2, img10 而不是 img1, img10, img2
   */
  private naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }

  /**
   * 获取文件名
   */
  private getFileName(path: string): string {
    const parts = path.split(/[/\\]/)
    return parts[parts.length - 1] || path
  }

  /**
   * 获取不带扩展名的文件名
   */
  private getBaseName(path: string): string {
    const fileName = this.getFileName(path)
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName
  }

  /**
   * 获取扩展名
   */
  private getExtension(path: string): string {
    const fileName = this.getFileName(path)
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot).toLowerCase() : ''
  }
}

export default ImageInputExecutor
