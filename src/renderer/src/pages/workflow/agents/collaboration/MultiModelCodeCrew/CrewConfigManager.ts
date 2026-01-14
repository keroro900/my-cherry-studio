/**
 * CrewConfigManager - 角色配置管理器
 *
 * 管理每个角色的自定义配置：
 * - 系统提示词（类似 CLAUDE.md）
 * - 模型选择
 * - 行为参数
 */

import { loggerService } from '@logger'

import type { CrewRole, ModelProvider, RoleModelConfig } from './types'
import { CREW_ROLE_CONFIGS } from './types'

const logger = loggerService.withContext('CrewConfigManager')

// ==================== 类型定义 ====================

/**
 * 角色自定义配置
 */
export interface RoleCustomConfig {
  /** 角色 ID */
  role: CrewRole
  /** 自定义系统提示词（覆盖默认） */
  systemPrompt?: string
  /** 追加到默认提示词后的内容 */
  systemPromptAppend?: string
  /** 模型配置 */
  modelConfig?: Partial<RoleModelConfig>
  /** 是否启用 */
  enabled: boolean
  /** 专业领域标签 */
  expertiseTags?: string[]
  /** 可处理的任务类型权重 */
  taskTypeWeights?: Record<string, number>
  /** 最大并发任务数 */
  maxConcurrentTasks?: number
  /** 超时时间 (毫秒) */
  timeout?: number
}

/**
 * Crew 全局配置
 */
export interface CrewGlobalConfig {
  /** 项目名称 */
  projectName?: string
  /** 项目描述 */
  projectDescription?: string
  /** 技术栈 */
  techStack?: string[]
  /** 编码规范文件路径 */
  conventionsPath?: string
  /** 编码规范内容 */
  conventions?: string
  /** 项目特定指令 (类似 CLAUDE.md) */
  projectInstructions?: string
  /** 默认语言 */
  defaultLanguage?: string
  /** 最大迭代次数 */
  maxIterations?: number
  /** 启用自动审查 */
  enableAutoReview?: boolean
  /** 启用自动测试 */
  enableAutoTest?: boolean
  /** 启用联网搜索 */
  enableWebSearch?: boolean
}

/**
 * 完整配置
 */
export interface CrewFullConfig {
  global: CrewGlobalConfig
  roles: Record<CrewRole, RoleCustomConfig>
}

// ==================== 默认配置 ====================

/**
 * 创建默认角色配置
 */
function createDefaultRoleConfig(role: CrewRole): RoleCustomConfig {
  const roleConfig = CREW_ROLE_CONFIGS[role]
  return {
    role,
    enabled: true,
    modelConfig: {
      provider: roleConfig.recommendedProvider,
      modelId: roleConfig.recommendedModel,
      temperature: 0.7
    },
    maxConcurrentTasks: 1,
    timeout: 120000 // 2 分钟
  }
}

/**
 * 默认全局配置
 */
const DEFAULT_GLOBAL_CONFIG: CrewGlobalConfig = {
  defaultLanguage: 'typescript',
  maxIterations: 5,
  enableAutoReview: true,
  enableAutoTest: true,
  enableWebSearch: false
}

// ==================== 配置存储 ====================

const CONFIG_STORAGE_KEY = 'crew_config'

/**
 * 从本地存储加载配置
 */
function loadFromStorage(): CrewFullConfig | null {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    logger.warn('Failed to load config from storage', error as Error)
  }
  return null
}

/**
 * 保存配置到本地存储
 */
function saveToStorage(config: CrewFullConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    logger.error('Failed to save config to storage', error as Error)
  }
}

// ==================== 配置管理器类 ====================

/**
 * 配置管理器
 */
export class CrewConfigManager {
  private config: CrewFullConfig
  private listeners: Set<(config: CrewFullConfig) => void> = new Set()

  constructor() {
    // 加载或创建默认配置
    const stored = loadFromStorage()
    if (stored) {
      this.config = stored
    } else {
      this.config = this.createDefaultConfig()
    }
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): CrewFullConfig {
    const roles = {} as Record<CrewRole, RoleCustomConfig>
    const roleKeys: CrewRole[] = [
      'architect',
      'developer',
      'frontend',
      'reviewer',
      'tester',
      'researcher',
      'devops',
      'security'
    ]

    for (const role of roleKeys) {
      roles[role] = createDefaultRoleConfig(role)
    }

    return {
      global: { ...DEFAULT_GLOBAL_CONFIG },
      roles
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): CrewFullConfig {
    return { ...this.config }
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig(): CrewGlobalConfig {
    return { ...this.config.global }
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(updates: Partial<CrewGlobalConfig>): void {
    this.config.global = {
      ...this.config.global,
      ...updates
    }
    this.save()
    this.notifyListeners()
  }

  /**
   * 获取角色配置
   */
  getRoleConfig(role: CrewRole): RoleCustomConfig {
    return { ...this.config.roles[role] }
  }

  /**
   * 更新角色配置
   */
  updateRoleConfig(role: CrewRole, updates: Partial<RoleCustomConfig>): void {
    this.config.roles[role] = {
      ...this.config.roles[role],
      ...updates,
      role // 确保 role 不被覆盖
    }
    this.save()
    this.notifyListeners()
  }

  /**
   * 获取角色的最终系统提示词
   */
  getRoleSystemPrompt(role: CrewRole): string {
    const roleConfig = this.config.roles[role]
    const defaultPrompt = CREW_ROLE_CONFIGS[role].systemPrompt

    // 如果有自定义提示词，使用自定义的
    if (roleConfig.systemPrompt) {
      return roleConfig.systemPrompt
    }

    // 否则使用默认 + 追加内容
    let prompt = defaultPrompt

    // 添加项目指令
    if (this.config.global.projectInstructions) {
      prompt = `${prompt}\n\n## 项目指令\n${this.config.global.projectInstructions}`
    }

    // 添加编码规范
    if (this.config.global.conventions) {
      prompt = `${prompt}\n\n## 编码规范\n${this.config.global.conventions}`
    }

    // 添加技术栈信息
    if (this.config.global.techStack?.length) {
      prompt = `${prompt}\n\n## 技术栈\n${this.config.global.techStack.join(', ')}`
    }

    // 添加角色追加内容
    if (roleConfig.systemPromptAppend) {
      prompt = `${prompt}\n\n## 额外指令\n${roleConfig.systemPromptAppend}`
    }

    return prompt
  }

  /**
   * 获取角色的模型配置
   */
  getRoleModelConfig(role: CrewRole): RoleModelConfig {
    const roleConfig = this.config.roles[role]
    const defaultConfig = CREW_ROLE_CONFIGS[role]

    return {
      provider: (roleConfig.modelConfig?.provider || defaultConfig.recommendedProvider) as ModelProvider,
      modelId: roleConfig.modelConfig?.modelId || defaultConfig.recommendedModel,
      temperature: roleConfig.modelConfig?.temperature ?? 0.7,
      maxTokens: roleConfig.modelConfig?.maxTokens,
      streaming: roleConfig.modelConfig?.streaming ?? true
    }
  }

  /**
   * 获取启用的角色列表
   */
  getEnabledRoles(): CrewRole[] {
    return Object.entries(this.config.roles)
      .filter(([, config]) => config.enabled)
      .map(([role]) => role as CrewRole)
  }

  /**
   * 获取项目指令 (类似 CLAUDE.md)
   */
  getProjectInstructions(): string {
    return this.config.global.projectInstructions || ''
  }

  /**
   * 设置项目指令 (类似 CLAUDE.md)
   */
  setProjectInstructions(instructions: string): void {
    this.config.global.projectInstructions = instructions
    this.save()
    this.notifyListeners()
  }

  /**
   * 从文件内容设置编码规范
   */
  setConventions(conventions: string): void {
    this.config.global.conventions = conventions
    this.save()
    this.notifyListeners()
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = this.createDefaultConfig()
    this.save()
    this.notifyListeners()
  }

  /**
   * 重置指定角色配置
   */
  resetRole(role: CrewRole): void {
    this.config.roles[role] = createDefaultRoleConfig(role)
    this.save()
    this.notifyListeners()
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
      const imported = JSON.parse(configJson) as CrewFullConfig
      // 验证配置结构
      if (!imported.global || !imported.roles) {
        throw new Error('Invalid config structure')
      }
      this.config = imported
      this.save()
      this.notifyListeners()
      return true
    } catch (error) {
      logger.error('Failed to import config', error as Error)
      return false
    }
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: CrewFullConfig) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 保存配置
   */
  private save(): void {
    saveToStorage(this.config)
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config)
      } catch (error) {
        logger.error('Config listener error', error as Error)
      }
    }
  }
}

// ==================== 单例实例 ====================

let configManagerInstance: CrewConfigManager | null = null

/**
 * 获取配置管理器实例
 */
export function getCrewConfigManager(): CrewConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new CrewConfigManager()
  }
  return configManagerInstance
}

export default getCrewConfigManager
