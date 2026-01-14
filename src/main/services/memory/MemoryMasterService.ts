/**
 * MemoryMasterService - 记忆大师服务
 *
 * 基于 VCPToolBox 概念设计的智能记忆管理服务：
 * - 自动补标：AI 分析内容生成高质量标签
 * - 批量整理：事件合并、结构优化、语法去冗余
 * - 标签池管理：维护全局标签一致性
 * - 模型可配置：用户可选择 AI 模型
 * - TagMemo 集成：标签学习同步到统一记忆系统
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { getTagMemoService, type TagMemoService } from '@main/knowledge/tagmemo'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('MemoryMaster')

// ==================== 类型定义 ====================

/**
 * 标签生成选项
 */
export interface AutoTagOptions {
  /** 已存在的标签 */
  existingTags?: string[]
  /** 作者风格描述 */
  authorStyle?: string
  /** 最大标签数量 */
  maxTags?: number
  /** 标签语言 */
  language?: 'zh' | 'en' | 'auto'
  /** 使用的 AI 模型 ID */
  modelId?: string
  /** 使用的 Provider ID */
  providerId?: string
}

/**
 * 批量整理选项
 */
export interface BatchOrganizeOptions {
  /** 开始日期 */
  startDate?: Date
  /** 结束日期 */
  endDate?: Date
  /** 整理任务类型 */
  tasks: Array<'merge' | 'summarize' | 'deduplicate' | 'tag'>
  /** AI 模型 ID */
  modelId?: string
  /** Provider ID */
  providerId?: string
}

/**
 * 批量整理结果
 */
export interface OrganizeResult {
  success: boolean
  message: string
  processedCount: number
  mergedCount?: number
  taggedCount?: number
  errors?: string[]
}

/**
 * 标签统计
 */
export interface TagStats {
  tag: string
  count: number
  lastUsed: Date
}

/**
 * 记忆大师配置
 */
export interface MemoryMasterConfig {
  /** 是否启用自动补标 */
  autoTagEnabled: boolean
  /** 默认 AI 模型 ID */
  defaultModelId?: string
  /** 默认 Provider ID */
  defaultProviderId?: string
  /** 最大标签数量 */
  maxTags: number
  /** 标签格式规范 */
  tagFormat: 'lowercase' | 'kebab-case' | 'original'
  /** 是否启用标签建议 */
  suggestionsEnabled: boolean
  /** 标签黑名单 (逗号分隔的字符串或数组) - 匹配 VCPToolBox TAG_BLACKLIST */
  tagBlacklist: string[]
  /** 最小内容长度 (低于此长度不触发自动补标) */
  minContentLength: number
  /** 是否启用调用时机优化 (检测现有标签) */
  callTimingOptimization: boolean
}

// ==================== Prompt 模板 ====================

const AUTO_TAG_PROMPT = `你是记忆大师 (Memory Master)，专门负责分析内容并生成高质量标签。

## 分析要求

1. **提取关键实体**
   - 人名、地点、组织、项目名称
   - 关键事件、日期、里程碑

2. **识别主题领域**
   - 工作/生活/学习/社交/健康/娱乐

3. **情感倾向** (可选)
   - 正面/负面/中性

4. **参考已有标签池** (如提供)
   - 优先使用已存在的标签保持一致性
   - 仅在必要时创建新标签

## 标签格式规范

- 全部小写
- 多词使用连字符连接 (kebab-case)
- 不含空格或特殊字符
- 长度 2-30 字符
- 中文标签保持原样

## 输出格式

仅返回 JSON 数组，无其他内容：
["tag1", "tag2", "tag3"]

## 内容分析

{content}

## 已有标签池 (参考)

{existingTags}

## 最大标签数量

{maxTags}
`

const MERGE_EVENTS_PROMPT = `你是记忆大师 (Memory Master)，负责合并相似的日记/笔记内容。

## 任务

将以下多个内容合并为一个连贯、去重、结构化的文档。

## 合并规则

1. 保留所有重要信息，去除重复
2. 按时间或逻辑顺序组织
3. 统一语言风格
4. 保留关键细节、数据和结论

## 输入内容

{contents}

## 输出

合并后的完整内容，使用 Markdown 格式。
`

const DEDUPLICATE_PROMPT = `你是记忆大师 (Memory Master)，负责优化内容结构和去除冗余。

## 任务

优化以下内容，去除冗余信息，保持核心价值。

## 优化规则

1. 删除重复表述
2. 简化冗长句子
3. 保留所有关键信息
4. 优化段落结构
5. 不改变核心语义

## 原始内容

{content}

## 输出

优化后的内容，保持 Markdown 格式。
`

// ==================== MemoryMasterService ====================

export class MemoryMasterService {
  private static instance: MemoryMasterService

  /** 标签池 (缓存) */
  private tagPool: Map<string, TagStats> = new Map()

  /** TagMemo 服务 (单例) - 用于标签学习同步 */
  private tagMemo: TagMemoService | null = null

  /** 配置 */
  private config: MemoryMasterConfig = {
    autoTagEnabled: true,
    maxTags: 10,
    tagFormat: 'kebab-case',
    suggestionsEnabled: true,
    tagBlacklist: [],
    minContentLength: 50,
    callTimingOptimization: true
  }

  /** 黑名单缓存 (Set 便于快速查找) */
  private blacklistSet: Set<string> = new Set()

  /** 数据目录 */
  private dataDir: string

  private constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'Data', 'memory-master')
    this.ensureDataDir()
    this.loadTagPool()
    this.loadBlacklist()
    // TagMemo 延迟初始化，避免循环依赖
    logger.info('MemoryMasterService initialized with TagMemo integration')
  }

  static getInstance(): MemoryMasterService {
    if (!MemoryMasterService.instance) {
      MemoryMasterService.instance = new MemoryMasterService()
    }
    return MemoryMasterService.instance
  }

  // ==================== 自动补标 ====================

  /**
   * 自动生成标签
   * 核心功能：分析内容，使用 AI 生成高质量标签
   *
   * 优化点 (对齐 VCPToolBox):
   * 1. 调用时机优化 - 检测现有标签是否足够
   * 2. 黑名单过滤 - 自动过滤黑名单中的标签
   * 3. 最小内容长度检查
   */
  async autoTag(content: string, options: AutoTagOptions = {}): Promise<string[]> {
    // [调用时机优化] 检查内容长度
    if (!content || content.trim().length < this.config.minContentLength) {
      logger.debug('Content too short for auto-tagging', {
        length: content?.length || 0,
        minLength: this.config.minContentLength
      })
      return []
    }

    // [调用时机优化] 检测现有标签是否足够 (VCPToolBox 风格)
    if (this.config.callTimingOptimization && options.existingTags && options.existingTags.length >= 3) {
      logger.debug('Skipping auto-tag: existing tags sufficient', {
        existingCount: options.existingTags.length
      })
      return []
    }

    const maxTags = options.maxTags || this.config.maxTags
    const existingTagsStr = options.existingTags?.join(', ') || this.getTopTags(50).join(', ') || '无'

    // 构建 prompt
    const prompt = AUTO_TAG_PROMPT.replace('{content}', content.slice(0, 4000)) // 限制长度
      .replace('{existingTags}', existingTagsStr)
      .replace('{maxTags}', String(maxTags))

    try {
      // 调用 AI
      const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
      const bridge = MCPBridge.getInstance()

      const response = await bridge.generateText({
        systemPrompt: '你是一个专业的标签生成助手。仅返回 JSON 数组格式的标签列表。',
        userPrompt: prompt,
        providerId: options.providerId || this.config.defaultProviderId,
        modelId: options.modelId || this.config.defaultModelId
      })

      // 解析响应
      const tags = this.parseTagsFromResponse(response)

      // 格式化标签
      let formattedTags = tags.map((tag) => this.formatTag(tag)).filter((tag) => tag.length >= 2 && tag.length <= 30)

      // [黑名单过滤] 过滤黑名单中的标签
      const beforeFilterCount = formattedTags.length
      formattedTags = this.filterBlacklistedTags(formattedTags)
      if (beforeFilterCount > formattedTags.length) {
        logger.debug('Filtered blacklisted tags', {
          before: beforeFilterCount,
          after: formattedTags.length,
          filtered: beforeFilterCount - formattedTags.length
        })
      }

      // 更新标签池
      for (const tag of formattedTags) {
        this.addTagToPool(tag)
      }

      logger.info('Auto-tagged content', { tagCount: formattedTags.length })
      return formattedTags.slice(0, maxTags)
    } catch (error) {
      logger.error('Failed to auto-tag content', error as Error)
      return []
    }
  }

  /**
   * 验证标签格式
   */
  validateTags(tags: string[]): { valid: boolean; invalidTags: string[]; suggestedTags: string[] } {
    const invalidTags: string[] = []
    const suggestedTags: string[] = []

    for (const tag of tags) {
      if (!this.isValidTag(tag)) {
        invalidTags.push(tag)
        suggestedTags.push(this.formatTag(tag))
      }
    }

    return {
      valid: invalidTags.length === 0,
      invalidTags,
      suggestedTags
    }
  }

  /**
   * 检测内容并建议标签
   */
  async detectAndSuggestTags(
    content: string,
    existingTags: string[] = []
  ): Promise<{
    valid: boolean
    suggestedTags: string[]
    invalidTags: string[]
    needsTagging: boolean
  }> {
    // 验证现有标签
    const validation = this.validateTags(existingTags)

    // 检查是否需要补标
    const needsTagging = existingTags.length === 0 || (existingTags.length < 3 && content.length > 200)

    // 如果需要补标，调用 AI
    let suggestedTags = validation.suggestedTags
    if (needsTagging && this.config.autoTagEnabled) {
      const aiTags = await this.autoTag(content, { existingTags })
      suggestedTags = [...new Set([...suggestedTags, ...aiTags])]
    }

    return {
      valid: validation.valid && !needsTagging,
      suggestedTags,
      invalidTags: validation.invalidTags,
      needsTagging
    }
  }

  // ==================== 批量整理 ====================

  /**
   * 批量整理笔记
   */
  async batchOrganize(notePaths: string[], options: BatchOrganizeOptions): Promise<OrganizeResult> {
    const results: OrganizeResult = {
      success: true,
      message: '',
      processedCount: 0,
      errors: []
    }

    try {
      for (const task of options.tasks) {
        switch (task) {
          case 'tag':
            // 批量补标
            results.taggedCount = await this.batchAutoTag(notePaths, options)
            break
          case 'merge':
            // 合并相似内容 (需要外部传入内容)
            results.mergedCount = 0
            break
          case 'deduplicate':
            // 去重 (需要外部传入内容)
            break
          case 'summarize':
            // 摘要 (需要外部传入内容)
            break
        }
        results.processedCount++
      }

      results.message = `成功处理 ${results.processedCount} 个任务`
    } catch (error) {
      results.success = false
      results.message = `处理失败: ${String(error)}`
      results.errors?.push(String(error))
      logger.error('Batch organize failed', error as Error)
    }

    return results
  }

  /**
   * 批量自动补标
   *
   * @param notePaths 笔记相对路径数组
   * @param options 批量处理选项
   * @returns 成功处理的笔记数量
   */
  private async batchAutoTag(notePaths: string[], options: BatchOrganizeOptions): Promise<number> {
    let taggedCount = 0
    const startTime = Date.now()
    const errors: string[] = []

    // 边界检查
    if (!notePaths || notePaths.length === 0) {
      logger.info('No notes to tag')
      return 0
    }

    // 动态导入 NoteService (避免循环依赖)
    const { getNoteService } = await import('../notes')
    const noteService = getNoteService()

    // 批量大小控制 (避免 API 并发过高)
    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 500
    const batches = this.chunkArray(notePaths, BATCH_SIZE)

    logger.info('Starting batch auto-tag', {
      totalNotes: notePaths.length,
      batchCount: batches.length,
      batchSize: BATCH_SIZE
    })

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      // 并行处理当前批次
      const batchResults = await Promise.allSettled(
        batch.map(async (notePath) => {
          return this.processNoteForTagging(noteService, notePath, options)
        })
      )

      // 统计结果
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          taggedCount++
          if (result.value.tagsAdded > 0) {
            logger.debug('Tags added to note', {
              path: result.value.path,
              tagsAdded: result.value.tagsAdded
            })
          }
        } else if (result.status === 'rejected') {
          errors.push(String(result.reason))
        } else if (result.status === 'fulfilled' && result.value.error) {
          errors.push(result.value.error)
        }
      }

      // 批次间延迟 (避免 API 限流)
      if (batchIndex < batches.length - 1) {
        await this.delay(BATCH_DELAY_MS)
      }
    }

    // 强制保存标签池
    this.forceSave()

    const duration = Date.now() - startTime
    logger.info('Batch auto-tag completed', {
      taggedCount,
      totalNotes: notePaths.length,
      errorCount: errors.length,
      durationMs: duration
    })

    if (errors.length > 0) {
      logger.warn('Some notes failed to process', {
        errors: errors.slice(0, 5), // 只记录前 5 个错误
        totalErrors: errors.length
      })
    }

    return taggedCount
  }

  /**
   * 处理单个笔记的标签生成
   */
  private async processNoteForTagging(
    noteService: import('../notes').NoteService,
    notePath: string,
    options: BatchOrganizeOptions
  ): Promise<{ success: boolean; path: string; tagsAdded: number; error?: string }> {
    try {
      // 1. 读取笔记
      const note = await noteService.read(notePath)
      if (!note) {
        return { success: false, path: notePath, tagsAdded: 0, error: `Note not found: ${notePath}` }
      }

      // 2. 检查内容长度 (少于 10 字符跳过)
      if (!note.content || note.content.trim().length < 10) {
        logger.debug('Skipping note with insufficient content', { path: notePath })
        return { success: true, path: notePath, tagsAdded: 0 } // 算成功但无新标签
      }

      // 3. 获取现有标签
      const existingTags = note.frontmatter.tags || []

      // 4. 调用 autoTag 生成标签
      const newTags = await this.autoTag(note.content, {
        existingTags,
        maxTags: this.config.maxTags,
        modelId: options.modelId || this.config.defaultModelId,
        providerId: options.providerId || this.config.defaultProviderId
      })

      // 5. 合并标签 (去重)
      const mergedTags = [...new Set([...existingTags, ...newTags])]
      const tagsAdded = mergedTags.length - existingTags.length

      // 6. 只有当有新标签时才更新笔记
      if (tagsAdded > 0) {
        await noteService.updateFrontmatter(notePath, { tags: mergedTags })
      }

      return { success: true, path: notePath, tagsAdded }
    } catch (error) {
      logger.error('Failed to process note for tagging', {
        path: notePath,
        error: String(error)
      })
      return { success: false, path: notePath, tagsAdded: 0, error: String(error) }
    }
  }

  /**
   * 数组分块辅助方法
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * 延迟辅助方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 合并多个内容
   */
  async mergeContents(contents: string[], options?: { modelId?: string; providerId?: string }): Promise<string> {
    if (contents.length === 0) return ''
    if (contents.length === 1) return contents[0]

    const prompt = MERGE_EVENTS_PROMPT.replace(
      '{contents}',
      contents.map((c, i) => `### 内容 ${i + 1}\n${c}`).join('\n\n')
    )

    try {
      const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
      const bridge = MCPBridge.getInstance()

      const response = await bridge.generateText({
        systemPrompt: '你是一个专业的内容整理助手。',
        userPrompt: prompt,
        providerId: options?.providerId || this.config.defaultProviderId,
        modelId: options?.modelId || this.config.defaultModelId
      })

      logger.info('Merged contents', { inputCount: contents.length })
      return response
    } catch (error) {
      logger.error('Failed to merge contents', error as Error)
      return contents.join('\n\n---\n\n')
    }
  }

  /**
   * 去除冗余内容
   */
  async deduplicateContent(content: string, options?: { modelId?: string; providerId?: string }): Promise<string> {
    if (!content || content.length < 100) return content

    const prompt = DEDUPLICATE_PROMPT.replace('{content}', content)

    try {
      const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
      const bridge = MCPBridge.getInstance()

      const response = await bridge.generateText({
        systemPrompt: '你是一个专业的内容优化助手。保持原意的同时优化结构。',
        userPrompt: prompt,
        providerId: options?.providerId || this.config.defaultProviderId,
        modelId: options?.modelId || this.config.defaultModelId
      })

      logger.info('Deduplicated content', { originalLength: content.length, newLength: response.length })
      return response
    } catch (error) {
      logger.error('Failed to deduplicate content', error as Error)
      return content
    }
  }

  // ==================== 标签池管理 ====================

  /**
   * 获取标签池
   */
  getTagPool(): string[] {
    return Array.from(this.tagPool.keys())
  }

  /**
   * 获取标签统计
   */
  getTagStats(): TagStats[] {
    return Array.from(this.tagPool.values()).sort((a, b) => b.count - a.count)
  }

  /**
   * 获取 top N 标签
   */
  getTopTags(n: number = 20): string[] {
    return this.getTagStats()
      .slice(0, n)
      .map((s) => s.tag)
  }

  /**
   * 添加标签到标签池
   */
  addTagToPool(tag: string): void {
    const normalizedTag = this.formatTag(tag)
    const existing = this.tagPool.get(normalizedTag)

    if (existing) {
      existing.count++
      existing.lastUsed = new Date()
    } else {
      this.tagPool.set(normalizedTag, {
        tag: normalizedTag,
        count: 1,
        lastUsed: new Date()
      })
    }

    // 同步到 TagMemo (延迟初始化)
    this.syncTagToTagMemo(normalizedTag)

    // 延迟保存
    this.scheduleSave()
  }

  /**
   * 同步标签到 TagMemo
   * 使 TagMemo 的共现矩阵能够学习 AI 生成的标签
   */
  private syncTagToTagMemo(tag: string): void {
    try {
      if (!this.tagMemo) {
        this.tagMemo = getTagMemoService()
      }
      // 注册标签到 TagMemo (如果 TagMemo 支持的话)
      if (this.tagMemo && typeof this.tagMemo.registerTag === 'function') {
        this.tagMemo.registerTag(tag)
      }
    } catch (error) {
      // TagMemo 同步失败不应影响主流程
      logger.debug('TagMemo sync skipped', { tag, error: String(error) })
    }
  }

  /**
   * 同步黑名单到 TagMemo
   * 确保 TagMemo 和 MemoryMaster 共享同一黑名单
   */
  syncBlacklistToTagMemo(): void {
    try {
      if (!this.tagMemo) {
        this.tagMemo = getTagMemoService()
      }
      if (this.tagMemo && typeof this.tagMemo.setBlacklist === 'function') {
        this.tagMemo.setBlacklist(this.config.tagBlacklist)
        logger.info('Blacklist synced to TagMemo', { count: this.config.tagBlacklist.length })
      }
    } catch (error) {
      logger.warn('Failed to sync blacklist to TagMemo', { error: String(error) })
    }
  }

  /**
   * 批量添加标签
   */
  addTagsToPool(tags: string[]): void {
    for (const tag of tags) {
      this.addTagToPool(tag)
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  getConfig(): MemoryMasterConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<MemoryMasterConfig>): void {
    this.config = { ...this.config, ...updates }
    // 如果更新了黑名单，重建缓存
    if (updates.tagBlacklist) {
      this.rebuildBlacklistCache()
    }
    logger.info('Config updated', { config: this.config })
  }

  // ==================== 标签黑名单管理 ====================

  /**
   * 加载黑名单配置
   * 优先从环境变量 TAG_BLACKLIST 读取 (兼容 VCPToolBox)
   */
  private loadBlacklist(): void {
    // 1. 尝试从环境变量读取 (VCPToolBox 兼容)
    const envBlacklist = process.env.TAG_BLACKLIST
    if (envBlacklist) {
      const tags = envBlacklist.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      this.config.tagBlacklist = tags
      logger.info('Loaded tag blacklist from env', { count: tags.length })
    }

    // 2. 尝试从配置文件读取
    try {
      const configPath = path.join(this.dataDir, 'blacklist.json')
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        if (Array.isArray(data.blacklist)) {
          // 合并环境变量和文件配置
          this.config.tagBlacklist = [
            ...new Set([...this.config.tagBlacklist, ...data.blacklist.map((t: string) => t.toLowerCase())])
          ]
        }
      }
    } catch (error) {
      logger.warn('Failed to load blacklist config', { error: String(error) })
    }

    // 3. 重建缓存
    this.rebuildBlacklistCache()

    // 4. 延迟同步到 TagMemo (避免循环初始化)
    setTimeout(() => {
      this.syncBlacklistToTagMemo()
    }, 2000)
  }

  /**
   * 重建黑名单缓存
   */
  private rebuildBlacklistCache(): void {
    this.blacklistSet.clear()
    for (const tag of this.config.tagBlacklist) {
      this.blacklistSet.add(tag.toLowerCase().trim())
    }
    logger.debug('Blacklist cache rebuilt', { size: this.blacklistSet.size })
  }

  /**
   * 检查标签是否在黑名单中
   */
  isTagBlacklisted(tag: string): boolean {
    return this.blacklistSet.has(tag.toLowerCase().trim())
  }

  /**
   * 过滤黑名单标签
   */
  filterBlacklistedTags(tags: string[]): string[] {
    return tags.filter((t) => !this.isTagBlacklisted(t))
  }

  /**
   * 添加标签到黑名单
   */
  addToBlacklist(tags: string[]): void {
    for (const tag of tags) {
      const normalized = tag.toLowerCase().trim()
      if (normalized && !this.blacklistSet.has(normalized)) {
        this.config.tagBlacklist.push(normalized)
        this.blacklistSet.add(normalized)
      }
    }
    this.saveBlacklist()
    this.syncBlacklistToTagMemo()
    logger.info('Tags added to blacklist', { count: tags.length })
  }

  /**
   * 从黑名单移除标签
   */
  removeFromBlacklist(tags: string[]): void {
    const toRemove = new Set(tags.map((t) => t.toLowerCase().trim()))
    this.config.tagBlacklist = this.config.tagBlacklist.filter((t) => !toRemove.has(t))
    this.rebuildBlacklistCache()
    this.saveBlacklist()
    this.syncBlacklistToTagMemo()
    logger.info('Tags removed from blacklist', { count: tags.length })
  }

  /**
   * 获取黑名单
   */
  getBlacklist(): string[] {
    return [...this.config.tagBlacklist]
  }

  /**
   * 保存黑名单到文件
   */
  private saveBlacklist(): void {
    try {
      const configPath = path.join(this.dataDir, 'blacklist.json')
      fs.writeFileSync(configPath, JSON.stringify({ blacklist: this.config.tagBlacklist }, null, 2))
    } catch (error) {
      logger.error('Failed to save blacklist', { error: String(error) })
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 格式化标签
   * 移植自 VCPToolBox: 自动修正中文标点为英文标点
   */
  private formatTag(tag: string): string {
    let formatted = tag.trim().toLowerCase()

    // VCPToolBox 兼容: 中文标点转英文标点
    formatted = this.fixChinesePunctuation(formatted)

    // 移除特殊字符
    formatted = formatted.replace(/[^\w\u4e00-\u9fa5-]/g, '-')

    // 多个连字符合并为一个
    formatted = formatted.replace(/-+/g, '-')

    // 移除首尾连字符
    formatted = formatted.replace(/^-|-$/g, '')

    return formatted
  }

  /**
   * 修正中文标点为英文标点
   * 移植自 VCPToolBox DailyNoteWrite/daily-note-write.js
   */
  private fixChinesePunctuation(text: string): string {
    return text
      .replace(/，/g, ',') // 中文逗号
      .replace(/。/g, '.') // 中文句号
      .replace(/：/g, ':') // 中文冒号
      .replace(/；/g, ';') // 中文分号
      .replace(/！/g, '!') // 中文感叹号
      .replace(/？/g, '?') // 中文问号
      .replace(/（/g, '(') // 中文左括号
      .replace(/）/g, ')') // 中文右括号
      .replace(/【/g, '[') // 中文左方括号
      .replace(/】/g, ']') // 中文右方括号
      .replace(/「/g, '"') // 直角引号
      .replace(/」/g, '"')
      .replace(/『/g, "'")
      .replace(/』/g, "'")
      .replace(/"/g, '"') // 中文引号
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
  }

  /**
   * 验证标签格式
   */
  private isValidTag(tag: string): boolean {
    if (!tag || tag.length < 2 || tag.length > 30) return false
    // 允许小写字母、数字、中文、连字符
    return /^[\w\u4e00-\u9fa5-]+$/.test(tag) && !tag.startsWith('-') && !tag.endsWith('-')
  }

  /**
   * 解析 AI 响应中的标签
   */
  private parseTagsFromResponse(response: string): string[] {
    try {
      // 尝试提取 JSON 数组
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0])
        if (Array.isArray(tags)) {
          return tags.filter((t) => typeof t === 'string')
        }
      }

      // 回退：按行分割
      return response
        .split(/[,，\n]/)
        .map((t) => t.trim().replace(/^["'[\]]+|["'[\]]+$/g, ''))
        .filter((t) => t.length >= 2)
    } catch {
      logger.warn('Failed to parse tags from response')
      return []
    }
  }

  // ==================== 持久化 ====================

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  private getTagPoolPath(): string {
    return path.join(this.dataDir, 'tag-pool.json')
  }

  private saveTimer: NodeJS.Timeout | null = null

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveTagPool()
    }, 5000) // 5 秒后保存
  }

  private loadTagPool(): void {
    try {
      const filePath = this.getTagPoolPath()
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (Array.isArray(data)) {
          for (const item of data) {
            this.tagPool.set(item.tag, {
              tag: item.tag,
              count: item.count || 1,
              lastUsed: new Date(item.lastUsed || Date.now())
            })
          }
        }
        logger.info('Tag pool loaded', { tagCount: this.tagPool.size })
      }
    } catch (error) {
      logger.warn('Failed to load tag pool', error as Error)
    }
  }

  private saveTagPool(): void {
    try {
      const data = Array.from(this.tagPool.values())
      fs.writeFileSync(this.getTagPoolPath(), JSON.stringify(data, null, 2))
      logger.debug('Tag pool saved', { tagCount: data.length })
    } catch (error) {
      logger.error('Failed to save tag pool', error as Error)
    }
  }

  /**
   * 强制保存 (用于应用退出)
   */
  forceSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.saveTagPool()
  }
}

// ==================== 导出 ====================

let serviceInstance: MemoryMasterService | null = null

export function getMemoryMasterService(): MemoryMasterService {
  if (!serviceInstance) {
    serviceInstance = MemoryMasterService.getInstance()
  }
  return serviceInstance
}
