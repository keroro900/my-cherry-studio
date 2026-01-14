/**
 * VCP-RAG MCP Server
 *
 * 将 VCPToolBox 风格的 RAG 功能封装为 MCP 工具
 *
 * 提供的工具:
 * - vcp_search: VCP 风格知识库搜索
 * - vcp_wave_rag: Wave RAG 三阶段检索
 * - vcp_tag_network: 标签网络检索
 * - vcp_time_search: 时间感知搜索
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { KnowledgeSearchResult } from '@types'

import { diaryModeParser } from '../knowledge/modes/DiaryModeParser'
import type { KnowledgeBaseAccessor } from '../knowledge/modes/RetrievalStrategy'
import type { RetrievalMode } from '../knowledge/modes/types'
import { createTimeAwareSearchService } from '../knowledge/search/TimeAwareSearch'
import { getTagMemoService } from '../knowledge/tagmemo/TagMemoService'
import { createVCPSearchService, type VCPSearchConfig, type VCPSearchResult } from '../knowledge/vcp/VCPSearchService'
// WaveRAG 使用 Rust 原生实现
import { createWaveRAGEngine, waveragOps, isNativeModuleAvailable } from '../services/native'
import type { WaveRAGConfig, WaveRAGResult } from '../services/native/NativeVCPBridge'
import { mcpBridge } from './shared/MCPBridge'

const logger = loggerService.withContext('MCPServer:VCP-RAG')

// ==================== 工具参数类型定义 ====================

/** VCP 搜索参数 */
interface VCPSearchArgs {
  query: string
  knowledgeBaseId?: string
  mode?: RetrievalMode
  threshold?: number
  topK?: number
  timeAware?: boolean
  timeRange?: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'
  semanticGroups?: string[]
  tagMemo?: boolean
}

/** Wave RAG 参数 */
interface WaveRAGArgs {
  query: string
  knowledgeBaseId?: string
  lensMaxTags?: number
  expansionDepth?: number
  expansionThreshold?: number
  focusTopK?: number
}

/** 标签网络操作参数 */
interface TagNetworkArgs {
  tags: string[]
  action: 'expand' | 'related' | 'search'
  depth?: number
  threshold?: number
  knowledgeBaseId?: string
  topK?: number
}

/** 时间感知搜索参数 */
interface TimeSearchArgs {
  query: string
  knowledgeBaseId?: string
  timeRange?: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'
  startDate?: string
  endDate?: string
  timeDecay?: boolean
  topK?: number
}

/** 日记解析参数 */
interface ParseDiaryArgs {
  text: string
}

// ==================== 访问器适配器 ====================

/**
 * 创建知识库访问器适配器
 * 将 MCPBridge 的方法适配为 KnowledgeBaseAccessor 接口
 */
function createKnowledgeAccessor(knowledgeBaseId: string): KnowledgeBaseAccessor {
  return {
    async getFullContent(_knowledgeBaseName: string): Promise<string> {
      const result = await mcpBridge.searchKnowledge({
        query: '*',
        knowledgeBaseId,
        topK: 1000
      })
      return result.results?.map((r) => r.content).join('\n\n') || ''
    },

    async vectorSearch(
      _knowledgeBaseName: string,
      query: string,
      options?: { topK?: number; threshold?: number }
    ): Promise<KnowledgeSearchResult[]> {
      const result = await mcpBridge.searchKnowledge({
        query,
        knowledgeBaseId,
        topK: options?.topK || 10,
        threshold: options?.threshold
      })
      return (result.results || []).map((r) => ({
        pageContent: r.content,
        score: r.score,
        metadata: r.metadata || {}
      }))
    },

    async getMetadata(_knowledgeBaseName: string): Promise<{
      documentCount: number
      totalChunks: number
      lastUpdated?: Date
    }> {
      return {
        documentCount: 0,
        totalChunks: 0
      }
    },

    async computeRelevance(_knowledgeBaseName: string, _query: string): Promise<number> {
      return 0.5
    }
  }
}

/**
 * 检索访问器接口 (本地定义，不再依赖 WaveRAGService)
 */
interface RetrievalAccessor {
  search(query: string, topK: number): Promise<KnowledgeSearchResult[]>
}

/**
 * 创建检索访问器适配器
 * 将 MCPBridge 的方法适配为 RetrievalAccessor 接口
 */
function createRetrievalAccessor(knowledgeBaseId: string): RetrievalAccessor {
  return {
    async search(query: string, topK: number): Promise<KnowledgeSearchResult[]> {
      const result = await mcpBridge.searchKnowledge({
        query,
        knowledgeBaseId,
        topK
      })
      return (result.results || []).map((r) => ({
        pageContent: r.content,
        score: r.score,
        metadata: r.metadata || {}
      }))
    }
  }
}

// ==================== 工具定义 ====================

const VCP_RAG_TOOLS: Tool[] = [
  // 1. VCP 风格搜索
  {
    name: 'vcp_search',
    description: `VCP 风格知识库搜索。支持 4 种检索模式和多种增强功能。

检索模式:
- rag: RAG 片段检索 (默认)
- fulltext: 全文上下文注入
- threshold_rag: 阈值 RAG (相似度超阈值才检索)
- threshold_fulltext: 阈值全文 (相似度超阈值才注入)

增强功能:
- 时间感知: 支持自然语言时间表达式
- 语义组: 预定义词组加权
- TagMemo: 标签网络增强
- RRF 融合: 多源结果融合`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询。支持 VCP 日记声明语法: {{全文}}, [[RAG]], <<阈值全文>>, 《《阈值RAG》》'
        },
        knowledgeBaseId: {
          type: 'string',
          description: '知识库 ID (可选，默认使用全局知识库)'
        },
        mode: {
          type: 'string',
          enum: ['rag', 'fulltext', 'threshold_rag', 'threshold_fulltext'],
          description: '检索模式 (默认: rag)'
        },
        threshold: {
          type: 'number',
          description: '相似度阈值 0-1 (用于阈值模式)'
        },
        topK: {
          type: 'number',
          description: '返回结果数量 (默认: 10)'
        },
        timeAware: {
          type: 'boolean',
          description: '是否启用时间感知检索'
        },
        timeRange: {
          type: 'string',
          enum: ['all', 'today', 'week', 'month', 'quarter', 'year'],
          description: '时间范围过滤'
        },
        semanticGroups: {
          type: 'array',
          items: { type: 'string' },
          description: '语义组类型: color, pattern, silhouette, style, material, occasion, season'
        },
        tagMemo: {
          type: 'boolean',
          description: '是否启用 TagMemo 标签网络增强'
        }
      },
      required: ['query']
    }
  },

  // 2. Wave RAG 三阶段检索
  {
    name: 'vcp_wave_rag',
    description: `Wave RAG 三阶段检索算法。

阶段说明:
1. Lens (透镜): 初始语义聚焦，从查询提取标签
2. Expansion (扩展): 通过标签共现网络扩散
3. Focus (聚焦): 结果精排与融合

适用场景:
- 需要深度语义理解的复杂查询
- 标签丰富的知识库
- 需要召回更多相关内容`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询'
        },
        knowledgeBaseId: {
          type: 'string',
          description: '知识库 ID'
        },
        lensMaxTags: {
          type: 'number',
          description: '透镜阶段最大标签数 (默认: 10)'
        },
        expansionDepth: {
          type: 'number',
          description: '扩展阶段扩散深度 (默认: 2)'
        },
        expansionThreshold: {
          type: 'number',
          description: '扩展阶段共现阈值 (默认: 0.3)'
        },
        focusTopK: {
          type: 'number',
          description: '聚焦阶段返回数量 (默认: 10)'
        }
      },
      required: ['query']
    }
  },

  // 3. 标签网络检索
  {
    name: 'vcp_tag_network',
    description: `标签网络检索。基于 TagMemo 算法探索标签关系。

功能:
- 查找相关标签
- 获取标签共现关系
- 基于标签过滤搜索结果`,
    inputSchema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '种子标签列表'
        },
        action: {
          type: 'string',
          enum: ['expand', 'related', 'search'],
          description: '操作类型: expand(扩展), related(相关), search(搜索)'
        },
        depth: {
          type: 'number',
          description: '扩展深度 (默认: 2)'
        },
        threshold: {
          type: 'number',
          description: '相关性阈值 (默认: 0.3)'
        },
        knowledgeBaseId: {
          type: 'string',
          description: '知识库 ID (search 操作需要)'
        },
        topK: {
          type: 'number',
          description: '返回数量 (默认: 10)'
        }
      },
      required: ['tags', 'action']
    }
  },

  // 4. 时间感知搜索
  {
    name: 'vcp_time_search',
    description: `时间感知搜索。支持自然语言时间表达式。

支持的时间表达式:
- 中文: 今天, 昨天, 本周, 上周, 本月, 上月, 本季度, 今年, 去年
- 英文: today, yesterday, this week, last week, this month, etc.
- 相对时间: 3天前, 一周内, 过去30天`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询 (可包含时间表达式)'
        },
        knowledgeBaseId: {
          type: 'string',
          description: '知识库 ID'
        },
        timeRange: {
          type: 'string',
          enum: ['all', 'today', 'week', 'month', 'quarter', 'year'],
          description: '预设时间范围'
        },
        startDate: {
          type: 'string',
          description: '自定义开始日期 (ISO 格式)'
        },
        endDate: {
          type: 'string',
          description: '自定义结束日期 (ISO 格式)'
        },
        timeDecay: {
          type: 'boolean',
          description: '是否启用时间衰减权重 (默认: true)'
        },
        topK: {
          type: 'number',
          description: '返回数量 (默认: 10)'
        }
      },
      required: ['query']
    }
  },

  // 5. 解析日记声明
  {
    name: 'vcp_parse_diary',
    description: `解析 VCP 日记声明语法。

支持的语法:
- {{知识库}} - 全文注入
- [[知识库]] - RAG 片段检索
- <<知识库>> - 阈值全文
- 《《知识库》》 - 阈值 RAG

修饰符:
- ::Time - 时间感知
- ::Group - 语义组增强
- ::TagMemo0.65 - TagMemo 阈值

示例: [[时尚趋势::Time::Group]]`,
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '包含日记声明语法的文本'
        }
      },
      required: ['text']
    }
  }
]

// ==================== VCP-RAG 服务实现 ====================

/** 标签扩展结果 */
interface TagExpandResult {
  success: true
  originalTags: string[]
  expandedTags: string[]
  expansionCount: number
}

/** 相关标签结果 */
interface TagRelatedResult {
  success: true
  tags: string[]
  relatedTags: Record<string, Array<{ tag: string; strength: number }>>
}

/** 标签搜索结果 */
interface TagSearchResult {
  success: boolean
  tags?: string[]
  results?: KnowledgeSearchResult[]
  count?: number
  error?: string
}

/** 时间搜索结果 */
interface TimeSearchResult {
  success: true
  query: string
  timeRange: string
  results: KnowledgeSearchResult[]
  count: number
  filteredCount: number
}

/** 日记解析结果 */
interface DiaryParseResult {
  success: true
  original: string
  cleaned: string
  declarations: Array<{
    mode: string
    knowledgeBase: string
    modifiers: Array<{ type: string; value?: string }>
  }>
  configs: Record<string, unknown>
}

class VCPRAGServiceImpl {
  private vcpSearch = createVCPSearchService()
  private tagMemo = getTagMemoService()
  private timeAware = createTimeAwareSearchService()

  constructor() {
    logger.info('VCPRAGServiceImpl initialized')
  }

  /**
   * VCP 风格搜索
   */
  async search(args: VCPSearchArgs): Promise<VCPSearchResult> {
    const { query, knowledgeBaseId, mode, threshold, topK, timeAware, timeRange, semanticGroups, tagMemo } = args

    // 解析查询中的日记声明
    const parseResult = diaryModeParser.parse(query)
    const cleanedQuery = parseResult.cleanedText || query

    // 构建配置
    const config: VCPSearchConfig = {
      mode: mode || 'rag',
      threshold,
      topK: topK || 10,
      timeAware,
      timeRange,
      semanticGroups,
      tagMemo
    }

    // 使用适配器创建访问器
    const accessor = createKnowledgeAccessor(knowledgeBaseId || '')

    return this.vcpSearch.search(accessor, cleanedQuery, config)
  }

  /**
   * Wave RAG 搜索 - 使用 Rust 原生实现
   */
  async waveRagSearch(args: WaveRAGArgs): Promise<WaveRAGResult> {
    // 检查 Native 模块是否可用
    if (!isNativeModuleAvailable()) {
      throw new Error('WaveRAG requires native module (native-vcp) to be available')
    }

    const config: WaveRAGConfig = {
      lensMaxTags: args.lensMaxTags ?? 10,
      expansionDepth: args.expansionDepth ?? 2,
      expansionThreshold: args.expansionThreshold ?? 0.3,
      expansionMaxTags: 20,
      focusTopK: args.focusTopK ?? 10,
      focusScoreThreshold: 0.5,
      tagMemoWeight: 0.65,
      bm25Weight: 0.5,
      vectorWeight: 0.5
    }

    // 创建 Rust 原生 WaveRAG 引擎
    const waveragEngine = createWaveRAGEngine(config)

    // 使用适配器获取基础搜索结果
    const accessor = createRetrievalAccessor(args.knowledgeBaseId || '')
    const baseResults = await accessor.search(args.query, (config.focusTopK ?? 10) * 2)

    // 从查询中提取标签
    const queryTags = this.tagMemo.extractTagsFromQuery(args.query)

    // 转换为 SearchResultItem 格式
    const searchResults = baseResults.map((r, idx) => ({
      id: `result_${idx}`,
      content: r.pageContent,
      metadata: r.metadata ? JSON.stringify(r.metadata) : undefined,
      score: r.score
    }))

    // 执行 Rust 原生三阶段检索
    const result = waveragOps.search(
      waveragEngine,
      queryTags,
      searchResults, // BM25 结果
      searchResults  // 向量结果 (此处简化，实际应分开)
    )

    return result
  }

  /**
   * 标签网络操作
   */
  async tagNetworkOperation(args: TagNetworkArgs): Promise<TagExpandResult | TagRelatedResult | TagSearchResult> {
    const { tags, action, depth = 2, threshold = 0.3, topK = 10 } = args

    switch (action) {
      case 'expand': {
        // 扩展标签
        const matrix = this.tagMemo.getCooccurrenceMatrix()
        const expanded = new Set(tags)
        let current = tags

        for (let d = 0; d < depth; d++) {
          const next: string[] = []
          for (const tag of current) {
            const related = matrix.getRelatedTags(tag, 5)
            for (const r of related) {
              if (r.weight >= threshold && !expanded.has(r.tag2)) {
                expanded.add(r.tag2)
                next.push(r.tag2)
              }
            }
          }
          current = next
        }

        return {
          success: true,
          originalTags: tags,
          expandedTags: Array.from(expanded),
          expansionCount: expanded.size - tags.length
        }
      }

      case 'related': {
        // 获取相关标签
        const matrix = this.tagMemo.getCooccurrenceMatrix()
        const relatedMap: Record<string, Array<{ tag: string; strength: number }>> = {}

        for (const tag of tags) {
          relatedMap[tag] = matrix.getRelatedTags(tag, topK).map((r) => ({ tag: r.tag2, strength: r.weight }))
        }

        return {
          success: true,
          tags,
          relatedTags: relatedMap
        }
      }

      case 'search': {
        // 基于标签搜索
        if (!args.knowledgeBaseId) {
          return { success: false, error: 'knowledgeBaseId required for search' }
        }

        // 构建查询
        const query = tags.join(' ')
        const result = await mcpBridge.searchKnowledge({
          query,
          knowledgeBaseId: args.knowledgeBaseId,
          topK: topK * 2
        })

        // 映射结果到 KnowledgeSearchResult 格式
        const mappedResults: KnowledgeSearchResult[] = (result.results || []).map((r) => ({
          pageContent: r.content,
          score: r.score,
          metadata: r.metadata || {}
        }))

        // 应用标签增强
        const boosted = await this.tagMemo.applyTagBoost(query, tags, mappedResults)

        return {
          success: true,
          tags,
          results: boosted.slice(0, topK),
          count: boosted.length
        }
      }

      default:
        return { success: false, error: `Unknown action: ${action}` }
    }
  }

  /**
   * 时间感知搜索
   */
  async timeSearch(args: TimeSearchArgs): Promise<TimeSearchResult> {
    const { query, timeRange, timeDecay = true, topK = 10 } = args

    // 解析查询中的时间表达式
    const parsed = this.timeAware.parseTimeExpression(query)

    // 执行搜索
    const result = await mcpBridge.searchKnowledge({
      query,
      knowledgeBaseId: args.knowledgeBaseId || '',
      topK: topK * 2
    })

    // 确定实际的时间范围
    const effectiveTimeRange = (parsed?.range || timeRange || 'all') as
      | 'all'
      | 'today'
      | 'week'
      | 'month'
      | 'quarter'
      | 'year'

    // 应用时间过滤和衰减
    const timeConfig = {
      enabled: true,
      timeRange: { range: effectiveTimeRange },
      decayEnabled: timeDecay
    }

    // Map results to KnowledgeSearchResult format
    const mappedResults: KnowledgeSearchResult[] = (result.results || []).map((r) => ({
      pageContent: r.content || '',
      score: r.score || 0,
      metadata: r.metadata || {}
    }))
    const filtered = this.timeAware.applyTimeAwareness(mappedResults, timeConfig)

    return {
      success: true,
      query,
      timeRange: effectiveTimeRange,
      results: filtered.slice(0, topK),
      count: filtered.length,
      filteredCount: (result.results?.length || 0) - filtered.length
    }
  }

  /**
   * 解析日记声明
   */
  parseDiary(text: string): DiaryParseResult {
    const result = diaryModeParser.parse(text)
    return {
      success: true,
      original: text,
      cleaned: result.cleanedText,
      declarations: result.declarations.map((d) => ({
        mode: d.mode,
        knowledgeBase: d.knowledgeBaseName,
        modifiers: d.modifiers
      })),
      configs: Object.fromEntries(result.configs)
    }
  }
}

// ==================== MCP Server 类 ====================

/**
 * 验证工具参数
 */
function validateArgs<T>(args: unknown, requiredFields: string[]): args is T {
  if (!args || typeof args !== 'object') return false
  const obj = args as Record<string, unknown>
  return requiredFields.every((field) => field in obj)
}

class VCPRAGServer {
  public server: Server
  private service: VCPRAGServiceImpl

  constructor() {
    this.server = new Server(
      {
        name: 'vcp-rag',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.service = new VCPRAGServiceImpl()
    this.setupHandlers()
  }

  private setupHandlers(): void {
    // 工具列表
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: VCP_RAG_TOOLS
    }))

    // 工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'vcp_search': {
            if (!validateArgs<VCPSearchArgs>(args, ['query'])) {
              return { content: [{ type: 'text', text: 'Missing required field: query' }], isError: true }
            }
            const result = await this.service.search(args)
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }

          case 'vcp_wave_rag': {
            if (!validateArgs<WaveRAGArgs>(args, ['query'])) {
              return { content: [{ type: 'text', text: 'Missing required field: query' }], isError: true }
            }
            const result = await this.service.waveRagSearch(args)
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }

          case 'vcp_tag_network': {
            if (!validateArgs<TagNetworkArgs>(args, ['tags', 'action'])) {
              return { content: [{ type: 'text', text: 'Missing required fields: tags, action' }], isError: true }
            }
            const result = await this.service.tagNetworkOperation(args)
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }

          case 'vcp_time_search': {
            if (!validateArgs<TimeSearchArgs>(args, ['query'])) {
              return { content: [{ type: 'text', text: 'Missing required field: query' }], isError: true }
            }
            const result = await this.service.timeSearch(args)
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }

          case 'vcp_parse_diary': {
            if (!validateArgs<ParseDiaryArgs>(args, ['text'])) {
              return { content: [{ type: 'text', text: 'Missing required field: text' }], isError: true }
            }
            const result = this.service.parseDiary(args.text)
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }

          default:
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
        }
      } catch (error) {
        logger.error('Tool call failed', { name, error: error instanceof Error ? error.message : String(error) })
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        }
      }
    })

    logger.info('VCPRAGServer initialized', { toolCount: VCP_RAG_TOOLS.length })
  }
}

export default VCPRAGServer
