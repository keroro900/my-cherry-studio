/**
 * Native VCP 性能基准测试
 *
 * 对比 Rust Native 层与 TypeScript 实现的性能差异
 *
 * 测试项目:
 * - VectorStore: 向量搜索性能
 * - TagCooccurrence: 标签共现计算性能
 * - SearchEngine: 全文搜索性能
 * - UnifiedDatabase: 数据库读写性能
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import {
  createSearchEngine,
  createTagCooccurrenceMatrix,
  createUnifiedDatabase,
  createVectorStore,
  isNativeModuleAvailable,
  vectorOps
} from './NativeVCPBridge'

const logger = loggerService.withContext('NativeVCPBenchmark')

// ==================== 类型定义 ====================

export interface BenchmarkResult {
  name: string
  iterations: number
  totalTimeMs: number
  avgTimeMs: number
  minTimeMs: number
  maxTimeMs: number
  opsPerSecond: number
  nativeAvailable: boolean
}

export interface BenchmarkSuite {
  suiteName: string
  results: BenchmarkResult[]
  timestamp: string
  platform: string
}

// ==================== 基准测试函数 ====================

/**
 * 执行单个基准测试
 */
async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = []
  const isNative = isNativeModuleAvailable()

  // 预热
  for (let i = 0; i < Math.min(10, iterations / 10); i++) {
    await fn()
  }

  // 正式测试
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const totalTimeMs = times.reduce((a, b) => a + b, 0)
  const avgTimeMs = totalTimeMs / iterations
  const minTimeMs = Math.min(...times)
  const maxTimeMs = Math.max(...times)
  const opsPerSecond = 1000 / avgTimeMs

  return {
    name,
    iterations,
    totalTimeMs,
    avgTimeMs,
    minTimeMs,
    maxTimeMs,
    opsPerSecond,
    nativeAvailable: isNative
  }
}

/**
 * 生成随机向量
 */
function randomVector(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1)
}

/**
 * 生成随机文本
 */
function randomText(wordCount: number): string {
  const words = [
    '记忆',
    '知识',
    '模型',
    '向量',
    '搜索',
    '检索',
    '标签',
    '语义',
    '时间',
    '上下文',
    '对话',
    '历史',
    '用户',
    '助手',
    '问题',
    '回答',
    '分析',
    '推理',
    '理解',
    '生成'
  ]
  return Array.from({ length: wordCount }, () => words[Math.floor(Math.random() * words.length)]).join(' ')
}

// ==================== 基准测试套件 ====================

/**
 * VectorStore 基准测试
 */
export async function benchmarkVectorStore(iterations: number = 100): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const dim = 1536
  const vectorStore = createVectorStore(dim)!

  // 准备测试数据
  const vectors = Array.from({ length: 1000 }, (_, i) => ({
    id: `vec_${i}`,
    vector: randomVector(dim)
  }))

  // 1. 批量添加向量
  results.push(
    await runBenchmark(
      'VectorStore.addBatch (1000 vectors)',
      () => {
        for (const v of vectors.slice(0, 100)) {
          ;(vectorStore as any).add(v.id, v.vector)
        }
      },
      iterations
    )
  )

  // 2. 向量搜索
  const queryVector = randomVector(dim)
  results.push(
    await runBenchmark(
      'VectorStore.search (k=10)',
      () => {
        ;(vectorStore as any).search(queryVector, 10)
      },
      iterations
    )
  )

  // 3. 余弦相似度计算
  const v1 = randomVector(dim)
  const v2 = randomVector(dim)
  results.push(
    await runBenchmark(
      'vectorOps.cosineSimilarity',
      () => {
        vectorOps.cosineSimilarity(v1, v2)
      },
      iterations * 10
    )
  )

  // 4. 批量相似度计算
  const batchVectors = Array.from({ length: 100 }, () => randomVector(dim))
  results.push(
    await runBenchmark(
      'vectorOps.batchCosineSimilarity (100 vectors)',
      () => {
        vectorOps.batchCosineSimilarity(queryVector, batchVectors)
      },
      iterations
    )
  )

  return results
}

/**
 * TagCooccurrence 基准测试
 */
export async function benchmarkTagCooccurrence(iterations: number = 100): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const matrix = createTagCooccurrenceMatrix()!

  // 准备测试数据
  const tags = [
    '颜色',
    '红色',
    '蓝色',
    '绿色',
    '图案',
    '条纹',
    '格子',
    '风格',
    '休闲',
    '正式',
    '材质',
    '棉',
    '丝绸',
    '羊毛',
    '季节',
    '春季',
    '夏季',
    '秋季',
    '冬季',
    '场合'
  ]

  // 1. 更新标签共现
  results.push(
    await runBenchmark(
      'TagMatrix.updatePair',
      () => {
        const t1 = tags[Math.floor(Math.random() * tags.length)]
        const t2 = tags[Math.floor(Math.random() * tags.length)]
        ;(matrix as any).updatePair(t1, t2, Math.random() > 0.5 ? 1 : -1)
      },
      iterations * 10
    )
  )

  // 批量更新以建立关联
  for (let i = 0; i < 500; i++) {
    const t1 = tags[Math.floor(Math.random() * tags.length)]
    const t2 = tags[Math.floor(Math.random() * tags.length)]
    ;(matrix as any).updatePair(t1, t2, 1)
  }

  // 2. 获取标签关联
  results.push(
    await runBenchmark(
      'TagMatrix.getAssociations (top 5)',
      () => {
        const t = tags[Math.floor(Math.random() * tags.length)]
        ;(matrix as any).getAssociations(t, 5)
      },
      iterations
    )
  )

  // 3. 获取统计信息
  results.push(
    await runBenchmark(
      'TagMatrix.getStats',
      () => {
        ;(matrix as any).getStats()
      },
      iterations
    )
  )

  return results
}

/**
 * UnifiedDatabase 基准测试
 */
export async function benchmarkDatabase(iterations: number = 100): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const db = createUnifiedDatabase(':memory:')!

  // 1. 写入记忆
  results.push(
    await runBenchmark(
      'Database.saveMemory',
      () => {
        const id = `mem_${Math.random().toString(36).slice(2)}`
        ;(db as any).saveMemory({
          id,
          content: randomText(50),
          tags: ['test', 'benchmark'],
          importance: Math.random(),
          createdAt: new Date().toISOString()
        })
      },
      iterations
    )
  )

  // 批量写入以建立数据库
  for (let i = 0; i < 500; i++) {
    ;(db as any).saveMemory({
      id: `bulk_${i}`,
      content: randomText(50),
      tags: ['bulk', `cat_${i % 5}`],
      importance: Math.random(),
      createdAt: new Date().toISOString()
    })
  }

  // 2. 搜索记忆
  results.push(
    await runBenchmark(
      'Database.searchMemories',
      () => {
        ;(db as any).searchMemories({ text: '知识', limit: 10 })
      },
      iterations
    )
  )

  // 3. 获取统计信息
  results.push(
    await runBenchmark(
      'Database.getStats',
      () => {
        ;(db as any).getStats()
      },
      iterations
    )
  )

  return results
}

/**
 * SearchEngine 基准测试 (如果可用)
 */
export async function benchmarkSearchEngine(iterations: number = 100): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  try {
    const engine = createSearchEngine(':memory:')
    if (!engine) {
      return results
    }

    // 1. 索引文档
    results.push(
      await runBenchmark(
        'SearchEngine.indexDocument',
        () => {
          const id = `doc_${Math.random().toString(36).slice(2)}`
          ;(engine as any).indexDocument(id, randomText(100), {})
        },
        iterations
      )
    )

    // 批量索引
    for (let i = 0; i < 500; i++) {
      ;(engine as any).indexDocument(`bulk_doc_${i}`, randomText(100), { category: `cat_${i % 5}` })
    }

    // 2. BM25 搜索
    results.push(
      await runBenchmark(
        'SearchEngine.search (BM25)',
        () => {
          ;(engine as any).search('知识 模型 向量', 10)
        },
        iterations
      )
    )
  } catch {
    // SearchEngine 可能不可用
  }

  return results
}

// ==================== 主测试入口 ====================

/**
 * 运行完整基准测试套件
 */
export async function runFullBenchmarkSuite(iterations: number = 100): Promise<BenchmarkSuite> {
  logger.info('Starting Native VCP Benchmark Suite', { iterations })

  const results: BenchmarkResult[] = []

  // 1. VectorStore 测试
  logger.info('Running VectorStore benchmarks...')
  results.push(...(await benchmarkVectorStore(iterations)))

  // 2. TagCooccurrence 测试
  logger.info('Running TagCooccurrence benchmarks...')
  results.push(...(await benchmarkTagCooccurrence(iterations)))

  // 3. Database 测试
  logger.info('Running Database benchmarks...')
  results.push(...(await benchmarkDatabase(iterations)))

  // 4. SearchEngine 测试
  logger.info('Running SearchEngine benchmarks...')
  results.push(...(await benchmarkSearchEngine(iterations)))

  const suite: BenchmarkSuite = {
    suiteName: 'Native VCP Performance Benchmark',
    results,
    timestamp: new Date().toISOString(),
    platform: `Node ${process.version} / ${process.platform} ${process.arch}`
  }

  // 输出结果
  logger.info('Benchmark Suite Completed')
  console.log('\n========== Native VCP Benchmark Results ==========\n')
  console.log(`Platform: ${suite.platform}`)
  console.log(`Native Module Available: ${isNativeModuleAvailable()}`)
  console.log(`Timestamp: ${suite.timestamp}`)
  console.log('')

  for (const result of results) {
    console.log(`[${result.name}]`)
    console.log(`  Iterations: ${result.iterations}`)
    console.log(`  Avg: ${result.avgTimeMs.toFixed(3)} ms`)
    console.log(`  Min: ${result.minTimeMs.toFixed(3)} ms`)
    console.log(`  Max: ${result.maxTimeMs.toFixed(3)} ms`)
    console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(1)}`)
    console.log('')
  }

  return suite
}

/**
 * 快速基准测试 (用于 IPC 调用)
 */
export async function runQuickBenchmark(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // 快速向量测试
  const dim = 1536
  const v1 = randomVector(dim)
  const v2 = randomVector(dim)

  results.push(
    await runBenchmark(
      'Quick: cosineSimilarity',
      () => {
        vectorOps.cosineSimilarity(v1, v2)
      },
      100
    )
  )

  // 快速标签测试
  const matrix = createTagCooccurrenceMatrix()!
  results.push(
    await runBenchmark(
      'Quick: tagMatrix.updatePair',
      () => {
        ;(matrix as any).updatePair('tag_a', 'tag_b', 1)
      },
      100
    )
  )

  return results
}

// ==================== T-004 大规模基准测试 ====================

export interface LargeScaleBenchmarkResult extends BenchmarkResult {
  dataSize: number
  memoryUsageMB?: number
}

export interface LargeScaleBenchmarkSuite {
  suiteName: string
  results: LargeScaleBenchmarkResult[]
  timestamp: string
  platform: string
  totalDurationMs: number
}

/**
 * 运行大规模基准测试并输出结果
 */
async function runLargeBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number,
  dataSize: number
): Promise<LargeScaleBenchmarkResult> {
  const baseResult = await runBenchmark(name, fn, iterations)

  // 尝试获取内存使用
  let memoryUsageMB: number | undefined
  try {
    const memUsage = process.memoryUsage()
    memoryUsageMB = Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100
  } catch {
    // ignore
  }

  return {
    ...baseResult,
    dataSize,
    memoryUsageMB
  }
}

/**
 * T-004: 大规模 TagCooccurrence PMI 测试 (100K 对)
 *
 * 测试内容:
 * - 100K 标签对更新性能
 * - PMI 计算性能
 * - 关联查询性能
 * - 内存使用情况
 */
export async function benchmarkLargeTagCooccurrence(): Promise<LargeScaleBenchmarkResult[]> {
  const results: LargeScaleBenchmarkResult[] = []
  const matrix = createTagCooccurrenceMatrix()!
  const targetPairs = 100000

  logger.info('Starting large-scale TagCooccurrence benchmark', { targetPairs })

  // 生成标签池 (约 450 个标签可产生 ~100K 唯一对)
  const tagCount = 450
  const tags = Array.from({ length: tagCount }, (_, i) => `tag_${i}`)

  // 1. 批量更新 100K 标签对
  const startTime = performance.now()
  let pairsCreated = 0

  for (let i = 0; i < tags.length && pairsCreated < targetPairs; i++) {
    for (let j = i + 1; j < tags.length && pairsCreated < targetPairs; j++) {
      ;(matrix as any).updatePair(tags[i], tags[j], Math.random() > 0.3 ? 1 : -0.5)
      pairsCreated++
    }
  }

  const buildTime = performance.now() - startTime
  results.push({
    name: `TagMatrix.build (${pairsCreated} pairs)`,
    iterations: 1,
    totalTimeMs: buildTime,
    avgTimeMs: buildTime,
    minTimeMs: buildTime,
    maxTimeMs: buildTime,
    opsPerSecond: pairsCreated / (buildTime / 1000),
    nativeAvailable: isNativeModuleAvailable(),
    dataSize: pairsCreated
  })

  logger.info('TagMatrix built', { pairsCreated, buildTimeMs: Math.round(buildTime) })

  // 2. 单次更新性能 (热数据)
  results.push(
    await runLargeBenchmark(
      'TagMatrix.updatePair (hot)',
      () => {
        const i = Math.floor(Math.random() * tagCount)
        const j = Math.floor(Math.random() * tagCount)
        ;(matrix as any).updatePair(tags[i], tags[j], 1)
      },
      1000,
      pairsCreated
    )
  )

  // 3. PMI 计算性能
  results.push(
    await runLargeBenchmark(
      'TagMatrix.computePmi',
      () => {
        const i = Math.floor(Math.random() * tagCount)
        const j = Math.floor(Math.random() * tagCount)
        ;(matrix as any).computePmi?.(tags[i], tags[j])
      },
      1000,
      pairsCreated
    )
  )

  // 4. 关联查询性能
  results.push(
    await runLargeBenchmark(
      'TagMatrix.getAssociations (top 10)',
      () => {
        const i = Math.floor(Math.random() * tagCount)
        ;(matrix as any).getAssociations(tags[i], 10)
      },
      500,
      pairsCreated
    )
  )

  // 5. 查询扩展性能
  results.push(
    await runLargeBenchmark(
      'TagMatrix.expandQuery (5 tags)',
      () => {
        const queryTags = Array.from({ length: 5 }, () => tags[Math.floor(Math.random() * tagCount)])
        ;(matrix as any).expandQuery(queryTags, 2.0)
      },
      200,
      pairsCreated
    )
  )

  // 6. 统计信息获取
  results.push(
    await runLargeBenchmark(
      'TagMatrix.getStats',
      () => {
        ;(matrix as any).getStats()
      },
      100,
      pairsCreated
    )
  )

  return results
}

/**
 * T-004: 大规模 SearchEngine BM25 测试 (10K 文档)
 *
 * 测试内容:
 * - 10K 文档索引性能
 * - BM25 搜索性能
 * - 批量索引性能
 */
export async function benchmarkLargeSearchEngine(): Promise<LargeScaleBenchmarkResult[]> {
  const results: LargeScaleBenchmarkResult[] = []
  const targetDocs = 10000

  logger.info('Starting large-scale SearchEngine benchmark', { targetDocs })

  try {
    const engine = createSearchEngine(':memory:')
    if (!engine) {
      logger.warn('SearchEngine not available, skipping benchmark')
      return results
    }

    // 1. 批量索引 10K 文档
    const documents = Array.from({ length: targetDocs }, (_, i) => ({
      id: `doc_${i}`,
      content: randomText(80 + Math.floor(Math.random() * 120)) // 80-200 词
    }))

    const startTime = performance.now()

    for (const doc of documents) {
      ;(engine as any).indexDocument(doc.id, doc.content, { category: `cat_${Math.floor(Math.random() * 10)}` })
    }

    const indexTime = performance.now() - startTime
    results.push({
      name: `SearchEngine.indexBatch (${targetDocs} docs)`,
      iterations: 1,
      totalTimeMs: indexTime,
      avgTimeMs: indexTime / targetDocs,
      minTimeMs: indexTime / targetDocs,
      maxTimeMs: indexTime / targetDocs,
      opsPerSecond: targetDocs / (indexTime / 1000),
      nativeAvailable: isNativeModuleAvailable(),
      dataSize: targetDocs
    })

    logger.info('SearchEngine indexed', { docCount: targetDocs, indexTimeMs: Math.round(indexTime) })

    // 2. 简单查询性能
    results.push(
      await runLargeBenchmark(
        'SearchEngine.search (simple, k=10)',
        () => {
          ;(engine as any).search('知识 模型', 10)
        },
        500,
        targetDocs
      )
    )

    // 3. 复杂查询性能
    results.push(
      await runLargeBenchmark(
        'SearchEngine.search (complex, k=20)',
        () => {
          ;(engine as any).search('知识 模型 向量 检索 语义 理解', 20)
        },
        300,
        targetDocs
      )
    )

    // 4. 长查询性能
    results.push(
      await runLargeBenchmark(
        'SearchEngine.search (long query, k=10)',
        () => {
          const query = randomText(20)
          ;(engine as any).search(query, 10)
        },
        200,
        targetDocs
      )
    )
  } catch (error) {
    logger.warn('SearchEngine benchmark failed', { error: String(error) })
  }

  return results
}

/**
 * T-004: 大规模 VectorStore 测试 (100K 向量)
 *
 * 测试内容:
 * - 100K 向量插入性能
 * - Top-K 搜索性能
 * - 批量相似度计算
 */
export async function benchmarkLargeVectorStore(): Promise<LargeScaleBenchmarkResult[]> {
  const results: LargeScaleBenchmarkResult[] = []
  const targetVectors = 100000
  const dim = 1536

  logger.info('Starting large-scale VectorStore benchmark', { targetVectors, dim })

  try {
    const vectorStore = createVectorStore(dim)
    if (!vectorStore) {
      logger.warn('VectorStore not available, skipping benchmark')
      return results
    }

    // 1. 批量插入 100K 向量
    const startTime = performance.now()

    // 分批插入以避免内存压力
    const batchSize = 10000
    for (let batch = 0; batch < targetVectors / batchSize; batch++) {
      for (let i = 0; i < batchSize; i++) {
        const id = `vec_${batch * batchSize + i}`
        const vector = randomVector(dim)
        ;(vectorStore as any).add(id, vector)
      }
      if ((batch + 1) % 2 === 0) {
        logger.debug('VectorStore progress', {
          inserted: (batch + 1) * batchSize,
          total: targetVectors
        })
      }
    }

    const insertTime = performance.now() - startTime
    results.push({
      name: `VectorStore.insert (${targetVectors} vectors)`,
      iterations: 1,
      totalTimeMs: insertTime,
      avgTimeMs: insertTime / targetVectors,
      minTimeMs: insertTime / targetVectors,
      maxTimeMs: insertTime / targetVectors,
      opsPerSecond: targetVectors / (insertTime / 1000),
      nativeAvailable: isNativeModuleAvailable(),
      dataSize: targetVectors
    })

    logger.info('VectorStore populated', {
      vectorCount: targetVectors,
      insertTimeMs: Math.round(insertTime)
    })

    // 2. Top-K 搜索性能 (k=10)
    const queryVector = randomVector(dim)
    results.push(
      await runLargeBenchmark(
        'VectorStore.search (k=10, 100K vectors)',
        () => {
          ;(vectorStore as any).search(queryVector, 10)
        },
        100,
        targetVectors
      )
    )

    // 3. Top-K 搜索性能 (k=50)
    results.push(
      await runLargeBenchmark(
        'VectorStore.search (k=50, 100K vectors)',
        () => {
          ;(vectorStore as any).search(queryVector, 50)
        },
        100,
        targetVectors
      )
    )

    // 4. Top-K 搜索性能 (k=100)
    results.push(
      await runLargeBenchmark(
        'VectorStore.search (k=100, 100K vectors)',
        () => {
          ;(vectorStore as any).search(queryVector, 100)
        },
        50,
        targetVectors
      )
    )

    // 5. 批量相似度计算 (1000 向量)
    const candidateVectors = Array.from({ length: 1000 }, () => randomVector(dim))
    results.push(
      await runLargeBenchmark(
        'vectorOps.batchCosineSimilarity (1000 vectors)',
        () => {
          vectorOps.batchCosineSimilarity(queryVector, candidateVectors)
        },
        50,
        1000
      )
    )
  } catch (error) {
    logger.warn('VectorStore benchmark failed', { error: String(error) })
  }

  return results
}

/**
 * T-004: 运行完整大规模基准测试套件
 *
 * 包含:
 * - TagCooccurrenceMatrix: 100K 对 PMI 计算
 * - Tantivy SearchEngine: 10K 文档 BM25 搜索
 * - VectorStore: 100K 向量 Top-K 搜索
 */
export async function runLargeScaleBenchmarkSuite(): Promise<LargeScaleBenchmarkSuite> {
  const suiteStartTime = performance.now()

  logger.info('========================================')
  logger.info('Starting T-004 Large Scale Benchmark Suite')
  logger.info('========================================')

  const results: LargeScaleBenchmarkResult[] = []

  // 1. TagCooccurrence 大规模测试
  console.log('\n[1/3] Running TagCooccurrence benchmark (100K pairs)...')
  logger.info('Running TagCooccurrence benchmark (100K pairs)...')
  try {
    results.push(...(await benchmarkLargeTagCooccurrence()))
  } catch (error) {
    logger.error('TagCooccurrence benchmark failed', { error: String(error) })
  }

  // 2. SearchEngine 大规模测试
  console.log('\n[2/3] Running SearchEngine benchmark (10K docs)...')
  logger.info('Running SearchEngine benchmark (10K docs)...')
  try {
    results.push(...(await benchmarkLargeSearchEngine()))
  } catch (error) {
    logger.error('SearchEngine benchmark failed', { error: String(error) })
  }

  // 3. VectorStore 大规模测试
  console.log('\n[3/3] Running VectorStore benchmark (100K vectors)...')
  logger.info('Running VectorStore benchmark (100K vectors)...')
  try {
    results.push(...(await benchmarkLargeVectorStore()))
  } catch (error) {
    logger.error('VectorStore benchmark failed', { error: String(error) })
  }

  const totalDurationMs = performance.now() - suiteStartTime

  const suite: LargeScaleBenchmarkSuite = {
    suiteName: 'T-004 Large Scale Native Benchmark',
    results,
    timestamp: new Date().toISOString(),
    platform: `Node ${process.version} / ${process.platform} ${process.arch}`,
    totalDurationMs
  }

  // 输出报告
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║          T-004 Large Scale Benchmark Results                     ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log(`║  Platform: ${suite.platform.padEnd(54)}║`)
  console.log(`║  Native Module: ${isNativeModuleAvailable() ? 'Available ✅' : 'Fallback ⚠️'.padEnd(49)}║`)
  console.log(`║  Total Duration: ${(totalDurationMs / 1000).toFixed(2)}s${' '.repeat(46)}║`)
  console.log('╠══════════════════════════════════════════════════════════════════╣')

  for (const result of results) {
    const name = result.name.length > 45 ? result.name.slice(0, 42) + '...' : result.name
    const avgMs = result.avgTimeMs.toFixed(3)
    const ops = result.opsPerSecond > 1000 ? `${(result.opsPerSecond / 1000).toFixed(1)}K` : result.opsPerSecond.toFixed(1)
    console.log(`║  ${name.padEnd(45)} Avg: ${avgMs.padStart(8)}ms  ${ops.padStart(8)} ops/s  ║`)
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('')

  logger.info('T-004 Large Scale Benchmark Suite completed', {
    totalDurationMs: Math.round(totalDurationMs),
    testCount: results.length,
    nativeAvailable: isNativeModuleAvailable()
  })

  return suite
}

/**
 * 导出大规模测试结果为 JSON
 */
export function exportBenchmarkResults(suite: LargeScaleBenchmarkSuite): string {
  return JSON.stringify(suite, null, 2)
}
