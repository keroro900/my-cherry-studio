/**
 * 配置面板组件
 * 显示选中节点的配置选项 - 支持折叠面板
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { removeNode, updateNode } from '@renderer/store/workflow'
import type { Provider } from '@renderer/types'
import { debounce } from 'lodash'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Info,
  Settings2,
  Sliders,
  Target,
  Trash2,
  X
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nodeRegistry } from '../../nodes/base/NodeRegistry'
import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { WorkflowNodeType } from '../../types'
import { type NodeDefinition, type NodeHandle } from '../../types'
import { IndexedDBImage } from '../common/IndexedDBImage'
import { AIModelConfigForm, configFormRegistry, DynamicConfigForm, ensureDefaultFormsRegistered } from '../ConfigForms'
import OutputPreviewModalPopup, { type OutputItem } from './OutputPreviewModal'

interface ConfigPanelProps {
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
  text: 'var(--ant-color-cyan, #13c2c2)'
}

function getCategoryColor(category: NodeDefinition['category']): string {
  return CATEGORY_COLORS[category] || 'var(--ant-color-text-tertiary)'
}

// 辅助函数：检测是否为图片字符串（base64 或 URL）- 移到组件外部避免重复创建
function isImageString(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  return (
    str.startsWith('data:image/') ||
    str.startsWith('indexeddb://') ||
    str.startsWith('file://') ||
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    // 检测文件路径（包含图片扩展名）
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(str)
  )
}

// 辅助函数：兼容新旧节点定义格式
// 新格式: { metadata: { category, label, icon, description }, ... }
// 旧格式: { category, label, icon, description, ... }
function getNodeDefProperty<K extends keyof NodeDefinition>(nodeDef: any, key: K): NodeDefinition[K] | undefined {
  // 优先从 metadata 读取（新格式）
  if (nodeDef.metadata && nodeDef.metadata[key] !== undefined) {
    return nodeDef.metadata[key]
  }
  // 回退到直接属性（旧格式）
  return nodeDef[key]
}

// 辅助函数：获取节点的 configSchema（从新系统）
function getNodeConfigSchema(nodeType: string): any | null {
  try {
    const modernNode = nodeRegistry.get(nodeType)
    if (modernNode?.configSchema) {
      return modernNode.configSchema
    }
  } catch {
    // ignore
  }
  return null
}

// 折叠面板组件
interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string | number
}

function CollapsibleSection({ title, icon, defaultOpen = true, children, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        marginBottom: '12px',
        borderRadius: '8px',
        border: '1px solid var(--ant-color-border)',
        overflow: 'hidden',
        backgroundColor: 'var(--ant-color-bg-container)'
      }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
          backgroundColor: 'var(--ant-color-bg-elevated)',
          borderBottom: isOpen ? '1px solid var(--ant-color-border)' : 'none',
          transition: 'background-color 0.2s',
          userSelect: 'none'
        }}>
        {icon && <span style={{ color: 'var(--ant-color-text-secondary)' }}>{icon}</span>}
        <span
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ant-color-text)'
          }}>
          {title}
        </span>
        {badge !== undefined && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 500,
              backgroundColor: 'var(--ant-color-fill-secondary)',
              color: 'var(--ant-color-text-secondary)'
            }}>
            {badge}
          </span>
        )}
        <span style={{ color: 'var(--ant-color-text-tertiary)' }}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
      {isOpen && <div style={{ padding: '12px' }}>{children}</div>}
    </div>
  )
}

const styles = {
  panel: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--ant-color-bg-container)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } as React.CSSProperties,
  header: {
    height: '56px',
    padding: '0 16px',
    borderBottom: '1px solid var(--ant-color-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    flexShrink: 0
  } as React.CSSProperties,
  headerIcon: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontSize: '18px'
  } as React.CSSProperties,
  headerInfo: {
    flex: 1,
    minWidth: 0
  } as React.CSSProperties,
  headerTitle: {
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--ant-color-text)',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as React.CSSProperties,
  headerDesc: {
    fontSize: '11px',
    color: 'var(--ant-color-text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as React.CSSProperties,
  closeBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--ant-color-text-tertiary)',
    transition: 'all 0.2s',
    border: 'none',
    background: 'none'
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px'
  } as React.CSSProperties,
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    color: 'var(--ant-color-text-tertiary)'
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--ant-color-border)',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    color: 'var(--ant-color-text)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s'
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--ant-color-border)',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    color: 'var(--ant-color-text)',
    fontSize: '13px',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit'
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--ant-color-text-secondary)'
  } as React.CSSProperties,
  section: {
    marginBottom: '16px'
  } as React.CSSProperties,
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--ant-color-border)',
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  } as React.CSSProperties,
  deleteBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid var(--ant-color-error)',
    backgroundColor: 'transparent',
    color: 'var(--ant-color-error)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  } as React.CSSProperties,
  outputPreview: {
    backgroundColor: 'var(--ant-color-bg-elevated)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid var(--ant-color-border)'
  } as React.CSSProperties,
  outputImage: {
    width: '100%',
    borderRadius: '6px',
    maxHeight: '200px',
    objectFit: 'contain'
  } as React.CSSProperties,
  outputText: {
    fontSize: '11px',
    color: 'var(--ant-color-text)',
    fontFamily: 'ui-monospace, monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '150px',
    overflow: 'auto'
  } as React.CSSProperties
}

/**
 * 配置面板
 */
function ConfigPanel({ onCollapse }: ConfigPanelProps) {
  const dispatch = useAppDispatch()

  // 拆分选择器，减少不必要的重渲染
  const selectedNodeId = useAppSelector((state) => state.workflow.selectedNodeId)
  // 只选择选中的节点，而不是整个 nodes 数组
  const selectedNode = useAppSelector((state) => {
    const nodes = state.workflow.nodes
    return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined
  })
  // 只选择选中节点的结果
  const nodeOutput = useAppSelector((state) => {
    return selectedNodeId ? state.workflow.nodeResults?.[selectedNodeId] : undefined
  })
  const llmProviders = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]
  const [registryReady, setRegistryReady] = useState(() => NodeRegistryAdapter.isInitialized())

  // 确保配置表单注册表已初始化
  useEffect(() => {
    ensureDefaultFormsRegistered()
  }, [])

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

  const nodeDef = useMemo(
    () =>
      selectedNode && selectedNode.data.nodeType
        ? NodeRegistryAdapter.getNodeDefinition(selectedNode.data.nodeType as WorkflowNodeType)
        : null,
    [selectedNode?.data?.nodeType, selectedNode]
  )

  // 支持单个 key-value 或批量更新 (传入对象)
  const handleUpdateConfig = useCallback(
    (keyOrUpdates: string | Record<string, any>, value?: any) => {
      if (!selectedNodeId) return

      // 支持两种调用方式：
      // 1. handleUpdateConfig('key', value) - 单个更新
      // 2. handleUpdateConfig({ key1: value1, key2: value2 }) - 批量更新
      const updates = typeof keyOrUpdates === 'string' ? { [keyOrUpdates]: value } : keyOrUpdates

      const newConfig = {
        ...selectedNode?.data.config,
        ...updates
      }

      // 检查是否需要同步更新 inputs
      let newInputs: NodeHandle[] | undefined

      // 【重要】检查顺序很重要！
      // 1. inputPorts 优先：直接使用（用于 RunningHub 等外部服务节点，完全替换）
      // 2. imageInputPorts：与静态端口合并（用于普通动态图片输入节点）
      // 3. imageInputCount：根据数量生成
      if ('inputPorts' in updates && Array.isArray(updates.inputPorts)) {
        // 用于 RunningHub 等外部服务节点：直接使用 inputPorts 作为 inputs（不与静态端口合并）
        newInputs = updates.inputPorts
      } else if ('imageInputPorts' in updates && Array.isArray(updates.imageInputPorts)) {
        // 获取节点定义中的静态输入端口
        const staticInputs = (nodeDef as any)?.inputs || (nodeDef as any)?.defaultInputs || []
        // 过滤掉静态输入中的图片类型端口（将被动态端口替换）
        const nonImageStaticInputs = staticInputs.filter(
          (input: NodeHandle) => input.dataType !== 'image' || input.id === 'promptJson'
        )
        // 合并动态端口和非图片静态端口
        newInputs = [...updates.imageInputPorts, ...nonImageStaticInputs]
      } else if ('imageInputCount' in updates && typeof updates.imageInputCount === 'number') {
        // 简单数量模式：根据数量生成动态端口
        const dynamicInputs: NodeHandle[] = []
        for (let i = 1; i <= updates.imageInputCount; i++) {
          dynamicInputs.push({
            id: `image_${i}`,
            label: `图片 ${i}`,
            dataType: 'image',
            required: false
          })
        }
        // 获取静态非图片端口
        const staticInputs = (nodeDef as any)?.inputs || (nodeDef as any)?.defaultInputs || []
        const nonImageStaticInputs = staticInputs.filter(
          (input: NodeHandle) => !input.id.startsWith('image_') && input.dataType !== 'image'
        )
        newInputs = [...dynamicInputs, ...nonImageStaticInputs]
      }

      // 执行更新
      dispatch(
        updateNode({
          id: selectedNodeId,
          data: {
            config: newConfig,
            ...(newInputs ? { inputs: newInputs } : {})
          }
        })
      )
    },
    [dispatch, selectedNodeId, selectedNode?.data.config, nodeDef]
  )

  // 防抖版本的配置更新 - 用于文本输入等频繁触发的场景
  // 300ms 防抖避免频繁 Redux dispatch
  const debouncedUpdateConfigRef = useRef<ReturnType<typeof debounce> | null>(null)

  // 创建防抖函数
  const debouncedUpdateConfig = useMemo(() => {
    // 清理旧的防抖函数
    if (debouncedUpdateConfigRef.current) {
      debouncedUpdateConfigRef.current.cancel()
    }
    const debouncedFn = debounce((keyOrUpdates: string | Record<string, any>, value?: any) => {
      handleUpdateConfig(keyOrUpdates, value)
    }, 300)
    debouncedUpdateConfigRef.current = debouncedFn
    return debouncedFn
  }, [handleUpdateConfig])

  // 组件卸载或节点切换时取消待执行的防抖
  useEffect(() => {
    return () => {
      if (debouncedUpdateConfigRef.current) {
        debouncedUpdateConfigRef.current.cancel()
      }
    }
  }, [selectedNodeId])

  const handleUpdateLabel = useCallback(
    (label: string) => {
      if (!selectedNodeId) return
      dispatch(updateNode({ id: selectedNodeId, data: { label } }))
    },
    [dispatch, selectedNodeId]
  )

  const handleUpdateModel = useCallback(
    (providerId: string, modelId: string) => {
      if (!selectedNodeId) return
      dispatch(updateNode({ id: selectedNodeId, data: { providerId, modelId } }))
    },
    [dispatch, selectedNodeId]
  )

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return
    dispatch(removeNode(selectedNodeId))
  }, [dispatch, selectedNodeId])

  // 未选中节点时显示提示
  if (!selectedNode || !nodeDef) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <Settings2 size={18} style={{ color: 'var(--ant-color-text-secondary)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>节点配置</span>
          {onCollapse && (
            <button style={styles.closeBtn} onClick={onCollapse} title="折叠面板">
              <ChevronRight size={16} />
            </button>
          )}
        </div>
        <div style={styles.emptyState}>
          <Target size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>点击选中节点</div>
            <div style={{ fontSize: '12px' }}>查看和编辑节点配置</div>
          </div>
        </div>
      </div>
    )
  }

  // 兼容新旧格式获取节点属性
  const nodeCategory = getNodeDefProperty(nodeDef, 'category') || 'custom'
  const nodeIcon = getNodeDefProperty(nodeDef, 'icon')
  const nodeDescription = getNodeDefProperty(nodeDef, 'description')

  const categoryColor = getCategoryColor(nodeCategory)
  const nodeType = selectedNode.data.nodeType || selectedNode.data.type || ''
  const isAINode = nodeCategory === 'ai'
  const isVideoNode = nodeCategory === 'video'
  const hasBackendType = !!(nodeDef as any).backendType

  // 渲染输出预览
  const renderOutputPreview = () => {
    if (!nodeOutput || nodeOutput.status !== 'success') return null

    // outputs 是 Record<string, any>，包含各个输出端口的值
    const outputs = nodeOutput.outputs || {}

    // 收集所有图片输出（支持多图）
    const allImages: string[] = []

    // 1. 收集 images 数组
    if (Array.isArray(outputs.images)) {
      allImages.push(...outputs.images.filter((img: any) => typeof img === 'string' && isImageString(img)))
    }
    // 收集 all_images，但需要去重（避免与 images 重复）
    if (Array.isArray(outputs.all_images)) {
      outputs.all_images
        .filter((img: any) => typeof img === 'string' && isImageString(img) && !allImages.includes(img))
        .forEach((img: string) => allImages.push(img))
    }

    // 2. 收集单图输出
    if (outputs.image && typeof outputs.image === 'string' && isImageString(outputs.image) && !allImages.includes(outputs.image)) {
      allImages.push(outputs.image)
    }
    if (outputs.output_image && typeof outputs.output_image === 'string' && isImageString(outputs.output_image) && !allImages.includes(outputs.output_image)) {
      allImages.push(outputs.output_image)
    }

    // 3. 收集动态端口的图片输出 (image_1, image_2, ...)
    Object.keys(outputs).forEach((key) => {
      if (key.match(/^image_\d+$/) && typeof outputs[key] === 'string' && isImageString(outputs[key]) && !allImages.includes(outputs[key])) {
        allImages.push(outputs[key])
      }
    })

    // 收集所有文本/JSON 输出到列表（用于模态框显示）
    const textOutputs: OutputItem[] = []
    const textOutputKeyLabels: Record<string, string> = {
      text: '文本输出',
      output_text: '输出文本',
      result: '结果',
      caption: '描述',
      promptJson: '提示词 JSON',
      modelPromptJson: '模型提示词'
    }

    for (const [key, label] of Object.entries(textOutputKeyLabels)) {
      if (outputs[key] !== undefined) {
        const value = outputs[key]
        let content: string
        let type: 'json' | 'text'

        if (typeof value === 'string') {
          content = value
          type = 'text'
        } else {
          content = JSON.stringify(value, null, 2)
          type = 'json'
        }

        textOutputs.push({ key, label, content, type })
      }
    }

    const hasImages = allImages.length > 0
    const hasTextOutputs = textOutputs.length > 0

    if (!hasImages && !hasTextOutputs) return null

    // 打开文本预览模态框
    const handleOpenTextPreview = () => {
      OutputPreviewModalPopup.show({
        outputs: textOutputs,
        title: '输出详情'
      })
    }

    return (
      <CollapsibleSection
        title="最近输出"
        icon={<CheckCircle2 size={14} style={{ color: 'var(--ant-color-success)' }} />}
        defaultOpen={true}
        badge={hasImages ? `${allImages.length} 张图片` : undefined}>
        <div style={styles.outputPreview}>
          {/* 显示所有图片（网格布局） */}
          {hasImages && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: allImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '8px',
                marginBottom: hasTextOutputs ? '12px' : 0
              }}>
              {allImages.slice(0, 12).map((imgUrl, idx) => (
                <IndexedDBImage
                  key={`${imgUrl}-${idx}`}
                  src={
                    imgUrl.startsWith('data:') ||
                    imgUrl.startsWith('indexeddb://') ||
                    imgUrl.startsWith('file://') ||
                    imgUrl.startsWith('http')
                      ? imgUrl
                      : `file://${imgUrl}`
                  }
                  alt={`Output ${idx + 1}`}
                  style={{
                    ...styles.outputImage,
                    maxHeight: allImages.length === 1 ? '200px' : '100px',
                    width: '100%'
                  }}
                />
              ))}
              {allImages.length > 12 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--ant-color-bg-elevated)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--ant-color-text-secondary)',
                    minHeight: '60px'
                  }}>
                  +{allImages.length - 12} 张
                </div>
              )}
            </div>
          )}

          {/* 文本输出：显示按钮打开模态框 */}
          {hasTextOutputs && (
            <button
              onClick={handleOpenTextPreview}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                border: '1px solid var(--ant-color-border)',
                borderRadius: '8px',
                backgroundColor: 'var(--ant-color-bg-elevated)',
                color: 'var(--ant-color-text)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ant-color-primary)'
                e.currentTarget.style.backgroundColor = 'var(--ant-color-primary-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--ant-color-border)'
                e.currentTarget.style.backgroundColor = 'var(--ant-color-bg-elevated)'
              }}>
              <FileText size={16} />
              <span>查看输出详情</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  backgroundColor: 'var(--ant-color-fill-secondary)',
                  color: 'var(--ant-color-text-secondary)'
                }}>
                {textOutputs.length}
              </span>
            </button>
          )}

          {nodeOutput.duration && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: 'var(--ant-color-text-tertiary)'
              }}>
              耗时: {nodeOutput.duration}ms
            </div>
          )}
        </div>
      </CollapsibleSection>
    )
  }

  return (
    <div style={styles.panel}>
      {/* 头部 */}
      <div style={styles.header}>
        <span
          style={{
            ...styles.headerIcon,
            backgroundColor: `${categoryColor}20`
          }}>
          {nodeIcon}
        </span>
        <div style={styles.headerInfo}>
          <div style={styles.headerTitle}>{selectedNode.data.label}</div>
          <div style={styles.headerDesc}>{nodeDescription}</div>
        </div>
        <button style={styles.closeBtn} onClick={() => dispatch(updateNode({ id: '', data: {} }))} title="取消选中">
          <X size={16} />
        </button>
        {onCollapse && (
          <button style={styles.closeBtn} onClick={onCollapse} title="折叠面板">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* 内容区 */}
      <div style={styles.content}>
        {/* 基本信息 */}
        <CollapsibleSection title="基本信息" icon={<Info size={14} />} defaultOpen={true}>
          <div style={styles.section}>
            <label style={styles.label}>节点名称</label>
            <input
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => handleUpdateLabel(e.target.value)}
              style={styles.input}
            />
          </div>
        </CollapsibleSection>

        {/* 输出预览 - 放在配置前面更醒目 */}
        {renderOutputPreview()}

        {/* 节点配置 */}
        <CollapsibleSection title="节点配置" icon={<Sliders size={14} />} defaultOpen={true} badge={nodeType}>
          {/* 使用注册表模式渲染配置表单 */}
          {(() => {
            // 1. 首先尝试从配置表单注册表获取
            const RegisteredForm = configFormRegistry.getForm(nodeType)
            if (RegisteredForm) {
              return (
                <RegisteredForm
                  key={selectedNodeId}
                  nodeType={nodeType}
                  config={selectedNode.data.config || {}}
                  providerId={selectedNode.data.providerId}
                  modelId={selectedNode.data.modelId}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdateModel={handleUpdateModel}
                  onInputsChange={(inputs) => {
                    // 只更新 inputs，不影响 outputs
                    if (selectedNodeId) {
                      dispatch(updateNode({ id: selectedNodeId, data: { inputs: inputs as NodeHandle[] } }))
                    }
                  }}
                  onOutputsChange={(outputs) => {
                    // 只更新 outputs，不影响 inputs
                    if (selectedNodeId) {
                      dispatch(updateNode({ id: selectedNodeId, data: { outputs } }))
                    }
                  }}
                />
              )
            }

            // 2. 检查 configSchema（现代节点使用动态表单）
            const configSchema = getNodeConfigSchema(nodeType)
            if (configSchema) {
              return (
                <>
                  {/* AI 节点添加模型选择器 */}
                  {isAINode && (
                    <AIModelConfigForm
                      providerId={selectedNode.data.providerId}
                      modelId={selectedNode.data.modelId}
                      providers={llmProviders}
                      onModelChange={handleUpdateModel}
                    />
                  )}
                  <DynamicConfigForm
                    configSchema={configSchema}
                    config={selectedNode.data.config || {}}
                    onUpdateConfig={handleUpdateConfig}
                    onDebouncedUpdateConfig={debouncedUpdateConfig}
                    providerId={selectedNode.data.providerId}
                    modelId={selectedNode.data.modelId}
                    onUpdateModel={handleUpdateModel}
                  />
                </>
              )
            }

            // 3. AI 节点的通用配置回退
            if (isAINode) {
              return (
                <>
                  <AIModelConfigForm
                    providerId={selectedNode.data.providerId}
                    modelId={selectedNode.data.modelId}
                    providers={llmProviders}
                    onModelChange={handleUpdateModel}
                  />
                  <div style={styles.section}>
                    <label style={styles.label}>系统提示词</label>
                    <textarea
                      value={selectedNode.data.config?.systemPrompt || ''}
                      onChange={(e) => debouncedUpdateConfig('systemPrompt', e.target.value)}
                      placeholder="设置 AI 的角色和行为..."
                      style={styles.textarea}
                    />
                  </div>
                  <div style={styles.section}>
                    <label style={styles.label}>用户提示词</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ''}
                      onChange={(e) => debouncedUpdateConfig('prompt', e.target.value)}
                      placeholder="输入具体的指令..."
                      style={styles.textarea}
                    />
                  </div>
                  <div style={styles.section}>
                    <label style={styles.label}>Temperature: {selectedNode.data.config?.temperature ?? 0.7}</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedNode.data.config?.temperature ?? 0.7}
                      onChange={(e) => handleUpdateConfig('temperature', parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )
            }

            // 4. 视频节点的通用配置回退
            if (isVideoNode) {
              return (
                <>
                  <div style={styles.section}>
                    <label style={styles.label}>视频时长</label>
                    <select
                      value={selectedNode.data.config?.duration || 5}
                      onChange={(e) => handleUpdateConfig('duration', parseInt(e.target.value))}
                      style={styles.input}>
                      <option value={5}>5 秒</option>
                      <option value={10}>10 秒</option>
                    </select>
                  </div>
                  <div style={styles.section}>
                    <label style={styles.label}>宽高比</label>
                    <select
                      value={selectedNode.data.config?.aspectRatio || '16:9'}
                      onChange={(e) => handleUpdateConfig('aspectRatio', e.target.value)}
                      style={styles.input}>
                      <option value="16:9">16:9 (横屏)</option>
                      <option value="9:16">9:16 (竖屏)</option>
                      <option value="1:1">1:1 (方形)</option>
                    </select>
                  </div>
                </>
              )
            }

            // 5. 最终回退 - 无配置支持
            return (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>
                该节点暂不支持配置
              </div>
            )
          })()}
        </CollapsibleSection>

        {/* 高级配置 */}
        {hasBackendType && (
          <CollapsibleSection title="高级配置" icon={<Settings2 size={14} />} defaultOpen={false}>
            <div style={styles.section}>
              <label style={styles.label}>重试次数</label>
              <input
                type="number"
                min="0"
                max="5"
                value={selectedNode.data.retry || 0}
                onChange={(e) =>
                  dispatch(
                    updateNode({
                      id: selectedNodeId!,
                      data: { retry: parseInt(e.target.value) || 0 }
                    })
                  )
                }
                style={styles.input}
              />
            </div>
            <div style={styles.section}>
              <label style={styles.label}>超时时间 (秒)</label>
              <input
                type="number"
                min="0"
                value={selectedNode.data.timeout || ''}
                onChange={(e) =>
                  dispatch(
                    updateNode({
                      id: selectedNodeId!,
                      data: { timeout: parseInt(e.target.value) || undefined }
                    })
                  )
                }
                placeholder="无限制"
                style={styles.input}
              />
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* 底部操作 */}
      <div style={styles.footer}>
        <button style={styles.deleteBtn} onClick={handleDeleteNode}>
          <Trash2 size={14} />
          删除节点
        </button>
      </div>
    </div>
  )
}

export default memo(ConfigPanel)
