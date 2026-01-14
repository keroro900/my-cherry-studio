/**
 * useCrewMemory - MultiModelCodeCrew 记忆集成 Hook
 *
 * 基于 useIntegratedMemory，为 Crew 提供特定的记忆功能：
 * - 项目上下文检索
 * - Agent 知识增强
 * - 执行结果学习
 */

import { useCallback, useMemo, useState } from 'react'

import {
  useIntegratedMemory,
  type EnhancedSearchResult,
  type MemoryBackendType
} from '@renderer/hooks/useIntegratedMemory'

// ==================== 类型定义 ====================

export interface CrewMemoryContext {
  id: string
  type: 'code' | 'doc' | 'requirement' | 'solution' | 'error'
  content: string
  source: 'search' | 'context' | 'history'
  relevanceScore: number
  tags: string[]
  metadata?: Record<string, unknown>
}

export interface CrewMemorySearchOptions {
  query: string
  projectPath?: string
  agentRole?: string
  includeTypes?: Array<'code' | 'doc' | 'requirement' | 'solution' | 'error'>
  topK?: number
  minScore?: number
}

export interface CrewLearningRecord {
  taskId: string
  agentRole: string
  input: string
  output: string
  success: boolean
  duration: number
  tags: string[]
}

// ==================== Hook 实现 ====================

/**
 * Crew 记忆集成 Hook
 */
export function useCrewMemory() {
  const { loading, error, intelligentSearch, createMemory, recordPositiveFeedback, recordNegativeFeedback } =
    useIntegratedMemory()

  const [searchResults, setSearchResults] = useState<CrewMemoryContext[]>([])

  // ==================== 项目上下文检索 ====================

  /**
   * 搜索项目相关的记忆上下文
   * 用于增强 Agent 的系统提示词
   */
  const searchProjectContext = useCallback(
    async (options: CrewMemorySearchOptions): Promise<CrewMemoryContext[]> => {
      const { query, projectPath, agentRole, includeTypes, topK = 10, minScore = 0.3 } = options

      // 构建增强查询
      let enhancedQuery = query
      if (projectPath) {
        enhancedQuery = `${query} project:${projectPath}`
      }
      if (agentRole) {
        enhancedQuery = `${enhancedQuery} role:${agentRole}`
      }

      // 搜索多个后端
      const backends: MemoryBackendType[] = ['knowledge', 'memory', 'lightmemo']
      const results: EnhancedSearchResult[] = await intelligentSearch(enhancedQuery, {
        backends,
        topK,
        threshold: minScore,
        applyLearning: true,
        recordQuery: true
      })

      // 转换为 Crew 上下文格式
      const contexts: CrewMemoryContext[] = results
        .filter((r) => r.score >= minScore)
        .map((r) => ({
          id: r.id,
          type: inferContentType(r.content, r.matchedTags || []),
          content: r.content,
          source: 'search' as const,
          relevanceScore: r.score,
          tags: r.matchedTags || [],
          metadata: r.metadata
        }))

      // 按类型过滤
      const filteredContexts = includeTypes ? contexts.filter((c) => includeTypes.includes(c.type)) : contexts

      setSearchResults(filteredContexts)
      return filteredContexts
    },
    [intelligentSearch]
  )

  /**
   * 获取 Agent 角色相关的知识
   */
  const getAgentKnowledge = useCallback(
    async (agentRole: string, taskDescription: string): Promise<string> => {
      const contexts = await searchProjectContext({
        query: `${agentRole} ${taskDescription}`,
        agentRole,
        topK: 5,
        minScore: 0.4
      })

      if (contexts.length === 0) {
        return ''
      }

      // 构建知识注入文本
      const knowledgeLines = contexts.map(
        (c, i) => `[参考 ${i + 1}] (${c.type}, 相关度: ${(c.relevanceScore * 100).toFixed(0)}%)\n${c.content}`
      )

      return `## 相关知识上下文\n\n${knowledgeLines.join('\n\n')}`
    },
    [searchProjectContext]
  )

  // ==================== 执行结果学习 ====================

  /**
   * 记录成功的执行结果
   * 用于后续检索和学习
   */
  const recordSuccessfulExecution = useCallback(
    async (record: CrewLearningRecord): Promise<boolean> => {
      const { taskId, agentRole, input, output, duration, tags } = record

      // 创建记忆条目
      const content = `## 任务执行记录\n\n**角色**: ${agentRole}\n**输入**: ${input}\n**输出**: ${output}\n**耗时**: ${duration}ms`

      const entry = await createMemory({
        content,
        title: `Crew 执行 - ${agentRole} - ${new Date().toLocaleString()}`,
        backend: 'memory',
        tags: ['crew', agentRole, 'execution', 'success', ...tags],
        autoTag: true
      })

      if (entry) {
        // 记录正向反馈
        await recordPositiveFeedback(taskId, entry.id, input)
        return true
      }

      return false
    },
    [createMemory, recordPositiveFeedback]
  )

  /**
   * 记录失败的执行
   * 用于避免重复错误
   */
  const recordFailedExecution = useCallback(
    async (record: Omit<CrewLearningRecord, 'success'> & { errorMessage: string }): Promise<boolean> => {
      const { taskId, agentRole, input, errorMessage, tags } = record

      // 创建错误记忆
      const content = `## 执行失败记录\n\n**角色**: ${agentRole}\n**输入**: ${input}\n**错误**: ${errorMessage}`

      const entry = await createMemory({
        content,
        title: `Crew 错误 - ${agentRole} - ${new Date().toLocaleString()}`,
        backend: 'memory',
        tags: ['crew', agentRole, 'execution', 'error', ...tags],
        autoTag: false
      })

      if (entry) {
        // 记录负向反馈
        await recordNegativeFeedback(taskId, entry.id, input)
        return true
      }

      return false
    },
    [createMemory, recordNegativeFeedback]
  )

  // ==================== 上下文构建 ====================

  /**
   * 构建完整的 Agent 上下文
   * 包含记忆检索结果
   */
  const buildAgentContext = useCallback(
    async (params: {
      agentRole: string
      taskDescription: string
      currentCode?: string
      projectPath?: string
    }): Promise<{
      systemPromptAddition: string
      relevantContexts: CrewMemoryContext[]
    }> => {
      const { agentRole, taskDescription, currentCode, projectPath } = params

      // 获取角色知识
      const roleKnowledge = await getAgentKnowledge(agentRole, taskDescription)

      // 如果有代码上下文，搜索相关解决方案
      let codeContexts: CrewMemoryContext[] = []
      if (currentCode) {
        codeContexts = await searchProjectContext({
          query: `code solution ${currentCode.slice(0, 200)}`,
          projectPath,
          includeTypes: ['code', 'solution'],
          topK: 3
        })
      }

      // 构建系统提示词补充
      let systemPromptAddition = ''
      if (roleKnowledge) {
        systemPromptAddition += `\n\n${roleKnowledge}`
      }
      if (codeContexts.length > 0) {
        systemPromptAddition += '\n\n## 相关代码参考\n\n'
        codeContexts.forEach((c, i) => {
          systemPromptAddition += `### 参考 ${i + 1}\n${c.content}\n\n`
        })
      }

      return {
        systemPromptAddition,
        relevantContexts: [...searchResults, ...codeContexts]
      }
    },
    [getAgentKnowledge, searchProjectContext, searchResults]
  )

  // ==================== 返回值 ====================

  return useMemo(
    () => ({
      loading,
      error,
      searchResults,
      // 项目上下文
      searchProjectContext,
      getAgentKnowledge,
      // 执行学习
      recordSuccessfulExecution,
      recordFailedExecution,
      // 上下文构建
      buildAgentContext
    }),
    [
      loading,
      error,
      searchResults,
      searchProjectContext,
      getAgentKnowledge,
      recordSuccessfulExecution,
      recordFailedExecution,
      buildAgentContext
    ]
  )
}

// ==================== 辅助函数 ====================

/**
 * 推断内容类型
 */
function inferContentType(content: string, tags: string[]): 'code' | 'doc' | 'requirement' | 'solution' | 'error' {
  const lowerContent = content.toLowerCase()
  const lowerTags = tags.map((t) => t.toLowerCase())

  // 检查标签
  if (lowerTags.some((t) => ['code', 'implementation', 'function', 'class'].includes(t))) {
    return 'code'
  }
  if (lowerTags.some((t) => ['error', 'bug', 'fix', 'issue'].includes(t))) {
    return 'error'
  }
  if (lowerTags.some((t) => ['requirement', 'spec', 'feature'].includes(t))) {
    return 'requirement'
  }
  if (lowerTags.some((t) => ['solution', 'answer', 'resolved'].includes(t))) {
    return 'solution'
  }

  // 检查内容特征
  if (lowerContent.includes('```') || lowerContent.includes('function') || lowerContent.includes('class')) {
    return 'code'
  }
  if (lowerContent.includes('error') || lowerContent.includes('failed') || lowerContent.includes('exception')) {
    return 'error'
  }
  if (lowerContent.includes('should') || lowerContent.includes('must') || lowerContent.includes('requirement')) {
    return 'requirement'
  }
  if (lowerContent.includes('solution') || lowerContent.includes('fixed') || lowerContent.includes('resolved')) {
    return 'solution'
  }

  return 'doc'
}

export default useCrewMemory
