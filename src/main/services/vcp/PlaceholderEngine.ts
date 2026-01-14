/**
 * VCP Native Runtime - Placeholder Engine
 *
 * 负责占位符解析与注入：
 * - 系统变量：{{Date}}, {{Time}}, {{Today}}, {{Festival}}
 * - 插件变量：{{VCPPluginName}}, {{VCPWeatherInfo}}
 * - 日记变量：{{角色名日记本}}, {{公共日记本}} - 完整日记注入
 * - RAG日记：[[角色名日记本]] - RAG 检索注入
 * - 阈值日记：<<角色名日记本>> - 阈值触发完整注入
 * - 阈值RAG：《《角色名日记本》》 - 阈值触发 RAG 注入
 * - 异步变量：{{VCP_ASYNC_RESULT::PluginName::TaskID}}
 * - 工具变量：{{VCPAllTools}}, {{VCPToolName}}
 * - 环境变量：{{Tar*}}, {{Var*}} (全局替换变量)
 * - 模型条件变量：{{Sar*}} (SarModelX/SarPromptX)
 * - 群聊变量：{{VCPChatGroupSessionWatcher}}, {{VCPChatCanvas}}
 * - Agent 模块变量：{{AgentMemory}}, {{AgentSearch}}, {{AgentCode}} - 子 Agent 调用
 * - Agent 模板变量：{{Agent:助手名}}, {{Agent:Nova:参数}} - 助手系统提示词模板（新增）
 *
 * VCPToolBox 占位符完整对标：
 * - {{角色名日记本}} → 获取完整日记内容
 * - [[角色名日记本]] → RAG 检索相关片段
 * - <<角色名日记本>> → 仅当查询相似度超过阈值时注入完整内容
 * - 《《角色名日记本》》 → 仅当相似度超过阈值时进行 RAG 检索
 * - {{Agent:Name}} → 获取助手的系统提示词模板
 *
 * 注入优先级：异步结果 → 静态插件 → 日记/RAG → VCPTavern → 群聊 → Agent模块 → 工具变量 → 环境变量 → 系统变量
 */

import { loggerService } from '@logger'
import {
  getDateTimeVariables,
  getCulturalVariables,
  escapeRegExp as sharedEscapeRegExp
} from '@shared/variables'
import * as lunarCalendar from 'chinese-lunar-calendar'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import {
  getCharacterCardService,
  getActiveCharacterSystemPrompt,
  getActiveCharacterFirstMessage,
  getActiveCharacterExampleDialogue,
  hasActiveCharacter
} from '../tavern'
import { getVCPAsyncResultsService } from './VCPAsyncResultsService'
import { getBuiltinServiceRegistry, ensureBuiltinServicesInitialized } from './BuiltinServices'
import type { BuiltinToolDefinition } from './BuiltinServices/types'
import type { PluginExecutor } from './PluginExecutor'
import type { PluginRegistry } from './PluginRegistry'
import type { PlaceholderContext, PlaceholderValue, VCPToolResult } from './types'
import { CircularDependencyDetector } from './CircularDependencyDetector'
import { PluginVariableRegistry } from './PluginVariableRegistry'
import { UnifiedCache } from './UnifiedCache'
import { vcpDetectorService } from './VCPDetectorService'

/** 最大递归深度 */
const MAX_RECURSION_DEPTH = 10

/**
 * VCP 服务信息格式（内置服务转换后的统一格式）
 * 用于 {{VCPServiceName}} 占位符的描述生成
 */
interface VCPServiceInfo {
  name: string
  displayName?: string
  description?: string
  version?: string
  pluginType?: string
  enabled?: boolean
  isBuiltin?: boolean
  isNative?: boolean
  author?: string
  category?: string
  supportsModel?: boolean
  modelConfig?: Record<string, unknown>
  configSchema?: Record<string, unknown>
  capabilities?: {
    invocationCommands?: BuiltinToolDefinition[]
  }
}

const logger = loggerService.withContext('VCP:PlaceholderEngine')

/**
 * 占位符引擎
 */
/**
 * 群聊会话信息
 */
export interface GroupSessionInfo {
  id: string
  name: string
  agents: Array<{
    id: string
    name: string
    displayName: string
    role: string
    status: string
  }>
  currentRound: number
  currentSpeaker?: string
  recentMessages: Array<{
    agentId: string
    agentName: string
    content: string
    timestamp: string
    type: string
  }>
  topic?: string
  isActive: boolean
}

/**
 * Canvas 内容
 */
export interface CanvasContent {
  type: 'text' | 'code' | 'diagram' | 'table' | 'unknown'
  content: string
  metadata?: Record<string, unknown>
}

/**
 * 扩展的占位符上下文
 */
export interface ExtendedPlaceholderContext extends PlaceholderContext {
  // 当前工具名称
  currentToolName?: string
  // 当前模型 ID（用于 Sar 条件注入）
  currentModelId?: string
  // 角色类型（用于限制某些占位符仅在 system 角色生效）
  role?: 'system' | 'user' | 'assistant'
  // 环境变量覆盖
  envOverrides?: Record<string, string>
  // 群聊会话信息
  groupSession?: GroupSessionInfo
  // Canvas 内容
  canvasContent?: CanvasContent
  // 当前用户查询（用于 RAG 检索和阈值判断）
  currentQuery?: string
  // 阈值触发配置
  thresholdConfig?: {
    enabled: boolean
    threshold: number // 相似度阈值，默认 0.6
  }
}

export class PlaceholderEngine {
  private registry: PluginRegistry
  private executor: PluginExecutor

  // 静态插件占位符缓存
  private staticCache: Map<string, PlaceholderValue> = new Map()

  // 异步结果缓存（包含创建时间戳用于过期清理）
  private asyncResults: Map<string, { result: VCPToolResult; createdAt: number }> = new Map()

  // 日记内容缓存
  private diaryCache: Map<string, string> = new Map()

  // VCPTavern 规则缓存
  private tavernRules: Map<string, string> = new Map()

  // 环境变量缓存（Tar*/Var*/Sar*）
  private envVarCache: Map<string, string> = new Map()

  // VCPVariableService 变量缓存（使用 UnifiedCache，5分钟 TTL）
  private vcpVariableCache: UnifiedCache<string> = new UnifiedCache<string>({
    defaultTTL: 300000, // 5 分钟
    maxSize: 500,
    name: 'VCPVariableCache'
  })

  // TVStxt 文件内容缓存（使用 UnifiedCache，1分钟 TTL，启用文件监听）
  private tvsCache: UnifiedCache<string> = new UnifiedCache<string>({
    defaultTTL: 60000, // 1 分钟
    maxSize: 100,
    enableFileWatch: true,
    name: 'TvsTxtCache'
  })

  // TVStxt 目录路径
  private tvsTxtDir: string

  constructor(registry: PluginRegistry, executor: PluginExecutor) {
    this.registry = registry
    this.executor = executor
    // TVStxt 目录位于 userData/vcp/TVStxt
    this.tvsTxtDir = path.join(app.getPath('userData'), 'vcp', 'TVStxt')
  }

  /**
   * 初始化占位符引擎
   */
  async initialize(): Promise<void> {
    logger.info('Initializing PlaceholderEngine...')

    // 加载所有静态插件的占位符值
    await this.refreshStaticPlaceholders()

    logger.info('PlaceholderEngine initialized', {
      staticPlaceholders: this.staticCache.size
    })
  }

  /**
   * 刷新静态插件占位符
   */
  async refreshStaticPlaceholders(): Promise<void> {
    const staticPlugins = this.registry.getPluginsByType('static')

    for (const plugin of staticPlugins) {
      const placeholders = plugin.manifest.capabilities?.systemPromptPlaceholders || []

      for (const ph of placeholders) {
        try {
          // 执行静态插件获取值
          const result = await this.executor.execute(plugin.manifest.name, { placeholder: ph.placeholder })

          if (result.success && result.output) {
            this.staticCache.set(ph.placeholder, {
              placeholder: ph.placeholder,
              value: String(result.output),
              source: 'static',
              updatedAt: Date.now()
            })
          } else {
            // 使用默认值
            this.staticCache.set(ph.placeholder, {
              placeholder: ph.placeholder,
              value: ph.defaultValue || `[${ph.placeholder}]`,
              source: 'static',
              updatedAt: Date.now()
            })
          }
        } catch (error) {
          logger.warn('Failed to get static placeholder value', {
            plugin: plugin.manifest.name,
            placeholder: ph.placeholder,
            error: error instanceof Error ? error.message : String(error)
          })

          // 使用默认值
          this.staticCache.set(ph.placeholder, {
            placeholder: ph.placeholder,
            value: ph.defaultValue || `[${ph.placeholder}]`,
            source: 'static',
            updatedAt: Date.now()
          })
        }
      }
    }
  }

  /**
   * 解析并替换文本中的所有占位符
   */
  async resolve(text: string, context?: PlaceholderContext | ExtendedPlaceholderContext): Promise<string> {
    if (!text) return text

    let result = text
    const extContext = context as ExtendedPlaceholderContext | undefined

    // 0. DetectorX 系统提示词转化（仅 system 角色）
    if (extContext?.role === 'system') {
      result = this.applyDetectorX(result, extContext?.currentModelId)
    }

    // 1. 异步结果占位符 {{VCP_ASYNC_RESULT::PluginName::TaskID}}
    result = await this.resolveAsyncPlaceholders(result, context)

    // 2. 静态插件占位符 {{VCPPluginName}}
    result = this.resolveStaticPlaceholders(result)

    // 2.5 内置服务占位符 {{VCPForumReminder}}
    result = await this.resolveBuiltinServicePlaceholders(result, extContext)

    // 2.6 插件注册变量 {{VCPPluginVariable}} - 由 PluginVariableRegistry 管理
    result = await this.resolvePluginRegistryVariables(result)

    // 3. 日记占位符 {{角色名日记本}}, {{公共日记本}} - 完整日记注入
    result = await this.resolveDiaryPlaceholders(result, extContext)

    // 3.5 RAG 日记占位符 [[角色名日记本]] - RAG 检索注入
    result = await this.resolveRAGDiaryPlaceholders(result, extContext)

    // 3.6 阈值触发占位符 <<角色名日记本>> 和 《《角色名日记本》》
    result = await this.resolveThresholdPlaceholders(result, extContext)

    // 4. VCPTavern 规则占位符
    result = this.resolveTavernPlaceholders(result, context)

    // 5. 群聊占位符 {{VCPChatGroupSessionWatcher}}, {{VCPChatCanvas}}
    result = this.resolveGroupChatPlaceholders(result, extContext)

    // 6. Agent 模块占位符 {{AgentMemory}}, {{AgentSearch}}, {{AgentCode}}
    result = await this.resolveAgentPlaceholders(result, extContext)

    // 7. VCP 工具占位符 {{VCPAllTools}}, {{VCPToolName}}
    result = await this.resolveToolPlaceholders(result, extContext)

    // 8. Sar 模型条件变量 {{SarPrompt1}} (仅在 system 角色生效)
    result = this.resolveSarPlaceholders(result, extContext)

    // 9. Tar/Var 环境变量 {{Tar*}}, {{Var*}} (仅在 system 角色生效)
    result = this.resolveTarVarPlaceholders(result, extContext)

    // 10. 系统变量占位符 {{Date}}, {{Time}}, {{Today}}
    result = this.resolveSystemPlaceholders(result)

    // 11. SuperDetectorX 全局上下文转化（应用于所有文本）
    result = this.applySuperDetectorX(result, extContext?.currentModelId)

    return result
  }

  /**
   * 解析异步结果占位符
   */
  private async resolveAsyncPlaceholders(text: string, context?: PlaceholderContext): Promise<string> {
    const pattern = /\{\{VCP_ASYNC_RESULT::([^:]+)::([^}]+)\}\}/g
    let result = text
    let match

    // 获取 VCPAsyncResultsService 实例
    const asyncResultsService = getVCPAsyncResultsService()

    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, pluginName, taskId] = match
      const cacheKey = `${pluginName}::${taskId}`

      // 1. 优先使用上下文中的结果
      let asyncResult = context?.asyncResults?.get(cacheKey)

      // 2. 然后从 VCPAsyncResultsService 获取持久化结果
      if (!asyncResult) {
        const persistedEntry = asyncResultsService.getResult(pluginName, taskId)
        if (persistedEntry) {
          if (persistedEntry.status === 'completed' && persistedEntry.result) {
            asyncResult = {
              success: true,
              output: persistedEntry.result
            }
          } else if (persistedEntry.status === 'failed' && persistedEntry.error) {
            asyncResult = {
              success: false,
              error: persistedEntry.error
            }
          }
        }
      }

      // 3. 然后查找本地缓存
      if (!asyncResult) {
        const cached = this.asyncResults.get(cacheKey)
        asyncResult = cached?.result
      }

      // 4. 最后查询执行器
      if (!asyncResult) {
        const task = this.executor.getAsyncTask(taskId)
        if (task?.result) {
          asyncResult = task.result
          this.asyncResults.set(cacheKey, { result: asyncResult, createdAt: Date.now() })
        }
      }

      if (asyncResult?.success && asyncResult.output) {
        result = result.replace(fullMatch, String(asyncResult.output))
      } else if (asyncResult?.error) {
        result = result.replace(fullMatch, `[Error: ${asyncResult.error}]`)
      }
      // 如果没有结果，保留占位符等待后续替换
    }

    return result
  }

  /**
   * 解析静态插件占位符
   */
  private resolveStaticPlaceholders(text: string): string {
    let result = text

    for (const [placeholder, value] of this.staticCache) {
      const pattern = new RegExp(`\\{\\{${this.escapeRegExp(placeholder)}\\}\\}`, 'g')
      result = result.replace(pattern, value.value)
    }

    return result
  }

  /**
   * 解析插件注册表变量
   * 由 PluginVariableRegistry 管理的动态/静态插件变量
   * 如 {{VCPWeatherInfo}}, {{VCPDailyHot}} 等
   */
  private async resolvePluginRegistryVariables(text: string): Promise<string> {
    try {
      const { text: resolvedText, resolved } = await PluginVariableRegistry.resolveVariables(text)

      if (resolved.length > 0) {
        logger.debug('Plugin registry variables resolved', { count: resolved.length, variables: resolved })
      }

      return resolvedText
    } catch (error) {
      logger.warn('Failed to resolve plugin registry variables', {
        error: error instanceof Error ? error.message : String(error)
      })
      return text
    }
  }

  /**
   * 解析内置服务占位符
   * - {{VCPForumReminder}}: 论坛提醒（由 VCPForumAssistantService 提供）
   */
  private async resolveBuiltinServicePlaceholders(text: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // {{VCPForumReminder}} - 论坛提醒
    if (result.includes('{{VCPForumReminder}}')) {
      try {
        const builtinRegistry = getBuiltinServiceRegistry()
        const forumAssistant = builtinRegistry.get('VCPForumAssistant')

        if (forumAssistant) {
          const reminderResult = await forumAssistant.execute('GetReminder', {})
          if (reminderResult.success && reminderResult.output) {
            result = result.replace(/\{\{VCPForumReminder\}\}/g, reminderResult.output)
          } else {
            // 没有提醒时替换为空
            result = result.replace(/\{\{VCPForumReminder\}\}/g, '')
          }
        } else {
          result = result.replace(/\{\{VCPForumReminder\}\}/g, '')
        }
      } catch (error) {
        logger.warn('Failed to get forum reminder', { error: error instanceof Error ? error.message : String(error) })
        result = result.replace(/\{\{VCPForumReminder\}\}/g, '')
      }
    }

    return result
  }

  /**
   * 解析日记占位符 {{角色名日记本}} - 完整日记注入
   * VCPToolBox 对标: AllCharacterDiariesData 全量注入
   */
  private async resolveDiaryPlaceholders(text: string, context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // 匹配 {{XXX日记本}} 格式
    const pattern = /\{\{([^}]+日记本)\}\}/g
    let match

    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, diaryName] = match

      // 优先使用上下文中的日记内容
      let content = context?.diaryContent?.get(diaryName)

      // 然后查找本地缓存
      if (!content) {
        content = this.diaryCache.get(diaryName)
      }

      // 如果缓存中没有，尝试从日记服务获取
      if (!content) {
        content = await this.fetchDiaryContent(diaryName, context)
      }

      if (content) {
        result = result.replace(fullMatch, content)
        // 更新缓存
        this.diaryCache.set(diaryName, content)
      } else {
        // 如果没有内容，替换为提示信息
        result = result.replace(fullMatch, `[日记本 "${diaryName}" 内容为空或不存在]`)
      }
    }

    return result
  }

  /**
   * 从日记服务获取完整日记内容
   */
  private async fetchDiaryContent(diaryName: string, context?: ExtendedPlaceholderContext): Promise<string | undefined> {
    try {
      // 解析角色名：去掉 "日记本" 后缀
      const characterName = diaryName.replace(/日记本$/, '').trim()
      const isPublic = characterName === '公共' || characterName === ''

      // 动态导入避免循环依赖
      const { getIntegratedMemoryCoordinator } = await import('../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 获取完整日记上下文
      const diaryContext = await coordinator.getDiaryContext({
        mode: 'full',
        characterName: isPublic ? undefined : characterName,
        timeExpression: context?.thresholdConfig?.enabled ? '过去30天' : undefined
      })

      if (diaryContext.content && diaryContext.content.length > 0) {
        logger.debug('Fetched diary content', {
          diaryName,
          characterName: isPublic ? 'public' : characterName,
          contentLength: diaryContext.content.length,
          sourceCount: diaryContext.sourceCount
        })
        return diaryContext.content
      }

      return undefined
    } catch (error) {
      logger.warn('Failed to fetch diary content', {
        diaryName,
        error: error instanceof Error ? error.message : String(error)
      })
      return undefined
    }
  }

  /**
   * 高级 RAG 语法解析结果
   * VCPToolBox 对标: [[日记本:1.5::Time::Group(emotion,time)::Rerank::TagMemo0.65]]
   */
  private parseAdvancedRAGSyntax(rawContent: string): {
    diaryName: string
    kMultiplier: number
    useTime: boolean
    useGroup: boolean
    groupNames: string[]
    useRerank: boolean
    tagMemoWeight: number | null
    useAIMemo: boolean
  } {
    // 默认值
    const result = {
      diaryName: '',
      kMultiplier: 1.0,
      useTime: false,
      useGroup: false,
      groupNames: [] as string[],
      useRerank: false,
      tagMemoWeight: null as number | null,
      useAIMemo: false
    }

    // 分割内容，支持 :1.5 和 ::Option 两种格式
    // 示例: "小克日记本:1.5::Time::Group(emotion,time)::Rerank::TagMemo0.65"
    const parts = rawContent.split('::')

    // 第一部分可能包含 diaryName 和 kMultiplier
    const firstPart = parts[0]
    const kMatch = firstPart.match(/^(.+?日记本)(?::(\d+\.?\d*))?$/)
    if (kMatch) {
      result.diaryName = kMatch[1]
      if (kMatch[2]) {
        result.kMultiplier = parseFloat(kMatch[2])
      }
    } else {
      // 兼容没有 "日记本" 后缀的情况
      const simpleKMatch = firstPart.match(/^(.+?)(?::(\d+\.?\d*))?$/)
      if (simpleKMatch) {
        result.diaryName = simpleKMatch[1]
        if (simpleKMatch[2]) {
          result.kMultiplier = parseFloat(simpleKMatch[2])
        }
      } else {
        result.diaryName = firstPart
      }
    }

    // 解析后续选项
    for (let i = 1; i < parts.length; i++) {
      const option = parts[i].trim()

      if (option === 'Time') {
        result.useTime = true
      } else if (option === 'Group' || option.startsWith('Group(')) {
        result.useGroup = true
        // 解析 Group(a,b,c) 格式
        const groupParamsMatch = option.match(/^Group\(([^)]+)\)$/)
        if (groupParamsMatch) {
          result.groupNames = groupParamsMatch[1]
            .split(',')
            .map(g => g.trim())
            .filter(g => g.length > 0)
        }
      } else if (option === 'Rerank') {
        result.useRerank = true
      } else if (option === 'AIMemo') {
        result.useAIMemo = true
      } else if (option.startsWith('TagMemo')) {
        // TagMemo0.65 格式
        const weightMatch = option.match(/^TagMemo(\d+\.?\d*)$/)
        if (weightMatch) {
          result.tagMemoWeight = parseFloat(weightMatch[1])
        } else {
          // 默认权重 0.65
          result.tagMemoWeight = 0.65
        }
      }
    }

    return result
  }

  /**
   * 解析 RAG 日记占位符 [[角色名日记本]] - RAG 检索注入
   * VCPToolBox 对标: 使用 RAG 检索相关片段而非全量注入
   *
   * 高级语法:
   * - [[日记本:1.5]] - 动态 K 值 (结果数量乘数)
   * - [[日记本::Time]] - 时间感知检索
   * - [[日记本::Group]] - 语义组增强检索
   * - [[日记本::Rerank]] - Rerank 精排
   * - [[日记本::TagMemo0.65]] - Tag 向量网络牵引 (权重 0-1)
   * - [[日记本::AIMemo]] - AI 军团并发检索
   * - [[日记本:1.5::Time::Group(emotion,time)::Rerank]] - 组合使用
   */
  private async resolveRAGDiaryPlaceholders(text: string, context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // 匹配 [[XXX日记本...]] 格式，支持高级语法
    // 示例: [[小克日记本]], [[小克日记本:1.5]], [[小克日记本::Time::Group(emotion)]]
    const pattern = /\[\[([^\]]+日记本[^\]]*)\]\]/g
    let match

    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, rawContent] = match

      // 解析高级语法
      const options = this.parseAdvancedRAGSyntax(rawContent)

      const content = await this.fetchDiaryRAG(options.diaryName, context, {
        kMultiplier: options.kMultiplier,
        useTime: options.useTime,
        useGroup: options.useGroup,
        groupNames: options.groupNames,
        useRerank: options.useRerank,
        tagMemoWeight: options.tagMemoWeight,
        useAIMemo: options.useAIMemo
      })

      if (content) {
        result = result.replace(fullMatch, content)
      } else {
        result = result.replace(fullMatch, `[RAG 检索 "${options.diaryName}" 无结果]`)
      }
    }

    return result
  }

  /**
   * 从日记服务进行 RAG 检索
   * 支持 VCPToolBox 高级功能: Time, Group, Rerank, TagMemo, AIMemo
   */
  private async fetchDiaryRAG(
    diaryName: string,
    context?: ExtendedPlaceholderContext,
    advancedOptions?: {
      kMultiplier?: number
      useTime?: boolean
      useGroup?: boolean
      groupNames?: string[]
      useRerank?: boolean
      tagMemoWeight?: number | null
      useAIMemo?: boolean
    }
  ): Promise<string | undefined> {
    try {
      const characterName = diaryName.replace(/日记本$/, '').trim()
      const isPublic = characterName === '公共' || characterName === ''
      const query = context?.currentQuery || '相关内容'

      const { getIntegratedMemoryCoordinator } = await import('../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 计算 topK (基于乘数)
      const baseTopK = 10
      const topK = Math.round(baseTopK * (advancedOptions?.kMultiplier || 1.0))

      // 构建搜索选项
      const searchOptions: Record<string, unknown> = {
        backends: ['diary'] as string[],
        topK,
        characterName: isPublic ? undefined : characterName
      }

      // 时间感知检索
      if (advancedOptions?.useTime) {
        searchOptions.parseTimeExpressions = true
        // 从 query 中提取时间表达式
        searchOptions.timeExpression = query
      }

      // 语义组增强 - 支持指定组名
      if (advancedOptions?.useGroup) {
        if (advancedOptions.groupNames && advancedOptions.groupNames.length > 0) {
          // 使用指定的组名列表
          searchOptions.useGroup = true
          searchOptions.groupNames = advancedOptions.groupNames
        } else {
          // 自动检测语义组
          searchOptions.expandQuery = true
        }
      }

      // TagMemo 标签共现扩展
      if (advancedOptions?.tagMemoWeight !== null && advancedOptions?.tagMemoWeight !== undefined) {
        searchOptions.useTagMemo = true
        searchOptions.tagBoost = advancedOptions.tagMemoWeight
      }

      // LLM Rerank 精排 - 正确传递 useRerank 参数
      if (advancedOptions?.useRerank) {
        searchOptions.useRerank = true
        // WaveRAG 可以独立使用，但 Rerank 效果更好
        searchOptions.useWaveRAG = true
      }

      // AIMemo 模式 - 使用更高的 topK 和多阶段搜索
      if (advancedOptions?.useAIMemo) {
        searchOptions.topK = Math.max(topK * 3, 30) // 大幅增加搜索数量
        searchOptions.useWaveRAG = true
        searchOptions.expandQuery = true
        searchOptions.useTagMemo = true
      }

      logger.debug('Fetching diary RAG with advanced options', {
        diaryName,
        characterName,
        query,
        advancedOptions,
        searchOptions
      })

      // 执行智能搜索
      const searchResults = await coordinator.intelligentSearch(query, searchOptions as Parameters<typeof coordinator.intelligentSearch>[1])

      if (searchResults.length > 0) {
        // 格式化结果
        const formattedContent = searchResults
          .slice(0, topK)
          .map((r, i) => {
            const metadata = r.metadata || {}
            const dateStr = metadata.date ? ` (${metadata.date})` : ''
            const tags = metadata.tags as string[] | undefined
            const tagsStr = tags?.length ? ` [${tags.join(', ')}]` : ''
            const scoreStr = advancedOptions?.useRerank ? ` 相关度:${(r.score * 100).toFixed(1)}%` : ''
            return `【片段${i + 1}${dateStr}${tagsStr}${scoreStr}】\n${r.content}`
          })
          .join('\n\n')

        logger.debug('Fetched diary RAG content with advanced options', {
          diaryName,
          query,
          contentLength: formattedContent.length,
          resultCount: Math.min(searchResults.length, topK),
          usedOptions: {
            time: advancedOptions?.useTime,
            group: advancedOptions?.useGroup,
            rerank: advancedOptions?.useRerank,
            tagMemo: advancedOptions?.tagMemoWeight,
            aiMemo: advancedOptions?.useAIMemo
          }
        })

        return formattedContent
      }

      return undefined
    } catch (error) {
      logger.warn('Failed to fetch diary RAG content', {
        diaryName,
        advancedOptions,
        error: error instanceof Error ? error.message : String(error)
      })
      return undefined
    }
  }

  /**
   * 解析阈值触发占位符
   * - <<角色名日记本>> - 阈值触发完整注入
   * - 《《角色名日记本》》 - 阈值触发 RAG 注入
   *
   * VCPToolBox 对标: 仅当用户查询与日记内容相似度超过阈值时才注入
   */
  private async resolveThresholdPlaceholders(text: string, context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // 1. 匹配 <<XXX日记本>> 格式 - 阈值触发完整注入
    const fullPattern = /<<([^>]+日记本)>>/g
    let match

    while ((match = fullPattern.exec(text)) !== null) {
      const [fullMatch, diaryName] = match
      const content = await this.fetchThresholdDiary(diaryName, 'full', context)
      result = result.replace(fullMatch, content || '')
    }

    // 2. 匹配 《《XXX日记本》》 格式 - 阈值触发 RAG 注入
    const ragPattern = /《《([^》]+日记本)》》/g

    while ((match = ragPattern.exec(text)) !== null) {
      const [fullMatch, diaryName] = match
      const content = await this.fetchThresholdDiary(diaryName, 'rag', context)
      result = result.replace(fullMatch, content || '')
    }

    return result
  }

  /**
   * 阈值触发日记获取
   * 仅当用户查询与日记内容相似度超过阈值时才返回内容
   */
  private async fetchThresholdDiary(
    diaryName: string,
    mode: 'full' | 'rag',
    context?: ExtendedPlaceholderContext
  ): Promise<string | undefined> {
    try {
      const characterName = diaryName.replace(/日记本$/, '').trim()
      const isPublic = characterName === '公共' || characterName === ''
      const query = context?.currentQuery

      // 如果没有查询，无法判断阈值，返回空
      if (!query) {
        logger.debug('Threshold placeholder skipped - no query provided', { diaryName, mode })
        return undefined
      }

      const threshold = context?.thresholdConfig?.threshold ?? 0.6

      const { getIntegratedMemoryCoordinator } = await import('../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 先进行相似度检测
      const searchResults = await coordinator.intelligentSearch(query, {
        backends: ['diary'],
        topK: 1,
        characterName: isPublic ? undefined : characterName
      })

      // 检查是否超过阈值
      if (searchResults.length === 0 || searchResults[0].score < threshold) {
        logger.debug('Threshold not met for diary placeholder', {
          diaryName,
          mode,
          score: searchResults[0]?.score ?? 0,
          threshold
        })
        return undefined
      }

      logger.debug('Threshold met, fetching diary content', {
        diaryName,
        mode,
        score: searchResults[0].score,
        threshold
      })

      // 阈值满足，获取内容
      const diaryContext = await coordinator.getDiaryContext({
        mode: mode === 'full' ? 'threshold' : 'threshold_rag',
        query,
        characterName: isPublic ? undefined : characterName
      })

      return diaryContext.content || undefined
    } catch (error) {
      logger.warn('Failed to fetch threshold diary content', {
        diaryName,
        mode,
        error: error instanceof Error ? error.message : String(error)
      })
      return undefined
    }
  }

  /**
   * 解析 VCPTavern 规则占位符
   * 支持:
   * - {{VCPTavern::preset_name}} - 激活指定预设（上下文注入）
   * - {{TavernCharacter}} - 当前角色卡完整系统提示词
   * - {{TavernGreeting}} - 当前角色卡首条消息
   * - {{TavernExample}} - 当前角色卡示例对话
   * - {{TavernPersonality}} - 当前角色卡性格
   * - {{TavernScenario}} - 当前角色卡场景
   * - {{TavernDescription}} - 当前角色卡描述
   * - {{TavernName}} - 当前角色卡名称
   * - {{char}} - SillyTavern 兼容：当前角色名称
   * - {{user}} - SillyTavern 兼容：当前用户名称
   * - {{persona}} - SillyTavern 兼容：用户人设描述
   * - 以及其他自定义规则
   */
  private resolveTavernPlaceholders(text: string, context?: PlaceholderContext): string {
    let result = text

    // 0. 解析 VCPTavern 预设激活占位符 {{VCPTavern::preset_name}}
    const presetPattern = /\{\{VCPTavern::([a-zA-Z0-9_-]+)\}\}/g
    let presetMatch
    while ((presetMatch = presetPattern.exec(text)) !== null) {
      const [fullMatch, presetName] = presetMatch
      // 激活预设（异步操作，这里只记录日志）
      this.activateTavernPreset(presetName)
      // 移除占位符（它是控制指令，不是内容）
      result = result.replace(fullMatch, '')
    }

    // 1. 解析角色卡占位符
    if (hasActiveCharacter()) {
      const cardService = getCharacterCardService()
      const activeCard = cardService.getActive()

      if (activeCard) {
        // {{TavernCharacter}} - 完整系统提示词
        if (result.includes('{{TavernCharacter}}')) {
          const systemPrompt = getActiveCharacterSystemPrompt() || ''
          result = result.replace(/\{\{TavernCharacter\}\}/g, systemPrompt)
        }

        // {{TavernGreeting}} - 首条消息
        if (result.includes('{{TavernGreeting}}')) {
          const greeting = getActiveCharacterFirstMessage() || ''
          result = result.replace(/\{\{TavernGreeting\}\}/g, greeting)
        }

        // {{TavernExample}} - 示例对话
        if (result.includes('{{TavernExample}}')) {
          const example = getActiveCharacterExampleDialogue() || ''
          result = result.replace(/\{\{TavernExample\}\}/g, example)
        }

        // {{TavernPersonality}} - 性格
        if (result.includes('{{TavernPersonality}}')) {
          result = result.replace(/\{\{TavernPersonality\}\}/g, activeCard.data.personality || '')
        }

        // {{TavernScenario}} - 场景
        if (result.includes('{{TavernScenario}}')) {
          result = result.replace(/\{\{TavernScenario\}\}/g, activeCard.data.scenario || '')
        }

        // {{TavernDescription}} - 描述
        if (result.includes('{{TavernDescription}}')) {
          result = result.replace(/\{\{TavernDescription\}\}/g, activeCard.data.description || '')
        }

        // {{TavernName}} - 角色名称
        if (result.includes('{{TavernName}}')) {
          result = result.replace(/\{\{TavernName\}\}/g, activeCard.name || '')
        }

        // {{TavernPostHistory}} - 历史后指令
        if (result.includes('{{TavernPostHistory}}')) {
          result = result.replace(/\{\{TavernPostHistory\}\}/g, activeCard.data.post_history_instructions || '')
        }

        // ==================== SillyTavern 兼容变量 ====================
        // {{char}} - 当前角色名称
        if (result.includes('{{char}}')) {
          result = result.replace(/\{\{char\}\}/g, activeCard.name || '')
        }
      }
    }

    // {{user}} - 当前用户名称（从上下文获取）
    if (result.includes('{{user}}')) {
      const userName = context?.userName || 'User'
      result = result.replace(/\{\{user\}\}/g, userName)
    }

    // {{persona}} - 用户人设描述（从上下文获取）
    if (result.includes('{{persona}}')) {
      const persona = context?.userPersona || ''
      result = result.replace(/\{\{persona\}\}/g, persona)
    }

    // 2. 解析自定义规则占位符（从上下文或本地缓存）
    const rules = context?.tavernRules ? new Map(Object.entries(context.tavernRules)) : this.tavernRules

    for (const [key, value] of rules) {
      const pattern = new RegExp(`\\{\\{${this.escapeRegExp(key)}\\}\\}`, 'g')
      result = result.replace(pattern, value)
    }

    return result
  }

  /**
   * 激活 VCPTavern 预设
   * 异步操作，不阻塞占位符解析
   */
  private activateTavernPreset(presetName: string): void {
    // 异步激活预设
    import('../tavern/PresetManager')
      .then(({ getPresetManager }) => {
        const manager = getPresetManager()
        return manager.activateByName(presetName)
      })
      .then((preset) => {
        if (preset) {
          logger.info('VCPTavern preset activated', { presetName, presetId: preset.id })
        } else {
          logger.warn('VCPTavern preset not found', { presetName })
        }
      })
      .catch((error) => {
        logger.error('Failed to activate VCPTavern preset', {
          presetName,
          error: error instanceof Error ? error.message : String(error)
        })
      })
  }

  /**
   * 解析群聊占位符
   * - {{VCPChatGroupSessionWatcher}}: 群聊会话 JSON 信息
   * - {{VCPChatCanvas}}: Canvas 内容
   */
  private resolveGroupChatPlaceholders(text: string, context?: ExtendedPlaceholderContext): string {
    let result = text

    // {{VCPChatGroupSessionWatcher}} - 群聊会话信息
    if (result.includes('{{VCPChatGroupSessionWatcher}}')) {
      if (context?.groupSession) {
        const sessionJson = JSON.stringify(context.groupSession, null, 2)
        result = result.replace(/\{\{VCPChatGroupSessionWatcher\}\}/g, sessionJson)
      } else {
        // 如果没有群聊会话，替换为空或保留
        result = result.replace(/\{\{VCPChatGroupSessionWatcher\}\}/g, '/* 当前不在群聊中 */')
      }
    }

    // {{VCPChatCanvas}} - Canvas 内容
    if (result.includes('{{VCPChatCanvas}}')) {
      if (context?.canvasContent) {
        const canvasStr = this.formatCanvasContent(context.canvasContent)
        result = result.replace(/\{\{VCPChatCanvas\}\}/g, canvasStr)
      } else {
        result = result.replace(/\{\{VCPChatCanvas\}\}/g, '')
      }
    }

    return result
  }

  /**
   * 格式化 Canvas 内容
   */
  private formatCanvasContent(canvas: CanvasContent): string {
    switch (canvas.type) {
      case 'code':
        const lang = (canvas.metadata?.language as string) || ''
        return `\`\`\`${lang}\n${canvas.content}\n\`\`\``
      case 'diagram':
        return `[图表]\n${canvas.content}`
      case 'table':
        return canvas.content
      default:
        return canvas.content
    }
  }

  /**
   * 解析 Agent 模块占位符
   * 支持:
   * - {{AgentMemory}} - 调用记忆 Agent 获取相关记忆
   * - {{AgentSearch}} - 调用搜索 Agent 执行搜索
   * - {{AgentCode}} - 调用代码 Agent
   * - {{AgentXXX}} - 其他自定义 Agent 模块
   * - {{Agent:助手名}} - 获取助手的系统提示词模板（新增）
   * - {{Agent:Nova:参数}} - 带参数调用助手模板（新增）
   *
   * VCPToolBox 对标: 模块占位符系统 + Agent 模板变量
   */
  private async resolveAgentPlaceholders(text: string, context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // 1. 匹配 {{Agent:Name}} 或 {{Agent:Name:Params}} 格式（助手模板引用，支持中文）
    const templatePattern = /\{\{Agent:([^:}]+)(?::([^}]*))?\}\}/g
    let match

    // 收集模板匹配
    const templateMatches: Array<{ fullMatch: string; agentName: string; params?: string }> = []
    while ((match = templatePattern.exec(text)) !== null) {
      templateMatches.push({
        fullMatch: match[0],
        agentName: match[1].trim(),
        params: match[2]?.trim()
      })
    }

    // 处理助手模板引用
    for (const m of templateMatches) {
      try {
        const templateResult = await this.resolveAgentTemplate(m.agentName, m.params)
        result = result.replace(m.fullMatch, templateResult)
      } catch (error) {
        logger.warn('Failed to resolve agent template', {
          agentName: m.agentName,
          error: error instanceof Error ? error.message : String(error)
        })
        result = result.replace(m.fullMatch, `[助手 ${m.agentName} 模板加载失败]`)
      }
    }

    // 2. 匹配 {{AgentXXX}} 或 {{AgentXXX:参数}} 格式（子 Agent 调用）
    const agentPattern = /\{\{Agent(\w+)(?::([^}]*))?\}\}/g

    // 收集所有匹配
    const matches: Array<{ fullMatch: string; agentType: string; params?: string }> = []
    while ((match = agentPattern.exec(result)) !== null) {
      matches.push({
        fullMatch: match[0],
        agentType: match[1],
        params: match[2]
      })
    }

    // 顺序处理（避免并发问题）
    for (const m of matches) {
      try {
        const agentResult = await this.invokeSubAgent(m.agentType, m.params, context)
        result = result.replace(m.fullMatch, agentResult)
      } catch (error) {
        logger.warn('Failed to invoke sub-agent', {
          agentType: m.agentType,
          error: error instanceof Error ? error.message : String(error)
        })
        // 失败时保留占位符或显示错误
        result = result.replace(m.fullMatch, `[Agent ${m.agentType} 调用失败]`)
      }
    }

    return result
  }

  /**
   * 解析助手模板
   * 根据助手名称获取其系统提示词
   *
   * @param agentName 助手名称（支持 id、name、displayName）
   * @param params 可选参数，用于模板变量替换
   */
  private async resolveAgentTemplate(agentName: string, params?: string): Promise<string> {
    try {
      const { VCPAgentService } = await import('../../knowledge/agent/VCPAgentService')
      const agentService = new VCPAgentService()

      // 尝试按名称查找助手
      const agent = agentService.getAgentByName(agentName)
      if (agent) {
        logger.debug('Resolved agent template', { agentName, agentId: agent.id })

        // 如果有参数，解析为上下文变量
        if (params) {
          const context: import('../../knowledge/agent/VCPAgentService').VCPTemplateContext = {
            custom: { input: params }
          }
          return agentService.getAgentSystemPromptWithContext(agent.id, context)
        }

        return agentService.getAgentSystemPrompt(agent.id) || agent.systemPrompt
      }

      return `[助手 "${agentName}" 不存在]`
    } catch (error) {
      logger.warn('Failed to resolve agent template', {
        agentName,
        error: error instanceof Error ? error.message : String(error)
      })
      return `[助手模板加载失败: ${agentName}]`
    }
  }

  /**
   * 调用子 Agent
   */
  private async invokeSubAgent(
    agentType: string,
    params?: string,
    context?: ExtendedPlaceholderContext
  ): Promise<string> {
    logger.debug('Invoking sub-agent', { agentType, params })

    switch (agentType.toLowerCase()) {
      case 'memory':
        return await this.invokeMemoryAgent(params, context)

      case 'search':
        return await this.invokeSearchAgent(params, context)

      case 'code':
        return await this.invokeCodeAgent(params, context)

      case 'summary':
        return await this.invokeSummaryAgent(params, context)

      case 'translate':
        return await this.invokeTranslateAgent(params, context)

      default:
        // 尝试查找自定义 Agent 插件
        return await this.invokeCustomAgent(agentType, params, context)
    }
  }

  /**
   * 调用记忆 Agent
   * 用于检索相关记忆内容
   */
  private async invokeMemoryAgent(params?: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    try {
      // 动态导入避免循环依赖
      const { getIntegratedMemoryCoordinator } = await import('../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // params 作为查询文本
      const query = params || '最近的相关记忆'
      const results = await coordinator.intelligentSearch(query, {
        backends: ['memory'],
        topK: 5
      })

      if (results.length === 0) {
        return '没有找到相关记忆'
      }

      // 格式化结果
      return results.map((r, i) => `[记忆 ${i + 1}] ${r.content}`).join('\n\n')
    } catch (error) {
      logger.warn('Memory agent failed', { error: error instanceof Error ? error.message : String(error) })
      return '记忆检索暂时不可用'
    }
  }

  /**
   * 调用搜索 Agent
   * 用于执行知识库搜索
   */
  private async invokeSearchAgent(params?: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    try {
      const { getIntegratedMemoryCoordinator } = await import('../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      const query = params || '相关信息'
      const results = await coordinator.intelligentSearch(query, {
        backends: ['knowledge', 'memory'],
        topK: 5
      })

      if (results.length === 0) {
        return '没有找到相关内容'
      }

      return results.map((r, i) => `[结果 ${i + 1}] ${r.content.slice(0, 200)}...`).join('\n\n')
    } catch (error) {
      logger.warn('Search agent failed', { error: error instanceof Error ? error.message : String(error) })
      return '搜索暂时不可用'
    }
  }

  /**
   * 调用代码 Agent
   * 用于代码相关任务
   */
  private async invokeCodeAgent(params?: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    // 代码 Agent 目前返回提示信息
    // 实际实现可以集成代码分析、执行等功能
    if (!params) {
      return '请提供代码相关指令'
    }

    // 简单的代码格式化提示
    return `代码任务: ${params}\n请根据上下文处理此代码任务。`
  }

  /**
   * 调用摘要 Agent
   */
  private async invokeSummaryAgent(params?: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    if (!params) {
      return '请提供需要摘要的内容'
    }

    // 返回格式化的摘要请求
    return `[需要摘要的内容]\n${params}`
  }

  /**
   * 调用翻译 Agent
   */
  private async invokeTranslateAgent(params?: string, _context?: ExtendedPlaceholderContext): Promise<string> {
    if (!params) {
      return '请提供需要翻译的内容'
    }

    // 解析格式: "目标语言:内容" 或直接内容
    const colonIndex = params.indexOf(':')
    if (colonIndex > 0 && colonIndex < 10) {
      const targetLang = params.slice(0, colonIndex).trim()
      const content = params.slice(colonIndex + 1).trim()
      return `[翻译到 ${targetLang}]\n${content}`
    }

    return `[需要翻译的内容]\n${params}`
  }

  /**
   * 调用自定义 Agent
   *
   * 支持两种模式：
   * 1. 助手模板模式：{{AgentNova}} 或 {{Agent:Nova}} - 解析为助手的系统提示词
   * 2. 插件调用模式：查找匹配的插件并执行
   *
   * VCPToolBox 对标: Agent 变量系统
   */
  private async invokeCustomAgent(
    agentType: string,
    params?: string,
    _context?: ExtendedPlaceholderContext
  ): Promise<string> {
    // 1. 首先尝试从 VCPAgentService 获取助手模板
    try {
      const { VCPAgentService } = await import('../../knowledge/agent/VCPAgentService')
      const agentService = new VCPAgentService()

      // 尝试按名称查找助手
      const agent = agentService.getAgentByName(agentType)
      if (agent) {
        logger.debug('Found agent template', { agentType, agentName: agent.displayName })

        // 如果有参数，可以用于注入上下文
        if (params) {
          // 返回带参数上下文的系统提示词
          const context: import('../../knowledge/agent/VCPAgentService').VCPTemplateContext = {
            custom: { input: params }
          }
          return agentService.getAgentSystemPromptWithContext(agent.id, context)
        }

        // 返回助手的系统提示词
        return agentService.getAgentSystemPrompt(agent.id) || agent.systemPrompt
      }
    } catch (error) {
      logger.debug('VCPAgentService lookup failed', {
        agentType,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // 2. 然后查找是否有对应的插件
    const plugins = this.registry.getAllPlugins()
    const agentPlugin = plugins.find(
      (p) =>
        p.enabled &&
        (p.manifest.name.toLowerCase().includes(agentType.toLowerCase()) ||
          p.manifest.displayName?.toLowerCase().includes(agentType.toLowerCase()))
    )

    if (agentPlugin) {
      try {
        const result = await this.executor.execute(agentPlugin.manifest.name, {
          action: 'invoke',
          params: params
        })

        if (result.success && result.output) {
          return String(result.output)
        }
      } catch (error) {
        logger.warn('Custom agent plugin execution failed', {
          agentType,
          plugin: agentPlugin.manifest.name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return `[Agent ${agentType} 未找到或不可用]`
  }

  /**
   * 解析 VCP 工具占位符
   * - {{VCPAllTools}}: 所有可用工具的描述列表（完整版，token 消耗高）
   * - {{VCPToolCatalog}}: 工具目录（精简版，只有名称和一句话描述）
   * - {{VCPToolName}}: 当前工具名称
   *
   * 推荐使用 {{VCPToolCatalog}} 配合 vcp_get_tool_info 元工具实现按需加载
   */
  private async resolveToolPlaceholders(text: string, context?: ExtendedPlaceholderContext): Promise<string> {
    let result = text

    // {{VCPServiceName}} - 单个服务/插件的完整描述（VCPToolBox 核心特性）
    // 格式: {{VCPDailyNoteWrite}}, {{VCPLightMemo}}, {{VCPAIMemo}} 等
    // 这是 VCPToolBox 的精髓：按需注入，避免 token 爆炸
    const vcpServicePattern = /\{\{VCP([A-Za-z0-9_]+)\}\}/g
    let serviceMatch: RegExpExecArray | null
    logger.info('[PLACEHOLDER DEBUG] resolveToolPlaceholders called', { text, hasPattern: vcpServicePattern.test(text) })

    // 重置正则表达式（因为 test() 会改变 lastIndex）
    vcpServicePattern.lastIndex = 0

    while ((serviceMatch = vcpServicePattern.exec(text)) !== null) {
      const [fullMatch, serviceName] = serviceMatch
      logger.info('[PLACEHOLDER DEBUG] Found VCP service placeholder', { fullMatch, serviceName })

      // 跳过特殊占位符
      if (['AllTools', 'Tools', 'ToolCatalog', 'ToolName', 'Guide'].includes(serviceName)) {
        logger.info('[PLACEHOLDER DEBUG] Skipping special placeholder', { serviceName })
        continue
      }

      const serviceDesc = await this.generateSingleServiceDescription(serviceName)
      logger.info('[PLACEHOLDER DEBUG] Generated service description', {
        serviceName,
        hasDesc: !!serviceDesc,
        descLength: serviceDesc?.length ?? 0,
        descPreview: serviceDesc?.substring(0, 100)
      })

      if (serviceDesc) {
        result = result.replace(new RegExp(this.escapeRegExp(fullMatch), 'g'), serviceDesc)
        logger.debug('VCP service placeholder replaced', { serviceName, descLength: serviceDesc.length })
      }
    }

    // {{VCPToolCatalog}} - 生成精简的工具目录（推荐）
    // 只包含工具名称和一句话描述，大幅减少 token 消耗
    if (result.includes('{{VCPToolCatalog}}')) {
      const toolCatalog = this.generateToolCatalog()
      result = result.replace(/\{\{VCPToolCatalog\}\}/g, toolCatalog)
    }

    // {{VCPAllTools}} - 生成所有工具的完整描述列表
    // 警告：token 消耗高，建议仅在需要时使用
    if (result.includes('{{VCPAllTools}}')) {
      const toolDescriptions = this.generateAllToolsDescription()
      result = result.replace(/\{\{VCPAllTools\}\}/g, toolDescriptions)
    }

    // {{VCPToolName}} - 当前工具名称
    if (result.includes('{{VCPToolName}}') && context?.currentToolName) {
      result = result.replace(/\{\{VCPToolName\}\}/g, context.currentToolName)
    }

    // {{VCPGuide}} - VCP 协议使用指南
    if (result.includes('{{VCPGuide}}')) {
      const guide = this.generateVCPGuide()
      result = result.replace(/\{\{VCPGuide\}\}/g, guide)
    }

    return result
  }

  /**
   * 生成单个服务/插件的完整描述
   *
   * VCPToolBox 核心特性：按需注入单个工具描述
   * - {{VCPDailyNoteWrite}} → 日记写入服务的完整描述和调用示例
   * - {{VCPLightMemo}} → 轻量级 RAG 服务的完整描述和调用示例
   *
   * @param serviceName 服务名称（不含 VCP 前缀）
   */
  private async generateSingleServiceDescription(serviceName: string): Promise<string | null> {
    // 1. 尝试从内置服务中查找（确保已初始化）
    try {
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      const builtinServices = builtinRegistry.toVCPPluginFormat()

      logger.debug('Searching for service in builtin registry', {
        serviceName,
        availableServices: builtinServices.map(s => s.name)
      })

      for (const service of builtinServices) {
        // 匹配服务名（忽略大小写和下划线）
        const normalizedServiceName = serviceName.toLowerCase().replace(/_/g, '')
        const normalizedName = service.name.toLowerCase().replace(/_/g, '')
        const normalizedDisplayName = (service.displayName || '').toLowerCase().replace(/_/g, '').replace(/\s/g, '')

        if (normalizedName === normalizedServiceName || normalizedDisplayName === normalizedServiceName) {
          logger.debug('Found matching builtin service', { serviceName, matchedName: service.name })
          return this.formatServiceDescription(service as VCPServiceInfo)
        }
      }
    } catch (error) {
      logger.warn('Failed to search builtin services', {
        serviceName,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // 2. 尝试从 VCP 插件中查找
    const plugins = this.registry.getAllPlugins()
    for (const plugin of plugins) {
      if (!plugin.enabled) continue

      const normalizedServiceName = serviceName.toLowerCase().replace(/_/g, '')
      const normalizedName = plugin.manifest.name.toLowerCase().replace(/_/g, '')
      const normalizedDisplayName = (plugin.manifest.displayName || '').toLowerCase().replace(/_/g, '').replace(/\s/g, '')

      if (normalizedName === normalizedServiceName || normalizedDisplayName === normalizedServiceName) {
        return this.formatPluginDescription(plugin)
      }
    }

    logger.debug('Service not found for placeholder', { serviceName })
    return null
  }

  /**
   * 格式化内置服务描述（VCPToolBox 原生格式）
   */
  private formatServiceDescription(service: VCPServiceInfo): string {
    const parts: string[] = []
    const displayName = service.displayName || service.name

    parts.push(`## ${displayName} [内置服务]`)
    parts.push(``)
    parts.push(`${service.description || '无描述'}`)

    const commands = service.capabilities?.invocationCommands || []
    for (const cmd of commands) {
      parts.push(``)
      parts.push(`### ${cmd.commandIdentifier || service.name}`)

      if (cmd.description) {
        parts.push(`${cmd.description}`)
      }

      // 生成参数说明
      if (cmd.parameters && cmd.parameters.length > 0) {
        parts.push(``)
        parts.push(`**参数:**`)
        for (const param of cmd.parameters) {
          const required = param.required ? '(必需)' : '(可选)'
          parts.push(`- \`${param.name}\` ${required}: ${param.description || '无描述'}`)
        }
      }

      // 生成调用示例
      parts.push(``)
      parts.push(`**调用示例:**`)
      parts.push('```')
      parts.push(`<<<[TOOL_REQUEST]>>>`)
      parts.push(`tool_name:「始」${service.name}「末」,`)
      if (cmd.commandIdentifier && cmd.commandIdentifier !== service.name) {
        parts.push(`command:「始」${cmd.commandIdentifier}「末」,`)
      }
      if (cmd.parameters && cmd.parameters.length > 0) {
        for (const param of cmd.parameters) {
          parts.push(`${param.name}:「始」${param.description || '参数值'}「末」,`)
        }
      }
      parts.push(`<<<[END_TOOL_REQUEST]>>>`)
      parts.push('```')
    }

    return parts.join('\n')
  }

  /**
   * 格式化 VCP 插件描述（VCPToolBox 原生格式）
   */
  private formatPluginDescription(plugin: ReturnType<typeof this.registry.getAllPlugins>[0]): string {
    const parts: string[] = []
    const displayName = plugin.manifest.displayName || plugin.manifest.name

    parts.push(`## ${displayName}`)
    parts.push(``)
    parts.push(`${plugin.manifest.description || '无描述'}`)

    const capabilities = plugin.manifest.capabilities

    // 处理 invocationCommands
    const commands = capabilities?.invocationCommands || []
    for (const cmd of commands) {
      parts.push(``)
      parts.push(`### ${cmd.commandIdentifier || plugin.manifest.name}`)

      if (cmd.description) {
        parts.push(`${cmd.description}`)
      }

      if (cmd.parameters && cmd.parameters.length > 0) {
        parts.push(``)
        parts.push(`**参数:**`)
        for (const param of cmd.parameters) {
          const required = param.required ? '(必需)' : '(可选)'
          parts.push(`- \`${param.name}\` ${required}: ${param.description || '无描述'}`)
        }
      }

      // 使用 cmd.example 如果有的话
      if (cmd.example) {
        parts.push(``)
        parts.push(`**调用示例:**`)
        parts.push('```')
        parts.push(cmd.example)
        parts.push('```')
      } else {
        parts.push(``)
        parts.push(`**调用示例:**`)
        parts.push('```')
        parts.push(`<<<[TOOL_REQUEST]>>>`)
        parts.push(`tool_name:「始」${plugin.manifest.name}「末」,`)
        if (cmd.commandIdentifier) {
          parts.push(`command:「始」${cmd.commandIdentifier}「末」,`)
        }
        if (cmd.parameters && cmd.parameters.length > 0) {
          for (const param of cmd.parameters) {
            parts.push(`${param.name}:「始」${param.description || '参数值'}「末」,`)
          }
        }
        parts.push(`<<<[END_TOOL_REQUEST]>>>`)
        parts.push('```')
      }
    }

    // 处理 toolFunctions
    const toolFunctions = capabilities?.toolFunctions || []
    for (const tool of toolFunctions) {
      parts.push(``)
      parts.push(`### ${tool.name}`)
      parts.push(`${tool.description || '无描述'}`)

      if (tool.parameters?.properties) {
        parts.push(``)
        parts.push(`**参数:**`)
        const props = tool.parameters.properties as Record<string, { description?: string; type?: string }>
        const required = (tool.parameters.required as string[]) || []
        for (const [name, prop] of Object.entries(props)) {
          const isRequired = required.includes(name) ? '(必需)' : '(可选)'
          parts.push(`- \`${name}\` ${isRequired}: ${prop.description || '无描述'}`)
        }
      }

      parts.push(``)
      parts.push(`**调用示例:**`)
      parts.push('```')
      parts.push(`<<<[TOOL_REQUEST]>>>`)
      parts.push(`tool_name:「始」${tool.name}「末」,`)
      if (tool.parameters?.properties) {
        const props = tool.parameters.properties as Record<string, { description?: string }>
        for (const [name, prop] of Object.entries(props)) {
          parts.push(`${name}:「始」${prop.description || '参数值'}「末」,`)
        }
      }
      parts.push(`<<<[END_TOOL_REQUEST]>>>`)
      parts.push('```')
    }

    return parts.join('\n')
  }

  /**
   * 生成 VCP 协议使用指南
   */
  private generateVCPGuide(): string {
    return `## VCP 工具调用协议

当需要调用工具时，请使用以下格式：

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」工具ID「末」,
参数1:「始」参数值「末」,
参数2:「始」参数值「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

**⚠️ 重要：工具名称与工具ID**
- 工具目录中格式为：\`显示名 (工具ID)\`
- **tool_name 必须使用括号中的工具ID**，不是显示名
- 例如：工具 \`日记管理 (DailyNoteWrite)\` 的 tool_name 是 \`DailyNoteWrite\`

其他说明：
1. 所有参数值必须用「始」和「末」包裹
2. 调用完成后，您将收到工具执行结果
3. 请等待工具结果后再继续回复用户
4. 可以在一条消息中调用多个工具（并行执行）`
  }

  /**
   * 生成精简的工具目录
   *
   * 格式：
   * - ToolName: 一句话描述
   *
   * 配合 vcp_get_tool_info 元工具使用，实现按需加载工具详情
   * 大幅减少 token 消耗（从 10000+ 降到 ~500）
   */
  private generateToolCatalog(): string {
    const plugins = this.registry.getAllPlugins()
    const catalogItems: string[] = []

    // 1. 处理 VCP 插件
    for (const plugin of plugins) {
      if (!plugin.enabled) continue

      const capabilities = plugin.manifest.capabilities
      const displayName = plugin.manifest.displayName || plugin.manifest.name
      const toolId = plugin.manifest.name // 实际工具 ID，AI 调用时必须使用

      // 获取插件的一句话描述（取第一行或前50个字符）
      const fullDesc = plugin.manifest.description || ''
      const shortDesc = fullDesc.split('\n')[0].slice(0, 60) + (fullDesc.length > 60 ? '...' : '')

      // 采用 VCPToolBox 风格格式: 显示名 (工具ID) - 命令: 描述
      // 这样 AI 既能看到友好名称，也能知道调用时用什么 ID
      const toolIdPart = toolId !== displayName ? ` (${toolId})` : ''

      // 如果有多个命令，列出主要命令
      const commands = capabilities?.invocationCommands || []
      if (commands.length > 0) {
        // 只列出前3个命令
        const cmdNames = commands.slice(0, 3).map((c) => c.commandIdentifier).filter(Boolean)
        const cmdList = cmdNames.length > 0 ? ` - 命令: ${cmdNames.join(', ')}` : ''
        catalogItems.push(`- ${displayName}${toolIdPart}${cmdList}: ${shortDesc}`)
      } else if (capabilities?.toolFunctions && capabilities.toolFunctions.length > 0) {
        // 新格式的工具函数
        const toolNames = capabilities.toolFunctions.slice(0, 3).map((t) => t.name)
        const toolList = toolNames.length > 0 ? ` - 命令: ${toolNames.join(', ')}` : ''
        catalogItems.push(`- ${displayName}${toolIdPart}${toolList}: ${shortDesc}`)
      } else {
        catalogItems.push(`- ${displayName}${toolIdPart}: ${shortDesc}`)
      }
    }

    // 2. 处理内置服务
    try {
      const builtinRegistry = getBuiltinServiceRegistry()
      const builtinServices = builtinRegistry.toVCPPluginFormat()

      for (const service of builtinServices) {
        if (!service.enabled) continue

        const fullDesc = service.description || ''
        const shortDesc = fullDesc.split('\n')[0].slice(0, 60) + (fullDesc.length > 60 ? '...' : '')

        // 格式: 显示名 (服务ID) [内置] - 命令: 描述
        const serviceId = service.name
        const serviceIdPart = serviceId !== service.displayName ? ` (${serviceId})` : ''

        const commands = service.capabilities?.invocationCommands || []
        const cmdNames = commands.slice(0, 3).map((c) => c.commandIdentifier).filter(Boolean)
        const cmdList = cmdNames.length > 0 ? ` - 命令: ${cmdNames.join(', ')}` : ''

        catalogItems.push(`- ${service.displayName}${serviceIdPart} [内置]${cmdList}: ${shortDesc}`)
      }
    } catch (error) {
      logger.warn('Failed to get builtin services for tool catalog', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // 3. 添加使用说明 - 强调 tool_name 必须使用工具ID
    const header = `## 可用工具目录

**格式说明：** \`显示名 (工具ID) - 命令: 描述\`

**⚠️ 调用时 tool_name 必须使用括号中的工具ID，不是显示名！**

使用 \`vcp_get_tool_info\` 查询具体工具的详细用法。

调用示例（查询 DailyNoteWrite 工具详情）：
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_get_tool_info「末」,
name:「始」DailyNoteWrite「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

---

`

    return header + catalogItems.join('\n')
  }

  /**
   * 生成所有工具的描述
   *
   * 支持两种格式：
   * - toolFunctions: 新格式（OpenAI function calling 风格）
   * - invocationCommands: VCPToolBox 原生格式（包含 VCP 协议调用示例）
   *
   * 注意：使用精简格式减少 token 占用
   * - 只包含工具名、命令、描述摘要和参数列表
   * - 不包含冗长的调用示例（AI 可以从协议指南推断）
   */
  private generateAllToolsDescription(): string {
    const plugins = this.registry.getAllPlugins()
    const descriptions: string[] = []

    for (const plugin of plugins) {
      if (!plugin.enabled) continue

      const capabilities = plugin.manifest.capabilities

      // 1. 处理 toolFunctions (新格式) - 精简输出
      if (capabilities?.toolFunctions && capabilities.toolFunctions.length > 0) {
        for (const tool of capabilities.toolFunctions) {
          const params = tool.parameters?.properties
            ? Object.entries(tool.parameters.properties)
                .map(([name, prop]) => {
                  const required = tool.parameters?.required?.includes(name) ? '*' : ''
                  const desc = (prop as { description?: string }).description || ''
                  // 截断过长的描述
                  const shortDesc = desc.length > 60 ? desc.slice(0, 60) + '...' : desc
                  return `  ${name}${required}: ${shortDesc}`
                })
                .join('\n')
            : '  (无参数)'

          // 截断过长的工具描述
          const toolDesc = tool.description || '无描述'
          const shortToolDesc = toolDesc.length > 100 ? toolDesc.slice(0, 100) + '...' : toolDesc

          descriptions.push(
            `### ${tool.name}\n` +
              `${shortToolDesc}\n` +
              `参数:\n${params}`
          )
        }
      }

      // 2. 处理 invocationCommands (VCPToolBox 原生格式) - 精简输出
      if (capabilities?.invocationCommands && capabilities.invocationCommands.length > 0) {
        for (const cmd of capabilities.invocationCommands) {
          const pluginName = plugin.manifest.name
          const displayName = plugin.manifest.displayName || plugin.manifest.name
          // 使用 PluginName:CommandName 格式，便于 AI 直接调用
          const fullToolName = cmd.commandIdentifier ? `${pluginName}:${cmd.commandIdentifier}` : pluginName

          // 只提取描述的第一部分（通常是功能说明，之后是参数和示例）
          let shortDesc = ''
          if (cmd.description) {
            // 提取描述的第一段落或前100个字符
            const firstParagraph = cmd.description.split('\n\n')[0].split('参数:')[0].trim()
            shortDesc = firstParagraph.length > 120 ? firstParagraph.slice(0, 120) + '...' : firstParagraph
          }

          // 提取参数列表（如果有的话）
          let paramsList = ''
          if (cmd.parameters && cmd.parameters.length > 0) {
            paramsList = '\n参数: ' + cmd.parameters.map((p) => `${p.name}${p.required ? '*' : ''}`).join(', ')
          }

          // 显示调用格式: ### PluginName:CommandName (DisplayName)
          const displayLabel = cmd.commandIdentifier ? `### ${fullToolName} (${displayName})` : `### ${displayName}`
          descriptions.push(`${displayLabel}\n${shortDesc}${paramsList}`)
          // 注意：不再包含 example，AI 可以从协议指南推断调用格式
        }
      }
    }

    // 3. 处理内置服务 (BuiltinServices) - 精简输出
    try {
      const builtinRegistry = getBuiltinServiceRegistry()
      const builtinServices = builtinRegistry.toVCPPluginFormat()

      for (const service of builtinServices) {
        if (!service.enabled) continue

        const commands = service.capabilities?.invocationCommands || []
        for (const cmd of commands) {
          const serviceName = service.name
          const toolName = service.displayName || service.name
          // 使用 ServiceName:CommandName 格式，便于 AI 直接调用
          const fullToolName = cmd.commandIdentifier ? `${serviceName}:${cmd.commandIdentifier}` : serviceName

          // 只提取描述的第一部分
          let shortDesc = '[内置] '
          if (cmd.description) {
            const firstParagraph = cmd.description.split('\n\n')[0].split('参数:')[0].trim()
            shortDesc += firstParagraph.length > 100 ? firstParagraph.slice(0, 100) + '...' : firstParagraph
          }

          // 提取参数列表
          let paramsList = ''
          if (cmd.parameters && cmd.parameters.length > 0) {
            paramsList = '\n参数: ' + cmd.parameters.map((p) => `${p.name}${p.required ? '*' : ''}`).join(', ')
          }

          // 显示调用格式: ### ServiceName:CommandName (DisplayName)
          const displayLabel = cmd.commandIdentifier ? `### ${fullToolName} (${toolName})` : `### ${toolName}`
          descriptions.push(`${displayLabel}\n${shortDesc}${paramsList}`)
        }
      }
    } catch (error) {
      logger.warn('Failed to get builtin services for tool descriptions', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return descriptions.length > 0 ? descriptions.join('\n\n') : '没有可用的 VCP 工具'
  }

  /**
   * 解析 Sar 模型条件变量
   * - {{SarPrompt1}}: 仅当当前模型匹配 SarModel1 时注入 SarPrompt1 的值
   * - 仅在 system 角色中生效
   */
  private resolveSarPlaceholders(text: string, context?: ExtendedPlaceholderContext): string {
    // 仅在 system 角色或未指定角色时处理
    if (context?.role && context.role !== 'system') {
      return text
    }

    let result = text

    // 匹配 {{SarPromptN}} 格式
    const sarPattern = /\{\{(SarPrompt(\d+))\}\}/g
    let match

    while ((match = sarPattern.exec(text)) !== null) {
      const [fullMatch, promptKey, index] = match
      const modelKey = `SarModel${index}`

      // 获取环境变量
      const models = context?.envOverrides?.[modelKey] || process.env[modelKey]
      const promptValue = context?.envOverrides?.[promptKey] || process.env[promptKey]

      let replacement = '' // 默认替换为空

      if (models && promptValue && context?.currentModelId) {
        const modelList = models.split(',').map((m) => m.trim().toLowerCase())
        if (modelList.includes(context.currentModelId.toLowerCase())) {
          replacement = promptValue
        }
      }

      result = result.replace(new RegExp(this.escapeRegExp(fullMatch), 'g'), replacement)
    }

    return result
  }

  /**
   * 解析 Tar/Var 环境变量（支持递归解析和循环检测）
   * - {{TarXXX}}: 最高优先级模板组合
   * - {{VarXXX}}: 全局替换变量
   * - 仅在 system 角色中生效
   *
   * 查找优先级:
   * 1. 上下文 envOverrides
   * 2. VCPVariableService (持久化存储)
   * 3. 环境变量 process.env
   * 4. 本地 envVarCache
   *
   * 递归解析:
   * - 变量值中如果包含 {{Tar*}} 或 {{Var*}} 会递归解析
   * - 使用 CircularDependencyDetector 防止循环引用
   * - 最大递归深度: MAX_RECURSION_DEPTH (10层)
   *
   * @param text 待解析文本
   * @param context 扩展上下文
   * @param detector 循环依赖检测器（递归调用时传入）
   * @param depth 当前递归深度
   */
  private resolveTarVarPlaceholders(
    text: string,
    context?: ExtendedPlaceholderContext,
    detector?: CircularDependencyDetector,
    depth: number = 0
  ): string {
    // 仅在 system 角色或未指定角色时处理
    if (context?.role && context.role !== 'system') {
      return text
    }

    // 深度检查
    if (depth > MAX_RECURSION_DEPTH) {
      logger.warn(`Max recursion depth (${MAX_RECURSION_DEPTH}) reached in resolveTarVarPlaceholders`)
      return text
    }

    let result = text

    // 使用或创建循环检测器
    const circularDetector = detector ?? new CircularDependencyDetector()

    // 匹配 {{Tar*}} 和 {{Var*}} 格式
    const tarVarPattern = /\{\{((?:Tar|Var)[a-zA-Z0-9_]+)\}\}/g
    let match

    while ((match = tarVarPattern.exec(text)) !== null) {
      const [fullMatch, varKey] = match

      // 循环依赖检测
      const circularError = circularDetector.enter(varKey)
      if (circularError) {
        logger.warn(`Circular dependency detected for ${varKey}`, {
          stackTrace: circularDetector.getStackTrace()
        })
        result = result.replace(new RegExp(this.escapeRegExp(fullMatch), 'g'), circularError)
        continue
      }

      try {
        // 1. 优先从上下文覆盖
        let value = context?.envOverrides?.[varKey]

        // 2. 然后从 VCPVariableService 获取（延迟初始化，避免循环依赖）
        if (!value) {
          try {
            // 同步方式获取变量值
            const vcpVarValue = this.getVCPVariableValue(varKey)
            if (vcpVarValue) {
              value = vcpVarValue
            }
          } catch {
            // VCPVariableService 可能未初始化，忽略错误
          }
        }

        // 3. 然后从环境变量
        if (!value) {
          value = process.env[varKey]
        }

        // 4. 最后从缓存
        if (!value) {
          value = this.envVarCache.get(varKey)
        }

        if (value) {
          // 如果值是 .txt 文件引用，从 TVStxt 目录加载文件内容
          if (value.toLowerCase().endsWith('.txt')) {
            logger.debug('TVStxt file reference detected', { varKey, file: value })
            const fileContent = this.loadTvsTxtFile(value)
            if (fileContent) {
              value = fileContent
            }
          }

          // 递归解析嵌套的 Tar/Var 变量
          if (value && /\{\{(?:Tar|Var)[a-zA-Z0-9_]+\}\}/.test(value)) {
            value = this.resolveTarVarPlaceholders(value, context, circularDetector, depth + 1)
          }

          // 解析嵌套的系统变量 (Date, Time, etc.)
          if (value) {
            value = this.resolveSystemPlaceholders(value)
          }

          result = result.replace(new RegExp(this.escapeRegExp(fullMatch), 'g'), value)
        } else {
          // 未找到值，记录警告并保留占位符
          logger.debug('Environment variable not found', { varKey })
        }
      } finally {
        // 确保退出当前变量的解析栈
        circularDetector.exit(varKey)
      }
    }

    return result
  }

  /**
   * 同步获取 VCPVariableService 中的变量值
   * 用于 Tar/Var 变量解析
   */
  private getVCPVariableValue(varKey: string): string | undefined {
    try {
      // 动态导入 VCPVariableService 避免循环依赖
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { vcpVariableService } = require('./VCPVariableService')

      // 使用 Map 缓存已加载的变量，减少 I/O
      if (this.vcpVariableCache.has(varKey)) {
        return this.vcpVariableCache.get(varKey)
      }

      // 同步获取变量（VCPVariableService 内部有初始化保护）
      const variables = vcpVariableService.variables
      if (variables) {
        for (const variable of variables.values()) {
          if (variable.name === varKey) {
            // 缓存结果
            this.vcpVariableCache.set(varKey, variable.value)
            return variable.value
          }
        }
      }

      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * 加载 TVStxt 文件内容
   * @param filename 文件名（如 Dailynote.txt）
   * @returns 文件内容，如果失败则返回 undefined
   */
  private loadTvsTxtFile(filename: string): string | undefined {
    // 检查缓存
    if (this.tvsCache.has(filename)) {
      logger.debug('TVStxt cache hit', { filename })
      return this.tvsCache.get(filename)
    }

    try {
      // 确保 TVStxt 目录存在
      if (!fs.existsSync(this.tvsTxtDir)) {
        fs.mkdirSync(this.tvsTxtDir, { recursive: true })
        logger.debug('Created TVStxt directory', { dir: this.tvsTxtDir })
      }

      const filePath = path.join(this.tvsTxtDir, filename)

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        this.tvsCache.set(filename, content)
        // 监听文件变化，自动失效缓存
        this.tvsCache.watchFile(filePath, filename)
        logger.debug('TVStxt file loaded', { filename, length: content.length })
        return content
      } else {
        logger.warn('TVStxt file not found', { filename, path: filePath })
        return `[变量文件 (${filename}) 未找到]`
      }
    } catch (error) {
      logger.error('Failed to load TVStxt file', {
        filename,
        error: error instanceof Error ? error.message : String(error)
      })
      return `[处理变量文件 (${filename}) 时出错]`
    }
  }

  /**
   * 清除 TVStxt 文件缓存
   */
  clearTvsCache(): void {
    this.tvsCache.clear()
    logger.debug('TVStxt cache cleared')
  }

  /**
   * 解析系统变量占位符
   * 使用 @shared/variables 共享模块统一日期时间变量解析
   */
  private resolveSystemPlaceholders(text: string): string {
    const now = new Date()

    // 获取农历信息
    const lunarInfo = this.getLunarInfo(now)

    // 使用共享模块获取日期时间变量
    const replacements: Record<string, string> = {
      ...getDateTimeVariables(now),
      ...getCulturalVariables(now),
      // Festival 需要特殊处理（包含农历和中国传统节日）
      Festival: this.getCurrentFestival(),
      // 农历相关变量
      Lunar: lunarInfo.dateStr,
      LunarDate: lunarInfo.dateStr,
      LunarFestival: lunarInfo.festival,
      SolarTerm: lunarInfo.solarTerm,
      Zodiac: lunarInfo.zodiac,
      YearCyl: lunarInfo.yearCyl,
      LunarYear: lunarInfo.lunarYear,
      LunarMonth: lunarInfo.lunarMonth,
      LunarDay: lunarInfo.lunarDay
    }

    let result = text

    for (const [key, value] of Object.entries(replacements)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
      result = result.replace(pattern, value)
    }

    return result
  }

  /**
   * 获取农历信息
   */
  private getLunarInfo(date: Date): {
    dateStr: string
    festival: string
    solarTerm: string
    zodiac: string
    yearCyl: string
    lunarYear: string
    lunarMonth: string
    lunarDay: string
  } {
    try {
      const lunar = lunarCalendar.getLunar(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      )

      return {
        dateStr: lunar.dateStr || '',      // 例如: 腊月初十
        festival: lunar.lunarFestival || '', // 农历节日
        solarTerm: lunar.solarTerm || '',  // 节气
        zodiac: lunar.zodiac || '',        // 生肖
        yearCyl: lunar.yearCyl || '',      // 天干地支年份
        lunarYear: String(lunar.lunarYear || ''),
        lunarMonth: lunar.lunarMonthName || '',
        lunarDay: lunar.lunarDayName || ''
      }
    } catch (error) {
      logger.warn('Failed to get lunar info', { error: String(error) })
      return {
        dateStr: '',
        festival: '',
        solarTerm: '',
        zodiac: '',
        yearCyl: '',
        lunarYear: '',
        lunarMonth: '',
        lunarDay: ''
      }
    }
  }

  /**
   * 获取当前节日（增强版：支持公历、农历和节气）
   */
  private getCurrentFestival(): string {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()

    // 1. 检查公历节日
    const gregorianFestivals: Record<string, string> = {
      '1-1': '元旦',
      '2-14': '情人节',
      '3-8': '妇女节',
      '4-1': '愚人节',
      '5-1': '劳动节',
      '5-4': '青年节',
      '6-1': '儿童节',
      '7-1': '建党节',
      '8-1': '建军节',
      '9-10': '教师节',
      '10-1': '国庆节',
      '12-25': '圣诞节'
    }

    const gregorian = gregorianFestivals[`${month}-${day}`]
    if (gregorian) return gregorian

    // 2. 检查农历节日和节气
    try {
      const lunar = lunarCalendar.getLunar(now.getFullYear(), month, day)

      // 优先返回农历节日
      if (lunar.lunarFestival) {
        return lunar.lunarFestival
      }

      // 其次返回节气
      if (lunar.solarTerm) {
        return lunar.solarTerm
      }
    } catch (error) {
      logger.debug('Failed to get lunar festival', { error: String(error) })
    }

    return ''
  }

  /**
   * 转义正则表达式特殊字符
   * 使用 @shared/variables 共享模块统一实现
   */
  private escapeRegExp(string: string): string {
    return sharedEscapeRegExp(string)
  }

  // ==================== 缓存管理 ====================

  /**
   * 设置静态占位符值
   */
  setStaticValue(placeholder: string, value: string): void {
    this.staticCache.set(placeholder, {
      placeholder,
      value,
      source: 'static',
      updatedAt: Date.now()
    })
  }

  /**
   * 获取静态占位符值
   */
  getStaticValue(placeholder: string): string | undefined {
    return this.staticCache.get(placeholder)?.value
  }

  /**
   * 设置异步结果
   */
  setAsyncResult(pluginName: string, taskId: string, result: VCPToolResult): void {
    const key = `${pluginName}::${taskId}`
    this.asyncResults.set(key, { result, createdAt: Date.now() })
  }

  /**
   * 获取异步结果
   */
  getAsyncResult(pluginName: string, taskId: string): VCPToolResult | undefined {
    const entry = this.asyncResults.get(`${pluginName}::${taskId}`)
    return entry?.result
  }

  /**
   * 清除异步结果
   */
  clearAsyncResult(pluginName: string, taskId: string): boolean {
    return this.asyncResults.delete(`${pluginName}::${taskId}`)
  }

  /**
   * 设置日记内容
   */
  setDiaryContent(diaryName: string, content: string): void {
    this.diaryCache.set(diaryName, content)
  }

  /**
   * 获取日记内容
   */
  getDiaryContent(diaryName: string): string | undefined {
    return this.diaryCache.get(diaryName)
  }

  /**
   * 设置 VCPTavern 规则
   */
  setTavernRule(key: string, value: string): void {
    this.tavernRules.set(key, value)
  }

  /**
   * 批量设置 VCPTavern 规则
   */
  setTavernRules(rules: Record<string, string>): void {
    for (const [key, value] of Object.entries(rules)) {
      this.tavernRules.set(key, value)
    }
  }

  /**
   * 设置环境变量缓存（Tar/Var/Sar）
   */
  setEnvVar(key: string, value: string): void {
    this.envVarCache.set(key, value)
  }

  /**
   * 批量设置环境变量缓存
   */
  setEnvVars(vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
      this.envVarCache.set(key, value)
    }
  }

  /**
   * 获取环境变量缓存
   */
  getEnvVar(key: string): string | undefined {
    return this.envVarCache.get(key)
  }

  /**
   * 获取所有环境变量缓存
   */
  getAllEnvVars(): Map<string, string> {
    return new Map(this.envVarCache)
  }

  /**
   * 获取所有静态占位符
   */
  getAllStaticPlaceholders(): Map<string, PlaceholderValue> {
    return new Map(this.staticCache)
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    this.staticCache.clear()
    this.asyncResults.clear()
    this.diaryCache.clear()
    this.tavernRules.clear()
    this.envVarCache.clear()
    this.vcpVariableCache.clear()
    this.tvsCache.clear()
    logger.info('All caches cleared')
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    vcpVariable: { size: number; hits: number; misses: number; hitRate: number }
    tvsTxt: { size: number; hits: number; misses: number; hitRate: number }
    static: number
    diary: number
    tavern: number
    envVar: number
  } {
    const vcpStats = this.vcpVariableCache.getStats()
    const tvsStats = this.tvsCache.getStats()

    return {
      vcpVariable: {
        size: vcpStats.size,
        hits: vcpStats.hits,
        misses: vcpStats.misses,
        hitRate: vcpStats.hitRate
      },
      tvsTxt: {
        size: tvsStats.size,
        hits: tvsStats.hits,
        misses: tvsStats.misses,
        hitRate: tvsStats.hitRate
      },
      static: this.staticCache.size,
      diary: this.diaryCache.size,
      tavern: this.tavernRules.size,
      envVar: this.envVarCache.size
    }
  }

  /**
   * 清理过期的异步结果
   */
  cleanupExpiredAsyncResults(maxAgeMs: number = 3600000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.asyncResults) {
      // 使用 createdAt 时间戳判断是否过期
      if (now - entry.createdAt > maxAgeMs) {
        this.asyncResults.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired async results', { count: cleaned })
    }

    return cleaned
  }

  // ==================== DetectorX / SuperDetectorX ====================

  /**
   * 应用 DetectorX 规则 - 系统提示词转化
   *
   * 修正不良指令、引导 AI 行为、动态管理指令模块
   * 仅在 system 角色的消息中生效
   */
  private applyDetectorX(text: string, modelId?: string): string {
    try {
      const result = vcpDetectorService.applyDetectorX(text, modelId)
      if (result.transformed) {
        logger.debug('DetectorX applied', {
          rulesTriggered: result.triggeredRules.length,
          executionTimeMs: result.executionTimeMs
        })
      }
      return result.text
    } catch (error) {
      logger.warn('DetectorX failed', { error: String(error) })
      return text
    }
  }

  /**
   * 应用 SuperDetectorX 规则 - 全局上下文转化
   *
   * 文本规范化、抑制 AI 口癖、修复高频词权导致的上下文推理崩溃
   * 应用于所有文本（对话历史、AI 输出等）
   */
  private applySuperDetectorX(text: string, modelId?: string): string {
    try {
      const result = vcpDetectorService.applySuperDetectorX(text, modelId)
      if (result.transformed) {
        logger.debug('SuperDetectorX applied', {
          rulesTriggered: result.triggeredRules.length,
          executionTimeMs: result.executionTimeMs
        })
      }
      return result.text
    } catch (error) {
      logger.warn('SuperDetectorX failed', { error: String(error) })
      return text
    }
  }
}

/**
 * 创建占位符引擎实例
 */
export function createPlaceholderEngine(registry: PluginRegistry, executor: PluginExecutor): PlaceholderEngine {
  return new PlaceholderEngine(registry, executor)
}
