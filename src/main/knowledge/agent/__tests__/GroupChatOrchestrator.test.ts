/**
 * GroupChatOrchestrator 单元测试
 *
 * 测试群聊编排器功能:
 * - 会话创建与管理
 * - Agent 添加/移除
 * - 发言模式 (sequential, random, naturerandom, mention, keyword, consensus)
 * - @提及解析
 * - 用户输入处理
 * - 事件订阅
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

// Mock MCPBridge
vi.mock('@main/mcpServers/shared/MCPBridge', () => ({
  mcpBridge: {
    generateText: vi.fn().mockResolvedValue('Mock AI response'),
    webSearch: vi.fn().mockResolvedValue([]),
    searchKnowledge: vi.fn().mockResolvedValue([])
  }
}))

// Mock VCPRuntime
vi.mock('@main/services/vcp/VCPRuntime', () => ({
  VCPRuntime: {
    getInstance: vi.fn().mockReturnValue({
      resolvePlaceholders: vi.fn((prompt: string) => Promise.resolve(prompt))
    })
  }
}))

// Mock WeightedSpeakerSelector
vi.mock('../WeightedSpeakerSelector', () => ({
  getWeightedSpeakerSelector: vi.fn().mockReturnValue({
    selectSpeakers: vi.fn().mockReturnValue({ selected: [], weights: [] }),
    recordSpeaking: vi.fn(),
    nextRound: vi.fn()
  })
}))

describe('GroupChatOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module Structure', () => {
    it('should export GroupChatOrchestrator class', async () => {
      const module = await import('../GroupChatOrchestrator')
      expect(module.GroupChatOrchestrator).toBeDefined()
    })

    it('should export createGroupChatOrchestrator function', async () => {
      const module = await import('../GroupChatOrchestrator')
      expect(module.createGroupChatOrchestrator).toBeDefined()
      expect(typeof module.createGroupChatOrchestrator).toBe('function')
    })

    it('should export SpeakingMode type', async () => {
      // Type exports are compile-time only, we test by usage
      const module = await import('../GroupChatOrchestrator')
      const orchestrator = module.createGroupChatOrchestrator({
        speakingMode: 'sequential'
      })
      expect(orchestrator.getState().config.speakingMode).toBe('sequential')
    })
  })

  describe('Session Creation', () => {
    it('should create orchestrator with default config', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      const state = orchestrator.getState()
      expect(state.config.speakingMode).toBe('sequential')
      expect(state.config.maxRounds).toBe(10)
      expect(state.config.maxSpeakersPerRound).toBe(5)
      expect(state.isActive).toBe(false)
    })

    it('should create orchestrator with custom config', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator({
        name: '测试群聊',
        speakingMode: 'naturerandom',
        maxRounds: 20,
        maxSpeakersPerRound: 3
      })

      const state = orchestrator.getState()
      expect(state.config.name).toBe('测试群聊')
      expect(state.config.speakingMode).toBe('naturerandom')
      expect(state.config.maxRounds).toBe(20)
      expect(state.config.maxSpeakersPerRound).toBe(3)
    })

    it('should generate unique session ID', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const o1 = createGroupChatOrchestrator({ id: 'custom-id-1' })
      const o2 = createGroupChatOrchestrator({ id: 'custom-id-2' })

      expect(o1.getState().config.id).toBe('custom-id-1')
      expect(o2.getState().config.id).toBe('custom-id-2')
      expect(o1.getState().config.id).not.toBe(o2.getState().config.id)
    })
  })

  describe('Agent Management', () => {
    it('should add agent to group', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: ['testing'],
        triggerKeywords: ['test'],
        systemPrompt: 'You are a test agent',
        priority: 50
      })

      const agents = orchestrator.getAgents()
      expect(agents.length).toBe(1)
      expect(agents[0].id).toBe('agent-1')
      expect(agents[0].displayName).toBe('Test Agent')
    })

    it('should not add duplicate agent', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant' as const,
        expertise: ['testing'],
        triggerKeywords: ['test'],
        systemPrompt: 'You are a test agent',
        priority: 50
      }

      orchestrator.addAgent(agent)
      orchestrator.addAgent(agent) // Add again

      const agents = orchestrator.getAgents()
      expect(agents.length).toBe(1)
    })

    it('should remove agent from group', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      expect(orchestrator.getAgents().length).toBe(1)

      orchestrator.removeAgent('agent-1')
      expect(orchestrator.getAgents().length).toBe(0)
    })

    it('should initialize agent with default status and counters', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      const agent = orchestrator.getAgents()[0]
      expect(agent.status).toBe('idle')
      expect(agent.speakCount).toBe(0)
      expect(agent.visibleMessageIds).toEqual([])
    })
  })

  describe('Session Lifecycle', () => {
    it('should start session', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      expect(orchestrator.getState().isActive).toBe(false)

      await orchestrator.start('测试话题')

      expect(orchestrator.getState().isActive).toBe(true)
      expect(orchestrator.getState().topic).toBe('测试话题')
    })

    it('should not start already active session', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      await orchestrator.start()
      await orchestrator.start() // Should not throw

      expect(orchestrator.getState().isActive).toBe(true)
    })

    it('should end session and generate summary', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      await orchestrator.start()
      await orchestrator.end()

      const state = orchestrator.getState()
      expect(state.isActive).toBe(false)
      expect(state.summary).toBeDefined()
    })
  })

  describe('Mention Extraction', () => {
    it('should extract @username mentions', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'Alice',
        displayName: 'Alice',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('@Alice 你好')

      // Should find Alice via mention
      expect(decisions.some((d) => d.agentId === 'agent-1')).toBe(true)
    })

    it('should extract Chinese name mentions', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: '小明',
        displayName: '小明',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('@小明 请回答')

      expect(decisions.some((d) => d.agentId === 'agent-1')).toBe(true)
    })

    it('should extract invitation style mentions', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: '专家',
        displayName: '专家',
        role: 'expert',
        expertise: ['AI'],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('请专家回答这个问题')

      expect(decisions.some((d) => d.agentId === 'agent-1')).toBe(true)
    })
  })

  describe('Speaking Modes', () => {
    it('should use sequential mode', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator({
        speakingMode: 'sequential'
      })

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'Agent1',
        displayName: 'Agent 1',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      orchestrator.addAgent({
        id: 'agent-2',
        name: 'Agent2',
        displayName: 'Agent 2',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 40
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('Hello')

      // Sequential mode should select based on queue
      expect(decisions.length).toBeGreaterThan(0)
    })

    it('should use keyword mode', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator({
        speakingMode: 'keyword'
      })

      orchestrator.addAgent({
        id: 'python-expert',
        name: 'PythonExpert',
        displayName: 'Python Expert',
        role: 'expert',
        expertise: ['Python', 'Django'],
        triggerKeywords: ['python', 'django', 'pip'],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('How do I install python packages?')

      expect(decisions.some((d) => d.agentId === 'python-expert')).toBe(true)
    })

    it('should use consensus mode', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator({
        speakingMode: 'consensus'
      })

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'Agent1',
        displayName: 'Agent 1',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      orchestrator.addAgent({
        id: 'agent-2',
        name: 'Agent2',
        displayName: 'Agent 2',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      const decisions = await orchestrator.handleUserInput('What do you all think?')

      // Consensus mode should include all non-observer agents
      expect(decisions.length).toBe(2)
    })
  })

  describe('Event Subscription', () => {
    it('should emit events on actions', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      const events: any[] = []
      orchestrator.subscribe((event) => {
        events.push(event)
      })

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()

      expect(events.some((e) => e.type === 'agent:join')).toBe(true)
      expect(events.some((e) => e.type === 'chat:start')).toBe(true)
    })

    it('should allow unsubscribing', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      const events: any[] = []
      const unsubscribe = orchestrator.subscribe((event) => {
        events.push(event)
      })

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      unsubscribe()

      await orchestrator.start()

      // Should only have agent:join, not chat:start
      expect(events.filter((e) => e.type === 'chat:start').length).toBe(0)
    })
  })

  describe('Session Info', () => {
    it('should return session info for placeholder injection', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator({
        name: '测试群聊'
      })

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start('AI讨论')

      const info = orchestrator.getSessionInfo()

      expect(info.name).toBe('测试群聊')
      expect(info.topic).toBe('AI讨论')
      expect(info.isActive).toBe(true)
      expect(info.agents.length).toBe(1)
      expect(info.agents[0].displayName).toBe('Test Agent')
    })
  })

  describe('Interrupt and Redo', () => {
    it('should interrupt all agents', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      await orchestrator.interrupt()

      const agents = orchestrator.getAgents()
      expect(agents[0].status).toBe('idle')
    })

    it('should interrupt specific agent', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      orchestrator.addAgent({
        id: 'agent-1',
        name: 'TestAgent',
        displayName: 'Test Agent',
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        systemPrompt: '',
        priority: 50
      })

      await orchestrator.start()
      await orchestrator.interrupt('agent-1')

      const agents = orchestrator.getAgents()
      expect(agents[0].status).toBe('idle')
    })
  })

  describe('Message History', () => {
    it('should return message history', async () => {
      const { createGroupChatOrchestrator } = await import('../GroupChatOrchestrator')
      const orchestrator = createGroupChatOrchestrator()

      await orchestrator.start()
      await orchestrator.handleUserInput('Hello everyone')

      const messages = orchestrator.getMessages()
      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0].content).toBe('Hello everyone')
    })
  })
})
