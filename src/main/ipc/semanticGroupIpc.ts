/**
 * SemanticGroupService IPC Handler
 *
 * 提供渲染进程访问 SemanticGroupService 的 IPC 接口
 */

import { ipcMain } from 'electron'

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { SemanticGroupService, type SemanticGroup } from '../services/memory/SemanticGroupService'

const logger = loggerService.withContext('SemanticGroupIpcHandler')

/**
 * 注册 SemanticGroupService IPC handlers
 */
export function registerSemanticGroupIpcHandlers(): void {
  logger.info('Registering SemanticGroupService IPC handlers...')

  const service = SemanticGroupService.getInstance()

  // 扩展查询
  ipcMain.handle(
    IpcChannel.SemanticGroup_Expand,
    async (
      _event,
      params: {
        query: string
        groups?: string[]
        maxExpansions?: number
      }
    ): Promise<{
      success: boolean
      expandedTerms?: string[]
      matchedGroups?: string[]
      error?: string
    }> => {
      try {
        // 分词
        const queryTokens = params.query
          .toLowerCase()
          .split(/[\s,;.!?，；。！？]+/)
          .filter((t) => t.length > 0)

        // 扩展
        const expandedTokens = service.expandQueryTokens(queryTokens)

        // 检测激活的组
        const activatedGroups = service.detectAndActivateGroups(params.query)
        const matchedGroups = Array.from(activatedGroups.keys())

        // 如果指定了组过滤
        let filteredTerms = expandedTokens
        if (params.groups && params.groups.length > 0) {
          const allowedGroups = new Set(params.groups)
          filteredTerms = expandedTokens.filter((_term, index) => {
            // 简单过滤：保留匹配的组中的词
            return matchedGroups.some((g) => allowedGroups.has(g)) || index < (params.maxExpansions || 10)
          })
        }

        // 限制数量
        if (params.maxExpansions) {
          filteredTerms = filteredTerms.slice(0, params.maxExpansions)
        }

        logger.debug('Query expanded', {
          query: params.query,
          expandedCount: filteredTerms.length,
          matchedGroups
        })

        return {
          success: true,
          expandedTerms: filteredTerms,
          matchedGroups
        }
      } catch (error) {
        logger.error('Failed to expand query', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取增强向量
  ipcMain.handle(
    IpcChannel.SemanticGroup_GetEnhancedVector,
    async (
      _event,
      params: {
        query: string
        groups?: string[]
      }
    ): Promise<{
      success: boolean
      vector?: number[]
      sourceVector?: number[]
      groupContributions?: Record<string, number>
      error?: string
    }> => {
      try {
        // 检测激活的组
        const activatedGroups = service.detectAndActivateGroups(params.query)

        // 如果指定了组过滤
        if (params.groups && params.groups.length > 0) {
          const allowedGroups = new Set(params.groups)
          for (const key of activatedGroups.keys()) {
            if (!allowedGroups.has(key)) {
              activatedGroups.delete(key)
            }
          }
        }

        // 获取增强向量
        const enhancedVector = await service.getEnhancedVector(params.query, activatedGroups)

        // 计算组贡献
        const groupContributions: Record<string, number> = {}
        for (const [groupId, data] of activatedGroups) {
          groupContributions[groupId] = data.strength
        }

        return {
          success: true,
          vector: enhancedVector,
          groupContributions
        }
      } catch (error) {
        logger.error('Failed to get enhanced vector', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取或创建组向量
  ipcMain.handle(
    IpcChannel.SemanticGroup_GetGroupVector,
    async (
      _event,
      params: {
        groupId: string
        forceRecalculate?: boolean
      }
    ): Promise<{
      success: boolean
      vector?: number[]
      cached: boolean
      error?: string
    }> => {
      try {
        // 首先尝试从缓存获取
        const cachedVector = service.getGroupVectorFromCache(params.groupId)

        if (cachedVector && !params.forceRecalculate) {
          return {
            success: true,
            vector: cachedVector,
            cached: true
          }
        }

        // 如果强制重新计算或没有缓存，预热缓存
        if (params.forceRecalculate) {
          await service.precomputeGroupVectors()
        }

        const vector = service.getGroupVectorFromCache(params.groupId)

        return {
          success: true,
          vector: vector ?? undefined,
          cached: false
        }
      } catch (error) {
        logger.error('Failed to get group vector', { error: String(error) })
        return { success: false, cached: false, error: String(error) }
      }
    }
  )

  // 列出所有语义组
  ipcMain.handle(
    IpcChannel.SemanticGroup_ListGroups,
    async (): Promise<{
      success: boolean
      groups?: Array<{
        id: string
        name: string
        description?: string
        keywords: string[]
        priority?: number
        color?: string
      }>
      error?: string
    }> => {
      try {
        const groups = service.listGroups()

        return {
          success: true,
          groups: groups.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            keywords: g.words,
            priority: g.weight ? Math.round(g.weight * 10) : undefined,
            color: undefined // SemanticGroup 目前没有 color 字段
          }))
        }
      } catch (error) {
        logger.error('Failed to list groups', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 添加自定义语义组
  ipcMain.handle(
    IpcChannel.SemanticGroup_AddGroup,
    async (
      _event,
      params: {
        id: string
        name: string
        description?: string
        keywords: string[]
        priority?: number
        color?: string
      }
    ): Promise<{
      success: boolean
      error?: string
    }> => {
      try {
        const group: SemanticGroup = {
          name: params.name,
          words: params.keywords,
          description: params.description,
          weight: params.priority ? params.priority / 10 : 1.0
        }

        service.addGroup(params.id, group)

        logger.info('Group added', { groupId: params.id, name: params.name })
        return { success: true }
      } catch (error) {
        logger.error('Failed to add group', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 删除语义组
  ipcMain.handle(
    IpcChannel.SemanticGroup_RemoveGroup,
    async (
      _event,
      params: {
        groupId: string
      }
    ): Promise<{
      success: boolean
      error?: string
    }> => {
      try {
        service.removeGroup(params.groupId)

        logger.info('Group removed', { groupId: params.groupId })
        return { success: true }
      } catch (error) {
        logger.error('Failed to remove group', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取服务统计
  ipcMain.handle(
    IpcChannel.SemanticGroup_GetStats,
    async (): Promise<{
      success: boolean
      stats?: {
        totalGroups: number
        cachedVectors: number
        cacheHitRate: number
        lastCacheUpdate?: string
      }
      error?: string
    }> => {
      try {
        const stats = service.getStats()

        return {
          success: true,
          stats: {
            totalGroups: stats.totalGroups,
            cachedVectors: stats.cachedVectors,
            cacheHitRate: stats.cacheHitRate,
            lastCacheUpdate: stats.lastCacheUpdate
          }
        }
      } catch (error) {
        logger.error('Failed to get stats', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 预热缓存
  ipcMain.handle(
    IpcChannel.SemanticGroup_WarmCache,
    async (): Promise<{
      success: boolean
      cachedCount?: number
      error?: string
    }> => {
      try {
        await service.precomputeGroupVectors()
        const stats = service.getStats()

        logger.info('Cache warmed', { cachedCount: stats.cachedVectors })
        return {
          success: true,
          cachedCount: stats.cachedVectors
        }
      } catch (error) {
        logger.error('Failed to warm cache', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 清除缓存
  ipcMain.handle(
    IpcChannel.SemanticGroup_ClearCache,
    async (): Promise<{
      success: boolean
      error?: string
    }> => {
      try {
        service.clearCache()

        logger.info('Cache cleared')
        return { success: true }
      } catch (error) {
        logger.error('Failed to clear cache', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  logger.info('SemanticGroupService IPC handlers registered successfully')
}
