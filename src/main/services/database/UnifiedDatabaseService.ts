/**
 * UnifiedDatabaseService - 统一数据库服务
 *
 * 提供统一的数据库连接管理、健康检查和生命周期控制
 *
 * 职责:
 * - 统一注册和管理所有数据库连接
 * - 提供健康检查接口
 * - 统一关闭所有连接
 * - 提供数据库状态查询
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('UnifiedDatabaseService')

/**
 * 数据库适配器接口
 */
export interface DatabaseAdapter {
  /** 数据库名称 */
  name: string
  /** 数据库类型 */
  type: 'libsql' | 'sqlite' | 'indexeddb' | 'memory'
  /** 是否已初始化 */
  isInitialized(): boolean
  /** 初始化数据库 */
  initialize?(): Promise<void>
  /** 关闭数据库连接 */
  close?(): Promise<void>
  /** 健康检查 */
  healthCheck?(): Promise<boolean>
  /** 获取统计信息 */
  getStats?(): Promise<DatabaseStats>
}

/**
 * 数据库统计信息
 */
export interface DatabaseStats {
  name: string
  type: string
  isConnected: boolean
  tableCount?: number
  recordCount?: number
  sizeBytes?: number
  lastAccess?: Date
}

/**
 * 数据库注册信息
 */
interface DatabaseRegistration {
  adapter: DatabaseAdapter
  registeredAt: Date
  lastHealthCheck?: Date
  isHealthy: boolean
}

/**
 * 统一数据库服务
 */
export class UnifiedDatabaseService {
  private static instance: UnifiedDatabaseService | null = null
  private databases: Map<string, DatabaseRegistration> = new Map()
  private isShuttingDown = false

  private constructor() {
    // 注册进程退出时的清理
    process.on('beforeExit', () => this.closeAll())
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): UnifiedDatabaseService {
    if (!UnifiedDatabaseService.instance) {
      UnifiedDatabaseService.instance = new UnifiedDatabaseService()
    }
    return UnifiedDatabaseService.instance
  }

  /**
   * 注册数据库适配器
   */
  public register(adapter: DatabaseAdapter): void {
    if (this.isShuttingDown) {
      logger.warn(`Cannot register database "${adapter.name}" during shutdown`)
      return
    }

    if (this.databases.has(adapter.name)) {
      logger.warn(`Database "${adapter.name}" is already registered, skipping`)
      return
    }

    this.databases.set(adapter.name, {
      adapter,
      registeredAt: new Date(),
      isHealthy: adapter.isInitialized()
    })

    logger.info(`Registered database: ${adapter.name} (type: ${adapter.type})`)
  }

  /**
   * 注销数据库适配器
   */
  public async unregister(name: string): Promise<void> {
    const registration = this.databases.get(name)
    if (!registration) {
      logger.warn(`Database "${name}" is not registered`)
      return
    }

    // 关闭连接
    if (registration.adapter.close) {
      try {
        await registration.adapter.close()
        logger.info(`Closed database: ${name}`)
      } catch (error) {
        logger.error(`Failed to close database "${name}":`, error as Error)
      }
    }

    this.databases.delete(name)
  }

  /**
   * 获取数据库适配器
   */
  public get<T extends DatabaseAdapter>(name: string): T | undefined {
    const registration = this.databases.get(name)
    return registration?.adapter as T | undefined
  }

  /**
   * 检查数据库是否已注册
   */
  public has(name: string): boolean {
    return this.databases.has(name)
  }

  /**
   * 获取所有已注册的数据库名称
   */
  public getRegisteredNames(): string[] {
    return Array.from(this.databases.keys())
  }

  /**
   * 初始化所有已注册的数据库
   */
  public async initializeAll(): Promise<void> {
    logger.info('Initializing all registered databases...')

    const results = await Promise.allSettled(
      Array.from(this.databases.entries()).map(async ([name, registration]) => {
        if (registration.adapter.initialize && !registration.adapter.isInitialized()) {
          await registration.adapter.initialize()
          registration.isHealthy = true
          logger.info(`Initialized database: ${name}`)
        }
      })
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      logger.error(`${failed.length} database(s) failed to initialize`)
    }
  }

  /**
   * 对所有数据库执行健康检查
   */
  public async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    await Promise.allSettled(
      Array.from(this.databases.entries()).map(async ([name, registration]) => {
        try {
          let isHealthy = registration.adapter.isInitialized()

          if (registration.adapter.healthCheck) {
            isHealthy = await registration.adapter.healthCheck()
          }

          registration.isHealthy = isHealthy
          registration.lastHealthCheck = new Date()
          results.set(name, isHealthy)
        } catch (error) {
          registration.isHealthy = false
          registration.lastHealthCheck = new Date()
          results.set(name, false)
          logger.warn(`Health check failed for database "${name}":`, error as Error)
        }
      })
    )

    return results
  }

  /**
   * 获取所有数据库的统计信息
   */
  public async getAllStats(): Promise<DatabaseStats[]> {
    const stats: DatabaseStats[] = []

    for (const [name, registration] of this.databases) {
      try {
        if (registration.adapter.getStats) {
          const dbStats = await registration.adapter.getStats()
          stats.push(dbStats)
        } else {
          stats.push({
            name,
            type: registration.adapter.type,
            isConnected: registration.adapter.isInitialized()
          })
        }
      } catch (error) {
        stats.push({
          name,
          type: registration.adapter.type,
          isConnected: false
        })
      }
    }

    return stats
  }

  /**
   * 关闭所有数据库连接
   */
  public async closeAll(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    logger.info('Closing all database connections...')

    const closePromises = Array.from(this.databases.entries()).map(async ([name, registration]) => {
      if (registration.adapter.close) {
        try {
          await registration.adapter.close()
          logger.info(`Closed database: ${name}`)
        } catch (error) {
          logger.error(`Failed to close database "${name}":`, error as Error)
        }
      }
    })

    await Promise.allSettled(closePromises)
    this.databases.clear()
    this.isShuttingDown = false

    logger.info('All database connections closed')
  }

  /**
   * 获取服务状态摘要
   */
  public getSummary(): {
    totalDatabases: number
    healthyDatabases: number
    unhealthyDatabases: number
    databases: Array<{ name: string; type: string; isHealthy: boolean }>
  } {
    const databases = Array.from(this.databases.entries()).map(([name, reg]) => ({
      name,
      type: reg.adapter.type,
      isHealthy: reg.isHealthy
    }))

    return {
      totalDatabases: this.databases.size,
      healthyDatabases: databases.filter((d) => d.isHealthy).length,
      unhealthyDatabases: databases.filter((d) => !d.isHealthy).length,
      databases
    }
  }
}

/**
 * 获取 UnifiedDatabaseService 单例实例
 */
export function getUnifiedDatabaseService(): UnifiedDatabaseService {
  return UnifiedDatabaseService.getInstance()
}

/**
 * 创建简单的数据库适配器包装器
 */
export function createDatabaseAdapter(options: {
  name: string
  type: DatabaseAdapter['type']
  isInitialized: () => boolean
  initialize?: () => Promise<void>
  close?: () => Promise<void>
  healthCheck?: () => Promise<boolean>
  getStats?: () => Promise<DatabaseStats>
}): DatabaseAdapter {
  return {
    name: options.name,
    type: options.type,
    isInitialized: options.isInitialized,
    initialize: options.initialize,
    close: options.close,
    healthCheck: options.healthCheck,
    getStats: options.getStats
  }
}
