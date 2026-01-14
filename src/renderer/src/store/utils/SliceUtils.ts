/**
 * Redux Slice 工具库
 *
 * 提供标准化的 Slice 模式和工具函数：
 * 1. 通用 CRUD 操作
 * 2. 队列管理
 * 3. 筛选/排序
 * 4. 批量操作
 *
 * 设计目标：
 * - 减少 Slice 之间的代码重复
 * - 统一状态管理模式
 * - 为未来 Slice 合并提供基础
 *
 * 合并路线图：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 当前状态:                                                    │
 * │   paintings (legacy) + unifiedPaintings + imageStudio       │
 * │                                                              │
 * │ 目标状态:                                                    │
 * │   paintings (统一) → 包含所有绘画记录                         │
 * │   imageStudio → 专注于工作室功能（项目/版本/模块配置）         │
 * │                                                              │
 * │ 迁移步骤:                                                    │
 * │   1. paintings 继续使用 legacy 结构（向后兼容）               │
 * │   2. 新记录同时写入 unifiedPaintings                         │
 * │   3. 逐步迁移 UI 到 unifiedPaintings                         │
 * │   4. 最终移除 legacy paintings                               │
 * └─────────────────────────────────────────────────────────────┘
 */

import type { Draft, PayloadAction } from '@reduxjs/toolkit'

// ==================== 通用类型 ====================

/**
 * 带 ID 的实体
 */
export interface EntityWithId {
  id: string
}

/**
 * 带时间戳的实体
 */
export interface EntityWithTimestamp extends EntityWithId {
  createdAt: number
  updatedAt?: number
}

/**
 * 队列任务状态
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 队列任务基础接口
 */
export interface QueueTask extends EntityWithId {
  status: TaskStatus
  progress?: number
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

/**
 * 筛选配置
 */
export interface FilterConfig {
  [key: string]: unknown
}

/**
 * 排序配置
 */
export interface SortConfig {
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

/**
 * 分页配置
 */
export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

// ==================== Slice State 模板 ====================

/**
 * 列表状态模板
 */
export interface ListState<T extends EntityWithId> extends SortConfig {
  items: T[]
  filter: FilterConfig
  loading: boolean
  error?: string
}

/**
 * 队列状态模板
 */
export interface QueueState<T extends QueueTask> {
  tasks: T[]
  currentTaskId?: string
  isPaused: boolean
  maxConcurrency: number
}

/**
 * 组合状态模板 (列表 + 队列)
 */
export interface CompositeState<TItem extends EntityWithId, TTask extends QueueTask>
  extends ListState<TItem>,
    QueueState<TTask> {}

// ==================== Reducer 工厂 ====================

/**
 * 创建列表 CRUD Reducers
 */
export function createListReducers<T extends EntityWithId>() {
  return {
    /**
     * 添加单个项目
     */
    addItem: (state: Draft<{ items: T[] }>, action: PayloadAction<T>) => {
      state.items.unshift(action.payload as Draft<T>)
    },

    /**
     * 批量添加项目
     */
    addItems: (state: Draft<{ items: T[] }>, action: PayloadAction<T[]>) => {
      state.items.unshift(...(action.payload as Draft<T>[]))
    },

    /**
     * 更新项目
     */
    updateItem: (state: Draft<{ items: T[] }>, action: PayloadAction<Partial<T> & { id: string }>) => {
      const index = state.items.findIndex((item) => item.id === action.payload.id)
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload } as Draft<T>
      }
    },

    /**
     * 删除项目
     */
    removeItem: (state: Draft<{ items: T[] }>, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
    },

    /**
     * 批量删除项目
     */
    removeItems: (state: Draft<{ items: T[] }>, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload)
      state.items = state.items.filter((item) => !ids.has(item.id))
    },

    /**
     * 清空列表
     */
    clearItems: (state: Draft<{ items: T[] }>) => {
      state.items = []
    }
  }
}

/**
 * 创建队列管理 Reducers
 */
export function createQueueReducers<T extends QueueTask>() {
  return {
    /**
     * 添加任务到队列
     */
    enqueue: (state: Draft<QueueState<T>>, action: PayloadAction<T>) => {
      state.tasks.push(action.payload as Draft<T>)
    },

    /**
     * 批量添加任务
     */
    enqueueBatch: (state: Draft<QueueState<T>>, action: PayloadAction<T[]>) => {
      state.tasks.push(...(action.payload as Draft<T>[]))
    },

    /**
     * 更新任务状态
     */
    updateTaskStatus: (
      state: Draft<QueueState<T>>,
      action: PayloadAction<{ id: string; status: TaskStatus; progress?: number; error?: string }>
    ) => {
      const task = state.tasks.find((t) => t.id === action.payload.id)
      if (task) {
        task.status = action.payload.status
        if (action.payload.progress !== undefined) {
          task.progress = action.payload.progress
        }
        if (action.payload.error !== undefined) {
          task.error = action.payload.error
        }
        if (action.payload.status === 'running' && !task.startedAt) {
          task.startedAt = Date.now()
        }
        if (['completed', 'failed', 'cancelled'].includes(action.payload.status)) {
          task.completedAt = Date.now()
        }
      }
    },

    /**
     * 设置当前任务
     */
    setCurrentTask: (state: Draft<QueueState<T>>, action: PayloadAction<string | undefined>) => {
      state.currentTaskId = action.payload
    },

    /**
     * 移除任务
     */
    dequeue: (state: Draft<QueueState<T>>, action: PayloadAction<string>) => {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload)
    },

    /**
     * 清理已完成任务
     */
    clearCompleted: (state: Draft<QueueState<T>>) => {
      state.tasks = state.tasks.filter((t) => !['completed', 'failed', 'cancelled'].includes(t.status))
    },

    /**
     * 暂停队列
     */
    pauseQueue: (state: Draft<QueueState<T>>) => {
      state.isPaused = true
    },

    /**
     * 恢复队列
     */
    resumeQueue: (state: Draft<QueueState<T>>) => {
      state.isPaused = false
    },

    /**
     * 设置并发数
     */
    setMaxConcurrency: (state: Draft<QueueState<T>>, action: PayloadAction<number>) => {
      state.maxConcurrency = action.payload
    }
  }
}

/**
 * 创建筛选排序 Reducers
 */
export function createFilterSortReducers<T extends FilterConfig>() {
  return {
    /**
     * 设置筛选条件
     */
    setFilter: (state: Draft<{ filter: T }>, action: PayloadAction<Partial<T>>) => {
      state.filter = { ...state.filter, ...action.payload }
    },

    /**
     * 清除筛选条件
     */
    clearFilter: (state: Draft<{ filter: T }>) => {
      state.filter = {} as Draft<T>
    },

    /**
     * 设置排序
     */
    setSort: (state: Draft<SortConfig>, action: PayloadAction<{ sortBy: string; sortOrder?: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.sortBy
      if (action.payload.sortOrder) {
        state.sortOrder = action.payload.sortOrder
      } else {
        // 点击同一列时切换排序方向
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
      }
    }
  }
}

// ==================== Selector 工厂 ====================

/**
 * 创建列表 Selectors
 */
export function createListSelectors<TState, TItem extends EntityWithId>(
  selectSlice: (state: TState) => { items: TItem[] }
) {
  return {
    /**
     * 获取所有项目
     */
    selectAll: (state: TState) => selectSlice(state).items,

    /**
     * 按 ID 获取项目
     */
    selectById: (state: TState, id: string) => selectSlice(state).items.find((item) => item.id === id),

    /**
     * 获取项目数量
     */
    selectCount: (state: TState) => selectSlice(state).items.length
  }
}

/**
 * 创建队列 Selectors
 */
export function createQueueSelectors<TState, TTask extends QueueTask>(
  selectSlice: (state: TState) => QueueState<TTask>
) {
  return {
    /**
     * 获取所有任务
     */
    selectAllTasks: (state: TState) => selectSlice(state).tasks,

    /**
     * 获取当前任务
     */
    selectCurrentTask: (state: TState) => {
      const slice = selectSlice(state)
      return slice.currentTaskId ? slice.tasks.find((t) => t.id === slice.currentTaskId) : undefined
    },

    /**
     * 获取待处理任务
     */
    selectPendingTasks: (state: TState) => selectSlice(state).tasks.filter((t) => t.status === 'pending'),

    /**
     * 获取运行中任务
     */
    selectRunningTasks: (state: TState) => selectSlice(state).tasks.filter((t) => t.status === 'running'),

    /**
     * 获取已完成任务
     */
    selectCompletedTasks: (state: TState) =>
      selectSlice(state).tasks.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status)),

    /**
     * 是否暂停
     */
    selectIsPaused: (state: TState) => selectSlice(state).isPaused,

    /**
     * 是否可以开始新任务
     */
    selectCanStartTask: (state: TState) => {
      const slice = selectSlice(state)
      if (slice.isPaused) return false
      const runningCount = slice.tasks.filter((t) => t.status === 'running').length
      return runningCount < slice.maxConcurrency
    }
  }
}

// ==================== 辅助函数 ====================

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

/**
 * 创建带时间戳的实体
 */
export function createTimestampedEntity<T extends Omit<EntityWithTimestamp, 'createdAt'>>(
  data: T
): T & { createdAt: number } {
  return {
    ...data,
    createdAt: Date.now()
  }
}

/**
 * 排序函数
 */
export function sortItems<T>(items: T[], sortBy: keyof T, sortOrder: 'asc' | 'desc'): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]

    if (aVal === bVal) return 0
    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1

    const comparison = aVal < bVal ? -1 : 1
    return sortOrder === 'asc' ? comparison : -comparison
  })
}

/**
 * 筛选函数
 */
export function filterItems<T>(items: T[], filter: Partial<Record<keyof T, unknown>>): T[] {
  if (Object.keys(filter).length === 0) return items

  return items.filter((item) => {
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || value === null) continue
      if (item[key as keyof T] !== value) return false
    }
    return true
  })
}

// ==================== 导出 ====================

export const SliceUtils = {
  createListReducers,
  createQueueReducers,
  createFilterSortReducers,
  createListSelectors,
  createQueueSelectors,
  generateId,
  createTimestampedEntity,
  sortItems,
  filterItems
}

export default SliceUtils
