/**
 * AI Workflow MCP Server - Cherry Studio 内置版
 *
 * 提供工作流管理和执行相关的 MCP 工具
 * 移植自旧后端 Python 实现
 *
 * @version 1.2.0
 * @updated 2024-12-25 使用 MCPBridge 进行 AI 调用
 */

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { mcpBridge } from './shared/MCPBridge'

const logger = loggerService.withContext('MCPServer:Workflow')

// ==================== 类型定义 ====================

interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  tags?: string[]
  workflow: any
  createdAt?: number
  updatedAt?: number
}

interface JobStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  total: number
  done: number
  failed: number
  message?: string
  processedIds?: string[]
  errorItems?: Record<string, string>
  createdAt?: number
  updatedAt?: number
}

// ==================== 工具定义 ====================

const WORKFLOW_TOOLS: Tool[] = [
  // 1. 列出工作流
  {
    name: 'workflow_list',
    description: `列出所有可用的工作流模板。
返回工作流列表，包含 ID、名称、描述、标签等信息。`,
    inputSchema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '按标签筛选'
        },
        limit: {
          type: 'integer',
          description: '返回数量限制',
          default: 20
        }
      }
    }
  },

  // 2. 获取工作流详情
  {
    name: 'workflow_get',
    description: `获取指定工作流的详细信息。
返回工作流的完整定义，包括节点和连线配置。`,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: '工作流 ID'
        }
      },
      required: ['workflowId']
    }
  },

  // 3. 执行工作流
  {
    name: 'workflow_execute',
    description: `执行指定的工作流。
提交工作流任务并返回任务 ID，可通过 workflow_job_status 查询执行状态。

输入参数说明:
- workflowId: 要执行的工作流 ID
- inputs: 工作流输入参数，根据工作流定义提供图片路径、文本等`,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: '工作流 ID'
        },
        inputs: {
          type: 'object',
          description: '工作流输入参数',
          properties: {
            inputDir1: { type: 'string', description: '图片目录 1' },
            inputDir2: { type: 'string', description: '图片目录 2' },
            inputDir3: { type: 'string', description: '图片目录 3' },
            inputDir4: { type: 'string', description: '图片目录 4' },
            text: { type: 'string', description: '文本输入' }
          }
        },
        async: {
          type: 'boolean',
          description: '是否异步执行',
          default: true
        }
      },
      required: ['workflowId']
    }
  },

  // 4. 查询任务状态
  {
    name: 'workflow_job_status',
    description: `查询工作流任务的执行状态。
返回任务进度、已处理数量、错误信息等。

状态说明:
- pending: 等待执行
- running: 执行中
- completed: 已完成
- failed: 执行失败
- cancelled: 已取消`,
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: '任务 ID'
        }
      },
      required: ['jobId']
    }
  },

  // 5. 取消任务
  {
    name: 'workflow_job_cancel',
    description: `取消正在执行的工作流任务。`,
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: '任务 ID'
        }
      },
      required: ['jobId']
    }
  },

  // 6. 列出任务历史
  {
    name: 'workflow_job_list',
    description: `列出工作流任务历史记录。
返回最近的任务列表，包含状态和进度信息。`,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          description: '按状态筛选'
        },
        limit: {
          type: 'integer',
          description: '返回数量限制',
          default: 20
        }
      }
    }
  },

  // 7. 单步执行
  {
    name: 'workflow_step_execute',
    description: `执行单个工作流步骤。
可用于调试或单独执行某个 AI 操作。

支持的步骤类型:
- unified_prompt: 统一提示词生成（智能AI提取图片要素）
- video_prompt: 视频提示词生成
- gemini_edit: Gemini 图片编辑
- gemini_generate: Gemini 图片生成
- gemini_pattern: Gemini 图案生成
- gemini_ecom: Gemini 电商实拍图生成
- kling_image2video: Kling 图生视频
- runninghub_app: RunningHub 应用调用
- compare_image: 图片对比`,
    inputSchema: {
      type: 'object',
      properties: {
        stepType: {
          type: 'string',
          enum: [
            'unified_prompt',
            'video_prompt',
            'gemini_edit',
            'gemini_edit_custom',
            'gemini_generate',
            'gemini_generate_model',
            'gemini_ecom',
            'gemini_model_from_clothes',
            'gemini_pattern',
            'kling_image2video',
            'runninghub_app',
            'compare_image'
          ],
          description: '步骤类型'
        },
        params: {
          type: 'object',
          description: '步骤参数'
        },
        inputImage: {
          type: 'string',
          description: '输入图片路径'
        },
        inputImageBase64: {
          type: 'string',
          description: '输入图片 Base64'
        }
      },
      required: ['stepType']
    }
  },

  // 8. AI 客户端直接调用
  {
    name: 'workflow_ai_call',
    description: `直接调用 AI 服务。
用于执行单个 AI 操作，无需创建完整工作流。

支持的 Provider:
- qwen: 通义千问 (文本生成、视觉分析)
- gemini: Google Gemini (图片编辑、生成)
- kling: 可灵 (图生视频)
- runninghub: RunningHub (ComfyUI 工作流)`,
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['qwen', 'gemini', 'kling', 'runninghub'],
          description: 'AI 提供方'
        },
        action: {
          type: 'string',
          description: '操作类型'
        },
        params: {
          type: 'object',
          description: '操作参数'
        },
        inputImage: {
          type: 'string',
          description: '输入图片路径'
        }
      },
      required: ['provider', 'action']
    }
  },

  // 9. 图片上传
  {
    name: 'workflow_image_upload',
    description: `上传图片到工作流系统。
支持多种输入格式:
- base64: Base64 编码的图片数据
- path: 本地文件路径
- url: 网络图片 URL`,
    inputSchema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              base64: { type: 'string' },
              path: { type: 'string' },
              url: { type: 'string' }
            }
          },
          description: '图片数据列表'
        },
        sessionId: {
          type: 'string',
          description: '会话 ID'
        },
        compress: {
          type: 'boolean',
          description: '是否压缩',
          default: false
        }
      },
      required: ['images']
    }
  },

  // 10. 健康检查
  {
    name: 'workflow_health_check',
    description: `检查工作流服务状态。
返回系统状态和各 AI 服务的配置情况。`,
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // 11. 自动组装工作流
  {
    name: 'workflow_compose',
    description: `根据用户描述自动组装和执行工作流。
AI 助手分析用户需求，自动选择合适的节点组合生成图片或视频。

使用场景:
- "帮我生成一张可爱的恐龙无缝图案"
- "把这张图片的模特换成户外场景"
- "为这件衣服生成电商实拍图"
- "生成一个展示这件衣服的短视频"

支持的任务类型:
- pattern: 图案生成（无缝图案、T恤印花等）
- ecom: 电商实拍图（Ghost Mannequin、模特换装）
- model: 模特生成（根据服装生成模特图）
- video: 视频生成（图片转视频）
- edit: 图片编辑（局部修改、背景替换）`,
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '用户需求描述'
        },
        taskType: {
          type: 'string',
          enum: ['pattern', 'ecom', 'model', 'video', 'edit', 'auto'],
          description: '任务类型，auto 时由 AI 自动判断',
          default: 'auto'
        },
        inputImages: {
          type: 'array',
          items: { type: 'string' },
          description: '输入图片路径列表'
        },
        stylePreset: {
          type: 'string',
          description: '风格预设名称（用于图案生成）'
        },
        outputFormat: {
          type: 'string',
          enum: ['image', 'images', 'video'],
          description: '期望的输出格式',
          default: 'image'
        }
      },
      required: ['description']
    }
  },

  // 12. 图片生成（核心工具）
  {
    name: 'generate_image',
    description: `使用 Gemini AI 生成或编辑图片。
这是工作流系统的核心图片生成工具，支持多种模式：

生成模式 (mode):
- generate: 纯文本生成图片
- edit: 基于参考图编辑/生成
- pattern: 生成无缝图案
- ecom: 生成电商实拍图
- model: 生成模特图

输入参数:
- prompt: 生成提示词（必填）
- systemPrompt: 系统角色提示词（可选）
- images: 参考图片列表，支持 Base64 或文件路径（可选）
- aspectRatio: 宽高比，如 1:1, 3:4, 16:9（默认 1:1）
- imageSize: 图片尺寸，如 1K, 2K, 4K（默认 2K）

返回:
- success: 是否成功
- image: 生成的图片（Base64 或文件路径）
- error: 错误信息（如果失败）`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['generate', 'edit', 'pattern', 'ecom', 'model'],
          description: '生成模式',
          default: 'generate'
        },
        prompt: {
          type: 'string',
          description: '生成提示词'
        },
        systemPrompt: {
          type: 'string',
          description: '系统角色提示词'
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              base64: { type: 'string', description: 'Base64 编码的图片数据' },
              path: { type: 'string', description: '本地文件路径' },
              url: { type: 'string', description: '网络图片 URL' }
            }
          },
          description: '参考图片列表'
        },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2'],
          description: '输出图片宽高比',
          default: '1:1'
        },
        imageSize: {
          type: 'string',
          enum: ['1K', '2K', '4K', 'HD', 'FHD'],
          description: '输出图片尺寸',
          default: '2K'
        },
        negativePrompt: {
          type: 'string',
          description: '负面提示词（不想要的元素）'
        },
        stylePreset: {
          type: 'string',
          description: '风格预设名称'
        }
      },
      required: ['prompt']
    }
  },

  // 13. 自主图片生成（AI Agent）
  {
    name: 'autonomous_generate',
    description: `AI 自主图片生成 Agent。
用户只需发送一句话描述 + 图片，AI 自动完成：
1. 意图分析：识别任务类型（电商图、模特图、图案等）
2. 图片分析：提取服装特征（颜色、材质、风格）
3. 任务规划：制定多步骤生成计划
4. 自动执行：并行/串行执行生成步骤
5. 返回成品：主图、背面图、细节图等

使用示例:
- "帮我生成一整套电商图"（自动生成主图+背面+细节）
- "给这件衣服配个模特"（生成模特穿搭图）
- "从这件衣服提取图案"（生成无缝图案）

支持的任务类型:
- ecom: 电商产品图（平铺、挂拍、主图+背面+细节）
- model: 模特展示图（多角度、多场景）
- pattern: 图案设计（无缝、可平铺）
- video: 展示视频
- auto: AI 自动判断最合适的类型`,
    inputSchema: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description: '用户需求描述'
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              base64: { type: 'string', description: 'Base64 编码的图片数据' },
              path: { type: 'string', description: '本地文件路径' },
              url: { type: 'string', description: '网络图片 URL' }
            }
          },
          description: '输入图片列表'
        },
        taskType: {
          type: 'string',
          enum: ['ecom', 'model', 'pattern', 'video', 'auto'],
          description: '任务类型，auto 时由 AI 自动判断',
          default: 'auto'
        },
        enableBack: {
          type: 'boolean',
          description: '是否生成背面图（电商图模式）',
          default: false
        },
        enableDetail: {
          type: 'boolean',
          description: '是否生成细节图（电商图模式）',
          default: false
        },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '3:4', '4:3', '9:16', '16:9'],
          description: '输出图片宽高比',
          default: '3:4'
        },
        imageSize: {
          type: 'string',
          enum: ['1K', '2K', '4K'],
          description: '输出图片尺寸',
          default: '2K'
        }
      },
      required: ['userMessage']
    }
  },

  // 14. 多Agent协同图片生成
  {
    name: 'collaborative_generate',
    description: `多Agent协同图片生成。
让多个 AI Agent 分工协作完成复杂的图片生成任务：

**协作角色:**
- 🔍 分析师 (Analyst): 分析图片内容，提取特征
- 📋 规划师 (Planner): 制定生成计划和策略
- 🎨 生成师 (Generator): 执行图片生成
- ✅ 质检师 (QC): 检查质量，决定是否重试

**工作流程:**
1. 分析师分析输入图片 → @规划师
2. 规划师制定生成计划 → @生成师
3. 生成师执行生成 → @质检师
4. 质检师检查质量 → 通过/重试

**协作模板:**
- gemini_all: Gemini 全能协作（单一 Provider）
- multi_model: 多模型协作（Claude 规划 + Gemini 生成）
- premium: 高质量协作（GPT-4 规划 + Gemini 生成）

**使用场景:**
- 需要高质量电商图时，让质检师多轮把关
- 需要复杂任务规划时，让 Claude 来规划
- 需要视觉分析时，让 Gemini 来分析`,
    inputSchema: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description: '用户需求描述'
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              base64: { type: 'string', description: 'Base64 编码的图片数据' },
              path: { type: 'string', description: '本地文件路径' },
              url: { type: 'string', description: '网络图片 URL' }
            }
          },
          description: '输入图片列表'
        },
        template: {
          type: 'string',
          enum: ['gemini_all', 'multi_model', 'premium'],
          description: '协作模板',
          default: 'gemini_all'
        },
        taskType: {
          type: 'string',
          enum: ['ecom', 'model', 'pattern', 'video', 'auto'],
          description: '任务类型',
          default: 'auto'
        },
        maxRetries: {
          type: 'number',
          description: '最大重试次数',
          default: 2
        },
        showThinking: {
          type: 'boolean',
          description: '是否显示各 Agent 的思考过程',
          default: true
        }
      },
      required: ['userMessage']
    }
  }
]

// ==================== 工作流服务实现 ====================

class WorkflowServiceImpl {
  // 内存中的工作流模板存储 (实际应该从 Redux store 获取)
  private templates: Map<string, WorkflowTemplate> = new Map()
  // 任务状态存储
  private jobs: Map<string, JobStatus> = new Map()

  constructor() {
    logger.info('WorkflowServiceImpl initialized')
  }

  // 列出工作流
  async listWorkflows(args: { tags?: string[]; limit?: number }): Promise<any> {
    try {
      // TODO: 从 renderer 进程获取工作流列表
      // 目前返回内存中的模板
      const workflows = Array.from(this.templates.values())
      let filtered = workflows

      if (args.tags && args.tags.length > 0) {
        filtered = workflows.filter((w) => args.tags!.some((tag) => w.tags?.includes(tag)))
      }

      const limit = args.limit || 20
      const result = filtered.slice(0, limit)

      return {
        success: true,
        workflows: result.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          tags: w.tags
        })),
        count: result.length
      }
    } catch (error) {
      logger.error('Failed to list workflows', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 获取工作流详情
  async getWorkflow(args: { workflowId: string }): Promise<any> {
    try {
      const workflow = this.templates.get(args.workflowId)
      if (!workflow) {
        return {
          success: false,
          error: `工作流不存在: ${args.workflowId}`
        }
      }

      return {
        success: true,
        workflow
      }
    } catch (error) {
      logger.error('Failed to get workflow', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 执行工作流
  async executeWorkflow(args: { workflowId: string; inputs?: any; async?: boolean }): Promise<any> {
    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`

      // 创建任务状态
      const job: JobStatus = {
        jobId,
        status: 'pending',
        total: 0,
        done: 0,
        failed: 0,
        message: '任务已创建，等待执行',
        createdAt: Date.now()
      }
      this.jobs.set(jobId, job)

      // TODO: 实际执行工作流
      // 需要通过 IPC 与 renderer 进程通信

      logger.info('Workflow execution started', { jobId, workflowId: args.workflowId })

      return {
        success: true,
        jobId,
        status: 'pending',
        message: '工作流任务已提交'
      }
    } catch (error) {
      logger.error('Failed to execute workflow', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 获取任务状态
  async getJobStatus(args: { jobId: string }): Promise<any> {
    try {
      const job = this.jobs.get(args.jobId)
      if (!job) {
        return {
          success: false,
          error: `任务不存在: ${args.jobId}`
        }
      }

      return {
        success: true,
        ...job
      }
    } catch (error) {
      logger.error('Failed to get job status', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 取消任务
  async cancelJob(args: { jobId: string }): Promise<any> {
    try {
      const job = this.jobs.get(args.jobId)
      if (!job) {
        return {
          success: false,
          error: `任务不存在: ${args.jobId}`
        }
      }

      job.status = 'cancelled'
      job.message = '任务已取消'
      job.updatedAt = Date.now()

      return {
        success: true,
        ...job
      }
    } catch (error) {
      logger.error('Failed to cancel job', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 列出任务历史
  async listJobs(args: { status?: string; limit?: number }): Promise<any> {
    try {
      let jobs = Array.from(this.jobs.values())

      if (args.status) {
        jobs = jobs.filter((j) => j.status === args.status)
      }

      const limit = args.limit || 20
      const result = jobs.slice(0, limit)

      return {
        success: true,
        jobs: result,
        count: result.length
      }
    } catch (error) {
      logger.error('Failed to list jobs', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 单步执行
  async executeStep(args: {
    stepType: string
    params?: any
    inputImage?: string
    inputImageBase64?: string
  }): Promise<any> {
    try {
      logger.info('Executing step', { stepType: args.stepType })

      const { stepType, params, inputImage, inputImageBase64 } = args

      // 根据步骤类型执行不同的操作
      switch (stepType) {
        case 'vision_prompt':
        case 'qwen_prompt': {
          // 视觉/文本提示步骤
          const images: Array<{ base64?: string; path?: string }> = []
          if (inputImageBase64) {
            images.push({ base64: inputImageBase64 })
          } else if (inputImage) {
            images.push({ path: inputImage })
          }

          if (images.length > 0) {
            const result = await mcpBridge.visionAnalysis({
              systemPrompt: params?.systemPrompt || '',
              userPrompt: params?.prompt || params?.userPrompt || '',
              images
            })
            return { success: true, stepType, result }
          } else {
            const result = await mcpBridge.generateText({
              systemPrompt: params?.systemPrompt || '',
              userPrompt: params?.prompt || params?.userPrompt || ''
            })
            return { success: true, stepType, result }
          }
        }

        case 'gemini_generate':
        case 'gemini_edit':
        case 'gemini_pattern':
        case 'gemini_ecom': {
          // Gemini 图像生成/编辑步骤
          const mode =
            stepType === 'gemini_generate'
              ? 'generate'
              : stepType === 'gemini_edit'
                ? 'edit'
                : stepType === 'gemini_pattern'
                  ? 'pattern'
                  : 'ecom'

          const images: Array<{ base64?: string; path?: string }> = []
          if (inputImageBase64) {
            images.push({ base64: inputImageBase64 })
          } else if (inputImage) {
            images.push({ path: inputImage })
          }

          const result = await mcpBridge.generateImage({
            mode,
            prompt: params?.prompt || '',
            systemPrompt: params?.systemPrompt,
            images: images.length > 0 ? images : undefined,
            aspectRatio: params?.aspectRatio,
            imageSize: params?.imageSize
          })
          return { success: result.success, stepType, result: result.images, error: result.error }
        }

        case 'compare_image': {
          // 图像比较步骤
          const images: Array<{ base64?: string; path?: string }> = []
          if (params?.images) {
            for (const img of params.images) {
              if (img.base64) {
                images.push({ base64: img.base64 })
              } else if (img.path) {
                images.push({ path: img.path })
              }
            }
          }

          const result = await mcpBridge.visionAnalysis({
            systemPrompt: '你是一个图像比较专家。请分析并比较这些图像的异同。',
            userPrompt: params?.prompt || '请比较这些图像',
            images
          })
          return { success: true, stepType, result }
        }

        default:
          // 默认使用文本生成
          const textResult = await mcpBridge.generateText({
            systemPrompt: params?.systemPrompt || '',
            userPrompt: params?.prompt || params?.userPrompt || `执行步骤: ${stepType}`
          })
          return { success: true, stepType, result: textResult }
      }
    } catch (error) {
      logger.error('Failed to execute step', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // AI 客户端调用
  async callAI(args: { provider: string; action: string; params?: any; inputImage?: string }): Promise<any> {
    try {
      logger.info('Calling AI service', { provider: args.provider, action: args.action })

      const { provider, action, params, inputImage } = args

      // 根据 action 类型调用不同的 AI 服务
      switch (action) {
        case 'generate':
        case 'text': {
          const result = await mcpBridge.generateText({
            systemPrompt: params?.systemPrompt || '',
            userPrompt: params?.prompt || params?.userPrompt || ''
          })
          return { success: true, provider, action, result }
        }

        case 'vision':
        case 'analyze': {
          const images: Array<{ base64?: string; path?: string }> = []
          if (params?.imageBase64) {
            images.push({ base64: params.imageBase64 })
          } else if (inputImage) {
            images.push({ path: inputImage })
          }

          const result = await mcpBridge.visionAnalysis({
            systemPrompt: params?.systemPrompt || '',
            userPrompt: params?.prompt || params?.userPrompt || '',
            images
          })
          return { success: true, provider, action, result }
        }

        case 'image':
        case 'generate_image': {
          const images: Array<{ base64?: string; path?: string }> = []
          if (params?.imageBase64) {
            images.push({ base64: params.imageBase64 })
          } else if (inputImage) {
            images.push({ path: inputImage })
          }

          const result = await mcpBridge.generateImage({
            mode: params?.mode || 'generate',
            prompt: params?.prompt || '',
            systemPrompt: params?.systemPrompt,
            images: images.length > 0 ? images : undefined,
            aspectRatio: params?.aspectRatio,
            imageSize: params?.imageSize
          })
          return { success: result.success, provider, action, result: result.images, error: result.error }
        }

        case 'search': {
          const result = await mcpBridge.webSearch({
            query: params?.query || params?.prompt || '',
            maxResults: params?.maxResults || 10
          })
          return { success: true, provider, action, result }
        }

        default:
          // 默认使用文本生成
          const defaultResult = await mcpBridge.generateText({
            systemPrompt: params?.systemPrompt || '',
            userPrompt: params?.prompt || params?.userPrompt || `执行操作: ${action}`
          })
          return { success: true, provider, action, result: defaultResult }
      }
    } catch (error) {
      logger.error('Failed to call AI', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 图片上传
  async uploadImages(args: { images: any[]; sessionId?: string; compress?: boolean }): Promise<any> {
    try {
      logger.info('Uploading images', { count: args.images.length })

      // TODO: 实现图片上传逻辑

      return {
        success: true,
        uploadedCount: 0,
        totalCount: args.images.length,
        paths: [],
        message: '图片上传功能开发中'
      }
    } catch (error) {
      logger.error('Failed to upload images', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 健康检查
  async healthCheck(): Promise<any> {
    try {
      // TODO: 检查各 AI 服务状态

      return {
        success: true,
        status: 'ok',
        message: 'MCP Workflow Server 运行正常',
        services: {
          qwen: { configured: false },
          gemini: { configured: false },
          kling: { configured: false },
          runninghub: { configured: false }
        }
      }
    } catch (error) {
      logger.error('Health check failed', { error })
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 图片生成 - 通过 MCPBridge 调用 Renderer 进程的 WorkflowAiService
   *
   * @param args 生成参数
   * @returns 生成结果
   *
   * **Feature: mcp-generate-image, Phase 7.2**
   */
  async generateImage(args: {
    mode?: 'generate' | 'edit' | 'pattern' | 'ecom' | 'model'
    prompt: string
    systemPrompt?: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    aspectRatio?: string
    imageSize?: string
    negativePrompt?: string
    stylePreset?: string
  }): Promise<any> {
    try {
      const mode = args.mode || 'generate'
      logger.info('Generating image via MCPBridge', { mode, promptLength: args.prompt?.length })

      // 使用 MCPBridge 调用 Renderer 进程
      const result = await mcpBridge.generateImage({
        mode,
        prompt: args.prompt,
        systemPrompt: args.systemPrompt,
        images: args.images,
        aspectRatio: args.aspectRatio || '1:1',
        imageSize: args.imageSize || '2K',
        negativePrompt: args.negativePrompt,
        stylePreset: args.stylePreset
      })

      return result
    } catch (error) {
      logger.error('Failed to generate image', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 自主图片生成
   * 使用 AutonomousImageAgent 完成意图分析、任务规划、多步骤执行
   *
   * **Feature: autonomous-agent, Step 4**
   */
  async autonomousGenerate(args: {
    userMessage: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    taskType?: 'ecom' | 'model' | 'pattern' | 'video' | 'auto'
    enableBack?: boolean
    enableDetail?: boolean
    aspectRatio?: string
    imageSize?: string
  }): Promise<any> {
    try {
      logger.info('Autonomous generate via MCPBridge', {
        messageLength: args.userMessage?.length,
        imageCount: args.images?.length || 0,
        taskType: args.taskType
      })

      // 使用 MCPBridge 调用 Renderer 进程的 AutonomousImageAgent
      const result = await mcpBridge.autonomousGenerate({
        userMessage: args.userMessage,
        images: args.images,
        taskType: args.taskType,
        enableBack: args.enableBack,
        enableDetail: args.enableDetail,
        aspectRatio: args.aspectRatio,
        imageSize: args.imageSize
      })

      return result
    } catch (error) {
      logger.error('Failed to autonomous generate', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 多Agent协同图片生成
  async collaborativeGenerate(args: {
    userMessage: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    template?: 'gemini_all' | 'multi_model' | 'premium'
    taskType?: 'ecom' | 'model' | 'pattern' | 'video' | 'auto'
    maxRetries?: number
    showThinking?: boolean
  }): Promise<any> {
    try {
      logger.info('Collaborative generate via MCPBridge', {
        messageLength: args.userMessage?.length,
        imageCount: args.images?.length || 0,
        template: args.template,
        taskType: args.taskType
      })

      // 使用 MCPBridge 调用 Renderer 进程的 ImageCollaborationAgent
      const result = await mcpBridge.collaborativeGenerate({
        userMessage: args.userMessage,
        images: args.images,
        template: args.template || 'gemini_all',
        taskType: args.taskType,
        maxRetries: args.maxRetries,
        showThinking: args.showThinking
      })

      return result
    } catch (error) {
      logger.error('Failed to collaborative generate', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 自动组装工作流
  async composeWorkflow(args: {
    description: string
    taskType?: 'pattern' | 'ecom' | 'model' | 'video' | 'edit' | 'auto'
    inputImages?: string[]
    stylePreset?: string
    outputFormat?: 'image' | 'images' | 'video'
  }): Promise<any> {
    try {
      logger.info('Composing workflow', { description: args.description, taskType: args.taskType })

      const taskType = args.taskType || 'auto'
      const outputFormat = args.outputFormat || 'image'
      const inputImages = args.inputImages || []

      // 分析任务类型
      const detectedType = taskType === 'auto' ? this.detectTaskType(args.description, inputImages) : taskType

      // 根据任务类型构建工作流节点
      const workflowConfig = this.buildWorkflowConfig(detectedType, {
        description: args.description,
        inputImages,
        stylePreset: args.stylePreset,
        outputFormat
      })

      // 创建任务
      const jobId = `compose_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const job: JobStatus = {
        jobId,
        status: 'pending',
        total: workflowConfig.nodeCount,
        done: 0,
        failed: 0,
        message: `正在组装 ${detectedType} 类型工作流`,
        createdAt: Date.now()
      }
      this.jobs.set(jobId, job)

      // TODO: 通过 IPC 发送到 renderer 进程执行
      // 目前返回工作流配置供调试

      return {
        success: true,
        jobId,
        taskType: detectedType,
        workflow: workflowConfig,
        message: `已识别为 ${this.getTaskTypeLabel(detectedType)} 任务，工作流已组装`
      }
    } catch (error) {
      logger.error('Failed to compose workflow', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 检测任务类型
  private detectTaskType(description: string, inputImages: string[]): 'pattern' | 'ecom' | 'model' | 'video' | 'edit' {
    const desc = description.toLowerCase()

    // 视频相关关键词
    if (desc.includes('视频') || desc.includes('video') || desc.includes('动画') || desc.includes('动态')) {
      return 'video'
    }

    // 图案相关关键词
    if (
      desc.includes('图案') ||
      desc.includes('pattern') ||
      desc.includes('无缝') ||
      desc.includes('seamless') ||
      desc.includes('印花') ||
      desc.includes('t恤') ||
      desc.includes('tshirt')
    ) {
      return 'pattern'
    }

    // 电商相关关键词
    if (
      desc.includes('电商') ||
      desc.includes('商拍') ||
      desc.includes('产品图') ||
      desc.includes('白底') ||
      desc.includes('ghost') ||
      desc.includes('mannequin') ||
      desc.includes('实拍')
    ) {
      return 'ecom'
    }

    // 模特相关关键词
    if (
      desc.includes('模特') ||
      desc.includes('model') ||
      desc.includes('穿搭') ||
      desc.includes('试穿') ||
      desc.includes('换装')
    ) {
      return 'model'
    }

    // 默认为编辑任务（如果有输入图片）
    if (inputImages.length > 0) {
      return 'edit'
    }

    // 无输入图片默认为图案生成
    return 'pattern'
  }

  // 获取任务类型标签
  private getTaskTypeLabel(taskType: string): string {
    const labels: Record<string, string> = {
      pattern: '图案生成',
      ecom: '电商实拍图',
      model: '模特生成',
      video: '视频生成',
      edit: '图片编辑'
    }
    return labels[taskType] || taskType
  }

  // 构建工作流配置
  private buildWorkflowConfig(
    taskType: string,
    options: {
      description: string
      inputImages: string[]
      stylePreset?: string
      outputFormat: string
    }
  ): { nodeCount: number; nodes: any[]; edges: any[] } {
    const nodes: any[] = []
    const edges: any[] = []

    switch (taskType) {
      case 'pattern': {
        // 图案生成工作流：[文本输入] -> [图案生成] -> [输出]
        nodes.push({
          id: 'text_input_1',
          type: 'text_input',
          config: { text: options.description }
        })
        nodes.push({
          id: 'gemini_pattern_1',
          type: 'gemini_pattern',
          config: {
            generationMode: options.inputImages.length > 0 ? 'mode_a' : 'mode_c',
            stylePresetName: options.stylePreset,
            outputType: 'pattern_only'
          }
        })
        nodes.push({
          id: 'output_1',
          type: 'output',
          config: {}
        })
        edges.push({ source: 'text_input_1', target: 'gemini_pattern_1', sourceHandle: 'text', targetHandle: 'prompt' })
        edges.push({ source: 'gemini_pattern_1', target: 'output_1', sourceHandle: 'image', targetHandle: 'input' })

        // 如果有输入图片，添加图片输入节点
        if (options.inputImages.length > 0) {
          nodes.unshift({
            id: 'image_input_1',
            type: 'image_input',
            config: { imagePath: options.inputImages[0] }
          })
          edges.push({
            source: 'image_input_1',
            target: 'gemini_pattern_1',
            sourceHandle: 'image',
            targetHandle: 'reference_1'
          })
        }
        break
      }

      case 'ecom': {
        // 电商实拍图工作流：[图片输入] -> [提示词生成] -> [电商生成] -> [输出]
        if (options.inputImages.length === 0) {
          throw new Error('电商实拍图需要输入服装图片')
        }
        nodes.push({
          id: 'image_input_1',
          type: 'image_input',
          config: { imagePath: options.inputImages[0] }
        })
        nodes.push({
          id: 'unified_prompt_1',
          type: 'unified_prompt',
          config: { outputMode: 'promptJson' }
        })
        nodes.push({
          id: 'gemini_ecom_1',
          type: 'gemini_ecom',
          config: {
            stylePreset: 'shein_casual',
            generateCount: 1
          }
        })
        nodes.push({
          id: 'output_1',
          type: 'output',
          config: {}
        })
        edges.push({
          source: 'image_input_1',
          target: 'unified_prompt_1',
          sourceHandle: 'image',
          targetHandle: 'image'
        })
        edges.push({
          source: 'image_input_1',
          target: 'gemini_ecom_1',
          sourceHandle: 'image',
          targetHandle: 'image_1'
        })
        edges.push({
          source: 'unified_prompt_1',
          target: 'gemini_ecom_1',
          sourceHandle: 'promptJson',
          targetHandle: 'promptJson'
        })
        edges.push({ source: 'gemini_ecom_1', target: 'output_1', sourceHandle: 'images', targetHandle: 'input' })
        break
      }

      case 'model': {
        // 模特生成工作流：[图片输入] -> [提示词生成] -> [模特生成] -> [输出]
        if (options.inputImages.length === 0) {
          throw new Error('模特生成需要输入服装图片')
        }
        nodes.push({
          id: 'image_input_1',
          type: 'image_input',
          config: { imagePath: options.inputImages[0] }
        })
        nodes.push({
          id: 'unified_prompt_1',
          type: 'unified_prompt',
          config: { outputMode: 'promptJson' }
        })
        nodes.push({
          id: 'gemini_model_1',
          type: 'gemini_generate_model',
          config: {}
        })
        nodes.push({
          id: 'output_1',
          type: 'output',
          config: {}
        })
        edges.push({
          source: 'image_input_1',
          target: 'unified_prompt_1',
          sourceHandle: 'image',
          targetHandle: 'image'
        })
        edges.push({
          source: 'image_input_1',
          target: 'gemini_model_1',
          sourceHandle: 'image',
          targetHandle: 'image_1'
        })
        edges.push({
          source: 'unified_prompt_1',
          target: 'gemini_model_1',
          sourceHandle: 'promptJson',
          targetHandle: 'promptJson'
        })
        edges.push({ source: 'gemini_model_1', target: 'output_1', sourceHandle: 'image', targetHandle: 'input' })
        break
      }

      case 'video': {
        // 视频生成工作流：[图片输入] -> [视频提示词] -> [图生视频] -> [输出]
        if (options.inputImages.length === 0) {
          throw new Error('视频生成需要输入图片')
        }
        nodes.push({
          id: 'image_input_1',
          type: 'image_input',
          config: { imagePath: options.inputImages[0] }
        })
        nodes.push({
          id: 'video_prompt_1',
          type: 'video_prompt',
          config: {}
        })
        nodes.push({
          id: 'kling_video_1',
          type: 'kling_image2video',
          config: {
            duration: '5',
            mode: 'std'
          }
        })
        nodes.push({
          id: 'output_1',
          type: 'output',
          config: {}
        })
        edges.push({
          source: 'image_input_1',
          target: 'video_prompt_1',
          sourceHandle: 'image',
          targetHandle: 'image'
        })
        edges.push({
          source: 'image_input_1',
          target: 'kling_video_1',
          sourceHandle: 'image',
          targetHandle: 'image_1'
        })
        edges.push({
          source: 'video_prompt_1',
          target: 'kling_video_1',
          sourceHandle: 'text',
          targetHandle: 'prompt'
        })
        edges.push({ source: 'kling_video_1', target: 'output_1', sourceHandle: 'video', targetHandle: 'input' })
        break
      }

      case 'edit':
      default: {
        // 图片编辑工作流：[图片输入] -> [Gemini编辑] -> [输出]
        if (options.inputImages.length === 0) {
          throw new Error('图片编辑需要输入图片')
        }
        nodes.push({
          id: 'image_input_1',
          type: 'image_input',
          config: { imagePath: options.inputImages[0] }
        })
        nodes.push({
          id: 'gemini_edit_1',
          type: 'gemini_edit',
          config: {
            editMode: 'custom',
            prompt: options.description
          }
        })
        nodes.push({
          id: 'output_1',
          type: 'output',
          config: {}
        })
        edges.push({
          source: 'image_input_1',
          target: 'gemini_edit_1',
          sourceHandle: 'image',
          targetHandle: 'image_1'
        })
        edges.push({ source: 'gemini_edit_1', target: 'output_1', sourceHandle: 'image', targetHandle: 'input' })
        break
      }
    }

    return {
      nodeCount: nodes.length,
      nodes,
      edges
    }
  }
}

// ==================== MCP Server 类 ====================

class WorkflowServer {
  public server: Server
  private workflowService: WorkflowServiceImpl

  constructor() {
    this.workflowService = new WorkflowServiceImpl()
    this.server = new Server(
      {
        name: 'workflow-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.initialize()
  }

  private initialize() {
    // 注册工具列表
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: WORKFLOW_TOOLS
    }))

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      logger.debug('Tool called', { name, args })

      try {
        let result: any

        switch (name) {
          case 'workflow_list':
            result = await this.workflowService.listWorkflows(args as any)
            break

          case 'workflow_get':
            result = await this.workflowService.getWorkflow(args as any)
            break

          case 'workflow_execute':
            result = await this.workflowService.executeWorkflow(args as any)
            break

          case 'workflow_job_status':
            result = await this.workflowService.getJobStatus(args as any)
            break

          case 'workflow_job_cancel':
            result = await this.workflowService.cancelJob(args as any)
            break

          case 'workflow_job_list':
            result = await this.workflowService.listJobs(args as any)
            break

          case 'workflow_step_execute':
            result = await this.workflowService.executeStep(args as any)
            break

          case 'workflow_ai_call':
            result = await this.workflowService.callAI(args as any)
            break

          case 'workflow_image_upload':
            result = await this.workflowService.uploadImages(args as any)
            break

          case 'workflow_health_check':
            result = await this.workflowService.healthCheck()
            break

          case 'workflow_compose':
            result = await this.workflowService.composeWorkflow(args as any)
            break

          case 'generate_image':
            result = await this.workflowService.generateImage(args as any)
            break

          case 'autonomous_generate':
            result = await this.workflowService.autonomousGenerate(args as any)
            break

          case 'collaborative_generate':
            result = await this.workflowService.collaborativeGenerate(args as any)
            break

          default:
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: `Unknown tool: ${name}` })
                }
              ],
              isError: true
            }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      } catch (error) {
        logger.error('Tool execution failed', { name, error })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                status: 'failed'
              })
            }
          ],
          isError: true
        }
      }
    })

    logger.info('WorkflowServer initialized with tools', { toolCount: WORKFLOW_TOOLS.length })
  }
}

export default WorkflowServer
