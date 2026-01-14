/**
 * Native VCP IPC 处理器
 *
 * 提供 Native VCP 相关的 IPC 接口：
 * - Native 模块状态
 * - 数据库统计
 * - Trace 查询
 * - 日志查询
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import {
  createTagCooccurrenceMatrix,
  createTracer,
  createSearchEngine,
  createVectorStore,
  createHybridSearchEngine,
  createTextChunker,
  createChineseSearchEngine,
  createWaveRAGEngine,
  quickChunk,
  quickRrfFusion,
  quickWaveRAGSearch,
  estimateTokenCount,
  healthCheck,
  initializeNativeVCP,
  vectorOps,
  waveragOps,
  setLogCallback,
  clearLogCallback,
  hasLogCallback,
  type SpanInfo,
  type SearchDocument,
  type SearchResultItem,
  type ChineseSearchDocument,
  type NativeLogEntry,
  type WaveRAGConfig,
  type TagPairUpdate
} from './native'
import { getIntegratedMemoryCoordinator } from './memory/IntegratedMemoryCoordinator'
import { getMemoryCallTracer } from './memory/MemoryCallTracer'

const logger = loggerService.withContext('NativeVCPIpc')

// 存储活跃的 Traces
const activeTraces = new Map<string, ReturnType<typeof createTracer>>()
const recentLogs: Array<{
  id: string
  timestamp: string
  level: string
  target: string
  message: string
  traceId?: string
  spanId?: string
  metadata?: Record<string, unknown>
}> = []

const MAX_LOGS = 1000

/**
 * 添加日志条目
 */
function addLogEntry(entry: Omit<typeof recentLogs[0], 'id'>) {
  recentLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...entry
  })

  // 限制日志数量
  while (recentLogs.length > MAX_LOGS) {
    recentLogs.pop()
  }
}

/**
 * 注册 Native VCP IPC 处理器
 */
export function registerNativeVCPIpcHandlers(): void {
  logger.info('Registering Native VCP IPC handlers')

  // 设置 Native 日志回调，将 Rust 日志转发到 Node.js 日志系统
  setLogCallback((entry: NativeLogEntry) => {
    addLogEntry({
      timestamp: entry.timestamp,
      level: entry.level,
      target: entry.target,
      message: entry.message,
      metadata: entry.fields ? JSON.parse(entry.fields) : undefined,
      spanId: entry.span
    })
  })
  logger.info('Native log callback initialized')

  // 初始化 Native 模块
  ipcMain.handle('vcp:native:initialize', async () => {
    try {
      const status = await initializeNativeVCP()
      return { success: true, data: status }
    } catch (error) {
      logger.error('Failed to initialize Native VCP', { error })
      return { success: false, error: String(error) }
    }
  })

  // 获取 Native 状态
  ipcMain.handle('vcp:native:status', async () => {
    try {
      const status = healthCheck()
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取数据库统计
  ipcMain.handle('vcp:native:dbStats', async () => {
    try {
      // 从 IntegratedMemoryCoordinator 获取真实统计
      const coordinator = getIntegratedMemoryCoordinator()
      const integratedStats = await coordinator.getIntegratedStats()

      // 计算总文档数
      const memoryStats = integratedStats.memoryStats
      const totalDocs = memoryStats.backends.reduce((sum, b) => sum + b.documentCount, 0)

      const stats = {
        memoryCount: totalDocs,
        knowledgeCount: memoryStats.backends.find((b) => b.backend === 'knowledge')?.documentCount || 0,
        diaryCount: memoryStats.backends.find((b) => b.backend === 'diary')?.documentCount || 0,
        tagCount: integratedStats.tagPoolStats.totalTags,
        traceCount: activeTraces.size,
        fileSizeBytes: 0 // TODO: 从数据库获取文件大小
      }
      return { success: true, data: stats }
    } catch (error) {
      logger.error('Failed to get database stats', { error })
      return { success: false, error: String(error) }
    }
  })

  // 获取最近的 Traces
  ipcMain.handle('vcp:native:traces', async () => {
    try {
      const traces = Array.from(activeTraces.entries()).map(([traceId, tracer]) => {
        const spans = tracer.getSpans()
        const firstSpan = spans[0]
        const lastSpan = spans[spans.length - 1]

        return {
          traceId,
          operation: firstSpan?.operation || 'unknown',
          status: spans.some((s: SpanInfo) => s.status === 'running')
            ? 'running'
            : spans.every((s: SpanInfo) => s.status === 'completed')
              ? 'completed'
              : 'failed',
          startTime: firstSpan?.startTime || new Date().toISOString(),
          endTime: lastSpan?.endTime,
          durationMs: lastSpan?.durationMs,
          spans
        }
      })

      return { success: true, data: traces }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取最近的日志
  ipcMain.handle('vcp:native:logs', async () => {
    try {
      return { success: true, data: recentLogs.slice(0, 100) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 创建 Trace
  ipcMain.handle('vcp:native:createTrace', async (_event, operation: string) => {
    try {
      const tracer = createTracer()
      const traceId = tracer.getTraceId()
      const spanId = tracer.startSpan(operation)

      activeTraces.set(traceId, tracer)

      addLogEntry({
        timestamp: new Date().toISOString(),
        level: 'info',
        target: 'NativeVCP',
        message: `Trace started: ${operation}`,
        traceId,
        spanId
      })

      return { success: true, data: { traceId, spanId } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 结束 Span
  ipcMain.handle(
    'vcp:native:endSpan',
    async (_event, traceId: string, spanId: string, status?: string, metadata?: string) => {
      try {
        const tracer = activeTraces.get(traceId)
        if (!tracer) {
          return { success: false, error: 'Trace not found' }
        }

        tracer.endSpan(spanId, status, metadata)

        addLogEntry({
          timestamp: new Date().toISOString(),
          level: 'info',
          target: 'NativeVCP',
          message: `Span ended: ${spanId}`,
          traceId,
          spanId
        })

        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // 向量相似度计算
  ipcMain.handle('vcp:native:cosineSimilarity', async (_event, a: number[], b: number[]) => {
    try {
      const result = vectorOps.cosineSimilarity(a, b)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 批量相似度计算
  ipcMain.handle(
    'vcp:native:batchSimilarity',
    async (_event, query: number[], vectors: number[][], k: number) => {
      try {
        const result = vectorOps.topKSimilar(query, vectors, k)
        return { success: true, data: result }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // TagMemo 操作
  let tagMatrix: ReturnType<typeof createTagCooccurrenceMatrix> | null = null

  ipcMain.handle('vcp:native:tagmemo:init', async (_event, alpha?: number, beta?: number) => {
    try {
      tagMatrix = createTagCooccurrenceMatrix(alpha, beta)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:tagmemo:update', async (_event, tag1: string, tag2: string, weight?: number) => {
    try {
      if (!tagMatrix) {
        tagMatrix = createTagCooccurrenceMatrix()
      }
      tagMatrix.update(tag1, tag2, weight)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:tagmemo:associations', async (_event, tag: string, topK?: number) => {
    try {
      if (!tagMatrix) {
        return { success: true, data: [] }
      }
      const result = tagMatrix.getAssociations(tag, topK)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:tagmemo:expand', async (_event, tags: string[], factor?: number) => {
    try {
      if (!tagMatrix) {
        return { success: true, data: tags }
      }
      const result = tagMatrix.expandQuery(tags, factor)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:tagmemo:stats', async () => {
    try {
      if (!tagMatrix) {
        return { success: true, data: { tagCount: 0, pairCount: 0, totalUpdates: 0, alpha: 0.8, beta: 0.2 } }
      }
      const result = tagMatrix.getStats()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 向量级标签增强 (VCPToolBox _applyTagBoost 完整实现)
  ipcMain.handle(
    'vcp:native:tagmemo:boostVector',
    async (
      _event,
      params: {
        originalVector: number[]
        queryTags: string[]
        contentTags: string[]
        tagVectors?: number[]
        tagNames?: string[]
        vectorDim: number
        alphaMin?: number
        alphaMax?: number
        betaBase?: number
        maxBoostRatio?: number
      }
    ) => {
      try {
        if (!tagMatrix) {
          tagMatrix = createTagCooccurrenceMatrix()
        }
        // 调用 Rust 的 boostVector 方法
        if (typeof (tagMatrix as Record<string, unknown>).boostVector === 'function') {
          const result = (tagMatrix as Record<string, (p: typeof params) => unknown>).boostVector(params)
          return { success: true, data: result }
        }
        // Fallback: 返回原始向量
        return {
          success: true,
          data: {
            fusedVector: params.originalVector,
            originalScore: 0,
            boostedScore: 0,
            matchedTags: [],
            expansionTags: [],
            boostFactor: 1.0,
            contextBlendRatio: 0,
            dynamicAlpha: params.alphaMin || 1.5,
            dynamicBeta: params.betaBase || 2.0
          }
        }
      } catch (error) {
        logger.error('boostVector failed', { error })
        return { success: false, error: String(error) }
      }
    }
  )

  // 批量向量增强
  ipcMain.handle(
    'vcp:native:tagmemo:batchBoostVectors',
    async (
      _event,
      params: {
        originalVectors: number[][]
        queryTags: string[]
        contentTagsList: string[][]
        tagVectors?: number[]
        tagNames?: string[]
        vectorDim: number
        alphaMin?: number
        alphaMax?: number
        betaBase?: number
        maxBoostRatio?: number
      }
    ) => {
      try {
        if (!tagMatrix) {
          tagMatrix = createTagCooccurrenceMatrix()
        }
        // 调用 Rust 的 batchBoostVectors 方法
        if (typeof (tagMatrix as Record<string, unknown>).batchBoostVectors === 'function') {
          const result = (tagMatrix as Record<string, (...args: unknown[]) => unknown>).batchBoostVectors(
            params.originalVectors,
            params.queryTags,
            params.contentTagsList,
            params.tagVectors,
            params.tagNames,
            params.vectorDim,
            params.alphaMin,
            params.alphaMax,
            params.betaBase,
            params.maxBoostRatio
          )
          return { success: true, data: result }
        }
        // Fallback: 返回原始向量
        return {
          success: true,
          data: params.originalVectors.map((vec) => ({
            fusedVector: vec,
            originalScore: 0,
            boostedScore: 0,
            matchedTags: [],
            expansionTags: [],
            boostFactor: 1.0,
            contextBlendRatio: 0,
            dynamicAlpha: params.alphaMin || 1.5,
            dynamicBeta: params.betaBase || 2.0
          }))
        }
      } catch (error) {
        logger.error('batchBoostVectors failed', { error })
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== WaveRAG 三阶段检索 ====================

  // 存储 WaveRAG 引擎实例
  const waveragEngines = new Map<string, ReturnType<typeof createWaveRAGEngine>>()
  let waveragCounter = 0

  ipcMain.handle('vcp:native:waverag:create', async (_event, config?: WaveRAGConfig) => {
    try {
      const engine = createWaveRAGEngine(config)
      const engineId = `waverag_${Date.now()}_${++waveragCounter}`
      waveragEngines.set(engineId, engine)
      logger.info('WaveRAG engine created', { engineId })
      return { success: true, engineId }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'vcp:native:waverag:search',
    async (
      _event,
      engineId: string,
      queryTags: string[],
      bm25Results: SearchResultItem[],
      vectorResults: SearchResultItem[],
      configOverride?: WaveRAGConfig
    ) => {
      try {
        const engine = waveragEngines.get(engineId)
        if (!engine) {
          return { success: false, error: `WaveRAG engine not found: ${engineId}` }
        }
        const result = waveragOps.search(engine, queryTags, bm25Results, vectorResults, configOverride)
        return { success: true, data: result }
      } catch (error) {
        logger.error('WaveRAG search failed', { engineId, error })
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'vcp:native:waverag:quickSearch',
    async (
      _event,
      queryTags: string[],
      bm25Results: SearchResultItem[],
      vectorResults: SearchResultItem[],
      config?: WaveRAGConfig
    ) => {
      try {
        const result = quickWaveRAGSearch(queryTags, bm25Results, vectorResults, config)
        return { success: true, data: result }
      } catch (error) {
        logger.error('WaveRAG quick search failed', { error })
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'vcp:native:waverag:updateTagMatrix',
    async (_event, engineId: string, tag1: string, tag2: string, weight?: number) => {
      try {
        const engine = waveragEngines.get(engineId)
        if (!engine) {
          return { success: false, error: `WaveRAG engine not found: ${engineId}` }
        }
        waveragOps.updateTagMatrix(engine, tag1, tag2, weight)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'vcp:native:waverag:batchUpdateTagMatrix',
    async (_event, engineId: string, updates: TagPairUpdate[]) => {
      try {
        const engine = waveragEngines.get(engineId)
        if (!engine) {
          return { success: false, error: `WaveRAG engine not found: ${engineId}` }
        }
        waveragOps.batchUpdateTagMatrix(engine, updates)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('vcp:native:waverag:stats', async (_event, engineId: string) => {
    try {
      const engine = waveragEngines.get(engineId)
      if (!engine) {
        return { success: false, error: `WaveRAG engine not found: ${engineId}` }
      }
      const stats = waveragOps.getStats(engine)
      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:waverag:config', async (_event, engineId: string) => {
    try {
      const engine = waveragEngines.get(engineId)
      if (!engine) {
        return { success: false, error: `WaveRAG engine not found: ${engineId}` }
      }
      const config = waveragOps.getConfig(engine)
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:waverag:updateConfig', async (_event, engineId: string, config: WaveRAGConfig) => {
    try {
      const engine = waveragEngines.get(engineId)
      if (!engine) {
        return { success: false, error: `WaveRAG engine not found: ${engineId}` }
      }
      waveragOps.updateConfig(engine, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'vcp:native:waverag:computeTagBoost',
    async (
      _event,
      engineId: string,
      params: {
        queryTags: string[]
        contentTags: string[]
        originalScore?: number
        alphaMin?: number
        alphaMax?: number
        betaBase?: number
      }
    ) => {
      try {
        const engine = waveragEngines.get(engineId)
        if (!engine) {
          return { success: false, error: `WaveRAG engine not found: ${engineId}` }
        }
        const result = waveragOps.computeTagBoost(engine, params)
        return { success: true, data: result }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('vcp:native:waverag:exportTagMatrix', async (_event, engineId: string) => {
    try {
      const engine = waveragEngines.get(engineId)
      if (!engine) {
        return { success: false, error: `WaveRAG engine not found: ${engineId}` }
      }
      const json = waveragOps.exportTagMatrixToJson(engine)
      return { success: true, data: json }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:waverag:loadTagMatrix', async (_event, engineId: string, json: string) => {
    try {
      const engine = waveragEngines.get(engineId)
      if (!engine) {
        return { success: false, error: `WaveRAG engine not found: ${engineId}` }
      }
      waveragOps.loadTagMatrixFromJson(engine, json)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:waverag:destroy', async (_event, engineId: string) => {
    try {
      if (waveragEngines.has(engineId)) {
        waveragEngines.delete(engineId)
        logger.info('WaveRAG engine destroyed', { engineId })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== SearchEngine 操作 ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let searchEngine: any = null

  ipcMain.handle('vcp:native:search:init', async (_event, indexPath: string) => {
    try {
      searchEngine = createSearchEngine(indexPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:search:add', async (_event, doc: SearchDocument) => {
    try {
      if (!searchEngine) {
        return { success: false, error: 'SearchEngine not initialized' }
      }
      searchEngine.addDocument(doc)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:search:addBatch', async (_event, docs: SearchDocument[]) => {
    try {
      if (!searchEngine) {
        return { success: false, error: 'SearchEngine not initialized' }
      }
      const count = searchEngine.addDocuments(docs)
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:search:query', async (_event, query: string, limit?: number) => {
    try {
      if (!searchEngine) {
        return { success: true, data: [] }
      }
      const results = searchEngine.search(query, limit)
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:search:commit', async () => {
    try {
      if (searchEngine) {
        searchEngine.commit()
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:search:stats', async () => {
    try {
      if (!searchEngine) {
        return { success: true, data: { documentCount: 0 } }
      }
      const stats = searchEngine.getStats()
      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== VectorStore 操作 ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vectorStore: any = null

  ipcMain.handle('vcp:native:vector:init', async (_event, dim: number) => {
    try {
      vectorStore = createVectorStore(dim)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:vector:add', async (_event, id: string, vector: number[]) => {
    try {
      if (!vectorStore) {
        return { success: false, error: 'VectorStore not initialized' }
      }
      vectorStore.add(id, vector)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:vector:search', async (_event, query: number[], k: number) => {
    try {
      if (!vectorStore) {
        return { success: true, data: [] }
      }
      const results = vectorStore.search(query, k)
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:vector:size', async () => {
    try {
      const size = vectorStore?.size() || 0
      return { success: true, data: size }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== HybridSearchEngine 操作 ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hybridSearchEngine: any = null

  ipcMain.handle(
    'vcp:native:hybrid:init',
    async (_event, bm25Weight?: number, vectorWeight?: number, tagBoostWeight?: number) => {
      try {
        hybridSearchEngine = createHybridSearchEngine(bm25Weight, vectorWeight, tagBoostWeight)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('vcp:native:hybrid:setWeights', async (_event, bm25: number, vector: number, tagBoost: number) => {
    try {
      if (!hybridSearchEngine) {
        hybridSearchEngine = createHybridSearchEngine()
      }
      hybridSearchEngine.setWeights(bm25, vector, tagBoost)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:hybrid:setRrfK', async (_event, k: number) => {
    try {
      if (!hybridSearchEngine) {
        hybridSearchEngine = createHybridSearchEngine()
      }
      hybridSearchEngine.setRrfK(k)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'vcp:native:hybrid:fuse',
    async (
      _event,
      bm25Results: SearchResultItem[],
      vectorResults: SearchResultItem[],
      tagBoostScores?: Record<string, number>,
      limit?: number
    ) => {
      try {
        if (!hybridSearchEngine) {
          hybridSearchEngine = createHybridSearchEngine()
        }
        const tagBoostMap = tagBoostScores ? new Map(Object.entries(tagBoostScores)) : undefined
        const results = hybridSearchEngine.fuseResults(bm25Results, vectorResults, tagBoostMap, limit)
        return { success: true, data: results }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('vcp:native:hybrid:config', async () => {
    try {
      if (!hybridSearchEngine) {
        return { success: true, data: { bm25Weight: 0.5, vectorWeight: 0.5, tagBoostWeight: 0.2, rrfK: 60 } }
      }
      const config = hybridSearchEngine.getConfig()
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 便捷函数：快速 RRF 融合（无需实例）
  ipcMain.handle(
    'vcp:native:quickRrfFusion',
    async (_event, bm25Results: SearchResultItem[], vectorResults: SearchResultItem[], limit?: number) => {
      try {
        const results = quickRrfFusion(bm25Results, vectorResults, limit)
        return { success: true, data: results }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== TextChunker 操作 ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let textChunker: any = null

  ipcMain.handle('vcp:native:chunker:init', async (_event, maxChunkSize?: number, overlapSize?: number) => {
    try {
      textChunker = createTextChunker(maxChunkSize, overlapSize)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:setSeparators', async (_event, separators: string[]) => {
    try {
      if (!textChunker) {
        textChunker = createTextChunker()
      }
      textChunker.setSeparators(separators)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:chunk', async (_event, text: string) => {
    try {
      if (!textChunker) {
        textChunker = createTextChunker()
      }
      const chunks = textChunker.chunk(text)
      return { success: true, data: chunks }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:chunkBatch', async (_event, texts: string[]) => {
    try {
      if (!textChunker) {
        textChunker = createTextChunker()
      }
      const results = textChunker.chunkBatch(texts)
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:estimateTokens', async (_event, text: string) => {
    try {
      if (!textChunker) {
        textChunker = createTextChunker()
      }
      const tokens = textChunker.estimateTokens(text)
      return { success: true, data: tokens }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:chunkByTokens', async (_event, text: string, maxTokens?: number, overlapTokens?: number) => {
    try {
      if (!textChunker) {
        textChunker = createTextChunker()
      }
      const chunks = textChunker.chunkByTokens(text, maxTokens, overlapTokens)
      return { success: true, data: chunks }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chunker:config', async () => {
    try {
      if (!textChunker) {
        return { success: true, data: { maxChunkSize: 1000, overlapSize: 200, separators: [] } }
      }
      const config = textChunker.getConfig()
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 便捷函数：快速分块（无需实例）
  ipcMain.handle('vcp:native:quickChunk', async (_event, text: string, maxSize?: number, overlap?: number) => {
    try {
      const chunks = quickChunk(text, maxSize, overlap)
      return { success: true, data: chunks }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 便捷函数：估算 token 数量
  ipcMain.handle('vcp:native:estimateTokenCount', async (_event, text: string) => {
    try {
      const count = estimateTokenCount(text)
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== ChineseSearchEngine 操作 ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chineseSearchEngine: any = null

  ipcMain.handle('vcp:native:chinese:init', async (_event, indexPath: string) => {
    try {
      chineseSearchEngine = createChineseSearchEngine(indexPath)
      return { success: true }
    } catch (error) {
      logger.warn('ChineseSearchEngine initialization failed (requires native module)', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chinese:add', async (_event, doc: ChineseSearchDocument) => {
    try {
      if (!chineseSearchEngine) {
        return { success: false, error: 'ChineseSearchEngine not initialized' }
      }
      chineseSearchEngine.addDocument(doc)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chinese:addBatch', async (_event, docs: ChineseSearchDocument[]) => {
    try {
      if (!chineseSearchEngine) {
        return { success: false, error: 'ChineseSearchEngine not initialized' }
      }
      const count = chineseSearchEngine.addDocuments(docs)
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chinese:query', async (_event, query: string, limit?: number) => {
    try {
      if (!chineseSearchEngine) {
        return { success: true, data: [] }
      }
      const results = chineseSearchEngine.search(query, limit)
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chinese:commit', async () => {
    try {
      if (chineseSearchEngine) {
        chineseSearchEngine.commit()
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:native:chinese:stats', async () => {
    try {
      if (!chineseSearchEngine) {
        return { success: true, data: { documentCount: 0, isNative: false } }
      }
      const stats = chineseSearchEngine.getStats()
      return { success: true, data: { ...stats, isNative: true } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== 日志回调管理 ====================

  // 检查日志回调是否已设置
  ipcMain.handle('vcp:native:log:hasCallback', async () => {
    try {
      return { success: true, data: hasLogCallback() }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 清除日志回调
  ipcMain.handle('vcp:native:log:clear', async () => {
    try {
      clearLogCallback()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== MemoryCallTracer 操作 ====================

  // 获取记忆调用记录
  ipcMain.handle('vcp:native:memory:traces', async (_event, limit?: number) => {
    try {
      const tracer = getMemoryCallTracer()
      const records = tracer.getRecords(limit || 100)
      return { success: true, data: records }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取记忆调用统计
  ipcMain.handle('vcp:native:memory:stats', async () => {
    try {
      const tracer = getMemoryCallTracer()
      const stats = tracer.getStats()
      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取记忆调用链路图
  ipcMain.handle('vcp:native:memory:callGraph', async () => {
    try {
      const tracer = getMemoryCallTracer()
      const graph = tracer.getCallGraph()
      return { success: true, data: graph }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取向量存储位置信息
  ipcMain.handle('vcp:native:memory:vectorStorage', async () => {
    try {
      // 从 MemoryCallTracer 获取存储位置和维度信息
      const tracer = getMemoryCallTracer()
      const storageInfo = tracer.getVectorStorageInfo()

      // 从 IntegratedMemoryCoordinator 获取真实文档数
      const coordinator = getIntegratedMemoryCoordinator()
      const integratedStats = await coordinator.getIntegratedStats()
      const backendStats = integratedStats.memoryStats.backends

      // 后端名称映射: MemoryCallTracer 名称 -> UnifiedMemoryStats 后端类型
      const backendMapping: Record<string, string> = {
        notes: 'diary', // notes 对应 diary 后端
        memory: 'memory',
        knowledge: 'knowledge',
        lightmemo: 'lightmemo',
        deepmemo: 'deepmemo'
      }

      // 合并两个数据源: 使用真实 documentCount
      const storage = storageInfo.map((info) => {
        const mappedBackend = backendMapping[info.backend] || info.backend
        const backendStat = backendStats.find((b) => b.backend === mappedBackend)
        return {
          ...info,
          documentCount: backendStat?.documentCount ?? info.documentCount
        }
      })

      return { success: true, data: storage }
    } catch (error) {
      logger.error('Failed to get vector storage info', { error })
      return { success: false, error: String(error) }
    }
  })

  // 清空记忆调用记录
  ipcMain.handle('vcp:native:memory:clear', async () => {
    try {
      const tracer = getMemoryCallTracer()
      tracer.clear()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 启用/禁用记忆追踪
  ipcMain.handle('vcp:native:memory:setEnabled', async (_event, enabled: boolean) => {
    try {
      const tracer = getMemoryCallTracer()
      tracer.setEnabled(enabled)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 检查追踪是否启用
  ipcMain.handle('vcp:native:memory:isEnabled', async () => {
    try {
      const tracer = getMemoryCallTracer()
      return { success: true, data: tracer.isEnabled() }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取所有存储路径信息
  ipcMain.handle('vcp:native:storage:paths', async () => {
    try {
      const { app } = await import('electron')
      const path = await import('node:path')
      const fs = await import('node:fs/promises')

      const userDataPath = app.getPath('userData')
      const entries = await fs.readdir(userDataPath, { withFileTypes: true })

      // 需要统计的存储目录
      const storageDirectories = [
        'vcp',
        'VectorStore',
        'tantivy-indices',
        'dailynote',
        'selflearning',
        'tavern',
        'canvas',
        'Data',
        'VCPAsyncResults',
        'logs'
      ]

      const storagePaths: Array<{
        name: string
        path: string
        type: 'directory' | 'file'
        size: number
        itemCount: number
        exists: boolean
      }> = []

      // 递归计算目录大小
      async function getDirSize(dirPath: string): Promise<{ size: number; count: number }> {
        let totalSize = 0
        let itemCount = 0
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true })
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name)
            if (item.isDirectory()) {
              const sub = await getDirSize(itemPath)
              totalSize += sub.size
              itemCount += sub.count
            } else {
              const stat = await fs.stat(itemPath)
              totalSize += stat.size
              itemCount++
            }
          }
        } catch {
          // Ignore errors
        }
        return { size: totalSize, count: itemCount }
      }

      for (const dirName of storageDirectories) {
        const dirPath = path.join(userDataPath, dirName)
        const entry = entries.find((e) => e.name === dirName)
        const exists = !!entry

        if (exists && entry?.isDirectory()) {
          const { size, count } = await getDirSize(dirPath)
          storagePaths.push({
            name: dirName,
            path: dirPath,
            type: 'directory',
            size,
            itemCount: count,
            exists: true
          })
        } else {
          storagePaths.push({
            name: dirName,
            path: dirPath,
            type: 'directory',
            size: 0,
            itemCount: 0,
            exists: false
          })
        }
      }

      // 添加 userData 根目录信息
      const rootInfo = await getDirSize(userDataPath)
      storagePaths.unshift({
        name: 'userData',
        path: userDataPath,
        type: 'directory',
        size: rootInfo.size,
        itemCount: rootInfo.count,
        exists: true
      })

      return { success: true, data: storagePaths }
    } catch (error) {
      logger.error('Failed to get storage paths', { error })
      return { success: false, error: String(error) }
    }
  })

  // 浏览存储目录内容
  ipcMain.handle('vcp:native:storage:browse', async (_event, dirPath: string) => {
    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const { app } = await import('electron')

      // 安全检查：确保路径在 userData 内
      const userDataPath = app.getPath('userData')
      const resolvedPath = path.resolve(dirPath)
      if (!resolvedPath.startsWith(userDataPath)) {
        return { success: false, error: 'Access denied: path outside userData' }
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
      const items: Array<{
        name: string
        path: string
        type: 'directory' | 'file'
        size: number
        modifiedAt: string
      }> = []

      for (const entry of entries) {
        const itemPath = path.join(resolvedPath, entry.name)
        try {
          const stat = await fs.stat(itemPath)
          items.push({
            name: entry.name,
            path: itemPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            modifiedAt: stat.mtime.toISOString()
          })
        } catch {
          // Skip items that can't be accessed
        }
      }

      // 按类型和名称排序
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return { success: true, data: items }
    } catch (error) {
      logger.error('Failed to browse storage', { error, dirPath })
      return { success: false, error: String(error) }
    }
  })

  // 在系统文件管理器中打开目录
  ipcMain.handle('vcp:native:storage:openInExplorer', async (_event, dirPath: string) => {
    try {
      const { shell, app } = await import('electron')
      const path = await import('node:path')

      // 安全检查
      const userDataPath = app.getPath('userData')
      const resolvedPath = path.resolve(dirPath)
      if (!resolvedPath.startsWith(userDataPath)) {
        return { success: false, error: 'Access denied: path outside userData' }
      }

      await shell.openPath(resolvedPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ==================== 基准测试 IPC 通道 ====================

  // 运行快速基准测试
  ipcMain.handle('vcp:native:benchmark:quick', async () => {
    try {
      const { runQuickBenchmark } = await import('./native')
      const results = await runQuickBenchmark()
      return { success: true, data: results }
    } catch (error) {
      logger.error('Quick benchmark failed', { error })
      return { success: false, error: String(error) }
    }
  })

  // 运行完整基准测试套件
  ipcMain.handle('vcp:native:benchmark:full', async (_event, iterations?: number) => {
    try {
      const { runFullBenchmarkSuite } = await import('./native')
      const suite = await runFullBenchmarkSuite(iterations || 100)
      return { success: true, data: suite }
    } catch (error) {
      logger.error('Full benchmark suite failed', { error })
      return { success: false, error: String(error) }
    }
  })

  // 运行 T-004 大规模基准测试套件
  ipcMain.handle('vcp:native:benchmark:largeScale', async () => {
    try {
      const { runLargeScaleBenchmarkSuite } = await import('./native')
      logger.info('Starting T-004 Large Scale Benchmark Suite from IPC')
      const suite = await runLargeScaleBenchmarkSuite()
      return { success: true, data: suite }
    } catch (error) {
      logger.error('Large scale benchmark suite failed', { error })
      return { success: false, error: String(error) }
    }
  })

  // 单独运行 TagCooccurrence 大规模测试
  ipcMain.handle('vcp:native:benchmark:largeTagMemo', async () => {
    try {
      const { benchmarkLargeTagCooccurrence } = await import('./native')
      const results = await benchmarkLargeTagCooccurrence()
      return { success: true, data: results }
    } catch (error) {
      logger.error('Large TagCooccurrence benchmark failed', { error })
      return { success: false, error: String(error) }
    }
  })

  // 单独运行 SearchEngine 大规模测试
  ipcMain.handle('vcp:native:benchmark:largeSearch', async () => {
    try {
      const { benchmarkLargeSearchEngine } = await import('./native')
      const results = await benchmarkLargeSearchEngine()
      return { success: true, data: results }
    } catch (error) {
      logger.error('Large SearchEngine benchmark failed', { error })
      return { success: false, error: String(error) }
    }
  })

  // 单独运行 VectorStore 大规模测试
  ipcMain.handle('vcp:native:benchmark:largeVector', async () => {
    try {
      const { benchmarkLargeVectorStore } = await import('./native')
      const results = await benchmarkLargeVectorStore()
      return { success: true, data: results }
    } catch (error) {
      logger.error('Large VectorStore benchmark failed', { error })
      return { success: false, error: String(error) }
    }
  })

  logger.info('Native VCP IPC handlers registered')
}

/**
 * 注销 Native VCP IPC 处理器
 */
export function unregisterNativeVCPIpcHandlers(): void {
  const channels = [
    'vcp:native:initialize',
    'vcp:native:status',
    'vcp:native:dbStats',
    'vcp:native:traces',
    'vcp:native:logs',
    'vcp:native:createTrace',
    'vcp:native:endSpan',
    'vcp:native:cosineSimilarity',
    'vcp:native:batchSimilarity',
    'vcp:native:tagmemo:init',
    'vcp:native:tagmemo:update',
    'vcp:native:tagmemo:associations',
    'vcp:native:tagmemo:expand',
    'vcp:native:tagmemo:stats',
    'vcp:native:tagmemo:boostVector',
    'vcp:native:tagmemo:batchBoostVectors',
    // WaveRAG 三阶段检索通道
    'vcp:native:waverag:create',
    'vcp:native:waverag:search',
    'vcp:native:waverag:quickSearch',
    'vcp:native:waverag:updateTagMatrix',
    'vcp:native:waverag:batchUpdateTagMatrix',
    'vcp:native:waverag:stats',
    'vcp:native:waverag:config',
    'vcp:native:waverag:updateConfig',
    'vcp:native:waverag:computeTagBoost',
    'vcp:native:waverag:exportTagMatrix',
    'vcp:native:waverag:loadTagMatrix',
    'vcp:native:waverag:destroy',
    // SearchEngine 通道
    'vcp:native:search:init',
    'vcp:native:search:add',
    'vcp:native:search:addBatch',
    'vcp:native:search:query',
    'vcp:native:search:commit',
    'vcp:native:search:stats',
    // VectorStore 通道
    'vcp:native:vector:init',
    'vcp:native:vector:add',
    'vcp:native:vector:search',
    'vcp:native:vector:size',
    // HybridSearchEngine 通道
    'vcp:native:hybrid:init',
    'vcp:native:hybrid:setWeights',
    'vcp:native:hybrid:setRrfK',
    'vcp:native:hybrid:fuse',
    'vcp:native:hybrid:config',
    'vcp:native:quickRrfFusion',
    // TextChunker 通道
    'vcp:native:chunker:init',
    'vcp:native:chunker:setSeparators',
    'vcp:native:chunker:chunk',
    'vcp:native:chunker:chunkBatch',
    'vcp:native:chunker:estimateTokens',
    'vcp:native:chunker:chunkByTokens',
    'vcp:native:chunker:config',
    'vcp:native:quickChunk',
    'vcp:native:estimateTokenCount',
    // ChineseSearchEngine 通道
    'vcp:native:chinese:init',
    'vcp:native:chinese:add',
    'vcp:native:chinese:addBatch',
    'vcp:native:chinese:query',
    'vcp:native:chinese:commit',
    'vcp:native:chinese:stats',
    // 日志回调通道
    'vcp:native:log:hasCallback',
    'vcp:native:log:clear',
    // MemoryCallTracer 通道
    'vcp:native:memory:traces',
    'vcp:native:memory:stats',
    'vcp:native:memory:callGraph',
    'vcp:native:memory:vectorStorage',
    'vcp:native:memory:clear',
    'vcp:native:memory:setEnabled',
    'vcp:native:memory:isEnabled',
    // Storage 通道
    'vcp:native:storage:paths',
    'vcp:native:storage:browse',
    'vcp:native:storage:openInExplorer',
    // Benchmark 通道
    'vcp:native:benchmark:quick',
    'vcp:native:benchmark:full',
    'vcp:native:benchmark:largeScale',
    'vcp:native:benchmark:largeTagMemo',
    'vcp:native:benchmark:largeSearch',
    'vcp:native:benchmark:largeVector'
  ]

  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  // 清理日志回调
  clearLogCallback()

  logger.info('Native VCP IPC handlers unregistered')
}

/**
 * 记录 VCP 操作日志（供其他模块调用）
 */
export function logVCPOperation(
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error',
  target: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  addLogEntry({
    timestamp: new Date().toISOString(),
    level,
    target,
    message,
    metadata
  })
}
