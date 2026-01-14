/**
 * MetaThinking 内置服务
 *
 * 元思考链服务 - 支持多步骤推理和反思：
 * - 分步推理 (Step-by-step reasoning)
 * - 反思与修正 (Reflection and correction)
 * - 多视角分析 (Multi-perspective analysis)
 * - 假设验证 (Hypothesis testing)
 *
 * 支持 [[VCP元思考:...]] 占位符语法
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getVCPInfoService } from '../VCPInfoService'
import { getModelServiceBridge } from '../ModelServiceBridge'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:MetaThinkingService')

// ==================== 类型定义 ====================

/**
 * 思考步骤
 */
interface ThinkingStep {
  id: string
  type: 'observe' | 'analyze' | 'hypothesize' | 'verify' | 'conclude' | 'reflect'
  content: string
  confidence: number // 0-1
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * 思考链
 */
interface ThinkingChain {
  id: string
  topic: string
  steps: ThinkingStep[]
  currentPhase: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  finalConclusion?: string
}

/**
 * 思考链配置
 */
interface ChainConfig {
  name: string
  description: string
  phases: Array<{
    name: string
    prompt: string
    minSteps?: number
    maxSteps?: number
  }>
}

/**
 * VCP 风格的簇配置 (来自 meta_thinking_chains.json)
 */
interface VCPChainConfig {
  clusters: string[]
  kSequence: number[] // 每个簇的步骤数
  description?: string
}

// ==================== VCP 风格思考簇 ====================

/**
 * VCP 元思考簇定义
 * 移植自 VCPToolBox/Plugin/RAGDiaryPlugin/meta_thinking_chains.json
 */
const VCP_THINKING_CLUSTERS: Record<string, { prompt: string; description: string }> = {
  前思维簇: {
    prompt: '在开始正式推理之前，先感知和捕捉与问题相关的直觉、联想和初步印象...',
    description: '直觉捕捉和初步感知'
  },
  逻辑推理簇: {
    prompt: '运用逻辑推理分析问题的各个方面，建立因果关系和论证链条...',
    description: '结构化逻辑分析'
  },
  反思簇: {
    prompt: '审视之前的推理过程，检查是否存在盲点、偏见或逻辑漏洞...',
    description: '自我审视与纠偏'
  },
  结果辩证簇: {
    prompt: '从多个角度审视结论，考虑反面论点和替代解释...',
    description: '辩证性综合评估'
  },
  陈词总结梳理簇: {
    prompt: '将思考过程的关键洞见进行整合，形成清晰、有条理的结论...',
    description: '整合与结论输出'
  }
}

/**
 * VCP 风格预定义链 (移植自 meta_thinking_chains.json)
 */
const VCP_PREDEFINED_CHAINS: Record<string, VCPChainConfig> = {
  default: {
    clusters: ['前思维簇', '逻辑推理簇', '反思簇', '结果辩证簇', '陈词总结梳理簇'],
    kSequence: [2, 1, 1, 1, 1],
    description: '标准五阶段元思考链'
  },
  quick: {
    clusters: ['逻辑推理簇', '陈词总结梳理簇'],
    kSequence: [1, 1],
    description: '快速推理链'
  },
  deep: {
    clusters: ['前思维簇', '逻辑推理簇', '反思簇', '逻辑推理簇', '结果辩证簇', '反思簇', '陈词总结梳理簇'],
    kSequence: [2, 2, 1, 2, 1, 1, 2],
    description: '深度递归推理链'
  },
  creative: {
    clusters: ['前思维簇', '前思维簇', '逻辑推理簇', '结果辩证簇', '陈词总结梳理簇'],
    kSequence: [3, 2, 1, 1, 1],
    description: '创意发散链'
  }
}

// ==================== 主题路由规则 ====================

/**
 * 主题关键词到思考链的映射
 * 用于 Auto 模式自动选择最佳思考链
 */
const TOPIC_ROUTING_RULES: Array<{
  keywords: string[]
  standardChain?: string
  vcpChain?: string
  priority: number
}> = [
  // 创意类主题 → creative
  {
    keywords: ['创意', '设计', '想象', '创新', '灵感', '艺术', '美学', 'design', 'creative', 'innovation', 'idea'],
    vcpChain: 'creative',
    standardChain: 'creative_thinking',
    priority: 1
  },
  // 问题解决类 → deep + problem_solving
  {
    keywords: ['问题', '解决', '修复', 'bug', '错误', '故障', '优化', 'fix', 'solve', 'problem', 'issue', 'debug'],
    vcpChain: 'deep',
    standardChain: 'problem_solving',
    priority: 2
  },
  // 分析类 → deep + deep_analysis
  {
    keywords: ['分析', '评估', '比较', '研究', '调查', 'analyze', 'evaluate', 'compare', 'research', 'study'],
    vcpChain: 'deep',
    standardChain: 'deep_analysis',
    priority: 2
  },
  // 批判思考类 → deep + critical_thinking
  {
    keywords: ['质疑', '批判', '审视', '验证', '论证', 'critique', 'verify', 'validate', 'argue', 'question'],
    vcpChain: 'deep',
    standardChain: 'critical_thinking',
    priority: 2
  },
  // 快速决策类 → quick
  {
    keywords: ['快速', '简单', '简短', '直接', '马上', 'quick', 'simple', 'fast', 'brief', 'immediately'],
    vcpChain: 'quick',
    standardChain: 'reflection',
    priority: 3
  },
  // 架构/系统类 → deep
  {
    keywords: ['架构', '系统', '设计', '规划', '策略', '方案', 'architecture', 'system', 'strategy', 'plan'],
    vcpChain: 'deep',
    standardChain: 'deep_analysis',
    priority: 1
  }
]

// ==================== 预定义思考链 ====================

const PREDEFINED_CHAINS: Record<string, ChainConfig> = {
  // 深度分析链
  deep_analysis: {
    name: '深度分析',
    description: '多角度深入分析问题',
    phases: [
      { name: 'observe', prompt: '首先，观察和收集相关信息...', minSteps: 1 },
      { name: 'analyze', prompt: '现在，分析这些信息的关系和模式...', minSteps: 2 },
      { name: 'hypothesize', prompt: '基于分析，提出可能的假设...', minSteps: 1 },
      { name: 'verify', prompt: '验证这些假设的合理性...', minSteps: 1 },
      { name: 'conclude', prompt: '综合以上分析，得出结论...', minSteps: 1 }
    ]
  },

  // 问题解决链
  problem_solving: {
    name: '问题解决',
    description: '结构化解决复杂问题',
    phases: [
      { name: 'define', prompt: '明确定义问题是什么...' },
      { name: 'decompose', prompt: '将问题分解为子问题...' },
      { name: 'explore', prompt: '探索每个子问题的解决方案...' },
      { name: 'synthesize', prompt: '整合各部分解决方案...' },
      { name: 'validate', prompt: '验证整体解决方案的有效性...' }
    ]
  },

  // 创意思考链
  creative_thinking: {
    name: '创意思考',
    description: '发散性创意生成',
    phases: [
      { name: 'diverge', prompt: '尽可能多地产生想法，不要评判...' },
      { name: 'connect', prompt: '寻找不同想法之间的联系...' },
      { name: 'transform', prompt: '转换和组合想法...' },
      { name: 'converge', prompt: '筛选和优化最佳想法...' }
    ]
  },

  // 批判性思考链
  critical_thinking: {
    name: '批判性思考',
    description: '严格审视和评估论点',
    phases: [
      { name: 'identify', prompt: '识别主要论点和假设...' },
      { name: 'question', prompt: '质疑这些假设的合理性...' },
      { name: 'evidence', prompt: '评估支持证据的质量...' },
      { name: 'alternative', prompt: '考虑替代解释...' },
      { name: 'judgment', prompt: '做出平衡的判断...' }
    ]
  },

  // 反思链
  reflection: {
    name: '反思',
    description: '反思和改进思考过程',
    phases: [
      { name: 'review', prompt: '回顾刚才的思考过程...' },
      { name: 'identify_gaps', prompt: '识别遗漏或不足...' },
      { name: 'improve', prompt: '提出改进建议...' }
    ]
  }
}

// ==================== MetaThinkingService 实现 ====================

export class MetaThinkingService implements IBuiltinService {
  name = 'MetaThinking'
  displayName = '元思考链 (内置)'
  description =
    '元思考链服务：支持多步骤推理、反思修正、多视角分析。提供深度分析、问题解决、创意思考、批判性思考等预定义思考链。'
  version = '1.0.0'
  type = 'builtin_service' as const
  supportsModel = true

  private activeChains: Map<string, ThinkingChain> = new Map()

  configSchema = {
    defaultChain: {
      type: 'string',
      default: 'deep_analysis',
      description: '默认思考链类型'
    },
    maxStepsPerPhase: {
      type: 'number',
      default: 5,
      description: '每阶段最大步骤数'
    },
    autoReflect: {
      type: 'boolean',
      default: true,
      description: '是否自动进行反思'
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'Start',
      description: `启动一个思考链。
参数:
- topic (字符串, 必需): 思考主题
- chain (字符串, 可选): 思考链类型 (deep_analysis/problem_solving/creative_thinking/critical_thinking/reflection)
- context (字符串, 可选): 额外上下文

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」Start「末」
topic:「始」如何提高代码质量「末」
chain:「始」problem_solving「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '思考主题', required: true, type: 'string' },
        { name: 'chain', description: '思考链类型', required: false, type: 'string' },
        { name: 'context', description: '额外上下文', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Step',
      description: `执行思考链的下一步。
参数:
- chainId (字符串, 必需): 思考链 ID
- input (字符串, 可选): 本步骤的额外输入

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」Step「末」
chainId:「始」chain_123「末」
input:「始」考虑到性能因素「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'chainId', description: '思考链 ID', required: true, type: 'string' },
        { name: 'input', description: '额外输入', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Think',
      description: `一次性完成完整思考过程（快捷方式）。
参数:
- topic (字符串, 必需): 思考主题
- chain (字符串, 可选): 思考链类型
- depth (字符串, 可选): 思考深度 (quick/normal/deep)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」Think「末」
topic:「始」人工智能的未来发展「末」
chain:「始」deep_analysis「末」
depth:「始」deep「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '思考主题', required: true, type: 'string' },
        { name: 'chain', description: '思考链类型', required: false, type: 'string' },
        { name: 'depth', description: '思考深度', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Reflect',
      description: `对思考过程进行反思。
参数:
- chainId (字符串, 可选): 思考链 ID（不指定则反思最近的思考）
- aspect (字符串, 可选): 反思角度 (logic/completeness/bias/improvement)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」Reflect「末」
chainId:「始」chain_123「末」
aspect:「始」completeness「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'chainId', description: '思考链 ID', required: false, type: 'string' },
        { name: 'aspect', description: '反思角度', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'ThinkVCP',
      description: `使用 VCP 风格元思考链进行深度思考。
支持 kSequence 控制每个簇的迭代次数。

参数:
- topic (字符串, 必需): 思考主题
- chain (字符串, 可选): VCP 链类型 (default/quick/deep/creative)
- context (字符串, 可选): 额外上下文

可用链类型:
- default: 五阶段标准链 (前思维→逻辑推理→反思→辩证→总结)
- quick: 快速推理 (逻辑推理→总结)
- deep: 深度递归 (七阶段双重推理和反思)
- creative: 创意发散 (强化前思维阶段)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」ThinkVCP「末」
topic:「始」如何设计高扩展性的系统架构「末」
chain:「始」deep「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '思考主题', required: true, type: 'string' },
        { name: 'chain', description: 'VCP 链类型', required: false, type: 'string' },
        { name: 'context', description: '额外上下文', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'List',
      description: `列出可用的思考链类型。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」List「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'Status',
      description: `获取思考链状态。
参数:
- chainId (字符串, 可选): 思考链 ID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」Status「末」
chainId:「始」chain_123「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'chainId', description: '思考链 ID', required: false, type: 'string' }]
    },
    {
      commandIdentifier: 'AutoRoute',
      description: `自动路由模式 - 根据主题智能选择最佳思考链。
支持 [[VCP元思考::Auto::主题]] 语法。

参数:
- topic (字符串, 必需): 思考主题
- context (字符串, 可选): 额外上下文
- preferVCP (布尔, 可选): 是否优先使用 VCP 风格链，默认 true

系统会分析主题关键词，自动选择最适合的思考链：
- 创意类主题 → creative 链
- 问题解决类 → deep + problem_solving
- 分析类 → deep + deep_analysis
- 批判思考类 → deep + critical_thinking
- 快速决策类 → quick 链
- 架构/系统类 → deep 链

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MetaThinking「末」
command:「始」AutoRoute「末」
topic:「始」如何优化数据库查询性能「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '思考主题', required: true, type: 'string' },
        { name: 'context', description: '额外上下文', required: false, type: 'string' },
        { name: 'preferVCP', description: '优先使用 VCP 链', required: false, type: 'boolean' }
      ]
    }
  ]

  async initialize(): Promise<void> {
    logger.info('MetaThinkingService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'Start':
          return await this.start(params)

        case 'Step':
          return await this.step(params)

        case 'Think':
          return await this.think(params)

        case 'ThinkVCP':
          return await this.thinkVCP(params)

        case 'Reflect':
          return await this.reflect(params)

        case 'List':
          return await this.list()

        case 'Status':
          return await this.status(params)

        case 'AutoRoute':
          return await this.autoRoute(params)

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`
          }
      }
    } catch (error) {
      logger.error('MetaThinking command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 启动思考链
   */
  private async start(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    const chainType = String(params.chain || 'deep_analysis')
    const config = PREDEFINED_CHAINS[chainType]
    if (!config) {
      return { success: false, error: `未知思考链类型: ${chainType}` }
    }

    const chainId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const chain: ThinkingChain = {
      id: chainId,
      topic,
      steps: [],
      currentPhase: config.phases[0].name,
      status: 'active',
      startedAt: Date.now()
    }

    this.activeChains.set(chainId, chain)

    // 执行第一步
    const firstStep = await this.executeStep(chain, config.phases[0], params.context as string)

    return {
      success: true,
      output: `思考链已启动 [${config.name}]\n主题: ${topic}\n\n第一步 (${config.phases[0].name}):\n${firstStep.content}`,
      data: {
        chainId,
        chainType,
        currentPhase: chain.currentPhase,
        step: firstStep
      }
    }
  }

  /**
   * 执行下一步
   */
  private async step(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const chainId = String(params.chainId || '')
    const chain = this.activeChains.get(chainId)

    if (!chain) {
      return { success: false, error: `思考链不存在: ${chainId}` }
    }

    if (chain.status !== 'active') {
      return { success: false, error: `思考链状态为 ${chain.status}，无法继续` }
    }

    // 找到当前阶段的配置
    const chainType = this.getChainType(chain)
    const config = PREDEFINED_CHAINS[chainType]
    const currentPhaseIndex = config.phases.findIndex((p) => p.name === chain.currentPhase)
    const currentPhaseConfig = config.phases[currentPhaseIndex]

    // 执行步骤
    const step = await this.executeStep(chain, currentPhaseConfig, params.input as string)

    // 判断是否进入下一阶段
    const phaseSteps = chain.steps.filter((s) => s.type === (chain.currentPhase as any))
    const minSteps = currentPhaseConfig.minSteps || 1
    const maxSteps = currentPhaseConfig.maxSteps || 3

    let phaseComplete = false
    if (phaseSteps.length >= minSteps) {
      // 达到最小步骤，检查是否满足进入下一阶段的条件
      if (phaseSteps.length >= maxSteps || step.confidence > 0.8) {
        phaseComplete = true
      }
    }

    if (phaseComplete && currentPhaseIndex < config.phases.length - 1) {
      // 进入下一阶段
      chain.currentPhase = config.phases[currentPhaseIndex + 1].name
    } else if (phaseComplete && currentPhaseIndex === config.phases.length - 1) {
      // 完成思考链
      chain.status = 'completed'
      chain.completedAt = Date.now()
      chain.finalConclusion = step.content
    }

    return {
      success: true,
      output: `[${chain.currentPhase}] 步骤 ${phaseSteps.length + 1}:\n${step.content}${chain.status === 'completed' ? '\n\n✓ 思考链已完成' : ''}`,
      data: {
        chainId,
        currentPhase: chain.currentPhase,
        status: chain.status,
        step,
        totalSteps: chain.steps.length
      }
    }
  }

  /**
   * 一次性完成思考
   */
  private async think(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    const chainType = String(params.chain || 'deep_analysis')
    const depth = String(params.depth || 'normal')
    const config = PREDEFINED_CHAINS[chainType]

    if (!config) {
      return { success: false, error: `未知思考链类型: ${chainType}` }
    }

    // 根据深度调整步骤数
    const stepsPerPhase = depth === 'quick' ? 1 : depth === 'deep' ? 3 : 2

    // 使用 AI 执行完整思考
    const bridge = getModelServiceBridge()
    const result = await bridge.callModel({
      capabilities: ['reasoning'],
      messages: [
        {
          role: 'system',
          content: `你是一个使用"${config.name}"思考链的深度思考专家。

思考链阶段:
${config.phases.map((p, i) => `${i + 1}. ${p.name}: ${p.prompt}`).join('\n')}

请按照这些阶段进行思考，每个阶段${stepsPerPhase}个要点。
使用 Markdown 格式，每个阶段用 ## 标题分隔。`
        },
        {
          role: 'user',
          content: `请对以下主题进行深度思考:\n\n${topic}`
        }
      ],
      temperature: 0.7,
      maxTokens: depth === 'deep' ? 3000 : depth === 'quick' ? 1000 : 2000
    })

    if (!result.success) {
      return { success: false, error: result.error || '思考过程失败' }
    }

    // 广播 META_THINKING_CHAIN 事件到 RAG 观察器
    try {
      const vcpInfoService = getVCPInfoService()
      vcpInfoService.broadcastEvent({
        type: 'META_THINKING_CHAIN',
        chainName: config.name,
        query: topic,
        stages: config.phases.map((phase, idx) => ({
          stage: idx + 1,
          clusterName: phase.name,
          resultCount: stepsPerPhase,
          results: [{
            text: phase.prompt,
            score: 1.0,
            source: `${config.name}/${phase.name}`
          }]
        })),
        timestamp: Date.now()
      })
    } catch (error) {
      logger.debug('Failed to broadcast META_THINKING_CHAIN event', { error: String(error) })
    }

    return {
      success: true,
      output: `🧠 ${config.name}思考结果:\n\n${result.content}`,
      data: {
        chainType,
        depth,
        thinking: result.content,
        modelUsed: result.modelUsed
      }
    }
  }

  /**
   * VCP 风格元思考链 (kSequence 控制)
   *
   * 移植自 VCPToolBox meta_thinking_chains.json
   * 支持多簇迭代和 kSequence 控制每个簇的执行次数
   */
  private async thinkVCP(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    const chainType = String(params.chain || 'default')
    const context = params.context ? String(params.context) : ''

    const vcpChain = VCP_PREDEFINED_CHAINS[chainType]
    if (!vcpChain) {
      const available = Object.keys(VCP_PREDEFINED_CHAINS).join(', ')
      return { success: false, error: `未知 VCP 链类型: ${chainType}。可用类型: ${available}` }
    }

    logger.info('Starting VCP meta-thinking chain', { chainType, topic: topic.slice(0, 50) })

    const bridge = getModelServiceBridge()
    const clusterResults: Array<{ cluster: string; iterations: number; output: string }> = []

    // 遍历簇和 kSequence
    for (let i = 0; i < vcpChain.clusters.length; i++) {
      const clusterName = vcpChain.clusters[i]
      const iterations = vcpChain.kSequence[i] || 1
      const clusterConfig = VCP_THINKING_CLUSTERS[clusterName]

      if (!clusterConfig) {
        logger.warn('Unknown cluster in VCP chain', { clusterName })
        continue
      }

      // 构建簇执行上下文
      const previousThinking = clusterResults
        .map((r) => `【${r.cluster}】\n${r.output}`)
        .join('\n\n')

      // 执行簇 (iterations 次迭代)
      const iterationResults: string[] = []
      for (let iter = 0; iter < iterations; iter++) {
        const iterContext = iter > 0 ? `\n\n本轮迭代 (${iter + 1}/${iterations}) 的前序思考:\n${iterationResults.join('\n')}` : ''

        const result = await bridge.callModel({
          capabilities: ['reasoning'],
          messages: [
            {
              role: 'system',
              content: `你是一个元思考专家，正在执行「${clusterName}」阶段。

簇描述: ${clusterConfig.description}
簇指引: ${clusterConfig.prompt}

${iterations > 1 ? `本阶段需要 ${iterations} 轮迭代思考，当前是第 ${iter + 1} 轮。每轮迭代应该在前一轮基础上深化和扩展。` : ''}

请按照簇指引进行思考，输出结构化的分析结果。`
            },
            {
              role: 'user',
              content: `思考主题: ${topic}
${context ? `\n额外上下文: ${context}` : ''}
${previousThinking ? `\n\n===== 之前阶段的思考 =====\n${previousThinking}` : ''}${iterContext}

请进行「${clusterName}」阶段的思考...`
            }
          ],
          temperature: 0.7,
          maxTokens: iterations > 1 ? 800 : 1200
        })

        if (result.success && result.content) {
          iterationResults.push(result.content)
        } else {
          logger.error('VCP cluster execution failed', { clusterName, iter, error: result.error })
          iterationResults.push(`[${clusterName}第${iter + 1}轮执行失败]`)
        }
      }

      // 合并迭代结果
      const combinedOutput =
        iterations > 1 ? iterationResults.map((r, idx) => `【迭代 ${idx + 1}】\n${r}`).join('\n\n') : iterationResults[0] || ''

      clusterResults.push({
        cluster: clusterName,
        iterations,
        output: combinedOutput
      })

      logger.debug('VCP cluster completed', { clusterName, iterations })
    }

    // 格式化输出
    const formattedOutput = clusterResults
      .map(
        (r) =>
          `## ${r.cluster}${r.iterations > 1 ? ` (${r.iterations}轮迭代)` : ''}\n\n${r.output}`
      )
      .join('\n\n---\n\n')

    logger.info('VCP meta-thinking chain completed', { chainType, clusterCount: clusterResults.length })

    // 广播 META_THINKING_CHAIN 事件到 RAG 观察器
    try {
      const vcpInfoService = getVCPInfoService()
      vcpInfoService.broadcastEvent({
        type: 'META_THINKING_CHAIN',
        chainName: `VCP-${chainType}`,
        query: topic,
        stages: clusterResults.map((r, idx) => ({
          stage: idx + 1,
          clusterName: r.cluster,
          resultCount: r.iterations,
          results: [{
            text: r.output.slice(0, 500),
            score: 1.0,
            source: `${r.cluster} (${r.iterations}轮迭代)`
          }]
        })),
        timestamp: Date.now()
      })
    } catch (error) {
      logger.debug('Failed to broadcast META_THINKING_CHAIN event', { error: String(error) })
    }

    return {
      success: true,
      output: `🧠 VCP 元思考链 [${chainType}] 完成\n${vcpChain.description}\n\n${formattedOutput}`,
      data: {
        chainType,
        description: vcpChain.description,
        clusters: vcpChain.clusters,
        kSequence: vcpChain.kSequence,
        results: clusterResults
      }
    }
  }

  /**
   * 反思
   */
  private async reflect(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const chainId = params.chainId ? String(params.chainId) : undefined
    const aspect = String(params.aspect || 'completeness')

    let thinkingContent = ''

    if (chainId) {
      const chain = this.activeChains.get(chainId)
      if (!chain) {
        return { success: false, error: `思考链不存在: ${chainId}` }
      }
      thinkingContent = chain.steps.map((s) => `[${s.type}] ${s.content}`).join('\n\n')
    } else {
      // 获取最近的思考链
      const chains = Array.from(this.activeChains.values())
      if (chains.length === 0) {
        return { success: false, error: '没有活跃的思考链' }
      }
      const latest = chains.sort((a, b) => b.startedAt - a.startedAt)[0]
      thinkingContent = latest.steps.map((s) => `[${s.type}] ${s.content}`).join('\n\n')
    }

    const aspectPrompts: Record<string, string> = {
      logic: '检查逻辑一致性和推理链的有效性',
      completeness: '评估是否遗漏了重要方面',
      bias: '识别可能的偏见或假设',
      improvement: '提出改进建议'
    }

    const bridge = getModelServiceBridge()
    const result = await bridge.callModel({
      capabilities: ['reasoning'],
      messages: [
        {
          role: 'system',
          content: `你是一个思考过程审查专家。请${aspectPrompts[aspect] || aspectPrompts.completeness}。`
        },
        {
          role: 'user',
          content: `请审查以下思考过程:\n\n${thinkingContent}`
        }
      ],
      temperature: 0.5,
      maxTokens: 1000
    })

    return {
      success: true,
      output: `🔍 反思 (${aspect}):\n\n${result.content || '反思失败'}`,
      data: {
        aspect,
        reflection: result.content
      }
    }
  }

  /**
   * 列出思考链类型
   */
  private async list(): Promise<BuiltinServiceResult> {
    // 原有思考链
    const chains = Object.entries(PREDEFINED_CHAINS).map(([key, config]) => ({
      type: key,
      name: config.name,
      description: config.description,
      phases: config.phases.map((p) => p.name)
    }))

    // VCP 风格思考链
    const vcpChains = Object.entries(VCP_PREDEFINED_CHAINS).map(([key, config]) => ({
      type: `vcp:${key}`,
      name: `VCP ${key}`,
      description: config.description || '',
      clusters: config.clusters,
      kSequence: config.kSequence
    }))

    const output = `**标准思考链** (使用 Think 命令):\n${chains.map((c) => `- ${c.type}: ${c.name} - ${c.description}\n  阶段: ${c.phases.join(' → ')}`).join('\n')}

**VCP 元思考链** (使用 ThinkVCP 命令):
${vcpChains.map((c) => `- ${c.type}: ${c.description}\n  簇: ${c.clusters.join(' → ')}\n  kSequence: [${c.kSequence.join(', ')}]`).join('\n')}`

    return {
      success: true,
      output,
      data: { chains, vcpChains }
    }
  }

  /**
   * 获取状态
   */
  private async status(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const chainId = params.chainId ? String(params.chainId) : undefined

    if (chainId) {
      const chain = this.activeChains.get(chainId)
      if (!chain) {
        return { success: false, error: `思考链不存在: ${chainId}` }
      }

      return {
        success: true,
        output: `思考链状态 [${chainId}]:
- 主题: ${chain.topic}
- 状态: ${chain.status}
- 当前阶段: ${chain.currentPhase}
- 步骤数: ${chain.steps.length}
- 开始时间: ${new Date(chain.startedAt).toLocaleString()}`,
        data: chain
      }
    } else {
      const chains = Array.from(this.activeChains.values())
      return {
        success: true,
        output: `活跃思考链: ${chains.length}\n${chains.map((c) => `- ${c.id}: ${c.topic} [${c.status}]`).join('\n')}`,
        data: { chains }
      }
    }
  }

  /**
   * 自动路由 - 根据主题智能选择最佳思考链
   * 支持 [[VCP元思考::Auto::主题]] 语法
   */
  private async autoRoute(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    const context = params.context ? String(params.context) : ''
    const preferVCP = params.preferVCP !== false // 默认优先使用 VCP 链

    logger.info('AutoRoute: analyzing topic', { topic: topic.slice(0, 50), preferVCP })

    // 分析主题，匹配路由规则
    const routingResult = this.analyzeTopicForRouting(topic)

    logger.info('AutoRoute: routing decision', {
      vcpChain: routingResult.vcpChain,
      standardChain: routingResult.standardChain,
      matchedKeywords: routingResult.matchedKeywords,
      confidence: routingResult.confidence
    })

    // 根据偏好选择执行路径
    if (preferVCP && routingResult.vcpChain) {
      // 使用 VCP 风格链
      const result = await this.thinkVCP({
        topic,
        chain: routingResult.vcpChain,
        context
      })

      return {
        success: result.success,
        output: `🎯 自动路由: ${topic.slice(0, 30)}...\n` +
          `📌 检测到关键词: ${routingResult.matchedKeywords.join(', ') || '无特定匹配'}\n` +
          `🔗 选择链: VCP-${routingResult.vcpChain} (置信度: ${(routingResult.confidence * 100).toFixed(0)}%)\n\n` +
          result.output,
        data: {
          routing: routingResult,
          usedVCP: true,
          chainType: routingResult.vcpChain,
          ...(result.data && typeof result.data === 'object' ? (result.data as Record<string, unknown>) : {})
        }
      }
    } else if (routingResult.standardChain) {
      // 使用标准思考链
      const result = await this.think({
        topic,
        chain: routingResult.standardChain,
        depth: routingResult.vcpChain === 'quick' ? 'quick' : 'normal'
      })

      return {
        success: result.success,
        output: `🎯 自动路由: ${topic.slice(0, 30)}...\n` +
          `📌 检测到关键词: ${routingResult.matchedKeywords.join(', ') || '无特定匹配'}\n` +
          `🔗 选择链: ${routingResult.standardChain} (置信度: ${(routingResult.confidence * 100).toFixed(0)}%)\n\n` +
          result.output,
        data: {
          routing: routingResult,
          usedVCP: false,
          chainType: routingResult.standardChain,
          ...(result.data && typeof result.data === 'object' ? (result.data as Record<string, unknown>) : {})
        }
      }
    } else {
      // 默认使用 VCP default 链
      const result = await this.thinkVCP({
        topic,
        chain: 'default',
        context
      })

      return {
        success: result.success,
        output: `🎯 自动路由: ${topic.slice(0, 30)}...\n` +
          `📌 未匹配特定规则，使用默认链\n` +
          `🔗 选择链: VCP-default\n\n` +
          result.output,
        data: {
          routing: routingResult,
          usedVCP: true,
          chainType: 'default',
          ...(result.data && typeof result.data === 'object' ? (result.data as Record<string, unknown>) : {})
        }
      }
    }
  }

  /**
   * 分析主题以确定最佳路由
   */
  private analyzeTopicForRouting(topic: string): {
    vcpChain?: string
    standardChain?: string
    matchedKeywords: string[]
    confidence: number
  } {
    const topicLower = topic.toLowerCase()
    const matchedRules: Array<{
      rule: typeof TOPIC_ROUTING_RULES[0]
      matchedKeywords: string[]
      score: number
    }> = []

    // 遍历所有规则，计算匹配分数
    for (const rule of TOPIC_ROUTING_RULES) {
      const matched: string[] = []
      for (const keyword of rule.keywords) {
        if (topicLower.includes(keyword.toLowerCase())) {
          matched.push(keyword)
        }
      }

      if (matched.length > 0) {
        // 分数 = 匹配数量 * 优先级权重
        const score = matched.length * (4 - rule.priority)
        matchedRules.push({ rule, matchedKeywords: matched, score })
      }
    }

    // 按分数排序，取最高分
    matchedRules.sort((a, b) => b.score - a.score)

    if (matchedRules.length > 0) {
      const best = matchedRules[0]
      // 置信度基于匹配数量和规则优先级
      const confidence = Math.min(0.95, 0.5 + (best.matchedKeywords.length * 0.15) + ((4 - best.rule.priority) * 0.1))

      return {
        vcpChain: best.rule.vcpChain,
        standardChain: best.rule.standardChain,
        matchedKeywords: best.matchedKeywords,
        confidence
      }
    }

    // 无匹配，返回默认
    return {
      vcpChain: 'default',
      standardChain: 'deep_analysis',
      matchedKeywords: [],
      confidence: 0.5
    }
  }

  // ==================== 辅助方法 ====================

  private async executeStep(
    chain: ThinkingChain,
    phaseConfig: ChainConfig['phases'][0],
    additionalInput?: string
  ): Promise<ThinkingStep> {
    const bridge = getModelServiceBridge()

    const previousSteps = chain.steps
      .slice(-3)
      .map((s) => `[${s.type}] ${s.content}`)
      .join('\n')

    const result = await bridge.callModel({
      capabilities: ['chat'],
      messages: [
        {
          role: 'system',
          content: `你正在执行"${phaseConfig.name}"阶段的思考。${phaseConfig.prompt}`
        },
        {
          role: 'user',
          content: `主题: ${chain.topic}\n\n${previousSteps ? `之前的思考:\n${previousSteps}\n\n` : ''}${additionalInput ? `额外输入: ${additionalInput}\n\n` : ''}请继续思考...`
        }
      ],
      temperature: 0.7,
      maxTokens: 500
    })

    const step: ThinkingStep = {
      id: `step_${Date.now()}`,
      type: phaseConfig.name as ThinkingStep['type'],
      content: result.content || '思考失败',
      confidence: 0.7, // 简化处理
      timestamp: Date.now()
    }

    chain.steps.push(step)
    return step
  }

  private getChainType(chain: ThinkingChain): string {
    // 根据阶段判断链类型
    for (const [type, config] of Object.entries(PREDEFINED_CHAINS)) {
      if (config.phases.some((p) => p.name === chain.currentPhase)) {
        return type
      }
    }
    return 'deep_analysis'
  }

  async shutdown(): Promise<void> {
    this.activeChains.clear()
    logger.info('MetaThinkingService shutdown')
  }
}
