/**
 * GroupChatStreamManager - VCP 风格的群聊流式渲染管理器
 *
 * 参考 VCPChat 的 StreamManager 实现：
 * - 全局 30fps 渲染循环（requestAnimationFrame）
 * - 累积文本跟踪
 * - DOM 差异更新
 * - 智能语义分块
 *
 * 重要：每个会话使用独立的实例，避免单例带来的状态污染
 * 重要：StreamManager 直接订阅 groupChatService 事件，UI 组件只订阅渲染回调
 */

import { loggerService } from '@logger'

import { type GroupChatEvent, groupChatService } from './GroupChatService'

const logger = loggerService.withContext('GroupChatStreamManager')

/**
 * 流式消息状态
 */
export interface StreamingMessage {
  messageId: string
  agentId: string
  agentName: string
  /** 累积的完整内容 */
  accumulatedContent: string
  /** 上次渲染的内容长度 */
  lastRenderedLength: number
  /** 开始时间 */
  startTime: number
  /** 是否已完成 */
  isComplete: boolean
  /** 是否正在思考 */
  isThinking: boolean
  /** 累积的图片（图片生成时使用） */
  images?: string[]
}

/**
 * 渲染回调
 */
export interface StreamRenderCallbacks {
  /** 渲染更新 */
  onRender: (messages: StreamingMessage[]) => void
  /** 消息完成 */
  onComplete: (messageId: string, finalContent: string) => void
  /** Agent 开始思考 */
  onThinking: (agentId: string, agentName: string) => void
  /** Agent 停止思考 */
  onThinkingEnd: (agentId: string) => void
}

/**
 * VCP 风格的群聊流式渲染管理器
 *
 * 特点：
 * 1. 全局渲染循环 - 30fps 固定帧率，避免过度渲染
 * 2. 累积文本追踪 - 跟踪每条消息的完整内容
 * 3. 差异渲染 - 只在内容变化时触发渲染
 * 4. 批量更新 - 多条流式消息合并渲染
 * 5. 多订阅者支持 - 多个组件可以订阅同一个会话的更新
 */
class GroupChatStreamManager {
  /** 会话 ID -> 管理器实例的映射 */
  private static instances: Map<string, GroupChatStreamManager> = new Map()

  /** 会话 ID */
  private sessionId: string

  /** 流式消息映射 */
  private streamingMessages: Map<string, StreamingMessage> = new Map()

  /** 渲染循环 ID */
  private renderLoopId: number | null = null

  /** 是否正在运行 */
  private isRunning = false

  /** 上次渲染时间 */
  private lastRenderTime = 0

  /** 目标帧率 (30fps = 33.33ms) */
  private readonly FRAME_INTERVAL = 1000 / 30

  /** 多订阅者回调集合 */
  private subscribers: Set<StreamRenderCallbacks> = new Set()

  /** 思考中的 Agent */
  private thinkingAgents: Set<string> = new Set()

  /** 脏标记 - 是否有需要渲染的更新 */
  private isDirty = false

  /** 事件订阅取消函数 */
  private eventUnsubscribe: (() => void) | null = null

  private constructor(sessionId: string) {
    this.sessionId = sessionId
    // 订阅 groupChatService 事件，集中处理流式更新
    this.eventUnsubscribe = groupChatService.subscribe(this.handleGroupChatEvent.bind(this))
    logger.info('GroupChatStreamManager created', { sessionId })
  }

  /**
   * 处理 groupChatService 事件
   * 集中处理流式更新，避免多个组件重复处理导致的问题
   */
  private handleGroupChatEvent(event: GroupChatEvent): void {
    // 只处理当前会话的事件
    if (event.sessionId !== this.sessionId) return

    switch (event.type) {
      case 'agent:stream':
        if (event.messageId && event.agentId && event.accumulatedContent !== undefined) {
          // 获取 agent 名称（从事件或默认值）
          const agentName = (event as unknown as { agentName?: string }).agentName || '助手'

          // 检查是否是新消息
          const existingStream = this.getStreamingMessage(event.messageId)
          if (!existingStream) {
            this.startStream(event.messageId, event.agentId, agentName)
          }

          // 设置累积内容
          this.setAccumulatedContent(event.messageId, event.accumulatedContent)
        }
        break

      case 'agent:thinking':
        if (event.agentId) {
          const agentName = (event as unknown as { agentName?: string }).agentName || '助手'
          this.setThinking(event.agentId, agentName, true)
        }
        break

      case 'agent:speak':
        if (event.message) {
          // 完成流式消息
          this.completeStream(event.message.id)
        }
        break

      case 'chat:start':
        this.start()
        break

      case 'chat:end':
        this.stop()
        break
    }
  }

  /**
   * 获取或创建会话对应的管理器实例
   */
  public static getInstance(sessionId: string): GroupChatStreamManager {
    if (!GroupChatStreamManager.instances.has(sessionId)) {
      GroupChatStreamManager.instances.set(sessionId, new GroupChatStreamManager(sessionId))
    }
    return GroupChatStreamManager.instances.get(sessionId)!
  }

  /**
   * 销毁会话对应的管理器实例
   */
  public static destroyInstance(sessionId: string): void {
    const instance = GroupChatStreamManager.instances.get(sessionId)
    if (instance) {
      instance.dispose()
      GroupChatStreamManager.instances.delete(sessionId)
      logger.info('GroupChatStreamManager destroyed', { sessionId })
    }
  }

  /**
   * 订阅渲染回调（支持多订阅者）
   * @returns 取消订阅的函数
   */
  public subscribe(callbacks: StreamRenderCallbacks): () => void {
    this.subscribers.add(callbacks)
    logger.debug('Subscriber added', { sessionId: this.sessionId, count: this.subscribers.size })

    // 返回取消订阅函数
    return () => {
      this.subscribers.delete(callbacks)
      logger.debug('Subscriber removed', { sessionId: this.sessionId, count: this.subscribers.size })

      // 如果没有订阅者了，停止渲染循环
      if (this.subscribers.size === 0) {
        this.stop()
      }
    }
  }

  /**
   * 开始渲染循环
   */
  public start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.lastRenderTime = performance.now()
    this.scheduleRender()
    logger.info('Stream render loop started', { sessionId: this.sessionId })
  }

  /**
   * 停止渲染循环
   */
  public stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.renderLoopId !== null) {
      cancelAnimationFrame(this.renderLoopId)
      this.renderLoopId = null
    }
    logger.info('Stream render loop stopped', { sessionId: this.sessionId })
  }

  /**
   * 调度下一次渲染
   */
  private scheduleRender(): void {
    if (!this.isRunning) return

    this.renderLoopId = requestAnimationFrame((timestamp) => {
      this.renderFrame(timestamp)
    })
  }

  /**
   * 渲染一帧
   */
  private renderFrame(timestamp: number): void {
    const elapsed = timestamp - this.lastRenderTime

    // 帧率控制 - 确保 30fps
    if (elapsed >= this.FRAME_INTERVAL) {
      this.lastRenderTime = timestamp - (elapsed % this.FRAME_INTERVAL)

      // 只在有更新时渲染
      if (this.isDirty && this.subscribers.size > 0) {
        this.performRender()
        this.isDirty = false
      }
    }

    // 继续循环
    this.scheduleRender()
  }

  /**
   * 执行渲染
   */
  private performRender(): void {
    if (this.subscribers.size === 0) return

    const activeMessages: StreamingMessage[] = []

    for (const msg of this.streamingMessages.values()) {
      if (!msg.isComplete) {
        // 检查是否有新内容需要渲染
        if (msg.accumulatedContent.length > msg.lastRenderedLength) {
          msg.lastRenderedLength = msg.accumulatedContent.length
          activeMessages.push({ ...msg })
        } else if (msg.isThinking) {
          // 思考状态也需要显示
          activeMessages.push({ ...msg })
        }
      }
    }

    if (activeMessages.length > 0) {
      // 通知所有订阅者
      for (const callbacks of this.subscribers) {
        try {
          callbacks.onRender(activeMessages)
        } catch (error) {
          logger.error('Render callback error', error as Error)
        }
      }
    }
  }

  /**
   * 开始新的流式消息
   */
  public startStream(messageId: string, agentId: string, agentName: string): void {
    // 如果已存在，跳过
    if (this.streamingMessages.has(messageId)) {
      return
    }

    const streamMsg: StreamingMessage = {
      messageId,
      agentId,
      agentName,
      accumulatedContent: '',
      lastRenderedLength: 0,
      startTime: Date.now(),
      isComplete: false,
      isThinking: false
    }

    this.streamingMessages.set(messageId, streamMsg)
    this.isDirty = true

    logger.debug('Stream started', { sessionId: this.sessionId, messageId, agentId, agentName })

    // 确保渲染循环在运行
    if (!this.isRunning && this.subscribers.size > 0) {
      this.start()
    }
  }

  /**
   * 追加流式内容
   */
  public appendContent(messageId: string, chunk: string): void {
    const msg = this.streamingMessages.get(messageId)
    if (!msg) {
      logger.warn('Stream message not found', { sessionId: this.sessionId, messageId })
      return
    }

    msg.accumulatedContent += chunk
    msg.isThinking = false
    this.isDirty = true

    // 如果有思考状态的回调，通知停止思考
    if (this.thinkingAgents.has(msg.agentId)) {
      this.thinkingAgents.delete(msg.agentId)
      this.notifyThinkingEnd(msg.agentId)
    }
  }

  /**
   * 设置累积内容（用于接收完整内容而非增量）
   */
  public setAccumulatedContent(messageId: string, content: string): void {
    const msg = this.streamingMessages.get(messageId)
    if (!msg) {
      logger.warn('Stream message not found', { sessionId: this.sessionId, messageId })
      return
    }

    msg.accumulatedContent = content
    msg.isThinking = false
    this.isDirty = true

    // 如果有思考状态的回调，通知停止思考
    if (this.thinkingAgents.has(msg.agentId)) {
      this.thinkingAgents.delete(msg.agentId)
      this.notifyThinkingEnd(msg.agentId)
    }
  }

  /**
   * 设置 Agent 思考状态
   */
  public setThinking(agentId: string, agentName: string, isThinking: boolean): void {
    if (isThinking) {
      if (!this.thinkingAgents.has(agentId)) {
        this.thinkingAgents.add(agentId)
        this.notifyThinking(agentId, agentName)
      }
    } else {
      if (this.thinkingAgents.has(agentId)) {
        this.thinkingAgents.delete(agentId)
        this.notifyThinkingEnd(agentId)
      }
    }
    this.isDirty = true
  }

  /**
   * 通知所有订阅者思考开始
   */
  private notifyThinking(agentId: string, agentName: string): void {
    for (const callbacks of this.subscribers) {
      try {
        callbacks.onThinking(agentId, agentName)
      } catch (error) {
        logger.error('Thinking callback error', error as Error)
      }
    }
  }

  /**
   * 通知所有订阅者思考结束
   */
  private notifyThinkingEnd(agentId: string): void {
    for (const callbacks of this.subscribers) {
      try {
        callbacks.onThinkingEnd(agentId)
      } catch (error) {
        logger.error('ThinkingEnd callback error', error as Error)
      }
    }
  }

  /**
   * 完成流式消息
   */
  public completeStream(messageId: string): void {
    const msg = this.streamingMessages.get(messageId)
    if (!msg) {
      logger.warn('Stream message not found for completion', { sessionId: this.sessionId, messageId })
      return
    }

    msg.isComplete = true
    msg.isThinking = false

    // 通知所有订阅者完成
    for (const callbacks of this.subscribers) {
      try {
        callbacks.onComplete(messageId, msg.accumulatedContent)
      } catch (error) {
        logger.error('Complete callback error', error as Error)
      }
    }

    // 清理思考状态
    if (this.thinkingAgents.has(msg.agentId)) {
      this.thinkingAgents.delete(msg.agentId)
      this.notifyThinkingEnd(msg.agentId)
    }

    // 移除已完成的消息
    this.streamingMessages.delete(messageId)

    logger.debug('Stream completed', {
      sessionId: this.sessionId,
      messageId,
      agentId: msg.agentId,
      contentLength: msg.accumulatedContent.length,
      duration: Date.now() - msg.startTime
    })

    // 如果没有活跃的流式消息和思考状态，可以停止循环
    if (this.streamingMessages.size === 0 && this.thinkingAgents.size === 0) {
      this.stop()
    }
  }

  /**
   * 获取流式消息
   */
  public getStreamingMessage(messageId: string): StreamingMessage | undefined {
    return this.streamingMessages.get(messageId)
  }

  /**
   * 获取所有活跃的流式消息
   */
  public getActiveStreams(): StreamingMessage[] {
    return Array.from(this.streamingMessages.values()).filter((m) => !m.isComplete)
  }

  /**
   * 检查是否有活跃的流
   */
  public hasActiveStreams(): boolean {
    return this.streamingMessages.size > 0 || this.thinkingAgents.size > 0
  }

  /**
   * 获取正在思考的 Agent ID 列表
   */
  public getThinkingAgents(): string[] {
    return Array.from(this.thinkingAgents)
  }

  /**
   * 清理所有流式消息（但不清理订阅者）
   */
  public clearStreams(): void {
    this.streamingMessages.clear()
    this.thinkingAgents.clear()
    this.isDirty = false
    logger.info('Stream messages cleared', { sessionId: this.sessionId })
  }

  /**
   * 完全清理（包括停止循环）
   */
  public clear(): void {
    this.clearStreams()
    this.stop()
  }

  /**
   * 销毁管理器
   */
  private dispose(): void {
    // 取消事件订阅
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe()
      this.eventUnsubscribe = null
    }
    this.clear()
    this.subscribers.clear()
    logger.info('Stream manager disposed', { sessionId: this.sessionId })
  }
}

/**
 * 获取会话对应的 StreamManager 实例
 * @param sessionId 会话 ID
 */
export function getStreamManager(sessionId: string): GroupChatStreamManager {
  return GroupChatStreamManager.getInstance(sessionId)
}

/**
 * 销毁会话对应的 StreamManager 实例
 * @param sessionId 会话 ID
 */
export function destroyStreamManager(sessionId: string): void {
  GroupChatStreamManager.destroyInstance(sessionId)
}

// 导出类型
export type { GroupChatStreamManager }
