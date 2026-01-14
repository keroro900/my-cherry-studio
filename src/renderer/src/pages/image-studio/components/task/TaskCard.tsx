/**
 * 任务卡片组件
 *
 * 显示单个任务的状态、进度和操作按钮
 * 支持暂停/恢复、优先执行、取消、重试等操作
 */

import {
  CloseOutlined,
  HolderOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  VerticalAlignTopOutlined
} from '@ant-design/icons'
import type { ImageTask, TaskStatus, TaskType } from '@renderer/pages/image-studio/types'
import { Tooltip } from 'antd'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface TaskCardProps {
  task: ImageTask
  onCancel: (taskId: string) => void
  onRetry: (taskId: string) => void
  onPause?: (taskId: string) => void
  onResume?: (taskId: string) => void
  onPrioritize?: (taskId: string) => void
  isDragging?: boolean
  dragHandleProps?: any
}

const TaskCard: FC<TaskCardProps> = ({
  task,
  onCancel,
  onRetry,
  onPause,
  onResume,
  onPrioritize,
  isDragging = false,
  dragHandleProps
}) => {
  const { t } = useTranslation()

  const statusLabel = useMemo(() => {
    const statusMap: Record<TaskStatus, string> = {
      queued: t('image_studio.task.status.queued'),
      running: t('image_studio.task.status.running'),
      paused: t('image_studio.task.status.paused', 'Paused'),
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
  const showCancel = task.status === 'queued' || task.status === 'running' || task.status === 'paused'
  const showRetry = task.status === 'failed'
  const showPause = task.status === 'queued' && onPause
  const showResume = task.status === 'paused' && onResume
  const showPrioritize = (task.status === 'queued' || task.status === 'paused') && onPrioritize

  return (
    <Container $status={task.status} $isDragging={isDragging}>
      {/* 拖拽手柄 */}
      {dragHandleProps && (
        <DragHandle {...dragHandleProps}>
          <HolderOutlined />
        </DragHandle>
      )}

      <ContentWrapper>
        <Header>
          <TaskInfo>
            <TaskTypeLabel>{typeLabel}</TaskTypeLabel>
            <StatusBadge $status={task.status}>{statusLabel}</StatusBadge>
          </TaskInfo>
          <Actions>
            {showPrioritize && (
              <Tooltip title={t('image_studio.task.actions.prioritize', '优先执行')}>
                <ActionButton onClick={() => onPrioritize!(task.id)}>
                  <VerticalAlignTopOutlined />
                </ActionButton>
              </Tooltip>
            )}
            {showPause && (
              <Tooltip title={t('image_studio.task.actions.pause')}>
                <ActionButton onClick={() => onPause!(task.id)}>
                  <PauseCircleOutlined />
                </ActionButton>
              </Tooltip>
            )}
            {showResume && (
              <Tooltip title={t('image_studio.task.actions.resume')}>
                <ActionButton onClick={() => onResume!(task.id)} $primary>
                  <PlayCircleOutlined />
                </ActionButton>
              </Tooltip>
            )}
            {showRetry && (
              <Tooltip title={t('image_studio.task.actions.retry')}>
                <ActionButton onClick={() => onRetry(task.id)}>
                  <ReloadOutlined />
                </ActionButton>
              </Tooltip>
            )}
            {showCancel && (
              <Tooltip title={t('image_studio.task.actions.cancel')}>
                <ActionButton onClick={() => onCancel(task.id)} $danger>
                  <CloseOutlined />
                </ActionButton>
              </Tooltip>
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

        {task.error && <ErrorText title={task.error}>{task.error}</ErrorText>}
      </ContentWrapper>
    </Container>
  )
}

export default TaskCard

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div<{ $status: TaskStatus; $isDragging?: boolean }>`
  display: flex;
  align-items: stretch;
  padding: 10px;
  margin-bottom: 8px;
  background: var(--color-background);
  border: 1px solid ${(props) => (props.$isDragging ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 6px;
  border-left: 3px solid ${(props) => {
    switch (props.$status) {
      case 'running':
        return 'var(--color-primary)'
      case 'completed':
        return 'var(--color-success)'
      case 'failed':
        return 'var(--color-error)'
      case 'paused':
        return 'var(--color-warning)'
      case 'cancelled':
        return 'var(--color-text-3)'
      default:
        return 'var(--color-border)'
    }
  }};
  opacity: ${(props) => (props.$isDragging ? 0.8 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none')};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary-light, var(--color-primary));
  }
`

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  margin-right: 8px;
  color: var(--color-text-3);
  cursor: grab;

  &:hover {
    color: var(--color-text-2);
  }

  &:active {
    cursor: grabbing;
  }
`

const ContentWrapper = styled.div`
  flex: 1;
  min-width: 0;
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

const TaskTypeLabel = styled.span`
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
      case 'paused':
        return 'var(--color-warning)'
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
      case 'paused':
        return 'var(--color-warning-bg, rgba(250, 173, 20, 0.1))'
      default:
        return 'var(--color-background-soft)'
    }
  }};
`

const Actions = styled.div`
  display: flex;
  gap: 2px;
`

const ActionButton = styled.button<{ $danger?: boolean; $primary?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 12px;
  color: ${(props) =>
    props.$danger ? 'var(--color-error)' : props.$primary ? 'var(--color-primary)' : 'var(--color-text-2)'};
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: ${(props) =>
      props.$danger ? 'var(--color-error)' : props.$primary ? 'var(--color-primary)' : 'var(--color-text)'};
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

const ErrorText = styled.div`
  margin-top: 6px;
  font-size: 10px;
  color: var(--color-error);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
