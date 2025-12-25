import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LoadingOutlined,
  PictureOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import type { ImageMessageBlock } from '@renderer/types/newMessage'
import { Image as AntdImage, Modal, Popover, Progress, Space, Tooltip } from 'antd'
import JSZip from 'jszip'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  block: ImageMessageBlock
  /** 是否显示元数据 */
  showMetadata?: boolean
  /** 显示模式：grid=网格缩略图，single=单图大图 */
  displayMode?: 'grid' | 'single'
  /** 网格列数 */
  gridColumns?: number
  /** 缩略图尺寸 */
  thumbnailSize?: number
  /** 是否启用批量选择 */
  enableBatchSelect?: boolean
  /** 选中的图片索引 */
  selectedIndices?: number[]
  /** 选择变更回调 */
  onSelectionChange?: (indices: number[]) => void
  /** 批量删除回调 */
  onBatchDelete?: (indices: number[]) => void
}

/**
 * 图片元数据接口
 */
interface ImageMetadata {
  prompt?: string
  negativePrompt?: string
  model?: string
  provider?: string
  imageSize?: string
  aspectRatio?: string
  promptSource?: 'promptJson' | 'preset' | 'auto' | 'custom'
  generatedAt?: string
  [key: string]: any
}

const logger = loggerService.withContext('MessageImage')

const MessageImage: FC<Props> = ({
  block,
  showMetadata = true,
  displayMode: initialDisplayMode = 'single',
  gridColumns = 4,
  thumbnailSize = 120,
  enableBatchSelect = false,
  selectedIndices = [],
  onSelectionChange,
  onBatchDelete
}) => {
  const { t } = useTranslation()
  const [metadataVisible, setMetadataVisible] = useState(false)
  const [displayMode, setDisplayMode] = useState<'grid' | 'single'>(initialDisplayMode)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
  const [retryCount, setRetryCount] = useState<Record<number, number>>({})
  const [batchMode, setBatchMode] = useState(false)
  const [localSelectedIndices, setLocalSelectedIndices] = useState<number[]>(selectedIndices)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)

  // 切换批量选择模式
  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) {
        // 退出批量模式时清空选择
        setLocalSelectedIndices([])
        onSelectionChange?.([])
      }
      return !prev
    })
  }, [onSelectionChange])

  // 切换单个图片选择
  const toggleImageSelection = useCallback(
    (index: number) => {
      setLocalSelectedIndices((prev) => {
        const newSelection = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        onSelectionChange?.(newSelection)
        return newSelection
      })
    },
    [onSelectionChange]
  )

  // 处理图片加载错误
  const handleImageError = useCallback((index: number) => {
    setFailedImages((prev) => new Set(prev).add(index))
  }, [])

  // 重试加载图片
  const handleRetry = useCallback((index: number) => {
    setFailedImages((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    setRetryCount((prev) => ({
      ...prev,
      [index]: (prev[index] || 0) + 1
    }))
  }, [])

  // 提取元数据
  const metadata: ImageMetadata | undefined = block.metadata?.generateImageResponse
    ? {
        prompt: block.metadata?.prompt,
        negativePrompt: block.metadata?.negativePrompt,
        model: block.metadata?.model,
        provider: block.metadata?.provider,
        imageSize: block.metadata?.params?.imageSize || block.metadata?.params?.size,
        aspectRatio: block.metadata?.params?.aspectRatio,
        promptSource: block.metadata?.promptSource,
        generatedAt: block.metadata?.generatedAt,
        ...block.metadata?.params
      }
    : undefined

  // 复制提示词到剪贴板
  const onCopyPrompt = useCallback(async () => {
    if (metadata?.prompt) {
      try {
        await navigator.clipboard.writeText(metadata.prompt)
        window.toast.success(t('message.copy.success'))
      } catch (error) {
        logger.error('复制提示词失败:', error as Error)
        window.toast.error(t('message.copy.failed'))
      }
    }
  }, [metadata?.prompt, t])

  const onDownload = (imageBase64: string, index: number) => {
    try {
      const link = document.createElement('a')
      link.href = imageBase64
      link.download = `image-${Date.now()}-${index}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.toast.success(t('message.download.success'))
    } catch (error) {
      logger.error('下载图片失败:', error as Error)
      window.toast.error(t('message.download.failed'))
    }
  }

  // 复制图片到剪贴板
  const onCopy = async (type: string, image: string) => {
    try {
      switch (type) {
        case 'base64': {
          // 处理 base64 格式的图片
          const parts = image.split(';base64,')
          if (parts.length === 2) {
            const mimeType = parts[0].replace('data:', '')
            const base64Data = parts[1]
            const byteCharacters = atob(base64Data)
            const byteArrays: BlobPart[] = []

            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512)
              const byteNumbers = new Array(slice.length)
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              byteArrays.push(byteArray as BlobPart)
            }

            const blob = new Blob(byteArrays, { type: mimeType })
            await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })])
          } else {
            throw new Error('无效的 base64 图片格式')
          }
          break
        }
        case 'url':
          {
            // 处理 URL 格式的图片
            const response = await fetch(image)
            const blob = await response.blob()

            await navigator.clipboard.write([
              new ClipboardItem({
                [blob.type]: blob
              })
            ])
          }
          break
      }

      window.toast.success(t('message.copy.success'))
    } catch (error) {
      logger.error('复制图片失败:', error as Error)
      window.toast.error(t('message.copy.failed'))
    }
  }

  const renderToolbar =
    (currentImage: string, currentIndex: number) =>
    (
      _: any,
      {
        transform: { scale },
        actions: { onFlipY, onFlipX, onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset }
      }: any
    ) => (
      <ToobarWrapper size={12} className="toolbar-wrapper">
        <SwapOutlined rotate={90} onClick={onFlipY} />
        <SwapOutlined onClick={onFlipX} />
        <RotateLeftOutlined onClick={onRotateLeft} />
        <RotateRightOutlined onClick={onRotateRight} />
        <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
        <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
        <UndoOutlined onClick={onReset} />
        <CopyOutlined onClick={() => onCopy(block.metadata?.generateImageResponse?.type!, currentImage)} />
        <DownloadOutlined onClick={() => onDownload(currentImage, currentIndex)} />
      </ToobarWrapper>
    )

  const images = useMemo(
    () =>
      block.metadata?.generateImageResponse?.images?.length
        ? block.metadata?.generateImageResponse?.images
        : block?.file?.path
          ? [`file://${block?.file?.path}`]
          : [],
    [block]
  )

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    setLocalSelectedIndices((prev) => {
      const newSelection = prev.length === images.length ? [] : images.map((_, i) => i)
      onSelectionChange?.(newSelection)
      return newSelection
    })
  }, [images, onSelectionChange])

  // 批量下载 - 打包为 ZIP
  const handleBatchDownload = useCallback(async () => {
    if (localSelectedIndices.length === 0) {
      window.toast?.warning?.(t('paintings.no_images_selected') || '请先选择图片')
      return
    }

    const selectedImages = localSelectedIndices.map((i) => images[i])
    const zip = new JSZip()
    const timestamp = Date.now()

    setDownloadProgress(0)

    try {
      // 将图片添加到 ZIP
      for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i]
        const fileName = `image-${timestamp}-${i + 1}.png`

        try {
          if (image.startsWith('data:')) {
            // Base64 图片
            const base64Data = image.split(',')[1]
            zip.file(fileName, base64Data, { base64: true })
          } else {
            // URL 图片
            const response = await fetch(image)
            const blob = await response.blob()
            zip.file(fileName, blob)
          }
        } catch (error) {
          logger.error(`添加图片 ${i + 1} 到 ZIP 失败:`, error as Error)
        }

        // 更新进度
        setDownloadProgress(Math.round(((i + 1) / selectedImages.length) * 80))
      }

      // 生成 ZIP 文件
      setDownloadProgress(90)
      const content = await zip.generateAsync({ type: 'blob' })

      // 下载 ZIP
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `images-${timestamp}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      setDownloadProgress(100)
      window.toast?.success?.(
        t('paintings.download_success', { count: selectedImages.length }) || `成功下载 ${selectedImages.length} 张图片`
      )

      // 延迟清除进度
      setTimeout(() => setDownloadProgress(null), 1000)
    } catch (error) {
      logger.error('批量下载失败:', error as Error)
      window.toast?.error?.(t('paintings.download_failed') || '下载失败')
      setDownloadProgress(null)
    }
  }, [localSelectedIndices, images, t])

  // 显示删除确认对话框
  const showDeleteConfirm = useCallback(() => {
    if (localSelectedIndices.length === 0) {
      window.toast?.warning?.(t('paintings.no_images_selected') || '请先选择图片')
      return
    }
    setDeleteConfirmVisible(true)
  }, [localSelectedIndices.length, t])

  // 确认批量删除
  const handleBatchDelete = useCallback(() => {
    onBatchDelete?.(localSelectedIndices)
    setLocalSelectedIndices([])
    setBatchMode(false)
    setDeleteConfirmVisible(false)
    window.toast?.success?.(
      t('paintings.delete_success', { count: localSelectedIndices.length }) ||
        `成功删除 ${localSelectedIndices.length} 张图片`
    )
  }, [localSelectedIndices, onBatchDelete, t])

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmVisible(false)
  }, [])

  // 是否显示多图控件
  const showMultiImageControls = images.length > 1

  // 导航到上一张
  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // 导航到下一张
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  // 切换显示模式
  const toggleDisplayMode = useCallback(() => {
    setDisplayMode((prev) => (prev === 'grid' ? 'single' : 'grid'))
  }, [])

  // 渲染元数据面板
  const renderMetadataPanel = () => {
    if (!metadata) return null

    return (
      <MetadataPanel>
        {metadata.prompt && (
          <MetadataItem>
            <MetadataLabel>{t('paintings.prompt') || '提示词'}</MetadataLabel>
            <MetadataValue>
              <PromptText>{metadata.prompt}</PromptText>
              <CopyButton onClick={onCopyPrompt}>
                <CopyOutlined />
              </CopyButton>
            </MetadataValue>
          </MetadataItem>
        )}
        {metadata.negativePrompt && (
          <MetadataItem>
            <MetadataLabel>{t('paintings.negative_prompt') || '反向提示词'}</MetadataLabel>
            <MetadataValue>
              <PromptText>{metadata.negativePrompt}</PromptText>
            </MetadataValue>
          </MetadataItem>
        )}
        {metadata.model && (
          <MetadataItem>
            <MetadataLabel>{t('common.model') || '模型'}</MetadataLabel>
            <MetadataValue>{metadata.model}</MetadataValue>
          </MetadataItem>
        )}
        {metadata.provider && (
          <MetadataItem>
            <MetadataLabel>{t('common.provider') || '提供商'}</MetadataLabel>
            <MetadataValue>{metadata.provider}</MetadataValue>
          </MetadataItem>
        )}
        {(metadata.imageSize || metadata.aspectRatio) && (
          <MetadataItem>
            <MetadataLabel>{t('paintings.image.size') || '尺寸'}</MetadataLabel>
            <MetadataValue>
              {metadata.imageSize}
              {metadata.aspectRatio && ` (${metadata.aspectRatio})`}
            </MetadataValue>
          </MetadataItem>
        )}
        {metadata.promptSource && (
          <MetadataItem>
            <MetadataLabel>{t('paintings.prompt_source') || '提示词来源'}</MetadataLabel>
            <MetadataValue>
              <SourceBadge $source={metadata.promptSource}>{metadata.promptSource}</SourceBadge>
            </MetadataValue>
          </MetadataItem>
        )}
      </MetadataPanel>
    )
  }

  // 渲染错误占位图
  const renderErrorPlaceholder = (index: number) => (
    <ErrorPlaceholder>
      <ErrorIcon>
        <PictureOutlined />
      </ErrorIcon>
      <ErrorText>{t('paintings.image_load_failed') || '图片加载失败'}</ErrorText>
      <RetryButton onClick={() => handleRetry(index)}>{t('common.retry') || '重试'}</RetryButton>
    </ErrorPlaceholder>
  )

  // 渲染网格模式
  const renderGridMode = () => (
    <ImageGrid $columns={gridColumns} $size={thumbnailSize}>
      {images.map((image, index) => (
        <GridItem
          key={`grid-${index}-${retryCount[index] || 0}`}
          $size={thumbnailSize}
          $selected={batchMode ? localSelectedIndices.includes(index) : index === currentIndex}
          onClick={() => {
            if (batchMode) {
              toggleImageSelection(index)
            } else if (!failedImages.has(index)) {
              setCurrentIndex(index)
              setDisplayMode('single')
            }
          }}>
          {failedImages.has(index) ? (
            renderErrorPlaceholder(index)
          ) : (
            <>
              <img src={image} alt={`图片 ${index + 1}`} onError={() => handleImageError(index)} />
              {batchMode && (
                <SelectCheckbox $selected={localSelectedIndices.includes(index)}>
                  {localSelectedIndices.includes(index) ? '✓' : ''}
                </SelectCheckbox>
              )}
              {!batchMode && (
                <GridOverlay>
                  <ZoomInOutlined />
                </GridOverlay>
              )}
            </>
          )}
        </GridItem>
      ))}
    </ImageGrid>
  )

  // 渲染单图模式
  const renderSingleMode = () => (
    <SingleImageWrapper>
      {showMultiImageControls && (
        <NavButton $position="left" onClick={goToPrev}>
          <LeftOutlined />
        </NavButton>
      )}
      {failedImages.has(currentIndex) ? (
        <ErrorPlaceholderLarge>
          <ErrorIcon>
            <PictureOutlined style={{ fontSize: 48 }} />
          </ErrorIcon>
          <ErrorText>{t('paintings.image_load_failed') || '图片加载失败'}</ErrorText>
          <RetryButton onClick={() => handleRetry(currentIndex)}>{t('common.retry') || '重试'}</RetryButton>
        </ErrorPlaceholderLarge>
      ) : (
        <AntdImage.PreviewGroup>
          <Image
            key={`single-${currentIndex}-${retryCount[currentIndex] || 0}`}
            src={images[currentIndex]}
            style={{ maxWidth: 500, maxHeight: 500 }}
            preview={{ toolbarRender: renderToolbar(images[currentIndex], currentIndex) }}
            onError={() => handleImageError(currentIndex)}
          />
        </AntdImage.PreviewGroup>
      )}
      {showMultiImageControls && (
        <NavButton $position="right" onClick={goToNext}>
          <RightOutlined />
        </NavButton>
      )}
      {showMultiImageControls && (
        <ImageCounter>
          {currentIndex + 1} / {images.length}
        </ImageCounter>
      )}
    </SingleImageWrapper>
  )

  return (
    <Container style={{ marginBottom: 8 }}>
      {/* 批量选择工具栏 */}
      {enableBatchSelect && showMultiImageControls && batchMode && (
        <BatchToolbar>
          <BatchCheckbox onClick={toggleSelectAll}>
            {localSelectedIndices.length === images.length ? '☑' : '☐'}
          </BatchCheckbox>
          <BatchInfo>
            {t('paintings.selected_count', { count: localSelectedIndices.length }) ||
              `已选择 ${localSelectedIndices.length} 张`}
          </BatchInfo>
          <BatchActionButton
            onClick={handleBatchDownload}
            disabled={localSelectedIndices.length === 0 || downloadProgress !== null}>
            {downloadProgress !== null ? <LoadingOutlined /> : <DownloadOutlined />} {t('common.download') || '下载'}
          </BatchActionButton>
          {onBatchDelete && (
            <BatchActionButton onClick={showDeleteConfirm} disabled={localSelectedIndices.length === 0} $danger>
              <DeleteOutlined /> {t('common.delete') || '删除'}
            </BatchActionButton>
          )}
          <BatchButton onClick={toggleBatchMode}>{t('common.cancel') || '取消'}</BatchButton>
        </BatchToolbar>
      )}

      {/* 下载进度条 */}
      {downloadProgress !== null && (
        <ProgressWrapper>
          <Progress percent={downloadProgress} size="small" status={downloadProgress === 100 ? 'success' : 'active'} />
        </ProgressWrapper>
      )}

      {/* 删除确认对话框 */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: 'var(--color-warning)', marginRight: 8 }} />
            {t('paintings.confirm_delete') || '确认删除'}
          </span>
        }
        open={deleteConfirmVisible}
        onOk={handleBatchDelete}
        onCancel={handleCancelDelete}
        okText={t('common.confirm') || '确认'}
        cancelText={t('common.cancel') || '取消'}
        okButtonProps={{ danger: true }}>
        <p>
          {t('paintings.delete_confirm_message', { count: localSelectedIndices.length }) ||
            `确定要删除选中的 ${localSelectedIndices.length} 张图片吗？此操作不可撤销。`}
        </p>
      </Modal>

      <ImageWrapper>
        {/* 显示模式切换按钮 */}
        {showMultiImageControls && (
          <ModeToggle onClick={toggleDisplayMode}>
            <Tooltip title={displayMode === 'grid' ? '单图模式' : '网格模式'}>
              {displayMode === 'grid' ? <PictureOutlined /> : <AppstoreOutlined />}
            </Tooltip>
          </ModeToggle>
        )}

        {/* 批量选择按钮 */}
        {enableBatchSelect && showMultiImageControls && !batchMode && (
          <BatchModeToggle onClick={toggleBatchMode}>
            <Tooltip title={t('paintings.batch_select') || '批量选择'}>☐</Tooltip>
          </BatchModeToggle>
        )}

        {/* 根据模式渲染 */}
        {displayMode === 'grid' && showMultiImageControls ? renderGridMode() : renderSingleMode()}

        {/* 元数据按钮 */}
        {showMetadata && metadata && (
          <MetadataButton>
            <Popover
              content={renderMetadataPanel()}
              title={t('paintings.image_info') || '图片信息'}
              trigger="click"
              open={metadataVisible}
              onOpenChange={setMetadataVisible}
              placement="bottomRight">
              <Tooltip title={t('paintings.view_info') || '查看信息'}>
                <InfoCircleOutlined />
              </Tooltip>
            </Popover>
          </MetadataButton>
        )}
      </ImageWrapper>
    </Container>
  )
}
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
`

const ImageWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const SingleImageWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`

const ImageGrid = styled.div<{ $columns: number; $size: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.$columns}, ${(props) => props.$size}px);
  gap: 8px;
`

const GridItem = styled.div<{ $size: number; $selected: boolean }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'transparent')};
  transition: all 0.2s;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    border-color: var(--color-primary);
  }
`

const GridOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
  font-size: 20px;

  ${GridItem}:hover & {
    opacity: 1;
  }
`

const NavButton = styled.button<{ $position: 'left' | 'right' }>`
  position: absolute;
  ${(props) => props.$position}: -40px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 5;

  &:hover {
    background: var(--color-primary);
    color: white;
  }
`

const ImageCounter = styled.div`
  position: absolute;
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-background-soft);
  padding: 2px 8px;
  border-radius: 10px;
`

const ModeToggle = styled.button`
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  ${ImageWrapper}:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`

const Image = styled(AntdImage)`
  padding: 5px;
  border-radius: 8px;
`

const ToobarWrapper = styled(Space)`
  padding: 0px 24px;
  color: #fff;
  font-size: 20px;
  background-color: rgba(238, 233, 233, 0.1);
  border-radius: 100px;
  .anticon {
    padding: 12px;
    cursor: pointer;
  }
  .anticon:hover {
    opacity: 0.3;
  }
`

const MetadataButton = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  ${ImageWrapper}:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`

const MetadataPanel = styled.div`
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
`

const MetadataItem = styled.div`
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`

const MetadataLabel = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
`

const MetadataValue = styled.div`
  font-size: 13px;
  color: var(--color-text);
  display: flex;
  align-items: flex-start;
  gap: 8px;
`

const PromptText = styled.div`
  flex: 1;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
  padding: 8px;
  background: var(--color-background-soft);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
`

const CopyButton = styled.button`
  flex-shrink: 0;
  padding: 4px 8px;
  border: none;
  background: var(--color-background-soft);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary);
    color: white;
  }
`

const SourceBadge = styled.span<{ $source: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: ${(props) => {
    switch (props.$source) {
      case 'promptJson':
        return 'var(--color-primary)'
      case 'preset':
        return 'var(--color-success)'
      case 'auto':
        return 'var(--color-warning)'
      default:
        return 'var(--color-text-secondary)'
    }
  }};
  color: white;
`

const ErrorPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-background-soft);
  gap: 4px;
`

const ErrorPlaceholderLarge = styled(ErrorPlaceholder)`
  width: 300px;
  height: 300px;
  border-radius: 8px;
  gap: 12px;
`

const ErrorIcon = styled.div`
  color: var(--color-text-tertiary);
  font-size: 24px;
`

const ErrorText = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const RetryButton = styled.button`
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const SelectCheckbox = styled.div<{ $selected: boolean }>`
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'white')};
  background: ${(props) => (props.$selected ? 'var(--color-primary)' : 'rgba(0, 0, 0, 0.3)')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  z-index: 5;
`

const BatchToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 8px;
`

const BatchCheckbox = styled.button`
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-primary);
  padding: 0;
`

const BatchInfo = styled.span`
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
`

const BatchButton = styled.button`
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const BatchActionButton = styled.button<{ $danger?: boolean }>`
  padding: 4px 12px;
  border: 1px solid ${(props) => (props.$danger ? 'var(--color-error)' : 'var(--color-primary)')};
  border-radius: 4px;
  background: ${(props) => (props.$danger ? 'var(--color-error)' : 'var(--color-primary)')};
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const BatchModeToggle = styled.button`
  position: absolute;
  top: 8px;
  left: 40px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  ${ImageWrapper}:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`

const ProgressWrapper = styled.div`
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 8px;
`

export default MessageImage
