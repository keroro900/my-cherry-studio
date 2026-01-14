/**
 * VCP 静态插件调度器
 *
 * 使用 node-cron 实现静态插件的定时刷新：
 * - 解析 refreshIntervalCron 配置
 * - 后台更新占位符值
 * - 支持启动时刷新
 * - 错误时保留旧值
 */

import { loggerService } from '@logger'
import * as cron from 'node-cron'

import type { PlaceholderEngine } from './PlaceholderEngine'
import type { PluginExecutor } from './PluginExecutor'
import type { PluginRegistry } from './PluginRegistry'
import type { VCPPlugin } from './types'

const logger = loggerService.withContext('VCP:StaticPluginScheduler')

/**
 * 调度任务信息
 */
interface ScheduledJob {
  pluginName: string
  cronExpression: string
  task: cron.ScheduledTask
  lastRun?: number
  lastResult?: 'success' | 'error'
  lastError?: string
  runCount: number
}

/**
 * 调度任务信息（用于 API 返回）
 */
export interface ScheduledJobInfo {
  pluginName: string
  cronExpression: string
  lastRun?: number
  lastResult?: 'success' | 'error'
  lastError?: string
  runCount: number
  isRunning: boolean
}

/**
 * 静态插件调度器配置
 */
export interface StaticPluginSchedulerConfig {
  /** 是否启用启动时刷新 */
  enableStartupRefresh: boolean
  /** 默认 cron 表达式（每小时） */
  defaultCronExpression: string
  /** 刷新超时（毫秒） */
  refreshTimeout: number
}

const DEFAULT_CONFIG: StaticPluginSchedulerConfig = {
  enableStartupRefresh: true,
  defaultCronExpression: '0 * * * *', // 每小时整点
  refreshTimeout: 30000
}

/**
 * 静态插件调度器
 */
export class StaticPluginScheduler {
  private registry: PluginRegistry
  private executor: PluginExecutor
  private placeholderEngine: PlaceholderEngine
  private config: StaticPluginSchedulerConfig

  private scheduledJobs: Map<string, ScheduledJob> = new Map()
  private isInitialized: boolean = false
  private isShuttingDown: boolean = false

  constructor(
    registry: PluginRegistry,
    executor: PluginExecutor,
    placeholderEngine: PlaceholderEngine,
    config?: Partial<StaticPluginSchedulerConfig>
  ) {
    this.registry = registry
    this.executor = executor
    this.placeholderEngine = placeholderEngine
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 初始化调度器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('StaticPluginScheduler already initialized')
      return
    }

    logger.info('Initializing StaticPluginScheduler...')

    // 获取所有静态插件 (排除 builtin_service 类型)
    const staticPlugins = this.registry.getPluginsByType('static')

    // 获取 BuiltinServiceRegistry 中已注册的服务名称
    // 这些服务是多命令服务，不适合自动定时刷新
    const { ensureBuiltinServicesInitialized } = await import('./BuiltinServices')
    const builtinRegistry = await ensureBuiltinServicesInitialized()
    const builtinServiceNames = new Set(builtinRegistry.getAllNames())

    // 过滤掉:
    // 1. 非 static 类型的插件
    // 2. 在 BuiltinServiceRegistry 中注册的服务（它们需要指定 command 参数）
    const eligiblePlugins = staticPlugins.filter((p) => {
      if (p.manifest.pluginType !== 'static') return false
      if (builtinServiceNames.has(p.manifest.name)) {
        logger.debug('Skipping builtin service from static scheduling', {
          plugin: p.manifest.name,
          reason: 'registered in BuiltinServiceRegistry'
        })
        return false
      }
      return true
    })

    logger.info('Found static plugins', {
      count: eligiblePlugins.length,
      names: eligiblePlugins.map((p) => p.manifest.name),
      skippedBuiltinServices: Array.from(builtinServiceNames).filter((name) =>
        staticPlugins.some((p) => p.manifest.name === name)
      )
    })

    // 为每个有 cron 配置的静态插件创建调度任务
    for (const plugin of eligiblePlugins) {
      if (plugin.enabled) {
        await this.schedulePlugin(plugin)
      }
    }

    // 启动时刷新所有静态插件
    if (this.config.enableStartupRefresh) {
      await this.refreshAllOnStartup(eligiblePlugins)
    }

    this.isInitialized = true
    logger.info('StaticPluginScheduler initialized', {
      scheduledJobs: this.scheduledJobs.size
    })
  }

  /**
   * 为插件创建调度任务
   */
  private async schedulePlugin(plugin: VCPPlugin): Promise<void> {
    const cronExpression = plugin.manifest.refreshIntervalCron

    // 如果没有配置 cron 表达式，跳过
    if (!cronExpression) {
      logger.debug('Plugin has no cron expression, skipping scheduling', {
        plugin: plugin.manifest.name
      })
      return
    }

    // 验证 cron 表达式
    if (!cron.validate(cronExpression)) {
      logger.warn('Invalid cron expression', {
        plugin: plugin.manifest.name,
        cronExpression
      })
      return
    }

    // 取消已存在的调度任务
    this.cancelSchedule(plugin.manifest.name)

    // 创建新的调度任务
    // node-cron@4 默认自动调度，不需要 scheduled 参数
    const task = cron.schedule(
      cronExpression,
      async () => {
        if (this.isShuttingDown) return
        await this.runScheduledRefresh(plugin.manifest.name)
      },
      {
        timezone: 'Asia/Shanghai' // 使用中国时区
      }
    )

    const job: ScheduledJob = {
      pluginName: plugin.manifest.name,
      cronExpression,
      task,
      runCount: 0
    }

    this.scheduledJobs.set(plugin.manifest.name, job)

    logger.info('Scheduled static plugin refresh', {
      plugin: plugin.manifest.name,
      cronExpression
    })
  }

  /**
   * 执行调度刷新
   */
  private async runScheduledRefresh(pluginName: string): Promise<void> {
    const job = this.scheduledJobs.get(pluginName)
    if (!job) return

    const plugin = this.registry.getPlugin(pluginName)
    if (!plugin || !plugin.enabled) {
      logger.debug('Plugin disabled or not found, skipping refresh', { pluginName })
      return
    }

    // 安全检查：只处理 static 类型的插件
    if (plugin.manifest.pluginType !== 'static') {
      logger.debug('Skipping non-static plugin in scheduled refresh', {
        pluginName,
        type: plugin.manifest.pluginType
      })
      // 取消这个调度任务，因为它不应该被调度
      this.cancelSchedule(pluginName)
      return
    }

    logger.debug('Running scheduled refresh', { pluginName })

    try {
      await this.updateStaticPluginValue(plugin)
      job.lastRun = Date.now()
      job.lastResult = 'success'
      job.lastError = undefined
      job.runCount++

      logger.info('Scheduled refresh completed', {
        pluginName,
        runCount: job.runCount
      })
    } catch (error) {
      job.lastRun = Date.now()
      job.lastResult = 'error'
      job.lastError = error instanceof Error ? error.message : String(error)
      job.runCount++

      logger.error('Scheduled refresh failed', {
        pluginName,
        error: job.lastError,
        runCount: job.runCount
      })
    }
  }

  /**
   * 更新静态插件的占位符值
   */
  private async updateStaticPluginValue(plugin: VCPPlugin): Promise<void> {
    // 安全检查：只处理 static 类型的插件
    // builtin_service 类型需要指定 command 参数，不适合这种自动刷新机制
    if (plugin.manifest.pluginType !== 'static') {
      logger.debug('Skipping non-static plugin in updateStaticPluginValue', {
        plugin: plugin.manifest.name,
        type: plugin.manifest.pluginType
      })
      return
    }

    const placeholders = plugin.manifest.capabilities?.systemPromptPlaceholders || []

    if (placeholders.length === 0) {
      logger.debug('Plugin has no placeholders', { plugin: plugin.manifest.name })
      return
    }

    // 执行插件获取新值
    const result = await this.executor.execute(
      plugin.manifest.name,
      {},
      {
        timeout: this.config.refreshTimeout
      }
    )

    if (result.success && result.output) {
      // 更新占位符值
      for (const ph of placeholders) {
        let value: string

        if (typeof result.output === 'string') {
          value = result.output
        } else if (typeof result.output === 'object') {
          // 尝试从输出对象中获取占位符值
          value = result.output[ph.placeholder] || JSON.stringify(result.output)
        } else {
          value = String(result.output)
        }

        this.placeholderEngine.setStaticValue(ph.placeholder, value)

        logger.debug('Updated placeholder value', {
          plugin: plugin.manifest.name,
          placeholder: ph.placeholder,
          valueLength: value.length
        })
      }
    } else {
      // 执行失败，保留旧值
      logger.warn('Static plugin execution failed, keeping old values', {
        plugin: plugin.manifest.name,
        error: result.error
      })
      throw new Error(result.error || 'Unknown error')
    }
  }

  /**
   * 启动时刷新所有静态插件
   */
  private async refreshAllOnStartup(plugins: VCPPlugin[]): Promise<void> {
    const refreshablePlugins = plugins.filter((p) => p.enabled && p.manifest.refreshOnStartup !== false)

    if (refreshablePlugins.length === 0) {
      logger.debug('No plugins to refresh on startup')
      return
    }

    logger.info('Refreshing static plugins on startup', {
      count: refreshablePlugins.length
    })

    // 并行刷新所有插件
    const results = await Promise.allSettled(refreshablePlugins.map((plugin) => this.updateStaticPluginValue(plugin)))

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    logger.info('Startup refresh completed', { succeeded, failed })
  }

  /**
   * 取消单个插件的调度
   */
  cancelSchedule(pluginName: string): boolean {
    const job = this.scheduledJobs.get(pluginName)
    if (!job) return false

    job.task.stop()
    this.scheduledJobs.delete(pluginName)

    logger.info('Cancelled scheduled refresh', { pluginName })
    return true
  }

  /**
   * 取消所有调度任务
   */
  cancelAllSchedules(): void {
    for (const [pluginName, job] of this.scheduledJobs) {
      job.task.stop()
      logger.debug('Stopped scheduled task', { pluginName })
    }
    this.scheduledJobs.clear()
    logger.info('All scheduled tasks cancelled')
  }

  /**
   * 手动触发单个插件刷新
   */
  async triggerRefresh(pluginName: string): Promise<boolean> {
    const plugin = this.registry.getPlugin(pluginName)
    if (!plugin || plugin.manifest.pluginType !== 'static') {
      logger.warn('Plugin not found or not static type', { pluginName })
      return false
    }

    try {
      await this.updateStaticPluginValue(plugin)
      logger.info('Manual refresh triggered successfully', { pluginName })
      return true
    } catch (error) {
      logger.error('Manual refresh failed', {
        pluginName,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * 获取所有调度任务信息
   */
  getScheduledJobs(): ScheduledJobInfo[] {
    return Array.from(this.scheduledJobs.values()).map((job) => ({
      pluginName: job.pluginName,
      cronExpression: job.cronExpression,
      lastRun: job.lastRun,
      lastResult: job.lastResult,
      lastError: job.lastError,
      runCount: job.runCount,
      isRunning: true // cron 任务创建后就是运行状态
    }))
  }

  /**
   * 获取单个调度任务信息
   */
  getScheduledJob(pluginName: string): ScheduledJobInfo | null {
    const job = this.scheduledJobs.get(pluginName)
    if (!job) return null

    return {
      pluginName: job.pluginName,
      cronExpression: job.cronExpression,
      lastRun: job.lastRun,
      lastResult: job.lastResult,
      lastError: job.lastError,
      runCount: job.runCount,
      isRunning: true
    }
  }

  /**
   * 重新加载调度器
   */
  async reload(): Promise<void> {
    logger.info('Reloading StaticPluginScheduler...')

    // 取消所有现有调度
    this.cancelAllSchedules()

    // 重新初始化
    this.isInitialized = false
    await this.initialize()
  }

  /**
   * 关闭调度器
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down StaticPluginScheduler...')

    this.isShuttingDown = true
    this.cancelAllSchedules()
    this.isInitialized = false

    logger.info('StaticPluginScheduler shut down successfully')
  }
}

/**
 * 创建静态插件调度器实例
 */
export function createStaticPluginScheduler(
  registry: PluginRegistry,
  executor: PluginExecutor,
  placeholderEngine: PlaceholderEngine,
  config?: Partial<StaticPluginSchedulerConfig>
): StaticPluginScheduler {
  return new StaticPluginScheduler(registry, executor, placeholderEngine, config)
}
