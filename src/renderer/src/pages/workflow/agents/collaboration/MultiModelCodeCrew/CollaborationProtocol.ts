/**
 * CollaborationProtocol - 协作协议
 *
 * 定义多模型协作的规则和流程：
 * - 任务自动分配
 * - 角色能力匹配
 * - 依赖管理
 * - 冲突解决
 */

import { loggerService } from '@logger'
import { v4 as uuidv4 } from 'uuid'

import { getCrewConfigManager } from './CrewConfigManager'
import type { CrewMember, CrewRole, CrewTask, TaskPriority, TaskType } from './types'
import { CREW_ROLE_CONFIGS } from './types'

const logger = loggerService.withContext('CollaborationProtocol')

// ==================== 类型定义 ====================

/**
 * 任务分析结果
 */
export interface TaskAnalysis {
  /** 任务类型 */
  type: TaskType
  /** 推荐的角色 */
  recommendedRoles: CrewRole[]
  /** 优先级 */
  priority: TaskPriority
  /** 需要的能力 */
  requiredCapabilities: string[]
  /** 预估复杂度 (1-10) */
  complexity: number
  /** 是否可并行 */
  canParallelize: boolean
  /** 依赖的任务类型 */
  dependencies: TaskType[]
}

/**
 * 角色匹配分数
 */
export interface RoleMatchScore {
  role: CrewRole
  score: number
  reasons: string[]
}

/**
 * 协作消息
 */
export interface ProtocolMessage {
  id: string
  type: 'task_request' | 'task_accept' | 'task_reject' | 'task_complete' | 'help_request' | 'feedback' | 'handoff'
  fromRole: CrewRole
  toRole?: CrewRole
  taskId?: string
  content: string
  metadata?: Record<string, unknown>
  timestamp: Date
}

/**
 * 协作状态
 */
export interface CollaborationState {
  activeMessages: ProtocolMessage[]
  taskAssignments: Map<string, CrewRole>
  roleWorkloads: Map<CrewRole, number>
  completedHandoffs: number
  conflictCount: number
}

// ==================== 任务类型关键词映射 ====================

const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  design: [
    '设计',
    '架构',
    '模块',
    '接口',
    '结构',
    'design',
    'architecture',
    'module',
    'interface',
    'structure',
    'schema'
  ],
  planning: ['规划', '计划', '策略', '方案', 'plan', 'strategy', 'roadmap'],
  implement: ['实现', '开发', '编写', '创建', '功能', 'implement', 'develop', 'create', 'build', 'code', 'write'],
  fix: ['修复', '修改', 'bug', '错误', '问题', 'fix', 'repair', 'patch', 'resolve'],
  refactor: ['重构', '优化', '改进', '重写', 'refactor', 'optimize', 'improve', 'rewrite'],
  optimize: ['性能', '优化', '加速', '提升', 'performance', 'optimize', 'speed', 'enhance'],
  review: ['审查', '检查', '评审', 'review', 'check', 'inspect', 'examine'],
  test: ['测试', '单元测试', '集成测试', 'test', 'unit test', 'integration', 'spec'],
  verify: ['验证', '确认', '校验', 'verify', 'validate', 'confirm'],
  research: ['调研', '研究', '探索', '分析', 'research', 'explore', 'analyze', 'investigate'],
  investigate: ['调查', '排查', '定位', 'investigate', 'debug', 'trace', 'locate'],
  deploy: ['部署', '发布', '上线', 'deploy', 'release', 'publish', 'ship'],
  configure: ['配置', '设置', '初始化', 'configure', 'setup', 'initialize', 'config'],
  automate: ['自动化', '脚本', '流水线', 'automate', 'script', 'pipeline', 'ci/cd'],
  audit: ['审计', '安全', '合规', 'audit', 'security', 'compliance', 'scan'],
  analyze: ['分析', '统计', '报告', 'analyze', 'statistics', 'report', 'metrics'],
  style: ['样式', 'UI', '界面', '前端', 'style', 'css', 'ui', 'ux', 'frontend', 'component']
}

// ==================== 角色能力权重 ====================

const ROLE_TASK_WEIGHTS: Record<CrewRole, Record<TaskType, number>> = {
  architect: {
    design: 10,
    planning: 9,
    implement: 3,
    fix: 2,
    refactor: 7,
    optimize: 5,
    review: 8,
    test: 2,
    verify: 4,
    research: 6,
    investigate: 4,
    deploy: 2,
    configure: 3,
    automate: 3,
    audit: 5,
    analyze: 7,
    style: 2
  },
  developer: {
    design: 4,
    planning: 3,
    implement: 10,
    fix: 9,
    refactor: 8,
    optimize: 7,
    review: 5,
    test: 4,
    verify: 5,
    research: 3,
    investigate: 7,
    deploy: 3,
    configure: 4,
    automate: 5,
    audit: 2,
    analyze: 4,
    style: 3
  },
  frontend: {
    design: 6,
    planning: 3,
    implement: 9,
    fix: 8,
    refactor: 7,
    optimize: 6,
    review: 4,
    test: 4,
    verify: 5,
    research: 3,
    investigate: 5,
    deploy: 2,
    configure: 3,
    automate: 3,
    audit: 2,
    analyze: 3,
    style: 10
  },
  reviewer: {
    design: 5,
    planning: 4,
    implement: 2,
    fix: 6,
    refactor: 6,
    optimize: 6,
    review: 10,
    test: 3,
    verify: 8,
    research: 4,
    investigate: 7,
    deploy: 2,
    configure: 2,
    automate: 2,
    audit: 7,
    analyze: 8,
    style: 4
  },
  tester: {
    design: 2,
    planning: 3,
    implement: 3,
    fix: 4,
    refactor: 2,
    optimize: 3,
    review: 5,
    test: 10,
    verify: 9,
    research: 2,
    investigate: 6,
    deploy: 2,
    configure: 3,
    automate: 5,
    audit: 4,
    analyze: 5,
    style: 2
  },
  researcher: {
    design: 5,
    planning: 6,
    implement: 2,
    fix: 2,
    refactor: 2,
    optimize: 4,
    review: 4,
    test: 2,
    verify: 3,
    research: 10,
    investigate: 8,
    deploy: 1,
    configure: 2,
    automate: 2,
    audit: 3,
    analyze: 9,
    style: 2
  },
  devops: {
    design: 3,
    planning: 5,
    implement: 4,
    fix: 5,
    refactor: 3,
    optimize: 6,
    review: 3,
    test: 4,
    verify: 5,
    research: 3,
    investigate: 5,
    deploy: 10,
    configure: 9,
    automate: 10,
    audit: 4,
    analyze: 5,
    style: 1
  },
  security: {
    design: 4,
    planning: 3,
    implement: 2,
    fix: 5,
    refactor: 3,
    optimize: 3,
    review: 8,
    test: 4,
    verify: 7,
    research: 5,
    investigate: 7,
    deploy: 2,
    configure: 4,
    automate: 3,
    audit: 10,
    analyze: 8,
    style: 1
  }
}

// ==================== 协作协议类 ====================

/**
 * 协作协议
 */
export class CollaborationProtocol {
  private state: CollaborationState
  private configManager = getCrewConfigManager()

  constructor() {
    this.state = {
      activeMessages: [],
      taskAssignments: new Map(),
      roleWorkloads: new Map(),
      completedHandoffs: 0,
      conflictCount: 0
    }
  }

  /**
   * 分析任务需求
   */
  analyzeTask(requirement: string): TaskAnalysis {
    const lowerReq = requirement.toLowerCase()

    // 检测任务类型
    let detectedType: TaskType = 'implement'
    let maxMatches = 0

    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      const matches = keywords.filter((kw) => lowerReq.includes(kw.toLowerCase())).length
      if (matches > maxMatches) {
        maxMatches = matches
        detectedType = type as TaskType
      }
    }

    // 推荐角色
    const recommendedRoles = this.getRecommendedRoles(detectedType)

    // 检测依赖
    const dependencies = this.detectDependencies(detectedType)

    // 估算复杂度
    const complexity = this.estimateComplexity(requirement)

    // 确定优先级
    const priority = this.determinePriority(requirement, complexity)

    // 提取所需能力
    const requiredCapabilities = this.extractCapabilities(requirement)

    return {
      type: detectedType,
      recommendedRoles,
      priority,
      requiredCapabilities,
      complexity,
      canParallelize: this.canParallelize(detectedType),
      dependencies
    }
  }

  /**
   * 获取推荐角色
   */
  private getRecommendedRoles(taskType: TaskType): CrewRole[] {
    const enabledRoles = this.configManager.getEnabledRoles()
    const scores: Array<{ role: CrewRole; score: number }> = []

    for (const role of enabledRoles) {
      const weight = ROLE_TASK_WEIGHTS[role][taskType] || 0
      const roleConfig = this.configManager.getRoleConfig(role)
      const customWeight = roleConfig.taskTypeWeights?.[taskType] ?? 1

      scores.push({
        role,
        score: weight * customWeight
      })
    }

    // 按分数排序，返回前3个
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.role)
  }

  /**
   * 检测依赖
   */
  private detectDependencies(taskType: TaskType): TaskType[] {
    const dependencyMap: Record<TaskType, TaskType[]> = {
      implement: ['design'],
      style: ['design'],
      test: ['implement'],
      review: ['implement'],
      verify: ['test'],
      deploy: ['implement', 'test', 'review'],
      optimize: ['implement'],
      refactor: ['design'],
      fix: [],
      design: ['research'],
      planning: ['research'],
      research: [],
      investigate: [],
      configure: [],
      automate: ['implement'],
      audit: ['implement'],
      analyze: []
    }

    return dependencyMap[taskType] || []
  }

  /**
   * 估算复杂度
   */
  private estimateComplexity(requirement: string): number {
    let complexity = 5 // 基础复杂度

    // 根据长度调整
    if (requirement.length > 500) complexity += 2
    if (requirement.length > 1000) complexity += 1

    // 根据关键词调整
    const complexKeywords = ['复杂', '大规模', '全面', '完整', '系统', 'complex', 'comprehensive', 'complete', 'system']
    const simpleKeywords = ['简单', '小', '快速', 'simple', 'small', 'quick', 'minor']

    for (const kw of complexKeywords) {
      if (requirement.toLowerCase().includes(kw)) complexity += 1
    }
    for (const kw of simpleKeywords) {
      if (requirement.toLowerCase().includes(kw)) complexity -= 1
    }

    return Math.max(1, Math.min(10, complexity))
  }

  /**
   * 确定优先级
   */
  private determinePriority(requirement: string, complexity: number): TaskPriority {
    const urgentKeywords = ['紧急', '立即', '马上', 'urgent', 'immediately', 'asap', 'critical']
    const highKeywords = ['重要', '关键', 'important', 'key', 'crucial']
    const lowKeywords = ['可以晚点', '低优先', 'low priority', 'when possible']

    const lowerReq = requirement.toLowerCase()

    if (urgentKeywords.some((kw) => lowerReq.includes(kw))) return 'critical'
    if (highKeywords.some((kw) => lowerReq.includes(kw))) return 'high'
    if (lowKeywords.some((kw) => lowerReq.includes(kw))) return 'low'

    // 根据复杂度调整
    if (complexity >= 8) return 'high'
    if (complexity <= 3) return 'low'

    return 'medium'
  }

  /**
   * 提取所需能力
   */
  private extractCapabilities(requirement: string): string[] {
    const capabilities: string[] = []
    const capabilityKeywords: Record<string, string[]> = {
      系统设计: ['架构', '设计', 'architecture', 'design'],
      代码实现: ['实现', '开发', '编写', 'implement', 'develop', 'code'],
      UI开发: ['界面', 'UI', 'UX', '前端', 'frontend', 'component'],
      测试: ['测试', 'test', 'spec'],
      安全审计: ['安全', 'security', 'audit'],
      性能优化: ['性能', '优化', 'performance', 'optimize'],
      部署: ['部署', '发布', 'deploy', 'release'],
      调研: ['调研', '研究', 'research', 'investigate']
    }

    const lowerReq = requirement.toLowerCase()

    for (const [capability, keywords] of Object.entries(capabilityKeywords)) {
      if (keywords.some((kw) => lowerReq.includes(kw))) {
        capabilities.push(capability)
      }
    }

    return capabilities
  }

  /**
   * 检查是否可并行
   */
  private canParallelize(taskType: TaskType): boolean {
    const nonParallelTypes: TaskType[] = ['design', 'planning', 'deploy']
    return !nonParallelTypes.includes(taskType)
  }

  /**
   * 为任务选择最佳角色
   */
  selectBestRole(analysis: TaskAnalysis, availableMembers: CrewMember[]): CrewMember | null {
    const scores: RoleMatchScore[] = []

    for (const member of availableMembers) {
      if (member.status !== 'idle') continue

      const score = this.calculateMatchScore(member, analysis)
      scores.push(score)
    }

    if (scores.length === 0) return null

    // 选择最高分
    const best = scores.sort((a, b) => b.score - a.score)[0]

    logger.info('Role selection', {
      taskType: analysis.type,
      selectedRole: best.role,
      score: best.score,
      reasons: best.reasons
    })

    return availableMembers.find((m) => m.role === best.role) || null
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(member: CrewMember, analysis: TaskAnalysis): RoleMatchScore {
    const reasons: string[] = []
    let score = 0

    // 基础权重分数
    const baseWeight = ROLE_TASK_WEIGHTS[member.role][analysis.type] || 0
    score += baseWeight * 10
    if (baseWeight >= 8) reasons.push(`专业匹配 (权重: ${baseWeight})`)

    // 推荐角色加分
    const recIndex = analysis.recommendedRoles.indexOf(member.role)
    if (recIndex >= 0) {
      const bonus = (3 - recIndex) * 15
      score += bonus
      reasons.push(`推荐排名 #${recIndex + 1}`)
    }

    // 能力匹配加分
    const roleConfig = CREW_ROLE_CONFIGS[member.role]
    const matchingCaps = analysis.requiredCapabilities.filter((cap) =>
      roleConfig.capabilities.some((c) => c.includes(cap) || cap.includes(c))
    )
    if (matchingCaps.length > 0) {
      score += matchingCaps.length * 10
      reasons.push(`能力匹配: ${matchingCaps.join(', ')}`)
    }

    // 工作负载惩罚
    const workload = this.state.roleWorkloads.get(member.role) || 0
    if (workload > 0) {
      score -= workload * 5
      if (workload > 2) reasons.push(`工作负载高 (-${workload * 5})`)
    }

    // 自定义权重
    const customConfig = this.configManager.getRoleConfig(member.role)
    const customWeight = customConfig.taskTypeWeights?.[analysis.type]
    if (customWeight !== undefined) {
      score *= customWeight
      if (customWeight !== 1) reasons.push(`自定义权重: ${customWeight}`)
    }

    return { role: member.role, score, reasons }
  }

  /**
   * 创建协作消息
   */
  createMessage(
    type: ProtocolMessage['type'],
    fromRole: CrewRole,
    content: string,
    options?: {
      toRole?: CrewRole
      taskId?: string
      metadata?: Record<string, unknown>
    }
  ): ProtocolMessage {
    const message: ProtocolMessage = {
      id: uuidv4(),
      type,
      fromRole,
      toRole: options?.toRole,
      taskId: options?.taskId,
      content,
      metadata: options?.metadata,
      timestamp: new Date()
    }

    this.state.activeMessages.push(message)
    return message
  }

  /**
   * 处理任务完成交接
   */
  handleHandoff(fromRole: CrewRole, toRole: CrewRole, task: CrewTask, handoffNotes: string): ProtocolMessage {
    // 减少来源角色工作量
    const fromWorkload = this.state.roleWorkloads.get(fromRole) || 0
    this.state.roleWorkloads.set(fromRole, Math.max(0, fromWorkload - 1))

    // 增加目标角色工作量
    const toWorkload = this.state.roleWorkloads.get(toRole) || 0
    this.state.roleWorkloads.set(toRole, toWorkload + 1)

    // 更新任务分配
    this.state.taskAssignments.set(task.id, toRole)

    this.state.completedHandoffs++

    return this.createMessage('handoff', fromRole, handoffNotes, {
      toRole,
      taskId: task.id,
      metadata: {
        previousStatus: task.status,
        handoffReason: 'task_complete'
      }
    })
  }

  /**
   * 生成协作上下文
   */
  generateCollaborationContext(currentRole: CrewRole, task: CrewTask): string {
    const lines: string[] = []

    lines.push('## 协作上下文')
    lines.push('')

    // 当前角色职责
    const roleConfig = CREW_ROLE_CONFIGS[currentRole]
    lines.push(`### 你的角色: ${roleConfig.displayName}`)
    lines.push(`**职责**: ${roleConfig.capabilities.join('、')}`)
    lines.push('')

    // 任务依赖
    if (task.dependencies?.length) {
      lines.push('### 前置工作')
      lines.push('以下任务的输出将作为你的输入:')
      for (const depId of task.dependencies) {
        lines.push(`- ${depId}`)
      }
      lines.push('')
    }

    // 协作历史
    const relevantMessages = this.state.activeMessages.filter((m) => m.taskId === task.id || m.toRole === currentRole)
    if (relevantMessages.length > 0) {
      lines.push('### 协作记录')
      for (const msg of relevantMessages.slice(-5)) {
        const from = CREW_ROLE_CONFIGS[msg.fromRole].displayName
        lines.push(`- [${from}] ${msg.content.slice(0, 100)}...`)
      }
      lines.push('')
    }

    // 协作提醒
    lines.push('### 协作要求')
    lines.push('1. 输出应该清晰、结构化，便于其他角色理解')
    lines.push('2. 如果发现问题，使用 [问题] 标记')
    lines.push('3. 如果需要其他角色帮助，使用 [需要帮助: 角色名] 标记')
    lines.push('4. 完成时列出关键产出物')

    return lines.join('\n')
  }

  /**
   * 获取协作状态
   */
  getState(): CollaborationState {
    return { ...this.state }
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      activeMessages: [],
      taskAssignments: new Map(),
      roleWorkloads: new Map(),
      completedHandoffs: 0,
      conflictCount: 0
    }
  }
}

// ==================== 单例实例 ====================

let protocolInstance: CollaborationProtocol | null = null

/**
 * 获取协作协议实例
 */
export function getCollaborationProtocol(): CollaborationProtocol {
  if (!protocolInstance) {
    protocolInstance = new CollaborationProtocol()
  }
  return protocolInstance
}

export default getCollaborationProtocol
