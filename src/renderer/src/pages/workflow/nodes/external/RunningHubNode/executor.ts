/**
 * RunningHub 换装节点执行器 v2.0
 *
 * 深度优化版本，支持：
 * - 多输入端口动态绑定
 * - 工作流配置自动获取
 * - 多输出图片处理
 * - 完善的重试和超时机制
 * - 详细的执行元数据
 */

import type { RunningHubNodeInfo } from '@renderer/services/externalServices'

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface RunningHubConfig {
  // 应用配置
  webappId?: string
  workflowName?: string
  // 参数绑定
  autoBinding?: boolean
  inputBindings?: string
  // 工作流模式
  workflowMode?: 'tryon' | 'generation' | 'editing' | 'custom'
  // 高级选项
  timeout?: number
  retryCount?: number
  pollingInterval?: number
  // 从 API 获取的节点配置
  nodeInfoList?: Array<{
    nodeId: string
    nodeName?: string
    fieldName: string
    fieldType: 'STRING' | 'LIST' | 'IMAGE' | 'AUDIO' | 'VIDEO'
    fieldValue: string
    fieldData?: string
    description?: string
  }>
  // LIST 类型的下拉框值 { portId: value }
  listValues?: Record<string, string>
  // 端口 ID 到原始节点信息的映射（如 image_1 -> { nodeId: "3", fieldName: "image" }）
  portMapping?: Record<string, { nodeId: string; fieldName: string }>
  // 动态输入端口配置（从 API 获取后生成）
  imageInputPorts?: Array<{ id: string; label: string; dataType: string; required?: boolean }>
  inputPorts?: Array<{ id: string; label: string; dataType: string; required?: boolean }>
  imageInputCount?: number
}

// 工作流模式对应的默认绑定
const MODE_DEFAULT_BINDINGS: Record<string, Record<string, string>> = {
  tryon: {
    modelImage: 'LoadImage_1',
    clothesImage: 'LoadImage_2',
    maskImage: 'LoadMask_1'
  },
  generation: {
    promptJson: 'CLIPTextEncode_1',
    customPrompt: 'CLIPTextEncode_2'
  },
  editing: {
    modelImage: 'LoadImage_1',
    maskImage: 'LoadMask_1',
    customPrompt: 'CLIPTextEncode_1'
  },
  custom: {}
}

export class RunningHubExecutor extends BaseNodeExecutor {
  constructor() {
    super('runninghub_app')
  }

  async execute(
    inputs: Record<string, any>,
    config: RunningHubConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const metadata: Record<string, any> = {
      executedAt: new Date().toISOString(),
      config: { ...config },
      inputs: Object.keys(inputs)
    }

    try {
      this.log(context, '开始执行 RunningHub v2.0')

      // 1. 检查必要配置
      if (!config.webappId) {
        return this.error('请配置 RunningHub 应用 ID (webappId)')
      }

      // 2. 动态导入 RunningHub 客户端
      const { RunningHubClient } = await import('../../../clients')
      const runningHubClient = new RunningHubClient()

      // 3. 获取工作流配置（可选，用于自动绑定）
      let workflowConfig: any = null
      if (config.autoBinding) {
        try {
          this.log(context, '获取工作流配置...')
          workflowConfig = await runningHubClient.getWorkflowConfig(config.webappId)
          metadata.workflowConfig = workflowConfig
          this.log(context, '工作流配置获取成功', { nodeCount: workflowConfig?.nodes?.length })
        } catch (error) {
          this.log(context, '获取工作流配置失败，使用默认绑定', { error: String(error) })
        }
      }

      // 4. 解析输入绑定
      const bindings = this.resolveBindings(config, workflowConfig)
      metadata.bindings = bindings
      this.log(context, '解析的输入绑定', { bindings })

      // 5. 准备上传图片并构建请求参数
      // 只处理已连接的输入端口（inputs 中有值的）
      const nodeInfos = await this.prepareNodeInfos(inputs, bindings, runningHubClient, context, config)

      // 5.1 【重要】对于未连接的图片端口，明确传递空字符串
      // 这样 RunningHub 就不会使用默认图片，而是跳过该图片
      if (config.imageInputPorts && config.portMapping) {
        for (const port of config.imageInputPorts) {
          // 只处理图片类型的端口
          if (port.dataType !== 'image') continue

          // 检查该端口是否已在 inputs 中（已连接）
          const isConnected = port.id in inputs && inputs[port.id]

          if (!isConnected) {
            // 未连接的图片端口 - 获取映射关系
            const mapping = config.portMapping[port.id]
            if (mapping) {
              // 传递空字符串，告诉 RunningHub 不要使用默认图片
              nodeInfos.push({
                nodeId: mapping.nodeId,
                fieldName: mapping.fieldName,
                fieldType: 'IMAGE',
                fieldValue: '' // 空字符串表示不使用默认图片
              })
              this.log(context, `未连接的图片端口，传递空值: ${port.id} -> nodeId=${mapping.nodeId}`)
            }
          }
        }
      }

      // 5.2 添加 LIST 类型的配置值（从配置面板的下拉框）
      if (config.listValues && config.nodeInfoList) {
        for (const [portId, value] of Object.entries(config.listValues)) {
          if (!value) continue

          let nodeId: string | undefined
          let fieldName: string | undefined

          // 1. 优先使用 portMapping（新统一格式）
          if (config.portMapping && config.portMapping[portId]) {
            const mapping = config.portMapping[portId]
            nodeId = mapping.nodeId
            fieldName = mapping.fieldName
          } else {
            // 2. 兼容旧格式 `${nodeId}_${fieldName}`
            const match = portId.match(/^(\d+)_(.+)$/)
            if (match) {
              ;[, nodeId, fieldName] = match
            }
          }

          if (nodeId && fieldName) {
            // 查找对应的节点配置获取 fieldType
            const nodeConfig = config.nodeInfoList.find((n) => n.nodeId === nodeId && n.fieldName === fieldName)
            if (nodeConfig && nodeConfig.fieldType === 'LIST') {
              nodeInfos.push({
                nodeId,
                fieldName,
                fieldType: 'LIST',
                fieldValue: value
              })
              this.log(context, `添加 LIST 配置: ${portId} = ${value}`)
            }
          }
        }
      }

      metadata.nodeInfos = nodeInfos.map((n) => ({ nodeId: n.nodeId, fieldName: n.fieldName, fieldType: n.fieldType }))

      // 6. 执行工作流
      this.log(context, '提交 RunningHub 任务...')

      const { runningHubService } = await import('@renderer/services/externalServices')

      const timeout = config.timeout || 300
      const retryCount = config.retryCount || 2

      let lastError: Error | null = null
      let resultUrls: string[] = []

      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          if (attempt > 0) {
            this.log(context, `重试第 ${attempt} 次...`)
          }

          // 调用 RunningHub API
          resultUrls = await runningHubService.runAndWait(config.webappId, nodeInfos, {
            timeout: timeout * 1000,
            pollingInterval: (config.pollingInterval || 3) * 1000
          })

          if (resultUrls && resultUrls.length > 0) {
            break // 成功，跳出重试循环
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.log(context, `执行失败: ${lastError.message}`)

          if (attempt === retryCount) {
            throw lastError
          }

          // 等待一段时间后重试
          await this.sleep(2000)
        }
      }

      if (!resultUrls || resultUrls.length === 0) {
        return this.error('RunningHub 未返回任何图片', Date.now() - startTime)
      }

      const duration = Date.now() - startTime
      this.log(context, `执行完成，返回 ${resultUrls.length} 张图片`, { duration: `${duration}ms` })

      // 7. 返回结果
      metadata.duration = duration
      metadata.imageCount = resultUrls.length

      return this.success(
        {
          images: resultUrls,
          image: resultUrls[0] || null,
          metadata
        },
        duration
      )
    } catch (error) {
      this.logError(context, 'RunningHub 执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 解析输入绑定
   */
  private resolveBindings(config: RunningHubConfig, workflowConfig: any): Record<string, string> {
    // 1. 如果有自定义绑定，优先使用
    if (config.inputBindings) {
      try {
        return JSON.parse(config.inputBindings)
      } catch {
        // 解析失败，继续使用其他方式
      }
    }

    // 2. 如果有工作流配置，尝试自动检测绑定
    if (workflowConfig && config.autoBinding) {
      const autoBindings = this.autoDetectBindings(workflowConfig)
      if (Object.keys(autoBindings).length > 0) {
        return autoBindings
      }
    }

    // 3. 使用工作流模式的默认绑定
    const mode = config.workflowMode || 'tryon'
    return MODE_DEFAULT_BINDINGS[mode] || {}
  }

  /**
   * 自动检测绑定（基于工作流配置）
   */
  private autoDetectBindings(workflowConfig: any): Record<string, string> {
    const bindings: Record<string, string> = {}

    if (!workflowConfig?.nodes) {
      return bindings
    }

    // 查找 LoadImage 节点
    const loadImageNodes = workflowConfig.nodes.filter(
      (n: any) => n.class_type === 'LoadImage' || n.type === 'LoadImage'
    )

    // 按顺序绑定图片输入
    const imageInputs = ['modelImage', 'clothesImage', 'maskImage']
    loadImageNodes.forEach((node: any, index: number) => {
      if (index < imageInputs.length) {
        bindings[imageInputs[index]] = node.id || `LoadImage_${index + 1}`
      }
    })

    // 查找文本输入节点
    const textNodes = workflowConfig.nodes.filter(
      (n: any) => n.class_type === 'CLIPTextEncode' || n.type?.includes('Text')
    )

    if (textNodes.length > 0) {
      bindings['customPrompt'] = textNodes[0].id || 'CLIPTextEncode_1'
    }

    return bindings
  }

  /**
   * 准备节点信息（上传图片、构建请求参数）
   * 支持三种输入格式：
   * 1. 统一端口 ID：inputKey 格式为 `image_1`，通过 portMapping 查找原始 nodeId/fieldName
   * 2. 静态绑定：inputKey 通过 bindings 映射到 nodeId
   * 3. 动态端口（旧格式兼容）：inputKey 格式为 `${nodeId}_${fieldName}`，直接解析
   */
  private async prepareNodeInfos(
    inputs: Record<string, any>,
    bindings: Record<string, string>,
    runningHubClient: any,
    context: NodeExecutionContext,
    config: RunningHubConfig
  ): Promise<RunningHubNodeInfo[]> {
    const nodeInfos: RunningHubNodeInfo[] = []

    for (const [inputKey, inputValue] of Object.entries(inputs)) {
      // 跳过空值、null、undefined、空字符串
      if (!inputValue || (typeof inputValue === 'string' && inputValue.trim() === '')) {
        continue
      }

      // 尝试从 portMapping 获取原始 nodeId/fieldName（统一端口 ID 格式，如 image_1）
      let nodeId: string | undefined
      let fieldName = 'image' // 默认字段名

      // 1. 优先使用 portMapping（新统一格式 image_1, image_2）
      if (config.portMapping && config.portMapping[inputKey]) {
        const mapping = config.portMapping[inputKey]
        nodeId = mapping.nodeId
        fieldName = mapping.fieldName
        this.log(context, `从 portMapping 解析: ${inputKey} -> nodeId=${nodeId}, fieldName=${fieldName}`)
      }

      // 2. 尝试从 bindings 获取 nodeId（静态绑定模式）
      if (!nodeId) {
        nodeId = bindings[inputKey]
      }

      // 3. 如果没有找到绑定，尝试解析旧的动态端口 ID 格式: `${nodeId}_${fieldName}`（向后兼容）
      if (!nodeId) {
        const dynamicMatch = inputKey.match(/^(\d+)_(.+)$/)
        if (dynamicMatch) {
          nodeId = dynamicMatch[1]
          fieldName = dynamicMatch[2]
          this.log(context, `解析旧动态端口格式: ${inputKey} -> nodeId=${nodeId}, fieldName=${fieldName}`)
        } else {
          this.log(context, `跳过未绑定的输入: ${inputKey}`)
          continue
        }
      }

      // 判断输入类型
      const isImage = this.isImageInput(inputKey, inputValue) || fieldName === 'image'

      if (isImage) {
        // 验证图片输入是否有效
        if (!this.isValidImageValue(inputValue)) {
          this.log(context, `跳过无效的图片输入: ${inputKey}`, { value: String(inputValue).substring(0, 100) })
          continue
        }

        // 上传图片到 RunningHub
        this.log(context, `上传图片: ${inputKey}`)
        try {
          const imageUrl = await this.uploadImage(inputValue, runningHubClient)
          nodeInfos.push({
            nodeId,
            fieldName: fieldName === 'image' ? 'image' : fieldName,
            fieldType: 'IMAGE',
            fieldValue: imageUrl
          })
          this.log(context, `图片上传成功: ${inputKey}`)
        } catch (error) {
          this.log(context, `图片上传失败: ${inputKey}`, { error: String(error) })
          throw new Error(`图片上传失败 (${inputKey}): ${error instanceof Error ? error.message : String(error)}`)
        }
      } else if (inputKey === 'promptJson' && typeof inputValue === 'object') {
        // JSON 提示词 - 提取关键字段
        const prompt = inputValue.prompt || inputValue.caption || inputValue.video_prompt || JSON.stringify(inputValue)
        nodeInfos.push({
          nodeId,
          fieldName: fieldName === 'text' ? 'text' : fieldName,
          fieldType: 'STRING',
          fieldValue: prompt
        })
      } else {
        // 文本输入
        nodeInfos.push({
          nodeId,
          fieldName: fieldName === 'text' ? 'text' : fieldName,
          fieldType: 'STRING',
          fieldValue: String(inputValue)
        })
      }
    }

    return nodeInfos
  }

  /**
   * 判断是否为图片输入
   */
  private isImageInput(key: string, value: any): boolean {
    // 根据键名判断
    const imageKeys = ['image', 'modelImage', 'clothesImage', 'maskImage', 'baseImage', 'referenceImage']
    if (imageKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      return true
    }

    // 根据值判断
    if (typeof value === 'string') {
      return (
        value.startsWith('data:image') ||
        value.startsWith('http') ||
        value.startsWith('file://') ||
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(value)
      )
    }

    return false
  }

  /**
   * 验证图片输入值是否有效
   * 检查是否是有效的图片来源：URL、文件路径、base64 或 data URL
   */
  private isValidImageValue(value: any): boolean {
    if (!value) return false
    if (typeof value !== 'string') return false

    const trimmed = value.trim()
    if (!trimmed) return false

    // 有效的图片格式
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('file://') ||
      trimmed.startsWith('file:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:image') ||
      /^[A-Za-z]:[\\/]/.test(trimmed) || // Windows 绝对路径
      trimmed.startsWith('/') || // Unix 绝对路径
      // 检查是否是有效的 base64（至少有一定长度且只包含 base64 字符）
      (trimmed.length > 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed))
    )
  }

  /**
   * 上传图片到 RunningHub
   * 支持多种输入格式：HTTP URL、file:// URL、blob: URL、data: URL、base64 字符串、存储 ID
   */
  private async uploadImage(imageData: string, runningHubClient: any): Promise<string> {
    // 如果已经是 HTTP/HTTPS URL，直接返回
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return imageData
    }

    // 处理 data: URL（提取 base64 部分）
    if (imageData.startsWith('data:image')) {
      const base64Data = imageData.split(',')[1] || imageData
      const fileName = `workflow_${Date.now()}.png`
      return await runningHubClient.uploadBase64Image(base64Data, fileName)
    }

    // 处理存储 ID（UUID 格式）- 使用主应用文件存储服务
    if (/^[a-f0-9-]{36}$/i.test(imageData)) {
      const result = await window.api.file.base64Image(imageData)
      const base64Data = typeof result === 'object' && 'base64' in result ? result.base64 : result
      const fileName = `workflow_${Date.now()}.png`
      return await runningHubClient.uploadBase64Image(base64Data, fileName)
    }

    // 处理 blob: URL
    if (imageData.startsWith('blob:')) {
      const base64Data = await this.blobUrlToBase64(imageData)
      const fileName = `workflow_${Date.now()}.png`
      return await runningHubClient.uploadBase64Image(base64Data, fileName)
    }

    // 处理 file:// URL 或本地文件路径
    if (
      imageData.startsWith('file://') ||
      imageData.startsWith('file:') ||
      /^[A-Za-z]:[\\/]/.test(imageData) ||
      imageData.startsWith('/')
    ) {
      // 清理 file:// 前缀
      const filePath = imageData.replace(/^file:(\/\/)?/, '')
      const base64Data = await this.readFileAsBase64(filePath)
      const fileName = `workflow_${Date.now()}.png`
      return await runningHubClient.uploadBase64Image(base64Data, fileName)
    }

    // 检查是否是纯 base64 字符串
    if (!imageData.includes('/') && !imageData.includes('\\')) {
      if (/^[A-Za-z0-9+/=]+$/.test(imageData) && imageData.length > 100) {
        const fileName = `workflow_${Date.now()}.png`
        return await runningHubClient.uploadBase64Image(imageData, fileName)
      }
    }

    // 最后尝试作为文件路径处理
    const base64Data = await this.readFileAsBase64(imageData)
    const fileName = `workflow_${Date.now()}.png`
    return await runningHubClient.uploadBase64Image(base64Data, fileName)
  }

  /**
   * 读取本地文件为 base64
   * 使用 window.api.fs.readBase64 读取本地文件路径
   */
  private async readFileAsBase64(filePath: string): Promise<string> {
    try {
      // 优先使用 fs.readBase64 - 这是专门为此设计的 API
      if (window.api?.fs?.readBase64) {
        const base64Content = await window.api.fs.readBase64(filePath)
        if (base64Content) {
          return base64Content
        }
      }

      // 备用方案：尝试使用 file.base64Image（用于存储系统中的文件）
      const result: unknown = await window.api.file.base64Image(filePath)
      if (typeof result === 'object' && result !== null && 'base64' in result) {
        return (result as { base64: string }).base64
      }
      if (typeof result === 'string') {
        if (result.startsWith('data:image')) {
          return result.split(',')[1] || result
        }
        return result
      }

      throw new Error('无法读取文件：返回格式不正确')
    } catch (error) {
      throw new Error(`读取本地文件失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 将 blob URL 转换为 base64
   */
  private async blobUrlToBase64(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          // 移除 data URL 前缀
          const base64 = result.split(',')[1] || result
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      throw new Error(`Blob URL 转换失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export default RunningHubExecutor
