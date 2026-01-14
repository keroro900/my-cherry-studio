/**
 * VCP 内置服务端到端测试
 *
 * 模拟真实用户通过助手界面调用工具的完整链路：
 * 1. 初始化 BuiltinServiceRegistry
 * 2. 模拟 AI 输出 VCP 工具调用格式
 * 3. 解析并执行工具
 * 4. 验证结果
 *
 * 运行命令:
 * yarn test:main --run src/main/services/vcp/BuiltinServices/__tests__/E2EBuiltinServiceTest.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// ==================== Mock Setup ====================

// Mock node:os
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return {
    ...actual,
    default: actual,
    tmpdir: () => 'C:/tmp',
    homedir: () => 'C:/Users/Test'
  }
})

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return 'C:/Users/Test/AppData/Roaming/CherryStudioDev'
      if (name === 'documents') return 'C:/Users/Test/Documents'
      return 'C:/tmp/test'
    }),
    isPackaged: false,
    getName: () => 'CherryStudioDev',
    getVersion: () => '1.0.0'
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: () => []
  }
}))

// Mock logger with detailed output
vi.mock('@logger', () => ({
  loggerService: {
    withContext: (ctx: string) => ({
      info: (...args: unknown[]) => console.log(`[INFO:${ctx}]`, ...args),
      debug: (...args: unknown[]) => console.log(`[DEBUG:${ctx}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[WARN:${ctx}]`, ...args),
      error: (...args: unknown[]) => console.error(`[ERROR:${ctx}]`, ...args)
    })
  }
}))

// ==================== VCP Protocol Parser ====================

const VCP_TOOL_REQUEST_START = '<<<[TOOL_REQUEST]>>>'
const VCP_TOOL_REQUEST_END = '<<<[END_TOOL_REQUEST]>>>'

interface ParsedToolCall {
  tool_name: string
  command: string
  params: Record<string, string>
}

/**
 * 解析 AI 输出的 VCP 工具调用格式
 */
function parseVCPToolRequest(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = []

  const startTag = VCP_TOOL_REQUEST_START.replace(/[<>[\]]/g, '\\$&')
  const endTag = VCP_TOOL_REQUEST_END.replace(/[<>[\]]/g, '\\$&')
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: ParsedToolCall = {
      tool_name: '',
      command: '',
      params: {}
    }

    const lines = content.split('\n')
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 格式1: key:「始」value「末」
      let keyMatch = trimmedLine.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) {
        // 格式2: key: value
        keyMatch = trimmedLine.match(/^(\w+):\s*(.+)$/)
      }

      if (keyMatch) {
        const [, key, value] = keyMatch
        const cleanValue = value.trim()
        if (key === 'tool_name') {
          parsed.tool_name = cleanValue
        } else if (key === 'command') {
          parsed.command = cleanValue
        } else {
          parsed.params[key] = cleanValue
        }
      }
    }

    if (parsed.tool_name) {
      results.push(parsed)
    }
  }

  return results
}

// ==================== Test Helpers ====================

interface TestResult {
  service: string
  command: string
  success: boolean
  output?: string
  error?: string
  executionTimeMs?: number
}

const testResults: TestResult[] = []

/**
 * 执行工具调用并记录结果
 */
async function executeAndLog(
  registry: any,
  toolCall: ParsedToolCall,
  description: string
): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试: ${description}`)
  console.log(`服务: ${toolCall.tool_name}, 命令: ${toolCall.command}`)
  console.log(`参数:`, JSON.stringify(toolCall.params, null, 2))
  console.log('='.repeat(60))

  const startTime = Date.now()
  let result: TestResult

  try {
    const execResult = await registry.execute(
      toolCall.tool_name,
      toolCall.command,
      toolCall.params
    )

    result = {
      service: toolCall.tool_name,
      command: toolCall.command,
      success: execResult.success,
      output: typeof execResult.output === 'string' ? execResult.output : JSON.stringify(execResult.output),
      error: execResult.error,
      executionTimeMs: Date.now() - startTime
    }

    if (execResult.success) {
      console.log(`✅ 成功 (${result.executionTimeMs}ms)`)
      console.log(`输出:`, execResult.output?.slice?.(0, 500) || execResult.output)
    } else {
      console.log(`❌ 失败: ${execResult.error}`)
    }
  } catch (error) {
    result = {
      service: toolCall.tool_name,
      command: toolCall.command,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - startTime
    }
    console.log(`❌ 异常: ${result.error}`)
  }

  testResults.push(result)
  return result
}

// ==================== Test Suites ====================

describe('VCP 内置服务端到端测试', () => {
  let registry: any

  beforeAll(async () => {
    console.log('\n🚀 初始化 BuiltinServiceRegistry...')

    const module = await import('../index')
    registry = module.getBuiltinServiceRegistry()

    // 不调用 initialize()，因为它会尝试加载 VCPRuntime 配置
    // 直接测试各个服务的导入和基本功能

    console.log('✅ Registry 获取成功')
  })

  afterAll(() => {
    console.log('\n' + '='.repeat(60))
    console.log('📊 测试结果汇总')
    console.log('='.repeat(60))

    const passed = testResults.filter((r) => r.success).length
    const failed = testResults.filter((r) => !r.success).length

    console.log(`总计: ${testResults.length} 个测试`)
    console.log(`✅ 通过: ${passed}`)
    console.log(`❌ 失败: ${failed}`)

    if (failed > 0) {
      console.log('\n失败的测试:')
      testResults
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.service}:${r.command} - ${r.error}`)
        })
    }
  })

  // ==================== 1. VCPToolInfo 服务测试 ====================

  describe('VCPToolInfo 服务', () => {
    it('应该能查询所有工具信息', async () => {
      const { VCPToolInfoService } = await import('../VCPToolInfoService')
      const service = new VCPToolInfoService()
      await service.initialize?.()

      const result = await service.execute('ListTools', {})

      console.log('ListTools 结果:', JSON.stringify(result, null, 2).slice(0, 1000))

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('应该能查询单个工具详情', async () => {
      const { VCPToolInfoService } = await import('../VCPToolInfoService')
      const service = new VCPToolInfoService()

      const result = await service.execute('GetToolInfo', {
        tool_name: 'LightMemo'
      })

      console.log('GetToolInfo 结果:', JSON.stringify(result, null, 2).slice(0, 1000))

      expect(result.success).toBe(true)
    })
  })

  // ==================== 2. DailyNoteWrite 服务测试 ====================

  describe('DailyNoteWrite 服务', () => {
    it('应该能导入服务', async () => {
      const { DailyNoteWriteService } = await import('../DailyNoteWriteService')
      const service = new DailyNoteWriteService()

      expect(service.name).toBe('DailyNoteWrite')
      expect(service.toolDefinitions.length).toBeGreaterThan(0)
    })

    it('应该有正确的命令定义', async () => {
      const { DailyNoteWriteService } = await import('../DailyNoteWriteService')
      const service = new DailyNoteWriteService()

      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      console.log('DailyNoteWrite 命令:', commands)

      expect(commands).toContain('write')
      expect(commands).toContain('quickNote')
      expect(commands).toContain('read')
    })

    // 注意: 实际写入测试需要 NoteService 初始化，跳过
    it.skip('应该能写入日记', async () => {
      const { DailyNoteWriteService } = await import('../DailyNoteWriteService')
      const service = new DailyNoteWriteService()

      const result = await service.execute('write', {
        content: '这是一条来自 E2E 测试的日记条目',
        tags: '测试,E2E'
      })

      console.log('write 结果:', result)
      expect(result.success).toBe(true)
    })
  })

  // ==================== 3. IntegratedMemory 服务测试（统一记忆服务） ====================
  // 替代原来的 LightMemo/DeepMemo/AIMemo 测试

  describe('IntegratedMemory 服务（统一记忆）', () => {
    it('应该能导入服务', async () => {
      const { IntegratedMemoryService } = await import('../IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      expect(service.name).toBe('Memory')
      expect(service.version).toBe('1.0.0')
    })

    it('应该有正确的命令定义', async () => {
      const { IntegratedMemoryService } = await import('../IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      console.log('Memory 命令:', commands)

      // 原 LightMemo 命令
      expect(commands).toContain('LightSearch')
      expect(commands).toContain('SearchRAG') // 向后兼容
      expect(commands).toContain('RecordFeedback')

      // 原 DeepMemo 命令
      expect(commands).toContain('DeepSearch')
      expect(commands).toContain('WaveRAGSearch')

      // 原 AIMemo 命令
      expect(commands).toContain('AIMemoSearch')
      expect(commands).toContain('Recall') // 向后兼容

      // 原 MemoryMaster 命令
      expect(commands).toContain('CreateMemory')
      expect(commands).toContain('AutoTag')
      expect(commands).toContain('GetTopTags')

      // 统计
      expect(commands).toContain('GetStats')
    })

    // 注意: 实际搜索需要 IntegratedMemoryCoordinator 初始化
    it.skip('应该能执行 LightSearch', async () => {
      const { IntegratedMemoryService } = await import('../IntegratedMemoryService')
      const service = new IntegratedMemoryService()

      const result = await service.execute('LightSearch', {
        query: '测试查询',
        k: '5'
      })

      console.log('LightSearch 结果:', result)
    })
  })

  // ==================== 4. ModelSelector 服务测试 ====================

  describe('ModelSelector 服务', () => {
    it('应该能导入服务', async () => {
      const { ModelSelectorService } = await import('../ModelSelectorService')
      const service = new ModelSelectorService()

      expect(service.name).toBe('ModelSelector')
    })

    it('应该有正确的命令定义', async () => {
      const { ModelSelectorService } = await import('../ModelSelectorService')
      const service = new ModelSelectorService()

      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      console.log('ModelSelector 命令:', commands)

      expect(commands.length).toBeGreaterThan(0)
    })
  })

  // ==================== 7. WorkflowBridge 服务测试 ====================

  describe('WorkflowBridge 服务', () => {
    it('应该能导入服务', async () => {
      const { WorkflowBridgeService } = await import('../WorkflowBridgeService')
      const service = new WorkflowBridgeService()

      expect(service.name).toBe('WorkflowBridge')
    })

    it('应该有 execute_node 命令', async () => {
      const { WorkflowBridgeService } = await import('../WorkflowBridgeService')
      const service = new WorkflowBridgeService()

      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      console.log('WorkflowBridge 命令:', commands)

      // 检查是否有执行节点的命令
      expect(commands.some((c) => c.toLowerCase().includes('execute') || c.toLowerCase().includes('run'))).toBe(true)
    })
  })

  // ==================== 8. VCPForum 服务测试 ====================

  describe('VCPForum 服务', () => {
    it('应该能导入服务', async () => {
      const { VCPForumService } = await import('../VCPForumService')
      const service = new VCPForumService()

      expect(service.name).toBe('VCPForum')
    })

    it('应该有正确的命令定义', async () => {
      const { VCPForumService } = await import('../VCPForumService')
      const service = new VCPForumService()

      const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
      console.log('VCPForum 命令:', commands)

      expect(commands.length).toBeGreaterThan(0)
    })
  })

  // ==================== 9. QualityGuardian 服务测试 ====================

  describe('QualityGuardian 服务', () => {
    it('应该能导入服务', async () => {
      const { QualityGuardianService } = await import('../QualityGuardianService')
      const service = new QualityGuardianService()

      expect(service.name).toBe('QualityGuardian')
    })
  })

  // ==================== 10. VCP 协议解析测试 ====================

  describe('VCP 协议解析', () => {
    it('应该正确解析标准格式', () => {
      const aiOutput = `
我来帮你搜索相关记忆。

<<<[TOOL_REQUEST]>>>
tool_name:「始」LightMemo「末」
command:「始」SearchRAG「末」
query:「始」用户的咖啡偏好「末」
k:「始」5「末」
<<<[END_TOOL_REQUEST]>>>

正在搜索中...
`
      const calls = parseVCPToolRequest(aiOutput)

      expect(calls.length).toBe(1)
      expect(calls[0].tool_name).toBe('LightMemo')
      expect(calls[0].command).toBe('SearchRAG')
      expect(calls[0].params.query).toBe('用户的咖啡偏好')
    })

    it('应该正确解析多工具调用', () => {
      const aiOutput = `
首先搜索记忆，然后写入日记。

<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」今天的工作「末」
<<<[END_TOOL_REQUEST]>>>

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」总结今天的工作内容「末」
<<<[END_TOOL_REQUEST]>>>
`
      const calls = parseVCPToolRequest(aiOutput)

      expect(calls.length).toBe(2)
      expect(calls[0].tool_name).toBe('DeepMemo')
      expect(calls[1].tool_name).toBe('DailyNoteWrite')
    })

    it('应该正确解析简单冒号格式', () => {
      const aiOutput = `
<<<[TOOL_REQUEST]>>>
tool_name: AIMemo
command: Stats
<<<[END_TOOL_REQUEST]>>>
`
      const calls = parseVCPToolRequest(aiOutput)

      expect(calls.length).toBe(1)
      expect(calls[0].tool_name).toBe('AIMemo')
      expect(calls[0].command).toBe('Stats')
    })
  })

  // ==================== 11. 服务注册表完整性检查 ====================

  describe('服务注册表完整性', () => {
    it('应该注册了所有核心服务', async () => {
      const module = await import('../index')
      const registry = module.getBuiltinServiceRegistry()

      const allServices = registry.getAll()
      const serviceNames = allServices.map((s: any) => s.name)

      console.log('\n已注册的服务:')
      serviceNames.forEach((name: string) => console.log(`  - ${name}`))

      // 核心服务检查
      const coreServices = [
        'vcp_tool_info',
        'LightMemo',
        'DeepMemo',
        'AIMemo',
        'DailyNoteWrite'
      ]

      for (const serviceName of coreServices) {
        const exists = registry.has(serviceName)
        console.log(`${serviceName}: ${exists ? '✅' : '❌'}`)
        expect(exists).toBe(true)
      }
    })

    it('每个服务应该有 toolDefinitions', async () => {
      const module = await import('../index')
      const registry = module.getBuiltinServiceRegistry()

      const allServices = registry.getAll()

      for (const service of allServices) {
        expect(service.toolDefinitions).toBeDefined()
        expect(Array.isArray(service.toolDefinitions)).toBe(true)
        console.log(`${service.name}: ${service.toolDefinitions.length} 个命令`)
      }
    })
  })
})
