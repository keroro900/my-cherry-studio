/**
 * 输入收集器
 *
 * 负责从上游节点收集输入数据并进行类型转换和验证
 */

import { loggerService } from '@logger'

import type { NodeHandle, WorkflowEdge, WorkflowNode } from '../types'
import type { EngineExecutionContext } from './ExecutionContext'

const logger = loggerService.withContext('InputCollector')

/**
 * 输入收集器类
 */
export class InputCollector {
  /**
   * 收集节点的输入数据
   */
  static collectInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: EngineExecutionContext
  ): Record<string, any> {
    const inputs: Record<string, any> = {}
    const nodeData = node.data
    const nodeInputs = nodeData.inputs || []

    logger.debug('开始收集节点输入', {
      nodeId: node.id,
      nodeType: nodeData.nodeType,
      inputHandles: nodeInputs.length
    })

    // 为每个输入端口收集数据
    for (const inputHandle of nodeInputs) {
      const value = this.collectInputForHandle(node, inputHandle, edges, context)

      if (value !== undefined) {
        inputs[inputHandle.id] = value

        logger.debug('输入数据已收集', {
          nodeId: node.id,
          handleId: inputHandle.id,
          valueType: Array.isArray(value) ? `array[${value.length}]` : typeof value,
          hasValue: value !== null && value !== undefined
        })
      }
    }

    return inputs
  }

  /**
   * 为单个输入端口收集数据
   */
  private static collectInputForHandle(
    node: WorkflowNode,
    inputHandle: NodeHandle,
    edges: WorkflowEdge[],
    context: EngineExecutionContext
  ): any {
    const nodeInputs = node.data.inputs || []
    // 查找连接到此输入端口的边
    const connectedEdges = edges.filter(
      (e) =>
        e.target === node.id &&
        (e.targetHandle === inputHandle.id || (!e.targetHandle && nodeInputs.length === 1))
    )

    if (connectedEdges.length === 0) {
      return undefined
    }

    const collectedValues: any[] = []

    // 从每条连接的边收集数据
    for (const edge of connectedEdges) {
      const upstreamOutputs = context.nodeOutputs.get(edge.source)

      if (!upstreamOutputs) {
        logger.warn('上游节点输出为空', {
          nodeId: node.id,
          upstreamNodeId: edge.source,
          handleId: inputHandle.id
        })
        continue
      }

      const value = this.extractValueFromUpstreamOutputs(upstreamOutputs, edge, inputHandle, node)

      if (value !== undefined) {
        collectedValues.push(value)
      }
    }

    // 根据输入端口类型决定如何合并值
    return this.mergeCollectedValues(collectedValues, inputHandle)
  }

  /**
   * 从上游输出中提取值
   */
  private static extractValueFromUpstreamOutputs(
    upstreamOutputs: Record<string, any>,
    edge: WorkflowEdge,
    inputHandle: NodeHandle,
    node: WorkflowNode
  ): any {
    // 如果边指定了源端口，直接使用
    if (edge.sourceHandle && upstreamOutputs[edge.sourceHandle] !== undefined) {
      return upstreamOutputs[edge.sourceHandle]
    }

    // 否则尝试匹配端口类型
    const targetDataType = inputHandle.dataType
    const outputKeys = Object.keys(upstreamOutputs)

    // 优先匹配确切的数据类型
    if (targetDataType === 'image') {
      return this.findImageValue(upstreamOutputs, inputHandle, outputKeys)
    }

    // 尝试按优先级顺序查找值
    const priorityKeys = this.getPriorityKeys(targetDataType, inputHandle.id)

    for (const key of priorityKeys) {
      if (upstreamOutputs[key] !== undefined && upstreamOutputs[key] !== null) {
        return upstreamOutputs[key]
      }
    }

    // 如果只有一个输出，直接使用
    if (outputKeys.length === 1) {
      return upstreamOutputs[outputKeys[0]]
    }

    logger.warn('无法找到匹配的上游输出', {
      nodeId: node.id,
      inputHandle: inputHandle.id,
      targetDataType,
      availableKeys: outputKeys
    })

    return undefined
  }

  /**
   * 查找图片类型的值
   */
  private static findImageValue(
    upstreamOutputs: Record<string, any>,
    inputHandle: NodeHandle,
    outputKeys: string[]
  ): any {
    // 检查是否有直接匹配的输出
    if (upstreamOutputs[inputHandle.id] !== undefined) {
      return upstreamOutputs[inputHandle.id]
    }

    // 查找图片相关的键
    const imageKeys = ['image', 'images', 'modelImage', 'editedImage', 'generatedImage']

    for (const key of imageKeys) {
      if (upstreamOutputs[key] !== undefined) {
        return upstreamOutputs[key]
      }
    }

    // 查找包含 'image' 的键
    for (const key of outputKeys) {
      if (key.toLowerCase().includes('image') && upstreamOutputs[key] !== undefined) {
        return upstreamOutputs[key]
      }
    }

    return undefined
  }

  /**
   * 获取优先级键列表
   */
  private static getPriorityKeys(dataType: string, handleId: string): string[] {
    const keys = [handleId] // 优先使用同名键

    // 根据数据类型添加通用键
    switch (dataType) {
      case 'text':
        keys.push('text', 'result', 'output', 'content')
        break
      case 'image':
        keys.push('image', 'images', 'modelImage', 'editedImage')
        break
      case 'video':
        keys.push('video', 'videoUrl', 'videoPath')
        break
      case 'json':
        keys.push('json', 'data', 'result', 'metadata')
        break
      case 'any':
        keys.push('result', 'output', 'data', 'value')
        break
      default:
        keys.push('result', 'output')
        break
    }

    return keys
  }

  /**
   * 合并收集到的值
   */
  private static mergeCollectedValues(values: any[], inputHandle: NodeHandle): any {
    if (values.length === 0) {
      return undefined
    }

    // 如果输入端口支持多个值
    if (inputHandle.multiple) {
      const flatValues: any[] = []

      for (const value of values) {
        if (Array.isArray(value)) {
          flatValues.push(...value)
        } else {
          flatValues.push(value)
        }
      }

      return flatValues
    }

    // 单值模式，使用最后一个值
    const lastValue = values[values.length - 1]

    // 如果是数组但输入不支持多值，取第一个元素
    if (Array.isArray(lastValue) && !inputHandle.multiple) {
      return lastValue[0]
    }

    return lastValue
  }

  /**
   * 验证和转换输入数据
   */
  static validateAndTransformInputs(
    inputs: Record<string, any>,
    nodeInputs: NodeHandle[]
  ): { isValid: boolean; errors: string[]; transformedInputs: Record<string, any> } {
    const errors: string[] = []
    const transformedInputs: Record<string, any> = { ...inputs }

    for (const inputHandle of nodeInputs) {
      const value = inputs[inputHandle.id]

      // 检查必需输入
      if (inputHandle.required && (value === undefined || value === null)) {
        errors.push(`缺少必需输入: ${inputHandle.label} (${inputHandle.id})`)
        continue
      }

      // 类型转换和验证
      if (value !== undefined && value !== null) {
        const { isValid, transformedValue, error } = this.transformValueType(
          value,
          inputHandle.dataType,
          inputHandle.multiple ?? false
        )

        if (!isValid && error) {
          errors.push(`输入 ${inputHandle.label} (${inputHandle.id}) 类型错误: ${error}`)
        } else {
          transformedInputs[inputHandle.id] = transformedValue
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      transformedInputs
    }
  }

  /**
   * 转换值类型
   */
  private static transformValueType(
    value: any,
    expectedType: string,
    isMultiple: boolean
  ): { isValid: boolean; transformedValue: any; error?: string } {
    try {
      switch (expectedType) {
        case 'text':
          if (typeof value === 'string') {
            return { isValid: true, transformedValue: value }
          }
          // 尝试转换为字符串
          return { isValid: true, transformedValue: String(value) }

        case 'number':
          if (typeof value === 'number') {
            return { isValid: true, transformedValue: value }
          }
          const numValue = Number(value)
          if (isNaN(numValue)) {
            return { isValid: false, transformedValue: value, error: '无法转换为数字' }
          }
          return { isValid: true, transformedValue: numValue }

        case 'boolean':
          if (typeof value === 'boolean') {
            return { isValid: true, transformedValue: value }
          }
          // 转换字符串为布尔值
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase()
            if (lowerValue === 'true' || lowerValue === '1') {
              return { isValid: true, transformedValue: true }
            }
            if (lowerValue === 'false' || lowerValue === '0') {
              return { isValid: true, transformedValue: false }
            }
          }
          return { isValid: true, transformedValue: Boolean(value) }

        case 'image':
        case 'video':
        case 'json':
        case 'any':
          // 这些类型不进行强制转换
          if (isMultiple && !Array.isArray(value)) {
            return { isValid: true, transformedValue: [value] }
          }
          return { isValid: true, transformedValue: value }

        default:
          return { isValid: true, transformedValue: value }
      }
    } catch (error) {
      return {
        isValid: false,
        transformedValue: value,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
