import { loggerService } from '@logger'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { BuiltinMCPServerName } from '@types'
import { BuiltinMCPServerNames } from '@types'

import AgentCollabServer from './agent-collab'
import BraveSearchServer from './brave-search'
import BrowserServer from './browser'
import DiaryServer from './diary-server'
import DiDiMcpServer from './didi-mcp'
import DifyKnowledgeServer from './dify-knowledge'
import FetchServer from './fetch'
import MemoryServer from './memory'
import NowledgeMemServer from './nowledge-mem'
import PythonServer from './python'
import ThinkingServer from './sequentialthinking'
import VCPRAGServer from './vcp-rag'
import WorkflowServer from './workflow'

const logger = loggerService.withContext('MCPFactory')

export function createInMemoryMCPServer(
  name: BuiltinMCPServerName,
  args: string[] = [],
  envs: Record<string, string> = {}
): Server {
  logger.debug(`[MCP] Creating in-memory MCP server: ${name} with args: ${args} and envs: ${JSON.stringify(envs)}`)
  switch (name) {
    case BuiltinMCPServerNames.memory: {
      const envPath = envs.MEMORY_FILE_PATH
      return new MemoryServer(envPath).server
    }
    case BuiltinMCPServerNames.sequentialThinking: {
      return new ThinkingServer().server
    }
    case BuiltinMCPServerNames.braveSearch: {
      return new BraveSearchServer(envs.BRAVE_API_KEY).server
    }
    case BuiltinMCPServerNames.fetch: {
      return new FetchServer().server
    }
    case BuiltinMCPServerNames.difyKnowledge: {
      const difyKey = envs.DIFY_KEY
      return new DifyKnowledgeServer(difyKey, args).server
    }
    case BuiltinMCPServerNames.python: {
      return new PythonServer().server
    }
    case BuiltinMCPServerNames.didiMCP: {
      const apiKey = envs.DIDI_API_KEY
      return new DiDiMcpServer(apiKey).server
    }
    case BuiltinMCPServerNames.browser: {
      return new BrowserServer().server
    }
    case BuiltinMCPServerNames.workflow: {
      return new WorkflowServer().server
    }
    case BuiltinMCPServerNames.vcpRag: {
      return new VCPRAGServer().server
    }
    case BuiltinMCPServerNames.agentCollab: {
      return new AgentCollabServer().server
    }
    case BuiltinMCPServerNames.diary: {
      return new DiaryServer().server
    }
    case BuiltinMCPServerNames.nowledgeMem: {
      return new NowledgeMemServer().server
    }
    default:
      throw new Error(`Unknown in-memory MCP server: ${name}`)
  }
}
