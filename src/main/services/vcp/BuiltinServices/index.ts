/**
 * VCP 内置服务注册表
 *
 * 将核心 VCP 插件实现为 Cherry Studio 的内置服务：
 * - 不依赖外部进程（无需 Node.js/Python 子进程）
 * - 直接在 Electron 主进程中运行
 * - 使用相同的 VCP manifest 格式
 * - 对 AI 透明 - 仍使用 <<<[TOOL_REQUEST]>>> 格式调用
 * - 支持模型绑定 - 每个服务可以配置专用的 AI 模型
 *
 * 架构设计：
 * 1. 每个内置服务实现 IBuiltinService 接口
 * 2. BuiltinServiceRegistry 统一管理所有内置服务
 * 3. PluginExecutor 优先检查内置服务，再回退到外部插件
 * 4. 服务可以通过 modelConfig 绑定专用 AI 模型
 *
 * 注意：纯 I/O 服务（图像生成、搜索、天气等）已移至外部插件系统
 * 本文件仅保留 RAG/记忆相关的核心服务
 */

import { loggerService } from '@logger'

import { getPluginModelService } from '../PluginModelService'
import type { PluginModelConfig } from '../types'
import type {
  BuiltinServiceResult,
  BuiltinToolDefinition,
  IBuiltinService,
  ModelCallRequest,
  ModelCallResult
} from './types'

// Re-export types for use by service implementations
export type { PluginModelConfig }
export * from './types'

const logger = loggerService.withContext('VCP:BuiltinServices')

// ==================== 内置服务注册表 ====================

/**
 * 内置服务注册表
 * 管理所有原生 TypeScript 实现的 VCP 服务
 *
 * 保留的核心服务（19 个）：
 * - 记忆系统：IntegratedMemory（统一记忆入口，替代 LightMemo/DeepMemo/AIMemo/MemoryMaster）
 * - 日记系统：DailyNoteWrite, DailyNotePanel, TimelineGenerator
 * - 语义处理：SemanticGroupEditor, ThoughtClusterManager
 * - AI Agent：MagiAgent, MetaThinking, QualityGuardian, AgentAssistant, AgentMessage
 * - 核心功能：ModelSelector, WorkflowBridge, VCPToolInfo, VCPTavern, VCPPluginCreator, FlowInvite
 * - 社交功能：VCPForum, VCPForumAssistant
 */
export class BuiltinServiceRegistry {
  private static instance: BuiltinServiceRegistry | null = null
  private services: Map<string, IBuiltinService> = new Map()
  private initialized: boolean = false

  private constructor() {}

  static getInstance(): BuiltinServiceRegistry {
    if (!BuiltinServiceRegistry.instance) {
      BuiltinServiceRegistry.instance = new BuiltinServiceRegistry()
    }
    return BuiltinServiceRegistry.instance
  }

  /**
   * 初始化所有内置服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('BuiltinServiceRegistry already initialized')
      return
    }

    logger.info('Initializing builtin VCP services...')

    // 动态导入并注册所有内置服务
    await this.registerBuiltinServices()

    // 初始化每个服务，同时加载已保存的配置
    const { getVCPRuntime } = await import('../index')
    const vcpRuntime = getVCPRuntime()

    for (const [name, service] of this.services) {
      try {
        // 加载已保存的配置
        const savedConfig = vcpRuntime.loadBuiltinPluginConfig(name)
        if (savedConfig && service.setConfig) {
          service.setConfig(savedConfig)
          logger.debug('Loaded saved config for builtin service', { name, keys: Object.keys(savedConfig) })
        }

        if (service.initialize) {
          await service.initialize()
          logger.debug('Initialized builtin service', { name })
        }
      } catch (error) {
        logger.error('Failed to initialize builtin service', {
          name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    this.initialized = true

    // 统计去重后的实际服务数量
    const uniqueServices = this.getAll()
    logger.info('Builtin VCP services initialized', {
      count: uniqueServices.length,
      aliasCount: this.services.size - uniqueServices.length,
      services: uniqueServices.map((s) => s.name)
    })
  }

  /**
   * 注册所有内置服务
   * 仅保留 RAG/记忆相关的核心服务
   */
  private async registerBuiltinServices(): Promise<void> {
    // ==================== 元工具 ====================

    try {
      // 1. VCP 工具信息查询服务（元工具）
      const { VCPToolInfoService } = await import('./VCPToolInfoService')
      this.register(new VCPToolInfoService())
      this.registerAlias('vcp_get_tool_info', 'vcp_tool_info')
      this.registerAlias('GetToolInfo', 'vcp_tool_info')
    } catch (error) {
      logger.warn('Failed to load VCPToolInfoService', { error: String(error) })
    }

    // ==================== 记忆系统 ====================

    try {
      // 2. 统一记忆服务 - 整合 LightMemo/DeepMemo/AIMemo/MemoryMaster 功能
      // 直接包装 IntegratedMemoryCoordinator，避免代码冗余
      const { IntegratedMemoryService } = await import('./IntegratedMemoryService')
      this.register(new IntegratedMemoryService())
      // 向后兼容别名
      this.registerAlias('LightMemo', 'Memory')
      this.registerAlias('DeepMemo', 'Memory')
      this.registerAlias('AIMemo', 'Memory')
      this.registerAlias('MemoryMaster', 'Memory')
    } catch (error) {
      logger.warn('Failed to load IntegratedMemoryService', { error: String(error) })
    }

    // ==================== 日记系统 ====================

    try {
      // 6. 日记写入服务 (统一日记服务)
      const { DailyNoteWriteService } = await import('./DailyNoteWriteService')
      this.register(new DailyNoteWriteService())
      this.registerAlias('Diary', 'DailyNoteWrite')
    } catch (error) {
      logger.warn('Failed to load DailyNoteWriteService', { error: String(error) })
    }

    try {
      // 7. 日记面板服务 - UI 路由胶水层
      const { DailyNotePanelService } = await import('./DailyNotePanelService')
      this.register(new DailyNotePanelService())
    } catch (error) {
      logger.warn('Failed to load DailyNotePanelService', { error: String(error) })
    }

    // ==================== 语义处理 ====================

    try {
      // 8. 语义组编辑器服务
      const { SemanticGroupEditorService } = await import('./SemanticGroupEditorService')
      this.register(new SemanticGroupEditorService())
    } catch (error) {
      logger.warn('Failed to load SemanticGroupEditorService', { error: String(error) })
    }

    try {
      // 9. 思维簇管理器服务
      const { ThoughtClusterManagerService } = await import('./ThoughtClusterManagerService')
      this.register(new ThoughtClusterManagerService())
    } catch (error) {
      logger.warn('Failed to load ThoughtClusterManagerService', { error: String(error) })
    }

    // ==================== AI Agent 服务 ====================

    try {
      // 10. 三贤者服务 - 多模型辩论与共识决策
      const { MagiAgentService } = await import('./MagiAgentService')
      this.register(new MagiAgentService())
    } catch (error) {
      logger.warn('Failed to load MagiAgentService', { error: String(error) })
    }

    try {
      // 11. 元思考链服务 - 多步骤推理和反思
      const { MetaThinkingService } = await import('./MetaThinkingService')
      this.register(new MetaThinkingService())
    } catch (error) {
      logger.warn('Failed to load MetaThinkingService', { error: String(error) })
    }

    try {
      // 12. 质量守护服务 - AI 驱动的质量检查和自动优化
      const { QualityGuardianService } = await import('./QualityGuardianService')
      this.register(new QualityGuardianService())
    } catch (error) {
      logger.warn('Failed to load QualityGuardianService', { error: String(error) })
    }

    try {
      // 13. Agent 助手服务
      const { AgentAssistantService } = await import('./AgentAssistantService')
      this.register(new AgentAssistantService())
    } catch (error) {
      logger.warn('Failed to load AgentAssistantService', { error: String(error) })
    }

    try {
      // 14. Agent 消息服务
      const { AgentMessageService } = await import('./AgentMessageService')
      this.register(new AgentMessageService())
    } catch (error) {
      logger.warn('Failed to load AgentMessageService', { error: String(error) })
    }

    // ==================== 核心功能 ====================

    try {
      // 15. 模型选择器服务 - 提供完整模型服务访问
      const { ModelSelectorService } = await import('./ModelSelectorService')
      this.register(new ModelSelectorService())
    } catch (error) {
      logger.warn('Failed to load ModelSelectorService', { error: String(error) })
    }

    try {
      // 16. Workflow 桥接服务 - 将 Workflow 节点暴露为 VCP 工具
      const { WorkflowBridgeService } = await import('./WorkflowBridgeService')
      this.register(new WorkflowBridgeService())
    } catch (error) {
      logger.warn('Failed to load WorkflowBridgeService', { error: String(error) })
    }

    try {
      // 17. 角色卡/WorldBook 服务
      const { VCPTavernService } = await import('./VCPTavernService')
      this.register(new VCPTavernService())
    } catch (error) {
      logger.warn('Failed to load VCPTavernService', { error: String(error) })
    }

    try {
      // 18. VCP 插件创造者服务 - AI 即时创建内置服务
      const { VCPPluginCreatorService } = await import('./VCPPluginCreatorService')
      this.register(new VCPPluginCreatorService())
    } catch (error) {
      logger.warn('Failed to load VCPPluginCreatorService', { error: String(error) })
    }

    try {
      // 19. FlowInvite 自我心跳总线服务 - AI 主观能动性
      const { FlowInviteService } = await import('./FlowInviteService')
      this.register(new FlowInviteService())
    } catch (error) {
      logger.warn('Failed to load FlowInviteService', { error: String(error) })
    }

    try {
      // 20. VCP 论坛服务 - AI 角色交流论坛
      const { VCPForumService } = await import('./VCPForumService')
      this.register(new VCPForumService())
    } catch (error) {
      logger.warn('Failed to load VCPForumService', { error: String(error) })
    }

    try {
      // 21. VCP 论坛小助手服务 - 定时提醒 AI 去逛论坛
      const { VCPForumAssistantService } = await import('./VCPForumAssistantService')
      this.register(new VCPForumAssistantService())
    } catch (error) {
      logger.warn('Failed to load VCPForumAssistantService', { error: String(error) })
    }

    try {
      // 22. Timeline 生成器服务 - 自动日记摘要与时间线
      const { TimelineGeneratorService } = await import('./TimelineGeneratorService')
      this.register(new TimelineGeneratorService())
    } catch (error) {
      logger.warn('Failed to load TimelineGeneratorService', { error: String(error) })
    }

    // ==================== 文件系统服务 ====================

    try {
      // 23. 文件操作服务 - 替代 MCP Filesystem，提供完整文件管理
      const { VCPFileOperatorService } = await import('./VCPFileOperatorService')
      this.register(new VCPFileOperatorService())
      // 兼容别名
      this.registerAlias('file_operator', 'FileOperator')
      this.registerAlias('filesystem', 'FileOperator')
      this.registerAlias('mcp_filesystem', 'FileOperator')
    } catch (error) {
      logger.warn('Failed to load VCPFileOperatorService', { error: String(error) })
    }

    // ==================== 旧插件名兼容别名 ====================
    // 日记相关服务 -> 统一日记服务
    this.registerAlias('DailyNote', 'DailyNoteWrite')
    this.registerAlias('DailyNoteGet', 'DailyNoteWrite')
    this.registerAlias('DailyNoteManager', 'DailyNoteWrite')
    this.registerAlias('RAGDiary', 'DailyNoteWrite')
    this.registerAlias('RAGDiaryPlugin', 'DailyNoteWrite')

    logger.info('Core builtin services registered (I/O services moved to external plugins)')
  }

  /**
   * 注册服务
   */
  register(service: IBuiltinService): void {
    if (this.services.has(service.name)) {
      logger.warn('Overwriting existing builtin service', { name: service.name })
    }
    this.services.set(service.name, service)
    logger.debug('Registered builtin service', {
      name: service.name,
      displayName: service.displayName,
      toolCount: service.toolDefinitions.length
    })
  }

  /**
   * 注册服务别名
   * 允许通过别名访问已注册的服务
   */
  registerAlias(alias: string, targetName: string): void {
    const target = this.services.get(targetName)
    if (!target) {
      logger.warn('Cannot create alias: target service not found', { alias, targetName })
      return
    }
    this.services.set(alias, target)
    logger.debug('Registered service alias', { alias, target: targetName })
  }

  /**
   * 获取服务
   */
  get(name: string): IBuiltinService | undefined {
    // 精确匹配
    if (this.services.has(name)) {
      return this.services.get(name)
    }

    // 归一化匹配（大小写不敏感，`_`/`-` 等价）
    const normalizedName = name.toLowerCase().replace(/-/g, '_')
    for (const [key, service] of this.services) {
      if (key.toLowerCase().replace(/-/g, '_') === normalizedName) {
        return service
      }
    }

    return undefined
  }

  /**
   * 检查是否有此服务
   */
  has(name: string): boolean {
    return this.get(name) !== undefined
  }

  /**
   * 获取所有服务（去重，排除别名指向的重复服务）
   */
  getAll(): IBuiltinService[] {
    // 使用 Set 按服务名去重，避免别名导致的重复
    const seen = new Set<string>()
    const result: IBuiltinService[] = []

    for (const service of this.services.values()) {
      if (!seen.has(service.name)) {
        seen.add(service.name)
        result.push(service)
      }
    }

    return result
  }

  /**
   * 获取所有服务名称
   */
  getAllNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * 执行服务
   */
  async execute(serviceName: string, command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const service = this.get(serviceName)
    if (!service) {
      return {
        success: false,
        error: `Builtin service '${serviceName}' not found. Note: I/O services (search, image gen, weather, etc.) have been moved to external plugins.`
      }
    }

    const startTime = Date.now()

    try {
      const result = await service.execute(command, params)
      return {
        ...result,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 关闭所有服务
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down builtin services...')

    for (const [name, service] of this.services) {
      try {
        if (service.shutdown) {
          await service.shutdown()
          logger.debug('Shut down builtin service', { name })
        }
      } catch (error) {
        logger.warn('Error during builtin service shutdown', {
          name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    this.services.clear()
    this.initialized = false
    logger.info('Builtin services shut down')
  }

  /**
   * 转换为 VCP 插件格式
   * 用于在插件列表中显示
   */
  toVCPPluginFormat(): Array<{
    name: string
    displayName: string
    description: string
    version: string
    pluginType: 'builtin_service'
    enabled: boolean
    isBuiltin: true
    isNative: true
    author?: string
    category?: string
    supportsModel?: boolean
    modelConfig?: PluginModelConfig
    configSchema?: Record<string, unknown>
    capabilities: {
      invocationCommands: BuiltinToolDefinition[]
    }
  }> {
    return this.getAll().map((service) => ({
      name: service.name,
      displayName: service.displayName,
      description: service.description,
      version: service.version,
      pluginType: 'builtin_service',
      enabled: true,
      isBuiltin: true,
      isNative: true,
      author: service.author || 'Cherry Studio',
      category: service.category || 'builtin_service',
      supportsModel: service.supportsModel,
      modelConfig: service.modelConfig,
      configSchema: service.configSchema,
      capabilities: {
        invocationCommands: service.toolDefinitions
      }
    }))
  }

  /**
   * 获取服务详情 (文档、系统提示词等)
   */
  getServiceDetails(serviceName: string): {
    success: boolean
    data?: {
      pluginId: string
      readme?: string
      systemPrompt?: string
      author?: string
      invocationCommands?: Array<{
        commandIdentifier: string
        description: string
        example?: string
      }>
    }
    error?: string
  } {
    const service = this.get(serviceName)
    if (!service) {
      return { success: false, error: `Builtin service '${serviceName}' not found` }
    }

    return {
      success: true,
      data: {
        pluginId: service.name,
        readme: service.documentation,
        systemPrompt: service.systemPrompt,
        author: service.author || 'Cherry Studio',
        invocationCommands: service.toolDefinitions.map((tool) => ({
          commandIdentifier: tool.commandIdentifier,
          description: tool.description,
          example: tool.example
        }))
      }
    }
  }

  /**
   * 设置服务的模型配置
   */
  setServiceModelConfig(serviceName: string, modelConfig: PluginModelConfig): boolean {
    const service = this.get(serviceName)
    if (!service) {
      logger.warn('Service not found for model config', { serviceName })
      return false
    }

    if (!service.supportsModel) {
      logger.warn('Service does not support model binding', { serviceName })
      return false
    }

    if (service.setModelConfig) {
      service.setModelConfig(modelConfig)
      logger.info('Set model config for service', { serviceName, modelConfig })
      return true
    }

    // 直接设置 modelConfig 属性
    service.modelConfig = modelConfig
    logger.info('Set model config for service (direct)', { serviceName, modelConfig })
    return true
  }

  /**
   * 获取服务的模型配置
   */
  getServiceModelConfig(serviceName: string): PluginModelConfig | undefined {
    const service = this.get(serviceName)
    return service?.modelConfig
  }

  /**
   * 调用服务绑定的模型
   * @param serviceName 服务名称
   * @param request 模型调用请求
   */
  async callServiceModel(serviceName: string, request: ModelCallRequest): Promise<ModelCallResult> {
    const service = this.get(serviceName)
    if (!service) {
      return {
        success: false,
        error: `Service '${serviceName}' not found`
      }
    }

    if (!service.supportsModel) {
      return {
        success: false,
        error: `Service '${serviceName}' does not support model binding`
      }
    }

    if (!service.modelConfig || !service.modelConfig.enabled) {
      return {
        success: false,
        error: `Model binding is not enabled for service '${serviceName}'`
      }
    }

    // 如果服务实现了 callModel 方法，使用它
    if (service.callModel) {
      return service.callModel(request)
    }

    // 否则使用 PluginModelService
    const modelService = getPluginModelService()
    return modelService.callModel(service.modelConfig, request)
  }

  /**
   * 调用服务绑定的模型（流式）
   */
  async callServiceModelStream(
    serviceName: string,
    request: ModelCallRequest,
    onChunk: (chunk: string) => void
  ): Promise<ModelCallResult> {
    const service = this.get(serviceName)
    if (!service) {
      return {
        success: false,
        error: `Service '${serviceName}' not found`
      }
    }

    if (!service.supportsModel) {
      return {
        success: false,
        error: `Service '${serviceName}' does not support model binding`
      }
    }

    if (!service.modelConfig || !service.modelConfig.enabled) {
      return {
        success: false,
        error: `Model binding is not enabled for service '${serviceName}'`
      }
    }

    const modelService = getPluginModelService()
    return modelService.callModelStream(service.modelConfig, request, onChunk)
  }
}

// ==================== 导出 ====================

let registryInstance: BuiltinServiceRegistry | null = null
let initializationPromise: Promise<void> | null = null

export function getBuiltinServiceRegistry(): BuiltinServiceRegistry {
  if (!registryInstance) {
    registryInstance = BuiltinServiceRegistry.getInstance()
  }
  return registryInstance
}

/**
 * 确保内置服务已初始化（懒加载）
 * 如果尚未初始化，会自动触发初始化
 */
export async function ensureBuiltinServicesInitialized(): Promise<BuiltinServiceRegistry> {
  const registry = getBuiltinServiceRegistry()

  // 如果已经初始化，直接返回
  if (registry['initialized']) {
    return registry
  }

  // 如果正在初始化中，等待完成
  if (initializationPromise) {
    await initializationPromise
    return registry
  }

  // 开始初始化
  initializationPromise = registry.initialize()
  await initializationPromise
  initializationPromise = null

  return registry
}

export async function initializeBuiltinServices(): Promise<BuiltinServiceRegistry> {
  const registry = getBuiltinServiceRegistry()
  await registry.initialize()
  return registry
}
