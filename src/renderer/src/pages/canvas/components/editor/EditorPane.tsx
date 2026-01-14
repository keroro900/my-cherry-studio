/**
 * EditorPane - 编辑器面板组件
 *
 * 单个编辑器面板，用于显示和编辑文件内容：
 * - 加载文件内容
 * - CodeMirror 编辑器集成
 * - 自动保存
 * - 脏状态管理
 */

import { LoadingOutlined, SaveOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectActiveEditorTab,
  selectEditorSettings,
  updateEditorTabDirty
} from '@renderer/store/canvas'
import { Button, message, Space, Spin, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import CanvasEditor from '../../CanvasEditor'
import { type CanvasFile, getLanguageMode } from '../../types'

// ==================== 类型定义 ====================

interface EditorPaneProps {
  /** 文件内容缓存 */
  fileContents: Map<string, string>
  /** 内容变更回调 */
  onContentChange?: (path: string, content: string) => void
  /** 文件保存回调 */
  onFileSave?: (path: string, content: string) => Promise<boolean>
  /** 是否只读 */
  readOnly?: boolean
}

// ==================== 组件实现 ====================

export const EditorPane: FC<EditorPaneProps> = ({
  fileContents,
  onContentChange,
  onFileSave,
  readOnly = false
}) => {
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector(selectActiveEditorTab)
  const editorSettings = useAppSelector(selectEditorSettings)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentContent, setCurrentContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 当前文件信息
  const currentFile: CanvasFile | null = activeTab
    ? {
        path: activeTab.filePath,
        name: activeTab.fileName,
        content: currentContent,
        language: getLanguageMode(activeTab.filePath),
        modifiedAt: new Date()
      }
    : null

  // 加载文件内容
  useEffect(() => {
    if (!activeTab) {
      setCurrentContent('')
      setOriginalContent('')
      setError(null)
      return
    }

    const loadFileContent = async () => {
      // 优先使用缓存
      const cached = fileContents.get(activeTab.filePath)
      if (cached !== undefined) {
        setCurrentContent(cached)
        setOriginalContent(cached)
        setError(null)
        return
      }

      // 从文件系统加载
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.api.file.read(activeTab.filePath)
        if (result) {
          setCurrentContent(result)
          setOriginalContent(result)
          // 更新缓存
          onContentChange?.(activeTab.filePath, result)
        } else {
          setError('无法读取文件内容')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取文件失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadFileContent()
  }, [activeTab?.filePath, fileContents, onContentChange])

  // 处理内容变更
  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeTab) return

      setCurrentContent(content)
      onContentChange?.(activeTab.filePath, content)

      // 更新脏状态
      const isDirty = content !== originalContent
      dispatch(updateEditorTabDirty({ id: activeTab.id, isDirty }))

      // 清除之前的自动保存定时器
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      // 设置自动保存
      if (editorSettings.autoSave && isDirty && !readOnly) {
        autoSaveTimerRef.current = setTimeout(() => {
          handleSave()
        }, editorSettings.autoSaveInterval)
      }
    },
    [activeTab, originalContent, dispatch, editorSettings, readOnly, onContentChange]
  )

  // 保存文件
  const handleSave = useCallback(async () => {
    if (!activeTab || !onFileSave || readOnly) return

    setIsSaving(true)

    try {
      const success = await onFileSave(activeTab.filePath, currentContent)

      if (success) {
        setOriginalContent(currentContent)
        dispatch(updateEditorTabDirty({ id: activeTab.id, isDirty: false }))
        message.success('文件已保存')
      } else {
        message.error('保存失败')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [activeTab, currentContent, onFileSave, dispatch, readOnly])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // 清理自动保存定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // 无打开文件时的空状态
  if (!activeTab) {
    return (
      <EmptyPane>
        <EmptyIcon>📂</EmptyIcon>
        <EmptyTitle>未打开文件</EmptyTitle>
        <EmptyText>从文件浏览器中选择文件开始编辑</EmptyText>
        <EmptyTips>
          <TipItem>
            <kbd>Ctrl</kbd> + <kbd>O</kbd> 打开文件
          </TipItem>
          <TipItem>
            <kbd>Ctrl</kbd> + <kbd>N</kbd> 新建文件
          </TipItem>
        </EmptyTips>
      </EmptyPane>
    )
  }

  // 加载中
  if (isLoading) {
    return (
      <LoadingPane>
        <Spin indicator={<LoadingOutlined spin />} size="large" />
        <LoadingText>加载文件中...</LoadingText>
      </LoadingPane>
    )
  }

  // 错误状态
  if (error) {
    return (
      <ErrorPane>
        <ErrorIcon>⚠️</ErrorIcon>
        <ErrorTitle>无法加载文件</ErrorTitle>
        <ErrorText>{error}</ErrorText>
        <Button type="primary" size="small" onClick={() => setError(null)}>
          重试
        </Button>
      </ErrorPane>
    )
  }

  return (
    <PaneContainer>
      {/* 编辑器工具栏 */}
      <EditorToolbar>
        <FileInfo>
          <FilePath>{activeTab.filePath}</FilePath>
          {activeTab.isDirty && <DirtyBadge>未保存</DirtyBadge>}
        </FileInfo>
        <Space>
          {!readOnly && (
            <Tooltip title="保存 (Ctrl+S)">
              <Button
                type="text"
                size="small"
                icon={isSaving ? <LoadingOutlined spin /> : <SaveOutlined />}
                disabled={!activeTab.isDirty || isSaving}
                onClick={handleSave}>
                保存
              </Button>
            </Tooltip>
          )}
        </Space>
      </EditorToolbar>

      {/* 编辑器 */}
      <EditorContainer>
        <CanvasEditor
          file={currentFile}
          config={{
            theme: editorSettings.theme === 'dark' ? 'dark' : 'light',
            fontSize: editorSettings.fontSize,
            lineNumbers: editorSettings.lineNumbers,
            lineWrapping: editorSettings.lineWrapping,
            tabSize: editorSettings.tabSize
          }}
          onChange={handleContentChange}
          onSave={handleSave}
          readOnly={readOnly}
        />
      </EditorContainer>
    </PaneContainer>
  )
}

// ==================== 样式组件 ====================

const PaneContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
`

const EditorToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const FilePath = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'SF Mono', Consolas, monospace;
`

const DirtyBadge = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border-radius: 4px;
  flex-shrink: 0;
`

const EditorContainer = styled.div`
  flex: 1;
  overflow: hidden;
`

const EmptyPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  background: var(--color-background);
`

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
`

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  margin: 0 0 8px;
`

const EmptyText = styled.p`
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0 0 24px;
`

const EmptyTips = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const TipItem = styled.div`
  font-size: 12px;
  color: var(--color-text-3);

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 11px;
    font-family: 'SF Mono', Consolas, monospace;
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    margin: 0 2px;
  }
`

const LoadingPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  background: var(--color-background);
`

const LoadingText = styled.span`
  font-size: 14px;
  color: var(--color-text-2);
`

const ErrorPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  background: var(--color-background);
`

const ErrorIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`

const ErrorTitle = styled.h3`
  font-size: 18px;
  font-weight: 500;
  color: var(--color-error);
  margin: 0 0 8px;
`

const ErrorText = styled.p`
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0 0 16px;
  text-align: center;
`

export default EditorPane
