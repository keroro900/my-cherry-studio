/**
 * 画布工具栏组件
 * 提供撤销、重做、缩放、适应视图等画布操作
 * 注意：运行/停止功能已移至顶部 WorkflowToolbar，避免重复
 */

import { Tooltip } from 'antd'
import { Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { memo, useCallback } from 'react'
import styled from 'styled-components'

interface ToolbarProps {
  /** 能否撤销 */
  canUndo?: boolean
  /** 能否重做 */
  canRedo?: boolean
  /** 当前缩放级别 */
  zoom?: number
  /** 撤销回调 */
  onUndo?: () => void
  /** 重做回调 */
  onRedo?: () => void
  /** 放大回调 */
  onZoomIn?: () => void
  /** 缩小回调 */
  onZoomOut?: () => void
  /** 适应视图回调 */
  onFitView?: () => void
}

/**
 * 画布工具栏
 */
function Toolbar({
  canUndo = false,
  canRedo = false,
  zoom = 1,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView
}: ToolbarProps) {
  const handleUndo = useCallback(() => {
    onUndo?.()
  }, [onUndo])

  const handleRedo = useCallback(() => {
    onRedo?.()
  }, [onRedo])

  const handleZoomIn = useCallback(() => {
    onZoomIn?.()
  }, [onZoomIn])

  const handleZoomOut = useCallback(() => {
    onZoomOut?.()
  }, [onZoomOut])

  const handleFitView = useCallback(() => {
    onFitView?.()
  }, [onFitView])

  const zoomPercent = Math.round(zoom * 100)

  return (
    <ToolbarContainer>
      {/* 历史操作组 */}
      <ToolGroup>
        <Tooltip title="撤销 (Ctrl+Z)" placement="bottom">
          <ToolButton onClick={handleUndo} disabled={!canUndo}>
            <Undo2 size={16} />
          </ToolButton>
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Shift+Z)" placement="bottom">
          <ToolButton onClick={handleRedo} disabled={!canRedo}>
            <Redo2 size={16} />
          </ToolButton>
        </Tooltip>
      </ToolGroup>

      <Divider />

      {/* 缩放操作组 */}
      <ToolGroup>
        <Tooltip title="缩小" placement="bottom">
          <ToolButton onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </ToolButton>
        </Tooltip>
        <ZoomDisplay>{zoomPercent}%</ZoomDisplay>
        <Tooltip title="放大" placement="bottom">
          <ToolButton onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </ToolButton>
        </Tooltip>
        <Tooltip title="适应视图" placement="bottom">
          <ToolButton onClick={handleFitView}>
            <Maximize2 size={16} />
          </ToolButton>
        </Tooltip>
      </ToolGroup>
    </ToolbarContainer>
  )
}

// ==================== 样式组件 ====================

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
`

const ToolGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--ant-color-border);
  margin: 0 4px;
`

const ToolButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${(props) => (props.disabled ? 'var(--ant-color-text-quaternary)' : 'var(--ant-color-text-secondary)')};
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(:disabled) {
    background: var(--ant-color-fill-secondary);
    color: var(--ant-color-text);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
    background: var(--ant-color-fill-tertiary);
  }
`

const ZoomDisplay = styled.span`
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--ant-color-text-secondary);
  font-variant-numeric: tabular-nums;
`

export default memo(Toolbar)
