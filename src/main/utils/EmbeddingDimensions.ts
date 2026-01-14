/**
 * Embedding 模型维度映射工具
 *
 * 参照 VCPToolBox 的 VECTORDB_DIMENSION 环境变量设计，
 * 提供已知嵌入模型的维度信息，支持自动检测和手动配置。
 *
 * 重要: 由于代理服务可能返回不同维度，建议优先使用动态检测 (detectActualDimensions)
 *
 * @module utils/EmbeddingDimensions
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('EmbeddingDimensions')

/**
 * 已知嵌入模型的维度映射
 * 来源: 各厂商官方文档
 *
 * 注意: 代理服务可能返回不同维度，此表仅作参考
 */
export const EMBEDDING_DIMENSIONS: Record<string, number> = {
  // ==================== OpenAI models ====================
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,

  // ==================== Qwen / 阿里云通义 models ====================
  // Qwen3 系列 - 官方维度 4096
  'qwen3-embedding-8b': 4096,
  'qwen/qwen3-embedding-8b': 4096,
  'qwen3-embedding': 4096,
  // Qwen2 系列
  'qwen2-embedding': 1536,
  // 通义千问 Dashscope
  'text-embedding-v3': 2048,
  'text-embedding-v2': 1536,
  'text-embedding-v1': 1536,

  // ==================== 硅基流动 SiliconFlow models ====================
  'bge-large-zh-v1.5': 1024,
  'bge-large-en-v1.5': 1024,
  'bge-reranker-v2-m3': 1024,

  // ==================== Jina models ====================
  'jina-clip-v2': 768,
  'jina-clip-v1': 512,
  'jina-embeddings-v2-base-en': 768,
  'jina-embeddings-v2-small-en': 512,
  'jina-embeddings-v3': 1024,
  'jina-colbert-v2': 128,

  // ==================== Voyage AI models ====================
  'voyage-3': 1024,
  'voyage-3-lite': 512,
  'voyage-code-3': 1024,
  'voyage-finance-2': 1024,
  'voyage-multilingual-2': 1024,
  'voyage-law-2': 1024,

  // ==================== Google/Gemini models ====================
  'embedding-001': 768,
  'text-embedding-004': 768,
  'gemini-embedding-001': 3072,
  'gemini-embedding-exp-03-07': 3072,

  // ==================== Cohere models ====================
  'embed-english-v3.0': 1024,
  'embed-multilingual-v3.0': 1024,
  'embed-english-light-v3.0': 384,
  'embed-multilingual-light-v3.0': 384,

  // ==================== BGE models (常见本地模型) ====================
  'bge-small-en': 384,
  'bge-small-en-v1.5': 384,
  'bge-base-en': 768,
  'bge-base-en-v1.5': 768,
  'bge-large-en': 1024,
  'bge-m3': 1024,
  'bge-small-zh': 512,
  'bge-small-zh-v1.5': 512,
  'bge-base-zh': 768,
  'bge-base-zh-v1.5': 768,
  'bge-large-zh': 1024,

  // ==================== Ollama 常见模型 ====================
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'snowflake-arctic-embed': 1024,

  // ==================== Mistral models ====================
  'mistral-embed': 1024,

  // ==================== DeepSeek models ====================
  'deepseek-embed': 1536,

  // ==================== 智谱 Zhipu models ====================
  'embedding-2': 1024,
  'embedding-3': 2048,

  // ==================== Baichuan models ====================
  'baichuan-embedding': 1024
}

/**
 * 模式匹配规则 (用于无法精确匹配时)
 * 优先级从高到低
 */
const PATTERN_RULES: Array<{ pattern: RegExp; dimensions: number; name: string }> = [
  // Qwen3 系列 - 4096 维度
  { pattern: /qwen3[-_]?embed/i, dimensions: 4096, name: 'Qwen3 Embedding' },
  { pattern: /qwen\/qwen3[-_]embed/i, dimensions: 4096, name: 'Qwen3 Embedding' },

  // Qwen2 系列
  { pattern: /qwen2[-_]?embed/i, dimensions: 1536, name: 'Qwen2 Embedding' },

  // OpenAI 模型
  { pattern: /text-embedding-3-large/i, dimensions: 3072, name: 'OpenAI Large' },
  { pattern: /text-embedding-3/i, dimensions: 1536, name: 'OpenAI Small' },
  { pattern: /ada[-_]?002/i, dimensions: 1536, name: 'OpenAI Ada' },

  // Jina 模型
  { pattern: /jina[-_]?clip/i, dimensions: 768, name: 'Jina CLIP' },
  { pattern: /jina[-_]?embed.*v3/i, dimensions: 1024, name: 'Jina v3' },
  { pattern: /jina/i, dimensions: 768, name: 'Jina' },

  // Gemini 模型
  { pattern: /gemini[-_]?embed/i, dimensions: 3072, name: 'Gemini' },

  // BGE 模型
  { pattern: /bge[-_]?(m3|large)/i, dimensions: 1024, name: 'BGE Large/M3' },
  { pattern: /bge[-_]?base/i, dimensions: 768, name: 'BGE Base' },
  { pattern: /bge[-_]?small/i, dimensions: 384, name: 'BGE Small' },
  { pattern: /bge/i, dimensions: 1024, name: 'BGE' },

  // Voyage 模型
  { pattern: /voyage[-_]?3[-_]?lite/i, dimensions: 512, name: 'Voyage Lite' },
  { pattern: /voyage/i, dimensions: 1024, name: 'Voyage' },

  // Cohere 模型
  { pattern: /embed[-_]?.*light/i, dimensions: 384, name: 'Cohere Light' },
  { pattern: /embed[-_]?english|embed[-_]?multilingual/i, dimensions: 1024, name: 'Cohere' },

  // 智谱
  { pattern: /embedding[-_]?3/i, dimensions: 2048, name: 'Zhipu v3' },
  { pattern: /embedding[-_]?2/i, dimensions: 1024, name: 'Zhipu v2' },

  // 通用模式
  { pattern: /large/i, dimensions: 1024, name: 'Large variant' },
  { pattern: /small|mini|lite/i, dimensions: 384, name: 'Small variant' }
]

/**
 * 维度查询结果
 */
export interface DimensionResult {
  /** 维度值 */
  dimensions: number
  /** 是否为精确匹配 */
  isExactMatch: boolean
  /** 匹配来源 (exact/pattern/default) */
  source: 'exact' | 'pattern' | 'default'
  /** 匹配的模式名称 (用于调试) */
  matchedPattern?: string
}

/**
 * 从模型名称获取嵌入维度 (增强版)
 *
 * @param modelId - 模型 ID (如 'text-embedding-3-small', 'Qwen/Qwen3-Embedding-8B')
 * @param defaultDimensions - 默认维度 (当模型未知时使用)
 * @returns 嵌入维度
 */
export function getEmbeddingDimensions(
  modelId: string,
  defaultDimensions: number = 1536
): number {
  const result = getEmbeddingDimensionsWithInfo(modelId, defaultDimensions)
  return result.dimensions
}

/**
 * 从模型名称获取嵌入维度 (带详细信息)
 *
 * @param modelId - 模型 ID
 * @param defaultDimensions - 默认维度
 * @returns 维度结果 (包含是否精确匹配等信息)
 */
export function getEmbeddingDimensionsWithInfo(
  modelId: string,
  defaultDimensions: number = 1536
): DimensionResult {
  if (!modelId) {
    return { dimensions: defaultDimensions, isExactMatch: false, source: 'default' }
  }

  // 1. 精确匹配 (大小写敏感)
  if (EMBEDDING_DIMENSIONS[modelId]) {
    return {
      dimensions: EMBEDDING_DIMENSIONS[modelId],
      isExactMatch: true,
      source: 'exact'
    }
  }

  // 2. 精确匹配 (忽略大小写)
  const lowerModelId = modelId.toLowerCase()
  for (const [key, dim] of Object.entries(EMBEDDING_DIMENSIONS)) {
    if (key.toLowerCase() === lowerModelId) {
      logger.debug(`Case-insensitive exact match: ${modelId} -> ${key} (${dim} dims)`)
      return {
        dimensions: dim,
        isExactMatch: true,
        source: 'exact'
      }
    }
  }

  // 3. 包含匹配 (检查模型ID是否包含已知模型名)
  for (const [key, dim] of Object.entries(EMBEDDING_DIMENSIONS)) {
    if (lowerModelId.includes(key.toLowerCase())) {
      logger.debug(`Substring match: ${modelId} contains ${key} (${dim} dims)`)
      return {
        dimensions: dim,
        isExactMatch: false,
        source: 'pattern',
        matchedPattern: key
      }
    }
  }

  // 4. 模式匹配
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(modelId)) {
      logger.debug(`Pattern match: ${modelId} -> ${rule.name} (${rule.dimensions} dims)`)
      return {
        dimensions: rule.dimensions,
        isExactMatch: false,
        source: 'pattern',
        matchedPattern: rule.name
      }
    }
  }

  // 5. 默认值
  logger.warn(`Unknown embedding model: ${modelId}, using default ${defaultDimensions} dimensions. Consider using dynamic detection.`)
  return {
    dimensions: defaultDimensions,
    isExactMatch: false,
    source: 'default'
  }
}

/**
 * 检测是否为 Jina 模型 (需要特殊处理)
 */
export function isJinaModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('jina')
}

/**
 * 检测是否为需要动态检测维度的模型
 *
 * 当静态表无法精确匹配时，建议动态检测
 */
export function needsDynamicDimensionDetection(modelId: string): boolean {
  const result = getEmbeddingDimensionsWithInfo(modelId)
  return !result.isExactMatch
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
): { hasMismatch: boolean; expectedDimensions: number; needsDynamicCheck: boolean } {
  const result = getEmbeddingDimensionsWithInfo(modelId, indexDimensions)
  return {
    hasMismatch: indexDimensions !== result.dimensions,
    expectedDimensions: result.dimensions,
    needsDynamicCheck: !result.isExactMatch
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
  getEmbeddingDimensionsWithInfo,
  isJinaModel,
  needsDynamicDimensionDetection,
  detectDimensionMismatch,
  getAllKnownEmbeddingModels
}
