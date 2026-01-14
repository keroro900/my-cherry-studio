/**
 * ToolPermissionManager - 工具权限管理器
 *
 * 管理 AI Agent 工具的执行权限：
 * - 自动批准安全操作
 * - 危险操作需要确认
 * - 用户自定义权限级别
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('ToolPermissionManager')

// ==================== 类型定义 ====================

/** 权限级别 */
export type PermissionLevel = 'always' | 'ask' | 'never'

/** 工具分类 */
export type ToolCategory = 'read' | 'write' | 'execute' | 'git' | 'system'

/** 工具权限配置 */
export interface ToolPermission {
  tool: string
  category: ToolCategory
  permissionLevel: PermissionLevel
  description: string
  isDangerous: boolean
}

/** 权限请求 */
export interface PermissionRequest {
  toolName: string
  arguments: Record<string, unknown>
  reason?: string
}

/** 权限决策 */
export interface PermissionDecision {
  allowed: boolean
  reason?: string
  autoApproved?: boolean
}

/** 用户自定义权限 */
export interface UserPermissionSettings {
  autoApproveReads: boolean
  autoApproveWrites: boolean
  autoApproveExecute: boolean
  autoApproveGit: boolean
  trustWorkingDirectory: boolean
  customPermissions: Record<string, PermissionLevel>
}

// ==================== 默认权限配置 ====================

const DEFAULT_TOOL_PERMISSIONS: ToolPermission[] = [
  // 读取操作 - 默认安全
  { tool: 'read_file', category: 'read', permissionLevel: 'always', description: '读取文件内容', isDangerous: false },
  { tool: 'list_directory', category: 'read', permissionLevel: 'always', description: '列出目录内容', isDangerous: false },
  { tool: 'search_files', category: 'read', permissionLevel: 'always', description: '搜索文件', isDangerous: false },
  { tool: 'grep_search', category: 'read', permissionLevel: 'always', description: '搜索文件内容', isDangerous: false },

  // 写入操作 - 需要确认
  { tool: 'write_file', category: 'write', permissionLevel: 'ask', description: '写入文件', isDangerous: true },
  { tool: 'edit_file', category: 'write', permissionLevel: 'ask', description: '编辑文件', isDangerous: true },
  { tool: 'insert_code', category: 'write', permissionLevel: 'ask', description: '插入代码', isDangerous: true },
  { tool: 'create_file', category: 'write', permissionLevel: 'ask', description: '创建新文件', isDangerous: true },
  { tool: 'delete_file', category: 'write', permissionLevel: 'ask', description: '删除文件', isDangerous: true },
  { tool: 'move_file', category: 'write', permissionLevel: 'ask', description: '移动/重命名文件', isDangerous: true },
  { tool: 'multi_edit', category: 'write', permissionLevel: 'ask', description: '批量编辑文件', isDangerous: true },

  // 执行操作 - 需要确认
  { tool: 'execute_command', category: 'execute', permissionLevel: 'ask', description: '执行 Shell 命令', isDangerous: true },
  { tool: 'run_code', category: 'execute', permissionLevel: 'ask', description: '运行代码片段', isDangerous: true },

  // Git 操作 - 根据类型
  { tool: 'git_status', category: 'git', permissionLevel: 'always', description: '查看 Git 状态', isDangerous: false },
  { tool: 'git_diff', category: 'git', permissionLevel: 'always', description: '查看 Git 差异', isDangerous: false },
  { tool: 'git_log', category: 'git', permissionLevel: 'always', description: '查看 Git 日志', isDangerous: false },
  { tool: 'git_branch', category: 'git', permissionLevel: 'always', description: '查看 Git 分支', isDangerous: false },
  { tool: 'git_add', category: 'git', permissionLevel: 'ask', description: '暂存文件', isDangerous: false },
  { tool: 'git_commit', category: 'git', permissionLevel: 'ask', description: '提交更改', isDangerous: true },
  { tool: 'git_reset', category: 'git', permissionLevel: 'ask', description: '重置更改', isDangerous: true }
]

// ==================== 默认用户设置 ====================

const DEFAULT_USER_SETTINGS: UserPermissionSettings = {
  autoApproveReads: true,
  autoApproveWrites: false,
  autoApproveExecute: false,
  autoApproveGit: false,
  trustWorkingDirectory: true,
  customPermissions: {}
}

// ==================== 权限管理器类 ====================

class ToolPermissionManager {
  private toolPermissions: Map<string, ToolPermission>
  private userSettings: UserPermissionSettings
  private onPermissionRequest?: (request: PermissionRequest) => Promise<boolean>

  constructor() {
    this.toolPermissions = new Map()
    this.userSettings = { ...DEFAULT_USER_SETTINGS }

    // 初始化默认权限
    DEFAULT_TOOL_PERMISSIONS.forEach((perm) => {
      this.toolPermissions.set(perm.tool, perm)
    })

    // 从 localStorage 加载用户设置
    this.loadSettings()

    logger.info('ToolPermissionManager initialized')
  }

  /**
   * 设置权限请求回调
   */
  setPermissionRequestHandler(handler: (request: PermissionRequest) => Promise<boolean>) {
    this.onPermissionRequest = handler
  }

  /**
   * 检查工具权限
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionDecision> {
    const { toolName, arguments: args } = request

    // 获取工具权限配置
    const toolPerm = this.toolPermissions.get(toolName)

    // 未知工具默认需要询问
    if (!toolPerm) {
      logger.warn('Unknown tool, requiring permission', { toolName })
      return this.askUserPermission(request)
    }

    // 检查用户自定义权限
    const customLevel = this.userSettings.customPermissions[toolName]
    const effectiveLevel = customLevel || toolPerm.permissionLevel

    // 根据权限级别决策
    switch (effectiveLevel) {
      case 'always':
        return { allowed: true, autoApproved: true, reason: 'Auto-approved by policy' }

      case 'never':
        return { allowed: false, reason: 'Blocked by policy' }

      case 'ask':
        // 检查分类级别的自动批准设置
        if (this.checkCategoryAutoApprove(toolPerm.category)) {
          return { allowed: true, autoApproved: true, reason: 'Auto-approved by category setting' }
        }

        // 检查安全路径
        if (this.isSafeOperation(toolName, args)) {
          return { allowed: true, autoApproved: true, reason: 'Auto-approved as safe operation' }
        }

        // 需要用户确认
        return this.askUserPermission(request)

      default:
        return this.askUserPermission(request)
    }
  }

  /**
   * 检查分类级别自动批准
   */
  private checkCategoryAutoApprove(category: ToolCategory): boolean {
    switch (category) {
      case 'read':
        return this.userSettings.autoApproveReads
      case 'write':
        return this.userSettings.autoApproveWrites
      case 'execute':
        return this.userSettings.autoApproveExecute
      case 'git':
        return this.userSettings.autoApproveGit
      default:
        return false
    }
  }

  /**
   * 检查是否是安全操作
   */
  private isSafeOperation(toolName: string, args: Record<string, unknown>): boolean {
    // 安全命令白名单
    const safeCommands = [
      'npm run', 'yarn', 'pnpm', 'bun',
      'node -v', 'npm -v', 'yarn -v',
      'git status', 'git log', 'git diff', 'git branch',
      'ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail',
      'which', 'where', 'type'
    ]

    if (toolName === 'execute_command') {
      const command = String(args.command || '').toLowerCase()
      return safeCommands.some((safe) => command.startsWith(safe.toLowerCase()))
    }

    return false
  }

  /**
   * 请求用户确认
   */
  private async askUserPermission(request: PermissionRequest): Promise<PermissionDecision> {
    if (this.onPermissionRequest) {
      try {
        const allowed = await this.onPermissionRequest(request)
        return { allowed, reason: allowed ? 'User approved' : 'User denied' }
      } catch (error) {
        logger.error('Permission request handler failed', { error })
        return { allowed: false, reason: 'Permission request failed' }
      }
    }

    // 没有处理器，默认拒绝
    logger.warn('No permission request handler, denying by default')
    return { allowed: false, reason: 'No permission handler configured' }
  }

  /**
   * 获取工具权限配置
   */
  getToolPermission(toolName: string): ToolPermission | undefined {
    return this.toolPermissions.get(toolName)
  }

  /**
   * 获取所有工具权限
   */
  getAllToolPermissions(): ToolPermission[] {
    return Array.from(this.toolPermissions.values())
  }

  /**
   * 按分类获取工具
   */
  getToolsByCategory(category: ToolCategory): ToolPermission[] {
    return this.getAllToolPermissions().filter((p) => p.category === category)
  }

  /**
   * 更新工具权限级别
   */
  setToolPermissionLevel(toolName: string, level: PermissionLevel) {
    this.userSettings.customPermissions[toolName] = level
    this.saveSettings()
    logger.info('Tool permission updated', { toolName, level })
  }

  /**
   * 获取用户设置
   */
  getUserSettings(): UserPermissionSettings {
    return { ...this.userSettings }
  }

  /**
   * 更新用户设置
   */
  updateUserSettings(settings: Partial<UserPermissionSettings>) {
    this.userSettings = { ...this.userSettings, ...settings }
    this.saveSettings()
    logger.info('User settings updated', { settings })
  }

  /**
   * 重置为默认设置
   */
  resetToDefaults() {
    this.userSettings = { ...DEFAULT_USER_SETTINGS }
    this.saveSettings()
    logger.info('Settings reset to defaults')
  }

  /**
   * 保存设置到 localStorage
   */
  private saveSettings() {
    try {
      localStorage.setItem('cherry-tool-permissions', JSON.stringify(this.userSettings))
    } catch (error) {
      logger.error('Failed to save settings', { error })
    }
  }

  /**
   * 从 localStorage 加载设置
   */
  private loadSettings() {
    try {
      const saved = localStorage.getItem('cherry-tool-permissions')
      if (saved) {
        const parsed = JSON.parse(saved)
        this.userSettings = { ...DEFAULT_USER_SETTINGS, ...parsed }
      }
    } catch (error) {
      logger.error('Failed to load settings', { error })
    }
  }
}

// ==================== 单例导出 ====================

let permissionManagerInstance: ToolPermissionManager | null = null

export function getToolPermissionManager(): ToolPermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new ToolPermissionManager()
  }
  return permissionManagerInstance
}

export default {
  getToolPermissionManager,
  DEFAULT_TOOL_PERMISSIONS,
  DEFAULT_USER_SETTINGS
}
