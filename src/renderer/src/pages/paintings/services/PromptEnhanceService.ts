/**
 * 提示词增强服务
 *
 * 使用 Cherry Studio 中用户配置的默认助手来增强图像生成提示词
 * 支持两种模式：
 * 1. 生成模式 (generate): 增强图像生成提示词
 * 2. 编辑模式 (edit): 增强图像编辑指令，分析用户意图
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

const logger = loggerService.withContext('PromptEnhanceService')

// ============================================================================
// 系统提示词定义
// ============================================================================

/**
 * 图像生成模式的提示词增强系统提示词
 */
const GENERATE_ENHANCE_SYSTEM_PROMPT = `You are an expert AI art director specializing in image generation prompts. Your task is to enhance and improve image prompts to produce better, more detailed, and more visually appealing results.

Guidelines:
1. Add specific visual details (lighting, composition, style, mood)
2. Include technical photography/art terms when appropriate
3. Maintain the original intent and subject matter
4. Add quality boosters (high quality, detailed, professional, etc.)
5. Keep the enhanced prompt concise but comprehensive
6. Output in the SAME LANGUAGE as the input prompt
7. Output ONLY the enhanced prompt text, no explanations or markdown

Example:
Input: "a cat sitting on a windowsill"
Output: "A fluffy orange tabby cat sitting gracefully on a sunlit windowsill, soft morning light streaming through sheer curtains, bokeh background of a cozy room, warm color palette, professional photography, high detail, 4K quality"`

/**
 * 图像编辑模式的提示词增强系统提示词
 *
 * 核心原则：
 * 1. 分析用户的编辑意图（修改、替换、添加、删除、风格转换等）
 * 2. 保持对原图的尊重，明确指出要保留的元素
 * 3. 提供精确的编辑指令，避免歧义
 * 4. 考虑编辑的可行性和自然性
 */
const EDIT_ENHANCE_SYSTEM_PROMPT = `You are an expert AI image editor specializing in image editing prompts. Your task is to analyze the user's editing intent and enhance their prompt to produce precise, natural-looking image edits.

## Your Analysis Process:

1. **Identify Edit Type**: Determine what kind of edit the user wants:
   - REPLACE: Replace one element with another (e.g., "change the red car to blue")
   - ADD: Add new elements to the image (e.g., "add a hat to the person")
   - REMOVE: Remove elements from the image (e.g., "remove the background person")
   - MODIFY: Modify existing elements (e.g., "make the sky more dramatic")
   - STYLE: Apply style changes (e.g., "make it look like an oil painting")
   - ENHANCE: Improve quality or details (e.g., "make it sharper", "increase contrast")
   - COMPOSITE: Combine multiple edits

2. **Preserve Original Elements**: Identify what should remain unchanged:
   - Main subject preservation
   - Background consistency
   - Lighting coherence
   - Color harmony

3. **Specify Edit Details**: Make the edit instruction precise:
   - Exact location/area of edit
   - Specific attributes (color, size, style, texture)
   - Transition/blending requirements
   - Quality expectations

## Output Guidelines:

1. Output in the SAME LANGUAGE as the input prompt
2. Output ONLY the enhanced editing prompt, no explanations
3. Be specific about what to change AND what to preserve
4. Include technical terms for better AI understanding
5. Keep the prompt focused and actionable

## Examples:

Input: "把背景换成海边"
Output: "将图片背景替换为阳光明媚的海滩场景，保持前景主体人物完整不变，确保光照方向与原图一致，海滩背景包含金色沙滩、蔚蓝海水和淡蓝天空，自然过渡，无明显边缘"

Input: "remove the person in the background"
Output: "Remove the background person completely, fill the area with natural continuation of the surrounding environment, maintain consistent lighting and texture, preserve the main subject in the foreground unchanged, ensure seamless blending with no visible artifacts"

Input: "让她穿红色裙子"
Output: "将人物的服装更改为优雅的红色连衣裙，保持人物姿态、面部表情和发型不变，红色裙子应与原图光照环境协调，面料质感自然，裙摆与身体比例协调"

Input: "make it look vintage"
Output: "Apply vintage film photography style: add subtle warm color cast, reduce saturation slightly, add fine film grain texture, apply soft vignette around edges, maintain original composition and subject, create nostalgic 1970s aesthetic while preserving image clarity"`

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 增强模式
 */
export type EnhanceMode = 'generate' | 'edit'

/**
 * 增强选项
 */
export interface EnhanceOptions {
  /** 增强模式：generate（生成）或 edit（编辑） */
  mode?: EnhanceMode
  /** 参考图片（Base64 或 URL），用于编辑模式让模型看到原图 */
  referenceImage?: string
}

/**
 * 获取用于增强的模型
 * 使用与 useAssistant hook 相同的逻辑：
 * assistant.model ?? assistant.defaultModel ?? llm.defaultModel
 */
function getEnhanceModel(): { model: Model; assistant: Assistant } | null {
  const state = store.getState()
  const defaultAssistant = state.assistants.defaultAssistant
  const llmDefaultModel = state.llm.defaultModel

  // 按优先级获取模型：助手模型 > 助手默认模型 > 全局默认模型
  const model = defaultAssistant?.model ?? defaultAssistant?.defaultModel ?? llmDefaultModel

  if (!model) {
    logger.warn('No model found for prompt enhancement')
    return null
  }

  logger.debug('Found model for enhancement:', {
    source: defaultAssistant?.model
      ? 'assistant.model'
      : defaultAssistant?.defaultModel
        ? 'assistant.defaultModel'
        : 'llm.defaultModel',
    modelId: model.id,
    modelName: model.name
  })

  return { model, assistant: defaultAssistant }
}

/**
 * 根据模式选择系统提示词
 */
function getSystemPromptForMode(mode: EnhanceMode): string {
  return mode === 'edit' ? EDIT_ENHANCE_SYSTEM_PROMPT : GENERATE_ENHANCE_SYSTEM_PROMPT
}

/**
 * 根据模式生成用户消息
 */
function getUserMessageForMode(prompt: string, mode: EnhanceMode, hasReferenceImage?: boolean): string {
  if (mode === 'edit') {
    const contextNote = hasReferenceImage
      ? '\n\nI have attached the reference image that needs to be edited. Please analyze the image content and enhance my editing instruction accordingly.'
      : '\n\nNote: No reference image provided yet.'
    return `Please analyze and enhance the following image editing instruction:${contextNote}\n\nUser's editing request:\n${prompt}`
  }
  return `Please enhance the following image generation prompt:\n\n${prompt}`
}

/**
 * 增强图像生成/编辑提示词
 * @param prompt 原始提示词
 * @param options 增强选项
 * @returns 增强后的提示词
 */
export async function enhancePrompt(prompt: string, options?: EnhanceOptions): Promise<string> {
  const { mode = 'generate', referenceImage } = options || {}
  const hasReferenceImage = !!referenceImage

  if (!prompt || !prompt.trim()) {
    throw new Error('提示词不能为空')
  }

  // 获取模型
  const result = getEnhanceModel()
  if (!result) {
    throw new Error('未配置默认助手模型，请先在设置中配置默认助手模型')
  }

  const { model, assistant: defaultAssistant } = result
  const provider = getProviderByModel(model)
  if (!provider) {
    throw new Error('未找到模型对应的服务商')
  }

  if (!hasApiKey(provider)) {
    throw new Error('服务商未配置 API Key')
  }

  logger.info('Enhancing prompt with model:', {
    modelId: model.id,
    modelName: model.name,
    providerId: provider.id,
    mode,
    hasReferenceImage
  })

  // 创建 Legacy AI Provider 实例
  const aiProvider = new LegacyAiProvider(provider)

  // 根据模式选择系统提示词
  const systemPrompt = getSystemPromptForMode(mode)

  // 基于默认助手创建增强专用的 assistant 配置
  // 注意：必须禁用所有 thinking 相关的设置，否则会导致 API 错误
  const assistant: Assistant = {
    ...defaultAssistant,
    id: `enhance-${uuid()}`,
    name: mode === 'edit' ? 'Image Edit Prompt Enhancer' : 'Prompt Enhance Assistant',
    prompt: systemPrompt,
    model: model, // 确保使用正确的模型
    topics: [],
    settings: {
      // 只保留基本设置，不继承 thinking 相关的配置
      temperature: 0.7,
      contextCount: 1,
      streamOutput: false,
      enableMaxTokens: false,
      maxTokens: 0,
      topP: 1,
      enableTopP: false,
      enableTemperature: true,
      // 显式禁用所有 thinking 相关的设置
      reasoning_effort: undefined,
      qwenThinkMode: undefined,
      toolUseMode: undefined
    }
  }

  let resultText = ''

  // 根据模式生成用户消息文本
  const userMessageText = getUserMessageForMode(prompt, mode, hasReferenceImage)

  // 构建消息：如果有参考图片，使用 Message 对象格式；否则使用简单字符串
  let messages: Message[] | string = userMessageText

  // 如果有参考图片，构建包含图片的消息
  // 使用 Message 对象格式，并添加 images 属性让 API 客户端能够识别
  if (referenceImage && mode === 'edit') {
    const messageId = uuid()
    const now = new Date().toISOString()

    // 构建消息对象，使用 images 属性传递图片
    // API 客户端会识别这个属性并将图片添加到请求中
    const userMessage: Message & { images?: string[] } = {
      id: messageId,
      role: 'user',
      assistantId: assistant.id,
      topicId: 'enhance-topic',
      createdAt: now,
      status: UserMessageStatus.SUCCESS,
      blocks: [], // 空数组，因为我们使用 images 属性
      images: [referenceImage] // 直接传递图片 URL/Base64
    }

    messages = [userMessage as Message]
  }

  const completionsParams: CompletionsParams = {
    assistant,
    messages,
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

    const enhancedPrompt = resultText.trim()

    if (!enhancedPrompt) {
      throw new Error(`未获取到增强结果，请检查模型 "${model.name || model.id}" 是否支持文本生成`)
    }

    logger.info('Prompt enhanced successfully', {
      mode,
      originalLength: prompt.length,
      enhancedLength: enhancedPrompt.length
    })

    return enhancedPrompt
  } catch (error) {
    logger.error('Failed to enhance prompt:', error as Error)
    const errorMessage = (error as Error).message || String(error)

    // 提供更友好的错误信息
    if (errorMessage.includes('404')) {
      throw new Error(`模型服务不可用 (404)，请检查服务商 "${provider.name || provider.id}" 的 API 地址配置`)
    }
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new Error(`API Key 无效或已过期，请检查服务商 "${provider.name || provider.id}" 的 API Key 配置`)
    }
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      throw new Error(`没有访问权限，请检查服务商 "${provider.name || provider.id}" 的 API Key 权限`)
    }

    throw error
  }
}

/**
 * 检查是否可以使用提示词增强功能
 * @returns 是否可用
 */
export function canEnhancePrompt(): boolean {
  const result = getEnhanceModel()
  if (!result) return false

  const provider = getProviderByModel(result.model)
  if (!provider || !hasApiKey(provider)) return false

  return true
}

/**
 * 获取用于增强的模型信息
 * @returns 模型名称
 */
export function getEnhanceModelName(): string | null {
  const result = getEnhanceModel()
  if (!result) return null
  return result.model.name || result.model.id || null
}
