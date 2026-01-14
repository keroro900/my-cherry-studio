/**
 * 统一记忆管理层全面测试
 *
 * 测试覆盖:
 * - IntegratedMemoryCoordinator 完整生命周期
 * - MemoryMasterService 标签管理和 AI 补标
 * - ContextInjectorService 上下文注入系统
 * - 各服务之间的集成
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

// Mock fs for services - include fs.promises for ContextInjectorService
const mockFsPromises = {
  readdir: vi.fn(async () => []),
  readFile: vi.fn(async () => '{}'),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ isDirectory: () => false, mtime: new Date() })),
  access: vi.fn(async () => {})
}

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(() => '{}'),
      readdirSync: vi.fn(() => []),
      promises: mockFsPromises
    },
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    readdirSync: vi.fn(() => []),
    promises: mockFsPromises
  }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: actual,
    ...mockFsPromises
  }
})

// ==================== 测试套件 ====================

describe('MemoryMasterService Comprehensive Test', () => {
  describe('Tag Pool Management', () => {
    it('should add and retrieve tags from pool', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 添加标签
      service.addTagsToPool(['react', 'typescript', 'nodejs'])

      // 验证标签池
      const pool = service.getTagPool()
      expect(pool).toContain('react')
      expect(pool).toContain('typescript')
      expect(pool).toContain('nodejs')
    })

    it('should track tag usage statistics', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 多次添加同一标签
      service.addTagToPool('javascript')
      service.addTagToPool('javascript')
      service.addTagToPool('javascript')

      // 验证统计
      const stats = service.getTagStats()
      const jsStats = stats.find((s) => s.tag === 'javascript')
      expect(jsStats).toBeDefined()
      expect(jsStats!.count).toBe(3)
    })

    it('should format tags correctly', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 添加需要格式化的标签
      service.addTagsToPool(['React Native', 'Vue.js', 'Node JS'])

      // 验证格式化
      const pool = service.getTagPool()
      expect(pool.some((t) => t.includes(' '))).toBe(false) // 无空格
      expect(pool.some((t) => t === t.toLowerCase())).toBe(true) // 小写
    })

    it('should return top N tags by usage', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 添加不同频率的标签
      for (let i = 0; i < 10; i++) service.addTagToPool('high-usage')
      for (let i = 0; i < 5; i++) service.addTagToPool('medium-usage')
      service.addTagToPool('low-usage')

      // 获取 top 2
      const topTags = service.getTopTags(2)
      expect(topTags.length).toBe(2)
      expect(topTags[0]).toBe('high-usage')
    })
  })

  describe('Tag Validation', () => {
    it('should validate tag format', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      const result = service.validateTags([
        'valid-tag',
        'a',
        'this-is-a-very-long-tag-that-exceeds-limit-characters-definitely'
      ])

      expect(result.valid).toBe(false)
      expect(result.invalidTags).toContain('a')
    })
  })

  describe('Configuration', () => {
    it('should manage configuration', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const service = getMemoryMasterService()

      // 获取默认配置
      const config = service.getConfig()
      expect(config.autoTagEnabled).toBe(true)
      expect(config.maxTags).toBe(10)

      // 更新配置
      service.updateConfig({ maxTags: 15 })
      expect(service.getConfig().maxTags).toBe(15)
    })
  })
})

describe('ContextInjectorService Comprehensive Test', () => {
  describe('Rule Management', () => {
    it('should create and retrieve rules', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context')

      // 创建规则
      const rule = await service.createRule({
        name: 'Test Rule',
        description: 'A test rule',
        position: 'system_prefix',
        content: 'Test content',
        priority: 10,
        triggers: [{ type: 'always', value: true }],
        triggerLogic: 'and',
        isActive: true,
        tags: ['test']
      })

      expect(rule.id).toBeDefined()
      expect(rule.name).toBe('Test Rule')

      // 获取所有规则
      const rules = service.getAllRules()
      expect(rules.length).toBeGreaterThanOrEqual(1)
    })

    it('should update and delete rules', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context2')

      // 创建规则
      const rule = await service.createRule({
        name: 'Update Test',
        position: 'hidden',
        content: 'Original',
        priority: 5,
        triggers: [],
        triggerLogic: 'and',
        isActive: true,
        tags: []
      })

      // 更新规则
      const updated = await service.updateRule(rule.id, { content: 'Updated' })
      expect(updated?.content).toBe('Updated')

      // 删除规则
      const deleted = await service.deleteRule(rule.id)
      expect(deleted).toBe(true)
    })
  })

  describe('Preset Management', () => {
    it('should create and manage presets', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context3')

      // 创建预设
      const preset = await service.createPreset({
        name: 'Test Preset',
        description: 'A test preset',
        rules: [],
        isActive: false
      })

      expect(preset.id).toBeDefined()
      expect(preset.name).toBe('Test Preset')

      // 激活预设
      await service.activatePreset(preset.id)
      const activePreset = service.getActivePreset()
      expect(activePreset?.id).toBe(preset.id)
    })

    it('should create director preset template', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context4')

      // 创建导演模式预设
      const preset = await service.createDirectorPreset()

      expect(preset.name).toBe('导演模式')
      expect(preset.rules.length).toBeGreaterThan(0)
      expect(preset.rules.some((r) => r.tags.includes('director'))).toBe(true)
    })

    it('should create roleplay enhancement preset', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context5')

      // 创建角色扮演增强预设
      const preset = await service.createRoleplayEnhancementPreset()

      expect(preset.name).toBe('角色扮演增强')
      expect(preset.rules.some((r) => r.tags.includes('roleplay'))).toBe(true)
    })
  })

  describe('Injection Execution', () => {
    it('should execute injection based on triggers', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context6')

      // 创建 always 触发的规则
      await service.createRule({
        name: 'Always Rule',
        position: 'system_prefix',
        content: 'Always injected',
        priority: 10,
        triggers: [{ type: 'always', value: true }],
        triggerLogic: 'and',
        isActive: true,
        tags: []
      })

      // 执行注入
      const results = service.executeInjection({
        turnCount: 1,
        lastUserMessage: 'Hello',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })

      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((r) => r.content === 'Always injected')).toBe(true)
    })

    it('should support keyword triggers', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context7')

      // 创建关键词触发的规则
      await service.createRule({
        name: 'Keyword Rule',
        position: 'hidden',
        content: 'Keyword matched!',
        priority: 10,
        triggers: [{ type: 'keyword', value: ['hello', '你好'] }],
        triggerLogic: 'or',
        isActive: true,
        tags: []
      })

      // 测试匹配
      const resultsMatch = service.executeInjection({
        turnCount: 1,
        lastUserMessage: '你好，世界',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })

      expect(resultsMatch.some((r) => r.content === 'Keyword matched!')).toBe(true)

      // 测试不匹配
      const resultsNoMatch = service.executeInjection({
        turnCount: 1,
        lastUserMessage: '再见',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })

      expect(resultsNoMatch.some((r) => r.content === 'Keyword matched!')).toBe(false)
    })

    it('should support turn count triggers', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context8')

      // 创建轮次触发的规则
      await service.createRule({
        name: 'Turn Count Rule',
        position: 'hidden',
        content: 'After turn 3',
        priority: 10,
        triggers: [{ type: 'turn_count', value: { min: 3 } }],
        triggerLogic: 'and',
        isActive: true,
        tags: []
      })

      // 轮次 1 - 不触发
      const results1 = service.executeInjection({
        turnCount: 1,
        lastUserMessage: 'test',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })
      expect(results1.some((r) => r.content === 'After turn 3')).toBe(false)

      // 轮次 5 - 触发
      const results5 = service.executeInjection({
        turnCount: 5,
        lastUserMessage: 'test',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })
      expect(results5.some((r) => r.content === 'After turn 3')).toBe(true)
    })

    it('should resolve content variables', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context9')

      // 创建带变量的规则
      await service.createRule({
        name: 'Variable Rule',
        position: 'system_prefix',
        content: '对话轮次: {{turn_count}}, 用户消息: {{last_user_message}}',
        priority: 10,
        triggers: [{ type: 'always', value: true }],
        triggerLogic: 'and',
        isActive: true,
        tags: []
      })

      // 执行注入
      const results = service.executeInjection({
        turnCount: 5,
        lastUserMessage: '测试消息',
        lastAssistantMessage: '',
        contextLength: 100,
        currentTime: new Date()
      })

      const variableResult = results.find((r) => r.ruleName === 'Variable Rule')
      expect(variableResult?.content).toContain('5')
      expect(variableResult?.content).toContain('测试消息')
    })
  })

  describe('Statistics', () => {
    it('should return service statistics', async () => {
      const { ContextInjectorService } = await import('../../../knowledge/agent/ContextInjectorService')
      const service = new ContextInjectorService('/tmp/test-context10')

      const stats = service.getStats()
      expect(typeof stats.ruleCount).toBe('number')
      expect(typeof stats.presetCount).toBe('number')
    })
  })
})

describe('IntegratedMemoryCoordinator Full Lifecycle', () => {
  describe('Initialization', () => {
    it('should initialize with all sub-services', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      // 验证配置存在
      const config = coordinator.getConfig()
      expect(config.memoryMaster).toBeDefined()
      expect(config.selfLearning).toBeDefined()
      expect(config.search).toBeDefined()
    })
  })

  describe('Configuration Management', () => {
    it('should update and retrieve configuration', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      // 更新配置
      coordinator.updateConfig({
        search: {
          defaultBackends: ['diary', 'lightmemo'],
          useRRF: false,
          rrfK: 50,
          defaultTopK: 5,
          minThreshold: 0.2
        }
      })

      const config = coordinator.getConfig()
      expect(config.search.defaultTopK).toBe(5)
      expect(config.search.useRRF).toBe(false)
    })
  })

  describe('Learning Progress', () => {
    it('should track learning progress', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const progress = coordinator.getLearningProgress()

      expect(typeof progress.queryCount).toBe('number')
      expect(typeof progress.feedbackCount).toBe('number')
      expect(progress.tagWeightRange).toBeDefined()
      expect(progress.tagWeightRange.min).toBeDefined()
      expect(progress.tagWeightRange.max).toBeDefined()
    })
  })

  describe('Search Suggestions', () => {
    it('should provide search suggestions', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      // 先添加一些标签到池
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const memoryMaster = getMemoryMasterService()
      memoryMaster.addTagsToPool(['react', 'react-native', 'redux', 'typescript'])

      const suggestions = await coordinator.getSearchSuggestions('rea', 5)

      expect(Array.isArray(suggestions)).toBe(true)
      // 应该包含以 "rea" 开头的标签
      expect(suggestions.some((s) => s.toLowerCase().includes('rea'))).toBe(true)
    })
  })

  describe('Feedback Recording', () => {
    it('should record positive feedback', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      // 应该不抛出错误
      await expect(coordinator.recordPositiveFeedback('search-123', 'result-456', 'test query')).resolves.not.toThrow()
    })

    it('should record negative feedback', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      // 应该不抛出错误
      await expect(coordinator.recordNegativeFeedback('search-123', 'result-789', 'test query')).resolves.not.toThrow()
    })
  })

  describe('Integrated Statistics', () => {
    it('should return comprehensive statistics', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const stats = await coordinator.getIntegratedStats()

      // 验证所有统计部分存在
      expect(stats.memoryStats).toBeDefined()
      expect(stats.learningStats).toBeDefined()
      expect(stats.tagPoolStats).toBeDefined()

      // 验证标签池统计
      expect(typeof stats.tagPoolStats.totalTags).toBe('number')
      expect(Array.isArray(stats.tagPoolStats.topTags)).toBe(true)
    })
  })

  describe('Semantic Association Discovery', () => {
    it('should discover semantic associations', async () => {
      const { IntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = IntegratedMemoryCoordinator.getInstance()

      const result = await coordinator.discoverAndApplyAssociations()

      expect(typeof result.discoveredCount).toBe('number')
      expect(typeof result.appliedCount).toBe('number')
      expect(Array.isArray(result.suggestions)).toBe(true)
    })
  })
})

describe('Service Integration', () => {
  describe('MemoryMaster + SelfLearning Integration', () => {
    it('should share tag information between services', async () => {
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')

      const memoryMaster = getMemoryMasterService()
      const selfLearning = getSelfLearningService()

      // 添加标签到 MemoryMaster
      memoryMaster.addTagsToPool(['shared-tag-1', 'shared-tag-2'])

      // 在 SelfLearning 中记录查询
      selfLearning.recordQuery(['shared-tag-1', 'shared-tag-2'], 'search')

      // 验证两个服务都有这些标签的信息
      expect(memoryMaster.getTagPool()).toContain('shared-tag-1')
      expect(selfLearning.getLearnedWeight('shared-tag-1')).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Full Pipeline Test', () => {
    it('should execute complete memory lifecycle', async () => {
      // 1. 初始化所有服务
      const { getIntegratedMemoryCoordinator } = await import('../IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 2. 添加标签到池
      const { getMemoryMasterService } = await import('../MemoryMasterService')
      getMemoryMasterService().addTagsToPool(['lifecycle', 'test', 'memory'])

      // 3. 记录查询
      const { getSelfLearningService } = await import('../../../knowledge/tagmemo/SelfLearningService')
      getSelfLearningService().recordQuery(['lifecycle', 'test'], 'search')

      // 4. 获取搜索建议
      const suggestions = await coordinator.getSearchSuggestions('life', 3)
      expect(suggestions.length).toBeGreaterThanOrEqual(0)

      // 5. 获取统计
      const stats = await coordinator.getIntegratedStats()
      expect(stats.tagPoolStats.totalTags).toBeGreaterThan(0)

      // 6. 获取学习进度
      const progress = coordinator.getLearningProgress()
      expect(progress.queryCount).toBeGreaterThanOrEqual(0)
    })
  })
})
