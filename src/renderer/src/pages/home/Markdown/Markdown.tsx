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
import { isEmpty } from 'lodash'
import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

import VCPDailyNote, { extractDailyNotes } from '../Messages/Tools/VCPDailyNote'
import VCPToolResult, { extractVCPToolResults } from '../Messages/Tools/VCPToolResult'
import VCPToolUse, { extractVCPToolRequests } from '../Messages/Tools/VCPToolUse'
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

  // 快速检查是否可能包含 VCP 标记（避免在流式输出时频繁执行正则）
  const mayHaveVCPMarkers = useMemo(() => {
    // 使用简单字符串检查代替正则
    return (
      messageContent.includes('<<<[TOOL_') ||
      messageContent.includes('<<<DailyNoteStart>>>') ||
      messageContent.includes('[[VCP调用结果')
    )
  }, [messageContent])

  // Check if content contains VCP tool markers and split accordingly
  // 只有在可能包含 VCP 标记且流已结束时才执行完整解析
  const vcpToolResults = useMemo(
    () => (mayHaveVCPMarkers && isStreamDone ? extractVCPToolResults(messageContent) : []),
    [messageContent, mayHaveVCPMarkers, isStreamDone]
  )
  const vcpToolRequests = useMemo(
    () => (mayHaveVCPMarkers && isStreamDone ? extractVCPToolRequests(messageContent) : []),
    [messageContent, mayHaveVCPMarkers, isStreamDone]
  )
  const vcpDailyNotes = useMemo(
    () => (mayHaveVCPMarkers && isStreamDone ? extractDailyNotes(messageContent) : []),
    [messageContent, mayHaveVCPMarkers, isStreamDone]
  )
  const hasVCPTools = vcpToolResults.length > 0 || vcpToolRequests.length > 0 || vcpDailyNotes.length > 0

  // Split content around VCP tool markers for inline rendering
  const contentParts = useMemo(() => {
    if (!hasVCPTools) {
      return [{ type: 'markdown' as const, content: messageContent }]
    }

    const parts: Array<
      | { type: 'markdown'; content: string }
      | { type: 'vcp-result'; resultType: 'result' | 'error'; content: string }
      | { type: 'vcp-request'; content: string }
      | { type: 'vcp-diary'; content: string }
    > = []

    // Create a combined pattern to find all markers in order
    // Includes: TOOL_RESULT, TOOL_ERROR, TOOL_REQUEST, DailyNote, and VCPChat legacy format
    const combinedPattern =
      /<<<\[(TOOL_RESULT|TOOL_ERROR)\]>>>([\s\S]*?)<<<\[\/\1\]>>>|<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>|<<<DailyNoteStart>>>([\s\S]*?)<<<DailyNoteEnd>>>|\[\[VCP调用结果信息汇总:([\s\S]*?)VCP调用结果结束\]\]/g
    let lastIndex = 0
    let match

    while ((match = combinedPattern.exec(messageContent)) !== null) {
      // Add markdown content before this match
      if (match.index > lastIndex) {
        const beforeContent = messageContent.slice(lastIndex, match.index).trim()
        if (beforeContent) {
          parts.push({ type: 'markdown', content: beforeContent })
        }
      }

      // Check which pattern matched
      if (match[4] !== undefined) {
        // DailyNote match (group 4)
        parts.push({
          type: 'vcp-diary',
          content: match[4].trim()
        })
      } else if (match[5] !== undefined) {
        // VCPChat legacy tool result format (group 5)
        parts.push({
          type: 'vcp-result',
          resultType: 'result',
          content: match[5].trim()
        })
      } else if (match[3] !== undefined) {
        // TOOL_REQUEST match (group 3)
        parts.push({
          type: 'vcp-request',
          content: match[3].trim()
        })
      } else {
        // TOOL_RESULT or TOOL_ERROR match (groups 1 and 2)
        parts.push({
          type: 'vcp-result',
          resultType: match[1] === 'TOOL_RESULT' ? 'result' : 'error',
          content: match[2].trim()
        })
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining markdown content after last match
    if (lastIndex < messageContent.length) {
      const afterContent = messageContent.slice(lastIndex).trim()
      if (afterContent) {
        parts.push({ type: 'markdown', content: afterContent })
      }
    }

    return parts.length > 0 ? parts : [{ type: 'markdown' as const, content: messageContent }]
  }, [messageContent, hasVCPTools])

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
        contentParts.map((part, index) => {
          if (part.type === 'markdown') {
            return renderMarkdownPart(part.content, `md-${index}`)
          } else if (part.type === 'vcp-result') {
            return <VCPToolResult key={`vcp-result-${index}`} content={part.content} type={part.resultType} />
          } else if (part.type === 'vcp-diary') {
            return <VCPDailyNote key={`vcp-diary-${index}`} content={part.content} />
          } else {
            return <VCPToolUse key={`vcp-request-${index}`} content={part.content} />
          }
        })
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
