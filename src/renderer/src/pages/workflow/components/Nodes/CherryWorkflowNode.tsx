/**
 * Cherry Studio 风格的工作流节点组件
 *
 * 设计原则：
 * 1. 完全使用 Cherry 的 CSS 变量系统
 * 2. 遵循 Cherry 的简约设计语言
 * 3. 使用 styled-components（Cherry 风格）
 * 4. 简单优雅的交互，不要过度动画
 * 5. 完全跟随 Cherry 的明暗主题
 * 6. 支持动态图片输入端口
 */

import { type NodeProps,NodeResizer } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { useEffect, useState } from 'react'
import styled from 'styled-components'

import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { NodeHandle, WorkflowNodeData } from '../../types'
import DynamicHandles from './DynamicHandles'
import { normalizeOutputPreviewData } from './OutputNode'

// ==================== 节点图标映射 ====================

const NODE_ICONS: Record<string, string> = {
  // 输入节点
  image_input: '🖼️',
  text_input: '📝',
  file_input: '📁',

  // AI 节点
  unified_prompt: '🧠',
  video_prompt: '🎬',

  // Gemini 图片处理
  gemini_edit: '✂️',
  gemini_edit_custom: '🎨',
  gemini_generate: '✨',
  gemini_generate_model: '👤',
  gemini_model_from_clothes: '👚',
  gemini_ecom: '🛍️',
  gemini_pattern: '🎭',

  // 行业摄影节点
  jewelry_photo: '💎',
  food_photo: '🍽️',
  product_scene: '🏞️',
  jewelry_tryon: '💍',

  // 图片操作
  compare_image: '⚖️',

  // 视频
  kling_image2video: '🎬',

  // 外部服务
  runninghub_app: '👗',

  // 流程控制
  condition: '🔀',
  subflow: '📦',

  // 高级节点 - List
  image_list: '📋',
  text_list: '📝',
  list_merge: '🔀',
  list_filter: '🔍',

  // 高级节点 - Pipe
  pipe: '🚰',
  pipe_router: '🔀',
  pipe_merger: '🔗',

  // 高级节点 - Switch
  switch: '🔀',
  multi_switch: '🎚️',

  // 高级节点 - Loop
  loop: '🔁',
  loop_index: '🔢',
  loop_list: '📋',

  // 输出
  output: '📤'
}

// ==================== 状态配置 ====================

const STATUS_CONFIG = {
  idle: { text: '就绪', icon: '○' },
  running: { text: '运行中', icon: '⟳' },
  success: { text: '完成', icon: '✓' },
  completed: { text: '完成', icon: '✓' },
  error: { text: '错误', icon: '✗' },
  skipped: { text: '跳过', icon: '—' }
}

// ==================== 支持动态图片输入的节点类型 ====================
// 这些节点支持通过 config.imageInputPorts 自定义输入端口配置
// gemini_ecom：通过 enableBack 动态添加背面图端口，不使用 imageInputCount

const DYNAMIC_IMAGE_INPUT_NODES = [
  'gemini_generate',
  'gemini_generate_model',
  'gemini_model_from_clothes',
  'gemini_ecom',
  'gemini_pattern',
  'gemini_edit',
  'gemini_edit_custom',
  'kling_image2video',
  'compare_image',
  'runninghub_app',
  // 行业摄影节点
  'jewelry_photo',
  'food_photo',
  'product_scene',
  'jewelry_tryon',
  'eyewear_tryon',
  'footwear_display',
  'cosmetics_photo',
  'furniture_scene',
  'electronics_photo',
  // 文本/内容节点
  'aplus_content',
  'product_description'
]

// ==================== 生成动态图片输入端口 ====================

function generateDynamicImageInputs(imageInputCount: number): NodeHandle[] {
  const inputs: NodeHandle[] = []
  for (let i = 1; i <= imageInputCount; i++) {
    inputs.push({
      id: `image_${i}`,
      label: `图片 ${i}`,
      dataType: 'image',
      required: false
    })
  }
  return inputs
}

// ==================== Cherry 风格节点组件 ====================

function CherryWorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData
  const status = nodeData.status || 'idle'
  const statusInfo = STATUS_CONFIG[status]
  const nodeType = nodeData.nodeType || 'ai'
  const icon = NODE_ICONS[nodeType] || '🧠'

  // 是否为输出节点 - 使用简化显示
  const isOutputNode = nodeType === 'output'
  const [previewError, setPreviewError] = useState(false)
  useEffect(() => {
    setPreviewError(false)
  }, [nodeData.result])

  // URL 转换函数
  const toDisplayableUrl = (src?: string): string | null => {
    if (!src || typeof src !== 'string') return null
    if (src.startsWith('data:image') || src.startsWith('data:video')) return src
    if (src.startsWith('http://') || src.startsWith('https://')) return src
    if (src.startsWith('file://')) return src
    if (/^[A-Za-z]:\\/.test(src)) {
      return 'file:///' + src.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, '$1:/')
    }
    if (src.startsWith('\\')) {
      return 'file:' + src.replace(/\\/g, '/')
    }
    return null
  }

  // 获取动态图片输入端口数量
  const imageInputCount = nodeData.config?.imageInputCount ?? 0
  // 获取自定义输入端口配置（优先级高于默认生成）
  // RunningHub 使用 inputPorts，其他节点使用 imageInputPorts
  const customImageInputPorts = (nodeData.config?.imageInputPorts || nodeData.config?.inputPorts) as NodeHandle[] | undefined
  const supportsDynamicImageInputs = DYNAMIC_IMAGE_INPUT_NODES.includes(nodeType)

  // 合并静态输入端口和动态图片输入端口
  const effectiveInputs = useMemo(() => {
    const staticInputs = nodeData.inputs || []

    // 获取节点定义中的非图片静态输入端口（如 prompt, promptJson）
    // 这些端口应该始终显示，即使 imageInputCount 为 0
    const getDefinitionNonImageInputs = (): NodeHandle[] => {
      const nodeDef = NodeRegistryAdapter.getNodeDefinition(nodeType)
      if (!nodeDef) return []

      // 支持新格式 (inputs) 和旧格式 (defaultInputs)
      const defInputs = (nodeDef as any).inputs || (nodeDef as any).defaultInputs || []

      // 过滤出非图片类型的输入端口
      return defInputs
        .filter(
          (input: any) =>
            input.dataType !== 'image' && !input.id.startsWith('image_') && !input.id.startsWith('reference_')
        )
        .map((input: any) => ({
          id: input.id,
          label: input.label,
          dataType: input.dataType,
          required: input.required ?? false,
          multiple: input.multiple,
          description: input.description
        }))
    }

    // RunningHub 等外部服务节点：优先使用 config.inputPorts（保存的动态端口配置）
    // 因为工作流加载时，config.inputPorts 包含用户从 API 获取的端口信息
    // 只有当 config.inputPorts 为空时，才回退到 staticInputs（默认端口）
    if (nodeType === 'runninghub_app') {
      // 优先使用保存的动态端口配置
      if (customImageInputPorts && customImageInputPorts.length > 0) {
        return customImageInputPorts
      }
      // 如果没有动态端口，使用 nodeData.inputs（可能已被 onInputsChange 更新）
      if (staticInputs.length > 0) {
        return staticInputs
      }
      // 最后回退到节点定义中的默认端口
      return getDefinitionNonImageInputs()
    }

    // 如果有自定义输入端口配置，优先使用（不与静态输入合并，避免重复）
    // 其他动态节点使用此模式：config.inputPorts 或 config.imageInputPorts
    if (supportsDynamicImageInputs && customImageInputPorts && customImageInputPorts.length > 0) {
      // 直接使用自定义端口配置，它应该已经包含所有需要的端口
      return customImageInputPorts
    }

    // 如果支持动态图片输入但没有自定义配置，使用默认生成逻辑
    if (supportsDynamicImageInputs && imageInputCount > 0) {
      const dynamicInputs = generateDynamicImageInputs(imageInputCount)

      // 对于 gemini_model_from_clothes，用动态图片输入替换 clothesImage
      // 将第一个动态输入标记为"服装图片"并设为必填
      if (nodeType === 'gemini_model_from_clothes') {
        // 过滤掉静态的 clothesImage 输入，保留其他输入（如 promptJson）
        const nonImageStatic = staticInputs.filter((input) => input.dataType !== 'image')
        // 第一个动态输入改为"服装图片"
        if (dynamicInputs.length > 0) {
          dynamicInputs[0].label = '服装图片'
          dynamicInputs[0].required = true
        }
        return [...dynamicInputs, ...nonImageStatic]
      }

      // 其他节点：过滤掉静态输入中已有的 image_ 开头的输入，避免重复
      const filteredStatic = staticInputs.filter((input) => !input.id.startsWith('image_') || input.id === 'image')
      return [...filteredStatic, ...dynamicInputs]
    }

    // 对于支持动态输入的节点，当 imageInputCount 为 0 且没有自定义端口时
    if (supportsDynamicImageInputs && imageInputCount === 0) {
      // 只显示非图片的静态端口（如 prompt, promptJson）
      const existingNonImage = staticInputs.filter(
        (input) => input.dataType !== 'image' && !input.id.startsWith('image_') && !input.id.startsWith('reference_')
      )

      // 如果已有非图片端口，直接返回
      if (existingNonImage.length > 0) {
        return existingNonImage
      }

      // 否则从节点定义中获取
      const defNonImageInputs = getDefinitionNonImageInputs()
      if (defNonImageInputs.length > 0) {
        return defNonImageInputs
      }
    }

    return staticInputs
  }, [nodeData.inputs, imageInputCount, customImageInputPorts, supportsDynamicImageInputs, nodeType])

  // 输出节点使用简化显示
  if (isOutputNode) {
    return (
      <OutputNodeContainer className={selected ? 'selected' : ''} data-status={status}>
        {/* 节点缩放器 - 只在选中时显示 */}
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={80}
          lineStyle={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}
          handleStyle={{ backgroundColor: 'var(--color-primary)', width: 8, height: 8 }}
        />

        {/* 动态 Handles */}
        <DynamicHandles inputs={effectiveInputs} outputs={nodeData.outputs || []} showLabels={selected} />

        {/* 简化的节点内容 */}
        <OutputNodeContent>
          <OutputNodeIcon>{icon}</OutputNodeIcon>
          <OutputNodeTitle>{nodeData.label}</OutputNodeTitle>
          <OutputNodeStatus data-status={status}>
            {status === 'running' && <SpinIcon>{statusInfo.icon}</SpinIcon>}
            {status !== 'running' && statusInfo.icon}
          </OutputNodeStatus>
        </OutputNodeContent>

        {/* 输出方式提示 */}
        {nodeData.config?.outputType && (
          <OutputTypeHint>
            {nodeData.config.outputType === 'file' && '💾 保存文件'}
            {nodeData.config.outputType === 'display' && '👁️ 显示预览'}
            {nodeData.config.outputType === 'download' && '⬇️ 下载'}
          </OutputTypeHint>
        )}

        {/* 预览框（显示预览模式） */}
        {nodeData.config?.outputType === 'display' && (
          <PreviewBox>
            {(() => {
              const { images, videos, text } = normalizeOutputPreviewData(nodeData.result)
              const firstImage = Array.isArray(images) ? images[0] : undefined
              const firstVideo = Array.isArray(videos) ? videos[0] : undefined
              const imgUrl = toDisplayableUrl(firstImage)
              const vidUrl = toDisplayableUrl(firstVideo)
              if (!previewError && imgUrl) {
                return (
                  <img
                    src={imgUrl}
                    alt="preview"
                    onError={() => setPreviewError(true)}
                    title={imgUrl}
                  />
                )
              }
              if (!previewError && vidUrl) {
                return (
                  <video
                    src={vidUrl}
                    controls
                    onError={() => setPreviewError(true)}
                  />
                )
              }
              if (text) {
                return (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-3)',
                      padding: 6,
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap'
                    }}>
                    {typeof text === 'string'
                      ? text.length > 200
                        ? text.slice(0, 200) + '…'
                        : text
                      : JSON.stringify(text, null, 2).slice(0, 200)}
                  </div>
                )
              }
              return <Placeholder>🖼️ 预览</Placeholder>
            })()}
          </PreviewBox>
        )}
      </OutputNodeContainer>
    )
  }

  return (
    <NodeContainer className={selected ? 'selected' : ''} data-status={status}>
      {/* 节点缩放器 - 只在选中时显示 */}
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={100}
        lineStyle={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}
        handleStyle={{ backgroundColor: 'var(--color-primary)', width: 8, height: 8 }}
      />

      {/* 动态 Handles */}
      <DynamicHandles inputs={effectiveInputs} outputs={nodeData.outputs || []} showLabels={selected} />

      {/* 节点头部 */}
      <NodeHeader>
        <NodeIcon>{icon}</NodeIcon>
        <NodeTitle>{nodeData.label}</NodeTitle>
        <StatusIndicator data-status={status}>
          {status === 'running' && <SpinIcon>{statusInfo.icon}</SpinIcon>}
          {status !== 'running' && statusInfo.icon}
        </StatusIndicator>
      </NodeHeader>

      {/* 节点内容 */}
      <NodeContent>
        {/* 节点类型标签 */}
        <NodeTypeBadge>{nodeData.type || nodeType}</NodeTypeBadge>

        {/* AI 模型信息 */}
        {nodeData.providerId && (
          <ModelInfo>
            <ModelIcon>🤖</ModelIcon>
            <ModelText>{nodeData.providerId}</ModelText>
          </ModelInfo>
        )}

        {nodeData.modelId && <ModelSubtext>{nodeData.modelId}</ModelSubtext>}

        {/* 动态图片输入端口信息 */}
        {supportsDynamicImageInputs && imageInputCount > 0 && (
          <ImageInputInfo>📷 {imageInputCount} 个图片输入</ImageInputInfo>
        )}

        {/* Unified Prompt 特殊显示 */}
        {nodeType === 'unified_prompt' && nodeData.config && (
          <>
            {nodeData.config.styleMode && (
              <ConfigBadge>{nodeData.config.styleMode === 'commercial' ? '📸 商拍感' : '📱 日常感'}</ConfigBadge>
            )}
            {nodeData.config.ageGroup && (
              <ConfigText>
                {nodeData.config.ageGroup === 'small_kid' && '👶 小童'}
                {nodeData.config.ageGroup === 'big_kid' && '🧒 大童'}
                {nodeData.config.ageGroup === 'adult' && '👤 成人'}
                {nodeData.config.gender === 'male' && ' / 男'}
                {nodeData.config.gender === 'female' && ' / 女'}
              </ConfigText>
            )}
          </>
        )}
      </NodeContent>

      {/* 状态栏 */}
      <NodeFooter data-status={status}>
        <StatusText>{statusInfo.text}</StatusText>
      </NodeFooter>

      {/* 错误信息 */}
      {(nodeData.error || nodeData.errorMessage) && (
        <ErrorBox>
          <ErrorTitle>错误</ErrorTitle>
          <ErrorMessage>{nodeData.error || nodeData.errorMessage}</ErrorMessage>
        </ErrorBox>
      )}
    </NodeContainer>
  )
}

// ==================== Cherry 风格样式 ====================

const NodeContainer = styled.div`
  min-width: 180px;
  min-height: 100px;
  width: 100%;
  height: 100%;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--list-item-border-radius);
  cursor: grab;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;

  &:hover {
    background: var(--color-background-soft);
    border-color: var(--color-border-soft);
  }

  &.selected {
    background: var(--color-background-soft);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary-mute);
  }

  &:active {
    cursor: grabbing;
  }

  /* 运行中状态 */
  &[data-status='running'] {
    border-color: var(--color-primary);
  }

  /* 完成状态 */
  &[data-status='success'],
  &[data-status='completed'] {
    border-color: var(--color-status-success);
  }

  /* 错误状态 */
  &[data-status='error'] {
    border-color: var(--color-status-error);
  }
`

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-mute);
`

const NodeIcon = styled.span`
  font-size: 18px;
  line-height: 1;
`

const NodeTitle = styled.div`
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StatusIndicator = styled.span`
  font-size: 12px;
  color: var(--color-text-3);

  &[data-status='running'] {
    color: var(--color-primary);
  }

  &[data-status='success'],
  &[data-status='completed'] {
    color: var(--color-status-success);
  }

  &[data-status='error'] {
    color: var(--color-status-error);
  }
`

const SpinIcon = styled.span`
  display: inline-block;
  animation: spin 1s linear infinite;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const NodeContent = styled.div`
  padding: 10px 12px;
  font-size: 12px;
  color: var(--color-text-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const NodeTypeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border-mute);
  font-size: 11px;
  color: var(--color-text-3);
  align-self: flex-start;
`

const ConfigBadge = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-primary-mute);
  font-size: 11px;
  color: var(--color-text);
  align-self: flex-start;
`

const ConfigText = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
`

const ModelInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-2);
`

const ModelIcon = styled.span`
  font-size: 11px;
`

const ModelText = styled.span`
  font-weight: 500;
`

const ModelSubtext = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
  margin-top: -2px;
`

const ImageInputInfo = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.3);
  font-size: 11px;
  color: #52c41a;
  align-self: flex-start;
`

const NodeFooter = styled.div`
  padding: 6px 12px;
  border-top: 1px solid var(--color-border-mute);
  font-size: 11px;
  color: var(--color-text-3);
  text-align: center;

  &[data-status='running'] {
    color: var(--color-primary);
    font-weight: 500;
  }

  &[data-status='success'],
  &[data-status='completed'] {
    color: var(--color-status-success);
  }

  &[data-status='error'] {
    color: var(--color-status-error);
  }
`

const StatusText = styled.span``

const ErrorBox = styled.div`
  margin: 8px 12px 12px;
  padding: 8px;
  background: rgba(255, 77, 80, 0.1);
  border: 1px solid var(--color-error);
  border-radius: 6px;
`

const ErrorTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-error);
  margin-bottom: 4px;
`

const ErrorMessage = styled.div`
  font-size: 10px;
  color: var(--color-error);
  word-break: break-word;
  line-height: 1.4;
`

// ==================== 输出节点专用样式 ====================

const OutputNodeContainer = styled.div`
  min-width: 140px;
  min-height: 80px;
  width: 100%;
  height: 100%;
  background: var(--color-background);
  border: 2px solid var(--color-primary);
  border-radius: 12px;
  cursor: grab;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;

  &:hover {
    background: var(--color-background-soft);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    background: var(--color-background-soft);
    box-shadow: 0 0 0 2px var(--color-primary-mute);
  }

  &:active {
    cursor: grabbing;
  }

  /* 运行中状态 */
  &[data-status='running'] {
    border-color: var(--color-primary);
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* 完成状态 */
  &[data-status='success'],
  &[data-status='completed'] {
    border-color: var(--color-status-success);
  }

  /* 错误状态 */
  &[data-status='error'] {
    border-color: var(--color-status-error);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`

const OutputNodeContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
`

const OutputNodeIcon = styled.span`
  font-size: 20px;
  line-height: 1;
`

const OutputNodeTitle = styled.div`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const OutputNodeStatus = styled.span`
  font-size: 14px;
  color: var(--color-text-3);

  &[data-status='running'] {
    color: var(--color-primary);
  }

  &[data-status='success'],
  &[data-status='completed'] {
    color: var(--color-status-success);
  }

  &[data-status='error'] {
    color: var(--color-status-error);
  }
`

const OutputTypeHint = styled.div`
  padding: 4px 16px 8px;
  font-size: 10px;
  color: var(--color-text-3);
  text-align: center;
  flex-shrink: 0;
`

const PreviewBox = styled.div`
  margin: 0 12px 12px;
  flex: 1;
  min-height: 80px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img, video {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
`

const Placeholder = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

export default memo(CherryWorkflowNode)
