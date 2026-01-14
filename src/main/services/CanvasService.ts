/**
 * Canvas Service - 协同编辑服务
 *
 * 提供文件管理、版本控制和实时同步功能
 * 支持多 Agent 协同编码和项目文件夹操作
 * 基于 VCPChat Canvas 模块设计
 */

import { loggerService } from '@logger'
import chokidar, { type FSWatcher } from 'chokidar'
import crypto from 'crypto'
import { app, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'

const logger = loggerService.withContext('CanvasService')

/**
 * Canvas 文件信息
 */
export interface CanvasFileInfo {
  path: string
  name: string
  content: string
  language: string
  modifiedAt: Date
  size: number
  hash: string
}

/**
 * Canvas 历史记录项
 */
export interface CanvasHistoryItem {
  path: string
  name: string
  language: string
  modifiedAt: Date
  accessedAt: Date
}

/**
 * Canvas 版本快照
 */
export interface CanvasVersion {
  id: string
  filePath: string
  content: string
  timestamp: Date
  description?: string
  hash: string
}

/**
 * Canvas 文件树节点
 */
export interface CanvasTreeNode {
  /** 节点 ID (路径 hash) */
  id: string
  /** 节点名称 */
  name: string
  /** 完整路径 */
  path: string
  /** 节点类型 */
  type: 'file' | 'directory'
  /** 文件语言 (仅文件) */
  language?: string
  /** 文件大小 (仅文件) */
  size?: number
  /** 修改时间 */
  modifiedAt: Date
  /** 子节点 (仅目录) */
  children?: CanvasTreeNode[]
  /** 是否展开 (仅目录) */
  expanded?: boolean
}

/**
 * Canvas 项目信息
 */
export interface CanvasProject {
  /** 项目 ID */
  id: string
  /** 项目名称 */
  name: string
  /** 项目根路径 */
  rootPath: string
  /** 打开时间 */
  openedAt: Date
  /** 是否为当前项目 */
  isActive?: boolean
}

/**
 * Agent 编辑标记
 */
export interface AgentEditMarker {
  /** Agent ID */
  agentId: string
  /** Agent 名称 */
  agentName: string
  /** 文件路径 */
  filePath: string
  /** 开始位置 */
  startLine: number
  /** 结束位置 */
  endLine: number
  /** 标记颜色 */
  color: string
  /** 时间戳 */
  timestamp: Date
}

/**
 * Canvas 同步状态
 */
export interface CanvasSyncState {
  isActive: boolean
  connectedClients: number
  lastSyncAt?: Date
}

/**
 * 支持的文件扩展名
 */
const SUPPORTED_EXTENSIONS = [
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.md',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.txt',
  '.sh',
  '.bash',
  '.sql',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.vue',
  '.svelte'
]

/**
 * 语言映射
 */
const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.md': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.txt': 'text',
  '.sh': 'shell',
  '.bash': 'shell',
  '.sql': 'sql',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'cpp',
  '.cpp': 'cpp',
  '.h': 'cpp',
  '.vue': 'vue',
  '.svelte': 'svelte'
}

/**
 * Canvas 服务类
 */
class CanvasService {
  private canvasDir: string
  private versionsDir: string
  private historyFile: string
  private projectsFile: string
  private history: CanvasHistoryItem[] = []
  private versions: Map<string, CanvasVersion[]> = new Map()
  private watcher: FSWatcher | null = null
  private syncState: CanvasSyncState = {
    isActive: false,
    connectedClients: 0
  }

  // 项目管理
  private projects: CanvasProject[] = []
  private currentProject: CanvasProject | null = null

  // Agent 编辑标记
  private agentMarkers: Map<string, AgentEditMarker[]> = new Map()

  // 文件变更回调
  private onFileChangeCallback?: (filePath: string, content: string) => void

  constructor() {
    const userDataPath = app.getPath('userData')
    this.canvasDir = path.join(userDataPath, 'canvas')
    this.versionsDir = path.join(userDataPath, 'canvas', '.versions')
    this.historyFile = path.join(userDataPath, 'canvas', '.history.json')
    this.projectsFile = path.join(userDataPath, 'canvas', '.projects.json')
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      // 创建目录
      await fs.mkdir(this.canvasDir, { recursive: true })
      await fs.mkdir(this.versionsDir, { recursive: true })

      // 加载历史记录
      await this.loadHistory()

      // 加载项目列表
      await this.loadProjects()

      logger.info('Canvas service initialized', { canvasDir: this.canvasDir })
    } catch (error) {
      logger.error('Failed to initialize Canvas service', { error: String(error) })
      throw error
    }
  }

  /**
   * 加载历史记录
   */
  private async loadHistory(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8')
      this.history = JSON.parse(data)
    } catch {
      // 文件不存在时使用空数组
      this.history = []
    }
  }

  /**
   * 保存历史记录
   */
  private async saveHistory(): Promise<void> {
    await fs.writeFile(this.historyFile, JSON.stringify(this.history, null, 2))
  }

  /**
   * 加载项目列表
   */
  private async loadProjects(): Promise<void> {
    try {
      const data = await fs.readFile(this.projectsFile, 'utf-8')
      this.projects = JSON.parse(data)
    } catch {
      this.projects = []
    }
  }

  /**
   * 保存项目列表
   */
  private async saveProjects(): Promise<void> {
    await fs.writeFile(this.projectsFile, JSON.stringify(this.projects, null, 2))
  }

  /**
   * 获取语言类型
   */
  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    return LANGUAGE_MAP[ext] || 'text'
  }

  /**
   * 检查是否支持的扩展名
   */
  private isSupportedExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return SUPPORTED_EXTENSIONS.includes(ext)
  }

  /**
   * 计算内容哈希
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  /**
   * 获取历史记录
   */
  async getHistory(): Promise<{ success: boolean; data?: CanvasHistoryItem[]; error?: string }> {
    try {
      // 按访问时间排序
      const sorted = [...this.history].sort(
        (a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
      )
      return { success: true, data: sorted }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * 加载文件
   */
  async loadFile(filePath: string): Promise<{ success: boolean; data?: CanvasFileInfo; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.canvasDir, filePath)

      const content = await fs.readFile(fullPath, 'utf-8')
      const stats = await fs.stat(fullPath)

      const fileInfo: CanvasFileInfo = {
        path: fullPath,
        name: path.basename(fullPath),
        content,
        language: this.getLanguage(fullPath),
        modifiedAt: stats.mtime,
        size: stats.size,
        hash: this.calculateHash(content)
      }

      // 更新历史记录
      await this.updateHistory(fullPath)

      return { success: true, data: fileInfo }
    } catch (error) {
      logger.error('Failed to load file', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 保存文件
   */
  async saveFile(params: {
    path: string
    content: string
    createVersion?: boolean
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { path: filePath, content, createVersion = true } = params
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.canvasDir, filePath)

      // 创建版本快照
      if (createVersion) {
        try {
          const existingContent = await fs.readFile(fullPath, 'utf-8')
          if (existingContent !== content) {
            await this.createVersionSnapshot(fullPath, existingContent)
          }
        } catch {
          // 文件不存在，跳过版本创建
        }
      }

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8')

      // 更新历史记录
      await this.updateHistory(fullPath)

      logger.info('File saved', { filePath: fullPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to save file', { error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 创建文件
   */
  async createFile(fileName: string): Promise<{ success: boolean; data?: CanvasFileInfo; error?: string }> {
    try {
      if (!this.isSupportedExtension(fileName)) {
        return { success: false, error: 'Unsupported file extension' }
      }

      const fullPath = path.join(this.canvasDir, fileName)

      // 检查文件是否已存在
      try {
        await fs.access(fullPath)
        return { success: false, error: 'File already exists' }
      } catch {
        // 文件不存在，继续创建
      }

      // 创建空文件
      await fs.writeFile(fullPath, '', 'utf-8')

      const fileInfo: CanvasFileInfo = {
        path: fullPath,
        name: fileName,
        content: '',
        language: this.getLanguage(fileName),
        modifiedAt: new Date(),
        size: 0,
        hash: this.calculateHash('')
      }

      // 添加到历史记录
      await this.updateHistory(fullPath)

      logger.info('File created', { fileName })
      return { success: true, data: fileInfo }
    } catch (error) {
      logger.error('Failed to create file', { fileName, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.canvasDir, filePath)

      await fs.unlink(fullPath)

      // 从历史记录中移除
      this.history = this.history.filter((item) => item.path !== fullPath)
      await this.saveHistory()

      logger.info('File deleted', { filePath: fullPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to delete file', { filePath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 重命名文件
   */
  async renameFile(
    oldPath: string,
    newName: string
  ): Promise<{ success: boolean; data?: CanvasFileInfo; error?: string }> {
    try {
      const fullOldPath = path.isAbsolute(oldPath) ? oldPath : path.join(this.canvasDir, oldPath)
      const dir = path.dirname(fullOldPath)
      const fullNewPath = path.join(dir, newName)

      await fs.rename(fullOldPath, fullNewPath)

      // 更新历史记录中的路径
      const historyItem = this.history.find((item) => item.path === fullOldPath)
      if (historyItem) {
        historyItem.path = fullNewPath
        historyItem.name = newName
        historyItem.language = this.getLanguage(newName)
        await this.saveHistory()
      }

      // 返回新文件信息
      return this.loadFile(fullNewPath)
    } catch (error) {
      logger.error('Failed to rename file', { oldPath, newName, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 更新历史记录
   */
  private async updateHistory(filePath: string): Promise<void> {
    const now = new Date()
    const existing = this.history.find((item) => item.path === filePath)

    if (existing) {
      existing.accessedAt = now
      existing.modifiedAt = now
    } else {
      this.history.push({
        path: filePath,
        name: path.basename(filePath),
        language: this.getLanguage(filePath),
        modifiedAt: now,
        accessedAt: now
      })
    }

    await this.saveHistory()
  }

  /**
   * 创建版本快照
   */
  private async createVersionSnapshot(filePath: string, content: string, description?: string): Promise<void> {
    const versionId = crypto.randomUUID()
    const version: CanvasVersion = {
      id: versionId,
      filePath,
      content,
      timestamp: new Date(),
      description,
      hash: this.calculateHash(content)
    }

    // 保存到内存
    const versions = this.versions.get(filePath) || []
    versions.push(version)
    this.versions.set(filePath, versions)

    // 保存到磁盘
    const versionFile = path.join(this.versionsDir, `${path.basename(filePath)}.${versionId}.json`)
    await fs.writeFile(versionFile, JSON.stringify(version, null, 2))

    logger.debug('Version snapshot created', { filePath, versionId })
  }

  /**
   * 获取文件版本列表
   */
  async getVersions(filePath: string): Promise<{ success: boolean; data?: CanvasVersion[]; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.canvasDir, filePath)
      const baseName = path.basename(fullPath)

      // 从磁盘加载版本
      const files = await fs.readdir(this.versionsDir)
      const versionFiles = files.filter((f) => f.startsWith(baseName) && f.endsWith('.json'))

      const versions: CanvasVersion[] = []
      for (const vf of versionFiles) {
        try {
          const data = await fs.readFile(path.join(this.versionsDir, vf), 'utf-8')
          versions.push(JSON.parse(data))
        } catch {
          // 跳过无效的版本文件
        }
      }

      // 按时间排序
      versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return { success: true, data: versions }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * 恢复到指定版本
   */
  async restoreVersion(versionId: string): Promise<{ success: boolean; data?: CanvasFileInfo; error?: string }> {
    try {
      // 查找版本文件
      const files = await fs.readdir(this.versionsDir)
      const versionFile = files.find((f) => f.includes(versionId))

      if (!versionFile) {
        return { success: false, error: 'Version not found' }
      }

      const data = await fs.readFile(path.join(this.versionsDir, versionFile), 'utf-8')
      const version: CanvasVersion = JSON.parse(data)

      // 恢复文件内容
      await this.saveFile({
        path: version.filePath,
        content: version.content,
        createVersion: true // 创建当前版本的快照
      })

      return this.loadFile(version.filePath)
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * 创建文件快照
   */
  async createSnapshot(
    filePath: string,
    description?: string
  ): Promise<{ success: boolean; data?: CanvasVersion; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.canvasDir, filePath)

      // 检查文件是否存在
      try {
        await fs.access(fullPath)
      } catch {
        return { success: false, error: 'File not found' }
      }

      // 读取当前内容
      const content = await fs.readFile(fullPath, 'utf-8')

      // 创建版本快照
      await this.createVersionSnapshot(fullPath, content, description)

      // 获取刚创建的版本
      const versions = await this.getVersions(filePath)
      const latestVersion = versions.data?.[0]

      return { success: true, data: latestVersion }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * 启动文件监控
   */
  async startWatching(onFileChange: (filePath: string, content: string) => void): Promise<void> {
    if (this.watcher) {
      return
    }

    this.onFileChangeCallback = onFileChange

    const watchDir = this.currentProject?.rootPath || this.canvasDir

    this.watcher = chokidar.watch(watchDir, {
      ignoreInitial: true,
      ignored: [
        /(^|[/\\])\../, // 隐藏文件
        /\.versions/, // 版本目录
        /node_modules/, // node_modules
        /__pycache__/, // Python 缓存
        /\.git/ // Git 目录
      ],
      persistent: true,
      depth: 10
    })

    this.watcher.on('change', async (filePath) => {
      if (this.isSupportedExtension(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          this.onFileChangeCallback?.(filePath, content)
        } catch (error) {
          logger.error('Error reading changed file', { filePath, error: String(error) })
        }
      }
    })

    this.watcher.on('add', (filePath) => {
      if (this.isSupportedExtension(filePath)) {
        logger.debug('File added', { filePath })
      }
    })

    this.watcher.on('unlink', (filePath) => {
      logger.debug('File removed', { filePath })
    })

    logger.info('File watcher started')
  }

  /**
   * 停止文件监控
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      this.onFileChangeCallback = undefined
      logger.info('File watcher stopped')
    }
  }

  /**
   * 获取同步状态
   */
  getSyncState(): CanvasSyncState {
    return { ...this.syncState }
  }

  /**
   * 更新同步状态
   */
  updateSyncState(update: Partial<CanvasSyncState>): void {
    this.syncState = { ...this.syncState, ...update }
  }

  /**
   * 列出所有文件
   */
  async listFiles(): Promise<{ success: boolean; data?: CanvasFileInfo[]; error?: string }> {
    try {
      const rootDir = this.currentProject?.rootPath || this.canvasDir
      const files = await fs.readdir(rootDir)
      const fileInfos: CanvasFileInfo[] = []

      for (const file of files) {
        if (file.startsWith('.')) continue // 跳过隐藏文件

        const fullPath = path.join(rootDir, file)
        const stats = await fs.stat(fullPath)

        if (stats.isFile() && this.isSupportedExtension(file)) {
          const content = await fs.readFile(fullPath, 'utf-8')
          fileInfos.push({
            path: fullPath,
            name: file,
            content,
            language: this.getLanguage(file),
            modifiedAt: stats.mtime,
            size: stats.size,
            hash: this.calculateHash(content)
          })
        }
      }

      return { success: true, data: fileInfos }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  // ==================== 项目管理 ====================

  /**
   * 打开项目文件夹 (弹出对话框)
   */
  async openProjectDialog(): Promise<{ success: boolean; data?: CanvasProject; error?: string }> {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择项目文件夹'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'User cancelled' }
      }

      const projectPath = result.filePaths[0]
      return this.openProject(projectPath)
    } catch (error) {
      logger.error('Failed to open project dialog', { error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 打开指定路径的项目
   */
  async openProject(projectPath: string): Promise<{ success: boolean; data?: CanvasProject; error?: string }> {
    try {
      // 验证路径存在
      const stats = await fs.stat(projectPath)
      if (!stats.isDirectory()) {
        return { success: false, error: 'Path is not a directory' }
      }

      const projectId = this.calculateHash(projectPath)
      const projectName = path.basename(projectPath)

      // 检查项目是否已存在
      let project = this.projects.find((p) => p.id === projectId)

      if (project) {
        project.openedAt = new Date()
      } else {
        project = {
          id: projectId,
          name: projectName,
          rootPath: projectPath,
          openedAt: new Date()
        }
        this.projects.push(project)
      }

      // 设置为当前项目
      this.currentProject = project
      this.projects.forEach((p) => (p.isActive = p.id === projectId))

      await this.saveProjects()

      // 重新启动文件监控
      if (this.watcher) {
        await this.stopWatching()
        if (this.onFileChangeCallback) {
          await this.startWatching(this.onFileChangeCallback)
        }
      }

      logger.info('Project opened', { projectPath, projectId })
      return { success: true, data: project }
    } catch (error) {
      logger.error('Failed to open project', { projectPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(): Promise<{ success: boolean; data?: CanvasProject[]; error?: string }> {
    try {
      // 按打开时间排序
      const sorted = [...this.projects].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
      return { success: true, data: sorted }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * 获取当前项目
   */
  getCurrentProject(): CanvasProject | null {
    return this.currentProject
  }

  /**
   * 关闭当前项目
   */
  async closeProject(): Promise<{ success: boolean; error?: string }> {
    if (this.currentProject) {
      this.currentProject.isActive = false
      this.currentProject = null
      await this.saveProjects()
    }
    return { success: true }
  }

  /**
   * 删除项目记录 (不删除实际文件)
   */
  async removeProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.projects = this.projects.filter((p) => p.id !== projectId)
      if (this.currentProject?.id === projectId) {
        this.currentProject = null
      }
      await this.saveProjects()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  // ==================== 文件树操作 ====================

  /**
   * 获取文件树
   */
  async getFileTree(dirPath?: string, depth = 3): Promise<{ success: boolean; data?: CanvasTreeNode; error?: string }> {
    try {
      const rootPath = dirPath || this.currentProject?.rootPath || this.canvasDir
      const tree = await this.buildTreeNode(rootPath, depth)
      return { success: true, data: tree }
    } catch (error) {
      logger.error('Failed to get file tree', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 递归构建文件树节点
   */
  private async buildTreeNode(nodePath: string, depth: number): Promise<CanvasTreeNode> {
    const stats = await fs.stat(nodePath)
    const name = path.basename(nodePath)
    const id = this.calculateHash(nodePath)

    const node: CanvasTreeNode = {
      id,
      name,
      path: nodePath,
      type: stats.isDirectory() ? 'directory' : 'file',
      modifiedAt: stats.mtime
    }

    if (stats.isFile()) {
      node.language = this.getLanguage(nodePath)
      node.size = stats.size
    } else if (stats.isDirectory() && depth > 0) {
      const entries = await fs.readdir(nodePath)
      const children: CanvasTreeNode[] = []

      for (const entry of entries) {
        // 跳过隐藏文件和特殊目录
        if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') {
          continue
        }

        const childPath = path.join(nodePath, entry)
        try {
          const childNode = await this.buildTreeNode(childPath, depth - 1)
          children.push(childNode)
        } catch {
          // 跳过无法访问的文件
        }
      }

      // 排序：目录在前，文件在后，按名称排序
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      node.children = children
    }

    return node
  }

  /**
   * 创建文件夹
   */
  async createDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      logger.info('Directory created', { dirPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to create directory', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 删除文件夹 (及其内容)
   */
  async deleteDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true })
      logger.info('Directory deleted', { dirPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to delete directory', { dirPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 复制文件或文件夹
   */
  async copy(srcPath: string, destPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stats = await fs.stat(srcPath)
      if (stats.isDirectory()) {
        await fs.cp(srcPath, destPath, { recursive: true })
      } else {
        await fs.copyFile(srcPath, destPath)
      }
      logger.info('Copied', { srcPath, destPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to copy', { srcPath, destPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 移动文件或文件夹
   */
  async move(srcPath: string, destPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.rename(srcPath, destPath)
      logger.info('Moved', { srcPath, destPath })
      return { success: true }
    } catch (error) {
      logger.error('Failed to move', { srcPath, destPath, error: String(error) })
      return { success: false, error: String(error) }
    }
  }

  // ==================== Agent 协同编辑 ====================

  /**
   * 添加 Agent 编辑标记
   */
  addAgentMarker(marker: AgentEditMarker): void {
    const markers = this.agentMarkers.get(marker.filePath) || []
    markers.push(marker)
    this.agentMarkers.set(marker.filePath, markers)
  }

  /**
   * 移除 Agent 编辑标记
   */
  removeAgentMarker(filePath: string, agentId: string): void {
    const markers = this.agentMarkers.get(filePath) || []
    const filtered = markers.filter((m) => m.agentId !== agentId)
    if (filtered.length > 0) {
      this.agentMarkers.set(filePath, filtered)
    } else {
      this.agentMarkers.delete(filePath)
    }
  }

  /**
   * 获取文件的所有 Agent 标记
   */
  getAgentMarkers(filePath: string): AgentEditMarker[] {
    return this.agentMarkers.get(filePath) || []
  }

  /**
   * 清除过期的 Agent 标记 (超过 5 分钟)
   */
  cleanupExpiredMarkers(): void {
    const now = Date.now()
    const expireTime = 5 * 60 * 1000 // 5 minutes

    for (const [filePath, markers] of this.agentMarkers.entries()) {
      const validMarkers = markers.filter((m) => now - new Date(m.timestamp).getTime() < expireTime)
      if (validMarkers.length > 0) {
        this.agentMarkers.set(filePath, validMarkers)
      } else {
        this.agentMarkers.delete(filePath)
      }
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    await this.stopWatching()
    logger.info('Canvas service shutdown')
  }
}

// 单例实例
let canvasServiceInstance: CanvasService | null = null

/**
 * 获取 Canvas 服务实例
 */
export function getCanvasService(): CanvasService {
  if (!canvasServiceInstance) {
    canvasServiceInstance = new CanvasService()
  }
  return canvasServiceInstance
}

/**
 * 创建新的 Canvas 服务实例
 */
export function createCanvasService(): CanvasService {
  canvasServiceInstance = new CanvasService()
  return canvasServiceInstance
}

export default CanvasService
