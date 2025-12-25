/**
 * 连接校验工具
 *
 * 关键点：
 * - 基于节点 `data.inputs/outputs[].dataType` 动态校验（支持动态 handles）
 * - 参考：https://reactflow.dev/examples/interaction/validation
 */

import type { Connection, Edge, Node } from '@xyflow/react'

export type WorkflowPortType = 'text' | 'image' | 'images' | 'video' | 'json' | 'any'

type NodeHandleLike = { id: string; dataType?: unknown }

function normalizePortType(value: unknown): WorkflowPortType {
  switch (value) {
    case 'text':
    case 'image':
    case 'images':
    case 'video':
    case 'json':
    case 'any':
      return value
    default:
      return 'any'
  }
}

export function areTypesCompatible(sourceType: WorkflowPortType, targetType: WorkflowPortType): boolean {
  if (sourceType === 'any' || targetType === 'any') return true
  if (sourceType === targetType) return true
  // 兼容：图集 -> 单图（运行时会取第一张/最后一张，取决于节点实现）
  if (sourceType === 'images' && targetType === 'image') return true
  return false
}

function getHandleTypeFromNode(
  node: Node,
  kind: 'inputs' | 'outputs',
  handleId: string | null | undefined
): WorkflowPortType | null {
  const handles = (node.data as any)?.[kind] as NodeHandleLike[] | undefined

  if (!Array.isArray(handles) || handles.length === 0) {
    // 节点未提供 handles schema：谨慎起见只允许“无 handleId 的单端口”场景
    return handleId ? null : 'any'
  }

  // 兼容旧边：某些场景下 edge 没带 handleId，但节点只有一个端口
  if (!handleId) {
    if (handles.length === 1) return normalizePortType(handles[0].dataType)
    // 多端口节点必须携带 handleId，否则无法确定连接语义
    return null
  }

  const handle = handles.find((h) => h.id === handleId)
  if (!handle) return null

  return normalizePortType(handle.dataType)
}

/**
 * 验证连接是否有效
 */
export function isValidConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
  options?: { allowReplace?: boolean }
): boolean {
  const { allowReplace = true } = options || {}

  if (!connection.source || !connection.target) return false
  if (connection.source === connection.target) return false

  const sourceNode = nodes.find((n) => n.id === connection.source)
  const targetNode = nodes.find((n) => n.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = getHandleTypeFromNode(sourceNode, 'outputs', connection.sourceHandle)
  const targetType = getHandleTypeFromNode(targetNode, 'inputs', connection.targetHandle)
  if (!sourceType || !targetType) return false

  if (!areTypesCompatible(sourceType, targetType)) return false

  const isDuplicate = edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  )
  if (isDuplicate) return false

  if (!allowReplace) {
    const targetHasConnection = edges.some(
      (edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle
    )
    if (targetHasConnection) return false
  }

  return true
}
