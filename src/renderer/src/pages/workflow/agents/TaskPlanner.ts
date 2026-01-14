/**
 * 任务规划器
 *
 * 根据意图分析结果生成执行计划
 * 借鉴 VCP 的任务分解模式和 EcomStrategy 的多步骤并行模式
 *
 * @module agents/TaskPlanner
 */

import type { GarmentAnalysis, IntentResult, TaskType } from './IntentAnalyzer'

// ==================== 类型定义 ====================

/**
 * 任务步骤类型
 */
export type StepType =
  | 'analyze' // 分析图片
  | 'generate_main' // 生成主图
  | 'generate_back' // 生成背面图
  | 'generate_detail' // 生成细节图
  | 'generate_model' // 生成模特图
  | 'generate_pattern' // 生成图案
  | 'generate_video' // 生成视频
  | 'edit' // 编辑图片

/**
 * 任务步骤
 */
export interface TaskStep {
  /** 步骤 ID */
  stepId: string
  /** 步骤类型 */
  type: StepType
  /** 策略名称（对应 strategyRegistry 中的策略） */
  strategyName: string
  /** 步骤配置 */
  config: Record<string, unknown>
  /** 依赖的步骤 ID（必须在这些步骤完成后执行） */
  dependencies: string[]
  /** 是否可以与同级步骤并行执行 */
  parallel?: boolean
  /** 步骤描述（用于进度显示） */
  description: string
  /** 预估耗时（秒） */
  estimatedTime?: number
}

/**
 * 任务计划
 */
export interface TaskPlan {
  /** 计划 ID */
  planId: string
  /** 任务类型 */
  taskType: TaskType
  /** 执行步骤 */
  steps: TaskStep[]
  /** 预估总耗时（秒） */
  estimatedTotalTime: number
  /** 预计生成的图片数量 */
  expectedImageCount: number
  /** 计划描述 */
  description: string
}

// ==================== 策略映射 ====================

/**
 * 任务类型到策略的映射
 * @internal 预留给未来动态策略选择使用
 */
const _TASK_TYPE_STRATEGIES: Record<TaskType, string> = {
  ecom: 'gemini_ecom',
  model: 'gemini_generate_model',
  pattern: 'gemini_pattern',
  video: 'kling_image2video',
  edit: 'gemini_edit',
  general: 'gemini_generate'
}

// 导出以便在其他模块使用
export { _TASK_TYPE_STRATEGIES as TASK_TYPE_STRATEGIES }

/**
 * 步骤类型到预估时间的映射（秒）
 */
const STEP_ESTIMATED_TIMES: Record<StepType, number> = {
  analyze: 5,
  generate_main: 15,
  generate_back: 15,
  generate_detail: 10,
  generate_model: 20,
  generate_pattern: 15,
  generate_video: 60,
  edit: 10
}

// ==================== TaskPlanner 类 ====================

/**
 * 任务规划器
 *
 * 根据意图和图片分析结果生成执行计划
 */
export class TaskPlanner {
  private planCounter = 0

  /**
   * 生成执行计划
   *
   * @param intent 意图分析结果
   * @param analysis 图片分析结果
   * @returns 任务计划
   */
  plan(intent: IntentResult, analysis?: GarmentAnalysis): TaskPlan {
    const planId = `plan_${Date.now()}_${++this.planCounter}`
    const steps: TaskStep[] = []

    switch (intent.taskType) {
      case 'ecom':
        this.planEcomSteps(steps, intent, analysis)
        break
      case 'model':
        this.planModelSteps(steps, intent, analysis)
        break
      case 'pattern':
        this.planPatternSteps(steps, intent, analysis)
        break
      case 'video':
        this.planVideoSteps(steps, intent)
        break
      case 'edit':
        this.planEditSteps(steps, intent)
        break
      default:
        this.planGeneralSteps(steps, intent)
    }

    // 计算预估时间和图片数量
    const estimatedTotalTime = steps.reduce((total, step) => total + (step.estimatedTime || 10), 0)
    const expectedImageCount = this.countExpectedImages(steps)

    return {
      planId,
      taskType: intent.taskType,
      steps,
      estimatedTotalTime,
      expectedImageCount,
      description: this.generatePlanDescription(intent, steps)
    }
  }

  /**
   * 规划电商图步骤
   */
  private planEcomSteps(steps: TaskStep[], intent: IntentResult, analysis?: GarmentAnalysis): void {
    const { params } = intent
    const baseConfig = {
      aspectRatio: params.aspectRatio || '3:4',
      imageSize: params.imageSize || '2K',
      stylePreset: params.stylePreset || 'auto',
      garmentAnalysis: analysis
    }

    // Step 1: 主图（必须）
    steps.push({
      stepId: 'main',
      type: 'generate_main',
      strategyName: 'gemini_ecom',
      config: {
        ...baseConfig,
        layout: 'flat_lay',
        isMainImage: true
      },
      dependencies: [],
      parallel: false,
      description: '生成主图（平铺展示）',
      estimatedTime: STEP_ESTIMATED_TIMES.generate_main
    })

    // Step 2: 背面图（可选，并行）
    if (params.enableBack) {
      steps.push({
        stepId: 'back',
        type: 'generate_back',
        strategyName: 'gemini_ecom',
        config: {
          ...baseConfig,
          layout: 'flat_lay',
          isBackImage: true
        },
        dependencies: ['main'], // 依赖主图完成
        parallel: true, // 可与细节图并行
        description: '生成背面图',
        estimatedTime: STEP_ESTIMATED_TIMES.generate_back
      })
    }

    // Step 3: 细节图（可选，并行）
    if (params.enableDetail) {
      const detailTypes = params.detailTypes || ['collar', 'print', 'fabric']

      for (let i = 0; i < detailTypes.length; i++) {
        steps.push({
          stepId: `detail_${i}`,
          type: 'generate_detail',
          strategyName: 'gemini_ecom',
          config: {
            ...baseConfig,
            detailType: detailTypes[i],
            aspectRatio: '1:1' // 细节图用正方形
          },
          dependencies: ['main'], // 依赖主图完成
          parallel: true, // 细节图之间可并行
          description: `生成细节图（${detailTypes[i]}）`,
          estimatedTime: STEP_ESTIMATED_TIMES.generate_detail
        })
      }
    }
  }

  /**
   * 规划模特图步骤
   */
  private planModelSteps(steps: TaskStep[], intent: IntentResult, analysis?: GarmentAnalysis): void {
    const { params } = intent
    const baseConfig = {
      aspectRatio: params.aspectRatio || '3:4',
      imageSize: params.imageSize || '2K',
      garmentAnalysis: analysis
    }

    // 模特图主图
    steps.push({
      stepId: 'model_main',
      type: 'generate_model',
      strategyName: 'gemini_generate_model',
      config: {
        ...baseConfig,
        pose: 'standing_front',
        scene: 'studio_white'
      },
      dependencies: [],
      parallel: false,
      description: '生成模特正面图',
      estimatedTime: STEP_ESTIMATED_TIMES.generate_model
    })

    // 多角度（如果需要）
    if (params.targetCount && params.targetCount > 1) {
      const poses = ['standing_side', 'walking', 'sitting']
      const count = Math.min(params.targetCount - 1, poses.length)

      for (let i = 0; i < count; i++) {
        steps.push({
          stepId: `model_${i}`,
          type: 'generate_model',
          strategyName: 'gemini_generate_model',
          config: {
            ...baseConfig,
            pose: poses[i]
          },
          dependencies: ['model_main'],
          parallel: true,
          description: `生成模特图（${poses[i]}）`,
          estimatedTime: STEP_ESTIMATED_TIMES.generate_model
        })
      }
    }
  }

  /**
   * 规划图案生成步骤
   */
  private planPatternSteps(steps: TaskStep[], intent: IntentResult, analysis?: GarmentAnalysis): void {
    const { params } = intent

    steps.push({
      stepId: 'pattern_main',
      type: 'generate_pattern',
      strategyName: 'gemini_pattern',
      config: {
        aspectRatio: params.aspectRatio || '1:1',
        imageSize: params.imageSize || '2K',
        patternType: 'seamless',
        colorAnalysis: analysis?.colors,
        stylePreset: params.stylePreset
      },
      dependencies: [],
      parallel: false,
      description: '生成无缝图案',
      estimatedTime: STEP_ESTIMATED_TIMES.generate_pattern
    })

    // 如果需要多个变体
    if (params.targetCount && params.targetCount > 1) {
      for (let i = 1; i < params.targetCount; i++) {
        steps.push({
          stepId: `pattern_variant_${i}`,
          type: 'generate_pattern',
          strategyName: 'gemini_pattern',
          config: {
            aspectRatio: params.aspectRatio || '1:1',
            imageSize: params.imageSize || '2K',
            patternType: 'seamless',
            variationIndex: i
          },
          dependencies: ['pattern_main'],
          parallel: true,
          description: `生成图案变体 ${i + 1}`,
          estimatedTime: STEP_ESTIMATED_TIMES.generate_pattern
        })
      }
    }
  }

  /**
   * 规划视频生成步骤
   */
  private planVideoSteps(steps: TaskStep[], _intent: IntentResult): void {
    steps.push({
      stepId: 'video_main',
      type: 'generate_video',
      strategyName: 'kling_image2video',
      config: {
        duration: 5,
        motionType: 'gentle'
      },
      dependencies: [],
      parallel: false,
      description: '生成展示视频',
      estimatedTime: STEP_ESTIMATED_TIMES.generate_video
    })
  }

  /**
   * 规划编辑步骤
   */
  private planEditSteps(steps: TaskStep[], intent: IntentResult): void {
    steps.push({
      stepId: 'edit_main',
      type: 'edit',
      strategyName: 'gemini_edit',
      config: {
        editPrompt: intent.params.customPrompt
      },
      dependencies: [],
      parallel: false,
      description: '编辑图片',
      estimatedTime: STEP_ESTIMATED_TIMES.edit
    })
  }

  /**
   * 规划通用生成步骤
   */
  private planGeneralSteps(steps: TaskStep[], intent: IntentResult): void {
    steps.push({
      stepId: 'general_main',
      type: 'generate_main',
      strategyName: 'gemini_generate',
      config: {
        prompt: intent.params.customPrompt,
        aspectRatio: intent.params.aspectRatio || '1:1',
        imageSize: intent.params.imageSize || '2K'
      },
      dependencies: [],
      parallel: false,
      description: '生成图片',
      estimatedTime: STEP_ESTIMATED_TIMES.generate_main
    })
  }

  /**
   * 计算预期生成的图片数量
   */
  private countExpectedImages(steps: TaskStep[]): number {
    return steps.filter((step) => step.type !== 'analyze' && step.type !== 'generate_video').length
  }

  /**
   * 生成计划描述
   */
  private generatePlanDescription(intent: IntentResult, steps: TaskStep[]): string {
    const imageCount = this.countExpectedImages(steps)
    const typeNames: Record<TaskType, string> = {
      ecom: '电商产品图',
      model: '模特展示图',
      pattern: '图案设计',
      video: '展示视频',
      edit: '图片编辑',
      general: '图片生成'
    }

    const typeName = typeNames[intent.taskType] || '图片'
    const stepDescriptions = steps.map((s) => s.description).join('、')

    return `将为您生成 ${imageCount} 张${typeName}：${stepDescriptions}`
  }

  /**
   * 按依赖关系分组步骤（用于并行执行）
   */
  groupStepsByDependency(steps: TaskStep[]): TaskStep[][] {
    const groups: TaskStep[][] = []
    const completed = new Set<string>()
    const remaining = [...steps]

    while (remaining.length > 0) {
      // 找出所有依赖已满足的步骤
      const readySteps = remaining.filter((step) => step.dependencies.every((dep) => completed.has(dep)))

      if (readySteps.length === 0) {
        // 防止死循环（有循环依赖时）
        console.warn('[TaskPlanner] Circular dependency detected, breaking')
        groups.push(remaining)
        break
      }

      // 分离可并行和不可并行的步骤
      const parallelSteps = readySteps.filter((s) => s.parallel)
      const sequentialSteps = readySteps.filter((s) => !s.parallel)

      // 顺序步骤单独成组
      for (const step of sequentialSteps) {
        groups.push([step])
        completed.add(step.stepId)
        const idx = remaining.indexOf(step)
        if (idx > -1) remaining.splice(idx, 1)
      }

      // 并行步骤合并成一组
      if (parallelSteps.length > 0) {
        groups.push(parallelSteps)
        for (const step of parallelSteps) {
          completed.add(step.stepId)
          const idx = remaining.indexOf(step)
          if (idx > -1) remaining.splice(idx, 1)
        }
      }
    }

    return groups
  }
}

/**
 * 单例实例
 */
export const taskPlanner = new TaskPlanner()

export default taskPlanner
