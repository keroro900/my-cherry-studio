/**
 * VCP 日记语法类型定义
 */

// VCP 日记声明语法模式
export type DiaryDeclarationMode = 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'

// 声明语法映射
export const DIARY_SYNTAX = {
  fulltext: { open: '{{', close: '}}', label: '全文注入', color: '#52c41a' },
  rag: { open: '[[', close: ']]', label: 'RAG 片段', color: '#1890ff' },
  threshold_fulltext: { open: '<<', close: '>>', label: '阈值全文', color: '#faad14' },
  threshold_rag: { open: '《《', close: '》》', label: '阈值 RAG', color: '#722ed1' }
} as const

// 修饰符
export const DIARY_MODIFIERS = {
  time: { key: '::Time', label: '时间感知', description: '解析自然语言时间表达式' },
  group: { key: '::Group', label: '语义组', description: '启用语义组增强' },
  tagMemo: { key: '::TagMemo', label: '标签网络', description: '启用 TagMemo 增强' },
  rerank: { key: '::Rerank', label: '精排', description: '启用 Rerank 精排' }
} as const

// 日记声明
export interface DiaryDeclaration {
  mode: DiaryDeclarationMode
  knowledgeBaseName: string
  modifiers: string[]
  topK?: number
  threshold?: number
  raw: string
  startIndex: number
  endIndex: number
}

// 解析后的日记内容
export interface ParsedDiaryContent {
  declarations: DiaryDeclaration[]
  cleanedText: string
  originalText: string
}

// 知识块元数据
export interface DiaryChunkMeta {
  id: string
  title: string
  source: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  category?: string
  season?: string
  styles?: string[]
}

// 日记文件
export interface DiaryFile {
  id: string
  name: string
  path: string
  content: string
  chunks: DiaryChunkMeta[]
  createdAt: Date
  updatedAt: Date
  size: number
  isIndexed: boolean
}

// RAG 标签
export interface RAGTag {
  id: string
  name: string
  color: string
  count: number
  relatedTags: string[]
}

// 语义组
export interface SemanticGroup {
  id: string
  name: string
  keywords: string[]
  weight: number
  category: string
}
