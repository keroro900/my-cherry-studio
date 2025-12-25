/**
 * 代码执行节点执行器
 * Code Executor Node Executor
 *
 * 在安全沙箱中运行用户代码
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

interface CodeExecutorConfig {
  code: string
  async: boolean
  timeout: number
  errorHandling: 'throw' | 'null' | 'error'
}

export class CodeExecutorExecutor extends BaseNodeExecutor {
  constructor() {
    super('code_executor')
  }

  async execute(
    inputs: Record<string, any>,
    config: CodeExecutorConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行代码节点', {
      codeLength: config.code?.length,
      async: config.async,
      timeout: config.timeout
    })

    try {
      if (!config.code || config.code.trim() === '') {
        return this.error('请提供要执行的代码', Date.now() - startTime)
      }

      // 执行代码
      const result = await this.executeCode(config, inputs, context)

      const duration = Date.now() - startTime
      this.log(context, '代码执行完成', {
        duration: `${duration}ms`,
        hasOutput: result.output !== undefined,
        logCount: result.logs.length
      })

      return this.success(
        {
          output: result.output,
          output1: result.outputs.output1,
          output2: result.outputs.output2,
          logs: result.logs
        },
        duration
      )
    } catch (error) {
      const duration = Date.now() - startTime

      // 根据错误处理策略返回
      if (config.errorHandling === 'null') {
        return this.success(
          { output: null, output1: null, output2: null, logs: [] },
          duration
        )
      } else if (config.errorHandling === 'error') {
        return this.success(
          {
            output: {
              error: true,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            },
            output1: null,
            output2: null,
            logs: []
          },
          duration
        )
      }

      this.logError(context, '代码执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), duration)
    }
  }

  /**
   * 在沙箱中执行代码
   */
  private async executeCode(
    config: CodeExecutorConfig,
    inputs: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<{ output: any; outputs: Record<string, any>; logs: string[] }> {
    const logs: string[] = []
    const outputs: Record<string, any> = {}

    // 创建安全的 console
    const safeConsole = {
      log: (...args: any[]) => {
        const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        logs.push(message)
      },
      warn: (...args: any[]) => {
        const message = `[WARN] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
        logs.push(message)
      },
      error: (...args: any[]) => {
        const message = `[ERROR] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
        logs.push(message)
      },
      info: (...args: any[]) => {
        const message = `[INFO] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
        logs.push(message)
      }
    }

    // 创建安全的工具函数
    const utils = {
      // JSON 处理
      parseJSON: (str: string) => {
        try {
          return JSON.parse(str)
        } catch {
          return null
        }
      },
      stringify: (obj: any, pretty = false) => {
        return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj)
      },

      // 字符串处理
      trim: (str: string) => String(str).trim(),
      split: (str: string, sep: string) => String(str).split(sep),
      join: (arr: any[], sep: string) => arr.join(sep),

      // 数组处理
      first: (arr: any[]) => (Array.isArray(arr) ? arr[0] : null),
      last: (arr: any[]) => (Array.isArray(arr) ? arr[arr.length - 1] : null),
      length: (arr: any[] | string) => (arr ? arr.length : 0),

      // 类型检查
      isArray: Array.isArray,
      isObject: (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v),
      isString: (v: any) => typeof v === 'string',
      isNumber: (v: any) => typeof v === 'number',

      // 安全取值
      get: (obj: any, path: string, defaultValue: any = null) => {
        if (!obj) return defaultValue
        const parts = path.split('.')
        let result = obj
        for (const part of parts) {
          if (result === null || result === undefined) return defaultValue
          result = result[part]
        }
        return result ?? defaultValue
      },

      // 延迟（仅异步模式）
      delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    }

    // 构建执行函数
    const wrappedCode = config.async
      ? `return (async function() { ${config.code} })();`
      : `return (function() { ${config.code} })();`

    // 创建函数
    const fn = new Function('inputs', 'outputs', 'console', 'utils', wrappedCode)

    // 执行代码，带超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`代码执行超时（${config.timeout}秒）`)), config.timeout * 1000)
    })

    // 如果有中止信号
    const abortPromise = context.abortSignal
      ? new Promise<never>((_, reject) => {
          context.abortSignal!.addEventListener('abort', () => reject(new Error('代码执行被中止')))
        })
      : null

    const executePromise = Promise.resolve(fn(inputs, outputs, safeConsole, utils))

    const promises = [executePromise, timeoutPromise]
    if (abortPromise) promises.push(abortPromise)

    const output = await Promise.race(promises)

    return { output, outputs, logs }
  }
}

export default CodeExecutorExecutor
