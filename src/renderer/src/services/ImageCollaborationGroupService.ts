/**
 * 图片协作群服务
 *
 * 将 ImageCollaborationAgent 集成到群聊系统
 * 支持多模型协同的图片生成工作流
 *
 * @module services/ImageCollaborationGroupService
 */

import { loggerService } from '@logger'
import store from '@renderer/store'
import type { SettingsState } from '@renderer/store/settings'
import type { Model, Provider } from '@renderer/types'

import {
  COLLABORATION_ROLES,
  type CollaborationEventCallback,
  type CollaborationRequest,
  type CollaborationResult,
  type CollaborationRole,
  imageCollaborationAgent
} from '../pages/workflow/agents'
import { WorkflowAiService } from '../pages/workflow/services/WorkflowAiService'

const logger = loggerService.withContext('ImageCollaborationGroupService')

// ==================== 类型定义 ====================

/**
 * 角色模型配置
 */
export interface RoleModelConfig {
  role: CollaborationRole
  providerId: string
  modelId: string
}

/**
 * 协作群配置
 */
export interface ImageCollaborationGroupConfig {
  /** 配置名称 */
  name: string
  /** 角色模型配置 */
  roleConfigs: RoleModelConfig[]
  /** 最大重试次数 */
  maxRetries?: number
  /** 显示思考过程 */
  showThinking?: boolean
}

/**
 * 预设的协作群模板
 * 注意：providerId 使用 provider.type 来匹配（如 'gemini', 'openai', 'anthropic'）
 */
export const COLLABORATION_GROUP_TEMPLATES: Record<string, ImageCollaborationGroupConfig> = {
  // Gemini 全家桶（最简单，只需一个 Provider）
  gemini_all: {
    name: 'Gemini 全能协作',
    roleConfigs: [
      { role: 'analyst', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'planner', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'generator', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'quality_checker', providerId: 'gemini', modelId: 'gemini-2.0-flash' }
    ],
    maxRetries: 2,
    showThinking: true
  },

  // 多模型协作（Claude 规划 + Gemini 生成）
  multi_model: {
    name: '多模型协作',
    roleConfigs: [
      { role: 'analyst', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'planner', providerId: 'anthropic', modelId: 'claude-3-5-sonnet' },
      { role: 'generator', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'quality_checker', providerId: 'gemini', modelId: 'gemini-2.0-flash' }
    ],
    maxRetries: 2,
    showThinking: true
  },

  // 高质量协作（GPT-4 规划 + Gemini 生成）
  premium: {
    name: '高质量协作',
    roleConfigs: [
      { role: 'analyst', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'planner', providerId: 'openai', modelId: 'gpt-4o' },
      { role: 'generator', providerId: 'gemini', modelId: 'gemini-2.0-flash' },
      { role: 'quality_checker', providerId: 'openai', modelId: 'gpt-4o' }
    ],
    maxRetries: 3,
    showThinking: true
  }
}

// ==================== 辅助函数 ====================

/**
 * 根据 providerId 查找 Provider
 * 支持按 id、type、或名称模糊匹配
 */
function findProvider(providers: Provider[], providerId: string): Provider | undefined {
  // 1. 精确匹配 id
  let provider = providers.find((p) => p.id === providerId)
  if (provider) return provider

  // 2. 匹配 type（如 'gemini', 'openai', 'anthropic'）
  provider = providers.find((p) => p.type === providerId)
  if (provider) return provider

  // 3. 模糊匹配（名称或 id 包含关键词）
  const lowerProviderId = providerId.toLowerCase()
  provider = providers.find(
    (p) =>
      p.id.toLowerCase().includes(lowerProviderId) ||
      p.type?.toLowerCase().includes(lowerProviderId) ||
      p.name?.toLowerCase().includes(lowerProviderId)
  )

  return provider
}

/**
 * 根据 modelId 查找 Model
 * 支持精确匹配或模糊匹配
 */
function findModel(provider: Provider, modelId: string): Model | undefined {
  // 1. 精确匹配
  let model = provider.models.find((m) => m.id === modelId)
  if (model) return model

  // 2. 模糊匹配（id 包含关键词）
  const lowerModelId = modelId.toLowerCase()
  model = provider.models.find((m) => m.id.toLowerCase().includes(lowerModelId))

  return model
}

/**
 * 获取可用的图片生成 Provider（优先 Gemini）
 */
function getImageGenerationProvider(providers: Provider[]): { provider: Provider; model: Model } | null {
  // 优先查找 Gemini
  const geminiProvider = providers.find((p) => p.type === 'gemini' && p.apiKey)
  if (geminiProvider) {
    const model = geminiProvider.models.find(
      (m) => m.id.includes('flash') || m.id.includes('pro') || m.id.includes('gemini')
    )
    if (model) {
      return { provider: geminiProvider, model }
    }
  }

  // 其他支持图片生成的 provider
  for (const provider of providers) {
    if (provider.apiKey && provider.models.length > 0) {
      // 查找支持视觉的模型
      const model = provider.models.find((m) => m.capabilities?.some((c) => c.type === 'vision'))
      if (model) {
        return { provider, model }
      }
    }
  }

  return null
}

// ==================== ImageCollaborationGroupService 类 ====================

/**
 * 图片协作群服务
 */
class ImageCollaborationGroupService {
  private currentConfig: ImageCollaborationGroupConfig | null = null
  private eventSubscribers: CollaborationEventCallback[] = []

  /**
   * 从设置中初始化协作群
   * 读取 Redux store 中的 imageCollaboration 设置
   */
  async initializeFromSettings(): Promise<boolean> {
    const state = store.getState()
    const rawSettings = state.settings.imageCollaboration

    // 提供默认值，防止 undefined 错误
    const settings: SettingsState['imageCollaboration'] = rawSettings ?? {
      enabled: true,
      template: 'gemini_all',
      maxRetries: 2,
      showThinking: true,
      roleModels: {
        analyst: null,
        planner: null,
        generator: null,
        quality_checker: null
      }
    }

    if (!settings.enabled) {
      logger.info('Image collaboration is disabled in settings')
      return false
    }

    // 如果是自定义模板，使用设置中的 roleModels
    if (settings.template === 'custom') {
      const customConfig = this.buildConfigFromSettings(settings)
      if (customConfig) {
        return this.initialize(customConfig)
      }
      logger.warn('Custom template selected but no role models configured, falling back to gemini_all')
      return this.initialize('gemini_all')
    }

    // 使用预设模板，但应用设置中的 maxRetries 和 showThinking
    const template = COLLABORATION_GROUP_TEMPLATES[settings.template]
    if (template) {
      const configWithSettings: ImageCollaborationGroupConfig = {
        ...template,
        maxRetries: settings.maxRetries,
        showThinking: settings.showThinking
      }
      return this.initialize(configWithSettings)
    }

    return this.initialize('gemini_all')
  }

  /**
   * 从设置构建自定义配置
   */
  private buildConfigFromSettings(settings: SettingsState['imageCollaboration']): ImageCollaborationGroupConfig | null {
    const roleConfigs: RoleModelConfig[] = []
    const roles: CollaborationRole[] = ['analyst', 'planner', 'generator', 'quality_checker']

    for (const role of roles) {
      const roleModel = settings.roleModels[role]
      if (roleModel) {
        roleConfigs.push({
          role,
          providerId: roleModel.providerId,
          modelId: roleModel.modelId
        })
      }
    }

    // 至少需要配置 generator 角色
    if (!roleConfigs.some((r) => r.role === 'generator')) {
      return null
    }

    return {
      name: '自定义配置',
      roleConfigs,
      maxRetries: settings.maxRetries,
      showThinking: settings.showThinking
    }
  }

  /**
   * 初始化协作群
   *
   * @param config 协作群配置或模板名称
   */
  async initialize(config: ImageCollaborationGroupConfig | string): Promise<boolean> {
    try {
      // 如果是模板名称，获取模板配置
      const groupConfig = typeof config === 'string' ? COLLABORATION_GROUP_TEMPLATES[config] : config

      if (!groupConfig) {
        throw new Error(`Unknown template: ${config}`)
      }

      // 获取所有 providers
      const state = store.getState()
      const providers = state.llm.providers.filter((p) => p.apiKey) // 只考虑有 API Key 的

      if (providers.length === 0) {
        throw new Error('没有配置任何 Provider，请先在设置中添加 API Key')
      }

      // 获取默认的图片生成 Provider（用于 fallback）
      const defaultImageProvider = getImageGenerationProvider(providers)
      if (!defaultImageProvider) {
        throw new Error('未找到支持图片生成的 Provider，请配置 Gemini API Key')
      }

      // 验证并配置每个角色的 Provider 和 Model
      for (const roleConfig of groupConfig.roleConfigs) {
        let provider = findProvider(providers, roleConfig.providerId)
        let model: Model | undefined

        // 如果找不到指定 Provider，使用 fallback
        if (!provider) {
          logger.warn(
            `Provider ${roleConfig.providerId} not found for role ${roleConfig.role}, using fallback: ${defaultImageProvider.provider.type}`
          )
          provider = defaultImageProvider.provider
          model = defaultImageProvider.model
        } else {
          // 查找模型
          model = findModel(provider, roleConfig.modelId)
          if (!model) {
            // 尝试使用第一个可用模型
            model = provider.models[0]
            if (model) {
              logger.warn(`Model ${roleConfig.modelId} not found for role ${roleConfig.role}, using ${model.id}`)
            }
          }
        }

        if (!model) {
          // 最终 fallback 到默认图片生成模型
          logger.warn(`No model found for role ${roleConfig.role}, using default image provider`)
          provider = defaultImageProvider.provider
          model = defaultImageProvider.model
        }

        imageCollaborationAgent.setDefaultProvider(roleConfig.role, provider, model)
        logger.info(`Role ${roleConfig.role} configured with ${provider.type}/${model.id}`)
      }

      // 设置 Agent 函数（带错误处理）
      imageCollaborationAgent.setAgentFunctions({
        analyzeImage: async (provider: Provider, model: Model, images: string[], prompt: string) => {
          try {
            const loadedImages = await WorkflowAiService.loadImagesForVision(images)
            return await WorkflowAiService.visionAnalysis(provider, model, {
              systemPrompt: COLLABORATION_ROLES.analyst.systemPrompt,
              userPrompt: prompt,
              images: loadedImages
            })
          } catch (error) {
            logger.error('analyzeImage failed', error as Error)
            throw new Error(`图片分析失败: ${error instanceof Error ? error.message : String(error)}`)
          }
        },

        generateText: async (provider: Provider, model: Model, systemPrompt: string, userPrompt: string) => {
          try {
            return await WorkflowAiService.generateText(provider, model, {
              systemPrompt,
              userPrompt
            })
          } catch (error) {
            logger.error('generateText failed', error as Error)
            throw new Error(`文本生成失败: ${error instanceof Error ? error.message : String(error)}`)
          }
        },

        generateImage: async (
          provider: Provider,
          model: Model,
          prompt: string,
          images?: string[],
          config?: { aspectRatio?: string; imageSize?: string }
        ) => {
          try {
            return await WorkflowAiService.generateImage(provider, model, {
              prompt,
              images,
              aspectRatio: config?.aspectRatio || '3:4',
              imageSize: config?.imageSize || '2K'
            })
          } catch (error) {
            logger.error('generateImage failed', error as Error)
            throw new Error(`图片生成失败: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      })

      this.currentConfig = groupConfig
      logger.info('ImageCollaborationGroupService initialized', {
        config: groupConfig.name,
        roles: groupConfig.roleConfigs.map((r) => r.role)
      })

      return true
    } catch (error) {
      logger.error('Failed to initialize ImageCollaborationGroupService', error as Error)
      return false
    }
  }

  /**
   * 订阅协作事件
   */
  subscribe(callback: CollaborationEventCallback): () => void {
    this.eventSubscribers.push(callback)
    return imageCollaborationAgent.subscribe(callback)
  }

  /**
   * 执行协作生成
   */
  async execute(request: Omit<CollaborationRequest, 'agentConfigs'>): Promise<CollaborationResult> {
    if (!this.currentConfig) {
      throw new Error('Service not initialized. Call initialize() first.')
    }

    logger.info('Starting collaboration', {
      userMessage: request.userMessage.substring(0, 100),
      imageCount: request.images.length
    })

    return imageCollaborationAgent.execute(request)
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): ImageCollaborationGroupConfig | null {
    return this.currentConfig
  }

  /**
   * 获取可用的协作角色信息
   */
  getRoleInfo(): Array<{
    role: CollaborationRole
    displayName: string
    avatar: string
    expertise: string[]
  }> {
    return Object.entries(COLLABORATION_ROLES).map(([role, config]) => ({
      role: role as CollaborationRole,
      displayName: config.displayName,
      avatar: config.avatar,
      expertise: config.expertise
    }))
  }

  /**
   * 检查是否已配置指定 Provider
   */
  isProviderConfigured(providerId: string): boolean {
    const state = store.getState()
    const provider = state.llm.providers.find((p) => p.id === providerId || p.type === providerId)
    return !!(provider && provider.apiKey)
  }

  /**
   * 获取推荐的模板（基于用户已配置的 Provider）
   */
  getRecommendedTemplate(): string {
    // 检查各 Provider 配置
    const hasGemini = this.isProviderConfigured('gemini')
    const hasOpenAI = this.isProviderConfigured('openai')
    const hasClaude = this.isProviderConfigured('anthropic')

    if (hasGemini && hasOpenAI) {
      return 'premium'
    } else if (hasGemini && hasClaude) {
      return 'multi_model'
    } else if (hasGemini) {
      return 'gemini_all'
    }

    // 默认返回 gemini_all（最常用）
    return 'gemini_all'
  }

  /**
   * 检查协作功能是否在设置中启用
   */
  isEnabledInSettings(): boolean {
    const state = store.getState()
    return state.settings.imageCollaboration?.enabled ?? true
  }

  /**
   * 获取当前设置中的模板
   */
  getSettingsTemplate(): string {
    const state = store.getState()
    return state.settings.imageCollaboration?.template ?? 'gemini_all'
  }
}

/**
 * 单例实例
 */
export const imageCollaborationGroupService = new ImageCollaborationGroupService()

export default imageCollaborationGroupService
