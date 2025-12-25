/**
 * 统一历史记录管理组件
 *
 * 提供绘画历史记录的统一管理功能：
 * - 历史记录列表展示
 * - 搜索和过滤
 * - 批量操作（删除、导出）
 * - 拖拽排序
 *
 * @requirements 4.2
 */

import { DeleteOutlined, DownloadOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { DraggableList } from '@renderer/components/DraggableList'
import Scrollbar from '@renderer/components/Scrollbar'
import FileManager from '@renderer/services/FileManager'
import type { FileMetadata, Painting, PaintingsState } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Button, Checkbox, Dropdown, Empty, Input, Popconfirm, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('PaintingHistory')

// ============================================================================
// 类型定义
// ============================================================================

export interface PaintingHistoryProps {
  /** 绘画记录列表 */
  paintings: Painting[]
  /** 当前选中的绘画 */
  selectedPainting?: Painting
  /** 选择绘画回调 */
  onSelectPainting: (painting: Painting) => void
  /** 删除绘画回调 */
  onDeletePainting: (painting: Painting) => void
  /** 新建绘画回调 */
  onNewPainting: () => void
  /** 更新绘画列表回调（用于拖拽排序）*/
  onUpdatePaintings?: (paintings: Painting[]) => void
  /** 命名空间（用于存储）- 保留用于未来扩展 */
  namespace?: keyof PaintingsState
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 是否显示过滤器 */
  showFilter?: boolean
  /** 是否启用批量选择 */
  enableBatchSelect?: boolean
  /** 是否启用拖拽排序 */
  enableDrag?: boolean
  /** 布局方向 */
  direction?: 'vertical' | 'horizontal'
  /** 缩略图尺寸 */
  thumbnailSize?: number
}

interface FilterOptions {
  hasImages: boolean | null
  dateRange: 'all' | 'today' | 'week' | 'month'
}

// ============================================================================
// 样式组件
// ============================================================================

const Container = styled(Scrollbar)<{ $direction: 'vertical' | 'horizontal' }>`
  display: flex;
  flex: 1;
  flex-direction: ${(props) => (props.$direction === 'horizontal' ? 'row' : 'column')};
  align-items: ${(props) => (props.$direction === 'horizontal' ? 'flex-start' : 'center')};
  gap: 10px;
  padding: 10px;
  background-color: var(--color-background);
  max-width: ${(props) => (props.$direction === 'horizontal' ? 'none' : '100px')};
  max-height: ${(props) => (props.$direction === 'horizontal' ? '120px' : 'none')};
  border-left: ${(props) => (props.$direction === 'horizontal' ? 'none' : '0.5px solid var(--color-border)')};
  border-top: ${(props) => (props.$direction === 'horizontal' ? '0.5px solid var(--color-border)' : 'none')};
  height: ${(props) => (props.$direction === 'horizontal' ? 'auto' : 'calc(100vh - var(--navbar-height))')};
  overflow-x: ${(props) => (props.$direction === 'horizontal' ? 'auto' : 'hidden')};
  overflow-y: ${(props) => (props.$direction === 'horizontal' ? 'hidden' : 'auto')};
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
`

const SearchInput = styled(Input)`
  .ant-input {
    font-size: 12px;
  }
`

const ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const CanvasWrapper = styled.div`
  position: relative;

  &:hover {
    .delete-button,
    .select-checkbox {
      opacity: 1;
    }
  }
`

const Canvas = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 1px solid var(--color-background-soft);
  overflow: hidden;
  position: relative;
  border-radius: 4px;

  &.selected {
    border: 2px solid var(--color-primary);
  }

  &.batch-selected {
    border: 2px solid var(--color-success);
  }

  &:hover {
    background-color: var(--color-background-mute);
  }
`

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const EmptyCanvas = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 10px;
`

const DeleteButton = styled.div.attrs({ className: 'delete-button' })`
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  color: var(--color-error);
  background-color: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  &:hover {
    background-color: var(--color-error);
    color: white;
  }
`

const SelectCheckbox = styled.div.attrs({ className: 'select-checkbox' })`
  position: absolute;
  top: 4px;
  left: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1;

  &.visible {
    opacity: 1;
  }
`

const NewPaintingButton = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  min-width: ${(props) => props.$size}px;
  min-height: ${(props) => props.$size}px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-2);

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const BatchToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: var(--color-background-soft);
  border-radius: 4px;
  margin-bottom: 8px;
`

const BatchInfo = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--color-text-tertiary);
`

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取绘画的缩略图 URL
 */
function getThumbnailUrl(painting: Painting): string | null {
  if (painting.files && painting.files.length > 0) {
    return FileManager.getFileUrl(painting.files[0])
  }
  if (painting.urls && painting.urls.length > 0) {
    return painting.urls[0]
  }
  return null
}

/**
 * 过滤绘画记录
 */
function filterPaintings(paintings: Painting[], searchText: string, filterOptions: FilterOptions): Painting[] {
  let filtered = [...paintings]

  // 搜索过滤
  if (searchText.trim()) {
    const lowerSearch = searchText.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.prompt?.toLowerCase().includes(lowerSearch) ||
        p.negativePrompt?.toLowerCase().includes(lowerSearch) ||
        p.model?.toLowerCase().includes(lowerSearch)
    )
  }

  // 是否有图片过滤
  if (filterOptions.hasImages !== null) {
    filtered = filtered.filter((p) => {
      const hasImages = (p.files && p.files.length > 0) || (p.urls && p.urls.length > 0)
      return filterOptions.hasImages ? hasImages : !hasImages
    })
  }

  // 日期范围过滤（如果有 createdAt 字段）
  // 注：当前 Painting 类型可能没有 createdAt，这里做兼容处理
  if (filterOptions.dateRange !== 'all') {
    const now = Date.now()
    const ranges: Record<string, number> = {
      today: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    }
    const range = ranges[filterOptions.dateRange]
    if (range) {
      filtered = filtered.filter((p) => {
        const createdAt = (p as any).createdAt
        if (!createdAt) return true // 没有时间戳的保留
        return now - createdAt <= range
      })
    }
  }

  return filtered
}

// ============================================================================
// 主组件
// ============================================================================

export const PaintingHistory: FC<PaintingHistoryProps> = ({
  paintings,
  selectedPainting,
  onSelectPainting,
  onDeletePainting,
  onNewPainting,
  onUpdatePaintings,
  namespace: _namespace, // 保留用于未来扩展
  showSearch = false,
  showFilter = false,
  enableBatchSelect = false,
  enableDrag = true,
  direction = 'vertical',
  thumbnailSize = 80
}) => {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    hasImages: null,
    dateRange: 'all'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)

  // 过滤后的绘画列表
  const filteredPaintings = useMemo(
    () => filterPaintings(paintings, searchText, filterOptions),
    [paintings, searchText, filterOptions]
  )

  // 切换批量选择
  const toggleBatchSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredPaintings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPaintings.map((p) => p.id)))
    }
  }, [filteredPaintings, selectedIds.size])

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    const toDelete = paintings.filter((p) => selectedIds.has(p.id))
    toDelete.forEach((p) => onDeletePainting(p))
    setSelectedIds(new Set())
    setBatchMode(false)
  }, [paintings, selectedIds, onDeletePainting])

  // 批量下载
  const handleBatchDownload = useCallback(async () => {
    const toDownload = paintings.filter((p) => selectedIds.has(p.id))
    const files: FileMetadata[] = []
    toDownload.forEach((p) => {
      if (p.files) {
        files.push(...p.files)
      }
    })

    if (files.length === 0) {
      window.toast?.warning?.(t('paintings.no_images_to_download'))
      return
    }

    // 下载文件
    for (const file of files) {
      try {
        const url = FileManager.getFileUrl(file)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name || `painting_${Date.now()}.png`
        link.click()
      } catch (error) {
        logger.error('Download failed:', error as Error)
      }
    }

    window.toast?.success?.(t('paintings.download_success', { count: files.length }))
  }, [paintings, selectedIds, t])

  // 过滤器菜单项
  const filterMenuItems = useMemo(
    () => [
      {
        key: 'hasImages',
        label: t('paintings.filter.has_images'),
        children: [
          { key: 'all', label: t('common.all') },
          { key: 'yes', label: t('common.yes') },
          { key: 'no', label: t('common.no') }
        ]
      },
      {
        key: 'dateRange',
        label: t('paintings.filter.date_range'),
        children: [
          { key: 'all', label: t('common.all') },
          { key: 'today', label: t('paintings.filter.today') },
          { key: 'week', label: t('paintings.filter.week') },
          { key: 'month', label: t('paintings.filter.month') }
        ]
      }
    ],
    [t]
  )

  // 处理过滤器选择
  const handleFilterSelect = useCallback(({ keyPath }: { keyPath: string[] }) => {
    const [value, type] = keyPath
    if (type === 'hasImages') {
      setFilterOptions((prev) => ({
        ...prev,
        hasImages: value === 'all' ? null : value === 'yes'
      }))
    } else if (type === 'dateRange') {
      setFilterOptions((prev) => ({
        ...prev,
        dateRange: value as FilterOptions['dateRange']
      }))
    }
  }, [])

  // 渲染单个绘画项
  const renderPaintingItem = useCallback(
    (item: Painting) => {
      const thumbnailUrl = getThumbnailUrl(item)
      const isSelected = selectedPainting?.id === item.id
      const isBatchSelected = selectedIds.has(item.id)

      return (
        <CanvasWrapper key={item.id}>
          <Canvas
            $size={thumbnailSize}
            className={classNames(isSelected && 'selected', isBatchSelected && 'batch-selected')}
            onClick={() => {
              if (batchMode) {
                toggleBatchSelect(item.id)
              } else {
                onSelectPainting(item)
              }
            }}>
            {thumbnailUrl ? (
              <ThumbnailImage src={thumbnailUrl} alt="" />
            ) : (
              <EmptyCanvas>{t('paintings.no_image')}</EmptyCanvas>
            )}
          </Canvas>

          {enableBatchSelect && (
            <SelectCheckbox className={batchMode ? 'visible' : ''}>
              <Checkbox
                checked={isBatchSelected}
                onChange={() => toggleBatchSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </SelectCheckbox>
          )}

          {!batchMode && (
            <DeleteButton onClick={(e) => e.stopPropagation()}>
              <Popconfirm
                title={t('paintings.button.delete.image.confirm')}
                onConfirm={() => onDeletePainting(item)}
                okButtonProps={{ danger: true }}
                placement="left">
                <DeleteOutlined />
              </Popconfirm>
            </DeleteButton>
          )}
        </CanvasWrapper>
      )
    },
    [
      selectedPainting,
      selectedIds,
      batchMode,
      thumbnailSize,
      enableBatchSelect,
      toggleBatchSelect,
      onSelectPainting,
      onDeletePainting,
      t
    ]
  )

  return (
    <Container $direction={direction} style={{ paddingBottom: dragging ? 80 : 10 }}>
      {/* 搜索和过滤 */}
      {(showSearch || showFilter || enableBatchSelect) && (
        <Header>
          {showSearch && (
            <SearchInput
              size="small"
              placeholder={t('common.search')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          )}
          <ToolbarRow>
            {showFilter && (
              <Dropdown menu={{ items: filterMenuItems, onClick: handleFilterSelect }} trigger={['click']}>
                <Button size="small" icon={<FilterOutlined />} />
              </Dropdown>
            )}
            {enableBatchSelect && (
              <Tooltip title={batchMode ? t('common.cancel') : t('paintings.batch_select')}>
                <Button
                  size="small"
                  type={batchMode ? 'primary' : 'default'}
                  onClick={() => {
                    setBatchMode(!batchMode)
                    if (batchMode) {
                      setSelectedIds(new Set())
                    }
                  }}>
                  {batchMode ? t('common.cancel') : t('paintings.batch')}
                </Button>
              </Tooltip>
            )}
          </ToolbarRow>
        </Header>
      )}

      {/* 批量操作工具栏 */}
      {batchMode && selectedIds.size > 0 && (
        <BatchToolbar>
          <Checkbox
            checked={selectedIds.size === filteredPaintings.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredPaintings.length}
            onChange={toggleSelectAll}
          />
          <BatchInfo>{t('paintings.selected_count', { count: selectedIds.size })}</BatchInfo>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleBatchDownload}>
            {t('common.download')}
          </Button>
          <Popconfirm
            title={t('paintings.batch_delete_confirm', { count: selectedIds.size })}
            onConfirm={handleBatchDelete}
            okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </BatchToolbar>
      )}

      {/* 新建按钮 */}
      {!dragging && (
        <NewPaintingButton $size={thumbnailSize} onClick={onNewPainting}>
          <PlusOutlined />
        </NewPaintingButton>
      )}

      {/* 绘画列表 */}
      {filteredPaintings.length === 0 ? (
        <EmptyContainer>
          <Empty description={t('paintings.no_paintings')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </EmptyContainer>
      ) : enableDrag && onUpdatePaintings ? (
        <DraggableList
          list={filteredPaintings}
          onUpdate={onUpdatePaintings}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setDragging(false)}>
          {renderPaintingItem}
        </DraggableList>
      ) : (
        filteredPaintings.map(renderPaintingItem)
      )}
    </Container>
  )
}

export default PaintingHistory
