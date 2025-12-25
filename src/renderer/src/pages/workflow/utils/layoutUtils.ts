/**
 * 工作流节点布局工具
 * 提供自动布局和对齐功能
 */

import type { Edge, Node } from '@xyflow/react'

// 布局方向
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL'

// 对齐方式
export type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

// 布局选项
export interface LayoutOptions {
  direction?: LayoutDirection
  nodeSpacing?: number
  rankSpacing?: number
}

// 默认节点尺寸
const DEFAULT_NODE_WIDTH = 280
const DEFAULT_NODE_HEIGHT = 150

/**
 * 简单的层级布局算法
 * 基于拓扑排序，将节点按层级排列
 */
export function getLayeredLayout(nodes: Node[], edges: Edge[], options: LayoutOptions = {}): Node[] {
  const { direction = 'LR', nodeSpacing = 80, rankSpacing = 200 } = options

  if (nodes.length === 0) return nodes

  // 构建邻接表和入度表
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  nodes.forEach((node) => {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  })

  edges.forEach((edge) => {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // 拓扑排序，计算每个节点的层级
  const levels = new Map<string, number>()
  const queue: string[] = []

  // 找到所有入度为 0 的节点作为起点
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId)
      levels.set(nodeId, 0)
    }
  })

  // BFS 计算层级
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const currentLevel = levels.get(nodeId) || 0

    adjacency.get(nodeId)?.forEach((neighbor) => {
      const newInDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newInDegree)

      // 更新层级（取最大值以确保正确的层级）
      const existingLevel = levels.get(neighbor)
      if (existingLevel === undefined || currentLevel + 1 > existingLevel) {
        levels.set(neighbor, currentLevel + 1)
      }

      if (newInDegree === 0) {
        queue.push(neighbor)
      }
    })
  }

  // 处理没有连接的孤立节点
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0)
    }
  })

  // 按层级分组节点
  const levelGroups = new Map<number, string[]>()
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(nodeId)
  })

  // 计算新位置
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const newNodes: Node[] = []

  // 根据方向计算位置
  const isHorizontal = direction === 'LR' || direction === 'RL'
  const isReversed = direction === 'RL' || direction === 'BT'

  levelGroups.forEach((nodeIds, level) => {
    const adjustedLevel = isReversed ? levelGroups.size - 1 - level : level

    nodeIds.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId)
      if (!node) return

      let x: number, y: number

      if (isHorizontal) {
        x = adjustedLevel * (DEFAULT_NODE_WIDTH + rankSpacing)
        y = index * (DEFAULT_NODE_HEIGHT + nodeSpacing)
      } else {
        x = index * (DEFAULT_NODE_WIDTH + nodeSpacing)
        y = adjustedLevel * (DEFAULT_NODE_HEIGHT + rankSpacing)
      }

      newNodes.push({
        ...node,
        position: { x, y }
      })
    })
  })

  return newNodes
}

/**
 * 对齐选中的节点
 */
export function alignNodes(nodes: Node[], selectedNodeIds: string[], alignType: AlignType): Node[] {
  if (selectedNodeIds.length < 2) return nodes

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  if (selectedNodes.length < 2) return nodes

  // 计算边界
  const bounds = {
    minX: Math.min(...selectedNodes.map((n) => n.position.x)),
    maxX: Math.max(...selectedNodes.map((n) => n.position.x + DEFAULT_NODE_WIDTH)),
    minY: Math.min(...selectedNodes.map((n) => n.position.y)),
    maxY: Math.max(...selectedNodes.map((n) => n.position.y + DEFAULT_NODE_HEIGHT))
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return nodes.map((node) => {
    if (!selectedNodeIds.includes(node.id)) return node

    const newPosition = { ...node.position }

    switch (alignType) {
      case 'left':
        newPosition.x = bounds.minX
        break
      case 'center':
        newPosition.x = centerX - DEFAULT_NODE_WIDTH / 2
        break
      case 'right':
        newPosition.x = bounds.maxX - DEFAULT_NODE_WIDTH
        break
      case 'top':
        newPosition.y = bounds.minY
        break
      case 'middle':
        newPosition.y = centerY - DEFAULT_NODE_HEIGHT / 2
        break
      case 'bottom':
        newPosition.y = bounds.maxY - DEFAULT_NODE_HEIGHT
        break
    }

    return {
      ...node,
      position: newPosition
    }
  })
}

/**
 * 均匀分布选中的节点
 */
export function distributeNodes(
  nodes: Node[],
  selectedNodeIds: string[],
  direction: 'horizontal' | 'vertical'
): Node[] {
  if (selectedNodeIds.length < 3) return nodes

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  if (selectedNodes.length < 3) return nodes

  // 按位置排序
  const sortedNodes = [...selectedNodes].sort((a, b) => {
    if (direction === 'horizontal') {
      return a.position.x - b.position.x
    }
    return a.position.y - b.position.y
  })

  // 计算间距
  const first = sortedNodes[0]
  const last = sortedNodes[sortedNodes.length - 1]

  const totalSpace =
    direction === 'horizontal' ? last.position.x - first.position.x : last.position.y - first.position.y

  const spacing = totalSpace / (sortedNodes.length - 1)

  // 创建 ID 到新位置的映射
  const newPositions = new Map<string, { x: number; y: number }>()

  sortedNodes.forEach((node, index) => {
    const newPos = { ...node.position }
    if (direction === 'horizontal') {
      newPos.x = first.position.x + spacing * index
    } else {
      newPos.y = first.position.y + spacing * index
    }
    newPositions.set(node.id, newPos)
  })

  return nodes.map((node) => {
    const newPos = newPositions.get(node.id)
    if (!newPos) return node
    return {
      ...node,
      position: newPos
    }
  })
}
