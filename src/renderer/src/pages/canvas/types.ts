/**
 * Canvas 协同编辑模块类型定义
 *
 * 基于 VCPChat Canvas 模块适配到 Cherry Studio
 */

/**
 * Canvas 文件信息
 */
export interface CanvasFile {
  /** 文件路径 */
  path: string
  /** 文件名 */
  name: string
  /** 文件内容 */
  content: string
  /** 语言/模式 */
  language: string
  /** 最后修改时间 */
  modifiedAt: Date
  /** 是否为活动文件 */
  isActive?: boolean
}

/**
 * Canvas 历史记录项
 */
export interface CanvasHistoryItem {
  /** 文件路径 */
  path: string
  /** 文件名 */
  name: string
  /** 创建时间 */
  createdAt: Date
  /** 最后访问时间 */
  lastAccessedAt: Date
  /** 是否为活动项 */
  isActive?: boolean
}

/**
 * Canvas 版本快照
 */
export interface CanvasVersion {
  /** 版本 ID */
  id: string
  /** 文件路径 */
  filePath: string
  /** 内容 */
  content: string
  /** 时间戳 */
  timestamp: Date
  /** 描述 */
  description?: string
  /** 内容哈希 */
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
 * Canvas 内容变更
 */
export interface CanvasChange {
  /** 变更 ID */
  id: string
  /** 文件路径 */
  path: string
  /** 变更前内容 */
  oldContent: string
  /** 变更后内容 */
  newContent: string
  /** 变更时间 */
  timestamp: Date
  /** 变更来源 */
  source: 'user' | 'ai' | 'external'
}

/**
 * Canvas 同步状态
 */
export interface CanvasSyncState {
  /** 是否同步中 */
  isSyncing: boolean
  /** 最后同步时间 */
  lastSyncedAt?: Date
  /** 待同步的变更数 */
  pendingChanges: number
  /** 连接的客户端数 */
  connectedClients: number
}

/**
 * Canvas 编辑器配置
 */
export interface CanvasEditorConfig {
  /** 主题 */
  theme: 'light' | 'dark' | 'material-darker'
  /** 是否显示行号 */
  lineNumbers: boolean
  /** 是否自动换行 */
  lineWrapping: boolean
  /** 字体大小 */
  fontSize: number
  /** Tab 大小 */
  tabSize: number
  /** 是否启用自动保存 */
  autoSave: boolean
  /** 自动保存间隔 (毫秒) */
  autoSaveInterval: number
}

/**
 * Canvas 编辑器状态
 */
export interface CanvasEditorState {
  /** 当前文件 */
  currentFile: CanvasFile | null
  /** 历史记录 */
  history: CanvasHistoryItem[]
  /** 是否有未保存的修改 */
  isDirty: boolean
  /** 编辑器配置 */
  config: CanvasEditorConfig
  /** 同步状态 */
  syncState: CanvasSyncState
}

/**
 * 语言模式映射
 */
export const LANGUAGE_MODE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'htmlmixed',
  '.htm': 'htmlmixed',
  '.json': 'javascript',
  '.md': 'markdown',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'clike',
  '.cpp': 'clike',
  '.c': 'clike',
  '.h': 'clike',
  '.cs': 'clike',
  '.swift': 'swift',
  '.kt': 'clike',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.txt': 'text'
}

/**
 * 支持的文件扩展名
 */
export const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.json',
  '.md',
  '.rs',
  '.go',
  '.java',
  '.cpp',
  '.c',
  '.h',
  '.cs',
  '.swift',
  '.kt',
  '.rb',
  '.php',
  '.sh',
  '.bash',
  '.zsh',
  '.yml',
  '.yaml',
  '.toml',
  '.xml',
  '.sql'
]

/**
 * 获取文件的语言模式
 */
export function getLanguageMode(filePath: string): string {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
  return LANGUAGE_MODE_MAP[ext] || 'text'
}

/**
 * 检查文件扩展名是否支持
 */
export function isSupportedExtension(filePath: string): boolean {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * 默认编辑器配置
 */
export const DEFAULT_EDITOR_CONFIG: CanvasEditorConfig = {
  theme: 'material-darker',
  lineNumbers: true,
  lineWrapping: false,
  fontSize: 14,
  tabSize: 2,
  autoSave: true,
  autoSaveInterval: 2000
}

/**
 * 默认同步状态
 */
export const DEFAULT_SYNC_STATE: CanvasSyncState = {
  isSyncing: false,
  pendingChanges: 0,
  connectedClients: 0
}
