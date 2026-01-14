/**
 * TagMemoPanel - TagMemo 统计面板
 *
 * 功能:
 * - PMI 矩阵可视化 (热门标签关联热力图)
 * - 热门 Tag Top-K 展示
 * - 共现关系网络图 (简化为关联列表)
 * - 标签扩展测试
 *
 * 使用场景:
 * - VCPDashboard 中作为独立面板
 * - TracingPanel 中的扩展 Tab
 */

import {
  ApiOutlined,
  ExpandOutlined,
  FireOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text } = Typography

// ==================== 类型定义 ====================

interface TagMemoStats {
  tagCount: number
  pairCount: number
  totalUpdates: number
  alpha: number
  beta: number
}

interface TagAssociation {
  tag: string
  pmi: number
  count: number
}

interface HeatmapCell {
  source: string
  target: string
  pmi: number
  count: number
}

// ==================== 组件属性 ====================

interface TagMemoPanelProps {
  /** 最大高度 */
  maxHeight?: number
  /** 是否紧凑模式 */
  compact?: boolean
}

// ==================== 组件实现 ====================

export const TagMemoPanel: FC<TagMemoPanelProps> = ({ maxHeight = 600, compact = false }) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TagMemoStats | null>(null)
  const [topTags, setTopTags] = useState<string[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [associations, setAssociations] = useState<TagAssociation[]>([])
  const [searchTag, setSearchTag] = useState('')
  const [expandInput, setExpandInput] = useState('')
  const [expandedTags, setExpandedTags] = useState<string[]>([])
  const [expandLoading, setExpandLoading] = useState(false)

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('vcp:native:tagmemo:stats')
      if (result?.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Failed to load TagMemo stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取热门标签 (通过关联数量推断)
  const loadTopTags = useCallback(async () => {
    try {
      // 通过 integrated-memory IPC 获取学习统计
      const result = await window.electron.ipcRenderer.invoke('integrated-memory:get-stats')
      if (result?.success && result.stats?.learningStats?.topTags) {
        const tags = result.stats.learningStats.topTags.map((t: { tag: string }) => t.tag).slice(0, 10)
        setTopTags(tags)
        // 为每个热门标签获取关联，构建热力图
        await loadHeatmapData(tags)
      }
    } catch (error) {
      console.error('Failed to load top tags:', error)
    }
  }, [])

  // 构建热力图数据
  const loadHeatmapData = useCallback(async (tags: string[]) => {
    try {
      const cells: HeatmapCell[] = []

      for (const tag of tags.slice(0, 8)) {
        // 限制 8 个以避免太多请求
        const result = await window.electron.ipcRenderer.invoke('vcp:native:tagmemo:associations', tag, 5)
        if (result?.success && result.data) {
          for (const assoc of result.data) {
            cells.push({
              source: tag,
              target: assoc.tag,
              pmi: assoc.pmi,
              count: assoc.count
            })
          }
        }
      }

      setHeatmapData(cells)
    } catch (error) {
      console.error('Failed to load heatmap data:', error)
    }
  }, [])

  // 获取标签关联
  const loadAssociations = useCallback(async (tag: string) => {
    setSelectedTag(tag)
    try {
      const result = await window.electron.ipcRenderer.invoke('vcp:native:tagmemo:associations', tag, 20)
      if (result?.success && result.data) {
        setAssociations(result.data)
      } else {
        setAssociations([])
      }
    } catch (error) {
      console.error('Failed to load associations:', error)
      setAssociations([])
    }
  }, [])

  // 搜索标签关联
  const handleSearchTag = useCallback(async () => {
    if (!searchTag.trim()) return
    await loadAssociations(searchTag.trim())
  }, [searchTag, loadAssociations])

  // 测试标签扩展
  const handleExpandTags = useCallback(async () => {
    if (!expandInput.trim()) return
    setExpandLoading(true)
    try {
      const inputTags = expandInput.split(/[,，\s]+/).filter(Boolean)
      const result = await window.electron.ipcRenderer.invoke('vcp:native:tagmemo:expand', inputTags, 2.0)
      if (result?.success && result.data) {
        setExpandedTags(result.data)
      } else {
        setExpandedTags(inputTags) // 回退到原始标签
      }
    } catch (error) {
      console.error('Failed to expand tags:', error)
    } finally {
      setExpandLoading(false)
    }
  }, [expandInput])

  // 初始化
  useEffect(() => {
    loadStats()
    loadTopTags()
  }, [loadStats, loadTopTags])

  // 定时刷新 (60秒)
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats()
    }, 60000)
    return () => clearInterval(interval)
  }, [loadStats])

  // 关联表格列定义
  const associationColumns: ColumnsType<TagAssociation> = [
    {
      title: t('vcp.tagmemo.associated_tag', '关联标签'),
      dataIndex: 'tag',
      key: 'tag',
      render: (tag: string) => (
        <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => loadAssociations(tag)}>
          {tag}
        </Tag>
      )
    },
    {
      title: t('vcp.tagmemo.pmi_score', 'PMI 分数'),
      dataIndex: 'pmi',
      key: 'pmi',
      width: 120,
      render: (pmi: number) => (
        <Tooltip title={`PMI: ${pmi.toFixed(4)}`}>
          <Progress
            percent={Math.min(100, Math.max(0, (pmi + 5) * 10))} // 将 PMI (-5 到 5) 映射到 0-100
            size="small"
            strokeColor={pmi > 2 ? '#52c41a' : pmi > 0 ? '#1890ff' : '#faad14'}
            format={() => pmi.toFixed(2)}
          />
        </Tooltip>
      )
    },
    {
      title: t('vcp.tagmemo.co_occurrence', '共现次数'),
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => <Badge count={count} showZero color="blue" />
    }
  ]

  // 热力图表格列定义
  const heatmapColumns: ColumnsType<HeatmapCell> = [
    {
      title: t('vcp.tagmemo.source', '源标签'),
      dataIndex: 'source',
      key: 'source',
      render: (tag: string) => <Tag color="cyan">{tag}</Tag>
    },
    {
      title: t('vcp.tagmemo.target', '目标标签'),
      dataIndex: 'target',
      key: 'target',
      render: (tag: string) => <Tag color="green">{tag}</Tag>
    },
    {
      title: 'PMI',
      dataIndex: 'pmi',
      key: 'pmi',
      width: 100,
      render: (pmi: number) => (
        <HeatCell $intensity={Math.min(1, Math.max(0, (pmi + 3) / 6))}>{pmi.toFixed(2)}</HeatCell>
      ),
      sorter: (a, b) => b.pmi - a.pmi
    },
    {
      title: t('vcp.tagmemo.count', '次数'),
      dataIndex: 'count',
      key: 'count',
      width: 80,
      sorter: (a, b) => b.count - a.count
    }
  ]

  if (loading && !stats) {
    return (
      <Container $maxHeight={maxHeight}>
        <LoadingContainer>
          <Spin size="large" tip={t('vcp.tagmemo.loading', '加载 TagMemo 数据...')} />
        </LoadingContainer>
      </Container>
    )
  }

  return (
    <Container $maxHeight={maxHeight}>
      {/* 头部 */}
      <Header>
        <Title level={5} style={{ margin: 0 }}>
          <NodeIndexOutlined style={{ marginRight: 8 }} />
          {t('vcp.tagmemo.title', 'TagMemo 统计')}
        </Title>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          size="small"
          onClick={() => {
            loadStats()
            loadTopTags()
          }}
          loading={loading}>
          {t('common.refresh', '刷新')}
        </Button>
      </Header>

      {/* 统计概览 */}
      {stats && (
        <StatsGrid $compact={compact}>
          <StatCard>
            <Statistic title={t('vcp.tagmemo.tag_count', '标签数量')} value={stats.tagCount} prefix={<TagsOutlined />} />
          </StatCard>
          <StatCard>
            <Statistic
              title={t('vcp.tagmemo.pair_count', '标签对数量')}
              value={stats.pairCount}
              prefix={<ApiOutlined />}
            />
          </StatCard>
          <StatCard>
            <Statistic
              title={t('vcp.tagmemo.total_updates', '更新次数')}
              value={stats.totalUpdates}
              prefix={<FireOutlined />}
            />
          </StatCard>
          <StatCard>
            <Tooltip title={`α=${stats.alpha.toFixed(2)}, β=${stats.beta.toFixed(2)}`}>
              <Statistic
                title={t('vcp.tagmemo.decay_params', '衰减参数')}
                value={`α:${stats.alpha.toFixed(1)} β:${stats.beta.toFixed(1)}`}
                valueStyle={{ fontSize: 16 }}
              />
            </Tooltip>
          </StatCard>
        </StatsGrid>
      )}

      <Row gutter={16}>
        {/* 左侧：热门标签 */}
        <Col span={compact ? 24 : 8}>
          <SectionCard>
            <SectionTitle>
              <FireOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
              {t('vcp.tagmemo.hot_tags', '热门标签')}
            </SectionTitle>
            {topTags.length > 0 ? (
              <List
                size="small"
                dataSource={topTags}
                renderItem={(tag, index) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => loadAssociations(tag)}
                    actions={[
                      <Badge
                        key="rank"
                        count={index + 1}
                        style={{
                          backgroundColor: index < 3 ? '#ff4d4f' : index < 6 ? '#faad14' : '#52c41a'
                        }}
                      />
                    ]}>
                    <Tag color={selectedTag === tag ? 'processing' : 'default'}>{tag}</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description={t('vcp.tagmemo.no_tags', '暂无标签数据')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </SectionCard>
        </Col>

        {/* 右侧：关联详情或热力图 */}
        <Col span={compact ? 24 : 16}>
          {/* 搜索标签 */}
          <SectionCard>
            <SectionTitle>
              <SearchOutlined style={{ marginRight: 8 }} />
              {t('vcp.tagmemo.search_associations', '查询标签关联')}
            </SectionTitle>
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input
                placeholder={t('vcp.tagmemo.search_placeholder', '输入标签名称...')}
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                onPressEnter={handleSearchTag}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearchTag}>
                {t('common.search', '搜索')}
              </Button>
            </Space.Compact>

            {selectedTag && (
              <>
                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                  {t('vcp.tagmemo.associations_for', '标签关联')}: <Tag color="blue">{selectedTag}</Tag>
                </Text>
                {associations.length > 0 ? (
                  <Table
                    dataSource={associations}
                    columns={associationColumns}
                    rowKey="tag"
                    pagination={false}
                    size="small"
                    scroll={{ y: 200 }}
                  />
                ) : (
                  <Empty
                    description={t('vcp.tagmemo.no_associations', '该标签暂无关联数据')}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </>
            )}
          </SectionCard>

          {/* 标签扩展测试 */}
          <SectionCard>
            <SectionTitle>
              <ExpandOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              {t('vcp.tagmemo.expand_test', '标签扩展测试')}
            </SectionTitle>
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input
                placeholder={t('vcp.tagmemo.expand_placeholder', '输入标签，用逗号分隔...')}
                value={expandInput}
                onChange={(e) => setExpandInput(e.target.value)}
                onPressEnter={handleExpandTags}
              />
              <Button type="primary" icon={<ExpandOutlined />} onClick={handleExpandTags} loading={expandLoading}>
                {t('vcp.tagmemo.expand', '扩展')}
              </Button>
            </Space.Compact>

            {expandedTags.length > 0 && (
              <ExpandResult>
                <Text type="secondary" style={{ marginRight: 8 }}>
                  {t('vcp.tagmemo.expanded_result', '扩展结果')}:
                </Text>
                {expandedTags.map((tag, idx) => (
                  <Tag
                    key={idx}
                    color={
                      expandInput
                        .split(/[,，\s]+/)
                        .filter(Boolean)
                        .includes(tag)
                        ? 'blue'
                        : 'green'
                    }>
                    {tag}
                  </Tag>
                ))}
              </ExpandResult>
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* PMI 热力图 (表格形式) */}
      {heatmapData.length > 0 && !compact && (
        <SectionCard>
          <SectionTitle>
            <ApiOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            {t('vcp.tagmemo.pmi_heatmap', 'PMI 关联热力图')}
            <Tag color="purple" style={{ marginLeft: 8 }}>
              Top {Math.min(heatmapData.length, 50)}
            </Tag>
          </SectionTitle>
          <Table
            dataSource={heatmapData.slice(0, 50)}
            columns={heatmapColumns}
            rowKey={(record) => `${record.source}-${record.target}`}
            pagination={{ pageSize: 10, size: 'small' }}
            size="small"
          />
        </SectionCard>
      )}
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

const HeatCell = styled.div<{ $intensity: number }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ $intensity }) => {
    // 从蓝色渐变到红色
    const r = Math.round(255 * $intensity)
    const b = Math.round(255 * (1 - $intensity))
    return `rgba(${r}, 100, ${b}, 0.2)`
  }};
  color: ${({ $intensity }) => ($intensity > 0.5 ? '#ff4d4f' : '#1890ff')};
`

const ExpandResult = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
`

// ==================== 导出 ====================

export default TagMemoPanel
