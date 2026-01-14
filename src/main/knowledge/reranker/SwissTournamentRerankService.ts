/**
 * SwissTournamentRerankService - 瑞士制 Rerank 评分服务
 *
 * 实现瑞士制锦标赛式多轮对比重排序：
 * 1. 第一轮随机/按初始分配对
 * 2. 后续轮次按当前积分配对 (相近积分对战)
 * 3. 多轮比较后按总积分排序
 *
 * 特点:
 * - 更公平的排序 (多轮比较减少偶然性)
 * - 渐进式收敛 (积分相近的文档互相比较)
 * - 可配置比较策略 (关键词/向量/AI)
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('SwissTournamentRerank')

// ==================== 类型定义 ====================

/**
 * 文档条目
 */
export interface TournamentDocument {
  id: string
  content: string
  originalScore?: number
  metadata?: Record<string, unknown>
}

/**
 * 参赛者状态
 */
interface Participant {
  document: TournamentDocument
  wins: number
  losses: number
  draws: number
  points: number
  opponents: Set<string>
  buchholz: number // 布赫霍尔茨系数 (对手积分和)
}

/**
 * 配对结果
 */
interface Pairing {
  player1: Participant
  player2: Participant
}

/**
 * 比赛结果
 */
type MatchResult = 'player1' | 'player2' | 'draw'

/**
 * 比较策略接口
 */
export interface ComparisonStrategy {
  /**
   * 比较两个文档相对于查询的相关性
   * @returns 正数表示 doc1 更相关，负数表示 doc2 更相关，0 表示平局
   */
  compare(query: string, doc1: TournamentDocument, doc2: TournamentDocument): Promise<number>
}

/**
 * 服务配置
 */
export interface SwissTournamentConfig {
  /** 比赛轮数 (默认 3) */
  rounds: number
  /** 胜利积分 (默认 3) */
  winPoints: number
  /** 平局积分 (默认 1) */
  drawPoints: number
  /** 失败积分 (默认 0) */
  lossPoints: number
  /** 判定平局的分差阈值 (默认 0.1) */
  drawThreshold: number
  /** 使用布赫霍尔茨系数作为次级排序 */
  useBuchholz: boolean
  /** 比较策略 */
  comparisonStrategy?: ComparisonStrategy
}

/**
 * 重排序结果
 */
export interface SwissTournamentResult {
  documents: TournamentDocument[]
  rankings: Array<{
    id: string
    points: number
    wins: number
    losses: number
    draws: number
    buchholz: number
    finalScore: number
  }>
  rounds: number
  totalComparisons: number
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: SwissTournamentConfig = {
  rounds: 3,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  drawThreshold: 0.1,
  useBuchholz: true
}

// ==================== 默认比较策略 ====================

/**
 * 关键词密度比较策略
 */
class KeywordDensityStrategy implements ComparisonStrategy {
  async compare(query: string, doc1: TournamentDocument, doc2: TournamentDocument): Promise<number> {
    const queryTerms = this.tokenize(query)
    const score1 = this.calculateDensity(queryTerms, doc1.content)
    const score2 = this.calculateDensity(queryTerms, doc2.content)
    return score1 - score2
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
  }

  private calculateDensity(queryTerms: string[], content: string): number {
    const contentLower = content.toLowerCase()
    let totalScore = 0

    for (const term of queryTerms) {
      // 计算位置分数 (越靠前越好)
      const firstIndex = contentLower.indexOf(term)
      if (firstIndex >= 0) {
        const positionScore = 1 - firstIndex / contentLower.length
        totalScore += positionScore

        // 计算密度分数 (出现次数)
        const matches = contentLower.split(term).length - 1
        totalScore += Math.min(matches / 3, 1) // 最多计算3次
      }
    }

    return totalScore / queryTerms.length || 0
  }
}

/**
 * 向量相似度比较策略 (需要预计算向量)
 */
export class VectorSimilarityStrategy implements ComparisonStrategy {
  async compare(_query: string, doc1: TournamentDocument, doc2: TournamentDocument): Promise<number> {
    const embedding1 = doc1.metadata?.embedding as number[] | undefined
    const embedding2 = doc2.metadata?.embedding as number[] | undefined

    if (!embedding1 || !embedding2) {
      // 降级到原始分数比较
      return (doc1.originalScore ?? 0) - (doc2.originalScore ?? 0)
    }

    const queryEmbedding = doc1.metadata?.queryEmbedding as number[] | undefined
    if (!queryEmbedding) {
      return (doc1.originalScore ?? 0) - (doc2.originalScore ?? 0)
    }

    const sim1 = this.cosineSimilarity(queryEmbedding, embedding1)
    const sim2 = this.cosineSimilarity(queryEmbedding, embedding2)

    return sim1 - sim2
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }
}

// ==================== 主服务类 ====================

export class SwissTournamentRerankService {
  private config: SwissTournamentConfig
  private comparisonStrategy: ComparisonStrategy

  constructor(config: Partial<SwissTournamentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.comparisonStrategy = this.config.comparisonStrategy ?? new KeywordDensityStrategy()
    logger.info('SwissTournamentRerankService initialized', { config: this.config })
  }

  /**
   * 执行瑞士制重排序
   */
  async rerank(query: string, documents: TournamentDocument[]): Promise<SwissTournamentResult> {
    if (documents.length < 2) {
      return {
        documents,
        rankings: documents.map((doc) => ({
          id: doc.id,
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          buchholz: 0,
          finalScore: doc.originalScore ?? 0
        })),
        rounds: 0,
        totalComparisons: 0
      }
    }

    // 初始化参赛者
    const participants = this.initializeParticipants(documents)

    // 确定实际轮数 (不超过参赛者数-1)
    const actualRounds = Math.min(this.config.rounds, documents.length - 1)

    let totalComparisons = 0

    // 执行多轮比赛
    for (let round = 1; round <= actualRounds; round++) {
      logger.debug(`Starting round ${round}/${actualRounds}`)

      // 瑞士制配对
      const pairings = this.swissPairing(participants, round === 1)

      // 执行本轮所有比赛
      for (const pairing of pairings) {
        const result = await this.runMatch(query, pairing)
        this.applyMatchResult(pairing, result)
        totalComparisons++
      }

      // 更新布赫霍尔茨系数
      if (this.config.useBuchholz) {
        this.updateBuchholz(participants)
      }
    }

    // 最终排序
    const sortedParticipants = this.finalSort(participants)

    // 构建结果
    const rankings = sortedParticipants.map((p) => ({
      id: p.document.id,
      points: p.points,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      buchholz: p.buchholz,
      finalScore: this.calculateFinalScore(p)
    }))

    const sortedDocuments = sortedParticipants.map((p) => p.document)

    logger.info('Tournament completed', {
      rounds: actualRounds,
      participants: documents.length,
      totalComparisons
    })

    return {
      documents: sortedDocuments,
      rankings,
      rounds: actualRounds,
      totalComparisons
    }
  }

  /**
   * 初始化参赛者
   */
  private initializeParticipants(documents: TournamentDocument[]): Map<string, Participant> {
    const participants = new Map<string, Participant>()

    for (const doc of documents) {
      participants.set(doc.id, {
        document: doc,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        opponents: new Set(),
        buchholz: 0
      })
    }

    return participants
  }

  /**
   * 瑞士制配对算法
   */
  private swissPairing(participants: Map<string, Participant>, isFirstRound: boolean): Pairing[] {
    const pairings: Pairing[] = []
    const participantList = Array.from(participants.values())

    // 第一轮随机配对，后续按积分配对
    if (isFirstRound) {
      // 按原始分数排序后折叠配对 (高分对中等分)
      participantList.sort((a, b) => (b.document.originalScore ?? 0) - (a.document.originalScore ?? 0))
    } else {
      // 按当前积分排序 (积分相近的配对)
      participantList.sort((a, b) => {
        const pointDiff = b.points - a.points
        if (pointDiff !== 0) return pointDiff
        // 积分相同按布赫霍尔茨排序
        return b.buchholz - a.buchholz
      })
    }

    // 贪心配对 (避免重复对战)
    const paired = new Set<string>()

    for (let i = 0; i < participantList.length; i++) {
      const p1 = participantList[i]
      if (paired.has(p1.document.id)) continue

      // 寻找最佳对手
      for (let j = i + 1; j < participantList.length; j++) {
        const p2 = participantList[j]
        if (paired.has(p2.document.id)) continue

        // 检查是否已交手
        if (p1.opponents.has(p2.document.id)) continue

        // 配对成功
        pairings.push({ player1: p1, player2: p2 })
        paired.add(p1.document.id)
        paired.add(p2.document.id)
        break
      }
    }

    // 处理轮空 (奇数参赛者)
    for (const p of participantList) {
      if (!paired.has(p.document.id)) {
        // 轮空者获得平局积分
        p.draws++
        p.points += this.config.drawPoints
        logger.debug('Bye awarded', { id: p.document.id })
      }
    }

    return pairings
  }

  /**
   * 执行单场比赛
   */
  private async runMatch(query: string, pairing: Pairing): Promise<MatchResult> {
    const { player1, player2 } = pairing

    try {
      const score = await this.comparisonStrategy.compare(query, player1.document, player2.document)

      if (Math.abs(score) < this.config.drawThreshold) {
        return 'draw'
      }

      return score > 0 ? 'player1' : 'player2'
    } catch (error) {
      logger.warn('Comparison failed, treating as draw', { error })
      return 'draw'
    }
  }

  /**
   * 应用比赛结果
   */
  private applyMatchResult(pairing: Pairing, result: MatchResult): void {
    const { player1, player2 } = pairing

    // 记录对手
    player1.opponents.add(player2.document.id)
    player2.opponents.add(player1.document.id)

    switch (result) {
      case 'player1':
        player1.wins++
        player1.points += this.config.winPoints
        player2.losses++
        player2.points += this.config.lossPoints
        break
      case 'player2':
        player2.wins++
        player2.points += this.config.winPoints
        player1.losses++
        player1.points += this.config.lossPoints
        break
      case 'draw':
        player1.draws++
        player1.points += this.config.drawPoints
        player2.draws++
        player2.points += this.config.drawPoints
        break
    }
  }

  /**
   * 更新布赫霍尔茨系数
   */
  private updateBuchholz(participants: Map<string, Participant>): void {
    for (const participant of participants.values()) {
      let buchholz = 0
      for (const opponentId of participant.opponents) {
        const opponent = participants.get(opponentId)
        if (opponent) {
          buchholz += opponent.points
        }
      }
      participant.buchholz = buchholz
    }
  }

  /**
   * 最终排序
   */
  private finalSort(participants: Map<string, Participant>): Participant[] {
    const list = Array.from(participants.values())

    return list.sort((a, b) => {
      // 1. 按积分
      const pointDiff = b.points - a.points
      if (pointDiff !== 0) return pointDiff

      // 2. 按布赫霍尔茨
      if (this.config.useBuchholz) {
        const buchDiff = b.buchholz - a.buchholz
        if (buchDiff !== 0) return buchDiff
      }

      // 3. 按胜场
      const winDiff = b.wins - a.wins
      if (winDiff !== 0) return winDiff

      // 4. 按原始分数
      return (b.document.originalScore ?? 0) - (a.document.originalScore ?? 0)
    })
  }

  /**
   * 计算最终分数 (归一化到 0-1)
   */
  private calculateFinalScore(participant: Participant): number {
    const maxPoints = this.config.rounds * this.config.winPoints
    const normalizedPoints = maxPoints > 0 ? participant.points / maxPoints : 0

    // 结合原始分数
    const originalScore = participant.document.originalScore ?? 0
    const normalizedOriginal = Math.min(originalScore, 1)

    // 加权: 70% 锦标赛分数 + 30% 原始分数
    return 0.7 * normalizedPoints + 0.3 * normalizedOriginal
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SwissTournamentConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.comparisonStrategy) {
      this.comparisonStrategy = config.comparisonStrategy
    }
    logger.info('Config updated', { config: this.config })
  }

  /**
   * 设置比较策略
   */
  setComparisonStrategy(strategy: ComparisonStrategy): void {
    this.comparisonStrategy = strategy
  }

  /**
   * 获取当前配置
   */
  getConfig(): SwissTournamentConfig {
    return { ...this.config }
  }
}

// ==================== 便捷函数 ====================

let defaultService: SwissTournamentRerankService | null = null

export function getSwissTournamentRerankService(): SwissTournamentRerankService {
  if (!defaultService) {
    defaultService = new SwissTournamentRerankService()
  }
  return defaultService
}

/**
 * 快捷重排序函数
 */
export async function swissRerank(
  query: string,
  documents: TournamentDocument[],
  config?: Partial<SwissTournamentConfig>
): Promise<SwissTournamentResult> {
  const service = config ? new SwissTournamentRerankService(config) : getSwissTournamentRerankService()
  return service.rerank(query, documents)
}

/**
 * 创建 AI 比较策略 (需要外部 API)
 */
export function createAIComparisonStrategy(
  compareFn: (query: string, doc1: string, doc2: string) => Promise<number>
): ComparisonStrategy {
  return {
    async compare(query: string, doc1: TournamentDocument, doc2: TournamentDocument): Promise<number> {
      return compareFn(query, doc1.content, doc2.content)
    }
  }
}
