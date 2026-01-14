/**
 * 参数构建模块
 * 构建AI SDK的流式和非流式参数
 */

import { anthropic } from '@ai-sdk/anthropic'
import { azure } from '@ai-sdk/azure'
import { google } from '@ai-sdk/google'
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic/edge'
import { vertex } from '@ai-sdk/google-vertex/edge'
import { combineHeaders } from '@ai-sdk/provider-utils'
import type { AnthropicSearchConfig, WebSearchPluginConfig } from '@cherrystudio/ai-core/built-in/plugins'
import { isBaseProvider } from '@cherrystudio/ai-core/core/providers/schemas'
import type { BaseProviderId } from '@cherrystudio/ai-core/provider'
import { loggerService } from '@logger'
import {
  isAnthropicModel,
  isFixedReasoningModel,
  isGeminiModel,
  isGenerateImageModel,
  isGrokModel,
  isOpenAIModel,
  isOpenRouterBuiltInWebSearchModel,
  isPureGenerateImageModel,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenModel,
  isWebSearchModel
} from '@renderer/config/models'
import { getDefaultModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import type { CherryWebSearchConfig } from '@renderer/store/websearch'
import type { Model } from '@renderer/types'
import { type Assistant, type MCPTool, type Provider, SystemProviderIds } from '@renderer/types'
import type { StreamTextParams } from '@renderer/types/aiCoreTypes'
import { mapRegexToPatterns } from '@renderer/utils/blacklistMatchPattern'
import { replacePromptVariables } from '@renderer/utils/prompt'
import { isAIGatewayProvider, isAwsBedrockProvider, isSupportUrlContextProvider } from '@renderer/utils/provider'
import type { ModelMessage, Tool } from 'ai'
import { stepCountIs } from 'ai'

import { getAiSdkProviderId } from '../provider/factory'
import { convertMcpToolsToVCPDescription, generateVCPProtocolGuide } from '../utils/mcp'
import { buildProviderOptions } from '../utils/options'
import { buildProviderBuiltinWebSearchConfig } from '../utils/websearch'
import { addAnthropicHeaders } from './header'
import { getMaxTokens, getTemperature, getTopP } from './modelParameters'

const logger = loggerService.withContext('parameterBuilder')

type ProviderDefinedTool = Extract<Tool<any, any>, { type: 'provider-defined' }>

function mapVertexAIGatewayModelToProviderId(model: Model): BaseProviderId | undefined {
  if (isAnthropicModel(model)) {
    return 'anthropic'
  }
  if (isGeminiModel(model)) {
    return 'google'
  }
  if (isGrokModel(model)) {
    return 'xai'
  }
  if (isOpenAIModel(model)) {
    return 'openai'
  }
  logger.warn(
    `[mapVertexAIGatewayModelToProviderId] Unknown model type for AI Gateway: ${model.id}. Web search will not be enabled.`
  )
  return undefined
}

/**
 * 构建 AI SDK 流式参数
 * 这是主要的参数构建函数，整合所有转换逻辑
 */
export async function buildStreamTextParams(
  sdkMessages: StreamTextParams['messages'] = [],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    webSearchProviderId?: string
    webSearchConfig?: CherryWebSearchConfig
    requestOptions?: {
      signal?: AbortSignal
      timeout?: number
      headers?: Record<string, string>
    }
  }
): Promise<{
  params: StreamTextParams
  modelId: string
  capabilities: {
    enableReasoning: boolean
    enableWebSearch: boolean
    enableGenerateImage: boolean
    enableUrlContext: boolean
  }
  webSearchPluginConfig?: WebSearchPluginConfig
}> {
  const { mcpTools } = options

  const model = assistant.model || getDefaultModel()
  const aiSdkProviderId = getAiSdkProviderId(provider)

  // 这三个变量透传出来，交给下面启用插件/中间件
  // 也可以在外部构建好再传入buildStreamTextParams
  // FIXME: qwen3即使关闭思考仍然会导致enableReasoning的结果为true
  const enableReasoning =
    ((isSupportedThinkingTokenModel(model) || isSupportedReasoningEffortModel(model)) &&
      assistant.settings?.reasoning_effort !== undefined) ||
    isFixedReasoningModel(model)

  // 判断是否使用内置搜索
  // 条件：没有外部搜索提供商 && (用户开启了内置搜索 || 模型强制使用内置搜索)
  const hasExternalSearch = !!options.webSearchProviderId
  const enableWebSearch =
    !hasExternalSearch &&
    ((assistant.enableWebSearch && isWebSearchModel(model)) ||
      isOpenRouterBuiltInWebSearchModel(model) ||
      model.id.includes('sonar'))

  // Validate provider and model support to prevent stale state from triggering urlContext
  const enableUrlContext = !!(
    assistant.enableUrlContext &&
    isSupportUrlContextProvider(provider) &&
    !isPureGenerateImageModel(model) &&
    (isGeminiModel(model) || isAnthropicModel(model))
  )

  const enableGenerateImage = !!(isGenerateImageModel(model) && assistant.enableGenerateImage)

  // VCP 统一协议：不再使用 AI SDK 原生工具调用 MCP 工具
  // MCP 工具将通过 VCP 协议格式注入到系统提示词中
  // 只保留 Provider 内置工具（搜索、URL 上下文等）
  let providerBuiltinTools: Record<string, Tool<any, any>> | undefined = undefined

  // 构建真正的 providerOptions
  const webSearchConfig: CherryWebSearchConfig = {
    maxResults: store.getState().websearch.maxResults,
    excludeDomains: store.getState().websearch.excludeDomains,
    searchWithTime: store.getState().websearch.searchWithTime
  }

  const { providerOptions, standardParams } = buildProviderOptions(assistant, model, provider, {
    enableReasoning,
    enableWebSearch,
    enableGenerateImage
  })

  let webSearchPluginConfig: WebSearchPluginConfig | undefined = undefined
  if (enableWebSearch) {
    if (isBaseProvider(aiSdkProviderId)) {
      webSearchPluginConfig = buildProviderBuiltinWebSearchConfig(aiSdkProviderId, webSearchConfig, model)
    } else if (isAIGatewayProvider(provider) || SystemProviderIds.gateway === provider.id) {
      const aiSdkProviderId = mapVertexAIGatewayModelToProviderId(model)
      if (aiSdkProviderId) {
        webSearchPluginConfig = buildProviderBuiltinWebSearchConfig(aiSdkProviderId, webSearchConfig, model)
      }
    }
    if (!providerBuiltinTools) {
      providerBuiltinTools = {}
    }
    if (aiSdkProviderId === 'google-vertex') {
      providerBuiltinTools.google_search = vertex.tools.googleSearch({}) as ProviderDefinedTool
    } else if (aiSdkProviderId === 'google-vertex-anthropic') {
      const blockedDomains = mapRegexToPatterns(webSearchConfig.excludeDomains)
      providerBuiltinTools.web_search = vertexAnthropic.tools.webSearch_20250305({
        maxUses: webSearchConfig.maxResults,
        blockedDomains: blockedDomains.length > 0 ? blockedDomains : undefined
      }) as ProviderDefinedTool
    } else if (aiSdkProviderId === 'azure-responses') {
      providerBuiltinTools.web_search_preview = azure.tools.webSearchPreview({
        searchContextSize: webSearchPluginConfig?.openai!.searchContextSize
      }) as ProviderDefinedTool
    } else if (aiSdkProviderId === 'azure-anthropic') {
      const blockedDomains = mapRegexToPatterns(webSearchConfig.excludeDomains)
      const anthropicSearchOptions: AnthropicSearchConfig = {
        maxUses: webSearchConfig.maxResults,
        blockedDomains: blockedDomains.length > 0 ? blockedDomains : undefined
      }
      providerBuiltinTools.web_search = anthropic.tools.webSearch_20250305(
        anthropicSearchOptions
      ) as ProviderDefinedTool
    }
  }

  if (enableUrlContext) {
    if (!providerBuiltinTools) {
      providerBuiltinTools = {}
    }
    const blockedDomains = mapRegexToPatterns(webSearchConfig.excludeDomains)

    switch (aiSdkProviderId) {
      case 'google-vertex':
        providerBuiltinTools.url_context = vertex.tools.urlContext({}) as ProviderDefinedTool
        break
      case 'google':
        providerBuiltinTools.url_context = google.tools.urlContext({}) as ProviderDefinedTool
        break
      case 'anthropic':
      case 'azure-anthropic':
      case 'google-vertex-anthropic':
        providerBuiltinTools.web_fetch = (
          ['anthropic', 'azure-anthropic'].includes(aiSdkProviderId)
            ? anthropic.tools.webFetch_20250910({
                maxUses: webSearchConfig.maxResults,
                blockedDomains: blockedDomains.length > 0 ? blockedDomains : undefined
              })
            : vertexAnthropic.tools.webFetch_20250910({
                maxUses: webSearchConfig.maxResults,
                blockedDomains: blockedDomains.length > 0 ? blockedDomains : undefined
              })
        ) as ProviderDefinedTool
        break
    }
  }

  let headers: Record<string, string | undefined> = options.requestOptions?.headers ?? {}

  if (isAnthropicModel(model) && !isAwsBedrockProvider(provider)) {
    const betaHeaders = addAnthropicHeaders(assistant, model)
    // Only add the anthropic-beta header if there are actual beta headers to include
    if (betaHeaders.length > 0) {
      const newBetaHeaders = { 'anthropic-beta': betaHeaders.join(',') }
      headers = combineHeaders(headers, newBetaHeaders)
    }
  }

  // 构建基础参数
  // Note: standardParams (topK, frequencyPenalty, presencePenalty, stopSequences, seed)
  // are extracted from custom parameters and passed directly to streamText()
  // instead of being placed in providerOptions
  const params: StreamTextParams = {
    messages: sdkMessages,
    maxOutputTokens: getMaxTokens(assistant, model),
    temperature: getTemperature(assistant, model),
    topP: getTopP(assistant, model),
    // Include AI SDK standard params extracted from custom parameters
    ...standardParams,
    abortSignal: options.requestOptions?.signal,
    headers,
    providerOptions,
    stopWhen: stepCountIs(20),
    maxRetries: 0
  }

  // 只添加 Provider 内置工具（搜索、URL 上下文等）
  // MCP 工具通过 VCP 协议格式注入到系统提示词中
  if (providerBuiltinTools && Object.keys(providerBuiltinTools).length > 0) {
    params.tools = providerBuiltinTools
  }

  // 构建系统提示词
  let systemPrompt = ''
  if (assistant.prompt) {
    systemPrompt = await replacePromptVariables(assistant.prompt, model.name)
  }

  // VCP 统一协议：工具注入遵循原始设计
  // 1. MCP 工具：显式配置的 MCP 工具会自动注入
  // 2. VCP 内置工具：只有当 prompt 明确包含 {{VCPAllTools}} 占位符时才注入
  //    不再默认注入所有工具，让用户通过占位符显式控制
  const hasMcpTools = mcpTools && mcpTools.length > 0

  // 检查原始 prompt 是否包含 VCP 占位符（在变量替换之前）
  const originalPrompt = assistant.prompt || ''
  const hasVcpPlaceholder = originalPrompt.includes('{{VCPAllTools}}') || originalPrompt.includes('{{VCPTools}}')

  // 只在有 MCP 工具或明确使用 VCP 占位符时才处理工具注入
  if (hasMcpTools || hasVcpPlaceholder) {
    const vcpGuide = generateVCPProtocolGuide()
    let toolsDescription = ''

    // 1. 添加 MCP 工具描述
    if (hasMcpTools) {
      toolsDescription += convertMcpToolsToVCPDescription(mcpTools)
    }

    // 2. 如果 prompt 包含 VCP 占位符，解析并获取工具描述
    if (hasVcpPlaceholder) {
      try {
        // 解析 {{VCPAllTools}} 占位符
        const vcpToolsResult = await window.api.vcpPlaceholder?.resolve('{{VCPAllTools}}')
        if (vcpToolsResult?.success && vcpToolsResult.result && vcpToolsResult.result !== '{{VCPAllTools}}') {
          // 构建完整的工具描述（包含协议指南）
          const fullToolDescription = `${vcpGuide}

---

${vcpToolsResult.result}`
          // 将占位符替换为完整的工具描述（包含协议指南）
          systemPrompt = systemPrompt.replace(/\{\{VCPAllTools\}\}/g, fullToolDescription)
          systemPrompt = systemPrompt.replace(/\{\{VCPTools\}\}/g, fullToolDescription)
          // 如果还没有 MCP 工具描述，记录 VCP 工具被使用
          if (!hasMcpTools) {
            toolsDescription = vcpToolsResult.result
          }
          logger.debug('VCP placeholder replaced with tools and protocol guide', {
            toolsLength: vcpToolsResult.result.length
          })
        }
      } catch (err) {
        logger.debug('Failed to resolve VCP placeholder', { error: err })
      }
    }

    // 只有当有 MCP 工具时才额外注入 VCP 协议指南到末尾
    // VCP 占位符已经在上面处理（包含协议指南）
    if (hasMcpTools && toolsDescription.trim()) {
      const vcpSection = `

---

# 可用工具

${vcpGuide}

---

${toolsDescription}

---
`
      systemPrompt = systemPrompt + vcpSection
      logger.debug('VCP unified protocol: Injected MCP tools into system prompt', {
        mcpToolCount: mcpTools.length,
        systemPromptLength: systemPrompt.length
      })
    }
  }

  if (systemPrompt) {
    params.system = systemPrompt
  }

  logger.debug('params', params)

  return {
    params,
    modelId: model.id,
    capabilities: { enableReasoning, enableWebSearch, enableGenerateImage, enableUrlContext },
    webSearchPluginConfig
  }
}

/**
 * 构建非流式的 generateText 参数
 */
export async function buildGenerateTextParams(
  messages: ModelMessage[],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
): Promise<any> {
  // 复用流式参数的构建逻辑
  return await buildStreamTextParams(messages, assistant, provider, options)
}
