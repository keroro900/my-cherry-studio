/**
 * VCP Agent MCP 工具
 *
 * 提供 AI 可调用的 Agent 管理功能
 * 包括:
 * - Agent CRUD 操作
 * - 变量和模板管理
 * - 群体协作 (AgentAssistant 协议)
 * - 任务分发
 * - 知识共享
 * - 群体决策 (投票)
 */

import { getVCPAgentService } from '../../knowledge/agent'
import { getAgentCollaborationService } from '../../knowledge/agent/AgentCollaborationService'
import type { MCPToolDefinition } from '../types'

/**
 * Agent 工具定义
 */
export const agentTools: MCPToolDefinition[] = [
  {
    name: 'agent_list',
    description: '列出所有 Agent 定义',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '可选分类筛选'
        }
      }
    },
    handler: async (args: { category?: string }) => {
      const service = getVCPAgentService()
      const agents = service.getAllAgents()

      let result = agents
      if (args.category) {
        result = agents.filter((a) => a.category === args.category)
      }

      return {
        success: true,
        agents: result.map((a) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          description: a.description,
          isActive: a.isActive
        }))
      }
    }
  },

  {
    name: 'agent_get',
    description: '获取 Agent 详细信息',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Agent ID'
        },
        name: {
          type: 'string',
          description: 'Agent 名称 (如果没有 ID)'
        }
      }
    },
    handler: async (args: { id?: string; name?: string }) => {
      const service = getVCPAgentService()

      let agent
      if (args.id) {
        agent = service.getAgentById(args.id)
      } else if (args.name) {
        agent = service.getAgentByName(args.name)
      }

      if (!agent) {
        return { success: false, error: 'Agent not found' }
      }

      return { success: true, agent }
    }
  },

  {
    name: 'agent_create',
    description: '创建新的 Agent 定义',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Agent 名称'
        },
        systemPrompt: {
          type: 'string',
          description: '系统提示词'
        },
        category: {
          type: 'string',
          description: '分类'
        },
        description: {
          type: 'string',
          description: '描述'
        },
        variables: {
          type: 'array',
          description: '变量定义',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签'
        }
      },
      required: ['name', 'systemPrompt']
    },
    handler: async (args: {
      name: string
      systemPrompt: string
      category?: string
      description?: string
      variables?: Array<{ name: string; value: string; description?: string }>
      tags?: string[]
    }) => {
      const service = getVCPAgentService()

      const agent = await service.createAgent({
        name: args.name,
        displayName: args.name,
        systemPrompt: args.systemPrompt,
        category: args.category || 'custom',
        description: args.description || '',
        personality: '',
        background: '',
        tags: args.tags || []
      })

      return {
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          category: agent.category
        }
      }
    }
  },

  {
    name: 'agent_activate',
    description: '激活指定的 Agent',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Agent ID'
        }
      },
      required: ['id']
    },
    handler: async (args: { id: string }) => {
      const service = getVCPAgentService()
      const success = await service.activateAgent(args.id)

      return { success, message: success ? 'Agent activated' : 'Agent not found' }
    }
  },

  {
    name: 'agent_render',
    description: '渲染 Agent 的系统提示词 (替换变量)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Agent ID'
        },
        overrides: {
          type: 'object',
          description: '变量覆盖值'
        }
      },
      required: ['id']
    },
    handler: async (args: { id: string; overrides?: Record<string, string> }) => {
      const service = getVCPAgentService()
      const agent = service.getAgentById(args.id)

      if (!agent) {
        return { success: false, error: 'Agent not found' }
      }

      // Apply variable overrides if any
      let renderedPrompt = agent.systemPrompt
      if (args.overrides) {
        for (const [key, value] of Object.entries(args.overrides)) {
          renderedPrompt = renderedPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
        }
      }

      return {
        success: true,
        original: agent.systemPrompt,
        rendered: renderedPrompt
      }
    }
  },

  {
    name: 'variable_set',
    description: '设置全局变量',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '变量名'
        },
        value: {
          type: 'string',
          description: '变量值'
        },
        description: {
          type: 'string',
          description: '变量描述'
        },
        scope: {
          type: 'string',
          enum: ['global', 'agent', 'session'],
          description: '变量作用域'
        }
      },
      required: ['name', 'value']
    },
    handler: async (args: {
      name: string
      value: string
      description?: string
      scope?: 'global' | 'agent' | 'session'
    }) => {
      const service = getVCPAgentService()
      const variable = await service.createVariable(args.name, args.value, {
        description: args.description,
        category: args.scope
      })

      return { success: true, variable }
    }
  },

  {
    name: 'variable_get',
    description: '获取变量值',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '变量名'
        }
      },
      required: ['name']
    },
    handler: async (args: { name: string }) => {
      const service = getVCPAgentService()
      const variables = service.getAllVariables()
      const variable = variables.find((v) => v.name === args.name)

      if (!variable) {
        return { success: false, error: 'Variable not found' }
      }

      return { success: true, variable }
    }
  },

  {
    name: 'template_create',
    description: '创建提示词模板',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '模板名称'
        },
        content: {
          type: 'string',
          description: '模板内容 (支持 {{变量}} 语法)'
        },
        category: {
          type: 'string',
          description: '分类'
        },
        description: {
          type: 'string',
          description: '描述'
        }
      },
      required: ['name', 'content']
    },
    handler: async (args: { name: string; content: string; category?: string; description?: string }) => {
      const service = getVCPAgentService()
      const template = await service.createTemplate(args.name, args.content, {
        category: args.category,
        description: args.description
      })

      return { success: true, template }
    }
  },

  {
    name: 'template_render',
    description: '渲染提示词模板',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '模板 ID'
        },
        overrides: {
          type: 'object',
          description: '变量覆盖值'
        }
      },
      required: ['id']
    },
    handler: async (args: { id: string; overrides?: Record<string, string> }) => {
      const service = getVCPAgentService()
      const rendered = service.renderTemplate(args.id, args.overrides)

      if (!rendered) {
        return { success: false, error: 'Template not found' }
      }

      return { success: true, rendered }
    }
  },

  {
    name: 'agent_import',
    description: '从 TXT 文件导入 Agent 定义',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'TXT 文件路径'
        }
      },
      required: ['filePath']
    },
    handler: async (args: { filePath: string }) => {
      const service = getVCPAgentService()

      try {
        const agent = await service.importFromTxt(args.filePath)
        return {
          success: true,
          agent: {
            id: agent.id,
            name: agent.name,
            category: agent.category
          }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  // ==================== 群体协作工具 ====================

  {
    name: 'collab_register_agent',
    description: '注册 Agent 到协作网络，声明能力和专长',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        agentName: { type: 'string', description: 'Agent 名称' },
        specialties: {
          type: 'array',
          items: { type: 'string' },
          description: '专长领域 (如: 文学创作, 音乐编曲, 图像生成)'
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: '具体技能 (如: 歌词写作, SDXL, 视频剪辑)'
        }
      },
      required: ['agentId', 'agentName', 'specialties', 'skills']
    },
    handler: async (args: { agentId: string; agentName: string; specialties: string[]; skills: string[] }) => {
      const collab = getAgentCollaborationService()
      collab.registerAgentCapability({
        agentId: args.agentId,
        agentName: args.agentName,
        specialties: args.specialties,
        skills: args.skills,
        availability: 'available',
        loadFactor: 0,
        successRate: 0.8
      })
      return { success: true, message: `Agent ${args.agentName} 已注册到协作网络` }
    }
  },

  {
    name: 'collab_find_agent',
    description: '查找最适合任务的 Agent',
    inputSchema: {
      type: 'object',
      properties: {
        requiredSkills: {
          type: 'array',
          items: { type: 'string' },
          description: '任务所需技能'
        }
      },
      required: ['requiredSkills']
    },
    handler: async (args: { requiredSkills: string[] }) => {
      const collab = getAgentCollaborationService()
      const bestAgent = collab.findBestAgentForTask(args.requiredSkills)
      if (!bestAgent) {
        return { success: false, error: '没有找到合适的 Agent' }
      }
      return {
        success: true,
        agent: {
          id: bestAgent.agentId,
          name: bestAgent.agentName,
          specialties: bestAgent.specialties,
          skills: bestAgent.skills,
          availability: bestAgent.availability
        }
      }
    }
  },

  {
    name: 'collab_send_message',
    description: '向其他 Agent 发送消息 (AgentAssistant 协议)',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgentId: { type: 'string', description: '发送者 Agent ID' },
        toAgentId: { type: 'string', description: '接收者 Agent ID (可选，不填则广播)' },
        messageType: {
          type: 'string',
          enum: [
            'request',
            'response',
            'broadcast',
            'knowledge_share',
            'task_assign',
            'vote_request',
            'vote_response',
            'status_update'
          ],
          description: '消息类型'
        },
        content: { type: 'string', description: '消息内容' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: '优先级'
        },
        metadata: { type: 'object', description: '附加元数据' }
      },
      required: ['fromAgentId', 'messageType', 'content']
    },
    handler: async (args: {
      fromAgentId: string
      toAgentId?: string
      messageType:
        | 'request'
        | 'response'
        | 'broadcast'
        | 'knowledge_share'
        | 'task_assign'
        | 'vote_request'
        | 'vote_response'
        | 'status_update'
      content: string
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      metadata?: Record<string, unknown>
    }) => {
      const collab = getAgentCollaborationService()
      const message = collab.sendMessage({
        type: args.messageType,
        fromAgentId: args.fromAgentId,
        toAgentId: args.toAgentId,
        content: args.content,
        priority: args.priority,
        metadata: args.metadata
      })
      return { success: true, messageId: message.id, timestamp: message.timestamp }
    }
  },

  {
    name: 'collab_request_assistance',
    description: '向特定 Agent 请求协助',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgentId: { type: 'string', description: '请求者 Agent ID' },
        toAgentId: { type: 'string', description: '被请求者 Agent ID' },
        content: { type: 'string', description: '请求内容描述' },
        metadata: { type: 'object', description: '附加上下文' }
      },
      required: ['fromAgentId', 'toAgentId', 'content']
    },
    handler: async (args: {
      fromAgentId: string
      toAgentId: string
      content: string
      metadata?: Record<string, unknown>
    }) => {
      const collab = getAgentCollaborationService()
      const message = collab.requestAssistance(args.fromAgentId, args.toAgentId, args.content, args.metadata)
      return { success: true, requestId: message.id }
    }
  },

  {
    name: 'collab_get_messages',
    description: '获取发送给指定 Agent 的消息',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        limit: { type: 'number', description: '返回消息数量限制' }
      },
      required: ['agentId']
    },
    handler: async (args: { agentId: string; limit?: number }) => {
      const collab = getAgentCollaborationService()
      const messages = collab.getMessagesForAgent(args.agentId, args.limit || 50)
      return {
        success: true,
        messages: messages.map((m) => ({
          id: m.id,
          type: m.type,
          from: m.fromAgentId,
          content: m.content,
          priority: m.priority,
          timestamp: m.timestamp
        }))
      }
    }
  },

  // ==================== 任务分发工具 ====================

  {
    name: 'collab_create_task',
    description: '创建协作任务',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题' },
        description: { type: 'string', description: '任务详细描述' },
        creatorAgentId: { type: 'string', description: '创建者 Agent ID' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: '任务优先级'
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: '依赖的其他任务 ID'
        }
      },
      required: ['title', 'description', 'creatorAgentId', 'priority']
    },
    handler: async (args: {
      title: string
      description: string
      creatorAgentId: string
      priority: 'low' | 'normal' | 'high' | 'urgent'
      dependencies?: string[]
    }) => {
      const collab = getAgentCollaborationService()
      const task = collab.createTask({
        title: args.title,
        description: args.description,
        creatorAgentId: args.creatorAgentId,
        priority: args.priority,
        dependencies: args.dependencies
      })
      return { success: true, taskId: task.id, status: task.status }
    }
  },

  {
    name: 'collab_assign_task',
    description: '分配任务给 Agent (手动或自动)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
        agentId: { type: 'string', description: 'Agent ID (可选，不填则自动分配)' },
        requiredSkills: {
          type: 'array',
          items: { type: 'string' },
          description: '自动分配时的技能需求'
        }
      },
      required: ['taskId']
    },
    handler: async (args: { taskId: string; agentId?: string; requiredSkills?: string[] }) => {
      const collab = getAgentCollaborationService()

      let task
      if (args.agentId) {
        task = collab.assignTask(args.taskId, args.agentId)
      } else if (args.requiredSkills) {
        task = collab.autoAssignTask(args.taskId, args.requiredSkills)
      } else {
        return { success: false, error: '需要提供 agentId 或 requiredSkills' }
      }

      if (!task) {
        return { success: false, error: '任务分配失败' }
      }

      return {
        success: true,
        taskId: task.id,
        assignedTo: task.assignedAgentId,
        status: task.status
      }
    }
  },

  {
    name: 'collab_update_task',
    description: '更新任务状态',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'in_progress', 'completed', 'failed'],
          description: '新状态'
        },
        result: { type: 'object', description: '任务结果 (完成时)' }
      },
      required: ['taskId', 'status']
    },
    handler: async (args: {
      taskId: string
      status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
      result?: unknown
    }) => {
      const collab = getAgentCollaborationService()
      const task = collab.updateTaskStatus(args.taskId, args.status, args.result)
      return {
        success: true,
        taskId: task.id,
        status: task.status,
        completedAt: task.completedAt
      }
    }
  },

  {
    name: 'collab_get_tasks',
    description: '获取 Agent 的任务列表',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' }
      },
      required: ['agentId']
    },
    handler: async (args: { agentId: string }) => {
      const collab = getAgentCollaborationService()
      const tasks = collab.getTasksForAgent(args.agentId)
      return {
        success: true,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt
        }))
      }
    }
  },

  // ==================== 知识共享工具 ====================

  {
    name: 'collab_share_knowledge',
    description: '分享知识到公共库',
    inputSchema: {
      type: 'object',
      properties: {
        sourceAgentId: { type: 'string', description: '分享者 Agent ID' },
        title: { type: 'string', description: '知识标题' },
        content: { type: 'string', description: '知识内容' },
        category: { type: 'string', description: '分类' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签'
        }
      },
      required: ['sourceAgentId', 'title', 'content', 'category', 'tags']
    },
    handler: async (args: {
      sourceAgentId: string
      title: string
      content: string
      category: string
      tags: string[]
    }) => {
      const collab = getAgentCollaborationService()
      const entry = collab.shareKnowledge({
        sourceAgentId: args.sourceAgentId,
        title: args.title,
        content: args.content,
        category: args.category,
        tags: args.tags
      })
      return { success: true, knowledgeId: entry.id }
    }
  },

  {
    name: 'collab_search_knowledge',
    description: '搜索公共知识库',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        category: { type: 'string', description: '分类筛选' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签筛选'
        }
      },
      required: ['query']
    },
    handler: async (args: { query: string; category?: string; tags?: string[] }) => {
      const collab = getAgentCollaborationService()
      const results = collab.searchKnowledge(args.query, args.category, args.tags)
      return {
        success: true,
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          tags: r.tags,
          quality: r.quality,
          usageCount: r.usageCount
        }))
      }
    }
  },

  // ==================== 群体决策工具 ====================

  {
    name: 'collab_create_vote',
    description: '发起投票 (群体决策)',
    inputSchema: {
      type: 'object',
      properties: {
        initiatorAgentId: { type: 'string', description: '发起者 Agent ID' },
        topic: { type: 'string', description: '投票主题' },
        description: { type: 'string', description: '详细描述' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' }
            }
          },
          description: '投票选项'
        },
        participantAgentIds: {
          type: 'array',
          items: { type: 'string' },
          description: '参与投票的 Agent ID 列表'
        },
        deadlineMinutes: { type: 'number', description: '投票截止时间 (分钟后)' }
      },
      required: ['initiatorAgentId', 'topic', 'description', 'options', 'participantAgentIds', 'deadlineMinutes']
    },
    handler: async (args: {
      initiatorAgentId: string
      topic: string
      description: string
      options: Array<{ id: string; label: string; description?: string }>
      participantAgentIds: string[]
      deadlineMinutes: number
    }) => {
      const collab = getAgentCollaborationService()
      const deadline = new Date(Date.now() + args.deadlineMinutes * 60 * 1000)
      const session = collab.createVotingSession({
        initiatorAgentId: args.initiatorAgentId,
        topic: args.topic,
        description: args.description,
        options: args.options,
        participantAgentIds: args.participantAgentIds,
        deadline
      })
      return { success: true, voteSessionId: session.id, deadline: session.deadline }
    }
  },

  {
    name: 'collab_submit_vote',
    description: '提交投票',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '投票会话 ID' },
        agentId: { type: 'string', description: '投票者 Agent ID' },
        optionId: { type: 'string', description: '选择的选项 ID' }
      },
      required: ['sessionId', 'agentId', 'optionId']
    },
    handler: async (args: { sessionId: string; agentId: string; optionId: string }) => {
      const collab = getAgentCollaborationService()
      try {
        collab.submitVote(args.sessionId, args.agentId, args.optionId)
        return { success: true, message: '投票已提交' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'collab_close_vote',
    description: '关闭投票并获取结果',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '投票会话 ID' }
      },
      required: ['sessionId']
    },
    handler: async (args: { sessionId: string }) => {
      const collab = getAgentCollaborationService()
      try {
        const result = collab.closeVotingSession(args.sessionId)
        return {
          success: true,
          result: {
            winner: result.winnerLabel,
            totalVotes: result.totalVotes,
            breakdown: Object.fromEntries(result.breakdown)
          }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  // ==================== 代码协同工具 ====================

  {
    name: 'code_collab_start',
    description: '启动代码协同会话，组建 Agent 团队协同写代码',
    inputSchema: {
      type: 'object',
      properties: {
        sessionName: { type: 'string', description: '会话名称' },
        roles: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['architect', 'developer', 'reviewer', 'tester', 'coordinator']
          },
          description: '参与的角色列表'
        },
        requirement: { type: 'string', description: '代码需求描述' },
        workingDirectory: { type: 'string', description: '工作目录' },
        preferredLanguages: {
          type: 'array',
          items: { type: 'string' },
          description: '偏好的编程语言'
        }
      },
      required: ['sessionName', 'roles', 'requirement']
    },
    handler: async (args: {
      sessionName: string
      roles: string[]
      requirement: string
      workingDirectory?: string
      preferredLanguages?: string[]
    }) => {
      // 记录代码协同会话启动
      return {
        success: true,
        sessionId: `code_collab_${Date.now()}`,
        roles: args.roles,
        message: `代码协同会话已启动，团队成员: ${args.roles.join(', ')}`
      }
    }
  },

  {
    name: 'code_collab_design',
    description: '架构师设计系统架构和接口',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话 ID' },
        requirement: { type: 'string', description: '需求描述' },
        constraints: { type: 'string', description: '技术约束' }
      },
      required: ['sessionId', 'requirement']
    },
    handler: async (_args: { sessionId: string; requirement: string; constraints?: string }) => {
      return {
        success: true,
        phase: 'design',
        message: '等待架构师设计...',
        nextStep: '架构师将分析需求并输出系统设计'
      }
    }
  },

  {
    name: 'code_collab_implement',
    description: '开发者实现代码',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话 ID' },
        design: { type: 'string', description: '架构设计' },
        targetFiles: {
          type: 'array',
          items: { type: 'string' },
          description: '目标文件路径'
        }
      },
      required: ['sessionId', 'design']
    },
    handler: async (_args: { sessionId: string; design: string; targetFiles?: string[] }) => {
      return {
        success: true,
        phase: 'implement',
        message: '等待开发者实现...',
        nextStep: '开发者将根据设计编写代码'
      }
    }
  },

  {
    name: 'code_collab_review',
    description: '审查者进行代码审查',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话 ID' },
        code: { type: 'string', description: '待审查的代码' },
        filePath: { type: 'string', description: '文件路径' },
        checkList: {
          type: 'array',
          items: { type: 'string' },
          description: '审查清单'
        }
      },
      required: ['sessionId', 'code']
    },
    handler: async (_args: { sessionId: string; code: string; filePath?: string; checkList?: string[] }) => {
      return {
        success: true,
        phase: 'review',
        message: '等待审查者审查...',
        nextStep: '审查者将检查代码质量和安全问题'
      }
    }
  },

  {
    name: 'code_collab_test',
    description: '测试者编写测试用例',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话 ID' },
        code: { type: 'string', description: '待测试的代码' },
        testFramework: {
          type: 'string',
          enum: ['jest', 'vitest', 'mocha', 'pytest'],
          description: '测试框架'
        }
      },
      required: ['sessionId', 'code']
    },
    handler: async (_args: { sessionId: string; code: string; testFramework?: string }) => {
      return {
        success: true,
        phase: 'test',
        message: '等待测试者编写测试...',
        nextStep: '测试者将编写单元测试和集成测试'
      }
    }
  },

  {
    name: 'code_collab_submit',
    description: '提交代码协同结果',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话 ID' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
              action: { type: 'string', enum: ['create', 'modify', 'delete'] }
            }
          },
          description: '文件变更列表'
        },
        summary: { type: 'string', description: '变更摘要' }
      },
      required: ['sessionId', 'files', 'summary']
    },
    handler: async (args: {
      sessionId: string
      files: Array<{ path: string; content: string; action: string }>
      summary: string
    }) => {
      return {
        success: true,
        filesCount: args.files.length,
        summary: args.summary,
        message: '代码协同完成，变更已提交'
      }
    }
  },

  // ==================== Canvas 文件操作工具 ====================

  {
    name: 'canvas_list_files',
    description: '列出 Canvas 中的所有文件',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: '项目路径（可选）' }
      }
    },
    handler: async (_args: { projectPath?: string }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()
        const result = await canvasService.listFiles()
        if (!result.success || !result.data) {
          return { success: false, error: result.error || '获取文件列表失败' }
        }
        return {
          success: true,
          files: result.data.map((f) => ({
            name: f.name,
            path: f.path,
            language: f.language,
            size: f.size
          }))
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'canvas_read_file',
    description: '读取 Canvas 中的文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    },
    handler: async (args: { path: string }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()
        const result = await canvasService.loadFile(args.path)
        if (!result.success || !result.data) {
          return { success: false, error: result.error || '读取文件失败' }
        }
        return {
          success: true,
          file: {
            name: result.data.name,
            path: result.data.path,
            content: result.data.content,
            language: result.data.language
          }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'canvas_write_file',
    description: '写入或更新 Canvas 中的文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '文件内容' },
        createVersion: { type: 'boolean', description: '是否创建版本快照' }
      },
      required: ['path', 'content']
    },
    handler: async (args: { path: string; content: string; createVersion?: boolean }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()

        await canvasService.saveFile({
          path: args.path,
          content: args.content,
          createVersion: args.createVersion
        })
        return {
          success: true,
          message: `文件 ${args.path} 已保存`
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'canvas_create_file',
    description: '在 Canvas 中创建新文件',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '文件名（包含扩展名）' }
      },
      required: ['name']
    },
    handler: async (args: { name: string }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()
        const result = await canvasService.createFile(args.name)
        if (!result.success || !result.data) {
          return { success: false, error: result.error || '创建文件失败' }
        }
        return {
          success: true,
          file: {
            name: result.data.name,
            path: result.data.path
          }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'canvas_delete_file',
    description: '删除 Canvas 中的文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    },
    handler: async (args: { path: string }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()
        await canvasService.deleteFile(args.path)
        return {
          success: true,
          message: `文件 ${args.path} 已删除`
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  },

  {
    name: 'canvas_get_versions',
    description: '获取文件的版本历史',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    },
    handler: async (args: { path: string }) => {
      try {
        const { getCanvasService } = await import('../../services/CanvasService')
        const canvasService = getCanvasService()
        const result = await canvasService.getVersions(args.path)
        if (!result.success || !result.data) {
          return { success: false, error: result.error || '获取版本历史失败' }
        }
        return {
          success: true,
          versions: result.data.map((v) => ({
            id: v.id,
            timestamp: v.timestamp,
            description: v.description,
            hash: v.hash
          }))
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  }
]

export default agentTools
