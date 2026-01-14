/**
 * VCPClusterIpcHandler - VCP 思维簇直接 IPC 处理器
 *
 * 提供思维簇功能的直接 IPC 接口，绕过插件执行管道
 * 直接调用 ThoughtClusterManagerService，提供更好的性能和类型安全
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import { ensureBuiltinServicesInitialized } from './BuiltinServices'
import type { ThoughtClusterManagerService } from './BuiltinServices/ThoughtClusterManagerService'

const logger = loggerService.withContext('VCPClusterIpcHandler')

/**
 * 注册 VCP 思维簇直接 IPC 处理器
 */
export function registerVCPClusterIpcHandlers(): void {
  logger.info('Registering VCP Cluster IPC handlers')

  // 列出所有思维簇
  ipcMain.handle(
    'vcp:cluster:list',
    async (): Promise<{
      success: boolean
      clusters?: Array<{
        name: string
        path: string
        fileCount: number
        latestMtime?: number
        files: Array<{
          name: string
          path: string
          mtime: number
          size: number
        }>
      }>
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const clusterService = builtinRegistry.get('ThoughtClusterManager') as ThoughtClusterManagerService | undefined

        if (!clusterService) {
          return { success: false, error: 'ThoughtClusterManagerService not available' }
        }

        return await clusterService.listClusters()
      } catch (error) {
        logger.error('Failed to list clusters', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取思维簇统计
  ipcMain.handle(
    'vcp:cluster:stats',
    async (): Promise<{
      success: boolean
      stats?: {
        clusterCount: number
        totalFiles: number
        totalSize: number
      }
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const clusterService = builtinRegistry.get('ThoughtClusterManager') as ThoughtClusterManagerService | undefined

        if (!clusterService) {
          return { success: false, error: 'ThoughtClusterManagerService not available' }
        }

        return await clusterService.getStats()
      } catch (error) {
        logger.error('Failed to get cluster stats', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 读取簇文件内容
  ipcMain.handle(
    'vcp:cluster:read',
    async (
      _,
      filePath: string
    ): Promise<{
      success: boolean
      content?: string
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const clusterService = builtinRegistry.get('ThoughtClusterManager') as ThoughtClusterManagerService | undefined

        if (!clusterService) {
          return { success: false, error: 'ThoughtClusterManagerService not available' }
        }

        return await clusterService.readClusterFile(filePath)
      } catch (error) {
        logger.error('Failed to read cluster file', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 创建簇文件
  ipcMain.handle(
    'vcp:cluster:create',
    async (
      _,
      params: { clusterName: string; content: string }
    ): Promise<{
      success: boolean
      output?: string
      data?: { filePath: string; clusterName: string }
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const clusterService = builtinRegistry.get('ThoughtClusterManager') as ThoughtClusterManagerService | undefined

        if (!clusterService) {
          return { success: false, error: 'ThoughtClusterManagerService not available' }
        }

        const result = await clusterService.execute('CreateClusterFile', params)
        return {
          success: result.success,
          output: result.output,
          data: result.data as { filePath: string; clusterName: string } | undefined,
          error: result.error
        }
      } catch (error) {
        logger.error('Failed to create cluster file', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  logger.info('VCP Cluster IPC handlers registered')
}
