/**
 * PermissionManager - 权限管理器
 *
 * 提供 Claude Code 风格的权限控制系统：
 * - 三种权限模式：ask_always / auto_approve / yolo
 * - 细粒度权限控制
 * - 白名单/黑名单
 * - 审批队列
 */

import { loggerService } from '@logger'

import type {
  PermissionConfig,
  PermissionLevel,
  PermissionMode,
  PermissionRequest,
  PermissionRequestType,
  RiskLevel
} from './types'
import { DEFAULT_PERMISSION_CONFIG } from './types'

const logger = loggerService.withContext('PermissionManager')

// ==================== 权限管理器实现 ====================

class PermissionManagerImpl {
  private config: PermissionConfig = { ...DEFAULT_PERMISSION_CONFIG }
  private pendingRequests: Map<
    string,
    {
      request: PermissionRequest
      resolve: (approved: boolean) => void
      reject: (error: Error) => void
    }
  > = new Map()
  private approvedPatterns: Set<string> = new Set()
  private deniedPatterns: Set<string> = new Set()
  private listeners: Set<(requests: PermissionRequest[]) => void> = new Set()

  /**
   * 获取当前权限配置
   */
  getConfig(): PermissionConfig {
    return { ...this.config }
  }

  /**
   * 更新权限配置
   */
  updateConfig(updates: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  /**
   * 设置权限模式
   */
  setMode(mode: PermissionMode): void {
    this.config.mode = mode
    this.saveConfig()
    logger.info('Permission mode changed', { mode })
  }

  /**
   * 获取当前权限模式
   */
  getMode(): PermissionMode {
    return this.config.mode
  }

  /**
   * 请求权限
   * @returns Promise<boolean> 是否获得批准
   */
  async requestPermission(
    type: PermissionRequestType,
    details: PermissionRequest['details'],
    source?: string
  ): Promise<boolean> {
    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      details,
      risk: this.assessRisk(type, details),
      timestamp: new Date(),
      source
    }

    // YOLO 模式直接通过
    if (this.config.mode === 'yolo') {
      this.logPermission(request, true, 'yolo_mode')
      return true
    }

    // 检查是否在已批准模式中
    const pattern = this.getPattern(type, details)
    if (this.approvedPatterns.has(pattern)) {
      this.logPermission(request, true, 'approved_pattern')
      return true
    }
    if (this.deniedPatterns.has(pattern)) {
      this.logPermission(request, false, 'denied_pattern')
      return false
    }

    // 检查白名单/黑名单
    if (this.isInDenyList(type, details)) {
      this.logPermission(request, false, 'deny_list')
      return false
    }
    if (this.isInAllowList(type, details)) {
      this.logPermission(request, true, 'allow_list')
      return true
    }

    // 检查细粒度权限
    const permissionLevel = this.getPermissionLevel(type)
    if (permissionLevel === 'allow') {
      this.logPermission(request, true, 'permission_level')
      return true
    }
    if (permissionLevel === 'deny') {
      this.logPermission(request, false, 'permission_level')
      return false
    }

    // auto_approve 模式下，低风险操作自动通过
    if (this.config.mode === 'auto_approve' && request.risk === 'low') {
      this.logPermission(request, true, 'auto_approve_low_risk')
      return true
    }

    // 需要用户确认
    return this.askUserApproval(request)
  }

  /**
   * 快速权限检查 (不阻塞)
   */
  checkPermission(type: PermissionRequestType, details: PermissionRequest['details']): PermissionLevel {
    // YOLO 模式
    if (this.config.mode === 'yolo') {
      return 'allow'
    }

    // 检查模式
    const pattern = this.getPattern(type, details)
    if (this.approvedPatterns.has(pattern)) return 'allow'
    if (this.deniedPatterns.has(pattern)) return 'deny'

    // 检查列表
    if (this.isInDenyList(type, details)) return 'deny'
    if (this.isInAllowList(type, details)) return 'allow'

    // 返回配置的权限级别
    return this.getPermissionLevel(type)
  }

  /**
   * 获取待处理的权限请求
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values()).map((p) => p.request)
  }

  /**
   * 批准权限请求
   */
  approveRequest(requestId: string, approveAll: boolean = false): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    const { request, resolve } = pending
    this.pendingRequests.delete(requestId)

    if (approveAll) {
      const pattern = this.getPattern(request.type, request.details)
      this.approvedPatterns.add(pattern)
    }

    this.logPermission(request, true, approveAll ? 'user_approve_all' : 'user_approve')
    resolve(true)
    this.notifyListeners()
  }

  /**
   * 拒绝权限请求
   */
  denyRequest(requestId: string, denyAll: boolean = false): void {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    const { request, resolve } = pending
    this.pendingRequests.delete(requestId)

    if (denyAll) {
      const pattern = this.getPattern(request.type, request.details)
      this.deniedPatterns.add(pattern)
    }

    this.logPermission(request, false, denyAll ? 'user_deny_all' : 'user_deny')
    resolve(false)
    this.notifyListeners()
  }

  /**
   * 订阅权限请求变化
   */
  subscribe(callback: (requests: PermissionRequest[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * 清除已批准/拒绝的模式
   */
  clearPatterns(): void {
    this.approvedPatterns.clear()
    this.deniedPatterns.clear()
  }

  /**
   * 添加到白名单
   */
  addToAllowList(type: 'path' | 'command', value: string): void {
    if (type === 'path') {
      this.config.allowedPaths.push(value)
    } else {
      this.config.allowedCommands.push(value)
    }
    this.saveConfig()
  }

  /**
   * 添加到黑名单
   */
  addToDenyList(type: 'path' | 'command', value: string): void {
    if (type === 'path') {
      this.config.deniedPaths.push(value)
    } else {
      this.config.deniedCommands.push(value)
    }
    this.saveConfig()
  }

  // ==================== 私有方法 ====================

  private assessRisk(type: PermissionRequestType, details: PermissionRequest['details']): RiskLevel {
    // 文件读取通常是低风险
    if (type === 'file_read') {
      return 'low'
    }

    // 文件写入是中等风险
    if (type === 'file_write') {
      // 写入敏感路径是高风险
      if (this.isSensitivePath(details.path)) {
        return 'high'
      }
      return 'medium'
    }

    // 文件删除是高风险
    if (type === 'file_delete') {
      if (this.isSensitivePath(details.path)) {
        return 'critical'
      }
      return 'high'
    }

    // Shell 执行需要检查命令
    if (type === 'shell_execute') {
      const command = details.command || ''

      // 检查危险模式
      for (const pattern of this.config.dangerousPatterns) {
        if (new RegExp(pattern, 'i').test(command)) {
          return 'critical'
        }
      }

      // 检查已知危险命令
      for (const denied of this.config.deniedCommands) {
        if (command.includes(denied)) {
          return 'critical'
        }
      }

      // 检查安全命令
      for (const allowed of this.config.allowedCommands) {
        if (command.startsWith(allowed)) {
          return 'low'
        }
      }

      return 'medium'
    }

    // 网络访问
    if (type === 'network') {
      return 'medium'
    }

    return 'medium'
  }

  private isSensitivePath(path?: string): boolean {
    if (!path) return false
    const sensitivePaths = [
      '/etc',
      '/var',
      '/usr/bin',
      '/usr/sbin',
      'C:\\Windows',
      'C:\\Program Files',
      '.ssh',
      '.aws',
      '.config',
      '.gnupg',
      'id_rsa',
      'id_dsa',
      'id_ecdsa',
      'id_ed25519',
      '.env',
      'credentials',
      'secrets',
      'private'
    ]
    return sensitivePaths.some((sp) => path.toLowerCase().includes(sp.toLowerCase()))
  }

  private getPermissionLevel(type: PermissionRequestType): PermissionLevel {
    switch (type) {
      case 'file_read':
        return this.config.fileRead
      case 'file_write':
        return this.config.fileWrite
      case 'file_delete':
        return this.config.fileDelete
      case 'shell_execute':
        return this.config.shellExecute
      case 'network':
        return this.config.networkAccess
      default:
        return 'ask'
    }
  }

  private isInAllowList(type: PermissionRequestType, details: PermissionRequest['details']): boolean {
    if (type === 'file_read' || type === 'file_write' || type === 'file_delete') {
      const path = details.path
      if (path) {
        return this.config.allowedPaths.some((ap) => path.startsWith(ap) || path.includes(ap))
      }
    }
    if (type === 'shell_execute') {
      const command = details.command
      if (command) {
        return this.config.allowedCommands.some((ac) => command.startsWith(ac) || command === ac)
      }
    }
    return false
  }

  private isInDenyList(type: PermissionRequestType, details: PermissionRequest['details']): boolean {
    if (type === 'file_read' || type === 'file_write' || type === 'file_delete') {
      const path = details.path
      if (path) {
        return this.config.deniedPaths.some((dp) => path.startsWith(dp) || path.includes(dp))
      }
    }
    if (type === 'shell_execute') {
      const command = details.command
      if (command) {
        return this.config.deniedCommands.some((dc) => command.includes(dc))
      }
    }
    return false
  }

  private getPattern(type: PermissionRequestType, details: PermissionRequest['details']): string {
    switch (type) {
      case 'file_read':
      case 'file_write':
      case 'file_delete':
        return `${type}:${details.path || '*'}`
      case 'shell_execute':
        // 命令模式：取命令的第一个词
        const cmd = details.command?.split(' ')[0] || '*'
        return `${type}:${cmd}`
      case 'network':
        return `${type}:${details.url || '*'}`
      default:
        return type
    }
  }

  private askUserApproval(request: PermissionRequest): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { request, resolve, reject })
      this.notifyListeners()

      // 超时自动拒绝 (5分钟)
      setTimeout(
        () => {
          if (this.pendingRequests.has(request.id)) {
            this.denyRequest(request.id)
          }
        },
        5 * 60 * 1000
      )
    })
  }

  private notifyListeners(): void {
    const requests = this.getPendingRequests()
    this.listeners.forEach((callback) => {
      try {
        callback(requests)
      } catch (error) {
        console.error('Permission listener error:', error)
      }
    })
  }

  private logPermission(request: PermissionRequest, approved: boolean, reason: string): void {
    logger.debug(`Permission ${approved ? 'approved' : 'denied'}: ${request.type}`, {
      details: request.details,
      risk: request.risk,
      reason,
      source: request.source
    })
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('crew_permission_config', JSON.stringify(this.config))
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 从存储加载配置
   */
  loadConfig(): void {
    try {
      const stored = localStorage.getItem('crew_permission_config')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.config = { ...DEFAULT_PERMISSION_CONFIG, ...parsed }
      }
    } catch {
      // 忽略读取错误
    }
  }
}

// 导出单例
export const PermissionManager = new PermissionManagerImpl()

// 初始化时加载配置
PermissionManager.loadConfig()

export default PermissionManager
