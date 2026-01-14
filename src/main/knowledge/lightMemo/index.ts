/**
 * LightMemo 模块导出
 *
 * 轻量级 BM25 + 向量检索服务
 */

export type { LightMemoConfig, LightMemoDocument, LightMemoSearchResult } from './LightMemoService'
export {
  createLightMemoService,
  createNativeLightMemoService,
  getLightMemoService,
  getNativeLightMemoService,
  LightMemoService,
  NativeLightMemoService
} from './LightMemoService'
