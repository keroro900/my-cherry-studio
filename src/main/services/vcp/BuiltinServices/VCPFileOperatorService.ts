/**
 * VCPFileOperatorService - VCP 文件操作服务
 *
 * 统一文件操作服务，提供：
 * - 全局文件读取（任意路径，含富格式解析）
 * - 受控文件写入（ALLOWED_DIRECTORIES）
 * - 文件管理（复制、移动、重命名、删除）
 * - 目录操作（列表、创建）
 * - 网络文件（读取、下载）
 * - Canvas 协同编辑器
 *
 * 替代 MCP Filesystem，提供更完整的 VCPToolBox FileOperator 功能
 */

import { loggerService } from '@logger'
import { app, BrowserWindow } from 'electron'
import { createReadStream } from 'fs'
import * as fs from 'fs/promises'
import * as http from 'http'
import * as https from 'https'
import * as path from 'path'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'
import { fileOperatorConfig } from './VCPFileOperatorConfig'

const logger = loggerService.withContext('VCPFileOperatorService')

/**
 * 支持的富文本格式
 */
const RICH_TEXT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

export class VCPFileOperatorService implements IBuiltinService {
  name = 'FileOperator'
  displayName = '文件管理器'
  description = '强大的文件管理服务，支持读取任意文件（含富格式）、受控写入、目录管理、网络文件操作'
  version = '2.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'file_system'

  documentation = `
# FileOperator 文件管理器

## 功能概述
FileOperator 是一个功能完整的文件管理服务，对标 VCPToolBox 的 FileOperator.js。

## 权限模型
- **读取**: 全局（任意路径），支持富格式（PDF、Word、图片等）
- **写入**: 仅限允许目录（ALLOWED_DIRECTORIES）
- **系统保护**: Windows/Program Files 等系统路径不可写入

## 命令列表

### 读取操作
- \`ReadFile\` - 读取文件内容（支持富格式）
- \`ListDirectory\` - 列出目录内容
- \`FileInfo\` - 获取文件元数据
- \`ListAllowedDirectories\` - 列出允许写入的目录

### 写入操作
- \`WriteFile\` - 写入文件（同名自动重命名）
- \`EditFile\` - 编辑文件（覆盖）
- \`AppendFile\` - 追加文件内容
- \`ApplyDiff\` - 差异替换

### 文件管理
- \`CopyFile\` - 复制文件
- \`MoveFile\` - 移动文件
- \`RenameFile\` - 重命名文件
- \`DeleteFile\` - 删除文件
- \`CreateDirectory\` - 创建目录

### 网络操作
- \`WebReadFile\` - 读取网络文件
- \`DownloadFile\` - 下载文件到本地

### 高级功能
- \`CreateCanvas\` - 创建 Canvas 协同编辑器
  `

  systemPrompt = `你可以使用 FileOperator 服务管理文件。
- 读取任意文件：command=ReadFile，支持 PDF、Word、图片等
- 写入文件需要在允许目录内，先用 ListAllowedDirectories 查看
- 支持批量操作：command1, command2... 格式`

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ListAllowedDirectories',
      description: '列出允许写入的目录',
      example: 'command:「始」ListAllowedDirectories「末」'
    },
    {
      commandIdentifier: 'ReadFile',
      description: '读取文件内容，支持富格式（PDF、Word、图片等）',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' }
      ],
      example: 'command:「始」ReadFile「末」,\nfilePath:「始」/path/to/file.pdf「末」'
    },
    {
      commandIdentifier: 'WriteFile',
      description: '写入文件（同名文件自动重命名）',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' },
        { name: 'content', description: '文件内容', required: true, type: 'string' }
      ],
      example: 'command:「始」WriteFile「末」,\nfilePath:「始」/path/to/file.txt「末」,\ncontent:「始」内容「末」'
    },
    {
      commandIdentifier: 'EditFile',
      description: '编辑文件（覆盖已有内容）',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' },
        { name: 'content', description: '新内容', required: true, type: 'string' }
      ],
      example: 'command:「始」EditFile「末」,\nfilePath:「始」/path/to/file.txt「末」,\ncontent:「始」新内容「末」'
    },
    {
      commandIdentifier: 'AppendFile',
      description: '追加内容到文件末尾',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' },
        { name: 'content', description: '追加内容', required: true, type: 'string' }
      ],
      example: 'command:「始」AppendFile「末」,\nfilePath:「始」/path/to/log.txt「末」,\ncontent:「始」追加内容「末」'
    },
    {
      commandIdentifier: 'ApplyDiff',
      description: '差异替换（搜索并替换）',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' },
        { name: 'searchString', description: '搜索内容', required: true, type: 'string' },
        { name: 'replaceString', description: '替换内容', required: true, type: 'string' }
      ],
      example: 'command:「始」ApplyDiff「末」,\nfilePath:「始」/path/to/file.txt「末」,\nsearchString:「始」旧内容「末」,\nreplaceString:「始」新内容「末」'
    },
    {
      commandIdentifier: 'ListDirectory',
      description: '列出目录内容',
      parameters: [
        { name: 'directoryPath', description: '目录路径', required: true, type: 'string' },
        { name: 'showHidden', description: '是否显示隐藏文件', required: false, type: 'boolean', default: false }
      ],
      example: 'command:「始」ListDirectory「末」,\ndirectoryPath:「始」/path/to/dir「末」'
    },
    {
      commandIdentifier: 'FileInfo',
      description: '获取文件元数据',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' }
      ],
      example: 'command:「始」FileInfo「末」,\nfilePath:「始」/path/to/file.txt「末」'
    },
    {
      commandIdentifier: 'CopyFile',
      description: '复制文件',
      parameters: [
        { name: 'sourcePath', description: '源文件路径', required: true, type: 'string' },
        { name: 'destinationPath', description: '目标路径', required: true, type: 'string' }
      ],
      example: 'command:「始」CopyFile「末」,\nsourcePath:「始」/path/source.txt「末」,\ndestinationPath:「始」/path/dest.txt「末」'
    },
    {
      commandIdentifier: 'MoveFile',
      description: '移动文件',
      parameters: [
        { name: 'sourcePath', description: '源文件路径', required: true, type: 'string' },
        { name: 'destinationPath', description: '目标路径', required: true, type: 'string' }
      ],
      example: 'command:「始」MoveFile「末」,\nsourcePath:「始」/path/source.txt「末」,\ndestinationPath:「始」/path/new/source.txt「末」'
    },
    {
      commandIdentifier: 'RenameFile',
      description: '重命名文件',
      parameters: [
        { name: 'sourcePath', description: '原文件路径', required: true, type: 'string' },
        { name: 'destinationPath', description: '新文件路径', required: true, type: 'string' }
      ],
      example: 'command:「始」RenameFile「末」,\nsourcePath:「始」/path/old.txt「末」,\ndestinationPath:「始」/path/new.txt「末」'
    },
    {
      commandIdentifier: 'DeleteFile',
      description: '删除文件',
      parameters: [
        { name: 'filePath', description: '文件路径', required: true, type: 'string' }
      ],
      example: 'command:「始」DeleteFile「末」,\nfilePath:「始」/path/to/delete.txt「末」'
    },
    {
      commandIdentifier: 'CreateDirectory',
      description: '创建目录',
      parameters: [
        { name: 'directoryPath', description: '目录路径', required: true, type: 'string' }
      ],
      example: 'command:「始」CreateDirectory「末」,\ndirectoryPath:「始」/path/to/new/folder「末」'
    },
    {
      commandIdentifier: 'WebReadFile',
      description: '读取网络文件',
      parameters: [
        { name: 'url', description: 'URL 地址', required: true, type: 'string' }
      ],
      example: 'command:「始」WebReadFile「末」,\nurl:「始」https://example.com/file.txt「末」'
    },
    {
      commandIdentifier: 'DownloadFile',
      description: '下载文件到本地',
      parameters: [
        { name: 'url', description: 'URL 地址', required: true, type: 'string' },
        { name: 'savePath', description: '保存路径（可选，默认下载目录）', required: false, type: 'string' }
      ],
      example: 'command:「始」DownloadFile「末」,\nurl:「始」https://example.com/file.zip「末」'
    },
    {
      commandIdentifier: 'CreateCanvas',
      description: '创建 Canvas 协同编辑器窗口',
      parameters: [
        { name: 'fileName', description: '文件名', required: true, type: 'string' },
        { name: 'content', description: '初始内容', required: false, type: 'string' }
      ],
      example: 'command:「始」CreateCanvas「末」,\nfileName:「始」script.js「末」,\ncontent:「始」console.log("Hello")「末」'
    }
  ]

  async initialize(): Promise<void> {
    await fileOperatorConfig.initialize()
    logger.info('VCPFileOperatorService initialized')
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      let result: BuiltinServiceResult

      switch (command) {
        case 'ListAllowedDirectories':
          result = await this.listAllowedDirectories()
          break
        case 'ReadFile':
          result = await this.readFile(params.filePath as string)
          break
        case 'WriteFile':
          result = await this.writeFile(params.filePath as string, params.content as string)
          break
        case 'EditFile':
          result = await this.editFile(params.filePath as string, params.content as string)
          break
        case 'AppendFile':
          result = await this.appendFile(params.filePath as string, params.content as string)
          break
        case 'ApplyDiff':
          result = await this.applyDiff(
            params.filePath as string,
            params.searchString as string,
            params.replaceString as string
          )
          break
        case 'ListDirectory':
          result = await this.listDirectory(
            params.directoryPath as string,
            params.showHidden as boolean
          )
          break
        case 'FileInfo':
          result = await this.fileInfo(params.filePath as string)
          break
        case 'CopyFile':
          result = await this.copyFile(
            params.sourcePath as string,
            params.destinationPath as string
          )
          break
        case 'MoveFile':
          result = await this.moveFile(
            params.sourcePath as string,
            params.destinationPath as string
          )
          break
        case 'RenameFile':
          result = await this.renameFile(
            params.sourcePath as string,
            params.destinationPath as string
          )
          break
        case 'DeleteFile':
          result = await this.deleteFile(params.filePath as string)
          break
        case 'CreateDirectory':
          result = await this.createDirectory(params.directoryPath as string)
          break
        case 'WebReadFile':
          result = await this.webReadFile(params.url as string)
          break
        case 'DownloadFile':
          result = await this.downloadFile(params.url as string, params.savePath as string)
          break
        case 'CreateCanvas':
          result = await this.createCanvas(params.fileName as string, params.content as string)
          break
        default:
          result = {
            success: false,
            error: `未知命令: ${command}。可用命令: ListAllowedDirectories, ReadFile, WriteFile, EditFile, AppendFile, ApplyDiff, ListDirectory, FileInfo, CopyFile, MoveFile, RenameFile, DeleteFile, CreateDirectory, WebReadFile, DownloadFile, CreateCanvas。\n\n调用格式: tool_name:「始」FileOperator「末」, command:「始」命令名称「末」`
          }
      }

      return {
        ...result,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error(`FileOperator command failed: ${command}`, error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 读取操作 ====================

  private async listAllowedDirectories(): Promise<BuiltinServiceResult> {
    const dirs = fileOperatorConfig.getAllowedDirectories()
    return {
      success: true,
      output: `允许写入的目录：\n${dirs.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
      data: dirs
    }
  }

  private async readFile(filePath: string): Promise<BuiltinServiceResult> {
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'read')
    const ext = path.extname(absPath).toLowerCase()

    // 检查文件是否存在
    try {
      await fs.access(absPath)
    } catch {
      return { success: false, error: `File not found: ${absPath}` }
    }

    // 富格式文件处理
    if (RICH_TEXT_EXTENSIONS.includes(ext)) {
      return this.readRichTextFile(absPath, ext)
    }

    // 图片文件处理
    if (IMAGE_EXTENSIONS.includes(ext)) {
      return this.readImageFile(absPath)
    }

    // 普通文本文件
    try {
      const content = await fs.readFile(absPath, 'utf-8')
      const stats = await fs.stat(absPath)

      return {
        success: true,
        output: content,
        data: {
          path: absPath,
          size: stats.size,
          lines: content.split('\n').length
        }
      }
    } catch (error) {
      return { success: false, error: `Failed to read file: ${error}` }
    }
  }

  private async readRichTextFile(filePath: string, ext: string): Promise<BuiltinServiceResult> {
    // 尝试使用 pdf-parse 或 mammoth 等库
    // 目前返回基本信息
    try {
      const stats = await fs.stat(filePath)

      // PDF 处理
      if (ext === '.pdf') {
        try {
          const pdfParse = await import('pdf-parse')
          const dataBuffer = await fs.readFile(filePath)
          const data = await pdfParse.default(dataBuffer)

          return {
            success: true,
            output: data.text,
            data: {
              path: filePath,
              type: 'pdf',
              pages: data.numpages,
              info: data.info
            }
          }
        } catch {
          return {
            success: true,
            output: `[PDF 文件] ${filePath}\n大小: ${this.formatSize(stats.size)}\n注: 需要安装 pdf-parse 模块以读取内容`,
            data: { path: filePath, type: 'pdf', size: stats.size }
          }
        }
      }

      // Word 处理
      if (ext === '.docx') {
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ path: filePath })

          return {
            success: true,
            output: result.value,
            data: { path: filePath, type: 'docx' }
          }
        } catch {
          return {
            success: true,
            output: `[Word 文件] ${filePath}\n大小: ${this.formatSize(stats.size)}\n注: 需要安装 mammoth 模块以读取内容`,
            data: { path: filePath, type: 'docx', size: stats.size }
          }
        }
      }

      return {
        success: true,
        output: `[${ext.toUpperCase()} 文件] ${filePath}\n大小: ${this.formatSize(stats.size)}`,
        data: { path: filePath, type: ext, size: stats.size }
      }
    } catch (error) {
      return { success: false, error: `Failed to read rich text file: ${error}` }
    }
  }

  private async readImageFile(filePath: string): Promise<BuiltinServiceResult> {
    try {
      const stats = await fs.stat(filePath)
      const buffer = await fs.readFile(filePath)
      const base64 = buffer.toString('base64')
      const ext = path.extname(filePath).toLowerCase().slice(1)
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

      return {
        success: true,
        output: `[图片] ${filePath}\n大小: ${this.formatSize(stats.size)}\n格式: ${ext.toUpperCase()}`,
        data: {
          path: filePath,
          type: 'image',
          format: ext,
          size: stats.size,
          base64: `data:${mimeType};base64,${base64}`
        }
      }
    } catch (error) {
      return { success: false, error: `Failed to read image: ${error}` }
    }
  }

  // ==================== 写入操作 ====================

  private async writeFile(filePath: string, content: string): Promise<BuiltinServiceResult> {
    if (!filePath || content === undefined) {
      return { success: false, error: 'filePath and content are required' }
    }

    let absPath = fileOperatorConfig.validatePath(filePath, 'write')

    // 同名文件自动重命名
    try {
      await fs.access(absPath)
      // 文件存在，生成新名称
      const dir = path.dirname(absPath)
      const ext = path.extname(absPath)
      const baseName = path.basename(absPath, ext)
      let counter = 1

      while (true) {
        const newName = `${baseName}_${counter}${ext}`
        const newPath = path.join(dir, newName)
        try {
          await fs.access(newPath)
          counter++
        } catch {
          absPath = newPath
          break
        }
      }
    } catch {
      // 文件不存在，使用原路径
    }

    // 确保目录存在
    await fs.mkdir(path.dirname(absPath), { recursive: true })

    await fs.writeFile(absPath, content, 'utf-8')

    logger.info('File written', { path: absPath, size: content.length })

    return {
      success: true,
      output: `文件已创建: ${absPath}\n大小: ${content.length} 字节`,
      data: { path: absPath, size: content.length }
    }
  }

  private async editFile(filePath: string, content: string): Promise<BuiltinServiceResult> {
    if (!filePath || content === undefined) {
      return { success: false, error: 'filePath and content are required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'write')

    // 确保目录存在
    await fs.mkdir(path.dirname(absPath), { recursive: true })

    await fs.writeFile(absPath, content, 'utf-8')

    logger.info('File edited', { path: absPath, size: content.length })

    return {
      success: true,
      output: `文件已更新: ${absPath}\n大小: ${content.length} 字节`,
      data: { path: absPath, size: content.length }
    }
  }

  private async appendFile(filePath: string, content: string): Promise<BuiltinServiceResult> {
    if (!filePath || content === undefined) {
      return { success: false, error: 'filePath and content are required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'write')

    await fs.appendFile(absPath, content, 'utf-8')

    const stats = await fs.stat(absPath)
    logger.info('File appended', { path: absPath, appendedSize: content.length })

    return {
      success: true,
      output: `内容已追加到: ${absPath}\n追加: ${content.length} 字节\n总大小: ${stats.size} 字节`,
      data: { path: absPath, appendedSize: content.length, totalSize: stats.size }
    }
  }

  private async applyDiff(
    filePath: string,
    searchString: string,
    replaceString: string
  ): Promise<BuiltinServiceResult> {
    if (!filePath || !searchString || replaceString === undefined) {
      return { success: false, error: 'filePath, searchString, and replaceString are required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'write')

    let content: string
    try {
      content = await fs.readFile(absPath, 'utf-8')
    } catch {
      return { success: false, error: `File not found: ${absPath}` }
    }

    if (!content.includes(searchString)) {
      return { success: false, error: `Search string not found in file` }
    }

    const newContent = content.replace(searchString, replaceString)
    await fs.writeFile(absPath, newContent, 'utf-8')

    const replacements = (content.match(new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length

    logger.info('Diff applied', { path: absPath, replacements })

    return {
      success: true,
      output: `差异已应用: ${absPath}\n替换次数: ${replacements}`,
      data: { path: absPath, replacements }
    }
  }

  // ==================== 目录操作 ====================

  private async listDirectory(
    directoryPath: string,
    showHidden: boolean = false
  ): Promise<BuiltinServiceResult> {
    if (!directoryPath) {
      return { success: false, error: 'directoryPath is required' }
    }

    const absPath = fileOperatorConfig.validatePath(directoryPath, 'read')

    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true })
      const items: Array<{ name: string; type: string; size?: number }> = []

      for (const entry of entries) {
        if (!showHidden && entry.name.startsWith('.')) continue

        const itemPath = path.join(absPath, entry.name)
        const item: { name: string; type: string; size?: number } = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file'
        }

        if (entry.isFile()) {
          try {
            const stats = await fs.stat(itemPath)
            item.size = stats.size
          } catch {
            // 忽略无法读取的文件
          }
        }

        items.push(item)
      }

      const output = items
        .map((i) => {
          const sizeStr = i.size !== undefined ? ` (${this.formatSize(i.size)})` : ''
          const typeIcon = i.type === 'directory' ? '📁' : '📄'
          return `${typeIcon} ${i.name}${sizeStr}`
        })
        .join('\n')

      return {
        success: true,
        output: `目录: ${absPath}\n${'─'.repeat(40)}\n${output || '(空目录)'}`,
        data: { path: absPath, items }
      }
    } catch (error) {
      return { success: false, error: `Failed to list directory: ${error}` }
    }
  }

  private async fileInfo(filePath: string): Promise<BuiltinServiceResult> {
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'read')

    try {
      const stats = await fs.stat(absPath)

      const info = {
        path: absPath,
        name: path.basename(absPath),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString()
      }

      const output = [
        `文件: ${info.name}`,
        `路径: ${info.path}`,
        `类型: ${info.isDirectory ? '目录' : '文件'}`,
        `大小: ${this.formatSize(info.size)}`,
        `创建时间: ${info.created}`,
        `修改时间: ${info.modified}`,
        `访问时间: ${info.accessed}`
      ].join('\n')

      return { success: true, output, data: info }
    } catch (error) {
      return { success: false, error: `Failed to get file info: ${error}` }
    }
  }

  private async createDirectory(directoryPath: string): Promise<BuiltinServiceResult> {
    if (!directoryPath) {
      return { success: false, error: 'directoryPath is required' }
    }

    const absPath = fileOperatorConfig.validatePath(directoryPath, 'write')

    await fs.mkdir(absPath, { recursive: true })

    logger.info('Directory created', { path: absPath })

    return {
      success: true,
      output: `目录已创建: ${absPath}`,
      data: { path: absPath }
    }
  }

  // ==================== 文件管理 ====================

  private async copyFile(sourcePath: string, destinationPath: string): Promise<BuiltinServiceResult> {
    if (!sourcePath || !destinationPath) {
      return { success: false, error: 'sourcePath and destinationPath are required' }
    }

    const srcPath = fileOperatorConfig.validatePath(sourcePath, 'read')
    const destPath = fileOperatorConfig.validatePath(destinationPath, 'write')

    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.copyFile(srcPath, destPath)

    logger.info('File copied', { from: srcPath, to: destPath })

    return {
      success: true,
      output: `文件已复制:\n从: ${srcPath}\n到: ${destPath}`,
      data: { sourcePath: srcPath, destinationPath: destPath }
    }
  }

  private async moveFile(sourcePath: string, destinationPath: string): Promise<BuiltinServiceResult> {
    if (!sourcePath || !destinationPath) {
      return { success: false, error: 'sourcePath and destinationPath are required' }
    }

    const srcPath = fileOperatorConfig.validatePath(sourcePath, 'write') // 源也需要写权限（删除）
    const destPath = fileOperatorConfig.validatePath(destinationPath, 'write')

    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.rename(srcPath, destPath)

    logger.info('File moved', { from: srcPath, to: destPath })

    return {
      success: true,
      output: `文件已移动:\n从: ${srcPath}\n到: ${destPath}`,
      data: { sourcePath: srcPath, destinationPath: destPath }
    }
  }

  private async renameFile(sourcePath: string, destinationPath: string): Promise<BuiltinServiceResult> {
    // 重命名本质上是移动
    return this.moveFile(sourcePath, destinationPath)
  }

  private async deleteFile(filePath: string): Promise<BuiltinServiceResult> {
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }

    const absPath = fileOperatorConfig.validatePath(filePath, 'delete')

    const stats = await fs.stat(absPath)
    if (stats.isDirectory()) {
      await fs.rm(absPath, { recursive: true })
    } else {
      await fs.unlink(absPath)
    }

    logger.info('File deleted', { path: absPath })

    return {
      success: true,
      output: `已删除: ${absPath}`,
      data: { path: absPath }
    }
  }

  // ==================== 网络操作 ====================

  private async webReadFile(url: string): Promise<BuiltinServiceResult> {
    if (!url) {
      return { success: false, error: 'url is required' }
    }

    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http

      protocol
        .get(url, (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            resolve({
              success: true,
              output: data,
              data: {
                url,
                contentType: res.headers['content-type'],
                size: data.length
              }
            })
          })
        })
        .on('error', (error) => {
          resolve({ success: false, error: `Failed to fetch URL: ${error.message}` })
        })
    })
  }

  private async downloadFile(url: string, savePath?: string): Promise<BuiltinServiceResult> {
    if (!url) {
      return { success: false, error: 'url is required' }
    }

    // 默认保存路径
    const fileName = path.basename(new URL(url).pathname) || 'downloaded_file'
    const downloadDir = path.join(app.getPath('userData'), 'Data', 'Downloads')
    const finalPath = savePath
      ? fileOperatorConfig.validatePath(savePath, 'write')
      : path.join(downloadDir, fileName)

    await fs.mkdir(path.dirname(finalPath), { recursive: true })

    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http
      const file = createReadStream(finalPath)

      protocol
        .get(url, (res) => {
          const writeStream = require('fs').createWriteStream(finalPath)
          res.pipe(writeStream)

          writeStream.on('finish', async () => {
            writeStream.close()
            const stats = await fs.stat(finalPath)
            logger.info('File downloaded', { url, path: finalPath, size: stats.size })

            resolve({
              success: true,
              output: `文件已下载:\n路径: ${finalPath}\n大小: ${this.formatSize(stats.size)}`,
              data: { url, path: finalPath, size: stats.size }
            })
          })

          writeStream.on('error', (error: Error) => {
            resolve({ success: false, error: `Failed to save file: ${error.message}` })
          })
        })
        .on('error', (error) => {
          resolve({ success: false, error: `Failed to download: ${error.message}` })
        })
    })
  }

  // ==================== Canvas ====================

  private async createCanvas(fileName: string, content?: string): Promise<BuiltinServiceResult> {
    if (!fileName) {
      return { success: false, error: 'fileName is required' }
    }

    if (!fileOperatorConfig.isCanvasEnabled()) {
      return { success: false, error: 'Canvas feature is disabled' }
    }

    // 创建 Canvas 文件
    const canvasDir = path.join(app.getPath('userData'), 'Data', 'Canvas')
    await fs.mkdir(canvasDir, { recursive: true })

    const filePath = path.join(canvasDir, fileName)
    await fs.writeFile(filePath, content || '', 'utf-8')

    // 打开 Canvas 编辑器窗口
    const ext = path.extname(fileName).toLowerCase()
    const isCode = ['.js', '.ts', '.py', '.html', '.css', '.json', '.md'].includes(ext)

    const canvasWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      title: `Canvas: ${fileName}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 加载简单的编辑器页面
    const editorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Canvas: ${fileName}</title>
        <style>
          body { margin: 0; padding: 0; font-family: monospace; }
          #editor { width: 100%; height: 100vh; padding: 16px; box-sizing: border-box; }
          textarea { width: 100%; height: calc(100% - 40px); font-family: monospace; font-size: 14px; }
          .toolbar { padding: 8px; background: #f0f0f0; }
          button { margin-right: 8px; }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="save()">保存</button>
          <span>Canvas: ${fileName}</span>
        </div>
        <textarea id="content">${(content || '').replace(/</g, '&lt;')}</textarea>
        <script>
          const filePath = ${JSON.stringify(filePath)};
          function save() {
            // 通过 IPC 保存文件
            alert('文件保存功能需要通过 preload 脚本实现');
          }
        </script>
      </body>
      </html>
    `

    canvasWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(editorHtml)}`)

    logger.info('Canvas created', { fileName, path: filePath })

    return {
      success: true,
      output: `Canvas 已创建: ${fileName}\n路径: ${filePath}\n编辑器窗口已打开`,
      data: { fileName, path: filePath }
    }
  }

  // ==================== 工具方法 ====================

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  async shutdown(): Promise<void> {
    logger.info('VCPFileOperatorService shutdown')
  }
}
