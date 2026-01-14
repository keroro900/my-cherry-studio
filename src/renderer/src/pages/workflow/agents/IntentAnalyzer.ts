/**
 * 意图分析器
 *
 * 分析用户输入的自然语言，判断任务类型并提取参数
 * 借鉴 VCP 的意图分析模式
 *
 * @module agents/IntentAnalyzer
 */

import { type ImageRef, isImageRef } from '../types/core'

// ==================== 类型定义 ====================

/**
 * 支持的任务类型
 */
export type TaskType = 'ecom' | 'model' | 'pattern' | 'video' | 'edit' | 'general'

/**
 * 意图分析结果
 */
export interface IntentResult {
  /** 检测到的任务类型 */
  taskType: TaskType
  /** 置信度 0-1 */
  confidence: number
  /** 提取的参数 */
  params: ExtractedParams
  /** 原始用户消息 */
  originalMessage: string
  /** 分析推理过程（可选） */
  reasoning?: string
}

/**
 * 从用户消息中提取的参数
 */
export interface ExtractedParams {
  /** 是否生成背面图 */
  enableBack?: boolean
  /** 是否生成细节图 */
  enableDetail?: boolean
  /** 细节类型 */
  detailTypes?: string[]
  /** 风格预设 */
  stylePreset?: string
  /** 目标数量 */
  targetCount?: number
  /** 宽高比 */
  aspectRatio?: string
  /** 图片尺寸 */
  imageSize?: '1K' | '2K' | '4K'
  /** 用户自定义提示词 */
  customPrompt?: string
}

/**
 * 图片分析结果（服装分析）
 */
export interface GarmentAnalysis {
  /** 服装类别 */
  category?: string
  /** 颜色 */
  colors?: string[]
  /** 图案 */
  patterns?: string[]
  /** 材质 */
  materials?: string[]
  /** 风格标签 */
  styleTags?: string[]
  /** 原始分析文本 */
  rawAnalysis?: string
}

// ==================== 关键词映射 ====================

/**
 * 任务类型关键词映射
 * 借鉴 VCP 的关键词匹配模式
 */
const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  ecom: [
    '电商',
    '产品图',
    '商品图',
    '白底图',
    '平铺',
    '挂拍',
    '详情页',
    'ecommerce',
    'product',
    'flat lay',
    'ghost mannequin',
    '主图',
    '商品'
  ],
  model: ['模特', '穿搭', '试穿', '上身', '效果图', '真人', 'model', 'outfit', 'try on', '穿着', '展示'],
  pattern: ['图案', '花纹', '纹理', '印花', '无缝', 'pattern', 'seamless', 'texture', 'tile', '平铺图案'],
  video: ['视频', '动态', '动图', 'video', 'motion', 'animate', '展示视频'],
  edit: ['编辑', '修改', '调整', '换背景', '抠图', 'edit', 'modify', 'remove', '去除'],
  general: ['生成', '创建', '画', 'generate', 'create', 'make']
}

/**
 * 参数关键词映射
 */
const PARAM_KEYWORDS = {
  enableBack: ['背面', '后面', 'back', '背部', '反面'],
  enableDetail: ['细节', '特写', '局部', 'detail', 'close-up', '放大'],
  detailTypes: {
    collar: ['领口', '领子', 'collar', 'neckline'],
    button: ['纽扣', '扣子', 'button'],
    print: ['印花', '图案', 'print', 'pattern'],
    fabric: ['面料', '材质', 'fabric', 'texture'],
    pocket: ['口袋', 'pocket'],
    sleeve: ['袖子', '袖口', 'sleeve'],
    hem: ['下摆', 'hem']
  },
  stylePreset: {
    minimal: ['简约', '极简', 'minimal', 'clean'],
    premium: ['高端', '奢华', 'premium', 'luxury'],
    casual: ['休闲', '日常', 'casual'],
    professional: ['专业', '商务', 'professional']
  },
  aspectRatio: {
    '1:1': ['1:1', '正方形', 'square'],
    '3:4': ['3:4', '竖版', 'portrait'],
    '4:3': ['4:3', '横版', 'landscape'],
    '9:16': ['9:16', '手机竖屏'],
    '16:9': ['16:9', '宽屏']
  },
  quantity: {
    patterns: [/(\d+)\s*张/i, /(\d+)\s*个/i, /(\d+)\s*images?/i, /生成\s*(\d+)/i]
  }
}

// ==================== IntentAnalyzer 类 ====================

/**
 * 意图分析器
 *
 * 使用关键词匹配 + 规则推理分析用户意图
 * 可扩展为 AI 驱动的意图分析
 */
export class IntentAnalyzer {
  /**
   * 分析用户意图
   *
   * @param message 用户消息
   * @returns 意图分析结果
   */
  analyzeUserIntent(message: string): IntentResult {
    const lowerMessage = message.toLowerCase()
    const scores: Record<TaskType, number> = {
      ecom: 0,
      model: 0,
      pattern: 0,
      video: 0,
      edit: 0,
      general: 0
    }

    // 1. 关键词匹配计分
    for (const [taskType, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          scores[taskType as TaskType] += 1
        }
      }
    }

    // 2. 确定最高分的任务类型
    let maxScore = 0
    let detectedType: TaskType = 'general'

    for (const [taskType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        detectedType = taskType as TaskType
      }
    }

    // 3. 计算置信度
    // 使用关键词匹配数量来估算置信度
    const confidence = maxScore > 0 ? Math.min(maxScore / 3, 1) : 0.3

    // 4. 提取参数
    const params = this.extractParams(message)

    // 5. 智能参数推断
    if (detectedType === 'ecom' && !params.enableBack && !params.enableDetail) {
      // 电商图默认生成背面和细节
      if (message.includes('整套') || message.includes('全套') || message.includes('一套')) {
        params.enableBack = true
        params.enableDetail = true
        params.detailTypes = ['collar', 'print', 'fabric']
      }
    }

    return {
      taskType: detectedType,
      confidence,
      params,
      originalMessage: message,
      reasoning: `Matched ${maxScore} keywords for ${detectedType}`
    }
  }

  /**
   * 从消息中提取参数
   */
  private extractParams(message: string): ExtractedParams {
    const lowerMessage = message.toLowerCase()
    const params: ExtractedParams = {}

    // 检测背面图
    for (const keyword of PARAM_KEYWORDS.enableBack) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        params.enableBack = true
        break
      }
    }

    // 检测细节图
    for (const keyword of PARAM_KEYWORDS.enableDetail) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        params.enableDetail = true
        break
      }
    }

    // 检测细节类型
    const detectedDetails: string[] = []
    for (const [detailType, keywords] of Object.entries(PARAM_KEYWORDS.detailTypes)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          detectedDetails.push(detailType)
          break
        }
      }
    }
    if (detectedDetails.length > 0) {
      params.detailTypes = detectedDetails
      params.enableDetail = true
    }

    // 检测风格预设
    for (const [preset, keywords] of Object.entries(PARAM_KEYWORDS.stylePreset)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          params.stylePreset = preset
          break
        }
      }
      if (params.stylePreset) break
    }

    // 检测宽高比
    for (const [ratio, keywords] of Object.entries(PARAM_KEYWORDS.aspectRatio)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          params.aspectRatio = ratio
          break
        }
      }
      if (params.aspectRatio) break
    }

    // 检测数量
    for (const pattern of PARAM_KEYWORDS.quantity.patterns) {
      const match = message.match(pattern)
      if (match) {
        params.targetCount = parseInt(match[1], 10)
        break
      }
    }

    // 提取自定义提示词（去除已识别的关键词后的内容）
    params.customPrompt = message.trim()

    return params
  }

  /**
   * 使用 AI 分析图片内容
   * 复用 GarmentAnalysisExecutor 的逻辑
   *
   * @param images 图片引用数组
   * @param analyzeFunc AI 分析函数
   * @returns 服装分析结果
   */
  async analyzeImages(
    images: ImageRef[],
    analyzeFunc: (images: string[], prompt: string) => Promise<string>
  ): Promise<GarmentAnalysis> {
    if (images.length === 0) {
      return {}
    }

    // 构建分析提示词
    const analysisPrompt = `Analyze this garment image and extract the following information in JSON format:
{
  "category": "garment category (e.g., dress, t-shirt, pants)",
  "colors": ["primary color", "secondary colors"],
  "patterns": ["pattern types if any"],
  "materials": ["visible material/fabric types"],
  "styleTags": ["style descriptors"]
}

Be concise and focus on commercially relevant details.`

    try {
      // 提取图片 base64 - 使用正确的 ImageRef 结构
      const imageBase64s = images
        .filter((img) => {
          if (!isImageRef(img)) return false
          // 仅支持 base64 类型的 ImageRef
          return img.type === 'base64'
        })
        .map((img) => {
          // 移除可能的 data URL 前缀
          if (img.value.startsWith('data:')) {
            return img.value.replace(/^data:image\/\w+;base64,/, '')
          }
          return img.value
        })
        .filter(Boolean)

      if (imageBase64s.length === 0) {
        return {}
      }

      const response = await analyzeFunc(imageBase64s, analysisPrompt)

      // 尝试解析 JSON
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            category: parsed.category,
            colors: parsed.colors,
            patterns: parsed.patterns,
            materials: parsed.materials,
            styleTags: parsed.styleTags,
            rawAnalysis: response
          }
        }
      } catch {
        // JSON 解析失败，返回原始文本
      }

      return { rawAnalysis: response }
    } catch (error) {
      console.error('[IntentAnalyzer] Image analysis failed:', error)
      return {}
    }
  }
}

/**
 * 单例实例
 */
export const intentAnalyzer = new IntentAnalyzer()

export default intentAnalyzer
