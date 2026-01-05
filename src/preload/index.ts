import type { PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'
import { electronAPI } from '@electron-toolkit/preload'
import type { SpanEntity, TokenUsage } from '@mcp-trace/trace-core'
import type { SpanContext } from '@opentelemetry/api'
import type { GitBashPathInfo, TerminalConfig, UpgradeChannel } from '@shared/config/constant'
import type { LogLevel, LogSourceWithContext } from '@shared/config/logger'
import type {
  FileChangeEvent,
  LanClientEvent,
  LanFileCompleteMessage,
  LanHandshakeAckMessage,
  LocalTransferConnectPayload,
  LocalTransferState,
  WebviewKeyEvent
} from '@shared/config/types'
import type { MCPServerLogEntry } from '@shared/config/types'
import { IpcChannel } from '@shared/IpcChannel'
import type { Notification } from '@types'
import type {
  AddMemoryOptions,
  AssistantMessage,
  FileListResponse,
  FileMetadata,
  FileUploadResponse,
  GetApiServerStatusResult,
  KnowledgeBaseParams,
  KnowledgeItem,
  KnowledgeSearchResult,
  MCPServer,
  MemoryConfig,
  MemoryListOptions,
  MemorySearchOptions,
  OcrProvider,
  OcrResult,
  Provider,
  RestartApiServerStatusResult,
  S3Config,
  Shortcut,
  StartApiServerStatusResult,
  StopApiServerStatusResult,
  SupportedOcrFile,
  ThemeMode,
  WebDavConfig
} from '@types'
import type { OpenDialogOptions } from 'electron'
import { contextBridge, ipcRenderer, shell, webUtils } from 'electron'
import type { CreateDirectoryOptions } from 'webdav'

import type {
  InstalledPlugin,
  InstallPluginOptions,
  ListAvailablePluginsResult,
  PluginMetadata,
  PluginResult,
  UninstallPluginOptions,
  WritePluginContentOptions
} from '../renderer/src/types/plugin'
import type { ActionItem } from '../renderer/src/types/selectionTypes'

type DirectoryListOptions = {
  recursive?: boolean
  maxDepth?: number
  includeHidden?: boolean
  includeFiles?: boolean
  includeDirectories?: boolean
  maxEntries?: number
  searchPattern?: string
}

type ScanDirOptions = {
  includeFiles?: boolean
  includeDirectories?: boolean
  fileExtensions?: string[]
  ignoreHiddenFiles?: boolean
  recursive?: boolean
  maxDepth?: number
}

export function tracedInvoke(channel: string, spanContext: SpanContext | undefined, ...args: any[]) {
  if (spanContext) {
    const data = { type: 'trace', context: spanContext }
    return ipcRenderer.invoke(channel, ...args, data)
  }
  return ipcRenderer.invoke(channel, ...args)
}

// Custom APIs for renderer
const api = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.App_Info),
  getDiskInfo: (directoryPath: string): Promise<{ free: number; size: number } | null> =>
    ipcRenderer.invoke(IpcChannel.App_GetDiskInfo, directoryPath),
  reload: () => ipcRenderer.invoke(IpcChannel.App_Reload),
  quit: () => ipcRenderer.invoke(IpcChannel.App_Quit),
  setProxy: (proxy: string | undefined, bypassRules?: string) =>
    ipcRenderer.invoke(IpcChannel.App_Proxy, proxy, bypassRules),
  checkForUpdate: () => ipcRenderer.invoke(IpcChannel.App_CheckForUpdate),
  quitAndInstall: () => ipcRenderer.invoke(IpcChannel.App_QuitAndInstall),
  setLanguage: (lang: string) => ipcRenderer.invoke(IpcChannel.App_SetLanguage, lang),
  setEnableSpellCheck: (isEnable: boolean) => ipcRenderer.invoke(IpcChannel.App_SetEnableSpellCheck, isEnable),
  setSpellCheckLanguages: (languages: string[]) => ipcRenderer.invoke(IpcChannel.App_SetSpellCheckLanguages, languages),
  setLaunchOnBoot: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetLaunchOnBoot, isActive),
  setLaunchToTray: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetLaunchToTray, isActive),
  setTray: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetTray, isActive),
  setTrayOnClose: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetTrayOnClose, isActive),
  setTestPlan: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetTestPlan, isActive),
  setTestChannel: (channel: UpgradeChannel) => ipcRenderer.invoke(IpcChannel.App_SetTestChannel, channel),
  setTheme: (theme: ThemeMode) => ipcRenderer.invoke(IpcChannel.App_SetTheme, theme),
  handleZoomFactor: (delta: number, reset: boolean = false) =>
    ipcRenderer.invoke(IpcChannel.App_HandleZoomFactor, delta, reset),
  setAutoUpdate: (isActive: boolean) => ipcRenderer.invoke(IpcChannel.App_SetAutoUpdate, isActive),
  select: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke(IpcChannel.App_Select, options),
  hasWritePermission: (path: string) => ipcRenderer.invoke(IpcChannel.App_HasWritePermission, path),
  resolvePath: (path: string) => ipcRenderer.invoke(IpcChannel.App_ResolvePath, path),
  isPathInside: (childPath: string, parentPath: string) =>
    ipcRenderer.invoke(IpcChannel.App_IsPathInside, childPath, parentPath),
  setAppDataPath: (path: string) => ipcRenderer.invoke(IpcChannel.App_SetAppDataPath, path),
  getDataPathFromArgs: () => ipcRenderer.invoke(IpcChannel.App_GetDataPathFromArgs),
  copy: (oldPath: string, newPath: string, occupiedDirs: string[] = []) =>
    ipcRenderer.invoke(IpcChannel.App_Copy, oldPath, newPath, occupiedDirs),
  setStopQuitApp: (stop: boolean, reason: string) => ipcRenderer.invoke(IpcChannel.App_SetStopQuitApp, stop, reason),
  flushAppData: () => ipcRenderer.invoke(IpcChannel.App_FlushAppData),
  isNotEmptyDir: (path: string) => ipcRenderer.invoke(IpcChannel.App_IsNotEmptyDir, path),
  relaunchApp: (options?: Electron.RelaunchOptions) => ipcRenderer.invoke(IpcChannel.App_RelaunchApp, options),
  openWebsite: (url: string) => ipcRenderer.invoke(IpcChannel.Open_Website, url),
  getCacheSize: () => ipcRenderer.invoke(IpcChannel.App_GetCacheSize),
  clearCache: () => ipcRenderer.invoke(IpcChannel.App_ClearCache),
  logToMain: (source: LogSourceWithContext, level: LogLevel, message: string, data: any[]) =>
    ipcRenderer.invoke(IpcChannel.App_LogToMain, source, level, message, data),
  setFullScreen: (value: boolean): Promise<void> => ipcRenderer.invoke(IpcChannel.App_SetFullScreen, value),
  isFullScreen: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.App_IsFullScreen),
  getSystemFonts: (): Promise<string[]> => ipcRenderer.invoke(IpcChannel.App_GetSystemFonts),
  mockCrashRenderProcess: () => ipcRenderer.invoke(IpcChannel.APP_CrashRenderProcess),
  mac: {
    isProcessTrusted: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.App_MacIsProcessTrusted),
    requestProcessTrust: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.App_MacRequestProcessTrust)
  },
  notification: {
    send: (notification: Notification) => ipcRenderer.invoke(IpcChannel.Notification_Send, notification)
  },
  system: {
    getDeviceType: () => ipcRenderer.invoke(IpcChannel.System_GetDeviceType),
    getHostname: () => ipcRenderer.invoke(IpcChannel.System_GetHostname),
    getCpuName: () => ipcRenderer.invoke(IpcChannel.System_GetCpuName),
    checkGitBash: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.System_CheckGitBash),
    getGitBashPath: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.System_GetGitBashPath),
    getGitBashPathInfo: (): Promise<GitBashPathInfo> => ipcRenderer.invoke(IpcChannel.System_GetGitBashPathInfo),
    setGitBashPath: (newPath: string | null): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannel.System_SetGitBashPath, newPath),
    getPath: (name: string): Promise<string | null> => ipcRenderer.invoke(IpcChannel.System_GetPath, name)
  },
  devTools: {
    toggle: () => ipcRenderer.invoke(IpcChannel.System_ToggleDevTools)
  },
  zip: {
    compress: (text: string) => ipcRenderer.invoke(IpcChannel.Zip_Compress, text),
    decompress: (text: Buffer) => ipcRenderer.invoke(IpcChannel.Zip_Decompress, text)
  },
  backup: {
    backup: (filename: string, content: string, path: string, skipBackupFile: boolean) =>
      ipcRenderer.invoke(IpcChannel.Backup_Backup, filename, content, path, skipBackupFile),
    restore: (path: string) => ipcRenderer.invoke(IpcChannel.Backup_Restore, path),
    backupToWebdav: (data: string, webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_BackupToWebdav, data, webdavConfig),
    restoreFromWebdav: (webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_RestoreFromWebdav, webdavConfig),
    listWebdavFiles: (webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_ListWebdavFiles, webdavConfig),
    checkConnection: (webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_CheckConnection, webdavConfig),
    createDirectory: (webdavConfig: WebDavConfig, path: string, options?: CreateDirectoryOptions) =>
      ipcRenderer.invoke(IpcChannel.Backup_CreateDirectory, webdavConfig, path, options),
    deleteWebdavFile: (fileName: string, webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_DeleteWebdavFile, fileName, webdavConfig),
    backupToLocalDir: (
      data: string,
      fileName: string,
      localConfig: { localBackupDir?: string; skipBackupFile?: boolean }
    ) => ipcRenderer.invoke(IpcChannel.Backup_BackupToLocalDir, data, fileName, localConfig),
    restoreFromLocalBackup: (fileName: string, localBackupDir?: string) =>
      ipcRenderer.invoke(IpcChannel.Backup_RestoreFromLocalBackup, fileName, localBackupDir),
    listLocalBackupFiles: (localBackupDir?: string) =>
      ipcRenderer.invoke(IpcChannel.Backup_ListLocalBackupFiles, localBackupDir),
    deleteLocalBackupFile: (fileName: string, localBackupDir?: string) =>
      ipcRenderer.invoke(IpcChannel.Backup_DeleteLocalBackupFile, fileName, localBackupDir),
    checkWebdavConnection: (webdavConfig: WebDavConfig) =>
      ipcRenderer.invoke(IpcChannel.Backup_CheckConnection, webdavConfig),

    backupToS3: (data: string, s3Config: S3Config) => ipcRenderer.invoke(IpcChannel.Backup_BackupToS3, data, s3Config),
    restoreFromS3: (s3Config: S3Config) => ipcRenderer.invoke(IpcChannel.Backup_RestoreFromS3, s3Config),
    listS3Files: (s3Config: S3Config) => ipcRenderer.invoke(IpcChannel.Backup_ListS3Files, s3Config),
    deleteS3File: (fileName: string, s3Config: S3Config) =>
      ipcRenderer.invoke(IpcChannel.Backup_DeleteS3File, fileName, s3Config),
    checkS3Connection: (s3Config: S3Config) => ipcRenderer.invoke(IpcChannel.Backup_CheckS3Connection, s3Config),
    createLanTransferBackup: (data: string): Promise<string> =>
      ipcRenderer.invoke(IpcChannel.Backup_CreateLanTransferBackup, data),
    deleteTempBackup: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannel.Backup_DeleteTempBackup, filePath)
  },
  file: {
    select: (options?: OpenDialogOptions): Promise<FileMetadata[] | null> =>
      ipcRenderer.invoke(IpcChannel.File_Select, options),
    upload: (file: FileMetadata) => ipcRenderer.invoke(IpcChannel.File_Upload, file),
    delete: (fileId: string) => ipcRenderer.invoke(IpcChannel.File_Delete, fileId),
    deleteDir: (dirPath: string) => ipcRenderer.invoke(IpcChannel.File_DeleteDir, dirPath),
    deleteExternalFile: (filePath: string) => ipcRenderer.invoke(IpcChannel.File_DeleteExternalFile, filePath),
    deleteExternalDir: (dirPath: string) => ipcRenderer.invoke(IpcChannel.File_DeleteExternalDir, dirPath),
    move: (path: string, newPath: string) => ipcRenderer.invoke(IpcChannel.File_Move, path, newPath),
    moveDir: (dirPath: string, newDirPath: string) => ipcRenderer.invoke(IpcChannel.File_MoveDir, dirPath, newDirPath),
    rename: (path: string, newName: string) => ipcRenderer.invoke(IpcChannel.File_Rename, path, newName),
    renameDir: (dirPath: string, newName: string) => ipcRenderer.invoke(IpcChannel.File_RenameDir, dirPath, newName),
    read: (fileId: string, detectEncoding?: boolean) =>
      ipcRenderer.invoke(IpcChannel.File_Read, fileId, detectEncoding),
    readExternal: (filePath: string, detectEncoding?: boolean) =>
      ipcRenderer.invoke(IpcChannel.File_ReadExternal, filePath, detectEncoding),
    clear: (spanContext?: SpanContext) => ipcRenderer.invoke(IpcChannel.File_Clear, spanContext),
    get: (filePath: string): Promise<FileMetadata | null> => ipcRenderer.invoke(IpcChannel.File_Get, filePath),
    createTempFile: (fileName: string): Promise<string> => ipcRenderer.invoke(IpcChannel.File_CreateTempFile, fileName),
    mkdir: (dirPath: string) => ipcRenderer.invoke(IpcChannel.File_Mkdir, dirPath),
    write: (filePath: string, data: Uint8Array | string) => ipcRenderer.invoke(IpcChannel.File_Write, filePath, data),
    writeWithId: (id: string, content: string) => ipcRenderer.invoke(IpcChannel.File_WriteWithId, id, content),
    open: (options?: OpenDialogOptions) => ipcRenderer.invoke(IpcChannel.File_Open, options),
    openPath: (path: string) => ipcRenderer.invoke(IpcChannel.File_OpenPath, path),
    save: (path: string, content: string | NodeJS.ArrayBufferView, options?: any) =>
      ipcRenderer.invoke(IpcChannel.File_Save, path, content, options),
    selectFolder: (options?: OpenDialogOptions): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannel.File_SelectFolder, options),
    saveImage: (name: string, data: string) => ipcRenderer.invoke(IpcChannel.File_SaveImage, name, data),
    binaryImage: (fileId: string) => ipcRenderer.invoke(IpcChannel.File_BinaryImage, fileId),
    base64Image: (fileId: string): Promise<{ mime: string; base64: string; data: string }> =>
      ipcRenderer.invoke(IpcChannel.File_Base64Image, fileId),
    saveBase64Image: (data: string) => ipcRenderer.invoke(IpcChannel.File_SaveBase64Image, data),
    savePastedImage: (imageData: Uint8Array, extension?: string) =>
      ipcRenderer.invoke(IpcChannel.File_SavePastedImage, imageData, extension),
    download: (url: string, isUseContentType?: boolean) =>
      ipcRenderer.invoke(IpcChannel.File_Download, url, isUseContentType),
    copy: (fileId: string, destPath: string) => ipcRenderer.invoke(IpcChannel.File_Copy, fileId, destPath),
    base64File: (fileId: string) => ipcRenderer.invoke(IpcChannel.File_Base64File, fileId),
    pdfInfo: (fileId: string) => ipcRenderer.invoke(IpcChannel.File_GetPdfInfo, fileId),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    openFileWithRelativePath: (file: FileMetadata) => ipcRenderer.invoke(IpcChannel.File_OpenWithRelativePath, file),
    isTextFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke(IpcChannel.File_IsTextFile, filePath),
    getDirectoryStructure: (dirPath: string) => ipcRenderer.invoke(IpcChannel.File_GetDirectoryStructure, dirPath),
    getDirectoryStructureGeneric: (dirPath: string, options?: ScanDirOptions) =>
      ipcRenderer.invoke(IpcChannel.File_GetDirectoryStructureGeneric, dirPath, options),
    listDirectory: (dirPath: string, options?: DirectoryListOptions) =>
      ipcRenderer.invoke(IpcChannel.File_ListDirectory, dirPath, options),
    checkFileName: (dirPath: string, fileName: string, isFile: boolean) =>
      ipcRenderer.invoke(IpcChannel.File_CheckFileName, dirPath, fileName, isFile),
    validateNotesDirectory: (dirPath: string) => ipcRenderer.invoke(IpcChannel.File_ValidateNotesDirectory, dirPath),
    startFileWatcher: (dirPath: string, config?: any) =>
      ipcRenderer.invoke(IpcChannel.File_StartWatcher, dirPath, config),
    stopFileWatcher: () => ipcRenderer.invoke(IpcChannel.File_StopWatcher),
    pauseFileWatcher: () => ipcRenderer.invoke(IpcChannel.File_PauseWatcher),
    resumeFileWatcher: () => ipcRenderer.invoke(IpcChannel.File_ResumeWatcher),
    batchUploadMarkdown: (filePaths: string[], targetPath: string) =>
      ipcRenderer.invoke(IpcChannel.File_BatchUploadMarkdown, filePaths, targetPath),
    onFileChange: (callback: (data: FileChangeEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => {
        if (data && typeof data === 'object') {
          callback(data)
        }
      }
      ipcRenderer.on('file-change', listener)
      return () => ipcRenderer.off('file-change', listener)
    },
    showInFolder: (path: string): Promise<void> => ipcRenderer.invoke(IpcChannel.File_ShowInFolder, path)
  },
  fs: {
    read: (pathOrUrl: string, encoding?: BufferEncoding) => ipcRenderer.invoke(IpcChannel.Fs_Read, pathOrUrl, encoding),
    readText: (pathOrUrl: string): Promise<string> => ipcRenderer.invoke(IpcChannel.Fs_ReadText, pathOrUrl),
    /**
     * 读取本地文件并返回 base64 字符串
     * 支持：Windows 路径 (C:\...)、UNC 路径 (\\Server\...)、Unix 路径 (/...)
     * @param filePath 本地文件路径
     * @returns base64 编码的文件内容（不含 data: 前缀）
     */
    readBase64: (filePath: string): Promise<string> => ipcRenderer.invoke(IpcChannel.Fs_ReadBase64, filePath),
    /**
     * 获取文件信息
     */
    stat: (
      filePath: string
    ): Promise<{
      size: number
      mtime: number
      ctime: number
      birthtime: number
      isDirectory: boolean
      isFile: boolean
      isSymlink: boolean
      mode: number
    } | null> => ipcRenderer.invoke(IpcChannel.Fs_Stat, filePath),
    /**
     * 检查文件是否存在
     */
    exists: (filePath: string): Promise<boolean> => ipcRenderer.invoke(IpcChannel.Fs_Exists, filePath),
    /**
     * 删除文件或目录
     */
    unlink: (filePath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Fs_Unlink, filePath),
    /**
     * 创建目录
     */
    mkdir: (dirPath: string, options?: { recursive?: boolean }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Fs_Mkdir, dirPath, options),
    /**
     * 重命名/移动文件或目录
     */
    rename: (oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Fs_Rename, oldPath, newPath)
  },
  /**
   * Shell 命令执行 API
   */
  shell: {
    /**
     * 执行 Shell 命令
     */
    execute: (
      command: string,
      options?: { cwd?: string; timeout?: number; env?: Record<string, string> }
    ): Promise<{
      success: boolean
      stdout: string
      stderr: string
      exitCode: number
      signal?: string
      pid?: number
    }> => ipcRenderer.invoke(IpcChannel.Shell_Execute, command, options),
    /**
     * 终止进程
     */
    kill: (pid: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Shell_Kill, pid),
    /**
     * 打开外部链接
     */
    openExternal: (url: string, options?: Electron.OpenExternalOptions) => shell.openExternal(url, options)
  },
  export: {
    toWord: (markdown: string, fileName: string) => ipcRenderer.invoke(IpcChannel.Export_Word, markdown, fileName)
  },
  obsidian: {
    getVaults: () => ipcRenderer.invoke(IpcChannel.Obsidian_GetVaults),
    getFolders: (vaultName: string) => ipcRenderer.invoke(IpcChannel.Obsidian_GetFiles, vaultName),
    getFiles: (vaultName: string) => ipcRenderer.invoke(IpcChannel.Obsidian_GetFiles, vaultName)
  },
  openPath: (path: string) => ipcRenderer.invoke(IpcChannel.Open_Path, path),
  shortcuts: {
    update: (shortcuts: Shortcut[]) => ipcRenderer.invoke(IpcChannel.Shortcuts_Update, shortcuts)
  },
  knowledgeBase: {
    create: (base: KnowledgeBaseParams, context?: SpanContext) =>
      tracedInvoke(IpcChannel.KnowledgeBase_Create, context, base),
    reset: (base: KnowledgeBaseParams) => ipcRenderer.invoke(IpcChannel.KnowledgeBase_Reset, base),
    delete: (id: string) => ipcRenderer.invoke(IpcChannel.KnowledgeBase_Delete, id),
    add: ({
      base,
      item,
      userId,
      forceReload = false
    }: {
      base: KnowledgeBaseParams
      item: KnowledgeItem
      userId?: string
      forceReload?: boolean
    }) => ipcRenderer.invoke(IpcChannel.KnowledgeBase_Add, { base, item, forceReload, userId }),
    remove: ({ uniqueId, uniqueIds, base }: { uniqueId: string; uniqueIds: string[]; base: KnowledgeBaseParams }) =>
      ipcRenderer.invoke(IpcChannel.KnowledgeBase_Remove, { uniqueId, uniqueIds, base }),
    search: ({ search, base }: { search: string; base: KnowledgeBaseParams }, context?: SpanContext) =>
      tracedInvoke(IpcChannel.KnowledgeBase_Search, context, { search, base }),
    rerank: (
      { search, base, results }: { search: string; base: KnowledgeBaseParams; results: KnowledgeSearchResult[] },
      context?: SpanContext
    ) => tracedInvoke(IpcChannel.KnowledgeBase_Rerank, context, { search, base, results }),
    checkQuota: ({ base, userId }: { base: KnowledgeBaseParams; userId: string }) =>
      ipcRenderer.invoke(IpcChannel.KnowledgeBase_Check_Quota, base, userId)
  },
  memory: {
    add: (messages: string | AssistantMessage[], options?: AddMemoryOptions) =>
      ipcRenderer.invoke(IpcChannel.Memory_Add, messages, options),
    search: (query: string, options: MemorySearchOptions) =>
      ipcRenderer.invoke(IpcChannel.Memory_Search, query, options),
    list: (options?: MemoryListOptions) => ipcRenderer.invoke(IpcChannel.Memory_List, options),
    delete: (id: string) => ipcRenderer.invoke(IpcChannel.Memory_Delete, id),
    update: (id: string, memory: string, metadata?: Record<string, any>) =>
      ipcRenderer.invoke(IpcChannel.Memory_Update, id, memory, metadata),
    get: (id: string) => ipcRenderer.invoke(IpcChannel.Memory_Get, id),
    setConfig: (config: MemoryConfig) => ipcRenderer.invoke(IpcChannel.Memory_SetConfig, config),
    deleteUser: (userId: string) => ipcRenderer.invoke(IpcChannel.Memory_DeleteUser, userId),
    deleteAllMemoriesForUser: (userId: string) =>
      ipcRenderer.invoke(IpcChannel.Memory_DeleteAllMemoriesForUser, userId),
    getUsersList: () => ipcRenderer.invoke(IpcChannel.Memory_GetUsersList),
    migrateMemoryDb: () => ipcRenderer.invoke(IpcChannel.Memory_MigrateMemoryDb),
    testFeatures: () => ipcRenderer.invoke(IpcChannel.Memory_TestFeatures),
    getStats: () => ipcRenderer.invoke(IpcChannel.Memory_GetStats)
  },
  advancedMemory: {
    lightMemoSearch: (params: {
      query: string
      queryEmbedding?: number[]
      config?: {
        k1?: number
        b?: number
        bm25Weight?: number
        semanticWeight?: number
        topK?: number
        threshold?: number
        quickRerank?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.AdvancedMemory_LightMemoSearch, params),
    deepMemoSearch: (params: {
      query: string
      queryEmbedding?: number[]
      config?: {
        keywordWeight?: number
        semanticWeight?: number
        initialTopK?: number
        finalTopK?: number
        threshold?: number
        rerank?: boolean
        rerankModelId?: string
      }
    }) => ipcRenderer.invoke(IpcChannel.AdvancedMemory_DeepMemoSearch, params),
    meshMemoSearch: (params: {
      queryEmbedding: number[]
      config: {
        query: string
        filters?: Array<{
          field: string
          operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'range' | 'regex' | 'any_of' | 'all_of'
          value: unknown
          ignoreCase?: boolean
        }>
        initialTopK?: number
        finalTopK?: number
        threshold?: number
        rerank?: boolean
        diversitySampling?: boolean
        diversityLambda?: number
        timeDecay?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.AdvancedMemory_MeshMemoSearch, params),
    addDocument: (params: {
      backend: 'lightmemo' | 'deepmemo' | 'meshmemo'
      document: {
        id: string
        content: string
        embedding?: number[]
        metadata?: Record<string, unknown>
      }
    }) => ipcRenderer.invoke(IpcChannel.AdvancedMemory_AddDocument, params),
    addDocuments: (params: {
      backend: 'lightmemo' | 'deepmemo' | 'meshmemo'
      documents: Array<{
        id: string
        content: string
        embedding?: number[]
        metadata?: Record<string, unknown>
      }>
    }) => ipcRenderer.invoke(IpcChannel.AdvancedMemory_AddDocuments, params),
    clear: (params: { backend: 'lightmemo' | 'deepmemo' | 'meshmemo' }) =>
      ipcRenderer.invoke(IpcChannel.AdvancedMemory_Clear, params),
    getDocumentCount: (params: { backend: 'lightmemo' | 'deepmemo' | 'meshmemo' }) =>
      ipcRenderer.invoke(IpcChannel.AdvancedMemory_GetDocumentCount, params)
  },
  // 统一记忆/知识管理 (Memory Master)
  unifiedMemory: {
    search: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'notes' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'unified'>
        topK?: number
        threshold?: number
        userId?: string
        agentId?: string
        knowledgeBaseId?: string
        diaryName?: string
        useRRF?: boolean
        rrfK?: number
        tagBoost?: number
      }
    }) => ipcRenderer.invoke(IpcChannel.UnifiedMemory_Search, params),
    getStats: () => ipcRenderer.invoke(IpcChannel.UnifiedMemory_GetStats),
    clearBackend: (params: {
      backend: 'knowledge' | 'diary' | 'notes' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'unified'
    }) => ipcRenderer.invoke(IpcChannel.UnifiedMemory_ClearBackend, params),
    getBackends: () => ipcRenderer.invoke(IpcChannel.UnifiedMemory_GetBackends)
  },
  // AIMemo - AI军团并发检索
  aimemo: {
    search: (params: {
      query: string
      sources: Array<{
        type: 'knowledge' | 'diary' | 'memory' | 'external'
        id: string
        name: string
        estimatedTokens?: number
      }>
      options?: {
        concurrency?: number
        topK?: number
        threshold?: number
        rerank?: boolean
        timeout?: number
        includeMetadata?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.AIMemo_Search, params),
    quickSearch: (params: {
      query: string
      sources: Array<{
        type: 'knowledge' | 'diary' | 'memory' | 'external'
        id: string
        name: string
        estimatedTokens?: number
      }>
      options?: {
        topK?: number
        threshold?: number
      }
    }) => ipcRenderer.invoke(IpcChannel.AIMemo_QuickSearch, params),
    deepSearch: (params: {
      query: string
      sources: Array<{
        type: 'knowledge' | 'diary' | 'memory' | 'external'
        id: string
        name: string
        estimatedTokens?: number
      }>
      options?: {
        concurrency?: number
        topK?: number
        threshold?: number
        rerank?: boolean
        timeout?: number
        includeMetadata?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.AIMemo_DeepSearch, params),
    getAgents: () => ipcRenderer.invoke(IpcChannel.AIMemo_GetAgents),
    registerAgent: (params: {
      agent: {
        id: string
        name: string
        type: 'embedding' | 'rerank' | 'generate' | 'hybrid'
        weight: number
        config?: {
          maxTokens?: number
          batchSize?: number
          timeout?: number
          modelId?: string
        }
      }
    }) => ipcRenderer.invoke(IpcChannel.AIMemo_RegisterAgent, params)
  },
  // 统一知识库服务 (Unified Knowledge Service)
  unifiedKnowledge: {
    // 统一搜索 - 跨日记、知识库、笔记的融合搜索
    search: (params: {
      query: string
      options?: {
        sources?: Array<'knowledge' | 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'notes'>
        mode?: 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'
        topK?: number
        threshold?: number
        tagBoost?: number
        tagMemoEnabled?: boolean
        timeRange?: 'all' | 'today' | 'week' | 'month' | 'year'
        useRRF?: boolean
        rrfK?: number
        useReranker?: boolean
        characterName?: string
        tags?: string[]
        knowledgeBaseId?: string
      }
    }) => ipcRenderer.invoke(IpcChannel.Knowledge_Unified_Search, params),

    // 获取可用后端列表
    getBackends: () => ipcRenderer.invoke(IpcChannel.Knowledge_Unified_GetBackends),

    // 获取后端统计信息
    getStats: () => ipcRenderer.invoke(IpcChannel.Knowledge_Unified_GetStats),

    // 初始化服务
    initialize: () => ipcRenderer.invoke(IpcChannel.Knowledge_Unified_Initialize),

    // 生成检索计划
    plan: (params: { query: string; options?: Record<string, unknown> }) =>
      ipcRenderer.invoke(IpcChannel.Knowledge_Unified_Plan, params),

    // 分析查询意图
    analyzeQuery: (params: { query: string }) => ipcRenderer.invoke(IpcChannel.Knowledge_Unified_AnalyzeQuery, params),

    // TagMemo 增强
    tagMemo: {
      boost: (params: { query: string; tags: string[]; results: unknown[] }) =>
        ipcRenderer.invoke(IpcChannel.Knowledge_TagMemo_Boost, params),
      getRelatedTags: (params: { tag: string; limit?: number }) =>
        ipcRenderer.invoke(IpcChannel.Knowledge_TagMemo_GetRelatedTags, params)
    },

    // RRF 融合
    rrf: {
      merge: (params: { inputs: unknown[]; topK?: number; config?: Record<string, unknown> }) =>
        ipcRenderer.invoke(IpcChannel.Knowledge_RRF_Merge, params),
      updateConfig: (params: { config: Record<string, unknown> }) =>
        ipcRenderer.invoke(IpcChannel.Knowledge_RRF_UpdateConfig, params)
    }
  },
  groupChat: {
    create: (config?: {
      name?: string
      speakingMode?: 'sequential' | 'random' | 'naturerandom' | 'invitation' | 'mention' | 'keyword' | 'consensus'
      hostAgentId?: string
      maxRounds?: number
      maxSpeakersPerRound?: number
      speakingCooldown?: number
      allowFreeDiscussion?: boolean
      requireConsensus?: boolean
      consensusThreshold?: number
      timeout?: number
      showThinking?: boolean
      contextSharing?: 'full' | 'partial' | 'isolated'
    }) => ipcRenderer.invoke(IpcChannel.GroupChat_Create, config),
    addAgent: (params: {
      sessionId: string
      agent: {
        id: string
        name: string
        displayName: string
        avatar?: string
        role: 'host' | 'participant' | 'observer' | 'expert' | 'moderator'
        expertise: string[]
        triggerKeywords: string[]
        systemPrompt: string
        priority: number
        lastSpoken?: string
      }
    }) => ipcRenderer.invoke(IpcChannel.GroupChat_AddAgent, params),
    addUnifiedAgent: (params: { sessionId: string; agentId: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_AddUnifiedAgent, params),
    addAgents: (params: { sessionId: string; agentIds: string[] }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_AddAgents, params),
    removeAgent: (params: { sessionId: string; agentId: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_RemoveAgent, params),
    start: (params: { sessionId: string; topic?: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_Start, params),
    end: (params: { sessionId: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_End, params),
    handleUserInput: (params: { sessionId: string; content: string; userId?: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_HandleUserInput, params),
    requestSpeak: (params: { sessionId: string; agentId: string; context: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_RequestSpeak, params),
    getState: (params: { sessionId: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_GetState, params),
    getMessages: (params: { sessionId: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_GetMessages, params),
    getAgents: (params: { sessionId: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_GetAgents, params),
    destroy: (params: { sessionId: string }) => ipcRenderer.invoke(IpcChannel.GroupChat_Destroy, params),
    listSessions: () => ipcRenderer.invoke(IpcChannel.GroupChat_ListSessions),
    adaptAssistant: (params: {
      assistant: {
        id: string
        name: string
        prompt: string
        emoji?: string
        description?: string
        model?: { id: string }
        tags?: string[]
        enableMemory?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.GroupChat_AdaptAssistant, params),
    getUnifiedAgents: () => ipcRenderer.invoke(IpcChannel.GroupChat_GetUnifiedAgents),
    interrupt: (params: { sessionId: string; agentId?: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_Interrupt, params),
    redoMessage: (params: { sessionId: string; messageId: string; agentId: string }) =>
      ipcRenderer.invoke(IpcChannel.GroupChat_RedoMessage, params),
    onEvent: (callback: (event: any) => void) => {
      const listener = (_: any, event: any) => callback(event)
      ipcRenderer.on('groupchat:event', listener)
      return () => ipcRenderer.removeListener('groupchat:event', listener)
    }
  },
  window: {
    setMinimumSize: (width: number, height: number) =>
      ipcRenderer.invoke(IpcChannel.Windows_SetMinimumSize, width, height),
    resetMinimumSize: () => ipcRenderer.invoke(IpcChannel.Windows_ResetMinimumSize),
    getSize: (): Promise<[number, number]> => ipcRenderer.invoke(IpcChannel.Windows_GetSize)
  },
  fileService: {
    upload: (provider: Provider, file: FileMetadata): Promise<FileUploadResponse> =>
      ipcRenderer.invoke(IpcChannel.FileService_Upload, provider, file),
    list: (provider: Provider): Promise<FileListResponse> => ipcRenderer.invoke(IpcChannel.FileService_List, provider),
    delete: (provider: Provider, fileId: string) => ipcRenderer.invoke(IpcChannel.FileService_Delete, provider, fileId),
    retrieve: (provider: Provider, fileId: string): Promise<FileUploadResponse> =>
      ipcRenderer.invoke(IpcChannel.FileService_Retrieve, provider, fileId)
  },
  selectionMenu: {
    action: (action: string) => ipcRenderer.invoke('selection-menu:action', action)
  },

  vertexAI: {
    getAuthHeaders: (params: { projectId: string; serviceAccount?: { privateKey: string; clientEmail: string } }) =>
      ipcRenderer.invoke(IpcChannel.VertexAI_GetAuthHeaders, params),
    getAccessToken: (params: { projectId: string; serviceAccount?: { privateKey: string; clientEmail: string } }) =>
      ipcRenderer.invoke(IpcChannel.VertexAI_GetAccessToken, params),
    clearAuthCache: (projectId: string, clientEmail?: string) =>
      ipcRenderer.invoke(IpcChannel.VertexAI_ClearAuthCache, projectId, clientEmail)
  },
  ovms: {
    addModel: (modelName: string, modelId: string, modelSource: string, task: string) =>
      ipcRenderer.invoke(IpcChannel.Ovms_AddModel, modelName, modelId, modelSource, task),
    stopAddModel: () => ipcRenderer.invoke(IpcChannel.Ovms_StopAddModel),
    getModels: () => ipcRenderer.invoke(IpcChannel.Ovms_GetModels),
    isRunning: () => ipcRenderer.invoke(IpcChannel.Ovms_IsRunning),
    getStatus: () => ipcRenderer.invoke(IpcChannel.Ovms_GetStatus),
    runOvms: () => ipcRenderer.invoke(IpcChannel.Ovms_RunOVMS),
    stopOvms: () => ipcRenderer.invoke(IpcChannel.Ovms_StopOVMS)
  },
  config: {
    set: (key: string, value: any, isNotify: boolean = false) =>
      ipcRenderer.invoke(IpcChannel.Config_Set, key, value, isNotify),
    get: (key: string) => ipcRenderer.invoke(IpcChannel.Config_Get, key)
  },
  miniWindow: {
    show: () => ipcRenderer.invoke(IpcChannel.MiniWindow_Show),
    hide: () => ipcRenderer.invoke(IpcChannel.MiniWindow_Hide),
    close: () => ipcRenderer.invoke(IpcChannel.MiniWindow_Close),
    toggle: () => ipcRenderer.invoke(IpcChannel.MiniWindow_Toggle),
    setPin: (isPinned: boolean) => ipcRenderer.invoke(IpcChannel.MiniWindow_SetPin, isPinned)
  },
  aes: {
    encrypt: (text: string, secretKey: string, iv: string) =>
      ipcRenderer.invoke(IpcChannel.Aes_Encrypt, text, secretKey, iv),
    decrypt: (encryptedData: string, iv: string, secretKey: string) =>
      ipcRenderer.invoke(IpcChannel.Aes_Decrypt, encryptedData, iv, secretKey)
  },
  mcp: {
    removeServer: (server: MCPServer) => ipcRenderer.invoke(IpcChannel.Mcp_RemoveServer, server),
    restartServer: (server: MCPServer) => ipcRenderer.invoke(IpcChannel.Mcp_RestartServer, server),
    stopServer: (server: MCPServer) => ipcRenderer.invoke(IpcChannel.Mcp_StopServer, server),
    listTools: (server: MCPServer, context?: SpanContext) => tracedInvoke(IpcChannel.Mcp_ListTools, context, server),
    callTool: (
      { server, name, args, callId }: { server: MCPServer; name: string; args: any; callId?: string },
      context?: SpanContext
    ) => tracedInvoke(IpcChannel.Mcp_CallTool, context, { server, name, args, callId }),
    listPrompts: (server: MCPServer) => ipcRenderer.invoke(IpcChannel.Mcp_ListPrompts, server),
    getPrompt: ({ server, name, args }: { server: MCPServer; name: string; args?: Record<string, any> }) =>
      ipcRenderer.invoke(IpcChannel.Mcp_GetPrompt, { server, name, args }),
    listResources: (server: MCPServer) => ipcRenderer.invoke(IpcChannel.Mcp_ListResources, server),
    getResource: ({ server, uri }: { server: MCPServer; uri: string }) =>
      ipcRenderer.invoke(IpcChannel.Mcp_GetResource, { server, uri }),
    getInstallInfo: () => ipcRenderer.invoke(IpcChannel.Mcp_GetInstallInfo),
    checkMcpConnectivity: (server: any) => ipcRenderer.invoke(IpcChannel.Mcp_CheckConnectivity, server),
    uploadDxt: async (file: File) => {
      const buffer = await file.arrayBuffer()
      return ipcRenderer.invoke(IpcChannel.Mcp_UploadDxt, buffer, file.name)
    },
    abortTool: (callId: string) => ipcRenderer.invoke(IpcChannel.Mcp_AbortTool, callId),
    getServerVersion: (server: MCPServer): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannel.Mcp_GetServerVersion, server),
    getServerLogs: (server: MCPServer): Promise<MCPServerLogEntry[]> =>
      ipcRenderer.invoke(IpcChannel.Mcp_GetServerLogs, server),
    onServerLog: (callback: (log: MCPServerLogEntry & { serverId?: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, log: MCPServerLogEntry & { serverId?: string }) => {
        callback(log)
      }
      ipcRenderer.on(IpcChannel.Mcp_ServerLog, listener)
      return () => ipcRenderer.off(IpcChannel.Mcp_ServerLog, listener)
    }
  },
  python: {
    execute: (script: string, context?: Record<string, any>, timeout?: number) =>
      ipcRenderer.invoke(IpcChannel.Python_Execute, script, context, timeout)
  },
  copilot: {
    getAuthMessage: (headers?: Record<string, string>) =>
      ipcRenderer.invoke(IpcChannel.Copilot_GetAuthMessage, headers),
    getCopilotToken: (device_code: string, headers?: Record<string, string>) =>
      ipcRenderer.invoke(IpcChannel.Copilot_GetCopilotToken, device_code, headers),
    saveCopilotToken: (access_token: string) => ipcRenderer.invoke(IpcChannel.Copilot_SaveCopilotToken, access_token),
    getToken: (headers?: Record<string, string>) => ipcRenderer.invoke(IpcChannel.Copilot_GetToken, headers),
    logout: () => ipcRenderer.invoke(IpcChannel.Copilot_Logout),
    getUser: (token: string) => ipcRenderer.invoke(IpcChannel.Copilot_GetUser, token)
  },
  // Binary related APIs
  isBinaryExist: (name: string) => ipcRenderer.invoke(IpcChannel.App_IsBinaryExist, name),
  getBinaryPath: (name: string) => ipcRenderer.invoke(IpcChannel.App_GetBinaryPath, name),
  installUVBinary: () => ipcRenderer.invoke(IpcChannel.App_InstallUvBinary),
  installBunBinary: () => ipcRenderer.invoke(IpcChannel.App_InstallBunBinary),
  installOvmsBinary: () => ipcRenderer.invoke(IpcChannel.App_InstallOvmsBinary),
  protocol: {
    onReceiveData: (callback: (data: { url: string; params: any }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { url: string; params: any }) => {
        callback(data)
      }
      ipcRenderer.on('protocol-data', listener)
      return () => {
        ipcRenderer.off('protocol-data', listener)
      }
    }
  },
  nutstore: {
    getSSOUrl: () => ipcRenderer.invoke(IpcChannel.Nutstore_GetSsoUrl),
    decryptToken: (token: string) => ipcRenderer.invoke(IpcChannel.Nutstore_DecryptToken, token),
    getDirectoryContents: (token: string, path: string) =>
      ipcRenderer.invoke(IpcChannel.Nutstore_GetDirectoryContents, token, path)
  },
  searchService: {
    openSearchWindow: (uid: string, show?: boolean) => ipcRenderer.invoke(IpcChannel.SearchWindow_Open, uid, show),
    closeSearchWindow: (uid: string) => ipcRenderer.invoke(IpcChannel.SearchWindow_Close, uid),
    openUrlInSearchWindow: (uid: string, url: string) => ipcRenderer.invoke(IpcChannel.SearchWindow_OpenUrl, uid, url)
  },
  webview: {
    setOpenLinkExternal: (webviewId: number, isExternal: boolean) =>
      ipcRenderer.invoke(IpcChannel.Webview_SetOpenLinkExternal, webviewId, isExternal),
    setSpellCheckEnabled: (webviewId: number, isEnable: boolean) =>
      ipcRenderer.invoke(IpcChannel.Webview_SetSpellCheckEnabled, webviewId, isEnable),
    printToPDF: (webviewId: number) => ipcRenderer.invoke(IpcChannel.Webview_PrintToPDF, webviewId),
    saveAsHTML: (webviewId: number) => ipcRenderer.invoke(IpcChannel.Webview_SaveAsHTML, webviewId),
    onFindShortcut: (callback: (payload: WebviewKeyEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: WebviewKeyEvent) => {
        callback(payload)
      }
      ipcRenderer.on(IpcChannel.Webview_SearchHotkey, listener)
      return () => {
        ipcRenderer.off(IpcChannel.Webview_SearchHotkey, listener)
      }
    }
  },
  storeSync: {
    subscribe: () => ipcRenderer.invoke(IpcChannel.StoreSync_Subscribe),
    unsubscribe: () => ipcRenderer.invoke(IpcChannel.StoreSync_Unsubscribe),
    onUpdate: (action: any) => ipcRenderer.invoke(IpcChannel.StoreSync_OnUpdate, action)
  },
  selection: {
    hideToolbar: () => ipcRenderer.invoke(IpcChannel.Selection_ToolbarHide),
    writeToClipboard: (text: string) => ipcRenderer.invoke(IpcChannel.Selection_WriteToClipboard, text),
    determineToolbarSize: (width: number, height: number) =>
      ipcRenderer.invoke(IpcChannel.Selection_ToolbarDetermineSize, width, height),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IpcChannel.Selection_SetEnabled, enabled),
    setTriggerMode: (triggerMode: string) => ipcRenderer.invoke(IpcChannel.Selection_SetTriggerMode, triggerMode),
    setFollowToolbar: (isFollowToolbar: boolean) =>
      ipcRenderer.invoke(IpcChannel.Selection_SetFollowToolbar, isFollowToolbar),
    setRemeberWinSize: (isRemeberWinSize: boolean) =>
      ipcRenderer.invoke(IpcChannel.Selection_SetRemeberWinSize, isRemeberWinSize),
    setFilterMode: (filterMode: string) => ipcRenderer.invoke(IpcChannel.Selection_SetFilterMode, filterMode),
    setFilterList: (filterList: string[]) => ipcRenderer.invoke(IpcChannel.Selection_SetFilterList, filterList),
    processAction: (actionItem: ActionItem, isFullScreen: boolean = false) =>
      ipcRenderer.invoke(IpcChannel.Selection_ProcessAction, actionItem, isFullScreen),
    closeActionWindow: () => ipcRenderer.invoke(IpcChannel.Selection_ActionWindowClose),
    minimizeActionWindow: () => ipcRenderer.invoke(IpcChannel.Selection_ActionWindowMinimize),
    pinActionWindow: (isPinned: boolean) => ipcRenderer.invoke(IpcChannel.Selection_ActionWindowPin, isPinned),
    // [Windows only] Electron bug workaround - can be removed once https://github.com/electron/electron/issues/48554 is fixed
    resizeActionWindow: (deltaX: number, deltaY: number, direction: string) =>
      ipcRenderer.invoke(IpcChannel.Selection_ActionWindowResize, deltaX, deltaY, direction)
  },
  agentTools: {
    respondToPermission: (payload: {
      requestId: string
      behavior: 'allow' | 'deny'
      updatedInput?: Record<string, unknown>
      message?: string
      updatedPermissions?: PermissionUpdate[]
    }) => ipcRenderer.invoke(IpcChannel.AgentToolPermission_Response, payload)
  },
  quoteToMainWindow: (text: string) => ipcRenderer.invoke(IpcChannel.App_QuoteToMain, text),
  setDisableHardwareAcceleration: (isDisable: boolean) =>
    ipcRenderer.invoke(IpcChannel.App_SetDisableHardwareAcceleration, isDisable),
  trace: {
    saveData: (topicId: string) => ipcRenderer.invoke(IpcChannel.TRACE_SAVE_DATA, topicId),
    getData: (topicId: string, traceId: string, modelName?: string) =>
      ipcRenderer.invoke(IpcChannel.TRACE_GET_DATA, topicId, traceId, modelName),
    saveEntity: (entity: SpanEntity) => ipcRenderer.invoke(IpcChannel.TRACE_SAVE_ENTITY, entity),
    getEntity: (spanId: string) => ipcRenderer.invoke(IpcChannel.TRACE_GET_ENTITY, spanId),
    bindTopic: (topicId: string, traceId: string) => ipcRenderer.invoke(IpcChannel.TRACE_BIND_TOPIC, topicId, traceId),
    tokenUsage: (spanId: string, usage: TokenUsage) => ipcRenderer.invoke(IpcChannel.TRACE_TOKEN_USAGE, spanId, usage),
    cleanHistory: (topicId: string, traceId: string, modelName?: string) =>
      ipcRenderer.invoke(IpcChannel.TRACE_CLEAN_HISTORY, topicId, traceId, modelName),
    cleanTopic: (topicId: string, traceId?: string) =>
      ipcRenderer.invoke(IpcChannel.TRACE_CLEAN_TOPIC, topicId, traceId),
    openWindow: (topicId: string, traceId: string, autoOpen?: boolean, modelName?: string) =>
      ipcRenderer.invoke(IpcChannel.TRACE_OPEN_WINDOW, topicId, traceId, autoOpen, modelName),
    setTraceWindowTitle: (title: string) => ipcRenderer.invoke(IpcChannel.TRACE_SET_TITLE, title),
    addEndMessage: (spanId: string, modelName: string, context: string) =>
      ipcRenderer.invoke(IpcChannel.TRACE_ADD_END_MESSAGE, spanId, modelName, context),
    cleanLocalData: () => ipcRenderer.invoke(IpcChannel.TRACE_CLEAN_LOCAL_DATA),
    addStreamMessage: (spanId: string, modelName: string, context: string, message: any) =>
      ipcRenderer.invoke(IpcChannel.TRACE_ADD_STREAM_MESSAGE, spanId, modelName, context, message)
  },
  anthropic_oauth: {
    startOAuthFlow: () => ipcRenderer.invoke(IpcChannel.Anthropic_StartOAuthFlow),
    completeOAuthWithCode: (code: string) => ipcRenderer.invoke(IpcChannel.Anthropic_CompleteOAuthWithCode, code),
    cancelOAuthFlow: () => ipcRenderer.invoke(IpcChannel.Anthropic_CancelOAuthFlow),
    getAccessToken: () => ipcRenderer.invoke(IpcChannel.Anthropic_GetAccessToken),
    hasCredentials: () => ipcRenderer.invoke(IpcChannel.Anthropic_HasCredentials),
    clearCredentials: () => ipcRenderer.invoke(IpcChannel.Anthropic_ClearCredentials)
  },
  codeTools: {
    run: (
      cliTool: string,
      model: string,
      directory: string,
      env: Record<string, string>,
      options?: { autoUpdateToLatest?: boolean; terminal?: string }
    ) => ipcRenderer.invoke(IpcChannel.CodeTools_Run, cliTool, model, directory, env, options),
    getAvailableTerminals: (): Promise<TerminalConfig[]> =>
      ipcRenderer.invoke(IpcChannel.CodeTools_GetAvailableTerminals),
    setCustomTerminalPath: (terminalId: string, path: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.CodeTools_SetCustomTerminalPath, terminalId, path),
    getCustomTerminalPath: (terminalId: string): Promise<string | undefined> =>
      ipcRenderer.invoke(IpcChannel.CodeTools_GetCustomTerminalPath, terminalId),
    removeCustomTerminalPath: (terminalId: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.CodeTools_RemoveCustomTerminalPath, terminalId)
  },
  ocr: {
    ocr: (file: SupportedOcrFile, provider: OcrProvider): Promise<OcrResult> =>
      ipcRenderer.invoke(IpcChannel.OCR_ocr, file, provider),
    listProviders: (): Promise<string[]> => ipcRenderer.invoke(IpcChannel.OCR_ListProviders)
  },
  cherryai: {
    generateSignature: (params: { method: string; path: string; query: string; body: Record<string, any> }) =>
      ipcRenderer.invoke(IpcChannel.Cherryai_GetSignature, params)
  },
  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke(IpcChannel.Windows_Minimize),
    maximize: (): Promise<void> => ipcRenderer.invoke(IpcChannel.Windows_Maximize),
    unmaximize: (): Promise<void> => ipcRenderer.invoke(IpcChannel.Windows_Unmaximize),
    close: (): Promise<void> => ipcRenderer.invoke(IpcChannel.Windows_Close),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.Windows_IsMaximized),
    onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
      const channel = IpcChannel.Windows_MaximizedChanged
      const listener = (_: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
      ipcRenderer.on(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    }
  },
  apiServer: {
    getStatus: (): Promise<GetApiServerStatusResult> => ipcRenderer.invoke(IpcChannel.ApiServer_GetStatus),
    start: (): Promise<StartApiServerStatusResult> => ipcRenderer.invoke(IpcChannel.ApiServer_Start),
    restart: (): Promise<RestartApiServerStatusResult> => ipcRenderer.invoke(IpcChannel.ApiServer_Restart),
    stop: (): Promise<StopApiServerStatusResult> => ipcRenderer.invoke(IpcChannel.ApiServer_Stop),
    onReady: (callback: () => void): (() => void) => {
      const listener = () => {
        callback()
      }
      ipcRenderer.on(IpcChannel.ApiServer_Ready, listener)
      return () => {
        ipcRenderer.removeListener(IpcChannel.ApiServer_Ready, listener)
      }
    }
  },
  claudeCodePlugin: {
    listAvailable: (): Promise<PluginResult<ListAvailablePluginsResult>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_ListAvailable),
    install: (options: InstallPluginOptions): Promise<PluginResult<PluginMetadata>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_Install, options),
    uninstall: (options: UninstallPluginOptions): Promise<PluginResult<void>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_Uninstall, options),
    listInstalled: (agentId: string): Promise<PluginResult<InstalledPlugin[]>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_ListInstalled, agentId),
    invalidateCache: (): Promise<PluginResult<void>> => ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_InvalidateCache),
    readContent: (sourcePath: string): Promise<PluginResult<string>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_ReadContent, sourcePath),
    writeContent: (options: WritePluginContentOptions): Promise<PluginResult<void>> =>
      ipcRenderer.invoke(IpcChannel.ClaudeCodePlugin_WriteContent, options)
  },
  localTransfer: {
    getState: (): Promise<LocalTransferState> => ipcRenderer.invoke(IpcChannel.LocalTransfer_ListServices),
    startScan: (): Promise<LocalTransferState> => ipcRenderer.invoke(IpcChannel.LocalTransfer_StartScan),
    stopScan: (): Promise<LocalTransferState> => ipcRenderer.invoke(IpcChannel.LocalTransfer_StopScan),
    connect: (payload: LocalTransferConnectPayload): Promise<LanHandshakeAckMessage> =>
      ipcRenderer.invoke(IpcChannel.LocalTransfer_Connect, payload),
    disconnect: (): Promise<void> => ipcRenderer.invoke(IpcChannel.LocalTransfer_Disconnect),
    onServicesUpdated: (callback: (state: LocalTransferState) => void): (() => void) => {
      const channel = IpcChannel.LocalTransfer_ServicesUpdated
      const listener = (_: Electron.IpcRendererEvent, state: LocalTransferState) => callback(state)
      ipcRenderer.on(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    },
    onClientEvent: (callback: (event: LanClientEvent) => void): (() => void) => {
      const channel = IpcChannel.LocalTransfer_ClientEvent
      const listener = (_: Electron.IpcRendererEvent, event: LanClientEvent) => callback(event)
      ipcRenderer.on(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    },
    sendFile: (filePath: string): Promise<LanFileCompleteMessage> =>
      ipcRenderer.invoke(IpcChannel.LocalTransfer_SendFile, { filePath }),
    cancelTransfer: (): Promise<void> => ipcRenderer.invoke(IpcChannel.LocalTransfer_CancelTransfer)
  },
  vcpInfo: {
    getActiveSessions: () => ipcRenderer.invoke(IpcChannel.VCPInfo_GetActiveSessions),
    getRecentSessions: (limit?: number) => ipcRenderer.invoke(IpcChannel.VCPInfo_GetRecentSessions, limit),
    getSession: (sessionId: string) => ipcRenderer.invoke(IpcChannel.VCPInfo_GetSession, sessionId),
    clearSessions: () => ipcRenderer.invoke(IpcChannel.VCPInfo_ClearSessions),
    publishEvent: (event: { type: string; data?: unknown; timestamp?: number; sessionId?: string }) =>
      ipcRenderer.invoke(IpcChannel.VCPInfo_PublishEvent, event),
    subscribe: (callback: (event: unknown) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: unknown) => callback(event)
      ipcRenderer.on('vcpinfo:event', listener)
      return () => {
        ipcRenderer.removeListener('vcpinfo:event', listener)
      }
    },
    onEvent: (callback: (event: unknown) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: unknown) => callback(event)
      ipcRenderer.on('vcpinfo:event', listener)
      return () => {
        ipcRenderer.removeListener('vcpinfo:event', listener)
      }
    }
  },
  vcpLog: {
    getRecentCalls: (limit?: number) => ipcRenderer.invoke(IpcChannel.VCPLog_GetRecentCalls, limit),
    getRecentLogs: (params?: { limit?: number; level?: 'debug' | 'info' | 'warn' | 'error' }) =>
      ipcRenderer.invoke(IpcChannel.VCPLog_GetRecentLogs, params),
    getTraceCalls: (traceId: string) => ipcRenderer.invoke(IpcChannel.VCPLog_GetTraceCalls, traceId),
    getCall: (callId: string) => ipcRenderer.invoke(IpcChannel.VCPLog_GetCall, callId),
    clear: () => ipcRenderer.invoke(IpcChannel.VCPLog_Clear),
    write: (entry: {
      level: 'debug' | 'info' | 'warn' | 'error'
      source: string
      message: string
      data?: unknown
      timestamp?: number
      type?: string
    }) => ipcRenderer.invoke(IpcChannel.VCPLog_Write, entry),
    onCallUpdate: (callback: (data: { type: string; call: unknown }) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: { type: string; call: unknown }) => callback(data)
      ipcRenderer.on('vcplog:callUpdate', listener)
      return () => {
        ipcRenderer.removeListener('vcplog:callUpdate', listener)
      }
    },
    onLog: (callback: (entry: unknown) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, entry: unknown) => callback(entry)
      ipcRenderer.on('vcplog:log', listener)
      return () => {
        ipcRenderer.removeListener('vcplog:log', listener)
      }
    }
  },
  contextIntelligence: {
    // Context Purifier
    purify: (content: string, config?: unknown) => ipcRenderer.invoke(IpcChannel.Context_Purify, { content, config }),
    getPurifierConfig: () => ipcRenderer.invoke(IpcChannel.Context_Purify_GetConfig),
    updatePurifierConfig: (config: unknown) => ipcRenderer.invoke(IpcChannel.Context_Purify_UpdateConfig, config),
    // Hallucination Suppressor
    suppress: (text: string, context?: unknown, config?: unknown) =>
      ipcRenderer.invoke(IpcChannel.Context_Hallucination_Suppress, { text, context, config }),
    getSuppressorConfig: () => ipcRenderer.invoke(IpcChannel.Context_Hallucination_GetConfig),
    updateSuppressorConfig: (config: unknown) =>
      ipcRenderer.invoke(IpcChannel.Context_Hallucination_UpdateConfig, config)
  },
  flowLock: {
    // Create a topic lock
    create: (params: {
      sessionId: string
      topicContext: {
        topicId: string
        topicName: string
        keywords: string[]
        contextSnippets: string[]
        startedAt: Date
        relatedMessageIds: string[]
      }
      reason: {
        type: 'manual' | 'ai_triggered' | 'system' | 'keyword'
        description: string
        triggeredBy?: string
        confidence?: number
      }
      options?: {
        timeout?: number
        deviationThreshold?: number
        maxDeviations?: number
      }
    }) => ipcRenderer.invoke(IpcChannel.FlowLock_Create, params),
    // Get lock for session
    get: (sessionId: string) => ipcRenderer.invoke(IpcChannel.FlowLock_Get, sessionId),
    // Unlock session
    unlock: (params: { sessionId: string; reason?: string }) => ipcRenderer.invoke(IpcChannel.FlowLock_Unlock, params),
    // Extend lock timeout
    extend: (params: { sessionId: string; additionalTime: number }) =>
      ipcRenderer.invoke(IpcChannel.FlowLock_Extend, params),
    // Detect content deviation from topic
    detectDeviation: (params: { sessionId: string; content: string }) =>
      ipcRenderer.invoke(IpcChannel.FlowLock_DetectDeviation, params),
    // Check if content should trigger lock
    shouldTriggerLock: (content: string) => ipcRenderer.invoke(IpcChannel.FlowLock_ShouldTriggerLock, content),
    // Check if content should trigger unlock
    shouldTriggerUnlock: (content: string) => ipcRenderer.invoke(IpcChannel.FlowLock_ShouldTriggerUnlock, content),
    // Get all active locks
    getActiveLocks: () => ipcRenderer.invoke(IpcChannel.FlowLock_GetActiveLocks),
    // Update topic context
    updateContext: (params: {
      sessionId: string
      updates: Partial<{
        topicId: string
        topicName: string
        keywords: string[]
        contextSnippets: string[]
        relatedMessageIds: string[]
      }>
    }) => ipcRenderer.invoke(IpcChannel.FlowLock_UpdateContext, params)
  },
  // Auto Continue (自动续写/心流锁)
  autoContinue: {
    // Start auto-continue session
    start: (params: {
      agentId: string
      topicId: string
      options?: {
        customPrompt?: string
        maxRetries?: number
        maxContinues?: number
        continueDelay?: number
        startImmediately?: boolean
      }
    }) => ipcRenderer.invoke(IpcChannel.AutoContinue_Start, params),
    // Stop auto-continue session
    stop: (params: { sessionId: string; reason?: string }) => ipcRenderer.invoke(IpcChannel.AutoContinue_Stop, params),
    // Pause auto-continue session
    pause: (sessionId: string) => ipcRenderer.invoke(IpcChannel.AutoContinue_Pause, sessionId),
    // Resume auto-continue session
    resume: (sessionId: string) => ipcRenderer.invoke(IpcChannel.AutoContinue_Resume, sessionId),
    // Get session by ID
    getSession: (sessionId: string) => ipcRenderer.invoke(IpcChannel.AutoContinue_GetSession, sessionId),
    // Get all active sessions
    getActiveSessions: () => ipcRenderer.invoke(IpcChannel.AutoContinue_GetActiveSessions),
    // Notify message complete (triggers next continuation)
    onMessageComplete: (params: { agentId: string; topicId: string }) =>
      ipcRenderer.invoke(IpcChannel.AutoContinue_OnMessageComplete, params),
    // Set custom prompt for session
    setCustomPrompt: (params: { sessionId: string; prompt: string | undefined }) =>
      ipcRenderer.invoke(IpcChannel.AutoContinue_SetCustomPrompt, params),
    // Check if auto-continue is active for agent/topic
    isActive: (params: { agentId: string; topicId: string }) =>
      ipcRenderer.invoke(IpcChannel.AutoContinue_IsActive, params),
    // Listen for auto-continue trigger events
    onTrigger: (
      callback: (event: {
        sessionId: string
        agentId: string
        topicId: string
        customPrompt?: string
        continueCount: number
      }) => void
    ) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on('auto-continue:trigger', handler)
      return () => ipcRenderer.removeListener('auto-continue:trigger', handler)
    },
    // Listen for status change events
    onStatusChange: (
      callback: (event: {
        sessionId: string
        agentId: string
        topicId: string
        status: 'idle' | 'active' | 'paused' | 'processing'
        continueCount: number
        maxContinues: number
      }) => void
    ) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on('auto-continue:status-change', handler)
      return () => ipcRenderer.removeListener('auto-continue:status-change', handler)
    }
  },
  // VCP Callback Server (异步插件回调HTTP端点)
  vcpCallback: {
    // Get callback server status
    getStatus: () => ipcRenderer.invoke(IpcChannel.VCP_Callback_GetStatus),
    // Start callback server
    start: () => ipcRenderer.invoke(IpcChannel.VCP_Callback_Start),
    // Stop callback server
    stop: () => ipcRenderer.invoke(IpcChannel.VCP_Callback_Stop),
    // Get callback base URL
    getUrl: () => ipcRenderer.invoke(IpcChannel.VCP_Callback_GetUrl),
    // Listen for async callback events
    onAsyncCallback: (
      callback: (event: {
        pluginName: string
        taskId: string
        status: 'completed' | 'failed'
        result?: string
        error?: string
        timestamp: string
        metadata?: Record<string, unknown>
      }) => void
    ) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on(IpcChannel.VCP_Async_Callback, handler)
      return () => ipcRenderer.removeListener(IpcChannel.VCP_Async_Callback, handler)
    }
  },

  // ==================== VCP Plugin System (VCPToolBox 集成) ====================

  /**
   * VCP 插件管理 API
   * 用于管理 VCP 插件的生命周期
   */
  vcpPlugin: {
    // 初始化插件管理器
    initialize: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPPlugin_Initialize),

    // 获取所有插件列表
    list: (): Promise<{
      success: boolean
      data?: Array<{
        id: string
        name: string
        displayName: string
        description: string
        version: string
        type: string
        enabled: boolean
        distributed?: boolean
        serverEndpoint?: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_List),

    // 获取单个插件详情
    get: (
      pluginId: string
    ): Promise<{
      success: boolean
      data?: {
        id: string
        name: string
        displayName: string
        description: string
        version: string
        type: string
        enabled: boolean
        params: Array<{
          name: string
          description: string
          type: string
          required: boolean
        }>
        distributed?: boolean
        serverEndpoint?: string
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_Get, pluginId),

    // 启用插件
    enable: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPPlugin_Enable, pluginId),

    // 禁用插件
    disable: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPPlugin_Disable, pluginId),

    // 重新加载所有插件
    reload: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_Reload),

    // 获取插件配置（包括 configSchema 和当前值）
    getConfig: (
      pluginId: string
    ): Promise<{
      success: boolean
      data?: {
        pluginId: string
        displayName: string
        configSchema: {
          type: string
          properties: Record<
            string,
            {
              type: string
              description?: string
              default?: unknown
              enum?: string[]
            }
          >
          required?: string[]
        } | null
        defaultConfig: Record<string, unknown>
        currentConfig: Record<string, unknown>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_GetConfig, pluginId),

    // 更新插件配置
    updateConfig: (pluginId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPPlugin_UpdateConfig, pluginId, config),

    // 更新插件模型配置
    updateModelConfig: (
      pluginId: string,
      modelConfig: Record<string, unknown>
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPPlugin_UpdateModelConfig, pluginId, modelConfig),

    // 获取占位符值
    getPlaceholders: (): Promise<{
      success: boolean
      data?: Record<string, string>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_GetPlaceholders),

    // 同步 VCPToolBox 插件到本地
    sync: (
      forceSync?: boolean
    ): Promise<{
      success: boolean
      data?: {
        syncedCount: number
        skippedCount: number
        errorCount: number
        plugins: string[]
        errors: string[]
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_Sync, forceSync),

    // 获取同步状态
    getSyncStatus: (): Promise<{
      success: boolean
      data?: {
        needsSync: boolean
        syncedCount: number
        syncedPlugins: string[]
        builtinCount: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_GetSyncStatus),

    // 获取插件详情（README、系统提示词等）
    getDetails: (
      pluginId: string
    ): Promise<{
      success: boolean
      data?: {
        pluginId: string
        readme?: string
        systemPrompt?: string
        systemPromptFile?: string
        author?: string
        invocationCommands?: Array<{
          commandIdentifier: string
          description: string
          example?: string
        }>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_GetDetails, pluginId),

    // 监听插件事件
    onPluginEvent: (
      callback: (event: { type: string; pluginId: string; timestamp: string; data?: unknown }) => void
    ): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on(IpcChannel.VCPEvent_PluginRegistered, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_PluginUnregistered, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_PluginEnabled, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_PluginDisabled, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannel.VCPEvent_PluginRegistered, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_PluginUnregistered, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_PluginEnabled, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_PluginDisabled, handler)
      }
    },

    // 打开独立插件管理窗口
    openWindow: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('vcp:openPluginWindow'),

    // 关闭独立插件管理窗口
    closeWindow: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('vcp:closePluginWindow'),

    // 从自定义路径加载插件
    loadFromPath: (
      pluginPath: string
    ): Promise<{
      success: boolean
      data?: {
        id: string
        name: string
        displayName: string
        description: string
        version: string
        type: string
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_LoadFromPath, pluginPath),

    // 获取插件目录路径
    getPluginsDir: (): Promise<{
      success: boolean
      data?: {
        userDir: string
        builtinDir?: string
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPlugin_GetPluginsDir)
  },

  /**
   * VCP 预处理器管理 API
   * 用于管理消息预处理器的执行顺序
   */
  vcpPreprocessor: {
    // 获取预处理器顺序
    getOrder: (): Promise<{
      success: boolean
      data?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPreprocessor_GetOrder),

    // 设置预处理器顺序
    setOrder: (
      order: string[]
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPreprocessor_SetOrder, order),

    // 获取预处理器详情列表
    getInfo: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        displayName: string
        description: string
        enabled: boolean
        order: number
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPreprocessor_GetInfo),

    // 重新加载预处理器链
    reload: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPPreprocessor_Reload)
  },

  /**
   * VCP 工具执行 API
   * 用于执行 VCP 插件工具
   */
  vcpTool: {
    // 同步执行工具
    execute: (
      toolName: string,
      params: Record<string, string>
    ): Promise<{
      success: boolean
      output?: string
      data?: unknown
      error?: string
      executionTimeMs?: number
    }> => ipcRenderer.invoke(IpcChannel.VCPTool_Execute, toolName, params),

    // 异步执行工具 (返回 taskId)
    executeAsync: (
      toolName: string,
      params: Record<string, string>
    ): Promise<{
      success: boolean
      taskId?: string
      status?: string
      output?: string
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPTool_ExecuteAsync, toolName, params),

    // 获取异步任务状态
    getTaskStatus: (
      taskId: string
    ): Promise<{
      success: boolean
      data?: {
        status: 'pending' | 'running' | 'completed' | 'error'
        progress?: number
        result?: unknown
        error?: string
        completedAt?: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPTool_GetTaskStatus, taskId),

    // 取消异步任务
    cancelTask: (taskId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPTool_CancelTask, taskId),

    // 获取异步任务结果
    getTaskResult: (
      taskId: string
    ): Promise<{
      success: boolean
      data?: {
        success: boolean
        output?: string
        data?: unknown
        error?: string
        executionTimeMs?: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPTool_GetTaskResult, taskId),

    // 获取工具定义列表
    listDefinitions: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        displayName: string
        description: string
        params: Array<{
          name: string
          description: string
          type: string
          required: boolean
        }>
        type: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPTool_ListDefinitions),

    // 监听工具执行事件
    onToolExecution: (
      callback: (event: {
        type: 'start' | 'complete' | 'error'
        toolName: string
        timestamp: string
        result?: unknown
        error?: string
      }) => void
    ): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on(IpcChannel.VCPEvent_ToolExecutionStart, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_ToolExecutionComplete, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_ToolExecutionError, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannel.VCPEvent_ToolExecutionStart, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_ToolExecutionComplete, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_ToolExecutionError, handler)
      }
    },

    // 监听异步任务事件
    onAsyncTaskEvent: (
      callback: (event: {
        type: 'created' | 'completed' | 'timeout'
        taskId: string
        pluginName: string
        status: string
        progress?: number
        result?: unknown
        error?: string
        timestamp: string
      }) => void
    ): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on(IpcChannel.VCPEvent_AsyncTaskCreated, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_AsyncTaskCompleted, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_AsyncTaskTimeout, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannel.VCPEvent_AsyncTaskCreated, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_AsyncTaskCompleted, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_AsyncTaskTimeout, handler)
      }
    }
  },

  /**
   * VCP Agent 管理 API
   * 用于管理 VCP 代理配置
   */
  vcpAgent: {
    // 列出所有代理
    list: (): Promise<{
      success: boolean
      agents?: Array<{
        id: string
        name: string
        displayName?: string
        systemPrompt?: string
        enabled?: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_List),

    // 获取代理详情
    get: (args: {
      id: string
    }): Promise<{
      success: boolean
      agent?: {
        id: string
        name: string
        displayName?: string
        systemPrompt?: string
        enabled?: boolean
        config?: Record<string, unknown>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_Get, args),

    // 创建代理
    create: (agent: {
      name: string
      displayName?: string
      systemPrompt?: string
      config?: Record<string, unknown>
    }): Promise<{
      success: boolean
      agent?: { id: string; name: string }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_Create, agent),

    // 更新代理
    update: (args: {
      id: string
      updates: {
        name?: string
        displayName?: string
        systemPrompt?: string
        config?: Record<string, unknown>
      }
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_Update, args),

    // 删除代理
    delete: (
      id: string
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_Delete, id),

    // 激活代理
    activate: (
      id: string
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Agent_Activate, id),

    // 解析模板变量
    resolveTemplateVariables: (args: {
      text: string
      agentId: string
      context?: {
        target?: Record<string, string>
        session?: Record<string, string>
        custom?: Record<string, string>
      }
    }): Promise<string | null> => ipcRenderer.invoke(IpcChannel.VCP_Agent_ResolveTemplateVariables, args)
  },

  /**
   * VCP 上下文注入器 API
   * 用于执行上下文注入规则
   */
  vcpInjector: {
    // 列出注入规则
    listRules: (): Promise<{
      success: boolean
      rules?: Array<{
        id: string
        name: string
        pattern: string
        injection: string
        position: string
        isActive: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Injector_Rule_List),

    // 列出预设
    listPresets: (): Promise<{
      success: boolean
      presets?: Array<{
        id: string
        name: string
        description?: string
        isActive: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Injector_Preset_List),

    // 执行注入
    execute: (args: {
      text: string
      context?: Record<string, unknown>
    }): Promise<
      Array<{
        content: string
        position: string
        source: string
      }>
    > => ipcRenderer.invoke(IpcChannel.VCP_Injector_Execute, args),

    // 执行上下文规则
    executeContext: (args: {
      agentId: string
      turnCount?: number
      lastUserMessage?: string
      lastAssistantMessage?: string
      contextLength?: number
    }): Promise<
      Array<{
        content: string
        position: string
        source?: string
      }>
    > => ipcRenderer.invoke(IpcChannel.VCP_Context_Execute, args)
  },

  /**
   * VCP 占位符解析 API
   * 用于解析 VCP 占位符和异步变量
   */
  vcpPlaceholder: {
    // 解析占位符
    resolve: (
      text: string
    ): Promise<{
      success: boolean
      result?: string
      error?: string
    }> => ipcRenderer.invoke('vcp:placeholder:resolve', text),

    // 替换异步占位符
    replacePlaceholders: (text: string): Promise<string> =>
      ipcRenderer.invoke(IpcChannel.VCP_Async_ReplacePlaceholders, text)
  },

  /**
   * ShowVCP 调试 API
   * 用于 VCP 调试面板
   */
  showVcp: {
    // 获取配置
    getConfig: (): Promise<{
      enabled: boolean
      logLevel?: string
      maxHistory?: number
    } | null> => ipcRenderer.invoke(IpcChannel.ShowVCP_GetConfig),

    // 更新配置
    updateConfig: (config: {
      enabled?: boolean
      logLevel?: string
      maxHistory?: number
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.ShowVCP_UpdateConfig, config),

    // 开始会话
    startSession: (args: { agentId?: string; agentName?: string }): Promise<{ sessionId?: string } | null> =>
      ipcRenderer.invoke(IpcChannel.ShowVCP_StartSession, args),

    // 结束会话
    endSession: (): Promise<void> => ipcRenderer.invoke(IpcChannel.ShowVCP_EndSession),

    // 记录调用开始
    logCallStart: (args: {
      type: string
      name: string
      callArgs?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }): Promise<{ callId?: string } | null> => ipcRenderer.invoke(IpcChannel.ShowVCP_LogCallStart, args),

    // 记录调用结束
    logCallEnd: (args: { callId: string; result?: unknown; error?: string }): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.ShowVCP_LogCallEnd, args),

    // 记录注入
    logInjection: (args: { content: string; source?: string }): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.ShowVCP_LogInjection, args),

    // 获取当前会话
    getCurrentSession: (): Promise<{
      id: string
      startTime: string
      endTime?: string
      agentId?: string
      agentName?: string
      calls: Array<{
        id: string
        timestamp: string
        type: string
        name: string
        status: 'pending' | 'success' | 'failed'
        args?: Record<string, unknown>
        result?: unknown
        error?: string
        duration?: number
        metadata?: Record<string, unknown>
      }>
      injections: string[]
      totalDuration?: number
    } | null> => ipcRenderer.invoke(IpcChannel.ShowVCP_GetCurrentSession),

    // 获取历史会话列表
    getHistory: (
      limit?: number
    ): Promise<
      Array<{
        id: string
        startTime: string
        endTime?: string
        agentId?: string
        agentName?: string
        calls: Array<{
          id: string
          timestamp: string
          type: string
          name: string
          status: 'pending' | 'success' | 'failed'
          args?: Record<string, unknown>
          result?: unknown
          error?: string
          duration?: number
          metadata?: Record<string, unknown>
        }>
        injections: string[]
        totalDuration?: number
      }>
    > => ipcRenderer.invoke(IpcChannel.ShowVCP_GetHistory, limit),

    // 清除历史
    clearHistory: (): Promise<void> => ipcRenderer.invoke(IpcChannel.ShowVCP_ClearHistory),

    // 监听调用更新事件
    onCallUpdate: (
      callback: (callInfo: {
        id: string
        timestamp: string
        type: string
        name: string
        status: 'pending' | 'success' | 'failed'
        args?: Record<string, unknown>
        result?: unknown
        error?: string
        duration?: number
        metadata?: Record<string, unknown>
      }) => void
    ): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, callInfo: unknown) => {
        callback(callInfo as Parameters<typeof callback>[0])
      }
      ipcRenderer.on(IpcChannel.ShowVCP_CallUpdate, listener)
      return () => ipcRenderer.removeListener(IpcChannel.ShowVCP_CallUpdate, listener)
    },

    // 监听配置变更事件
    onConfigChanged: (callback: (config: { enabled: boolean }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: { enabled: boolean }) => {
        callback(config)
      }
      ipcRenderer.on(IpcChannel.ShowVCP_ConfigChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.ShowVCP_ConfigChanged, listener)
    }
  },

  /**
   * VCP 日记管理 API
   * 用于管理 VCP 日记/笔记
   */
  vcpDiary: {
    // 列出所有日记本或指定角色的日记
    list: (args?: {
      characterName?: string
      includeContent?: boolean
    }): Promise<{
      success: boolean
      books?: Array<{
        id?: string
        name: string
        description?: string
        entryCount: number
        isPublic?: boolean
        createdAt?: string
        updatedAt?: string
        summary?: string
        latestEntry?: {
          date: string
          title: string
        }
      }>
      entries?: Array<{
        id: string
        date: string
        title: string
        content: string
        tags: string[]
        isPublic?: boolean
        createdAt?: string
        updatedAt?: string
      }>
      totalEntries?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_List, args || {}),

    // 读取日记条目
    read: (args: {
      characterName?: string
      agentId?: string
      date?: string
      limit?: number
    }): Promise<{
      success: boolean
      entries?: Array<{
        id: string
        date: string
        title: string
        content: string
        tags: string[]
        createdAt?: string
        updatedAt?: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Read, args),

    // 写入日记
    write: (args: {
      characterName: string
      content: string
      title?: string
      date?: string
      tags?: string[]
    }): Promise<{
      success: boolean
      entry?: {
        id: string
        date: string
        title: string
        content: string
        tags: string[]
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Write, args),

    // 编辑日记
    edit: (args: {
      entryId: string
      content?: string
      title?: string
      tags?: string[]
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Edit, args),

    // 删除日记
    delete: (args: {
      entryId: string
    }): Promise<{
      success: boolean
      message?: string
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Delete, args),

    // 获取日记统计
    getStats: (): Promise<{
      success: boolean
      stats?: {
        bookCount: number
        entryCount: number
        publicEntryCount: number
        tagCount: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_GetStats),

    // 搜索日记
    search: (args: {
      query: string
      characterName?: string
      tags?: string[]
      dateFrom?: string
      dateTo?: string
      limit?: number
    }): Promise<{
      success: boolean
      entries?: Array<{
        id: string
        date: string
        title: string
        content: string
        tags: string[]
        score?: number
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Search, args),

    // 搜索日记并返回注入结果（用于上下文注入）
    searchWithInjections: (args: {
      text?: string
      query: string
      knowledgeBaseId?: string
      topK?: number
    }): Promise<{
      injections?: string[]
      cleanedText?: string
    }> => ipcRenderer.invoke(IpcChannel.VCP_Diary_Search, args)
  },

  /**
   * VCP 统一插件管理器 API
   * 支持 VCP + MCP 双协议
   */
  vcpUnified: {
    // 初始化统一插件管理器
    initialize: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPUnified_Initialize),

    // 获取所有插件 (统一视图)
    getAllPlugins: (): Promise<{
      success: boolean
      data?: Array<{
        id: string
        name: string
        displayName: string
        description: string
        version: string
        protocol: 'vcp' | 'mcp' | 'hybrid'
        vcpType?: string
        source: 'vcp' | 'mcp' | 'distributed'
        enabled: boolean
        serverId?: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPUnified_GetAllPlugins),

    // 按协议获取插件
    getPluginsByProtocol: (
      protocol: 'vcp' | 'mcp' | 'hybrid'
    ): Promise<{
      success: boolean
      data?: Array<{
        id: string
        name: string
        displayName: string
        description: string
        protocol: string
        enabled: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPUnified_GetPluginsByProtocol, protocol),

    // 执行工具 (自动路由到正确协议)
    executeTool: (request: {
      toolName: string
      params: Record<string, unknown>
      requestId?: string
      source?: 'vcp' | 'mcp' | 'native'
    }): Promise<{
      success: boolean
      output?: string | unknown
      error?: string
      source: 'vcp' | 'mcp' | 'native'
      taskId?: string
      executionTimeMs?: number
    }> => ipcRenderer.invoke(IpcChannel.VCPUnified_ExecuteTool, request),

    // 获取所有工具定义 (MCP 格式)
    getToolDefinitions: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        description: string
        inputSchema: {
          type: 'object'
          properties: Record<string, unknown>
          required?: string[]
        }
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPUnified_GetToolDefinitions),

    // 刷新所有插件
    refresh: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.VCPUnified_Refresh),

    // 关闭统一插件管理器
    shutdown: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.VCPUnified_Shutdown)
  },

  /**
   * MCPO Bridge API (MCP → VCP)
   * 将 MCP 工具转换为 VCP 格式
   */
  mcpoBridge: {
    // 获取已注册的 MCP 服务器列表
    getRegisteredServers: (): Promise<{ success: boolean; data?: string[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.MCPO_GetRegisteredServers),

    // 执行 MCPO 工具
    executeTool: (
      vcpName: string,
      params: Record<string, string>
    ): Promise<{
      success: boolean
      output?: string
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MCPO_ExecuteTool, vcpName, params),

    // 获取 VCP 插件定义 (从 MCP 转换)
    getVCPDefinitions: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        description: string
        params: Array<{ name: string; description: string; type: string; required: boolean }>
        type: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MCPO_GetVCPDefinitions)
  },

  /**
   * VCP Adapter API (VCP → MCP)
   * 将 VCP 插件暴露为 MCP 格式
   */
  vcpAdapter: {
    // 暴露所有 VCP 插件为 MCP 工具
    exposePlugins: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        description: string
        sourcePluginId: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPAdapter_ExposePlugins),

    // 获取 MCP 工具定义
    getToolDefinitions: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        description: string
        inputSchema: {
          type: 'object'
          properties: Record<string, unknown>
          required?: string[]
        }
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPAdapter_GetToolDefinitions),

    // 执行适配后的工具
    executeTool: (
      toolName: string,
      args: Record<string, unknown>
    ): Promise<{
      success: boolean
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPAdapter_ExecuteTool, toolName, args)
  },

  /**
   * VCP 分布式服务器 API
   */
  vcpDistributed: {
    // 注册分布式工具
    register: (
      serverId: string,
      tools: Array<{
        id: string
        name: string
        displayName: string
        description: string
        type: string
        params: Array<{ name: string; description: string; type: string; required: boolean }>
      }>
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPDistributed_Register, serverId, tools),

    // 注销分布式工具
    unregister: (serverId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPDistributed_Unregister, serverId),

    // 获取分布式服务器列表
    getServers: (): Promise<{ success: boolean; data?: string[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.VCPDistributed_GetServers),

    // 获取指定服务器的工具
    getServerTools: (
      serverId: string
    ): Promise<{
      success: boolean
      data?: Array<{
        name: string
        displayName: string
        description: string
        type: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.VCPDistributed_GetServerTools, serverId),

    // 监听分布式服务器事件
    onServerEvent: (
      callback: (event: { type: 'connected' | 'disconnected'; serverId: string; timestamp: string }) => void
    ): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data as Parameters<typeof callback>[0])
      ipcRenderer.on(IpcChannel.VCPEvent_DistributedServerConnected, handler)
      ipcRenderer.on(IpcChannel.VCPEvent_DistributedServerDisconnected, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannel.VCPEvent_DistributedServerConnected, handler)
        ipcRenderer.removeListener(IpcChannel.VCPEvent_DistributedServerDisconnected, handler)
      }
    }
  },

  /**
   * VCP 运行时配置与知识库 API
   * 用于 VCP 设置面板和知识库功能（原生实现）
   */
  vcpToolbox: {
    // ==================== 配置管理 ====================

    // 检查 VCP 运行时是否可用
    isAvailable: (): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('vcp:toolbox:is-available'),

    // 检查 VCP 运行时是否已初始化
    isInitialized: (): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('vcp:toolbox:is-initialized'),

    // 获取 VCP 运行时配置
    getConfig: (): Promise<{
      success: boolean
      data?: {
        debugMode: boolean
        showVCPOutput: boolean
        maxVCPLoopStream: number
        maxVCPLoopNonStream: number
        vcpToolCode: boolean
        defaultTimezone: string
        apiRetries: number
        apiRetryDelay: number
        knowledgeBaseRootPath: string
        vectorStorePath: string
        vectorDbDimension: number
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:toolbox:get-config'),

    // 更新 VCP 运行时配置
    updateConfig: (config: {
      debugMode?: boolean
      showVCPOutput?: boolean
      maxVCPLoopStream?: number
      maxVCPLoopNonStream?: number
      vcpToolCode?: boolean
      defaultTimezone?: string
      apiRetries?: number
      apiRetryDelay?: number
      knowledgeBaseRootPath?: string
      vectorStorePath?: string
      vectorDbDimension?: number
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('vcp:toolbox:update-config', config),

    // ==================== 知识库管理 ====================

    // 初始化知识库
    initializeKnowledge: (config?: {
      rootPath?: string
      storePath?: string
      dimension?: number
      embeddingModel?: string
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('vcp:knowledge:initialize', config),

    // 搜索知识库
    searchKnowledge: (
      query: string,
      options?: {
        diaryName?: string
        k?: number
        tagBoost?: number
      }
    ): Promise<{
      success: boolean
      data?: Array<{
        text: string
        score: number
        sourceFile: string
        fullPath?: string
        matchedTags?: string[]
        boostFactor?: number
        tagMatchScore?: number
        tagMatchCount?: number
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:knowledge:search', query, options),

    // 获取可用日记本列表
    getDiaries: (): Promise<{
      success: boolean
      data?: string[]
      error?: string
    }> => ipcRenderer.invoke('vcp:knowledge:get-diaries'),

    // 获取知识库统计信息
    getKnowledgeStats: (): Promise<{
      success: boolean
      data?: {
        totalFiles: number
        totalChunks: number
        totalTags: number
        diaryCount: number
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:knowledge:get-stats')
  },

  // ==================== VCP 论坛直接接口 (VCP Forum Direct API) ====================
  vcpForum: {
    // 列出所有帖子
    list: (): Promise<{
      success: boolean
      data?: Array<{
        uid: string
        title: string
        board: string
        author: string
        timestamp: string
        lastReply?: {
          author: string
          timestamp: string
        }
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:forum:list'),

    // 创建帖子
    create: (params: {
      maid: string
      board: string
      title: string
      content: string
    }): Promise<{
      success: boolean
      data?: { uid: string }
      error?: string
    }> => ipcRenderer.invoke('vcp:forum:create', params),

    // 读取帖子详情
    read: (postUid: string): Promise<{
      success: boolean
      data?: {
        uid: string
        title: string
        board: string
        author: string
        timestamp: string
        content: string
        replies: Array<{
          floor: number
          author: string
          timestamp: string
          content: string
        }>
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:forum:read', postUid),

    // 回复帖子
    reply: (params: {
      maid: string
      post_uid: string
      content: string
    }): Promise<{
      success: boolean
      data?: { floor: number }
      error?: string
    }> => ipcRenderer.invoke('vcp:forum:reply', params),

    // 获取论坛统计信息
    stats: (): Promise<{
      success: boolean
      data?: {
        totalPosts: number
        boards: string[]
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:forum:stats')
  },

  // ==================== 三大自学习系统 (Self-Learning System) ====================

  /**
   * 自学习服务 API
   * 基于 VCPToolBox 概念设计的完整实现：
   * 1. 查询频率自学习 (Query Frequency Learning)
   * 2. 用户反馈学习 (User Feedback Learning)
   * 3. 语义关联发现 (Semantic Association Discovery)
   */
  selfLearning: {
    // 记录查询事件
    recordQuery: (params: {
      tags: string[]
      type?: 'search' | 'rag' | 'tagmemo'
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.SelfLearning_RecordQuery, params),

    // 记录正向反馈 - 用户选择了某个搜索结果
    recordPositiveFeedback: (params: {
      query: string
      selectedResultId: string
      relatedTags: string[]
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.SelfLearning_RecordPositiveFeedback, params),

    // 记录负向反馈 - 用户明确标记某个结果不相关
    recordNegativeFeedback: (params: {
      query: string
      ignoredResultId: string
      relatedTags: string[]
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.SelfLearning_RecordNegativeFeedback, params),

    // 获取标签学习权重
    getLearnedWeight: (params: { tag: string }): Promise<{ success: boolean; weight?: number; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.SelfLearning_GetLearnedWeight, params),

    // 发现语义关联
    discoverAssociations: (): Promise<{
      success: boolean
      suggestions?: Array<{
        sourceTag: string
        suggestedTag: string
        confidence: number
        discoveredAt: number
        confirmed: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SelfLearning_DiscoverAssociations),

    // 确认语义关联建议
    confirmSuggestion: (params: {
      sourceTag: string
      suggestedTag: string
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.SelfLearning_ConfirmSuggestion, params),

    // 获取待确认建议
    getPendingSuggestions: (): Promise<{
      success: boolean
      suggestions?: Array<{
        sourceTag: string
        suggestedTag: string
        confidence: number
        discoveredAt: number
        confirmed: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SelfLearning_GetPendingSuggestions),

    // 获取学习统计
    getStats: (): Promise<{
      success: boolean
      stats?: {
        totalTags: number
        totalQueries: number
        totalFeedback: number
        pendingSuggestions: number
        topTags: Array<{ tag: string; weight: number; queryCount: number }>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SelfLearning_GetStats),

    // 获取标签详细统计
    getTagStats: (params: {
      tag: string
    }): Promise<{
      success: boolean
      stats?: {
        queryCount: number
        positiveCount: number
        negativeCount: number
        lastQueryTime: number
        learnedWeight: number
      } | null
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SelfLearning_GetTagStats, params),

    // 重置学习数据
    reset: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.SelfLearning_Reset)
  },

  // ==================== 知识库文件监控 (Knowledge File Watcher) ====================

  /**
   * 知识库文件监控 API
   * 基于 VCPToolBox chokidar 实现的文件监控服务
   */
  knowledgeWatcher: {
    // 添加监控路径
    addPath: (params: { rootPath: string; knowledgeBaseName: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.KnowledgeWatcher_AddPath, params),

    // 移除监控路径
    removePath: (params: { rootPath: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.KnowledgeWatcher_RemovePath, params),

    // 获取监控状态
    getStatus: (): Promise<{
      success: boolean
      status?: Array<{
        path: string
        name: string
        isActive: boolean
        pendingCount: number
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.KnowledgeWatcher_GetStatus),

    // 获取所有监控路径
    getWatchedPaths: (): Promise<{
      success: boolean
      paths?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.KnowledgeWatcher_GetWatchedPaths),

    // 停止所有监控
    stopAll: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.KnowledgeWatcher_StopAll)
  },

  // Canvas Collaborative Editing (协同编辑)
  canvas: {
    // File Management
    getHistory: (): Promise<{ success: boolean; data: unknown[] }> => ipcRenderer.invoke(IpcChannel.Canvas_GetHistory),
    loadFile: (path: string): Promise<{ success: boolean; data: unknown }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_LoadFile, path),
    saveFile: (params: { path: string; content: string; createVersion?: boolean }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_SaveFile, params),
    createFile: (fileName: string): Promise<{ success: boolean; data: { path: string } }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_CreateFile, fileName),
    deleteFile: (path: string): Promise<{ success: boolean }> => ipcRenderer.invoke(IpcChannel.Canvas_DeleteFile, path),
    renameFile: (params: { path: string; newName: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_RenameFile, params),
    listFiles: (): Promise<{ success: boolean; data: unknown[] }> => ipcRenderer.invoke(IpcChannel.Canvas_ListFiles),

    // Version Control
    getVersions: (path: string): Promise<{ success: boolean; data: unknown[] }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetVersions, path),
    restoreVersion: (params: { path: string; version: number }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_RestoreVersion, params),
    createSnapshot: (path: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_CreateSnapshot, path),

    // Real-time Sync
    startSync: (path: string): Promise<{ success: boolean }> => ipcRenderer.invoke(IpcChannel.Canvas_StartSync, path),
    stopSync: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IpcChannel.Canvas_StopSync),
    getSyncState: (): Promise<{ success: boolean; data: unknown }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetSyncState),

    // Project Management
    openProjectDialog: (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_OpenProjectDialog),
    openProject: (projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_OpenProject, projectPath),
    closeProject: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_CloseProject),
    getProjects: (): Promise<{ success: boolean; data?: unknown[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetProjects),
    getCurrentProject: (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetCurrentProject),
    removeProject: (projectId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_RemoveProject, projectId),

    // File Tree
    getFileTree: (dirPath?: string, depth?: number): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetFileTree, dirPath, depth),
    createDirectory: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_CreateDirectory, dirPath),
    deleteDirectory: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_DeleteDirectory, dirPath),
    copy: (srcPath: string, destPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_Copy, srcPath, destPath),
    move: (srcPath: string, destPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_Move, srcPath, destPath),

    // Agent Collaboration
    addAgentMarker: (marker: {
      agentId: string
      agentName: string
      filePath: string
      startLine: number
      endLine: number
      color: string
      timestamp: Date
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannel.Canvas_AddAgentMarker, marker),
    removeAgentMarker: (filePath: string, agentId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_RemoveAgentMarker, filePath, agentId),
    getAgentMarkers: (filePath: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.Canvas_GetAgentMarkers, filePath),

    // Event Listeners
    onExternalChange: (callback: (data: { filePath: string; content: string }) => void): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data as { filePath: string; content: string })
      ipcRenderer.on(IpcChannel.Canvas_ExternalChange, handler)
      return () => ipcRenderer.removeListener(IpcChannel.Canvas_ExternalChange, handler)
    },
    onSyncStateChanged: (callback: (data: unknown) => void): (() => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data)
      ipcRenderer.on(IpcChannel.Canvas_SyncStateChanged, handler)
      return () => ipcRenderer.removeListener(IpcChannel.Canvas_SyncStateChanged, handler)
    }
  },

  // ==================== VCPTavern (角色卡 & 世界书) ====================

  /**
   * Tavern 角色卡管理 API
   * SillyTavern 兼容的角色卡系统
   */
  tavern: {
    // ==================== 角色卡操作 ====================

    // 列出所有角色卡
    listCards: (params?: {
      search?: string
      tags?: string[]
      favorite?: boolean
      spec?: 'chara_card_v2' | 'chara_card_v3'
      sortBy?: 'name' | 'created' | 'updated' | 'used'
      sortOrder?: 'asc' | 'desc'
    }): Promise<{
      success: boolean
      data?: Array<{
        id: string
        name: string
        avatar?: string
        spec: 'chara_card_v2' | 'chara_card_v3'
        tags: string[]
        creator?: string
        favorite?: boolean
        usageCount?: number
        lastUsedAt?: Date
      }>
      error?: string
    }> => ipcRenderer.invoke('tavern:card:list', params),

    // 获取单个角色卡
    getCard: (
      id: string
    ): Promise<{
      success: boolean
      data?: {
        id: string
        name: string
        avatar?: string
        spec: 'chara_card_v2' | 'chara_card_v3'
        data: {
          name: string
          description: string
          personality?: string
          scenario?: string
          first_mes?: string
          mes_example?: string
          system_prompt?: string
          post_history_instructions?: string
          creator?: string
          tags?: string[]
          character_book?: unknown
        }
        createdAt: Date
        updatedAt: Date
      }
      error?: string
    }> => ipcRenderer.invoke('tavern:card:get', id),

    // 创建角色卡
    createCard: (
      name: string,
      data?: unknown
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:card:create', name, data),

    // 更新角色卡
    updateCard: (
      id: string,
      updates: unknown
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:card:update', id, updates),

    // 删除角色卡
    deleteCard: (
      id: string
    ): Promise<{
      success: boolean
      data?: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:card:delete', id),

    // 导入角色卡
    importCard: (options: {
      type: 'file' | 'url' | 'json'
      source: string
    }): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:card:import', options),

    // 导出角色卡
    exportCard: (
      id: string,
      options: {
        format: 'png' | 'json'
        outputPath: string
        includeWorldBook?: boolean
      }
    ): Promise<{
      success: boolean
      data?: string
      error?: string
    }> => ipcRenderer.invoke('tavern:card:export', id, options),

    // 激活角色卡
    activateCard: (
      id: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:card:activate', id),

    // 停用角色卡
    deactivateCard: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:card:deactivate'),

    // 获取活跃角色卡
    getActiveCard: (): Promise<{
      success: boolean
      data?: unknown | null
      error?: string
    }> => ipcRenderer.invoke('tavern:card:getActive'),

    // 切换收藏状态
    toggleFavorite: (
      id: string
    ): Promise<{
      success: boolean
      data?: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:card:toggleFavorite', id),

    // ==================== 世界书操作 ====================

    // 匹配世界书条目
    matchWorldBook: (
      text: string,
      bookId?: string,
      options?: {
        scanDepth?: number
        tokenBudget?: number
      }
    ): Promise<{
      success: boolean
      data?: Array<{
        entry: {
          id: number
          keys: string[]
          content: string
          priority: number
          enabled: boolean
        }
        matchedKeys: string[]
        score: number
        isConstant: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke('tavern:worldbook:match', text, bookId, options),

    // 加载世界书
    loadWorldBook: (
      bookId: string,
      book: unknown
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:worldbook:load', bookId, book),

    // 卸载世界书
    unloadWorldBook: (
      bookId: string
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:worldbook:unload', bookId),

    // 列出已加载的世界书
    listWorldBooks: (): Promise<{
      success: boolean
      data?: string[]
      error?: string
    }> => ipcRenderer.invoke('tavern:worldbook:list'),

    // 获取世界书统计信息
    getWorldBookStats: (): Promise<{
      success: boolean
      data?: {
        bookCount: number
        entryCount: number
        keywordCount: number
      }
      error?: string
    }> => ipcRenderer.invoke('tavern:worldbook:stats'),

    // ==================== 预设操作 ====================

    // 列出所有预设
    listPresets: (): Promise<{
      success: boolean
      data?: Array<{
        id: string
        name: string
        type: string
      }>
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:list'),

    // 获取预设
    getPreset: (
      id: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:get', id),

    // 保存预设
    savePreset: (
      preset: unknown
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:save', preset),

    // 删除预设
    deletePreset: (
      id: string
    ): Promise<{
      success: boolean
      data?: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:delete', id),

    // 激活预设
    activatePreset: (
      id: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:activate', id),

    // 停用预设
    deactivatePreset: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:deactivate'),

    // 获取活跃预设
    getActivePreset: (): Promise<{
      success: boolean
      data?: unknown | null
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:getActive'),

    // 创建导演模式预设
    createDirectorPreset: (
      name: string,
      instructions: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:createDirector', name, instructions),

    // 创建角色扮演预设
    createRoleplayPreset: (
      name: string,
      systemPrefix?: string,
      systemSuffix?: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:preset:createRoleplay', name, systemPrefix, systemSuffix),

    // ==================== 解析操作 ====================

    // 解析 PNG 文件
    parsePng: (
      filePath: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:parse:png', filePath),

    // 解析 JSON 字符串
    parseJson: (
      jsonStr: string
    ): Promise<{
      success: boolean
      data?: unknown
      error?: string
    }> => ipcRenderer.invoke('tavern:parse:json', jsonStr)
  },

  // ==================== 记忆大师 (Memory Master) ====================

  /**
   * 记忆大师 API
   * 基于 VCPToolBox 概念设计的智能记忆管理服务：
   * - 自动补标：AI 分析内容生成高质量标签
   * - 批量整理：事件合并、结构优化、语法去冗余
   * - 标签池管理：维护全局标签一致性
   * - 模型可配置：用户可选择 AI 模型
   */
  memoryMaster: {
    // ==================== 自动补标 ====================

    // 自动生成标签
    autoTag: (params: {
      content: string
      options?: {
        existingTags?: string[]
        authorStyle?: string
        maxTags?: number
        language?: 'zh' | 'en' | 'auto'
        modelId?: string
        providerId?: string
      }
    }): Promise<{
      success: boolean
      tags?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_AutoTag, params),

    // 验证标签格式
    validateTags: (params: {
      tags: string[]
    }): Promise<{
      success: boolean
      valid?: boolean
      invalidTags?: string[]
      suggestedTags?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_ValidateTags, params),

    // 检测并建议标签
    detectAndSuggest: (params: {
      content: string
      existingTags?: string[]
    }): Promise<{
      success: boolean
      valid?: boolean
      suggestedTags?: string[]
      invalidTags?: string[]
      needsTagging?: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_DetectAndSuggest, params),

    // ==================== 批量整理 ====================

    // 批量整理笔记
    batchOrganize: (params: {
      notePaths: string[]
      options: {
        startDate?: Date
        endDate?: Date
        tasks: Array<'merge' | 'summarize' | 'deduplicate' | 'tag'>
        modelId?: string
        providerId?: string
      }
    }): Promise<{
      success: boolean
      message?: string
      processedCount?: number
      mergedCount?: number
      taggedCount?: number
      errors?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_BatchOrganize, params),

    // 合并多个内容
    mergeContents: (params: {
      contents: string[]
      options?: { modelId?: string; providerId?: string }
    }): Promise<{
      success: boolean
      merged?: string
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_MergeContents, params),

    // 去除冗余内容
    deduplicate: (params: {
      content: string
      options?: { modelId?: string; providerId?: string }
    }): Promise<{
      success: boolean
      deduplicated?: string
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_Deduplicate, params),

    // ==================== 标签池管理 ====================

    // 获取标签池
    getTagPool: (): Promise<{
      success: boolean
      tags?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_GetTagPool),

    // 获取标签统计
    getTagStats: (): Promise<{
      success: boolean
      stats?: Array<{
        tag: string
        count: number
        lastUsed: Date
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_GetTagStats),

    // 获取 Top N 标签
    getTopTags: (params?: {
      n?: number
    }): Promise<{
      success: boolean
      tags?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_GetTopTags, params || {}),

    // 添加标签到标签池
    addTagsToPool: (params: {
      tags: string[]
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_AddTagsToPool, params),

    // ==================== 配置管理 ====================

    // 获取配置
    getConfig: (): Promise<{
      success: boolean
      config?: {
        autoTagEnabled: boolean
        defaultModelId?: string
        defaultProviderId?: string
        maxTags: number
        tagFormat: 'lowercase' | 'kebab-case' | 'original'
        suggestionsEnabled: boolean
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_GetConfig),

    // 更新配置
    updateConfig: (params: {
      config: {
        autoTagEnabled?: boolean
        defaultModelId?: string
        defaultProviderId?: string
        maxTags?: number
        tagFormat?: 'lowercase' | 'kebab-case' | 'original'
        suggestionsEnabled?: boolean
      }
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryMaster_UpdateConfig, params)
  },

  // ==================== Agent 日记写入 (DailyNoteWrite) ====================

  /**
   * Agent 日记写入 API
   * 基于 VCPToolBox DailyNoteWrite 功能的完整实现：
   * - Agent 通过工具调用主动创建/更新日记
   * - 自动调用记忆大师进行智能补标
   * - 支持标签格式校验
   * - 与 NoteService 集成
   */
  dailyNoteWrite: {
    // Agent 写入日记
    write: (params: {
      content: string
      title?: string
      tags?: string[]
      category?: string
      linkedNotes?: string[]
      characterName?: string
      metadata?: Record<string, unknown>
      skipAutoTag?: boolean
      modelId?: string
      providerId?: string
    }): Promise<{
      success: boolean
      note?: {
        filePath: string
        title: string
        frontmatter: {
          title: string
          date: string
          tags: string[]
          aiGenerated: boolean
          characterName?: string
        }
        content: string
      }
      generatedTags?: string[]
      tagValidation?: {
        valid: boolean
        invalidTags: string[]
        suggestedTags: string[]
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_AgentWrite, params),

    // 获取插件定义
    getPluginDefinition: (): Promise<{
      success: boolean
      definition?: {
        name: string
        displayName: string
        description: string
        params: Array<{
          name: string
          type: 'string' | 'array' | 'boolean' | 'number' | 'object'
          required: boolean
          description?: string
          default?: unknown
        }>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_GetPluginDefinition),

    // 获取插件配置
    getConfig: (): Promise<{
      success: boolean
      config?: {
        defaultCategory: string
        autoTagEnabled: boolean
        minAutoTagLength: number
        dateFormat: string
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_GetPluginConfig),

    // 更新插件配置
    updateConfig: (params: {
      config: {
        defaultCategory?: string
        autoTagEnabled?: boolean
        minAutoTagLength?: number
        dateFormat?: string
      }
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_UpdatePluginConfig, params),

    // ==================== Notes Search (Native ChineseSearchEngine) ====================

    // 全文搜索
    fullTextSearch: (params: {
      query: string
      limit?: number
      minScore?: number
    }): Promise<{
      success: boolean
      results?: Array<{
        id: string
        filePath: string
        title: string
        content: string
        tags?: string[]
        searchScore: number
        updatedAt: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_FullTextSearch, params),

    // 初始化搜索索引
    initSearchIndex: (): Promise<{
      success: boolean
      indexed?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_InitSearchIndex),

    // 获取搜索统计
    getSearchStats: (): Promise<{
      success: boolean
      stats?: {
        available: boolean
        initialized: boolean
        documentCount?: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Note_GetSearchStats)
  },

  // ==================== 统一记忆协调器 (Integrated Memory Coordinator) ====================

  /**
   * 统一记忆协调器 API
   * 整合 UnifiedMemoryManager、MemoryMasterService、SelfLearningService
   * 提供完整的记忆生命周期管理：创建、搜索、反馈、整理
   */
  integratedMemory: {
    // ==================== 记忆创建 ====================

    // 创建记忆 (带自动补标)
    create: (params: {
      content: string
      title?: string
      backend?: 'diary' | 'memory' | 'notes'
      tags?: string[]
      autoTag?: boolean
      modelId?: string
      providerId?: string
      metadata?: Record<string, unknown>
    }): Promise<{
      success: boolean
      entry?: {
        id: string
        content: string
        title?: string
        tags: string[]
        backend: string
        createdAt: Date
        metadata?: Record<string, unknown>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_Create, params),

    // 批量创建记忆
    batchCreate: (params: {
      entries: Array<{ content: string; title?: string; tags?: string[] }>
      options?: {
        autoTag?: boolean
        backend?: 'diary' | 'memory' | 'notes'
        modelId?: string
        providerId?: string
      }
    }): Promise<{
      success: boolean
      entries?: Array<{
        id: string
        content: string
        title?: string
        tags: string[]
        backend: string
        createdAt: Date
      }>
      count?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_BatchCreate, params),

    // ==================== 智能搜索 (带学习增强) ====================

    // 智能搜索 (自动应用学习权重)
    intelligentSearch: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
        topK?: number
        threshold?: number
        applyLearning?: boolean
        recordQuery?: boolean
        userId?: string
        agentId?: string
        knowledgeBaseId?: string
      }
    }): Promise<{
      success: boolean
      results?: Array<{
        id: string
        content: string
        score: number
        backend: string
        matchedTags?: string[]
        metadata?: Record<string, unknown>
        learning?: {
          appliedWeight: number
          rawScore: number
          matchedLearningTags: string[]
          userSelectionCount: number
        }
      }>
      count?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_IntelligentSearch, params),

    // 获取搜索建议
    getSuggestions: (params: {
      partialQuery: string
      limit?: number
    }): Promise<{
      success: boolean
      suggestions?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_GetSuggestions, params),

    // ==================== 反馈学习 ====================

    // 记录正向反馈 (用户选择了某个搜索结果)
    recordPositiveFeedback: (params: {
      searchId: string
      selectedResultId: string
      query: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_RecordPositiveFeedback, params),

    // 记录负向反馈 (用户标记某个结果不相关)
    recordNegativeFeedback: (params: {
      searchId: string
      ignoredResultId: string
      query: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_RecordNegativeFeedback, params),

    // ==================== 记忆整理 ====================

    // 智能整理 (合并 + 去重 + 补标)
    organize: (params: {
      backend?: 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'
      dateRange?: { start: Date; end: Date }
      tasks: Array<'merge' | 'deduplicate' | 'tag'>
      modelId?: string
      providerId?: string
    }): Promise<{
      success: boolean
      result?: {
        success: boolean
        message: string
        processedCount: number
        mergedCount?: number
        taggedCount?: number
        errors?: string[]
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_Organize, params),

    // 发现并应用语义关联
    discoverAssociations: (): Promise<{
      success: boolean
      discoveredCount?: number
      appliedCount?: number
      suggestions?: Array<{
        sourceTag: string
        suggestedTag: string
        confidence: number
        discoveredAt: number
        confirmed: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_DiscoverAssociations),

    // ==================== 统计和状态 ====================

    // 获取综合统计
    getStats: (): Promise<{
      success: boolean
      stats?: {
        memoryStats: {
          totalDocuments: number
          backends: Record<string, { count: number; lastUpdated?: Date }>
        }
        learningStats: {
          totalTags: number
          totalQueries: number
          totalFeedback: number
          pendingSuggestions: number
          topTags: Array<{ tag: string; weight: number; queryCount: number }>
        }
        tagPoolStats: {
          totalTags: number
          topTags: string[]
          recentTags: string[]
        }
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_GetStats),

    // 获取学习进度
    getLearningProgress: (): Promise<{
      success: boolean
      progress?: {
        queryCount: number
        feedbackCount: number
        tagWeightRange: { min: number; max: number }
        topLearningTags: Array<{ tag: string; weight: number }>
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_GetLearningProgress),

    // ==================== 配置管理 ====================

    // 获取配置
    getConfig: (): Promise<{
      success: boolean
      config?: {
        memoryMaster: {
          enabled: boolean
          autoTagOnCreate: boolean
          defaultModelId?: string
          defaultProviderId?: string
          maxTags: number
        }
        selfLearning: {
          enabled: boolean
          recordQueries: boolean
          applyWeights: boolean
          decayHalfLifeDays: number
          feedbackGain: number
          feedbackDecay: number
        }
        search: {
          defaultBackends: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
          useRRF: boolean
          rrfK: number
          defaultTopK: number
          minThreshold: number
        }
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_GetConfig),

    // 更新配置
    updateConfig: (params: {
      memoryMaster?: {
        enabled?: boolean
        autoTagOnCreate?: boolean
        defaultModelId?: string
        defaultProviderId?: string
        maxTags?: number
      }
      selfLearning?: {
        enabled?: boolean
        recordQueries?: boolean
        applyWeights?: boolean
        decayHalfLifeDays?: number
        feedbackGain?: number
        feedbackDecay?: number
      }
      search?: {
        defaultBackends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
        useRRF?: boolean
        rrfK?: number
        defaultTopK?: number
        minThreshold?: number
      }
    }): Promise<{
      success: boolean
      config?: Record<string, unknown>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.IntegratedMemory_UpdateConfig, params)
  },

  // ==================== MemoryBrain (统一记忆大脑) ====================

  /**
   * MemoryBrain API
   * 统一记忆大脑，提供：
   * - 智能路由搜索
   * - 神经网络重排序
   * - WaveRAG 三阶段检索
   * - 调用追踪
   */
  memoryBrain: {
    // ==================== 搜索 ====================

    // 统一搜索 (自动路由 + 智能重排)
    search: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo'>
        topK?: number
        rerankMode?: 'local' | 'neural' | 'auto'
        enableSynthesis?: boolean
        synthesisOptions?: { modelId?: string; providerId?: string }
      }
    }): Promise<{
      success: boolean
      results?: Array<{
        id: string
        content: string
        score: number
        backend: string
        metadata?: Record<string, unknown>
      }>
      synthesizedContent?: string
      metadata?: {
        usedBackends: string[]
        usedNeuralRerank: boolean
        rerankMode: string
        usedSynthesis: boolean
        totalDurationMs: number
        phaseDurations: { search: number; rerank: number; synthesis: number }
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_Search, params),

    // 快速搜索 (仅本地重排)
    quickSearch: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo'>
        topK?: number
      }
    }): Promise<{
      success: boolean
      results?: Array<{
        id: string
        content: string
        score: number
        backend: string
        metadata?: Record<string, unknown>
      }>
      count?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_QuickSearch, params),

    // 深度搜索 (神经重排 + AI 合成)
    deepSearch: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo'>
        topK?: number
        modelId?: string
        providerId?: string
      }
    }): Promise<{
      success: boolean
      results?: Array<{
        id: string
        content: string
        score: number
        backend: string
        metadata?: Record<string, unknown>
      }>
      synthesizedContent?: string
      metadata?: Record<string, unknown>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_DeepSearch, params),

    // WaveRAG 三阶段检索
    waveRAGSearch: (params: {
      query: string
      options?: {
        backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo'>
        topK?: number
        expansionDepth?: number
        focusScoreThreshold?: number
      }
    }): Promise<{
      success: boolean
      results?: Array<{
        pageContent: string
        score: number
        metadata?: Record<string, unknown>
      }>
      phases?: Array<{
        phase: 'lens' | 'expansion' | 'focus'
        inputCount: number
        outputCount: number
      }>
      metadata?: {
        query: string
        lensTagCount: number
        expansionTagCount: number
        totalTime: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_WaveRAGSearch, params),

    // ==================== 创建 ====================

    // 创建记忆
    createMemory: (params: {
      content: string
      title?: string
      backend?: 'diary' | 'memory' | 'notes'
      tags?: string[]
      autoTag?: boolean
      modelId?: string
      providerId?: string
      metadata?: Record<string, unknown>
    }): Promise<{
      success: boolean
      entry?: {
        id: string
        content: string
        title?: string
        tags: string[]
        backend: string
        createdAt: Date
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_CreateMemory, params),

    // ==================== 状态和配置 ====================

    // 获取状态
    getStatus: (): Promise<{
      success: boolean
      isHealthy?: boolean
      neuralRerankAvailable?: boolean
      tracingEnabled?: boolean
      coordinatorConfig?: Record<string, unknown>
      stats?: Record<string, unknown>
      traceStats?: {
        totalCalls: number
        totalDurationMs: number
        callsByMethod: Record<string, number>
        callsByBackend: Record<string, number>
        averageDurationMs: number
        errorCount: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetStatus),

    // 获取配置
    getConfig: (): Promise<{
      success: boolean
      config?: Record<string, unknown>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetConfig),

    // 更新配置
    updateConfig: (params: {
      config: Record<string, unknown>
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_UpdateConfig, params),

    // 配置神经重排模型
    configureNeuralRerank: (params: {
      model: {
        id: string
        provider: string
        apiKey: string
        baseUrl?: string
      }
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_ConfigureNeuralRerank, params),

    // ==================== 反馈 ====================

    // 记录正向反馈
    recordPositiveFeedback: (params: {
      searchId: string
      selectedResultId: string
      query: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_RecordPositiveFeedback, params),

    // 记录负向反馈
    recordNegativeFeedback: (params: {
      searchId: string
      ignoredResultId: string
      query: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_RecordNegativeFeedback, params),

    // ==================== 追踪 ====================

    // 获取追踪统计
    getTraceStats: (): Promise<{
      success: boolean
      stats?: {
        totalCalls: number
        totalDurationMs: number
        callsByMethod: Record<string, number>
        callsByBackend: Record<string, number>
        averageDurationMs: number
        errorCount: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetTraceStats),

    // 获取追踪记录
    getTraceRecords: (params?: { limit?: number }): Promise<{
      success: boolean
      records?: Array<{
        id: string
        timestamp: string
        caller: string
        method: string
        params: Record<string, unknown>
        result?: { success: boolean; count?: number; error?: string }
        durationMs: number
        backend?: string
      }>
      count?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetTraceRecords, params),

    // 获取调用链路图
    getCallGraph: (): Promise<{
      success: boolean
      graph?: Array<{
        timestamp: string
        caller: string
        method: string
        backend?: string
        durationMs: number
        success: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetCallGraph),

    // 获取向量存储信息
    getVectorStorageInfo: (): Promise<{
      success: boolean
      info?: Array<{
        backend: string
        location: string
        dimension: number
        documentCount: number
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.MemoryBrain_GetVectorStorageInfo)
  },

  // ==================== Quality Guardian (质量守护) ====================
  quality: {
    // 评估内容质量
    evaluate: (request: {
      contentType: 'image' | 'code' | 'text' | 'workflow' | 'prompt'
      content: string | Record<string, unknown>
      context?: {
        originalPrompt?: string
        referenceContent?: string
        userPreferences?: {
          minAcceptableScore?: number
          focusAreas?: string[]
        }
      }
      options?: {
        checkLevel?: 'basic' | 'standard' | 'thorough'
        enableAutoFix?: boolean
      }
    }): Promise<{
      success: boolean
      metrics?: {
        contentType: string
        contentId: string
        passed: boolean
        overallScore: number
        checks: {
          common: Array<{ id: string; name: string; passed: boolean; score: number; details: string }>
          typeSpecific: Array<{ id: string; name: string; passed: boolean; score: number; details: string }>
        }
        suggestions: Array<{ id: string; severity: string; message: string }>
        autoFixActions?: Array<{ id: string; type: string; description: string; riskLevel: string }>
        duration?: number
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_Evaluate, request),

    // 优化内容
    optimize: (request: {
      targetType: 'prompt' | 'config' | 'code' | 'workflow'
      target: string | Record<string, unknown>
      constraints?: {
        maxIterations?: number
        targetScore?: number
        preserveSemantics?: boolean
      }
      options?: {
        style?: 'conservative' | 'moderate' | 'aggressive'
        modelId?: string
        providerId?: string
      }
      context?: string
    }): Promise<{
      success: boolean
      optimizedContent?: string | Record<string, unknown>
      improvements?: {
        before: { overallScore: number }
        after: { overallScore: number }
        scoreImprovement: number
      }
      changes?: Array<{ type: string; target?: string; description?: string }>
      requiresUserApproval?: boolean
      iterations?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_Optimize, request),

    // 获取质量历史
    getHistory: (
      contentId: string
    ): Promise<{
      success: boolean
      history?: {
        contentId: string
        evaluations: Array<{ overallScore: number; passed: boolean; timestamp: string }>
        trend: { direction: 'improving' | 'stable' | 'declining'; averageScore: number }
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_GetHistory, { contentId }),

    // 应用自动修复
    applyFix: (
      fixId: string,
      approve?: boolean
    ): Promise<{
      success: boolean
      message?: string
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_ApplyFix, { fixId, approve }),

    // 对比质量
    compare: (
      content1: string,
      content2: string,
      contentType: string
    ): Promise<{
      success: boolean
      content1?: { overallScore: number }
      content2?: { overallScore: number }
      difference?: number
      winner?: 'content1' | 'content2' | 'tie'
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_Compare, { content1, content2, contentType }),

    // 获取可用检查器
    getCheckers: (): Promise<{
      success: boolean
      checkers?: Array<{ contentType: string; name: string; supportedChecks: string[] }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_GetCheckers),

    // 初始化
    initialize: (): Promise<{
      success: boolean
      message?: string
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.Quality_Initialize)
  },

  // ==================== 时间表达式解析器 (TimeExpressionParser) ====================

  /**
   * 时间表达式解析器 API
   * 支持中英文自然语言时间表达式解析
   * 例如: "昨天", "上周五", "三个月前", "last Friday"
   */
  timeParser: {
    // 解析时间表达式
    parse: (params: {
      text: string
      locale?: 'zh-CN' | 'en-US'
    }): Promise<{
      success: boolean
      ranges: Array<{
        expression: string
        start: string // ISO date string
        end: string // ISO date string
        type: string
        originalText: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.TimeParser_Parse, params),

    // 检查文本是否包含时间表达式
    hasExpression: (params: {
      text: string
      locale?: 'zh-CN' | 'en-US'
    }): Promise<{
      success: boolean
      hasExpression: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.TimeParser_HasExpression, params),

    // 获取支持的时间表达式列表
    getSupportedExpressions: (params?: {
      locale?: 'zh-CN' | 'en-US'
    }): Promise<{
      success: boolean
      expressions?: {
        hardcoded: string[]
        patterns: string[]
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.TimeParser_GetSupportedExpressions, params),

    // 设置默认语言区域
    setLocale: (params: {
      locale: 'zh-CN' | 'en-US'
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.TimeParser_SetLocale, params)
  },

  // ==================== 语义组服务 (SemanticGroupService) ====================

  /**
   * 语义组服务 API
   * 支持向量预计算和查询扩展
   */
  semanticGroup: {
    // 扩展查询
    expand: (params: {
      query: string
      groups?: string[]
      maxExpansions?: number
    }): Promise<{
      success: boolean
      expandedTerms?: string[]
      matchedGroups?: string[]
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_Expand, params),

    // 获取增强向量
    getEnhancedVector: (params: {
      query: string
      groups?: string[]
    }): Promise<{
      success: boolean
      vector?: number[]
      sourceVector?: number[]
      groupContributions?: Record<string, number>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_GetEnhancedVector, params),

    // 获取或创建组向量
    getGroupVector: (params: {
      groupId: string
      forceRecalculate?: boolean
    }): Promise<{
      success: boolean
      vector?: number[]
      cached: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_GetGroupVector, params),

    // 列出所有语义组
    listGroups: (): Promise<{
      success: boolean
      groups?: Array<{
        id: string
        name: string
        description?: string
        keywords: string[]
        priority?: number
        color?: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_ListGroups),

    // 添加自定义语义组
    addGroup: (params: {
      id: string
      name: string
      description?: string
      keywords: string[]
      priority?: number
      color?: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_AddGroup, params),

    // 删除语义组
    removeGroup: (params: {
      groupId: string
    }): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_RemoveGroup, params),

    // 获取服务统计
    getStats: (): Promise<{
      success: boolean
      stats?: {
        totalGroups: number
        cachedVectors: number
        cacheHitRate: number
        lastCacheUpdate?: string
      }
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_GetStats),

    // 预热缓存 (预计算所有组向量)
    warmCache: (): Promise<{
      success: boolean
      cachedCount?: number
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_WarmCache),

    // 清除缓存
    clearCache: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke(IpcChannel.SemanticGroup_ClearCache)
  },

  // ==================== Git Service (Git 版本控制) ====================

  /**
   * Git 操作 API
   * 用于 Canvas/Cherry Code 的 Git 可视化集成
   */
  git: {
    // 检查是否是 Git 仓库
    isRepo: (cwd: string): Promise<boolean> => ipcRenderer.invoke('git:isRepo', cwd),

    // 获取状态
    getStatus: (
      cwd: string
    ): Promise<{
      branch: string
      ahead: number
      behind: number
      staged: Array<{ path: string; status: string }>
      modified: Array<{ path: string; status: string }>
      untracked: string[]
      conflicts: string[]
      stashCount: number
    }> => ipcRenderer.invoke('git:getStatus', cwd),

    // 获取提交日志
    getLog: (
      cwd: string,
      limit?: number,
      options?: { path?: string; author?: string }
    ): Promise<
      Array<{
        hash: string
        shortHash: string
        author: string
        authorEmail: string
        date: string
        message: string
        refs: string[]
      }>
    > => ipcRenderer.invoke('git:getLog', cwd, limit, options),

    // 获取差异
    getDiff: (
      cwd: string,
      options?: { staged?: boolean; path?: string }
    ): Promise<{
      files: Array<{
        path: string
        additions: number
        deletions: number
        status: string
      }>
      stats: { filesChanged: number; insertions: number; deletions: number }
      patch: string
    }> => ipcRenderer.invoke('git:getDiff', cwd, options),

    // 获取分支列表
    getBranches: (
      cwd: string
    ): Promise<{
      current: string
      local: Array<{ name: string; tracking?: string; ahead: number; behind: number }>
      remote: string[]
    }> => ipcRenderer.invoke('git:getBranches', cwd),

    // 获取远程列表
    getRemotes: (cwd: string): Promise<Array<{ name: string; fetchUrl: string; pushUrl: string }>> =>
      ipcRenderer.invoke('git:getRemotes', cwd),

    // 获取 Stash 列表
    getStashList: (cwd: string): Promise<Array<{ index: number; message: string; date: string }>> =>
      ipcRenderer.invoke('git:getStashList', cwd),

    // 暂存文件
    stageFiles: (cwd: string, paths: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:stageFiles', cwd, paths),

    // 取消暂存
    unstageFiles: (cwd: string, paths: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:unstageFiles', cwd, paths),

    // 提交
    commit: (
      cwd: string,
      message: string,
      options?: { amend?: boolean; noVerify?: boolean }
    ): Promise<{ hash: string; message: string }> => ipcRenderer.invoke('git:commit', cwd, message, options),

    // 推送
    push: (
      cwd: string,
      options?: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean }
    ): Promise<{ success: boolean; remote: string; branch: string }> =>
      ipcRenderer.invoke('git:push', cwd, options),

    // 拉取
    pull: (
      cwd: string,
      options?: { remote?: string; branch?: string; rebase?: boolean }
    ): Promise<{ success: boolean; mergeCommit?: string; filesChanged: number }> =>
      ipcRenderer.invoke('git:pull', cwd, options),

    // 切换分支
    checkout: (cwd: string, branch: string, options?: { create?: boolean }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:checkout', cwd, branch, options),

    // 丢弃更改
    discardChanges: (cwd: string, paths: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:discardChanges', cwd, paths),

    // 重置
    reset: (cwd: string, ref: string, mode?: 'soft' | 'mixed' | 'hard'): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:reset', cwd, ref, mode),

    // Stash
    stash: (cwd: string, message?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:stash', cwd, message),

    // Stash Pop
    stashPop: (cwd: string, index?: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('git:stashPop', cwd, index),

    // 显示文件内容
    showFile: (cwd: string, path: string, ref?: string): Promise<string> =>
      ipcRenderer.invoke('git:showFile', cwd, path, ref),

    // Blame
    blame: (
      cwd: string,
      path: string
    ): Promise<
      Array<{
        line: number
        hash: string
        author: string
        date: string
        content: string
      }>
    > => ipcRenderer.invoke('git:blame', cwd, path),

    // 初始化仓库
    init: (cwd: string): Promise<{ success: boolean }> => ipcRenderer.invoke('git:init', cwd),

    // 克隆仓库
    clone: (
      url: string,
      targetDir: string,
      options?: { branch?: string; depth?: number }
    ): Promise<{ success: boolean }> => ipcRenderer.invoke('git:clone', url, targetDir, options)
  },

  // ==================== Terminal Service (终端服务) ====================

  /**
   * 终端操作 API
   * 用于 Canvas/Cherry Code 的集成终端
   */
  terminal: {
    // 创建终端会话
    createSession: (
      cwd?: string,
      shell?: string
    ): Promise<{
      success: boolean
      session?: {
        id: string
        cwd: string
        shell: string
        isRunning: boolean
        createdAt: number
        lastActivity: number
      }
      error?: string
    }> => ipcRenderer.invoke('terminal:createSession', cwd, shell),

    // 关闭终端会话
    closeSession: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:closeSession', sessionId),

    // 获取会话信息
    getSession: (
      sessionId: string
    ): Promise<{
      success: boolean
      session?: {
        id: string
        cwd: string
        shell: string
        isRunning: boolean
        createdAt: number
        lastActivity: number
      }
      error?: string
    }> => ipcRenderer.invoke('terminal:getSession', sessionId),

    // 获取所有会话
    getAllSessions: (): Promise<{
      success: boolean
      sessions?: Array<{
        id: string
        cwd: string
        shell: string
        isRunning: boolean
        createdAt: number
        lastActivity: number
      }>
      error?: string
    }> => ipcRenderer.invoke('terminal:getAllSessions'),

    // 执行命令
    executeCommand: (
      sessionId: string,
      command: string,
      options?: { cwd?: string; env?: Record<string, string>; timeout?: number }
    ): Promise<{
      success: boolean
      output: string
      exitCode: number | null
    }> => ipcRenderer.invoke('terminal:executeCommand', sessionId, command, options),

    // 终止进程
    killProcess: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:killProcess', sessionId),

    // 设置工作目录
    setCwd: (sessionId: string, cwd: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:setCwd', sessionId, cwd),

    // 获取工作目录
    getCwd: (sessionId: string): Promise<{ success: boolean; cwd?: string; error?: string }> =>
      ipcRenderer.invoke('terminal:getCwd', sessionId),

    // 订阅终端输出 (流式)
    subscribe: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:subscribe', sessionId),

    // 取消订阅
    unsubscribe: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:unsubscribe', sessionId),

    // 监听终端输出事件
    onOutput: (
      callback: (output: { sessionId: string; type: 'stdout' | 'stderr' | 'exit' | 'error'; data: string; timestamp: number }) => void
    ): (() => void) => {
      const handler = (_event: unknown, output: { sessionId: string; type: 'stdout' | 'stderr' | 'exit' | 'error'; data: string; timestamp: number }) => {
        callback(output)
      }
      ipcRenderer.on('terminal:output', handler)
      return () => {
        ipcRenderer.removeListener('terminal:output', handler)
      }
    },

    // 清理所有会话
    cleanup: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('terminal:cleanup')
  },

  // ==================== Native VCP (原生 VCP 模块) ====================

  /**
   * Native VCP API
   * 提供 Rust 原生模块状态、追踪、日志查询
   */
  vcp: {
    // 获取 Native 模块状态
    getNativeStatus: (): Promise<{
      success: boolean
      data?: {
        isNative: boolean
        version: string
        features: string[]
        status: string
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:native:status'),

    // 初始化 Native 模块
    initializeNative: (): Promise<{
      success: boolean
      data?: {
        status: string
        version: string
        features: string[]
        isNative: boolean
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:native:initialize'),

    // 获取数据库统计
    getDatabaseStats: (): Promise<{
      success: boolean
      data?: {
        memoryCount: number
        knowledgeCount: number
        diaryCount: number
        tagCount: number
        traceCount: number
        fileSizeBytes: number
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:native:dbStats'),

    // 获取最近的 Traces
    getRecentTraces: (): Promise<{
      success: boolean
      data?: Array<{
        traceId: string
        operation: string
        status: 'running' | 'completed' | 'failed'
        startTime: string
        endTime?: string
        durationMs?: number
        spans: Array<{
          spanId: string
          parentSpanId?: string
          operation: string
          startTime: string
          endTime?: string
          durationMs?: number
          status: string
          metadata?: string
        }>
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:traces'),

    // 获取最近的日志
    getRecentLogs: (): Promise<{
      success: boolean
      data?: Array<{
        id: string
        timestamp: string
        level: 'trace' | 'debug' | 'info' | 'warn' | 'error'
        target: string
        message: string
        traceId?: string
        spanId?: string
        metadata?: Record<string, unknown>
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:logs'),

    // 创建 Trace
    createTrace: (
      operation: string
    ): Promise<{
      success: boolean
      data?: {
        traceId: string
        spanId: string
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:native:createTrace', operation),

    // 结束 Span
    endSpan: (
      traceId: string,
      spanId: string,
      status?: string,
      metadata?: string
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('vcp:native:endSpan', traceId, spanId, status, metadata),

    // 向量相似度计算
    cosineSimilarity: (
      a: number[],
      b: number[]
    ): Promise<{
      success: boolean
      data?: number
      error?: string
    }> => ipcRenderer.invoke('vcp:native:cosineSimilarity', a, b),

    // 批量相似度计算
    batchSimilarity: (
      query: number[],
      vectors: number[][],
      k: number
    ): Promise<{
      success: boolean
      data?: Array<{ index: number; score: number }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:batchSimilarity', query, vectors, k),

    // TagMemo 操作
    tagmemo: {
      // 初始化
      init: (
        alpha?: number,
        beta?: number
      ): Promise<{
        success: boolean
        error?: string
      }> => ipcRenderer.invoke('vcp:native:tagmemo:init', alpha, beta),

      // 更新共现
      update: (
        tag1: string,
        tag2: string,
        weight?: number
      ): Promise<{
        success: boolean
        error?: string
      }> => ipcRenderer.invoke('vcp:native:tagmemo:update', tag1, tag2, weight),

      // 获取关联
      getAssociations: (
        tag: string,
        topK?: number
      ): Promise<{
        success: boolean
        data?: Array<{
          tag: string
          pmi: number
          cooccurrence: number
          frequency: number
        }>
        error?: string
      }> => ipcRenderer.invoke('vcp:native:tagmemo:associations', tag, topK),

      // 扩展查询
      expandQuery: (
        tags: string[],
        factor?: number
      ): Promise<{
        success: boolean
        data?: string[]
        error?: string
      }> => ipcRenderer.invoke('vcp:native:tagmemo:expand', tags, factor),

      // 获取统计
      getStats: (): Promise<{
        success: boolean
        data?: {
          tagCount: number
          pairCount: number
          totalUpdates: number
          alpha: number
          beta: number
        }
        error?: string
      }> => ipcRenderer.invoke('vcp:native:tagmemo:stats')
    },

    // ==================== 记忆调用追踪 ====================

    // 获取记忆调用记录
    getMemoryTraces: (
      limit?: number
    ): Promise<{
      success: boolean
      data?: Array<{
        id: string
        timestamp: string
        caller: string
        method: string
        params: Record<string, unknown>
        result?: {
          success: boolean
          count?: number
          error?: string
        }
        durationMs: number
        backend?: string
        vectorInfo?: {
          dimension?: number
          count?: number
          location?: string
          similarity?: number
        }
        metadata?: Record<string, unknown>
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:traces', limit),

    // 获取记忆追踪统计
    getMemoryStats: (): Promise<{
      success: boolean
      data?: {
        totalCalls: number
        totalDurationMs: number
        callsByMethod: Record<string, number>
        callsByBackend: Record<string, number>
        averageDurationMs: number
        errorCount: number
      }
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:stats'),

    // 获取记忆调用链路图
    getMemoryCallGraph: (): Promise<{
      success: boolean
      data?: Array<{
        timestamp: string
        caller: string
        method: string
        backend?: string
        durationMs: number
        success: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:callGraph'),

    // 获取向量存储位置信息
    getVectorStorage: (): Promise<{
      success: boolean
      data?: Array<{
        backend: string
        location: string
        dimension: number
        documentCount: number
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:vectorStorage'),

    // 清空记忆调用记录
    clearMemoryTraces: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:clear'),

    // 启用/禁用记忆追踪
    setMemoryTracingEnabled: (
      enabled: boolean
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:setEnabled', enabled),

    // 检查追踪是否启用
    isMemoryTracingEnabled: (): Promise<{
      success: boolean
      data?: boolean
      error?: string
    }> => ipcRenderer.invoke('vcp:native:memory:isEnabled'),

    // ==================== 存储管理 ====================

    // 获取所有存储路径信息
    getStoragePaths: (): Promise<{
      success: boolean
      data?: Array<{
        name: string
        path: string
        type: 'directory' | 'file'
        size: number
        itemCount: number
        exists: boolean
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:storage:paths'),

    // 浏览存储目录内容
    browseStorage: (
      dirPath: string
    ): Promise<{
      success: boolean
      data?: Array<{
        name: string
        path: string
        type: 'directory' | 'file'
        size: number
        modifiedAt: string
      }>
      error?: string
    }> => ipcRenderer.invoke('vcp:native:storage:browse', dirPath),

    // 在系统文件管理器中打开目录
    openStorageInExplorer: (
      dirPath: string
    ): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('vcp:native:storage:openInExplorer', dirPath)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[Preload]Failed to expose APIs:', error as Error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

export type WindowApiType = typeof api
