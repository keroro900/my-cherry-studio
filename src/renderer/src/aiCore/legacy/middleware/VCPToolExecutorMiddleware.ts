import { loggerService } from '@logger'
import { addSpan, endSpan } from '@renderer/services/SpanManagerService'
import type { Assistant, MCPTool, MCPToolResponse, MCPToolResponseStatus } from '@renderer/types'
import type { Chunk, MCPToolCreatedChunk } from '@renderer/types/chunk'
import { ChunkType } from '@renderer/types/chunk'
import { confirmSameNameTools, requestToolConfirmation, setToolIdToNameMapping } from '@renderer/utils/userConfirmation'

import { vcpProtocolParser } from '../clients/vcp'
import {
  VCP_MARKERS,
  type VCPToolExecutionResult,
  type VCPToolExecutor,
  type VCPToolRequest,
  type VCPToolResponse
} from '../clients/vcp/types'
import type { CompletionsParams, CompletionsResult, GenericChunk } from './schemas'
import type { CompletionsContext, CompletionsMiddleware, VCPToolResult } from './types'

const logger = loggerService.withContext('VCPToolExecutorMiddleware')

/**
 * Maximum number of VCP tool recursion iterations
 * Prevents infinite loops in tool calling
 */
const MAX_VCP_RECURSION = 10

export const MIDDLEWARE_NAME = 'VCPToolExecutorMiddleware'

/**
 * Safely convert a value to string for tool response display
 * Handles objects by JSON stringifying them
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
      return String(value)
    }
  }
  return String(value)
}

/**
 * Create a VCP tool MCPToolResponse object
 * Response format matches MCP tools for UI consistency
 */
function createVCPToolResponse(
  toolId: string,
  tool: MCPTool,
  params: Record<string, string>,
  status: MCPToolResponseStatus,
  response?: unknown
): MCPToolResponse {
  return {
    id: toolId,
    tool,
    arguments: params,
    status,
    response
  }
}

/**
 * Emit MCP tool status chunk based on the tool's status
 * - 'pending' or 'invoking' → MCP_TOOL_IN_PROGRESS
 * - 'done', 'error', or 'cancelled' → MCP_TOOL_COMPLETE
 */
function emitToolStatusChunk(onChunk: ((chunk: Chunk) => void) | undefined, toolResponse: MCPToolResponse): void {
  if (!onChunk) return

  // Determine the correct chunk type based on status
  const isComplete =
    toolResponse.status === 'done' || toolResponse.status === 'cancelled' || toolResponse.status === 'error'

  if (isComplete) {
    onChunk({
      type: ChunkType.MCP_TOOL_COMPLETE,
      responses: [toolResponse]
    })
  } else {
    onChunk({
      type: ChunkType.MCP_TOOL_IN_PROGRESS,
      responses: [toolResponse]
    })
  }
}

/**
 * 将 SDK <tool_use> 格式转换为 VCP 请求格式
 *
 * MCPToolResponse { tool, arguments } → VCPToolRequest { toolName, params }
 *
 * 支持的工具名格式：
 * - VCP 格式: "DailyNoteWrite:ListNotes" → toolName="DailyNoteWrite:ListNotes"
 * - MCP 格式: "filesystem_read_file" → toolName="filesystem_read_file"
 */
function convertToolUseToVCPRequest(toolUse: MCPToolResponse): VCPToolRequest {
  const toolName = toolUse.tool?.name || toolUse.tool?.id || 'unknown'

  // 转换 arguments 为 string 格式（VCP 协议要求 string 值）
  const params: Record<string, string> = {}
  if (toolUse.arguments) {
    for (const [key, value] of Object.entries(toolUse.arguments)) {
      params[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
  }

  return {
    toolName,
    params,
    archery: false,
    rawText: '', // 从 SDK 格式转换，无原始文本
    startIndex: 0,
    endIndex: 0
  }
}

/**
 * Creates a middleware that detects and executes VCP TOOL_REQUEST protocol
 * in AI responses, implementing full multi-round tool calling similar to McpToolChunkMiddleware.
 *
 * Features:
 * - Parses VCP TOOL_REQUEST blocks from AI responses
 * - Executes tools via the provided executor function
 * - Supports archery mode (fire-and-forget)
 * - Multi-round recursive tool calling with AI
 * - TransformStream-based streaming with tool interception
 * - Limits recursion to prevent infinite loops
 *
 * @param executeToolFn - Function to execute VCP tools (optional, will use MCP tools from params if not provided)
 * @returns CompletionsMiddleware
 */
export const createVCPToolExecutorMiddleware = (executeToolFn?: VCPToolExecutor): CompletionsMiddleware => {
  return (_api) =>
    (next) =>
    async (ctx: CompletionsContext, params: CompletionsParams): Promise<CompletionsResult> => {
      // ============== 防止重复处理检查 ==============
      // 当使用 enhancedDispatch 进行递归调用时，会创建新的中间件实例
      // 检查 toolProcessingState 以避免重复处理同一响应
      const existingState = ctx._internal.toolProcessingState
      if (existingState?.isRecursiveCall && existingState?.vcpHandlerActive) {
        // 已经有一个 VCP 处理器在处理这个请求，直接传递
        logger.debug('VCP handler already active, skipping to prevent duplicate processing', {
          recursionDepth: existingState.recursionDepth
        })
        return next(ctx, params)
      }

      // 标记当前 VCP 处理器为活跃状态
      if (!ctx._internal.toolProcessingState) {
        ctx._internal.toolProcessingState = {}
      }
      ctx._internal.toolProcessingState.vcpHandlerActive = true

      // VCP 统一协议：始终启用 VCP 工具解析
      // 内置服务 (BuiltinServices) 不依赖 MCP 配置，应该始终可用
      // 即使没有配置 MCP 服务器，用户也可以使用 78+ 内置服务
      //
      // 注意: 之前的条件 (hasMcpServers || vcpConfigEnabled || hasMcpTools) 已移除
      // 现在 VCP 工具解析始终启用

      // 使用传入的执行器或创建基于 mcpTools 的执行器
      const toolExecutor = executeToolFn || createMcpToolExecutor(params.mcpTools || [])

      logger.info('VCP unified protocol enabled (always-on)', {
        mcpToolCount: params.mcpTools?.length || 0
      })

      /**
       * Recursive execution with VCP tool handling
       */
      const executeWithVCPToolHandling = async (
        currentParams: CompletionsParams,
        depth = 0
      ): Promise<CompletionsResult> => {
        if (depth >= MAX_VCP_RECURSION) {
          logger.error(`Maximum VCP recursion depth ${MAX_VCP_RECURSION} exceeded`)
          throw new Error(`Maximum VCP tool recursion depth ${MAX_VCP_RECURSION} exceeded`)
        }

        let result: CompletionsResult

        if (depth === 0) {
          // First call - use next() directly
          result = await next(ctx, currentParams)
        } else {
          // Recursive call - use enhancedDispatch
          const enhancedCompletions = ctx._internal.enhancedDispatch
          if (!enhancedCompletions) {
            logger.error('Enhanced completions method not found, cannot perform recursive call')
            throw new Error('Enhanced completions method not found')
          }

          // Update recursion state
          if (!ctx._internal.toolProcessingState) {
            ctx._internal.toolProcessingState = {}
          }
          ctx._internal.toolProcessingState.isRecursiveCall = true
          ctx._internal.toolProcessingState.recursionDepth = depth

          result = await enhancedCompletions(ctx, currentParams)
        }

        if (!result.stream) {
          // Non-streaming: process response directly
          const responseText = result.getText()
          if (!responseText || !vcpProtocolParser.hasToolRequests(responseText)) {
            return result
          }

          return await processVCPToolsNonStreaming(
            ctx,
            currentParams,
            result,
            responseText,
            toolExecutor,
            depth,
            executeWithVCPToolHandling
          )
        }

        // Streaming: use TransformStream to intercept and process
        const resultStream = result.stream as ReadableStream<GenericChunk>
        const vcpToolHandlingStream = resultStream.pipeThrough(
          createVCPToolHandlingTransform(ctx, currentParams, toolExecutor, depth, executeWithVCPToolHandling)
        )

        return {
          ...result,
          stream: vcpToolHandlingStream
        }
      }

      return executeWithVCPToolHandling(params, 0)
    }
}

/**
 * Process VCP tools for non-streaming responses
 */
async function processVCPToolsNonStreaming(
  ctx: CompletionsContext,
  params: CompletionsParams,
  result: CompletionsResult,
  responseText: string,
  executeToolFn: VCPToolExecutor,
  depth: number,
  executeWithVCPToolHandling: (params: CompletionsParams, depth: number) => Promise<CompletionsResult>
): Promise<CompletionsResult> {
  logger.info(`VCP tool requests detected in AI response at depth ${depth}`)

  const toolRequests = vcpProtocolParser.parseToolRequests(responseText)
  if (toolRequests.length === 0) {
    return result
  }

  logger.debug(`Found ${toolRequests.length} tool requests at depth ${depth}`)

  // Separate archery (fire-and-forget) and normal calls
  const archeryCalls = toolRequests.filter((r) => r.archery)
  const normalCalls = toolRequests.filter((r) => !r.archery)

  // Execute archery calls without waiting
  for (const request of archeryCalls) {
    executeToolFn(request.toolName, request.params).catch((err) => {
      logger.warn(`Archery tool ${request.toolName} failed:`, err as Error)
    })
  }

  // If only archery calls, we're done
  if (normalCalls.length === 0) {
    return result
  }

  // Get abort signal from context
  const abortSignal = ctx._internal.flowControl?.abortSignal

  // Execute normal calls and collect results (with user confirmation)
  const executionResults = await executeVCPTools(
    normalCalls,
    executeToolFn,
    params.assistant,
    params.mcpTools || [],
    params.onChunk,
    abortSignal,
    params.topicId,
    params.assistant?.model?.name
  )

  // Store results in context
  storeVCPToolResults(ctx, executionResults)

  // Format results for AI continuation
  const toolResultsText = formatToolResultsForAI(executionResults)

  // Build new params with tool results
  const newParams = buildParamsWithVCPToolResults(ctx, params, responseText, toolResultsText)

  // Notify UI about new LLM response
  if (params.onChunk) {
    params.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED })
  }

  // Recursive call with tool results
  return await executeWithVCPToolHandling(newParams, depth + 1)
}

/**
 * Create TransformStream for VCP tool handling in streaming mode
 */
function createVCPToolHandlingTransform(
  ctx: CompletionsContext,
  params: CompletionsParams,
  executeToolFn: VCPToolExecutor,
  depth: number,
  executeWithVCPToolHandling: (params: CompletionsParams, depth: number) => Promise<CompletionsResult>
): TransformStream<GenericChunk, GenericChunk> {
  let accumulatedText = ''
  let hasVCPToolRequests = false
  let streamEnded = false
  let toolRequestDetectedPosition = -1 // 记录工具请求开始的位置

  // 收集从 MCP_TOOL_CREATED chunk 转换来的 VCP 请求
  const pendingToolUseRequests: VCPToolRequest[] = []
  let hasToolUseRequests = false

  return new TransformStream({
    async transform(chunk: GenericChunk, controller) {
      try {
        // ============== 处理 MCP_TOOL_CREATED chunk ==============
        // 来自 ToolUseExtractionMiddleware 提取的 <tool_use> 格式
        // 转换为 VCP 格式后统一执行
        if (chunk.type === ChunkType.MCP_TOOL_CREATED) {
          const createdChunk = chunk as MCPToolCreatedChunk
          if (createdChunk.tool_use_responses && createdChunk.tool_use_responses.length > 0) {
            for (const toolUse of createdChunk.tool_use_responses) {
              const vcpRequest = convertToolUseToVCPRequest(toolUse)
              pendingToolUseRequests.push(vcpRequest)
              logger.debug('Converted tool_use to VCP request', {
                originalTool: toolUse.tool?.name,
                vcpToolName: vcpRequest.toolName
              })
            }
            hasToolUseRequests = true
          }
          // 传递 chunk 给 UI 显示工具卡片
          controller.enqueue(chunk)
          return
        }

        // ============== 处理 VCP 文本标记 ==============
        // Handle text chunks for VCP parsing
        // Note: TextChunkMiddleware modifies TEXT_DELTA to contain accumulated text (not delta)
        // So we use assignment (=) instead of accumulation (+=)
        if (chunk.type === ChunkType.TEXT_DELTA && 'text' in chunk) {
          accumulatedText = (chunk as any).text || ''

          // Check if we might have VCP tool requests
          // 支持 2-3 个 < 的格式以兼容不同 AI 模型的输出
          if (!hasVCPToolRequests) {
            // 先检查标准格式 (3个 <)
            let startPos = accumulatedText.indexOf(VCP_MARKERS.TOOL_REQUEST_START)
            // 如果没找到，检查兼容格式 (2个 <)
            if (startPos === -1) {
              startPos = accumulatedText.indexOf('<<[TOOL_REQUEST]>>')
            }
            if (startPos !== -1) {
              hasVCPToolRequests = true
              toolRequestDetectedPosition = startPos
              logger.debug('VCP tool request detected', { position: toolRequestDetectedPosition })
            }
          }

          // 如果检测到工具请求，只输出工具请求之前的文本
          // 工具请求之后的文本（包括占位符响应）不应该被输出
          if (hasVCPToolRequests && toolRequestDetectedPosition >= 0) {
            // 创建一个新的 chunk，只包含工具请求之前的文本
            const textBeforeToolRequest = accumulatedText.substring(0, toolRequestDetectedPosition)
            if (textBeforeToolRequest.length > 0) {
              controller.enqueue({
                ...chunk,
                text: textBeforeToolRequest
              } as GenericChunk)
            }
            // 不传递原始 chunk，避免输出工具请求和后续占位符
            return
          }
        } else if (chunk.type === ChunkType.TEXT_COMPLETE && 'text' in chunk) {
          // TEXT_COMPLETE contains the final accumulated text
          accumulatedText = (chunk as any).text || accumulatedText

          // 如果有工具请求，跳过 TEXT_COMPLETE 输出（因为我们会用递归调用的结果替代）
          if (hasVCPToolRequests || hasToolUseRequests) {
            logger.debug('VCP: Skipping TEXT_COMPLETE because tool requests detected')
            return
          }
        } else if (chunk.type === ChunkType.LLM_RESPONSE_COMPLETE) {
          // LLM_RESPONSE_COMPLETE signals the end of the response
          // This is a good time to check for VCP tool requests
          // because flush() may not be called if the stream is not fully consumed
          if (!streamEnded) {
            logger.debug('VCP: LLM_RESPONSE_COMPLETE received, triggering tool check')
            streamEnded = true
            await executeToolsIfNeeded(controller)
          }
          // 如果有工具请求，不传递原始的 LLM_RESPONSE_COMPLETE
          // 递归调用会发送自己的 LLM_RESPONSE_COMPLETE
          if (hasVCPToolRequests || hasToolUseRequests) {
            return
          }
        }

        // Pass through chunks only if no tool requests detected
        // (or for non-text chunks before tool detection)
        controller.enqueue(chunk)
      } catch (error) {
        logger.error('Error processing VCP chunk:', error as Error)
        controller.error(error)
      }
    },

    async flush(controller) {
      if (streamEnded) return
      streamEnded = true
      await executeToolsIfNeeded(controller)
    }
  })

  // 提取工具执行逻辑为独立函数
  async function executeToolsIfNeeded(controller: TransformStreamDefaultController<GenericChunk>) {
    try {
      // After stream ends, check for VCP tool requests
      // Always check the accumulated text regardless of hasVCPToolRequests flag
      // because the flag might not be set if the markers arrived after the check
      logger.info('[VCP-EXEC] executeToolsIfNeeded called', {
        depth,
        hasVCPToolRequests,
        hasToolUseRequests,
        pendingToolUseCount: pendingToolUseRequests.length,
        textLength: accumulatedText.length
      })

      // 记录文本内容以便调试（只记录关键部分）
      const hasVCPMarkerStart = accumulatedText.includes('<<[TOOL_REQUEST]') || accumulatedText.includes('<<<[TOOL_REQUEST]')
      const hasVCPMarkerEnd = accumulatedText.includes('[END_TOOL_REQUEST]')
      logger.debug('[VCP-EXEC] Text markers check', {
        hasVCPMarkerStart,
        hasVCPMarkerEnd,
        textPreview: accumulatedText.substring(0, 300)
      })

      // 收集所有工具请求：VCP 标记 + tool_use 格式
      let allToolRequests: VCPToolRequest[] = []

      // 1. 解析 VCP 文本标记中的工具请求
      const hasVCPInText = vcpProtocolParser.hasToolRequests(accumulatedText)
      logger.debug('[VCP-EXEC] hasToolRequests result', { hasVCPInText })

      if (hasVCPInText) {
        const vcpRequests = vcpProtocolParser.parseToolRequests(accumulatedText)
        allToolRequests.push(...vcpRequests)
        logger.info('[VCP-EXEC] Parsed VCP marker requests', {
          count: vcpRequests.length,
          tools: vcpRequests.map((r) => r.toolName)
        })
      }

      // 2. 添加从 tool_use 格式转换来的请求
      if (pendingToolUseRequests.length > 0) {
        allToolRequests.push(...pendingToolUseRequests)
        logger.debug('[VCP-EXEC] Added tool_use requests', { count: pendingToolUseRequests.length })
      }

      // 如果没有任何工具请求，直接返回
      if (allToolRequests.length === 0) {
        logger.info('[VCP-EXEC] No tool requests found, skipping execution')
        return
      }

      logger.info(`Found ${allToolRequests.length} total tool requests at depth ${depth}`, {
        vcpMarkerCount: allToolRequests.length - pendingToolUseRequests.length,
        toolUseCount: pendingToolUseRequests.length
      })

      // Separate archery and normal calls
      const archeryCalls = allToolRequests.filter((r) => r.archery)
      const normalCalls = allToolRequests.filter((r) => !r.archery)

      // Execute archery calls without waiting
      for (const request of archeryCalls) {
        executeToolFn(request.toolName, request.params).catch((err) => {
          logger.warn(`Archery tool ${request.toolName} failed:`, err as Error)
        })
      }

      if (normalCalls.length === 0) {
        return
      }

      // Get abort signal from context
      const abortSignal = ctx._internal.flowControl?.abortSignal

      // Execute tools with user confirmation
      const executionResults = await executeVCPTools(
        normalCalls,
        executeToolFn,
        params.assistant,
        params.mcpTools || [],
        params.onChunk,
        abortSignal,
        params.topicId,
        params.assistant?.model?.name
      )

      // Store results in context
      storeVCPToolResults(ctx, executionResults)

      // Format results for AI continuation
      const toolResultsText = formatToolResultsForAI(executionResults)

      // Log the tool results for debugging
      logger.info('VCP tool execution completed', {
        toolCount: executionResults.length,
        results: executionResults.map(r => ({
          tool: r.request.toolName,
          status: r.response.status,
          preview: String(r.response.result || r.response.error).substring(0, 100)
        }))
      })

      // Build new params with tool results
      const newParams = buildParamsWithVCPToolResults(ctx, params, accumulatedText, toolResultsText)

      // Notify UI about new LLM response
      if (params.onChunk) {
        params.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED })
      }

      // Recursive call with tool results
      const recursiveResult = await executeWithVCPToolHandling(newParams, depth + 1)

      // If the recursive call returns a stream, we need to consume it and forward chunks
      // Note: After fixing FinalChunkConsumerMiddleware, the recursive result now has the actual stream
      if (recursiveResult.stream) {
        const reader = (recursiveResult.stream as ReadableStream<GenericChunk>).getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              // Filter out BLOCK_COMPLETE and LLM_RESPONSE_COMPLETE from recursive calls
              // These will be sent by the top-level FinalChunkConsumerMiddleware
              const chunkType = (value as GenericChunk).type
              if (chunkType === ChunkType.BLOCK_COMPLETE || chunkType === ChunkType.LLM_RESPONSE_COMPLETE) {
                logger.debug(`Skipping ${chunkType} chunk from recursive call`)
                continue
              }
              controller.enqueue(value)
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
    } catch (error) {
      logger.error('Error in VCP tool flush:', error as Error)
      controller.error(error)
    }
  }
}

/**
 * Execute VCP tools and collect results with user confirmation support
 */
async function executeVCPTools(
  toolRequests: ReturnType<typeof vcpProtocolParser.parseToolRequests>,
  executeToolFn: VCPToolExecutor,
  assistant: Assistant,
  mcpTools: MCPTool[],
  onChunk?: (chunk: Chunk) => void,
  abortSignal?: AbortSignal,
  topicId?: string,
  modelName?: string
): Promise<VCPToolExecutionResult[]> {
  const vcpToolConfig = assistant.vcpConfig || {}
  const autoApproveAll = (vcpToolConfig as any).autoApproveAll ?? false
  const disabledAutoApproveTools = (vcpToolConfig as any).disabledAutoApproveTools || []

  /**
   * Check if a tool should be auto-approved
   */
  const isToolAutoApproved = (toolName: string): boolean => {
    if (autoApproveAll && !disabledAutoApproveTools.includes(toolName)) {
      return true
    }
    return false
  }

  const executionResults: VCPToolExecutionResult[] = []
  const pendingPromises: Promise<void>[] = []

  for (const request of toolRequests) {
    const startTime = Date.now()
    const toolId = `vcp_${request.toolName}_${startTime}`
    const isAutoApproved = isToolAutoApproved(request.toolName)

    // 首先查找实际的 MCP 工具以获取正确的服务器信息
    const actualTool = findToolByName(mcpTools, request.toolName)
    const toolInfo: MCPTool = actualTool || {
      id: request.toolName,
      name: request.toolName,
      serverId: 'vcp',
      serverName: 'VCP Plugin',
      description: `VCP Tool: ${request.toolName}`,
      inputSchema: { type: 'object' },
      type: 'mcp'
    }

    logger.debug(`VCP tool request: ${request.toolName}`, {
      found: !!actualTool,
      serverId: toolInfo.serverId,
      serverName: toolInfo.serverName
    })

    // Notify pending status with actual tool info
    if (onChunk) {
      onChunk({
        type: ChunkType.MCP_TOOL_CREATED,
        tool_use_responses: [
          {
            id: toolId,
            tool: toolInfo,
            arguments: request.params,
            status: 'pending'
          }
        ]
      } as Chunk)
    }

    // Get user confirmation
    let confirmationPromise: Promise<boolean>
    if (isAutoApproved) {
      confirmationPromise = Promise.resolve(true)
    } else {
      setToolIdToNameMapping(toolId, request.toolName)
      confirmationPromise = requestToolConfirmation(toolId, abortSignal).then((confirmed) => {
        if (confirmed) {
          // Auto-confirm other tools with the same name
          confirmSameNameTools(request.toolName)
        }
        return confirmed
      })
    }

    const processingPromise = confirmationPromise
      .then(async (confirmed) => {
        if (confirmed) {
          // Update to invoking status
          emitToolStatusChunk(onChunk, createVCPToolResponse(toolId, toolInfo, request.params, 'invoking'))

          // Create span for tool execution (if topicId is available)
          let toolSpan: ReturnType<typeof addSpan> | undefined
          if (topicId) {
            try {
              toolSpan = addSpan({
                topicId,
                modelName,
                name: `VCP:${request.toolName}`,
                inputs: request.params,
                tag: 'vcp-tool'
              })
            } catch (spanError) {
              logger.debug('Failed to create span for VCP tool', { error: spanError })
            }
          }

          try {
            const response = await executeToolFn(request.toolName, request.params)

            // End span - use top-level error field for tool error status
            if (toolSpan && topicId) {
              try {
                if (response.status === 'success') {
                  // Success: record result in outputs
                  endSpan({
                    topicId,
                    modelName,
                    span: toolSpan,
                    outputs: {
                      status: 'success',
                      result: safeStringify(response.result)
                    }
                  })
                } else {
                  // Error status from tool: use top-level error field to mark span as error
                  endSpan({
                    topicId,
                    modelName,
                    span: toolSpan,
                    error: new Error(response.error || 'Tool execution returned error status'),
                    outputs: {
                      status: 'error',
                      errorMessage: response.error
                    }
                  })
                }
              } catch (spanError) {
                logger.debug('Failed to end span for VCP tool', { error: spanError })
              }
            }

            // Notify done status - use MCP-compatible response format
            // For success: pass result directly (can be string, object, or array)
            // For error: pass content array with error text
            const toolResponseContent =
              response.status === 'success'
                ? response.result
                : { isError: true, content: [{ type: 'text', text: safeStringify(response.error) }] }

            emitToolStatusChunk(
              onChunk,
              createVCPToolResponse(toolId, toolInfo, request.params, 'done', toolResponseContent)
            )

            executionResults.push({
              request,
              response,
              executionTimeMs: Date.now() - startTime
            })
          } catch (error) {
            // End span with error
            if (toolSpan && topicId) {
              try {
                endSpan({
                  topicId,
                  modelName,
                  span: toolSpan,
                  error: error instanceof Error ? error : new Error(String(error))
                })
              } catch (spanError) {
                logger.debug('Failed to end span for VCP tool error', { error: spanError })
              }
            }

            const errorResponse: VCPToolResponse = {
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString()
            }

            // Notify error status - use 'error' status for proper UI handling
            emitToolStatusChunk(
              onChunk,
              createVCPToolResponse(
                toolId,
                toolInfo,
                request.params,
                'error',
                errorResponse.error || 'Unknown error'
              )
            )

            executionResults.push({
              request,
              response: errorResponse,
              executionTimeMs: Date.now() - startTime
            })
          }
        } else {
          // User cancelled - use cancelled status with plain text response
          emitToolStatusChunk(
            onChunk,
            createVCPToolResponse(toolId, toolInfo, request.params, 'cancelled', 'Tool call cancelled by user.')
          )

          // Add cancelled result
          executionResults.push({
            request,
            response: {
              status: 'error',
              error: 'Tool call cancelled by user',
              timestamp: new Date().toISOString()
            },
            executionTimeMs: Date.now() - startTime
          })
        }
      })
      .catch((error) => {
        logger.error(`Error in tool confirmation for ${request.toolName}:`, error as Error)

        // Notify error status - use error status with plain text response
        emitToolStatusChunk(
          onChunk,
          createVCPToolResponse(
            toolId,
            toolInfo,
            request.params,
            'error',
            `Confirmation error: ${error instanceof Error ? error.message : 'Unknown'}`
          )
        )

        executionResults.push({
          request,
          response: {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          },
          executionTimeMs: Date.now() - startTime
        })
      })

    pendingPromises.push(processingPromise)
  }

  // Wait for all tool processing to complete
  await Promise.all(pendingPromises)

  return executionResults
}

/**
 * Format tool results for AI continuation
 */
function formatToolResultsForAI(executionResults: VCPToolExecutionResult[]): string {
  return executionResults
    .map((r) =>
      vcpProtocolParser.formatToolResult(
        r.request.toolName,
        r.response.status === 'success' ? r.response.result : r.response.error,
        r.response.status === 'success'
      )
    )
    .join('\n\n')
}

/**
 * Store VCP tool results in context for tracking
 */
function storeVCPToolResults(ctx: CompletionsContext, executionResults: VCPToolExecutionResult[]): void {
  if (!ctx._internal.customState) {
    ctx._internal.customState = {}
  }

  const vcpResults: VCPToolResult[] = executionResults.map((r) => ({
    toolName: r.request.toolName,
    status: r.response.status,
    result: r.response.result,
    error: r.response.error,
    executionTimeMs: r.executionTimeMs
  }))

  ctx._internal.customState.vcpToolResults = [...(ctx._internal.customState.vcpToolResults || []), ...vcpResults]

  logger.debug('Stored VCP tool results', { count: vcpResults.length })
}

/**
 * Build new params with VCP tool results for AI continuation
 */
function buildParamsWithVCPToolResults(
  ctx: CompletionsContext,
  params: CompletionsParams,
  assistantResponse: string,
  toolResultsText: string
): CompletionsParams {
  // Remove tool request blocks from the response for cleaner context
  const cleanedResponse = vcpProtocolParser.removeToolRequestBlocks(assistantResponse)

  // Create new messages array with proper Message format
  const existingMessages = Array.isArray(params.messages) ? params.messages : []

  // Build messages with proper role structure for AI continuation
  const newMessages = [
    ...existingMessages,
    // Add the assistant's response (with tool requests cleaned)
    {
      role: 'assistant' as const,
      content: cleanedResponse
    },
    // Add tool results as user message for continuation
    {
      role: 'user' as const,
      content: `${toolResultsText}\n\n请根据上述工具执行结果继续回复用户。`
    }
  ]

  // Update recursion state
  if (!ctx._internal.toolProcessingState) {
    ctx._internal.toolProcessingState = {}
  }
  ctx._internal.toolProcessingState.isRecursiveCall = true
  ctx._internal.toolProcessingState.recursionDepth = (ctx._internal.toolProcessingState?.recursionDepth || 0) + 1

  logger.debug('Building VCP tool result params', {
    depth: ctx._internal.toolProcessingState.recursionDepth,
    messageCount: newMessages.length,
    toolResultsPreview: toolResultsText.substring(0, 200)
  })

  return {
    ...params,
    messages: newMessages as any,
    _internal: {
      ...ctx._internal,
      toolProcessingState: ctx._internal.toolProcessingState
    }
  }
}

/**
 * 创建统一的 VCP 工具执行器
 * 支持 VCP 和 MCP 双协议，统一执行路径
 *
 * @param options 配置选项
 * @param options.source 工具来源 ('vcp' | 'mcp')
 * @param options.mcpTools 可用的 MCP 工具列表（可选，用于错误提示）
 */
function createUnifiedToolExecutor(options: {
  source: 'vcp' | 'mcp'
  mcpTools?: MCPTool[]
}): VCPToolExecutor {
  const { source, mcpTools } = options

  return async (toolName: string, params: Record<string, string>): Promise<VCPToolResponse> => {
    const toolLogger = loggerService.withContext('VCPToolExecutor')

    try {
      toolLogger.debug(`Executing VCP tool: ${toolName}`, { params, source })

      // 使用 VCP 统一 API（支持 VCP + MCP 双协议）
      if (window.api?.vcpUnified?.executeTool) {
        toolLogger.debug(`Using VCP unified API for tool: ${toolName}`)

        const vcpResult = await window.api.vcpUnified.executeTool({
          toolName,
          params: params as Record<string, unknown>,
          source
        })

        if (vcpResult.success) {
          toolLogger.debug(`VCP tool ${toolName} completed via unified API`, { source: vcpResult.source })
          return {
            status: 'success',
            result: vcpResult.output,
            timestamp: new Date().toISOString()
          }
        } else {
          toolLogger.warn(`VCP unified API failed for ${toolName}: ${vcpResult.error}`)
          // 继续尝试其他方式
        }
      }

      // 回退: 尝试调用 VCP 插件（通过 IPC）
      try {
        toolLogger.debug(`Trying VCP plugin: ${toolName}`)
        const vcpResult = await window.api.vcpTool.execute(toolName, params)

        if (vcpResult?.success) {
          return {
            status: 'success',
            result: vcpResult.output || vcpResult.data,
            timestamp: new Date().toISOString()
          }
        } else if (vcpResult?.error) {
          return {
            status: 'error',
            error: vcpResult.error,
            timestamp: new Date().toISOString()
          }
        }
      } catch (vcpError) {
        toolLogger.debug(`VCP plugin call failed, tool ${toolName} not found:`, vcpError as Error)
      }

      // 工具未找到
      const availableHint = mcpTools?.length ? ` Available tools: ${mcpTools.map((t) => t.name).join(', ')}` : ''
      toolLogger.warn(`Tool not found: ${toolName}`)
      return {
        status: 'error',
        error: `Tool "${toolName}" not found.${availableHint}`,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      toolLogger.error(`VCP tool ${toolName} failed:`, error as Error)

      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Default VCP tool executor (VCP 协议来源)
 */
export const defaultVCPToolExecutor: VCPToolExecutor = createUnifiedToolExecutor({ source: 'vcp' })

/**
 * 创建基于 MCP 工具列表的 VCP 工具执行器
 * @deprecated 使用 createUnifiedToolExecutor 代替
 */
function createMcpToolExecutor(mcpTools: MCPTool[]): VCPToolExecutor {
  return createUnifiedToolExecutor({ source: 'mcp', mcpTools })
}

/**
 * 在工具列表中查找工具（支持模糊匹配）
 * 用于 UI 显示工具信息
 */
function findToolByName(tools: MCPTool[], toolName: string): MCPTool | undefined {
  const normalizedName = toolName.toLowerCase().replace(/[-_]/g, '')

  // 精确匹配
  const exactMatch = tools.find((t) => t.name === toolName || t.id === toolName)
  if (exactMatch) return exactMatch

  // 模糊匹配（不区分大小写，忽略下划线/连字符差异）
  const fuzzyMatch = tools.find((t) => {
    const normalized = t.name.toLowerCase().replace(/[-_]/g, '')
    return normalized === normalizedName
  })
  if (fuzzyMatch) return fuzzyMatch

  return undefined
}

/**
 * Pre-configured VCP Tool Executor Middleware (自动启用，无需手动配置)
 */
export const VCPToolExecutorMiddleware = createVCPToolExecutorMiddleware()
