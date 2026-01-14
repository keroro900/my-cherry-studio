/**
 * ProLogViewer - 专业日志查看器
 *
 * 提供类似 Claude Code 的专业日志可视化：
 * - 语法高亮
 * - 可折叠条目
 * - 虚拟滚动
 * - 日志级别颜色编码
 * - 搜索高亮
 * - 实时滚动
 */

import {
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RightOutlined,
  SearchOutlined,
  VerticalAlignBottomOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { Badge, Button, Empty, Input, message, Select, Space, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { CrewLogEntry } from '../hooks/useCrewEvents'

const { Text } = Typography

// ==================== 类型定义 ====================

interface Props {
  logs: CrewLogEntry[]
  maxHeight?: number
  showFilters?: boolean
  showSearch?: boolean
  onClear?: () => void
}

type LogLevel = CrewLogEntry['level']

// ==================== 常量 ====================

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  {
    icon: React.ReactNode
    color: string
    bgColor: string
    label: string
  }
> = {
  success: {
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    bgColor: 'rgba(82, 196, 26, 0.1)',
    label: '成功'
  },
  error: {
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: 'rgba(255, 77, 79, 0.1)',
    label: '错误'
  },
  warning: {
    icon: <WarningOutlined />,
    color: '#faad14',
    bgColor: 'rgba(250, 173, 20, 0.1)',
    label: '警告'
  },
  info: {
    icon: <InfoCircleOutlined />,
    color: '#1890ff',
    bgColor: 'rgba(24, 144, 255, 0.1)',
    label: '信息'
  },
  debug: {
    icon: <BugOutlined />,
    color: '#8c8c8c',
    bgColor: 'rgba(140, 140, 140, 0.1)',
    label: '调试'
  }
}

// ==================== 日志条目组件 ====================

interface LogEntryItemProps {
  log: CrewLogEntry
  searchTerm?: string
  isExpanded: boolean
  onToggle: () => void
}

const LogEntryItem: FC<LogEntryItemProps> = ({ log, searchTerm, isExpanded, onToggle }) => {
  const config = LOG_LEVEL_CONFIG[log.level]
  const hasDetails = log.details && Object.keys(log.details).length > 0

  // 高亮搜索词
  const highlightText = (text: string): React.ReactNode => {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => (regex.test(part) ? <HighlightSpan key={i}>{part}</HighlightSpan> : part))
  }

  // 复制日志
  const handleCopy = useCallback(() => {
    const text = JSON.stringify(
      {
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        source: log.source,
        message: log.message,
        details: log.details
      },
      null,
      2
    )
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  }, [log])

  // 格式化 JSON
  const formatDetails = useMemo(() => {
    if (!log.details) return ''
    try {
      return JSON.stringify(log.details, null, 2)
    } catch {
      return String(log.details)
    }
  }, [log.details])

  return (
    <LogEntry $level={log.level} $bgColor={config.bgColor}>
      <LogEntryHeader onClick={hasDetails ? onToggle : undefined}>
        <LogEntryLeft>
          {/* 展开/折叠图标 */}
          {hasDetails && (
            <ExpandIcon $expanded={isExpanded}>
              <RightOutlined />
            </ExpandIcon>
          )}

          {/* 级别图标 */}
          <LevelIcon $color={config.color}>{config.icon}</LevelIcon>

          {/* 时间戳 */}
          <Timestamp>
            {log.timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 3
            })}
          </Timestamp>

          {/* 来源标签 */}
          <SourceTag $level={log.level}>{log.source}</SourceTag>

          {/* 消息内容 */}
          <MessageText>{highlightText(log.message)}</MessageText>
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

const ProLogViewer: FC<Props> = ({ logs, maxHeight = 400, showFilters = true, showSearch = true, onClear }) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 过滤日志
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 级别过滤
      if (levelFilter !== 'all' && log.level !== levelFilter) return false

      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.source.toLowerCase().includes(searchLower) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
        )
      }

      return true
    })
  }, [logs, levelFilter, searchTerm])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredLogs.length, autoScroll])

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
      const allIds = filteredLogs
        .filter((log) => log.details && Object.keys(log.details).length > 0)
        .map((log) => log.id)
      setExpandedIds(new Set(allIds))
    }
  }, [expandedIds.size, filteredLogs])

  // 统计各级别数量
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = {
      success: 0,
      error: 0,
      warning: 0,
      info: 0,
      debug: 0
    }
    logs.forEach((log) => {
      counts[log.level]++
    })
    return counts
  }, [logs])

  return (
    <Container>
      {/* 工具栏 */}
      <Toolbar>
        <ToolbarLeft>
          {/* 搜索 */}
          {showSearch && (
            <Input
              placeholder={t('crew.log.search', '搜索日志...')}
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="small"
              style={{ width: 200 }}
            />
          )}

          {/* 级别过滤 */}
          {showFilters && (
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              size="small"
              style={{ width: 100 }}
              options={[
                { value: 'all', label: '全部' },
                ...Object.entries(LOG_LEVEL_CONFIG).map(([key, config]) => ({
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
          )}

          {/* 级别统计 */}
          <LevelStats>
            {levelCounts.error > 0 && <Badge count={levelCounts.error} color={LOG_LEVEL_CONFIG.error.color} />}
            {levelCounts.warning > 0 && <Badge count={levelCounts.warning} color={LOG_LEVEL_CONFIG.warning.color} />}
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {filteredLogs.length} 条
            </Text>
          </LevelStats>
        </ToolbarLeft>

        <ToolbarRight>
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
          <Tooltip title={autoScroll ? '暂停滚动' : '跟随滚动'}>
            <Button
              type="text"
              size="small"
              icon={autoScroll ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => setAutoScroll(!autoScroll)}
            />
          </Tooltip>

          {/* 滚动到底部 */}
          <Tooltip title="滚动到底部">
            <Button type="text" size="small" icon={<VerticalAlignBottomOutlined />} onClick={scrollToBottom} />
          </Tooltip>

          {/* 清除 */}
          {onClear && (
            <Button type="text" size="small" danger onClick={onClear}>
              清除
            </Button>
          )}
        </ToolbarRight>
      </Toolbar>

      {/* 日志列表 */}
      <LogContainer ref={containerRef} $maxHeight={maxHeight} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <EmptyWrapper>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searchTerm ? '无匹配日志' : '暂无日志'} />
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
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius-lg);
  border: 1px solid var(--ant-color-border);
  overflow: hidden;
`

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const LevelStats = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const LogEntry = styled.div<{ $level: LogLevel; $bgColor: string }>`
  border-bottom: 1px solid var(--ant-color-border-secondary);

  &:hover {
    background: ${(props) => props.$bgColor};
  }

  &:last-child {
    border-bottom: none;
  }
`

const LogEntryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 12px;
  cursor: pointer;
`

const LogEntryLeft = styled.div`
  display: flex;
  align-items: flex-start;
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
  width: 16px;
  font-size: 10px;
  color: var(--ant-color-text-tertiary);
  transition: transform 0.2s;
  transform: ${(props) => (props.$expanded ? 'rotate(90deg)' : 'none')};
`

const LevelIcon = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  color: ${(props) => props.$color};
  flex-shrink: 0;
`

const Timestamp = styled.span`
  color: var(--ant-color-text-tertiary);
  flex-shrink: 0;
  font-size: 11px;
`

const SourceTag = styled.span<{ $level: LogLevel }>`
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  background: var(--ant-color-bg-elevated);
  color: var(--ant-color-text-secondary);
  flex-shrink: 0;
`

const MessageText = styled.span`
  color: var(--ant-color-text);
  word-break: break-word;
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
  color: var(--ant-color-text-tertiary);
  transition: color 0.2s;

  &:hover {
    color: var(--ant-color-primary);
  }
`

const DetailsSection = styled.div`
  padding: 8px 12px 12px 42px;
  background: var(--ant-color-bg-elevated);
`

const DetailsCode = styled.pre`
  margin: 0;
  padding: 8px;
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius);
  font-size: 11px;
  overflow-x: auto;
  max-height: 200px;
  color: var(--ant-color-text);
`

export default ProLogViewer
