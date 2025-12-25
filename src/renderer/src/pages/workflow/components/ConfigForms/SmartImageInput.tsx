/**
 * 智能图片输入组件 - Cherry 风格
 *
 * 功能特性:
 * 1. 路径批量加载 - 输入文件夹路径自动扫描图片
 * 2. 拖拽上传 - 支持拖放文件
 * 3. 点击选择 - 支持文件选择器
 * 4. 实际预览 - 显示图片缩略图
 * 5. 拖拽排序 - 调整图片顺序
 * 6. 批量操作 - 清空全部
 */

import {
  CheckCircleOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  LoadingOutlined,
  ReloadOutlined
} from '@ant-design/icons'
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
import { Button, Input, message, Modal, Progress, Tabs, Tooltip, Upload } from 'antd'
import type { RcFile } from 'antd/es/upload'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('SmartImageInput')

const { Dragger } = Upload

// ==================== 类型定义 ====================

export interface SmartImageItem {
  id: string
  path: string // 文件路径
  url: string // 显示用的 URL (base64 或 file://)
  name: string
  size?: number
  source: 'upload' | 'path' // 来源：上传还是路径扫描
  uploadProgress?: number // 上传进度 (0-100)
  status?: 'uploading' | 'done' | 'error' // 上传状态
}

interface SmartImageInputProps {
  value?: SmartImageItem[]
  onChange?: (images: SmartImageItem[]) => void
  maxImages?: number
  maxSizeMB?: number
  disabled?: boolean
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
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
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
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
  font-weight: 500;
`

const SourceBadge = styled.div<{ $source: 'upload' | 'path' }>`
  position: absolute;
  top: 4px;
  right: 4px;
  background: ${({ $source }) => ($source === 'path' ? '#722ed1' : '#1890ff')};
  color: white;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
`

const ImageName = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  font-size: 10px;
  padding: 10px 4px 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
`

const ImageCount = styled.div`
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  font-weight: 500;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`

const PathInputWrapper = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const StyledDragger = styled(Dragger)<{ $isDragOver?: boolean }>`
  .ant-upload-drag {
    background: ${({ $isDragOver }) => ($isDragOver ? 'var(--ant-color-primary-bg-hover)' : 'var(--color-background)')} !important;
    border: 2px dashed ${({ $isDragOver }) => ($isDragOver ? 'var(--color-primary)' : 'var(--ant-color-border)')} !important;
    border-radius: var(--list-item-border-radius) !important;
    transition: all 0.3s ease !important;
    padding: 16px !important;
    transform: ${({ $isDragOver }) => ($isDragOver ? 'scale(1.02)' : 'scale(1)')};

    &:hover {
      border-color: var(--color-primary) !important;
      background: var(--ant-color-primary-bg) !important;
    }
  }

  .ant-upload-drag-icon {
    margin-bottom: 8px !important;

    .anticon {
      color: ${({ $isDragOver }) => ($isDragOver ? 'var(--ant-color-success)' : 'var(--color-primary)')} !important;
      font-size: ${({ $isDragOver }) => ($isDragOver ? '40px' : '32px')} !important;
      transition: all 0.3s ease !important;
    }
  }

  .ant-upload-text {
    font-size: 13px !important;
    color: var(--ant-color-text) !important;
    font-weight: ${({ $isDragOver }) => ($isDragOver ? '600' : '400')} !important;
  }

  .ant-upload-hint {
    font-size: 11px !important;
    color: var(--ant-color-text-tertiary) !important;
  }
`

const UploadProgressOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--list-item-border-radius, 8px);
`

const UploadStatusIcon = styled.div<{ $status?: string }>`
  font-size: 24px;
  color: ${({ $status }) =>
    $status === 'done'
      ? 'var(--ant-color-success)'
      : $status === 'error'
        ? 'var(--ant-color-error)'
        : 'var(--color-primary)'};
`

const TabsWrapper = styled.div`
  .ant-tabs-nav {
    margin-bottom: 12px !important;
  }

  .ant-tabs-tab {
    padding: 6px 12px !important;
    font-size: 12px !important;
  }
`

// ==================== 可排序图片项组件 ====================

interface SortableImageItemProps {
  image: SmartImageItem
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

  const isUploading = image.status === 'uploading'
  const isDone = image.status === 'done'

  return (
    <ImageItemWrapper ref={setNodeRef} style={style} $isDragging={isDragging} {...attributes} {...listeners}>
      <ImageIndex>{index + 1}</ImageIndex>
      <SourceBadge $source={image.source}>{image.source === 'path' ? '路径' : '上传'}</SourceBadge>
      <ImagePreview src={image.url} alt={image.name} loading="lazy" />

      {/* 上传进度显示 */}
      {isUploading && (
        <UploadProgressOverlay>
          <UploadStatusIcon $status="uploading">
            <LoadingOutlined spin />
          </UploadStatusIcon>
          <Progress
            percent={image.uploadProgress || 0}
            size="small"
            strokeColor="var(--color-primary)"
            trailColor="rgba(255,255,255,0.3)"
            style={{ width: '70%', marginTop: 8 }}
            format={(percent) => <span style={{ color: 'white', fontSize: 11 }}>{percent}%</span>}
          />
        </UploadProgressOverlay>
      )}

      {/* 上传完成动画 */}
      {isDone && (
        <UploadProgressOverlay style={{ background: 'rgba(82, 196, 26, 0.3)', animation: 'fadeOut 1s forwards' }}>
          <UploadStatusIcon $status="done">
            <CheckCircleOutlined />
          </UploadStatusIcon>
        </UploadProgressOverlay>
      )}

      <ImageOverlay className="image-overlay">
        <Tooltip title="删除">
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
            disabled={disabled || isUploading}
          />
        </Tooltip>
      </ImageOverlay>
      <ImageName title={image.name}>{image.name}</ImageName>
    </ImageItemWrapper>
  )
})

SortableImageItem.displayName = 'SortableImageItem'

// ==================== 工具函数 ====================

/**
 * 生成唯一 ID
 */
const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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
 * 检查是否为图片文件
 */
const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
}

// ==================== 主组件 ====================

function SmartImageInput({
  value = [],
  onChange,
  maxImages = 20,
  maxSizeMB = 500, // 默认 500MB，基本无限制
  disabled = false
}: SmartImageInputProps) {
  const [images, setImages] = useState<SmartImageItem[]>(value)
  const [folderPath, setFolderPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [pathModalVisible, setPathModalVisible] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const uploadCounterRef = useRef(0) // 用于追踪并发上传

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 同步外部 value 变化
  useEffect(() => {
    if (value !== images) {
      setImages(value)
    }
  }, [value])

  // 更新图片列表
  const updateImages = useCallback(
    (newImages: SmartImageItem[]) => {
      setImages(newImages)
      onChange?.(newImages)
    },
    [onChange]
  )

  // 从文件夹路径加载图片
  const loadFromPath = useCallback(async () => {
    if (!folderPath.trim()) {
      message.warning('请输入文件夹路径')
      return
    }

    setLoading(true)
    try {
      // 使用 Electron API 读取目录
      const result = await window.api?.file?.listDirectory?.(folderPath.trim())

      if (!result || result.length === 0) {
        message.warning('文件夹为空或路径无效')
        setLoading(false)
        return
      }

      // 过滤出图片文件
      const imageFiles = result.filter((file: string) => isImageFile(file))

      if (imageFiles.length === 0) {
        message.warning('文件夹中没有找到图片文件')
        setLoading(false)
        return
      }

      // 计算可添加的数量
      const availableSlots = maxImages - images.length
      const filesToAdd = imageFiles.slice(0, availableSlots)

      if (filesToAdd.length < imageFiles.length) {
        message.info(`最多只能添加 ${maxImages} 张图片，已选择前 ${filesToAdd.length} 张`)
      }

      // 创建图片项
      const newImages: SmartImageItem[] = filesToAdd.map((filename: string) => {
        const fullPath = `${folderPath.trim().replace(/[\\/]$/, '')}/${filename}`
        return {
          id: generateId(),
          path: fullPath,
          url: `file://${fullPath.replace(/\\/g, '/')}`,
          name: filename,
          source: 'path' as const
        }
      })

      updateImages([...images, ...newImages])
      message.success(`已添加 ${newImages.length} 张图片`)
      setFolderPath('')
      setPathModalVisible(false)
    } catch (error) {
      logger.error('加载图片失败', { error })
      message.error('加载图片失败，请检查路径是否正确')
    } finally {
      setLoading(false)
    }
  }, [folderPath, images, maxImages, updateImages])

  // 选择文件夹
  const selectFolder = useCallback(async () => {
    try {
      const result = await window.api?.file?.selectFolder?.()
      if (result) {
        setFolderPath(result)
      }
    } catch (error) {
      logger.error('选择文件夹失败', { error })
    }
  }, [])

  // 添加单张图片 (上传) - 带进度显示
  const handleFileSelect = useCallback(
    async (file: RcFile): Promise<boolean> => {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        message.error('只能上传图片文件')
        return false
      }

      // 验证文件大小
      if (file.size / 1024 / 1024 >= maxSizeMB) {
        message.error(`图片大小不能超过 ${maxSizeMB}MB`)
        return false
      }

      // 验证数量
      if (images.length + uploadCounterRef.current >= maxImages) {
        message.error(`最多只能上传 ${maxImages} 张图片`)
        return false
      }

      // 增加计数器
      uploadCounterRef.current += 1

      const newId = generateId()
      const filePath = (file as any).path || file.name

      // 先创建一个带进度的占位项
      const placeholderImage: SmartImageItem = {
        id: newId,
        path: filePath,
        url: '', // 暂时为空
        name: file.name,
        size: file.size,
        source: 'upload',
        status: 'uploading',
        uploadProgress: 0
      }

      // 立即添加占位项
      setImages((prev) => [...prev, placeholderImage])

      try {
        // 模拟进度更新
        const progressInterval = setInterval(() => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === newId && img.uploadProgress !== undefined && img.uploadProgress < 90
                ? { ...img, uploadProgress: Math.min(90, img.uploadProgress + 10 + Math.random() * 20) }
                : img
            )
          )
        }, 100)

        const base64Url = await convertFileToBase64(file)

        clearInterval(progressInterval)

        // 更新为完成状态
        setImages((prev) =>
          prev.map((img) =>
            img.id === newId ? { ...img, url: base64Url, uploadProgress: 100, status: 'done' as const } : img
          )
        )

        // 1秒后清除完成状态
        setTimeout(() => {
          setImages((prev) =>
            prev.map((img) => (img.id === newId ? { ...img, status: undefined, uploadProgress: undefined } : img))
          )
        }, 1000)

        // 通知父组件
        onChange?.([
          ...images.filter((img) => img.id !== newId),
          {
            id: newId,
            path: filePath,
            url: base64Url,
            name: file.name,
            size: file.size,
            source: 'upload'
          }
        ])
      } catch (error) {
        message.error('图片处理失败')
        logger.error('Image conversion error', { error })
        // 移除失败的项
        setImages((prev) => prev.filter((img) => img.id !== newId))
      } finally {
        uploadCounterRef.current -= 1
      }

      return false
    },
    [images, maxImages, maxSizeMB, onChange]
  )

  // 移除图片
  const handleRemove = useCallback(
    (id: string) => {
      const newImages = images.filter((img) => img.id !== id)
      updateImages(newImages)
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
            {images.length} / {maxImages} 张
          </ImageCount>
          <ActionButtons>
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => setPathModalVisible(true)}
              disabled={disabled || remainingSlots === 0}>
              从路径添加
            </Button>
            <Button size="small" danger onClick={handleClearAll} disabled={disabled}>
              清空
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

      {/* 添加图片区域 */}
      {remainingSlots > 0 && (
        <TabsWrapper>
          <Tabs
            size="small"
            items={[
              {
                key: 'upload',
                label: '📤 拖拽上传',
                children: (
                  <div
                    onDragEnter={() => setIsDragOver(true)}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={() => setIsDragOver(false)}>
                    <StyledDragger
                      accept="image/*"
                      multiple
                      showUploadList={false}
                      beforeUpload={handleFileSelect}
                      disabled={disabled}
                      $isDragOver={isDragOver}>
                      <p className="ant-upload-drag-icon">{isDragOver ? <CheckCircleOutlined /> : <InboxOutlined />}</p>
                      <p className="ant-upload-text">{isDragOver ? '松开鼠标上传图片' : '拖放图片到此处或点击选择'}</p>
                      <p className="ant-upload-hint">还可添加 {remainingSlots} 张，支持批量</p>
                    </StyledDragger>
                  </div>
                )
              },
              {
                key: 'path',
                label: '📁 文件夹路径',
                children: (
                  <PathInputWrapper>
                    <Input
                      placeholder="输入文件夹路径，如: E:\images\前"
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      style={{ flex: 1 }}
                      disabled={disabled}
                    />
                    <Button icon={<FolderOpenOutlined />} onClick={selectFolder} disabled={disabled}>
                      浏览
                    </Button>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={loadFromPath}
                      loading={loading}
                      disabled={disabled || !folderPath.trim()}>
                      加载
                    </Button>
                  </PathInputWrapper>
                )
              }
            ]}
          />
        </TabsWrapper>
      )}

      {/* 路径添加弹窗 (从控制栏打开) */}
      <Modal
        title="从文件夹路径添加图片"
        open={pathModalVisible}
        onCancel={() => setPathModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPathModalVisible(false)}>
            取消
          </Button>,
          <Button key="load" type="primary" onClick={loadFromPath} loading={loading} disabled={!folderPath.trim()}>
            加载图片
          </Button>
        ]}>
        <PathInputWrapper style={{ marginTop: 16 }}>
          <Input
            placeholder="输入文件夹路径"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button icon={<FolderOpenOutlined />} onClick={selectFolder}>
            浏览
          </Button>
        </PathInputWrapper>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ant-color-text-tertiary)' }}>
          示例: E:\图片\前 或 C:\Users\Admin\Pictures
        </div>
      </Modal>
    </Container>
  )
}

export default memo(SmartImageInput)
