/**
 * RAG 标签管理服务
 *
 * 功能:
 * - 标签 CRUD
 * - 标签关系管理 (共现/层级)
 * - 语义组管理
 * - 标签统计
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('RAGTagsService')

// ==================== 类型定义 ====================

/**
 * RAG 标签
 */
export interface RAGTag {
  id: string
  name: string
  color: string
  count: number // 使用次数
  relatedTags: string[] // 相关标签名
  category?: string // 标签分类
  createdAt: Date
  updatedAt: Date
}

/**
 * 标签关系
 */
export interface TagRelation {
  tag1: string
  tag2: string
  weight: number // 关系强度 (0-1)
  cooccurrenceCount: number // 共现次数
  relationType: 'cooccurrence' | 'hierarchy' | 'synonym' | 'antonym'
}

/**
 * 语义组
 */
export interface SemanticGroup {
  id: string
  name: string
  category: string
  keywords: string[]
  weight: number
  description?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * 标签创建请求
 */
export interface CreateTagRequest {
  name: string
  color?: string
  category?: string
  relatedTags?: string[]
}

/**
 * 标签更新请求
 */
export interface UpdateTagRequest {
  id: string
  name?: string
  color?: string
  category?: string
  relatedTags?: string[]
}

/**
 * 语义组创建请求
 */
export interface CreateSemanticGroupRequest {
  name: string
  category: string
  keywords: string[]
  weight?: number
  description?: string
}

// ==================== 默认颜色 ====================

const TAG_COLORS = [
  '#1890ff', // 蓝色
  '#52c41a', // 绿色
  '#faad14', // 黄色
  '#f5222d', // 红色
  '#722ed1', // 紫色
  '#eb2f96', // 粉色
  '#13c2c2', // 青色
  '#fa8c16' // 橙色
]

// ==================== RAGTagsService ====================

export class RAGTagsService {
  private tags: Map<string, RAGTag> = new Map()
  private relations: Map<string, TagRelation> = new Map()
  private semanticGroups: Map<string, SemanticGroup> = new Map()
  private storagePath: string

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(process.cwd(), 'data', 'rag-tags')
    this.ensureStorageDir()
    this.loadFromDisk()
  }

  // ==================== 标签 CRUD ====================

  /**
   * 创建标签
   */
  async createTag(request: CreateTagRequest): Promise<RAGTag> {
    const { name, color, category, relatedTags = [] } = request

    // 检查是否已存在
    const existing = this.findTagByName(name)
    if (existing) {
      throw new Error(`标签 "${name}" 已存在`)
    }

    const tag: RAGTag = {
      id: this.generateId(),
      name: name.trim(),
      color: color || this.getRandomColor(),
      count: 0,
      relatedTags,
      category,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.tags.set(tag.id, tag)
    await this.saveToDisk()

    logger.info('Tag created', { tagId: tag.id, name: tag.name })
    return tag
  }

  /**
   * 更新标签
   */
  async updateTag(request: UpdateTagRequest): Promise<RAGTag | null> {
    const tag = this.tags.get(request.id)
    if (!tag) {
      return null
    }

    if (request.name !== undefined) tag.name = request.name.trim()
    if (request.color !== undefined) tag.color = request.color
    if (request.category !== undefined) tag.category = request.category
    if (request.relatedTags !== undefined) tag.relatedTags = request.relatedTags
    tag.updatedAt = new Date()

    await this.saveToDisk()

    logger.info('Tag updated', { tagId: tag.id })
    return tag
  }

  /**
   * 删除标签
   */
  async deleteTag(tagId: string): Promise<boolean> {
    const deleted = this.tags.delete(tagId)

    if (deleted) {
      // 删除相关的关系
      for (const [key, relation] of this.relations) {
        const tag = this.tags.get(tagId)
        if (tag && (relation.tag1 === tag.name || relation.tag2 === tag.name)) {
          this.relations.delete(key)
        }
      }

      await this.saveToDisk()
      logger.info('Tag deleted', { tagId })
    }

    return deleted
  }

  /**
   * 获取所有标签
   */
  getAllTags(): RAGTag[] {
    return [...this.tags.values()].sort((a, b) => b.count - a.count)
  }

  /**
   * 按名称查找标签
   */
  findTagByName(name: string): RAGTag | undefined {
    const normalizedName = name.trim().toLowerCase()
    return [...this.tags.values()].find((t) => t.name.toLowerCase() === normalizedName)
  }

  /**
   * 按分类获取标签
   */
  getTagsByCategory(category: string): RAGTag[] {
    return [...this.tags.values()].filter((t) => t.category === category)
  }

  /**
   * 增加标签使用计数
   */
  async incrementTagCount(tagName: string): Promise<void> {
    const tag = this.findTagByName(tagName)
    if (tag) {
      tag.count++
      tag.updatedAt = new Date()
      await this.saveToDisk()
    }
  }

  /**
   * 批量增加标签使用计数
   */
  async incrementTagCounts(tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
      const tag = this.findTagByName(name)
      if (tag) {
        tag.count++
        tag.updatedAt = new Date()
      }
    }
    await this.saveToDisk()
  }

  // ==================== 标签关系 ====================

  /**
   * 记录标签共现
   */
  async recordCooccurrence(tagNames: string[]): Promise<void> {
    if (tagNames.length < 2) return

    // 生成所有标签对
    for (let i = 0; i < tagNames.length; i++) {
      for (let j = i + 1; j < tagNames.length; j++) {
        const key = this.getRelationKey(tagNames[i], tagNames[j])
        const existing = this.relations.get(key)

        if (existing) {
          existing.cooccurrenceCount++
          existing.weight = Math.min(1, existing.weight + 0.05)
        } else {
          this.relations.set(key, {
            tag1: tagNames[i],
            tag2: tagNames[j],
            weight: 0.5,
            cooccurrenceCount: 1,
            relationType: 'cooccurrence'
          })
        }
      }
    }

    // 更新相关标签
    for (const name of tagNames) {
      const tag = this.findTagByName(name)
      if (tag) {
        const related = tagNames.filter((t) => t !== name)
        tag.relatedTags = [...new Set([...tag.relatedTags, ...related])]
      }
    }

    await this.saveToDisk()
  }

  /**
   * 获取相关标签
   */
  getRelatedTags(tagName: string, limit = 10): Array<{ name: string; weight: number }> {
    const results: Array<{ name: string; weight: number }> = []

    for (const relation of this.relations.values()) {
      if (relation.tag1 === tagName) {
        results.push({ name: relation.tag2, weight: relation.weight })
      } else if (relation.tag2 === tagName) {
        results.push({ name: relation.tag1, weight: relation.weight })
      }
    }

    return results.sort((a, b) => b.weight - a.weight).slice(0, limit)
  }

  /**
   * 获取标签关系网络
   */
  getTagNetwork(
    centerTag: string,
    depth = 2
  ): {
    nodes: Array<{ id: string; name: string; weight: number }>
    edges: Array<{ source: string; target: string; weight: number }>
  } {
    const nodes = new Map<string, { id: string; name: string; weight: number }>()
    const edges: Array<{ source: string; target: string; weight: number }> = []
    const visited = new Set<string>()

    const expand = (tagName: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(tagName)) return
      visited.add(tagName)

      const tag = this.findTagByName(tagName)
      if (tag) {
        nodes.set(tag.id, { id: tag.id, name: tag.name, weight: tag.count })
      }

      const related = this.getRelatedTags(tagName, 5)
      for (const r of related) {
        const relatedTag = this.findTagByName(r.name)
        if (relatedTag) {
          nodes.set(relatedTag.id, { id: relatedTag.id, name: relatedTag.name, weight: relatedTag.count })
          edges.push({ source: tagName, target: r.name, weight: r.weight })
          expand(r.name, currentDepth + 1)
        }
      }
    }

    expand(centerTag, 0)

    return {
      nodes: [...nodes.values()],
      edges
    }
  }

  // ==================== 语义组管理 ====================

  /**
   * 创建语义组
   */
  async createSemanticGroup(request: CreateSemanticGroupRequest): Promise<SemanticGroup> {
    const group: SemanticGroup = {
      id: this.generateId(),
      name: request.name.trim(),
      category: request.category.trim(),
      keywords: request.keywords.map((k) => k.trim()),
      weight: request.weight ?? 1.0,
      description: request.description,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.semanticGroups.set(group.id, group)
    await this.saveToDisk()

    logger.info('Semantic group created', { groupId: group.id, name: group.name })
    return group
  }

  /**
   * 更新语义组
   */
  async updateSemanticGroup(
    groupId: string,
    updates: Partial<Omit<SemanticGroup, 'id' | 'createdAt'>>
  ): Promise<SemanticGroup | null> {
    const group = this.semanticGroups.get(groupId)
    if (!group) return null

    if (updates.name !== undefined) group.name = updates.name.trim()
    if (updates.category !== undefined) group.category = updates.category.trim()
    if (updates.keywords !== undefined) group.keywords = updates.keywords.map((k) => k.trim())
    if (updates.weight !== undefined) group.weight = updates.weight
    if (updates.description !== undefined) group.description = updates.description
    group.updatedAt = new Date()

    await this.saveToDisk()

    logger.info('Semantic group updated', { groupId })
    return group
  }

  /**
   * 删除语义组
   */
  async deleteSemanticGroup(groupId: string): Promise<boolean> {
    const deleted = this.semanticGroups.delete(groupId)
    if (deleted) {
      await this.saveToDisk()
      logger.info('Semantic group deleted', { groupId })
    }
    return deleted
  }

  /**
   * 获取所有语义组
   */
  getAllSemanticGroups(): SemanticGroup[] {
    return [...this.semanticGroups.values()]
  }

  /**
   * 按分类获取语义组
   */
  getSemanticGroupsByCategory(category: string): SemanticGroup[] {
    return [...this.semanticGroups.values()].filter((g) => g.category === category)
  }

  /**
   * 通过关键词匹配语义组
   */
  matchSemanticGroups(text: string): SemanticGroup[] {
    const normalizedText = text.toLowerCase()
    const matched: SemanticGroup[] = []

    for (const group of this.semanticGroups.values()) {
      for (const keyword of group.keywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          matched.push(group)
          break
        }
      }
    }

    return matched
  }

  // ==================== 统计 ====================

  /**
   * 获取统计信息
   */
  getStats(): {
    tagCount: number
    relationCount: number
    semanticGroupCount: number
    topTags: Array<{ name: string; count: number }>
    categories: string[]
  } {
    const topTags = [...this.tags.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((t) => ({ name: t.name, count: t.count }))

    const categories = [...new Set([...this.tags.values()].map((t) => t.category).filter(Boolean))] as string[]

    return {
      tagCount: this.tags.size,
      relationCount: this.relations.size,
      semanticGroupCount: this.semanticGroups.size,
      topTags,
      categories
    }
  }

  // ==================== 工具方法 ====================

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex')
  }

  private getRandomColor(): string {
    return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
  }

  private getRelationKey(tag1: string, tag2: string): string {
    // 保证顺序一致
    return [tag1, tag2].sort().join('::')
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true })
    }
  }

  private async saveToDisk(): Promise<void> {
    const data = {
      tags: Object.fromEntries(this.tags),
      relations: Object.fromEntries(this.relations),
      semanticGroups: Object.fromEntries(this.semanticGroups)
    }
    const filePath = path.join(this.storagePath, 'rag-tags.json')
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private loadFromDisk(): void {
    const filePath = path.join(this.storagePath, 'rag-tags.json')
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        if (data.tags) {
          for (const [key, value] of Object.entries(data.tags)) {
            this.tags.set(key, value as RAGTag)
          }
        }
        if (data.relations) {
          for (const [key, value] of Object.entries(data.relations)) {
            this.relations.set(key, value as TagRelation)
          }
        }
        if (data.semanticGroups) {
          for (const [key, value] of Object.entries(data.semanticGroups)) {
            this.semanticGroups.set(key, value as SemanticGroup)
          }
        }

        logger.info('Loaded RAG tags from disk', {
          tagCount: this.tags.size,
          relationCount: this.relations.size,
          groupCount: this.semanticGroups.size
        })
      } catch (error) {
        logger.error('Failed to load RAG tags', { error: String(error) })
      }
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: RAGTagsService | null = null

export function getRAGTagsService(storagePath?: string): RAGTagsService {
  if (!serviceInstance) {
    serviceInstance = new RAGTagsService(storagePath)
  }
  return serviceInstance
}

export function createRAGTagsService(storagePath?: string): RAGTagsService {
  return new RAGTagsService(storagePath)
}
