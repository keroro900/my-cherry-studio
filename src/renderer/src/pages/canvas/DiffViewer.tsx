/**
 * DiffViewer - 差异对比视图
 *
 * 基于 @codemirror/merge 实现的代码/文本差异对比组件
 * 支持并排显示、高亮变更、语法高亮
 */

import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { Button, Space, Tag, Typography } from 'antd'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getLanguageMode } from './types'

const { Text } = Typography

interface DiffViewerProps {
  /** 原始内容 */
  originalContent: string
  /** 修改后内容 */
  modifiedContent: string
  /** 原始版本标签 */
  originalLabel?: string
  /** 修改版本标签 */
  modifiedLabel?: string
  /** 文件路径 (用于语言检测) */
  filePath?: string
  /** 主题 */
  theme?: 'light' | 'dark'
  /** 是否可编辑 */
  editable?: boolean
  /** 高度 */
  height?: string | number
  /** 关闭回调 */
  onClose?: () => void
  /** 保存修改后内容回调 */
  onSave?: (content: string) => void
}

// 语言扩展映射
const languageExtensions: Record<string, () => any> = {
  javascript: javascript,
  jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: python,
  json: json,
  markdown: markdown
}

/**
 * 获取语言扩展
 */
function getLanguageExtension(language: string) {
  const factory = languageExtensions[language]
  if (factory) {
    return factory()
  }
  return javascript()
}

/**
 * 统计变更数量
 */
function countChanges(original: string, modified: string): { additions: number; deletions: number } {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')

  // 简单的行级对比
  let additions = 0
  let deletions = 0

  const originalSet = new Set(originalLines)
  const modifiedSet = new Set(modifiedLines)

  for (const line of modifiedLines) {
    if (!originalSet.has(line)) {
      additions++
    }
  }

  for (const line of originalLines) {
    if (!modifiedSet.has(line)) {
      deletions++
    }
  }

  return { additions, deletions }
}

/**
 * DiffViewer 组件
 */
const DiffViewer: FC<DiffViewerProps> = ({
  originalContent,
  modifiedContent,
  originalLabel = '原始版本',
  modifiedLabel = '修改版本',
  filePath,
  theme = 'dark',
  editable = false,
  height = '100%',
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MergeView | null>(null)
  const [isReady, setIsReady] = useState(false)

  // 计算变更统计
  const changes = countChanges(originalContent, modifiedContent)

  // 获取语言
  const language = filePath ? getLanguageMode(filePath) : 'text'
  const languageExt = getLanguageExtension(language)

  // 初始化 MergeView
  useEffect(() => {
    if (!containerRef.current) return

    // 清理旧实例
    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const themeExtension = theme === 'dark' ? oneDark : []

    const view = new MergeView({
      a: {
        doc: originalContent,
        extensions: [
          languageExt,
          themeExtension,
          EditorState.readOnly.of(true),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { fontFamily: '"Fira Code", "JetBrains Mono", monospace', fontSize: '13px' },
            '.cm-gutters': { backgroundColor: 'var(--color-background-soft)' }
          })
        ]
      },
      b: {
        doc: modifiedContent,
        extensions: [
          languageExt,
          themeExtension,
          EditorState.readOnly.of(!editable),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { fontFamily: '"Fira Code", "JetBrains Mono", monospace', fontSize: '13px' },
            '.cm-gutters': { backgroundColor: 'var(--color-background-soft)' }
          })
        ]
      },
      parent: containerRef.current,
      orientation: 'a-b', // 左右并排
      revertControls: editable ? 'a-to-b' : undefined,
      highlightChanges: true,
      gutter: true
    })

    viewRef.current = view
    setIsReady(true)

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [originalContent, modifiedContent, language, theme, editable])

  // 获取修改后的内容
  const getModifiedContent = useCallback(() => {
    if (viewRef.current) {
      return viewRef.current.b.state.doc.toString()
    }
    return modifiedContent
  }, [modifiedContent])

  // 处理保存
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(getModifiedContent())
    }
  }, [onSave, getModifiedContent])

  return (
    <Container style={{ height }}>
      {/* 头部工具栏 */}
      <Header>
        <VersionLabels>
          <VersionLabel>
            <Tag color="red">{originalLabel}</Tag>
            <Text type="secondary">{t('canvas.diff.original', '原始')}</Text>
          </VersionLabel>
          <VersionLabel>
            <Tag color="green">{modifiedLabel}</Tag>
            <Text type="secondary">{t('canvas.diff.modified', '修改')}</Text>
          </VersionLabel>
        </VersionLabels>

        <Space>
          <StatsContainer>
            <StatItem $type="addition">+{changes.additions}</StatItem>
            <StatItem $type="deletion">-{changes.deletions}</StatItem>
          </StatsContainer>

          {editable && onSave && (
            <Button type="primary" size="small" onClick={handleSave}>
              {t('common.save', '保存')}
            </Button>
          )}
          {onClose && (
            <Button size="small" onClick={onClose}>
              {t('common.close', '关闭')}
            </Button>
          )}
        </Space>
      </Header>

      {/* 差异视图 */}
      <DiffContainer ref={containerRef}>
        {!isReady && <LoadingText>{t('canvas.diff.loading', '加载中...')}</LoadingText>}
      </DiffContainer>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const VersionLabels = styled.div`
  display: flex;
  gap: 24px;
`

const VersionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const StatsContainer = styled.div`
  display: flex;
  gap: 12px;
  padding: 0 12px;
  border-right: 1px solid var(--color-border);
  margin-right: 4px;
`

const StatItem = styled.span<{ $type: 'addition' | 'deletion' }>`
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  font-weight: 500;
  color: ${(props) => (props.$type === 'addition' ? '#52c41a' : '#ff4d4f')};
`

const DiffContainer = styled.div`
  flex: 1;
  overflow: hidden;

  .cm-mergeView {
    height: 100%;
  }

  .cm-mergeViewEditors {
    height: 100%;
  }

  .cm-mergeViewEditor {
    height: 100%;
  }

  /* 变更高亮样式 */
  .cm-changedLine {
    background-color: rgba(255, 255, 0, 0.1);
  }

  .cm-deletedChunk {
    background-color: rgba(255, 77, 79, 0.15);
  }

  .cm-insertedChunk {
    background-color: rgba(82, 196, 26, 0.15);
  }

  /* Gutter 样式 */
  .cm-changeGutter {
    width: 4px;
  }

  .cm-deletedLineGutter {
    background-color: #ff4d4f;
  }

  .cm-insertedLineGutter {
    background-color: #52c41a;
  }
`

const LoadingText = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-2);
`

export default DiffViewer
