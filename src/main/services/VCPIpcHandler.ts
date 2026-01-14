/**
 * VCP 服务 IPC 处理器
 *
 * 注册 VCP Agent、变量、模板、上下文注入器的 IPC 通道
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import type { KnowledgeSearchResult } from '@types'
import { ipcMain } from 'electron'

import { getContextInjectorService, getVCPAgentService } from '../knowledge/agent'
import { diaryModeParser } from '../knowledge/modes/DiaryModeParser'
import type { KnowledgeBaseAccessor } from '../knowledge/modes/RetrievalStrategy'
import type { RetrievalConfig } from '../knowledge/modes/types'
import { vcpSearchService } from '../knowledge/vcp/VCPSearchService'
import { mcpBridge } from '../mcpServers/shared/MCPBridge'
import KnowledgeService from './KnowledgeService'
import { getIntegratedMemoryCoordinator } from './memory/IntegratedMemoryCoordinator'
import { getNoteService, type Note } from './notes'
import { getUnifiedAgentService, type AgentTask } from './UnifiedAgentService'

const logger = loggerService.withContext('VCPIpcHandler')

// ==================== 日记兼容类型 ====================

/**
 * 日记条目（兼容旧 API）
 */
interface DiaryEntry {
  id: string
  characterName: string
  date: string
  title?: string
  content: string
  tags: string[]
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Note 转 DiaryEntry
 */
function noteToEntry(note: Note, characterName?: string): DiaryEntry {
  return {
    id: note.id,
    characterName: characterName || note.frontmatter.characterName || 'default',
    date: note.frontmatter.date || note.createdAt.toISOString().split('T')[0],
    title: note.title,
    content: note.content,
    tags: note.frontmatter.tags || [],
    isPublic: note.frontmatter.isPublic || false,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  }
}

// 知识库名称缓存（名称 -> ID）
let knowledgeBaseCache: Map<string, string> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30000 // 30秒缓存

/**
 * 创建知识库访问器
 * 桥接 KnowledgeService 与 VCPSearchService
 */
function createKnowledgeBaseAccessor(kbId: string, _kbName: string): KnowledgeBaseAccessor {
  return {
    async getFullContent(_knowledgeBaseName: string): Promise<string> {
      // 获取全部内容（使用空查询搜索所有）
      const results = await KnowledgeService.search(null as any, {
        search: '',
        base: { id: kbId } as any
      })
      return results.map((r) => r.pageContent).join('\n\n')
    },

    async vectorSearch(
      _knowledgeBaseName: string,
      query: string,
      options?: { topK?: number; threshold?: number }
    ): Promise<KnowledgeSearchResult[]> {
      const results = await KnowledgeService.search(null as any, {
        search: query,
        base: { id: kbId } as any
      })

      let filtered = results.slice(0, options?.topK || 10)

      // 应用阈值过滤
      if (options?.threshold) {
        filtered = filtered.filter((r) => r.score >= options.threshold!)
      }

      return filtered
    },

    async getMetadata(_knowledgeBaseName: string) {
      // 返回基本元数据
      return {
        documentCount: 0,
        totalChunks: 0,
        lastUpdated: new Date()
      }
    },

    async computeRelevance(_knowledgeBaseName: string, query: string): Promise<number> {
      // 计算相关度：取前3个结果的平均分数
      const results = await KnowledgeService.search(null as any, {
        search: query,
        base: { id: kbId } as any
      })

      if (results.length === 0) return 0

      const topResults = results.slice(0, 3)
      return topResults.reduce((acc, r) => acc + r.score, 0) / topResults.length
    }
  }
}

/**
 * 解析知识库标识（名称或ID）为知识库ID
 *
 * VCP日记声明使用知识库名称，但检索需要知识库ID
 * 此函数实现名称到ID的自动映射
 *
 * @param nameOrId - 知识库名称或ID
 * @param providedId - 可选的直接提供的ID（优先使用）
 * @returns 知识库ID，如果找不到则返回null
 */
async function resolveKnowledgeBaseId(nameOrId: string, providedId?: string): Promise<string | null> {
  // 1. 优先使用直接提供的ID
  if (providedId) {
    logger.debug('Using provided knowledge base ID', { providedId })
    return providedId
  }

  if (!nameOrId) {
    return null
  }

  // 2. 检查是否是UUID格式（已经是ID）
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidPattern.test(nameOrId)) {
    logger.debug('Input is already a UUID', { nameOrId })
    return nameOrId
  }

  // 3. 尝试从缓存获取
  const now = Date.now()
  if (knowledgeBaseCache && now - cacheTimestamp < CACHE_TTL) {
    const cachedId = knowledgeBaseCache.get(nameOrId)
    if (cachedId) {
      logger.debug('Found knowledge base ID in cache', { name: nameOrId, id: cachedId })
      return cachedId
    }
  }

  // 4. 通过MCPBridge获取知识库列表并查找
  try {
    const bases = await mcpBridge.listKnowledgeBases()

    // 更新缓存
    knowledgeBaseCache = new Map()
    for (const base of bases) {
      knowledgeBaseCache.set(base.name, base.id)
      // 同时按ID缓存，方便后续快速验证
      knowledgeBaseCache.set(base.id, base.id)
    }
    cacheTimestamp = now

    // 查找匹配的知识库
    const found = bases.find((b) => b.name === nameOrId || b.id === nameOrId)
    if (found) {
      logger.info('Resolved knowledge base name to ID', { name: nameOrId, id: found.id })
      return found.id
    }

    logger.warn('Knowledge base not found', { nameOrId })
    return null
  } catch (error) {
    logger.error('Failed to resolve knowledge base ID', { nameOrId, error: String(error) })
    return null
  }
}

/**
 * 清除知识库缓存（当知识库列表变更时调用）
 */
export function invalidateKnowledgeBaseCache(): void {
  knowledgeBaseCache = null
  cacheTimestamp = 0
  logger.debug('Knowledge base cache invalidated')
}

import { safeHandle } from './ipc'

// ==================== 服务懒加载 ====================

let _agentService: ReturnType<typeof getVCPAgentService> | null = null
let _injectorService: ReturnType<typeof getContextInjectorService> | null = null

function getAgentService() {
  if (!_agentService) {
    _agentService = getVCPAgentService()
  }
  return _agentService
}

function getInjectorService() {
  if (!_injectorService) {
    _injectorService = getContextInjectorService()
  }
  return _injectorService
}

/**
 * 注册 VCP IPC 处理器
 */
export function registerVCPIpcHandlers(): void {
  logger.info('Registering VCP IPC handlers...')

  // ==================== Agent ====================

  ipcMain.handle(IpcChannel.VCP_Agent_List, async () => {
    return safeHandle('VCP_Agent_List', () => getAgentService().getAllAgents())
  })

  ipcMain.handle(IpcChannel.VCP_Agent_Get, async (_, args: { id?: string; name?: string }) => {
    if (args.id) {
      return getAgentService().getAgentById(args.id)
    } else if (args.name) {
      return getAgentService().getAgentByName(args.name)
    }
    return null
  })

  ipcMain.handle(
    IpcChannel.VCP_Agent_Create,
    async (
      _,
      args: {
        name: string
        systemPrompt: string
        category?: string
        description?: string
        variables?: Array<{ name: string; value: string; description?: string }>
        personality?: string
        background?: string
        greetingMessage?: string
        tags?: string[]
      }
    ) => {
      return getAgentService().createAgent({
        name: args.name,
        displayName: args.name,
        systemPrompt: args.systemPrompt,
        category: args.category,
        description: args.description || '',
        personality: args.personality || '',
        background: args.background || '',
        greetingMessage: args.greetingMessage,
        tags: args.tags || []
      })
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Agent_Update,
    async (
      _,
      args: {
        id: string
        name?: string
        systemPrompt?: string
        category?: string
        description?: string
        variables?: Array<{ name: string; value: string; description?: string }>
        personality?: string
        background?: string
        greetingMessage?: string
        tags?: string[]
      }
    ) => {
      const { id, ...updates } = args
      return getAgentService().updateAgent(id, updates)
    }
  )

  ipcMain.handle(IpcChannel.VCP_Agent_Delete, async (_, id: string) => {
    return getAgentService().deleteAgent(id)
  })

  ipcMain.handle(IpcChannel.VCP_Agent_Activate, async (_, id: string) => {
    return getAgentService().activateAgent(id)
  })

  ipcMain.handle(IpcChannel.VCP_Agent_Import, async (_, filePath: string) => {
    return getAgentService().importFromTxt(filePath)
  })

  ipcMain.handle(
    IpcChannel.VCP_Agent_ResolveTemplateVariables,
    async (
      _,
      args: {
        text: string
        agentId?: string
        context?: {
          target?: Record<string, string>
          session?: Record<string, string>
          custom?: Record<string, string>
          diary?: {
            allData?: string
            currentCharacter?: string
            entries?: string
          }
          knowledge?: Record<string, string>
        }
      }
    ) => {
      return safeHandle('VCP_Agent_ResolveTemplateVariables', () => {
        const service = getAgentService()
        // 如果提供了 agentId，获取 agent 特定的系统变量
        if (args.agentId) {
          return service.getAgentSystemPromptWithContext(args.agentId, args.context)
        }
        // 否则只解析传入的文本
        return service.resolveTemplateVariables(args.text, args.context)
      })
    }
  )

  // ==================== Agent 协作功能 ====================

  ipcMain.handle(
    IpcChannel.VCP_Agent_SendMessage,
    async (
      _,
      args: {
        fromAgentId: string
        toAgentId: string
        content: string
        metadata?: Record<string, unknown>
      }
    ) => {
      return safeHandle('VCP_Agent_SendMessage', () =>
        getUnifiedAgentService().sendMessage(args.fromAgentId, args.toAgentId, args.content, args.metadata)
      )
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Agent_DelegateTask,
    async (_, args: { fromAgentId: string; task: AgentTask }) => {
      return safeHandle('VCP_Agent_DelegateTask', () =>
        getUnifiedAgentService().delegateTask(args.fromAgentId, args.task)
      )
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Agent_CreateTask,
    async (
      _,
      args: {
        fromAgentId: string
        description: string
        options?: {
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          targetAgentId?: string
          type?: 'query' | 'action' | 'analyze' | 'summarize' | 'delegate'
          context?: string
        }
      }
    ) => {
      return safeHandle('VCP_Agent_CreateTask', () =>
        getUnifiedAgentService().createTask(args.fromAgentId, args.description, args.options || {})
      )
    }
  )

  ipcMain.handle(IpcChannel.VCP_Agent_GetPendingTasks, async (_, agentId: string) => {
    return safeHandle('VCP_Agent_GetPendingTasks', () => getUnifiedAgentService().getPendingTasks(agentId))
  })

  // ==================== Variable ====================
  // NOTE: Variable handlers moved to VCPVariableIpcHandler.ts
  // The dedicated handler provides more features including:
  // - TVStxt file management
  // - Variable resolution with model context
  // - Scope-based variable listing

  // ==================== Template ====================
  // NOTE: Template handlers moved to VCPTemplateIpcHandler.ts
  // The dedicated handler provides more features including:
  // - Category-based listing
  // - Template search
  // - Stats

  // ==================== Context Injector Rules ====================

  ipcMain.handle(IpcChannel.VCP_Injector_Rule_List, async () => {
    return getInjectorService().getAllRules()
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Create, async (_, args: any) => {
    return getInjectorService().createRule({
      name: args.name,
      description: args.description,
      position: args.position,
      content: args.content,
      priority: args.priority ?? 5,
      triggers: args.triggers || [{ type: 'always', value: true }],
      triggerLogic: args.triggerLogic || 'and',
      isActive: true,
      cooldown: args.cooldown,
      maxTriggers: args.maxTriggers,
      tags: args.tags || []
    })
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Update, async (_, args: { id: string; [key: string]: any }) => {
    const { id, ...updates } = args
    return getInjectorService().updateRule(id, updates)
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Delete, async (_, id: string) => {
    return getInjectorService().deleteRule(id)
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Toggle, async (_, args: { id: string; isActive: boolean }) => {
    return getInjectorService().updateRule(args.id, { isActive: args.isActive })
  })

  // ==================== Context Injector Presets ====================

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_List, async () => {
    return getInjectorService().getAllPresets()
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_Create, async (_, args: any) => {
    return getInjectorService().createPreset({
      name: args.name,
      description: args.description,
      rules: args.rules || [],
      isActive: false,
      targetAgents: args.targetAgents
    })
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_Activate, async (_, id: string) => {
    return getInjectorService().activatePreset(id)
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_Delete, async (_, id: string) => {
    return getInjectorService().deletePreset(id)
  })

  // 预设更新
  ipcMain.handle(
    IpcChannel.VCP_Injector_Preset_Update,
    async (
      _,
      args: {
        id: string
        name?: string
        description?: string
        rules?: any[]
        targetAgents?: string[]
      }
    ) => {
      return getInjectorService().updatePreset(args.id, {
        name: args.name,
        description: args.description,
        rules: args.rules,
        targetAgents: args.targetAgents
      })
    }
  )

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_CreateDirector, async () => {
    return getInjectorService().createDirectorPreset()
  })

  ipcMain.handle(IpcChannel.VCP_Injector_Preset_CreateRoleplay, async () => {
    return getInjectorService().createRoleplayEnhancementPreset()
  })

  // ==================== Execute Injection ====================

  ipcMain.handle(
    IpcChannel.VCP_Injector_Execute,
    async (
      _,
      args: {
        turnCount?: number
        lastUserMessage?: string
        lastAssistantMessage?: string
        contextLength?: number
        customData?: Record<string, any>
      }
    ) => {
      return getInjectorService().executeInjection({
        turnCount: args.turnCount ?? 1,
        lastUserMessage: args.lastUserMessage ?? '',
        lastAssistantMessage: args.lastAssistantMessage ?? '',
        contextLength: args.contextLength ?? 0,
        currentTime: new Date(),
        customData: args.customData
      })
    }
  )

  // ==================== Diary Mode Parser ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_ParseDeclarations,
    async (
      _,
      args: {
        text: string
        options?: {
          query?: string
          topK?: number
        }
      }
    ) => {
      try {
        const result = diaryModeParser.parse(args.text)
        // 返回解析结果，后续可以结合 VCPSearchService 执行实际检索
        return {
          declarations: result.declarations,
          cleanedText: result.cleanedText,
          configs: Array.from(result.configs.entries()).map(([kb, config]) => ({
            knowledgeBase: kb,
            config
          }))
        }
      } catch (error) {
        return { declarations: [], cleanedText: args.text, configs: [] }
      }
    }
  )

  // ==================== Diary Search (执行日记检索) ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Search,
    async (
      _,
      args: {
        text?: string // 包含日记声明的文本 (如系统提示词)
        query: string // 用户查询
        knowledgeBaseId?: string // 指定的知识库 ID
        topK?: number
        // 简单搜索参数
        characterName?: string
        tags?: string[]
        dateFrom?: string
        dateTo?: string
        limit?: number
      }
    ) => {
      try {
        logger.info('Executing diary search', { query: args.query.substring(0, 50) })

        // 如果没有 text 或没有日记声明，执行简单搜索
        const parseResult = args.text ? diaryModeParser.parse(args.text) : null

        if (!parseResult || parseResult.declarations.length === 0) {
          // 简单搜索模式：按角色、标签、日期过滤
          logger.debug('Executing simple diary search')
          const noteService = getNoteService()
          const allNotes = await noteService.listAll()

          // 过滤日记笔记
          let diaryNotes = allNotes.filter((note: Note) => note.filePath.includes('diary/'))

          // 按角色过滤
          if (args.characterName) {
            diaryNotes = diaryNotes.filter(
              (note) =>
                note.frontmatter.characterName === args.characterName ||
                note.filePath.includes(`diary/${args.characterName}/`)
            )
          }

          // 按标签过滤
          if (args.tags && args.tags.length > 0) {
            diaryNotes = diaryNotes.filter((note) => args.tags!.some((tag) => note.frontmatter.tags?.includes(tag)))
          }

          // 按日期过滤
          if (args.dateFrom || args.dateTo) {
            diaryNotes = diaryNotes.filter((note) => {
              const noteDate = note.frontmatter.date || note.filePath.match(/\d{4}-\d{2}-\d{2}/)?.[0]
              if (!noteDate) return true
              if (args.dateFrom && noteDate < args.dateFrom) return false
              if (args.dateTo && noteDate > args.dateTo) return false
              return true
            })
          }

          // 文本搜索
          const query = args.query.toLowerCase()
          const matchedNotes = diaryNotes.filter((note) => {
            const content = (note.content || '').toLowerCase()
            const title = (note.frontmatter.title || '').toLowerCase()
            const tags = (note.frontmatter.tags || []).join(' ').toLowerCase()
            return content.includes(query) || title.includes(query) || tags.includes(query)
          })

          // 简单评分：基于匹配位置和频率
          const scoredEntries = matchedNotes.map((note) => {
            const content = (note.content || '').toLowerCase()
            const firstMatch = content.indexOf(query)
            const matchCount = (content.match(new RegExp(query, 'gi')) || []).length
            // 评分：匹配越早越好，匹配越多越好
            const score = matchCount > 0 ? 0.5 + 0.3 * Math.min(matchCount / 5, 1) + 0.2 * (1 - firstMatch / content.length) : 0.3

            return {
              id: note.id,
              date: note.frontmatter.date || note.filePath.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '',
              title: note.frontmatter.title || note.filePath.split('/').pop()?.replace('.md', '') || '',
              content: note.content || '',
              tags: note.frontmatter.tags || [],
              score
            }
          })

          // 按分数排序并限制数量
          scoredEntries.sort((a, b) => b.score - a.score)
          const limit = args.limit || args.topK || 20
          const entries = scoredEntries.slice(0, limit)

          return {
            success: true,
            entries
          }
        }

        const injections: string[] = []

        // 2. 对每个声明执行检索
        for (const declaration of parseResult.declarations) {
          const config = parseResult.configs.get(declaration.knowledgeBaseName)
          if (!config) continue

          try {
            // 使用 resolveKnowledgeBaseId 解析知识库名称为ID
            // 支持: 直接ID、知识库名称、或调用者提供的ID
            const kbId = await resolveKnowledgeBaseId(declaration.knowledgeBaseName, args.knowledgeBaseId)

            if (!kbId) {
              logger.debug('Could not resolve knowledge base', {
                name: declaration.knowledgeBaseName,
                providedId: args.knowledgeBaseId
              })
              continue
            }

            // 创建知识库访问器
            const accessor = createKnowledgeBaseAccessor(kbId, declaration.knowledgeBaseName)

            // 3. 根据模式处理结果
            let injectionContent = ''

            // 检查是否启用 AIMemo
            if (config.aiMemo) {
              // 使用 IntegratedMemoryCoordinator 的 AI 驱动合成召回
              try {
                const coordinator = getIntegratedMemoryCoordinator()
                const synthesisResult = await coordinator.searchWithSynthesis(
                  args.query,
                  [declaration.knowledgeBaseName], // characterNames
                  {
                    maxResults: config.topK || args.topK || 10
                  }
                )

                if (synthesisResult.synthesizedMemory) {
                  injectionContent = `--- ${declaration.knowledgeBaseName} (AI 合成) ---\n${synthesisResult.synthesizedMemory}`
                  logger.debug('AIMemo synthesis completed', {
                    knowledgeBase: declaration.knowledgeBaseName,
                    fromCache: synthesisResult.fromCache,
                    rawResultCount: synthesisResult.rawResults.length
                  })
                }
              } catch (aiMemoError) {
                logger.error('AIMemo synthesis failed, falling back to standard search', {
                  error: String(aiMemoError)
                })
                // 失败时回退到标准搜索
                config.aiMemo = false
              }
            }

            // 如果没有使用 AIMemo 或 AIMemo 失败，使用标准搜索
            if (!config.aiMemo) {
              // 使用 VCPSearchService 执行增强搜索（应用修饰符）
              const vcpSearchResult = await vcpSearchService.search(accessor, args.query, {
                mode: config.mode,
                threshold: config.threshold,
                topK: config.topK || args.topK || 5,
                backend: config.backend, // 后端选择器 (::LightMemo, ::DeepMemo, ::MeshMemo)
                timeAware: config.timeAware,
                timeRange: config.timeRange as any,
                semanticGroups: config.semanticGroups as any,
                tagMemo: config.tagMemo,
                tagMemoThreshold: config.tagMemoThreshold,
                aiMemo: config.aiMemo
              })

              if (vcpSearchResult.results.length === 0) {
                logger.debug('No search results for', { knowledgeBase: declaration.knowledgeBaseName })
                continue
              }

              if (config.mode === 'fulltext' || config.mode === 'threshold_fulltext') {
                // 全文模式：使用 VCPSearchService 返回的结果
                injectionContent = vcpSearchResult.results.map((r) => r.pageContent).join('\n\n')
              } else {
                // RAG 模式：格式化片段
                injectionContent = formatRAGResults(declaration.knowledgeBaseName, vcpSearchResult.results, config)
              }

              // 检查阈值条件（VCPSearchService 已经处理了阈值过滤，但双重检查更安全）
              if (config.mode === 'threshold_fulltext' || config.mode === 'threshold_rag') {
                const avgScore = vcpSearchResult.results.slice(0, 3).reduce((acc, r) => acc + r.score, 0) / 3
                if (avgScore < (config.threshold || 0.5)) {
                  logger.debug('Threshold not met, skipping injection:', {
                    knowledgeBase: declaration.knowledgeBaseName,
                    avgScore,
                    threshold: config.threshold
                  })
                  continue
                }
              }

              logger.debug('Injection added with enhancements:', {
                knowledgeBase: declaration.knowledgeBaseName,
                enhancements: vcpSearchResult.metadata?.enhancementsApplied || [],
                resultCount: vcpSearchResult.results.length
              })
            }

            if (injectionContent) {
              injections.push(injectionContent)
            }
          } catch (searchError) {
            logger.error('Search failed for knowledge base', {
              knowledgeBase: declaration.knowledgeBaseName,
              error: String(searchError)
            })
          }
        }

        logger.info('Diary search completed', {
          declarationsCount: parseResult.declarations.length,
          injectionsCount: injections.length
        })

        return {
          injections,
          cleanedText: parseResult.cleanedText
        }
      } catch (error) {
        logger.error('Diary search failed', error as Error)
        return { injections: [], cleanedText: args.text }
      }
    }
  )

  // ==================== VCP Context Execute ====================

  // ==================== Diary Write/Read (直接 IPC 通道) ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_Write,
    async (
      _,
      args: {
        agentId?: string
        characterName?: string
        content: string
        title?: string
        tags?: string[]
        knowledgeBaseName?: string
        isPublic?: boolean
        timestamp?: string
      }
    ) => {
      try {
        const noteService = getNoteService()

        // 确定日记本名称：优先使用 characterName，否则用 agentId 或 knowledgeBaseName
        const characterName = args.characterName || args.knowledgeBaseName || args.agentId || 'default'

        // 生成文件路径
        const date = args.timestamp ? args.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]
        const safeTitle = (args.title || '日记').replace(/[<>:"/\\|?*]/g, '_')
        const fileName = `${date}-${safeTitle}.md`
        const relativePath = `diary/${characterName}/${fileName}`

        // 使用 NoteService 写入
        const note = await noteService.write(relativePath, args.content, {
          title: args.title || safeTitle,
          date,
          tags: args.tags || [],
          characterName,
          isPublic: args.isPublic ?? false,
          aiGenerated: false
        })

        logger.info('Diary entry written via NoteService', {
          entryId: note.id,
          characterName,
          contentLength: args.content.length
        })

        return {
          success: true,
          entryId: note.id,
          date: note.frontmatter.date
        }
      } catch (error) {
        logger.error('Failed to write diary via IPC:', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Diary_Read,
    async (
      _,
      args: {
        characterName?: string
        agentId?: string
        startDate?: string
        endDate?: string
        limit?: number
      }
    ) => {
      try {
        const noteService = getNoteService()
        const characterName = args.characterName || args.agentId
        const limit = args.limit || 10

        // 获取所有笔记
        const allNotes = await noteService.listAll()

        // 过滤日记笔记
        let diaryNotes = allNotes.filter((note) => note.filePath.startsWith('diary/'))

        // 按角色过滤
        if (characterName) {
          diaryNotes = diaryNotes.filter(
            (note) =>
              note.frontmatter.characterName === characterName || note.filePath.includes(`diary/${characterName}/`)
          )
        }

        // 按日期范围过滤
        if (args.startDate || args.endDate) {
          diaryNotes = diaryNotes.filter((note) => {
            const noteDate = note.frontmatter.date || note.createdAt.toISOString().split('T')[0]
            if (args.startDate && noteDate < args.startDate) return false
            if (args.endDate && noteDate > args.endDate) return false
            return true
          })
        }

        // 如果没有指定角色，返回概览
        if (!characterName && !args.startDate && !args.endDate) {
          // 按角色分组
          const characterMap = new Map<string, { count: number; latestDate: string }>()
          for (const note of diaryNotes) {
            const char = note.frontmatter.characterName || 'default'
            const date = note.frontmatter.date || note.createdAt.toISOString().split('T')[0]
            const existing = characterMap.get(char)
            if (!existing || date > existing.latestDate) {
              characterMap.set(char, {
                count: (existing?.count || 0) + 1,
                latestDate: date
              })
            } else {
              characterMap.set(char, { ...existing, count: existing.count + 1 })
            }
          }

          return {
            success: true,
            data: {
              characters: Array.from(characterMap.entries()).map(([name, data]) => ({
                name,
                diaryCount: data.count,
                latestEntry: data.latestDate
              })),
              totalEntries: diaryNotes.length,
              lastUpdated: new Date()
            }
          }
        }

        // 转换为 DiaryEntry 格式
        const entries: DiaryEntry[] = diaryNotes.map((note) => noteToEntry(note, characterName))

        // 按日期倒序排列并限制数量
        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        return {
          success: true,
          entries: entries.slice(0, limit).map((e) => ({
            id: e.id,
            date: e.date,
            title: e.title,
            content: e.content,
            tags: e.tags
          }))
        }
      } catch (error) {
        logger.error('Failed to read diary via IPC:', error as Error)
        return { success: false, error: String(error), entries: [] }
      }
    }
  )

  // ==================== Diary List/Stats/Delete/Edit ====================

  ipcMain.handle(
    IpcChannel.VCP_Diary_List,
    async (
      _,
      args: {
        characterName?: string
        includeContent?: boolean
      }
    ) => {
      try {
        const noteService = getNoteService()
        const allNotes = await noteService.listAll()

        // 过滤日记笔记：支持路径过滤 + frontmatter 属性过滤
        let diaryNotes = allNotes.filter((note) => {
          // 路径以 diary/ 开头
          if (note.filePath.startsWith('diary/')) return true
          // 有角色名
          if (note.frontmatter.characterName) return true
          // AI 生成的笔记
          if (note.frontmatter.aiGenerated) return true
          // 有日记日期
          if (note.frontmatter.date) return true
          return false
        })

        if (args.characterName) {
          diaryNotes = diaryNotes.filter(
            (note) =>
              note.frontmatter.characterName === args.characterName ||
              note.filePath.includes(`diary/${args.characterName}/`)
          )

          // 转换为条目格式
          const entries = diaryNotes.map((note) => ({
            id: note.id,
            date: note.frontmatter.date || note.createdAt.toISOString().split('T')[0],
            title: note.title,
            content: args.includeContent ? note.content : note.content.substring(0, 200),
            tags: note.frontmatter.tags || [],
            isPublic: note.frontmatter.isPublic || false,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
          }))

          return {
            success: true,
            books: [
              {
                id: args.characterName,
                name: args.characterName,
                entryCount: entries.length,
                isPublic: false,
                createdAt: entries[0]?.createdAt || new Date(),
                updatedAt: entries[0]?.updatedAt || new Date()
              }
            ],
            entries
          }
        }

        // 按角色分组返回概览
        const characterMap = new Map<string, { count: number; latestDate: string; latestNote: Note }>()
        for (const note of diaryNotes) {
          const char = note.frontmatter.characterName || 'default'
          const date = note.frontmatter.date || note.createdAt.toISOString().split('T')[0]
          const existing = characterMap.get(char)
          if (!existing || date > existing.latestDate) {
            characterMap.set(char, {
              count: (existing?.count || 0) + 1,
              latestDate: date,
              latestNote: note
            })
          } else {
            characterMap.set(char, { ...existing, count: existing.count + 1 })
          }
        }

        return {
          success: true,
          books: Array.from(characterMap.entries()).map(([name, data]) => ({
            name,
            entryCount: data.count,
            latestEntry: data.latestDate,
            summary: data.latestNote.content.substring(0, 100)
          })),
          totalEntries: diaryNotes.length
        }
      } catch (error) {
        logger.error('Failed to list diary via IPC:', error as Error)
        return { success: false, error: String(error), books: [] }
      }
    }
  )

  ipcMain.handle(IpcChannel.VCP_Diary_GetStats, async () => {
    try {
      const noteService = getNoteService()
      const allNotes = await noteService.listAll()

      // 过滤日记笔记：支持路径过滤 + frontmatter 属性过滤
      const diaryNotes = allNotes.filter((note) => {
        if (note.filePath.startsWith('diary/')) return true
        if (note.frontmatter.characterName) return true
        if (note.frontmatter.aiGenerated) return true
        if (note.frontmatter.date) return true
        return false
      })

      // 收集统计数据
      const characters = new Set<string>()
      const allTags = new Set<string>()
      let publicCount = 0

      for (const note of diaryNotes) {
        const char = note.frontmatter.characterName || 'default'
        characters.add(char)
        for (const tag of note.frontmatter.tags || []) {
          allTags.add(tag)
        }
        if (note.frontmatter.isPublic) {
          publicCount++
        }
      }

      return {
        success: true,
        stats: {
          bookCount: characters.size,
          entryCount: diaryNotes.length,
          publicEntryCount: publicCount,
          tagCount: allTags.size
        }
      }
    } catch (error) {
      logger.error('Failed to get diary stats via IPC:', error as Error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IpcChannel.VCP_Diary_Delete, async (_, args: { entryId: string }) => {
    try {
      const noteService = getNoteService()
      const allNotes = await noteService.listAll()

      // 查找匹配的笔记
      const note = allNotes.find((n) => n.id === args.entryId || n.filePath.includes(args.entryId))

      if (!note) {
        return { success: false, message: 'Entry not found' }
      }

      const success = await noteService.delete(note.filePath)
      return { success, message: success ? 'Entry deleted' : 'Delete failed' }
    } catch (error) {
      logger.error('Failed to delete diary entry via IPC:', error as Error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    IpcChannel.VCP_Diary_Edit,
    async (
      _,
      args: {
        entryId: string
        content?: string
        title?: string
        tags?: string[]
        isPublic?: boolean
      }
    ) => {
      try {
        const noteService = getNoteService()
        const allNotes = await noteService.listAll()

        // 查找匹配的笔记
        const note = allNotes.find((n) => n.id === args.entryId || n.filePath.includes(args.entryId))

        if (!note) {
          return { success: false, error: 'Entry not found' }
        }

        // 更新内容
        const newContent = args.content !== undefined ? args.content : note.content
        const newFrontmatter = {
          ...note.frontmatter,
          ...(args.title !== undefined && { title: args.title }),
          ...(args.tags !== undefined && { tags: args.tags }),
          ...(args.isPublic !== undefined && { isPublic: args.isPublic })
        }

        const updatedNote = await noteService.write(note.filePath, newContent, newFrontmatter)

        return {
          success: true,
          entry: {
            id: updatedNote.id,
            date: updatedNote.frontmatter.date,
            title: updatedNote.title,
            content: updatedNote.content,
            tags: updatedNote.frontmatter.tags || []
          }
        }
      } catch (error) {
        logger.error('Failed to edit diary entry via IPC:', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(IpcChannel.VCP_Diary_Summarize, async (_, args: { entryIds: string[] }) => {
    try {
      const noteService = getNoteService()

      // 查找匹配的笔记路径
      const allNotes = await noteService.listAll()
      const notePaths = allNotes
        .filter((n) => args.entryIds.includes(n.id) || args.entryIds.some((id) => n.filePath.includes(id)))
        .map((n) => n.filePath)

      if (notePaths.length === 0) {
        return { success: false, message: '未找到指定的日记条目' }
      }

      // 调用 NoteService 的 aiOrganize 方法执行摘要任务
      const result = await noteService.aiOrganize({
        type: 'summarize',
        notePaths
      })

      return result
    } catch (error) {
      logger.error('Failed to summarize diary entries via IPC:', error as Error)
      return { success: false, message: String(error) }
    }
  })

  // 日记同步到知识库 (准备数据，实际向量化由 renderer 完成)
  ipcMain.handle(
    IpcChannel.VCP_Diary_SyncToKnowledge,
    async (
      _,
      args: {
        entryIds?: string[]
        syncAll?: boolean
      }
    ) => {
      try {
        const noteService = getNoteService()
        const allNotes = await noteService.listAll()

        // 过滤日记笔记
        let diaryNotes = allNotes.filter((note) => note.filePath.startsWith('diary/'))

        // 获取要同步的日记条目
        let entriesToSync: Array<{
          id: string
          content: string
          characterName: string
          date: string
          title?: string
          tags: string[]
        }> = []

        if (args.syncAll) {
          // 同步所有公开的日记
          const publicNotes = diaryNotes.filter((n) => n.frontmatter.isPublic)
          entriesToSync = publicNotes.map((note) => ({
            id: note.id,
            content: note.content,
            characterName: note.frontmatter.characterName || 'default',
            date: note.frontmatter.date || note.createdAt.toISOString().split('T')[0],
            title: note.title,
            tags: note.frontmatter.tags || []
          }))
        } else if (args.entryIds && args.entryIds.length > 0) {
          // 同步指定的日记条目
          const matchedNotes = diaryNotes.filter(
            (n) => args.entryIds!.includes(n.id) || args.entryIds!.some((id) => n.filePath.includes(id))
          )
          entriesToSync = matchedNotes.map((note) => ({
            id: note.id,
            content: note.content,
            characterName: note.frontmatter.characterName || 'default',
            date: note.frontmatter.date || note.createdAt.toISOString().split('T')[0],
            title: note.title,
            tags: note.frontmatter.tags || []
          }))
        }

        if (entriesToSync.length === 0) {
          return { success: true, entries: [], message: '没有找到要同步的日记条目' }
        }

        // 格式化日记内容，准备好供 renderer 进程添加到知识库
        const formattedEntries = entriesToSync.map((entry) => {
          const formattedContent = [
            `# ${entry.title || entry.date}`,
            `角色: ${entry.characterName}`,
            `日期: ${entry.date}`,
            entry.tags.length > 0 ? `标签: ${entry.tags.join(', ')}` : '',
            '',
            entry.content
          ]
            .filter(Boolean)
            .join('\n')

          return {
            id: `diary_${entry.id}`,
            content: formattedContent,
            sourceUrl: `diary://${entry.characterName}/${entry.date}/${entry.id}`,
            metadata: {
              characterName: entry.characterName,
              date: entry.date,
              title: entry.title,
              tags: entry.tags
            }
          }
        })

        logger.info('Diary entries prepared for sync', {
          total: formattedEntries.length
        })

        return {
          success: true,
          entries: formattedEntries,
          message: `已准备 ${formattedEntries.length} 条日记待同步`
        }
      } catch (error) {
        logger.error('Failed to prepare diary entries for sync:', error as Error)
        return { success: false, entries: [], message: String(error) }
      }
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Context_Execute,
    async (
      _,
      args: {
        agentId: string
        turnCount?: number
        lastUserMessage?: string
        lastAssistantMessage?: string
        contextLength?: number
      }
    ) => {
      try {
        const agent = getAgentService().getAgentById(args.agentId)
        if (!agent) {
          return []
        }

        // 执行上下文注入规则，传入 agentId 用于 targetAgents 过滤
        const injections = await getInjectorService().executeInjection({
          turnCount: args.turnCount ?? 1,
          lastUserMessage: args.lastUserMessage ?? '',
          lastAssistantMessage: args.lastAssistantMessage ?? '',
          contextLength: args.contextLength ?? 0,
          currentTime: new Date(),
          agentId: args.agentId
        })

        return injections
      } catch (error) {
        return []
      }
    }
  )

  // ==================== VCP Enhanced Search ====================

  ipcMain.handle(
    IpcChannel.VCP_Search_Enhanced,
    async (
      _,
      args: {
        knowledgeBaseId: string
        query: string
        mode?: 'rag' | 'fulltext' | 'threshold_rag' | 'threshold_fulltext'
        modifiers?: {
          time?: boolean
          group?: boolean
          tagMemo?: number
          topK?: number
          threshold?: number
        }
      }
    ) => {
      try {
        // 获取知识库配置
        const knowledgeBases = await mcpBridge.listKnowledgeBases()
        const knowledgeBase = knowledgeBases.find((kb: { id: string }) => kb.id === args.knowledgeBaseId)

        if (!knowledgeBase) {
          logger.warn('Knowledge base not found for enhanced search', { id: args.knowledgeBaseId })
          return { success: false, items: [], message: 'Knowledge base not found' }
        }

        // 确定检索模式和参数
        const mode = args.mode || 'rag'
        const topK = args.modifiers?.topK || 5
        const threshold = args.modifiers?.threshold || 0.5

        // 创建知识库访问器
        const accessor = createKnowledgeBaseAccessor(args.knowledgeBaseId, knowledgeBase.name)

        // 使用 VCPSearchService 执行增强搜索（应用所有修饰符）
        const vcpSearchResult = await vcpSearchService.search(accessor, args.query, {
          mode: mode as any,
          threshold: threshold,
          topK: topK,
          timeAware: args.modifiers?.time,
          // 如果启用 group 修饰符，使用默认的语义组（时尚领域常用组）
          semanticGroups: args.modifiers?.group ? ['color', 'pattern', 'silhouette', 'style'] : undefined,
          tagMemo: args.modifiers?.tagMemo ? true : false,
          tagMemoThreshold: args.modifiers?.tagMemo || 0.5
        })

        // 转换结果格式
        const items = vcpSearchResult.results.map((r) => ({
          content: r.pageContent,
          score: r.score,
          metadata: r.metadata
        }))

        logger.debug('VCP enhanced search completed', {
          knowledgeBaseId: args.knowledgeBaseId,
          mode,
          resultCount: items.length,
          enhancementsApplied: vcpSearchResult.metadata?.enhancementsApplied || []
        })

        return { success: true, items }
      } catch (error) {
        logger.error('VCP enhanced search failed:', error as Error)
        return { success: false, items: [], message: String(error) }
      }
    }
  )

  ipcMain.handle(IpcChannel.VCP_Knowledge_List, async () => {
    try {
      const bases = await mcpBridge.listKnowledgeBases()
      return {
        success: true,
        bases: bases.map((b: { id: string; name: string; description?: string }) => ({
          id: b.id,
          name: b.name,
          description: b.description
        }))
      }
    } catch (error) {
      logger.error('Failed to list knowledge bases:', error as Error)
      return { success: false, bases: [], message: String(error) }
    }
  })

  // ==================== ShowVCP Debug ====================

  ipcMain.handle(IpcChannel.ShowVCP_Enable, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    service.setGlobalEnabled(true)
    return { success: true }
  })

  ipcMain.handle(IpcChannel.ShowVCP_Disable, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    service.setGlobalEnabled(false)
    return { success: true }
  })

  ipcMain.handle(IpcChannel.ShowVCP_GetConfig, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    return service.getConfig()
  })

  ipcMain.handle(
    IpcChannel.ShowVCP_UpdateConfig,
    async (
      _,
      config: {
        enabled?: boolean
        showTimestamp?: boolean
        showDuration?: boolean
        showArgs?: boolean
        showResult?: boolean
        maxHistorySessions?: number
        formatStyle?: 'compact' | 'detailed' | 'markdown'
      }
    ) => {
      const { getShowVCPService } = await import('./vcp/ShowVCPService')
      const service = getShowVCPService()
      service.updateConfig(config)
      return { success: true }
    }
  )

  ipcMain.handle(IpcChannel.ShowVCP_GetCurrentSession, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    const session = service.getCurrentSession()
    return session
      ? {
          ...session,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime?.toISOString(),
          calls: session.calls.map((c) => ({
            ...c,
            timestamp: c.timestamp.toISOString()
          }))
        }
      : null
  })

  ipcMain.handle(IpcChannel.ShowVCP_GetHistory, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    const history = service.getSessionHistory()
    return history.map((session) => ({
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      calls: session.calls.map((c) => ({
        ...c,
        timestamp: c.timestamp.toISOString()
      }))
    }))
  })

  ipcMain.handle(IpcChannel.ShowVCP_ClearHistory, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    service.clearHistory()
    return { success: true }
  })

  ipcMain.handle(IpcChannel.ShowVCP_FormatSession, async (_, sessionId?: string) => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()

    if (!sessionId) {
      return service.formatCurrentSession()
    }

    const history = service.getSessionHistory()
    const session = history.find((s) => s.id === sessionId)
    return session ? service.formatSession(session) : '[ShowVCP] 会话不存在'
  })

  // ShowVCP Session & Call Tracking (for vcpContextPlugin integration)
  ipcMain.handle(IpcChannel.ShowVCP_StartSession, async (_, args: { agentId?: string; agentName?: string }) => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    const sessionId = service.startSession(args.agentId, args.agentName)
    return { sessionId }
  })

  ipcMain.handle(IpcChannel.ShowVCP_EndSession, async () => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    const session = service.endSession()
    return session
      ? {
          ...session,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime?.toISOString(),
          calls: session.calls.map((c) => ({
            ...c,
            timestamp: c.timestamp.toISOString()
          }))
        }
      : null
  })

  ipcMain.handle(
    IpcChannel.ShowVCP_LogCallStart,
    async (
      _,
      args: {
        type: 'injection' | 'tool_call' | 'diary_read' | 'diary_write' | 'context' | 'variable'
        name: string
        callArgs?: Record<string, unknown>
        metadata?: Record<string, unknown>
      }
    ) => {
      const { getShowVCPService } = await import('./vcp/ShowVCPService')
      const service = getShowVCPService()
      const callId = service.logCallStart(args.type, args.name, args.callArgs, args.metadata)
      return { callId }
    }
  )

  ipcMain.handle(
    IpcChannel.ShowVCP_LogCallEnd,
    async (_, args: { callId: string; result?: unknown; error?: string }) => {
      const { getShowVCPService } = await import('./vcp/ShowVCPService')
      const service = getShowVCPService()
      service.logCallEnd(args.callId, args.result, args.error)
      return { success: true }
    }
  )

  ipcMain.handle(IpcChannel.ShowVCP_LogInjection, async (_, args: { content: string; source?: string }) => {
    const { getShowVCPService } = await import('./vcp/ShowVCPService')
    const service = getShowVCPService()
    service.logInjection(args.content, args.source)
    return { success: true }
  })

  // ==================== Agent Collaboration ====================

  ipcMain.handle(
    IpcChannel.AgentCollab_RegisterCapability,
    async (
      _,
      capability: {
        agentId: string
        agentName: string
        specialties: string[]
        skills: string[]
        availability?: 'available' | 'busy' | 'offline'
        loadFactor?: number
        successRate?: number
      }
    ) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      service.registerAgentCapability({
        ...capability,
        availability: capability.availability ?? 'available',
        loadFactor: capability.loadFactor ?? 0,
        successRate: capability.successRate ?? 0.8
      })
      return { success: true }
    }
  )

  ipcMain.handle(IpcChannel.AgentCollab_GetAvailableAgents, async (_, specialty?: string) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    return service.getAvailableAgents(specialty)
  })

  ipcMain.handle(IpcChannel.AgentCollab_FindBestAgent, async (_, requiredSkills: string[]) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    return service.findBestAgentForTask(requiredSkills)
  })

  ipcMain.handle(
    IpcChannel.AgentCollab_SendMessage,
    async (
      _,
      message: {
        type: 'request' | 'response' | 'broadcast' | 'knowledge_share'
        fromAgentId: string
        toAgentId?: string
        content: string
        metadata?: Record<string, unknown>
        priority?: 'low' | 'normal' | 'high' | 'urgent'
      }
    ) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      const sent = service.sendMessage(message)
      return { success: true, messageId: sent.id }
    }
  )

  ipcMain.handle(IpcChannel.AgentCollab_GetMessages, async (_, args: { agentId: string; limit?: number }) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    const messages = service.getMessagesForAgent(args.agentId, args.limit)
    return messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
      expiresAt: m.expiresAt?.toISOString()
    }))
  })

  ipcMain.handle(
    IpcChannel.AgentCollab_CreateTask,
    async (
      _,
      task: {
        title: string
        description: string
        creatorAgentId: string
        priority?: 'low' | 'normal' | 'high' | 'urgent'
        dependencies?: string[]
      }
    ) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      const created = service.createTask({
        ...task,
        priority: task.priority ?? 'normal'
      })
      return {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString()
      }
    }
  )

  ipcMain.handle(IpcChannel.AgentCollab_AssignTask, async (_, args: { taskId: string; agentId: string }) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    try {
      const task = service.assignTask(args.taskId, args.agentId)
      return {
        success: true,
        task: {
          ...task,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    IpcChannel.AgentCollab_UpdateTaskStatus,
    async (_, args: { taskId: string; status: string; result?: unknown }) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      try {
        const task = service.updateTaskStatus(
          args.taskId,
          args.status as 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed',
          args.result
        )
        return { success: true, task }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(IpcChannel.AgentCollab_GetTasks, async (_, agentId: string) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    const tasks = service.getTasksForAgent(agentId)
    return tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString()
    }))
  })

  ipcMain.handle(
    IpcChannel.AgentCollab_ShareKnowledge,
    async (
      _,
      entry: {
        sourceAgentId: string
        title: string
        content: string
        category: string
        tags: string[]
      }
    ) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      const shared = service.shareKnowledge(entry)
      return {
        ...shared,
        createdAt: shared.createdAt.toISOString(),
        updatedAt: shared.updatedAt.toISOString()
      }
    }
  )

  ipcMain.handle(
    IpcChannel.AgentCollab_SearchKnowledge,
    async (_, args: { query: string; category?: string; tags?: string[] }) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      const results = service.searchKnowledge(args.query, args.category, args.tags)
      return results.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }))
    }
  )

  ipcMain.handle(
    IpcChannel.AgentCollab_CreateVoting,
    async (
      _,
      session: {
        topic: string
        description: string
        options: Array<{ id: string; label: string; description?: string }>
        initiatorAgentId: string
        participantAgentIds: string[]
        deadline: string
      }
    ) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      const created = service.createVotingSession({
        ...session,
        deadline: new Date(session.deadline)
      })
      return {
        ...created,
        votes: Object.fromEntries(created.votes),
        deadline: created.deadline.toISOString(),
        createdAt: created.createdAt.toISOString()
      }
    }
  )

  ipcMain.handle(
    IpcChannel.AgentCollab_SubmitVote,
    async (_, args: { sessionId: string; agentId: string; optionId: string }) => {
      const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
      const service = getAgentCollaborationService()
      try {
        service.submitVote(args.sessionId, args.agentId, args.optionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(IpcChannel.AgentCollab_CloseVoting, async (_, sessionId: string) => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    try {
      const result = service.closeVotingSession(sessionId)
      return {
        success: true,
        result: {
          ...result,
          breakdown: Object.fromEntries(result.breakdown)
        }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IpcChannel.AgentCollab_GetStats, async () => {
    const { getAgentCollaborationService } = await import('../knowledge/agent/AgentCollaborationService')
    const service = getAgentCollaborationService()
    return service.getStats()
  })

  // ==================== Behavior Control ====================

  ipcMain.handle(IpcChannel.BehaviorCtrl_GetConfig, async () => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.getConfig()
  })

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_UpdateConfig,
    async (
      _,
      config: {
        enableModelAdaptation?: boolean
        enableDetectorX?: boolean
        enableSuperDetectorX?: boolean
        enablePhraseSuppress?: boolean
        defaultPhraseMaxOccurrences?: number
      }
    ) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      service.updateConfig(config)
      return { success: true }
    }
  )

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_AddModelAdaptation,
    async (
      _,
      rule: {
        name: string
        modelPattern: string
        instruction: string
        position: 'prefix' | 'suffix' | 'replace'
        priority?: number
        isActive?: boolean
      }
    ) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      const added = service.addModelAdaptation({
        ...rule,
        priority: rule.priority ?? 5,
        isActive: rule.isActive ?? true
      })
      return {
        ...added,
        createdAt: added.createdAt.toISOString(),
        updatedAt: added.updatedAt.toISOString()
      }
    }
  )

  ipcMain.handle(IpcChannel.BehaviorCtrl_GetModelAdaptations, async () => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.getAllModelAdaptations().map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }))
  })

  ipcMain.handle(IpcChannel.BehaviorCtrl_DeleteModelAdaptation, async (_, id: string) => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return { success: service.deleteModelAdaptation(id) }
  })

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_AddDetectorXRule,
    async (
      _,
      rule: {
        name: string
        description?: string
        pattern: string
        replacement: string
        flags?: string
        priority?: number
        isActive?: boolean
      }
    ) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      const added = service.addDetectorXRule({
        ...rule,
        priority: rule.priority ?? 5,
        isActive: rule.isActive ?? true
      })
      return {
        ...added,
        createdAt: added.createdAt.toISOString(),
        updatedAt: added.updatedAt.toISOString()
      }
    }
  )

  ipcMain.handle(IpcChannel.BehaviorCtrl_GetDetectorXRules, async () => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.getAllDetectorXRules().map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      statistics: {
        ...r.statistics,
        lastMatchAt: r.statistics.lastMatchAt?.toISOString()
      }
    }))
  })

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_AddSuperDetectorXRule,
    async (
      _,
      rule: {
        name: string
        description?: string
        pattern: string
        action: 'remove' | 'replace' | 'warn' | 'block'
        replacement?: string
        warningMessage?: string
        priority?: number
        isActive?: boolean
      }
    ) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      const added = service.addSuperDetectorXRule({
        ...rule,
        priority: rule.priority ?? 5,
        isActive: rule.isActive ?? true
      })
      return {
        ...added,
        createdAt: added.createdAt.toISOString(),
        updatedAt: added.updatedAt.toISOString()
      }
    }
  )

  ipcMain.handle(IpcChannel.BehaviorCtrl_GetSuperDetectorXRules, async () => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.getAllSuperDetectorXRules().map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      statistics: {
        ...r.statistics,
        lastMatchAt: r.statistics.lastMatchAt?.toISOString()
      }
    }))
  })

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_AddPhraseSuppression,
    async (
      _,
      rule: {
        phrase: string
        alternatives?: string[]
        maxOccurrences?: number
        action: 'remove' | 'replace' | 'limit'
        isActive?: boolean
      }
    ) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      const added = service.addPhraseSuppression({
        ...rule,
        maxOccurrences: rule.maxOccurrences ?? 2,
        isActive: rule.isActive ?? true
      })
      return {
        ...added,
        createdAt: added.createdAt.toISOString()
      }
    }
  )

  ipcMain.handle(IpcChannel.BehaviorCtrl_GetPhraseSuppressions, async () => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.getAllPhraseSuppressions().map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      statistics: {
        ...r.statistics,
        lastSuppressedAt: r.statistics.lastSuppressedAt?.toISOString()
      }
    }))
  })

  ipcMain.handle(
    IpcChannel.BehaviorCtrl_ProcessSystemPrompt,
    async (_, args: { systemPrompt: string; modelId: string }) => {
      const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
      const service = getBehaviorControlService()
      return service.processSystemPrompt(args.systemPrompt, args.modelId)
    }
  )

  ipcMain.handle(IpcChannel.BehaviorCtrl_ProcessAIOutput, async (_, output: string) => {
    const { getBehaviorControlService } = await import('../knowledge/agent/BehaviorControlService')
    const service = getBehaviorControlService()
    return service.processAIOutput(output)
  })

  // ==================== VCP Async Results ====================

  ipcMain.handle(
    IpcChannel.VCP_Async_CreateTask,
    async (
      _,
      args: {
        pluginName: string
        taskId: string
        metadata?: Record<string, unknown>
        ttl?: number
      }
    ) => {
      const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
      const service = getVCPAsyncResultsService()
      return service.createTask(args)
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Async_StoreResult,
    async (
      _,
      args: {
        pluginName: string
        taskId: string
        result: string
        metadata?: Record<string, unknown>
      }
    ) => {
      const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
      const service = getVCPAsyncResultsService()
      return service.storeResult(args)
    }
  )

  ipcMain.handle(
    IpcChannel.VCP_Async_StoreError,
    async (
      _,
      args: {
        pluginName: string
        taskId: string
        error: string
        metadata?: Record<string, unknown>
      }
    ) => {
      const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
      const service = getVCPAsyncResultsService()
      return service.storeError(args)
    }
  )

  ipcMain.handle(IpcChannel.VCP_Async_GetResult, async (_, args: { pluginName: string; taskId: string }) => {
    const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
    const service = getVCPAsyncResultsService()
    return service.getResult(args.pluginName, args.taskId)
  })

  ipcMain.handle(IpcChannel.VCP_Async_DeleteResult, async (_, args: { pluginName: string; taskId: string }) => {
    const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
    const service = getVCPAsyncResultsService()
    return service.deleteResult(args.pluginName, args.taskId)
  })

  ipcMain.handle(IpcChannel.VCP_Async_ReplacePlaceholders, async (_, text: string) => {
    const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
    const service = getVCPAsyncResultsService()
    return service.replaceAsyncPlaceholders(text)
  })

  ipcMain.handle(IpcChannel.VCP_Async_GetAllResults, async () => {
    const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
    const service = getVCPAsyncResultsService()
    return service.getAllResults()
  })

  ipcMain.handle(IpcChannel.VCP_Async_CleanupExpired, async () => {
    const { getVCPAsyncResultsService } = await import('./vcp/VCPAsyncResultsService')
    const service = getVCPAsyncResultsService()
    return service.cleanupExpired()
  })

  // ==================== VCP Unified Placeholder Resolution (统一占位符解析) ====================

  /**
   * 完整占位符解析 - 包含所有 VCP 占位符类型
   * 用于需要完整 VCP 功能的场景（日记、RAG、阈值、Tar/Var 等）
   */
  ipcMain.handle(
    IpcChannel.VCP_Placeholder_Resolve,
    async (
      _,
      // 支持两种调用格式:
      // 1. 简单字符串: resolve(text)
      // 2. 对象格式: resolve({ text, context })
      input:
        | string
        | {
            text: string
            context?: {
              currentQuery?: string
              currentModelId?: string
              role?: 'system' | 'user' | 'assistant'
              thresholdConfig?: { enabled: boolean; threshold: number }
            }
          }
    ) => {
      // 规范化输入
      const text = typeof input === 'string' ? input : input.text
      const context = typeof input === 'string' ? undefined : input.context

      try {
        if (!text || typeof text !== 'string') {
          return { success: true, result: text ?? '' }
        }

        const { getVCPRuntime, initializeVCPRuntime } = await import('./vcp/VCPRuntime')
        let runtime = getVCPRuntime()

        // 确保 VCPRuntime 已初始化
        if (!runtime || !runtime.isInitialized()) {
          logger.info('[PLACEHOLDER] VCPRuntime not ready, initializing...')
          await initializeVCPRuntime()
          runtime = getVCPRuntime()
        }

        if (!runtime) {
          return { success: false, error: 'VCP Runtime initialization failed', result: text }
        }

        // 使用 VCPRuntime 的 resolvePlaceholders 方法
        const resolved = await runtime.resolvePlaceholders(text, context)

        // 确保返回值是字符串类型
        const resolvedText = typeof resolved === 'string' ? resolved : String(resolved ?? text)

        logger.info('[PLACEHOLDER DEBUG] VCPIpcHandler resolved', {
          input: text,
          outputType: typeof resolved,
          outputLength: resolvedText.length,
          outputPreview: resolvedText.substring(0, 100),
          changed: resolvedText !== text
        })

        return { success: true, result: resolvedText }
      } catch (error) {
        logger.error('Failed to resolve placeholders', { error: error instanceof Error ? error.message : String(error) })
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', result: text }
      }
    }
  )

  /**
   * 基础占位符解析 - 仅系统变量（Date, Time, Weekday 等）
   * 用于快速同步替换，不涉及异步操作
   * 使用 @shared/variables 共享模块统一实现
   */
  ipcMain.handle(IpcChannel.VCP_Placeholder_ResolveBasic, async (_, text: string) => {
    try {
      const { resolveBasicSyncVariables } = await import('@shared/variables')
      const result = resolveBasicSyncVariables(text)
      return { success: true, result: result.text }
    } catch (error) {
      logger.error('Failed to resolve basic placeholders', {
        error: error instanceof Error ? error.message : String(error)
      })
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', result: text }
    }
  })

  // ==================== Diary SQLite Sync ====================

  /**
   * 批量同步现有日记到 SQLite
   * 用于将 Markdown 文件中的日记内容同步到 unified.db 的 chunks 表
   * 以便向量搜索能够检索到这些内容
   */
  ipcMain.handle(
    'vcp:diary:syncToSQLite',
    async (
      _,
      args?: {
        category?: string
      }
    ) => {
      try {
        const { getDailyNoteWritePlugin } = await import('./notes/DailyNoteWritePlugin')
        const plugin = getDailyNoteWritePlugin()

        const result = await plugin.syncAllExistingToSQLite({
          category: args?.category,
          onProgress: (current, total, note) => {
            logger.debug('Sync progress', { current, total, noteId: note.id })
          }
        })

        logger.info('Diary SQLite sync completed', {
          synced: result.synced,
          skipped: result.skipped,
          errors: result.errors.length
        })

        return result
      } catch (error) {
        logger.error('Failed to sync diaries to SQLite:', error as Error)
        return {
          success: false,
          synced: 0,
          skipped: 0,
          errors: [String(error)]
        }
      }
    }
  )

  logger.info('VCP IPC handlers registered successfully')
}

/**
 * 格式化 RAG 检索结果为可注入的文本
 */
function formatRAGResults(
  knowledgeBaseName: string,
  results: Array<{ pageContent: string; score: number; metadata?: Record<string, any> }>,
  config: RetrievalConfig
): string {
  if (results.length === 0) return ''

  const header = `[${knowledgeBaseName} 相关知识]`
  const fragments = results.map((r, i) => {
    const score = (r.score * 100).toFixed(1)
    const source = r.metadata?.source ? ` (来源: ${r.metadata.source})` : ''
    return `【${i + 1}】${r.pageContent.trim()}${source} [相关度: ${score}%]`
  })

  // 添加修饰符信息
  const modifiers: string[] = []
  if (config.timeAware) modifiers.push('时间感知')
  if (config.semanticGroups?.length) modifiers.push(`语义组: ${config.semanticGroups.join(', ')}`)
  if (config.tagMemo) modifiers.push('TagMemo')

  const footer = modifiers.length > 0 ? `\n[增强: ${modifiers.join(' | ')}]` : ''

  return `${header}\n\n${fragments.join('\n\n')}${footer}`
}
