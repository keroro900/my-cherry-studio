/**
 * VCP Tool Use Component
 *
 * Renders <<<[TOOL_REQUEST]>>> ... <<<[END_TOOL_REQUEST]>>> blocks
 * with:
 * - Animated gradient background
 * - Tool name extraction
 * - Collapsible content
 * - Gear icon indicator
 */

import { CopyIcon, LoadingIcon } from '@renderer/components/Icons'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { Collapse, ConfigProvider, Flex, message as antdMessage, Modal, Tabs, Tooltip } from 'antd'
import { Check, ChevronRight, Maximize, Settings } from 'lucide-react'
import type { FC } from 'react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

/**
 * VCP Tool Use status
 */
export type VCPToolUseStatus = 'pending' | 'running' | 'completed'

export interface VCPToolUseData {
  toolName: string
  rawContent: string
  parameters?: Record<string, unknown>
  status: VCPToolUseStatus
}

interface Props {
  /** Raw content from <<<[TOOL_REQUEST]>>> block */
  content: string
  /** Whether the tool is currently running */
  isRunning?: boolean
  /** Progress percentage (0-100), only shown when running */
  progress?: number
  /** Estimated time remaining in seconds */
  estimatedTime?: number
}

/**
 * Extract VCP tool name from content
 * Supports formats:
 * - tool_name:「始」ToolName「末」
 * - tool_name: ToolName
 * - First line as fallback
 */
function extractVcpToolName(content: string): string {
  // Try 「始」...「末」 format first
  const fullWidthMatch = content.match(/tool_name[:：]\s*「始」([^「」]+)「末」/i)
  if (fullWidthMatch) {
    return fullWidthMatch[1].trim()
  }

  // Try simple tool_name format
  const simpleMatch = content.match(/tool_name[:：]\s*([^\n\r]+)/i)
  if (simpleMatch) {
    return simpleMatch[1].trim()
  }

  // Fallback to first line (truncated)
  const firstLine = content.trim().split('\n')[0]
  return firstLine.slice(0, 50) || 'Unknown Tool'
}

/**
 * Parse VCP tool request content
 */
function parseVCPToolUse(content: string, isRunning: boolean): VCPToolUseData {
  const toolName = extractVcpToolName(content)
  let parameters: Record<string, unknown> = {}

  // Try to parse parameters from JSON-like content
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parameters = JSON.parse(jsonMatch[0])
    } catch {
      // Not valid JSON
    }
  }

  return {
    toolName,
    rawContent: content,
    parameters,
    status: isRunning ? 'running' : 'pending'
  }
}

const VCPToolUse: FC<Props> = ({ content, isRunning = false, progress, estimatedTime }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [expandedView, setExpandedView] = useState<{ content: string; title: string } | null>(null)
  const { t } = useTranslation()
  const { messageFont, fontSize } = useSettings()
  const { setTimeoutTimer } = useTimer()

  const toolData = useMemo(() => parseVCPToolUse(content, isRunning), [content, isRunning])

  const copyContent = () => {
    navigator.clipboard.writeText(content)
    antdMessage.success({ content: t('message.copied'), key: 'copy-vcp-use' })
    setCopied(true)
    setTimeoutTimer('copyVCPUse', () => setCopied(false), 2000)
  }

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  const renderStatusIndicator = () => {
    if (toolData.status === 'running') {
      return (
        <StatusIndicator $status="running">
          {t('message.tools.invoking', 'Invoking')}
          {progress !== undefined && progress > 0 && (
            <ProgressText>{Math.round(progress)}%</ProgressText>
          )}
          {estimatedTime !== undefined && estimatedTime > 0 && (
            <EstimatedTimeText>~{estimatedTime}s</EstimatedTimeText>
          )}
          <LoadingIcon style={{ marginLeft: 6 }} />
        </StatusIndicator>
      )
    }
    return (
      <StatusIndicator $status="pending">
        {t('message.tools.tool_call', 'Tool Call')}
        <GearIconAnimated size={13} className="lucide-custom" />
      </StatusIndicator>
    )
  }

  // Determine if we should show the progress bar
  const showProgressBar = isRunning && progress !== undefined && progress > 0

  const getCollapseItems = () => {
    const uniqueKey = `vcp-use-${Date.now()}`

    return [
      {
        key: uniqueKey,
        label: (
          <MessageTitleLabel>
            <TitleContent>
              <GearIconWrapper>
                <Settings size={14} />
              </GearIconWrapper>
              <ToolName align="center" gap={4}>
                <span className="vcp-tool-label">ToolUse:</span>
                <span className="vcp-tool-name-highlight">{toolData.toolName}</span>
              </ToolName>
            </TitleContent>
            <ActionButtonsContainer>
              {renderStatusIndicator()}
              <Tooltip title={t('common.expand')} mouseEnterDelay={0.5}>
                <ActionButton
                  className="message-action-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedView({
                      content: content,
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
                  {copied && <Check size={14} color="var(--status-color-success)" />}
                </ActionButton>
              </Tooltip>
            </ActionButtonsContainer>
          </MessageTitleLabel>
        ),
        children: (
          <ToolResponseContainer
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family-mono)',
              fontSize
            }}>
            <PreContent>{content}</PreContent>
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
        <ToolContainer className={toolData.status}>
          <ToolContentWrapper className={toolData.status}>
            <CollapseContainer
              ghost
              activeKey={activeKeys}
              size="small"
              onChange={handleCollapseChange}
              className="message-tools-container vcp-tool-use"
              items={getCollapseItems()}
              expandIconPosition="end"
              expandIcon={({ isActive }) => (
                <ExpandIcon $isActive={isActive} size={18} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
              )}
            />
            {/* Progress bar */}
            {showProgressBar && (
              <ProgressBarContainer>
                <ProgressBarTrack>
                  <ProgressBarFill $progress={progress || 0} />
                </ProgressBarTrack>
              </ProgressBarContainer>
            )}
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
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family-mono)',
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
                  <CopyIcon size={14} />
                </ActionButton>
              }
              items={[
                {
                  key: 'parameters',
                  label: t('message.tools.parameters', 'Parameters'),
                  children: <PreContent>{expandedView.content}</PreContent>
                }
              ]}
            />
          </ExpandedResponseContainer>
        )}
      </Modal>
    </>
  )
}

// Keyframes
const backgroundFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`

const borderFlow = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`

const gearRotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`

const toolNameColorFlow = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`

// Styled components
const ToolContentWrapper = styled.div`
  padding: 1px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;

  /* Animated border */
  &::after {
    content: '';
    position: absolute;
    box-sizing: border-box;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    padding: 2px;
    background: linear-gradient(60deg, #76c4f7, #00d2ff, #3a7bd5, #ffffff, #3a7bd5, #00d2ff, #76c4f7);
    background-size: 300% 300%;
    animation: ${borderFlow} 7s linear infinite;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    z-index: 0;
    pointer-events: none;
  }

  .ant-collapse {
    border: none;
    background: linear-gradient(145deg, #3a7bd5 0%, #00d2ff 100%);
    background-size: 200% 200%;
    animation: ${backgroundFlow} 20s ease-in-out infinite;
  }

  &.running .ant-collapse {
    background: linear-gradient(145deg, #f39c12 0%, #e74c3c 100%);
  }
`

const ExpandIcon = styled(ChevronRight)<{ $isActive?: boolean }>`
  transition: transform 0.2s;
  transform: ${({ $isActive }) => ($isActive ? 'rotate(90deg)' : 'rotate(0deg)')};
`

const CollapseContainer = styled(Collapse)`
  border-radius: 9px;
  border: none;
  overflow: hidden;
  position: relative;
  z-index: 1;

  .ant-collapse-header {
    padding: 8px 10px !important;
    align-items: center !important;
    color: #ffffff !important;
  }

  .ant-collapse-content-box {
    padding: 0 !important;
  }

  .ant-collapse-content {
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
`

const ToolContainer = styled.div`
  margin-top: 10px;
  margin-bottom: 10px;
  max-width: fit-content;

  &:first-child {
    margin-top: 0;
    padding-top: 0;
  }
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

const GearIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  animation: ${gearRotate} 4s linear infinite;
`

const GearIconAnimated = styled(Settings)`
  animation: ${gearRotate} 2s linear infinite;
`

const ToolName = styled(Flex)`
  color: #ffffff;
  font-weight: 500;
  font-size: 13px;

  .vcp-tool-label {
    font-weight: bold;
    color: #f1c40f;
    margin-right: 6px;
  }

  .vcp-tool-name-highlight {
    background: linear-gradient(90deg, #f1c40f, #ffffff, #00d2ff, #f1c40f);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: bold;
    animation: ${toolNameColorFlow} 4s linear infinite;
  }
`

const StatusIndicator = styled.span<{ $status: VCPToolUseStatus }>`
  color: ${(props) => (props.$status === 'running' ? '#f1c40f' : 'rgba(255, 255, 255, 0.85)')};
  font-size: 11px;
  font-weight: ${(props) => (props.$status === 'running' ? '600' : '400')};
  display: flex;
  align-items: center;
  padding-left: 12px;
  gap: 6px;
`

const ProgressText = styled.span`
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #f1c40f;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
`

const EstimatedTimeText = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Consolas', 'Monaco', monospace;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 6px;
  margin-left: auto;
  align-items: center;
`

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.8);
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
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.2);
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
    opacity: 1;
  }
`

const ToolResponseContainer = styled.div`
  border-radius: 0 0 8px 8px;
  overflow: auto;
  max-height: 300px;
  position: relative;
`

const PreContent = styled.pre`
  margin: 0;
  padding: 12px;
  color: #f0f0f0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.85em;
  line-height: 1.5;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
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
    background: var(--color-bg-2);
    padding: 12px;
    border-radius: 6px;
  }
`

// Progress bar keyframes
const progressGlow = keyframes`
  0% {
    box-shadow: 0 0 4px rgba(241, 196, 15, 0.4);
  }
  50% {
    box-shadow: 0 0 8px rgba(241, 196, 15, 0.6), 0 0 12px rgba(241, 196, 15, 0.3);
  }
  100% {
    box-shadow: 0 0 4px rgba(241, 196, 15, 0.4);
  }
`

const progressShimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`

const ProgressBarContainer = styled.div`
  padding: 6px 10px 8px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`

const ProgressBarTrack = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
`

const ProgressBarFill = styled.div<{ $progress: number }>`
  width: ${(props) => props.$progress}%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #f1c40f 0%,
    #f39c12 25%,
    #e74c3c 50%,
    #f39c12 75%,
    #f1c40f 100%
  );
  background-size: 200% 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out;
  animation:
    ${progressShimmer} 2s linear infinite,
    ${progressGlow} 1.5s ease-in-out infinite;
  position: relative;

  /* Shine effect */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.3),
      rgba(255, 255, 255, 0)
    );
    border-radius: 3px 3px 0 0;
  }
`

export default memo(VCPToolUse)

/**
 * Helper function to detect and parse VCP tool request markers in message content
 * 支持 2-3 个 < 的格式以兼容不同 AI 模型的输出
 */
export function extractVCPToolRequests(content: string): string[] {
  const results: string[] = []

  // Match <<<?[TOOL_REQUEST]>>>? ... <<<?[END_TOOL_REQUEST]>>>?
  // 支持 2个或3个 < 和 > 的格式
  const requestPattern = /<<<?(?:\[TOOL_REQUEST\])>>>?([\s\S]*?)<<<?(?:\[END_TOOL_REQUEST\])>>>?/g
  let match
  while ((match = requestPattern.exec(content)) !== null) {
    results.push(match[1].trim())
  }

  return results
}

/**
 * Check if content contains VCP tool request markers
 * 支持 2-3 个 < 的格式
 */
export function hasVCPToolRequests(content: string): boolean {
  // 检查标准格式 (3个 <) 或兼容格式 (2个 <)
  return /<<<?\[TOOL_REQUEST\]>>>?/.test(content)
}
