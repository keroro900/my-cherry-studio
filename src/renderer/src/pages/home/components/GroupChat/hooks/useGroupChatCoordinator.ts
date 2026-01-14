/**
 * 群聊协调器 Hook
 *
 * 统一管理 GroupChatCoordinator 的初始化和配置
 */

import { loggerService } from '@logger'
import { getGroupChatCoordinator } from '@renderer/services/GroupChatCoordinator'
import type { TaskConfirmation } from '@renderer/services/GroupAgentRunner'
import { groupChatService, type GroupChatConfig, type SpeakingMode } from '@renderer/services/GroupChatService'
import { useCallback, useRef, useState } from 'react'

const logger = loggerService.withContext('useGroupChatCoordinator')

export interface UseGroupChatCoordinatorOptions {
  /** 初始配置 */
  initialConfig?: Partial<GroupChatConfig>
  /** 发言模式 */
  speakingMode: SpeakingMode
  /** 启用 Agent 协同 */
  enableAgentInvocation?: boolean
  /** 群组设定 */
  groupPrompt?: string
  /** 心流锁模式 */
  enableFlowLock?: boolean
  /** 心流锁冷却时间 */
  flowLockCooldown?: number
  /** 心流锁触发提示词 */
  flowLockTriggerPrompt?: string
  /** 上下文净化 */
  enableContextSanitizer?: boolean
  /** 统一模型 */
  useUnifiedModel?: boolean
  /** 统一模型 ID */
  unifiedModel?: string
  /** 邀请提示词模板 */
  invitePromptTemplate?: string
  /** 成员标签 */
  memberTags?: Record<string, string[]>
  /** 话题 */
  topic?: string
  /** 话题更新回调 */
  onTopicUpdate?: (topic: string) => void
  /** 思考状态变更回调 */
  onThinkingChange?: (agentId: string, isThinking: boolean) => void
  /** 错误回调 */
  onError?: (error: Error, agentId?: string) => void
  /** 确认请求回调 */
  onConfirmRequest?: (confirmation: TaskConfirmation) => Promise<boolean>
}

export interface UseGroupChatCoordinatorReturn {
  /** 会话 ID */
  sessionId: string | null
  /** 设置会话 ID */
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>
  /** 是否正在加载 */
  isLoading: boolean
  /** 协调器引用 */
  coordinatorRef: React.MutableRefObject<ReturnType<typeof getGroupChatCoordinator> | null>
  /** 初始化会话 */
  initSession: () => Promise<string | null>
  /** 待确认的任务 */
  pendingConfirmation: TaskConfirmation | null
  /** 确认任务 */
  confirmTask: () => void
  /** 拒绝任务 */
  rejectTask: () => void
}

/**
 * 群聊协调器 Hook
 */
export function useGroupChatCoordinator(options: UseGroupChatCoordinatorOptions): UseGroupChatCoordinatorReturn {
  const {
    initialConfig,
    speakingMode,
    enableAgentInvocation = false,
    groupPrompt,
    enableFlowLock = false,
    flowLockCooldown = 30000,
    flowLockTriggerPrompt,
    enableContextSanitizer = false,
    useUnifiedModel = false,
    unifiedModel,
    invitePromptTemplate,
    memberTags = {},
    topic,
    onTopicUpdate,
    onThinkingChange,
    onError,
    onConfirmRequest
  } = options

  // 状态
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<TaskConfirmation | null>(null)
  const [confirmationResolver, setConfirmationResolver] = useState<{ resolve: (value: boolean) => void } | null>(null)

  // Refs
  const coordinatorRef = useRef<ReturnType<typeof getGroupChatCoordinator> | null>(null)

  /**
   * 初始化会话
   */
  const initSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId

    setIsLoading(true)
    try {
      const result = await groupChatService.createSession({
        ...initialConfig,
        speakingMode
      })
      setSessionId(result.sessionId)

      // 初始化协调器
      const coordinator = getGroupChatCoordinator(result.sessionId, {
        taskConfirmation: {
          autoConfirm: !onConfirmRequest,
          onConfirmRequest: onConfirmRequest || (async (confirmation) => {
            return new Promise<boolean>((resolve) => {
              setPendingConfirmation(confirmation)
              setConfirmationResolver({ resolve })
            })
          })
        },
        enableAgentInvocation,
        groupPrompt: groupPrompt || undefined,
        enableFlowLock,
        flowLockCooldown,
        flowLockTriggerPrompt: flowLockTriggerPrompt || undefined,
        onFlowLockTrigger: (agentId, content) => {
          logger.info('Flow lock triggered', { agentId, content: content.slice(0, 50) })
        },
        enableContextSanitizer,
        contextSanitizerDepth: 2,
        useUnifiedModel,
        unifiedModel: useUnifiedModel ? unifiedModel : undefined,
        invitePromptTemplate: invitePromptTemplate || undefined,
        memberTags: Object.keys(memberTags).length > 0 ? memberTags : undefined,
        topicName: topic || '群聊',
        onTopicUpdated: onTopicUpdate,
        onAgentStatusChange: (agentId, status) => {
          onThinkingChange?.(agentId, status === 'thinking')
        },
        onError: (error, agentId) => {
          logger.error('Coordinator error', error, { agentId })
          onError?.(error, agentId)
        }
      })

      await coordinator.waitForInit()
      coordinatorRef.current = coordinator

      logger.info('Group chat session created', { sessionId: result.sessionId })
      return result.sessionId
    } catch (error) {
      logger.error('Failed to create session', error as Error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [
    sessionId,
    initialConfig,
    speakingMode,
    enableAgentInvocation,
    groupPrompt,
    enableFlowLock,
    flowLockCooldown,
    flowLockTriggerPrompt,
    enableContextSanitizer,
    useUnifiedModel,
    unifiedModel,
    invitePromptTemplate,
    memberTags,
    topic,
    onTopicUpdate,
    onThinkingChange,
    onError,
    onConfirmRequest
  ])

  /**
   * 确认任务
   */
  const confirmTask = useCallback(() => {
    if (confirmationResolver) {
      confirmationResolver.resolve(true)
      setPendingConfirmation(null)
      setConfirmationResolver(null)
    }
  }, [confirmationResolver])

  /**
   * 拒绝任务
   */
  const rejectTask = useCallback(() => {
    if (confirmationResolver) {
      confirmationResolver.resolve(false)
      setPendingConfirmation(null)
      setConfirmationResolver(null)
    }
  }, [confirmationResolver])

  return {
    sessionId,
    setSessionId,
    isLoading,
    coordinatorRef,
    initSession,
    pendingConfirmation,
    confirmTask,
    rejectTask
  }
}
