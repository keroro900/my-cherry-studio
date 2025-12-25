/**
 * Art Studio 画布组件
 * 基于 cherrygemini-art-studio 的设计，适配 Cherry Studio
 */

import { Tooltip } from 'antd'
import { Download, Image as ImageIcon, Maximize2, SplitSquareHorizontal } from 'lucide-react'
import { memo } from 'react'
import styled from 'styled-components'

export interface GeneratedImage {
  id: string
  url: string
  originalImageUrl?: string
  prompt: string
  timestamp: number
  model?: string
}

interface ArtStudioCanvasProps {
  images: GeneratedImage[]
  isGenerating: boolean
  batchCount: number
  selectedImageId?: string | null
  onSelectImage?: (id: string) => void
  onDownload?: (image: GeneratedImage) => void
  onCompare?: (image: GeneratedImage) => void
  onFullscreen?: (image: GeneratedImage) => void
}

const CanvasContainer = styled.div`
  flex: 1;
  background: var(--color-background-soft);
  position: relative;
  overflow-y: auto;
  height: 100%;
  padding: 24px;
`

const BackgroundPattern = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  background-image: radial-gradient(#f43f5e 1px, transparent 1px);
  background-size: 24px 24px;
`

const EmptyState = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);

  .icon-wrapper {
    width: 80px;
    height: 80px;
    background: var(--color-background);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 8px 24px rgba(244, 63, 94, 0.1);
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: var(--color-text-secondary);
  }
`

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`

const ImageCard = styled.div`
  background: var(--color-background);
  border-radius: 20px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(244, 63, 94, 0.08);
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(244, 63, 94, 0.15);
  }
`

const ImageWrapper = styled.div`
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: var(--color-background-soft);

  img {
    width: 100%;
    height: auto;
    display: block;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    backdrop-filter: blur(2px);
  }

  &:hover .overlay {
    opacity: 1;
  }
`

const ActionButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: white;
  border: none;
  color: #f43f5e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    background: #f43f5e;
    color: white;
    transform: scale(1.1);
  }
`

const ImageInfo = styled.div`
  padding: 12px 8px 4px;

  .prompt {
    font-size: 13px;
    color: var(--color-text);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .time {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .model-tag {
    font-size: 10px;
    background: rgba(244, 63, 94, 0.1);
    color: #f43f5e;
    padding: 3px 8px;
    border-radius: 10px;
    font-weight: 600;
  }
`

const SkeletonCard = styled(ImageCard)`
  .skeleton-image {
    aspect-ratio: 1;
    background: linear-gradient(90deg, var(--color-background-soft) 25%, var(--color-background-mute) 50%, var(--color-background-soft) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 14px;
    margin-bottom: 12px;
  }

  .skeleton-text {
    height: 14px;
    background: var(--color-background-soft);
    border-radius: 4px;
    margin-bottom: 8px;

    &.short {
      width: 60%;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`

function ArtStudioCanvas({
  images,
  isGenerating,
  batchCount,
  onDownload,
  onCompare,
  onFullscreen
}: ArtStudioCanvasProps) {
  const handleDownload = (image: GeneratedImage) => {
    if (onDownload) {
      onDownload(image)
    } else {
      // 默认下载逻辑
      const link = document.createElement('a')
      link.href = image.url
      link.download = `cherry-art-${image.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleFullscreen = (image: GeneratedImage) => {
    if (onFullscreen) {
      onFullscreen(image)
    } else {
      window.open(image.url, '_blank')
    }
  }

  return (
    <CanvasContainer>
      <BackgroundPattern />

      {/* 空状态 */}
      {images.length === 0 && !isGenerating && (
        <EmptyState>
          <div className="icon-wrapper">
            <ImageIcon size={32} color="#f43f5e" />
          </div>
          <h2>画布为空</h2>
          <p>在左侧输入提示词开始创作</p>
        </EmptyState>
      )}

      {/* 图片网格 */}
      <ImageGrid>
        {/* 加载骨架屏 */}
        {isGenerating &&
          Array.from({ length: batchCount }).map((_, i) => (
            <SkeletonCard key={`skeleton-${i}`}>
              <div className="skeleton-image" />
              <div className="skeleton-text" />
              <div className="skeleton-text short" />
            </SkeletonCard>
          ))}

        {/* 生成的图片 */}
        {images.map((image) => (
          <ImageCard key={image.id}>
            <ImageWrapper>
              <img src={image.url} alt={image.prompt} loading="lazy" />
              <div className="overlay">
                <Tooltip title="下载">
                  <ActionButton onClick={() => handleDownload(image)}>
                    <Download size={18} />
                  </ActionButton>
                </Tooltip>
                <Tooltip title="全屏查看">
                  <ActionButton onClick={() => handleFullscreen(image)}>
                    <Maximize2 size={18} />
                  </ActionButton>
                </Tooltip>
                {image.originalImageUrl && onCompare && (
                  <Tooltip title="对比原图">
                    <ActionButton onClick={() => onCompare(image)}>
                      <SplitSquareHorizontal size={18} />
                    </ActionButton>
                  </Tooltip>
                )}
              </div>
            </ImageWrapper>
            <ImageInfo>
              <div className="prompt">{image.prompt}</div>
              <div className="meta">
                <span className="time">{new Date(image.timestamp).toLocaleTimeString()}</span>
                {image.model && <span className="model-tag">{image.model}</span>}
              </div>
            </ImageInfo>
          </ImageCard>
        ))}
      </ImageGrid>
    </CanvasContainer>
  )
}

export default memo(ArtStudioCanvas)
