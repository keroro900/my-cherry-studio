/**
 * ProgressTracker - Crew 进度追踪器
 *
 * 为 MultiModelCodeCrew 提供任务进度追踪能力：
 * - 功能列表管理
 * - 进度追踪
 * - 跨会话恢复
 * - Git 集成
 */

import { loggerService } from '@logger'

import type { CrewRole } from '../types'

const logger = loggerService.withContext('ProgressTracker')

// ==================== 类型定义 ====================

/**
 * 功能项状态
 */
type FeatureStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

/**
 * 功能项优先级
 */
type FeaturePriority = 'critical' | 'high' | 'medium' | 'low'

/**
 * 功能项
 */
interface FeatureItem {
  id: string
  title: string
  description?: string
  status: FeatureStatus
  priority: FeaturePriority
  assignee?: CrewRole
  dependencies?: string[]
  estimatedComplexity?: 'simple' | 'medium' | 'complex'
  gitCommit?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  notes?: string[]
  subtasks?: SubTask[]
}

/**
 * 子任务
 */
interface SubTask {
  id: string
  title: string
  status: FeatureStatus
  assignee?: CrewRole
  completedAt?: number
}

/**
 * 进度快照
 */
interface ProgressSnapshot {
  projectId: string
  projectName: string
  features: FeatureItem[]
  createdAt: number
  lastUpdatedAt: number
  version: string
}

/**
 * 进度统计
 */
interface ProgressStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  failed: number
  blocked: number
  completionRate: number
}

// ==================== 进度追踪器实现 ====================

class ProgressTrackerImpl {
  private features: Map<string, FeatureItem> = new Map()
  private projectId: string = ''
  private projectName: string = ''
  private version: string = '1.0.0'
  private storageKey: string = 'crew_progress'

  /**
   * 初始化进度追踪器
   */
  initialize(projectId: string, projectName: string): void {
    this.projectId = projectId
    this.projectName = projectName

    // 尝试从 localStorage 恢复进度
    this.restoreProgress()

    logger.info('Initialized', { projectId, projectName, featureCount: this.features.size })
  }

  /**
   * 重置进度追踪器
   */
  reset(): void {
    this.features.clear()
    this.saveProgress()
    logger.info('Progress reset')
  }

  // ==================== 功能列表管理 ====================

  /**
   * 从需求初始化功能列表
   * 通常由架构师角色调用
   */
  initFeatures(features: Array<Omit<FeatureItem, 'id' | 'createdAt' | 'status'>>): FeatureItem[] {
    const now = Date.now()
    const createdFeatures: FeatureItem[] = []

    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const id = `feature_${now}_${i}`

      const featureItem: FeatureItem = {
        id,
        title: feature.title,
        description: feature.description,
        status: 'pending',
        priority: feature.priority || 'medium',
        assignee: feature.assignee,
        dependencies: feature.dependencies,
        estimatedComplexity: feature.estimatedComplexity,
        createdAt: now,
        notes: feature.notes,
        subtasks: feature.subtasks
      }

      this.features.set(id, featureItem)
      createdFeatures.push(featureItem)
    }

    this.saveProgress()
    logger.info('Features initialized', { count: createdFeatures.length })

    return createdFeatures
  }

  /**
   * 添加功能
   */
  addFeature(feature: Omit<FeatureItem, 'id' | 'createdAt'>): FeatureItem {
    const id = `feature_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const featureItem: FeatureItem = {
      ...feature,
      id,
      createdAt: Date.now()
    }

    this.features.set(id, featureItem)
    this.saveProgress()

    logger.debug('Feature added', { id, title: feature.title })
    return featureItem
  }

  /**
   * 获取功能
   */
  getFeature(featureId: string): FeatureItem | null {
    return this.features.get(featureId) || null
  }

  /**
   * 获取所有功能
   */
  getAllFeatures(): FeatureItem[] {
    return Array.from(this.features.values())
  }

  /**
   * 按状态获取功能
   */
  getFeaturesByStatus(status: FeatureStatus): FeatureItem[] {
    return this.getAllFeatures().filter((f) => f.status === status)
  }

  /**
   * 按优先级获取功能
   */
  getFeaturesByPriority(priority: FeaturePriority): FeatureItem[] {
    return this.getAllFeatures().filter((f) => f.priority === priority)
  }

  /**
   * 按角色获取功能
   */
  getFeaturesByAssignee(role: CrewRole): FeatureItem[] {
    return this.getAllFeatures().filter((f) => f.assignee === role)
  }

  // ==================== 进度追踪 ====================

  /**
   * 选择下一个要处理的功能
   * 基于优先级和依赖关系
   */
  selectNextFeature(): FeatureItem | null {
    const pendingFeatures = this.getFeaturesByStatus('pending')

    if (pendingFeatures.length === 0) {
      return null
    }

    // 按优先级排序
    const priorityOrder: Record<FeaturePriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    }

    // 过滤掉有未完成依赖的功能
    const availableFeatures = pendingFeatures.filter((f) => {
      if (!f.dependencies || f.dependencies.length === 0) {
        return true
      }

      return f.dependencies.every((depId) => {
        const dep = this.features.get(depId)
        return dep && dep.status === 'completed'
      })
    })

    if (availableFeatures.length === 0) {
      // 如果有 pending 但都被依赖阻塞，返回第一个 pending
      return pendingFeatures[0]
    }

    // 按优先级排序并返回第一个
    availableFeatures.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    return availableFeatures[0]
  }

  /**
   * 开始处理功能
   */
  startFeature(featureId: string, assignee?: CrewRole): FeatureItem | null {
    const feature = this.features.get(featureId)
    if (!feature) {
      logger.warn('Feature not found', { featureId })
      return null
    }

    feature.status = 'in_progress'
    feature.startedAt = Date.now()
    if (assignee) {
      feature.assignee = assignee
    }

    this.saveProgress()
    logger.info('Feature started', { featureId, title: feature.title, assignee })

    return feature
  }

  /**
   * 完成功能
   */
  markCompleted(featureId: string, gitCommit?: string): FeatureItem | null {
    const feature = this.features.get(featureId)
    if (!feature) {
      logger.warn('Feature not found', { featureId })
      return null
    }

    feature.status = 'completed'
    feature.completedAt = Date.now()
    if (gitCommit) {
      feature.gitCommit = gitCommit
    }

    this.saveProgress()
    logger.info('Feature completed', { featureId, title: feature.title, gitCommit })

    return feature
  }

  /**
   * 标记功能失败
   */
  markFailed(featureId: string, reason?: string): FeatureItem | null {
    const feature = this.features.get(featureId)
    if (!feature) {
      logger.warn('Feature not found', { featureId })
      return null
    }

    feature.status = 'failed'
    if (reason) {
      feature.notes = feature.notes || []
      feature.notes.push(`Failed: ${reason}`)
    }

    this.saveProgress()
    logger.warn('Feature failed', { featureId, title: feature.title, reason })

    return feature
  }

  /**
   * 标记功能阻塞
   */
  markBlocked(featureId: string, reason?: string): FeatureItem | null {
    const feature = this.features.get(featureId)
    if (!feature) {
      logger.warn('Feature not found', { featureId })
      return null
    }

    feature.status = 'blocked'
    if (reason) {
      feature.notes = feature.notes || []
      feature.notes.push(`Blocked: ${reason}`)
    }

    this.saveProgress()
    logger.warn('Feature blocked', { featureId, title: feature.title, reason })

    return feature
  }

  /**
   * 添加备注
   */
  addNote(featureId: string, note: string): void {
    const feature = this.features.get(featureId)
    if (!feature) {
      return
    }

    feature.notes = feature.notes || []
    feature.notes.push(`[${new Date().toISOString()}] ${note}`)
    this.saveProgress()
  }

  // ==================== 子任务管理 ====================

  /**
   * 添加子任务
   */
  addSubtask(featureId: string, subtask: Omit<SubTask, 'id' | 'status'>): SubTask | null {
    const feature = this.features.get(featureId)
    if (!feature) {
      return null
    }

    const id = `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newSubtask: SubTask = {
      ...subtask,
      id,
      status: 'pending'
    }

    feature.subtasks = feature.subtasks || []
    feature.subtasks.push(newSubtask)
    this.saveProgress()

    return newSubtask
  }

  /**
   * 完成子任务
   */
  completeSubtask(featureId: string, subtaskId: string): boolean {
    const feature = this.features.get(featureId)
    if (!feature || !feature.subtasks) {
      return false
    }

    const subtask = feature.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) {
      return false
    }

    subtask.status = 'completed'
    subtask.completedAt = Date.now()
    this.saveProgress()

    return true
  }

  // ==================== 统计 ====================

  /**
   * 获取进度统计
   */
  getStats(): ProgressStats {
    const features = this.getAllFeatures()
    const total = features.length

    const stats: ProgressStats = {
      total,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      completionRate: 0
    }

    for (const feature of features) {
      switch (feature.status) {
        case 'pending':
          stats.pending++
          break
        case 'in_progress':
          stats.inProgress++
          break
        case 'completed':
          stats.completed++
          break
        case 'failed':
          stats.failed++
          break
        case 'blocked':
          stats.blocked++
          break
      }
    }

    stats.completionRate = total > 0 ? (stats.completed / total) * 100 : 0

    return stats
  }

  /**
   * 获取进度百分比
   */
  getCompletionPercentage(): number {
    const stats = this.getStats()
    return Math.round(stats.completionRate)
  }

  // ==================== 持久化 ====================

  /**
   * 保存进度到 localStorage
   */
  private saveProgress(): void {
    try {
      const snapshot: ProgressSnapshot = {
        projectId: this.projectId,
        projectName: this.projectName,
        features: this.getAllFeatures(),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        version: this.version
      }

      const key = `${this.storageKey}_${this.projectId}`
      localStorage.setItem(key, JSON.stringify(snapshot))

      logger.debug('Progress saved', { featureCount: snapshot.features.length })
    } catch (error) {
      logger.error('Failed to save progress:', error as Error)
    }
  }

  /**
   * 从 localStorage 恢复进度
   */
  restoreProgress(): boolean {
    try {
      const key = `${this.storageKey}_${this.projectId}`
      const data = localStorage.getItem(key)

      if (!data) {
        return false
      }

      const snapshot: ProgressSnapshot = JSON.parse(data)

      // 验证项目 ID
      if (snapshot.projectId !== this.projectId) {
        logger.warn('Project ID mismatch, not restoring')
        return false
      }

      // 恢复功能列表
      this.features.clear()
      for (const feature of snapshot.features) {
        this.features.set(feature.id, feature)
      }

      logger.info('Progress restored', {
        featureCount: this.features.size,
        lastUpdated: new Date(snapshot.lastUpdatedAt).toISOString()
      })

      return true
    } catch (error) {
      logger.error('Failed to restore progress:', error as Error)
      return false
    }
  }

  /**
   * 导出进度快照
   */
  exportSnapshot(): ProgressSnapshot {
    return {
      projectId: this.projectId,
      projectName: this.projectName,
      features: this.getAllFeatures(),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      version: this.version
    }
  }

  /**
   * 导入进度快照
   */
  importSnapshot(snapshot: ProgressSnapshot): void {
    this.projectId = snapshot.projectId
    this.projectName = snapshot.projectName
    this.features.clear()

    for (const feature of snapshot.features) {
      this.features.set(feature.id, feature)
    }

    this.saveProgress()
    logger.info('Snapshot imported', { featureCount: this.features.size })
  }

  /**
   * 清除存储的进度
   */
  clearStorage(): void {
    try {
      const key = `${this.storageKey}_${this.projectId}`
      localStorage.removeItem(key)
      logger.info('Storage cleared')
    } catch (error) {
      logger.error('Failed to clear storage:', error as Error)
    }
  }
}

// ==================== 导出 ====================

export const ProgressTracker = new ProgressTrackerImpl()

export type { FeatureItem, FeatureStatus, FeaturePriority, SubTask, ProgressSnapshot, ProgressStats }

export default ProgressTracker
