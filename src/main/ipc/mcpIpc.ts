/**
 * MCP IPC Handlers
 * MCP 协议相关的 IPC 处理器
 *
 * 包含: MCP 服务器管理、工具调用、资源获取等
 */

import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import { loggerService } from '@logger'
import mcpService from '../services/MCPService'
import DxtService from '../services/DxtService'
import { fileStorage as fileManager } from '../services/FileStorage'

const logger = loggerService.withContext('McpIpc')

export function registerMcpIpcHandlers() {
  const dxtService = new DxtService()

  // MCP server management
  ipcMain.handle(IpcChannel.Mcp_RemoveServer, mcpService.removeServer)
  ipcMain.handle(IpcChannel.Mcp_RestartServer, mcpService.restartServer)
  ipcMain.handle(IpcChannel.Mcp_StopServer, mcpService.stopServer)
  ipcMain.handle(IpcChannel.Mcp_GetServerVersion, mcpService.getServerVersion)
  ipcMain.handle(IpcChannel.Mcp_GetServerLogs, mcpService.getServerLogs)

  // MCP tools
  ipcMain.handle(IpcChannel.Mcp_ListTools, mcpService.listTools)
  ipcMain.handle(IpcChannel.Mcp_CallTool, mcpService.callTool)
  ipcMain.handle(IpcChannel.Mcp_AbortTool, mcpService.abortTool)

  // MCP prompts
  ipcMain.handle(IpcChannel.Mcp_ListPrompts, mcpService.listPrompts)
  ipcMain.handle(IpcChannel.Mcp_GetPrompt, mcpService.getPrompt)

  // MCP resources
  ipcMain.handle(IpcChannel.Mcp_ListResources, mcpService.listResources)
  ipcMain.handle(IpcChannel.Mcp_GetResource, mcpService.getResource)

  // MCP info
  ipcMain.handle(IpcChannel.Mcp_GetInstallInfo, mcpService.getInstallInfo)
  ipcMain.handle(IpcChannel.Mcp_CheckConnectivity, mcpService.checkMcpConnectivity)

  // DXT upload handler
  ipcMain.handle(IpcChannel.Mcp_UploadDxt, async (event, fileBuffer: ArrayBuffer, fileName: string) => {
    try {
      const tempPath = await fileManager.createTempFile(event, fileName)
      await fileManager.writeFile(event, tempPath, Buffer.from(fileBuffer))
      return await dxtService.uploadDxt(event, tempPath)
    } catch (error) {
      logger.error('DXT upload error:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload DXT file'
      }
    }
  })

  logger.info('MCP IPC handlers registered successfully')
}
