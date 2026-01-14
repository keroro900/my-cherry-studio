/**
 * ModelSelector 内置服务
 *
 * 为插件提供完整的模型服务访问能力：
 * - 列出所有 Provider 和 Model
 * - 获取 API 配置（API Key、Base URL）
 * - 按能力查询模型
 * - 直接调用任意模型
 *
 * 权限级别：完全开放
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getModelServiceBridge, type ModelCapability, type ModelQuery } from '../ModelServiceBridge'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:ModelSelectorService')

export class ModelSelectorService implements IBuiltinService {
  name = 'ModelSelector'
  displayName = '模型选择器 (内置)'
  description = '访问 Cherry Studio 的完整模型服务：浏览 Provider/Model、获取 API 配置、按能力查询、直接调用模型。'
  version = '1.0.0'
  type = 'builtin_service' as const

  configSchema = {}

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ListProviders',
      description: `列出所有已启用的 AI Provider。
返回每个 Provider 的 ID、名称、类型、API Host、API Key、模型数量。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」ListProviders「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetProvider',
      description: `获取指定 Provider 的详细信息和 API 配置。
参数:
- providerId (字符串, 必需): Provider ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」GetProvider「末」
providerId:「始」openai「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'providerId', description: 'Provider ID', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'ListModels',
      description: `列出所有可用模型，包含 API 配置信息。
参数:
- providerId (字符串, 可选): 只列出指定 Provider 的模型

返回每个模型的：ID、名称、Provider、上下文长度、能力标签、API Key、API Host

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」ListModels「末」
providerId:「始」openai「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'providerId', description: 'Provider ID (可选)', required: false, type: 'string' }]
    },
    {
      commandIdentifier: 'QueryModels',
      description: `按条件查询模型。
参数:
- capabilities (字符串数组, 可选): 所需能力，如 ["vision", "coding", "long_context"]
- requireAll (布尔, 可选): 是否必须满足所有能力，默认 false
- providerId (字符串, 可选): 指定 Provider
- nameContains (字符串, 可选): 模型名称包含
- minContextLength (数字, 可选): 最小上下文长度
- limit (数字, 可选): 最大返回数量

可用能力标签: chat, vision, coding, long_context, function_call, reasoning, embedding, image_generation, audio, video

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」QueryModels「末」
capabilities:「始」["vision", "coding"]「末」
minContextLength:「始」100000「末」
limit:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'capabilities', description: '所需能力数组', required: false, type: 'array' },
        { name: 'requireAll', description: '是否必须满足所有能力', required: false, type: 'boolean' },
        { name: 'providerId', description: 'Provider ID', required: false, type: 'string' },
        { name: 'nameContains', description: '模型名称包含', required: false, type: 'string' },
        { name: 'minContextLength', description: '最小上下文长度', required: false, type: 'number' },
        { name: 'limit', description: '最大返回数量', required: false, type: 'number' }
      ]
    },
    {
      commandIdentifier: 'GetBestModel',
      description: `获取最适合指定能力的模型。
参数:
- capabilities (字符串数组, 可选): 所需能力

返回最佳匹配的模型及其 API 配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」GetBestModel「末」
capabilities:「始」["vision"]「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'capabilities', description: '所需能力数组', required: false, type: 'array' }]
    },
    {
      commandIdentifier: 'GetCredentials',
      description: `获取模型的 API 配置（API Key、Base URL）。
参数:
- modelId (字符串, 必需): 模型 ID
- providerId (字符串, 可选): Provider ID

返回可直接用于调用的 API 配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」GetCredentials「末」
modelId:「始」gpt-4o「末」
providerId:「始」openai「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'modelId', description: '模型 ID', required: true, type: 'string' },
        { name: 'providerId', description: 'Provider ID (可选)', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'CallModel',
      description: `直接调用模型进行对话。
参数:
- message (字符串, 必需): 用户消息
- systemPrompt (字符串, 可选): 系统提示词
- modelId (字符串, 可选): 指定模型 ID，不指定则自动选择
- providerId (字符串, 可选): 指定 Provider ID
- capabilities (字符串数组, 可选): 所需能力（用于自动选择模型）
- temperature (数字, 可选): 温度，默认 0.7
- maxTokens (数字, 可选): 最大 Token，默认 4096

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ModelSelector「末」
command:「始」CallModel「末」
message:「始」请帮我分析这段代码的性能问题「末」
systemPrompt:「始」你是一个代码审查专家「末」
capabilities:「始」["coding"]「末」
temperature:「始」0.3「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'message', description: '用户消息', required: true, type: 'string' },
        { name: 'systemPrompt', description: '系统提示词', required: false, type: 'string' },
        { name: 'modelId', description: '模型 ID', required: false, type: 'string' },
        { name: 'providerId', description: 'Provider ID', required: false, type: 'string' },
        { name: 'capabilities', description: '所需能力数组', required: false, type: 'array' },
        { name: 'temperature', description: '温度', required: false, type: 'number' },
        { name: 'maxTokens', description: '最大 Token', required: false, type: 'number' }
      ]
    }
  ]

  async initialize(): Promise<void> {
    logger.info('ModelSelectorService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      const bridge = getModelServiceBridge()

      switch (command) {
        case 'ListProviders':
          return await this.listProviders(bridge)

        case 'GetProvider':
          return await this.getProvider(bridge, params)

        case 'ListModels':
          return await this.listModels(bridge, params)

        case 'QueryModels':
          return await this.queryModels(bridge, params)

        case 'GetBestModel':
          return await this.getBestModel(bridge, params)

        case 'GetCredentials':
          return await this.getCredentials(bridge, params)

        case 'CallModel':
          return await this.executeCallModel(bridge, params)

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`
          }
      }
    } catch (error) {
      logger.error('ModelSelector command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async listProviders(bridge: ReturnType<typeof getModelServiceBridge>): Promise<BuiltinServiceResult> {
    const providers = await bridge.listProviders()
    const summary = providers.map((p) => `- ${p.name} (${p.id}): ${p.modelCount} 个模型`).join('\n')

    return {
      success: true,
      output: `找到 ${providers.length} 个 Provider:\n${summary}`,
      data: providers
    }
  }

  private async getProvider(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const providerId = String(params.providerId || '')
    if (!providerId) {
      return { success: false, error: '需要 providerId 参数' }
    }

    const provider = await bridge.getProvider(providerId)
    if (!provider) {
      return { success: false, error: `Provider '${providerId}' 不存在或未启用` }
    }

    return {
      success: true,
      output: `Provider: ${provider.name}\nAPI Host: ${provider.apiHost}\nAPI Key: ${provider.apiKey.slice(0, 8)}...${provider.apiKey.slice(-4)}\n模型数量: ${provider.modelCount}`,
      data: provider
    }
  }

  private async listModels(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const providerId = params.providerId ? String(params.providerId) : undefined
    const models = await bridge.listModels(providerId)

    const summary = models
      .slice(0, 20)
      .map((m) => `- ${m.name} (${m.id}) [${m.capabilities.join(', ')}]`)
      .join('\n')

    const more = models.length > 20 ? `\n... 还有 ${models.length - 20} 个模型` : ''

    return {
      success: true,
      output: `找到 ${models.length} 个模型:\n${summary}${more}`,
      data: models
    }
  }

  private async queryModels(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const query: ModelQuery = {
      capabilities: params.capabilities as ModelCapability[] | undefined,
      requireAllCapabilities: params.requireAll as boolean | undefined,
      providerId: params.providerId ? String(params.providerId) : undefined,
      nameContains: params.nameContains ? String(params.nameContains) : undefined,
      minContextLength: params.minContextLength as number | undefined,
      limit: params.limit as number | undefined
    }

    const models = await bridge.queryModels(query)

    const summary = models.map((m) => `- ${m.name} (${m.id}) [${m.capabilities.join(', ')}]`).join('\n')

    return {
      success: true,
      output: `查询到 ${models.length} 个匹配模型:\n${summary || '(无)'}`,
      data: models
    }
  }

  private async getBestModel(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const capabilities = params.capabilities as ModelCapability[] | undefined
    const model = await bridge.getBestModel(capabilities)

    if (!model) {
      return { success: false, error: '没有找到合适的模型' }
    }

    return {
      success: true,
      output: `推荐模型: ${model.name} (${model.id})\nProvider: ${model.providerName}\n能力: ${model.capabilities.join(', ')}\nAPI Host: ${model.apiHost}`,
      data: model
    }
  }

  private async getCredentials(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const modelId = String(params.modelId || '')
    if (!modelId) {
      return { success: false, error: '需要 modelId 参数' }
    }

    const providerId = params.providerId ? String(params.providerId) : undefined
    const credentials = await bridge.getModelCredentials(modelId, providerId)

    if (!credentials) {
      return { success: false, error: `模型 '${modelId}' 不存在` }
    }

    return {
      success: true,
      output: `模型: ${credentials.modelId}\nProvider: ${credentials.providerId}\nAPI Host: ${credentials.apiHost}\nAPI Key: ${credentials.apiKey}`,
      data: credentials
    }
  }

  private async executeCallModel(
    bridge: ReturnType<typeof getModelServiceBridge>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const message = String(params.message || '')
    if (!message) {
      return { success: false, error: '需要 message 参数' }
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: String(params.systemPrompt) })
    }
    messages.push({ role: 'user', content: message })

    const result = await bridge.callModel({
      modelId: params.modelId ? String(params.modelId) : undefined,
      providerId: params.providerId ? String(params.providerId) : undefined,
      capabilities: params.capabilities as ModelCapability[] | undefined,
      messages,
      temperature: params.temperature as number | undefined,
      maxTokens: params.maxTokens as number | undefined
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const modelInfo = result.modelUsed
      ? `[使用模型: ${result.modelUsed.modelId} @ ${result.modelUsed.providerName}]`
      : ''

    return {
      success: true,
      output: `${result.content}\n\n${modelInfo}`,
      data: {
        content: result.content,
        modelUsed: result.modelUsed,
        usage: result.usage
      }
    }
  }

  async shutdown(): Promise<void> {
    logger.info('ModelSelectorService shutdown')
  }
}
