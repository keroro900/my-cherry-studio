/**
 * Nowledge Mem MCP Server
 *
 * 内置记忆服务实现，提供 remember/recall 功能
 * 使用 IntegratedMemoryCoordinator 连接 Cherry Studio 统一记忆系统
 *
 * 替代外部 Nowledge Memory 服务 (https://mem.nowledge.co/)
 */

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'

const logger = loggerService.withContext('MCPServer:NowledgeMem')

// ==================== 共享映射常量 ====================

/**
 * Source 类型到后端类型的映射
 * 用于将用户友好的 source 名称转换为内部 backend 名称
 */
const SOURCE_TO_BACKEND: Record<string, 'diary' | 'memory' | 'notes'> = {
  diary: 'diary',
  conversation: 'memory',
  knowledge: 'notes',
  user_preference: 'memory'
} as const

/**
 * Source 类型到后端数组的映射
 * 用于多后端搜索时的过滤
 */
const SOURCE_TO_BACKENDS: Record<string, string[]> = {
  diary: ['diary'],
  conversation: ['memory'],
  knowledge: ['notes'],
  user_preference: ['memory'],
  all: ['diary', 'memory', 'notes']
} as const

// ==================== 延迟加载 ====================

// 延迟加载 IntegratedMemoryCoordinator 避免循环依赖
let memoryCoordinator: any = null

async function getMemoryCoordinator() {
  if (!memoryCoordinator) {
    try {
      const { getIntegratedMemoryCoordinator } = await import(
        '@main/services/memory/IntegratedMemoryCoordinator'
      )
      memoryCoordinator = getIntegratedMemoryCoordinator()
    } catch (error) {
      logger.error('Failed to load IntegratedMemoryCoordinator:', error as Error)
      throw new McpError(ErrorCode.InternalError, 'Memory system not available')
    }
  }
  return memoryCoordinator
}

/**
 * Nowledge Memory MCP Server
 * 提供 remember 和 recall 工具
 */
class NowledgeMemServer {
  public server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'nowledge-mem-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupRequestHandlers()
    logger.info('NowledgeMemServer initialized')
  }

  private setupRequestHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'remember',
            description:
              '将信息存储到记忆系统。适用于保存重要对话内容、用户偏好、学习到的知识等。支持自动标签和语义索引。',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: '要记住的内容 (必填)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '标签数组 (可选，自动补充)'
                },
                source: {
                  type: 'string',
                  enum: ['diary', 'conversation', 'knowledge', 'user_preference'],
                  description: '记忆来源类型 (默认 conversation)'
                },
                importance: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: '重要性评分 0-1 (默认 0.5)'
                },
                characterName: {
                  type: 'string',
                  description: '关联角色名称 (可选)'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'recall',
            description:
              '从记忆系统中召回相关信息。使用语义搜索找到最相关的记忆，支持 TagMemo 标签增强。',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '查询内容 (必填)'
                },
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 50,
                  description: '返回结果数量 (默认 10)'
                },
                source: {
                  type: 'string',
                  enum: ['diary', 'conversation', 'knowledge', 'user_preference', 'all'],
                  description: '过滤记忆来源 (默认 all)'
                },
                characterName: {
                  type: 'string',
                  description: '过滤关联角色 (可选)'
                },
                minScore: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: '最小相似度阈值 (默认 0.3)'
                },
                useTagMemo: {
                  type: 'boolean',
                  description: '是否启用 TagMemo 标签增强 (默认 true)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'forget',
            description: '删除特定记忆。通过 ID 或内容匹配删除。',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: '记忆 ID (优先使用)'
                },
                content: {
                  type: 'string',
                  description: '通过内容精确匹配查找并删除'
                }
              }
            }
          },
          {
            name: 'list_memories',
            description: '列出最近的记忆。用于浏览和管理记忆。',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 100,
                  description: '返回数量 (默认 20)'
                },
                source: {
                  type: 'string',
                  enum: ['diary', 'conversation', 'knowledge', 'user_preference', 'all'],
                  description: '过滤记忆来源'
                },
                characterName: {
                  type: 'string',
                  description: '过滤关联角色'
                }
              }
            }
          },
          {
            name: 'get_memory_stats',
            description: '获取记忆系统统计信息。包括记忆数量、标签分布等。',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      }
    })

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'remember':
            return await this.handleRemember(args || {})
          case 'recall':
            return await this.handleRecall(args || {})
          case 'forget':
            return await this.handleForget(args || {})
          case 'list_memories':
            return await this.handleListMemories(args || {})
          case 'get_memory_stats':
            return await this.handleGetStats()
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error
        }
        logger.error(`Error executing tool ${name}:`, error as Error)
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  }

  /**
   * 处理 remember 工具调用
   */
  private async handleRemember(args: Record<string, unknown>) {
    const content = args.content as string
    if (!content || typeof content !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'content is required and must be a string')
    }

    const coordinator = await getMemoryCoordinator()

    // 使用共享映射常量
    const backend = SOURCE_TO_BACKEND[(args.source as string) || 'conversation'] || 'memory'

    const result = await coordinator.createMemory({
      content,
      tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      backend,
      metadata: {
        importance: typeof args.importance === 'number' ? args.importance : 0.5,
        characterName: args.characterName as string | undefined,
        createdBy: 'nowledge-mem-mcp',
        originalSource: args.source || 'conversation'
      }
    })

    logger.info('Memory created via nowledge-mem', { id: result.id, tags: result.tags })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              id: result.id,
              message: '记忆已保存',
              tags: result.tags,
              timestamp: new Date().toISOString()
            },
            null,
            2
          )
        }
      ]
    }
  }

  /**
   * 处理 recall 工具调用
   */
  private async handleRecall(args: Record<string, unknown>) {
    const query = args.query as string
    if (!query || typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'query is required and must be a string')
    }

    const coordinator = await getMemoryCoordinator()

    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10
    const minScore = typeof args.minScore === 'number' ? args.minScore : 0.3
    const useTagMemo = args.useTagMemo !== false // 默认启用

    // 使用共享映射常量
    const backends = args.source ? SOURCE_TO_BACKENDS[args.source as string] : undefined

    const results = await coordinator.intelligentSearch(query, {
      topK: limit,
      threshold: minScore,
      backends: backends as any,
      applyLearning: useTagMemo,
      metadata: args.characterName ? { characterName: args.characterName } : undefined
    })

    logger.debug('Memories recalled via nowledge-mem', { query, resultCount: results.length })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              query,
              count: results.length,
              memories: results.map((r: any) => ({
                id: r.id,
                content: r.content,
                score: r.score,
                tags: r.tags || [],
                source: r.source,
                createdAt: r.createdAt
              }))
            },
            null,
            2
          )
        }
      ]
    }
  }

  /**
   * 处理 forget 工具调用
   */
  private async handleForget(args: Record<string, unknown>) {
    const id = args.id as string
    const content = args.content as string

    if (!id && !content) {
      throw new McpError(ErrorCode.InvalidParams, 'Either id or content is required')
    }

    // 注意: 当前 IntegratedMemoryCoordinator 不支持删除操作
    // 这里只是标记记忆为已忘记，实际数据仍然保留
    logger.warn('Forget operation is not fully implemented - memory will be marked but not deleted', {
      id,
      hasContent: !!content
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: '删除功能暂未实现。记忆系统当前不支持删除操作。',
              note: '请在设置中手动管理记忆数据。'
            },
            null,
            2
          )
        }
      ]
    }
  }

  /**
   * 处理 list_memories 工具调用
   */
  private async handleListMemories(args: Record<string, unknown>) {
    const coordinator = await getMemoryCoordinator()

    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 100) : 20

    // 使用共享映射常量
    const backends = args.source ? SOURCE_TO_BACKENDS[args.source as string] : undefined

    // 使用空查询获取最近记忆
    const results = await coordinator.intelligentSearch('', {
      topK: limit,
      backends: backends as any,
      metadata: args.characterName ? { characterName: args.characterName } : undefined
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: results.length,
              memories: results.map((r: any) => ({
                id: r.id,
                content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
                tags: r.tags || [],
                source: r.source,
                createdAt: r.createdAt
              }))
            },
            null,
            2
          )
        }
      ]
    }
  }

  /**
   * 处理 get_memory_stats 工具调用
   */
  private async handleGetStats() {
    const coordinator = await getMemoryCoordinator()

    let stats: any = {
      available: false
    }

    try {
      stats = await coordinator.getStats()
      stats.available = true
    } catch {
      logger.debug('Stats not available from coordinator')
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              stats: {
                totalMemories: stats.totalMemories || 'unknown',
                tagCount: stats.tagCount || 'unknown',
                sources: stats.sources || {},
                lastUpdated: new Date().toISOString()
              }
            },
            null,
            2
          )
        }
      ]
    }
  }
}

export default NowledgeMemServer
