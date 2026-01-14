/**
 * SandboxManager - 沙盒工作区管理器
 *
 * 提供 Claude Code 风格的沙盒编程环境：
 * - 工作目录选择和管理
 * - 文件树浏览
 * - 文件监听
 * - 项目类型检测
 */

import { loggerService } from '@logger'

import type { FileTreeNode, FileWatchEvent, GitInfo, ProjectType, WorkspaceInfo } from './types'

const logger = loggerService.withContext('SandboxManager')

// ==================== 单例管理器 ====================

class SandboxManagerImpl {
  private currentWorkspace: WorkspaceInfo | null = null
  private fileTree: FileTreeNode[] = []
  private watchCallbacks: Set<(event: FileWatchEvent) => void> = new Set()
  private recentWorkspaces: string[] = []

  /**
   * 选择工作目录
   */
  async selectWorkspace(): Promise<string | null> {
    try {
      // 使用已有的 file.selectFolder API 选择目录
      if (window.api?.file?.selectFolder) {
        const path = await window.api.file.selectFolder({
          title: '选择工作目录'
        })
        if (path) {
          await this.setWorkspace(path)
          return path
        }
      } else {
        logger.warn('file.selectFolder API not available')
        return null
      }
    } catch (error) {
      logger.error('Failed to select workspace', { error })
    }
    return null
  }

  /**
   * 获取当前工作目录
   */
  getCurrentWorkspace(): WorkspaceInfo | null {
    return this.currentWorkspace
  }

  /**
   * 获取当前工作目录路径
   */
  getCurrentWorkspacePath(): string | null {
    return this.currentWorkspace?.path || null
  }

  /**
   * 设置工作目录
   */
  async setWorkspace(path: string): Promise<void> {
    try {
      const name = path.split(/[\\/]/).pop() || path
      const isGitRepo = await this.checkIsGitRepo(path)
      const gitInfo = isGitRepo ? await this.getGitInfo(path) : undefined
      const projectType = await this.detectProjectType(path)
      const packageManager = await this.detectPackageManager(path)

      this.currentWorkspace = {
        path,
        name,
        isGitRepo,
        gitInfo,
        projectType,
        packageManager
      }

      // 添加到最近工作区
      this.addToRecentWorkspaces(path)

      // 加载文件树
      await this.refreshFileTree()

      logger.info('Workspace set', { workspace: this.currentWorkspace })
    } catch (error) {
      logger.error('Failed to set workspace', { error })
      throw error
    }
  }

  /**
   * 获取文件树
   */
  async getFileTree(depth: number = 3): Promise<FileTreeNode[]> {
    if (!this.currentWorkspace) {
      return []
    }

    try {
      const tree = await this.buildFileTree(this.currentWorkspace.path, depth)
      this.fileTree = tree
      return tree
    } catch (error) {
      console.error('Failed to get file tree:', error)
      return []
    }
  }

  /**
   * 刷新文件树
   */
  async refreshFileTree(): Promise<void> {
    this.fileTree = await this.getFileTree()
  }

  /**
   * 获取缓存的文件树
   */
  getCachedFileTree(): FileTreeNode[] {
    return this.fileTree
  }

  /**
   * 监听文件变化
   */
  watchFiles(callback: (event: FileWatchEvent) => void): () => void {
    this.watchCallbacks.add(callback)

    // TODO: 实际的文件监听需要通过 IPC 调用主进程的 chokidar
    // 这里返回取消订阅函数
    return () => {
      this.watchCallbacks.delete(callback)
    }
  }

  /**
   * 触发文件变化事件
   */
  emitFileChange(event: FileWatchEvent): void {
    this.watchCallbacks.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error('File watch callback error:', error)
      }
    })
  }

  /**
   * 获取最近的工作区列表
   */
  getRecentWorkspaces(): string[] {
    return [...this.recentWorkspaces]
  }

  /**
   * 清除当前工作区
   */
  clearWorkspace(): void {
    this.currentWorkspace = null
    this.fileTree = []
  }

  // ==================== 私有方法 ====================

  private async buildFileTree(dirPath: string, depth: number, currentDepth: number = 0): Promise<FileTreeNode[]> {
    if (currentDepth >= depth) {
      return []
    }

    try {
      // 使用已有的 file.listDirectory API 获取目录内容
      if (window.api?.file?.listDirectory) {
        const entries = await window.api.file.listDirectory(dirPath, {
          includeFiles: true,
          includeDirectories: true,
          maxDepth: 1
        })

        if (!entries || !Array.isArray(entries)) {
          return []
        }

        const nodes: FileTreeNode[] = []
        for (const entry of entries) {
          const node: FileTreeNode = {
            name: entry.name,
            path: entry.path,
            type: entry.isDirectory ? 'directory' : 'file',
            size: entry.size,
            modifiedAt: entry.mtime ? new Date(entry.mtime) : undefined
          }

          // 递归获取子目录
          if (entry.isDirectory && currentDepth + 1 < depth) {
            node.children = await this.buildFileTree(entry.path, depth, currentDepth + 1)
          }

          nodes.push(node)
        }

        return nodes
      } else {
        logger.debug('file.listDirectory API not available')
        return []
      }
    } catch (error) {
      logger.error('Failed to build file tree', { dirPath, error })
      return []
    }
  }

  private async checkIsGitRepo(path: string): Promise<boolean> {
    try {
      // 使用 listDirectory 检查是否存在 .git 目录
      if (window.api?.file?.listDirectory) {
        const entries = await window.api.file.listDirectory(path, {
          includeDirectories: true,
          includeHidden: true,
          maxDepth: 1
        })
        if (Array.isArray(entries)) {
          return entries.some((e: { name: string }) => e.name === '.git')
        }
      }
      return false
    } catch {
      return false
    }
  }

  private async getGitInfo(_path: string): Promise<GitInfo | undefined> {
    // Git info requires shell execution which is not available in renderer
    // Could be implemented via IPC to main process
    return undefined
  }

  private async detectProjectType(path: string): Promise<ProjectType> {
    try {
      if (window.api?.file?.listDirectory) {
        const entries = await window.api.file.listDirectory(path, {
          includeFiles: true,
          maxDepth: 1
        })
        if (!Array.isArray(entries)) return 'unknown'

        const fileNames = new Set(entries.map((e: { name: string }) => e.name))

        // 检测项目类型
        if (fileNames.has('package.json')) {
          // Node.js 项目，进一步检测框架
          if (fileNames.has('next.config.js') || fileNames.has('next.config.mjs')) return 'react' // Next.js is React
          if (fileNames.has('angular.json')) return 'typescript' // Angular is TypeScript
          if (fileNames.has('vue.config.js') || fileNames.has('nuxt.config.js')) return 'vue'
          if (fileNames.has('tsconfig.json')) return 'typescript'
          return 'nodejs'
        }
        if (fileNames.has('Cargo.toml')) return 'rust'
        if (fileNames.has('go.mod')) return 'go'
        if (fileNames.has('requirements.txt') || fileNames.has('pyproject.toml') || fileNames.has('setup.py'))
          return 'python'
        if (fileNames.has('pom.xml') || fileNames.has('build.gradle')) return 'java'
      }
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  private async detectPackageManager(path: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun' | undefined> {
    try {
      if (window.api?.file?.listDirectory) {
        const entries = await window.api.file.listDirectory(path, {
          includeFiles: true,
          maxDepth: 1
        })
        if (!Array.isArray(entries)) return undefined

        const fileNames = new Set(entries.map((e: { name: string }) => e.name))

        // 按优先级检测包管理器
        if (fileNames.has('bun.lockb')) return 'bun'
        if (fileNames.has('pnpm-lock.yaml')) return 'pnpm'
        if (fileNames.has('yarn.lock')) return 'yarn'
        if (fileNames.has('package-lock.json')) return 'npm'
      }
      return undefined
    } catch {
      return undefined
    }
  }

  private addToRecentWorkspaces(path: string): void {
    // 移除已存在的相同路径
    this.recentWorkspaces = this.recentWorkspaces.filter((p) => p !== path)
    // 添加到开头
    this.recentWorkspaces.unshift(path)
    // 只保留最近 10 个
    this.recentWorkspaces = this.recentWorkspaces.slice(0, 10)

    // 持久化到 localStorage
    try {
      localStorage.setItem('crew_recent_workspaces', JSON.stringify(this.recentWorkspaces))
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 从存储恢复最近工作区
   */
  loadRecentWorkspaces(): void {
    try {
      const stored = localStorage.getItem('crew_recent_workspaces')
      if (stored) {
        this.recentWorkspaces = JSON.parse(stored)
      }
    } catch {
      // 忽略读取错误
    }
  }
}

// 导出单例
export const SandboxManager = new SandboxManagerImpl()

// 初始化时加载最近工作区
SandboxManager.loadRecentWorkspaces()

export default SandboxManager
