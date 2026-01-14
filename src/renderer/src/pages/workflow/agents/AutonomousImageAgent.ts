/**
 * 自主图片生成 Agent
 *
 * 编排意图分析、任务规划和执行的核心组件
 * 借鉴 VCP 的循环执行机制
 *
 * @module agents/AutonomousImageAgent
 */

import { createBase64Ref, type ImageRef, isImageRef } from '../types/core'
import { type GarmentAnalysis, intentAnalyzer, type IntentResult } from './IntentAnalyzer'
import { type TaskPlan, taskPlanner, type TaskStep } from './TaskPlanner'

// ==================== 类型定义 ====================

/**
 * 自主生成请求
 */
export interface AutonomousRequest {
  /** 用户消息 */
  userMessage: string
  /** 输入图片 */
  images: ImageRef[]
  /** 约束条件 */
  constraints?: {
    /** 强制任务类型 */
    taskType?: 'ecom' | 'model' | 'pattern' | 'video' | 'auto'
    /** 目标数量 */
    targetCount?: number
    /** 风格预设 */
    stylePreset?: string
    /** 最大执行时间（秒） */
    maxExecutionTime?: number
  }
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 自主生成结果
 */
export interface AutonomousResult {
  /** 是否成功 */
  success: boolean
  /** 检测到的任务类型 */
  taskType: string
  /** 生成的图片 */
  images: {
    /** 主图 */
    main?: ImageRef[]
    /** 背面图 */
    back?: ImageRef[]
    /** 细节图 */
    detail?: ImageRef[]
    /** 视频 URL */
    video?: string[]
  }
  /** 图片分析结果 */
  analysisResult?: GarmentAnalysis
  /** 执行计划 */
  executionPlan?: TaskPlan
  /** 执行统计 */
  stats?: {
    totalTime: number
    stepResults: StepResult[]
  }
  /** 错误信息 */
  error?: string
}

/**
 * 步骤执行结果
 */
export interface StepResult {
  stepId: string
  success: boolean
  images?: ImageRef[]
  error?: string
  duration: number
}

/**
 * 进度回调
 */
export type ProgressCallback = (progress: {
  phase: 'analyzing' | 'planning' | 'executing' | 'completed' | 'error'
  currentStep?: string
  stepProgress?: number
  totalProgress: number
  message: string
}) => void

/**
 * 图片生成函数类型
 */
export type GenerateImageFunc = (params: {
  prompt: string
  systemPrompt?: string
  images?: string[]
  config: Record<string, unknown>
}) => Promise<{ images: string[]; error?: string }>

/**
 * 图片分析函数类型
 */
export type AnalyzeImageFunc = (images: string[], prompt: string) => Promise<string>

// ==================== AutonomousImageAgent 类 ====================

/**
 * 自主图片生成 Agent
 *
 * 完整编排：意图分析 → 图片分析 → 任务规划 → 多步骤执行
 */
export class AutonomousImageAgent {
  private generateImageFunc?: GenerateImageFunc
  private analyzeImageFunc?: AnalyzeImageFunc

  /**
   * 设置图片生成函数
   */
  setGenerateImageFunc(func: GenerateImageFunc): void {
    this.generateImageFunc = func
  }

  /**
   * 设置图片分析函数
   */
  setAnalyzeImageFunc(func: AnalyzeImageFunc): void {
    this.analyzeImageFunc = func
  }

  /**
   * 执行自主生成
   *
   * @param request 生成请求
   * @param onProgress 进度回调
   * @returns 生成结果
   */
  async execute(request: AutonomousRequest, onProgress?: ProgressCallback): Promise<AutonomousResult> {
    const startTime = Date.now()
    const stepResults: StepResult[] = []

    try {
      // ==================== Phase 1: 意图分析 ====================
      onProgress?.({
        phase: 'analyzing',
        totalProgress: 0.1,
        message: '正在分析您的需求...'
      })

      const intent = this.analyzeIntent(request)

      // ==================== Phase 2: 图片分析 ====================
      let analysis: GarmentAnalysis | undefined

      if (request.images.length > 0 && this.analyzeImageFunc) {
        onProgress?.({
          phase: 'analyzing',
          totalProgress: 0.2,
          message: '正在分析图片内容...'
        })

        analysis = await intentAnalyzer.analyzeImages(request.images, this.analyzeImageFunc)
      }

      // ==================== Phase 3: 任务规划 ====================
      onProgress?.({
        phase: 'planning',
        totalProgress: 0.3,
        message: '正在制定生成计划...'
      })

      const plan = taskPlanner.plan(intent, analysis)

      onProgress?.({
        phase: 'planning',
        totalProgress: 0.35,
        message: plan.description
      })

      // ==================== Phase 4: 执行步骤 ====================
      const executionGroups = taskPlanner.groupStepsByDependency(plan.steps)
      const images: AutonomousResult['images'] = {
        main: [],
        back: [],
        detail: [],
        video: []
      }

      let completedSteps = 0
      const totalSteps = plan.steps.length

      for (const group of executionGroups) {
        // 检查取消信号
        if (request.signal?.aborted) {
          throw new Error('Generation cancelled')
        }

        // 并行执行组内步骤
        const groupResults = await Promise.allSettled(
          group.map((step) => this.executeStep(step, request, analysis, onProgress, completedSteps, totalSteps))
        )

        // 收集结果
        for (let i = 0; i < group.length; i++) {
          const step = group[i]
          const result = groupResults[i]

          if (result.status === 'fulfilled') {
            stepResults.push(result.value)

            // 分类收集图片
            if (result.value.images && result.value.images.length > 0) {
              switch (step.type) {
                case 'generate_main':
                  images.main?.push(...result.value.images)
                  break
                case 'generate_back':
                  images.back?.push(...result.value.images)
                  break
                case 'generate_detail':
                  images.detail?.push(...result.value.images)
                  break
                case 'generate_model':
                  images.main?.push(...result.value.images)
                  break
                case 'generate_pattern':
                  images.main?.push(...result.value.images)
                  break
              }
            }
          } else {
            stepResults.push({
              stepId: step.stepId,
              success: false,
              error: result.reason?.message || 'Unknown error',
              duration: 0
            })
          }

          completedSteps++
        }
      }

      // ==================== 完成 ====================
      const totalTime = Date.now() - startTime

      onProgress?.({
        phase: 'completed',
        totalProgress: 1,
        message: `生成完成！共生成 ${this.countImages(images)} 张图片，耗时 ${(totalTime / 1000).toFixed(1)}s`
      })

      return {
        success: true,
        taskType: intent.taskType,
        images,
        analysisResult: analysis,
        executionPlan: plan,
        stats: {
          totalTime,
          stepResults
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      onProgress?.({
        phase: 'error',
        totalProgress: 0,
        message: `生成失败: ${errorMessage}`
      })

      return {
        success: false,
        taskType: 'general',
        images: {},
        error: errorMessage,
        stats: {
          totalTime: Date.now() - startTime,
          stepResults
        }
      }
    }
  }

  /**
   * 分析用户意图
   */
  private analyzeIntent(request: AutonomousRequest): IntentResult {
    // 基础意图分析
    const intent = intentAnalyzer.analyzeUserIntent(request.userMessage)

    // 应用约束条件
    if (request.constraints) {
      if (request.constraints.taskType && request.constraints.taskType !== 'auto') {
        intent.taskType = request.constraints.taskType
      }
      if (request.constraints.targetCount) {
        intent.params.targetCount = request.constraints.targetCount
      }
      if (request.constraints.stylePreset) {
        intent.params.stylePreset = request.constraints.stylePreset
      }
    }

    return intent
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: TaskStep,
    request: AutonomousRequest,
    analysis: GarmentAnalysis | undefined,
    onProgress: ProgressCallback | undefined,
    completedSteps: number,
    totalSteps: number
  ): Promise<StepResult> {
    const stepStartTime = Date.now()

    onProgress?.({
      phase: 'executing',
      currentStep: step.stepId,
      stepProgress: 0,
      totalProgress: 0.35 + (completedSteps / totalSteps) * 0.6,
      message: step.description
    })

    try {
      if (!this.generateImageFunc) {
        throw new Error('Generate image function not set')
      }

      // 构建提示词
      const prompt = this.buildPromptForStep(step, request, analysis)

      // 准备输入图片 - 从 ImageRef 中提取 base64 值
      const inputImages = request.images
        .map((img) => {
          if (isImageRef(img)) {
            // 如果是 base64 类型的 ImageRef，直接返回值
            if (img.type === 'base64') {
              return img.value
            }
            // 其他类型的 ImageRef 暂不支持，需要先解析
            return ''
          }
          return ''
        })
        .filter(Boolean)

      // 调用生成函数
      const result = await this.generateImageFunc({
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        images: inputImages,
        config: step.config
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // 转换为 ImageRef - 使用正确的 createBase64Ref 函数
      const generatedImages: ImageRef[] = result.images.map((base64) =>
        createBase64Ref(base64, {
          filename: `${step.stepId}.png`,
          mimeType: 'image/png'
        })
      )

      onProgress?.({
        phase: 'executing',
        currentStep: step.stepId,
        stepProgress: 1,
        totalProgress: 0.35 + ((completedSteps + 1) / totalSteps) * 0.6,
        message: `${step.description} - 完成`
      })

      return {
        stepId: step.stepId,
        success: true,
        images: generatedImages,
        duration: Date.now() - stepStartTime
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        stepId: step.stepId,
        success: false,
        error: errorMessage,
        duration: Date.now() - stepStartTime
      }
    }
  }

  /**
   * 为步骤构建提示词
   */
  private buildPromptForStep(
    step: TaskStep,
    request: AutonomousRequest,
    analysis: GarmentAnalysis | undefined
  ): { systemPrompt: string; userPrompt: string } {
    const config = step.config as Record<string, unknown>

    // 基础系统提示词
    let systemPrompt = ''
    let userPrompt = ''

    switch (step.type) {
      case 'generate_main':
      case 'generate_back':
      case 'generate_detail':
        systemPrompt = `You are an expert e-commerce product photographer specializing in professional product images.
Focus on clean backgrounds, proper lighting, and commercial appeal.`

        userPrompt = this.buildEcomPrompt(step, request, analysis)
        break

      case 'generate_model':
        systemPrompt = `You are an expert fashion photographer specializing in model photography.
Focus on natural poses, appropriate settings, and commercial viability.`

        userPrompt = this.buildModelPrompt(step, request, analysis)
        break

      case 'generate_pattern':
        systemPrompt = `You are an expert textile designer specializing in commercial all-over prints for fabric.
Focus on seamless patterns, appropriate scaling, and commercial viability.`

        userPrompt = this.buildPatternPrompt(step, request, analysis)
        break

      default:
        userPrompt = (config.prompt as string) || request.userMessage
    }

    return { systemPrompt, userPrompt }
  }

  /**
   * 构建电商图提示词
   */
  private buildEcomPrompt(step: TaskStep, request: AutonomousRequest, analysis?: GarmentAnalysis): string {
    const config = step.config as Record<string, unknown>
    const parts: string[] = []

    // 添加任务描述
    if (step.type === 'generate_back') {
      parts.push('Generate the back view of this garment in flat lay photography style.')
    } else if (step.type === 'generate_detail') {
      const detailType = config.detailType as string
      parts.push(`Generate a close-up detail shot focusing on the ${detailType} of this garment.`)
    } else {
      parts.push('Generate a professional e-commerce product photo in flat lay photography style.')
    }

    // 添加分析结果
    if (analysis) {
      if (analysis.category) {
        parts.push(`Product: ${analysis.category}`)
      }
      if (analysis.colors?.length) {
        parts.push(`Colors: ${analysis.colors.join(', ')}`)
      }
      if (analysis.styleTags?.length) {
        parts.push(`Style: ${analysis.styleTags.join(', ')}`)
      }
    }

    // 添加用户描述
    if (request.userMessage && request.userMessage.length < 200) {
      parts.push(`User request: ${request.userMessage}`)
    }

    // 添加技术要求
    parts.push('Requirements: Clean white background, soft even lighting, high resolution, professional quality.')

    return parts.join('\n')
  }

  /**
   * 构建模特图提示词
   */
  private buildModelPrompt(step: TaskStep, _request: AutonomousRequest, analysis?: GarmentAnalysis): string {
    const config = step.config as Record<string, unknown>
    const parts: string[] = []

    const pose = (config.pose as string) || 'standing_front'
    const scene = (config.scene as string) || 'studio_white'

    parts.push(`Generate a model wearing this garment in ${pose} pose.`)
    parts.push(`Scene: ${scene}`)

    if (analysis?.styleTags?.length) {
      parts.push(`Style: ${analysis.styleTags.join(', ')}`)
    }

    parts.push('Requirements: Natural lighting, professional quality, commercial appeal.')

    return parts.join('\n')
  }

  /**
   * 构建图案提示词
   */
  private buildPatternPrompt(_step: TaskStep, request: AutonomousRequest, analysis?: GarmentAnalysis): string {
    const parts: string[] = []

    parts.push('Generate a seamless, tileable pattern suitable for fabric printing.')

    if (analysis?.patterns?.length) {
      parts.push(`Pattern elements: ${analysis.patterns.join(', ')}`)
    }
    if (analysis?.colors?.length) {
      parts.push(`Color palette: ${analysis.colors.join(', ')}`)
    }

    parts.push(request.userMessage)
    parts.push('Requirements: Seamless edges, suitable for commercial textile printing.')

    return parts.join('\n')
  }

  /**
   * 统计生成的图片数量
   */
  private countImages(images: AutonomousResult['images']): number {
    let count = 0
    if (images.main) count += images.main.length
    if (images.back) count += images.back.length
    if (images.detail) count += images.detail.length
    return count
  }
}

/**
 * 单例实例
 */
export const autonomousImageAgent = new AutonomousImageAgent()

export default autonomousImageAgent
