/**
 * 职责：提供原子化的、无状态的API调用函数
 */
import { loggerService } from '@logger'
import type { AiSdkMiddlewareConfig } from '@renderer/aiCore/middleware/AiSdkMiddlewareBuilder'
import { buildStreamTextParams } from '@renderer/aiCore/prepareParams'
import { isDedicatedImageGenerationModel, isEmbeddingModel, isFunctionCallingModel } from '@renderer/config/models'
import { getStoreSetting } from '@renderer/hooks/useSettings'
import i18n from '@renderer/i18n'
import store from '@renderer/store'
import type { Assistant, MCPServer, MCPTool, Model, Provider } from '@renderer/types'
import { type FetchChatCompletionParams, isSystemProvider } from '@renderer/types'
import type { StreamTextParams } from '@renderer/types/aiCoreTypes'
import { type Chunk, ChunkType } from '@renderer/types/chunk'
import type { Message, ResponseError } from '@renderer/types/newMessage'
import { removeSpecialCharactersForTopicName, uuid } from '@renderer/utils'
import { abortCompletion, readyToAbort } from '@renderer/utils/abortController'
import { isToolUseModeFunction } from '@renderer/utils/assistant'
import { isAbortError } from '@renderer/utils/error'
import { purifyMarkdownImages } from '@renderer/utils/markdown'
import { isPromptToolUse, isSupportedToolUse } from '@renderer/utils/mcp-tools'
import { findFileBlocks, getMainTextContent } from '@renderer/utils/messageUtils/find'
import { containsSupportedVariables, replacePromptVariables } from '@renderer/utils/prompt'
import { NOT_SUPPORT_API_KEY_PROVIDER_TYPES, NOT_SUPPORT_API_KEY_PROVIDERS } from '@renderer/utils/provider'
import { isEmpty, takeRight } from 'lodash'

import type { ModernAiProviderConfig } from '../aiCore/index_new'
import AiProviderNew from '../aiCore/index_new'
import {
  // getAssistantProvider,
  // getAssistantSettings,
  getDefaultAssistant,
  getDefaultModel,
  getProviderByModel,
  getQuickModel
} from './AssistantService'
import { ConversationService } from './ConversationService'
import { injectUserMessageWithKnowledgeSearchPrompt } from './KnowledgeService'
import type { BlockManager } from './messageStreaming'
import type { StreamProcessorCallbacks } from './StreamProcessingService'
import {
  createGetTaskStatusTool,
  createInvokeAgentToolWithAsync,
  isCollaborationEnabled
} from './AssistantInvocationService'
// import { processKnowledgeSearch } from './KnowledgeService'
// import {
//   filterContextMessages,
//   filterEmptyMessages,
//   filterUsefulMessages,
//   filterUserRoleStartMessages
// } from './MessagesService'
// import WebSearchService from './WebSearchService'

// FIXME: 这里太多重复逻辑，需要重构

const logger = loggerService.withContext('ApiService')

export async function fetchMcpTools(assistant: Assistant) {
  // Get MCP tools (Fix duplicate declaration)
  let mcpTools: MCPTool[] = [] // Initialize as empty array
  const allMcpServers = store.getState().mcp.servers || []
  const activedMcpServers = allMcpServers.filter((s) => s.isActive)
  const assistantMcpServers = (assistant.mcpServers || []) as MCPServer[]

  const enabledMCPs = activedMcpServers.filter((server) => assistantMcpServers.some((s) => s.id === server.id))

  if (enabledMCPs && enabledMCPs.length > 0) {
    try {
      const toolPromises = enabledMCPs.map(async (mcpServer: MCPServer) => {
        try {
          const tools = await window.api.mcp.listTools(mcpServer)
          return tools.filter((tool: any) => !mcpServer.disabledTools?.includes(tool.name))
        } catch (error) {
          logger.error(`Error fetching tools from MCP server ${mcpServer.name}:`, error as Error)
          return []
        }
      })
      const results = await Promise.allSettled(toolPromises)
      mcpTools = results
        .filter((result): result is PromiseFulfilledResult<MCPTool[]> => result.status === 'fulfilled')
        .map((result) => result.value)
        .flat()
    } catch (toolError) {
      logger.error('Error fetching MCP tools:', toolError as Error)
    }
  }
  return mcpTools
}

/**
 * 获取 VCP 插件工具（包括内置服务和外部插件）
 * VCP 工具将被转换为 MCPTool 格式，以便与现有中间件兼容
 *
 * 统一控制逻辑：
 * - 选择了 MCP 服务器 → 启用所有工具（包括 VCP 内置）
 * - 启用了 vcpConfig → 启用 VCP 内置工具
 * - 两者是 OR 关系，任一条件满足即启用
 */
export async function fetchVcpTools(assistant: Assistant): Promise<MCPTool[]> {
  // 统一控制：选择了 MCP 服务器 或 启用了 VCP 配置 → 工具调用启用
  // 兼容新旧字段：tools.mcpServers (新) 或 mcpServers (旧，已弃用)
  const mcpServers = assistant.tools?.mcpServers ?? assistant.mcpServers
  const hasMcpServers = (mcpServers?.length ?? 0) > 0
  const vcpConfigEnabled = assistant.vcpConfig?.enabled ?? false
  const toolsEnabled = hasMcpServers || vcpConfigEnabled

  if (!toolsEnabled) {
    logger.debug('Tools disabled for assistant (no MCP servers selected and VCP not enabled)', {
      assistantId: assistant.id
    })
    return []
  }

  try {
    // 获取 VCP 工具定义
    const result = await window.api.vcpTool.listDefinitions()

    if (!result.success || !result.data) {
      logger.debug('No VCP tools available or VCPRuntime not initialized')
      return []
    }

    // 将 VCP 工具定义转换为 MCPTool 格式
    const vcpTools: MCPTool[] = result.data.map((tool: any) => ({
      id: tool.id || tool.name,
      serverId: tool.serverId || 'vcp-runtime',
      name: tool.name,
      description: tool.description || '',
      serverName: tool.serverName || 'VCPRuntime',
      type: 'mcp' as const,
      inputSchema: tool.inputSchema || {
        type: 'object',
        properties:
          tool.parameters?.reduce(
            (acc: Record<string, any>, param: any) => {
              acc[param.name] = {
                type: param.type || 'string',
                description: param.description || ''
              }
              return acc
            },
            {} as Record<string, any>
          ) || {},
        required: tool.parameters?.filter((p: any) => p.required).map((p: any) => p.name) || []
      }
    }))

    logger.info('Fetched VCP tools', { count: vcpTools.length })
    return vcpTools
  } catch (error) {
    logger.error('Error fetching VCP tools:', error as Error)
    return []
  }
}

/**
 * 将用户消息转换为LLM可以理解的格式并发送请求
 * @param request - 包含消息内容和助手信息的请求对象
 * @param onChunkReceived - 接收流式响应数据的回调函数
 */
// 目前先按照函数来写,后续如果有需要到class的地方就改回来
export async function transformMessagesAndFetch(
  request: {
    messages: Message[]
    assistant: Assistant
    blockManager: BlockManager
    assistantMsgId: string
    callbacks: StreamProcessorCallbacks
    topicId?: string // 添加 topicId 用于 trace
    options: {
      signal?: AbortSignal
      timeout?: number
      headers?: Record<string, string>
    }
  },
  onChunkReceived: (chunk: Chunk) => void
) {
  const { messages, assistant } = request

  try {
    const { modelMessages, uiMessages } = await ConversationService.prepareMessagesForModel(messages, assistant)

    // replace prompt variables
    assistant.prompt = await replacePromptVariables(assistant.prompt, assistant.model?.name)

    // inject knowledge search prompt into model messages
    await injectUserMessageWithKnowledgeSearchPrompt({
      modelMessages,
      assistant,
      assistantMsgId: request.assistantMsgId,
      topicId: request.topicId,
      blockManager: request.blockManager,
      setCitationBlockId: request.callbacks.setCitationBlockId!
    })

    await fetchChatCompletion({
      messages: modelMessages,
      assistant: assistant,
      topicId: request.topicId,
      requestOptions: request.options,
      uiMessages,
      onChunkReceived
    })
  } catch (error: any) {
    onChunkReceived({ type: ChunkType.ERROR, error })
  }
}

export async function fetchChatCompletion({
  messages,
  prompt,
  assistant,
  requestOptions,
  onChunkReceived,
  topicId,
  uiMessages
}: FetchChatCompletionParams) {
  logger.info('fetchChatCompletion called with detailed context', {
    messageCount: messages?.length || 0,
    prompt: prompt,
    assistantId: assistant.id,
    topicId,
    hasTopicId: !!topicId,
    modelId: assistant.model?.id,
    modelName: assistant.model?.name
  })

  // Get base provider and apply API key rotation
  // NOTE: Shallow copy is intentional. Provider objects are not mutated by downstream code.
  // Nested properties (if any) are never modified after creation.
  const baseProvider = getProviderByModel(assistant.model || getDefaultModel())
  const providerWithRotatedKey = {
    ...baseProvider,
    apiKey: getRotatedApiKey(baseProvider)
  }

  const AI = new AiProviderNew(assistant.model || getDefaultModel(), providerWithRotatedKey)
  const provider = AI.getActualProvider()

  const mcpTools: MCPTool[] = []
  onChunkReceived({ type: ChunkType.LLM_RESPONSE_CREATED })

  if (isPromptToolUse(assistant) || isSupportedToolUse(assistant)) {
    mcpTools.push(...(await fetchMcpTools(assistant)))
  }

  // 获取 VCP 插件工具（包括内置服务）
  // VCP 工具独立于 MCP 工具获取，因为它们使用不同的协议
  // 注意：fetchVcpTools 内部检查 vcpConfig.enabled（默认 false）
  const vcpTools = await fetchVcpTools(assistant)
  if (vcpTools.length > 0) {
    mcpTools.push(...vcpTools)
    logger.info('Added VCP tools to request', { vcpToolCount: vcpTools.length, totalToolCount: mcpTools.length })
  }

  // 添加助手间调用工具（当启用协作功能时）
  if (isCollaborationEnabled(assistant) && (isPromptToolUse(assistant) || isSupportedToolUse(assistant))) {
    // 添加支持同步/异步模式的 invoke_agent 工具
    const invokeAgentTool = createInvokeAgentToolWithAsync(assistant.id)
    mcpTools.push(invokeAgentTool)
    // 添加异步任务状态查询工具
    const taskStatusTool = createGetTaskStatusTool()
    mcpTools.push(taskStatusTool)
    logger.debug('Added collaboration tools (invoke_agent, get_agent_task_status)', { assistantId: assistant.id })
  }
  if (prompt) {
    messages = [
      {
        role: 'user',
        content: prompt
      }
    ]
  }

  // 使用 transformParameters 模块构建参数
  const {
    params: aiSdkParams,
    modelId,
    capabilities,
    webSearchPluginConfig
  } = await buildStreamTextParams(messages, assistant, provider, {
    mcpTools: mcpTools,
    webSearchProviderId: assistant.webSearchProviderId,
    requestOptions
  })

  // Safely fallback to prompt tool use when function calling is not supported by model.
  const usePromptToolUse =
    isPromptToolUse(assistant) || (isToolUseModeFunction(assistant) && !isFunctionCallingModel(assistant.model))

  const middlewareConfig: AiSdkMiddlewareConfig = {
    streamOutput: assistant.settings?.streamOutput ?? true,
    onChunk: onChunkReceived,
    model: assistant.model,
    enableReasoning: capabilities.enableReasoning,
    isPromptToolUse: usePromptToolUse,
    isSupportedToolUse: isSupportedToolUse(assistant),
    isImageGenerationEndpoint: isDedicatedImageGenerationModel(assistant.model || getDefaultModel()),
    webSearchPluginConfig: webSearchPluginConfig,
    enableWebSearch: capabilities.enableWebSearch,
    enableGenerateImage: capabilities.enableGenerateImage,
    enableUrlContext: capabilities.enableUrlContext,
    mcpTools,
    uiMessages,
    knowledgeRecognition: assistant.knowledgeRecognition
  }

  // --- Call AI Completions ---
  await AI.completions(modelId, aiSdkParams, {
    ...middlewareConfig,
    assistant,
    topicId,
    callType: 'chat',
    uiMessages
  })
}

export async function fetchMessagesSummary({ messages, assistant }: { messages: Message[]; assistant: Assistant }) {
  let prompt = (getStoreSetting('topicNamingPrompt') as string) || i18n.t('prompts.title')
  const model = getQuickModel() || assistant?.model || getDefaultModel()

  if (prompt && containsSupportedVariables(prompt)) {
    prompt = await replacePromptVariables(prompt, model.name)
  }

  // 总结上下文总是取最后5条消息
  const contextMessages = takeRight(messages, 5)
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return null
  }

  // Apply API key rotation
  // NOTE: Shallow copy is intentional. Provider objects are not mutated by downstream code.
  // Nested properties (if any) are never modified after creation.
  const providerWithRotatedKey = {
    ...provider,
    apiKey: getRotatedApiKey(provider)
  }

  const AI = new AiProviderNew(model, providerWithRotatedKey)

  const topicId = messages?.find((message) => message.topicId)?.topicId || ''

  // LLM对多条消息的总结有问题，用单条结构化的消息表示会话内容会更好
  const structredMessages = contextMessages.map((message) => {
    const structredMessage = {
      role: message.role,
      mainText: purifyMarkdownImages(getMainTextContent(message))
    }

    // 让LLM知道消息中包含的文件，但只提供文件名
    // 对助手消息而言，没有提供工具调用结果等更多信息，仅提供文本上下文。
    const fileBlocks = findFileBlocks(message)
    let fileList: Array<string> = []
    if (fileBlocks.length && fileBlocks.length > 0) {
      fileList = fileBlocks.map((fileBlock) => fileBlock.file.origin_name)
    }
    return {
      ...structredMessage,
      files: fileList.length > 0 ? fileList : undefined
    }
  })
  const conversation = JSON.stringify(structredMessages)

  // // 复制 assistant 对象，并强制关闭思考预算
  // const summaryAssistant = {
  //   ...assistant,
  //   settings: {
  //     ...assistant.settings,
  //     reasoning_effort: undefined,
  //     qwenThinkMode: false
  //   }
  // }
  const summaryAssistant = {
    ...assistant,
    // Override type to prevent image generation path for text summary
    type: 'assistant',
    settings: {
      ...assistant.settings,
      reasoning_effort: undefined,
      qwenThinkMode: false
    },
    prompt,
    model
  }

  const llmMessages = {
    system: prompt,
    prompt: conversation
  }

  const middlewareConfig: AiSdkMiddlewareConfig = {
    streamOutput: false,
    enableReasoning: false,
    isPromptToolUse: false,
    isSupportedToolUse: false,
    isImageGenerationEndpoint: false,
    enableWebSearch: false,
    enableGenerateImage: false,
    enableUrlContext: false,
    mcpTools: []
  }
  try {
    // 从 messages 中找到有 traceId 的助手消息，用于绑定现有 trace
    const messageWithTrace = messages.find((m) => m.role === 'assistant' && m.traceId)

    if (messageWithTrace && messageWithTrace.traceId) {
      // 导入并调用 appendTrace 来绑定现有 trace，传入summary使用的模型名
      const { appendTrace } = await import('@renderer/services/SpanManagerService')
      await appendTrace({ topicId, traceId: messageWithTrace.traceId, model })
    }

    const { getText } = await AI.completions(model.id, llmMessages, {
      ...middlewareConfig,
      assistant: summaryAssistant,
      topicId,
      callType: 'summary'
    })
    const text = getText()
    return removeSpecialCharactersForTopicName(text) || null
  } catch (error: any) {
    return null
  }
}

export async function fetchNoteSummary({ content, assistant }: { content: string; assistant?: Assistant }) {
  let prompt = (getStoreSetting('topicNamingPrompt') as string) || i18n.t('prompts.title')
  const resolvedAssistant = assistant || getDefaultAssistant()
  const model = getQuickModel() || resolvedAssistant.model || getDefaultModel()

  if (prompt && containsSupportedVariables(prompt)) {
    prompt = await replacePromptVariables(prompt, model.name)
  }

  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return null
  }

  // Apply API key rotation
  // NOTE: Shallow copy is intentional. Provider objects are not mutated by downstream code.
  // Nested properties (if any) are never modified after creation.
  const providerWithRotatedKey = {
    ...provider,
    apiKey: getRotatedApiKey(provider)
  }

  const AI = new AiProviderNew(model, providerWithRotatedKey)

  // only 2000 char and no images
  const truncatedContent = content.substring(0, 2000)
  const purifiedContent = purifyMarkdownImages(truncatedContent)

  const summaryAssistant = {
    ...resolvedAssistant,
    // Override type to prevent image generation path for text summary
    type: 'assistant',
    settings: {
      ...resolvedAssistant.settings,
      reasoning_effort: undefined,
      qwenThinkMode: false
    },
    prompt,
    model
  }

  const llmMessages = {
    system: prompt,
    prompt: purifiedContent
  }

  const middlewareConfig: AiSdkMiddlewareConfig = {
    streamOutput: false,
    enableReasoning: false,
    isPromptToolUse: false,
    isSupportedToolUse: false,
    isImageGenerationEndpoint: false,
    enableWebSearch: false,
    enableGenerateImage: false,
    enableUrlContext: false,
    mcpTools: []
  }

  try {
    const { getText } = await AI.completions(model.id, llmMessages, {
      ...middlewareConfig,
      assistant: summaryAssistant,
      callType: 'summary'
    })
    const text = getText()
    return removeSpecialCharactersForTopicName(text) || null
  } catch (error: any) {
    return null
  }
}

// export async function fetchSearchSummary({ messages, assistant }: { messages: Message[]; assistant: Assistant }) {
//   const model = getQuickModel() || assistant.model || getDefaultModel()
//   const provider = getProviderByModel(model)

//   if (!hasApiKey(provider)) {
//     return null
//   }

//   const topicId = messages?.find((message) => message.topicId)?.topicId || undefined

//   const AI = new AiProvider(provider)

//   const params: CompletionsParams = {
//     callType: 'search',
//     messages: messages,
//     assistant,
//     streamOutput: false,
//     topicId
//   }

//   return await AI.completionsForTrace(params)
// }

export async function fetchGenerate({
  prompt,
  content,
  model,
  signal
}: {
  prompt: string
  content: string
  model?: Model
  signal?: AbortSignal
}): Promise<string> {
  if (!model) {
    model = getDefaultModel()
  }
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return ''
  }

  // Check if aborted before starting
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Apply API key rotation
  // NOTE: Shallow copy is intentional. Provider objects are not mutated by downstream code.
  // Nested properties (if any) are never modified after creation.
  const providerWithRotatedKey = {
    ...provider,
    apiKey: getRotatedApiKey(provider)
  }

  const AI = new AiProviderNew(model, providerWithRotatedKey)

  const assistant = getDefaultAssistant()
  assistant.model = model
  assistant.prompt = prompt

  // const params: CompletionsParams = {
  //   callType: 'generate',
  //   messages: content,
  //   assistant,
  //   streamOutput: false
  // }

  const middlewareConfig: AiSdkMiddlewareConfig = {
    streamOutput: assistant.settings?.streamOutput ?? false,
    enableReasoning: false,
    isPromptToolUse: false,
    isSupportedToolUse: false,
    isImageGenerationEndpoint: false,
    enableWebSearch: false,
    enableGenerateImage: false,
    enableUrlContext: false
  }

  try {
    const result = await AI.completions(
      model.id,
      {
        system: prompt,
        prompt: content,
        abortSignal: signal
      },
      {
        ...middlewareConfig,
        assistant,
        callType: 'generate'
      }
    )
    return result.getText() || ''
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error
    }
    return ''
  }
}

/**
 * 流式生成文本 - 支持边生成边回调
 */
export async function fetchGenerateStream({
  prompt,
  content,
  model,
  signal,
  onChunk
}: {
  prompt: string
  content: string
  model?: Model
  signal?: AbortSignal
  onChunk: (chunk: Chunk) => void
}): Promise<string> {
  if (!model) {
    model = getDefaultModel()
  }
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return ''
  }

  // Check if aborted before starting
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Apply API key rotation
  const providerWithRotatedKey = {
    ...provider,
    apiKey: getRotatedApiKey(provider)
  }

  const AI = new AiProviderNew(model, providerWithRotatedKey)

  const assistant = getDefaultAssistant()
  assistant.model = model
  assistant.prompt = prompt

  const middlewareConfig: AiSdkMiddlewareConfig = {
    streamOutput: true, // 强制启用流式输出
    enableReasoning: false,
    isPromptToolUse: false,
    isSupportedToolUse: false,
    isImageGenerationEndpoint: false,
    enableWebSearch: false,
    enableGenerateImage: false,
    enableUrlContext: false,
    onChunk // 传递流式回调
  }

  try {
    const result = await AI.completions(
      model.id,
      {
        system: prompt,
        prompt: content,
        abortSignal: signal
      },
      {
        ...middlewareConfig,
        assistant,
        callType: 'generate'
      }
    )
    return result.getText() || ''
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error
    }
    return ''
  }
}

export function hasApiKey(provider: Provider) {
  if (!provider) return false
  if (provider.id === 'cherryai') return true
  if (
    (isSystemProvider(provider) && NOT_SUPPORT_API_KEY_PROVIDERS.includes(provider.id)) ||
    NOT_SUPPORT_API_KEY_PROVIDER_TYPES.includes(provider.type)
  )
    return true
  return !isEmpty(provider.apiKey)
}

/**
 * Get rotated API key for providers that support multiple keys
 * Returns empty string for providers that don't require API keys
 */
function getRotatedApiKey(provider: Provider): string {
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

export async function fetchModels(provider: Provider): Promise<Model[]> {
  // Apply API key rotation
  // NOTE: Shallow copy is intentional. Provider objects are not mutated by downstream code.
  // Nested properties (if any) are never modified after creation.
  const providerWithRotatedKey = {
    ...provider,
    apiKey: getRotatedApiKey(provider)
  }

  const AI = new AiProviderNew(providerWithRotatedKey)

  try {
    return await AI.models()
  } catch (error) {
    logger.error('Failed to fetch models from provider', {
      providerId: provider.id,
      providerName: provider.name,
      error: error as Error
    })
    return []
  }
}

export function checkApiProvider(provider: Provider): void {
  const isExcludedProvider =
    (isSystemProvider(provider) && NOT_SUPPORT_API_KEY_PROVIDERS.includes(provider.id)) ||
    NOT_SUPPORT_API_KEY_PROVIDER_TYPES.includes(provider.type)

  if (!isExcludedProvider) {
    if (!provider.apiKey) {
      window.toast.error(i18n.t('message.error.enter.api.label'))
      throw new Error(i18n.t('message.error.enter.api.label'))
    }
  }

  if (!provider.apiHost && provider.type !== 'vertexai') {
    window.toast.error(i18n.t('message.error.enter.api.host'))
    throw new Error(i18n.t('message.error.enter.api.host'))
  }

  if (isEmpty(provider.models)) {
    window.toast.error(i18n.t('message.error.enter.model'))
    throw new Error(i18n.t('message.error.enter.model'))
  }
}

export async function checkApi(provider: Provider, model: Model, timeout = 15000): Promise<void> {
  checkApiProvider(provider)

  const ai = new AiProviderNew(model, provider)

  const assistant = getDefaultAssistant()
  assistant.model = model
  assistant.prompt = 'test' // 避免部分 provider 空系统提示词会报错

  if (isEmbeddingModel(model)) {
    // race 超时 15s
    logger.silly("it's a embedding model")
    const timerPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout'), timeout))
    await Promise.race([ai.getEmbeddingDimensions(model), timerPromise])
  } else {
    const abortId = uuid()
    const signal = readyToAbort(abortId)
    let streamError: ResponseError | undefined

    // 为文本流式分支添加超时控制
    const timeoutId = setTimeout(() => {
      abortCompletion(abortId)
    }, timeout)

    const params: StreamTextParams = {
      system: assistant.prompt,
      prompt: 'hi',
      abortSignal: signal
    }
    const config: ModernAiProviderConfig = {
      streamOutput: true,
      enableReasoning: false,
      isSupportedToolUse: false,
      isImageGenerationEndpoint: false,
      enableWebSearch: false,
      enableGenerateImage: false,
      isPromptToolUse: false,
      enableUrlContext: false,
      assistant,
      callType: 'check',
      onChunk: (chunk: Chunk) => {
        if (chunk.type === ChunkType.ERROR) {
          streamError = chunk.error
        } else {
          abortCompletion(abortId)
        }
      }
    }

    try {
      await ai.completions(model.id, params, config)
    } catch (e) {
      if (!isAbortError(e) && !isAbortError(streamError)) {
        throw streamError ?? e
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export async function checkModel(provider: Provider, model: Model, timeout = 15000): Promise<{ latency: number }> {
  const startTime = performance.now()
  await checkApi(provider, model, timeout)
  return { latency: performance.now() - startTime }
}
