/**
 * GroupChatPersistenceService - 群聊持久化服务
 *
 * 提供群聊会话和消息的 IndexedDB 持久化
 * 解决群聊消息在页面刷新/切换后丢失的问题
 */

import { loggerService } from '@logger'
import { db, type GroupMessageRecord, type GroupSessionRecord } from '@renderer/databases'

const logger = loggerService.withContext('GroupChatPersistence')

/**
 * 群聊消息 (运行时类型)
 */
export interface GroupMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: Date | string
  type: 'chat' | 'system' | 'action' | 'thought' | 'summary'
  mentions: string[]
  replyTo?: string
  isPublic: boolean
  visibleTo?: string[]
  metadata?: Record<string, unknown>
}

/**
 * 群聊会话 (运行时类型)
 */
export interface GroupSession {
  id: string
  name: string
  speakingMode: 'sequential' | 'random' | 'naturerandom' | 'invitation' | 'mention' | 'keyword' | 'consensus'
  hostAgentId?: string
  topic?: string
  agentIds: string[]
  isActive: boolean
  currentRound: number
  createdAt: Date
  updatedAt: Date
  config?: Record<string, unknown>
}

/**
 * 群聊持久化服务
 */
class GroupChatPersistenceService {
  private static instance: GroupChatPersistenceService | null = null

  private constructor() {
    logger.info('GroupChatPersistenceService initialized')
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): GroupChatPersistenceService {
    if (!GroupChatPersistenceService.instance) {
      GroupChatPersistenceService.instance = new GroupChatPersistenceService()
    }
    return GroupChatPersistenceService.instance
  }

  // ============ 会话操作 ============

  /**
   * 保存会话
   */
  async saveSession(session: GroupSession): Promise<void> {
    try {
      const record: GroupSessionRecord = {
        id: session.id,
        name: session.name,
        speakingMode: session.speakingMode,
        hostAgentId: session.hostAgentId,
        topic: session.topic,
        agentIds: session.agentIds,
        isActive: session.isActive,
        currentRound: session.currentRound,
        createdAt:
          session.createdAt instanceof Date ? session.createdAt.getTime() : new Date(session.createdAt).getTime(),
        updatedAt:
          session.updatedAt instanceof Date ? session.updatedAt.getTime() : new Date(session.updatedAt).getTime(),
        config: session.config
      }
      await db.group_sessions.put(record)
      logger.debug('Session saved', { sessionId: session.id })
    } catch (error) {
      logger.error('Failed to save session', error as Error, { sessionId: session.id })
      throw error
    }
  }

  /**
   * 加载会话
   */
  async loadSession(sessionId: string): Promise<GroupSession | null> {
    try {
      const record = await db.group_sessions.get(sessionId)
      if (!record) {
        return null
      }
      return this.recordToSession(record)
    } catch (error) {
      logger.error('Failed to load session', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 获取所有会话
   */
  async getAllSessions(): Promise<GroupSession[]> {
    try {
      const records = await db.group_sessions.orderBy('updatedAt').reverse().toArray()
      return records.map((r) => this.recordToSession(r))
    } catch (error) {
      logger.error('Failed to get all sessions', error as Error)
      throw error
    }
  }

  /**
   * 获取活跃会话
   */
  async getActiveSessions(): Promise<GroupSession[]> {
    try {
      const records = await db.group_sessions.where('isActive').equals(1).toArray()
      return records.map((r) => this.recordToSession(r))
    } catch (error) {
      logger.error('Failed to get active sessions', error as Error)
      throw error
    }
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(sessionId: string, isActive: boolean): Promise<void> {
    try {
      await db.group_sessions.update(sessionId, {
        isActive,
        updatedAt: Date.now()
      })
      logger.debug('Session status updated', { sessionId, isActive })
    } catch (error) {
      logger.error('Failed to update session status', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 删除会话 (同时删除所有消息)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await db.transaction('rw', [db.group_sessions, db.group_messages], async () => {
        await db.group_messages.where('sessionId').equals(sessionId).delete()
        await db.group_sessions.delete(sessionId)
      })
      logger.info('Session deleted', { sessionId })
    } catch (error) {
      logger.error('Failed to delete session', error as Error, { sessionId })
      throw error
    }
  }

  // ============ 消息操作 ============

  /**
   * 保存消息
   */
  async saveMessage(message: GroupMessage, sessionId: string): Promise<void> {
    try {
      const record: GroupMessageRecord = {
        id: message.id,
        sessionId,
        agentId: message.agentId,
        agentName: message.agentName,
        content: message.content,
        timestamp:
          message.timestamp instanceof Date ? message.timestamp.getTime() : new Date(message.timestamp).getTime(),
        type: message.type,
        mentions: message.mentions,
        replyTo: message.replyTo,
        isPublic: message.isPublic,
        visibleTo: message.visibleTo,
        metadata: message.metadata
      }
      await db.group_messages.put(record)
      logger.debug('Message saved', { messageId: message.id, sessionId })

      // 更新会话的 updatedAt
      await db.group_sessions.update(sessionId, { updatedAt: Date.now() })
    } catch (error) {
      logger.error('Failed to save message', error as Error, { messageId: message.id, sessionId })
      throw error
    }
  }

  /**
   * 批量保存消息
   */
  async saveMessages(messages: GroupMessage[], sessionId: string): Promise<void> {
    if (messages.length === 0) return

    try {
      const records: GroupMessageRecord[] = messages.map((message) => ({
        id: message.id,
        sessionId,
        agentId: message.agentId,
        agentName: message.agentName,
        content: message.content,
        timestamp:
          message.timestamp instanceof Date ? message.timestamp.getTime() : new Date(message.timestamp).getTime(),
        type: message.type,
        mentions: message.mentions,
        replyTo: message.replyTo,
        isPublic: message.isPublic,
        visibleTo: message.visibleTo,
        metadata: message.metadata
      }))

      await db.group_messages.bulkPut(records)
      await db.group_sessions.update(sessionId, { updatedAt: Date.now() })
      logger.debug('Messages batch saved', { count: messages.length, sessionId })
    } catch (error) {
      logger.error('Failed to batch save messages', error as Error, { count: messages.length, sessionId })
      throw error
    }
  }

  /**
   * 加载会话的所有消息
   */
  async loadMessages(sessionId: string): Promise<GroupMessage[]> {
    try {
      const records = await db.group_messages
        .where('[sessionId+timestamp]')
        .between([sessionId, 0], [sessionId, Infinity])
        .toArray()

      return records.map((r) => this.recordToMessage(r))
    } catch (error) {
      logger.error('Failed to load messages', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 加载最近 N 条消息
   */
  async loadRecentMessages(sessionId: string, limit: number = 50): Promise<GroupMessage[]> {
    try {
      const records = await db.group_messages.where('sessionId').equals(sessionId).reverse().limit(limit).toArray()

      // 反转回正序
      return records.reverse().map((r) => this.recordToMessage(r))
    } catch (error) {
      logger.error('Failed to load recent messages', error as Error, { sessionId, limit })
      throw error
    }
  }

  /**
   * 获取会话消息数量
   */
  async getMessageCount(sessionId: string): Promise<number> {
    try {
      return await db.group_messages.where('sessionId').equals(sessionId).count()
    } catch (error) {
      logger.error('Failed to get message count', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 删除会话的所有消息
   */
  async deleteMessages(sessionId: string): Promise<void> {
    try {
      await db.group_messages.where('sessionId').equals(sessionId).delete()
      logger.info('Messages deleted', { sessionId })
    } catch (error) {
      logger.error('Failed to delete messages', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 删除单条消息
   */
  async deleteMessage(messageId: string, sessionId: string): Promise<void> {
    try {
      await db.group_messages.where('[sessionId+id]').equals([sessionId, messageId]).delete()
      logger.info('Message deleted', { messageId, sessionId })
    } catch (error) {
      logger.error('Failed to delete message', error as Error, { messageId, sessionId })
      throw error
    }
  }

  // ============ 辅助方法 ============

  /**
   * 将数据库记录转换为会话对象
   */
  private recordToSession(record: GroupSessionRecord): GroupSession {
    return {
      id: record.id,
      name: record.name,
      speakingMode: record.speakingMode,
      hostAgentId: record.hostAgentId,
      topic: record.topic,
      agentIds: record.agentIds,
      isActive: record.isActive,
      currentRound: record.currentRound,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      config: record.config
    }
  }

  /**
   * 将数据库记录转换为消息对象
   */
  private recordToMessage(record: GroupMessageRecord): GroupMessage {
    return {
      id: record.id,
      agentId: record.agentId,
      agentName: record.agentName,
      content: record.content,
      timestamp: new Date(record.timestamp),
      type: record.type,
      mentions: record.mentions,
      replyTo: record.replyTo,
      isPublic: record.isPublic,
      visibleTo: record.visibleTo,
      metadata: record.metadata
    }
  }

  /**
   * 清理过期会话 (超过 30 天未活动)
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000
      const oldSessions = await db.group_sessions
        .where('updatedAt')
        .below(cutoffTime)
        .and((s) => !s.isActive)
        .toArray()

      for (const session of oldSessions) {
        await this.deleteSession(session.id)
      }

      logger.info('Cleaned up old sessions', { count: oldSessions.length, daysOld })
      return oldSessions.length
    } catch (error) {
      logger.error('Failed to cleanup old sessions', error as Error)
      throw error
    }
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<{ sessionCount: number; messageCount: number }> {
    try {
      const sessionCount = await db.group_sessions.count()
      const messageCount = await db.group_messages.count()
      return { sessionCount, messageCount }
    } catch (error) {
      logger.error('Failed to get stats', error as Error)
      throw error
    }
  }
}

// 导出服务实例
export const groupChatPersistence = GroupChatPersistenceService.getInstance()

// 导出工厂函数
export function getGroupChatPersistence(): GroupChatPersistenceService {
  return GroupChatPersistenceService.getInstance()
}
