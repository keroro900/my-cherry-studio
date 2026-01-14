/**
 * 预设管理器
 *
 * 管理注入预设 (Presets)，支持:
 * - 相对位置注入 (before/after system, last_user, etc.)
 * - 深度注入 (按消息深度插入)
 * - 条件触发 (关键词、正则、消息数等)
 */

import { loggerService } from '@logger'
import * as fs from 'fs'
import os from 'os'
import * as path from 'path'

import type { InjectionCondition, InjectionRule, PresetManagerConfig, TavernPreset } from './types'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('PresetManager')

/**
 * 消息结构
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 获取默认存储目录
 */
function getDefaultStorageDir(): string {
  if (electronApp) {
    return path.join(electronApp.getPath('userData'), 'tavern', 'presets')
  }
  return path.join(os.tmpdir(), 'cherry-studio-data', 'tavern', 'presets')
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PresetManagerConfig = {
  storageDir: '' // 将在运行时填充
}

/**
 * 预设管理器类
 */
export class PresetManager {
  private config: PresetManagerConfig
  private presets: Map<string, TavernPreset> = new Map()
  private activePresetId: string | null = null
  private initialized: boolean = false
  private initPromise: Promise<void> | null = null

  constructor(config?: Partial<PresetManagerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      storageDir: getDefaultStorageDir(),
      ...config
    }
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    // 如果已初始化，直接返回
    if (this.initialized) return

    // 如果正在初始化，等待完成
    if (this.initPromise) {
      return this.initPromise
    }

    // 开始初始化
    this.initPromise = this.doInitialize()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  /**
   * 实际初始化逻辑
   */
  private async doInitialize(): Promise<void> {
    if (this.initialized) return

    const startTime = Date.now()
    logger.info('Initializing PresetManager', { storageDir: this.config.storageDir })

    try {
      // 确保存储目录存在
      if (!fs.existsSync(this.config.storageDir)) {
        logger.info('Creating storage directory', { path: this.config.storageDir })
        await fs.promises.mkdir(this.config.storageDir, { recursive: true })
        logger.info('Storage directory created successfully')
      }

      // 加载所有预设
      logger.info('Loading all presets from storage')
      await this.loadAllPresets()
      logger.info('Presets loaded', { count: this.presets.size, elapsedMs: Date.now() - startTime })

      // 创建默认预设（如果不存在）
      if (this.presets.size === 0) {
        logger.info('No presets found, creating default presets')
        await this.createDefaultPresets()
        logger.info('Default presets created', { elapsedMs: Date.now() - startTime })
      }

      this.initialized = true
      logger.info('PresetManager initialized successfully', {
        presetCount: this.presets.size,
        totalElapsedMs: Date.now() - startTime
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('PresetManager initialization failed', {
        error: errorMessage,
        stack: (error as Error)?.stack,
        elapsedMs: Date.now() - startTime
      })
      // Re-throw to let the caller handle the error
      throw error
    }
  }

  /**
   * 加载所有预设
   */
  private async loadAllPresets(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.storageDir)
      const jsonFiles = files.filter((f) => f.endsWith('.json'))
      logger.info('Found preset files', { totalFiles: files.length, jsonFiles: jsonFiles.length })

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.config.storageDir, file)
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const preset = JSON.parse(content) as TavernPreset

          // 恢复日期对象
          preset.createdAt = new Date(preset.createdAt)
          preset.updatedAt = new Date(preset.updatedAt)

          this.presets.set(preset.id, preset)
          logger.debug('Loaded preset', { id: preset.id, name: preset.name })
        } catch (error) {
          logger.error('Failed to load preset file', { file, error: error instanceof Error ? error.message : String(error) })
        }
      }
    } catch (error) {
      logger.error('Failed to read presets directory', {
        directory: this.config.storageDir,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 创建默认预设
   */
  private async createDefaultPresets(): Promise<void> {
    // 默认角色扮演预设
    const roleplayPreset = this.createPreset({
      name: 'Roleplay Default',
      description: 'Default preset for roleplay scenarios',
      rules: [
        {
          id: 'system_prefix',
          name: 'System Prefix',
          enabled: true,
          type: 'relative',
          relativePosition: 'before',
          relativeTarget: 'system',
          content: {
            role: 'system',
            content: '[Start a new roleplay session. Stay in character at all times.]'
          },
          priority: 100
        }
      ],
      enabled: true
    })

    // 默认导演模式预设
    const directorPreset = this.createPreset({
      name: 'Director Mode',
      description: 'Preset for director/narrator mode',
      rules: [
        {
          id: 'director_instructions',
          name: 'Director Instructions',
          enabled: true,
          type: 'relative',
          relativePosition: 'after',
          relativeTarget: 'system',
          content: {
            role: 'system',
            content: '[You are a narrator describing the scene. Do not speak as any character directly.]'
          },
          priority: 90
        }
      ],
      enabled: false
    })

    await this.save(roleplayPreset)
    await this.save(directorPreset)
  }

  // ============================================================================
  // CRUD 操作
  // ============================================================================

  /**
   * 获取预设
   */
  async get(id: string): Promise<TavernPreset | null> {
    await this.ensureInitialized()
    return this.presets.get(id) || null
  }

  /**
   * 列出所有预设
   */
  async list(): Promise<TavernPreset[]> {
    await this.ensureInitialized()
    return Array.from(this.presets.values())
  }

  /**
   * 创建预设
   */
  createPreset(data: Omit<TavernPreset, 'id' | 'createdAt' | 'updatedAt'>): TavernPreset {
    const now = new Date()
    return {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }
  }

  /**
   * 保存预设
   */
  async save(preset: TavernPreset): Promise<void> {
    await this.ensureInitialized()

    preset.updatedAt = new Date()
    this.presets.set(preset.id, preset)

    const filePath = path.join(this.config.storageDir, `${preset.id}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(preset, null, 2))

    logger.info('Saved preset', { id: preset.id, name: preset.name })
  }

  /**
   * 删除预设
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()

    if (!this.presets.has(id)) return false

    const filePath = path.join(this.config.storageDir, `${id}.json`)
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }

    this.presets.delete(id)

    if (this.activePresetId === id) {
      this.activePresetId = null
    }

    logger.info('Deleted preset', { id })
    return true
  }

  // ============================================================================
  // 预设激活
  // ============================================================================

  /**
   * 激活预设
   */
  async activate(id: string): Promise<TavernPreset | null> {
    await this.ensureInitialized()

    const preset = this.presets.get(id)
    if (!preset) return null

    this.activePresetId = id
    logger.info('Activated preset', { id, name: preset.name })
    return preset
  }

  /**
   * 停用当前预设
   */
  deactivate(): void {
    this.activePresetId = null
    logger.info('Deactivated preset')
  }

  /**
   * 获取当前激活的预设
   */
  getActive(): TavernPreset | null {
    if (!this.activePresetId) return null
    return this.presets.get(this.activePresetId) || null
  }

  /**
   * 按名称查找预设
   */
  async getByName(name: string): Promise<TavernPreset | null> {
    await this.ensureInitialized()
    for (const preset of this.presets.values()) {
      if (preset.name === name || preset.name.toLowerCase() === name.toLowerCase()) {
        return preset
      }
    }
    return null
  }

  /**
   * 按名称激活预设
   */
  async activateByName(name: string): Promise<TavernPreset | null> {
    const preset = await this.getByName(name)
    if (!preset) return null
    return this.activate(preset.id)
  }

  // ============================================================================
  // 规则应用
  // ============================================================================

  /**
   * 应用预设到消息列表
   */
  applyPreset(messages: ChatMessage[], presetId?: string): ChatMessage[] {
    const preset = presetId ? this.presets.get(presetId) : this.getActive()
    if (!preset || !preset.enabled) return messages

    const result = [...messages]
    const enabledRules = preset.rules.filter((r) => r.enabled)

    // 按优先级排序（高优先级先应用）
    enabledRules.sort((a, b) => b.priority - a.priority)

    for (const rule of enabledRules) {
      // 检查条件
      if (rule.conditions && !this.checkConditions(result, rule.conditions)) {
        continue
      }

      // 应用规则
      this.applyRule(result, rule)
    }

    return result
  }

  /**
   * 应用单条规则
   */
  private applyRule(messages: ChatMessage[], rule: InjectionRule): void {
    const content = rule.content

    if (rule.type === 'relative') {
      this.applyRelativeRule(messages, rule, content)
    } else if (rule.type === 'depth') {
      this.applyDepthRule(messages, rule, content)
    }
  }

  /**
   * 应用相对位置规则
   */
  private applyRelativeRule(
    messages: ChatMessage[],
    rule: InjectionRule,
    content: { role: 'system' | 'user' | 'assistant'; content: string }
  ): void {
    const position = rule.relativePosition || 'after'
    const target = rule.relativeTarget || 'system'

    let targetIndex = -1

    switch (target) {
      case 'system':
        targetIndex = messages.findIndex((m) => m.role === 'system')
        break
      case 'first_user':
        targetIndex = messages.findIndex((m) => m.role === 'user')
        break
      case 'last_user':
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            targetIndex = i
            break
          }
        }
        break
      case 'last_assistant':
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            targetIndex = i
            break
          }
        }
        break
    }

    if (targetIndex === -1) {
      // 目标不存在，根据情况处理
      if (target === 'system') {
        messages.unshift(content)
      }
      return
    }

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    messages.splice(insertIndex, 0, content)
  }

  /**
   * 应用深度规则
   */
  private applyDepthRule(
    messages: ChatMessage[],
    rule: InjectionRule,
    content: { role: 'system' | 'user' | 'assistant'; content: string }
  ): void {
    const depth = rule.depth ?? 0
    const insertIndex = Math.max(0, messages.length - depth)
    messages.splice(insertIndex, 0, content)
  }

  /**
   * 检查条件
   */
  private checkConditions(messages: ChatMessage[], conditions: InjectionCondition[]): boolean {
    for (const condition of conditions) {
      const result = this.checkCondition(messages, condition)
      if (condition.negate ? result : !result) {
        return false
      }
    }
    return true
  }

  /**
   * 检查单个条件
   */
  private checkCondition(messages: ChatMessage[], condition: InjectionCondition): boolean {
    const allContent = messages.map((m) => m.content).join(' ')

    switch (condition.type) {
      case 'keyword':
        return allContent.toLowerCase().includes(String(condition.value).toLowerCase())

      case 'regex':
        try {
          const regex = new RegExp(String(condition.value), 'i')
          return regex.test(allContent)
        } catch {
          return false
        }

      case 'context_length':
        return allContent.length >= Number(condition.value)

      case 'message_count':
        return messages.length >= Number(condition.value)

      default:
        return false
    }
  }

  // ============================================================================
  // 便捷方法
  // ============================================================================

  /**
   * 创建导演模式预设
   */
  async createDirectorPreset(name: string, instructions: string): Promise<TavernPreset> {
    const preset = this.createPreset({
      name,
      description: 'Director/Narrator mode preset',
      rules: [
        {
          id: 'director_main',
          name: 'Director Instructions',
          enabled: true,
          type: 'relative',
          relativePosition: 'after',
          relativeTarget: 'system',
          content: {
            role: 'system',
            content: instructions
          },
          priority: 100
        }
      ],
      enabled: true
    })

    await this.save(preset)
    return preset
  }

  /**
   * 创建角色扮演预设
   */
  async createRoleplayPreset(name: string, systemPrefix?: string, systemSuffix?: string): Promise<TavernPreset> {
    const rules: InjectionRule[] = []

    if (systemPrefix) {
      rules.push({
        id: 'system_prefix',
        name: 'System Prefix',
        enabled: true,
        type: 'relative',
        relativePosition: 'before',
        relativeTarget: 'system',
        content: { role: 'system', content: systemPrefix },
        priority: 100
      })
    }

    if (systemSuffix) {
      rules.push({
        id: 'system_suffix',
        name: 'System Suffix',
        enabled: true,
        type: 'relative',
        relativePosition: 'after',
        relativeTarget: 'system',
        content: { role: 'system', content: systemSuffix },
        priority: 90
      })
    }

    const preset = this.createPreset({
      name,
      description: 'Roleplay preset',
      rules,
      enabled: true
    })

    await this.save(preset)
    return preset
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `preset_${timestamp}_${random}`
  }

  /**
   * 确保已初始化
   *
   * 注意: 移除了之前的 10 秒超时机制，因为它会在以下场景导致假阳性失败:
   * 1. IPC 处理器在 initializeTavernModule() 完成前就被调用
   * 2. CharacterCardService 初始化需要创建多个预设角色卡，在慢速磁盘上可能超过 10 秒
   * 3. 多个并发调用各自创建超时，但等待同一个 initialize() Promise
   *
   * 正确的做法是让初始化自然完成，由调用方（如 app 启动流程）处理整体超时
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    try {
      await this.initialize()
    } catch (error) {
      logger.error('ensureInitialized failed', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * 关闭管理器
   */
  async shutdown(): Promise<void> {
    this.presets.clear()
    this.activePresetId = null
    this.initialized = false
    logger.info('PresetManager shutdown')
  }
}

// ============================================================================
// 单例
// ============================================================================

let managerInstance: PresetManager | null = null

/**
 * 获取 PresetManager 单例
 */
export function getPresetManager(): PresetManager {
  if (!managerInstance) {
    managerInstance = new PresetManager()
  }
  return managerInstance
}

/**
 * 重置 PresetManager 单例
 */
export function resetPresetManager(): void {
  if (managerInstance) {
    managerInstance.shutdown()
    managerInstance = null
  }
}
