/**
 * VCP Tool Result Component
 *
 * Renders <<<[TOOL_RESULT]>>> and <<<[TOOL_ERROR]>>> blocks
 * with:
 * - Success/failure/progress status indicators
 * - Collapsible content
 * - Copy functionality
 * - Syntax highlighting for JSON
 * - VCPChat-style enhanced UI
 * - Image rendering for VCP tools that return images
 */

import { CopyIcon } from '@renderer/components/Icons'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { Collapse, ConfigProvider, Flex, message as antdMessage, Modal, Progress, Tabs, Tooltip } from 'antd'
import { BarChart2, Check, CheckCircle2, ChevronRight, ImageIcon, Maximize, TriangleAlert } from 'lucide-react'
import type { FC } from 'react'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

/**
 * VCP Content Block types (for multi-modal content)
 */
export interface VCPContentBlock {
  type: 'text' | 'image_url' | 'json'
  text?: string
  image_url?: {
    url: string // base64 or http URL
    alt?: string
  }
}

/**
 * VCP Tool Result types
 */
export type VCPToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

export interface VCPToolResultData {
  toolName: string
  pluginName?: string
  status: VCPToolStatus
  result?: string
  error?: string
  duration?: number
  progress?: number
  metadata?: Record<string, unknown>
  /** Agent name that invoked the tool */
  agentName?: string
  /** Timestamp when tool was called */
  timestamp?: string
  /** Multi-modal content blocks (for images, etc.) */
  contentBlocks?: VCPContentBlock[]
}

interface Props {
  /** Raw content from <<<[TOOL_RESULT]>>> or <<<[TOOL_ERROR]>>> block */
  content: string
  /** Type of result block */
  type: 'result' | 'error'
}

/**
 * Parse VCP content blocks from result string
 * Supports VCPToolBox format: { content: [{ type, text/image_url }] }
 */
function parseVCPContentBlocks(content: string): VCPContentBlock[] {
  try {
    const parsed = JSON.parse(content)

    // Check VCPToolBox format: { content: [{ type, text/image_url }] }
    if (parsed.content && Array.isArray(parsed.content)) {
      return parsed.content.map((block: any) => ({
        type: block.type || 'text',
        text: block.text,
        image_url: block.image_url
      }))
    }

    // Check direct array format
    if (Array.isArray(parsed)) {
      return parsed.map((block: any) => ({
        type: block.type || 'text',
        text: block.text,
        image_url: block.image_url
      }))
    }

    // Check for base64 image in result
    if (parsed.base64 && parsed.mimeType) {
      return [
        {
          type: 'image_url',
          image_url: {
            url: `data:${parsed.mimeType};base64,${parsed.base64}`,
            alt: parsed.alt || 'VCP Tool Result Image'
          }
        }
      ]
    }

    // Check for direct image URL
    if (parsed.image_url || parsed.imageUrl) {
      const imgData = parsed.image_url || parsed.imageUrl
      return [
        {
          type: 'image_url',
          image_url: typeof imgData === 'string' ? { url: imgData } : imgData
        }
      ]
    }

    // Check for images array
    if (parsed.images && Array.isArray(parsed.images)) {
      return parsed.images.map((img: any) => ({
        type: 'image_url',
        image_url: typeof img === 'string' ? { url: img } : img
      }))
    }
  } catch {
    // Not JSON, return as text
  }

  return [{ type: 'text', text: content }]
}

/**
 * Parse VCP tool result content
 */
function parseVCPToolResult(content: string, type: 'result' | 'error'): VCPToolResultData {
  const lines = content.trim().split('\n')
  let toolName = 'Unknown Tool'
  let pluginName: string | undefined
  let result: string | undefined
  let error: string | undefined
  let duration: number | undefined
  let agentName: string | undefined
  let timestamp: string | undefined
  let metadata: Record<string, unknown> = {}

  // Try to parse structured format first
  for (const line of lines) {
    if (line.startsWith('Tool:')) {
      toolName = line.slice(5).trim()
    } else if (line.startsWith('Plugin:')) {
      pluginName = line.slice(7).trim()
    } else if (line.startsWith('Duration:')) {
      const durationStr = line.slice(9).trim()
      const match = durationStr.match(/(\d+(?:\.\d+)?)\s*ms/)
      if (match) {
        duration = parseFloat(match[1])
      }
    } else if (line.startsWith('Agent:') || line.startsWith('By:')) {
      agentName = line.split(':').slice(1).join(':').trim()
    } else if (line.startsWith('Time:') || line.startsWith('Timestamp:')) {
      timestamp = line.split(':').slice(1).join(':').trim()
    } else if (line.startsWith('Status:')) {
      // Status is already determined by type
    }
  }

  // If no structured format found, use entire content as result/error
  if (!toolName || toolName === 'Unknown Tool') {
    if (type === 'error') {
      error = content
    } else {
      result = content
    }
    // Try to extract tool name from first line
    const firstLine = lines[0]
    if (firstLine && !firstLine.includes(':')) {
      toolName = firstLine.slice(0, 50)
    }
  } else {
    // Extract result/error content after headers
    const contentStartIndex = lines.findIndex(
      (l) =>
        !l.startsWith('Tool:') &&
        !l.startsWith('Plugin:') &&
        !l.startsWith('Duration:') &&
        !l.startsWith('Status:') &&
        !l.startsWith('Agent:') &&
        !l.startsWith('By:') &&
        !l.startsWith('Time:') &&
        !l.startsWith('Timestamp:')
    )
    if (contentStartIndex >= 0) {
      const resultContent = lines.slice(contentStartIndex).join('\n').trim()
      if (type === 'error') {
        error = resultContent
      } else {
        result = resultContent
      }
    }
  }

  // Try to parse result as JSON for metadata
  if (result) {
    try {
      const parsed = JSON.parse(result)
      if (typeof parsed === 'object' && parsed !== null) {
        metadata = parsed
      }
    } catch {
      // Not JSON, keep as string
    }
  }

  // Generate timestamp if not provided
  if (!timestamp) {
    timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  // Parse content blocks for multi-modal content (images, etc.)
  const contentBlocks = result ? parseVCPContentBlocks(result) : undefined

  return {
    toolName,
    pluginName,
    status: type === 'error' ? 'error' : 'success',
    result,
    error,
    duration,
    metadata,
    agentName,
    timestamp,
    contentBlocks
  }
}

const VCPToolResult: FC<Props> = ({ content, type }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [expandedView, setExpandedView] = useState<{ content: string; title: string } | null>(null)
  const { t } = useTranslation()
  const { messageFont, fontSize } = useSettings()
  const { setTimeoutTimer } = useTimer()

  const toolData = useMemo(() => parseVCPToolResult(content, type), [content, type])
  const isError = type === 'error'

  const resultString = useMemo(() => {
    if (isError && toolData.error) {
      return toolData.error
    }
    if (toolData.result) {
      try {
        // Try to pretty-print JSON
        const parsed = JSON.parse(toolData.result)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return toolData.result
      }
    }
    return content
  }, [content, isError, toolData])

  // Generate result summary for collapsed state preview
  const resultSummary = useMemo(() => {
    const maxLen = 80
    let summary = resultString.trim()

    // Remove JSON formatting for cleaner summary
    if (summary.startsWith('{') || summary.startsWith('[')) {
      try {
        const parsed = JSON.parse(summary)
        // For JSON, try to get a meaningful summary
        if (parsed.message) {
          summary = parsed.message
        } else if (parsed.result) {
          summary = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)
        } else if (parsed.content) {
          summary = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content)
        } else {
          // Get first few key-value pairs
          const keys = Object.keys(parsed).slice(0, 2)
          summary = keys.map((k) => `${k}: ${JSON.stringify(parsed[k]).slice(0, 20)}...`).join(', ')
        }
      } catch {
        // Keep original
      }
    }

    // Truncate and clean up
    summary = summary.replace(/\n/g, ' ').replace(/\s+/g, ' ')
    if (summary.length > maxLen) {
      summary = summary.slice(0, maxLen) + '...'
    }

    return summary
  }, [resultString])

  // Check if we have image content blocks
  const hasImages = useMemo(() => {
    return toolData.contentBlocks?.some((b) => b.type === 'image_url') || false
  }, [toolData.contentBlocks])

  const copyContent = () => {
    navigator.clipboard.writeText(resultString)
    antdMessage.success({ content: t('message.copied'), key: 'copy-vcp-result' })
    setCopied(true)
    setTimeoutTimer('copyVCPResult', () => setCopied(false), 2000)
  }

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  const getCollapseItems = () => {
    const uniqueKey = `vcp-result-${Date.now()}`

    return [
      {
        key: uniqueKey,
        label: (
          <MessageTitleLabel>
            <TitleContent>
              <ToolIconWrapper $status={toolData.status}>
                {isError ? <TriangleAlert size={14} /> : <BarChart2 size={14} />}
              </ToolIconWrapper>
              <ToolName align="center" gap={4}>
                <ToolNameText>{toolData.pluginName || toolData.toolName}</ToolNameText>
                <StatusBadge $status={toolData.status}>
                  {toolData.status === 'success' ? 'success' : toolData.status}
                </StatusBadge>
              </ToolName>
              {/* VCPChat-style meta info: (by Agent @ timestamp) */}
              <MetaInfo>
                {toolData.agentName && (
                  <>
                    <span className="by-text">(by</span>
                    <span className="agent-name">{toolData.agentName}</span>
                    <span className="separator">@</span>
                    <span className="timestamp">{toolData.timestamp})</span>
                  </>
                )}
                {!toolData.agentName && toolData.timestamp && <span className="timestamp">@ {toolData.timestamp}</span>}
              </MetaInfo>
              {/* Result summary preview when collapsed */}
              {activeKeys.length === 0 && !hasImages && (
                <SummaryPreview title={resultSummary}>{resultSummary}</SummaryPreview>
              )}
              {/* Image indicator when collapsed */}
              {activeKeys.length === 0 && hasImages && (
                <ImagePreviewBadge>
                  <ImageIcon size={12} />
                  <span>{toolData.contentBlocks?.filter((b) => b.type === 'image_url').length} images</span>
                </ImagePreviewBadge>
              )}
            </TitleContent>
            <ActionButtonsContainer>
              {toolData.progress !== undefined && toolData.progress > 0 && toolData.progress < 100 && (
                <Progress type="circle" size={14} percent={toolData.progress} />
              )}
              {toolData.duration && <DurationText>{toolData.duration.toFixed(0)}ms</DurationText>}
              {/* Success checkmark icon like VCPChat */}
              {toolData.status === 'success' && (
                <CheckIconWrapper>
                  <CheckCircle2 size={16} />
                </CheckIconWrapper>
              )}
              <Tooltip title={t('common.expand')} mouseEnterDelay={0.5}>
                <ActionButton
                  className="message-action-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedView({
                      content: resultString,
                      title: toolData.toolName
                    })
                  }}
                  aria-label={t('common.expand')}>
                  <Maximize size={14} />
                </ActionButton>
              </Tooltip>
              <Tooltip title={t('common.copy')} mouseEnterDelay={0.5}>
                <ActionButton
                  className="message-action-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyContent()
                  }}
                  aria-label={t('common.copy')}>
                  {!copied && <CopyIcon size={14} />}
                  {copied && <Check size={14} color="var(--vcp-tool-success)" />}
                </ActionButton>
              </Tooltip>
            </ActionButtonsContainer>
          </MessageTitleLabel>
        ),
        children: (
          <ToolResponseContainer
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
              fontSize
            }}>
            <CollapsedContent
              isExpanded={activeKeys.includes(uniqueKey)}
              resultString={resultString}
              isError={isError}
              contentBlocks={toolData.contentBlocks}
            />
          </ToolResponseContainer>
        )
      }
    ]
  }

  return (
    <>
      <ConfigProvider
        theme={{
          components: {
            Button: {
              borderRadiusSM: 6
            }
          }
        }}>
        <ToolContainer $isError={isError}>
          <ToolContentWrapper className={toolData.status}>
            <CollapseContainer
              ghost
              activeKey={activeKeys}
              size="small"
              onChange={handleCollapseChange}
              className="message-tools-container"
              items={getCollapseItems()}
              expandIconPosition="end"
              expandIcon={({ isActive }) => (
                <ExpandIcon $isActive={isActive} size={18} color="var(--color-text-3)" strokeWidth={1.5} />
              )}
            />
          </ToolContentWrapper>
        </ToolContainer>
      </ConfigProvider>
      <Modal
        title={expandedView?.title}
        open={!!expandedView}
        onCancel={() => setExpandedView(null)}
        footer={null}
        width="80%"
        centered
        transitionName="animation-move-down"
        styles={{ body: { maxHeight: '80vh', overflow: 'auto' } }}>
        {expandedView && (
          <ExpandedResponseContainer
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
              fontSize
            }}>
            <Tabs
              tabBarExtraContent={
                <ActionButton
                  className="copy-expanded-button"
                  onClick={() => {
                    navigator.clipboard.writeText(expandedView.content)
                    antdMessage.success({ content: t('message.copied'), key: 'copy-expanded' })
                  }}
                  aria-label={t('common.copy')}>
                  <i className="iconfont icon-copy"></i>
                </ActionButton>
              }
              items={[
                {
                  key: 'content',
                  label: isError ? t('message.tools.error', 'Error') : t('message.tools.result', 'Result'),
                  children: (
                    <CollapsedContent
                      isExpanded={true}
                      resultString={expandedView.content}
                      isError={isError}
                      contentBlocks={toolData.contentBlocks}
                    />
                  )
                }
              ]}
            />
          </ExpandedResponseContainer>
        )}
      </Modal>
    </>
  )
}

// Component to handle syntax highlighted content and images
const CollapsedContent: FC<{
  isExpanded: boolean
  resultString: string
  isError?: boolean
  contentBlocks?: VCPContentBlock[]
}> = ({ isExpanded, resultString, isError, contentBlocks }) => {
  const { highlightCode } = useCodeStyle()
  const [styledResult, setStyledResult] = useState<string>('')

  // Check if we have image content blocks
  const imageBlocks = useMemo(() => contentBlocks?.filter((b) => b.type === 'image_url') || [], [contentBlocks])
  const textBlocks = useMemo(() => contentBlocks?.filter((b) => b.type === 'text') || [], [contentBlocks])
  const hasImages = imageBlocks.length > 0

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    // If we have images, don't syntax highlight the JSON
    if (hasImages) {
      // Only highlight non-image text blocks
      const textContent = textBlocks.map((b) => b.text).join('\n')
      if (textContent) {
        setStyledResult(`<pre>${textContent}</pre>`)
      }
      return
    }

    const highlight = async () => {
      // Determine language based on content
      let language = 'text'
      if (resultString.trim().startsWith('{') || resultString.trim().startsWith('[')) {
        language = 'json'
      }

      const result = await highlightCode(resultString, language)
      setStyledResult(result)
    }

    const timer = setTimeout(highlight, 0)
    return () => clearTimeout(timer)
  }, [isExpanded, resultString, highlightCode, hasImages, textBlocks])

  if (!isExpanded) {
    return null
  }

  // Render images if present
  if (hasImages) {
    return (
      <ContentBlocksContainer>
        {textBlocks.length > 0 && (
          <TextContentSection>
            {textBlocks.map((block, i) => (
              <div key={`text-${i}`}>{block.text}</div>
            ))}
          </TextContentSection>
        )}
        <ImageGrid $count={imageBlocks.length}>
          {imageBlocks.map((block, i) => (
            <ImageWrapper key={`img-${i}`}>
              <VCPResultImage
                src={block.image_url!.url}
                alt={block.image_url?.alt || `VCP Tool Result Image ${i + 1}`}
                loading="lazy"
                onClick={() => window.open(block.image_url!.url, '_blank')}
              />
              {block.image_url?.alt && <ImageCaption>{block.image_url.alt}</ImageCaption>}
            </ImageWrapper>
          ))}
        </ImageGrid>
        <ImageBadge>
          <ImageIcon size={12} />
          <span>
            {imageBlocks.length} {imageBlocks.length === 1 ? 'image' : 'images'}
          </span>
        </ImageBadge>
      </ContentBlocksContainer>
    )
  }

  return (
    <MarkdownContainer className="markdown" $isError={isError} dangerouslySetInnerHTML={{ __html: styledResult }} />
  )
}

// Styled components
const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 4px var(--vcp-tool-success);
  }
  50% {
    box-shadow: 0 0 8px var(--vcp-tool-success), 0 0 12px rgba(76, 175, 80, 0.3);
  }
`

const ToolContentWrapper = styled.div`
  padding: 1px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--vcp-tool-result-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  .ant-collapse {
    border: 1px solid var(--vcp-tool-result-border);
    background: transparent;
  }

  &.pending,
  &.running {
    background-color: var(--color-background-soft);
    .ant-collapse {
      border: none;
    }
  }

  &.error {
    .ant-collapse {
      border-color: var(--vcp-tool-error);
    }
  }

  &.success {
    .ant-collapse {
      border-color: rgba(76, 175, 80, 0.3);
    }
  }
`

const ToolIconWrapper = styled.div<{ $status: VCPToolStatus }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${(props) => {
    switch (props.$status) {
      case 'error':
        return 'rgba(255, 82, 82, 0.15)'
      case 'success':
        return 'rgba(76, 175, 80, 0.15)'
      default:
        return 'rgba(0, 210, 255, 0.15)'
    }
  }};
  color: ${(props) => {
    switch (props.$status) {
      case 'error':
        return 'var(--vcp-tool-error)'
      case 'success':
        return 'var(--vcp-tool-success)'
      default:
        return 'var(--vcp-primary)'
    }
  }};
`

const ToolNameText = styled.span`
  font-weight: 600;
  color: var(--vcp-tool-result-name-color);
  background: var(--vcp-tool-result-name-bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
`

const StatusBadge = styled.span<{ $status: VCPToolStatus }>`
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${(props) => {
    switch (props.$status) {
      case 'error':
        return 'rgba(255, 82, 82, 0.15)'
      case 'success':
        return 'rgba(76, 175, 80, 0.15)'
      case 'running':
        return 'rgba(0, 210, 255, 0.15)'
      default:
        return 'rgba(250, 173, 20, 0.15)'
    }
  }};
  color: ${(props) => {
    switch (props.$status) {
      case 'error':
        return 'var(--vcp-tool-error)'
      case 'success':
        return 'var(--vcp-tool-success)'
      case 'running':
        return 'var(--vcp-primary)'
      default:
        return 'var(--color-status-warning)'
    }
  }};
`

const MetaInfo = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-3);
  margin-left: 8px;

  .by-text {
    opacity: 0.7;
  }

  .agent-name {
    color: var(--vcp-primary);
    font-weight: 500;
  }

  .separator {
    opacity: 0.5;
    margin: 0 2px;
  }

  .timestamp {
    opacity: 0.7;
  }
`

const SummaryPreview = styled.span`
  display: inline-block;
  max-width: 200px;
  margin-left: 12px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-text-3);
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

const ImagePreviewBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--vcp-primary);
  background: rgba(0, 210, 255, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(0, 210, 255, 0.2);
`

const CheckIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vcp-tool-success);
  animation: ${glowPulse} 2s ease-in-out infinite;
  border-radius: 50%;
`

const ExpandIcon = styled(ChevronRight)<{ $isActive?: boolean }>`
  transition: transform 0.2s;
  transform: ${({ $isActive }) => ($isActive ? 'rotate(90deg)' : 'rotate(0deg)')};
`

const CollapseContainer = styled(Collapse)`
  --status-color-warning: var(--color-status-warning, #faad14);
  --status-color-invoking: var(--color-primary);
  --status-color-error: var(--color-status-error, #ff4d4f);
  --status-color-success: var(--color-primary, green);
  border-radius: 7px;
  border: none;
  background-color: var(--color-background);
  overflow: hidden;

  .ant-collapse-header {
    padding: 8px 10px !important;
    align-items: center !important;
  }

  .ant-collapse-content-box {
    padding: 0 !important;
  }
`

const ToolContainer = styled.div<{ $isError?: boolean }>`
  margin-top: 10px;
  margin-bottom: 10px;

  &:first-child {
    margin-top: 0;
    padding-top: 0;
  }

  ${({ $isError }) =>
    $isError &&
    `
    border-left: 3px solid var(--status-color-error, #ff4d4f);
    padding-left: 8px;
  `}
`

const MarkdownContainer = styled.div<{ $isError?: boolean }>`
  & pre {
    background: transparent !important;
    span {
      white-space: pre-wrap;
    }
  }

  ${({ $isError }) =>
    $isError &&
    `
    color: var(--status-color-error, #ff4d4f);
  `}
`

const MessageTitleLabel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
  padding: 0;
  margin-left: 4px;
`

const TitleContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`

const ToolName = styled(Flex)`
  color: var(--color-text);
  font-weight: 500;
  font-size: 13px;
`

const DurationText = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 6px;
  margin-left: auto;
  align-items: center;
`

const ActionButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.2s;
  border-radius: 4px;
  gap: 4px;
  min-width: 28px;
  height: 28px;

  &:hover {
    opacity: 1;
    color: var(--color-text);
    background-color: var(--color-bg-3);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    opacity: 1;
  }

  .iconfont {
    font-size: 14px;
  }
`

const ToolResponseContainer = styled.div`
  border-radius: 0 0 4px 4px;
  overflow: auto;
  max-height: 300px;
  border-top: none;
  position: relative;
`

const ExpandedResponseContainer = styled.div`
  background: var(--color-bg-1);
  border-radius: 8px;
  padding: 16px;
  position: relative;

  .copy-expanded-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: var(--color-bg-2);
    border-radius: 4px;
    z-index: 1;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--color-text);
  }
`

// Image rendering styled components
const ContentBlocksContainer = styled.div`
  padding: 12px;
`

const TextContentSection = styled.div`
  margin-bottom: 12px;
  color: var(--color-text);
  line-height: 1.6;
`

const ImageGrid = styled.div<{ $count: number }>`
  display: grid;
  grid-template-columns: ${(props) => (props.$count === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))')};
  gap: 12px;
  margin: 8px 0;
`

const ImageWrapper = styled.div`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--vcp-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`

const VCPResultImage = styled.img`
  width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: contain;
  cursor: pointer;
  display: block;
`

const ImageCaption = styled.div`
  padding: 8px;
  font-size: 12px;
  color: var(--color-text-2);
  text-align: center;
  background: var(--color-bg-1);
  border-top: 1px solid var(--color-border);
`

const ImageBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-3);
  background: rgba(0, 210, 255, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(0, 210, 255, 0.2);
`

export default memo(VCPToolResult)

/**
 * Helper function to detect and parse VCP tool result markers in message content
 * Supports both Cherry Studio format and VCPChat legacy format
 */
export function extractVCPToolResults(content: string): Array<{ type: 'result' | 'error'; content: string }> {
  const results: Array<{ type: 'result' | 'error'; content: string }> = []

  // Match <<<[TOOL_RESULT]>>> ... <<<[/TOOL_RESULT]>>> (Cherry Studio format)
  const resultPattern = /<<<\[TOOL_RESULT\]>>>([\s\S]*?)<<<\[\/TOOL_RESULT\]>>>/g
  let match
  while ((match = resultPattern.exec(content)) !== null) {
    results.push({ type: 'result', content: match[1].trim() })
  }

  // Match <<<[TOOL_ERROR]>>> ... <<<[/TOOL_ERROR]>>> (Cherry Studio format)
  const errorPattern = /<<<\[TOOL_ERROR\]>>>([\s\S]*?)<<<\[\/TOOL_ERROR\]>>>/g
  while ((match = errorPattern.exec(content)) !== null) {
    results.push({ type: 'error', content: match[1].trim() })
  }

  // Match [[VCP调用结果信息汇总:...VCP调用结果结束]] (VCPChat legacy format)
  const vcpChatPattern = /\[\[VCP调用结果信息汇总:([\s\S]*?)VCP调用结果结束\]\]/g
  while ((match = vcpChatPattern.exec(content)) !== null) {
    results.push({ type: 'result', content: match[1].trim() })
  }

  return results
}

/**
 * Check if content contains VCP tool result markers
 * Supports both Cherry Studio format and VCPChat legacy format
 */
export function hasVCPToolResults(content: string): boolean {
  return /<<<\[(TOOL_RESULT|TOOL_ERROR)\]>>>/.test(content) || /\[\[VCP调用结果信息汇总:/.test(content)
}
