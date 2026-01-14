/**
 * Workflow 桥接服务
 *
 * 将 Cherry Studio 的 Workflow 节点暴露为 VCP 可调用的工具
 * AI 可以通过 <<<[TOOL_REQUEST]>>> 格式调用任何 Workflow 节点
 *
 * 支持的节点类型：
 * - 图像生成：gemini_generate, gemini_edit, compare_image 等
 * - AI 对话：unified_prompt, video_prompt
 * - 网络搜索：web_search
 * - 音乐生成：music_generation
 * - 视频生成：kling_image2video, unified_video_generation
 * - 外部服务：http_request, runninghub_app
 */

import { loggerService } from '@logger'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:WorkflowBridgeService')

/**
 * 节点执行请求
 */
interface NodeExecuteRequest {
  nodeType: string
  inputs: Record<string, unknown>
  config: Record<string, unknown>
}

/**
 * 节点执行结果
 */
interface NodeExecuteResult {
  success: boolean
  outputs?: Record<string, unknown>
  error?: string
  duration?: number
}

/**
 * Workflow 节点工具定义
 */
const WORKFLOW_NODE_TOOLS: BuiltinToolDefinition[] = [
  // ==================== AI 对话节点 ====================
  {
    commandIdentifier: 'ai_chat',
    description: `使用 AI 进行对话生成。支持多种模型（GPT-4, Claude, Gemini, 通义千问等）。
参数:
- prompt (字符串, 必需): 用户提示词
- system_prompt (字符串, 可选): 系统提示词
- model_id (字符串, 可选): 指定模型 ID
- temperature (数字, 可选, 默认 0.7): 温度参数
- max_tokens (数字, 可选): 最大 token 数

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ai_chat「末」
prompt:「始」请帮我写一首关于春天的诗「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'prompt', description: '用户提示词', required: true, type: 'string' },
      { name: 'system_prompt', description: '系统提示词', required: false, type: 'string' },
      { name: 'model_id', description: '模型 ID', required: false, type: 'string' },
      { name: 'temperature', description: '温度', required: false, type: 'number', default: 0.7 }
    ]
  },

  // ==================== 图像生成节点 ====================
  {
    commandIdentifier: 'generate_image',
    description: `使用 AI 生成图像。支持 Gemini、DALL-E 等模型。
参数:
- prompt (字符串, 必需): 图像生成提示词，描述想要生成的图像
- style (字符串, 可选): 图像风格，如 'realistic', 'anime', 'oil_painting'
- aspect_ratio (字符串, 可选): 宽高比，如 '1:1', '16:9', '9:16'

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」generate_image「末」
prompt:「始」一只可爱的橘猫在阳光下睡觉，写实风格「末」
style:「始」realistic「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'prompt', description: '图像描述', required: true, type: 'string' },
      { name: 'style', description: '图像风格', required: false, type: 'string' },
      { name: 'aspect_ratio', description: '宽高比', required: false, type: 'string' }
    ]
  },

  {
    commandIdentifier: 'edit_image',
    description: `编辑已有图像。支持修改、添加、删除图像中的元素。
参数:
- image (字符串, 必需): 图像路径或 base64
- prompt (字符串, 必需): 编辑指令，描述要做的修改
- mask (字符串, 可选): 遮罩图像，指定编辑区域

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」edit_image「末」
image:「始」/path/to/image.jpg「末」
prompt:「始」将背景改为蓝天白云「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'image', description: '原始图像', required: true, type: 'string' },
      { name: 'prompt', description: '编辑指令', required: true, type: 'string' },
      { name: 'mask', description: '遮罩图像', required: false, type: 'string' }
    ]
  },

  {
    commandIdentifier: 'compare_images',
    description: `对比两张图像，分析差异。
参数:
- image1 (字符串, 必需): 第一张图像
- image2 (字符串, 必需): 第二张图像
- analysis_type (字符串, 可选): 分析类型，如 'difference', 'similarity', 'detailed'

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」compare_images「末」
image1:「始」/path/to/image1.jpg「末」
image2:「始」/path/to/image2.jpg「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'image1', description: '第一张图像', required: true, type: 'string' },
      { name: 'image2', description: '第二张图像', required: true, type: 'string' },
      { name: 'analysis_type', description: '分析类型', required: false, type: 'string' }
    ]
  },

  // ==================== 网络搜索节点 ====================
  {
    commandIdentifier: 'web_search',
    description: `执行网络搜索。支持 Tavily、Google、Bing、百度等搜索引擎。
参数:
- query (字符串, 必需): 搜索关键词或问题
- provider (字符串, 可选, 默认 'tavily'): 搜索引擎，'tavily', 'local-google', 'local-bing', 'local-baidu'
- max_results (数字, 可选, 默认 5): 最大结果数

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」web_search「末」
query:「始」2025年最新的AI发展趋势「末」
provider:「始」tavily「末」
max_results:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'query', description: '搜索关键词', required: true, type: 'string' },
      { name: 'provider', description: '搜索引擎', required: false, type: 'string', default: 'tavily' },
      { name: 'max_results', description: '最大结果数', required: false, type: 'number', default: 5 }
    ]
  },

  // ==================== 音乐生成节点 ====================
  {
    commandIdentifier: 'generate_music',
    description: `使用 AI 生成音乐。支持 Suno、Udio 等服务。
参数:
- description (字符串, 必需): 音乐描述，描述想要的音乐风格和情感
- lyrics (字符串, 可选): 歌词（如果需要有歌词的音乐）
- style (字符串, 可选): 音乐风格标签，如 'pop, electronic, upbeat'
- title (字符串, 可选): 歌曲标题
- instrumental (布尔, 可选, 默认 false): 是否为纯音乐

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」generate_music「末」
description:「始」一首欢快的电子舞曲，适合派对「末」
style:「始」electronic, dance, upbeat「末」
instrumental:「始」true「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'description', description: '音乐描述', required: true, type: 'string' },
      { name: 'lyrics', description: '歌词', required: false, type: 'string' },
      { name: 'style', description: '音乐风格', required: false, type: 'string' },
      { name: 'title', description: '歌曲标题', required: false, type: 'string' },
      { name: 'instrumental', description: '是否纯音乐', required: false, type: 'boolean', default: false }
    ]
  },

  // ==================== 视频生成节点 ====================
  {
    commandIdentifier: 'generate_video',
    description: `从图像生成视频。支持 Kling、Runway 等服务。
参数:
- image (字符串, 必需): 起始图像路径或 base64
- prompt (字符串, 可选): 视频运动描述
- duration (数字, 可选, 默认 5): 视频时长（秒）
- motion_mode (字符串, 可选): 运动模式，如 'standard', 'pro'

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」generate_video「末」
image:「始」/path/to/image.jpg「末」
prompt:「始」镜头缓慢推进，画面中的人物微笑并转头「末」
duration:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'image', description: '起始图像', required: true, type: 'string' },
      { name: 'prompt', description: '运动描述', required: false, type: 'string' },
      { name: 'duration', description: '时长（秒）', required: false, type: 'number', default: 5 },
      { name: 'motion_mode', description: '运动模式', required: false, type: 'string' }
    ]
  },

  // ==================== HTTP 请求节点 ====================
  {
    commandIdentifier: 'http_request',
    description: `发送 HTTP 请求，调用外部 API。
参数:
- url (字符串, 必需): 请求 URL
- method (字符串, 可选, 默认 'GET'): HTTP 方法，'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
- headers (对象, 可选): 请求头
- body (对象/字符串, 可选): 请求体

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」http_request「末」
url:「始」https://api.example.com/data「末」
method:「始」POST「末」
body:「始」{"key": "value"}「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'url', description: '请求 URL', required: true, type: 'string' },
      { name: 'method', description: 'HTTP 方法', required: false, type: 'string', default: 'GET' },
      { name: 'headers', description: '请求头', required: false, type: 'object' },
      { name: 'body', description: '请求体', required: false, type: 'object' }
    ]
  },

  // ==================== 工作流执行 ====================
  {
    commandIdentifier: 'run_workflow',
    description: `执行保存的工作流模板。
参数:
- workflow_id (字符串, 必需): 工作流 ID 或名称
- inputs (对象, 可选): 工作流输入参数

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」run_workflow「末」
workflow_id:「始」my-image-generation-flow「末」
inputs:「始」{"prompt": "一只猫", "style": "anime"}「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'workflow_id', description: '工作流 ID', required: true, type: 'string' },
      { name: 'inputs', description: '输入参数', required: false, type: 'object' }
    ]
  },

  // ==================== 节点直接执行 ====================
  {
    commandIdentifier: 'execute_node',
    description: `直接执行指定类型的 Workflow 节点。这是一个通用接口，可以执行任何已注册的节点类型。
参数:
- node_type (字符串, 必需): 节点类型，如 'unified_prompt', 'gemini_generate', 'web_search' 等
- inputs (对象, 可选): 节点输入
- config (对象, 可选): 节点配置

可用的节点类型:
- AI: unified_prompt, video_prompt
- 图像: gemini_generate, gemini_edit, compare_image, gemini_pattern, gemini_ecom
- 视频: kling_image2video, unified_video_generation
- 外部: web_search, music_generation, http_request, runninghub_app
- 流程: condition, code_executor, json_transform

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」execute_node「末」
node_type:「始」gemini_generate「末」
inputs:「始」{"prompt": "一只可爱的猫咪"}「末」
config:「始」{"style": "realistic"}「末」
<<<[END_TOOL_REQUEST]>>>`,
    parameters: [
      { name: 'node_type', description: '节点类型', required: true, type: 'string' },
      { name: 'inputs', description: '节点输入', required: false, type: 'object' },
      { name: 'config', description: '节点配置', required: false, type: 'object' }
    ]
  }
]

/**
 * 命令到节点类型的映射
 */
const COMMAND_TO_NODE_TYPE: Record<string, string> = {
  ai_chat: 'unified_prompt',
  generate_image: 'gemini_generate',
  edit_image: 'gemini_edit',
  compare_images: 'compare_image',
  web_search: 'web_search',
  generate_music: 'music_generation',
  generate_video: 'kling_image2video',
  http_request: 'http_request'
}

/**
 * 参数名称映射（VCP 参数 → 节点输入/配置）
 */
const PARAM_MAPPINGS: Record<string, Record<string, { target: 'inputs' | 'config'; name: string }>> = {
  ai_chat: {
    prompt: { target: 'inputs', name: 'prompt' },
    system_prompt: { target: 'config', name: 'systemPrompt' },
    model_id: { target: 'config', name: 'modelId' },
    temperature: { target: 'config', name: 'temperature' }
  },
  generate_image: {
    prompt: { target: 'inputs', name: 'prompt' },
    style: { target: 'config', name: 'style' },
    aspect_ratio: { target: 'config', name: 'aspectRatio' }
  },
  edit_image: {
    image: { target: 'inputs', name: 'image' },
    prompt: { target: 'inputs', name: 'prompt' },
    mask: { target: 'inputs', name: 'mask' }
  },
  compare_images: {
    image1: { target: 'inputs', name: 'originalImage' },
    image2: { target: 'inputs', name: 'newImage' },
    analysis_type: { target: 'config', name: 'analysisType' }
  },
  web_search: {
    query: { target: 'inputs', name: 'query' },
    provider: { target: 'config', name: 'providerId' },
    max_results: { target: 'config', name: 'maxResults' }
  },
  generate_music: {
    description: { target: 'inputs', name: 'description' },
    lyrics: { target: 'inputs', name: 'lyrics' },
    style: { target: 'inputs', name: 'style' },
    title: { target: 'inputs', name: 'title' },
    instrumental: { target: 'config', name: 'instrumental' }
  },
  generate_video: {
    image: { target: 'inputs', name: 'image' },
    prompt: { target: 'inputs', name: 'prompt' },
    duration: { target: 'config', name: 'duration' },
    motion_mode: { target: 'config', name: 'motionMode' }
  },
  http_request: {
    url: { target: 'config', name: 'url' },
    method: { target: 'config', name: 'method' },
    headers: { target: 'inputs', name: 'headers' },
    body: { target: 'inputs', name: 'body' }
  }
}

export class WorkflowBridgeService implements IBuiltinService {
  name = 'WorkflowBridge'
  displayName = 'Workflow 桥接服务'
  description = '将 Cherry Studio Workflow 节点暴露为 VCP 可调用的工具，支持图像生成、网络搜索、音乐生成等功能。'
  version = '1.0.0'
  type = 'builtin_service' as const

  toolDefinitions = WORKFLOW_NODE_TOOLS

  private mainWindow: BrowserWindow | null = null

  async initialize(): Promise<void> {
    logger.info('WorkflowBridgeService initialized', {
      toolCount: this.toolDefinitions.length
    })

    // 注册 IPC 处理器用于接收执行结果
    this.registerIpcHandlers()
  }

  /**
   * 设置主窗口引用（用于 IPC 通信）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
    logger.debug('MainWindow set for WorkflowBridgeService')
  }

  /**
   * 注册 IPC 处理器
   */
  private registerIpcHandlers(): void {
    // 处理节点执行请求
    if (!ipcMain.listenerCount('workflow:execute-node-from-vcp')) {
      ipcMain.handle('workflow:execute-node-from-vcp', async (_, request: NodeExecuteRequest) => {
        return this.executeNodeViaIpc(request)
      })
    }
  }

  /**
   * 执行工具调用
   */
  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    logger.info('Executing workflow command', { command, params })

    try {
      // 处理特殊命令
      if (command === 'run_workflow') {
        return await this.executeWorkflow(params)
      }

      if (command === 'execute_node') {
        const nodeType = String(params.node_type || '')
        const inputs = (params.inputs as Record<string, unknown>) || {}
        const config = (params.config as Record<string, unknown>) || {}
        return await this.executeNode(nodeType, inputs, config)
      }

      // 映射命令到节点类型
      const nodeType = COMMAND_TO_NODE_TYPE[command]
      if (!nodeType) {
        return {
          success: false,
          error: `未知命令: ${command}。可用命令: ${Object.keys(COMMAND_TO_NODE_TYPE).join(', ')}`
        }
      }

      // 转换参数
      const { inputs, config } = this.mapParams(command, params)

      // 执行节点
      const result = await this.executeNode(nodeType, inputs, config)

      return {
        ...result,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error('Workflow command execution failed', {
        command,
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 映射 VCP 参数到节点输入/配置
   */
  private mapParams(
    command: string,
    params: Record<string, unknown>
  ): { inputs: Record<string, unknown>; config: Record<string, unknown> } {
    const inputs: Record<string, unknown> = {}
    const config: Record<string, unknown> = {}

    const mappings = PARAM_MAPPINGS[command] || {}

    for (const [paramName, value] of Object.entries(params)) {
      const mapping = mappings[paramName]
      if (mapping) {
        if (mapping.target === 'inputs') {
          inputs[mapping.name] = value
        } else {
          config[mapping.name] = value
        }
      } else {
        // 未映射的参数默认放入 inputs
        inputs[paramName] = value
      }
    }

    return { inputs, config }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    nodeType: string,
    inputs: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<BuiltinServiceResult> {
    if (!nodeType) {
      return {
        success: false,
        error: '节点类型不能为空'
      }
    }

    logger.debug('Executing node', { nodeType, inputs, config })

    try {
      const result = await this.executeNodeViaIpc({
        nodeType,
        inputs,
        config
      })

      if (result.success) {
        return {
          success: true,
          output: this.formatNodeOutput(nodeType, result.outputs || {}),
          data: result.outputs
        }
      } else {
        return {
          success: false,
          error: result.error || '节点执行失败'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 通过 IPC 执行节点（调用渲染进程的 WorkflowEngine）
   *
   * IPC 通信模式:
   * 1. Main → Renderer: webContents.send('workflow:execute-node', request)
   * 2. Renderer → Main: ipcRenderer.send('workflow:node-result:xxx', result)
   * 3. Main 监听: ipcMain.once('workflow:node-result:xxx', handler)
   */
  private async executeNodeViaIpc(request: NodeExecuteRequest): Promise<NodeExecuteResult> {
    return new Promise((resolve) => {
      // 如果有主窗口，通过 IPC 发送请求
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const requestId = `vcp-node-${Date.now()}-${Math.random().toString(36).substring(7)}`
        const responseChannel = `workflow:node-result:${requestId}`

        // 设置超时
        const timeout = setTimeout(() => {
          ipcMain.removeAllListeners(responseChannel)
          logger.warn('Node execution timeout', { requestId, nodeType: request.nodeType })
          resolve({
            success: false,
            error: '节点执行超时（5分钟）'
          })
        }, 300000) // 5 分钟超时

        // 监听结果 - 使用 ipcMain.once 监听 ipcRenderer.send 发来的消息
        ipcMain.once(responseChannel, (_, result: NodeExecuteResult) => {
          clearTimeout(timeout)
          logger.debug('Received node result', { requestId, success: result.success })
          resolve(result)
        })

        // 发送执行请求到渲染进程
        this.mainWindow.webContents.send('workflow:execute-node', {
          requestId,
          ...request
        })

        logger.debug('Sent node execution request', { requestId, nodeType: request.nodeType })
      } else {
        logger.warn('MainWindow not available for node execution')
        resolve({
          success: false,
          error: '主窗口不可用，无法执行节点'
        })
      }
    })
  }

  /**
   * 执行保存的工作流
   */
  private async executeWorkflow(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const workflowId = String(params.workflow_id || '')
    const inputs = (params.inputs as Record<string, unknown>) || {}

    if (!workflowId) {
      return {
        success: false,
        error: '工作流 ID 不能为空'
      }
    }

    logger.debug('Executing workflow', { workflowId, inputs })

    try {
      const result = await this.executeWorkflowViaIpc(workflowId, inputs)

      if (result.success) {
        return {
          success: true,
          output: this.formatWorkflowOutput(result.outputs || {}),
          data: result.outputs
        }
      } else {
        return {
          success: false,
          error: result.error || '工作流执行失败'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 通过 IPC 执行工作流
   *
   * IPC 通信模式:
   * 1. Main → Renderer: webContents.send('workflow:execute', request)
   * 2. Renderer → Main: ipcRenderer.send('workflow:result:xxx', result)
   * 3. Main 监听: ipcMain.once('workflow:result:xxx', handler)
   */
  private async executeWorkflowViaIpc(workflowId: string, inputs: Record<string, unknown>): Promise<NodeExecuteResult> {
    return new Promise((resolve) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const requestId = `vcp-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`
        const responseChannel = `workflow:result:${requestId}`

        // 设置超时（工作流可能需要更长时间）
        const timeout = setTimeout(() => {
          ipcMain.removeAllListeners(responseChannel)
          logger.warn('Workflow execution timeout', { requestId, workflowId })
          resolve({
            success: false,
            error: '工作流执行超时（10分钟）'
          })
        }, 600000) // 10 分钟超时

        // 监听结果 - 使用 ipcMain.once 监听 ipcRenderer.send 发来的消息
        ipcMain.once(responseChannel, (_, result: NodeExecuteResult) => {
          clearTimeout(timeout)
          logger.debug('Received workflow result', { requestId, success: result.success })
          resolve(result)
        })

        // 发送执行请求到渲染进程
        this.mainWindow.webContents.send('workflow:execute', {
          requestId,
          workflowId,
          inputs
        })

        logger.debug('Sent workflow execution request', { requestId, workflowId })
      } else {
        logger.warn('MainWindow not available for workflow execution')
        resolve({
          success: false,
          error: '主窗口不可用，无法执行工作流'
        })
      }
    })
  }

  /**
   * 格式化工作流输出
   */
  private formatWorkflowOutput(outputs: Record<string, unknown>): string {
    const parts: string[] = ['✅ 工作流执行成功']

    // 统计输出
    const outputCount = Object.keys(outputs).length
    if (outputCount > 0) {
      parts.push(`\n📊 输出 ${outputCount} 个结果:`)

      for (const [key, value] of Object.entries(outputs)) {
        if (value !== undefined && value !== null) {
          const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
          // 截断过长的输出
          const truncated = valueStr.length > 500 ? valueStr.substring(0, 500) + '...' : valueStr
          parts.push(`\n${key}: ${truncated}`)
        }
      }
    }

    return parts.join('')
  }

  /**
   * 格式化节点输出为可读文本
   */
  private formatNodeOutput(nodeType: string, outputs: Record<string, unknown>): string {
    const parts: string[] = [`✅ 节点执行成功 (${nodeType})`]

    // 根据节点类型格式化输出
    switch (nodeType) {
      case 'unified_prompt':
        if (outputs.text) {
          parts.push(`\n📝 AI 回复:\n${outputs.text}`)
        }
        break

      case 'gemini_generate':
      case 'gemini_edit':
        if (outputs.image) {
          parts.push(`\n🖼️ 生成图像: ${outputs.image}`)
        }
        break

      case 'web_search':
        if (outputs.summary) {
          parts.push(`\n🔍 搜索结果:\n${outputs.summary}`)
        }
        if (outputs.count) {
          parts.push(`\n📊 找到 ${outputs.count} 条结果`)
        }
        break

      case 'music_generation':
        if (outputs.audioUrl) {
          parts.push(`\n🎵 音乐链接: ${outputs.audioUrl}`)
        }
        break

      case 'kling_image2video':
        if (outputs.videoUrl) {
          parts.push(`\n🎬 视频链接: ${outputs.videoUrl}`)
        }
        break

      default:
        // 通用格式化
        for (const [key, value] of Object.entries(outputs)) {
          if (value !== undefined && value !== null) {
            parts.push(`\n${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
          }
        }
    }

    return parts.join('')
  }

  async shutdown(): Promise<void> {
    logger.info('WorkflowBridgeService shutdown')
    this.mainWindow = null
  }
}
