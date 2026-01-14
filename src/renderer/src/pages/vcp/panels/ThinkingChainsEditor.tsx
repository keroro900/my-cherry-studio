/**
 * Thinking Chains Editor - 思维链编辑器
 *
 * 功能:
 * - 查看预定义思维链
 * - 可视化链结构
 * - 测试思维链执行
 * - 查看簇定义和提示词
 *
 * @created Phase 6 - 添加缺失的 AdminPanel 功能
 */

import {
  BranchesOutlined,
  BulbOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  EyeOutlined,
  NodeIndexOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import {
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { type FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('ThinkingChainsEditor')

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

// ==================== 类型定义 ====================

interface ChainPhase {
  name: string
  prompt: string
  minSteps?: number
  maxSteps?: number
}

interface PredefinedChain {
  id: string
  name: string
  description: string
  phases: ChainPhase[]
}

interface VCPChain {
  id: string
  clusters: string[]
  kSequence: number[]
  description: string
}

interface ClusterDefinition {
  id: string
  prompt: string
  description: string
}

// ==================== 预定义数据 ====================

/**
 * VCP 元思考簇定义
 */
const VCP_THINKING_CLUSTERS: Record<string, ClusterDefinition> = {
  前思维簇: {
    id: '前思维簇',
    prompt: '在开始正式推理之前，先感知和捕捉与问题相关的直觉、联想和初步印象...',
    description: '直觉捕捉和初步感知'
  },
  逻辑推理簇: {
    id: '逻辑推理簇',
    prompt: '运用逻辑推理分析问题的各个方面，建立因果关系和论证链条...',
    description: '结构化逻辑分析'
  },
  反思簇: {
    id: '反思簇',
    prompt: '审视之前的推理过程，检查是否存在盲点、偏见或逻辑漏洞...',
    description: '自我审视与纠偏'
  },
  结果辩证簇: {
    id: '结果辩证簇',
    prompt: '从多个角度审视结论，考虑反面论点和替代解释...',
    description: '辩证性综合评估'
  },
  陈词总结梳理簇: {
    id: '陈词总结梳理簇',
    prompt: '将思考过程的关键洞见进行整合，形成清晰、有条理的结论...',
    description: '整合与结论输出'
  }
}

/**
 * VCP 风格预定义链
 */
const VCP_PREDEFINED_CHAINS: VCPChain[] = [
  {
    id: 'default',
    clusters: ['前思维簇', '逻辑推理簇', '反思簇', '结果辩证簇', '陈词总结梳理簇'],
    kSequence: [2, 1, 1, 1, 1],
    description: '标准五阶段元思考链'
  },
  {
    id: 'quick',
    clusters: ['逻辑推理簇', '陈词总结梳理簇'],
    kSequence: [1, 1],
    description: '快速推理链'
  },
  {
    id: 'deep',
    clusters: ['前思维簇', '逻辑推理簇', '反思簇', '逻辑推理簇', '结果辩证簇', '反思簇', '陈词总结梳理簇'],
    kSequence: [2, 2, 1, 2, 1, 1, 2],
    description: '深度递归推理链'
  },
  {
    id: 'creative',
    clusters: ['前思维簇', '前思维簇', '逻辑推理簇', '结果辩证簇', '陈词总结梳理簇'],
    kSequence: [3, 2, 1, 1, 1],
    description: '创意发散链'
  }
]

/**
 * 标准预定义链
 */
const PREDEFINED_CHAINS: PredefinedChain[] = [
  {
    id: 'deep_analysis',
    name: '深度分析',
    description: '多角度深入分析问题',
    phases: [
      { name: 'observe', prompt: '首先，观察和收集相关信息...', minSteps: 1 },
      { name: 'analyze', prompt: '现在，分析这些信息的关系和模式...', minSteps: 2 },
      { name: 'hypothesize', prompt: '基于分析，提出可能的假设...', minSteps: 1 },
      { name: 'verify', prompt: '验证这些假设的合理性...', minSteps: 1 },
      { name: 'conclude', prompt: '综合以上分析，得出结论...', minSteps: 1 }
    ]
  },
  {
    id: 'problem_solving',
    name: '问题解决',
    description: '结构化解决复杂问题',
    phases: [
      { name: 'define', prompt: '明确定义问题是什么...' },
      { name: 'decompose', prompt: '将问题分解为子问题...' },
      { name: 'explore', prompt: '探索每个子问题的解决方案...' },
      { name: 'synthesize', prompt: '整合各部分解决方案...' },
      { name: 'validate', prompt: '验证整体解决方案的有效性...' }
    ]
  },
  {
    id: 'creative_thinking',
    name: '创意思考',
    description: '发散性创意生成',
    phases: [
      { name: 'diverge', prompt: '尽可能多地产生想法，不要评判...' },
      { name: 'connect', prompt: '寻找不同想法之间的联系...' },
      { name: 'transform', prompt: '转换和组合想法...' },
      { name: 'converge', prompt: '筛选和优化最佳想法...' }
    ]
  },
  {
    id: 'critical_thinking',
    name: '批判性思考',
    description: '严格审视和评估论点',
    phases: [
      { name: 'identify', prompt: '识别主要论点和假设...' },
      { name: 'question', prompt: '质疑这些假设的合理性...' },
      { name: 'evidence', prompt: '评估支持证据的质量...' },
      { name: 'alternative', prompt: '考虑替代解释...' },
      { name: 'judgment', prompt: '做出平衡的判断...' }
    ]
  },
  {
    id: 'reflection',
    name: '反思',
    description: '反思和改进思考过程',
    phases: [
      { name: 'review', prompt: '回顾刚才的思考过程...' },
      { name: 'identify_gaps', prompt: '识别遗漏或不足...' },
      { name: 'improve', prompt: '提出改进建议...' }
    ]
  }
]

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

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`

const ChainCard = styled(Card)`
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--color-primary);
  }

  .ant-card-head {
    min-height: 40px;
    padding: 0 16px;
  }

  .ant-card-body {
    padding: 16px;
  }
`

const ClusterBadge = styled(Badge)`
  .ant-badge-count {
    background: var(--color-primary);
  }
`

const PhaseTag = styled(Tag)<{ $index: number }>`
  margin: 4px;
  background: ${(props) =>
    ['#f0f5ff', '#e6fffb', '#fff7e6', '#fff1f0', '#f6ffed', '#fcf4dc'][props.$index % 6]};
  border-color: ${(props) =>
    ['#1890ff', '#13c2c2', '#faad14', '#f5222d', '#52c41a', '#d48806'][props.$index % 6]};
  color: ${(props) => ['#1890ff', '#13c2c2', '#faad14', '#f5222d', '#52c41a', '#d48806'][props.$index % 6]};
`

const FlowVisualization = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-top: 12px;
`

const FlowStep = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: ${(props) => props.$color}20;
  border: 1px solid ${(props) => props.$color};
  border-radius: 16px;
  font-size: 13px;
  color: ${(props) => props.$color};
`

const FlowArrow = styled.div`
  color: var(--color-text-3);
  font-size: 16px;
`

// ==================== 主组件 ====================

const ThinkingChainsEditor: FC = () => {
  const { t } = useTranslation()

  // 状态
  const [activeTab, setActiveTab] = useState('standard')
  const [selectedChain, setSelectedChain] = useState<PredefinedChain | VCPChain | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [testModalVisible, setTestModalVisible] = useState(false)
  const [testTopic, setTestTopic] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // 查看链详情
  const handleViewChain = useCallback((chain: PredefinedChain | VCPChain) => {
    setSelectedChain(chain)
    setDetailModalVisible(true)
  }, [])

  // 测试链
  const handleTestChain = useCallback((chain: PredefinedChain | VCPChain) => {
    setSelectedChain(chain)
    setTestTopic('')
    setTestResult(null)
    setTestModalVisible(true)
  }, [])

  // 执行测试
  const executeTest = useCallback(async () => {
    if (!testTopic.trim() || !selectedChain) {
      message.warning('请输入测试主题')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // 通过 vcpTool 执行 MetaThinking
      const result = await window.api.vcpTool.execute('MetaThinking', 'Start', {
        topic: testTopic,
        chain: selectedChain.id
      })

      if (result.success) {
        setTestResult(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2))
        message.success('思维链启动成功')
      } else {
        setTestResult(`错误: ${result.error || '执行失败'}`)
      }
    } catch (error) {
      logger.error('Error testing chain', { error })
      setTestResult(`执行错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setTesting(false)
    }
  }, [testTopic, selectedChain])

  // 簇颜色映射
  const clusterColors: Record<string, string> = {
    前思维簇: '#722ed1',
    逻辑推理簇: '#1890ff',
    反思簇: '#fa8c16',
    结果辩证簇: '#eb2f96',
    陈词总结梳理簇: '#52c41a'
  }

  // 标准链表格列
  const standardColumns: ColumnsType<PredefinedChain> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string) => (
        <Space>
          <NodeIndexOutlined style={{ color: 'var(--color-primary)' }} />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200
    },
    {
      title: '阶段',
      dataIndex: 'phases',
      key: 'phases',
      render: (phases: ChainPhase[]) => (
        <Space wrap>
          {phases.map((phase, idx) => (
            <PhaseTag key={idx} $index={idx}>
              {phase.name}
            </PhaseTag>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: PredefinedChain) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewChain(record)} />
          </Tooltip>
          <Tooltip title="测试">
            <Button type="text" size="small" icon={<ExperimentOutlined />} onClick={() => handleTestChain(record)} />
          </Tooltip>
        </Space>
      )
    }
  ]

  // VCP链表格列
  const vcpColumns: ColumnsType<VCPChain> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Tag color="blue" icon={<BranchesOutlined />}>
          {id}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200
    },
    {
      title: '簇序列',
      dataIndex: 'clusters',
      key: 'clusters',
      render: (clusters: string[], record: VCPChain) => (
        <FlowVisualization>
          {clusters.map((cluster, idx) => (
            <>
              <FlowStep key={idx} $color={clusterColors[cluster] || '#666'}>
                <span>{cluster}</span>
                <ClusterBadge count={record.kSequence[idx]} size="small" />
              </FlowStep>
              {idx < clusters.length - 1 && <FlowArrow>→</FlowArrow>}
            </>
          ))}
        </FlowVisualization>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: VCPChain) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewChain(record)} />
          </Tooltip>
          <Tooltip title="测试">
            <Button type="text" size="small" icon={<ExperimentOutlined />} onClick={() => handleTestChain(record)} />
          </Tooltip>
        </Space>
      )
    }
  ]

  // 簇定义列
  const clusterColumns: ColumnsType<ClusterDefinition> = [
    {
      title: '簇名称',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id: string) => (
        <Tag color={clusterColors[id] || 'default'} icon={<ThunderboltOutlined />}>
          {id}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200
    },
    {
      title: '提示词',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (prompt: string) => (
        <Tooltip title={prompt}>
          <Text type="secondary" ellipsis>
            {prompt}
          </Text>
        </Tooltip>
      )
    }
  ]

  // Tab 项
  const tabItems = [
    {
      key: 'standard',
      label: (
        <Space>
          <NodeIndexOutlined />
          <span>标准思维链</span>
          <Badge count={PREDEFINED_CHAINS.length} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      ),
      children: (
        <Table
          columns={standardColumns}
          dataSource={PREDEFINED_CHAINS}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ y: 'calc(100vh - 280px)' }}
        />
      )
    },
    {
      key: 'vcp',
      label: (
        <Space>
          <BranchesOutlined />
          <span>VCP 元思考链</span>
          <Badge count={VCP_PREDEFINED_CHAINS.length} style={{ backgroundColor: '#722ed1' }} />
        </Space>
      ),
      children: (
        <Table
          columns={vcpColumns}
          dataSource={VCP_PREDEFINED_CHAINS}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ y: 'calc(100vh - 280px)' }}
        />
      )
    },
    {
      key: 'clusters',
      label: (
        <Space>
          <BulbOutlined />
          <span>思维簇定义</span>
          <Badge count={Object.keys(VCP_THINKING_CLUSTERS).length} style={{ backgroundColor: '#fa8c16' }} />
        </Space>
      ),
      children: (
        <Table
          columns={clusterColumns}
          dataSource={Object.values(VCP_THINKING_CLUSTERS)}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ y: 'calc(100vh - 280px)' }}
        />
      )
    }
  ]

  return (
    <PanelContainer>
      {/* 头部 */}
      <HeaderBar>
        <Space>
          <BranchesOutlined style={{ fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            思维链编辑器
          </Title>
        </Space>
        <Space>
          <Tooltip title="思维链帮助">
            <Button icon={<QuestionCircleOutlined />} type="text">
              帮助
            </Button>
          </Tooltip>
        </Space>
      </HeaderBar>

      {/* 内容区域 */}
      <ContentArea>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </ContentArea>

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            <NodeIndexOutlined />
            <span>思维链详情</span>
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="test"
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={() => {
              setDetailModalVisible(false)
              if (selectedChain) handleTestChain(selectedChain)
            }}>
            测试此链
          </Button>
        ]}
        width={700}>
        {selectedChain && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="ID">{selectedChain.id}</Descriptions.Item>
              <Descriptions.Item label="描述">
                {'description' in selectedChain ? selectedChain.description : '-'}
              </Descriptions.Item>
            </Descriptions>

            {'phases' in selectedChain ? (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  阶段流程
                </Title>
                <Steps
                  direction="vertical"
                  size="small"
                  current={-1}
                  items={(selectedChain as PredefinedChain).phases.map((phase, idx) => ({
                    title: phase.name,
                    description: (
                      <div>
                        <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                          {phase.prompt}
                        </Paragraph>
                        {phase.minSteps && <Tag>最少 {phase.minSteps} 步</Tag>}
                      </div>
                    ),
                    icon: <CaretRightOutlined style={{ color: ['#1890ff', '#13c2c2', '#faad14', '#f5222d', '#52c41a'][idx % 5] }} />
                  }))}
                />
              </>
            ) : (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  簇序列
                </Title>
                <Timeline
                  items={(selectedChain as VCPChain).clusters.map((cluster, idx) => ({
                    color: clusterColors[cluster] || 'gray',
                    children: (
                      <div>
                        <Space>
                          <Tag color={clusterColors[cluster]}>{cluster}</Tag>
                          <Badge count={(selectedChain as VCPChain).kSequence[idx]} style={{ backgroundColor: '#52c41a' }} />
                        </Space>
                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                          {VCP_THINKING_CLUSTERS[cluster]?.description || '-'}
                        </Paragraph>
                      </div>
                    )
                  }))}
                />
              </>
            )}
          </>
        )}
      </Modal>

      {/* 测试弹窗 */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined />
            <span>测试思维链</span>
          </Space>
        }
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTestModalVisible(false)}>
            关闭
          </Button>,
          <Button key="run" type="primary" icon={<RocketOutlined />} loading={testing} onClick={executeTest}>
            执行测试
          </Button>
        ]}
        width={600}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>当前链: </Text>
            <Tag color="blue">{selectedChain?.id}</Tag>
          </div>

          <div>
            <Text strong>测试主题:</Text>
            <TextArea
              value={testTopic}
              onChange={(e) => setTestTopic(e.target.value)}
              placeholder="输入一个需要深入思考的主题，例如：如何提高代码质量？"
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>

          {testResult && (
            <div>
              <Text strong>执行结果:</Text>
              <Card size="small" style={{ marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{testResult}</pre>
              </Card>
            </div>
          )}
        </Space>
      </Modal>
    </PanelContainer>
  )
}

export default ThinkingChainsEditor
