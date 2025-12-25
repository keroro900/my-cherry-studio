/**
 * 节点右键菜单组件
 */

import type { Node } from '@xyflow/react'
import { memo } from 'react'

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
    { label: '复制', icon: '📋', action: () => onCopy(node.id), shortcut: 'Ctrl+C' },
    { label: '剪切', icon: '✂️', action: () => onCut(node.id), shortcut: 'Ctrl+X' },
    { label: '复制节点', icon: '📑', action: () => onDuplicate(node.id), shortcut: 'Ctrl+D' },
    { type: 'divider' as const },
    { label: '删除', icon: '🗑️', action: () => onDelete(node.id), shortcut: 'Delete', danger: true }
  ]

  return (
    <>
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
        onClick={onClose}
      />

      {/* 菜单 */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          backgroundColor: 'var(--ant-color-bg-elevated)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--ant-color-border)',
          padding: '4px 0',
          minWidth: '180px',
          zIndex: 1000,
          animation: 'fadeIn 0.15s ease'
        }}>
        {/* 节点信息 */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--ant-color-border)',
            marginBottom: '4px'
          }}>
          <div style={{ fontSize: '12px', color: 'var(--ant-color-text-secondary)' }}>
            {String((node.data as any)?.label || node.id)}
          </div>
        </div>

        {menuItems.map((item, index) =>
          item.type === 'divider' ? (
            <div
              key={index}
              style={{
                height: '1px',
                backgroundColor: 'var(--ant-color-border)',
                margin: '4px 0'
              }}
            />
          ) : (
            <button
              key={item.label}
              onClick={() => {
                item.action()
                onClose()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: item.danger ? '#ff4d4f' : 'var(--ant-color-text)',
                textAlign: 'left',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--ant-color-fill-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--ant-color-text-tertiary)' }}>{item.shortcut}</span>
            </button>
          )
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

export default memo(NodeContextMenu)
