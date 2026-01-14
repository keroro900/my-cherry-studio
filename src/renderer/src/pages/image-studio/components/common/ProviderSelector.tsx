/**
 * Provider 选择器组件
 *
 * 复用 Cherry 原生的 ModelSelectorButton 组件
 */

import ModelSelectorButton, {
  imageGenerationModelFilter
} from '@renderer/pages/workflow/components/ConfigForms/ModelSelectorButton'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectProviderConfig, setProvider } from '@renderer/store/imageStudio'
import type { FC } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const ProviderSelector: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { providerId, modelId } = useAppSelector(selectProviderConfig)

  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      dispatch(
        setProvider({
          providerId: newProviderId,
          modelId: newModelId
        })
      )
    },
    [dispatch]
  )

  return (
    <Container>
      <ModelSelectorButton
        providerId={providerId}
        modelId={modelId}
        filter={imageGenerationModelFilter}
        showTagFilter={false}
        onModelChange={handleModelChange}
        placeholder={t('image_studio.select_model')}
        style={{ width: 240 }}
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
  align-items: center;
`
