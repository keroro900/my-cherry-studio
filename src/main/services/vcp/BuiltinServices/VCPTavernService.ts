/**
 * VCPTavernService - 角色卡/WorldBook 注入服务 (内置)
 *
 * 整合原 VCPToolBox VCPTavern 插件功能：
 * - 角色卡管理（列表、激活、导入）
 * - WorldBook 管理（加载、匹配、注入）
 * - Prompt 注入（角色设定、世界书条目）
 *
 * 复用现有 CharacterCardService 和 WorldBookEngine
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getCharacterCardService, type CharacterCardService } from '../../tavern/CharacterCardService'
import { getWorldBookEngine, type WorldBookEngine } from '../../tavern/WorldBookEngine'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'

const logger = loggerService.withContext('VCP:VCPTavernService')

export class VCPTavernService implements IBuiltinService {
  name = 'VCPTavern'
  displayName = '角色卡/WorldBook (内置)'
  description = '角色卡和世界书管理服务：导入、激活角色卡，加载世界书，触发关键词注入。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'roleplay'

  documentation = `# 角色卡/WorldBook 服务

管理 Tavern 格式的角色卡和世界书，支持 Prompt 注入。

## 角色卡功能

### ListCards
列出所有角色卡。

### GetCard
获取角色卡详情。

### ActivateCard
激活角色卡（用于对话）。

### DeactivateCard
停用当前角色卡。

### GetActiveCard
获取当前活跃的角色卡。

### ImportCard
导入角色卡（从 PNG 或 JSON）。

## WorldBook 功能

### MatchWorldBook
在文本中匹配世界书条目。

### GetWorldBookStats
获取世界书统计信息。

### InjectWorldBook
将匹配的条目注入到消息中。

## Prompt 生成

### BuildPrompt
构建完整的角色 Prompt（包含角色设定、世界书）。

### GetCharacterDescription
获取角色描述（用于注入）。

### GetSystemPrompt
获取角色的系统提示词。
`

  configSchema = {
    autoLoadWorldBook: {
      type: 'boolean',
      description: '激活角色卡时自动加载世界书',
      default: true
    },
    worldBookTokenBudget: {
      type: 'number',
      description: '世界书 Token 预算',
      default: 2000
    },
    worldBookScanDepth: {
      type: 'number',
      description: '世界书扫描深度（消息数）',
      default: 10
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ListCards',
      description: `列出所有角色卡。
参数:
- query (字符串, 可选): 搜索关键词
- favoritesOnly (布尔, 可选): 只显示收藏
- limit (数字, 可选): 最大数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」ListCards「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', type: 'string', required: false, description: '搜索关键词' },
        { name: 'favoritesOnly', type: 'boolean', required: false, description: '只显示收藏', default: false },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 50 }
      ]
    },
    {
      commandIdentifier: 'GetCard',
      description: `获取角色卡详情。
参数:
- id (字符串, 必需): 角色卡 ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetCard「末」
id:「始」card_xxx_xxx「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'id', type: 'string', required: true, description: '角色卡 ID' }]
    },
    {
      commandIdentifier: 'ActivateCard',
      description: `激活角色卡，用于当前对话。
参数:
- id (字符串, 必需): 角色卡 ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」ActivateCard「末」
id:「始」card_xxx_xxx「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'id', type: 'string', required: true, description: '角色卡 ID' }]
    },
    {
      commandIdentifier: 'DeactivateCard',
      description: `停用当前活跃的角色卡。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」DeactivateCard「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetActiveCard',
      description: `获取当前活跃的角色卡。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetActiveCard「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'MatchWorldBook',
      description: `在文本中匹配世界书条目。
参数:
- text (字符串, 必需): 要匹配的文本
- bookId (字符串, 可选): 指定世界书 ID（默认使用活跃角色卡的世界书）

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」MatchWorldBook「末」
text:「始」今天去了城堡，遇到了一个魔法师「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要匹配的文本' },
        { name: 'bookId', type: 'string', required: false, description: '世界书 ID' }
      ]
    },
    {
      commandIdentifier: 'GetWorldBookStats',
      description: `获取世界书统计信息。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetWorldBookStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'BuildPrompt',
      description: `构建完整的角色 Prompt。
参数:
- includeDescription (布尔, 可选): 包含角色描述
- includePersonality (布尔, 可选): 包含性格
- includeScenario (布尔, 可选): 包含场景
- includeWorldBook (布尔, 可选): 包含世界书匹配内容
- contextText (字符串, 可选): 用于世界书匹配的上下文

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」BuildPrompt「末」
includeWorldBook:「始」true「末」
contextText:「始」用户的最近消息内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'includeDescription', type: 'boolean', required: false, description: '包含角色描述', default: true },
        { name: 'includePersonality', type: 'boolean', required: false, description: '包含性格', default: true },
        { name: 'includeScenario', type: 'boolean', required: false, description: '包含场景', default: true },
        { name: 'includeWorldBook', type: 'boolean', required: false, description: '包含世界书', default: true },
        { name: 'contextText', type: 'string', required: false, description: '世界书匹配上下文' }
      ]
    },
    {
      commandIdentifier: 'GetCharacterDescription',
      description: `获取当前活跃角色的描述。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetCharacterDescription「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetSystemPrompt',
      description: `获取当前活跃角色的系统提示词。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetSystemPrompt「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetFirstMessage',
      description: `获取当前活跃角色的开场白。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPTavern「末」
command:「始」GetFirstMessage「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    }
  ]

  private config = {
    autoLoadWorldBook: true,
    worldBookTokenBudget: 2000,
    worldBookScanDepth: 10
  }

  private cardService: CharacterCardService | null = null
  private worldBookEngine: WorldBookEngine | null = null

  async initialize(): Promise<void> {
    this.cardService = getCharacterCardService()
    this.worldBookEngine = getWorldBookEngine()
    await this.cardService.initialize()
    logger.info('VCPTavernService initialized')
  }

  setConfig(config: Record<string, unknown>): void {
    if (typeof config.autoLoadWorldBook === 'boolean') {
      this.config.autoLoadWorldBook = config.autoLoadWorldBook
    }
    if (typeof config.worldBookTokenBudget === 'number') {
      this.config.worldBookTokenBudget = config.worldBookTokenBudget
    }
    if (typeof config.worldBookScanDepth === 'number') {
      this.config.worldBookScanDepth = config.worldBookScanDepth
    }
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      if (!this.cardService) {
        this.cardService = getCharacterCardService()
        await this.cardService.initialize()
      }
      if (!this.worldBookEngine) {
        this.worldBookEngine = getWorldBookEngine()
      }

      let result: BuiltinServiceResult

      switch (command) {
        case 'ListCards':
          result = await this.listCards(params)
          break
        case 'GetCard':
          result = await this.getCard(params)
          break
        case 'ActivateCard':
          result = await this.activateCard(params)
          break
        case 'DeactivateCard':
          result = await this.deactivateCard()
          break
        case 'GetActiveCard':
          result = this.getActiveCard()
          break
        case 'MatchWorldBook':
          result = this.matchWorldBook(params)
          break
        case 'GetWorldBookStats':
          result = this.getWorldBookStats()
          break
        case 'BuildPrompt':
          result = this.buildPrompt(params)
          break
        case 'GetCharacterDescription':
          result = this.getCharacterDescription()
          break
        case 'GetSystemPrompt':
          result = this.getSystemPrompt()
          break
        case 'GetFirstMessage':
          result = this.getFirstMessage()
          break
        default:
          result = { success: false, error: `Unknown command: ${command}` }
      }

      return { ...result, executionTimeMs: Date.now() - startTime }
    } catch (error) {
      logger.error('VCPTavernService execution failed', { command, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 角色卡命令 ====================

  private async listCards(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const query = params.query ? String(params.query) : undefined
    const favoritesOnly = Boolean(params.favoritesOnly)
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50))

    const cards = await this.cardService!.list({
      query,
      favoritesOnly,
      limit
    })

    const output =
      cards.length > 0
        ? `角色卡列表 (共 ${cards.length} 个):\n\n${cards.map((c) => `- **${c.name}** (${c.id})${c.favorite ? ' ⭐' : ''}`).join('\n')}`
        : '没有找到角色卡'

    return {
      success: true,
      output,
      data: {
        count: cards.length,
        cards: cards.map((c) => ({
          id: c.id,
          name: c.name,
          tags: c.tags,
          favorite: c.favorite,
          usageCount: c.usageCount
        }))
      }
    }
  }

  private async getCard(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const id = String(params.id || '')

    if (!id) {
      return { success: false, error: '缺少 id 参数' }
    }

    const card = await this.cardService!.get(id)

    if (!card) {
      return { success: false, error: `角色卡不存在: ${id}` }
    }

    return {
      success: true,
      output: `📋 角色卡详情

**名称:** ${card.name}
**ID:** ${card.id}
**描述:** ${card.data.description?.slice(0, 200) || '无'}${(card.data.description?.length || 0) > 200 ? '...' : ''}
**性格:** ${card.data.personality?.slice(0, 100) || '无'}
**标签:** ${card.data.tags?.join(', ') || '无'}
**创建者:** ${card.data.creator || '未知'}
**世界书:** ${card.data.character_book ? `${card.data.character_book.entries.length} 条目` : '无'}`,
      data: {
        id: card.id,
        name: card.name,
        spec: card.spec,
        description: card.data.description,
        personality: card.data.personality,
        scenario: card.data.scenario,
        first_mes: card.data.first_mes,
        system_prompt: card.data.system_prompt,
        tags: card.data.tags,
        creator: card.data.creator,
        hasWorldBook: !!card.data.character_book,
        worldBookEntryCount: card.data.character_book?.entries.length || 0
      }
    }
  }

  private async activateCard(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const id = String(params.id || '')

    if (!id) {
      return { success: false, error: '缺少 id 参数' }
    }

    const card = await this.cardService!.activate(id)

    if (!card) {
      return { success: false, error: `无法激活角色卡: ${id}` }
    }

    return {
      success: true,
      output: `✅ 已激活角色卡: ${card.name}

开场白:
${card.data.first_mes || '(无开场白)'}`,
      data: {
        id: card.id,
        name: card.name,
        first_mes: card.data.first_mes
      }
    }
  }

  private async deactivateCard(): Promise<BuiltinServiceResult> {
    await this.cardService!.deactivate()

    return {
      success: true,
      output: '✅ 已停用当前角色卡'
    }
  }

  private getActiveCard(): BuiltinServiceResult {
    const card = this.cardService!.getActive()

    if (!card) {
      return {
        success: true,
        output: '当前没有活跃的角色卡',
        data: { active: false }
      }
    }

    return {
      success: true,
      output: `当前活跃角色卡: **${card.name}**`,
      data: {
        active: true,
        id: card.id,
        name: card.name
      }
    }
  }

  // ==================== WorldBook 命令 ====================

  private matchWorldBook(params: Record<string, unknown>): BuiltinServiceResult {
    const text = String(params.text || '')
    const bookId = params.bookId ? String(params.bookId) : this.cardService!.getActiveId() || undefined

    if (!text) {
      return { success: false, error: '缺少 text 参数' }
    }

    const matches = this.worldBookEngine!.matchText(text, bookId, {
      scanDepth: this.config.worldBookScanDepth,
      tokenBudget: this.config.worldBookTokenBudget
    })

    if (matches.length === 0) {
      return {
        success: true,
        output: '没有匹配到世界书条目',
        data: { matchCount: 0, matches: [] }
      }
    }

    const output = `🔍 匹配到 ${matches.length} 个世界书条目:\n\n${matches.map((m, i) => `[${i + 1}] **${m.entry.keys.join(', ')}** (优先级: ${m.entry.priority})\n${m.entry.content.slice(0, 100)}...`).join('\n\n')}`

    return {
      success: true,
      output,
      data: {
        matchCount: matches.length,
        matches: matches.map((m) => ({
          id: m.entry.id,
          keys: m.entry.keys,
          matchedKeys: m.matchedKeys,
          score: m.score,
          priority: m.entry.priority,
          content: m.entry.content.slice(0, 200)
        }))
      }
    }
  }

  private getWorldBookStats(): BuiltinServiceResult {
    const stats = this.worldBookEngine!.getStats()
    const books = this.worldBookEngine!.listBooks()

    return {
      success: true,
      output: `📊 世界书统计

已加载世界书: ${stats.bookCount}
总条目数: ${stats.entryCount}
索引关键词: ${stats.keywordCount}

${books.length > 0 ? `世界书列表: ${books.join(', ')}` : ''}`,
      data: stats
    }
  }

  // ==================== Prompt 生成命令 ====================

  private buildPrompt(params: Record<string, unknown>): BuiltinServiceResult {
    const card = this.cardService!.getActive()

    if (!card) {
      return { success: false, error: '没有活跃的角色卡' }
    }

    const includeDescription = params.includeDescription !== false
    const includePersonality = params.includePersonality !== false
    const includeScenario = params.includeScenario !== false
    const includeWorldBook = params.includeWorldBook !== false
    const contextText = params.contextText ? String(params.contextText) : undefined

    const parts: string[] = []

    // 角色描述
    if (includeDescription && card.data.description) {
      parts.push(`## 角色描述\n${card.data.description}`)
    }

    // 性格
    if (includePersonality && card.data.personality) {
      parts.push(`## 性格特点\n${card.data.personality}`)
    }

    // 场景
    if (includeScenario && card.data.scenario) {
      parts.push(`## 场景\n${card.data.scenario}`)
    }

    // 世界书
    if (includeWorldBook && contextText) {
      const matches = this.worldBookEngine!.matchText(contextText, card.id, {
        scanDepth: this.config.worldBookScanDepth,
        tokenBudget: this.config.worldBookTokenBudget
      })

      if (matches.length > 0) {
        const worldBookContent = matches.map((m) => m.entry.content).join('\n\n')
        parts.push(`## 世界设定\n${worldBookContent}`)
      }
    }

    // 系统提示词
    if (card.data.system_prompt) {
      parts.push(`## 指令\n${card.data.system_prompt}`)
    }

    const prompt = parts.join('\n\n---\n\n')

    return {
      success: true,
      output: prompt,
      data: {
        cardId: card.id,
        cardName: card.name,
        sections: {
          description: includeDescription,
          personality: includePersonality,
          scenario: includeScenario,
          worldBook: includeWorldBook
        },
        promptLength: prompt.length
      }
    }
  }

  private getCharacterDescription(): BuiltinServiceResult {
    const card = this.cardService!.getActive()

    if (!card) {
      return { success: false, error: '没有活跃的角色卡' }
    }

    const description = card.data.description || '(无描述)'

    return {
      success: true,
      output: description,
      data: {
        cardId: card.id,
        cardName: card.name,
        description
      }
    }
  }

  private getSystemPrompt(): BuiltinServiceResult {
    const card = this.cardService!.getActive()

    if (!card) {
      return { success: false, error: '没有活跃的角色卡' }
    }

    const systemPrompt = card.data.system_prompt || '(无系统提示词)'

    return {
      success: true,
      output: systemPrompt,
      data: {
        cardId: card.id,
        cardName: card.name,
        systemPrompt
      }
    }
  }

  private getFirstMessage(): BuiltinServiceResult {
    const card = this.cardService!.getActive()

    if (!card) {
      return { success: false, error: '没有活跃的角色卡' }
    }

    const firstMessage = card.data.first_mes || '(无开场白)'

    return {
      success: true,
      output: firstMessage,
      data: {
        cardId: card.id,
        cardName: card.name,
        firstMessage
      }
    }
  }

  async shutdown(): Promise<void> {
    logger.info('VCPTavernService shutdown')
  }
}
