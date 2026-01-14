/**
 * VCP 日记组件导出
 *
 * 提供:
 * - 日记编辑器 (VCP 语法高亮)
 * - 知识库浏览器
 * - RAG-Tags 标签管理
 * - 语义组管理
 */

// 类型导出
export * from './types'

// 语法高亮
export { parseDiarySyntax, VCPSyntaxHighlighter, VCPSyntaxLegend } from './VCPSyntaxHighlighter'

// 日记编辑器
export { DiaryEditor } from './DiaryEditor'

// 知识库浏览器
export { KnowledgeBrowser } from './KnowledgeBrowser'

// RAG-Tags 管理
export { RAGTagsManager } from './RAGTagsManager'
