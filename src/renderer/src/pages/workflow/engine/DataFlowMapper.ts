/**
 * 数据流预编译映射器
 *
 * 将边列表预编译为高效查询结构，避免运行时重复 filter
 * 用于优化 WorkflowEngine.collectInputs 的性能
 */

import type { WorkflowEdge } from '../types'

/**
 * 数据流映射器
 * 提供 O(1) 复杂度的边查询
 */
export class DataFlowMapper {
  // nodeId → 连接到该节点的所有边
  private incomingEdgesMap: Map<string, WorkflowEdge[]>

  // "nodeId:handleId" → 连接到该端口的边
  private handleEdgesMap: Map<string, WorkflowEdge[]>

  // nodeId → 没有指定 targetHandle 的边
  private noHandleEdgesMap: Map<string, WorkflowEdge[]>

  // 边总数（用于调试）
  private edgeCount: number

  constructor(edges: WorkflowEdge[]) {
    this.incomingEdgesMap = new Map()
    this.handleEdgesMap = new Map()
    this.noHandleEdgesMap = new Map()
    this.edgeCount = 0
    this.compile(edges)
  }

  /**
   * 预编译边映射
   * 时间复杂度: O(E)，其中 E 是边的数量
   *
   * @param edges 边列表
   */
  compile(edges: WorkflowEdge[]): void {
    // 清空现有映射
    this.incomingEdgesMap.clear()
    this.handleEdgesMap.clear()
    this.noHandleEdgesMap.clear()
    this.edgeCount = edges.length

    for (const edge of edges) {
      const targetNodeId = edge.target

      // 1. 更新 incomingEdgesMap
      if (!this.incomingEdgesMap.has(targetNodeId)) {
        this.incomingEdgesMap.set(targetNodeId, [])
      }
      this.incomingEdgesMap.get(targetNodeId)!.push(edge)

      // 2. 更新 handleEdgesMap 或 noHandleEdgesMap
      if (edge.targetHandle) {
        const key = this.makeHandleKey(targetNodeId, edge.targetHandle)
        if (!this.handleEdgesMap.has(key)) {
          this.handleEdgesMap.set(key, [])
        }
        this.handleEdgesMap.get(key)!.push(edge)
      } else {
        // 没有 targetHandle 的边
        if (!this.noHandleEdgesMap.has(targetNodeId)) {
          this.noHandleEdgesMap.set(targetNodeId, [])
        }
        this.noHandleEdgesMap.get(targetNodeId)!.push(edge)
      }
    }
  }

  /**
   * O(1) 查询连接到指定节点的所有边
   *
   * @param nodeId 目标节点 ID
   * @returns 连接到该节点的边数组（空数组如果没有）
   */
  getIncomingEdges(nodeId: string): WorkflowEdge[] {
    return this.incomingEdgesMap.get(nodeId) || []
  }

  /**
   * O(1) 查询连接到指定端口的边
   *
   * @param nodeId 目标节点 ID
   * @param handleId 目标端口 ID
   * @returns 连接到该端口的边数组（空数组如果没有）
   */
  getEdgesForHandle(nodeId: string, handleId: string): WorkflowEdge[] {
    const key = this.makeHandleKey(nodeId, handleId)
    return this.handleEdgesMap.get(key) || []
  }

  /**
   * O(1) 查询没有指定 targetHandle 的边
   *
   * @param nodeId 目标节点 ID
   * @returns 没有指定 targetHandle 的边数组
   */
  getNoHandleEdges(nodeId: string): WorkflowEdge[] {
    return this.noHandleEdgesMap.get(nodeId) || []
  }

  /**
   * 检查节点是否有任何传入边
   *
   * @param nodeId 目标节点 ID
   * @returns 是否有传入边
   */
  hasIncomingEdges(nodeId: string): boolean {
    return this.incomingEdgesMap.has(nodeId)
  }

  /**
   * 检查端口是否有连接
   *
   * @param nodeId 目标节点 ID
   * @param handleId 目标端口 ID
   * @returns 是否有连接
   */
  hasConnectionToHandle(nodeId: string, handleId: string): boolean {
    const key = this.makeHandleKey(nodeId, handleId)
    return this.handleEdgesMap.has(key)
  }

  /**
   * 获取统计信息（用于调试）
   */
  getStats(): {
    totalEdges: number
    nodesWithIncoming: number
    handlesWithConnections: number
    nodesWithNoHandleEdges: number
  } {
    return {
      totalEdges: this.edgeCount,
      nodesWithIncoming: this.incomingEdgesMap.size,
      handlesWithConnections: this.handleEdgesMap.size,
      nodesWithNoHandleEdges: this.noHandleEdgesMap.size
    }
  }

  /**
   * 生成 handle 键
   */
  private makeHandleKey(nodeId: string, handleId: string): string {
    return `${nodeId}:${handleId}`
  }
}
