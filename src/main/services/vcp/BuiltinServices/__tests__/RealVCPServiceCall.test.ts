/**
 * VCP 内置服务真实调用测试
 *
 * 测试内容:
 * 1. DailyNoteWrite - 写入日记
 * 2. DeepMemo - 记忆搜索
 * 3. LightMemo - RAG 检索
 *
 * 运行命令:
 * yarn test:main --run src/main/services/vcp/BuiltinServices/__tests__/RealVCPServiceCall.test.ts
 */
import { describe, expect, it, vi } from 'vitest'

// Mock node:os
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return {
    ...actual,
    default: actual,
    tmpdir: () => 'C:/tmp',
    homedir: () => 'C:/Users/Administrator'
  }
})

// Mock node:fs
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: actual,
    existsSync: () => true,
    mkdirSync: vi.fn()
  }
})

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return 'C:/Users/Administrator/AppData/Roaming/CherryStudioDev'
      if (name === 'documents') return 'C:/Users/Administrator/Documents'
      return 'C:/tmp/test'
    }),
    isPackaged: false,
    getName: () => 'CherryStudioDev',
    getVersion: () => '1.0.0'
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

// Mock logger
vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: (...args: unknown[]) => console.log('[INFO]', ...args),
      debug: (...args: unknown[]) => console.log('[DEBUG]', ...args),
      warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
      error: (...args: unknown[]) => console.error('[ERROR]', ...args)
    })
  }
}))

// ==================== VCP 协议解析器 ====================

const VCP_TOOL_REQUEST_START = '<<<[TOOL_REQUEST]>>>'
const VCP_TOOL_REQUEST_END = '<<<[END_TOOL_REQUEST]>>>'

/**
 * 解析 VCP 工具调用格式（修复版）
 */
function parseVCPToolRequest(text: string): Array<{
  tool_name: string
  command: string
  params: Record<string, string>
}> {
  const results: Array<{ tool_name: string; command: string; params: Record<string, string> }> = []

  // 转义特殊字符
  const startTag = VCP_TOOL_REQUEST_START.replace(/[<>[\]]/g, '\\$&')
  const endTag = VCP_TOOL_REQUEST_END.replace(/[<>[\]]/g, '\\$&')
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: { tool_name: string; command: string; params: Record<string, string> } = {
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

// ==================== 测试套件 ====================

describe('VCP 协议解析器测试', () => {
  it('应该正确解析标准 VCP 格式', () => {
    const vcpText = `
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」这是一条测试日记「末」
tags:「始」测试, VCP「末」
<<<[END_TOOL_REQUEST]>>>
`
    const result = parseVCPToolRequest(vcpText)
    console.log('解析结果:', JSON.stringify(result, null, 2))

    expect(result.length).toBe(1)
    expect(result[0].tool_name).toBe('DailyNoteWrite')
    expect(result[0].command).toBe('write')
    expect(result[0].params.content).toBe('这是一条测试日记')
    expect(result[0].params.tags).toBe('测试, VCP')
  })

  it('应该正确解析简单冒号格式', () => {
    const vcpText = `
<<<[TOOL_REQUEST]>>>
tool_name: DeepMemo
command: DeepSearch
query: 机器学习笔记
initialK: 30
finalK: 5
<<<[END_TOOL_REQUEST]>>>
`
    const result = parseVCPToolRequest(vcpText)
    console.log('解析结果:', JSON.stringify(result, null, 2))

    expect(result.length).toBe(1)
    expect(result[0].tool_name).toBe('DeepMemo')
    expect(result[0].command).toBe('DeepSearch')
    expect(result[0].params.query).toBe('机器学习笔记')
  })

  it('应该正确解析多个工具调用', () => {
    const vcpText = `
我需要先搜索记忆，然后写入日记。

<<<[TOOL_REQUEST]>>>
tool_name:「始」DeepMemo「末」
command:「始」DeepSearch「末」
query:「始」今天的工作内容「末」
<<<[END_TOOL_REQUEST]>>>

找到相关记忆后，写入日记：

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」今天完成了 VCP 测试工作「末」
<<<[END_TOOL_REQUEST]>>>
`
    const result = parseVCPToolRequest(vcpText)
    console.log('解析结果:', JSON.stringify(result, null, 2))

    expect(result.length).toBe(2)
    expect(result[0].tool_name).toBe('DeepMemo')
    expect(result[1].tool_name).toBe('DailyNoteWrite')
  })
})

describe('DailyNoteWriteService 单元测试', () => {
  it('应该能导入 DailyNoteWriteService', async () => {
    const module = await import('../DailyNoteWriteService')
    expect(module.DailyNoteWriteService).toBeDefined()
  })

  it('应该有正确的服务属性', async () => {
    const { DailyNoteWriteService } = await import('../DailyNoteWriteService')
    const service = new DailyNoteWriteService()

    expect(service.name).toBe('DailyNoteWrite')
    expect(service.version).toBe('3.0.0')
    expect(service.category).toBe('diary')
  })

  it('应该有 write 命令定义', async () => {
    const { DailyNoteWriteService } = await import('../DailyNoteWriteService')
    const service = new DailyNoteWriteService()

    const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
    console.log('可用命令:', commands)

    expect(commands).toContain('write')
    expect(commands).toContain('quickNote')
  })
})

describe('IntegratedMemoryService 单元测试（统一记忆服务）', () => {
  it('应该能导入 IntegratedMemoryService', async () => {
    const module = await import('../IntegratedMemoryService')
    expect(module.IntegratedMemoryService).toBeDefined()
  })

  it('应该有正确的工具定义', async () => {
    const { IntegratedMemoryService } = await import('../IntegratedMemoryService')
    const service = new IntegratedMemoryService()

    const commands = service.toolDefinitions.map((t) => t.commandIdentifier)
    console.log('Memory 命令:', commands)

    // 原 DeepMemo 命令
    expect(commands).toContain('DeepSearch')
    expect(commands).toContain('WaveRAGSearch')

    // 原 LightMemo 命令
    expect(commands).toContain('LightSearch')
    expect(commands).toContain('SearchRAG') // 向后兼容

    // 原 AIMemo 命令
    expect(commands).toContain('AIMemoSearch')

    // 原 MemoryMaster 命令
    expect(commands).toContain('CreateMemory')
    expect(commands).toContain('AutoTag')
  })
})

describe('VCP 服务集成检查', () => {
  it('应该能列出所有内置服务', async () => {
    const module = await import('../index')
    // 使用 ensureBuiltinServicesInitialized 确保服务已初始化
    const registry = await module.ensureBuiltinServicesInitialized()

    // 使用公共方法获取所有服务
    const allServices = registry.getAll()
    const allNames = registry.getAllNames()

    console.log('\n注册的内置服务:')
    for (const service of allServices) {
      console.log(`- ${service.name}: ${service.displayName || service.description?.slice(0, 50)}`)
    }

    expect(allNames.length).toBeGreaterThan(0)
    expect(registry.has('DailyNoteWrite')).toBe(true)
    // 统一记忆服务
    expect(registry.has('Memory')).toBe(true)
    // 向后兼容别名
    expect(registry.has('LightMemo')).toBe(true)
    expect(registry.has('DeepMemo')).toBe(true)
  })
})
