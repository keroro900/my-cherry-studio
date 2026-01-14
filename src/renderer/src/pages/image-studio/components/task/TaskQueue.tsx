/**
 * 任务队列可视化组件
 *
 * 显示所有待处理和进行中的图片生成任务
 * 支持批量操作：暂停全部、恢复全部、重试全部失败、取消全部等待
 */

import { PauseOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectIsPaused, selectQueueStats, selectTaskQueue } from '@renderer/store/imageStudio'
import { Dropdown, Popconfirm, Tooltip } from 'antd'
import { MoreHorizontal } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { taskQueueService } from '../../services/TaskQueueService'
import TaskCard from './TaskCard'

const TaskQueue: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const taskQueue = useAppSelector(selectTaskQueue)
  const isPaused = useAppSelector(selectIsPaused)
  const stats = useAppSelector(selectQueueStats)

  // 暂停/恢复队列
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      taskQueueService.resumeQueue(dispatch)
    } else {
      taskQueueService.pauseQueue(dispatch)
    }
  }, [isPaused, dispatch])

  // 取消任务
  const handleCancelTask = useCallback(
    (taskId: string) => {
      taskQueueService.cancelTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 重试任务
  const handleRetryTask = useCallback(
    (taskId: string) => {
      taskQueueService.retryTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 暂停单个任务
  const handlePauseTask = useCallback(
    (taskId: string) => {
      taskQueueService.pauseSingleTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 恢复单个任务
  const handleResumeTask = useCallback(
    (taskId: string) => {
      taskQueueService.resumeSingleTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 优先执行任务
  const handlePrioritizeTask = useCallback(
    (taskId: string) => {
      taskQueueService.prioritizeTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 重试所有失败任务
  const handleRetryAllFailed = useCallback(() => {
    taskQueueService.retryAllFailedTasks(dispatch)
  }, [dispatch])

  // 取消所有等待任务
  const handleCancelAllQueued = useCallback(() => {
    taskQueueService.cancelAllQueuedTasks(dispatch)
  }, [dispatch])

  // 过滤出活跃的任务（排除已完成和已取消的）
  const activeTasks = useMemo(
    () => taskQueue.filter((task) => task.status !== 'completed' && task.status !== 'cancelled'),
    [taskQueue]
  )

  const hasRunningTasks = stats.running > 0
  const hasQueuedTasks = stats.queued > 0 || stats.paused > 0
  const hasFailedTasks = stats.failed > 0

  // 更多操作菜单
  const moreMenuItems = useMemo(
    () => [
      {
        key: 'retry-all',
        label: t('image_studio.task.batch.retry_all_failed', '重试全部失败'),
        icon: <ReloadOutlined />,
        disabled: !hasFailedTasks,
        onClick: handleRetryAllFailed
      },
      {
        key: 'cancel-all',
        label: t('image_studio.task.batch.cancel_all_queued', '取消全部等待'),
        icon: <StopOutlined />,
        disabled: !hasQueuedTasks,
        danger: true
      }
    ],
    [hasFailedTasks, hasQueuedTasks, handleRetryAllFailed, t]
  )

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>{t('image_studio.gallery.task_queue')}</Title>
          {activeTasks.length > 0 && <TaskCount>{activeTasks.length}</TaskCount>}
        </HeaderLeft>

        {activeTasks.length > 0 && (
          <HeaderActions>
            {/* 队列状态统计 */}
            <StatsRow>
              {stats.running > 0 && <StatBadge $type="running">{stats.running}</StatBadge>}
              {stats.queued > 0 && <StatBadge $type="queued">{stats.queued}</StatBadge>}
              {stats.paused > 0 && <StatBadge $type="paused">{stats.paused}</StatBadge>}
              {stats.failed > 0 && <StatBadge $type="failed">{stats.failed}</StatBadge>}
            </StatsRow>

            {/* 暂停/恢复按钮 */}
            <Tooltip title={isPaused ? t('image_studio.task.actions.resume') : t('image_studio.task.actions.pause')}>
              <ActionButton onClick={handlePauseResume} $paused={isPaused}>
                {isPaused ? <PlayCircleOutlined /> : <PauseOutlined />}
              </ActionButton>
            </Tooltip>

            {/* 更多操作 */}
            <Dropdown
              menu={{
                items: moreMenuItems.map((item) =>
                  item.key === 'cancel-all'
                    ? {
                        ...item,
                        label: (
                          <Popconfirm
                            title={t('image_studio.task.batch.confirm_cancel_all', '确定取消所有等待中的任务吗？')}
                            onConfirm={handleCancelAllQueued}
                            okText={t('common.confirm')}
                            cancelText={t('common.cancel')}>
                            <span style={{ color: 'var(--color-error)' }}>{item.label}</span>
                          </Popconfirm>
                        )
                      }
                    : item
                )
              }}
              trigger={['click']}
              placement="bottomRight">
              <ActionButton>
                <MoreHorizontal size={14} />
              </ActionButton>
            </Dropdown>
          </HeaderActions>
        )}
      </Header>

      <TaskList>
        {activeTasks.length === 0 ? (
          <EmptyMessage>{t('image_studio.gallery.empty_tasks')}</EmptyMessage>
        ) : (
          activeTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onCancel={handleCancelTask}
              onRetry={handleRetryTask}
              onPause={handlePauseTask}
              onResume={handleResumeTask}
              onPrioritize={handlePrioritizeTask}
            />
          ))
        )}
      </TaskList>

      {hasRunningTasks && isPaused && (
        <PausedOverlay>
          <PausedText>{t('image_studio.task.status.paused', '已暂停')}</PausedText>
        </PausedOverlay>
      )}
    </Container>
  )
}

export default TaskQueue

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  min-height: 40px;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Title = styled.h4`
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
`

const TaskCount = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 11px;
  color: var(--color-white);
  background: var(--color-primary);
  border-radius: 9px;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
`

const StatBadge = styled.span<{ $type: 'running' | 'queued' | 'paused' | 'failed' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  border-radius: 8px;
  color: white;
  background: ${(props) => {
    switch (props.$type) {
      case 'running':
        return 'var(--color-primary)'
      case 'queued':
        return 'var(--color-text-3)'
      case 'paused':
        return 'var(--color-warning)'
      case 'failed':
        return 'var(--color-error)'
    }
  }};
`

const ActionButton = styled.button<{ $paused?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 14px;
  color: ${(props) => (props.$paused ? 'var(--color-primary)' : 'var(--color-text-2)')};
  background: ${(props) => (props.$paused ? 'var(--color-primary-bg)' : 'transparent')};
  border: 1px solid ${(props) => (props.$paused ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-soft);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const TaskList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const EmptyMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
  font-size: 12px;
`

const PausedOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
`

const PausedText = styled.span`
  padding: 8px 16px;
  font-size: 14px;
  color: var(--color-white);
  background: var(--color-warning);
  border-radius: 4px;
`
