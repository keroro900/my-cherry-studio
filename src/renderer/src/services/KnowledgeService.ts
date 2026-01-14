import { loggerService } from '@logger'
import type { Span } from '@opentelemetry/api'
import { ModernAiProvider } from '@renderer/aiCore'
import AiProvider from '@renderer/aiCore/legacy'
import { getMessageContent } from '@renderer/aiCore/plugins/searchOrchestrationPlugin'
import { DEFAULT_KNOWLEDGE_DOCUMENT_COUNT, DEFAULT_KNOWLEDGE_THRESHOLD } from '@renderer/config/constant'
import { getEmbeddingMaxContext } from '@renderer/config/embedings'
import { REFERENCE_PROMPT } from '@renderer/config/prompts'
import { addSpan, endSpan } from '@renderer/services/SpanManagerService'
import store from '@renderer/store'
import type { Assistant } from '@renderer/types'
import {
  type FileMetadata,
  type KnowledgeBase,
  type KnowledgeBaseParams,
  type KnowledgeReference,
  type KnowledgeSearchResult,
  SystemProviderIds
} from '@renderer/types'
import type { Chunk } from '@renderer/types/chunk'
import { ChunkType } from '@renderer/types/chunk'
import { MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import { routeToEndpoint } from '@renderer/utils'
import type { ExtractResults } from '@renderer/utils/extract'
import { createCitationBlock } from '@renderer/utils/messageUtils/create'
import { isAzureOpenAIProvider, isGeminiProvider } from '@renderer/utils/provider'
import type { ModelMessage, UserModelMessage } from 'ai'
import { isEmpty } from 'lodash'

import { getProviderByModel } from './AssistantService'
import FileManager from './FileManager'
import type { BlockManager } from './messageStreaming'

const logger = loggerService.withContext('RendererKnowledgeService')

export const getKnowledgeBaseParams = (base: KnowledgeBase): KnowledgeBaseParams => {
  // Guard against undefined model
  if (!base.model) {
    throw new Error('KnowledgeBase model is required but was undefined')
  }

  const rerankProvider = getProviderByModel(base.rerankModel)
  const aiProvider = new ModernAiProvider(base.model)
  const rerankAiProvider = new AiProvider(rerankProvider)

  // get preprocess provider from store instead of base.preprocessProvider
  const preprocessProvider = store
    .getState()
    .preprocess.providers.find((p) => p.id === base.preprocessProvider?.provider.id)
  const updatedPreprocessProvider = preprocessProvider
    ? {
        type: 'preprocess' as const,
        provider: preprocessProvider
      }
    : base.preprocessProvider

  const actualProvider = aiProvider.getActualProvider()

  let { baseURL } = routeToEndpoint(actualProvider.apiHost)

  const rerankHost = rerankAiProvider.getBaseURL()
  if (isGeminiProvider(actualProvider)) {
    baseURL = baseURL + '/openai'
  } else if (isAzureOpenAIProvider(actualProvider)) {
    baseURL = baseURL + '/v1'
  } else if (actualProvider.id === SystemProviderIds.ollama) {
    // LangChain生态不需要/api结尾的URL
    baseURL = baseURL.replace(/\/api$/, '')
  } else if (actualProvider.id === 'jina' || actualProvider.id === '302ai') {
    // Jina API 和 302.AI 需要 /v1 前缀
    // 例如: https://api.jina.ai -> https://api.jina.ai/v1
    // 例如: https://api.302.ai -> https://api.302.ai/v1
    if (!baseURL.includes('/v1')) {
      baseURL = baseURL + '/v1'
    }
  }

  logger.info(`Knowledge base ${base.name} using baseURL: ${baseURL}`)

  let chunkSize = base.chunkSize
  const maxChunkSize = getEmbeddingMaxContext(base.model.id)

  if (maxChunkSize) {
    if (chunkSize && chunkSize > maxChunkSize) {
      chunkSize = maxChunkSize
    }
    if (!chunkSize && maxChunkSize < 1024) {
      chunkSize = maxChunkSize
    }
  }

  return {
    id: base.id,
    dimensions: base.dimensions,
    embedApiClient: {
      model: base.model.id,
      provider: base.model.provider,
      apiKey: aiProvider.getApiKey() || 'secret',
      baseURL
    },
    chunkSize,
    chunkOverlap: base.chunkOverlap,
    rerankApiClient: {
      model: base.rerankModel?.id || '',
      provider: rerankProvider.name.toLowerCase(),
      apiKey: rerankAiProvider.getApiKey() || 'secret',
      baseURL: rerankHost
    },
    documentCount: base.documentCount,
    knowledgeType: base.knowledgeType,
    preprocessProvider: updatedPreprocessProvider
  }
}

export const getFileFromUrl = async (url: string): Promise<FileMetadata | null> => {
  logger.debug(`getFileFromUrl: ${url}`)
  let fileName = ''

  if (url && url.includes('CherryStudio')) {
    if (url.includes('/Data/Files')) {
      fileName = url.split('/Data/Files/')[1]
    }

    if (url.includes('\\Data\\Files')) {
      fileName = url.split('\\Data\\Files\\')[1]
    }
  }
  logger.debug(`fileName: ${fileName}`)
  if (fileName) {
    const actualFileName = fileName.split(/[/\\]/).pop() || fileName
    logger.debug(`actualFileName: ${actualFileName}`)
    const fileId = actualFileName.split('.')[0]
    const file = await FileManager.getFile(fileId)
    if (file) {
      return file
    }
  }

  return null
}

export const getKnowledgeSourceUrl = async (item: KnowledgeSearchResult & { file: FileMetadata | null }) => {
  if (item.metadata.source.startsWith('http')) {
    return item.metadata.source
  }

  if (item.file) {
    return `[${item.file.origin_name}](http://file/${item.file.name})`
  }

  return item.metadata.source
}

export const searchKnowledgeBase = async (
  query: string,
  base: KnowledgeBase,
  rewrite?: string,
  topicId?: string,
  parentSpanId?: string,
  modelName?: string
): Promise<Array<KnowledgeSearchResult & { file: FileMetadata | null }>> => {
  let currentSpan: Span | undefined = undefined
  try {
    const baseParams = getKnowledgeBaseParams(base)
    const documentCount = base.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT
    const threshold = base.threshold || DEFAULT_KNOWLEDGE_THRESHOLD

    if (topicId) {
      currentSpan = addSpan({
        topicId,
        name: `${base.name}-search`,
        inputs: {
          query,
          rewrite,
          base: baseParams
        },
        tag: 'Knowledge',
        parentSpanId,
        modelName
      })
    }

    const searchResults: KnowledgeSearchResult[] = await window.api.knowledgeBase.search(
      {
        search: query || rewrite || '',
        base: baseParams
      },
      currentSpan?.spanContext()
    )

    // 过滤阈值不达标的结果
    const filteredResults = searchResults.filter((item) => item.score >= threshold)

    // 如果有rerank模型，执行重排
    let rerankResults = filteredResults
    if (base.rerankModel && filteredResults.length > 0) {
      rerankResults = await window.api.knowledgeBase.rerank(
        {
          search: rewrite || query,
          base: baseParams,
          results: filteredResults
        },
        currentSpan?.spanContext()
      )
    }

    // 限制文档数量
    const limitedResults = rerankResults.slice(0, documentCount)

    // 处理文件信息
    const result = await Promise.all(
      limitedResults.map(async (item) => {
        const file = await getFileFromUrl(item.metadata.source)
        logger.debug(`Knowledge search item: ${JSON.stringify(item)} File: ${JSON.stringify(file)}`)
        return { ...item, file }
      })
    )
    if (topicId) {
      endSpan({
        topicId,
        outputs: result,
        span: currentSpan,
        modelName
      })
    }
    return result
  } catch (error) {
    logger.error(`Error searching knowledge base ${base.name}:`, error as Error)
    if (topicId) {
      endSpan({
        topicId,
        error: error instanceof Error ? error : new Error(String(error)),
        span: currentSpan,
        modelName
      })
    }
    throw error
  }
}

export const processKnowledgeSearch = async (
  extractResults: ExtractResults,
  knowledgeBaseIds: string[] | undefined,
  topicId: string,
  parentSpanId?: string,
  modelName?: string
): Promise<KnowledgeReference[]> => {
  if (
    !extractResults.knowledge?.question ||
    extractResults.knowledge.question.length === 0 ||
    isEmpty(knowledgeBaseIds)
  ) {
    logger.info('No valid question found in extractResults.knowledge')
    return []
  }

  const questions = extractResults.knowledge.question
  const rewrite = extractResults.knowledge.rewrite

  const bases = store.getState().knowledge.bases.filter((kb) => knowledgeBaseIds?.includes(kb.id))
  if (!bases || bases.length === 0) {
    logger.info('Skipping knowledge search: No matching knowledge bases found.')
    return []
  }

  const span = addSpan({
    topicId,
    name: 'knowledgeSearch',
    inputs: {
      questions,
      rewrite,
      knowledgeBaseIds: knowledgeBaseIds
    },
    tag: 'Knowledge',
    parentSpanId,
    modelName
  })

  // 为每个知识库执行多问题搜索
  const baseSearchPromises = bases.map(async (base) => {
    // 为每个问题搜索并合并结果
    const allResults = await Promise.all(
      questions.map((question) =>
        searchKnowledgeBase(question, base, rewrite, topicId, span?.spanContext().spanId, modelName)
      )
    )

    // 合并结果并去重
    const flatResults = allResults.flat()
    const uniqueResults = Array.from(
      new Map(flatResults.map((item) => [item.metadata.uniqueId || item.pageContent, item])).values()
    ).sort((a, b) => b.score - a.score)

    // 转换为引用格式
    const result = await Promise.all(
      uniqueResults.map(
        async (item, index) =>
          ({
            id: index + 1,
            content: item.pageContent,
            sourceUrl: await getKnowledgeSourceUrl(item),
            metadata: item.metadata,
            type: 'file'
          }) as KnowledgeReference
      )
    )
    return result
  })

  // 汇总所有知识库的结果
  const resultsPerBase = await Promise.all(baseSearchPromises)
  const allReferencesRaw = resultsPerBase.flat().filter((ref): ref is KnowledgeReference => !!ref)
  endSpan({
    topicId,
    outputs: resultsPerBase,
    span,
    modelName
  })

  // 重新为引用分配ID
  return allReferencesRaw.map((ref, index) => ({
    ...ref,
    id: index + 1
  }))
}

/**
 * 处理知识库搜索结果中的引用
 * @param references 知识库引用
 * @param onChunkReceived Chunk接收回调
 */
export function processKnowledgeReferences(
  references: KnowledgeReference[] | undefined,
  onChunkReceived: (chunk: Chunk) => void
) {
  if (!references || references.length === 0) {
    return
  }

  for (const ref of references) {
    const { metadata } = ref
    if (!metadata?.source) {
      continue
    }

    switch (metadata.type) {
      case 'video': {
        onChunkReceived({
          type: ChunkType.VIDEO_SEARCHED,
          video: {
            type: 'path',
            content: metadata.source
          },
          metadata
        })
        break
      }
    }
  }
}

export const injectUserMessageWithKnowledgeSearchPrompt = async ({
  modelMessages,
  assistant,
  assistantMsgId,
  topicId,
  blockManager,
  setCitationBlockId
}: {
  modelMessages: ModelMessage[]
  assistant: Assistant
  assistantMsgId: string
  topicId?: string
  blockManager: BlockManager
  setCitationBlockId: (blockId: string) => void
}) => {
  if (assistant.knowledge_bases?.length && modelMessages.length > 0) {
    const lastUserMessage = modelMessages[modelMessages.length - 1]
    const isUserMessage = lastUserMessage.role === 'user'

    if (!isUserMessage) {
      return
    }

    const knowledgeReferences = await getKnowledgeReferences({
      assistant,
      lastUserMessage,
      topicId: topicId
    })

    if (knowledgeReferences.length === 0) {
      return
    }

    await createKnowledgeReferencesBlock({
      assistantMsgId,
      knowledgeReferences,
      blockManager,
      setCitationBlockId
    })

    const question = getMessageContent(lastUserMessage) || ''
    const references = JSON.stringify(knowledgeReferences, null, 2)

    const knowledgeSearchPrompt = REFERENCE_PROMPT.replace('{question}', question).replace('{references}', references)

    if (typeof lastUserMessage.content === 'string') {
      lastUserMessage.content = knowledgeSearchPrompt
    } else if (Array.isArray(lastUserMessage.content)) {
      const textPart = lastUserMessage.content.find((part) => part.type === 'text')
      if (textPart) {
        textPart.text = knowledgeSearchPrompt
      } else {
        lastUserMessage.content.push({
          type: 'text',
          text: knowledgeSearchPrompt
        })
      }
    }
  }
}

export const getKnowledgeReferences = async ({
  assistant,
  lastUserMessage,
  topicId
}: {
  assistant: Assistant
  lastUserMessage: UserModelMessage
  topicId?: string
}) => {
  // 如果助手没有知识库，返回空字符串
  if (!assistant || isEmpty(assistant.knowledge_bases)) {
    return []
  }

  // 获取知识库ID
  const knowledgeBaseIds = assistant.knowledge_bases?.map((base) => base.id)

  // 获取用户消息内容
  const question = getMessageContent(lastUserMessage) || ''

  // 获取知识库引用
  const knowledgeReferences = await processKnowledgeSearch(
    {
      knowledge: {
        question: [question],
        rewrite: ''
      }
    },
    knowledgeBaseIds,
    topicId!
  )

  // 返回提示词
  return knowledgeReferences
}

export const createKnowledgeReferencesBlock = async ({
  assistantMsgId,
  knowledgeReferences,
  blockManager,
  setCitationBlockId
}: {
  assistantMsgId: string
  knowledgeReferences: KnowledgeReference[]
  blockManager: BlockManager
  setCitationBlockId: (blockId: string) => void
}) => {
  // 创建引用块
  const citationBlock = createCitationBlock(
    assistantMsgId,
    { knowledge: knowledgeReferences },
    { status: MessageBlockStatus.SUCCESS }
  )

  // 处理引用块
  blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION)

  // 设置引用块ID
  setCitationBlockId(citationBlock.id)

  // 返回引用块
  return citationBlock
}

// ==================== VCP 增强检索 ====================

/**
 * VCP 增强搜索结果
 */
export interface VCPSearchResult {
  content: string
  score: number
  metadata?: Record<string, unknown>
}

/**
 * VCP增强知识库检索
 * 支持时间感知、语义组、TagMemo等高级功能
 *
 * @param params - 检索参数
 * @returns 检索结果列表
 */
export async function vcpEnhancedSearch(params: {
  knowledgeBaseId: string
  query: string
  mode?: 'rag' | 'fulltext' | 'threshold_rag' | 'threshold_fulltext'
  modifiers?: {
    time?: boolean
    group?: boolean
    tagMemo?: number
    topK?: number
    threshold?: number
  }
}): Promise<VCPSearchResult[]> {
  try {
    const result = await window.electron.ipcRenderer.invoke('vcp:search:enhanced', params)

    if (result.success && result.items) {
      logger.debug('VCP enhanced search completed', {
        knowledgeBaseId: params.knowledgeBaseId,
        mode: params.mode,
        resultCount: result.items.length
      })
      return result.items
    }

    if (!result.success) {
      logger.warn('VCP enhanced search failed', { message: result.message })
    }

    return []
  } catch (error) {
    logger.error('VCP enhanced search error:', error as Error)
    return []
  }
}

/**
 * 获取知识库列表
 * 用于 VCP 声明语法的名称解析
 */
export async function vcpListKnowledgeBases(): Promise<Array<{ id: string; name: string; description?: string }>> {
  try {
    const result = await window.electron.ipcRenderer.invoke('vcp:knowledge:list')
    if (result.success && result.bases) {
      return result.bases
    }
    return []
  } catch (error) {
    logger.error('Failed to list knowledge bases:', error as Error)
    return []
  }
}

/**
 * 日记条目同步结果
 */
export interface DiarySyncEntry {
  id: string
  content: string
  sourceUrl: string
  metadata: {
    characterName: string
    date: string
    title?: string
    tags: string[]
  }
}

/**
 * 准备日记条目用于同步到知识库
 * 从主进程获取格式化的日记条目，准备进行向量化
 *
 * @param params - 同步参数
 * @returns 准备好的日记条目列表
 */
export async function prepareDiaryForSync(params: {
  entryIds?: string[]
  syncAll?: boolean
}): Promise<{ success: boolean; entries: DiarySyncEntry[]; message: string }> {
  try {
    const result = await window.electron.ipcRenderer.invoke('vcp:diary:syncToKnowledge', params)

    if (result.success) {
      logger.info('Diary entries prepared for sync', {
        count: result.entries?.length || 0
      })
    }

    return {
      success: result.success,
      entries: result.entries || [],
      message: result.message || ''
    }
  } catch (error) {
    logger.error('Failed to prepare diary entries for sync:', error as Error)
    return { success: false, entries: [], message: String(error) }
  }
}

// ==================== 统一记忆集成 (Integrated Memory) ====================

/**
 * 统一记忆搜索结果
 */
export interface IntegratedMemoryResult {
  id: string
  content: string
  score: number
  backend: string
  type: 'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'
  matchedTags?: string[]
  metadata?: Record<string, unknown>
  learning?: {
    appliedWeight: number
    rawScore: number
    matchedLearningTags: string[]
  }
}

/**
 * 统一知识库和记忆搜索
 * 整合 KnowledgeBase 搜索 + IntegratedMemory 搜索，提供统一结果
 *
 * @param params - 搜索参数
 * @returns 合并的搜索结果
 */
export async function unifiedKnowledgeAndMemorySearch(params: {
  query: string
  assistant?: Assistant
  knowledgeBaseIds?: string[]
  memoryBackends?: Array<'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
  topK?: number
  threshold?: number
  topicId?: string
}): Promise<{
  knowledgeResults: KnowledgeReference[]
  memoryResults: IntegratedMemoryResult[]
  combined: Array<KnowledgeReference | IntegratedMemoryResult>
}> {
  const { query, assistant, knowledgeBaseIds, memoryBackends, topK = 10, threshold = 0.1, topicId } = params

  const results = {
    knowledgeResults: [] as KnowledgeReference[],
    memoryResults: [] as IntegratedMemoryResult[],
    combined: [] as Array<KnowledgeReference | IntegratedMemoryResult>
  }

  try {
    // 并行执行知识库搜索和记忆搜索
    const [kbResults, memResults] = await Promise.all([
      // 知识库搜索
      (async () => {
        const baseIds = knowledgeBaseIds || assistant?.knowledge_bases?.map((b) => b.id) || []
        if (baseIds.length === 0) return []

        return processKnowledgeSearch(
          {
            knowledge: {
              question: [query],
              rewrite: query
            }
          },
          baseIds,
          topicId || 'unified-search'
        )
      })(),

      // 统一记忆搜索
      (async () => {
        try {
          const response = await window.api.integratedMemory.intelligentSearch({
            query,
            options: {
              backends: memoryBackends || ['diary', 'memory', 'lightmemo', 'deepmemo'],
              topK,
              threshold,
              applyLearning: true,
              recordQuery: true
            }
          })

          if (response.success && response.results) {
            return response.results.map((r) => ({
              id: r.id,
              content: r.content,
              score: r.score,
              backend: r.backend,
              type: r.backend as IntegratedMemoryResult['type'],
              matchedTags: r.matchedTags,
              metadata: r.metadata,
              learning: r.learning
            }))
          }
          return []
        } catch (error) {
          logger.warn('Integrated memory search failed, continuing with KB results only', error as Error)
          return []
        }
      })()
    ])

    results.knowledgeResults = kbResults
    results.memoryResults = memResults

    // 合并结果 (按分数排序)
    const allResults: Array<(KnowledgeReference | IntegratedMemoryResult) & { sortScore: number }> = [
      ...kbResults.map((r) => ({ ...r, sortScore: 1.0 })), // KB结果优先
      ...memResults.map((r) => ({ ...r, sortScore: r.score }))
    ]

    allResults.sort((a, b) => b.sortScore - a.sortScore)
    results.combined = allResults.slice(0, topK * 2) // 返回 2x topK 结果

    logger.debug('Unified knowledge and memory search completed', {
      query: query.slice(0, 50),
      kbResultCount: kbResults.length,
      memResultCount: memResults.length,
      combinedCount: results.combined.length
    })
  } catch (error) {
    logger.error('Unified knowledge and memory search failed', error as Error)
  }

  return results
}

/**
 * 为助手增强知识库搜索
 * 在原有知识库搜索基础上，添加统一记忆搜索结果
 */
export async function enhancedAssistantKnowledgeSearch(params: {
  assistant: Assistant
  query: string
  topicId: string
  includeMemory?: boolean
}): Promise<KnowledgeReference[]> {
  const { assistant, query, topicId, includeMemory = true } = params

  // 基础知识库搜索
  const knowledgeBaseIds = assistant.knowledge_bases?.map((b) => b.id)
  if (!knowledgeBaseIds?.length && !includeMemory) {
    return []
  }

  const { knowledgeResults, memoryResults } = await unifiedKnowledgeAndMemorySearch({
    query,
    assistant,
    knowledgeBaseIds,
    topicId
  })

  // 如果不需要记忆，直接返回知识库结果
  if (!includeMemory) {
    return knowledgeResults
  }

  // 将记忆结果转换为 KnowledgeReference 格式
  const memoryAsReferences: KnowledgeReference[] = memoryResults.map((m, idx) => ({
    id: knowledgeResults.length + idx + 1,
    content: m.content,
    sourceUrl: `memory://${m.backend}/${m.id}`,
    type: 'memory' as const,
    metadata: {
      ...m.metadata,
      backend: m.backend,
      matchedTags: m.matchedTags,
      learning: m.learning
    }
  }))

  // 合并结果
  return [...knowledgeResults, ...memoryAsReferences]
}
