/**
 * VCP 调试面板
 *
 * 功能:
 * - 悬浮面板显示 VCP 调用历史
 * - 实时更新 (通过 IPC 监听)
 * - 展开/折叠调用详情
 * - 开关控制 ShowVCP 启用状态
 * - 复制/导出日志
 * - Native 模块状态显示
 */

import {
  ApiOutlined,
  BugOutlined,
  ClearOutlined,
  CopyOutlined,
  DownOutlined,
  RocketOutlined,
  UpOutlined
} from '@ant-design/icons'
import { Badge, Button, Space, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

// ==================== 类型定义 ====================

interface VCPCallInfo {
  id: string
  timestamp: Date
  type: 'injection' | 'tool_call' | 'diary_read' | 'diary_write' | 'context' | 'variable'
  name: string
  status: 'pending' | 'success' | 'failed'
  args?: Record<string, unknown>
  result?: unknown
  error?: string
  duration?: number
}

interface ShowVCPConfig {
  enabled: boolean
  logLevel?: string
  maxHistory?: number
}

interface NativeStatus {
  isNative: boolean
  version: string
  features: string[]
  status: string
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div<{ $isExpanded: boolean }>`
  position: fixed;
  bottom: 60px;
  left: 20px;
  width: ${({ $isExpanded }) => ($isExpanded ? '320px' : '120px')};
  max-height: ${({ $isExpanded }) => ($isExpanded ? '400px' : '36px')};
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 999;
  transition: all 0.2s ease;
  overflow: hidden;
  opacity: 0.9;

  &:hover {
    opacity: 1;
  }
`

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-mute);
  cursor: pointer;
  user-select: none;

  .header-icon {
    color: var(--color-primary);
    font-size: 14px;
  }

  .header-title {
    font-size: 12px;
    font-weight: 500;
    flex: 1;
    color: var(--color-text);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
`

const CallsContainer = styled.div`
  max-height: 380px;
  overflow-y: auto;
  padding: 4px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
`

const CallItem = styled.div<{ $status: string }>`
  padding: 6px 12px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--color-border-soft);
  background: ${({ $status }) =>
    $status === 'success'
      ? 'rgba(82, 196, 26, 0.08)'
      : $status === 'failed'
        ? 'rgba(255, 77, 79, 0.08)'
        : 'rgba(24, 144, 255, 0.08)'};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ $status }) =>
      $status === 'success'
        ? 'rgba(82, 196, 26, 0.15)'
        : $status === 'failed'
          ? 'rgba(255, 77, 79, 0.15)'
          : 'rgba(24, 144, 255, 0.15)'};
  }
`

const StatusDot = styled.span<{ $status: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $status }) => ($status === 'success' ? '#52c41a' : $status === 'failed' ? '#ff4d4f' : '#1890ff')};
  flex-shrink: 0;
`

const CallType = styled.span`
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--color-background-mute);
  color: var(--color-text-2);
  flex-shrink: 0;
`

const CallName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
`

const CallDuration = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  flex-shrink: 0;
`

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
`

const CallCount = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-primary);
  color: white;
  margin-left: 4px;
`

const NativeStatusBar = styled.div<{ $isNative: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 11px;
  background: ${({ $isNative }) => ($isNative ? 'rgba(82, 196, 26, 0.1)' : 'rgba(250, 173, 20, 0.1)')};
  border-bottom: 1px solid var(--color-border);
`

// ==================== 组件实现 ====================

export const VCPDebugPanel: FC = () => {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [calls, setCalls] = useState<VCPCallInfo[]>([])
  const [_config, setConfig] = useState<ShowVCPConfig | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | null>(null)

  // 获取初始配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const cfg = await window.api.showVcp.getConfig()
        setConfig(cfg)
        setIsEnabled(cfg?.enabled ?? false)
        setIsReady(true)

        // 获取 Native 状态
        const status = await window.api.vcp.getNativeStatus()
        if (status.success && status.data) {
          setNativeStatus(status.data)
        }
      } catch {
        // ShowVCP 服务未就绪，隐藏面板
        setIsReady(false)
      }
    }

    fetchConfig()
  }, [])

  // 监听实时更新
  useEffect(() => {
    if (!isEnabled || !isReady) return

    // 订阅调用更新
    const unsubCallUpdate = window.api.showVcp.onCallUpdate((callInfo) => {
      // 确保 timestamp 是 Date 对象
      const normalizedInfo: VCPCallInfo = {
        ...callInfo,
        type: callInfo.type as VCPCallInfo['type'],
        timestamp: typeof callInfo.timestamp === 'string' ? new Date(callInfo.timestamp) : new Date()
      }

      setCalls((prev) => {
        // 更新已存在的调用或添加新调用
        const existingIndex = prev.findIndex((c) => c.id === normalizedInfo.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = normalizedInfo
          return updated
        }
        // 保留最近 50 条
        return [...prev, normalizedInfo].slice(-50)
      })
    })

    // 获取当前会话
    window.api.showVcp
      .getCurrentSession()
      .then((session) => {
        if (session?.calls) {
          // 解析 ISO 字符串为 Date 对象
          const parsedCalls = session.calls.map((call) => ({
            ...call,
            type: call.type as VCPCallInfo['type'],
            timestamp: typeof call.timestamp === 'string' ? new Date(call.timestamp) : new Date()
          }))
          setCalls(parsedCalls as VCPCallInfo[])
        }
      })
      .catch(() => {
        // 忽略错误
      })

    return () => {
      unsubCallUpdate()
    }
  }, [isEnabled, isReady])

  // 复制日志
  const handleCopyLog = useCallback(() => {
    const logText = calls
      .map((c) => {
        const status = c.status === 'success' ? '✓' : c.status === 'failed' ? '✗' : '⋯'
        const duration = c.duration ? `(${c.duration}ms)` : ''
        return `[${status}] ${c.type}::${c.name} ${duration}`
      })
      .join('\n')

    navigator.clipboard.writeText(logText)
  }, [calls])

  // 清空历史
  const handleClear = useCallback(async () => {
    try {
      await window.api.showVcp.clearHistory()
      setCalls([])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }, [])

  // 切换展开/折叠
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // 阻止冒泡
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // 如果服务未就绪或未启用，不显示面板
  if (!isReady || !isEnabled) {
    return null
  }

  return (
    <PanelContainer $isExpanded={isExpanded}>
      <PanelHeader onClick={handleToggleExpand}>
        <BugOutlined className="header-icon" />
        <span className="header-title">
          ShowVCP
          {calls.length > 0 && <CallCount>{calls.length}</CallCount>}
        </span>
        <div className="header-actions" onClick={stopPropagation}>
          {/* Native 状态指示器 */}
          <Tooltip
            title={
              nativeStatus
                ? `${nativeStatus.isNative ? 'Rust Native' : 'TypeScript Fallback'} v${nativeStatus.version}`
                : 'Loading...'
            }>
            {nativeStatus?.isNative ? (
              <RocketOutlined style={{ fontSize: 12, color: '#52c41a' }} />
            ) : (
              <ApiOutlined style={{ fontSize: 12, color: '#faad14' }} />
            )}
          </Tooltip>
          {isExpanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </div>
      </PanelHeader>

      {isExpanded && (
        <>
          {/* Native 状态区域 */}
          {nativeStatus && (
            <NativeStatusBar $isNative={nativeStatus.isNative}>
              <Space size={4}>
                {nativeStatus.isNative ? (
                  <RocketOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ApiOutlined style={{ color: '#faad14' }} />
                )}
                <span>{nativeStatus.isNative ? 'Rust' : 'Fallback'}</span>
                <span style={{ opacity: 0.7 }}>v{nativeStatus.version}</span>
              </Space>
              <Badge
                status={nativeStatus.status === 'healthy' ? 'success' : 'warning'}
                text={nativeStatus.status}
              />
            </NativeStatusBar>
          )}

          {calls.length > 0 && (
            <div style={{ padding: '4px 8px', display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
              <Tooltip title="复制日志">
                <Button size="small" icon={<CopyOutlined />} onClick={handleCopyLog} />
              </Tooltip>
              <Tooltip title="清空历史">
                <Button size="small" icon={<ClearOutlined />} onClick={handleClear} />
              </Tooltip>
            </div>
          )}

          <CallsContainer>
            {calls.length === 0 ? (
              <EmptyState>{isEnabled ? '等待 VCP 调用...' : '开启 ShowVCP 开始调试'}</EmptyState>
            ) : (
              calls.map((call) => (
                <Tooltip
                  key={call.id}
                  title={
                    <div>
                      <div>类型: {call.type}</div>
                      <div>名称: {call.name}</div>
                      <div>状态: {call.status}</div>
                      {call.duration && <div>耗时: {call.duration}ms</div>}
                      {call.error && <div style={{ color: '#ff4d4f' }}>错误: {call.error}</div>}
                      {call.args && (
                        <div>
                          参数:{' '}
                          <pre style={{ fontSize: 10, margin: 0 }}>
                            {JSON.stringify(call.args, null, 2).substring(0, 200)}
                          </pre>
                        </div>
                      )}
                    </div>
                  }
                  placement="left">
                  <CallItem $status={call.status}>
                    <StatusDot $status={call.status} />
                    <CallType>{call.type}</CallType>
                    <CallName>{call.name}</CallName>
                    {call.duration && <CallDuration>{call.duration}ms</CallDuration>}
                  </CallItem>
                </Tooltip>
              ))
            )}
          </CallsContainer>
        </>
      )}
    </PanelContainer>
  )
}

export default VCPDebugPanel
