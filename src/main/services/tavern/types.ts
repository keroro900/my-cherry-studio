/**
 * VCPTavern 类型定义
 *
 * 基于 SillyTavern Character Card V2/V3 规范
 * https://github.com/malfoyslastname/character-card-spec-v2
 */

// ============================================================================
// TavernCard V2 (SillyTavern 规范)
// ============================================================================

/**
 * TavernCard V2 完整结构
 */
export interface TavernCardV2 {
  spec: 'chara_card_v2'
  spec_version: '2.0'
  data: TavernCardV2Data
}

/**
 * TavernCard V2 数据字段
 */
export interface TavernCardV2Data {
  /** 角色名称 */
  name: string
  /** 角色描述 (外貌、背景等) */
  description: string
  /** 角色性格 */
  personality: string
  /** 场景设定 */
  scenario: string
  /** 首条消息 (角色第一句话) */
  first_mes: string
  /** 示例对话 */
  mes_example: string
  /** 创作者备注 (不注入到 prompt) */
  creator_notes: string
  /** 系统提示词 */
  system_prompt: string
  /** 历史后指令 (在对话历史之后注入) */
  post_history_instructions: string
  /** 备用问候语 */
  alternate_greetings: string[]
  /** 角色世界书 */
  character_book?: WorldBook
  /** 标签 */
  tags: string[]
  /** 创作者 */
  creator: string
  /** 角色版本 */
  character_version: string
  /** 扩展数据 */
  extensions: Record<string, unknown>
}

// ============================================================================
// TavernCard V3 (扩展规范)
// ============================================================================

/**
 * TavernCard V3 完整结构
 */
export interface TavernCardV3 {
  spec: 'chara_card_v3'
  spec_version: '3.0'
  data: TavernCardV3Data
}

/**
 * TavernCard V3 数据字段
 */
export interface TavernCardV3Data extends TavernCardV2Data {
  /** 角色资产 (图片、音频等) */
  assets?: CharacterAsset[]
  /** 角色书创作者 */
  character_book_creator?: string
  /** 角色书版本 */
  character_book_version?: string
  /** 组信息 (用于多角色卡) */
  group_only_greetings?: string[]
  /** 表情包 */
  expressions?: Record<string, string>
}

/**
 * 角色资产
 */
export interface CharacterAsset {
  /** 资产名称 */
  name: string
  /** 资产类型 */
  type: 'icon' | 'portrait' | 'avatar' | 'background' | 'audio' | 'video' | 'other'
  /** 资产 URI (可以是 data: URL 或外部链接) */
  uri: string
  /** 资产描述 */
  description?: string
}

// ============================================================================
// WorldBook (世界书)
// ============================================================================

/**
 * 世界书
 */
export interface WorldBook {
  /** 世界书名称 */
  name?: string
  /** 世界书描述 */
  description?: string
  /** 扫描深度 (向前扫描多少条消息) */
  scan_depth?: number
  /** Token 预算 */
  token_budget?: number
  /** 是否递归扫描 (扫描已注入内容) */
  recursive_scanning?: boolean
  /** 扩展数据 */
  extensions: Record<string, unknown>
  /** 世界书条目 */
  entries: WorldBookEntry[]
}

/**
 * 世界书条目
 */
export interface WorldBookEntry {
  /** 条目 ID */
  id: number
  /** 主触发关键词 */
  keys: string[]
  /** 二级关键词 (需要与主关键词同时匹配) */
  secondary_keys: string[]
  /** 注入内容 */
  content: string
  /** 是否启用 */
  enabled: boolean
  /** 注入位置 */
  position: WorldBookPosition
  /** 深度 (仅 depth 位置有效) */
  depth?: number
  /** 排序优先级 */
  insertion_order: number
  /** 是否区分大小写 */
  case_sensitive: boolean
  /** 选择性触发优先级 */
  priority: number
  /** 备注 */
  comment: string
  /** 是否选择性触发 (需要二级关键词) */
  selective: boolean
  /** 是否常驻 (始终注入) */
  constant: boolean
  /** 扩展数据 */
  extensions?: Record<string, unknown>
}

/**
 * 世界书注入位置
 */
export type WorldBookPosition =
  | 'before_char' // 在角色定义之前
  | 'after_char' // 在角色定义之后
  | 'before_system' // 在系统消息之前
  | 'after_system' // 在系统消息之后
  | 'before_example' // 在示例对话之前
  | 'after_example' // 在示例对话之后
  | 'depth' // 按消息深度注入

// ============================================================================
// Preset (注入预设)
// ============================================================================

/**
 * 注入预设
 */
export interface TavernPreset {
  /** 预设 ID */
  id: string
  /** 预设名称 */
  name: string
  /** 预设描述 */
  description?: string
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 注入规则列表 */
  rules: InjectionRule[]
  /** 是否启用 */
  enabled: boolean
}

/**
 * 注入规则
 */
export interface InjectionRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 规则类型 */
  type: 'relative' | 'depth'
  /** 注入位置 (relative 类型) */
  relativePosition?: 'before' | 'after'
  /** 注入目标 (relative 类型) */
  relativeTarget?: 'system' | 'last_user' | 'last_assistant' | 'first_user'
  /** 深度值 (depth 类型) */
  depth?: number
  /** 注入内容 */
  content: InjectionContent
  /** 触发条件 (可选) */
  conditions?: InjectionCondition[]
  /** 排序优先级 */
  priority: number
}

/**
 * 注入内容
 */
export interface InjectionContent {
  /** 消息角色 */
  role: 'system' | 'user' | 'assistant'
  /** 消息内容 */
  content: string
}

/**
 * 注入条件
 */
export interface InjectionCondition {
  /** 条件类型 */
  type: 'keyword' | 'regex' | 'context_length' | 'message_count'
  /** 条件值 */
  value: string | number
  /** 是否取反 */
  negate?: boolean
}

// ============================================================================
// CharacterCard (角色卡管理)
// ============================================================================

/**
 * 角色卡 (存储格式)
 */
export interface CharacterCard {
  /** 角色卡 ID */
  id: string
  /** 角色名称 */
  name: string
  /** 头像路径 */
  avatar?: string
  /** 原始 PNG 路径 */
  pngPath?: string
  /** 卡片版本 */
  spec: 'chara_card_v2' | 'chara_card_v3'
  /** 卡片数据 */
  data: TavernCardV2Data | TavernCardV3Data
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 是否收藏 */
  favorite?: boolean
  /** 自定义标签 */
  customTags?: string[]
  /** 使用次数 */
  usageCount?: number
  /** 最后使用时间 */
  lastUsedAt?: Date
}

/**
 * 角色卡列表项 (简略信息)
 */
export interface CharacterCardListItem {
  id: string
  name: string
  avatar?: string
  spec: 'chara_card_v2' | 'chara_card_v3'
  tags: string[]
  creator?: string
  favorite?: boolean
  usageCount?: number
  lastUsedAt?: Date
}

/**
 * 角色卡导入选项
 */
export interface CharacterCardImportOptions {
  /** 导入源类型 */
  source: 'png' | 'json' | 'url'
  /** 文件路径或 URL */
  path: string
  /** 是否覆盖同名角色 */
  overwrite?: boolean
  /** 是否保存原始 PNG */
  saveOriginalPng?: boolean
}

/**
 * 角色卡导出选项
 */
export interface CharacterCardExportOptions {
  /** 导出格式 */
  format: 'png' | 'json'
  /** 是否包含世界书 */
  includeWorldBook?: boolean
  /** 导出路径 */
  outputPath?: string
}

// ============================================================================
// WorldBook Engine
// ============================================================================

/**
 * 世界书匹配结果
 */
export interface WorldBookMatchResult {
  /** 匹配的条目 */
  entry: WorldBookEntry
  /** 匹配到的关键词 */
  matchedKeys: string[]
  /** 匹配分数 */
  score: number
  /** 是否由常驻触发 */
  isConstant: boolean
}

/**
 * 世界书匹配选项
 */
export interface WorldBookMatchOptions {
  /** 扫描深度 (默认使用世界书设置) */
  scanDepth?: number
  /** Token 预算 (默认使用世界书设置) */
  tokenBudget?: number
  /** 是否启用递归扫描 */
  recursiveScanning?: boolean
  /** 额外上下文 (用于递归扫描) */
  additionalContext?: string
}

/**
 * 世界书注入结果
 */
export interface WorldBookInjectionResult {
  /** 注入的条目 */
  injectedEntries: WorldBookMatchResult[]
  /** 总 Token 数 */
  totalTokens: number
  /** 是否超出预算 */
  budgetExceeded: boolean
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * CharacterCardService 配置
 */
export interface CharacterCardServiceConfig {
  /** 角色卡存储目录 */
  storageDir: string
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 缓存大小限制 */
  cacheLimit?: number
}

/**
 * PresetManager 配置
 */
export interface PresetManagerConfig {
  /** 预设存储目录 */
  storageDir: string
}

/**
 * WorldBookEngine 配置
 */
export interface WorldBookEngineConfig {
  /** 默认扫描深度 */
  defaultScanDepth?: number
  /** 默认 Token 预算 */
  defaultTokenBudget?: number
  /** Token 计算器 */
  tokenCounter?: (text: string) => number
}

// ============================================================================
// IPC Types
// ============================================================================

/**
 * IPC 响应
 */
export interface TavernIpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 角色卡搜索参数
 */
export interface CharacterCardSearchParams {
  /** 搜索关键词 */
  query?: string
  /** 标签过滤 */
  tags?: string[]
  /** 是否只显示收藏 */
  favoritesOnly?: boolean
  /** 排序字段 */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
  /** 分页偏移 */
  offset?: number
  /** 分页大小 */
  limit?: number
}
