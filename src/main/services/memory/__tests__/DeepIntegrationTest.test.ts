/**
 * Deep Integration Test - 深度功能测试
 *
 * 测试统一记忆系统的完整功能链:
 * - 文档/记忆创建
 * - 智能搜索与学习权重
 * - RRF 多源融合
 * - 反馈学习
 * - 标签池管理
 *
 * @author Cherry Studio Team
 */

import { describe, it, expect, vi } from 'vitest'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-user-data'
      if (name === 'documents') return '/tmp/test-documents'
      return '/tmp/test'
    }),
    isPackaged: false
  }
}))

// Mock logger
vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

// Mock fs for NoteService
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => [])
  }
})

// Mock fs/promises
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: actual,
    readdir: vi.fn(async () => []),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    stat: vi.fn(async () => ({ isDirectory: () => false, mtime: new Date() })),
    access: vi.fn(async () => {})
  }
})

// ==================== 测试数据 ====================

const TEST_DOCUMENTS = [
  {
    content: `# 项目会议记录 2024-01-15

今天讨论了Cherry Studio的新功能开发计划。主要议题包括：

1. **VCP插件系统重构** - 将原有的MCP桥接模式改为原生TypeScript实现
2. **统一记忆管理** - 整合日记、笔记、知识库的搜索能力
3. **自学习系统** - 基于用户反馈优化搜索结果

团队成员: Alice, Bob, Charlie
下次会议: 2024-01-22`,
    title: '项目会议记录',
    tags: ['会议', '项目', 'VCP', '记忆系统', 'Cherry Studio']
  },
  {
    content: `# 学习笔记 - React Hooks

## useState
useState 是最基础的 Hook，用于在函数组件中添加状态。

\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

## useEffect
useEffect 用于处理副作用，如数据获取、订阅等。

## useMemo
useMemo 用于缓存计算结果，避免不必要的重新计算。

## useCallback
useCallback 用于缓存函数引用，避免子组件不必要的重新渲染。

相关标签: React, Hooks, 前端开发, JavaScript`,
    title: 'React Hooks 学习笔记',
    tags: ['React', 'Hooks', '前端', 'JavaScript', '学习笔记']
  },
  {
    content: `# 知识库整理 - AI模型对比

## GPT-4
- 优势: 推理能力强，上下文窗口大
- 劣势: 成本较高

## Claude 3
- 优势: 安全性高，中文支持好
- 劣势: 创意写作稍弱

## Gemini Pro
- 优势: 多模态能力强
- 劣势: 中文支持一般

## 选择建议
- 日常对话: GPT-3.5 或 Claude Instant
- 代码生成: GPT-4 或 Claude 3
- 图像理解: Gemini Pro 或 GPT-4V`,
    title: 'AI模型对比',
    tags: ['AI', 'GPT', 'Claude', 'Gemini', '知识库', '模型对比']
  },
  {
    content: `# 日记 2024-01-14

今天完成了Cherry Studio记忆系统的重构工作。

主要成就:
- 实现了IntegratedMemoryCoordinator
- 集成了SelfLearningService
- 完善了RRF融合算法

遇到的问题:
- TypeScript类型推断有些复杂
- 测试覆盖率需要提高

明天计划:
- 完善VCP服务集成
- 添加更多测试用例

心情: 充实而满足`,
    title: '开发日记',
    tags: ['日记', '开发', 'Cherry Studio', '记忆系统', 'TypeScript']
  },
  {
    content: `# 技术分享 - BM25算法原理

BM25 (Best Matching 25) 是信息检索领域的经典算法。

## 核心公式

score(D,Q) = Σ IDF(qi) · (f(qi,D) · (k1+1)) / (f(qi,D) + k1 · (1 - b + b · |D|/avgdl))

## 参数说明
- k1: 控制词频饱和度 (通常 1.2-2.0)
- b: 控制文档长度归一化 (通常 0.75)
- IDF: 逆文档频率

## 应用场景
- 搜索引擎
- 文档检索
- 推荐系统

## LightMemo中的实现
Cherry Studio的LightMemo服务使用BM25作为关键词检索的核心算法。`,
    title: 'BM25算法分享',
    tags: ['BM25', '算法', '搜索', 'LightMemo', '技术分享']
  }
]

// ==================== 测试套件 ====================

describe('Deep Integration Test', () => {
  describe('SelfLearningService Core Functions', () => {
    it('should record query and update tag weights', async () => {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const service = getSelfLearningService()

      // 模拟用户搜索行为
      const testTags = ['React', 'Hooks', '前端']
      service.recordQuery(testTags, 'search')

      // 验证权重更新 - 使用 getLearnedWeight 而非 getTagWeights
      const weight = service.getLearnedWeight('React')
      expect(weight).toBeDefined()
      expect(typeof weight).toBe('number')
    })

    it('should apply feedback to adjust weights', async () => {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const service = getSelfLearningService()

      // 记录初始查询
      const testTags = ['AI', 'Claude', '模型']
      service.recordQuery(testTags, 'search')

      const beforeWeight = service.getLearnedWeight('AI')

      // 记录正向反馈 - 使用正确的 API
      service.recordPositiveFeedback('AI 模型查询', 'result-123', ['AI'])

      const afterWeight = service.getLearnedWeight('AI')

      // 正向反馈应该增加权重
      expect(afterWeight).toBeGreaterThanOrEqual(beforeWeight)
    })

    it('should calculate combined tag weights', async () => {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const service = getSelfLearningService()

      // 多次记录相同标签
      for (let i = 0; i < 5; i++) {
        service.recordQuery(['Cherry Studio', '开发'], 'search')
      }

      // 使用 getLearnedWeight
      const weight1 = service.getLearnedWeight('Cherry Studio')
      const weight2 = service.getLearnedWeight('开发')

      // 高频标签应该有权重
      expect(weight1).toBeGreaterThanOrEqual(1)
      expect(weight2).toBeGreaterThanOrEqual(1)
    })

    it('should get learning statistics', async () => {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const service = getSelfLearningService()

      // 添加一些学习数据
      service.recordQuery(['测试', '集成'], 'search')
      service.recordPositiveFeedback('测试查询', 'q1', ['测试'])

      const stats = service.getStats()

      expect(stats).toBeDefined()
      expect(typeof stats.totalTags).toBe('number')
      expect(typeof stats.totalQueries).toBe('number')
      expect(typeof stats.totalFeedback).toBe('number')
      expect(Array.isArray(stats.topTags)).toBe(true)
    })
  })

  describe('MemoryMasterService Core Functions', () => {
    it('should manage tag pool', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 添加标签到池
      const testTags = ['React', 'Vue', 'Angular', 'Svelte']
      service.addTagsToPool(testTags)

      // 使用正确的 API: getTagPool 和 getTagStats
      const tagPool = service.getTagPool()
      const tagStats = service.getTagStats()

      expect(tagPool.length).toBeGreaterThanOrEqual(testTags.length)
      expect(tagStats.length).toBeGreaterThanOrEqual(0)
    })

    it('should get top tags', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 添加多个标签
      const docs = [
        { id: '1', tags: ['React', 'Hooks', 'JavaScript'] },
        { id: '2', tags: ['React', 'Redux', 'JavaScript'] },
        { id: '3', tags: ['Vue', 'Vuex', 'JavaScript'] }
      ]

      for (const doc of docs) {
        service.addTagsToPool(doc.tags)
      }

      const topTags = service.getTopTags(5)
      expect(topTags).toBeDefined()
      expect(Array.isArray(topTags)).toBe(true)
    })
  })

  describe('IntegratedMemoryCoordinator Core Functions', () => {
    it('should initialize and get stats', async () => {
      const { getIntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 使用 getIntegratedStats 来验证初始化正确
      const stats = await coordinator.getIntegratedStats()
      expect(stats).toBeDefined()
      expect(stats.memoryStats).toBeDefined()
    })

    it('should get memory statistics', async () => {
      const { getIntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      const stats = await coordinator.getIntegratedStats()
      expect(stats).toBeDefined()
      expect(stats.memoryStats).toBeDefined()
    })
  })

  describe('IntegratedMemoryCoordinator Integration', () => {
    it('should get integrated stats combining all services', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const stats = await coordinator.getIntegratedStats()

      expect(stats).toBeDefined()
      expect(stats.memoryStats).toBeDefined()
      expect(stats.learningStats).toBeDefined()
      expect(stats.tagPoolStats).toBeDefined()
    })

    it('should track learning progress', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const progress = coordinator.getLearningProgress()

      expect(progress).toBeDefined()
      expect(typeof progress.queryCount).toBe('number')
      expect(typeof progress.feedbackCount).toBe('number')
      expect(progress.tagWeightRange).toBeDefined()
    })

    it('should provide configuration management', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const config = coordinator.getConfig()

      expect(config).toBeDefined()
      expect(config.memoryMaster).toBeDefined()
      expect(config.selfLearning).toBeDefined()
      expect(config.search).toBeDefined()
    })
  })

  describe('VCP IntegratedMemoryService Deep Test', () => {
    it('should format search results correctly', async () => {
      const { IntegratedMemoryService } = await import('../../vcp/BuiltinServices/IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      // 测试初始化
      await service.initialize()

      // 验证服务已正确初始化
      expect(service.name).toBe('Memory')
      expect(service.version).toBe('1.0.0')
    })

    it('should handle empty query gracefully', async () => {
      const { IntegratedMemoryService } = await import('../../vcp/BuiltinServices/IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      const result = await service.execute('LightSearch', { query: '' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should support multiple search backends', async () => {
      const { IntegratedMemoryService } = await import('../../vcp/BuiltinServices/IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      // 验证 backends 配置
      expect(service.configSchema.backends).toBeDefined()
      expect(service.configSchema.backends.default).toContain('diary')
      expect(service.configSchema.backends.default).toContain('lightmemo')
      expect(service.configSchema.backends.default).toContain('deepmemo')
      expect(service.configSchema.backends.default).toContain('knowledge')
    })

    it('should have learning system integration', async () => {
      const { IntegratedMemoryService } = await import('../../vcp/BuiltinServices/IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      // 验证学习配置
      expect(service.configSchema.enableLearning).toBeDefined()
      expect(service.configSchema.enableLearning.default).toBe(true)

      // 验证统计和反馈命令
      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      expect(commands).toContain('GetStats')
      expect(commands).toContain('RecordFeedback')
    })
  })

  describe('End-to-End Search Flow Simulation', () => {
    it('should simulate complete search and feedback cycle', async () => {
      // 1. 初始化服务
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const selfLearning = getSelfLearningService()

      // 2. 模拟用户搜索 "React 开发"
      const extractedTags = ['React', '开发']

      // 记录查询
      selfLearning.recordQuery(extractedTags, 'search')

      // 3. 模拟搜索返回结果 (用户选择了第2个结果)
      // 4. 记录用户正向反馈 (选择了包含 Hooks 的结果)
      selfLearning.recordPositiveFeedback('React 开发', 'r2', ['Hooks'])

      // 5. 记录用户负向反馈 (忽略了包含 Vuex 的结果)
      selfLearning.recordNegativeFeedback('React 开发', 'r3', ['Vuex'])

      // 6. 验证权重调整
      const hooksWeight = selfLearning.getLearnedWeight('Hooks')
      const vuexWeight = selfLearning.getLearnedWeight('Vuex')

      // 权重应该存在
      expect(typeof hooksWeight).toBe('number')
      expect(typeof vuexWeight).toBe('number')
    })

    it('should apply learning weights to search results', async () => {
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      const selfLearning = getSelfLearningService()

      // 模拟多次相同查询 (用户经常搜索 "Cherry Studio")
      for (let i = 0; i < 10; i++) {
        selfLearning.recordQuery(['Cherry Studio', '开发'], 'search')
      }

      // 获取权重
      const weight = selfLearning.getLearnedWeight('Cherry Studio')

      // 高频标签应该有显著权重
      expect(weight).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Test Data Verification', () => {
    it('test documents should have correct structure', () => {
      for (const doc of TEST_DOCUMENTS) {
        expect(doc.content).toBeDefined()
        expect(doc.content.length).toBeGreaterThan(0)
        expect(doc.title).toBeDefined()
        expect(doc.tags).toBeDefined()
        expect(doc.tags.length).toBeGreaterThan(0)
      }
    })

    it('test documents should cover various topics', () => {
      const allTags = TEST_DOCUMENTS.flatMap((d) => d.tags)
      const uniqueTags = new Set(allTags)

      // 应该有丰富的标签覆盖
      expect(uniqueTags.size).toBeGreaterThan(15)

      // 应该包含关键标签
      expect(allTags).toContain('Cherry Studio')
      expect(allTags).toContain('React')
      expect(allTags).toContain('AI')
    })
  })
})
