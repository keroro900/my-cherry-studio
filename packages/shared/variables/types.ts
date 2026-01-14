/**
 * 统一变量系统 - 类型定义
 *
 * 供 renderer (prompt.ts) 和 main (PlaceholderEngine.ts) 共同使用
 */

// ============================================================================
// VCPVariable - 统一变量接口（合并了原 VariableDefinition、PluginVariable、PromptVariable）
// ============================================================================

/**
 * 变量作用域
 */
export type VariableScope = 'global' | 'agent' | 'session'

/**
 * 变量来源
 */
export type VariableSource = 'user' | 'default' | 'env' | 'plugin' | 'system'

/**
 * 中文类别常量 - UI 显示使用
 */
export const VARIABLE_CATEGORIES = {
  BASIC: '基础变量',
  GUIDE: '功能指南',
  SYSTEM: '系统变量',
  PLUGIN: '插件变量',
  CUSTOM: '自定义变量',
  NETWORK: '网络配置',
  ENTERTAINMENT: '娱乐功能'
} as const

export type VariableCategoryType = (typeof VARIABLE_CATEGORIES)[keyof typeof VARIABLE_CATEGORIES]

/**
 * VCP 统一变量接口
 * 合并了原 VariableDefinition、PluginVariable、PromptVariable
 *
 * 使用场景：
 * - 用户自定义变量 (Var*)
 * - 模板变量 (Tar*)
 * - 模型条件变量 (Sar*)
 * - 插件注册变量 (VCP*)
 * - 系统变量 (Date, Time 等)
 */
export interface VCPVariable {
  /** 唯一标识符 */
  id: string
  /** 变量名（不含 {{ }}） */
  name: string
  /** 变量值（可以是文本或 .txt 文件名） */
  value: string

  // === 元数据 ===
  /** 变量描述 */
  description?: string
  /** 中文类别：'基础变量'|'功能指南'|'插件变量'|'系统变量' */
  category: string

  // === 行为控制 ===
  /** 作用域 */
  scope: VariableScope
  /** 仅 system 角色生效 */
  systemRoleOnly?: boolean
  /** 是否只读（系统变量） */
  readonly?: boolean

  // === 插件支持 ===
  /** 来源 */
  source: VariableSource
  /** 插件来源标识 */
  pluginId?: string
  /** 是否动态计算（每次获取时重新计算） */
  dynamic?: boolean

  // === 缓存控制 ===
  /** 缓存时间（毫秒），0 表示不缓存 */
  cacheTTL?: number

  // === Sar 特有 ===
  /** 模型过滤列表（仅 Sar 变量） */
  sarModelFilter?: string[]

  // === 时间戳 ===
  createdAt: number
  updatedAt: number
}

/**
 * 创建 VCPVariable 时的输入类型（不含自动生成的字段）
 */
export type VCPVariableInput = Omit<VCPVariable, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 更新 VCPVariable 时的输入类型
 */
export type VCPVariableUpdate = Partial<Omit<VCPVariable, 'id' | 'createdAt'>>

/**
 * 动态变量函数类型（仅供插件内部使用）
 */
export type DynamicValueGetter = () => Promise<string>

/**
 * 导入冲突信息
 */
export interface ImportConflict {
  name: string
  existingValue: string
  newValue: string
  existingId: string
}

/**
 * 导入结果
 */
export interface ImportResult {
  created: number
  updated: number
  skipped: number
  total: number
  conflicts: ImportConflict[]
}

// ============================================================================
// 旧版类型定义（保持向后兼容）
// ============================================================================

/**
 * 变量类别
 * @deprecated 使用 VARIABLE_CATEGORIES 中文类别替代
 */
export type VariableCategory =
  | 'datetime' // 日期时间：Date, Time, Today, Year, Month, Day, Hour, Minute, Weekday
  | 'system' // 系统信息：Username, System, Language, Arch, Port
  | 'model' // 模型相关：ModelName
  | 'cultural' // 文化相关：Lunar, Greeting, Festival
  | 'media' // 媒体资源：Stickers, xx表情包
  | 'plugin' // 插件变量：VCPWeatherInfo, VCPDailyHot, VCPAllTools 等
  | 'diary' // 日记变量：角色名日记本, 公共日记本, AllCharacterDiariesData
  | 'agent' // Agent 变量：Agent*, Tavern*
  | 'vcp' // VCP 扩展：Tar*, Var*, Sar*
  | 'flag' // 标志变量：ShowBase64, 控制行为的特殊标记

/**
 * 变量定义（用于文档和元数据）
 * @deprecated 运行时变量使用 VCPVariable 替代
 */
export interface VariableDefinition {
  /** 变量名（不含大括号） */
  name: string
  /** 别名列表（小写、中文等） */
  aliases?: string[]
  /** 类别 */
  category: VariableCategory
  /** 描述 */
  description: string
  /** 是否需要异步获取 */
  async?: boolean
  /** 是否仅在 system 角色生效 */
  systemRoleOnly?: boolean
  /** 变量来源（插件名） */
  source?: string
  /** 是否为动态变量（如 {{xx表情包}}） */
  dynamic?: boolean
  /** 动态变量模式 */
  pattern?: RegExp
}

/**
 * 变量解析上下文
 */
export interface VariableContext {
  /** 当前模型名称 */
  modelName?: string
  /** 用户名 */
  userName?: string
  /** 系统类型 */
  systemType?: string
  /** 语言 */
  language?: string
  /** 架构 */
  arch?: string
  /** 当前角色 */
  role?: 'system' | 'user' | 'assistant'
  /** 当前用户查询（用于 RAG/阈值） */
  currentQuery?: string
}

/**
 * 变量解析结果
 */
export interface VariableResolveResult {
  /** 解析后的文本 */
  text: string
  /** 解析的变量数量 */
  resolvedCount: number
  /** 未解析的变量（保留原样） */
  unresolvedVariables?: string[]
}

/**
 * 支持的基础变量列表
 */
export const BASIC_VARIABLES: VariableDefinition[] = [
  // ==================== 日期时间变量 ====================
  { name: 'Date', aliases: ['date'], category: 'datetime', description: '当前日期 (YYYY/M/D)' },
  { name: 'Time', aliases: ['time'], category: 'datetime', description: '当前时间 (HH:mm:ss)' },
  { name: 'Today', aliases: ['datetime'], category: 'datetime', description: '当天星期几（中文）' },
  { name: 'Year', category: 'datetime', description: '当前年份' },
  { name: 'Month', category: 'datetime', description: '当前月份 (01-12)' },
  { name: 'Day', category: 'datetime', description: '当前日期 (01-31)' },
  { name: 'Hour', category: 'datetime', description: '当前小时 (00-23)' },
  { name: 'Minute', category: 'datetime', description: '当前分钟 (00-59)' },
  { name: 'Weekday', aliases: ['weekday', '星期'], category: 'datetime', description: '星期几' },

  // ==================== 系统变量 ====================
  { name: 'Username', aliases: ['username'], category: 'system', description: '用户名', async: true },
  { name: 'System', aliases: ['system'], category: 'system', description: '系统类型', async: true },
  { name: 'Language', aliases: ['language'], category: 'system', description: '语言设置', async: true },
  { name: 'Arch', aliases: ['arch'], category: 'system', description: '系统架构', async: true },
  { name: 'Port', category: 'system', description: '服务器运行端口', async: true },

  // ==================== 模型变量 ====================
  { name: 'ModelName', aliases: ['model_name'], category: 'model', description: '模型名称' },

  // ==================== 文化变量 ====================
  { name: 'Lunar', aliases: ['lunar', '农历'], category: 'cultural', description: '农历日期' },
  { name: 'Greeting', aliases: ['greeting', '问候语'], category: 'cultural', description: '时段问候语' },
  { name: 'Festival', category: 'cultural', description: '农历日期、生肖、节气' },

  // ==================== 媒体变量 ====================
  { name: 'Stickers', aliases: ['stickers', '表情包'], category: 'media', description: '可用表情包列表', async: true },
  { name: 'Image_Key', category: 'media', description: '图床访问密钥', async: true },

  // ==================== 插件变量 ====================
  { name: 'VCPWeatherInfo', category: 'plugin', description: '天气预报文本（含预警、24小时、7日预报）', source: 'WeatherReporter', async: true },
  { name: 'VCPDailyHot', category: 'plugin', description: '全球热点新闻聚合', source: 'V日报', async: true },
  { name: 'VCPAllTools', category: 'plugin', description: '所有已加载 VCP 工具的完整描述', async: true },
  { name: 'VCPChromeObserver', category: 'plugin', description: '实时网页 DOM 的 Markdown 格式', source: 'ChromeObserver', async: true },
  { name: 'VCPFileServer', category: 'plugin', description: '文件列表及访问 URL 说明', source: 'FileListGenerator', async: true },

  // ==================== 日记变量 ====================
  { name: 'AllCharacterDiariesData', category: 'diary', description: '所有角色日记的 JSON 数据', source: 'DailyNoteGet', async: true },
  { name: '公共日记本', category: 'diary', description: '共享知识库的完整日记内容', async: true },

  // ==================== 标志变量 ====================
  { name: 'ShowBase64', category: 'flag', description: '跳过图片压缩，Base64 直接发送给模型' },

  // ==================== Tavern 角色卡变量 ====================
  { name: 'TavernCharacter', category: 'agent', description: '角色卡完整系统提示词', async: true },
  { name: 'TavernGreeting', category: 'agent', description: '角色卡首次问候语', async: true },
  { name: 'TavernExample', category: 'agent', description: '角色卡示例对话', async: true },
  { name: 'TavernPersonality', category: 'agent', description: '角色卡人格特征', async: true },
  { name: 'TavernScenario', category: 'agent', description: '角色卡场景设定', async: true },
  { name: 'TavernDescription', category: 'agent', description: '角色卡描述', async: true },
  { name: 'TavernName', category: 'agent', description: '角色卡名称', async: true },
  { name: 'TavernPostHistory', category: 'agent', description: '角色卡历史后置指令', async: true },

  // ==================== SillyTavern 兼容变量 ====================
  { name: 'char', category: 'agent', description: '当前角色名称（SillyTavern 兼容）', async: true },
  { name: 'user', category: 'agent', description: '当前用户名称（SillyTavern 兼容）', async: true },
  { name: 'persona', category: 'agent', description: '用户人设描述（SillyTavern 兼容）', async: true }
]

/**
 * 动态变量模式定义
 * 用于匹配 {{xx表情包}}、{{角色名日记本}} 等动态格式
 */
export const DYNAMIC_VARIABLE_PATTERNS: VariableDefinition[] = [
  {
    name: 'xx表情包',
    category: 'media',
    description: '特定表情包的图片文件名列表（以 | 分隔）',
    dynamic: true,
    pattern: /\{\{(.+?)表情包\}\}/g,
    async: true
  },
  {
    name: '角色名日记本',
    category: 'diary',
    description: '特定角色的完整日记内容',
    dynamic: true,
    pattern: /\{\{(.+?)日记本\}\}/g,
    async: true
  },
  {
    name: 'Agent*',
    category: 'agent',
    description: 'Agent 变量基座，支持富文本和嵌套占位符',
    dynamic: true,
    pattern: /\{\{Agent([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    async: true
  },
  {
    name: 'Agent:助手名',
    category: 'agent',
    description: '助手系统提示词模板（{{Agent:Nova}} 返回助手的完整 prompt）',
    dynamic: true,
    pattern: /\{\{Agent:([^:}]+)(?::([^}]*))?\}\}/g,
    async: true
  },
  {
    name: 'Tar*',
    category: 'vcp',
    description: '模板变量（最高优先级），支持嵌套解析',
    dynamic: true,
    pattern: /\{\{Tar([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    async: true
  },
  {
    name: 'Var*',
    category: 'vcp',
    description: '用户自定义全局变量',
    dynamic: true,
    pattern: /\{\{Var([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    async: true
  },
  {
    name: 'Sar*',
    category: 'vcp',
    description: '模型条件变量（根据当前模型匹配注入）',
    dynamic: true,
    pattern: /\{\{Sar([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    async: true
  },
  {
    name: 'VCPTavern::preset',
    category: 'agent',
    description: '激活 VCPTavern 上下文注入预设（{{VCPTavern::dailychat}}）',
    dynamic: true,
    pattern: /\{\{VCPTavern::([a-zA-Z0-9_-]+)\}\}/g,
    async: true
  }
]

/**
 * 构建变量名到定义的映射
 */
export function buildVariableMap(): Map<string, VariableDefinition> {
  const map = new Map<string, VariableDefinition>()

  for (const def of BASIC_VARIABLES) {
    // 添加主名称
    map.set(def.name, def)
    // 添加别名
    if (def.aliases) {
      for (const alias of def.aliases) {
        map.set(alias, def)
      }
    }
  }

  return map
}

/**
 * 获取所有支持的变量占位符格式
 */
export function getSupportedVariablePlaceholders(): string[] {
  const placeholders: string[] = []

  for (const def of BASIC_VARIABLES) {
    placeholders.push(`{{${def.name}}}`)
    if (def.aliases) {
      for (const alias of def.aliases) {
        placeholders.push(`{{${alias}}}`)
      }
    }
  }

  return placeholders
}
