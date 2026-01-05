export enum IpcChannel {
  App_GetCacheSize = 'app:get-cache-size',
  App_ClearCache = 'app:clear-cache',
  App_SetLaunchOnBoot = 'app:set-launch-on-boot',
  App_SetLanguage = 'app:set-language',
  App_SetEnableSpellCheck = 'app:set-enable-spell-check',
  App_SetSpellCheckLanguages = 'app:set-spell-check-languages',
  App_CheckForUpdate = 'app:check-for-update',
  App_QuitAndInstall = 'app:quit-and-install',
  App_Reload = 'app:reload',
  App_Quit = 'app:quit',
  App_Info = 'app:info',
  App_Proxy = 'app:proxy',
  App_SetLaunchToTray = 'app:set-launch-to-tray',
  App_SetTray = 'app:set-tray',
  App_SetTrayOnClose = 'app:set-tray-on-close',
  App_SetTheme = 'app:set-theme',
  App_SetAutoUpdate = 'app:set-auto-update',
  App_SetTestPlan = 'app:set-test-plan',
  App_SetTestChannel = 'app:set-test-channel',
  App_HandleZoomFactor = 'app:handle-zoom-factor',
  App_Select = 'app:select',
  App_HasWritePermission = 'app:has-write-permission',
  App_ResolvePath = 'app:resolve-path',
  App_IsPathInside = 'app:is-path-inside',
  App_Copy = 'app:copy',
  App_SetStopQuitApp = 'app:set-stop-quit-app',
  App_SetAppDataPath = 'app:set-app-data-path',
  App_GetDataPathFromArgs = 'app:get-data-path-from-args',
  App_FlushAppData = 'app:flush-app-data',
  App_IsNotEmptyDir = 'app:is-not-empty-dir',
  App_RelaunchApp = 'app:relaunch-app',
  App_IsBinaryExist = 'app:is-binary-exist',
  App_GetBinaryPath = 'app:get-binary-path',
  App_InstallUvBinary = 'app:install-uv-binary',
  App_InstallBunBinary = 'app:install-bun-binary',
  App_InstallOvmsBinary = 'app:install-ovms-binary',
  App_LogToMain = 'app:log-to-main',
  App_SaveData = 'app:save-data',
  App_GetDiskInfo = 'app:get-disk-info',
  App_SetFullScreen = 'app:set-full-screen',
  App_IsFullScreen = 'app:is-full-screen',
  App_GetSystemFonts = 'app:get-system-fonts',
  APP_CrashRenderProcess = 'app:crash-render-process',

  App_MacIsProcessTrusted = 'app:mac-is-process-trusted',
  App_MacRequestProcessTrust = 'app:mac-request-process-trust',

  App_QuoteToMain = 'app:quote-to-main',
  App_SetDisableHardwareAcceleration = 'app:set-disable-hardware-acceleration',

  Notification_Send = 'notification:send',
  Notification_OnClick = 'notification:on-click',

  Webview_SetOpenLinkExternal = 'webview:set-open-link-external',
  Webview_SetSpellCheckEnabled = 'webview:set-spell-check-enabled',
  Webview_SearchHotkey = 'webview:search-hotkey',
  Webview_PrintToPDF = 'webview:print-to-pdf',
  Webview_SaveAsHTML = 'webview:save-as-html',

  // Open
  Open_Path = 'open:path',
  Open_Website = 'open:website',

  Minapp = 'minapp',

  Config_Set = 'config:set',
  Config_Get = 'config:get',

  MiniWindow_Show = 'miniwindow:show',
  MiniWindow_Hide = 'miniwindow:hide',
  MiniWindow_Close = 'miniwindow:close',
  MiniWindow_Toggle = 'miniwindow:toggle',
  MiniWindow_SetPin = 'miniwindow:set-pin',

  // Mcp
  Mcp_AddServer = 'mcp:add-server',
  Mcp_RemoveServer = 'mcp:remove-server',
  Mcp_RestartServer = 'mcp:restart-server',
  Mcp_StopServer = 'mcp:stop-server',
  Mcp_ListTools = 'mcp:list-tools',
  Mcp_CallTool = 'mcp:call-tool',
  Mcp_ListPrompts = 'mcp:list-prompts',
  Mcp_GetPrompt = 'mcp:get-prompt',
  Mcp_ListResources = 'mcp:list-resources',
  Mcp_GetResource = 'mcp:get-resource',
  Mcp_GetInstallInfo = 'mcp:get-install-info',
  Mcp_ServersChanged = 'mcp:servers-changed',
  Mcp_ServersUpdated = 'mcp:servers-updated',
  Mcp_CheckConnectivity = 'mcp:check-connectivity',
  Mcp_UploadDxt = 'mcp:upload-dxt',
  Mcp_AbortTool = 'mcp:abort-tool',
  Mcp_GetServerVersion = 'mcp:get-server-version',
  Mcp_Progress = 'mcp:progress',
  Mcp_GetServerLogs = 'mcp:get-server-logs',
  Mcp_ServerLog = 'mcp:server-log',
  // Python
  Python_Execute = 'python:execute',

  // agent messages
  AgentMessage_PersistExchange = 'agent-message:persist-exchange',
  AgentMessage_GetHistory = 'agent-message:get-history',

  AgentToolPermission_Request = 'agent-tool-permission:request',
  AgentToolPermission_Response = 'agent-tool-permission:response',
  AgentToolPermission_Result = 'agent-tool-permission:result',

  //copilot
  Copilot_GetAuthMessage = 'copilot:get-auth-message',
  Copilot_GetCopilotToken = 'copilot:get-copilot-token',
  Copilot_SaveCopilotToken = 'copilot:save-copilot-token',
  Copilot_GetToken = 'copilot:get-token',
  Copilot_Logout = 'copilot:logout',
  Copilot_GetUser = 'copilot:get-user',

  // obsidian
  Obsidian_GetVaults = 'obsidian:get-vaults',
  Obsidian_GetFiles = 'obsidian:get-files',

  // nutstore
  Nutstore_GetSsoUrl = 'nutstore:get-sso-url',
  Nutstore_DecryptToken = 'nutstore:decrypt-token',
  Nutstore_GetDirectoryContents = 'nutstore:get-directory-contents',

  //aes
  Aes_Encrypt = 'aes:encrypt',
  Aes_Decrypt = 'aes:decrypt',

  Gemini_UploadFile = 'gemini:upload-file',
  Gemini_Base64File = 'gemini:base64-file',
  Gemini_RetrieveFile = 'gemini:retrieve-file',
  Gemini_ListFiles = 'gemini:list-files',
  Gemini_DeleteFile = 'gemini:delete-file',

  // VertexAI
  VertexAI_GetAuthHeaders = 'vertexai:get-auth-headers',
  VertexAI_GetAccessToken = 'vertexai:get-access-token',
  VertexAI_ClearAuthCache = 'vertexai:clear-auth-cache',

  Windows_ResetMinimumSize = 'window:reset-minimum-size',
  Windows_SetMinimumSize = 'window:set-minimum-size',
  Windows_Resize = 'window:resize',
  Windows_GetSize = 'window:get-size',
  Windows_Minimize = 'window:minimize',
  Windows_Maximize = 'window:maximize',
  Windows_Unmaximize = 'window:unmaximize',
  Windows_Close = 'window:close',
  Windows_IsMaximized = 'window:is-maximized',
  Windows_MaximizedChanged = 'window:maximized-changed',
  Windows_NavigateToAbout = 'window:navigate-to-about',

  KnowledgeBase_Create = 'knowledge-base:create',
  KnowledgeBase_Reset = 'knowledge-base:reset',
  KnowledgeBase_Delete = 'knowledge-base:delete',
  KnowledgeBase_Add = 'knowledge-base:add',
  KnowledgeBase_Remove = 'knowledge-base:remove',
  KnowledgeBase_Search = 'knowledge-base:search',
  KnowledgeBase_Rerank = 'knowledge-base:rerank',
  KnowledgeBase_Check_Quota = 'knowledge-base:check-quota',

  //file
  File_Open = 'file:open',
  File_OpenPath = 'file:openPath',
  File_Save = 'file:save',
  File_Select = 'file:select',
  File_Upload = 'file:upload',
  File_Clear = 'file:clear',
  File_Read = 'file:read',
  File_ReadExternal = 'file:readExternal',
  File_Delete = 'file:delete',
  File_DeleteDir = 'file:deleteDir',
  File_DeleteExternalFile = 'file:deleteExternalFile',
  File_DeleteExternalDir = 'file:deleteExternalDir',
  File_Move = 'file:move',
  File_MoveDir = 'file:moveDir',
  File_Rename = 'file:rename',
  File_RenameDir = 'file:renameDir',
  File_Get = 'file:get',
  File_SelectFolder = 'file:selectFolder',
  File_CreateTempFile = 'file:createTempFile',
  File_Mkdir = 'file:mkdir',
  File_Write = 'file:write',
  File_WriteWithId = 'file:writeWithId',
  File_SaveImage = 'file:saveImage',
  File_Base64Image = 'file:base64Image',
  File_SaveBase64Image = 'file:saveBase64Image',
  File_SavePastedImage = 'file:savePastedImage',
  File_Download = 'file:download',
  File_Copy = 'file:copy',
  File_BinaryImage = 'file:binaryImage',
  File_Base64File = 'file:base64File',
  File_GetPdfInfo = 'file:getPdfInfo',
  Fs_Read = 'fs:read',
  Fs_ReadText = 'fs:readText',
  Fs_ReadBase64 = 'fs:readBase64',
  Fs_Stat = 'fs:stat',
  Fs_Exists = 'fs:exists',
  Fs_Unlink = 'fs:unlink',
  Fs_Mkdir = 'fs:mkdir',
  Fs_Rename = 'fs:rename',

  // Shell execution
  Shell_Execute = 'shell:execute',
  Shell_Kill = 'shell:kill',

  File_OpenWithRelativePath = 'file:openWithRelativePath',
  File_IsTextFile = 'file:isTextFile',
  File_ListDirectory = 'file:listDirectory',
  File_GetDirectoryStructure = 'file:getDirectoryStructure',
  File_GetDirectoryStructureGeneric = 'file:getDirectoryStructureGeneric',
  File_CheckFileName = 'file:checkFileName',
  File_ValidateNotesDirectory = 'file:validateNotesDirectory',
  File_StartWatcher = 'file:startWatcher',
  File_StopWatcher = 'file:stopWatcher',
  File_PauseWatcher = 'file:pauseWatcher',
  File_ResumeWatcher = 'file:resumeWatcher',
  File_BatchUploadMarkdown = 'file:batchUploadMarkdown',
  File_ShowInFolder = 'file:showInFolder',

  // file service
  FileService_Upload = 'file-service:upload',
  FileService_List = 'file-service:list',
  FileService_Delete = 'file-service:delete',
  FileService_Retrieve = 'file-service:retrieve',

  Export_Word = 'export:word',

  Shortcuts_Update = 'shortcuts:update',

  // backup
  Backup_Backup = 'backup:backup',
  Backup_Restore = 'backup:restore',
  Backup_BackupToWebdav = 'backup:backupToWebdav',
  Backup_RestoreFromWebdav = 'backup:restoreFromWebdav',
  Backup_ListWebdavFiles = 'backup:listWebdavFiles',
  Backup_CheckConnection = 'backup:checkConnection',
  Backup_CreateDirectory = 'backup:createDirectory',
  Backup_DeleteWebdavFile = 'backup:deleteWebdavFile',
  Backup_BackupToLocalDir = 'backup:backupToLocalDir',
  Backup_RestoreFromLocalBackup = 'backup:restoreFromLocalBackup',
  Backup_ListLocalBackupFiles = 'backup:listLocalBackupFiles',
  Backup_DeleteLocalBackupFile = 'backup:deleteLocalBackupFile',
  Backup_BackupToS3 = 'backup:backupToS3',
  Backup_RestoreFromS3 = 'backup:restoreFromS3',
  Backup_ListS3Files = 'backup:listS3Files',
  Backup_DeleteS3File = 'backup:deleteS3File',
  Backup_CheckS3Connection = 'backup:checkS3Connection',
  Backup_CreateLanTransferBackup = 'backup:createLanTransferBackup',
  Backup_DeleteTempBackup = 'backup:deleteTempBackup',

  // zip
  Zip_Compress = 'zip:compress',
  Zip_Decompress = 'zip:decompress',

  // system
  System_GetDeviceType = 'system:getDeviceType',
  System_GetHostname = 'system:getHostname',
  System_GetCpuName = 'system:getCpuName',
  System_CheckGitBash = 'system:checkGitBash',
  System_GetGitBashPath = 'system:getGitBashPath',
  System_GetGitBashPathInfo = 'system:getGitBashPathInfo',
  System_SetGitBashPath = 'system:setGitBashPath',
  System_GetPath = 'system:getPath',

  // DevTools
  System_ToggleDevTools = 'system:toggleDevTools',

  // events
  BackupProgress = 'backup-progress',
  ThemeUpdated = 'theme:updated',
  RestoreProgress = 'restore-progress',
  UpdateError = 'update-error',
  UpdateAvailable = 'update-available',
  UpdateNotAvailable = 'update-not-available',
  DownloadProgress = 'download-progress',
  UpdateDownloaded = 'update-downloaded',
  DownloadUpdate = 'download-update',

  DirectoryProcessingPercent = 'directory-processing-percent',

  FullscreenStatusChanged = 'fullscreen-status-changed',

  HideMiniWindow = 'hide-mini-window',
  ShowMiniWindow = 'show-mini-window',

  ReduxStateChange = 'redux-state-change',
  ReduxStoreReady = 'redux-store-ready',

  // Search Window
  SearchWindow_Open = 'search-window:open',
  SearchWindow_Close = 'search-window:close',
  SearchWindow_OpenUrl = 'search-window:open-url',

  //Store Sync
  StoreSync_Subscribe = 'store-sync:subscribe',
  StoreSync_Unsubscribe = 'store-sync:unsubscribe',
  StoreSync_OnUpdate = 'store-sync:on-update',
  StoreSync_BroadcastSync = 'store-sync:broadcast-sync',

  // Provider
  Provider_AddKey = 'provider:add-key',

  //Selection Assistant
  Selection_TextSelected = 'selection:text-selected',
  Selection_ToolbarHide = 'selection:toolbar-hide',
  Selection_ToolbarVisibilityChange = 'selection:toolbar-visibility-change',
  Selection_ToolbarDetermineSize = 'selection:toolbar-determine-size',
  Selection_WriteToClipboard = 'selection:write-to-clipboard',
  Selection_SetEnabled = 'selection:set-enabled',
  Selection_SetTriggerMode = 'selection:set-trigger-mode',
  Selection_SetFilterMode = 'selection:set-filter-mode',
  Selection_SetFilterList = 'selection:set-filter-list',
  Selection_SetFollowToolbar = 'selection:set-follow-toolbar',
  Selection_SetRemeberWinSize = 'selection:set-remeber-win-size',
  Selection_ActionWindowClose = 'selection:action-window-close',
  Selection_ActionWindowMinimize = 'selection:action-window-minimize',
  Selection_ActionWindowPin = 'selection:action-window-pin',
  // [Windows only] Electron bug workaround - can be removed once https://github.com/electron/electron/issues/48554 is fixed
  Selection_ActionWindowResize = 'selection:action-window-resize',
  Selection_ProcessAction = 'selection:process-action',
  Selection_UpdateActionData = 'selection:update-action-data',

  // Memory
  Memory_Add = 'memory:add',
  Memory_Search = 'memory:search',
  Memory_List = 'memory:list',
  Memory_Delete = 'memory:delete',
  Memory_Update = 'memory:update',
  Memory_Get = 'memory:get',
  Memory_SetConfig = 'memory:set-config',
  Memory_DeleteUser = 'memory:delete-user',
  Memory_DeleteAllMemoriesForUser = 'memory:delete-all-memories-for-user',
  Memory_GetUsersList = 'memory:get-users-list',
  Memory_MigrateMemoryDb = 'memory:migrate-memory-db',
  Memory_TestFeatures = 'memory:test-features',
  Memory_GetStats = 'memory:get-stats',

  // TRACE
  TRACE_SAVE_DATA = 'trace:saveData',
  TRACE_GET_DATA = 'trace:getData',
  TRACE_SAVE_ENTITY = 'trace:saveEntity',
  TRACE_GET_ENTITY = 'trace:getEntity',
  TRACE_BIND_TOPIC = 'trace:bindTopic',
  TRACE_CLEAN_TOPIC = 'trace:cleanTopic',
  TRACE_TOKEN_USAGE = 'trace:tokenUsage',
  TRACE_CLEAN_HISTORY = 'trace:cleanHistory',
  TRACE_OPEN_WINDOW = 'trace:openWindow',
  TRACE_SET_TITLE = 'trace:setTitle',
  TRACE_ADD_END_MESSAGE = 'trace:addEndMessage',
  TRACE_CLEAN_LOCAL_DATA = 'trace:cleanLocalData',
  TRACE_ADD_STREAM_MESSAGE = 'trace:addStreamMessage',

  // API Server
  ApiServer_Start = 'api-server:start',
  ApiServer_Stop = 'api-server:stop',
  ApiServer_Restart = 'api-server:restart',
  ApiServer_GetStatus = 'api-server:get-status',
  ApiServer_Ready = 'api-server:ready',
  // NOTE: This api is not be used.
  ApiServer_GetConfig = 'api-server:get-config',

  // Anthropic OAuth
  Anthropic_StartOAuthFlow = 'anthropic:start-oauth-flow',
  Anthropic_CompleteOAuthWithCode = 'anthropic:complete-oauth-with-code',
  Anthropic_CancelOAuthFlow = 'anthropic:cancel-oauth-flow',
  Anthropic_GetAccessToken = 'anthropic:get-access-token',
  Anthropic_HasCredentials = 'anthropic:has-credentials',
  Anthropic_ClearCredentials = 'anthropic:clear-credentials',

  // CodeTools
  CodeTools_Run = 'code-tools:run',
  CodeTools_GetAvailableTerminals = 'code-tools:get-available-terminals',
  CodeTools_SetCustomTerminalPath = 'code-tools:set-custom-terminal-path',
  CodeTools_GetCustomTerminalPath = 'code-tools:get-custom-terminal-path',
  CodeTools_RemoveCustomTerminalPath = 'code-tools:remove-custom-terminal-path',

  // OCR
  OCR_ocr = 'ocr:ocr',
  OCR_ListProviders = 'ocr:list-providers',

  // OVMS
  Ovms_AddModel = 'ovms:add-model',
  Ovms_StopAddModel = 'ovms:stop-addmodel',
  Ovms_GetModels = 'ovms:get-models',
  Ovms_IsRunning = 'ovms:is-running',
  Ovms_GetStatus = 'ovms:get-status',
  Ovms_RunOVMS = 'ovms:run-ovms',
  Ovms_StopOVMS = 'ovms:stop-ovms',

  // CherryAI
  Cherryai_GetSignature = 'cherryai:get-signature',

  // Claude Code Plugins
  ClaudeCodePlugin_ListAvailable = 'claudeCodePlugin:list-available',
  ClaudeCodePlugin_Install = 'claudeCodePlugin:install',
  ClaudeCodePlugin_Uninstall = 'claudeCodePlugin:uninstall',
  ClaudeCodePlugin_ListInstalled = 'claudeCodePlugin:list-installed',
  ClaudeCodePlugin_InvalidateCache = 'claudeCodePlugin:invalidate-cache',
  ClaudeCodePlugin_ReadContent = 'claudeCodePlugin:read-content',
  ClaudeCodePlugin_WriteContent = 'claudeCodePlugin:write-content',

  // Local Transfer
  LocalTransfer_ListServices = 'local-transfer:list',
  LocalTransfer_StartScan = 'local-transfer:start-scan',
  LocalTransfer_StopScan = 'local-transfer:stop-scan',
  LocalTransfer_ServicesUpdated = 'local-transfer:services-updated',
  LocalTransfer_Connect = 'local-transfer:connect',
  LocalTransfer_Disconnect = 'local-transfer:disconnect',
  LocalTransfer_ClientEvent = 'local-transfer:client-event',
  LocalTransfer_SendFile = 'local-transfer:send-file',
  LocalTransfer_CancelTransfer = 'local-transfer:cancel-transfer',

  // Workflow MCP Bridge (Main <-> Renderer)
  Workflow_GenerateImage = 'workflow:generate-image',
  Workflow_ExecuteNode = 'workflow:execute-node',
  Workflow_GetWorkflowList = 'workflow:get-workflow-list',
  Workflow_GetWorkflowById = 'workflow:get-workflow-by-id',
  Workflow_ExecuteWorkflow = 'workflow:execute-workflow',
  Workflow_CancelExecution = 'workflow:cancel-execution',
  Workflow_GetExecutionStatus = 'workflow:get-execution-status',

  // MCP Bridge (共享 AI 服务桥接)
  MCP_Bridge_Response = 'mcp-bridge:response',
  MCP_Bridge_VisionAnalysis = 'mcp-bridge:vision-analysis',
  MCP_Bridge_GenerateText = 'mcp-bridge:generate-text',
  MCP_Bridge_GenerateImage = 'mcp-bridge:generate-image',
  MCP_Bridge_AutonomousGenerate = 'mcp-bridge:autonomous-generate',
  MCP_Bridge_CollaborativeGenerate = 'mcp-bridge:collaborative-generate',
  MCP_Bridge_SearchKnowledge = 'mcp-bridge:search-knowledge',
  MCP_Bridge_ListKnowledgeBases = 'mcp-bridge:list-knowledge-bases',
  MCP_Bridge_ExecuteWorkflow = 'mcp-bridge:execute-workflow',
  MCP_Bridge_ListWorkflows = 'mcp-bridge:list-workflows',
  MCP_Bridge_WebSearch = 'mcp-bridge:web-search',

  // VCP Agent
  VCP_Agent_List = 'vcp:agent:list',
  VCP_Agent_Get = 'vcp:agent:get',
  VCP_Agent_Create = 'vcp:agent:create',
  VCP_Agent_Update = 'vcp:agent:update',
  VCP_Agent_Delete = 'vcp:agent:delete',
  VCP_Agent_Activate = 'vcp:agent:activate',
  VCP_Agent_Import = 'vcp:agent:import',
  VCP_Agent_ResolveTemplateVariables = 'vcp:agent:resolveTemplateVariables',

  // VCP Variable
  VCP_Variable_List = 'vcp:variable:list',
  VCP_Variable_Create = 'vcp:variable:create',
  VCP_Variable_Update = 'vcp:variable:update',
  VCP_Variable_Delete = 'vcp:variable:delete',

  // VCP Template
  VCP_Template_List = 'vcp:template:list',
  VCP_Template_Create = 'vcp:template:create',
  VCP_Template_Update = 'vcp:template:update',
  VCP_Template_Delete = 'vcp:template:delete',
  VCP_Template_Render = 'vcp:template:render',

  // VCP Context Injector
  VCP_Injector_Rule_List = 'vcp:injector:rule:list',
  VCP_Injector_Rule_Create = 'vcp:injector:rule:create',
  VCP_Injector_Rule_Update = 'vcp:injector:rule:update',
  VCP_Injector_Rule_Delete = 'vcp:injector:rule:delete',
  VCP_Injector_Rule_Toggle = 'vcp:injector:rule:toggle',
  VCP_Injector_Preset_List = 'vcp:injector:preset:list',
  VCP_Injector_Preset_Create = 'vcp:injector:preset:create',
  VCP_Injector_Preset_Activate = 'vcp:injector:preset:activate',
  VCP_Injector_Preset_Delete = 'vcp:injector:preset:delete',
  VCP_Injector_Preset_Update = 'vcp:injector:preset:update',
  VCP_Injector_Preset_CreateDirector = 'vcp:injector:preset:createDirector',
  VCP_Injector_Preset_CreateRoleplay = 'vcp:injector:preset:createRoleplay',
  VCP_Injector_Execute = 'vcp:injector:execute',

  // VCP Diary
  VCP_Diary_ParseDeclarations = 'vcp:diary:parseDeclarations',
  VCP_Diary_Search = 'vcp:diary:search',
  VCP_Diary_Write = 'vcp:diary:write',
  VCP_Diary_Read = 'vcp:diary:read',
  VCP_Diary_List = 'vcp:diary:list',
  VCP_Diary_GetStats = 'vcp:diary:getStats',
  VCP_Diary_Delete = 'vcp:diary:delete',
  VCP_Diary_Edit = 'vcp:diary:edit',
  VCP_Diary_Summarize = 'vcp:diary:summarize',
  VCP_Diary_SyncToKnowledge = 'vcp:diary:syncToKnowledge',
  VCP_Context_Execute = 'vcp:context:execute',

  // VCP Enhanced Search
  VCP_Search_Enhanced = 'vcp:search:enhanced',
  VCP_Knowledge_List = 'vcp:knowledge:list',

  // VCP Async Results
  VCP_Async_CreateTask = 'vcp:async:createTask',
  VCP_Async_StoreResult = 'vcp:async:storeResult',
  VCP_Async_StoreError = 'vcp:async:storeError',
  VCP_Async_GetResult = 'vcp:async:getResult',
  VCP_Async_DeleteResult = 'vcp:async:deleteResult',
  VCP_Async_ReplacePlaceholders = 'vcp:async:replacePlaceholders',
  VCP_Async_GetAllResults = 'vcp:async:getAllResults',
  VCP_Async_CleanupExpired = 'vcp:async:cleanupExpired',
  VCP_Async_Callback = 'vcp:async:callback',

  // VCP Callback Server (异步插件回调HTTP端点)
  VCP_Callback_GetStatus = 'vcp:callback:getStatus',
  VCP_Callback_Start = 'vcp:callback:start',
  VCP_Callback_Stop = 'vcp:callback:stop',
  VCP_Callback_GetUrl = 'vcp:callback:getUrl',

  // ShowVCP Debug
  ShowVCP_Enable = 'showvcp:enable',
  ShowVCP_Disable = 'showvcp:disable',
  ShowVCP_GetConfig = 'showvcp:getConfig',
  ShowVCP_UpdateConfig = 'showvcp:updateConfig',
  ShowVCP_GetCurrentSession = 'showvcp:getCurrentSession',
  ShowVCP_GetHistory = 'showvcp:getHistory',
  ShowVCP_ClearHistory = 'showvcp:clearHistory',
  ShowVCP_FormatSession = 'showvcp:formatSession',
  // ShowVCP Events (main → renderer)
  ShowVCP_CallUpdate = 'showvcp:callUpdate',
  ShowVCP_ConfigChanged = 'showvcp:configChanged',
  // ShowVCP Session & Call Tracking (for vcpContextPlugin)
  ShowVCP_StartSession = 'showvcp:startSession',
  ShowVCP_EndSession = 'showvcp:endSession',
  ShowVCP_LogCallStart = 'showvcp:logCallStart',
  ShowVCP_LogCallEnd = 'showvcp:logCallEnd',
  ShowVCP_LogInjection = 'showvcp:logInjection',

  // VCPInfo - 实时状态推送
  VCPInfo_GetActiveSessions = 'vcpinfo:getActiveSessions',
  VCPInfo_GetRecentSessions = 'vcpinfo:getRecentSessions',
  VCPInfo_GetSession = 'vcpinfo:getSession',
  VCPInfo_ClearSessions = 'vcpinfo:clearSessions',

  // VCPLog - 工具调用日志
  VCPLog_GetRecentCalls = 'vcplog:getRecentCalls',
  VCPLog_GetRecentLogs = 'vcplog:getRecentLogs',
  VCPLog_GetTraceCalls = 'vcplog:getTraceCalls',
  VCPLog_GetCall = 'vcplog:getCall',
  VCPLog_Clear = 'vcplog:clear',
  VCPLog_Write = 'vcplog:write',

  // VCPInfo - 事件发布
  VCPInfo_PublishEvent = 'vcpinfo:publishEvent',
  VCPInfo_Subscribe = 'vcpinfo:subscribe',

  // Context Intelligence (净化器与幻觉抑制)
  Context_Purify = 'context:purify',
  Context_Purify_GetConfig = 'context:purify:getConfig',
  Context_Purify_UpdateConfig = 'context:purify:updateConfig',
  Context_Hallucination_Suppress = 'context:hallucination:suppress',
  Context_Hallucination_GetConfig = 'context:hallucination:getConfig',
  Context_Hallucination_UpdateConfig = 'context:hallucination:updateConfig',

  // Flow Lock (话题锁定)
  FlowLock_Create = 'flowlock:create',
  FlowLock_Get = 'flowlock:get',
  FlowLock_Unlock = 'flowlock:unlock',
  FlowLock_Extend = 'flowlock:extend',
  FlowLock_DetectDeviation = 'flowlock:detectDeviation',
  FlowLock_ShouldTriggerLock = 'flowlock:shouldTriggerLock',
  FlowLock_ShouldTriggerUnlock = 'flowlock:shouldTriggerUnlock',
  FlowLock_GetActiveLocks = 'flowlock:getActiveLocks',
  FlowLock_UpdateContext = 'flowlock:updateContext',

  // Auto Continue (自动续写/心流锁)
  AutoContinue_Start = 'autocontinue:start',
  AutoContinue_Stop = 'autocontinue:stop',
  AutoContinue_Pause = 'autocontinue:pause',
  AutoContinue_Resume = 'autocontinue:resume',
  AutoContinue_GetSession = 'autocontinue:getSession',
  AutoContinue_GetActiveSessions = 'autocontinue:getActiveSessions',
  AutoContinue_OnMessageComplete = 'autocontinue:onMessageComplete',
  AutoContinue_SetCustomPrompt = 'autocontinue:setCustomPrompt',
  AutoContinue_IsActive = 'autocontinue:isActive',

  // Agent Collaboration
  AgentCollab_RegisterCapability = 'agent:collab:registerCapability',
  AgentCollab_GetAvailableAgents = 'agent:collab:getAvailableAgents',
  AgentCollab_FindBestAgent = 'agent:collab:findBestAgent',
  AgentCollab_SendMessage = 'agent:collab:sendMessage',
  AgentCollab_GetMessages = 'agent:collab:getMessages',
  AgentCollab_CreateTask = 'agent:collab:createTask',
  AgentCollab_AssignTask = 'agent:collab:assignTask',
  AgentCollab_UpdateTaskStatus = 'agent:collab:updateTaskStatus',
  AgentCollab_GetTasks = 'agent:collab:getTasks',
  AgentCollab_ShareKnowledge = 'agent:collab:shareKnowledge',
  AgentCollab_SearchKnowledge = 'agent:collab:searchKnowledge',
  AgentCollab_CreateVoting = 'agent:collab:createVoting',
  AgentCollab_SubmitVote = 'agent:collab:submitVote',
  AgentCollab_CloseVoting = 'agent:collab:closeVoting',
  AgentCollab_GetStats = 'agent:collab:getStats',

  // Behavior Control
  BehaviorCtrl_GetConfig = 'behavior:getConfig',
  BehaviorCtrl_UpdateConfig = 'behavior:updateConfig',
  BehaviorCtrl_AddModelAdaptation = 'behavior:addModelAdaptation',
  BehaviorCtrl_GetModelAdaptations = 'behavior:getModelAdaptations',
  BehaviorCtrl_DeleteModelAdaptation = 'behavior:deleteModelAdaptation',
  BehaviorCtrl_AddDetectorXRule = 'behavior:addDetectorXRule',
  BehaviorCtrl_GetDetectorXRules = 'behavior:getDetectorXRules',
  BehaviorCtrl_AddSuperDetectorXRule = 'behavior:addSuperDetectorXRule',
  BehaviorCtrl_GetSuperDetectorXRules = 'behavior:getSuperDetectorXRules',
  BehaviorCtrl_AddPhraseSuppression = 'behavior:addPhraseSuppression',
  BehaviorCtrl_GetPhraseSuppressions = 'behavior:getPhraseSuppressions',
  BehaviorCtrl_ProcessSystemPrompt = 'behavior:processSystemPrompt',
  BehaviorCtrl_ProcessAIOutput = 'behavior:processAIOutput',

  // Advanced Memory Search (LightMemo / DeepMemo / MeshMemo)
  AdvancedMemory_LightMemoSearch = 'advanced-memory:lightmemo:search',
  AdvancedMemory_DeepMemoSearch = 'advanced-memory:deepmemo:search',
  AdvancedMemory_MeshMemoSearch = 'advanced-memory:meshmemo:search',
  AdvancedMemory_AddDocument = 'advanced-memory:add-document',
  AdvancedMemory_AddDocuments = 'advanced-memory:add-documents',
  AdvancedMemory_Clear = 'advanced-memory:clear',
  AdvancedMemory_GetDocumentCount = 'advanced-memory:get-document-count',

  // Unified Memory Manager (统一记忆/知识管理)
  UnifiedMemory_Search = 'unified-memory:search',
  UnifiedMemory_GetStats = 'unified-memory:get-stats',
  UnifiedMemory_ClearBackend = 'unified-memory:clear-backend',
  UnifiedMemory_GetBackends = 'unified-memory:get-backends',

  // AIMemo (AI军团并发检索)
  AIMemo_Search = 'aimemo:search',
  AIMemo_QuickSearch = 'aimemo:quick-search',
  AIMemo_DeepSearch = 'aimemo:deep-search',
  AIMemo_GetAgents = 'aimemo:get-agents',
  AIMemo_RegisterAgent = 'aimemo:register-agent',
  // AIMemo Synthesis (AI 记忆综合 - VCPToolBox 完整功能)
  AIMemo_SearchWithSynthesis = 'aimemo:search-with-synthesis',
  AIMemo_QuickSearchWithSynthesis = 'aimemo:quick-search-with-synthesis',
  // Unified Memory Synthesis
  UnifiedMemory_SearchWithSynthesis = 'unified-memory:search-with-synthesis',
  UnifiedMemory_QuickSearchWithSynthesis = 'unified-memory:quick-search-with-synthesis',

  // Self-Learning System (三大自学习系统)
  SelfLearning_RecordQuery = 'self-learning:record-query',
  SelfLearning_RecordPositiveFeedback = 'self-learning:record-positive-feedback',
  SelfLearning_RecordNegativeFeedback = 'self-learning:record-negative-feedback',
  SelfLearning_GetLearnedWeight = 'self-learning:get-learned-weight',
  SelfLearning_DiscoverAssociations = 'self-learning:discover-associations',
  SelfLearning_ConfirmSuggestion = 'self-learning:confirm-suggestion',
  SelfLearning_GetPendingSuggestions = 'self-learning:get-pending-suggestions',
  SelfLearning_GetStats = 'self-learning:get-stats',
  SelfLearning_GetTagStats = 'self-learning:get-tag-stats',
  SelfLearning_Reset = 'self-learning:reset',

  // Knowledge File Watcher (知识库文件监控)
  KnowledgeWatcher_AddPath = 'knowledge-watcher:add-path',
  KnowledgeWatcher_RemovePath = 'knowledge-watcher:remove-path',
  KnowledgeWatcher_GetStatus = 'knowledge-watcher:get-status',
  KnowledgeWatcher_GetWatchedPaths = 'knowledge-watcher:get-watched-paths',
  KnowledgeWatcher_StopAll = 'knowledge-watcher:stop-all',

  // Memory Master (记忆大师)
  MemoryMaster_AutoTag = 'memory-master:auto-tag',
  MemoryMaster_ValidateTags = 'memory-master:validate-tags',
  MemoryMaster_DetectAndSuggest = 'memory-master:detect-and-suggest',
  MemoryMaster_BatchOrganize = 'memory-master:batch-organize',
  MemoryMaster_MergeContents = 'memory-master:merge-contents',
  MemoryMaster_Deduplicate = 'memory-master:deduplicate',
  MemoryMaster_GetTagPool = 'memory-master:get-tag-pool',
  MemoryMaster_GetTagStats = 'memory-master:get-tag-stats',
  MemoryMaster_GetTopTags = 'memory-master:get-top-tags',
  MemoryMaster_AddTagsToPool = 'memory-master:add-tags-to-pool',
  MemoryMaster_GetConfig = 'memory-master:get-config',
  MemoryMaster_UpdateConfig = 'memory-master:update-config',

  // ==================== Integrated Memory Coordinator (统一记忆协调器) ====================

  // 创建
  IntegratedMemory_Create = 'integrated-memory:create',
  IntegratedMemory_BatchCreate = 'integrated-memory:batch-create',

  // 搜索
  IntegratedMemory_IntelligentSearch = 'integrated-memory:intelligent-search',
  IntegratedMemory_GetSuggestions = 'integrated-memory:get-suggestions',

  // 反馈
  IntegratedMemory_RecordPositiveFeedback = 'integrated-memory:record-positive-feedback',
  IntegratedMemory_RecordNegativeFeedback = 'integrated-memory:record-negative-feedback',

  // 整理
  IntegratedMemory_Organize = 'integrated-memory:organize',
  IntegratedMemory_DiscoverAssociations = 'integrated-memory:discover-associations',

  // 统计
  IntegratedMemory_GetStats = 'integrated-memory:get-stats',
  IntegratedMemory_GetLearningProgress = 'integrated-memory:get-learning-progress',

  // 配置
  IntegratedMemory_GetConfig = 'integrated-memory:get-config',
  IntegratedMemory_UpdateConfig = 'integrated-memory:update-config',

  // MemoryBrain (统一记忆大脑)
  MemoryBrain_Search = 'memory-brain:search',
  MemoryBrain_QuickSearch = 'memory-brain:quick-search',
  MemoryBrain_DeepSearch = 'memory-brain:deep-search',
  MemoryBrain_WaveRAGSearch = 'memory-brain:waverag-search',
  MemoryBrain_CreateMemory = 'memory-brain:create-memory',
  MemoryBrain_GetStatus = 'memory-brain:get-status',
  MemoryBrain_GetConfig = 'memory-brain:get-config',
  MemoryBrain_UpdateConfig = 'memory-brain:update-config',
  MemoryBrain_ConfigureNeuralRerank = 'memory-brain:configure-neural-rerank',
  MemoryBrain_RecordPositiveFeedback = 'memory-brain:record-positive-feedback',
  MemoryBrain_RecordNegativeFeedback = 'memory-brain:record-negative-feedback',
  MemoryBrain_GetTraceStats = 'memory-brain:get-trace-stats',
  MemoryBrain_GetTraceRecords = 'memory-brain:get-trace-records',
  MemoryBrain_GetCallGraph = 'memory-brain:get-call-graph',
  MemoryBrain_GetVectorStorageInfo = 'memory-brain:get-vector-storage-info',

  // DailyNoteWrite (Agent 日记写入)
  Note_AgentWrite = 'note:agent-write',
  Note_GetPluginDefinition = 'note:get-plugin-definition',
  Note_GetPluginConfig = 'note:get-plugin-config',
  Note_UpdatePluginConfig = 'note:update-plugin-config',
  Note_Refresh = 'note:refresh', // 通知前端刷新笔记列表

  // Notes Search (Native ChineseSearchEngine)
  Note_FullTextSearch = 'note:full-text-search',
  Note_InitSearchIndex = 'note:init-search-index',
  Note_GetSearchStats = 'note:get-search-stats',

  // Group Chat (Multi-Agent Collaboration)
  GroupChat_Create = 'groupchat:create',
  GroupChat_AddAgent = 'groupchat:addAgent',
  GroupChat_AddUnifiedAgent = 'groupchat:addUnifiedAgent',
  GroupChat_AddAgents = 'groupchat:addAgents',
  GroupChat_RemoveAgent = 'groupchat:removeAgent',
  GroupChat_Start = 'groupchat:start',
  GroupChat_End = 'groupchat:end',
  GroupChat_HandleUserInput = 'groupchat:handleUserInput',
  GroupChat_RequestSpeak = 'groupchat:requestSpeak',
  GroupChat_GetState = 'groupchat:getState',
  GroupChat_GetMessages = 'groupchat:getMessages',
  GroupChat_GetAgents = 'groupchat:getAgents',
  GroupChat_Destroy = 'groupchat:destroy',
  GroupChat_ListSessions = 'groupchat:listSessions',
  GroupChat_AdaptAssistant = 'groupchat:adaptAssistant',
  GroupChat_GetUnifiedAgents = 'groupchat:getUnifiedAgents',
  GroupChat_Interrupt = 'groupchat:interrupt', // 中断正在进行的请求
  GroupChat_RedoMessage = 'groupchat:redoMessage', // 重新回复消息

  // Group Chat Persistence (IndexedDB)
  GroupChat_Persist_SaveSession = 'groupchat:persist:saveSession',
  GroupChat_Persist_LoadSession = 'groupchat:persist:loadSession',
  GroupChat_Persist_GetAllSessions = 'groupchat:persist:getAllSessions',
  GroupChat_Persist_DeleteSession = 'groupchat:persist:deleteSession',
  GroupChat_Persist_SaveMessage = 'groupchat:persist:saveMessage',
  GroupChat_Persist_SaveMessages = 'groupchat:persist:saveMessages',
  GroupChat_Persist_LoadMessages = 'groupchat:persist:loadMessages',
  GroupChat_Persist_GetMessageCount = 'groupchat:persist:getMessageCount',

  // Agent Invoke (VCP-style agent calling)
  AgentInvoke_Sync = 'agent:invoke:sync',
  AgentInvoke_Async = 'agent:invoke:async',
  AgentInvoke_GetTaskStatus = 'agent:invoke:getTaskStatus',
  AgentInvoke_GetTaskResult = 'agent:invoke:getTaskResult',
  AgentInvoke_ListTasks = 'agent:invoke:listTasks',
  AgentInvoke_ListAvailableAgents = 'agent:invoke:listAvailableAgents',
  AgentInvoke_Execute = 'agent:invoke:execute',

  // WebSocket Server
  WebSocket_GetStatus = 'websocket:getStatus',
  WebSocket_GetClients = 'websocket:getClients',
  WebSocket_GetPlugins = 'websocket:getPlugins',
  WebSocket_Broadcast = 'websocket:broadcast',
  WebSocket_SendToClient = 'websocket:sendToClient',
  WebSocket_PushLog = 'websocket:pushLog',
  WebSocket_PushAIMessage = 'websocket:pushAIMessage',
  WebSocket_PushAgentResult = 'websocket:pushAgentResult',

  // ==================== VCP Plugin System (VCPToolBox Integration) ====================

  // VCP Plugin Management
  VCPPlugin_Initialize = 'vcp:plugin:initialize',
  VCPPlugin_List = 'vcp:plugin:list',
  VCPPlugin_Get = 'vcp:plugin:get',
  VCPPlugin_Enable = 'vcp:plugin:enable',
  VCPPlugin_Disable = 'vcp:plugin:disable',
  VCPPlugin_Reload = 'vcp:plugin:reload',
  VCPPlugin_GetConfig = 'vcp:plugin:getConfig',
  VCPPlugin_UpdateConfig = 'vcp:plugin:updateConfig',
  VCPPlugin_UpdateModelConfig = 'vcp:plugin:updateModelConfig',
  VCPPlugin_GetPlaceholders = 'vcp:plugin:getPlaceholders',
  VCPPlugin_Sync = 'vcp:plugin:sync',
  VCPPlugin_GetSyncStatus = 'vcp:plugin:getSyncStatus',
  VCPPlugin_GetStats = 'vcp:plugin:getStats',
  VCPPlugin_GetDetails = 'vcp:plugin:getDetails',
  VCPPlugin_LoadFromPath = 'vcp:plugin:loadFromPath',
  VCPPlugin_GetPluginsDir = 'vcp:plugin:getPluginsDir',

  // VCP Tool Execution
  VCPTool_Execute = 'vcp:tool:execute',
  VCPTool_ExecuteAsync = 'vcp:tool:executeAsync',
  VCPTool_GetTaskStatus = 'vcp:tool:getTaskStatus',
  VCPTool_GetTaskResult = 'vcp:tool:getTaskResult',
  VCPTool_CancelTask = 'vcp:tool:cancelTask',
  VCPTool_ListDefinitions = 'vcp:tool:listDefinitions',
  VCPTool_ParseRequest = 'vcp:tool:parseRequest',
  VCPTool_FormatRequest = 'vcp:tool:formatRequest',

  // VCP Unified Plugin Manager (VCP + MCP dual protocol)
  VCPUnified_Initialize = 'vcp:unified:initialize',
  VCPUnified_GetAllPlugins = 'vcp:unified:getAllPlugins',
  VCPUnified_GetPluginsByProtocol = 'vcp:unified:getPluginsByProtocol',
  VCPUnified_ExecuteTool = 'vcp:unified:executeTool',
  VCPUnified_GetToolDefinitions = 'vcp:unified:getToolDefinitions',
  VCPUnified_Refresh = 'vcp:unified:refresh',
  VCPUnified_Shutdown = 'vcp:unified:shutdown',

  // MCPO Bridge (MCP → VCP)
  MCPO_RegisterServer = 'vcp:mcpo:registerServer',
  MCPO_UnregisterServer = 'vcp:mcpo:unregisterServer',
  MCPO_GetRegisteredServers = 'vcp:mcpo:getRegisteredServers',
  MCPO_ExecuteTool = 'vcp:mcpo:executeTool',
  MCPO_GetVCPDefinitions = 'vcp:mcpo:getVCPDefinitions',

  // VCP Adapter (VCP → MCP)
  VCPAdapter_ExposePlugins = 'vcp:adapter:exposePlugins',
  VCPAdapter_GetToolDefinitions = 'vcp:adapter:getToolDefinitions',
  VCPAdapter_ExecuteTool = 'vcp:adapter:executeTool',

  // Distributed Server Management
  VCPDistributed_Register = 'vcp:distributed:register',
  VCPDistributed_Unregister = 'vcp:distributed:unregister',
  VCPDistributed_GetServers = 'vcp:distributed:getServers',
  VCPDistributed_GetServerTools = 'vcp:distributed:getServerTools',
  VCPDistributed_ExecuteRemote = 'vcp:distributed:executeRemote',
  VCPDistributed_Heartbeat = 'vcp:distributed:heartbeat',

  // Plugin Store
  VCPStore_ListAvailable = 'vcp:store:listAvailable',
  VCPStore_GetPluginInfo = 'vcp:store:getPluginInfo',
  VCPStore_Install = 'vcp:store:install',
  VCPStore_Uninstall = 'vcp:store:uninstall',
  VCPStore_Update = 'vcp:store:update',
  VCPStore_CheckUpdates = 'vcp:store:checkUpdates',

  // VCP Preprocessor Management
  VCPPreprocessor_GetOrder = 'vcp:preprocessor:get-order',
  VCPPreprocessor_SetOrder = 'vcp:preprocessor:set-order',
  VCPPreprocessor_GetInfo = 'vcp:preprocessor:get-info',
  VCPPreprocessor_Reload = 'vcp:preprocessor:reload',

  // VCP Events (renderer → main → renderer)
  VCPEvent_PluginRegistered = 'vcp:event:pluginRegistered',
  VCPEvent_PluginUnregistered = 'vcp:event:pluginUnregistered',
  VCPEvent_PluginEnabled = 'vcp:event:pluginEnabled',
  VCPEvent_PluginDisabled = 'vcp:event:pluginDisabled',
  VCPEvent_PluginError = 'vcp:event:pluginError',
  VCPEvent_ToolExecutionStart = 'vcp:event:toolExecutionStart',
  VCPEvent_ToolExecutionComplete = 'vcp:event:toolExecutionComplete',
  VCPEvent_ToolExecutionError = 'vcp:event:toolExecutionError',
  VCPEvent_AsyncTaskCreated = 'vcp:event:asyncTaskCreated',
  VCPEvent_AsyncTaskCompleted = 'vcp:event:asyncTaskCompleted',
  VCPEvent_AsyncTaskTimeout = 'vcp:event:asyncTaskTimeout',
  VCPEvent_DistributedServerConnected = 'vcp:event:distributedServerConnected',
  VCPEvent_DistributedServerDisconnected = 'vcp:event:distributedServerDisconnected',

  // ==================== Canvas Collaborative Editing ====================

  // Canvas File Management
  Canvas_GetHistory = 'canvas:getHistory',
  Canvas_LoadFile = 'canvas:loadFile',
  Canvas_SaveFile = 'canvas:saveFile',
  Canvas_CreateFile = 'canvas:createFile',
  Canvas_DeleteFile = 'canvas:deleteFile',
  Canvas_RenameFile = 'canvas:renameFile',
  Canvas_GetFileInfo = 'canvas:getFileInfo',
  Canvas_ListFiles = 'canvas:listFiles',

  // Canvas Version Control
  Canvas_GetVersions = 'canvas:getVersions',
  Canvas_RestoreVersion = 'canvas:restoreVersion',
  Canvas_CreateSnapshot = 'canvas:createSnapshot',
  Canvas_CompareVersions = 'canvas:compareVersions',

  // Canvas Real-time Sync
  Canvas_StartSync = 'canvas:startSync',
  Canvas_StopSync = 'canvas:stopSync',
  Canvas_GetSyncState = 'canvas:getSyncState',
  Canvas_BroadcastChange = 'canvas:broadcastChange',

  // Canvas Project Management
  Canvas_OpenProjectDialog = 'canvas:openProjectDialog',
  Canvas_OpenProject = 'canvas:openProject',
  Canvas_CloseProject = 'canvas:closeProject',
  Canvas_GetProjects = 'canvas:getProjects',
  Canvas_GetCurrentProject = 'canvas:getCurrentProject',
  Canvas_RemoveProject = 'canvas:removeProject',

  // Canvas File Tree
  Canvas_GetFileTree = 'canvas:getFileTree',
  Canvas_CreateDirectory = 'canvas:createDirectory',
  Canvas_DeleteDirectory = 'canvas:deleteDirectory',
  Canvas_Copy = 'canvas:copy',
  Canvas_Move = 'canvas:move',

  // Canvas Agent Collaboration
  Canvas_AddAgentMarker = 'canvas:addAgentMarker',
  Canvas_RemoveAgentMarker = 'canvas:removeAgentMarker',
  Canvas_GetAgentMarkers = 'canvas:getAgentMarkers',

  // Canvas Events (renderer ↔ main)
  Canvas_FileChanged = 'canvas:fileChanged',
  Canvas_ExternalChange = 'canvas:externalChange',
  Canvas_SyncStateChanged = 'canvas:syncStateChanged',
  Canvas_ClientConnected = 'canvas:clientConnected',
  Canvas_ClientDisconnected = 'canvas:clientDisconnected',

  // ==================== Unified Knowledge Service ====================

  // Unified Search
  Knowledge_Unified_Search = 'knowledge:unified:search',
  Knowledge_Unified_GetBackends = 'knowledge:unified:backends',
  Knowledge_Unified_GetStats = 'knowledge:unified:stats',
  Knowledge_Unified_Initialize = 'knowledge:unified:initialize',

  // Retrieval Planning
  Knowledge_Unified_Plan = 'knowledge:unified:plan',
  Knowledge_Unified_AnalyzeQuery = 'knowledge:unified:analyzeQuery',

  // TagMemo Enhancement
  Knowledge_TagMemo_Boost = 'knowledge:tagmemo:boost',
  Knowledge_TagMemo_GetRelatedTags = 'knowledge:tagmemo:relatedTags',

  // RRF Fusion
  Knowledge_RRF_Merge = 'knowledge:rrf:merge',
  Knowledge_RRF_UpdateConfig = 'knowledge:rrf:updateConfig',

  // ==================== External Knowledge Sources ====================

  // External Knowledge Manager
  ExternalKnowledge_Initialize = 'external-knowledge:initialize',
  ExternalKnowledge_Shutdown = 'external-knowledge:shutdown',
  ExternalKnowledge_GetStatus = 'external-knowledge:get-status',
  ExternalKnowledge_Search = 'external-knowledge:search',
  ExternalKnowledge_GetEntity = 'external-knowledge:get-entity',
  ExternalKnowledge_GetEnabledBackends = 'external-knowledge:get-enabled-backends',

  // Neo4j
  ExternalKnowledge_Neo4j_Initialize = 'external-knowledge:neo4j:initialize',
  ExternalKnowledge_Neo4j_Close = 'external-knowledge:neo4j:close',
  ExternalKnowledge_Neo4j_CheckConnection = 'external-knowledge:neo4j:check-connection',
  ExternalKnowledge_Neo4j_Search = 'external-knowledge:neo4j:search',
  ExternalKnowledge_Neo4j_ExecuteCypher = 'external-knowledge:neo4j:execute-cypher',
  ExternalKnowledge_Neo4j_TraverseRelations = 'external-knowledge:neo4j:traverse-relations',
  ExternalKnowledge_Neo4j_GetNode = 'external-knowledge:neo4j:get-node',
  ExternalKnowledge_Neo4j_GetNodeRelations = 'external-knowledge:neo4j:get-node-relations',

  // Wikidata
  ExternalKnowledge_Wikidata_Initialize = 'external-knowledge:wikidata:initialize',
  ExternalKnowledge_Wikidata_Close = 'external-knowledge:wikidata:close',
  ExternalKnowledge_Wikidata_CheckConnection = 'external-knowledge:wikidata:check-connection',
  ExternalKnowledge_Wikidata_Search = 'external-knowledge:wikidata:search',
  ExternalKnowledge_Wikidata_ExecuteSparql = 'external-knowledge:wikidata:execute-sparql',
  ExternalKnowledge_Wikidata_GetEntity = 'external-knowledge:wikidata:get-entity',
  ExternalKnowledge_Wikidata_SearchEntities = 'external-knowledge:wikidata:search-entities',

  // Elasticsearch
  ExternalKnowledge_Elasticsearch_Initialize = 'external-knowledge:elasticsearch:initialize',
  ExternalKnowledge_Elasticsearch_Close = 'external-knowledge:elasticsearch:close',
  ExternalKnowledge_Elasticsearch_CheckConnection = 'external-knowledge:elasticsearch:check-connection',
  ExternalKnowledge_Elasticsearch_Search = 'external-knowledge:elasticsearch:search',
  ExternalKnowledge_Elasticsearch_ExecuteDsl = 'external-knowledge:elasticsearch:execute-dsl',
  ExternalKnowledge_Elasticsearch_GetIndexInfo = 'external-knowledge:elasticsearch:get-index-info',
  ExternalKnowledge_Elasticsearch_Aggregate = 'external-knowledge:elasticsearch:aggregate',

  // ==================== Quality Guardian (质量守护) ====================
  Quality_Evaluate = 'quality:evaluate',
  Quality_Optimize = 'quality:optimize',
  Quality_GetHistory = 'quality:getHistory',
  Quality_ApplyFix = 'quality:applyFix',
  Quality_Compare = 'quality:compare',
  Quality_GetCheckers = 'quality:getCheckers',
  Quality_Initialize = 'quality:initialize',

  // ==================== Time Expression Parser (时间表达式解析) ====================
  TimeParser_Parse = 'time-parser:parse',
  TimeParser_HasExpression = 'time-parser:has-expression',
  TimeParser_GetSupportedExpressions = 'time-parser:get-supported-expressions',
  TimeParser_SetLocale = 'time-parser:set-locale',

  // ==================== Semantic Group Service (语义组服务) ====================
  SemanticGroup_Expand = 'semantic-group:expand',
  SemanticGroup_GetEnhancedVector = 'semantic-group:get-enhanced-vector',
  SemanticGroup_GetGroupVector = 'semantic-group:get-group-vector',
  SemanticGroup_ListGroups = 'semantic-group:list-groups',
  SemanticGroup_AddGroup = 'semantic-group:add-group',
  SemanticGroup_RemoveGroup = 'semantic-group:remove-group',
  SemanticGroup_GetStats = 'semantic-group:get-stats',
  SemanticGroup_WarmCache = 'semantic-group:warm-cache',
  SemanticGroup_ClearCache = 'semantic-group:clear-cache'
}
