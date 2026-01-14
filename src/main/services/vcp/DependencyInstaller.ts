/**
 * VCP Plugin Dependency Installer
 *
 * 自动检测并安装外部插件的 npm 依赖
 * - 检查 package.json 中的 dependencies
 * - 检测 require() 语句中的外部模块
 * - 自动运行 npm install
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('VCP:DependencyInstaller')

// Node.js 内置模块列表
const BUILTIN_MODULES = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib'
])

/**
 * 依赖安装结果
 */
export interface DependencyInstallResult {
  success: boolean
  installed: string[]
  skipped: string[]
  errors: string[]
  duration: number
}

/**
 * 检测插件所需的外部依赖
 */
export function detectPluginDependencies(pluginDir: string): string[] {
  const dependencies: Set<string> = new Set()

  // 1. 从 package.json 读取
  const packageJsonPath = path.join(pluginDir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach((dep) => dependencies.add(dep))
      }
    } catch (error) {
      logger.warn('Failed to parse package.json', { pluginDir, error: String(error) })
    }
  }

  // 2. 扫描 JS 文件中的 require/import 语句
  const jsFiles = findJsFiles(pluginDir)
  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8')
      const detected = extractRequiredModules(content)
      detected.forEach((dep) => dependencies.add(dep))
    } catch {
      // 忽略读取错误
    }
  }

  // 过滤掉内置模块和相对路径
  return Array.from(dependencies).filter(
    (dep) => !BUILTIN_MODULES.has(dep) && !BUILTIN_MODULES.has(dep.split('/')[0]) && !dep.startsWith('.')
  )
}

/**
 * 查找目录中的所有 JS 文件
 */
function findJsFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        findJsFiles(fullPath, files)
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        files.push(fullPath)
      }
    }
  } catch {
    // 忽略错误
  }
  return files
}

/**
 * 从代码中提取 require/import 的模块名
 */
function extractRequiredModules(content: string): string[] {
  const modules: Set<string> = new Set()

  // 匹配 require('module') 或 require("module")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match
  while ((match = requireRegex.exec(content)) !== null) {
    const moduleName = match[1]
    // 获取包名（处理 scoped packages 如 @scope/package）
    const pkgName = moduleName.startsWith('@') ? moduleName.split('/').slice(0, 2).join('/') : moduleName.split('/')[0]
    modules.add(pkgName)
  }

  // 匹配 import ... from 'module'
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
  while ((match = importRegex.exec(content)) !== null) {
    const moduleName = match[1]
    const pkgName = moduleName.startsWith('@') ? moduleName.split('/').slice(0, 2).join('/') : moduleName.split('/')[0]
    modules.add(pkgName)
  }

  // 匹配 import 'module' (side-effect imports)
  const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g
  while ((match = sideEffectImportRegex.exec(content)) !== null) {
    const moduleName = match[1]
    const pkgName = moduleName.startsWith('@') ? moduleName.split('/').slice(0, 2).join('/') : moduleName.split('/')[0]
    modules.add(pkgName)
  }

  return Array.from(modules)
}

/**
 * 检查依赖是否已安装
 */
export function checkDependenciesInstalled(pluginDir: string, dependencies: string[]): string[] {
  const missing: string[] = []
  const nodeModulesPath = path.join(pluginDir, 'node_modules')

  for (const dep of dependencies) {
    const depPath = path.join(nodeModulesPath, dep)
    if (!fs.existsSync(depPath)) {
      missing.push(dep)
    }
  }

  return missing
}

/**
 * 安装插件依赖
 */
export async function installPluginDependencies(
  pluginDir: string,
  dependencies?: string[]
): Promise<DependencyInstallResult> {
  const startTime = Date.now()
  const result: DependencyInstallResult = {
    success: true,
    installed: [],
    skipped: [],
    errors: [],
    duration: 0
  }

  // 检测依赖
  const allDeps = dependencies || detectPluginDependencies(pluginDir)
  if (allDeps.length === 0) {
    result.duration = Date.now() - startTime
    return result
  }

  // 检查哪些已安装
  const missing = checkDependenciesInstalled(pluginDir, allDeps)
  result.skipped = allDeps.filter((d) => !missing.includes(d))

  if (missing.length === 0) {
    logger.debug('All dependencies already installed', { pluginDir })
    result.duration = Date.now() - startTime
    return result
  }

  logger.info('Installing missing dependencies', { pluginDir, dependencies: missing })

  // 确保 package.json 存在
  const packageJsonPath = path.join(pluginDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    // 创建最小的 package.json
    const minimalPkg = {
      name: path
        .basename(pluginDir)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      private: true,
      dependencies: {}
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(minimalPkg, null, 2))
    logger.debug('Created minimal package.json', { pluginDir })
  }

  // 运行 npm install
  try {
    const npmCommand = `npm install ${missing.join(' ')} --save --legacy-peer-deps`
    logger.debug('Running npm install', { pluginDir, command: npmCommand })

    execSync(npmCommand, {
      cwd: pluginDir,
      stdio: 'pipe',
      timeout: 120000, // 2 分钟超时
      env: { ...process.env, npm_config_loglevel: 'error' }
    })

    result.installed = missing
    logger.info('Dependencies installed successfully', { pluginDir, installed: missing })
  } catch (error) {
    result.success = false
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMsg)
    logger.error('Failed to install dependencies', { pluginDir, error: errorMsg })
  }

  result.duration = Date.now() - startTime
  return result
}

/**
 * 批量安装所有插件的依赖
 */
export async function installAllPluginsDependencies(pluginsDir: string): Promise<Map<string, DependencyInstallResult>> {
  const results = new Map<string, DependencyInstallResult>()

  if (!fs.existsSync(pluginsDir)) {
    return results
  }

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const pluginDir = path.join(pluginsDir, entry.name)
    const manifestPath = path.join(pluginDir, 'plugin-manifest.json')

    // 只处理有 manifest 的目录
    if (!fs.existsSync(manifestPath)) continue

    try {
      const result = await installPluginDependencies(pluginDir)
      results.set(entry.name, result)
    } catch (error) {
      results.set(entry.name, {
        success: false,
        installed: [],
        skipped: [],
        errors: [error instanceof Error ? error.message : String(error)],
        duration: 0
      })
    }
  }

  return results
}
