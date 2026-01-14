/**
 * 群聊消息转换工具
 *
 * 将 GroupMessage 转换为 Message 类型，以便复用普通聊天的消息组件
 */

import type { GroupAgent, GroupMessage } from '@renderer/services/GroupChatService'
import type { Message, MessageBlock } from '@renderer/types/newMessage'
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType, UserMessageStatus } from '@renderer/types/newMessage'
import { v4 as uuid } from 'uuid'

/**
 * 安全转换时间戳为 ISO 字符串
 */
function toISOString(timestamp: string | Date): string {
  if (typeof timestamp === 'string') {
    return timestamp
  }
  return timestamp.toISOString()
}

/**
 * 将 GroupMessage 转换为 Message 类型
 */
export function groupMessageToMessage(
  groupMsg: GroupMessage,
  agent: GroupAgent | undefined,
  sessionId: string,
  isStreaming: boolean = false
): Message {
  // 生成消息块 ID
  const blockId = `block_${groupMsg.id}`
  const isUser = groupMsg.agentId === 'user'

  return {
    id: groupMsg.id,
    role: isUser ? 'user' : 'assistant',
    assistantId: agent?.id || '',
    topicId: sessionId, // 使用 sessionId 作为 topicId
    createdAt: toISOString(groupMsg.timestamp),
    status: isUser
      ? UserMessageStatus.SUCCESS
      : (isStreaming ? AssistantMessageStatus.PENDING : AssistantMessageStatus.SUCCESS),

    // 块集合 - 只包含一个主文本块
    blocks: [blockId],

    // 群聊相关字段
    groupChatAgentId: groupMsg.agentId,
    groupChatAgentName: groupMsg.agentName || agent?.name,
    groupChatAgentRole: agent?.role,
    groupChatAgentAvatar: agent?.avatar,
    groupChatSessionId: sessionId
  }
}

/**
 * 为 GroupMessage 创建消息块
 */
export function createGroupMessageBlock(
  groupMsg: GroupMessage,
  isStreaming: boolean = false
): MessageBlock {
  return {
    id: `block_${groupMsg.id}`,
    messageId: groupMsg.id,
    type: MessageBlockType.MAIN_TEXT,
    content: groupMsg.content,
    status: isStreaming ? MessageBlockStatus.STREAMING : MessageBlockStatus.SUCCESS,
    createdAt: toISOString(groupMsg.timestamp)
  } as MessageBlock
}

/**
 * 批量转换 GroupMessage 数组
 */
export function convertGroupMessages(
  messages: GroupMessage[],
  agents: GroupAgent[],
  sessionId: string
): { messages: Message[]; blocks: MessageBlock[] } {
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  const convertedMessages: Message[] = []
  const blocks: MessageBlock[] = []

  for (const msg of messages) {
    const agent = agentMap.get(msg.agentId)
    convertedMessages.push(groupMessageToMessage(msg, agent, sessionId, false))
    blocks.push(createGroupMessageBlock(msg, false))
  }

  return { messages: convertedMessages, blocks }
}

/**
 * 创建用户消息的 Message 对象
 */
export function createUserMessage(
  sessionId: string
): Message {
  const id = uuid()
  return {
    id,
    role: 'user',
    assistantId: '',
    topicId: sessionId,
    createdAt: new Date().toISOString(),
    status: UserMessageStatus.SUCCESS,
    blocks: [`block_${id}`],
    groupChatAgentId: 'user',
    groupChatAgentName: '你',
    groupChatSessionId: sessionId
  }
}

/**
 * 为用户消息创建消息块
 */
export function createUserMessageBlock(
  messageId: string,
  content: string
): MessageBlock {
  return {
    id: `block_${messageId}`,
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    status: MessageBlockStatus.SUCCESS,
    createdAt: new Date().toISOString()
  } as MessageBlock
}
