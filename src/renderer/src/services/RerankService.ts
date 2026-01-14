/**
 * RerankService - Renderer 端 Rerank 服务
 *
 * 通过 IPC 与主进程的 UnifiedRerankService 通信
 * 提供 Rerank 配置管理和调用接口
 *
 * 注意: 此服务依赖主进程的 rerank IPC 通道
 * 如果通道未注册，方法会返回安全的默认值
 */

import type { Model } from '@renderer/types'

// ==================== 类型定义 ====================

export type RerankProvider = 'cohere' | 'jina' | 'bge' | 'voyage' | 'bailian' | 'tei' | 'huggingface-tei' | 'silicon-flow' | 'default'

export type RerankScene = 'knowledge' | 'memory' | 'deepmemo' | 'lightmemo' | 'default'

export interface RerankModelConfig {
  provider: RerankProvider
  apiKey?: string
  baseUrl?: string
  model?: string
  topN?: number
}

export interface UnifiedRerankConfig {
  enabled: boolean
  global?: RerankModelConfig
  overrides?: {
    knowledge?: RerankModelConfig
    memory?: RerankModelConfig
    deepmemo?: RerankModelConfig
    lightmemo?: RerankModelConfig
  }
}

export interface RerankDocument {
  id: string
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

export interface RerankResult {
  id: string
  content: string
  score: number
  originalScore?: number
  originalIndex: number
  metadata?: Record<string, unknown>
}

// ==================== 辅助函数 ====================

/**
 * 从 Model 对象构建 RerankModelConfig
 */
export function buildRerankConfigFromModel(model: Model, apiKey?: string, baseUrl?: string): RerankModelConfig {
  // 根据 model.provider 映射到 RerankProvider
  const providerMap: Record<string, RerankProvider> = {
    cohere: 'cohere',
    jina: 'jina',
    'silicon-flow': 'silicon-flow',
    siliconflow: 'silicon-flow',
    voyage: 'voyage',
    voyageai: 'voyage',
    bailian: 'bailian',
    huggingface: 'tei',
    'huggingface-tei': 'huggingface-tei',
    tei: 'tei'
  }

  const provider = providerMap[model.provider?.toLowerCase() || ''] || 'default'

  return {
    provider,
    apiKey,
    baseUrl,
    model: model.id,
    topN: 10
  }
}

// ==================== IPC 辅助函数 ====================

async function invokeRerank<T>(channel: string, ...args: unknown[]): Promise<T | null> {
  try {
    return await window.electron.ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    console.warn(`RerankService: IPC channel ${channel} not available`, error)
    return null
  }
}

// ==================== RerankService ====================

class RerankService {
  private static instance: RerankService | null = null

  private constructor() {}

  static getInstance(): RerankService {
    if (!RerankService.instance) {
      RerankService.instance = new RerankService()
    }
    return RerankService.instance
  }

  /**
   * 获取当前配置
   */
  async getConfig(): Promise<UnifiedRerankConfig> {
    const result = await invokeRerank<UnifiedRerankConfig>('rerank:getConfig')
    return result || { enabled: false }
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<UnifiedRerankConfig>): Promise<void> {
    await invokeRerank('rerank:updateConfig', config)
  }

  /**
   * 设置全局默认 Rerank 配置
   */
  async setGlobalConfig(config: RerankModelConfig): Promise<void> {
    await invokeRerank('rerank:setGlobalConfig', config)
  }

  /**
   * 设置场景特定配置
   */
  async setSceneConfig(scene: RerankScene, config: RerankModelConfig): Promise<void> {
    await invokeRerank('rerank:setSceneConfig', scene, config)
  }

  /**
   * 从 Model 对象设置全局配置
   * 便捷方法，用于 UI 选择模型后设置
   */
  async setGlobalConfigFromModel(model: Model, apiKey?: string, baseUrl?: string): Promise<void> {
    const config = buildRerankConfigFromModel(model, apiKey, baseUrl)
    await this.setGlobalConfig(config)
  }

  /**
   * 检查 Rerank 是否可用
   */
  async isAvailable(scene?: RerankScene): Promise<boolean> {
    const result = await invokeRerank<boolean>('rerank:isAvailable', scene)
    return result ?? false
  }

  /**
   * 执行 Rerank
   */
  async rerank(
    query: string,
    documents: RerankDocument[],
    options?: {
      scene?: RerankScene
      topN?: number
    }
  ): Promise<{ success: boolean; results?: RerankResult[]; error?: string }> {
    const result = await invokeRerank<{ success: boolean; results?: RerankResult[]; error?: string }>(
      'rerank:rerank',
      query,
      documents,
      options
    )
    return result || { success: false, error: 'IPC channel not available' }
  }

  /**
   * 启用/禁用 Rerank
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.updateConfig({ enabled })
  }
}

// ==================== 导出 ====================

export const rerankService = RerankService.getInstance()

export default rerankService
