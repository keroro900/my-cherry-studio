/**
 * VCPTavern 上下文注入 MCP 工具
 *
 * 提供 AI 可调用的上下文注入功能
 */

import { getContextInjectorService } from '../../knowledge/agent'
import type { InjectionPosition, TriggerType } from '../../knowledge/agent/ContextInjectorService'
import type { MCPToolDefinition } from '../types'

/**
 * 上下文注入工具定义
 */
export const contextInjectorTools: MCPToolDefinition[] = [
  {
    name: 'injection_rule_create',
    description: '创建上下文注入规则',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '规则名称'
        },
        content: {
          type: 'string',
          description: '注入内容 (支持 {{变量}} 语法)'
        },
        position: {
          type: 'string',
          enum: [
            'system_prefix',
            'system_suffix',
            'context_prefix',
            'context_suffix',
            'user_prefix',
            'user_suffix',
            'assistant_prefix',
            'hidden'
          ],
          description: '注入位置'
        },
        priority: {
          type: 'number',
          description: '优先级 (数字越大越先执行)',
          default: 5
        },
        triggers: {
          type: 'array',
          description: '触发条件',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['always', 'keyword', 'regex', 'turn_count', 'time_based', 'random', 'context_length']
              },
              value: {
                description: '触发条件值'
              },
              negate: {
                type: 'boolean',
                description: '是否取反'
              }
            }
          }
        },
        triggerLogic: {
          type: 'string',
          enum: ['and', 'or'],
          description: '多条件逻辑',
          default: 'and'
        },
        cooldown: {
          type: 'number',
          description: '冷却时间 (秒)'
        },
        maxTriggers: {
          type: 'number',
          description: '最大触发次数'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签'
        }
      },
      required: ['name', 'content', 'position']
    },
    handler: async (args: {
      name: string
      content: string
      position: InjectionPosition
      priority?: number
      triggers?: Array<{ type: TriggerType; value: any; negate?: boolean }>
      triggerLogic?: 'and' | 'or'
      cooldown?: number
      maxTriggers?: number
      tags?: string[]
    }) => {
      const service = getContextInjectorService()

      const rule = await service.createRule({
        name: args.name,
        content: args.content,
        position: args.position,
        priority: args.priority ?? 5,
        triggers: args.triggers || [{ type: 'always', value: true }],
        triggerLogic: args.triggerLogic || 'and',
        isActive: true,
        cooldown: args.cooldown,
        maxTriggers: args.maxTriggers,
        tags: args.tags || []
      })

      return {
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          position: rule.position,
          priority: rule.priority
        }
      }
    }
  },

  {
    name: 'injection_rule_list',
    description: '列出所有注入规则',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const service = getContextInjectorService()
      const rules = service.getAllRules()

      return {
        success: true,
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          position: r.position,
          priority: r.priority,
          isActive: r.isActive,
          triggerCount: r.triggers.length
        }))
      }
    }
  },

  {
    name: 'injection_rule_toggle',
    description: '启用/禁用注入规则',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '规则 ID'
        },
        isActive: {
          type: 'boolean',
          description: '是否启用'
        }
      },
      required: ['id', 'isActive']
    },
    handler: async (args: { id: string; isActive: boolean }) => {
      const service = getContextInjectorService()
      const rule = await service.updateRule(args.id, { isActive: args.isActive })

      if (!rule) {
        return { success: false, error: 'Rule not found' }
      }

      return { success: true, rule: { id: rule.id, isActive: rule.isActive } }
    }
  },

  {
    name: 'injection_rule_delete',
    description: '删除注入规则',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '规则 ID'
        }
      },
      required: ['id']
    },
    handler: async (args: { id: string }) => {
      const service = getContextInjectorService()
      const deleted = await service.deleteRule(args.id)

      return { success: deleted, message: deleted ? 'Rule deleted' : 'Rule not found' }
    }
  },

  {
    name: 'injection_preset_create',
    description: '创建注入预设',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '预设名称'
        },
        description: {
          type: 'string',
          description: '预设描述'
        },
        ruleIds: {
          type: 'array',
          items: { type: 'string' },
          description: '包含的规则 ID 列表'
        }
      },
      required: ['name']
    },
    handler: async (args: { name: string; description?: string; ruleIds?: string[] }) => {
      const service = getContextInjectorService()

      // 获取指定的规则
      const allRules = service.getAllRules()
      const rules = args.ruleIds ? allRules.filter((r) => args.ruleIds!.includes(r.id)) : []

      const preset = await service.createPreset({
        name: args.name,
        description: args.description,
        rules,
        isActive: false
      })

      return {
        success: true,
        preset: {
          id: preset.id,
          name: preset.name,
          ruleCount: preset.rules.length
        }
      }
    }
  },

  {
    name: 'injection_preset_list',
    description: '列出所有注入预设',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const service = getContextInjectorService()
      const presets = service.getAllPresets()

      return {
        success: true,
        presets: presets.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          ruleCount: p.rules.length
        }))
      }
    }
  },

  {
    name: 'injection_preset_activate',
    description: '激活注入预设',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '预设 ID'
        }
      },
      required: ['id']
    },
    handler: async (args: { id: string }) => {
      const service = getContextInjectorService()
      const success = await service.activatePreset(args.id)

      return { success, message: success ? 'Preset activated' : 'Preset not found' }
    }
  },

  {
    name: 'injection_execute',
    description: '执行注入 (测试)',
    inputSchema: {
      type: 'object',
      properties: {
        turnCount: {
          type: 'number',
          description: '当前对话轮次',
          default: 1
        },
        lastUserMessage: {
          type: 'string',
          description: '最后一条用户消息',
          default: ''
        },
        lastAssistantMessage: {
          type: 'string',
          description: '最后一条助手消息',
          default: ''
        },
        contextLength: {
          type: 'number',
          description: '上下文长度',
          default: 0
        },
        customData: {
          type: 'object',
          description: '自定义数据'
        }
      }
    },
    handler: async (args: {
      turnCount?: number
      lastUserMessage?: string
      lastAssistantMessage?: string
      contextLength?: number
      customData?: Record<string, any>
    }) => {
      const service = getContextInjectorService()

      const results = service.executeInjection({
        turnCount: args.turnCount ?? 1,
        lastUserMessage: args.lastUserMessage ?? '',
        lastAssistantMessage: args.lastAssistantMessage ?? '',
        contextLength: args.contextLength ?? 0,
        currentTime: new Date(),
        customData: args.customData
      })

      return {
        success: true,
        injections: results.map((r) => ({
          position: r.position,
          content: r.content,
          ruleId: r.ruleId,
          ruleName: r.ruleName
        }))
      }
    }
  },

  {
    name: 'injection_create_director_preset',
    description: '创建 VCPTavern 导演模式预设',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const service = getContextInjectorService()
      const preset = await service.createDirectorPreset()

      return {
        success: true,
        preset: {
          id: preset.id,
          name: preset.name,
          description: preset.description,
          ruleCount: preset.rules.length
        }
      }
    }
  },

  {
    name: 'injection_create_roleplay_preset',
    description: '创建角色扮演增强预设',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const service = getContextInjectorService()
      const preset = await service.createRoleplayEnhancementPreset()

      return {
        success: true,
        preset: {
          id: preset.id,
          name: preset.name,
          description: preset.description,
          ruleCount: preset.rules.length
        }
      }
    }
  },

  {
    name: 'injection_reset_history',
    description: '重置触发历史',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: {
          type: 'string',
          description: '规则 ID (不填则重置所有)'
        }
      }
    },
    handler: async (args: { ruleId?: string }) => {
      const service = getContextInjectorService()
      service.resetTriggerHistory(args.ruleId)

      return {
        success: true,
        message: args.ruleId ? `Reset history for rule ${args.ruleId}` : 'Reset all trigger history'
      }
    }
  },

  {
    name: 'injection_stats',
    description: '获取注入统计信息',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const service = getContextInjectorService()
      const stats = service.getStats()

      return {
        success: true,
        stats
      }
    }
  }
]

export default contextInjectorTools
