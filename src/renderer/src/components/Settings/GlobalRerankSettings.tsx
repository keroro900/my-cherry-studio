/**
 * GlobalRerankSettings - 全局重排序设置组件
 *
 * 提供统一的 Rerank 模型配置入口
 * 可在多个设置页面复用
 */

import ModelSelector from '@renderer/components/ModelSelector'
import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { isRerankModel } from '@renderer/config/models'
import { useProviders } from '@renderer/hooks/useProvider'
import rerankService, { type RerankModelConfig } from '@renderer/services/RerankService'
import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model, Provider } from '@renderer/types'
import { Alert, Form, Switch, Space, Tag } from 'antd'
import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface GlobalRerankSettingsProps {
  /** 是否显示标题 */
  showTitle?: boolean
  /** 紧凑模式 */
  compact?: boolean
}

const GlobalRerankSettings: React.FC<GlobalRerankSettingsProps> = ({ showTitle = true, compact = false }) => {
  const { t } = useTranslation()
  const { providers } = useProviders()

  const [enabled, setEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | undefined>()
  const [loading, setLoading] = useState(true)

  // 加载当前配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await rerankService.getConfig()
        setEnabled(config.enabled)
        // TODO: 从 config.global 恢复选中的模型
      } catch (error) {
        console.error('Failed to load rerank config:', error)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  // 切换启用状态
  const handleEnableChange = useCallback(async (checked: boolean) => {
    setEnabled(checked)
    await rerankService.setEnabled(checked)
  }, [])

  // 选择模型
  const handleModelChange = useCallback(
    async (modelUniqId: string | undefined) => {
      if (!modelUniqId) {
        setSelectedModel(undefined)
        return
      }

      try {
        // 解析模型 ID
        const parsed = JSON.parse(modelUniqId) as { id: string; provider: string }

        // 查找模型和提供商
        const provider = providers.find((p) => p.id === parsed.provider)
        if (!provider) {
          console.error('Provider not found:', parsed.provider)
          return
        }

        const model = provider.models?.find((m) => m.id === parsed.id)
        if (!model) {
          console.error('Model not found:', parsed.id)
          return
        }

        setSelectedModel(model)

        // 获取 API Key
        const apiKeys = provider.apiKey?.split(',').map((k) => k.trim()) || []
        const apiKey = apiKeys[0] || ''

        // 更新配置
        await rerankService.setGlobalConfigFromModel(model, apiKey, provider.apiHost)
        await rerankService.setEnabled(true)
        setEnabled(true)
      } catch (error) {
        console.error('Failed to set rerank model:', error)
      }
    },
    [providers]
  )

  const rerankPredicate = useCallback((m: Model) => isRerankModel(m), [])

  if (loading) {
    return null
  }

  return (
    <Container $compact={compact}>
      {showTitle && (
        <TitleRow>
          <Sparkles size={16} />
          <Title>{t('settings.rerank.title', '重排序设置')}</Title>
          <InfoTooltip title={t('settings.rerank.tooltip', '配置全局重排序模型，用于优化搜索结果质量')} />
        </TitleRow>
      )}

      <SettingRow>
        <div className="label">
          {t('settings.rerank.enable', '启用重排序')}
          <InfoTooltip title={t('settings.rerank.enable_tooltip', '启用后，知识库和记忆系统的搜索结果将使用 Rerank 模型优化排序')} />
        </div>
        <Switch checked={enabled} onChange={handleEnableChange} />
      </SettingRow>

      <SettingRow>
        <div className="label">
          {t('settings.rerank.model', '重排序模型')}
          <InfoTooltip title={t('settings.rerank.model_tooltip', '选择用于重排序的模型，如 Cohere Rerank、Jina Reranker 等')} />
        </div>
        <ModelSelector
          providers={providers}
          predicate={rerankPredicate}
          style={{ width: compact ? '100%' : 280 }}
          value={selectedModel ? getModelUniqId(selectedModel) : undefined}
          placeholder={t('settings.rerank.model_placeholder', '选择重排序模型')}
          onChange={handleModelChange}
          allowClear
          disabled={!enabled}
        />
      </SettingRow>

      {enabled && !selectedModel && (
        <Alert
          type="warning"
          showIcon
          message={t('settings.rerank.no_model_warning', '请选择重排序模型，否则将使用本地关键词增强作为备用')}
          style={{ marginTop: 12 }}
        />
      )}

      {enabled && selectedModel && (
        <StatusRow>
          <Tag color="green">{t('settings.rerank.active', '已激活')}</Tag>
          <span className="model-info">
            {selectedModel.name || selectedModel.id}
          </span>
        </StatusRow>
      )}
    </Container>
  )
}

// ==================== Styled Components ====================

const Container = styled.div<{ $compact?: boolean }>`
  padding: ${(props) => (props.$compact ? '12px' : '16px')};
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 16px;
`

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`

const Title = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
`

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--color-text-secondary);
  }
`

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--color-background-mute);
  border-radius: 6px;

  .model-info {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
`

export default GlobalRerankSettings
