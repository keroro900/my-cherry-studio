/**
 * ReactFlow 工作流画布组件
 * 基于官方文档 https://reactflow.dev/learn 实现
 * 支持拖放添加节点 https://reactflow.dev/examples/interaction/drag-and-drop
 */

import '@xyflow/react/dist/style.css'
import './ReactFlowStyles.css'

import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  redo,
  setEdges as setStoreEdges,
  setNodes as setStoreNodes,
  setSelectedNodeId,
  undo
} from '@renderer/store/workflow'
import { uuid } from '@renderer/utils'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useReactFlow
} from '@xyflow/react'
import { throttle } from 'lodash'
import type { DragEvent } from 'react'
import { memo,useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useClipboard } from '../../hooks/useClipboard'
import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { WorkflowNodeType } from '../../types'
import { createNodeData, type NodeDefinition } from '../../types'
import { isValidConnection as validateConnection } from '../../utils/connectionValidation'
import CanvasContextMenu from '../ContextMenu/CanvasContextMenu'
import NodeContextMenu from '../ContextMenu/NodeContextMenu'
// Cherry Studio 风格工作流节点
import CherryWorkflowNode from '../Nodes/CherryWorkflowNode'
// 自定义边组件
import DataTypeEdge from './DataTypeEdge'
import { EdgeGradientDefs } from './EdgeGradientDefs'

const logger = loggerService.withContext('WorkflowCanvas')

// 根据节点类别获取 ReactFlow 节点类型（保持兼容性）
function getReactFlowType(_category: NodeDefinition['category'] | string): string {
  // 所有节点统一使用 CherryWorkflowNode
  return 'cherry'
}

// 辅助函数：获取节点定义的 category（兼容新旧格式）
function getNodeCategory(nodeDef: any): NodeDefinition['category'] {
  // 新格式: { metadata: { category } }
  if (nodeDef.metadata?.category) {
    return nodeDef.metadata.category
  }
  // 旧格式: { category }
  return nodeDef.category
}

/**
 * 工作流画布内部组件
 */
const WorkflowCanvasInner = memo(function WorkflowCanvasInner() {
  const dispatch = useAppDispatch()
  const { fitView, screenToFlowPosition } = useReactFlow()

  // 注册节点类型 - 使用 useMemo 确保稳定引用（修复 React Flow 警告 #002）
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      cherry: CherryWorkflowNode,
      // 兼容旧节点类型（全部映射到 CherryWorkflowNode）
      turbo: CherryWorkflowNode,
      textInput: CherryWorkflowNode,
      imageInput: CherryWorkflowNode,
      ai: CherryWorkflowNode,
      image: CherryWorkflowNode,
      video: CherryWorkflowNode,
      output: CherryWorkflowNode
    }),
    []
  )

  // 注册边类型 - 使用 useMemo 确保稳定引用
  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      dataType: DataTypeEdge
    }),
    []
  )

  // 默认边选项 - 使用 useMemo 确保稳定引用
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      type: 'dataType', // 使用自定义数据类型边
      // 启用边重连 - 允许拖动边的端点来断开或重新连接
      reconnectable: true,
      style: {
        strokeWidth: 3
      }
    }),
    []
  )

  // 剪贴板功能
  const clipboard = useClipboard()

  // 从 Redux 获取状态
  const storeNodes = useAppSelector((state) => state.workflow.nodes) || []
  const storeEdges = useAppSelector((state) => state.workflow.edges) || []

  // 本地状态（按照官方文档使用 useState）
  // 确保节点有正确的初始化状态，避免 "node not initialized" 警告
  // 关键：必须设置 measured 属性为 undefined，让 React Flow 自动测量
  const [nodes, setNodes] = useState<Node[]>(() =>
    storeNodes.map((n) => ({
      id: n.id,
      type: n.type || 'cherry',
      position: n.position || { x: 0, y: 0 },
      data: n.data,
      draggable: true,
      selectable: true,
      // 显式设置这些属性，确保节点正确初始化
      width: undefined,
      height: undefined,
      measured: undefined
    }))
  )
  const [edges, setEdges] = useState<Edge[]>(() =>
    storeEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: 'dataType'
    }))
  )

  // 连接状态（用于实时连线预览）
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null)
  const [connectingHandleId, setConnectingHandleId] = useState<string | null>(null)
  const [connectingHandleType, setConnectingHandleType] = useState<'source' | 'target' | null>(null)
  // 是否正在连线（用于 Esc 取消）
  const isConnectingRef = useRef(false)

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    type: 'node' | 'canvas'
    x: number
    y: number
    node?: Node
  } | null>(null)

  // 同步 Redux store 到本地状态
  // 使用 ref 跟踪是否正在拖动，避免拖动时的状态冲突
  const isDraggingRef = useRef(false)
  const prevStoreRef = useRef({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })

  useEffect(() => {
    // 如果正在拖动，不要从 Redux 同步（避免位置跳转）
    if (isDraggingRef.current) return

    // 只在节点数量变化或新增/删除节点时同步
    const currentNodeIds = new Set(storeNodes.map((n) => n.id))
    const prevNodeIds = prevStoreRef.current.nodeIds

    // 检查是否有新增或删除的节点
    const hasNewNodes = storeNodes.some((n) => !prevNodeIds.has(n.id))
    const hasRemovedNodes = [...prevNodeIds].some((id) => !currentNodeIds.has(id))

    if (hasNewNodes || hasRemovedNodes) {
      prevStoreRef.current.nodeIds = currentNodeIds
      setNodes(
        storeNodes.map((n) => ({
          id: n.id,
          type: n.type || 'cherry',
          position: n.position || { x: 0, y: 0 },
          data: n.data,
          draggable: true,
          selectable: true,
          // 保留节点尺寸（如果有）
          ...(n.width !== undefined && { width: n.width }),
          ...(n.height !== undefined && { height: n.height })
        }))
      )
    } else {
      // 只更新节点数据（不更新位置），避免拖动时的位置跳转
      setNodes((prev) =>
        prev.map((node) => {
          const storeNode = storeNodes.find((n) => n.id === node.id)
          if (storeNode && storeNode.data !== node.data) {
            return { ...node, data: storeNode.data }
          }
          return node
        })
      )
    }
  }, [storeNodes])

  useEffect(() => {
    const currentEdgeIds = new Set(storeEdges.map((e) => e.id))
    const prevEdgeIds = prevStoreRef.current.edgeIds

    const hasNewEdges = storeEdges.some((e) => !prevEdgeIds.has(e.id))
    const hasRemovedEdges = [...prevEdgeIds].some((id) => !currentEdgeIds.has(id))

    if (hasNewEdges || hasRemovedEdges) {
      prevStoreRef.current.edgeIds = currentEdgeIds
      setEdges(
        storeEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle
        }))
      )
    }
  }, [storeEdges])

  // 同步本地状态到 Redux（防抖，150ms 延迟减少频繁更新）
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncToStore = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      syncTimeoutRef.current = setTimeout(() => {
        dispatch(
          setStoreNodes(
            newNodes.map((n) => ({
              id: n.id,
              type: n.type || 'cherry',
              position: { x: n.position.x, y: n.position.y },
              // 保存节点尺寸（NodeResizer 调整后的尺寸）
              ...(n.width !== undefined && { width: n.width }),
              ...(n.height !== undefined && { height: n.height }),
              data: n.data as any
            }))
          )
        )
        dispatch(
          setStoreEdges(
            newEdges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined
            }))
          )
        )
      }, 150) // 增加到 150ms，进一步减少 Redux 更新频率
    },
    [dispatch]
  )

  // 节点变化处理（官方推荐方式）- 使用 lodash throttle 优化拖动性能
  const onNodesChangeRaw = useCallback(
    (changes: any[]) => {
      // 检测拖动状态
      const isDragging = changes.some((change) => change.type === 'position' && change.dragging)
      const dragEnded = changes.some((change) => change.type === 'position' && change.dragging === false)

      if (isDragging) {
        isDraggingRef.current = true
      }
      if (dragEnded) {
        isDraggingRef.current = false
      }

      setNodes((nds) => {
        const newNodes = applyNodeChanges(changes, nds)
        // 只在拖动结束时同步到 Redux，减少不必要的更新
        if (!isDragging || dragEnded) {
          syncToStore(newNodes, edges)
        }
        return newNodes
      })
    },
    [edges, syncToStore]
  )

  // 使用 lodash throttle 节流位置变化（16ms = 60fps）

  const onNodesChangeThrottled = useMemo(
    () => throttle(onNodesChangeRaw, 16, { leading: true, trailing: true }),
    [onNodesChangeRaw]
  )

  // 清理节流函数
  useEffect(() => {
    return () => {
      onNodesChangeThrottled.cancel()
    }
  }, [onNodesChangeThrottled])

  // 最终的节点变化处理器
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // 检查是否只有位置变化（拖动中）
      const onlyPositionChanges = changes.every((c) => c.type === 'position' && c.dragging === true)

      if (onlyPositionChanges) {
        // 拖动中使用节流
        onNodesChangeThrottled(changes)
      } else {
        // 其他变化（选择、删除、拖动结束）立即处理
        onNodesChangeRaw(changes)
      }
    },
    [onNodesChangeRaw, onNodesChangeThrottled]
  )

  // 边变化处理（官方推荐方式）
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const newEdges = applyEdgeChanges(changes, eds)
        syncToStore(nodes, newEdges)
        return newEdges
      })
    },
    [nodes, syncToStore]
  )

  // 连接处理（官方推荐方式）
  // 支持：拖新线到已连接端口时自动替换旧连线
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        // 检查目标端口是否已有连接，如果有则先删除旧连接
        const existingEdgeIndex = eds.findIndex(
          (e) => e.target === connection.target && e.targetHandle === connection.targetHandle
        )

        let filteredEdges = eds
        if (existingEdgeIndex !== -1) {
          // 删除旧连接，实现"替换"效果
          filteredEdges = eds.filter((_, index) => index !== existingEdgeIndex)
        }

        const newEdges = addEdge(connection, filteredEdges)
        syncToStore(nodes, newEdges)
        return newEdges
      })
    },
    [nodes, syncToStore]
  )

  // 连接开始 - 实时预览 + 从输入端口拖动断开连线
  // 参考 ComfyUI：从已连接的输入端口拖动时，先断开现有连接
  const onConnectStart: OnConnectStart = useCallback(
    (_event, { nodeId, handleId, handleType }) => {
      setConnectingNodeId(nodeId)
      setConnectingHandleId(handleId)
      setConnectingHandleType(handleType)
      isConnectingRef.current = true

      // 如果从输入端口（target）开始拖动，检查是否已有连接
      // 如果有，断开现有连接（实现"拔线"效果）
      if (handleType === 'target' && nodeId && handleId) {
        setEdges((eds) => {
          const connectedEdge = eds.find((e) => e.target === nodeId && e.targetHandle === handleId)
          if (connectedEdge) {
            // 找到已连接的边，删除它
            const newEdges = eds.filter((e) => e.id !== connectedEdge.id)
            syncToStore(nodes, newEdges)
            return newEdges
          }
          return eds
        })
      }
    },
    [nodes, syncToStore]
  )

  // 连接结束 - 清除预览状态
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    setConnectingNodeId(null)
    setConnectingHandleId(null)
    setConnectingHandleType(null)
    isConnectingRef.current = false
  }, [])

  // 边重连处理 - 支持拖走线自动断开并重新连接
  // 参考 ComfyUI 的连线机制
  const edgeReconnectSuccessful = useRef(true)

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false
  }, [])

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      edgeReconnectSuccessful.current = true
      setEdges((eds) => {
        // 检查新目标端口是否已有连接，如果有则先删除
        const existingEdgeIndex = eds.findIndex(
          (e) =>
            e.id !== oldEdge.id && e.target === newConnection.target && e.targetHandle === newConnection.targetHandle
        )

        let filteredEdges = eds
        if (existingEdgeIndex !== -1) {
          filteredEdges = eds.filter((_, index) => index !== existingEdgeIndex)
        }

        const newEdges = reconnectEdge(oldEdge, newConnection, filteredEdges)
        syncToStore(nodes, newEdges)
        return newEdges
      })
    },
    [nodes, syncToStore]
  )

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        // 拖到空白处，删除边（实现"拖走断开"效果）
        setEdges((eds) => {
          const newEdges = eds.filter((e) => e.id !== edge.id)
          syncToStore(nodes, newEdges)
          return newEdges
        })
      }
      edgeReconnectSuccessful.current = true
    },
    [nodes, syncToStore]
  )

  // 节点点击
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      dispatch(setSelectedNodeId(node.id))
    },
    [dispatch]
  )

  // 节点右键菜单
  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault()
    setContextMenu({
      type: 'node',
      x: event.clientX,
      y: event.clientY,
      node
    })
  }, [])

  // 画布右键菜单
  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      type: 'canvas',
      x: event.clientX,
      y: event.clientY
    })
  }, [])

  // 画布点击（关闭菜单 & 取消选择）
  const onPaneClick = useCallback(() => {
    setContextMenu(null)
    dispatch(setSelectedNodeId(null))
  }, [dispatch])

  // 删除节点
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        // 检查节点是否存在，避免重复删除
        if (!nds.some((n) => n.id === nodeId)) {
          logger.debug('Node already deleted, skipping:', nodeId)
          return nds
        }

        const newNodes = nds.filter((n) => n.id !== nodeId)
        // 同时删除相关的边
        setEdges((eds) => {
          const newEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
          syncToStore(newNodes, newEdges)
          return newEdges
        })
        return newNodes
      })
      // 注意：syncToStore 已通过 setStoreNodes 更新 Redux，无需再调用 removeNode
      // 清除选中状态（如果删除的是当前选中的节点）
      dispatch(setSelectedNodeId(null))
    },
    [dispatch, syncToStore]
  )

  // 复制节点
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const newNode: Node = {
        id: `node-${uuid()}`,
        type: node.type,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50
        },
        data: {
          ...node.data,
          label: `${node.data.label} (复制)`
        }
      }

      setNodes((nds) => {
        const newNodes = [...nds, newNode]
        syncToStore(newNodes, edges)
        return newNodes
      })
    },
    [nodes, edges, syncToStore]
  )

  // 复制选中的节点 (Ctrl+C)
  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length > 0) {
      clipboard.copy(selectedNodes, edges)
    }
  }, [nodes, edges, clipboard])

  // 粘贴节点 (Ctrl+V)
  const handlePaste = useCallback(() => {
    const pastedData = clipboard.paste()
    if (!pastedData) return

    setNodes((nds) => {
      // 先取消所有节点的选中状态
      const deselectedNodes = nds.map((n) => ({ ...n, selected: false }))
      const newNodes = [...deselectedNodes, ...pastedData.nodes]
      setEdges((eds) => {
        const newEdges = [...eds, ...pastedData.edges]
        syncToStore(newNodes, newEdges)
        return newEdges
      })
      return newNodes
    })
  }, [clipboard, syncToStore])

  // 剪切选中的节点 (Ctrl+X)
  const handleCut = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length === 0) return

    clipboard.cut(selectedNodes, edges)

    // 删除选中的节点和相关的边
    const selectedIds = new Set(selectedNodes.map((n) => n.id))
    setNodes((nds) => {
      const newNodes = nds.filter((n) => !selectedIds.has(n.id))
      setEdges((eds) => {
        const newEdges = eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target))
        syncToStore(newNodes, newEdges)
        return newEdges
      })
      return newNodes
    })

    // 注意：syncToStore 已通过 setStoreNodes 更新 Redux，无需再调用 removeNode
    dispatch(setSelectedNodeId(null))
  }, [nodes, edges, clipboard, syncToStore, dispatch])

  // 撤销 (Ctrl+Z)
  const handleUndo = useCallback(() => {
    dispatch(undo())
  }, [dispatch])

  // 重做 (Ctrl+Shift+Z / Ctrl+Y)
  const handleRedo = useCallback(() => {
    dispatch(redo())
  }, [dispatch])

  // 添加节点
  const handleAddNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      const nodeType = type as WorkflowNodeType
      // 使用适配器获取节点定义
      const nodeDef = NodeRegistryAdapter.getNodeDefinition(nodeType)
      if (!nodeDef) return

      const flowPosition = screenToFlowPosition(position)
      const nodeData = createNodeData(nodeType)
      const reactFlowType = getReactFlowType(getNodeCategory(nodeDef))

      const newNode: Node = {
        id: `node-${uuid()}`,
        type: reactFlowType,
        position: flowPosition,
        data: nodeData as any
      }

      // 只更新本地状态，syncToStore 会自动同步到 Redux
      setNodes((nds) => {
        const newNodes = [...nds, newNode]
        syncToStore(newNodes, edges)
        return newNodes
      })
    },
    [edges, screenToFlowPosition, syncToStore]
  )

  // 全选
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
  }, [])

  // 适应视图
  const handleFitView = useCallback(
    (_event?: any) => {
      fitView({ padding: 0.2, duration: 300 })
    },
    [fitView]
  )

  // 拖放处理 - 从 NodePanel 拖入节点
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()

      const dataStr = event.dataTransfer.getData('application/reactflow')
      if (!dataStr) return

      try {
        const dropData = JSON.parse(dataStr)
        const nodeType = dropData.type as WorkflowNodeType
        // 使用适配器获取节点定义
        const nodeDef = NodeRegistryAdapter.getNodeDefinition(nodeType)
        if (!nodeDef) return

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        })

        const nodeData = createNodeData(nodeType)
        const reactFlowType = getReactFlowType(getNodeCategory(nodeDef))

        const newNode: Node = {
          id: `node-${uuid()}`,
          type: reactFlowType,
          position,
          data: nodeData as any
        }

        // 只更新本地状态，syncToStore 会自动同步到 Redux
        setNodes((nds) => {
          const newNodes = [...nds, newNode]
          syncToStore(newNodes, edges)
          return newNodes
        })
      } catch (err) {
        logger.error('Failed to parse dropped node data:', err as Error)
      }
    },
    [edges, screenToFlowPosition, syncToStore]
  )

  // 使用 ref 存储最新的回调函数，避免频繁重新注册事件监听器
  const callbacksRef = useRef({
    handleDeleteNode,
    handleSelectAll,
    handleDuplicateNode,
    handleCopy,
    handlePaste,
    handleCut,
    handleUndo,
    handleRedo,
    syncToStore,
    dispatch,
    setNodes,
    setEdges
  })

  // 更新 ref 中的回调函数
  useEffect(() => {
    callbacksRef.current = {
      handleDeleteNode,
      handleSelectAll,
      handleDuplicateNode,
      handleCopy,
      handlePaste,
      handleCut,
      handleUndo,
      handleRedo,
      syncToStore,
      dispatch,
      setNodes,
      setEdges
    }
  })

  // 使用 ref 存储最新的 nodes 和 edges
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [nodes, edges])

  // 键盘快捷键 - 只注册一次
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果焦点在输入框内，不处理快捷键
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const {
        handleDeleteNode,
        handleSelectAll,
        handleDuplicateNode,
        handleCopy,
        handlePaste,
        handleCut,
        handleUndo,
        handleRedo,
        syncToStore,
        dispatch,
        setNodes,
        setEdges
      } = callbacksRef.current
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current

      // Delete 删除选中节点和边
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 删除选中的节点
        const selectedNodes = currentNodes.filter((n) => n.selected)
        selectedNodes.forEach((n) => handleDeleteNode(n.id))

        // 删除选中的边
        const selectedEdges = currentEdges.filter((e) => e.selected)
        if (selectedEdges.length > 0) {
          setEdges((eds) => {
            const newEdges = eds.filter((e) => !e.selected)
            syncToStore(
              currentNodes.filter((n) => !n.selected),
              newEdges
            )
            return newEdges
          })
        }
      }

      // Ctrl+A 全选
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault()
        handleSelectAll()
      }

      // Ctrl+D 复制选中节点 (原地复制)
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault()
        const selectedNodes = currentNodes.filter((n) => n.selected)
        selectedNodes.forEach((n) => handleDuplicateNode(n.id))
      }

      // Ctrl+C 复制
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault()
        handleCopy()
      }

      // Ctrl+V 粘贴
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault()
        handlePaste()
      }

      // Ctrl+X 剪切
      if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
        event.preventDefault()
        handleCut()
      }

      // Ctrl+Z 撤销
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      }

      // Ctrl+Shift+Z 或 Ctrl+Y 重做
      if ((event.ctrlKey || event.metaKey) && ((event.key === 'z' && event.shiftKey) || event.key === 'y')) {
        event.preventDefault()
        handleRedo()
      }

      // Escape 取消拖线或取消选择
      if (event.key === 'Escape') {
        // 如果正在拖线，模拟鼠标释放来取消连线
        // React Flow 会自动处理连线取消
        if (isConnectingRef.current) {
          // 触发一个 mouseup 事件来取消连线
          const mouseUpEvent = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window
          })
          document.dispatchEvent(mouseUpEvent)
          isConnectingRef.current = false
          return
        }
        // 否则取消选择
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
        dispatch(setSelectedNodeId(null))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // 空依赖数组，只注册一次

  // 动态注入连接预览样式 - 使用 requestAnimationFrame 优化 DOM 操作
  useEffect(() => {
    if (!connectingNodeId || !connectingHandleId || !connectingHandleType) {
      // 移除所有高亮样式
      requestAnimationFrame(() => {
        document.querySelectorAll('.react-flow__handle').forEach((el) => {
          el.classList.remove('handle-compatible', 'handle-incompatible')
        })
      })
      return
    }

    // 找到正在连接的节点
    const connectingNode = nodes.find((n) => n.id === connectingNodeId)
    if (!connectingNode) return

    // 使用 RAF 批量更新 DOM
    requestAnimationFrame(() => {
      // 检查每个 handle 的兼容性
      document.querySelectorAll('.react-flow__handle').forEach((el) => {
        const handleEl = el as HTMLElement
        const handleNodeId = handleEl.getAttribute('data-nodeid')
        const handleId = handleEl.getAttribute('data-handleid')
        const handleType = handleEl.getAttribute('data-handlepos')

        // 先移除旧的样式类
        handleEl.classList.remove('handle-compatible', 'handle-incompatible')

        if (!handleNodeId || !handleId) return

        // 自己连自己 - 不兼容
        if (handleNodeId === connectingNodeId) {
          handleEl.classList.add('handle-incompatible')
          return
        }

        // 同类型 handle - 不兼容（source 不能连 source）
        if (connectingHandleType === 'source' && handleType === 'right') {
          handleEl.classList.add('handle-incompatible')
          return
        }
        if (connectingHandleType === 'target' && handleType === 'left') {
          handleEl.classList.add('handle-incompatible')
          return
        }

        // 检查连接验证
        const connection: Connection =
          connectingHandleType === 'source'
            ? {
                source: connectingNodeId,
                target: handleNodeId,
                sourceHandle: connectingHandleId,
                targetHandle: handleId
              }
            : {
                source: handleNodeId,
                target: connectingNodeId,
                sourceHandle: handleId,
                targetHandle: connectingHandleId
              }

        const isValid = validateConnection(connection, nodes, edges)
        if (isValid) {
          handleEl.classList.add('handle-compatible')
        } else {
          handleEl.classList.add('handle-incompatible')
        }
      })
    })
  }, [connectingNodeId, connectingHandleId, connectingHandleType, nodes, edges])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        isValidConnection={(c) =>
          validateConnection(
            {
              source: c.source!,
              target: c.target!,
              sourceHandle: (c as any).sourceHandle ?? null,
              targetHandle: (c as any).targetHandle ?? null
            },
            nodes,
            edges
          )
        }
        // 边重连功能 - 支持拖走线断开、拖到新端口重连
        // 悬停在边的端点附近（20px 范围内）可以拖动重连
        edgesReconnectable={true}
        reconnectRadius={20}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        // 边可选中
        edgesFocusable={true}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null} // 我们自己处理删除
        multiSelectionKeyCode={['Meta', 'Control']}
        selectionOnDrag
        panOnDrag={[1, 2]} // 左键和中键拖拽画布
        selectNodesOnDrag={false}
        connectionLineStyle={{
          stroke: '#faad14', // 橙色，拖动时非常醒目
          strokeWidth: 3,
          strokeDasharray: '8 4'
        }}>
        {/* 🎨 Turbo Flow Edge 渐变定义 */}
        <EdgeGradientDefs />

        {/* 双层背景 - 小点 + 大网格 */}
        <Background id="dots" variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Background id="lines" variant={BackgroundVariant.Lines} gap={100} lineWidth={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as any)?.status
            switch (status) {
              case 'running':
                return '#1890ff'
              case 'completed':
                return '#52c41a'
              case 'error':
                return '#ff4d4f'
              default:
                return '#d9d9d9'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* 右键菜单 */}
      {contextMenu?.type === 'node' && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node!}
          onClose={() => setContextMenu(null)}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
          onCopy={(id) => {
            const node = nodes.find((n) => n.id === id)
            if (node) {
              clipboard.copy([node], edges)
            }
          }}
          onCut={(id) => {
            const node = nodes.find((n) => n.id === id)
            if (node) {
              clipboard.cut([node], edges)
              handleDeleteNode(id)
            }
          }}
        />
      )}

      {contextMenu?.type === 'canvas' && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddNode={handleAddNode}
          onPaste={handlePaste}
          canPaste={clipboard.hasData()}
          onSelectAll={handleSelectAll}
          onFitView={handleFitView}
        />
      )}
    </div>
  )
})

/**
 * 工作流画布组件（带 Provider）
 */
export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  )
}
