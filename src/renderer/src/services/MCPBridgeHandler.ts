/**
 * MCP Bridge Handler (Renderer 端)
 *
 * 处理来自 Main 进程 MCP Server 的请求
 * 调用 Cherry Studio 的 AI 服务并返回结果
 */

import { loggerService } from '@logger'
import { autonomousImageAgent, createBase64Ref, type ImageRef } from '@renderer/pages/workflow/agents'
import store from '@renderer/store'
import { IpcChannel } from '@shared/IpcChannel'

import { WorkflowAiService } from '../pages/workflow/services/WorkflowAiService'

const logger = loggerService.withContext('MCPBridgeHandler')

/**
 * 发送响应回 Main 进程
 */
function sendResponse(requestId: string, success: boolean, data?: any, error?: string): void {
  window.electron.ipcRenderer.send(IpcChannel.MCP_Bridge_Response, {
    requestId,
    success,
    data,
    error
  })
}

/**
 * 获取默认的视觉模型配置
 */
function getDefaultVisionProvider(): { provider: any; model: any } | null {
  const state = store.getState()
  const providers = state.llm.providers

  // 优先查找 Gemini provider
  const geminiProvider = providers.find((p) => p.type === 'gemini' && p.apiKey)
  if (geminiProvider) {
    const visionModel = geminiProvider.models.find(
      (m) => m.id.includes('flash') || m.id.includes('pro') || m.id.includes('vision')
    )
    if (visionModel) {
      return { provider: geminiProvider, model: visionModel }
    }
  }

  // 其次查找支持视觉的其他 provider
  for (const provider of providers) {
    if (provider.apiKey) {
      const visionModel = provider.models.find((m) => m.capabilities?.some((c) => c.type === 'vision'))
      if (visionModel) {
        return { provider, model: visionModel }
      }
    }
  }

  return null
}

/**
 * 获取默认的文本生成模型配置
 */
function getDefaultTextProvider(): { provider: any; model: any } | null {
  const state = store.getState()
  const providers = state.llm.providers
  const defaultModel = state.llm.defaultModel

  // 优先使用默认模型对应的 provider
  if (defaultModel && defaultModel.provider) {
    const defaultProvider = providers.find((p) => p.id === defaultModel.provider && p.apiKey)
    if (defaultProvider) {
      return { provider: defaultProvider, model: defaultModel }
    }
  }

  // 查找任意可用的 provider
  for (const provider of providers) {
    if (provider.apiKey && provider.models.length > 0) {
      return { provider, model: provider.models[0] }
    }
  }

  return null
}

// 存储清理函数
const cleanupFunctions: Array<() => void> = []

/**
 * 初始化 MCP Bridge Handler
 * 注册所有 IPC 监听器
 */
export function initMCPBridgeHandler(): void {
  const ipcRenderer = window.electron.ipcRenderer

  // 视觉分析
  const visionHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, images, systemPrompt, userPrompt } = request

    try {
      const providerConfig = getDefaultVisionProvider()
      if (!providerConfig) {
        sendResponse(requestId, false, undefined, 'No vision model configured')
        return
      }

      const { provider, model } = providerConfig

      // 加载图片
      const loadedImages = await WorkflowAiService.loadImagesForVision(
        images.map((img: any) => img.base64 || img.path || img.url)
      )

      // 调用视觉分析
      const result = await WorkflowAiService.visionAnalysis(provider, model, {
        systemPrompt: systemPrompt || '',
        userPrompt,
        images: loadedImages
      })

      sendResponse(requestId, true, result)
    } catch (error) {
      logger.error('Vision analysis failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_VisionAnalysis, visionHandler))

  // 文本生成
  const textHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, systemPrompt, userPrompt } = request

    try {
      const providerConfig = getDefaultTextProvider()
      if (!providerConfig) {
        sendResponse(requestId, false, undefined, 'No text model configured')
        return
      }

      const { provider, model } = providerConfig

      const result = await WorkflowAiService.generateText(provider, model, {
        systemPrompt: systemPrompt || '',
        userPrompt
      })

      sendResponse(requestId, true, result)
    } catch (error) {
      logger.error('Text generation failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_GenerateText, textHandler))

  // 图片生成
  const imageHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, mode, prompt, systemPrompt, images, aspectRatio, stylePreset } = request

    try {
      const providerConfig = getDefaultVisionProvider()
      if (!providerConfig) {
        sendResponse(requestId, false, undefined, 'No image generation model configured')
        return
      }

      const { provider, model } = providerConfig

      // 加载参考图片
      let loadedImages: any[] = []
      if (images && images.length > 0) {
        loadedImages = await WorkflowAiService.loadImagesForVision(
          images.map((img: any) => img.base64 || img.path || img.url)
        )
      }

      // 根据模式选择不同的生成方法
      let result: string

      if (loadedImages.length > 0) {
        // 有参考图片，使用视觉分析 + 编辑
        result = await WorkflowAiService.visionAnalysis(provider, model, {
          systemPrompt: systemPrompt || `You are an AI image generator. Mode: ${mode}`,
          userPrompt: prompt,
          images: loadedImages
        })
      } else {
        // 纯文本生成
        result = await WorkflowAiService.generateText(provider, model, {
          systemPrompt: systemPrompt || `You are an AI image generator. Mode: ${mode}`,
          userPrompt: prompt
        })
      }

      sendResponse(requestId, true, {
        success: true,
        images: [result],
        mode,
        aspectRatio,
        stylePreset
      })
    } catch (error) {
      logger.error('Image generation failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_GenerateImage, imageHandler))

  // 自主图片生成
  const autonomousHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, userMessage, images, taskType, enableBack, enableDetail, aspectRatio, imageSize } = request

    try {
      const providerConfig = getDefaultVisionProvider()
      if (!providerConfig) {
        sendResponse(requestId, false, undefined, 'No image generation model configured')
        return
      }

      const { provider, model } = providerConfig

      // 设置生成和分析函数
      autonomousImageAgent.setGenerateImageFunc(async (params) => {
        try {
          // 调用 WorkflowAiService.generateImage，返回类型是 string (base64)
          const imageResult = await WorkflowAiService.generateImage(provider, model, {
            prompt: params.prompt,
            systemPrompt: params.systemPrompt,
            images: params.images,
            aspectRatio: (params.config.aspectRatio as string) || aspectRatio || '1:1',
            imageSize: (params.config.imageSize as string) || imageSize || '2K'
          })

          // generateImage 返回 string (base64)，成功时包装为数组
          return { images: [imageResult] }
        } catch (error) {
          return { images: [], error: error instanceof Error ? error.message : String(error) }
        }
      })

      autonomousImageAgent.setAnalyzeImageFunc(async (imgs, prompt) => {
        const loadedImages = await WorkflowAiService.loadImagesForVision(imgs)
        return WorkflowAiService.visionAnalysis(provider, model, {
          systemPrompt: 'You are an expert fashion analyst. Analyze the image and provide structured information.',
          userPrompt: prompt,
          images: loadedImages
        })
      })

      // 转换图片格式 - 使用正确的 ImageRef 创建函数
      const imageRefs: ImageRef[] = (images || [])
        .filter((img: any) => img.base64 || img.path || img.url)
        .map((img: any) => {
          if (img.base64) {
            return createBase64Ref(img.base64, { filename: 'input.png' })
          }
          // 其他类型暂时也转为 base64 类型（简化处理）
          return createBase64Ref(img.path || img.url || '', { filename: 'input.png' })
        })

      // 执行自主生成
      const result = await autonomousImageAgent.execute({
        userMessage,
        images: imageRefs,
        constraints: {
          taskType: taskType || 'auto',
          // 传递额外参数
          targetCount: enableDetail ? 5 : enableBack ? 2 : 1
        }
      })

      // 合并结果 - 从 ImageRef 中提取 base64 值
      const extractBase64 = (refs?: ImageRef[]): string[] => {
        if (!refs) return []
        return refs
          .filter((img) => img.type === 'base64')
          .map((img) => img.value)
          .filter(Boolean)
      }

      const allImages: { main?: string[]; back?: string[]; detail?: string[] } = {
        main: extractBase64(result.images.main),
        back: extractBase64(result.images.back),
        detail: extractBase64(result.images.detail)
      }

      sendResponse(requestId, true, {
        success: result.success,
        taskType: result.taskType,
        images: allImages,
        plan: result.executionPlan
          ? {
              steps: result.executionPlan.steps.map((s) => ({ stepId: s.stepId, description: s.description })),
              estimatedTime: result.executionPlan.estimatedTotalTime
            }
          : undefined,
        error: result.error
      })
    } catch (error) {
      logger.error('Autonomous generation failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_AutonomousGenerate, autonomousHandler))

  // 多Agent协同图片生成
  const collaborativeHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const {
      requestId,
      userMessage,
      images,
      template,
      taskType,
      maxRetries: _maxRetries,
      showThinking: _showThinking
    } = request

    try {
      // 动态导入 ImageCollaborationGroupService
      const { imageCollaborationGroupService } = await import('@renderer/services/ImageCollaborationGroupService')
      // createBase64Ref 和 ImageRef 已在文件顶部导入

      // 初始化服务 - 优先使用设置，其次使用请求中的模板
      let initialized: boolean
      if (template) {
        // 明确指定模板时使用该模板
        initialized = await imageCollaborationGroupService.initialize(template)
      } else {
        // 未指定模板时从设置中读取
        initialized = await imageCollaborationGroupService.initializeFromSettings()
      }

      if (!initialized) {
        sendResponse(requestId, false, undefined, 'Failed to initialize collaboration service')
        return
      }

      // 转换图片格式
      const imageRefs: ImageRef[] = (images || [])
        .filter((img: any) => img.base64 || img.path || img.url)
        .map((img: any) => {
          if (img.base64) {
            return createBase64Ref(img.base64, { filename: 'input.png' })
          }
          return createBase64Ref(img.path || img.url || '', { filename: 'input.png' })
        })

      // 执行协同生成
      const result = await imageCollaborationGroupService.execute({
        userMessage,
        images: imageRefs,
        taskType: taskType || 'auto'
      })

      // 提取 base64 值
      const extractBase64 = (refs?: ImageRef[]): string[] => {
        if (!refs) return []
        return refs
          .filter((img) => img.type === 'base64')
          .map((img) => img.value)
          .filter(Boolean)
      }

      sendResponse(requestId, true, {
        success: result.success,
        taskType: result.executionPlan?.taskType,
        images: {
          main: extractBase64(result.images.main),
          back: extractBase64(result.images.back),
          detail: extractBase64(result.images.detail)
        },
        messages: result.messages.map((m) => ({
          senderRole: m.senderRole,
          senderName: m.senderName,
          content: m.content,
          type: m.type
        })),
        qualityReviews: result.qualityReviews,
        stats: result.stats,
        error: result.error
      })
    } catch (error) {
      logger.error('Collaborative generation failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_CollaborativeGenerate, collaborativeHandler))

  // 知识库搜索
  const searchHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, knowledgeBaseId, query, topK } = request

    try {
      const state = store.getState()
      const knowledgeBase = state.knowledge.bases.find((kb) => kb.id === knowledgeBaseId)

      if (!knowledgeBase) {
        sendResponse(requestId, false, undefined, `Knowledge base not found: ${knowledgeBaseId}`)
        return
      }

      // 调用知识库搜索
      const { searchKnowledgeBase } = await import('@renderer/services/KnowledgeService')
      const results = await searchKnowledgeBase(query, knowledgeBase, undefined, 'mcp-bridge')

      // 格式化结果
      const formattedResults = results.slice(0, topK || 10).map((r: any) => ({
        content: r.pageContent,
        score: r.score,
        metadata: r.metadata
      }))

      sendResponse(requestId, true, { results: formattedResults })
    } catch (error) {
      logger.error('Knowledge search failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_SearchKnowledge, searchHandler))

  // 获取知识库列表
  const listKBHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId } = request

    try {
      const state = store.getState()
      const bases = state.knowledge.bases.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        documentCount: kb.documentCount || kb.items?.length || 0
      }))

      sendResponse(requestId, true, bases)
    } catch (error) {
      logger.error('List knowledge bases failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_ListKnowledgeBases, listKBHandler))

  // 执行工作流
  const executeHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, workflowId, inputs } = request

    try {
      // 这里需要调用工作流执行引擎
      // TODO: 实现完整工作流执行
      sendResponse(requestId, true, {
        success: true,
        message: 'Workflow execution started',
        workflowId,
        inputs
      })
    } catch (error) {
      logger.error('Workflow execution failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_ExecuteWorkflow, executeHandler))

  // 获取工作流列表
  const listWFHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId } = request

    try {
      const state = store.getState()
      const workflows = state.workflow.templates.map((wf: any) => ({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        tags: wf.tags
      }))

      sendResponse(requestId, true, workflows)
    } catch (error) {
      logger.error('List workflows failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_ListWorkflows, listWFHandler))

  // 网络搜索
  const webSearchHandler = async (_event: Electron.IpcRendererEvent, request: any) => {
    const { requestId, query, providerId, maxResults } = request

    try {
      const WebSearchService = (await import('@renderer/services/WebSearchService')).default
      const state = store.getState()

      // 获取搜索提供商
      let provider = state.websearch.providers.find((p) => p.id === providerId)
      if (!provider) {
        // 使用第一个已配置的提供商
        provider = state.websearch.providers.find((p) => {
          if (p.id.startsWith('local-')) return true
          if ('apiKey' in p && p.apiKey) return true
          if ('apiHost' in p && p.apiHost) return true
          return false
        })
      }

      if (!provider) {
        sendResponse(requestId, false, undefined, 'No web search provider configured')
        return
      }

      // 执行搜索
      const response = await WebSearchService.search(provider, query)

      // 格式化结果
      const results = (response.results || []).slice(0, maxResults || 10).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || r.description || '',
        score: r.score
      }))

      sendResponse(requestId, true, { results })
    } catch (error) {
      logger.error('Web search failed', error as Error)
      sendResponse(requestId, false, undefined, error instanceof Error ? error.message : String(error))
    }
  }
  cleanupFunctions.push(ipcRenderer.on(IpcChannel.MCP_Bridge_WebSearch, webSearchHandler))

  logger.info('MCPBridgeHandler initialized')
}

/**
 * 清理 MCP Bridge Handler
 * 移除所有 IPC 监听器
 */
export function cleanupMCPBridgeHandler(): void {
  cleanupFunctions.forEach((cleanup) => cleanup())
  cleanupFunctions.length = 0
  logger.info('MCPBridgeHandler cleaned up')
}
