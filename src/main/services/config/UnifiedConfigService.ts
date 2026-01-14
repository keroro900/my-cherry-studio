/**
 * UnifiedConfigService - 统一配置服务
 *
 * 解决配置管理碎片化问题：
 * - 统一配置接口
 * - 类型安全的配置访问
 * - 配置变更订阅
 * - 配置验证
 *
 * 替代分散的配置源:
 * - ConfigManager (electron-store)
 * - Redux settings slice
 * - process.env 直接访问
 * - IndexedDB settings
 * - localStorage 分散存储
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('UnifiedConfigService')

// ==================== 类型定义 ====================

/**
 * 配置 Schema
 */
export interface ConfigSchema {
  app: AppConfig
  ai: AIConfig
  memory: MemoryConfig
  vector: VectorConfig
  ui: UIConfig
  advanced: AdvancedConfig
}

/**
 * 应用配置
 */
export interface AppConfig {
  language: string
  theme: 'light' | 'dark' | 'auto'
  fontSize: number
  proxyUrl?: string
  autoUpdate: boolean
  telemetry: boolean
  tray: boolean
  closeToTray: boolean
}

/**
 * AI 配置
 */
export interface AIConfig {
  defaultProviderId?: string
  defaultModelId?: string
  embeddingProviderId?: string
  embeddingModelId?: string
  temperature: number
  maxTokens: number
  topP: number
  streamEnabled: boolean
}

/**
 * 记忆配置
 */
export interface MemoryConfig {
  enabled: boolean
  autoSave: boolean
  maxItems: number
  searchTopK: number
  useRRF: boolean
  enableTagMemo: boolean
  enableLightMemo: boolean
  enableMeshMemo: boolean
}

/**
 * 向量库配置
 */
export interface VectorConfig {
  localBackend: 'vexus' | 'libsql' | 'memory' | 'usearch'
  cloudEnabled: boolean
  cloudBackends: {
    pinecone?: {
      enabled: boolean
      apiKey?: string
      environment?: string
      indexName?: string
    }
    milvus?: {
      enabled: boolean
      host?: string
      port?: number
    }
    qdrant?: {
      enabled: boolean
      url?: string
      apiKey?: string
    }
  }
  hybridSearch: boolean
  bm25Weight: number
  rerankEnabled: boolean
  rerankModel?: string
}

/**
 * UI 配置
 */
export interface UIConfig {
  sidebarWidth: number
  sidebarCollapsed: boolean
  showAvatars: boolean
  showTimestamps: boolean
  messageGrouping: boolean
  codeHighlighting: boolean
  mathRendering: boolean
}

/**
 * 高级配置
 */
export interface AdvancedConfig {
  debugMode: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  experimentalFeatures: string[]
  customCss?: string
  apiTimeout: number
  maxRetries: number
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent<K extends keyof ConfigSchema = keyof ConfigSchema> {
  key: K
  path: string
  oldValue: unknown
  newValue: unknown
  timestamp: number
}

type ConfigListener<K extends keyof ConfigSchema = keyof ConfigSchema> = (event: ConfigChangeEvent<K>) => void
type Unsubscribe = () => void

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: ConfigSchema = {
  app: {
    language: 'zh-CN',
    theme: 'auto',
    fontSize: 14,
    autoUpdate: true,
    telemetry: false,
    tray: true,
    closeToTray: true
  },
  ai: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    streamEnabled: true
  },
  memory: {
    enabled: true,
    autoSave: true,
    maxItems: 10000,
    searchTopK: 10,
    useRRF: true,
    enableTagMemo: true,
    enableLightMemo: true,
    enableMeshMemo: false
  },
  vector: {
    localBackend: 'vexus',
    cloudEnabled: false,
    cloudBackends: {},
    hybridSearch: true,
    bm25Weight: 0.3,
    rerankEnabled: false
  },
  ui: {
    sidebarWidth: 280,
    sidebarCollapsed: false,
    showAvatars: true,
    showTimestamps: true,
    messageGrouping: true,
    codeHighlighting: true,
    mathRendering: true
  },
  advanced: {
    debugMode: false,
    logLevel: 'info',
    experimentalFeatures: [],
    apiTimeout: 30000,
    maxRetries: 3
  }
}

// ==================== 配置服务实现 ====================

class UnifiedConfigServiceImpl {
  private config: ConfigSchema = { ...DEFAULT_CONFIG }
  private listeners: Map<string, Set<ConfigListener>> = new Map()
  private initialized = false

  /**
   * 初始化配置服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 加载持久化配置
    await this.loadFromStorage()

    // 合并环境变量
    this.mergeEnvConfig()

    this.initialized = true
    logger.info('UnifiedConfigService initialized')
  }

  /**
   * 获取配置值
   */
  get<K extends keyof ConfigSchema>(section: K): ConfigSchema[K]
  get<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(section: K, key: P): ConfigSchema[K][P]
  get<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(
    section: K,
    key?: P
  ): ConfigSchema[K] | ConfigSchema[K][P] {
    if (key === undefined) {
      return { ...this.config[section] }
    }
    return this.config[section][key]
  }

  /**
   * 设置配置值
   */
  set<K extends keyof ConfigSchema>(section: K, value: Partial<ConfigSchema[K]>): void
  set<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(
    section: K,
    key: P,
    value: ConfigSchema[K][P]
  ): void
  set<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(
    section: K,
    keyOrValue: P | Partial<ConfigSchema[K]>,
    value?: ConfigSchema[K][P]
  ): void {
    if (value === undefined && typeof keyOrValue === 'object') {
      // 批量更新
      const updates = keyOrValue as Partial<ConfigSchema[K]>
      const oldSection = { ...this.config[section] }
      this.config[section] = { ...this.config[section], ...updates }

      // 触发变更事件
      for (const [key, newValue] of Object.entries(updates)) {
        this.emitChange(section, `${section}.${key}`, (oldSection as unknown as Record<string, unknown>)[key], newValue)
      }
    } else {
      // 单个更新
      const key = keyOrValue as P
      const oldValue = this.config[section][key]
      ;(this.config[section] as unknown as Record<string, unknown>)[key as string] = value
      this.emitChange(section, `${section}.${String(key)}`, oldValue, value)
    }

    // 持久化
    this.saveToStorage()
  }

  /**
   * 重置配置
   */
  reset<K extends keyof ConfigSchema>(section?: K): void {
    if (section) {
      const oldSection = this.config[section]
      this.config[section] = { ...DEFAULT_CONFIG[section] }
      this.emitChange(section, section, oldSection, this.config[section])
    } else {
      this.config = { ...DEFAULT_CONFIG }
      for (const section of Object.keys(DEFAULT_CONFIG) as Array<keyof ConfigSchema>) {
        this.emitChange(section, section, undefined, this.config[section])
      }
    }
    this.saveToStorage()
  }

  /**
   * 订阅配置变更
   */
  subscribe<K extends keyof ConfigSchema>(section: K, listener: ConfigListener<K>): Unsubscribe {
    const key = section as string
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(listener as ConfigListener)

    return () => {
      this.listeners.get(key)?.delete(listener as ConfigListener)
    }
  }

  /**
   * 获取完整配置
   */
  getAll(): ConfigSchema {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 导出配置
   */
  export(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /**
   * 导入配置
   */
  import(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson) as Partial<ConfigSchema>

      // 验证并合并
      for (const section of Object.keys(imported) as Array<keyof ConfigSchema>) {
        if (section in DEFAULT_CONFIG) {
          this.set(section, imported[section] as Partial<ConfigSchema[typeof section]>)
        }
      }

      logger.info('Configuration imported successfully')
      return true
    } catch (error) {
      logger.error('Failed to import configuration', { error })
      return false
    }
  }

  // ==================== 私有方法 ====================

  private async loadFromStorage(): Promise<void> {
    try {
      // 尝试从 electron-store 加载 (通过 IPC)
      if (typeof window !== 'undefined' && window.api?.config?.get) {
        const stored = await window.api.config.get('unified_config')
        if (stored) {
          this.config = this.mergeConfig(DEFAULT_CONFIG, stored as Partial<ConfigSchema>)
        }
      }
    } catch (error) {
      logger.warn('Failed to load config from storage', { error })
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.api?.config?.set) {
        await window.api.config.set('unified_config', this.config)
      }
    } catch (error) {
      logger.warn('Failed to save config to storage', { error })
    }
  }

  private mergeEnvConfig(): void {
    // 从环境变量读取覆盖配置
    const env = typeof process !== 'undefined' ? process.env : {}

    if (env.CHERRY_DEBUG === 'true') {
      this.config.advanced.debugMode = true
    }

    if (env.CHERRY_LOG_LEVEL) {
      this.config.advanced.logLevel = env.CHERRY_LOG_LEVEL as AdvancedConfig['logLevel']
    }

    if (env.CHERRY_PROXY_URL) {
      this.config.app.proxyUrl = env.CHERRY_PROXY_URL
    }
  }

  private mergeConfig(base: ConfigSchema, override: Partial<ConfigSchema>): ConfigSchema {
    const result = { ...base }

    for (const section of Object.keys(override) as Array<keyof ConfigSchema>) {
      if (section in base) {
        ;(result as Record<string, unknown>)[section] = { ...base[section], ...override[section] }
      }
    }

    return result
  }

  private emitChange<K extends keyof ConfigSchema>(
    section: K,
    path: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    const event: ConfigChangeEvent<K> = {
      key: section,
      path,
      oldValue,
      newValue,
      timestamp: Date.now()
    }

    // 触发 section 监听器
    const listeners = this.listeners.get(section as string)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (error) {
          logger.error('Config listener error', { error })
        }
      }
    }

    // 触发全局监听器
    const globalListeners = this.listeners.get('*')
    if (globalListeners) {
      for (const listener of globalListeners) {
        try {
          listener(event)
        } catch (error) {
          logger.error('Config listener error', { error })
        }
      }
    }
  }
}

// ==================== 单例导出 ====================

let instance: UnifiedConfigServiceImpl | null = null

export function getUnifiedConfigService(): UnifiedConfigServiceImpl {
  if (!instance) {
    instance = new UnifiedConfigServiceImpl()
  }
  return instance
}

export async function initializeConfigService(): Promise<UnifiedConfigServiceImpl> {
  const service = getUnifiedConfigService()
  await service.initialize()
  return service
}

export type UnifiedConfigService = UnifiedConfigServiceImpl

export default getUnifiedConfigService
