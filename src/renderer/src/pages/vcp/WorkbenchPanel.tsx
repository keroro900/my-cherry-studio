/**
 * VCP Workbench Panel - 统一工作台与调用可视化
 *
 * 展示完整信息流：
 * - 所有助手的 AI 调用历史
 * - VCP/MCP 工具调用 → 任务 → 结果/错误
 * - Agent 消息与协作
 *
 * 统一日志流：AI 调用 + VCPLog + AgentMessage + AsyncTask
 * 支持按 assistant/agent/tool/plugin/taskId 过滤
 *
 * @see VCP-NATIVE-REWRITE-PLAN.md Phase 7.1.1
 */

import {
  ApiOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
  CodeOutlined,
  CommentOutlined,
  FilterOutlined,
  ReloadOutlined,
  RightOutlined,
  RobotOutlined,
  RocketOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useAppSelector } from '@renderer/store'

const { Text, Title } = Typography
const { Search } = Input

/**
 * 统一调用记录类型
 * 包含 AI 调用、工具调用、Agent 消息、Crew 活动
 */
interface UnifiedCallRecord {
  id: string
  type: 'ai_call' | 'tool_call' | 'agent_message' | 'crew_activity'
  traceId?: string

  // AI 调用相关
  assistantId?: string
  assistantName?: string
  modelId?: string
  modelName?: string
  topicId?: string

  // 工具调用相关
  toolName?: string
  pluginName?: string
  params?: Record<string, unknown>
  source?: 'vcp' | 'mcp' | 'native' | 'crew'

  // Agent 消息相关
  agentId?: string
  agentName?: string
  messageContent?: string

  // Crew 活动相关
  crewSessionId?: string
  crewEventType?: string
  crewRoleName?: string
  crewPhase?: string

  // 通用字段
  result?: unknown
  error?: string
  status: 'pending' | 'running' | 'success' | 'error'
  startTime: number
  endTime?: number
  duration?: number

  // Token 使用
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * 异步任务类型
 */
interface AsyncTask {
  taskId: string
  pluginName: string
  status: 'pending' | 'running' | 'completed' | 'timeout' | 'error'
  progress?: number
  createdAt: number
  completedAt?: number
  result?: unknown
  error?: string
}

/**
 * 日志条目类型
 */
interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
  data?: unknown
}

/**
 * 过滤器状态类型
 */
interface FilterState {
  search: string
  type?: string
  assistantId?: string
  toolName?: string
  status?: string
  source?: string
}

/**
 * Native 模块状态
 */
interface NativeStatus {
  isNative: boolean
  version: string
  features: string[]
  status: string
}

/**
 * WorkbenchPanel 组件
 */
const WorkbenchPanel: FC = () => {
  const { t } = useTranslation()

  // 从 Redux 获取助手列表
  const assistants = useAppSelector((state) => state.assistants.assistants)

  // 状态
  const [callRecords, setCallRecords] = useState<UnifiedCallRecord[]>([])
  const [asyncTasks, setAsyncTasks] = useState<AsyncTask[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ search: '' })
  const [selectedCall, setSelectedCall] = useState<UnifiedCallRecord | null>(null)
  const [activeTab, setActiveTab] = useState('calls')
  const [stats, setStats] = useState({
    totalCalls: 0,
    aiCalls: 0,
    toolCalls: 0,
    crewCalls: 0,
    successRate: 0,
    pendingTasks: 0,
    avgDuration: 0,
    totalTokens: 0
  })

  // 自动刷新
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Native VCP 状态
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | null>(null)
  const [showVCPEnabled, setShowVCPEnabled] = useState(false)

  // 助手名称映射
  const assistantMap = useMemo(() => {
    const map = new Map<string, string>()
    assistants.forEach((a) => {
      map.set(a.id, a.name)
    })
    return map
  }, [assistants])

  /**
   * 加载工具调用记录（VCP + MCP）
   */
  const loadToolCalls = useCallback(async (): Promise<UnifiedCallRecord[]> => {
    try {
      const result = await window.api.vcpLog.getRecentCalls(100)
      if (result && Array.isArray(result)) {
        return result.map((call: any) => ({
          id: call.id || call.callId || `tool-${Date.now()}-${Math.random()}`,
          type: 'tool_call' as const,
          traceId: call.traceId,
          toolName: call.toolName || call.name || 'unknown',
          pluginName: call.metadata?.pluginName || call.pluginName || call.plugin,
          params: call.input?.params || call.params || {},
          result: call.output?.result ?? call.result ?? call.output,
          error: typeof call.error === 'object' ? call.error?.message : call.error,
          status: call.status || (call.error ? 'error' : call.output !== undefined ? 'success' : call.endTime ? 'success' : 'pending'),
          startTime: call.startTime instanceof Date ? call.startTime.getTime() : (call.startTime || call.timestamp || Date.now()),
          endTime: call.endTime instanceof Date ? call.endTime.getTime() : call.endTime,
          duration: call.duration || (call.endTime && call.startTime ? (typeof call.endTime === 'object' ? call.endTime.getTime() : call.endTime) - (typeof call.startTime === 'object' ? call.startTime.getTime() : call.startTime) : undefined),
          source: call.source || call.toolType || 'vcp',
          assistantId: call.metadata?.assistantId || call.assistantId,
          assistantName: call.metadata?.assistantId ? assistantMap.get(call.metadata.assistantId) : (call.assistantId ? assistantMap.get(call.assistantId) : undefined),
          agentId: call.metadata?.agentId || call.agentId
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to load tool calls:', error)
      return []
    }
  }, [assistantMap])

  /**
   * 加载 Agent 消息历史
   */
  const loadAgentMessages = useCallback(async (): Promise<UnifiedCallRecord[]> => {
    try {
      // 尝试获取 Agent 消息历史
      const result = await window.api.vcpInfo?.getRecentSessions?.(20)
      if (result && Array.isArray(result)) {
        const messages: UnifiedCallRecord[] = []
        for (const session of result) {
          if (session.messages && Array.isArray(session.messages)) {
            for (const msg of session.messages) {
              messages.push({
                id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                type: 'agent_message',
                agentId: msg.agentId || session.agentId,
                agentName: msg.agentName || session.agentName,
                messageContent: msg.content?.slice(0, 200),
                status: 'success',
                startTime: msg.timestamp || Date.now()
              })
            }
          }
        }
        return messages.slice(0, 50)
      }
      return []
    } catch (error) {
      console.debug('Agent messages API not available:', error)
      return []
    }
  }, [])

  /**
   * 加载 Crew 活动记录
   */
  const loadCrewActivities = useCallback(async (): Promise<UnifiedCallRecord[]> => {
    try {
      // 从日志中获取 crew: 前缀的事件
      const result = await window.api.vcpLog.getRecentLogs({ limit: 200 })
      if (result && Array.isArray(result)) {
        const crewActivities: UnifiedCallRecord[] = []

        for (const log of result) {
          // 检查是否是 Crew 相关的日志
          if (log.source?.startsWith('crew:') || log.type?.startsWith('crew:')) {
            const eventType = log.type?.replace('crew:', '') || log.source?.replace('crew:', '') || 'activity'

            // 解析 Crew 事件类型
            let status: UnifiedCallRecord['status'] = 'success'
            if (eventType.includes('start') || eventType.includes('running')) {
              status = 'running'
            } else if (eventType.includes('error') || eventType.includes('fail')) {
              status = 'error'
            } else if (eventType.includes('complete') || eventType.includes('done')) {
              status = 'success'
            }

            const data = log.data as Record<string, unknown> | undefined

            crewActivities.push({
              id: log.id || `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'crew_activity',
              crewSessionId: (data?.sessionId as string) || undefined,
              crewEventType: eventType,
              crewRoleName: (data?.roleName as string) || (data?.role as string) || undefined,
              crewPhase: (data?.phase as string) || undefined,
              toolName: (data?.toolName as string) || undefined,
              params: data?.params as Record<string, unknown> | undefined,
              result: data?.result,
              error: (data?.error as string) || (data?.message as string) || undefined,
              source: 'crew',
              status,
              startTime: log.timestamp || Date.now(),
              duration: data?.duration as number | undefined,
              messageContent: log.message
            })
          }
        }

        return crewActivities.slice(0, 100)
      }
      return []
    } catch (error) {
      console.debug('Crew activities API not available:', error)
      return []
    }
  }, [])

  /**
   * 加载异步任务
   */
  const loadAsyncTasks = useCallback(async () => {
    try {
      const result = await window.api.vcpTool.getTaskStatus('*')
      if (result?.success && result.data) {
        // data 可能是 JSON 字符串或对象
        const tasksData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
        const tasksList = Array.isArray(tasksData) ? tasksData : tasksData?.tasks || []
        const tasks: AsyncTask[] = tasksList.map((task: any) => ({
          taskId: task.taskId || task.id,
          pluginName: task.pluginName || task.plugin || 'unknown',
          status: task.status || 'pending',
          progress: task.progress,
          createdAt: task.createdAt || task.startTime || Date.now(),
          completedAt: task.completedAt || task.endTime,
          result: task.result,
          error: task.error
        }))
        setAsyncTasks(tasks)
        return tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
      }
      return 0
    } catch (error) {
      console.debug('Async tasks API not available:', error)
      return 0
    }
  }, [])

  /**
   * 加载日志
   */
  const loadLogs = useCallback(async () => {
    try {
      const result = await window.api.vcpLog.getRecentLogs({ limit: 200 })
      if (result && Array.isArray(result)) {
        const logEntries: LogEntry[] = result.map((log: any) => ({
          id: log.id || `log-${Date.now()}-${Math.random()}`,
          timestamp: log.timestamp || Date.now(),
          level: log.level || 'info',
          source: log.source || log.context || 'system',
          message: log.message || '',
          data: log.data
        }))
        setLogs(logEntries)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }, [])

  /**
   * 刷新所有数据
   */
  const refreshAll = useCallback(async () => {
    setLoading(true)

    const [toolCalls, agentMessages, crewActivities, pendingTasks] = await Promise.all([
      loadToolCalls(),
      loadAgentMessages(),
      loadCrewActivities(),
      loadAsyncTasks()
    ])

    // 合并所有调用记录并排序
    const allRecords = [...toolCalls, ...agentMessages, ...crewActivities].sort((a, b) => b.startTime - a.startTime)
    setCallRecords(allRecords)

    // 计算统计
    const aiCalls = allRecords.filter((c) => c.type === 'ai_call').length
    const toolCallsCount = allRecords.filter((c) => c.type === 'tool_call').length
    const crewCallsCount = allRecords.filter((c) => c.type === 'crew_activity').length
    const successCalls = allRecords.filter((c) => c.status === 'success').length
    const durations = allRecords.filter((c) => c.duration).map((c) => c.duration!)
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    const totalTokens = allRecords.reduce((sum, c) => sum + (c.tokenUsage?.totalTokens || 0), 0)

    setStats({
      totalCalls: allRecords.length,
      aiCalls,
      toolCalls: toolCallsCount,
      crewCalls: crewCallsCount,
      successRate: allRecords.length > 0 ? Math.round((successCalls / allRecords.length) * 100) : 0,
      pendingTasks,
      avgDuration,
      totalTokens
    })

    await loadLogs()
    setLoading(false)
  }, [loadToolCalls, loadAgentMessages, loadCrewActivities, loadAsyncTasks, loadLogs])

  /**
   * 清除日志
   */
  const clearLogs = useCallback(async () => {
    try {
      await window.api.vcpLog.clear()
      setCallRecords([])
      setLogs([])
      setStats({
        totalCalls: 0,
        aiCalls: 0,
        toolCalls: 0,
        crewCalls: 0,
        successRate: 0,
        pendingTasks: 0,
        avgDuration: 0,
        totalTokens: 0
      })
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }, [])

  /**
   * 切换 ShowVCP 开关 (控制悬浮调试面板)
   */
  const handleToggleShowVCP = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.api.showVcp.updateConfig({ enabled })
      if (result.success) {
        setShowVCPEnabled(enabled)
      }
    } catch (error) {
      console.error('Failed to toggle ShowVCP:', error)
    }
  }, [])

  /**
   * 加载 Native 状态和 ShowVCP 配置
   */
  const loadNativeStatus = useCallback(async () => {
    try {
      // 获取 Native 状态
      const status = await window.api.vcp.getNativeStatus()
      if (status.success && status.data) {
        setNativeStatus(status.data)
      }

      // 获取 ShowVCP 配置
      const showVCPConfig = await window.api.showVcp.getConfig()
      setShowVCPEnabled(showVCPConfig?.enabled ?? false)
    } catch {
      // Native VCP 服务未就绪
    }
  }, [])

  // 初始化 Native 状态
  useEffect(() => {
    loadNativeStatus()
  }, [loadNativeStatus])

  // 初始化和事件订阅
  useEffect(() => {
    refreshAll()

    // 订阅调用更新事件
    const unsubscribeCall = window.api.vcpLog.onCallUpdate?.((data) => {
      console.debug('Call update:', data)
      refreshAll()
    })

    // 订阅异步任务事件
    const unsubscribeAsync = window.api.vcpTool.onAsyncTaskEvent?.((event) => {
      console.debug('Async task event:', event)
      loadAsyncTasks()
    })

    // 订阅日志事件
    const unsubscribeLog = window.api.vcpLog.onLog?.((entry) => {
      console.debug('Log entry:', entry)
      loadLogs()
    })

    return () => {
      unsubscribeCall?.()
      unsubscribeAsync?.()
      unsubscribeLog?.()
    }
  }, [refreshAll, loadAsyncTasks, loadLogs])

  // 自动刷新定时器
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(refreshAll, 5000)
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh, refreshAll])

  /**
   * 过滤调用记录
   */
  const filteredRecords = callRecords.filter((record) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matches =
        record.toolName?.toLowerCase().includes(searchLower) ||
        record.pluginName?.toLowerCase().includes(searchLower) ||
        record.assistantName?.toLowerCase().includes(searchLower) ||
        record.agentName?.toLowerCase().includes(searchLower) ||
        record.crewRoleName?.toLowerCase().includes(searchLower) ||
        record.crewEventType?.toLowerCase().includes(searchLower) ||
        record.crewPhase?.toLowerCase().includes(searchLower) ||
        record.messageContent?.toLowerCase().includes(searchLower) ||
        record.id.toLowerCase().includes(searchLower)
      if (!matches) return false
    }
    if (filters.type && record.type !== filters.type) return false
    if (filters.assistantId && record.assistantId !== filters.assistantId) return false
    if (filters.toolName && record.toolName !== filters.toolName) return false
    if (filters.status && record.status !== filters.status) return false
    if (filters.source && record.source !== filters.source) return false
    return true
  })

  // 获取唯一的工具名列表
  const uniqueToolNames = useMemo(() => {
    const names = new Set(callRecords.filter((c) => c.toolName).map((c) => c.toolName!))
    return Array.from(names)
  }, [callRecords])

  /**
   * 调用记录表格列定义
   */
  const callColumns: ColumnsType<UnifiedCallRecord> = [
    {
      title: t('vcp.workbench.columns.type', '类型'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const config = {
          ai_call: { icon: <RobotOutlined />, color: 'purple', text: 'AI 调用' },
          tool_call: { icon: <ToolOutlined />, color: 'blue', text: '工具' },
          agent_message: { icon: <CommentOutlined />, color: 'green', text: '消息' },
          crew_activity: { icon: <TeamOutlined />, color: 'cyan', text: 'Crew' }
        }
        const cfg = config[type as keyof typeof config] || config.tool_call
        return (
          <Tag icon={cfg.icon} color={cfg.color}>
            {cfg.text}
          </Tag>
        )
      }
    },
    {
      title: t('vcp.workbench.columns.status', '状态'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const config = {
          pending: { icon: <ClockCircleOutlined />, color: 'default', text: '等待' },
          running: { icon: <SyncOutlined spin />, color: 'processing', text: '执行中' },
          success: { icon: <CheckCircleOutlined />, color: 'success', text: '成功' },
          error: { icon: <CloseCircleOutlined />, color: 'error', text: '失败' }
        }
        const cfg = config[status as keyof typeof config] || config.pending
        return (
          <Tag icon={cfg.icon} color={cfg.color}>
            {cfg.text}
          </Tag>
        )
      }
    },
    {
      title: t('vcp.workbench.columns.name', '名称'),
      key: 'name',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>
            {record.type === 'crew_activity'
              ? record.crewEventType || record.crewRoleName || 'Crew Activity'
              : record.toolName || record.agentName || record.modelName || '-'}
          </Text>
          {record.type === 'crew_activity' && record.crewRoleName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <TeamOutlined style={{ marginRight: 4 }} />
              {record.crewRoleName}
            </Text>
          )}
          {record.type === 'crew_activity' && record.crewPhase && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CodeOutlined style={{ marginRight: 4 }} />
              {record.crewPhase}
            </Text>
          )}
          {record.pluginName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.pluginName}
            </Text>
          )}
          {record.assistantName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {record.assistantName}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: t('vcp.workbench.columns.source', '来源'),
      dataIndex: 'source',
      key: 'source',
      width: 80,
      render: (source: string) => {
        if (!source) return '-'
        const colors: Record<string, string> = { vcp: 'blue', mcp: 'green', native: 'purple', crew: 'cyan' }
        return <Tag color={colors[source] || 'default'}>{source.toUpperCase()}</Tag>
      }
    },
    {
      title: t('vcp.workbench.columns.duration', '耗时'),
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration?: number) => (duration ? `${duration}ms` : '-')
    },
    {
      title: t('vcp.workbench.columns.time', '时间'),
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (time: number) => new Date(time).toLocaleString()
    },
    {
      title: t('vcp.workbench.columns.actions', '操作'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setSelectedCall(record)}>
          详情 <RightOutlined />
        </Button>
      )
    }
  ]

  /**
   * 渲染统计卡片
   */
  const renderStats = () => (
    <StatsRow>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.total', '总调用')}
          value={stats.totalCalls}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.tools', '工具调用')}
          value={stats.toolCalls}
          valueStyle={{ color: '#1890ff' }}
          prefix={<ToolOutlined />}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.crew', 'Crew 活动')}
          value={stats.crewCalls}
          valueStyle={{ color: '#13c2c2' }}
          prefix={<TeamOutlined />}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.successRate', '成功率')}
          value={stats.successRate}
          suffix="%"
          valueStyle={{ color: '#52c41a' }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.pending', '进行中')}
          value={stats.pendingTasks}
          valueStyle={{ color: '#faad14' }}
          prefix={<SyncOutlined />}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('vcp.workbench.stats.avgTime', '平均耗时')}
          value={stats.avgDuration}
          suffix="ms"
          prefix={<ClockCircleOutlined />}
        />
      </Card>
    </StatsRow>
  )

  /**
   * 渲染过滤器
   */
  const renderFilters = () => (
    <FilterRow>
      <Search
        placeholder={t('vcp.workbench.search', '搜索工具名、助手名、Agent名或ID...')}
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        style={{ width: 280 }}
        allowClear
      />
      <Select
        placeholder={t('vcp.workbench.filter.type', '类型')}
        value={filters.type}
        onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
        allowClear
        style={{ width: 120 }}
        options={[
          { value: 'ai_call', label: 'AI 调用' },
          { value: 'tool_call', label: '工具调用' },
          { value: 'agent_message', label: 'Agent 消息' },
          { value: 'crew_activity', label: 'Crew 活动' }
        ]}
      />
      <Select
        placeholder={t('vcp.workbench.filter.assistant', '助手')}
        value={filters.assistantId}
        onChange={(value) => setFilters((prev) => ({ ...prev, assistantId: value }))}
        allowClear
        style={{ width: 150 }}
        options={assistants.map((a) => ({ value: a.id, label: a.name }))}
        showSearch
        optionFilterProp="label"
      />
      <Select
        placeholder={t('vcp.workbench.filter.tool', '工具')}
        value={filters.toolName}
        onChange={(value) => setFilters((prev) => ({ ...prev, toolName: value }))}
        allowClear
        style={{ width: 150 }}
        options={uniqueToolNames.map((name) => ({ value: name, label: name }))}
        showSearch
      />
      <Select
        placeholder={t('vcp.workbench.filter.status', '状态')}
        value={filters.status}
        onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
        allowClear
        style={{ width: 100 }}
        options={[
          { value: 'pending', label: '等待中' },
          { value: 'running', label: '执行中' },
          { value: 'success', label: '成功' },
          { value: 'error', label: '失败' }
        ]}
      />
      <Space>
        <Tooltip title={autoRefresh ? '关闭自动刷新' : '开启自动刷新'}>
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            icon={<SyncOutlined spin={autoRefresh && loading} />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          />
        </Tooltip>
        <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading}>
          {t('vcp.workbench.refresh', '刷新')}
        </Button>
        <Button icon={<ClearOutlined />} danger onClick={clearLogs}>
          {t('vcp.workbench.clear', '清除')}
        </Button>
      </Space>
    </FilterRow>
  )

  /**
   * 渲染调用详情面板
   */
  const renderCallDetail = () => {
    if (!selectedCall) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('vcp.workbench.selectCall', '选择一条记录查看详情')}
        />
      )
    }

    return (
      <DetailPanel>
        <DetailHeader>
          <Space wrap>
            <Tag
              color={
                selectedCall.type === 'ai_call'
                  ? 'purple'
                  : selectedCall.type === 'tool_call'
                    ? 'blue'
                    : selectedCall.type === 'crew_activity'
                      ? 'cyan'
                      : 'green'
              }>
              {selectedCall.type === 'ai_call'
                ? 'AI 调用'
                : selectedCall.type === 'tool_call'
                  ? '工具调用'
                  : selectedCall.type === 'crew_activity'
                    ? 'Crew 活动'
                    : 'Agent 消息'}
            </Tag>
            {selectedCall.toolName && <Tag color="blue">{selectedCall.toolName}</Tag>}
            {selectedCall.crewEventType && <Tag color="cyan">{selectedCall.crewEventType}</Tag>}
            {selectedCall.pluginName && <Tag>{selectedCall.pluginName}</Tag>}
            <Tag
              color={selectedCall.status === 'success' ? 'green' : selectedCall.status === 'error' ? 'red' : 'default'}>
              {selectedCall.status}
            </Tag>
          </Space>
          <Button type="text" size="small" onClick={() => setSelectedCall(null)}>
            关闭
          </Button>
        </DetailHeader>

        <Collapse
          defaultActiveKey={['info', 'params', 'result']}
          items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <InfoGrid>
                  <InfoItem>
                    <Text type="secondary">调用ID</Text>
                    <Text code copyable>
                      {selectedCall.id}
                    </Text>
                  </InfoItem>
                  {selectedCall.traceId && (
                    <InfoItem>
                      <Text type="secondary">追踪ID</Text>
                      <Text code copyable>
                        {selectedCall.traceId}
                      </Text>
                    </InfoItem>
                  )}
                  {selectedCall.crewSessionId && (
                    <InfoItem>
                      <Text type="secondary">Crew 会话</Text>
                      <Text code copyable>
                        {selectedCall.crewSessionId}
                      </Text>
                    </InfoItem>
                  )}
                  {selectedCall.crewRoleName && (
                    <InfoItem>
                      <Text type="secondary">角色</Text>
                      <Text>
                        <TeamOutlined style={{ marginRight: 4 }} />
                        {selectedCall.crewRoleName}
                      </Text>
                    </InfoItem>
                  )}
                  {selectedCall.crewPhase && (
                    <InfoItem>
                      <Text type="secondary">阶段</Text>
                      <Tag color="processing">{selectedCall.crewPhase}</Tag>
                    </InfoItem>
                  )}
                  {selectedCall.assistantName && (
                    <InfoItem>
                      <Text type="secondary">助手</Text>
                      <Text>{selectedCall.assistantName}</Text>
                    </InfoItem>
                  )}
                  {selectedCall.agentName && (
                    <InfoItem>
                      <Text type="secondary">Agent</Text>
                      <Text>{selectedCall.agentName}</Text>
                    </InfoItem>
                  )}
                  <InfoItem>
                    <Text type="secondary">开始时间</Text>
                    <Text>{new Date(selectedCall.startTime).toLocaleString()}</Text>
                  </InfoItem>
                  {selectedCall.endTime && (
                    <InfoItem>
                      <Text type="secondary">结束时间</Text>
                      <Text>{new Date(selectedCall.endTime).toLocaleString()}</Text>
                    </InfoItem>
                  )}
                  {selectedCall.duration && (
                    <InfoItem>
                      <Text type="secondary">耗时</Text>
                      <Text>{selectedCall.duration}ms</Text>
                    </InfoItem>
                  )}
                  {selectedCall.tokenUsage && (
                    <InfoItem>
                      <Text type="secondary">Token 使用</Text>
                      <Text>
                        {selectedCall.tokenUsage.promptTokens} + {selectedCall.tokenUsage.completionTokens} ={' '}
                        {selectedCall.tokenUsage.totalTokens}
                      </Text>
                    </InfoItem>
                  )}
                </InfoGrid>
              )
            },
            ...(selectedCall.params
              ? [
                  {
                    key: 'params',
                    label: '输入参数',
                    children: (
                      <CodeBlock>
                        <pre>{JSON.stringify(selectedCall.params, null, 2)}</pre>
                      </CodeBlock>
                    )
                  }
                ]
              : []),
            ...(selectedCall.messageContent
              ? [
                  {
                    key: 'content',
                    label: '消息内容',
                    children: (
                      <CodeBlock>
                        <pre>{selectedCall.messageContent}</pre>
                      </CodeBlock>
                    )
                  }
                ]
              : []),
            {
              key: 'result',
              label: selectedCall.error ? '错误信息' : '输出结果',
              children: (
                <CodeBlock $error={!!selectedCall.error}>
                  <pre>
                    {selectedCall.error
                      ? selectedCall.error
                      : JSON.stringify(selectedCall.result, null, 2) || '无返回结果'}
                  </pre>
                </CodeBlock>
              )
            }
          ]}
        />
      </DetailPanel>
    )
  }

  /**
   * 渲染日志时间线
   */
  const renderLogTimeline = () => (
    <LogTimeline>
      {logs.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
      ) : (
        <Timeline
          items={logs.slice(0, 50).map((log) => ({
            color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : 'blue',
            children: (
              <LogItem>
                <LogHeader>
                  <Badge status={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'processing'} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                  <Tag style={{ fontSize: 11 }}>{log.source}</Tag>
                </LogHeader>
                <Text>{log.message}</Text>
              </LogItem>
            )
          }))}
        />
      )}
    </LogTimeline>
  )

  /**
   * 渲染异步任务列表
   */
  const renderAsyncTasks = () => (
    <TaskList>
      {asyncTasks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无异步任务" />
      ) : (
        asyncTasks.map((task) => (
          <TaskCard key={task.taskId} $status={task.status}>
            <TaskHeader>
              <Space>
                <Text strong>{task.pluginName}</Text>
                <Text type="secondary" copyable={{ text: task.taskId }}>
                  {task.taskId.slice(0, 8)}...
                </Text>
              </Space>
              <Tag
                color={
                  task.status === 'completed'
                    ? 'green'
                    : task.status === 'error' || task.status === 'timeout'
                      ? 'red'
                      : 'blue'
                }>
                {task.status}
              </Tag>
            </TaskHeader>
            {task.progress !== undefined && task.progress < 100 && (
              <TaskProgress>
                <div className="bar" style={{ width: `${task.progress}%` }} />
              </TaskProgress>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              创建于 {new Date(task.createdAt).toLocaleString()}
            </Text>
          </TaskCard>
        ))
      )}
    </TaskList>
  )

  return (
    <WorkbenchContainer>
      <WorkbenchHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>
            <FilterOutlined style={{ marginRight: 8 }} />
            {t('vcp.workbench.title', 'VCP 工作台')}
          </Title>
          <Text type="secondary">{t('vcp.workbench.description', '查看和管理 VCP 工具调用记录')}</Text>
        </div>
        <Space size={16}>
          {/* Native 状态指示器 */}
          {nativeStatus && (
            <Tooltip
              title={
                <div>
                  <div>{nativeStatus.isNative ? 'Rust Native 后端' : 'TypeScript 兼容模式'}</div>
                  <div>Version: {nativeStatus.version}</div>
                  <div>Status: {nativeStatus.status}</div>
                  <div>Features: {nativeStatus.features.join(', ')}</div>
                </div>
              }>
              <NativeIndicator $isNative={nativeStatus.isNative}>
                {nativeStatus.isNative ? <RocketOutlined /> : <ApiOutlined />}
                <span>{nativeStatus.isNative ? 'Native' : 'Fallback'}</span>
              </NativeIndicator>
            </Tooltip>
          )}
          {/* ShowVCP 悬浮调试面板开关 */}
          <Tooltip title={t('vcp.workbench.show_vcp_tooltip', '启用后在左下角显示悬浮调试面板')}>
            <Space size={4}>
              <BugOutlined style={{ color: showVCPEnabled ? '#52c41a' : 'inherit' }} />
              <Switch
                checked={showVCPEnabled}
                onChange={handleToggleShowVCP}
                checkedChildren="调试"
                unCheckedChildren="调试"
                size="small"
              />
            </Space>
          </Tooltip>
        </Space>
      </WorkbenchHeader>

      {renderStats()}
      {renderFilters()}

      <ContentArea>
        <MainPanel>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'calls',
                label: (
                  <span>
                    <ThunderboltOutlined />
                    {t('vcp.workbench.tabs.calls', '调用记录')}
                    <Badge count={filteredRecords.length} style={{ marginLeft: 8 }} />
                  </span>
                ),
                children: (
                  <Spin spinning={loading}>
                    <Table
                      dataSource={filteredRecords}
                      columns={callColumns}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                      onRow={(record) => ({
                        onClick: () => setSelectedCall(record),
                        style: { cursor: 'pointer' }
                      })}
                      rowClassName={(record) => (selectedCall?.id === record.id ? 'selected-row' : '')}
                    />
                  </Spin>
                )
              },
              {
                key: 'tasks',
                label: (
                  <span>
                    <SyncOutlined />
                    {t('vcp.workbench.tabs.tasks', '异步任务')}
                    <Badge count={stats.pendingTasks} style={{ marginLeft: 8 }} />
                  </span>
                ),
                children: renderAsyncTasks()
              },
              {
                key: 'logs',
                label: (
                  <span>
                    <FilterOutlined />
                    {t('vcp.workbench.tabs.logs', '日志流')}
                  </span>
                ),
                children: renderLogTimeline()
              }
            ]}
          />
        </MainPanel>

        <DetailSidebar>{renderCallDetail()}</DetailSidebar>
      </ContentArea>
    </WorkbenchContainer>
  )
}

// ==================== 样式组件 ====================

const WorkbenchContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
  overflow: hidden;
  background: var(--ant-color-bg-container);
`

const WorkbenchHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

const NativeIndicator = styled.div<{ $isNative: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ $isNative }) => ($isNative ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)')};
  color: ${({ $isNative }) => ($isNative ? '#52c41a' : '#faad14')};
  cursor: help;
  transition: all 0.2s;

  &:hover {
    background: ${({ $isNative }) => ($isNative ? 'rgba(82, 196, 26, 0.25)' : 'rgba(250, 173, 20, 0.25)')};
  }
`

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;

  .ant-card {
    background: var(--ant-color-bg-elevated);
    border: 1px solid var(--ant-color-border);
    border-radius: var(--ant-border-radius-lg);
    transition: all 0.2s;

    &:hover {
      border-color: var(--ant-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  @media (max-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
`

const MainPanel = styled.div`
  flex: 1;
  overflow: auto;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius-lg);
  padding: 12px;
  border: 1px solid var(--ant-color-border);

  .ant-table-row.selected-row {
    background: var(--ant-color-primary-bg);
  }

  .ant-table-row:hover {
    cursor: pointer;
  }
`

const DetailSidebar = styled.div`
  width: 400px;
  overflow: auto;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius-lg);
  padding: 12px;
  border: 1px solid var(--ant-color-border);

  @media (max-width: 1400px) {
    width: 350px;
  }
`

const DetailPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ant-color-border);
`

const InfoGrid = styled.div`
  display: grid;
  gap: 8px;
`

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const CodeBlock = styled.div<{ $error?: boolean }>`
  background: ${(props) => (props.$error ? 'rgba(255, 77, 79, 0.1)' : 'var(--ant-color-bg-container)')};
  border-radius: var(--ant-border-radius);
  padding: 8px;
  overflow: auto;
  max-height: 200px;
  border: 1px solid var(--ant-color-border);

  pre {
    margin: 0;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
    color: ${(props) => (props.$error ? '#ff4d4f' : 'var(--ant-color-text)')};
  }
`

const LogTimeline = styled.div`
  padding: 12px;
  max-height: 500px;
  overflow: auto;
`

const LogItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const LogHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
`

const TaskCard = styled.div<{ $status: string }>`
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius-lg);
  padding: 12px;
  border: 1px solid var(--ant-color-border);
  border-left: 3px solid
    ${(props) =>
      props.$status === 'completed'
        ? '#52c41a'
        : props.$status === 'error' || props.$status === 'timeout'
          ? '#ff4d4f'
          : '#1890ff'};
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const TaskHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const TaskProgress = styled.div`
  height: 4px;
  background: var(--ant-color-bg-container);
  border-radius: 2px;
  margin-bottom: 8px;
  overflow: hidden;

  .bar {
    height: 100%;
    background: #1890ff;
    transition: width 0.3s;
  }
`

export default WorkbenchPanel
