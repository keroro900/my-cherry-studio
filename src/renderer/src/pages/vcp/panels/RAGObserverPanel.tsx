/**
 * RAG Observer Panel - RAG 观察面板
 *
 * 实时显示 RAG 检索、思维链、Agent 对话等事件
 * 通过 IPC 订阅 vcpinfo:event 事件
 */

import {
  ClearOutlined,
  DatabaseOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  LikeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Badge, Button, Card, Collapse, Empty, Space, Statistic, Tag, Timeline, Tooltip, Typography } from 'antd'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('RAGObserverPanel')

const { Text, Paragraph } = Typography

// ==================== 类型定义 ====================

interface RAGRetrievalEvent {
  type: 'RAG_RETRIEVAL_DETAILS'
  dbName: string
  query: string
  k: number
  useTime: string
  useRerank: boolean
  useTagMemo?: boolean
  tagWeight?: number
  results: Array<{
    text: string
    score?: number
    originalScore?: number
    source?: string
    matchedTags?: string[]
  }>
  timestamp?: number
}

interface MetaThinkingChainEvent {
  type: 'META_THINKING_CHAIN'
  chainName: string
  query: string
  stages: Array<{
    stage: number
    clusterName: string
    resultCount: number
    results: Array<{
      text: string
      score?: number
      source?: string
    }>
  }>
  timestamp?: number
}

interface AgentChatPreviewEvent {
  type: 'AGENT_PRIVATE_CHAT_PREVIEW'
  agentName: string
  agentId: string
  query: string
  response: string
  timestamp?: number
}

interface AIMemoRetrievalEvent {
  type: 'AI_MEMO_RETRIEVAL'
  mode: string
  diaryCount: number
  extractedMemories: string
  timestamp?: number
}

interface ToolCallEvent {
  type: 'TOOL_CALL_START' | 'TOOL_CALL_END' | 'TOOL_CALL_UPDATE'
  callId: string
  toolName: string
  pluginName?: string
  status: 'pending' | 'running' | 'success' | 'error'
  input?: Record<string, unknown>
  output?: unknown
  error?: string
  duration?: number
  timestamp: number
  traceId?: string
}

interface WorkflowStatusEvent {
  type: 'WORKFLOW_STATUS'
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  currentStep?: string
  progress?: number
  timestamp: number
}

interface WaveRAGEvent {
  type: 'WAVERAG_SEARCH'
  traceId: string
  query: string
  queryTags: string[]
  phases: {
    lens: {
      tags: string[]
      expandedTags: string[]
      durationMs: number
    }
    expansion: {
      allTags: string[]
      depthReached: number
      durationMs: number
    }
    focus: {
      resultCount: number
      tagBoostApplied: boolean
      durationMs: number
    }
  }
  results: Array<{
    id: string
    content: string
    finalScore: number
    originalScore: number
    tagBoostScore: number
    matchedTags: string[]
    source: string
  }>
  totalDurationMs: number
  timestamp: number
}

// 修饰符解析事件 (新增)
interface ModifierParsingEvent {
  type: 'MODIFIER_PARSING'
  traceId: string
  originalQuery: string
  parsedModifiers: Array<{
    modifier: string // ::Time, ::Group, ::TagMemo, ::Rerank, ::TopK, ::Threshold, ::AIMemo
    value?: string | number
    parsed: boolean
  }>
  cleanQuery: string // 去除修饰符后的查询
  retrievalMode: string // lightmemo, deepmemo, meshmemo, waverag
  timestamp: number
}

// 检索链路追踪事件 (新增)
interface RetrievalChainEvent {
  type: 'RETRIEVAL_CHAIN'
  traceId: string
  chainId: string
  stages: Array<{
    stageName: string // 'parse' | 'expand' | 'search' | 'rerank' | 'fuse' | 'boost'
    status: 'pending' | 'running' | 'completed' | 'skipped' | 'error'
    durationMs?: number
    inputCount?: number
    outputCount?: number
    details?: Record<string, unknown>
  }>
  totalDurationMs: number
  timestamp: number
}

// 自学习反馈事件 (新增)
interface SelfLearningFeedbackEvent {
  type: 'SELFLEARNING_FEEDBACK'
  feedbackType: 'positive' | 'negative'
  query: string
  resultId: string
  relatedTags: string[]
  weightAdjustment?: number
  timestamp: number
}

type VCPInfoEvent =
  | RAGRetrievalEvent
  | MetaThinkingChainEvent
  | AgentChatPreviewEvent
  | AIMemoRetrievalEvent
  | ToolCallEvent
  | WorkflowStatusEvent
  | WaveRAGEvent
  | ModifierParsingEvent
  | RetrievalChainEvent
  | SelfLearningFeedbackEvent

interface EventItem {
  id: string
  event: VCPInfoEvent
  receivedAt: Date
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const StatsRow = styled.div`
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const EventList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
`

const EventCard = styled(Card)<{ $eventType: string }>`
  margin-bottom: 12px;
  border-left: 3px solid
    ${(props) => {
      switch (props.$eventType) {
        case 'RAG_RETRIEVAL_DETAILS':
          return '#3498db'
        case 'META_THINKING_CHAIN':
          return '#9b59b6'
        case 'AGENT_PRIVATE_CHAT_PREVIEW':
          return '#f1c40f'
        case 'AI_MEMO_RETRIEVAL':
          return '#1abc9c'
        case 'TOOL_CALL_START':
        case 'TOOL_CALL_END':
        case 'TOOL_CALL_UPDATE':
          return '#e74c3c'
        case 'WORKFLOW_STATUS':
          return '#2ecc71'
        case 'WAVERAG_SEARCH':
          return '#e91e63' // 三阶段检索使用粉红色
        default:
          return 'var(--color-border)'
      }
    }};

  .ant-card-head {
    min-height: auto;
    padding: 8px 12px;
  }

  .ant-card-body {
    padding: 12px;
  }
`

const ResultItem = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  border: 1px solid var(--color-border);
`

const ScoreBadge = styled.span<{ $level: 'high' | 'medium' | 'low' }>`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  ${(props) => {
    switch (props.$level) {
      case 'high':
        return 'color: #4caf50; background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3);'
      case 'medium':
        return 'color: #ff9800; background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3);'
      case 'low':
        return 'color: #f44336; background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3);'
    }
  }}
`

const MetaInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
`

const MetaPill = styled.span`
  background: var(--color-background-soft);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
`

// ==================== 工具函数 ====================

function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getEventIcon(type: string) {
  switch (type) {
    case 'RAG_RETRIEVAL_DETAILS':
      return <DatabaseOutlined />
    case 'META_THINKING_CHAIN':
      return <NodeIndexOutlined />
    case 'AGENT_PRIVATE_CHAT_PREVIEW':
      return <MessageOutlined />
    case 'AI_MEMO_RETRIEVAL':
      return <SearchOutlined />
    case 'TOOL_CALL_START':
    case 'TOOL_CALL_END':
    case 'TOOL_CALL_UPDATE':
      return <ThunderboltOutlined />
    case 'WORKFLOW_STATUS':
      return <NodeIndexOutlined />
    case 'WAVERAG_SEARCH':
      return <NodeIndexOutlined />
    case 'MODIFIER_PARSING':
      return <FilterOutlined />
    case 'RETRIEVAL_CHAIN':
      return <NodeIndexOutlined />
    case 'SELFLEARNING_FEEDBACK':
      return <LikeOutlined />
    default:
      return <EyeOutlined />
  }
}

function getEventTitle(event: VCPInfoEvent): string {
  switch (event.type) {
    case 'RAG_RETRIEVAL_DETAILS':
      return `RAG 检索 - ${event.dbName}`
    case 'META_THINKING_CHAIN':
      return `思维链 - ${event.chainName}`
    case 'AGENT_PRIVATE_CHAT_PREVIEW':
      return `Agent 对话 - ${event.agentName}`
    case 'AI_MEMO_RETRIEVAL':
      return `记忆检索 - ${event.mode}`
    case 'TOOL_CALL_START':
    case 'TOOL_CALL_END':
    case 'TOOL_CALL_UPDATE':
      return `工具调用 - ${event.toolName}`
    case 'WORKFLOW_STATUS':
      return `工作流 - ${event.workflowId.slice(0, 8)}`
    case 'WAVERAG_SEARCH':
      return `WaveRAG 三阶段检索 - ${event.traceId.slice(0, 8)}`
    case 'MODIFIER_PARSING':
      return `修饰符解析 - ${event.retrievalMode}`
    case 'RETRIEVAL_CHAIN':
      return `检索链路 - ${event.chainId.slice(0, 8)}`
    case 'SELFLEARNING_FEEDBACK':
      return `学习反馈 - ${event.feedbackType === 'positive' ? '正向' : '负向'}`
    default:
      return '未知事件'
  }
}

// ==================== 事件渲染组件 ====================

const RAGRetrievalCard: FC<{ event: RAGRetrievalEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>查询: {event.query.slice(0, 50)}...</MetaPill>
      <MetaPill>Top-K: {event.k}</MetaPill>
      <MetaPill>耗时: {event.useTime}</MetaPill>
      {event.useTagMemo && <MetaPill>TagMemo: {event.tagWeight}</MetaPill>}
      {event.useRerank && <Tag color="blue">Rerank</Tag>}
    </MetaInfo>

    <Collapse
      ghost
      items={[
        {
          key: 'results',
          label: `检索结果 (${event.results.length}条)`,
          children: (
            <div>
              {event.results.map((result, idx) => (
                <ResultItem key={idx}>
                  <Space style={{ marginBottom: 8 }}>
                    <ScoreBadge $level={getScoreLevel(result.score || 0)}>
                      {((result.score || 0) * 100).toFixed(1)}%
                    </ScoreBadge>
                    {result.source && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {result.source}
                      </Text>
                    )}
                    {result.matchedTags?.map((tag) => (
                      <Tag key={tag} color="purple" style={{ fontSize: 11 }}>
                        {tag}
                      </Tag>
                    ))}
                  </Space>
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true }}
                    style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>
                    {result.text}
                  </Paragraph>
                </ResultItem>
              ))}
            </div>
          )
        }
      ]}
    />
  </div>
)

const MetaThinkingChainCard: FC<{ event: MetaThinkingChainEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>查询: {event.query.slice(0, 50)}...</MetaPill>
      <MetaPill>阶段数: {event.stages.length}</MetaPill>
    </MetaInfo>

    <Timeline
      items={event.stages.map((stage) => ({
        color: 'purple',
        children: (
          <div>
            <Text strong>
              Stage {stage.stage}: {stage.clusterName}
            </Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({stage.resultCount} 条结果)
            </Text>
          </div>
        )
      }))}
    />
  </div>
)

const AgentChatCard: FC<{ event: AgentChatPreviewEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>Agent: {event.agentName}</MetaPill>
    </MetaInfo>

    <div style={{ marginBottom: 8 }}>
      <Tag color="blue">Query</Tag>
      <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '4px 0', fontSize: 13 }}>
        {event.query}
      </Paragraph>
    </div>

    <div>
      <Tag color="green">Response</Tag>
      <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ margin: '4px 0', fontSize: 13 }}>
        {event.response}
      </Paragraph>
    </div>
  </div>
)

const MemoRetrievalCard: FC<{ event: AIMemoRetrievalEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>模式: {event.mode}</MetaPill>
      <MetaPill>日记数: {event.diaryCount}</MetaPill>
    </MetaInfo>

    <Paragraph ellipsis={{ rows: 4, expandable: true }} style={{ fontSize: 13 }}>
      {event.extractedMemories}
    </Paragraph>
  </div>
)

const ToolCallCard: FC<{ event: ToolCallEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>工具: {event.toolName}</MetaPill>
      {event.pluginName && <MetaPill>插件: {event.pluginName}</MetaPill>}
      {event.duration && <MetaPill>耗时: {event.duration}ms</MetaPill>}
      <Tag color={event.status === 'success' ? 'green' : event.status === 'error' ? 'red' : 'blue'}>
        {event.status}
      </Tag>
    </MetaInfo>

    {event.error && (
      <Text type="danger" style={{ fontSize: 13 }}>
        错误: {event.error}
      </Text>
    )}
  </div>
)

const WaveRAGCard: FC<{ event: WaveRAGEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>查询: {event.query.slice(0, 50)}...</MetaPill>
      <MetaPill>总耗时: {event.totalDurationMs}ms</MetaPill>
      {event.queryTags.length > 0 && (
        <span>
          {event.queryTags.slice(0, 5).map((tag) => (
            <Tag key={tag} color="magenta" style={{ fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
          {event.queryTags.length > 5 && <Text type="secondary">+{event.queryTags.length - 5}</Text>}
        </span>
      )}
    </MetaInfo>

    <Collapse
      ghost
      items={[
        {
          key: 'phases',
          label: '三阶段详情',
          children: (
            <Timeline
              items={[
                {
                  color: '#9c27b0',
                  children: (
                    <div>
                      <Text strong>Lens 标签提取</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({event.phases.lens.durationMs}ms)
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          提取标签:
                        </Text>
                        {event.phases.lens.tags.slice(0, 5).map((tag) => (
                          <Tag key={tag} color="purple" style={{ fontSize: 11, marginLeft: 4 }}>
                            {tag}
                          </Tag>
                        ))}
                        {event.phases.lens.tags.length > 5 && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            +{event.phases.lens.tags.length - 5}
                          </Text>
                        )}
                      </div>
                      {event.phases.lens.expandedTags.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            扩展标签:
                          </Text>
                          {event.phases.lens.expandedTags.slice(0, 5).map((tag) => (
                            <Tag key={tag} color="geekblue" style={{ fontSize: 11, marginLeft: 4 }}>
                              {tag}
                            </Tag>
                          ))}
                          {event.phases.lens.expandedTags.length > 5 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              +{event.phases.lens.expandedTags.length - 5}
                            </Text>
                          )}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  color: '#2196f3',
                  children: (
                    <div>
                      <Text strong>Expansion 多跳扩散</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({event.phases.expansion.durationMs}ms)
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          深度: {event.phases.expansion.depthReached} | 标签数: {event.phases.expansion.allTags.length}
                        </Text>
                      </div>
                    </div>
                  )
                },
                {
                  color: '#4caf50',
                  children: (
                    <div>
                      <Text strong>Focus 结果融合</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({event.phases.focus.durationMs}ms)
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          结果数: {event.phases.focus.resultCount}
                          {event.phases.focus.tagBoostApplied && (
                            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
                              TagBoost
                            </Tag>
                          )}
                        </Text>
                      </div>
                    </div>
                  )
                }
              ]}
            />
          )
        },
        {
          key: 'results',
          label: `检索结果 (${event.results.length}条)`,
          children: (
            <div>
              {event.results.map((result, idx) => (
                <ResultItem key={idx}>
                  <Space style={{ marginBottom: 8 }}>
                    <ScoreBadge $level={getScoreLevel(result.finalScore)}>
                      {(result.finalScore * 100).toFixed(1)}%
                    </ScoreBadge>
                    <Tooltip title={`原始: ${(result.originalScore * 100).toFixed(1)}% | TagBoost: ${(result.tagBoostScore * 100).toFixed(1)}%`}>
                      <Text type="secondary" style={{ fontSize: 11, cursor: 'help' }}>
                        (原始 {(result.originalScore * 100).toFixed(0)}% + Boost {(result.tagBoostScore * 100).toFixed(0)}%)
                      </Text>
                    </Tooltip>
                    {result.source && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {result.source}
                      </Text>
                    )}
                  </Space>
                  <div style={{ marginBottom: 4 }}>
                    {result.matchedTags?.slice(0, 5).map((tag) => (
                      <Tag key={tag} color="pink" style={{ fontSize: 11 }}>
                        {tag}
                      </Tag>
                    ))}
                    {(result.matchedTags?.length || 0) > 5 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        +{result.matchedTags!.length - 5}
                      </Text>
                    )}
                  </div>
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true }}
                    style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>
                    {result.content}
                  </Paragraph>
                </ResultItem>
              ))}
            </div>
          )
        }
      ]}
    />
  </div>
)

// 修饰符解析卡片 (新增)
const ModifierParsingCard: FC<{ event: ModifierParsingEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <MetaPill>原始查询: {event.originalQuery.slice(0, 40)}...</MetaPill>
      <MetaPill>检索模式: {event.retrievalMode}</MetaPill>
    </MetaInfo>

    <div style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        解析的修饰符:
      </Text>
      <div style={{ marginTop: 4 }}>
        {event.parsedModifiers.map((mod, idx) => (
          <Tag
            key={idx}
            color={mod.parsed ? 'green' : 'default'}
            style={{ marginBottom: 4 }}>
            {mod.modifier}
            {mod.value !== undefined && `: ${mod.value}`}
            {!mod.parsed && ' (未识别)'}
          </Tag>
        ))}
      </div>
    </div>

    <div style={{ background: 'var(--color-background-soft)', padding: 8, borderRadius: 6 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        清理后查询:
      </Text>
      <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>{event.cleanQuery}</Paragraph>
    </div>
  </div>
)

// 检索链路卡片 (新增)
const RetrievalChainCard: FC<{ event: RetrievalChainEvent }> = ({ event }) => {
  const getStageColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a'
      case 'running':
        return '#1890ff'
      case 'error':
        return '#ff4d4f'
      case 'skipped':
        return '#d9d9d9'
      default:
        return '#faad14'
    }
  }

  return (
    <div>
      <MetaInfo>
        <MetaPill>链路 ID: {event.chainId.slice(0, 12)}</MetaPill>
        <MetaPill>总耗时: {event.totalDurationMs}ms</MetaPill>
        <MetaPill>阶段数: {event.stages.length}</MetaPill>
      </MetaInfo>

      <Timeline
        items={event.stages.map((stage) => ({
          color: getStageColor(stage.status),
          children: (
            <div>
              <Space>
                <Text strong>{stage.stageName}</Text>
                <Tag
                  color={
                    stage.status === 'completed'
                      ? 'success'
                      : stage.status === 'error'
                        ? 'error'
                        : stage.status === 'running'
                          ? 'processing'
                          : 'default'
                  }>
                  {stage.status}
                </Tag>
                {stage.durationMs !== undefined && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {stage.durationMs}ms
                  </Text>
                )}
              </Space>
              {(stage.inputCount !== undefined || stage.outputCount !== undefined) && (
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {stage.inputCount !== undefined && `输入: ${stage.inputCount}`}
                    {stage.inputCount !== undefined && stage.outputCount !== undefined && ' → '}
                    {stage.outputCount !== undefined && `输出: ${stage.outputCount}`}
                  </Text>
                </div>
              )}
            </div>
          )
        }))}
      />
    </div>
  )
}

// 自学习反馈卡片 (新增)
const SelfLearningFeedbackCard: FC<{ event: SelfLearningFeedbackEvent }> = ({ event }) => (
  <div>
    <MetaInfo>
      <Tag color={event.feedbackType === 'positive' ? 'success' : 'error'}>
        {event.feedbackType === 'positive' ? '正向反馈' : '负向反馈'}
      </Tag>
      {event.weightAdjustment !== undefined && (
        <MetaPill>权重调整: {event.weightAdjustment > 0 ? '+' : ''}{event.weightAdjustment.toFixed(3)}</MetaPill>
      )}
    </MetaInfo>

    <div style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        查询:
      </Text>
      <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '2px 0', fontSize: 13 }}>
        {event.query}
      </Paragraph>
    </div>

    <div style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        结果 ID:
      </Text>
      <Text code style={{ fontSize: 12, marginLeft: 4 }}>
        {event.resultId.slice(0, 20)}...
      </Text>
    </div>

    {event.relatedTags.length > 0 && (
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          关联标签:
        </Text>
        <div style={{ marginTop: 4 }}>
          {event.relatedTags.map((tag) => (
            <Tag key={tag} color="blue" style={{ fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
        </div>
      </div>
    )}
  </div>
)

// ==================== 主组件 ====================

const RAGObserverPanel: FC = () => {
  const { t } = useTranslation()
  const [events, setEvents] = useState<EventItem[]>([])
  const [isListening, setIsListening] = useState(true)
  const eventListRef = useRef<HTMLDivElement>(null)
  const maxEvents = 100

  // 统计数据
  const stats = {
    total: events.length,
    rag: events.filter((e) => e.event.type === 'RAG_RETRIEVAL_DETAILS').length,
    waverag: events.filter((e) => e.event.type === 'WAVERAG_SEARCH').length,
    chain: events.filter((e) => e.event.type === 'META_THINKING_CHAIN' || e.event.type === 'RETRIEVAL_CHAIN').length,
    agent: events.filter((e) => e.event.type === 'AGENT_PRIVATE_CHAT_PREVIEW').length,
    memo: events.filter((e) => e.event.type === 'AI_MEMO_RETRIEVAL').length,
    tool: events.filter((e) => e.event.type.startsWith('TOOL_CALL')).length,
    modifier: events.filter((e) => e.event.type === 'MODIFIER_PARSING').length,
    feedback: events.filter((e) => e.event.type === 'SELFLEARNING_FEEDBACK').length
  }

  // 添加事件
  const addEvent = useCallback((event: VCPInfoEvent) => {
    const item: EventItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      receivedAt: new Date()
    }

    setEvents((prev) => {
      const newEvents = [item, ...prev]
      return newEvents.slice(0, maxEvents)
    })
  }, [])

  // 订阅 IPC 事件
  useEffect(() => {
    if (!isListening) return

    logger.info('Subscribing to vcpinfo:event')

    const handleEvent = (_event: unknown, data: VCPInfoEvent) => {
      logger.debug('Received vcpinfo event', { type: data.type })
      addEvent(data)
    }

    const cleanup = window.electron?.ipcRenderer.on('vcpinfo:event', handleEvent)

    return () => {
      logger.info('Unsubscribing from vcpinfo:event')
      cleanup?.()
    }
  }, [isListening, addEvent])

  // 清空事件
  const handleClear = () => {
    setEvents([])
  }

  // 渲染事件内容
  const renderEventContent = (event: VCPInfoEvent) => {
    switch (event.type) {
      case 'RAG_RETRIEVAL_DETAILS':
        return <RAGRetrievalCard event={event} />
      case 'META_THINKING_CHAIN':
        return <MetaThinkingChainCard event={event} />
      case 'AGENT_PRIVATE_CHAT_PREVIEW':
        return <AgentChatCard event={event} />
      case 'AI_MEMO_RETRIEVAL':
        return <MemoRetrievalCard event={event} />
      case 'TOOL_CALL_START':
      case 'TOOL_CALL_END':
      case 'TOOL_CALL_UPDATE':
        return <ToolCallCard event={event} />
      case 'WORKFLOW_STATUS':
        return (
          <MetaInfo>
            <MetaPill>状态: {event.status}</MetaPill>
            {event.currentStep && <MetaPill>当前步骤: {event.currentStep}</MetaPill>}
            {event.progress !== undefined && <MetaPill>进度: {event.progress}%</MetaPill>}
          </MetaInfo>
        )
      case 'WAVERAG_SEARCH':
        return <WaveRAGCard event={event} />
      case 'MODIFIER_PARSING':
        return <ModifierParsingCard event={event} />
      case 'RETRIEVAL_CHAIN':
        return <RetrievalChainCard event={event} />
      case 'SELFLEARNING_FEEDBACK':
        return <SelfLearningFeedbackCard event={event} />
      default:
        return <Text type="secondary">未知事件类型</Text>
    }
  }

  return (
    <PanelContainer>
      <HeaderBar>
        <Space>
          <EyeOutlined style={{ fontSize: 18 }} />
          <Text strong style={{ fontSize: 16 }}>
            RAG 观察器
          </Text>
          <Badge status={isListening ? 'processing' : 'default'} text={isListening ? '监听中' : '已暂停'} />
        </Space>

        <Space>
          <Tooltip title={isListening ? '暂停监听' : '开始监听'}>
            <Button type={isListening ? 'primary' : 'default'} onClick={() => setIsListening(!isListening)}>
              {isListening ? '暂停' : '监听'}
            </Button>
          </Tooltip>
          <Tooltip title="清空事件">
            <Button icon={<ClearOutlined />} onClick={handleClear} />
          </Tooltip>
        </Space>
      </HeaderBar>

      <StatsRow>
        <Statistic title="总事件" value={stats.total} prefix={<EyeOutlined />} />
        <Statistic title="RAG 检索" value={stats.rag} valueStyle={{ color: '#3498db' }} />
        <Statistic title="WaveRAG" value={stats.waverag} valueStyle={{ color: '#e91e63' }} />
        <Statistic title="链路" value={stats.chain} valueStyle={{ color: '#9b59b6' }} />
        <Statistic title="修饰符" value={stats.modifier} valueStyle={{ color: '#00bcd4' }} />
        <Statistic title="记忆" value={stats.memo} valueStyle={{ color: '#1abc9c' }} />
        <Statistic title="反馈" value={stats.feedback} valueStyle={{ color: '#ff9800' }} />
        <Statistic title="工具" value={stats.tool} valueStyle={{ color: '#e74c3c' }} />
      </StatsRow>

      <EventList ref={eventListRef}>
        {events.length === 0 ? (
          <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          events.map((item) => (
            <EventCard
              key={item.id}
              $eventType={item.event.type}
              size="small"
              title={
                <Space>
                  {getEventIcon(item.event.type)}
                  <span>{getEventTitle(item.event)}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatTimestamp(item.event.timestamp || item.receivedAt.getTime())}
                  </Text>
                </Space>
              }>
              {renderEventContent(item.event)}
            </EventCard>
          ))
        )}
      </EventList>
    </PanelContainer>
  )
}

export default RAGObserverPanel
