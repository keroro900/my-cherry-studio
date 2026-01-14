/**
 * 群聊导出工具
 *
 * 提供群聊会话导出为 Markdown 和 JSON 格式的功能
 */

import { loggerService } from '@logger'
import type { GroupAgent, GroupMessage } from '@renderer/services/GroupChatService'
import { removeSpecialCharactersForFileName } from '@renderer/utils/file'
import dayjs from 'dayjs'

const logger = loggerService.withContext('GroupChatExport')

/**
 * 群聊导出数据
 */
export interface GroupChatExportData {
  /** 会话 ID */
  sessionId: string
  /** 话题名称 */
  topic: string
  /** 参与者列表 */
  agents: GroupAgent[]
  /** 消息列表 */
  messages: GroupMessage[]
  /** 导出时间 */
  exportedAt: string
  /** 消息统计 */
  stats: {
    totalMessages: number
    agentMessageCounts: Record<string, number>
    duration?: string
  }
}

/**
 * 将群聊消息转换为 Markdown 格式
 */
export function groupChatToMarkdown(data: GroupChatExportData): string {
  const lines: string[] = []

  // 标题
  lines.push(`# ${data.topic || '群聊记录'}`)
  lines.push('')

  // 元信息
  lines.push('## 会话信息')
  lines.push('')
  lines.push(`- **导出时间**: ${dayjs(data.exportedAt).format('YYYY-MM-DD HH:mm:ss')}`)
  lines.push(`- **消息总数**: ${data.stats.totalMessages}`)
  if (data.stats.duration) {
    lines.push(`- **对话时长**: ${data.stats.duration}`)
  }
  lines.push('')

  // 参与者列表
  lines.push('## 参与者')
  lines.push('')
  for (const agent of data.agents) {
    const expertise = agent.expertise?.slice(0, 3).join(', ') || ''
    const messageCount = data.stats.agentMessageCounts[agent.id] || 0
    lines.push(
      `- **${agent.displayName}** (${agent.role})${expertise ? ` - ${expertise}` : ''} - ${messageCount} 条消息`
    )
  }
  lines.push('')

  // 对话内容
  lines.push('## 对话内容')
  lines.push('')

  for (const message of data.messages) {
    const timestamp =
      typeof message.timestamp === 'string'
        ? dayjs(message.timestamp).format('HH:mm:ss')
        : dayjs(message.timestamp).format('HH:mm:ss')

    const isUser = message.agentId === 'user'
    const role = isUser ? '用户' : data.agents.find((a) => a.id === message.agentId)?.role || ''
    const roleTag = role ? ` [${role}]` : ''

    lines.push(`### ${message.agentName}${roleTag} - ${timestamp}`)
    lines.push('')
    lines.push(message.content)
    lines.push('')

    // 如果有图片，添加图片标记
    const images = message.metadata?.images as string[] | undefined
    if (images && images.length > 0) {
      lines.push(`*[包含 ${images.length} 张图片]*`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 将群聊消息转换为 JSON 格式
 */
export function groupChatToJson(data: GroupChatExportData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * 计算对话统计信息
 */
export function calculateStats(messages: GroupMessage[], agents: GroupAgent[]): GroupChatExportData['stats'] {
  const agentMessageCounts: Record<string, number> = {}

  // 初始化计数
  for (const agent of agents) {
    agentMessageCounts[agent.id] = 0
  }
  agentMessageCounts['user'] = 0

  // 统计消息数量
  for (const message of messages) {
    if (agentMessageCounts[message.agentId] !== undefined) {
      agentMessageCounts[message.agentId]++
    } else {
      agentMessageCounts[message.agentId] = 1
    }
  }

  // 计算对话时长
  let duration: string | undefined
  if (messages.length >= 2) {
    const firstTimestamp = messages[0].timestamp
    const lastTimestamp = messages[messages.length - 1].timestamp
    const firstTime = firstTimestamp instanceof Date ? firstTimestamp : new Date(firstTimestamp)
    const lastTime = lastTimestamp instanceof Date ? lastTimestamp : new Date(lastTimestamp)

    const durationMs = lastTime.getTime() - firstTime.getTime()
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)

    if (minutes > 0) {
      duration = `${minutes} 分 ${seconds} 秒`
    } else {
      duration = `${seconds} 秒`
    }
  }

  return {
    totalMessages: messages.length,
    agentMessageCounts,
    duration
  }
}

/**
 * 导出群聊为 Markdown 文件
 */
export async function exportGroupChatAsMarkdown(
  sessionId: string,
  topic: string,
  agents: GroupAgent[],
  messages: GroupMessage[]
): Promise<void> {
  try {
    const exportData: GroupChatExportData = {
      sessionId,
      topic: topic || '群聊记录',
      agents,
      messages,
      exportedAt: new Date().toISOString(),
      stats: calculateStats(messages, agents)
    }

    const markdown = groupChatToMarkdown(exportData)
    const fileName = removeSpecialCharactersForFileName(topic || '群聊记录') + '.md'

    const result = await window.api.file.save(fileName, markdown)
    if (result) {
      window.toast.success('群聊记录已导出为 Markdown')
    }
  } catch (error) {
    logger.error('Failed to export group chat as markdown', error as Error)
    window.toast.error('导出失败')
  }
}

/**
 * 导出群聊为 JSON 文件
 */
export async function exportGroupChatAsJson(
  sessionId: string,
  topic: string,
  agents: GroupAgent[],
  messages: GroupMessage[]
): Promise<void> {
  try {
    const exportData: GroupChatExportData = {
      sessionId,
      topic: topic || '群聊记录',
      agents,
      messages,
      exportedAt: new Date().toISOString(),
      stats: calculateStats(messages, agents)
    }

    const json = groupChatToJson(exportData)
    const fileName = removeSpecialCharactersForFileName(topic || '群聊记录') + '.json'

    const result = await window.api.file.save(fileName, json)
    if (result) {
      window.toast.success('群聊记录已导出为 JSON')
    }
  } catch (error) {
    logger.error('Failed to export group chat as json', error as Error)
    window.toast.error('导出失败')
  }
}
