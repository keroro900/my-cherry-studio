/**
 * useCrewEvents - Crew 事件订阅 Hook
 *
 * 类似 VCPChat 的 useVCPInfo，提供实时事件订阅和状态追踪
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  CodeFile,
  CodeIssue,
  CrewEvent,
  CrewMember,
  CrewPhase,
  CrewProgress,
  CrewRole,
  CrewSession,
  CrewTask
} from '../types'

// ==================== 类型定义 ====================

/**
 * 角色活动记录
 */
export interface RoleActivity {
  role: CrewRole
  memberId: string
  memberName: string
  type: 'task_start' | 'task_complete' | 'task_fail' | 'message' | 'file' | 'issue'
  content: string
  timestamp: Date
  taskId?: string
  taskTitle?: string
  duration?: number
  data?: Record<string, unknown>
}

/**
 * 日志条目
 */
export interface CrewLogEntry {
  id: string
  level: 'info' | 'success' | 'warning' | 'error' | 'debug'
  source: CrewRole | 'system' | 'orchestrator'
  message: string
  timestamp: Date
  details?: Record<string, unknown>
}

/**
 * Crew 状态快照
 */
export interface CrewSnapshot {
  session: CrewSession | null
  progress: CrewProgress | null
  members: CrewMember[]
  tasks: CrewTask[]
  currentPhase: CrewPhase | null
  isRunning: boolean
  roleActivities: Map<CrewRole, RoleActivity[]>
  logs: CrewLogEntry[]
  files: CodeFile[]
  issues: CodeIssue[]
  statistics: CrewStatistics
}

/**
 * 统计信息
 */
export interface CrewStatistics {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalFiles: number
  totalIssues: number
  issuesBySeverity: Record<string, number>
  tasksByRole: Record<CrewRole, number>
  averageTaskDuration: number
  startTime: Date | null
  endTime: Date | null
  elapsedTime: number
}

/**
 * Hook 返回类型
 */
export interface UseCrewEventsReturn {
  // 状态
  snapshot: CrewSnapshot
  isSubscribed: boolean

  // 操作
  subscribe: (sessionId: string) => void
  unsubscribe: () => void
  clearLogs: () => void
  clearActivities: () => void

  // 事件处理
  handleEvent: (event: CrewEvent) => void

  // 查询
  getRoleActivities: (role: CrewRole) => RoleActivity[]
  getLogsByLevel: (level: CrewLogEntry['level']) => CrewLogEntry[]
  getLogsBySource: (source: CrewLogEntry['source']) => CrewLogEntry[]
}

// ==================== 初始状态 ====================

const createInitialStatistics = (): CrewStatistics => ({
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  totalFiles: 0,
  totalIssues: 0,
  issuesBySeverity: {},
  tasksByRole: {} as Record<CrewRole, number>,
  averageTaskDuration: 0,
  startTime: null,
  endTime: null,
  elapsedTime: 0
})

const createInitialSnapshot = (): CrewSnapshot => ({
  session: null,
  progress: null,
  members: [],
  tasks: [],
  currentPhase: null,
  isRunning: false,
  roleActivities: new Map(),
  logs: [],
  files: [],
  issues: [],
  statistics: createInitialStatistics()
})

// ==================== Hook 实现 ====================

let logIdCounter = 0

/**
 * Crew 事件订阅 Hook
 */
export function useCrewEvents(): UseCrewEventsReturn {
  const [snapshot, setSnapshot] = useState<CrewSnapshot>(createInitialSnapshot)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const sessionIdRef = useRef<string | null>(null)
  const taskDurationsRef = useRef<number[]>([])
  const taskStartTimesRef = useRef<Map<string, number>>(new Map())

  // 添加日志
  const addLog = useCallback(
    (
      level: CrewLogEntry['level'],
      source: CrewLogEntry['source'],
      message: string,
      details?: Record<string, unknown>
    ) => {
      const entry: CrewLogEntry = {
        id: `log_${++logIdCounter}`,
        level,
        source,
        message,
        timestamp: new Date(),
        details
      }

      setSnapshot((prev) => ({
        ...prev,
        logs: [...prev.logs, entry].slice(-500) // 保留最近 500 条
      }))
    },
    []
  )

  // 添加角色活动
  const addRoleActivity = useCallback((activity: RoleActivity) => {
    setSnapshot((prev) => {
      const newActivities = new Map(prev.roleActivities)
      const roleActivities = newActivities.get(activity.role) || []
      newActivities.set(activity.role, [...roleActivities, activity].slice(-100))
      return { ...prev, roleActivities: newActivities }
    })
  }, [])

  // 事件处理器
  const handleEvent = useCallback(
    (event: CrewEvent) => {
      const { type, data, timestamp } = event

      // 记录通用日志
      addLog('debug', 'orchestrator', `Event: ${type}`, data)

      switch (type) {
        case 'session_started': {
          const session = data.session as CrewSession
          setSnapshot((prev) => ({
            ...prev,
            session,
            members: session.members,
            tasks: session.tasks,
            currentPhase: session.phase,
            isRunning: true,
            statistics: {
              ...prev.statistics,
              startTime: new Date()
            }
          }))
          addLog('info', 'system', `会话已启动: ${session.name}`, { sessionId: session.id })
          break
        }

        case 'session_completed': {
          const { summary, files, issues } = data as {
            summary: string
            files: CodeFile[]
            issues: CodeIssue[]
          }
          setSnapshot((prev) => ({
            ...prev,
            isRunning: false,
            files,
            issues,
            statistics: {
              ...prev.statistics,
              endTime: new Date(),
              elapsedTime: prev.statistics.startTime ? Date.now() - prev.statistics.startTime.getTime() : 0,
              totalFiles: files.length,
              totalIssues: issues.length
            }
          }))
          addLog('success', 'system', '会话已完成', { summary })
          break
        }

        case 'session_failed': {
          const error = data.error as Error
          setSnapshot((prev) => ({
            ...prev,
            isRunning: false,
            statistics: {
              ...prev.statistics,
              endTime: new Date()
            }
          }))
          addLog('error', 'system', `会话失败: ${error?.message || '未知错误'}`)
          break
        }

        case 'phase_changed': {
          const phase = data.phase as CrewPhase
          setSnapshot((prev) => ({
            ...prev,
            currentPhase: phase
          }))
          addLog('info', 'orchestrator', `阶段切换: ${phase}`)
          break
        }

        case 'task_started': {
          const task = data.task as CrewTask
          const member = data.member as CrewMember

          taskStartTimesRef.current.set(task.id, Date.now())

          setSnapshot((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
            members: prev.members.map((m) => (m.id === member.id ? member : m)),
            statistics: {
              ...prev.statistics,
              totalTasks: prev.statistics.totalTasks + 1,
              tasksByRole: {
                ...prev.statistics.tasksByRole,
                [member.role]: (prev.statistics.tasksByRole[member.role] || 0) + 1
              }
            }
          }))

          addRoleActivity({
            role: member.role,
            memberId: member.id,
            memberName: member.name,
            type: 'task_start',
            content: `开始任务: ${task.title}`,
            timestamp: new Date(timestamp),
            taskId: task.id,
            taskTitle: task.title
          })

          addLog('info', member.role, `开始任务: ${task.title}`, {
            taskId: task.id,
            taskType: task.type
          })
          break
        }

        case 'task_completed': {
          const task = data.task as CrewTask
          const member = data.member as CrewMember
          const output = data.output

          const startTime = taskStartTimesRef.current.get(task.id)
          const duration = startTime ? Date.now() - startTime : 0
          if (startTime) {
            taskDurationsRef.current.push(duration)
          }

          setSnapshot((prev) => {
            const avgDuration =
              taskDurationsRef.current.length > 0
                ? taskDurationsRef.current.reduce((a, b) => a + b, 0) / taskDurationsRef.current.length
                : 0

            return {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
              members: prev.members.map((m) => (m.id === member.id ? member : m)),
              statistics: {
                ...prev.statistics,
                completedTasks: prev.statistics.completedTasks + 1,
                averageTaskDuration: avgDuration
              }
            }
          })

          addRoleActivity({
            role: member.role,
            memberId: member.id,
            memberName: member.name,
            type: 'task_complete',
            content: `完成任务: ${task.title}`,
            timestamp: new Date(timestamp),
            taskId: task.id,
            taskTitle: task.title,
            duration,
            data: { output }
          })

          addLog('success', member.role, `完成任务: ${task.title}`, {
            taskId: task.id,
            duration: `${(duration / 1000).toFixed(1)}s`
          })
          break
        }

        case 'task_failed': {
          const task = data.task as CrewTask
          const member = data.member as CrewMember
          const error = data.error as Error

          setSnapshot((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
            members: prev.members.map((m) => (m.id === member.id ? member : m)),
            statistics: {
              ...prev.statistics,
              failedTasks: prev.statistics.failedTasks + 1
            }
          }))

          addRoleActivity({
            role: member.role,
            memberId: member.id,
            memberName: member.name,
            type: 'task_fail',
            content: `任务失败: ${task.title} - ${error?.message || '未知错误'}`,
            timestamp: new Date(timestamp),
            taskId: task.id,
            taskTitle: task.title
          })

          addLog('error', member.role, `任务失败: ${task.title}`, {
            taskId: task.id,
            error: error?.message
          })
          break
        }

        case 'file_generated': {
          const file = data.file as CodeFile
          const task = data.task as CrewTask
          const member = data.member as CrewMember

          setSnapshot((prev) => ({
            ...prev,
            files: [...prev.files.filter((f) => f.path !== file.path), file],
            statistics: {
              ...prev.statistics,
              totalFiles: prev.statistics.totalFiles + 1
            }
          }))

          addRoleActivity({
            role: member.role,
            memberId: member.id,
            memberName: member.name,
            type: 'file',
            content: `生成文件: ${file.path}`,
            timestamp: new Date(timestamp),
            taskId: task.id,
            data: { file }
          })

          addLog('info', member.role, `生成文件: ${file.path}`, {
            action: file.action,
            language: file.language
          })
          break
        }

        case 'issue_found': {
          const issue = data.issue as CodeIssue
          const task = data.task as CrewTask
          const member = data.member as CrewMember

          setSnapshot((prev) => ({
            ...prev,
            issues: [...prev.issues, issue],
            statistics: {
              ...prev.statistics,
              totalIssues: prev.statistics.totalIssues + 1,
              issuesBySeverity: {
                ...prev.statistics.issuesBySeverity,
                [issue.severity]: (prev.statistics.issuesBySeverity[issue.severity] || 0) + 1
              }
            }
          }))

          addRoleActivity({
            role: member.role,
            memberId: member.id,
            memberName: member.name,
            type: 'issue',
            content: `发现问题: ${issue.message}`,
            timestamp: new Date(timestamp),
            taskId: task.id,
            data: { issue }
          })

          const logLevel = issue.severity === 'critical' || issue.severity === 'error' ? 'error' : 'warning'
          addLog(logLevel, member.role, `发现问题: ${issue.message}`, {
            severity: issue.severity,
            file: issue.file,
            line: issue.line
          })
          break
        }
      }
    },
    [addLog, addRoleActivity]
  )

  // 订阅
  const subscribe = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId
    setIsSubscribed(true)
    setSnapshot(createInitialSnapshot())
    taskDurationsRef.current = []
    taskStartTimesRef.current.clear()
  }, [])

  // 取消订阅
  const unsubscribe = useCallback(() => {
    sessionIdRef.current = null
    setIsSubscribed(false)
  }, [])

  // 清除日志
  const clearLogs = useCallback(() => {
    setSnapshot((prev) => ({ ...prev, logs: [] }))
  }, [])

  // 清除活动记录
  const clearActivities = useCallback(() => {
    setSnapshot((prev) => ({ ...prev, roleActivities: new Map() }))
  }, [])

  // 获取角色活动
  const getRoleActivities = useCallback(
    (role: CrewRole): RoleActivity[] => {
      return snapshot.roleActivities.get(role) || []
    },
    [snapshot.roleActivities]
  )

  // 按级别获取日志
  const getLogsByLevel = useCallback(
    (level: CrewLogEntry['level']): CrewLogEntry[] => {
      return snapshot.logs.filter((log) => log.level === level)
    },
    [snapshot.logs]
  )

  // 按来源获取日志
  const getLogsBySource = useCallback(
    (source: CrewLogEntry['source']): CrewLogEntry[] => {
      return snapshot.logs.filter((log) => log.source === source)
    },
    [snapshot.logs]
  )

  // 清理
  useEffect(() => {
    return () => {
      sessionIdRef.current = null
    }
  }, [])

  return {
    snapshot,
    isSubscribed,
    subscribe,
    unsubscribe,
    clearLogs,
    clearActivities,
    handleEvent,
    getRoleActivities,
    getLogsByLevel,
    getLogsBySource
  }
}

export default useCrewEvents
