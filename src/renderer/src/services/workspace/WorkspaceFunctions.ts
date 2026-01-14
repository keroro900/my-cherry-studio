/**
 * WorkspaceFunctions - 工作区工具函数
 *
 * 移植自 Eclipse Theia 的 workspace-functions.ts
 * 提供目录结构获取、文件内容读取、模式搜索等功能
 *
 * @license EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 * @see https://github.com/eclipse-theia/theia/blob/master/packages/ai-ide/src/browser/workspace-functions.ts
 */

// ==================== 类型定义 ====================

/**
 * 文件条目
 */
export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt?: number
}

/**
 * 目录结构选项
 */
export interface DirectoryStructureOptions {
  /** 最大深度 (默认 3) */
  maxDepth?: number
  /** 排除的目录名 */
  excludeDirs?: string[]
  /** 排除的文件模式 */
  excludePatterns?: string[]
  /** 是否包含隐藏文件 (默认 false) */
  includeHidden?: boolean
  /** 最大文件数 (默认 1000) */
  maxFiles?: number
}

/**
 * 文件搜索选项
 */
export interface FileSearchOptions {
  /** 搜索目录 */
  cwd?: string
  /** 最大结果数 (默认 100) */
  maxResults?: number
  /** 是否忽略大小写 (默认 true) */
  ignoreCase?: boolean
  /** 排除的目录名 */
  excludeDirs?: string[]
}

/**
 * 文件内容读取选项
 */
export interface ReadFileOptions {
  /** 最大读取大小 (字节，默认 1MB) */
  maxSize?: number
  /** 起始行 (从 0 开始) */
  startLine?: number
  /** 读取行数 */
  lineCount?: number
}

/**
 * 诊断信息
 */
export interface FileDiagnostic {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  source?: string
}

// ==================== 默认配置 ====================

const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'coverage',
  '.cache',
  'tmp',
  'temp'
]

const DEFAULT_EXCLUDE_PATTERNS = ['*.pyc', '*.pyo', '*.class', '*.o', '*.obj', '*.dll', '*.exe', '*.so', '*.dylib']

// ==================== 工具函数实现 ====================

/**
 * 获取目录结构
 *
 * @param rootPath 根目录路径
 * @param options 选项
 * @returns 目录结构字符串 (树形格式)
 */
export async function getDirectoryStructure(
  rootPath: string,
  options: DirectoryStructureOptions = {}
): Promise<string> {
  const {
    maxDepth = 3,
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    includeHidden = false,
    maxFiles = 1000
  } = options

  const excludeDirSet = new Set(excludeDirs.map((d) => d.toLowerCase()))
  let fileCount = 0

  const buildTree = async (dirPath: string, prefix: string = '', depth: number = 0): Promise<string> => {
    if (depth > maxDepth || fileCount >= maxFiles) {
      return ''
    }

    try {
      const entries = await listDirectorySafe(dirPath)
      if (!entries || entries.length === 0) {
        return ''
      }

      // 过滤并排序条目
      const filteredEntries = entries.filter((entry) => {
        // 排除隐藏文件
        if (!includeHidden && entry.name.startsWith('.')) {
          return false
        }
        // 排除指定目录
        if (entry.type === 'directory' && excludeDirSet.has(entry.name.toLowerCase())) {
          return false
        }
        // 排除指定文件模式
        if (entry.type === 'file' && matchesAnyPattern(entry.name, excludePatterns)) {
          return false
        }
        return true
      })

      // 目录优先，然后按名称排序
      filteredEntries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      const lines: string[] = []

      for (let i = 0; i < filteredEntries.length; i++) {
        if (fileCount >= maxFiles) {
          lines.push(`${prefix}└── ... (truncated, max ${maxFiles} files)`)
          break
        }

        const entry = filteredEntries[i]
        const isLast = i === filteredEntries.length - 1
        const connector = isLast ? '└── ' : '├── '
        const newPrefix = prefix + (isLast ? '    ' : '│   ')

        if (entry.type === 'directory') {
          lines.push(`${prefix}${connector}${entry.name}/`)
          const subTree = await buildTree(entry.path, newPrefix, depth + 1)
          if (subTree) {
            lines.push(subTree)
          }
        } else {
          fileCount++
          lines.push(`${prefix}${connector}${entry.name}`)
        }
      }

      return lines.join('\n')
    } catch {
      return ''
    }
  }

  // 获取根目录名称
  const rootName = rootPath.split(/[/\\]/).pop() || rootPath
  const tree = await buildTree(rootPath)

  return `${rootName}/\n${tree}`
}

/**
 * 读取文件内容
 *
 * @param filePath 文件路径
 * @param options 选项
 * @returns 文件内容
 */
export async function readFileContent(filePath: string, options: ReadFileOptions = {}): Promise<string> {
  const { maxSize = 1024 * 1024, startLine, lineCount } = options

  // 检查文件是否存在
  const exists = await checkFileExists(filePath)
  if (!exists) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  // 检查文件大小
  const stat = await getFileStat(filePath)
  if (stat && stat.size > maxSize) {
    throw new Error(`文件过大: ${stat.size} 字节 (最大 ${maxSize} 字节)`)
  }

  // 读取文件内容
  const content = await readTextFile(filePath)
  if (content === null) {
    throw new Error(`无法读取文件: ${filePath}`)
  }

  // 如果指定了行范围，则截取
  if (startLine !== undefined || lineCount !== undefined) {
    const lines = content.split('\n')
    const start = startLine || 0
    const count = lineCount || lines.length - start
    return lines.slice(start, start + count).join('\n')
  }

  return content
}

/**
 * 按模式搜索文件
 *
 * @param pattern Glob 模式 (如 "*.ts", "**\/*.tsx")
 * @param options 搜索选项
 * @returns 匹配的文件路径列表
 */
export async function findFilesByPattern(pattern: string, options: FileSearchOptions = {}): Promise<string[]> {
  const { cwd, maxResults = 100, ignoreCase = true, excludeDirs = DEFAULT_EXCLUDE_DIRS } = options

  const basePath = cwd || (await getCurrentWorkspacePath()) || '.'
  const excludeDirSet = new Set(excludeDirs.map((d) => d.toLowerCase()))
  const results: string[] = []

  // 解析模式
  const patternParts = parseGlobPattern(pattern)
  const regexPattern = globToRegex(patternParts.filePattern, ignoreCase)

  const search = async (dirPath: string, depth: number = 0) => {
    if (results.length >= maxResults || depth > 10) {
      return
    }

    try {
      const entries = await listDirectorySafe(dirPath)
      if (!entries) return

      for (const entry of entries) {
        if (results.length >= maxResults) break

        // 跳过隐藏文件和排除目录
        if (entry.name.startsWith('.')) continue
        if (entry.type === 'directory' && excludeDirSet.has(entry.name.toLowerCase())) continue

        if (entry.type === 'directory') {
          // 递归搜索子目录 (如果模式包含 **)
          if (patternParts.recursive || depth < patternParts.minDepth) {
            await search(entry.path, depth + 1)
          }
        } else {
          // 匹配文件名
          if (regexPattern.test(entry.name)) {
            results.push(entry.path)
          }
        }
      }
    } catch {
      // 忽略访问错误
    }
  }

  await search(basePath)
  return results
}

/**
 * 获取文件列表
 *
 * @param dirPath 目录路径
 * @param options 选项
 * @returns 文件列表
 */
export async function getFileList(
  dirPath: string,
  options: { recursive?: boolean; maxFiles?: number } = {}
): Promise<FileEntry[]> {
  const { recursive = false, maxFiles = 500 } = options
  const results: FileEntry[] = []

  const collect = async (path: string, depth: number = 0) => {
    if (results.length >= maxFiles || depth > 5) return

    try {
      const entries = await listDirectorySafe(path)
      if (!entries) return

      for (const entry of entries) {
        if (results.length >= maxFiles) break

        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.')) continue
        if (entry.type === 'directory' && isExcludedDir(entry.name)) continue

        results.push(entry)

        if (recursive && entry.type === 'directory') {
          await collect(entry.path, depth + 1)
        }
      }
    } catch {
      // 忽略访问错误
    }
  }

  await collect(dirPath)
  return results
}

/**
 * 搜索文件内容 (grep)
 *
 * @param searchPattern 搜索模式 (正则表达式)
 * @param options 搜索选项
 * @returns 匹配结果
 */
export async function searchInFiles(
  searchPattern: string,
  options: FileSearchOptions & { filePattern?: string } = {}
): Promise<Array<{ file: string; line: number; content: string; match: string }>> {
  const { cwd, maxResults = 100, ignoreCase = true, filePattern = '**/*.{ts,tsx,js,jsx,json,md}' } = options

  // 先找到所有匹配的文件
  const files = await findFilesByPattern(filePattern, { cwd, maxResults: 50, ignoreCase })

  const regex = new RegExp(searchPattern, ignoreCase ? 'gi' : 'g')
  const results: Array<{ file: string; line: number; content: string; match: string }> = []

  for (const file of files) {
    if (results.length >= maxResults) break

    try {
      const content = await readTextFile(file)
      if (!content) continue

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break

        const line = lines[i]
        const matches = line.match(regex)
        if (matches) {
          results.push({
            file,
            line: i + 1,
            content: line.trim().substring(0, 200),
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

// ==================== 内部辅助函数 ====================

/**
 * 安全列出目录内容
 */
async function listDirectorySafe(dirPath: string): Promise<FileEntry[] | null> {
  try {
    if (window.api?.file?.listDirectory) {
      const entries = await window.api.file.listDirectory(dirPath, {
        includeFiles: true,
        includeDirectories: true,
        maxDepth: 1
      })
      if (Array.isArray(entries)) {
        return entries.map(
          (entry: { name: string; path?: string; isDirectory?: boolean; size?: number; mtime?: number }) => ({
            name: entry.name,
            path: entry.path || `${dirPath}/${entry.name}`.replace(/\\/g, '/'),
            type: (entry.isDirectory ? 'directory' : 'file') as 'file' | 'directory',
            size: entry.size,
            modifiedAt: entry.mtime
          })
        )
      }
    }
  } catch {
    // 忽略错误
  }
  return null
}

/**
 * 安全读取文本文件
 */
async function readTextFile(filePath: string): Promise<string | null> {
  try {
    if (window.api?.fs?.readText) {
      return await window.api.fs.readText(filePath)
    }
  } catch {
    // 忽略错误
  }
  return null
}

/**
 * 检查文件是否存在
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    if (window.api?.fs?.exists) {
      return await window.api.fs.exists(filePath)
    }
  } catch {
    // 忽略错误
  }
  return false
}

/**
 * 获取文件信息
 */
async function getFileStat(filePath: string): Promise<{ size: number; isDirectory: boolean; isFile: boolean } | null> {
  try {
    if (window.api?.fs?.stat) {
      return await window.api.fs.stat(filePath)
    }
  } catch {
    // 忽略错误
  }
  return null
}

/**
 * 获取当前工作区路径
 */
async function getCurrentWorkspacePath(): Promise<string | null> {
  // 尝试从 Redux store 获取
  // 这里返回 null，由调用者提供路径
  return null
}

/**
 * 检查是否是排除的目录
 */
function isExcludedDir(name: string): boolean {
  const excludedDirs = new Set(DEFAULT_EXCLUDE_DIRS.map((d) => d.toLowerCase()))
  return excludedDirs.has(name.toLowerCase())
}

/**
 * 检查文件名是否匹配任一模式
 */
function matchesAnyPattern(filename: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlobPattern(filename, pattern)) {
      return true
    }
  }
  return false
}

/**
 * 简单的 glob 模式匹配
 */
function matchGlobPattern(filename: string, pattern: string): boolean {
  // 将 glob 模式转换为正则表达式
  const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')
  const regex = new RegExp(`^${regexStr}$`, 'i')
  return regex.test(filename)
}

/**
 * 解析 glob 模式
 */
function parseGlobPattern(pattern: string): { filePattern: string; recursive: boolean; minDepth: number } {
  const recursive = pattern.includes('**')
  const parts = pattern.split(/[/\\]/)
  const filePattern = parts[parts.length - 1]
  const minDepth = parts.filter((p) => p && p !== '**').length - 1

  return { filePattern, recursive, minDepth: Math.max(0, minDepth) }
}

/**
 * 将 glob 文件模式转换为正则表达式
 */
function globToRegex(pattern: string, ignoreCase: boolean = true): RegExp {
  // 处理 {a,b,c} 形式的选择
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{([^}]+)\\\}/g, (_, group) => `(${group.split(',').join('|')})`)
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp(`^${regexStr}$`, ignoreCase ? 'i' : '')
}

// ==================== 导出 ====================

export const WorkspaceFunctions = {
  getDirectoryStructure,
  readFileContent,
  findFilesByPattern,
  getFileList,
  searchInFiles
}

export default WorkspaceFunctions
