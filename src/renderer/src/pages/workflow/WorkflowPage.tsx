/**
 * 工作流画布主页面
 * 集成 ReactFlow 可视化编辑器
 */

// 导入二次元节点样式
import './styles/animeNodeStyles.css'

import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { createWorkflow, setEdges, setNodes } from '@renderer/store/workflow'
import { message, Modal } from 'antd'
import { debounce } from 'lodash'
import { ChevronLeft, ChevronRight, Layers, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import WorkflowCanvas from './components/Canvas/WorkflowCanvas'
import ConfigPanel from './components/Panels/ConfigPanel'
import NodePanel from './components/Panels/NodePanel'
import StatusPanel from './components/Panels/StatusPanel'
import WorkflowToolbar from './components/Toolbar/WorkflowToolbar'
import WorkflowThemeProvider from './components/WorkflowThemeProvider'
import { useWorkflow } from './hooks/useWorkflow'
import { useWorkflowTheme } from './hooks/useWorkflowTheme'
import { workflowStorage } from './services/WorkflowStorage'

/**
 * 工作流页面组件
 */
export default function WorkflowPage() {
  const dispatch = useAppDispatch()
  const { syncProviders } = useWorkflow()
  const { isLeftNavbar } = useNavbarPosition()
  const { currentThemeId } = useWorkflowTheme()
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false)
  const [isNodePanelCollapsed, setIsNodePanelCollapsed] = useState(false)

  // 从 Redux store 获取状态
  const { showNodePanel, showConfigPanel, currentWorkflow, nodes, edges } = useAppSelector((state) => state.workflow)

  // 用于跟踪是否已检查过草稿恢复
  const hasCheckedDraft = useRef(false)

  // 初始化工作流
  useEffect(() => {
    if (!currentWorkflow) {
      dispatch(createWorkflow({ name: '新工作流' }))
    }
  }, [currentWorkflow, dispatch])

  // 同步 Provider 和 Model
  useEffect(() => {
    syncProviders()
  }, [syncProviders])

  // 检查并恢复草稿
  useEffect(() => {
    if (hasCheckedDraft.current) return
    hasCheckedDraft.current = true

    const draftInfo = workflowStorage.getDraftInfo()
    if (!draftInfo || draftInfo.nodeCount === 0) return

    // 如果当前已有节点，不自动恢复
    if (nodes.length > 0) return

    const savedTime = new Date(draftInfo.savedAt).toLocaleString()
    Modal.confirm({
      title: '发现未保存的工作流',
      content: `上次编辑时间：${savedTime}，包含 ${draftInfo.nodeCount} 个节点。是否恢复？`,
      okText: '恢复',
      cancelText: '放弃',
      onOk: () => {
        const draft = workflowStorage.loadDraft()
        if (draft) {
          dispatch(setNodes(draft.nodes))
          dispatch(setEdges(draft.edges))
          message.success('草稿已恢复')
        }
      },
      onCancel: () => {
        workflowStorage.clearDraft()
      }
    })
  }, [dispatch, nodes.length])

  // 使用 ref 存储最新的数据，避免防抖函数依赖变化
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const workflowRef = useRef(currentWorkflow)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
    workflowRef.current = currentWorkflow
  }, [nodes, edges, currentWorkflow])

  // 自动保存草稿 - 防抖函数只创建一次
  const debouncedSaveDraft = useMemo(
    () =>
      debounce(() => {
        const currentNodes = nodesRef.current
        const currentEdges = edgesRef.current
        const workflow = workflowRef.current
        if (currentNodes.length === 0) return
        workflowStorage.saveDraft(currentNodes, currentEdges, workflow?.id, workflow?.name)
      }, 5000), // 5秒防抖，减少保存频率
    [] // 空依赖，只创建一次
  )

  // 监听节点和边的变化，触发自动保存
  useEffect(() => {
    if (nodes.length > 0) {
      debouncedSaveDraft()
    }
    return () => {
      debouncedSaveDraft.cancel()
    }
  }, [nodes, edges, debouncedSaveDraft])

  return (
    <ErrorBoundary>
      <WorkflowThemeProvider>
        <Container>
          {/* 左侧导航栏模式下显示 Navbar 以提供窗口控制按钮 */}
          <Navbar>
            <NavbarCenter style={{ borderRight: 'none' }}>工作流</NavbarCenter>
          </Navbar>
          <PageContainer
            id={isLeftNavbar ? 'content-container' : undefined}
            className="workflow-root"
            data-workflow-theme={currentThemeId}>
            {/* 工具栏 */}
            <WorkflowToolbar />

            {/* 主要内容区域 */}
            <MainContent>
              {/* 左侧：节点面板 - 可折叠 */}
              {showNodePanel && (
                <div
                  className="workflow-node-panel"
                  style={{
                    width: isNodePanelCollapsed ? '40px' : '260px',
                    flexShrink: 0,
                    borderRight: '1px solid var(--ant-color-border)',
                    overflow: 'hidden',
                    backgroundColor: 'var(--ant-color-bg-container)',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                  {isNodePanelCollapsed ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: '12px',
                        gap: '8px'
                      }}>
                      <button
                        onClick={() => setIsNodePanelCollapsed(false)}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          border: '1px solid var(--ant-color-border)',
                          backgroundColor: 'var(--ant-color-bg-elevated)',
                          cursor: 'pointer',
                          color: 'var(--ant-color-text-secondary)'
                        }}
                        title="展开节点库">
                        <ChevronRight size={16} />
                      </button>
                      <div
                        style={{
                          writingMode: 'vertical-rl',
                          fontSize: '12px',
                          color: 'var(--ant-color-text-tertiary)',
                          marginTop: '8px'
                        }}>
                        <Layers size={14} style={{ marginBottom: '4px' }} />
                        节点库
                      </div>
                    </div>
                  ) : (
                    <NodePanel onCollapse={() => setIsNodePanelCollapsed(true)} />
                  )}
                </div>
              )}

              {/* 中间：画布和状态面板 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  minWidth: 0,
                  minHeight: 0
                }}>
                {/* 画布区域 */}
                <div
                  style={{
                    flex: '1 1 0',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 0
                  }}>
                  <WorkflowCanvas />
                </div>

                {/* 底部：状态面板 */}
                <StatusPanel />
              </div>

              {/* 右侧：配置面板 - 可折叠 */}
              {showConfigPanel && (
                <div
                  className="workflow-config-panel"
                  style={{
                    width: isConfigCollapsed ? '40px' : '320px',
                    flexShrink: 0,
                    borderLeft: '1px solid var(--ant-color-border)',
                    overflow: 'hidden',
                    backgroundColor: 'var(--ant-color-bg-container)',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                  {/* 折叠时只显示切换按钮 */}
                  {isConfigCollapsed ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: '12px',
                        gap: '8px'
                      }}>
                      <button
                        onClick={() => setIsConfigCollapsed(false)}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          border: '1px solid var(--ant-color-border)',
                          backgroundColor: 'var(--ant-color-bg-elevated)',
                          cursor: 'pointer',
                          color: 'var(--ant-color-text-secondary)'
                        }}
                        title="展开配置面板">
                        <ChevronLeft size={16} />
                      </button>
                      <div
                        style={{
                          writingMode: 'vertical-rl',
                          fontSize: '12px',
                          color: 'var(--ant-color-text-tertiary)',
                          marginTop: '8px'
                        }}>
                        <Settings2 size={14} style={{ marginBottom: '4px' }} />
                        节点配置
                      </div>
                    </div>
                  ) : (
                    <ConfigPanel onCollapse={() => setIsConfigCollapsed(true)} />
                  )}
                </div>
              )}
            </MainContent>
          </PageContainer>
        </Container>
      </WorkflowThemeProvider>
    </ErrorBoundary>
  )
}

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
`

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background-color: transparent;
  position: relative;
  min-width: 0;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`
