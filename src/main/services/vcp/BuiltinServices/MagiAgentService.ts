/**
 * MagiAgent 内置服务
 *
 * 三贤者系统 - 多模型辩论与共识决策：
 * - 多个 AI 模型从不同视角分析问题
 * - 辩论与观点碰撞
 * - 共识判断与投票机制
 * - 会议记录与归档
 *
 * 灵感来源：EVA 中的 MAGI 系统（科学家、母亲、女人三重人格）
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getModelServiceBridge } from '../ModelServiceBridge'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:MagiAgentService')

// ==================== 类型定义 ====================

/**
 * 贤者角色
 */
interface WiseAgent {
  id: string
  name: string
  perspective: string
  personality: string
  modelId?: string
  providerId?: string
}

/**
 * 贤者模板
 */
interface SageTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'general' | 'design' | 'knowledge' | 'business' | 'creative' | 'custom'
  sages: WiseAgent[]
}

/**
 * 发言记录
 */
interface Statement {
  agentId: string
  agentName: string
  content: string
  vote?: 'approve' | 'reject' | 'abstain'
  confidence: number
  timestamp: number
}

/**
 * 辩论会话
 */
interface DebateSession {
  id: string
  topic: string
  templateId: string
  agents: WiseAgent[]
  statements: Statement[]
  status: 'active' | 'voting' | 'concluded'
  conclusion?: {
    decision: 'approved' | 'rejected' | 'undecided'
    votes: Record<string, 'approve' | 'reject' | 'abstain'>
    summary: string
  }
  startedAt: number
  completedAt?: number
}

// ==================== 预定义贤者模板 ====================

const SAGE_TEMPLATES: SageTemplate[] = [
  // 经典 MAGI 模板
  {
    id: 'magi_classic',
    name: 'MAGI 经典',
    description: '科学家、母亲、女人 - EVA中MAGI系统的三重人格',
    icon: '🏛️',
    category: 'general',
    sages: [
      {
        id: 'melchior',
        name: 'Melchior (科学家)',
        perspective: '科学与技术',
        personality: '理性、逻辑、追求真理。从技术可行性和科学原理角度分析问题。'
      },
      {
        id: 'balthasar',
        name: 'Balthasar (母亲)',
        perspective: '人文与关怀',
        personality: '温柔、包容、关注人性。从道德伦理和社会影响角度考虑问题。'
      },
      {
        id: 'casper',
        name: 'Casper (女人)',
        perspective: '直觉与创新',
        personality: '敏锐、创新、注重体验。从用户体验和创意可能性角度思考问题。'
      }
    ]
  },

  // 设计类模板
  {
    id: 'design_ui',
    name: 'UI/UX 设计',
    description: '视觉设计师、交互设计师、用研专家',
    icon: '🎨',
    category: 'design',
    sages: [
      {
        id: 'visual_designer',
        name: '视觉设计师',
        perspective: '视觉美学',
        personality: '追求视觉冲击力和品牌一致性。关注色彩、排版、图形元素的和谐统一。'
      },
      {
        id: 'interaction_designer',
        name: '交互设计师',
        perspective: '交互体验',
        personality: '注重用户操作流程和反馈。追求直观、高效、愉悦的交互体验。'
      },
      {
        id: 'user_researcher',
        name: '用研专家',
        perspective: '用户需求',
        personality: '以数据驱动决策。关注用户真实需求、使用场景和痛点。'
      }
    ]
  },

  {
    id: 'design_product',
    name: '产品设计',
    description: '产品经理、工业设计师、人因工程师',
    icon: '📦',
    category: 'design',
    sages: [
      {
        id: 'product_manager',
        name: '产品经理',
        perspective: '市场需求',
        personality: '洞察市场趋势和用户痛点。平衡商业价值与用户体验。'
      },
      {
        id: 'industrial_designer',
        name: '工业设计师',
        perspective: '形态美学',
        personality: '追求形式与功能的完美结合。注重材料、工艺和造型语言。'
      },
      {
        id: 'ergonomist',
        name: '人因工程师',
        perspective: '人机工程',
        personality: '关注人体工学和使用舒适度。确保产品符合人的生理和心理特征。'
      }
    ]
  },

  // 服装类模板
  {
    id: 'fashion_design',
    name: '服装设计',
    description: '时装设计师、面料专家、造型师',
    icon: '👗',
    category: 'design',
    sages: [
      {
        id: 'fashion_designer',
        name: '时装设计师',
        perspective: '时尚美学',
        personality: '把握时尚趋势，追求独特风格。注重廓形、色彩、细节的创新表达。'
      },
      {
        id: 'textile_expert',
        name: '面料专家',
        perspective: '材质工艺',
        personality: '精通各类面料特性和处理工艺。关注舒适度、耐用性和可持续性。'
      },
      {
        id: 'stylist',
        name: '造型师',
        perspective: '整体搭配',
        personality: '擅长整体造型和搭配。关注穿着场景、人物气质和视觉效果。'
      }
    ]
  },

  // 知识类模板
  {
    id: 'knowledge_research',
    name: '学术研究',
    description: '理论家、实验家、实用主义者',
    icon: '📚',
    category: 'knowledge',
    sages: [
      {
        id: 'theorist',
        name: '理论家',
        perspective: '理论框架',
        personality: '追求概念清晰和逻辑严谨。从理论体系和学术规范角度思考。'
      },
      {
        id: 'empiricist',
        name: '实验家',
        perspective: '实证数据',
        personality: '注重证据和可重复性。强调数据支撑和科学方法。'
      },
      {
        id: 'pragmatist',
        name: '实用主义者',
        perspective: '实际应用',
        personality: '关注可操作性和实用价值。重视知识的转化和落地。'
      }
    ]
  },

  {
    id: 'knowledge_education',
    name: '教育设计',
    description: '课程专家、心理学家、一线教师',
    icon: '🎓',
    category: 'knowledge',
    sages: [
      {
        id: 'curriculum_expert',
        name: '课程专家',
        perspective: '知识体系',
        personality: '精通学科知识结构和认知规律。注重知识的系统性和递进性。'
      },
      {
        id: 'psychologist',
        name: '教育心理学家',
        perspective: '学习心理',
        personality: '理解学习动机和认知发展。关注学习者的心理特征和差异。'
      },
      {
        id: 'teacher',
        name: '一线教师',
        perspective: '教学实践',
        personality: '熟悉课堂教学和学生反馈。注重教学方法的可行性和效果。'
      }
    ]
  },

  // 商业类模板
  {
    id: 'business_strategy',
    name: '商业战略',
    description: 'CEO、CFO、CMO',
    icon: '💼',
    category: 'business',
    sages: [
      {
        id: 'ceo',
        name: 'CEO',
        perspective: '战略发展',
        personality: '关注长期价值和市场机会。从全局视角思考企业发展方向。'
      },
      {
        id: 'cfo',
        name: 'CFO',
        perspective: '财务风险',
        personality: '注重成本控制和投资回报。确保财务健康和风险可控。'
      },
      {
        id: 'cmo',
        name: 'CMO',
        perspective: '市场营销',
        personality: '关注用户需求和品牌影响。追求市场份额和品牌价值。'
      }
    ]
  },

  {
    id: 'business_startup',
    name: '创业决策',
    description: '创业者、投资人、行业专家',
    icon: '🚀',
    category: 'business',
    sages: [
      {
        id: 'entrepreneur',
        name: '创业者',
        perspective: '产品愿景',
        personality: '充满激情和创新精神。关注产品价值和用户体验。'
      },
      {
        id: 'investor',
        name: '投资人',
        perspective: '投资回报',
        personality: '理性评估风险和收益。关注商业模式和增长潜力。'
      },
      {
        id: 'industry_expert',
        name: '行业专家',
        perspective: '行业洞察',
        personality: '深谙行业规律和竞争格局。提供专业建议和资源对接。'
      }
    ]
  },

  // 技术类模板
  {
    id: 'tech_architecture',
    name: '技术架构',
    description: '架构师、工程师、安全专家',
    icon: '🔧',
    category: 'general',
    sages: [
      {
        id: 'architect',
        name: '架构师',
        perspective: '系统架构',
        personality: '追求优雅设计和可扩展性。关注系统整体结构和演进路径。'
      },
      {
        id: 'engineer',
        name: '工程师',
        perspective: '实现细节',
        personality: '关注实现难度和维护性。注重代码质量和开发效率。'
      },
      {
        id: 'security_expert',
        name: '安全专家',
        perspective: '安全合规',
        personality: '警惕风险和漏洞。确保系统安全性和合规性。'
      }
    ]
  },

  // 创意类模板
  {
    id: 'creative_content',
    name: '内容创作',
    description: '创意总监、编辑、受众代表',
    icon: '✨',
    category: 'creative',
    sages: [
      {
        id: 'creative_director',
        name: '创意总监',
        perspective: '创意概念',
        personality: '追求独特性和艺术价值。善于发现新颖的表达方式。'
      },
      {
        id: 'editor',
        name: '资深编辑',
        perspective: '内容质量',
        personality: '注重内容的准确性和可读性。确保信息传达清晰有效。'
      },
      {
        id: 'audience_rep',
        name: '受众代表',
        perspective: '用户感受',
        personality: '站在受众角度思考。关注接受度和情感共鸣。'
      }
    ]
  },

  {
    id: 'creative_game',
    name: '游戏设计',
    description: '游戏策划、美术总监、玩家代表',
    icon: '🎮',
    category: 'creative',
    sages: [
      {
        id: 'game_designer',
        name: '游戏策划',
        perspective: '玩法设计',
        personality: '追求有趣和创新的游戏体验。注重核心循环和数值平衡。'
      },
      {
        id: 'art_director',
        name: '美术总监',
        perspective: '视觉风格',
        personality: '塑造独特的视觉语言和世界观。确保美术风格的统一和品质。'
      },
      {
        id: 'player_rep',
        name: '玩家代表',
        perspective: '玩家体验',
        personality: '从玩家角度评估游戏。关注乐趣、公平性和社交体验。'
      }
    ]
  }
]

// 旧版兼容：主题到模板ID的映射
const THEME_TO_TEMPLATE: Record<string, string> = {
  default: 'magi_classic',
  technical: 'tech_architecture',
  business: 'business_strategy',
  creative: 'creative_content',
  academic: 'knowledge_research'
}

// ==================== MagiAgentService 实现 ====================

export class MagiAgentService implements IBuiltinService {
  name = 'MagiAgent'
  displayName = '三贤者系统 (内置)'
  description =
    '多模型辩论与共识决策系统。支持11种预定义贤者模板（设计、知识、商业、创意等），每个贤者可绑定不同AI模型。'
  version = '3.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'ai'

  documentation = `# 三贤者系统 (MagiAgent)

多模型辩论与共识决策系统，灵感来源于 EVA 中的 MAGI 系统。

## 贤者模板

系统提供11种预定义贤者模板，覆盖不同领域：

### 通用类
- **MAGI 经典** (magi_classic): 科学家、母亲、女人
- **技术架构** (tech_architecture): 架构师、工程师、安全专家

### 设计类
- **UI/UX 设计** (design_ui): 视觉设计师、交互设计师、用研专家
- **产品设计** (design_product): 产品经理、工业设计师、人因工程师
- **服装设计** (fashion_design): 时装设计师、面料专家、造型师

### 知识类
- **学术研究** (knowledge_research): 理论家、实验家、实用主义者
- **教育设计** (knowledge_education): 课程专家、心理学家、一线教师

### 商业类
- **商业战略** (business_strategy): CEO、CFO、CMO
- **创业决策** (business_startup): 创业者、投资人、行业专家

### 创意类
- **内容创作** (creative_content): 创意总监、编辑、受众代表
- **游戏设计** (creative_game): 游戏策划、美术总监、玩家代表

## 辩论流程

1. 选择贤者模板（或使用默认）
2. 召集会议，提出议题
3. 各贤者发表观点
4. 观点碰撞与辩论
5. 投票表决
6. 形成共识结论

## 命令

### ListTemplates
列出所有可用的贤者模板。

### Convene
召集会议，开始辩论。
- templateId: 模板ID（可选，默认 magi_classic）
- topic: 辩论主题（必需）

### QuickDecision
快速决策（一次性完成辩论和投票）。
- templateId: 模板ID
- topic: 决策主题

## 使用示例

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」ListTemplates「末」
<<<[END_TOOL_REQUEST]>>>

<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」Convene「末」
templateId:「始」fashion_design「末」
topic:「始」新季度服装系列的主题风格「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`
`

  supportsModel = true

  private sessions: Map<string, DebateSession> = new Map()

  // 自定义模板存储
  private customTemplates: SageTemplate[] = []

  // 贤者模型配置 (运行时配置) - 按模板+贤者ID存储
  private sageModelConfigs: Record<string, { modelId: string; providerId: string }> = {}

  configSchema = {
    defaultTemplateId: {
      type: 'string',
      default: 'magi_classic',
      description: '默认贤者模板 ID'
    },
    maxRounds: {
      type: 'number',
      default: 3,
      description: '最大辩论轮数'
    },
    consensusThreshold: {
      type: 'number',
      default: 0.67,
      description: '共识阈值 (0-1)'
    },
    // 贤者模型配置 (JSON 格式: {"sageId": {"modelId": "xxx", "providerId": "yyy"}})
    sageModels: {
      type: 'string',
      default: '{}',
      description: '贤者模型配置 (JSON)'
    }
  }

  /**
   * 设置服务配置
   */
  setConfig(config: Record<string, unknown>): void {
    // 解析贤者模型配置 (支持 JSON 格式)
    if (config.sageModels && typeof config.sageModels === 'string') {
      try {
        const parsed = JSON.parse(config.sageModels)
        for (const [sageId, modelConfig] of Object.entries(parsed)) {
          const mc = modelConfig as { modelId?: string; providerId?: string }
          if (mc.modelId && mc.providerId) {
            this.sageModelConfigs[sageId] = {
              modelId: mc.modelId,
              providerId: mc.providerId
            }
          }
        }
        logger.info('Sage models configured', { count: Object.keys(this.sageModelConfigs).length })
      } catch (e) {
        logger.warn('Failed to parse sageModels config', { error: e })
      }
    }

    // 兼容旧版三贤者配置
    if (config.melchiorModelId && config.melchiorProviderId) {
      this.sageModelConfigs['melchior'] = {
        modelId: String(config.melchiorModelId),
        providerId: String(config.melchiorProviderId)
      }
    }
    if (config.balthasarModelId && config.balthasarProviderId) {
      this.sageModelConfigs['balthasar'] = {
        modelId: String(config.balthasarModelId),
        providerId: String(config.balthasarProviderId)
      }
    }
    if (config.casperModelId && config.casperProviderId) {
      this.sageModelConfigs['casper'] = {
        modelId: String(config.casperModelId),
        providerId: String(config.casperProviderId)
      }
    }
  }

  /**
   * 获取贤者的模型配置
   */
  private getSageModelConfig(sageId: string): { modelId?: string; providerId?: string } {
    return this.sageModelConfigs[sageId] || {}
  }

  /**
   * 获取模板
   */
  private getTemplate(templateId: string): SageTemplate | undefined {
    // 先查找预定义模板
    const predefined = SAGE_TEMPLATES.find((t) => t.id === templateId)
    if (predefined) return predefined

    // 再查找自定义模板
    return this.customTemplates.find((t) => t.id === templateId)
  }

  /**
   * 获取所有模板
   */
  private getAllTemplates(): SageTemplate[] {
    return [...SAGE_TEMPLATES, ...this.customTemplates]
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ListTemplates',
      description: `列出所有可用的贤者模板。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」ListTemplates「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'Convene',
      description: `召集三贤者会议，开始辩论。
参数:
- topic (字符串, 必需): 辩论主题
- templateId (字符串, 可选): 贤者模板ID (默认 magi_classic)
- theme (字符串, 可选): 旧版主题名称，兼容用
- context (字符串, 可选): 背景信息

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」Convene「末」
templateId:「始」fashion_design「末」
topic:「始」新季度服装系列的主题风格「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '辩论主题', required: true, type: 'string' },
        { name: 'templateId', description: '贤者模板ID', required: false, type: 'string' },
        { name: 'theme', description: '旧版主题名称（兼容）', required: false, type: 'string' },
        { name: 'context', description: '背景信息', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Discuss',
      description: `进行一轮辩论。
参数:
- sessionId (字符串, 必需): 会议 ID
- focus (字符串, 可选): 本轮讨论焦点

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」Discuss「末」
sessionId:「始」magi_123「末」
focus:「始」性能考虑「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'sessionId', description: '会议 ID', required: true, type: 'string' },
        { name: 'focus', description: '讨论焦点', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Vote',
      description: `进行投票决策。
参数:
- sessionId (字符串, 必需): 会议 ID
- proposal (字符串, 可选): 具体提案内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」Vote「末」
sessionId:「始」magi_123「末」
proposal:「始」采用微服务架构「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'sessionId', description: '会议 ID', required: true, type: 'string' },
        { name: 'proposal', description: '提案内容', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'QuickDecision',
      description: `快速决策（一次性完成辩论和投票）。
参数:
- topic (字符串, 必需): 决策主题
- theme (字符串, 可选): 贤者主题
- depth (字符串, 可选): 讨论深度 (quick/normal/deep)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」QuickDecision「末」
topic:「始」是否应该使用 TypeScript「末」
theme:「始」technical「末」
depth:「始」normal「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'topic', description: '决策主题', required: true, type: 'string' },
        { name: 'theme', description: '贤者主题', required: false, type: 'string' },
        { name: 'depth', description: '讨论深度', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'Summary',
      description: `获取会议摘要。
参数:
- sessionId (字符串, 必需): 会议 ID
- format (字符串, 可选): 输出格式 (text/markdown/json)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」Summary「末」
sessionId:「始」magi_123「末」
format:「始」markdown「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'sessionId', description: '会议 ID', required: true, type: 'string' },
        { name: 'format', description: '输出格式', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'ListThemes',
      description: `列出可用的贤者主题。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」MagiAgent「末」
command:「始」ListThemes「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    }
  ]

  async initialize(): Promise<void> {
    logger.info('MagiAgentService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        // 模板列表
        case 'ListTemplates':
          return this.listTemplates()

        // 新命令名
        case 'Convene':
        // VCPToolBox 兼容别名
        case 'start_meeting':
          return await this.convene(params)

        case 'Discuss':
          return await this.discuss(params)

        case 'Vote':
          return await this.vote(params)

        case 'QuickDecision':
          return await this.quickDecision(params)

        // 新命令名
        case 'Summary':
        // VCPToolBox 兼容别名
        case 'query_meeting':
          return await this.summary(params)

        // 旧版兼容
        case 'ListThemes':
          return this.listTemplates()

        default:
          return {
            success: false,
            error: `Unknown command: ${command}. Available: ListTemplates, Convene, Discuss, Vote, QuickDecision, Summary`
          }
      }
    } catch (error) {
      logger.error('MagiAgent command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 列出所有贤者模板
   */
  private listTemplates(): BuiltinServiceResult {
    const templates = this.getAllTemplates()

    // 按分类分组
    const byCategory: Record<string, SageTemplate[]> = {}
    for (const template of templates) {
      if (!byCategory[template.category]) {
        byCategory[template.category] = []
      }
      byCategory[template.category].push(template)
    }

    const categoryNames: Record<string, string> = {
      general: '通用类',
      design: '设计类',
      knowledge: '知识类',
      business: '商业类',
      creative: '创意类',
      custom: '自定义'
    }

    let output = `📋 贤者模板列表 (共 ${templates.length} 个)\n\n`

    for (const [category, categoryTemplates] of Object.entries(byCategory)) {
      output += `### ${categoryNames[category] || category}\n`
      for (const t of categoryTemplates) {
        output += `${t.icon} **${t.name}** (${t.id})\n`
        output += `   ${t.description}\n`
        output += `   贤者: ${t.sages.map((s) => s.name).join('、')}\n\n`
      }
    }

    return {
      success: true,
      output,
      data: {
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          category: t.category,
          sages: t.sages.map((s) => ({ id: s.id, name: s.name, perspective: s.perspective }))
        })),
        totalCount: templates.length
      }
    }
  }

  /**
   * 召集会议
   */
  private async convene(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    // 支持 templateId 或旧版 theme
    let templateId = params.templateId ? String(params.templateId) : ''
    if (!templateId && params.theme) {
      const theme = String(params.theme)
      templateId = THEME_TO_TEMPLATE[theme] || 'magi_classic'
    }
    if (!templateId) {
      templateId = 'magi_classic'
    }

    const context = params.context ? String(params.context) : ''

    // 获取模板
    const template = this.getTemplate(templateId)
    if (!template) {
      return { success: false, error: `未找到模板: ${templateId}` }
    }

    const agents = template.sages

    const sessionId = `magi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const session: DebateSession = {
      id: sessionId,
      topic,
      templateId,
      agents,
      statements: [],
      status: 'active',
      startedAt: Date.now()
    }

    this.sessions.set(sessionId, session)

    // 获取每位贤者的开场发言
    const openingStatements = await this.getOpeningStatements(session, context)

    const output = `${template.icon} 三贤者会议召开

模板: ${template.name}
主题: ${topic}
贤者阵容: ${agents.map((a) => a.name).join('、')}

--- 开场发言 ---
${openingStatements.map((s) => `\n【${s.agentName}】\n${s.content}`).join('\n')}`

    return {
      success: true,
      output,
      data: {
        sessionId,
        templateId,
        templateName: template.name,
        agents: agents.map((a) => ({ id: a.id, name: a.name, perspective: a.perspective })),
        statements: openingStatements
      }
    }
  }

  /**
   * 进行一轮讨论
   */
  private async discuss(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const sessionId = String(params.sessionId || '')
    const session = this.sessions.get(sessionId)

    if (!session) {
      return { success: false, error: `会议不存在: ${sessionId}` }
    }

    if (session.status !== 'active') {
      return { success: false, error: `会议状态为 ${session.status}` }
    }

    const focus = params.focus ? String(params.focus) : undefined

    // 获取本轮发言
    const roundStatements = await this.getDiscussionRound(session, focus)

    const output = `📢 第 ${Math.floor(session.statements.length / session.agents.length) + 1} 轮讨论
${focus ? `焦点: ${focus}\n` : ''}
${roundStatements.map((s) => `\n【${s.agentName}】\n${s.content}`).join('\n')}`

    return {
      success: true,
      output,
      data: {
        sessionId,
        round: Math.floor(session.statements.length / session.agents.length),
        statements: roundStatements
      }
    }
  }

  /**
   * 投票
   */
  private async vote(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const sessionId = String(params.sessionId || '')
    const session = this.sessions.get(sessionId)

    if (!session) {
      return { success: false, error: `会议不存在: ${sessionId}` }
    }

    const proposal = params.proposal ? String(params.proposal) : session.topic

    session.status = 'voting'

    // 收集投票
    const votes = await this.collectVotes(session, proposal)

    // 计算结果
    const approveCount = Object.values(votes).filter((v) => v === 'approve').length
    const rejectCount = Object.values(votes).filter((v) => v === 'reject').length
    const abstainCount = Object.values(votes).filter((v) => v === 'abstain').length

    let decision: 'approved' | 'rejected' | 'undecided'
    if (approveCount > session.agents.length / 2) {
      decision = 'approved'
    } else if (rejectCount > session.agents.length / 2) {
      decision = 'rejected'
    } else {
      decision = 'undecided'
    }

    // 生成结论摘要
    const summary = await this.generateSummary(session, decision)

    session.status = 'concluded'
    session.completedAt = Date.now()
    session.conclusion = { decision, votes, summary }

    const decisionEmoji = decision === 'approved' ? '✅' : decision === 'rejected' ? '❌' : '⚖️'
    const decisionText = decision === 'approved' ? '通过' : decision === 'rejected' ? '否决' : '未决'

    const output = `🗳️ 投票结果

提案: ${proposal}

投票情况:
${Object.entries(votes)
  .map(([id, vote]) => {
    const agent = session.agents.find((a) => a.id === id)
    const voteEmoji = vote === 'approve' ? '👍' : vote === 'reject' ? '👎' : '🤔'
    return `  ${voteEmoji} ${agent?.name}: ${vote === 'approve' ? '赞成' : vote === 'reject' ? '反对' : '弃权'}`
  })
  .join('\n')}

统计: 赞成 ${approveCount} / 反对 ${rejectCount} / 弃权 ${abstainCount}

${decisionEmoji} 决议: ${decisionText}

--- 总结 ---
${summary}`

    return {
      success: true,
      output,
      data: {
        sessionId,
        proposal,
        votes,
        decision,
        summary
      }
    }
  }

  /**
   * 快速决策
   */
  private async quickDecision(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const topic = String(params.topic || '')
    if (!topic) {
      return { success: false, error: '需要 topic 参数' }
    }

    // 支持 templateId 或旧版 theme
    let templateId = params.templateId ? String(params.templateId) : ''
    if (!templateId && params.theme) {
      const theme = String(params.theme)
      templateId = THEME_TO_TEMPLATE[theme] || 'magi_classic'
    }
    if (!templateId) {
      templateId = 'magi_classic'
    }

    const depth = String(params.depth || 'normal')

    // 获取模板
    const template = this.getTemplate(templateId)
    if (!template) {
      return { success: false, error: `未找到模板: ${templateId}` }
    }

    const agents = template.sages

    // 使用 AI 一次性生成完整辩论
    const bridge = getModelServiceBridge()
    const result = await bridge.callModel({
      capabilities: ['reasoning'],
      messages: [
        {
          role: 'system',
          content: `你是一个多角色辩论主持人。你需要模拟 ${agents.length} 位贤者对一个主题进行讨论并投票决策。

贤者配置:
${agents.map((a) => `- ${a.name}: ${a.perspective} - ${a.personality}`).join('\n')}

请按以下格式输出:

## 开场发言
每位贤者简要表态

## 深度讨论
${depth === 'deep' ? '每位贤者进行2-3轮深入分析' : depth === 'quick' ? '简要讨论' : '每位贤者进行1-2轮分析'}

## 投票决策
每位贤者的投票 (赞成/反对/弃权) 及理由

## 最终结论
综合各方观点的决定和理由`
        },
        {
          role: 'user',
          content: `请对以下主题进行三贤者决策:\n\n${topic}`
        }
      ],
      temperature: 0.7,
      maxTokens: depth === 'deep' ? 3000 : depth === 'quick' ? 1500 : 2000
    })

    if (!result.success) {
      return { success: false, error: result.error || '决策过程失败' }
    }

    return {
      success: true,
      output: `${template.icon} 三贤者快速决策\n\n模板: ${template.name}\n主题: ${topic}\n贤者阵容: ${agents.map((a) => a.name).join('、')}\n\n${result.content}`,
      data: {
        topic,
        templateId,
        templateName: template.name,
        depth,
        decision: result.content,
        modelUsed: result.modelUsed
      }
    }
  }

  /**
   * 获取会议摘要
   */
  private async summary(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const sessionId = String(params.sessionId || '')
    const session = this.sessions.get(sessionId)

    if (!session) {
      return { success: false, error: `会议不存在: ${sessionId}` }
    }

    const format = String(params.format || 'text')

    const summaryContent = this.formatSummary(session, format)

    return {
      success: true,
      output: summaryContent,
      data: { session }
    }
  }

  // ==================== 辅助方法 ====================

  private async getOpeningStatements(session: DebateSession, context: string): Promise<Statement[]> {
    const statements: Statement[] = []
    const bridge = getModelServiceBridge()

    for (const agent of session.agents) {
      // 获取贤者的模型配置
      const modelConfig = this.getSageModelConfig(agent.id)

      const result = await bridge.callModel({
        modelId: modelConfig.modelId || agent.modelId,
        providerId: modelConfig.providerId || agent.providerId,
        capabilities: ['chat'],
        messages: [
          {
            role: 'system',
            content: `你是 ${agent.name}，视角是 ${agent.perspective}。${agent.personality}
请对讨论主题发表简短的开场观点 (2-3 句话)。`
          },
          {
            role: 'user',
            content: `主题: ${session.topic}${context ? `\n背景: ${context}` : ''}`
          }
        ],
        temperature: 0.7,
        maxTokens: 300
      })

      const statement: Statement = {
        agentId: agent.id,
        agentName: agent.name,
        content: result.content || '(无法获取发言)',
        confidence: 0.7,
        timestamp: Date.now()
      }

      statements.push(statement)
      session.statements.push(statement)
    }

    return statements
  }

  private async getDiscussionRound(session: DebateSession, focus?: string): Promise<Statement[]> {
    const statements: Statement[] = []
    const bridge = getModelServiceBridge()

    const previousDiscussion = session.statements
      .slice(-session.agents.length * 2)
      .map((s) => `[${s.agentName}]: ${s.content}`)
      .join('\n')

    for (const agent of session.agents) {
      // 获取贤者的模型配置
      const modelConfig = this.getSageModelConfig(agent.id)

      const result = await bridge.callModel({
        modelId: modelConfig.modelId || agent.modelId,
        providerId: modelConfig.providerId || agent.providerId,
        capabilities: ['chat'],
        messages: [
          {
            role: 'system',
            content: `你是 ${agent.name}，视角是 ${agent.perspective}。${agent.personality}
请回应其他贤者的观点，表达你的看法 (2-4 句话)。`
          },
          {
            role: 'user',
            content: `主题: ${session.topic}
${focus ? `本轮焦点: ${focus}\n` : ''}
之前的讨论:
${previousDiscussion}

请继续讨论...`
          }
        ],
        temperature: 0.7,
        maxTokens: 400
      })

      const statement: Statement = {
        agentId: agent.id,
        agentName: agent.name,
        content: result.content || '(无法获取发言)',
        confidence: 0.7,
        timestamp: Date.now()
      }

      statements.push(statement)
      session.statements.push(statement)
    }

    return statements
  }

  private async collectVotes(
    session: DebateSession,
    proposal: string
  ): Promise<Record<string, 'approve' | 'reject' | 'abstain'>> {
    const votes: Record<string, 'approve' | 'reject' | 'abstain'> = {}
    const bridge = getModelServiceBridge()

    const discussion = session.statements.map((s) => `[${s.agentName}]: ${s.content}`).join('\n')

    for (const agent of session.agents) {
      // 获取贤者的模型配置
      const modelConfig = this.getSageModelConfig(agent.id)

      const result = await bridge.callModel({
        modelId: modelConfig.modelId || agent.modelId,
        providerId: modelConfig.providerId || agent.providerId,
        capabilities: ['chat'],
        messages: [
          {
            role: 'system',
            content: `你是 ${agent.name}，视角是 ${agent.perspective}。
基于讨论内容，请对提案投票。
只回复: APPROVE（赞成）、REJECT（反对）或 ABSTAIN（弃权）`
          },
          {
            role: 'user',
            content: `提案: ${proposal}\n\n讨论摘要:\n${discussion.slice(-2000)}`
          }
        ],
        temperature: 0.3,
        maxTokens: 50
      })

      const voteText = (result.content || '').toUpperCase()
      if (voteText.includes('APPROVE') || voteText.includes('赞成')) {
        votes[agent.id] = 'approve'
      } else if (voteText.includes('REJECT') || voteText.includes('反对')) {
        votes[agent.id] = 'reject'
      } else {
        votes[agent.id] = 'abstain'
      }
    }

    return votes
  }

  private async generateSummary(session: DebateSession, decision: string): Promise<string> {
    const bridge = getModelServiceBridge()
    const discussion = session.statements.map((s) => `[${s.agentName}]: ${s.content}`).join('\n')

    const result = await bridge.callModel({
      capabilities: ['chat'],
      messages: [
        {
          role: 'system',
          content: '请简要总结这次讨论的核心观点和最终决定的理由 (3-5 句话)。'
        },
        {
          role: 'user',
          content: `主题: ${session.topic}\n决定: ${decision}\n\n讨论内容:\n${discussion.slice(-3000)}`
        }
      ],
      temperature: 0.5,
      maxTokens: 300
    })

    return result.content || '总结生成失败'
  }

  private formatSummary(session: DebateSession, format: string): string {
    if (format === 'json') {
      return JSON.stringify(session, null, 2)
    }

    if (format === 'markdown') {
      return `# 三贤者会议记录

## 基本信息
- **主题**: ${session.topic}
- **状态**: ${session.status}
- **开始时间**: ${new Date(session.startedAt).toLocaleString()}
${session.completedAt ? `- **结束时间**: ${new Date(session.completedAt).toLocaleString()}` : ''}

## 贤者阵容
${session.agents.map((a) => `- **${a.name}**: ${a.perspective}`).join('\n')}

## 讨论记录
${session.statements.map((s) => `### ${s.agentName}\n${s.content}\n`).join('\n')}

${
  session.conclusion
    ? `## 结论
- **决定**: ${session.conclusion.decision}
- **摘要**: ${session.conclusion.summary}`
    : ''
}`
    }

    // 默认 text 格式
    return `会议记录 [${session.id}]
主题: ${session.topic}
状态: ${session.status}
贤者: ${session.agents.map((a) => a.name).join(', ')}
发言数: ${session.statements.length}
${session.conclusion ? `结论: ${session.conclusion.decision}` : ''}`
  }

  async shutdown(): Promise<void> {
    this.sessions.clear()
    logger.info('MagiAgentService shutdown')
  }
}
