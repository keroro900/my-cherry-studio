/**
 * VCP 插件初始化器
 *
 * 原生 VCP 插件初始化，完全不依赖 external/VCPToolBox
 *
 * 负责在应用启动时：
 * - 确保插件目录结构存在
 * - 在生产环境下从 resources 同步打包的插件到用户目录
 * - 支持增量更新（仅当源文件较新时才复制）
 *
 * 插件目录结构：
 * - userData/vcp/plugins/builtin/  - 内置插件
 * - userData/vcp/plugins/user/     - 用户安装的插件
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('VCP:PluginInitializer')

/**
 * P0 核心插件（用于优先级排序，仅用于日志和统计）
 */
const P0_PLUGINS = [
  'DailyNote', // 日记创建/更新
  'DailyNoteGet', // 日记检索
  'LightMemo', // RAG 搜索
  'GoogleSearch', // 网页搜索
  'TavilySearch', // AI 搜索
  'GeminiImageGen', // 图片生成/编辑
  'QwenImageGen', // 通义万相
  'FileOperator', // 文件操作
  'UrlFetch', // URL 内容获取
  'WeatherInfoNow' // 天气查询
]

/**
 * P1 高频插件（用于优先级排序，仅用于日志和统计）
 */
const P1_PLUGINS = [
  'DailyNoteManager', // 日记管理界面
  'FileListGenerator', // 文件列表
  'FileTreeGenerator', // 目录树
  'CodeSearcher', // 代码搜索
  'ProjectAnalyst', // 项目分析
  'ComfyUIGen', // ComfyUI 集成
  'FluxGen', // Flux 图片生成
  'NovelAIGen', // NovelAI 生成
  'DoubaoGen', // 豆包生成
  'VideoGenerator', // 视频生成
  'SunoGen', // Suno 音乐
  'ImageServer', // 图片服务
  'SerpSearch', // SERP 搜索
  'DailyNotePanel' // 日记面板
]

/**
 * 获取内置插件目录
 */
export function getBuiltinPluginsDir(): string {
  return path.join(app.getPath('userData'), 'vcp', 'plugins', 'builtin')
}

/**
 * 获取用户插件目录
 */
export function getUserPluginsDir(): string {
  return path.join(app.getPath('userData'), 'vcp', 'plugins', 'user')
}

/**
 * 获取打包资源中的插件目录 (仅生产环境)
 */
function getBundledPluginsDir(): string {
  if (!app.isPackaged) {
    return ''
  }
  return path.join(process.resourcesPath, 'vcp-plugins')
}

/**
 * 复制目录（递归）
 */
async function copyDir(src: string, dest: string): Promise<void> {
  // 确保目标目录存在
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * 检查源是否比目标新
 */
function isNewer(srcPath: string, destPath: string): boolean {
  if (!fs.existsSync(destPath)) {
    return true
  }

  const srcStat = fs.statSync(srcPath)
  const destStat = fs.statSync(destPath)

  return srcStat.mtimeMs > destStat.mtimeMs
}

/**
 * 复制插件（如果源文件较新）
 */
async function copyPluginIfNewer(srcDir: string, destDir: string): Promise<boolean> {
  const srcManifest = path.join(srcDir, 'plugin-manifest.json')

  // 检查源插件是否存在
  if (!fs.existsSync(srcManifest)) {
    logger.debug('Plugin manifest not found', { srcDir })
    return false
  }

  const destManifest = path.join(destDir, 'plugin-manifest.json')

  // 检查是否需要更新
  if (!isNewer(srcManifest, destManifest)) {
    logger.debug('Plugin is up to date', { plugin: path.basename(srcDir) })
    return false
  }

  // 复制插件目录
  await copyDir(srcDir, destDir)
  logger.info('Plugin copied', { plugin: path.basename(srcDir) })
  return true
}

/**
 * 插件扫描结果
 */
export interface PluginScanResult {
  active: string[] // 活跃插件 (plugin-manifest.json)
  blocked: string[] // 禁用插件 (plugin-manifest.json.block)
}

/**
 * 扫描插件目录获取所有插件
 * 检测禁用插件 (.block 后缀)
 */
function scanPluginsDir(pluginDir: string): PluginScanResult {
  const result: PluginScanResult = {
    active: [],
    blocked: []
  }

  if (!fs.existsSync(pluginDir)) {
    return result
  }

  try {
    const entries = fs.readdirSync(pluginDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      // 检查是否有 plugin-manifest.json (活跃)
      const manifestPath = path.join(pluginDir, entry.name, 'plugin-manifest.json')
      const blockedManifestPath = path.join(pluginDir, entry.name, 'plugin-manifest.json.block')

      if (fs.existsSync(manifestPath)) {
        result.active.push(entry.name)
      } else if (fs.existsSync(blockedManifestPath)) {
        result.blocked.push(entry.name)
      }
    }

    logger.debug('Scanned plugins directory', {
      dir: pluginDir,
      activeCount: result.active.length,
      blockedCount: result.blocked.length
    })
  } catch (error) {
    logger.error('Failed to scan plugins directory', {
      dir: pluginDir,
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return result
}

/**
 * 确保插件目录结构存在
 */
export function ensurePluginDirectories(): void {
  const dirs = [getBuiltinPluginsDir(), getUserPluginsDir()]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.info('Created plugin directory', { dir })
    }
  }
}

/**
 * 初始化内置插件
 *
 * 开发模式：仅确保目录存在，插件直接从 userData 加载
 * 生产模式：从 resources/vcp-plugins 同步到 userData
 */
export async function initializeBuiltinPlugins(): Promise<{
  copied: string[]
  skipped: string[]
  failed: string[]
}> {
  const result = {
    copied: [] as string[],
    skipped: [] as string[],
    failed: [] as string[]
  }

  // 确保目录结构存在
  ensurePluginDirectories()

  // 开发模式：不需要同步，直接使用 userData 中的插件
  if (!app.isPackaged) {
    logger.info('Development mode: using plugins from userData directly')
    const builtinDir = getBuiltinPluginsDir()
    const scanResult = scanPluginsDir(builtinDir)
    result.skipped = scanResult.active
    return result
  }

  // 生产模式：从 resources 同步打包的插件
  const bundledDir = getBundledPluginsDir()
  if (!bundledDir || !fs.existsSync(bundledDir)) {
    logger.info('No bundled plugins found in resources')
    return result
  }

  const builtinDir = getBuiltinPluginsDir()
  const scanResult = scanPluginsDir(bundledDir)

  logger.info('Initializing bundled plugins', {
    source: bundledDir,
    target: builtinDir,
    activeCount: scanResult.active.length
  })

  // 复制活跃插件
  for (const pluginName of scanResult.active) {
    const srcDir = path.join(bundledDir, pluginName)
    const destDir = path.join(builtinDir, pluginName)

    try {
      const copied = await copyPluginIfNewer(srcDir, destDir)
      if (copied) {
        result.copied.push(pluginName)
      } else {
        result.skipped.push(pluginName)
      }
    } catch (error) {
      logger.error('Failed to copy plugin', {
        plugin: pluginName,
        error: error instanceof Error ? error.message : String(error)
      })
      result.failed.push(pluginName)
    }
  }

  logger.info('Plugin initialization completed', {
    copied: result.copied.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    p0Plugins: result.copied.filter((p) => P0_PLUGINS.includes(p)),
    p1Plugins: result.copied.filter((p) => P1_PLUGINS.includes(p))
  })

  return result
}

/**
 * 获取插件优先级
 */
export function getPluginPriority(pluginName: string): number {
  if (P0_PLUGINS.includes(pluginName)) return 0
  if (P1_PLUGINS.includes(pluginName)) return 1
  return 2
}

/**
 * 获取已安装的所有插件
 */
export function getInstalledPlugins(): {
  builtin: string[]
  user: string[]
  total: number
} {
  const builtinResult = scanPluginsDir(getBuiltinPluginsDir())
  const userResult = scanPluginsDir(getUserPluginsDir())

  return {
    builtin: builtinResult.active,
    user: userResult.active,
    total: builtinResult.active.length + userResult.active.length
  }
}

/**
 * 获取插件统计信息（包括活跃和禁用插件）
 */
export function getPluginStats(): {
  active: number
  blocked: number
  total: number
  blockedNames: string[]
} {
  const builtinResult = scanPluginsDir(getBuiltinPluginsDir())
  const userResult = scanPluginsDir(getUserPluginsDir())

  const active = builtinResult.active.length + userResult.active.length
  const blocked = builtinResult.blocked.length + userResult.blocked.length
  const blockedNames = [...builtinResult.blocked, ...userResult.blocked]

  return {
    active,
    blocked,
    total: active + blocked,
    blockedNames
  }
}
