/**
 * VCP 插件系统 IPC 处理器
 *
 * 使用原生 VCPRuntime + UnifiedPluginManager 统一管理 VCP + MCP 插件
 * 完全不依赖 external/VCPToolBox
 */

import { loggerService } from '@logger'
import { reduxService } from '@main/services/ReduxService'
import { IpcChannel } from '@shared/IpcChannel'
import type { Provider } from '@types'
import { ipcMain } from 'electron'

import { getNativeKnowledgeService } from '../NativeKnowledgeService'
import { getUnifiedPluginManager, type PluginSource, type ToolExecutionRequest } from '../UnifiedPluginManager'
import { ensureBuiltinServicesInitialized } from './BuiltinServices'
import { getVCPAsyncResultsService } from './VCPAsyncResultsService'
import { getToolCallTracer } from './ToolCallTracer'
import { getVCPRuntime, type VCPPlugin, type VCPRuntimeConfig } from '.'
import { readPluginManifest, normalizeConfigSchema } from './PluginSyncService'
import { initializeBuiltinPlugins, getBuiltinPluginsDir, getUserPluginsDir } from './PluginInitializer'

const logger = loggerService.withContext('VCPPluginIpcHandler')

// ==================== Provider Credentials Helper ====================

/**
 * 从 Redux store 获取 Provider 凭据
 * 用于在调用嵌入 API 时获取 API Key 和 Base URL
 */
async function getProviderCredentials(providerId: string): Promise<{
  apiKey: string
  apiHost: string
  type: string
} | null> {
  try {
    const providers = await reduxService.select<Provider[]>('state.llm.providers')
    if (!providers || !Array.isArray(providers)) {
      logger.warn('No providers found in Redux store')
      return null
    }

    const provider = providers.find((p) => p.id === providerId)
    if (!provider) {
      logger.warn('Provider not found', { providerId })
      return null
    }

    return {
      apiKey: provider.apiKey || '',
      apiHost: provider.apiHost || '',
      type: provider.type || ''
    }
  } catch (error) {
    logger.error('Failed to get provider credentials from Redux store', {
      providerId,
      error: String(error)
    })
    return null
  }
}

/**
 * 构建完整的 ApiClient，自动从 Redux store 获取缺失的凭据
 *
 * @param params 原始参数（可能缺少 apiKey/baseUrl）
 * @returns 完整的 ApiClient，或 null（如果无法获取凭据）
 */
async function buildApiClientWithCredentials(params: {
  providerId: string
  modelId: string
  apiKey?: string
  baseUrl?: string
}): Promise<import('@types').ApiClient | null> {
  let apiKey = params.apiKey || ''
  let baseUrl = params.baseUrl || ''

  // 如果 apiKey 为空，从 Redux store 获取
  if (!apiKey || apiKey.trim() === '') {
    logger.debug('API key not provided, fetching from Redux store', {
      providerId: params.providerId
    })

    const credentials = await getProviderCredentials(params.providerId)
    if (!credentials) {
      logger.error('Failed to get provider credentials, cannot build ApiClient', {
        providerId: params.providerId
      })
      return null
    }

    apiKey = credentials.apiKey
    if (!baseUrl) {
      baseUrl = credentials.apiHost
    }

    logger.debug('Got credentials from Redux store', {
      providerId: params.providerId,
      hasApiKey: !!apiKey,
      hasBaseUrl: !!baseUrl
    })
  }

  // 验证 apiKey 不为空
  if (!apiKey || apiKey.trim() === '') {
    logger.error('API key is empty even after fetching from Redux store', {
      providerId: params.providerId
    })
    return null
  }

  return {
    provider: params.providerId,
    model: params.modelId,
    baseURL: baseUrl,
    apiKey: apiKey
  }
}

/**
 * 统一插件信息类型
 */
interface UnifiedPluginInfo {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  type: string
  category?: string
  enabled: boolean
  distributed: boolean
  serverEndpoint?: string
  requiresConfig?: boolean
  configKeys?: string[]
  tags?: string[]
  isBuiltin?: boolean
  isNative?: boolean
}

/**
 * 后端去重：按 name 去重，保留优先级高的（isNative > isBuiltin > 普通）
 */
function deduplicatePlugins(plugins: UnifiedPluginInfo[]): UnifiedPluginInfo[] {
  const seen = new Map<string, UnifiedPluginInfo>()

  for (const plugin of plugins) {
    const existing = seen.get(plugin.name)
    if (!existing) {
      seen.set(plugin.name, plugin)
    } else {
      // 优先保留 isNative（原生 TypeScript 实现）
      if (plugin.isNative && !existing.isNative) {
        seen.set(plugin.name, plugin)
      }
      // 其次保留 isBuiltin
      else if (plugin.isBuiltin && !existing.isBuiltin && !existing.isNative) {
        seen.set(plugin.name, plugin)
      }
      // 否则保留已有的
    }
  }

  return Array.from(seen.values())
}

/**
 * 读取插件详情（README、系统提示词等）
 */
async function readPluginDetails(
  basePath: string,
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
}> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const details: {
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
  } = { pluginId }

  try {
    // 1. 读取 README.md
    const readmePaths = [
      path.join(basePath, 'README.md'),
      path.join(basePath, 'readme.md'),
      path.join(basePath, 'README.MD')
    ]

    for (const readmePath of readmePaths) {
      try {
        const content = await fs.readFile(readmePath, 'utf-8')
        details.readme = content
        break
      } catch {
        // 继续尝试下一个路径
      }
    }

    // 2. 读取系统提示词（查找 .txt 文件，排除 requirements.txt）
    try {
      const files = await fs.readdir(basePath)
      for (const file of files) {
        if (
          file.endsWith('.txt') &&
          !file.toLowerCase().includes('requirements') &&
          !file.toLowerCase().includes('readme') &&
          !file.toLowerCase().includes('license')
        ) {
          // 检查是否匹配系统提示词模式
          const isPromptFile =
            file.toLowerCase().includes('prompt') ||
            file.toLowerCase().includes('tagmaster') ||
            file.toLowerCase().includes('system') ||
            file.toLowerCase().includes('magi')

          if (isPromptFile) {
            const promptPath = path.join(basePath, file)
            const content = await fs.readFile(promptPath, 'utf-8')
            details.systemPrompt = content
            details.systemPromptFile = file
            break
          }
        }
      }
    } catch {
      // 忽略读取目录错误
    }

    // 3. 读取 manifest 获取更多信息
    const manifestPath = path.join(basePath, 'plugin-manifest.json')
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent)
      details.author = manifest.author
      details.invocationCommands = manifest.capabilities?.invocationCommands || []
    } catch {
      // 忽略 manifest 读取错误
    }

    return { success: true, data: details }
  } catch (error) {
    logger.error('Failed to read plugin details', { basePath, pluginId, error: String(error) })
    return { success: false, error: String(error) }
  }
}

/**
 * 注册 VCP 插件系统 IPC 处理器
 */
export function registerVCPPluginIpcHandlers(): void {
  logger.info('Registering VCP Plugin IPC handlers (Native VCPRuntime)...')

  const vcpRuntime = getVCPRuntime()
  const unifiedManager = getUnifiedPluginManager()

  // ==================== VCP Plugin Management ====================

  // 初始化插件管理器
  ipcMain.handle(IpcChannel.VCPPlugin_Initialize, async () => {
    try {
      await vcpRuntime.initialize()
      return { success: true }
    } catch (error) {
      logger.error('Failed to initialize VCPRuntime', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取所有插件列表
  ipcMain.handle(IpcChannel.VCPPlugin_List, async () => {
    try {
      const plugins = vcpRuntime.listPlugins()

      // 确保内置服务已初始化，获取内置服务（BuiltinServices）并转换为 VCP 插件格式
      const builtinServiceRegistry = await ensureBuiltinServicesInitialized()
      const builtinServices = builtinServiceRegistry.toVCPPluginFormat()

      // 如果没有加载的插件，只返回内置服务
      if (plugins.length === 0) {
        logger.info('No loaded plugins, returning only BuiltinServices', {
          builtinServiceCount: builtinServices.length
        })

        // 将内置服务转换为统一格式
        const builtinServiceList = builtinServices.map((s) => ({
          id: s.name,
          name: s.name,
          displayName: s.displayName,
          description: s.description,
          version: s.version,
          type: s.pluginType,
          category: 'builtin_service',
          enabled: s.enabled,
          distributed: false,
          serverEndpoint: undefined,
          requiresConfig: s.configSchema ? Object.keys(s.configSchema).length > 0 : false,
          configKeys: s.configSchema ? Object.keys(s.configSchema) : [],
          tags: ['内置服务'],
          isBuiltin: true,
          isNative: true // 原生 TypeScript 实现
        }))

        return {
          success: true,
          data: builtinServiceList
        }
      }

      // 有加载的插件时，合并插件列表 + 内置服务
      const pluginList = plugins.map((p: VCPPlugin) => {
        // 从 manifest 中提取 configSchema 信息
        const configSchema = p.manifest.configSchema
        const hasConfig = configSchema && Object.keys(configSchema).length > 0
        const configKeys = hasConfig ? Object.keys(configSchema) : []

        return {
          id: p.manifest.name,
          name: p.manifest.name,
          displayName: p.manifest.displayName || p.manifest.name,
          description: p.manifest.description || '',
          version: p.manifest.version || '1.0.0',
          type: p.manifest.pluginType,
          category: p.manifest.category,
          enabled: p.enabled,
          distributed: false,
          serverEndpoint: undefined,
          requiresConfig: hasConfig,
          configKeys: configKeys,
          tags: p.manifest.tags,
          isBuiltin: p.isBuiltin,
          // 只有代码内置服务是 isNative，文件加载的内置插件不是
          isNative: false
        }
      })

      // 将内置服务转换为统一格式
      const builtinServiceList = builtinServices.map((s) => ({
        id: s.name,
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        version: s.version,
        type: s.pluginType,
        category: 'builtin_service',
        enabled: s.enabled,
        distributed: false,
        serverEndpoint: undefined,
        requiresConfig: s.configSchema ? Object.keys(s.configSchema).length > 0 : false,
        configKeys: s.configSchema ? Object.keys(s.configSchema) : [],
        tags: ['内置服务'],
        isBuiltin: true,
        isNative: true
      }))

      // 后端去重：按 name 去重，保留优先级高的
      const allPlugins = [...builtinServiceList, ...pluginList]
      const dedupedPlugins = deduplicatePlugins(allPlugins)

      logger.debug('Plugin list deduplicated', {
        before: allPlugins.length,
        after: dedupedPlugins.length,
        removed: allPlugins.length - dedupedPlugins.length
      })

      return {
        success: true,
        data: dedupedPlugins
      }
    } catch (error) {
      logger.error('Failed to list plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取单个插件
  ipcMain.handle(IpcChannel.VCPPlugin_Get, async (_, pluginId: string) => {
    try {
      // 确保内置服务已初始化，先检查内置服务
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      const builtinService = builtinRegistry.get(pluginId)
      if (builtinService) {
        return {
          success: true,
          data: {
            id: builtinService.name,
            name: builtinService.name,
            displayName: builtinService.displayName,
            description: builtinService.description,
            version: builtinService.version,
            type: builtinService.type,
            enabled: true,
            params: [],
            distributed: false,
            serverEndpoint: undefined,
            isBuiltin: true,
            isNative: true
          }
        }
      }

      // 再检查 VCPRuntime 插件
      const plugin = vcpRuntime.getPlugin(pluginId)
      if (!plugin) {
        return { success: false, error: `Plugin ${pluginId} not found` }
      }
      return {
        success: true,
        data: {
          id: plugin.manifest.name,
          name: plugin.manifest.name,
          displayName: plugin.manifest.displayName || plugin.manifest.name,
          description: plugin.manifest.description || '',
          version: plugin.manifest.version || '1.0.0',
          type: plugin.manifest.pluginType,
          enabled: plugin.enabled,
          params: [],
          distributed: false,
          serverEndpoint: undefined
        }
      }
    } catch (error) {
      logger.error('Failed to get plugin', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 启用插件
  ipcMain.handle(IpcChannel.VCPPlugin_Enable, async (_, pluginId: string) => {
    try {
      const plugin = vcpRuntime.getPlugin(pluginId)
      if (plugin) {
        plugin.enabled = true
        logger.info('Enabled plugin', { pluginId })
        return { success: true }
      }
      return { success: false, error: `Plugin ${pluginId} not found` }
    } catch (error) {
      logger.error('Failed to enable plugin', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 禁用插件
  ipcMain.handle(IpcChannel.VCPPlugin_Disable, async (_, pluginId: string) => {
    try {
      const plugin = vcpRuntime.getPlugin(pluginId)
      if (plugin) {
        plugin.enabled = false
        logger.info('Disabled plugin', { pluginId })
        return { success: true }
      }
      return { success: false, error: `Plugin ${pluginId} not found` }
    } catch (error) {
      logger.error('Failed to disable plugin', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 重新加载插件
  ipcMain.handle(IpcChannel.VCPPlugin_Reload, async () => {
    try {
      await vcpRuntime.reloadPlugins()
      return { success: true }
    } catch (error) {
      logger.error('Failed to reload plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 从自定义路径加载插件
  ipcMain.handle(IpcChannel.VCPPlugin_LoadFromPath, async (_, pluginPath: string) => {
    try {
      const registry = vcpRuntime.getRegistry()
      if (!registry) {
        return { success: false, error: 'VCPRuntime not initialized' }
      }

      const result = await registry.loadPluginFromPath(pluginPath)

      if (result.success && result.plugin) {
        logger.info('Plugin loaded from custom path', {
          name: result.plugin.manifest.name,
          path: pluginPath
        })
        return {
          success: true,
          data: {
            id: result.plugin.manifest.name,
            name: result.plugin.manifest.name,
            displayName: result.plugin.manifest.displayName || result.plugin.manifest.name,
            description: result.plugin.manifest.description || '',
            version: result.plugin.manifest.version || '1.0.0',
            type: result.plugin.manifest.pluginType
          }
        }
      }

      return { success: false, error: result.error }
    } catch (error) {
      logger.error('Failed to load plugin from path', { pluginPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取插件目录路径
  ipcMain.handle(IpcChannel.VCPPlugin_GetPluginsDir, async () => {
    try {
      const registry = vcpRuntime.getRegistry()
      if (!registry) {
        return { success: false, error: 'VCPRuntime not initialized' }
      }

      const dirs = registry.getPluginsDir()
      return { success: true, data: dirs }
    } catch (error) {
      logger.error('Failed to get plugins dir', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取插件配置（包括 configSchema 和当前配置值）
  ipcMain.handle(IpcChannel.VCPPlugin_GetConfig, async (_, pluginId: string) => {
    try {
      // 确保内置服务已初始化，先检查内置服务
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      const builtinService = builtinRegistry.get(pluginId)
      if (builtinService) {
        const configSchema = builtinService.configSchema
          ? {
              type: 'object',
              properties: Object.fromEntries(
                Object.entries(builtinService.configSchema).map(([key, schema]) => [
                  key,
                  {
                    type: (schema as Record<string, unknown>).type || 'string',
                    description: (schema as Record<string, unknown>).description || key,
                    default: (schema as Record<string, unknown>).default
                  }
                ])
              ),
              required: Object.entries(builtinService.configSchema)
                .filter(([, schema]) => (schema as Record<string, unknown>).required !== false)
                .map(([key]) => key)
            }
          : null

        // 从 configSchema 提取默认值
        const defaultConfig: Record<string, unknown> = {}
        if (builtinService.configSchema) {
          for (const [key, schema] of Object.entries(builtinService.configSchema)) {
            const schemaObj = schema as Record<string, unknown>
            if (schemaObj.default !== undefined) {
              defaultConfig[key] = schemaObj.default
            }
          }
        }

        // 加载已保存的配置
        const savedConfig = vcpRuntime.loadBuiltinPluginConfig(pluginId) || {}

        return {
          success: true,
          data: {
            pluginId: builtinService.name,
            displayName: builtinService.displayName,
            configSchema,
            defaultConfig,
            currentConfig: savedConfig,
            isBuiltin: true,
            isNative: true
          }
        }
      }

      const plugin = vcpRuntime.getPlugin(pluginId)

      // 如果在 runtime 中找到了插件
      if (plugin) {
        // 标准化 configSchema 格式
        const normalizedSchema = normalizeConfigSchema(
          plugin.manifest.configSchema as Record<string, unknown> | undefined
        )
        return {
          success: true,
          data: {
            pluginId: plugin.manifest.name,
            displayName: plugin.manifest.displayName || plugin.manifest.name,
            configSchema: normalizedSchema,
            defaultConfig: plugin.manifest.defaultConfig || {},
            currentConfig: plugin.userConfig || {}
          }
        }
      }

      // 尝试从插件目录读取实际的 plugin-manifest.json
      const manifest = readPluginManifest(pluginId)
      if (manifest && manifest.configSchema) {
        const normalizedSchema = normalizeConfigSchema(manifest.configSchema as Record<string, unknown> | undefined)
        const savedConfig = vcpRuntime.loadBuiltinPluginConfig(pluginId) || {}

        logger.info('Loaded config from plugin manifest', {
          pluginId,
          hasSchema: !!normalizedSchema,
          schemaKeys: normalizedSchema ? Object.keys(normalizedSchema.properties) : []
        })

        return {
          success: true,
          data: {
            pluginId: manifest.name || pluginId,
            displayName: manifest.displayName || pluginId,
            configSchema: normalizedSchema,
            defaultConfig: manifest.defaultConfig || {},
            currentConfig: savedConfig
          }
        }
      }

      // 插件不存在
      return { success: false, error: `Plugin ${pluginId} not found` }
    } catch (error) {
      logger.error('Failed to get plugin config', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 更新插件配置
  ipcMain.handle(IpcChannel.VCPPlugin_UpdateConfig, async (_, pluginId: string, config: Record<string, unknown>) => {
    try {
      // 先检查是否是原生 BuiltinService
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      const builtinService = builtinRegistry.get(pluginId)
      if (builtinService) {
        // BuiltinService 的配置保存到统一的配置存储
        await vcpRuntime.saveBuiltinPluginConfig(pluginId, config)
        // 同时更新服务的运行时配置
        if (builtinService.setConfig) {
          builtinService.setConfig(config)
        }
        logger.info('Updated builtin service config', { pluginId, configKeys: Object.keys(config) })
        return { success: true }
      }

      const plugin = vcpRuntime.getPlugin(pluginId)

      if (plugin) {
        // 更新插件的 userConfig
        plugin.userConfig = { ...plugin.userConfig, ...config }
        // 持久化配置到文件系统
        await vcpRuntime.savePluginConfig(pluginId, plugin.userConfig)
        logger.info('Updated plugin config', { pluginId, configKeys: Object.keys(config) })
        return { success: true }
      }

      return { success: false, error: `Plugin ${pluginId} not found` }
    } catch (error) {
      logger.error('Failed to update plugin config', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 更新插件模型配置
  ipcMain.handle(
    IpcChannel.VCPPlugin_UpdateModelConfig,
    async (_, pluginId: string, modelConfig: Record<string, unknown>) => {
      try {
        // 确保内置服务已初始化，检查内置服务
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const builtinService = builtinRegistry.get(pluginId)
        if (builtinService) {
          builtinRegistry.setServiceModelConfig(pluginId, modelConfig as any)
          logger.info('Updated builtin service model config', { pluginId, enabled: modelConfig.enabled })
          return { success: true }
        }

        // 检查 VCPRuntime 插件
        const plugin = vcpRuntime.getPlugin(pluginId)
        if (plugin) {
          plugin.userConfig = { ...plugin.userConfig, __modelConfig: modelConfig }
          await vcpRuntime.savePluginConfig(pluginId, plugin.userConfig)
          logger.info('Updated plugin model config', { pluginId, enabled: modelConfig.enabled })
          return { success: true }
        }

        return { success: false, error: `Plugin ${pluginId} not found` }
      } catch (error) {
        logger.error('Failed to update plugin model config', { pluginId, error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取占位符值
  ipcMain.handle(IpcChannel.VCPPlugin_GetPlaceholders, async () => {
    try {
      const plugins = vcpRuntime.listPlugins()
      const placeholders: Record<string, string> = {}

      // 获取所有静态插件的占位符
      for (const plugin of plugins) {
        if (plugin.manifest.pluginType === 'static' && plugin.enabled) {
          const phList = plugin.manifest.capabilities?.systemPromptPlaceholders || []
          for (const ph of phList) {
            const value = vcpRuntime.getPlaceholderValue(ph.placeholder)
            if (value) {
              placeholders[ph.placeholder] = value
            }
          }
        }
      }

      return { success: true, data: placeholders }
    } catch (error) {
      logger.error('Failed to get placeholders', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 同步内置插件（原生方式）
  ipcMain.handle(IpcChannel.VCPPlugin_Sync, async (_, forceSync?: boolean) => {
    try {
      logger.info('Starting native plugin initialization', { forceSync })
      const result = await initializeBuiltinPlugins()

      if (result.copied.length > 0) {
        // 同步完成后重新加载插件
        await vcpRuntime.reloadPlugins()
      }

      return {
        success: true,
        data: {
          syncedCount: result.copied.length,
          skippedCount: result.skipped.length,
          errorCount: result.failed.length,
          plugins: result.copied,
          errors: result.failed
        }
      }
    } catch (error) {
      logger.error('Failed to initialize native plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取同步状态
  ipcMain.handle(IpcChannel.VCPPlugin_GetSyncStatus, async () => {
    try {
      // 使用原生插件目录获取已安装插件列表
      const fs = await import('fs')
      const path = await import('path')

      const builtinDir = getBuiltinPluginsDir()
      const userDir = getUserPluginsDir()

      const builtinPlugins: string[] = []
      const userPlugins: string[] = []

      // 扫描内置插件目录
      if (fs.existsSync(builtinDir)) {
        const entries = fs.readdirSync(builtinDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const manifestPath = path.join(builtinDir, entry.name, 'plugin-manifest.json')
            if (fs.existsSync(manifestPath)) {
              builtinPlugins.push(entry.name)
            }
          }
        }
      }

      // 扫描用户插件目录
      if (fs.existsSync(userDir)) {
        const entries = fs.readdirSync(userDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const manifestPath = path.join(userDir, entry.name, 'plugin-manifest.json')
            if (fs.existsSync(manifestPath)) {
              userPlugins.push(entry.name)
            }
          }
        }
      }

      const allPlugins = [...builtinPlugins, ...userPlugins]

      // 获取内置服务数量
      const builtinServiceRegistry = await ensureBuiltinServicesInitialized()

      return {
        success: true,
        data: {
          needsSync: false, // 原生模式不需要同步
          syncedCount: allPlugins.length,
          syncedPlugins: allPlugins,
          builtinCount: builtinServiceRegistry.getAll().length
        }
      }
    } catch (error) {
      logger.error('Failed to get sync status', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取插件详情（包括 README、系统提示词等）
  ipcMain.handle(IpcChannel.VCPPlugin_GetDetails, async (_, pluginId: string) => {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      // 1. 先检查内置服务 (BuiltinServices)
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      if (builtinRegistry.has(pluginId)) {
        const details = builtinRegistry.getServiceDetails(pluginId)
        if (details.success) {
          logger.debug('Returning builtin service details', { pluginId })
          return details
        }
      }

      // 2. 获取 VCPRuntime 插件
      const plugin = vcpRuntime.getPlugin(pluginId)
      if (!plugin) {
        // 尝试从内置插件目录查找
        const builtinPluginPath = path.join(getBuiltinPluginsDir(), pluginId)
        try {
          await fs.access(builtinPluginPath)
          // 读取内置插件详情
          return await readPluginDetails(builtinPluginPath, pluginId)
        } catch {
          // 尝试从用户插件目录查找
          const userPluginPath = path.join(getUserPluginsDir(), pluginId)
          try {
            await fs.access(userPluginPath)
            return await readPluginDetails(userPluginPath, pluginId)
          } catch {
            return { success: false, error: `Plugin ${pluginId} not found` }
          }
        }
      }

      // 读取插件详情
      return await readPluginDetails(plugin.basePath, pluginId)
    } catch (error) {
      logger.error('Failed to get plugin details', { pluginId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP Tool Execution ====================

  // 执行工具 (同步)
  ipcMain.handle(IpcChannel.VCPTool_Execute, async (_, toolName: string, params: Record<string, string>) => {
    const tracer = getToolCallTracer()
    const traceId = tracer.startTrace({ source: 'vcp' })
    const callId = tracer.startCall({
      traceId,
      toolName,
      toolType: 'plugin',
      params
    })

    try {
      const result = await vcpRuntime.executeTool(toolName, params)

      if (result.success) {
        tracer.endCallSuccess(callId, result.output)
      } else {
        tracer.endCallError(callId, { message: result.error || 'Unknown error' })
      }

      return {
        success: result.success,
        data: result.output,
        output: result.output,
        error: result.error,
        executionTimeMs: result.executionTimeMs
      }
    } catch (error) {
      tracer.endCallError(callId, {
        message: String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      logger.error('Failed to execute tool', { toolName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 执行工具 (异步)
  ipcMain.handle(IpcChannel.VCPTool_ExecuteAsync, async (_, toolName: string, params: Record<string, string>) => {
    const tracer = getToolCallTracer()
    const traceId = tracer.startTrace({ source: 'vcp-async' })
    const callId = tracer.startCall({
      traceId,
      toolName,
      toolType: 'plugin',
      params
    })

    try {
      const result = await vcpRuntime.executeTool(toolName, params)

      // 如果是异步插件，返回任务ID
      if (result.taskId) {
        // 异步任务的日志记录在任务完成时处理
        tracer.endCallSuccess(callId, { taskId: result.taskId, status: 'pending' })
        return {
          success: true,
          taskId: result.taskId,
          status: 'pending'
        }
      }

      if (result.success) {
        tracer.endCallSuccess(callId, result.output)
      } else {
        tracer.endCallError(callId, { message: result.error || 'Unknown error' })
      }

      return {
        success: result.success,
        data: result.output,
        output: result.output,
        error: result.error
      }
    } catch (error) {
      tracer.endCallError(callId, {
        message: String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      logger.error('Failed to execute async tool', { toolName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取任务状态
  ipcMain.handle(IpcChannel.VCPTool_GetTaskStatus, async (_, taskId: string, pluginName?: string) => {
    try {
      // 1. 先从 PluginExecutor 内存中查找运行中的任务
      const executor = vcpRuntime.getExecutor()
      if (executor) {
        const inMemoryTask = executor.getAsyncTask(taskId)
        if (inMemoryTask) {
          return {
            success: true,
            data: {
              taskId: inMemoryTask.taskId,
              pluginName: inMemoryTask.pluginName,
              status: inMemoryTask.status,
              createdAt: inMemoryTask.createdAt,
              updatedAt: inMemoryTask.updatedAt,
              progress: inMemoryTask.progress,
              metadata: inMemoryTask.metadata
            }
          }
        }
      }

      // 2. 回退到 VCPAsyncResultsService 持久化存储
      const asyncResultsService = getVCPAsyncResultsService()
      // 如果提供了 pluginName，使用完整的 pluginName::taskId 格式
      if (pluginName) {
        const result = asyncResultsService.getResult(pluginName, taskId)
        if (result) {
          return {
            success: true,
            data: {
              taskId: result.taskId,
              pluginName: result.pluginName,
              status: result.status,
              createdAt: result.createdAt,
              updatedAt: result.updatedAt,
              expiresAt: result.expiresAt,
              metadata: result.metadata
            }
          }
        }
      }

      // 3. 尝试从所有结果中查找匹配的 taskId
      const allResults = asyncResultsService.getAllResults()
      const matchingResult = allResults.find((r) => r.taskId === taskId)
      if (matchingResult) {
        return {
          success: true,
          data: {
            taskId: matchingResult.taskId,
            pluginName: matchingResult.pluginName,
            status: matchingResult.status,
            createdAt: matchingResult.createdAt,
            updatedAt: matchingResult.updatedAt,
            expiresAt: matchingResult.expiresAt,
            metadata: matchingResult.metadata
          }
        }
      }

      return { success: true, data: { taskId, status: 'not_found' } }
    } catch (error) {
      logger.error('Failed to get task status', { taskId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取任务结果
  ipcMain.handle(IpcChannel.VCPTool_GetTaskResult, async (_, taskId: string, pluginName?: string) => {
    try {
      // 1. 先从 PluginExecutor 内存中查找
      const executor = vcpRuntime.getExecutor()
      if (executor) {
        const inMemoryTask = executor.getAsyncTask(taskId)
        if (inMemoryTask && inMemoryTask.result) {
          return {
            success: true,
            data: {
              taskId: inMemoryTask.taskId,
              pluginName: inMemoryTask.pluginName,
              status: inMemoryTask.status,
              result: inMemoryTask.result,
              error: inMemoryTask.error
            }
          }
        }
      }

      // 2. 回退到 VCPAsyncResultsService 持久化存储
      const asyncResultsService = getVCPAsyncResultsService()
      if (pluginName) {
        const result = asyncResultsService.getResult(pluginName, taskId)
        if (result) {
          return {
            success: true,
            data: {
              taskId: result.taskId,
              pluginName: result.pluginName,
              status: result.status,
              result: result.result,
              error: result.error
            }
          }
        }
      }

      // 3. 尝试从所有结果中查找匹配的 taskId
      const allResults = asyncResultsService.getAllResults()
      const matchingResult = allResults.find((r) => r.taskId === taskId)
      if (matchingResult) {
        return {
          success: true,
          data: {
            taskId: matchingResult.taskId,
            pluginName: matchingResult.pluginName,
            status: matchingResult.status,
            result: matchingResult.result,
            error: matchingResult.error
          }
        }
      }

      return { success: true, data: { taskId, result: null, status: 'not_found' } }
    } catch (error) {
      logger.error('Failed to get task result', { taskId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 取消异步任务
  ipcMain.handle(IpcChannel.VCPTool_CancelTask, async (_, taskId: string) => {
    try {
      const executor = vcpRuntime.getExecutor()
      if (executor) {
        const task = executor.getAsyncTask(taskId)
        if (task && (task.status === 'pending' || task.status === 'running')) {
          // 标记任务为已取消 (使用 'failed' 状态)
          executor.updateAsyncTask(taskId, { status: 'failed', error: 'Task cancelled by user' })
          logger.info('Task cancelled', { taskId })
          return { success: true }
        }
      }
      return { success: false, error: 'Task not found or already completed' }
    } catch (error) {
      logger.error('Failed to cancel task', { taskId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取工具定义列表（包括外部插件和内置服务）
  ipcMain.handle(IpcChannel.VCPTool_ListDefinitions, async () => {
    try {
      // 获取外部插件
      const plugins = vcpRuntime.listPlugins()
      const pluginDefinitions = plugins.map((p: VCPPlugin) => {
        // 从 capabilities.toolFunctions 提取参数
        const toolFunctions = p.manifest.capabilities?.toolFunctions || []
        const firstTool = toolFunctions[0]
        const parameters = firstTool?.parameters?.properties
          ? Object.entries(firstTool.parameters.properties).map(([name, prop]) => ({
              name,
              type: (prop as { type?: string }).type || 'string',
              description: (prop as { description?: string }).description || '',
              required: firstTool.parameters?.required?.includes(name) || false
            }))
          : []

        return {
          id: p.manifest.name,
          name: p.manifest.name,
          displayName: p.manifest.displayName || p.manifest.name,
          description: p.manifest.description || '',
          serverName: 'VCPRuntime',
          params: [],
          parameters,
          type: p.manifest.pluginType,
          inputSchema: {
            type: 'object' as const,
            properties: parameters.reduce(
              (acc: Record<string, unknown>, param) => {
                acc[param.name] = {
                  type: param.type || 'string',
                  description: param.description || ''
                }
                return acc
              },
              {} as Record<string, unknown>
            ),
            required: parameters.filter((param) => param.required).map((param) => param.name)
          }
        }
      })

      // 获取内置服务工具定义
      const builtinRegistry = await ensureBuiltinServicesInitialized()
      const builtinServices = builtinRegistry.getAll()
      const builtinDefinitions = builtinServices.flatMap((service) => {
        return (service.toolDefinitions || []).map((tool) => ({
          id: `${service.name}:${tool.commandIdentifier}`,
          name: `${service.name}:${tool.commandIdentifier}`,
          displayName: `${service.displayName} - ${tool.commandIdentifier}`,
          description: tool.description || '',
          serverName: 'BuiltinServices',
          params: tool.parameters || [],
          parameters: tool.parameters || [],
          type: 'builtin_service',
          inputSchema: {
            type: 'object' as const,
            properties: (tool.parameters || []).reduce(
              (acc: Record<string, unknown>, param: any) => {
                acc[param.name] = {
                  type: param.type || 'string',
                  description: param.description || ''
                }
                return acc
              },
              {} as Record<string, unknown>
            ),
            required: (tool.parameters || []).filter((param: any) => param.required).map((param: any) => param.name)
          }
        }))
      })

      // 合并所有工具定义
      const allDefinitions = [...pluginDefinitions, ...builtinDefinitions]

      logger.info('Listed all tool definitions', {
        pluginCount: pluginDefinitions.length,
        builtinCount: builtinDefinitions.length,
        totalCount: allDefinitions.length
      })

      return { success: true, data: allDefinitions }
    } catch (error) {
      logger.error('Failed to list tool definitions', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP Unified Plugin Manager ====================

  // 初始化统一插件管理器
  ipcMain.handle(IpcChannel.VCPUnified_Initialize, async () => {
    try {
      const result = await unifiedManager.initialize()
      return { success: result }
    } catch (error) {
      logger.error('Failed to initialize unified plugin manager', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取所有插件（统一视图）
  ipcMain.handle(IpcChannel.VCPUnified_GetAllPlugins, async () => {
    try {
      const plugins = await unifiedManager.getAllPlugins()
      return {
        success: true,
        data: plugins.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          source: p.source,
          type: p.type,
          enabled: p.enabled,
          serverId: p.serverId,
          serverName: p.serverName
        }))
      }
    } catch (error) {
      logger.error('Failed to get all unified plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 按源获取插件
  ipcMain.handle(IpcChannel.VCPUnified_GetPluginsByProtocol, async (_, source: PluginSource) => {
    try {
      const plugins = await unifiedManager.getPluginsBySource(source)
      return {
        success: true,
        data: plugins.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          source: p.source,
          enabled: p.enabled
        }))
      }
    } catch (error) {
      logger.error('Failed to get plugins by source', { source, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 执行工具 (自动路由到 VCP/MCP/Native)
  ipcMain.handle(IpcChannel.VCPUnified_ExecuteTool, async (_, request: ToolExecutionRequest) => {
    const tracer = getToolCallTracer()
    const traceId = tracer.startTrace({ source: request.source || 'unified' })
    const callId = tracer.startCall({
      traceId,
      toolName: request.toolName,
      toolType: 'plugin',
      params: request.params || {}
    })

    try {
      const result = await unifiedManager.executeTool(request)

      if (result.success) {
        tracer.endCallSuccess(callId, result.output)
      } else {
        tracer.endCallError(callId, { message: result.error || 'Unknown error' })
      }

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        source: result.source,
        taskId: result.taskId,
        executionTimeMs: result.executionTimeMs
      }
    } catch (error) {
      tracer.endCallError(callId, {
        message: String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      logger.error('Failed to execute unified tool', { request, error: String(error) })
      return { success: false, error: String(error), source: 'native' as PluginSource }
    }
  })

  // 获取所有工具定义 (MCP 格式)
  ipcMain.handle(IpcChannel.VCPUnified_GetToolDefinitions, async () => {
    try {
      const plugins = await unifiedManager.getAllPlugins()
      const definitions = plugins.map((p) => ({
        name: p.name,
        description: p.description || p.displayName,
        inputSchema: p.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }))
      return { success: true, data: definitions }
    } catch (error) {
      logger.error('Failed to get unified tool definitions', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 刷新所有插件
  ipcMain.handle(IpcChannel.VCPUnified_Refresh, async () => {
    try {
      await unifiedManager.getAllPlugins(true) // forceRefresh
      return { success: true }
    } catch (error) {
      logger.error('Failed to refresh unified plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 关闭统一插件管理器
  ipcMain.handle(IpcChannel.VCPUnified_Shutdown, async () => {
    try {
      await unifiedManager.shutdown()
      return { success: true }
    } catch (error) {
      logger.error('Failed to shutdown unified plugin manager', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== MCPO Bridge (MCP → VCP) ====================

  // 获取已注册的 MCP 服务器列表
  ipcMain.handle(IpcChannel.MCPO_GetRegisteredServers, async () => {
    try {
      // 使用统一插件管理器获取 MCP 源的插件
      const mcpPlugins = await unifiedManager.getPluginsBySource('mcp')
      const servers = new Map<string, { id: string; name: string; tools: string[] }>()

      for (const p of mcpPlugins) {
        if (p.serverId && p.serverName) {
          if (!servers.has(p.serverId)) {
            servers.set(p.serverId, { id: p.serverId, name: p.serverName, tools: [] })
          }
          servers.get(p.serverId)!.tools.push(p.name)
        }
      }

      return { success: true, data: Array.from(servers.values()) }
    } catch (error) {
      logger.error('Failed to get registered MCP servers', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 执行 MCPO 工具
  ipcMain.handle(IpcChannel.MCPO_ExecuteTool, async (_, vcpName: string, params: Record<string, string>) => {
    try {
      const result = await vcpRuntime.executeTool(vcpName, params)
      return result
    } catch (error) {
      logger.error('Failed to execute MCPO tool', { vcpName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取 VCP 插件定义 (从 MCP 转换)
  ipcMain.handle(IpcChannel.MCPO_GetVCPDefinitions, async () => {
    try {
      const plugins = vcpRuntime.listPlugins()
      return {
        success: true,
        data: plugins.map((p: VCPPlugin) => ({
          name: p.manifest.name,
          displayName: p.manifest.displayName || p.manifest.name,
          description: p.manifest.description || '',
          type: p.manifest.pluginType
        }))
      }
    } catch (error) {
      logger.error('Failed to get VCP definitions from MCPO', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP Adapter (VCP → MCP) ====================

  // 暴露所有 VCP 插件为 MCP 工具
  ipcMain.handle(IpcChannel.VCPAdapter_ExposePlugins, async () => {
    try {
      const plugins = vcpRuntime.listPlugins()
      return {
        success: true,
        data: plugins.map((p: VCPPlugin) => ({
          name: p.manifest.name,
          description: p.manifest.description || '',
          sourcePluginId: p.manifest.name
        }))
      }
    } catch (error) {
      logger.error('Failed to expose VCP plugins', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取 MCP 工具定义
  ipcMain.handle(IpcChannel.VCPAdapter_GetToolDefinitions, async () => {
    try {
      const plugins = vcpRuntime.listPlugins()
      const definitions = plugins.map((p: VCPPlugin) => ({
        name: p.manifest.name,
        description: p.manifest.description || p.manifest.displayName || '',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }))
      return { success: true, data: definitions }
    } catch (error) {
      logger.error('Failed to get VCP adapter tool definitions', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 执行适配后的工具
  ipcMain.handle(IpcChannel.VCPAdapter_ExecuteTool, async (_, toolName: string, args: Record<string, unknown>) => {
    try {
      const result = await vcpRuntime.executeTool(
        toolName,
        Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)]))
      )
      return {
        success: result.success,
        content: [{ type: 'text', text: result.output || result.error || '' }],
        isError: !result.success
      }
    } catch (error) {
      logger.error('Failed to execute VCP adapter tool', { toolName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Distributed Server Management ====================

  /**
   * 分布式服务器工具定义
   */
  interface DistributedTool {
    name: string
    description?: string
    parameters?: Record<string, unknown>
    endpoint?: string
  }

  /**
   * 分布式服务器注册信息
   */
  interface DistributedServer {
    serverId: string
    serverName?: string
    endpoint?: string
    tools: DistributedTool[]
    registeredAt: Date
    lastHeartbeat: Date
    status: 'online' | 'offline' | 'unknown'
  }

  // 分布式服务器注册表（内存存储）
  const distributedServers: Map<string, DistributedServer> = new Map()

  // 注册分布式工具
  ipcMain.handle(IpcChannel.VCPDistributed_Register, async (_, serverId: string, tools: unknown[]) => {
    try {
      logger.info('Registering distributed tools', { serverId, toolCount: tools.length })

      // 验证工具格式
      const validatedTools: DistributedTool[] = (tools as any[])
        .map((tool) => ({
          name: String(tool.name || ''),
          description: tool.description ? String(tool.description) : undefined,
          parameters: tool.parameters as Record<string, unknown> | undefined,
          endpoint: tool.endpoint ? String(tool.endpoint) : undefined
        }))
        .filter((t) => t.name.length > 0)

      // 获取或创建服务器记录
      const existing = distributedServers.get(serverId)
      const now = new Date()

      const server: DistributedServer = {
        serverId,
        serverName: existing?.serverName,
        endpoint: existing?.endpoint,
        tools: validatedTools,
        registeredAt: existing?.registeredAt || now,
        lastHeartbeat: now,
        status: 'online'
      }

      distributedServers.set(serverId, server)

      logger.info('Distributed tools registered successfully', {
        serverId,
        toolCount: validatedTools.length,
        toolNames: validatedTools.map((t) => t.name)
      })

      return { success: true, data: { toolCount: validatedTools.length } }
    } catch (error) {
      logger.error('Failed to register distributed tools', { serverId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 注销分布式工具
  ipcMain.handle(IpcChannel.VCPDistributed_Unregister, async (_, serverId: string) => {
    try {
      logger.info('Unregistering distributed tools', { serverId })

      const existed = distributedServers.has(serverId)
      distributedServers.delete(serverId)

      if (existed) {
        logger.info('Distributed server unregistered successfully', { serverId })
      } else {
        logger.warn('Distributed server not found', { serverId })
      }

      return { success: true, data: { existed } }
    } catch (error) {
      logger.error('Failed to unregister distributed tools', { serverId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取分布式服务器列表
  ipcMain.handle(IpcChannel.VCPDistributed_GetServers, async () => {
    try {
      const servers = Array.from(distributedServers.values()).map((server) => ({
        serverId: server.serverId,
        serverName: server.serverName,
        endpoint: server.endpoint,
        toolCount: server.tools.length,
        registeredAt: server.registeredAt.toISOString(),
        lastHeartbeat: server.lastHeartbeat.toISOString(),
        status: server.status
      }))

      return { success: true, data: servers }
    } catch (error) {
      logger.error('Failed to get distributed servers', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取指定服务器的工具
  ipcMain.handle(IpcChannel.VCPDistributed_GetServerTools, async (_, serverId: string) => {
    try {
      logger.info('Getting server tools', { serverId })

      const server = distributedServers.get(serverId)
      if (!server) {
        return { success: false, error: `Server ${serverId} not found` }
      }

      const tools = server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        endpoint: tool.endpoint,
        serverId: server.serverId,
        serverName: server.serverName
      }))

      return { success: true, data: tools }
    } catch (error) {
      logger.error('Failed to get server tools', { serverId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCPRuntime Config Management ====================

  // 获取 VCPRuntime 配置
  ipcMain.handle('vcp:toolbox:get-config', async () => {
    try {
      const config = vcpRuntime.getConfig()
      return { success: true, data: config }
    } catch (error) {
      logger.error('Failed to get VCPRuntime config', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 更新 VCPRuntime 配置
  ipcMain.handle('vcp:toolbox:update-config', async (_, config: Partial<VCPRuntimeConfig>) => {
    try {
      vcpRuntime.updateConfig(config)
      return { success: true }
    } catch (error) {
      logger.error('Failed to update VCPRuntime config', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 检查 VCPRuntime 是否可用（原生运行时始终可用）
  ipcMain.handle('vcp:toolbox:is-available', async () => {
    try {
      return { success: true, data: true }
    } catch (error) {
      logger.error('Failed to check VCPRuntime availability', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 检查 VCPRuntime 是否已初始化
  ipcMain.handle('vcp:toolbox:is-initialized', async () => {
    try {
      const initialized = vcpRuntime.isInitialized()
      return { success: true, data: initialized }
    } catch (error) {
      logger.error('Failed to check VCPRuntime initialization', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Knowledge Base ====================

  // 知识库服务单例（延迟初始化）
  let knowledgeService: ReturnType<typeof getNativeKnowledgeService> | null = null

  const getKnowledgeService = () => {
    if (!knowledgeService) {
      knowledgeService = getNativeKnowledgeService()
    }
    return knowledgeService
  }

  // 初始化知识库
  ipcMain.handle('vcp:knowledge:initialize', async (_, config?: Record<string, unknown>) => {
    try {
      const service = getKnowledgeService()

      // 如果提供了配置，更新配置
      if (config) {
        service.updateConfig(config as any)
      }

      const success = await service.initialize()
      return { success }
    } catch (error) {
      logger.error('Failed to initialize knowledge base', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 搜索知识库 - 使用 VCPMemoryAdapter 三段式检索
  ipcMain.handle(
    'vcp:knowledge:search',
    async (
      _,
      query: string,
      options?: {
        diaryName?: string
        k?: number
        tagBoost?: number
        backends?: string[]
        useRRF?: boolean
        timeRange?: { start?: string; end?: string }
      }
    ) => {
      const startTime = Date.now()
      try {
        // 使用 VCPMemoryAdapter 进行统一搜索（推荐的 VCP 层入口）
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const k = options?.k || 5
        const backends = (options?.backends || ['lightmemo', 'deepmemo', 'diary']) as Array<
          'lightmemo' | 'deepmemo' | 'diary' | 'memory' | 'meshmemo' | 'knowledge' | 'notes' | 'unified'
        >

        // 三段式检索：LightMemo (BM25) + DeepMemo (Tantivy) + Diary (TagMemo)
        // VCPMemoryAdapter 会自动使用 RRF 融合结果
        const result = await adapter.lightMemoSearch({
          query,
          k: k * 2, // 初筛取更多结果
          backends,
          enableLearning: true,
          minThreshold: 0.1,
          tags: options?.diaryName ? [options.diaryName] : undefined
        })

        if (!result.success || !result.results) {
          return { success: true, data: [] }
        }

        // 如果指定了日记本名称，进一步过滤结果
        let filteredResults = result.results
        if (options?.diaryName) {
          filteredResults = filteredResults.filter(
            (r) => r.metadata?.diaryName === options.diaryName || (Array.isArray(r.metadata?.tags) && r.metadata.tags.includes(options.diaryName))
          )
        }

        // 时间范围过滤
        if (options?.timeRange) {
          const startDate = options.timeRange.start ? new Date(options.timeRange.start) : null
          const endDate = options.timeRange.end ? new Date(options.timeRange.end) : null
          filteredResults = filteredResults.filter((r) => {
            const timestamp = r.metadata?.timestamp
            const itemDate = timestamp && (typeof timestamp === 'string' || typeof timestamp === 'number') ? new Date(timestamp) : null
            if (!itemDate) return true
            if (startDate && itemDate < startDate) return false
            if (endDate && itemDate > endDate) return false
            return true
          })
        }

        const finalResults = filteredResults.slice(0, k)
        const durationMs = Date.now() - startTime

        // 发送 RAG_RETRIEVAL_DETAILS 事件到 RAGObserverPanel
        try {
          const { getVCPInfoService } = await import('./VCPInfoService')
          const vcpInfoService = getVCPInfoService()
          vcpInfoService.broadcastEvent({
            type: 'RAG_RETRIEVAL_DETAILS',
            dbName: `VCPMemory(${backends.join('+')})`,
            query,
            k,
            useTime: `${durationMs}ms`,
            useRerank: options?.useRRF ?? true,
            resultCount: finalResults.length,
            results: finalResults.slice(0, 3).map((r) => ({
              score: r.score,
              preview: r.content?.substring(0, 100) + (r.content?.length > 100 ? '...' : ''),
              source: r.backend
            }))
          })
        } catch {
          // 忽略事件发送失败
        }

        return {
          success: true,
          data: finalResults.map((r) => ({
            text: r.content,
            score: r.score,
            sourceFile: r.metadata?.sourceFile || '',
            matchedTags: r.metadata?.tags || [],
            backend: r.backend,
            learningApplied: r.learning?.appliedWeight !== undefined
          })),
          backends: result.backends,
          durationMs
        }
      } catch (error) {
        logger.error('Failed to search knowledge base', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取可用日记本列表
  ipcMain.handle('vcp:knowledge:get-diaries', async () => {
    try {
      const service = getKnowledgeService()
      const diaries = await service.getAvailableDiaries()

      // 使用 NoteService 获取统计信息
      const { getNoteService } = await import('../notes/NoteService')
      const noteService = getNoteService()
      const allNotes = await noteService.listAll()

      const diaryStats = diaries.map((name) => {
        // 按名称（目录）过滤笔记
        const notesInDiary = allNotes.filter((n) => n.filePath.includes(name))
        const latestNote = notesInDiary.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
        return {
          name,
          entryCount: notesInDiary.length,
          updatedAt: latestNote?.updatedAt || null
        }
      })

      return { success: true, data: diaryStats }
    } catch (error) {
      logger.error('Failed to get diaries', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取知识库统计信息
  ipcMain.handle('vcp:knowledge:get-stats', async () => {
    try {
      const service = getKnowledgeService()
      const stats = await service.getStats()

      return {
        success: true,
        data: {
          totalFiles: stats.totalFiles,
          totalChunks: stats.totalChunks,
          totalTags: stats.totalTags,
          diaryCount: stats.diaryCount,
          tagCooccurrenceSize: stats.tagCooccurrenceSize,
          isNativeMode: stats.isNativeMode
        }
      }
    } catch (error) {
      logger.error('Failed to get knowledge base stats', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP Memory (统一记忆层接口) ====================
  // 这些端点使用 VCPMemoryAdapter 作为统一入口，整合所有记忆后端

  /**
   * 智能搜索 - VCPMemoryAdapter 核心端点
   *
   * 自动选择最佳后端组合，应用学习权重，支持 RRF 融合
   * 这是 VCP 层访问记忆系统的推荐入口
   */
  ipcMain.handle(
    'vcp:memory:intelligent-search',
    async (
      _,
      params: {
        query: string
        k?: number
        backends?: string[]
        enableLearning?: boolean
        minThreshold?: number
        tags?: string[]
        timeRangeDays?: number
        knowledgeBaseId?: string
        embeddingConfig?: {
          providerId: string
          modelId: string
          apiKey?: string
          baseUrl?: string
        }
        rerankConfig?: {
          providerId: string
          modelId: string
          apiKey?: string
          baseUrl?: string
        }
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const backends = (params.backends || ['lightmemo', 'deepmemo', 'diary', 'knowledge']) as Array<
          'lightmemo' | 'deepmemo' | 'diary' | 'memory' | 'meshmemo' | 'knowledge' | 'notes' | 'unified'
        >

        // 构建 embedApiClient（如果提供了 embeddingConfig）
        let embedApiClient: import('@types').ApiClient | undefined
        if (params.embeddingConfig) {
          // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
          embedApiClient = await buildApiClientWithCredentials(params.embeddingConfig) || undefined
          if (embedApiClient) {
            logger.debug('Built embedApiClient from embeddingConfig', {
              provider: params.embeddingConfig.providerId,
              model: params.embeddingConfig.modelId,
              hasApiKey: !!embedApiClient.apiKey
            })
          } else {
            logger.warn('Failed to build embedApiClient, will use default embedding config')
          }
        }

        // 构建 rerankApiClient（如果提供了 rerankConfig）
        let rerankApiClient: import('@types').ApiClient | undefined
        if (params.rerankConfig) {
          // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
          rerankApiClient = await buildApiClientWithCredentials(params.rerankConfig) || undefined
          if (rerankApiClient) {
            logger.debug('Built rerankApiClient from rerankConfig', {
              provider: params.rerankConfig.providerId,
              model: params.rerankConfig.modelId,
              hasApiKey: !!rerankApiClient.apiKey
            })
          } else {
            logger.warn('Failed to build rerankApiClient, will skip reranking')
          }
        }

        const result = await adapter.lightMemoSearch({
          query: params.query,
          k: params.k || 10,
          backends,
          enableLearning: params.enableLearning ?? true,
          minThreshold: params.minThreshold || 0.2,
          tags: params.tags,
          timeRangeDays: params.timeRangeDays,
          knowledgeBaseId: params.knowledgeBaseId,
          embedApiClient,
          rerankApiClient
        })

        return {
          success: result.success,
          data: result.results || [],
          totalCount: result.totalCount || 0,
          durationMs: result.durationMs,
          backends: result.backends,
          learningApplied: result.learningApplied,
          error: result.error
        }
      } catch (error) {
        logger.error('VCP Memory intelligent search failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 深度搜索 - 两阶段检索 (初筛 + 精排)
   *
   * 使用 DeepMemo 进行更精确的语义匹配
   * 适用于需要高精度结果的场景
   */
  ipcMain.handle(
    'vcp:memory:deep-search',
    async (
      _,
      params: {
        query: string
        initialK?: number
        finalK?: number
        backends?: string[]
        useReranker?: boolean
        rerankerModelId?: string
        minThreshold?: number
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const backends = (params.backends || ['deepmemo', 'lightmemo']) as Array<
          'lightmemo' | 'deepmemo' | 'diary' | 'memory' | 'meshmemo' | 'knowledge' | 'notes' | 'unified'
        >

        const result = await adapter.deepMemoSearch({
          query: params.query,
          initialK: params.initialK || 30,
          finalK: params.finalK || 10,
          backends,
          useReranker: params.useReranker ?? false,
          rerankerModelId: params.rerankerModelId,
          minThreshold: params.minThreshold || 0.5
        })

        return {
          success: result.success,
          data: result.results || [],
          totalCount: result.totalCount || 0,
          durationMs: result.durationMs,
          backends: result.backends,
          error: result.error
        }
      } catch (error) {
        logger.error('VCP Memory deep search failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * WaveRAG 三阶段检索 (Lens-Expansion-Focus)
   *
   * 通过 MemoryBrain 执行高级检索:
   * 1. Lens: 从查询提取和扩展标签
   * 2. Expansion: 通过标签共现网络扩散
   * 3. Focus: 结果精排和融合
   */
  ipcMain.handle(
    'vcp:memory:waverag-search',
    async (
      _,
      params: {
        query: string
        k?: number
        backends?: string[]
        phases?: Array<'lens' | 'expansion' | 'focus'>
        expansionDepth?: number
        focusFactor?: number
        minThreshold?: number
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const backends = (params.backends || ['deepmemo', 'lightmemo', 'knowledge']) as Array<
          'lightmemo' | 'deepmemo' | 'diary' | 'memory' | 'meshmemo' | 'knowledge' | 'notes' | 'unified'
        >

        const result = await adapter.waveRAGSearch({
          query: params.query,
          k: params.k || 15,
          backends,
          phases: params.phases,
          expansionDepth: params.expansionDepth,
          focusFactor: params.focusFactor,
          minThreshold: params.minThreshold || 0.4
        })

        return {
          success: result.success,
          data: result.results || [],
          totalCount: result.totalCount || 0,
          durationMs: result.durationMs,
          backends: result.backends,
          error: result.error
        }
      } catch (error) {
        logger.error('VCP Memory WaveRAG search failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 创建记忆条目
   *
   * 支持自动标签、后端选择
   */
  ipcMain.handle(
    'vcp:memory:create',
    async (
      _,
      params: {
        content: string
        backend?: string
        tags?: string[]
        autoTag?: boolean
        metadata?: Record<string, unknown>
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const result = await adapter.createMemory({
          content: params.content,
          backend: (params.backend || 'memory') as 'diary' | 'memory' | 'notes',
          tags: params.tags,
          autoTag: params.autoTag ?? true,
          metadata: params.metadata
        })

        return {
          success: result.success,
          data: result.entry,
          error: result.error
        }
      } catch (error) {
        logger.error('VCP Memory create failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 记录搜索反馈 (用于自学习)
   */
  ipcMain.handle(
    'vcp:memory:feedback',
    async (
      _,
      params: {
        query: string
        selectedId: string
        resultIds: string[]
        feedbackType?: 'select' | 'positive' | 'negative'
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const result = await adapter.recordFeedback(
          params.query,
          params.selectedId,
          params.resultIds,
          params.feedbackType || 'select'
        )

        return result
      } catch (error) {
        logger.error('VCP Memory feedback failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 获取标签建议
   */
  ipcMain.handle('vcp:memory:tag-suggestions', async (_, partialQuery: string, existingTags?: string[]) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const result = await adapter.getTagSuggestions(partialQuery, existingTags)

      return result
    } catch (error) {
      logger.error('VCP Memory tag suggestions failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 获取综合统计信息
   */
  ipcMain.handle('vcp:memory:stats', async () => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const result = await adapter.getStats()

      return result
    } catch (error) {
      logger.error('VCP Memory stats failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 获取学习进度
   */
  ipcMain.handle('vcp:memory:learning-progress', async () => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const progress = adapter.getLearningProgress()

      return { success: true, data: progress }
    } catch (error) {
      logger.error('VCP Memory learning progress failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 获取/更新配置
   */
  ipcMain.handle('vcp:memory:get-config', async () => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const config = adapter.getConfig()

      return { success: true, data: config }
    } catch (error) {
      logger.error('VCP Memory get config failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vcp:memory:update-config', async (_, config: Record<string, unknown>) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      adapter.updateConfig(config as any)

      return { success: true }
    } catch (error) {
      logger.error('VCP Memory update config failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP Memory 管理操作 (UI 层支持) ====================

  /**
   * 列出记忆条目
   */
  ipcMain.handle(
    'vcp:memory:list',
    async (
      _,
      params: {
        source?: 'memory' | 'diary' | 'all'
        userId?: string
        agentId?: string
        limit?: number
        offset?: number
      }
    ) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const result = await adapter.listMemories(params)

        return result
      } catch (error) {
        logger.error('VCP Memory list failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 删除单个记忆条目
   */
  ipcMain.handle('vcp:memory:delete', async (_, id: string) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const result = await adapter.deleteMemory(id)

      return result
    } catch (error) {
      logger.error('VCP Memory delete failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 更新记忆条目
   */
  ipcMain.handle(
    'vcp:memory:update',
    async (_, id: string, data: { content?: string; metadata?: Record<string, unknown> }) => {
      try {
        const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
        const adapter = getVCPMemoryAdapter()

        const result = await adapter.updateMemory(id, data)

        return result
      } catch (error) {
        logger.error('VCP Memory update failed', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * 删除用户的所有记忆
   */
  ipcMain.handle('vcp:memory:delete-all-for-user', async (_, userId: string) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const result = await adapter.deleteAllMemoriesForUser(userId)

      return result
    } catch (error) {
      logger.error('VCP Memory delete all for user failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 获取用户列表及其记忆统计
   */
  ipcMain.handle('vcp:memory:get-users-list', async () => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      const result = await adapter.getUsersList()

      return result
    } catch (error) {
      logger.error('VCP Memory get users list failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 验证嵌入配置
   * 检测实际返回的向量维度是否与配置匹配
   */
  ipcMain.handle('vcp:memory:validate-embedding-config', async (_, params: {
    providerId: string
    modelId: string
    apiKey?: string
    baseUrl?: string
  }) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
      const embedApiClient = await buildApiClientWithCredentials(params)
      if (!embedApiClient) {
        return {
          success: false,
          error: `Cannot get API credentials for provider '${params.providerId}'. Please check your provider configuration.`
        }
      }

      const result = await adapter.validateEmbeddingConfig(embedApiClient)

      return result
    } catch (error) {
      logger.error('VCP Memory validate embedding config failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  /**
   * 重建向量索引
   * 使用指定维度重新初始化索引并重新嵌入所有数据
   */
  ipcMain.handle('vcp:memory:rebuild-vector-index', async (_, params: {
    dimensions: number
    providerId: string
    modelId: string
    apiKey?: string
    baseUrl?: string
  }) => {
    try {
      const { getVCPMemoryAdapter } = await import('../../memory/adapters/VCPMemoryAdapter')
      const adapter = getVCPMemoryAdapter()

      // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
      const embedApiClient = await buildApiClientWithCredentials(params)
      if (!embedApiClient) {
        return {
          success: false,
          error: `Cannot get API credentials for provider '${params.providerId}'. Please check your provider configuration.`
        }
      }

      const result = await adapter.rebuildVectorIndex({
        dimensions: params.dimensions,
        embedApiClient
      })

      return result
    } catch (error) {
      logger.error('VCP Memory rebuild vector index failed', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCP 占位符解析 ====================

  // 注意：占位符解析由 VCPIpcHandler.ts 中的 IpcChannel.VCP_Placeholder_Resolve 统一处理
  // 返回格式: { success: boolean, result?: string, error?: string }
  // 此处不再重复注册，避免与 VCPCore handler 冲突

  // ==================== Plugin Stats ====================

  // 获取插件统计信息（包括禁用插件）
  ipcMain.handle(IpcChannel.VCPPlugin_GetStats, async () => {
    try {
      const { getPluginStats } = await import('./PluginInitializer')
      const stats = getPluginStats()
      return {
        success: true,
        data: {
          active: stats.active,
          blocked: stats.blocked,
          total: stats.total,
          blockedNames: stats.blockedNames
        }
      }
    } catch (error) {
      logger.error('Failed to get plugin stats', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCPRuntime 事件转发 ====================

  // 订阅 VCPRuntime 事件并转发到渲染进程
  vcpRuntime.addEventListener((event) => {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()

    const eventPayload = {
      type: event.type,
      timestamp: new Date().toISOString(),
      data: event
    }

    // 根据事件类型选择对应的 IPC 通道
    let channel: string

    switch (event.type) {
      case 'tool:start':
        channel = IpcChannel.VCPEvent_ToolExecutionStart
        break
      case 'tool:complete':
        channel = IpcChannel.VCPEvent_ToolExecutionComplete
        break
      case 'tool:error':
        channel = IpcChannel.VCPEvent_ToolExecutionError
        break
      case 'plugin:loaded':
        channel = IpcChannel.VCPEvent_PluginRegistered
        break
      case 'plugin:unloaded':
        channel = IpcChannel.VCPEvent_PluginUnregistered
        break
      case 'plugin:error':
        channel = IpcChannel.VCPEvent_PluginError
        break
      case 'async:created':
        channel = IpcChannel.VCPEvent_AsyncTaskCreated
        break
      case 'async:completed':
        channel = IpcChannel.VCPEvent_AsyncTaskCompleted
        break
      case 'async:timeout':
        channel = IpcChannel.VCPEvent_AsyncTaskTimeout
        break
      default:
        // 未知事件类型，不转发
        return
    }

    // 向所有窗口发送事件
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, eventPayload)
      }
    }

    logger.debug('VCPRuntime event forwarded to renderer', {
      type: event.type,
      channel,
      windowCount: windows.length
    })
  })

  // ==================== Preprocessor Chain Management ====================

  // 获取预处理器顺序
  ipcMain.handle('vcp:preprocessor:get-order', async () => {
    try {
      const order = vcpRuntime.getPreprocessorOrder()
      return { success: true, data: order }
    } catch (error) {
      logger.error('Failed to get preprocessor order', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 设置预处理器顺序
  ipcMain.handle('vcp:preprocessor:set-order', async (_, order: string[]) => {
    try {
      const success = await vcpRuntime.setPreprocessorOrder(order)
      return { success }
    } catch (error) {
      logger.error('Failed to set preprocessor order', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取预处理器信息列表（用于 UI）
  ipcMain.handle('vcp:preprocessor:get-info', async () => {
    try {
      const info = vcpRuntime.getPreprocessorInfo()
      return { success: true, data: info }
    } catch (error) {
      logger.error('Failed to get preprocessor info', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 重新加载预处理器链
  ipcMain.handle('vcp:preprocessor:reload', async () => {
    try {
      const chain = vcpRuntime.getPreprocessorChain()
      if (chain) {
        await chain.reload()
        return { success: true }
      }
      return { success: false, error: 'PreprocessorChain not initialized' }
    } catch (error) {
      logger.error('Failed to reload preprocessor chain', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  logger.info('VCP Plugin IPC handlers registered successfully (Native VCPRuntime)')
}
