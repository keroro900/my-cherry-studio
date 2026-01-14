/**
 * EditorTabs - 编辑器标签页组件
 *
 * 多标签编辑器管理，支持：
 * - 标签页切换
 * - 关闭标签（点击/中键）
 * - 未保存标记
 * - 文件类型图标
 * - 新建文件按钮
 */

import { CloseOutlined, FileOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback } from 'react'
import styled from 'styled-components'

import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  closeAllEditorTabs,
  closeEditorTab,
  selectActiveEditorTab,
  selectEditorTabs,
  setActiveEditorTab,
  type EditorTab
} from '@renderer/store/canvas'

interface EditorTabsProps {
  /** 标签页点击回调 */
  onTabClick?: (tab: EditorTab) => void
  /** 关闭标签回调 */
  onTabClose?: (tab: EditorTab) => void
  /** 新建文件回调 */
  onNewFile?: () => void
}

// 文件类型颜色映射
const FILE_TYPE_COLORS: Record<string, string> = {
  ts: '#3178c6',
  tsx: '#3178c6',
  js: '#f7df1e',
  jsx: '#f7df1e',
  json: '#cbcb41',
  md: '#519aba',
  css: '#563d7c',
  scss: '#c6538c',
  less: '#1d365d',
  html: '#e34c26',
  htm: '#e34c26',
  py: '#3572A5',
  rs: '#dea584',
  go: '#00ADD8',
  java: '#b07219',
  cpp: '#f34b7d',
  c: '#555555',
  yaml: '#cb171e',
  yml: '#cb171e',
  sh: '#89e051',
  sql: '#e38c00'
}

/**
 * 编辑器标签页组件
 */
const EditorTabs: FC<EditorTabsProps> = ({ onTabClick, onTabClose, onNewFile }) => {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector(selectEditorTabs)
  const activeTab = useAppSelector(selectActiveEditorTab)

  // 处理标签点击
  const handleTabClick = useCallback(
    (tab: EditorTab) => {
      if (tab.id !== activeTab?.id) {
        dispatch(setActiveEditorTab(tab.id))
        onTabClick?.(tab)
      }
    },
    [dispatch, activeTab, onTabClick]
  )

  // 处理关闭标签
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tab: EditorTab) => {
      e.stopPropagation()
      dispatch(closeEditorTab(tab.id))
      onTabClose?.(tab)
    },
    [dispatch, onTabClose]
  )

  // 处理中键点击关闭
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tab: EditorTab) => {
      if (e.button === 1) {
        // 中键
        e.preventDefault()
        dispatch(closeEditorTab(tab.id))
        onTabClose?.(tab)
      }
    },
    [dispatch, onTabClose]
  )

  // 获取文件图标
  const getFileIcon = (fileName: string): React.ReactNode => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const color = FILE_TYPE_COLORS[ext]

    if (color) {
      return <FileTextOutlined style={{ color }} />
    }
    return <FileOutlined />
  }

  // 空状态
  if (tabs.length === 0) {
    return (
      <EmptyTabsContainer>
        <EmptyText>未打开文件</EmptyText>
        {onNewFile && (
          <Tooltip title="新建文件">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={onNewFile}>
              新建
            </Button>
          </Tooltip>
        )}
      </EmptyTabsContainer>
    )
  }

  return (
    <TabsContainer>
      <TabsScrollArea>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            $active={tab.isActive}
            $dirty={tab.isDirty}
            onClick={() => handleTabClick(tab)}
            onMouseDown={(e) => handleMouseDown(e, tab)}>
            <TabIcon>{getFileIcon(tab.fileName)}</TabIcon>
            <Tooltip title={tab.filePath} placement="bottom" mouseEnterDelay={0.5}>
              <TabTitle $dirty={tab.isDirty}>
                {tab.fileName}
                {tab.isDirty && <DirtyIndicator>●</DirtyIndicator>}
              </TabTitle>
            </Tooltip>
            <CloseButton $active={tab.isActive} onClick={(e) => handleCloseTab(e, tab)}>
              <CloseOutlined />
            </CloseButton>
          </Tab>
        ))}
      </TabsScrollArea>

      <TabActions>
        {onNewFile && (
          <Tooltip title="新建文件">
            <ActionButton onClick={onNewFile}>
              <PlusOutlined />
            </ActionButton>
          </Tooltip>
        )}
        {tabs.length > 1 && (
          <Tooltip title="关闭所有">
            <ActionButton onClick={() => dispatch(closeAllEditorTabs())}>×</ActionButton>
          </Tooltip>
        )}
      </TabActions>
    </TabsContainer>
  )
}

// ==================== 样式组件 ====================

const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
  flex-shrink: 0;
`

const TabsScrollArea = styled.div`
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  align-items: stretch;

  /* 隐藏滚动条 */
  &::-webkit-scrollbar {
    height: 0;
  }
`

const Tab = styled.div<{ $active?: boolean; $dirty?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 100%;
  min-width: 80px;
  max-width: 200px;
  cursor: pointer;
  border-right: 1px solid var(--color-border);
  background: ${(props) => (props.$active ? 'var(--color-background)' : 'transparent')};
  white-space: nowrap;
  transition: background 0.15s;

  /* 活动标签底部高亮 */
  box-shadow: ${(props) => (props.$active ? 'inset 0 -2px 0 var(--color-primary)' : 'none')};

  &:hover {
    background: ${(props) =>
      props.$active ? 'var(--color-background)' : 'var(--color-background-mute)'};
  }
`

const TabIcon = styled.span`
  display: flex;
  align-items: center;
  font-size: 14px;
  flex-shrink: 0;
`

const TabTitle = styled.span<{ $dirty?: boolean }>`
  font-size: 13px;
  color: ${(props) => (props.$dirty ? 'var(--color-warning)' : 'var(--color-text-1)')};
  font-style: ${(props) => (props.$dirty ? 'italic' : 'normal')};
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
`

const DirtyIndicator = styled.span`
  color: var(--color-warning);
  font-size: 10px;
`

const CloseButton = styled.span<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: auto;
  border-radius: 4px;
  font-size: 10px;
  color: var(--color-text-3);
  opacity: ${(props) => (props.$active ? 1 : 0)};
  transition: all 0.15s;
  flex-shrink: 0;

  ${Tab}:hover & {
    opacity: 1;
  }

  &:hover {
    background: var(--color-error-bg);
    color: var(--color-error);
  }
`

const TabActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 100%;
  border-left: 1px solid var(--color-border);
  flex-shrink: 0;
`

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;

  &:hover {
    background: var(--color-background-mute);
    color: var(--color-text);
  }
`

const EmptyTabsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 36px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const EmptyText = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

export default EditorTabs
