/**
 * Native VCP 服务入口
 *
 * 导出所有 Native VCP 相关功能
 */

export * from './NativeVCPBridge'

// 导出基准测试
export {
  runFullBenchmarkSuite,
  runQuickBenchmark,
  benchmarkVectorStore,
  benchmarkTagCooccurrence,
  benchmarkDatabase,
  benchmarkSearchEngine,
  // T-004 大规模基准测试
  runLargeScaleBenchmarkSuite,
  benchmarkLargeTagCooccurrence,
  benchmarkLargeSearchEngine,
  benchmarkLargeVectorStore,
  exportBenchmarkResults,
  type BenchmarkResult,
  type BenchmarkSuite,
  type LargeScaleBenchmarkResult,
  type LargeScaleBenchmarkSuite
} from './NativeVCPBenchmark'

// 导出 Rerank 工具
export {
  rerank,
  rerankScores,
  extractBestParagraph,
  unifiedRerank,
  type RerankItem,
  type RerankOptions,
  type RerankMode,
  type UnifiedRerankOptions,
  type UnifiedRerankResult
} from './RerankUtils'

// 导出神经重排服务
export {
  NeuralRerankService,
  getNeuralRerankService,
  neuralRerank,
  type NeuralRerankConfig,
  type NeuralRerankResult,
  type RerankModelConfig
} from './NeuralRerankService'

// 重导出主要类型
export type {
  NativeVCPConfig,
  HealthStatus,
  TagPairUpdate,
  TagAssociation,
  TagMatrixStats,
  TraceLog,
  SpanInfo
} from './NativeVCPBridge'
