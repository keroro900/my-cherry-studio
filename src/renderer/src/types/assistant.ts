/**
 * 统一 Assistant 类型定义
 *
 * 融合 Cherry Studio Assistant 和 VCP Agent 的概念
 * 核心理念: Assistant = Agent，助手即智能体
 *
 * @version 3.0.0 - 完全统一，无旧字段
 */

// ==================== 基础类型 ====================

/**
 * Agent 角色类型 (群聊场景)
 */
export type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'

/**
 * 记忆后端类型
 */
export type MemoryBackend = 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'knowledge' | 'memory'

/**
 * 语气风格
 */
export type ToneStyle = 'formal' | 'casual' | 'playful' | 'professional'

/**
 * 响应风格
 */
export type ResponseStyle = 'concise' | 'detailed' | 'adaptive'

// ==================== 配置子类型 ====================

/**
 * 人格配置 (用于角色扮演和人格化)
 */
export interface AssistantProfile {
  /** 绑定的角色卡 ID (Tavern Character Card) */
  characterCardId?: string
  /** 人格特质描述 */
  personality?: string
  /** 背景故事 */
  background?: string
  /** 问候语 */
  greetingMessage?: string
  /** 示例对话 (用于 few-shot learning) */
  exampleDialogues?: Array<{
    user: string
    assistant: string
  }>
  /** 语气风格 */
  tone?: ToneStyle
  /** 特征标签 */
  traits?: string[]
}

/**
 * 记忆配置
 */
export interface AssistantMemory {
  /** 是否启用记忆 */
  enabled: boolean
  /** 启用统一搜索 */
  enableUnifiedSearch?: boolean
  /** 标签权重提升因子 */
  tagBoost?: number
  /** 使用 RRF 融合 */
  useRRF?: boolean
  /** 关联的日记本名称 */
  diaryBookName?: string
  /** 日记本过滤器 (用于搜索时过滤) */
  diaryNameFilter?: string
  /** 启用的记忆后端 */
  backends?: MemoryBackend[]
  /** 检索结果数量 */
  topK?: number
  /** 记忆窗口大小 */
  windowSize?: number
}

/**
 * 工具配置
 */
export interface AssistantTools {
  /** MCP 服务器列表 - 兼容 MCPServer 类型 */
  mcpServers?: Array<{ id: string; name?: string; type?: string; [key: string]: any }>
  /** VCP 插件列表 */
  vcpPlugins?: string[]
  /** 自动批准所有工具调用 */
  autoApproveAll?: boolean
  /** 禁用自动批准的工具列表 */
  disabledTools?: string[]
  /** 启用网络搜索 */
  enableWebSearch?: boolean
  /** 网络搜索提供商 ID */
  webSearchProviderId?: string
  /** 启用 URL 上下文 (Gemini/Anthropic) */
  enableUrlContext?: boolean
  /** 启用图片生成 */
  enableGenerateImage?: boolean
}

/**
 * 发言偏好配置
 */
export interface SpeakingPreferences {
  /** 最大响应长度 */
  maxResponseLength?: number
  /** 偏好话题 */
  preferredTopics?: string[]
  /** 回避话题 */
  avoidTopics?: string[]
}

/**
 * 群聊配置
 */
export interface AssistantGroupChat {
  /** 是否启用群聊 */
  enabled: boolean
  /** 群聊角色 */
  role: AgentRole
  /** 专长领域 */
  expertise: string[]
  /** 触发关键词 */
  triggerKeywords: string[]
  /** 优先级 (0-100) */
  priority: number
  /** 发言偏好 */
  speakingPreferences?: SpeakingPreferences
}

/**
 * 协作配置 (用于多 Agent 通信)
 */
export interface AssistantCollaboration {
  /** 可主动发起与其他 Agent 的协作 */
  canInitiate?: boolean
  /** 可委托任务给其他 Agent */
  canDelegate?: boolean
  /** 最大并发任务数 */
  maxConcurrentTasks?: number
  /** 响应风格 */
  responseStyle?: ResponseStyle
  /** 可协作的 Agent ID 列表 (空表示可与所有 Agent 协作) */
  allowedAgents?: string[]
  /** 禁止协作的 Agent ID 列表 */
  blockedAgents?: string[]
  /** 协作消息前缀 (用于标识来源) */
  messagePrefix?: string
}

/**
 * VCP 特有配置
 */
export interface AssistantVCPConfig {
  /** VCP 功能启用状态 */
  enabled?: boolean
  /** 关联的知识库 ID */
  knowledgeBaseId?: string
  /** 关联的知识库名称 */
  knowledgeBaseName?: string
  /** 上下文注入 ID 列表 */
  contextInjections?: string[]
}

// ==================== 气泡主题类型 ====================

/**
 * 预设主题名称
 */
export type BubbleThemePreset =
  | 'default' // 默认主题
  | 'ocean' // 海洋蓝
  | 'forest' // 森林绿
  | 'sunset' // 日落橙
  | 'lavender' // 薰衣草紫
  | 'rose' // 玫瑰红
  | 'midnight' // 午夜黑
  | 'sakura' // 樱花粉
  | 'aurora' // 极光
  | 'neon' // 霓虹
  | 'custom' // 自定义

/**
 * 气泡主题配置
 * 用于每个 Agent 独立的消息气泡样式
 */
export interface AgentBubbleTheme {
  /** 预设主题 */
  preset?: BubbleThemePreset
  /** 主色调 */
  primaryColor?: string
  /** 背景色/渐变 */
  backgroundColor?: string
  /** 边框颜色 */
  borderColor?: string
  /** 文字颜色 */
  textColor?: string
  /** 头像边框颜色 */
  avatarBorderColor?: string
  /** 发光效果颜色 */
  glowColor?: string
  /** 是否启用毛玻璃效果 */
  enableGlassmorphism?: boolean
  /** 是否启用渐变边框 */
  enableGradientBorder?: boolean
  /** 边框渐变角度 */
  gradientAngle?: number
  /** 气泡圆角 */
  borderRadius?: number
  /** 自定义 CSS 类名 */
  customClassName?: string
}

/**
 * 预设主题配置
 */
export const BUBBLE_THEME_PRESETS: Record<BubbleThemePreset, Partial<AgentBubbleTheme>> = {
  default: {
    primaryColor: '#00d2ff',
    backgroundColor: 'linear-gradient(135deg, rgba(20, 30, 40, 0.7), rgba(30, 45, 55, 0.7))',
    borderColor: 'rgba(0, 210, 255, 0.25)',
    textColor: 'var(--color-text)',
    avatarBorderColor: '#00d2ff',
    glowColor: 'rgba(0, 210, 255, 0.3)',
    enableGlassmorphism: true,
    enableGradientBorder: false,
    borderRadius: 14
  },
  ocean: {
    primaryColor: '#0066cc',
    backgroundColor: 'linear-gradient(135deg, rgba(0, 40, 80, 0.7), rgba(0, 60, 100, 0.7))',
    borderColor: 'rgba(0, 102, 204, 0.35)',
    avatarBorderColor: '#0066cc',
    glowColor: 'rgba(0, 102, 204, 0.3)',
    enableGlassmorphism: true
  },
  forest: {
    primaryColor: '#2d8659',
    backgroundColor: 'linear-gradient(135deg, rgba(20, 50, 30, 0.7), rgba(30, 70, 45, 0.7))',
    borderColor: 'rgba(45, 134, 89, 0.35)',
    avatarBorderColor: '#2d8659',
    glowColor: 'rgba(45, 134, 89, 0.3)',
    enableGlassmorphism: true
  },
  sunset: {
    primaryColor: '#ff6b35',
    backgroundColor: 'linear-gradient(135deg, rgba(80, 30, 20, 0.7), rgba(100, 50, 30, 0.7))',
    borderColor: 'rgba(255, 107, 53, 0.35)',
    avatarBorderColor: '#ff6b35',
    glowColor: 'rgba(255, 107, 53, 0.3)',
    enableGlassmorphism: true
  },
  lavender: {
    primaryColor: '#9b59b6',
    backgroundColor: 'linear-gradient(135deg, rgba(50, 30, 60, 0.7), rgba(70, 45, 85, 0.7))',
    borderColor: 'rgba(155, 89, 182, 0.35)',
    avatarBorderColor: '#9b59b6',
    glowColor: 'rgba(155, 89, 182, 0.3)',
    enableGlassmorphism: true
  },
  rose: {
    primaryColor: '#e91e63',
    backgroundColor: 'linear-gradient(135deg, rgba(80, 20, 40, 0.7), rgba(100, 35, 55, 0.7))',
    borderColor: 'rgba(233, 30, 99, 0.35)',
    avatarBorderColor: '#e91e63',
    glowColor: 'rgba(233, 30, 99, 0.3)',
    enableGlassmorphism: true
  },
  midnight: {
    primaryColor: '#34495e',
    backgroundColor: 'linear-gradient(135deg, rgba(10, 15, 25, 0.8), rgba(25, 35, 50, 0.8))',
    borderColor: 'rgba(52, 73, 94, 0.4)',
    avatarBorderColor: '#5d7d9a',
    glowColor: 'rgba(93, 125, 154, 0.2)',
    enableGlassmorphism: true
  },
  sakura: {
    primaryColor: '#ffb7c5',
    backgroundColor: 'linear-gradient(135deg, rgba(60, 30, 40, 0.7), rgba(80, 45, 55, 0.7))',
    borderColor: 'rgba(255, 183, 197, 0.35)',
    avatarBorderColor: '#ffb7c5',
    glowColor: 'rgba(255, 183, 197, 0.3)',
    enableGlassmorphism: true
  },
  aurora: {
    primaryColor: '#00ff88',
    backgroundColor: 'linear-gradient(135deg, rgba(10, 40, 30, 0.7), rgba(20, 30, 60, 0.7))',
    borderColor: 'rgba(0, 255, 136, 0.25)',
    avatarBorderColor: '#00ff88',
    glowColor: 'rgba(0, 255, 136, 0.3)',
    enableGlassmorphism: true,
    enableGradientBorder: true,
    gradientAngle: 45
  },
  neon: {
    primaryColor: '#ff00ff',
    backgroundColor: 'linear-gradient(135deg, rgba(20, 10, 30, 0.8), rgba(30, 15, 45, 0.8))',
    borderColor: 'rgba(255, 0, 255, 0.4)',
    avatarBorderColor: '#ff00ff',
    glowColor: 'rgba(255, 0, 255, 0.4)',
    enableGlassmorphism: true,
    enableGradientBorder: true
  },
  custom: {}
}

/**
 * 获取主题配置
 */
export function getBubbleThemeConfig(theme?: AgentBubbleTheme): AgentBubbleTheme {
  if (!theme) return BUBBLE_THEME_PRESETS.default
  const preset = theme.preset || 'default'
  const presetConfig = BUBBLE_THEME_PRESETS[preset] || BUBBLE_THEME_PRESETS.default
  return { ...presetConfig, ...theme }
}

// ==================== 统一 Assistant 类型 ====================

/**
 * 统一 Assistant 类型
 *
 * 完全融合 Cherry Studio Assistant 和 VCP Agent
 */
export interface UnifiedAssistant {
  // ==================== 基础标识 ====================
  /** 唯一 ID */
  id: string
  /** 内部名称 (用于代码引用) */
  name: string
  /** 显示名称 */
  displayName: string
  /** 头像/图标 */
  avatar?: string
  /** 描述 */
  description?: string
  /** 标签 */
  tags?: string[]
  /** 分类 */
  category?: string

  // ==================== 核心配置 ====================
  /** 系统提示词 */
  systemPrompt: string
  /** 关联的模型 ID */
  modelId?: string
  /** 是否启用 */
  isActive: boolean

  // ==================== 统一配置模块 ====================
  /** 人格配置 */
  profile?: AssistantProfile
  /** 记忆配置 */
  memory?: AssistantMemory
  /** 工具配置 */
  tools?: AssistantTools
  /** 群聊配置 */
  groupChat?: AssistantGroupChat
  /** 协作配置 */
  collaboration?: AssistantCollaboration
  /** VCP 特有配置 */
  vcpConfig?: AssistantVCPConfig
  /** 气泡主题配置 */
  bubbleTheme?: AgentBubbleTheme

  // ==================== 知识库 ====================
  /** 关联的知识库列表 */
  knowledgeBases?: Array<{
    id: string
    name?: string
  }>

  // ==================== 元信息 ====================
  /** 版本 */
  version?: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

// ==================== 工具函数 ====================

/**
 * 检查助手是否启用了人格配置
 */
export function hasProfile(assistant: { profile?: AssistantProfile }): boolean {
  const profile = assistant.profile
  return !!(profile?.personality || profile?.background || profile?.greetingMessage)
}

/**
 * 检查助手是否启用了记忆
 */
export function hasMemory(assistant: { memory?: AssistantMemory }): boolean {
  return !!assistant.memory?.enabled
}

/**
 * 检查助手是否启用了群聊
 */
export function hasGroupChat(assistant: { groupChat?: AssistantGroupChat }): boolean {
  return !!assistant.groupChat?.enabled
}

/**
 * 检查助手是否配置了工具
 */
export function hasTools(assistant: { tools?: AssistantTools }): boolean {
  const tools = assistant.tools
  return !!(
    tools?.mcpServers?.length ||
    tools?.vcpPlugins?.length ||
    tools?.enableWebSearch ||
    tools?.enableGenerateImage
  )
}

/**
 * 创建默认的群聊配置
 */
export function createDefaultGroupChat(role: AgentRole = 'participant'): AssistantGroupChat {
  return {
    enabled: false,
    role,
    expertise: [],
    triggerKeywords: [],
    priority: 50
  }
}

/**
 * 创建默认的协作配置
 */
export function createDefaultCollaboration(): AssistantCollaboration {
  return {
    canInitiate: true,
    canDelegate: false,
    maxConcurrentTasks: 3,
    responseStyle: 'adaptive'
  }
}

/**
 * 创建默认的记忆配置
 */
export function createDefaultMemory(): AssistantMemory {
  return {
    enabled: false,
    enableUnifiedSearch: true,
    tagBoost: 1.5,
    useRRF: true,
    topK: 10,
    windowSize: 20
  }
}

// ==================== 类型守卫 ====================

/**
 * 检查是否为 UnifiedAssistant
 */
export function isUnifiedAssistant(obj: unknown): obj is UnifiedAssistant {
  if (!obj || typeof obj !== 'object') return false
  const a = obj as Record<string, unknown>
  return typeof a.id === 'string' && typeof a.systemPrompt === 'string'
}
