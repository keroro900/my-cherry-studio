/**
 * External Plugin Manager
 *
 * 管理外部插件的安装、卸载、配置
 *
 * 目录结构:
 * userData/
 * └── vcp/
 *     ├── plugins/           # 外部插件目录
 *     │   ├── plugin-a/
 *     │   │   ├── manifest.json
 *     │   │   └── main.js
 *     │   └── plugin-b/
 *     │       ├── manifest.json
 *     │       └── main.py
 *     ├── assets/            # 插件共享资产
 *     │   └── danbooru_artist.csv
 *     └── config/            # 插件配置
 *         └── plugins.json
 *
 * @module services/vcp/ExternalPluginManager
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('ExternalPluginManager')

// ==================== 类型定义 ====================

/**
 * 配置字段 Schema
 */
export interface ConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  default?: unknown
  description?: string
  enum?: string[]
  min?: number
  max?: number
}

/**
 * VCP 原生插件 manifest 格式
 */
export interface ExternalPluginManifest {
  /** 插件唯一标识 */
  name: string
  /** 显示名称 */
  displayName?: string
  /** 版本号 */
  version: string
  /** 描述 */
  description?: string
  /** 作者 */
  author?: string
  /** 许可证 */
  license?: string
  /** 插件类型 (VCP 原生格式) */
  type?: 'static' | 'messagePreprocessor' | 'service' | 'hybridservice' | 'synchronous' | 'asynchronous'
  /** 插件类型 (VCPToolBox 格式) */
  pluginType?: 'static' | 'messagePreprocessor' | 'service' | 'hybridservice' | 'synchronous' | 'asynchronous'
  /** 入口命令 (stdio 类型) */
  command?: string
  /** 入口点 (VCPToolBox 格式) */
  entryPoint?: {
    type?: string
    command?: string
  }
  /** 命令参数 */
  args?: string[]
  /** 执行超时 (毫秒) */
  timeout?: number
  /** 工具定义 */
  tools?: ExternalPluginTool[]
  /** 依赖声明 */
  dependencies?: {
    model?: 'required' | 'optional'
    api?: string[]
  }
  /** 权限声明 (VCP 原生格式) */
  permissions?: {
    fileSystem?: ('read' | 'write')[]
    network?: string[]
    shell?: boolean
  } | string[]
  /** 默认配置 */
  defaultConfig?: Record<string, unknown>
  /** 配置 Schema (VCPToolBox 格式) */
  configSchema?: Record<string, ConfigFieldSchema>
  /** 图标 (base64 或相对路径) */
  icon?: string
  /** 主页 URL */
  homepage?: string
  /** 仓库 URL */
  repository?: string
}

/**
 * 插件工具定义
 */
export interface ExternalPluginTool {
  name: string
  description?: string
  parameters?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]
      default?: unknown
    }>
    required?: string[]
  }
}

/**
 * 插件执行协议 (stdin JSON)
 */
export interface PluginExecutionInput {
  tool: string
  params: Record<string, unknown>
  context: {
    requestId: string
    userId?: string
    sessionId?: string
  }
}

/**
 * 插件执行结果 (stdout JSON)
 */
export interface PluginExecutionOutput {
  success: boolean
  result?: unknown
  error?: string
  metadata?: Record<string, unknown>
  /** 异步模式 */
  async?: boolean
  taskId?: string
  callbackUrl?: string
}

/**
 * 已安装插件信息
 */
export interface InstalledPlugin {
  manifest: ExternalPluginManifest
  path: string
  enabled: boolean
  installedAt: string
  lastUpdatedAt?: string
  configOverrides?: Record<string, unknown>
}

/**
 * 插件配置文件格式
 */
export interface PluginsConfig {
  version: string
  plugins: Record<string, {
    enabled: boolean
    configOverrides?: Record<string, unknown>
    installedAt: string
    lastUpdatedAt?: string
  }>
}

// ==================== 常量 ====================

const VCP_ROOT_DIR = 'vcp'
const PLUGINS_DIR = 'plugins'
const ASSETS_DIR = 'assets'
const CONFIG_DIR = 'config'
const PLUGINS_CONFIG_FILE = 'plugins.json'
const MANIFEST_FILE = 'manifest.json'

// ==================== ExternalPluginManager 类 ====================

/**
 * 外部插件管理器
 */
export class ExternalPluginManager {
  private basePath: string
  private pluginsPath: string
  private assetsPath: string
  private configPath: string
  private pluginsConfigPath: string
  private initialized: boolean = false
  private installedPlugins: Map<string, InstalledPlugin> = new Map()

  constructor() {
    this.basePath = path.join(app.getPath('userData'), VCP_ROOT_DIR)
    this.pluginsPath = path.join(this.basePath, PLUGINS_DIR)
    this.assetsPath = path.join(this.basePath, ASSETS_DIR)
    this.configPath = path.join(this.basePath, CONFIG_DIR)
    this.pluginsConfigPath = path.join(this.configPath, PLUGINS_CONFIG_FILE)
  }

  /**
   * 初始化目录结构
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('Initializing external plugin directory structure', {
      basePath: this.basePath
    })

    try {
      // 创建目录结构
      await this.ensureDirectoryExists(this.basePath)
      await this.ensureDirectoryExists(this.pluginsPath)
      await this.ensureDirectoryExists(this.assetsPath)
      await this.ensureDirectoryExists(this.configPath)

      // 加载或创建配置文件
      await this.loadOrCreateConfig()

      // 扫描已安装插件
      await this.scanInstalledPlugins()

      this.initialized = true
      logger.info('External plugin manager initialized', {
        pluginCount: this.installedPlugins.size,
        paths: {
          plugins: this.pluginsPath,
          assets: this.assetsPath,
          config: this.configPath
        }
      })
    } catch (error) {
      logger.error('Failed to initialize external plugin manager', { error })
      throw error
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      logger.debug('Created directory', { path: dirPath })
    }
  }

  /**
   * 加载或创建配置文件
   */
  private async loadOrCreateConfig(): Promise<void> {
    if (fs.existsSync(this.pluginsConfigPath)) {
      try {
        const content = fs.readFileSync(this.pluginsConfigPath, 'utf-8')
        const config = JSON.parse(content) as PluginsConfig
        logger.debug('Loaded plugins config', { pluginCount: Object.keys(config.plugins).length })
      } catch (error) {
        logger.warn('Failed to parse plugins config, recreating', { error })
        await this.createDefaultConfig()
      }
    } else {
      await this.createDefaultConfig()
    }
  }

  /**
   * 创建默认配置文件
   */
  private async createDefaultConfig(): Promise<void> {
    const defaultConfig: PluginsConfig = {
      version: '1.0.0',
      plugins: {}
    }

    fs.writeFileSync(this.pluginsConfigPath, JSON.stringify(defaultConfig, null, 2))
    logger.info('Created default plugins config')
  }

  /**
   * 扫描已安装插件
   */
  async scanInstalledPlugins(): Promise<InstalledPlugin[]> {
    this.installedPlugins.clear()

    if (!fs.existsSync(this.pluginsPath)) {
      return []
    }

    const entries = fs.readdirSync(this.pluginsPath, { withFileTypes: true })
    const config = this.loadConfig()

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginPath = path.join(this.pluginsPath, entry.name)
      const manifestPath = path.join(pluginPath, MANIFEST_FILE)

      // 也支持 plugin-manifest.json (VCP 兼容)
      const legacyManifestPath = path.join(pluginPath, 'plugin-manifest.json')

      const actualManifestPath = fs.existsSync(manifestPath) ? manifestPath :
        fs.existsSync(legacyManifestPath) ? legacyManifestPath : null

      if (!actualManifestPath) {
        logger.debug('No manifest found, skipping', { dir: pluginPath })
        continue
      }

      try {
        const manifestContent = fs.readFileSync(actualManifestPath, 'utf-8')
        const manifest = JSON.parse(manifestContent) as ExternalPluginManifest

        // 兼容 VCPToolBox 格式：将 pluginType 规范化为 type
        if (!manifest.type && manifest.pluginType) {
          manifest.type = manifest.pluginType
        }

        const pluginConfig = config.plugins[manifest.name]
        const installedPlugin: InstalledPlugin = {
          manifest,
          path: pluginPath,
          enabled: pluginConfig?.enabled ?? true,
          installedAt: pluginConfig?.installedAt ?? new Date().toISOString(),
          lastUpdatedAt: pluginConfig?.lastUpdatedAt,
          configOverrides: pluginConfig?.configOverrides
        }

        this.installedPlugins.set(manifest.name, installedPlugin)
        logger.debug('Found external plugin', {
          name: manifest.name,
          type: manifest.type,
          enabled: installedPlugin.enabled
        })
      } catch (error) {
        logger.warn('Failed to load plugin manifest', {
          path: pluginPath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return Array.from(this.installedPlugins.values())
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): PluginsConfig {
    if (!fs.existsSync(this.pluginsConfigPath)) {
      return { version: '1.0.0', plugins: {} }
    }

    try {
      const content = fs.readFileSync(this.pluginsConfigPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return { version: '1.0.0', plugins: {} }
    }
  }

  /**
   * 保存配置文件
   */
  private saveConfig(config: PluginsConfig): void {
    fs.writeFileSync(this.pluginsConfigPath, JSON.stringify(config, null, 2))
  }

  /**
   * 获取所有已安装插件
   */
  getInstalledPlugins(): InstalledPlugin[] {
    return Array.from(this.installedPlugins.values())
  }

  /**
   * 获取已启用的插件
   */
  getEnabledPlugins(): InstalledPlugin[] {
    return this.getInstalledPlugins().filter(p => p.enabled)
  }

  /**
   * 获取单个插件
   */
  getPlugin(name: string): InstalledPlugin | null {
    return this.installedPlugins.get(name) || null
  }

  /**
   * 检查插件是否已安装
   */
  isInstalled(name: string): boolean {
    return this.installedPlugins.has(name)
  }

  /**
   * 启用/禁用插件
   */
  setPluginEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.installedPlugins.get(name)
    if (!plugin) return false

    plugin.enabled = enabled

    // 更新配置文件
    const config = this.loadConfig()
    if (!config.plugins[name]) {
      config.plugins[name] = {
        enabled,
        installedAt: plugin.installedAt
      }
    } else {
      config.plugins[name].enabled = enabled
    }
    this.saveConfig(config)

    logger.info('Plugin enabled state changed', { name, enabled })
    return true
  }

  /**
   * 更新插件配置
   */
  updatePluginConfig(name: string, configOverrides: Record<string, unknown>): boolean {
    const plugin = this.installedPlugins.get(name)
    if (!plugin) return false

    plugin.configOverrides = { ...plugin.configOverrides, ...configOverrides }

    // 更新配置文件
    const config = this.loadConfig()
    if (!config.plugins[name]) {
      config.plugins[name] = {
        enabled: plugin.enabled,
        installedAt: plugin.installedAt,
        configOverrides
      }
    } else {
      config.plugins[name].configOverrides = plugin.configOverrides
    }
    this.saveConfig(config)

    logger.info('Plugin config updated', { name, configKeys: Object.keys(configOverrides) })
    return true
  }

  /**
   * 获取插件合并配置 (默认 + 覆盖)
   */
  getPluginMergedConfig(name: string): Record<string, unknown> {
    const plugin = this.installedPlugins.get(name)
    if (!plugin) return {}

    return {
      ...plugin.manifest.defaultConfig,
      ...plugin.configOverrides
    }
  }

  /**
   * 扫描源目录，检测是否包含多个插件
   * 返回找到的插件目录列表
   */
  scanSourceDirectory(sourcePath: string): {
    isSinglePlugin: boolean
    pluginPaths: Array<{ path: string; name: string; manifestPath: string }>
  } {
    // 首先检查当前目录是否是单个插件
    const manifestPath = path.join(sourcePath, MANIFEST_FILE)
    const legacyManifestPath = path.join(sourcePath, 'plugin-manifest.json')

    if (fs.existsSync(manifestPath) || fs.existsSync(legacyManifestPath)) {
      const actualPath = fs.existsSync(manifestPath) ? manifestPath : legacyManifestPath
      try {
        const content = fs.readFileSync(actualPath, 'utf-8')
        const manifest = JSON.parse(content)
        return {
          isSinglePlugin: true,
          pluginPaths: [{
            path: sourcePath,
            name: manifest.name || path.basename(sourcePath),
            manifestPath: actualPath
          }]
        }
      } catch {
        // 继续检查子目录
      }
    }

    // 检查子目录是否包含多个插件
    const pluginPaths: Array<{ path: string; name: string; manifestPath: string }> = []

    if (!fs.existsSync(sourcePath)) {
      return { isSinglePlugin: false, pluginPaths: [] }
    }

    const entries = fs.readdirSync(sourcePath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const subPath = path.join(sourcePath, entry.name)
      const subManifest = path.join(subPath, MANIFEST_FILE)
      const subLegacyManifest = path.join(subPath, 'plugin-manifest.json')

      const actualManifestPath = fs.existsSync(subManifest) ? subManifest :
        fs.existsSync(subLegacyManifest) ? subLegacyManifest : null

      if (actualManifestPath) {
        try {
          const content = fs.readFileSync(actualManifestPath, 'utf-8')
          const manifest = JSON.parse(content)
          pluginPaths.push({
            path: subPath,
            name: manifest.name || entry.name,
            manifestPath: actualManifestPath
          })
        } catch (error) {
          logger.debug('Failed to parse manifest in subdirectory', {
            dir: subPath,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    return {
      isSinglePlugin: false,
      pluginPaths
    }
  }

  /**
   * 批量安装插件
   */
  async installPluginsBatch(sourcePaths: string[]): Promise<{
    success: boolean
    installed: InstalledPlugin[]
    failed: Array<{ path: string; error: string }>
    skipped: Array<{ path: string; reason: string }>
  }> {
    const installed: InstalledPlugin[] = []
    const failed: Array<{ path: string; error: string }> = []
    const skipped: Array<{ path: string; reason: string }> = []

    for (const sourcePath of sourcePaths) {
      const result = await this.installPluginSingle(sourcePath)

      if (result.success && result.plugin) {
        installed.push(result.plugin)
      } else if (result.alreadyInstalled) {
        skipped.push({ path: sourcePath, reason: result.error || 'Already installed' })
      } else {
        failed.push({ path: sourcePath, error: result.error || 'Unknown error' })
      }
    }

    logger.info('Batch install completed', {
      installed: installed.length,
      failed: failed.length,
      skipped: skipped.length
    })

    return {
      success: failed.length === 0,
      installed,
      failed,
      skipped
    }
  }

  /**
   * 安装单个插件 (内部方法)
   */
  private async installPluginSingle(sourcePath: string): Promise<{
    success: boolean
    plugin?: InstalledPlugin
    error?: string
    alreadyInstalled?: boolean
  }> {
    try {
      // 查找 manifest
      const manifestPath = path.join(sourcePath, MANIFEST_FILE)
      const legacyManifestPath = path.join(sourcePath, 'plugin-manifest.json')

      const actualManifestPath = fs.existsSync(manifestPath) ? manifestPath :
        fs.existsSync(legacyManifestPath) ? legacyManifestPath : null

      if (!actualManifestPath) {
        return { success: false, error: 'No manifest.json or plugin-manifest.json found' }
      }

      const manifestContent = fs.readFileSync(actualManifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent) as ExternalPluginManifest

      if (!manifest.name) {
        return { success: false, error: 'Plugin name is required in manifest' }
      }

      // 检查是否已安装
      if (this.installedPlugins.has(manifest.name)) {
        return { success: false, error: `Plugin ${manifest.name} is already installed`, alreadyInstalled: true }
      }

      // 复制到插件目录
      const targetPath = path.join(this.pluginsPath, manifest.name)
      await this.copyDirectory(sourcePath, targetPath)

      // 更新配置
      const config = this.loadConfig()
      config.plugins[manifest.name] = {
        enabled: true,
        installedAt: new Date().toISOString()
      }
      this.saveConfig(config)

      // 添加到内存
      const installedPlugin: InstalledPlugin = {
        manifest,
        path: targetPath,
        enabled: true,
        installedAt: config.plugins[manifest.name].installedAt
      }
      this.installedPlugins.set(manifest.name, installedPlugin)

      logger.info('Plugin installed', {
        name: manifest.name,
        type: manifest.type,
        path: targetPath
      })

      return { success: true, plugin: installedPlugin }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to install plugin', { sourcePath, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 安装插件 (从目录路径)
   * 支持单个插件目录或包含多个插件的父目录
   */
  async installPlugin(sourcePath: string): Promise<{
    success: boolean
    plugin?: InstalledPlugin
    plugins?: InstalledPlugin[]
    error?: string
    isMultiple?: boolean
    availablePlugins?: Array<{ path: string; name: string }>
  }> {
    try {
      // 扫描源目录
      const scanResult = this.scanSourceDirectory(sourcePath)

      // 单个插件直接安装
      if (scanResult.isSinglePlugin && scanResult.pluginPaths.length === 1) {
        const result = await this.installPluginSingle(sourcePath)
        return result
      }

      // 没有找到任何插件
      if (scanResult.pluginPaths.length === 0) {
        return {
          success: false,
          error: '未找到有效的插件。请选择包含 manifest.json 或 plugin-manifest.json 的插件目录。'
        }
      }

      // 发现多个插件，返回可用列表让用户选择
      return {
        success: false,
        isMultiple: true,
        availablePlugins: scanResult.pluginPaths.map(p => ({
          path: p.path,
          name: p.name
        })),
        error: `发现 ${scanResult.pluginPaths.length} 个插件。请选择具体的插件目录进行安装，或使用批量安装功能。`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to install plugin', { sourcePath, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(name: string): Promise<{
    success: boolean
    error?: string
  }> {
    const plugin = this.installedPlugins.get(name)
    if (!plugin) {
      return { success: false, error: `Plugin ${name} is not installed` }
    }

    try {
      // 删除目录
      if (fs.existsSync(plugin.path)) {
        fs.rmSync(plugin.path, { recursive: true })
      }

      // 更新配置
      const config = this.loadConfig()
      delete config.plugins[name]
      this.saveConfig(config)

      // 从内存移除
      this.installedPlugins.delete(name)

      logger.info('Plugin uninstalled', { name })
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to uninstall plugin', { name, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  /**
   * 验证插件 manifest
   */
  validateManifest(manifest: Partial<ExternalPluginManifest>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!manifest.name) {
      errors.push('Missing required field: name')
    }

    if (!manifest.version) {
      errors.push('Missing required field: version')
    }

    if (!manifest.type) {
      errors.push('Missing required field: type')
    } else {
      const validTypes = ['static', 'messagePreprocessor', 'service', 'hybridservice', 'synchronous', 'asynchronous']
      if (!validTypes.includes(manifest.type)) {
        errors.push(`Invalid type: ${manifest.type}. Must be one of: ${validTypes.join(', ')}`)
      }
    }

    // stdio 类型需要 command
    if (['synchronous', 'asynchronous'].includes(manifest.type || '')) {
      if (!manifest.command) {
        errors.push(`Plugin type ${manifest.type} requires command field`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取目录路径
   */
  getPaths(): {
    base: string
    plugins: string
    assets: string
    config: string
  } {
    return {
      base: this.basePath,
      plugins: this.pluginsPath,
      assets: this.assetsPath,
      config: this.configPath
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number
    enabled: number
    disabled: number
    byType: Record<string, number>
  } {
    const plugins = this.getInstalledPlugins()
    const byType: Record<string, number> = {}

    for (const plugin of plugins) {
      const type = plugin.manifest.type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    }

    return {
      total: plugins.length,
      enabled: plugins.filter(p => p.enabled).length,
      disabled: plugins.filter(p => !p.enabled).length,
      byType
    }
  }
}

// ==================== 单例 ====================

let externalPluginManager: ExternalPluginManager | null = null

/**
 * 获取 ExternalPluginManager 单例
 */
export function getExternalPluginManager(): ExternalPluginManager {
  if (!externalPluginManager) {
    externalPluginManager = new ExternalPluginManager()
  }
  return externalPluginManager
}

/**
 * 初始化 ExternalPluginManager
 */
export async function initializeExternalPluginManager(): Promise<ExternalPluginManager> {
  const manager = getExternalPluginManager()
  await manager.initialize()
  return manager
}
