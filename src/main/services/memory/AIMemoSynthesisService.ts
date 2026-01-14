/**
 * AIMemo Synthesis Service - AI 记忆综合服务
 *
 * 基于 VCPToolBox RAGDiaryPlugin/AIMemoPrompt.txt 完整功能实现
 * 原生适配 Cherry Studio 架构
 *
 * 核心能力:
 * - 接收对话上下文 + 知识库检索结果
 * - 通过 AI 进行深度推理和综合
 * - 输出结构化的"动态记忆场"
 * - 支持多维探针网络 (因果、时间、空间、对比、情感)
 * - 智能缓存减少重复 LLM 调用
 *
 * @author Cherry Studio Team
 */

import crypto from 'crypto'
import { app } from 'electron'
import path from 'path'

import { loggerService } from '@logger'

import { createUnifiedDatabase, type MemoryRecord } from '../native'

const logger = loggerService.withContext('AIMemoSynthesis')

// ==================== 类型定义 ====================

/**
 * 对话上下文
 */
export interface ConversationContext {
  /** 最近的助手回复 */
  lastAssistantResponse?: string
  /** 当前用户消息 */
  currentUserPrompt: string
  /** 历史消息 (可选) */
  history?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

/**
 * 知识库内容
 */
export interface KnowledgeContent {
  /** 来源类型 */
  source: 'knowledge' | 'diary' | 'memory' | 'external'
  /** 来源名称 */
  sourceName: string
  /** 内容 */
  content: string
  /** 相关性分数 */
  score?: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 记忆综合选项
 */
export interface SynthesisOptions {
  /** 时间戳 */
  timestamp?: Date
  /** 最大输出长度 (字符) */
  maxOutputLength?: number
  /** 是否包含推理过程 (调试用) */
  includeReasoning?: boolean
  /** 自定义系统提示词 */
  customSystemPrompt?: string
  /** AI 模型 ID */
  modelId?: string
  /** AI Provider ID */
  providerId?: string
  /** 是否使用缓存 (默认 true) */
  useCache?: boolean
  /** 缓存过期时间 (秒, 默认 3600 = 1小时) */
  cacheTTL?: number
  /** 合成超时时间 (ms, 默认 30000) */
  timeout?: number
}

/**
 * 缓存条目
 */
interface CacheEntry {
  content: string
  hasRelevantMemory: boolean
  createdAt: string
  expiresAt: string
  modelId?: string
  providerId?: string
}

/**
 * 记忆综合结果
 */
export interface SynthesisResult {
  /** 综合后的记忆内容 */
  content: string
  /** 是否找到相关记忆 */
  hasRelevantMemory: boolean
  /** 处理时间 (ms) */
  durationMs: number
  /** 使用的知识源数量 */
  sourcesUsed: number
  /** 原始知识内容 (调试用) */
  rawKnowledge?: string
  /** 是否来自缓存 */
  fromCache?: boolean
}

// ==================== Prompt 模板 ====================

/**
 * VCPToolBox AIMemoPrompt.txt 完整移植
 * 保留所有推理框架和输出格式约束
 */
const AIMEMO_SYSTEM_PROMPT = `### 角色与核心使命 ###
你的角色是一个专用的"VCP记忆处理单元"。你的核心使命是：接收[当前对话上下文]和[完整知识库]，通过深度理解、推理与综合，为当前对话构建一个高度相关的"动态记忆场"。你是一个推理引擎，而非简单的信息检索器。你的最终目标是向上层AI提供结构化的、有证据支持的关键信息，以辅助其生成回应。

### 核心推理框架（这是你的内部思考过程，不要在最终输出中体现）###
*   **第一步：解构上下文意图**（显式分析 + 隐式推理）
*   **第二步：构建多维探针网络**（进行因果、时间、空间、对比、方法、情感等多维度的联想式思考）
*   **第三步：时间感知扫描**（动态构建时间线，智能调整时间跨度）
*   **第四步：跨时空关联与综合**（连接孤立信息，归纳总结，挖掘因果，将隐性知识显性化）
*   **第五步：剪枝与聚焦**（过滤无关信息，按优先级排序，确保内容高密度）

### 输出格式与约束（极其重要！）###

**核心原则：以证据为支撑的结构化综合 (Evidence-Backed Structural Synthesis)**
你的任务是构建一个信息丰富且逻辑连贯的摘要。在综合不同来源的信息时，**必须保留原始记录中的关键细节、数据和具体结论**。你的输出应该像一份研究报告：先展示核心证据（引用或精确转述），再围绕证据进行分析和串联，而不是进行无法溯源的高度概括。

**你必须且只能输出以下格式，不得添加任何额外的解释、评论或思考过程：**

\`\`\`
这是我获取的所有相关知识/记忆[[...]]
\`\`\`

**\`[[...]]\` 内部填充规则:**

1.  **如果有相关内容**:
    *   **保留核心细节**: 在综合信息时，必须保留原始记录中的关键细节、数据、代码片段和具体结论。**优先直接引用或精确转述核心句子**，而不是进行模糊的二次概括。
    *   **叙事性组织**: 使用叙事性语言将这些保留下来的"证据块"串联起来，揭示它们之间的内在逻辑、因果关系或演进脉络。
    *   **自然分段**: 根据内容本身的逻辑结构来组织段落和标题（例如，一个项目的发展历程，一个问题的解决方案），而不是根据你的分析框架来划分。

2.  **如果确实没有相关内容**:
    *   必须明确返回：\`这是我获取的所有相关知识/记忆[[未找到相关记忆]]\`

3.  **如果知识库为空或无法访问**:
    *   返回：\`这是我获取的所有相关知识/记忆[[知识库为空]]\`

### 关键约束（再次强调）###
1.  ❌ **禁止输出思考过程**
2.  ❌ **禁止输出元信息** (如 "我找到了X条记录")
3.  ❌ **禁止编造内容**
4.  ✅ **只输出最终结果**
5.  ✅ **保持格式严格**
6.  ✅ **发挥AI优势** (展示深度关联和综合能力)
7.  ✅ **忠于知识库**: 所有输出都必须直接源自[完整知识库]中的信息。`

// ==================== AIMemoSynthesisService ====================

/**
 * AI 记忆综合服务
 *
 * 将 VCPToolBox 的 AIMemo 推理能力完整移植到 Cherry Studio
 * 支持智能缓存减少重复 LLM 调用
 */
export class AIMemoSynthesisService {
  private static instance: AIMemoSynthesisService
  private database: ReturnType<typeof createUnifiedDatabase> | null = null
  private dbPath: string
  private initialized: boolean = false

  // 内存缓存 (用于快速查询)
  private memoryCache: Map<string, CacheEntry> = new Map()
  private readonly MAX_MEMORY_CACHE_SIZE = 100

  private constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'vcp-data', 'aimemo-cache.db')
    this.initializeDatabase()
    logger.info('AIMemoSynthesisService initialized')
  }

  /**
   * 初始化数据库
   */
  private async initializeDatabase(): Promise<void> {
    if (this.initialized) return

    try {
      this.database = createUnifiedDatabase(this.dbPath)
      logger.info('AIMemo cache database initialized', { dbPath: this.dbPath })
      this.initialized = true
    } catch (error) {
      logger.warn('Failed to initialize AIMemo cache database', { error })
    }
  }

  static getInstance(): AIMemoSynthesisService {
    if (!AIMemoSynthesisService.instance) {
      AIMemoSynthesisService.instance = new AIMemoSynthesisService()
    }
    return AIMemoSynthesisService.instance
  }

  /**
   * 生成缓存键
   * 基于: 查询 + 知识内容 + 模型 + Provider
   */
  private generateCacheKey(
    context: ConversationContext,
    knowledge: KnowledgeContent[],
    modelId?: string,
    providerId?: string
  ): string {
    const keyData = {
      query: context.currentUserPrompt,
      lastResponse: context.lastAssistantResponse?.slice(0, 200),
      knowledgeHash: this.hashKnowledge(knowledge),
      modelId: modelId || 'default',
      providerId: providerId || 'default'
    }
    const hash = crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex')
    return `aimemo:${hash}`
  }

  /**
   * 对知识内容进行哈希
   */
  private hashKnowledge(knowledge: KnowledgeContent[]): string {
    const sortedContent = knowledge
      .map((k) => `${k.source}:${k.sourceName}:${k.content.slice(0, 200)}`)
      .sort()
      .join('|')
    return crypto.createHash('md5').update(sortedContent).digest('hex').slice(0, 16)
  }

  /**
   * 从缓存获取结果
   */
  private getFromCache(cacheKey: string): CacheEntry | null {
    // 先检查内存缓存
    const memCached = this.memoryCache.get(cacheKey)
    if (memCached) {
      if (new Date(memCached.expiresAt) > new Date()) {
        logger.debug('Cache hit (memory)', { cacheKey })
        return memCached
      } else {
        this.memoryCache.delete(cacheKey)
      }
    }

    // 检查数据库缓存
    if (this.database) {
      try {
        const records = (this.database as any).searchMemories({ text: cacheKey, limit: 1 }) as MemoryRecord[]
        if (records.length > 0 && records[0].metadata) {
          const entry = JSON.parse(records[0].metadata) as CacheEntry
          if (new Date(entry.expiresAt) > new Date()) {
            // 同步到内存缓存
            this.setMemoryCache(cacheKey, entry)
            logger.debug('Cache hit (database)', { cacheKey })
            return entry
          }
        }
      } catch (error) {
        logger.warn('Failed to read from cache database', { error })
      }
    }

    return null
  }

  /**
   * 保存到缓存
   */
  private saveToCache(cacheKey: string, entry: CacheEntry): void {
    // 保存到内存缓存
    this.setMemoryCache(cacheKey, entry)

    // 保存到数据库
    if (this.database) {
      try {
        const record: MemoryRecord = {
          id: cacheKey,
          content: cacheKey,
          metadata: JSON.stringify(entry),
          createdAt: entry.createdAt,
          updatedAt: new Date().toISOString()
        }
        ;(this.database as any).saveMemory(record)
        logger.debug('Saved to cache database', { cacheKey })
      } catch (error) {
        logger.warn('Failed to save to cache database', { error })
      }
    }
  }

  /**
   * 设置内存缓存 (带大小限制)
   */
  private setMemoryCache(key: string, entry: CacheEntry): void {
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      // 删除最旧的条目
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) {
        this.memoryCache.delete(firstKey)
      }
    }
    this.memoryCache.set(key, entry)
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.memoryCache.clear()
    logger.info('AIMemo cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { memoryCacheSize: number; dbPath: string } {
    return {
      memoryCacheSize: this.memoryCache.size,
      dbPath: this.dbPath
    }
  }

  /**
   * 构建用户提示词
   * 包含对话上下文 + 知识库内容 + 时间戳
   */
  private buildUserPrompt(context: ConversationContext, knowledge: KnowledgeContent[], timestamp: Date): string {
    const parts: string[] = []

    // 1. 对话上下文
    parts.push('**[当前对话上下文]**:')
    parts.push('```')
    if (context.lastAssistantResponse) {
      parts.push(`Assistant: ${context.lastAssistantResponse}`)
    }
    parts.push(`User: ${context.currentUserPrompt}`)
    parts.push('```')
    parts.push('')

    // 2. 知识库内容
    parts.push('**[完整知识库]**:')
    parts.push('```')

    if (knowledge.length === 0) {
      parts.push('（知识库为空）')
    } else {
      // 按来源分组
      const bySource = new Map<string, KnowledgeContent[]>()
      for (const k of knowledge) {
        const key = `${k.source}:${k.sourceName}`
        if (!bySource.has(key)) {
          bySource.set(key, [])
        }
        bySource.get(key)!.push(k)
      }

      // 输出每个来源的内容
      for (const [sourceKey, items] of bySource) {
        parts.push(`--- ${sourceKey} ---`)
        for (const item of items) {
          if (item.score !== undefined) {
            parts.push(`[相关度: ${(item.score * 100).toFixed(1)}%]`)
          }
          parts.push(item.content)
          parts.push('')
        }
      }
    }
    parts.push('```')
    parts.push('')

    // 3. 时间戳
    parts.push('**[当前时间戳]**:')
    parts.push('```')
    parts.push(`当前日期: ${timestamp.toLocaleDateString('zh-CN')}`)
    parts.push(`当前时间: ${timestamp.toLocaleTimeString('zh-CN')}`)
    parts.push('```')

    return parts.join('\n')
  }

  /**
   * 解析 AI 响应，提取记忆内容
   */
  private parseResponse(response: string): { content: string; hasRelevantMemory: boolean } {
    // 尝试匹配标准格式: 这是我获取的所有相关知识/记忆[[...]]
    const match = response.match(/这是我获取的所有相关知识\/记忆\[\[([\s\S]*?)\]\]/)

    if (match) {
      const content = match[1].trim()
      const hasRelevantMemory = content !== '未找到相关记忆' && content !== '知识库为空'
      return { content, hasRelevantMemory }
    }

    // 如果格式不匹配，尝试提取 [[...]] 中的内容
    const bracketMatch = response.match(/\[\[([\s\S]*?)\]\]/)
    if (bracketMatch) {
      const content = bracketMatch[1].trim()
      const hasRelevantMemory = content !== '未找到相关记忆' && content !== '知识库为空'
      return { content, hasRelevantMemory }
    }

    // 最后，使用原始响应
    const hasRelevantMemory = !response.includes('未找到') && !response.includes('为空')
    return { content: response.trim(), hasRelevantMemory }
  }

  /**
   * 执行记忆综合
   *
   * 核心方法：将知识库检索结果通过 AI 进行深度推理和综合
   * 支持智能缓存和超时控制
   */
  async synthesize(
    context: ConversationContext,
    knowledge: KnowledgeContent[],
    options?: SynthesisOptions
  ): Promise<SynthesisResult> {
    const startTime = Date.now()
    const timestamp = options?.timestamp || new Date()
    const useCache = options?.useCache !== false // 默认启用缓存
    const cacheTTL = options?.cacheTTL || 3600 // 默认 1 小时
    const timeout = options?.timeout || 30000 // 默认 30 秒

    logger.info('Starting memory synthesis', {
      promptLength: context.currentUserPrompt.length,
      knowledgeCount: knowledge.length,
      useCache
    })

    // 检查缓存
    const cacheKey = this.generateCacheKey(context, knowledge, options?.modelId, options?.providerId)
    if (useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        const durationMs = Date.now() - startTime
        logger.info('Memory synthesis cache hit', { durationMs, cacheKey })
        return {
          content: cached.content,
          hasRelevantMemory: cached.hasRelevantMemory,
          durationMs,
          sourcesUsed: knowledge.length,
          fromCache: true
        }
      }
    }

    try {
      // 构建提示词
      const systemPrompt = options?.customSystemPrompt || AIMEMO_SYSTEM_PROMPT
      const userPrompt = this.buildUserPrompt(context, knowledge, timestamp)

      // 通过 MCPBridge 调用 AI (带超时)
      const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
      const bridge = MCPBridge.getInstance()

      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Synthesis timeout')), timeout)
      })

      const synthesisPromise = bridge.generateText({
        systemPrompt,
        userPrompt,
        providerId: options?.providerId,
        modelId: options?.modelId
      })

      // 竞争执行
      const response = await Promise.race([synthesisPromise, timeoutPromise])

      // 解析响应
      const { content, hasRelevantMemory } = this.parseResponse(response)

      const durationMs = Date.now() - startTime

      // 保存到缓存
      if (useCache) {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + cacheTTL * 1000)
        const cacheEntry: CacheEntry = {
          content,
          hasRelevantMemory,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          modelId: options?.modelId,
          providerId: options?.providerId
        }
        this.saveToCache(cacheKey, cacheEntry)
      }

      logger.info('Memory synthesis completed', {
        durationMs,
        hasRelevantMemory,
        contentLength: content.length
      })

      return {
        content,
        hasRelevantMemory,
        durationMs,
        sourcesUsed: knowledge.length,
        rawKnowledge: options?.includeReasoning ? userPrompt : undefined,
        fromCache: false
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // 超时或其他错误时，回退到原始片段
      if (errorMessage.includes('timeout')) {
        logger.warn('Memory synthesis timeout, falling back to raw fragments', { durationMs })

        // 构建简单的片段汇总
        const fallbackContent = knowledge
          .slice(0, 5) // 取前 5 条
          .map((k) => k.content.slice(0, 200))
          .join('\n\n')

        return {
          content: fallbackContent || '记忆综合超时，请稍后重试',
          hasRelevantMemory: knowledge.length > 0,
          durationMs,
          sourcesUsed: Math.min(knowledge.length, 5),
          fromCache: false
        }
      }

      logger.error('Memory synthesis failed', error as Error)

      return {
        content: '记忆综合失败',
        hasRelevantMemory: false,
        durationMs,
        sourcesUsed: 0,
        fromCache: false
      }
    }
  }

  /**
   * 快速综合 - 用于实时对话
   * 使用更短的提示词和更快的响应
   */
  async quickSynthesize(
    userPrompt: string,
    knowledge: KnowledgeContent[],
    options?: Pick<SynthesisOptions, 'modelId' | 'providerId'>
  ): Promise<string> {
    const result = await this.synthesize({ currentUserPrompt: userPrompt }, knowledge, {
      ...options,
      customSystemPrompt: this.getQuickSynthesisPrompt()
    })
    return result.content
  }

  /**
   * 获取快速综合的简化提示词
   */
  private getQuickSynthesisPrompt(): string {
    return `你是一个记忆检索助手。根据用户问题和知识库内容，提取并综合最相关的信息。

规则：
1. 保留关键细节和数据
2. 按逻辑组织信息
3. 如果没有相关内容，回复"未找到相关记忆"

输出格式：这是我获取的所有相关知识/记忆[[综合后的内容]]`
  }

  /**
   * 获取系统提示词 (用于调试或自定义)
   */
  getSystemPrompt(): string {
    return AIMEMO_SYSTEM_PROMPT
  }
}

// ==================== 导出 ====================

let serviceInstance: AIMemoSynthesisService | null = null

export function getAIMemoSynthesisService(): AIMemoSynthesisService {
  if (!serviceInstance) {
    serviceInstance = AIMemoSynthesisService.getInstance()
  }
  return serviceInstance
}
