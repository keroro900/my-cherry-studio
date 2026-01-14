/**
 * PluginVariableRegistry - 插件变量注册中心
 *
 * 允许插件动态注册自定义变量，这些变量可以在提示词中使用
 * 类似 VCPToolBox 的插件变量系统 (VCPWeatherInfo, VCPDailyHot 等)
 *
 * 重构说明：
 * - 静态变量值委托给 VCPVariableService 存储
 * - 动态函数值（getter）保存在本地 Map 中
 * - 这样可以统一变量管理，同时支持动态计算值
 */

import { ipcMain } from 'electron'
import { loggerService } from '@logger'

// 延迟导入 VCPVariableService 避免循环依赖
let vcpVariableServiceInstance: typeof import('./VCPVariableService').vcpVariableService | null = null

function getVCPVariableService(): typeof import('./VCPVariableService').vcpVariableService {
  if (!vcpVariableServiceInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { vcpVariableService } = require('./VCPVariableService')
    vcpVariableServiceInstance = vcpVariableService
  }
  return vcpVariableServiceInstance!
}

const logger = loggerService.withContext('PluginVariableRegistry')

/**
 * 插件变量定义
 * @deprecated 使用 VCPVariable (from '@shared/variables') 替代
 * @see VCPVariable 统一的变量接口
 */
export interface PluginVariable {
  /** 变量名（不含大括号，如 VCPWeatherInfo） */
  name: string
  /** 变量描述 */
  description: string
  /** 来源插件名 */
  source: string
  /** 变量类别 */
  category: 'plugin' | 'diary' | 'agent' | 'custom'
  /** 当前值（可以是字符串或返回字符串的异步函数） */
  value: string | (() => Promise<string>)
  /** 注册时间 */
  registeredAt: number
  /** 最后更新时间 */
  updatedAt: number
  /** 是否为动态变量（每次使用时重新计算） */
  dynamic?: boolean
  /** 缓存时间（毫秒），0 表示不缓存 */
  cacheTTL?: number
}

/**
 * 变量缓存条目
 */
interface CacheEntry {
  value: string
  expiresAt: number
}

/**
 * 插件变量注册中心
 * 单例模式，管理所有插件注册的变量
 *
 * 重构后的工作模式：
 * - 静态字符串值：委托给 VCPVariableService 存储
 * - 动态函数值：保存在本地 dynamicGetters Map 中
 * - variables Map 保留用于向后兼容和元数据查询
 */
class PluginVariableRegistryImpl {
  private static instance: PluginVariableRegistryImpl
  /** 变量元数据（保留用于向后兼容） */
  private variables: Map<string, PluginVariable> = new Map()
  /** 动态值获取器（函数类型的值） */
  private dynamicGetters: Map<string, () => Promise<string>> = new Map()
  /** 值缓存 */
  private cache: Map<string, CacheEntry> = new Map()

  private constructor() {
    logger.info('PluginVariableRegistry initialized (adapter mode)')
  }

  static getInstance(): PluginVariableRegistryImpl {
    if (!PluginVariableRegistryImpl.instance) {
      PluginVariableRegistryImpl.instance = new PluginVariableRegistryImpl()
    }
    return PluginVariableRegistryImpl.instance
  }

  /**
   * 注册插件变量
   * - 函数值：存储在本地 dynamicGetters
   * - 字符串值：委托给 VCPVariableService
   */
  register(variable: Omit<PluginVariable, 'registeredAt' | 'updatedAt'>): boolean {
    const name = variable.name

    // 验证变量名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      logger.warn('Invalid variable name format', { name })
      return false
    }

    // 检查是否已存在
    const existing = this.variables.get(name)
    if (existing) {
      logger.info('Updating existing plugin variable', { name, source: variable.source })
    }

    const now = Date.now()
    const isDynamic = typeof variable.value === 'function'

    // 存储元数据
    this.variables.set(name, {
      ...variable,
      value: isDynamic ? '' : (variable.value as string),
      dynamic: isDynamic,
      registeredAt: existing?.registeredAt || now,
      updatedAt: now
    })

    if (isDynamic) {
      // 动态值：存储到本地 getter Map
      this.dynamicGetters.set(name, variable.value as () => Promise<string>)
    } else {
      // 静态值：委托给 VCPVariableService
      try {
        getVCPVariableService().registerPluginVariable({
          name,
          value: variable.value as string,
          description: variable.description,
          pluginId: variable.source,
          cacheTTL: variable.cacheTTL
        })
      } catch (error) {
        logger.warn('Failed to delegate to VCPVariableService, using local storage', { name, error })
      }
    }

    // 清除缓存
    this.cache.delete(name)

    logger.info('Plugin variable registered', { name, source: variable.source, dynamic: isDynamic })
    return true
  }

  /**
   * 注销插件变量
   */
  unregister(name: string): boolean {
    if (this.variables.has(name)) {
      this.variables.delete(name)
      this.dynamicGetters.delete(name)
      this.cache.delete(name)

      // 同时从 VCPVariableService 注销
      try {
        getVCPVariableService().unregisterPluginVariable(name)
      } catch {
        // 忽略错误
      }

      logger.info('Plugin variable unregistered', { name })
      return true
    }
    return false
  }

  /**
   * 注销指定插件的所有变量
   */
  unregisterBySource(source: string): number {
    let count = 0
    for (const [name, variable] of this.variables.entries()) {
      if (variable.source === source) {
        this.variables.delete(name)
        this.dynamicGetters.delete(name)
        this.cache.delete(name)

        try {
          getVCPVariableService().unregisterPluginVariable(name)
        } catch {
          // 忽略错误
        }

        count++
      }
    }
    if (count > 0) {
      logger.info('Plugin variables unregistered by source', { source, count })
    }
    return count
  }

  /**
   * 获取变量值
   * 优先级：
   * 1. 缓存
   * 2. 动态 getter (本地)
   * 3. VCPVariableService (静态值)
   * 4. 本地变量元数据
   */
  async getValue(name: string): Promise<string | null> {
    const variable = this.variables.get(name)
    if (!variable) {
      // 尝试从 VCPVariableService 获取
      try {
        const vcpVar = await getVCPVariableService().getByName(name)
        if (vcpVar) {
          return vcpVar.value
        }
      } catch {
        // 忽略错误
      }
      return null
    }

    // 检查缓存
    const cached = this.cache.get(name)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    // 获取值
    let value: string

    // 优先检查动态 getter
    const dynamicGetter = this.dynamicGetters.get(name)
    if (dynamicGetter) {
      try {
        value = await dynamicGetter()
      } catch (error) {
        logger.error('Failed to get dynamic plugin variable value', { name, error })
        return `[${name}: 获取失败]`
      }
    } else if (variable.value) {
      value = variable.value as string
    } else {
      // 尝试从 VCPVariableService 获取
      try {
        const vcpVar = await getVCPVariableService().getByName(name)
        if (vcpVar) {
          value = vcpVar.value
        } else {
          return null
        }
      } catch {
        return null
      }
    }

    // 更新缓存
    if (variable.cacheTTL && variable.cacheTTL > 0) {
      this.cache.set(name, {
        value,
        expiresAt: Date.now() + variable.cacheTTL
      })
    }

    return value
  }

  /**
   * 更新变量值
   */
  updateValue(name: string, value: string | (() => Promise<string>)): boolean {
    const variable = this.variables.get(name)
    if (!variable) {
      return false
    }

    const isDynamic = typeof value === 'function'

    if (isDynamic) {
      this.dynamicGetters.set(name, value as () => Promise<string>)
      variable.value = ''
      variable.dynamic = true
    } else {
      this.dynamicGetters.delete(name)
      variable.value = value as string
      variable.dynamic = false

      // 同步到 VCPVariableService
      try {
        getVCPVariableService().registerPluginVariable({
          name,
          value: value as string,
          description: variable.description,
          pluginId: variable.source
        })
      } catch {
        // 忽略错误
      }
    }

    variable.updatedAt = Date.now()
    this.cache.delete(name)

    logger.debug('Plugin variable value updated', { name, dynamic: isDynamic })
    return true
  }

  /**
   * 获取所有已注册的变量
   */
  getAll(): PluginVariable[] {
    return Array.from(this.variables.values())
  }

  /**
   * 获取指定来源的变量
   */
  getBySource(source: string): PluginVariable[] {
    return this.getAll().filter((v) => v.source === source)
  }

  /**
   * 检查变量是否存在
   */
  has(name: string): boolean {
    return this.variables.has(name)
  }

  /**
   * 获取变量定义
   */
  get(name: string): PluginVariable | undefined {
    return this.variables.get(name)
  }

  /**
   * 解析文本中的插件变量
   * 替换所有 {{VariableName}} 格式的插件变量
   */
  async resolveVariables(text: string): Promise<{ text: string; resolved: string[] }> {
    const resolved: string[] = []
    let result = text

    // 匹配所有 {{...}} 格式
    const pattern = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g
    const matches = text.matchAll(pattern)

    for (const match of matches) {
      const varName = match[1]
      if (this.has(varName)) {
        const value = await this.getValue(varName)
        if (value !== null) {
          result = result.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value)
          resolved.push(varName)
        }
      }
    }

    return { text: result, resolved }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('Plugin variable cache cleared')
  }

  /**
   * 清除所有变量
   */
  clear(): void {
    this.variables.clear()
    this.cache.clear()
    logger.info('All plugin variables cleared')
  }
}

// 导出单例
export const PluginVariableRegistry = PluginVariableRegistryImpl.getInstance()

// IPC 通道名称
const IPC_CHANNELS = {
  REGISTER: 'plugin-variable:register',
  UNREGISTER: 'plugin-variable:unregister',
  GET_VALUE: 'plugin-variable:get-value',
  UPDATE_VALUE: 'plugin-variable:update-value',
  GET_ALL: 'plugin-variable:get-all',
  RESOLVE: 'plugin-variable:resolve'
}

/**
 * 注册 IPC 处理器
 */
export function registerPluginVariableIpcHandlers(): void {
  // 注册变量
  ipcMain.handle(
    IPC_CHANNELS.REGISTER,
    async (
      _,
      params: {
        name: string
        description: string
        source: string
        category?: 'plugin' | 'diary' | 'agent' | 'custom'
        value: string
        dynamic?: boolean
        cacheTTL?: number
      }
    ) => {
      return PluginVariableRegistry.register({
        name: params.name,
        description: params.description,
        source: params.source,
        category: params.category || 'plugin',
        value: params.value,
        dynamic: params.dynamic,
        cacheTTL: params.cacheTTL
      })
    }
  )

  // 注销变量
  ipcMain.handle(IPC_CHANNELS.UNREGISTER, async (_, name: string) => {
    return PluginVariableRegistry.unregister(name)
  })

  // 获取变量值
  ipcMain.handle(IPC_CHANNELS.GET_VALUE, async (_, name: string) => {
    return PluginVariableRegistry.getValue(name)
  })

  // 更新变量值
  ipcMain.handle(IPC_CHANNELS.UPDATE_VALUE, async (_, name: string, value: string) => {
    return PluginVariableRegistry.updateValue(name, value)
  })

  // 获取所有变量
  ipcMain.handle(IPC_CHANNELS.GET_ALL, async () => {
    // 返回序列化安全的数据（不包含函数）
    return PluginVariableRegistry.getAll().map((v) => ({
      name: v.name,
      description: v.description,
      source: v.source,
      category: v.category,
      dynamic: v.dynamic,
      registeredAt: v.registeredAt,
      updatedAt: v.updatedAt
    }))
  })

  // 解析变量
  ipcMain.handle(IPC_CHANNELS.RESOLVE, async (_, text: string) => {
    return PluginVariableRegistry.resolveVariables(text)
  })

  logger.info('Plugin variable IPC handlers registered')
}

export default PluginVariableRegistry
