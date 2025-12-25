/**
 * 任务队列可视化组件
 *
 * 显示所有待处理和进行中的图片生成任务
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectTaskQueue, selectIsPaused } from '@renderer/store/imageStudio'
import type { FC } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { taskQueueService } from '../../services/TaskQueueService'
import TaskCard from './TaskCard'

const TaskQueue: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const taskQueue = useAppSelector(selectTaskQueue)
  const isPaused = useAppSelector(selectIsPaused)

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      taskQueueService.resumeQueue(dispatch)
    } else {
      taskQueueService.pauseQueue(dispatch)
    }
  }, [isPaused, dispatch])

  const handleCancelTask = useCallback(
    (taskId: string) => {
      taskQueueService.cancelTask(taskId, dispatch)
    },
    [dispatch]
  )

  const handleRetryTask = useCallback(
    (taskId: string) => {
      taskQueueService.retryTask(taskId, dispatch)
    },
    [dispatch]
  )

  // 过滤出活跃的任务（排除已完成和已取消的）
  const activeTasks = taskQueue.filter(
    (task) => task.status !== 'completed' && task.status !== 'cancelled'
  )

  const hasRunningTasks = taskQueue.some((t) => t.status === 'running')

  return (
    <Container>
      <Header>
        <Title>{t('image_studio.gallery.task_queue')}</Title>
        {activeTasks.length > 0 && (
          <HeaderActions>
            <TaskCount>{activeTasks.length}</TaskCount>
            <PauseButton onClick={handlePauseResume} $paused={isPaused}>
              {isPaused ? t('image_studio.task.actions.resume') : t('image_studio.task.actions.pause')}
            </PauseButton>
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
            />
          ))
        )}
      </TaskList>

      {hasRunningTasks && isPaused && (
        <PausedOverlay>
          <PausedText>{t('image_studio.task.actions.pause')}</PausedText>
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
`

const Title = styled.h4`
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const PauseButton = styled.button<{ $paused: boolean }>`
  padding: 2px 8px;
  font-size: 11px;
  color: ${(props) => (props.$paused ? 'var(--color-primary)' : 'var(--color-text-2)')};
  background: transparent;
  border: 1px solid ${(props) => (props.$paused ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-soft);
  }
`

const TaskList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
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
