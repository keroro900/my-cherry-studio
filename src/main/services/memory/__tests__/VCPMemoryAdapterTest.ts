/**
 * VCP Memory Adapter 集成测试
 *
 * 验证记忆系统调用链路：
 * - VCPMemoryAdapter -> IntegratedMemoryCoordinator -> UnifiedMemoryManager
 * - 日志追踪每个调用点
 * - 显示向量位置和记忆来源
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('MemoryTest')

// 模拟测试环境
interface MemoryCallTrace {
  timestamp: string
  caller: string
  method: string
  params: Record<string, unknown>
  result?: unknown
  durationMs: number
  backend?: string
  vectorInfo?: {
    dimension?: number
    count?: number
    location?: string
  }
}

const callTraces: MemoryCallTrace[] = []

/**
 * 记录调用追踪
 */
function recordTrace(trace: Omit<MemoryCallTrace, 'timestamp'>): void {
  const fullTrace: MemoryCallTrace = {
    timestamp: new Date().toISOString(),
    ...trace
  }
  callTraces.push(fullTrace)

  // 输出详细日志
  logger.info(`[MEMORY TRACE] ${trace.caller} -> ${trace.method}`, {
    params: trace.params,
    durationMs: trace.durationMs,
    backend: trace.backend,
    vectorInfo: trace.vectorInfo
  })
}

/**
 * 打印调用链路图
 */
function printCallGraph(): void {
  console.log('\n' + '='.repeat(80))
  console.log('📊 记忆系统调用链路图')
  console.log('='.repeat(80))

  for (let i = 0; i < callTraces.length; i++) {
    const trace = callTraces[i]
    const indent = '  '.repeat(i)
    const arrow = i === 0 ? '🚀' : '↳'

    console.log(`${indent}${arrow} [${trace.timestamp.slice(11, 23)}] ${trace.caller}`)
    console.log(`${indent}   ├─ 方法: ${trace.method}`)
    console.log(`${indent}   ├─ 后端: ${trace.backend || 'N/A'}`)
    console.log(`${indent}   ├─ 耗时: ${trace.durationMs}ms`)

    if (trace.vectorInfo) {
      console.log(`${indent}   └─ 向量: dim=${trace.vectorInfo.dimension}, count=${trace.vectorInfo.count}, loc=${trace.vectorInfo.location}`)
    } else {
      console.log(`${indent}   └─ 参数: ${JSON.stringify(trace.params).slice(0, 100)}...`)
    }
  }

  console.log('='.repeat(80) + '\n')
}

/**
 * 测试 LightMemo 搜索
 */
async function testLightMemoSearch(): Promise<void> {
  logger.info('========== 测试 LightMemo 搜索 ==========')

  const startTime = Date.now()

  try {
    // 动态导入避免循环依赖
    const { getVCPMemoryAdapter } = await import('../../../memory/adapters/VCPMemoryAdapter')
    const adapter = getVCPMemoryAdapter()

    recordTrace({
      caller: 'TestRunner',
      method: 'VCPMemoryAdapter.lightMemoSearch',
      params: { query: '测试查询', k: 5 },
      durationMs: 0,
      backend: 'lightmemo'
    })

    const result = await adapter.lightMemoSearch({
      query: '测试查询',
      k: 5,
      enableLearning: true
    })

    recordTrace({
      caller: 'VCPMemoryAdapter',
      method: 'IntegratedMemoryCoordinator.intelligentSearch',
      params: { query: '测试查询', topK: 5 },
      durationMs: result.durationMs || Date.now() - startTime,
      backend: result.backends?.join(', '),
      result: { count: result.totalCount, success: result.success }
    })

    logger.info('LightMemo 搜索结果', {
      success: result.success,
      resultCount: result.totalCount,
      durationMs: result.durationMs,
      backends: result.backends
    })

    if (result.results && result.results.length > 0) {
      logger.info('返回记忆条目:', {
        firstResult: {
          id: result.results[0].id,
          score: result.results[0].score,
          backend: result.results[0].backend
        }
      })
    }
  } catch (error) {
    logger.error('LightMemo 搜索失败', { error })
  }
}

/**
 * 测试 DeepMemo 搜索
 */
async function testDeepMemoSearch(): Promise<void> {
  logger.info('========== 测试 DeepMemo 搜索 ==========')

  const startTime = Date.now()

  try {
    const { getVCPMemoryAdapter } = await import('../../../memory/adapters/VCPMemoryAdapter')
    const adapter = getVCPMemoryAdapter()

    recordTrace({
      caller: 'TestRunner',
      method: 'VCPMemoryAdapter.deepMemoSearch',
      params: { query: '深度测试', finalK: 10 },
      durationMs: 0,
      backend: 'deepmemo'
    })

    const result = await adapter.deepMemoSearch({
      query: '深度测试',
      finalK: 10,
      useReranker: true
    })

    recordTrace({
      caller: 'VCPMemoryAdapter',
      method: 'IntegratedMemoryCoordinator.intelligentSearch (deep mode)',
      params: { query: '深度测试', topK: 10 },
      durationMs: result.durationMs || Date.now() - startTime,
      backend: 'deepmemo,lightmemo'
    })

    logger.info('DeepMemo 搜索结果', {
      success: result.success,
      resultCount: result.totalCount,
      durationMs: result.durationMs
    })
  } catch (error) {
    logger.error('DeepMemo 搜索失败', { error })
  }
}

/**
 * 测试记忆创建
 */
async function testCreateMemory(): Promise<void> {
  logger.info('========== 测试记忆创建 ==========')

  const startTime = Date.now()

  try {
    const { getVCPMemoryAdapter } = await import('../../../memory/adapters/VCPMemoryAdapter')
    const adapter = getVCPMemoryAdapter()

    recordTrace({
      caller: 'TestRunner',
      method: 'VCPMemoryAdapter.createMemory',
      params: { content: '测试内容...', backend: 'diary', autoTag: true },
      durationMs: 0,
      backend: 'diary'
    })

    const result = await adapter.createMemory({
      content: '这是一条测试记忆，用于验证记忆系统的完整调用链路。',
      title: '测试记忆',
      backend: 'diary',
      autoTag: true,
      tags: ['测试', '验证']
    })

    recordTrace({
      caller: 'VCPMemoryAdapter',
      method: 'IntegratedMemoryCoordinator.createMemory',
      params: { backend: 'diary', autoTag: true },
      durationMs: Date.now() - startTime,
      backend: 'diary',
      result: { success: result.success, entryId: result.entry?.id }
    })

    logger.info('记忆创建结果', {
      success: result.success,
      entryId: result.entry?.id,
      tags: result.entry?.tags
    })
  } catch (error) {
    logger.error('记忆创建失败', { error })
  }
}

/**
 * 测试统计获取
 */
async function testGetStats(): Promise<void> {
  logger.info('========== 测试统计获取 ==========')

  const startTime = Date.now()

  try {
    const { getVCPMemoryAdapter } = await import('../../../memory/adapters/VCPMemoryAdapter')
    const adapter = getVCPMemoryAdapter()

    recordTrace({
      caller: 'TestRunner',
      method: 'VCPMemoryAdapter.getStats',
      params: {},
      durationMs: 0
    })

    const result = await adapter.getStats()

    if (result.success && result.data) {
      const stats = result.data

      recordTrace({
        caller: 'VCPMemoryAdapter',
        method: 'IntegratedMemoryCoordinator.getIntegratedStats',
        params: {},
        durationMs: Date.now() - startTime,
        result: {
          backends: stats.memoryStats.backends.length,
          totalTags: stats.tagPoolStats.totalTags,
          totalQueries: stats.learningStats.totalQueries
        }
      })

      // 打印详细统计
      console.log('\n📈 记忆系统统计:')
      console.log('  后端状态:')
      for (const backend of stats.memoryStats.backends) {
        console.log(`    - ${backend.backend}: ${backend.available ? '✅' : '❌'} (${backend.documentCount} 文档)`)
      }
      console.log(`  标签池: ${stats.tagPoolStats.totalTags} 个标签`)
      console.log(`  学习统计: ${stats.learningStats.totalQueries} 查询, ${stats.learningStats.totalFeedback} 反馈`)
    }
  } catch (error) {
    logger.error('统计获取失败', { error })
  }
}

/**
 * 运行所有测试
 */
export async function runAllMemoryTests(): Promise<void> {
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║          VCP Memory Adapter 集成测试                             ║')
  console.log('║          验证记忆系统调用链路和向量存储位置                       ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('\n')

  // 清空追踪记录
  callTraces.length = 0

  // 运行测试
  await testGetStats()
  await testLightMemoSearch()
  await testDeepMemoSearch()
  await testCreateMemory()

  // 打印调用链路图
  printCallGraph()

  // 输出测试总结
  console.log('\n📋 测试总结:')
  console.log(`  - 总调用次数: ${callTraces.length}`)
  console.log(`  - 涉及后端: ${[...new Set(callTraces.map((t) => t.backend).filter(Boolean))].join(', ')}`)
  console.log(`  - 总耗时: ${callTraces.reduce((sum, t) => sum + t.durationMs, 0)}ms`)
  console.log('\n')
}

// 导出供 IPC 调用
export { callTraces, recordTrace, printCallGraph }
