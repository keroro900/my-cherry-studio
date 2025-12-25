/**
 * 输出节点执行器 v2.0
 *
 * 深度优化版本，支持：
 * - 多种输出模式（预览、保存、下载、预览+保存）
 * - 批量文件保存
 * - 灵活的文件命名模板
 * - 图片格式转换
 * - 元数据导出
 */

import type { BatchExportConfig } from '../../../utils/autoExport'
import { extractJsonFromText } from '../../../utils/extractJson'
import type { PromptJsonExportProjection } from '../../../utils/promptJsonExport'
import { promptJsonToExportText } from '../../../utils/promptJsonExport'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult, OutputNodeConfig } from '../../base/types'

export interface OutputExecutionContext extends NodeExecutionContext {
  currentBatchIndex?: number
  workflowName?: string
}

export interface ExtendedOutputConfig extends OutputNodeConfig {
  imageFormat?: 'original' | 'png' | 'jpeg' | 'webp'
  imageQuality?: number
  maxImageSize?: string
  exportMetadata?: boolean
  metadataFields?: 'basic' | 'full' | 'custom'
  showNotification?: boolean
  openFolderAfterExport?: boolean
  overwriteExisting?: boolean
  exportPromptText?: boolean
  promptTextSuffix?: string
  promptTextExtension?: string
  promptTextProjection?: PromptJsonExportProjection
  promptTextPretty?: boolean
}

export class OutputExecutor extends BaseNodeExecutor {
  constructor() {
    super('output')
  }

  async execute(
    inputs: Record<string, any>,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      const outputType = config.outputType || 'display'
      this.log(context, '开始执行输出节点 v2.0', { outputType })

      // 收集所有输入数据
      const collectedData = this.collectInputData(inputs)

      this.log(context, '收集输出数据', {
        imageCount: collectedData.images.length,
        hasVideo: !!collectedData.video,
        hasText: !!collectedData.text,
        hasJson: !!collectedData.json
      })

      // 构建结果对象
      const result = {
        image: collectedData.images[0] || null,
        images: collectedData.images,
        video: collectedData.video,
        text: collectedData.text,
        json: collectedData.json,
        any: collectedData.any
      }

      // 根据输出模式处理
      if (outputType === 'file' || outputType === 'both') {
        return await this.handleFileOutput(result, config, context, startTime, outputType === 'both')
      }

      if (outputType === 'download') {
        return this.handleDownloadOutput(result, config, context, startTime)
      }

      // 显示预览模式
      this.log(context, '预览模式完成')
      return this.success(
        {
          result,
          outputType: 'display',
          metadata: this.buildMetadata(result, config, context)
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '输出节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 收集输入数据
   */
  private collectInputData(inputs: Record<string, any>): {
    images: string[]
    video: string | null
    text: string | null
    json: any
    any: any
  } {
    const images: string[] = []

    // 收集图片 - 支持多种输入端口名
    const imageKeys = [
      'image',
      'images',
      'editedImage',
      'modelImage',
      'mainImage',
      'comparedImage',
      'patternImage',
      'graphicImage',
      'generatedImage'
    ]

    for (const key of imageKeys) {
      const value = inputs[key]
      if (value) {
        if (Array.isArray(value)) {
          images.push(...value.filter((v) => typeof v === 'string'))
        } else if (typeof value === 'string') {
          images.push(value)
        }
      }
    }

    // 收集视频
    const video = inputs.video || null

    // 收集文本
    const text = inputs.text || inputs.caption || null

    // 收集 JSON
    const json =
      inputs.json ||
      inputs.promptJson ||
      inputs.modelPromptJson ||
      inputs.patternPromptJson ||
      inputs.ecomPromptJson ||
      inputs.metadata ||
      null

    // 收集任意数据
    const any = inputs.any || inputs.data || null

    return { images, video, text, json, any }
  }

  /**
   * 处理文件输出
   */
  private async handleFileOutput(
    result: any,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext,
    startTime: number,
    alsoDisplay: boolean
  ): Promise<NodeExecutionResult> {
    if (!config.outputDirectory) {
      this.log(context, '文件保存模式未配置输出目录，回退到预览模式')
      return this.success(
        {
          result,
          outputType: 'display',
          warning: '文件保存模式需要配置输出目录，当前显示预览模式',
          metadata: this.buildMetadata(result, config, context)
        },
        Date.now() - startTime
      )
    }

    // 收集需要导出的数据
    const itemsToExport: any[] = []

    // 添加图片
    if (result.images && result.images.length > 0) {
      itemsToExport.push(...result.images)
    }

    // 添加视频
    if (result.video) {
      if (Array.isArray(result.video)) {
        itemsToExport.push(...result.video)
      } else {
        itemsToExport.push(result.video)
      }
    }

    // 添加文本
    if (result.text) {
      if (Array.isArray(result.text)) {
        itemsToExport.push(...result.text)
      } else {
        itemsToExport.push(result.text)
      }
    }

    this.log(context, '收集导出数据', { itemCount: itemsToExport.length })

    if (itemsToExport.length === 0) {
      return this.success(
        {
          result,
          outputType: alsoDisplay ? 'both' : 'file',
          warning: '没有可导出的数据',
          metadata: this.buildMetadata(result, config, context)
        },
        Date.now() - startTime
      )
    }

    try {
      const { executeBatchExportMultiple } = await import('../../../utils/autoExport')

      const exportConfig: BatchExportConfig = {
        outputDirectory: config.outputDirectory,
        fileNamePattern: this.processFileNamePattern(config.fileNamePattern || '{name}_{date}_{index}', context),
        batchFolderMode: config.batchFolderMode ?? true,
        batchFolderPattern: this.processFileNamePattern(config.batchFolderPattern || 'batch_{date}_{index}', context),
        batchIndex: context.currentBatchIndex || 1
      }

      const exportResult = await executeBatchExportMultiple(itemsToExport, exportConfig)

      this.log(context, '批量导出完成', {
        fileCount: exportResult.exportedFiles.length,
        errorCount: exportResult.errors.length
      })

      // 导出元数据文件
      if (config.exportMetadata && exportResult.exportedFiles.length > 0) {
        await this.exportMetadataFile(result, config, context, exportResult.exportedFiles)
      }

      // 导出每张图对应的提示词 TXT（JSON 内容）
      let exportedPromptFiles: string[] = []
      let promptExportErrors: string[] = []
      if (config.exportPromptText) {
        const promptExport = await this.exportPromptTextFiles(result, config, context, exportConfig)
        exportedPromptFiles = promptExport.exportedFiles
        promptExportErrors = promptExport.errors
      }

      const metadata = this.buildMetadata(result, config, context)
      metadata.exportedFiles = exportResult.exportedFiles
      metadata.exportErrors = exportResult.errors
      metadata.exportedPromptFiles = exportedPromptFiles
      metadata.promptExportErrors = promptExportErrors

      return this.success(
        {
          result,
          exportedFiles: exportResult.exportedFiles,
          exportErrors: exportResult.errors,
          outputType: alsoDisplay ? 'both' : 'file',
          metadata
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '批量导出失败', error)
      return this.success(
        {
          result,
          outputType: 'display',
          warning: `批量导出失败: ${error instanceof Error ? error.message : String(error)}`,
          metadata: this.buildMetadata(result, config, context)
        },
        Date.now() - startTime
      )
    }
  }

  /**
   * 处理下载输出
   */
  private handleDownloadOutput(
    result: any,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext,
    startTime: number
  ): NodeExecutionResult {
    const downloadItems: { data: string; filename: string; type: string }[] = []

    // 添加图片下载项
    if (result.images && result.images.length > 0) {
      result.images.forEach((img: string, index: number) => {
        if (typeof img === 'string') {
          const ext = this.getImageExtension(img, config.imageFormat)
          const imageFilename = this.generateFileName('image', index, ext, config, context)
          downloadItems.push({
            data: img,
            filename: imageFilename,
            type: 'image'
          })

          if (config.exportPromptText) {
            const promptText = this.getPromptTextForIndex(result.json, index, config)
            if (promptText) {
              const suffix = (config.promptTextSuffix || '_T').trim() || '_T'
              const promptExt = (config.promptTextExtension || 'txt').trim().replace(/^\./, '') || 'txt'
              const baseName = imageFilename.replace(/\.[^.]+$/, '')
              downloadItems.push({
                data: promptText,
                filename: `${baseName}${suffix}.${promptExt}`,
                type: 'text'
              })
            }
          }
        }
      })
    }

    // 添加视频下载项
    if (result.video) {
      const videos = Array.isArray(result.video) ? result.video : [result.video]
      videos.forEach((vid: string, index: number) => {
        if (typeof vid === 'string') {
          downloadItems.push({
            data: vid,
            filename: this.generateFileName('video', index, '.mp4', config, context),
            type: 'video'
          })
        }
      })
    }

    // 添加文本下载项
    if (result.text) {
      const texts = Array.isArray(result.text) ? result.text : [result.text]
      texts.forEach((txt: string, index: number) => {
        if (typeof txt === 'string') {
          downloadItems.push({
            data: txt,
            filename: this.generateFileName('text', index, '.txt', config, context),
            type: 'text'
          })
        }
      })
    }

    this.log(context, '下载准备完成', { count: downloadItems.length })

    return this.success(
      {
        result,
        downloadItems,
        outputType: 'download',
        metadata: this.buildMetadata(result, config, context)
      },
      Date.now() - startTime
    )
  }

  /**
   * 处理文件名模板
   */
  private processFileNamePattern(pattern: string, context: OutputExecutionContext): string {
    const now = new Date()
    const date = now.toISOString().split('T')[0].replace(/-/g, '')
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '')
    const timestamp = now.getTime()
    const uuid = this.generateUUID()

    return pattern
      .replace(/\{date\}/g, date)
      .replace(/\{time\}/g, time)
      .replace(/\{timestamp\}/g, String(timestamp))
      .replace(/\{uuid\}/g, uuid)
      .replace(/\{name\}/g, context.workflowName || 'output')
  }

  /**
   * 生成文件名
   */
  private generateFileName(
    type: string,
    index: number,
    ext: string,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext
  ): string {
    let pattern = config.fileNamePattern || '{name}_{date}_{index}'
    pattern = this.processFileNamePattern(pattern, context)
    pattern = pattern.replace(/\{index\}/g, String(index + 1))
    pattern = pattern.replace(/\{type\}/g, type)

    return `${pattern}${ext}`
  }

  /**
   * 获取图片扩展名
   */
  private getImageExtension(imageData: string, format?: string): string {
    if (format && format !== 'original') {
      return `.${format}`
    }

    // 从 data URL 推断格式
    if (imageData.startsWith('data:image/')) {
      const match = imageData.match(/data:image\/(\w+)/)
      if (match) {
        return `.${match[1]}`
      }
    }

    // 从 URL 推断格式
    if (imageData.startsWith('http')) {
      const urlMatch = imageData.match(/\.(\w+)(?:\?|$)/)
      if (urlMatch) {
        return `.${urlMatch[1]}`
      }
    }

    return '.png'
  }

  /**
   * 导出元数据文件
   */
  private async exportMetadataFile(
    result: any,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext,
    exportedFiles: string[]
  ): Promise<void> {
    try {
      const metadata = this.buildMetadata(result, config, context)
      metadata.exportedFiles = exportedFiles
      metadata.exportedAt = new Date().toISOString()

      const metadataJson = JSON.stringify(metadata, null, 2)
      const metadataFileName = `metadata_${Date.now()}.json`
      const metadataPath = `${config.outputDirectory}/${metadataFileName}`

      await window.api?.file?.write?.(metadataPath, metadataJson)
      this.log(context, '元数据文件已导出', { path: metadataPath })
    } catch (error) {
      this.log(context, '元数据导出失败', { error: String(error) })
    }
  }

  /**
   * 构建元数据
   */
  private buildMetadata(
    result: any,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext
  ): Record<string, any> {
    return {
      outputType: config.outputType,
      imageCount: result.images?.length || 0,
      hasVideo: !!result.video,
      hasText: !!result.text,
      hasJson: !!result.json,
      workflowName: context.workflowName,
      batchIndex: context.currentBatchIndex,
      timestamp: new Date().toISOString(),
      config: {
        imageFormat: config.imageFormat,
        imageQuality: config.imageQuality,
        maxImageSize: config.maxImageSize
      }
    }
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  private getPromptTextForIndex(promptJsonInput: unknown, index: number, config: ExtendedOutputConfig): string {
    const projection = config.promptTextProjection ?? 'auto'
    const pretty = config.promptTextPretty ?? true

    const prompts = this.normalizePromptJsonInputs(promptJsonInput)
    const promptJson = prompts[index]
    if (!promptJson) return ''

    return promptJsonToExportText(promptJson, { projection, pretty })
  }

  private normalizePromptJsonInputs(promptJsonInput: unknown): any[] {
    if (!promptJsonInput) return []

    const rawList = Array.isArray(promptJsonInput) ? promptJsonInput : [promptJsonInput]

    return rawList
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') {
          const extracted = extractJsonFromText(item)
          if (extracted.ok) return extracted.value
          try {
            return JSON.parse(item)
          } catch {
            return null
          }
        }
        if (typeof item === 'object') return item
        return null
      })
      .filter((item): item is any => item !== null)
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\\\|?*]/g, '_').slice(0, 50)
  }

  private generateBatchFolderName(pattern: string, batchIndex: number): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '')

    return this.sanitizeFilename(
      pattern.replace('{index}', String(batchIndex).padStart(3, '0')).replace('{date}', date).replace('{time}', time)
    )
  }

  private generateOutputFilename(pattern: string, index: number, dataType: string): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '')

    let filename = pattern
      .replace('{date}', date)
      .replace('{time}', time)
      .replace('{index}', String(index).padStart(3, '0'))
      .replace('{type}', dataType)

    if (!filename || filename === pattern) {
      filename = `output_${date}_${time}_${String(index).padStart(3, '0')}`
    }

    return this.sanitizeFilename(filename)
  }

  private async exportPromptTextFiles(
    result: any,
    config: ExtendedOutputConfig,
    context: OutputExecutionContext,
    exportConfig: BatchExportConfig
  ): Promise<{ exportedFiles: string[]; errors: string[] }> {
    const exportedFiles: string[] = []
    const errors: string[] = []

    const images: string[] = Array.isArray(result.images) ? result.images : []
    if (images.length === 0) return { exportedFiles, errors }

    const suffix = (config.promptTextSuffix || '_T').trim() || '_T'
    const ext = (config.promptTextExtension || 'txt').trim().replace(/^\./, '') || 'txt'
    const projection = config.promptTextProjection ?? 'auto'
    const pretty = config.promptTextPretty ?? true

    const prompts = this.normalizePromptJsonInputs(result.json)
    if (prompts.length === 0) return { exportedFiles, errors }

    let exportPath = exportConfig.outputDirectory
    if (exportConfig.batchFolderMode && exportConfig.batchIndex > 0) {
      const batchFolderName = this.generateBatchFolderName(exportConfig.batchFolderPattern, exportConfig.batchIndex)
      exportPath = `${exportPath}/${batchFolderName}`
    }

    for (let i = 0; i < images.length; i++) {
      const promptJson = prompts[i]
      if (!promptJson) continue

      const text = promptJsonToExportText(promptJson, { projection, pretty })
      if (!text) continue

      const baseName = this.generateOutputFilename(exportConfig.fileNamePattern, i + 1, 'image')
      const filePath = `${exportPath}/${baseName}${suffix}.${ext}`

      try {
        await window.api?.file?.write?.(filePath, text)
        exportedFiles.push(filePath)
      } catch (error) {
        errors.push(`prompt_${i + 1}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (errors.length > 0) {
      this.log(context, '提示词导出存在错误', { errorCount: errors.length })
    }

    return { exportedFiles, errors }
  }
}

export default OutputExecutor
