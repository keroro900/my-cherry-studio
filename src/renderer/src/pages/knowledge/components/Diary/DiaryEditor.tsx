/**
 * VCP 日记编辑器组件
 *
 * 功能:
 * - 实时语法高亮
 * - 声明语法插入工具栏
 * - 修饰符快捷插入
 * - 自动补全知识库名称
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import type { RootState } from '@renderer/store'

import { DIARY_MODIFIERS, DIARY_SYNTAX, type DiaryDeclarationMode } from './types'
import { VCPSyntaxHighlighter, VCPSyntaxLegend } from './VCPSyntaxHighlighter'

// ==================== 样式组件 ====================

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
`

const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const ToolbarLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-right: 4px;
`

const ToolbarButton = styled.button<{ $color?: string; $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid ${(props) => props.$color || 'var(--color-border)'};
  border-radius: 4px;
  background: ${(props) => (props.$active ? `${props.$color}20` : 'transparent')};
  color: ${(props) => props.$color || 'var(--color-text-primary)'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => `${props.$color || 'var(--color-border)'}30`};
  }

  code {
    font-family: 'Monaco', monospace;
    font-size: 11px;
  }
`

const EditorContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const TextareaWrapper = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`

const StyledTextarea = styled.textarea`
  width: 100%;
  height: 100%;
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  border: none;
  resize: none;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);

  &:focus {
    outline: none;
  }
`

const PreviewPanel = styled.div`
  flex: 1;
  padding: 12px;
  overflow: auto;
  background: var(--color-bg-soft);
  border-left: 1px solid var(--color-border);
`

const PreviewHeader = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
`

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
`

const KnowledgeBaseSelect = styled.select`
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

// ==================== 组件 ====================

interface DiaryEditorProps {
  value: string
  onChange: (value: string) => void
  showPreview?: boolean
  showLegend?: boolean
  placeholder?: string
  className?: string
}

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  value,
  onChange,
  showPreview = true,
  showLegend = true,
  placeholder = '输入日记内容...\n\n使用 [[知识库名]] 插入 RAG 检索\n使用 {{知识库名}} 插入全文注入',
  className
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('')

  // 从 Redux store 获取知识库列表
  const knowledgeBases = useSelector((state: RootState) => state.knowledge.bases)

  // 提取知识库名称列表
  const knowledgeBaseNames = useMemo(() => {
    return knowledgeBases.map((base) => base.name)
  }, [knowledgeBases])

  // 插入声明语法
  const insertDeclaration = useCallback(
    (mode: DiaryDeclarationMode) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const syntax = DIARY_SYNTAX[mode]
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.slice(start, end)

      const insertText = selectedText
        ? `${syntax.open}${selectedText}${syntax.close}`
        : `${syntax.open}知识库名${syntax.close}`

      const newValue = value.slice(0, start) + insertText + value.slice(end)
      onChange(newValue)

      // 恢复焦点并选中知识库名
      setTimeout(() => {
        textarea.focus()
        if (!selectedText) {
          textarea.setSelectionRange(start + syntax.open.length, start + syntax.open.length + 4)
        } else {
          textarea.setSelectionRange(start, start + insertText.length)
        }
      }, 0)
    },
    [value, onChange]
  )

  // 插入修饰符
  const insertModifier = useCallback(
    (modifier: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const pos = textarea.selectionStart
      const newValue = value.slice(0, pos) + modifier + value.slice(pos)
      onChange(newValue)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(pos + modifier.length, pos + modifier.length)
      }, 0)
    },
    [value, onChange]
  )

  // 插入选中的知识库
  const insertKnowledgeBase = useCallback(
    (mode: DiaryDeclarationMode) => {
      if (!selectedKnowledgeBase) return

      const textarea = textareaRef.current
      if (!textarea) return

      const syntax = DIARY_SYNTAX[mode]
      const pos = textarea.selectionStart
      const insertText = `${syntax.open}${selectedKnowledgeBase}${syntax.close}`
      const newValue = value.slice(0, pos) + insertText + value.slice(pos)
      onChange(newValue)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(pos + insertText.length, pos + insertText.length)
      }, 0)
    },
    [value, onChange, selectedKnowledgeBase]
  )

  // 处理文本变化
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      setCursorPosition(e.target.selectionStart)
    },
    [onChange]
  )

  // 统计
  const charCount = value.length
  const declarationCount = (value.match(/\[\[|\{\{|<<|《《/g) || []).length

  return (
    <EditorContainer className={className}>
      {/* 工具栏 */}
      <Toolbar>
        <ToolbarGroup>
          <ToolbarLabel>插入声明:</ToolbarLabel>
          {Object.entries(DIARY_SYNTAX).map(([key, syntax]) => (
            <ToolbarButton
              key={key}
              $color={syntax.color}
              onClick={() => insertDeclaration(key as DiaryDeclarationMode)}
              title={syntax.label}>
              <code>
                {syntax.open}...{syntax.close}
              </code>
            </ToolbarButton>
          ))}
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarLabel>修饰符:</ToolbarLabel>
          {Object.entries(DIARY_MODIFIERS).map(([key, mod]) => (
            <ToolbarButton key={key} onClick={() => insertModifier(mod.key)} title={mod.description}>
              {mod.label}
            </ToolbarButton>
          ))}
        </ToolbarGroup>

        {/* 知识库快速插入 */}
        {knowledgeBaseNames.length > 0 && (
          <ToolbarGroup>
            <ToolbarLabel>知识库:</ToolbarLabel>
            <KnowledgeBaseSelect
              value={selectedKnowledgeBase}
              onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
              title="选择知识库后点击插入按钮">
              <option value="">选择知识库...</option>
              {knowledgeBaseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </KnowledgeBaseSelect>
            <ToolbarButton
              $color="#4CAF50"
              onClick={() => insertKnowledgeBase('rag')}
              disabled={!selectedKnowledgeBase}
              title="插入为 RAG 检索 [[知识库名]]">
              [[插入]]
            </ToolbarButton>
            <ToolbarButton
              $color="#2196F3"
              onClick={() => insertKnowledgeBase('fulltext')}
              disabled={!selectedKnowledgeBase}
              title="插入为全文注入 {{知识库名}}">
              {'{{插入}}'}
            </ToolbarButton>
          </ToolbarGroup>
        )}
      </Toolbar>

      {/* 图例 */}
      {showLegend && (
        <div style={{ padding: '8px 12px' }}>
          <VCPSyntaxLegend />
        </div>
      )}

      {/* 编辑区 */}
      <EditorContent>
        <TextareaWrapper>
          <StyledTextarea ref={textareaRef} value={value} onChange={handleChange} placeholder={placeholder} />
        </TextareaWrapper>

        {/* 预览面板 */}
        {showPreview && (
          <PreviewPanel>
            <PreviewHeader>实时预览</PreviewHeader>
            <VCPSyntaxHighlighter text={value} />
          </PreviewPanel>
        )}
      </EditorContent>

      {/* 状态栏 */}
      <StatusBar>
        <span>字符: {charCount}</span>
        <span>声明: {declarationCount}</span>
        <span>光标: {cursorPosition}</span>
      </StatusBar>
    </EditorContainer>
  )
}

export default DiaryEditor
