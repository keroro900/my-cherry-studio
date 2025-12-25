/**
 * Cherry 风格多图输入组件
 * 集成 Cherry Studio 的图片处理最佳实践
 *
 * 功能特性:
 * - 支持拖放和点击选择
 * - 实际图片预览 (base64)
 * - 拖拽排序
 * - 批量操作 (全选/清空)
 * - Cherry 主题适配
 * - 支持文件路径和 base64 两种模式
 */

import { DeleteOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { loggerService } from '@logger'
import { Button, message, Tooltip, Upload } from 'antd'
import type { RcFile } from 'antd/es/upload'
import { memo, useCallback, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('MultiImageInput')

const { Dragger } = Upload

// ==================== 类型定义 ====================

export interface ImageItem {
  id: string
  url: string // base64 或文件路径
  isBase64: boolean
  name: string
  size?: number
}

interface MultiImageInputProps {
  value?: ImageItem[]
  onChange?: (images: ImageItem[]) => void
  maxImages?: number
  maxSizeMB?: number
  disabled?: boolean
  showUploadButton?: boolean
}

// ==================== 样式组件 ====================

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  width: 100%;
`

const ImageItemWrapper = styled.div<{ $isDragging?: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--list-item-border-radius, 8px);
  overflow: hidden;
  background: var(--color-background);
  border: 1px solid var(--ant-color-border);
  transition: all 0.2s ease;
  cursor: grab;

  ${({ $isDragging }) =>
    $isDragging &&
    `
    opacity: 0.5;
    cursor: grabbing;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `}

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:hover .image-overlay {
    opacity: 1;
  }
`

const ImagePreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const ImageOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
`

const ImageIndex = styled.div`
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
`

const ImageName = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  font-size: 11px;
  padding: 12px 6px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
`

const ImageCount = styled.div`
  font-size: 13px;
  color: var(--ant-color-text-secondary);
  font-weight: 500;
`

const StyledDragger = styled(Dragger)`
  .ant-upload-drag {
    background: var(--color-background) !important;
    border: 1px dashed var(--ant-color-border) !important;
    border-radius: var(--list-item-border-radius) !important;
    transition: all 0.2s ease !important;

    &:hover {
      border-color: var(--color-primary) !important;
    }
  }

  .ant-upload-drag-icon {
    margin-bottom: 12px !important;

    .anticon {
      color: var(--color-primary) !important;
      font-size: 42px !important;
    }
  }

  .ant-upload-text {
    font-size: 14px !important;
    color: var(--ant-color-text) !important;
    font-weight: 500 !important;
  }

  .ant-upload-hint {
    font-size: 12px !important;
    color: var(--ant-color-text-tertiary) !important;
  }
`

// ==================== 可排序图片项组件 ====================

interface SortableImageItemProps {
  image: ImageItem
  index: number
  onRemove: (id: string) => void
  disabled?: boolean
}

const SortableImageItem = memo(({ image, index, onRemove, disabled }: SortableImageItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <ImageItemWrapper ref={setNodeRef} style={style} $isDragging={isDragging} {...attributes} {...listeners}>
      <ImageIndex>{index + 1}</ImageIndex>
      <ImagePreview src={image.url} alt={image.name} />
      <ImageOverlay className="image-overlay">
        <Tooltip title="删除图片">
          <Button
            type="primary"
            danger
            shape="circle"
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(image.id)
            }}
            disabled={disabled}
          />
        </Tooltip>
      </ImageOverlay>
      <ImageName>{image.name}</ImageName>
    </ImageItemWrapper>
  )
})

SortableImageItem.displayName = 'SortableImageItem'

// ==================== 主组件 ====================

/**
 * 将文件转换为 base64
 */
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert file to base64'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * 生成唯一 ID
 */
const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

function MultiImageInput({
  value = [],
  onChange,
  maxImages = 10,
  maxSizeMB = 500, // 默认 500MB，基本无限制
  disabled = false,
  showUploadButton = true
}: MultiImageInputProps) {
  const [images, setImages] = useState<ImageItem[]>(value)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 更新图片列表
  const updateImages = useCallback(
    (newImages: ImageItem[]) => {
      setImages(newImages)
      onChange?.(newImages)
    },
    [onChange]
  )

  // 添加图片
  const handleFileSelect = useCallback(
    async (file: RcFile): Promise<boolean> => {
      // 验证文件类型
      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        message.error('只能上传图片文件')
        return false
      }

      // 验证文件大小
      const isLtMaxSize = file.size / 1024 / 1024 < maxSizeMB
      if (!isLtMaxSize) {
        message.error(`图片大小不能超过 ${maxSizeMB}MB`)
        return false
      }

      // 验证数量
      if (images.length >= maxImages) {
        message.error(`最多只能上传 ${maxImages} 张图片`)
        return false
      }

      try {
        // 转换为 base64
        const base64Url = await convertFileToBase64(file)

        const newImage: ImageItem = {
          id: generateId(),
          url: base64Url,
          isBase64: true,
          name: file.name,
          size: file.size
        }

        updateImages([...images, newImage])
        message.success(`已添加 ${file.name}`)
      } catch (error) {
        message.error('图片处理失败')
        logger.error('Image conversion error', { error })
      }

      return false // 阻止默认上传行为
    },
    [images, maxImages, maxSizeMB, updateImages]
  )

  // 移除图片
  const handleRemove = useCallback(
    (id: string) => {
      const newImages = images.filter((img) => img.id !== id)
      updateImages(newImages)
      message.success('已删除图片')
    },
    [images, updateImages]
  )

  // 清空所有图片
  const handleClearAll = useCallback(() => {
    updateImages([])
    message.success('已清空所有图片')
  }, [updateImages])

  // 拖拽排序
  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = images.findIndex((img) => img.id === active.id)
        const newIndex = images.findIndex((img) => img.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newImages = arrayMove(images, oldIndex, newIndex)
          updateImages(newImages)
        }
      }
    },
    [images, updateImages]
  )

  const remainingSlots = maxImages - images.length

  return (
    <Container>
      {/* 控制栏 */}
      {images.length > 0 && (
        <ControlBar>
          <ImageCount>
            {images.length} / {maxImages} 张图片
          </ImageCount>
          <ActionButtons>
            <Button size="small" danger onClick={handleClearAll} disabled={disabled}>
              清空全部
            </Button>
          </ActionButtons>
        </ControlBar>
      )}

      {/* 图片网格 */}
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            <ImageGrid>
              {images.map((image, index) => (
                <SortableImageItem
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={handleRemove}
                  disabled={disabled}
                />
              ))}
            </ImageGrid>
          </SortableContext>
        </DndContext>
      )}

      {/* 上传区域 */}
      {showUploadButton && remainingSlots > 0 && (
        <StyledDragger
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={handleFileSelect}
          disabled={disabled}
          maxCount={remainingSlots}>
          <p className="ant-upload-drag-icon">{images.length === 0 ? <InboxOutlined /> : <PlusOutlined />}</p>
          <p className="ant-upload-text">
            {images.length === 0 ? '拖放或点击添加图片' : `还可添加 ${remainingSlots} 张图片`}
          </p>
          <p className="ant-upload-hint">
            支持拖放多张图片，单个文件不超过 {maxSizeMB}MB
            <br />
            拖拽图片可调整顺序
          </p>
        </StyledDragger>
      )}
    </Container>
  )
}

export default memo(MultiImageInput)
