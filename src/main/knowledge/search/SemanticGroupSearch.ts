/**
 * 语义组增强检索服务
 * 基于 VCPToolBox 的 ::Group 功能
 *
 * 功能:
 * 1. 预定义关键词组 (颜色/图案/版型/风格)
 * 2. 加权融合生成增强查询向量
 * 3. 「语义捕获网」扩大召回
 */

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

const logger = loggerService.withContext('SemanticGroupSearch')

/**
 * 语义组类型
 */
export type SemanticGroupType = 'color' | 'pattern' | 'silhouette' | 'style' | 'material' | 'occasion' | 'season'

/**
 * 语义词组定义
 */
export interface SemanticGroup {
  type: SemanticGroupType
  name: string
  keywords: string[] // 关键词列表
  weight?: number // 组权重 (默认 1.0)
}

/**
 * 语义组配置
 */
export interface SemanticGroupConfig {
  enabled: boolean
  groups: SemanticGroupType[] // 启用的组类型
  expansionWeight?: number // 扩展权重 (0-1)
  minMatchScore?: number // 最小匹配分数
}

/**
 * 语义组匹配结果
 */
export interface SemanticGroupMatch {
  groupType: SemanticGroupType
  matchedKeywords: string[]
  weight: number
  subGroup?: string // 子组 (如 color.warm)
}

/**
 * 语义组增强结果
 */
export interface SemanticGroupResult {
  originalScore: number
  enhancedScore: number
  matchedGroups: SemanticGroupMatch[]
  expandedQuery?: string
}

/**
 * Fashion 领域预定义语义词组
 * 基于 VCPToolBox 的语义组设计
 */
export const FASHION_SEMANTIC_GROUPS: Record<SemanticGroupType, Record<string, string[]>> = {
  color: {
    warm: [
      '红色',
      '橙色',
      '黄色',
      '珊瑚色',
      '勃艮第',
      'red',
      'orange',
      'yellow',
      'coral',
      'burgundy',
      'rust',
      'terracotta'
    ],
    cool: ['蓝色', '绿色', '紫色', '青色', '海军蓝', 'blue', 'green', 'purple', 'teal', 'navy', 'mint', 'lavender'],
    neutral: [
      '黑色',
      '白色',
      '灰色',
      '米色',
      '裸色',
      '驼色',
      'black',
      'white',
      'gray',
      'beige',
      'nude',
      'camel',
      'taupe',
      'ivory'
    ],
    metallic: ['金色', '银色', '铜色', '玫瑰金', 'gold', 'silver', 'bronze', 'rose gold', 'metallic'],
    pastel: ['粉色', '淡蓝', '淡紫', '淡黄', 'pink', 'baby blue', 'lilac', 'pale yellow', 'pastel']
  },

  pattern: {
    floral: ['碎花', '花卉', '印花', '玫瑰', '雏菊', 'floral', 'flower', 'botanical', 'rose', 'daisy', 'tropical'],
    geometric: ['条纹', '格纹', '几何', '方格', '菱形', 'stripes', 'plaid', 'check', 'geometric', 'diamond', 'chevron'],
    abstract: ['抽象', '波点', '扎染', '渐变', 'abstract', 'polka dot', 'tie-dye', 'gradient', 'marble', 'watercolor'],
    animal: ['豹纹', '蛇纹', '斑马纹', '虎纹', 'leopard', 'snake', 'zebra', 'tiger', 'animal print', 'python'],
    ethnic: ['民族', '波西米亚', '部落', '刺绣', 'ethnic', 'bohemian', 'tribal', 'embroidered', 'paisley', 'ikat']
  },

  silhouette: {
    fitted: ['修身', '贴身', '紧身', '包臀', 'fitted', 'slim', 'bodycon', 'skinny', 'tight', 'form-fitting'],
    relaxed: ['宽松', '休闲', '飘逸', '慵懒', 'relaxed', 'loose', 'oversized', 'flowy', 'baggy', 'slouchy'],
    structured: ['廓形', '工装', '硬挺', '立体', 'structured', 'tailored', 'boxy', 'architectural', 'sculpted'],
    aline: ['A字', '伞裙', '喇叭', '鱼尾', 'a-line', 'flare', 'trumpet', 'mermaid', 'swing', 'circle'],
    asymmetric: ['不对称', '斜裁', '单肩', 'asymmetric', 'diagonal', 'one-shoulder', 'uneven', 'draped']
  },

  style: {
    casual: ['休闲', '日常', '基础', '简约', 'casual', 'everyday', 'basic', 'minimal', 'effortless'],
    streetwear: ['街头', '潮流', '运动休闲', '嘻哈', 'streetwear', 'urban', 'athleisure', 'hip-hop', 'sporty'],
    romantic: ['浪漫', '甜美', '复古', '蕾丝', 'romantic', 'feminine', 'boho', 'lace', 'vintage', 'cottagecore'],
    formal: ['正式', '商务', '优雅', '晚装', 'formal', 'business', 'elegant', 'evening', 'cocktail', 'black-tie'],
    edgy: ['前卫', '朋克', '哥特', '摇滚', 'edgy', 'punk', 'gothic', 'rock', 'grunge', 'avant-garde']
  },

  material: {
    natural: ['棉', '麻', '丝绸', '羊毛', '羊绒', 'cotton', 'linen', 'silk', 'wool', 'cashmere', 'hemp'],
    synthetic: ['聚酯', '尼龙', '氨纶', '人造丝', 'polyester', 'nylon', 'spandex', 'rayon', 'acrylic'],
    leather: ['皮革', '麂皮', '漆皮', '仿皮', 'leather', 'suede', 'patent', 'faux leather', 'vegan leather'],
    denim: ['牛仔', '丹宁', '水洗', '做旧', 'denim', 'jeans', 'washed', 'distressed', 'raw denim'],
    knit: ['针织', '毛衣', '编织', '罗纹', 'knit', 'sweater', 'woven', 'ribbed', 'cable knit', 'crochet']
  },

  occasion: {
    work: ['办公', '职场', '会议', '商务', 'work', 'office', 'meeting', 'business', 'professional'],
    party: ['派对', '晚会', '聚会', '庆典', 'party', 'evening', 'celebration', 'gala', 'cocktail'],
    beach: ['海滩', '度假', '泳装', '热带', 'beach', 'vacation', 'swimwear', 'tropical', 'resort'],
    sport: ['运动', '健身', '户外', '跑步', 'sport', 'fitness', 'outdoor', 'running', 'yoga', 'gym'],
    date: ['约会', '浪漫', '晚餐', '情侣', 'date', 'romantic', 'dinner', 'couple', 'anniversary']
  },

  season: {
    spring: ['春季', '春装', '樱花', '复苏', 'spring', 'bloom', 'cherry blossom', 'renewal', 'fresh'],
    summer: ['夏季', '夏装', '清凉', '阳光', 'summer', 'cool', 'sunny', 'lightweight', 'breathable'],
    fall: ['秋季', '秋装', '落叶', '丰收', 'fall', 'autumn', 'harvest', 'layering', 'cozy'],
    winter: ['冬季', '冬装', '保暖', '雪', 'winter', 'warm', 'snow', 'cozy', 'layered', 'cold weather']
  }
}

export class SemanticGroupSearchService {
  private config: SemanticGroupConfig
  private groupIndex: Map<string, { type: SemanticGroupType; subGroup: string }>

  constructor(config?: Partial<SemanticGroupConfig>) {
    this.config = {
      enabled: true,
      groups: ['color', 'pattern', 'silhouette', 'style'],
      expansionWeight: 0.3,
      minMatchScore: 0.5,
      ...config
    }

    // 构建关键词索引
    this.groupIndex = this.buildGroupIndex()
  }

  /**
   * 构建关键词到组的索引
   */
  private buildGroupIndex(): Map<string, { type: SemanticGroupType; subGroup: string }> {
    const index = new Map<string, { type: SemanticGroupType; subGroup: string }>()

    for (const [type, subGroups] of Object.entries(FASHION_SEMANTIC_GROUPS)) {
      for (const [subGroup, keywords] of Object.entries(subGroups)) {
        for (const keyword of keywords) {
          const normalizedKeyword = keyword.toLowerCase()
          index.set(normalizedKeyword, {
            type: type as SemanticGroupType,
            subGroup
          })
        }
      }
    }

    logger.debug('Group index built', { keywordCount: index.size })
    return index
  }

  /**
   * 从查询中提取语义组匹配
   */
  extractSemanticGroups(query: string): SemanticGroupMatch[] {
    const normalizedQuery = query.toLowerCase()
    const matches: SemanticGroupMatch[] = []
    const matchedByType = new Map<SemanticGroupType, SemanticGroupMatch>()

    for (const [keyword, info] of this.groupIndex.entries()) {
      if (normalizedQuery.includes(keyword) && this.config.groups.includes(info.type)) {
        const existing = matchedByType.get(info.type)

        if (existing) {
          // 合并到现有匹配
          if (!existing.matchedKeywords.includes(keyword)) {
            existing.matchedKeywords.push(keyword)
            existing.weight = Math.min(1.0, existing.weight + 0.2) // 增加权重
          }
        } else {
          // 创建新匹配
          matchedByType.set(info.type, {
            groupType: info.type,
            matchedKeywords: [keyword],
            weight: 0.5,
            subGroup: info.subGroup
          })
        }
      }
    }

    matches.push(...matchedByType.values())

    logger.debug('Extracted semantic groups', {
      query: query.substring(0, 50),
      matchCount: matches.length,
      groups: matches.map((m) => m.groupType)
    })

    return matches
  }

  /**
   * 扩展语义组关键词
   * 获取同一子组中的相关关键词
   */
  expandGroupKeywords(matches: SemanticGroupMatch[]): string[] {
    const expanded: string[] = []

    for (const match of matches) {
      const subGroups = FASHION_SEMANTIC_GROUPS[match.groupType]
      if (match.subGroup && subGroups[match.subGroup]) {
        // 添加同子组的其他关键词
        const keywords = subGroups[match.subGroup]
        for (const keyword of keywords) {
          if (!match.matchedKeywords.includes(keyword.toLowerCase())) {
            expanded.push(keyword)
          }
        }
      }
    }

    return [...new Set(expanded)] // 去重
  }

  /**
   * 生成增强查询
   * 将原始查询与扩展关键词融合
   */
  generateEnhancedQuery(query: string, expandedKeywords: string[]): string {
    if (expandedKeywords.length === 0) {
      return query
    }

    // 限制扩展关键词数量
    const limitedKeywords = expandedKeywords.slice(0, 5)

    // 构建增强查询
    // 格式: "原始查询 | 扩展词1 扩展词2 ..."
    const expansion = limitedKeywords.join(' ')

    return `${query} | ${expansion}`
  }

  /**
   * 应用语义组增强到搜索结果
   */
  applySemanticGroupEnhancement(
    query: string,
    results: KnowledgeSearchResult[],
    config?: Partial<SemanticGroupConfig>
  ): Array<KnowledgeSearchResult & { semanticGroupResult?: SemanticGroupResult }> {
    const mergedConfig = { ...this.config, ...config }

    if (!mergedConfig.enabled || results.length === 0) {
      return results
    }

    // 1. 从查询中提取语义组匹配
    const queryMatches = this.extractSemanticGroups(query)

    if (queryMatches.length === 0) {
      return results.map((r) => ({
        ...r,
        semanticGroupResult: {
          originalScore: r.score,
          enhancedScore: r.score,
          matchedGroups: []
        }
      }))
    }

    logger.debug('Applying semantic group enhancement', {
      queryMatchCount: queryMatches.length,
      resultCount: results.length
    })

    // 2. 获取扩展关键词
    const expandedKeywords = this.expandGroupKeywords(queryMatches)

    // 3. 为每个结果计算语义组匹配增强
    const enhancedResults = results.map((result) => {
      const resultText = this.getResultText(result)
      const resultMatches = this.extractSemanticGroups(resultText)

      // 计算查询-结果之间的语义组重叠
      const { overlapScore, matchedGroups } = this.calculateGroupOverlap(queryMatches, resultMatches)

      // 融合分数
      const expansionWeight = mergedConfig.expansionWeight || 0.3
      const enhancedScore = result.score * (1 - expansionWeight) + result.score * (1 + overlapScore * expansionWeight)

      return {
        ...result,
        score: Math.min(1, enhancedScore),
        semanticGroupResult: {
          originalScore: result.score,
          enhancedScore: Math.min(1, enhancedScore),
          matchedGroups,
          expandedQuery: expandedKeywords.length > 0 ? this.generateEnhancedQuery(query, expandedKeywords) : undefined
        }
      }
    })

    // 4. 按增强后的分数排序
    enhancedResults.sort((a, b) => b.score - a.score)

    logger.debug('Semantic group enhancement applied', {
      avgOriginalScore: results.reduce((a, b) => a + b.score, 0) / results.length,
      avgEnhancedScore: enhancedResults.reduce((a, b) => a + b.score, 0) / enhancedResults.length
    })

    return enhancedResults
  }

  /**
   * 计算查询和结果之间的语义组重叠
   */
  private calculateGroupOverlap(
    queryMatches: SemanticGroupMatch[],
    resultMatches: SemanticGroupMatch[]
  ): { overlapScore: number; matchedGroups: SemanticGroupMatch[] } {
    const matchedGroups: SemanticGroupMatch[] = []
    let totalScore = 0

    for (const qMatch of queryMatches) {
      // 查找结果中是否有相同类型的匹配
      const rMatch = resultMatches.find((r) => r.groupType === qMatch.groupType)

      if (rMatch) {
        // 计算关键词重叠
        const overlap = qMatch.matchedKeywords.filter((k) => rMatch.matchedKeywords.includes(k))

        if (overlap.length > 0 || rMatch.subGroup === qMatch.subGroup) {
          const overlapWeight = overlap.length > 0 ? 1.0 : 0.7 // 同子组也有一定权重

          matchedGroups.push({
            groupType: qMatch.groupType,
            matchedKeywords: overlap.length > 0 ? overlap : rMatch.matchedKeywords,
            weight: qMatch.weight * overlapWeight,
            subGroup: rMatch.subGroup
          })

          totalScore += qMatch.weight * overlapWeight
        }
      }
    }

    // 归一化分数
    const overlapScore = queryMatches.length > 0 ? totalScore / queryMatches.length : 0

    return { overlapScore, matchedGroups }
  }

  /**
   * 从搜索结果中提取文本
   */
  private getResultText(result: KnowledgeSearchResult): string {
    const parts: string[] = []

    if (result.pageContent) {
      parts.push(result.pageContent)
    }

    if (result.metadata) {
      // 提取元数据中的相关字段
      const metaFields = ['title', 'description', 'tags', 'styleTags', 'category', 'pattern', 'color']
      for (const field of metaFields) {
        const value = result.metadata[field]
        if (value) {
          if (Array.isArray(value)) {
            parts.push(value.join(' '))
          } else if (typeof value === 'string') {
            parts.push(value)
          }
        }
      }
    }

    return parts.join(' ')
  }

  /**
   * 获取组中的所有关键词
   */
  getGroupKeywords(type: SemanticGroupType, subGroup?: string): string[] {
    const groups = FASHION_SEMANTIC_GROUPS[type]
    if (!groups) return []

    if (subGroup) {
      return groups[subGroup] || []
    }

    // 返回该类型的所有关键词
    return Object.values(groups).flat()
  }

  /**
   * 获取所有启用的组类型
   */
  getEnabledGroups(): SemanticGroupType[] {
    return [...this.config.groups]
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SemanticGroupConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): SemanticGroupConfig {
    return { ...this.config }
  }
}

// 导出工厂函数
export function createSemanticGroupSearchService(config?: Partial<SemanticGroupConfig>): SemanticGroupSearchService {
  return new SemanticGroupSearchService(config)
}
