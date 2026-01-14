/**
 * External Plugin IPC Handler
 *
 * 提供外部插件管理的 IPC 接口
 *
 * @module services/vcp/ExternalPluginIpcHandler
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import { getExternalPluginManager, initializeExternalPluginManager } from './ExternalPluginManager'
import type { ExternalPluginManifest } from './ExternalPluginManager'

const logger = loggerService.withContext('ExternalPluginIpc')

/**
 * 注册外部插件管理 IPC 处理器
 */
export function registerExternalPluginIpcHandlers(): void {
  logger.info('Registering external plugin IPC handlers')

  // 初始化外部插件管理器
  ipcMain.handle('vcp:external:initialize', async () => {
    try {
      const manager = await initializeExternalPluginManager()
      const stats = manager.getStats()
      return { success: true, data: stats }
    } catch (error) {
      logger.error('Failed to initialize external plugin manager', { error })
      return { success: false, error: String(error) }
    }
  })

  // 获取所有已安装插件
  ipcMain.handle('vcp:external:listPlugins', async () => {
    try {
      const manager = getExternalPluginManager()
      const plugins = manager.getInstalledPlugins()
      return {
        success: true,
        data: plugins.map(p => ({
          name: p.manifest.name,
          displayName: p.manifest.displayName,
          version: p.manifest.version,
          description: p.manifest.description,
          author: p.manifest.author,
          type: p.manifest.type || p.manifest.pluginType,
          enabled: p.enabled,
          installedAt: p.installedAt,
          path: p.path,
          configSchema: p.manifest.configSchema,
          defaultConfig: p.manifest.defaultConfig
        }))
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取单个插件详情
  ipcMain.handle('vcp:external:getPlugin', async (_event, name: string) => {
    try {
      const manager = getExternalPluginManager()
      const plugin = manager.getPlugin(name)
      if (!plugin) {
        return { success: false, error: `Plugin not found: ${name}` }
      }
      return { success: true, data: plugin }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 启用/禁用插件
  ipcMain.handle('vcp:external:setEnabled', async (_event, name: string, enabled: boolean) => {
    try {
      const manager = getExternalPluginManager()
      const result = manager.setPluginEnabled(name, enabled)
      if (!result) {
        return { success: false, error: `Plugin not found: ${name}` }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 更新插件配置
  ipcMain.handle(
    'vcp:external:updateConfig',
    async (_event, name: string, config: Record<string, unknown>) => {
      try {
        const manager = getExternalPluginManager()
        const result = manager.updatePluginConfig(name, config)
        if (!result) {
          return { success: false, error: `Plugin not found: ${name}` }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取插件合并配置
  ipcMain.handle('vcp:external:getConfig', async (_event, name: string) => {
    try {
      const manager = getExternalPluginManager()
      const config = manager.getPluginMergedConfig(name)
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 安装插件 (从目录路径)
  ipcMain.handle('vcp:external:install', async (_event, sourcePath: string) => {
    try {
      const manager = getExternalPluginManager()
      const result = await manager.installPlugin(sourcePath)
      return result
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 扫描源目录，查找可用插件
  ipcMain.handle('vcp:external:scanSource', async (_event, sourcePath: string) => {
    try {
      const manager = getExternalPluginManager()
      const result = manager.scanSourceDirectory(sourcePath)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 批量安装插件
  ipcMain.handle('vcp:external:installBatch', async (_event, sourcePaths: string[]) => {
    try {
      const manager = getExternalPluginManager()
      const result = await manager.installPluginsBatch(sourcePaths)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 卸载插件
  ipcMain.handle('vcp:external:uninstall', async (_event, name: string) => {
    try {
      const manager = getExternalPluginManager()
      const result = await manager.uninstallPlugin(name)
      return result
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 重新扫描已安装插件
  ipcMain.handle('vcp:external:rescan', async () => {
    try {
      const manager = getExternalPluginManager()
      const plugins = await manager.scanInstalledPlugins()
      return {
        success: true,
        data: plugins.map(p => ({
          name: p.manifest.name,
          displayName: p.manifest.displayName,
          version: p.manifest.version,
          type: p.manifest.type,
          enabled: p.enabled
        }))
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 验证 manifest
  ipcMain.handle('vcp:external:validateManifest', async (_event, manifest: Partial<ExternalPluginManifest>) => {
    try {
      const manager = getExternalPluginManager()
      const result = manager.validateManifest(manifest)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取目录路径
  ipcMain.handle('vcp:external:getPaths', async () => {
    try {
      const manager = getExternalPluginManager()
      const paths = manager.getPaths()
      return { success: true, data: paths }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取统计信息
  ipcMain.handle('vcp:external:getStats', async () => {
    try {
      const manager = getExternalPluginManager()
      const stats = manager.getStats()
      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 检查插件是否已安装
  ipcMain.handle('vcp:external:isInstalled', async (_event, name: string) => {
    try {
      const manager = getExternalPluginManager()
      const installed = manager.isInstalled(name)
      return { success: true, data: installed }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 在文件管理器中打开插件目录
  ipcMain.handle('vcp:external:openPluginsFolder', async () => {
    try {
      const { shell } = await import('electron')
      const manager = getExternalPluginManager()
      const paths = manager.getPaths()
      await shell.openPath(paths.plugins)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  logger.info('External plugin IPC handlers registered')
}

/**
 * 注销外部插件 IPC 处理器
 */
export function unregisterExternalPluginIpcHandlers(): void {
  const channels = [
    'vcp:external:initialize',
    'vcp:external:listPlugins',
    'vcp:external:getPlugin',
    'vcp:external:setEnabled',
    'vcp:external:updateConfig',
    'vcp:external:getConfig',
    'vcp:external:install',
    'vcp:external:scanSource',
    'vcp:external:installBatch',
    'vcp:external:uninstall',
    'vcp:external:rescan',
    'vcp:external:validateManifest',
    'vcp:external:getPaths',
    'vcp:external:getStats',
    'vcp:external:isInstalled',
    'vcp:external:openPluginsFolder'
  ]

  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  logger.info('External plugin IPC handlers unregistered')
}
