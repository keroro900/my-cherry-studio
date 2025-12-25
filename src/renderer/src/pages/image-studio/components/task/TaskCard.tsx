/**
 * 任务卡片组件
 *
 * 显示单个任务的状态、进度和操作按钮
 */

import { CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ImageTask, TaskStatus, TaskType } from '@renderer/pages/image-studio/types'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface TaskCardProps {
  task: ImageTask
  onCancel: (taskId: string) => void
  onRetry: (taskId: string) => void
}

const TaskCard: FC<TaskCardProps> = ({ task, onCancel, onRetry }) => {
  const { t } = useTranslation()

  const statusLabel = useMemo(() => {
    const statusMap: Record<TaskStatus, string> = {
      queued: t('image_studio.task.status.queued'),
      running: t('image_studio.task.status.running'),
      completed: t('image_studio.task.status.completed'),
      failed: t('image_studio.task.status.failed'),
      cancelled: t('image_studio.task.status.cancelled')
    }
    return statusMap[task.status]
  }, [task.status, t])

  const typeLabel = useMemo(() => {
    const typeMap: Record<TaskType, string> = {
      generate: t('image_studio.task.type.generate'),
      regenerate: t('image_studio.task.type.regenerate'),
      local_edit: t('image_studio.task.type.local_edit')
    }
    return typeMap[task.type]
  }, [task.type, t])

  const progressPercent = useMemo(() => {
    if (task.progress.total === 0) return 0
    return Math.round((task.progress.current / task.progress.total) * 100)
  }, [task.progress])

  const showProgress = task.status === 'running'
  const showCancel = task.status === 'queued' || task.status === 'running'
  const showRetry = task.status === 'failed'

  return (
    <Container $status={task.status}>
      <Header>
        <TaskInfo>
          <TaskType>{typeLabel}</TaskType>
          <StatusBadge $status={task.status}>{statusLabel}</StatusBadge>
        </TaskInfo>
        <Actions>
          {showRetry && (
            <ActionButton onClick={() => onRetry(task.id)} title={t('image_studio.task.actions.retry')}>
              <ReloadOutlined />
            </ActionButton>
          )}
          {showCancel && (
            <ActionButton onClick={() => onCancel(task.id)} title={t('image_studio.task.actions.cancel')}>
              <CloseOutlined />
            </ActionButton>
          )}
        </Actions>
      </Header>

      {showProgress && (
        <ProgressSection>
          <ProgressBar>
            <ProgressFill $percent={progressPercent} />
          </ProgressBar>
          <ProgressText>
            {task.progress.step && <StepText>{task.progress.step}</StepText>}
            <PercentText>{progressPercent}%</PercentText>
          </ProgressText>
        </ProgressSection>
      )}
    </Container>
  )
}

export default TaskCard

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div<{ $status: TaskStatus }>`
  padding: 10px;
  margin-bottom: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  border-left: 3px solid
    ${(props) => {
      switch (props.$status) {
        case 'running':
          return 'var(--color-primary)'
        case 'completed':
          return 'var(--color-success)'
        case 'failed':
          return 'var(--color-error)'
        case 'cancelled':
          return 'var(--color-text-3)'
        default:
          return 'var(--color-border)'
      }
    }};
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const TaskInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const TaskType = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
`

const StatusBadge = styled.span<{ $status: TaskStatus }>`
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 4px;
  color: ${(props) => {
    switch (props.$status) {
      case 'running':
        return 'var(--color-primary)'
      case 'completed':
        return 'var(--color-success)'
      case 'failed':
        return 'var(--color-error)'
      default:
        return 'var(--color-text-2)'
    }
  }};
  background: ${(props) => {
    switch (props.$status) {
      case 'running':
        return 'var(--color-primary-bg)'
      case 'completed':
        return 'var(--color-success-bg, rgba(82, 196, 26, 0.1))'
      case 'failed':
        return 'var(--color-error-bg, rgba(255, 77, 79, 0.1))'
      default:
        return 'var(--color-background-soft)'
    }
  }};
`

const Actions = styled.div`
  display: flex;
  gap: 4px;
`

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-2);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--color-text);
    background: var(--color-background-soft);
  }
`

const ProgressSection = styled.div`
  margin-top: 8px;
`

const ProgressBar = styled.div`
  height: 4px;
  background: var(--color-background-soft);
  border-radius: 2px;
  overflow: hidden;
`

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${(props) => props.$percent}%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
`

const ProgressText = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
`

const StepText = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
`

const PercentText = styled.span`
  font-size: 10px;
  color: var(--color-text-2);
`
