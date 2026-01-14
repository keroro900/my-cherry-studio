import { REFERENCE_PROMPT } from '@renderer/config/prompts'
import { processKnowledgeSearch } from '@renderer/services/KnowledgeService'
import { getProviderByModel } from '@renderer/services/AssistantService'
import type { Assistant, KnowledgeReference } from '@renderer/types'
import type { ExtractResults, KnowledgeExtractResults } from '@renderer/utils/extract'
import { type InferToolInput, type InferToolOutput, tool } from 'ai'
import { isEmpty } from 'lodash'
import * as z from 'zod'

/**
 * 配置开关：是否使用 VCP 统一记忆层
 * 当为 true 时，搜索通过 VCPMemoryAdapter (Main process) 执行
 * 当为 false 时，搜索通过 KnowledgeService (Renderer process) 执行
 *
 * @see Phase 1 of VCP 统一重构计划
 */
const USE_VCP_UNIFIED_PATH = true // 启用 VCP 统一路径

/**
 * 知识库搜索工具
 * 使用预提取关键词，直接使用插件阶段分析的搜索意图，避免重复分析
 */
export const knowledgeSearchTool = (
  assistant: Assistant,
  extractedKeywords: KnowledgeExtractResults,
  topicId: string,
  userMessage?: string
) => {
  return tool({
    name: 'builtin_knowledge_search',
    description: `Knowledge base search tool for retrieving information from user's private knowledge base. This searches your local collection of documents, web content, notes, and other materials you have stored.

This tool has been configured with search parameters based on the conversation context:
- Prepared queries: ${extractedKeywords.question.map((q) => `"${q}"`).join(', ')}
- Query rewrite: "${extractedKeywords.rewrite}"

You can use this tool as-is, or provide additionalContext to refine the search focus within the knowledge base.`,

    inputSchema: z.object({
      additionalContext: z
        .string()
        .optional()
        .describe('Optional additional context or specific focus to enhance the knowledge search')
    }),

    execute: async ({ additionalContext }) => {
      // try {
      // 获取助手的知识库配置
      const knowledgeBaseIds = assistant.knowledge_bases?.map((base) => base.id)
      const hasKnowledgeBase = !isEmpty(knowledgeBaseIds)
      const knowledgeRecognition = assistant.knowledgeRecognition || 'on'

      // 检查是否有知识库
      if (!hasKnowledgeBase) {
        return []
      }

      let finalQueries = [...extractedKeywords.question]
      let finalRewrite = extractedKeywords.rewrite

      if (additionalContext?.trim()) {
        // 如果大模型提供了额外上下文，使用更具体的描述
        const cleanContext = additionalContext.trim()
        if (cleanContext) {
          finalQueries = [cleanContext]
          finalRewrite = cleanContext
        }
      }

      // 检查是否需要搜索
      if (finalQueries[0] === 'not_needed') {
        return []
      }

      // 构建搜索条件
      let searchCriteria: { question: string[]; rewrite: string }

      if (knowledgeRecognition === 'off') {
        // 直接模式：使用用户消息内容
        const directContent = userMessage || finalQueries[0] || 'search'
        searchCriteria = {
          question: [directContent],
          rewrite: directContent
        }
      } else {
        // 自动模式：使用意图识别的结果
        searchCriteria = {
          question: finalQueries,
          rewrite: finalRewrite
        }
      }

      // ========== VCP 统一路径 ==========
      // 通过 VCPMemoryAdapter (Main process) 执行搜索
      // 这是 Phase 1 VCP 统一重构的核心改动
      if (USE_VCP_UNIFIED_PATH) {
        try {
          // 从知识库配置获取 embedding 和 reranker 模型
          // 知识库在创建时就配置好了这些模型
          const firstKnowledgeBase = assistant.knowledge_bases?.[0]
          let embeddingConfig: {
            providerId: string
            modelId: string
            apiKey?: string
            baseUrl?: string
          } | undefined

          let rerankConfig: {
            providerId: string
            modelId: string
            apiKey?: string
            baseUrl?: string
          } | undefined

          // 使用知识库自己的 embedding 模型配置
          if (firstKnowledgeBase?.model) {
            const embeddingProvider = getProviderByModel(firstKnowledgeBase.model)
            embeddingConfig = {
              providerId: embeddingProvider.id,
              modelId: firstKnowledgeBase.model.id,
              apiKey: embeddingProvider.apiKey,
              baseUrl: embeddingProvider.apiHost
            }
          }

          // 使用知识库自己的 reranker 模型配置（如果有）
          if (firstKnowledgeBase?.rerankModel) {
            const rerankProvider = getProviderByModel(firstKnowledgeBase.rerankModel)
            rerankConfig = {
              providerId: rerankProvider.id,
              modelId: firstKnowledgeBase.rerankModel.id,
              apiKey: rerankProvider.apiKey,
              baseUrl: rerankProvider.apiHost
            }
          }

          // 使用 VCP 统一记忆层进行搜索
          // IntegratedMemoryCoordinator 会自动应用:
          // - SelfLearning 学习权重
          // - TagBoost 标签增强
          // - RRF 多源融合
          const result = await window.api.vcpMemory.intelligentSearch({
            query: searchCriteria.rewrite,
            k: 10,
            backends: ['knowledge'], // 限定为知识库后端
            enableLearning: true,
            // 使用知识库 ID 作为 tags 进行过滤
            tags: knowledgeBaseIds,
            embeddingConfig,
            rerankConfig
          })

          if (!result.success || !result.data) {
            console.warn('[KnowledgeSearchTool] VCP search failed, falling back to legacy path', result.error)
            // 回退到旧路径
          } else {
            // 转换 VCP 结果格式为工具输出格式
            return result.data.map((r) => ({
              id: r.id,
              content: r.content,
              sourceUrl: r.metadata?.sourceUrl as string | undefined,
              type: r.metadata?.type as string | undefined,
              file: r.metadata?.file as { name: string; origin_name?: string } | undefined,
              metadata: r.metadata
            }))
          }
        } catch (error) {
          console.error('[KnowledgeSearchTool] VCP unified path error:', error)
          // 回退到旧路径
        }
      }

      // ========== Legacy 路径 ==========
      // 直接通过 KnowledgeService (Renderer process) 执行搜索

      // 构建 ExtractResults 对象
      const extractResults: ExtractResults = {
        websearch: undefined,
        knowledge: searchCriteria
      }

      // 执行知识库搜索
      const knowledgeReferences = await processKnowledgeSearch(extractResults, knowledgeBaseIds, topicId)
      const knowledgeReferencesData = knowledgeReferences.map((ref: KnowledgeReference) => ({
        id: ref.id,
        content: ref.content,
        sourceUrl: ref.sourceUrl,
        type: ref.type,
        file: ref.file,
        metadata: ref.metadata
      }))

      // TODO 在工具函数中添加搜索缓存机制
      // const searchCacheKey = `${topicId}-${JSON.stringify(finalQueries)}`

      // 返回结果
      return knowledgeReferencesData
    },
    toModelOutput: (results) => {
      let summary = 'No search needed based on the query analysis.'
      if (results.length > 0) {
        summary = `Found ${results.length} relevant sources. Use [number] format to cite specific information.`
      }
      const referenceContent = `\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``
      const fullInstructions = REFERENCE_PROMPT.replace(
        '{question}',
        "Based on the knowledge references, please answer the user's question with proper citations."
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

export type KnowledgeSearchToolInput = InferToolInput<ReturnType<typeof knowledgeSearchTool>>
export type KnowledgeSearchToolOutput = InferToolOutput<ReturnType<typeof knowledgeSearchTool>>

export default knowledgeSearchTool
