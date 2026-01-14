/**
 * VCP 日志查看器
 *
 * 功能:
 * - 虚拟滚动（支持大量日志）
 * - 语法高亮（参数 JSON 格式化）
 * - 按类型过滤（injection/tool_call/diary_read/diary_write/context/variable）
 * - 按状态过滤（success/failed/pending）
 * - 时间范围过滤
 * - 搜索高亮
 * - 导出 JSON/CSV
 * - 会话切换与回放
 * - 实时滚动/暂停开关
 *
 * 迁移自: pages/settings/VCPToolBoxSettings/VCPLogViewer.tsx
 */

import {
  ApiOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
  SearchOutlined,
  SyncOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Badge, Button, Empty, Input, message, Select, Space, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('VCPLogViewer')

const { Text } = Typography

// ==================== 类型定义 ====================

interface VCPCallInfo {
  id: string
  timestamp: Date | string
  type: 'injection' | 'tool_call' | 'diary_read' | 'diary_write' | 'context' | 'variable'
  name: string
  status: 'pending' | 'success' | 'failed'
  args?: Record<string, unknown>
  result?: unknown
  error?: string
  duration?: number
  metadata?: Record<string, unknown>
}

interface VCPSession {
  id: string
  startTime: Date | string
  endTime?: Date | string
  agentId?: string
  agentName?: string
  calls: VCPCallInfo[]
  injections: string[]
  totalDuration?: number
}

type LogType = VCPCallInfo['type'] | 'all'
type LogStatus = VCPCallInfo['status'] | 'all'

// ==================== 常量 ====================

const LOG_TYPE_CONFIG: Record<
  VCPCallInfo['type'],
  {
    icon: React.ReactNode
    color: string
    bgColor: string
    label: string
  }
> = {
  tool_call: {
    icon: <BugOutlined />,
    color: '#1890ff',
    bgColor: 'rgba(24, 144, 255, 0.1)',
    label: '工具调用'
  },
  injection: {
    icon: <EditOutlined />,
    color: '#722ed1',
    bgColor: 'rgba(114, 46, 209, 0.1)',
    label: '上下文注入'
  },
  diary_read: {
    icon: <ReadOutlined />,
    color: '#13c2c2',
    bgColor: 'rgba(19, 194, 194, 0.1)',
    label: '日记读取'
  },
  diary_write: {
    icon: <FileTextOutlined />,
    color: '#52c41a',
    bgColor: 'rgba(82, 196, 26, 0.1)',
    label: '日记写入'
  },
  context: {
    icon: <SyncOutlined />,
    color: '#faad14',
    bgColor: 'rgba(250, 173, 20, 0.1)',
    label: '上下文'
  },
  variable: {
    icon: <ClockCircleOutlined />,
    color: '#eb2f96',
    bgColor: 'rgba(235, 47, 150, 0.1)',
    label: '变量'
  }
}

const LOG_STATUS_CONFIG: Record<
  VCPCallInfo['status'],
  {
    icon: React.ReactNode
    color: string
    label: string
  }
> = {
  success: {
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    label: '成功'
  },
  failed: {
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    label: '失败'
  },
  pending: {
    icon: <SyncOutlined spin />,
    color: '#1890ff',
    label: '进行中'
  }
}

// ==================== 日志条目组件 ====================

interface LogEntryItemProps {
  log: VCPCallInfo
  searchTerm?: string
  isExpanded: boolean
  onToggle: () => void
}

const LogEntryItem: FC<LogEntryItemProps> = ({ log, searchTerm, isExpanded, onToggle }) => {
  const typeConfig = LOG_TYPE_CONFIG[log.type]
  const statusConfig = LOG_STATUS_CONFIG[log.status]
  const hasDetails = (log.args && Object.keys(log.args).length > 0) || log.result || log.error

  // 解析时间戳
  const timestamp = useMemo(() => {
    if (typeof log.timestamp === 'string') {
      return new Date(log.timestamp)
    }
    return log.timestamp
  }, [log.timestamp])

  // 高亮搜索词
  const highlightText = (text: string): React.ReactNode => {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => (regex.test(part) ? <HighlightSpan key={i}>{part}</HighlightSpan> : part))
  }

  // 复制日志
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const text = JSON.stringify(
        {
          timestamp: timestamp.toISOString(),
          type: log.type,
          name: log.name,
          status: log.status,
          duration: log.duration,
          args: log.args,
          result: log.result,
          error: log.error
        },
        null,
        2
      )
      navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    },
    [log, timestamp]
  )

  // 格式化详情
  const formatDetails = useMemo(() => {
    const details: Record<string, unknown> = {}
    if (log.args) details.args = log.args
    if (log.result) details.result = log.result
    if (log.error) details.error = log.error
    if (log.metadata) details.metadata = log.metadata
    try {
      return JSON.stringify(details, null, 2)
    } catch {
      return String(details)
    }
  }, [log])

  return (
    <LogEntry $type={log.type} $status={log.status} $bgColor={typeConfig.bgColor}>
      <LogEntryHeader onClick={hasDetails ? onToggle : undefined} $hasDetails={!!hasDetails}>
        <LogEntryLeft>
          {/* 展开/折叠图标 */}
          {hasDetails && (
            <ExpandIcon $expanded={isExpanded}>
              <RightOutlined />
            </ExpandIcon>
          )}

          {/* 状态图标 */}
          <StatusIcon $color={statusConfig.color}>{statusConfig.icon}</StatusIcon>

          {/* 时间戳 */}
          <Timestamp>
            {timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </Timestamp>

          {/* 类型标签 */}
          <TypeTag $color={typeConfig.color}>{typeConfig.label}</TypeTag>

          {/* 名称 */}
          <NameText>{highlightText(log.name)}</NameText>

          {/* 耗时 */}
          {log.duration !== undefined && <DurationText>{log.duration}ms</DurationText>}
        </LogEntryLeft>

        <LogEntryRight>
          <Tooltip title="复制">
            <CopyButton onClick={handleCopy}>
              <CopyOutlined />
            </CopyButton>
          </Tooltip>
        </LogEntryRight>
      </LogEntryHeader>

      {/* 详情展开区域 */}
      {isExpanded && hasDetails && (
        <DetailsSection>
          <DetailsCode>{formatDetails}</DetailsCode>
        </DetailsSection>
      )}
    </LogEntry>
  )
}

// ==================== 主组件 ====================

interface Props {
  maxHeight?: number
}

const VCPLogViewer: FC<Props> = ({ maxHeight = 500 }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<LogType>('all')
  const [statusFilter, setStatusFilter] = useState<LogStatus>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [calls, setCalls] = useState<VCPCallInfo[]>([])
  const [sessions, setSessions] = useState<VCPSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('current')
  const [isEnabled, setIsEnabled] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [nativeStatus, setNativeStatus] = useState<{
    isNative: boolean
    version: string
    features: string[]
    status: string
  } | null>(null)

  // 获取初始配置和会话历史
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 获取配置
        const cfg = await window.api.showVcp.getConfig()
        setIsEnabled(cfg?.enabled ?? false)
        setIsReady(true)

        // 获取会话历史
        const history = await window.api.showVcp.getHistory()
        if (history) {
          setSessions(history as VCPSession[])
        }

        // 获取当前会话
        const currentSession = await window.api.showVcp.getCurrentSession()
        if (currentSession?.calls) {
          const parsedCalls = currentSession.calls.map((call) => ({
            ...call,
            timestamp: typeof call.timestamp === 'string' ? new Date(call.timestamp) : call.timestamp
          }))
          setCalls(parsedCalls as VCPCallInfo[])
        }

        // 获取 Native 状态
        try {
          const status = await window.api.vcp.getNativeStatus()
          if (status.success && status.data) {
            setNativeStatus(status.data)
          }
        } catch {
          // Native 状态不可用
        }
      } catch (error) {
        logger.error('Failed to fetch VCP data:', error instanceof Error ? error : new Error(String(error)))
        setIsReady(false)
      }
    }

    fetchInitialData()
  }, [])

  // 监听实时更新
  useEffect(() => {
    if (!isReady) return

    // 订阅调用更新
    const unsubCallUpdate = window.api.showVcp.onCallUpdate((callInfo) => {
      if (selectedSessionId !== 'current') return

      const normalizedInfo: VCPCallInfo = {
        ...callInfo,
        type: callInfo.type as VCPCallInfo['type'],
        timestamp: typeof callInfo.timestamp === 'string' ? new Date(callInfo.timestamp) : new Date()
      }

      setCalls((prev) => {
        const existingIndex = prev.findIndex((c) => c.id === normalizedInfo.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = normalizedInfo
          return updated
        }
        return [...prev, normalizedInfo].slice(-200) // 保留最近 200 条
      })
    })

    // 订阅配置变更
    const unsubConfigChange = window.api.showVcp.onConfigChanged((config) => {
      setIsEnabled(config.enabled)
    })

    return () => {
      unsubCallUpdate()
      unsubConfigChange()
    }
  }, [isReady, selectedSessionId])

  // 切换会话
  useEffect(() => {
    const loadSession = async () => {
      if (selectedSessionId === 'current') {
        const currentSession = await window.api.showVcp.getCurrentSession()
        if (currentSession?.calls) {
          const parsedCalls = currentSession.calls.map((call) => ({
            ...call,
            timestamp: typeof call.timestamp === 'string' ? new Date(call.timestamp) : call.timestamp
          }))
          setCalls(parsedCalls as VCPCallInfo[])
        } else {
          setCalls([])
        }
      } else {
        const session = sessions.find((s) => s.id === selectedSessionId)
        if (session?.calls) {
          const parsedCalls = session.calls.map((call) => ({
            ...call,
            timestamp: typeof call.timestamp === 'string' ? new Date(call.timestamp) : call.timestamp
          }))
          setCalls(parsedCalls as VCPCallInfo[])
        }
      }
    }

    loadSession()
  }, [selectedSessionId, sessions])

  // 过滤日志
  const filteredLogs = useMemo(() => {
    return calls.filter((log) => {
      // 类型过滤
      if (typeFilter !== 'all' && log.type !== typeFilter) return false

      // 状态过滤
      if (statusFilter !== 'all' && log.status !== statusFilter) return false

      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          log.name.toLowerCase().includes(searchLower) ||
          log.type.toLowerCase().includes(searchLower) ||
          (log.args && JSON.stringify(log.args).toLowerCase().includes(searchLower)) ||
          (log.error && log.error.toLowerCase().includes(searchLower))
        )
      }

      return true
    })
  }, [calls, typeFilter, statusFilter, searchTerm])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current && selectedSessionId === 'current') {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredLogs.length, autoScroll, selectedSessionId])

  // 处理滚动
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
    }
  }, [])

  // 切换展开状态
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 全部展开/折叠
  const toggleAll = useCallback(() => {
    if (expandedIds.size > 0) {
      setExpandedIds(new Set())
    } else {
      const allIds = filteredLogs.filter((log) => log.args || log.result || log.error).map((log) => log.id)
      setExpandedIds(new Set(allIds))
    }
  }, [expandedIds.size, filteredLogs])

  // 清空历史
  const handleClear = useCallback(async () => {
    try {
      await window.api.showVcp.clearHistory()
      setCalls([])
      setSessions([])
      message.success('已清空日志历史')
    } catch (error) {
      logger.error('Failed to clear history:', error instanceof Error ? error : new Error(String(error)))
      message.error('清空失败')
    }
  }, [])

  // 导出 JSON
  const handleExportJSON = useCallback(() => {
    const data = {
      exportTime: new Date().toISOString(),
      sessionId: selectedSessionId,
      totalLogs: filteredLogs.length,
      logs: filteredLogs.map((log) => ({
        ...log,
        timestamp: typeof log.timestamp === 'string' ? log.timestamp : (log.timestamp as Date).toISOString()
      }))
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vcp-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出 JSON 文件')
  }, [filteredLogs, selectedSessionId])

  // 导出 CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['时间', '类型', '名称', '状态', '耗时(ms)', '错误']
    const rows = filteredLogs.map((log) => {
      const ts = typeof log.timestamp === 'string' ? log.timestamp : (log.timestamp as Date).toISOString()
      return [ts, log.type, log.name, log.status, log.duration ?? '', log.error ?? ''].map((v) => `"${v}"`)
    })
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vcp-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出 CSV 文件')
  }, [filteredLogs])

  // 统计各类型数量
  const typeCounts = useMemo(() => {
    const counts: Record<VCPCallInfo['type'], number> = {
      tool_call: 0,
      injection: 0,
      diary_read: 0,
      diary_write: 0,
      context: 0,
      variable: 0
    }
    calls.forEach((log) => {
      counts[log.type]++
    })
    return counts
  }, [calls])

  // 统计各状态数量
  const statusCounts = useMemo(() => {
    const counts = { success: 0, failed: 0, pending: 0 }
    calls.forEach((log) => {
      counts[log.status]++
    })
    return counts
  }, [calls])

  // 会话选项
  const sessionOptions = useMemo(() => {
    const options = [{ value: 'current', label: '当前会话' }]
    sessions.forEach((session) => {
      const startTime =
        typeof session.startTime === 'string' ? new Date(session.startTime) : (session.startTime as Date)
      options.push({
        value: session.id,
        label: `${session.agentName || '未知 Agent'} - ${startTime.toLocaleString('zh-CN')}`
      })
    })
    return options
  }, [sessions])

  if (!isReady) {
    return (
      <EmptyWrapper>
        <Empty description="ShowVCP 服务未就绪" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </EmptyWrapper>
    )
  }

  return (
    <Container>
      {/* 工具栏 */}
      <Toolbar>
        <ToolbarLeft>
          {/* 会话选择 */}
          <Select
            value={selectedSessionId}
            onChange={setSelectedSessionId}
            size="small"
            style={{ width: 200 }}
            options={sessionOptions}
          />

          {/* 搜索 */}
          <Input
            placeholder="搜索日志..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            size="small"
            style={{ width: 160 }}
          />

          {/* 类型过滤 */}
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            size="small"
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(LOG_TYPE_CONFIG).map(([key, config]) => ({
                value: key,
                label: (
                  <Space>
                    {config.icon}
                    {config.label}
                  </Space>
                )
              }))
            ]}
          />

          {/* 状态过滤 */}
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            size="small"
            style={{ width: 100 }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(LOG_STATUS_CONFIG).map(([key, config]) => ({
                value: key,
                label: (
                  <Space>
                    {config.icon}
                    {config.label}
                  </Space>
                )
              }))
            ]}
          />
        </ToolbarLeft>

        <ToolbarRight>
          {/* Native 状态指示器 */}
          {nativeStatus && (
            <Tooltip
              title={
                <div>
                  <div>{nativeStatus.isNative ? 'Rust Native' : 'TypeScript Fallback'}</div>
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

          {/* 状态统计 */}
          <StatsContainer>
            {statusCounts.failed > 0 && <Badge count={statusCounts.failed} color={LOG_STATUS_CONFIG.failed.color} />}
            {statusCounts.pending > 0 && <Badge count={statusCounts.pending} color={LOG_STATUS_CONFIG.pending.color} />}
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {filteredLogs.length} 条
            </Text>
          </StatsContainer>

          {/* 展开/折叠全部 */}
          <Tooltip title={expandedIds.size > 0 ? '折叠全部' : '展开全部'}>
            <Button
              type="text"
              size="small"
              icon={expandedIds.size > 0 ? <DownOutlined /> : <RightOutlined />}
              onClick={toggleAll}
            />
          </Tooltip>

          {/* 自动滚动 */}
          {selectedSessionId === 'current' && (
            <Tooltip title={autoScroll ? '暂停滚动' : '跟随滚动'}>
              <Button
                type="text"
                size="small"
                icon={autoScroll ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => setAutoScroll(!autoScroll)}
              />
            </Tooltip>
          )}

          {/* 滚动到底部 */}
          <Tooltip title="滚动到底部">
            <Button type="text" size="small" icon={<VerticalAlignBottomOutlined />} onClick={scrollToBottom} />
          </Tooltip>

          {/* 导出 */}
          <Tooltip title="导出 JSON">
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleExportJSON} />
          </Tooltip>

          <Tooltip title="导出 CSV">
            <Button type="text" size="small" icon={<FileExcelOutlined />} onClick={handleExportCSV} />
          </Tooltip>

          {/* 清除 */}
          <Tooltip title="清空历史">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={handleClear} />
          </Tooltip>
        </ToolbarRight>
      </Toolbar>

      {/* 类型统计栏 */}
      <TypeStatsBar>
        {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
          <TypeStatItem
            key={type}
            $active={typeFilter === type}
            onClick={() => setTypeFilter(typeFilter === type ? 'all' : (type as LogType))}>
            <span style={{ color: config.color }}>{config.icon}</span>
            <span>{config.label}</span>
            <Badge count={typeCounts[type as VCPCallInfo['type']]} showZero size="small" />
          </TypeStatItem>
        ))}
      </TypeStatsBar>

      {/* 日志列表 */}
      <LogContainer ref={containerRef} $maxHeight={maxHeight} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <EmptyWrapper>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                  ? '无匹配日志'
                  : isEnabled
                    ? '等待 VCP 调用...'
                    : '请先启用 ShowVCP 调试'
              }
            />
          </EmptyWrapper>
        ) : (
          filteredLogs.map((log) => (
            <LogEntryItem
              key={log.id}
              log={log}
              searchTerm={searchTerm}
              isExpanded={expandedIds.has(log.id)}
              onToggle={() => toggleExpanded(log.id)}
            />
          ))
        )}
      </LogContainer>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-radius: var(--ant-border-radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
`

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
  flex-wrap: wrap;
  gap: 8px;
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const StatsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
`

const NativeIndicator = styled.div<{ $isNative: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: ${({ $isNative }) => ($isNative ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)')};
  color: ${({ $isNative }) => ($isNative ? '#52c41a' : '#faad14')};
  cursor: help;
  margin-right: 8px;
`

const TypeStatsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-mute);
  overflow-x: auto;
`

const TypeStatItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  background: ${(props) => (props.$active ? 'var(--color-primary-light)' : 'transparent')};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-soft);
  }
`

const LogContainer = styled.div<{ $maxHeight: number }>`
  flex: 1;
  max-height: ${(props) => props.$maxHeight}px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
`

const EmptyWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
`

const LogEntry = styled.div<{ $type: string; $status: string; $bgColor: string }>`
  border-bottom: 1px solid var(--color-border-soft);

  &:hover {
    background: ${(props) => props.$bgColor};
  }

  &:last-child {
    border-bottom: none;
  }
`

const LogEntryHeader = styled.div<{ $hasDetails: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 12px;
  cursor: ${(props) => (props.$hasDetails ? 'pointer' : 'default')};
`

const LogEntryLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`

const LogEntryRight = styled.div`
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;

  ${LogEntry}:hover & {
    opacity: 1;
  }
`

const ExpandIcon = styled.span<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  width: 14px;
  font-size: 10px;
  color: var(--color-text-3);
  transition: transform 0.2s;
  transform: ${(props) => (props.$expanded ? 'rotate(90deg)' : 'none')};
`

const StatusIcon = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  color: ${(props) => props.$color};
  flex-shrink: 0;
  font-size: 12px;
`

const Timestamp = styled.span`
  color: var(--color-text-3);
  flex-shrink: 0;
  font-size: 11px;
`

const TypeTag = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: ${(props) => props.$color}20;
  color: ${(props) => props.$color};
  flex-shrink: 0;
`

const NameText = styled.span`
  color: var(--color-text);
  word-break: break-word;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const DurationText = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  flex-shrink: 0;
`

const HighlightSpan = styled.span`
  background: #fff3b0;
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
`

const CopyButton = styled.span`
  display: flex;
  align-items: center;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-3);
  transition: color 0.2s;

  &:hover {
    color: var(--color-primary);
  }
`

const DetailsSection = styled.div`
  padding: 8px 12px 12px 38px;
  background: var(--color-background-soft);
`

const DetailsCode = styled.pre`
  margin: 0;
  padding: 8px;
  background: var(--color-background);
  border-radius: var(--ant-border-radius);
  border: 1px solid var(--color-border);
  font-size: 11px;
  overflow-x: auto;
  max-height: 200px;
  color: var(--color-text);
`

export default VCPLogViewer
