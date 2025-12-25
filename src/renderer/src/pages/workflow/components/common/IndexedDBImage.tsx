/**
 * IndexedDB 图片组件
 * 自动处理 indexeddb:// URL 的图片加载
 */

import { loggerService } from '@logger'
import { memo, useEffect, useState } from 'react'

import { loadResultData } from '../../services/WorkflowResultStorage'

const logger = loggerService.withContext('IndexedDBImage')

interface IndexedDBImageProps {
  src: string
  alt?: string
  style?: React.CSSProperties
  className?: string
  onError?: () => void
  onLoad?: () => void
}

/**
 * 检查是否为 IndexedDB URL
 */
function isIndexedDBUrl(url: string): boolean {
  return url?.startsWith('indexeddb://')
}

/**
 * 将图片数据转换为可显示的 URL
 */
function toDisplayableImageUrl(data: string): string {
  if (!data) return ''

  // 已经是 data URL
  if (data.startsWith('data:image')) {
    return data
  }

  // HTTP/HTTPS URL
  if (data.startsWith('http://') || data.startsWith('https://')) {
    return data
  }

  // file:// URL
  if (data.startsWith('file://')) {
    return data
  }

  // 本地文件路径 (Windows)
  if (/^[A-Za-z]:\\/.test(data)) {
    return 'file:///' + data.replace(/\\/g, '/')
  }

  // 假设是 base64 数据，转为 data URL
  if (/^[A-Za-z0-9+/=]+$/.test(data) && data.length > 100) {
    return `data:image/png;base64,${data}`
  }

  return data
}

/**
 * IndexedDB 图片组件
 * 自动从 IndexedDB 加载图片数据并显示
 */
function IndexedDBImageComponent({ src, alt = 'Image', style, className, onError, onLoad }: IndexedDBImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false

    async function loadImage() {
      if (!src) {
        setLoading(false)
        setError(true)
        return
      }

      setLoading(true)
      setError(false)

      try {
        if (isIndexedDBUrl(src)) {
          // 从 IndexedDB 加载实际数据
          const data = await loadResultData(src)
          if (cancelled) return

          if (data) {
            const displayUrl = toDisplayableImageUrl(data)
            setImageSrc(displayUrl)
          } else {
            setError(true)
            onError?.()
          }
        } else {
          // 直接使用 URL
          const displayUrl = toDisplayableImageUrl(src)
          setImageSrc(displayUrl)
        }
      } catch (err) {
        if (cancelled) return
        logger.error('Failed to load image from IndexedDB', { err })
        setError(true)
        onError?.()
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      cancelled = true
    }
  }, [src, onError])

  if (loading) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--ant-color-bg-container-disabled)',
          color: 'var(--ant-color-text-tertiary)',
          fontSize: '12px'
        }}
        className={className}>
        加载中...
      </div>
    )
  }

  if (error || !imageSrc) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--ant-color-error-bg)',
          color: 'var(--ant-color-error)',
          fontSize: '12px'
        }}
        className={className}>
        图片加载失败
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      style={style}
      className={className}
      onError={() => {
        setError(true)
        onError?.()
      }}
      onLoad={onLoad}
    />
  )
}

export const IndexedDBImage = memo(IndexedDBImageComponent)
export default IndexedDBImage
