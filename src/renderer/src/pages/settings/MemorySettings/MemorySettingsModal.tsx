import { loggerService } from '@logger'
import InputEmbeddingDimension from '@renderer/components/InputEmbeddingDimension'
import ModelSelector from '@renderer/components/ModelSelector'
import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { isEmbeddingModel, isRerankModel } from '@renderer/config/models'
import { getModel, useModel } from '@renderer/hooks/useModel'
import { useProviders } from '@renderer/hooks/useProvider'
import { getModelUniqId } from '@renderer/services/ModelService'
import { selectMemoryConfig, updateMemoryConfig } from '@renderer/store/memory'
import type { Model } from '@renderer/types'
import { Collapse, Flex, Form, Modal } from 'antd'
import { t } from 'i18next'
import { Settings2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import VectorIndexStatus from './VectorIndexStatus'

const logger = loggerService.withContext('MemorySettingsModal')

/**
 * 解析模型 ID (支持 JSON 格式和普通 ID)
 * getModelUniqId 返回 JSON 字符串格式 {"id":"xxx","provider":"yyy"}
 */
function parseModelFromUniqId(uniqId: string): Model | undefined {
  if (!uniqId) return undefined

  try {
    const parsed = JSON.parse(uniqId)
    if (parsed.id && parsed.provider) {
      return getModel(parsed.id, parsed.provider)
    }
  } catch {
    // 不是 JSON 格式，尝试直接查找
  }

  return getModel(uniqId)
}

interface MemorySettingsModalProps {
  visible: boolean
  onSubmit: (values: any) => void
  onCancel: () => void
  form: any
}

type formValue = {
  llmModel: string
  embeddingModel: string
  rerankModel?: string
  embeddingDimensions: number
}

const MemorySettingsModal: FC<MemorySettingsModalProps> = ({ visible, onSubmit, onCancel, form }) => {
  const { providers } = useProviders()
  const dispatch = useDispatch()
  const memoryConfig = useSelector(selectMemoryConfig)
  const [loading, setLoading] = useState(false)

  // Get all models for lookup
  const llmModel = useModel(memoryConfig.llmModel?.id, memoryConfig.llmModel?.provider)
  const embeddingModel = useModel(memoryConfig.embeddingModel?.id, memoryConfig.embeddingModel?.provider)
  const rerankModel = useModel(memoryConfig.rerankModel?.id, memoryConfig.rerankModel?.provider)

  // Initialize form with current memory config when modal opens
  useEffect(() => {
    if (visible && memoryConfig) {
      form.setFieldsValue({
        llmModel: getModelUniqId(llmModel),
        embeddingModel: getModelUniqId(embeddingModel),
        rerankModel: getModelUniqId(rerankModel),
        embeddingDimensions: memoryConfig.embeddingDimensions
      })
    }
  }, [embeddingModel, form, llmModel, rerankModel, memoryConfig, visible])

  const handleFormSubmit = async (values: formValue) => {
    try {
      // 解析模型 ID (支持 JSON 格式)
      const llmModel = parseModelFromUniqId(values.llmModel)
      const embeddingModel = parseModelFromUniqId(values.embeddingModel)
      const rerankModel = values.rerankModel ? parseModelFromUniqId(values.rerankModel) : undefined

      if (!llmModel) {
        logger.error('LLM model not found', { modelId: values.llmModel })
        window.toast.error(t('memory.llm_model_not_found') || 'LLM model not found')
        return
      }

      if (!embeddingModel) {
        logger.error('Embedding model not found', { modelId: values.embeddingModel })
        window.toast.error(t('memory.embedding_model_not_found') || 'Embedding model not found')
        return
      }

      setLoading(true)

      // Validate LLM model provider
      const llmProvider = providers.find((p) => p.id === llmModel.provider)
      if (!llmProvider) {
        logger.error('Provider not found for LLM model', { provider: llmModel.provider })
        window.toast.error(t('memory.llm_provider_not_found') || 'LLM provider not configured')
        setLoading(false)
        return
      }

      const provider = providers.find((p) => p.id === embeddingModel.provider)

      if (!provider) {
        logger.error('Provider not found for model', { provider: embeddingModel.provider })
        window.toast.error(t('memory.provider_not_found') || 'Provider not found')
        setLoading(false)
        return
      }

      const finalDimensions =
        typeof values.embeddingDimensions === 'string'
          ? parseInt(values.embeddingDimensions)
          : values.embeddingDimensions

      const updatedConfig = {
        ...memoryConfig,
        llmModel,
        embeddingModel,
        rerankModel,
        embeddingDimensions: finalDimensions
      }

      dispatch(updateMemoryConfig(updatedConfig))

      // 同步到 UnifiedModelConfigService
      try {
        // 同步 Embedding 配置
        await window.api.modelConfig.setEmbedding({
          model: {
            id: embeddingModel.id,
            provider: embeddingModel.provider,
            name: embeddingModel.name,
            dimensions: finalDimensions
          },
          provider: {
            id: provider.id,
            apiKey: provider.apiKey,
            baseUrl: provider.apiHost
          },
          targetDimension: finalDimensions,
          enableCache: true
        })

        // 同步 Rerank 配置 (如果有)
        if (rerankModel) {
          const rerankProvider = providers.find((p) => p.id === rerankModel.provider)
          if (rerankProvider) {
            await window.api.modelConfig.setRerank({
              model: {
                id: rerankModel.id,
                provider: rerankModel.provider,
                name: rerankModel.name
              },
              provider: {
                id: rerankProvider.id,
                apiKey: rerankProvider.apiKey,
                baseUrl: rerankProvider.apiHost
              },
              topN: 10
            })
          }
        }

        logger.info('Model config synced to UnifiedModelConfigService', {
          embeddingModel: embeddingModel.id,
          rerankModel: rerankModel?.id
        })
      } catch (syncError) {
        logger.warn('Failed to sync to UnifiedModelConfigService', { error: syncError })
        // 不阻塞主流程，只记录警告
      }

      onSubmit(updatedConfig)
      setLoading(false)
    } catch (error) {
      logger.error('Error submitting form:', error as Error)
      window.toast.error(t('memory.settings_save_failed') || 'Failed to save settings')
      setLoading(false)
    }
  }

  const llmPredicate = useCallback((m: Model) => !isEmbeddingModel(m) && !isRerankModel(m), [])

  const embeddingPredicate = useCallback((m: Model) => isEmbeddingModel(m) && !isRerankModel(m), [])

  const rerankPredicate = useCallback((m: Model) => isRerankModel(m), [])

  return (
    <Modal
      title={t('memory.settings_title')}
      open={visible}
      onOk={form.submit}
      onCancel={onCancel}
      width={600}
      centered
      transitionName="animation-move-down"
      confirmLoading={loading}
      styles={{
        header: {
          borderBottom: '0.5px solid var(--color-border)',
          paddingBottom: 16,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0
        },
        body: {
          paddingTop: 24
        }
      }}>
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          label={t('memory.llm_model')}
          name="llmModel"
          rules={[{ required: true, message: t('memory.please_select_llm_model') }]}>
          <ModelSelector
            providers={providers}
            predicate={llmPredicate}
            placeholder={t('memory.select_llm_model_placeholder')}
          />
        </Form.Item>
        <Form.Item
          label={t('memory.embedding_model')}
          name="embeddingModel"
          rules={[{ required: true, message: t('memory.please_select_embedding_model') }]}>
          <ModelSelector
            providers={providers}
            predicate={embeddingPredicate}
            placeholder={t('memory.select_embedding_model_placeholder')}
          />
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.embeddingModel !== currentValues.embeddingModel}>
          {({ getFieldValue }) => {
            const embeddingModelId = getFieldValue('embeddingModel')
            const embeddingModel = parseModelFromUniqId(embeddingModelId)
            return (
              <Form.Item
                label={
                  <Flex align="center" gap={4}>
                    {t('memory.embedding_dimensions')}
                    <InfoTooltip title={t('knowledge.dimensions_size_tooltip')} />
                  </Flex>
                }
                name="embeddingDimensions"
                rules={[
                  {
                    validator(_, value) {
                      if (value === undefined || value === null || value > 0) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error(t('knowledge.dimensions_error_invalid')))
                    }
                  }
                ]}>
                <InputEmbeddingDimension model={embeddingModel} disabled={!embeddingModel} />
              </Form.Item>
            )
          }}
        </Form.Item>

        {/* Rerank Model (Optional) */}
        <Form.Item
          label={
            <Flex align="center" gap={4}>
              {t('models.rerank_model', 'Rerank Model')}
              <InfoTooltip title={t('memory.rerank_model_tooltip', 'Optional model for reranking search results to improve precision')} />
            </Flex>
          }
          name="rerankModel">
          <ModelSelector
            providers={providers}
            predicate={rerankPredicate}
            placeholder={t('memory.select_rerank_model_placeholder', 'Select Rerank Model (Optional)')}
            allowClear
          />
        </Form.Item>

        {/* Advanced Settings - Vector Index Status */}
        <Collapse
          ghost
          items={[
            {
              key: 'advanced',
              label: (
                <Flex align="center" gap={8}>
                  <Settings2 size={16} />
                  <span>{t('memory.advanced_settings', { defaultValue: 'Advanced Settings' })}</span>
                </Flex>
              ),
              children: <VectorIndexStatus />
            }
          ]}
          style={{ marginTop: 8, marginBottom: 0 }}
        />

        {/* <Form.Item label="Custom Fact Extraction Prompt" name="customFactExtractionPrompt">
          <Input.TextArea placeholder="Optional custom prompt for fact extraction..." rows={3} />
        </Form.Item>
        <Form.Item label="Custom Update Memory Prompt" name="customUpdateMemoryPrompt">
          <Input.TextArea placeholder="Optional custom prompt for memory updates..." rows={3} />
        </Form.Item> */}
      </Form>
    </Modal>
  )
}

export default MemorySettingsModal
