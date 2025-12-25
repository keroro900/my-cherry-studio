/**
 * JSON 转换节点执行器
 * JSON Transform Node Executor
 *
 * 支持的操作：
 * - 路径提取 (extract)
 * - 模板映射 (map)
 * - 数组过滤 (filter)
 * - 数组排序 (sort)
 * - 数组扁平化 (flatten)
 * - 对象合并 (merge)
 * - 对象选择 (pick)
 * - 对象排除 (omit)
 * - 类型转换 (convert)
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface JsonTransformConfig {
  operation: 'extract' | 'map' | 'filter' | 'sort' | 'flatten' | 'merge' | 'pick' | 'omit' | 'convert'
  path?: string
  mapTemplate?: string
  filterCondition?: string
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  flattenDepth?: number
  fields?: string
  convertTo?: 'string' | 'number' | 'boolean' | 'array' | 'object'
  defaultValue?: string
}

export class JsonTransformExecutor extends BaseNodeExecutor {
  constructor() {
    super('json_transform')
  }

  async execute(
    inputs: Record<string, any>,
    config: JsonTransformConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行 JSON 转换', {
      operation: config.operation,
      hasInput: !!inputs.input
    })

    try {
      // 获取输入数据
      let input = inputs.input
      if (typeof input === 'string') {
        try {
          input = JSON.parse(input)
        } catch {
          // 保持原样
        }
      }

      if (input === undefined || input === null) {
        const defaultValue = this.parseDefaultValue(config.defaultValue)
        return this.success(
          {
            output: defaultValue,
            count: 0,
            keys: []
          },
          Date.now() - startTime
        )
      }

      // 执行操作
      let result: any
      switch (config.operation) {
        case 'extract':
          result = this.extractPath(input, config.path || '')
          break
        case 'map':
          result = this.mapTemplate(input, config.mapTemplate || '', inputs.template)
          break
        case 'filter':
          result = this.filterArray(input, config.filterCondition || '')
          break
        case 'sort':
          result = this.sortArray(input, config.sortKey || '', config.sortOrder || 'asc')
          break
        case 'flatten':
          result = this.flattenArray(input, config.flattenDepth || 1)
          break
        case 'merge':
          result = this.mergeObjects(input, inputs.template)
          break
        case 'pick':
          result = this.pickFields(input, config.fields || '')
          break
        case 'omit':
          result = this.omitFields(input, config.fields || '')
          break
        case 'convert':
          result = this.convertType(input, config.convertTo || 'string')
          break
        default:
          result = input
      }

      // 处理默认值
      if ((result === undefined || result === null) && config.defaultValue) {
        result = this.parseDefaultValue(config.defaultValue)
      }

      // 计算附加输出
      const count = this.getCount(result)
      const keys = this.getKeys(result)

      this.log(context, 'JSON 转换完成', {
        operation: config.operation,
        resultType: typeof result,
        count,
        keysCount: keys.length
      })

      return this.success(
        {
          output: result,
          count,
          keys
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, 'JSON 转换失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 路径提取
   * 支持 data.items[0].name 格式
   */
  private extractPath(data: any, path: string): any {
    if (!path) return data

    const parts = path.split(/[.\[\]]/).filter(Boolean)
    let result = data

    for (const part of parts) {
      if (result === undefined || result === null) {
        return undefined
      }
      result = result[part]
    }

    return result
  }

  /**
   * 模板映射
   * 使用 {{path}} 语法引用数据
   */
  private mapTemplate(data: any, templateStr: string, templateInput?: any): any {
    // 如果有模板输入，使用它
    let template: any
    if (templateInput) {
      template = typeof templateInput === 'string' ? JSON.parse(templateInput) : templateInput
    } else if (templateStr) {
      template = JSON.parse(templateStr)
    } else {
      return data
    }

    // 如果数据是数组，对每个元素应用模板
    if (Array.isArray(data)) {
      return data.map((item) => this.applyTemplate(template, item))
    }

    return this.applyTemplate(template, data)
  }

  /**
   * 应用模板到单个对象
   */
  private applyTemplate(template: any, data: any): any {
    if (typeof template === 'string') {
      // 替换 {{path}} 占位符
      return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const value = this.extractPath(data, path.trim())
        return value !== undefined ? String(value) : ''
      })
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.applyTemplate(item, data))
    }

    if (typeof template === 'object' && template !== null) {
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.applyTemplate(value, data)
      }
      return result
    }

    return template
  }

  /**
   * 数组过滤
   * 使用 JavaScript 表达式，item 引用当前元素
   */
  private filterArray(data: any, condition: string): any[] {
    if (!Array.isArray(data)) {
      return []
    }

    if (!condition) {
      return data
    }

    try {
      // 创建过滤函数
      const filterFn = new Function('item', 'index', `return ${condition}`)
      return data.filter((item, index) => {
        try {
          return filterFn(item, index)
        } catch {
          return false
        }
      })
    } catch {
      return data
    }
  }

  /**
   * 数组排序
   */
  private sortArray(data: any, key: string, order: 'asc' | 'desc'): any[] {
    if (!Array.isArray(data)) {
      return []
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = key ? this.extractPath(a, key) : a
      const bValue = key ? this.extractPath(b, key) : b

      if (aValue === bValue) return 0
      if (aValue === undefined || aValue === null) return 1
      if (bValue === undefined || bValue === null) return -1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue)
      }

      return aValue < bValue ? -1 : 1
    })

    return order === 'desc' ? sorted.reverse() : sorted
  }

  /**
   * 数组扁平化
   */
  private flattenArray(data: any, depth: number): any[] {
    if (!Array.isArray(data)) {
      return [data]
    }

    return data.flat(depth)
  }

  /**
   * 对象合并
   */
  private mergeObjects(data: any, other: any): any {
    if (typeof data !== 'object' || data === null) {
      return other || data
    }

    const otherObj = typeof other === 'string' ? JSON.parse(other) : other

    if (Array.isArray(data) && Array.isArray(otherObj)) {
      return [...data, ...otherObj]
    }

    return { ...data, ...otherObj }
  }

  /**
   * 选择字段
   */
  private pickFields(data: any, fields: string): any {
    const fieldList = fields
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)

    if (fieldList.length === 0) {
      return data
    }

    const pickFromObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj
      }

      const result: Record<string, any> = {}
      for (const field of fieldList) {
        if (field in obj) {
          result[field] = obj[field]
        }
      }
      return result
    }

    if (Array.isArray(data)) {
      return data.map(pickFromObject)
    }

    return pickFromObject(data)
  }

  /**
   * 排除字段
   */
  private omitFields(data: any, fields: string): any {
    const fieldList = fields
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)

    if (fieldList.length === 0) {
      return data
    }

    const omitFromObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj
      }

      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(obj)) {
        if (!fieldList.includes(key)) {
          result[key] = value
        }
      }
      return result
    }

    if (Array.isArray(data)) {
      return data.map(omitFromObject)
    }

    return omitFromObject(data)
  }

  /**
   * 类型转换
   */
  private convertType(data: any, targetType: string): any {
    switch (targetType) {
      case 'string':
        if (typeof data === 'object') {
          return JSON.stringify(data)
        }
        return String(data)

      case 'number':
        if (typeof data === 'string') {
          const num = parseFloat(data)
          return isNaN(num) ? 0 : num
        }
        if (typeof data === 'boolean') {
          return data ? 1 : 0
        }
        return Number(data) || 0

      case 'boolean':
        if (typeof data === 'string') {
          return data.toLowerCase() === 'true' || data === '1'
        }
        return Boolean(data)

      case 'array':
        if (Array.isArray(data)) {
          return data
        }
        if (typeof data === 'object' && data !== null) {
          return Object.values(data)
        }
        return [data]

      case 'object':
        if (typeof data === 'string') {
          try {
            return JSON.parse(data)
          } catch {
            return { value: data }
          }
        }
        if (Array.isArray(data)) {
          return Object.fromEntries(data.map((v, i) => [i, v]))
        }
        return data

      default:
        return data
    }
  }

  /**
   * 获取数量
   */
  private getCount(data: any): number {
    if (Array.isArray(data)) {
      return data.length
    }
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length
    }
    return 1
  }

  /**
   * 获取键列表
   */
  private getKeys(data: any): string[] {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return Object.keys(data)
    }
    return []
  }

  /**
   * 解析默认值
   */
  private parseDefaultValue(value?: string): any {
    if (!value) return null

    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}

export default JsonTransformExecutor
