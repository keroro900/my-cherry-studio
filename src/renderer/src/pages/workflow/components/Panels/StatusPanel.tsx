/**
 * 执行状态面板组件
 * 显示工作流执行状态、日志和任务队列 - 可折叠设计
 */

import { useAppSelector } from '@renderer/store'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ListTodo,
  Loader2,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
  X,
  XCircle
} from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type QueueConfig, type Task, taskQueue, type TaskStatus } from '../../services/TaskQueue'

// 日志条目类型
interface LogEntry {
  id: string
  timestamp: number
  nodeId?: string
  nodeName?: string
  message: string
  type: 'info' | 'success' | 'error' | 'running'
  duration?: number
}

const styles = {
  container: {
    width: '100%',
    backgroundColor: 'var(--ant-color-bg-container)',
    borderTop: '1px solid var(--ant-color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
    flexGrow: 0,
    position: 'relative',
    zIndex: 10,
    boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
    transition: 'height 0.2s ease'
  } as React.CSSProperties,
  header: {
    height: '36px',
    minHeight: '36px',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    cursor: 'pointer',
    userSelect: 'none',
    flex: '0 0 36px',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--ant-color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  } as React.CSSProperties,
  badge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 500,
    backgroundColor: 'var(--ant-color-fill-secondary)',
    color: 'var(--ant-color-text)'
  } as React.CSSProperties,
  stats: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    marginLeft: 'auto'
  } as React.CSSProperties,
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 12px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    fontSize: '12px'
  } as React.CSSProperties,
  emptyState: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'var(--ant-color-text-tertiary)'
  } as React.CSSProperties,
  logItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '4px',
    marginBottom: '4px',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,
  timestamp: {
    color: 'var(--ant-color-text-tertiary)',
    flexShrink: 0,
    fontSize: '11px'
  } as React.CSSProperties,
  logType: {
    fontWeight: 600,
    flexShrink: 0,
    fontSize: '11px',
    minWidth: '60px'
  } as React.CSSProperties,
  logMessage: {
    color: 'var(--ant-color-text)',
    flex: 1,
    wordBreak: 'break-word'
  } as React.CSSProperties,
  duration: {
    color: 'var(--ant-color-text-tertiary)',
    fontSize: '11px',
    flexShrink: 0
  } as React.CSSProperties,
  tabs: {
    display: 'flex',
    gap: '4px',
    marginRight: '16px'
  } as React.CSSProperties,
  tab: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--ant-color-text-secondary)',
    transition: 'all 0.2s'
  } as React.CSSProperties,
  tabActive: {
    backgroundColor: 'var(--ant-color-primary-bg)',
    color: 'var(--ant-color-primary)'
  } as React.CSSProperties,
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    marginBottom: '6px',
    backgroundColor: 'var(--ant-color-bg-elevated)',
    border: '1px solid var(--ant-color-border)'
  } as React.CSSProperties,
  taskInfo: {
    flex: 1,
    minWidth: 0
  } as React.CSSProperties,
  taskName: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--ant-color-text)',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as React.CSSProperties,
  taskMeta: {
    fontSize: '11px',
    color: 'var(--ant-color-text-tertiary)',
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties,
  taskActions: {
    display: 'flex',
    gap: '4px'
  } as React.CSSProperties,
  actionBtn: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: 'var(--ant-color-text-secondary)',
    transition: 'all 0.2s'
  } as React.CSSProperties,
  progressBar: {
    height: '3px',
    backgroundColor: 'var(--ant-color-fill-secondary)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '4px'
  } as React.CSSProperties,
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--ant-color-primary)',
    transition: 'width 0.3s ease'
  } as React.CSSProperties,
  queueHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    padding: '0 4px'
  } as React.CSSProperties,
  queueStats: {
    fontSize: '11px',
    color: 'var(--ant-color-text-tertiary)'
  } as React.CSSProperties,
  queueActions: {
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties
}

const LOG_TYPE_COLORS = {
  info: '#1890ff',
  success: '#52c41a',
  error: '#ff4d4f',
  running: '#722ed1'
}

const LOG_TYPE_BG = {
  info: 'rgba(24, 144, 255, 0.05)',
  success: 'rgba(82, 196, 26, 0.05)',
  error: 'rgba(255, 77, 79, 0.08)',
  running: 'rgba(114, 46, 209, 0.05)'
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#8c8c8c',
  running: '#722ed1',
  completed: '#52c41a',
  failed: '#ff4d4f',
  cancelled: '#faad14',
  paused: '#1890ff'
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  paused: '已暂停'
}

function StatusPanel() {
  // 默认折叠，减少占用空间，给画布更多空间
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [activeTab, setActiveTab] = useState<'logs' | 'queue'>('logs')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [queueStatus, setQueueStatus] = useState(taskQueue.getStatus())
  const [queueConfig, setQueueConfig] = useState<QueueConfig>(taskQueue.getConfig())
  const logsEndRef = useRef<HTMLDivElement>(null)

  const { isExecuting, executionProgress, executionMessage, nodes } = useAppSelector((state) => state.workflow)

  // 计算节点状态统计
  const nodeStats = useMemo(() => {
    const stats = { total: 0, idle: 0, running: 0, completed: 0, error: 0 }
    nodes.forEach((node) => {
      stats.total++
      const status = node.data?.status || 'idle'
      if (status in stats) {
        stats[status as keyof typeof stats]++
      }
    })
    return stats
  }, [nodes])

  // 刷新任务列表
  const refreshTasks = useCallback(() => {
    setTasks(taskQueue.getAllTasks())
    setQueueStatus(taskQueue.getStatus())
  }, [])

  // 监听任务队列事件
  useEffect(() => {
    const handlers = {
      'task:added': refreshTasks,
      'task:started': refreshTasks,
      'task:progress': refreshTasks,
      'task:completed': refreshTasks,
      'task:failed': refreshTasks,
      'task:cancelled': refreshTasks,
      'queue:paused': refreshTasks,
      'queue:resumed': refreshTasks
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      taskQueue.on(event, handler)
    })

    // 初始加载
    refreshTasks()

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        taskQueue.off(event, handler)
      })
    }
  }, [refreshTasks])

  // 监听节点状态变化，生成日志
  useEffect(() => {
    if (isExecuting && executionMessage) {
      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        message: executionMessage,
        type:
          executionMessage.includes('失败') || executionMessage.includes('错误')
            ? 'error'
            : executionMessage.includes('完成') || executionMessage.includes('成功')
              ? 'success'
              : executionMessage.includes('运行中') || executionMessage.includes('执行中')
                ? 'running'
                : 'info'
      }
      setLogs((prev) => [...prev, newLog])
    }
  }, [executionMessage, isExecuting])

  // 监听节点状态变化
  useEffect(() => {
    nodes.forEach((node) => {
      const status = node.data?.status
      const nodeName = node.data?.label || node.id

      if (status === 'running') {
        const existingLog = logs.find((l) => l.nodeId === node.id && l.type === 'running')
        if (!existingLog) {
          setLogs((prev) => [
            ...prev,
            {
              id: `${node.id}-running-${Date.now()}`,
              timestamp: Date.now(),
              nodeId: node.id,
              nodeName,
              message: `Running ${nodeName}...`,
              type: 'running'
            }
          ])
        }
      } else if (status === 'completed') {
        const existingLog = logs.find((l) => l.nodeId === node.id && l.type === 'success')
        if (!existingLog) {
          setLogs((prev) => [
            ...prev,
            {
              id: `${node.id}-success-${Date.now()}`,
              timestamp: Date.now(),
              nodeId: node.id,
              nodeName,
              message: `Completed ${nodeName}`,
              type: 'success',
              duration: (node.data?.result as any)?.duration
            }
          ])
        }
      } else if (status === 'error') {
        const existingLog = logs.find((l) => l.nodeId === node.id && l.type === 'error')
        if (!existingLog) {
          setLogs((prev) => [
            ...prev,
            {
              id: `${node.id}-error-${Date.now()}`,
              timestamp: Date.now(),
              nodeId: node.id,
              nodeName,
              message: `Error in ${nodeName}: ${node.data?.errorMessage || 'Unknown error'}`,
              type: 'error'
            }
          ])
        }
      }
    })
  }, [nodes])

  // 工作流开始时清空日志
  useEffect(() => {
    if (isExecuting && executionProgress === 0) {
      setLogs([
        {
          id: 'start-' + Date.now(),
          timestamp: Date.now(),
          message: 'Workflow started.',
          type: 'info'
        }
      ])
    }
    if (!isExecuting && executionProgress === 100) {
      setLogs((prev) => [
        ...prev,
        {
          id: 'end-' + Date.now(),
          timestamp: Date.now(),
          message: 'Workflow execution finished.',
          type: 'info'
        }
      ])
    }
  }, [isExecuting, executionProgress])

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  // 任务操作
  const handleCancelTask = (taskId: string) => {
    taskQueue.cancelTask(taskId)
  }

  const handleRetryTask = (taskId: string) => {
    taskQueue.retryTask(taskId)
  }

  const handleTogglePause = () => {
    if (queueStatus.isPaused) {
      taskQueue.resume()
    } else {
      taskQueue.pause()
    }
  }

  const handleClearCompleted = () => {
    taskQueue.clearCompleted()
    refreshTasks()
  }

  // 调整并发数量
  const handleChangeConcurrency = (delta: number) => {
    const newValue = Math.max(1, Math.min(10, queueConfig.maxConcurrency + delta))
    if (newValue !== queueConfig.maxConcurrency) {
      taskQueue.updateConfig({ maxConcurrency: newValue })
      setQueueConfig(taskQueue.getConfig())
    }
  }

  // 计算任务队列统计
  const taskStats = useMemo(() => {
    return {
      running: tasks.filter((t) => t.status === 'running').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length
    }
  }, [tasks])

  return (
    <div
      style={{
        ...styles.container,
        height: isCollapsed ? '36px' : '200px',
        minHeight: isCollapsed ? '36px' : '200px'
      }}>
      {/* 头部 - 可点击折叠 */}
      <div
        style={{
          ...styles.header,
          borderBottom: isCollapsed ? 'none' : '1px solid var(--ant-color-border)'
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}>
        {/* 标签页切换 */}
        <div style={styles.tabs} onClick={(e) => e.stopPropagation()}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'logs' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('logs')}>
            <Terminal size={12} style={{ marginRight: '4px' }} />
            执行日志
            <span style={{ ...styles.badge, marginLeft: '4px' }}>{logs.length}</span>
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'queue' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('queue')}>
            <ListTodo size={12} style={{ marginRight: '4px' }} />
            任务队列
            {tasks.length > 0 && <span style={{ ...styles.badge, marginLeft: '4px' }}>{tasks.length}</span>}
          </button>
        </div>

        {/* 状态统计 */}
        <div style={styles.stats}>
          {activeTab === 'logs' ? (
            <>
              <span style={{ ...styles.statItem, color: '#52c41a' }} title="已完成">
                <CheckCircle2 size={12} />
                {nodeStats.completed}
              </span>
              <span style={{ ...styles.statItem, color: '#722ed1' }} title="运行中">
                <Loader2 size={12} className={isExecuting ? 'animate-spin' : ''} />
                {nodeStats.running}
              </span>
              <span style={{ ...styles.statItem, color: '#ff4d4f' }} title="错误">
                <XCircle size={12} />
                {nodeStats.error}
              </span>
            </>
          ) : (
            <>
              <span style={{ ...styles.statItem, color: '#722ed1' }} title="运行中">
                <Loader2 size={12} />
                {taskStats.running}
              </span>
              <span style={{ ...styles.statItem, color: '#8c8c8c' }} title="等待中">
                <Clock size={12} />
                {taskStats.pending}
              </span>
              <span style={{ ...styles.statItem, color: '#52c41a' }} title="已完成">
                <CheckCircle2 size={12} />
                {taskStats.completed}
              </span>
            </>
          )}
        </div>

        {/* 折叠图标 - 折叠时向上箭头表示点击可展开 */}
        <span
          style={{
            color: 'var(--ant-color-text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px'
          }}
          title={isCollapsed ? '展开' : '折叠'}>
          {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* 内容区 */}
      {!isCollapsed && (
        <div style={styles.content}>
          {activeTab === 'logs' ? (
            // 日志内容
            logs.length === 0 ? (
              <div style={styles.emptyState}>
                <MonitorPlay size={24} />
                <p>运行工作流以查看执行日志</p>
              </div>
            ) : (
              <>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      ...styles.logItem,
                      backgroundColor: LOG_TYPE_BG[log.type]
                    }}>
                    <span style={styles.timestamp}>[{formatTime(log.timestamp)}]</span>
                    <span
                      style={{
                        ...styles.logType,
                        color: LOG_TYPE_COLORS[log.type]
                      }}>
                      {log.type.toUpperCase()}
                    </span>
                    <span style={styles.logMessage}>{log.message}</span>
                    {log.duration && (
                      <span style={styles.duration}>
                        <Clock size={10} style={{ marginRight: '2px' }} />
                        {log.duration}ms
                      </span>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )
          ) : (
            // 任务队列内容
            <>
              {/* 队列操作栏 */}
              <div style={styles.queueHeader}>
                {/* 并发数量调整 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={styles.queueStats}>{queueStatus.isPaused ? '已暂停' : '并发'}</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--ant-color-fill-secondary)',
                      borderRadius: '4px',
                      padding: '2px 4px'
                    }}>
                    <button
                      style={{
                        ...styles.actionBtn,
                        width: '20px',
                        height: '20px'
                      }}
                      onClick={() => handleChangeConcurrency(-1)}
                      title="减少并发数"
                      disabled={queueConfig.maxConcurrency <= 1}>
                      <Minus size={12} />
                    </button>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        minWidth: '24px',
                        textAlign: 'center',
                        color: 'var(--ant-color-text)'
                      }}>
                      {queueConfig.maxConcurrency}
                    </span>
                    <button
                      style={{
                        ...styles.actionBtn,
                        width: '20px',
                        height: '20px'
                      }}
                      onClick={() => handleChangeConcurrency(1)}
                      title="增加并发数"
                      disabled={queueConfig.maxConcurrency >= 10}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <span style={{ ...styles.queueStats, marginLeft: '4px' }}>({queueStatus.runningTasks} 运行中)</span>
                </div>

                <div style={styles.queueActions}>
                  <button
                    style={styles.actionBtn}
                    onClick={handleTogglePause}
                    title={queueStatus.isPaused ? '恢复队列' : '暂停队列'}>
                    {queueStatus.isPaused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button style={styles.actionBtn} onClick={handleClearCompleted} title="清除已完成">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 任务列表 */}
              {tasks.length === 0 ? (
                <div style={styles.emptyState}>
                  <ListTodo size={24} />
                  <p>暂无任务，点击"加入队列"添加任务</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} style={styles.taskItem}>
                    {/* 状态指示器 */}
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: STATUS_COLORS[task.status],
                        flexShrink: 0
                      }}
                    />

                    {/* 任务信息 */}
                    <div style={styles.taskInfo}>
                      <div style={styles.taskName}>{task.workflowName}</div>
                      <div style={styles.taskMeta}>
                        <span style={{ color: STATUS_COLORS[task.status] }}>{STATUS_TEXT[task.status]}</span>
                        <span>
                          {task.completedNodes}/{task.totalNodes} 节点
                        </span>
                        {task.startTime && task.endTime && <span>{formatDuration(task.endTime - task.startTime)}</span>}
                      </div>
                      {task.status === 'running' && (
                        <div style={styles.progressBar}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${task.progress}%`
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div style={styles.taskActions}>
                      {(task.status === 'pending' || task.status === 'running') && (
                        <button style={styles.actionBtn} onClick={() => handleCancelTask(task.id)} title="取消任务">
                          <X size={14} />
                        </button>
                      )}
                      {(task.status === 'failed' || task.status === 'cancelled') && (
                        <button style={styles.actionBtn} onClick={() => handleRetryTask(task.id)} title="重试任务">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(StatusPanel)
