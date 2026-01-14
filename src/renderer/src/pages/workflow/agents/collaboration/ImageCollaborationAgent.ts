/**
 * 多Agent协同图片生成器
 *
 * 协调多个 AI Agent 协作完成图片生成任务
 * 借鉴 VCP MagiAgent 的多角色协作模式
 *
 * @module agents/collaboration/ImageCollaborationAgent
 */

import type { Model, Provider } from '@renderer/types'
import { v4 as uuid } from 'uuid'

import type { GarmentAnalysis, ImageRef, TaskPlan, TaskType } from '../index'
import { createBase64Ref, intentAnalyzer, taskPlanner } from '../index'
import type {
  CollaborationAgentConfig,
  CollaborationEvent,
  CollaborationEventCallback,
  CollaborationMessage,
  CollaborationRole,
  CollaborationSessionConfig,
  CollaborationSessionState,
  QualityReview
} from './types'
import { COLLABORATION_ROLES } from './types'

// ==================== 类型定义 ====================

/**
 * Agent 执行函数
 */
export interface AgentFunctions {
  /** 视觉分析 */
  analyzeImage: (provider: Provider, model: Model, images: string[], prompt: string) => Promise<string>
  /** 文本生成 */
  generateText: (provider: Provider, model: Model, systemPrompt: string, userPrompt: string) => Promise<string>
  /** 图片生成 */
  generateImage: (
    provider: Provider,
    model: Model,
    prompt: string,
    images?: string[],
    config?: { aspectRatio?: string; imageSize?: string }
  ) => Promise<string>
}

/**
 * 协作请求
 */
export interface CollaborationRequest {
  /** 用户消息 */
  userMessage: string
  /** 输入图片 */
  images: ImageRef[]
  /** 任务类型（可选，自动检测） */
  taskType?: TaskType
  /** 自定义 Agent 配置 */
  agentConfigs?: Partial<Record<CollaborationRole, { provider: Provider; model: Model }>>
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 协作结果
 */
export interface CollaborationResult {
  /** 是否成功 */
  success: boolean
  /** 生成的图片 */
  images: {
    main?: ImageRef[]
    back?: ImageRef[]
    detail?: ImageRef[]
  }
  /** 会话消息历史 */
  messages: CollaborationMessage[]
  /** 分析结果 */
  analysisResult?: GarmentAnalysis
  /** 执行计划 */
  executionPlan?: TaskPlan
  /** 质检结果 */
  qualityReviews: QualityReview[]
  /** 耗时统计 */
  stats: {
    totalTime: number
    phases: Record<string, number>
  }
  /** 错误信息 */
  error?: string
}

// ==================== ImageCollaborationAgent 类 ====================

/**
 * 多Agent协同图片生成器
 *
 * 工作流程：
 * 1. 分析师 → 分析图片，提取特征
 * 2. 规划师 → 制定生成计划
 * 3. 生成师 → 执行图片生成
 * 4. 质检师 → 检查质量，决定是否重试
 */
export class ImageCollaborationAgent {
  private agentFunctions?: AgentFunctions
  private defaultProviders: Map<CollaborationRole, { provider: Provider; model: Model }> = new Map()
  private eventCallbacks: CollaborationEventCallback[] = []

  /**
   * 设置 Agent 执行函数
   */
  setAgentFunctions(functions: AgentFunctions): void {
    this.agentFunctions = functions
  }

  /**
   * 设置默认 Provider（按角色）
   */
  setDefaultProvider(role: CollaborationRole, provider: Provider, model: Model): void {
    this.defaultProviders.set(role, { provider, model })
  }

  /**
   * 订阅协作事件
   */
  subscribe(callback: CollaborationEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(event: CollaborationEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (e) {
        console.error('[ImageCollaborationAgent] Event callback error:', e)
      }
    }
  }

  /**
   * 执行协作生成
   */
  async execute(request: CollaborationRequest): Promise<CollaborationResult> {
    const startTime = Date.now()
    const phaseStats: Record<string, number> = {}

    // 初始化会话状态
    const state: CollaborationSessionState = {
      config: this.buildSessionConfig(request),
      currentPhase: 'analyzing',
      currentSpeaker: null,
      messages: [],
      generatedImages: [],
      qualityReviews: [],
      retryCount: 0,
      startTime: new Date()
    }

    try {
      this.emit({ type: 'session:start', config: state.config })

      // ==================== Phase 1: 分析 ====================
      const analysisStart = Date.now()
      this.emit({ type: 'phase:change', phase: 'analyzing' })
      state.currentPhase = 'analyzing'

      const analysis = await this.runAnalyst(request, state)
      state.analysisResult = analysis
      phaseStats.analyzing = Date.now() - analysisStart

      // 检查取消
      if (request.signal?.aborted) {
        throw new Error('协作已取消')
      }

      // ==================== Phase 2: 规划 ====================
      const planningStart = Date.now()
      this.emit({ type: 'phase:change', phase: 'planning' })
      state.currentPhase = 'planning'

      const plan = await this.runPlanner(request, state, analysis)
      state.executionPlan = plan
      phaseStats.planning = Date.now() - planningStart

      // 检查取消
      if (request.signal?.aborted) {
        throw new Error('协作已取消')
      }

      // ==================== Phase 3: 生成 ====================
      const generatingStart = Date.now()
      this.emit({ type: 'phase:change', phase: 'generating' })
      state.currentPhase = 'generating'

      const images = await this.runGenerator(request, state, plan)
      state.generatedImages = images
      phaseStats.generating = Date.now() - generatingStart

      // ==================== Phase 4: 质检 ====================
      const reviewingStart = Date.now()
      this.emit({ type: 'phase:change', phase: 'reviewing' })
      state.currentPhase = 'reviewing'

      const review = await this.runQualityChecker(request, state, images)
      state.qualityReviews.push(review)
      phaseStats.reviewing = Date.now() - reviewingStart

      // 如果质检不通过且未超过重试次数，重试生成
      if (!review.passed && state.retryCount < state.config.maxRetries) {
        state.retryCount++
        this.emit({ type: 'retry:start', reason: '质检未通过，重新生成' })

        // 重新生成失败的图片
        const regeneratedImages = await this.regenerateImages(request, state, review)
        state.generatedImages = regeneratedImages

        // 再次质检
        const reReview = await this.runQualityChecker(request, state, regeneratedImages)
        state.qualityReviews.push(reReview)
      }

      // ==================== 完成 ====================
      state.currentPhase = 'completed'
      this.emit({ type: 'phase:change', phase: 'completed' })

      // 分类图片
      const categorizedImages = this.categorizeImages(state.generatedImages, plan)

      this.emit({
        type: 'session:end',
        success: true,
        images: state.generatedImages
      })

      return {
        success: true,
        images: categorizedImages,
        messages: state.messages,
        analysisResult: state.analysisResult,
        executionPlan: state.executionPlan,
        qualityReviews: state.qualityReviews,
        stats: {
          totalTime: Date.now() - startTime,
          phases: phaseStats
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      state.currentPhase = 'error'
      state.error = errorMessage

      this.emit({ type: 'error', error: errorMessage })
      this.emit({ type: 'session:end', success: false, images: [] })

      return {
        success: false,
        images: {},
        messages: state.messages,
        qualityReviews: state.qualityReviews,
        stats: {
          totalTime: Date.now() - startTime,
          phases: phaseStats
        },
        error: errorMessage
      }
    }
  }

  // ==================== Agent 执行方法 ====================

  /**
   * 运行分析师 Agent
   */
  private async runAnalyst(request: CollaborationRequest, state: CollaborationSessionState): Promise<GarmentAnalysis> {
    const role: CollaborationRole = 'analyst'

    try {
      const config = this.getAgentConfig(role, request)

      this.emit({ type: 'agent:thinking', role })
      state.currentSpeaker = role

      if (!this.agentFunctions) {
        throw new Error('Agent functions not set. Please call initialize() first.')
      }

      // 提取图片 base64
      const imageBase64s = request.images.filter((img) => img.type === 'base64').map((img) => img.value)

      if (imageBase64s.length === 0) {
        throw new Error('没有提供有效的图片进行分析')
      }

      const prompt = `分析这张服装图片，提取以下信息：
1. 服装类别（如：连衣裙、T恤、外套等）
2. 主要颜色和辅助颜色
3. 图案类型（纯色、印花、条纹等）
4. 材质判断（棉、涤纶、丝绸等）
5. 风格标签（休闲、商务、运动等）
6. 适合的拍摄角度和细节展示点

用户需求：${request.userMessage}

请以 JSON 格式输出分析结果。`

      const response = await this.agentFunctions.analyzeImage(config.provider, config.model, imageBase64s, prompt)

      // 解析分析结果
      const analysis = this.parseAnalysisResponse(response)

      // 记录消息
      const message = this.createMessage(role, response, 'analysis', ['planner'])
      message.data = { analysis }
      state.messages.push(message)
      this.emit({ type: 'agent:speak', message })

      return analysis
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.emit({ type: 'error', error: `分析师: ${errorMsg}` })
      throw new Error(`分析师执行失败: ${errorMsg}`)
    }
  }

  /**
   * 运行规划师 Agent
   */
  private async runPlanner(
    request: CollaborationRequest,
    state: CollaborationSessionState,
    analysis: GarmentAnalysis
  ): Promise<TaskPlan> {
    const role: CollaborationRole = 'planner'

    try {
      const config = this.getAgentConfig(role, request)

      this.emit({ type: 'agent:thinking', role })
      state.currentSpeaker = role

      if (!this.agentFunctions) {
        throw new Error('Agent functions not set. Please call initialize() first.')
      }

      // 使用 IntentAnalyzer 分析意图
      const intent = intentAnalyzer.analyzeUserIntent(request.userMessage)

      // 应用任务类型覆盖
      if (request.taskType) {
        intent.taskType = request.taskType
      }

      // 使用 TaskPlanner 生成计划
      const plan = taskPlanner.plan(intent, analysis)

      // 让规划师 Agent 补充说明
      const prompt = `基于以下分析结果，请确认生成计划：

服装分析：
- 类别：${analysis.category || '未知'}
- 颜色：${analysis.colors?.join(', ') || '未知'}
- 风格：${analysis.styleTags?.join(', ') || '未知'}

生成计划：
${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

用户需求：${request.userMessage}

请确认计划是否合理，如有补充建议请说明。`

      const response = await this.agentFunctions.generateText(
        config.provider,
        config.model,
        COLLABORATION_ROLES.planner.systemPrompt,
        prompt
      )

      // 记录消息
      const message = this.createMessage(role, response, 'plan', ['generator'])
      message.data = { plan }
      state.messages.push(message)
      this.emit({ type: 'agent:speak', message })

      return plan
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.emit({ type: 'error', error: `规划师: ${errorMsg}` })
      throw new Error(`规划师执行失败: ${errorMsg}`)
    }
  }

  /**
   * 运行生成师 Agent
   */
  private async runGenerator(
    request: CollaborationRequest,
    state: CollaborationSessionState,
    plan: TaskPlan
  ): Promise<ImageRef[]> {
    const role: CollaborationRole = 'generator'
    const config = this.getAgentConfig(role, request)

    this.emit({ type: 'agent:thinking', role })
    state.currentSpeaker = role

    if (!this.agentFunctions) {
      throw new Error('Agent functions not set')
    }

    const generatedImages: ImageRef[] = []

    // 提取输入图片
    const inputImageBase64s = request.images.filter((img) => img.type === 'base64').map((img) => img.value)

    // 按计划生成图片
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]

      // 跳过非生成步骤
      if (!step.type.startsWith('generate_')) {
        continue
      }

      const stepConfig = step.config as Record<string, unknown>
      const prompt = this.buildGenerationPrompt(step, state.analysisResult)

      try {
        const imageBase64 = await this.agentFunctions.generateImage(
          config.provider,
          config.model,
          prompt,
          inputImageBase64s,
          {
            aspectRatio: (stepConfig.aspectRatio as string) || '3:4',
            imageSize: (stepConfig.imageSize as string) || '2K'
          }
        )

        const imageRef = createBase64Ref(imageBase64, {
          filename: `${step.stepId}.png`,
          mimeType: 'image/png'
        })

        generatedImages.push(imageRef)

        this.emit({
          type: 'image:generated',
          image: imageRef,
          index: generatedImages.length - 1
        })
      } catch (error) {
        console.error(`[Generator] Step ${step.stepId} failed:`, error)
        // 继续生成其他图片
      }
    }

    // 记录消息
    const message = this.createMessage(
      role,
      `已完成 ${generatedImages.length} 张图片生成，请 @质检师 检查质量。`,
      'image',
      ['quality_checker']
    )
    message.images = generatedImages
    state.messages.push(message)
    this.emit({ type: 'agent:speak', message })

    return generatedImages
  }

  /**
   * 运行质检师 Agent
   */
  private async runQualityChecker(
    request: CollaborationRequest,
    state: CollaborationSessionState,
    images: ImageRef[]
  ): Promise<QualityReview> {
    const role: CollaborationRole = 'quality_checker'
    const config = this.getAgentConfig(role, request)

    this.emit({ type: 'agent:thinking', role })
    state.currentSpeaker = role

    if (!this.agentFunctions) {
      throw new Error('Agent functions not set')
    }

    // 提取图片 base64 进行分析
    const imageBase64s = images.filter((img) => img.type === 'base64').map((img) => img.value)

    // 原图 base64
    const originalImageBase64s = request.images.filter((img) => img.type === 'base64').map((img) => img.value)

    const prompt = `请检查这些生成的电商产品图片质量：

检查项目：
1. 清晰度：图片是否清晰，无模糊
2. 构图：产品是否居中，比例是否合适
3. 背景：背景是否干净，无杂物
4. 一致性：与原图服装是否一致（颜色、款式、细节）

原图数量：${originalImageBase64s.length}
生成图数量：${imageBase64s.length}

请评估每张图片并给出：
1. 是否通过（passed: true/false）
2. 评分（score: 0-100）
3. 各项检查结果
4. 改进建议（如果有）

以 JSON 格式输出。`

    const response = await this.agentFunctions.analyzeImage(
      config.provider,
      config.model,
      [...originalImageBase64s, ...imageBase64s],
      prompt
    )

    // 解析质检结果
    const review = this.parseQualityReview(response)

    // 记录消息
    const message = this.createMessage(
      role,
      review.passed
        ? `✅ 质检通过！评分：${review.score}/100`
        : `⚠️ 质检未通过，评分：${review.score}/100。建议：${review.suggestions?.join('; ')}`,
      'review',
      review.passed ? [] : ['generator']
    )
    message.data = { review }
    state.messages.push(message)
    this.emit({ type: 'agent:speak', message })
    this.emit({ type: 'review:complete', review })

    return review
  }

  /**
   * 重新生成失败的图片
   */
  private async regenerateImages(
    request: CollaborationRequest,
    state: CollaborationSessionState,
    review: QualityReview
  ): Promise<ImageRef[]> {
    // 如果没有指定重新生成的索引，重新生成所有
    const indicesToRegenerate = review.regenerateIndices || state.generatedImages.map((_, i) => i)

    const newImages = [...state.generatedImages]

    // 重新生成指定的图片
    for (const index of indicesToRegenerate) {
      if (index < 0 || index >= newImages.length) continue

      const step = state.executionPlan?.steps[index]
      if (!step) continue

      const config = this.getAgentConfig('generator', request)
      const inputImageBase64s = request.images.filter((img) => img.type === 'base64').map((img) => img.value)

      // 加入改进建议到提示词
      const basePrompt = this.buildGenerationPrompt(step, state.analysisResult)
      const improvedPrompt = review.suggestions
        ? `${basePrompt}\n\n注意改进：${review.suggestions.join('; ')}`
        : basePrompt

      try {
        const imageBase64 = await this.agentFunctions!.generateImage(
          config.provider,
          config.model,
          improvedPrompt,
          inputImageBase64s,
          {
            aspectRatio: ((step.config as Record<string, unknown>).aspectRatio as string) || '3:4',
            imageSize: ((step.config as Record<string, unknown>).imageSize as string) || '2K'
          }
        )

        newImages[index] = createBase64Ref(imageBase64, {
          filename: `${step.stepId}_retry.png`,
          mimeType: 'image/png'
        })
      } catch (error) {
        console.error(`[Regenerate] Index ${index} failed:`, error)
      }
    }

    return newImages
  }

  // ==================== 辅助方法 ====================

  /**
   * 构建会话配置
   */
  private buildSessionConfig(request: CollaborationRequest): CollaborationSessionConfig {
    const taskType = request.taskType || intentAnalyzer.analyzeUserIntent(request.userMessage).taskType

    // 构建 Agent 配置
    const agents: CollaborationAgentConfig[] = []
    const roles: CollaborationRole[] = ['analyst', 'planner', 'generator', 'quality_checker']

    for (const role of roles) {
      const providerModel = request.agentConfigs?.[role] || this.defaultProviders.get(role)
      if (!providerModel) {
        console.warn(`[ImageCollaborationAgent] No provider configured for role: ${role}`)
        continue
      }

      agents.push({
        ...COLLABORATION_ROLES[role],
        provider: providerModel.provider,
        model: providerModel.model
      })
    }

    return {
      sessionId: uuid(),
      taskType,
      agents,
      maxRetries: 2,
      autoProgress: true,
      showThinking: true,
      timeout: 300000 // 5 分钟
    }
  }

  /**
   * 获取 Agent 配置
   */
  private getAgentConfig(role: CollaborationRole, request: CollaborationRequest): { provider: Provider; model: Model } {
    const customConfig = request.agentConfigs?.[role]
    if (customConfig) {
      return customConfig
    }

    const defaultConfig = this.defaultProviders.get(role)
    if (defaultConfig) {
      return defaultConfig
    }

    throw new Error(`No provider configured for role: ${role}`)
  }

  /**
   * 创建消息
   */
  private createMessage(
    role: CollaborationRole,
    content: string,
    type: CollaborationMessage['type'],
    mentions: CollaborationRole[]
  ): CollaborationMessage {
    return {
      id: uuid(),
      senderRole: role,
      senderName: COLLABORATION_ROLES[role].displayName,
      content,
      timestamp: new Date(),
      type,
      mentions
    }
  }

  /**
   * 构建生成提示词
   */
  private buildGenerationPrompt(
    step: { type: string; config: Record<string, unknown>; description: string },
    analysis?: GarmentAnalysis
  ): string {
    const parts: string[] = []

    // 基础描述
    parts.push(step.description)

    // 添加分析信息
    if (analysis) {
      if (analysis.category) {
        parts.push(`产品类型：${analysis.category}`)
      }
      if (analysis.colors?.length) {
        parts.push(`颜色：${analysis.colors.join(', ')}`)
      }
      if (analysis.styleTags?.length) {
        parts.push(`风格：${analysis.styleTags.join(', ')}`)
      }
    }

    // 根据步骤类型添加特定要求
    switch (step.type) {
      case 'generate_main':
        parts.push('要求：白色背景，平铺展示，专业电商风格')
        break
      case 'generate_back':
        parts.push('要求：展示服装背面，保持与正面图一致的风格')
        break
      case 'generate_detail':
        parts.push(`要求：展示 ${step.config.detailType || '细节'}，近距离特写`)
        break
      case 'generate_model':
        parts.push('要求：模特穿着展示，自然姿势，专业摄影')
        break
    }

    return parts.join('\n')
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(response: string): GarmentAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败
    }
    return { rawAnalysis: response }
  }

  /**
   * 解析质检结果
   */
  private parseQualityReview(response: string): QualityReview {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          passed: parsed.passed ?? true,
          score: parsed.score ?? 80,
          checks: parsed.checks ?? {
            clarity: { passed: true, comment: '' },
            composition: { passed: true, comment: '' },
            background: { passed: true, comment: '' },
            consistency: { passed: true, comment: '' }
          },
          suggestions: parsed.suggestions,
          regenerateIndices: parsed.regenerateIndices
        }
      }
    } catch {
      // 解析失败
    }

    // 默认通过
    return {
      passed: true,
      score: 75,
      checks: {
        clarity: { passed: true, comment: '自动通过' },
        composition: { passed: true, comment: '自动通过' },
        background: { passed: true, comment: '自动通过' },
        consistency: { passed: true, comment: '自动通过' }
      }
    }
  }

  /**
   * 分类图片
   */
  private categorizeImages(
    images: ImageRef[],
    plan: TaskPlan
  ): { main?: ImageRef[]; back?: ImageRef[]; detail?: ImageRef[] } {
    const result: { main?: ImageRef[]; back?: ImageRef[]; detail?: ImageRef[] } = {
      main: [],
      back: [],
      detail: []
    }

    for (let i = 0; i < images.length && i < plan.steps.length; i++) {
      const step = plan.steps[i]
      const image = images[i]

      switch (step.type) {
        case 'generate_main':
        case 'generate_model':
        case 'generate_pattern':
          result.main?.push(image)
          break
        case 'generate_back':
          result.back?.push(image)
          break
        case 'generate_detail':
          result.detail?.push(image)
          break
      }
    }

    return result
  }
}

/**
 * 单例实例
 */
export const imageCollaborationAgent = new ImageCollaborationAgent()

export default imageCollaborationAgent
