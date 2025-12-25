/**
 * 画布右键菜单组件
 */

import { memo, useEffect, useMemo, useState } from 'react'

import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { NodeCategory, NodeDefinition } from '../../nodes/base/types'

interface CanvasContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onAddNode: (type: string, position: { x: number; y: number }) => void
  onPaste: () => void
  canPaste: boolean
  onSelectAll: () => void
  onFitView: () => void
}

const QUICK_ADD_CATEGORIES: NodeCategory[] = ['input', 'ai', 'image', 'output']

function isModernNodeDefinition(value: unknown): value is NodeDefinition {
  return !!value && typeof value === 'object' && 'metadata' in value
}

function CanvasContextMenu({
  x,
  y,
  onClose,
  onAddNode,
  onPaste,
  canPaste,
  onSelectAll,
  onFitView
}: CanvasContextMenuProps) {
  const [registryReady, setRegistryReady] = useState(() => NodeRegistryAdapter.isInitialized())

  useEffect(() => {
    if (registryReady) return
    let cancelled = false

    void (async () => {
      try {
        await NodeRegistryAdapter.initialize()
      } finally {
        if (!cancelled) setRegistryReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [registryReady])

  // 使用适配器获取所有节点定义
  const quickAddNodes = useMemo(() => {
    const allTypes = NodeRegistryAdapter.getAllNodeTypes()
    const allNodeDefs = allTypes
      .map((type) => NodeRegistryAdapter.getNodeDefinition(type))
      .filter(isModernNodeDefinition)

    return allNodeDefs.filter((def) => QUICK_ADD_CATEGORIES.includes(def.metadata.category)).slice(0, 8)
  }, [registryReady])

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
          minWidth: '200px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          animation: 'fadeIn 0.15s ease'
        }}>
        {/* 快捷操作 */}
        <div style={{ padding: '4px 0' }}>
          <MenuItem
            icon="📋"
            label="粘贴"
            shortcut="Ctrl+V"
            onClick={() => {
              onPaste()
              onClose()
            }}
            disabled={!canPaste}
          />
          <MenuItem
            icon="⬚"
            label="全选"
            shortcut="Ctrl+A"
            onClick={() => {
              onSelectAll()
              onClose()
            }}
          />
          <MenuItem
            icon="⤢"
            label="适应视图"
            onClick={() => {
              onFitView()
              onClose()
            }}
          />
        </div>

        <div
          style={{
            height: '1px',
            backgroundColor: 'var(--ant-color-border)',
            margin: '4px 0'
          }}
        />

        {/* 快速添加节点 */}
        <div style={{ padding: '4px 8px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--ant-color-text-tertiary)',
              marginBottom: '4px',
              fontWeight: '600'
            }}>
            快速添加节点
          </div>
        </div>

        {quickAddNodes.map((nodeDef) => (
          <MenuItem
            key={nodeDef.metadata.type}
            icon={nodeDef.metadata.icon}
            label={nodeDef.metadata.label}
            onClick={() => {
              onAddNode(nodeDef.metadata.type, { x: x - 100, y: y - 50 })
              onClose()
            }}
          />
        ))}
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

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false
}: {
  icon: string
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        color: disabled ? 'var(--ant-color-text-disabled)' : 'var(--ant-color-text)',
        textAlign: 'left',
        transition: 'background-color 0.15s',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--ant-color-fill-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}>
      <span>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <span style={{ fontSize: '12px', color: 'var(--ant-color-text-tertiary)' }}>{shortcut}</span>}
    </button>
  )
}

export default memo(CanvasContextMenu)
