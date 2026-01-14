/**
 * Music Generation Node Executor
 * 音乐生成节点执行器
 *
 * 支持 Suno、Udio 等音乐生成服务
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { MusicGenerationNodeConfig, MusicGenerationRequest, MusicGenerationResult } from './types'

export class MusicGenerationExecutor extends BaseNodeExecutor {
  constructor() {
    super('music_generation')
  }

  async execute(
    inputs: Record<string, unknown>,
    config: MusicGenerationNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 构建请求参数
      const request: MusicGenerationRequest = {
        lyrics: inputs.lyrics as string,
        style: (inputs.style as string) || (inputs.tags as string),
        title: inputs.title as string,
        description: inputs.description as string,
        continueFrom: inputs.continueFrom as string,
        instrumental: config.instrumental,
        duration: config.duration
      }

      // 根据模式验证必需参数
      if (config.mode === 'custom' && !request.lyrics) {
        return this.error('Custom 模式需要提供歌词', Date.now() - startTime)
      }

      if (config.mode === 'description' && !request.description) {
        return this.error('Description 模式需要提供音乐描述', Date.now() - startTime)
      }

      if (config.mode === 'continuation' && !request.continueFrom) {
        return this.error('Continuation 模式需要提供源音频 ID', Date.now() - startTime)
      }

      this.log(context, `开始生成音乐 (${config.provider}/${config.mode})`)

      // 根据提供商调用不同的 API
      let results: MusicGenerationResult[]

      switch (config.provider) {
        case 'suno':
          results = await this.generateWithSuno(request, config, context)
          break
        case 'udio':
          results = await this.generateWithUdio(request, config, context)
          break
        case 'custom_api':
          results = await this.generateWithCustomApi(request, config, context)
          break
        default:
          return this.error(`不支持的提供商: ${config.provider}`, Date.now() - startTime)
      }

      // 检查结果
      if (!results || results.length === 0) {
        return this.error('音乐生成失败：无结果返回', Date.now() - startTime)
      }

      // 如果需要等待完成
      if (config.waitForCompletion) {
        this.log(context, '等待音乐生成完成...')
        results = await this.waitForCompletion(results, config, context)
      }

      // 获取主音频 URL
      const mainResult = results.find((r) => r.status === 'completed' && r.audioUrl)
      const audioUrl = mainResult?.audioUrl

      this.log(context, `音乐生成完成，共 ${results.length} 个结果`)

      return this.success(
        {
          results,
          audioUrl,
          success: true,
          taskId: results[0]?.id
        },
        Date.now() - startTime
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.log(context, `执行错误: ${errorMessage}`)
      return this.error(errorMessage, Date.now() - startTime)
    }
  }

  /**
   * 使用 Suno API 生成音乐
   */
  private async generateWithSuno(
    request: MusicGenerationRequest,
    config: MusicGenerationNodeConfig,
    context: NodeExecutionContext
  ): Promise<MusicGenerationResult[]> {
    const apiUrl = config.apiUrl || 'https://api.suno.ai'
    const apiKey = config.apiKey

    if (!apiKey) {
      throw new Error('Suno API Key 未配置')
    }

    this.log(context, '调用 Suno API...')

    // 构建 Suno API 请求
    const endpoint = `${apiUrl}/api/generate`
    const body: Record<string, unknown> = {
      prompt: request.description || request.lyrics,
      make_instrumental: request.instrumental,
      wait_audio: false
    }

    if (request.title) {
      body.title = request.title
    }

    if (request.style) {
      body.tags = request.style
    }

    // 发送请求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Suno API 错误 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 解析 Suno 响应
    if (Array.isArray(data)) {
      return data.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        title: (item.title as string) || request.title || '未命名',
        tags: item.tags as string[] | undefined,
        audioUrl: item.audio_url as string | undefined,
        coverUrl: item.image_url as string | undefined,
        lyrics: item.lyric as string | undefined,
        status: this.mapSunoStatus(item.status as string),
        duration: item.duration as number | undefined,
        createdAt: item.created_at as string | undefined
      }))
    }

    // 单个结果
    return [
      {
        id: data.id as string,
        title: (data.title as string) || request.title || '未命名',
        tags: data.tags as string[] | undefined,
        audioUrl: data.audio_url as string | undefined,
        coverUrl: data.image_url as string | undefined,
        lyrics: data.lyric as string | undefined,
        status: this.mapSunoStatus(data.status as string),
        duration: data.duration as number | undefined,
        createdAt: data.created_at as string | undefined
      }
    ]
  }

  /**
   * 使用 Udio API 生成音乐
   */
  private async generateWithUdio(
    request: MusicGenerationRequest,
    config: MusicGenerationNodeConfig,
    context: NodeExecutionContext
  ): Promise<MusicGenerationResult[]> {
    const apiUrl = config.apiUrl || 'https://api.udio.com'
    const apiKey = config.apiKey

    if (!apiKey) {
      throw new Error('Udio API Key 未配置')
    }

    this.log(context, '调用 Udio API...')

    // 构建 Udio API 请求
    const endpoint = `${apiUrl}/v1/generate`
    const body: Record<string, unknown> = {
      prompt: request.description || `${request.style || ''} ${request.lyrics || ''}`.trim(),
      instrumental: request.instrumental
    }

    if (request.title) {
      body.title = request.title
    }

    // 发送请求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Udio API 错误 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 解析 Udio 响应
    return [
      {
        id: data.id as string,
        title: (data.title as string) || request.title || '未命名',
        audioUrl: data.audio_url as string | undefined,
        coverUrl: data.cover_url as string | undefined,
        status: data.status === 'completed' ? 'completed' : 'processing',
        duration: data.duration as number | undefined,
        createdAt: data.created_at as string | undefined
      }
    ]
  }

  /**
   * 使用自定义 API 生成音乐
   */
  private async generateWithCustomApi(
    request: MusicGenerationRequest,
    config: MusicGenerationNodeConfig,
    context: NodeExecutionContext
  ): Promise<MusicGenerationResult[]> {
    if (!config.apiUrl) {
      throw new Error('自定义 API 地址未配置')
    }

    this.log(context, `调用自定义 API: ${config.apiUrl}`)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    // 发送请求
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`自定义 API 错误 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 尝试解析通用格式
    if (Array.isArray(data)) {
      return data.map((item: Record<string, unknown>) => {
        const status: MusicGenerationResult['status'] =
          (item.status as string) === 'completed' ? 'completed' : 'processing'
        return {
          id: (item.id as string) || String(Date.now()),
          title: (item.title as string) || request.title || '未命名',
          audioUrl: (item.audio_url || item.audioUrl || item.url) as string | undefined,
          coverUrl: (item.cover_url || item.coverUrl || item.image) as string | undefined,
          lyrics: item.lyrics as string | undefined,
          status,
          duration: item.duration as number | undefined
        }
      })
    }

    const resultStatus: MusicGenerationResult['status'] =
      (data.status as string) === 'completed' ? 'completed' : 'processing'
    return [
      {
        id: (data.id as string) || String(Date.now()),
        title: (data.title as string) || request.title || '未命名',
        audioUrl: (data.audio_url || data.audioUrl || data.url) as string | undefined,
        coverUrl: (data.cover_url || data.coverUrl || data.image) as string | undefined,
        lyrics: data.lyrics as string | undefined,
        status: resultStatus,
        duration: data.duration as number | undefined
      }
    ]
  }

  /**
   * 等待音乐生成完成
   */
  private async waitForCompletion(
    results: MusicGenerationResult[],
    config: MusicGenerationNodeConfig,
    context: NodeExecutionContext
  ): Promise<MusicGenerationResult[]> {
    const maxWaitTime = (config.maxWaitTime || 300) * 1000 // 默认 5 分钟
    const pollInterval = config.pollInterval || 5000 // 默认 5 秒
    const startTime = Date.now()

    let currentResults = [...results]

    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否所有结果都已完成
      const allCompleted = currentResults.every((r) => r.status === 'completed' || r.status === 'failed')

      if (allCompleted) {
        break
      }

      // 等待
      await this.sleep(pollInterval)

      // 查询状态（这里需要根据实际 API 实现）
      this.log(context, '查询生成状态...')

      // TODO: 实现状态查询逻辑
      // 目前只是模拟等待
    }

    return currentResults
  }

  /**
   * 映射 Suno 状态到内部状态
   */
  private mapSunoStatus(status: string): MusicGenerationResult['status'] {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'complete':
      case 'done':
        return 'completed'
      case 'failed':
      case 'error':
        return 'failed'
      case 'processing':
      case 'running':
      case 'generating':
        return 'processing'
      default:
        return 'pending'
    }
  }
}
