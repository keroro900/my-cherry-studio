/**
 * TimeExpressionParser IPC Handler
 *
 * 提供渲染进程访问 TimeExpressionParser 的 IPC 接口
 */

import { ipcMain } from 'electron'

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import {
  getTimeExpressionParser,
  parseTimeExpressions,
  hasTimeExpression,
  TimeExpressionParser,
  type SupportedLocale,
  type TimeRange
} from '../utils/TimeExpressionParser'

const logger = loggerService.withContext('TimeParserIpcHandler')

// 当前解析器实例
let currentLocale: SupportedLocale = 'zh-CN'

/**
 * 注册 TimeExpressionParser IPC handlers
 */
export function registerTimeParserIpcHandlers(): void {
  logger.info('Registering TimeExpressionParser IPC handlers...')

  // 解析时间表达式
  ipcMain.handle(
    IpcChannel.TimeParser_Parse,
    async (
      _event,
      params: {
        text: string
        locale?: SupportedLocale
      }
    ): Promise<{ success: boolean; ranges: TimeRange[]; error?: string }> => {
      try {
        const locale = params.locale || currentLocale
        const ranges = parseTimeExpressions(params.text, locale)

        logger.debug('Parsed time expressions', {
          text: params.text.substring(0, 50),
          locale,
          rangeCount: ranges.length
        })

        return { success: true, ranges }
      } catch (error) {
        logger.error('Failed to parse time expressions', { error: String(error) })
        return { success: false, ranges: [], error: String(error) }
      }
    }
  )

  // 检查是否包含时间表达式
  ipcMain.handle(
    IpcChannel.TimeParser_HasExpression,
    async (
      _event,
      params: {
        text: string
        locale?: SupportedLocale
      }
    ): Promise<{ success: boolean; hasExpression: boolean; error?: string }> => {
      try {
        const locale = params.locale || currentLocale
        const result = hasTimeExpression(params.text, locale)

        return { success: true, hasExpression: result }
      } catch (error) {
        logger.error('Failed to check time expressions', { error: String(error) })
        return { success: false, hasExpression: false, error: String(error) }
      }
    }
  )

  // 获取支持的表达式列表
  ipcMain.handle(
    IpcChannel.TimeParser_GetSupportedExpressions,
    async (
      _event,
      params?: { locale?: SupportedLocale }
    ): Promise<{
      success: boolean
      expressions?: { hardcoded: string[]; patterns: string[] }
      error?: string
    }> => {
      try {
        const locale = params?.locale || currentLocale
        const parser = getTimeExpressionParser(locale)
        const expressions = parser.getSupportedExpressions()

        return { success: true, expressions }
      } catch (error) {
        logger.error('Failed to get supported expressions', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 设置默认语言区域
  ipcMain.handle(IpcChannel.TimeParser_SetLocale, async (_event, params: { locale: SupportedLocale }): Promise<{ success: boolean }> => {
    try {
      currentLocale = params.locale
      // 更新单例实例的语言区域
      getTimeExpressionParser(params.locale).setLocale(params.locale)

      logger.info('TimeParser locale set', { locale: params.locale })
      return { success: true }
    } catch (error) {
      logger.error('Failed to set locale', { error: String(error) })
      return { success: false, error: `Failed to set locale: ${String(error)}` }
    }
  })

  logger.info('TimeExpressionParser IPC handlers registered successfully')
}

export { TimeExpressionParser, getTimeExpressionParser, parseTimeExpressions, hasTimeExpression }
export type { SupportedLocale, TimeRange }
