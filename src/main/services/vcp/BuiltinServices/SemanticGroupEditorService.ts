/**
 * SemanticGroupEditor 内置服务
 *
 * 提供语义组的管理功能：查询、添加、编辑、删除语义词元组
 * 集成已有的 SemanticGroupService
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getSemanticGroupService } from '../../memory/SemanticGroupService'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:SemanticGroupEditorService')

export class SemanticGroupEditorService implements IBuiltinService {
  name = 'SemanticGroupEditor'
  displayName = '语义组编辑器 (内置)'
  description = '管理语义词元组：查询、添加、编辑、删除。用于扩展搜索查询的同义词和相关词。'
  version = '2.0.0'
  type = 'builtin_service' as const

  configSchema = {}

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'QueryGroups',
      description: `查询所有语义词元组。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」QueryGroups「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'AddGroup',
      description: `添加新的语义词元组。
参数:
- groupName (字符串, 必需): 组名
- words (字符串, 必需): 词语列表，逗号分隔
- description (字符串, 可选): 组描述

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」AddGroup「末」
groupName:「始」emotion_excited「末」
words:「始」兴奋,激动,热情,excited,thrilled「末」
description:「始」兴奋情感词汇「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'groupName', description: '组名', required: true, type: 'string' },
        { name: 'words', description: '词语列表，逗号分隔', required: true, type: 'string' },
        { name: 'description', description: '组描述', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'EditGroup',
      description: `编辑已有的语义词元组。
参数:
- groupName (字符串, 必需): 要编辑的组名
- words (字符串, 可选): 新的词语列表，逗号分隔
- description (字符串, 可选): 新的组描述

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」EditGroup「末」
groupName:「始」emotion_excited「末」
words:「始」兴奋,激动,热情,excited,thrilled,hyped「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'groupName', description: '要编辑的组名', required: true, type: 'string' },
        { name: 'words', description: '新的词语列表，逗号分隔', required: false, type: 'string' },
        { name: 'description', description: '新的组描述', required: false, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'DeleteGroup',
      description: `删除语义词元组。
参数:
- groupName (字符串, 必需): 要删除的组名

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」DeleteGroup「末」
groupName:「始」emotion_excited「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'groupName', description: '要删除的组名', required: true, type: 'string' }]
    },
    {
      commandIdentifier: 'AddWordsToGroup',
      description: `向已有组添加词语。
参数:
- groupName (字符串, 必需): 组名
- words (字符串, 必需): 要添加的词语，逗号分隔

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」AddWordsToGroup「末」
groupName:「始」emotion_positive「末」
words:「始」欣喜,愉悦「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'groupName', description: '组名', required: true, type: 'string' },
        { name: 'words', description: '要添加的词语，逗号分隔', required: true, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'GetConfig',
      description: `获取语义组配置。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」GetConfig「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'UpdateConfig',
      description: `更新语义组配置。
参数:
- enabled (布尔值, 可选): 是否启用语义组扩展
- maxExpandedWords (数字, 可选): 最大扩展词数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」SemanticGroupEditor「末」
command:「始」UpdateConfig「末」
enabled:「始」true「末」
maxExpandedWords:「始」15「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'enabled', description: '是否启用语义组扩展', required: false, type: 'boolean' },
        { name: 'maxExpandedWords', description: '最大扩展词数量', required: false, type: 'number' }
      ]
    }
  ]

  async initialize(): Promise<void> {
    logger.info('SemanticGroupEditorService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'QueryGroups':
          return this.queryGroups()
        case 'AddGroup':
        // VCPToolBox 兼容别名 - UpdateGroups 等同于 AddGroup (新建或覆盖)
        case 'UpdateGroups':
          return this.addGroup(params)
        case 'EditGroup':
          return this.editGroup(params)
        case 'DeleteGroup':
          return this.deleteGroup(params)
        case 'AddWordsToGroup':
          return this.addWordsToGroup(params)
        case 'GetConfig':
          return this.getConfig()
        case 'UpdateConfig':
          return this.updateConfig(params)
        default:
          return {
            success: false,
            error: `Unknown command: ${command}. Available: QueryGroups, AddGroup, EditGroup, DeleteGroup, AddWordsToGroup, GetConfig, UpdateConfig (alias: UpdateGroups)`
          }
      }
    } catch (error) {
      logger.error('SemanticGroupEditor command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ==================== 命令实现 ====================

  private queryGroups(): BuiltinServiceResult {
    const service = getSemanticGroupService()
    const groups = service.getAllGroups()

    if (Object.keys(groups).length === 0) {
      return {
        success: true,
        output: '当前系统中没有任何语义词元组。'
      }
    }

    let output = '当前系统中的语义词元组如下：\n\n'
    for (const [groupId, group] of Object.entries(groups)) {
      output += `组名: ${groupId}\n`
      output += `  显示名: ${group.name}\n`
      output += `  描述: ${group.description || '无'}\n`
      output += `  词语: ${group.words.join(', ')}\n\n`
    }

    return {
      success: true,
      output,
      data: { groups, totalGroups: Object.keys(groups).length }
    }
  }

  private addGroup(params: Record<string, unknown>): BuiltinServiceResult {
    const groupName = String(params.groupName || '')
    const wordsStr = String(params.words || '')
    const description = params.description ? String(params.description) : undefined

    if (!groupName || !wordsStr) {
      return {
        success: false,
        error: "添加语义组需要 'groupName' 和 'words' 参数。"
      }
    }

    const words = wordsStr
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)

    if (words.length === 0) {
      return {
        success: false,
        error: '词语列表不能为空。'
      }
    }

    const service = getSemanticGroupService()

    // 检查是否已存在
    const existing = service.getAllGroups()
    if (existing[groupName]) {
      return {
        success: false,
        error: `语义组 '${groupName}' 已存在。请使用 EditGroup 命令编辑。`
      }
    }

    service.addGroup(groupName, {
      name: groupName,
      words,
      description
    })

    return {
      success: true,
      output: `语义组 '${groupName}' 创建成功！包含 ${words.length} 个词语。`
    }
  }

  private editGroup(params: Record<string, unknown>): BuiltinServiceResult {
    const groupName = String(params.groupName || '')

    if (!groupName) {
      return {
        success: false,
        error: "编辑语义组需要 'groupName' 参数。"
      }
    }

    const service = getSemanticGroupService()
    const groups = service.getAllGroups()
    const existing = groups[groupName]

    if (!existing) {
      return {
        success: false,
        error: `语义组 '${groupName}' 不存在。`
      }
    }

    // 准备更新的数据
    const updatedGroup = { ...existing }

    if (params.words) {
      const words = String(params.words)
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean)
      updatedGroup.words = words
    }

    if (params.description !== undefined) {
      updatedGroup.description = params.description ? String(params.description) : undefined
    }

    // 删除旧的，添加新的
    service.removeGroup(groupName)
    service.addGroup(groupName, updatedGroup)

    return {
      success: true,
      output: `语义组 '${groupName}' 更新成功！现包含 ${updatedGroup.words.length} 个词语。`
    }
  }

  private deleteGroup(params: Record<string, unknown>): BuiltinServiceResult {
    const groupName = String(params.groupName || '')

    if (!groupName) {
      return {
        success: false,
        error: "删除语义组需要 'groupName' 参数。"
      }
    }

    const service = getSemanticGroupService()
    const removed = service.removeGroup(groupName)

    if (!removed) {
      return {
        success: false,
        error: `语义组 '${groupName}' 不存在或无法删除。`
      }
    }

    return {
      success: true,
      output: `语义组 '${groupName}' 已删除。`
    }
  }

  private addWordsToGroup(params: Record<string, unknown>): BuiltinServiceResult {
    const groupName = String(params.groupName || '')
    const wordsStr = String(params.words || '')

    if (!groupName || !wordsStr) {
      return {
        success: false,
        error: "需要 'groupName' 和 'words' 参数。"
      }
    }

    const words = wordsStr
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)

    if (words.length === 0) {
      return {
        success: false,
        error: '词语列表不能为空。'
      }
    }

    const service = getSemanticGroupService()
    const groups = service.getAllGroups()

    if (!groups[groupName]) {
      return {
        success: false,
        error: `语义组 '${groupName}' 不存在。`
      }
    }

    service.addWordsToGroup(groupName, words)

    const updated = service.getAllGroups()[groupName]
    return {
      success: true,
      output: `已向语义组 '${groupName}' 添加 ${words.length} 个词语。现共有 ${updated.words.length} 个词语。`
    }
  }

  private getConfig(): BuiltinServiceResult {
    const service = getSemanticGroupService()
    const config = service.getConfig()

    return {
      success: true,
      output: `语义组配置:\n- 启用: ${config.enabled}\n- 最大扩展词数: ${config.maxExpandedWords}\n- 组数量: ${Object.keys(config.groups).length}`,
      data: config
    }
  }

  private updateConfig(params: Record<string, unknown>): BuiltinServiceResult {
    const service = getSemanticGroupService()

    const updates: { enabled?: boolean; maxExpandedWords?: number } = {}

    if (params.enabled !== undefined) {
      updates.enabled = params.enabled === true || params.enabled === 'true'
    }

    if (params.maxExpandedWords !== undefined) {
      updates.maxExpandedWords = Number(params.maxExpandedWords)
    }

    service.updateConfig(updates)

    const config = service.getConfig()
    return {
      success: true,
      output: `配置已更新:\n- 启用: ${config.enabled}\n- 最大扩展词数: ${config.maxExpandedWords}`
    }
  }

  async shutdown(): Promise<void> {
    logger.info('SemanticGroupEditorService shutdown')
  }
}
