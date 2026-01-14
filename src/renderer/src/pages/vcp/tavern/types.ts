/**
 * Tavern UI 类型定义
 */

/**
 * 角色卡列表项 (从后端获取)
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
 * 角色卡详情 (从后端获取)
 */
export interface CharacterCard {
  id: string
  name: string
  spec: 'chara_card_v2' | 'chara_card_v3'
  avatar?: string
  pngPath?: string
  data: {
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    mes_example: string
    system_prompt: string
    post_history_instructions: string
    character_book?: WorldBook
    tags: string[]
    creator?: string
    creator_notes?: string
    extensions: Record<string, unknown>
  }
  createdAt: Date
  updatedAt: Date
  usageCount?: number
  lastUsedAt?: Date
  favorite?: boolean
  customTags?: string[]
}

/**
 * 世界书
 */
export interface WorldBook {
  name?: string
  description?: string
  entries: WorldBookEntry[]
  extensions?: Record<string, unknown>
}

/**
 * 世界书条目
 */
export interface WorldBookEntry {
  id?: number
  keys: string[]
  secondary_keys: string[]
  content: string
  enabled: boolean
  position: 'before_char' | 'after_char' | 'depth'
  depth?: number
  priority: number
  constant: boolean
  case_sensitive?: boolean
  comment?: string
  extensions?: Record<string, unknown>
}

/**
 * IPC 响应包装
 */
export interface TavernIpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 导入选项
 */
export interface ImportOptions {
  source: 'png' | 'json' | 'url'
  path: string
  overwrite?: boolean
  saveOriginalPng?: boolean
}
