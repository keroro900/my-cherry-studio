/**
 * 智能模型推荐系统
 * 根据任务类型、节点配置自动推荐最佳 AI 模型
 */

import type { Model } from '@renderer/types'

import type { WorkflowNodeData, WorkflowNodeType } from '../types'

/**
 * 任务类型分类
 */
export enum TaskCategory {
  TEXT_GENERATION = 'text_generation', // 文本生成
  CODE_GENERATION = 'code_generation', // 代码生成
  IMAGE_UNDERSTANDING = 'image_understanding', // 图像理解
  IMAGE_GENERATION = 'image_generation', // 图像生成
  VIDEO_GENERATION = 'video_generation', // 视频生成
  TRANSLATION = 'translation', // 翻译
  SUMMARIZATION = 'summarization', // 摘要
  QA = 'qa', // 问答
  CHAT = 'chat', // 对话
  REASONING = 'reasoning', // 推理
  MULTIMODAL = 'multimodal' // 多模态
}

/**
 * 模型能力评分
 */
interface ModelCapability {
  model: Model
  score: number // 0-100 评分
  reasons: string[] // 推荐理由
}

/**
 * 模型推荐规则
 */
interface RecommendationRule {
  category: TaskCategory
  preferredProviders: string[] // 优先的provider
  minContextLength?: number // 最小上下文长度
  requiresVision?: boolean // 是否需要视觉能力
  requiresStreaming?: boolean // 是否需要流式输出
  preferredModels?: string[] // 优先的模型名称（模糊匹配）
}

/**
 * 推荐规则库
 */
const RECOMMENDATION_RULES: Record<TaskCategory, RecommendationRule> = {
  [TaskCategory.TEXT_GENERATION]: {
    category: TaskCategory.TEXT_GENERATION,
    preferredProviders: ['openai', 'anthropic', 'google'],
    minContextLength: 4000,
    preferredModels: ['gpt-4', 'claude', 'gemini']
  },
  [TaskCategory.CODE_GENERATION]: {
    category: TaskCategory.CODE_GENERATION,
    preferredProviders: ['openai', 'anthropic'],
    minContextLength: 8000,
    preferredModels: ['gpt-4', 'claude', 'o1']
  },
  [TaskCategory.IMAGE_UNDERSTANDING]: {
    category: TaskCategory.IMAGE_UNDERSTANDING,
    preferredProviders: ['openai', 'anthropic', 'google'],
    requiresVision: true,
    preferredModels: ['gpt-4-vision', 'claude-3', 'gemini-pro-vision']
  },
  [TaskCategory.IMAGE_GENERATION]: {
    category: TaskCategory.IMAGE_GENERATION,
    preferredProviders: ['openai', 'stability'],
    preferredModels: ['dall-e', 'stable-diffusion']
  },
  [TaskCategory.VIDEO_GENERATION]: {
    category: TaskCategory.VIDEO_GENERATION,
    preferredProviders: ['runway', 'pika'],
    preferredModels: ['gen-2', 'pika']
  },
  [TaskCategory.TRANSLATION]: {
    category: TaskCategory.TRANSLATION,
    preferredProviders: ['openai', 'anthropic', 'google'],
    minContextLength: 4000,
    preferredModels: ['gpt-4', 'claude', 'gemini']
  },
  [TaskCategory.SUMMARIZATION]: {
    category: TaskCategory.SUMMARIZATION,
    preferredProviders: ['openai', 'anthropic'],
    minContextLength: 8000,
    preferredModels: ['gpt-4', 'claude']
  },
  [TaskCategory.QA]: {
    category: TaskCategory.QA,
    preferredProviders: ['openai', 'anthropic', 'google'],
    minContextLength: 4000,
    preferredModels: ['gpt-4', 'claude', 'gemini']
  },
  [TaskCategory.CHAT]: {
    category: TaskCategory.CHAT,
    preferredProviders: ['openai', 'anthropic'],
    requiresStreaming: true,
    preferredModels: ['gpt-4', 'claude']
  },
  [TaskCategory.REASONING]: {
    category: TaskCategory.REASONING,
    preferredProviders: ['openai', 'anthropic'],
    minContextLength: 8000,
    preferredModels: ['o1', 'gpt-4', 'claude-3-opus']
  },
  [TaskCategory.MULTIMODAL]: {
    category: TaskCategory.MULTIMODAL,
    preferredProviders: ['openai', 'anthropic', 'google'],
    requiresVision: true,
    minContextLength: 8000,
    preferredModels: ['gpt-4-vision', 'claude-3', 'gemini-pro-vision']
  }
}

/**
 * 从节点类型推断任务分类
 */
export function inferTaskCategory(nodeType: WorkflowNodeType, config: WorkflowNodeData['config']): TaskCategory {
  switch (nodeType) {
    case 'unified_prompt':
    case 'gemini_generate':
    case 'gemini_generate_model':
      return TaskCategory.TEXT_GENERATION

    case 'video_prompt':
    case 'gemini_ecom':
    case 'gemini_model_from_clothes':
    case 'compare_image':
      return TaskCategory.IMAGE_UNDERSTANDING

    case 'kling_image2video':
      return TaskCategory.VIDEO_GENERATION

    case 'gemini_edit':
    case 'gemini_edit_custom':
      return TaskCategory.IMAGE_GENERATION

    default:
      // 根据配置推断
      if (config?.prompt && typeof config.prompt === 'string') {
        const prompt = config.prompt.toLowerCase()
        if (prompt.includes('translate') || prompt.includes('翻译')) {
          return TaskCategory.TRANSLATION
        }
        if (prompt.includes('summarize') || prompt.includes('总结') || prompt.includes('摘要')) {
          return TaskCategory.SUMMARIZATION
        }
        if (prompt.includes('code') || prompt.includes('代码')) {
          return TaskCategory.CODE_GENERATION
        }
        if (prompt.includes('reason') || prompt.includes('推理') || prompt.includes('分析')) {
          return TaskCategory.REASONING
        }
      }

      return TaskCategory.TEXT_GENERATION
  }
}

/**
 * 评估模型是否支持视觉输入
 */
function supportsVision(model: Model): boolean {
  const visionKeywords = ['vision', 'visual', 'image', 'multimodal', 'claude-3', 'gpt-4-turbo', 'gemini-pro']
  const modelName = model.name.toLowerCase()
  return visionKeywords.some((keyword) => modelName.includes(keyword))
}

/**
 * 评估模型的上下文长度
 */
function getContextLength(model: Model): number {
  // 尝试从模型信息中提取上下文长度
  // 这里需要根据实际的 Model 类型定义来实现
  // 临时返回默认值
  void model
  return 4000
}

/**
 * 评估模型匹配度
 */
function scoreModel(model: Model, rule: RecommendationRule): ModelCapability {
  let score = 0
  const reasons: string[] = []

  // 1. Provider 匹配 (30分)
  const providerMatch = rule.preferredProviders.some((p) => model.provider?.toLowerCase().includes(p.toLowerCase()))
  if (providerMatch) {
    score += 30
    reasons.push('来自推荐的提供商')
  }

  // 2. 模型名称匹配 (25分)
  if (rule.preferredModels) {
    const nameMatch = rule.preferredModels.some((name) => model.name.toLowerCase().includes(name.toLowerCase()))
    if (nameMatch) {
      score += 25
      reasons.push('模型类型匹配')
    }
  }

  // 3. 视觉能力 (20分)
  if (rule.requiresVision) {
    if (supportsVision(model)) {
      score += 20
      reasons.push('支持视觉输入')
    } else {
      score -= 30 // 需要但不支持，大幅降分
      reasons.push('⚠️ 不支持视觉输入')
    }
  }

  // 4. 上下文长度 (15分)
  if (rule.minContextLength) {
    const contextLength = getContextLength(model)
    if (contextLength >= rule.minContextLength) {
      score += 15
      reasons.push(`上下文长度充足 (${contextLength})`)
    } else {
      score -= 10
      reasons.push(`⚠️ 上下文长度不足 (${contextLength} < ${rule.minContextLength})`)
    }
  }

  // 5. 流式输出 (10分)
  if (rule.requiresStreaming) {
    // 假设大多数模型都支持流式输出
    score += 10
    reasons.push('支持流式输出')
  }

  return {
    model,
    score: Math.max(0, score), // 确保分数不为负
    reasons
  }
}

/**
 * 推荐模型
 * @param nodeType 节点类型
 * @param config 节点配置
 * @param availableModels 可用的模型列表
 * @param topN 返回前N个推荐
 * @returns 推荐的模型列表，按评分排序
 */
export function recommendModels(
  nodeType: WorkflowNodeType,
  config: WorkflowNodeData['config'],
  availableModels: Model[],
  topN: number = 5
): ModelCapability[] {
  // 1. 推断任务类型
  const taskCategory = inferTaskCategory(nodeType, config)

  // 2. 获取推荐规则
  const rule = RECOMMENDATION_RULES[taskCategory]

  // 3. 评估所有模型
  const scoredModels = availableModels.map((model) => scoreModel(model, rule))

  // 4. 排序并返回前N个
  return scoredModels
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .filter((m) => m.score > 0) // 只返回有正分的模型
}

/**
 * 获取任务类别的说明
 */
export function getTaskCategoryDescription(category: TaskCategory): string {
  const descriptions: Record<TaskCategory, string> = {
    [TaskCategory.TEXT_GENERATION]: '文本生成任务，生成文章、回复等',
    [TaskCategory.CODE_GENERATION]: '代码生成任务，编写和优化代码',
    [TaskCategory.IMAGE_UNDERSTANDING]: '图像理解任务，分析和描述图片',
    [TaskCategory.IMAGE_GENERATION]: '图像生成任务，创建和编辑图片',
    [TaskCategory.VIDEO_GENERATION]: '视频生成任务，创建视频内容',
    [TaskCategory.TRANSLATION]: '翻译任务，语言之间的转换',
    [TaskCategory.SUMMARIZATION]: '摘要任务，提取关键信息',
    [TaskCategory.QA]: '问答任务，回答具体问题',
    [TaskCategory.CHAT]: '对话任务，自然交互',
    [TaskCategory.REASONING]: '推理任务，逻辑分析和推导',
    [TaskCategory.MULTIMODAL]: '多模态任务，结合文本和视觉'
  }
  return descriptions[category]
}
