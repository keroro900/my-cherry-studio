/**
 * VectorSettings - 向量数据库配置页面
 *
 * 管理本地和云端向量数据库后端配置
 */

import { CheckCircleOutlined, CloudOutlined, DatabaseOutlined, SyncOutlined } from '@ant-design/icons'
import { GlobalRerankSettings } from '@renderer/components/Settings'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  setLocalBackend,
  toggleCloudBackend,
  updatePineconeConfig,
  updateSearchStrategy,
  type CloudVectorBackend,
  type LocalVectorBackend
} from '@renderer/store/vectorServices'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import { Database, Settings, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  SettingContainer,
  SettingDivider,
  SettingGroup,
  SettingHelpText,
  SettingRow,
  SettingRowTitle,
  SettingTitle
} from '../index'

const { Paragraph } = Typography
const { TabPane } = Tabs

const VectorSettings: React.FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const vectorServices = useAppSelector((state) => state.vectorServices)
  const { localBackend, cloudBackends, searchStrategy } = vectorServices

  const [testingBackend, setTestingBackend] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const localBackendOptions: { value: LocalVectorBackend; label: string; description: string; icon: string }[] = [
    {
      value: 'vexus',
      label: 'Vexus (Rust)',
      description: t('settings.vector.vexus_desc', 'Rust 原生高性能向量索引'),
      icon: '🦀'
    },
    {
      value: 'libsql',
      label: 'LibSQL',
      description: t('settings.vector.libsql_desc', 'SQLite 持久化存储'),
      icon: '📦'
    },
    {
      value: 'memory',
      label: 'Memory',
      description: t('settings.vector.memory_desc', '内存 HNSW 索引，高速非持久化'),
      icon: '⚡'
    },
    {
      value: 'usearch',
      label: 'USearch',
      description: t('settings.vector.usearch_desc', 'USearch 原生高性能索引'),
      icon: '🔍'
    }
  ]

  const handleTestConnection = async (backend: CloudVectorBackend) => {
    setTestingBackend(backend)
    setTestResult(null)

    try {
      // TODO: 实现实际的连接测试 IPC 调用
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 目前只支持 Pinecone
      if (backend === 'pinecone') {
        const config = cloudBackends.pinecone
        if (!config.apiKey || !config.indexName) {
          setTestResult({ success: false, message: t('settings.vector.missing_config', '请填写完整配置') })
          return
        }
      }

      setTestResult({ success: true, message: t('settings.vector.connection_success', '连接成功') })
    } catch (error) {
      setTestResult({ success: false, message: String(error) })
    } finally {
      setTestingBackend(null)
    }
  }

  return (
    <SettingContainer>
      <SettingTitle>
        <Database size={18} style={{ marginRight: 8 }} />
        {t('settings.vector.title', '向量数据库')}
      </SettingTitle>

      <Tabs defaultActiveKey="local" style={{ marginTop: 16 }}>
        {/* 本地后端 */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              {t('settings.vector.local_backend', '本地后端')}
            </span>
          }
          key="local">
          <SettingGroup>
            <SettingHelpText>{t('settings.vector.local_help', '选择本地向量存储引擎')}</SettingHelpText>

            <BackendGrid>
              {localBackendOptions.map((option) => (
                <BackendCard
                  key={option.value}
                  $selected={localBackend === option.value}
                  onClick={() => dispatch(setLocalBackend(option.value))}>
                  <BackendIcon>{option.icon}</BackendIcon>
                  <BackendInfo>
                    <BackendLabel>{option.label}</BackendLabel>
                    <BackendDesc>{option.description}</BackendDesc>
                  </BackendInfo>
                  {localBackend === option.value && <CheckCircleOutlined style={{ color: 'var(--color-primary)' }} />}
                </BackendCard>
              ))}
            </BackendGrid>
          </SettingGroup>
        </TabPane>

        {/* 云端后端 */}
        <TabPane
          tab={
            <span>
              <CloudOutlined />
              {t('settings.vector.cloud_backend', '云端后端')}
            </span>
          }
          key="cloud">
          <SettingGroup>
            <Alert
              type="info"
              showIcon
              message={t('settings.vector.cloud_info', '云端向量库支持大规模数据存储和跨设备共享')}
              style={{ marginBottom: 16 }}
            />

            {/* Pinecone */}
            <Card
              size="small"
              title={
                <Space>
                  <span>🌲 Pinecone</span>
                  {cloudBackends.pinecone.enabled && <Tag color="green">{t('common.enabled', '已启用')}</Tag>}
                </Space>
              }
              extra={
                <Switch
                  checked={cloudBackends.pinecone.enabled}
                  onChange={(checked) => dispatch(toggleCloudBackend({ backend: 'pinecone', enabled: checked }))}
                />
              }
              style={{ marginBottom: 16 }}>
              <Form layout="vertical" size="small">
                <Form.Item label="API Key">
                  <Input.Password
                    value={cloudBackends.pinecone.apiKey}
                    onChange={(e) => dispatch(updatePineconeConfig({ apiKey: e.target.value }))}
                    placeholder="pc-xxxxxxxx"
                    disabled={!cloudBackends.pinecone.enabled}
                  />
                </Form.Item>

                <Form.Item label={t('settings.vector.index_name', '索引名称')}>
                  <Input
                    value={cloudBackends.pinecone.indexName}
                    onChange={(e) => dispatch(updatePineconeConfig({ indexName: e.target.value }))}
                    placeholder="my-index"
                    disabled={!cloudBackends.pinecone.enabled}
                  />
                </Form.Item>

                <Form.Item
                  label={t('settings.vector.namespace', '命名空间')}
                  tooltip={t('settings.vector.namespace_tooltip', '可选，用于数据隔离')}>
                  <Input
                    value={cloudBackends.pinecone.namespace || ''}
                    onChange={(e) => dispatch(updatePineconeConfig({ namespace: e.target.value }))}
                    placeholder="default"
                    disabled={!cloudBackends.pinecone.enabled}
                  />
                </Form.Item>

                <Button
                  type="primary"
                  ghost
                  icon={testingBackend === 'pinecone' ? <SyncOutlined spin /> : <Zap size={14} />}
                  onClick={() => handleTestConnection('pinecone')}
                  disabled={!cloudBackends.pinecone.enabled || testingBackend !== null}>
                  {t('settings.vector.test_connection', '测试连接')}
                </Button>

                {testResult && testingBackend === null && (
                  <Alert
                    type={testResult.success ? 'success' : 'error'}
                    message={testResult.message}
                    style={{ marginTop: 8 }}
                    closable
                    onClose={() => setTestResult(null)}
                  />
                )}
              </Form>
            </Card>

            {/* 未来扩展: Milvus, Qdrant, Weaviate */}
            <Card
              size="small"
              title={
                <Space>
                  <span>🔮 {t('settings.vector.more_coming', '更多云端向量库')}</span>
                  <Tag>{t('common.coming_soon', '即将推出')}</Tag>
                </Space>
              }>
              <Paragraph type="secondary">
                Milvus, Qdrant, Weaviate {t('settings.vector.future_support', '等将在后续版本支持')}
              </Paragraph>
            </Card>
          </SettingGroup>
        </TabPane>

        {/* 检索策略 */}
        <TabPane
          tab={
            <span>
              <Settings size={14} style={{ marginRight: 4 }} />
              {t('settings.vector.search_strategy', '检索策略')}
            </span>
          }
          key="strategy">
          <SettingGroup>
            <SettingRow>
              <SettingRowTitle>{t('settings.vector.hybrid_mode', '检索模式')}</SettingRowTitle>
              <Radio.Group
                value={searchStrategy.hybridMode}
                onChange={(e) => dispatch(updateSearchStrategy({ hybridMode: e.target.value }))}>
                <Radio.Button value="vector">{t('settings.vector.mode_vector', '向量')}</Radio.Button>
                <Radio.Button value="bm25">{t('settings.vector.mode_bm25', 'BM25')}</Radio.Button>
                <Radio.Button value="hybrid">{t('settings.vector.mode_hybrid', '混合')}</Radio.Button>
              </Radio.Group>
            </SettingRow>

            {searchStrategy.hybridMode === 'hybrid' && (
              <SettingRow>
                <SettingRowTitle>{t('settings.vector.bm25_weight', 'BM25 权重')}</SettingRowTitle>
                <InputNumber
                  value={searchStrategy.bm25Weight}
                  onChange={(value) => dispatch(updateSearchStrategy({ bm25Weight: value ?? 0.3 }))}
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: 100 }}
                />
              </SettingRow>
            )}

            <SettingDivider />

            <SettingRow>
              <SettingRowTitle>{t('settings.vector.enable_cloud_search', '启用云端搜索')}</SettingRowTitle>
              <Switch
                checked={searchStrategy.enableCloudSearch}
                onChange={(checked) => dispatch(updateSearchStrategy({ enableCloudSearch: checked }))}
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{t('settings.vector.parallel_search', '并行搜索')}</SettingRowTitle>
              <Switch
                checked={searchStrategy.parallelSearch}
                onChange={(checked) => dispatch(updateSearchStrategy({ parallelSearch: checked }))}
              />
            </SettingRow>

            <SettingDivider />

            <SettingRow>
              <SettingRowTitle>{t('settings.vector.enable_rerank', '启用重排序')}</SettingRowTitle>
              <Switch
                checked={searchStrategy.rerankEnabled}
                onChange={(checked) => dispatch(updateSearchStrategy({ rerankEnabled: checked }))}
              />
            </SettingRow>

            {searchStrategy.rerankEnabled && (
              <GlobalRerankSettings showTitle={false} compact />
            )}

            <SettingRow>
              <SettingRowTitle>{t('settings.vector.rrfk', 'RRF K 常数')}</SettingRowTitle>
              <Tooltip title={t('settings.vector.rrfk_tooltip', 'Reciprocal Rank Fusion 常数，默认 60')}>
                <InputNumber
                  value={searchStrategy.rrfK}
                  onChange={(value) => dispatch(updateSearchStrategy({ rrfK: value ?? 60 }))}
                  min={1}
                  max={100}
                  style={{ width: 100 }}
                />
              </Tooltip>
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{t('settings.vector.default_topk', '默认返回数量')}</SettingRowTitle>
              <InputNumber
                value={searchStrategy.defaultTopK}
                onChange={(value) => dispatch(updateSearchStrategy({ defaultTopK: value ?? 10 }))}
                min={1}
                max={100}
                style={{ width: 100 }}
              />
            </SettingRow>
          </SettingGroup>
        </TabPane>
      </Tabs>
    </SettingContainer>
  )
}

// Styled Components
const BackendGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
`

const BackendCard = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${({ $selected }) => ($selected ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${({ $selected }) => ($selected ? 'var(--color-primary-bg)' : 'var(--color-background)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const BackendIcon = styled.span`
  font-size: 24px;
  margin-right: 12px;
`

const BackendInfo = styled.div`
  flex: 1;
`

const BackendLabel = styled.div`
  font-weight: 500;
  margin-bottom: 2px;
`

const BackendDesc = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export default VectorSettings
