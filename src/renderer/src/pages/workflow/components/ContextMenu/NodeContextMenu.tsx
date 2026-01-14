/**
 * 节点右键菜单组件
 * 提供复制、剪切、复制节点、删除等操作
 * 参考 YouArt / Agentok 的菜单设计
 */

import type { Node } from '@xyflow/react'
import { Copy, CopyPlus, Scissors, Trash2 } from 'lucide-react'
import { memo } from 'react'
import styled, { keyframes } from 'styled-components'

interface NodeContextMenuProps {
  x: number
  y: number
  node: Node | null
  onClose: () => void
  onDelete: (nodeId: string) => void
  onDuplicate: (nodeId: string) => void
  onCopy: (nodeId: string) => void
  onCut: (nodeId: string) => void
}

function NodeContextMenu({ x, y, node, onClose, onDelete, onDuplicate, onCopy, onCut }: NodeContextMenuProps) {
  if (!node) return null

  const menuItems = [
    { label: '复制', icon: <Copy size={14} />, action: () => onCopy(node.id), shortcut: 'Ctrl+C' },
    { label: '剪切', icon: <Scissors size={14} />, action: () => onCut(node.id), shortcut: 'Ctrl+X' },
    { label: '复制节点', icon: <CopyPlus size={14} />, action: () => onDuplicate(node.id), shortcut: 'Ctrl+D' },
    { type: 'divider' as const },
    { label: '删除', icon: <Trash2 size={14} />, action: () => onDelete(node.id), shortcut: 'Delete', danger: true }
  ]

  return (
    <>
      {/* 背景遮罩 */}
      <Backdrop onClick={onClose} />

      {/* 菜单 */}
      <MenuContainer $x={x} $y={y}>
        {/* 节点信息 */}
        <MenuHeader>
          <NodeLabel>{String((node.data as any)?.label || node.id)}</NodeLabel>
          <NodeType>{String((node.data as any)?.nodeType || 'node')}</NodeType>
        </MenuHeader>

        <MenuDivider />

        {menuItems.map((item, index) =>
          item.type === 'divider' ? (
            <MenuDivider key={index} />
          ) : (
            <MenuItem
              key={item.label}
              onClick={() => {
                item.action()
                onClose()
              }}
              $danger={item.danger}>
              <MenuItemIcon $danger={item.danger}>{item.icon}</MenuItemIcon>
              <MenuItemLabel>{item.label}</MenuItemLabel>
              <MenuItemShortcut>{item.shortcut}</MenuItemShortcut>
            </MenuItem>
          )
        )}
      </MenuContainer>
    </>
  )
}

// ==================== 动画 ====================

const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`

// ==================== 样式组件 ====================

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
`

const MenuContainer = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  top: ${(props) => props.$y}px;
  left: ${(props) => props.$x}px;
  min-width: 200px;
  padding: 6px;
  background: var(--ant-color-bg-elevated);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--ant-color-border);
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: ${fadeInScale} 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
`

const MenuHeader = styled.div`
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const NodeLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--ant-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const NodeType = styled.div`
  font-size: 11px;
  color: var(--ant-color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const MenuDivider = styled.div`
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--ant-color-border) 20%,
    var(--ant-color-border) 80%,
    transparent 100%
  );
  margin: 4px 8px;
`

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: ${(props) => (props.$danger ? 'var(--ant-color-error)' : 'var(--ant-color-text)')};
  text-align: left;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: ${(props) =>
      props.$danger ? 'var(--ant-color-error-bg)' : 'var(--ant-color-fill-secondary)'};
    transform: translateX(2px);
  }

  &:active {
    transform: translateX(2px) scale(0.98);
  }
`

const MenuItemIcon = styled.span<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${(props) =>
    props.$danger ? 'var(--ant-color-error-bg)' : 'var(--ant-color-fill-tertiary)'};
  color: ${(props) => (props.$danger ? 'var(--ant-color-error)' : 'var(--ant-color-text-secondary)')};
  transition: all 0.15s ease;

  ${MenuItem}:hover & {
    background: ${(props) =>
      props.$danger ? 'var(--ant-color-error)' : 'var(--ant-color-primary)'};
    color: white;
  }
`

const MenuItemLabel = styled.span`
  flex: 1;
  font-weight: 500;
`

const MenuItemShortcut = styled.span`
  font-size: 11px;
  color: var(--ant-color-text-quaternary);
  padding: 2px 6px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
`

export default memo(NodeContextMenu)
