/**
 * VCP 日记语法高亮组件
 *
 * 支持:
 * - {{}} 全文注入 (绿色)
 * - [[]] RAG 片段 (蓝色)
 * - <<>> 阈值全文 (黄色)
 * - 《《》》阈值 RAG (紫色)
 * - 修饰符高亮 (::Time, ::Group, ::TagMemo)
 */

import React, { useMemo } from 'react'
import styled from 'styled-components'

import { DIARY_SYNTAX, type DiaryDeclaration, type DiaryDeclarationMode } from './types'

// ==================== 样式组件 ====================

const HighlightContainer = styled.div`
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`

const DeclarationSpan = styled.span<{ $mode: DiaryDeclarationMode }>`
  background-color: ${(props) => {
    const syntax = DIARY_SYNTAX[props.$mode]
    return `${syntax.color}15`
  }};
  border: 1px solid ${(props) => DIARY_SYNTAX[props.$mode].color};
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 2px;
`

const SyntaxBracket = styled.span<{ $mode: DiaryDeclarationMode }>`
  color: ${(props) => DIARY_SYNTAX[props.$mode].color};
  font-weight: bold;
`

const KnowledgeBaseName = styled.span`
  color: var(--color-text-primary);
  font-weight: 500;
`

const ModifierSpan = styled.span`
  color: #eb2f96;
  font-style: italic;
`

const TopKSpan = styled.span`
  color: #13c2c2;
`

// ==================== 解析函数 ====================

/**
 * 解析 VCP 日记语法
 */
export function parseDiarySyntax(text: string): {
  declarations: DiaryDeclaration[]
  segments: Array<{ type: 'text' | 'declaration'; content: string; declaration?: DiaryDeclaration }>
} {
  const declarations: DiaryDeclaration[] = []
  const segments: Array<{ type: 'text' | 'declaration'; content: string; declaration?: DiaryDeclaration }> = []

  // 正则匹配所有四种语法
  const patterns: Array<{ mode: DiaryDeclarationMode; regex: RegExp }> = [
    { mode: 'fulltext', regex: /\{\{([^}]+)\}\}/g },
    { mode: 'rag', regex: /\[\[([^\]]+)\]\]/g },
    { mode: 'threshold_fulltext', regex: /<<([^>]+)>>/g },
    { mode: 'threshold_rag', regex: /《《([^》]+)》》/g }
  ]

  // 收集所有匹配
  const allMatches: Array<{
    mode: DiaryDeclarationMode
    match: RegExpExecArray
    startIndex: number
    endIndex: number
  }> = []

  for (const { mode, regex } of patterns) {
    let match
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({
        mode,
        match,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }
  }

  // 按位置排序
  allMatches.sort((a, b) => a.startIndex - b.startIndex)

  // 构建 segments
  let lastIndex = 0
  for (const { mode, match, startIndex, endIndex } of allMatches) {
    // 添加前面的普通文本
    if (startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, startIndex)
      })
    }

    // 解析声明内容
    const innerContent = match[1]
    const parts = innerContent.split('::')
    const knowledgeBaseName = parts[0].trim()
    const modifiers = parts.slice(1).map((m) => `::${m}`)

    // 检查 topK 修饰符 (如 :1.5)
    let topK: number | undefined
    const topKMatch = knowledgeBaseName.match(/:(\d+\.?\d*)$/)
    if (topKMatch) {
      topK = parseFloat(topKMatch[1])
    }

    const declaration: DiaryDeclaration = {
      mode,
      knowledgeBaseName: knowledgeBaseName.replace(/:[\d.]+$/, '').trim(),
      modifiers,
      topK,
      raw: match[0],
      startIndex,
      endIndex
    }

    declarations.push(declaration)
    segments.push({
      type: 'declaration',
      content: match[0],
      declaration
    })

    lastIndex = endIndex
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    })
  }

  return { declarations, segments }
}

// ==================== 高亮组件 ====================

interface VCPSyntaxHighlighterProps {
  text: string
  className?: string
  onClick?: (declaration: DiaryDeclaration) => void
}

export const VCPSyntaxHighlighter: React.FC<VCPSyntaxHighlighterProps> = ({ text, className, onClick }) => {
  const { segments } = useMemo(() => parseDiarySyntax(text), [text])

  return (
    <HighlightContainer className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>
        }

        const declaration = segment.declaration!
        const syntax = DIARY_SYNTAX[declaration.mode]

        return (
          <DeclarationSpan
            key={index}
            $mode={declaration.mode}
            onClick={() => onClick?.(declaration)}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
            title={`${syntax.label}: ${declaration.knowledgeBaseName}`}>
            <SyntaxBracket $mode={declaration.mode}>{syntax.open}</SyntaxBracket>
            <KnowledgeBaseName>{declaration.knowledgeBaseName}</KnowledgeBaseName>
            {declaration.topK && <TopKSpan>:{declaration.topK}</TopKSpan>}
            {declaration.modifiers.map((mod, i) => (
              <ModifierSpan key={i}>{mod}</ModifierSpan>
            ))}
            <SyntaxBracket $mode={declaration.mode}>{syntax.close}</SyntaxBracket>
          </DeclarationSpan>
        )
      })}
    </HighlightContainer>
  )
}

// ==================== 语法图例 ====================

const LegendContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  margin-bottom: 12px;
`

const LegendItem = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    background: ${(props) => props.$color};
    border-radius: 2px;
  }
`

export const VCPSyntaxLegend: React.FC = () => {
  return (
    <LegendContainer>
      {Object.entries(DIARY_SYNTAX).map(([key, syntax]) => (
        <LegendItem key={key} $color={syntax.color}>
          <code>
            {syntax.open}...{syntax.close}
          </code>
          <span>{syntax.label}</span>
        </LegendItem>
      ))}
    </LegendContainer>
  )
}

export default VCPSyntaxHighlighter
