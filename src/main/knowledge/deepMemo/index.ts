/**
 * DeepMemo 模块导出
 *
 * 双层检索服务 (关键词 + 向量 + Rerank)
 */

export type {
  DeepMemoConfig,
  DeepMemoDocument,
  DeepMemoSearchResult,
  KeywordBackend,
  RerankerFn,
  TantivyAdapter
} from './DeepMemoService'
export { createDeepMemoService, DeepMemoService, getDeepMemoService } from './DeepMemoService'
export { createTantivyLikeAdapter, getTantivyLikeAdapter, TantivyLikeAdapter } from './TantivyLikeAdapter'
