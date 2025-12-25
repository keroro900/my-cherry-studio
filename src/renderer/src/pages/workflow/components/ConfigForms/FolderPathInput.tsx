/**
 * 文件夹路径输入组件 - Cherry 风格 (增强版)
 *
 * 功能特性:
 * 1. 按键添加 - 点击按钮添加新的文件夹路径输入
 * 2. 每个路径对应一个输出端口
 * 3. 支持浏览选择文件夹
 * 4. 拖拽排序调整端口顺序
 * 5. 实时扫描文件夹中的图片文件
 * 6. 显示图片列表预览
 * 7. 支持图片匹配模式配置
 */

import {
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileImageOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { DragEndEvent } from '@dnd-kit/core'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { loggerService } from '@logger'
import { Button, Input, List, message, Modal, Tag, Tooltip } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('FolderPathInput')

// ==================== 类型定义 ====================

/**
 * 图片文件信息
 */
export interface ImageFileInfo {
  name: string // 文件名
  path: string // 完整路径
  size?: number // 文件大小 (bytes)
  baseName: string // 不含扩展名的文件名 (用于匹配)
}

/**
 * 文件夹路径项
 */
export interface FolderPathItem {
  id: string
  path: string // 文件夹路径
  label: string // 自定义标签 (可选)
  imageCount?: number // 该文件夹中的图片数量
  images?: ImageFileInfo[] // 扫描到的图片文件列表
  status: 'pending' | 'valid' | 'invalid' | 'loading' // 路径验证状态
  errorMessage?: string
}

interface FolderPathInputProps {
  value?: FolderPathItem[]
  onChange?: (items: FolderPathItem[]) => void
  maxPaths?: number
  disabled?: boolean
  onOutputsChange?: (outputs: { id: string; label: string }[]) => void // 通知父组件输出端口变化
}

// ==================== 样式组件 ====================

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const PathList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PathItemWrapper = styled.div<{ $isDragging?: boolean; $status: string }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-background);
  border: 1px solid
    ${({ $status }) =>
      $status === 'valid'
        ? 'var(--ant-color-success)'
        : $status === 'invalid'
          ? 'var(--ant-color-error)'
          : 'var(--ant-color-border)'};
  border-radius: var(--list-item-border-radius, 6px);
  transition: all 0.2s ease;
  cursor: grab;

  ${({ $isDragging }) =>
    $isDragging &&
    `
    opacity: 0.8;
    cursor: grabbing;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    background: var(--ant-color-bg-elevated);
  `}

  &:hover {
    border-color: var(--color-primary);
    background: var(--ant-color-bg-elevated);
  }
`

const DragHandle = styled.div`
  color: var(--ant-color-text-tertiary);
  cursor: grab;
  padding: 4px;
  display: flex;
  align-items: center;
  margin-top: 4px;

  &:hover {
    color: var(--ant-color-text-secondary);
  }
`

const PathIndex = styled.div`
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  margin-top: 2px;
`

const PathInputGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PathInputRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`

const LabelInput = styled(Input)`
  width: 100px !important;
  flex-shrink: 0;
`

const StatusIcon = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  color: ${({ $status }) =>
    $status === 'valid'
      ? 'var(--ant-color-success)'
      : $status === 'invalid'
        ? 'var(--ant-color-error)'
        : $status === 'loading'
          ? 'var(--color-primary)'
          : 'var(--ant-color-text-tertiary)'};
`

const ImageInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--ant-color-text-secondary);
  padding: 4px 8px;
  background: var(--ant-color-bg-elevated);
  border-radius: 4px;
`

const ImagePreviewGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 200px;
`

const ImageThumb = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--ant-color-bg-elevated);
  border: 1px solid var(--ant-color-border);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const AddButton = styled(Button)`
  width: 100%;
  border-style: dashed;
`

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
`

const PathCount = styled.div`
  font-size: 12px;
  color: var(--ant-color-text-secondary);
`

const ActionButtons = styled.div`
  display: flex;
  gap: 6px;
`

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: var(--ant-color-text-tertiary);
  font-size: 13px;
  background: var(--ant-color-bg-elevated);
  border-radius: 8px;
  border: 1px dashed var(--ant-color-border);
`

// ==================== 可排序路径项组件 ====================

interface SortablePathItemProps {
  item: FolderPathItem
  index: number
  onUpdate: (id: string, updates: Partial<FolderPathItem>) => void
  onRemove: (id: string) => void
  onBrowse: (id: string) => void
  onValidate: (id: string) => void
  onPreview: (item: FolderPathItem) => void
  disabled?: boolean
}

const SortablePathItem = memo(
  ({ item, index, onUpdate, onRemove, onBrowse, onValidate, onPreview, disabled }: SortablePathItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
      disabled
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition
    }

    // 显示前3张图片预览
    const previewImages = item.images?.slice(0, 3) || []

    return (
      <PathItemWrapper ref={setNodeRef} style={style} $isDragging={isDragging} $status={item.status}>
        <DragHandle {...attributes} {...listeners}>
          <HolderOutlined />
        </DragHandle>

        <PathIndex>{index + 1}</PathIndex>

        <PathInputGroup>
          <PathInputRow>
            <LabelInput
              size="small"
              placeholder="标签"
              value={item.label}
              onChange={(e) => onUpdate(item.id, { label: e.target.value })}
              disabled={disabled}
            />
            <Input
              size="small"
              placeholder="输入文件夹路径，如: E:\images\前"
              value={item.path}
              onChange={(e) => onUpdate(item.id, { path: e.target.value, status: 'pending', images: undefined })}
              disabled={disabled}
              style={{ flex: 1 }}
              suffix={
                <StatusIcon $status={item.status}>
                  {item.status === 'valid' && <CheckCircleOutlined />}
                  {item.status === 'invalid' && (
                    <Tooltip title={item.errorMessage}>
                      <WarningOutlined />
                    </Tooltip>
                  )}
                  {item.status === 'loading' && <ReloadOutlined spin />}
                </StatusIcon>
              }
            />
            <Tooltip title="浏览文件夹">
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => onBrowse(item.id)}
                disabled={disabled}
              />
            </Tooltip>
            <Tooltip title="扫描图片">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => onValidate(item.id)}
                disabled={disabled || !item.path}
              />
            </Tooltip>
          </PathInputRow>

          {/* 图片信息显示 */}
          {item.status === 'valid' && item.images && item.images.length > 0 && (
            <ImageInfoRow>
              <FileImageOutlined />
              <span>
                找到 <strong>{item.images.length}</strong> 张图片
              </span>

              {/* 图片预览 */}
              {previewImages.length > 0 && (
                <ImagePreviewGrid>
                  {previewImages.map((img, i) => (
                    <Tooltip key={i} title={img.name}>
                      <ImageThumb>
                        <img src={`file://${img.path.replace(/\\/g, '/')}`} alt={img.name} loading="lazy" />
                      </ImageThumb>
                    </Tooltip>
                  ))}
                  {item.images.length > 3 && (
                    <ImageThumb style={{ fontSize: 10, color: 'var(--ant-color-text-tertiary)' }}>
                      +{item.images.length - 3}
                    </ImageThumb>
                  )}
                </ImagePreviewGrid>
              )}

              <Tooltip title="查看全部图片">
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onPreview(item)}
                  style={{ padding: 0, height: 'auto' }}>
                  详情
                </Button>
              </Tooltip>
            </ImageInfoRow>
          )}

          {item.status === 'invalid' && item.errorMessage && (
            <span style={{ fontSize: 11, color: 'var(--ant-color-error)' }}>{item.errorMessage}</span>
          )}
        </PathInputGroup>

        <Tooltip title="删除">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            style={{ marginTop: 2 }}
          />
        </Tooltip>
      </PathItemWrapper>
    )
  }
)

SortablePathItem.displayName = 'SortablePathItem'

// ==================== 工具函数 ====================

const generateId = () => `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'].includes(ext)
}

/**
 * 获取文件名（不含扩展名）
 */
const getBaseName = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

// ==================== 主组件 ====================

function FolderPathInput({
  value = [],
  onChange,
  maxPaths = 10,
  disabled = false,
  onOutputsChange
}: FolderPathInputProps) {
  const [items, setItems] = useState<FolderPathItem[]>(value)
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; item: FolderPathItem | null }>({
    visible: false,
    item: null
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 同步外部 value 变化
  useEffect(() => {
    if (value !== items) {
      setItems(value)
    }
  }, [value])

  // 当 items 变化时通知父组件输出端口变化
  useEffect(() => {
    if (onOutputsChange) {
      const outputs = items.map((item, index) => ({
        id: `folder_${index + 1}`,
        label: item.label || `文件夹 ${index + 1}`
      }))
      onOutputsChange(outputs)
    }
  }, [items, onOutputsChange])

  // 更新 items
  const updateItems = useCallback(
    (newItems: FolderPathItem[]) => {
      setItems(newItems)
      onChange?.(newItems)
    },
    [onChange]
  )

  // 添加新路径
  const handleAdd = useCallback(() => {
    if (items.length >= maxPaths) {
      message.warning(`最多只能添加 ${maxPaths} 个文件夹路径`)
      return
    }

    const newItem: FolderPathItem = {
      id: generateId(),
      path: '',
      label: `路径 ${items.length + 1}`,
      status: 'pending'
    }

    updateItems([...items, newItem])
  }, [items, maxPaths, updateItems])

  // 更新单个路径
  const handleUpdate = useCallback(
    (id: string, updates: Partial<FolderPathItem>) => {
      const newItems = items.map((item) => (item.id === id ? { ...item, ...updates } : item))
      updateItems(newItems)
    },
    [items, updateItems]
  )

  // 删除路径
  const handleRemove = useCallback(
    (id: string) => {
      const newItems = items.filter((item) => item.id !== id)
      updateItems(newItems)
    },
    [items, updateItems]
  )

  // 浏览选择文件夹
  const handleBrowse = useCallback(
    async (id: string) => {
      try {
        const result = await window.api?.file?.selectFolder?.()
        if (result) {
          handleUpdate(id, { path: result, status: 'pending', images: undefined })
          // 自动验证
          validatePath(id, result)
        }
      } catch (error) {
        logger.error('选择文件夹失败', { error })
      }
    },
    [handleUpdate]
  )

  // 验证路径并扫描图片
  const validatePath = useCallback(
    async (id: string, pathToValidate?: string) => {
      const item = items.find((i) => i.id === id)
      const pathValue = pathToValidate || item?.path

      if (!pathValue) {
        handleUpdate(id, { status: 'invalid', errorMessage: '路径为空', images: undefined })
        return
      }

      handleUpdate(id, { status: 'loading' })

      try {
        // 使用 Cherry Studio 的 listDirectory API 读取目录
        // 返回的是文件路径字符串数组
        const files = await window.api?.file?.listDirectory?.(pathValue.trim(), {
          recursive: false,
          includeFiles: true,
          includeDirectories: false
        })

        if (!files || !Array.isArray(files)) {
          handleUpdate(id, { status: 'invalid', errorMessage: '无法读取目录', images: undefined })
          return
        }

        if (files.length === 0) {
          handleUpdate(id, { status: 'invalid', errorMessage: '目录为空', images: undefined })
          return
        }

        // 过滤图片文件并整理信息
        const imageFiles: ImageFileInfo[] = files
          .map((filePath: string) => {
            // 从完整路径提取文件名
            const parts = filePath.replace(/\\/g, '/').split('/')
            const name = parts[parts.length - 1]
            return {
              name,
              path: filePath.replace(/\\/g, '/'),
              baseName: getBaseName(name)
            }
          })
          .filter((file: ImageFileInfo) => isImageFile(file.name))
          .sort((a: ImageFileInfo, b: ImageFileInfo) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))

        if (imageFiles.length === 0) {
          handleUpdate(id, { status: 'invalid', errorMessage: '目录中没有图片文件', images: undefined })
          return
        }

        handleUpdate(id, {
          status: 'valid',
          imageCount: imageFiles.length,
          images: imageFiles,
          errorMessage: undefined
        })
      } catch (error) {
        logger.error('验证路径失败', { error, path: pathValue })
        handleUpdate(id, {
          status: 'invalid',
          errorMessage: '路径无效或无法访问',
          images: undefined
        })
      }
    },
    [items, handleUpdate]
  )

  // 验证所有路径
  const handleValidateAll = useCallback(() => {
    items.forEach((item) => {
      if (item.path) {
        validatePath(item.id)
      }
    })
  }, [items, validatePath])

  // 清空所有路径
  const handleClearAll = useCallback(() => {
    updateItems([])
    message.success('已清空所有路径')
  }, [updateItems])

  // 拖拽排序
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(items, oldIndex, newIndex)
          updateItems(newItems)
        }
      }
    },
    [items, updateItems]
  )

  // 查看图片详情
  const handlePreview = useCallback((item: FolderPathItem) => {
    setPreviewModal({ visible: true, item })
  }, [])

  const remainingSlots = maxPaths - items.length

  // 计算总图片数
  const totalImages = items.reduce((sum, item) => sum + (item.images?.length || 0), 0)

  return (
    <Container>
      {/* 控制栏 */}
      {items.length > 0 && (
        <ControlBar>
          <PathCount>
            {items.length} / {maxPaths} 个路径 | 共 {totalImages} 张图片
          </PathCount>
          <ActionButtons>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleValidateAll} disabled={disabled}>
              全部扫描
            </Button>
            <Button size="small" danger onClick={handleClearAll} disabled={disabled}>
              清空
            </Button>
          </ActionButtons>
        </ControlBar>
      )}

      {/* 路径列表 */}
      {items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <PathList>
              {items.map((item, index) => (
                <SortablePathItem
                  key={item.id}
                  item={item}
                  index={index}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onBrowse={handleBrowse}
                  onValidate={() => validatePath(item.id)}
                  onPreview={handlePreview}
                  disabled={disabled}
                />
              ))}
            </PathList>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState>
          <div style={{ marginBottom: 12 }}>📁 暂无文件夹路径</div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-quaternary)' }}>
            点击下方按钮添加文件夹路径
            <br />
            每个路径对应一个独立的输出端口
            <br />
            系统会自动扫描文件夹中的图片文件
          </div>
        </EmptyState>
      )}

      {/* 添加按钮 */}
      {remainingSlots > 0 && (
        <AddButton icon={<PlusOutlined />} onClick={handleAdd} disabled={disabled}>
          添加文件夹路径 ({remainingSlots} 个可用)
        </AddButton>
      )}

      {/* 图片预览弹窗 */}
      <Modal
        title={
          <span>
            📁 {previewModal.item?.label || '文件夹'} - 图片列表 ({previewModal.item?.images?.length || 0} 张)
          </span>
        }
        open={previewModal.visible}
        onCancel={() => setPreviewModal({ visible: false, item: null })}
        footer={null}
        width={600}>
        {previewModal.item?.images && (
          <List
            size="small"
            dataSource={previewModal.item.images}
            style={{ maxHeight: 400, overflow: 'auto' }}
            renderItem={(img, index) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <Tag color="blue">{index + 1}</Tag>
                  <ImageThumb style={{ width: 40, height: 40 }}>
                    <img src={`file://${img.path}`} alt={img.name} />
                  </ImageThumb>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{img.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                      匹配键: <code>{img.baseName}</code>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--ant-color-primary-bg)',
            borderRadius: 6,
            fontSize: 12
          }}>
          <strong>💡 图片匹配说明：</strong>
          <div style={{ marginTop: 4 }}>
            • <strong>按顺序匹配</strong>：不同文件夹的第N张图片会组成一组
          </div>
          <div>
            • <strong>按名称匹配</strong>：文件名（不含扩展名）相同的图片会组成一组
          </div>
          <div style={{ marginTop: 4, color: 'var(--ant-color-text-secondary)' }}>
            例如: 文件夹A的 "001.jpg" 和文件夹B的 "001.png" 会被匹配为一组
          </div>
        </div>
      </Modal>
    </Container>
  )
}

export default memo(FolderPathInput)
