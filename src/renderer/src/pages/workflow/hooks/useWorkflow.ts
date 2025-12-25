/**
 * 工作流相关 Hooks
 * Cherry Studio 本土化版本
 *
 * P0 优化：统一使用 workflowExecutionService 执行工作流
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  finishExecution,
  setNodeResult,
  startExecution,
  updateExecutionProgress,
  updateNodeStatus
} from '@renderer/store/workflow'
import type { Provider } from '@renderer/types'
import { useCallback, useState } from 'react'

import { workflowExecutionService } from '../services/WorkflowExecutionService'
import type { Workflow } from '../types'

/**
 * 工作流操作 Hook
 */
export function useWorkflow() {
  const dispatch = useAppDispatch()
  const workflowState = useAppSelector((state) => state.workflow)

  // 从 llm store 获取 providers
  const llmProviders = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]
  const defaultModel = useAppSelector((state) => state.llm?.defaultModel)

  // 执行状态 - 使用 any 类型以兼容不同的上下文结构
  const [executionContext, setExecutionContext] = useState<any>(null)

  /**
   * 同步 Providers 到工作流引擎
   * P0 优化：使用统一服务管理 Providers
   */
  const syncProviders = useCallback(() => {
    if (llmProviders && Array.isArray(llmProviders)) {
      workflowExecutionService.setProviders(llmProviders)
    }
    if (defaultModel) {
      workflowExecutionService.setDefaultModel(defaultModel)
    }
  }, [llmProviders, defaultModel])

  /**
   * 执行工作流
   * P0 优化：使用统一的 workflowExecutionService.execute() 入口
   */
  const executeWorkflow = useCallback(async () => {
    const { currentWorkflow, nodes, edges } = workflowState

    if (!currentWorkflow && nodes.length === 0) {
      throw new Error('没有可执行的工作流')
    }

    // 同步 providers
    syncProviders()

    // 构建工作流对象
    const workflow: Workflow = workflowExecutionService.buildWorkflow(
      nodes,
      edges,
      currentWorkflow ? {
        id: currentWorkflow.id,
        name: currentWorkflow.name,
        createdAt: currentWorkflow.createdAt
      } : undefined
    )

    // 开始执行
    dispatch(startExecution())

    // 使用统一服务执行工作流
    const result = await workflowExecutionService.execute(
      workflow,
      {
        onNodeStatusChange: (nodeId, status, errorMessage) => {
          dispatch(
            updateNodeStatus({
              nodeId,
              status: status as any,
              errorMessage
            })
          )
        },
        onNodeOutput: async (nodeId, outputs) => {
          dispatch(
            updateNodeStatus({
              nodeId,
              status: 'completed',
              result: outputs
            })
          )
          dispatch(
            setNodeResult({
              nodeId,
              status: 'success',
              outputs,
              duration: outputs?.duration
            })
          )
        },
        onProgress: (progress, message) => {
          dispatch(updateExecutionProgress({ progress, message }))
        }
      }
    )

    // 保存上下文用于取消
    setExecutionContext(result.context)

    // 完成执行
    dispatch(
      finishExecution({
        success: result.status === 'completed',
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        failedNodeId: result.failedNodeId,
        context: result.serializedContext
      })
    )

    return result
  }, [workflowState, syncProviders, dispatch])

  /**
   * 取消执行
   * P0 优化：使用统一服务取消
   */
  const cancelExecution = useCallback(() => {
    if (executionContext) {
      workflowExecutionService.cancel(executionContext)
      dispatch(finishExecution({ success: false, error: '用户取消' }))
    }
  }, [executionContext, dispatch])

  return {
    // 状态
    currentWorkflow: workflowState.currentWorkflow,
    nodes: workflowState.nodes,
    edges: workflowState.edges,
    isExecuting: workflowState.isExecuting,
    executionProgress: workflowState.executionProgress,
    executionMessage: workflowState.executionMessage,
    nodeResults: workflowState.nodeResults,

    // Providers
    providers: llmProviders,
    defaultModel,

    // 操作
    syncProviders,
    executeWorkflow,
    cancelExecution
  }
}
