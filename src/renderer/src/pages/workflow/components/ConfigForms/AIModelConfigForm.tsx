/**
 * AI 模型配置组件
 * 使用 Cherry 原生 SelectModelPopup 弹窗选择模型
 * 通用的 AI 模型选择器，显示所有可用模型
 */

import type { Provider } from '@renderer/types'
import { memo, useCallback, useMemo } from 'react'

import ModelSelectorButton from './ModelSelectorButton'

interface AIModelConfigFormProps {
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

function AIModelConfigForm({ providerId, modelId, providers, onModelChange }: AIModelConfigFormProps) {
  // 检查是否有可用的模型
  const hasModels = useMemo(() => {
    if (!providers || providers.length === 0) return false

    return providers.some((provider) => (provider.models || []).length > 0)
  }, [providers])

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      onModelChange(newProviderId, newModelId)
    },
    [onModelChange]
  )

  // 如果没有可用的模型，显示提示
  if (!hasModels) {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>🤖 AI 模型</label>
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#ff4d4f' }}>⚠️ 没有可用的 AI 模型</div>
        <div style={{ fontSize: '11px', color: 'var(--ant-color-text-tertiary)', marginTop: '4px' }}>
          请在设置中添加 AI 模型提供商
        </div>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>🤖 AI 模型</label>
      <ModelSelectorButton
        providerId={providerId}
        modelId={modelId}
        providers={providers}
        showTagFilter={true}
        onModelChange={handleModelChange}
        placeholder="点击选择 AI 模型"
      />
    </div>
  )
}

export default memo(AIModelConfigForm)
