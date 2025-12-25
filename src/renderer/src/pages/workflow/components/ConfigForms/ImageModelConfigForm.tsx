/**
 * 图像生成模型配置组件
 * 使用 Cherry 原生 SelectModelPopup 弹窗选择模型
 * 只显示图像生成/编辑类型的模型
 */

import type { Provider } from '@renderer/types'
import { memo, useCallback, useMemo } from 'react'

import ModelSelectorButton, { imageGenerationModelFilter } from './ModelSelectorButton'

interface ImageModelConfigFormProps {
  providerId?: string
  modelId?: string
  providers: Provider[]
  onModelChange: (providerId: string, modelId: string) => void
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '16px'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--ant-color-text)'
}

function ImageModelConfigForm({ providerId, modelId, providers, onModelChange }: ImageModelConfigFormProps) {
  // 检查是否有可用的图像生成模型
  const hasImageModels = useMemo(() => {
    if (!providers || providers.length === 0) return false

    return providers.some((provider) => (provider.models || []).some(imageGenerationModelFilter))
  }, [providers])

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      onModelChange(newProviderId, newModelId)
    },
    [onModelChange]
  )

  // 如果没有可用的图像生成模型，显示提示
  if (!hasImageModels) {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>🎨 图像生成模型</label>
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#ff4d4f' }}>⚠️ 没有可用的图像生成模型</div>
        <div style={{ fontSize: '11px', color: 'var(--ant-color-text-tertiary)', marginTop: '4px' }}>
          请在设置中添加支持图像生成的 Provider (如 OpenAI、Gemini)
        </div>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>🎨 图像生成模型</label>
      <ModelSelectorButton
        providerId={providerId}
        modelId={modelId}
        providers={providers}
        filter={imageGenerationModelFilter}
        showTagFilter={true}
        onModelChange={handleModelChange}
        placeholder="点击选择图像生成模型"
      />
    </div>
  )
}

export default memo(ImageModelConfigForm)
