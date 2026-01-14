/**
 * 日记模式解析器
 * 基于 VCPToolBox 的 4 种日记声明模式
 *
 * 支持的语法:
 * - {{知识库}} - 全文注入 (fulltext)
 * - [[知识库]] - RAG 片段 (rag)
 * - <<知识库>> - 阈值全文 (threshold_fulltext)
 * - 《《知识库》》 - 阈值 RAG (threshold_rag)
 *
 * 动态 K 值语法:
 * - [[知识库:1.5]] - 动态权重系数，自动计算 topK = baseK * factor
 *
 * 修饰符支持:
 * - ::Time - 时间感知 (自动解析自然语言时间表达式)
 * - ::Group - 语义组增强 (使用默认组)
 * - ::Group(a,b,c) - 自定义语义组
 * - ::TagMemo0.65 - TagMemo 算法 (带阈值)
 * - ::TopK10 / ::K10 - 限制返回数量
 * - ::Threshold0.8 - 相似度阈值
 * - ::MeshMemo / ::LightMemo / ::DeepMemo - 后端选择器
 */

import { loggerService } from '@logger'
import { getTimeExpressionParser, type SupportedLocale, type TimeRange } from '@main/utils/TimeExpressionParser'

import type {
  DiaryModeParseResult,
  DiaryModeSyntax,
  DiaryModifier,
  ParsedDiaryDeclaration,
  RetrievalBackend,
  RetrievalConfig,
  RetrievalMode
} from './types'

const logger = loggerService.withContext('DiaryModeParser')

/**
 * 预定义的日记模式语法
 */
const DIARY_MODE_SYNTAXES: DiaryModeSyntax[] = [
  {
    mode: 'fulltext',
    openTag: '{{',
    closeTag: '}}',
    // 匹配 {{知识库名::修饰符}} - 修饰符可以包含括号和点号
    regex: /\{\{([^}]+(?:::[^\s}]+)*)\}\}/g
  },
  {
    mode: 'rag',
    openTag: '[[',
    closeTag: ']]',
    // 匹配 [[知识库名::修饰符]] - 支持 ::Group(a,b,c) 格式
    regex: /\[\[([^\]]+(?:::[^\s\]]+)*)\]\]/g
  },
  {
    mode: 'threshold_fulltext',
    openTag: '<<',
    closeTag: '>>',
    // 匹配 <<知识库名::修饰符>>
    regex: /<<([^>]+(?:::[^\s>]+)*)>>/g
  },
  {
    mode: 'threshold_rag',
    openTag: '《《',
    closeTag: '》》',
    // 匹配 《《知识库名::修饰符》》
    regex: /《《([^》]+(?:::[^\s》]+)*)》》/g
  }
]

/**
 * 修饰符解析正则
 */
const MODIFIER_PATTERNS = {
  time: /^::Time$/i,
  group: /^::Group(?:\(([^)]+)\))?$/i, // ::Group 或 ::Group(a,b,c)
  tagmemo: /^::TagMemo([\d.]+)?$/i,
  aimemo: /^::AIMemo$/i, // AIMemo AI 驱动合成召回
  rerank: /^::Rerank$/i, // 精准重排序
  topk: /^::TopK(\d+)$/i,
  k: /^::K(\d+)$/i, // ::K 是 ::TopK 的别名
  threshold: /^::Threshold([\d.]+)$/i,
  timeRange: /^::TimeRange\(([^)]+)\)$/i,
  // 后端选择器
  meshmemo: /^::MeshMemo$/i,
  lightmemo: /^::LightMemo$/i,
  deepmemo: /^::DeepMemo$/i
}

export class DiaryModeParser {
  private syntaxes: DiaryModeSyntax[]
  private locale: SupportedLocale

  constructor(customSyntaxes?: DiaryModeSyntax[], locale: SupportedLocale = 'zh-CN') {
    this.syntaxes = customSyntaxes || DIARY_MODE_SYNTAXES
    this.locale = locale
  }

  /**
   * 设置语言区域 (用于时间表达式解析)
   */
  setLocale(locale: SupportedLocale): void {
    this.locale = locale
  }

  /**
   * 解析文本中的日记声明
   * @param text 输入文本
   * @param parseTimeExpressions 是否自动解析时间表达式 (默认 true)
   */
  parse(text: string, parseTimeExpressions = true): DiaryModeParseResult {
    const declarations: ParsedDiaryDeclaration[] = []
    let cleanedText = text

    for (const syntax of this.syntaxes) {
      // 重置正则的 lastIndex
      syntax.regex.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = syntax.regex.exec(text)) !== null) {
        const raw = match[0]
        const content = match[1]

        // 解析知识库名和修饰符
        const { knowledgeBaseName, modifiers } = this.parseDeclarationContent(content)

        declarations.push({
          mode: syntax.mode,
          knowledgeBaseName,
          modifiers,
          raw,
          startIndex: match.index,
          endIndex: match.index + raw.length
        })
      }
    }

    // 按位置排序 (从后往前处理，避免索引偏移)
    declarations.sort((a, b) => b.startIndex - a.startIndex)

    // 从文本中移除声明
    for (const decl of declarations) {
      cleanedText = cleanedText.slice(0, decl.startIndex) + cleanedText.slice(decl.endIndex)
    }

    // 重新按位置排序 (正序)
    declarations.sort((a, b) => a.startIndex - b.startIndex)

    // 构建配置映射
    const configs = this.buildConfigs(declarations)

    // 如果启用了时间感知，自动解析时间表达式
    if (parseTimeExpressions) {
      this.parseTimeExpressionsForConfigs(configs, cleanedText)
    }

    logger.debug('Parsed diary declarations', {
      declarationCount: declarations.length,
      knowledgeBases: Array.from(configs.keys())
    })

    return {
      declarations,
      cleanedText: cleanedText.trim(),
      configs
    }
  }

  /**
   * 为启用了时间感知的配置解析时间表达式
   */
  private parseTimeExpressionsForConfigs(configs: Map<string, RetrievalConfig>, text: string): void {
    const timeParser = getTimeExpressionParser(this.locale)
    let parsedTimeRanges: TimeRange[] | null = null

    for (const [knowledgeBaseName, config] of configs) {
      if (config.timeAware) {
        // 懒解析：只在第一次需要时解析
        if (parsedTimeRanges === null) {
          parsedTimeRanges = timeParser.parse(text)
          if (parsedTimeRanges.length > 0) {
            logger.debug('Parsed time expressions from text', {
              count: parsedTimeRanges.length,
              ranges: parsedTimeRanges.map((r) => ({
                start: r.start.toISOString(),
                end: r.end.toISOString()
              }))
            })
          }
        }

        // 设置解析后的时间范围
        if (parsedTimeRanges.length > 0) {
          config.parsedTimeRanges = parsedTimeRanges
          logger.debug(`Applied time ranges to knowledge base: ${knowledgeBaseName}`, {
            rangeCount: parsedTimeRanges.length
          })
        }
      }
    }
  }

  /**
   * 解析文本中的时间表达式 (独立方法)
   */
  parseTimeExpressions(text: string): TimeRange[] {
    const timeParser = getTimeExpressionParser(this.locale)
    return timeParser.parse(text)
  }

  /**
   * 检查文本是否包含时间表达式
   */
  hasTimeExpressions(text: string): boolean {
    const timeParser = getTimeExpressionParser(this.locale)
    return timeParser.hasTimeExpression(text)
  }

  /**
   * 解析声明内容 (知识库名::修饰符::修饰符...)
   * 支持动态 K 值语法: 知识库名:1.5 或 知识库名:1.5::其他修饰符
   */
  private parseDeclarationContent(content: string): {
    knowledgeBaseName: string
    modifiers: DiaryModifier[]
    kFactor?: number
  } {
    const parts = content.split('::')
    let firstPart = parts[0].trim()
    const modifiers: DiaryModifier[] = []
    let kFactor: number | undefined

    // 检查是否有动态 K 值语法 (知识库名:1.5)
    const kFactorMatch = firstPart.match(/^(.+?):(\d+\.?\d*)$/)
    if (kFactorMatch) {
      firstPart = kFactorMatch[1].trim()
      kFactor = parseFloat(kFactorMatch[2])
      // 将 kFactor 作为特殊修饰符添加
      modifiers.push({
        type: 'kFactor',
        value: kFactor.toString(),
        parsed: { factor: kFactor }
      })
    }

    const knowledgeBaseName = firstPart

    for (let i = 1; i < parts.length; i++) {
      const modifierStr = `::${parts[i]}`
      const modifier = this.parseModifier(modifierStr)
      if (modifier) {
        modifiers.push(modifier)
      }
    }

    return { knowledgeBaseName, modifiers, kFactor }
  }

  /**
   * 解析单个修饰符
   */
  private parseModifier(modifierStr: string): DiaryModifier | null {
    // 尝试匹配各种修饰符模式
    for (const [type, pattern] of Object.entries(MODIFIER_PATTERNS)) {
      const match = modifierStr.match(pattern)
      if (match) {
        const modifier: DiaryModifier = {
          type: type as DiaryModifier['type'],
          value: match[1] || 'true',
          parsed: {}
        }

        // 解析特定类型的值
        switch (type) {
          case 'group':
            // 如果有括号内的组名，解析它们
            if (match[1]) {
              const groups = match[1].split(',').map((g) => g.trim())
              modifier.parsed = { groups }
            } else {
              // 使用默认组
              modifier.parsed = { groups: null }
            }
            break
          case 'tagmemo':
            modifier.parsed = { threshold: match[1] ? parseFloat(match[1]) : 0.65 }
            break
          case 'aimemo':
            // AIMemo 无额外参数
            modifier.parsed = { enabled: true }
            break
          case 'rerank':
            // Rerank 精准重排序
            modifier.parsed = { enabled: true }
            break
          case 'topk':
          case 'k':
            modifier.parsed = { count: parseInt(match[1]) }
            // 统一为 'topk' 或 'k' 类型
            modifier.type = type === 'k' ? 'k' : 'topk'
            break
          case 'threshold':
            modifier.parsed = { value: parseFloat(match[1]) }
            break
          case 'timeRange':
            modifier.parsed = { range: match[1] }
            break
          case 'meshmemo':
          case 'lightmemo':
          case 'deepmemo':
            // 后端选择器
            modifier.type = 'backend'
            modifier.value = type as RetrievalBackend
            modifier.parsed = { backend: type }
            break
        }

        return modifier
      }
    }

    // 未知修饰符作为 custom 处理
    if (modifierStr.startsWith('::')) {
      return {
        type: 'custom',
        value: modifierStr.slice(2)
      }
    }

    return null
  }

  /**
   * 构建检索配置映射
   */
  private buildConfigs(declarations: ParsedDiaryDeclaration[]): Map<string, RetrievalConfig> {
    const configs = new Map<string, RetrievalConfig>()

    for (const decl of declarations) {
      const config: RetrievalConfig = {
        mode: decl.mode,
        topK: 10, // 默认值
        backend: 'auto' // 默认自动选择后端
      }

      // 根据模式设置默认阈值
      if (decl.mode === 'threshold_fulltext' || decl.mode === 'threshold_rag') {
        config.threshold = 0.7 // 默认阈值
      }

      // 应用修饰符
      for (const modifier of decl.modifiers) {
        switch (modifier.type) {
          case 'time':
            config.timeAware = true
            break
          case 'group': {
            // 动态语义组支持
            const parsedGroups = modifier.parsed?.groups as string[] | null
            if (parsedGroups && parsedGroups.length > 0) {
              // 使用自定义组 ::Group(a,b,c)
              config.semanticGroups = parsedGroups
            } else {
              // 使用默认组 ::Group
              config.semanticGroups = ['color', 'pattern', 'silhouette', 'style']
            }
            break
          }
          case 'tagmemo':
            config.tagMemo = true
            config.tagMemoThreshold = (modifier.parsed?.threshold as number) || 0.65
            break
          case 'aimemo':
            config.aiMemo = true
            break
          case 'rerank':
            config.rerank = true
            break
          case 'topk':
          case 'k':
            // 支持 ::TopK 和 ::K 两种写法
            config.topK = (modifier.parsed?.count as number) || 10
            break
          case 'kFactor':
            // 动态 K 值系数：topK = baseK * kFactor
            config.kFactor = (modifier.parsed?.factor as number) || 1.0
            // 如果没有显式设置 topK，使用 kFactor 计算
            if (!decl.modifiers.some((m) => m.type === 'topk' || m.type === 'k')) {
              const baseK = 10 // 默认基础 K 值
              config.topK = Math.round(baseK * config.kFactor)
            }
            break
          case 'threshold':
            config.threshold = (modifier.parsed?.value as number) || 0.7
            break
          case 'timeRange':
            config.timeRange = modifier.parsed?.range as string
            config.timeAware = true
            break
          case 'backend':
            // 后端选择器
            config.backend = modifier.value as RetrievalBackend
            break
          case 'custom':
            // 检查是否是 timeRange 格式
            if (modifier.value.startsWith('TimeRange(')) {
              const rangeMatch = modifier.value.match(/TimeRange\(([^)]+)\)/)
              if (rangeMatch) {
                config.timeRange = rangeMatch[1]
                config.timeAware = true
              }
            }
            break
        }
      }

      // 如果已存在配置，合并 (后面的声明优先)
      const existing = configs.get(decl.knowledgeBaseName)
      if (existing) {
        configs.set(decl.knowledgeBaseName, { ...existing, ...config })
      } else {
        configs.set(decl.knowledgeBaseName, config)
      }
    }

    return configs
  }

  /**
   * 检查文本是否包含日记声明
   */
  hasDeclarations(text: string): boolean {
    for (const syntax of this.syntaxes) {
      syntax.regex.lastIndex = 0
      if (syntax.regex.test(text)) {
        return true
      }
    }
    return false
  }

  /**
   * 获取文本中声明的知识库列表
   */
  getKnowledgeBases(text: string): string[] {
    const result = this.parse(text)
    return Array.from(result.configs.keys())
  }

  /**
   * 格式化日记声明 (用于调试/显示)
   */
  formatDeclaration(config: RetrievalConfig, knowledgeBaseName: string): string {
    const parts = [knowledgeBaseName]

    if (config.timeAware) {
      parts.push('Time')
    }
    if (config.semanticGroups && config.semanticGroups.length > 0) {
      // 检查是否是默认组
      const defaultGroups = ['color', 'pattern', 'silhouette', 'style']
      const isDefault =
        config.semanticGroups.length === defaultGroups.length &&
        config.semanticGroups.every((g, i) => g === defaultGroups[i])

      if (isDefault) {
        parts.push('Group')
      } else {
        parts.push(`Group(${config.semanticGroups.join(',')})`)
      }
    }
    if (config.tagMemo) {
      parts.push(`TagMemo${config.tagMemoThreshold || 0.65}`)
    }
    if (config.aiMemo) {
      parts.push('AIMemo')
    }
    if (config.rerank) {
      parts.push('Rerank')
    }
    if (config.topK && config.topK !== 10) {
      parts.push(`TopK${config.topK}`)
    }
    if (config.threshold) {
      parts.push(`Threshold${config.threshold}`)
    }
    if (config.backend && config.backend !== 'auto') {
      // 首字母大写
      const backendName = config.backend.charAt(0).toUpperCase() + config.backend.slice(1)
      parts.push(backendName)
    }

    const content = parts.join('::')

    switch (config.mode) {
      case 'fulltext':
        return `{{${content}}}`
      case 'rag':
        return `[[${content}]]`
      case 'threshold_fulltext':
        return `<<${content}>>`
      case 'threshold_rag':
        return `《《${content}》》`
      default:
        return `[[${content}]]`
    }
  }

  /**
   * 获取模式的描述
   */
  getModeDescription(mode: RetrievalMode): string {
    switch (mode) {
      case 'fulltext':
        return '全文注入 - 将整个知识库内容注入上下文'
      case 'rag':
        return 'RAG 片段 - 检索相关片段注入上下文'
      case 'threshold_fulltext':
        return '阈值全文 - 仅当相似度超过阈值时注入全文'
      case 'threshold_rag':
        return '阈值 RAG - 仅当相似度超过阈值时检索片段'
      default:
        return '未知模式'
    }
  }
}

// 导出默认解析器实例
export const diaryModeParser = new DiaryModeParser()

// 导出工厂函数
export function createDiaryModeParser(customSyntaxes?: DiaryModeSyntax[], locale?: SupportedLocale): DiaryModeParser {
  return new DiaryModeParser(customSyntaxes, locale)
}
