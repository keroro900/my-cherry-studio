/**
 * 工作流工具栏组件
 * 提供运行、保存、加载等操作
 * Cherry 本土化 - 使用本地存储和前端执行引擎
 *
 * P0 优化：使用统一的 workflowExecutionService 执行工作流
 */

import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  clearRetryState,
  clearWorkflow,
  finishExecution,
  setCurrentWorkflow,
  setExecutionSettings,
  setNodeResult,
  setNodes,
  startExecution,
  updateNodeStatus
} from '@renderer/store/workflow'
import type { Model, Provider } from '@renderer/types'
import type { MenuProps } from 'antd'
import { Dropdown, Input, message, Popover, Select, Slider, Switch, Tooltip } from 'antd'
import { ChevronDown, RefreshCw, Settings } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'

import { ExecutionContextManager } from '../../engine/ExecutionContext'
import { workflowExecutionService } from '../../services/WorkflowExecutionService'
import { processNodeResult, saveResultToFile } from '../../services/WorkflowResultStorage'
import { workflowStorage } from '../../services/WorkflowStorage'
import { workflowTaskManager } from '../../services/WorkflowTaskManager'
import type { WorkflowEdge, WorkflowNode } from '../../types'
import {
  alignNodes,
  type AlignType,
  distributeNodes,
  getLayeredLayout,
  type LayoutDirection
} from '../../utils/layoutUtils'
import WorkflowThemeSelector from './WorkflowThemeSelector'

const logger = loggerService.withContext('WorkflowToolbar')

// ==================== 下载工具函数 ====================

/**
 * 触发浏览器下载
 * 在 Redux 存储之前调用，确保使用原始数据
 */
function triggerDownload(data: string, filename: string, type: string) {
  try {
    let blob: Blob

    if (data.startsWith('data:')) {
      // Base64 数据
      const [header, base64] = data.split(',')
      const mimeMatch = header.match(/data:([^;]+);/)
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
      const binary = atob(base64)
      const array = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i)
      }
      blob = new Blob([array], { type: mime })
    } else if (data.startsWith('http://') || data.startsWith('https://')) {
      // URL - 直接打开下载
      const a = document.createElement('a')
      a.href = data
      a.download = filename
      a.target = '_blank'
      a.click()
      logger.info('Download triggered (URL)', { filename })
      return
    } else if (type === 'text') {
      // 纯文本
      blob = new Blob([data], { type: 'text/plain' })
    } else {
      logger.warn('Unknown data format for download', { preview: data.substring(0, 50) })
      return
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    logger.info('Download triggered (Blob)', { filename })
  } catch (error) {
    logger.error('Download failed', { error })
  }
}

/**
 * 处理输出结果的自动下载和文件保存
 * 在数据存储到 Redux 之前调用
 * Cherry 本土化：使用 Cherry 的 file API 保存文件
 */
async function handleAutoDownload(outputs: any): Promise<string[]> {
  // 智能解析 result 结构
  let result = outputs
  if (result && typeof result === 'object' && 'result' in result) {
    result = result.result
  }
  if (!result) return []

  const savedFiles: string[] = []
  const downloadItems: { data: string; filename: string; type: 'image' | 'video' }[] = []

  // 图片
  if (result.image) {
    const images = Array.isArray(result.image) ? result.image : [result.image]
    images.forEach((img: string, index: number) => {
      if (typeof img === 'string' && img.length > 0) {
        downloadItems.push({
          data: img,
          filename: `workflow_image_${Date.now()}_${index + 1}.png`,
          type: 'image'
        })
      }
    })
  }

  // 视频
  if (result.video) {
    const videos = Array.isArray(result.video) ? result.video : [result.video]
    videos.forEach((vid: string, index: number) => {
      if (typeof vid === 'string' && vid.length > 0) {
        downloadItems.push({
          data: vid,
          filename: `workflow_video_${Date.now()}_${index + 1}.mp4`,
          type: 'video'
        })
      }
    })
  }

  // 触发下载并保存文件（Cherry 本土化：优先使用 Electron API 保存）
  if (downloadItems.length > 0) {
    logger.debug('Processing output items', { count: downloadItems.length })

    for (const item of downloadItems) {
      // 方式1：通过 Cherry 的 file API 保存到本地
      const savedPath = await saveResultToFile(item.data, item.filename, item.type)
      if (savedPath) {
        savedFiles.push(savedPath)
        logger.debug('File saved via Electron API', { savedPath })
      } else {
        // 方式2：降级到浏览器下载
        logger.debug('Falling back to browser download (non-Electron or save failed)', { filename: item.filename })
        triggerDownload(item.data, item.filename, item.type)
      }
    }
  }

  return savedFiles
}

// ==================== 样式 ====================

const toolbarStyle: React.CSSProperties = {
  height: '48px',
  minHeight: '48px',
  maxHeight: '48px',
  flexShrink: 0,
  flexGrow: 0,
  backgroundColor: 'var(--ant-color-bg-container)',
  borderBottom: '1px solid var(--ant-color-border)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  gap: '8px',
  position: 'relative',
  zIndex: 100
}

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  transition: 'all 0.2s'
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'var(--workflow-theme-primary, var(--ant-color-primary, #1890ff))',
  color: 'white'
}

const defaultButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'var(--ant-color-bg-elevated)',
  border: '1px solid var(--ant-color-border)',
  color: 'var(--ant-color-text)'
}

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'transparent',
  border: '1px solid var(--workflow-theme-error, var(--ant-color-error, #ff4d4f))',
  color: 'var(--workflow-theme-error, var(--ant-color-error, #ff4d4f))'
}

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  backgroundColor: 'var(--ant-color-border)',
  margin: '0 8px'
}

// ==================== 组件 ====================

function WorkflowToolbar() {
  const dispatch = useAppDispatch()
  const {
    nodes,
    edges,
    isExecuting,
    currentWorkflow,
    failedNodeId,
    retryCount,
    maxRetries,
    maxConcurrency,
    parallelExecution
  } = useAppSelector((state) => state.workflow)
  const providers = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]
  const [isSaving, setIsSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const lastContextRef = useRef<any>(null)

  // 隐藏的文件输入引用（用于导入）
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 通用的执行工作流逻辑
  // P0 优化：使用统一的 workflowExecutionService 执行工作流
  const executeWorkflowCore = useCallback(
    async (retryFromNodeId?: string) => {
      if (nodes.length === 0) {
        message.warning('请先添加节点')
        return
      }

      dispatch(startExecution())

      try {
        // 使用统一服务执行（设置 Providers）
        workflowExecutionService.setProviders(providers)

        // 如果是重试，构建重试选项
        const retryOptions = retryFromNodeId
          ? {
              startFromNodeId: retryFromNodeId,
              previousContext: lastContextRef.current,
              maxRetries: maxRetries,
              parallelExecution,
              maxConcurrency
            }
          : {
              // 即使不是重试，也传递并行执行设置
              parallelExecution,
              maxConcurrency
            }

        if (retryFromNodeId) {
          const failedNode = nodes.find((n) => n.id === retryFromNodeId)
          message.info(`从节点 "${failedNode?.data?.label || retryFromNodeId}" 开始重试...`)
        }

        // 构建工作流对象
        const workflow = workflowExecutionService.buildWorkflow(
          nodes as WorkflowNode[],
          edges as WorkflowEdge[],
          {
            id: currentWorkflow?.id || 'temp',
            name: currentWorkflow?.name || '临时工作流',
            createdAt: currentWorkflow?.createdAt || Date.now()
          }
        )

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
              logger.debug('onNodeOutput called', {
                nodeId,
                outputKeys: Object.keys(outputs),
                hasResult: !!outputs.result,
                outputType: outputs.outputType,
                rawOutputs: JSON.stringify(outputs).substring(0, 500)
              })

              // 检查是否为输出节点
              const node = nodes.find((n) => n.id === nodeId)
              if (node?.data?.nodeType === 'output') {
                const outputConfig = outputs.outputType || node.data?.config?.outputType || 'display'

                if (outputConfig === 'file') {
                  logger.debug('Skipping auto download, file already saved by node', {
                    nodeId,
                    outputType: outputConfig
                  })
                } else {
                  logger.debug('Triggering auto download', {
                    nodeId,
                    outputType: outputConfig
                  })
                  await handleAutoDownload(outputs)
                }
              }

              // 使用 IndexedDB 存储大数据，Redux 只保存引用
              const { cleanedResult, storedIds } = await processNodeResult(nodeId, outputs, currentWorkflow?.id)

              if (storedIds.length > 0) {
                logger.debug('Stored large data in IndexedDB', {
                  nodeId,
                  storedIds
                })
              }

              // 更新节点状态（存储在 node.data.result）
              dispatch(
                updateNodeStatus({
                  nodeId,
                  status: 'completed',
                  result: cleanedResult
                })
              )

              // 同时更新 nodeResults（用于 ConfigPanel 显示）
              dispatch(
                setNodeResult({
                  nodeId,
                  status: 'success',
                  outputs: cleanedResult,
                  duration: cleanedResult?.duration
                })
              )
            },
            onAutoExport: (exportedFiles) => {
              if (exportedFiles.length > 0) {
                message.success(`自动导出了 ${exportedFiles.length} 个文件`)
              }
            }
          },
          retryOptions
        )

        // 保存上下文用于后续重试
        lastContextRef.current = result.context

        // 序列化上下文以避免 Redux 非序列化警告（Map -> Object）
        const serializedContext = result.context ? ExecutionContextManager.serialize(result.context) : undefined

        dispatch(
          finishExecution({
            success: result.status === 'completed',
            error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
            failedNodeId: result.failedNodeId,
            context: serializedContext
          })
        )

        if (result.status === 'completed') {
          dispatch(clearRetryState())
        }
      } catch (error) {
        logger.error('Workflow execution failed', { error })
        dispatch(
          finishExecution({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        )
      }
    },
    [nodes, edges, providers, currentWorkflow, dispatch, maxRetries, parallelExecution, maxConcurrency]
  )

  // 运行工作流
  const handleRun = useCallback(async () => {
    dispatch(clearRetryState()) // 清除之前的重试状态
    await executeWorkflowCore()
  }, [executeWorkflowCore, dispatch])

  // 重试失败的节点
  const handleRetry = useCallback(async () => {
    if (!failedNodeId) {
      message.warning('没有失败的节点可重试')
      return
    }

    if (retryCount >= maxRetries) {
      message.error(`已达到最大重试次数 (${maxRetries})，请检查节点配置后重新运行`)
      return
    }

    await executeWorkflowCore(failedNodeId)
  }, [failedNodeId, retryCount, maxRetries, executeWorkflowCore])

  // 停止工作流
  const handleStop = useCallback(() => {
    dispatch(finishExecution({ success: false, error: '用户取消' }))
  }, [dispatch])

  // 添加到任务队列
  const handleAddToQueue = useCallback(() => {
    if (nodes.length === 0) {
      message.warning('请先添加节点')
      return
    }

    // 收集所有模型
    const allModels: Model[] = providers.flatMap((p) => p.models || [])

    // 构建工作流对象
    const workflow = {
      id: currentWorkflow?.id || `temp-${Date.now()}`,
      name: currentWorkflow?.name || '临时工作流',
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      createdAt: currentWorkflow?.createdAt || Date.now(),
      updatedAt: Date.now()
    }

    // 提交任务到队列
    const taskId = workflowTaskManager.submitTask({
      workflow,
      providers,
      models: allModels,
      callbacks: {
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
          // 检查是否为输出节点
          const node = nodes.find((n) => n.id === nodeId)
          if (node?.data?.nodeType === 'output') {
            const outputConfig = outputs.outputType || node.data?.config?.outputType || 'display'
            if (outputConfig !== 'file') {
              await handleAutoDownload(outputs)
            }
          }

          // 使用 IndexedDB 存储大数据
          const { cleanedResult } = await processNodeResult(nodeId, outputs, currentWorkflow?.id)

          // 更新节点状态
          dispatch(
            updateNodeStatus({
              nodeId,
              status: 'completed',
              result: cleanedResult
            })
          )

          dispatch(
            setNodeResult({
              nodeId,
              status: 'success',
              outputs: cleanedResult,
              duration: cleanedResult?.duration
            })
          )
        },
        onAutoExport: (exportedFiles) => {
          if (exportedFiles.length > 0) {
            message.success(`自动导出了 ${exportedFiles.length} 个文件`)
          }
        }
      }
    })

    message.success(`任务已添加到队列 (ID: ${taskId.substring(0, 8)}...)`)
  }, [nodes, edges, providers, currentWorkflow, dispatch])

  // 保存工作流（Cherry 本土化 - 本地存储）
  const handleSave = useCallback(async () => {
    if (nodes.length === 0) {
      message.warning('请先添加节点')
      return
    }

    let inputValue = currentWorkflow?.name || '新工作流'

    window.modal.confirm({
      title: '保存工作流',
      content: (
        <Input
          placeholder="请输入工作流名称"
          defaultValue={inputValue}
          onChange={(e) => {
            inputValue = e.target.value
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!inputValue || !inputValue.trim()) {
          message.error('请输入工作流名称')
          return Promise.reject()
        }

        setIsSaving(true)
        try {
          workflowStorage.saveTemplate(
            nodes as WorkflowNode[],
            edges as WorkflowEdge[],
            inputValue.trim(),
            '',
            currentWorkflow?.id
          )
          message.success('保存成功！')
        } catch (error) {
          logger.error('Failed to save workflow', { error })
          message.error('保存失败: ' + (error instanceof Error ? error.message : String(error)))
        } finally {
          setIsSaving(false)
        }
      }
    })
  }, [nodes, edges, currentWorkflow])

  // 加载工作流（Cherry 本土化 - 本地存储）
  const handleLoad = useCallback(async () => {
    try {
      const templates = workflowStorage.listTemplates()
      if (templates.length === 0) {
        message.info('没有已保存的工作流')
        return
      }

      // 创建选择列表
      const templateList = templates.map((t, i) => ({
        value: i,
        label: `${t.name} (${t.nodeCount}个节点)`
      }))

      let selectedIndex = 0

      window.modal.confirm({
        title: '加载工作流',
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>选择要加载的工作流：</p>
            <Select
              style={{ width: '100%' }}
              options={templateList}
              defaultValue={0}
              onChange={(value) => {
                selectedIndex = value
              }}
            />
          </div>
        ),
        okText: '加载',
        cancelText: '取消',
        onOk: async () => {
          const template = workflowStorage.getTemplate(templates[selectedIndex].id)
          if (!template) {
            message.error('加载失败')
            return Promise.reject()
          }

          // 加载到画布 - 同时更新 currentWorkflow 元数据
          dispatch(
            setCurrentWorkflow({
              id: template.id,
              name: template.name,
              description: template.description,
              nodes: template.nodes,
              edges: template.edges,
              createdAt: template.createdAt,
              updatedAt: template.updatedAt
            })
          )

          message.success(`已加载: ${template.name}`)
        }
      })
    } catch (error) {
      logger.error('Failed to load workflow', { error })
      message.error('加载失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [dispatch])

  // 导出工作流
  const handleExport = useCallback(() => {
    if (nodes.length === 0) {
      message.warning('请先添加节点')
      return
    }

    const name = currentWorkflow?.name || '工作流'
    const workflow = {
      id: currentWorkflow?.id || 'export',
      name,
      description: '',
      nodes,
      edges,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, currentWorkflow])

  // 触发导入文件选择
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 处理文件导入
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // 重置 input 以便可以重复选择同一文件
      event.target.value = ''

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const workflow = JSON.parse(content)

          // 验证工作流格式
          if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            message.error('无效的工作流文件：缺少 nodes 字段')
            return
          }

          if (!workflow.edges || !Array.isArray(workflow.edges)) {
            message.error('无效的工作流文件：缺少 edges 字段')
            return
          }

          // 检查是否需要确认覆盖
          // 导入工作流 - 同时更新 currentWorkflow 元数据
          const importWorkflow = () => {
            dispatch(
              setCurrentWorkflow({
                id: workflow.id || `import-${Date.now()}`,
                name: workflow.name || '导入的工作流',
                description: workflow.description || '',
                nodes: workflow.nodes as WorkflowNode[],
                edges: workflow.edges as WorkflowEdge[],
                createdAt: workflow.createdAt || Date.now(),
                updatedAt: workflow.updatedAt || Date.now()
              })
            )
            message.success(`已导入: ${workflow.name || '工作流'} (${workflow.nodes.length} 个节点)`)
          }

          if (nodes.length > 0) {
            window.modal.confirm({
              title: '导入工作流',
              content: `当前画布有 ${nodes.length} 个节点，导入将覆盖现有内容。确定继续？`,
              okText: '导入',
              cancelText: '取消',
              onOk: importWorkflow
            })
          } else {
            // 直接导入
            importWorkflow()
          }
        } catch (error) {
          logger.error('Failed to import workflow', { error })
          message.error('导入失败：无效的 JSON 文件')
        }
      }

      reader.onerror = () => {
        message.error('读取文件失败')
      }

      reader.readAsText(file)
    },
    [nodes.length, dispatch]
  )

  // 清空画布
  const handleClear = useCallback(() => {
    if (nodes.length === 0) return
    window.modal.confirm({
      title: '确认清空',
      content: '确定要清空所有节点吗？此操作不可恢复。',
      okText: '清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        dispatch(clearWorkflow())
        message.success('已清空画布')
      }
    })
  }, [nodes.length, dispatch])

  // 自动布局
  const handleAutoLayout = useCallback(
    (direction: LayoutDirection) => {
      if (nodes.length === 0) {
        message.warning('请先添加节点')
        return
      }

      const newNodes = getLayeredLayout(nodes as any[], edges as any[], { direction })
      dispatch(setNodes(newNodes as WorkflowNode[]))
      message.success('布局完成')
    },
    [nodes, edges, dispatch]
  )

  // 对齐节点
  const handleAlign = useCallback(
    (alignType: AlignType) => {
      const selectedNodeIds = nodes.filter((n: any) => n.selected).map((n: any) => n.id)
      if (selectedNodeIds.length < 2) {
        message.warning('请先选择至少 2 个节点')
        return
      }

      const newNodes = alignNodes(nodes as any[], selectedNodeIds, alignType)
      dispatch(setNodes(newNodes as WorkflowNode[]))
    },
    [nodes, dispatch]
  )

  // 均匀分布节点
  const handleDistribute = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      const selectedNodeIds = nodes.filter((n: any) => n.selected).map((n: any) => n.id)
      if (selectedNodeIds.length < 3) {
        message.warning('请先选择至少 3 个节点')
        return
      }

      const newNodes = distributeNodes(nodes as any[], selectedNodeIds, direction)
      dispatch(setNodes(newNodes as WorkflowNode[]))
    },
    [nodes, dispatch]
  )

  // 运行菜单项
  const runMenuItems: MenuProps['items'] = [
    {
      key: 'run-now',
      label: '▶️ 立即运行',
      onClick: handleRun
    },
    {
      key: 'add-to-queue',
      label: '📋 加入队列',
      onClick: handleAddToQueue
    }
  ]

  // 布局菜单项
  const layoutMenuItems: MenuProps['items'] = [
    {
      key: 'auto-layout',
      label: '自动布局',
      children: [
        { key: 'layout-lr', label: '← → 从左到右', onClick: () => handleAutoLayout('LR') },
        { key: 'layout-rl', label: '→ ← 从右到左', onClick: () => handleAutoLayout('RL') },
        { key: 'layout-tb', label: '↓ 从上到下', onClick: () => handleAutoLayout('TB') },
        { key: 'layout-bt', label: '↑ 从下到上', onClick: () => handleAutoLayout('BT') }
      ]
    },
    { type: 'divider' },
    {
      key: 'align',
      label: '对齐 (选中节点)',
      children: [
        { key: 'align-left', label: '← 左对齐', onClick: () => handleAlign('left') },
        { key: 'align-center', label: '↔ 水平居中', onClick: () => handleAlign('center') },
        { key: 'align-right', label: '→ 右对齐', onClick: () => handleAlign('right') },
        { type: 'divider' },
        { key: 'align-top', label: '↑ 顶部对齐', onClick: () => handleAlign('top') },
        { key: 'align-middle', label: '↕ 垂直居中', onClick: () => handleAlign('middle') },
        { key: 'align-bottom', label: '↓ 底部对齐', onClick: () => handleAlign('bottom') }
      ]
    },
    {
      key: 'distribute',
      label: '均匀分布 (选中节点)',
      children: [
        { key: 'dist-h', label: '↔ 水平分布', onClick: () => handleDistribute('horizontal') },
        { key: 'dist-v', label: '↕ 垂直分布', onClick: () => handleDistribute('vertical') }
      ]
    }
  ]

  return (
    <div style={toolbarStyle}>
      {/* 运行/停止 - 下拉菜单 */}
      {isExecuting ? (
        <button onClick={handleStop} style={{ ...dangerButtonStyle }}>
          <span>⏹️</span>
          <span>停止</span>
        </button>
      ) : (
        <Dropdown
          menu={{ items: runMenuItems }}
          trigger={['click']}
          disabled={nodes.length === 0}
          destroyPopupOnHide>
          <button style={primaryButtonStyle} disabled={nodes.length === 0}>
            <span>▶️</span>
            <span>运行</span>
            <ChevronDown size={14} style={{ marginLeft: '4px', opacity: 0.7 }} />
          </button>
        </Dropdown>
      )}

      {/* 重试按钮 - 仅在有失败节点且未达到最大重试次数时显示 */}
      {failedNodeId && !isExecuting && retryCount < maxRetries && (
        <button
          onClick={handleRetry}
          style={{
            ...defaultButtonStyle,
            backgroundColor: 'var(--workflow-theme-warning, #faad14)',
            color: '#fff',
            border: 'none'
          }}
          title={`从失败节点重试 (${retryCount}/${maxRetries})`}>
          <RefreshCw size={14} />
          <span>
            重试 ({retryCount}/{maxRetries})
          </span>
        </button>
      )}

      <div style={dividerStyle} />

      {/* 保存/加载 */}
      <button onClick={handleSave} style={defaultButtonStyle} disabled={isSaving}>
        <span>💾</span>
        <span>{isSaving ? '保存中...' : '保存'}</span>
      </button>

      <button onClick={handleLoad} style={defaultButtonStyle}>
        <span>📂</span>
        <span>加载</span>
      </button>

      <button onClick={handleExport} style={defaultButtonStyle} disabled={nodes.length === 0}>
        <span>📤</span>
        <span>导出</span>
      </button>

      <button onClick={handleImportClick} style={defaultButtonStyle}>
        <span>📥</span>
        <span>导入</span>
      </button>

      {/* 隐藏的文件输入 */}
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

      <div style={dividerStyle} />

      {/* 清空 */}
      <button onClick={handleClear} style={defaultButtonStyle} disabled={nodes.length === 0}>
        <span>🗑️</span>
        <span>清空</span>
      </button>

      {/* 布局 */}
      <Dropdown menu={{ items: layoutMenuItems }} trigger={['click']} destroyPopupOnHide>
        <button style={defaultButtonStyle} disabled={nodes.length === 0}>
          <span>📐</span>
          <span>布局</span>
        </button>
      </Dropdown>

      <div style={dividerStyle} />

      {/* 主题选择器 */}
      <WorkflowThemeSelector />

      {/* 执行设置 */}
      <Popover
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        trigger="click"
        placement="bottomRight"
        content={
          <div style={{ width: 260, padding: '4px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}>
                <span style={{ fontSize: 13 }}>并行执行</span>
                <Switch
                  size="small"
                  checked={parallelExecution}
                  onChange={(checked) => dispatch(setExecutionSettings({ parallelExecution: checked }))}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                启用后，无依赖关系的节点将同时执行
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}>
                <span style={{ fontSize: 13 }}>最大并发数</span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--workflow-theme-primary, var(--ant-color-primary))',
                    fontWeight: 500
                  }}>
                  {maxConcurrency}
                </span>
              </div>
              <Slider
                min={1}
                max={10}
                value={maxConcurrency}
                disabled={!parallelExecution}
                onChange={(value) => dispatch(setExecutionSettings({ maxConcurrency: value }))}
                marks={{ 1: '1', 3: '3', 5: '5', 10: '10' }}
              />
              <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', marginTop: 4 }}>
                同时执行的最大节点数，建议 3-5
              </div>
            </div>
          </div>
        }>
        <Tooltip title="执行设置">
          <button style={defaultButtonStyle}>
            <Settings size={14} />
          </button>
        </Tooltip>
      </Popover>

      {/* 右侧信息 */}
      <div style={{ flex: 1 }} />

      <div style={{ fontSize: '12px', color: 'var(--ant-color-text-tertiary)' }}>
        {nodes.length} 个节点 • {edges.length} 条连接
      </div>
    </div>
  )
}

export default memo(WorkflowToolbar)
