/**
 * IDELayout - IDE 风格布局组件
 *
 * 使用 flexbox 实现 IDE 布局：
 * - 左侧：文件浏览器
 * - 中间：编辑器区域 + 底部面板
 * - 右侧：Agent 面板
 */

import {
  BranchesOutlined,
  CodeOutlined,
  FolderOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { Button, Tabs, Tooltip } from 'antd'
import type { FC, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectIDEPanel,
  setActiveBottomTab,
  setActiveRightTab,
  setBottomPanelVisible,
  setLeftPanelVisible,
  setRightPanelVisible
} from '@renderer/store/canvas'

import { MemoryContextPanel } from '../crew'
import { GitChangesPanel, GitCommitPanel, GitStatusBar } from '../git'

interface IDELayoutProps {
  /** 左侧文件浏览器内容 */
  fileExplorer?: ReactNode
  /** 编辑器区域内容 */
  editorArea: ReactNode
  /** 底部面板内容 */
  bottomPanel?: ReactNode
  /** 右侧 Agent 面板内容 */
  agentPanel?: ReactNode
  /** 终端内容 */
  terminal?: ReactNode
  /** 输出内容 */
  output?: ReactNode
  /** 问题列表内容 */
  problems?: ReactNode
  /** 工作目录 */
  workingDirectory?: string | null
  /** 打开文件回调 */
  onOpenFile?: (path: string) => void
  /** 查看 diff 回调 */
  onViewDiff?: (path: string, staged?: boolean) => void
}

/**
 * IDE 布局组件
 */
const IDELayout: FC<IDELayoutProps> = ({
  fileExplorer,
  editorArea,
  bottomPanel,
  agentPanel,
  terminal,
  output,
  problems,
  workingDirectory,
  onOpenFile,
  onViewDiff
}) => {
  const dispatch = useAppDispatch()
  const idePanel = useAppSelector(selectIDEPanel)
  const [_gitPanelVisible, setGitPanelVisible] = useState(false)
  const [stagedCount, _setStagedCount] = useState(0)

  // 切换面板可见性
  const toggleLeftPanel = useCallback(() => {
    dispatch(setLeftPanelVisible(!idePanel.leftPanelVisible))
  }, [dispatch, idePanel.leftPanelVisible])

  const toggleRightPanel = useCallback(() => {
    dispatch(setRightPanelVisible(!idePanel.rightPanelVisible))
  }, [dispatch, idePanel.rightPanelVisible])

  const toggleBottomPanel = useCallback(() => {
    dispatch(setBottomPanelVisible(!idePanel.bottomPanelVisible))
  }, [dispatch, idePanel.bottomPanelVisible])

  // 底部面板标签项
  const bottomTabItems = useMemo(
    () => [
      {
        key: 'terminal',
        label: (
          <TabLabel>
            <CodeOutlined />
            <span>终端</span>
          </TabLabel>
        ),
        children: terminal || <EmptyContent>终端功能开发中...</EmptyContent>
      },
      {
        key: 'output',
        label: (
          <TabLabel>
            <MessageOutlined />
            <span>输出</span>
          </TabLabel>
        ),
        children: output || bottomPanel || <EmptyContent>暂无输出</EmptyContent>
      },
      {
        key: 'problems',
        label: (
          <TabLabel>
            <WarningOutlined />
            <span>问题</span>
          </TabLabel>
        ),
        children: problems || <EmptyContent>暂无问题</EmptyContent>
      }
    ],
    [terminal, output, bottomPanel, problems]
  )

  // 右侧面板标签项
  const rightTabItems = useMemo(
    () => [
      {
        key: 'chat',
        label: '对话',
        children: agentPanel || <EmptyContent>Agent 面板</EmptyContent>
      },
      {
        key: 'changes',
        label: (
          <TabLabel>
            <BranchesOutlined />
            <span>Git</span>
            {stagedCount > 0 && <Badge>{stagedCount}</Badge>}
          </TabLabel>
        ),
        children: (
          <GitPanelContainer>
            <GitStatusBar
              workingDirectory={workingDirectory || null}
              onOpenGitPanel={() => setGitPanelVisible(true)}
            />
            <GitChangesPanel
              workingDirectory={workingDirectory || null}
              onViewDiff={onViewDiff}
              onOpenFile={onOpenFile}
              onRefresh={() => {
                // 刷新时更新已暂存数量
              }}
            />
            <GitCommitPanel
              workingDirectory={workingDirectory || null}
              stagedCount={stagedCount}
              onRefresh={() => {
                // 提交后刷新
              }}
            />
          </GitPanelContainer>
        )
      },
      {
        key: 'config',
        label: '配置',
        children: <EmptyContent>配置面板</EmptyContent>
      },
      {
        key: 'memory',
        label: '记忆',
        children: <MemoryContextPanel compact />
      }
    ],
    [agentPanel, workingDirectory, onViewDiff, onOpenFile, stagedCount]
  )

  return (
    <LayoutContainer>
      {/* 活动栏 */}
      <ActivityBar>
        <Tooltip title="文件浏览器" placement="right">
          <ActivityButton $active={idePanel.leftPanelVisible} onClick={toggleLeftPanel}>
            <FolderOutlined />
          </ActivityButton>
        </Tooltip>
        <Tooltip title="终端/输出" placement="right">
          <ActivityButton $active={idePanel.bottomPanelVisible} onClick={toggleBottomPanel}>
            <CodeOutlined />
          </ActivityButton>
        </Tooltip>
        <ActivitySpacer />
        <Tooltip title="Agent 面板" placement="right">
          <ActivityButton $active={idePanel.rightPanelVisible} onClick={toggleRightPanel}>
            <RobotOutlined />
          </ActivityButton>
        </Tooltip>
        <Tooltip title="设置" placement="right">
          <ActivityButton>
            <SettingOutlined />
          </ActivityButton>
        </Tooltip>
      </ActivityBar>

      {/* 主内容区 */}
      <MainContent>
        <HorizontalLayout>
          {/* 左侧文件浏览器 */}
          {idePanel.leftPanelVisible && (
            <LeftPanel $size={idePanel.leftPanelSize}>
              <PanelHeader>
                <span>资源管理器</span>
                <Button type="text" size="small" icon={<FolderOutlined />} />
              </PanelHeader>
              <PanelContent>{fileExplorer || <EmptyContent>暂无文件</EmptyContent>}</PanelContent>
            </LeftPanel>
          )}

          {/* 中间编辑区 + 底部面板 */}
          <CenterPanel>
            <VerticalLayout>
              {/* 编辑器区域 */}
              <EditorPanel $hasBottom={idePanel.bottomPanelVisible}>{editorArea}</EditorPanel>

              {/* 底部面板 */}
              {idePanel.bottomPanelVisible && (
                <BottomPanel $size={idePanel.bottomPanelSize}>
                  <Tabs
                    activeKey={idePanel.activeBottomTab}
                    onChange={(key) => dispatch(setActiveBottomTab(key as typeof idePanel.activeBottomTab))}
                    items={bottomTabItems}
                    size="small"
                    tabBarExtraContent={
                      <Button type="text" size="small" onClick={toggleBottomPanel}>
                        ×
                      </Button>
                    }
                  />
                </BottomPanel>
              )}
            </VerticalLayout>
          </CenterPanel>

          {/* 右侧 Agent 面板 */}
          {idePanel.rightPanelVisible && (
            <RightPanel $size={idePanel.rightPanelSize}>
              {agentPanel ? (
                /* 当有协同面板时直接显示 */
                <AgentPanelContainer>
                  <PanelHeader>
                    <span>AI 协同</span>
                    <Button type="text" size="small" onClick={toggleRightPanel}>
                      ×
                    </Button>
                  </PanelHeader>
                  <AgentPanelContent>{agentPanel}</AgentPanelContent>
                </AgentPanelContainer>
              ) : (
                /* 否则显示默认标签页 */
                <Tabs
                  activeKey={idePanel.activeRightTab}
                  onChange={(key) => dispatch(setActiveRightTab(key as typeof idePanel.activeRightTab))}
                  items={rightTabItems}
                  size="small"
                  tabBarExtraContent={
                    <Button type="text" size="small" onClick={toggleRightPanel}>
                      ×
                    </Button>
                  }
                />
              )}
            </RightPanel>
          )}
        </HorizontalLayout>
      </MainContent>
    </LayoutContainer>
  )
}

// ==================== 样式组件 ====================

const LayoutContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  background-color: var(--color-background);
  overflow: hidden;
`

const ActivityBar = styled.div`
  width: 48px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  background-color: var(--color-background-soft);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
`

const ActivityButton = styled.button<{ $active?: boolean }>`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px 0;
  border: none;
  border-radius: 6px;
  background: ${(props) => (props.$active ? 'var(--color-primary-bg)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-2)')};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;

  &:hover {
    background: var(--color-background-mute);
    color: var(--color-text-1);
  }
`

const ActivitySpacer = styled.div`
  flex: 1;
`

const MainContent = styled.div`
  flex: 1;
  height: 100%;
  overflow: hidden;
`

const HorizontalLayout = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`

const VerticalLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const CenterPanel = styled.div`
  flex: 1;
  height: 100%;
  overflow: hidden;
  min-width: 0;
`

const LeftPanel = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}%;
  min-width: 150px;
  max-width: 400px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
`

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const PanelContent = styled.div`
  flex: 1;
  overflow: auto;
`

const EditorPanel = styled.div<{ $hasBottom: boolean }>`
  flex: ${(props) => (props.$hasBottom ? '0.7' : '1')};
  overflow: hidden;
  background-color: var(--color-background);
  min-height: 200px;
`

const BottomPanel = styled.div<{ $size: number }>`
  height: ${(props) => props.$size}%;
  min-height: 150px;
  max-height: 60%;
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;

  .ant-tabs {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .ant-tabs-nav {
    margin: 0;
    flex-shrink: 0;
  }

  .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
    overflow: hidden;
    padding: 0;
  }
`

const RightPanel = styled.div<{ $size: number }>`
  width: ${(props) => props.$size}%;
  min-width: 200px;
  max-width: 500px;
  height: 100%;
  background-color: var(--color-background);
  border-left: 1px solid var(--color-border);
  flex-shrink: 0;

  .ant-tabs {
    height: 100%;
  }

  .ant-tabs-content {
    height: calc(100% - 40px);
  }

  .ant-tabs-tabpane {
    height: 100%;
    overflow: auto;
  }
`

const AgentPanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const AgentPanelContent = styled.div`
  flex: 1;
  overflow: auto;
`

const TabLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
`

const EmptyContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
  font-size: 13px;
`

const GitPanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
  padding: 8px;
  overflow: auto;
`

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border-radius: 8px;
`

export default IDELayout
