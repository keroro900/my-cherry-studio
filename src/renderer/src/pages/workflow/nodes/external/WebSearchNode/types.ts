/**
 * Web Search Node Types
 * 网络搜索节点类型定义
 */

import type { WebSearchProviderId, WebSearchProviderResult } from '@renderer/types'

/**
 * 搜索提供商配置
 */
export interface WebSearchNodeConfig {
  /** 搜索提供商 ID */
  providerId: WebSearchProviderId
  /** 最大搜索结果数 */
  maxResults: number
  /** 是否启用时间搜索 */
  searchWithTime: boolean
  /** 超时时间（秒） */
  timeout: number
  /** 是否返回原始结果 */
  returnRawResults: boolean
  /** 结果内容最大长度 */
  contentMaxLength: number
  /** 搜索语言 */
  language?: string
  /** 搜索地区 */
  region?: string
}

/**
 * 搜索结果项（扩展版本）
 */
export interface WebSearchResult extends WebSearchProviderResult {
  /** 结果索引 */
  index: number
  /** 截断后的内容 */
  truncatedContent?: string
}

/**
 * WebSearch 节点输出
 */
export interface WebSearchNodeOutput {
  /** 搜索结果数组 */
  results: WebSearchResult[]
  /** 搜索查询 */
  query: string
  /** 结果数量 */
  count: number
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 原始响应 */
  rawResponse?: unknown
}
