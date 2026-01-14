/**
 * VectorDbFactory - 向量数据库工厂
 *
 * 支持多种后端:
 * - libsql: 默认，基于 SQLite 的持久化存储
 * - memory: 内存 HNSW 索引，高性能但非持久化
 * - usearch: (未来) USearch 原生高性能索引
 */

import { loggerService } from '@logger'

import { createLibSqlDbAdapter, LibSqlDbAdapter } from './LibSqlDbAdapter'
import { createMemoryVectorDb, MemoryVectorDb } from './MemoryVectorDb'
import type { VectorDbAdapter, VectorDbBackend, VectorDbConfig } from './types'
import { createUSearchAdapter, isUSearchAvailable, USearchAdapter } from './USearchAdapter'
import { createVexusDbAdapter, VexusDbAdapter } from './VexusAdapter'

const logger = loggerService.withContext('VectorDbFactory')

/**
 * 后端注册表
 */
const BACKEND_REGISTRY = new Map<VectorDbBackend, (config: VectorDbConfig) => VectorDbAdapter>([
  ['libsql', createLibSqlDbAdapter],
  ['memory', createMemoryVectorDb],
  ['usearch', createUSearchAdapter],
  ['vexus', createVexusDbAdapter]
])

/**
 * 默认后端
 */
let defaultBackend: VectorDbBackend = 'vexus'

/**
 * 设置默认后端
 */
export function setDefaultBackend(backend: VectorDbBackend): void {
  if (!BACKEND_REGISTRY.has(backend)) {
    throw new Error(`Unknown vector database backend: ${backend}`)
  }
  defaultBackend = backend
  logger.info('Default vector database backend set', { backend })
}

/**
 * 获取默认后端
 */
export function getDefaultBackend(): VectorDbBackend {
  return defaultBackend
}

/**
 * 注册自定义后端
 */
export function registerBackend(name: VectorDbBackend, factory: (config: VectorDbConfig) => VectorDbAdapter): void {
  BACKEND_REGISTRY.set(name, factory)
  logger.info('Vector database backend registered', { name })
}

/**
 * 创建向量数据库实例
 */
export function createVectorDb(config: VectorDbConfig, backend?: VectorDbBackend): VectorDbAdapter {
  const selectedBackend = backend || defaultBackend
  const factory = BACKEND_REGISTRY.get(selectedBackend)

  if (!factory) {
    throw new Error(`Unknown vector database backend: ${selectedBackend}`)
  }

  logger.info('Creating vector database', { backend: selectedBackend, path: config.path })
  return factory(config)
}

/**
 * 获取可用的后端列表
 */
export function getAvailableBackends(): VectorDbBackend[] {
  return Array.from(BACKEND_REGISTRY.keys())
}

/**
 * 检查后端是否可用
 */
export function isBackendAvailable(backend: VectorDbBackend): boolean {
  return BACKEND_REGISTRY.has(backend)
}

/**
 * 后端性能特征
 */
export const BACKEND_CHARACTERISTICS: Record<
  VectorDbBackend,
  {
    persistent: boolean
    performance: 'low' | 'medium' | 'high'
    memoryUsage: 'low' | 'medium' | 'high'
    maxVectors: number
    description: string
  }
> = {
  libsql: {
    persistent: true,
    performance: 'medium',
    memoryUsage: 'low',
    maxVectors: 1000000,
    description: 'SQLite-based persistent storage, balanced performance'
  },
  memory: {
    persistent: false,
    performance: 'high',
    memoryUsage: 'high',
    maxVectors: 100000,
    description: 'In-memory HNSW index, fastest but not persistent'
  },
  usearch: {
    persistent: true,
    performance: 'high',
    memoryUsage: 'medium',
    maxVectors: 10000000,
    description: 'USearch native index, high performance with persistence'
  },
  vexus: {
    persistent: true,
    performance: 'high',
    memoryUsage: 'medium',
    maxVectors: 10000000,
    description: 'Rust native (vexus-lite), highest performance with SQLite recovery'
  },
  hnswlib: {
    persistent: true,
    performance: 'high',
    memoryUsage: 'medium',
    maxVectors: 5000000,
    description: 'HNSW native library, high performance'
  }
}

/**
 * 根据使用场景推荐后端
 */
export function recommendBackend(options: {
  requirePersistence: boolean
  expectedVectorCount: number
  prioritizeSpeed: boolean
}): VectorDbBackend {
  const { requirePersistence, expectedVectorCount, prioritizeSpeed } = options

  // 如果需要持久化，且数据量大，推荐 libsql
  if (requirePersistence) {
    if (expectedVectorCount > 100000 && isBackendAvailable('usearch')) {
      return 'usearch'
    }
    return 'libsql'
  }

  // 如果优先速度且数据量不大，使用内存
  if (prioritizeSpeed && expectedVectorCount <= 100000) {
    return 'memory'
  }

  return 'libsql'
}

// 导出适配器类型
export { LibSqlDbAdapter, MemoryVectorDb, USearchAdapter, VexusDbAdapter }

// 导出可用性检查函数
export { isUSearchAvailable }
