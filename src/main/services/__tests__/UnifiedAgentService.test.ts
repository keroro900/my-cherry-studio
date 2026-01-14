/**
 * UnifiedAgentService 单元测试
 *
 * 测试统一 Agent 服务功能:
 * - Agent CRUD 操作
 * - 消息传递
 * - 任务委托
 * - 群体投票
 * - 同步功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
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

// Mock node:fs
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    readdirSync: vi.fn(() => []),
    unlinkSync: vi.fn()
  }
})

// Mock ReduxService
vi.mock('../ReduxService', () => ({
  reduxService: {
    select: vi.fn().mockResolvedValue([
      {
        id: 'assistant-1',
        name: 'Test Assistant',
        emoji: '🤖',
        prompt: 'You are a helpful assistant',
        tags: ['general'],
        enableMemory: true
      }
    ])
  }
}))

// Mock UnifiedAgentAdapter
vi.mock('../../knowledge/agent/UnifiedAgentAdapter', () => ({
  getUnifiedAgentAdapter: vi.fn(() => ({
    clear: vi.fn(),
    fromAssistant: vi.fn((a: any) => ({
      id: `unified_${a.id}`,
      name: a.name,
      displayName: a.name,
      enabled: true,
      systemPrompt: a.prompt,
      groupRole: 'participant',
      expertise: [],
      keywords: [],
      priority: 50
    })),
    fromVCPAgent: vi.fn((a: any) => ({
      id: `unified_${a.id}`,
      name: a.name,
      displayName: a.displayName,
      enabled: a.isActive,
      systemPrompt: a.systemPrompt,
      groupRole: 'participant',
      expertise: [],
      keywords: [],
      priority: 50
    })),
    getAllAgents: vi.fn().mockReturnValue([])
  }))
}))

// Mock VCPAgentService
vi.mock('../../knowledge/agent/VCPAgentService', () => ({
  getVCPAgentService: vi.fn(() => ({
    getAllAgents: vi.fn().mockReturnValue([])
  }))
}))

describe('UnifiedAgentService', () => {
  let UnifiedAgentService: any
  let getUnifiedAgentService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset singleton
    vi.resetModules()
    // Dynamic import
    const module = await import('../UnifiedAgentService')
    UnifiedAgentService = module.UnifiedAgentService
    getUnifiedAgentService = module.getUnifiedAgentService
  })

  describe('Module Structure', () => {
    it('should export UnifiedAgentService class', () => {
      expect(UnifiedAgentService).toBeDefined()
    })

    it('should export getUnifiedAgentService function', () => {
      expect(getUnifiedAgentService).toBeDefined()
      expect(typeof getUnifiedAgentService).toBe('function')
    })

    it('should export type definitions', async () => {
      const module = await import('../UnifiedAgentService')
      // Types are compile-time only, we verify by checking the module structure
      expect(module).toBeDefined()
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = getUnifiedAgentService()
      const service2 = getUnifiedAgentService()
      expect(service1).toBe(service2)
    })
  })

  describe('Agent CRUD', () => {
    it('should create a new agent', async () => {
      const service = getUnifiedAgentService()

      const agent = await service.createAgent({
        name: 'TestAgent',
        displayName: 'Test Agent',
        systemPrompt: 'You are a test agent'
      })

      expect(agent).toBeDefined()
      expect(agent.id).toBeDefined()
      expect(agent.name).toBe('TestAgent')
      expect(agent.displayName).toBe('Test Agent')
      expect(agent.type).toBe('custom')
    })

    it('should create agent with full config', async () => {
      const service = getUnifiedAgentService()

      const agent = await service.createAgent({
        name: 'FullAgent',
        type: 'vcp',
        systemPrompt: 'System prompt',
        personality: 'Friendly',
        background: 'AI assistant',
        memory: {
          enabled: true,
          diaryBookName: 'agent-diary',
          backends: ['diary', 'memory']
        },
        tools: {
          mcpServers: ['server-1'],
          autoApproveAll: false
        },
        groupChat: {
          enabled: true,
          role: 'expert',
          expertise: ['AI', 'ML'],
          priority: 80
        }
      })

      expect(agent.type).toBe('vcp')
      expect(agent.personality).toBe('Friendly')
      expect(agent.memory.enabled).toBe(true)
      expect(agent.memory.diaryBookName).toBe('agent-diary')
      expect(agent.tools.mcpServers).toContain('server-1')
      expect(agent.groupChat.role).toBe('expert')
      expect(agent.groupChat.expertise).toContain('AI')
    })

    it('should update an agent', async () => {
      const service = getUnifiedAgentService()

      const agent = await service.createAgent({
        name: 'UpdateTest',
        systemPrompt: 'Original prompt'
      })

      const updated = await service.updateAgent(agent.id, {
        displayName: 'Updated Name',
        systemPrompt: 'Updated prompt'
      })

      expect(updated.displayName).toBe('Updated Name')
      expect(updated.systemPrompt).toBe('Updated prompt')
      expect(updated.id).toBe(agent.id) // ID should not change
    })

    it('should throw error when updating non-existent agent', async () => {
      const service = getUnifiedAgentService()

      await expect(service.updateAgent('non-existent-id', { displayName: 'New Name' })).rejects.toThrow(
        'Agent not found'
      )
    })

    it('should delete an agent', async () => {
      const service = getUnifiedAgentService()

      const agent = await service.createAgent({
        name: 'DeleteTest',
        systemPrompt: 'To be deleted'
      })

      await service.deleteAgent(agent.id)

      const found = await service.getAgent(agent.id)
      expect(found).toBeNull()
    })

    it('should list agents with filters', async () => {
      const service = getUnifiedAgentService()

      await service.createAgent({
        name: 'Agent1',
        type: 'vcp',
        memory: { enabled: true },
        tags: ['tag1']
      })

      await service.createAgent({
        name: 'Agent2',
        type: 'assistant',
        memory: { enabled: false },
        tags: ['tag2']
      })

      // Filter by type
      const vcpAgents = await service.listAgents({ type: 'vcp' })
      expect(vcpAgents.some((a: any) => a.name === 'Agent1')).toBe(true)

      // Filter by memory
      const memoryAgents = await service.listAgents({ hasMemory: true })
      expect(memoryAgents.some((a: any) => a.memory.enabled === true)).toBe(true)

      // Filter by tags
      const taggedAgents = await service.listAgents({ tags: ['tag1'] })
      expect(taggedAgents.some((a: any) => a.name === 'Agent1')).toBe(true)
    })
  })

  describe('Messaging', () => {
    it('should send message between agents', async () => {
      const service = getUnifiedAgentService()

      const message = await service.sendMessage('agent-1', 'agent-2', 'Hello!', { type: 'greeting' })

      expect(message).toBeDefined()
      expect(message.id).toBeDefined()
      expect(message.fromAgentId).toBe('agent-1')
      expect(message.toAgentId).toBe('agent-2')
      expect(message.content).toBe('Hello!')
    })

    it('should broadcast message to all agents', async () => {
      const service = getUnifiedAgentService()

      const message = await service.broadcast('system', 'Announcement!')

      expect(message.toAgentId).toBe('broadcast')
      expect(message.type).toBe('notification')
    })

    it('should get pending messages for agent', async () => {
      const service = getUnifiedAgentService()

      await service.sendMessage('agent-1', 'agent-2', 'Message 1')
      await service.sendMessage('agent-1', 'agent-2', 'Message 2')

      const pending = service.getPendingMessages('agent-2')
      expect(pending.length).toBe(2)
    })

    it('should acknowledge message', async () => {
      const service = getUnifiedAgentService()

      const message = await service.sendMessage('agent-1', 'agent-2', 'Test')

      const acked = service.acknowledgeMessage(message.id)
      expect(acked).toBe(true)

      const pending = service.getPendingMessages('agent-2')
      expect(pending.find((m: any) => m.id === message.id)).toBeUndefined()
    })

    it('should notify message listeners', async () => {
      const service = getUnifiedAgentService()
      const listener = vi.fn()

      service.onMessage(listener)
      await service.sendMessage('agent-1', 'agent-2', 'Test')

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Task Delegation', () => {
    it('should create a task', async () => {
      const service = getUnifiedAgentService()

      const task = await service.createTask('agent-1', 'Review this code', {
        type: 'action',
        priority: 'high'
      })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.fromAgentId).toBe('agent-1')
      expect(task.description).toBe('Review this code')
      expect(task.priority).toBe('high')
    })

    it('should complete a task', async () => {
      const service = getUnifiedAgentService()

      const task = await service.createTask('agent-1', 'Test task')

      const completed = service.completeTask(task.id, 'Task completed successfully')
      expect(completed).toBe(true)
    })

    it('should get pending tasks for agent', async () => {
      const service = getUnifiedAgentService()

      const task = await service.createTask('agent-1', 'Task for agent-2', {
        targetAgentId: 'agent-2'
      })

      const pending = service.getPendingTasks('agent-2')
      expect(pending.some((t: any) => t.id === task.id)).toBe(true)
    })

    it('should notify task listeners', async () => {
      const service = getUnifiedAgentService()
      const listener = vi.fn()

      service.onTask(listener)
      await service.createTask('agent-1', 'Test task')

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Voting', () => {
    it('should initiate a vote', async () => {
      const service = getUnifiedAgentService()

      const vote = await service.initiateVote(
        'initiator-1',
        'Choose framework',
        [
          { id: 'opt-1', label: 'React' },
          { id: 'opt-2', label: 'Vue' }
        ],
        ['agent-1', 'agent-2']
      )

      expect(vote).toBeDefined()
      expect(vote.id).toBeDefined()
      expect(vote.topic).toBe('Choose framework')
      expect(vote.options.length).toBe(2)
      expect(vote.status).toBe('active')
    })

    it('should submit a vote', async () => {
      const service = getUnifiedAgentService()

      const vote = await service.initiateVote(
        'initiator-1',
        'Test vote',
        [
          { id: 'opt-1', label: 'Option 1' },
          { id: 'opt-2', label: 'Option 2' }
        ],
        ['agent-1']
      )

      const submitted = service.submitVote(vote.id, 'agent-1', 'opt-1')
      expect(submitted).toBe(true)
    })

    it('should reject vote from non-participant', async () => {
      const service = getUnifiedAgentService()

      const vote = await service.initiateVote(
        'initiator-1',
        'Test vote',
        [{ id: 'opt-1', label: 'Option 1' }],
        ['agent-1']
      )

      const submitted = service.submitVote(vote.id, 'agent-2', 'opt-1') // agent-2 not in participants
      expect(submitted).toBe(false)
    })

    it('should get vote status', async () => {
      const service = getUnifiedAgentService()

      const vote = await service.initiateVote(
        'initiator-1',
        'Test vote',
        [{ id: 'opt-1', label: 'Option 1' }],
        ['agent-1', 'agent-2']
      )

      service.submitVote(vote.id, 'agent-1', 'opt-1')

      const status = service.getVoteStatus(vote.id)
      expect(status).toBeDefined()
      expect(status?.votedCount).toBe(1)
    })
  })

  describe('Synchronization', () => {
    it('should sync from Assistant', async () => {
      const service = getUnifiedAgentService()

      const assistant = {
        id: 'assistant-1',
        name: 'Test Assistant',
        emoji: '🤖',
        prompt: 'You are helpful',
        tags: ['general'],
        enableMemory: true,
        groupChatConfig: {
          enabled: true,
          role: 'participant'
        }
      }

      const agent = await service.syncFromAssistant(assistant)

      expect(agent).toBeDefined()
      expect(agent.type).toBe('assistant')
      expect(agent.name).toBe('Test Assistant')
      expect(agent.systemPrompt).toBe('You are helpful')
      expect(agent.memory.enabled).toBe(true)
    })

    it('should sync to Assistant format', async () => {
      const service = getUnifiedAgentService()

      const agent = await service.createAgent({
        name: 'TestAgent',
        systemPrompt: 'Test prompt',
        memory: { enabled: true }
      })

      const assistant = service.syncToAssistant(agent)

      expect(assistant.name).toBe('TestAgent')
      expect(assistant.prompt).toBe('Test prompt')
      expect(assistant.enableMemory).toBe(true)
    })
  })

  describe('Group Chat Support', () => {
    it('should get group agents', async () => {
      const service = getUnifiedAgentService()

      await service.createAgent({
        name: 'GroupAgent1',
        groupChat: { enabled: true, role: 'participant', expertise: [], triggerKeywords: [], priority: 50 }
      })

      await service.createAgent({
        name: 'NonGroupAgent',
        groupChat: { enabled: false, role: 'participant', expertise: [], triggerKeywords: [], priority: 50 }
      })

      const agents = await service.listAgents({ groupChatEnabled: true })
      expect(agents.some((a: any) => a.name === 'GroupAgent1')).toBe(true)
      expect(agents.some((a: any) => a.name === 'NonGroupAgent')).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const service = getUnifiedAgentService()

      await service.sendMessage('agent-1', 'agent-2', 'Test')
      await service.createTask('agent-1', 'Test task')

      service.cleanup()

      expect(service.getPendingMessages('agent-2').length).toBe(0)
      expect(service.getPendingTasks('agent-1').length).toBe(0)
    })
  })
})
