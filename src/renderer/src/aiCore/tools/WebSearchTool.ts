import { REFERENCE_PROMPT } from '@renderer/config/prompts'
import WebSearchService from '@renderer/services/WebSearchService'
import type { WebSearchProvider, WebSearchProviderResponse } from '@renderer/types'
import type { ExtractResults } from '@renderer/utils/extract'
import { type InferToolInput, type InferToolOutput, tool } from 'ai'
import * as z from 'zod'

/**
 * 配置开关：是否使用 VCP 统一执行路径
 * 当为 true 时，搜索通过 VCPUnified (Main process) 路由到外部 VCP 插件
 * 当为 false 时，搜索通过 WebSearchService (Renderer process) 直接执行
 *
 * 注意：Web 搜索不使用统一记忆层 (IntegratedMemoryCoordinator)，
 * 因为搜索结果不存储在 UnifiedStorageCore 中。
 * VCP 统一路径主要用于：
 * 1. 统一的工具调用追踪和日志
 * 2. 支持外部 VCP Web 搜索插件（如 VCPToolBox 的 WebSearch 插件）
 *
 * @see Phase 1 of VCP 统一重构计划
 */
const USE_VCP_UNIFIED_PATH = false // TODO: 当有可用的 VCP WebSearch 插件时设为 true

/**
 * 使用预提取关键词的网络搜索工具
 * 这个工具直接使用插件阶段分析的搜索意图，避免重复分析
 */
export const webSearchToolWithPreExtractedKeywords = (
  webSearchProviderId: WebSearchProvider['id'],
  extractedKeywords: {
    question: string[]
    links?: string[]
  },
  requestId: string
) => {
  const webSearchProvider = WebSearchService.getWebSearchProvider(webSearchProviderId)

  return tool({
    name: 'builtin_web_search',
    description: `Web search tool for finding current information, news, and real-time data from the internet.

This tool has been configured with search parameters based on the conversation context:
- Prepared queries: ${extractedKeywords.question.map((q) => `"${q}"`).join(', ')}${
      extractedKeywords.links?.length
        ? `
- Relevant URLs: ${extractedKeywords.links.join(', ')}`
        : ''
    }

You can use this tool as-is to search with the prepared queries, or provide additionalContext to refine or replace the search terms.`,

    inputSchema: z.object({
      additionalContext: z
        .string()
        .optional()
        .describe('Optional additional context, keywords, or specific focus to enhance the search')
    }),

    execute: async ({ additionalContext }) => {
      let finalQueries = [...extractedKeywords.question]

      if (additionalContext?.trim()) {
        // 如果大模型提供了额外上下文，使用更具体的描述
        const cleanContext = additionalContext.trim()
        if (cleanContext) {
          finalQueries = [cleanContext]
        }
      }

      let searchResults: WebSearchProviderResponse = {
        query: '',
        results: []
      }
      // 检查是否需要搜索
      if (finalQueries[0] === 'not_needed') {
        return searchResults
      }

      // ========== VCP 统一路径 ==========
      // 通过 VCPUnified (Main process) 路由到外部 VCP 插件
      // 注意：需要有可用的 VCP WebSearch 插件
      if (USE_VCP_UNIFIED_PATH) {
        try {
          // 尝试通过 VCP 统一执行路径调用外部搜索插件
          const result = await window.api.vcpUnified.executeTool({
            toolName: 'WebSearch', // VCPToolBox 风格的插件名
            params: {
              query: finalQueries[0],
              additional_queries: finalQueries.slice(1),
              urls: extractedKeywords.links || []
            },
            source: 'vcp'
          })

          if (result.success && result.output) {
            // 尝试解析 VCP 插件返回的结果
            const vcpOutput =
              typeof result.output === 'string' ? JSON.parse(result.output) : (result.output as Record<string, unknown>)

            if (vcpOutput.results && Array.isArray(vcpOutput.results)) {
              return {
                query: finalQueries[0],
                results: vcpOutput.results.map((r: Record<string, unknown>) => ({
                  title: String(r.title || ''),
                  content: String(r.content || r.snippet || ''),
                  url: String(r.url || r.link || '')
                }))
              }
            }
          }

          console.warn('[WebSearchTool] VCP search returned no valid results, falling back to legacy path')
          // 回退到旧路径
        } catch (error) {
          console.warn('[WebSearchTool] VCP unified path not available, falling back to legacy path:', error)
          // 回退到旧路径
        }
      }

      // ========== Legacy 路径 ==========
      // 直接通过 WebSearchService (Renderer process) 执行搜索

      // 构建 ExtractResults 结构用于 processWebsearch
      const extractResults: ExtractResults = {
        websearch: {
          question: finalQueries,
          links: extractedKeywords.links
        }
      }
      searchResults = await WebSearchService.processWebsearch(webSearchProvider!, extractResults, requestId)

      return searchResults
    },
    toModelOutput: (results) => {
      let summary = 'No search needed based on the query analysis.'
      if (results.query && results.results.length > 0) {
        summary = `Found ${results.results.length} relevant sources. Use [number] format to cite specific information.`
      }

      const citationData = results.results.map((result, index) => ({
        number: index + 1,
        title: result.title,
        content: result.content,
        url: result.url
      }))

      // 🔑 返回引用友好的格式，复用 REFERENCE_PROMPT 逻辑
      const referenceContent = `\`\`\`json\n${JSON.stringify(citationData, null, 2)}\n\`\`\``
      const fullInstructions = REFERENCE_PROMPT.replace(
        '{question}',
        "Based on the search results, please answer the user's question with proper citations."
      ).replace('{references}', referenceContent)
      return {
        type: 'content',
        value: [
          {
            type: 'text',
            text: 'This tool searches for relevant information and formats results for easy citation. The returned sources should be cited using [1], [2], etc. format in your response.'
          },
          {
            type: 'text',
            text: summary
          },
          {
            type: 'text',
            text: fullInstructions
          }
        ]
      }
    }
  })
}

// export const webSearchToolWithExtraction = (
//   webSearchProviderId: WebSearchProvider['id'],
//   requestId: string,
//   assistant: Assistant
// ) => {
//   const webSearchService = WebSearchService.getInstance(webSearchProviderId)

//   return tool({
//     name: 'web_search_with_extraction',
//     description: 'Search the web for information with automatic keyword extraction from user messages',
//     inputSchema: z.object({
//       userMessage: z.object({
//         content: z.string().describe('The main content of the message'),
//         role: z.enum(['user', 'assistant', 'system']).describe('Message role')
//       }),
//       lastAnswer: z.object({
//         content: z.string().describe('The main content of the message'),
//         role: z.enum(['user', 'assistant', 'system']).describe('Message role')
//       })
//     }),
//     outputSchema: z.object({
//       extractedKeywords: z.object({
//         question: z.array(z.string()),
//         links: z.array(z.string()).optional()
//       }),
//       searchResults: z.array(
//         z.object({
//           query: z.string(),
//           results: WebSearchProviderResult
//         })
//       )
//     }),
//     execute: async ({ userMessage, lastAnswer }) => {
//       const lastUserMessage: Message = {
//         id: requestId,
//         role: userMessage.role,
//         assistantId: assistant.id,
//         topicId: 'temp',
//         createdAt: new Date().toISOString(),
//         status: UserMessageStatus.SUCCESS,
//         blocks: []
//       }

//       const lastAnswerMessage: Message | undefined = lastAnswer
//         ? {
//             id: requestId + '_answer',
//             role: lastAnswer.role,
//             assistantId: assistant.id,
//             topicId: 'temp',
//             createdAt: new Date().toISOString(),
//             status: UserMessageStatus.SUCCESS,
//             blocks: []
//           }
//         : undefined

//       const extractResults = await extractSearchKeywords(lastUserMessage, assistant, {
//         shouldWebSearch: true,
//         shouldKnowledgeSearch: false,
//         lastAnswer: lastAnswerMessage
//       })

//       if (!extractResults?.websearch || extractResults.websearch.question[0] === 'not_needed') {
//         return 'No search needed or extraction failed'
//       }

//       const searchQueries = extractResults.websearch.question
//       const searchResults: Array<{ query: string; results: any }> = []

//       for (const query of searchQueries) {
//         // 构建单个查询的ExtractResults结构
//         const queryExtractResults: ExtractResults = {
//           websearch: {
//             question: [query],
//             links: extractResults.websearch.links
//           }
//         }
//         const response = await webSearchService.processWebsearch(queryExtractResults, requestId)
//         searchResults.push({
//           query,
//           results: response
//         })
//       }

//       return { extractedKeywords: extractResults.websearch, searchResults }
//     }
//   })
// }

// export type WebSearchToolWithExtractionOutput = InferToolOutput<ReturnType<typeof webSearchToolWithExtraction>>

export type WebSearchToolOutput = InferToolOutput<ReturnType<typeof webSearchToolWithPreExtractedKeywords>>
export type WebSearchToolInput = InferToolInput<ReturnType<typeof webSearchToolWithPreExtractedKeywords>>
