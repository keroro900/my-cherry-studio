/**
 * AgentMessage 内置服务
 *
 * 提供 Agent 消息发送功能，用于角色间通信
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { BrowserWindow } from 'electron'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:AgentMessageService')

export class AgentMessageService implements IBuiltinService {
  name = 'AgentMessage'
  displayName = 'Agent 消息 (内置)'
  description = '发送 Agent 消息，用于角色间通信和通知。'
  version = '2.0.0'
  type = 'builtin_service' as const

  configSchema = {}

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'SendMessage',
      description: `发送 Agent 消息。
参数:
- message (字符串, 必需): 消息内容
- Maid (字符串, 可选): 发送者/角色名称

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」AgentMessage「末」
command:「始」SendMessage「末」
message:「始」这是一条测试消息「末」
Maid:「始」助手「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'message', description: '消息内容', required: true, type: 'string' },
        { name: 'Maid', description: '发送者/角色名称', required: false, type: 'string' }
      ]
    }
  ]

  async initialize(): Promise<void> {
    logger.info('AgentMessageService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'SendMessage':
          return this.sendMessage(params)
        default:
          return {
            success: false,
            error: `Unknown command: ${command}`
          }
      }
    } catch (error) {
      logger.error('AgentMessage command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private sendMessage(params: Record<string, unknown>): BuiltinServiceResult {
    const message = String(params.message || '')
    const maidName = params.Maid ? String(params.Maid) : undefined

    if (!message) {
      return {
        success: false,
        error: "发送消息需要 'message' 参数。"
      }
    }

    const now = new Date()
    const dateTimeString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    const formattedMessage = maidName ? `${dateTimeString} - ${maidName}\n${message}` : `${dateTimeString}\n${message}`

    // 发送到渲染进程
    const messageData = {
      type: 'agent_message',
      message: formattedMessage,
      recipient: maidName || null,
      originalContent: message,
      timestamp: now.toISOString()
    }

    // 广播到所有窗口
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('vcp:agentMessage', messageData)
      }
    })

    logger.debug('Agent message sent', { maidName, messageLength: message.length })

    return {
      success: true,
      output: formattedMessage,
      data: messageData
    }
  }

  async shutdown(): Promise<void> {
    logger.info('AgentMessageService shutdown')
  }
}
