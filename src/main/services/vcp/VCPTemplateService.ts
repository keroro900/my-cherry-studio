/**
 * VCPTemplateService - VCP 模板管理服务
 *
 * 管理 VCP 系统中的提示词模板：
 * - 模板 CRUD 操作
 * - 模板分类管理
 * - 变量插值支持
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { loggerService } from '@main/services/LoggerService'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('VCPTemplateService')

/**
 * 转义正则表达式特殊字符，防止 ReDoS 攻击
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 模板类型定义
export interface PromptTemplate {
  id: string
  name: string
  content: string
  description?: string
  category?: string
  tags?: string[]
  createdAt?: number
  updatedAt?: number
}

// 模板存储
interface TemplateStore {
  templates: PromptTemplate[]
  lastUpdated: number
}

/**
 * VCP 模板管理服务
 */
class VCPTemplateService {
  private static instance: VCPTemplateService
  private templates: Map<string, PromptTemplate> = new Map()
  private storePath: string
  private initialized = false

  private constructor() {
    const userDataPath = electronApp ? electronApp.getPath('userData') : path.join(os.tmpdir(), 'cherry-studio-data')
    this.storePath = path.join(userDataPath, 'Data', 'vcp-templates.json')
  }

  static getInstance(): VCPTemplateService {
    if (!VCPTemplateService.instance) {
      VCPTemplateService.instance = new VCPTemplateService()
    }
    return VCPTemplateService.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.loadFromDisk()
      this.initialized = true
      logger.info('VCPTemplateService initialized', { count: this.templates.size })
    } catch (error) {
      logger.error('Failed to initialize VCPTemplateService', error as Error)
      this.initialized = true
    }
  }

  /**
   * 从磁盘加载模板
   */
  private async loadFromDisk(): Promise<void> {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const store: TemplateStore = JSON.parse(data)
        this.templates.clear()
        for (const template of store.templates) {
          this.templates.set(template.id, template)
        }
      }
    } catch (error) {
      logger.warn('Failed to load templates from disk', error as Error)
    }
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const store: TemplateStore = {
        templates: Array.from(this.templates.values()),
        lastUpdated: Date.now()
      }
      fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2))
    } catch (error) {
      logger.error('Failed to save templates to disk', error as Error)
    }
  }

  /**
   * 获取所有模板
   */
  async list(): Promise<PromptTemplate[]> {
    await this.initialize()
    return Array.from(this.templates.values())
  }

  /**
   * 获取单个模板
   */
  async get(id: string): Promise<PromptTemplate | undefined> {
    await this.initialize()
    return this.templates.get(id)
  }

  /**
   * 根据名称获取模板
   */
  async getByName(name: string): Promise<PromptTemplate | undefined> {
    await this.initialize()
    return Array.from(this.templates.values()).find((t) => t.name === name)
  }

  /**
   * 创建模板
   */
  async create(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
    await this.initialize()

    const now = Date.now()
    const newTemplate: PromptTemplate = {
      ...template,
      id: `tpl_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now
    }

    this.templates.set(newTemplate.id, newTemplate)
    await this.saveToDisk()

    logger.info('Template created', { id: newTemplate.id, name: newTemplate.name })
    return newTemplate
  }

  /**
   * 更新模板
   */
  async update(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | undefined> {
    await this.initialize()

    const existing = this.templates.get(id)
    if (!existing) {
      logger.warn('Template not found for update', { id })
      return undefined
    }

    const updated: PromptTemplate = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }

    this.templates.set(id, updated)
    await this.saveToDisk()

    logger.info('Template updated', { id, name: updated.name })
    return updated
  }

  /**
   * 删除模板
   */
  async delete(id: string): Promise<boolean> {
    await this.initialize()

    if (!this.templates.has(id)) {
      logger.warn('Template not found for delete', { id })
      return false
    }

    this.templates.delete(id)
    await this.saveToDisk()

    logger.info('Template deleted', { id })
    return true
  }

  /**
   * 按分类获取模板
   */
  async listByCategory(category: string): Promise<PromptTemplate[]> {
    await this.initialize()
    return Array.from(this.templates.values()).filter((t) => t.category === category)
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<string[]> {
    await this.initialize()
    const categories = new Set<string>()
    for (const template of this.templates.values()) {
      if (template.category) {
        categories.add(template.category)
      }
    }
    return Array.from(categories)
  }

  /**
   * 渲染模板 (替换变量)
   */
  async render(templateId: string, variables: Record<string, string>): Promise<string | undefined> {
    await this.initialize()

    const template = this.templates.get(templateId)
    if (!template) {
      return undefined
    }

    let result = template.content

    // 替换变量 {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      // 转义 key 中的正则特殊字符，防止 ReDoS 攻击
      const escapedKey = escapeRegExp(key)
      const pattern = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g')
      result = result.replace(pattern, value)
    }

    return result
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number
    byCategory: Record<string, number>
  }> {
    await this.initialize()

    const byCategory: Record<string, number> = {}

    for (const template of this.templates.values()) {
      const category = template.category || 'uncategorized'
      byCategory[category] = (byCategory[category] || 0) + 1
    }

    return {
      total: this.templates.size,
      byCategory
    }
  }

  /**
   * 搜索模板
   */
  async search(query: string): Promise<PromptTemplate[]> {
    await this.initialize()

    const lowerQuery = query.toLowerCase()
    return Array.from(this.templates.values()).filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.content.toLowerCase().includes(lowerQuery) ||
        t.description?.toLowerCase().includes(lowerQuery)
    )
  }
}

export const vcpTemplateService = VCPTemplateService.getInstance()
export default vcpTemplateService
