/**
 * 统一绘画状态管理
 *
 * 新架构特点：
 * 1. 统一的绘画记录结构，不再按 provider 分散
 * 2. 内置提示词历史管理
 * 3. 生成队列支持
 * 4. 筛选和排序功能
 */

import { loggerService } from '@logger'
import type { PayloadAction } from '@reduxjs/toolkit'
import { createSelector, createSlice } from '@reduxjs/toolkit'
import type { GenerationTask, PromptHistoryItem, UnifiedPainting, UnifiedPaintingsState } from '@renderer/types'

const logger = loggerService.withContext('Store:unifiedPaintings')

// ============================================================================
// 初始状态
// ============================================================================

const initialState: UnifiedPaintingsState = {
  paintings: [],
  promptHistory: [],
  generationQueue: [],
  currentTaskId: undefined,
  filter: {},
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

// ============================================================================
// Slice 定义
// ============================================================================

const unifiedPaintingsSlice = createSlice({
  name: 'unifiedPaintings',
  initialState,
  reducers: {
    // ==================== 绘画记录操作 ====================

    /**
     * 添加绘画记录
     */
    addPainting: (state, action: PayloadAction<UnifiedPainting>) => {
      state.paintings.unshift(action.payload)
      logger.debug(`Added painting: ${action.payload.id}`)
    },

    /**
     * 批量添加绘画记录
     */
    addPaintings: (state, action: PayloadAction<UnifiedPainting[]>) => {
      state.paintings.unshift(...action.payload)
      logger.debug(`Added ${action.payload.length} paintings`)
    },

    /**
     * 更新绘画记录
     */
    updatePainting: (state, action: PayloadAction<Partial<UnifiedPainting> & { id: string }>) => {
      const index = state.paintings.findIndex((p) => p.id === action.payload.id)
      if (index !== -1) {
        state.paintings[index] = { ...state.paintings[index], ...action.payload }
        logger.debug(`Updated painting: ${action.payload.id}`)
      }
    },

    /**
     * 删除绘画记录
     */
    removePainting: (state, action: PayloadAction<string>) => {
      state.paintings = state.paintings.filter((p) => p.id !== action.payload)
      logger.debug(`Removed painting: ${action.payload}`)
    },

    /**
     * 批量删除绘画记录
     */
    removePaintings: (state, action: PayloadAction<string[]>) => {
      const idsToRemove = new Set(action.payload)
      state.paintings = state.paintings.filter((p) => !idsToRemove.has(p.id))
      logger.debug(`Removed ${action.payload.length} paintings`)
    },

    /**
     * 切换收藏状态
     */
    toggleFavorite: (state, action: PayloadAction<string>) => {
      const painting = state.paintings.find((p) => p.id === action.payload)
      if (painting) {
        painting.favorite = !painting.favorite
      }
    },

    /**
     * 添加标签
     */
    addTag: (state, action: PayloadAction<{ id: string; tag: string }>) => {
      const painting = state.paintings.find((p) => p.id === action.payload.id)
      if (painting) {
        if (!painting.tags) painting.tags = []
        if (!painting.tags.includes(action.payload.tag)) {
          painting.tags.push(action.payload.tag)
        }
      }
    },

    /**
     * 移除标签
     */
    removeTag: (state, action: PayloadAction<{ id: string; tag: string }>) => {
      const painting = state.paintings.find((p) => p.id === action.payload.id)
      if (painting?.tags) {
        painting.tags = painting.tags.filter((t) => t !== action.payload.tag)
      }
    },

    // ==================== 提示词历史操作 ====================

    /**
     * 添加提示词到历史
     */
    addPromptHistory: (state, action: PayloadAction<Omit<PromptHistoryItem, 'id' | 'usedAt' | 'useCount'>>) => {
      const existingIndex = state.promptHistory.findIndex(
        (h) => h.prompt === action.payload.prompt && h.negativePrompt === action.payload.negativePrompt
      )

      if (existingIndex !== -1) {
        // 已存在，更新使用次数和时间
        state.promptHistory[existingIndex].useCount++
        state.promptHistory[existingIndex].usedAt = Date.now()
        // 移到最前面
        const [item] = state.promptHistory.splice(existingIndex, 1)
        state.promptHistory.unshift(item)
      } else {
        // 新增
        state.promptHistory.unshift({
          id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          ...action.payload,
          usedAt: Date.now(),
          useCount: 1
        })
      }

      // 限制历史记录数量（最多 100 条）
      if (state.promptHistory.length > 100) {
        state.promptHistory = state.promptHistory.slice(0, 100)
      }
    },

    /**
     * 删除提示词历史
     */
    removePromptHistory: (state, action: PayloadAction<string>) => {
      state.promptHistory = state.promptHistory.filter((h) => h.id !== action.payload)
    },

    /**
     * 清空提示词历史
     */
    clearPromptHistory: (state) => {
      state.promptHistory = state.promptHistory.filter((h) => h.favorite)
    },

    /**
     * 切换提示词收藏
     */
    togglePromptFavorite: (state, action: PayloadAction<string>) => {
      const item = state.promptHistory.find((h) => h.id === action.payload)
      if (item) {
        item.favorite = !item.favorite
      }
    },

    // ==================== 生成队列操作 ====================

    /**
     * 添加任务到队列
     */
    addToQueue: (state, action: PayloadAction<Omit<GenerationTask, 'status' | 'createdAt'>>) => {
      state.generationQueue.push({
        ...action.payload,
        status: 'queued',
        createdAt: Date.now()
      })
      logger.debug(`Added task to queue: ${action.payload.id}`)
    },

    /**
     * 更新任务状态
     */
    updateTaskStatus: (
      state,
      action: PayloadAction<{
        id: string
        status: GenerationTask['status']
        progress?: GenerationTask['progress']
        result?: UnifiedPainting
        error?: string
      }>
    ) => {
      const task = state.generationQueue.find((t) => t.id === action.payload.id)
      if (task) {
        task.status = action.payload.status
        if (action.payload.progress) task.progress = action.payload.progress
        if (action.payload.result) task.result = action.payload.result
        if (action.payload.error) task.error = action.payload.error

        if (action.payload.status === 'running' && !task.startedAt) {
          task.startedAt = Date.now()
        }
        if (['completed', 'failed', 'cancelled'].includes(action.payload.status)) {
          task.completedAt = Date.now()
        }
      }
    },

    /**
     * 移除队列任务
     */
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.generationQueue = state.generationQueue.filter((t) => t.id !== action.payload)
    },

    /**
     * 清空已完成的任务
     */
    clearCompletedTasks: (state) => {
      state.generationQueue = state.generationQueue.filter(
        (t) => !['completed', 'failed', 'cancelled'].includes(t.status)
      )
    },

    /**
     * 设置当前任务
     */
    setCurrentTask: (state, action: PayloadAction<string | undefined>) => {
      state.currentTaskId = action.payload
    },

    // ==================== 筛选和排序 ====================

    /**
     * 设置筛选条件
     */
    setFilter: (state, action: PayloadAction<Partial<UnifiedPaintingsState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload }
    },

    /**
     * 清空筛选条件
     */
    clearFilter: (state) => {
      state.filter = {}
    },

    /**
     * 设置排序
     */
    setSort: (
      state,
      action: PayloadAction<{
        sortBy?: UnifiedPaintingsState['sortBy']
        sortOrder?: UnifiedPaintingsState['sortOrder']
      }>
    ) => {
      if (action.payload.sortBy) state.sortBy = action.payload.sortBy
      if (action.payload.sortOrder) state.sortOrder = action.payload.sortOrder
    },

    // ==================== Art Studio 表单状态 ====================

    /**
     * 保存 Art Studio 表单状态（用于热加载）
     */
    saveArtStudioForm: (
      state,
      action: PayloadAction<{
        providerId: string
        modelId: string
        mode: 'generate' | 'edit'
        values: Record<string, any>
      }>
    ) => {
      state.artStudioForm = action.payload
    },

    /**
     * 清除 Art Studio 表单状态
     */
    clearArtStudioForm: (state) => {
      state.artStudioForm = undefined
    },

    // ==================== 批量操作 ====================

    /**
     * 重置状态
     */
    resetState: () => initialState,

    /**
     * 导入数据（用于数据迁移）
     */
    importData: (state, action: PayloadAction<Partial<UnifiedPaintingsState>>) => {
      if (action.payload.paintings) {
        state.paintings = action.payload.paintings
      }
      if (action.payload.promptHistory) {
        state.promptHistory = action.payload.promptHistory
      }
      if (action.payload.generationQueue) {
        state.generationQueue = action.payload.generationQueue
      }
      logger.info('Imported unified paintings data')
    }
  }
})

// ============================================================================
// 导出
// ============================================================================

export const {
  // 绘画记录
  addPainting,
  addPaintings,
  updatePainting,
  removePainting,
  removePaintings,
  toggleFavorite,
  addTag,
  removeTag,
  // 提示词历史
  addPromptHistory,
  removePromptHistory,
  clearPromptHistory,
  togglePromptFavorite,
  // 生成队列
  addToQueue,
  updateTaskStatus,
  removeFromQueue,
  clearCompletedTasks,
  setCurrentTask,
  // 筛选排序
  setFilter,
  clearFilter,
  setSort,
  // Art Studio 表单状态
  saveArtStudioForm,
  clearArtStudioForm,
  // 批量操作
  resetState,
  importData
} = unifiedPaintingsSlice.actions

export default unifiedPaintingsSlice.reducer

// ============================================================================
// Selectors (使用 createSelector 进行 memoization，避免不必要的重渲染)
// ============================================================================

// 基础 selectors
const selectPaintings = (state: { unifiedPaintings: UnifiedPaintingsState }) => state.unifiedPaintings.paintings
const selectFilter = (state: { unifiedPaintings: UnifiedPaintingsState }) => state.unifiedPaintings.filter
const selectSortBy = (state: { unifiedPaintings: UnifiedPaintingsState }) => state.unifiedPaintings.sortBy
const selectSortOrder = (state: { unifiedPaintings: UnifiedPaintingsState }) => state.unifiedPaintings.sortOrder
const selectPromptHistory = (state: { unifiedPaintings: UnifiedPaintingsState }) => state.unifiedPaintings.promptHistory
const selectGenerationQueue = (state: { unifiedPaintings: UnifiedPaintingsState }) =>
  state.unifiedPaintings.generationQueue

/**
 * 获取筛选后的绘画列表（memoized）
 */
export const selectFilteredPaintings = createSelector(
  [selectPaintings, selectFilter, selectSortBy, selectSortOrder],
  (paintings, filter, sortBy, sortOrder) => {
    let filtered = [...paintings]

    // 应用筛选
    if (filter.providerId) {
      filtered = filtered.filter((p) => p.providerId === filter.providerId)
    }
    if (filter.modelId) {
      filtered = filtered.filter((p) => p.modelId === filter.modelId)
    }
    if (filter.mode) {
      filtered = filtered.filter((p) => p.mode === filter.mode)
    }
    if (filter.status) {
      filtered = filtered.filter((p) => p.status === filter.status)
    }
    if (filter.favoriteOnly) {
      filtered = filtered.filter((p) => p.favorite)
    }
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((p) => p.tags?.some((t) => filter.tags!.includes(t)))
    }

    // 应用排序
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'createdAt':
          comparison = a.createdAt - b.createdAt
          break
        case 'modelId':
          comparison = a.modelId.localeCompare(b.modelId)
          break
        case 'providerId':
          comparison = a.providerId.localeCompare(b.providerId)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }
)

/**
 * 获取收藏的提示词（memoized）
 */
export const selectFavoritePrompts = createSelector([selectPromptHistory], (promptHistory) =>
  promptHistory.filter((h) => h.favorite)
)

/**
 * 获取队列中的任务（memoized）
 */
export const selectQueuedTasks = createSelector([selectGenerationQueue], (generationQueue) =>
  generationQueue.filter((t) => t.status === 'queued')
)

/**
 * 获取当前运行的任务（memoized）
 */
export const selectRunningTask = createSelector([selectGenerationQueue], (generationQueue) =>
  generationQueue.find((t) => t.status === 'running')
)
