/**
 * 预设市场服务
 * Preset Market Service
 *
 * 管理预设的加载、存储、搜索和应用
 */

import { loggerService } from '@logger'

import { ALL_BUILTIN_PRESETS } from '../data/builtin-presets'
import type {
  CreatePresetParams,
  ModuleConfig,
  PresetCategory,
  PresetExportData,
  PresetImportResult,
  PresetQueryParams,
  PresetQueryResult,
  PresetSortOptions,
  StudioModule,
  StudioPreset,
  UpdatePresetParams
} from '../types'

const logger = loggerService.withContext('PresetMarketService')

// 存储键名
const STORAGE_KEY = 'image-studio-user-presets'
const FAVORITES_KEY = 'image-studio-preset-favorites'
const USAGE_KEY = 'image-studio-preset-usage'

/**
 * 预设市场服务（单例）
 */
class PresetMarketService {
  private static instance: PresetMarketService

  /** 内置预设缓存 */
  private builtinPresets: StudioPreset[] = []

  /** 用户预设缓存 */
  private userPresets: StudioPreset[] = []

  /** 收藏 ID 集合 */
  private favoriteIds: Set<string> = new Set()

  /** 使用次数记录 */
  private usageCount: Record<string, number> = {}

  /** 是否已初始化 */
  private initialized = false

  private constructor() {}

  static getInstance(): PresetMarketService {
    if (!PresetMarketService.instance) {
      PresetMarketService.instance = new PresetMarketService()
    }
    return PresetMarketService.instance
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 加载内置预设
      this.builtinPresets = ALL_BUILTIN_PRESETS.map((preset) => ({
        ...preset,
        usageCount: this.usageCount[preset.id] || 0,
        isFavorite: this.favoriteIds.has(preset.id)
      }))

      // 从 localStorage 加载用户预设
      this.loadUserPresets()

      // 加载收藏和使用次数
      this.loadFavorites()
      this.loadUsageCount()

      // 更新预设的收藏和使用次数状态
      this.updatePresetsMetadata()

      this.initialized = true
      logger.info('PresetMarketService 初始化完成', {
        builtinCount: this.builtinPresets.length,
        userCount: this.userPresets.length
      })
    } catch (error) {
      logger.error('PresetMarketService 初始化失败', error as Error)
      throw error
    }
  }

  // ============================================================================
  // 查询方法
  // ============================================================================

  /**
   * 获取所有预设（内置 + 用户）
   */
  getAllPresets(): StudioPreset[] {
    return [...this.builtinPresets, ...this.userPresets]
  }

  /**
   * 获取内置预设
   */
  getBuiltinPresets(): StudioPreset[] {
    return [...this.builtinPresets]
  }

  /**
   * 获取用户预设
   */
  getUserPresets(): StudioPreset[] {
    return [...this.userPresets]
  }

  /**
   * 根据 ID 获取预设
   */
  getPresetById(id: string): StudioPreset | undefined {
    return this.builtinPresets.find((p) => p.id === id) || this.userPresets.find((p) => p.id === id)
  }

  /**
   * 按模块获取预设
   */
  getPresetsByModule(module: StudioModule): StudioPreset[] {
    return this.getAllPresets().filter((p) => p.module === module)
  }

  /**
   * 按分类获取预设
   */
  getPresetsByCategory(category: PresetCategory): StudioPreset[] {
    return this.getAllPresets().filter((p) => p.category === category)
  }

  /**
   * 获取收藏的预设
   */
  getFavoritePresets(): StudioPreset[] {
    return this.getAllPresets().filter((p) => p.isFavorite)
  }

  /**
   * 查询预设（支持筛选、排序、分页）
   */
  queryPresets(params: PresetQueryParams): PresetQueryResult {
    const {
      module,
      category,
      source,
      favoritesOnly,
      keyword,
      tags,
      sortBy,
      ascending,
      page = 1,
      pageSize = 20
    } = params

    // 筛选
    let presets = this.getAllPresets()

    if (module && module !== 'all') {
      presets = presets.filter((p) => p.module === module)
    }

    if (category && category !== 'all') {
      presets = presets.filter((p) => p.category === category)
    }

    if (source && source !== 'all') {
      presets = presets.filter((p) => p.source === source)
    }

    if (favoritesOnly) {
      presets = presets.filter((p) => p.isFavorite)
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase()
      presets = presets.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerKeyword) ||
          p.nameEn?.toLowerCase().includes(lowerKeyword) ||
          p.description.toLowerCase().includes(lowerKeyword) ||
          p.tags.some((t) => t.toLowerCase().includes(lowerKeyword))
      )
    }

    if (tags && tags.length > 0) {
      presets = presets.filter((p) => tags.some((tag) => p.tags.includes(tag)))
    }

    // 排序
    presets = this.sortPresets(presets, { sortBy, ascending })

    // 分页
    const total = presets.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const pagedPresets = presets.slice(startIndex, endIndex)

    return {
      presets: pagedPresets,
      total,
      page,
      pageSize,
      hasMore: endIndex < total
    }
  }

  /**
   * 搜索预设
   */
  searchPresets(keyword: string, module?: StudioModule, limit: number = 20): StudioPreset[] {
    return this.queryPresets({
      keyword,
      module: module || 'all',
      category: 'all',
      source: 'all',
      sortBy: 'usageCount',
      ascending: false,
      page: 1,
      pageSize: limit
    }).presets
  }

  // ============================================================================
  // 用户预设管理
  // ============================================================================

  /**
   * 创建用户预设
   */
  createPreset(params: CreatePresetParams): StudioPreset {
    const now = Date.now()
    const id = `user_${now}_${Math.random().toString(36).slice(2, 8)}`

    const preset: StudioPreset = {
      id,
      name: params.name,
      description: params.description,
      module: params.module,
      category: params.category,
      tags: params.tags || [],
      config: params.config,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      promptTemplate: params.promptTemplate,
      thumbnail: params.thumbnail,
      source: 'user',
      usageCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0'
    }

    this.userPresets.push(preset)
    this.saveUserPresets()

    logger.info('创建用户预设', { id, name: params.name })
    return preset
  }

  /**
   * 更新用户预设
   */
  updatePreset(params: UpdatePresetParams): StudioPreset | undefined {
    const index = this.userPresets.findIndex((p) => p.id === params.id)
    if (index === -1) {
      logger.warn('未找到要更新的预设', { id: params.id })
      return undefined
    }

    const preset = this.userPresets[index]
    const updated: StudioPreset = {
      ...preset,
      name: params.name ?? preset.name,
      description: params.description ?? preset.description,
      category: params.category ?? preset.category,
      tags: params.tags ?? preset.tags,
      config: params.config ?? preset.config,
      systemPrompt: params.systemPrompt ?? preset.systemPrompt,
      userPrompt: params.userPrompt ?? preset.userPrompt,
      promptTemplate: params.promptTemplate ?? preset.promptTemplate,
      thumbnail: params.thumbnail ?? preset.thumbnail,
      isFavorite: params.isFavorite ?? preset.isFavorite,
      updatedAt: Date.now()
    }

    this.userPresets[index] = updated
    this.saveUserPresets()

    logger.info('更新用户预设', { id: params.id })
    return updated
  }

  /**
   * 删除用户预设
   */
  deletePreset(id: string): boolean {
    const index = this.userPresets.findIndex((p) => p.id === id)
    if (index === -1) {
      logger.warn('未找到要删除的预设', { id })
      return false
    }

    this.userPresets.splice(index, 1)
    this.saveUserPresets()

    // 同时清理收藏和使用次数
    this.favoriteIds.delete(id)
    delete this.usageCount[id]
    this.saveFavorites()
    this.saveUsageCount()

    logger.info('删除用户预设', { id })
    return true
  }

  /**
   * 复制预设为用户预设
   */
  duplicatePreset(id: string, newName?: string): StudioPreset | undefined {
    const original = this.getPresetById(id)
    if (!original) {
      logger.warn('未找到要复制的预设', { id })
      return undefined
    }

    return this.createPreset({
      name: newName || `${original.name} (复制)`,
      description: original.description,
      module: original.module,
      category: original.category,
      tags: [...original.tags],
      config: { ...original.config } as ModuleConfig,
      systemPrompt: original.systemPrompt,
      userPrompt: original.userPrompt,
      promptTemplate: original.promptTemplate,
      thumbnail: original.thumbnail
    })
  }

  // ============================================================================
  // 收藏管理
  // ============================================================================

  /**
   * 切换收藏状态
   */
  toggleFavorite(id: string): boolean {
    const isFavorite = this.favoriteIds.has(id)

    if (isFavorite) {
      this.favoriteIds.delete(id)
    } else {
      this.favoriteIds.add(id)
    }

    // 更新预设状态
    this.updatePresetFavoriteStatus(id, !isFavorite)
    this.saveFavorites()

    return !isFavorite
  }

  /**
   * 检查是否收藏
   */
  isFavorite(id: string): boolean {
    return this.favoriteIds.has(id)
  }

  // ============================================================================
  // 使用统计
  // ============================================================================

  /**
   * 记录预设使用
   */
  recordUsage(id: string): void {
    this.usageCount[id] = (this.usageCount[id] || 0) + 1
    this.updatePresetUsageCount(id)
    this.saveUsageCount()
  }

  /**
   * 获取热门预设
   */
  getPopularPresets(module?: StudioModule, limit: number = 10): StudioPreset[] {
    const presets = module ? this.getPresetsByModule(module) : this.getAllPresets()
    return this.sortPresets(presets, { sortBy: 'usageCount', ascending: false }).slice(0, limit)
  }

  /**
   * 获取最近使用的预设
   */
  getRecentPresets(limit: number = 10): StudioPreset[] {
    return this.sortPresets(this.getAllPresets(), { sortBy: 'updatedAt', ascending: false }).slice(0, limit)
  }

  // ============================================================================
  // 应用预设
  // ============================================================================

  /**
   * 应用预设配置
   */
  applyPreset(id: string): ModuleConfig | undefined {
    const preset = this.getPresetById(id)
    if (!preset) {
      logger.warn('未找到要应用的预设', { id })
      return undefined
    }

    // 记录使用
    this.recordUsage(id)

    logger.info('应用预设', { id, name: preset.name })
    return { ...preset.config } as ModuleConfig
  }

  // ============================================================================
  // 导入导出
  // ============================================================================

  /**
   * 导出用户预设
   */
  exportPresets(presetIds?: string[]): PresetExportData {
    let presetsToExport = this.userPresets

    if (presetIds && presetIds.length > 0) {
      presetsToExport = this.userPresets.filter((p) => presetIds.includes(p.id))
    }

    // 移除使用统计和收藏信息（私有数据）
    const cleanedPresets = presetsToExport.map(({ usageCount, isFavorite, ...rest }) => rest)

    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      presets: cleanedPresets
    }
  }

  /**
   * 导入预设
   */
  importPresets(data: PresetExportData, overwrite: boolean = false): PresetImportResult {
    const result: PresetImportResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      importedIds: [],
      errors: []
    }

    for (const presetData of data.presets) {
      try {
        // 检查是否已存在
        const existing = this.userPresets.find((p) => p.name === presetData.name && p.module === presetData.module)

        if (existing && !overwrite) {
          result.skippedCount++
          continue
        }

        if (existing && overwrite) {
          // 更新现有预设
          const { id: _ignoredId, ...updateData } = presetData
          this.updatePreset({
            id: existing.id,
            ...updateData
          })
          result.successCount++
          result.importedIds.push(existing.id)
        } else {
          // 创建新预设
          const newPreset = this.createPreset({
            name: presetData.name,
            description: presetData.description,
            module: presetData.module,
            category: presetData.category,
            tags: presetData.tags,
            config: presetData.config as ModuleConfig,
            promptTemplate: presetData.promptTemplate,
            thumbnail: presetData.thumbnail
          })
          result.successCount++
          result.importedIds.push(newPreset.id)
        }
      } catch (error: any) {
        result.failedCount++
        result.errors.push({
          presetName: presetData.name,
          error: error.message || '导入失败'
        })
      }
    }

    logger.info('导入预设完成', result)
    return result
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private loadUserPresets(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.userPresets = JSON.parse(stored)
      }
    } catch (error) {
      logger.error('加载用户预设失败', error as Error)
      this.userPresets = []
    }
  }

  private saveUserPresets(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userPresets))
    } catch (error) {
      logger.error('保存用户预设失败', error as Error)
    }
  }

  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        this.favoriteIds = new Set(JSON.parse(stored))
      }
    } catch (error) {
      logger.error('加载收藏失败', error as Error)
      this.favoriteIds = new Set()
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.favoriteIds]))
    } catch (error) {
      logger.error('保存收藏失败', error as Error)
    }
  }

  private loadUsageCount(): void {
    try {
      const stored = localStorage.getItem(USAGE_KEY)
      if (stored) {
        this.usageCount = JSON.parse(stored)
      }
    } catch (error) {
      logger.error('加载使用次数失败', error as Error)
      this.usageCount = {}
    }
  }

  private saveUsageCount(): void {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(this.usageCount))
    } catch (error) {
      logger.error('保存使用次数失败', error as Error)
    }
  }

  private updatePresetsMetadata(): void {
    // 更新内置预设的元数据
    this.builtinPresets = this.builtinPresets.map((preset) => ({
      ...preset,
      usageCount: this.usageCount[preset.id] || 0,
      isFavorite: this.favoriteIds.has(preset.id)
    }))

    // 更新用户预设的元数据
    this.userPresets = this.userPresets.map((preset) => ({
      ...preset,
      usageCount: this.usageCount[preset.id] || 0,
      isFavorite: this.favoriteIds.has(preset.id)
    }))
  }

  private updatePresetFavoriteStatus(id: string, isFavorite: boolean): void {
    const builtinIndex = this.builtinPresets.findIndex((p) => p.id === id)
    if (builtinIndex !== -1) {
      this.builtinPresets[builtinIndex] = {
        ...this.builtinPresets[builtinIndex],
        isFavorite
      }
    }

    const userIndex = this.userPresets.findIndex((p) => p.id === id)
    if (userIndex !== -1) {
      this.userPresets[userIndex] = {
        ...this.userPresets[userIndex],
        isFavorite
      }
      this.saveUserPresets()
    }
  }

  private updatePresetUsageCount(id: string): void {
    const count = this.usageCount[id] || 0

    const builtinIndex = this.builtinPresets.findIndex((p) => p.id === id)
    if (builtinIndex !== -1) {
      this.builtinPresets[builtinIndex] = {
        ...this.builtinPresets[builtinIndex],
        usageCount: count
      }
    }

    const userIndex = this.userPresets.findIndex((p) => p.id === id)
    if (userIndex !== -1) {
      this.userPresets[userIndex] = {
        ...this.userPresets[userIndex],
        usageCount: count
      }
      this.saveUserPresets()
    }
  }

  private sortPresets(presets: StudioPreset[], options: PresetSortOptions): StudioPreset[] {
    const { sortBy, ascending } = options
    const sorted = [...presets]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'usageCount':
          comparison = a.usageCount - b.usageCount
          break
        case 'createdAt':
          comparison = a.createdAt - b.createdAt
          break
        case 'updatedAt':
          comparison = a.updatedAt - b.updatedAt
          break
      }

      return ascending ? comparison : -comparison
    })

    return sorted
  }
}

export const presetMarketService = PresetMarketService.getInstance()
export default presetMarketService
