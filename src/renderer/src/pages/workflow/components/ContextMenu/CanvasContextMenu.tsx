/**
 * 画布右键菜单组件
 * 提供粘贴、全选、适应视图和快速添加节点功能
 * 参考 YouArt / Agentok 的菜单设计
 */

import { Clipboard, Maximize2, Plus, SquareDashedMousePointer } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'

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

// 类别颜色映射
const CATEGORY_COLORS: Record<NodeCategory, string> = {
  input: 'var(--workflow-theme-success, #52c41a)',
  ai: 'var(--workflow-theme-primary, #1890ff)',
  image: 'var(--workflow-theme-secondary, #722ed1)',
  video: 'var(--ant-color-magenta, #eb2f96)',
  flow: 'var(--workflow-theme-warning, #faad14)',
  output: 'var(--workflow-theme-info, #13c2c2)',
  external: 'var(--ant-color-orange, #fa8c16)',
  custom: 'var(--workflow-theme-geekblue, #2f54eb)',
  text: 'var(--ant-color-cyan, #13c2c2)',
  quality: 'var(--ant-color-lime, #a0d911)'
}

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
      <Backdrop onClick={onClose} />

      {/* 菜单 */}
      <MenuContainer $x={x} $y={y}>
        {/* 快捷操作 */}
        <MenuSection>
          <MenuItem
            onClick={() => {
              onPaste()
              onClose()
            }}
            disabled={!canPaste}>
            <MenuItemIcon>
              <Clipboard size={14} />
            </MenuItemIcon>
            <MenuItemLabel>粘贴</MenuItemLabel>
            <MenuItemShortcut>Ctrl+V</MenuItemShortcut>
          </MenuItem>

          <MenuItem
            onClick={() => {
              onSelectAll()
              onClose()
            }}>
            <MenuItemIcon>
              <SquareDashedMousePointer size={14} />
            </MenuItemIcon>
            <MenuItemLabel>全选</MenuItemLabel>
            <MenuItemShortcut>Ctrl+A</MenuItemShortcut>
          </MenuItem>

          <MenuItem
            onClick={() => {
              onFitView()
              onClose()
            }}>
            <MenuItemIcon>
              <Maximize2 size={14} />
            </MenuItemIcon>
            <MenuItemLabel>适应视图</MenuItemLabel>
          </MenuItem>
        </MenuSection>

        <MenuDivider />

        {/* 快速添加节点 */}
        <MenuSection>
          <SectionHeader>
            <Plus size={12} />
            <span>快速添加节点</span>
          </SectionHeader>

          {quickAddNodes.map((nodeDef) => {
            const categoryColor = CATEGORY_COLORS[nodeDef.metadata.category] || 'var(--ant-color-text-tertiary)'
            return (
              <NodeMenuItem
                key={nodeDef.metadata.type}
                onClick={() => {
                  onAddNode(nodeDef.metadata.type, { x: x - 100, y: y - 50 })
                  onClose()
                }}
                $categoryColor={categoryColor}>
                <NodeItemIcon $color={categoryColor}>{nodeDef.metadata.icon}</NodeItemIcon>
                <MenuItemLabel>{nodeDef.metadata.label}</MenuItemLabel>
                <CategoryDot $color={categoryColor} />
              </NodeMenuItem>
            )
          })}
        </MenuSection>
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
  min-width: 220px;
  max-height: 400px;
  overflow-y: auto;
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

  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--ant-color-border);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--ant-color-text-quaternary);
  }
`

const MenuSection = styled.div`
  padding: 4px 0;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
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

const MenuItem = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  font-size: 13px;
  color: ${(props) => (props.disabled ? 'var(--ant-color-text-disabled)' : 'var(--ant-color-text)')};
  text-align: left;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  &:hover:not(:disabled) {
    background: var(--ant-color-fill-secondary);
    transform: translateX(2px);
  }

  &:active:not(:disabled) {
    transform: translateX(2px) scale(0.98);
  }
`

const MenuItemIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--ant-color-fill-tertiary);
  color: var(--ant-color-text-secondary);
  transition: all 0.15s ease;

  ${MenuItem}:hover:not(:disabled) & {
    background: var(--ant-color-primary);
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

const NodeMenuItem = styled.button<{ $categoryColor: string }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--ant-color-text);
  text-align: left;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: ${(props) => `${props.$categoryColor}15`};
    transform: translateX(2px);
    border-left: 2px solid ${(props) => props.$categoryColor};
    padding-left: 10px;
  }

  &:active {
    transform: translateX(2px) scale(0.98);
  }
`

const NodeItemIcon = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: ${(props) => `${props.$color}15`};
  font-size: 14px;
  transition: all 0.15s ease;

  ${NodeMenuItem}:hover & {
    background: ${(props) => props.$color};
    color: white;
    transform: scale(1.05);
  }
`

const CategoryDot = styled.span<{ $color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  opacity: 0.6;
  transition: opacity 0.15s ease;

  ${NodeMenuItem}:hover & {
    opacity: 1;
    box-shadow: 0 0 6px ${(props) => props.$color};
  }
`

export default memo(CanvasContextMenu)
