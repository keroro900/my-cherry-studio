/**
 * 知识库浏览器组件
 *
 * 功能:
 * - 浏览日记文件列表
 * - 搜索和过滤
 * - 查看分块详情
 * - 标签管理
 */

import React, { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import type { DiaryFile, RAGTag } from './types'

// ==================== 样式组件 ====================

const BrowserContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
`

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
`

const SearchInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const FilterButton = styled.button<{ $active?: boolean }>`
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-bg-primary)')};
  color: ${(props) => (props.$active ? 'white' : 'var(--color-text-primary)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const FileList = styled.div`
  width: 280px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
`

const FileItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  background: ${(props) => (props.$selected ? 'var(--color-bg-soft)' : 'transparent')};
  transition: background 0.2s;

  &:hover {
    background: var(--color-bg-soft);
  }
`

const FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
`

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
`

const IndexStatus = styled.span<{ $indexed: boolean }>`
  color: ${(props) => (props.$indexed ? '#52c41a' : '#faad14')};
`

const DetailPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
`

const DetailTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`

const ActionButton = styled.button`
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const ChunkList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
`

const ChunkItem = styled.div`
  padding: 12px;
  margin-bottom: 8px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
`

const ChunkHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const ChunkTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
`

const ChunkTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const ChunkTag = styled.span<{ $color?: string }>`
  padding: 2px 8px;
  font-size: 11px;
  background: ${(props) => props.$color || 'var(--color-bg-secondary)'};
  color: ${(props) => (props.$color ? 'white' : 'var(--color-text-primary)')};
  border-radius: 10px;
`

const ChunkMeta = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 14px;
`

// ==================== 组件 ====================

interface KnowledgeBrowserProps {
  files: DiaryFile[]
  tags?: RAGTag[]
  loading?: boolean
  onFileSelect?: (file: DiaryFile) => void
  onEditFile?: (file: DiaryFile) => void
  onDeleteFile?: (file: DiaryFile) => void
  onReindexFile?: (file: DiaryFile) => void
  onTagClick?: (tag: string) => void
  className?: string
}

export const KnowledgeBrowser: React.FC<KnowledgeBrowserProps> = ({
  files,
  tags: _tags = [],
  loading = false,
  onFileSelect,
  onEditFile,
  onDeleteFile,
  onReindexFile,
  onTagClick: _onTagClick,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [filterIndexed, setFilterIndexed] = useState<boolean | null>(null)

  // 过滤文件
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!file.name.toLowerCase().includes(query) && !file.content.toLowerCase().includes(query)) {
          return false
        }
      }

      // 索引状态过滤
      if (filterIndexed !== null && file.isIndexed !== filterIndexed) {
        return false
      }

      return true
    })
  }, [files, searchQuery, filterIndexed])

  // 选中的文件
  const selectedFile = useMemo(() => {
    return files.find((f) => f.id === selectedFileId) || null
  }, [files, selectedFileId])

  // 处理文件选择
  const handleFileClick = useCallback(
    (file: DiaryFile) => {
      setSelectedFileId(file.id)
      onFileSelect?.(file)
    },
    [onFileSelect]
  )

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <BrowserContainer className={className}>
      {/* 搜索栏 */}
      <SearchBar>
        <SearchInput
          type="text"
          placeholder="搜索日记文件..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FilterButton
          $active={filterIndexed === true}
          onClick={() => setFilterIndexed(filterIndexed === true ? null : true)}>
          已索引
        </FilterButton>
        <FilterButton
          $active={filterIndexed === false}
          onClick={() => setFilterIndexed(filterIndexed === false ? null : false)}>
          未索引
        </FilterButton>
      </SearchBar>

      <ContentArea>
        {/* 文件列表 */}
        <FileList>
          {loading ? (
            <EmptyState>加载中...</EmptyState>
          ) : filteredFiles.length === 0 ? (
            <EmptyState>暂无日记文件</EmptyState>
          ) : (
            filteredFiles.map((file) => (
              <FileItem key={file.id} $selected={file.id === selectedFileId} onClick={() => handleFileClick(file)}>
                <FileName>{file.name}</FileName>
                <FileInfo>
                  <span>{formatSize(file.size)}</span>
                  <span>·</span>
                  <span>{file.chunks.length} 个分块</span>
                  <span>·</span>
                  <IndexStatus $indexed={file.isIndexed}>{file.isIndexed ? '已索引' : '未索引'}</IndexStatus>
                </FileInfo>
                <FileInfo style={{ marginTop: 4 }}>
                  <span>更新于 {formatDate(file.updatedAt)}</span>
                </FileInfo>
              </FileItem>
            ))
          )}
        </FileList>

        {/* 详情面板 */}
        <DetailPanel>
          {selectedFile ? (
            <>
              <DetailHeader>
                <DetailTitle>{selectedFile.name}</DetailTitle>
                <ActionButtons>
                  <ActionButton onClick={() => onEditFile?.(selectedFile)}>编辑</ActionButton>
                  <ActionButton onClick={() => onReindexFile?.(selectedFile)}>重新索引</ActionButton>
                  <ActionButton onClick={() => onDeleteFile?.(selectedFile)}>删除</ActionButton>
                </ActionButtons>
              </DetailHeader>

              <ChunkList>
                {selectedFile.chunks.length === 0 ? (
                  <EmptyState>暂无分块数据</EmptyState>
                ) : (
                  selectedFile.chunks.map((chunk) => (
                    <ChunkItem key={chunk.id}>
                      <ChunkHeader>
                        <ChunkTitle>{chunk.title || `分块 ${chunk.id.slice(0, 8)}`}</ChunkTitle>
                        <ChunkTags>
                          {chunk.category && <ChunkTag $color="#1890ff">{chunk.category}</ChunkTag>}
                          {chunk.season && <ChunkTag $color="#52c41a">{chunk.season}</ChunkTag>}
                          {chunk.styles?.slice(0, 2).map((style) => (
                            <ChunkTag key={style}>{style}</ChunkTag>
                          ))}
                        </ChunkTags>
                      </ChunkHeader>
                      <ChunkMeta>
                        <div>来源: {chunk.source}</div>
                        <div>
                          标签: {chunk.tags.slice(0, 5).join(', ')}
                          {chunk.tags.length > 5 && ` +${chunk.tags.length - 5}`}
                        </div>
                        <div>创建于 {formatDate(chunk.createdAt)}</div>
                      </ChunkMeta>
                    </ChunkItem>
                  ))
                )}
              </ChunkList>
            </>
          ) : (
            <EmptyState>选择一个文件查看详情</EmptyState>
          )}
        </DetailPanel>
      </ContentArea>
    </BrowserContainer>
  )
}

export default KnowledgeBrowser
