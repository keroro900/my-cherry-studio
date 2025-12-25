/**
 * 可折叠面板组件
 * 提供统一的折叠/展开 UI 交互
 */

import { ChevronDown, ChevronUp } from 'lucide-react'
import { memo, type ReactNode, useState } from 'react'

interface CollapsiblePanelProps {
  title: string
  icon?: ReactNode
  defaultCollapsed?: boolean
  badge?: string | number
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

const panelStyles = {
  container: {
    backgroundColor: 'var(--ant-color-bg-container)',
    borderRadius: '8px',
    border: '1px solid var(--ant-color-border)',
    overflow: 'hidden',
    marginBottom: '12px'
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    borderBottom: '1px solid var(--ant-color-border)',
    transition: 'background-color 0.2s',
    userSelect: 'none'
  } as React.CSSProperties,
  headerCollapsed: {
    borderBottom: 'none'
  } as React.CSSProperties,
  title: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--ant-color-text)'
  } as React.CSSProperties,
  badge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: 'var(--ant-color-fill-secondary)',
    color: 'var(--ant-color-text-secondary)'
  } as React.CSSProperties,
  icon: {
    color: 'var(--ant-color-text-tertiary)',
    transition: 'transform 0.2s'
  } as React.CSSProperties,
  content: {
    padding: '12px',
    maxHeight: '1000px',
    overflow: 'auto',
    transition: 'all 0.3s ease-out'
  } as React.CSSProperties,
  contentCollapsed: {
    maxHeight: '0',
    padding: '0 12px',
    overflow: 'hidden'
  } as React.CSSProperties
}

function CollapsiblePanel({
  title,
  icon,
  defaultCollapsed = false,
  badge,
  headerExtra,
  children,
  className,
  headerClassName,
  contentClassName
}: CollapsiblePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  return (
    <div style={panelStyles.container} className={className}>
      <div
        style={{
          ...panelStyles.header,
          ...(isCollapsed ? panelStyles.headerCollapsed : {})
        }}
        className={headerClassName}
        onClick={() => setIsCollapsed(!isCollapsed)}>
        {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
        <span style={panelStyles.title}>{title}</span>
        {badge !== undefined && <span style={panelStyles.badge}>{badge}</span>}
        {headerExtra}
        <span style={panelStyles.icon}>{isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</span>
      </div>
      <div
        style={{
          ...panelStyles.content,
          ...(isCollapsed ? panelStyles.contentCollapsed : {})
        }}
        className={contentClassName}>
        {children}
      </div>
    </div>
  )
}

export default memo(CollapsiblePanel)
