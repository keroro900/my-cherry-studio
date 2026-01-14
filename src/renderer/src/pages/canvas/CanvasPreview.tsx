/**
 * CanvasPreview - 实时预览组件
 *
 * 支持 HTML、Markdown 和 Python 代码的实时预览/执行
 * 对齐 VCPChat Canvas 的预览功能
 */

import { CaretRightOutlined, CodeOutlined, EyeOutlined, LoadingOutlined, SyncOutlined } from '@ant-design/icons'
import { Button, Empty, Result, Space, Tabs, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styled from 'styled-components'

import { getLanguageMode } from './types'

const { Text } = Typography

interface CanvasPreviewProps {
  /** 文件内容 */
  content: string
  /** 文件路径 */
  filePath: string
  /** 预览模式: auto | html | markdown | python */
  mode?: 'auto' | 'html' | 'markdown' | 'python'
  /** 高度 */
  height?: string | number
  /** 自动刷新间隔 (ms), 0 禁用 */
  autoRefreshInterval?: number
  /** 关闭回调 */
  onClose?: () => void
}

/**
 * 检测内容类型
 */
function detectContentType(content: string, filePath: string): 'html' | 'markdown' | 'python' | 'text' {
  const ext = filePath.toLowerCase()
  const language = getLanguageMode(filePath)

  // 根据文件扩展名检测
  if (ext.endsWith('.html') || ext.endsWith('.htm')) return 'html'
  if (ext.endsWith('.md') || ext.endsWith('.markdown')) return 'markdown'
  if (ext.endsWith('.py')) return 'python'

  // 根据语言模式检测
  if (language === 'htmlmixed') return 'html'
  if (language === 'markdown') return 'markdown'
  if (language === 'python') return 'python'

  // 根据内容检测
  if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) return 'html'
  if (content.includes('# ') || content.includes('## ') || content.includes('```')) return 'markdown'

  return 'text'
}

/**
 * HTML 预览组件
 */
const HtmlPreview: FC<{ content: string }> = ({ content }) => {
  const [error, setError] = useState<string | null>(null)

  // 使用 iframe 隔离 HTML 执行环境
  const iframeSrcDoc = useMemo(() => {
    try {
      // 添加基础样式
      const styledContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; margin: 0; }
            img { max-width: 100%; height: auto; }
            pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
            code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `
      setError(null)
      return styledContent
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HTML 解析失败')
      return ''
    }
  }, [content])

  if (error) {
    return <Result status="error" title="HTML 预览错误" subTitle={error} />
  }

  return <PreviewFrame srcDoc={iframeSrcDoc} sandbox="allow-scripts allow-same-origin" title="HTML Preview" />
}

/**
 * Markdown 预览组件
 */
const MarkdownPreview: FC<{ content: string }> = ({ content }) => {
  return (
    <MarkdownContainer>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </MarkdownContainer>
  )
}

/**
 * Python 执行预览组件
 */
const PythonPreview: FC<{ content: string }> = ({ content }) => {
  const { t } = useTranslation()
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // 执行 Python 代码
  const runPython = useCallback(async () => {
    if (!content.trim()) {
      setOutput('')
      return
    }

    setIsRunning(true)
    setError(null)

    try {
      // 调用 Python 执行服务
      const result = await window.api.python?.execute?.(content)
      if (result?.success) {
        setOutput(result.data || '')
      } else {
        setError(result?.error || 'Python 执行失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Python 执行失败')
    } finally {
      setIsRunning(false)
    }
  }, [content])

  return (
    <PythonContainer>
      <PythonHeader>
        <Text strong>{t('canvas.preview.pythonExecution', 'Python 执行')}</Text>
        <Button
          type="primary"
          size="small"
          icon={isRunning ? <LoadingOutlined spin /> : <CaretRightOutlined />}
          onClick={runPython}
          disabled={isRunning}>
          {isRunning ? t('canvas.preview.running', '执行中...') : t('canvas.preview.run', '运行')}
        </Button>
      </PythonHeader>

      <OutputSection>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('canvas.preview.output', '输出')}:
        </Text>
        {error ? (
          <ErrorOutput>{error}</ErrorOutput>
        ) : output ? (
          <OutputContent>{output}</OutputContent>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('canvas.preview.noOutput', '点击运行按钮执行代码')}
          />
        )}
      </OutputSection>
    </PythonContainer>
  )
}

/**
 * Canvas 预览主组件
 */
const CanvasPreview: FC<CanvasPreviewProps> = ({
  content,
  filePath,
  mode = 'auto',
  height = '100%',
  autoRefreshInterval = 0,
  onClose
}) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>('preview')
  const [refreshKey, setRefreshKey] = useState(0)

  // 检测内容类型
  const contentType = useMemo(() => {
    if (mode !== 'auto') return mode
    return detectContentType(content, filePath)
  }, [content, filePath, mode])

  // 自动刷新
  useEffect(() => {
    if (autoRefreshInterval <= 0) return

    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, autoRefreshInterval)

    return () => clearInterval(timer)
  }, [autoRefreshInterval])

  // 手动刷新
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // 渲染预览内容
  const renderPreview = useCallback(() => {
    switch (contentType) {
      case 'html':
        return <HtmlPreview key={refreshKey} content={content} />
      case 'markdown':
        return <MarkdownPreview key={refreshKey} content={content} />
      case 'python':
        return <PythonPreview key={refreshKey} content={content} />
      default:
        return (
          <Empty
            description={t('canvas.preview.unsupported', '此文件类型不支持预览')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
    }
  }, [content, contentType, refreshKey, t])

  // Tab 配置
  const tabItems = [
    {
      key: 'preview',
      label: (
        <Space>
          <EyeOutlined />
          {t('canvas.preview.preview', '预览')}
        </Space>
      ),
      children: renderPreview()
    },
    {
      key: 'source',
      label: (
        <Space>
          <CodeOutlined />
          {t('canvas.preview.source', '源码')}
        </Space>
      ),
      children: (
        <SourceView>
          <pre>{content}</pre>
        </SourceView>
      )
    }
  ]

  return (
    <PreviewContainer style={{ height }}>
      <PreviewHeader>
        <Space>
          <ContentTypeTag $type={contentType}>{contentType.toUpperCase()}</ContentTypeTag>
          <Text type="secondary">{filePath}</Text>
        </Space>
        <Space>
          <Tooltip title={t('canvas.preview.refresh', '刷新')}>
            <Button type="text" size="small" icon={<SyncOutlined />} onClick={handleRefresh} />
          </Tooltip>
          {onClose && (
            <Button size="small" onClick={onClose}>
              {t('common.close', '关闭')}
            </Button>
          )}
        </Space>
      </PreviewHeader>

      <PreviewBody>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" style={{ height: '100%' }} />
      </PreviewBody>
    </PreviewContainer>
  )
}

// ==================== 样式组件 ====================

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const PreviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const ContentTypeTag = styled.span<{ $type: string }>`
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  background: ${(props) => {
    switch (props.$type) {
      case 'html':
        return '#e34c26'
      case 'markdown':
        return '#083fa1'
      case 'python':
        return '#3776ab'
      default:
        return '#666'
    }
  }};
  color: white;
`

const PreviewBody = styled.div`
  flex: 1;
  overflow: hidden;

  .ant-tabs {
    height: 100%;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
    overflow: auto;
  }
`

const PreviewFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background: white;
`

const MarkdownContainer = styled.div`
  padding: 16px;
  height: 100%;
  overflow: auto;
  background: var(--color-background);
`

const PythonContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
`

const PythonHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

const OutputSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-background-soft);
  border-radius: 6px;
  padding: 12px;
  overflow: auto;
`

const OutputContent = styled.pre`
  margin: 0;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
`

const ErrorOutput = styled.pre`
  margin: 0;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #ff4d4f;
  white-space: pre-wrap;
`

const SourceView = styled.div`
  padding: 12px;
  height: 100%;
  overflow: auto;
  background: var(--color-background-soft);

  pre {
    margin: 0;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
`

export default CanvasPreview
