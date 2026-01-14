/**
 * Native Module Preloader
 *
 * 用于在应用启动时预加载 Rust 原生模块
 * 确保 TagMemo 等服务使用 Rust 实现而非 TypeScript fallback
 *
 * 使用方法:
 * 1. 在 app ready 后调用 preloadNativeModules()
 * 2. 检查 getNativeModuleStatus() 确认模块状态
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import { existsSync } from 'fs'
import path from 'path'

const logger = loggerService.withContext('NativeModulePreloader')

// ==================== 类型定义 ====================

export interface NativeModuleStatus {
  /** 是否已加载 */
  loaded: boolean
  /** 加载时间 */
  loadTime: number
  /** 模块路径 */
  modulePath: string | null
  /** 可用功能 */
  features: {
    vexusIndex: boolean
    cooccurrenceMatrix: boolean
    semanticGroupMatcher: boolean
    chineseSearchEngine: boolean
    jiebaCut: boolean
  }
  /** 错误信息 (如果有) */
  error: string | null
  /** 模块版本 */
  version: string | null
}

// ==================== 模块状态 ====================

let moduleStatus: NativeModuleStatus = {
  loaded: false,
  loadTime: 0,
  modulePath: null,
  features: {
    vexusIndex: false,
    cooccurrenceMatrix: false,
    semanticGroupMatcher: false,
    chineseSearchEngine: false,
    jiebaCut: false
  },
  error: null,
  version: null
}

let nativeModule: any = null

// ==================== 路径解析 ====================

/**
 * 获取所有可能的原生模块路径
 * 按优先级排序
 */
function getAllNativeModulePaths(): string[] {
  const possiblePaths: string[] = []

  // 1. 项目根目录 (开发模式)
  possiblePaths.push(path.join(process.cwd(), 'native-vcp', 'index.js'))

  // 2. app 目录 (生产模式)
  try {
    possiblePaths.push(path.join(app.getAppPath(), 'native-vcp', 'index.js'))
  } catch {
    // app 可能未初始化
  }

  // 3. __dirname 相对路径 (编译后)
  possiblePaths.push(path.join(__dirname, '..', '..', '..', '..', 'native-vcp', 'index.js'))
  possiblePaths.push(path.join(__dirname, '..', '..', '..', 'native-vcp', 'index.js'))

  // 4. resources 目录 (打包后)
  try {
    possiblePaths.push(path.join(app.getAppPath(), '..', 'native-vcp', 'index.js'))
  } catch {
    // app 可能未初始化
  }

  // 5. 直接加载 .node 文件 (备选)
  const nodeFileName = `native-vcp.${process.platform}-${process.arch}-msvc.node`
  possiblePaths.push(path.join(process.cwd(), 'native-vcp', nodeFileName))

  return possiblePaths
}

// ==================== 预加载函数 ====================

/**
 * 预加载原生模块
 *
 * 应在 app ready 后调用，确保 Rust 模块在其他服务初始化前加载
 *
 * @returns Promise<NativeModuleStatus> 模块状态
 */
export async function preloadNativeModules(): Promise<NativeModuleStatus> {
  if (moduleStatus.loaded && nativeModule) {
    logger.debug('Native module already loaded, skipping preload')
    return moduleStatus
  }

  const startTime = Date.now()
  const paths = getAllNativeModulePaths()

  logger.info('Starting native module preload', {
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    searchPaths: paths.length
  })

  for (const modulePath of paths) {
    if (!existsSync(modulePath)) {
      continue
    }

    try {
      logger.debug('Attempting to load native module', { path: modulePath })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(modulePath)

      // 验证模块是否有效
      if (!module) {
        throw new Error('Module loaded but returned undefined')
      }

      nativeModule = module

      // 获取版本信息
      let version = null
      try {
        if (typeof module.getVersion === 'function') {
          version = module.getVersion()
        }
      } catch {
        // 版本获取失败不影响主流程
      }

      // 更新状态
      moduleStatus = {
        loaded: true,
        loadTime: Date.now() - startTime,
        modulePath,
        features: {
          vexusIndex: !!module.VexusIndex,
          cooccurrenceMatrix: !!module.CooccurrenceMatrix,
          semanticGroupMatcher: !!module.SemanticGroupMatcher,
          chineseSearchEngine: !!module.ChineseSearchEngine,
          jiebaCut: typeof module.jiebaCut === 'function'
        },
        error: null,
        version
      }

      logger.info('✅ Native module loaded successfully', {
        path: modulePath,
        loadTime: moduleStatus.loadTime,
        version,
        features: moduleStatus.features
      })

      // 可选: 初始化模块
      if (typeof module.initialize === 'function') {
        try {
          const dataDir = path.join(app.getPath('userData'), 'Data', 'native-vcp')
          module.initialize({ dataDir, logLevel: 'info' })
          logger.debug('Native module initialized', { dataDir })
        } catch (initError) {
          logger.warn('Native module initialization failed (non-critical)', {
            error: (initError as Error).message
          })
        }
      }

      return moduleStatus
    } catch (loadError) {
      logger.debug('Failed to load from path', {
        path: modulePath,
        error: (loadError as Error).message
      })
    }
  }

  // 所有路径都失败
  moduleStatus = {
    loaded: false,
    loadTime: Date.now() - startTime,
    modulePath: null,
    features: {
      vexusIndex: false,
      cooccurrenceMatrix: false,
      semanticGroupMatcher: false,
      chineseSearchEngine: false,
      jiebaCut: false
    },
    error: `Native module not found. Searched paths:\n${paths.join('\n')}`,
    version: null
  }

  logger.error('❌ Native module preload FAILED', {
    searchedPaths: paths,
    error: moduleStatus.error
  })

  return moduleStatus
}

// ==================== 获取模块 ====================

/**
 * 获取已加载的原生模块
 *
 * @returns 原生模块实例，如果未加载则返回 null
 */
export function getNativeModule(): any {
  return nativeModule
}

/**
 * 获取原生模块状态
 */
export function getNativeModuleStatus(): NativeModuleStatus {
  return { ...moduleStatus }
}

/**
 * 检查原生模块是否已加载
 */
export function isNativeModuleLoaded(): boolean {
  return moduleStatus.loaded && nativeModule !== null
}

/**
 * 检查特定功能是否可用
 */
export function isFeatureAvailable(
  feature: keyof NativeModuleStatus['features']
): boolean {
  return moduleStatus.loaded && moduleStatus.features[feature]
}

// ==================== 创建原生实例 ====================

/**
 * 创建原生 CooccurrenceMatrix 实例
 * 优先使用预加载的模块
 */
export function createNativeCooccurrenceMatrix(): any {
  if (!nativeModule?.CooccurrenceMatrix) {
    logger.warn('CooccurrenceMatrix not available from preloaded module')
    return null
  }
  return new nativeModule.CooccurrenceMatrix()
}

/**
 * 创建原生 TagCooccurrenceMatrix 实例
 * 这是专门优化的 Tag 共现矩阵实现
 */
export function createNativeTagCooccurrenceMatrix(
  alpha?: number,
  beta?: number
): any {
  if (!nativeModule?.TagCooccurrenceMatrix) {
    logger.warn('TagCooccurrenceMatrix not available from preloaded module')
    return null
  }
  return new nativeModule.TagCooccurrenceMatrix(alpha, beta)
}

/**
 * 创建原生 SemanticGroupMatcher 实例
 */
export function createNativeSemanticGroupMatcher(): any {
  if (!nativeModule?.SemanticGroupMatcher) {
    logger.warn('SemanticGroupMatcher not available from preloaded module')
    return null
  }
  return new nativeModule.SemanticGroupMatcher()
}

/**
 * 创建带默认服装语义组的 SemanticGroupMatcher
 */
export function createFashionSemanticGroupMatcher(): any {
  if (!nativeModule?.SemanticGroupMatcher?.withFashionGroups) {
    logger.warn('SemanticGroupMatcher.withFashionGroups not available')
    return null
  }
  return nativeModule.SemanticGroupMatcher.withFashionGroups()
}

/**
 * 创建原生 ChineseSearchEngine 实例
 */
export function createNativeChineseSearchEngine(indexPath: string): any {
  if (!nativeModule?.ChineseSearchEngine?.open) {
    logger.warn('ChineseSearchEngine not available from preloaded module')
    return null
  }
  return nativeModule.ChineseSearchEngine.open(indexPath)
}

/**
 * 使用原生 jieba 分词
 */
export function nativeJiebaCut(text: string, searchMode: boolean = true): string[] {
  if (typeof nativeModule?.jiebaCut !== 'function') {
    logger.warn('jiebaCut not available from preloaded module')
    return []
  }
  return nativeModule.jiebaCut(text, searchMode)
}

/**
 * 使用原生 jieba 提取关键词
 */
export function nativeJiebaExtractKeywords(
  text: string,
  topK: number = 10
): Array<{ keyword: string; weight: number }> {
  if (typeof nativeModule?.jiebaExtractKeywords !== 'function') {
    logger.warn('jiebaExtractKeywords not available from preloaded module')
    return []
  }
  return nativeModule.jiebaExtractKeywords(text, topK)
}

// ==================== 导出 ====================

export default {
  preloadNativeModules,
  getNativeModule,
  getNativeModuleStatus,
  isNativeModuleLoaded,
  isFeatureAvailable,
  createNativeCooccurrenceMatrix,
  createNativeTagCooccurrenceMatrix,
  createNativeSemanticGroupMatcher,
  createFashionSemanticGroupMatcher,
  createNativeChineseSearchEngine,
  nativeJiebaCut,
  nativeJiebaExtractKeywords
}
