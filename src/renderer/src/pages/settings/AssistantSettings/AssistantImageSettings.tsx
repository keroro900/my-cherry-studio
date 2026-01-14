/**
 * 图片助手设置组件
 *
 * 配置图片生成的模型和参数
 */

import { SettingRow } from '@renderer/pages/settings'
import ModelSelectorButton, {
  imageGenerationModelFilter
} from '@renderer/pages/workflow/components/ConfigForms/ModelSelectorButton'
import type { Assistant, AssistantSettings, ImageAssistant, ImageAssistantConfig } from '@renderer/types'
import { isImageAssistant } from '@renderer/types'
import { InputNumber, Select } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  updateAssistantSettings: (settings: Partial<AssistantSettings>) => void
}

const AssistantImageSettings: FC<Props> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()

  // 安全获取图片配置（hooks必须在条件之前调用）
  const imageAssistant = useMemo(() => {
    return isImageAssistant(assistant) ? (assistant as ImageAssistant) : null
  }, [assistant])

  const initialConfig = useMemo(() => {
    return imageAssistant?.imageConfig || ({ imageSize: '1K', aspectRatio: '1:1' } as ImageAssistantConfig)
  }, [imageAssistant])

  const initialProviderId = useMemo(() => imageAssistant?.imageProviderId || '', [imageAssistant])
  const initialModelId = useMemo(() => imageAssistant?.imageModelId || '', [imageAssistant])

  // 本地状态（hooks必须在条件之前调用）
  const [config, setConfig] = useState<ImageAssistantConfig>(initialConfig)
  const [providerId, setProviderId] = useState(initialProviderId)
  const [modelId, setModelId] = useState(initialModelId)

  // 更新配置
  const updateConfig = useCallback(
    (updates: Partial<ImageAssistantConfig>) => {
      if (!imageAssistant) return
      const newConfig = { ...config, ...updates }
      setConfig(newConfig)
      updateAssistant({
        ...assistant,
        imageConfig: newConfig
      } as ImageAssistant)
    },
    [config, assistant, updateAssistant, imageAssistant]
  )

  // 更新模型
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (!imageAssistant) return
      setProviderId(newProviderId)
      setModelId(newModelId)
      updateAssistant({
        ...assistant,
        imageProviderId: newProviderId,
        imageModelId: newModelId
      } as ImageAssistant)
    },
    [assistant, updateAssistant, imageAssistant]
  )

  // 类型守卫检查（在hooks之后）
  if (!imageAssistant) {
    return (
      <Container>
        <EmptyMessage>{t('assistants.settings.image.not_image_assistant')}</EmptyMessage>
      </Container>
    )
  }

  return (
    <Container>
      {/* 模型选择 */}
      <Section>
        <SectionTitle>{t('assistants.settings.image.model')}</SectionTitle>
        <SettingRow>
          <ModelSelectorButton
            providerId={providerId}
            modelId={modelId}
            filter={imageGenerationModelFilter}
            showTagFilter={false}
            onModelChange={handleModelChange}
          />
        </SettingRow>
      </Section>

      {/* 图片尺寸 */}
      <Section>
        <SectionTitle>{t('assistants.settings.image.size')}</SectionTitle>
        <SettingRow>
          <Select
            value={config.imageSize || '1K'}
            onChange={(value) => updateConfig({ imageSize: value as '1K' | '2K' | '4K' })}
            options={[
              { label: '1K', value: '1K' },
              { label: '2K', value: '2K' },
              { label: '4K', value: '4K' }
            ]}
            style={{ width: 200 }}
          />
        </SettingRow>
      </Section>

      {/* 宽高比 */}
      <Section>
        <SectionTitle>{t('assistants.settings.image.aspect_ratio')}</SectionTitle>
        <SettingRow>
          <Select
            value={config.aspectRatio || '1:1'}
            onChange={(value) => updateConfig({ aspectRatio: value })}
            options={[
              { label: '1:1', value: '1:1' },
              { label: '16:9', value: '16:9' },
              { label: '9:16', value: '9:16' },
              { label: '4:3', value: '4:3' },
              { label: '3:4', value: '3:4' }
            ]}
            style={{ width: 200 }}
          />
        </SettingRow>
      </Section>

      {/* 批量生成数量 */}
      <Section>
        <SectionTitle>{t('assistants.settings.image.batch_count')}</SectionTitle>
        <SettingRow>
          <InputNumber
            min={1}
            max={10}
            value={config.batchCount || 1}
            onChange={(value) => updateConfig({ batchCount: value || 1 })}
          />
        </SettingRow>
      </Section>
    </Container>
  )
}

export default AssistantImageSettings

// Styled components
const Container = styled.div`
  padding: 8px 0;
`

const Section = styled.div`
  margin-bottom: 20px;
`

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 12px;
`

const EmptyMessage = styled.div`
  padding: 40px;
  text-align: center;
  color: var(--color-text-secondary);
`
