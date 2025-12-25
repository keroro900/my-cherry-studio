/**
 * Provider 选择器组件
 *
 * 选择图片生成的 AI 服务提供商
 */

import { useAllProviders } from '@renderer/hooks/useProvider'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectProviderConfig, setProvider } from '@renderer/store/imageStudio'
import { Select } from 'antd'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const ProviderSelector: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const providers = useAllProviders()
  const { providerId, modelId } = useAppSelector(selectProviderConfig)

  // 筛选支持图片生成的 Provider
  const imageProviders = useMemo(() => {
    return providers.filter((p) => {
      // 检查是否有支持图片生成的模型
      return p.models?.some(
        (m) =>
          m.id?.toLowerCase().includes('imagen') ||
          m.id?.toLowerCase().includes('gemini') ||
          m.id?.toLowerCase().includes('dall') ||
          m.type === 'image'
      )
    })
  }, [providers])

  // 获取当前 provider 的模型列表
  const currentProvider = useMemo(() => {
    return providers.find((p) => p.id === providerId)
  }, [providers, providerId])

  const imageModels = useMemo(() => {
    if (!currentProvider?.models) return []
    return currentProvider.models.filter(
      (m) =>
        m.id?.toLowerCase().includes('imagen') ||
        m.id?.toLowerCase().includes('gemini') ||
        m.id?.toLowerCase().includes('dall') ||
        m.type === 'image'
    )
  }, [currentProvider])

  const handleProviderChange = (value: string) => {
    const provider = providers.find((p) => p.id === value)
    const firstModel = provider?.models?.find(
      (m) =>
        m.id?.toLowerCase().includes('imagen') ||
        m.id?.toLowerCase().includes('gemini') ||
        m.id?.toLowerCase().includes('dall') ||
        m.type === 'image'
    )
    dispatch(
      setProvider({
        providerId: value,
        modelId: firstModel?.id || ''
      })
    )
  }

  const handleModelChange = (value: string) => {
    dispatch(
      setProvider({
        providerId,
        modelId: value
      })
    )
  }

  return (
    <Container>
      <Select
        value={providerId || undefined}
        onChange={handleProviderChange}
        placeholder={t('image_studio.select_provider')}
        style={{ width: 140 }}
        size="small"
        options={imageProviders.map((p) => ({
          value: p.id,
          label: p.name
        }))}
      />
      <Select
        value={modelId || undefined}
        onChange={handleModelChange}
        placeholder={t('image_studio.select_model')}
        style={{ width: 160 }}
        size="small"
        disabled={!providerId}
        options={imageModels.map((m) => ({
          value: m.id,
          label: m.name || m.id
        }))}
      />
    </Container>
  )
}

export default ProviderSelector

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`
