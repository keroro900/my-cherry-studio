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

  // VCP 统一协议：工具注入遵循 VCPToolBox 原始设计
  // 重要：只有当 prompt 明确包含占位符时才注入工具描述，避免 token 爆炸
  //
  // 支持的占位符：
  // - {{VCPToolCatalog}} - 精简工具目录（推荐，~500 tokens）
  // - {{VCPAllTools}} / {{VCPTools}} - 自动降级为精简版
  // - {{VCPServiceName}} - 单个服务的完整描述（VCPToolBox 核心特性）
  //   例如: {{VCPDailyNoteWrite}}, {{VCPLightMemo}}, {{VCPAIMemo}}
  // - {{MCPTools}} - 仅注入 MCP 工具（新增）
  //
  // 如果没有占位符但启用了 VCP，只注入协议指南（不注入工具列表）
  const hasMcpTools = mcpTools && mcpTools.length > 0
  const isVcpEnabled = assistant.vcpConfig?.enabled ?? false

  // 检查原始 prompt 是否包含 VCP 占位符（在变量替换之前）
  const originalPrompt = assistant.prompt || ''
  const hasVcpPlaceholder =
    originalPrompt.includes('{{VCPAllTools}}') ||
    originalPrompt.includes('{{VCPTools}}') ||
    originalPrompt.includes('{{VCPToolCatalog}}')
  const hasMcpPlaceholder = originalPrompt.includes('{{MCPTools}}')

  // 检查是否有单个服务占位符 {{VCPServiceName}} (VCPToolBox 核心特性)
  // 格式: {{VCPDailyNoteWrite}}, {{VCPLightMemo}}, {{VCPAIMemo}} 等
  const vcpSingleServicePattern = /\{\{VCP([A-Za-z0-9_]+)\}\}/g
  const reservedPlaceholders = ['AllTools', 'Tools', 'ToolCatalog', 'ToolName', 'Guide']
  const singleServiceMatches = [...originalPrompt.matchAll(vcpSingleServicePattern)]
    .filter(match => !reservedPlaceholders.includes(match[1]))
  const hasSingleServicePlaceholder = singleServiceMatches.length > 0

  // 只有在有占位符或 VCP 启用时才处理
  if (hasVcpPlaceholder || hasMcpPlaceholder || hasSingleServicePlaceholder || isVcpEnabled) {
    // 检查是否使用分层模式（{{VCPToolCatalog}}）
    const isLayeredMode = originalPrompt.includes('{{VCPToolCatalog}}')
    const vcpGuide = generateVCPProtocolGuide(isLayeredMode)

    // 1. 处理 {{MCPTools}} 占位符 - 仅注入 MCP 工具
    if (hasMcpPlaceholder && hasMcpTools) {
      const mcpToolsDescription = convertMcpToolsToVCPDescription(mcpTools)
      const mcpSection = `${vcpGuide}\n\n---\n\n${mcpToolsDescription}`
      systemPrompt = systemPrompt.replace(/\{\{MCPTools\}\}/g, mcpSection)
      logger.debug('MCP tools placeholder replaced', { mcpToolCount: mcpTools.length })
    }

    // 2. 如果 prompt 包含 VCP 占位符，解析并获取工具描述
    if (hasVcpPlaceholder) {
      try {
        // 处理 {{VCPToolCatalog}} - 精简工具目录（推荐）
        if (originalPrompt.includes('{{VCPToolCatalog}}')) {
          const vcpCatalogResult = await window.api.vcpPlaceholder?.resolve('{{VCPToolCatalog}}')
          if (vcpCatalogResult?.success && vcpCatalogResult.result && vcpCatalogResult.result !== '{{VCPToolCatalog}}') {
            const fullCatalog = `${vcpGuide}\n\n---\n\n${vcpCatalogResult.result}`
            systemPrompt = systemPrompt.replace(/\{\{VCPToolCatalog\}\}/g, fullCatalog)
            logger.debug('VCP catalog placeholder replaced', { catalogLength: vcpCatalogResult.result.length })
          }
        }

        // 处理 {{VCPAllTools}} 或 {{VCPTools}} - 自动降级为精简版工具目录
        if (originalPrompt.includes('{{VCPAllTools}}') || originalPrompt.includes('{{VCPTools}}')) {
          const vcpCatalogResult = await window.api.vcpPlaceholder?.resolve('{{VCPToolCatalog}}')
          if (vcpCatalogResult?.success && vcpCatalogResult.result && vcpCatalogResult.result !== '{{VCPToolCatalog}}') {
            const catalogWithGuide = `${vcpGuide}\n\n---\n\n${vcpCatalogResult.result}\n\n---\n\n**提示**: 使用 \`vcp_get_tool_info\` 查询任意工具的详细用法。`
            systemPrompt = systemPrompt.replace(/\{\{VCPAllTools\}\}/g, catalogWithGuide)
            systemPrompt = systemPrompt.replace(/\{\{VCPTools\}\}/g, catalogWithGuide)
            logger.debug('VCP AllTools placeholder replaced with catalog', { catalogLength: vcpCatalogResult.result.length })
          }
        }
      } catch (err) {
        logger.warn('Failed to resolve VCP placeholder', { error: err })
      }
    }

    // 3. 处理 {{VCPServiceName}} 单个服务占位符 (VCPToolBox 核心特性)
    // 这是避免 token 爆炸的关键：按需注入单个工具的完整描述
    // 例如: {{VCPDailyNoteWrite}} 只注入日记写入服务的描述和调用示例
    if (hasSingleServicePlaceholder) {
      try {
        for (const match of singleServiceMatches) {
          const placeholder = match[0]  // 完整占位符，如 {{VCPDailyNoteWrite}}

          // 调用 PlaceholderEngine 解析单个服务描述
          const serviceResult = await window.api.vcpPlaceholder?.resolve(placeholder)
          if (serviceResult?.success && serviceResult.result && serviceResult.result !== placeholder) {
            // 为单个服务添加协议指南（简化版，只包含调用格式）
            const serviceWithGuide = `${serviceResult.result}\n\n---\n\n${vcpGuide}`
            systemPrompt = systemPrompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), serviceWithGuide)
            logger.debug('VCP single service placeholder replaced', {
              placeholder,
              descLength: serviceResult.result.length
            })
          } else {
            logger.warn('Failed to resolve VCP service placeholder', { placeholder })
          }
        }
      } catch (err) {
        logger.warn('Failed to resolve VCP single service placeholders', { error: err })
      }
    }

    // 注意：VCPToolBox 原版不会自动注入任何内容
    // 所有工具描述和协议指南都需要用户手动在 prompt 中添加占位符
    // 如需协议指南，用户应添加 {{VarVCPGuide}} 或在 prompt 中直接写明调用格式
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
