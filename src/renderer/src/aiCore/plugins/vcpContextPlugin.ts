/**
 * VCP 上下文注入插件
 *
 * 功能:
 * 1. onRequestStart: 获取激活的 VCP Agent 和上下文注入规则
 * 2. transformParams: 将 VCP 上下文注入到系统提示词
 * 3. onRequestEnd: 触发日记写入 (如果 AI 请求)
 *
 * 实现 VCPToolBox 的核心理念：让 AI 对话自动应用上下文增强，实现"经验内化"
 *
 * 架构融合:
 * - 支持读取 assistant.knowledge_bases 配置
 * - 支持 VCPAgent 的知识库配置
 * - 自动进行知识库名称到ID的映射
 * - 与 ShowVCPService 完整集成，提供实时调试能力
 * - 支持按 position 精准注入到 system/user/assistant 消息
 * - 支持 VCP TOOL_REQUEST 协议解析与执行
 */
import { type AiRequestContext, definePlugin } from '@cherrystudio/ai-core'
import { loggerService } from '@logger'
import type { Assistant } from '@renderer/types'

const logger = loggerService.withContext('VCPContextPlugin')

// ==================== 类型定义 ====================

/**
 * 记忆搜索结果类型
 */
interface MemorySearchResult {
  id: string
  content: string
  backend?: string
  score?: number
}

/**
 * 记忆搜索响应类型
 */
interface MemorySearchResponse {
  success?: boolean
  results?: MemorySearchResult[]
}

/**
 * VCP Agent 信息
 */
interface VCPAgentInfo {
  id: string
  name: string
  systemPrompt?: string
  knowledgeBaseId?: string
  vcpConfig?: {
    enabled?: boolean
    knowledgeBaseId?: string
  }
}

/**
 * Chat 消息类型
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
  name?: string
  tool_call_id?: string
}

/**
 * 注入位置类型
 */
type InjectionPosition =
  | 'system_prefix'
  | 'system_suffix'
  | 'context_prefix'
  | 'context_suffix'
  | 'user_prefix'
  | 'user_suffix'
  | 'assistant_prefix'
  | 'hidden'

/**
 * 注入结果（与 ContextInjectorService 匹配）
 */
interface InjectionResult {
  position: InjectionPosition
  content: string
  ruleId: string
  ruleName: string
}

/**
 * 按位置分组的注入内容
 */
interface GroupedInjections {
  system_prefix: string[]
  system_suffix: string[]
  context_prefix: string[]
  context_suffix: string[]
  user_prefix: string[]
  user_suffix: string[]
  assistant_prefix: string[]
  hidden: string[]
}

/**
 * Tavern 角色卡类型（简化版）
 */
interface TavernCard {
  id: string
  name: string
  data?: {
    description?: string
    personality?: string
    scenario?: string
    system_prompt?: string
    post_history_instructions?: string
    character_book?: unknown
  }
}

// ==================== ShowVCP 调试辅助函数 ====================

/**
 * 开始 ShowVCP 会话
 * 使用原生 window.api.showVcp API
 */
async function startShowVCPSession(agentId?: string, agentName?: string): Promise<string | null> {
  try {
    const config = await window.api.showVcp.getConfig()
    if (!config?.enabled) return null

    const result = await window.api.showVcp.startSession({ agentId, agentName })
    return result?.sessionId || null
  } catch {
    return null
  }
}

/**
 * 结束 ShowVCP 会话
 */
async function endShowVCPSession(): Promise<void> {
  try {
    await window.api.showVcp.endSession()
  } catch {
    // 忽略错误
  }
}

/**
 * 记录 VCP 调用开始
 */
async function logVCPCallStart(
  type: 'injection' | 'tool_call' | 'diary_read' | 'diary_write' | 'context' | 'variable',
  name: string,
  args?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  try {
    const config = await window.api.showVcp.getConfig()
    if (!config?.enabled) return null

    const result = await window.api.showVcp.logCallStart({
      type,
      name,
      callArgs: args,
      metadata
    })

    logger.debug(`[ShowVCP] ${type}::${name} started`, { callId: result?.callId, args })
    return result?.callId || null
  } catch {
    return null
  }
}

/**
 * 记录 VCP 调用结束
 */
async function logVCPCallEnd(callId: string | null, result?: unknown, error?: string): Promise<void> {
  if (!callId) return

  try {
    await window.api.showVcp.logCallEnd({ callId, result, error })
    logger.debug(`[ShowVCP] Call ${callId} ended`, { error })
  } catch {
    // 忽略错误
  }
}

/**
 * 记录上下文注入
 */
async function logVCPInjection(content: string, source?: string): Promise<void> {
  try {
    const config = await window.api.showVcp.getConfig()
    if (!config?.enabled) return

    await window.api.showVcp.logInjection({ content, source })
  } catch {
    // 忽略错误
  }
}

/**
 * 创建空的分组注入对象
 */
function createEmptyGroupedInjections(): GroupedInjections {
  return {
    system_prefix: [],
    system_suffix: [],
    context_prefix: [],
    context_suffix: [],
    user_prefix: [],
    user_suffix: [],
    assistant_prefix: [],
    hidden: []
  }
}

/**
 * 将注入结果按位置分组
 */
function groupInjectionsByPosition(injections: InjectionResult[]): GroupedInjections {
  const grouped = createEmptyGroupedInjections()

  for (const injection of injections) {
    const position = injection.position || 'system_prefix'
    if (grouped[position]) {
      grouped[position].push(injection.content)
    }
  }

  return grouped
}

/**
 * 将字符串数组的注入内容转换为带默认位置的 InjectionResult[]
 * 用于处理日记搜索等返回 string[] 的情况
 */
function convertToInjectionResults(
  contents: string[],
  defaultPosition: InjectionPosition = 'system_prefix'
): InjectionResult[] {
  return contents.map((content, index) => ({
    position: defaultPosition,
    content,
    ruleId: `diary-${index}`,
    ruleName: 'diary_search'
  }))
}

// ==================== 上下文智能辅助函数 ====================

/**
 * 上下文智能配置
 */
interface ContextIntelligenceConfig {
  /** 启用上下文净化 */
  enablePurification?: boolean
  /** 启用幻觉抑制 */
  enableHallucinationSuppression?: boolean
  /** 净化器配置 */
  purifierConfig?: Record<string, unknown>
  /** 幻觉抑制器配置 */
  suppressorConfig?: Record<string, unknown>
}

// 默认配置
const defaultContextIntelligenceConfig: ContextIntelligenceConfig = {
  enablePurification: true,
  enableHallucinationSuppression: true
}

// 当前配置
let contextIntelligenceConfig: ContextIntelligenceConfig = { ...defaultContextIntelligenceConfig }

/**
 * 设置上下文智能配置
 */
export function setContextIntelligenceConfig(config: Partial<ContextIntelligenceConfig>): void {
  contextIntelligenceConfig = { ...contextIntelligenceConfig, ...config }
}

/**
 * 获取上下文智能配置
 */
export function getContextIntelligenceConfig(): ContextIntelligenceConfig {
  return { ...contextIntelligenceConfig }
}

/**
 * 净化上下文内容
 */
async function purifyContent(content: string, config?: Record<string, unknown>): Promise<string> {
  if (!contextIntelligenceConfig.enablePurification) {
    return content
  }

  // 检查 API 是否可用
  if (!window.api?.contextIntelligence?.purify) {
    logger.debug('Context purification API not available, skipping')
    return content
  }

  try {
    const result = await window.api.contextIntelligence.purify(content, config)
    if (result && result.content) {
      logger.debug('Context purified', {
        originalLength: result.originalLength,
        purifiedLength: result.purifiedLength,
        modificationsCount: result.modifications.length
      })
      return result.content
    }
    return content
  } catch (error) {
    logger.warn('Context purification failed, using original content', error as Error)
    return content
  }
}

/**
 * 抑制幻觉
 */
async function suppressHallucination(
  text: string,
  context?: {
    conversationHistory?: string[]
    knowledgeBase?: Array<{ content: string; source: string; confidence: number }>
    userQuery?: string
  },
  config?: Record<string, unknown>
): Promise<{ text: string; confidence: number; wasModified: boolean }> {
  if (!contextIntelligenceConfig.enableHallucinationSuppression) {
    return { text, confidence: 1.0, wasModified: false }
  }

  // 检查 API 是否可用
  if (!window.api?.contextIntelligence?.suppress) {
    logger.debug('Hallucination suppression API not available, skipping')
    return { text, confidence: 1.0, wasModified: false }
  }

  try {
    const result = await window.api.contextIntelligence.suppress(text, context, config)
    if (result) {
      logger.debug('Hallucination suppression complete', {
        detectionsCount: result.detections?.length || 0,
        overallConfidence: result.overallConfidence,
        wasModified: result.wasModified
      })
      return {
        text: result.processedText || text,
        confidence: result.overallConfidence,
        wasModified: result.wasModified
      }
    }
    return { text, confidence: 1.0, wasModified: false }
  } catch (error) {
    logger.warn('Hallucination suppression failed, using original text', error as Error)
    return { text, confidence: 1.0, wasModified: false }
  }
}

/**
 * 应用消息级别的注入（user_prefix, user_suffix, assistant_prefix）
 */
function applyMessageInjections(messages: ChatMessage[], grouped: GroupedInjections): ChatMessage[] {
  if (!messages || messages.length === 0) return messages

  return messages.map((msg, index) => {
    // 深拷贝消息避免修改原对象
    const newMsg = { ...msg }

    // 只处理最后一条用户消息
    if (msg.role === 'user' && index === messages.length - 1) {
      const userContent = typeof msg.content === 'string' ? msg.content : msg.content

      if (grouped.user_prefix.length > 0 || grouped.user_suffix.length > 0) {
        const prefix = grouped.user_prefix.length > 0 ? grouped.user_prefix.join('\n') + '\n\n' : ''
        const suffix = grouped.user_suffix.length > 0 ? '\n\n' + grouped.user_suffix.join('\n') : ''

        if (typeof userContent === 'string') {
          newMsg.content = prefix + userContent + suffix
        }
      }
    }

    // 处理助手消息前缀（应用于最后一条助手消息之后的新响应）
    // 注意：这通常在响应生成时应用，而非预处理

    return newMsg
  })
}

/**
 * 获取助手配置的知识库ID
 * 优先使用 VCPAgent 的配置，否则使用助手的 knowledge_bases 配置
 */
function getKnowledgeBaseId(assistant: Assistant, vcpAgent?: VCPAgentInfo | null): string | undefined {
  // 1. 优先使用 VCPAgent 的知识库配置
  if (vcpAgent?.knowledgeBaseId) {
    return vcpAgent.knowledgeBaseId
  }
  if (vcpAgent?.vcpConfig?.knowledgeBaseId) {
    return vcpAgent.vcpConfig.knowledgeBaseId
  }

  // 2. 使用助手的 knowledge_bases 配置（取第一个启用的知识库）
  const knowledgeBases = (assistant as unknown as { knowledge_bases?: Array<{ id: string }> }).knowledge_bases
  if (knowledgeBases && Array.isArray(knowledgeBases) && knowledgeBases.length > 0) {
    // 返回第一个知识库的 ID
    return knowledgeBases[0].id
  }

  return undefined
}

/**
 * VCP 上下文注入插件
 *
 * @param assistant - 当前助手配置
 * @param topicId - 当前话题 ID
 */
export const vcpContextPlugin = (assistant: Assistant, topicId: string) => {
  // 存储结构化的注入结果（带位置信息）
  let vcpInjections: InjectionResult[] = []
  let activeAgentId: string | null = null
  let showVCPSessionId: string | null = null

  // 用于调试日志
  const logContext = { assistantId: assistant.id, topicId }

  return definePlugin({
    name: 'vcp-context-injection',
    enforce: 'pre', // 确保在其他插件之前执行

    /**
     * 请求开始时：获取 VCP Agent 和执行上下文注入
     *
     * 架构融合逻辑:
     * 1. 检查 assistant.knowledge_bases 配置
     * 2. 检查 VCPAgent 配置
     * 3. 合并两者的知识库配置
     * 4. 执行日记声明检索
     */
    onRequestStart: async (context: AiRequestContext) => {
      try {
        // 重置注入列表
        vcpInjections = []

        // 1. 获取助手配置的知识库
        const assistantKnowledgeBases = (assistant as unknown as { knowledge_bases?: Array<{ id: string }> })
          .knowledge_bases
        const hasKnowledgeBases = assistantKnowledgeBases && assistantKnowledgeBases.length > 0

        // 2. 统一控制逻辑：选择了 MCP 服务器 或 启用了 VCP 配置 或 绑定了角色卡
        // 在统一模型中，助手本身就是 Agent（助手即智能体），使用助手 ID 作为 Agent ID
        // 兼容新旧字段：tools.mcpServers (新) 或 mcpServers (旧，已弃用)
        const mcpServers = assistant.tools?.mcpServers ?? assistant.mcpServers
        const hasMcpServers = (mcpServers?.length ?? 0) > 0
        const vcpConfigEnabled = assistant.vcpConfig?.enabled ?? false
        const hasCharacterCard = !!assistant.profile?.characterCardId  // 绑定了角色卡
        const toolsEnabled = hasMcpServers || vcpConfigEnabled || hasCharacterCard
        const vcpAgentId = toolsEnabled ? assistant.id : undefined
        let activeAgent: VCPAgentInfo | null = null

        // 如果工具未启用且没有知识库，直接返回
        if (!toolsEnabled && !hasKnowledgeBases) {
          logger.debug('Tools disabled for this assistant (no MCP servers, VCP not enabled, no character card) and no knowledge bases')
          return
        }

        // 只有在启用工具且配置了 Agent ID 时才加载 Agent
        if (toolsEnabled && vcpAgentId) {
          activeAgentId = vcpAgentId
          // 使用原生 window.api.vcpAgent API
          const agentResult = await window.api.vcpAgent.get({ id: vcpAgentId })
          activeAgent = agentResult?.agent ?? null

          if (activeAgent) {
            logger.debug('VCP Agent loaded', { ...logContext, agentName: activeAgent.name })

            // ShowVCP: 开始会话并记录 Agent 加载
            showVCPSessionId = await startShowVCPSession(vcpAgentId, activeAgent.name)
            if (showVCPSessionId) {
              const callId = await logVCPCallStart('context', 'agent_load', {
                agentId: vcpAgentId,
                agentName: activeAgent.name
              })
              await logVCPCallEnd(callId, { loaded: true })
            }
          } else {
            // 在统一模型中，助手启用VCP但没有对应的VCP Agent是正常情况
            // VCP功能仍可通过知识库、占位符等方式工作
            logger.debug('No VCP Agent registered for this assistant', { agentId: vcpAgentId })
          }
        }

        // 3. 如果没有加载到 VCPAgent、没有知识库配置、也没有角色卡，直接返回
        if (!activeAgent && !hasKnowledgeBases && !hasCharacterCard) {
          return
        }

        // 如果没有VCPAgent但有知识库，也启动ShowVCP会话
        if (!showVCPSessionId && hasKnowledgeBases) {
          showVCPSessionId = await startShowVCPSession(undefined, assistant.name)
        }

        // 4. 确定要使用的知识库ID
        const knowledgeBaseId = getKnowledgeBaseId(assistant, activeAgent)

        // 5. 确定要解析的系统提示词（VCPAgent优先，否则使用助手提示词）
        let systemPromptToSearch = activeAgent?.systemPrompt || assistant.prompt

        // 5.1 解析模板变量 ({{Tar*}}, {{Var*}}, {{Sar*}} 等)
        if (systemPromptToSearch && activeAgentId) {
          try {
            const userQuery = getLastUserMessage(context)

            // 构建模板变量上下文
            const templateContext = {
              target: {
                UserInput: userQuery,
                Query: userQuery
              },
              session: {
                SessionId: context.assistant?.id || '',
                TopicId: context.topic?.id || ''
              },
              custom: {} as Record<string, string>
            }

            // 调用模板变量解析 - 使用原生 API
            const resolvedPrompt = await window.api.vcpAgent.resolveTemplateVariables({
              text: systemPromptToSearch,
              agentId: activeAgentId,
              context: templateContext
            })

            if (resolvedPrompt && typeof resolvedPrompt === 'string') {
              systemPromptToSearch = resolvedPrompt
              logger.debug('Template variables resolved', {
                originalLength: (activeAgent?.systemPrompt || assistant.prompt)?.length,
                resolvedLength: resolvedPrompt.length
              })
            }
          } catch (error) {
            logger.warn('Failed to resolve template variables:', error as Error)
            // 继续使用原始提示词
          }
        }

        // 6. 执行日记检索（如果有系统提示词且有知识库配置）
        if (systemPromptToSearch && (knowledgeBaseId || hasKnowledgeBases)) {
          let diaryCallId: string | null = null
          try {
            const userQuery = getLastUserMessage(context)

            // ShowVCP: 记录日记搜索开始
            diaryCallId = await logVCPCallStart('diary_read', 'diary_search', {
              query: userQuery.substring(0, 100),
              knowledgeBaseId,
              hasVCPAgent: !!activeAgent
            })

            // 调用日记搜索 - 使用原生 API
            // VCPIpcHandler 中的 resolveKnowledgeBaseId 会处理名称到ID的映射
            const diarySearchResult = await window.api.vcpDiary.searchWithInjections({
              text: systemPromptToSearch,
              query: userQuery,
              knowledgeBaseId: knowledgeBaseId, // 可以是ID或名称，后端会自动解析
              topK: 5
            })

            // diarySearchResult 返回 { injections: string[], cleanedText: string }
            if (diarySearchResult && diarySearchResult.injections && diarySearchResult.injections.length > 0) {
              // 将日记搜索结果转换为 InjectionResult[]（默认位置为 system_prefix）
              const diaryInjections = convertToInjectionResults(diarySearchResult.injections, 'system_prefix')
              vcpInjections.push(...diaryInjections)

              logger.info('Diary search results injected:', {
                count: diarySearchResult.injections.length,
                query: userQuery.substring(0, 50),
                knowledgeBaseId
              })

              // ShowVCP: 记录日记搜索结果
              await logVCPCallEnd(diaryCallId, {
                resultCount: diarySearchResult.injections.length,
                totalLength: diarySearchResult.injections.join('').length
              })

              // 记录注入内容
              for (const injection of diarySearchResult.injections) {
                await logVCPInjection(injection, 'diary_search')
              }
            } else {
              logger.debug('No diary search results for query', { query: userQuery.substring(0, 50) })
              await logVCPCallEnd(diaryCallId, { resultCount: 0 })
            }
          } catch (err) {
            logger.error('Failed to execute diary search:', err as Error)
            await logVCPCallEnd(diaryCallId, undefined, (err as Error).message)
          }
        }

        // 7. 执行统一记忆搜索（如果配置了 memory 且启用）
        // 统一配置源：只使用 assistant.memory.*
        const memoryConfig = assistant.memory

        // 构建有效的记忆配置
        const effectiveMemoryConfig = {
          enabled: memoryConfig?.enableUnifiedSearch ?? false,
          backends: memoryConfig?.backends || ['diary', 'lightmemo', 'deepmemo', 'meshmemo'],
          topK: memoryConfig?.topK || 5,
          tagBoost: memoryConfig?.tagBoost || 0.5,
          useRRF: memoryConfig?.useRRF ?? true,
          diaryNameFilter: memoryConfig?.diaryNameFilter
        }

        if (effectiveMemoryConfig.enabled) {
          let memoryCallId: string | null = null
          try {
            const userQuery = getLastUserMessage(context)

            // ShowVCP: 记录统一记忆搜索开始
            memoryCallId = await logVCPCallStart('context', 'unified_memory_search', {
              backends: effectiveMemoryConfig.backends,
              tagBoost: effectiveMemoryConfig.tagBoost,
              useRRF: effectiveMemoryConfig.useRRF
            })

            // 调用统一记忆搜索 API (使用 integratedMemory)
            const memoryResponse = await window.api?.integratedMemory?.intelligentSearch?.({
              query: userQuery,
              options: {
                backends: effectiveMemoryConfig.backends as Array<'diary' | 'lightmemo' | 'deepmemo'>,
                topK: effectiveMemoryConfig.topK
              }
            })

            // 处理 IPC 响应格式: { success: true, results: [...] } 或直接数组
            const response = memoryResponse as MemorySearchResponse | MemorySearchResult[] | undefined
            const memoryResults: MemorySearchResult[] = Array.isArray(response)
              ? response
              : (response as MemorySearchResponse)?.results || []

            if (memoryResults && Array.isArray(memoryResults) && memoryResults.length > 0) {
              // 将记忆结果转换为注入格式
              const memoryInjections = memoryResults.map((result) => ({
                position: 'system_suffix' as InjectionPosition,
                content: `[Memory from ${result.backend || 'unknown'}] ${result.content}`,
                ruleId: `memory-${result.id}`,
                ruleName: `UnifiedMemory:${result.backend}`
              }))

              vcpInjections.push(...memoryInjections)

              logger.info('Unified memory search results injected:', {
                count: memoryResults.length,
                backends: [...new Set(memoryResults.map((r) => r.backend))]
              })

              // ShowVCP: 记录统一记忆搜索结果
              await logVCPCallEnd(memoryCallId, {
                resultCount: memoryResults.length,
                backends: [...new Set(memoryResults.map((r: any) => r.backend))]
              })

              // 记录注入内容
              for (const injection of memoryInjections) {
                await logVCPInjection(injection.content, 'unified_memory')
              }
            } else {
              logger.debug('No unified memory results for query', { query: userQuery.substring(0, 50) })
              await logVCPCallEnd(memoryCallId, { resultCount: 0 })
            }
          } catch (err) {
            logger.warn('Unified memory search failed:', err as Error)
            await logVCPCallEnd(memoryCallId, undefined, (err as Error).message)
            // 不阻断流程，继续执行
          }
        }

        // 8. 执行上下文注入规则（仅当有 VCPAgent 时）
        if (activeAgentId) {
          let contextCallId: string | null = null
          try {
            // ShowVCP: 记录上下文注入开始
            contextCallId = await logVCPCallStart('context', 'context_rules_execute', {
              agentId: activeAgentId
            })

            // vcp:context:execute 返回注入数组 - 使用原生 API
            const contextResults = await window.api.vcpInjector.executeContext({
              agentId: activeAgentId,
              turnCount: context.originalParams.messages?.length || 0,
              lastUserMessage: getLastUserMessage(context),
              lastAssistantMessage: getLastAssistantMessage(context),
              contextLength: JSON.stringify(context.originalParams.messages || []).length
            })

            // 转换为 InjectionResult 格式
            const contextInjections: InjectionResult[] = (contextResults || []).map((r, idx) => ({
              content: r.content,
              position: r.position as InjectionPosition,
              ruleId: `context-${idx}`,
              ruleName: r.source || 'ContextRule'
            }))

            if (contextInjections && Array.isArray(contextInjections) && contextInjections.length > 0) {
              // 直接保留位置信息
              vcpInjections.push(...contextInjections)

              logger.debug('Context injections with positions', {
                count: contextInjections.length,
                positions: contextInjections.map((i) => i.position)
              })

              // ShowVCP: 记录上下文注入结果
              await logVCPCallEnd(contextCallId, { ruleCount: contextInjections.length })

              // 记录每个注入
              for (const injection of contextInjections) {
                await logVCPInjection(injection.content, `context_rule:${injection.position}`)
              }
            } else {
              await logVCPCallEnd(contextCallId, { ruleCount: 0 })
            }
          } catch (err) {
            logger.error('Failed to execute context injections:', err as Error)
            await logVCPCallEnd(contextCallId, undefined, (err as Error).message)
          }
        }

        // 9. Tavern 角色卡系统提示词和 WorldBook 匹配
        try {
          // 优先使用助手绑定的角色卡，其次使用全局激活的角色卡
          // 定义 API 返回类型
          type TavernCardResult = { success: boolean; data?: TavernCard; error?: string }
          let cardResult: TavernCardResult | null = null
          const boundCharacterCardId = assistant.profile?.characterCardId

          if (boundCharacterCardId) {
            // 使用助手绑定的角色卡
            cardResult = (await window.api.tavern.getCard(boundCharacterCardId)) as TavernCardResult
            if (cardResult?.success) {
              logger.debug('Using assistant-bound character card', {
                assistantId: assistant.id,
                characterCardId: boundCharacterCardId
              })
            } else {
              logger.warn('Bound character card not found, falling back to global active card', {
                characterCardId: boundCharacterCardId
              })
              // 绑定的卡不存在，回退到全局激活卡
              cardResult = (await window.api.tavern.getActiveCard()) as TavernCardResult
            }
          } else {
            // 使用全局激活的角色卡
            cardResult = (await window.api.tavern.getActiveCard()) as TavernCardResult
          }

          if (cardResult?.success && cardResult?.data) {
            const card = cardResult.data as TavernCard
            logger.debug('Tavern character card loaded', {
              name: card.name,
              id: card.id,
              source: boundCharacterCardId ? 'assistant-bound' : 'global-active'
            })

            // 9.1 注入角色卡系统提示词（description, personality, scenario, system_prompt）
            const characterParts: string[] = []

            if (card.data?.description) {
              characterParts.push(`[Character Description]\n${card.data.description}`)
            }
            if (card.data?.personality) {
              characterParts.push(`[Personality]\n${card.data.personality}`)
            }
            if (card.data?.scenario) {
              characterParts.push(`[Scenario]\n${card.data.scenario}`)
            }
            if (card.data?.system_prompt) {
              characterParts.push(`[Character Instructions]\n${card.data.system_prompt}`)
            }

            if (characterParts.length > 0) {
              const characterInjection: InjectionResult = {
                position: 'system_prefix',
                content: `[Active Character: ${card.name}]\n\n${characterParts.join('\n\n')}`,
                ruleId: `tavern-char-${card.id}`,
                ruleName: `TavernCharacter:${card.name}`
              }
              vcpInjections.push(characterInjection)
              await logVCPInjection(characterInjection.content, `tavern_character:${card.name}`)
            }

            // 9.2 注入 post_history_instructions（如果有）
            if (card.data?.post_history_instructions) {
              const postHistoryInjection: InjectionResult = {
                position: 'context_suffix',
                content: `[Post-History Instructions]\n${card.data.post_history_instructions}`,
                ruleId: `tavern-post-${card.id}`,
                ruleName: `TavernPostHistory:${card.name}`
              }
              vcpInjections.push(postHistoryInjection)
            }

            // 9.3 WorldBook 匹配

            // ShowVCP: 记录 Tavern 角色卡加载
            const tavernCallId = await logVCPCallStart('context', 'tavern_worldbook', {
              characterName: card.name,
              hasWorldBook: !!card.data?.character_book
            })

            // 构建匹配文本：包含用户消息和最近对话上下文
            const userQuery = getLastUserMessage(context)
            const assistantMsg = getLastAssistantMessage(context)
            const matchText = [userQuery, assistantMsg].filter(Boolean).join('\n')

            if (matchText && card.data?.character_book) {
              // 调用 WorldBook 匹配 - 使用原生 API
              const matchResult = await window.api.tavern.matchWorldBook(matchText, card.id)

              if (matchResult?.success && matchResult?.data && matchResult.data.length > 0) {
                const matches = matchResult.data

                // 将 WorldBook 匹配结果转换为注入
                for (const match of matches) {
                  // WorldBook 条目使用默认 system_suffix 位置
                  const injectionPosition: InjectionPosition = 'system_suffix'

                  const injection: InjectionResult = {
                    position: injectionPosition,
                    content: `[WorldBook: ${match.entry?.keys?.join(', ') || 'matched'}]\n${match.entry?.content || ''}`,
                    ruleId: `tavern-wb-${match.entry?.id || 0}`,
                    ruleName: `WorldBook:${card.name}`
                  }
                  vcpInjections.push(injection)
                }

                logger.info('Tavern WorldBook matches injected', {
                  characterName: card.name,
                  matchCount: matches.length,
                  totalTokens: matches.reduce((sum: number, m) => sum + (m.entry?.content?.length || 0), 0)
                })

                // ShowVCP: 记录匹配结果
                await logVCPCallEnd(tavernCallId, {
                  matchCount: matches.length,
                  matchedKeys: matches.map((m) => m.entry?.keys?.[0]).filter(Boolean)
                })

                // 记录每个注入
                for (const match of matches) {
                  await logVCPInjection(match.entry?.content || '', `tavern_worldbook:${card.name}`)
                }
              } else {
                await logVCPCallEnd(tavernCallId, { matchCount: 0 })
              }
            } else {
              await logVCPCallEnd(tavernCallId, { matchCount: 0, reason: 'no_worldbook_or_text' })
            }
          }
        } catch (err) {
          logger.debug('Tavern WorldBook matching skipped', { error: (err as Error).message })
          // 不阻断流程，Tavern 模块可能未初始化
        }

        // 10. 记录准备完成
        if (vcpInjections.length > 0) {
          logger.info('VCP injections prepared:', {
            count: vcpInjections.length,
            positions: [...new Set(vcpInjections.map((i) => i.position))]
          })
        }
      } catch (error) {
        logger.error('VCP context injection failed:', error as Error)
        // 不抛出错误，让流程继续
      }
    },

    /**
     * 转换参数：将 VCP 上下文按位置注入到对应的消息段
     *
     * 支持的位置:
     * - system_prefix: 系统提示词开头
     * - system_suffix: 系统提示词结尾
     * - user_prefix: 用户消息前
     * - user_suffix: 用户消息后
     * - assistant_prefix: 助手消息前（用于引导响应）
     * - hidden: 隐藏注入（不显示但影响行为）
     *
     * 同时处理:
     * - {{VCP_ASYNC_RESULT::PluginName::TaskID}} 异步结果占位符替换
     * - {{VCPAllTools}}, {{VCPPluginName}} 等 VCP 工具占位符
     */
    transformParams: async (params: any, _context: AiRequestContext) => {
      // 0. VCP 工具注入策略（修复 token 膨胀问题）
      // 重要：不再自动注入所有工具描述到 system prompt
      // 原因：注入所有 50+ 工具的完整描述会导致 token 超过模型限制（如 100917 > 65536）
      //
      // 新策略：
      // - 当 vcpConfig.enabled=true 且没有 VCP 占位符时，自动注入工具目录和调用指南
      // - 使用精简的 {{VCPToolCatalog}} 代替完整的 {{VCPAllTools}}，大幅减少 token
      // - 用户可以通过 {{VCPAllTools}} 或 {{VCPServiceName}} 显式注入完整描述
      //
      const mcpServers = assistant.tools?.mcpServers ?? assistant.mcpServers
      const hasMcpServers = (mcpServers?.length ?? 0) > 0
      const vcpEnabled = assistant.vcpConfig?.enabled ?? false

      if (hasMcpServers) {
        logger.debug('MCP tools detected, will be handled by parameterBuilder', { count: mcpServers?.length })
      }

      // 0.1 VCP 自动工具注入：当 vcpConfig.enabled 但系统提示词中没有 VCP 工具占位符时
      if (vcpEnabled && params.system && typeof params.system === 'string') {
        // 检查是否有明确的工具相关占位符
        // - {{VCPAllTools}}, {{VCPToolCatalog}}, {{VCPTools}}, {{VCPGuide}} - 工具列表/指南
        const hasVCPToolPlaceholder = /\{\{VCP(AllTools|ToolCatalog|Tools|Guide)\}\}/.test(params.system)

        // 检查是否包含任何内置服务名称占位符（DailyNoteWrite, LightMemo 等）
        // 如果用户显式添加了这些，说明他们知道如何使用 VCP 工具
        const builtinServicePatterns = [
          'DailyNoteWrite', 'DailyNotePanel', 'TimelineGenerator',
          'LightMemo', 'DeepMemo', 'AIMemo', 'MemoryMaster',
          'VCPForum', 'VCPForumAssistant', 'MagiAgent', 'MetaThinking',
          'FileOperator', 'ModelSelector', 'AgentAssistant', 'WorkflowBridge',
          'ThoughtClusterManager', 'SemanticGroupEditor', 'QualityGuardian'
        ]
        const hasBuiltinServicePlaceholder = builtinServicePatterns.some(s =>
          params.system.includes(`{{VCP${s}}}`) || params.system.includes(`{{${s}}}`)
        )

        if (!hasVCPToolPlaceholder && !hasBuiltinServicePlaceholder) {
          // 自动注入工具目录和调用指南（使用精简版，约500 tokens）
          logger.info('VCP enabled but no VCP tool placeholders found, auto-injecting tool catalog')
          params.system = params.system + '\n\n{{VCPGuide}}\n\n{{VCPToolCatalog}}'
        }
      }

      // 1. 处理 VCP 占位符
      // 支持的占位符类型：
      // - {{VCP*}}: VCPAllTools, VCPPluginName, VCPDailyNoteWrite 等服务描述
      // - {{Var*}}: 用户自定义变量 (VarSystemInfo, VarUser 等)
      // - {{Tar*}}: 模板变量
      // - {{Sar*}}: 模型条件变量
      // - {{Date}}, {{Time}}, {{Today}}, {{Festival}}: 系统日期时间变量
      // - {{char}}, {{user}}: SillyTavern 兼容变量
      // - {{Agent:*}}: Agent 模板变量
      // - {{*日记本}}: 日记注入变量
      try {
        if (params.system && typeof params.system === 'string') {
          // 检查是否包含任何需要解析的占位符
          // 使用正则表达式匹配所有 {{...}} 格式的占位符
          const hasPlaceholders = /\{\{[^}]+\}\}/.test(params.system)
          if (hasPlaceholders) {
            logger.info('Found placeholders in system prompt, resolving...')
            // 使用原生 API，传递上下文参数以支持 Sar 模型条件变量
            const result = await window.api.vcpPlaceholder.resolve({
              text: params.system,
              context: {
                currentModelId: _context.assistant?.model?.id,
                role: 'system'
              }
            })
            logger.info('Placeholder resolve result:', {
              success: result?.success,
              changed: result?.result !== params.system,
              dataLength: result?.result?.length
            })
            if (result?.success && result.result !== params.system) {
              params.system = result.result
              logger.debug('Placeholders resolved in system prompt')
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to resolve placeholders', err as Error)
      }

      // 2. 处理异步结果占位符
      try {
        if (params.system && typeof params.system === 'string') {
          // 检查是否包含异步占位符
          if (params.system.includes('{{VCP_ASYNC_RESULT::')) {
            // 使用原生 API
            const replaced = await window.api.vcpPlaceholder.replacePlaceholders(params.system)
            if (replaced !== params.system) {
              params.system = replaced
              logger.debug('Async placeholders replaced in system prompt')
            }
          }
        }

        // 也检查消息中的异步占位符
        if (params.messages && Array.isArray(params.messages)) {
          for (let i = 0; i < params.messages.length; i++) {
            const msg = params.messages[i]
            if (typeof msg.content === 'string' && msg.content.includes('{{VCP_ASYNC_RESULT::')) {
              // 使用原生 API
              const replaced = await window.api.vcpPlaceholder.replacePlaceholders(msg.content)
              if (replaced !== msg.content) {
                params.messages[i] = { ...msg, content: replaced }
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to replace async placeholders', err as Error)
      }

      // 3. 应用 VCP 注入
      if (!vcpInjections || vcpInjections.length === 0) {
        return params
      }

      try {
        // 按位置分组
        const grouped = groupInjectionsByPosition(vcpInjections)

        // 1. 应用 system_prefix - 系统提示词开头
        if (grouped.system_prefix.length > 0) {
          const prefixContent = grouped.system_prefix.join('\n\n---\n\n')
          if (params.system) {
            params.system = `${prefixContent}\n\n---\n\n${params.system}`
          } else {
            params.system = prefixContent
          }
        }

        // 2. 应用 system_suffix - 系统提示词结尾
        if (grouped.system_suffix.length > 0) {
          const suffixContent = grouped.system_suffix.join('\n\n---\n\n')
          if (params.system) {
            params.system = `${params.system}\n\n---\n\n${suffixContent}`
          } else {
            params.system = suffixContent
          }
        }

        // 3. 应用 context_prefix/context_suffix（作为系统提示词的上下文部分）
        if (grouped.context_prefix.length > 0) {
          const contextPrefix = grouped.context_prefix.join('\n\n')
          params.system = params.system ? `${contextPrefix}\n\n---\n\n${params.system}` : contextPrefix
        }
        if (grouped.context_suffix.length > 0) {
          const contextSuffix = grouped.context_suffix.join('\n\n')
          params.system = params.system ? `${params.system}\n\n---\n\n${contextSuffix}` : contextSuffix
        }

        // 4. 应用 user_prefix/user_suffix - 用户消息前后
        if (params.messages && (grouped.user_prefix.length > 0 || grouped.user_suffix.length > 0)) {
          params.messages = applyMessageInjections(params.messages, grouped)
        }

        // 5. 应用 assistant_prefix - 作为 assistant 消息的开头引导
        if (grouped.assistant_prefix.length > 0 && params.messages) {
          const assistantGuide = grouped.assistant_prefix.join('\n')
          // 添加一个隐藏的 assistant 消息作为响应引导
          params.messages = [
            ...params.messages,
            {
              role: 'assistant',
              content: assistantGuide
            }
          ]
        }

        // 6. hidden 位置的内容也注入到 system（但标记为隐藏）
        if (grouped.hidden.length > 0) {
          const hiddenContent = `[隐藏指令]\n${grouped.hidden.join('\n')}\n[/隐藏指令]`
          params.system = params.system ? `${params.system}\n\n${hiddenContent}` : hiddenContent
        }

        logger.debug('VCP context injected by positions', {
          system_prefix: grouped.system_prefix.length,
          system_suffix: grouped.system_suffix.length,
          user_prefix: grouped.user_prefix.length,
          user_suffix: grouped.user_suffix.length,
          assistant_prefix: grouped.assistant_prefix.length,
          hidden: grouped.hidden.length
        })
      } catch (error) {
        logger.error('Failed to inject VCP context:', error as Error)
      }

      // 2.5 应用 Tavern 预设注入（消息层面的修改）
      try {
        if (params.messages && Array.isArray(params.messages)) {
          const activePreset = await window.api.tavern.getActivePreset()
          if (activePreset?.success && activePreset?.data) {
            // 准备消息格式（只传递 role 和 content）
            const simplifiedMessages = params.messages.map((m: any) => ({
              role: m.role as 'system' | 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }))

            const applyResult = await window.api.tavern.applyPreset(simplifiedMessages)
            if (applyResult?.success && applyResult?.data) {
              // 更新消息
              params.messages = applyResult.data
              logger.info('Tavern preset applied to messages', {
                presetId: (activePreset.data as any).id,
                presetName: (activePreset.data as any).name,
                originalCount: simplifiedMessages.length,
                resultCount: applyResult.data.length
              })
            }
          }
        }
      } catch (error) {
        logger.debug('Tavern preset application skipped', { error: (error as Error).message })
        // 不阻断流程
      }

      // 3. 应用上下文净化
      if (params.system && contextIntelligenceConfig.enablePurification) {
        try {
          params.system = await purifyContent(params.system, contextIntelligenceConfig.purifierConfig)
        } catch (error) {
          logger.warn('Context purification skipped due to error', error as Error)
        }
      }

      return params
    },

    /**
     * 请求结束时：处理日记写入等后处理逻辑
     *
     * 处理流程:
     * 1. 应用幻觉抑制（如果启用）
     * 2. 检测并执行日记写入请求
     * 3. 清理会话状态
     *
     * 注意：VCP TOOL_REQUEST 协议的解析和执行已统一由 VCPToolExecutorMiddleware 在流处理期间完成，
     * 本钩子不再重复处理工具请求。
     */
    onRequestEnd: async (context: AiRequestContext, result: any) => {
      logger.debug('[VCP-Plugin] onRequestEnd hook called')
      try {
        const responseText = extractResponseText(result)

        // 1. 应用幻觉抑制
        if (responseText && contextIntelligenceConfig.enableHallucinationSuppression) {
          try {
            // 提取对话历史用于上下文检查（安全序列化）
            const conversationHistory = context.originalParams.messages
              ?.filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => {
                try {
                  if (typeof m.content === 'string') {
                    return m.content
                  }
                  // 安全序列化，处理可能的循环引用或不可序列化对象
                  return JSON.stringify(m.content, (_, value) => {
                    if (typeof value === 'function' || typeof value === 'symbol') {
                      return undefined
                    }
                    return value
                  })
                } catch {
                  // 序列化失败时返回占位符
                  return '[complex content]'
                }
              })
              .filter(Boolean) // 过滤掉 undefined/null
              .slice(-10) // 最近10条

            const userQuery = getLastUserMessage(context)

            const suppressionResult = await suppressHallucination(
              responseText,
              {
                conversationHistory: conversationHistory || [],
                userQuery
              },
              contextIntelligenceConfig.suppressorConfig
            )

            if (suppressionResult.wasModified) {
              logger.info('Hallucination suppression applied', {
                confidence: suppressionResult.confidence,
                wasModified: suppressionResult.wasModified
              })

              // 尝试更新 result 对象
              try {
                if (result && typeof result === 'object') {
                  if (result.text !== undefined) {
                    result.text = suppressionResult.text
                  } else if (result.response?.text !== undefined) {
                    result.response.text = suppressionResult.text
                  }
                }
              } catch {
                // 忽略更新失败
              }
            }
          } catch (error) {
            logger.warn('Hallucination suppression skipped due to error', error as Error)
          }
        }

        // 2. 检测并执行日记写入
        if (activeAgentId) {
          const diaryRequest = shouldWriteDiary(context, result)
          if (diaryRequest.shouldWrite) {
            // ShowVCP: 记录日记写入
            const writeCallId = await logVCPCallStart('diary_write', 'diary_write', {
              contentLength: diaryRequest.content?.length || 0,
              tags: diaryRequest.tags
            })

            try {
              await triggerDiaryWrite(context, activeAgentId, diaryRequest)
              await logVCPCallEnd(writeCallId, { success: true })
            } catch (err) {
              await logVCPCallEnd(writeCallId, undefined, (err as Error).message)
            }
          }
        }
      } catch (error) {
        logger.error('Post-request processing failed:', error as Error)
      } finally {
        // ShowVCP: 结束会话
        if (showVCPSessionId) {
          await endShowVCPSession()
        }

        // 清理状态
        vcpInjections = []
        activeAgentId = null
        showVCPSessionId = null
      }
    }
  })
}

/**
 * 获取最后一条用户消息
 */
function getLastUserMessage(context: AiRequestContext): string {
  const messages = context.originalParams.messages
  if (!messages || messages.length === 0) return ''

  const lastUserMsg = messages.findLast((m: any) => m.role === 'user')
  if (!lastUserMsg) return ''

  if (typeof lastUserMsg.content === 'string') {
    return lastUserMsg.content
  }

  // 处理多模态消息
  if (Array.isArray(lastUserMsg.content)) {
    return lastUserMsg.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n')
  }

  return ''
}

/**
 * 获取最后一条助手消息
 */
function getLastAssistantMessage(context: AiRequestContext): string {
  const messages = context.originalParams.messages
  if (!messages || messages.length === 0) return ''

  const lastAssistantMsg = messages.findLast((m: any) => m.role === 'assistant')
  if (!lastAssistantMsg) return ''

  if (typeof lastAssistantMsg.content === 'string') {
    return lastAssistantMsg.content
  }

  return ''
}

/**
 * 日记写入请求的检测结果
 */
interface DiaryWriteRequest {
  shouldWrite: boolean
  content?: string
  tags?: string[]
  knowledgeBaseName?: string
}

// ==================== VCP 工具执行说明 ====================
//
// VCP 工具请求的解析和执行已统一由以下模块处理：
// - VCPProtocolParser: 解析 <<<[TOOL_REQUEST]>>> 协议
// - VCPToolExecutorMiddleware: 在流处理期间执行工具
//
// 本插件不再重复实现这些功能。
// onRequestEnd 钩子仅处理日记写入检测等后处理逻辑。
//

/**
 * 检测是否应该写入日记
 * 支持多种检测方式:
 * 1. AI 调用了 diary_write 工具
 * 2. AI 输出包含 VCP 风格的日记标记 <<<[DIARY_WRITE]>>>
 * 3. AI 输出包含中文日记标记 【日记写入】
 */
function shouldWriteDiary(_context: AiRequestContext, result: any): DiaryWriteRequest {
  const negative: DiaryWriteRequest = { shouldWrite: false }

  try {
    // 1. 检测 AI 是否调用了 diary_write 工具
    if (result?.toolCalls && Array.isArray(result.toolCalls)) {
      const diaryToolCall = result.toolCalls.find(
        (tc: any) => tc.name === 'diary_write' || tc.toolName === 'diary_write'
      )
      if (diaryToolCall) {
        const args = diaryToolCall.args || diaryToolCall.input || {}
        return {
          shouldWrite: true,
          content: args.content || args.entry,
          tags: args.tags || [],
          knowledgeBaseName: args.knowledgeBase || args.knowledgeBaseName
        }
      }
    }

    // 2. 检测响应文本中的 VCP 风格标记
    const responseText = extractResponseText(result)
    if (responseText) {
      // VCP 风格: <<<[DIARY_WRITE]>>>...<<<[/DIARY_WRITE]>>>
      const vcpMatch = responseText.match(/<<<\[DIARY_WRITE\]>>>([\s\S]*?)<<<\[\/DIARY_WRITE\]>>>/i)
      if (vcpMatch) {
        return {
          shouldWrite: true,
          content: vcpMatch[1].trim()
        }
      }

      // 中文标记: 【日记写入】...【/日记写入】
      const chineseMatch = responseText.match(/【日记写入】([\s\S]*?)【\/日记写入】/)
      if (chineseMatch) {
        return {
          shouldWrite: true,
          content: chineseMatch[1].trim()
        }
      }

      // 简单标记: [DIARY]...[/DIARY]
      const simpleMatch = responseText.match(/\[DIARY\]([\s\S]*?)\[\/DIARY\]/i)
      if (simpleMatch) {
        return {
          shouldWrite: true,
          content: simpleMatch[1].trim()
        }
      }
    }
  } catch (error) {
    logger.error('Error detecting diary write request:', error as Error)
  }

  return negative
}

/**
 * 从响应结果中提取文本内容
 */
function extractResponseText(result: any): string {
  if (!result) return ''

  // 直接文本
  if (typeof result === 'string') return result

  // AI SDK 标准响应 - 确保 text 是字符串
  if (result.text && typeof result.text === 'string') return result.text

  // 流式响应最终文本 - 确保是字符串
  if (result.response?.text && typeof result.response.text === 'string') {
    return result.response.text
  }

  // 检查 content 数组
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('\n')
  }

  // 检查 messages
  if (result.messages && Array.isArray(result.messages)) {
    const lastAssistant = result.messages.findLast((m: any) => m.role === 'assistant')
    if (lastAssistant && typeof lastAssistant.content === 'string') {
      return lastAssistant.content
    }
  }

  return ''
}

/**
 * 触发日记写入
 */
async function triggerDiaryWrite(
  context: AiRequestContext,
  agentId: string,
  diaryRequest: DiaryWriteRequest
): Promise<void> {
  try {
    // 优先使用 AI 请求中的内容，否则回退到对话内容
    let content = diaryRequest.content
    if (!content) {
      const lastUserMessage = getLastUserMessage(context)
      const lastAssistantMessage = getLastAssistantMessage(context)
      if (!lastUserMessage && !lastAssistantMessage) return
      content = `用户: ${lastUserMessage}\n\n助手: ${lastAssistantMessage}`
    }

    // 合并标签
    const tags = ['vcp-auto', ...(diaryRequest.tags || [])]

    await window.api.vcpDiary.write({
      characterName: agentId,
      content,
      tags,
      date: new Date().toISOString()
    })

    logger.info('Diary entry written for agent:', {
      agentId,
      contentLength: content.length,
      tags
    })
  } catch (error) {
    logger.error('Failed to write diary:', error as Error)
  }
}

export default vcpContextPlugin
