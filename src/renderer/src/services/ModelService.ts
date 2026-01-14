import { getStoreProviders } from '@renderer/hooks/useStore'
import type { Model } from '@renderer/types'
import { pick } from 'lodash'

import { getProviderName } from './ProviderService'

export const getModelUniqId = (m?: Model) => {
  return m?.id ? JSON.stringify(pick(m, ['id', 'provider'])) : ''
}

/**
 * 解析 modelUniqId 字符串，返回 providerId 和 modelId
 */
export const resolveModelUniqId = (uniqId: string): { providerId: string; modelId: string } | null => {
  if (!uniqId) return null
  try {
    const parsed = JSON.parse(uniqId) as { id?: string; provider?: string }
    if (parsed.id && parsed.provider) {
      return { providerId: parsed.provider, modelId: parsed.id }
    }
    return null
  } catch {
    return null
  }
}

export const hasModel = (m?: Model) => {
  const allModels = getStoreProviders()
    .filter((p) => p.enabled)
    .map((p) => p.models)
    .flat()

  return allModels.find((model) => model.id === m?.id)
}

export function getModelName(model?: Model) {
  const modelName = model?.name || model?.id || ''
  const provider = getStoreProviders().find((p) => p.id === model?.provider)

  if (provider) {
    const providerName = getProviderName(model as Model)
    return `${modelName} | ${providerName}`
  }

  return modelName
}
