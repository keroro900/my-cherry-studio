/**
 * VCP Diary MCP Server
 *
 * Wraps diary-tools.ts as an MCP server for:
 * - diary_write: Write diary entries
 * - diary_read: Read diary content
 * - diary_edit: Edit diary entries
 * - diary_search: Search diary by tags
 * - diary_organize: AI-driven diary organization
 * - diary_inject: Generate injection text
 * - diary_stats: Get diary statistics
 */

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'

import { DIARY_TOOL_EXECUTORS, DIARY_TOOLS } from './tools/diary-tools'

const logger = loggerService.withContext('MCPServer:Diary')

class DiaryServer {
  public server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'diary-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupRequestHandlers()
    logger.info('DiaryServer initialized')
  }

  private setupRequestHandlers() {
    // List all diary tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: DIARY_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      const executor = DIARY_TOOL_EXECUTORS[name]
      if (!executor) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      }

      try {
        logger.debug(`Executing diary tool: ${name}`, { args })

        // Create a minimal context for the executor
        const context = {
          sessionId: 'mcp-session',
          userId: 'mcp-user'
        }

        const result = await executor(args || {}, context)

        // Format result for MCP
        if (result.success) {
          return {
            content: [{ type: 'text', text: result.content }]
          }
        } else {
          throw new McpError(ErrorCode.InternalError, result.content || 'Tool execution failed')
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error
        }
        logger.error(`Error executing tool ${name}:`, error as Error)
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  }
}

export default DiaryServer
