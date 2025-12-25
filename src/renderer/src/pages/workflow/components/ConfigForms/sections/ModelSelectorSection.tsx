/**
 * 模型选择器区块组件
 *
 * 可复用的模型选择 UI 组件，用于所有图像生成节点的配置表单
 */

import { getModelConfigName } from '@renderer/config/imageGenerationConfig'
import type { Model, Provider } from '@renderer/types'
import { Divider } from 'antd'
import { memo, useCallback, useMemo } from 'react'

import { FormRow, FormSection } from '../FormComponents'
import ModelSelectorButton, { imageGenerationModelFilter } from '../ModelSelectorButton'
import { applyModelDefaults } from '../WorkflowDynamicImageForm'

export interface ModelSelectorSectionProps {
  /** 区块标题 */
  title?: string
  /** 模型选择标签 */
  label?: string
  /** 模型选择描述 */
  description?: string
  /** 当前 Provider ID */
  providerId?: string
  /** 当前 Model ID */
  modelId?: string
  /** 当前配置对象（用于 applyModelDefaults） */
  config?: Record<string, any>
  /** Provider 列表（可选，不传则使用全局） */
  providers?: Provider[]
  /** 模型过滤器 */
  filter?: (model: Model) => boolean
  /** 是否显示标签过滤器 */
  showTagFilter?: boolean
  /** 是否显示配置类型 */
  showConfigType?: boolean
  /** 是否显示分隔线 */
  showDivider?: boolean
  /** 需要保留的配置键（切换模型时不覆盖） */
  preserveKeys?: string[]
  /** 模型变更回调 */
  onModelChange: (providerId: string, modelId: string) => void
  /** 配置更新回调（用于 applyModelDefaults） */
  onUpdateConfig?: (key: string, value: any) => void
  /** 占位符文本 */
  placeholder?: string
}

function ModelSelectorSection({
  title = '🤖 AI 模型',
  label = '图像生成模型',
  description = '选择支持图像生成的 AI 模型',
  providerId,
  modelId,
  config = {},
  providers,
  filter = imageGenerationModelFilter,
  showTagFilter = true,
  showConfigType = true,
  showDivider = true,
  preserveKeys = ['prompt', 'negativePrompt'],
  onModelChange,
  onUpdateConfig,
  placeholder = '点击选择模型'
}: ModelSelectorSectionProps) {
  // 获取模型配置类型名称
  const modelConfigName = useMemo(() => {
    if (!modelId) return ''
    return getModelConfigName(modelId, providerId)
  }, [modelId, providerId])

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      // 更新 provider 和 model
      if (onUpdateConfig) {
        onUpdateConfig('providerId', newProviderId)
        onUpdateConfig('modelId', newModelId)

        // 获取新模型的默认值并应用
        applyModelDefaults(newModelId, newProviderId, config, onUpdateConfig, preserveKeys)
      }

      onModelChange(newProviderId, newModelId)
    },
    [onModelChange, onUpdateConfig, config, preserveKeys]
  )

  return (
    <>
      <FormSection title={title}>
        <FormRow label={label} description={description}>
          <ModelSelectorButton
            providerId={providerId}
            modelId={modelId}
            providers={providers}
            filter={filter}
            showTagFilter={showTagFilter}
            onModelChange={handleModelChange}
            placeholder={placeholder}
          />
        </FormRow>
        {showConfigType && modelConfigName && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
              marginTop: '-8px',
              marginBottom: '8px'
            }}>
            配置类型: {modelConfigName}
          </div>
        )}
      </FormSection>
      {showDivider && <Divider style={{ margin: '16px 0' }} />}
    </>
  )
}

export default memo(ModelSelectorSection)
