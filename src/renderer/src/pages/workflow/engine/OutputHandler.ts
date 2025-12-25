/**
 * 输出处理器
 *
 * 负责处理节点执行结果，包括输出数据的存储、转换和验证
 */

import { loggerService } from '@logger'

import type { NodeHandle, WorkflowNode } from '../types'
import type { NodeExecutionResult } from '../types/core'
import type { EngineExecutionContext } from './ExecutionContext'
import { ExecutionContextManager } from './ExecutionContext'

const logger = loggerService.withContext('OutputHandler')

/**
 * 输出处理器类
 */
export class OutputHandler {
  /**
   * 处理节点执行结果
   */
  static processNodeResult(node: WorkflowNode, result: NodeExecutionResult, context: EngineExecutionContext): void {
    logger.debug('处理节点执行结果', {
      nodeId: node.id,
      nodeType: node.data.nodeType,
      status: result.status,
      outputCount: Object.keys(result.outputs).length,
      duration: result.duration
    })

    // 存储节点执行结果
    ExecutionContextManager.setNodeResult(context, {
      ...result,
      nodeId: node.id // 确保有节点ID
    })

    // 处理输出数据
    if (result.status === 'success' && result.outputs) {
      const processedOutputs = this.processOutputs(node, result.outputs)
      ExecutionContextManager.setNodeOutputs(context, node.id, processedOutputs)
    } else if (result.status === 'error') {
      // 错误情况下存储空输出
      ExecutionContextManager.setNodeOutputs(context, node.id, {})

      logger.error('节点执行失败', {
        nodeId: node.id,
        error: result.errorMessage,
        duration: result.duration
      })
    }
  }

  /**
   * 处理输出数据
   */
  private static processOutputs(node: WorkflowNode, rawOutputs: Record<string, any>): Record<string, any> {
    const processedOutputs: Record<string, any> = {}
    const nodeOutputs = node.data.outputs || []

    // 验证输出是否符合节点定义
    for (const outputHandle of nodeOutputs) {
      const value = this.findOutputValue(rawOutputs, outputHandle)

      if (value !== undefined) {
        const processedValue = this.processOutputValue(value, outputHandle)
        processedOutputs[outputHandle.id] = processedValue

        logger.debug('输出已处理', {
          nodeId: node.id,
          outputId: outputHandle.id,
          valueType: Array.isArray(processedValue) ? `array[${processedValue.length}]` : typeof processedValue
        })
      }
    }

    // 保留原始输出中未在节点定义中声明的输出（向后兼容）
    for (const [key, value] of Object.entries(rawOutputs)) {
      if (!processedOutputs.hasOwnProperty(key)) {
        processedOutputs[key] = value
      }
    }

    return processedOutputs
  }

  /**
   * 查找输出值
   */
  private static findOutputValue(rawOutputs: Record<string, any>, outputHandle: NodeHandle): any {
    // 优先使用精确匹配的键
    if (rawOutputs.hasOwnProperty(outputHandle.id)) {
      return rawOutputs[outputHandle.id]
    }

    // 根据数据类型查找合适的值
    const candidates = this.getOutputCandidates(outputHandle.dataType)

    for (const candidate of candidates) {
      if (rawOutputs.hasOwnProperty(candidate)) {
        return rawOutputs[candidate]
      }
    }

    return undefined
  }

  /**
   * 获取输出候选键
   */
  private static getOutputCandidates(dataType: string): string[] {
    switch (dataType) {
      case 'image':
        return ['image', 'images', 'modelImage', 'editedImage', 'generatedImage', 'result']
      case 'video':
        return ['video', 'videoUrl', 'videoPath', 'result']
      case 'text':
        return ['text', 'content', 'result', 'output']
      case 'json':
        return ['json', 'data', 'metadata', 'result']
      case 'any':
        return ['result', 'output', 'data', 'value']
      default:
        return ['result', 'output', dataType]
    }
  }

  /**
   * 处理单个输出值
   */
  private static processOutputValue(value: any, outputHandle: NodeHandle): any {
    if (value === null || value === undefined) {
      return value
    }

    // 根据输出类型进行处理
    switch (outputHandle.dataType) {
      case 'image':
        return this.processImageOutput(value, outputHandle.multiple)
      case 'video':
        return this.processVideoOutput(value, outputHandle.multiple)
      case 'text':
        return this.processTextOutput(value, outputHandle.multiple)
      case 'json':
        return this.processJsonOutput(value, outputHandle.multiple)
      default:
        return value
    }
  }

  /**
   * 处理图片输出
   */
  private static processImageOutput(value: any, isMultiple?: boolean): any {
    if (Array.isArray(value)) {
      // 过滤掉无效的图片值
      const validImages = value.filter(this.isValidImageValue)

      if (isMultiple) {
        return validImages
      } else {
        return validImages.length > 0 ? validImages[0] : null
      }
    } else {
      const isValid = this.isValidImageValue(value)
      return isValid ? value : null
    }
  }

  /**
   * 处理视频输出
   */
  private static processVideoOutput(value: any, isMultiple?: boolean): any {
    if (Array.isArray(value)) {
      const validVideos = value.filter(this.isValidVideoValue)

      if (isMultiple) {
        return validVideos
      } else {
        return validVideos.length > 0 ? validVideos[0] : null
      }
    } else {
      const isValid = this.isValidVideoValue(value)
      return isValid ? value : null
    }
  }

  /**
   * 处理文本输出
   */
  private static processTextOutput(value: any, isMultiple?: boolean): any {
    if (Array.isArray(value)) {
      const validTexts = value.map((v) => (typeof v === 'string' ? v : String(v))).filter((t) => t.trim().length > 0)

      if (isMultiple) {
        return validTexts
      } else {
        return validTexts.length > 0 ? validTexts[0] : ''
      }
    } else {
      return typeof value === 'string' ? value : String(value)
    }
  }

  /**
   * 处理JSON输出
   */
  private static processJsonOutput(value: any, isMultiple?: boolean): any {
    if (Array.isArray(value)) {
      if (isMultiple) {
        return value
      } else {
        return value.length > 0 ? value[0] : null
      }
    } else {
      return value
    }
  }

  /**
   * 验证图片值是否有效
   */
  private static isValidImageValue(value: any): boolean {
    if (typeof value !== 'string') {
      return false
    }

    // Base64 图片
    if (value.startsWith('data:image/')) {
      return value.length > 100 // 基本的长度检查
    }

    // URL 图片
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true
    }

    // 本地文件路径
    if (value.includes('.') && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(value)) {
      return true
    }

    return false
  }

  /**
   * 验证视频值是否有效
   */
  private static isValidVideoValue(value: any): boolean {
    if (typeof value !== 'string') {
      return false
    }

    // URL 视频
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true
    }

    // 本地文件路径
    if (value.includes('.') && /\.(mp4|avi|mov|mkv|webm|m4v)$/i.test(value)) {
      return true
    }

    return false
  }

  /**
   * 获取节点输出摘要
   */
  static getOutputSummary(outputs: Record<string, any>): { totalOutputs: number; outputTypes: Record<string, number> } {
    const outputTypes: Record<string, number> = {}
    let totalOutputs = 0

    for (const value of Object.values(outputs)) {
      totalOutputs++

      if (value === null || value === undefined) {
        outputTypes['null'] = (outputTypes['null'] || 0) + 1
      } else if (Array.isArray(value)) {
        outputTypes['array'] = (outputTypes['array'] || 0) + 1
      } else if (typeof value === 'string') {
        if (this.isValidImageValue(value)) {
          outputTypes['image'] = (outputTypes['image'] || 0) + 1
        } else if (this.isValidVideoValue(value)) {
          outputTypes['video'] = (outputTypes['video'] || 0) + 1
        } else {
          outputTypes['text'] = (outputTypes['text'] || 0) + 1
        }
      } else if (typeof value === 'object') {
        outputTypes['object'] = (outputTypes['object'] || 0) + 1
      } else {
        outputTypes[typeof value] = (outputTypes[typeof value] || 0) + 1
      }
    }

    return { totalOutputs, outputTypes }
  }

  /**
   * 验证输出数据完整性
   */
  static validateOutputs(node: WorkflowNode, outputs: Record<string, any>): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = []
    const expectedOutputs = node.data.outputs || []

    // 检查必需的输出
    for (const outputHandle of expectedOutputs) {
      const value = outputs[outputHandle.id]

      if (outputHandle.required && (value === undefined || value === null)) {
        warnings.push(`缺少必需输出: ${outputHandle.label} (${outputHandle.id})`)
      }

      // 类型检查
      if (value !== undefined && value !== null) {
        if (outputHandle.dataType === 'image' && !this.isValidImageValue(value) && !Array.isArray(value)) {
          warnings.push(`输出 ${outputHandle.id} 不是有效的图片格式`)
        } else if (outputHandle.dataType === 'video' && !this.isValidVideoValue(value) && !Array.isArray(value)) {
          warnings.push(`输出 ${outputHandle.id} 不是有效的视频格式`)
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings
    }
  }
}
