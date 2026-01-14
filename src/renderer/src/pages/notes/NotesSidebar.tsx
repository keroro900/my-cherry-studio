import { DynamicVirtualList } from '@renderer/components/VirtualList'
import { useActiveNode } from '@renderer/hooks/useNotesQuery'
import NotesSidebarHeader, { type ViewMode } from '@renderer/pages/notes/NotesSidebarHeader'
import { useAppSelector } from '@renderer/store'
import { selectSortType } from '@renderer/store/note'
import type { NotesSortType, NotesTreeNode } from '@renderer/types/note'
import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import { FilePlus, Folder, FolderUp, Loader2, Upload, X } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import DiaryCardView from './components/DiaryCardView'
import TreeNode from './components/TreeNode'
import {
  NotesActionsContext,
  NotesDragContext,
  NotesEditingContext,
  NotesSearchContext,
  NotesSelectionContext,
  NotesUIContext
} from './context/NotesContexts'
import { useDiaryFeatures, parseTimeExpression } from './hooks/useDiaryFeatures'
import { useFullTextSearch } from './hooks/useFullTextSearch'
import { useNotesDragAndDrop } from './hooks/useNotesDragAndDrop'
import { useNotesEditing } from './hooks/useNotesEditing'
import { useNotesFileUpload } from './hooks/useNotesFileUpload'
import { useNotesMenu } from './hooks/useNotesMenu'

interface NotesSidebarProps {
  onCreateFolder: (name: string, targetFolderId?: string) => void
  onCreateNote: (name: string, targetFolderId?: string) => void
  onSelectNode: (node: NotesTreeNode) => void
  onDeleteNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, newName: string) => void
  onToggleExpanded: (nodeId: string) => void
  onToggleStar: (nodeId: string) => void
  onMoveNode: (sourceNodeId: string, targetNodeId: string, position: 'before' | 'after' | 'inside') => void
  onSortNodes: (sortType: NotesSortType) => void
  onUploadFiles: (files: File[]) => void
  notesTree: NotesTreeNode[]
  selectedFolderId?: string | null
}

const NotesSidebar: FC<NotesSidebarProps> = ({
  onCreateFolder,
  onCreateNote,
  onSelectNode,
  onDeleteNode,
  onRenameNode,
  onToggleExpanded,
  onToggleStar,
  onMoveNode,
  onSortNodes,
  onUploadFiles,
  notesTree,
  selectedFolderId
}) => {
  const { t } = useTranslation()
  const { activeNode } = useActiveNode(notesTree)
  const sortType = useAppSelector(selectSortType)

  // 日记功能 hook
  const { diaryBooks } = useDiaryFeatures()
  const availableCharacters = useMemo(() => diaryBooks.map((b) => b.name), [diaryBooks])

  const [isShowStarred, setIsShowStarred] = useState(false)
  const [isShowSearch, setIsShowSearch] = useState(false)
  const [isShowDiary, setIsShowDiary] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [diaryFilter, setDiaryFilter] = useState<string | null>(null)
  const [diarySearchResults, setDiarySearchResults] = useState<NotesTreeNode[]>([])
  const [isDragOverSidebar, setIsDragOverSidebar] = useState(false)
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [selectedFolderForCards, setSelectedFolderForCards] = useState<string | null>(null)

  const notesTreeRef = useRef<NotesTreeNode[]>(notesTree)
  const virtualListRef = useRef<any>(null)
  const trimmedSearchKeyword = useMemo(() => searchKeyword.trim(), [searchKeyword])
  const hasSearchKeyword = trimmedSearchKeyword.length > 0

  const { editingNodeId, renamingNodeIds, newlyRenamedNodeIds, inPlaceEdit, handleStartEdit, handleAutoRename } =
    useNotesEditing({ onRenameNode })

  const {
    draggedNodeId,
    dragOverNodeId,
    dragPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  } = useNotesDragAndDrop({ onMoveNode })

  const { handleDropFiles, handleSelectFiles, handleSelectFolder } = useNotesFileUpload({
    onUploadFiles,
    setIsDragOverSidebar
  })

  const { getMenuItems } = useNotesMenu({
    renamingNodeIds,
    onCreateNote,
    onCreateFolder,
    onRenameNode,
    onToggleStar,
    onDeleteNode,
    onSelectNode,
    handleStartEdit,
    handleAutoRename,
    activeNode
  })

  const searchOptions = useMemo(
    () => ({
      debounceMs: 300,
      maxResults: 100,
      contextLength: 50,
      caseSensitive: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      enabled: isShowSearch
    }),
    [isShowSearch]
  )

  const {
    search,
    cancel,
    reset,
    isSearching,
    results: searchResults,
    stats: searchStats
  } = useFullTextSearch(searchOptions)

  useEffect(() => {
    notesTreeRef.current = notesTree
  }, [notesTree])

  useEffect(() => {
    if (!isShowSearch) {
      reset()
      return
    }

    if (hasSearchKeyword) {
      search(notesTreeRef.current, trimmedSearchKeyword)
    } else {
      reset()
    }
  }, [isShowSearch, hasSearchKeyword, trimmedSearchKeyword, search, reset])

  // --- Logic ---

  const handleCreateFolder = useCallback(() => {
    onCreateFolder(t('notes.untitled_folder'))
  }, [onCreateFolder, t])

  const handleCreateNote = useCallback(() => {
    onCreateNote(t('notes.untitled_note'))
  }, [onCreateNote, t])

  const handleToggleStarredView = useCallback(() => {
    setIsShowStarred(!isShowStarred)
  }, [isShowStarred])

  const handleToggleDiaryView = useCallback(() => {
    const newIsShowDiary = !isShowDiary
    setIsShowDiary(newIsShowDiary)

    if (newIsShowDiary) {
      // 进入日记模式时切换到卡片视图（文件夹卡片模式）
      setViewMode('card')
      setSelectedFolderForCards(null) // 重置文件夹选择
    } else {
      // 退出日记模式时恢复树形视图
      setViewMode('tree')
      setSelectedFolderForCards(null)
    }
  }, [isShowDiary])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    // 切换视图模式时重置文件夹选择
    setSelectedFolderForCards(null)
  }, [])

  const handleToggleSearchView = useCallback(() => {
    setIsShowSearch(!isShowSearch)
  }, [isShowSearch])

  const handleSelectSortType = useCallback(
    (selectedSortType: NotesSortType) => {
      onSortNodes(selectedSortType)
    },
    [onSortNodes]
  )

  // 时间表达式搜索处理
  const handleTimeSearch = useCallback(
    async (expression: string) => {
      const timeResult = parseTimeExpression(expression)
      if (!timeResult) {
        // 不是有效的时间表达式，当作普通搜索
        setSearchKeyword(expression)
        setIsShowSearch(true)
        setIsShowDiary(false)
        return
      }

      // 使用时间范围搜索日记
      try {
        const result = await window.api.vcpDiary.search({
          query: '',
          characterName: diaryFilter || undefined,
          dateFrom: timeResult.dateFrom,
          dateTo: timeResult.dateTo,
          limit: 100
        })

        if (result.success && result.entries) {
          // 将搜索结果转换为 NotesTreeNode 格式
          const nodes: NotesTreeNode[] = result.entries.map((entry) => ({
            id: entry.id,
            name: entry.title || entry.date,
            type: 'file' as const,
            treePath: `/${diaryFilter || 'diary'}/${entry.date}.md`,
            externalPath: '',
            createdAt: entry.date,
            updatedAt: entry.date
          }))
          setDiarySearchResults(nodes)
        }
      } catch (error) {
        console.error('Time search failed:', error)
      }
    },
    [diaryFilter]
  )

  const getEmptyAreaMenuItems = useCallback((): MenuProps['items'] => {
    return [
      {
        label: t('notes.new_note'),
        key: 'new_note',
        icon: <FilePlus size={14} />,
        onClick: handleCreateNote
      },
      {
        label: t('notes.new_folder'),
        key: 'new_folder',
        icon: <Folder size={14} />,
        onClick: handleCreateFolder
      },
      { type: 'divider' },
      {
        label: t('notes.upload_files'),
        key: 'upload_files',
        icon: <Upload size={14} />,
        onClick: handleSelectFiles
      },
      {
        label: t('notes.upload_folder'),
        key: 'upload_folder',
        icon: <FolderUp size={14} />,
        onClick: handleSelectFolder
      }
    ]
  }, [t, handleCreateNote, handleCreateFolder, handleSelectFiles, handleSelectFolder])

  // Flatten tree nodes for virtualization and filtering
  const flattenedNodes = useMemo(() => {
    const flattenForVirtualization = (
      nodes: NotesTreeNode[],
      depth: number = 0
    ): Array<{ node: NotesTreeNode; depth: number }> => {
      let result: Array<{ node: NotesTreeNode; depth: number }> = []

      for (const node of nodes) {
        result.push({ node, depth })

        // Include children only if the folder is expanded
        if (node.type === 'folder' && node.expanded && node.children && node.children.length > 0) {
          result = [...result, ...flattenForVirtualization(node.children, depth + 1)]
        }
      }
      return result
    }

    const flattenForFiltering = (nodes: NotesTreeNode[]): NotesTreeNode[] => {
      let result: NotesTreeNode[] = []

      for (const node of nodes) {
        if (isShowStarred) {
          if (node.type === 'file' && node.isStarred) {
            result.push(node)
          }
        }
        if (node.children && node.children.length > 0) {
          result = [...result, ...flattenForFiltering(node.children)]
        }
      }
      return result
    }

    // 日记模式筛选：按角色文件夹过滤
    const flattenForDiary = (nodes: NotesTreeNode[]): Array<{ node: NotesTreeNode; depth: number }> => {
      let result: Array<{ node: NotesTreeNode; depth: number }> = []

      for (const node of nodes) {
        // 如果有筛选条件，只显示匹配的文件夹及其内容
        if (diaryFilter) {
          if (node.type === 'folder' && node.name === diaryFilter) {
            // 匹配的文件夹 - 展开显示所有内容
            result.push({ node, depth: 0 })
            if (node.children) {
              for (const child of node.children) {
                if (child.type === 'file') {
                  result.push({ node: child, depth: 1 })
                }
              }
            }
          } else if (node.children) {
            // 递归搜索子文件夹
            const childResults = flattenForDiary(node.children)
            result = [...result, ...childResults]
          }
        } else {
          // 无筛选条件 - 显示所有日记本（顶层文件夹）
          if (node.type === 'folder') {
            result.push({ node, depth: 0 })
          }
        }
      }
      return result
    }

    if (isShowSearch) {
      if (hasSearchKeyword) {
        return searchResults.map((result) => ({ node: result, depth: 0 }))
      }
      return [] // 搜索关键词为空
    }

    if (isShowStarred) {
      const filteredNodes = flattenForFiltering(notesTree)
      return filteredNodes.map((node) => ({ node, depth: 0 }))
    }

    // 日记模式
    if (isShowDiary) {
      // 如果有时间搜索结果，显示搜索结果
      if (diarySearchResults.length > 0) {
        return diarySearchResults.map((node) => ({ node, depth: 0 }))
      }
      return flattenForDiary(notesTree)
    }

    return flattenForVirtualization(notesTree)
  }, [notesTree, isShowStarred, isShowSearch, isShowDiary, diaryFilter, diarySearchResults, hasSearchKeyword, searchResults])

  // All diary notes for stream mode (all files from all folders)
  const allDiaryNotes = useMemo(() => {
    if (!isShowDiary || viewMode !== 'stream') return []

    const collectAllFiles = (nodes: NotesTreeNode[]): NotesTreeNode[] => {
      let result: NotesTreeNode[] = []
      for (const node of nodes) {
        if (node.type === 'file') {
          result.push(node)
        }
        if (node.children && node.children.length > 0) {
          result = [...result, ...collectAllFiles(node.children)]
        }
      }
      return result
    }

    return collectAllFiles(notesTree)
  }, [notesTree, isShowDiary, viewMode])

  // Scroll to active node
  useEffect(() => {
    if (activeNode?.id && !isShowStarred && !isShowSearch && virtualListRef.current) {
      setTimeout(() => {
        const activeIndex = flattenedNodes.findIndex(({ node }) => node.id === activeNode.id)
        if (activeIndex !== -1) {
          virtualListRef.current?.scrollToIndex(activeIndex, {
            align: 'center',
            behavior: 'auto'
          })
        }
      }, 200)
    }
  }, [activeNode?.id, isShowStarred, isShowSearch, flattenedNodes])

  // Determine which items should be sticky (only folders in normal view)
  const isSticky = useCallback(
    (index: number) => {
      const item = flattenedNodes[index]
      if (!item) return false

      // Only folders should be sticky, and only in normal view (not search or starred)
      return item.node.type === 'folder' && !isShowSearch && !isShowStarred
    },
    [flattenedNodes, isShowSearch, isShowStarred]
  )

  // Get the depth of an item for hierarchical sticky positioning
  const getItemDepth = useCallback(
    (index: number) => {
      const item = flattenedNodes[index]
      return item?.depth ?? 0
    },
    [flattenedNodes]
  )

  const actionsValue = useMemo(
    () => ({
      getMenuItems,
      onSelectNode,
      onToggleExpanded,
      onDropdownOpenChange: setOpenDropdownKey
    }),
    [getMenuItems, onSelectNode, onToggleExpanded]
  )

  const selectionValue = useMemo(
    () => ({
      selectedFolderId,
      activeNodeId: activeNode?.id
    }),
    [selectedFolderId, activeNode?.id]
  )

  const editingValue = useMemo(
    () => ({
      editingNodeId,
      renamingNodeIds,
      newlyRenamedNodeIds,
      inPlaceEdit
    }),
    [editingNodeId, renamingNodeIds, newlyRenamedNodeIds, inPlaceEdit]
  )

  const dragValue = useMemo(
    () => ({
      draggedNodeId,
      dragOverNodeId,
      dragPosition,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd
    }),
    [
      draggedNodeId,
      dragOverNodeId,
      dragPosition,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleDragEnd
    ]
  )

  const searchValue = useMemo(
    () => ({
      searchKeyword: isShowSearch ? trimmedSearchKeyword : '',
      showMatches: isShowSearch
    }),
    [isShowSearch, trimmedSearchKeyword]
  )

  return (
    <NotesActionsContext value={actionsValue}>
      <NotesSelectionContext value={selectionValue}>
        <NotesEditingContext value={editingValue}>
          <NotesDragContext value={dragValue}>
            <NotesSearchContext value={searchValue}>
              <NotesUIContext value={{ openDropdownKey }}>
                <SidebarContainer
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (!draggedNodeId) {
                      setIsDragOverSidebar(true)
                    }
                  }}
                  onDragLeave={() => setIsDragOverSidebar(false)}
                  onDrop={(e) => {
                    if (!draggedNodeId) {
                      handleDropFiles(e)
                    }
                  }}>
                  <NotesSidebarHeader
                    isShowStarred={isShowStarred}
                    isShowSearch={isShowSearch}
                    isShowDiary={isShowDiary}
                    searchKeyword={searchKeyword}
                    sortType={sortType}
                    diaryFilter={diaryFilter}
                    availableCharacters={availableCharacters}
                    viewMode={viewMode}
                    onCreateFolder={handleCreateFolder}
                    onCreateNote={handleCreateNote}
                    onToggleStarredView={handleToggleStarredView}
                    onToggleSearchView={handleToggleSearchView}
                    onToggleDiaryView={handleToggleDiaryView}
                    onSetSearchKeyword={setSearchKeyword}
                    onSelectSortType={handleSelectSortType}
                    onSetDiaryFilter={setDiaryFilter}
                    onTimeSearch={handleTimeSearch}
                    onViewModeChange={handleViewModeChange}
                  />

                  <NotesTreeContainer>
                    {isShowSearch && isSearching && (
                      <SearchStatusBar>
                        <Loader2 size={14} className="animate-spin" />
                        <span>{t('notes.search.searching')}</span>
                        <CancelButton onClick={cancel} title={t('common.cancel')}>
                          <X size={14} />
                        </CancelButton>
                      </SearchStatusBar>
                    )}
                    {isShowSearch && !isSearching && hasSearchKeyword && searchStats.total > 0 && (
                      <SearchStatusBar>
                        <span>
                          {t('notes.search.found_results', {
                            count: searchStats.total,
                            nameCount: searchStats.fileNameMatches,
                            contentCount: searchStats.contentMatches + searchStats.bothMatches
                          })}
                        </span>
                      </SearchStatusBar>
                    )}

                    {/* Card View for Diary Mode */}
                    {isShowDiary && (viewMode === 'card' || viewMode === 'stream') && (
                      <DiaryCardView
                        notes={
                          viewMode === 'stream'
                            ? allDiaryNotes
                            : flattenedNodes.filter(({ node }) => node.type === 'file').map(({ node }) => node)
                        }
                        activeNodeId={activeNode?.id}
                        onSelectNote={onSelectNode}
                        onToggleStar={onToggleStar}
                        isStreamMode={viewMode === 'stream'}
                        showFolderCards={viewMode === 'card'}
                        selectedFolder={selectedFolderForCards}
                        onFolderSelect={setSelectedFolderForCards}
                      />
                    )}

                    {/* Tree View (default and search) */}
                    {(!isShowDiary || viewMode === 'tree') && (
                      <>
                        <Dropdown
                          menu={{ items: getEmptyAreaMenuItems() }}
                          trigger={['contextMenu']}
                          open={openDropdownKey === 'empty-area'}
                          onOpenChange={(open) => setOpenDropdownKey(open ? 'empty-area' : null)}>
                          <DynamicVirtualList
                            ref={virtualListRef}
                            list={flattenedNodes}
                            estimateSize={() => 28}
                            itemContainerStyle={{ padding: '8px 8px 0 8px' }}
                            overscan={10}
                            isSticky={isSticky}
                            getItemDepth={getItemDepth}>
                            {({ node, depth }) => <TreeNode node={node} depth={depth} renderChildren={false} />}
                          </DynamicVirtualList>
                        </Dropdown>
                        {!isShowStarred && !isShowSearch && !isShowDiary && (
                          <div style={{ padding: '0 8px', marginTop: '6px', marginBottom: '12px' }}>
                            <TreeNode
                              node={{
                                id: 'hint-node',
                                name: '',
                                type: 'hint',
                                treePath: '',
                                externalPath: '',
                                createdAt: '',
                                updatedAt: ''
                              }}
                              depth={0}
                              renderChildren={false}
                              onHintClick={handleSelectFolder}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </NotesTreeContainer>

                  {isDragOverSidebar && <DragOverIndicator />}
                </SidebarContainer>
              </NotesUIContext>
            </NotesSearchContext>
          </NotesDragContext>
        </NotesEditingContext>
      </NotesSelectionContext>
    </NotesActionsContext>
  )
}

export const SidebarContainer = styled.div`
  width: 250px;
  min-width: 250px;
  height: calc(100vh - var(--navbar-height));
  background-color: var(--color-background);
  border-right: 0.5px solid var(--color-border);
  border-top-left-radius: 10px;
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
`

export const NotesTreeContainer = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height) - 45px);
`

export const DragOverIndicator = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 123, 255, 0.1);
  border: 2px dashed rgba(0, 123, 255, 0.6);
  border-radius: 4px;
  pointer-events: none;
`

export const DropHintText = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  font-style: italic;
`

// 搜索相关样式
export const SearchStatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--color-background-soft);
  border-bottom: 0.5px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-2);

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

export const CancelButton = styled.button`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background-color: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-text);
  }

  &:active {
    background-color: var(--color-active);
  }
`

export default memo(NotesSidebar)
