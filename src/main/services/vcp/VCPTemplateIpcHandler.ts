/**
 * VCPTemplateIpcHandler - VCP 模板管理 IPC 处理器
 *
 * 处理渲染进程发来的模板管理请求
 */

import { ipcMain } from 'electron'

import { loggerService } from '@main/services/LoggerService'
import { vcpTemplateService, type PromptTemplate } from '@main/services/vcp/VCPTemplateService'

const logger = loggerService.withContext('VCPTemplateIpcHandler')

/**
 * 注册模板管理 IPC 处理器
 */
export function registerVCPTemplateIpcHandlers(): void {
  logger.info('Registering VCP Template IPC handlers')

  // 获取模板列表
  ipcMain.handle('vcp:template:list', async () => {
    try {
      const templates = await vcpTemplateService.list()
      return { success: true, templates }
    } catch (error) {
      logger.error('Failed to list templates', error as Error)
      return { success: false, error: String(error), templates: [] }
    }
  })

  // 获取单个模板
  ipcMain.handle('vcp:template:get', async (_event, id: string) => {
    try {
      const template = await vcpTemplateService.get(id)
      return { success: true, template }
    } catch (error) {
      logger.error('Failed to get template', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 根据名称获取模板
  ipcMain.handle('vcp:template:getByName', async (_event, name: string) => {
    try {
      const template = await vcpTemplateService.getByName(name)
      return { success: true, template }
    } catch (error) {
      logger.error('Failed to get template by name', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 创建模板
  ipcMain.handle(
    'vcp:template:create',
    async (_event, data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const template = await vcpTemplateService.create(data)
        return { success: true, template }
      } catch (error) {
        logger.error('Failed to create template', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 更新模板
  ipcMain.handle('vcp:template:update', async (_event, data: { id: string } & Partial<PromptTemplate>) => {
    try {
      const { id, ...updates } = data
      const template = await vcpTemplateService.update(id, updates)
      if (!template) {
        return { success: false, error: 'Template not found' }
      }
      return { success: true, template }
    } catch (error) {
      logger.error('Failed to update template', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 删除模板
  ipcMain.handle('vcp:template:delete', async (_event, id: string) => {
    try {
      const deleted = await vcpTemplateService.delete(id)
      return { success: deleted, error: deleted ? undefined : 'Template not found' }
    } catch (error) {
      logger.error('Failed to delete template', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 按分类获取模板
  ipcMain.handle('vcp:template:listByCategory', async (_event, category: string) => {
    try {
      const templates = await vcpTemplateService.listByCategory(category)
      return { success: true, templates }
    } catch (error) {
      logger.error('Failed to list templates by category', error as Error)
      return { success: false, error: String(error), templates: [] }
    }
  })

  // 获取所有分类
  ipcMain.handle('vcp:template:categories', async () => {
    try {
      const categories = await vcpTemplateService.getCategories()
      return { success: true, categories }
    } catch (error) {
      logger.error('Failed to get template categories', error as Error)
      return { success: false, error: String(error), categories: [] }
    }
  })

  // 渲染模板
  ipcMain.handle('vcp:template:render', async (_event, templateId: string, variables: Record<string, string>) => {
    try {
      const rendered = await vcpTemplateService.render(templateId, variables)
      if (rendered === undefined) {
        return { success: false, error: 'Template not found' }
      }
      return { success: true, rendered }
    } catch (error) {
      logger.error('Failed to render template', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 搜索模板
  ipcMain.handle('vcp:template:search', async (_event, query: string) => {
    try {
      const templates = await vcpTemplateService.search(query)
      return { success: true, templates }
    } catch (error) {
      logger.error('Failed to search templates', error as Error)
      return { success: false, error: String(error), templates: [] }
    }
  })

  // 获取统计信息
  ipcMain.handle('vcp:template:stats', async () => {
    try {
      const stats = await vcpTemplateService.getStats()
      return { success: true, stats }
    } catch (error) {
      logger.error('Failed to get template stats', error as Error)
      return { success: false, error: String(error) }
    }
  })

  logger.info('VCP Template IPC handlers registered')
}
