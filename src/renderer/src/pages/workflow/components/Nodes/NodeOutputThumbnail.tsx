/**
 * 节点输出缩略图组件 v1.0
 * 在节点内显示输出结果的缩略图
 *
 * 特性：
 * - 支持图片/视频/文本预览
 * - 网格布局显示多图
 * - 点击可放大查看
 */

import { memo, useMemo } from 'react'
import styled from 'styled-components'

import { IndexedDBImage } from '../common/IndexedDBImage'

interface NodeOutputThumbnailProps {
  result: {
    images?: string[]
    videos?: string[]
    text?: string
    image?: string
    output_image?: string
    [key: string]: any
  }
  /** 最大高度 */
  maxHeight?: number
  /** 最多显示几张图 */
  maxImages?: number
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
 * 节点输出缩略图
 */
function NodeOutputThumbnail({ result, maxHeight = 100, maxImages = 4 }: NodeOutputThumbnailProps) {
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

  // 检查是否有文本输出
  const textOutput = useMemo(() => {
    if (!result) return null
    if (result.text && typeof result.text === 'string') return result.text
    if (result.output_text && typeof result.output_text === 'string') return result.output_text
    if (result.result && typeof result.result === 'string') return result.result
    return null
  }, [result])

  // 无内容
  if (allImages.length === 0 && !textOutput) {
    return null
  }

  // 只有文本
  if (allImages.length === 0 && textOutput) {
    return (
      <ThumbnailContainer>
        <TextPreview>
          {textOutput.length > 60 ? textOutput.slice(0, 60) + '...' : textOutput}
        </TextPreview>
      </ThumbnailContainer>
    )
  }

  // 有图片
  const displayImages = allImages.slice(0, maxImages)
  const remainingCount = allImages.length - maxImages

  return (
    <ThumbnailContainer>
      <ImageGrid $count={displayImages.length}>
        {displayImages.map((imgUrl, idx) => {
          const url = toDisplayableUrl(imgUrl)
          if (!url) return null

          return (
            <ImageWrapper key={idx} $maxHeight={maxHeight}>
              {url.startsWith('indexeddb://') ? (
                <IndexedDBImage src={url} alt={`Output ${idx + 1}`} />
              ) : (
                <img src={url} alt={`Output ${idx + 1}`} />
              )}
            </ImageWrapper>
          )
        })}
        {remainingCount > 0 && (
          <MoreIndicator>+{remainingCount}</MoreIndicator>
        )}
      </ImageGrid>
    </ThumbnailContainer>
  )
}

export default memo(NodeOutputThumbnail)

// ==================== 样式 ====================

const ThumbnailContainer = styled.div`
  margin: 0 14px 10px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background);
  border: 1.5px solid var(--color-status-success);
`

const ImageGrid = styled.div<{ $count: number }>`
  display: grid;
  grid-template-columns: ${(props) => (props.$count === 1 ? '1fr' : 'repeat(2, 1fr)')};
  gap: 3px;
`

const ImageWrapper = styled.div<{ $maxHeight: number }>`
  position: relative;
  overflow: hidden;
  max-height: ${(props) => props.$maxHeight}px;
  background: var(--color-background-soft);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

const MoreIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-soft);
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: 600;
  min-height: 45px;
`

const TextPreview = styled.div`
  padding: 10px 12px;
  font-size: 11px;
  color: var(--color-text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`
