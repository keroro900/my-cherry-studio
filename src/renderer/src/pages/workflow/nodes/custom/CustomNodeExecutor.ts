/**
 * 自定义节点执行器
 * Custom Node Executor
 *
 * 执行用户定义的自定义节点代码
 */

import { BaseNodeExecutor } from '../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../base/types'
import type { CustomNodeDefinition } from './types'

export class CustomNodeExecutor extends BaseNodeExecutor {
  private definition: CustomNodeDefinition

  constructor(definition: CustomNodeDefinition) {
    super(`custom_${definition.type}`)
    this.definition = definition
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行自定义节点', {
      type: this.definition.type,
      label: this.definition.label,
      executionMode: this.definition.executionMode
    })

    try {
      // 合并默认配置和用户配置
      const mergedConfig = { ...this.definition.defaultConfig, ...config }

      // 执行代码
      const result = await this.executeCode(inputs, mergedConfig, context)

      const duration = Date.now() - startTime
      this.log(context, '自定义节点执行完成', { duration: `${duration}ms` })

      return this.success(result, duration)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(context, '自定义节点执行失败', error)

      // 根据错误处理策略返回
      switch (this.definition.errorHandling) {
        case 'null':
          return this.success({ output: null }, duration)
        case 'default':
          return this.success({ output: this.definition.defaultReturnValue ?? null }, duration)
        case 'retry':
          // TODO: 实现重试逻辑
          return this.error(error instanceof Error ? error.message : String(error), duration)
        case 'throw':
        default:
          return this.error(error instanceof Error ? error.message : String(error), duration)
      }
    }
  }

  /**
   * 执行用户代码
   */
  private async executeCode(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<Record<string, any>> {
    const outputs: Record<string, any> = {}
    const logs: string[] = []

    // 创建安全的 console
    const safeConsole = {
      log: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        logs.push(`[LOG] ${msg}`)
        this.log(context, msg)
      },
      warn: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        logs.push(`[WARN] ${msg}`)
        this.log(context, `⚠️ ${msg}`)
      },
      error: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        logs.push(`[ERROR] ${msg}`)
        this.log(context, `❌ ${msg}`)
      },
      info: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        logs.push(`[INFO] ${msg}`)
        this.log(context, `ℹ️ ${msg}`)
      }
    }

    // 创建工具函数
    const utils = {
      parseJSON: (str: string) => {
        try {
          return JSON.parse(str)
        } catch {
          return null
        }
      },
      stringify: (obj: any, indent = 2) => JSON.stringify(obj, null, indent),
      delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
      get: (obj: any, path: string, defaultValue?: any) => {
        const parts = path.split(/[.[\]]/).filter(Boolean)
        let result = obj
        for (const part of parts) {
          if (result === undefined || result === null) return defaultValue
          result = result[part]
        }
        return result !== undefined ? result : defaultValue
      },
      set: (obj: any, path: string, value: any) => {
        const parts = path.split(/[.[\]]/).filter(Boolean)
        let current = obj
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!(part in current)) {
            current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {}
          }
          current = current[part]
        }
        current[parts[parts.length - 1]] = value
        return obj
      },
      isArray: Array.isArray,
      isObject: (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v),
      isString: (v: any) => typeof v === 'string',
      isNumber: (v: any) => typeof v === 'number' && !isNaN(v),
      isEmpty: (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
    }

    // 构建代码
    const code = this.definition.code
    const isAsync = this.definition.executionMode === 'async'

    // 包装代码
    const wrappedCode = isAsync ? `return (async () => { ${code} })();` : `return (() => { ${code} })();`

    // 创建函数
    const fn = new Function('inputs', 'config', 'outputs', 'console', 'utils', 'fetch', wrappedCode)

    // 执行代码（带超时）
    const timeoutMs = (this.definition.timeout || 30) * 1000
    const result = await Promise.race([
      fn(inputs, config, outputs, safeConsole, utils, fetch),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`执行超时 (${this.definition.timeout}秒)`)), timeoutMs)
      )
    ])

    // 构建输出
    const finalOutputs: Record<string, any> = {
      output: result,
      ...outputs
    }

    // 添加日志输出
    if (logs.length > 0) {
      finalOutputs.logs = logs
    }

    return finalOutputs
  }

  /**
   * 更新节点定义
   */
  updateDefinition(definition: CustomNodeDefinition): void {
    this.definition = definition
  }
}

export default CustomNodeExecutor
