/**
 * Canvas Redux Slice
 *
 * 用于持久化 Canvas 页面的状态，防止切换面板时状态丢失
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'
import type { RootState } from '@renderer/store/index'

/**
 * 协同面板模式
 */
export type CollabPanelMode = 'none' | 'collab' | 'crew'

/**
 * 视图模式
 */
export type ViewMode = 'editor' | 'preview' | 'split'

/**
 * 编辑器配置
 */
export interface CanvasEditorSettings {
  autoSave: boolean
  autoSaveInterval: number
  fontSize: number
  tabSize: number
  lineWrapping: boolean
  lineNumbers: boolean
  theme: 'dark' | 'light'
}

/**
 * 待处理的文件变更
 */
export interface PendingFileChange {
  id: string
  filePath: string
  fileName: string
  originalContent: string
  newContent: string
  status: 'pending' | 'applied' | 'rejected'
  timestamp: number
  source: 'collab' | 'crew'
  description?: string
}

/**
 * 协同会话状态
 */
export interface CollabSessionState {
  sessionId: string | null
  isRunning: boolean
  startTime: number | null
  currentTask: string | null
  progress: number
  logs: Array<{
    timestamp: number
    level: 'info' | 'warn' | 'error'
    message: string
  }>
}

/**
 * IDE 面板状态
 */
export interface IDEPanelState {
  // 面板大小 (百分比)
  leftPanelSize: number
  rightPanelSize: number
  bottomPanelSize: number

  // 面板可见性
  leftPanelVisible: boolean
  rightPanelVisible: boolean
  bottomPanelVisible: boolean

  // 活动标签
  activeBottomTab: 'terminal' | 'output' | 'problems'
  activeRightTab: 'chat' | 'config' | 'changes' | 'memory'
}

/**
 * 编辑器标签页
 */
export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  isDirty: boolean
  isActive: boolean
}

/**
 * 上下文元素 (文件/文件夹/记忆)
 */
export interface ContextElement {
  id: string
  type: 'file' | 'folder' | 'selection' | 'memory'
  uri: string
  label: string
  isValid: boolean
}

/**
 * Canvas 状态
 */
export interface CanvasState {
  // 面板状态
  collabPanelMode: CollabPanelMode
  viewMode: ViewMode
  sidebarCollapsed: boolean

  // IDE 面板状态
  idePanel: IDEPanelState

  // 编辑器标签页
  editorTabs: EditorTab[]

  // 上下文元素
  contextElements: ContextElement[]

  // 当前文件
  currentFilePath: string | null
  recentFiles: string[]

  // 编辑器设置
  editorSettings: CanvasEditorSettings

  // 待处理变更 (Windsurf 风格)
  pendingChanges: PendingFileChange[]
  showPendingChangesPreview: boolean

  // 协同状态
  collabSession: CollabSessionState
  crewSession: CollabSessionState
}

/**
 * 默认编辑器设置
 */
const DEFAULT_EDITOR_SETTINGS: CanvasEditorSettings = {
  autoSave: true,
  autoSaveInterval: 3000,
  fontSize: 14,
  tabSize: 2,
  lineWrapping: true,
  lineNumbers: true,
  theme: 'dark'
}

/**
 * 默认 IDE 面板状态
 */
const DEFAULT_IDE_PANEL_STATE: IDEPanelState = {
  leftPanelSize: 15,
  rightPanelSize: 25,
  bottomPanelSize: 30,
  leftPanelVisible: true,
  rightPanelVisible: true,
  bottomPanelVisible: false,
  activeBottomTab: 'output',
  activeRightTab: 'chat'
}

/**
 * 默认协同会话状态
 */
const DEFAULT_SESSION_STATE: CollabSessionState = {
  sessionId: null,
  isRunning: false,
  startTime: null,
  currentTask: null,
  progress: 0,
  logs: []
}

/**
 * 初始状态
 */
const initialState: CanvasState = {
  collabPanelMode: 'none',
  viewMode: 'editor',
  sidebarCollapsed: false,
  idePanel: DEFAULT_IDE_PANEL_STATE,
  editorTabs: [],
  contextElements: [],
  currentFilePath: null,
  recentFiles: [],
  editorSettings: DEFAULT_EDITOR_SETTINGS,
  pendingChanges: [],
  showPendingChangesPreview: false,
  collabSession: DEFAULT_SESSION_STATE,
  crewSession: DEFAULT_SESSION_STATE
}

/**
 * Canvas Slice
 */
const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    // 面板状态
    setCollabPanelMode: (state, action: PayloadAction<CollabPanelMode>) => {
      state.collabPanelMode = action.payload
    },

    setViewMode: (state, action: PayloadAction<ViewMode>) => {
      state.viewMode = action.payload
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },

    // IDE 面板状态
    updateIDEPanel: (state, action: PayloadAction<Partial<IDEPanelState>>) => {
      state.idePanel = { ...state.idePanel, ...action.payload }
    },

    setLeftPanelVisible: (state, action: PayloadAction<boolean>) => {
      state.idePanel.leftPanelVisible = action.payload
    },

    setRightPanelVisible: (state, action: PayloadAction<boolean>) => {
      state.idePanel.rightPanelVisible = action.payload
    },

    setBottomPanelVisible: (state, action: PayloadAction<boolean>) => {
      state.idePanel.bottomPanelVisible = action.payload
    },

    setActiveBottomTab: (state, action: PayloadAction<IDEPanelState['activeBottomTab']>) => {
      state.idePanel.activeBottomTab = action.payload
    },

    setActiveRightTab: (state, action: PayloadAction<IDEPanelState['activeRightTab']>) => {
      state.idePanel.activeRightTab = action.payload
    },

    // 编辑器标签页管理
    addEditorTab: (state, action: PayloadAction<Omit<EditorTab, 'id' | 'isActive'>>) => {
      // 确保 editorTabs 数组存在
      if (!state.editorTabs) {
        state.editorTabs = []
      }
      // 检查是否已存在
      const existing = state.editorTabs.find((t) => t.filePath === action.payload.filePath)
      if (existing) {
        // 激活已存在的标签
        state.editorTabs.forEach((t) => (t.isActive = t.id === existing.id))
        return
      }
      // 取消其他标签的激活状态
      state.editorTabs.forEach((t) => (t.isActive = false))
      // 添加新标签
      state.editorTabs.push({
        ...action.payload,
        id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        isActive: true
      })
    },

    closeEditorTab: (state, action: PayloadAction<string>) => {
      if (!state.editorTabs) {
        state.editorTabs = []
        return
      }
      const index = state.editorTabs.findIndex((t) => t.id === action.payload)
      if (index === -1) return

      const wasActive = state.editorTabs[index].isActive
      state.editorTabs.splice(index, 1)

      // 如果关闭的是活动标签,激活相邻标签
      if (wasActive && state.editorTabs.length > 0) {
        const newIndex = Math.min(index, state.editorTabs.length - 1)
        state.editorTabs[newIndex].isActive = true
        state.currentFilePath = state.editorTabs[newIndex].filePath
      } else if (state.editorTabs.length === 0) {
        state.currentFilePath = null
      }
    },

    setActiveEditorTab: (state, action: PayloadAction<string>) => {
      if (!state.editorTabs) {
        state.editorTabs = []
        return
      }
      state.editorTabs.forEach((t) => (t.isActive = t.id === action.payload))
      const activeTab = state.editorTabs.find((t) => t.id === action.payload)
      if (activeTab) {
        state.currentFilePath = activeTab.filePath
      }
    },

    updateEditorTabDirty: (state, action: PayloadAction<{ id: string; isDirty: boolean }>) => {
      if (!state.editorTabs) {
        state.editorTabs = []
        return
      }
      const tab = state.editorTabs.find((t) => t.id === action.payload.id)
      if (tab) {
        tab.isDirty = action.payload.isDirty
      }
    },

    closeAllEditorTabs: (state) => {
      state.editorTabs = []
      state.currentFilePath = null
    },

    // 上下文元素管理
    addContextElement: (state, action: PayloadAction<Omit<ContextElement, 'id'>>) => {
      // 确保 contextElements 数组存在
      if (!state.contextElements) {
        state.contextElements = []
      }
      // 检查是否已存在
      if (state.contextElements.some((e) => e.uri === action.payload.uri)) {
        return
      }
      state.contextElements.push({
        ...action.payload,
        id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      })
    },

    removeContextElement: (state, action: PayloadAction<string>) => {
      if (!state.contextElements) {
        state.contextElements = []
        return
      }
      state.contextElements = state.contextElements.filter((e) => e.id !== action.payload)
    },

    clearContextElements: (state) => {
      state.contextElements = []
    },

    updateContextElementValidity: (state, action: PayloadAction<{ id: string; isValid: boolean }>) => {
      if (!state.contextElements) {
        state.contextElements = []
        return
      }
      const element = state.contextElements.find((e) => e.id === action.payload.id)
      if (element) {
        element.isValid = action.payload.isValid
      }
    },

    // 文件管理
    setCurrentFilePath: (state, action: PayloadAction<string | null>) => {
      state.currentFilePath = action.payload
      // 添加到最近文件列表
      if (action.payload && !state.recentFiles.includes(action.payload)) {
        state.recentFiles = [action.payload, ...state.recentFiles.slice(0, 9)]
      }
    },

    clearRecentFiles: (state) => {
      state.recentFiles = []
    },

    // 编辑器设置
    updateEditorSettings: (state, action: PayloadAction<Partial<CanvasEditorSettings>>) => {
      state.editorSettings = { ...state.editorSettings, ...action.payload }
    },

    resetEditorSettings: (state) => {
      state.editorSettings = DEFAULT_EDITOR_SETTINGS
    },

    // 待处理变更管理
    addPendingChange: (state, action: PayloadAction<Omit<PendingFileChange, 'id' | 'timestamp' | 'status'>>) => {
      const change: PendingFileChange = {
        ...action.payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        status: 'pending'
      }
      state.pendingChanges.push(change)
    },

    updatePendingChangeStatus: (state, action: PayloadAction<{ id: string; status: PendingFileChange['status'] }>) => {
      const change = state.pendingChanges.find((c) => c.id === action.payload.id)
      if (change) {
        change.status = action.payload.status
      }
    },

    removePendingChange: (state, action: PayloadAction<string>) => {
      state.pendingChanges = state.pendingChanges.filter((c) => c.id !== action.payload)
    },

    clearPendingChanges: (state) => {
      state.pendingChanges = []
    },

    setShowPendingChangesPreview: (state, action: PayloadAction<boolean>) => {
      state.showPendingChangesPreview = action.payload
    },

    // 协同会话状态
    updateCollabSession: (state, action: PayloadAction<Partial<CollabSessionState>>) => {
      state.collabSession = { ...state.collabSession, ...action.payload }
    },

    resetCollabSession: (state) => {
      state.collabSession = DEFAULT_SESSION_STATE
    },

    addCollabLog: (state, action: PayloadAction<{ level: 'info' | 'warn' | 'error'; message: string }>) => {
      state.collabSession.logs.push({
        timestamp: Date.now(),
        ...action.payload
      })
      // 限制日志数量
      if (state.collabSession.logs.length > 100) {
        state.collabSession.logs = state.collabSession.logs.slice(-100)
      }
    },

    // Crew 会话状态
    updateCrewSession: (state, action: PayloadAction<Partial<CollabSessionState>>) => {
      state.crewSession = { ...state.crewSession, ...action.payload }
    },

    resetCrewSession: (state) => {
      state.crewSession = DEFAULT_SESSION_STATE
    },

    addCrewLog: (state, action: PayloadAction<{ level: 'info' | 'warn' | 'error'; message: string }>) => {
      state.crewSession.logs.push({
        timestamp: Date.now(),
        ...action.payload
      })
      // 限制日志数量
      if (state.crewSession.logs.length > 100) {
        state.crewSession.logs = state.crewSession.logs.slice(-100)
      }
    },

    // 重置所有状态
    resetCanvasState: () => initialState
  }
})

// 导出 actions
export const {
  setCollabPanelMode,
  setViewMode,
  setSidebarCollapsed,
  // IDE 面板
  updateIDEPanel,
  setLeftPanelVisible,
  setRightPanelVisible,
  setBottomPanelVisible,
  setActiveBottomTab,
  setActiveRightTab,
  // 编辑器标签页
  addEditorTab,
  closeEditorTab,
  setActiveEditorTab,
  updateEditorTabDirty,
  closeAllEditorTabs,
  // 上下文元素
  addContextElement,
  removeContextElement,
  clearContextElements,
  updateContextElementValidity,
  // 文件
  setCurrentFilePath,
  clearRecentFiles,
  updateEditorSettings,
  resetEditorSettings,
  // 待处理变更
  addPendingChange,
  updatePendingChangeStatus,
  removePendingChange,
  clearPendingChanges,
  setShowPendingChangesPreview,
  // 协同会话
  updateCollabSession,
  resetCollabSession,
  addCollabLog,
  updateCrewSession,
  resetCrewSession,
  addCrewLog,
  resetCanvasState
} = canvasSlice.actions

// Selectors
export const selectCollabPanelMode = (state: RootState) => state.canvas.collabPanelMode
export const selectViewMode = (state: RootState) => state.canvas.viewMode
export const selectSidebarCollapsed = (state: RootState) => state.canvas.sidebarCollapsed
export const selectIDEPanel = (state: RootState) => state.canvas.idePanel ?? DEFAULT_IDE_PANEL_STATE
export const selectEditorTabs = (state: RootState) => state.canvas.editorTabs ?? []
export const selectContextElements = (state: RootState) => state.canvas.contextElements ?? []
export const selectCurrentFilePath = (state: RootState) => state.canvas.currentFilePath
export const selectRecentFiles = (state: RootState) => state.canvas.recentFiles
export const selectEditorSettings = (state: RootState) => state.canvas.editorSettings
export const selectPendingChanges = (state: RootState) => state.canvas.pendingChanges
export const selectShowPendingChangesPreview = (state: RootState) => state.canvas.showPendingChangesPreview
export const selectCollabSession = (state: RootState) => state.canvas.collabSession
export const selectCrewSession = (state: RootState) => state.canvas.crewSession

// 派生 selectors
export const selectPendingChangesCount = (state: RootState) =>
  state.canvas.pendingChanges.filter((c) => c.status === 'pending').length

export const selectIsAnySessionRunning = (state: RootState) =>
  state.canvas.collabSession.isRunning || state.canvas.crewSession.isRunning

export const selectActiveEditorTab = (state: RootState) => state.canvas.editorTabs?.find((t) => t.isActive)

export const selectValidContextElements = (state: RootState) =>
  state.canvas.contextElements?.filter((e) => e.isValid) ?? []

export default canvasSlice.reducer
