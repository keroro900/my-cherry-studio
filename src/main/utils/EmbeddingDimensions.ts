/**
 * Embedding 模型维度映射工具
 *
 * 参照 VCPToolBox 的 VECTORDB_DIMENSION 环境变量设计，
 * 提供已知嵌入模型的维度信息，支持自动检测和手动配置。
 *
 * @module utils/EmbeddingDimensions
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('EmbeddingDimensions')

/**
 * 已知嵌入模型的维度映射
 * 来源: 各厂商官方文档
 */
export const EMBEDDING_DIMENSIONS: Record<string, number> = {
  // OpenAI models
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,

  // Jina models
  'jina-clip-v2': 768,
  'jina-embeddings-v2-base-en': 768,
  'jina-embeddings-v2-small-en': 512,
  'jina-embeddings-v3': 1024,
  'jina-colbert-v2': 128,

  // Voyage AI models
  'voyage-3': 1024,
  'voyage-3-lite': 512,
  'voyage-code-3': 1024,
  'voyage-finance-2': 1024,
  'voyage-multilingual-2': 1024,
  'voyage-law-2': 1024,

  // Google/Gemini models
  'embedding-001': 768,
  'text-embedding-004': 768,
  'gemini-embedding-001': 3072,
  'gemini-embedding-exp-03-07': 3072,

  // Cohere models
  'embed-english-v3.0': 1024,
  'embed-multilingual-v3.0': 1024,
  'embed-english-light-v3.0': 384,
  'embed-multilingual-light-v3.0': 384,

  // BGE models (常见本地模型)
  'bge-small-en': 384,
  'bge-base-en': 768,
  'bge-large-en': 1024,
  'bge-m3': 1024,
  'bge-small-zh': 512,
  'bge-base-zh': 768,
  'bge-large-zh': 1024,

  // Ollama 常见模型
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,

  // Mistral models
  'mistral-embed': 1024
}

/**
 * 从模型名称获取嵌入维度
 *
 * @param modelId - 模型 ID (如 'text-embedding-3-small')
 * @param defaultDimensions - 默认维度 (当模型未知时使用)
 * @returns 嵌入维度
 */
export function getEmbeddingDimensions(
  modelId: string,
  defaultDimensions: number = 1536
): number {
  // 精确匹配
  if (EMBEDDING_DIMENSIONS[modelId]) {
    return EMBEDDING_DIMENSIONS[modelId]
  }

  // 模糊匹配 (忽略大小写)
  const lowerModelId = modelId.toLowerCase()
  for (const [key, dim] of Object.entries(EMBEDDING_DIMENSIONS)) {
    if (lowerModelId.includes(key.toLowerCase())) {
      logger.debug(`Fuzzy match found: ${modelId} -> ${key} (${dim} dims)`)
      return dim
    }
  }

  // 特殊模式匹配
  // Jina 模型
  if (lowerModelId.includes('jina') && lowerModelId.includes('clip')) {
    return 768
  }
  if (lowerModelId.includes('jina')) {
    return 1024 // 默认 Jina 维度
  }

  // OpenAI 模型
  if (lowerModelId.includes('text-embedding-3')) {
    return lowerModelId.includes('large') ? 3072 : 1536
  }
  if (lowerModelId.includes('ada')) {
    return 1536
  }

  // Gemini 模型
  if (lowerModelId.includes('gemini') || lowerModelId.includes('embedding-001')) {
    return 3072
  }

  // BGE 模型
  if (lowerModelId.includes('bge')) {
    if (lowerModelId.includes('small')) return 384
    if (lowerModelId.includes('large') || lowerModelId.includes('m3')) return 1024
    return 768 // base 默认
  }

  logger.warn(`Unknown embedding model: ${modelId}, using default ${defaultDimensions} dimensions`)
  return defaultDimensions
}

/**
 * 检测是否为 Jina 模型 (需要特殊处理)
 */
export function isJinaModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('jina')
}

/**
 * 检测维度是否可能不匹配
 * @param indexDimensions - 索引维度
 * @param modelId - 模型 ID
 * @returns 是否可能不匹配
 */
export function detectDimensionMismatch(
  indexDimensions: number,
  modelId: string
): { hasMismatch: boolean; expectedDimensions: number } {
  const expectedDimensions = getEmbeddingDimensions(modelId, indexDimensions)
  return {
    hasMismatch: indexDimensions !== expectedDimensions,
    expectedDimensions
  }
}

/**
 * 获取所有已知模型及其维度
 */
export function getAllKnownEmbeddingModels(): Array<{ modelId: string; dimensions: number }> {
  return Object.entries(EMBEDDING_DIMENSIONS).map(([modelId, dimensions]) => ({
    modelId,
    dimensions
  }))
}

export default {
  EMBEDDING_DIMENSIONS,
  getEmbeddingDimensions,
  isJinaModel,
  detectDimensionMismatch,
  getAllKnownEmbeddingModels
}
