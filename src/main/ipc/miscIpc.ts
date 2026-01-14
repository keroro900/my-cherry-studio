/**
 * Misc IPC Handlers
 * 其他杂项 IPC 处理器
 *
 * 包含: System, Config, Notification, Zip, AES, Shortcuts, Export,
 *       VertexAI, Copilot, Obsidian, Nutstore, Search, Webview,
 *       Anthropic, CodeTools, OCR, OVMS, CherryAI, ClaudeCodePlugin,
 *       LocalTransfer, AgentMessage, KnowledgeBase, Python
 */

import { BrowserWindow, ipcMain, webContents } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import type { AgentPersistedMessage, OcrProvider, Shortcut, SupportedOcrFile } from '@types'
import type { LocalTransferConnectPayload } from '@shared/config/types'
import type { PluginError } from '@types'
import { loggerService } from '@logger'
import { isWin } from '@main/constant'
import { generateSignature } from '@main/integration/cherryai'
import { getBinaryPath, isBinaryExists, runInstallScript } from '@main/utils/process'
import anthropicService from '../services/AnthropicService'
import { agentMessageRepository } from '../services/agents/database'
import { PluginService } from '../services/agents/plugins/PluginService'
import CopilotService from '../services/CopilotService'
import { ConfigKeys, configManager } from '../services/ConfigManager'
import { ExportService } from '../services/ExportService'
import KnowledgeService from '../services/KnowledgeService'
import { lanTransferClientService } from '../services/lanTransfer'
import { localTransferService } from '../services/LocalTransferService'
import * as NutstoreService from '../services/NutstoreService'
import ObsidianVaultService from '../services/ObsidianVaultService'
import { ocrService } from '../services/ocr/OcrService'
import { isOvmsSupported, ovmsManager } from '../services/OvmsManager'
import { pythonService } from '../services/PythonService'
import { searchService } from '../services/SearchService'
import { registerShortcuts, unregisterAllShortcuts } from '../services/ShortcutService'
import VertexAIService from '../services/VertexAIService'
import { setOpenLinkExternal } from '../services/WebviewService'
import { autoDiscoverGitBash, getGitBashPathInfo, validateGitBashPath } from '../utils/process'
import { decrypt, encrypt } from '../utils/aes'
import { compress, decompress } from '../utils/zip'

const logger = loggerService.withContext('MiscIpc')

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function extractPluginError(error: unknown): PluginError | null {
  if (error && typeof error === 'object' && 'type' in error && typeof (error as { type: unknown }).type === 'string') {
    return error as PluginError
  }
  return null
}

export function registerMiscIpcHandlers(mainWindow: BrowserWindow) {
  const exportService = new ExportService()
  const obsidianVaultService = new ObsidianVaultService()
  const vertexAIService = VertexAIService.getInstance()
  const pluginService = PluginService.getInstance()

  // Config
  ipcMain.handle(IpcChannel.Config_Set, (_, key: string, value: any, isNotify: boolean = false) => {
    configManager.set(key, value, isNotify)
  })
  ipcMain.handle(IpcChannel.Config_Get, (_, key: string) => {
    return configManager.get(key)
  })

  // Notification
  ipcMain.handle(IpcChannel.Notification_Send, async (_, notification) => {
    const NotificationService = (await import('../services/NotificationService')).default
    const notificationService = new NotificationService()
    await notificationService.sendNotification(notification)
  })
  ipcMain.handle(IpcChannel.Notification_OnClick, (_, notification) => {
    mainWindow.webContents.send('notification-click', notification)
  })

  // Zip
  ipcMain.handle(IpcChannel.Zip_Compress, (_, text: string) => compress(text))
  ipcMain.handle(IpcChannel.Zip_Decompress, (_, text: Buffer) => decompress(text))

  // System
  ipcMain.handle(IpcChannel.System_GetDeviceType, () => {
    const { isMac, isWin } = require('@main/constant')
    return isMac ? 'mac' : isWin ? 'windows' : 'linux'
  })
  ipcMain.handle(IpcChannel.System_GetHostname, () => require('os').hostname())
  ipcMain.handle(IpcChannel.System_GetCpuName, () => require('os').cpus()[0].model)
  ipcMain.handle(IpcChannel.System_GetPath, async (_, name: string) => {
    try {
      const { app } = require('electron')
      return app.getPath(name as Parameters<typeof app.getPath>[0])
    } catch (error) {
      logger.error('Failed to get system path', { name, error })
      return null
    }
  })
  ipcMain.handle(IpcChannel.System_CheckGitBash, () => {
    if (!isWin) return true
    try {
      const bashPath = autoDiscoverGitBash()
      if (bashPath) {
        logger.info('Git Bash is available', { path: bashPath })
        return true
      }
      logger.warn('Git Bash not found')
      return false
    } catch (error) {
      logger.error('Unexpected error checking Git Bash', error as Error)
      return false
    }
  })
  ipcMain.handle(IpcChannel.System_GetGitBashPath, () => {
    if (!isWin) return null
    const customPath = configManager.get(ConfigKeys.GitBashPath) as string | undefined
    return customPath ?? null
  })
  ipcMain.handle(IpcChannel.System_GetGitBashPathInfo, () => getGitBashPathInfo())
  ipcMain.handle(IpcChannel.System_SetGitBashPath, (_, newPath: string | null) => {
    if (!isWin) return false
    if (!newPath) {
      configManager.set(ConfigKeys.GitBashPath, null)
      configManager.set(ConfigKeys.GitBashPathSource, null)
      autoDiscoverGitBash()
      return true
    }
    const validated = validateGitBashPath(newPath)
    if (!validated) return false
    configManager.set(ConfigKeys.GitBashPath, validated)
    configManager.set(ConfigKeys.GitBashPathSource, 'manual')
    return true
  })
  ipcMain.handle(IpcChannel.System_ToggleDevTools, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win && win.webContents.toggleDevTools()
  })

  // AES
  ipcMain.handle(IpcChannel.Aes_Encrypt, (_, text: string, secretKey: string, iv: string) =>
    encrypt(text, secretKey, iv)
  )
  ipcMain.handle(IpcChannel.Aes_Decrypt, (_, encryptedData: string, iv: string, secretKey: string) =>
    decrypt(encryptedData, iv, secretKey)
  )

  // Shortcuts
  ipcMain.handle(IpcChannel.Shortcuts_Update, (_, shortcuts: Shortcut[]) => {
    configManager.setShortcuts(shortcuts)
    if (mainWindow) {
      unregisterAllShortcuts()
      registerShortcuts(mainWindow)
    }
  })

  // Export
  ipcMain.handle(IpcChannel.Export_Word, exportService.exportToWord.bind(exportService))

  // KnowledgeBase
  ipcMain.handle(IpcChannel.KnowledgeBase_Create, KnowledgeService.create.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Reset, KnowledgeService.reset.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Delete, KnowledgeService.delete.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Add, KnowledgeService.add.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Remove, KnowledgeService.remove.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Search, KnowledgeService.search.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Rerank, KnowledgeService.rerank.bind(KnowledgeService))
  ipcMain.handle(IpcChannel.KnowledgeBase_Check_Quota, KnowledgeService.checkQuota.bind(KnowledgeService))

  // VertexAI
  ipcMain.handle(IpcChannel.VertexAI_GetAuthHeaders, async (_, params) => vertexAIService.getAuthHeaders(params))
  ipcMain.handle(IpcChannel.VertexAI_GetAccessToken, async (_, params) => vertexAIService.getAccessToken(params))
  ipcMain.handle(IpcChannel.VertexAI_ClearAuthCache, async (_, projectId: string, clientEmail?: string) => {
    vertexAIService.clearAuthCache(projectId, clientEmail)
  })

  // Copilot
  ipcMain.handle(IpcChannel.Copilot_GetAuthMessage, CopilotService.getAuthMessage.bind(CopilotService))
  ipcMain.handle(IpcChannel.Copilot_GetCopilotToken, CopilotService.getCopilotToken.bind(CopilotService))
  ipcMain.handle(IpcChannel.Copilot_SaveCopilotToken, CopilotService.saveCopilotToken.bind(CopilotService))
  ipcMain.handle(IpcChannel.Copilot_GetToken, CopilotService.getToken.bind(CopilotService))
  ipcMain.handle(IpcChannel.Copilot_Logout, CopilotService.logout.bind(CopilotService))
  ipcMain.handle(IpcChannel.Copilot_GetUser, CopilotService.getUser.bind(CopilotService))

  // Obsidian
  ipcMain.handle(IpcChannel.Obsidian_GetVaults, () => obsidianVaultService.getVaults())
  ipcMain.handle(IpcChannel.Obsidian_GetFiles, (_event, vaultName) =>
    obsidianVaultService.getFilesByVaultName(vaultName)
  )

  // Nutstore
  ipcMain.handle(IpcChannel.Nutstore_GetSsoUrl, NutstoreService.getNutstoreSSOUrl.bind(NutstoreService))
  ipcMain.handle(IpcChannel.Nutstore_DecryptToken, (_, token: string) => NutstoreService.decryptToken(token))
  ipcMain.handle(IpcChannel.Nutstore_GetDirectoryContents, (_, token: string, path: string) =>
    NutstoreService.getDirectoryContents(token, path)
  )

  // Search window
  ipcMain.handle(IpcChannel.SearchWindow_Open, async (_, uid: string, show?: boolean) => {
    await searchService.openSearchWindow(uid, show)
  })
  ipcMain.handle(IpcChannel.SearchWindow_Close, async (_, uid: string) => {
    await searchService.closeSearchWindow(uid)
  })
  ipcMain.handle(IpcChannel.SearchWindow_OpenUrl, async (_, uid: string, url: string) => {
    return await searchService.openUrlInSearchWindow(uid, url)
  })

  // Webview
  ipcMain.handle(IpcChannel.Webview_SetOpenLinkExternal, (_, webviewId: number, isExternal: boolean) =>
    setOpenLinkExternal(webviewId, isExternal)
  )
  ipcMain.handle(IpcChannel.Webview_SetSpellCheckEnabled, (_, webviewId: number, isEnable: boolean) => {
    const webview = webContents.fromId(webviewId)
    if (!webview) return
    webview.session.setSpellCheckerEnabled(isEnable)
  })
  ipcMain.handle(IpcChannel.Webview_PrintToPDF, async (_, webviewId: number) => {
    const { printWebviewToPDF } = await import('../services/WebviewService')
    return await printWebviewToPDF(webviewId)
  })
  ipcMain.handle(IpcChannel.Webview_SaveAsHTML, async (_, webviewId: number) => {
    const { saveWebviewAsHTML } = await import('../services/WebviewService')
    return await saveWebviewAsHTML(webviewId)
  })

  // Anthropic OAuth
  ipcMain.handle(IpcChannel.Anthropic_StartOAuthFlow, () => anthropicService.startOAuthFlow())
  ipcMain.handle(IpcChannel.Anthropic_CompleteOAuthWithCode, (_, code: string) =>
    anthropicService.completeOAuthWithCode(code)
  )
  ipcMain.handle(IpcChannel.Anthropic_CancelOAuthFlow, () => anthropicService.cancelOAuthFlow())
  ipcMain.handle(IpcChannel.Anthropic_GetAccessToken, () => anthropicService.getValidAccessToken())
  ipcMain.handle(IpcChannel.Anthropic_HasCredentials, () => anthropicService.hasCredentials())
  ipcMain.handle(IpcChannel.Anthropic_ClearCredentials, () => anthropicService.clearCredentials())

  // Python
  ipcMain.handle(
    IpcChannel.Python_Execute,
    async (_, script: string, context?: Record<string, any>, timeout?: number) => {
      return await pythonService.executeScript(script, context, timeout)
    }
  )

  // Binary management
  ipcMain.handle(IpcChannel.App_IsBinaryExist, (_, name: string) => isBinaryExists(name))
  ipcMain.handle(IpcChannel.App_GetBinaryPath, (_, name: string) => getBinaryPath(name))
  ipcMain.handle(IpcChannel.App_InstallUvBinary, () => runInstallScript('install-uv.js'))
  ipcMain.handle(IpcChannel.App_InstallBunBinary, () => runInstallScript('install-bun.js'))
  ipcMain.handle(IpcChannel.App_InstallOvmsBinary, () => runInstallScript('install-ovms.js'))

  // CodeTools
  const { codeToolsService } = require('../services/CodeToolsService')
  ipcMain.handle(IpcChannel.CodeTools_Run, codeToolsService.run)
  ipcMain.handle(IpcChannel.CodeTools_GetAvailableTerminals, () => codeToolsService.getAvailableTerminalsForPlatform())
  ipcMain.handle(IpcChannel.CodeTools_SetCustomTerminalPath, (_, terminalId: string, path: string) =>
    codeToolsService.setCustomTerminalPath(terminalId, path)
  )
  ipcMain.handle(IpcChannel.CodeTools_GetCustomTerminalPath, (_, terminalId: string) =>
    codeToolsService.getCustomTerminalPath(terminalId)
  )
  ipcMain.handle(IpcChannel.CodeTools_RemoveCustomTerminalPath, (_, terminalId: string) =>
    codeToolsService.removeCustomTerminalPath(terminalId)
  )

  // OCR
  ipcMain.handle(IpcChannel.OCR_ocr, (_, file: SupportedOcrFile, provider: OcrProvider) =>
    ocrService.ocr(file, provider)
  )
  ipcMain.handle(IpcChannel.OCR_ListProviders, () => ocrService.listProviderIds())

  // OVMS
  ipcMain.handle(IpcChannel.Ovms_IsSupported, () => isOvmsSupported)
  ipcMain.handle(IpcChannel.Ovms_AddModel, (_, modelName: string, modelId: string, modelSource: string, task: string) =>
    ovmsManager?.addModel(modelName, modelId, modelSource, task)
  )
  ipcMain.handle(IpcChannel.Ovms_StopAddModel, () => ovmsManager?.stopAddModel())
  ipcMain.handle(IpcChannel.Ovms_GetModels, () => ovmsManager?.getModels())
  ipcMain.handle(IpcChannel.Ovms_IsRunning, () => ovmsManager?.initializeOvms())
  ipcMain.handle(IpcChannel.Ovms_GetStatus, () => ovmsManager?.getOvmsStatus())
  ipcMain.handle(IpcChannel.Ovms_RunOVMS, () => ovmsManager?.runOvms())
  ipcMain.handle(IpcChannel.Ovms_StopOVMS, () => ovmsManager?.stopOvms())

  // CherryAI
  ipcMain.handle(IpcChannel.Cherryai_GetSignature, (_, params) => generateSignature(params))

  // Claude Code Plugins
  ipcMain.handle(IpcChannel.ClaudeCodePlugin_ListAvailable, async () => {
    try {
      const data = await pluginService.listAvailable()
      return { success: true, data }
    } catch (error) {
      const pluginError = extractPluginError(error)
      if (pluginError) {
        logger.error('Failed to list available plugins', pluginError)
        return { success: false, error: pluginError }
      }
      const err = normalizeError(error)
      logger.error('Failed to list available plugins', err)
      return { success: false, error: { type: 'TRANSACTION_FAILED', operation: 'list-available', reason: err.message } }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_Install, async (_, options) => {
    try {
      const data = await pluginService.install(options)
      return { success: true, data }
    } catch (error) {
      logger.error('Failed to install plugin', { options, error })
      return { success: false, error }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_Uninstall, async (_, options) => {
    try {
      await pluginService.uninstall(options)
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Failed to uninstall plugin', { options, error })
      return { success: false, error }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_ListInstalled, async (_, agentId: string) => {
    try {
      const data = await pluginService.listInstalled(agentId)
      return { success: true, data }
    } catch (error) {
      const pluginError = extractPluginError(error)
      if (pluginError) {
        logger.error('Failed to list installed plugins', { agentId, error: pluginError })
        return { success: false, error: pluginError }
      }
      const err = normalizeError(error)
      logger.error('Failed to list installed plugins', { agentId, error: err })
      return { success: false, error: { type: 'TRANSACTION_FAILED', operation: 'list-installed', reason: err.message } }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_InvalidateCache, async () => {
    try {
      pluginService.invalidateCache()
      return { success: true, data: undefined }
    } catch (error) {
      const pluginError = extractPluginError(error)
      if (pluginError) {
        logger.error('Failed to invalidate plugin cache', pluginError)
        return { success: false, error: pluginError }
      }
      const err = normalizeError(error)
      logger.error('Failed to invalidate plugin cache', err)
      return {
        success: false,
        error: { type: 'TRANSACTION_FAILED', operation: 'invalidate-cache', reason: err.message }
      }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_ReadContent, async (_, sourcePath: string) => {
    try {
      const data = await pluginService.readContent(sourcePath)
      return { success: true, data }
    } catch (error) {
      logger.error('Failed to read plugin content', { sourcePath, error })
      return { success: false, error }
    }
  })

  ipcMain.handle(IpcChannel.ClaudeCodePlugin_WriteContent, async (_, options) => {
    try {
      await pluginService.writeContent(options.agentId, options.filename, options.type, options.content)
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Failed to write plugin content', { options, error })
      return { success: false, error }
    }
  })

  // Local Transfer
  ipcMain.handle(IpcChannel.LocalTransfer_ListServices, () => localTransferService.getState())
  ipcMain.handle(IpcChannel.LocalTransfer_StartScan, () => localTransferService.startDiscovery({ resetList: true }))
  ipcMain.handle(IpcChannel.LocalTransfer_StopScan, () => localTransferService.stopDiscovery())
  ipcMain.handle(IpcChannel.LocalTransfer_Connect, (_, payload: LocalTransferConnectPayload) =>
    lanTransferClientService.connectAndHandshake(payload)
  )
  ipcMain.handle(IpcChannel.LocalTransfer_Disconnect, () => lanTransferClientService.disconnect())
  ipcMain.handle(IpcChannel.LocalTransfer_SendFile, (_, payload: { filePath: string }) =>
    lanTransferClientService.sendFile(payload.filePath)
  )
  ipcMain.handle(IpcChannel.LocalTransfer_CancelTransfer, () => lanTransferClientService.cancelTransfer())

  // Agent Message
  ipcMain.handle(IpcChannel.AgentMessage_PersistExchange, async (_event, payload) => {
    try {
      return await agentMessageRepository.persistExchange(payload)
    } catch (error) {
      logger.error('Failed to persist agent session messages', error as Error)
      throw error
    }
  })

  ipcMain.handle(
    IpcChannel.AgentMessage_GetHistory,
    async (_event, { sessionId }: { sessionId: string }): Promise<AgentPersistedMessage[]> => {
      try {
        return await agentMessageRepository.getSessionHistory(sessionId)
      } catch (error) {
        logger.error('Failed to get agent session history', error as Error)
        throw error
      }
    }
  )

  logger.info('Misc IPC handlers registered successfully')
}
