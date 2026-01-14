/**
 * VCP Plugin Sync Service
 *
 * 原生 VCP 插件管理服务
 * 完全不依赖 external/VCPToolBox，所有插件存储在用户数据目录
 *
 * 插件目录结构：
 * - userData/vcp/plugins/builtin/  - 内置插件（生产环境从 resources 同步）
 * - userData/vcp/plugins/user/     - 用户安装的插件
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { getConfigKeyDescription } from './configDescriptions'
import type { VCPPluginManifest } from './types'

const logger = loggerService.withContext('VCP:PluginSync')

/**
 * 插件同步结果
 */
export interface PluginSyncResult {
  success: boolean
  syncedCount: number
  skippedCount: number
  errorCount: number
  plugins: string[]
  errors: string[]
}

/**
 * 获取插件目录列表 (原生实现，不依赖 VCPToolBox)
 * 按优先级返回可用的插件目录
 */
export function getNativePluginDirs(): string[] {
  const dirs: string[] = []

  // 1. 用户数据目录下的内置插件
  const userDataBuiltin = path.join(app.getPath('userData'), 'vcp', 'plugins', 'builtin')
  if (fs.existsSync(userDataBuiltin)) {
    dirs.push(userDataBuiltin)
    logger.debug('Found userData builtin plugins', { path: userDataBuiltin })
  }

  // 2. 用户安装的插件
  const userPlugins = path.join(app.getPath('userData'), 'vcp', 'plugins', 'user')
  if (fs.existsSync(userPlugins)) {
    dirs.push(userPlugins)
    logger.debug('Found user plugins', { path: userPlugins })
  }

  // 3. 生产环境：打包的资源目录
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath
    const bundledPath = path.join(resourcesPath, 'vcp-plugins')
    if (fs.existsSync(bundledPath)) {
      dirs.push(bundledPath)
      logger.debug('Found bundled plugins', { path: bundledPath })
    }
  }

  return dirs
}

/**
 * @deprecated 使用 getNativePluginDirs() 替代
 * 保留此函数用于向后兼容，但返回原生路径
 */
export function getVCPToolBoxPluginDirs(): string[] {
  logger.warn('getVCPToolBoxPluginDirs is deprecated, use getNativePluginDirs instead')
  return getNativePluginDirs()
}

/**
 * 获取目标同步目录
 */
export function getPluginTargetDir(): string {
  return path.join(app.getPath('userData'), 'vcp', 'plugins', 'builtin')
}

/**
 * 获取用户插件目录
 */
export function getUserPluginDir(): string {
  return path.join(app.getPath('userData'), 'vcp', 'plugins', 'user')
}

/**
 * 确保插件目录结构存在
 */
export function ensurePluginDirs(): void {
  const dirs = [getPluginTargetDir(), getUserPluginDir()]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.info('Created plugin directory', { dir })
    }
  }
}

/**
 * 同步单个插件
 */
function syncPlugin(sourceDir: string, targetDir: string): { success: boolean; error?: string } {
  const pluginName = path.basename(sourceDir)
  const manifestPath = path.join(sourceDir, 'plugin-manifest.json')

  // 检查是否有 manifest
  if (!fs.existsSync(manifestPath)) {
    return { success: false, error: `No manifest found in ${pluginName}` }
  }

  try {
    // 创建目标目录
    const targetPluginDir = path.join(targetDir, pluginName)
    if (!fs.existsSync(targetPluginDir)) {
      fs.mkdirSync(targetPluginDir, { recursive: true })
    }

    // 复制 manifest
    fs.copyFileSync(manifestPath, path.join(targetPluginDir, 'plugin-manifest.json'))

    // 复制 README 如果存在
    for (const readme of ['README.md', 'readme.md']) {
      const readmePath = path.join(sourceDir, readme)
      if (fs.existsSync(readmePath)) {
        fs.copyFileSync(readmePath, path.join(targetPluginDir, readme))
        break
      }
    }

    // 复制执行脚本（如果是 synchronous/asynchronous 类型）
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    if (manifest.entryPoint?.command) {
      // 复制入口点相关文件
      const entryFiles = getEntryFiles(sourceDir, manifest)
      for (const file of entryFiles) {
        const sourcePath = path.join(sourceDir, file)
        const targetPath = path.join(targetPluginDir, file)
        if (fs.existsSync(sourcePath)) {
          // 确保目标目录存在
          const targetFileDir = path.dirname(targetPath)
          if (!fs.existsSync(targetFileDir)) {
            fs.mkdirSync(targetFileDir, { recursive: true })
          }
          fs.copyFileSync(sourcePath, targetPath)
        }
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Failed to sync ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 获取需要复制的入口文件列表
 */
function getEntryFiles(sourceDir: string, manifest: VCPPluginManifest): string[] {
  const files: string[] = []

  // 从 entryPoint 获取主入口文件
  if (manifest.entryPoint?.args) {
    files.push(...manifest.entryPoint.args)
  }

  // 常见的入口文件
  const commonFiles = ['index.js', 'main.js', 'main.py', 'index.py', 'service.js']
  for (const file of commonFiles) {
    if (fs.existsSync(path.join(sourceDir, file))) {
      files.push(file)
    }
  }

  // 查找以插件名命名的文件
  const pluginName = manifest.name
  for (const ext of ['.js', '.py', '.ts', '.mjs']) {
    const fileName = `${pluginName}${ext}`
    if (fs.existsSync(path.join(sourceDir, fileName))) {
      files.push(fileName)
    }
  }

  return Array.from(new Set(files)) // 去重
}

/**
 * 同步打包资源中的插件到用户目录 (仅生产环境)
 * @deprecated VCP 插件系统已原生化，此函数保留用于向后兼容
 */
export async function syncVCPToolBoxPlugins(forceSync: boolean = false): Promise<PluginSyncResult> {
  const result: PluginSyncResult = {
    success: true,
    syncedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    plugins: [],
    errors: []
  }

  // 确保目录结构存在
  ensurePluginDirs()

  // 仅在生产环境下从 resources 同步
  if (!app.isPackaged) {
    logger.info('Development mode: skipping plugin sync (plugins loaded from userData)')
    return result
  }

  const resourcesPath = process.resourcesPath
  const bundledPath = path.join(resourcesPath, 'vcp-plugins')
  const targetDir = getPluginTargetDir()

  logger.info('Starting bundled plugin sync', {
    bundledPath,
    targetDir,
    forceSync
  })

  if (!fs.existsSync(bundledPath)) {
    logger.info('No bundled plugins found')
    return result
  }

  try {
    const entries = fs.readdirSync(bundledPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginDir = path.join(bundledPath, entry.name)
      const targetPluginDir = path.join(targetDir, entry.name)

      // 如果不是强制同步，检查是否已存在
      if (!forceSync && fs.existsSync(path.join(targetPluginDir, 'plugin-manifest.json'))) {
        result.skippedCount++
        continue
      }

      const syncResult = syncPlugin(pluginDir, targetDir)
      if (syncResult.success) {
        result.syncedCount++
        result.plugins.push(entry.name)
      } else {
        result.errorCount++
        if (syncResult.error) {
          result.errors.push(syncResult.error)
        }
      }
    }
  } catch (error) {
    result.success = false
    result.errors.push(`Failed to read bundled directory: ${error instanceof Error ? error.message : String(error)}`)
    logger.error('Plugin sync failed', { error: String(error) })
  }

  logger.info('Plugin sync completed', {
    syncedCount: result.syncedCount,
    skippedCount: result.skippedCount,
    errorCount: result.errorCount
  })

  return result
}

/**
 * 获取已安装的插件列表
 */
export function getSyncedPlugins(): string[] {
  const plugins: string[] = []

  // 从 builtin 目录
  const builtinDir = getPluginTargetDir()
  if (fs.existsSync(builtinDir)) {
    try {
      const entries = fs.readdirSync(builtinDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const manifestPath = path.join(builtinDir, entry.name, 'plugin-manifest.json')
        if (fs.existsSync(manifestPath)) {
          plugins.push(entry.name)
        }
      }
    } catch (error) {
      logger.error('Failed to read builtin plugins', { error: String(error) })
    }
  }

  // 从 user 目录
  const userDir = getUserPluginDir()
  if (fs.existsSync(userDir)) {
    try {
      const entries = fs.readdirSync(userDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const manifestPath = path.join(userDir, entry.name, 'plugin-manifest.json')
        if (fs.existsSync(manifestPath)) {
          if (!plugins.includes(entry.name)) {
            plugins.push(entry.name)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to read user plugins', { error: String(error) })
    }
  }

  return plugins
}

/**
 * 检查是否需要同步 (仅生产环境)
 */
export function needsSync(): boolean {
  if (!app.isPackaged) return false

  const resourcesPath = process.resourcesPath
  const bundledPath = path.join(resourcesPath, 'vcp-plugins')
  if (!fs.existsSync(bundledPath)) return false

  const targetDir = getPluginTargetDir()
  if (!fs.existsSync(targetDir)) return true

  // 检查是否有新的打包插件
  try {
    const bundledPlugins = fs
      .readdirSync(bundledPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    const installedPlugins = getSyncedPlugins()

    for (const plugin of bundledPlugins) {
      if (!installedPlugins.includes(plugin)) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * 读取插件的 manifest
 */
export function readPluginManifest(pluginName: string): VCPPluginManifest | null {
  const dirs = getNativePluginDirs()

  for (const dir of dirs) {
    const manifestPath = path.join(dir, pluginName, 'plugin-manifest.json')
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8')
        return JSON.parse(content)
      } catch (error) {
        logger.error('Failed to read plugin manifest', { pluginName, error: String(error) })
      }
    }
  }

  return null
}

/**
 * 标准化 configSchema 格式
 * 支持两种格式：
 * 1. 简化格式: { "key": "string" }
 * 2. 完整格式: { "key": { "type": "string", "description": "..." } }
 */
export function normalizeConfigSchema(configSchema: Record<string, unknown> | undefined): {
  type: string
  properties: Record<string, { type: string; description?: string; default?: unknown }>
  required?: string[]
} | null {
  if (!configSchema) return null

  const properties: Record<string, { type: string; description?: string; default?: unknown }> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(configSchema)) {
    if (typeof value === 'string') {
      // 简化格式: "TavilyKey": "string"
      properties[key] = {
        type: value,
        description: getConfigKeyDescription(key)
      }
      required.push(key)
    } else if (typeof value === 'object' && value !== null) {
      // 完整格式: "key": { "type": "string", "description": "..." }
      const v = value as { type?: string; description?: string; default?: unknown; required?: boolean }
      properties[key] = {
        type: v.type || 'string',
        description: v.description || getConfigKeyDescription(key),
        default: v.default
      }
      if (v.required !== false) {
        required.push(key)
      }
    }
  }

  if (Object.keys(properties).length === 0) return null

  return {
    type: 'object',
    properties,
    required
  }
}
