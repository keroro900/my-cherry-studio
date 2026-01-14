/**
 * Git IPC 通道
 *
 * 暴露 GitService 给渲染进程使用
 */

import { ipcMain } from 'electron'
import { getGitService } from '../services/GitService'
import { loggerService } from '@logger'

const logger = loggerService.withContext('GitIPC')

// IPC 通道名称
export const GIT_IPC_CHANNELS = {
  // 状态查询
  IS_REPO: 'git:isRepo',
  GET_STATUS: 'git:getStatus',
  GET_LOG: 'git:getLog',
  GET_DIFF: 'git:getDiff',
  GET_BRANCHES: 'git:getBranches',
  GET_REMOTES: 'git:getRemotes',
  GET_STASH_LIST: 'git:getStashList',

  // 暂存操作
  STAGE_FILES: 'git:stageFiles',
  UNSTAGE_FILES: 'git:unstageFiles',

  // 提交操作
  COMMIT: 'git:commit',
  PUSH: 'git:push',
  PULL: 'git:pull',

  // 分支操作
  CHECKOUT: 'git:checkout',

  // 其他操作
  DISCARD_CHANGES: 'git:discardChanges',
  RESET: 'git:reset',
  STASH: 'git:stash',
  STASH_POP: 'git:stashPop',
  SHOW_FILE: 'git:showFile',
  BLAME: 'git:blame',
  INIT: 'git:init',
  CLONE: 'git:clone'
}

/**
 * 注册 Git IPC 处理器
 */
export function registerGitIpcHandlers(): void {
  const gitService = getGitService()

  // 检查是否是 Git 仓库
  ipcMain.handle(GIT_IPC_CHANNELS.IS_REPO, async (_, cwd: string) => {
    try {
      return await gitService.isGitRepository(cwd)
    } catch (error) {
      logger.error('Git isRepo error', { error })
      throw error
    }
  })

  // 获取状态
  ipcMain.handle(GIT_IPC_CHANNELS.GET_STATUS, async (_, cwd: string) => {
    try {
      return await gitService.getStatus(cwd)
    } catch (error) {
      logger.error('Git getStatus error', { error })
      throw error
    }
  })

  // 获取日志
  ipcMain.handle(GIT_IPC_CHANNELS.GET_LOG, async (_, cwd: string, limit?: number, options?: { path?: string; author?: string }) => {
    try {
      return await gitService.getLog(cwd, limit, options)
    } catch (error) {
      logger.error('Git getLog error', { error })
      throw error
    }
  })

  // 获取差异
  ipcMain.handle(GIT_IPC_CHANNELS.GET_DIFF, async (_, cwd: string, options?: { staged?: boolean; path?: string }) => {
    try {
      return await gitService.getDiff(cwd, options)
    } catch (error) {
      logger.error('Git getDiff error', { error })
      throw error
    }
  })

  // 获取分支列表
  ipcMain.handle(GIT_IPC_CHANNELS.GET_BRANCHES, async (_, cwd: string) => {
    try {
      return await gitService.getBranches(cwd)
    } catch (error) {
      logger.error('Git getBranches error', { error })
      throw error
    }
  })

  // 获取远程列表
  ipcMain.handle(GIT_IPC_CHANNELS.GET_REMOTES, async (_, cwd: string) => {
    try {
      return await gitService.getRemotes(cwd)
    } catch (error) {
      logger.error('Git getRemotes error', { error })
      throw error
    }
  })

  // 获取 Stash 列表
  ipcMain.handle(GIT_IPC_CHANNELS.GET_STASH_LIST, async (_, cwd: string) => {
    try {
      return await gitService.getStashList(cwd)
    } catch (error) {
      logger.error('Git getStashList error', { error })
      throw error
    }
  })

  // 暂存文件
  ipcMain.handle(GIT_IPC_CHANNELS.STAGE_FILES, async (_, cwd: string, paths: string[]) => {
    try {
      await gitService.stageFiles(cwd, paths)
      return { success: true }
    } catch (error) {
      logger.error('Git stageFiles error', { error })
      throw error
    }
  })

  // 取消暂存
  ipcMain.handle(GIT_IPC_CHANNELS.UNSTAGE_FILES, async (_, cwd: string, paths: string[]) => {
    try {
      await gitService.unstageFiles(cwd, paths)
      return { success: true }
    } catch (error) {
      logger.error('Git unstageFiles error', { error })
      throw error
    }
  })

  // 提交
  ipcMain.handle(GIT_IPC_CHANNELS.COMMIT, async (_, cwd: string, message: string, options?: { amend?: boolean; noVerify?: boolean }) => {
    try {
      return await gitService.commit(cwd, message, options)
    } catch (error) {
      logger.error('Git commit error', { error })
      throw error
    }
  })

  // 推送
  ipcMain.handle(GIT_IPC_CHANNELS.PUSH, async (_, cwd: string, options?: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean }) => {
    try {
      return await gitService.push(cwd, options)
    } catch (error) {
      logger.error('Git push error', { error })
      throw error
    }
  })

  // 拉取
  ipcMain.handle(GIT_IPC_CHANNELS.PULL, async (_, cwd: string, options?: { remote?: string; branch?: string; rebase?: boolean }) => {
    try {
      return await gitService.pull(cwd, options)
    } catch (error) {
      logger.error('Git pull error', { error })
      throw error
    }
  })

  // 切换分支
  ipcMain.handle(GIT_IPC_CHANNELS.CHECKOUT, async (_, cwd: string, branch: string, options?: { create?: boolean }) => {
    try {
      await gitService.checkout(cwd, branch, options)
      return { success: true }
    } catch (error) {
      logger.error('Git checkout error', { error })
      throw error
    }
  })

  // 丢弃更改
  ipcMain.handle(GIT_IPC_CHANNELS.DISCARD_CHANGES, async (_, cwd: string, paths: string[]) => {
    try {
      await gitService.discardChanges(cwd, paths)
      return { success: true }
    } catch (error) {
      logger.error('Git discardChanges error', { error })
      throw error
    }
  })

  // 重置
  ipcMain.handle(GIT_IPC_CHANNELS.RESET, async (_, cwd: string, ref: string, mode?: 'soft' | 'mixed' | 'hard') => {
    try {
      await gitService.reset(cwd, ref, mode)
      return { success: true }
    } catch (error) {
      logger.error('Git reset error', { error })
      throw error
    }
  })

  // Stash
  ipcMain.handle(GIT_IPC_CHANNELS.STASH, async (_, cwd: string, message?: string) => {
    try {
      await gitService.stash(cwd, message)
      return { success: true }
    } catch (error) {
      logger.error('Git stash error', { error })
      throw error
    }
  })

  // Stash Pop
  ipcMain.handle(GIT_IPC_CHANNELS.STASH_POP, async (_, cwd: string, index?: number) => {
    try {
      await gitService.stashPop(cwd, index)
      return { success: true }
    } catch (error) {
      logger.error('Git stashPop error', { error })
      throw error
    }
  })

  // 显示文件内容
  ipcMain.handle(GIT_IPC_CHANNELS.SHOW_FILE, async (_, cwd: string, path: string, ref?: string) => {
    try {
      return await gitService.showFile(cwd, path, ref)
    } catch (error) {
      logger.error('Git showFile error', { error })
      throw error
    }
  })

  // Blame
  ipcMain.handle(GIT_IPC_CHANNELS.BLAME, async (_, cwd: string, path: string) => {
    try {
      return await gitService.blame(cwd, path)
    } catch (error) {
      logger.error('Git blame error', { error })
      throw error
    }
  })

  // 初始化仓库
  ipcMain.handle(GIT_IPC_CHANNELS.INIT, async (_, cwd: string) => {
    try {
      await gitService.init(cwd)
      return { success: true }
    } catch (error) {
      logger.error('Git init error', { error })
      throw error
    }
  })

  // 克隆仓库
  ipcMain.handle(GIT_IPC_CHANNELS.CLONE, async (_, url: string, targetDir: string, options?: { branch?: string; depth?: number }) => {
    try {
      await gitService.clone(url, targetDir, options)
      return { success: true }
    } catch (error) {
      logger.error('Git clone error', { error })
      throw error
    }
  })

  logger.info('Git IPC handlers registered')
}

export default { registerGitIpcHandlers, GIT_IPC_CHANNELS }
