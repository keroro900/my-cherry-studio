/**
 * 任务列表组件
 *
 * 显示工作流任务的执行状态、进度和历史记录
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined
} from '@ant-design/icons'
import { Badge, Button, Empty, List, Progress, Space, Tabs, Tag, Tooltip, Typography } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'

import { type Task, taskQueue, type TaskStatus } from '../../services/TaskQueue'
import { type TaskHistory, taskStorage } from '../../services/TaskStorage'

const { Text } = Typography

/**
 * 状态颜色映射
 */
const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
  paused: 'default'
}

/**
 * 状态图标映射
 */
const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  running: <LoadingOutlined spin />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  cancelled: <StopOutlined />,
  paused: <PauseCircleOutlined />
}

/**
 * 状态文本映射
 */
const STATUS_TEXT: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  paused: '已暂停'
}

/**
 * 格式化时长
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 任务项组件
 */
const TaskItem = memo(function TaskItem({
  task,
  onCancel,
  onRetry
}: {
  task: Task
  onCancel: (taskId: string) => void
  onRetry: (taskId: string) => void
}) {
  const isRunning = task.status === 'running'
  const canCancel = task.status === 'pending' || task.status === 'running'
  const canRetry = task.status === 'failed' || task.status === 'cancelled'

  return (
    <List.Item
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '8px',
        backgroundColor: 'var(--ant-color-bg-container)',
        border: '1px solid var(--ant-color-border)'
      }}
      actions={[
        canCancel && (
          <Tooltip title="取消任务" key="cancel">
            <Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => onCancel(task.id)} />
          </Tooltip>
        ),
        canRetry && (
          <Tooltip title="重试任务" key="retry">
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => onRetry(task.id)} />
          </Tooltip>
        )
      ].filter(Boolean)}>
      <List.Item.Meta
        avatar={
          <Badge status={STATUS_COLORS[task.status] as any} dot={isRunning}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                backgroundColor: 'var(--ant-color-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
              {STATUS_ICONS[task.status]}
            </div>
          </Badge>
        }
        title={
          <Space>
            <Text strong style={{ fontSize: '13px' }}>
              {task.workflowName}
            </Text>
            <Tag color={STATUS_COLORS[task.status]}>{STATUS_TEXT[task.status]}</Tag>
          </Space>
        }
        description={
          <div style={{ fontSize: '12px' }}>
            {isRunning && (
              <div style={{ marginBottom: '8px' }}>
                <Progress
                  percent={task.progress}
                  size="small"
                  status="active"
                  format={(percent) => `${percent}%`}
                  style={{ marginBottom: '4px' }}
                />
                {task.currentNode && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    当前节点: {task.currentNode}
                  </Text>
                )}
              </div>
            )}
            <Space split="·">
              <Text type="secondary">
                {task.completedNodes}/{task.totalNodes} 节点
              </Text>
              {task.startTime && <Text type="secondary">{formatTime(task.startTime)}</Text>}
              {task.endTime && task.startTime && (
                <Text type="secondary">耗时 {formatDuration(task.endTime - task.startTime)}</Text>
              )}
            </Space>
            {task.error && (
              <div style={{ marginTop: '4px' }}>
                <Text type="danger" style={{ fontSize: '11px' }}>
                  错误: {task.error}
                </Text>
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  )
})

/**
 * 历史记录项组件
 */
const HistoryItem = memo(function HistoryItem({
  history,
  onDelete
}: {
  history: TaskHistory
  onDelete: (taskId: string) => void
}) {
  return (
    <List.Item
      style={{
        padding: '10px 16px',
        borderRadius: '6px',
        marginBottom: '6px',
        backgroundColor: 'var(--ant-color-bg-container)'
      }}
      actions={[
        <Tooltip title="删除记录" key="delete">
          <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => onDelete(history.id)} />
        </Tooltip>
      ]}>
      <List.Item.Meta
        title={
          <Space>
            <Text style={{ fontSize: '12px' }}>{history.workflowName}</Text>
            <Tag color={STATUS_COLORS[history.status]} style={{ fontSize: '10px' }}>
              {STATUS_TEXT[history.status]}
            </Tag>
          </Space>
        }
        description={
          <Space split="·" style={{ fontSize: '11px' }}>
            <Text type="secondary">{formatTime(history.createdAt)}</Text>
            {history.duration && <Text type="secondary">{formatDuration(history.duration)}</Text>}
          </Space>
        }
      />
    </List.Item>
  )
})

/**
 * 任务列表主组件
 */
function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [queueStatus, setQueueStatus] = useState(taskQueue.getStatus())

  // 刷新任务列表
  const refreshTasks = useCallback(() => {
    setTasks(taskQueue.getAllTasks())
    setQueueStatus(taskQueue.getStatus())
  }, [])

  // 刷新历史记录
  const refreshHistory = useCallback(() => {
    setHistory(taskStorage.getHistory({ limit: 50 }))
  }, [])

  // 监听任务队列事件
  useEffect(() => {
    const handlers = {
      'task:added': refreshTasks,
      'task:started': refreshTasks,
      'task:progress': refreshTasks,
      'task:completed': () => {
        refreshTasks()
        refreshHistory()
      },
      'task:failed': () => {
        refreshTasks()
        refreshHistory()
      },
      'task:cancelled': () => {
        refreshTasks()
        refreshHistory()
      }
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      taskQueue.on(event, handler)
    })

    // 初始加载
    refreshTasks()
    refreshHistory()

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        taskQueue.off(event, handler)
      })
    }
  }, [refreshTasks, refreshHistory])

  // 取消任务
  const handleCancel = useCallback((taskId: string) => {
    taskQueue.cancelTask(taskId)
  }, [])

  // 重试任务
  const handleRetry = useCallback((taskId: string) => {
    taskQueue.retryTask(taskId)
  }, [])

  // 删除历史记录
  const handleDeleteHistory = useCallback(
    (taskId: string) => {
      taskStorage.deleteHistory(taskId)
      refreshHistory()
    },
    [refreshHistory]
  )

  // 暂停/恢复队列
  const handleTogglePause = useCallback(() => {
    if (queueStatus.isPaused) {
      taskQueue.resume()
    } else {
      taskQueue.pause()
    }
    setQueueStatus(taskQueue.getStatus())
  }, [queueStatus.isPaused])

  // 清除已完成任务
  const handleClearCompleted = useCallback(() => {
    taskQueue.clearCompleted()
    refreshTasks()
  }, [refreshTasks])

  // 清除历史记录
  const handleClearHistory = useCallback(() => {
    taskStorage.clearHistory()
    refreshHistory()
  }, [refreshHistory])

  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'running')
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 队列状态栏 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ant-color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
        <Space>
          <Badge status={queueStatus.isRunning ? 'processing' : 'default'} />
          <Text strong>任务队列</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {queueStatus.runningTasks} 运行中 / {queueStatus.pendingTasks} 等待中
          </Text>
        </Space>
        <Space>
          <Tooltip title={queueStatus.isPaused ? '恢复队列' : '暂停队列'}>
            <Button
              type="text"
              size="small"
              icon={queueStatus.isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={handleTogglePause}
            />
          </Tooltip>
          <Tooltip title="清除已完成">
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={handleClearCompleted} />
          </Tooltip>
        </Space>
      </div>

      {/* 任务列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <Tabs
          size="small"
          items={[
            {
              key: 'active',
              label: `进行中 (${activeTasks.length})`,
              children:
                activeTasks.length > 0 ? (
                  <List
                    dataSource={activeTasks}
                    renderItem={(task) => <TaskItem task={task} onCancel={handleCancel} onRetry={handleRetry} />}
                  />
                ) : (
                  <Empty description="暂无进行中的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )
            },
            {
              key: 'completed',
              label: `已完成 (${completedTasks.length})`,
              children:
                completedTasks.length > 0 ? (
                  <List
                    dataSource={completedTasks}
                    renderItem={(task) => <TaskItem task={task} onCancel={handleCancel} onRetry={handleRetry} />}
                  />
                ) : (
                  <Empty description="暂无已完成的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )
            },
            {
              key: 'history',
              label: `历史记录 (${history.length})`,
              children: (
                <div>
                  {history.length > 0 ? (
                    <>
                      <div style={{ marginBottom: '8px', textAlign: 'right' }}>
                        <Button type="link" size="small" onClick={handleClearHistory}>
                          清除全部
                        </Button>
                      </div>
                      <List
                        dataSource={history}
                        renderItem={(item) => <HistoryItem history={item} onDelete={handleDeleteHistory} />}
                      />
                    </>
                  ) : (
                    <Empty description="暂无历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

export default memo(TaskList)
