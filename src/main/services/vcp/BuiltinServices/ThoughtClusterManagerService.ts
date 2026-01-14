/**
 * ThoughtClusterManager 内置服务
 *
 * 提供思维簇文件管理功能：
 * - 创建、编辑、读取簇文件
 * - 列出所有簇及其文件
 * - 获取统计信息
 * - 支持自定义目录配置
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:ThoughtClusterManagerService')

export class ThoughtClusterManagerService implements IBuiltinService {
  name = 'ThoughtClusterManager'
  displayName = '思维簇管理器 (内置)'
  description = '管理思维簇文件：创建、编辑、读取、列出簇文件，获取统计信息。'
  version = '3.0.0'
  type = 'builtin_service' as const

  configSchema = {
    clusterDirectory: {
      type: 'string',
      description: '思维簇存储目录（留空使用默认目录）',
      default: ''
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'CreateClusterFile',
      description: `在指定的思维簇目录中创建新文件。
参数:
- clusterName (字符串, 必需): 簇名称，必须以"簇"结尾
- content (字符串, 必需): 文件内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」CreateClusterFile「末」
clusterName:「始」技术学习簇「末」
content:「始」# 学习笔记\n\n今天学习了...「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'clusterName', description: '簇名称，必须以"簇"结尾', required: true, type: 'string' },
        { name: 'content', description: '文件内容', required: true, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'EditClusterFile',
      description: `编辑思维簇中的文件内容。
参数:
- clusterName (字符串, 可选): 簇名称，不指定则搜索所有簇
- targetText (字符串, 必需): 要查找的目标文本 (至少15个字符)
- replacementText (字符串, 必需): 替换文本

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」EditClusterFile「末」
clusterName:「始」技术学习簇「末」
targetText:「始」这是需要修改的原始内容「末」
replacementText:「始」这是修改后的新内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'clusterName', description: '簇名称（可选，不指定则搜索所有簇）', required: false, type: 'string' },
        { name: 'targetText', description: '要查找的目标文本 (至少15个字符)', required: true, type: 'string' },
        { name: 'replacementText', description: '替换文本', required: true, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'ListClusters',
      description: `列出所有思维簇及其文件。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」ListClusters「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'GetStats',
      description: `获取思维簇统计信息（簇数量、文件数量、总大小）。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」GetStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'ReadClusterFile',
      description: `读取指定簇文件的内容。
参数:
- filePath (字符串, 必需): 文件完整路径

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」ReadClusterFile「末」
filePath:「始」/path/to/cluster/file.md「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'filePath', description: '文件完整路径', required: true, type: 'string' }
      ]
    },
    {
      commandIdentifier: 'DeleteClusterFile',
      description: `删除指定的簇文件。
参数:
- filePath (字符串, 必需): 文件完整路径

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ThoughtClusterManager「末」
command:「始」DeleteClusterFile「末」
filePath:「始」/path/to/cluster/file.md「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'filePath', description: '文件完整路径', required: true, type: 'string' }
      ]
    }
  ]

  private dailynoteDir: string = ''
  private customDir: string = ''

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dailynoteDir = path.join(userDataPath, 'Data', 'dailynote')
    await fs.mkdir(this.dailynoteDir, { recursive: true })
    logger.info('ThoughtClusterManagerService initialized', { dailynoteDir: this.dailynoteDir })
  }

  /**
   * 设置服务配置
   */
  setConfig(config: Record<string, unknown>): void {
    if (typeof config.clusterDirectory === 'string' && config.clusterDirectory.trim()) {
      this.customDir = config.clusterDirectory.trim()
      logger.info('ThoughtClusterManager custom directory set', { customDir: this.customDir })
    }
  }

  /**
   * 获取当前使用的目录
   */
  private getActiveDir(): string {
    return this.customDir || this.dailynoteDir
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    try {
      switch (command) {
        case 'CreateClusterFile':
          return await this.createClusterFile(params)
        case 'EditClusterFile':
          return await this.editClusterFile(params)
        case 'ListClusters':
          return await this.handleListClusters()
        case 'GetStats':
          return await this.handleGetStats()
        case 'ReadClusterFile':
          return await this.handleReadClusterFile(params)
        case 'DeleteClusterFile':
          return await this.handleDeleteClusterFile(params)
        default:
          return {
            success: false,
            error: `Unknown command: ${command}. Available: CreateClusterFile, EditClusterFile, ListClusters, GetStats, ReadClusterFile, DeleteClusterFile`
          }
      }
    } catch (error) {
      logger.error('ThoughtClusterManager command failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async createClusterFile(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const clusterName = String(params.clusterName || '')
    const content = String(params.content || '')

    if (!clusterName || !content) {
      return {
        success: false,
        error: "创建簇文件需要 'clusterName' 和 'content' 参数。"
      }
    }

    const cleanedClusterName = clusterName.replace(/\s/g, '')
    if (!cleanedClusterName.endsWith('簇')) {
      return {
        success: false,
        error: "簇名称必须以'簇'结尾。"
      }
    }

    const activeDir = this.getActiveDir()
    const clusterPath = path.join(activeDir, cleanedClusterName)
    await fs.mkdir(clusterPath, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${timestamp}.md`
    const filePath = path.join(clusterPath, fileName)

    // 处理转义字符
    const processedContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"')

    await fs.writeFile(filePath, processedContent, 'utf8')

    return {
      success: true,
      output: `文件创建成功！路径: ${filePath}`,
      data: { filePath, clusterName: cleanedClusterName }
    }
  }

  private async editClusterFile(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const clusterName = params.clusterName ? String(params.clusterName) : undefined
    const targetText = String(params.targetText || '')
    const replacementText = String(params.replacementText || '')

    if (!targetText || !replacementText) {
      return {
        success: false,
        error: "编辑簇文件需要 'targetText' 和 'replacementText' 参数。"
      }
    }

    if (targetText.length < 15) {
      return {
        success: false,
        error: 'targetText 必须至少 15 个字符长。'
      }
    }

    const searchPaths: string[] = []
    const activeDir = this.getActiveDir()

    if (clusterName) {
      const cleanedClusterName = clusterName.replace(/\s/g, '')
      if (!cleanedClusterName.endsWith('簇')) {
        return {
          success: false,
          error: "簇名称必须以'簇'结尾。"
        }
      }
      searchPaths.push(path.join(activeDir, cleanedClusterName))
    } else {
      // 搜索所有簇目录
      try {
        const allDirs = await fs.readdir(activeDir, { withFileTypes: true })
        for (const dirent of allDirs) {
          if (dirent.isDirectory() && dirent.name.endsWith('簇')) {
            searchPaths.push(path.join(activeDir, dirent.name))
          }
        }
      } catch {
        // 目录不存在
      }
    }

    if (searchPaths.length === 0) {
      return {
        success: false,
        error: '没有找到可搜索的簇目录。'
      }
    }

    // 处理转义字符
    const processedTarget = targetText.replace(/\\n/g, '\n').replace(/\\"/g, '"')
    const processedReplacement = replacementText.replace(/\\n/g, '\n').replace(/\\"/g, '"')

    for (const dirPath of searchPaths) {
      try {
        const files = await fs.readdir(dirPath)
        for (const file of files) {
          const filePath = path.join(dirPath, file)
          const stat = await fs.stat(filePath)
          if (stat.isFile()) {
            const content = await fs.readFile(filePath, 'utf8')
            if (content.includes(processedTarget)) {
              const newContent = content.replace(processedTarget, processedReplacement)
              await fs.writeFile(filePath, newContent, 'utf8')
              return {
                success: true,
                output: `文件更新成功！路径: ${filePath}`
              }
            }
          }
        }
      } catch {
        // 跳过无法访问的目录
      }
    }

    return {
      success: false,
      error: '在任何文件中都未找到目标文本。'
    }
  }

  /**
   * 列出所有思维簇及其文件
   */
  async listClusters(): Promise<{
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
  }> {
    try {
      const clusters: Array<{
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
      }> = []

      const activeDir = this.getActiveDir()
      // 读取所有以"簇"结尾的目录
      const allDirs = await fs.readdir(activeDir, { withFileTypes: true })
      for (const dirent of allDirs) {
        if (dirent.isDirectory() && dirent.name.endsWith('簇')) {
          const clusterPath = path.join(activeDir, dirent.name)
          const files: Array<{
            name: string
            path: string
            mtime: number
            size: number
          }> = []

          try {
            const clusterFiles = await fs.readdir(clusterPath)
            for (const fileName of clusterFiles) {
              const filePath = path.join(clusterPath, fileName)
              const stat = await fs.stat(filePath)
              if (stat.isFile() && fileName.endsWith('.md')) {
                files.push({
                  name: fileName,
                  path: filePath,
                  mtime: stat.mtimeMs,
                  size: stat.size
                })
              }
            }
          } catch {
            // 跳过无法读取的目录
          }

          // 按修改时间排序
          files.sort((a, b) => b.mtime - a.mtime)

          clusters.push({
            name: dirent.name,
            path: clusterPath,
            fileCount: files.length,
            latestMtime: files.length > 0 ? files[0].mtime : undefined,
            files
          })
        }
      }

      // 按最新修改时间排序
      clusters.sort((a, b) => (b.latestMtime || 0) - (a.latestMtime || 0))

      return { success: true, clusters }
    } catch (error) {
      logger.error('Failed to list clusters', { error })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 获取思维簇统计信息
   */
  async getStats(): Promise<{
    success: boolean
    stats?: {
      clusterCount: number
      totalFiles: number
      totalSize: number
    }
    error?: string
  }> {
    try {
      const result = await this.listClusters()
      if (!result.success || !result.clusters) {
        return { success: false, error: result.error }
      }

      let totalFiles = 0
      let totalSize = 0

      for (const cluster of result.clusters) {
        totalFiles += cluster.fileCount
        for (const file of cluster.files) {
          totalSize += file.size
        }
      }

      return {
        success: true,
        stats: {
          clusterCount: result.clusters.length,
          totalFiles,
          totalSize
        }
      }
    } catch (error) {
      logger.error('Failed to get cluster stats', { error })
      return { success: false, error: String(error) }
    }
  }

  /**
   * 读取簇文件内容
   */
  async readClusterFile(filePath: string): Promise<{
    success: boolean
    content?: string
    error?: string
  }> {
    try {
      // 验证文件路径在活动目录下
      const activeDir = this.getActiveDir()
      const normalizedPath = path.normalize(filePath)
      if (!normalizedPath.startsWith(activeDir)) {
        return { success: false, error: '无效的文件路径' }
      }

      const content = await fs.readFile(filePath, 'utf8')
      return { success: true, content }
    } catch (error) {
      logger.error('Failed to read cluster file', { error, filePath })
      return { success: false, error: String(error) }
    }
  }

  // ==================== VCP 命令处理器 ====================

  /**
   * 处理 ListClusters 命令
   */
  private async handleListClusters(): Promise<BuiltinServiceResult> {
    const result = await this.listClusters()
    if (!result.success || !result.clusters) {
      return { success: false, error: result.error || '获取簇列表失败' }
    }

    if (result.clusters.length === 0) {
      return {
        success: true,
        output: '📂 当前没有思维簇。\n\n使用 CreateClusterFile 命令创建第一个思维簇！',
        data: { clusters: [], totalClusters: 0, totalFiles: 0 }
      }
    }

    let output = `📂 思维簇列表 (共 ${result.clusters.length} 个簇)\n\n`
    let totalFiles = 0

    for (const cluster of result.clusters) {
      totalFiles += cluster.fileCount
      output += `### ${cluster.name}\n`
      output += `路径: ${cluster.path}\n`
      output += `文件数: ${cluster.fileCount}\n`
      if (cluster.files.length > 0) {
        output += `最近文件:\n`
        for (const file of cluster.files.slice(0, 3)) {
          const date = new Date(file.mtime).toLocaleString()
          output += `  - ${file.name} (${date})\n`
        }
      }
      output += '\n'
    }

    return {
      success: true,
      output,
      data: {
        clusters: result.clusters,
        totalClusters: result.clusters.length,
        totalFiles
      }
    }
  }

  /**
   * 处理 GetStats 命令
   */
  private async handleGetStats(): Promise<BuiltinServiceResult> {
    const result = await this.getStats()
    if (!result.success || !result.stats) {
      return { success: false, error: result.error || '获取统计信息失败' }
    }

    const stats = result.stats
    const sizeKB = (stats.totalSize / 1024).toFixed(2)

    return {
      success: true,
      output: `📊 思维簇统计\n\n簇数量: ${stats.clusterCount}\n文件数量: ${stats.totalFiles}\n总大小: ${sizeKB} KB`,
      data: stats
    }
  }

  /**
   * 处理 ReadClusterFile 命令
   */
  private async handleReadClusterFile(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const filePath = String(params.filePath || '')
    if (!filePath) {
      return { success: false, error: "需要 'filePath' 参数" }
    }

    const result = await this.readClusterFile(filePath)
    if (!result.success || result.content === undefined) {
      return { success: false, error: result.error || '读取文件失败' }
    }

    return {
      success: true,
      output: `📄 文件内容 (${filePath}):\n\n${result.content}`,
      data: { filePath, content: result.content, length: result.content.length }
    }
  }

  /**
   * 处理 DeleteClusterFile 命令
   */
  private async handleDeleteClusterFile(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const filePath = String(params.filePath || '')
    if (!filePath) {
      return { success: false, error: "需要 'filePath' 参数" }
    }

    // 验证文件路径
    const activeDir = this.getActiveDir()
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(activeDir)) {
      return { success: false, error: '无效的文件路径' }
    }

    try {
      await fs.unlink(filePath)
      return {
        success: true,
        output: `✅ 文件已删除: ${filePath}`,
        data: { filePath, deleted: true }
      }
    } catch (error) {
      logger.error('Failed to delete cluster file', { error, filePath })
      return { success: false, error: `删除失败: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  async shutdown(): Promise<void> {
    logger.info('ThoughtClusterManagerService shutdown')
  }
}
