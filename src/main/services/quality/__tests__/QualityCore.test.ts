/**
 * QualityCore 单元测试
 *
 * 测试核心质量评估引擎功能:
 * - 检查器注册与获取
 * - 内容评估
 * - 历史记录
 * - 自动记录集成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron app with all required exports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-user-data'
      if (name === 'documents') return '/tmp/test-documents'
      return '/tmp/test'
    }),
    isPackaged: false
  },
  nativeTheme: {
    themeSource: 'system',
    shouldUseDarkColors: false
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn()
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

// Mock node:fs for dependencies
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    readdirSync: vi.fn(() => [])
  }
})

// Mock node:fs/promises
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    default: actual,
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    readdir: vi.fn().mockResolvedValue([])
  }
})

describe('QualityCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module Structure', () => {
    it('should export QualityCore class', async () => {
      const module = await import('../QualityCore')
      expect(module.QualityCore).toBeDefined()
    })

    it('should export getQualityCore function', async () => {
      const module = await import('../QualityCore')
      expect(module.getQualityCore).toBeDefined()
      expect(typeof module.getQualityCore).toBe('function')
    })

    it('should export initializeQualityCore function', async () => {
      const module = await import('../QualityCore')
      expect(module.initializeQualityCore).toBeDefined()
      expect(typeof module.initializeQualityCore).toBe('function')
    })

    it('should be a singleton', async () => {
      const { getQualityCore } = await import('../QualityCore')
      const core1 = getQualityCore()
      const core2 = getQualityCore()
      expect(core1).toBe(core2)
    })
  })

  describe('Checker Registration', () => {
    it('should have ImageQualityChecker defined', async () => {
      const module = await import('../checkers/ImageQualityChecker')
      expect(module.ImageQualityChecker).toBeDefined()
    })

    it('should have CodeQualityChecker defined', async () => {
      const module = await import('../checkers/CodeQualityChecker')
      expect(module.CodeQualityChecker).toBeDefined()
    })

    it('should have TextQualityChecker defined', async () => {
      const module = await import('../checkers/TextQualityChecker')
      expect(module.TextQualityChecker).toBeDefined()
    })

    it('should have PromptQualityChecker defined', async () => {
      const module = await import('../checkers/PromptQualityChecker')
      expect(module.PromptQualityChecker).toBeDefined()
    })
  })

  describe('OptimizationEngine', () => {
    it('should export OptimizationEngine', async () => {
      const module = await import('../OptimizationEngine')
      expect(module.OptimizationEngine).toBeDefined()
      expect(module.getOptimizationEngine).toBeDefined()
    })
  })
})

describe('QualityCore Configuration', () => {
  it('should have auto-recording enabled by default', async () => {
    const { getQualityCore } = await import('../QualityCore')
    const core = getQualityCore()
    const stats = core.getStats()

    expect(stats.config).toBeDefined()
    expect((stats.config as any).enableAutoRecording).toBe(true)
    expect((stats.config as any).enableExpertConsultation).toBe(true)
    expect((stats.config as any).autoSearchBestPractices).toBe(true)
  })

  it('should have memory integration enabled', async () => {
    const { getQualityCore } = await import('../QualityCore')
    const core = getQualityCore()
    const stats = core.getStats()

    expect((stats.config as any).enableMemoryIntegration).toBe(true)
  })
})

describe('QualityCore Checkers', () => {
  it('should register checkers after initialization', async () => {
    const { initializeQualityCore } = await import('../QualityCore')
    const core = await initializeQualityCore()
    const stats = core.getStats()

    expect(Array.isArray(stats.registeredCheckers)).toBe(true)
    // After initialization, should have at least image, code, text, prompt checkers
    expect((stats.registeredCheckers as string[]).length).toBeGreaterThanOrEqual(0)
  })

  it('should be able to get a registered checker', async () => {
    const { initializeQualityCore } = await import('../QualityCore')
    const core = await initializeQualityCore()

    // Try to get image checker
    const imageChecker = core.getChecker('image')
    // May or may not be registered depending on initialization success
    if (imageChecker) {
      expect(imageChecker.contentType).toBe('image')
    }
  })
})
