/**
 * NoteService - 统一笔记服务
 *
 * 融合原生笔记功能与 VCP 日记能力:
 * - 原生: Markdown 文件存储 + 目录树
 * - VCP: AI 写入 (DailyNoteWrite) + AI 整理 (DailyNoteManager)
 *
 * 使用 YAML frontmatter 存储元数据 (tags, date, aiGenerated 等)
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import {
  createChineseSearchEngine,
  isChineseSearchEngineAvailable,
  type ChineseSearchResult,
  type IChineseSearchEngine
} from '../../knowledge/vector/VexusAdapter'
import { mcpBridge } from '../../mcpServers/shared/MCPBridge'
import { getNotesDir } from '../../utils/file'

const logger = loggerService.withContext('NoteService')

// ==================== 类型定义 ====================

/**
 * 笔记元数据 (存储在 YAML frontmatter)
 */
export interface NoteFrontmatter {
  id?: string
  title?: string
  date?: string // YYYY-MM-DD
  tags?: string[]
  aiGenerated?: boolean
  characterName?: string // VCP 角色名
  isPublic?: boolean
  archived?: boolean
  [key: string]: unknown
}

/**
 * 笔记对象
 */
export interface Note {
  id: string
  filePath: string // 相对路径
  absolutePath: string
  title: string
  content: string // 不含 frontmatter
  frontmatter: NoteFrontmatter
  createdAt: Date
  updatedAt: Date
}

/**
 * AI 写入请求
 */
export interface AIWriteRequest {
  prompt: string
  title?: string
  tags?: string[]
  characterName?: string // 可选的角色名
  targetFolder?: string // 目标文件夹
}

/**
 * AI 整理任务
 */
export interface AIOrganizeTask {
  type: 'summarize' | 'tag' | 'merge' | 'split'
  notePaths: string[]
  options?: Record<string, unknown>
}

// ==================== NoteService ====================

export class NoteService {
  private notesPath: string
  private searchEngine: IChineseSearchEngine | null = null
  private searchIndexPath: string
  private isSearchIndexInitialized: boolean = false

  constructor(notesPath: string) {
    this.notesPath = notesPath
    this.searchIndexPath = path.join(notesPath, '.search-index')
  }

  /**
   * 设置笔记根目录
   */
  setNotesPath(notesPath: string): void {
    this.notesPath = notesPath
    this.searchIndexPath = path.join(notesPath, '.search-index')
    // 重置搜索引擎，下次搜索时重新初始化
    this.searchEngine = null
    this.isSearchIndexInitialized = false
    logger.info('Notes path updated', { notesPath })
  }

  // ==================== 搜索引擎集成 ====================

  /**
   * 关闭搜索引擎 (释放锁)
   */
  closeSearchEngine(): void {
    if (this.searchEngine) {
      try {
        // 尝试 commit 任何待处理的更改
        this.searchEngine.commit()
      } catch {
        // 忽略 commit 错误
      }
      this.searchEngine = null
      this.isSearchIndexInitialized = false
      logger.info('Search engine closed')
    }
  }

  /**
   * 清理索引锁文件 (用于恢复锁定状态)
   * 增强版：尝试清理所有可能的锁文件
   */
  private async clearLockFile(): Promise<boolean> {
    const lockFiles = [
      path.join(this.searchIndexPath, '.tantivy-writer.lock'),
      path.join(this.searchIndexPath, '.tantivy-meta.lock'),
      path.join(this.searchIndexPath, 'meta.json.lock')
    ]

    let cleared = false
    for (const lockPath of lockFiles) {
      try {
        if (fs.existsSync(lockPath)) {
          await fs.promises.unlink(lockPath)
          logger.warn('Cleared stale lock file', { path: lockPath })
          cleared = true
        }
      } catch (error) {
        logger.warn('Failed to clear lock file', { path: lockPath, error: String(error) })
      }
    }
    return cleared
  }

  /**
   * 带重试的搜索引擎创建
   */
  private async createSearchEngineWithRetry(maxRetries = 3): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.searchEngine = createChineseSearchEngine(this.searchIndexPath)
        return
      } catch (error: any) {
        lastError = error
        const isLockError = error?.message?.includes('LockBusy') || error?.message?.includes('index lock')

        if (isLockError && attempt < maxRetries) {
          logger.warn(`Search engine creation failed (attempt ${attempt}/${maxRetries}), retrying...`, {
            error: error?.message
          })

          // 尝试清理锁文件
          await this.clearLockFile()

          // 指数退避等待
          const waitTime = 100 * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        } else {
          throw error
        }
      }
    }

    throw lastError
  }

  /**
   * 初始化搜索索引
   * 启动时调用，批量索引所有现有笔记
   */
  async initializeSearchIndex(): Promise<{ success: boolean; indexed: number; error?: string }> {
    if (!isChineseSearchEngineAvailable()) {
      logger.info('ChineseSearchEngine not available, using fallback search')
      return { success: false, indexed: 0, error: 'Native search engine not available' }
    }

    // 先关闭现有实例
    this.closeSearchEngine()

    try {
      // 删除旧索引目录以确保重建时不会有重复文档
      if (fs.existsSync(this.searchIndexPath)) {
        // 在 Windows 上，可能需要等待文件句柄释放
        await new Promise((resolve) => setTimeout(resolve, 50))
        try {
          await fs.promises.rm(this.searchIndexPath, { recursive: true, force: true })
          logger.info('Removed old search index directory for rebuild')
        } catch (rmError: any) {
          // 如果删除失败，尝试清理锁文件后继续
          logger.warn('Failed to remove old index directory, attempting to clear locks', {
            error: rmError?.message
          })
          await this.clearLockFile()
        }
      }

      // 确保索引目录存在
      await fs.promises.mkdir(this.searchIndexPath, { recursive: true })

      // 使用带重试的搜索引擎创建
      await this.createSearchEngineWithRetry(3)

      if (!this.searchEngine) {
        return { success: false, indexed: 0, error: 'Failed to create search engine' }
      }

      // 批量索引所有笔记
      const notes = await this.listAll()
      const docs = notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.frontmatter.tags
      }))

      const indexed = this.searchEngine.addDocuments(docs)
      this.searchEngine.commit()
      this.isSearchIndexInitialized = true

      logger.info('Search index initialized', { indexed, total: notes.length })
      return { success: true, indexed }
    } catch (error: any) {
      const errorMsg = String(error?.message || error)

      // 提供更友好的错误信息
      if (errorMsg.includes('LockBusy') || errorMsg.includes('index lock')) {
        logger.error('Search index is locked by another process', { error: errorMsg })
        return {
          success: false,
          indexed: 0,
          error: '搜索索引被其他进程占用，请重启应用后重试。如问题持续，请删除索引目录后重试。'
        }
      }

      logger.error('Failed to initialize search index', { error: errorMsg })
      return { success: false, indexed: 0, error: errorMsg }
    }
  }

  /**
   * 确保搜索引擎已初始化
   */
  private async ensureSearchEngine(): Promise<IChineseSearchEngine | null> {
    if (this.searchEngine && this.isSearchIndexInitialized) {
      return this.searchEngine
    }

    // 尝试初始化
    const result = await this.initializeSearchIndex()
    if (result.success) {
      return this.searchEngine
    }

    return null
  }

  /**
   * 更新搜索索引 (单篇笔记)
   */
  private async updateSearchIndex(note: Note): Promise<void> {
    const engine = await this.ensureSearchEngine()
    if (!engine) return

    try {
      // 先删除旧文档
      engine.deleteDocument(note.id)

      // 添加新文档
      engine.addDocuments([
        {
          id: note.id,
          title: note.title,
          content: note.content,
          tags: note.frontmatter.tags
        }
      ])
      engine.commit()

      logger.debug('Search index updated for note', { id: note.id })
    } catch (error) {
      logger.warn('Failed to update search index', { id: note.id, error: String(error) })
    }
  }

  /**
   * 从搜索索引删除笔记
   */
  private async removeFromSearchIndex(noteId: string): Promise<void> {
    const engine = await this.ensureSearchEngine()
    if (!engine) return

    try {
      engine.deleteDocument(noteId)
      engine.commit()
      logger.debug('Note removed from search index', { id: noteId })
    } catch (error) {
      logger.warn('Failed to remove from search index', { id: noteId, error: String(error) })
    }
  }

  /**
   * 全文搜索
   * 使用 Native ChineseSearchEngine (jieba 分词 + tantivy BM25)
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  async fullTextSearch(
    query: string,
    options: {
      limit?: number
      minScore?: number
    } = {}
  ): Promise<Array<Note & { searchScore: number }>> {
    const { limit = 20, minScore = 0.1 } = options

    // 尝试使用 Native 搜索
    const engine = await this.ensureSearchEngine()
    if (engine) {
      try {
        const results: ChineseSearchResult[] = engine.search(query, limit)

        // 过滤低分结果并加载完整笔记
        const notes: Array<Note & { searchScore: number }> = []
        for (const result of results) {
          if (result.score < minScore) continue

          // 通过 ID 查找笔记
          const note = await this.findNoteById(result.id)
          if (note) {
            notes.push({ ...note, searchScore: result.score })
          }
        }

        logger.debug('Native full-text search completed', { query, results: notes.length })
        return notes
      } catch (error) {
        logger.warn('Native search failed, falling back to regex', { error: String(error) })
      }
    }

    // Fallback: 使用正则搜索
    return this.regexSearch(query, limit)
  }

  /**
   * 通过 ID 查找笔记
   */
  private async findNoteById(id: string): Promise<Note | null> {
    let foundNote: Note | null = null

    await this.walkNotes(async (relativePath) => {
      if (foundNote) return // 已找到，跳过

      const note = await this.read(relativePath)
      if (note && note.id === id) {
        foundNote = note
      }
    })

    return foundNote
  }

  /**
   * 正则搜索 (Fallback)
   */
  private async regexSearch(query: string, limit: number): Promise<Array<Note & { searchScore: number }>> {
    const results: Array<Note & { searchScore: number }> = []
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)

    await this.walkNotes(async (relativePath) => {
      if (results.length >= limit) return

      const note = await this.read(relativePath)
      if (!note) return

      const searchText = `${note.title} ${note.content}`.toLowerCase()

      // 计算匹配分数
      let matchCount = 0
      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          matchCount++
        }
      }

      if (matchCount > 0) {
        const score = matchCount / keywords.length
        results.push({ ...note, searchScore: score })
      }
    })

    // 按分数排序
    results.sort((a, b) => b.searchScore - a.searchScore)
    return results.slice(0, limit)
  }

  /**
   * 获取搜索引擎统计信息
   */
  async getSearchStats(): Promise<{
    available: boolean
    initialized: boolean
    documentCount?: number
  }> {
    const available = isChineseSearchEngineAvailable()

    if (!available) {
      return { available: false, initialized: false }
    }

    if (!this.searchEngine || !this.isSearchIndexInitialized) {
      return { available: true, initialized: false }
    }

    try {
      const stats = this.searchEngine.getStats()
      return {
        available: true,
        initialized: true,
        documentCount: stats.documentCount
      }
    } catch {
      return { available: true, initialized: true }
    }
  }

  // ==================== 基础 CRUD ====================

  /**
   * 读取笔记
   */
  async read(relativePath: string): Promise<Note | null> {
    const absolutePath = path.join(this.notesPath, relativePath)

    if (!fs.existsSync(absolutePath)) {
      return null
    }

    try {
      const rawContent = await fs.promises.readFile(absolutePath, 'utf8')
      const { frontmatter, content } = this.parseFrontmatter(rawContent)
      const stats = await fs.promises.stat(absolutePath)

      return {
        id: frontmatter.id || this.generateId(),
        filePath: relativePath,
        absolutePath,
        title: frontmatter.title || path.basename(relativePath, '.md'),
        content,
        frontmatter,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime
      }
    } catch (error) {
      logger.error('Failed to read note', { path: relativePath, error: String(error) })
      return null
    }
  }

  /**
   * 写入/创建笔记
   */
  async write(relativePath: string, content: string, frontmatter: NoteFrontmatter = {}): Promise<Note> {
    const absolutePath = path.join(this.notesPath, relativePath)
    const dir = path.dirname(absolutePath)

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    // 确保有 ID
    if (!frontmatter.id) {
      frontmatter.id = this.generateId()
    }

    // 生成带 frontmatter 的内容
    const fullContent = this.generateFrontmatter(frontmatter) + content

    await fs.promises.writeFile(absolutePath, fullContent, 'utf8')

    const stats = await fs.promises.stat(absolutePath)

    logger.info('Note written', { path: relativePath })

    const note: Note = {
      id: frontmatter.id,
      filePath: relativePath,
      absolutePath,
      title: frontmatter.title || path.basename(relativePath, '.md'),
      content,
      frontmatter,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime
    }

    // 更新搜索索引
    await this.updateSearchIndex(note)

    return note
  }

  /**
   * 更新笔记元数据
   */
  async updateFrontmatter(relativePath: string, updates: Partial<NoteFrontmatter>): Promise<Note | null> {
    const note = await this.read(relativePath)
    if (!note) return null

    const newFrontmatter = { ...note.frontmatter, ...updates }
    return this.write(relativePath, note.content, newFrontmatter)
  }

  /**
   * 删除笔记
   */
  async delete(relativePath: string): Promise<boolean> {
    const absolutePath = path.join(this.notesPath, relativePath)

    if (!fs.existsSync(absolutePath)) {
      return false
    }

    // 先读取笔记获取 ID，用于从搜索索引删除
    const note = await this.read(relativePath)
    const noteId = note?.id

    await fs.promises.unlink(absolutePath)
    logger.info('Note deleted', { path: relativePath })

    // 从搜索索引删除
    if (noteId) {
      await this.removeFromSearchIndex(noteId)
    }

    return true
  }

  // ==================== AI 写入 (VCP DailyNoteWrite) ====================

  /**
   * AI 辅助写入笔记
   */
  async aiWrite(request: AIWriteRequest): Promise<Note> {
    const { prompt, title, tags = [], characterName, targetFolder = '' } = request

    // 调用 LLM 生成内容
    const systemPrompt = characterName
      ? `你是 ${characterName}，正在写日记。请以第一人称视角，用自然、生动的语言记录内容。`
      : '你是一个写作助手，帮助用户创建高质量的笔记内容。'

    const generatedContent = await mcpBridge.generateText({
      systemPrompt,
      userPrompt: prompt
    })

    // 生成文件名
    const date = new Date().toISOString().split('T')[0]
    const safeTitle = (title || '笔记').replace(/[<>:"/\\|?*]/g, '_')
    const fileName = `${date}-${safeTitle}.md`
    const relativePath = path.join(targetFolder, fileName)

    // 写入笔记
    const note = await this.write(relativePath, generatedContent, {
      title: title || safeTitle,
      date,
      tags,
      aiGenerated: true,
      characterName
    })

    logger.info('AI note written', { path: relativePath, characterName })

    return note
  }

  // ==================== AI 整理 (VCP DailyNoteManager) ====================

  /**
   * AI 辅助整理笔记
   */
  async aiOrganize(task: AIOrganizeTask): Promise<{ success: boolean; message: string; result?: unknown }> {
    const { type, notePaths, options } = task

    switch (type) {
      case 'summarize':
        return this.aiSummarize(notePaths)

      case 'tag': {
        // 使用增强版自动打标签
        const result = await this.aiAutoTagEnhanced(notePaths, options as Parameters<typeof this.aiAutoTagEnhanced>[1])
        return { success: result.success, message: result.message }
      }

      case 'merge':
        return this.aiMerge(notePaths, options?.newTitle as string | undefined)

      case 'split':
        return this.aiSplit(notePaths[0])

      default:
        return { success: false, message: `Unknown task type: ${type}` }
    }
  }

  /**
   * AI 生成摘要
   */
  private async aiSummarize(notePaths: string[]): Promise<{ success: boolean; message: string; result?: Note }> {
    const notes: Note[] = []

    for (const p of notePaths) {
      const note = await this.read(p)
      if (note) notes.push(note)
    }

    if (notes.length === 0) {
      return { success: false, message: '未找到指定笔记' }
    }

    try {
      const contentToSummarize = notes.map((n) => `## ${n.title}\n${n.content}`).join('\n\n---\n\n')

      const summary = await mcpBridge.generateText({
        systemPrompt: '你是一个知识管理助手，请生成简洁、信息丰富的摘要。',
        userPrompt: `请为以下 ${notes.length} 篇笔记生成综合摘要（不超过 300 字）：\n\n${contentToSummarize}`
      })

      // 收集所有标签
      const allTags = [...new Set(notes.flatMap((n) => n.frontmatter.tags || []))]
      allTags.push('auto-summary')

      // 创建摘要笔记
      const date = new Date().toISOString().split('T')[0]
      const summaryPath = `summaries/${date}-摘要.md`

      const summaryNote = await this.write(
        summaryPath,
        `## 摘要\n\n${summary}\n\n---\n\n*基于 ${notes.length} 篇笔记自动生成*\n\n### 原始笔记\n${notes.map((n) => `- ${n.title}`).join('\n')}`,
        {
          title: `摘要 - ${date}`,
          date,
          tags: allTags,
          aiGenerated: true
        }
      )

      return { success: true, message: `成功生成摘要`, result: summaryNote }
    } catch (error) {
      return { success: false, message: `生成摘要失败: ${String(error)}` }
    }
  }

  /**
   * AI 合并笔记
   */
  private async aiMerge(
    notePaths: string[],
    newTitle?: string
  ): Promise<{ success: boolean; message: string; result?: Note }> {
    const notes: Note[] = []

    for (const p of notePaths) {
      const note = await this.read(p)
      if (note) notes.push(note)
    }

    if (notes.length < 2) {
      return { success: false, message: '需要至少 2 篇笔记才能合并' }
    }

    // 按日期排序
    notes.sort((a, b) => {
      const dateA = a.frontmatter.date || a.createdAt.toISOString()
      const dateB = b.frontmatter.date || b.createdAt.toISOString()
      return dateA.localeCompare(dateB)
    })

    // 合并内容
    const mergedContent = notes.map((n) => `## ${n.title}\n\n${n.content}`).join('\n\n---\n\n')

    // 合并标签
    const allTags = [...new Set(notes.flatMap((n) => n.frontmatter.tags || []))]

    // 生成合并后的笔记
    const date = new Date().toISOString().split('T')[0]
    const title = newTitle || `合并笔记 - ${date}`
    const mergePath = `merged/${date}-${title.replace(/[<>:"/\\|?*]/g, '_')}.md`

    const mergedNote = await this.write(mergePath, mergedContent, {
      title,
      date,
      tags: allTags,
      aiGenerated: false
    })

    // 删除原笔记
    for (const note of notes) {
      await this.delete(note.filePath)
    }

    return { success: true, message: `成功合并 ${notes.length} 篇笔记`, result: mergedNote }
  }

  /**
   * AI 拆分笔记
   */
  private async aiSplit(notePath: string): Promise<{ success: boolean; message: string }> {
    const note = await this.read(notePath)
    if (!note) {
      return { success: false, message: '笔记不存在' }
    }

    // 按二级标题拆分
    const sections = note.content.split(/(?=^## )/m).filter((s) => s.trim())

    if (sections.length < 2) {
      return { success: false, message: '笔记没有足够的章节可拆分' }
    }

    const dir = path.dirname(notePath)
    const baseName = path.basename(notePath, '.md')
    let count = 0

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim()
      const titleMatch = section.match(/^## (.+)$/m)
      const sectionTitle = titleMatch ? titleMatch[1].trim() : `${baseName}-${i + 1}`

      const newPath = path.join(dir, `${baseName}-${i + 1}-${sectionTitle.replace(/[<>:"/\\|?*]/g, '_')}.md`)

      await this.write(newPath, section, {
        title: sectionTitle,
        tags: note.frontmatter.tags,
        date: note.frontmatter.date
      })
      count++
    }

    // 删除原笔记
    await this.delete(notePath)

    return { success: true, message: `成功拆分为 ${count} 篇笔记` }
  }

  // ==================== 搜索 ====================

  /**
   * 按标签搜索
   */
  async searchByTags(tags: string[]): Promise<Note[]> {
    const results: Note[] = []
    const tagSet = new Set(tags.map((t) => t.toLowerCase()))

    await this.walkNotes(async (relativePath) => {
      const note = await this.read(relativePath)
      if (note && note.frontmatter.tags) {
        if (note.frontmatter.tags.some((t) => tagSet.has(t.toLowerCase()))) {
          results.push(note)
        }
      }
    })

    return results
  }

  /**
   * 获取所有笔记
   */
  async listAll(): Promise<Note[]> {
    const notes: Note[] = []

    await this.walkNotes(async (relativePath) => {
      const note = await this.read(relativePath)
      if (note) notes.push(note)
    })

    return notes
  }

  /**
   * 获取 AI 生成的笔记
   */
  async listAIGenerated(): Promise<Note[]> {
    const all = await this.listAll()
    return all.filter((n) => n.frontmatter.aiGenerated)
  }

  // ==================== 工具方法 ====================

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex')
  }

  private parseFrontmatter(content: string): { frontmatter: NoteFrontmatter; content: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/)

    if (!match) {
      return { frontmatter: {}, content }
    }

    try {
      const yamlContent = match[1]
      const frontmatter: NoteFrontmatter = {}

      // 简单的 YAML 解析
      for (const line of yamlContent.split('\n')) {
        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) continue

        const key = line.slice(0, colonIndex).trim()
        let value: unknown = line.slice(colonIndex + 1).trim()

        // 解析数组
        if (value === '') {
          continue
        } else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
          value = (value as string)
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        } else if (value === 'true') {
          value = true
        } else if (value === 'false') {
          value = false
        } else {
          value = (value as string).replace(/^['"]|['"]$/g, '')
        }

        frontmatter[key] = value
      }

      return {
        frontmatter,
        content: content.slice(match[0].length)
      }
    } catch {
      return { frontmatter: {}, content }
    }
  }

  private generateFrontmatter(data: NoteFrontmatter): string {
    if (Object.keys(data).length === 0) {
      return ''
    }

    const lines = ['---']

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue

      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.map((v) => `"${v}"`).join(', ')}]`)
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value}`)
      } else {
        lines.push(`${key}: "${value}"`)
      }
    }

    lines.push('---\n')
    return lines.join('\n')
  }

  // ==================== Tag 自动检测与格式修复 ====================

  /**
   * 从内容中自动检测标签
   *
   * 支持格式:
   * - 末行 `Tag: tag1, tag2, tag3`
   * - 末行 `Tags: tag1, tag2`
   * - 末行 `标签: tag1, tag2`
   * - 行内 #tag 格式
   * - 方括号 [tag] 格式
   */
  extractTagsFromContent(content: string): string[] {
    const tags: string[] = []

    // 1. 检测末行 Tag:/Tags:/标签: 格式 (VCP 原版风格)
    const lines = content.trim().split('\n')
    const lastLine = lines[lines.length - 1]?.trim() || ''

    const tagLineMatch = lastLine.match(/^(?:Tags?|标签)\s*[:：]\s*(.+)$/i)
    if (tagLineMatch) {
      const tagStr = tagLineMatch[1]
      const lineTags = tagStr
        .split(/[,，、;；\s]+/)
        .map((t) => this.normalizeTag(t))
        .filter((t) => t.length > 0)
      tags.push(...lineTags)
    }

    // 2. 检测 #tag 格式
    const hashTags = content.match(/#[\w\u4e00-\u9fa5]+/g) || []
    for (const ht of hashTags) {
      const tag = this.normalizeTag(ht.slice(1))
      if (tag) tags.push(tag)
    }

    // 3. 检测 [tag] 格式 (排除链接)
    const bracketTags = content.match(/\[([^\][\n]{1,30})\](?!\()/g) || []
    for (const bt of bracketTags) {
      const inner = bt.slice(1, -1)
      // 排除常见的非标签内容
      if (!inner.includes(' ') && !inner.startsWith('http') && !inner.match(/^\d+$/)) {
        const tag = this.normalizeTag(inner)
        if (tag) tags.push(tag)
      }
    }

    // 去重
    return [...new Set(tags)]
  }

  /**
   * 标签格式规范化
   *
   * VCP 原版标准:
   * - 移除标点符号 (句号、逗号、感叹号等)
   * - 转换全角标点为半角
   * - 去除首尾空格
   * - 限制长度 (1-30 字符)
   */
  normalizeTag(tag: string): string {
    if (!tag) return ''

    return (
      tag
        .trim()
        // 移除常见标点
        .replace(/[。，！？、；：""''（）【】《》…·.,!?;:"'()[\]<>]/g, '')
        // 全角转半角数字
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        // 全角转半角字母
        .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        // 移除 # 前缀 (如果有)
        .replace(/^#/, '')
        // 转小写 (可选，保留原大小写)
        .toLowerCase()
        // 限制长度
        .slice(0, 30)
    )
  }

  /**
   * 批量规范化标签
   */
  normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((t) => this.normalizeTag(t)).filter((t) => t.length > 0))]
  }

  /**
   * 增强版 AI 自动打标签
   *
   * 1. 先从内容自动检测标签
   * 2. 如果标签不足，委托给 MemoryMasterService 生成
   * 3. 规范化所有标签格式
   *
   * 已与 MemoryMasterService 统一标签生成入口
   */
  async aiAutoTagEnhanced(
    notePaths: string[],
    options?: {
      minTags?: number // 最少标签数，默认 3
      maxTags?: number // 最多标签数，默认 8
      skipAI?: boolean // 跳过 AI 生成
    }
  ): Promise<{ success: boolean; message: string; processed: number; tagsAdded: number }> {
    const { minTags = 3, maxTags = 8, skipAI = false } = options || {}
    let processedCount = 0
    let totalTagsAdded = 0

    // 动态导入 MemoryMasterService 避免循环依赖
    const { getMemoryMasterService } = await import('../memory/MemoryMasterService')
    const memoryMaster = getMemoryMasterService()

    for (const p of notePaths) {
      const note = await this.read(p)
      if (!note) continue

      try {
        // 1. 从内容检测标签
        const detectedTags = this.extractTagsFromContent(note.content)
        const existingTags = this.normalizeTags(note.frontmatter.tags || [])

        let allTags = [...new Set([...existingTags, ...detectedTags])]

        // 2. 如果标签不足，委托给 MemoryMasterService 生成
        if (!skipAI && allTags.length < minTags) {
          const aiTags = await memoryMaster.autoTag(note.content, {
            existingTags: allTags,
            maxTags: minTags - allTags.length + 2
          })
          allTags = [...new Set([...allTags, ...aiTags])]
        }

        // 3. 限制最大标签数
        if (allTags.length > maxTags) {
          allTags = allTags.slice(0, maxTags)
        }

        // 4. 更新笔记
        const newTagsCount = allTags.length - existingTags.length
        if (newTagsCount > 0) {
          await this.updateFrontmatter(p, { tags: allTags })
          totalTagsAdded += newTagsCount
        }

        processedCount++
      } catch (error) {
        logger.error('Failed to auto-tag note', { path: p, error: String(error) })
      }
    }

    return {
      success: true,
      message: `处理 ${processedCount} 篇笔记，添加 ${totalTagsAdded} 个标签`,
      processed: processedCount,
      tagsAdded: totalTagsAdded
    }
  }

  private async walkNotes(callback: (relativePath: string) => Promise<void>): Promise<void> {
    const walk = async (dir: string, base: string = ''): Promise<void> => {
      if (!fs.existsSync(dir)) return

      const entries = await fs.promises.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const relativePath = path.join(base, entry.name)

        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), relativePath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          await callback(relativePath)
        }
      }
    }

    await walk(this.notesPath)
  }
}

// ==================== 导出 ====================

let serviceInstance: NoteService | null = null

export function getNoteService(notesPath?: string): NoteService {
  if (!serviceInstance) {
    // 使用 getNotesDir() 作为默认路径，确保笔记存储到正确位置
    serviceInstance = new NoteService(notesPath || getNotesDir())
  } else if (notesPath) {
    serviceInstance.setNotesPath(notesPath)
  }
  return serviceInstance
}

export function createNoteService(notesPath: string): NoteService {
  return new NoteService(notesPath)
}
