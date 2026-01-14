/**
 * VCP Deep Memory Retrieval Component
 *
 * Renders <<<[DEEP_MEMORY]>>> blocks with VCPChat-style styling
 * Features:
 * - Purple gradient card with date badge
 * - Multiple sections with icons
 * - Summary text
 * - Animated border effects
 */

import { CopyOutlined } from '@ant-design/icons'
import { useSettings } from '@renderer/hooks/useSettings'
import { Collapse, ConfigProvider, message as antdMessage, Tooltip } from 'antd'
import { Brain, Check, ChevronRight } from 'lucide-react'
import type { FC } from 'react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

interface Props {
  /** Raw content from <<<[DEEP_MEMORY]>>> ... <<<[/DEEP_MEMORY]>>> block */
  content: string
}

/**
 * Deep Memory section
 */
interface DeepMemorySection {
  icon?: string
  title: string
  content: string
}

/**
 * Deep Memory data structure
 */
interface DeepMemoryData {
  title: string
  date?: string
  summary?: string
  sections: DeepMemorySection[]
}

/**
 * Parse Deep Memory content
 * Supports JSON format or structured text format
 */
function parseDeepMemoryContent(content: string): DeepMemoryData {
  const trimmed = content.trim()

  // Try to parse as JSON first
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      return {
        title: parsed.title || 'DEEP MEMORY RETRIEVAL',
        date: parsed.date,
        summary: parsed.summary,
        sections: (parsed.sections || []).map((s: any) => ({
          icon: s.icon,
          title: s.title || 'Section',
          content: s.content || ''
        }))
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Parse structured text format
  const lines = trimmed.split('\n')
  let title = 'DEEP MEMORY RETRIEVAL'
  let date: string | undefined
  let summary: string | undefined
  const sections: DeepMemorySection[] = []
  let currentSection: DeepMemorySection | null = null

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('Title:') || trimmedLine.startsWith('TITLE:')) {
      title = trimmedLine.split(':').slice(1).join(':').trim()
    } else if (trimmedLine.startsWith('Date:') || trimmedLine.startsWith('DATE:')) {
      date = trimmedLine.split(':').slice(1).join(':').trim()
    } else if (trimmedLine.startsWith('Summary:') || trimmedLine.startsWith('SUMMARY:')) {
      summary = trimmedLine.split(':').slice(1).join(':').trim()
    } else if (trimmedLine.startsWith('[SECTION:') || trimmedLine.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection)
      }

      // Parse section header
      let sectionTitle: string
      let icon: string | undefined

      if (trimmedLine.startsWith('[SECTION:')) {
        const match = trimmedLine.match(/\[SECTION:([^\]]+)\]/)
        if (match) {
          const header = match[1].trim()
          // Check for emoji icon
          const emojiMatch = header.match(/^(\p{Emoji})\s*(.+)$/u)
          if (emojiMatch) {
            icon = emojiMatch[1]
            sectionTitle = emojiMatch[2]
          } else {
            sectionTitle = header
          }
        } else {
          sectionTitle = 'Section'
        }
      } else {
        // Markdown ## header
        const headerText = trimmedLine.replace(/^##\s*/, '')
        const emojiMatch = headerText.match(/^(\p{Emoji})\s*(.+)$/u)
        if (emojiMatch) {
          icon = emojiMatch[1]
          sectionTitle = emojiMatch[2]
        } else {
          sectionTitle = headerText
        }
      }

      currentSection = { icon, title: sectionTitle, content: '' }
    } else if (currentSection) {
      // Add content to current section
      currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine
    } else if (trimmedLine && !summary) {
      // Use as summary if no summary yet
      summary = trimmedLine
    }
  }

  // Save last section
  if (currentSection) {
    sections.push(currentSection)
  }

  // If no sections found, create one from the whole content
  if (sections.length === 0 && trimmed) {
    sections.push({
      title: 'Memory Fragment',
      content: trimmed
    })
  }

  // Default date
  if (!date) {
    date = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '.')
  }

  return { title, date, summary, sections }
}

const VCPDeepMemory: FC<Props> = ({ content }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>(['deep-memory-main'])
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()
  const { messageFont, fontSize } = useSettings()

  const memoryData = useMemo(() => parseDeepMemoryContent(content), [content])

  const copyContent = () => {
    navigator.clipboard.writeText(content)
    antdMessage.success({ content: t('message.copied'), key: 'copy-deep-memory' })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  const getCollapseItems = () => {
    return [
      {
        key: 'deep-memory-main',
        label: (
          <MemoryTitleLabel>
            <TitleContent>
              <MemoryBadge>
                <Brain size={14} />
                <span>{memoryData.title}</span>
              </MemoryBadge>
              {memoryData.date && <DateBadge>{memoryData.date}</DateBadge>}
            </TitleContent>
            <ActionButtonsContainer>
              <Tooltip title={t('common.copy')} mouseEnterDelay={0.5}>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation()
                    copyContent()
                  }}>
                  {!copied ? <CopyOutlined /> : <Check size={14} color="var(--vcp-tool-success)" />}
                </ActionButton>
              </Tooltip>
            </ActionButtonsContainer>
          </MemoryTitleLabel>
        ),
        children: (
          <MemoryBodyContainer
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
              fontSize
            }}>
            {/* Summary */}
            {memoryData.summary && <SummaryText>{memoryData.summary}</SummaryText>}

            {/* Sections */}
            <SectionsContainer>
              {memoryData.sections.map((section, i) => (
                <SectionCard key={i}>
                  <SectionHeader>
                    {section.icon ? (
                      <SectionIcon>{section.icon}</SectionIcon>
                    ) : (
                      <SectionIconWrapper>
                        <Brain size={14} />
                      </SectionIconWrapper>
                    )}
                    <SectionTitle>{section.title}</SectionTitle>
                  </SectionHeader>
                  <SectionContent>{section.content}</SectionContent>
                </SectionCard>
              ))}
            </SectionsContainer>
          </MemoryBodyContainer>
        )
      }
    ]
  }

  return (
    <ConfigProvider
      theme={{
        components: {
          Button: { borderRadiusSM: 6 }
        }
      }}>
      <MemoryContainer>
        <MemoryWrapper>
          <CollapseContainer
            ghost
            activeKey={activeKeys}
            size="small"
            onChange={handleCollapseChange}
            className="message-deep-memory-container"
            items={getCollapseItems()}
            expandIconPosition="end"
            expandIcon={({ isActive }) => (
              <ExpandIcon $isActive={isActive} size={18} color="var(--color-text-3)" strokeWidth={1.5} />
            )}
          />
        </MemoryWrapper>
      </MemoryContainer>
    </ConfigProvider>
  )
}

// Styled components
const gradientFlow = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.5), 0 0 24px rgba(139, 92, 246, 0.3);
  }
`

const MemoryContainer = styled.div`
  margin: 12px 0;
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.12) 0%,
    rgba(59, 130, 246, 0.08) 50%,
    rgba(139, 92, 246, 0.12) 100%
  );
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-left: 3px solid #8b5cf6;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px rgba(139, 92, 246, 0.15);
  animation: ${glowPulse} 4s ease-in-out infinite;
`

const MemoryWrapper = styled.div`
  padding: 1px;
`

const ExpandIcon = styled(ChevronRight)<{ $isActive?: boolean }>`
  transition: transform 0.2s;
  transform: ${({ $isActive }) => ($isActive ? 'rotate(90deg)' : 'rotate(0deg)')};
`

const CollapseContainer = styled(Collapse)`
  border-radius: 11px;
  border: none;
  background-color: transparent;
  overflow: hidden;

  .ant-collapse-header {
    padding: 14px 18px !important;
    align-items: center !important;
    background: rgba(139, 92, 246, 0.08);
  }

  .ant-collapse-content-box {
    padding: 0 !important;
  }

  .ant-collapse-item {
    border: none !important;
  }

  .ant-collapse-content {
    border-top: 1px solid rgba(139, 92, 246, 0.2);
  }
`

const MemoryTitleLabel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
`

const TitleContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`

const MemoryBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #a78bfa;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.15));
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(139, 92, 246, 0.4);
`

const DateBadge = styled.span`
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.15);
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.5px;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-items: center;
`

const ActionButton = styled.button`
  background: rgba(139, 92, 246, 0.15);
  border: none;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.2s;
  border-radius: 6px;

  &:hover {
    opacity: 1;
    color: var(--color-text);
    background-color: rgba(139, 92, 246, 0.25);
  }
`

const MemoryBodyContainer = styled.div`
  padding: 18px;
`

const SummaryText = styled.div`
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.6;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 8px;
  border-left: 2px solid rgba(139, 92, 246, 0.3);
`

const SectionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const SectionCard = styled.div`
  background: linear-gradient(
    145deg,
    rgba(139, 92, 246, 0.15) 0%,
    rgba(168, 85, 247, 0.08) 100%
  );
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(139, 92, 246, 0.2);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
  }
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(139, 92, 246, 0.1);
  border-bottom: 1px solid rgba(139, 92, 246, 0.15);
`

const SectionIcon = styled.span`
  font-size: 20px;
  line-height: 1;
`

const SectionIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
`

const SectionTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #c4b5fd;
  letter-spacing: 0.3px;
`

const SectionContent = styled.div`
  padding: 14px 16px;
  color: var(--color-text);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
`

export default memo(VCPDeepMemory)

/**
 * Helper function to detect and parse Deep Memory markers in message content
 */
export function extractDeepMemory(content: string): string[] {
  const results: string[] = []

  // Match <<<[DEEP_MEMORY]>>>...<<<[/DEEP_MEMORY]>>> format
  const pattern = /<<<\[DEEP_MEMORY\]>>>([\s\S]*?)<<<\[\/DEEP_MEMORY\]>>>/g
  let match
  while ((match = pattern.exec(content)) !== null) {
    results.push(match[1].trim())
  }

  // Also support <<<[DEEP_MEMORY_RETRIEVAL]>>> format
  const altPattern = /<<<\[DEEP_MEMORY_RETRIEVAL\]>>>([\s\S]*?)<<<\[\/DEEP_MEMORY_RETRIEVAL\]>>>/g
  while ((match = altPattern.exec(content)) !== null) {
    results.push(match[1].trim())
  }

  return results
}

/**
 * Check if content contains Deep Memory markers
 */
export function hasDeepMemory(content: string): boolean {
  return /<<<\[DEEP_MEMORY(_RETRIEVAL)?\]>>>/.test(content)
}
