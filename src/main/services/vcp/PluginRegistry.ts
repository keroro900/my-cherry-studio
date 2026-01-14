/**
 * VCP Native Runtime - Plugin Registry
 *
 * 负责插件清单加载、插件生命周期管理
 * 完全兼容 VCPToolBox plugin-manifest.json 格式
 *
 * 彻底 VCP 化：支持 MCP 工具自动桥接为 VCP 插件
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { installPluginDependencies } from './DependencyInstaller'
import {
  getExternalPluginManager,
  initializeExternalPluginManager,
  type InstalledPlugin
} from './ExternalPluginManager'
import type { VCPPlugin, VCPPluginManifest, VCPRuntimeConfig, VCPToolResult } from './types'

const logger = loggerService.withContext('VCP:PluginRegistry')

/**
 * MCP 工具定义（用于桥接）
 */
export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

/**
 * MCP 服务器接口（用于桥接）
 */
export interface MCPServerInterface {
  id: string
  name: string
  isActive: boolean
  listTools(): Promise<MCPToolDefinition[]>
  executeTool(
    name: string,
    args: Record<string, any>
  ): Promise<{
    content: Array<{ type: string; text?: string }>
    isError?: boolean
  }>
}

/**
 * 插件注册表
 */
export class PluginRegistry {
  private plugins: Map<string, VCPPlugin> = new Map()
  private pluginsByAlias: Map<string, string> = new Map() // alias -> name
  private config: VCPRuntimeConfig

  constructor(config: VCPRuntimeConfig) {
    this.config = config
  }

  /**
   * 加载所有插件
   *
   * 插件分为两类：
   * - 内置插件 (builtin): 从 builtinPluginsDir 加载，isBuiltin = true
   * - 外部插件 (external): 从 pluginsDir 和 userData/vcp/plugins 加载
   */
  async loadAllPlugins(): Promise<void> {
    logger.info('Loading all plugins...')

    // 清空现有插件
    this.plugins.clear()
    this.pluginsByAlias.clear()

    // 加载内置插件
    if (this.config.builtinPluginsDir && fs.existsSync(this.config.builtinPluginsDir)) {
      await this.loadPluginsFromDir(this.config.builtinPluginsDir, 'builtin')
    }

    // 加载外部插件（用户目录）
    if (this.config.pluginsDir && fs.existsSync(this.config.pluginsDir)) {
      await this.loadPluginsFromDir(this.config.pluginsDir, 'user')
    }

    // 加载外部插件（userData/vcp/plugins）
    await this.loadExternalPlugins()

    logger.info('Plugins loaded', {
      total: this.plugins.size,
      names: Array.from(this.plugins.keys())
    })
  }

  /**
   * 从 ExternalPluginManager 加载外部插件
   *
   * 外部插件来源于 userData/vcp/plugins 目录
   * 支持 stdio 类型插件（synchronous/asynchronous）
   */
  private async loadExternalPlugins(): Promise<void> {
    try {
      // 初始化外部插件管理器
      const manager = await initializeExternalPluginManager()
      const installedPlugins = manager.getInstalledPlugins()

      if (installedPlugins.length === 0) {
        logger.debug('No external plugins found')
        return
      }

      logger.info('Loading external plugins', { count: installedPlugins.length })

      for (const externalPlugin of installedPlugins) {
        // 跳过禁用的插件
        if (!externalPlugin.enabled) {
          logger.debug('Skipping disabled external plugin', { name: externalPlugin.manifest.name })
          continue
        }

        // 检查是否已存在同名插件（内置/用户优先）
        if (this.plugins.has(externalPlugin.manifest.name)) {
          logger.warn('External plugin conflicts with existing plugin, skipping', {
            name: externalPlugin.manifest.name,
            existingType: this.plugins.get(externalPlugin.manifest.name)?.manifest.pluginType
          })
          continue
        }

        try {
          const vcpPlugin = this.convertExternalToVCPPlugin(externalPlugin)
          if (vcpPlugin) {
            this.registerPlugin(vcpPlugin)
            logger.debug('External plugin loaded', {
              name: vcpPlugin.manifest.name,
              type: vcpPlugin.manifest.pluginType,
              source: 'external'
            })
          }
        } catch (error) {
          logger.warn('Failed to convert external plugin', {
            name: externalPlugin.manifest.name,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to load external plugins', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 将外部插件格式转换为 VCP 插件格式
   * 支持两种清单格式：
   * - Cherry Studio 格式: manifest.type
   * - VCPToolBox 格式: manifest.pluginType
   */
  private convertExternalToVCPPlugin(external: InstalledPlugin): VCPPlugin | null {
    const { manifest, path: pluginPath } = external

    // 映射外部插件类型到 VCP 插件类型
    const typeMapping: Record<string, VCPPluginManifest['pluginType']> = {
      static: 'static',
      messagePreprocessor: 'messagePreprocessor',
      service: 'service',
      hybridservice: 'hybridservice',
      synchronous: 'synchronous',
      asynchronous: 'asynchronous'
    }

    // 兼容两种格式：优先使用 type，其次使用 pluginType（VCPToolBox 格式）
    const rawType = manifest.type || (manifest as any).pluginType
    const vcpPluginType = typeMapping[rawType]

    if (!vcpPluginType) {
      // 对于没有类型的插件，默认作为 service 类型（内置服务兼容）
      // 这些通常是 BuiltinServices 的外部清单
      logger.debug('External plugin without type, treating as builtin_service alias', {
        name: manifest.name
      })
      return null
    }

    // 仅原生模式：跳过 stdio 插件
    if (this.config.nativeOnly && ['synchronous', 'asynchronous'].includes(rawType)) {
      logger.info('Skipping external stdio plugin (nativeOnly mode enabled)', {
        plugin: manifest.name,
        type: rawType
      })
      return null
    }

    // 构建 VCP 清单
    const vcpManifest: VCPPluginManifest = {
      name: manifest.name,
      displayName: manifest.displayName || `[External] ${manifest.name}`,
      description: manifest.description || '',
      version: manifest.version,
      pluginType: vcpPluginType,
      defaultConfig: manifest.defaultConfig || {},
      capabilities: {
        toolFunctions: (manifest.tools || []).map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }
    }

    // stdio 类型需要设置 entryPoint
    if (['synchronous', 'asynchronous'].includes(rawType) && manifest.command) {
      vcpManifest.entryPoint = {
        command: manifest.command,
        args: manifest.args,
        timeout: manifest.timeout || (rawType === 'synchronous' ? 30000 : 300000)
      }

      // 弃用警告
      logger.warn('[DEPRECATED] External stdio plugin detected', {
        plugin: manifest.name,
        type: rawType,
        message: '请将此插件迁移到 builtin_service 或 service 类型。stdio 执行将在未来版本移除。'
      })
    }

    // 创建 VCP 插件实例
    const vcpPlugin: VCPPlugin = {
      manifest: vcpManifest,
      basePath: pluginPath,
      enabled: external.enabled,
      loaded: true,
      isBuiltin: false,
      userConfig: external.configOverrides,
      // 标记为外部插件
      externalPlugin: {
        installedAt: external.installedAt,
        permissions: typeof manifest.permissions === 'object' && !Array.isArray(manifest.permissions)
          ? manifest.permissions
          : undefined
      }
    }

    return vcpPlugin
  }

  /**
   * 从目录加载插件
   */
  private async loadPluginsFromDir(dir: string, source: 'builtin' | 'user'): Promise<void> {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const pluginDir = path.join(dir, entry.name)
        const manifestPath = path.join(pluginDir, 'plugin-manifest.json')

        if (!fs.existsSync(manifestPath)) {
          logger.debug('No manifest found, skipping', { dir: pluginDir })
          continue
        }

        try {
          const plugin = await this.loadPlugin(pluginDir, manifestPath, source === 'builtin')
          if (plugin) {
            this.registerPlugin(plugin)
            logger.debug('Plugin loaded', {
              name: plugin.manifest.name,
              type: plugin.manifest.pluginType,
              source,
              isBuiltin: plugin.isBuiltin
            })
          }
        } catch (error) {
          logger.warn('Failed to load plugin', {
            dir: pluginDir,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } catch (error) {
      logger.error('Failed to read plugins directory', {
        dir,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }

  /**
   * 加载单个插件
   */
  private async loadPlugin(
    pluginDir: string,
    manifestPath: string,
    isBuiltin: boolean = false
  ): Promise<VCPPlugin | null> {
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent) as VCPPluginManifest

      // 验证必需字段
      if (!manifest.name) {
        throw new Error('Missing required field: name')
      }
      if (!manifest.pluginType) {
        throw new Error('Missing required field: pluginType')
      }

      // 验证 stdio 类型必须有入口点（已弃用，添加警告）
      if (['synchronous', 'asynchronous'].includes(manifest.pluginType)) {
        // 仅原生模式：跳过 stdio 插件
        if (this.config.nativeOnly) {
          logger.info('Skipping stdio plugin (nativeOnly mode enabled)', {
            plugin: manifest.name,
            type: manifest.pluginType,
            path: pluginDir
          })
          return null
        }

        if (!manifest.entryPoint?.command) {
          throw new Error(`Plugin type ${manifest.pluginType} requires entryPoint.command`)
        }
        // 弃用警告
        logger.warn('[DEPRECATED] stdio 插件类型已弃用', {
          plugin: manifest.name,
          type: manifest.pluginType,
          path: pluginDir,
          message: '请将此插件迁移到 builtin_service 或 service 类型。stdio 执行将在未来版本移除。'
        })
      }

      // 创建插件实例
      const plugin: VCPPlugin = {
        manifest,
        basePath: pluginDir,
        enabled: true,
        loaded: true,
        isBuiltin
      }

      // 加载用户配置（从 builtin-configs 目录）
      if (isBuiltin) {
        const userConfig = this.loadBuiltinPluginConfig(manifest.name)
        if (userConfig) {
          plugin.userConfig = userConfig
          logger.debug('Loaded userConfig for plugin', {
            plugin: manifest.name,
            configKeys: Object.keys(userConfig)
          })
        }
      }

      // 加载服务模块（service/hybridservice 类型）
      if (['service', 'hybridservice'].includes(manifest.pluginType)) {
        await this.loadServiceModule(plugin)
      }

      return plugin
    } catch (error) {
      logger.error('Failed to parse plugin manifest', {
        path: manifestPath,
        error: error instanceof Error ? error : new Error(String(error))
      })
      return null
    }
  }

  /**
   * 加载服务模块
   */
  private async loadServiceModule(plugin: VCPPlugin): Promise<void> {
    const { manifest, basePath } = plugin
    const serviceConfig = manifest.serviceConfig

    // 自动安装依赖
    try {
      const installResult = await installPluginDependencies(basePath)
      if (installResult.installed.length > 0) {
        logger.info('Auto-installed dependencies for plugin', {
          plugin: manifest.name,
          installed: installResult.installed,
          duration: installResult.duration
        })
      }
      if (!installResult.success) {
        logger.warn('Some dependencies failed to install', {
          plugin: manifest.name,
          errors: installResult.errors
        })
      }
    } catch (error) {
      logger.warn('Failed to auto-install dependencies', {
        plugin: manifest.name,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    if (!serviceConfig?.modulePath) {
      // 尝试默认路径
      const defaultPaths = ['index.js', 'main.js', 'service.js']
      for (const p of defaultPaths) {
        const fullPath = path.join(basePath, p)
        if (fs.existsSync(fullPath)) {
          try {
            // 清除 require 缓存
            delete require.cache[require.resolve(fullPath)]
            plugin.serviceModule = require(fullPath)
            logger.debug('Service module loaded', { plugin: manifest.name, path: fullPath })
            return
          } catch (error) {
            logger.warn('Failed to load service module', {
              plugin: manifest.name,
              path: fullPath,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      }
      logger.warn('No service module found for plugin', { plugin: manifest.name })
      return
    }

    const modulePath = path.join(basePath, serviceConfig.modulePath)
    if (!fs.existsSync(modulePath)) {
      plugin.error = `Service module not found: ${modulePath}`
      return
    }

    try {
      delete require.cache[require.resolve(modulePath)]
      plugin.serviceModule = require(modulePath)
      logger.debug('Service module loaded', { plugin: manifest.name, path: modulePath })
    } catch (error) {
      plugin.error = `Failed to load service module: ${error instanceof Error ? error.message : String(error)}`
      logger.error('Failed to load service module', {
        plugin: manifest.name,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }

  /**
   * 注册插件
   */
  private registerPlugin(plugin: VCPPlugin): void {
    const name = plugin.manifest.name

    // 主名称注册
    this.plugins.set(name, plugin)

    // 别名注册（小写、无下划线等变体）
    this.registerAliases(name)

    // 工具函数别名
    const toolFunctions = plugin.manifest.capabilities?.toolFunctions || []
    for (const tool of toolFunctions) {
      if (tool.name && tool.name !== name) {
        this.pluginsByAlias.set(tool.name.toLowerCase(), name)
        this.pluginsByAlias.set(this.normalizeKey(tool.name), name)
      }
    }
  }

  /**
   * 注册插件别名
   */
  private registerAliases(name: string): void {
    // 小写
    this.pluginsByAlias.set(name.toLowerCase(), name)

    // 归一化（下划线、连字符等价）
    this.pluginsByAlias.set(this.normalizeKey(name), name)

    // 无下划线/连字符版本
    this.pluginsByAlias.set(name.replace(/[-_]/g, '').toLowerCase(), name)
  }

  /**
   * Key 归一化（兼容 VCPToolBox）
   * 大小写不敏感，`_`/`-` 等价
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/-/g, '_')
  }

  /**
   * 获取插件（支持别名和模糊匹配）
   *
   * 查找顺序:
   * 1. 精确匹配 name
   * 2. 别名匹配 (normalizedName)
   * 3. displayName 精确匹配 (容错机制)
   * 4. 模糊匹配（包含）
   */
  getPlugin(name: string): VCPPlugin | null {
    // 精确匹配
    if (this.plugins.has(name)) {
      return this.plugins.get(name) || null
    }

    // 别名匹配
    const normalizedName = this.normalizeKey(name)
    const realName = this.pluginsByAlias.get(normalizedName) || this.pluginsByAlias.get(name.toLowerCase())

    if (realName) {
      return this.plugins.get(realName) || null
    }

    // displayName 精确匹配 (容错机制)
    // AI 可能使用中文显示名（如 "RAG日记本检索器"）而不是工具 ID（"RAGDiaryPlugin"）
    for (const [pluginName, plugin] of this.plugins) {
      if (plugin.manifest.displayName === name) {
        logger.debug('Plugin found via displayName match', {
          requested: name,
          matched: pluginName
        })
        return plugin
      }
    }

    // 模糊匹配（包含）- 添加警告日志，可能导致误路由
    const fuzzyMatches: Array<{ pluginName: string; plugin: VCPPlugin }> = []
    for (const [pluginName, plugin] of this.plugins) {
      if (pluginName.toLowerCase().includes(name.toLowerCase())) {
        fuzzyMatches.push({ pluginName, plugin })
      }
    }

    if (fuzzyMatches.length > 1) {
      // 多个模糊匹配，记录警告
      logger.warn('Multiple fuzzy matches found for plugin lookup', {
        requested: name,
        matches: fuzzyMatches.map((m) => m.pluginName),
        selected: fuzzyMatches[0].pluginName
      })
    } else if (fuzzyMatches.length === 1) {
      // 单个模糊匹配，记录调试信息
      logger.debug('Plugin found via fuzzy matching', {
        requested: name,
        matched: fuzzyMatches[0].pluginName
      })
    }

    if (fuzzyMatches.length > 0) {
      return fuzzyMatches[0].plugin
    }

    return null
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): VCPPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): VCPPlugin[] {
    return this.getAllPlugins().filter((p) => p.enabled && p.loaded && !p.error)
  }

  /**
   * 按类型获取插件
   */
  getPluginsByType(type: VCPPlugin['manifest']['pluginType']): VCPPlugin[] {
    return this.getEnabledPlugins().filter((p) => p.manifest.pluginType === type)
  }

  /**
   * 启用/禁用插件
   */
  setPluginEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.getPlugin(name)
    if (!plugin) return false
    plugin.enabled = enabled
    return true
  }

  /**
   * 重新加载单个插件
   */
  async reloadPlugin(name: string): Promise<boolean> {
    const plugin = this.getPlugin(name)
    if (!plugin) return false

    const manifestPath = path.join(plugin.basePath, 'plugin-manifest.json')
    const newPlugin = await this.loadPlugin(plugin.basePath, manifestPath)

    if (newPlugin) {
      // 保留用户配置
      newPlugin.userConfig = plugin.userConfig
      newPlugin.enabled = plugin.enabled

      this.plugins.set(name, newPlugin)
      return true
    }

    return false
  }

  /**
   * 卸载插件
   */
  unloadPlugin(name: string): boolean {
    const plugin = this.getPlugin(name)
    if (!plugin) return false

    // 清理服务模块
    if (plugin.serviceModule) {
      const shutdownMethod = plugin.manifest.serviceConfig?.shutdownMethod || 'shutdown'
      if (typeof plugin.serviceModule[shutdownMethod] === 'function') {
        try {
          plugin.serviceModule[shutdownMethod]()
        } catch (error) {
          logger.warn('Error during plugin shutdown', {
            plugin: name,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    this.plugins.delete(plugin.manifest.name)
    return true
  }

  /**
   * 获取插件数量
   */
  get size(): number {
    return this.plugins.size
  }

  /**
   * 检查插件是否存在
   */
  has(name: string): boolean {
    return this.getPlugin(name) !== null
  }

  /**
   * 清空所有插件
   */
  clear(): void {
    // 关闭所有服务模块
    for (const plugin of this.plugins.values()) {
      if (plugin.serviceModule) {
        const shutdownMethod = plugin.manifest.serviceConfig?.shutdownMethod || 'shutdown'
        if (typeof plugin.serviceModule[shutdownMethod] === 'function') {
          try {
            plugin.serviceModule[shutdownMethod]()
          } catch {
            // 忽略关闭错误
          }
        }
      }
    }

    this.plugins.clear()
    this.pluginsByAlias.clear()
  }

  /**
   * 获取插件的占位符列表
   */
  getPluginPlaceholders(name: string): string[] {
    const plugin = this.getPlugin(name)
    if (!plugin) return []

    const placeholders = plugin.manifest.capabilities?.systemPromptPlaceholders || []
    return placeholders.map((p) => p.placeholder)
  }

  /**
   * 获取所有静态插件的占位符
   */
  getAllStaticPlaceholders(): Map<string, VCPPlugin> {
    const result = new Map<string, VCPPlugin>()

    for (const plugin of this.getPluginsByType('static')) {
      const placeholders = plugin.manifest.capabilities?.systemPromptPlaceholders || []
      for (const p of placeholders) {
        result.set(p.placeholder, plugin)
      }
    }

    return result
  }

  /**
   * 更新插件用户配置
   */
  updatePluginConfig(name: string, config: Record<string, any>): boolean {
    const plugin = this.getPlugin(name)
    if (!plugin) return false

    plugin.userConfig = { ...plugin.userConfig, ...config }
    return true
  }

  /**
   * 获取插件配置（合并默认值和用户覆盖）
   */
  getPluginConfig(name: string): Record<string, any> {
    const plugin = this.getPlugin(name)
    if (!plugin) return {}

    return {
      ...plugin.manifest.defaultConfig,
      ...plugin.userConfig
    }
  }

  /**
   * 加载内置插件配置（从 builtin-configs 目录）
   */
  private loadBuiltinPluginConfig(pluginId: string): Record<string, any> | null {
    const configPath = path.join(app.getPath('userData'), 'vcp', 'builtin-configs', `${pluginId}.json`)

    if (!fs.existsSync(configPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.warn('Failed to load builtin plugin config', {
        pluginId,
        configPath,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  // ==================== MCP 桥接（彻底 VCP 化） ====================

  /**
   * 注册 MCP 服务器的所有工具为 VCP 插件
   *
   * 彻底 VCP 化核心：将 MCP 工具自动转换为 VCP 插件
   */
  async registerMCPServer(server: MCPServerInterface): Promise<number> {
    if (!server.isActive) {
      logger.debug('Skipping inactive MCP server', { name: server.name })
      return 0
    }

    logger.info('Bridging MCP server to VCP', { serverId: server.id, name: server.name })

    try {
      const tools = await server.listTools()
      let count = 0

      for (const tool of tools) {
        const plugin = this.createMCPBridgePlugin(server, tool)
        this.registerPlugin(plugin)
        count++
      }

      logger.info('MCP server bridged successfully', {
        server: server.name,
        toolCount: count
      })

      return count
    } catch (error) {
      logger.error('Failed to bridge MCP server', {
        server: server.name,
        error: error instanceof Error ? error.message : String(error)
      })
      return 0
    }
  }

  /**
   * 创建 MCP 桥接插件
   */
  private createMCPBridgePlugin(server: MCPServerInterface, tool: MCPToolDefinition): VCPPlugin {
    // 生成 VCP 插件名称：mcp_<server>_<tool>
    const vcpName = `mcp_${server.name}_${tool.name}`.replace(/[^a-zA-Z0-9_]/g, '_')

    // 创建执行处理器
    const handler = async (args: Record<string, any>): Promise<VCPToolResult> => {
      const startTime = Date.now()

      try {
        const result = await server.executeTool(tool.name, args)

        // 转换 MCP 结果为 VCP 格式
        const output = result.content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n')

        return {
          success: !result.isError,
          output,
          error: result.isError ? output : undefined,
          executionTimeMs: Date.now() - startTime
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      }
    }

    // 转换 inputSchema 为 VCP toolFunctions 格式
    const toolFunctions = [
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    ]

    // 创建 VCP 插件清单
    const manifest: VCPPluginManifest = {
      name: vcpName,
      displayName: `[MCP] ${tool.name}`,
      description: tool.description || `MCP tool from ${server.name}`,
      version: '1.0.0',
      pluginType: 'mcp_bridge',
      capabilities: {
        toolFunctions
      }
    }

    // 创建 VCP 插件实例
    const plugin: VCPPlugin = {
      manifest,
      basePath: '', // MCP 桥接插件无本地路径
      enabled: true,
      loaded: true,
      mcpBridge: {
        serverId: server.id,
        serverName: server.name,
        toolName: tool.name,
        inputSchema: tool.inputSchema,
        handler
      }
    }

    return plugin
  }

  /**
   * 注销 MCP 服务器的所有桥接插件
   */
  unregisterMCPServer(serverId: string): number {
    let count = 0

    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.mcpBridge?.serverId === serverId) {
        this.plugins.delete(name)
        count++
      }
    }

    // 清理别名
    for (const [alias, name] of this.pluginsByAlias.entries()) {
      if (!this.plugins.has(name)) {
        this.pluginsByAlias.delete(alias)
      }
    }

    if (count > 0) {
      logger.info('MCP server unregistered', { serverId, unregisteredCount: count })
    }

    return count
  }

  /**
   * 获取所有 MCP 桥接插件
   */
  getMCPBridgePlugins(): VCPPlugin[] {
    return this.getAllPlugins().filter((p) => p.manifest.pluginType === 'mcp_bridge')
  }

  /**
   * 检查是否为 MCP 桥接插件
   */
  isMCPBridgePlugin(name: string): boolean {
    const plugin = this.getPlugin(name)
    return plugin?.manifest.pluginType === 'mcp_bridge'
  }

  /**
   * 从指定路径加载单个插件（公开方法）
   * @param pluginPath 插件目录路径（包含 plugin-manifest.json）
   * @returns 加载结果
   */
  async loadPluginFromPath(pluginPath: string): Promise<{
    success: boolean
    plugin?: VCPPlugin
    error?: string
  }> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin-manifest.json')

      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          error: `Manifest not found: ${manifestPath}`
        }
      }

      const plugin = await this.loadPlugin(pluginPath, manifestPath, false)

      if (plugin) {
        this.registerPlugin(plugin)
        logger.info('Plugin loaded from custom path', {
          name: plugin.manifest.name,
          type: plugin.manifest.pluginType,
          path: pluginPath
        })
        return { success: true, plugin }
      }

      return { success: false, error: 'Failed to load plugin' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to load plugin from path', { path: pluginPath, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 获取插件目录路径
   */
  getPluginsDir(): { userDir: string; builtinDir?: string } {
    return {
      userDir: this.config.pluginsDir,
      builtinDir: this.config.builtinPluginsDir
    }
  }

  // ==================== 外部插件管理方法 ====================

  /**
   * 获取所有外部插件
   */
  getExternalPlugins(): VCPPlugin[] {
    return this.getAllPlugins().filter((p) => p.externalPlugin !== undefined)
  }

  /**
   * 检查是否为外部插件
   */
  isExternalPlugin(name: string): boolean {
    const plugin = this.getPlugin(name)
    return plugin?.externalPlugin !== undefined
  }

  /**
   * 仅重新加载外部插件（不影响内置/用户插件）
   */
  async reloadExternalPlugins(): Promise<{ loaded: number; failed: number }> {
    logger.info('Reloading external plugins...')

    // 移除现有外部插件
    const externalNames: string[] = []
    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.externalPlugin) {
        externalNames.push(name)
      }
    }

    for (const name of externalNames) {
      this.plugins.delete(name)
    }

    // 清理别名
    for (const [alias, name] of this.pluginsByAlias.entries()) {
      if (!this.plugins.has(name)) {
        this.pluginsByAlias.delete(alias)
      }
    }

    // 重新加载外部插件
    let loaded = 0
    let failed = 0

    try {
      const manager = getExternalPluginManager()
      await manager.scanInstalledPlugins() // 重新扫描
      const installedPlugins = manager.getInstalledPlugins()

      for (const externalPlugin of installedPlugins) {
        if (!externalPlugin.enabled) continue

        if (this.plugins.has(externalPlugin.manifest.name)) {
          logger.warn('External plugin conflicts with existing plugin after reload', {
            name: externalPlugin.manifest.name
          })
          failed++
          continue
        }

        try {
          const vcpPlugin = this.convertExternalToVCPPlugin(externalPlugin)
          if (vcpPlugin) {
            this.registerPlugin(vcpPlugin)
            loaded++
          } else {
            failed++
          }
        } catch (error) {
          logger.warn('Failed to reload external plugin', {
            name: externalPlugin.manifest.name,
            error: error instanceof Error ? error.message : String(error)
          })
          failed++
        }
      }
    } catch (error) {
      logger.error('Failed to reload external plugins', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    logger.info('External plugins reloaded', { loaded, failed, removed: externalNames.length })
    return { loaded, failed }
  }

  /**
   * 获取插件统计信息
   */
  getPluginStats(): {
    total: number
    builtin: number
    external: number
    mcpBridge: number
    enabled: number
    disabled: number
    byType: Record<string, number>
  } {
    const plugins = this.getAllPlugins()

    const stats = {
      total: plugins.length,
      builtin: 0,
      external: 0,
      mcpBridge: 0,
      enabled: 0,
      disabled: 0,
      byType: {} as Record<string, number>
    }

    for (const plugin of plugins) {
      // 来源分类：只有内置和外部两种
      if (plugin.mcpBridge) {
        stats.mcpBridge++
      } else if (plugin.isBuiltin) {
        stats.builtin++
      } else {
        // user 和 external 都算外部插件
        stats.external++
      }

      // 启用状态
      if (plugin.enabled) {
        stats.enabled++
      } else {
        stats.disabled++
      }

      // 按类型统计
      const type = plugin.manifest.pluginType
      stats.byType[type] = (stats.byType[type] || 0) + 1
    }

    return stats
  }

  /**
   * 同步外部插件启用状态到 ExternalPluginManager
   */
  async syncExternalPluginState(name: string, enabled: boolean): Promise<boolean> {
    try {
      const manager = getExternalPluginManager()
      const result = manager.setPluginEnabled(name, enabled)

      if (result) {
        // 同时更新本地注册表
        const plugin = this.getPlugin(name)
        if (plugin) {
          plugin.enabled = enabled
        }
      }

      return result
    } catch (error) {
      logger.error('Failed to sync external plugin state', {
        name,
        enabled,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }
}

/**
 * 创建插件注册表实例
 */
export function createPluginRegistry(config: VCPRuntimeConfig): PluginRegistry {
  return new PluginRegistry(config)
}
