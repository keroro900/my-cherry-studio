/**
 * 节点内图片上传区域 v1.0
 * 支持拖拽上传，显示缩略图网格
 * 参考 YouArt 的设计风格
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateNode } from '@renderer/store/workflow'
import { Plus, X } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import styled from 'styled-components'

interface NodeImageDropZoneProps {
  nodeId: string
  /** 最大图片数量 */
  maxImages?: number
  /** 配置字段名 */
  configKey?: string
}

// 检测是否为图片文件
const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
}

// 获取文件名
const getBaseName = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

/**
 * 节点内图片上传区域
 */
function NodeImageDropZone({ nodeId, maxImages = 4, configKey = 'uploadedImages' }: NodeImageDropZoneProps) {
  const dispatch = useAppDispatch()
  const [isDragOver, setIsDragOver] = useState(false)

  // 获取当前节点的已上传图片
  const uploadedImages = useAppSelector((state) => {
    const node = state.workflow.nodes.find((n) => n.id === nodeId)
    return node?.data?.config?.[configKey] || []
  })

  // 获取当前 config
  const currentConfig = useAppSelector((state) => {
    const node = state.workflow.nodes.find((n) => n.id === nodeId)
    return node?.data?.config || {}
  })

  // 更新图片列表
  const updateImages = useCallback(
    (images: any[]) => {
      dispatch(
        updateNode({
          id: nodeId,
          data: {
            config: {
              ...currentConfig,
              [configKey]: images
            }
          }
        })
      )
    },
    [dispatch, nodeId, configKey, currentConfig]
  )

  // 处理拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((file) => isImageFile(file.name))

      if (imageFiles.length === 0) return

      const newImages: any[] = []
      for (const file of imageFiles) {
        const filePath = (window as any).api?.file?.getPathForFile?.(file)
        if (filePath) {
          newImages.push({
            name: file.name,
            path: filePath.replace(/\\/g, '/'),
            baseName: getBaseName(file.name)
          })
        }
      }

      if (newImages.length > 0) {
        const combined = [...uploadedImages, ...newImages].slice(0, maxImages)
        updateImages(combined)
      }
    },
    [uploadedImages, maxImages, updateImages]
  )

  // 删除图片
  const handleRemove = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation()
      const updated = uploadedImages.filter((_: any, i: number) => i !== index)
      updateImages(updated)
    },
    [uploadedImages, updateImages]
  )

  // 点击添加
  const handleClick = useCallback(async () => {
    if (uploadedImages.length >= maxImages) return

    try {
      const files = await (window as any).api?.file?.select?.({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] }]
      })

      if (files && files.length > 0) {
        const newImages = files.map((file: any) => ({
          name: file.name || file.path.split('/').pop() || file.path.split('\\').pop(),
          path: (file.path || file).replace(/\\/g, '/'),
          baseName: getBaseName(file.name || '')
        }))

        const combined = [...uploadedImages, ...newImages].slice(0, maxImages)
        updateImages(combined)
      }
    } catch (error) {
      console.error('选择文件失败', error)
    }
  }, [uploadedImages, maxImages, updateImages])

  // 阻止事件冒泡
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Container
      className="nodrag nowheel"
      $isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}>
      {uploadedImages.length === 0 ? (
        // 空状态 - 显示拖放提示
        <EmptyState onClick={handleClick}>
          <UploadIcon>
            <Plus size={20} />
          </UploadIcon>
          <UploadText>拖拽图片或点击上传</UploadText>
          <UploadHint>支持 JPG, PNG, WEBP</UploadHint>
        </EmptyState>
      ) : (
        // 有图片 - 显示缩略图网格
        <ImageGrid $count={uploadedImages.length}>
          {uploadedImages.slice(0, maxImages).map((img: any, index: number) => (
            <ImageItem key={`${img.path}-${index}`}>
              <img
                src={img.path.startsWith('file://') ? img.path : `file://${img.path}`}
                alt={img.name}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = 'data:image/svg+xml,...'
                }}
              />
              <ImageIndex>#{index + 1}</ImageIndex>
              <RemoveBtn onClick={(e) => handleRemove(index, e)}>
                <X size={12} />
              </RemoveBtn>
            </ImageItem>
          ))}
          {uploadedImages.length < maxImages && (
            <AddButton onClick={handleClick}>
              <Plus size={16} />
            </AddButton>
          )}
        </ImageGrid>
      )}
    </Container>
  )
}

export default memo(NodeImageDropZone)

// ==================== 样式 ====================

const Container = styled.div<{ $isDragOver: boolean }>`
  margin: 0 14px 10px;
  border-radius: 8px;
  border: 1.5px dashed
    ${({ $isDragOver }) => ($isDragOver ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${({ $isDragOver }) =>
    $isDragOver ? 'var(--color-primary-mute)' : 'var(--color-background)'};
  transition: all 0.2s ease;
  overflow: hidden;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-background-soft);
  }
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  cursor: pointer;
  min-height: 90px;
`

const UploadIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-background-soft);
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
  margin-bottom: 8px;
  transition: all 0.2s ease;

  ${EmptyState}:hover & {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-mute);
  }
`

const UploadText = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  font-weight: 500;
`

const UploadHint = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
  margin-top: 4px;
`

const ImageGrid = styled.div<{ $count: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $count }) => Math.min($count + 1, 4)}, 1fr);
  gap: 6px;
  padding: 8px;
`

const ImageItem = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border-mute);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover .remove-btn {
    opacity: 1;
  }
`

const ImageIndex = styled.span`
  position: absolute;
  bottom: 3px;
  left: 3px;
  font-size: 9px;
  color: white;
  background: rgba(0, 0, 0, 0.65);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
`

const RemoveBtn = styled.button`
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-error);
    transform: scale(1.1);
  }
`

const AddButton = styled.button`
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-mute);
  }
`
