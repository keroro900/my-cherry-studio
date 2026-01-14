/**
 * VCPFileOperatorConfig - 文件操作权限配置
 *
 * 管理 FileOperator 服务的文件系统访问权限：
 * - 读取：全局（任意路径）
 * - 写入：仅限 ALLOWED_DIRECTORIES 配置列表
 * - 系统路径保护
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

const logger = loggerService.withContext('VCPFileOperatorConfig')

/**
 * 文件操作配置接口
 */
export interface FileOperatorConfig {
  /** 允许写入的目录列表（绝对路径） */
  allowedDirectories: string[]
  /** 受保护的系统路径（不允许写入/删除） */
  protectedPaths: string[]
  /** 默认工作目录 */
  defaultWorkDir: string
  /** 是否启用全局读取 */
  enableGlobalRead: boolean
  /** 最大文件大小（字节） */
  maxFileSize: number
  /** 是否启用 Canvas 功能 */
  enableCanvas: boolean
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FileOperatorConfig = {
  allowedDirectories: [],
  protectedPaths: [],
  defaultWorkDir: '',
  enableGlobalRead: true,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  enableCanvas: true
}

/**
 * 系统保护路径（始终不允许写入/删除）
 */
const SYSTEM_PROTECTED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/etc'
]

class FileOperatorConfigManager {
  private static instance: FileOperatorConfigManager | null = null
  private config: FileOperatorConfig = { ...DEFAULT_CONFIG }
  private configPath: string = ''
  private initialized: boolean = false

  private constructor() {}

  static getInstance(): FileOperatorConfigManager {
    if (!FileOperatorConfigManager.instance) {
      FileOperatorConfigManager.instance = new FileOperatorConfigManager()
    }
    return FileOperatorConfigManager.instance
  }

  /**
   * 初始化配置
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const userData = app.getPath('userData')
    this.configPath = path.join(userData, 'vcp', 'file-operator-config.json')

    // 设置默认工作目录
    this.config.defaultWorkDir = path.join(userData, 'Data', 'Workspace')

    // 默认允许的目录
    this.config.allowedDirectories = [
      this.config.defaultWorkDir,
      path.join(userData, 'vcp'),
      path.join(userData, 'Data'),
      path.join(userData, 'plugins')
    ]

    // 加载用户配置
    await this.loadConfig()

    // 确保默认目录存在
    await this.ensureDirectories()

    this.initialized = true
    logger.info('FileOperatorConfig initialized', {
      allowedDirs: this.config.allowedDirectories.length,
      defaultWorkDir: this.config.defaultWorkDir
    })
  }

  /**
   * 加载配置文件
   */
  private async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const userConfig = JSON.parse(content) as Partial<FileOperatorConfig>

      // 合并用户配置
      this.config = {
        ...this.config,
        ...userConfig,
        // 保持默认允许目录 + 用户添加的目录
        allowedDirectories: [
          ...this.config.allowedDirectories,
          ...(userConfig.allowedDirectories || [])
        ],
        // 保持系统保护路径 + 用户添加的保护路径
        protectedPaths: [
          ...SYSTEM_PROTECTED_PATHS,
          ...(userConfig.protectedPaths || [])
        ]
      }

      logger.debug('Loaded user config', { path: this.configPath })
    } catch (error) {
      // 配置文件不存在，使用默认配置
      this.config.protectedPaths = [...SYSTEM_PROTECTED_PATHS]
      logger.debug('Using default config (no user config found)')
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath)
      await fs.mkdir(dir, { recursive: true })

      // 只保存用户自定义的部分
      const userData = app.getPath('userData')
      const defaultDirs = [
        path.join(userData, 'Data', 'Workspace'),
        path.join(userData, 'vcp'),
        path.join(userData, 'Data'),
        path.join(userData, 'plugins')
      ]

      const userAddedDirs = this.config.allowedDirectories.filter(
        (d) => !defaultDirs.includes(d)
      )

      const userAddedProtected = this.config.protectedPaths.filter(
        (p) => !SYSTEM_PROTECTED_PATHS.includes(p)
      )

      const toSave: Partial<FileOperatorConfig> = {
        allowedDirectories: userAddedDirs,
        protectedPaths: userAddedProtected,
        enableGlobalRead: this.config.enableGlobalRead,
        maxFileSize: this.config.maxFileSize,
        enableCanvas: this.config.enableCanvas
      }

      await fs.writeFile(this.configPath, JSON.stringify(toSave, null, 2), 'utf-8')
      logger.info('Config saved', { path: this.configPath })
    } catch (error) {
      logger.error('Failed to save config', error as Error)
      throw error
    }
  }

  /**
   * 确保必要目录存在
   */
  private async ensureDirectories(): Promise<void> {
    for (const dir of this.config.allowedDirectories) {
      try {
        await fs.mkdir(dir, { recursive: true })
      } catch {
        // 忽略错误
      }
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): FileOperatorConfig {
    return { ...this.config }
  }

  /**
   * 获取允许写入的目录列表
   */
  getAllowedDirectories(): string[] {
    return [...this.config.allowedDirectories]
  }

  /**
   * 添加允许写入的目录
   */
  async addAllowedDirectory(dirPath: string): Promise<boolean> {
    const absPath = path.resolve(dirPath)

    // 检查是否是保护路径
    if (this.isProtectedPath(absPath)) {
      logger.warn('Cannot add protected path to allowed directories', { path: absPath })
      return false
    }

    if (!this.config.allowedDirectories.includes(absPath)) {
      this.config.allowedDirectories.push(absPath)
      await this.saveConfig()
      logger.info('Added allowed directory', { path: absPath })
    }

    return true
  }

  /**
   * 移除允许写入的目录
   */
  async removeAllowedDirectory(dirPath: string): Promise<boolean> {
    const absPath = path.resolve(dirPath)
    const index = this.config.allowedDirectories.indexOf(absPath)

    if (index > -1) {
      this.config.allowedDirectories.splice(index, 1)
      await this.saveConfig()
      logger.info('Removed allowed directory', { path: absPath })
      return true
    }

    return false
  }

  /**
   * 检查路径是否允许写入
   */
  isWriteAllowed(filePath: string): boolean {
    const absPath = path.resolve(filePath)

    // 检查是否是保护路径
    if (this.isProtectedPath(absPath)) {
      return false
    }

    // 检查是否在允许目录内
    return this.config.allowedDirectories.some((dir) => {
      const normalizedDir = path.resolve(dir)
      return absPath.startsWith(normalizedDir + path.sep) || absPath === normalizedDir
    })
  }

  /**
   * 检查路径是否允许读取
   */
  isReadAllowed(filePath: string): boolean {
    // 如果启用全局读取，总是允许
    if (this.config.enableGlobalRead) {
      return true
    }

    // 否则检查是否在允许目录内
    return this.isWriteAllowed(filePath)
  }

  /**
   * 检查路径是否是受保护路径
   */
  isProtectedPath(filePath: string): boolean {
    const absPath = path.resolve(filePath).toLowerCase()

    return this.config.protectedPaths.some((protectedPath) => {
      const normalizedProtected = path.resolve(protectedPath).toLowerCase()
      return absPath.startsWith(normalizedProtected + path.sep) || absPath === normalizedProtected
    })
  }

  /**
   * 验证路径并返回绝对路径
   * @throws Error 如果路径不允许访问
   */
  validatePath(filePath: string, operation: 'read' | 'write' | 'delete'): string {
    const absPath = path.resolve(filePath)

    if (operation === 'read') {
      if (!this.isReadAllowed(absPath)) {
        throw new Error(`Read access denied: ${absPath}`)
      }
    } else {
      // write 或 delete
      if (!this.isWriteAllowed(absPath)) {
        throw new Error(
          `Write access denied: ${absPath}\n` +
            `Allowed directories: ${this.config.allowedDirectories.join(', ')}`
        )
      }
    }

    return absPath
  }

  /**
   * 获取默认工作目录
   */
  getDefaultWorkDir(): string {
    return this.config.defaultWorkDir
  }

  /**
   * 获取最大文件大小
   */
  getMaxFileSize(): number {
    return this.config.maxFileSize
  }

  /**
   * 检查是否启用 Canvas
   */
  isCanvasEnabled(): boolean {
    return this.config.enableCanvas
  }
}

export const fileOperatorConfig = FileOperatorConfigManager.getInstance()
export default fileOperatorConfig
