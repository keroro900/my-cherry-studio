/**
 * GitStatusBar - Git 状态栏组件
 *
 * 显示当前仓库的 Git 状态，包括：
 * - 当前分支
 * - 同步状态 (ahead/behind)
 * - 变更文件数量
 * - 快捷操作按钮
 */

import {
  BranchesOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import { Button, Spin, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

// ==================== 类型定义 ====================

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: Array<{ path: string; status: string }>
  modified: Array<{ path: string; status: string }>
  untracked: string[]
  conflicts: string[]
  stashCount: number
}

interface Props {
  workingDirectory: string | null
  onOpenGitPanel?: () => void
  onPull?: () => void
  onPush?: () => void
  compact?: boolean
}

// ==================== 组件实现 ====================

export const GitStatusBar: FC<Props> = ({
  workingDirectory,
  onOpenGitPanel,
  onPull,
  onPush,
  compact = false
}) => {
  const [isRepo, setIsRepo] = useState(false)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  /**
   * 加载 Git 状态
   */
  const loadStatus = useCallback(async () => {
    if (!workingDirectory) {
      setIsRepo(false)
      setStatus(null)
      return
    }

    try {
      setLoading(true)

      // 检查是否是 Git 仓库
      const isGitRepo = await window.api.git.isRepo(workingDirectory)
      setIsRepo(isGitRepo)

      if (isGitRepo) {
        // 获取状态
        const gitStatus = await window.api.git.getStatus(workingDirectory)
        setStatus(gitStatus)
      } else {
        setStatus(null)
      }
    } catch (error) {
      console.debug('Failed to load Git status:', error)
      setIsRepo(false)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [workingDirectory])

  // 初始化和目录变化时加载
  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // 定期刷新（每 30 秒）
  useEffect(() => {
    if (!isRepo) return

    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [isRepo, loadStatus])

  /**
   * 处理拉取
   */
  const handlePull = useCallback(async () => {
    if (!workingDirectory || syncing) return

    try {
      setSyncing(true)
      await window.api.git.pull(workingDirectory)
      window.toast?.success?.('拉取成功')
      await loadStatus()
      onPull?.()
    } catch (error) {
      console.error('Pull failed:', error)
      window.toast?.error?.('拉取失败')
    } finally {
      setSyncing(false)
    }
  }, [workingDirectory, syncing, loadStatus, onPull])

  /**
   * 处理推送
   */
  const handlePush = useCallback(async () => {
    if (!workingDirectory || syncing) return

    try {
      setSyncing(true)
      await window.api.git.push(workingDirectory)
      window.toast?.success?.('推送成功')
      await loadStatus()
      onPush?.()
    } catch (error) {
      console.error('Push failed:', error)
      window.toast?.error?.('推送失败')
    } finally {
      setSyncing(false)
    }
  }, [workingDirectory, syncing, loadStatus, onPush])

  /**
   * 初始化仓库
   */
  const handleInit = useCallback(async () => {
    if (!workingDirectory) return

    try {
      await window.api.git.init(workingDirectory)
      window.toast?.success?.('Git 仓库初始化成功')
      await loadStatus()
    } catch (error) {
      console.error('Git init failed:', error)
      window.toast?.error?.('初始化失败')
    }
  }, [workingDirectory, loadStatus])

  // 无工作目录
  if (!workingDirectory) {
    return null
  }

  // 加载中
  if (loading && !status) {
    return (
      <Container $compact={compact}>
        <Spin size="small" />
      </Container>
    )
  }

  // 非 Git 仓库
  if (!isRepo) {
    return (
      <Container $compact={compact}>
        <InitButton size="small" type="text" icon={<PlusOutlined />} onClick={handleInit}>
          {!compact && '初始化 Git'}
        </InitButton>
      </Container>
    )
  }

  // 统计变更数量
  const changesCount =
    (status?.staged?.length || 0) + (status?.modified?.length || 0) + (status?.untracked?.length || 0)

  const hasConflicts = (status?.conflicts?.length || 0) > 0

  return (
    <Container $compact={compact} onClick={onOpenGitPanel} style={{ cursor: onOpenGitPanel ? 'pointer' : 'default' }}>
      <HStack gap={compact ? 4 : 8} style={{ alignItems: 'center' }}>
        {/* 分支名 */}
        <BranchTag>
          <BranchesOutlined style={{ marginRight: 4 }} />
          {status?.branch || 'main'}
        </BranchTag>

        {/* 同步状态 */}
        {(status?.ahead || 0) > 0 && (
          <Tooltip title={`${status?.ahead} 个提交待推送`}>
            <SyncTag color="blue">↑{status?.ahead}</SyncTag>
          </Tooltip>
        )}
        {(status?.behind || 0) > 0 && (
          <Tooltip title={`${status?.behind} 个提交待拉取`}>
            <SyncTag color="orange">↓{status?.behind}</SyncTag>
          </Tooltip>
        )}

        {/* 变更数量 */}
        {changesCount > 0 && (
          <Tooltip title={`${changesCount} 个文件已变更`}>
            <ChangesTag color={hasConflicts ? 'error' : 'warning'}>{changesCount} 变更</ChangesTag>
          </Tooltip>
        )}

        {/* Stash 数量 */}
        {(status?.stashCount || 0) > 0 && (
          <Tooltip title={`${status?.stashCount} 个 stash`}>
            <Tag style={{ fontSize: 11 }}>📦 {status?.stashCount}</Tag>
          </Tooltip>
        )}

        {/* 操作按钮 */}
        {!compact && (
          <HStack gap={4}>
            <Tooltip title="刷新">
              <ActionButton
                size="small"
                type="text"
                icon={loading ? <SyncOutlined spin /> : <ReloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  loadStatus()
                }}
              />
            </Tooltip>
            <Tooltip title="拉取">
              <ActionButton
                size="small"
                type="text"
                icon={<CloudDownloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePull()
                }}
                disabled={syncing}
              />
            </Tooltip>
            <Tooltip title="推送">
              <ActionButton
                size="small"
                type="text"
                icon={<CloudUploadOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePush()
                }}
                disabled={syncing || (status?.ahead || 0) === 0}
              />
            </Tooltip>
          </HStack>
        )}
      </HStack>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  padding: ${(props) => (props.$compact ? '2px 6px' : '4px 12px')};
  background: var(--color-background-soft);
  border-radius: 6px;
  font-size: ${(props) => (props.$compact ? '11px' : '12px')};

  &:hover {
    background: var(--color-background-mute);
  }
`

const BranchTag = styled.span`
  display: flex;
  align-items: center;
  font-weight: 500;
  color: var(--color-text);
`

const SyncTag = styled(Tag)`
  font-size: 11px;
  margin: 0;
  padding: 0 4px;
  line-height: 18px;
`

const ChangesTag = styled(Tag)`
  font-size: 11px;
  margin: 0;
  padding: 0 6px;
  line-height: 18px;
`

const ActionButton = styled(Button)`
  padding: 0 4px;
  height: 22px;
  min-width: 22px;

  .anticon {
    font-size: 12px;
  }
`

const InitButton = styled(Button)`
  font-size: 11px;
  height: 22px;
  padding: 0 8px;
`

export default GitStatusBar
