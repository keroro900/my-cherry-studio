/**
 * 节点面板 - 支持拖拽添加节点
 * 基于 React Flow 官方 Drag and Drop 示例
 * https://reactflow.dev/examples/interaction/drag-and-drop
 */

import { Tooltip } from 'antd'
import { ChevronDown, ChevronLeft, ChevronUp, Info, Layers, Plus, Search } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { NodeDefinition } from '../../types'
// NODE_REGISTRY 已废弃，仅作为初始化前的回退
import { NODE_REGISTRY } from '../../types'
import { CustomNodeBuilder } from '../CustomNodeBuilder'

interface NodePanelProps {
  onCollapse?: () => void
}

// 类别颜色映射 - 使用工作流主题语义色
// 这些颜色用于节点类别标识，保持一致性
const CATEGORY_COLORS: Record<NodeDefinition['category'], string> = {
  input: 'var(--workflow-theme-success, #52c41a)',
  ai: 'var(--workflow-theme-primary, #1890ff)',
  image: 'var(--workflow-theme-secondary, #722ed1)',
  video: 'var(--ant-color-magenta, #eb2f96)',
  flow: 'var(--workflow-theme-warning, #faad14)',
  output: 'var(--workflow-theme-info, #13c2c2)',
  external: 'var(--ant-color-orange, #fa8c16)',
  custom: 'var(--workflow-theme-geekblue, #2f54eb)',
  text: 'var(--ant-color-cyan, #13c2c2)',
  fashion: 'var(--ant-color-pink, #eb2f96)',
  quality: 'var(--ant-color-lime, #a0d911)'
}

// 类别名称映射
const CATEGORY_NAMES: Record<NodeDefinition['category'], string> = {
  input: '输入节点',
  ai: 'AI 处理',
  image: '图像处理',
  video: '视频处理',
  flow: '流程控制',
  output: '输出节点',
  external: '外部服务',
  custom: '自定义节点',
  text: '文本/内容',
  fashion: '时尚分析',
  quality: '质量优化'
}

function getCategoryColor(category: NodeDefinition['category']): string {
  return CATEGORY_COLORS[category] || 'var(--ant-color-text-tertiary)'
}

function getCategoryName(category: NodeDefinition['category']): string {
  return CATEGORY_NAMES[category] || category
}

const styles = {
  panel: {
    width: '260px',
    height: '100%',
    backgroundColor: 'var(--ant-color-bg-container)',
    borderRight: '1px solid var(--ant-color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } as React.CSSProperties,
  header: {
    padding: '16px',
    borderBottom: '1px solid var(--ant-color-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--ant-color-bg-elevated)'
  } as React.CSSProperties,
  headerIcon: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--ant-color-primary-bg)',
    borderRadius: '8px',
    color: 'var(--ant-color-primary)'
  } as React.CSSProperties,
  headerTitle: {
    fontWeight: 700,
    fontSize: '15px',
    letterSpacing: '-0.3px'
  } as React.CSSProperties,
  searchContainer: {
    margin: '12px 16px',
    position: 'relative'
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--ant-color-text-tertiary)',
    pointerEvents: 'none'
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    borderRadius: '8px',
    border: '1px solid var(--ant-color-border)',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    color: 'var(--ant-color-text)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  } as React.CSSProperties,
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '0 12px 16px'
  } as React.CSSProperties,
  category: {
    marginTop: '12px'
  } as React.CSSProperties,
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--ant-color-text-secondary)',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background-color 0.2s',
    userSelect: 'none'
  } as React.CSSProperties,
  categoryDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px'
  } as React.CSSProperties,
  nodeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'grab',
    transition: 'all 0.2s',
    marginBottom: '4px',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    border: '1px solid transparent'
  } as React.CSSProperties,
  nodeIcon: {
    fontSize: '18px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px'
  } as React.CSSProperties,
  nodeInfo: {
    flex: 1,
    minWidth: 0
  } as React.CSSProperties,
  nodeName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--ant-color-text)',
    marginBottom: '2px'
  } as React.CSSProperties,
  nodeDesc: {
    fontSize: '11px',
    color: 'var(--ant-color-text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as React.CSSProperties,
  backendBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    backgroundColor: 'var(--ant-color-primary-bg)',
    color: 'var(--ant-color-primary)',
    fontWeight: 500
  } as React.CSSProperties,
  addIcon: {
    opacity: 0,
    color: 'var(--ant-color-text-tertiary)',
    transition: 'opacity 0.2s'
  } as React.CSSProperties,
  emptyState: {
    padding: '32px 16px',
    textAlign: 'center',
    color: 'var(--ant-color-text-tertiary)'
  } as React.CSSProperties,
  tip: {
    margin: '16px 12px',
    padding: '12px',
    backgroundColor: 'var(--ant-color-primary-bg)',
    border: '1px solid var(--ant-color-primary-border)',
    borderRadius: '8px'
  } as React.CSSProperties,
  tipHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--ant-color-primary)',
    marginBottom: '6px',
    fontSize: '11px',
    fontWeight: 600
  } as React.CSSProperties,
  tipText: {
    fontSize: '11px',
    color: 'var(--ant-color-primary-text)',
    lineHeight: '1.5'
  } as React.CSSProperties,
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--ant-color-border)',
    fontSize: '11px',
    color: 'var(--ant-color-text-tertiary)',
    textAlign: 'center',
    backgroundColor: 'var(--ant-color-bg-elevated)'
  } as React.CSSProperties
}

type NodeCategory = NodeDefinition['category']
const CATEGORIES: NodeCategory[] = [
  'input',
  'ai',
  'text',
  'image',
  'video',
  'fashion',
  'flow',
  'output',
  'external',
  'custom'
]

function NodePanel({ onCollapse }: NodePanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<NodeCategory>>(new Set())
  const [registryReady, setRegistryReady] = useState(() => NodeRegistryAdapter.isInitialized())
  const [customNodeBuilderVisible, setCustomNodeBuilderVisible] = useState(false)

  // 刷新节点列表（自定义节点保存后触发）
  const [, forceUpdate] = useState(0)
  const handleCustomNodeSaved = useCallback(() => {
    forceUpdate((n) => n + 1)
  }, [])

  // 确保节点注册系统已初始化
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

  // 按分类分组节点
  const groupedNodes = useMemo(() => {
    const groups: Record<NodeCategory, NodeDefinition[]> = {
      input: [],
      ai: [],
      image: [],
      video: [],
      flow: [],
      output: [],
      external: [],
      custom: [],
      text: [],
      fashion: [],
      quality: []
    }

    // 优先使用适配器获取所有节点，回退到旧系统
    let allNodeDefs: NodeDefinition[]
    try {
      // 尝试从适配器获取（包含现代注册系统的所有节点）
      const adapterNodes = NodeRegistryAdapter.getAllNodeTypes()
        .map((type) => NodeRegistryAdapter.getNodeDefinition(type))
        .filter(Boolean) as NodeDefinition[]

      if (adapterNodes.length > 0) {
        allNodeDefs = adapterNodes
      } else {
        // 仅在适配器未初始化时回退到旧系统
        // @deprecated NODE_REGISTRY 将在未来版本移除
        allNodeDefs = Object.values(NODE_REGISTRY)
      }
    } catch {
      // 初始化失败时的安全回退
      // @deprecated NODE_REGISTRY 将在未来版本移除
      allNodeDefs = Object.values(NODE_REGISTRY)
    }
    allNodeDefs.forEach((node) => {
      // 兼容新旧节点定义格式
      // 新格式: { metadata: { category, label, ... }, ... }
      // 旧格式: { category, label, ... }
      const nodeCategory = (node as any).metadata?.category || node.category
      const nodeLabel = (node as any).metadata?.label || node.label
      const nodeDescription = (node as any).metadata?.description || node.description || ''
      const nodeType = (node as any).metadata?.type || node.type

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (
          !nodeLabel.toLowerCase().includes(term) &&
          !nodeDescription.toLowerCase().includes(term) &&
          !nodeType.toLowerCase().includes(term)
        ) {
          return
        }
      }
      // 确保 category 存在于 groups 中
      if (groups[nodeCategory]) {
        groups[nodeCategory].push(node)
      }
    })

    return groups
  }, [searchTerm, registryReady])

  // 切换分类折叠
  const toggleCategory = useCallback((category: NodeCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // 拖拽开始 - 兼容新旧节点定义格式
  const onDragStart = useCallback((event: React.DragEvent, nodeDef: NodeDefinition) => {
    // 兼容现代格式 (metadata.type) 和旧格式 (type)
    const nodeType = (nodeDef as any).metadata?.type || nodeDef.type
    const nodeLabel = (nodeDef as any).metadata?.label || nodeDef.label
    const nodeCategory = (nodeDef as any).metadata?.category || nodeDef.category

    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: nodeType,
        label: nodeLabel,
        category: nodeCategory,
        backendType: nodeDef.backendType,
        defaultParams: nodeDef.defaultParams
      })
    )
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  // 计算节点总数
  const totalNodes = useMemo(() => {
    return Object.values(groupedNodes).reduce((sum, arr) => sum + arr.length, 0)
  }, [groupedNodes])

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Layers size={18} />
        </div>
        <span style={styles.headerTitle}>节点库</span>
        <Tooltip title="自定义节点">
          <button
            onClick={() => setCustomNodeBuilderVisible(true)}
            style={{
              marginLeft: 'auto',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--ant-color-text-tertiary)'
            }}>
            <Plus size={16} />
          </button>
        </Tooltip>
        {onCollapse && (
          <button
            onClick={onCollapse}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--ant-color-text-tertiary)'
            }}
            title="折叠节点库">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div style={styles.searchContainer as React.CSSProperties}>
        <Search size={14} style={styles.searchIcon as React.CSSProperties} />
        <input
          type="text"
          placeholder="搜索节点..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.list}>
        {CATEGORIES.map((category) => {
          const nodes = groupedNodes[category]
          if (nodes.length === 0) return null

          const isCollapsed = collapsedCategories.has(category)
          const categoryColor = getCategoryColor(category)

          return (
            <div key={category} style={styles.category}>
              <div
                style={styles.categoryHeader}
                onClick={() => toggleCategory(category)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--ant-color-fill-tertiary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}>
                <span style={{ ...styles.categoryDot, backgroundColor: categoryColor }} />
                <span style={{ flex: 1 }}>{getCategoryName(category)}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--ant-color-text-tertiary)',
                    marginRight: '4px'
                  }}>
                  {nodes.length}
                </span>
                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>

              {!isCollapsed && (
                <div style={{ marginTop: '4px' }}>
                  {nodes.map((nodeDef) => {
                    // 兼容新旧格式获取节点类型作为 key
                    const nodeKey = (nodeDef as any).metadata?.type || nodeDef.type
                    return (
                      <NodeItem
                        key={nodeKey}
                        nodeDef={nodeDef}
                        categoryColor={categoryColor}
                        onDragStart={onDragStart}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {totalNodes === 0 && <div style={styles.emptyState as React.CSSProperties}>没有找到匹配的节点</div>}
      </div>

      {/* 使用提示 */}
      <div style={styles.tip}>
        <div style={styles.tipHeader}>
          <Info size={12} />
          <span>Pro Tip</span>
        </div>
        <p style={styles.tipText as React.CSSProperties}>拖拽节点到画布上，然后连接输出端口到输入端口来传递数据。</p>
      </div>

      {/* 自定义节点构建器 */}
      <CustomNodeBuilder
        visible={customNodeBuilderVisible}
        onClose={() => setCustomNodeBuilderVisible(false)}
        onSave={handleCustomNodeSaved}
      />
    </div>
  )
}

/**
 * 节点项组件
 */
function NodeItem({
  nodeDef,
  categoryColor,
  onDragStart
}: {
  nodeDef: NodeDefinition
  categoryColor: string
  onDragStart: (event: React.DragEvent, nodeDef: NodeDefinition) => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  // 兼容新旧节点定义格式
  // 新格式: { metadata: { icon, label, description, ... }, ... }
  // 旧格式: { icon, label, description, ... }
  const nodeIcon = (nodeDef as any).metadata?.icon || nodeDef.icon
  const nodeLabel = (nodeDef as any).metadata?.label || nodeDef.label
  const nodeDescription = (nodeDef as any).metadata?.description || nodeDef.description || ''

  return (
    <div
      style={{
        ...styles.nodeItem,
        backgroundColor: isHovered ? 'var(--ant-color-fill-secondary)' : 'var(--ant-color-bg-elevated)',
        borderColor: isHovered ? categoryColor : 'transparent',
        transform: isHovered ? 'translateX(2px)' : 'none'
      }}
      draggable
      onDragStart={(e) => onDragStart(e, nodeDef)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <span
        style={{
          ...styles.nodeIcon,
          backgroundColor: `${categoryColor}15`
        }}>
        {nodeIcon}
      </span>
      <div style={styles.nodeInfo}>
        <div style={styles.nodeName}>{nodeLabel}</div>
        <div style={styles.nodeDesc}>{nodeDescription}</div>
      </div>

      {/* 后端类型标记 */}
      {nodeDef.backendType && <span style={styles.backendBadge}>后端</span>}

      {/* 添加图标 */}
      <Plus
        size={14}
        style={{
          ...styles.addIcon,
          opacity: isHovered ? 1 : 0
        }}
      />
    </div>
  )
}

export default memo(NodePanel)
