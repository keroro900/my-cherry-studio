/**
 * HTTP 请求节点执行器
 * HTTP Request Node Executor
 *
 * 执行 HTTP 请求并处理响应
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

// 类型定义
interface HttpRequestConfig {
  url?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: string
  bodyType: 'json' | 'form' | 'raw' | 'none'
  body?: string
  authType: 'none' | 'bearer' | 'basic' | 'apikey'
  authToken?: string
  basicUsername?: string
  basicPassword?: string
  apiKeyName?: string
  responseType: 'json' | 'text' | 'binary'
  jsonPath?: string
  timeout: number
  retryCount: number
  retryDelay: number
  followRedirects: boolean
  validateStatus: boolean
  ignoreSSL: boolean
}

export class HttpRequestExecutor extends BaseNodeExecutor {
  constructor() {
    super('http_request')
  }

  async execute(
    inputs: Record<string, any>,
    config: HttpRequestConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行 HTTP 请求节点', {
      method: config.method,
      hasUrl: !!(config.url || inputs.url)
    })

    try {
      // 1. 解析变量
      const variables = inputs.variables || {}

      // 2. 构建 URL
      let url = inputs.url || config.url
      if (!url) {
        return this.error('请配置请求 URL', Date.now() - startTime)
      }
      url = this.interpolateVariables(url, variables)

      // 3. 构建 Headers
      const headers = this.buildHeaders(config, inputs, variables)

      // 4. 构建请求体
      const body = this.buildBody(config, inputs, variables)

      this.log(context, '请求配置', {
        url,
        method: config.method,
        headersCount: Object.keys(headers).length,
        hasBody: !!body
      })

      // 5. 执行请求（带重试）
      let lastError: Error | null = null
      let response: Response | null = null

      for (let attempt = 0; attempt <= config.retryCount; attempt++) {
        if (attempt > 0) {
          this.log(context, `重试第 ${attempt} 次...`)
          await this.delay(config.retryDelay * 1000)
        }

        try {
          response = await this.makeRequest(url, config, headers, body, context)

          // 检查状态码
          if (config.validateStatus && !response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          break // 成功，退出重试循环
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          this.log(context, `请求失败: ${lastError.message}`)
        }
      }

      if (!response) {
        return this.error(lastError?.message || '请求失败', Date.now() - startTime)
      }

      // 6. 解析响应
      const result = await this.parseResponse(response, config, context)

      const duration = Date.now() - startTime
      this.log(context, '请求完成', {
        status: response.status,
        duration: `${duration}ms`
      })

      return this.success(
        {
          response: result.full,
          data: result.data,
          text: result.text,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          success: response.ok
        },
        duration
      )
    } catch (error) {
      this.logError(context, 'HTTP 请求失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 变量插值
   */
  private interpolateVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = variables[key]
      if (value === undefined) return `{{${key}}}`
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    })
  }

  /**
   * 构建请求头
   */
  private buildHeaders(
    config: HttpRequestConfig,
    inputs: Record<string, any>,
    variables: Record<string, any>
  ): Record<string, string> {
    const headers: Record<string, string> = {}

    // 解析配置中的 Headers
    if (config.headers) {
      try {
        const configHeaders = JSON.parse(this.interpolateVariables(config.headers, variables))
        Object.assign(headers, configHeaders)
      } catch {
        // 忽略解析错误
      }
    }

    // 合并输入的 Headers
    if (inputs.headers && typeof inputs.headers === 'object') {
      Object.assign(headers, inputs.headers)
    }

    // 添加认证头
    switch (config.authType) {
      case 'bearer':
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${this.interpolateVariables(config.authToken, variables)}`
        }
        break
      case 'basic':
        if (config.basicUsername && config.basicPassword) {
          const credentials = btoa(`${config.basicUsername}:${config.basicPassword}`)
          headers['Authorization'] = `Basic ${credentials}`
        }
        break
      case 'apikey':
        if (config.authToken) {
          const keyName = config.apiKeyName || 'X-API-Key'
          headers[keyName] = this.interpolateVariables(config.authToken, variables)
        }
        break
    }

    // 设置默认 Content-Type
    if (!headers['Content-Type'] && config.bodyType === 'json') {
      headers['Content-Type'] = 'application/json'
    } else if (!headers['Content-Type'] && config.bodyType === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    return headers
  }

  /**
   * 构建请求体
   */
  private buildBody(
    config: HttpRequestConfig,
    inputs: Record<string, any>,
    variables: Record<string, any>
  ): string | FormData | undefined {
    if (config.method === 'GET' || config.bodyType === 'none') {
      return undefined
    }

    // 优先使用输入的 body
    let bodyData = inputs.body || config.body

    if (!bodyData) {
      return undefined
    }

    // 如果是字符串，进行变量插值
    if (typeof bodyData === 'string') {
      bodyData = this.interpolateVariables(bodyData, variables)
    }

    // 如果是 JSON 类型但输入是对象，序列化
    if (config.bodyType === 'json' && typeof bodyData === 'object') {
      return JSON.stringify(bodyData)
    }

    // 如果是表单类型
    if (config.bodyType === 'form' && typeof bodyData === 'object') {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(bodyData)) {
        params.append(key, String(value))
      }
      return params.toString()
    }

    return String(bodyData)
  }

  /**
   * 执行 HTTP 请求
   */
  private async makeRequest(
    url: string,
    config: HttpRequestConfig,
    headers: Record<string, string>,
    body: string | FormData | undefined,
    context: NodeExecutionContext
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout * 1000)

    // 合并中止信号
    if (context.abortSignal) {
      context.abortSignal.addEventListener('abort', () => controller.abort())
    }

    try {
      const fetchOptions: RequestInit = {
        method: config.method,
        headers,
        redirect: config.followRedirects ? 'follow' : 'manual',
        signal: controller.signal
      }
      // Only include body for non-GET methods
      if (body !== undefined && config.method !== 'GET') {
        fetchOptions.body = body
      }
      const response = await fetch(url, fetchOptions)

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 解析响应
   */
  private async parseResponse(
    response: Response,
    config: HttpRequestConfig,
    context: NodeExecutionContext
  ): Promise<{ full: any; data: any; text: string }> {
    let text = ''
    let data: any = null
    let full: any = null

    try {
      if (config.responseType === 'binary') {
        const buffer = await response.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        text = `data:${response.headers.get('content-type') || 'application/octet-stream'};base64,${base64}`
        data = { base64, contentType: response.headers.get('content-type') }
        full = data
      } else {
        text = await response.text()

        // 尝试解析为 JSON
        try {
          data = JSON.parse(text)
          full = data

          // 如果配置了 JSON 路径，提取数据
          if (config.jsonPath) {
            data = this.extractJsonPath(data, config.jsonPath)
          }
        } catch {
          // 不是 JSON，保持文本
          data = text
          full = text
        }
      }
    } catch (err) {
      this.log(context, '解析响应失败', { error: String(err) })
      data = null
      full = null
    }

    return { full, data, text }
  }

  /**
   * 提取 JSON 路径
   * 支持简单的路径语法：$.data.results 或 data.results
   */
  private extractJsonPath(data: any, path: string): any {
    // 移除开头的 $.
    const normalizedPath = path.replace(/^\$\.?/, '')

    if (!normalizedPath) return data

    const parts = normalizedPath.split('.')
    let result = data

    for (const part of parts) {
      if (result === null || result === undefined) return null

      // 处理数组索引 [0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        result = result[arrayMatch[1]]
        if (Array.isArray(result)) {
          result = result[parseInt(arrayMatch[2], 10)]
        }
      } else {
        result = result[part]
      }
    }

    return result
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default HttpRequestExecutor
