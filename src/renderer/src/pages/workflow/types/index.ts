/**
 * 工作流类型定义 - Cherry Studio 本土化版本
 *
 * 设计原则：
 * 1. 使用 Cherry Studio 原生的 Provider/Model 类型
 * 2. 基于 ReactFlow 连线传递数据（不使用步骤 ID 引用）
 * 3. 节点类型与后端对应，但使用 Cherry 风格命名
 * 4. 输入输出通过 Handle 定义，连线决定数据流向
 */

import { loggerService } from '@logger'
import type { Edge, Node } from '@xyflow/react'

import { NodeRegistryAdapter } from '../nodes/base/NodeRegistryAdapter'
import type { NodeHandle, WorkflowDataType, WorkflowNodeType } from '../nodes/definitions'
import { getNodeDefinition as _getNodeDefinition } from '../nodes/definitions'

const logger = loggerService.withContext('WorkflowTypes')

// Re-export preset types
export * from './preset'

// Re-export core types (execution results, contexts, etc.) - 主要的执行类型
// 包含 NodeExecutionResult, NodeExecutionContext, NodeExecutor 等核心类型
export * from './core'

// Re-export generic config types (类型安全的节点配置)
// 包含 BaseAIConfig, EcomNodeConfig, ModelNodeConfig, PatternNodeConfig 等
export * from './config'

// Re-export node definitions from nodes module (保持兼容性)
// Types need to be exported with 'export type' due to isolatedModules
export type {
  ConditionConfig,
  FolderPathItem,
  ImageEditConfig,
  ImageFileInfo,
  ImageGenerateConfig,
  ImageInputConfig,
  ImageMatchMode,
  ImageToVideoConfig,
  NodeDefinition,
  NodeHandle,
  OutputConfig,
  TextInputConfig,
  WorkflowDataType
} from '../nodes/definitions'

// Re-export values (enums, constants, functions)
export {
  getAllNodeTypes,
  getNodeDefinition,
  getNodesByCategory,
  isValidNodeType,
  /**
   * @deprecated 请使用 NodeRegistryAdapter 代替
   * @see NodeRegistryAdapter.getNodeDefinition()
   * @see NodeRegistryAdapter.getAllNodeTypes()
   */
  NODE_REGISTRY,
  WorkflowNodeType
} from '../nodes/definitions'

// 推荐使用的现代 API
export { NodeRegistryAdapter } from '../nodes/base/NodeRegistryAdapter'

// ==================== 节点数据类型 ====================

/**
 * 通用节点数据结构
 * 所有工作流节点都使用这个结构
 */
export interface WorkflowNodeData {
  // 基础信息
  label: string
  nodeType: WorkflowNodeType // 明确使用 nodeType 避免与 ReactFlow 的 type 冲突
  type?: string // 兼容旧代码的别名
  description?: string

  // 输入输出端口定义
  inputs: NodeHandle[]
  outputs: NodeHandle[]

  // 节点配置（根据 nodeType 不同而不同）
  config: Record<string, any> // 使用通用类型，各节点自行解析

  // 执行状态
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped' | 'completed'
  errorMessage?: string
  error?: string // 兼容旧代码

  // 执行结果（运行时数据）
  result?: {
    // 视觉提示词结果
    promptJson?: Record<string, any>
    // 图片结果
    images?: string[]
    // 视频结果
    videos?: string[]
    // 文本结果
    text?: string
    // 图片对比节点（纯展示）结果
    _compareData?: {
      beforeImage?: string
      afterImage?: string
      initialPosition?: number
      showLabels?: boolean
      previewSize?: 'small' | 'medium' | 'large'
    }
    // 原始输出
    raw?: any
  }

  // Cherry Studio 集成字段
  providerId?: string
  modelId?: string

  // 重试配置
  retry?: number
  retryDelay?: number
  timeout?: number
}

// ==================== 执行结果类型 ====================

// 注意：NodeExecutionResult 已迁移到 ./core.ts，请从那里导入

// ==================== ReactFlow 节点类型 ====================

/**
 * 工作流 ReactFlow 节点类型
 * 注意：ReactFlow 的 Node 类型要求 data 满足 Record<string, unknown>
 */
export type WorkflowNode = Node<WorkflowNodeData & Record<string, unknown>>

/**
 * 工作流 ReactFlow 边类型
 * 边代表数据流向
 */
export interface WorkflowEdge extends Edge {
  // 数据类型（用于验证连接是否有效）
  dataType?: WorkflowDataType
  // 是否已验证
  validated?: boolean
}

// ==================== 工作流定义 ====================

/**
 * 完整的工作流定义
 */
export interface Workflow {
  id: string
  name: string
  description?: string
  tags?: string[]

  // ReactFlow 数据
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]

  // 工作流级别配置
  maxWorkers?: number // 最大并发数

  // 元数据
  createdAt: number
  updatedAt: number
}

// ==================== 本地辅助函数 ====================

/**
 * 创建新节点数据
 * 自动应用预设的系统提示词
 * 自动合并动态端口配置（imageInputPorts）
 */
export function createNodeData(type: WorkflowNodeType, overrides?: Partial<WorkflowNodeData>): WorkflowNodeData {
  const def = NodeRegistryAdapter.getNodeDefinition(type) ?? _getNodeDefinition(type)

  const { config: overrideConfig, inputs: overrideInputs, outputs: overrideOutputs, ...restOverrides } = overrides ?? {}

  // 注意：提示词现在由各节点的 prompts.ts 文件管理
  // 保留这些变量以兼容旧代码，但始终为空字符串
  const defaultSystemPrompt = ''
  const defaultPrompt = ''

  const normalizeWorkflowDataType = (value: unknown): WorkflowDataType => {
    switch (value) {
      case 'text':
      case 'image':
      case 'images':
      case 'video':
      case 'json':
      case 'any':
      case 'boolean':
      case 'number':
        return value
      default:
        return 'any'
    }
  }

  type PortLike = {
    id?: unknown
    label?: unknown
    dataType?: unknown
    required?: unknown
    multiple?: unknown
    description?: unknown
  }

  const portsToHandles = (ports: PortLike[]): NodeHandle[] =>
    ports
      .filter((p) => typeof p?.id === 'string' && typeof p?.label === 'string')
      .map((p) => ({
        id: p.id as string,
        label: p.label as string,
        dataType: normalizeWorkflowDataType(p.dataType),
        required: typeof p.required === 'boolean' ? p.required : false,
        multiple: typeof p.multiple === 'boolean' ? p.multiple : undefined,
        description: typeof p.description === 'string' ? p.description : undefined
      })) as NodeHandle[]

  const isModernDefinition = (value: unknown): value is { metadata: any; inputs: any[]; outputs: any[] } => {
    return !!value && typeof value === 'object' && 'metadata' in value && Array.isArray((value as any).inputs)
  }

  const baseLabel = isModernDefinition(def) ? def.metadata.label : (def as any)?.label
  const baseDescription = isModernDefinition(def) ? def.metadata.description : (def as any)?.description

  const baseInputs = isModernDefinition(def)
    ? portsToHandles(def.inputs)
    : ([...(def as any).defaultInputs] as NodeHandle[])
  const baseOutputs = isModernDefinition(def)
    ? portsToHandles(def.outputs)
    : ([...(def as any).defaultOutputs] as NodeHandle[])
  const defaultConfig = (isModernDefinition(def) ? (def as any).defaultConfig : (def as any)?.defaultConfig) ?? {}

  const config = {
    ...defaultConfig,
    ...overrideConfig,
    // 如果配置中没有提供 systemPrompt，使用预设
    systemPrompt: defaultConfig.systemPrompt || (overrideConfig as any)?.systemPrompt || defaultSystemPrompt,
    // 如果配置中没有提供 prompt，使用预设
    prompt: defaultConfig.prompt || (overrideConfig as any)?.prompt || defaultPrompt
  }

  // 优先使用 overrides 的 inputs/outputs；否则使用 definition 的默认值
  let inputs = overrideInputs ? [...overrideInputs] : [...baseInputs]
  const outputs = overrideOutputs ? [...overrideOutputs] : [...baseOutputs]

  // 合并静态输入端口和动态输入端口（用于动态图片输入）
  // 动态端口来自 config.imageInputPorts 或 config.imageInputCount
  if (!overrideInputs) {
    const imageInputPorts = (config as any)?.imageInputPorts as
      | Array<{
          id: string
          label: string
          dataType: unknown
          required?: boolean
          multiple?: boolean
          description?: string
        }>
      | undefined

    if (Array.isArray(imageInputPorts) && imageInputPorts.length > 0) {
      const dynamicInputs: NodeHandle[] = imageInputPorts.map((port) => ({
        id: port.id,
        label: port.label,
        dataType: normalizeWorkflowDataType(port.dataType),
        required: port.required ?? false,
        multiple: port.multiple,
        description: port.description
      }))

      const dynamicPortIds = new Set(dynamicInputs.map((p) => p.id))
      const filteredStaticInputs = inputs.filter((p) => !dynamicPortIds.has(p.id))
      inputs = [...dynamicInputs, ...filteredStaticInputs]
    } else if (typeof (config as any)?.imageInputCount === 'number' && (config as any).imageInputCount > 0) {
      const dynamicInputs: NodeHandle[] = Array.from({ length: (config as any).imageInputCount }, (_, index) => ({
        id: `image_${index + 1}`,
        label: `图片 ${index + 1}`,
        dataType: 'image',
        required: false
      }))

      const dynamicPortIds = new Set(dynamicInputs.map((p) => p.id))
      const filteredStaticInputs = inputs.filter((p) => !dynamicPortIds.has(p.id))
      inputs = [...dynamicInputs, ...filteredStaticInputs]
    }
  }

  return {
    label: baseLabel ?? String(type),
    nodeType: type,
    description: baseDescription,
    inputs,
    outputs,
    config,
    status: 'idle',
    ...restOverrides
  } as WorkflowNodeData
}

/**
 * 验证连接是否有效
 * 检查源节点输出端口的数据类型是否与目标节点输入端口兼容
 */
export function validateConnection(
  sourceNode: WorkflowNode,
  sourceHandleId: string,
  targetNode: WorkflowNode,
  targetHandleId: string
): boolean {
  const sourceHandle = sourceNode.data.outputs.find((h) => h.id === sourceHandleId)
  const targetHandle = targetNode.data.inputs.find((h) => h.id === targetHandleId)

  if (!sourceHandle || !targetHandle) return false

  // 'any' 类型可以连接任何类型
  if (sourceHandle.dataType === 'any' || targetHandle.dataType === 'any') return true

  // 'images' 可以连接到 'image'
  if (sourceHandle.dataType === 'images' && targetHandle.dataType === 'image') return true

  // 相同类型可以连接
  return sourceHandle.dataType === targetHandle.dataType
}

/**
 * 从节点和边构建执行顺序
 * 使用拓扑排序确保依赖关系
 */
export function buildExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // 初始化
  nodes.forEach((node) => {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  })

  // 构建图
  edges.forEach((edge) => {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // 拓扑排序（Kahn 算法）
  const queue: string[] = []
  const result: WorkflowNode[] = []

  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId)
  })

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (node) result.push(node)

    adjacency.get(nodeId)?.forEach((neighbor) => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    })
  }

  // 检查是否有环 - 必须 fail-fast
  if (result.length !== nodes.length) {
    // 找出形成环的节点
    const processedIds = new Set(result.map((n) => n.id))
    const cycleNodeIds = nodes.filter((n) => !processedIds.has(n.id)).map((n) => n.id)

    const errorMessage = `工作流存在循环依赖，涉及节点: ${cycleNodeIds.join(', ')}`
    logger.error(errorMessage, { cycleNodeIds, totalNodes: nodes.length, processedNodes: result.length })

    throw new Error(errorMessage)
  }

  return result
}

/**
 * 执行层级：同一层级的节点可以并行执行
 * level 0: 入度为 0 的节点（无依赖，可以立即并行执行）
 * level 1: 所有依赖都在 level 0 的节点
 * level n: 所有依赖都在 level 0...n-1 的节点
 */
export interface ExecutionLevel {
  level: number
  nodes: WorkflowNode[]
}

/**
 * 从节点和边构建执行层级
 * 同一层级的节点可以并行执行，不同层级按顺序执行
 *
 * @example
 * ```
 *     A         层级 0: [A]
 *    / \        层级 1: [B, C] (可并行)
 *   B   C       层级 2: [D]
 *    \ /
 *     D
 * ```
 */
export function buildExecutionLevels(nodes: WorkflowNode[], edges: WorkflowEdge[]): ExecutionLevel[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // 初始化
  nodes.forEach((node) => {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  })

  // 构建图
  edges.forEach((edge) => {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // 层级化拓扑排序
  const levels: ExecutionLevel[] = []
  let currentLevel: string[] = []
  let processedCount = 0

  // 收集入度为 0 的节点作为第一层
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) currentLevel.push(nodeId)
  })

  let levelIndex = 0
  while (currentLevel.length > 0) {
    // 当前层级的节点
    const levelNodes = currentLevel
      .map((id) => nodeMap.get(id))
      .filter((n): n is WorkflowNode => n !== undefined)

    levels.push({
      level: levelIndex,
      nodes: levelNodes
    })

    processedCount += levelNodes.length

    // 计算下一层级
    const nextLevel: string[] = []
    for (const nodeId of currentLevel) {
      const neighbors = adjacency.get(nodeId) || []
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          nextLevel.push(neighbor)
        }
      }
    }

    currentLevel = nextLevel
    levelIndex++
  }

  // 检查是否有环
  if (processedCount !== nodes.length) {
    const processedIds = new Set(levels.flatMap((l) => l.nodes.map((n) => n.id)))
    const cycleNodeIds = nodes.filter((n) => !processedIds.has(n.id)).map((n) => n.id)

    const errorMessage = `工作流存在循环依赖，涉及节点: ${cycleNodeIds.join(', ')}`
    logger.error(errorMessage, { cycleNodeIds, totalNodes: nodes.length, processedNodes: processedCount })

    throw new Error(errorMessage)
  }

  logger.debug('Execution levels built', {
    totalLevels: levels.length,
    levelSizes: levels.map((l) => l.nodes.length),
    parallelizable: levels.filter((l) => l.nodes.length > 1).length
  })

  return levels
}

/**
 * 获取节点的上游节点（通过边连接的源节点）
 */
export function getUpstreamNodes(nodeId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source)
  return nodes.filter((n) => upstreamIds.includes(n.id))
}

/**
 * 获取连接到特定输入端口的上游节点
 */
export function getUpstreamNodeForHandle(
  nodeId: string,
  handleId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode | undefined {
  const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handleId)
  if (!edge) return undefined
  return nodes.find((n) => n.id === edge.source)
}
