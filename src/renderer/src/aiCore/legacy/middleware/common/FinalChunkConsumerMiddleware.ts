import { loggerService } from '@logger'
import type { Usage } from '@renderer/types'
import type { Chunk } from '@renderer/types/chunk'
import { ChunkType } from '@renderer/types/chunk'

import type { CompletionsParams, CompletionsResult, GenericChunk } from '../schemas'
import type { CompletionsContext, CompletionsMiddleware } from '../types'

export const MIDDLEWARE_NAME = 'FinalChunkConsumerAndNotifierMiddleware'

const logger = loggerService.withContext('FinalChunkConsumerMiddleware')

/**
 * 最终Chunk消费和通知中间件
 *
 * 职责：
 * 1. 消费所有GenericChunk流中的chunks并转发给onChunk回调
 * 2. 累加usage/metrics数据（从原始SDK chunks或GenericChunk中提取）
 * 3. 在检测到LLM_RESPONSE_COMPLETE时发送包含累计数据的BLOCK_COMPLETE
 * 4. 处理MCP工具调用的多轮请求中的数据累加
 */
const FinalChunkConsumerMiddleware: CompletionsMiddleware =
  () =>
  (next) =>
  async (ctx: CompletionsContext, params: CompletionsParams): Promise<CompletionsResult> => {
    const isRecursiveCall =
      params._internal?.toolProcessingState?.isRecursiveCall ||
      ctx._internal?.toolProcessingState?.isRecursiveCall ||
      false

    // 初始化累计数据（只在顶层调用时初始化）
    if (!isRecursiveCall) {
      if (!ctx._internal.customState) {
        ctx._internal.customState = {}
      }
      ctx._internal.observer = {
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        metrics: {
          completion_tokens: 0,
          time_completion_millsec: 0,
          time_first_token_millsec: 0,
          time_thinking_millsec: 0
        }
      }
      // 初始化文本累积器
      ctx._internal.customState.accumulatedText = ''
      ctx._internal.customState.startTimestamp = Date.now()
    }

    // 调用下游中间件
    const result = await next(ctx, params)

    // 🔧 关键修复：递归调用时不消费流，直接返回给调用者（VCPToolExecutorMiddleware.executeToolsIfNeeded）
    // 这样 depth 0 可以正确读取 depth 1 的流数据并入队到 TransformStream
    if (isRecursiveCall) {
      logger.debug('Recursive call detected, passing stream through without consuming')
      return result
    }

    // 响应后处理：处理GenericChunk流式响应（仅在顶层调用时）
    if (result.stream) {
      const resultFromUpstream = result.stream

      if (resultFromUpstream && resultFromUpstream instanceof ReadableStream) {
        const reader = resultFromUpstream.getReader()

        try {
          while (true) {
            const { done, value: chunk } = await reader.read()
            logger.silly('chunk', chunk)
            if (done) {
              logger.debug(`Input stream finished.`)
              break
            }

            if (chunk) {
              const genericChunk = chunk as GenericChunk
              // 提取并累加usage/metrics数据
              extractAndAccumulateUsageMetrics(ctx, genericChunk)

              params.onChunk?.(genericChunk)
            } else {
              logger.warn(`Received undefined chunk before stream was done.`)
            }
          }
        } catch (error: any) {
          logger.error(`Error consuming stream:`, error as Error)
          // FIXME: 临时解决方案。该中间件的异常无法被 ErrorHandlerMiddleware捕获。
          if (params.onError) {
            params.onError(error)
          }
          if (params.shouldThrow) {
            throw error
          }
        } finally {
          if (params.onChunk) {
            params.onChunk({
              type: ChunkType.BLOCK_COMPLETE,
              response: {
                usage: ctx._internal.observer?.usage ? { ...ctx._internal.observer.usage } : undefined,
                metrics: ctx._internal.observer?.metrics ? { ...ctx._internal.observer.metrics } : undefined
              }
            } as Chunk)
            if (ctx._internal.toolProcessingState) {
              ctx._internal.toolProcessingState = {}
            }
          }
        }

        // 为流式输出添加getText方法
        const modifiedResult = {
          ...result,
          stream: new ReadableStream<GenericChunk>({
            start(controller) {
              controller.close()
            }
          }),
          getText: (): string => {
            return (ctx._internal.customState?.accumulatedText as string) || ''
          }
        }

        return modifiedResult as typeof result
      } else {
        logger.debug(`No GenericChunk stream to process.`)
      }
    }

    return result
  }

/**
 * 从GenericChunk或原始SDK chunks中提取usage/metrics数据并累加
 */
function extractAndAccumulateUsageMetrics(ctx: CompletionsContext, chunk: GenericChunk): void {
  if (!ctx._internal.observer?.usage || !ctx._internal.observer?.metrics) {
    return
  }

  try {
    if (ctx._internal.customState && !ctx._internal.customState?.firstTokenTimestamp) {
      ctx._internal.customState.firstTokenTimestamp = Date.now()
      logger.debug(`First token timestamp: ${ctx._internal.customState.firstTokenTimestamp}`)
    }
    if (chunk.type === ChunkType.LLM_RESPONSE_COMPLETE) {
      // 从LLM_RESPONSE_COMPLETE chunk中提取usage数据
      if (chunk.response?.usage) {
        accumulateUsage(ctx._internal.observer.usage, chunk.response.usage)
      }

      if (ctx._internal.customState && ctx._internal.customState?.firstTokenTimestamp) {
        const firstTokenTimestamp = ctx._internal.customState.firstTokenTimestamp as number
        const startTimestamp = ctx._internal.customState.startTimestamp as number
        ctx._internal.observer.metrics.time_first_token_millsec = firstTokenTimestamp - startTimestamp
        ctx._internal.observer.metrics.time_completion_millsec += Date.now() - firstTokenTimestamp
      }
    }

    // 也可以从其他chunk类型中提取metrics数据
    if (chunk.type === ChunkType.THINKING_COMPLETE && chunk.thinking_millsec && ctx._internal.observer?.metrics) {
      ctx._internal.observer.metrics.time_thinking_millsec = Math.max(
        ctx._internal.observer.metrics.time_thinking_millsec || 0,
        chunk.thinking_millsec
      )
    }
  } catch (error) {
    logger.error('Error extracting usage/metrics from chunk:', error as Error)
  }
}

/**
 * 累加usage数据
 */
function accumulateUsage(accumulated: Usage, newUsage: Usage): void {
  if (newUsage.prompt_tokens !== undefined) {
    accumulated.prompt_tokens += newUsage.prompt_tokens
  }
  if (newUsage.completion_tokens !== undefined) {
    accumulated.completion_tokens += newUsage.completion_tokens
  }
  if (newUsage.total_tokens !== undefined) {
    accumulated.total_tokens += newUsage.total_tokens
  }
  if (newUsage.thoughts_tokens !== undefined) {
    accumulated.thoughts_tokens = (accumulated.thoughts_tokens || 0) + newUsage.thoughts_tokens
  }
  // Handle OpenRouter specific cost fields
  if (newUsage.cost !== undefined) {
    accumulated.cost = (accumulated.cost || 0) + newUsage.cost
  }
}

export default FinalChunkConsumerMiddleware
