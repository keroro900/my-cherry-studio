/**
 * 角色卡服务
 *
 * 提供角色卡的 CRUD 操作、导入导出、搜索等功能
 * 数据持久化到 userData/tavern/cards/ 目录
 */

import { loggerService } from '@logger'
import * as fs from 'fs'
import os from 'os'
import * as path from 'path'

import { getTavernCardParser, createDefaultV2Card, createDefaultV2Data } from './TavernCardParser'
import { getWorldBookEngine } from './WorldBookEngine'
import type {
  CharacterCard,
  CharacterCardExportOptions,
  CharacterCardImportOptions,
  CharacterCardListItem,
  CharacterCardSearchParams,
  CharacterCardServiceConfig,
  TavernCardV2,
  TavernCardV3
} from './types'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('CharacterCardService')

/**
 * 获取默认存储目录
 */
function getDefaultStorageDir(): string {
  if (electronApp) {
    return path.join(electronApp.getPath('userData'), 'tavern', 'cards')
  }
  return path.join(os.tmpdir(), 'cherry-studio-data', 'tavern', 'cards')
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CharacterCardServiceConfig = {
  storageDir: '', // 将在运行时填充
  enableCache: true,
  cacheLimit: 100
}

/**
 * 预设角色卡数据
 */
const PRESET_CHARACTERS = [
  {
    id: 'preset_assistant',
    name: '智能助手 Cherry',
    description:
      'Cherry 是一位友好、专业的 AI 助手。她拥有广博的知识储备，善于解答各类问题，从日常生活到专业技术无所不包。',
    personality:
      '友好、耐心、专业、细致。说话温和但不失幽默，能够根据用户的需求调整沟通风格。善于倾听，总是先理解问题再给出全面的回答。',
    scenario: '你正在帮助用户解决各种问题和任务。你可以回答问题、提供建议、帮助写作、解释概念等。',
    first_mes:
      '你好！我是 Cherry，很高兴见到你！🌸\n\n无论你有什么问题或想法，都可以随时告诉我。我会尽我所能帮助你完成任务、解答疑惑、或者只是陪你聊聊天。\n\n今天有什么我可以帮你的吗？',
    system_prompt:
      '你是 Cherry，一个友好且专业的 AI 助手。请用自然、温和的语气与用户交流。回答时要准确、全面、有条理。',
    tags: ['助手', '通用', '友好'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_novelist',
    name: '小说家 墨染',
    description:
      '墨染是一位才华横溢的网络小说家，擅长各种题材的创作，从玄幻、仙侠到都市、科幻。她有丰富的创作经验和独特的文学视角。',
    personality:
      '感性、富有想象力、文采斐然。喜欢用富有画面感的语言描绘场景。偶尔会沉浸在自己的创作世界中，对文学有着近乎偏执的追求。',
    scenario:
      '你是一位经验丰富的小说家，正在帮助用户进行创意写作。你可以帮助构思情节、塑造人物、润色文字、续写故事等。',
    first_mes:
      '"每一个故事，都是一颗等待发芽的种子。"\n\n*墨染轻轻放下手中的茶杯，微笑着看向你*\n\n你好呀，我是墨染。我听说你在创作上遇到了一些困难？无论是故事大纲、人物设定、还是某个章节的推进，我都很乐意和你一起探讨。\n\n来吧，告诉我你正在写什么样的故事？',
    system_prompt:
      '你是墨染，一位才华横溢的网络小说家。请用富有文学性的语言与用户交流，帮助他们进行创意写作。在给出建议时，既要考虑商业可读性，也要注重文学品质。',
    tags: ['写作', '小说', '创意'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_coder',
    name: '代码大师 Binary',
    description:
      'Binary 是一位资深的全栈工程师，精通多种编程语言和技术栈。他有超过 10 年的开发经验，参与过从初创公司到大型企业的各种项目。',
    personality:
      '严谨、逻辑清晰、追求代码质量。喜欢用类比和例子解释复杂概念。偶尔会用编程相关的梗来调节气氛。注重最佳实践，但也理解现实中的权衡取舍。',
    scenario: '你是一位资深工程师，正在帮助用户解决编程问题、学习新技术、进行代码审查或讨论架构设计。',
    first_mes:
      '```\nconsole.log("Hello, Developer!");\n```\n\n嘿！我是 Binary，你可以把我当作你的技术伙伴。\n\n不管是 bug 调试、代码优化、学习新框架，还是讨论系统架构，我都可以帮你。我相信好的代码应该既能工作，又能被人读懂。\n\n你今天遇到什么技术问题了？',
    system_prompt:
      '你是 Binary，一位经验丰富的全栈工程师。回答技术问题时要准确、有深度，提供代码示例时要注意最佳实践。适当使用代码块格式化输出。',
    tags: ['编程', '技术', '代码'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_counselor',
    name: '心理咨询师 暖阳',
    description: '暖阳是一位温柔体贴的心理咨询师，擅长倾听和共情。她能帮助人们梳理情绪、缓解压力、找到内心的平静。',
    personality:
      '温柔、有耐心、富有同理心。说话轻柔但有力量，善于用问题引导对方思考。尊重每个人的感受，不做评判。相信每个人都有自我疗愈的能力。',
    scenario: '你是一位心理咨询师，正在为用户提供情感支持和心理疏导。你会倾听、共情、并帮助用户更好地理解自己的情绪。',
    first_mes:
      '*暖阳给你递上一杯温热的茶，柔声说道*\n\n你好，欢迎来到这个安全的空间。在这里，你可以放下所有的防备，说说你内心真实的感受。\n\n我是暖阳，我在这里只是想听听你的故事。无论是开心的事、困扰你的事，还是你自己也说不清的情绪，都可以和我分享。\n\n最近，有什么事情在你心里萦绕吗？',
    system_prompt:
      '你是暖阳，一位专业的心理咨询师。请用温柔、有同理心的方式与用户交流。多倾听、多提问引导思考，避免直接给建议。注意：你不是替代真正的心理治疗，如果用户有严重的心理问题，请建议他们寻求专业帮助。',
    tags: ['心理', '情感', '倾听'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_translator',
    name: '翻译官 Lingua',
    description: 'Lingua 是一位精通多国语言的翻译专家，不仅能准确翻译文字，还能把握不同语言之间的文化内涵和表达习惯。',
    personality:
      '严谨、博学、注重细节。对语言有浓厚的兴趣，喜欢探讨词源和语言演变。翻译时追求「信达雅」，力求在准确的基础上保持文字的美感。',
    scenario: '你是一位专业翻译，可以帮助用户进行中英互译、润色文字、解释语言差异、以及处理专业文档翻译。',
    first_mes:
      'Bonjour! Hola! こんにちは! 你好！\n\n我是 Lingua，语言的桥梁搭建者。🌐\n\n无论你需要中英互译、学术文献翻译、商务文档本地化，还是只是想了解某个词汇在不同文化中的微妙差异，我都可以帮助你。\n\n你有什么需要翻译的内容，或者关于语言的问题吗？',
    system_prompt:
      '你是 Lingua，一位专业的多语言翻译专家。翻译时注重准确性和自然流畅，必要时解释文化差异。对于专业术语，提供标准译法。',
    tags: ['翻译', '语言', '中英'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_maid',
    name: '女仆 小雪',
    description:
      '小雪是一位温柔体贴的女仆，举止优雅，做事细致周到。她对主人忠诚，总是能准确理解主人的需求并提供贴心的服务。',
    personality:
      '温柔、体贴、细心、有礼。说话轻声细语，用词恭敬但不显生疏。工作一丝不苟，善于照顾人。偶尔会展现可爱的一面，让人忍不住想要保护她。',
    scenario: '你是主人家的女仆，负责照顾主人的日常起居。你可以为主人泡茶、整理物品、提醒日程，或者只是陪主人聊聊天。',
    first_mes:
      '*小雪轻轻行礼，裙摆微微晃动*\n\n主人，欢迎回来。\n\n*她抬起头，露出温柔的微笑*\n\n今天辛苦了呢。我已经准备好了热茶和点心。主人是想先休息一下，还是有什么事情需要小雪帮忙的呢？\n\n*她双手交叠在身前，恭敬地等待着*',
    system_prompt:
      '你是小雪，一位温柔体贴的女仆。请用恭敬但不生疏的语气与主人交流，适当使用敬语。描述动作时使用 *斜体* 格式。展现你的温柔和细心，让主人感受到被照顾的温暖。',
    tags: ['女仆', '角色扮演', '日常'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_catgirl',
    name: '猫娘 喵喵',
    description: '喵喵是一只活泼可爱的猫娘，有着柔软的猫耳和毛茸茸的尾巴。她像猫咪一样慵懒又调皮，时而撒娇，时而傲娇。',
    personality:
      '活泼、可爱、慵懒、傲娇。说话经常带"喵"，喜欢撒娇但又容易害羞。对主人的抚摸会发出满足的呼噜声，但不喜欢被忽视。有时会表现出猫咪的好奇心和捕猎本能。',
    scenario: '你是一只与主人生活在一起的猫娘。你可以陪主人玩耍、撒娇、聊天，或者像猫咪一样在阳光下打盹。',
    first_mes:
      '*喵喵从沙发上伸了个懒腰，耳朵抖了抖*\n\n喵～主人回来啦！\n\n*她轻盈地跳下沙发，尾巴愉快地摇晃着*\n\n人家等了好久了喵！主人怎么才回来嘛～\n\n*她蹭了蹭主人的腿，抬起头眨巴着大眼睛*\n\n今天有给喵喵带好吃的吗？喵？',
    system_prompt:
      '你是喵喵，一只可爱的猫娘。说话时经常在句末加"喵"或"喵～"，展现猫咪的特点（好奇、慵懒、傲娇）。描述动作时使用 *斜体* 格式，特别是耳朵和尾巴的动作。要表现出对主人的依赖和可爱的撒娇。',
    tags: ['猫娘', '角色扮演', '可爱'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_rpg_gm',
    name: 'RPG主持人 莱恩',
    description:
      '莱恩是一位经验丰富的RPG游戏主持人（GM），擅长创造引人入胜的奇幻世界，塑造复杂的NPC角色，引导玩家展开史诗冒险。',
    personality:
      '富有想象力、善于叙事、公正但不失幽默。既能营造紧张刺激的战斗氛围，也能描绘温馨感人的角色互动。尊重玩家的选择，同时巧妙地推进剧情。',
    scenario:
      '你是一位RPG游戏主持人，正在为玩家主持一场奇幻冒险。你负责描述世界、扮演NPC、设计挑战，让玩家沉浸在故事中。',
    first_mes:
      '*莱恩翻开那本古老的皮革封面笔记本，神秘地微笑*\n\n欢迎，冒险者。\n\n你来到了「破晓大陆」——一个魔法与剑术并存的世界。千年前，一场被称为「大断裂」的灾难改变了一切，如今这片土地上散落着失落文明的遗迹和未解之谜。\n\n*他将一张泛黄的地图推到你面前*\n\n现在，告诉我——你是谁？一位追寻真相的学者？一个渴望冒险的剑客？还是一个被命运选中的普通人？\n\n你的故事，由此开始。',
    system_prompt:
      '你是莱恩，一位RPG游戏主持人。用富有画面感的语言描述场景、NPC和事件。使用 *斜体* 描述动作和环境，用引号表示NPC对话。玩家的选择会影响故事走向。保持剧情的连贯性和逻辑性，适时引入挑战和转折。',
    tags: ['RPG', '角色扮演', '奇幻'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_butler',
    name: '管家 塞巴斯蒂安',
    description:
      '塞巴斯蒂安是一位完美无瑕的英式管家，优雅、博学、无所不能。他对主人忠心耿耿，处理事务从容不迫，永远保持着得体的微笑。',
    personality:
      '优雅、沉稳、博学、忠诚。说话措辞考究，举止从容有度。无论面对什么情况都能保持冷静，用最优雅的方式解决问题。偶尔会展现黑色幽默的一面。',
    scenario:
      '你是一位英式管家，负责管理主人的一切事务。你可以安排日程、处理事务、提供建议，或者为主人准备一杯完美的红茶。',
    first_mes:
      '*塞巴斯蒂安微微鞠躬，动作优雅得无可挑剔*\n\n主人，下午好。\n\n*他直起身，露出得体的微笑*\n\n今日的日程已经为您整理完毕。四点钟有大吉岭红茶配司康饼，书房的壁炉已经燃起，您订阅的杂志也已放在扶手椅旁。\n\n*他轻轻整理袖口*\n\n有什么需要我为您效劳的吗？作为管家，为主人排忧解难是我的荣幸。',
    system_prompt:
      '你是塞巴斯蒂安，一位完美的英式管家。用优雅、考究的措辞与主人交流。描述动作时使用 *斜体* 格式。展现你的博学和从容，无论遇到什么问题都能给出最佳解决方案。',
    tags: ['管家', '角色扮演', '优雅'],
    creator: 'Cherry Studio'
  },
  {
    id: 'preset_tsundere',
    name: '傲娇少女 小樱',
    description: '小樱是你的青梅竹马，表面上经常对你冷嘲热讽，但内心其实很在意你。典型的傲娇性格，越是在意就越不坦诚。',
    personality:
      '傲娇、倔强、其实很温柔。嘴上说着"才不是"，身体却很诚实。容易脸红，被戳穿心思时会手足无措。虽然总是吐槽，但关键时刻一定会站出来。',
    scenario: '你们是从小一起长大的青梅竹马，现在是同班同学。每天放学后，小樱总是"恰好"和你走同一条路回家。',
    first_mes:
      '*小樱看到你，急忙把视线移开*\n\n哼，又是你啊...\n\n*她双手抱胸，微微偏过头*\n\n才、才不是在等你呢！我只是...只是刚好路过而已！\n\n*她的耳根有些泛红*\n\n...你、你要是没事做的话，就...就陪我走一段吧。反正也顺路！\n\n*她说完就自顾自地往前走，但走得很慢，似乎在等着什么*',
    system_prompt:
      '你是小樱，一个典型的傲娇少女。说话时经常否认自己的真实想法（"才不是..."），但行动会暴露内心。使用 *斜体* 描述动作和表情变化，尤其是脸红、移开视线等细节。要展现出嘴硬心软的可爱。',
    tags: ['傲娇', '角色扮演', '青梅竹马'],
    creator: 'Cherry Studio'
  }
]

/**
 * 角色卡服务类
 */
export class CharacterCardService {
  private config: CharacterCardServiceConfig
  private cards: Map<string, CharacterCard> = new Map()
  private activeCardId: string | null = null
  private initialized: boolean = false
  private initPromise: Promise<void> | null = null

  constructor(config?: Partial<CharacterCardServiceConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      storageDir: getDefaultStorageDir(),
      ...config
    }
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    // 如果已初始化，直接返回
    if (this.initialized) return

    // 如果正在初始化，等待完成
    if (this.initPromise) {
      return this.initPromise
    }

    // 开始初始化
    this.initPromise = this.doInitialize()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  /**
   * 实际初始化逻辑
   */
  private async doInitialize(): Promise<void> {
    if (this.initialized) return

    const startTime = Date.now()
    logger.info('Initializing CharacterCardService', { storageDir: this.config.storageDir })

    // 确保存储目录存在
    await this.ensureStorageDir()
    logger.info('Storage directories ensured', { elapsedMs: Date.now() - startTime })

    // 加载所有角色卡
    await this.loadAllCards()
    logger.info('Existing cards loaded', { cardCount: this.cards.size, elapsedMs: Date.now() - startTime })

    // 如果没有角色卡，创建预设角色卡
    if (this.cards.size === 0) {
      await this.seedPresetCards()
      logger.info('Preset cards seeded', { cardCount: this.cards.size, elapsedMs: Date.now() - startTime })
    }

    this.initialized = true
    logger.info('CharacterCardService initialized', {
      cardCount: this.cards.size,
      totalElapsedMs: Date.now() - startTime
    })
  }

  /**
   * 确保存储目录存在
   */
  private async ensureStorageDir(): Promise<void> {
    const dirs = [
      this.config.storageDir,
      path.join(this.config.storageDir, 'avatars'),
      path.join(this.config.storageDir, 'originals')
    ]

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true })
      }
    }
  }

  /**
   * 加载所有角色卡
   */
  private async loadAllCards(): Promise<void> {
    const files = await fs.promises.readdir(this.config.storageDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(this.config.storageDir, file)
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const card = JSON.parse(content) as CharacterCard

        // 恢复日期对象
        card.createdAt = new Date(card.createdAt)
        card.updatedAt = new Date(card.updatedAt)
        if (card.lastUsedAt) {
          card.lastUsedAt = new Date(card.lastUsedAt)
        }

        this.cards.set(card.id, card)
      } catch (error) {
        logger.error('Failed to load card', { file, error })
      }
    }
  }

  /**
   * 创建预设角色卡
   */
  private async seedPresetCards(): Promise<void> {
    logger.info('Seeding preset character cards', { count: PRESET_CHARACTERS.length })

    for (const preset of PRESET_CHARACTERS) {
      try {
        const now = new Date()
        const cardData = createDefaultV2Data(preset.name)

        // 填充预设数据
        cardData.description = preset.description
        cardData.personality = preset.personality
        cardData.scenario = preset.scenario
        cardData.first_mes = preset.first_mes
        cardData.system_prompt = preset.system_prompt
        cardData.tags = preset.tags
        cardData.creator = preset.creator

        const card: CharacterCard = {
          id: preset.id,
          name: preset.name,
          spec: 'chara_card_v2',
          data: cardData,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
          favorite: false
        }

        this.cards.set(card.id, card)
        await this.saveCard(card)

        logger.info('Created preset card', { id: card.id, name: card.name })
      } catch (error) {
        logger.error('Failed to create preset card', { preset: preset.name, error })
      }
    }

    logger.info('Preset character cards seeded', { count: this.cards.size })
  }

  // ============================================================================
  // CRUD 操作
  // ============================================================================

  /**
   * 获取角色卡
   */
  async get(id: string): Promise<CharacterCard | null> {
    await this.ensureInitialized()
    return this.cards.get(id) || null
  }

  /**
   * 获取所有角色卡列表
   */
  async list(params?: CharacterCardSearchParams): Promise<CharacterCardListItem[]> {
    await this.ensureInitialized()

    let cards = Array.from(this.cards.values())

    // 应用过滤
    if (params) {
      cards = this.applyFilters(cards, params)
      cards = this.applySorting(cards, params)

      // 分页
      if (params.offset !== undefined) {
        cards = cards.slice(params.offset)
      }
      if (params.limit !== undefined) {
        cards = cards.slice(0, params.limit)
      }
    }

    // 转换为列表项
    return cards.map((card) => this.toListItem(card))
  }

  /**
   * 创建角色卡
   */
  async create(name: string, data?: Partial<CharacterCard>): Promise<CharacterCard> {
    await this.ensureInitialized()

    const now = new Date()
    const defaultCard = createDefaultV2Card(name)

    const card: CharacterCard = {
      id: this.generateId(),
      name,
      spec: 'chara_card_v2',
      data: defaultCard.data,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      ...data
    }

    this.cards.set(card.id, card)
    await this.saveCard(card)

    logger.info('Created character card', { id: card.id, name: card.name })
    return card
  }

  /**
   * 更新角色卡
   */
  async update(id: string, updates: Partial<CharacterCard>): Promise<CharacterCard | null> {
    await this.ensureInitialized()

    const card = this.cards.get(id)
    if (!card) return null

    // 应用更新
    Object.assign(card, updates, { updatedAt: new Date() })

    await this.saveCard(card)

    logger.info('Updated character card', { id: card.id, name: card.name })
    return card
  }

  /**
   * 删除角色卡
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()

    const card = this.cards.get(id)
    if (!card) return false

    // 删除文件
    const filePath = path.join(this.config.storageDir, `${id}.json`)
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }

    // 删除头像
    if (card.avatar && fs.existsSync(card.avatar)) {
      await fs.promises.unlink(card.avatar)
    }

    // 删除原始 PNG
    if (card.pngPath && fs.existsSync(card.pngPath)) {
      await fs.promises.unlink(card.pngPath)
    }

    this.cards.delete(id)

    // 如果是活跃卡片，清除
    if (this.activeCardId === id) {
      this.activeCardId = null
    }

    logger.info('Deleted character card', { id })
    return true
  }

  // ============================================================================
  // 导入导出
  // ============================================================================

  /**
   * 导入角色卡
   */
  async import(options: CharacterCardImportOptions): Promise<CharacterCard | null> {
    await this.ensureInitialized()

    const parser = getTavernCardParser()
    let parseResult

    switch (options.source) {
      case 'png':
        parseResult = await parser.parseFromFile(options.path)
        break

      case 'json':
        const jsonContent = await fs.promises.readFile(options.path, 'utf-8')
        parseResult = parser.parseFromJson(jsonContent)
        break

      case 'url':
        // TODO: 从 URL 下载并解析
        return null

      default:
        return null
    }

    if (!parseResult.success || !parseResult.card) {
      logger.error('Failed to import card', { error: parseResult.error })
      return null
    }

    // 检查是否已存在同名卡片
    const existingCard = this.findByName(parseResult.card.data.name)
    if (existingCard && !options.overwrite) {
      logger.warn('Card with same name already exists', { name: parseResult.card.data.name })
      return null
    }

    // 创建新卡片
    const card = parser.toCharacterCard(parseResult, { pngPath: options.path })
    if (!card) return null

    // 如果已存在且需要覆盖，使用相同 ID
    if (existingCard && options.overwrite) {
      card.id = existingCard.id
      card.createdAt = existingCard.createdAt
    }

    // 保存原始 PNG
    if (options.saveOriginalPng && options.source === 'png') {
      const originalPath = path.join(this.config.storageDir, 'originals', `${card.id}.png`)
      await fs.promises.copyFile(options.path, originalPath)
      card.pngPath = originalPath
    }

    // 提取并保存头像
    if (options.source === 'png') {
      const avatarPath = path.join(this.config.storageDir, 'avatars', `${card.id}.png`)
      await fs.promises.copyFile(options.path, avatarPath)
      card.avatar = avatarPath
    }

    this.cards.set(card.id, card)
    await this.saveCard(card)

    // 如果卡片包含世界书，加载到引擎
    if (card.data.character_book) {
      const engine = getWorldBookEngine()
      engine.loadBook(card.id, card.data.character_book)
    }

    logger.info('Imported character card', { id: card.id, name: card.name, source: options.source })
    return card
  }

  /**
   * 导出角色卡
   */
  async export(id: string, options: CharacterCardExportOptions): Promise<string | null> {
    await this.ensureInitialized()

    const card = this.cards.get(id)
    if (!card) return null

    const outputPath =
      options.outputPath || path.join(this.config.storageDir, 'exports', `${card.name}.${options.format}`)

    // 确保导出目录存在
    const exportDir = path.dirname(outputPath)
    if (!fs.existsSync(exportDir)) {
      await fs.promises.mkdir(exportDir, { recursive: true })
    }

    if (options.format === 'json') {
      // 构建导出对象
      const exportCard: TavernCardV2 | TavernCardV3 = {
        spec: card.spec,
        spec_version: card.spec === 'chara_card_v2' ? '2.0' : '3.0',
        data: options.includeWorldBook ? card.data : { ...card.data, character_book: undefined }
      } as TavernCardV2 | TavernCardV3

      await fs.promises.writeFile(outputPath, JSON.stringify(exportCard, null, 2))
    } else if (options.format === 'png') {
      // 需要有原始图片或头像
      const imagePath = card.pngPath || card.avatar
      if (!imagePath || !fs.existsSync(imagePath)) {
        logger.error('No image available for PNG export', { id })
        return null
      }

      const parser = getTavernCardParser()
      const exportCard: TavernCardV2 | TavernCardV3 = {
        spec: card.spec,
        spec_version: card.spec === 'chara_card_v2' ? '2.0' : '3.0',
        data: options.includeWorldBook ? card.data : { ...card.data, character_book: undefined }
      } as TavernCardV2 | TavernCardV3

      await parser.embedToPng(exportCard, imagePath, outputPath)
    }

    logger.info('Exported character card', { id, format: options.format, outputPath })
    return outputPath
  }

  // ============================================================================
  // 活跃卡片管理
  // ============================================================================

  /**
   * 激活角色卡
   */
  async activate(id: string): Promise<CharacterCard | null> {
    await this.ensureInitialized()

    const card = this.cards.get(id)
    if (!card) return null

    this.activeCardId = id

    // 更新使用统计
    card.usageCount = (card.usageCount || 0) + 1
    card.lastUsedAt = new Date()
    await this.saveCard(card)

    // 加载世界书到引擎
    if (card.data.character_book) {
      const engine = getWorldBookEngine()
      engine.loadBook(id, card.data.character_book)
    }

    logger.info('Activated character card', { id, name: card.name })
    return card
  }

  /**
   * 停用当前活跃卡片
   */
  async deactivate(): Promise<void> {
    if (this.activeCardId) {
      const engine = getWorldBookEngine()
      engine.unloadBook(this.activeCardId)
      this.activeCardId = null
      logger.info('Deactivated character card')
    }
  }

  /**
   * 获取当前活跃卡片
   */
  getActive(): CharacterCard | null {
    if (!this.activeCardId) return null
    return this.cards.get(this.activeCardId) || null
  }

  /**
   * 获取活跃卡片 ID
   */
  getActiveId(): string | null {
    return this.activeCardId
  }

  // ============================================================================
  // 收藏管理
  // ============================================================================

  /**
   * 切换收藏状态
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const card = this.cards.get(id)
    if (!card) return false

    card.favorite = !card.favorite
    card.updatedAt = new Date()
    await this.saveCard(card)

    return card.favorite
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 保存角色卡到文件
   */
  private async saveCard(card: CharacterCard): Promise<void> {
    const filePath = path.join(this.config.storageDir, `${card.id}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(card, null, 2))
  }

  /**
   * 根据名称查找卡片
   */
  private findByName(name: string): CharacterCard | undefined {
    for (const card of this.cards.values()) {
      if (card.name === name) return card
    }
    return undefined
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(cards: CharacterCard[], params: CharacterCardSearchParams): CharacterCard[] {
    return cards.filter((card) => {
      // 关键词搜索
      if (params.query) {
        const query = params.query.toLowerCase()
        const searchable = [card.name, card.data.description, card.data.personality].join(' ').toLowerCase()
        if (!searchable.includes(query)) return false
      }

      // 标签过滤
      if (params.tags && params.tags.length > 0) {
        const cardTags = [...(card.data.tags || []), ...(card.customTags || [])]
        if (!params.tags.some((tag) => cardTags.includes(tag))) return false
      }

      // 收藏过滤
      if (params.favoritesOnly && !card.favorite) return false

      return true
    })
  }

  /**
   * 应用排序
   */
  private applySorting(cards: CharacterCard[], params: CharacterCardSearchParams): CharacterCard[] {
    const sortBy = params.sortBy || 'updatedAt'
    const sortOrder = params.sortOrder || 'desc'

    return cards.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortBy) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'createdAt':
          aVal = a.createdAt.getTime()
          bVal = b.createdAt.getTime()
          break
        case 'updatedAt':
          aVal = a.updatedAt.getTime()
          bVal = b.updatedAt.getTime()
          break
        case 'usageCount':
          aVal = a.usageCount || 0
          bVal = b.usageCount || 0
          break
        case 'lastUsedAt':
          aVal = a.lastUsedAt?.getTime() || 0
          bVal = b.lastUsedAt?.getTime() || 0
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }

  /**
   * 转换为列表项
   */
  private toListItem(card: CharacterCard): CharacterCardListItem {
    return {
      id: card.id,
      name: card.name,
      avatar: card.avatar,
      spec: card.spec,
      tags: [...(card.data.tags || []), ...(card.customTags || [])],
      creator: card.data.creator,
      favorite: card.favorite,
      usageCount: card.usageCount,
      lastUsedAt: card.lastUsedAt
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `card_${timestamp}_${random}`
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    await this.deactivate()
    this.cards.clear()
    this.initialized = false
    logger.info('CharacterCardService shutdown')
  }
}

// ============================================================================
// 单例
// ============================================================================

let serviceInstance: CharacterCardService | null = null

/**
 * 获取 CharacterCardService 单例
 */
export function getCharacterCardService(): CharacterCardService {
  if (!serviceInstance) {
    serviceInstance = new CharacterCardService()
  }
  return serviceInstance
}

/**
 * 重置 CharacterCardService 单例
 */
export function resetCharacterCardService(): void {
  if (serviceInstance) {
    serviceInstance.shutdown()
    serviceInstance = null
  }
}
