/**
 * Trace IPC Handlers
 * 追踪相关的 IPC 处理器
 *
 * 包含: Span 缓存、追踪窗口、Token 使用统计等
 */

import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import type { SpanEntity, TokenUsage } from '@mcp-trace/trace-core'
import { loggerService } from '@logger'
import {
  addEndMessage,
  addStreamMessage,
  bindTopic,
  cleanHistoryTrace,
  cleanLocalData,
  cleanTopic,
  getEntity,
  getSpans,
  saveEntity,
  saveSpans,
  tokenUsage
} from '../services/SpanCacheService'
import { openTraceWindow, setTraceWindowTitle } from '../services/NodeTraceService'

const logger = loggerService.withContext('TraceIpc')

export function registerTraceIpcHandlers() {
  // Span data management
  ipcMain.handle(IpcChannel.TRACE_SAVE_DATA, (_, topicId: string) => saveSpans(topicId))
  ipcMain.handle(IpcChannel.TRACE_GET_DATA, (_, topicId: string, traceId: string, modelName?: string) =>
    getSpans(topicId, traceId, modelName)
  )

  // Entity management
  ipcMain.handle(IpcChannel.TRACE_SAVE_ENTITY, (_, entity: SpanEntity) => saveEntity(entity))
  ipcMain.handle(IpcChannel.TRACE_GET_ENTITY, (_, spanId: string) => getEntity(spanId))

  // Topic binding and cleanup
  ipcMain.handle(IpcChannel.TRACE_BIND_TOPIC, (_, topicId: string, traceId: string) => bindTopic(traceId, topicId))
  ipcMain.handle(IpcChannel.TRACE_CLEAN_TOPIC, (_, topicId: string, traceId?: string) => cleanTopic(topicId, traceId))
  ipcMain.handle(IpcChannel.TRACE_CLEAN_HISTORY, (_, topicId: string, traceId: string, modelName?: string) =>
    cleanHistoryTrace(topicId, traceId, modelName)
  )
  ipcMain.handle(IpcChannel.TRACE_CLEAN_LOCAL_DATA, () => cleanLocalData())

  // Token usage
  ipcMain.handle(IpcChannel.TRACE_TOKEN_USAGE, (_, spanId: string, usage: TokenUsage) => tokenUsage(spanId, usage))

  // Trace window
  ipcMain.handle(
    IpcChannel.TRACE_OPEN_WINDOW,
    (_, topicId: string, traceId: string, autoOpen?: boolean, modelName?: string) =>
      openTraceWindow(topicId, traceId, autoOpen, modelName)
  )
  ipcMain.handle(IpcChannel.TRACE_SET_TITLE, (_, title: string) => setTraceWindowTitle(title))

  // Stream message handling
  ipcMain.handle(IpcChannel.TRACE_ADD_END_MESSAGE, (_, spanId: string, modelName: string, message: string) =>
    addEndMessage(spanId, modelName, message)
  )
  ipcMain.handle(
    IpcChannel.TRACE_ADD_STREAM_MESSAGE,
    (_, spanId: string, modelName: string, context: string, msg: any) =>
      addStreamMessage(spanId, modelName, context, msg)
  )

  logger.info('Trace IPC handlers registered successfully')
}
