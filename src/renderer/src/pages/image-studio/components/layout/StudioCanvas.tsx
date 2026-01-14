/**
 * Studio 画布组件
 *
 * 显示当前生成的图片预览，支持多图输出展示
 */

import { DownloadOutlined, ExpandOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { useAppSelector } from '@renderer/store'
import {
  selectActiveModule,
  selectCurrentProject,
  selectCurrentVersion,
  selectRunningTasks
} from '@renderer/store/imageStudio'
import { Progress, Spin, Tooltip } from 'antd'
import { Download, ImageIcon, Layers, RotateCcw, Shirt, Sparkles, Wand2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

interface OutputImage {
  key: string
  url: string
  label: string
}

const StudioCanvas: FC = () => {
  const { t } = useTranslation()
  const activeModule = useAppSelector(selectActiveModule)
  const currentProject = useAppSelector(selectCurrentProject)
  const currentVersion = useAppSelector(selectCurrentVersion)
  const runningTasks = useAppSelector(selectRunningTasks)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)

  // 收集所有输出图片
  const getOutputImages = useCallback((): OutputImage[] => {
    if (!currentVersion?.outputs) return []

    const images: OutputImage[] = []
    const outputs = currentVersion.outputs

    if (outputs.mainImage) {
      images.push({ key: 'main', url: outputs.mainImage, label: t('image_studio.output.main_image') })
    }
    if (outputs.backImage) {
      images.push({ key: 'back', url: outputs.backImage, label: t('image_studio.output.back_image') })
    }
    if (outputs.modelImage) {
      images.push({ key: 'model', url: outputs.modelImage, label: t('image_studio.output.model_image') })
    }
    if (outputs.patternImage) {
      images.push({ key: 'pattern', url: outputs.patternImage, label: t('image_studio.output.pattern_image') })
    }
    if (outputs.seamlessImage) {
      images.push({ key: 'seamless', url: outputs.seamlessImage, label: t('image_studio.output.seamless_image') })
    }
    if (outputs.image) {
      images.push({ key: 'output', url: outputs.image, label: t('image_studio.output.image') })
    }

    // 处理细节图数组
    if (outputs.detailImages && Array.isArray(outputs.detailImages)) {
      outputs.detailImages.forEach((url: string, index: number) => {
        images.push({
          key: `detail_${index}`,
          url,
          label: `${t('image_studio.output.detail_image')} ${index + 1}`
        })
      })
    }

    return images
  }, [currentVersion?.outputs, t])

  const outputImages = getOutputImages()
  const activeImage = selectedImage ? outputImages.find((img) => img.key === selectedImage) : outputImages[0]

  const isGenerating = currentVersion?.status === 'generating'
  const currentTask = runningTasks.find((task) => task.versionId === currentVersion?.id)
  const progress = currentTask?.progress

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 200))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 50))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(100)
  }, [])

  const handleDownload = useCallback((url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  }, [])

  const handleDownloadAll = useCallback(() => {
    outputImages.forEach((img, index) => {
      setTimeout(() => {
        handleDownload(img.url, `output_${img.key}_${Date.now()}.png`)
      }, index * 200)
    })
  }, [outputImages, handleDownload])

  // 根据模块获取图标和提示
  const getModuleInfo = () => {
    switch (activeModule) {
      case 'ecom':
        return {
          icon: <Shirt size={48} strokeWidth={1.2} />,
          title: t('image_studio.canvas.ecom_title'),
          hint: t('image_studio.canvas.ecom_hint')
        }
      case 'model':
        return {
          icon: <Wand2 size={48} strokeWidth={1.2} />,
          title: t('image_studio.canvas.model_title'),
          hint: t('image_studio.canvas.model_hint')
        }
      case 'pattern':
        return {
          icon: <Layers size={48} strokeWidth={1.2} />,
          title: t('image_studio.canvas.pattern_title'),
          hint: t('image_studio.canvas.pattern_hint')
        }
      default:
        return {
          icon: <ImageIcon size={48} strokeWidth={1.2} />,
          title: t('image_studio.canvas.empty'),
          hint: t('image_studio.canvas.hint')
        }
    }
  }

  // 空状态
  if (!currentProject) {
    const moduleInfo = getModuleInfo()
    return (
      <CanvasContainer>
        <EmptyState>
          <EmptyContent>
            <IconWrapper>
              <IconGlow />
              <IconInner>{moduleInfo.icon}</IconInner>
            </IconWrapper>
            <EmptyTitle>{moduleInfo.title}</EmptyTitle>
            <EmptyHint>{moduleInfo.hint}</EmptyHint>
            <FeatureList>
              <FeatureItem>
                <Sparkles size={14} />
                <span>{t('image_studio.canvas.feature_ai')}</span>
              </FeatureItem>
              <FeatureItem>
                <Download size={14} />
                <span>{t('image_studio.canvas.feature_export')}</span>
              </FeatureItem>
            </FeatureList>
          </EmptyContent>
        </EmptyState>
      </CanvasContainer>
    )
  }

  // 生成中状态
  if (isGenerating) {
    return (
      <CanvasContainer>
        <LoadingState>
          <LoadingIcon>
            <Spin size="large" />
          </LoadingIcon>
          <LoadingText>{t('image_studio.canvas.loading')}</LoadingText>
          {progress && (
            <ProgressWrapper>
              <Progress
                percent={Math.round((progress.current / progress.total) * 100)}
                status="active"
                strokeColor={{
                  '0%': 'var(--color-primary)',
                  '100%': 'var(--color-primary-light)'
                }}
              />
              {progress.step && <ProgressStep>{progress.step}</ProgressStep>}
            </ProgressWrapper>
          )}
        </LoadingState>
      </CanvasContainer>
    )
  }

  // 有输出图片
  if (outputImages.length > 0 && activeImage) {
    return (
      <CanvasContainer>
        {/* 工具栏 */}
        <Toolbar>
          <ToolbarLeft>
            <Tooltip title={t('image_studio.canvas.zoom_in')}>
              <ToolButton onClick={handleZoomIn}>
                <ZoomInOutlined />
              </ToolButton>
            </Tooltip>
            <ZoomLabel>{zoom}%</ZoomLabel>
            <Tooltip title={t('image_studio.canvas.zoom_out')}>
              <ToolButton onClick={handleZoomOut}>
                <ZoomOutOutlined />
              </ToolButton>
            </Tooltip>
            <Tooltip title={t('image_studio.canvas.reset_zoom')}>
              <ToolButton onClick={handleResetZoom}>
                <RotateCcw size={14} />
              </ToolButton>
            </Tooltip>
          </ToolbarLeft>
          <ToolbarRight>
            {outputImages.length > 1 && (
              <Tooltip title={t('image_studio.canvas.download_all')}>
                <ToolButton onClick={handleDownloadAll}>
                  <Download size={14} />
                  <span>{t('image_studio.canvas.download_all')}</span>
                </ToolButton>
              </Tooltip>
            )}
            <Tooltip title={t('image_studio.canvas.download')}>
              <ToolButton onClick={() => handleDownload(activeImage.url, `${activeImage.key}_${Date.now()}.png`)}>
                <DownloadOutlined />
              </ToolButton>
            </Tooltip>
            <Tooltip title={t('image_studio.canvas.fullscreen')}>
              <ToolButton>
                <ExpandOutlined />
              </ToolButton>
            </Tooltip>
          </ToolbarRight>
        </Toolbar>

        {/* 主图预览区 */}
        <MainPreviewArea>
          <ImagePreview $zoom={zoom}>
            <PreviewImage src={activeImage.url} alt={activeImage.label} $zoom={zoom} />
          </ImagePreview>
          <ImageLabel>{activeImage.label}</ImageLabel>
        </MainPreviewArea>

        {/* 多图缩略图列表 */}
        {outputImages.length > 1 && (
          <ThumbnailBar>
            {outputImages.map((img) => (
              <ThumbnailItem
                key={img.key}
                $active={img.key === (selectedImage || outputImages[0]?.key)}
                onClick={() => setSelectedImage(img.key)}>
                <ThumbnailImage src={img.url} alt={img.label} />
                <ThumbnailLabel>{img.label}</ThumbnailLabel>
              </ThumbnailItem>
            ))}
          </ThumbnailBar>
        )}
      </CanvasContainer>
    )
  }

  // 无输出状态 - 项目已创建但无结果
  const moduleInfo = getModuleInfo()
  return (
    <CanvasContainer>
      <EmptyState>
        <EmptyContent>
          <IconWrapper>
            <IconGlow />
            <IconInner>{moduleInfo.icon}</IconInner>
          </IconWrapper>
          <EmptyTitle>{t('image_studio.canvas.no_output')}</EmptyTitle>
          <EmptyHint>{t('image_studio.canvas.generate_hint')}</EmptyHint>
        </EmptyContent>
      </EmptyState>
    </CanvasContainer>
  )
}

export default StudioCanvas

// ============================================================================
// 样式
// ============================================================================

const CanvasContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, var(--color-background-soft) 0%, var(--color-background) 100%);
  overflow: hidden;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-background);
  border-bottom: 0.5px solid var(--color-border);
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ToolButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--color-text-2);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }
`

const ZoomLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  min-width: 40px;
  text-align: center;
`

const MainPreviewArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
`

const ImagePreview = styled.div<{ $zoom: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(${(props) => props.$zoom / 100});
  transition: transform 0.2s;
`

const PreviewImage = styled.img<{ $zoom: number }>`
  max-width: calc(100% * (100 / ${(props) => props.$zoom}));
  max-height: calc((100vh - var(--navbar-height) - 200px) * (100 / ${(props) => props.$zoom}));
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`

const ImageLabel = styled.div`
  margin-top: 12px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--color-text-2);
  background: var(--color-background);
  border-radius: 4px;
`

const ThumbnailBar = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background);
  border-top: 0.5px solid var(--color-border);
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const ThumbnailItem = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'var(--color-background-soft)')};

  &:hover {
    background: var(--color-background-mute);
  }
`

const ThumbnailImage = styled.img`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
`

const ThumbnailLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-2);
  white-space: nowrap;
`

const pulse = keyframes`
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
`

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`

const EmptyContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 320px;
  text-align: center;
`

const IconWrapper = styled.div`
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const IconGlow = styled.div`
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-primary-soft) 0%, transparent 70%);
  animation: ${pulse} 3s ease-in-out infinite;
`

const IconInner = styled.div`
  position: relative;
  color: var(--color-text-3);
  z-index: 1;
`

const EmptyTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
`

const EmptyHint = styled.p`
  font-size: 13px;
  color: var(--color-text-3);
  margin: 0;
  line-height: 1.5;
`

const FeatureList = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 8px;
`

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--color-text-2);
  background: var(--color-background);
  border-radius: 16px;
  border: 1px solid var(--color-border);
`

const LoadingState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
`

const LoadingIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`

const LoadingText = styled.div`
  color: var(--color-text-2);
  font-size: 14px;
`

const ProgressWrapper = styled.div`
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ProgressStep = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  text-align: center;
`
