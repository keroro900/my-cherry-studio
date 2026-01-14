/**
 * 节点结果预览组件 v3.0
 *
 * 设计逻辑：
 * - 生成后的图片在节点顶部显示大图预览（可展开/收起）
 * - 默认展开显示第一张图
 * - 多图时显示切换和缩略图条
 * - 点击可全屏查看
 */

import { ChevronDown, ChevronUp, Download, Grid, Image, Maximize2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'

import { IndexedDBImage } from '../common/IndexedDBImage'

interface NodeResultPreviewProps {
  result: {
    images?: string[]
    videos?: string[]
    text?: string
    image?: string
    output_image?: string
    [key: string]: any
  }
  /** 是否默认展开 */
  defaultExpanded?: boolean
  /** 节点类型 */
  nodeType?: string
}

// 检测是否为图片字符串
function isImageString(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  return (
    str.startsWith('data:image/') ||
    str.startsWith('indexeddb://') ||
    str.startsWith('file://') ||
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(str)
  )
}

// URL 转换函数
function toDisplayableUrl(src?: string): string | null {
  if (!src || typeof src !== 'string') return null
  if (src.startsWith('data:image') || src.startsWith('data:video')) return src
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('file://')) return src
  if (src.startsWith('indexeddb://')) return src
  if (/^[A-Za-z]:\\/.test(src)) {
    return 'file:///' + src.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, '$1:/')
  }
  if (src.startsWith('\\')) {
    return 'file:' + src.replace(/\\/g, '/')
  }
  return null
}

/**
 * 节点结果预览（顶部大图）
 */
function NodeResultPreview({ result, defaultExpanded = true }: NodeResultPreviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)

  // 收集所有图片
  const allImages = useMemo(() => {
    if (!result) return []

    const images: string[] = []

    // 收集 images 数组
    if (Array.isArray(result.images)) {
      images.push(...result.images.filter((img: any) => typeof img === 'string' && isImageString(img)))
    }

    // 收集 all_images
    if (Array.isArray(result.all_images)) {
      result.all_images
        .filter((img: any) => typeof img === 'string' && isImageString(img) && !images.includes(img))
        .forEach((img: string) => images.push(img))
    }

    // 收集单图输出
    if (result.image && typeof result.image === 'string' && isImageString(result.image) && !images.includes(result.image)) {
      images.push(result.image)
    }
    if (result.output_image && typeof result.output_image === 'string' && isImageString(result.output_image) && !images.includes(result.output_image)) {
      images.push(result.output_image)
    }

    // 收集动态端口图片
    Object.keys(result).forEach((key) => {
      if (key.match(/^image_\d+$/) && typeof result[key] === 'string' && isImageString(result[key]) && !images.includes(result[key])) {
        images.push(result[key])
      }
    })

    return images
  }, [result])

  // 检查是否有视频输出
  const allVideos = useMemo(() => {
    if (!result) return []
    const videos: string[] = []

    if (Array.isArray(result.videos)) {
      videos.push(...result.videos.filter((v: any) => typeof v === 'string'))
    }
    if (result.video && typeof result.video === 'string') {
      videos.push(result.video)
    }

    return videos
  }, [result])

  const currentImage = allImages[currentIndex]
  const currentImageUrl = toDisplayableUrl(currentImage)

  // 切换图片
  const handlePrevImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))
  }, [allImages.length])

  const handleNextImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))
  }, [allImages.length])

  // 下载图片
  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentImageUrl) return
    const link = document.createElement('a')
    link.href = currentImageUrl
    link.download = `output_${Date.now()}.png`
    link.click()
  }, [currentImageUrl])

  // 全屏预览
  const handleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowFullscreen(true)
  }, [])

  // 切换展开/收起
  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }, [])

  // 无内容
  if (allImages.length === 0 && allVideos.length === 0) {
    return null
  }

  return (
    <>
      <PreviewContainer className="nodrag">
        {/* 预览头部 - 点击展开/收起 */}
        <PreviewHeader onClick={toggleExpanded}>
          <HeaderLeft>
            <SuccessIcon>✓</SuccessIcon>
            <HeaderTitle>生成结果</HeaderTitle>
            {allImages.length > 1 && (
              <ImageCount>{currentIndex + 1}/{allImages.length}</ImageCount>
            )}
          </HeaderLeft>
          <HeaderRight>
            <ToggleIcon>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</ToggleIcon>
          </HeaderRight>
        </PreviewHeader>

        {/* 预览内容 - 展开时显示 */}
        {expanded && (
          <PreviewContent>
            {/* 主图区域 */}
            <MainImageArea onClick={handleFullscreen}>
              {currentImageUrl && (
                currentImageUrl.startsWith('indexeddb://') ? (
                  <IndexedDBImage src={currentImageUrl} alt="Output" />
                ) : (
                  <MainImage src={currentImageUrl} alt="Output" />
                )
              )}

              {/* 悬浮操作按钮 */}
              <ImageOverlay>
                <OverlayBtn onClick={handleFullscreen} title="全屏查看">
                  <Maximize2 size={14} />
                </OverlayBtn>
                <OverlayBtn onClick={handleDownload} title="下载">
                  <Download size={14} />
                </OverlayBtn>
              </ImageOverlay>

              {/* 多图切换按钮 */}
              {allImages.length > 1 && (
                <>
                  <NavBtn $position="left" onClick={handlePrevImage}>‹</NavBtn>
                  <NavBtn $position="right" onClick={handleNextImage}>›</NavBtn>
                </>
              )}
            </MainImageArea>

            {/* 多图缩略图条 */}
            {allImages.length > 1 && (
              <ThumbnailStrip>
                {allImages.map((img, idx) => {
                  const url = toDisplayableUrl(img)
                  if (!url) return null
                  return (
                    <ThumbItem
                      key={idx}
                      $active={idx === currentIndex}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentIndex(idx)
                      }}>
                      {url.startsWith('indexeddb://') ? (
                        <IndexedDBImage src={url} alt={`Thumb ${idx + 1}`} />
                      ) : (
                        <img src={url} alt={`Thumb ${idx + 1}`} />
                      )}
                    </ThumbItem>
                  )
                })}
              </ThumbnailStrip>
            )}

            {/* 视频展示 */}
            {allVideos.length > 0 && allImages.length === 0 && (
              <VideoArea>
                <video src={toDisplayableUrl(allVideos[0]) || ''} controls />
              </VideoArea>
            )}
          </PreviewContent>
        )}

        {/* 收起状态 - 显示小缩略图行 */}
        {!expanded && (
          <CollapsedThumbs>
            {allImages.slice(0, 4).map((img, idx) => {
              const url = toDisplayableUrl(img)
              if (!url) return null
              return (
                <MiniThumb key={idx} onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(idx)
                  setShowFullscreen(true)
                }}>
                  {url.startsWith('indexeddb://') ? (
                    <IndexedDBImage src={url} alt={`Thumb ${idx + 1}`} />
                  ) : (
                    <img src={url} alt={`Thumb ${idx + 1}`} />
                  )}
                </MiniThumb>
              )
            })}
            {allImages.length > 4 && <MoreCount>+{allImages.length - 4}</MoreCount>}
          </CollapsedThumbs>
        )}
      </PreviewContainer>

      {/* 全屏预览弹窗 */}
      {showFullscreen && currentImageUrl && (
        <FullscreenOverlay onClick={() => setShowFullscreen(false)}>
          <FullscreenContent onClick={(e) => e.stopPropagation()}>
            <FullscreenImage>
              {currentImageUrl.startsWith('indexeddb://') ? (
                <IndexedDBImage src={currentImageUrl} alt="Fullscreen" />
              ) : (
                <img src={currentImageUrl} alt="Fullscreen" />
              )}
            </FullscreenImage>

            {/* 顶部栏 */}
            <TopBar>
              <span>{currentIndex + 1} / {allImages.length}</span>
              <TopActions>
                <TopBtn onClick={handleDownload}><Download size={18} /></TopBtn>
                <TopBtn onClick={() => setShowFullscreen(false)}>×</TopBtn>
              </TopActions>
            </TopBar>

            {/* 切换按钮 */}
            {allImages.length > 1 && (
              <>
                <FullNavBtn $position="left" onClick={handlePrevImage}>‹</FullNavBtn>
                <FullNavBtn $position="right" onClick={handleNextImage}>›</FullNavBtn>
              </>
            )}

            {/* 底部缩略图 */}
            {allImages.length > 1 && (
              <BottomStrip>
                {allImages.map((img, idx) => {
                  const url = toDisplayableUrl(img)
                  if (!url) return null
                  return (
                    <BottomThumb
                      key={idx}
                      $active={idx === currentIndex}
                      onClick={() => setCurrentIndex(idx)}>
                      {url.startsWith('indexeddb://') ? (
                        <IndexedDBImage src={url} alt={`Thumb ${idx + 1}`} />
                      ) : (
                        <img src={url} alt={`Thumb ${idx + 1}`} />
                      )}
                    </BottomThumb>
                  )
                })}
              </BottomStrip>
            )}
          </FullscreenContent>
        </FullscreenOverlay>
      )}
    </>
  )
}

export default memo(NodeResultPreview)

// ==================== 动画 ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`

// ==================== 样式 ====================

const PreviewContainer = styled.div`
  border-radius: 10px 10px 0 0;
  overflow: hidden;
  background: linear-gradient(180deg, #52c41a 0%, #389e0d 100%);
  animation: ${fadeIn} 0.25s ease-out;
`

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const SuccessIcon = styled.span`
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
`

const HeaderTitle = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: white;
`

const ImageCount = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 6px;
  border-radius: 4px;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
`

const ToggleIcon = styled.span`
  color: rgba(255, 255, 255, 0.8);
  display: flex;
`

const PreviewContent = styled.div`
  background: var(--color-background);
`

const MainImageArea = styled.div`
  position: relative;
  width: 100%;
  height: 120px;
  background: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
  overflow: hidden;
`

const MainImage = styled.img`
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
`

const ImageOverlay = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  ${MainImageArea}:hover & {
    opacity: 1;
  }
`

const OverlayBtn = styled.button`
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 4px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
`

const NavBtn = styled.button<{ $position: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $position }) => $position}: 4px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;

  ${MainImageArea}:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`

const ThumbnailStrip = styled.div`
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--color-background);
  border-top: 1px solid var(--color-border-mute);
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const ThumbItem = styled.div<{ $active: boolean }>`
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid ${({ $active }) => ($active ? '#52c41a' : 'transparent')};
  opacity: ${({ $active }) => ($active ? 1 : 0.6)};
  transition: all 0.15s;

  &:hover {
    opacity: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const VideoArea = styled.div`
  height: 120px;
  background: var(--color-background-soft);

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

const CollapsedThumbs = styled.div`
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-background);
`

const MiniThumb = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--color-border-mute);
  transition: all 0.15s;

  &:hover {
    border-color: var(--color-primary);
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const MoreCount = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--color-text-3);
`

// ==================== 全屏样式 ====================

const FullscreenOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
`

const FullscreenContent = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  cursor: default;
`

const FullscreenImage = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 80px;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`

const TopBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
  color: white;
  font-size: 14px;
`

const TopActions = styled.div`
  display: flex;
  gap: 8px;
`

const TopBtn = styled.button`
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`

const FullNavBtn = styled.button<{ $position: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $position }) => $position}: 20px;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 28px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.1);
  }
`

const BottomStrip = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
  justify-content: center;
  overflow-x: auto;
`

const BottomThumb = styled.div<{ $active: boolean }>`
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid ${({ $active }) => ($active ? 'white' : 'transparent')};
  opacity: ${({ $active }) => ($active ? 1 : 0.6)};
  transition: all 0.2s;

  &:hover {
    opacity: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`
