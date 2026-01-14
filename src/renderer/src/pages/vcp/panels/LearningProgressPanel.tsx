/**
 * LearningProgressPanel - 学习进度面板
 *
 * 功能:
 * - Tag 权重分布展示
 * - 查询频率统计
 * - 待确认的语义关联建议
 * - 学习统计概览
 *
 * 使用场景:
 * - VCPDashboard 中作为独立面板
 * - TracingPanel 中的扩展 Tab
 */

import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FireOutlined,
  LineChartOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  TagsOutlined
} from '@ant-design/icons'
import { Button, Card, Empty, Progress, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text } = Typography

// ==================== 类型定义 ====================

interface LearningStats {
  totalTags: number
  totalQueries: number
  totalFeedback: number
  pendingSuggestions: number
  topTags: Array<{ tag: string; weight: number; queryCount: number }>
}

interface SemanticSuggestion {
  sourceTag: string
  suggestedTag: string
  confidence: number
  discoveredAt: number
  confirmed: boolean
}

interface TagStats {
  queryCount: number
  positiveCount: number
  negativeCount: number
  lastQueryTime: number
  learnedWeight: number
}

// ==================== 组件属性 ====================

interface LearningProgressPanelProps {
  /** 最大高度 */
  maxHeight?: number
  /** 是否紧凑模式 */
  compact?: boolean
}

// ==================== 组件实现 ====================

export const LearningProgressPanel: FC<LearningProgressPanelProps> = ({
  maxHeight = 600,
  compact = false
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [suggestions, setSuggestions] = useState<SemanticSuggestion[]>([])
  const [selectedTagStats, setSelectedTagStats] = useState<{ tag: string; stats: TagStats } | null>(null)

  // 加载学习统计
  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.integratedMemory?.getStats?.()
      if (result?.success && result.stats?.learningStats) {
        setStats(result.stats.learningStats)
      }
    } catch (error) {
      console.error('Failed to load learning stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载待确认建议
  const loadSuggestions = useCallback(async () => {
    try {
      const result = await window.api.integratedMemory?.getPendingSuggestions?.()
      if (result?.success && result.suggestions) {
        setSuggestions(result.suggestions)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }, [])

  // 加载标签详细统计
  const loadTagStats = useCallback(async (tag: string) => {
    try {
      const result = await window.api.integratedMemory?.getTagStats?.({ tag })
      if (result?.success && result.stats) {
        setSelectedTagStats({ tag, stats: result.stats })
      }
    } catch (error) {
      console.error('Failed to load tag stats:', error)
    }
  }, [])

  // 确认建议
  const handleConfirmSuggestion = useCallback(async (sourceTag: string, suggestedTag: string) => {
    try {
      const result = await window.api.integratedMemory?.confirmSuggestion?.({ sourceTag, suggestedTag })
      if (result?.success) {
        // 重新加载建议列表
        loadSuggestions()
        window.toast?.success?.(t('vcp.learning.suggestion_confirmed', '已确认语义关联'))
      }
    } catch (error) {
      console.error('Failed to confirm suggestion:', error)
    }
  }, [loadSuggestions, t])

  // 初始化加载
  useEffect(() => {
    loadStats()
    loadSuggestions()
  }, [loadStats, loadSuggestions])

  // 定时刷新 (30秒)
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadStats])

  // 建议表格列定义
  const suggestionColumns: ColumnsType<SemanticSuggestion> = [
    {
      title: t('vcp.learning.source_tag', '源标签'),
      dataIndex: 'sourceTag',
      key: 'sourceTag',
      render: (tag: string) => <Tag color="blue">{tag}</Tag>
    },
    {
      title: t('vcp.learning.suggested_tag', '建议关联'),
      dataIndex: 'suggestedTag',
      key: 'suggestedTag',
      render: (tag: string) => <Tag color="green">{tag}</Tag>
    },
    {
      title: t('vcp.learning.confidence', '置信度'),
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress
          percent={Math.round(confidence * 100)}
          size="small"
          status={confidence > 0.7 ? 'success' : confidence > 0.4 ? 'normal' : 'exception'}
        />
      )
    },
    {
      title: t('vcp.learning.discovered_at', '发现时间'),
      dataIndex: 'discoveredAt',
      key: 'discoveredAt',
      render: (timestamp: number) => new Date(timestamp).toLocaleString()
    },
    {
      title: t('vcp.learning.actions', '操作'),
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('vcp.learning.confirm', '确认')}>
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#52c41a' }}
              onClick={() => handleConfirmSuggestion(record.sourceTag, record.suggestedTag)}
            />
          </Tooltip>
          <Tooltip title={t('vcp.learning.dismiss', '忽略')}>
            <Button
              type="text"
              size="small"
              icon={<CloseCircleOutlined />}
              style={{ color: '#ff4d4f' }}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  if (loading && !stats) {
    return (
      <Container $maxHeight={maxHeight}>
        <LoadingContainer>
          <Spin size="large" tip={t('vcp.learning.loading', '加载学习数据...')} />
        </LoadingContainer>
      </Container>
    )
  }

  return (
    <Container $maxHeight={maxHeight}>
      {/* 头部 */}
      <Header>
        <Title level={5} style={{ margin: 0 }}>
          <BulbOutlined style={{ marginRight: 8 }} />
          {t('vcp.learning.title', '学习进度')}
        </Title>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          size="small"
          onClick={() => { loadStats(); loadSuggestions() }}
          loading={loading}>
          {t('common.refresh', '刷新')}
        </Button>
      </Header>

      {/* 统计概览 */}
      {stats && (
        <StatsGrid $compact={compact}>
          <StatCard>
            <Statistic
              title={t('vcp.learning.total_tags', '已学习标签')}
              value={stats.totalTags}
              prefix={<TagsOutlined />}
            />
          </StatCard>
          <StatCard>
            <Statistic
              title={t('vcp.learning.total_queries', '查询次数')}
              value={stats.totalQueries}
              prefix={<LineChartOutlined />}
            />
          </StatCard>
          <StatCard>
            <Statistic
              title={t('vcp.learning.total_feedback', '反馈次数')}
              value={stats.totalFeedback}
              prefix={<FireOutlined />}
            />
          </StatCard>
          <StatCard>
            <Statistic
              title={t('vcp.learning.pending_suggestions', '待确认关联')}
              value={stats.pendingSuggestions}
              prefix={<NodeIndexOutlined />}
              valueStyle={{ color: stats.pendingSuggestions > 0 ? '#faad14' : undefined }}
            />
          </StatCard>
        </StatsGrid>
      )}

      {/* 热门标签 */}
      {stats?.topTags && stats.topTags.length > 0 && (
        <SectionCard>
          <SectionTitle>
            <FireOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
            {t('vcp.learning.top_tags', '热门标签')}
          </SectionTitle>
          <TagList>
            {stats.topTags.map((item) => (
              <TagItem
                key={item.tag}
                onClick={() => loadTagStats(item.tag)}
                $selected={selectedTagStats?.tag === item.tag}>
                <Tag color="processing">{item.tag}</Tag>
                <TagMeta>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('vcp.learning.weight', '权重')}: {item.weight.toFixed(2)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('vcp.learning.query_count', '查询')}: {item.queryCount}
                  </Text>
                </TagMeta>
                <Progress
                  percent={Math.min(100, item.weight * 100)}
                  showInfo={false}
                  size="small"
                  strokeColor={item.weight > 0.7 ? '#52c41a' : item.weight > 0.3 ? '#1890ff' : '#faad14'}
                />
              </TagItem>
            ))}
          </TagList>
        </SectionCard>
      )}

      {/* 选中标签的详细统计 */}
      {selectedTagStats && (
        <SectionCard>
          <SectionTitle>
            <TagsOutlined style={{ marginRight: 8 }} />
            {t('vcp.learning.tag_details', '标签详情')}: <Tag color="blue">{selectedTagStats.tag}</Tag>
          </SectionTitle>
          <TagDetailsGrid>
            <div>
              <Text type="secondary">{t('vcp.learning.positive_feedback', '正向反馈')}:</Text>
              <Text strong style={{ color: '#52c41a' }}> {selectedTagStats.stats.positiveCount}</Text>
            </div>
            <div>
              <Text type="secondary">{t('vcp.learning.negative_feedback', '负向反馈')}:</Text>
              <Text strong style={{ color: '#ff4d4f' }}> {selectedTagStats.stats.negativeCount}</Text>
            </div>
            <div>
              <Text type="secondary">{t('vcp.learning.learned_weight', '学习权重')}:</Text>
              <Text strong> {selectedTagStats.stats.learnedWeight.toFixed(3)}</Text>
            </div>
            <div>
              <Text type="secondary">{t('vcp.learning.last_query', '最后查询')}:</Text>
              <Text> {new Date(selectedTagStats.stats.lastQueryTime).toLocaleString()}</Text>
            </div>
          </TagDetailsGrid>
        </SectionCard>
      )}

      {/* 待确认的语义关联 */}
      <SectionCard>
        <SectionTitle>
          <NodeIndexOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          {t('vcp.learning.semantic_suggestions', '语义关联建议')}
          {suggestions.length > 0 && (
            <Tag color="warning" style={{ marginLeft: 8 }}>{suggestions.length}</Tag>
          )}
        </SectionTitle>
        {suggestions.length > 0 ? (
          <Table
            dataSource={suggestions}
            columns={suggestionColumns}
            rowKey={(record) => `${record.sourceTag}-${record.suggestedTag}`}
            pagination={false}
            size="small"
          />
        ) : (
          <Empty
            description={t('vcp.learning.no_suggestions', '暂无待确认的语义关联')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </SectionCard>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div<{ $maxHeight: number }>`
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  overflow-y: auto;
  padding: 16px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const StatsGrid = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: repeat(${({ $compact }) => ($compact ? 2 : 4)}, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`

const StatCard = styled(Card)`
  .ant-statistic-title {
    font-size: 12px;
    color: var(--color-text-2);
  }
  .ant-statistic-content {
    font-size: 20px;
  }
`

const SectionCard = styled(Card)`
  margin-bottom: 16px;

  .ant-card-body {
    padding: 12px 16px;
  }
`

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
`

const TagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const TagItem = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: ${({ $selected }) => ($selected ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${({ $selected }) => ($selected ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background: var(--color-background-mute);
  }

  .ant-progress {
    width: 100px;
    margin-left: auto;
  }
`

const TagMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const TagDetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`

// ==================== 导出 ====================

export default LearningProgressPanel
