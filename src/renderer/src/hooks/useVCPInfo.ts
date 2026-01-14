/**
 * VCPInfo React Hook
 *
 * Provides real-time subscription to VCP execution events
 * for display in ShowVCP panel and debugging purposes.
 *
 * Usage:
 * ```tsx
 * const { sessions, activeSessions, events, subscribe, unsubscribe } = useVCPInfo()
 *
 * useEffect(() => {
 *   const cleanup = subscribe((event) => {
 *     console.log('VCP Event:', event)
 *   })
 *   return cleanup
 * }, [subscribe])
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Execution status types
 */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

/**
 * Execution step
 */
export interface ExecutionStep {
  id: string
  name: string
  status: ExecutionStatus
  startTime?: string
  endTime?: string
  duration?: number
  message?: string
  progress?: number
  metadata?: Record<string, unknown>
}

/**
 * Execution session
 */
export interface ExecutionSession {
  id: string
  type: 'tool' | 'plugin' | 'workflow' | 'agent'
  name: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  steps: ExecutionStep[]
  currentStepIndex: number
  metadata?: Record<string, unknown>
  parentSessionId?: string
  error?: {
    message: string
    stack?: string
  }
}

/**
 * VCPInfo event types
 */
export type VCPInfoEvent =
  | { type: 'session:start'; session: ExecutionSession }
  | { type: 'session:update'; sessionId: string; updates: Partial<ExecutionSession> }
  | { type: 'session:end'; sessionId: string; status: ExecutionStatus; error?: { message: string; stack?: string } }
  | { type: 'step:start'; sessionId: string; step: ExecutionStep }
  | { type: 'step:progress'; sessionId: string; stepId: string; progress: number; message?: string }
  | { type: 'step:end'; sessionId: string; stepId: string; status: ExecutionStatus; message?: string }

/**
 * VCPInfo hook return type
 */
export interface UseVCPInfoReturn {
  /** All tracked sessions */
  sessions: Map<string, ExecutionSession>
  /** Currently active sessions */
  activeSessions: ExecutionSession[]
  /** Recent events history */
  events: VCPInfoEvent[]
  /** Subscribe to VCPInfo events */
  subscribe: (callback: (event: VCPInfoEvent) => void) => () => void
  /** Get a specific session */
  getSession: (sessionId: string) => Promise<ExecutionSession | null>
  /** Get recent sessions from backend */
  fetchRecentSessions: (limit?: number) => Promise<ExecutionSession[]>
  /** Clear all sessions */
  clearSessions: () => Promise<void>
  /** Loading state */
  loading: boolean
  /** Error state */
  error: string | null
}

/**
 * VCPInfo React Hook
 */
export function useVCPInfo(options?: { maxEvents?: number; autoSubscribe?: boolean }): UseVCPInfoReturn {
  const { maxEvents = 100, autoSubscribe = true } = options || {}

  const [sessions, setSessions] = useState<Map<string, ExecutionSession>>(new Map())
  const [events, setEvents] = useState<VCPInfoEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  /**
   * Process incoming event
   */
  const processEvent = useCallback(
    (event: VCPInfoEvent) => {
      // Add to events history
      setEvents((prev) => {
        const newEvents = [event, ...prev]
        return newEvents.slice(0, maxEvents)
      })

      // Update sessions state
      setSessions((prev) => {
        const newSessions = new Map(prev)

        switch (event.type) {
          case 'session:start':
            newSessions.set(event.session.id, event.session)
            break

          case 'session:update': {
            const session = newSessions.get(event.sessionId)
            if (session) {
              newSessions.set(event.sessionId, { ...session, ...event.updates })
            }
            break
          }

          case 'session:end': {
            const session = newSessions.get(event.sessionId)
            if (session) {
              newSessions.set(event.sessionId, {
                ...session,
                status: event.status,
                error: event.error
              })
            }
            break
          }

          case 'step:start': {
            const session = newSessions.get(event.sessionId)
            if (session) {
              const stepIndex = session.steps.findIndex((s) => s.id === event.step.id)
              if (stepIndex >= 0) {
                session.steps[stepIndex] = event.step
              } else {
                session.steps.push(event.step)
              }
              session.currentStepIndex = session.steps.length - 1
              newSessions.set(event.sessionId, { ...session })
            }
            break
          }

          case 'step:progress': {
            const session = newSessions.get(event.sessionId)
            if (session) {
              const step = session.steps.find((s) => s.id === event.stepId)
              if (step) {
                step.progress = event.progress
                if (event.message) step.message = event.message
                newSessions.set(event.sessionId, { ...session })
              }
            }
            break
          }

          case 'step:end': {
            const session = newSessions.get(event.sessionId)
            if (session) {
              const step = session.steps.find((s) => s.id === event.stepId)
              if (step) {
                step.status = event.status
                if (event.message) step.message = event.message
                newSessions.set(event.sessionId, { ...session })
              }
            }
            break
          }
        }

        return newSessions
      })
    },
    [maxEvents]
  )

  /**
   * Subscribe to VCPInfo events
   */
  const subscribe = useCallback(
    (callback: (event: VCPInfoEvent) => void) => {
      const wrappedCallback = (event: unknown) => {
        const vcpEvent = event as VCPInfoEvent
        processEvent(vcpEvent)
        callback(vcpEvent)
      }

      const cleanup = window.api.vcpInfo.onEvent(wrappedCallback)
      return cleanup
    },
    [processEvent]
  )

  /**
   * Get a specific session
   */
  const getSession = useCallback(async (sessionId: string): Promise<ExecutionSession | null> => {
    try {
      const session = await window.api.vcpInfo.getSession(sessionId)
      return session as ExecutionSession | null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get session')
      return null
    }
  }, [])

  /**
   * Fetch recent sessions from backend
   */
  const fetchRecentSessions = useCallback(async (limit?: number): Promise<ExecutionSession[]> => {
    setLoading(true)
    setError(null)
    try {
      const sessions = (await window.api.vcpInfo.getRecentSessions(limit)) as ExecutionSession[]
      // Update local state
      setSessions((prev) => {
        const newSessions = new Map(prev)
        for (const session of sessions) {
          newSessions.set(session.id, session)
        }
        return newSessions
      })
      return sessions
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Clear all sessions
   */
  const clearSessions = useCallback(async (): Promise<void> => {
    try {
      await window.api.vcpInfo.clearSessions()
      setSessions(new Map())
      setEvents([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear sessions')
    }
  }, [])

  /**
   * Get active sessions
   */
  const activeSessions = Array.from(sessions.values()).filter((s) => s.status === 'running')

  /**
   * Auto-subscribe on mount
   */
  useEffect(() => {
    if (!autoSubscribe) {
      return
    }

    // Subscribe to events
    unsubscribeRef.current = window.api.vcpInfo.onEvent((event: unknown) => {
      processEvent(event as VCPInfoEvent)
    })

    // Fetch initial sessions
    fetchRecentSessions(20)

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [autoSubscribe, fetchRecentSessions, processEvent])

  return {
    sessions,
    activeSessions,
    events,
    subscribe,
    getSession,
    fetchRecentSessions,
    clearSessions,
    loading,
    error
  }
}

/**
 * VCPLog hook for log monitoring
 */
export interface VCPLogCall {
  id: string
  traceId: string
  type: 'tool' | 'plugin' | 'mcp'
  name: string
  status: 'pending' | 'success' | 'error'
  startTime: string
  endTime?: string
  duration?: number
  input?: unknown
  output?: unknown
  error?: string
}

export interface VCPLogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  context: string
  message: string
  data?: unknown
  traceId?: string
}

export interface UseVCPLogReturn {
  calls: VCPLogCall[]
  logs: VCPLogEntry[]
  fetchRecentCalls: (limit?: number) => Promise<VCPLogCall[]>
  fetchRecentLogs: (params?: { limit?: number; level?: string }) => Promise<VCPLogEntry[]>
  getTraceCalls: (traceId: string) => Promise<VCPLogCall[]>
  clear: () => Promise<void>
  loading: boolean
  error: string | null
}

export function useVCPLog(options?: { maxCalls?: number; maxLogs?: number; autoSubscribe?: boolean }): UseVCPLogReturn {
  const { maxCalls = 100, maxLogs = 200, autoSubscribe = true } = options || {}

  const [calls, setCalls] = useState<VCPLogCall[]>([])
  const [logs, setLogs] = useState<VCPLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unsubscribeCallRef = useRef<(() => void) | null>(null)
  const unsubscribeLogRef = useRef<(() => void) | null>(null)

  const fetchRecentCalls = useCallback(
    async (limit?: number): Promise<VCPLogCall[]> => {
      setLoading(true)
      try {
        const result = (await window.api.vcpLog.getRecentCalls(limit || maxCalls)) as VCPLogCall[]
        setCalls(result)
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch calls')
        return []
      } finally {
        setLoading(false)
      }
    },
    [maxCalls]
  )

  const fetchRecentLogs = useCallback(
    async (params?: { limit?: number; level?: string }): Promise<VCPLogEntry[]> => {
      setLoading(true)
      try {
        const result = (await window.api.vcpLog.getRecentLogs({
          limit: params?.limit || maxLogs,
          level: params?.level as 'debug' | 'info' | 'warn' | 'error' | undefined
        })) as VCPLogEntry[]
        setLogs(result)
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs')
        return []
      } finally {
        setLoading(false)
      }
    },
    [maxLogs]
  )

  const getTraceCalls = useCallback(async (traceId: string): Promise<VCPLogCall[]> => {
    try {
      return (await window.api.vcpLog.getTraceCalls(traceId)) as VCPLogCall[]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get trace calls')
      return []
    }
  }, [])

  const clear = useCallback(async (): Promise<void> => {
    try {
      await window.api.vcpLog.clear()
      setCalls([])
      setLogs([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs')
    }
  }, [])

  useEffect(() => {
    if (!autoSubscribe) {
      return
    }

    // Subscribe to call updates
    unsubscribeCallRef.current = window.api.vcpLog.onCallUpdate((data: { type: string; call: unknown }) => {
      const call = data.call as VCPLogCall
      setCalls((prev) => {
        const existing = prev.findIndex((c) => c.id === call.id)
        if (existing >= 0) {
          const newCalls = [...prev]
          newCalls[existing] = call
          return newCalls
        }
        return [call, ...prev].slice(0, maxCalls)
      })
    })

    // Subscribe to log entries
    unsubscribeLogRef.current = window.api.vcpLog.onLog((entry: unknown) => {
      setLogs((prev) => [entry as VCPLogEntry, ...prev].slice(0, maxLogs))
    })

    // Fetch initial data
    fetchRecentCalls()
    fetchRecentLogs()

    return () => {
      if (unsubscribeCallRef.current) {
        unsubscribeCallRef.current()
      }
      if (unsubscribeLogRef.current) {
        unsubscribeLogRef.current()
      }
    }
  }, [autoSubscribe, fetchRecentCalls, fetchRecentLogs, maxCalls, maxLogs])

  return {
    calls,
    logs,
    fetchRecentCalls,
    fetchRecentLogs,
    getTraceCalls,
    clear,
    loading,
    error
  }
}

export default useVCPInfo
