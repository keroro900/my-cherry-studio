/**
 * DailyNoteWritePlugin - 日记写入 VCP 插件
 *
 * 基于 VCPToolBox DailyNoteWrite 功能的完整实现：
 * - Agent 通过工具调用主动创建/更新日记
 * - 自动调用记忆大师进行智能补标
 * - 支持标签格式校验
 * - 与 NoteService 集成
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { windowService } from '../WindowService'
import { getMemoryMasterService, type MemoryMasterService } from '../memory/MemoryMasterService'
import { getNoteService, type NoteService, type Note, type NoteFrontmatter } from './NoteService'

const logger = loggerService.withContext('DailyNoteWritePlugin')

// ==================== 类型定义 ====================

/**
 * Agent 写入请求参数
 */
export interface AgentWriteParams {
  /** 日记内容 (必填) */
  content: string
  /** 标题 (可选，自动生成) */
  title?: string
  /** 标签 (可选，自动补标) */
  tags?: string[]
  /** 分类/目录 */
  category?: string
  /** 关联笔记路径 */
  linkedNotes?: string[]
  /** 角色名称 (用于多角色场景) */
  characterName?: string
  /** 自定义元数据 */
  metadata?: Record<string, unknown>
  /** 是否跳过自动补标 */
  skipAutoTag?: boolean
  /** AI 模型 ID (用于补标) */
  modelId?: string
  /** Provider ID (用于补标) */
  providerId?: string
  /** 是否同步到知识库/记忆系统 (默认 true) */
  syncToKnowledge?: boolean
}

/**
 * Agent 更新请求参数
 */
export interface AgentUpdateParams {
  /** 目标文件路径 (可选，如不提供则搜索最近的日记) */
  filePath?: string
  /** 搜索关键词 (用于查找目标日记) */
  searchQuery?: string
  /** 角色名称 (用于限制搜索范围) */
  characterName?: string
  /** 需要替换的旧内容 (至少15字符) */
  target: string
  /** 新内容 */
  replace: string
  /** 是否追加到末尾 (当 target 为空时) */
  appendToEnd?: boolean
}

/**
 * Agent 写入结果
 */
export interface AgentWriteResult {
  success: boolean
  note?: Note
  error?: string
  /** 自动生成的标签 */
  generatedTags?: string[]
  /** 标签校验信息 */
  tagValidation?: {
    valid: boolean
    invalidTags: string[]
    suggestedTags: string[]
  }
}

/**
 * Agent 更新结果
 */
export interface AgentUpdateResult {
  success: boolean
  note?: Note
  error?: string
  /** 匹配到的文件路径 */
  matchedPath?: string
  /** 替换次数 */
  replacementCount?: number
}

/**
 * VCP 工具定义
 */
export interface VCPToolDefinition {
  name: string
  displayName: string
  description: string
  params: Array<{
    name: string
    type: 'string' | 'array' | 'boolean' | 'number' | 'object'
    required: boolean
    description?: string
    default?: unknown
  }>
}

// ==================== DailyNoteWritePlugin ====================

export class DailyNoteWritePlugin {
  private static instance: DailyNoteWritePlugin

  private noteService: NoteService | null = null
  private memoryMaster: MemoryMasterService | null = null

  /** 默认配置 */
  private config = {
    /** 默认目录 */
    defaultCategory: 'diary',
    /** 是否启用自动补标 (默认关闭，避免意外触发 AI API 调用) */
    autoTagEnabled: false,
    /** 最小补标内容长度 */
    minAutoTagLength: 50,
    /** 日期格式 */
    dateFormat: 'YYYY-MM-DD'
  }

  private constructor() {
    logger.info('DailyNoteWritePlugin initialized')
  }

  static getInstance(): DailyNoteWritePlugin {
    if (!DailyNoteWritePlugin.instance) {
      DailyNoteWritePlugin.instance = new DailyNoteWritePlugin()
    }
    return DailyNoteWritePlugin.instance
  }

  /**
   * 初始化服务依赖
   */
  private ensureServices(): void {
    if (!this.noteService) {
      this.noteService = getNoteService()
    }
    if (!this.memoryMaster) {
      this.memoryMaster = getMemoryMasterService()
    }
  }

  // ==================== VCP 工具定义 ====================

  /**
   * 获取 VCP 工具定义
   */
  getToolDefinition(): VCPToolDefinition {
    return {
      name: 'DailyNoteWrite',
      displayName: '日记写入',
      description: 'Agent 主动创建或更新日记记录。支持自动补标、标签校验、多目录组织。',
      params: [
        {
          name: 'content',
          type: 'string',
          required: true,
          description: '日记内容 (Markdown 格式)'
        },
        {
          name: 'title',
          type: 'string',
          required: false,
          description: '标题 (可选，默认使用日期)'
        },
        {
          name: 'tags',
          type: 'array',
          required: false,
          description: '标签数组 (可选，会自动补充)'
        },
        {
          name: 'category',
          type: 'string',
          required: false,
          description: '分类目录 (默认 diary)',
          default: 'diary'
        },
        {
          name: 'characterName',
          type: 'string',
          required: false,
          description: '角色名称 (多角色场景)'
        },
        {
          name: 'skipAutoTag',
          type: 'boolean',
          required: false,
          description: '是否跳过自动补标',
          default: false
        }
      ]
    }
  }

  // ==================== 核心功能 ====================

  /**
   * Agent 写入日记
   * 核心入口方法
   */
  async agentWrite(params: AgentWriteParams): Promise<AgentWriteResult> {
    this.ensureServices()

    if (!params.content || params.content.trim().length === 0) {
      return {
        success: false,
        error: '内容不能为空'
      }
    }

    try {
      // 1. 处理标签
      let finalTags = params.tags || []
      let generatedTags: string[] = []
      let tagValidation: AgentWriteResult['tagValidation']

      // 2. 标签校验
      if (finalTags.length > 0 && this.memoryMaster) {
        tagValidation = this.memoryMaster.validateTags(finalTags)

        // 如果有无效标签，使用建议的格式
        if (!tagValidation.valid) {
          logger.warn('Invalid tags detected, using suggestions', {
            invalidTags: tagValidation.invalidTags
          })
          finalTags = finalTags.map((tag) => {
            const idx = tagValidation!.invalidTags.indexOf(tag)
            return idx >= 0 ? tagValidation!.suggestedTags[idx] : tag
          })
        }
      }

      // 3. 自动补标
      if (
        !params.skipAutoTag &&
        this.config.autoTagEnabled &&
        this.memoryMaster &&
        params.content.length >= this.config.minAutoTagLength
      ) {
        const needsTagging = finalTags.length < 3

        if (needsTagging) {
          generatedTags = await this.memoryMaster.autoTag(params.content, {
            existingTags: finalTags,
            modelId: params.modelId,
            providerId: params.providerId,
            maxTags: 10 - finalTags.length
          })

          // 合并标签，去重
          finalTags = [...new Set([...finalTags, ...generatedTags])]
          logger.info('Auto-tagged note', { generatedCount: generatedTags.length })
        }
      }

      // 4. 生成文件路径
      const filePath = this.generateFilePath(params)

      // 5. 构建 frontmatter
      const frontmatter: NoteFrontmatter = {
        title: params.title || this.generateTitle(params.content),
        date: this.formatDate(new Date()),
        tags: finalTags,
        aiGenerated: true,
        characterName: params.characterName,
        ...params.metadata
      }

      // 6. 写入文件
      if (!this.noteService) {
        throw new Error('NoteService not initialized')
      }

      const note = await this.noteService.write(filePath, params.content, frontmatter)

      // 7. 通知前端刷新笔记列表
      this.notifyNotesRefresh(note.filePath)

      // 8. 更新标签池
      if (this.memoryMaster && finalTags.length > 0) {
        this.memoryMaster.addTagsToPool(finalTags)
      }

      // 9. 同步到知识库/记忆系统 (默认启用)
      if (params.syncToKnowledge !== false) {
        await this.syncToKnowledge(note, finalTags, params)
      }

      logger.info('Agent wrote note', {
        path: filePath,
        tagCount: finalTags.length,
        generatedTagCount: generatedTags.length
      })

      return {
        success: true,
        note,
        generatedTags: generatedTags.length > 0 ? generatedTags : undefined,
        tagValidation
      }
    } catch (error) {
      logger.error('Failed to write note', error as Error)
      return {
        success: false,
        error: String(error)
      }
    }
  }

  /**
   * Agent 更新日记
   * 支持通过 target/replace 模式编辑已存在的日记
   */
  async agentUpdate(params: AgentUpdateParams): Promise<AgentUpdateResult> {
    this.ensureServices()

    if (!params.target || params.target.trim().length < 15) {
      return {
        success: false,
        error: '目标内容 (target) 至少需要 15 个字符以确保精确匹配'
      }
    }

    if (!params.replace && params.replace !== '') {
      return {
        success: false,
        error: '替换内容 (replace) 不能为 undefined'
      }
    }

    try {
      if (!this.noteService) {
        throw new Error('NoteService not initialized')
      }

      // 1. 确定目标文件
      let targetPath = params.filePath
      let targetNote: Note | null = null

      if (!targetPath) {
        // 获取所有笔记并按更新时间排序
        const allNotes = await this.noteService.listAll()
        const sortedNotes = allNotes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 20)

        // 如果提供了角色名称，过滤
        let candidates = sortedNotes
        if (params.characterName) {
          const charName = params.characterName
          candidates = sortedNotes.filter(
            (n) => n.frontmatter.characterName === charName || n.filePath.includes(charName)
          )
        }

        // 搜索包含目标内容的文件
        for (const note of candidates) {
          // listAll 返回的 note 可能没有完整 content，需要重新读取
          const fullNote = await this.noteService.read(note.filePath)
          if (fullNote && fullNote.content.includes(params.target)) {
            targetPath = note.filePath
            targetNote = fullNote
            break
          }
        }

        if (!targetPath || !targetNote) {
          return {
            success: false,
            error: `未找到包含目标内容的日记。搜索范围: 最近 20 条${params.characterName ? ` (角色: ${params.characterName})` : ''}`
          }
        }
      } else {
        // 读取指定文件
        targetNote = await this.noteService.read(targetPath)
        if (!targetNote) {
          return {
            success: false,
            error: `无法读取文件: ${targetPath}`
          }
        }
      }

      // 2. 执行替换
      const originalContent = targetNote.content
      if (!originalContent.includes(params.target)) {
        return {
          success: false,
          error: `在文件 ${targetPath} 中未找到目标内容`,
          matchedPath: targetPath
        }
      }

      const newContent = originalContent.replace(params.target, params.replace)
      const replacementCount = (originalContent.match(new RegExp(this.escapeRegExp(params.target), 'g')) || []).length

      // 3. 写入更新后的内容
      const updatedNote = await this.noteService.write(targetPath, newContent, targetNote.frontmatter)

      // 4. 通知前端刷新笔记列表
      this.notifyNotesRefresh(targetPath)

      logger.info('Agent updated note', {
        path: targetPath,
        replacementCount
      })

      return {
        success: true,
        note: updatedNote,
        matchedPath: targetPath,
        replacementCount
      }
    } catch (error) {
      logger.error('Failed to update note', error as Error)
      return {
        success: false,
        error: String(error)
      }
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 执行 VCP 工具调用
   * 用于 VCP 运行时集成
   */
  async execute(params: Record<string, unknown>): Promise<{
    success: boolean
    output: string
    data?: unknown
  }> {
    const result = await this.agentWrite({
      content: String(params.content || ''),
      title: params.title ? String(params.title) : undefined,
      tags: Array.isArray(params.tags) ? params.tags.map(String) : undefined,
      category: params.category ? String(params.category) : undefined,
      characterName: params.characterName ? String(params.characterName) : undefined,
      skipAutoTag: Boolean(params.skipAutoTag)
    })

    if (result.success && result.note) {
      return {
        success: true,
        output: `日记已保存: ${result.note.filePath}`,
        data: {
          filePath: result.note.filePath,
          title: result.note.title,
          tags: result.note.frontmatter.tags,
          generatedTags: result.generatedTags
        }
      }
    } else {
      return {
        success: false,
        output: `写入失败: ${result.error}`
      }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 通知前端刷新笔记列表
   */
  private notifyNotesRefresh(filePath?: string): void {
    try {
      const mainWindow = windowService.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannel.Note_Refresh, { filePath })
        logger.debug('Notified frontend to refresh notes', { filePath })
      }
    } catch (error) {
      logger.warn('Failed to notify notes refresh', { error: String(error) })
    }
  }

  /**
   * 同步笔记到知识库/记忆系统
   *
   * 重构说明:
   * - 直接使用 UnifiedStorageCore.insertChunk 写入 SQLite
   * - 不再通过 createMemory({ backend: 'diary' }) 避免循环调用
   * - 确保日记数据同时存在于 Markdown 文件和 SQLite chunks 表
   *
   * 数据流:
   * agentWrite() → 写入 Markdown 文件
   *             → syncToKnowledge() → 直接写入 SQLite (source='diary')
   */
  private async syncToKnowledge(note: Note, tags: string[], params: AgentWriteParams): Promise<void> {
    try {
      // 直接使用 UnifiedStorageCore 写入 SQLite，避免 createMemory 的循环调用问题
      const { getUnifiedStorage } = await import('@main/storage')
      const storage = getUnifiedStorage()

      // 确保存储已初始化
      await storage.initialize()

      // 直接插入到 chunks 表 (source='diary')
      const chunkId = await storage.insertChunk({
        content: note.content,
        source: 'diary',
        sourceId: params.characterName || params.category || 'default', // 用于日记本分组
        tags,
        metadata: {
          noteId: note.id,
          filePath: note.filePath,
          title: note.title,
          characterName: params.characterName,
          category: params.category,
          createdBy: 'DailyNoteWritePlugin',
          syncedAt: new Date().toISOString(),
          ...params.metadata
        }
      })

      logger.info('Note synced to SQLite chunks table', {
        noteId: note.id,
        chunkId,
        filePath: note.filePath,
        source: 'diary'
      })
    } catch (error) {
      // 同步失败不阻断主流程
      logger.warn('Failed to sync note to SQLite', {
        noteId: note.id,
        error: String(error)
      })
    }
  }

  /**
   * 生成文件路径
   */
  private generateFilePath(params: AgentWriteParams): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const timestamp = date.getTime()

    const category = params.category || this.config.defaultCategory
    const characterPrefix = params.characterName ? `${params.characterName}-` : ''
    const titleSlug = params.title ? this.slugify(params.title) : `note-${timestamp}`

    // 格式: category/YYYY/MM/[character-]title-or-timestamp.md
    return `${category}/${year}/${month}/${characterPrefix}${day}-${titleSlug}.md`
  }

  /**
   * 生成标题
   */
  private generateTitle(content: string): string {
    // 提取第一行非空文本作为标题
    const firstLine = content
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim()

    if (firstLine) {
      // 移除 Markdown 标记
      const cleanLine = firstLine
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .trim()
      // 截断过长的标题
      return cleanLine.length > 50 ? cleanLine.slice(0, 50) + '...' : cleanLine
    }

    return `笔记 ${this.formatDate(new Date())}`
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 生成 URL 友好的 slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  }

  // ==================== 批量同步 ====================

  /**
   * 批量同步现有日记到 SQLite
   *
   * 用于将已存在的 Markdown 日记文件同步到 SQLite chunks 表
   * 以便向量搜索能够检索到这些内容
   *
   * @param options - 同步选项
   * @returns 同步结果
   */
  async syncAllExistingToSQLite(options?: {
    /** 只同步特定目录 */
    category?: string
    /** 进度回调 */
    onProgress?: (current: number, total: number, note: Note) => void
  }): Promise<{
    success: boolean
    synced: number
    skipped: number
    errors: string[]
  }> {
    // 确保服务已初始化
    this.ensureServices()

    const { category, onProgress } = options || {}
    const errors: string[] = []
    let synced = 0
    let skipped = 0

    try {
      if (!this.noteService) {
        throw new Error('NoteService not initialized')
      }

      // 获取所有日记
      const allNotes = await this.noteService.listAll()
      const notesToSync = category
        ? allNotes.filter((n) => n.filePath.startsWith(category))
        : allNotes

      logger.info('Starting batch sync of existing notes to SQLite', {
        total: notesToSync.length,
        category
      })

      // 获取存储实例
      const { getUnifiedStorage } = await import('@main/storage')
      const storage = getUnifiedStorage()
      await storage.initialize()

      // 检查哪些已经同步过 (通过 noteId 查重)
      const db = (storage as any).db
      const existingNoteIds = new Set<string>()

      if (db) {
        try {
          const result = await db.execute(
            `SELECT DISTINCT json_extract(metadata, '$.noteId') as noteId
             FROM chunks
             WHERE source = 'diary' AND json_extract(metadata, '$.noteId') IS NOT NULL`
          )
          for (const row of result.rows) {
            if (row.noteId) existingNoteIds.add(row.noteId as string)
          }
        } catch {
          // 忽略查询错误，继续同步
        }
      }

      // 逐个同步
      for (let i = 0; i < notesToSync.length; i++) {
        const note = notesToSync[i]

        // 跳过已同步的
        if (existingNoteIds.has(note.id)) {
          skipped++
          continue
        }

        try {
          // 提取标签
          const tags = note.frontmatter.tags || []

          // 写入 SQLite
          await storage.insertChunk({
            content: note.content,
            source: 'diary',
            sourceId: note.frontmatter.characterName || note.filePath.split('/')[0] || 'default',
            tags,
            metadata: {
              noteId: note.id,
              filePath: note.filePath,
              title: note.title,
              characterName: note.frontmatter.characterName,
              aiGenerated: note.frontmatter.aiGenerated,
              createdAt: note.createdAt.toISOString(),
              syncedAt: new Date().toISOString(),
              batchSync: true
            }
          })

          synced++
          onProgress?.(i + 1, notesToSync.length, note)
        } catch (error) {
          errors.push(`${note.filePath}: ${String(error)}`)
        }
      }

      logger.info('Batch sync completed', { synced, skipped, errors: errors.length })

      return {
        success: errors.length === 0,
        synced,
        skipped,
        errors
      }
    } catch (error) {
      logger.error('Batch sync failed', error as Error)
      return {
        success: false,
        synced,
        skipped,
        errors: [String(error)]
      }
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * 获取配置
   */
  getConfig(): typeof this.config {
    return { ...this.config }
  }
}

// ==================== 导出 ====================

let pluginInstance: DailyNoteWritePlugin | null = null

export function getDailyNoteWritePlugin(): DailyNoteWritePlugin {
  if (!pluginInstance) {
    pluginInstance = DailyNoteWritePlugin.getInstance()
  }
  return pluginInstance
}

/**
 * VCP 工具执行入口
 * 用于 VCP 运行时直接调用
 */
export async function executeDailyNoteWrite(params: Record<string, unknown>): Promise<{
  success: boolean
  output: string
  data?: unknown
}> {
  return getDailyNoteWritePlugin().execute(params)
}
