/**
 * VectorBackendRegistry - 向量后端注册表
 *
 * 统一管理本地和云端向量数据库后端
 */

import { loggerService } from '@logger'

import type { VectorDbAdapter, VectorDbBackend, VectorDbConfig } from '../types'
import { createVectorDb, getAvailableBackends, isBackendAvailable, registerBackend } from '../VectorDbFactory'
import type { CloudVectorBackend, CloudVectorConfig, PineconeConfig } from '../cloud/types'

const logger = loggerService.withContext('VectorBackendRegistry')

/**
 * 扩展的向量后端类型 (包含云端)
 */
export type ExtendedVectorBackend = VectorDbBackend | CloudVectorBackend

/**
 * 后端元信息
 */
export interface BackendMeta {
  type: ExtendedVectorBackend
  isCloud: boolean
  isAvailable: boolean
  description: string
  persistent: boolean
  maxVectors: number
}

/**
 * 向量后端注册表
 */
export class VectorBackendRegistry {
  private static instance: VectorBackendRegistry | null = null

  /** 云端后端实例缓存 */
  private cloudAdapters: Map<string, VectorDbAdapter> = new Map()

  /** 云端后端配置 */
  private cloudConfigs: Map<CloudVectorBackend, CloudVectorConfig> = new Map()

  private constructor() {
    logger.info('VectorBackendRegistry initialized')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): VectorBackendRegistry {
    if (!VectorBackendRegistry.instance) {
      VectorBackendRegistry.instance = new VectorBackendRegistry()
    }
    return VectorBackendRegistry.instance
  }

  /**
   * 注册云端后端配置
   */
  registerCloudBackend(type: CloudVectorBackend, config: CloudVectorConfig): void {
    this.cloudConfigs.set(type, config)
    logger.info('Cloud backend registered', { type, indexName: config.indexName })
  }

  /**
   * 移除云端后端配置
   */
  unregisterCloudBackend(type: CloudVectorBackend): void {
    this.cloudConfigs.delete(type)
    const key = this.getCloudAdapterKey(type)
    const adapter = this.cloudAdapters.get(key)
    if (adapter?.close) {
      adapter.close()
    }
    this.cloudAdapters.delete(key)
    logger.info('Cloud backend unregistered', { type })
  }

  /**
   * 获取或创建后端适配器
   */
  async getAdapter(backend: ExtendedVectorBackend, config?: VectorDbConfig): Promise<VectorDbAdapter | null> {
    // 本地后端
    if (this.isLocalBackend(backend)) {
      if (!config) {
        logger.warn('Local backend requires config', { backend })
        return null
      }
      return createVectorDb(config, backend as VectorDbBackend)
    }

    // 云端后端
    return this.getCloudAdapter(backend as CloudVectorBackend)
  }

  /**
   * 获取云端适配器
   */
  async getCloudAdapter(type: CloudVectorBackend): Promise<VectorDbAdapter | null> {
    const key = this.getCloudAdapterKey(type)

    // 检查缓存
    if (this.cloudAdapters.has(key)) {
      return this.cloudAdapters.get(key)!
    }

    // 获取配置
    const config = this.cloudConfigs.get(type)
    if (!config) {
      logger.warn('Cloud backend not configured', { type })
      return null
    }

    // 创建适配器
    try {
      const adapter = await this.createCloudAdapter(type, config)
      if (adapter) {
        await adapter.initialize?.()
        this.cloudAdapters.set(key, adapter)
      }
      return adapter
    } catch (error) {
      logger.error('Failed to create cloud adapter', { type, error: String(error) })
      return null
    }
  }

  /**
   * 创建云端适配器
   */
  private async createCloudAdapter(
    type: CloudVectorBackend,
    config: CloudVectorConfig
  ): Promise<VectorDbAdapter | null> {
    switch (type) {
      case 'pinecone': {
        const { PineconeAdapter } = await import('../cloud/PineconeAdapter')
        return new PineconeAdapter(config as PineconeConfig)
      }
      case 'milvus':
      case 'qdrant':
      case 'weaviate':
        // 未来扩展
        logger.warn('Cloud backend not yet implemented', { type })
        return null
      default:
        logger.warn('Unknown cloud backend type', { type })
        return null
    }
  }

  /**
   * 获取所有可用后端
   */
  getAvailableBackends(): ExtendedVectorBackend[] {
    const localBackends = getAvailableBackends() as ExtendedVectorBackend[]
    const cloudBackends = Array.from(this.cloudConfigs.keys())
    return [...localBackends, ...cloudBackends]
  }

  /**
   * 获取所有后端元信息
   */
  getBackendsMeta(): BackendMeta[] {
    const metas: BackendMeta[] = []

    // 本地后端
    const localBackends: VectorDbBackend[] = ['vexus', 'libsql', 'memory', 'usearch']
    const localDescriptions: Record<VectorDbBackend, string> = {
      vexus: 'Rust 原生向量索引，最高性能',
      libsql: 'SQLite 持久化存储，平衡性能',
      memory: '内存 HNSW 索引，高速非持久化',
      usearch: 'USearch 原生索引，高性能持久化',
      hnswlib: 'HNSW 原生库，高性能'
    }

    for (const backend of localBackends) {
      metas.push({
        type: backend,
        isCloud: false,
        isAvailable: isBackendAvailable(backend),
        description: localDescriptions[backend] || backend,
        persistent: backend !== 'memory',
        maxVectors: backend === 'memory' ? 100000 : 10000000
      })
    }

    // 云端后端
    const cloudDescriptions: Record<CloudVectorBackend, string> = {
      pinecone: 'Pinecone 云端向量库，可扩展',
      milvus: 'Milvus 分布式向量库',
      qdrant: 'Qdrant Rust 高性能向量库',
      weaviate: 'Weaviate 语义搜索'
    }

    for (const [type, _config] of this.cloudConfigs) {
      metas.push({
        type,
        isCloud: true,
        isAvailable: true,
        description: cloudDescriptions[type] || type,
        persistent: true,
        maxVectors: 100000000 // 云端几乎无限
      })
    }

    return metas
  }

  /**
   * 检查后端是否可用
   */
  isAvailable(backend: ExtendedVectorBackend): boolean {
    if (this.isLocalBackend(backend)) {
      return isBackendAvailable(backend as VectorDbBackend)
    }
    return this.cloudConfigs.has(backend as CloudVectorBackend)
  }

  /**
   * 检查是否为本地后端
   */
  private isLocalBackend(backend: ExtendedVectorBackend): boolean {
    const localBackends: VectorDbBackend[] = ['vexus', 'libsql', 'memory', 'usearch', 'hnswlib']
    return localBackends.includes(backend as VectorDbBackend)
  }

  /**
   * 生成云端适配器缓存键
   */
  private getCloudAdapterKey(type: CloudVectorBackend): string {
    const config = this.cloudConfigs.get(type)
    return `${type}:${config?.indexName || 'default'}:${config?.namespace || ''}`
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    for (const [key, adapter] of this.cloudAdapters) {
      try {
        await adapter.close?.()
      } catch (error) {
        logger.warn('Error closing cloud adapter', { key, error: String(error) })
      }
    }
    this.cloudAdapters.clear()
    logger.info('VectorBackendRegistry disposed')
  }
}

/**
 * 获取向量后端注册表实例
 */
export function getVectorBackendRegistry(): VectorBackendRegistry {
  return VectorBackendRegistry.getInstance()
}

// 重新导出工厂函数
export { registerBackend }
