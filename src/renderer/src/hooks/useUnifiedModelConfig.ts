/**
 * useUnifiedModelConfig - 统一模型配置 Hook
 *
 * 提供统一的 Embedding 和 Rerank 模型配置管理
 * - 获取/设置全局配置
 * - 获取/设置场景覆盖配置
 * - 同步到主进程 UnifiedModelConfigService
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react'

import type { Model, Provider } from '@types'

// ==================== 类型定义 ====================

/**
 * 模型标识
 */
export interface ModelIdentifier {
  id: string
  provider: string
  name?: string
  dimensions?: number
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  id: string
  apiKey?: string
  baseUrl?: string
}

/**
 * Embedding 模型配置
 */
export interface EmbeddingModelConfig {
  model: ModelIdentifier
  provider: ProviderConfig
  targetDimension?: number
  enableCache?: boolean
}

/**
 * Rerank 模型配置
 */
export interface RerankModelConfig {
  model: ModelIdentifier
  provider: ProviderConfig
  topN?: number
}

/**
 * 全局模型配置
 */
export interface GlobalModelConfig {
  embedding?: EmbeddingModelConfig
  rerank?: RerankModelConfig
  sceneOverrides?: Record<
    string,
    {
      embedding?: EmbeddingModelConfig
      rerank?: RerankModelConfig
    }
  >
}

/**
 * 场景类型
 */
export type ModelScene = 'knowledge' | 'memory' | 'deepmemo' | 'lightmemo' | 'default'

/**
 * 配置状态
 */
export interface ConfigStatus {
  hasEmbedding: boolean
  hasRerank: boolean
}

// ==================== Hook 实现 ====================

/**
 * 统一模型配置 Hook
 */
export function useUnifiedModelConfig() {
  const [config, setConfig] = useState<GlobalModelConfig>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载配置
  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.modelConfig.get()
      setConfig(result || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // 设置 Embedding 配置
  const setEmbeddingConfig = useCallback(
    async (embeddingConfig: EmbeddingModelConfig): Promise<boolean> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.modelConfig.setEmbedding(embeddingConfig)
        if (result.success) {
          await loadConfig()
          return true
        } else {
          setError(result.error || 'Failed to set embedding config')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setLoading(false)
      }
    },
    [loadConfig]
  )

  // 设置 Rerank 配置
  const setRerankConfig = useCallback(
    async (rerankConfig: RerankModelConfig): Promise<boolean> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.modelConfig.setRerank(rerankConfig)
        if (result.success) {
          await loadConfig()
          return true
        } else {
          setError(result.error || 'Failed to set rerank config')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setLoading(false)
      }
    },
    [loadConfig]
  )

  // 设置场景配置
  const setSceneConfig = useCallback(
    async (
      scene: ModelScene,
      embedding?: EmbeddingModelConfig,
      rerank?: RerankModelConfig
    ): Promise<boolean> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.modelConfig.setSceneConfig(scene, embedding, rerank)
        if (result.success) {
          await loadConfig()
          return true
        } else {
          setError(result.error || 'Failed to set scene config')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setLoading(false)
      }
    },
    [loadConfig]
  )

  // 获取有效 Embedding 配置
  const getEffectiveEmbedding = useCallback(
    async (scene?: ModelScene): Promise<EmbeddingModelConfig | undefined> => {
      try {
        return await window.api.modelConfig.getEffectiveEmbedding(scene)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return undefined
      }
    },
    []
  )

  // 获取有效 Rerank 配置
  const getEffectiveRerank = useCallback(async (scene?: ModelScene): Promise<RerankModelConfig | undefined> => {
    try {
      return await window.api.modelConfig.getEffectiveRerank(scene)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    }
  }, [])

  // 获取配置状态
  const getStatus = useCallback(async (scene?: ModelScene): Promise<ConfigStatus> => {
    try {
      return await window.api.modelConfig.status(scene)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return { hasEmbedding: false, hasRerank: false }
    }
  }, [])

  return {
    config,
    loading,
    error,
    loadConfig,
    setEmbeddingConfig,
    setRerankConfig,
    setSceneConfig,
    getEffectiveEmbedding,
    getEffectiveRerank,
    getStatus
  }
}

// ==================== 辅助函数 ====================

/**
 * 从 Model 和 Provider 对象创建 EmbeddingModelConfig
 */
export function createEmbeddingConfigFromModel(
  model: Model,
  provider: Provider,
  options?: { targetDimension?: number; enableCache?: boolean; dimensions?: number }
): EmbeddingModelConfig {
  return {
    model: {
      id: model.id,
      provider: model.provider,
      name: model.name,
      dimensions: options?.dimensions // 从 options 获取维度
    },
    provider: {
      id: provider.id,
      apiKey: provider.apiKey,
      baseUrl: provider.apiHost
    },
    targetDimension: options?.targetDimension,
    enableCache: options?.enableCache ?? true
  }
}

/**
 * 从 Model 和 Provider 对象创建 RerankModelConfig
 */
export function createRerankConfigFromModel(
  model: Model,
  provider: Provider,
  options?: { topN?: number }
): RerankModelConfig {
  return {
    model: {
      id: model.id,
      provider: model.provider,
      name: model.name
    },
    provider: {
      id: provider.id,
      apiKey: provider.apiKey,
      baseUrl: provider.apiHost
    },
    topN: options?.topN ?? 10
  }
}

export default useUnifiedModelConfig
