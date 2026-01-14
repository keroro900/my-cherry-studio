/**
 * 统一变量系统 - 基础变量解析
 *
 * 提供日期时间、文化变量等基础变量的解析逻辑
 * 供 renderer (prompt.ts) 和 main (PlaceholderEngine.ts) 共同使用
 *
 * 设计原则：
 * - 纯函数，无副作用
 * - 同步操作为主，异步操作由调用方处理
 * - 不依赖 Electron 或浏览器特定 API
 */

import type { VariableContext, VariableResolveResult } from './types'

// ==================== 工具函数 ====================

/**
 * 获取中文星期几
 */
export function getChineseWeekday(date: Date = new Date()): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[date.getDay()]
}

/**
 * 获取简短星期（日/一/二...）
 */
export function getShortWeekday(date: Date = new Date()): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return weekdays[date.getDay()]
}

/**
 * 获取时段问候语
 */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 9) return '早上好'
  if (hour >= 9 && hour < 12) return '上午好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  if (hour >= 18 && hour < 22) return '晚上好'
  return '夜深了'
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ==================== 日期时间变量 ====================

/**
 * 获取所有日期时间变量的值
 */
export function getDateTimeVariables(date: Date = new Date()): Record<string, string> {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  // 中文格式日期
  const dateStr = date.toLocaleDateString('zh-CN')
  const timeStr = date.toLocaleTimeString('zh-CN')
  const todayStr = date.toLocaleDateString('zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return {
    // VCP 标准格式（首字母大写）
    Date: dateStr,
    Time: timeStr,
    Today: todayStr,
    Year: year,
    Month: month,
    Day: day,
    Hour: hour,
    Minute: minute,
    Weekday: getShortWeekday(date),

    // 兼容小写格式
    date: dateStr,
    time: timeStr,
    datetime: todayStr,
    weekday: getChineseWeekday(date),

    // 中文别名
    '星期': getChineseWeekday(date)
  }
}

// ==================== 文化变量 ====================

/**
 * 获取文化相关变量的值
 */
export function getCulturalVariables(date: Date = new Date()): Record<string, string> {
  const greeting = getGreeting(date)

  return {
    // VCP 标准格式
    Greeting: greeting,

    // 兼容格式
    greeting: greeting,
    '问候语': greeting
  }
}

/**
 * 获取农历节日信息
 * 注意：此函数返回占位符，实际农历计算需要在 renderer 端使用 chinese-lunar-calendar 库
 * @returns 农历日期、生肖、节气信息（或占位提示）
 */
export function getFestivalInfo(date: Date = new Date()): string {
  // 基础节日检测（公历节日）
  const month = date.getMonth() + 1
  const day = date.getDate()

  // 公历节日
  const solarFestivals: Record<string, string> = {
    '1-1': '元旦',
    '2-14': '情人节',
    '3-8': '妇女节',
    '4-1': '愚人节',
    '5-1': '劳动节',
    '5-4': '青年节',
    '6-1': '儿童节',
    '7-1': '建党节',
    '8-1': '建军节',
    '9-10': '教师节',
    '10-1': '国庆节',
    '10-31': '万圣节',
    '11-11': '双十一',
    '12-24': '平安夜',
    '12-25': '圣诞节',
    '12-31': '跨年夜'
  }

  const key = `${month}-${day}`
  const solarFestival = solarFestivals[key]

  if (solarFestival) {
    return solarFestival
  }

  // 返回空字符串，让调用方处理农历节日（需要 lunar 库）
  return ''
}

// ==================== 同步变量解析 ====================

/**
 * 解析基础同步变量（日期时间、文化变量等）
 * 不包含需要异步获取的变量（Username, System, Stickers 等）
 */
export function resolveBasicSyncVariables(
  text: string,
  context?: VariableContext
): VariableResolveResult {
  if (!text || typeof text !== 'string') {
    return { text: text || '', resolvedCount: 0 }
  }

  let result = text
  let resolvedCount = 0
  const unresolvedVariables: string[] = []
  const now = new Date()

  // 1. 日期时间变量
  const dateTimeVars = getDateTimeVariables(now)
  for (const [key, value] of Object.entries(dateTimeVars)) {
    const pattern = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g')
    if (pattern.test(result)) {
      result = result.replace(pattern, value)
      resolvedCount++
    }
  }

  // 2. 文化变量（问候语）
  const culturalVars = getCulturalVariables(now)
  for (const [key, value] of Object.entries(culturalVars)) {
    const pattern = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g')
    if (pattern.test(result)) {
      result = result.replace(pattern, value)
      resolvedCount++
    }
  }

  // 3. 模型名称（如果上下文提供）
  if (context?.modelName) {
    const modelPatterns = [/\{\{ModelName\}\}/g, /\{\{model_name\}\}/g]
    for (const pattern of modelPatterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, context.modelName)
        resolvedCount++
      }
    }
  }

  return {
    text: result,
    resolvedCount,
    unresolvedVariables: unresolvedVariables.length > 0 ? unresolvedVariables : undefined
  }
}

// ==================== 变量检测 ====================

/**
 * 检查文本是否包含支持的变量占位符
 */
export function containsVariables(text: string): boolean {
  if (!text) return false

  // 基础变量模式
  const patterns = [
    /\{\{Date\}\}/,
    /\{\{date\}\}/,
    /\{\{Time\}\}/,
    /\{\{time\}\}/,
    /\{\{Today\}\}/,
    /\{\{datetime\}\}/,
    /\{\{Year\}\}/,
    /\{\{Month\}\}/,
    /\{\{Day\}\}/,
    /\{\{Hour\}\}/,
    /\{\{Minute\}\}/,
    /\{\{Weekday\}\}/,
    /\{\{weekday\}\}/,
    /\{\{星期\}\}/,
    /\{\{Username\}\}/,
    /\{\{username\}\}/,
    /\{\{System\}\}/,
    /\{\{system\}\}/,
    /\{\{Language\}\}/,
    /\{\{language\}\}/,
    /\{\{Arch\}\}/,
    /\{\{arch\}\}/,
    /\{\{ModelName\}\}/,
    /\{\{model_name\}\}/,
    /\{\{Lunar\}\}/,
    /\{\{lunar\}\}/,
    /\{\{农历\}\}/,
    /\{\{Greeting\}\}/,
    /\{\{greeting\}\}/,
    /\{\{问候语\}\}/,
    /\{\{Stickers\}\}/,
    /\{\{stickers\}\}/,
    /\{\{表情包\}\}/
  ]

  return patterns.some((pattern) => pattern.test(text))
}

/**
 * 检查文本是否包含 VCP 扩展变量
 */
export function containsVCPVariables(text: string): boolean {
  if (!text) return false

  const vcpPatterns = [
    /\{\{Tar[a-zA-Z0-9_]+\}\}/,      // Tar 变量
    /\{\{Var[a-zA-Z0-9_]+\}\}/,      // Var 变量
    /\{\{Sar[a-zA-Z0-9_]+\}\}/,      // Sar 变量
    /\{\{[^}]+日记本\}\}/,           // 日记本占位符
    /\[\[[^\]]+日记本\]\]/,          // RAG 日记本占位符
    /<<[^>]+日记本>>/,               // 阈值日记本占位符
    /《《[^》]+日记本》》/,           // 阈值 RAG 日记本占位符
    /\{\{VCP[a-zA-Z_]+\}\}/,         // VCP 插件变量
    /\{\{Agent[a-zA-Z_]+\}\}/,       // Agent 变量
    /\{\{Tavern[a-zA-Z_]+\}\}/       // Tavern 变量
  ]

  return vcpPatterns.some((pattern) => pattern.test(text))
}

/**
 * 提取文本中的所有变量占位符
 */
export function extractVariablePlaceholders(text: string): string[] {
  if (!text) return []

  const placeholders: string[] = []

  // 匹配 {{...}} 格式
  const curlyPattern = /\{\{([^}]+)\}\}/g
  let match
  while ((match = curlyPattern.exec(text)) !== null) {
    placeholders.push(match[0])
  }

  // 匹配 [[...]] 格式（RAG）
  const bracketPattern = /\[\[([^\]]+)\]\]/g
  while ((match = bracketPattern.exec(text)) !== null) {
    placeholders.push(match[0])
  }

  // 匹配 <<...>> 格式（阈值）
  const anglePattern = /<<([^>]+)>>/g
  while ((match = anglePattern.exec(text)) !== null) {
    placeholders.push(match[0])
  }

  // 匹配 《《...》》 格式（阈值 RAG）
  const cnAnglePattern = /《《([^》]+)》》/g
  while ((match = cnAnglePattern.exec(text)) !== null) {
    placeholders.push(match[0])
  }

  return [...new Set(placeholders)] // 去重
}
