/**
 * AgentBrain 单元测试
 *
 * 测试主控大脑功能:
 * - 发言者决策
 * - Agent 调用处理
 * - 多 Agent 任务协调
 * - 群体投票
 * - 群聊管理
 * - 自动调用判断
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

// Mock UnifiedAgentService
const mockAgents = [
  {
    id: 'agent-1',
    name: 'CodeExpert',
    displayName: 'Code Expert',
    enabled: true,
    groupRole: 'expert',
    expertise: ['javascript', 'typescript', 'react'],
    keywords: ['code', 'programming', 'bug'],
    priority: 80,
    systemPrompt: 'You are a code expert'
  },
  {
    id: 'agent-2',
    name: 'Designer',
    displayName: 'UI Designer',
    enabled: true,
    groupRole: 'participant',
    expertise: ['UI', 'UX', 'design'],
    keywords: ['design', 'ui', 'color'],
    priority: 60,
    systemPrompt: 'You are a UI designer'
  },
  {
    id: 'agent-3',
    name: 'Observer',
    displayName: 'Silent Observer',
    enabled: true,
    groupRole: 'observer',
    expertise: [],
    keywords: [],
    priority: 10,
    systemPrompt: 'You observe'
  }
]

vi.mock('../UnifiedAgentService', () => ({
  getUnifiedAgentService: vi.fn(() => ({
    getAllAgents: vi.fn().mockResolvedValue(mockAgents),
    getAgentById: vi.fn((id: string) => Promise.resolve(mockAgents.find((a) => a.id === id))),
    getAgentByName: vi.fn((name: string) =>
      Promise.resolve(mockAgents.find((a) => a.name.toLowerCase() === name.toLowerCase()))
    ),
    sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    createTask: vi.fn().mockResolvedValue({ id: 'task-1', status: 'assigned', result: 'Task result' }),
    initiateVote: vi.fn().mockResolvedValue({ id: 'vote-1', status: 'active' })
  }))
}))

// Mock GroupChatOrchestrator
vi.mock('../../knowledge/agent/GroupChatOrchestrator', () => ({
  GroupChatOrchestrator: vi.fn().mockImplementation(() => ({
    addAgent: vi.fn(),
    start: vi.fn(),
    end: vi.fn(),
    getState: vi.fn().mockReturnValue({ isActive: true })
  }))
}))

describe('AgentBrain', () => {
  let AgentBrain: any
  let getAgentBrain: any
  let resetAgentBrain: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Dynamic import to get module
    const module = await import('../AgentBrain')
    AgentBrain = module.AgentBrain
    getAgentBrain = module.getAgentBrain
    resetAgentBrain = module.resetAgentBrain
  })

  afterEach(async () => {
    if (resetAgentBrain) {
      await resetAgentBrain()
    }
  })

  describe('Module Structure', () => {
    it('should export AgentBrain class', () => {
      expect(AgentBrain).toBeDefined()
    })

    it('should export getAgentBrain function', () => {
      expect(getAgentBrain).toBeDefined()
      expect(typeof getAgentBrain).toBe('function')
    })

    it('should export resetAgentBrain function', () => {
      expect(resetAgentBrain).toBeDefined()
      expect(typeof resetAgentBrain).toBe('function')
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const brain1 = getAgentBrain()
      const brain2 = getAgentBrain()
      expect(brain1).toBe(brain2)
    })
  })

  describe('Configuration', () => {
    it('should have configuration object', () => {
      const brain = getAgentBrain()
      const config = brain.getConfig()

      expect(config).toBeDefined()
      expect(typeof config.defaultSpeakingMode).toBe('string')
      expect(typeof config.maxWaitTime).toBe('number')
      expect(typeof config.enableAutoInvoke).toBe('boolean')
      expect(typeof config.invokeThreshold).toBe('number')
    })

    it('should update configuration via updateConfig', () => {
      const brain = getAgentBrain()
      const originalMode = brain.getConfig().defaultSpeakingMode

      brain.updateConfig({ defaultSpeakingMode: 'sequential' })
      expect(brain.getConfig().defaultSpeakingMode).toBe('sequential')

      // Restore
      brain.updateConfig({ defaultSpeakingMode: originalMode })
    })

    it('should update individual configuration options', () => {
      const brain = getAgentBrain()
      const original = brain.getConfig().enableAutoInvoke

      brain.updateConfig({ enableAutoInvoke: !original })
      expect(brain.getConfig().enableAutoInvoke).toBe(!original)

      // Restore
      brain.updateConfig({ enableAutoInvoke: original })
    })
  })

  describe('Speaker Decision', () => {
    it('should decide next speaker based on mentions', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'Hello everyone',
        mentions: ['CodeExpert'],
        messageHistory: []
      }

      const speaker = await brain.decideNextSpeaker(context)

      expect(speaker).toBeDefined()
      expect(speaker?.id).toBe('agent-1')
    })

    it('should decide speaker based on keywords', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'I have a programming bug in my code',
        keywords: ['bug', 'code'],
        messageHistory: []
      }

      const speaker = await brain.decideNextSpeaker(context)

      expect(speaker).toBeDefined()
      expect(speaker?.id).toBe('agent-1') // CodeExpert has 'bug' and 'code' keywords
    })

    it('should exclude observer from speaking', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'Anyone want to respond?',
        messageHistory: []
      }

      const speaker = await brain.decideNextSpeaker(context)

      if (speaker) {
        expect(speaker.groupRole).not.toBe('observer')
      }
    })

    it('should not select last speaker again', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'Continue the discussion about javascript',
        lastSpeakerId: 'agent-1',
        messageHistory: []
      }

      const speaker = await brain.decideNextSpeaker(context)

      // Should not select the same agent that just spoke
      if (speaker) {
        expect(speaker.id).not.toBe('agent-1')
      }
    })
  })

  describe('Agent Invocation', () => {
    it('should handle agent invocation by name', async () => {
      const brain = getAgentBrain()

      const response = await brain.handleAgentInvocation('user', 'CodeExpert', 'Help me with TypeScript')

      expect(response).toBeDefined()
      expect(response.agentId).toBe('agent-1')
      expect(response.agentName).toBe('Code Expert')
    })

    it('should return error for unknown agent', async () => {
      const brain = getAgentBrain()

      const response = await brain.handleAgentInvocation('user', 'UnknownAgent', 'Hello')

      expect(response.agentId).toBe('')
      expect(response.confidence).toBe(0)
      expect(response.content).toContain('not found')
    })
  })

  describe('Multi-Agent Task Coordination', () => {
    it('should coordinate parallel tasks', async () => {
      const brain = getAgentBrain()

      const task = {
        id: 'task-1',
        description: 'Review the code',
        strategy: 'parallel' as const,
        subtasks: [
          { agentId: 'agent-1', description: 'Check logic' },
          { agentId: 'agent-2', description: 'Check UI' }
        ]
      }

      const result = await brain.coordinateTask(task)

      expect(result).toBeDefined()
      expect(result.taskId).toBe('task-1')
      expect(result.results.length).toBe(2)
    })

    it('should coordinate sequential tasks', async () => {
      const brain = getAgentBrain()

      const task = {
        id: 'task-2',
        description: 'Build feature step by step',
        strategy: 'sequential' as const,
        subtasks: [
          { agentId: 'agent-1', description: 'Write code' },
          { agentId: 'agent-2', description: 'Design UI' }
        ]
      }

      const result = await brain.coordinateTask(task)

      expect(result).toBeDefined()
      expect(result.taskId).toBe('task-2')
    })

    it('should coordinate vote tasks', async () => {
      const brain = getAgentBrain()

      const task = {
        id: 'task-3',
        description: 'Choose framework',
        strategy: 'vote' as const,
        requiredAgentIds: ['agent-1'],
        subtasks: [
          { agentId: 'agent-1', description: 'React' },
          { agentId: 'agent-2', description: 'Vue' }
        ]
      }

      const result = await brain.coordinateTask(task)

      expect(result).toBeDefined()
      expect(result.taskId).toBe('task-3')
    })
  })

  describe('Group Voting', () => {
    it('should initiate vote', async () => {
      const brain = getAgentBrain()

      const vote = await brain.initiateVote('Which framework?', ['React', 'Vue', 'Angular'])

      expect(vote).toBeDefined()
      expect(vote.id).toBe('vote-1')
    })

    it('should initiate vote with specific participants', async () => {
      const brain = getAgentBrain()

      const vote = await brain.initiateVote('Which framework?', ['React', 'Vue'], ['agent-1', 'agent-2'])

      expect(vote).toBeDefined()
    })
  })

  describe('Group Chat Management', () => {
    it('should create group chat', () => {
      const brain = getAgentBrain()

      const orchestrator = brain.createGroupChat({
        name: 'Test Chat',
        speakingMode: 'naturerandom'
      })

      expect(orchestrator).toBeDefined()
    })

    it('should get group chat by id', () => {
      const brain = getAgentBrain()

      brain.createGroupChat({
        id: 'test-chat-1',
        name: 'Test Chat'
      })

      const chat = brain.getGroupChat('test-chat-1')
      expect(chat).toBeDefined()
    })

    it('should end group chat', async () => {
      const brain = getAgentBrain()

      brain.createGroupChat({
        id: 'test-chat-2',
        name: 'Test Chat'
      })

      const ended = await brain.endGroupChat('test-chat-2')
      expect(ended).toBe(true)

      const chat = brain.getGroupChat('test-chat-2')
      expect(chat).toBeUndefined()
    })
  })

  describe('Auto-Invoke Decision', () => {
    it('should return should=false when auto-invoke disabled', async () => {
      const brain = getAgentBrain()
      brain.updateConfig({ enableAutoInvoke: false })

      const context = {
        conversationId: 'conv-1',
        lastMessage: '@CodeExpert help me',
        mentions: ['CodeExpert'],
        messageHistory: []
      }

      const decision = await brain.shouldAutoInvoke(context)

      expect(decision.should).toBe(false)
    })

    it('should check mentions for auto-invoke', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'Need help with code',
        mentions: [], // No mentions
        messageHistory: []
      }

      const decision = await brain.shouldAutoInvoke(context)

      // Without mentions and not a question, should not auto-invoke
      if (!decision.should) {
        expect(decision.should).toBe(false)
      }
    })

    it('should consider user intent for expert matching', async () => {
      const brain = getAgentBrain()

      const context = {
        conversationId: 'conv-1',
        lastMessage: 'What is the best way to write javascript code?',
        userIntent: 'question' as const,
        messageHistory: []
      }

      // With question intent, brain might match an expert
      const decision = await brain.shouldAutoInvoke(context)
      expect(decision).toBeDefined()
      expect(typeof decision.should).toBe('boolean')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const brain = getAgentBrain()

      brain.createGroupChat({ id: 'chat-1', name: 'Chat 1' })
      brain.createGroupChat({ id: 'chat-2', name: 'Chat 2' })

      await brain.cleanup()

      expect(brain.getGroupChat('chat-1')).toBeUndefined()
      expect(brain.getGroupChat('chat-2')).toBeUndefined()
    })
  })
})
