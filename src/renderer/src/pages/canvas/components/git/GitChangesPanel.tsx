/**
 * GitChangesPanel - Git 变更面板组件
 *
 * 显示工作区变更的文件列表，支持：
 * - 暂存/取消暂存
 * - 查看 diff
 * - 丢弃更改
 * - 分组显示 (暂存、修改、未跟踪)
 */

import {
  CheckOutlined,
  DeleteOutlined,
  DiffOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  FileOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionOutlined,
  RollbackOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import Scrollbar from '@renderer/components/Scrollbar'
import { Button, Checkbox, Collapse, Empty, Popconfirm, Spin, Tooltip, Typography } from 'antd'
import type { FC, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

const { Text } = Typography

// ==================== 类型定义 ====================

interface FileChange {
  path: string
  status: string
}

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: FileChange[]
  modified: FileChange[]
  untracked: string[]
  conflicts: string[]
  stashCount: number
}

interface Props {
  workingDirectory: string | null
  onViewDiff?: (path: string, staged?: boolean) => void
  onOpenFile?: (path: string) => void
  onRefresh?: () => void
}

// ==================== 辅助函数 ====================

/**
 * 获取文件状态图标
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'A':
    case 'added':
      return <FileAddOutlined style={{ color: 'var(--color-success)' }} />
    case 'M':
    case 'modified':
      return <DiffOutlined style={{ color: 'var(--color-warning)' }} />
    case 'D':
    case 'deleted':
      return <FileExcelOutlined style={{ color: 'var(--color-error)' }} />
    case 'R':
    case 'renamed':
      return <FileOutlined style={{ color: 'var(--color-info)' }} />
    case '?':
    case 'untracked':
      return <QuestionOutlined style={{ color: 'var(--color-text-3)' }} />
    default:
      return <FileOutlined />
  }
}


// ==================== 组件实现 ====================

export const GitChangesPanel: FC<Props> = ({ workingDirectory, onViewDiff, onOpenFile, onRefresh }) => {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set())
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set())
  const [operating, setOperating] = useState(false)

  /**
   * 加载状态
   */
  const loadStatus = useCallback(async () => {
    if (!workingDirectory) {
      setStatus(null)
      return
    }

    try {
      setLoading(true)
      const isRepo = await window.api.git.isRepo(workingDirectory)
      if (isRepo) {
        const gitStatus = await window.api.git.getStatus(workingDirectory)
        setStatus(gitStatus)
      } else {
        setStatus(null)
      }
    } catch (error) {
      console.debug('Failed to load Git status:', error)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [workingDirectory])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  /**
   * 合并未暂存文件
   */
  const unstagedFiles = useMemo(() => {
    if (!status) return []

    const files: FileChange[] = [
      ...status.modified,
      ...status.untracked.map((path) => ({ path, status: 'untracked' }))
    ]

    return files
  }, [status])

  /**
   * 暂存选中文件
   */
  const handleStageSelected = useCallback(async () => {
    if (!workingDirectory || selectedUnstaged.size === 0 || operating) return

    try {
      setOperating(true)
      const paths = Array.from(selectedUnstaged)
      await window.api.git.stageFiles(workingDirectory, paths)
      setSelectedUnstaged(new Set())
      await loadStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Stage failed:', error)
      window.toast?.error?.('暂存失败')
    } finally {
      setOperating(false)
    }
  }, [workingDirectory, selectedUnstaged, operating, loadStatus, onRefresh])

  /**
   * 取消暂存选中文件
   */
  const handleUnstageSelected = useCallback(async () => {
    if (!workingDirectory || selectedStaged.size === 0 || operating) return

    try {
      setOperating(true)
      const paths = Array.from(selectedStaged)
      await window.api.git.unstageFiles(workingDirectory, paths)
      setSelectedStaged(new Set())
      await loadStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Unstage failed:', error)
      window.toast?.error?.('取消暂存失败')
    } finally {
      setOperating(false)
    }
  }, [workingDirectory, selectedStaged, operating, loadStatus, onRefresh])

  /**
   * 暂存单个文件
   */
  const handleStageFile = useCallback(
    async (path: string) => {
      if (!workingDirectory || operating) return

      try {
        setOperating(true)
        await window.api.git.stageFiles(workingDirectory, [path])
        await loadStatus()
        onRefresh?.()
      } catch (error) {
        console.error('Stage failed:', error)
        window.toast?.error?.('暂存失败')
      } finally {
        setOperating(false)
      }
    },
    [workingDirectory, operating, loadStatus, onRefresh]
  )

  /**
   * 取消暂存单个文件
   */
  const handleUnstageFile = useCallback(
    async (path: string) => {
      if (!workingDirectory || operating) return

      try {
        setOperating(true)
        await window.api.git.unstageFiles(workingDirectory, [path])
        await loadStatus()
        onRefresh?.()
      } catch (error) {
        console.error('Unstage failed:', error)
        window.toast?.error?.('取消暂存失败')
      } finally {
        setOperating(false)
      }
    },
    [workingDirectory, operating, loadStatus, onRefresh]
  )

  /**
   * 丢弃文件更改
   */
  const handleDiscardFile = useCallback(
    async (path: string) => {
      if (!workingDirectory || operating) return

      try {
        setOperating(true)
        await window.api.git.discardChanges(workingDirectory, [path])
        await loadStatus()
        onRefresh?.()
        window.toast?.success?.('已丢弃更改')
      } catch (error) {
        console.error('Discard failed:', error)
        window.toast?.error?.('丢弃失败')
      } finally {
        setOperating(false)
      }
    },
    [workingDirectory, operating, loadStatus, onRefresh]
  )

  /**
   * 暂存所有
   */
  const handleStageAll = useCallback(async () => {
    if (!workingDirectory || operating || unstagedFiles.length === 0) return

    try {
      setOperating(true)
      const paths = unstagedFiles.map((f) => f.path)
      await window.api.git.stageFiles(workingDirectory, paths)
      await loadStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Stage all failed:', error)
      window.toast?.error?.('暂存失败')
    } finally {
      setOperating(false)
    }
  }, [workingDirectory, operating, unstagedFiles, loadStatus, onRefresh])

  /**
   * 取消暂存所有
   */
  const handleUnstageAll = useCallback(async () => {
    if (!workingDirectory || operating || !status?.staged?.length) return

    try {
      setOperating(true)
      const paths = status.staged.map((f) => f.path)
      await window.api.git.unstageFiles(workingDirectory, paths)
      await loadStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Unstage all failed:', error)
      window.toast?.error?.('取消暂存失败')
    } finally {
      setOperating(false)
    }
  }, [workingDirectory, operating, status?.staged, loadStatus, onRefresh])

  // 加载中
  if (loading && !status) {
    return (
      <Container>
        <LoadingWrapper>
          <Spin />
        </LoadingWrapper>
      </Container>
    )
  }

  // 无数据
  if (!status) {
    return (
      <Container>
        <Empty description="非 Git 仓库" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Container>
    )
  }

  const hasStaged = status.staged.length > 0
  const hasUnstaged = unstagedFiles.length > 0
  const hasConflicts = status.conflicts.length > 0

  // 无变更
  if (!hasStaged && !hasUnstaged && !hasConflicts) {
    return (
      <Container>
        <EmptyWrapper>
          <CheckOutlined style={{ fontSize: 32, color: 'var(--color-success)', marginBottom: 8 }} />
          <Text type="secondary">工作区干净</Text>
        </EmptyWrapper>
      </Container>
    )
  }

  const collapseItems: Array<{
    key: string
    label: ReactNode
    children: ReactNode
  }> = []

  // 冲突文件
  if (hasConflicts) {
    collapseItems.push({
      key: 'conflicts',
      label: (
        <SectionHeader>
          <Text strong style={{ color: 'var(--color-error)' }}>
            冲突 ({status.conflicts.length})
          </Text>
        </SectionHeader>
      ),
      children: (
        <FileList>
          {status.conflicts.map((path) => (
            <FileItem key={path}>
              <FileInfo onClick={() => onOpenFile?.(path)}>
                <FileExcelOutlined style={{ color: 'var(--color-error)' }} />
                <FileName>{path.split('/').pop()}</FileName>
                <FilePath>{path}</FilePath>
              </FileInfo>
            </FileItem>
          ))}
        </FileList>
      )
    })
  }

  // 已暂存
  if (hasStaged) {
    collapseItems.push({
      key: 'staged',
      label: (
        <SectionHeader>
          <Text strong>已暂存 ({status.staged.length})</Text>
          <HStack gap={4}>
            <Tooltip title="取消暂存选中">
              <Button
                size="small"
                type="text"
                icon={<MinusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleUnstageSelected()
                }}
                disabled={selectedStaged.size === 0 || operating}
              />
            </Tooltip>
            <Tooltip title="取消暂存全部">
              <Button
                size="small"
                type="text"
                icon={<UndoOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleUnstageAll()
                }}
                disabled={operating}
              />
            </Tooltip>
          </HStack>
        </SectionHeader>
      ),
      children: (
        <FileList>
          {status.staged.map((file) => (
            <FileItem key={file.path}>
              <Checkbox
                checked={selectedStaged.has(file.path)}
                onChange={(e) => {
                  const newSet = new Set(selectedStaged)
                  if (e.target.checked) {
                    newSet.add(file.path)
                  } else {
                    newSet.delete(file.path)
                  }
                  setSelectedStaged(newSet)
                }}
              />
              <FileInfo onClick={() => onOpenFile?.(file.path)}>
                {getStatusIcon(file.status)}
                <FileName>{file.path.split('/').pop()}</FileName>
                <FilePath>{file.path}</FilePath>
              </FileInfo>
              <FileActions>
                <Tooltip title="查看 Diff">
                  <ActionButton
                    size="small"
                    type="text"
                    icon={<DiffOutlined />}
                    onClick={() => onViewDiff?.(file.path, true)}
                  />
                </Tooltip>
                <Tooltip title="取消暂存">
                  <ActionButton
                    size="small"
                    type="text"
                    icon={<MinusOutlined />}
                    onClick={() => handleUnstageFile(file.path)}
                  />
                </Tooltip>
              </FileActions>
            </FileItem>
          ))}
        </FileList>
      )
    })
  }

  // 未暂存
  if (hasUnstaged) {
    collapseItems.push({
      key: 'unstaged',
      label: (
        <SectionHeader>
          <Text strong>变更 ({unstagedFiles.length})</Text>
          <HStack gap={4}>
            <Tooltip title="暂存选中">
              <Button
                size="small"
                type="text"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStageSelected()
                }}
                disabled={selectedUnstaged.size === 0 || operating}
              />
            </Tooltip>
            <Tooltip title="暂存全部">
              <Button
                size="small"
                type="text"
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStageAll()
                }}
                disabled={operating}
              />
            </Tooltip>
          </HStack>
        </SectionHeader>
      ),
      children: (
        <FileList>
          {unstagedFiles.map((file) => (
            <FileItem key={file.path}>
              <Checkbox
                checked={selectedUnstaged.has(file.path)}
                onChange={(e) => {
                  const newSet = new Set(selectedUnstaged)
                  if (e.target.checked) {
                    newSet.add(file.path)
                  } else {
                    newSet.delete(file.path)
                  }
                  setSelectedUnstaged(newSet)
                }}
              />
              <FileInfo onClick={() => onOpenFile?.(file.path)}>
                {getStatusIcon(file.status)}
                <FileName>{file.path.split('/').pop()}</FileName>
                <FilePath>{file.path}</FilePath>
              </FileInfo>
              <FileActions>
                <Tooltip title="查看 Diff">
                  <ActionButton
                    size="small"
                    type="text"
                    icon={<DiffOutlined />}
                    onClick={() => onViewDiff?.(file.path, false)}
                  />
                </Tooltip>
                <Tooltip title="暂存">
                  <ActionButton
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => handleStageFile(file.path)}
                  />
                </Tooltip>
                {file.status !== 'untracked' && (
                  <Popconfirm
                    title="确定丢弃更改？"
                    description="此操作不可撤销"
                    onConfirm={() => handleDiscardFile(file.path)}
                    okText="丢弃"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}>
                    <Tooltip title="丢弃更改">
                      <ActionButton size="small" type="text" danger icon={<RollbackOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                )}
                {file.status === 'untracked' && (
                  <Popconfirm
                    title="确定删除文件？"
                    description="此操作不可撤销"
                    onConfirm={() => handleDiscardFile(file.path)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}>
                    <Tooltip title="删除">
                      <ActionButton size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                )}
              </FileActions>
            </FileItem>
          ))}
        </FileList>
      )
    })
  }

  return (
    <Container>
      <Scrollbar>
        <StyledCollapse
          items={collapseItems}
          defaultActiveKey={['conflicts', 'staged', 'unstaged']}
          ghost
          expandIconPosition="start"
        />
      </Scrollbar>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const LoadingWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`

const EmptyWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
`

const StyledCollapse = styled(Collapse)`
  .ant-collapse-header {
    padding: 8px 12px !important;
    background: var(--color-background-soft);
    border-radius: 6px !important;
    margin-bottom: 4px;
  }

  .ant-collapse-content-box {
    padding: 0 !important;
  }
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const FileList = styled.div`
  display: flex;
  flex-direction: column;
`

const FileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;

  &:hover {
    background: var(--color-background-soft);
  }

  .ant-checkbox-wrapper {
    margin-right: 0;
  }
`

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  cursor: pointer;

  .anticon {
    font-size: 14px;
  }
`

const FileName = styled.span`
  font-size: 13px;
  color: var(--color-text);
  white-space: nowrap;
`

const FilePath = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const FileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;

  ${FileItem}:hover & {
    opacity: 1;
  }
`

const ActionButton = styled(Button)`
  padding: 0 4px;
  height: 22px;
  min-width: 22px;

  .anticon {
    font-size: 12px;
  }
`

export default GitChangesPanel
