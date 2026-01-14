/**
 * VCP Agent Collaboration MCP Server
 *
 * Wraps agent-tools.ts as an MCP server for:
 * - Agent CRUD operations
 * - Variable and template management
 * - Agent collaboration (AgentAssistant protocol)
 * - Task distribution
 * - Knowledge sharing
 * - Collective voting
 */

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'

import { agentTools } from './tools/agent-tools'

const logger = loggerService.withContext('MCPServer:AgentCollab')

class AgentCollabServer {
  public server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'agent-collab-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupRequestHandlers()
    logger.info('AgentCollabServer initialized')
  }

  private setupRequestHandlers() {
    // List all agent tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: agentTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      const tool = agentTools.find((t) => t.name === name)
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      }

      try {
        logger.debug(`Executing agent tool: ${name}`, { args })
        const result = await tool.handler(args || {})

        // Format result for MCP
        if (typeof result === 'object') {
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        }
        return {
          content: [{ type: 'text', text: String(result) }]
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error as Error)
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  }
}

export default AgentCollabServer
