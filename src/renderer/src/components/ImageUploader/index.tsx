/**
 * 通用图片上传组件
 *
 * 支持绘画页面和工作流节点复用
 * 功能：
 * - 多图片上传
 * - 图片预览和替换
 * - 图片删除
 * - 拖拽上传
 *
 * @requirements 5.1
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import type { FileMetadata } from '@renderer/types'
import { Popconfirm, Upload } from 'antd'
import { Button } from 'antd'
import type { RcFile, UploadProps } from 'antd/es/upload'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import styled from 'styled-components'

// ============================================================================
// 类型定义
// ============================================================================

export interface ImageUploaderProps {
  /** 图片文件列表 */
  images?: string[]
  /** 文件元数据（兼容旧接口）*/
  fileMap?: {
    imageFiles?: FileMetadata[]
    paths?: string[]
  }
  /** 最大图片数量 */
  maxImages?: number
  /** 清除所有图片回调 */
  onClearImages?: () => void
  /** 删除单张图片回调 */
  onDeleteImage: (index: number) => void
  /** 添加图片回调 */
  onAddImage: (file: File, index?: number) => void
  /** 图片变更回调（新接口）*/
  onImagesChange?: (images: string[]) => void
  /** 是否显示清除按钮 */
  showClearButton?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 接受的文件类型 */
  accept?: string
  /** 布局模式 */
  layout?: 'grid' | 'list'
  /** 每行显示数量（grid 模式）*/
  columns?: number
  /** 图片尺寸 */
  imageSize?: number
}

// ============================================================================
// 样式组件
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

const ImageGrid = styled.div<{ $columns: number; $imageSize: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.$columns}, ${(props) => props.$imageSize}px);
  gap: 8px;
`

const ImageList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const ImageItem = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
`

const ImagePreview = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover::after {
    content: '点击替换';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
`

const DeleteButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
  font-size: 10px;

  ${ImageItem}:hover & {
    opacity: 1;
  }

  &:hover {
    background-color: var(--color-error);
  }
`

const UploadButton = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-secondary);
  gap: 4px;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
`

const UploadText = styled.span`
  font-size: 11px;
`

const StyledUpload = styled(Upload)`
  .ant-upload {
    width: 100%;
    height: 100%;
  }
`

// ============================================================================
// 主组件
// ============================================================================

export const ImageUploader: FC<ImageUploaderProps> = memo(function ImageUploader({
  images,
  fileMap,
  maxImages = 4,
  onClearImages,
  onDeleteImage,
  onAddImage,
  onImagesChange,
  showClearButton = true,
  disabled = false,
  accept = 'image/png, image/jpeg, image/webp',
  layout = 'grid',
  columns = 2,
  imageSize = 80
}) {
  // Theme context available for future use
  useTheme()

  // 兼容旧接口：优先使用 images，否则使用 fileMap.paths
  const imagePaths = images || fileMap?.paths || []
  const imageCount = images?.length || fileMap?.imageFiles?.length || 0

  // 处理文件上传
  const handleBeforeUpload = useCallback(
    (file: RcFile, index?: number) => {
      if (onImagesChange) {
        // 新接口：转换为 base64
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          const newImages = [...imagePaths]
          if (index !== undefined) {
            newImages[index] = base64
          } else {
            newImages.push(base64)
          }
          onImagesChange(newImages)
        }
        reader.readAsDataURL(file)
      } else {
        // 旧接口
        onAddImage(file, index)
      }
      return false // 阻止默认上传行为
    },
    [imagePaths, onAddImage, onImagesChange]
  )

  // 处理删除
  const handleDelete = useCallback(
    (index: number) => {
      if (onImagesChange) {
        const newImages = imagePaths.filter((_, i) => i !== index)
        onImagesChange(newImages)
      } else {
        onDeleteImage(index)
      }
    },
    [imagePaths, onDeleteImage, onImagesChange]
  )

  // 处理清除全部
  const handleClearAll = useCallback(() => {
    if (onImagesChange) {
      onImagesChange([])
    } else if (onClearImages) {
      onClearImages()
    }
  }, [onClearImages, onImagesChange])

  // 自定义上传请求，不执行任何网络请求
  const customRequest: UploadProps['customRequest'] = ({ onSuccess }) => {
    if (onSuccess) {
      onSuccess('ok' as any)
    }
  }

  // 渲染图片项
  const renderImageItem = (src: string, index: number) => (
    <ImageItem key={index} $size={imageSize}>
      <StyledUpload
        accept={accept}
        maxCount={1}
        multiple={false}
        showUploadList={false}
        customRequest={customRequest}
        beforeUpload={(file) => handleBeforeUpload(file, index)}
        disabled={disabled}>
        <ImagePreview>
          <img src={src} alt={`预览图${index + 1}`} />
        </ImagePreview>
      </StyledUpload>
      {!disabled && (
        <Popconfirm
          title="确定要删除这张图片吗？"
          okText="确定"
          cancelText="取消"
          onConfirm={() => handleDelete(index)}>
          <DeleteButton>
            <DeleteOutlined />
          </DeleteButton>
        </Popconfirm>
      )}
    </ImageItem>
  )

  // 渲染上传按钮
  const renderUploadButton = () => (
    <StyledUpload
      accept={accept}
      multiple={false}
      maxCount={1}
      showUploadList={false}
      customRequest={customRequest}
      beforeUpload={(file) => handleBeforeUpload(file)}
      disabled={disabled}>
      <UploadButton $size={imageSize}>
        <PlusOutlined style={{ fontSize: 20 }} />
        <UploadText>添加图片</UploadText>
      </UploadButton>
    </StyledUpload>
  )

  const ImageContainer = layout === 'grid' ? ImageGrid : ImageList

  return (
    <Container>
      {/* 头部操作栏 */}
      {showClearButton && imageCount > 0 && (
        <HeaderContainer>
          <Button size="small" onClick={handleClearAll} disabled={disabled}>
            清除全部
          </Button>
        </HeaderContainer>
      )}

      {/* 图片列表 */}
      <ImageContainer $columns={columns} $imageSize={imageSize}>
        {imagePaths.map((src, index) => renderImageItem(src, index))}
        {imageCount < maxImages && renderUploadButton()}
      </ImageContainer>
    </Container>
  )
})

export default ImageUploader
