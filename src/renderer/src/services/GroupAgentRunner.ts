/**
 * GroupAgentRunner - 群聊 Agent 执行器
 *
 * 负责在 Renderer 进程中调用 AI 服务生成 Agent 响应
 * 复用正常助手的调用链路 (AiProviderNew)
 * 支持角色感知的提示词生成
 * 支持图片助手（通过临时 Redux 消息块 + IndexedDB 持久化）
 */

import { loggerService } from '@logger'
import AiProviderNew from '@renderer/aiCore/index_new'
import type { AiSdkMiddlewareConfig } from '@renderer/aiCore/middleware/AiSdkMiddlewareBuilder'
import { isDedicatedImageGenerationModel } from '@renderer/config/models'
import db from '@renderer/databases'
import { getDefaultModel, getProviderByModel } from '@renderer/services/AssistantService'
import FileManager from '@renderer/services/FileManager'
import store from '@renderer/store'
import { removeManyBlocks, upsertOneBlock } from '@renderer/store/messageBlock'
import { type Assistant, isImageAssistant, type FileMetadata, type MCPTool, type Provider } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import {
  type MainTextMessageBlock,
  type Message,
  MessageBlockStatus,
  MessageBlockType,
  UserMessageStatus
} from '@renderer/types/newMessage'
import type { ImagePart, TextPart, UserModelMessage } from 'ai'
import { v4 as uuidv4 } from 'uuid'

const logger = loggerService.withContext('GroupAgentRunner')

/**
 * Agent 角色类型
 */
export type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'

/**
 * 其他参与者信息
 */
export interface OtherAgentInfo {
  name: string
  role: AgentRole
  expertise: string[]
}

/**
 * Agent 响应结果
 */
export interface AgentResponse {
  success: boolean
  content: string
  agentId: string
  agentName: string
  timestamp: Date
  /** 思考过程 */
  thinking?: string
  /** 工具调用 */
  toolCalls?: Array<{
    name: string
    arguments: Record<string, unknown>
    result?: unknown
  }>
  /** 图片输出 (图片助手) */
  images?: string[]
  /** 错误信息 */
  error?: string
  /** 错误类型 */
  errorType?: 'json_parse_error' | 'auth_error' | 'timeout' | 'network_error' | 'unknown'
  /** Token 使用 */
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
}

/**
 * Agent 运行配置
 */
export interface AgentRunConfig {
  /** Agent ID */
  agentId: string
  /** Agent 名称 */
  agentName: string
  /** 关联的 Assistant */
  assistant: Assistant
  /** Provider */
  provider: Provider
  /** 当前用户输入 */
  userInput: string
  /** 系统提示词覆盖 */
  systemPromptOverride?: string
  /** 最大 tokens */
  maxTokens?: number
  /** 温度 */
  temperature?: number
  /** 是否流式输出 */
  stream?: boolean
  /** 流式回调 */
  onStream?: (chunk: string) => void
  /** 中止信号 */
  abortSignal?: AbortSignal

  // === 角色感知配置 (新增) ===
  /** Agent 角色 */
  role?: AgentRole
  /** 专业领域 */
  expertise?: string[]
  /** 触发关键词 */
  triggerKeywords?: string[]
  /** 当前话题 */
  currentTopic?: string
  /** 其他参与者 */
  otherAgents?: OtherAgentInfo[]
  /** 邀请发言提示词模板，支持 {{AgentName}} 占位符 */
  invitePrompt?: string

  // === Tool Use 配置 (Agent 协同) ===
  /** MCP 工具列表（包括 invoke_agent 工具） */
  mcpTools?: MCPTool[]
  /** 是否启用工具调用 */
  enableToolUse?: boolean
  /** 工具调用结果处理回调 */
  onToolCall?: (toolName: string, toolArgs: Record<string, unknown>) => Promise<unknown>

  // === 附件配置 (新增) ===
  /** 附件文件列表 */
  files?: FileMetadata[]
}

/**
 * 任务确认请求
 */
export interface TaskConfirmation {
  taskId: string
  agentId: string
  agentName: string
  taskDescription: string
  estimatedAction: 'respond' | 'ask' | 'summarize' | 'delegate' | 'conclude'
  priority: number
  timestamp: Date
}

/**
 * 任务确认回调
 */
export type TaskConfirmationCallback = (confirmation: TaskConfirmation) => Promise<boolean>

/**
 * GroupAgentRunner - 执行 Agent AI 调用
 * 复用正常助手的调用链路
 */
export class GroupAgentRunner {
  private taskConfirmationCallback?: TaskConfirmationCallback
  private runningTasks: Map<string, AbortController> = new Map()

  /**
   * 设置任务确认回调
   */
  setTaskConfirmationCallback(callback: TaskConfirmationCallback): void {
    this.taskConfirmationCallback = callback
  }

  /**
   * 运行 Agent 并获取响应
   * 使用与正常助手相同的调用链路 (类似 fetchGenerate)
   */
  async runAgent(config: AgentRunConfig): Promise<AgentResponse> {
    const taskId = uuidv4()
    const abortController = new AbortController()

    // 注册任务
    this.runningTasks.set(taskId, abortController)

    // 用于累积流式输出
    let accumulatedContent = ''
    let accumulatedThinking = ''
    const accumulatedImages: string[] = []
    let accumulatedError: string | undefined

    // 用于清理临时块（图片生成时创建）
    const tempBlockIds: string[] = []

    try {
      // 任务确认流程
      if (this.taskConfirmationCallback) {
        const confirmation: TaskConfirmation = {
          taskId,
          agentId: config.agentId,
          agentName: config.agentName,
          taskDescription: `回应用户输入: ${config.userInput.slice(0, 100)}...`,
          estimatedAction: 'respond',
          priority: 50,
          timestamp: new Date()
        }

        const confirmed = await this.taskConfirmationCallback(confirmation)
        if (!confirmed) {
          return {
            success: false,
            content: '',
            agentId: config.agentId,
            agentName: config.agentName,
            timestamp: new Date(),
            error: '任务被用户拒绝'
          }
        }
      }

      // 构建修改后的助手配置（带角色感知提示词）
      const modifiedAssistant = this.buildModifiedAssistant(config)

      // 确保有有效的模型
      const model = modifiedAssistant.model || getDefaultModel()

      // 获取 Provider（复用正常助手的方式）
      // 优先使用传入的 provider，否则根据模型获取
      const baseProvider = config.provider || getProviderByModel(model)
      const providerWithRotatedKey = {
        ...baseProvider,
        apiKey: this.getRotatedApiKey(baseProvider)
      }

      // 使用与正常助手相同的 AiProviderNew
      const AI = new AiProviderNew(model, providerWithRotatedKey)

      // 构建 chunk 回调
      const onChunkReceived = (chunk: { type: ChunkType; text?: string; image?: unknown; error?: unknown }) => {
        if (chunk.type === ChunkType.TEXT_DELTA && chunk.text) {
          accumulatedContent += chunk.text
          config.onStream?.(chunk.text)
        } else if (chunk.type === ChunkType.THINKING_DELTA && chunk.text) {
          accumulatedThinking += chunk.text
        } else if (chunk.type === ChunkType.IMAGE_COMPLETE && chunk.image) {
          const imageData = chunk.image as { type: string; images: string[] }
          if (imageData.images && Array.isArray(imageData.images)) {
            accumulatedImages.push(...imageData.images)
            logger.info('Image generated', { count: imageData.images.length })
          }
        } else if (chunk.type === ChunkType.ERROR && chunk.error) {
          const errorData = chunk.error as { message?: string; code?: string }
          accumulatedError = errorData.message || errorData.code || '未知错误'
          logger.warn('Error chunk received', { error: accumulatedError })
        }
      }

      // 检查是否是图片生成模型或图片助手
      // 1. isDedicatedImageGenerationModel: dall-e, grok-2-image 等专用图片生成模型
      // 2. isImageAssistant: 用户配置的 type='image' 的助手 (如 gemini-3-pro-image)
      const isImageGenerationEndpoint = isDedicatedImageGenerationModel(model) || isImageAssistant(modifiedAssistant)

      // 为图片生成模型构建 uiMessages（带 Redux 存储的 blocks + IndexedDB 持久化）
      let uiMessages: Message[] | undefined

      if (isImageGenerationEndpoint) {
        const messageId = uuidv4()
        const blockId = uuidv4()
        const topicId = `groupchat_${config.agentId}`
        const now = new Date().toISOString()

        // 创建临时文本块
        const tempTextBlock: MainTextMessageBlock = {
          id: blockId,
          messageId: messageId,
          type: MessageBlockType.MAIN_TEXT,
          content: config.userInput,
          createdAt: now,
          status: MessageBlockStatus.SUCCESS
        }

        // 1. 存储到 Redux（用于 getMainTextContent 读取）
        store.dispatch(upsertOneBlock(tempTextBlock))
        tempBlockIds.push(blockId)

        // 2. 持久化到 IndexedDB（可选，群聊消息持久化）
        try {
          await db.message_blocks.put(tempTextBlock)
          logger.debug('Temp block persisted to IndexedDB', { blockId, messageId })
        } catch (dbError) {
          logger.warn('Failed to persist temp block to IndexedDB', { error: dbError })
          // 不中断流程，Redux 中已有数据足够使用
        }

        // 构建 Message 对象（引用 Redux 中的 block）
        uiMessages = [
          {
            id: messageId,
            role: 'user',
            assistantId: modifiedAssistant.id,
            topicId: topicId,
            createdAt: now,
            status: UserMessageStatus.SUCCESS,
            blocks: [blockId] // 关键：引用 Redux 中的 block ID
          }
        ]

        logger.info('Created temp message with Redux block for image generation', {
          messageId,
          blockId,
          userInput: config.userInput.slice(0, 50) + '...'
        })
      }

      // 判断是否启用工具调用
      const enableToolUse = config.enableToolUse && config.mcpTools && config.mcpTools.length > 0

      // 构建中间件配置 (与 fetchChatCompletion 相同)
      const middlewareConfig: AiSdkMiddlewareConfig = {
        streamOutput: config.stream ?? true,
        onChunk: onChunkReceived,
        model: model,
        enableReasoning: false,
        isPromptToolUse: false,
        isSupportedToolUse: enableToolUse ?? false,
        isImageGenerationEndpoint,
        enableWebSearch: false,
        enableGenerateImage: isImageGenerationEndpoint,
        enableUrlContext: false,
        uiMessages,
        mcpTools: enableToolUse ? config.mcpTools : undefined
      }

      // 处理附件文件：检查是否有图片需要多模态处理
      let effectiveUserInput = config.userInput
      let useMultimodalFormat = false
      let multimodalMessage: UserModelMessage | null = null

      if (config.files && config.files.length > 0) {
        // 尝试构建多模态消息（如果有图片文件）
        const multimodalResult = await this.buildMultimodalMessage(config.userInput, config.files)

        if (multimodalResult.hasImages && multimodalResult.message) {
          // 有图片，使用多模态格式
          useMultimodalFormat = true
          multimodalMessage = multimodalResult.message
          logger.info('Using multimodal format for AI call', {
            fileCount: config.files.length,
            hasImages: true
          })
        } else {
          // 没有图片，只提取文本内容
          const fileContents = await this.extractFileContents(config.files)
          if (fileContents) {
            effectiveUserInput = `${config.userInput}\n\n---\n附件内容:\n${fileContents}`
            logger.info('Files content extracted and appended', {
              fileCount: config.files.length,
              contentLength: fileContents.length
            })
          }
        }
      }

      // 调用 AI
      logger.info('Calling AI with normal assistant pipeline', {
        agentId: config.agentId,
        modelId: model.id,
        providerId: baseProvider.id,
        isImageGenerationEndpoint,
        isImageAssistant: isImageAssistant(modifiedAssistant),
        enableToolUse,
        toolCount: config.mcpTools?.length ?? 0,
        useMultimodalFormat
      })

      // 根据是否有图片选择不同的调用格式
      if (useMultimodalFormat && multimodalMessage) {
        // 多模态格式：使用 prompt 数组
        await AI.completions(
          model.id,
          {
            system: modifiedAssistant.prompt || '',
            prompt: [multimodalMessage]
          },
          {
            ...middlewareConfig,
            assistant: modifiedAssistant,
            topicId: `groupchat_${config.agentId}`,
            callType: 'chat'
          }
        )
      } else {
        // 简单格式：使用纯文本
        await AI.completions(
          model.id,
          {
            system: modifiedAssistant.prompt || '',
            prompt: effectiveUserInput
          },
          {
            ...middlewareConfig,
            assistant: modifiedAssistant,
            topicId: `groupchat_${config.agentId}`,
            callType: 'chat'
          }
        )
      }

      // 处理结果
      return this.processResult(config, accumulatedContent, accumulatedThinking, accumulatedImages, accumulatedError)
    } catch (error) {
      logger.error('Agent run failed', error as Error)
      return this.handleError(error as Error, config)
    } finally {
      this.runningTasks.delete(taskId)

      // 清理临时消息块（图片生成时创建的）
      if (tempBlockIds.length > 0) {
        try {
          // 从 Redux 中移除
          store.dispatch(removeManyBlocks(tempBlockIds))
          // 从 IndexedDB 中移除
          await db.message_blocks.bulkDelete(tempBlockIds)
          logger.debug('Cleaned up temp blocks', { blockIds: tempBlockIds })
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp blocks', { error: cleanupError })
        }
      }
    }
  }

  /**
   * Get rotated API key for providers that support multiple keys
   * (复制自 ApiService.ts)
   */
  private getRotatedApiKey(provider: Provider): string {
    // Handle providers that don't require API keys
    if (!provider.apiKey || provider.apiKey.trim() === '') {
      return ''
    }

    const keys = provider.apiKey
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)

    if (keys.length === 0) {
      return ''
    }

    const keyName = `provider:${provider.id}:last_used_key`

    // If only one key, return it directly
    if (keys.length === 1) {
      return keys[0]
    }

    const lastUsedKey = window.keyv.get(keyName)
    if (!lastUsedKey) {
      window.keyv.set(keyName, keys[0])
      return keys[0]
    }

    const currentIndex = keys.indexOf(lastUsedKey)

    // Log when the last used key is no longer in the list
    if (currentIndex === -1) {
      logger.debug('Last used API key no longer found in provider keys, falling back to first key', {
        providerId: provider.id,
        lastUsedKey: lastUsedKey.substring(0, 8) + '...' // Only log first 8 chars for security
      })
    }

    const nextIndex = (currentIndex + 1) % keys.length
    const nextKey = keys[nextIndex]
    window.keyv.set(keyName, nextKey)

    return nextKey
  }

  /**
   * 提取文件内容
   * 支持文本文件、代码文件等可读取的文件类型
   */
  private async extractFileContents(files: FileMetadata[]): Promise<string | null> {
    if (!files || files.length === 0) return null

    const textExtensions = [
      '.txt',
      '.md',
      '.json',
      '.xml',
      '.csv',
      '.html',
      '.htm',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.css',
      '.scss',
      '.less',
      '.sass',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.cfg',
      '.conf',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.ps1',
      '.bat',
      '.cmd',
      '.sql',
      '.graphql',
      '.gql',
      '.vue',
      '.svelte',
      '.astro',
      '.rs',
      '.go',
      '.rb',
      '.php',
      '.swift',
      '.kt',
      '.kts',
      '.log',
      '.env',
      '.gitignore',
      '.dockerignore'
    ]

    const contents: string[] = []

    for (const file of files) {
      try {
        const ext = file.ext?.toLowerCase() || ''

        // 检查是否是支持的文本文件类型
        if (!textExtensions.includes(ext)) {
          // 非文本文件，添加文件信息摘要
          contents.push(`[文件: ${file.origin_name || file.name}${ext} (${this.formatFileSize(file.size || 0)})]`)
          continue
        }

        // 读取文本文件内容
        const fileContent = await this.readFileContent(file)
        if (fileContent) {
          const fileName = file.origin_name || file.name || 'unknown'
          contents.push(`### ${fileName}${ext}\n\`\`\`\n${fileContent}\n\`\`\``)
        }
      } catch (error) {
        logger.warn('Failed to extract file content', {
          fileName: file.name,
          error: (error as Error).message
        })
        contents.push(`[文件: ${file.origin_name || file.name} (读取失败)]`)
      }
    }

    return contents.length > 0 ? contents.join('\n\n') : null
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(file: FileMetadata): Promise<string | null> {
    try {
      // 使用 FileManager 读取 base64 内容
      const base64Content = await FileManager.readBase64File(file)
      if (!base64Content) return null

      // 从 base64 解码为文本
      // base64Content 格式可能是 "data:text/plain;base64,xxxx" 或直接是 base64 字符串
      const base64Data = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content

      // 解码 base64
      const decodedContent = atob(base64Data)

      // 限制内容长度（避免过长的文件内容）
      const maxLength = 10000
      if (decodedContent.length > maxLength) {
        return decodedContent.substring(0, maxLength) + '\n... (内容已截断)'
      }

      return decodedContent
    } catch (error) {
      logger.warn('Failed to read file content', {
        fileName: file.name,
        error: (error as Error).message
      })
      return null
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 图片文件扩展名
   */
  private static readonly IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']

  /**
   * 检查文件是否是图片
   */
  private isImageFile(file: FileMetadata): boolean {
    const ext = file.ext?.toLowerCase() || ''
    return GroupAgentRunner.IMAGE_EXTENSIONS.includes(ext)
  }

  /**
   * 提取图片文件并转换为 ImagePart 格式
   * 用于多模态 AI 调用
   */
  private async extractImageParts(files: FileMetadata[]): Promise<ImagePart[]> {
    if (!files || files.length === 0) return []

    const imageParts: ImagePart[] = []
    const imageFiles = files.filter((f) => this.isImageFile(f))

    for (const file of imageFiles) {
      try {
        // 使用 window.api.file.base64Image 获取图片的 base64 数据
        const imageData = await window.api.file.base64Image(file.id + file.ext)
        if (imageData && imageData.base64) {
          imageParts.push({
            type: 'image',
            image: imageData.base64,
            mediaType: imageData.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | undefined
          })
          logger.debug('Image file converted to base64', {
            fileName: file.origin_name || file.name,
            mimeType: imageData.mime
          })
        }
      } catch (error) {
        logger.warn('Failed to convert image file to base64', {
          fileName: file.origin_name || file.name,
          error: (error as Error).message
        })
      }
    }

    return imageParts
  }

  /**
   * 构建多模态消息（包含文本和图片）
   * 当有图片文件时，需要使用 UserModelMessage 格式
   */
  private async buildMultimodalMessage(
    textContent: string,
    files: FileMetadata[]
  ): Promise<{ hasImages: boolean; message: UserModelMessage | null }> {
    // 提取图片部分
    const imageParts = await this.extractImageParts(files)

    if (imageParts.length === 0) {
      return { hasImages: false, message: null }
    }

    // 提取非图片文件的文本内容
    const nonImageFiles = files.filter((f) => !this.isImageFile(f))
    let effectiveText = textContent

    if (nonImageFiles.length > 0) {
      const fileContents = await this.extractFileContents(nonImageFiles)
      if (fileContents) {
        effectiveText = `${textContent}\n\n---\n附件内容:\n${fileContents}`
      }
    }

    // 构建多模态消息
    const content: Array<TextPart | ImagePart> = [{ type: 'text', text: effectiveText }, ...imageParts]

    const message: UserModelMessage = {
      role: 'user',
      content
    }

    logger.info('Built multimodal message', {
      textLength: effectiveText.length,
      imageCount: imageParts.length
    })

    return { hasImages: true, message }
  }

  /**
   * 构建修改后的助手配置
   * 包含角色感知的系统提示词
   */
  private buildModifiedAssistant(config: AgentRunConfig): Assistant {
    // 原始系统提示词
    const originalPrompt = config.systemPromptOverride || config.assistant.prompt || ''

    // 构建角色感知的系统提示词
    const groupChatContext = this.buildRoleAwarePrompt(config, originalPrompt)

    // 确保 assistant 有有效的 model
    const model = config.assistant.model || getDefaultModel()

    return {
      ...config.assistant,
      prompt: groupChatContext,
      model: model
    }
  }

  /**
   * 构建角色感知的系统提示词
   */
  private buildRoleAwarePrompt(config: AgentRunConfig, originalPrompt: string): string {
    const parts: string[] = []

    // 1. 身份声明
    parts.push(`你是 ${config.agentName}。`)

    // 2. 角色描述
    const roleDescription = this.getRoleDescription(config.role || 'participant')
    parts.push(roleDescription)

    // 3. 专业领域 (如果有)
    if (config.expertise && config.expertise.length > 0) {
      parts.push(`你的专业领域包括：${config.expertise.join('、')}。在这些领域，你可以提供深入的见解。`)
    }

    // 4. 当前话题 (如果有)
    if (config.currentTopic) {
      parts.push(`当前讨论话题：${config.currentTopic}`)
    }

    // 5. 其他参与者 (如果有)
    if (config.otherAgents && config.otherAgents.length > 0) {
      const participantInfo = config.otherAgents
        .map((a) => {
          const expertiseStr = a.expertise.length > 0 ? `，专长: ${a.expertise.join('、')}` : ''
          return `- ${a.name} (${this.getRoleLabel(a.role)})${expertiseStr}`
        })
        .join('\n')
      parts.push(`## 其他参与者\n${participantInfo}`)
    }

    // 6. 协作指南（增强，避免重复介绍）
    parts.push(`## 群聊协作指南
1. 尊重其他参与者的观点，即使你不同意
2. 当被 @ 提及时，请及时回应
3. 如果需要特定专家的意见，可以使用 @名字 来提及他们
4. 保持回复简洁有针对性，避免长篇大论
5. 直接回复内容即可，不需要在开头加上你的名字
6. **重要**：不要重复自我介绍。如果你已经在之前的对话中介绍过自己，直接回应当前话题即可
7. **重要**：避免在每次回复开头说"你好"或类似的问候语，除非是首次加入对话`)

    // 7. 原始提示词 (个性化设定)
    if (originalPrompt.trim()) {
      parts.push(`## 你的核心指令\n${originalPrompt}`)
    }

    // 8. 邀请发言提示词 (VCP风格) - 优化以避免触发重复介绍
    if (config.invitePrompt) {
      const formattedInvite = config.invitePrompt
        .replace(/\{\{VCPChatAgentName\}\}/g, config.agentName)
        .replace(/\{\{AgentName\}\}/g, config.agentName)
      parts.push(`\n${formattedInvite}`)
    } else {
      parts.push(`\n请根据对话上下文直接给出你的回应，无需重复介绍自己。`)
    }

    return parts.join('\n\n')
  }

  /**
   * 获取角色描述
   */
  private getRoleDescription(role: AgentRole): string {
    const descriptions: Record<AgentRole, string> = {
      host: '你是本次群聊的主持人，负责引导讨论、协调各方观点、确保对话有序进行。',
      moderator: '你是本次群聊的协调者，负责调解分歧、总结观点、推动共识形成。',
      expert: '你是本次群聊的专家顾问，在你的专业领域提供深入、专业的见解和建议。',
      participant: '你是本次群聊的积极参与者，分享你的观点和想法，与其他成员进行建设性对话。',
      observer: '你是本次群聊的观察者，主要聆听和学习，只在必要时发言。'
    }
    return descriptions[role] || descriptions.participant
  }

  /**
   * 获取角色标签
   */
  private getRoleLabel(role: AgentRole): string {
    const labels: Record<AgentRole, string> = {
      host: '主持人',
      moderator: '协调者',
      expert: '专家',
      participant: '参与者',
      observer: '观察者'
    }
    return labels[role] || '参与者'
  }

  /**
   * 处理 AI 响应结果
   */
  private processResult(
    config: AgentRunConfig,
    accumulatedContent: string,
    accumulatedThinking: string,
    accumulatedImages: string[] = [],
    accumulatedError?: string
  ): AgentResponse {
    // 如果有累积的错误，直接返回错误响应
    if (accumulatedError) {
      return {
        success: false,
        content: '',
        agentId: config.agentId,
        agentName: config.agentName,
        timestamp: new Date(),
        error: accumulatedError,
        errorType: 'unknown'
      }
    }

    // 对于图片助手，如果有图片但没有文本内容，生成描述性内容
    let finalContent = accumulatedContent
    if (!finalContent && accumulatedImages.length > 0) {
      finalContent = `已生成 ${accumulatedImages.length} 张图片`
    }

    // 检查是否有有效内容
    if (!finalContent && accumulatedImages.length === 0) {
      logger.warn('AI returned empty response', {
        agentId: config.agentId,
        provider: config.provider?.name
      })
      return {
        success: false,
        content: '',
        agentId: config.agentId,
        agentName: config.agentName,
        timestamp: new Date(),
        error: `AI 返回了空响应，请重试或检查模型配置。Provider: ${config.provider?.name || '未知'}`,
        errorType: 'unknown'
      }
    }

    return {
      success: true,
      content: finalContent,
      agentId: config.agentId,
      agentName: config.agentName,
      timestamp: new Date(),
      thinking: accumulatedThinking || undefined,
      images: accumulatedImages.length > 0 ? accumulatedImages : undefined
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Error, config: AgentRunConfig): AgentResponse {
    const rawMessage = error.message || ''
    let errorMessage = rawMessage || '未知错误'
    let errorType: AgentResponse['errorType'] = 'unknown'

    // 分析错误类型
    if (rawMessage.includes('<!doctype') || rawMessage.includes('<!DOCTYPE') || rawMessage.includes('<html')) {
      const providerHost = config.provider?.apiHost || ''
      if (providerHost.includes('/models') || providerHost.includes('/v1/')) {
        errorMessage = `API 代理配置错误: API Host 不应包含路径后缀。当前配置: "${providerHost}"`
      } else {
        errorMessage = `API 服务返回了 HTML 页面而非 JSON。请检查 Provider "${config.provider?.name || '未知'}" 的配置`
      }
      errorType = 'json_parse_error'
    } else if (rawMessage.includes('JSON') || rawMessage.includes('Unexpected token')) {
      errorMessage = `服务器返回了非 JSON 格式的响应。请检查 Provider "${config.provider?.name || '未知'}" 的 API 地址配置`
      errorType = 'json_parse_error'
    } else if (rawMessage.includes('Failed to fetch') || rawMessage.includes('fetch')) {
      errorMessage = `网络请求失败。请检查 Provider "${config.provider?.name || '未知'}" 的连接状态`
      errorType = 'network_error'
    } else if (rawMessage.includes('401') || rawMessage.includes('Unauthorized')) {
      errorMessage = 'API Key 无效或已过期'
      errorType = 'auth_error'
    } else if (rawMessage.includes('403') || rawMessage.includes('Forbidden')) {
      errorMessage = '访问被拒绝，请检查 API 权限'
      errorType = 'auth_error'
    } else if (rawMessage.includes('timeout') || rawMessage.includes('ETIMEDOUT')) {
      errorMessage = '请求超时'
      errorType = 'timeout'
    } else if (rawMessage.includes('ECONNREFUSED') || rawMessage.includes('ENOTFOUND')) {
      errorMessage = '网络连接失败'
      errorType = 'network_error'
    } else if (rawMessage.includes('429') || rawMessage.includes('rate limit')) {
      errorMessage = 'API 请求频率超限，请稍后重试'
    } else if (rawMessage.includes('500') || rawMessage.includes('Internal Server Error')) {
      errorMessage = 'API 服务器内部错误'
    }

    return {
      success: false,
      content: '',
      agentId: config.agentId,
      agentName: config.agentName,
      timestamp: new Date(),
      error: errorMessage,
      errorType
    }
  }

  /**
   * 取消运行中的任务
   */
  cancelTask(taskId: string): boolean {
    const controller = this.runningTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(taskId)
      return true
    }
    return false
  }

  /**
   * 取消所有任务
   */
  cancelAllTasks(): void {
    for (const [, controller] of this.runningTasks) {
      controller.abort()
    }
    this.runningTasks.clear()
  }

  /**
   * 获取运行中的任务数
   */
  getRunningTaskCount(): number {
    return this.runningTasks.size
  }
}

// 单例
let _instance: GroupAgentRunner | null = null

export function getGroupAgentRunner(): GroupAgentRunner {
  if (!_instance) {
    _instance = new GroupAgentRunner()
  }
  return _instance
}
