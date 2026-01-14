/**
 * 一致性特征提取服务
 *
 * 使用 Vision 模型分析参考图片，提取特征信息，
 * 生成约束提示词以确保后续生成图片的风格一致性
 */

import { loggerService } from '@logger'
import LegacyAiProvider from '@renderer/aiCore/legacy/index'
import type { CompletionsParams } from '@renderer/aiCore/legacy/middleware/schemas'
import { hasApiKey } from '@renderer/services/ApiService'
import { getProviderByModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import type { Assistant, Model } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { type Message, UserMessageStatus } from '@renderer/types/newMessage'
import { uuid } from '@renderer/utils'

import type { ConsistencyReference, ConsistencyType, ExtractedFeatures } from '../types'

const logger = loggerService.withContext('ConsistencyService')

// ============================================================================
// 内部类型（用于 LLM 响应解析）
// ============================================================================

interface RawLLMResponse {
  colors: string[]
  style: string
  keyElements: string[]
  mood: string
  lighting: string
  composition: string
  constraintPrompt: string
}

// ============================================================================
// 系统提示词
// ============================================================================

const FEATURE_EXTRACTION_SYSTEM_PROMPT = `You are an expert image analyst specializing in extracting visual features for ensuring style consistency in AI image generation.

## Your Task
Analyze the provided reference image(s) and extract key visual features that define the style, mood, and aesthetic.

## Features to Extract

1. **Colors**: Identify 3-5 dominant colors using precise names (e.g., "dusty rose", "cobalt blue")
2. **Style**: Describe the overall artistic/photographic style (e.g., "minimalist commercial", "vintage film")
3. **Key Elements**: List 3-5 distinctive visual elements or subjects
4. **Mood**: Describe the emotional atmosphere (e.g., "warm and cozy", "cool and professional")
5. **Lighting**: Describe the lighting conditions (e.g., "soft diffused natural light", "dramatic studio lighting")
6. **Composition**: Note any distinctive compositional patterns

## Output Format
Respond in JSON format:
{
  "colors": ["color1", "color2", ...],
  "style": "style description",
  "keyElements": ["element1", "element2", ...],
  "mood": "mood description",
  "lighting": "lighting description",
  "composition": "composition notes",
  "constraintPrompt": "A single paragraph that can be appended to image generation prompts to maintain this visual style"
}

## Important
- Be specific and precise in your descriptions
- Focus on reproducible visual characteristics
- The constraintPrompt should be actionable for AI image generation
- Output ONLY valid JSON, no markdown or explanations`

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取 Vision 模型
 */
function getVisionModel(): { model: Model; assistant: Assistant } | null {
  const state = store.getState()
  const defaultAssistant = state.assistants.defaultAssistant
  const llmDefaultModel = state.llm.defaultModel

  const model = defaultAssistant?.model ?? defaultAssistant?.defaultModel ?? llmDefaultModel

  if (!model) {
    logger.warn('No model found for vision analysis')
    return null
  }

  return { model, assistant: defaultAssistant }
}

/**
 * 解析 JSON 响应
 */
function parseJsonResponse(text: string): RawLLMResponse | null {
  try {
    // 尝试直接解析
    return JSON.parse(text)
  } catch {
    // 尝试提取 JSON 块
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * 将 LLM 响应转换为 ExtractedFeatures
 */
function convertToExtractedFeatures(raw: RawLLMResponse): ExtractedFeatures {
  return {
    colors: {
      primaryColors: raw.colors.slice(0, 3),
      secondaryColors: raw.colors.slice(3),
      saturationLevel: 'medium',
      colorTemperature: 'neutral',
      brightness: 'medium'
    },
    style: {
      styleDescription: raw.style,
      styleTags: raw.keyElements,
      lightingStyle: raw.lighting.includes('soft') ? 'soft' : raw.lighting.includes('dramatic') ? 'dramatic' : 'natural'
    },
    scene: {
      sceneType: 'studio',
      sceneDescription: raw.composition,
      backgroundElements: [],
      props: [],
      mood: raw.mood
    },
    confidence: 0.8
  }
}

// ============================================================================
// 主服务类
// ============================================================================

/**
 * 一致性特征提取服务
 */
class ConsistencyServiceImpl {
  private references: Map<string, ConsistencyReference> = new Map()

  /**
   * 从参考图片提取特征
   */
  async extractFeatures(images: string[], type: ConsistencyType, name?: string): Promise<ConsistencyReference> {
    if (!images || images.length === 0) {
      throw new Error('请至少提供一张参考图片')
    }

    // 获取模型
    const result = getVisionModel()
    if (!result) {
      throw new Error('未配置默认助手模型，请先在设置中配置')
    }

    const { model, assistant: defaultAssistant } = result
    const provider = getProviderByModel(model)

    if (!provider) {
      throw new Error('未找到模型对应的服务商')
    }

    if (!hasApiKey(provider)) {
      throw new Error('服务商未配置 API Key')
    }

    logger.info('Extracting features from reference images', {
      modelId: model.id,
      imageCount: images.length,
      type
    })

    // 创建 AI Provider
    const aiProvider = new LegacyAiProvider(provider)

    // 创建分析专用 assistant
    const assistant: Assistant = {
      ...defaultAssistant,
      id: `consistency-${uuid()}`,
      name: 'Consistency Feature Extractor',
      prompt: FEATURE_EXTRACTION_SYSTEM_PROMPT,
      model: model,
      topics: [],
      settings: {
        temperature: 0.3, // 低温度确保一致的输出
        contextCount: 1,
        streamOutput: false,
        enableMaxTokens: false,
        maxTokens: 0,
        topP: 1,
        enableTopP: false,
        enableTemperature: true,
        reasoning_effort: undefined,
        qwenThinkMode: undefined,
        toolUseMode: undefined
      }
    }

    let resultText = ''

    // 构建消息 - 包含图片
    const messageId = uuid()
    const now = new Date().toISOString()

    const userMessage: Message & { images?: string[] } = {
      id: messageId,
      role: 'user',
      assistantId: assistant.id,
      topicId: 'consistency-extraction',
      createdAt: now,
      status: UserMessageStatus.SUCCESS,
      blocks: [],
      images: images
    }

    const completionsParams: CompletionsParams = {
      assistant,
      messages: [userMessage as Message],
      streamOutput: false,
      callType: 'generate',
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TEXT_DELTA) {
          resultText += chunk.text || ''
        }
      }
    }

    try {
      await aiProvider.completions(completionsParams)

      const rawFeatures = parseJsonResponse(resultText.trim())

      if (!rawFeatures) {
        throw new Error('无法解析特征提取结果')
      }

      const features = convertToExtractedFeatures(rawFeatures)

      logger.info('Features extracted successfully', {
        colorsCount: features.colors.primaryColors.length,
        hasConstraintPrompt: !!rawFeatures.constraintPrompt
      })

      const now = Date.now()

      // 创建一致性参考对象
      const reference: ConsistencyReference = {
        id: uuid(),
        name: name || `${type} Reference`,
        type,
        referenceImages: images,
        extractedFeatures: features,
        constraintPrompt: rawFeatures.constraintPrompt || '',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        usageCount: 0
      }

      // 保存到内存
      this.references.set(reference.id, reference)

      return reference
    } catch (error) {
      logger.error('Failed to extract features:', error as Error)
      throw error
    }
  }

  /**
   * 获取所有参考配置
   */
  getAllReferences(): ConsistencyReference[] {
    return Array.from(this.references.values())
  }

  /**
   * 根据 ID 获取参考配置
   */
  getReference(id: string): ConsistencyReference | undefined {
    return this.references.get(id)
  }

  /**
   * 删除参考配置
   */
  deleteReference(id: string): boolean {
    return this.references.delete(id)
  }

  /**
   * 更新参考配置名称
   */
  updateReferenceName(id: string, name: string): boolean {
    const ref = this.references.get(id)
    if (ref) {
      ref.name = name
      ref.updatedAt = Date.now()
      return true
    }
    return false
  }

  /**
   * 设置参考配置激活状态
   */
  setReferenceActive(id: string, isActive: boolean): boolean {
    const ref = this.references.get(id)
    if (ref) {
      ref.isActive = isActive
      ref.updatedAt = Date.now()
      return true
    }
    return false
  }

  /**
   * 增加使用计数
   */
  incrementUsageCount(id: string): void {
    const ref = this.references.get(id)
    if (ref) {
      ref.usageCount++
      ref.updatedAt = Date.now()
    }
  }

  /**
   * 生成组合的约束提示词
   */
  getCombinedConstraintPrompt(referenceIds: string[]): string {
    const prompts: string[] = []

    for (const id of referenceIds) {
      const ref = this.references.get(id)
      if (ref && ref.constraintPrompt && ref.isActive) {
        prompts.push(ref.constraintPrompt)
        this.incrementUsageCount(id)
      }
    }

    if (prompts.length === 0) {
      return ''
    }

    if (prompts.length === 1) {
      return prompts[0]
    }

    return `Maintain consistency with the following style references:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
  }

  /**
   * 检查是否可以使用服务
   */
  canExtract(): boolean {
    const result = getVisionModel()
    if (!result) return false

    const provider = getProviderByModel(result.model)
    if (!provider || !hasApiKey(provider)) return false

    return true
  }

  /**
   * 清除所有参考配置
   */
  clearAll(): void {
    this.references.clear()
  }
}

// 导出单例
export const consistencyService = new ConsistencyServiceImpl()

export default consistencyService
