/**
 * Canvas 协同编辑 IPC 处理器
 *
 * 注册 Canvas 文件管理、版本控制、实时同步的 IPC 通道
 * 支持项目管理、文件树操作、多 Agent 协同编辑
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

import type { AgentEditMarker } from './CanvasService'
import { getCanvasService } from './CanvasService'

const logger = loggerService.withContext('CanvasIpcHandler')

/**
 * 注册 Canvas IPC 处理器
 */
export function registerCanvasIpcHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering Canvas IPC handlers...')

  const canvasService = getCanvasService()

  // 初始化服务
  canvasService.initialize().catch((error) => {
    logger.error('Failed to initialize Canvas service', { error: String(error) })
  })

  // ==================== Canvas File Management ====================

  // 获取历史记录
  ipcMain.handle(IpcChannel.Canvas_GetHistory, async () => {
    try {
      return await canvasService.getHistory()
    } catch (error) {
      logger.error('Failed to get history', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 加载文件
  ipcMain.handle(IpcChannel.Canvas_LoadFile, async (_, filePath: string) => {
    try {
      return await canvasService.loadFile(filePath)
    } catch (error) {
      logger.error('Failed to load file', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 保存文件
  ipcMain.handle(
    IpcChannel.Canvas_SaveFile,
    async (_, params: { path: string; content: string; createVersion?: boolean }) => {
      try {
        return await canvasService.saveFile(params)
      } catch (error) {
        logger.error('Failed to save file', { error: String(error) })
        return { success: false, error: String(error) }
      }
    }
  )

  // 创建文件
  ipcMain.handle(IpcChannel.Canvas_CreateFile, async (_, fileName: string) => {
    try {
      return await canvasService.createFile(fileName)
    } catch (error) {
      logger.error('Failed to create file', { fileName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 删除文件
  ipcMain.handle(IpcChannel.Canvas_DeleteFile, async (_, filePath: string) => {
    try {
      return await canvasService.deleteFile(filePath)
    } catch (error) {
      logger.error('Failed to delete file', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 重命名文件
  ipcMain.handle(IpcChannel.Canvas_RenameFile, async (_, oldPath: string, newName: string) => {
    try {
      return await canvasService.renameFile(oldPath, newName)
    } catch (error) {
      logger.error('Failed to rename file', { oldPath, newName, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 列出所有文件
  ipcMain.handle(IpcChannel.Canvas_ListFiles, async () => {
    try {
      return await canvasService.listFiles()
    } catch (error) {
      logger.error('Failed to list files', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Canvas Version Control ====================

  // 获取版本列表
  ipcMain.handle(IpcChannel.Canvas_GetVersions, async (_, filePath: string) => {
    try {
      return await canvasService.getVersions(filePath)
    } catch (error) {
      logger.error('Failed to get versions', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 恢复到指定版本
  ipcMain.handle(IpcChannel.Canvas_RestoreVersion, async (_, versionId: string) => {
    try {
      return await canvasService.restoreVersion(versionId)
    } catch (error) {
      logger.error('Failed to restore version', { versionId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 创建快照
  ipcMain.handle(IpcChannel.Canvas_CreateSnapshot, async (_, filePath: string, description?: string) => {
    try {
      return await canvasService.createSnapshot(filePath, description)
    } catch (error) {
      logger.error('Failed to create snapshot', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Canvas Real-time Sync ====================

  // 启动同步
  ipcMain.handle(IpcChannel.Canvas_StartSync, async () => {
    try {
      await canvasService.startWatching((filePath, content) => {
        // 通知渲染进程文件变更
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IpcChannel.Canvas_ExternalChange, { filePath, content })
        }
      })

      canvasService.updateSyncState({ isActive: true })
      return { success: true }
    } catch (error) {
      logger.error('Failed to start sync', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 停止同步
  ipcMain.handle(IpcChannel.Canvas_StopSync, async () => {
    try {
      await canvasService.stopWatching()
      canvasService.updateSyncState({ isActive: false })
      return { success: true }
    } catch (error) {
      logger.error('Failed to stop sync', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取同步状态
  ipcMain.handle(IpcChannel.Canvas_GetSyncState, () => {
    try {
      return { success: true, data: canvasService.getSyncState() }
    } catch (error) {
      logger.error('Failed to get sync state', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Canvas Project Management ====================

  // 打开项目对话框
  ipcMain.handle(IpcChannel.Canvas_OpenProjectDialog, async () => {
    try {
      return await canvasService.openProjectDialog()
    } catch (error) {
      logger.error('Failed to open project dialog', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 打开指定项目
  ipcMain.handle(IpcChannel.Canvas_OpenProject, async (_, projectPath: string) => {
    try {
      return await canvasService.openProject(projectPath)
    } catch (error) {
      logger.error('Failed to open project', { projectPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 关闭当前项目
  ipcMain.handle(IpcChannel.Canvas_CloseProject, async () => {
    try {
      return await canvasService.closeProject()
    } catch (error) {
      logger.error('Failed to close project', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取项目列表
  ipcMain.handle(IpcChannel.Canvas_GetProjects, async () => {
    try {
      return await canvasService.getProjects()
    } catch (error) {
      logger.error('Failed to get projects', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取当前项目
  ipcMain.handle(IpcChannel.Canvas_GetCurrentProject, () => {
    try {
      const project = canvasService.getCurrentProject()
      return { success: true, data: project }
    } catch (error) {
      logger.error('Failed to get current project', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 删除项目记录
  ipcMain.handle(IpcChannel.Canvas_RemoveProject, async (_, projectId: string) => {
    try {
      return await canvasService.removeProject(projectId)
    } catch (error) {
      logger.error('Failed to remove project', { projectId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Canvas File Tree ====================

  // 获取文件树
  ipcMain.handle(IpcChannel.Canvas_GetFileTree, async (_, dirPath?: string, depth?: number) => {
    try {
      return await canvasService.getFileTree(dirPath, depth)
    } catch (error) {
      logger.error('Failed to get file tree', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 创建目录
  ipcMain.handle(IpcChannel.Canvas_CreateDirectory, async (_, dirPath: string) => {
    try {
      return await canvasService.createDirectory(dirPath)
    } catch (error) {
      logger.error('Failed to create directory', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 删除目录
  ipcMain.handle(IpcChannel.Canvas_DeleteDirectory, async (_, dirPath: string) => {
    try {
      return await canvasService.deleteDirectory(dirPath)
    } catch (error) {
      logger.error('Failed to delete directory', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 复制文件/目录
  ipcMain.handle(IpcChannel.Canvas_Copy, async (_, srcPath: string, destPath: string) => {
    try {
      return await canvasService.copy(srcPath, destPath)
    } catch (error) {
      logger.error('Failed to copy', { srcPath, destPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 移动文件/目录
  ipcMain.handle(IpcChannel.Canvas_Move, async (_, srcPath: string, destPath: string) => {
    try {
      return await canvasService.move(srcPath, destPath)
    } catch (error) {
      logger.error('Failed to move', { srcPath, destPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // ==================== Canvas Agent Collaboration ====================

  // 添加 Agent 编辑标记
  ipcMain.handle(IpcChannel.Canvas_AddAgentMarker, (_, marker: AgentEditMarker) => {
    try {
      canvasService.addAgentMarker(marker)
      // 广播给其他客户端
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('canvas:agentMarkerAdded', marker)
      }
      return { success: true }
    } catch (error) {
      logger.error('Failed to add agent marker', { error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 移除 Agent 编辑标记
  ipcMain.handle(IpcChannel.Canvas_RemoveAgentMarker, (_, filePath: string, agentId: string) => {
    try {
      canvasService.removeAgentMarker(filePath, agentId)
      // 广播给其他客户端
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('canvas:agentMarkerRemoved', { filePath, agentId })
      }
      return { success: true }
    } catch (error) {
      logger.error('Failed to remove agent marker', { filePath, agentId, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 获取 Agent 编辑标记
  ipcMain.handle(IpcChannel.Canvas_GetAgentMarkers, (_, filePath: string) => {
    try {
      const markers = canvasService.getAgentMarkers(filePath)
      return { success: true, data: markers }
    } catch (error) {
      logger.error('Failed to get agent markers', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  // 定期清理过期的 Agent 标记
  setInterval(() => {
    canvasService.cleanupExpiredMarkers()
  }, 60000) // 每分钟清理一次

  logger.info('Canvas IPC handlers registered successfully')
}

/**
 * 注销 Canvas IPC 处理器
 */
export function unregisterCanvasIpcHandlers(): void {
  const channels = [
    // File Management
    IpcChannel.Canvas_GetHistory,
    IpcChannel.Canvas_LoadFile,
    IpcChannel.Canvas_SaveFile,
    IpcChannel.Canvas_CreateFile,
    IpcChannel.Canvas_DeleteFile,
    IpcChannel.Canvas_RenameFile,
    IpcChannel.Canvas_ListFiles,
    // Version Control
    IpcChannel.Canvas_GetVersions,
    IpcChannel.Canvas_RestoreVersion,
    IpcChannel.Canvas_CreateSnapshot,
    // Real-time Sync
    IpcChannel.Canvas_StartSync,
    IpcChannel.Canvas_StopSync,
    IpcChannel.Canvas_GetSyncState,
    // Project Management
    IpcChannel.Canvas_OpenProjectDialog,
    IpcChannel.Canvas_OpenProject,
    IpcChannel.Canvas_CloseProject,
    IpcChannel.Canvas_GetProjects,
    IpcChannel.Canvas_GetCurrentProject,
    IpcChannel.Canvas_RemoveProject,
    // File Tree
    IpcChannel.Canvas_GetFileTree,
    IpcChannel.Canvas_CreateDirectory,
    IpcChannel.Canvas_DeleteDirectory,
    IpcChannel.Canvas_Copy,
    IpcChannel.Canvas_Move,
    // Agent Collaboration
    IpcChannel.Canvas_AddAgentMarker,
    IpcChannel.Canvas_RemoveAgentMarker,
    IpcChannel.Canvas_GetAgentMarkers
  ]

  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  logger.info('Canvas IPC handlers unregistered')
}
