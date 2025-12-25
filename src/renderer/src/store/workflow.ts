/**
 * 工作流 Redux Store
 * 管理工作流的状态、节点、执行状态等
 * Cherry Studio 本土化版本
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'
import type { Model, Provider } from '@renderer/types'
import { uuid } from '@renderer/utils'

import type { NodeExecutionResult } from '../pages/workflow/engine/WorkflowEngine'
import type {
  NodePreset,
  PresetCategory,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType
} from '../pages/workflow/types'
import { createNodeData } from '../pages/workflow/types'

export interface WorkflowState {
  // 当前工作流
  currentWorkflow: Workflow | null

  // 工作流模板列表
  templates: Array<{
    id: string
    name: string
    description?: string
    tags?: string[]
    createdAt: number
    updatedAt: number
  }>

  // 节点配置预设
  presets: Record<string, NodePreset>
  presetCategories: Record<string, PresetCategory>

  // ReactFlow 节点和边
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]

  // 执行状态
  isExecuting: boolean
  executionProgress: number
  executionMessage: string
  nodeResults: Record<string, NodeExecutionResult>

  // 重试相关状态
  failedNodeId: string | null // 失败的节点 ID
  retryCount: number // 当前重试次数
  maxRetries: number // 最大重试次数
  lastExecutionContext: any | null // 上次执行的上下文（用于重试）

  // 执行设置
  maxConcurrency: number // 最大并发数（默认 3）
  parallelExecution: boolean // 是否启用并行执行（默认 true）

  // Provider 和 Model 缓存（从 llm store 同步）
  providers: Provider[]
  models: Model[]

  // 选中的节点
  selectedNodeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]

  // UI 状态
  showNodePanel: boolean
  showConfigPanel: boolean
  showStatusPanel: boolean

  // 历史记录（用于撤销/重做）
  history: Array<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>
  historyIndex: number
}

const initialState: WorkflowState = {
  currentWorkflow: null,
  templates: [],
  nodes: [],
  edges: [],
  isExecuting: false,
  executionProgress: 0,
  executionMessage: '',
  nodeResults: {},
  failedNodeId: null,
  retryCount: 0,
  maxRetries: 3,
  lastExecutionContext: null,
  maxConcurrency: 3,
  parallelExecution: true,
  providers: [],
  models: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  showNodePanel: true,
  showConfigPanel: true,
  showStatusPanel: true,
  history: [],
  historyIndex: -1,
  presets: {},
  presetCategories: {
    default: {
      id: 'default',
      name: '默认分类',
      presets: []
    }
  }
}

// 辅助函数：保存历史记录
// 使用 structuredClone 替代 JSON.parse/stringify，性能更好
function pushHistory(state: WorkflowState) {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }

  // 清理节点数据中的大型对象（如 result），减少历史记录大小
  const cleanedNodes = state.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      result: undefined // 不保存执行结果到历史
    }
  }))

  state.history.push({
    nodes: structuredClone(cleanedNodes),
    edges: structuredClone(state.edges)
  })
  state.historyIndex = state.history.length - 1

  const MAX_HISTORY = 30 // 减少历史记录数量
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(-MAX_HISTORY)
    state.historyIndex = state.history.length - 1
  }
}

type HandleLike = { id: string }

function toHandleIdSet(handles: unknown): Set<string> {
  if (!Array.isArray(handles)) return new Set()
  const ids = handles
    .map((h) => (h && typeof h === 'object' ? (h as HandleLike).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  return new Set(ids)
}

function shouldKeepEdgeHandle(handleId: string | null | undefined, availableHandleIds: Set<string>): boolean {
  if (availableHandleIds.size === 0) return false
  if (!handleId) return availableHandleIds.size === 1
  return availableHandleIds.has(handleId)
}

/**
 * 当节点 inputs/outputs 发生变化时，移除指向不存在 handle 的边。
 */
function pruneEdgesForNodePorts(state: WorkflowState, nodeId: string) {
  const node = state.nodes.find((n) => n.id === nodeId)
  if (!node) return

  const inputIds = toHandleIdSet((node.data as any)?.inputs)
  const outputIds = toHandleIdSet((node.data as any)?.outputs)

  const nextEdges = state.edges.filter((edge) => {
    if (edge.source === nodeId) {
      if (!shouldKeepEdgeHandle(edge.sourceHandle, outputIds)) return false
    }
    if (edge.target === nodeId) {
      if (!shouldKeepEdgeHandle(edge.targetHandle, inputIds)) return false
    }
    return true
  })

  if (nextEdges.length === state.edges.length) return
  state.edges = nextEdges

  const remainingEdgeIds = new Set(state.edges.map((e) => e.id))
  state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => remainingEdgeIds.has(id))
}

// 辅助函数：清理大型数据，避免 localStorage 配额超出
// 只保存结果的元数据，不保存实际的图片/视频 base64 数据
function cleanResultForStorage(result: any): any {
  if (!result) return result

  const cleaned = { ...result }

  // 清理嵌套的 result 对象
  if (cleaned.result && typeof cleaned.result === 'object') {
    cleaned.result = cleanLargeData(cleaned.result)
  }

  // 清理顶层的大型数据
  return cleanLargeData(cleaned)
}

// 清理单个对象中的大型数据
// 注意：保留 indexeddb:// 引用，只清理原始 base64 数据
function cleanLargeData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj

  const cleaned = { ...obj }

  // 清理图片数据 - 如果是 base64 字符串且超过 1KB，替换为占位符
  // 但保留 indexeddb:// 引用和 http/https URL
  if (cleaned.image && typeof cleaned.image === 'string' && cleaned.image.length > 1000) {
    if (
      !cleaned.image.startsWith('indexeddb://') &&
      !cleaned.image.startsWith('http://') &&
      !cleaned.image.startsWith('https://')
    ) {
      cleaned.image = '[IMAGE_DATA_CLEARED]'
    }
  }

  // 清理视频数据 - 同样保留 indexeddb:// 引用和 URL
  if (cleaned.video && typeof cleaned.video === 'string' && cleaned.video.length > 1000) {
    if (
      !cleaned.video.startsWith('indexeddb://') &&
      !cleaned.video.startsWith('http://') &&
      !cleaned.video.startsWith('https://')
    ) {
      cleaned.video = '[VIDEO_DATA_CLEARED]'
    }
  }

  // 清理 downloadItems 中的数据
  if (cleaned.downloadItems && Array.isArray(cleaned.downloadItems)) {
    cleaned.downloadItems = cleaned.downloadItems.map((item: any) => ({
      ...item,
      data: item.data && item.data.length > 1000 ? '[DATA_CLEARED]' : item.data
    }))
  }

  return cleaned
}

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    // ===== 工作流管理 =====
    setCurrentWorkflow: (state, action: PayloadAction<Workflow | null>) => {
      state.currentWorkflow = action.payload
      if (action.payload) {
        state.nodes = action.payload.nodes
        state.edges = action.payload.edges
      }
    },

    createWorkflow: (state, action: PayloadAction<{ name: string; description?: string }>) => {
      const newWorkflow: Workflow = {
        id: uuid(),
        name: action.payload.name,
        description: action.payload.description,
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      state.currentWorkflow = newWorkflow
      state.nodes = []
      state.edges = []
      state.selectedNodeId = null
      state.selectedNodeIds = []
      state.selectedEdgeIds = []
      state.nodeResults = {}
      state.history = []
      state.historyIndex = -1
    },

    clearWorkflow: (state) => {
      state.currentWorkflow = null
      state.nodes = []
      state.edges = []
      state.selectedNodeId = null
      state.selectedNodeIds = []
      state.selectedEdgeIds = []
      state.nodeResults = {}
      state.history = []
      state.historyIndex = -1
    },

    // ===== 节点操作 =====
    addNode: (
      state,
      action: PayloadAction<{
        id?: string
        type: string
        position: { x: number; y: number }
        data?: Partial<WorkflowNodeData>
      }>
    ) => {
      const { type, position, data } = action.payload
      const nodeType = (data?.nodeType || type) as WorkflowNodeType

      const nodeData = createNodeData(nodeType, {
        type,
        ...data
      }) as WorkflowNodeData

      const newNode: WorkflowNode = {
        id: action.payload.id || `node-${uuid()}`,
        type: 'cherry',
        position,
        data: nodeData as WorkflowNodeData & Record<string, unknown>
      }

      state.nodes.push(newNode)

      if (state.currentWorkflow) {
        state.currentWorkflow.nodes = state.nodes
        state.currentWorkflow.updatedAt = Date.now()
      }

      pushHistory(state)
    },

    updateNode: (
      state,
      action: PayloadAction<{
        id: string
        data?: Partial<WorkflowNodeData>
        position?: { x: number; y: number }
      }>
    ) => {
      const { id, data, position } = action.payload
      const node = state.nodes.find((n) => n.id === id)

      if (node) {
        if (data) {
          node.data = { ...node.data, ...data } as WorkflowNodeData & Record<string, unknown>
        }
        if (position) {
          node.position = position
        }

        if (data && ('inputs' in data || 'outputs' in data)) {
          pruneEdgesForNodePorts(state, id)
        }

        if (state.currentWorkflow) {
          state.currentWorkflow.nodes = state.nodes
          state.currentWorkflow.edges = state.edges
          state.currentWorkflow.updatedAt = Date.now()
        }
      }
    },

    updateNodePosition: (state, action: PayloadAction<{ id: string; position: { x: number; y: number } }>) => {
      const node = state.nodes.find((n) => n.id === action.payload.id)
      if (node) {
        node.position = action.payload.position
      }
    },

    removeNode: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload
      state.nodes = state.nodes.filter((n) => n.id !== nodeId)
      state.edges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

      if (state.selectedNodeId === nodeId) {
        state.selectedNodeId = null
      }
      state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId)

      if (state.currentWorkflow) {
        state.currentWorkflow.nodes = state.nodes
        state.currentWorkflow.edges = state.edges
        state.currentWorkflow.updatedAt = Date.now()
      }

      pushHistory(state)
    },

    setNodes: (state, action: PayloadAction<WorkflowNode[]>) => {
      state.nodes = action.payload
      if (state.currentWorkflow) {
        state.currentWorkflow.nodes = state.nodes
        state.currentWorkflow.updatedAt = Date.now()
      }
    },

    // ===== 边操作 =====
    addEdge: (state, action: PayloadAction<WorkflowEdge>) => {
      const exists = state.edges.some(
        (e) =>
          e.source === action.payload.source &&
          e.target === action.payload.target &&
          e.sourceHandle === action.payload.sourceHandle &&
          e.targetHandle === action.payload.targetHandle
      )

      if (!exists) {
        state.edges.push({
          ...action.payload,
          id: action.payload.id || `edge-${uuid()}`
        })

        if (state.currentWorkflow) {
          state.currentWorkflow.edges = state.edges
          state.currentWorkflow.updatedAt = Date.now()
        }

        pushHistory(state)
      }
    },

    removeEdge: (state, action: PayloadAction<string>) => {
      state.edges = state.edges.filter((e) => e.id !== action.payload)
      state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => id !== action.payload)

      if (state.currentWorkflow) {
        state.currentWorkflow.edges = state.edges
        state.currentWorkflow.updatedAt = Date.now()
      }

      pushHistory(state)
    },

    setEdges: (state, action: PayloadAction<WorkflowEdge[]>) => {
      state.edges = action.payload
      if (state.currentWorkflow) {
        state.currentWorkflow.edges = state.edges
        state.currentWorkflow.updatedAt = Date.now()
      }
    },

    // ===== 选择操作 =====
    setSelectedNodeId: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload
      state.selectedNodeIds = action.payload ? [action.payload] : []
    },

    setSelectedNodes: (state, action: PayloadAction<string[]>) => {
      state.selectedNodeIds = action.payload
      state.selectedNodeId = action.payload[0] || null
    },

    setSelectedEdges: (state, action: PayloadAction<string[]>) => {
      state.selectedEdgeIds = action.payload
    },

    clearSelection: (state) => {
      state.selectedNodeId = null
      state.selectedNodeIds = []
      state.selectedEdgeIds = []
    },

    // ===== 执行状态 =====
    startExecution: (state) => {
      state.isExecuting = true
      state.executionProgress = 0
      state.executionMessage = '准备执行...'
      state.nodeResults = {}

      state.nodes.forEach((node) => {
        node.data.status = 'idle'
        node.data.errorMessage = undefined
        node.data.result = undefined
      })
    },

    updateExecutionProgress: (state, action: PayloadAction<{ progress: number; message: string }>) => {
      state.executionProgress = action.payload.progress
      state.executionMessage = action.payload.message
    },

    updateNodeStatus: (
      state,
      action: PayloadAction<{
        nodeId: string
        status: WorkflowNodeData['status']
        errorMessage?: string
        result?: WorkflowNodeData['result']
      }>
    ) => {
      const node = state.nodes.find((n) => n.id === action.payload.nodeId)
      if (node) {
        node.data.status = action.payload.status
        if (action.payload.errorMessage !== undefined) {
          node.data.errorMessage = action.payload.errorMessage
        }
        if (action.payload.result !== undefined) {
          // 清理大型数据，避免 localStorage 配额超出
          // 注意：OutputNode 的 useEffect 会在清理前先处理下载
          const cleanedResult = cleanResultForStorage(action.payload.result)
          node.data.result = cleanedResult
        }
      }
    },

    setNodeResult: (state, action: PayloadAction<NodeExecutionResult>) => {
      // nodeId 由 WorkflowEngine.executeNode 总是设置
      const nodeId = action.payload.nodeId
      if (!nodeId) return // 安全检查

      // 清理大型数据，避免 localStorage 配额超出
      const cleanedPayload: NodeExecutionResult = {
        ...action.payload,
        outputs: cleanResultForStorage(action.payload.outputs)
      }
      state.nodeResults[nodeId] = cleanedPayload
    },

    finishExecution: (
      state,
      action: PayloadAction<{
        success: boolean
        error?: string
        failedNodeId?: string
        context?: any
      }>
    ) => {
      state.isExecuting = false
      state.executionProgress = 100
      state.executionMessage = action.payload.success ? '执行完成' : `执行失败: ${action.payload.error}`

      // 更新失败节点信息
      if (!action.payload.success && action.payload.failedNodeId) {
        state.failedNodeId = action.payload.failedNodeId
        state.retryCount = (state.retryCount || 0) + 1
        state.lastExecutionContext = action.payload.context || null
      } else if (action.payload.success) {
        // 成功时重置重试状态
        state.failedNodeId = null
        state.retryCount = 0
        state.lastExecutionContext = null
      }
    },

    // 重试执行
    setRetryState: (
      state,
      action: PayloadAction<{
        failedNodeId: string | null
        retryCount: number
        context?: any
      }>
    ) => {
      state.failedNodeId = action.payload.failedNodeId
      state.retryCount = action.payload.retryCount
      state.lastExecutionContext = action.payload.context || null
    },

    // 清除重试状态
    clearRetryState: (state) => {
      state.failedNodeId = null
      state.retryCount = 0
      state.lastExecutionContext = null
    },

    // 更新执行设置
    setExecutionSettings: (
      state,
      action: PayloadAction<{
        maxConcurrency?: number
        parallelExecution?: boolean
        maxRetries?: number
      }>
    ) => {
      if (action.payload.maxConcurrency !== undefined) {
        state.maxConcurrency = Math.max(1, Math.min(10, action.payload.maxConcurrency))
      }
      if (action.payload.parallelExecution !== undefined) {
        state.parallelExecution = action.payload.parallelExecution
      }
      if (action.payload.maxRetries !== undefined) {
        state.maxRetries = Math.max(0, Math.min(10, action.payload.maxRetries))
      }
    },

    // ===== Provider/Model 同步 =====
    syncProvidersAndModels: (
      state,
      action: PayloadAction<{
        providers: Provider[]
        models: Model[]
      }>
    ) => {
      state.providers = action.payload.providers
      state.models = action.payload.models
    },

    // ===== UI 状态 =====
    toggleNodePanel: (state) => {
      state.showNodePanel = !state.showNodePanel
    },

    toggleConfigPanel: (state) => {
      state.showConfigPanel = !state.showConfigPanel
    },

    toggleStatusPanel: (state) => {
      state.showStatusPanel = !state.showStatusPanel
    },

    // ===== 历史操作 =====
    undo: (state) => {
      if (state.historyIndex > 0) {
        state.historyIndex--
        const historyState = state.history[state.historyIndex]
        state.nodes = historyState.nodes
        state.edges = historyState.edges

        if (state.currentWorkflow) {
          state.currentWorkflow.nodes = state.nodes
          state.currentWorkflow.edges = state.edges
        }
      }
    },

    redo: (state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++
        const historyState = state.history[state.historyIndex]
        state.nodes = historyState.nodes
        state.edges = historyState.edges

        if (state.currentWorkflow) {
          state.currentWorkflow.nodes = state.nodes
          state.currentWorkflow.edges = state.edges
        }
      }
    },

    // ===== 模板管理 =====
    addTemplate: (
      state,
      action: PayloadAction<{ id: string; name: string; description?: string; tags?: string[] }>
    ) => {
      state.templates.push({
        ...action.payload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    },

    removeTemplate: (state, action: PayloadAction<string>) => {
      state.templates = state.templates.filter((t) => t.id !== action.payload)
    },

    setTemplates: (state, action: PayloadAction<WorkflowState['templates']>) => {
      state.templates = action.payload
    },

    // ===== 预设管理 =====
    addPreset: (
      state,
      action: PayloadAction<{
        name: string
        nodeType: WorkflowNodeType
        config: WorkflowNodeData['config']
        description?: string
        tags?: string[]
        categoryId?: string
      }>
    ) => {
      const { name, nodeType, config, description, tags, categoryId = 'default' } = action.payload

      const preset: NodePreset = {
        id: `preset-${uuid()}`,
        name,
        nodeType,
        config: JSON.parse(JSON.stringify(config)),
        description,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      state.presets[preset.id] = preset

      if (state.presetCategories[categoryId]) {
        state.presetCategories[categoryId].presets.push(preset)
      }
    },

    updatePreset: (
      state,
      action: PayloadAction<{
        id: string
        name?: string
        description?: string
        config?: WorkflowNodeData['config']
        tags?: string[]
      }>
    ) => {
      const { id, name, description, config, tags } = action.payload
      const preset = state.presets[id]

      if (preset) {
        if (name !== undefined) preset.name = name
        if (description !== undefined) preset.description = description
        if (config !== undefined) preset.config = JSON.parse(JSON.stringify(config))
        if (tags !== undefined) preset.tags = tags
        preset.updatedAt = Date.now()
      }
    },

    removePreset: (state, action: PayloadAction<string>) => {
      const presetId = action.payload

      Object.values(state.presetCategories).forEach((category) => {
        category.presets = category.presets.filter((p) => p.id !== presetId)
      })

      delete state.presets[presetId]
    }
  }
})

export const {
  setCurrentWorkflow,
  createWorkflow,
  clearWorkflow,
  addNode,
  updateNode,
  updateNodePosition,
  removeNode,
  setNodes,
  addEdge,
  removeEdge,
  setEdges,
  setSelectedNodeId,
  setSelectedNodes,
  setSelectedEdges,
  clearSelection,
  startExecution,
  updateExecutionProgress,
  updateNodeStatus,
  setNodeResult,
  finishExecution,
  syncProvidersAndModels,
  toggleNodePanel,
  toggleConfigPanel,
  toggleStatusPanel,
  undo,
  redo,
  addTemplate,
  removeTemplate,
  setTemplates,
  addPreset,
  updatePreset,
  removePreset,
  setRetryState,
  clearRetryState,
  setExecutionSettings
} = workflowSlice.actions

export default workflowSlice.reducer
