/**
 * VectorIndexStatus - 向量索引状态和重建组件
 *
 * 显示当前向量索引状态并提供重建功能:
 * - 当前索引维度
 * - 维度不匹配警告
 * - 重建索引按钮
 * - 索引健康状态
 */

import { loggerService } from '@logger'
import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { useProviders } from '@renderer/hooks/useProvider'
import { selectMemoryConfig, updateMemoryConfig } from '@renderer/store/memory'
import { SystemProviderIds } from '@renderer/types'
import { routeToEndpoint } from '@renderer/utils'
import { isAzureOpenAIProvider, isGeminiProvider } from '@renderer/utils/provider'
import { Alert, Button, Descriptions, Progress, Space, Spin, Tag } from 'antd'
import { AlertCircle, CheckCircle, Database, RefreshCw } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

const logger = loggerService.withContext('VectorIndexStatus')

interface IndexStats {
  totalVectors: number
  dimensions: number
  isNative: boolean
}

interface DimensionMismatchResult {
  hasMismatch: boolean
  indexDimension: number
  configDimension: number
  modelId?: string
  details?: string
}

interface HealthStatus {
  isHealthy: boolean
  issues: string[]
}

interface RebuildProgress {
  phase: 'idle' | 'checking' | 'rebuilding' | 'complete' | 'error'
  progress: number
  message: string
}

const VectorIndexStatus: FC = () => {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const dispatch = useDispatch()
  const memoryConfig = useSelector(selectMemoryConfig)

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<IndexStats | null>(null)
  const [mismatch, setMismatch] = useState<DimensionMismatchResult | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [rebuildProgress, setRebuildProgress] = useState<RebuildProgress>({
    phase: 'idle',
    progress: 0,
    message: ''
  })

  // 获取当前 embedding 配置
  const getEmbeddingConfig = useCallback(() => {
    const embeddingModel = memoryConfig.embeddingModel
    if (!embeddingModel) return null

    const provider = providers.find((p) => p.id === embeddingModel.provider)
    if (!provider) return null

    // 格式化 baseURL（与 KnowledgeService 保持一致）
    let { baseURL } = routeToEndpoint(provider.apiHost || '')

    // 根据 provider 类型添加特定的 URL 后缀
    if (isGeminiProvider(provider)) {
      baseURL = baseURL + '/openai'
    } else if (isAzureOpenAIProvider(provider)) {
      baseURL = baseURL + '/v1'
    } else if (provider.id === SystemProviderIds.ollama) {
      // LangChain 生态不需要 /api 结尾的 URL
      baseURL = baseURL.replace(/\/api$/, '')
    } else if (provider.id === 'jina' || provider.id === '302ai') {
      // Jina API 和 302.AI 需要 /v1 前缀
      if (!baseURL.includes('/v1')) {
        baseURL = baseURL + '/v1'
      }
    } else {
      // 对于其他 OpenAI 兼容的代理服务（如 AiHubMix），确保有 /v1 后缀
      if (!baseURL.includes('/v1')) {
        baseURL = baseURL + '/v1'
      }
    }

    logger.debug('Embedding config built', {
      model: embeddingModel.id,
      provider: embeddingModel.provider,
      baseURL,
      hasApiKey: !!provider.apiKey
    })

    return {
      model: embeddingModel.id,
      provider: embeddingModel.provider,
      apiKey: provider.apiKey || '',
      baseURL
    }
  }, [memoryConfig.embeddingModel, providers])

  // 加载索引状态
  const loadIndexStatus = useCallback(async () => {
    setLoading(true)
    try {
      // 并行获取统计和健康状态
      const [statsResult, healthResult] = await Promise.all([
        window.api.vcpStorage.getIndexStats(),
        window.api.vcpStorage.validateIndex()
      ])

      setStats(statsResult)
      setHealth(healthResult)

      // 获取维度不匹配状态
      const embeddingConfig = getEmbeddingConfig()
      if (embeddingConfig) {
        const mismatchResult = await window.api.vcpStorage.checkDimensionMismatch({
          embeddingConfig
        })
        setMismatch(mismatchResult)
      } else {
        // 无配置时只获取索引维度
        const mismatchResult = await window.api.vcpStorage.checkDimensionMismatch()
        setMismatch(mismatchResult)
      }

      logger.debug('Index status loaded', { stats: statsResult, health: healthResult })
    } catch (error) {
      logger.error('Failed to load index status', error as Error)
    } finally {
      setLoading(false)
    }
  }, [getEmbeddingConfig])

  // 初始加载
  useEffect(() => {
    loadIndexStatus()
  }, [loadIndexStatus])

  // 重建索引
  const handleRebuildIndex = async () => {
    const embeddingConfig = getEmbeddingConfig()
    if (!embeddingConfig) {
      window.toast.error(t('memory.index.no_embedding_config', 'Please configure embedding model first'))
      return
    }

    setRebuildProgress({
      phase: 'rebuilding',
      progress: 10,
      message: t('memory.index.rebuilding', 'Rebuilding vector index...')
    })

    try {
      const result = await window.api.vcpStorage.rebuildIndexes({ embeddingConfig })

      if (result.success) {
        setRebuildProgress({
          phase: 'complete',
          progress: 100,
          message: t('memory.index.rebuild_success', {
            count: result.rebuiltCount,
            duration: (result.durationMs / 1000).toFixed(1),
            defaultValue: `Rebuilt ${result.rebuiltCount} vectors in ${(result.durationMs / 1000).toFixed(1)}s`
          })
        })

        // 自动更新 Redux 中的 embeddingDimensions 为实际检测到的维度
        if (result.newDimensions && result.newDimensions !== memoryConfig.embeddingDimensions) {
          logger.info('Auto-updating embeddingDimensions after rebuild', {
            old: memoryConfig.embeddingDimensions,
            new: result.newDimensions
          })
          dispatch(
            updateMemoryConfig({
              ...memoryConfig,
              embeddingDimensions: result.newDimensions
            })
          )
          window.toast.info(
            t('memory.index.dimensions_updated', {
              dimensions: result.newDimensions,
              defaultValue: `Embedding dimensions updated to ${result.newDimensions}`
            })
          )
        }

        window.toast.success(t('memory.index.rebuild_complete', 'Index rebuild complete'))

        // 刷新状态
        await loadIndexStatus()
      } else {
        setRebuildProgress({
          phase: 'error',
          progress: 0,
          message: result.errors.join(', ') || t('memory.index.rebuild_failed', 'Rebuild failed')
        })
        window.toast.error(t('memory.index.rebuild_failed', 'Index rebuild failed'))
      }
    } catch (error) {
      logger.error('Index rebuild failed', error as Error)
      setRebuildProgress({
        phase: 'error',
        progress: 0,
        message: (error as Error).message
      })
      window.toast.error(t('memory.index.rebuild_error', 'Rebuild error'))
    }
  }

  // 从数据库恢复
  const handleRecoverFromDatabase = async () => {
    setRebuildProgress({
      phase: 'rebuilding',
      progress: 20,
      message: t('memory.index.recovering', 'Recovering from database...')
    })

    try {
      const result = await window.api.vcpStorage.recoverFromDatabase({ tableType: 'chunks' })

      if (result.success) {
        setRebuildProgress({
          phase: 'complete',
          progress: 100,
          message: t('memory.index.recover_success', {
            count: result.recoveredCount,
            defaultValue: `Recovered ${result.recoveredCount} vectors`
          })
        })
        window.toast.success(t('memory.index.recover_complete', 'Recovery complete'))
        await loadIndexStatus()
      } else {
        setRebuildProgress({
          phase: 'error',
          progress: 0,
          message: result.error || t('memory.index.recover_failed', 'Recovery failed')
        })
      }
    } catch (error) {
      logger.error('Database recovery failed', error as Error)
      setRebuildProgress({
        phase: 'error',
        progress: 0,
        message: (error as Error).message
      })
    }
  }

  if (loading) {
    return (
      <Container>
        <Spin size="small" />
        <span style={{ marginLeft: 8 }}>{t('memory.index.loading', 'Loading index status...')}</span>
      </Container>
    )
  }

  return (
    <Container>
      <HeaderRow>
        <Label>
          <Database size={16} />
          {t('memory.index.title', 'Vector Index Status')}
          <InfoTooltip
            title={t('memory.index.tooltip', 'Shows current vector index status and provides rebuild options')}
          />
        </Label>
        <Button size="small" icon={<RefreshCw size={14} />} onClick={loadIndexStatus}>
          {t('memory.index.refresh', 'Refresh')}
        </Button>
      </HeaderRow>

      {/* 维度不匹配警告 */}
      {mismatch?.hasMismatch && (
        <StyledAlert
          message={t('memory.index.dimension_mismatch', 'Dimension Mismatch')}
          description={
            mismatch.details ||
            t('memory.index.dimension_mismatch_desc', {
              indexDim: mismatch.indexDimension,
              configDim: mismatch.configDimension,
              defaultValue: `Index has ${mismatch.indexDimension} dimensions, but current model uses ${mismatch.configDimension}`
            })
          }
          type="warning"
          showIcon
          icon={<AlertCircle size={16} />}
        />
      )}

      {/* 健康问题警告 */}
      {health && !health.isHealthy && (
        <StyledAlert
          message={t('memory.index.health_issues', 'Health Issues')}
          description={health.issues.join('; ')}
          type="error"
          showIcon
        />
      )}

      {/* 索引统计 */}
      <StatsContainer>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label={t('memory.index.total_vectors', 'Total Vectors')}>
            <Tag color="blue">{stats?.totalVectors || 0}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('memory.index.dimensions', 'Dimensions')}>
            <Tag color={mismatch?.hasMismatch ? 'warning' : 'green'}>{stats?.dimensions || 0}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('memory.index.backend', 'Backend')}>
            <Tag color={stats?.isNative ? 'purple' : 'default'}>{stats?.isNative ? 'Vexus (Rust)' : 'LibSQL'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('memory.index.health', 'Health')}>
            {health?.isHealthy ? (
              <Tag color="success" icon={<CheckCircle size={12} />}>
                {t('memory.index.healthy', 'Healthy')}
              </Tag>
            ) : (
              <Tag color="error" icon={<AlertCircle size={12} />}>
                {t('memory.index.unhealthy', 'Unhealthy')}
              </Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </StatsContainer>

      {/* 重建进度 */}
      {rebuildProgress.phase !== 'idle' && (
        <ProgressContainer>
          <Progress
            percent={rebuildProgress.progress}
            status={
              rebuildProgress.phase === 'error' ? 'exception' : rebuildProgress.phase === 'complete' ? 'success' : 'active'
            }
            size="small"
          />
          <ProgressMessage $status={rebuildProgress.phase}>{rebuildProgress.message}</ProgressMessage>
        </ProgressContainer>
      )}

      {/* 操作按钮 */}
      <ButtonRow>
        <Space>
          <Button
            type={mismatch?.hasMismatch ? 'primary' : 'default'}
            danger={mismatch?.hasMismatch}
            onClick={handleRebuildIndex}
            loading={rebuildProgress.phase === 'rebuilding'}
            disabled={!memoryConfig.embeddingModel}>
            {t('memory.index.rebuild', 'Rebuild Index')}
          </Button>
          <Button onClick={handleRecoverFromDatabase} loading={rebuildProgress.phase === 'rebuilding'}>
            {t('memory.index.recover', 'Recover from DB')}
          </Button>
        </Space>
        {!memoryConfig.embeddingModel && (
          <HintText>{t('memory.index.configure_embedding_first', 'Configure embedding model first')}</HintText>
        )}
      </ButtonRow>
    </Container>
  )
}

// Styled components
const Container = styled.div`
  width: 100%;
  margin-top: 16px;
`

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

const Label = styled.div`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;

  .ant-alert-message {
    font-size: 13px;
  }

  .ant-alert-description {
    font-size: 12px;
  }
`

const StatsContainer = styled.div`
  margin-bottom: 16px;

  .ant-descriptions-item-label {
    font-size: 12px;
    background: var(--color-background-soft);
  }

  .ant-descriptions-item-content {
    font-size: 12px;
  }
`

const ProgressContainer = styled.div`
  margin-bottom: 16px;
`

const ProgressMessage = styled.div<{ $status: string }>`
  font-size: 12px;
  margin-top: 4px;
  color: ${(props) => {
    switch (props.$status) {
      case 'error':
        return 'var(--color-error)'
      case 'complete':
        return 'var(--color-success)'
      default:
        return 'var(--color-text-secondary)'
    }
  }};
`

const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const HintText = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export default VectorIndexStatus
