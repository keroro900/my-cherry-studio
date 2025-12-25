/**
 * Image Studio Redux Slice
 *
 * 管理图片工坊的状态：项目、版本、任务队列、模块配置
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type {
  DEFAULT_ECOM_CONFIG,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_PATTERN_CONFIG,
  EcomModuleConfig,
  ImageOutputs,
  ImageProject,
  ImageStudioState,
  ImageTask,
  ImageVersion,
  ModelModuleConfig,
  PatternModuleConfig,
  StudioModule,
  TaskProgress,
  TaskStatus
} from '@renderer/pages/image-studio/types'

// ============================================================================
// 初始状态
// ============================================================================

const initialState: ImageStudioState = {
  activeModule: 'ecom',

  projects: [],
  currentProjectId: null,

  taskQueue: [],
  isPaused: false,
  maxConcurrency: 2,

  ecomConfig: {
    layout: 'model_shot',
    fillMode: 'filled',
    stylePreset: 'auto',
    imageSize: '2K',
    aspectRatio: '3:4',
    enableBack: false,
    enableDetail: false,
    detailTypes: [],
    useSystemPrompt: true,
    professionalRetouch: true
  },

  modelConfig: {
    ageGroup: 'adult',
    gender: 'female',
    scenePreset: 'indoor',
    poseStyle: 'natural',
    imageSize: '2K',
    aspectRatio: '3:4'
  },

  patternConfig: {
    generationMode: 'mode_a',
    outputType: 'set',
    patternType: 'seamless',
    density: 'medium',
    colorTone: 'auto',
    imageSize: '2K',
    aspectRatio: '1:1',
    batchSize: 1
  },

  providerId: '',
  modelId: '',

  showLocalEditor: false,
  selectedImageId: null,
  localEditorBaseImage: null
}

// ============================================================================
// Slice
// ============================================================================

const imageStudioSlice = createSlice({
  name: 'imageStudio',
  initialState,
  reducers: {
    // ========================================================================
    // 模块切换
    // ========================================================================

    setActiveModule: (state, action: PayloadAction<StudioModule>) => {
      state.activeModule = action.payload
    },

    // ========================================================================
    // Provider 选择
    // ========================================================================

    setProvider: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      state.providerId = action.payload.providerId
      state.modelId = action.payload.modelId
    },

    // ========================================================================
    // 项目管理
    // ========================================================================

    createProject: (
      state,
      action: PayloadAction<{
        id: string
        name: string
        module: StudioModule
        originalInputs: ImageProject['originalInputs']
      }>
    ) => {
      const now = Date.now()
      const project: ImageProject = {
        id: action.payload.id,
        name: action.payload.name,
        module: action.payload.module,
        createdAt: now,
        updatedAt: now,
        versions: [],
        currentVersionId: null,
        originalInputs: action.payload.originalInputs
      }
      state.projects.unshift(project)
      state.currentProjectId = project.id
    },

    deleteProject: (state, action: PayloadAction<string>) => {
      const index = state.projects.findIndex((p) => p.id === action.payload)
      if (index !== -1) {
        state.projects.splice(index, 1)
        if (state.currentProjectId === action.payload) {
          state.currentProjectId = state.projects[0]?.id || null
        }
      }
      // 同时删除相关任务
      state.taskQueue = state.taskQueue.filter((t) => t.projectId !== action.payload)
    },

    setCurrentProject: (state, action: PayloadAction<string | null>) => {
      state.currentProjectId = action.payload
    },

    updateProjectInputs: (
      state,
      action: PayloadAction<{
        projectId: string
        inputs: ImageProject['originalInputs']
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId)
      if (project) {
        project.originalInputs = action.payload.inputs
        project.updatedAt = Date.now()
      }
    },

    // ========================================================================
    // 版本管理
    // ========================================================================

    addVersion: (
      state,
      action: PayloadAction<{
        projectId: string
        version: Omit<ImageVersion, 'projectId'>
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId)
      if (project) {
        const version: ImageVersion = {
          ...action.payload.version,
          projectId: action.payload.projectId
        }
        project.versions.push(version)
        project.currentVersionId = version.id
        project.updatedAt = Date.now()
      }
    },

    updateVersion: (
      state,
      action: PayloadAction<{
        projectId: string
        versionId: string
        updates: Partial<Pick<ImageVersion, 'outputs' | 'status' | 'error'>>
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId)
      if (project) {
        const version = project.versions.find((v) => v.id === action.payload.versionId)
        if (version) {
          Object.assign(version, action.payload.updates)
          project.updatedAt = Date.now()
        }
      }
    },

    setCurrentVersion: (
      state,
      action: PayloadAction<{
        projectId: string
        versionId: string
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId)
      if (project) {
        project.currentVersionId = action.payload.versionId
      }
    },

    rollbackToVersion: (
      state,
      action: PayloadAction<{
        projectId: string
        versionId: string
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId)
      if (project) {
        const versionIndex = project.versions.findIndex((v) => v.id === action.payload.versionId)
        if (versionIndex !== -1) {
          // 删除该版本之后的所有版本
          project.versions = project.versions.slice(0, versionIndex + 1)
          project.currentVersionId = action.payload.versionId
          project.updatedAt = Date.now()
        }
      }
    },

    // ========================================================================
    // 任务队列管理
    // ========================================================================

    addTask: (state, action: PayloadAction<ImageTask>) => {
      state.taskQueue.push(action.payload)
    },

    updateTaskStatus: (
      state,
      action: PayloadAction<{
        taskId: string
        status: TaskStatus
        error?: string
      }>
    ) => {
      const task = state.taskQueue.find((t) => t.id === action.payload.taskId)
      if (task) {
        task.status = action.payload.status
        if (action.payload.error) {
          task.error = action.payload.error
        }
        if (action.payload.status === 'running') {
          task.startedAt = Date.now()
        }
        if (['completed', 'failed', 'cancelled'].includes(action.payload.status)) {
          task.completedAt = Date.now()
        }
      }
    },

    updateTaskProgress: (
      state,
      action: PayloadAction<{
        taskId: string
        progress: TaskProgress
      }>
    ) => {
      const task = state.taskQueue.find((t) => t.id === action.payload.taskId)
      if (task) {
        task.progress = action.payload.progress
      }
    },

    removeTask: (state, action: PayloadAction<string>) => {
      const index = state.taskQueue.findIndex((t) => t.id === action.payload)
      if (index !== -1) {
        state.taskQueue.splice(index, 1)
      }
    },

    clearCompletedTasks: (state) => {
      state.taskQueue = state.taskQueue.filter((t) => !['completed', 'failed', 'cancelled'].includes(t.status))
    },

    pauseAllTasks: (state) => {
      state.isPaused = true
    },

    resumeAllTasks: (state) => {
      state.isPaused = false
    },

    setMaxConcurrency: (state, action: PayloadAction<number>) => {
      state.maxConcurrency = Math.max(1, Math.min(5, action.payload))
    },

    // ========================================================================
    // 模块配置更新
    // ========================================================================

    updateEcomConfig: (state, action: PayloadAction<Partial<EcomModuleConfig>>) => {
      Object.assign(state.ecomConfig, action.payload)
    },

    updateModelConfig: (state, action: PayloadAction<Partial<ModelModuleConfig>>) => {
      Object.assign(state.modelConfig, action.payload)
    },

    updatePatternConfig: (state, action: PayloadAction<Partial<PatternModuleConfig>>) => {
      Object.assign(state.patternConfig, action.payload)
    },

    // ========================================================================
    // 局部编辑器
    // ========================================================================

    openLocalEditor: (state, action: PayloadAction<string>) => {
      state.showLocalEditor = true
      state.localEditorBaseImage = action.payload
    },

    closeLocalEditor: (state) => {
      state.showLocalEditor = false
      state.localEditorBaseImage = null
    },

    setSelectedImage: (state, action: PayloadAction<string | null>) => {
      state.selectedImageId = action.payload
    },

    // ========================================================================
    // 重置
    // ========================================================================

    resetState: () => initialState
  }
})

// ============================================================================
// 导出
// ============================================================================

export const {
  setActiveModule,
  setProvider,
  createProject,
  deleteProject,
  setCurrentProject,
  updateProjectInputs,
  addVersion,
  updateVersion,
  setCurrentVersion,
  rollbackToVersion,
  addTask,
  updateTaskStatus,
  updateTaskProgress,
  removeTask,
  clearCompletedTasks,
  pauseAllTasks,
  resumeAllTasks,
  setMaxConcurrency,
  updateEcomConfig,
  updateModelConfig,
  updatePatternConfig,
  openLocalEditor,
  closeLocalEditor,
  setSelectedImage,
  resetState
} = imageStudioSlice.actions

export default imageStudioSlice.reducer

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveModule = (state: { imageStudio: ImageStudioState }) => state.imageStudio.activeModule

export const selectCurrentProject = (state: { imageStudio: ImageStudioState }) => {
  const { projects, currentProjectId } = state.imageStudio
  return projects.find((p) => p.id === currentProjectId) || null
}

export const selectCurrentVersion = (state: { imageStudio: ImageStudioState }) => {
  const project = selectCurrentProject(state)
  if (!project) return null
  return project.versions.find((v) => v.id === project.currentVersionId) || null
}

export const selectTaskQueue = (state: { imageStudio: ImageStudioState }) => state.imageStudio.taskQueue

export const selectRunningTasks = (state: { imageStudio: ImageStudioState }) =>
  state.imageStudio.taskQueue.filter((t) => t.status === 'running')

export const selectQueuedTasks = (state: { imageStudio: ImageStudioState }) =>
  state.imageStudio.taskQueue.filter((t) => t.status === 'queued')

export const selectIsPaused = (state: { imageStudio: ImageStudioState }) => state.imageStudio.isPaused

export const selectModuleConfig = (state: { imageStudio: ImageStudioState }) => {
  const { activeModule, ecomConfig, modelConfig, patternConfig } = state.imageStudio
  switch (activeModule) {
    case 'ecom':
      return ecomConfig
    case 'model':
      return modelConfig
    case 'pattern':
      return patternConfig
  }
}

export const selectProviderConfig = (state: { imageStudio: ImageStudioState }) => ({
  providerId: state.imageStudio.providerId,
  modelId: state.imageStudio.modelId
})
