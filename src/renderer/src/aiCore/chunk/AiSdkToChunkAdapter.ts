/**
 * AI SDK 到 Cherry Studio Chunk 适配器
 * 用于将 AI SDK 的 fullStream 转换为 Cherry Studio 的 chunk 格式
 *
 * VCP 协议支持:
 * 本适配器原生支持 VCP TOOL_REQUEST 协议，能够在流处理期间检测并执行工具调用。
 * 使用 VCPProtocolParser 进行协议解析，通过 vcpUnified API 执行工具。
 */

import { loggerService } from '@logger'
import type { AISDKWebSearchResult, MCPTool, MCPToolResponse, WebSearchResults } from '@renderer/types'
import { WebSearchSource } from '@renderer/types'
import type { Chunk } from '@renderer/types/chunk'
import { ChunkType } from '@renderer/types/chunk'
import { ProviderSpecificError } from '@renderer/types/provider-specific-error'
import { addSpan, endSpan } from '@renderer/services/SpanManagerService'
import { formatErrorMessage } from '@renderer/utils/error'
import { convertLinks, flushLinkConverterBuffer } from '@renderer/utils/linkConverter'
import { requestToolConfirmation, setToolIdToNameMapping } from '@renderer/utils/userConfirmation'
import type { ClaudeCodeRawValue } from '@shared/agents/claudecode/types'
import { AISDKError, type TextStreamPart, type ToolSet } from 'ai'

import { ToolCallChunkHandler } from './handleToolCallChunk'
import { vcpProtocolParser } from '../legacy/clients/vcp'
import type { VCPToolRequest } from '../legacy/clients/vcp/types'

const logger = loggerService.withContext('AiSdkToChunkAdapter')

/**
 * 安全地将值序列化为字符串
 * 处理对象、数组、null、undefined 等情况
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[Unserializable Object]'
    }
  }
  return String(value)
}

/**
 * 工具执行结果，用于递归 AI 调用
 */
export interface VCPToolExecutionResultForContinuation {
  toolName: string
  success: boolean
  output: string
}

/**
 * 递归 AI 调用回调函数类型
 * 当工具执行完成后，调用此函数继续 AI 对话
 */
export type ContinueConversationCallback = (
  toolResults: VCPToolExecutionResultForContinuation[]
) => Promise<string>

/**
 * AI SDK 到 Cherry Studio Chunk 适配器类
 * 处理 fullStream 到 Cherry Studio chunk 的转换
 *
 * VCP 统一协议：
 * - SDK tool-call 事件统一转换为 VCP 格式执行
 * - 原生 ToolCallChunkHandler 已废弃，仅保留作为备用
 * - 支持工具执行后的递归 AI 调用
 */
export class AiSdkToChunkAdapter {
  /**
   * @deprecated VCP 统一协议后不再使用，保留作为备用
   */
  toolCallHandler: ToolCallChunkHandler
  private accumulate: boolean | undefined
  private isFirstChunk = true
  private enableWebSearch: boolean = false
  private onSessionUpdate?: (sessionId: string) => void
  private responseStartTimestamp: number | null = null
  private firstTokenTimestamp: number | null = null
  private hasTextContent = false
  private getSessionWasCleared?: () => boolean
  private abortSignal?: AbortSignal

  // VCP 协议支持：缓冲区用于检测和处理 VCP 工具请求
  private vcpBuffer = ''
  private vcpToolsEnabled = true // VCP 工具处理始终启用
  private isProcessingVCPTool = false

  // 递归 AI 调用支持
  private continueConversation?: ContinueConversationCallback
  private pendingToolResults: VCPToolExecutionResultForContinuation[] = []
  private hasToolCallsInCurrentStream = false

  // Span 追踪支持
  private topicId?: string
  private modelName?: string

  constructor(
    private onChunk: (chunk: Chunk) => void,
    mcpTools: MCPTool[] = [],
    accumulate?: boolean,
    enableWebSearch?: boolean,
    onSessionUpdate?: (sessionId: string) => void,
    getSessionWasCleared?: () => boolean,
    abortSignal?: AbortSignal,
    continueConversation?: ContinueConversationCallback,
    topicId?: string,
    modelName?: string
  ) {
    // @deprecated 保留 toolCallHandler 作为备用，VCP 统一协议后不再使用
    this.toolCallHandler = new ToolCallChunkHandler(onChunk, mcpTools)
    this.accumulate = accumulate
    this.enableWebSearch = enableWebSearch || false
    this.onSessionUpdate = onSessionUpdate
    this.getSessionWasCleared = getSessionWasCleared
    this.abortSignal = abortSignal
    this.continueConversation = continueConversation
    this.topicId = topicId
    this.modelName = modelName
  }

  private markFirstTokenIfNeeded() {
    if (this.firstTokenTimestamp === null && this.responseStartTimestamp !== null) {
      this.firstTokenTimestamp = Date.now()
    }
  }

  private resetTimingState() {
    this.responseStartTimestamp = null
    this.firstTokenTimestamp = null
  }

  /**
   * 重置 VCP 处理状态
   */
  private resetVCPState() {
    this.vcpBuffer = ''
    this.isProcessingVCPTool = false
    this.pendingToolResults = []
    this.hasToolCallsInCurrentStream = false
  }

  /**
   * 检查文本中是否有完整的 VCP 工具请求块
   * 使用 VCPProtocolParser 进行检测
   */
  private hasCompleteVCPBlock(): boolean {
    return vcpProtocolParser.hasToolRequests(this.vcpBuffer)
  }

  /**
   * 处理 VCP 工具请求
   * 解析、执行工具并发出相应的 chunks
   */
  private async processVCPToolRequests(): Promise<void> {
    if (!this.hasCompleteVCPBlock() || this.isProcessingVCPTool) {
      return
    }

    this.isProcessingVCPTool = true

    try {
      const requests = vcpProtocolParser.parseToolRequests(this.vcpBuffer)

      if (requests.length === 0) {
        return
      }

      logger.info('[VCP] Found tool requests in stream', {
        count: requests.length,
        tools: requests.map(r => r.toolName)
      })

      // 执行每个工具请求
      for (const request of requests) {
        await this.executeVCPTool(request)
      }

      // 清除已处理的 VCP 块
      this.vcpBuffer = vcpProtocolParser.removeToolRequestBlocks(this.vcpBuffer)

    } catch (error) {
      logger.error('[VCP] Error processing tool requests:', error as Error)
    } finally {
      this.isProcessingVCPTool = false
    }
  }

  /**
   * 执行单个 VCP 工具
   * 通过 vcpUnified API 调用，支持 VCP 和 MCP 双协议
   * 支持 archery 模式（fire-and-forget）
   * 支持用户确认流程
   */
  private async executeVCPTool(request: VCPToolRequest): Promise<void> {
    const startTime = Date.now()
    const toolId = `vcp_${request.toolName}_${startTime}`

    // 创建工具信息
    const toolInfo: MCPTool = {
      id: request.toolName,
      name: request.toolName,
      serverId: 'vcp',
      serverName: 'VCP Plugin',
      description: `VCP Tool: ${request.toolName}`,
      inputSchema: { type: 'object' },
      type: 'mcp'
    }

    // 设置 tool ID 到 name 的映射，支持批量确认同名工具
    setToolIdToNameMapping(toolId, request.toolName)

    // archery 模式：fire-and-forget，不等待结果和用户确认
    if (request.archery) {
      logger.info('[VCP] Archery mode - executing without waiting', {
        tool: request.toolName
      })

      // 发出 pending 状态（表示已触发）
      this.onChunk({
        type: ChunkType.MCP_TOOL_PENDING,
        responses: [{
          id: toolId,
          tool: toolInfo,
          arguments: request.params,
          status: 'pending'
        }]
      })

      // 异步执行，不等待结果
      if (window.api?.vcpUnified?.executeTool) {
        window.api.vcpUnified.executeTool({
          toolName: request.toolName,
          params: request.params as Record<string, unknown>,
          source: 'vcp'
        }).catch((err) => {
          logger.warn(`[VCP] Archery tool ${request.toolName} failed:`, err)
        })
      }

      // 立即发出完成状态（archery 模式不返回结果）
      this.onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [{
          id: toolId,
          tool: toolInfo,
          arguments: request.params,
          status: 'done',
          response: {
            isError: false,
            content: [{ type: 'text', text: '[Archery mode: fire-and-forget]' }]
          }
        }]
      })

      return
    }

    // 正常模式：等待用户确认后执行
    // 发出 pending 状态（UI 会显示确认按钮）
    const pendingResponse: MCPToolResponse = {
      id: toolId,
      tool: toolInfo,
      arguments: request.params,
      status: 'pending'
    }

    this.onChunk({
      type: ChunkType.MCP_TOOL_PENDING,
      responses: [pendingResponse]
    })

    // 等待用户确认（UI 会自动倒计时或用户手动确认/取消）
    // abortSignal 用于中止确认等待
    const confirmed = await requestToolConfirmation(toolId, this.abortSignal)

    if (!confirmed) {
      // 用户取消了工具执行
      logger.info('[VCP] Tool execution cancelled by user', { tool: request.toolName })

      const cancelledResponse: MCPToolResponse = {
        id: toolId,
        tool: toolInfo,
        arguments: request.params,
        status: 'cancelled',
        response: {
          isError: false,
          content: [{ type: 'text', text: 'Tool execution cancelled by user' }]
        }
      }

      this.onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [cancelledResponse]
      })

      return
    }

    // 创建 span 用于追踪工具执行（如果有 topicId）
    let toolSpan: ReturnType<typeof addSpan> | undefined
    if (this.topicId) {
      try {
        toolSpan = addSpan({
          topicId: this.topicId,
          modelName: this.modelName,
          name: `VCP:${request.toolName}`,
          inputs: request.params,
          tag: 'vcp-tool'
        })
      } catch (spanError) {
        logger.debug('[VCP] Failed to create span for tool', { error: spanError })
      }
    }

    try {
      // 使用 VCP 统一 API 执行工具
      if (window.api?.vcpUnified?.executeTool) {
        const result = await window.api.vcpUnified.executeTool({
          toolName: request.toolName,
          params: request.params as Record<string, unknown>,
          source: 'vcp'
        })

        // 结束 span
        if (toolSpan && this.topicId) {
          try {
            if (result.success) {
              endSpan({
                topicId: this.topicId,
                modelName: this.modelName,
                span: toolSpan,
                outputs: {
                  status: 'success',
                  result: safeStringify(result.output)
                }
              })
            } else {
              endSpan({
                topicId: this.topicId,
                modelName: this.modelName,
                span: toolSpan,
                error: new Error(safeStringify(result.error) || `Tool '${request.toolName}' returned error without details`),
                outputs: {
                  status: 'error',
                  errorMessage: safeStringify(result.error) || `Tool '${request.toolName}' failed`
                }
              })
            }
          } catch (spanError) {
            logger.debug('[VCP] Failed to end span for tool', { error: spanError })
          }
        }

        // 发出完成状态
        const completeResponse: MCPToolResponse = {
          id: toolId,
          tool: toolInfo,
          arguments: request.params,
          status: result.success ? 'done' : 'error',
          response: {
            isError: !result.success,
            content: [{
              type: 'text',
              text: result.success ? safeStringify(result.output) : safeStringify(result.error)
            }]
          }
        }

        this.onChunk({
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [completeResponse]
        })

        // 收集工具执行结果用于递归 AI 调用
        this.hasToolCallsInCurrentStream = true
        this.pendingToolResults.push({
          toolName: request.toolName,
          success: result.success,
          output: result.success ? safeStringify(result.output) : safeStringify(result.error)
        })

        logger.info('[VCP] Tool executed', {
          tool: request.toolName,
          success: result.success,
          error: result.error,
          duration: Date.now() - startTime,
          pendingResultsCount: this.pendingToolResults.length
        })
      } else {
        // 结束 span（API 不可用错误）
        if (toolSpan && this.topicId) {
          try {
            endSpan({
              topicId: this.topicId,
              modelName: this.modelName,
              span: toolSpan,
              error: new Error('VCP unified API not available'),
              outputs: {
                status: 'error',
                errorMessage: 'VCP unified API not available'
              }
            })
          } catch (spanError) {
            logger.debug('[VCP] Failed to end span for tool', { error: spanError })
          }
        }

        // API 不可用，发出错误状态
        const errorResponse: MCPToolResponse = {
          id: toolId,
          tool: toolInfo,
          arguments: request.params,
          status: 'error',
          response: {
            isError: true,
            content: [{ type: 'text', text: 'VCP unified API not available' }]
          }
        }

        this.onChunk({
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [errorResponse]
        })

        // 收集错误结果
        this.hasToolCallsInCurrentStream = true
        this.pendingToolResults.push({
          toolName: request.toolName,
          success: false,
          output: 'VCP unified API not available'
        })

        logger.warn('[VCP] vcpUnified API not available')
      }
    } catch (error) {
      // 结束 span（执行错误）
      if (toolSpan && this.topicId) {
        try {
          endSpan({
            topicId: this.topicId,
            modelName: this.modelName,
            span: toolSpan,
            error: error as Error,
            outputs: {
              status: 'error',
              errorMessage: String(error)
            }
          })
        } catch (spanError) {
          logger.debug('[VCP] Failed to end span for tool', { error: spanError })
        }
      }

      // 执行失败，发出错误状态
      const errorResponse: MCPToolResponse = {
        id: toolId,
        tool: toolInfo,
        arguments: request.params,
        status: 'error',
        response: {
          isError: true,
          content: [{ type: 'text', text: String(error) }]
        }
      }

      this.onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [errorResponse]
      })

      // 收集错误结果
      this.hasToolCallsInCurrentStream = true
      this.pendingToolResults.push({
        toolName: request.toolName,
        success: false,
        output: String(error)
      })

      logger.error('[VCP] Tool execution failed:', error as Error)
    }
  }

  /**
   * 处理 AI SDK 流结果
   * @param aiSdkResult AI SDK 的流结果对象
   * @returns 最终的文本内容
   */
  async processStream(aiSdkResult: any): Promise<string> {
    logger.debug('[AiSdkToChunkAdapter] processStream started', {
      hasFullStream: !!aiSdkResult?.fullStream,
      hasTextStream: !!aiSdkResult?.textStream,
      resultKeys: aiSdkResult ? Object.keys(aiSdkResult) : []
    })

    // 如果是流式且有 fullStream
    if (aiSdkResult.fullStream) {
      await this.readFullStream(aiSdkResult.fullStream)
    }

    // 使用 streamResult.text 获取最终结果
    let finalText = await aiSdkResult.text

    // 检查是否有待处理的工具结果，需要递归调用 AI
    if (this.hasToolCallsInCurrentStream && this.pendingToolResults.length > 0 && this.continueConversation) {
      logger.info('[VCP] Tool calls detected, triggering continuation with tool results', {
        toolCount: this.pendingToolResults.length,
        tools: this.pendingToolResults.map(r => r.toolName)
      })

      // 发出 LLM_RESPONSE_CREATED 表示新的 AI 回复开始
      this.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED })

      try {
        // 调用递归回调函数，让 AI 继续处理工具结果
        const continuationText = await this.continueConversation(this.pendingToolResults)
        finalText = continuationText

        logger.info('[VCP] Continuation completed', {
          resultLength: continuationText?.length || 0
        })
      } catch (error) {
        logger.error('[VCP] Continuation failed:', error as Error)
        // 发出错误状态
        this.onChunk({
          type: ChunkType.ERROR,
          error: error as Error
        })
      }
    }

    logger.debug('[AiSdkToChunkAdapter] processStream finished', {
      finalTextLength: finalText?.length || 0,
      finalTextPreview: finalText?.substring(0, 100),
      hadToolCalls: this.hasToolCallsInCurrentStream
    })

    // 在递归调用检查完成后清理 VCP 状态
    // 这确保 pendingToolResults 和 hasToolCallsInCurrentStream 在需要时可用
    this.resetVCPState()

    return finalText
  }

  /**
   * 读取 fullStream 并转换为 Cherry Studio chunks
   * @param fullStream AI SDK 的 fullStream (ReadableStream)
   */
  private async readFullStream(fullStream: ReadableStream<TextStreamPart<ToolSet>>) {
    const reader = fullStream.getReader()
    const final = {
      text: '',
      reasoningContent: '',
      webSearchResults: [],
      reasoningId: ''
    }
    this.resetTimingState()
    this.resetVCPState() // 重置 VCP 状态
    this.responseStartTimestamp = Date.now()
    // Reset state at the start of stream
    this.isFirstChunk = true
    this.hasTextContent = false

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          logger.debug('[AiSdkToChunkAdapter] Stream finished', {
            hasTextContent: this.hasTextContent,
            finalTextLength: final.text.length
          })

          // 处理任何剩余的 VCP 工具请求
          if (this.vcpToolsEnabled && this.vcpBuffer) {
            await this.processVCPToolRequests()
          }

          // Flush any remaining content from link converter buffer if web search is enabled
          if (this.enableWebSearch) {
            const remainingText = flushLinkConverterBuffer()
            if (remainingText) {
              this.markFirstTokenIfNeeded()
              this.onChunk({
                type: ChunkType.TEXT_DELTA,
                text: remainingText
              })
            }
          }
          break
        }

        // 调试日志：记录接收到的 chunk 类型
        logger.debug('[AiSdkToChunkAdapter] Received chunk', {
          type: value?.type,
          hasText: 'text' in value && !!value.text,
          chunk: value
        })

        // 转换并发送 chunk
        await this.convertAndEmitChunk(value, final)
      }
    } finally {
      reader.releaseLock()
      this.resetTimingState()
      // 注意：不在这里调用 resetVCPState()
      // VCP 状态（包括 pendingToolResults 和 hasToolCallsInCurrentStream）
      // 需要保留到 processStream 中的递归调用检查完成后再重置
      // 重置将在 processStream 结束时进行
    }
  }

  /**
   * 如果有累积的思考内容，发送 THINKING_COMPLETE chunk 并清空
   * @param final 包含 reasoningContent 的状态对象
   * @returns 是否发送了 THINKING_COMPLETE chunk
   */
  private emitThinkingCompleteIfNeeded(final: { reasoningContent: string; [key: string]: any }) {
    if (final.reasoningContent) {
      this.onChunk({
        type: ChunkType.THINKING_COMPLETE,
        text: final.reasoningContent
      })
      final.reasoningContent = ''
    }
  }

  /**
   * 转换 AI SDK chunk 为 Cherry Studio chunk 并调用回调
   * @param chunk AI SDK 的 chunk 数据
   */
  private async convertAndEmitChunk(
    chunk: TextStreamPart<any>,
    final: { text: string; reasoningContent: string; webSearchResults: AISDKWebSearchResult[]; reasoningId: string }
  ) {
    logger.silly(`AI SDK chunk type: ${chunk.type}`, chunk)
    switch (chunk.type) {
      case 'raw': {
        const agentRawMessage = chunk.rawValue as ClaudeCodeRawValue
        if (agentRawMessage.type === 'init' && agentRawMessage.session_id) {
          this.onSessionUpdate?.(agentRawMessage.session_id)
        } else if (agentRawMessage.type === 'compact' && agentRawMessage.session_id) {
          this.onSessionUpdate?.(agentRawMessage.session_id)
        }
        this.onChunk({
          type: ChunkType.RAW,
          content: agentRawMessage
        })
        break
      }
      // === 文本相关事件 ===
      case 'text-start':
        // 如果有未完成的思考内容，先生成 THINKING_COMPLETE
        // 这处理了某些提供商不发送 reasoning-end 事件的情况
        this.emitThinkingCompleteIfNeeded(final)
        this.onChunk({
          type: ChunkType.TEXT_START
        })
        break
      case 'text-delta': {
        this.hasTextContent = true
        const processedText = chunk.text || ''
        let finalText: string

        // Only apply link conversion if web search is enabled
        if (this.enableWebSearch) {
          const result = convertLinks(processedText, this.isFirstChunk)

          if (this.isFirstChunk) {
            this.isFirstChunk = false
          }

          // Handle buffered content
          if (result.hasBufferedContent) {
            finalText = result.text
          } else {
            finalText = result.text || processedText
          }
        } else {
          // Without web search, just use the original text
          finalText = processedText
        }

        // VCP 协议支持：累积文本到缓冲区用于检测工具请求
        if (this.vcpToolsEnabled) {
          this.vcpBuffer += processedText

          // 检查是否有完整的 VCP 工具请求块
          if (this.hasCompleteVCPBlock()) {
            logger.debug('[VCP] Complete tool request block detected in stream')
            await this.processVCPToolRequests()
          }
        }

        // Accumulate for internal tracking (used in text-end event)
        if (this.accumulate) {
          final.text += finalText
        } else {
          final.text = finalText
        }

        // Only emit chunk if there's text to send
        if (finalText) {
          this.markFirstTokenIfNeeded()
          this.onChunk({
            type: ChunkType.TEXT_DELTA,
            text: this.accumulate ? final.text : finalText
          })
        }
        break
      }
      case 'text-end':
        this.onChunk({
          type: ChunkType.TEXT_COMPLETE,
          text: (chunk.providerMetadata?.text?.value as string) ?? final.text ?? ''
        })
        final.text = ''
        break
      case 'reasoning-start':
        // if (final.reasoningId !== chunk.id) {
        final.reasoningId = chunk.id
        this.onChunk({
          type: ChunkType.THINKING_START
        })
        // }
        break
      case 'reasoning-delta':
        final.reasoningContent += chunk.text || ''
        if (chunk.text) {
          this.markFirstTokenIfNeeded()
        }
        this.onChunk({
          type: ChunkType.THINKING_DELTA,
          text: final.reasoningContent || ''
        })
        break
      case 'reasoning-end':
        this.emitThinkingCompleteIfNeeded(final)
        break

      // === 工具调用相关事件 ===
      // VCP 统一协议：所有 SDK tool-call 事件转换为 VCP 格式执行
      // @see executeVCPTool 方法处理工具执行和用户确认流程

      case 'tool-call': {
        const toolName = chunk.toolName
        const toolArgs = (chunk.input || {}) as Record<string, unknown>

        // 检查是否为内置 SDK 工具（如 builtin_memory_search）
        // 这些工具有自己的 execute 函数，SDK 会自动执行，不需要通过 VCP
        if (toolName.startsWith('builtin_')) {
          logger.info('[SDK-Native] Native SDK tool detected, letting SDK handle execution', {
            toolName,
            toolCallId: chunk.toolCallId
          })
          // 使用 toolCallHandler 记录 pending 状态，SDK 会自动执行并发出 tool-result
          this.toolCallHandler.handleToolCall(chunk)
          break
        }

        // VCP 统一协议：将非内置 SDK tool-call 转换为 VCP 格式执行

        // 检查是否为 archery 模式（fire-and-forget）
        // 支持 no_reply 和 archery 两种参数名
        const isArchery = toolArgs.no_reply === true ||
                          toolArgs.no_reply === 'true' ||
                          toolArgs.archery === true ||
                          toolArgs.archery === 'true'

        logger.info('[VCP-Unified] Converting SDK tool-call to VCP format', {
          toolName,
          toolCallId: chunk.toolCallId,
          archery: isArchery
        })

        // 转换为 VCP 请求格式
        const vcpRequest: VCPToolRequest = {
          toolName,
          params: Object.fromEntries(
            Object.entries(toolArgs).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
          ),
          rawText: `[SDK tool-call: ${toolName}]`,
          startIndex: 0,
          endIndex: 0,
          archery: isArchery
        }

        // 通过 VCP 统一入口执行
        await this.executeVCPTool(vcpRequest)
        break
      }

      case 'tool-error': {
        const toolCallId = chunk.toolCallId

        // 检查是否为内置 SDK 工具的错误
        const toolInfo = ToolCallChunkHandler.getActiveToolCalls().get(toolCallId)
        if (toolInfo && toolInfo.toolName.startsWith('builtin_')) {
          logger.warn('[SDK-Native] Handling native SDK tool error', {
            toolCallId,
            toolName: toolInfo.toolName,
            error: chunk.error
          })
          // 使用 toolCallHandler 处理错误
          this.toolCallHandler.handleToolError(chunk)
          break
        }

        // VCP 统一协议：将 tool-error 转换为 VCP 错误格式
        logger.warn('[VCP-Unified] Tool error received', { toolCallId, error: chunk.error })

        // 发出错误状态 chunk
        this.onChunk({
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [{
            id: toolCallId,
            tool: {
              id: 'unknown',
              name: 'unknown',
              serverId: 'vcp',
              serverName: 'VCP Plugin',
              description: 'Tool error',
              inputSchema: { type: 'object' },
              type: 'mcp'
            },
            arguments: chunk.input as Record<string, unknown> || {},
            status: 'error',
            response: {
              isError: true,
              content: [{ type: 'text', text: String(chunk.error) }]
            }
          }]
        })
        break
      }

      case 'tool-result': {
        // 检查是否为内置 SDK 工具的结果
        // 这些工具由 SDK 执行，结果通过 tool-result 返回
        const toolInfo = ToolCallChunkHandler.getActiveToolCalls().get(chunk.toolCallId)
        if (toolInfo && toolInfo.toolName.startsWith('builtin_')) {
          logger.info('[SDK-Native] Handling native SDK tool result', {
            toolCallId: chunk.toolCallId,
            toolName: toolInfo.toolName
          })
          // 使用 toolCallHandler 处理结果
          this.toolCallHandler.handleToolResult(chunk)
          break
        }

        // VCP 统一协议：tool-result 现在由 executeVCPTool 内部处理
        // SDK 的 tool-result 通常是由 SDK 自动执行工具后返回的
        // 在 VCP 统一模式下，我们已经在 tool-call 时执行了工具
        // 因此这里只记录日志，不重复处理
        logger.debug('[VCP-Unified] Received tool-result (already handled by VCP execution)', {
          toolCallId: chunk.toolCallId
        })
        break
      }

      // === 步骤相关事件 ===
      // case 'start':
      //   this.onChunk({
      //     type: ChunkType.LLM_RESPONSE_CREATED
      //   })
      //   break
      // case 'start-step':
      //   this.onChunk({
      //     type: ChunkType.BLOCK_CREATED
      //   })
      //   break
      // case 'step-finish':
      //   this.onChunk({
      //     type: ChunkType.TEXT_COMPLETE,
      //     text: final.text || '' // TEXT_COMPLETE 需要 text 字段
      //   })
      //   final.text = ''
      //   break

      case 'finish-step': {
        const { providerMetadata, finishReason } = chunk
        // googel web search
        if (providerMetadata?.google?.groundingMetadata) {
          this.onChunk({
            type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
            llm_web_search: {
              results: providerMetadata.google?.groundingMetadata as WebSearchResults,
              source: WebSearchSource.GEMINI
            }
          })
        } else if (final.webSearchResults.length) {
          const providerName = Object.keys(providerMetadata || {})[0]
          const sourceMap: Record<string, WebSearchSource> = {
            [WebSearchSource.OPENAI]: WebSearchSource.OPENAI_RESPONSE,
            [WebSearchSource.ANTHROPIC]: WebSearchSource.ANTHROPIC,
            [WebSearchSource.OPENROUTER]: WebSearchSource.OPENROUTER,
            [WebSearchSource.GEMINI]: WebSearchSource.GEMINI,
            // [WebSearchSource.PERPLEXITY]: WebSearchSource.PERPLEXITY,
            [WebSearchSource.QWEN]: WebSearchSource.QWEN,
            [WebSearchSource.HUNYUAN]: WebSearchSource.HUNYUAN,
            [WebSearchSource.ZHIPU]: WebSearchSource.ZHIPU,
            [WebSearchSource.GROK]: WebSearchSource.GROK,
            [WebSearchSource.WEBSEARCH]: WebSearchSource.WEBSEARCH
          }
          const source = sourceMap[providerName] || WebSearchSource.AISDK

          this.onChunk({
            type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
            llm_web_search: {
              results: final.webSearchResults,
              source
            }
          })
        }
        if (finishReason === 'tool-calls') {
          this.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED })
        }

        final.webSearchResults = []
        // final.reasoningId = ''
        break
      }

      case 'finish': {
        // Check if session was cleared (e.g., /clear command) and no text was output
        const sessionCleared = this.getSessionWasCleared?.() ?? false
        if (sessionCleared && !this.hasTextContent) {
          // Inject a "context cleared" message for the user
          const clearMessage = '✨ Context cleared. Starting fresh conversation.'
          this.onChunk({
            type: ChunkType.TEXT_START
          })
          this.onChunk({
            type: ChunkType.TEXT_DELTA,
            text: clearMessage
          })
          this.onChunk({
            type: ChunkType.TEXT_COMPLETE,
            text: clearMessage
          })
          final.text = clearMessage
        }

        const usage = {
          completion_tokens: chunk.totalUsage?.outputTokens || 0,
          prompt_tokens: chunk.totalUsage?.inputTokens || 0,
          total_tokens: chunk.totalUsage?.totalTokens || 0
        }
        const metrics = this.buildMetrics(chunk.totalUsage)
        const baseResponse = {
          text: final.text || '',
          reasoning_content: final.reasoningContent || ''
        }

        this.onChunk({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            ...baseResponse,
            usage: { ...usage },
            metrics: metrics ? { ...metrics } : undefined
          }
        })
        this.onChunk({
          type: ChunkType.LLM_RESPONSE_COMPLETE,
          response: {
            ...baseResponse,
            usage: { ...usage },
            metrics: metrics ? { ...metrics } : undefined
          }
        })
        this.resetTimingState()
        break
      }

      // === 源和文件相关事件 ===
      case 'source':
        if (chunk.sourceType === 'url') {
          // oxlint-disable-next-line @typescript-eslint/no-unused-vars
          const { sourceType: _, ...rest } = chunk
          final.webSearchResults.push(rest)
        }
        break
      case 'file':
        // 文件相关事件，可能是图片生成
        this.onChunk({
          type: ChunkType.IMAGE_COMPLETE,
          image: {
            type: 'base64',
            images: [`data:${chunk.file.mediaType};base64,${chunk.file.base64}`]
          }
        })
        break
      case 'abort':
        this.onChunk({
          type: ChunkType.ERROR,
          error: new DOMException('Request was aborted', 'AbortError')
        })
        break
      case 'error':
        this.onChunk({
          type: ChunkType.ERROR,
          error: AISDKError.isInstance(chunk.error)
            ? chunk.error
            : new ProviderSpecificError({
                message: formatErrorMessage(chunk.error),
                provider: 'unknown',
                cause: chunk.error
              })
        })
        break

      default:
    }
  }

  private buildMetrics(totalUsage?: {
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
  }) {
    if (!totalUsage) {
      return undefined
    }

    const completionTokens = totalUsage.outputTokens ?? 0
    const now = Date.now()
    const start = this.responseStartTimestamp ?? now
    const firstToken = this.firstTokenTimestamp
    const timeFirstToken = Math.max(firstToken != null ? firstToken - start : 0, 0)
    const baseForCompletion = firstToken ?? start
    let timeCompletion = Math.max(now - baseForCompletion, 0)

    if (timeCompletion === 0 && completionTokens > 0) {
      timeCompletion = 1
    }

    return {
      completion_tokens: completionTokens,
      time_first_token_millsec: timeFirstToken,
      time_completion_millsec: timeCompletion
    }
  }
}

export default AiSdkToChunkAdapter
