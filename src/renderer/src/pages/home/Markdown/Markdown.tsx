import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/copy-tex'
import 'katex/dist/contrib/mhchem'
import 'remark-github-blockquote-alert/alert.css'

import ImageViewer from '@renderer/components/ImageViewer'
import MarkdownShadowDOMRenderer from '@renderer/components/MarkdownShadowDOMRenderer'
import { useSettings } from '@renderer/hooks/useSettings'
import { useSmoothStream } from '@renderer/hooks/useSmoothStream'
import type {
  CompactMessageBlock,
  MainTextMessageBlock,
  ThinkingMessageBlock,
  TranslationMessageBlock
} from '@renderer/types/newMessage'
import { removeSvgEmptyLines } from '@renderer/utils/formats'
import { processLatexBrackets } from '@renderer/utils/markdown'
import { mayContainVCPMarkers, parseVCPContentCached } from '@renderer/utils/vcpParser'
import { isEmpty } from 'lodash'
import { type FC, lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
// @ts-ignore rehype-mathjax is not typed
import rehypeMathjax from 'rehype-mathjax'
import rehypeRaw from 'rehype-raw'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkAlert from 'remark-github-blockquote-alert'
import remarkMath from 'remark-math'
import type { Pluggable } from 'unified'

// Lazy load VCP components for better initial load performance
const VCPDailyNote = lazy(() => import('../Messages/Tools/VCPDailyNote'))
const VCPDeepMemory = lazy(() => import('../Messages/Tools/VCPDeepMemory'))
const VCPToolResult = lazy(() => import('../Messages/Tools/VCPToolResult'))
const VCPToolUse = lazy(() => import('../Messages/Tools/VCPToolUse'))

import CodeBlock from './CodeBlock'
import Link from './Link'
import MarkdownSvgRenderer from './MarkdownSvgRenderer'
import rehypeHeadingIds from './plugins/rehypeHeadingIds'
import rehypeScalableSvg from './plugins/rehypeScalableSvg'
import remarkDisableConstructs from './plugins/remarkDisableConstructs'
import Table from './Table'

const ALLOWED_ELEMENTS =
  /<(style|p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody|h[1-6]|blockquote|pre|code|br|hr|svg|path|circle|rect|line|polyline|polygon|text|g|defs|title|desc|tspan|sub|sup|details|summary)/i
const DISALLOWED_ELEMENTS = ['iframe', 'script']

interface Props {
  // message: Message & { content: string }
  block: MainTextMessageBlock | TranslationMessageBlock | ThinkingMessageBlock | CompactMessageBlock
  // 可选的后处理函数，用于在流式渲染过程中处理文本（如引用标签转换）
  postProcess?: (text: string) => string
}

const Markdown: FC<Props> = ({ block, postProcess }) => {
  const { t } = useTranslation()
  const { mathEngine, mathEnableSingleDollar } = useSettings()

  const isTrulyDone = 'status' in block && block.status === 'success'
  const [displayedContent, setDisplayedContent] = useState(postProcess ? postProcess(block.content) : block.content)
  const [isStreamDone, setIsStreamDone] = useState(isTrulyDone)

  const prevContentRef = useRef(block.content)
  const prevBlockIdRef = useRef(block.id)

  const { addChunk, reset } = useSmoothStream({
    onUpdate: (rawText) => {
      // 如果提供了后处理函数就调用，否则直接使用原始文本
      const finalText = postProcess ? postProcess(rawText) : rawText
      setDisplayedContent(finalText)
    },
    streamDone: isStreamDone,
    initialText: block.content
  })

  useEffect(() => {
    const newContent = block.content || ''
    const oldContent = prevContentRef.current || ''

    const isDifferentBlock = block.id !== prevBlockIdRef.current

    const isContentReset = oldContent && newContent && !newContent.startsWith(oldContent)

    if (isDifferentBlock || isContentReset) {
      reset(newContent)
    } else {
      const delta = newContent.substring(oldContent.length)
      if (delta) {
        addChunk(delta)
      }
    }

    prevContentRef.current = newContent
    prevBlockIdRef.current = block.id

    // 更新 stream 状态
    const isStreaming = block.status === 'streaming'
    setIsStreamDone(!isStreaming)
  }, [block.content, block.id, block.status, addChunk, reset])

  const remarkPlugins = useMemo(() => {
    const plugins = [
      [remarkGfm, { singleTilde: false }] as Pluggable,
      [remarkAlert] as Pluggable,
      remarkCjkFriendly,
      remarkDisableConstructs(['codeIndented'])
    ]
    if (mathEngine !== 'none') {
      plugins.push([remarkMath, { singleDollarTextMath: mathEnableSingleDollar }])
    }
    return plugins
  }, [mathEngine, mathEnableSingleDollar])

  const messageContent = useMemo(() => {
    if ('status' in block && block.status === 'paused' && isEmpty(block.content)) {
      return t('message.chat.completion.paused')
    }
    return removeSvgEmptyLines(processLatexBrackets(displayedContent))
  }, [block, displayedContent, t])

  // 使用 ref 跟踪是否曾经需要 rehypeRaw，避免每次内容变化都重建插件
  const needsRawHtmlRef = useRef(false)
  if (ALLOWED_ELEMENTS.test(messageContent)) {
    needsRawHtmlRef.current = true
  }

  const rehypePlugins = useMemo(() => {
    const plugins: Pluggable[] = []
    // 一旦检测到需要 raw HTML 处理，保持启用状态（避免流式输出时频繁切换）
    if (needsRawHtmlRef.current) {
      plugins.push(rehypeRaw, rehypeScalableSvg)
    }
    plugins.push([rehypeHeadingIds, { prefix: `heading-${block.id}` }])
    if (mathEngine === 'KaTeX') {
      plugins.push(rehypeKatex)
    } else if (mathEngine === 'MathJax') {
      plugins.push(rehypeMathjax)
    }
    return plugins
    // 移除 messageContent 依赖，使用 ref 代替
  }, [mathEngine, block.id])

  const components = useMemo(() => {
    return {
      a: (props: any) => <Link {...props} />,
      code: (props: any) => <CodeBlock {...props} blockId={block.id} />,
      table: (props: any) => <Table {...props} blockId={block.id} />,
      img: (props: any) => <ImageViewer style={{ maxWidth: 500, maxHeight: 500 }} {...props} />,
      pre: (props: any) => <pre style={{ overflow: 'visible' }} {...props} />,
      p: (props) => {
        const hasImage = props?.node?.children?.some((child: any) => child.tagName === 'img')
        if (hasImage) return <div {...props} />
        return <p {...props} />
      },
      svg: MarkdownSvgRenderer
    } as Partial<Components>
  }, [block.id])

  if (/<style\b[^>]*>/i.test(messageContent)) {
    components.style = MarkdownShadowDOMRenderer as any
  }

  const urlTransform = useCallback((value: string) => {
    if (value.startsWith('data:image/png') || value.startsWith('data:image/jpeg')) return value
    return defaultUrlTransform(value)
  }, [])

  // Optimized VCP parsing: single-pass with caching
  // Only parse when stream is done and content might contain VCP markers
  const vcpParseResult = useMemo(() => {
    // Fast check first - avoid parsing during streaming or when no markers present
    if (!isStreamDone || !mayContainVCPMarkers(messageContent)) {
      return null
    }
    // Use cached parser for performance (LRU cache with 100 entries)
    return parseVCPContentCached(messageContent)
  }, [messageContent, isStreamDone])

  const hasVCPTools = vcpParseResult?.hasVCPMarkers ?? false
  const contentParts = vcpParseResult?.parts ?? [{ type: 'markdown' as const, content: messageContent }]

  // Render a single markdown part
  const renderMarkdownPart = (content: string, key: string) => (
    <ReactMarkdown
      key={key}
      rehypePlugins={rehypePlugins}
      remarkPlugins={remarkPlugins}
      components={components}
      disallowedElements={DISALLOWED_ELEMENTS}
      urlTransform={urlTransform}
      remarkRehypeOptions={{
        footnoteLabel: t('common.footnotes'),
        footnoteLabelTagName: 'h4',
        footnoteBackContent: ' '
      }}>
      {content}
    </ReactMarkdown>
  )

  return (
    <div className="markdown">
      {hasVCPTools ? (
        <Suspense fallback={null}>
          {contentParts.map((part, index) => {
            if (part.type === 'markdown') {
              return renderMarkdownPart(part.content, `md-${index}`)
            } else if (part.type === 'vcp-result') {
              return <VCPToolResult key={`vcp-result-${index}`} content={part.content} type={part.resultType} />
            } else if (part.type === 'vcp-diary') {
              return <VCPDailyNote key={`vcp-diary-${index}`} content={part.content} />
            } else if (part.type === 'vcp-deep-memory') {
              return <VCPDeepMemory key={`vcp-deep-memory-${index}`} content={part.content} />
            } else {
              return <VCPToolUse key={`vcp-request-${index}`} content={part.content} />
            }
          })}
        </Suspense>
      ) : (
        <ReactMarkdown
          rehypePlugins={rehypePlugins}
          remarkPlugins={remarkPlugins}
          components={components}
          disallowedElements={DISALLOWED_ELEMENTS}
          urlTransform={urlTransform}
          remarkRehypeOptions={{
            footnoteLabel: t('common.footnotes'),
            footnoteLabelTagName: 'h4',
            footnoteBackContent: ' '
          }}>
          {messageContent}
        </ReactMarkdown>
      )}
    </div>
  )
}

export default memo(Markdown)
