/**
 * VCPInfo + VCPLog IPC Handlers
 *
 * 提供实时状态推送和工具调用日志的 IPC 接口
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { type ExecutionSession, getVCPInfoService, type VCPInfoService } from './VCPInfoService'
import { getToolCallTracer, type LogEntry, type LogLevel, type ToolCallLog, type ToolCallTracer } from './ToolCallTracer'
import { safeHandle } from '../ipc'

const logger = loggerService.withContext('VCPInfoLogIpcHandler')

// Lazy loaded services
let _infoService: VCPInfoService | null = null
let _logService: ToolCallTracer | null = null

function getInfoService(): VCPInfoService {
  if (!_infoService) {
    _infoService = getVCPInfoService()
  }
  return _infoService
}

function getLogService(): ToolCallTracer {
  if (!_logService) {
    _logService = getToolCallTracer()
  }
  return _logService
}

/**
 * 序列化会话 (转换 Date 为 ISO 字符串)
 */
function serializeSession(session: ExecutionSession): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(session, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    })
  )
}

/**
 * 序列化调用记录
 */
function serializeCall(call: ToolCallLog): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(call, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    })
  )
}

/**
 * 序列化日志条目
 */
function serializeLogEntry(entry: LogEntry): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(entry, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    })
  )
}

/**
 * 注册 VCPInfo IPC handlers
 */
export function registerVCPInfoIpcHandlers(): void {
  logger.info('Registering VCPInfo IPC handlers...')

  // 获取活跃会话
  ipcMain.handle(IpcChannel.VCPInfo_GetActiveSessions, async () => {
    return safeHandle('vcpinfo:getActiveSessions', () => {
      const service = getInfoService()
      const sessions = service.getActiveSessions()
      return sessions.map(serializeSession)
    })
  })

  // 获取最近会话
  ipcMain.handle(IpcChannel.VCPInfo_GetRecentSessions, async (_event, limit?: number) => {
    return safeHandle('vcpinfo:getRecentSessions', () => {
      const service = getInfoService()
      const sessions = service.getRecentSessions(limit || 20)
      return sessions.map(serializeSession)
    })
  })

  // 获取特定会话
  ipcMain.handle(IpcChannel.VCPInfo_GetSession, async (_event, sessionId: string) => {
    return safeHandle('vcpinfo:getSession', () => {
      const service = getInfoService()
      const session = service.getSession(sessionId)
      return session ? serializeSession(session) : null
    })
  })

  // 清空会话
  ipcMain.handle(IpcChannel.VCPInfo_ClearSessions, async () => {
    return safeHandle('vcpinfo:clearSessions', () => {
      const service = getInfoService()
      service.clear()
      return { success: true }
    })
  })

  // 发布事件到所有订阅者
  ipcMain.handle(
    IpcChannel.VCPInfo_PublishEvent,
    async (_, event: { type: string; data?: unknown; timestamp?: number; sessionId?: string }) => {
      return safeHandle('vcpinfo:publishEvent', () => {
        const service = getInfoService()
        service.broadcastEvent({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp || Date.now(),
          sessionId: event.sessionId
        })
        return { success: true }
      })
    }
  )

  logger.info('VCPInfo IPC handlers registered')
}

/**
 * 注册 VCPLog IPC handlers
 */
export function registerVCPLogIpcHandlers(): void {
  logger.info('Registering VCPLog IPC handlers...')

  // 获取最近调用
  ipcMain.handle(IpcChannel.VCPLog_GetRecentCalls, async (_event, limit?: number) => {
    return safeHandle('vcplog:getRecentCalls', () => {
      const service = getLogService()
      const calls = service.getRecentCalls(limit || 50)
      return calls.map(serializeCall)
    })
  })

  // 获取最近日志
  ipcMain.handle(IpcChannel.VCPLog_GetRecentLogs, async (_event, params?: { limit?: number; level?: LogLevel }) => {
    return safeHandle('vcplog:getRecentLogs', () => {
      const service = getLogService()
      const logs = service.getRecentLogs(params?.limit || 100, params?.level)
      return logs.map(serializeLogEntry)
    })
  })

  // 获取调用链的所有调用
  ipcMain.handle(IpcChannel.VCPLog_GetTraceCalls, async (_event, traceId: string) => {
    return safeHandle('vcplog:getTraceCalls', () => {
      const service = getLogService()
      const calls = service.getTraceCalls(traceId)
      return calls.map(serializeCall)
    })
  })

  // 获取特定调用
  ipcMain.handle(IpcChannel.VCPLog_GetCall, async (_event, callId: string) => {
    return safeHandle('vcplog:getCall', () => {
      const service = getLogService()
      const call = service.getCall(callId)
      return call ? serializeCall(call) : null
    })
  })

  // 清空日志
  ipcMain.handle(IpcChannel.VCPLog_Clear, async () => {
    return safeHandle('vcplog:clear', () => {
      const service = getLogService()
      service.clear()
      return { success: true }
    })
  })

  // 写入日志条目
  ipcMain.handle(
    IpcChannel.VCPLog_Write,
    async (
      _,
      entry: {
        level: LogLevel
        source: string
        message: string
        data?: unknown
        timestamp?: number
        type?: string
      }
    ) => {
      return safeHandle('vcplog:write', () => {
        const service = getLogService()
        service.log(
          entry.level,
          entry.source,
          entry.message,
          entry.data as Record<string, unknown> | undefined,
          undefined,
          undefined
        )

        // 同时广播日志事件
        service.broadcastLog({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          level: entry.level,
          category: entry.source,
          message: entry.message,
          data: entry.data as Record<string, unknown> | undefined,
          timestamp: new Date(entry.timestamp || Date.now())
        })

        return { success: true }
      })
    }
  )

  logger.info('VCPLog IPC handlers registered')
}

/**
 * 注册所有 VCPInfo 和 VCPLog IPC handlers
 */
export function registerVCPInfoLogIpcHandlers(): void {
  registerVCPInfoIpcHandlers()
  registerVCPLogIpcHandlers()
}
