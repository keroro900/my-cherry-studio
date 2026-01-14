/**
 * VCPInjectorIpcHandler - VCP 上下文注入器 IPC 处理器
 *
 * 连接 preload vcpInjector API 到 ContextInjectorService
 */

import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { loggerService } from '@main/services/LoggerService'
import {
  getContextInjectorService,
  type InjectionContext,
  type InjectionRule,
  type VCPTavernPreset
} from '@main/knowledge/agent/ContextInjectorService'

const logger = loggerService.withContext('VCPInjectorIpcHandler')

/**
 * 注册 VCP Injector IPC 处理器
 */
export function registerVCPInjectorIpcHandlers(): void {
  logger.info('Registering VCP Injector IPC handlers')

  // 清理已存在的 handlers（防止热重载导致的重复注册）
  const injectorChannels = [
    IpcChannel.VCP_Injector_Rule_List,
    IpcChannel.VCP_Injector_Rule_Create,
    IpcChannel.VCP_Injector_Rule_Update,
    IpcChannel.VCP_Injector_Rule_Delete,
    IpcChannel.VCP_Injector_Rule_Toggle,
    IpcChannel.VCP_Injector_Preset_List,
    IpcChannel.VCP_Injector_Preset_Create,
    IpcChannel.VCP_Injector_Preset_Activate,
    IpcChannel.VCP_Injector_Preset_Delete,
    IpcChannel.VCP_Injector_Preset_Update,
    IpcChannel.VCP_Injector_Preset_CreateDirector,
    IpcChannel.VCP_Injector_Preset_CreateRoleplay,
    IpcChannel.VCP_Injector_Execute
  ]

  for (const channel of injectorChannels) {
    try {
      ipcMain.removeHandler(channel)
    } catch (error) {
      // 忽略 handler 不存在的错误
    }
  }

  const service = getContextInjectorService()

  // ==================== 规则管理 ====================

  // 列出所有规则
  ipcMain.handle(IpcChannel.VCP_Injector_Rule_List, async () => {
    try {
      const rules = service.getAllRules()
      // 转换为 preload API 期望的格式
      const formattedRules = rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        pattern: rule.triggers.map((t) => String(t.value)).join(', '),
        injection: rule.content,
        position: rule.position,
        isActive: rule.isActive
      }))
      return { success: true, rules: formattedRules }
    } catch (error) {
      logger.error('Failed to list rules', error as Error)
      return { success: false, error: String(error), rules: [] }
    }
  })

  // 创建规则
  ipcMain.handle(
    IpcChannel.VCP_Injector_Rule_Create,
    async (_event, data: Omit<InjectionRule, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const rule = await service.createRule(data)
        return { success: true, rule }
      } catch (error) {
        logger.error('Failed to create rule', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 更新规则
  ipcMain.handle(
    IpcChannel.VCP_Injector_Rule_Update,
    async (_event, data: { id: string } & Partial<InjectionRule>) => {
      try {
        const { id, ...updates } = data
        const rule = await service.updateRule(id, updates)
        if (!rule) {
          return { success: false, error: 'Rule not found' }
        }
        return { success: true, rule }
      } catch (error) {
        logger.error('Failed to update rule', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 删除规则
  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Delete, async (_event, id: string) => {
    try {
      const deleted = await service.deleteRule(id)
      return { success: deleted, error: deleted ? undefined : 'Rule not found' }
    } catch (error) {
      logger.error('Failed to delete rule', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 切换规则激活状态
  ipcMain.handle(IpcChannel.VCP_Injector_Rule_Toggle, async (_event, id: string) => {
    try {
      const rules = service.getAllRules()
      const rule = rules.find((r) => r.id === id)
      if (!rule) {
        return { success: false, error: 'Rule not found' }
      }
      const updated = await service.updateRule(id, { isActive: !rule.isActive })
      return { success: true, rule: updated }
    } catch (error) {
      logger.error('Failed to toggle rule', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== 预设管理 ====================

  // 列出所有预设
  ipcMain.handle(IpcChannel.VCP_Injector_Preset_List, async () => {
    try {
      const presets = service.getAllPresets()
      const formattedPresets = presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        isActive: preset.isActive,
        ruleCount: preset.rules.length
      }))
      return { success: true, presets: formattedPresets }
    } catch (error) {
      logger.error('Failed to list presets', error as Error)
      return { success: false, error: String(error), presets: [] }
    }
  })

  // 创建预设
  ipcMain.handle(
    IpcChannel.VCP_Injector_Preset_Create,
    async (_event, data: Omit<VCPTavernPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const preset = await service.createPreset(data)
        return { success: true, preset }
      } catch (error) {
        logger.error('Failed to create preset', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 更新预设
  ipcMain.handle(
    IpcChannel.VCP_Injector_Preset_Update,
    async (_event, data: { id: string } & Partial<VCPTavernPreset>) => {
      try {
        const { id, ...updates } = data
        const preset = await service.updatePreset(id, updates)
        if (!preset) {
          return { success: false, error: 'Preset not found' }
        }
        return { success: true, preset }
      } catch (error) {
        logger.error('Failed to update preset', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 激活预设
  ipcMain.handle(IpcChannel.VCP_Injector_Preset_Activate, async (_event, presetId: string) => {
    try {
      const activated = await service.activatePreset(presetId)
      return { success: activated, error: activated ? undefined : 'Preset not found' }
    } catch (error) {
      logger.error('Failed to activate preset', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 删除预设
  ipcMain.handle(IpcChannel.VCP_Injector_Preset_Delete, async (_event, presetId: string) => {
    try {
      const deleted = await service.deletePreset(presetId)
      return { success: deleted, error: deleted ? undefined : 'Preset not found' }
    } catch (error) {
      logger.error('Failed to delete preset', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 创建导演模式预设
  ipcMain.handle(IpcChannel.VCP_Injector_Preset_CreateDirector, async () => {
    try {
      const preset = await service.createDirectorPreset()
      return { success: true, preset }
    } catch (error) {
      logger.error('Failed to create director preset', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 创建角色扮演增强预设
  ipcMain.handle(IpcChannel.VCP_Injector_Preset_CreateRoleplay, async () => {
    try {
      const preset = await service.createRoleplayEnhancementPreset()
      return { success: true, preset }
    } catch (error) {
      logger.error('Failed to create roleplay preset', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== 注入执行 ====================

  // 执行注入 (简化版 - 基于文本)
  ipcMain.handle(
    IpcChannel.VCP_Injector_Execute,
    async (_event, args: { text: string; context?: Record<string, unknown> }) => {
      try {
        const injectionContext: InjectionContext = {
          turnCount: 0,
          lastUserMessage: args.text,
          lastAssistantMessage: '',
          contextLength: args.text.length,
          currentTime: new Date(),
          customData: args.context as Record<string, any>
        }

        const results = service.executeInjection(injectionContext)
        return results.map((r) => ({
          content: r.content,
          position: r.position,
          source: r.ruleName
        }))
      } catch (error) {
        logger.error('Failed to execute injection', error as Error)
        return []
      }
    }
  )

  // 执行上下文注入 (完整版)
  ipcMain.handle(
    IpcChannel.VCP_Context_Execute,
    async (
      _event,
      args: {
        agentId: string
        turnCount?: number
        lastUserMessage?: string
        lastAssistantMessage?: string
        contextLength?: number
      }
    ) => {
      try {
        const injectionContext: InjectionContext = {
          turnCount: args.turnCount ?? 0,
          lastUserMessage: args.lastUserMessage ?? '',
          lastAssistantMessage: args.lastAssistantMessage ?? '',
          contextLength: args.contextLength ?? 0,
          currentTime: new Date(),
          agentId: args.agentId
        }

        const results = service.executeInjection(injectionContext)
        return results.map((r) => ({
          content: r.content,
          position: r.position,
          source: r.ruleName
        }))
      } catch (error) {
        logger.error('Failed to execute context injection', error as Error)
        return []
      }
    }
  )

  logger.info('VCP Injector IPC handlers registered')
}
