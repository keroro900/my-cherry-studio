/**
 * MultiTabEditor - 多标签编辑器容器
 *
 * 组合 EditorTabs 和 EditorPane，提供完整的多文件编辑体验：
 * - 标签页管理
 * - 文件内容缓存
 * - 编辑器面板
 */

import { useAppSelector } from '@renderer/store'
import { selectEditorTabs } from '@renderer/store/canvas'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import styled from 'styled-components'

import EditorPane from './EditorPane'
import EditorTabs from '../layout/EditorTabs'

// ==================== 类型定义 ====================

interface MultiTabEditorProps {
  /** 新建文件回调 */
  onNewFile?: () => void
  /** 文件保存回调 */
  onFileSave?: (path: string, content: string) => Promise<boolean>
  /** 是否只读 */
  readOnly?: boolean
}

// ==================== 组件实现 ====================

export const MultiTabEditor: FC<MultiTabEditorProps> = ({
  onNewFile,
  onFileSave,
  readOnly = false
}) => {
  const editorTabs = useAppSelector(selectEditorTabs)

  // 文件内容缓存
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map())

  // 处理内容变更
  const handleContentChange = useCallback((path: string, content: string) => {
    setFileContents((prev) => {
      const next = new Map(prev)
      next.set(path, content)
      return next
    })
  }, [])

  // 处理文件保存
  const handleFileSave = useCallback(
    async (path: string, content: string): Promise<boolean> => {
      if (onFileSave) {
        const success = await onFileSave(path, content)
        if (success) {
          // 更新缓存为已保存内容
          setFileContents((prev) => {
            const next = new Map(prev)
            next.set(path, content)
            return next
          })
        }
        return success
      }

      // 默认保存逻辑
      try {
        await window.api.file.write(path, content)
        setFileContents((prev) => {
          const next = new Map(prev)
          next.set(path, content)
          return next
        })
        return true
      } catch (error) {
        console.error('Failed to save file:', error)
        return false
      }
    },
    [onFileSave]
  )

  // 计算显示内容
  const showEditor = editorTabs.length > 0
  const showEmpty = editorTabs.length === 0

  return (
    <Container>
      {/* 标签栏 */}
      <EditorTabs onNewFile={onNewFile} />

      {/* 编辑器内容区 */}
      <ContentArea>
        {showEditor && (
          <EditorPane
            fileContents={fileContents}
            onContentChange={handleContentChange}
            onFileSave={handleFileSave}
            readOnly={readOnly}
          />
        )}

        {showEmpty && (
          <EmptyEditor>
            <EmptyContent>
              <EmptyIcon>📝</EmptyIcon>
              <EmptyTitle>开始编辑</EmptyTitle>
              <EmptyText>
                从左侧文件浏览器选择文件，或使用 @ 指令引用文件
              </EmptyText>
            </EmptyContent>
          </EmptyEditor>
        )}
      </ContentArea>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
`

const ContentArea = styled.div`
  flex: 1;
  overflow: hidden;
`

const EmptyEditor = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--color-background);
`

const EmptyContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
`

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.5;
`

const EmptyTitle = styled.h2`
  font-size: 20px;
  font-weight: 500;
  color: var(--color-text);
  margin: 0 0 12px;
`

const EmptyText = styled.p`
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0;
  max-width: 300px;
  line-height: 1.6;
`

export default MultiTabEditor
