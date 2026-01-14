/**
 * VCP DailyNote Component
 *
 * Renders <<<DailyNoteStart>>> and <<<DailyNoteEnd>>> blocks
 * with VCPChat-style "HISTORICAL ARCHIVE" styling
 * Features:
 * - Archive badge header
 * - TOPIC: styled title
 * - TIMESTAMP // STATUS metadata
 * - DATA_BLOCK sections with styled rendering
 * - Quote block styling
 */

import { CopyOutlined } from '@ant-design/icons'
import { useSettings } from '@renderer/hooks/useSettings'
import { Collapse, ConfigProvider, message as antdMessage, Tooltip } from 'antd'
import { Archive, Check, ChevronRight, FileText, Quote } from 'lucide-react'
import type { FC } from 'react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

interface Props {
  /** Raw content from <<<DailyNoteStart>>> ... <<<DailyNoteEnd>>> block */
  content: string
}

/**
 * DATA_BLOCK section parsed from content
 */
interface DataBlock {
  title: string
  content: string
  icon?: string
}

/**
 * Parse DATA_BLOCK sections from content
 * Format: [DATA_BLOCK:Title] or [DATA_BLOCK:Icon:Title]
 * Ends at next [DATA_BLOCK:...] or [/DATA_BLOCK] or end of content
 */
function parseDataBlocks(content: string): { blocks: DataBlock[]; remainingContent: string } {
  const blocks: DataBlock[] = []
  let remainingContent = content

  // Pattern: [DATA_BLOCK:Title] or [DATA_BLOCK:Icon:Title] ... [/DATA_BLOCK] or next [DATA_BLOCK]
  const blockPattern = /\[DATA_BLOCK:([^\]]+)\]([\s\S]*?)(?=\[DATA_BLOCK:|$|\[\/DATA_BLOCK\])/gi
  let match

  while ((match = blockPattern.exec(content)) !== null) {
    const header = match[1].trim()
    const blockContent = match[2].trim()

    // Check if header has icon:title format
    let icon: string | undefined
    let title: string

    if (header.includes(':')) {
      const parts = header.split(':')
      if (parts.length === 2 && parts[0].length <= 4) {
        // Likely emoji or short icon
        icon = parts[0].trim()
        title = parts[1].trim()
      } else {
        title = header
      }
    } else {
      title = header
    }

    blocks.push({ title, content: blockContent, icon })

    // Remove matched block from remaining content
    remainingContent = remainingContent.replace(match[0], '')
  }

  // Clean up [/DATA_BLOCK] tags
  remainingContent = remainingContent.replace(/\[\/DATA_BLOCK\]/gi, '').trim()

  return { blocks, remainingContent }
}

/**
 * Parse DailyNote content to extract metadata
 */
function parseDailyNoteContent(content: string): {
  title: string
  date?: string
  category?: string
  tags?: string[]
  body: string
  status?: string
  archiveType?: string
  dataBlocks: DataBlock[]
} {
  const lines = content.trim().split('\n')
  let title = 'Daily Note'
  let date: string | undefined
  let category: string | undefined
  let tags: string[] | undefined
  let status: string | undefined
  let archiveType: string | undefined
  let bodyStartIndex = 0

  // Try to parse YAML frontmatter or key-value headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('title:') || line.startsWith('Title:') || line.startsWith('TOPIC:')) {
      title = line.split(':').slice(1).join(':').trim()
      bodyStartIndex = i + 1
    } else if (line.startsWith('date:') || line.startsWith('Date:') || line.startsWith('TIMESTAMP:')) {
      date = line.split(':').slice(1).join(':').trim()
      bodyStartIndex = i + 1
    } else if (line.startsWith('category:') || line.startsWith('Category:') || line.startsWith('TYPE:')) {
      category = line.split(':').slice(1).join(':').trim()
      bodyStartIndex = i + 1
    } else if (line.startsWith('tags:') || line.startsWith('Tags:')) {
      const tagStr = line.split(':').slice(1).join(':').trim()
      tags = tagStr
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
      bodyStartIndex = i + 1
    } else if (line.startsWith('status:') || line.startsWith('Status:') || line.startsWith('STATUS:')) {
      status = line.split(':').slice(1).join(':').trim()
      bodyStartIndex = i + 1
    } else if (line.startsWith('archive:') || line.startsWith('Archive:') || line.startsWith('ARCHIVE:')) {
      archiveType = line.split(':').slice(1).join(':').trim()
      bodyStartIndex = i + 1
    } else if (line === '---') {
      // Skip frontmatter delimiter
      bodyStartIndex = i + 1
    } else if (line && !line.startsWith('#')) {
      // Found body content
      break
    } else if (line.startsWith('#')) {
      // Markdown title
      title = line.replace(/^#+\s*/, '').trim()
      bodyStartIndex = i + 1
    }
  }

  const bodyContent = lines.slice(bodyStartIndex).join('\n').trim()

  // Parse DATA_BLOCK sections
  const { blocks: dataBlocks, remainingContent } = parseDataBlocks(bodyContent)
  const body = remainingContent

  // Default values
  if (!date) {
    date = new Date().toLocaleDateString('zh-CN')
  }
  if (!status) {
    status = 'RETRIEVED'
  }
  if (!archiveType) {
    archiveType = 'HISTORICAL ARCHIVE'
  }

  return { title, date, category, tags, body, status, archiveType, dataBlocks }
}

const VCPDailyNote: FC<Props> = ({ content }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()
  const { messageFont, fontSize } = useSettings()

  const noteData = useMemo(() => parseDailyNoteContent(content), [content])

  const copyContent = () => {
    navigator.clipboard.writeText(content)
    antdMessage.success({ content: t('message.copied'), key: 'copy-diary' })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  const getCollapseItems = () => {
    const uniqueKey = `diary-${Date.now()}`

    return [
      {
        key: uniqueKey,
        label: (
          <DiaryTitleLabel>
            <TitleContent>
              <ArchiveBadge>
                <Archive size={12} />
                <span>{noteData.archiveType}</span>
              </ArchiveBadge>
            </TitleContent>
            <ActionButtonsContainer>
              {noteData.category && <CategoryTag>{noteData.category}</CategoryTag>}
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
          </DiaryTitleLabel>
        ),
        children: (
          <DiaryBodyContainer
            style={{
              fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
              fontSize
            }}>
            {/* TOPIC: styled title */}
            <TopicRow>
              <TopicLabel>TOPIC:</TopicLabel>
              <TopicTitle>{noteData.title}</TopicTitle>
            </TopicRow>

            {/* TIMESTAMP // STATUS metadata */}
            <MetadataRow>
              <MetadataItem>
                <MetadataLabel>TIMESTAMP:</MetadataLabel>
                <MetadataValue>{noteData.date}</MetadataValue>
              </MetadataItem>
              <MetadataSeparator>//</MetadataSeparator>
              <MetadataItem>
                <MetadataLabel>STATUS:</MetadataLabel>
                <MetadataValue className="status">{noteData.status}</MetadataValue>
              </MetadataItem>
            </MetadataRow>

            {/* Tags */}
            {noteData.tags && noteData.tags.length > 0 && (
              <TagsContainer>
                {noteData.tags.map((tag, i) => (
                  <Tag key={i}>#{tag}</Tag>
                ))}
              </TagsContainer>
            )}

            {/* DATA_BLOCK sections */}
            {noteData.dataBlocks.length > 0 && (
              <DataBlocksContainer>
                {noteData.dataBlocks.map((block, i) => (
                  <DataBlockSection key={i}>
                    <DataBlockHeader>
                      {block.icon ? (
                        <DataBlockIcon>{block.icon}</DataBlockIcon>
                      ) : (
                        <DataBlockIconWrapper>
                          <FileText size={14} />
                        </DataBlockIconWrapper>
                      )}
                      <DataBlockTitle>{block.title}</DataBlockTitle>
                    </DataBlockHeader>
                    <DataBlockContent>{block.content}</DataBlockContent>
                  </DataBlockSection>
                ))}
              </DataBlocksContainer>
            )}

            {/* Content body */}
            <DiaryContent>{noteData.body || content}</DiaryContent>
          </DiaryBodyContainer>
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
      <DiaryContainer className="maid-diary-bubble vcp-diary-bubble">
        <DiaryWrapper>
          <CollapseContainer
            ghost
            activeKey={activeKeys}
            size="small"
            onChange={handleCollapseChange}
            className="message-diary-container"
            items={getCollapseItems()}
            expandIconPosition="end"
            expandIcon={({ isActive }) => (
              <ExpandIcon $isActive={isActive} size={18} color="var(--color-text-3)" strokeWidth={1.5} />
            )}
          />
        </DiaryWrapper>
      </DiaryContainer>
    </ConfigProvider>
  )
}

// Styled components
const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 4px var(--vcp-archive-accent, #00d2ff);
  }
  50% {
    box-shadow: 0 0 8px var(--vcp-archive-accent, #00d2ff), 0 0 12px rgba(0, 210, 255, 0.3);
  }
`

const DiaryContainer = styled.div`
  margin: 12px 0;
  background: var(--vcp-archive-bg, linear-gradient(135deg, rgba(10, 25, 33, 0.95), rgba(13, 42, 56, 0.95)));
  border: 1px solid var(--vcp-archive-border, rgba(0, 210, 255, 0.4));
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
`

const DiaryWrapper = styled.div`
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
    padding: 12px 16px !important;
    align-items: center !important;
    background: var(--vcp-archive-header-bg, rgba(0, 210, 255, 0.1));
  }

  .ant-collapse-content-box {
    padding: 0 !important;
  }

  .ant-collapse-item {
    border: none !important;
  }

  .ant-collapse-content {
    border-top: 1px solid var(--vcp-glass-border, rgba(255, 255, 255, 0.1));
  }
`

const DiaryTitleLabel = styled.div`
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

const ArchiveBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--vcp-archive-accent, #00d2ff);
  background: rgba(0, 210, 255, 0.15);
  padding: 5px 12px;
  border-radius: 4px;
  border: 1px solid var(--vcp-archive-accent, #00d2ff);
  animation: ${glowPulse} 3s ease-in-out infinite;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-items: center;
`

const CategoryTag = styled.span`
  font-size: 11px;
  color: var(--vcp-gold, #e8b95a);
  background: var(--vcp-gold-soft, rgba(232, 185, 90, 0.15));
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
`

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
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
    background-color: rgba(255, 255, 255, 0.15);
  }
`

const DiaryBodyContainer = styled.div`
  padding: 16px 18px;
`

const TopicRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vcp-glass-border, rgba(255, 255, 255, 0.1));
`

const TopicLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--color-text-3);
  font-family: 'Consolas', 'Monaco', monospace;
`

const TopicTitle = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 1px;
`

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
`

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const MetadataLabel = styled.span`
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--color-text-3);
  opacity: 0.7;
`

const MetadataValue = styled.span`
  color: var(--vcp-primary, #00d2ff);
  font-weight: 500;

  &.status {
    color: var(--vcp-tool-success, #4caf50);
  }
`

const MetadataSeparator = styled.span`
  color: var(--color-text-3);
  opacity: 0.5;
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
`

const Tag = styled.span`
  font-size: 12px;
  color: var(--vcp-primary, #00d2ff);
  background: var(--vcp-primary-soft, rgba(0, 210, 255, 0.15));
  padding: 3px 10px;
  border-radius: 10px;
`

const DiaryContent = styled.div`
  color: var(--color-text);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;

  /* Quote block styling */
  blockquote {
    border-left: 3px solid var(--vcp-primary, #00d2ff);
    padding-left: 14px;
    margin: 12px 0;
    color: var(--color-text-2);
    font-style: italic;
    background: rgba(0, 210, 255, 0.05);
    padding: 12px 14px;
    border-radius: 0 8px 8px 0;
  }
`

/* DATA_BLOCK styled components */
const DataBlocksContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
`

const DataBlockSection = styled.div`
  background: linear-gradient(
    145deg,
    rgba(139, 92, 246, 0.12) 0%,
    rgba(168, 85, 247, 0.06) 100%
  );
  border-left: 3px solid #8b5cf6;
  border-radius: 0 10px 10px 0;
  overflow: hidden;
`

const DataBlockHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(139, 92, 246, 0.1);
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
`

const DataBlockIcon = styled.span`
  font-size: 18px;
  line-height: 1;
`

const DataBlockIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
`

const DataBlockTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #a78bfa;
  letter-spacing: 0.5px;
`

const DataBlockContent = styled.div`
  padding: 12px 14px;
  color: var(--color-text);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;

  /* Quote styling within data blocks */
  .diary-quote,
  blockquote {
    border-left: 2px solid #8b5cf6;
    padding-left: 12px;
    margin: 8px 0;
    color: var(--color-text-2);
    font-style: italic;
    background: rgba(139, 92, 246, 0.05);
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
  }
`

export default memo(VCPDailyNote)

/**
 * Helper function to detect and parse DailyNote markers in message content
 * Supports VCPChat legacy format
 */
export function extractDailyNotes(content: string): string[] {
  const results: string[] = []

  // Match <<<DailyNoteStart>>>...<<<DailyNoteEnd>>> (VCPChat format)
  const pattern = /<<<DailyNoteStart>>>([\s\S]*?)<<<DailyNoteEnd>>>/g
  let match
  while ((match = pattern.exec(content)) !== null) {
    results.push(match[1].trim())
  }

  return results
}

/**
 * Check if content contains DailyNote markers
 */
export function hasDailyNotes(content: string): boolean {
  return /<<<DailyNoteStart>>>/.test(content)
}
