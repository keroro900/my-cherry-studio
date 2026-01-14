/**
 * VCP 全链路追踪面板
 *
 * 提供实时任务追踪、日志查看、性能监控
 *
 * 功能：
 * - 实时 Trace/Span 可视化
 * - 日志流展示
 * - 性能指标监控
 * - Native 模块状态
 * - Native VCP 模块详细信息 (CooccurrenceMatrix, SemanticGroupMatcher, ChineseSearchEngine)
 */

import {
  ApiOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
  TagsOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Switch,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography
} from 'antd'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 导入工作台组件
import { VCPLogViewer } from '@renderer/components/VCP'

const logger = loggerService.withContext('TracingPanel')

const { Title, Text, Paragraph } = Typography

// ==================== 类型定义 ====================

interface TraceInfo {
  traceId: string
  operation: string
  status: 'running' | 'completed' | 'failed'
  startTime: string
  endTime?: string
  durationMs?: number
  spans: SpanInfo[]
}

interface SpanInfo {
  spanId: string
  parentSpanId?: string
  operation: string
  startTime: string
  endTime?: string
  durationMs?: number
  status: string
  metadata?: string
}

interface NativeStatus {
  isNative: boolean
  version: string
  features: string[]
  status: string
}

interface DatabaseStats {
  memoryCount: number
  knowledgeCount: number
  diaryCount: number
  tagCount: number
  traceCount: number
  fileSizeBytes: number
}

interface MemoryCallRecord {
  id: string
  timestamp: string
  caller: string
  method: string
  params: Record<string, unknown>
  result?: {
    success: boolean
    count?: number
    error?: string
  }
  durationMs: number
  backend?: string
  vectorInfo?: {
    dimension?: number
    count?: number
    location?: string
    similarity?: number
  }
  metadata?: Record<string, unknown>
}

interface MemoryTraceStats {
  totalCalls: number
  totalDurationMs: number
  callsByMethod: Record<string, number>
  callsByBackend: Record<string, number>
  averageDurationMs: number
  errorCount: number
}

interface VectorStorageInfo {
  backend: string
  location: string
  dimension: number
  documentCount: number
}

interface TagMemoStats {
  tagCount: number
  pairCount: number
  totalUpdates: number
  alpha: number
  beta: number
}

interface WaveRAGStats {
  // 基础统计 (从 native module 返回)
  tagCount: number
  pairCount: number
  totalUpdates: number
  cooccurrenceTags: number
  // 扩展统计 (可选，未来扩展)
  searchCount?: number
  avgLensDurationMs?: number
  avgExpansionDurationMs?: number
  avgFocusDurationMs?: number
  avgTotalDurationMs?: number
  avgResultCount?: number
  tagBoostRate?: number
}

interface NativeModuleDetails {
  isNative: boolean
  version: string
  features: string[]
  status: string
  tagMemoStats?: TagMemoStats
  waveragStats?: WaveRAGStats
  searchStats?: {
    documentCount: number
  }
  memoryTracingEnabled: boolean
}

interface StoragePathInfo {
  name: string
  path: string
  type: 'directory' | 'file'
  size: number
  itemCount: number
  exists: boolean
}

interface StorageBrowseItem {
  name: string
  path: string
  type: 'directory' | 'file'
  size: number
  modifiedAt: string
}

// ==================== 组件 ====================

const TracingPanel: FC = () => {
  const { t } = useTranslation()

  // 状态
  const [loading, setLoading] = useState(false)
  const [traces, setTraces] = useState<TraceInfo[]>([])
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | null>(null)
  const [nativeDetails, setNativeDetails] = useState<NativeModuleDetails | null>(null)
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null)

  // 记忆追踪状态
  const [memoryTraces, setMemoryTraces] = useState<MemoryCallRecord[]>([])
  const [memoryStats, setMemoryStats] = useState<MemoryTraceStats | null>(null)
  const [vectorStorage, setVectorStorage] = useState<VectorStorageInfo[]>([])
  const [activeTab, setActiveTab] = useState<'traces' | 'memory' | 'native' | 'logs' | 'storage'>('traces')
  const [memoryTracingEnabled, setMemoryTracingEnabled] = useState(true)

  // ShowVCP 状态 (控制 VCPDebugPanel 显示)
  const [showVCPEnabled, setShowVCPEnabled] = useState(false)

  // 存储路径状态
  const [storagePaths, setStoragePaths] = useState<StoragePathInfo[]>([])
  const [browseItems, setBrowseItems] = useState<StorageBrowseItem[]>([])
  const [browsePath, setBrowsePath] = useState<string[]>([]) // 路径面包屑
  const [storageLoading, setStorageLoading] = useState(false)

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 获取 Native 状态
      const status = await window.api.vcp.getNativeStatus()
      if (status.success && status.data) {
        setNativeStatus(status.data)

        // 如果是 Native 模式，获取更多详情
        if (status.data.isNative) {
          const details: NativeModuleDetails = {
            ...status.data,
            memoryTracingEnabled: true
          }

          // 获取 TagMemo 统计
          try {
            const tagMemoStats = await window.api.vcp.tagmemo.getStats()
            if (tagMemoStats.success && tagMemoStats.data) {
              details.tagMemoStats = tagMemoStats.data
            }
          } catch {
            // TagMemo 可能未初始化
          }

          // 获取 WaveRAG 统计 (使用 TagMemo 统计作为代替)
          try {
            const waveragStats = await window.electron.ipcRenderer.invoke('vcp:native:tagmemo:stats')
            if (waveragStats?.success && waveragStats?.data) {
              details.waveragStats = waveragStats.data
            }
          } catch {
            // WaveRAG 可能未初始化
          }

          // 获取追踪启用状态
          try {
            const tracingEnabled = await window.api.vcp.isMemoryTracingEnabled()
            if (tracingEnabled.success) {
              details.memoryTracingEnabled = tracingEnabled.data ?? true
              setMemoryTracingEnabled(tracingEnabled.data ?? true)
            }
          } catch {
            // Ignore
          }

          setNativeDetails(details)
        }
      }

      // 获取数据库统计
      const stats = await window.api.vcp.getDatabaseStats()
      if (stats.success && stats.data) {
        setDbStats(stats.data)
      }

      // 获取最近的 Traces
      const tracesResult = await window.api.vcp.getRecentTraces()
      if (tracesResult.success) {
        setTraces(tracesResult.data || [])
      }

      // 获取记忆调用追踪
      const memoryTracesResult = await window.api.vcp.getMemoryTraces()
      if (memoryTracesResult.success) {
        setMemoryTraces(memoryTracesResult.data || [])
      }

      // 获取记忆追踪统计
      const memoryStatsResult = await window.api.vcp.getMemoryStats()
      if (memoryStatsResult.success && memoryStatsResult.data) {
        setMemoryStats(memoryStatsResult.data)
      }

      // 获取向量存储信息
      const vectorStorageResult = await window.api.vcp.getVectorStorage()
      if (vectorStorageResult.success) {
        setVectorStorage(vectorStorageResult.data || [])
      }

      // 获取 ShowVCP 配置
      try {
        const showVCPConfig = await window.api.showVcp.getConfig()
        setShowVCPEnabled(showVCPConfig?.enabled ?? false)
      } catch {
        // ShowVCP 服务未就绪
      }
    } catch (error) {
      logger.error('Failed to load tracing data', { error })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // 定时刷新
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  // 切换记忆追踪开关
  const handleToggleMemoryTracing = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.api.vcp.setMemoryTracingEnabled(enabled)
      if (result.success) {
        setMemoryTracingEnabled(enabled)
        logger.info('Memory tracing toggled', { enabled })
      }
    } catch (error) {
      logger.error('Failed to toggle memory tracing', { error })
    }
  }, [])

  // 切换 ShowVCP 开关 (控制悬浮调试面板)
  const handleToggleShowVCP = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.api.showVcp.updateConfig({ enabled })
      if (result.success) {
        setShowVCPEnabled(enabled)
        logger.info('ShowVCP toggled', { enabled })
      }
    } catch (error) {
      logger.error('Failed to toggle ShowVCP', { error })
    }
  }, [])

  // 加载存储路径信息
  const loadStoragePaths = useCallback(async () => {
    setStorageLoading(true)
    try {
      const result = await window.api.vcp.getStoragePaths()
      if (result.success && result.data) {
        setStoragePaths(result.data)
      }
    } catch (error) {
      logger.error('Failed to load storage paths', { error })
    } finally {
      setStorageLoading(false)
    }
  }, [])

  // 浏览存储目录
  const browseStorageDir = useCallback(async (dirPath: string, dirName: string) => {
    setStorageLoading(true)
    try {
      const result = await window.api.vcp.browseStorage(dirPath)
      if (result.success && result.data) {
        setBrowseItems(result.data)
        setBrowsePath((prev) => [...prev, dirName])
      }
    } catch (error) {
      logger.error('Failed to browse storage', { error, dirPath })
    } finally {
      setStorageLoading(false)
    }
  }, [])

  // 返回上级目录
  const goBackStorage = useCallback(() => {
    if (browsePath.length > 0) {
      const newPath = browsePath.slice(0, -1)
      setBrowsePath(newPath)
      if (newPath.length === 0) {
        setBrowseItems([])
      } else {
        // 重新加载父目录
        const parentStorage = storagePaths.find((s) => s.name === newPath[0])
        if (parentStorage) {
          // 构建完整路径
          const fullPath = parentStorage.path.replace(parentStorage.name, newPath.join('/').replace(newPath[0], parentStorage.name))
          browseStorageDir(fullPath, '')
        }
      }
    }
  }, [browsePath, storagePaths, browseStorageDir])

  // 在系统文件管理器中打开
  const openInExplorer = useCallback(async (dirPath: string) => {
    try {
      await window.api.vcp.openStorageInExplorer(dirPath)
    } catch (error) {
      logger.error('Failed to open in explorer', { error, dirPath })
    }
  }, [])

  // 格式化文件大小
  const formatSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // 当切换到存储标签时加载数据
  useEffect(() => {
    if (activeTab === 'storage' && storagePaths.length === 0) {
      loadStoragePaths()
    }
  }, [activeTab, storagePaths.length, loadStoragePaths])

  // 渲染 Span 时间线
  const renderSpanTimeline = (trace: TraceInfo) => {
    const sortedSpans = [...trace.spans].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    return (
      <Timeline mode="left">
        {sortedSpans.map((span) => (
          <Timeline.Item
            key={span.spanId}
            color={span.status === 'completed' ? 'green' : span.status === 'running' ? 'blue' : 'red'}
            dot={
              span.status === 'running' ? (
                <LoadingOutlined spin />
              ) : span.status === 'completed' ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )
            }>
            <SpanItem>
              <SpanHeader>
                <Text strong>{span.operation}</Text>
                {span.durationMs && (
                  <Tag icon={<ClockCircleOutlined />} color="processing">
                    {span.durationMs}ms
                  </Tag>
                )}
              </SpanHeader>
              <SpanMeta>
                <Text type="secondary">ID: {span.spanId}</Text>
                {span.parentSpanId && <Text type="secondary">Parent: {span.parentSpanId}</Text>}
              </SpanMeta>
              {span.metadata && (
                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12 }}>
                  {span.metadata}
                </Paragraph>
              )}
            </SpanItem>
          </Timeline.Item>
        ))}
      </Timeline>
    )
  }

  return (
    <Container>
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined /> {t('vcp.tracing.title', '全链路追踪')}
        </Title>
        <Space>
          {/* ShowVCP 悬浮调试面板开关 */}
          <Tooltip title={t('vcp.tracing.show_vcp_tooltip', '启用后在左下角显示悬浮调试面板')}>
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
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            {t('common.refresh', '刷新')}
          </Button>
        </Space>
      </Header>

      {/* 状态概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <StatsCard>
            <Statistic
              title={t('vcp.tracing.native_status', 'Native 状态')}
              value={nativeStatus?.isNative ? 'Rust' : 'Fallback'}
              prefix={nativeStatus?.isNative ? <RocketOutlined /> : <ApiOutlined />}
              valueStyle={{ color: nativeStatus?.isNative ? '#52c41a' : '#faad14' }}
            />
            {nativeStatus && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                v{nativeStatus.version}
              </Text>
            )}
          </StatsCard>
        </Col>
        <Col span={6}>
          <StatsCard>
            <Statistic
              title={t('vcp.tracing.active_traces', '活跃追踪')}
              value={traces.filter((t) => t.status === 'running').length}
              suffix={`/ ${traces.length}`}
              prefix={<LoadingOutlined />}
            />
          </StatsCard>
        </Col>
        <Col span={6}>
          <StatsCard>
            <Statistic
              title={t('vcp.tracing.memory_entries', '记忆条目')}
              value={dbStats?.memoryCount || 0}
              prefix={<DatabaseOutlined />}
            />
          </StatsCard>
        </Col>
        <Col span={6}>
          <StatsCard>
            <Statistic
              title={t('vcp.tracing.db_size', '数据库大小')}
              value={dbStats ? (dbStats.fileSizeBytes / 1024 / 1024).toFixed(2) : 0}
              suffix="MB"
              prefix={<DatabaseOutlined />}
            />
          </StatsCard>
        </Col>
      </Row>

      {/* Native 特性 */}
      {nativeStatus && (
        <FeatureSection>
          <Text strong>{t('vcp.tracing.native_features', 'Native 特性')}:</Text>
          <Space wrap style={{ marginLeft: 12 }}>
            {nativeStatus.features.map((feature, index) => (
              <Tag key={`${feature}-${index}`} color="blue" icon={<CheckCircleOutlined />}>
                {feature}
              </Tag>
            ))}
          </Space>
          <Badge
            status={nativeStatus.status === 'healthy' ? 'success' : 'error'}
            text={nativeStatus.status}
            style={{ marginLeft: 16 }}
          />
        </FeatureSection>
      )}

      {/* Traces 列表 */}
      <Section>
        <Title level={5}>
          <ClockCircleOutlined /> {t('vcp.tracing.recent_traces', '最近追踪')}
        </Title>
        {traces.length === 0 ? (
          <Empty description={t('vcp.tracing.no_traces', '暂无追踪数据')} />
        ) : (
          <Collapse accordion>
            {traces.map((trace) => (
              <Collapse.Panel
                key={trace.traceId}
                header={
                  <TraceHeader>
                    <Space>
                      {trace.status === 'running' ? (
                        <LoadingOutlined spin style={{ color: '#1890ff' }} />
                      ) : trace.status === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      )}
                      <Text strong>{trace.operation}</Text>
                      <Text type="secondary">{trace.traceId.slice(0, 8)}</Text>
                    </Space>
                    <Space>
                      {trace.durationMs && (
                        <Tag color="processing">{trace.durationMs}ms</Tag>
                      )}
                      <Text type="secondary">
                        {new Date(trace.startTime).toLocaleTimeString('zh-CN')}
                      </Text>
                    </Space>
                  </TraceHeader>
                }>
                {renderSpanTimeline(trace)}
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </Section>

      {/* 数据库统计 */}
      {dbStats && (
        <Section>
          <Title level={5}>
            <DatabaseOutlined /> {t('vcp.tracing.database_stats', '数据库统计')}
          </Title>
          <Row gutter={16}>
            <Col span={6}>
              <MiniStatsCard>
                <Statistic title={t('vcp.tracing.memories', '记忆')} value={dbStats.memoryCount} />
              </MiniStatsCard>
            </Col>
            <Col span={6}>
              <MiniStatsCard>
                <Statistic title={t('vcp.tracing.knowledge', '知识')} value={dbStats.knowledgeCount} />
              </MiniStatsCard>
            </Col>
            <Col span={6}>
              <MiniStatsCard>
                <Statistic title={t('vcp.tracing.diary', '日记')} value={dbStats.diaryCount} />
              </MiniStatsCard>
            </Col>
            <Col span={6}>
              <MiniStatsCard>
                <Statistic title={t('vcp.tracing.tags', '标签')} value={dbStats.tagCount} />
              </MiniStatsCard>
            </Col>
          </Row>
        </Section>
      )}

      {/* 记忆调用追踪 */}
      <Section>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'traces' | 'memory' | 'native' | 'logs' | 'storage')}
          items={[
            {
              key: 'traces',
              label: (
                <span>
                  <ClockCircleOutlined /> {t('vcp.tracing.system_traces', '系统追踪')}
                </span>
              ),
              children: null
            },
            {
              key: 'memory',
              label: (
                <span>
                  <DatabaseOutlined /> {t('vcp.tracing.memory_traces', '记忆调用')}
                </span>
              ),
              children: (
                <MemoryTracingSection>
                  {/* 记忆追踪开关 */}
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text>{t('vcp.tracing.enable_tracing', '启用追踪')}:</Text>
                    <Switch
                      checked={memoryTracingEnabled}
                      onChange={handleToggleMemoryTracing}
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                  </div>

                  {/* 向量存储位置 */}
                  {vectorStorage.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>{t('vcp.tracing.vector_storage', '向量存储位置')}:</Text>
                      <Row gutter={8} style={{ marginTop: 8 }}>
                        {vectorStorage.map((storage, index) => (
                          <Col key={`${storage.backend}-${index}`} span={8}>
                            <VectorStorageCard size="small">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tag color="blue">{storage.backend}</Tag>
                                <Text strong style={{ fontSize: 14 }}>{storage.documentCount} 条</Text>
                              </div>
                              <div style={{ fontSize: 12, marginTop: 4 }}>
                                <Text type="secondary">维度: {storage.dimension}</Text>
                                <br />
                                <Text type="secondary" ellipsis style={{ display: 'block' }}>
                                  路径: {storage.location}
                                </Text>
                              </div>
                            </VectorStorageCard>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  )}

                  {/* 记忆统计 */}
                  {memoryStats && (
                    <Row gutter={8} style={{ marginBottom: 16 }}>
                      <Col span={6}>
                        <MiniStatsCard>
                          <Statistic
                            title={t('vcp.tracing.total_calls', '总调用')}
                            value={memoryStats.totalCalls}
                          />
                        </MiniStatsCard>
                      </Col>
                      <Col span={6}>
                        <MiniStatsCard>
                          <Statistic
                            title={t('vcp.tracing.avg_duration', '平均耗时')}
                            value={memoryStats.averageDurationMs.toFixed(1)}
                            suffix="ms"
                          />
                        </MiniStatsCard>
                      </Col>
                      <Col span={6}>
                        <MiniStatsCard>
                          <Statistic
                            title={t('vcp.tracing.error_count', '错误数')}
                            value={memoryStats.errorCount}
                            valueStyle={{ color: memoryStats.errorCount > 0 ? '#ff4d4f' : '#52c41a' }}
                          />
                        </MiniStatsCard>
                      </Col>
                      <Col span={6}>
                        <MiniStatsCard>
                          <Statistic
                            title={t('vcp.tracing.total_duration', '总耗时')}
                            value={(memoryStats.totalDurationMs / 1000).toFixed(2)}
                            suffix="s"
                          />
                        </MiniStatsCard>
                      </Col>
                    </Row>
                  )}

                  {/* 记忆调用列表 */}
                  {memoryTraces.length === 0 ? (
                    <Empty description={t('vcp.tracing.no_memory_traces', '暂无记忆调用记录')} />
                  ) : (
                    <Timeline mode="left">
                      {memoryTraces.slice(0, 50).map((trace) => (
                        <Timeline.Item
                          key={trace.id}
                          color={trace.result?.success ? 'green' : trace.result?.error ? 'red' : 'blue'}
                          dot={
                            trace.result?.success ? (
                              <CheckCircleOutlined />
                            ) : trace.result?.error ? (
                              <CloseCircleOutlined />
                            ) : (
                              <LoadingOutlined />
                            )
                          }>
                          <MemoryTraceItem>
                            <MemoryTraceHeader>
                              <Space>
                                <Tag color="purple">{trace.caller}</Tag>
                                <Text strong>{trace.method}</Text>
                              </Space>
                              <Space>
                                {trace.backend && <Tag color="cyan">{trace.backend}</Tag>}
                                <Tag icon={<ClockCircleOutlined />} color="processing">
                                  {trace.durationMs}ms
                                </Tag>
                              </Space>
                            </MemoryTraceHeader>
                            <MemoryTraceMeta>
                              <Text type="secondary">
                                {new Date(trace.timestamp).toLocaleString('zh-CN')}
                              </Text>
                              {trace.vectorInfo && (
                                <Text type="secondary" style={{ marginLeft: 16 }}>
                                  向量: dim={trace.vectorInfo.dimension}, loc={trace.vectorInfo.location}
                                </Text>
                              )}
                              {trace.result?.count !== undefined && (
                                <Text type="secondary" style={{ marginLeft: 16 }}>
                                  结果数: {trace.result.count}
                                </Text>
                              )}
                            </MemoryTraceMeta>
                            {trace.result?.error && (
                              <Text type="danger" style={{ fontSize: 12 }}>
                                错误: {trace.result.error}
                              </Text>
                            )}
                          </MemoryTraceItem>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  )}
                </MemoryTracingSection>
              )
            },
            {
              key: 'native',
              label: (
                <span>
                  <RocketOutlined /> {t('vcp.tracing.native_details', 'Native 模块')}
                </span>
              ),
              children: (
                <NativeDetailsSection>
                  {/* Native 状态概览 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <NativeStatusCard $isNative={nativeStatus?.isNative}>
                        <Space direction="vertical" align="center" style={{ width: '100%' }}>
                          {nativeStatus?.isNative ? (
                            <RocketOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                          ) : (
                            <ApiOutlined style={{ fontSize: 32, color: '#faad14' }} />
                          )}
                          <Text strong style={{ fontSize: 16 }}>
                            {nativeStatus?.isNative ? 'Rust Native' : 'TypeScript Fallback'}
                          </Text>
                          <Text type="secondary">v{nativeStatus?.version || 'unknown'}</Text>
                          <Badge
                            status={nativeStatus?.status === 'healthy' ? 'success' : 'warning'}
                            text={nativeStatus?.status || 'unknown'}
                          />
                        </Space>
                      </NativeStatusCard>
                    </Col>
                    <Col span={16}>
                      <Card title={<><ExperimentOutlined /> {t('vcp.tracing.features', '已启用功能')}</>} size="small">
                        <Space wrap>
                          {nativeStatus?.features.map((feature, index) => (
                            <Tooltip key={`${feature}-${index}`} title={getFeatureDescription(feature)}>
                              <Tag color="blue" icon={<CheckCircleOutlined />}>
                                {feature}
                              </Tag>
                            </Tooltip>
                          ))}
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  {/* TagMemo 统计 */}
                  {nativeDetails?.tagMemoStats && (
                    <Card
                      title={<><TagsOutlined /> {t('vcp.tracing.tagmemo_stats', 'TagMemo 标签共现矩阵')}</>}
                      size="small"
                      style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.tag_count', '标签数')}
                            value={nativeDetails.tagMemoStats.tagCount}
                            prefix={<TagsOutlined />}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.pair_count', '共现对数')}
                            value={nativeDetails.tagMemoStats.pairCount}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.total_updates', '总更新次数')}
                            value={nativeDetails.tagMemoStats.totalUpdates}
                          />
                        </Col>
                        <Col span={6}>
                          <div>
                            <Text type="secondary">NPMI 参数</Text>
                            <div style={{ marginTop: 4 }}>
                              <Text code>α={nativeDetails.tagMemoStats.alpha}</Text>
                              <Text code style={{ marginLeft: 8 }}>β={nativeDetails.tagMemoStats.beta}</Text>
                            </div>
                          </div>
                        </Col>
                      </Row>
                      {nativeDetails.tagMemoStats.pairCount > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Text type="secondary">共现密度:</Text>
                          <Progress
                            percent={Math.min(100, (nativeDetails.tagMemoStats.pairCount / Math.max(1, nativeDetails.tagMemoStats.tagCount * (nativeDetails.tagMemoStats.tagCount - 1) / 2)) * 100)}
                            size="small"
                            format={(p) => `${p?.toFixed(1)}%`}
                          />
                        </div>
                      )}
                    </Card>
                  )}

                  {/* WaveRAG 三阶段检索统计 */}
                  {nativeDetails?.waveragStats && (
                    <Card
                      title={<><ThunderboltOutlined /> {t('vcp.tracing.waverag_stats', 'WaveRAG 三阶段检索')}</>}
                      size="small"
                      style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.search_count', '检索次数')}
                            value={nativeDetails.waveragStats.searchCount ?? 0}
                            prefix={<SearchOutlined />}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.avg_total_duration', '平均总耗时')}
                            value={(nativeDetails.waveragStats.avgTotalDurationMs ?? 0).toFixed(1)}
                            suffix="ms"
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.avg_result_count', '平均结果数')}
                            value={(nativeDetails.waveragStats.avgResultCount ?? 0).toFixed(1)}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title={t('vcp.tracing.tag_boost_rate', 'TagBoost 应用率')}
                            value={((nativeDetails.waveragStats.tagBoostRate ?? 0) * 100).toFixed(1)}
                            suffix="%"
                            valueStyle={{ color: (nativeDetails.waveragStats.tagBoostRate ?? 0) > 0.5 ? '#52c41a' : '#faad14' }}
                          />
                        </Col>
                      </Row>
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary">{t('vcp.tracing.phase_duration', '阶段耗时分布')}:</Text>
                        <Row gutter={16} style={{ marginTop: 8 }}>
                          <Col span={8}>
                            <div style={{ textAlign: 'center' }}>
                              <Tag color="purple">Lens</Tag>
                              <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                                {(nativeDetails.waveragStats.avgLensDurationMs ?? 0).toFixed(1)}ms
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>标签提取</Text>
                            </div>
                          </Col>
                          <Col span={8}>
                            <div style={{ textAlign: 'center' }}>
                              <Tag color="blue">Expansion</Tag>
                              <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                                {(nativeDetails.waveragStats.avgExpansionDurationMs ?? 0).toFixed(1)}ms
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>多跳扩散</Text>
                            </div>
                          </Col>
                          <Col span={8}>
                            <div style={{ textAlign: 'center' }}>
                              <Tag color="green">Focus</Tag>
                              <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                                {(nativeDetails.waveragStats.avgFocusDurationMs ?? 0).toFixed(1)}ms
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>结果融合</Text>
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Card>
                  )}

                  {/* 向量搜索引擎 */}
                  {vectorStorage.length > 0 && (
                    <Card
                      title={<><SearchOutlined /> {t('vcp.tracing.vector_engines', '向量搜索引擎')}</>}
                      size="small"
                      style={{ marginBottom: 16 }}>
                      <Row gutter={8}>
                        {vectorStorage.map((storage, index) => (
                          <Col key={`${storage.backend}-${index}`} span={8}>
                            <VectorEngineCard>
                              <Tag color={storage.backend === 'vexus' ? 'green' : 'blue'}>
                                {storage.backend.toUpperCase()}
                              </Tag>
                              <div style={{ marginTop: 8 }}>
                                <Statistic
                                  title={t('vcp.tracing.documents', '文档数')}
                                  value={storage.documentCount}
                                  valueStyle={{ fontSize: 16 }}
                                />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {storage.dimension}维 | {storage.location.split('/').pop()}
                                </Text>
                              </div>
                            </VectorEngineCard>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  )}

                  {/* 性能对比 */}
                  {nativeStatus?.isNative && (
                    <Card title={t('vcp.tracing.performance', '性能优势')} size="small">
                      <Row gutter={16}>
                        <Col span={8}>
                          <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">{t('vcp.tracing.vector_search', '向量搜索')}</Text>
                            <div style={{ fontSize: 20, color: '#52c41a', fontWeight: 'bold' }}>~10x</div>
                            <Text type="secondary" style={{ fontSize: 11 }}>HNSW vs 暴力搜索</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">{t('vcp.tracing.text_search', '中文搜索')}</Text>
                            <div style={{ fontSize: 20, color: '#52c41a', fontWeight: 'bold' }}>~5x</div>
                            <Text type="secondary" style={{ fontSize: 11 }}>jieba + tantivy BM25</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">{t('vcp.tracing.tag_cooccurrence', '标签共现')}</Text>
                            <div style={{ fontSize: 20, color: '#52c41a', fontWeight: 'bold' }}>~3x</div>
                            <Text type="secondary" style={{ fontSize: 11 }}>Rust NPMI 矩阵</Text>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  )}
                </NativeDetailsSection>
              )
            },
            {
              key: 'logs',
              label: (
                <span>
                  <FileTextOutlined /> {t('vcp.tracing.logs', '调用日志')}
                </span>
              ),
              children: <VCPLogViewer maxHeight={400} />
            },
            {
              key: 'storage',
              label: (
                <span>
                  <FolderOutlined /> {t('vcp.tracing.storage', '本地存储')}
                </span>
              ),
              children: (
                <StorageSection>
                  {/* 存储目录概览 */}
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{t('vcp.tracing.storage_overview', '存储目录概览')}</Text>
                    <Button icon={<ReloadOutlined />} size="small" onClick={loadStoragePaths} loading={storageLoading}>
                      {t('common.refresh', '刷新')}
                    </Button>
                  </div>

                  {/* 面包屑导航 */}
                  {browsePath.length > 0 && (
                    <Breadcrumb style={{ marginBottom: 16 }}>
                      <Breadcrumb.Item>
                        <Button type="link" size="small" onClick={() => { setBrowsePath([]); setBrowseItems([]) }}>
                          <FolderOutlined /> {t('vcp.tracing.root', '根目录')}
                        </Button>
                      </Breadcrumb.Item>
                      {browsePath.map((name, index) => (
                        <Breadcrumb.Item key={index}>
                          <Button type="link" size="small" onClick={() => goBackStorage()}>
                            {name}
                          </Button>
                        </Breadcrumb.Item>
                      ))}
                    </Breadcrumb>
                  )}

                  {/* 目录列表或浏览内容 */}
                  {browsePath.length === 0 ? (
                    <List
                      loading={storageLoading}
                      dataSource={storagePaths}
                      renderItem={(item) => (
                        <List.Item
                          actions={[
                            <Button
                              key="browse"
                              type="link"
                              size="small"
                              disabled={!item.exists}
                              onClick={() => browseStorageDir(item.path, item.name)}>
                              {t('vcp.tracing.browse', '浏览')}
                            </Button>,
                            <Button
                              key="open"
                              type="link"
                              size="small"
                              disabled={!item.exists}
                              onClick={() => openInExplorer(item.path)}>
                              <FolderOpenOutlined /> {t('vcp.tracing.open_folder', '打开')}
                            </Button>
                          ]}>
                          <List.Item.Meta
                            avatar={
                              <div style={{
                                width: 40,
                                height: 40,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 8,
                                background: item.exists ? 'rgba(82, 196, 26, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                              }}>
                                <FolderOutlined style={{
                                  fontSize: 20,
                                  color: item.exists ? '#52c41a' : '#bfbfbf'
                                }} />
                              </div>
                            }
                            title={
                              <Space>
                                <Text strong>{item.name}</Text>
                                {!item.exists && <Tag color="default">{t('vcp.tracing.not_exist', '不存在')}</Tag>}
                              </Space>
                            }
                            description={
                              item.exists ? (
                                <Space size="large">
                                  <Text type="secondary">
                                    {t('vcp.tracing.size', '大小')}: {formatSize(item.size)}
                                  </Text>
                                  <Text type="secondary">
                                    {t('vcp.tracing.items', '项目')}: {item.itemCount}
                                  </Text>
                                </Space>
                              ) : (
                                <Text type="secondary">{item.path}</Text>
                              )
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <List
                      loading={storageLoading}
                      dataSource={browseItems}
                      renderItem={(item) => (
                        <List.Item
                          actions={[
                            item.type === 'directory' && (
                              <Button
                                key="browse"
                                type="link"
                                size="small"
                                onClick={() => browseStorageDir(item.path, item.name)}>
                                {t('vcp.tracing.browse', '浏览')}
                              </Button>
                            ),
                            <Button
                              key="open"
                              type="link"
                              size="small"
                              onClick={() => openInExplorer(item.type === 'directory' ? item.path : item.path.replace(/[/\\][^/\\]+$/, ''))}>
                              <FolderOpenOutlined />
                            </Button>
                          ].filter(Boolean)}>
                          <List.Item.Meta
                            avatar={
                              item.type === 'directory' ? (
                                <FolderOutlined style={{ fontSize: 18, color: '#faad14' }} />
                              ) : (
                                <FileTextOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                              )
                            }
                            title={item.name}
                            description={
                              <Space size="large">
                                <Text type="secondary">{formatSize(item.size)}</Text>
                                <Text type="secondary">
                                  {new Date(item.modifiedAt).toLocaleString('zh-CN')}
                                </Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </StorageSection>
              )
            }
          ]}
        />
      </Section>
    </Container>
  )
}

/**
 * 获取功能描述
 */
function getFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    vexus: 'HNSW 向量索引 - 高效近似最近邻搜索',
    tagmemo: '标签共现矩阵 - NPMI 算法计算标签关联',
    tagmemo_boost: '标签增强 - 动态权重 TagBoost 算法',
    waverag: 'WaveRAG 三阶段检索 - Lens/Expansion/Focus 管线',
    tracing: '全链路追踪 - 性能监控与调试',
    search: '中文全文搜索 - jieba分词 + tantivy BM25',
    chinese_search: '中文全文搜索 - jieba-rs 分词 + BM25',
    hybrid_search: '混合检索 - RRF 融合向量与BM25',
    semantic: '语义组匹配 - 服装/场景关键词分组',
    cooccurrence: '共现矩阵 - 标签关联度计算',
    database: '统一数据库层 - SQLite/LibSQL 存储',
    diary: '日记系统 - 时间范围搜索与打标',
    vector: '向量相似度计算 - Cosine/L2 距离',
    chunker: '文本分块器 - 智能段落切分'
  }
  return descriptions[feature] || feature
}

// ==================== 样式 ====================

const Container = styled.div`
  padding: 20px;
  height: 100%;
  overflow-y: auto;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`

const Section = styled.div`
  margin-bottom: 24px;
`

const StatsCard = styled(Card)`
  text-align: center;
`

const MiniStatsCard = styled(Card)`
  .ant-statistic-title {
    font-size: 12px;
  }
  .ant-statistic-content {
    font-size: 20px;
  }
`

const FeatureSection = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 24px;
`

const TraceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`

const SpanItem = styled.div`
  padding: 8px 0;
`

const SpanHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`

const SpanMeta = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
`

const MemoryTracingSection = styled.div`
  padding: 16px 0;
`

const VectorStorageCard = styled(Card)`
  .ant-card-body {
    padding: 12px;
  }
`

const MemoryTraceItem = styled.div`
  padding: 8px 0;
`

const MemoryTraceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`

const MemoryTraceMeta = styled.div`
  font-size: 12px;
  margin-top: 4px;
`

const NativeDetailsSection = styled.div`
  padding: 16px 0;
`

const NativeStatusCard = styled(Card)<{ $isNative?: boolean }>`
  text-align: center;
  border: 2px solid ${(props) => (props.$isNative ? '#52c41a' : '#faad14')};
  background: ${(props) => (props.$isNative ? 'rgba(82, 196, 26, 0.05)' : 'rgba(250, 173, 20, 0.05)')};

  .ant-card-body {
    padding: 24px;
  }
`

const VectorEngineCard = styled.div`
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const StorageSection = styled.div`
  padding: 16px 0;

  .ant-list-item {
    padding: 12px 0;
    transition: background 0.2s;

    &:hover {
      background: var(--color-background-mute);
    }
  }

  .ant-list-item-meta-avatar {
    margin-right: 12px;
  }
`

export default TracingPanel
