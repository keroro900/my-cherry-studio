/**
 * 输出节点
 * 支持三种模式：显示预览、保存文件、触发下载
 * 注意：自动下载功能已移至 WorkflowToolbar，在 Redux 存储前触发
 * 图片/视频数据存储在 IndexedDB 中，Redux 只保存引用
 */

import { loggerService } from '@logger'
import { type NodeProps } from '@xyflow/react'
import { Image } from 'antd'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { loadResultData } from '../../services/WorkflowResultStorage'
import type { WorkflowNodeData } from '../../types'
import DynamicHandles from './DynamicHandles'

const logger = loggerService.withContext('OutputNode')

const nodeStyle: React.CSSProperties = {
  padding: 'var(--workflow-node-padding, 12px 16px)',
  borderRadius: 'var(--workflow-node-border-radius, 8px)',
  borderWidth: 'var(--workflow-node-border-width, 2px)',
  borderStyle: 'solid',
  backgroundColor: 'var(--ant-color-bg-container)',
  minWidth: '200px',
  maxWidth: '300px'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
  fontWeight: 600,
  fontSize: '14px'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--ant-color-border)',
  backgroundColor: 'var(--ant-color-bg-elevated)',
  color: 'var(--ant-color-text)',
  fontSize: '13px'
}

const previewBaseStyle: React.CSSProperties = {
  padding: '8px',
  backgroundColor: 'var(--ant-color-bg-elevated)',
  borderRadius: '6px',
  overflow: 'hidden',
  position: 'relative'
}

const imagePreviewStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '150px',
  objectFit: 'contain',
  borderRadius: '4px',
  display: 'block',
  margin: '0 auto'
}

function OutputNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData
  const [outputPath, setOutputPath] = useState(nodeData.config?.outputPath || '')

  // 从 IndexedDB 加载的实际数据
  const [loadedImage, setLoadedImage] = useState<string | null>(null)
  const [loadedVideo, setLoadedVideo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewHeight, setPreviewHeight] = useState<number>(180)
  const [zoom, setZoom] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)
  const [fontSize, setFontSize] = useState<number>(13)
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'text' | 'any'>('image')
  const [imageInfo, setImageInfo] = useState<{ w: number; h: number } | null>(null)

  const isFileOutput = nodeData.nodeType === 'output'
  const outputType = nodeData.config?.outputType || 'display'

  // 当 result 变化时，尝试从 IndexedDB 加载实际数据
  useEffect(() => {
    let cancelled = false

    const loadFromIndexedDB = async () => {
      let resultAny: any = nodeData.result
      if (resultAny && typeof resultAny === 'object' && 'result' in resultAny) {
        resultAny = resultAny.result
      }

      if (!resultAny) {
        setLoadedImage(null)
        setLoadedVideo(null)
        return
      }

      const imageRef = resultAny?.image ?? resultAny?.images
      const videoRef = resultAny?.video ?? resultAny?.videos

      if (imageRef && typeof imageRef === 'string' && imageRef.startsWith('indexeddb://')) {
        setIsLoading(true)
        try {
          const actualData = await loadResultData(imageRef)
          if (!cancelled && actualData) {
            setLoadedImage(actualData)
          }
        } catch (error) {
          logger.error('Failed to load image from IndexedDB', { error })
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      } else if (imageRef && typeof imageRef === 'string' && imageRef !== '[IMAGE_DATA_CLEARED]') {
        // 直接使用 base64 或 URL
        setLoadedImage(imageRef)
      } else {
        setLoadedImage(null)
      }

      if (videoRef && typeof videoRef === 'string' && videoRef.startsWith('indexeddb://')) {
        setIsLoading(true)
        try {
          const actualData = await loadResultData(videoRef)
          if (!cancelled && actualData) {
            setLoadedVideo(actualData)
          }
        } catch (error) {
          logger.error('Failed to load video from IndexedDB', { error })
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      } else if (videoRef && typeof videoRef === 'string' && videoRef !== '[VIDEO_DATA_CLEARED]') {
        setLoadedVideo(videoRef)
      } else {
        setLoadedVideo(null)
      }
    }

    loadFromIndexedDB()

    return () => {
      cancelled = true
    }
  }, [nodeData.result])

  const statusColor =
    {
      idle: 'var(--ant-color-border)',
      running: '#faad14',
      success: '#52c41a',
      error: '#ff4d4f',
      skipped: '#faad14'
    }[nodeData.status || 'idle'] || 'var(--ant-color-border)'

  const statusDotColor =
    {
      idle: '#d9d9d9',
      running: '#faad14',
      success: '#52c41a',
      error: '#ff4d4f',
      skipped: '#faad14'
    }[nodeData.status || 'idle'] || '#d9d9d9'

  const handlePathChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOutputPath(e.target.value)
      if (nodeData.config) {
        nodeData.config.outputPath = e.target.value
      }
    },
    [nodeData]
  )

  const previewStyle = useMemo(
    () => ({
      ...previewBaseStyle,
      minHeight: '120px',
      height: `${previewHeight}px`
    }),
    [previewHeight]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const startY = e.clientY
      const startH = previewHeight
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY
        const next = Math.max(120, Math.min(480, startH + delta))
        setPreviewHeight(next)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [previewHeight]
  )

  const normalizeResult = useCallback(() => {
    let resultAny: any = nodeData.result
    if (resultAny && typeof resultAny === 'object' && 'result' in resultAny) {
      resultAny = resultAny.result
    }
    const images = Array.isArray(resultAny?.image)
      ? resultAny.image
      : resultAny?.images || (resultAny?.image ? [resultAny.image] : [])
    const videos = Array.isArray(resultAny?.video)
      ? resultAny.video
      : resultAny?.videos || (resultAny?.video ? [resultAny.video] : [])
    const text = resultAny?.text
    const anyVal = (resultAny as any)?.any ?? (resultAny as any)?.raw
    return { images, videos, text, anyVal, raw: resultAny }
  }, [nodeData.result])

  const tabs = useMemo(() => {
    const n = normalizeResult()
    const t: Array<{ key: 'image' | 'video' | 'text' | 'any'; label: string; count?: number }> = []
    if (n.images && n.images.length > 0) t.push({ key: 'image', label: '图片', count: n.images.length })
    if (n.videos && n.videos.length > 0) t.push({ key: 'video', label: '视频', count: n.videos.length })
    if (n.text) t.push({ key: 'text', label: '文本' })
    if (n.anyVal) t.push({ key: 'any', label: '数据' })
    if (t.length > 0 && !t.find((x) => x.key === activeTab)) setActiveTab(t[0].key)
    return t
  }, [normalizeResult, activeTab])

  const ratioLabel = useMemo(() => {
    if (imageInfo && imageInfo.w > 0 && imageInfo.h > 0) {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
      const g = gcd(imageInfo.w, imageInfo.h)
      return `${Math.round(imageInfo.w / g)}:${Math.round(imageInfo.h / g)}`
    }
    return '1:1'
  }, [imageInfo])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, payload: { type: 'image' | 'video' | 'text' | 'any'; data: any }) => {
      e.preventDefault()
      if (payload.type === 'text') {
        if (typeof payload.data === 'string') navigator.clipboard?.writeText(payload.data)
      } else if (payload.type === 'image' || payload.type === 'video') {
        const a = document.createElement('a')
        a.href = typeof payload.data === 'string' ? payload.data : String(payload.data)
        a.download = `${payload.type}_${Date.now()}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        navigator.clipboard?.writeText(typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data))
      }
    },
    []
  )

  // 渲染预览内容
  // 优先使用从 IndexedDB 加载的实际数据
  const renderPreview = () => {
    // 如果正在加载，显示加载状态
    if (isLoading) {
      return (
        <div
          style={{
            color: 'var(--ant-color-text-tertiary)',
            fontSize: '12px',
            textAlign: 'center',
            paddingTop: '16px'
          }}>
          ⟳ 加载预览数据...
        </div>
      )
    }

    if (loadedImage && activeTab === 'image') {
      return (
        <div
          style={{ width: '100%', height: '100%', overflow: 'auto' }}
          onContextMenu={(e) => handleContextMenu(e, { type: 'image', data: loadedImage })}>
          <Image
            src={loadedImage}
            alt="Output preview"
            style={{ ...imagePreviewStyle, transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              setImageInfo({ w: img.naturalWidth, h: img.naturalHeight })
            }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
            preview={{
              mask: <span style={{ fontSize: 12 }}>🔍 点击放大</span>
            }}
          />
          {imageInfo && (
            <div style={{ fontSize: 10, color: 'var(--ant-color-text-tertiary)', textAlign: 'center', marginTop: 4 }}>
              {imageInfo.w}×{imageInfo.h}
            </div>
          )}
        </div>
      )
    }

    if (loadedVideo && activeTab === 'video') {
      return (
        <div onContextMenu={(e) => handleContextMenu(e, { type: 'video', data: loadedVideo })}>
          <video
            src={loadedVideo}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '4px',
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          />
        </div>
      )
    }

    let resultAny: any = nodeData.result
    if (resultAny && typeof resultAny === 'object' && 'result' in resultAny) {
      resultAny = resultAny.result
    }

    if (!resultAny) {
      return <div style={{ fontSize: '12px', color: 'var(--ant-color-text-tertiary)' }}>🖼️ 预览</div>
    }

    const norm = normalizeResult()
    const image = norm.images && norm.images.length > 0 ? norm.images : null
    const previewMode: 'single' | 'multi' | 'list' = (nodeData.config?.previewMode as any) || 'multi'
    if (Array.isArray(image) && image.length > 0 && activeTab === 'image') {
      if (previewMode === 'list') {
        const names = image
          .slice(0, 3)
          .map((v: string) => v.split(/[/\\]/).pop())
          .filter(Boolean)
        return (
          <div style={{ fontSize: '12px' }}>
            <div style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 4 }}>接收 {image.length} 张图片</div>
            {names.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--ant-color-text-tertiary)' }}>
                示例：{names.join(', ')}
                {image.length > 3 ? ` 等 ${image.length} 张` : ''}
              </div>
            )}
          </div>
        )
      }
      const count = previewMode === 'single' ? 1 : Math.min(3, image.length)
      return (
        <Image.PreviewGroup
          items={image.map((src: string) => ({ src }))}
          preview={{
            countRender: (current, total) => `${current} / ${total}`
          }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 8 }}
            onContextMenu={(e) => handleContextMenu(e, { type: 'image', data: image[0] })}>
            {image.slice(0, count).map((src: string, idx: number) => (
              <Image
                key={idx}
                src={src}
                alt={`Output preview ${idx + 1}`}
                style={{ ...imagePreviewStyle, maxHeight: '100%', transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement
                  setImageInfo({ w: img.naturalWidth, h: img.naturalHeight })
                }}
                preview={{
                  mask: <span style={{ fontSize: 10 }}>🔍</span>
                }}
              />
            ))}
            {image.length > count && (
              <div style={{ fontSize: '11px', color: 'var(--ant-color-text-tertiary)', gridColumn: `span ${count}` }}>
                还有 {image.length - count} 张（点击任意图片可浏览全部）
              </div>
            )}
          </div>
        </Image.PreviewGroup>
      )
    }
    if (image && typeof image === 'string' && activeTab === 'image') {
      if (image === '[IMAGE_DATA_CLEARED]') {
        return (
          <div
            style={{
              color: 'var(--ant-color-text-tertiary)',
              fontSize: '12px',
              textAlign: 'center',
              paddingTop: '16px'
            }}>
            ✅ 图片已自动下载到本地
          </div>
        )
      }
      if (image.startsWith('indexeddb://')) {
        // 正在等待从 IndexedDB 加载
        return (
          <div
            style={{
              color: 'var(--ant-color-text-tertiary)',
              fontSize: '12px',
              textAlign: 'center',
              paddingTop: '16px'
            }}>
            ⟳ 正在加载图片预览...
          </div>
        )
      }
      // 直接显示图片（base64 或 URL）
      return (
        <div onContextMenu={(e) => handleContextMenu(e, { type: 'image', data: image })}>
          <Image
            src={image}
            alt="Output preview"
            style={{ ...imagePreviewStyle, transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              setImageInfo({ w: img.naturalWidth, h: img.naturalHeight })
            }}
            preview={{
              mask: <span style={{ fontSize: 12 }}>🔍 点击放大</span>
            }}
          />
          {imageInfo && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--ant-color-text-tertiary)',
                textAlign: 'center',
                marginTop: '4px'
              }}>
              {imageInfo.w}×{imageInfo.h}
            </div>
          )}
        </div>
      )
    }

    // 检查是否有视频引用
    const video = norm.videos && norm.videos.length > 0 ? norm.videos[0] : null
    if (video && typeof video === 'string' && activeTab === 'video') {
      if (video === '[VIDEO_DATA_CLEARED]') {
        return (
          <div
            style={{
              color: 'var(--ant-color-text-tertiary)',
              fontSize: '12px',
              textAlign: 'center',
              paddingTop: '16px'
            }}>
            ✅ 视频已自动下载到本地
          </div>
        )
      }
      if (video.startsWith('indexeddb://')) {
        return (
          <div
            style={{
              color: 'var(--ant-color-text-tertiary)',
              fontSize: '12px',
              textAlign: 'center',
              paddingTop: '16px'
            }}>
            ⟳ 正在加载视频预览...
          </div>
        )
      }
      return (
        <div onContextMenu={(e) => handleContextMenu(e, { type: 'video', data: video })}>
          <video
            src={video}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '4px',
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          />
          <div
            style={{
              fontSize: '10px',
              color: 'var(--ant-color-text-tertiary)',
              textAlign: 'center',
              marginTop: '4px'
            }}>
            视频预览
          </div>
        </div>
      )
    }

    // 检查是否有文本
    const text = norm.text
    if (text && activeTab === 'text') {
      return (
        <div
          style={{ fontSize: `${fontSize}px`, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
          onContextMenu={(e) => handleContextMenu(e, { type: 'text', data: text })}>
          {typeof text === 'string' ? text : JSON.stringify(text, null, 2)}
        </div>
      )
    }

    // 检查任意数据
    const anyVal = norm.anyVal
    if (anyVal && activeTab === 'any') {
      return (
        <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          {typeof anyVal === 'string' ? anyVal.substring(0, 200) : JSON.stringify(anyVal, null, 2).substring(0, 200)}
        </div>
      )
    }

    // 显示导出结果
    const exported = (nodeData.result as any)?.exportedFiles || (norm.raw as any)?.exportedFiles
    if (exported) {
      const files = exported as Array<{ filePath: string; fileType: string }>
      return (
        <div style={{ fontSize: '11px' }}>
          <div style={{ color: '#52c41a', marginBottom: '4px' }}>✓ 已导出 {files.length} 个文件</div>
          {files.slice(0, 3).map((f, i) => (
            <div
              key={i}
              style={{
                color: 'var(--ant-color-text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
              📄 {f.filePath.split(/[/\\]/).pop()}
            </div>
          ))}
          {files.length > 3 && (
            <div style={{ color: 'var(--ant-color-text-tertiary)' }}>...还有 {files.length - 3} 个文件</div>
          )}
        </div>
      )
    }

    // 默认显示 JSON
    return (
      <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>
        {JSON.stringify(norm.raw, null, 2).substring(0, 200)}
      </div>
    )
  }

  // 获取输出模式标签
  const getModeLabel = () => {
    switch (outputType) {
      case 'display':
        return '显示预览'
      case 'file':
        return '保存文件'
      case 'download':
        return '下载'
      default:
        return '显示预览'
    }
  }

  return (
    <div
      style={{
        ...nodeStyle,
        borderColor: selected ? '#faad14' : statusColor,
        boxShadow: selected ? '0 0 0 2px rgba(250, 173, 20, 0.2)' : 'none'
      }}>
      {/* 动态 Handles */}
      <DynamicHandles inputs={nodeData.inputs || []} outputs={nodeData.outputs || []} showLabels={selected} />

      <div style={headerStyle}>
        <span style={{ fontSize: '16px' }}>{isFileOutput ? '💾' : '📺'}</span>
        <span>{nodeData.label}</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusDotColor,
            marginLeft: 'auto'
          }}
        />
      </div>

      {/* 输出模式标签 */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--ant-color-text-tertiary)',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
        <span
          style={{
            padding: '2px 6px',
            backgroundColor: 'var(--ant-color-bg-elevated)',
            borderRadius: '4px',
            border: '1px solid var(--ant-color-border)'
          }}>
          ◉ {getModeLabel()}
        </span>
      </div>

      {isFileOutput && outputType === 'file' ? (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--ant-color-text-secondary)', marginBottom: '6px' }}>
            保存路径
          </div>
          <input
            type="text"
            value={outputPath}
            onChange={handlePathChange}
            placeholder="输入保存路径..."
            style={inputStyle}
            className="nodrag"
          />
        </div>
      ) : (
        <div style={previewStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '2px 8px',
                    border: '1px solid var(--ant-color-border)',
                    borderRadius: 4,
                    background: activeTab === t.key ? 'var(--ant-color-bg-container)' : 'var(--ant-color-bg-elevated)',
                    fontSize: 11
                  }}>
                  {t.label}
                  {t.count ? ` (${t.count})` : ''}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                style={{ padding: '2px 6px', fontSize: 11 }}>
                缩小
              </button>
              <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} style={{ padding: '2px 6px', fontSize: 11 }}>
                放大
              </button>
              <button onClick={() => setRotation((r) => r - 90)} style={{ padding: '2px 6px', fontSize: 11 }}>
                左旋
              </button>
              <button onClick={() => setRotation((r) => r + 90)} style={{ padding: '2px 6px', fontSize: 11 }}>
                右旋
              </button>
              <input
                type="range"
                min={10}
                max={24}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </div>
          </div>
          <div style={{ width: '100%', height: `calc(${previewHeight}px - 40px)` }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                border: '1px dashed var(--ant-color-border)',
                borderRadius: 6,
                background: 'var(--ant-color-bg-elevated)',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              {renderPreview()}
            </div>
          </div>
          <div
            style={{ position: 'absolute', left: 12, top: 34, fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
            Ratio: {ratioLabel}
          </div>
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              right: 6,
              bottom: 6,
              width: 12,
              height: 12,
              border: '1px solid var(--ant-color-border)',
              borderRadius: 2,
              cursor: 'nwse-resize',
              background: 'var(--ant-color-bg-container)'
            }}
          />
        </div>
      )}

      {/* 状态 */}
      {nodeData.status && nodeData.status !== 'idle' && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: statusColor
          }}>
          {nodeData.status === 'running' && <span>⟳ 执行中...</span>}
          {nodeData.status === 'completed' && <span>✓ 完成</span>}
          {nodeData.status === 'error' && <span>✗ 错误: {nodeData.errorMessage}</span>}
        </div>
      )}
    </div>
  )
}

export default memo(OutputNode)

export function normalizeOutputPreviewData(result: any) {
  let resultAny: any = result
  if (resultAny && typeof resultAny === 'object' && 'result' in resultAny) {
    resultAny = resultAny.result
  }
  const images = Array.isArray(resultAny?.image)
    ? resultAny.image
    : resultAny?.images || (resultAny?.image ? [resultAny.image] : [])
  const videos = Array.isArray(resultAny?.video)
    ? resultAny.video
    : resultAny?.videos || (resultAny?.video ? [resultAny.video] : [])
  const text = resultAny?.text
  const anyVal = (resultAny as any)?.any ?? (resultAny as any)?.raw
  return { images, videos, text, anyVal, raw: resultAny }
}
