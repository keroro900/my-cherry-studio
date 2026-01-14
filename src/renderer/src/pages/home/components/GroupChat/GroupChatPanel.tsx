/**
 * GroupChatPanel - 群聊面板组件
 *
 * 多 Agent 协同对话的主面板
 * 支持多种发言模式和 Agent 管理
 * 集成 GroupChatCoordinator 调用真实 AI 服务
 */

import {
  BulbOutlined,
  CloseOutlined,
  ExportOutlined,
  LoadingOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PauseCircleOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import ImageViewer from '@renderer/components/ImageViewer'
import ModelSelector from '@renderer/components/ModelSelector'
import { useProviders } from '@renderer/hooks/useProvider'
import FileManager from '@renderer/services/FileManager'
import type { FileMetadata } from '@renderer/types'
import { getAssistantById, getAssistantProvider } from '@renderer/services/AssistantService'
import type { TaskConfirmation } from '@renderer/services/GroupAgentRunner'
import { destroyGroupChatCoordinator, getGroupChatCoordinator } from '@renderer/services/GroupChatCoordinator'
import {
  type GroupAgent,
  type GroupChatConfig,
  type GroupChatEvent,
  groupChatService,
  type GroupMessage,
  type SpeakingMode
} from '@renderer/services/GroupChatService'
import {
  destroyStreamManager,
  getStreamManager,
  type StreamingMessage
} from '@renderer/services/GroupChatStreamManager'
import { exportGroupChatAsJson, exportGroupChatAsMarkdown } from '@renderer/utils/groupChatExport'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  message,
  Select,
  Space,
  Tag,
  Tooltip
} from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import styles from './GroupChatPanel.module.css'
import './flowlock.css'
import TaskConfirmationModal from './TaskConfirmationModal'
import GroupChatMessageItem from './GroupChatMessageItem'
import AgentThinkingBubble from './AgentThinkingBubble'
import { SPEAKING_MODES, ROLE_COLORS, STATUS_COLORS } from './constants'

const logger = loggerService.withContext('GroupChatPanel')

export interface GroupChatPanelProps {
  /** 初始配置 */
  initialConfig?: Partial<GroupChatConfig>
  /** 可用的 Assistants */
  availableAssistants?: Array<{
    id: string
    name: string
    prompt: string
    emoji?: string
    description?: string
    model?: { id: string }
    tags?: string[]
  }>
  /** 关闭回调 */
  onClose?: () => void
  /** 样式类名 */
  className?: string
  /** 默认显示设置面板（用于 VCPDashboard 嵌入模式） */
  defaultShowSettings?: boolean
}

/**
 * 群聊面板组件
 */
export const GroupChatPanel: React.FC<GroupChatPanelProps> = ({
  initialConfig,
  availableAssistants = [],
  onClose,
  className,
  defaultShowSettings = false
}) => {
  // 状态
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [agents, setAgents] = useState<GroupAgent[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileMetadata[]>([])
  const [speakingMode, setSpeakingMode] = useState<SpeakingMode>(initialConfig?.speakingMode || 'mention')
  const [topic, setTopic] = useState('')
  const [showSettings, setShowSettings] = useState(defaultShowSettings)
  const [thinkingAgentIds, setThinkingAgentIds] = useState<Set<string>>(new Set())
  const [pendingConfirmation, setPendingConfirmation] = useState<TaskConfirmation | null>(null)
  const [confirmationResolver, setConfirmationResolver] = useState<{
    resolve: (value: boolean) => void
  } | null>(null)
  // Agent 协同开关（允许 AI 主动调用其他 Agent）
  const [enableAgentInvocation, setEnableAgentInvocation] = useState(false)
  // 群组设定（共同背景）
  const [groupPrompt, setGroupPrompt] = useState('')
  // 心流锁模式（AI 主动发言）
  const [enableFlowLock, setEnableFlowLock] = useState(false)
  // 心流锁冷却时间（毫秒）
  const [flowLockCooldown, setFlowLockCooldown] = useState(30000)
  // 心流锁触发提示词
  const [flowLockTriggerPrompt, setFlowLockTriggerPrompt] = useState('')
  // 上下文净化（HTML -> Markdown）
  const [enableContextSanitizer, setEnableContextSanitizer] = useState(false)
  // VCPChat 功能融合 - Phase 7.2
  // 统一模型配置
  const [useUnifiedModel, setUseUnifiedModel] = useState(false)
  const [unifiedModel, setUnifiedModel] = useState<string>('')
  // 邀请提示词模板
  const [invitePromptTemplate, setInvitePromptTemplate] = useState('')
  // 成员标签（agentId -> tags[]）
  const [memberTags, setMemberTags] = useState<Record<string, string[]>>({})
  // 当前正在编辑标签的 Agent ID
  const [editingTagsAgentId, setEditingTagsAgentId] = useState<string | null>(null)
  // 标签编辑输入值
  const [tagInputValue, setTagInputValue] = useState('')

  // Hooks
  const { providers } = useProviders()

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const coordinatorRef = useRef<ReturnType<typeof getGroupChatCoordinator> | null>(null)
  // 使用 ref 存储 agents 避免 handleEvent 依赖循环
  const agentsRef = useRef<GroupAgent[]>([])
  // StreamManager 引用 - 延迟初始化，当有 sessionId 时才创建
  const streamManagerRef = useRef<ReturnType<typeof getStreamManager> | null>(null)

  // 流式消息状态 - 由 StreamManager 管理
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([])

  // 同步 agents 到 ref
  useEffect(() => {
    agentsRef.current = agents
  }, [agents])

  /**
   * 滚动到底部
   * NOTE: 必须在 StreamManager useEffect 之前定义，否则会出现 "Cannot access before initialization" 错误
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /**
   * 初始化 StreamManager - 当 sessionId 可用时
   */
  useEffect(() => {
    if (!sessionId) return

    // 获取或创建会话对应的 StreamManager 实例
    const streamManager = getStreamManager(sessionId)
    streamManagerRef.current = streamManager

    // 使用 subscribe 订阅渲染回调（支持多订阅者）
    const unsubscribe = streamManager.subscribe({
      onRender: (messages) => {
        setStreamingMessages([...messages])
        scrollToBottom()
      },
      onComplete: (messageId, _finalContent) => {
        // 完成时从流式消息列表中移除
        setStreamingMessages((prev) => prev.filter((m) => m.messageId !== messageId))
      },
      onThinking: (agentId, _agentName) => {
        setThinkingAgentIds((prev) => new Set(prev).add(agentId))
      },
      onThinkingEnd: (agentId) => {
        setThinkingAgentIds((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
      }
    })

    return () => {
      // 取消订阅
      unsubscribe()
      streamManagerRef.current = null
    }
  }, [sessionId, scrollToBottom])

  /**
   * 处理任务确认
   */
  const handleConfirmTask = useCallback(() => {
    if (confirmationResolver) {
      confirmationResolver.resolve(true)
      setPendingConfirmation(null)
      setConfirmationResolver(null)
    }
  }, [confirmationResolver])

  /**
   * 处理任务拒绝
   */
  const handleRejectTask = useCallback(() => {
    if (confirmationResolver) {
      confirmationResolver.resolve(false)
      setPendingConfirmation(null)
      setConfirmationResolver(null)
    }
  }, [confirmationResolver])

  /**
   * 处理群聊事件
   * 注意：流式相关事件（agent:stream, agent:thinking, chat:start/end）由 StreamManager 直接处理
   * 这里只处理 UI 状态更新
   */
  const handleEvent = useCallback(
    (event: GroupChatEvent) => {
      if (event.sessionId !== sessionId) return

      logger.debug('GroupChat event received', { type: event.type })

      switch (event.type) {
        case 'agent:join':
          if (event.agent) {
            // 防止重复添加
            setAgents((prev) => {
              if (prev.some((a) => a.id === event.agent!.id)) {
                return prev
              }
              return [...prev, event.agent!]
            })
          }
          break

        case 'agent:leave':
          if (event.agentId) {
            setAgents((prev) => prev.filter((a) => a.id !== event.agentId))
          }
          break

        case 'agent:speak':
          if (event.message) {
            // StreamManager 会处理 completeStream，这里只添加最终消息
            // 添加最终消息（检查是否已存在，避免重复）
            setMessages((prev) => {
              if (prev.some((m) => m.id === event.message!.id)) {
                return prev
              }
              return [...prev, event.message!]
            })
            // 移除正在思考状态
            if (event.agentId) {
              setThinkingAgentIds((prev) => {
                const next = new Set(prev)
                next.delete(event.agentId!)
                return next
              })
            }
            scrollToBottom()
          }
          break

        case 'agent:thinking':
          if (event.agentId) {
            // 只更新本地 agent 状态，StreamManager 已自动处理思考状态
            setAgents((prev) => prev.map((a) => (a.id === event.agentId ? { ...a, status: 'thinking' as const } : a)))
          }
          break

        // agent:stream 由 StreamManager 直接处理，不需要在这里处理

        case 'chat:start':
          setIsActive(true)
          // StreamManager 已自动处理 start()
          break

        case 'chat:end':
          setIsActive(false)
          // StreamManager 已自动处理 stop()
          break

        case 'topic:updated':
          // 话题标题更新
          if (event.topic) {
            setTopic(event.topic)
            logger.info('Topic updated', { newTopic: event.topic })
          }
          break
      }
    },
    [sessionId, scrollToBottom]
  )

  /**
   * 初始化会话
   */
  const initSession = useCallback(async () => {
    if (sessionId) return

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
          autoConfirm: false,
          onConfirmRequest: async (confirmation) => {
            // 显示确认模态框并等待用户响应
            return new Promise<boolean>((resolve) => {
              setPendingConfirmation(confirmation)
              setConfirmationResolver({ resolve })
            })
          }
        },
        // 启用 Agent 协同（AI 主动调用其他 Agent）
        enableAgentInvocation,
        // VCP 风格配置
        groupPrompt: groupPrompt || undefined,
        // 心流锁模式配置
        enableFlowLock,
        flowLockCooldown,
        flowLockTriggerPrompt: flowLockTriggerPrompt || undefined,
        onFlowLockTrigger: (agentId, content) => {
          logger.info('Flow lock triggered', { agentId, content: content.slice(0, 50) })
        },
        // 上下文净化配置
        enableContextSanitizer,
        contextSanitizerDepth: 2, // 从第2条消息开始净化
        // VCPChat 功能融合 - Phase 7.2
        useUnifiedModel,
        unifiedModel: useUnifiedModel ? unifiedModel : undefined,
        invitePromptTemplate: invitePromptTemplate || undefined,
        memberTags: Object.keys(memberTags).length > 0 ? memberTags : undefined,
        // 话题自动总结配置
        topicName: topic || '群聊',
        onTopicUpdated: (newTopic) => {
          setTopic(newTopic)
          logger.info('Topic auto-updated', { newTopic })
        },
        // 移除 onMessage 回调，统一使用事件机制避免消息重复
        onAgentStatusChange: (agentId, status) => {
          if (status === 'thinking') {
            setThinkingAgentIds((prev) => new Set(prev).add(agentId))
          } else {
            setThinkingAgentIds((prev) => {
              const newSet = new Set(prev)
              newSet.delete(agentId)
              return newSet
            })
          }
        },
        onError: (error, agentId) => {
          logger.error('Coordinator error', error, { agentId })
          message.error(`助手响应出错: ${agentId || 'unknown'}`)
        }
      })

      // 等待协调器初始化完成
      await coordinator.waitForInit()
      coordinatorRef.current = coordinator

      logger.info('Group chat session created', { sessionId: result.sessionId })
    } catch (error) {
      logger.error('Failed to create session', error as Error)
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
    scrollToBottom
  ])

  /**
   * 心流锁手动触发 - 让 AI 主动发言
   */
  const handleTriggerFlowLock = useCallback(async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator || !isActive) {
      message.warning('请先开始群聊')
      return
    }

    if (thinkingAgentIds.size > 0) {
      message.warning('请等待当前响应完成')
      return
    }

    // 选择一个 Agent 来发言（优先选择 host）
    const hostAgent = agents.find((a) => a.role === 'host')
    const targetAgent = hostAgent || agents[Math.floor(Math.random() * agents.length)]

    if (!targetAgent) {
      message.warning('没有可用的助手')
      return
    }

    logger.info('Manually triggering flowlock speak', { agentId: targetAgent.id })
    setThinkingAgentIds((prev) => new Set(prev).add(targetAgent.id))

    try {
      const triggerPrompt = flowLockTriggerPrompt || '根据之前的对话，你可以主动提出想法、继续讨论、汇报进度或提出问题。'
      const response = await coordinator.requestAgentSpeak(targetAgent.id, triggerPrompt)

      if (response) {
        message.success(`${targetAgent.displayName} 已响应`)
      }
    } catch (error) {
      logger.error('Failed to trigger flowlock speak', error as Error)
      message.error('触发发言失败')
    } finally {
      setThinkingAgentIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(targetAgent.id)
        return newSet
      })
    }
  }, [isActive, agents, thinkingAgentIds, flowLockTriggerPrompt])

  /**
   * 切换心流锁状态
   */
  const handleToggleFlowLock = useCallback(() => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return

    if (enableFlowLock) {
      coordinator.disableFlowLock()
      setEnableFlowLock(false)
      message.info('心流锁已关闭')
    } else {
      setEnableFlowLock(true)
      if (isActive) {
        coordinator.enableFlowLock()
        message.success('心流锁已开启 - AI 将在静默期主动发言')
      }
    }
  }, [enableFlowLock, isActive])

  /**
   * 键盘快捷键处理
   * Ctrl/Cmd + Shift + F: 切换心流锁
   * Ctrl/Cmd + Shift + C: 手动触发 AI 发言
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + Shift + F: 切换心流锁
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        handleToggleFlowLock()
        return
      }

      // Ctrl/Cmd + Shift + C: 手动触发 AI 发言
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        handleTriggerFlowLock()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleToggleFlowLock, handleTriggerFlowLock])

  /**
   * 添加 Assistant
   */
  const handleAddAssistant = useCallback(
    async (assistant: (typeof availableAssistants)[0]) => {
      if (!sessionId) {
        await initSession()
      }

      setIsLoading(true)
      try {
        // 先适配 Assistant 为 UnifiedAgent
        const unifiedAgent = await groupChatService.adaptAssistant(assistant)

        // 然后添加到群聊
        await groupChatService.addUnifiedAgent(sessionId!, unifiedAgent.id)

        // 刷新 agents 列表
        const updatedAgents = await groupChatService.getAgents(sessionId!)
        setAgents(updatedAgents)

        // 获取完整的 Assistant 对象和 Provider
        const fullAssistant = getAssistantById(assistant.id)
        if (fullAssistant) {
          const provider = getAssistantProvider(fullAssistant)
          // 添加到协调器
          const addedAgent = updatedAgents.find((a) => a.id === assistant.id)
          if (addedAgent && coordinatorRef.current) {
            coordinatorRef.current.addAgent({
              ...addedAgent,
              assistant: fullAssistant,
              provider
            })
            logger.info('Agent added to coordinator', { agentId: assistant.id })
          }
        }

        logger.info('Assistant added to group chat', { assistantId: assistant.id })
      } catch (error) {
        logger.error('Failed to add assistant', error as Error)
        message.error('添加助手失败')
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, initSession]
  )

  /**
   * 移除 Agent
   */
  const handleRemoveAgent = useCallback(
    async (agentId: string) => {
      if (!sessionId) return

      try {
        await groupChatService.removeAgent(sessionId, agentId)
        setAgents((prev) => prev.filter((a) => a.id !== agentId))
      } catch (error) {
        logger.error('Failed to remove agent', error as Error)
      }
    },
    [sessionId]
  )

  /**
   * 邀请 Agent 发言
   * 支持使用 invitePromptTemplate 模板，或直接请求发言
   */
  const handleInviteAgent = useCallback(
    async (agentId: string) => {
      if (!sessionId || !isActive) return

      const agent = agents.find((a) => a.id === agentId)
      if (!agent) return

      // 标记为思考中
      setThinkingAgentIds((prev) => new Set(prev).add(agentId))

      try {
        // 构建邀请上下文
        let context = `请 ${agent.displayName} 发言`

        // 如果配置了邀请提示词模板，使用模板
        if (invitePromptTemplate.trim()) {
          context = invitePromptTemplate.replace(/\{\{VCPChatAgentName\}\}/g, agent.displayName)
        }

        // 使用协调器请求发言
        const coordinator = coordinatorRef.current
        if (coordinator) {
          const response = await coordinator.requestAgentSpeak(agentId, context)
          if (response) {
            logger.info('Invited agent spoke', { agentId, agentName: agent.displayName })
          }
        } else {
          // 降级到服务调用
          await groupChatService.requestSpeak(sessionId, agentId, context)
        }
      } catch (error) {
        logger.error('Failed to invite agent', error as Error)
        message.error(`邀请 ${agent.displayName} 发言失败`)
      } finally {
        setThinkingAgentIds((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
      }
    },
    [sessionId, isActive, agents, invitePromptTemplate]
  )

  /**
   * 结束群聊
   */
  const handleEnd = useCallback(async () => {
    if (!sessionId) return

    setIsLoading(true)
    try {
      // 使用协调器结束
      const coordinator = coordinatorRef.current
      if (coordinator) {
        // 先禁用心流锁（如果激活的话）
        coordinator.disableFlowLock()
        await coordinator.end()
      } else {
        await groupChatService.end(sessionId)
      }
      setIsActive(false)
    } catch (error) {
      logger.error('Failed to end group chat', error as Error)
      message.error('结束群聊失败')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  /**
   * 中断正在进行的 Agent 响应
   */
  const handleInterrupt = useCallback(async () => {
    if (!sessionId) return

    try {
      await groupChatService.interrupt(sessionId)
      // 清除所有思考状态
      setThinkingAgentIds(new Set())
      message.info('已中断 Agent 响应')
      logger.info('Group chat interrupted', { sessionId })
    } catch (error) {
      logger.error('Failed to interrupt group chat', error as Error)
      message.error('中断失败')
    }
  }, [sessionId])

  /**
   * 重新回答消息
   */
  const handleRedoMessage = useCallback(
    async (messageId: string, agentId: string) => {
      if (!sessionId) return

      try {
        setThinkingAgentIds((prev) => new Set([...prev, agentId]))
        const result = await groupChatService.redoMessage(sessionId, messageId, agentId)
        if (result.message) {
          // 更新消息列表：删除旧消息，添加新消息
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== messageId)
            return [...filtered, result.message!]
          })
          message.success('重新回答成功')
        }
      } catch (error) {
        logger.error('Failed to redo message', error as Error)
        message.error('重新回答失败')
      } finally {
        setThinkingAgentIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(agentId)
          return newSet
        })
      }
    },
    [sessionId]
  )

  /**
   * 删除消息
   */
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    message.success('消息已删除')
    logger.info('Message deleted', { messageId })
  }, [])

  /**
   * 编辑消息
   */
  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: newContent } : m)))
    message.success('消息已更新')
    logger.info('Message edited', { messageId })
  }, [])

  /**
   * 处理文件选择 - 使用 Electron 文件对话框
   */
  const handleFileSelect = useCallback(async () => {
    try {
      const files = await FileManager.selectFiles()
      if (files && files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files])
      }
    } catch (error) {
      logger.error('Failed to select files', error as Error)
      message.error('选择文件失败')
    }
  }, [])

  /**
   * 移除选中的文件
   */
  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /**
   * 发送消息
   * 优化：先显示用户消息，再异步处理文件上传和 AI 调用
   * 自动开始群聊（如果尚未开始）
   */
  const handleSend = useCallback(async () => {
    if (!sessionId || !inputValue.trim() || isSending) return

    // 如果群聊还未开始，自动开始
    if (!isActive && agents.length >= 2) {
      setIsLoading(true)
      try {
        const coordinator = coordinatorRef.current
        if (coordinator) {
          await coordinator.start(topic || undefined)
          if (enableFlowLock) {
            coordinator.enableFlowLock()
            logger.info('Flow lock mode activated')
          }
        } else {
          await groupChatService.start(sessionId, topic || undefined)
        }
        setIsActive(true)
      } catch (error) {
        logger.error('Failed to auto-start group chat', error as Error)
        message.error('启动群聊失败')
        setIsLoading(false)
        return
      } finally {
        setIsLoading(false)
      }
    } else if (!isActive && agents.length < 2) {
      message.warning('请至少添加 2 个助手后再发送消息')
      return
    }

    const content = inputValue.trim()
    const filesToUpload = [...selectedFiles] // 复制文件列表

    // 立即清空输入和文件，让用户可以继续操作
    setInputValue('')
    setSelectedFiles([])
    setIsSending(true)

    // 生成消息 ID
    const messageId = `user_${Date.now()}`

    // 立即创建并显示用户消息（带占位符表示文件上传中）
    const userMessage: GroupMessage = {
      id: messageId,
      agentId: 'user',
      agentName: '我',
      content,
      timestamp: new Date(),
      type: 'chat',
      mentions: [],
      isPublic: true,
      metadata: filesToUpload.length > 0 ? { files: filesToUpload, uploading: true } : undefined
    }

    // 立即添加消息到列表
    setMessages((prev) => [...prev, userMessage])

    // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
    requestAnimationFrame(() => {
      scrollToBottom()
    })

    try {
      // 异步上传文件
      let uploadedFiles: FileMetadata[] | undefined
      if (filesToUpload.length > 0) {
        uploadedFiles = await FileManager.uploadFiles(filesToUpload)
        // 更新消息，移除上传中标记
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, metadata: { files: uploadedFiles, uploading: false } } : msg
          )
        )
      }

      // 使用协调器处理用户输入
      const coordinator = coordinatorRef.current
      if (coordinator) {
        const responses = await coordinator.handleUserInput(content, 'user', uploadedFiles)
        logger.info('Agent responses received', { count: responses.length })
        // 响应已通过 onMessage 回调添加到消息列表
      } else {
        // 降级到旧的服务调用
        const { decisions } = await groupChatService.handleUserInput(sessionId, content)
        for (const decision of decisions) {
          if (decision.shouldSpeak) {
            await groupChatService.requestSpeak(sessionId, decision.agentId, content)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to send message', error as Error)
      message.error('发送消息失败')
    } finally {
      setIsSending(false)
    }
  }, [sessionId, inputValue, isActive, isSending, scrollToBottom, selectedFiles, agents.length, topic, enableFlowLock])

  /**
   * 订阅事件
   */
  useEffect(() => {
    const unsubscribe = groupChatService.subscribe(handleEvent)
    return () => unsubscribe()
  }, [handleEvent])

  /**
   * 初始化
   */
  useEffect(() => {
    initSession()
  }, [])

  /**
   * 清理
   */
  useEffect(() => {
    return () => {
      if (sessionId) {
        // 先销毁协调器
        destroyGroupChatCoordinator(sessionId)
        coordinatorRef.current = null
        // 销毁 StreamManager 实例
        destroyStreamManager(sessionId)
        streamManagerRef.current = null
        // 然后销毁会话
        groupChatService.destroy(sessionId).catch((e) => logger.error('Failed to destroy session', e))
      }
    }
  }, [sessionId])

  /**
   * 处理添加标签
   */
  const handleAddTag = useCallback(
    (agentId: string) => {
      if (!tagInputValue.trim()) return
      const newTag = tagInputValue.trim()
      setMemberTags((prev) => {
        const currentTags = prev[agentId] || []
        if (currentTags.includes(newTag)) return prev
        return { ...prev, [agentId]: [...currentTags, newTag] }
      })
      setTagInputValue('')
    },
    [tagInputValue]
  )

  /**
   * 处理删除标签
   */
  const handleRemoveTag = useCallback((agentId: string, tagToRemove: string) => {
    setMemberTags((prev) => {
      const currentTags = prev[agentId] || []
      const newTags = currentTags.filter((t) => t !== tagToRemove)
      if (newTags.length === 0) {
        // 移除该 agentId 的条目
        return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== agentId))
      }
      return { ...prev, [agentId]: newTags }
    })
  }, [])

  /**
   * 渲染 Agent 卡片
   */
  const renderAgentCard = (agent: GroupAgent) => {
    const agentTags = memberTags[agent.id] || []
    const isEditingTags = editingTagsAgentId === agent.id
    const isThinking = thinkingAgentIds.has(agent.id)

    return (
      <Card
        key={agent.id}
        size="small"
        className={`${styles.agentCard} ${isThinking ? styles.thinking : ''}`}
        extra={
          <Space size={4}>
            {/* 邀请按钮 - 仅在群聊进行中时显示 */}
            {isActive && !thinkingAgentIds.has(agent.id) && (
              <Tooltip title={`邀请 ${agent.displayName} 发言`}>
                <Button
                  type="text"
                  size="small"
                  icon={<UserAddOutlined />}
                  onClick={() => handleInviteAgent(agent.id)}
                  style={{ color: 'var(--color-primary)' }}
                />
              </Tooltip>
            )}
            {/* 思考中指示器 */}
            {thinkingAgentIds.has(agent.id) && (
              <Tooltip title={`${agent.displayName} 正在思考...`}>
                <LoadingOutlined spin style={{ color: 'var(--color-warning)' }} />
              </Tooltip>
            )}
            {/* 移除按钮 - 仅在群聊未开始时显示 */}
            {!isActive && <CloseOutlined className={styles.removeBtn} onClick={() => handleRemoveAgent(agent.id)} />}
          </Space>
        }>
        <Card.Meta
          avatar={
            <Badge dot color={STATUS_COLORS[agent.status]}>
              <Avatar>{agent.avatar || agent.displayName[0]}</Avatar>
            </Badge>
          }
          title={
            <Space>
              {agent.displayName}
              <Tag color={ROLE_COLORS[agent.role]}>{agent.role}</Tag>
            </Space>
          }
          description={
            <div className={styles.agentExpertise}>
              {agent.expertise.slice(0, 3).map((e) => (
                <Tag key={e}>{e}</Tag>
              ))}
            </div>
          }
        />
        {/* 成员标签区域 - VCPChat Phase 7.2 */}
        <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            {agentTags.map((tag) => (
              <Tag
                key={tag}
                closable={!isActive}
                onClose={() => handleRemoveTag(agent.id, tag)}
                color="blue"
                style={{ marginRight: 0 }}>
                {tag}
              </Tag>
            ))}
            {!isActive && (
              <>
                {isEditingTags ? (
                  <Input
                    size="small"
                    style={{ width: 80 }}
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onPressEnter={() => {
                      handleAddTag(agent.id)
                      setEditingTagsAgentId(null)
                    }}
                    onBlur={() => {
                      if (tagInputValue.trim()) {
                        handleAddTag(agent.id)
                      }
                      setEditingTagsAgentId(null)
                    }}
                    placeholder="标签"
                    autoFocus
                  />
                ) : (
                  <Tooltip title="添加标签（用于自然随机模式权重）">
                    <Tag
                      style={{ cursor: 'pointer', borderStyle: 'dashed' }}
                      onClick={() => {
                        setEditingTagsAgentId(agent.id)
                        setTagInputValue('')
                      }}>
                      + 标签
                    </Tag>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    )
  }

  /**
   * 渲染消息 - 使用新的 GroupChatMessageItem 组件
   */
  const renderMessage = (msg: GroupMessage, index: number) => {
    const isUser = msg.agentId === 'user'
    const agent = agents.find((a) => a.id === msg.agentId)
    const images = msg.metadata?.images as string[] | undefined
    const isLastMessage = index === messages.length - 1

    return (
      <div key={msg.id}>
        <GroupChatMessageItem
          message={msg}
          isUser={isUser}
          isStreaming={false}
          avatar={agent?.avatar}
          displayName={isUser ? '我' : agent?.displayName || msg.agentName}
          roleLabel={!isUser && agent ? agent.role : undefined}
          isLastMessage={isLastMessage}
          onRedo={isActive ? handleRedoMessage : undefined}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
        />
        {/* 渲染图片（如果有） - 使用 ImageViewer 组件 */}
        {images && images.length > 0 && (
          <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((image, index) => (
              <ImageViewer
                key={`${msg.id}-img-${index}`}
                src={image}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: 280,
                  maxHeight: 280,
                  borderRadius: 8
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={`${styles.headerTitle} ${isActive && enableFlowLock ? styles.headerTitleFlowlock : ''}`}>
          <TeamOutlined />
          <span className={isActive && enableFlowLock ? 'flowlock-active' : ''}>群聊模式</span>
          {isActive && <Badge status="processing" text="进行中" className={styles.statusBadgeProcessing} />}
          {/* 心流锁指示器 - 带动画效果 */}
          {isActive && enableFlowLock && (
            <Tooltip title="心流锁模式已启用 - AI 将在静默期主动发言">
              <Tag
                icon={<ThunderboltOutlined className="flowlock-playing-emoji" />}
                color="gold"
                className={`${styles.flowlockTag} flowlock-tag active`}
                style={{ marginLeft: 8 }}>
                心流锁
                <span className="flowlock-indicator" />
              </Tag>
            </Tooltip>
          )}
          {/* 思考中指示器 */}
          {thinkingAgentIds.size > 0 && (
            <Tag icon={<LoadingOutlined spin />} color="processing" style={{ marginLeft: 8 }}>
              {agents
                .filter((a) => thinkingAgentIds.has(a.id))
                .map((a) => a.displayName)
                .join(', ')}{' '}
              思考中...
            </Tag>
          )}
        </div>
        <Space>
          {/* 导出按钮 - 仅在有消息时显示 */}
          {messages.length > 0 && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'markdown',
                    label: '导出为 Markdown',
                    onClick: () => {
                      if (sessionId) {
                        exportGroupChatAsMarkdown(sessionId, topic, agents, messages)
                      }
                    }
                  },
                  {
                    key: 'json',
                    label: '导出为 JSON',
                    onClick: () => {
                      if (sessionId) {
                        exportGroupChatAsJson(sessionId, topic, agents, messages)
                      }
                    }
                  }
                ]
              }}
              trigger={['click']}>
              <Tooltip title="导出聊天记录">
                <Button type="text" icon={<ExportOutlined />} />
              </Tooltip>
            </Dropdown>
          )}
          {/* 心流锁切换按钮 */}
          {isActive && (
            <Tooltip title={enableFlowLock ? '关闭心流锁 (Ctrl+Shift+F)' : '开启心流锁 (Ctrl+Shift+F)'}>
              <Button
                type={enableFlowLock ? 'primary' : 'text'}
                icon={<ThunderboltOutlined className={enableFlowLock ? 'flowlock-playing-emoji' : ''} />}
                onClick={handleToggleFlowLock}
                style={enableFlowLock ? { background: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : {}}
              />
            </Tooltip>
          )}
          {/* 手动触发 AI 发言按钮 */}
          {isActive && (
            <Tooltip title="触发 AI 主动发言 (Ctrl+Shift+C)">
              <Button
                type="text"
                icon={<MessageOutlined />}
                onClick={handleTriggerFlowLock}
                disabled={thinkingAgentIds.size > 0}
              />
            </Tooltip>
          )}
          <Tooltip title="设置">
            <Button type="text" icon={<SettingOutlined />} onClick={() => setShowSettings(!showSettings)} />
          </Tooltip>
          {onClose && <Button type="text" icon={<CloseOutlined />} onClick={onClose} />}
        </Space>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label>发言模式：</label>
              <Select
                value={speakingMode}
                onChange={setSpeakingMode}
                style={{ width: '100%' }}
                disabled={isActive}
                options={SPEAKING_MODES.map((m) => ({
                  value: m.value,
                  label: <Tooltip title={m.description}>{m.label}</Tooltip>
                }))}
              />
            </div>
            <div>
              <label>讨论话题：</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入讨论话题（可选）"
                disabled={isActive}
              />
            </div>
            <Tooltip title="启用后，AI 可以通过工具调用主动请求其他 Agent 协助，类似 VCP 的多 Agent 协同">
              <Checkbox
                checked={enableAgentInvocation}
                onChange={(e) => setEnableAgentInvocation(e.target.checked)}
                disabled={isActive}>
                Agent 协同（AI 主动调用）
              </Checkbox>
            </Tooltip>
            <Tooltip title="启用后，AI 可以在对话静默期主动发言，保持对话持续进行（类似 VCPChat 的心流锁模式）">
              <Checkbox
                checked={enableFlowLock}
                onChange={(e) => setEnableFlowLock(e.target.checked)}
                disabled={isActive}>
                心流锁模式（AI 主动发言）
              </Checkbox>
            </Tooltip>
            {/* 心流锁高级配置 - 仅当启用心流锁时显示 */}
            {enableFlowLock && (
              <>
                <div style={{ marginLeft: 24 }}>
                  <Tooltip title="AI 主动发言之间的最小间隔时间">
                    <label>冷却时间（秒）：</label>
                  </Tooltip>
                  <Input
                    type="number"
                    value={flowLockCooldown / 1000}
                    onChange={(e) => setFlowLockCooldown(Number(e.target.value) * 1000)}
                    min={10}
                    max={300}
                    style={{ width: 100, marginLeft: 8 }}
                    disabled={isActive}
                  />
                </div>
                <div style={{ marginLeft: 24 }}>
                  <Tooltip title="AI 主动发言时使用的提示词，引导 AI 继续对话">
                    <label>触发提示词：</label>
                  </Tooltip>
                  <Input.TextArea
                    value={flowLockTriggerPrompt}
                    onChange={(e) => setFlowLockTriggerPrompt(e.target.value)}
                    placeholder="例如: 根据之前的对话，你可以主动提出想法或继续讨论（可选）"
                    disabled={isActive}
                    autoSize={{ minRows: 2, maxRows: 3 }}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </>
            )}
            {/* 上下文净化 */}
            <Tooltip title="将 AI 回复中的 HTML 转换为 Markdown，减少 token 用量（类似 VCPChat 的 contextSanitizer）">
              <Checkbox
                checked={enableContextSanitizer}
                onChange={(e) => setEnableContextSanitizer(e.target.checked)}
                disabled={isActive}>
                上下文净化（减少 token）
              </Checkbox>
            </Tooltip>
            <div>
              <Tooltip title="为整个群聊定义共同的背景、规则或系统级指令，影响所有参与者的行为（类似 VCPChat 的 groupPrompt）">
                <label>群组设定：</label>
              </Tooltip>
              <Input.TextArea
                value={groupPrompt}
                onChange={(e) => setGroupPrompt(e.target.value)}
                placeholder="定义群聊的共同背景、规则或系统级指令（可选）"
                disabled={isActive}
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ marginTop: 4 }}
              />
            </div>
            {/* VCPChat 功能融合 - Phase 7.2 */}
            <Tooltip title="启用后，所有成员使用统一的模型进行对话，便于控制成本和一致性（类似 VCPChat 的统一模型配置）">
              <Checkbox
                checked={useUnifiedModel}
                onChange={(e) => setUseUnifiedModel(e.target.checked)}
                disabled={isActive}>
                使用统一模型
              </Checkbox>
            </Tooltip>
            {useUnifiedModel && (
              <div>
                <label>统一模型：</label>
                <ModelSelector
                  providers={providers}
                  value={unifiedModel || undefined}
                  onChange={(value) => setUnifiedModel(value as string)}
                  placeholder="选择统一使用的模型"
                  style={{ width: '100%' }}
                  disabled={isActive}
                  showSuffix={true}
                />
              </div>
            )}
            <div>
              <Tooltip title="邀请发言模式下使用的提示词模板，支持 {{VCPChatAgentName}} 占位符替换为被邀请的 Agent 名称">
                <label>邀请提示词模板：</label>
              </Tooltip>
              <Input.TextArea
                value={invitePromptTemplate}
                onChange={(e) => setInvitePromptTemplate(e.target.value)}
                placeholder="例如: 请 {{VCPChatAgentName}} 分享你的观点（可选，支持 {{VCPChatAgentName}} 占位符）"
                disabled={isActive}
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ marginTop: 4 }}
              />
            </div>
          </Space>
        </div>
      )}

      {/* Agent 列表 */}
      <div className={styles.agentsSection}>
        <div className={styles.sectionTitle}>
          <TeamOutlined />
          <span>参与者 ({agents.length})</span>
          <Tooltip title="添加助手">
            <Select
              placeholder="添加助手"
              style={{ width: 120 }}
              size="small"
              disabled={isActive}
              value={undefined}
              onChange={(value) => {
                const assistant = availableAssistants.find((a) => a.id === value)
                if (assistant) {
                  handleAddAssistant(assistant)
                }
              }}
              options={availableAssistants
                .filter((a) => !agents.some((ag) => ag.id === a.id))
                .map((a) => ({
                  value: a.id,
                  label: `${a.emoji || ''} ${a.name}`
                }))}
            />
          </Tooltip>
        </div>
        <div className={styles.agentsList}>
          {agents.length === 0 ? (
            <Empty description="请添加至少2个助手" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            agents.map(renderAgentCard)
          )}
        </div>
      </div>

      {/* 快捷邀请按钮 - 在邀请发言模式下显示 */}
      {isActive && speakingMode === 'invitation' && agents.length > 0 && (
        <div className={styles.inviteButtons}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)', marginRight: 8 }}>快捷邀请：</span>
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={styles.inviteButton}
              onClick={() => handleInviteAgent(agent.id)}
              disabled={thinkingAgentIds.has(agent.id)}>
              <Avatar size={24} style={{ backgroundColor: ROLE_COLORS[agent.role] || 'var(--color-primary)' }}>
                {agent.avatar || agent.displayName[0]}
              </Avatar>
              <span>{agent.displayName}</span>
              {thinkingAgentIds.has(agent.id) && <LoadingOutlined spin style={{ marginLeft: 4 }} />}
            </button>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div className={styles.messagesSection}>
        {messages.length === 0 && streamingMessages.length === 0 && thinkingAgentIds.size === 0 ? (
          <div className={styles.emptyMessages}>
            <BulbOutlined />
            <p>开始群聊后，消息将显示在这里</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => renderMessage(msg, index))}
            {/* 思考气泡 - 显示正在思考但尚未开始输出的 Agent */}
            {Array.from(thinkingAgentIds)
              .filter((agentId) => !streamingMessages.some((m) => m.agentId === agentId))
              .map((agentId) => {
                const agent = agentsRef.current.find((a) => a.id === agentId)
                if (!agent) return null
                return (
                  <AgentThinkingBubble
                    key={`thinking-${agentId}`}
                    agentId={agentId}
                    agentName={agent.displayName || agent.name}
                    avatar={agent.avatar}
                  />
                )
              })}
            {/* 流式消息 - 使用 StreamManager 管理，支持多条并发流式消息 */}
            {/* 过滤掉已经存在于 messages 中的消息，避免 key 重复 */}
            {streamingMessages
              .filter((streamMsg) => !messages.some((m) => m.id === streamMsg.messageId))
              .map((streamMsg) => {
                const streamImages = streamMsg.images as string[] | undefined
                return (
                  <div key={`streaming-${streamMsg.messageId}`}>
                    <GroupChatMessageItem
                      message={{
                        id: streamMsg.messageId,
                        agentId: streamMsg.agentId,
                        agentName: streamMsg.agentName,
                        content: streamMsg.accumulatedContent,
                        timestamp: new Date(),
                        type: 'chat',
                        mentions: [],
                        isPublic: true
                      }}
                      isUser={false}
                      isStreaming={true}
                      avatar={agentsRef.current.find((a) => a.id === streamMsg.agentId)?.avatar}
                      displayName={streamMsg.agentName}
                      roleLabel={agentsRef.current.find((a) => a.id === streamMsg.agentId)?.role}
                    />
                    {/* 流式消息中的图片（如果有） */}
                    {streamImages && streamImages.length > 0 && (
                      <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {streamImages.map((image, index) => (
                          <ImageViewer
                            key={`stream-${streamMsg.messageId}-img-${index}`}
                            src={image}
                            style={{
                              width: 'auto',
                              height: 'auto',
                              maxWidth: 280,
                              maxHeight: 280,
                              borderRadius: 8
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 底部控制区 */}
      <div className={styles.footer}>
        {/* 已选择的文件预览 */}
        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {selectedFiles.map((file, index) => {
              const displayName = FileManager.formatFileName(file)
              return (
                <Tag
                  key={`${file.id}-${index}`}
                  closable
                  onClose={() => handleRemoveFile(index)}
                  style={{ marginRight: 0 }}>
                  {displayName.length > 20 ? `${displayName.substring(0, 20)}...` : displayName}
                </Tag>
              )
            })}
          </div>
        )}
        {/* 始终显示输入栏，发送消息时自动开始群聊 */}
        <Space.Compact style={{ width: '100%' }}>
          <Tooltip title="添加附件">
            <Button icon={<PaperClipOutlined />} onClick={handleFileSelect} disabled={isLoading} />
          </Tooltip>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleSend}
            placeholder={agents.length < 2 ? '请添加至少 2 个助手...' : '输入消息，使用 @名称 提及特定助手...'}
            disabled={isLoading || agents.length < 2}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={isLoading || agents.length < 2}>
            发送
          </Button>
          {thinkingAgentIds.size > 0 && (
            <Tooltip title="中断正在进行的 Agent 响应">
              <Button icon={<StopOutlined />} onClick={handleInterrupt} type="default">
                中断
              </Button>
            </Tooltip>
          )}
          {isActive && (
            <Button icon={<PauseCircleOutlined />} onClick={handleEnd} danger>
              结束
            </Button>
          )}
        </Space.Compact>
      </div>

      {/* 任务确认模态框 */}
      <TaskConfirmationModal
        confirmation={pendingConfirmation}
        visible={pendingConfirmation !== null}
        onConfirm={handleConfirmTask}
        onReject={handleRejectTask}
      />
    </div>
  )
}

export default GroupChatPanel
