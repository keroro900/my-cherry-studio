/**
 * 智能任务分解服务
 *
 * 将复杂的图片生成任务自动拆分为多个子任务
 * 支持电商套图、多角度展示、批量变体等场景
 */

import { loggerService } from '@logger'
import { uuid } from '@renderer/utils'

import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../types'
import type {
  CompositeTask,
  CompositeTaskStatus,
  DecompositionRule,
  DecompositionScenario,
  DecompositionTemplate,
  SubTask
} from '../types/task-decomposition'

const logger = loggerService.withContext('TaskDecomposer')

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建子任务的辅助函数
 */
function createSubTask(
  compositeTaskId: string,
  params: {
    name: string
    order: number
    config: Record<string, unknown>
    description?: string
    dependsOn?: string[]
    inputImages?: string[]
  }
): SubTask {
  return {
    id: uuid(),
    name: params.name,
    order: params.order,
    compositeTaskId,
    dependsOn: params.dependsOn || [],
    config: params.config,
    inputImages: params.inputImages || [],
    status: 'pending',
    description: params.description,
    retryCount: 0
  }
}

// ============================================================================
// 分解规则定义
// ============================================================================

/**
 * 电商套图分解规则
 */
const ECOM_SUITE_RULE: DecompositionRule = {
  id: 'ecom_suite',
  name: '电商套图',
  description: '自动生成主图、背面图、细节图',
  module: 'ecom',
  triggerCondition: (config) => {
    const ecomConfig = config as EcomModuleConfig
    return ecomConfig.enableBack || ecomConfig.enableDetail
  },
  decompose: (config) => {
    const ecomConfig = config as EcomModuleConfig
    const subtasks: Array<Omit<SubTask, 'id' | 'status' | 'compositeTaskId' | 'retryCount'>> = []
    let order = 1

    // 主图
    subtasks.push({
      name: '主图（正面）',
      order: order++,
      config: { ...ecomConfig, enableBack: false, enableDetail: false } as Record<string, unknown>,
      inputImages: [],
      dependsOn: [],
      description: '生成正面主图'
    })

    // 背面图
    if (ecomConfig.enableBack) {
      subtasks.push({
        name: '背面图',
        order: order++,
        config: {
          ...ecomConfig,
          enableBack: false,
          enableDetail: false,
          garmentDescription: (ecomConfig.garmentDescription || '') + '，展示背面'
        } as Record<string, unknown>,
        inputImages: [],
        dependsOn: [],
        description: '生成背面展示图'
      })
    }

    // 细节图
    if (ecomConfig.enableDetail && ecomConfig.detailTypes) {
      for (const detailType of ecomConfig.detailTypes) {
        subtasks.push({
          name: `细节图 - ${detailType}`,
          order: order++,
          config: {
            ...ecomConfig,
            enableBack: false,
            enableDetail: false,
            garmentDescription: (ecomConfig.garmentDescription || '') + `，特写展示${detailType}部分`
          },
          inputImages: [],
          dependsOn: [],
          description: `生成${detailType}特写图`
        })
      }
    }

    return subtasks
  }
}

/**
 * 多角度展示分解规则
 */
const MULTI_ANGLE_RULE: DecompositionRule = {
  id: 'multi_angle',
  name: '多角度展示',
  description: '生成正面、侧面、背面、45度角等多角度图',
  module: 'model',
  triggerCondition: () => false, // 手动触发
  decompose: (config) => {
    const modelConfig = config as ModelModuleConfig
    const angles = ['正面', '左侧面', '右侧面', '背面', '45度角']
    return angles.map((angle, index) => ({
      name: `${angle}展示`,
      order: index + 1,
      config: {
        ...modelConfig,
        styleDescription: (modelConfig.styleDescription || '') + `，${angle}视角`
      },
      inputImages: [],
      dependsOn: [],
      description: `生成${angle}视角的模特图`
    }))
  }
}

/**
 * 图案应用分解规则
 */
const PATTERN_APPLICATION_RULE: DecompositionRule = {
  id: 'pattern_application',
  name: '图案应用套装',
  description: '生成无缝图案 + T恤贴图 + 套装效果图',
  module: 'pattern',
  triggerCondition: (config) => {
    const patternConfig = config as PatternModuleConfig
    return patternConfig.outputType === 'set'
  },
  decompose: (config) => {
    const patternConfig = config as PatternModuleConfig
    return [
      {
        name: '无缝图案',
        order: 1,
        config: { ...patternConfig, outputType: 'pattern_only' as const } as Record<string, unknown>,
        inputImages: [],
        dependsOn: [],
        description: '生成无缝重复图案'
      },
      {
        name: 'T恤贴图效果',
        order: 2,
        config: patternConfig as unknown as Record<string, unknown>,
        inputImages: [],
        dependsOn: [],
        description: '将图案应用到T恤上'
      },
      {
        name: '套装效果图',
        order: 3,
        config: patternConfig as unknown as Record<string, unknown>,
        inputImages: [],
        dependsOn: [],
        description: '生成完整套装效果图'
      }
    ]
  }
}

/**
 * 批量变体分解规则
 */
const BATCH_VARIANTS_RULE: DecompositionRule = {
  id: 'batch_variants',
  name: '批量变体',
  description: '生成不同颜色/款式的变体',
  module: 'ecom',
  triggerCondition: (config) => {
    const ecomConfig = config as EcomModuleConfig
    return (ecomConfig.batchCount || 1) > 1
  },
  decompose: (config) => {
    const ecomConfig = config as EcomModuleConfig
    const count = ecomConfig.batchCount || 1
    return Array.from({ length: count }, (_, i) => ({
      name: `变体 ${i + 1}`,
      order: i + 1,
      config: { ...ecomConfig, batchCount: 1, seed: (ecomConfig.seed || 0) + i } as Record<string, unknown>,
      inputImages: [],
      dependsOn: [],
      description: `生成第 ${i + 1} 个变体`
    }))
  }
}

// 所有规则
const ALL_RULES: DecompositionRule[] = [
  ECOM_SUITE_RULE,
  MULTI_ANGLE_RULE,
  PATTERN_APPLICATION_RULE,
  BATCH_VARIANTS_RULE
]

// ============================================================================
// 预定义模板
// ============================================================================

const TEMPLATES: DecompositionTemplate[] = [
  {
    id: 'ecom_full_suite',
    name: '电商完整套图',
    description: '主图 + 背面图 + 3张细节图',
    module: 'ecom',
    subtaskConfigs: [
      { name: '正面主图', configOverrides: {} },
      { name: '背面图', configOverrides: { garmentDescription: '展示背面' } },
      { name: '细节图-领口', configOverrides: { garmentDescription: '特写领口细节' } },
      { name: '细节图-袖口', configOverrides: { garmentDescription: '特写袖口细节' } },
      { name: '细节图-材质', configOverrides: { garmentDescription: '特写面料材质' } }
    ]
  },
  {
    id: 'model_360',
    name: '360度模特展示',
    description: '8个角度的模特展示图',
    module: 'model',
    subtaskConfigs: [
      { name: '正面', configOverrides: { styleDescription: '正面直视镜头' } },
      { name: '右前45度', configOverrides: { styleDescription: '身体右转45度' } },
      { name: '右侧面', configOverrides: { styleDescription: '右侧面' } },
      { name: '右后45度', configOverrides: { styleDescription: '身体右转135度' } },
      { name: '背面', configOverrides: { styleDescription: '背面' } },
      { name: '左后45度', configOverrides: { styleDescription: '身体左转135度' } },
      { name: '左侧面', configOverrides: { styleDescription: '左侧面' } },
      { name: '左前45度', configOverrides: { styleDescription: '身体左转45度' } }
    ]
  },
  {
    id: 'pattern_showcase',
    name: '图案展示套装',
    description: '无缝图案 + 应用效果展示',
    module: 'pattern',
    subtaskConfigs: [
      { name: '无缝图案', configOverrides: { outputType: 'pattern_only' } },
      { name: 'T恤效果', configOverrides: {} },
      { name: '包装盒效果', configOverrides: {} },
      { name: '手机壳效果', configOverrides: {} }
    ]
  }
]

// ============================================================================
// 主服务类
// ============================================================================

/**
 * 智能任务分解服务
 */
class TaskDecomposerImpl {
  private activeTasks: Map<string, CompositeTask> = new Map()

  /**
   * 获取适用的分解规则
   */
  getApplicableRules<T extends Record<string, unknown>>(module: StudioModule, config: T): DecompositionRule[] {
    return ALL_RULES.filter((rule) => rule.module === module && rule.triggerCondition(config))
  }

  /**
   * 获取模块的所有模板
   */
  getTemplates(module: StudioModule): DecompositionTemplate[] {
    return TEMPLATES.filter((t) => t.module === module)
  }

  /**
   * 根据规则自动分解任务
   */
  decomposeByRule<T extends Record<string, unknown>>(
    name: string,
    description: string,
    module: StudioModule,
    config: T,
    ruleId: string
  ): CompositeTask | null {
    const rule = ALL_RULES.find((r) => r.id === ruleId && r.module === module)
    if (!rule) {
      logger.warn('Rule not found', { ruleId, module })
      return null
    }

    const compositeTaskId = uuid()
    const subtaskConfigs = rule.decompose(config)
    const subtasks: SubTask[] = subtaskConfigs.map((st) =>
      createSubTask(compositeTaskId, {
        name: st.name,
        order: st.order,
        config: st.config,
        description: st.description,
        dependsOn: st.dependsOn,
        inputImages: st.inputImages
      })
    )

    const compositeTask: CompositeTask = {
      id: compositeTaskId,
      name,
      description,
      module,
      scenario: 'custom' as DecompositionScenario,
      subtasks,
      status: 'pending',
      progress: { completed: 0, total: subtasks.length, failed: 0 },
      createdAt: Date.now(),
      priority: 5
    }

    this.activeTasks.set(compositeTask.id, compositeTask)

    logger.info('Task decomposed by rule', {
      taskId: compositeTask.id,
      ruleId,
      subtaskCount: subtasks.length
    })

    return compositeTask
  }

  /**
   * 根据模板分解任务
   */
  decomposeByTemplate<T extends Record<string, unknown>>(
    name: string,
    description: string,
    module: StudioModule,
    baseConfig: T,
    templateId: string
  ): CompositeTask | null {
    const template = TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      logger.warn('Template not found', { templateId })
      return null
    }

    const compositeTaskId = uuid()
    const subtasks: SubTask[] = template.subtaskConfigs.map((stc, index) =>
      createSubTask(compositeTaskId, {
        name: stc.name,
        order: index + 1,
        config: { ...baseConfig, ...stc.configOverrides },
        description: stc.name
      })
    )

    const compositeTask: CompositeTask = {
      id: compositeTaskId,
      name,
      description,
      module,
      scenario: 'custom' as DecompositionScenario,
      subtasks,
      status: 'pending',
      progress: { completed: 0, total: subtasks.length, failed: 0 },
      createdAt: Date.now(),
      priority: 5
    }

    this.activeTasks.set(compositeTask.id, compositeTask)

    logger.info('Task decomposed by template', {
      taskId: compositeTask.id,
      templateId,
      subtaskCount: subtasks.length
    })

    return compositeTask
  }

  /**
   * 手动创建组合任务
   */
  createCompositeTask(
    name: string,
    description: string,
    module: StudioModule,
    subtaskParams: Array<{
      name: string
      order: number
      config: Record<string, unknown>
      description?: string
      dependsOn?: string[]
      inputImages?: string[]
    }>
  ): CompositeTask {
    const compositeTaskId = uuid()
    const subtasks: SubTask[] = subtaskParams.map((st) => createSubTask(compositeTaskId, st))

    const compositeTask: CompositeTask = {
      id: compositeTaskId,
      name,
      description,
      module,
      scenario: 'custom' as DecompositionScenario,
      subtasks,
      status: 'pending',
      progress: { completed: 0, total: subtasks.length, failed: 0 },
      createdAt: Date.now(),
      priority: 5
    }

    this.activeTasks.set(compositeTask.id, compositeTask)

    return compositeTask
  }

  /**
   * 更新子任务状态
   */
  updateSubtaskStatus(
    compositeTaskId: string,
    subtaskId: string,
    status: CompositeTaskStatus,
    outputs?: string[]
  ): void {
    const task = this.activeTasks.get(compositeTaskId)
    if (!task) return

    const subtask = task.subtasks.find((st) => st.id === subtaskId)
    if (!subtask) return

    subtask.status = status
    if (outputs) {
      subtask.outputs = outputs
      // 合并到组合任务输出
      if (!task.mergedOutputs) {
        task.mergedOutputs = {}
      }
      task.mergedOutputs[subtaskId] = outputs
    }

    // 更新进度
    const completed = task.subtasks.filter((st) => st.status === 'completed').length
    const failed = task.subtasks.filter((st) => st.status === 'failed').length
    task.progress.completed = completed
    task.progress.failed = failed

    // 更新整体状态
    if (task.subtasks.every((st) => st.status === 'completed')) {
      task.status = 'completed'
      task.completedAt = Date.now()
    } else if (task.subtasks.some((st) => st.status === 'failed')) {
      task.status = 'failed'
    } else if (task.subtasks.some((st) => st.status === 'running')) {
      task.status = 'running'
    }

    logger.info('Subtask status updated', {
      compositeTaskId,
      subtaskId,
      status,
      progress: task.progress
    })
  }

  /**
   * 获取下一个待执行的子任务
   */
  getNextSubtask(compositeTaskId: string): SubTask | null {
    const task = this.activeTasks.get(compositeTaskId)
    if (!task) return null

    // 按顺序找到第一个待执行且依赖已完成的子任务
    const pendingSubtasks = task.subtasks.filter((st) => st.status === 'pending')
    for (const subtask of pendingSubtasks) {
      if (subtask.dependsOn.length === 0) {
        return subtask
      }
      const dependenciesMet = subtask.dependsOn.every((depId) => {
        const dep = task.subtasks.find((st) => st.id === depId)
        return dep && dep.status === 'completed'
      })
      if (dependenciesMet) {
        return subtask
      }
    }
    return null
  }

  /**
   * 获取组合任务
   */
  getCompositeTask(id: string): CompositeTask | undefined {
    return this.activeTasks.get(id)
  }

  /**
   * 获取所有活跃的组合任务
   */
  getActiveTasks(): CompositeTask[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * 暂停组合任务
   */
  pauseTask(id: string): boolean {
    const task = this.activeTasks.get(id)
    if (task && task.status === 'running') {
      task.status = 'paused'
      return true
    }
    return false
  }

  /**
   * 恢复组合任务
   */
  resumeTask(id: string): boolean {
    const task = this.activeTasks.get(id)
    if (task && task.status === 'paused') {
      task.status = 'running'
      return true
    }
    return false
  }

  /**
   * 删除组合任务
   */
  deleteTask(id: string): boolean {
    return this.activeTasks.delete(id)
  }

  /**
   * 清除所有任务
   */
  clearAll(): void {
    this.activeTasks.clear()
  }
}

// 导出单例
export const taskDecomposer = new TaskDecomposerImpl()

export default taskDecomposer
