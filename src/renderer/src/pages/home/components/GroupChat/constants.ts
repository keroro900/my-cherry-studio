/**
 * 群聊共享常量
 *
 * 集中管理群聊相关的常量定义，避免多处重复
 */

import type { SpeakingMode } from '@renderer/services/GroupChatService'

/**
 * 发言模式配置
 */
export const SPEAKING_MODES: { value: SpeakingMode; label: string; description: string }[] = [
  { value: 'sequential', label: '顺序发言', description: '按固定顺序轮流发言' },
  { value: 'random', label: '随机发言', description: '随机选择下一个发言者' },
  { value: 'naturerandom', label: '智能随机', description: 'VCP风格：@提及 > 关键词 > 概率加权' },
  { value: 'mention', label: '@提及', description: '被@的Agent发言' },
  { value: 'keyword', label: '关键词触发', description: '匹配关键词的Agent发言' },
  { value: 'invitation', label: '邀请发言', description: '由主持人指定发言者' },
  { value: 'consensus', label: '共识模式', description: '所有Agent都参与讨论' }
]

/**
 * Agent 角色颜色
 */
export const ROLE_COLORS: Record<string, string> = {
  host: '#f50',
  participant: '#2db7f5',
  observer: '#87d068',
  expert: '#722ed1',
  moderator: '#eb2f96'
}

/**
 * Agent 状态颜色
 */
export const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  idle: 'blue',
  thinking: 'orange',
  speaking: 'cyan',
  offline: 'default'
}

/**
 * 角色显示名称
 */
export const ROLE_LABELS: Record<string, string> = {
  host: '主持人',
  participant: '参与者',
  observer: '观察者',
  expert: '专家',
  moderator: '协调者'
}

/**
 * 默认群聊配置
 */
export const DEFAULT_GROUP_CHAT_CONFIG = {
  speakingMode: 'mention' as SpeakingMode,
  maxRounds: 10,
  maxSpeakersPerRound: 5,
  speakingCooldown: 1000,
  allowFreeDiscussion: true,
  requireConsensus: false,
  consensusThreshold: 0.8,
  timeout: 300000,
  showThinking: true,
  contextSharing: 'full' as const,
  flowLockCooldown: 30000
}
