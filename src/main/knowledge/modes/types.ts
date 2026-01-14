/**
 * 日记模式类型定义
 * 基于 VCPToolBox 的 4 种日记声明模式
 */

import type { TimeRange } from '@main/utils/TimeExpressionParser'

/**
 * 检索模式类型
 */
export type RetrievalMode =
  | 'fulltext' // {{}} 全文注入
  | 'rag' // [[]] RAG 片段
  | 'threshold_fulltext' // <<>> 阈值全文
  | 'threshold_rag' // 《《》》 阈值 RAG

/**
 * 检索后端类型
 */
export type RetrievalBackend = 'lightmemo' | 'deepmemo' | 'meshmemo' | 'auto'

/**
 * 日记模式语法
 */
export interface DiaryModeSyntax {
  mode: RetrievalMode
  openTag: string
  closeTag: string
  regex: RegExp
}

/**
 * 解析后的日记声明
 */
export interface ParsedDiaryDeclaration {
  mode: RetrievalMode
  knowledgeBaseName: string
  modifiers: DiaryModifier[]
  raw: string // 原始字符串
  startIndex: number // 在原文中的起始位置
  endIndex: number // 在原文中的结束位置
}

/**
 * 日记模式修饰符
 */
export interface DiaryModifier {
  type:
    | 'time'
    | 'group'
    | 'tagmemo'
    | 'aimemo' // AIMemo AI 驱动合成召回
    | 'rerank' // 精准重排序
    | 'topk'
    | 'k'
    | 'threshold'
    | 'backend'
    | 'kFactor' // 动态 K 值系数
    | 'timeRange'
    | 'custom'
  value: string
  parsed?: Record<string, unknown>
}

/**
 * 检索配置
 */
export interface RetrievalConfig {
  mode: RetrievalMode
  backend?: RetrievalBackend // 检索后端
  threshold?: number // 相似度阈值 (0-1)
  topK?: number // 返回结果数量
  kFactor?: number // 动态 K 值系数，用于计算 topK = baseK * kFactor
  timeAware?: boolean // 是否启用时间感知
  timeRange?: string // 时间范围表达式 (原始文本)
  parsedTimeRanges?: TimeRange[] // 解析后的时间范围 (由 TimeExpressionParser 生成)
  semanticGroups?: string[] // 语义组
  tagMemo?: boolean // 是否启用 TagMemo
  tagMemoThreshold?: number // TagMemo 阈值
  aiMemo?: boolean // 是否启用 AIMemo AI 合成召回
  rerank?: boolean // 是否启用精准重排序
}

/**
 * 日记模式解析结果
 */
export interface DiaryModeParseResult {
  declarations: ParsedDiaryDeclaration[]
  cleanedText: string // 移除声明后的文本
  configs: Map<string, RetrievalConfig> // 知识库名 -> 配置
}

// 重导出 TimeRange 类型方便使用
export type { TimeRange } from '@main/utils/TimeExpressionParser'
