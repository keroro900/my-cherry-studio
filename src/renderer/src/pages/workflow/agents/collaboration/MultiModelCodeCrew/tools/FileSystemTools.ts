/**
 * FileSystemTools - 文件系统工具集
 *
 * 为 Crew 提供完整的文件操作能力：
 * - 文件读写
 * - 目录操作
 * - 文件搜索
 * - 权限集成
 */

import { PermissionManager } from '../sandbox/PermissionManager'
import { SandboxManager } from '../sandbox/SandboxManager'
import { VCPLogBridge } from '../bridge/VCPLogBridge'

// ==================== 类型定义 ====================

/**
 * 文件编辑操作
 */
interface FileEdit {
  type: 'insert' | 'replace' | 'delete'
  /** 起始行（从 1 开始） */
  startLine: number
  /** 结束行（包含） */
  endLine?: number
  /** 新内容 */
  content?: string
}

/**
 * 文件条目
 */
interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt?: Date
  isSymlink?: boolean
}

/**
 * Grep 结果
 */
interface GrepResult {
  file: string
  line: number
  content: string
  match: string
}

/**
 * 文件信息
 */
interface FileInfo {
  path: string
  name: string
  size: number
  modifiedAt: Date
  createdAt: Date
  isDirectory: boolean
  isFile: boolean
}

// ==================== 文件系统工具实现 ====================

class FileSystemToolsImpl {
  /**
   * 读取文件内容
   */
  async readFile(path: string): Promise<string> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission('file_read', { path: fullPath }, 'FileSystemTools')
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 读取 ${fullPath}`)
    }

    VCPLogBridge.debug('fs', `读取文件: ${fullPath}`)

    // 使用 fs.readText API
    if (window.api?.fs?.readText) {
      return await window.api.fs.readText(fullPath)
    }

    throw new Error('文件系统 API 不可用')
  }

  /**
   * 写入文件内容
   */
  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission('file_write', { path: fullPath }, 'FileSystemTools')
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 写入 ${fullPath}`)
    }

    VCPLogBridge.info('fs', `写入文件: ${fullPath}`, { size: content.length })

    // 使用 file.write API
    if (window.api?.file?.write) {
      await window.api.file.write(fullPath, content)
      return
    }

    throw new Error('文件系统 API 不可用')
  }

  /**
   * 编辑文件（基于行的操作）
   */
  async editFile(path: string, edits: FileEdit[]): Promise<void> {
    // 读取现有内容
    const content = await this.readFile(path)
    const lines = content.split('\n')

    // 按行号降序排序编辑，避免索引偏移
    const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine)

    for (const edit of sortedEdits) {
      const startIdx = edit.startLine - 1
      const endIdx = (edit.endLine || edit.startLine) - 1

      if (startIdx < 0 || startIdx >= lines.length) {
        continue
      }

      switch (edit.type) {
        case 'insert':
          lines.splice(startIdx, 0, edit.content || '')
          break
        case 'replace':
          const deleteCount = endIdx - startIdx + 1
          const newLines = (edit.content || '').split('\n')
          lines.splice(startIdx, deleteCount, ...newLines)
          break
        case 'delete':
          lines.splice(startIdx, endIdx - startIdx + 1)
          break
      }
    }

    // 写回文件
    await this.writeFile(path, lines.join('\n'))
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission(
      'file_delete',
      { path: fullPath },
      'FileSystemTools'
    )
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 删除 ${fullPath}`)
    }

    VCPLogBridge.warn('fs', `删除文件: ${fullPath}`)

    // 使用 fs.unlink API
    if (window.api?.fs?.unlink) {
      const result = await window.api.fs.unlink(fullPath)
      if (!result.success) {
        throw new Error(result.error || `删除失败: ${fullPath}`)
      }
      return
    }

    throw new Error('文件系统 API 不可用')
  }

  /**
   * 列出目录内容
   */
  async listDirectory(path: string): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission('file_read', { path: fullPath }, 'FileSystemTools')
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 列出 ${fullPath}`)
    }

    VCPLogBridge.debug('fs', `列出目录: ${fullPath}`)

    // 使用 file.listDirectory API
    if (window.api?.file?.listDirectory) {
      const entries = await window.api.file.listDirectory(fullPath, {
        includeFiles: true,
        includeDirectories: true,
        maxDepth: 1
      })
      if (Array.isArray(entries)) {
        return entries.map(
          (entry: { name: string; path: string; isDirectory?: boolean; size?: number; mtime?: number }) => ({
            name: entry.name,
            path: entry.path || `${fullPath}/${entry.name}`.replace(/\\/g, '/'),
            type: entry.isDirectory ? ('directory' as const) : ('file' as const),
            size: entry.size,
            modifiedAt: entry.mtime ? new Date(entry.mtime) : undefined
          })
        )
      }
    }

    throw new Error('目录列表 API 不可用')
  }

  /**
   * Glob 搜索文件
   */
  async glob(pattern: string, options?: { cwd?: string }): Promise<string[]> {
    const basePath = options?.cwd ? this.resolvePath(options.cwd) : this.getWorkspacePath()

    VCPLogBridge.debug('fs', `Glob 搜索: ${pattern}`, { basePath })

    // 使用简单的递归搜索
    return this.simpleGlob(basePath, pattern)
  }

  /**
   * Grep 搜索文件内容
   */
  async grep(
    pattern: string,
    path?: string,
    options?: { ignoreCase?: boolean; maxResults?: number }
  ): Promise<GrepResult[]> {
    const searchPath = path ? this.resolvePath(path) : this.getWorkspacePath()
    const regex = new RegExp(pattern, options?.ignoreCase ? 'gi' : 'g')
    const maxResults = options?.maxResults || 100
    const results: GrepResult[] = []

    VCPLogBridge.debug('fs', `Grep 搜索: ${pattern}`, { path: searchPath })

    // 递归搜索文件内容
    const files = await this.glob('**/*.{js,ts,jsx,tsx,json,md,py,go,rs}', { cwd: searchPath })

    for (const file of files.slice(0, 50)) {
      if (results.length >= maxResults) break

      try {
        const content = await this.readFile(file)
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break

          const line = lines[i]
          const matches = line.match(regex)
          if (matches) {
            results.push({
              file,
              line: i + 1,
              content: line.trim(),
              match: matches[0]
            })
          }
        }
      } catch {
        // 跳过无法读取的文件
      }
    }

    return results
  }

  /**
   * 获取文件信息
   */
  async stat(path: string): Promise<FileInfo> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission('file_read', { path: fullPath }, 'FileSystemTools')
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 获取文件信息 ${fullPath}`)
    }

    VCPLogBridge.debug('fs', `获取文件信息: ${fullPath}`)

    // 使用 fs.stat API
    if (window.api?.fs?.stat) {
      const stat = await window.api.fs.stat(fullPath)
      if (!stat) {
        throw new Error(`文件不存在: ${fullPath}`)
      }

      const fileName = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath
      return {
        path: fullPath,
        name: fileName,
        size: stat.size,
        modifiedAt: new Date(stat.mtime),
        createdAt: new Date(stat.birthtime),
        isDirectory: stat.isDirectory,
        isFile: stat.isFile
      }
    }

    throw new Error('文件系统 API 不可用')
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)

    // 使用 fs.exists API
    if (window.api?.fs?.exists) {
      return await window.api.fs.exists(fullPath)
    }

    // 后备方案：尝试读取文件
    try {
      await this.readFile(path)
      return true
    } catch {
      try {
        const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/')) || '.'
        const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1)
        const entries = await this.listDirectory(parentPath)
        return entries.some((e) => e.name === fileName)
      } catch {
        return false
      }
    }
  }

  /**
   * 创建目录
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(path)

    // 权限检查
    const hasPermission = await PermissionManager.requestPermission('file_write', { path: fullPath }, 'FileSystemTools')
    if (!hasPermission) {
      throw new Error(`权限被拒绝: 创建目录 ${fullPath}`)
    }

    VCPLogBridge.info('fs', `创建目录: ${fullPath}`)

    // 使用 fs.mkdir API
    if (window.api?.fs?.mkdir) {
      const result = await window.api.fs.mkdir(fullPath, options)
      if (!result.success) {
        throw new Error(result.error || `创建目录失败: ${fullPath}`)
      }
      return
    }

    throw new Error('文件系统 API 不可用')
  }

  /**
   * 复制文件
   */
  async copyFile(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)

    // 读取源文件
    const content = await this.readFile(srcPath)

    // 写入目标文件
    await this.writeFile(destPath, content)

    VCPLogBridge.info('fs', `复制文件: ${srcPath} -> ${destPath}`)
  }

  /**
   * 移动/重命名文件
   */
  async moveFile(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)

    // 权限检查
    const hasWritePermission = await PermissionManager.requestPermission(
      'file_write',
      { path: destPath },
      'FileSystemTools'
    )
    const hasDeletePermission = await PermissionManager.requestPermission(
      'file_delete',
      { path: srcPath },
      'FileSystemTools'
    )

    if (!hasWritePermission || !hasDeletePermission) {
      throw new Error(`权限被拒绝: 移动 ${srcPath} -> ${destPath}`)
    }

    VCPLogBridge.info('fs', `移动文件: ${srcPath} -> ${destPath}`)

    // 使用 fs.rename API
    if (window.api?.fs?.rename) {
      const result = await window.api.fs.rename(srcPath, destPath)
      if (!result.success) {
        throw new Error(result.error || `移动失败: ${srcPath} -> ${destPath}`)
      }
      return
    }

    throw new Error('文件系统 API 不可用')
  }

  // ==================== 私有方法 ====================

  private resolvePath(path: string): string {
    // 绝对路径直接返回
    if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
      return path.replace(/\\/g, '/')
    }

    // 相对路径基于工作区解析
    const workspace = this.getWorkspacePath()
    if (workspace) {
      return `${workspace}/${path}`.replace(/\\/g, '/')
    }

    return path.replace(/\\/g, '/')
  }

  private getWorkspacePath(): string {
    return SandboxManager.getCurrentWorkspacePath() || '.'
  }

  private async simpleGlob(basePath: string, pattern: string): Promise<string[]> {
    const results: string[] = []

    // 简单的递归遍历
    const traverse = async (dir: string, depth: number = 0) => {
      if (depth > 5) return // 限制深度

      try {
        const entries = await this.listDirectory(dir)
        for (const entry of entries) {
          if (entry.type === 'directory') {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await traverse(entry.path, depth + 1)
            }
          } else {
            // 简单的模式匹配
            if (this.matchPattern(entry.name, pattern)) {
              results.push(entry.path)
            }
          }
        }
      } catch {
        // 忽略访问错误
      }
    }

    await traverse(basePath)
    return results
  }

  private matchPattern(filename: string, pattern: string): boolean {
    // 提取扩展名模式
    const extMatch = pattern.match(/\*\.(\{[^}]+\}|\w+)/)
    if (extMatch) {
      const ext = filename.split('.').pop() || ''
      const patterns = extMatch[1].replace(/[{}]/g, '').split(',')
      return patterns.some((p) => p.trim() === ext)
    }

    // 通配符匹配
    if (pattern === '*' || pattern === '**/*') {
      return true
    }

    return filename.includes(pattern.replace(/\*/g, ''))
  }
}

// ==================== 导出 ====================

export const FileSystemTools = new FileSystemToolsImpl()

export type { FileEdit, FileEntry, GrepResult, FileInfo }

export default FileSystemTools
