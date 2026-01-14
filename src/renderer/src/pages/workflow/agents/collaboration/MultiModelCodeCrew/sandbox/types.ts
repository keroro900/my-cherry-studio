/**
 * Sandbox 类型定义
 *
 * 提供 Claude Code 风格的沙盒编程环境类型
 */

// ==================== 文件树类型 ====================

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt?: Date
  children?: FileTreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  timestamp: Date
}

// ==================== 工作区类型 ====================

export interface WorkspaceInfo {
  path: string
  name: string
  isGitRepo: boolean
  gitInfo?: GitInfo
  projectType?: ProjectType
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export interface GitInfo {
  branch: string
  remote?: string
  isDirty: boolean
  uncommittedChanges: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: Date
  }
}

export type ProjectType = 'nodejs' | 'typescript' | 'react' | 'vue' | 'python' | 'rust' | 'go' | 'java' | 'unknown'

// ==================== 权限类型 ====================

export type PermissionMode =
  | 'ask_always' // 每次操作都询问
  | 'auto_approve' // 自动批准安全操作
  | 'yolo' // 完全自动执行 (危险模式)

export type PermissionLevel = 'allow' | 'ask' | 'deny'

export interface PermissionConfig {
  mode: PermissionMode

  // 细粒度权限
  fileRead: PermissionLevel
  fileWrite: PermissionLevel
  fileDelete: PermissionLevel
  shellExecute: PermissionLevel
  networkAccess: PermissionLevel

  // 白名单
  allowedPaths: string[]
  allowedCommands: string[]

  // 黑名单
  deniedPaths: string[]
  deniedCommands: string[]

  // 危险命令模式
  dangerousPatterns: string[]
}

export type PermissionRequestType = 'file_read' | 'file_write' | 'file_delete' | 'shell_execute' | 'network'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface PermissionRequest {
  id: string
  type: PermissionRequestType
  details: {
    path?: string
    command?: string
    url?: string
    description?: string
  }
  risk: RiskLevel
  timestamp: Date
  source?: string // 请求来源 (角色名)
}

export interface PendingApproval {
  request: PermissionRequest
  onApprove: () => void
  onDeny: () => void
  onApproveAll: () => void // 批准同类操作
  onDenyAll: () => void // 拒绝同类操作
}

// ==================== 会话上下文类型 ====================

export interface FileContext {
  path: string
  content?: string
  language?: string
  isModified?: boolean
  cursorPosition?: { line: number; column: number }
}

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  createdAt: Date
  completedAt?: Date
}

export interface SessionStats {
  filesRead: number
  filesWritten: number
  filesDeleted: number
  commandsExecuted: number
  tokensUsed: number
  errorsEncountered: number
  startTime: Date
  lastActivityTime: Date
}

export interface SessionContext {
  // 工作区信息
  workspace: WorkspaceInfo | null

  // 项目指令 (类似 CLAUDE.md)
  projectInstructions: string

  // 文件上下文
  openFiles: FileContext[]
  recentFiles: string[]
  modifiedFiles: string[]

  // 任务上下文
  currentTask?: string
  todoList: TodoItem[]

  // 统计
  stats: SessionStats
}

// ==================== 工具执行类型 ====================

export interface ExecutionResult {
  success: boolean
  output?: string
  error?: string
  exitCode?: number
  duration: number
}

export interface FileEdit {
  type: 'insert' | 'replace' | 'delete'
  startLine: number
  endLine?: number
  content?: string
  oldContent?: string
}

export interface GrepResult {
  file: string
  line: number
  column: number
  content: string
  match: string
}

// ==================== 默认配置 ====================

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  mode: 'auto_approve',
  fileRead: 'allow',
  fileWrite: 'ask',
  fileDelete: 'ask',
  shellExecute: 'ask',
  networkAccess: 'ask',
  allowedPaths: [],
  allowedCommands: [
    'ls',
    'dir',
    'cat',
    'head',
    'tail',
    'grep',
    'find',
    'git status',
    'git log',
    'git diff',
    'git branch',
    'npm list',
    'yarn list',
    'pnpm list',
    'node -v',
    'npm -v',
    'yarn -v',
    'pnpm -v'
  ],
  deniedPaths: ['/etc/passwd', '/etc/shadow', 'C:\\Windows\\System32', '~/.ssh', '~/.aws', '~/.config/gcloud'],
  deniedCommands: [
    'rm -rf /',
    'rm -rf /*',
    'del /s /q C:\\',
    'format',
    'mkfs',
    'dd if=',
    'chmod -R 777 /',
    'chown -R',
    'curl | bash',
    'wget | bash',
    'sudo rm',
    'sudo dd',
    'sudo mkfs'
  ],
  dangerousPatterns: [
    'rm -rf',
    'rm -r /',
    'rm -r /*',
    'del /s /q',
    'format c:',
    'DROP DATABASE',
    'DROP TABLE',
    'DELETE FROM',
    'curl.*\\|.*sh',
    'wget.*\\|.*sh',
    '> /dev/sda',
    '> /dev/hd'
  ]
}

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#ff7a45',
  critical: '#ff4d4f'
}

export const PERMISSION_MODE_LABELS: Record<PermissionMode, { label: string; description: string; color: string }> = {
  ask_always: {
    label: '询问模式',
    description: '每次操作都会询问确认',
    color: '#1890ff'
  },
  auto_approve: {
    label: '自动模式',
    description: '安全操作自动执行，危险操作询问',
    color: '#52c41a'
  },
  yolo: {
    label: 'YOLO 模式',
    description: '完全自动执行，不询问确认 (危险)',
    color: '#ff4d4f'
  }
}
