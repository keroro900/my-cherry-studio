/**
 * WeightedSpeakerSelector - 加权随机发言选择器
 *
 * 实现智能的多 Agent 发言选择算法：
 * 1. 基础权重：每个 Agent 的默认发言概率
 * 2. @提及加成：被 @ 的 Agent 获得高额加成
 * 3. 关键词加成：消息中包含 Agent 关键词时加成
 * 4. 冷却惩罚：刚发言的 Agent 短期内降低权重
 * 5. 参与度加成：活跃参与的 Agent 获得奖励
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('WeightedSpeakerSelector')

/**
 * Agent 信息 (用于计算权重)
 */
export interface AgentInfo {
  id: string
  name: string
  displayName: string
  priority: number // 0-100
  expertise: string[]
  triggerKeywords: string[]
  role: 'host' | 'participant' | 'observer' | 'expert' | 'moderator'
}

/**
 * Agent 权重详情
 */
export interface AgentWeight {
  agentId: string
  baseWeight: number // 基础权重 (0-100)
  mentionBonus: number // @提及加成 (+50)
  keywordBonus: number // 关键词加成 (+30/词)
  cooldownPenalty: number // 冷却惩罚百分比 (0-1, 1=完全禁止)
  participationBonus: number // 参与度加成 (+10/轮, 最高+40)
  roleBonus: number // 角色加成
  finalWeight: number // 最终权重
}

/**
 * 发言历史记录
 */
interface SpeakingHistory {
  agentId: string
  timestamp: number
  round: number
}

/**
 * 选择器配置
 */
export interface SelectorConfig {
  /** 冷却轮数 (发言后多少轮内降低权重) */
  cooldownRounds: number
  /** 每轮冷却衰减系数 (0-1) */
  cooldownDecay: number
  /** @提及加成值 */
  mentionBonusValue: number
  /** 关键词加成值 (每个关键词) */
  keywordBonusValue: number
  /** 最大参与度加成 */
  maxParticipationBonus: number
  /** 每轮参与度加成 */
  participationBonusPerRound: number
  /** 是否允许连续发言 */
  allowConsecutiveSpeaking: boolean
  /** 最少选择人数 */
  minSpeakers: number
  /** 最多选择人数 */
  maxSpeakers: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SelectorConfig = {
  cooldownRounds: 3,
  cooldownDecay: 0.33,
  mentionBonusValue: 50,
  keywordBonusValue: 30,
  maxParticipationBonus: 40,
  participationBonusPerRound: 10,
  allowConsecutiveSpeaking: false,
  minSpeakers: 1,
  maxSpeakers: 3
}

/**
 * 角色权重加成
 */
const ROLE_BONUS: Record<string, number> = {
  host: 20, // 主持人更容易发言
  moderator: 15, // 协调者次之
  expert: 10, // 专家有一定加成
  participant: 0, // 普通参与者无加成
  observer: -20 // 观察者很少发言
}

/**
 * 加权发言选择器
 */
export class WeightedSpeakerSelector {
  private config: SelectorConfig
  private speakingHistory: SpeakingHistory[] = []
  private participationCounts: Map<string, number> = new Map()
  private currentRound: number = 0
  private lastSpeakerId: string | null = null

  constructor(config: Partial<SelectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('WeightedSpeakerSelector initialized', { config: this.config })
  }

  /**
   * 选择发言者
   */
  selectSpeakers(
    agents: AgentInfo[],
    userMessage: string,
    mentions: string[] = []
  ): { selected: AgentInfo[]; weights: AgentWeight[] } {
    if (agents.length === 0) {
      return { selected: [], weights: [] }
    }

    // 计算所有 Agent 的权重
    const weights = agents.map((agent) => this.calculateWeight(agent, userMessage, mentions))

    // 按权重排序
    weights.sort((a, b) => b.finalWeight - a.finalWeight)

    logger.debug('Calculated weights', {
      weights: weights.map((w) => ({
        agentId: w.agentId,
        final: w.finalWeight.toFixed(2),
        base: w.baseWeight,
        mention: w.mentionBonus,
        keyword: w.keywordBonus,
        cooldown: w.cooldownPenalty.toFixed(2),
        participation: w.participationBonus
      }))
    })

    // 选择发言者
    const selected = this.selectFromWeights(agents, weights)

    return { selected, weights }
  }

  /**
   * 计算单个 Agent 的权重
   */
  private calculateWeight(agent: AgentInfo, userMessage: string, mentions: string[]): AgentWeight {
    // 基础权重 = Agent 优先级
    const baseWeight = agent.priority

    // @提及加成
    const mentionBonus = this.calculateMentionBonus(agent, mentions)

    // 关键词加成
    const keywordBonus = this.calculateKeywordBonus(agent, userMessage)

    // 冷却惩罚
    const cooldownPenalty = this.calculateCooldownPenalty(agent.id)

    // 参与度加成
    const participationBonus = this.calculateParticipationBonus(agent.id)

    // 角色加成
    const roleBonus = ROLE_BONUS[agent.role] || 0

    // 最终权重计算公式
    // finalWeight = (baseWeight + roleBonus) * (1 - cooldownPenalty) + mentionBonus + keywordBonus + participationBonus
    const adjustedBase = Math.max(0, baseWeight + roleBonus)
    const finalWeight = adjustedBase * (1 - cooldownPenalty) + mentionBonus + keywordBonus + participationBonus

    return {
      agentId: agent.id,
      baseWeight,
      mentionBonus,
      keywordBonus,
      cooldownPenalty,
      participationBonus,
      roleBonus,
      finalWeight: Math.max(0, finalWeight)
    }
  }

  /**
   * 计算 @提及加成
   */
  private calculateMentionBonus(agent: AgentInfo, mentions: string[]): number {
    const isMentioned = mentions.some(
      (m) =>
        agent.name.toLowerCase().includes(m.toLowerCase()) || agent.displayName.toLowerCase().includes(m.toLowerCase())
    )
    return isMentioned ? this.config.mentionBonusValue : 0
  }

  /**
   * 计算关键词加成
   */
  private calculateKeywordBonus(agent: AgentInfo, userMessage: string): number {
    const lowerMessage = userMessage.toLowerCase()
    let bonus = 0

    // 检查触发关键词
    for (const keyword of agent.triggerKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        bonus += this.config.keywordBonusValue
      }
    }

    // 检查专业领域关键词
    for (const expertise of agent.expertise) {
      if (lowerMessage.includes(expertise.toLowerCase())) {
        bonus += this.config.keywordBonusValue * 0.5 // 专业领域加成较低
      }
    }

    return bonus
  }

  /**
   * 计算冷却惩罚
   */
  private calculateCooldownPenalty(agentId: string): number {
    // 不允许连续发言
    if (!this.config.allowConsecutiveSpeaking && this.lastSpeakerId === agentId) {
      return 1 // 完全禁止
    }

    // 查找最近发言记录
    const recentSpeaking = this.speakingHistory
      .filter((h) => h.agentId === agentId)
      .sort((a, b) => b.round - a.round)[0]

    if (!recentSpeaking) {
      return 0 // 无记录，无惩罚
    }

    const roundsSinceSpeaking = this.currentRound - recentSpeaking.round
    if (roundsSinceSpeaking >= this.config.cooldownRounds) {
      return 0 // 已过冷却期
    }

    // 线性衰减: 第1轮 100%, 第2轮 66%, 第3轮 33%
    const penalty = 1 - roundsSinceSpeaking * this.config.cooldownDecay
    return Math.max(0, Math.min(1, penalty))
  }

  /**
   * 计算参与度加成
   */
  private calculateParticipationBonus(agentId: string): number {
    const count = this.participationCounts.get(agentId) || 0
    return Math.min(count * this.config.participationBonusPerRound, this.config.maxParticipationBonus)
  }

  /**
   * 根据权重选择发言者
   */
  private selectFromWeights(agents: AgentInfo[], weights: AgentWeight[]): AgentInfo[] {
    const selected: AgentInfo[] = []
    const totalWeight = weights.reduce((sum, w) => sum + w.finalWeight, 0)

    if (totalWeight === 0) {
      // 所有权重为0，随机选择一个
      const randomAgent = agents[Math.floor(Math.random() * agents.length)]
      return [randomAgent]
    }

    // 使用加权随机选择
    const numToSelect = Math.min(Math.max(this.config.minSpeakers, 1), this.config.maxSpeakers, agents.length)

    // 复制权重数组以便修改
    const availableWeights = [...weights]

    for (let i = 0; i < numToSelect && availableWeights.length > 0; i++) {
      const selectedWeight = this.weightedRandomSelect(availableWeights)
      if (selectedWeight) {
        const agent = agents.find((a) => a.id === selectedWeight.agentId)
        if (agent) {
          selected.push(agent)
          // 从可用列表中移除已选择的
          const idx = availableWeights.findIndex((w) => w.agentId === selectedWeight.agentId)
          if (idx >= 0) {
            availableWeights.splice(idx, 1)
          }
        }
      }
    }

    return selected
  }

  /**
   * 加权随机选择
   */
  private weightedRandomSelect(weights: AgentWeight[]): AgentWeight | null {
    const totalWeight = weights.reduce((sum, w) => sum + w.finalWeight, 0)
    if (totalWeight === 0) return null

    let random = Math.random() * totalWeight
    for (const weight of weights) {
      random -= weight.finalWeight
      if (random <= 0) {
        return weight
      }
    }

    return weights[weights.length - 1]
  }

  /**
   * 记录发言
   */
  recordSpeaking(agentId: string): void {
    this.speakingHistory.push({
      agentId,
      timestamp: Date.now(),
      round: this.currentRound
    })
    this.lastSpeakerId = agentId

    // 更新参与度计数
    const count = this.participationCounts.get(agentId) || 0
    this.participationCounts.set(agentId, count + 1)

    logger.debug('Speaking recorded', { agentId, round: this.currentRound })
  }

  /**
   * 进入下一轮
   */
  nextRound(): void {
    this.currentRound++
    logger.debug('Advanced to next round', { round: this.currentRound })
  }

  /**
   * 重置选择器
   */
  reset(): void {
    this.speakingHistory = []
    this.participationCounts.clear()
    this.currentRound = 0
    this.lastSpeakerId = null
    logger.debug('Selector reset')
  }

  /**
   * 获取当前轮次
   */
  getCurrentRound(): number {
    return this.currentRound
  }

  /**
   * 获取发言历史
   */
  getSpeakingHistory(): SpeakingHistory[] {
    return [...this.speakingHistory]
  }
}

// 单例管理
const selectors: Map<string, WeightedSpeakerSelector> = new Map()

/**
 * 获取或创建选择器实例
 */
export function getWeightedSpeakerSelector(
  sessionId: string,
  config?: Partial<SelectorConfig>
): WeightedSpeakerSelector {
  if (!selectors.has(sessionId)) {
    selectors.set(sessionId, new WeightedSpeakerSelector(config))
  }
  return selectors.get(sessionId)!
}

/**
 * 销毁选择器实例
 */
export function destroyWeightedSpeakerSelector(sessionId: string): void {
  const selector = selectors.get(sessionId)
  if (selector) {
    selector.reset()
    selectors.delete(sessionId)
  }
}
