/**
 * 悬浮配置面板组件 v2.0
 * 居中弹出的配置面板，类似 Modal 但更轻量
 * 选中节点时自动弹出，提供更好的工作流程体验
 *
 * 特性：
 * - 居中显示，缩放动画
 * - 半透明遮罩可点击关闭
 * - 节点类型徽章
 * - 快捷操作按钮
 * - 键盘支持 (Escape 关闭)
 */

import { useAppSelector } from '@renderer/store'
import { Copy, Play, Settings, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'

import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { WorkflowNodeType } from '../../types'
import ConfigPanel from './ConfigPanel'

interface ConfigFloatingPanelProps {
  open: boolean
  onClose: () => void
}

// 节点类别颜色
const CATEGORY_COLORS: Record<string, string> = {
  input: '#52c41a',
  ai: '#1890ff',
  image: '#722ed1',
  video: '#eb2f96',
  flow: '#fa8c16',
  output: '#13c2c2',
  external: '#faad14',
  custom: '#8c8c8c'
}

// 辅助函数：兼容新旧节点定义格式
function getNodeDefProperty(nodeDef: any, key: string): any {
  if (nodeDef?.metadata && nodeDef.metadata[key] !== undefined) {
    return nodeDef.metadata[key]
  }
  return nodeDef?.[key]
}

/**
 * 悬浮配置面板
 * 居中显示，方便查看和编辑节点配置
 */
function ConfigFloatingPanel({ open, onClose }: ConfigFloatingPanelProps) {
  const selectedNodeId = useAppSelector((state) => state.workflow.selectedNodeId)
  const selectedNode = useAppSelector((state) => {
    const nodes = state.workflow.nodes
    return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined
  })

  // 获取节点定义
  const nodeDef = useMemo(() => {
    if (!selectedNode?.data?.nodeType) return null
    return NodeRegistryAdapter.getNodeDefinition(selectedNode.data.nodeType as WorkflowNodeType)
  }, [selectedNode?.data?.nodeType])

  // 获取节点信息
  const nodeInfo = useMemo(() => {
    if (!nodeDef) return { icon: <Settings size={18} />, category: 'custom', categoryLabel: '自定义' }
    const icon = getNodeDefProperty(nodeDef, 'icon')
    const category = getNodeDefProperty(nodeDef, 'category') || 'custom'
    const categoryLabels: Record<string, string> = {
      input: '输入',
      ai: 'AI',
      image: '图像',
      video: '视频',
      flow: '流程',
      output: '输出',
      external: '外部',
      custom: '自定义'
    }
    return {
      icon: icon || <Settings size={18} />,
      category,
      categoryLabel: categoryLabels[category] || '自定义'
    }
  }, [nodeDef])

  // 关闭面板
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // 删除节点后关闭面板
  const handleAfterDelete = useCallback(() => {
    onClose()
  }, [onClose])

  // 点击遮罩关闭
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // 运行节点
  const handleRunNode = useCallback(() => {
    if (!selectedNodeId) return
    const event = new CustomEvent('workflow:run-node', {
      detail: { nodeId: selectedNodeId }
    })
    window.dispatchEvent(event)
  }, [selectedNodeId])

  // 复制节点 ID
  const handleCopyId = useCallback(() => {
    if (!selectedNodeId) return
    navigator.clipboard.writeText(selectedNodeId)
  }, [selectedNodeId])

  // 键盘事件 - Escape 关闭
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const categoryColor = CATEGORY_COLORS[nodeInfo.category] || CATEGORY_COLORS.custom

  return (
    <>
      {/* 半透明遮罩层 */}
      <Backdrop $open={open} onClick={handleBackdropClick} />

      {/* 悬浮面板 */}
      <PanelContainer $open={open}>
        {/* 面板头部 */}
        <PanelHeader>
          <HeaderMain>
            <NodeIcon>{nodeInfo.icon}</NodeIcon>
            <HeaderInfo>
              <NodeName>{selectedNode?.data.label || '节点配置'}</NodeName>
              <CategoryBadge $color={categoryColor}>{nodeInfo.categoryLabel}</CategoryBadge>
            </HeaderInfo>
          </HeaderMain>
          <CloseButton onClick={handleClose} title="关闭 (Esc)">
            <X size={18} />
          </CloseButton>
        </PanelHeader>

        {/* 快捷操作栏 */}
        <QuickActions>
          <ActionButton onClick={handleRunNode} $variant="success" title="运行此节点">
            <Play size={14} />
            <span>运行</span>
          </ActionButton>
          <ActionButton onClick={handleCopyId} title="复制节点 ID">
            <Copy size={14} />
            <span>复制 ID</span>
          </ActionButton>
        </QuickActions>

        {/* 面板内容 */}
        <PanelContent>
          <ConfigPanel isModal onDelete={handleAfterDelete} />
        </PanelContent>
      </PanelContainer>
    </>
  )
}

export default memo(ConfigFloatingPanel)

// ==================== 样式 ====================

const Backdrop = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(2px);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition: opacity 0.25s ease, visibility 0.25s ease;
  z-index: 999;
`

const PanelContainer = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) ${({ $open }) => ($open ? 'scale(1)' : 'scale(0.95)')};
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.15);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(
    to bottom,
    var(--color-background-soft),
    var(--color-background)
  );
  flex-shrink: 0;
`

const HeaderMain = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const NodeIcon = styled.span`
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
`

const NodeName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
`

const CategoryBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${({ $color }) => `${$color}15`};
  border: 1px solid ${({ $color }) => `${$color}30`};
  color: ${({ $color }) => $color};
  font-size: 11px;
  font-weight: 500;
  width: fit-content;
`

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-background-soft);
    color: var(--color-text);
  }
`

const QuickActions = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
`

const ActionButton = styled.button<{ $variant?: 'success' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  ${({ $variant }) =>
    $variant === 'success' &&
    `
    background: var(--color-status-success, #52c41a);
    border-color: var(--color-status-success, #52c41a);
    color: white;

    &:hover {
      background: #73d13d;
      border-color: #73d13d;
    }
  `}

  ${({ $variant }) =>
    $variant === 'danger' &&
    `
    &:hover {
      background: var(--color-error);
      border-color: var(--color-error);
      color: white;
    }
  `}

  ${({ $variant }) =>
    !$variant &&
    `
    &:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: var(--color-primary-mute);
    }
  `}
`

const PanelContent = styled.div`
  flex: 1;
  overflow: auto;

  /* ConfigPanel 在 isModal=true 时已经不渲染 header，无需额外隐藏 */

  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-soft);
  }
`
