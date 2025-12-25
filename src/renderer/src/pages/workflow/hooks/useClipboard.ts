/**
 * 工作流剪贴板 Hook
 * 实现复制/粘贴功能
 */

import { uuid } from '@renderer/utils'
import type { Edge, Node } from '@xyflow/react'
import { useCallback, useRef } from 'react'

interface ClipboardData {
  nodes: Node[]
  edges: Edge[]
}

interface UseClipboardReturn {
  copy: (nodes: Node[], edges: Edge[]) => void
  paste: (offsetX?: number, offsetY?: number) => ClipboardData | null
  cut: (nodes: Node[], edges: Edge[]) => void
  hasData: () => boolean
}

export function useClipboard(): UseClipboardReturn {
  const clipboardRef = useRef<ClipboardData | null>(null)

  const copy = useCallback((nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) return

    // 只复制选中的节点和它们之间的边
    const nodeIds = new Set(nodes.map((n) => n.id))
    const relevantEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(relevantEdges))
    }
  }, [])

  const paste = useCallback((offsetX = 50, offsetY = 50): ClipboardData | null => {
    if (!clipboardRef.current) return null

    const { nodes, edges } = clipboardRef.current

    // 创建 ID 映射（旧 ID -> 新 ID）
    const idMap = new Map<string, string>()

    // 复制节点并分配新 ID
    const newNodes = nodes.map((node) => {
      const newId = `node-${uuid()}`
      idMap.set(node.id, newId)

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        },
        selected: true,
        data: {
          ...node.data,
          label: `${node.data.label} (复制)`
        }
      }
    })

    // 复制边并更新节点引用
    const newEdges = edges.map((edge) => ({
      ...edge,
      id: `edge-${uuid()}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
      selected: false
    }))

    return { nodes: newNodes, edges: newEdges }
  }, [])

  const cut = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      copy(nodes, edges)
    },
    [copy]
  )

  const hasData = useCallback(() => {
    return clipboardRef.current !== null && clipboardRef.current.nodes.length > 0
  }, [])

  return {
    copy,
    paste,
    cut,
    hasData
  }
}
