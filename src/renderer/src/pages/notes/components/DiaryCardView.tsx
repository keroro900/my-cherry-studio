import type { NotesTreeNode } from '@renderer/types/note'
import { Empty, Pagination, Tooltip } from 'antd'
import { ArrowLeft, BookOpen, FileText, Folder, Star } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css, keyframes } from 'styled-components'

export interface FolderInfo {
  name: string
  noteCount: number
  latestUpdate: string
  notes: NotesTreeNode[]
}

/** 从 treePath 提取文件夹名称 */
const getNotebookNameFromPath = (treePath: string, defaultName = 'Default'): string => {
  const parts = treePath.split('/').filter(Boolean)
  return parts.length > 1 ? parts[0] : defaultName
}

interface DiaryCardViewProps {
  notes: NotesTreeNode[]
  activeNodeId?: string
  pageSize?: number
  onSelectNote: (node: NotesTreeNode) => void
  onToggleStar?: (nodeId: string) => void
  isStreamMode?: boolean
  /** 显示文件夹卡片模式 - 先显示文件夹，点击进入查看笔记 */
  showFolderCards?: boolean
  /** 外部控制选中的文件夹 */
  selectedFolder?: string | null
  /** 文件夹选择回调 */
  onFolderSelect?: (folderName: string | null) => void
}

const DiaryCardView: FC<DiaryCardViewProps> = ({
  notes,
  activeNodeId,
  pageSize = 20,
  onSelectNote,
  onToggleStar,
  isStreamMode = false,
  showFolderCards = false,
  selectedFolder: externalSelectedFolder,
  onFolderSelect
}) => {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [internalSelectedFolder, setInternalSelectedFolder] = useState<string | null>(null)

  // 使用外部控制或内部状态
  const selectedFolder = externalSelectedFolder !== undefined ? externalSelectedFolder : internalSelectedFolder

  const handleFolderSelect = useCallback(
    (folderName: string | null) => {
      if (onFolderSelect) {
        onFolderSelect(folderName)
      } else {
        setInternalSelectedFolder(folderName)
      }
      setCurrentPage(1)
    },
    [onFolderSelect]
  )

  // Sort notes by update time (newest first) in stream mode
  const sortedNotes = useMemo(() => {
    if (!isStreamMode) return notes
    return [...notes].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt).getTime()
      return timeB - timeA
    })
  }, [notes, isStreamMode])

  // 按文件夹分组笔记
  const folderGroups = useMemo((): FolderInfo[] => {
    if (!showFolderCards) return []

    const groups: Record<string, FolderInfo> = {}

    notes.forEach((note) => {
      const folderName = getNotebookNameFromPath(note.treePath)
      if (!groups[folderName]) {
        groups[folderName] = {
          name: folderName,
          noteCount: 0,
          latestUpdate: note.updatedAt || note.createdAt,
          notes: []
        }
      }
      groups[folderName].notes.push(note)
      groups[folderName].noteCount++

      // 更新最新时间
      const currentTime = new Date(note.updatedAt || note.createdAt).getTime()
      const groupTime = new Date(groups[folderName].latestUpdate).getTime()
      if (currentTime > groupTime) {
        groups[folderName].latestUpdate = note.updatedAt || note.createdAt
      }
    })

    // 按最新更新时间排序文件夹
    return Object.values(groups).sort((a, b) => {
      return new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    })
  }, [notes, showFolderCards])

  // 获取当前显示的笔记（选中文件夹时只显示该文件夹的笔记）
  const displayNotes = useMemo(() => {
    if (!showFolderCards || !selectedFolder) return sortedNotes

    const folder = folderGroups.find((f) => f.name === selectedFolder)
    if (!folder) return sortedNotes

    // 对文件夹内的笔记按时间排序
    return [...folder.notes].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt).getTime()
      return timeB - timeA
    })
  }, [showFolderCards, selectedFolder, sortedNotes, folderGroups])

  // Paginate notes
  const paginatedNotes = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return displayNotes.slice(start, start + pageSize)
  }, [displayNotes, currentPage, pageSize])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const getGlowType = useCallback((updatedAt: string): 'green' | 'yellow' | null => {
    const now = Date.now()
    const updateTime = new Date(updatedAt).getTime()
    const diffMinutes = (now - updateTime) / 60000

    if (diffMinutes <= 10) return 'green'
    if (diffMinutes <= 30) return 'yellow'
    return null
  }, [])

  const getTimeDisplay = useCallback(
    (dateStr: string) => {
      try {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMinutes < 1) return t('notes.time_just_now', '刚刚')
        if (diffMinutes < 60) return t('notes.time_minutes_ago', { count: diffMinutes })
        if (diffHours < 24) return t('notes.time_hours_ago', { count: diffHours })
        if (diffDays < 7) return t('notes.time_days_ago', { count: diffDays })

        return date.toLocaleDateString()
      } catch {
        return dateStr
      }
    },
    [t]
  )

  // Extract notebook name from treePath for stream mode
  const getNotebookName = useCallback(
    (node: NotesTreeNode) => {
      return getNotebookNameFromPath(node.treePath, t('notes.default_notebook', 'Default'))
    },
    [t]
  )

  const getPreviewText = useCallback((name: string) => {
    // Remove .md extension and return as preview
    return name.replace(/\.md$/, '')
  }, [])

  if (notes.length === 0) {
    return (
      <EmptyContainer>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notes.no_notes')} />
      </EmptyContainer>
    )
  }

  // 文件夹卡片模式：显示文件夹列表
  if (showFolderCards && !selectedFolder) {
    return (
      <Container>
        <CardsGrid $isFolderView>
          {folderGroups.map((folder) => {
            const glowType = getGlowType(folder.latestUpdate)

            return (
              <FolderCard key={folder.name} $glowType={glowType} onClick={() => handleFolderSelect(folder.name)}>
                <FolderCardHeader>
                  <FolderIconWrapper $glowType={glowType}>
                    <Folder size={24} />
                  </FolderIconWrapper>
                  <FolderTitle title={folder.name}>{folder.name}</FolderTitle>
                </FolderCardHeader>
                <FolderStats>
                  <FolderStatItem>
                    <FileText size={12} />
                    <span>
                      {folder.noteCount} {t('notes.items', '篇')}
                    </span>
                  </FolderStatItem>
                </FolderStats>
                <FolderMeta>
                  <Tooltip title={new Date(folder.latestUpdate).toLocaleString()}>
                    <TimeText $glowType={glowType}>{getTimeDisplay(folder.latestUpdate)}</TimeText>
                  </Tooltip>
                </FolderMeta>
                {glowType && <GlowIndicator $type={glowType} />}
              </FolderCard>
            )
          })}
        </CardsGrid>
        <PaginationContainer>
          <StatusText>
            {t('notes.folder_count', { count: folderGroups.length })} · {t('notes.total_count', { count: notes.length })}
          </StatusText>
        </PaginationContainer>
      </Container>
    )
  }

  // 文件夹内部视图或普通卡片视图
  return (
    <Container>
      {/* 返回按钮 - 仅在文件夹卡片模式且已选中文件夹时显示 */}
      {showFolderCards && selectedFolder && (
        <BackHeader onClick={() => handleFolderSelect(null)}>
          <ArrowLeft size={16} />
          <BackText>{selectedFolder}</BackText>
          <NoteCountBadge>{displayNotes.length}</NoteCountBadge>
        </BackHeader>
      )}

      <CardsGrid>
        {paginatedNotes.map((note) => {
          const glowType = getGlowType(note.updatedAt)
          const isActive = note.id === activeNodeId
          const notebookName = isStreamMode ? getNotebookName(note) : null

          return (
            <NoteCard key={note.id} $isActive={isActive} $glowType={glowType} onClick={() => onSelectNote(note)}>
              <CardHeader>
                <CardIcon>
                  <FileText size={14} />
                </CardIcon>
                <CardTitle title={note.name}>{getPreviewText(note.name)}</CardTitle>
                {note.isStarred && (
                  <StarIcon
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleStar?.(note.id)
                    }}>
                    <Star size={12} fill="var(--color-status-warning)" stroke="var(--color-status-warning)" />
                  </StarIcon>
                )}
              </CardHeader>

              {isStreamMode && notebookName && (
                <NotebookBadge>
                  <BookOpen size={10} />
                  <span>{notebookName}</span>
                </NotebookBadge>
              )}

              <CardMeta>
                <Tooltip title={new Date(note.updatedAt).toLocaleString()}>
                  <TimeText $glowType={glowType}>{getTimeDisplay(note.updatedAt)}</TimeText>
                </Tooltip>
              </CardMeta>

              {glowType && <GlowIndicator $type={glowType} />}
            </NoteCard>
          )
        })}
      </CardsGrid>

      {displayNotes.length > pageSize && (
        <PaginationContainer>
          <StatusText>{t('notes.total_count', { count: displayNotes.length })}</StatusText>
          <Pagination
            current={currentPage}
            total={displayNotes.length}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
            size="small"
          />
        </PaginationContainer>
      )}
    </Container>
  )
}

const glowGreen = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.4), 0 0 16px rgba(34, 197, 94, 0.2);
  }
  50% {
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.6), 0 0 24px rgba(34, 197, 94, 0.3);
  }
`

const glowYellow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(234, 179, 8, 0.4), 0 0 16px rgba(234, 179, 8, 0.2);
  }
  50% {
    box-shadow: 0 0 12px rgba(234, 179, 8, 0.6), 0 0 24px rgba(234, 179, 8, 0.3);
  }
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`

const CardsGrid = styled.div<{ $isFolderView?: boolean }>`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $isFolderView }) => ($isFolderView ? '180px' : '160px')}, 1fr));
  gap: 10px;
  padding: 10px 12px;
  overflow-y: auto;
  overflow-x: hidden;
`

const NoteCard = styled.div<{ $isActive?: boolean; $glowType?: 'green' | 'yellow' | null }>`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  ${({ $isActive }) =>
    $isActive &&
    css`
      border-color: var(--color-primary);
      background: var(--color-primary-bg);
    `}

  ${({ $glowType }) =>
    $glowType === 'green' &&
    css`
      border-color: #22c55e;
      animation: ${glowGreen} 2s ease-in-out infinite;
    `}

  ${({ $glowType }) =>
    $glowType === 'yellow' &&
    css`
      border-color: #eab308;
      animation: ${glowYellow} 2s ease-in-out infinite;
    `}
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
`

const CardIcon = styled.div`
  flex-shrink: 0;
  color: var(--color-text-3);
`

const CardTitle = styled.h4`
  flex: 1;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StarIcon = styled.div`
  flex-shrink: 0;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;

  &:hover {
    background: var(--color-background-mute);
  }
`

const NotebookBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 10px;
  margin-bottom: 6px;
  width: fit-content;
`

const CardMeta = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const TimeText = styled.span<{ $glowType?: 'green' | 'yellow' | null }>`
  font-size: 11px;
  color: var(--color-text-3);

  ${({ $glowType }) =>
    $glowType === 'green' &&
    css`
      color: #22c55e;
      font-weight: 500;
    `}

  ${({ $glowType }) =>
    $glowType === 'yellow' &&
    css`
      color: #eab308;
      font-weight: 500;
    `}
`

const GlowIndicator = styled.div<{ $type: 'green' | 'yellow' }>`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $type }) => ($type === 'green' ? '#22c55e' : '#eab308')};
`

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-background-soft);
`

const StatusText = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

const EmptyContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
`

// 文件夹卡片样式
const FolderCard = styled.div<{ $glowType?: 'green' | 'yellow' | null }>`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 100px;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }

  ${({ $glowType }) =>
    $glowType === 'green' &&
    css`
      border-color: #22c55e;
      animation: ${glowGreen} 2s ease-in-out infinite;
    `}

  ${({ $glowType }) =>
    $glowType === 'yellow' &&
    css`
      border-color: #eab308;
      animation: ${glowYellow} 2s ease-in-out infinite;
    `}
`

const FolderCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`

const FolderIconWrapper = styled.div<{ $glowType?: 'green' | 'yellow' | null }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  color: var(--color-primary);

  ${({ $glowType }) =>
    $glowType === 'green' &&
    css`
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    `}

  ${({ $glowType }) =>
    $glowType === 'yellow' &&
    css`
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    `}
`

const FolderTitle = styled.h3`
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const FolderStats = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`

const FolderStatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-2);
`

const FolderMeta = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

// 返回导航栏样式
const BackHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
  transition: background 0.2s ease;

  &:hover {
    background: var(--color-background-mute);
  }
`

const BackText = styled.span`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`

const NoteCountBadge = styled.span`
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
`

export default DiaryCardView
