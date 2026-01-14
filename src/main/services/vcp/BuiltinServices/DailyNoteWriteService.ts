/**
 * DailyNoteWrite 内置服务 (统一日记服务)
 *
 * 整合了以下服务的功能 (使用委托模式):
 * - DailyNoteWriteService: 写入、更新、快速笔记 (原生实现)
 * - DailyNoteService: 读取、列表、搜索、统计 (委托)
 * - RAGDiaryService: RAG检索、时间表达式解析 (委托)
 *
 * 与统一记忆系统集成:
 * - 通过 MemoryMasterService 进行智能补标
 * - 通过 SelfLearningService 记录标签使用
 * - 通过 IntegratedMemoryCoordinator 统一管理
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getDailyNoteWritePlugin } from '../../notes/DailyNoteWritePlugin'
import { getNoteService, type Note } from '../../notes/NoteService'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:DailyNoteWriteService')

export class DailyNoteWriteService implements IBuiltinService {
  name = 'DailyNoteWrite'
  displayName = '统一日记服务 (内置)'
  description = '统一日记服务：创建、更新、读取、搜索、RAG检索、时间表达式解析。整合了 DailyNoteWrite、DailyNote、RAGDiary 三个服务的完整功能。'
  version = '3.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'diary'

  documentation = `# 统一日记服务

整合创建、读取、搜索、RAG检索的完整日记管理服务。

## 核心功能

### 写入功能 (原 DailyNoteWrite)
- **write**: 创建新日记
- **update**: 更新现有日记
- **quickNote**: 快速笔记

### 读取功能 (原 DailyNote)
- **GetNote**: 读取指定日记
- **ListNotes**: 列出日记 (分页、过滤)
- **SearchNotes**: 关键词搜索
- **GetStats**: 统计信息
- **GetByDate**: 按日期获取
- **GetRecent**: 获取最近日记
- **GetByTag**: 按标签获取
- **BatchTag**: 批量添加标签

### RAG 功能 (原 RAGDiary)
- **ParseTime**: 解析时间表达式
- **SearchByTime**: 按时间范围搜索
- **RAGSearch**: RAG 语义检索
- **BatchSearch**: 批量时间搜索
- **GetDiaryContext**: 获取日记上下文

## 集成特性

- **MemoryMasterService**: 智能补标
- **SelfLearningService**: 标签使用学习
- **IntegratedMemoryCoordinator**: 统一记忆管理
- **Native VCP**: BM25/向量搜索、标签共现扩展
- **TimelineGenerator**: 自动生成时间线事件

## 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| defaultCategory | string | diary | 默认分类目录 |
| autoTagEnabled | boolean | false | 启用自动补标 (注意: 会消耗 AI API 额度) |
| minAutoTagLength | number | 50 | 最小补标内容长度 |
| recordToLearning | boolean | true | 记录到学习系统 |
| autoTimelineEnabled | boolean | false | 自动生成时间线事件 (需要 TimelineGenerator 绑定模型) |

## 使用示例

### 写入日记
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天学习了 TypeScript 的高级类型...「末」
tags:「始」学习, TypeScript「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### RAG 搜索
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」最近学习了什么「末」
timeExpression:「始」过去一周「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`
`

  configSchema = {
    defaultCategory: {
      type: 'string',
      description: '默认分类目录',
      default: 'diary'
    },
    autoTagEnabled: {
      type: 'boolean',
      description: '是否启用自动补标 (注意: 会消耗 AI API 额度)',
      default: false
    },
    minAutoTagLength: {
      type: 'number',
      description: '最小补标内容长度',
      default: 50
    },
    recordToLearning: {
      type: 'boolean',
      description: '是否记录到学习系统',
      default: true
    },
    autoTimelineEnabled: {
      type: 'boolean',
      description: '是否自动生成时间线事件 (需要 TimelineGenerator 绑定模型)',
      default: false
    }
  }

  // ==================== 写入相关命令 toolDefinitions ====================
  private writeToolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'write',
      description: `创建新日记：Agent 主动创建日记记录，自动与记忆系统同步。
参数:
- content (字符串, 必需): 日记内容 (Markdown 格式)
- title (字符串, 可选): 标题，默认使用日期
- tags (数组, 可选): 标签数组，会自动补充
- category (字符串, 可选): 分类目录，默认 diary
- characterName (字符串, 可选): 角色名称（多角色场景）
- skipAutoTag (布尔, 可选): 是否跳过自动补标

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天学习了 VCP 插件开发...「末」
tags:「始」VCP, 开发日志「末」
category:「始」development「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'content', description: '日记内容 (Markdown 格式)', required: true, type: 'string' },
        { name: 'title', description: '标题（可选，默认使用日期）', required: false, type: 'string' },
        { name: 'tags', description: '标签数组（可选，会自动补充）', required: false, type: 'array' },
        { name: 'category', description: '分类目录（默认 diary）', required: false, type: 'string', default: 'diary' },
        { name: 'characterName', description: '角色名称（多角色场景）', required: false, type: 'string' },
        { name: 'skipAutoTag', description: '是否跳过自动补标', required: false, type: 'boolean', default: false }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天完成了新功能的开发...「末」
<<<[END_TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'quickNote',
      description: `快速记录：简化的日记写入，自动生成标题和标签。
参数:
- content (字符串, 必需): 笔记内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」quickNote「末」
content:「始」刚刚学到的一个技巧：使用 RRF 融合多个搜索结果可以显著提升召回率「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'content', description: '笔记内容', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'update',
      description: `更新已存在的日记：通过 target/replace 模式编辑日记内容。
参数:
- target (字符串, 必需): 需要替换的旧内容（至少15字符以确保精确匹配）
- replace (字符串, 必需): 新内容
- filePath (字符串, 可选): 目标文件路径，不提供则自动搜索最近的日记
- characterName (字符串, 可选): 角色名称（用于限制搜索范围）

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」update「末」
target:「始」需要替换的旧内容（至少15字符）「末」
replace:「始」新内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'target', description: '需要替换的旧内容（至少15字符）', required: true, type: 'string' },
        { name: 'replace', description: '新内容', required: true, type: 'string' },
        { name: 'filePath', description: '目标文件路径（可选，不提供则自动搜索）', required: false, type: 'string' },
        { name: 'characterName', description: '角色名称（用于限制搜索范围）', required: false, type: 'string' }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」update「末」
target:「始」今天的学习笔记「末」
replace:「始」今天的学习笔记（已更新）「末」
<<<[END_TOOL_REQUEST]>>>`
    }
  ]

  // ==================== 读取相关命令 toolDefinitions (委托 DailyNoteService) ====================
  private readToolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'GetNote',
      description: `读取指定路径的日记内容。
参数:
- path (字符串, 必需): 日记文件相对路径

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetNote「末」
path:「始」diary/2025/01/05-学习笔记.md「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'path', type: 'string', required: true, description: '日记文件相对路径' }]
    },
    {
      commandIdentifier: 'SearchNotes',
      description: `按关键词搜索日记内容。
参数:
- query (字符串, 必需): 搜索关键词
- limit (数字, 可选): 最大结果数，默认 20
- category (字符串, 可选): 限制搜索的目录/分类

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」SearchNotes「末」
query:「始」TypeScript 学习「末」
limit:「始」10「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
        { name: 'limit', type: 'number', required: false, description: '最大结果数', default: 20 },
        { name: 'category', type: 'string', required: false, description: '限制搜索的目录' }
      ]
    },
    {
      commandIdentifier: 'ListNotes',
      description: `列出日记，支持分页和过滤。
参数:
- page (数字, 可选): 页码，从 1 开始，默认 1
- pageSize (数字, 可选): 每页数量，默认 20
- category (字符串, 可选): 目录/分类过滤
- characterName (字符串, 可选): 角色名称过滤
- sortBy (字符串, 可选): 排序字段 (date, title, updatedAt)，默认 updatedAt
- sortOrder (字符串, 可选): 排序顺序 (asc, desc)，默认 desc

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」ListNotes「末」
page:「始」1「末」
pageSize:「始」10「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'page', type: 'number', required: false, description: '页码', default: 1 },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量', default: 20 },
        { name: 'category', type: 'string', required: false, description: '目录过滤' },
        { name: 'characterName', type: 'string', required: false, description: '角色名称过滤' },
        { name: 'sortBy', type: 'string', required: false, description: '排序字段', default: 'updatedAt' },
        { name: 'sortOrder', type: 'string', required: false, description: '排序顺序', default: 'desc' }
      ]
    },
    {
      commandIdentifier: 'GetStats',
      description: `获取日记统计信息。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetByDate',
      description: `获取指定日期的日记。
参数:
- date (字符串, 必需): 日期，格式 YYYY-MM-DD
- characterName (字符串, 可选): 角色名称过滤

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetByDate「末」
date:「始」2025-01-05「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'date', type: 'string', required: true, description: '日期 (YYYY-MM-DD)' },
        { name: 'characterName', type: 'string', required: false, description: '角色名称过滤' }
      ]
    },
    {
      commandIdentifier: 'GetRecent',
      description: `获取最近的日记列表。
参数:
- days (数字, 可选): 最近天数，默认 7
- limit (数字, 可选): 最大数量，默认 20
- characterName (字符串, 可选): 角色名称过滤

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetRecent「末」
days:「始」7「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'days', type: 'number', required: false, description: '最近天数', default: 7 },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 20 },
        { name: 'characterName', type: 'string', required: false, description: '角色名称过滤' }
      ]
    },
    {
      commandIdentifier: 'GetByTag',
      description: `按标签获取日记。
参数:
- tags (字符串, 必需): 标签列表，逗号分隔或 JSON 数组
- matchAll (布尔, 可选): 是否要求匹配所有标签，默认 false
- limit (数字, 可选): 最大数量，默认 20

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetByTag「末」
tags:「始」学习, TypeScript「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'tags', type: 'string', required: true, description: '标签列表' },
        { name: 'matchAll', type: 'boolean', required: false, description: '匹配所有标签', default: false },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 20 }
      ]
    },
    {
      commandIdentifier: 'BatchTag',
      description: `批量为日记添加标签。
参数:
- paths (字符串, 必需): 日记路径列表，逗号分隔或 JSON 数组
- tags (字符串, 必需): 要添加的标签，逗号分隔或 JSON 数组

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」BatchTag「末」
paths:「始」["diary/note1.md", "diary/note2.md"]「末」
tags:「始」学习, 重要「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'paths', type: 'string', required: true, description: '日记路径列表' },
        { name: 'tags', type: 'string', required: true, description: '要添加的标签' }
      ]
    }
  ]

  // ==================== RAG 相关命令 toolDefinitions (委托 RAGDiaryService) ====================
  private ragToolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ParseTime',
      description: `解析时间表达式为具体日期范围。
参数:
- expression (字符串, 必需): 时间表达式，如 "上周"、"过去三个月"、"2024年1月"

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」ParseTime「末」
expression:「始」上周「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'expression', type: 'string', required: true, description: '时间表达式' }]
    },
    {
      commandIdentifier: 'SearchByTime',
      description: `按时间范围搜索日记。
参数:
- timeExpression (字符串, 必需): 时间表达式
- query (字符串, 可选): 额外的搜索关键词
- characterName (字符串, 可选): 角色名称过滤
- limit (数字, 可选): 最大返回数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」SearchByTime「末」
timeExpression:「始」过去一周「末」
query:「始」学习笔记「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'timeExpression', type: 'string', required: true, description: '时间表达式' },
        { name: 'query', type: 'string', required: false, description: '搜索关键词' },
        { name: 'characterName', type: 'string', required: false, description: '角色名称' },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 20 }
      ]
    },
    {
      commandIdentifier: 'RAGSearch',
      description: `使用 RAG 检索日记片段，支持 Native VCP 加速 (BM25 + 向量 + 标签共现扩展 + 精排)。
参数:
- query (字符串, 必需): 检索查询
- timeExpression (字符串, 可选): 限制时间范围
- characterName (字符串, 可选): 角色名称过滤
- topK (数字, 可选): 返回片段数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」RAGSearch「末」
query:「始」我对 TypeScript 的理解「末」
timeExpression:「始」过去三个月「末」
topK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', type: 'string', required: true, description: '检索查询' },
        { name: 'timeExpression', type: 'string', required: false, description: '时间范围' },
        { name: 'characterName', type: 'string', required: false, description: '角色名称' },
        { name: 'topK', type: 'number', required: false, description: '片段数量', default: 5 }
      ]
    },
    {
      commandIdentifier: 'BatchSearch',
      description: `批量搜索多个时间范围。
参数:
- expressions (字符串, 必需): 时间表达式列表，JSON 数组或逗号分隔
- query (字符串, 可选): 搜索关键词

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」BatchSearch「末」
expressions:「始」["上周", "上个月", "去年"]「末」
query:「始」项目进展「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'expressions', type: 'string', required: true, description: '时间表达式列表' },
        { name: 'query', type: 'string', required: false, description: '搜索关键词' }
      ]
    },
    {
      commandIdentifier: 'GetDiaryContext',
      description: `获取日记上下文，用于 Prompt 注入。
参数:
- mode (字符串, 必需): 模式 (full/rag/threshold/threshold_rag)
- query (字符串, 可选): RAG 检索查询
- characterName (字符串, 可选): 角色名称
- timeExpression (字符串, 可选): 时间范围

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」GetDiaryContext「末」
mode:「始」rag「末」
query:「始」最近的心情「末」
characterName:「始」小樱「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'mode', type: 'string', required: true, description: '模式' },
        { name: 'query', type: 'string', required: false, description: 'RAG 查询' },
        { name: 'characterName', type: 'string', required: false, description: '角色名称' },
        { name: 'timeExpression', type: 'string', required: false, description: '时间范围' }
      ]
    }
  ]

  // 合并所有 toolDefinitions
  toolDefinitions: BuiltinToolDefinition[] = [
    ...this.writeToolDefinitions,
    ...this.readToolDefinitions,
    ...this.ragToolDefinitions
  ]

  private config: Record<string, unknown> = {}

  async initialize(): Promise<void> {
    logger.info('DailyNoteWriteService initialized as unified diary service')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      const plugin = getDailyNoteWritePlugin()

      // ==================== 写入命令 (原生实现) ====================
      switch (command) {
        case 'write':
        case '':
        case undefined:
          return await this.executeWrite(plugin, params)

        case 'quickNote':
          return await this.executeQuickNote(plugin, params)

        case 'update':
          return await this.executeUpdate(plugin, params)
      }

      // ==================== 读取命令 (直接使用 NoteService) ====================
      switch (command) {
        case 'GetNote':
          return await this.executeGetNote(params)
        case 'SearchNotes':
          return await this.executeSearchNotes(params)
        case 'ListNotes':
          return await this.executeListNotes(params)
        case 'GetStats':
          return await this.executeGetStats()
        case 'GetByDate':
          return await this.executeGetByDate(params)
        case 'GetRecent':
          return await this.executeGetRecent(params)
        case 'GetByTag':
          return await this.executeGetByTag(params)
        case 'BatchTag':
          return await this.executeBatchTag(params)
      }

      // ==================== 时间表达式命令 (内联实现) ====================
      switch (command) {
        case 'ParseTime':
          return await this.executeParseTime(params)
        case 'SearchByTime':
          return await this.executeSearchByTime(params)
        case 'BatchSearch':
          return await this.executeBatchSearch(params)
      }

      // ==================== RAG 搜索命令 (优先使用统一记忆层) ====================
      if (command === 'RAGSearch') {
        return await this.executeRAGSearchUnified(params)
      }

      if (command === 'GetDiaryContext') {
        return await this.executeGetDiaryContextUnified(params)
      }

      return {
        success: false,
        error: `Unknown command: ${command}`,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error('DailyNoteWriteService execute error', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 读取命令实现 ====================

  private async executeGetNote(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const path = String(params.path || '')

    if (!path) {
      return { success: false, error: '缺少 path 参数', executionTimeMs: Date.now() - startTime }
    }

    const noteService = getNoteService()
    const note = await noteService.read(path)

    if (!note) {
      return { success: false, error: `笔记不存在: ${path}`, executionTimeMs: Date.now() - startTime }
    }

    return {
      success: true,
      output: `📄 ${note.title}\n\n${note.content}`,
      data: this.noteToData(note),
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeSearchNotes(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const query = String(params.query || '')
    const limit = Number(params.limit) || 20

    if (!query) {
      return { success: false, error: '缺少 query 参数', executionTimeMs: Date.now() - startTime }
    }

    const noteService = getNoteService()
    const results = await noteService.fullTextSearch(query, { limit })

    return {
      success: true,
      output: `🔍 搜索结果 (${results.length} 篇):\n\n${results.map((n, i) => `${i + 1}. **${n.title}** (相关度: ${(n.searchScore * 100).toFixed(0)}%)\n   路径: ${n.filePath}`).join('\n')}`,
      data: { query, count: results.length, notes: results.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeListNotes(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const page = Number(params.page) || 1
    const pageSize = Number(params.pageSize) || 20
    const sortOrder = String(params.sortOrder || 'desc')

    const noteService = getNoteService()
    const allNotes = await noteService.listAll()

    // 排序
    allNotes.sort((a, b) => {
      const timeA = a.updatedAt.getTime()
      const timeB = b.updatedAt.getTime()
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB
    })

    // 分页
    const start = (page - 1) * pageSize
    const notes = allNotes.slice(start, start + pageSize)

    return {
      success: true,
      output: `📋 日记列表 (第 ${page} 页, 共 ${Math.ceil(allNotes.length / pageSize)} 页):\n\n${notes.map((n, i) => `${start + i + 1}. **${n.title}** - ${n.frontmatter.date || '未设置日期'}`).join('\n')}`,
      data: { page, pageSize, total: allNotes.length, notes: notes.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeGetStats(): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const noteService = getNoteService()
    const allNotes = await noteService.listAll()

    const stats = {
      totalNotes: allNotes.length,
      aiGenerated: allNotes.filter((n) => n.frontmatter.aiGenerated).length,
      tagCount: new Set(allNotes.flatMap((n) => n.frontmatter.tags || [])).size
    }

    return {
      success: true,
      output: `📊 日记统计:\n- 总数: ${stats.totalNotes}\n- AI 生成: ${stats.aiGenerated}\n- 标签数: ${stats.tagCount}`,
      data: stats,
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeGetByDate(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const date = String(params.date || '')

    if (!date) {
      return { success: false, error: '缺少 date 参数', executionTimeMs: Date.now() - startTime }
    }

    const noteService = getNoteService()
    const allNotes = await noteService.listAll()
    const notes = allNotes.filter((n) => n.frontmatter.date === date)

    return {
      success: true,
      output: `📅 ${date} 的日记 (${notes.length} 篇):\n\n${notes.map((n) => `- **${n.title}**`).join('\n') || '(无)'}`,
      data: { date, count: notes.length, notes: notes.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeGetRecent(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const days = Number(params.days) || 7
    const limit = Number(params.limit) || 20

    const noteService = getNoteService()
    const allNotes = await noteService.listAll()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const recentNotes = allNotes
      .filter((n) => n.updatedAt >= cutoff)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)

    return {
      success: true,
      output: `🕐 最近 ${days} 天的日记 (${recentNotes.length} 篇):\n\n${recentNotes.map((n) => `- **${n.title}** (${n.frontmatter.date || '未设置'})`).join('\n') || '(无)'}`,
      data: { days, count: recentNotes.length, notes: recentNotes.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeGetByTag(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const tagsParam = params.tags
    const limit = Number(params.limit) || 20

    let tags: string[] = []
    if (typeof tagsParam === 'string') {
      try {
        tags = JSON.parse(tagsParam)
      } catch {
        tags = tagsParam.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)
      }
    } else if (Array.isArray(tagsParam)) {
      tags = tagsParam.map(String)
    }

    if (tags.length === 0) {
      return { success: false, error: '缺少 tags 参数', executionTimeMs: Date.now() - startTime }
    }

    const noteService = getNoteService()
    const results = await noteService.searchByTags(tags)
    const limited = results.slice(0, limit)

    return {
      success: true,
      output: `🏷️ 标签 [${tags.join(', ')}] 的日记 (${limited.length} 篇):\n\n${limited.map((n) => `- **${n.title}**`).join('\n') || '(无)'}`,
      data: { tags, count: limited.length, notes: limited.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeBatchTag(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const pathsParam = params.paths
    const tagsParam = params.tags

    let paths: string[] = []
    let tags: string[] = []

    // 解析 paths
    if (typeof pathsParam === 'string') {
      try {
        paths = JSON.parse(pathsParam)
      } catch {
        paths = pathsParam.split(/[,，]/).map((p) => p.trim()).filter(Boolean)
      }
    } else if (Array.isArray(pathsParam)) {
      paths = pathsParam.map(String)
    }

    // 解析 tags
    if (typeof tagsParam === 'string') {
      try {
        tags = JSON.parse(tagsParam)
      } catch {
        tags = tagsParam.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)
      }
    } else if (Array.isArray(tagsParam)) {
      tags = tagsParam.map(String)
    }

    if (paths.length === 0 || tags.length === 0) {
      return { success: false, error: '缺少 paths 或 tags 参数', executionTimeMs: Date.now() - startTime }
    }

    const noteService = getNoteService()
    let updated = 0

    for (const p of paths) {
      const note = await noteService.read(p)
      if (note) {
        const existingTags = note.frontmatter.tags || []
        const newTags = [...new Set([...existingTags, ...tags])]
        await noteService.updateFrontmatter(p, { tags: newTags })
        updated++
      }
    }

    return {
      success: true,
      output: `🏷️ 批量添加标签完成: ${updated} 篇日记已更新`,
      data: { paths, tags, updated },
      executionTimeMs: Date.now() - startTime
    }
  }

  // ==================== 时间表达式命令实现 ====================

  private async executeParseTime(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const expression = String(params.expression || '')

    if (!expression) {
      return { success: false, error: '缺少 expression 参数', executionTimeMs: Date.now() - startTime }
    }

    const range = this.parseTimeExpression(expression)

    return {
      success: true,
      output: `⏰ 时间解析: "${expression}" → ${range.start} 至 ${range.end}`,
      data: range,
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeSearchByTime(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const timeExpression = String(params.timeExpression || '')
    const query = params.query ? String(params.query) : undefined
    const limit = Number(params.limit) || 20

    if (!timeExpression) {
      return { success: false, error: '缺少 timeExpression 参数', executionTimeMs: Date.now() - startTime }
    }

    const range = this.parseTimeExpression(timeExpression)
    const noteService = getNoteService()
    let notes: Note[]

    if (query) {
      const searchResults = await noteService.fullTextSearch(query, { limit: limit * 2 })
      notes = searchResults.filter((n) => this.isInDateRange(n, range))
    } else {
      const allNotes = await noteService.listAll()
      notes = allNotes.filter((n) => this.isInDateRange(n, range))
    }

    notes = notes.slice(0, limit)

    return {
      success: true,
      output: `🕐 时间范围搜索 "${timeExpression}" (${notes.length} 篇):\n\n${notes.map((n) => `- **${n.title}** (${n.frontmatter.date || '未设置'})`).join('\n') || '(无)'}`,
      data: { timeExpression, range, query, count: notes.length, notes: notes.map((n) => this.noteToData(n)) },
      executionTimeMs: Date.now() - startTime
    }
  }

  private async executeBatchSearch(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const expressionsParam = params.expressions
    const query = params.query ? String(params.query) : undefined

    let expressions: string[] = []
    if (typeof expressionsParam === 'string') {
      try {
        expressions = JSON.parse(expressionsParam)
      } catch {
        expressions = expressionsParam.split(/[,，]/).map((e) => e.trim()).filter(Boolean)
      }
    } else if (Array.isArray(expressionsParam)) {
      expressions = expressionsParam.map(String)
    }

    if (expressions.length === 0) {
      return { success: false, error: '缺少 expressions 参数', executionTimeMs: Date.now() - startTime }
    }

    const results: Array<{ expression: string; range: { start: string; end: string }; count: number }> = []

    for (const expr of expressions) {
      const range = this.parseTimeExpression(expr)
      const noteService = getNoteService()
      let notes: Note[]

      if (query) {
        const searchResults = await noteService.fullTextSearch(query, { limit: 100 })
        notes = searchResults.filter((n) => this.isInDateRange(n, range))
      } else {
        const allNotes = await noteService.listAll()
        notes = allNotes.filter((n) => this.isInDateRange(n, range))
      }

      results.push({ expression: expr, range, count: notes.length })
    }

    return {
      success: true,
      output: `🕐 批量时间搜索:\n\n${results.map((r) => `- "${r.expression}": ${r.count} 篇 (${r.range.start} ~ ${r.range.end})`).join('\n')}`,
      data: { expressions, query, results },
      executionTimeMs: Date.now() - startTime
    }
  }

  // ==================== 时间解析辅助方法 ====================

  private parseTimeExpression(expression: string): { start: string; end: string } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    // 常见时间表达式
    const patterns: Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => { start: Date; end: Date } }> = [
      { pattern: /^今[天日]$/,   handler: () => ({ start: today, end: today }) },
      { pattern: /^昨[天日]$/,   handler: () => { const d = new Date(today); d.setDate(d.getDate() - 1); return { start: d, end: d } } },
      { pattern: /^前[天日]$/,   handler: () => { const d = new Date(today); d.setDate(d.getDate() - 2); return { start: d, end: d } } },
      { pattern: /^[这本]周$/,   handler: () => { const start = new Date(today); start.setDate(start.getDate() - start.getDay()); return { start, end: today } } },
      { pattern: /^上周$/,      handler: () => { const start = new Date(today); start.setDate(start.getDate() - start.getDay() - 7); const end = new Date(start); end.setDate(end.getDate() + 6); return { start, end } } },
      { pattern: /^[这本]个?月$/, handler: () => { const start = new Date(today.getFullYear(), today.getMonth(), 1); return { start, end: today } } },
      { pattern: /^上个?月$/,   handler: () => { const start = new Date(today.getFullYear(), today.getMonth() - 1, 1); const end = new Date(today.getFullYear(), today.getMonth(), 0); return { start, end } } },
      { pattern: /^过去(\d+)[天日]$/, handler: (m) => { const d = new Date(today); d.setDate(d.getDate() - parseInt(m[1])); return { start: d, end: today } } },
      { pattern: /^过去(\d+)周$/,   handler: (m) => { const d = new Date(today); d.setDate(d.getDate() - parseInt(m[1]) * 7); return { start: d, end: today } } },
      { pattern: /^过去(\d+)个?月$/, handler: (m) => { const d = new Date(today); d.setMonth(d.getMonth() - parseInt(m[1])); return { start: d, end: today } } },
      { pattern: /^(\d{4})年$/,     handler: (m) => ({ start: new Date(parseInt(m[1]), 0, 1), end: new Date(parseInt(m[1]), 11, 31) }) },
      { pattern: /^(\d{4})年(\d{1,2})月$/, handler: (m) => { const y = parseInt(m[1]); const mo = parseInt(m[2]) - 1; return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 0) } } },
      { pattern: /^去年$/,      handler: () => ({ start: new Date(today.getFullYear() - 1, 0, 1), end: new Date(today.getFullYear() - 1, 11, 31) }) },
      { pattern: /^今年$/,      handler: () => ({ start: new Date(today.getFullYear(), 0, 1), end: today }) },
    ]

    for (const { pattern, handler } of patterns) {
      const match = expression.match(pattern)
      if (match) {
        const { start, end } = handler(match)
        return { start: formatDate(start), end: formatDate(end) }
      }
    }

    // 默认：过去30天
    const defaultStart = new Date(today)
    defaultStart.setDate(defaultStart.getDate() - 30)
    return { start: formatDate(defaultStart), end: formatDate(today) }
  }

  private isInDateRange(note: Note, range: { start: string; end: string }): boolean {
    const noteDate = note.frontmatter.date || note.createdAt.toISOString().split('T')[0]
    return noteDate >= range.start && noteDate <= range.end
  }

  private noteToData(note: Note): Record<string, unknown> {
    return {
      id: note.id,
      filePath: note.filePath,
      title: note.title,
      date: note.frontmatter.date,
      tags: note.frontmatter.tags,
      characterName: note.frontmatter.characterName,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }
  }

  /**
   * RAG 搜索 - 使用统一记忆层 (IntegratedMemoryCoordinator)
   * 这样可以复用 WaveRAG、标签共现扩展、RRF 融合等能力
   */
  private async executeRAGSearchUnified(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const query = String(params.query || '').trim()
    const timeExpression = params.timeExpression ? String(params.timeExpression) : undefined
    const characterName = params.characterName ? String(params.characterName) : undefined
    const topK = Number(params.topK) || 5

    if (!query) {
      return { success: false, error: '缺少 query 参数', executionTimeMs: Date.now() - startTime }
    }

    try {
      // 尝试使用统一记忆层
      const { getIntegratedMemoryCoordinator } = await import('../../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 使用统一的智能搜索，指定 diary 后端
      const results = await coordinator.intelligentSearch(query, {
        backends: ['diary'],
        topK,
        characterName,
        timeExpression,
        useWaveRAG: true,
        useTagMemo: true
      })

      if (results.length === 0) {
        return {
          success: true,
          output: `未找到与 "${query}" 相关的日记片段`,
          data: { query, count: 0, fragments: [], source: 'unified_memory' },
          executionTimeMs: Date.now() - startTime
        }
      }

      const fragments = results.map((r, i) => ({
        index: i + 1,
        title: (r.metadata?.title as string) || '未命名',
        date: r.metadata?.date as string | undefined,
        path: r.metadata?.path as string | undefined,
        fragment: r.content?.slice(0, 500) || '',
        score: r.score
      }))

      const output = `🔍 RAG 检索结果 (共 ${fragments.length} 个片段, 统一记忆层):\n\n${fragments.map((f) => `[${f.index}] **${f.title}** (${f.date || '未设置'})\n${f.fragment}${f.fragment.length >= 500 ? '...' : ''}`).join('\n\n---\n\n')}`

      return {
        success: true,
        output,
        data: {
          query,
          timeExpression,
          characterName,
          count: fragments.length,
          fragments,
          source: 'unified_memory'
        },
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      // 如果统一记忆层不可用，回退到基础全文搜索
      logger.warn('Unified memory layer unavailable, falling back to basic search', {
        error: error instanceof Error ? error.message : String(error)
      })

      const noteService = getNoteService()
      const results = await noteService.fullTextSearch(query, { limit: topK })

      if (results.length === 0) {
        return {
          success: true,
          output: `未找到与 "${query}" 相关的日记片段`,
          data: { query, count: 0, fragments: [], source: 'fallback_search' },
          executionTimeMs: Date.now() - startTime
        }
      }

      const fragments = results.map((n, i) => ({
        index: i + 1,
        title: n.title,
        date: n.frontmatter.date,
        path: n.filePath,
        fragment: n.content?.slice(0, 500) || '',
        score: n.searchScore
      }))

      return {
        success: true,
        output: `🔍 搜索结果 (共 ${fragments.length} 篇, 基础搜索):\n\n${fragments.map((f) => `[${f.index}] **${f.title}** (${f.date || '未设置'})\n${f.fragment}${f.fragment.length >= 500 ? '...' : ''}`).join('\n\n---\n\n')}`,
        data: { query, count: fragments.length, fragments, source: 'fallback_search' },
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 获取日记上下文 - 使用统一记忆层
   */
  private async executeGetDiaryContextUnified(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      const { getIntegratedMemoryCoordinator } = await import('../../memory/IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      const mode = String(params.mode || 'rag')
      const query = params.query ? String(params.query) : undefined
      const characterName = params.characterName ? String(params.characterName) : undefined
      const timeExpression = params.timeExpression ? String(params.timeExpression) : undefined

      // 使用统一记忆层获取上下文
      const context = await coordinator.getDiaryContext({
        mode: mode as 'full' | 'rag' | 'threshold' | 'threshold_rag',
        query,
        characterName,
        timeExpression
      })

      return {
        success: true,
        output: `日记上下文 (模式: ${context.usedMode}, 统一记忆层)\n\n${context.content || '(无内容)'}`,
        data: {
          mode: context.usedMode,
          sourceCount: context.sourceCount,
          contentLength: context.content?.length || 0,
          context: context.content,
          source: 'unified_memory'
        },
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      // 回退到基础搜索实现
      logger.warn('Unified memory layer unavailable for GetDiaryContext, falling back to basic search', {
        error: error instanceof Error ? error.message : String(error)
      })

      const mode = String(params.mode || 'rag')
      const query = params.query ? String(params.query) : undefined

      const noteService = getNoteService()
      let notes: Note[]

      if (query && (mode === 'rag' || mode === 'threshold_rag')) {
        const searchResults = await noteService.fullTextSearch(query, { limit: 10 })
        notes = searchResults
      } else {
        const allNotes = await noteService.listAll()
        notes = allNotes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 10)
      }

      const content = notes.map((n) => `## ${n.title}\n${n.content}`).join('\n\n---\n\n')

      return {
        success: true,
        output: `日记上下文 (模式: ${mode}, 基础搜索)\n\n${content || '(无内容)'}`,
        data: {
          mode,
          sourceCount: notes.length,
          contentLength: content.length,
          context: content,
          source: 'fallback_search'
        },
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 执行写入命令
   */
  private async executeWrite(
    plugin: ReturnType<typeof getDailyNoteWritePlugin>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    const result = await plugin.execute(params)

    // 记录到学习系统
    if (result.success && this.config.recordToLearning !== false) {
      await this.recordToLearningSystem(result.data as any)
    }

    // 自动生成时间线事件
    if (result.success && this.config.autoTimelineEnabled) {
      await this.generateTimelineEvent(params, result.data as any)
    }

    return {
      success: result.success,
      output: result.output,
      data: result.data,
      executionTimeMs: Date.now() - startTime
    }
  }

  /**
   * 自动生成时间线事件
   * 当日记写入成功后，自动调用 TimelineGenerator 生成时间线事件
   */
  private async generateTimelineEvent(
    params: Record<string, unknown>,
    _resultData: { path?: string; title?: string } | undefined
  ): Promise<void> {
    try {
      const content = String(params.content || '')
      const characterName = params.characterName ? String(params.characterName) : 'default'

      // 内容太短不生成时间线
      if (content.length < 50) {
        return
      }

      // 获取 TimelineGenerator 服务
      const { getBuiltinServiceRegistry } = await import('./index')
      const registry = getBuiltinServiceRegistry()
      const timelineGenerator = registry.get('TimelineGenerator')

      if (!timelineGenerator) {
        logger.debug('TimelineGenerator not available, skipping auto timeline')
        return
      }

      // 调用 ProcessDiary 生成时间线事件
      const timelineResult = await timelineGenerator.execute('ProcessDiary', {
        characterId: characterName,
        content,
        date: new Date().toISOString().split('T')[0]
      })

      if (timelineResult.success) {
        logger.info('Auto-generated timeline event for diary', {
          characterName,
          contentLength: content.length
        })
      } else {
        logger.debug('Failed to auto-generate timeline event', {
          error: timelineResult.error
        })
      }
    } catch (error) {
      // 时间线生成失败不影响日记写入
      logger.warn('Error in auto timeline generation', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 快速笔记
   */
  private async executeQuickNote(
    plugin: ReturnType<typeof getDailyNoteWritePlugin>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    const content = String(params.content || '')

    if (!content.trim()) {
      return {
        success: false,
        error: '内容不能为空',
        executionTimeMs: Date.now() - startTime
      }
    }

    // 快速笔记使用默认配置，不跳过自动补标
    const result = await plugin.execute({
      content,
      category: 'quick-notes',
      skipAutoTag: false
    })

    // 记录到学习系统
    if (result.success && this.config.recordToLearning !== false) {
      await this.recordToLearningSystem(result.data as any)
    }

    return {
      success: result.success,
      output: result.success ? `📝 快速笔记已保存\n${result.output}` : result.output,
      data: result.data,
      executionTimeMs: Date.now() - startTime
    }
  }

  /**
   * 执行更新命令
   */
  private async executeUpdate(
    plugin: ReturnType<typeof getDailyNoteWritePlugin>,
    params: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    const target = String(params.target || '')
    const replace = params.replace !== undefined ? String(params.replace) : undefined

    if (!target || target.trim().length < 15) {
      return {
        success: false,
        error: '目标内容 (target) 至少需要 15 个字符以确保精确匹配',
        executionTimeMs: Date.now() - startTime
      }
    }

    if (replace === undefined) {
      return {
        success: false,
        error: '替换内容 (replace) 不能为空',
        executionTimeMs: Date.now() - startTime
      }
    }

    const result = await plugin.agentUpdate({
      target,
      replace,
      filePath: params.filePath ? String(params.filePath) : undefined,
      characterName: params.characterName ? String(params.characterName) : undefined
    })

    if (result.success && result.note) {
      return {
        success: true,
        output: `📝 日记已更新: ${result.matchedPath}\n替换次数: ${result.replacementCount}`,
        data: {
          filePath: result.note.filePath,
          title: result.note.title,
          replacementCount: result.replacementCount
        },
        executionTimeMs: Date.now() - startTime
      }
    } else {
      return {
        success: false,
        output: `更新失败: ${result.error}`,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 记录到学习系统
   * 让 SelfLearning 知道哪些标签被频繁使用
   */
  private async recordToLearningSystem(data: { tags?: string[]; generatedTags?: string[] }): Promise<void> {
    if (!data) return

    try {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const selfLearning = getSelfLearningService()

      // 记录用户手动指定的标签（正向反馈）
      const allTags = [...(data.tags || []), ...(data.generatedTags || [])]
      if (allTags.length > 0) {
        selfLearning.recordQuery(allTags, 'tagmemo')
        logger.debug('Recorded tags to learning system', { tagCount: allTags.length })
      }
    } catch (error) {
      // 学习系统错误不影响主流程
      logger.debug('Failed to record to learning system', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  async shutdown(): Promise<void> {
    logger.info('DailyNoteWriteService shutdown')
  }
}
