/**
 * GroupChatMessageAdapter - 群聊消息适配器
 *
 * 负责 GroupMessage ↔ Message 双向转换
 * 使群聊消息能够使用原生 Message + Block 系统存储和渲染
 */

import { v4 as uuid } from 'uuid'

import type { GroupAgent, GroupMessage } from './GroupChatService'
import type {
  MainTextMessageBlock,
  Message,
  MessageBlock
} from '@renderer/types/newMessage'
import {
  AssistantMessageStatus,
  MessageBlockStatus,
  MessageBlockType,
  UserMessageStatus
} from '@renderer/types/newMessage'

/**
 * 创建消息 ID
 */
export function createMessageId(): string {
  return uuid()
}

/**
 * 创建 Block ID
 */
export function createBlockId(): string {
  return uuid()
}

/**
 * GroupMessage -> Message 转换
 *
 * 将群聊消息转换为原生 Message 格式，以便使用原生组件渲染
 *
 * @param groupMsg - 群聊消息
 * @param agent - 发送消息的 Agent（用户消息时为 null）
 * @param sessionId - 群聊会话 ID
 * @param assistantId - 助手 ID（用于普通消息系统兼容）
 * @returns [Message, MessageBlock[]] - 转换后的消息和对应的 Block
 */
export function groupMessageToNative(
  groupMsg: GroupMessage,
  agent: GroupAgent | null,
  sessionId: string,
  assistantId: string = 'group-chat'
): { message: Message; blocks: MessageBlock[] } {
  const messageId = groupMsg.id || createMessageId()
  const blockId = createBlockId()
  const isUser = groupMsg.agentId === 'user'

  // 创建 MainTextBlock
  const mainTextBlock: MainTextMessageBlock = {
    id: blockId,
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content: groupMsg.content,
    status: MessageBlockStatus.SUCCESS,
    createdAt: normalizeTimestamp(groupMsg.timestamp)
  }

  // 创建 Message
  const message: Message = {
    id: messageId,
    role: isUser ? 'user' : 'assistant',
    assistantId,
    topicId: sessionId, // 群聊会话 ID 作为 topicId
    createdAt: normalizeTimestamp(groupMsg.timestamp),
    status: isUser ? UserMessageStatus.SUCCESS : AssistantMessageStatus.SUCCESS,
    blocks: [blockId],

    // 群聊专属字段
    groupChatSessionId: sessionId,
    groupChatAgentId: groupMsg.agentId,
    groupChatAgentName: isUser ? '我' : (agent?.displayName || groupMsg.agentName),
    groupChatAgentRole: isUser ? undefined : agent?.role,
    groupChatAgentAvatar: isUser ? undefined : agent?.avatar
  }

  return { message, blocks: [mainTextBlock] }
}

/**
 * Message -> GroupMessage 转换
 *
 * 将原生 Message 转换回群聊消息格式（用于与 GroupChatService 交互）
 *
 * @param msg - 原生消息
 * @param blocks - 消息的 Block 列表
 * @returns GroupMessage
 */
export function nativeToGroupMessage(
  msg: Message,
  blocks: MessageBlock[]
): GroupMessage {
  // 从 blocks 中提取文本内容
  const content = blocks
    .filter((b): b is MainTextMessageBlock => b.type === MessageBlockType.MAIN_TEXT)
    .map((b) => b.content)
    .join('\n')

  return {
    id: msg.id,
    agentId: msg.groupChatAgentId || (msg.role === 'user' ? 'user' : 'unknown'),
    agentName: msg.groupChatAgentName || (msg.role === 'user' ? '我' : 'Assistant'),
    content,
    timestamp: new Date(msg.createdAt),
    type: 'chat',
    mentions: [], // TODO: 从内容中解析 @mentions
    isPublic: true
  }
}

/**
 * 创建流式消息的初始状态
 *
 * 在 Agent 开始响应时创建一个 processing 状态的消息和 placeholder block
 *
 * @param agent - 响应的 Agent
 * @param sessionId - 群聊会话 ID
 * @param assistantId - 助手 ID
 * @returns [Message, MessageBlock[]]
 */
export function createStreamingMessage(
  agent: GroupAgent,
  sessionId: string,
  assistantId: string = 'group-chat'
): { message: Message; blocks: MessageBlock[]; messageId: string; blockId: string } {
  const messageId = createMessageId()
  const blockId = createBlockId()
  const now = new Date().toISOString()

  // 创建初始的 MainTextBlock（空内容，streaming 状态）
  const mainTextBlock: MainTextMessageBlock = {
    id: blockId,
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content: '',
    status: MessageBlockStatus.STREAMING,
    createdAt: now
  }

  // 创建 Message（processing 状态）
  const message: Message = {
    id: messageId,
    role: 'assistant',
    assistantId,
    topicId: sessionId,
    createdAt: now,
    status: AssistantMessageStatus.PROCESSING,
    blocks: [blockId],

    // 群聊专属字段
    groupChatSessionId: sessionId,
    groupChatAgentId: agent.id,
    groupChatAgentName: agent.displayName || agent.name,
    groupChatAgentRole: agent.role,
    groupChatAgentAvatar: agent.avatar
  }

  return { message, blocks: [mainTextBlock], messageId, blockId }
}

/**
 * 创建用户消息
 *
 * @param content - 消息内容
 * @param sessionId - 群聊会话 ID
 * @param assistantId - 助手 ID
 * @returns [Message, MessageBlock[]]
 */
export function createUserMessage(
  content: string,
  sessionId: string,
  assistantId: string = 'group-chat'
): { message: Message; blocks: MessageBlock[] } {
  const messageId = createMessageId()
  const blockId = createBlockId()
  const now = new Date().toISOString()

  const mainTextBlock: MainTextMessageBlock = {
    id: blockId,
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    status: MessageBlockStatus.SUCCESS,
    createdAt: now
  }

  const message: Message = {
    id: messageId,
    role: 'user',
    assistantId,
    topicId: sessionId,
    createdAt: now,
    status: UserMessageStatus.SUCCESS,
    blocks: [blockId],

    groupChatSessionId: sessionId,
    groupChatAgentId: 'user',
    groupChatAgentName: '我'
  }

  return { message, blocks: [mainTextBlock] }
}

/**
 * 标准化时间戳
 */
function normalizeTimestamp(timestamp: Date | string): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString()
  }
  return timestamp
}

/**
 * 解析消息内容中的 @mentions
 *
 * @param content - 消息内容
 * @param agents - 可用的 Agent 列表
 * @returns 被提及的 Agent ID 列表
 */
export function parseMentions(content: string, agents: GroupAgent[]): string[] {
  const mentionedIds: string[] = []
  const mentionRegex = /@(\S+)/g
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    const mentionName = match[1]
    const agent = agents.find(
      (a) =>
        a.displayName.toLowerCase() === mentionName.toLowerCase() ||
        a.name.toLowerCase() === mentionName.toLowerCase()
    )
    if (agent && !mentionedIds.includes(agent.id)) {
      mentionedIds.push(agent.id)
    }
  }

  return mentionedIds
}

/**
 * 检查消息是否为群聊消息
 */
export function isGroupChatMessage(message: Message): boolean {
  return !!message.groupChatSessionId
}

/**
 * 从消息列表中过滤群聊消息
 */
export function filterGroupChatMessages(
  messages: Message[],
  sessionId: string
): Message[] {
  return messages.filter((m) => m.groupChatSessionId === sessionId)
}
