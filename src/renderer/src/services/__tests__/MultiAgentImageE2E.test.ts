/**
 * AI 多 Agent 协同图片生成 E2E 测试
 *
 * 核心目标：测试 AI 自主生成 VCP 工具调用的完整链路
 *
 * 流程：
 * 1. 用户给 AI 参考图 + 任务描述
 * 2. AI 分析后自己生成 VCP 工具调用（不预设 prompt）
 * 3. parseVCPToolRequest 解析 AI 输出
 * 4. 执行 VCP 工具（调用 Gemini API）
 * 5. 返回结果给 AI
 * 6. AI 决定下一步（继续生成/审核/重做）
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/MultiAgentImageE2E.test.ts
 */

import * as fs from 'fs'
import * as path from 'path'

import { describe, expect, it } from 'vitest'

// ==================== 配置 ====================

// 硅基流动 - AI 协调
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'

// 模型配置（按优先级排序，支持自动降级）
const VISION_MODELS = [
  'zai-org/GLM-4.6V', // 首选：GLM 视觉语言模型
  'Pro/Qwen/Qwen2.5-VL-7B-Instruct', // 备选：Qwen 视觉模型
  'Qwen/Qwen2.5-VL-7B-Instruct' // 备选：Qwen 视觉模型（非Pro）
]

const TEXT_MODELS = [
  'Qwen/Qwen3-8B', // 首选：Qwen3 文本模型（稳定）
  'Qwen/Qwen2.5-72B-Instruct', // 备选：Qwen2.5 大模型
  'THUDM/glm-4-9b-chat' // 备选：GLM 文本模型
]

// 当前使用的模型（会根据 API 响应动态调整）
let currentVisionModel = VISION_MODELS[0]
let currentTextModel = TEXT_MODELS[0]

// Gemini 图片生成 (Cherryin 代理)
const GEMINI_API_KEY = 'sk-HAkNgRz5C9vAD3E1BgNqViOg8Anksu9pTJ0YGYu2gENb0cDR'
const GEMINI_BASE_URL = 'https://open.cherryin.net/v1'
const GEMINI_MODEL = 'google/gemini-3-pro-image-preview'

// 参考图路径
const REFERENCE_IMAGE_PATH = 'C:\\Users\\Administrator\\Downloads\\ComfyUI_00011_vjppi_1766965419.png'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'test-output', 'ai-agent-vcp')
const LOG_FILE = path.join(OUTPUT_DIR, 'ai-interaction-log.md')

// ==================== 交互日志 ====================

interface AIInteraction {
  timestamp: string
  turn: number
  role: 'user' | 'assistant' | 'tool_result'
  content: string
  vcpCalls?: ParsedVCPRequest[]
  imageGenerated?: string
}

const interactionLog: AIInteraction[] = []

function logInteraction(
  turn: number,
  role: 'user' | 'assistant' | 'tool_result',
  content: string,
  vcpCalls?: ParsedVCPRequest[],
  imageGenerated?: string
) {
  interactionLog.push({
    timestamp: new Date().toISOString(),
    turn,
    role,
    content: content.slice(0, 8000),
    vcpCalls,
    imageGenerated
  })
}

function saveInteractionLog() {
  ensureOutputDir()

  let markdown = `# AI Agent VCP 调用日志

## 测试时间
${new Date().toLocaleString('zh-CN')}

## 测试目标
验证 AI 自主生成 VCP 工具调用的完整链路

---

`

  for (const log of interactionLog) {
    const roleLabel = log.role === 'user' ? '👤 用户' : log.role === 'assistant' ? '🤖 AI' : '⚙️ 工具结果'
    markdown += `### Turn ${log.turn} - ${roleLabel}

**时间**: ${log.timestamp}

${log.content}

`
    if (log.vcpCalls && log.vcpCalls.length > 0) {
      markdown += `**解析到的 VCP 调用**:
\`\`\`json
${JSON.stringify(log.vcpCalls, null, 2)}
\`\`\`

`
    }
    if (log.imageGenerated) {
      markdown += `**生成图片**: ${log.imageGenerated}

`
    }
    markdown += `---

`
  }

  fs.writeFileSync(LOG_FILE, markdown, 'utf-8')
  console.log(`\n[日志已保存] ${LOG_FILE}`)
  return markdown
}

// ==================== VCP 协议解析（复用现有代码） ====================

interface ParsedVCPRequest {
  tool_name: string
  command: string
  params: Record<string, string>
}

/**
 * 解析 AI 输出中的 VCP 工具调用
 * 这是核心函数，用于解析 AI 自主生成的工具调用
 */
function parseVCPToolRequest(text: string): ParsedVCPRequest[] {
  const results: ParsedVCPRequest[] = []
  const startTag = '<<<[TOOL_REQUEST]>>>'.replace(/[<>[\]]/g, '\\$&')
  const endTag = '<<<[END_TOOL_REQUEST]>>>'.replace(/[<>[\]]/g, '\\$&')
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    const parsed: ParsedVCPRequest = { tool_name: '', command: '', params: {} }

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // 支持两种格式：「始」...「末」 或 key: value
      let keyMatch = trimmed.match(/^(\w+):「始」(.*)「末」,?$/)
      if (!keyMatch) keyMatch = trimmed.match(/^(\w+):\s*(.+?),?$/)

      if (keyMatch) {
        const [, key, value] = keyMatch
        const cleanValue = value.trim().replace(/,\s*$/, '')
        if (key === 'tool_name') parsed.tool_name = cleanValue
        else if (key === 'command') parsed.command = cleanValue
        else parsed.params[key] = cleanValue
      }
    }

    if (parsed.tool_name) results.push(parsed)
  }

  return results
}

// ==================== 工具函数 ====================

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function saveBase64Image(base64Data: string, filename: string): string {
  ensureOutputDir()
  const filepath = path.join(OUTPUT_DIR, filename)
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Clean, 'base64')
  fs.writeFileSync(filepath, buffer)
  console.log(`[保存图片] ${filepath}`)
  return filepath
}

function imageToBase64DataUrl(filepath: string): string {
  const buffer = fs.readFileSync(filepath)
  const ext = path.extname(filepath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

// ==================== AI 调用 ====================

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

/**
 * 调用 AI 模型（带自动降级）
 * @param messages 消息列表
 * @param useVision 是否使用视觉模型（包含图片时设为 true）
 */
async function callAI(
  messages: Message[],
  useVision: boolean = false
): Promise<{ success: boolean; content?: string; error?: string; modelUsed?: string }> {
  const modelList = useVision ? VISION_MODELS : TEXT_MODELS

  for (let modelIndex = 0; modelIndex < modelList.length; modelIndex++) {
    const model = modelList[modelIndex]
    console.log(`[AI 调用] 尝试模型: ${model}${modelIndex > 0 ? ' (降级)' : ''}`)

    try {
      const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SILICONFLOW_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`[AI 调用] ${model} 失败: ${response.status} - ${errorText.slice(0, 100)}`)

        // 如果是 500 错误，尝试下一个模型
        if (response.status >= 500 && modelIndex < modelList.length - 1) {
          console.log(`[AI 调用] 服务器错误，尝试降级到下一个模型...`)
          continue
        }
        return { success: false, error: `AI API error: ${response.status} - ${errorText}` }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      // 更新当前使用的模型
      if (useVision) {
        currentVisionModel = model
      } else {
        currentTextModel = model
      }

      console.log(`[AI 调用] ${model} 成功`)
      return { success: true, content, modelUsed: model }
    } catch (error) {
      console.warn(`[AI 调用] ${model} 异常: ${error}`)
      if (modelIndex < modelList.length - 1) {
        continue
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return { success: false, error: '所有模型都调用失败' }
}

// ==================== VCP 工具执行器 ====================

interface ToolExecutionResult {
  success: boolean
  output: string
  data?: {
    localPath?: string
    base64?: string
    score?: number
    passed?: boolean
    imagePath?: string
    reviewContent?: string
  }
}

// 用于日记和论坛的图片记录
let generatedImagesForDiary: GeneratedImage[] = []

interface GeneratedImage {
  name: string
  path: string
  base64: string
}

/**
 * 执行 VCP 工具调用
 * 优先使用 IPC 调用真实 VCP 服务，失败时回退到直接 API 调用
 */
async function executeVCPTool(request: ParsedVCPRequest, referenceImageBase64?: string): Promise<ToolExecutionResult> {
  const { tool_name, command, params } = request

  console.log(`\n[执行 VCP] ${tool_name}.${command}`)
  console.log(`[参数] ${JSON.stringify(params, null, 2).slice(0, 500)}`)

  // 尝试使用 IPC 调用真实 VCP 服务
  const hasIPC = typeof window !== 'undefined' && (window as any).api?.vcpTool?.execute

  if (hasIPC && (tool_name === 'GeminiImageGen' || tool_name === 'DailyNoteWrite')) {
    console.log(`[VCP IPC] 使用真实服务: ${tool_name}`)
    try {
      // 构建 IPC 参数
      const ipcParams: Record<string, string> = {
        command,
        ...params
      }

      // 处理参考图
      if (command === 'edit' && referenceImageBase64 && params.image_url === 'PROVIDED_BY_SYSTEM') {
        ipcParams.image_url = referenceImageBase64
      }

      const result = await (window as any).api.vcpTool.execute(tool_name, ipcParams)

      console.log(`[VCP IPC] 结果: ${result.success ? '成功' : '失败'}`)

      if (result.success) {
        // 处理图片结果
        if (result.data?.localPath) {
          // 读取生成的图片转为 base64
          let base64Data = ''
          if (typeof fs !== 'undefined' && fs.existsSync(result.data.localPath)) {
            const buffer = fs.readFileSync(result.data.localPath)
            const ext = path.extname(result.data.localPath).toLowerCase()
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
            base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`
          }

          return {
            success: true,
            output: result.output || `图片生成成功！\n- 本地路径: ${result.data.localPath}`,
            data: {
              localPath: result.data.localPath,
              base64: base64Data
            }
          }
        }
        return {
          success: true,
          output: result.output || '执行成功'
        }
      } else {
        console.warn(`[VCP IPC] 服务返回失败: ${result.error}`)
        // 不回退，直接返回错误
        return { success: false, output: result.error || '服务执行失败' }
      }
    } catch (ipcError) {
      console.warn(`[VCP IPC] 调用异常: ${ipcError}`)
      // IPC 失败，回退到直接调用
    }
  }

  // 回退：直接调用 API（用于测试环境或 IPC 不可用时）
  console.log(`[VCP 直接调用] ${tool_name}.${command}`)

  // GeminiImageGen 服务
  if (tool_name === 'GeminiImageGen') {
    if (command === 'generate' || command === 'edit') {
      const prompt = params.prompt
      if (!prompt) {
        return { success: false, output: '缺少 prompt 参数' }
      }

      // 调用 Gemini API
      try {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

        // 如果是 edit 模式且有参考图
        if (command === 'edit' && (params.image_url || referenceImageBase64)) {
          const imageUrl = params.image_url || referenceImageBase64
          if (imageUrl && imageUrl !== 'PROVIDED_BY_SYSTEM') {
            content.push({ type: 'image_url', image_url: { url: imageUrl } })
          } else if (referenceImageBase64) {
            content.push({ type: 'image_url', image_url: { url: referenceImageBase64 } })
          }
        }

        content.push({ type: 'text', text: prompt })

        const requestBody = {
          model: GEMINI_MODEL,
          messages: [{ role: 'user', content }],
          max_tokens: 4096
        }

        console.log(`[Gemini API] 调用中...`)
        const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GEMINI_API_KEY}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorText = await response.text()
          return { success: false, output: `Gemini API error: ${response.status} - ${errorText}` }
        }

        const data = await response.json()
        const responseContent = data.choices?.[0]?.message?.content || ''

        // 提取 base64 图片
        const base64Match = responseContent.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/)
        if (base64Match) {
          const base64Data = `data:image/${base64Match[1]};base64,${base64Match[2]}`
          const filename = `vcp_${Date.now()}.png`
          const localPath = saveBase64Image(base64Data, filename)

          return {
            success: true,
            output: `图片生成成功！\n- 本地路径: ${localPath}\n- 使用的 prompt: ${prompt.slice(0, 100)}...`,
            data: { localPath, base64: base64Data }
          }
        }

        return { success: false, output: `未能从响应中提取图片: ${responseContent.slice(0, 200)}` }
      } catch (error) {
        return { success: false, output: `Gemini 调用失败: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
  }

  // 日记服务 - 保存完整的 AI 交互记录
  if (tool_name === 'DailyNoteWrite') {
    const content = params.content || ''
    const title = params.title || '设计日记'
    const tags = params.tags || 'AI设计'
    const diaryPath = path.join(OUTPUT_DIR, 'design-diary.md')

    // 构建完整日记内容，包含所有交互记录
    const fullContent = `# ${title}

**生成时间**: ${new Date().toLocaleString('zh-CN')}
**标签**: ${tags}

---

## 用户原始内容

${content}

---

## AI 交互记录

${interactionLog.map((log, i) => `
### ${i + 1}. ${log.role === 'user' ? '用户' : log.role === 'assistant' ? 'AI' : '工具结果'} (Turn ${log.turn})

**时间**: ${log.timestamp}

${log.content.slice(0, 2000)}${log.content.length > 2000 ? '...' : ''}

${log.vcpCalls ? `**VCP 调用**: ${JSON.stringify(log.vcpCalls, null, 2)}` : ''}
${log.imageGenerated ? `**生成图片**: ${log.imageGenerated}` : ''}
`).join('\n')}

---

## 生成的图片

${generatedImagesForDiary.map((img, i) => `${i + 1}. **${img.name}**: ${img.path}`).join('\n')}
`

    fs.writeFileSync(diaryPath, fullContent, 'utf-8')
    console.log(`[日记已保存] ${diaryPath}`)
    return { success: true, output: `日记已保存到: ${diaryPath}\n包含 ${interactionLog.length} 条交互记录和 ${generatedImagesForDiary.length} 张图片` }
  }

  // 论坛服务 - 发布心得
  if (tool_name === 'ForumPost') {
    const title = params.title || 'AI 设计心得'
    const content = params.content || ''
    const images = params.images || ''
    const forumPath = path.join(OUTPUT_DIR, 'forum-post.md')

    const postContent = `# ${title}

**发布时间**: ${new Date().toLocaleString('zh-CN')}

---

${content}

---

## 附图

${images.split(',').map((img, i) => `${i + 1}. ${img.trim()}`).join('\n')}

---

## 技术信息

- **AI 模型**: Qwen3-8B (协调) + Gemini-3-Pro (图片生成)
- **VCP 工具**: GeminiImageGen, ImageReview, DailyNoteWrite, ForumPost
- **总交互次数**: ${interactionLog.length}
- **生成图片数**: ${generatedImagesForDiary.length}

---

*本文由 AI 多 Agent 协同系统自动生成*
`

    fs.writeFileSync(forumPath, postContent, 'utf-8')
    console.log(`[论坛帖子已保存] ${forumPath}`)
    return { success: true, output: `论坛帖子已保存到: ${forumPath}` }
  }

  // 图片审核服务 - 调用视觉模型，AI 自己决定审核内容
  if (tool_name === 'ImageReview') {
    const imagePath = params.image_path || ''
    const reviewPrompt = params.prompt || params.criteria || '' // AI 自己生成的审核提示词

    console.log(`[图片审核] ${imagePath}`)
    console.log(`[AI 生成的审核提示词] ${reviewPrompt}`)

    if (!reviewPrompt) {
      return { success: false, output: '缺少审核提示词 (prompt 参数)，请让 AI 自己生成审核指令' }
    }

    // 检查文件是否存在
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { success: false, output: `图片不存在: ${imagePath}` }
    }

    // 读取图片转为 base64
    const imageBuffer = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
    const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`

    const stats = fs.statSync(imagePath)
    const sizeKB = (stats.size / 1024).toFixed(1)

    // 调用视觉模型 - 使用 AI 自己生成的提示词
    try {
      console.log(`[调用视觉模型] 审核图片...`)

      // 使用 callAI 调用视觉模型（带自动降级）
      const result = await callAI(
        [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageBase64 } },
              { type: 'text', text: reviewPrompt } // 使用 AI 自己写的提示词
            ]
          }
        ],
        true // 使用视觉模型
      )

      if (!result.success) {
        console.error(`[审核失败] ${result.error}`)
        return { success: false, output: `视觉模型调用失败: ${result.error}` }
      }

      const reviewContent = result.content || ''
      const modelUsed = result.modelUsed || currentVisionModel

      console.log(`[视觉模型响应]\n${reviewContent}`)

      // 记录审核交互
      logInteraction(0, 'tool_result', `[视觉模型 ${modelUsed} 审核结果]\n\n${reviewContent}`)

      const reviewResult = `## 视觉模型审核结果

**图片**: ${imagePath}
**文件大小**: ${sizeKB} KB
**审核模型**: ${modelUsed}
**审核提示词**: ${reviewPrompt.slice(0, 200)}...

### 审核意见:
${reviewContent}
`

      return {
        success: true,
        output: reviewResult,
        data: { imagePath, reviewContent }
      }
    } catch (error) {
      console.error(`[审核失败] ${error}`)
      return {
        success: false,
        output: `视觉模型调用失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  return { success: false, output: `未知工具: ${tool_name}.${command}` }
}

// ==================== Agent 循环（核心） ====================

const DESIGN_SYSTEM_PROMPT = `你是一个专业的服装设计 AI 助手，负责协调图片生成任务。

## 设计约束（必须严格遵守）

1. **数字元素**: 设计中必须包含 "67" 数字
2. **风格**: 像素艺术(Pixel Art)风格，方块状、网格化
3. **配色**: 主色青蓝色，边框粉红色
4. **比例**: 3:4 (适合服装展示)
5. **元素**: 乐高积木凸点、故障艺术(Glitch)效果

## 可用工具

### GeminiImageGen.edit - 图生图编辑（首选）
使用参考图进行编辑，保持风格统一。

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」GeminiImageGen「末」,
command:「始」edit「末」,
prompt:「始」你自己设计的英文 prompt，描述要生成什么图片「末」,
image_url:「始」PROVIDED_BY_SYSTEM「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### GeminiImageGen.generate - 文生图
不需要参考图，纯文本生成。

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」GeminiImageGen「末」,
command:「始」generate「末」,
prompt:「始」你自己设计的英文 prompt「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### DailyNoteWrite.write - 保存日记
将设计过程保存到日记，包含完整的 AI 交互记录。

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」,
command:「始」write「末」,
title:「始」日记标题「末」,
content:「始」包含设计过程、AI交互、图片路径的完整内容「末」,
tags:「始」标签1, 标签2「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### ForumPost.publish - 发布论坛心得
将设计成果和心得发布到论坛。

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」ForumPost「末」,
command:「始」publish「末」,
title:「始」帖子标题「末」,
content:「始」帖子内容，包含心得体会「末」,
images:「始」图片路径列表，逗号分隔「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### ImageReview.evaluate - 调用视觉模型审核图片
调用 GLM-4.6V 视觉模型审核图片，你需要自己写审核提示词。

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」ImageReview「末」,
command:「始」evaluate「末」,
image_path:「始」要审核的图片路径「末」,
prompt:「始」你自己设计的审核提示词，告诉视觉模型要检查什么「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 重要提示

1. **prompt 必须是你自己设计的**，根据任务需求创作
2. **prompt 必须使用英文**
3. **每次只调用一个工具**
4. **必须包含 "67" 元素**
5. **image_url 由系统自动提供**，你只需写 PROVIDED_BY_SYSTEM
6. **生成图片后必须审核**，调用 ImageReview.evaluate 检查质量
7. **任务完成后**，调用 DailyNoteWrite 保存日记，调用 ForumPost 发布心得
8. **绝对不要询问确认** - 你是自主 Agent，必须自己决策并持续执行，不要问"是否继续"
9. **直接执行下一步** - 每轮都要调用工具，不要只输出文字

## 工作流程

1. 接收任务需求
2. 自己设计 prompt
3. 调用 GeminiImageGen 生成图片
4. 调用 ImageReview 审核图片质量
5. 如果不满意，重新生成
6. **审核通过后立即继续下一张图**，不要等待确认
7. 所有图片完成后，调用 DailyNoteWrite 保存完整日记
8. 调用 ForumPost 发布设计心得

## 任务目标

用户会给你一个参考图和设计需求。你需要：
1. 理解设计需求
2. 自己创作 prompt
3. 调用工具生成图片
4. 根据结果决定下一步`

/**
 * Agent 循环 - AI 自主生成 VCP 调用
 */
async function designAgentLoop(
  userTask: string,
  referenceImageBase64: string | null,
  maxTurns: number = 8
): Promise<{ images: GeneratedImage[]; finalResponse: string }> {
  const messages: Message[] = [{ role: 'system', content: DESIGN_SYSTEM_PROMPT }]

  // 构建初始用户消息
  const userContent = referenceImageBase64
    ? `参考图已提供（系统会自动传递给工具）。\n\n任务：${userTask}`
    : userTask

  messages.push({ role: 'user', content: userContent })
  logInteraction(0, 'user', userContent)

  const generatedImages: GeneratedImage[] = []
  let lastGeneratedBase64 = referenceImageBase64
  let finalResponse = ''

  for (let turn = 1; turn <= maxTurns; turn++) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`  Turn ${turn}/${maxTurns}`)
    console.log('='.repeat(60))

    // 调用 AI
    const aiResult = await callAI(messages)
    if (!aiResult.success || !aiResult.content) {
      console.log(`[AI 调用失败] ${aiResult.error}`)
      break
    }

    const aiResponse = aiResult.content
    console.log(`\n[AI 回复]\n${aiResponse.slice(0, 800)}${aiResponse.length > 800 ? '...' : ''}`)

    // 解析 VCP 工具调用
    const vcpCalls = parseVCPToolRequest(aiResponse)
    logInteraction(turn, 'assistant', aiResponse, vcpCalls)

    if (vcpCalls.length === 0) {
      // 没有工具调用，检查是否应该继续
      // 如果 AI 在询问确认或没有完成所有任务，提示它继续
      if (turn < maxTurns - 1) {
        console.log('\n[Agent] AI 没有调用工具，提示继续...')
        messages.push({ role: 'assistant', content: aiResponse })
        messages.push({
          role: 'user',
          content:
            '你是自主 Agent，不需要等待确认。请直接继续执行下一步任务，调用相应的工具。' +
            '记住：每轮都必须调用一个工具，不要只输出文字。'
        })
        continue // 继续下一轮
      }
      // 达到最大轮次，结束
      console.log('\n[Agent] 达到最大轮次，任务结束')
      finalResponse = aiResponse
      break
    }

    // 执行工具调用
    console.log(`\n[解析到 ${vcpCalls.length} 个 VCP 调用]`)

    const toolResults: string[] = []
    for (const call of vcpCalls) {
      console.log(`\n  → 执行: ${call.tool_name}.${call.command}`)

      // 执行工具，传入最新的参考图
      const result = await executeVCPTool(call, lastGeneratedBase64 || undefined)

      console.log(`  [结果] ${result.success ? '✅ 成功' : '❌ 失败'}`)

      if (result.success && result.data?.localPath) {
        const imageName = `图${generatedImages.length + 1}_${call.command}`
        generatedImages.push({
          name: imageName,
          path: result.data.localPath,
          base64: result.data.base64!
        })
        // 同步更新全局记录，供日记和论坛使用
        generatedImagesForDiary = [...generatedImages]
        // 更新参考图为最新生成的图片
        lastGeneratedBase64 = result.data.base64!

        logInteraction(turn, 'tool_result', result.output, undefined, result.data.localPath)
      } else {
        logInteraction(turn, 'tool_result', result.output)
      }

      toolResults.push(`[工具: ${call.tool_name}.${call.command}]\n${result.output}`)
    }

    // 将工具结果返回给 AI
    messages.push({ role: 'assistant', content: aiResponse })
    messages.push({
      role: 'user',
      content: `工具执行结果：\n\n${toolResults.join('\n\n---\n\n')}\n\n请继续下一步，或者告诉用户任务完成情况。如果还有图片需要生成，请继续调用工具。`
    })
  }

  return { images: generatedImages, finalResponse }
}

// ==================== 测试用例 ====================

describe.skipIf(!hasApiKey)('AI Agent VCP 调用测试', () => {
  let referenceImageBase64: string | null = null

  it('加载参考图', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('  加载参考图')
    console.log('='.repeat(70))

    if (fs.existsSync(REFERENCE_IMAGE_PATH)) {
      referenceImageBase64 = imageToBase64DataUrl(REFERENCE_IMAGE_PATH)
      console.log(`[参考图已加载] ${REFERENCE_IMAGE_PATH}`)

      ensureOutputDir()
      fs.copyFileSync(REFERENCE_IMAGE_PATH, path.join(OUTPUT_DIR, 'reference.png'))
    } else {
      console.log('[警告] 参考图不存在')
    }

    expect(true).toBe(true)
  })

  it('AI 自主生成单张图片', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('  测试: AI 自主生成 VCP 调用')
    console.log('='.repeat(70))

    const task = `请基于参考图设计一张 "67像素机器人" 的儿童睡衣上衣图案。

要求：
- 图案要包含数字 "67"，设计成乐高积木风格的机器人形象
- 像素艺术风格
- 青蓝色为主，粉红色边框
- 图片比例 3:4
- 适合印在儿童睡衣上

请你自己设计 prompt 并调用工具生成图片。`

    const result = await designAgentLoop(task, referenceImageBase64, 3)

    console.log(`\n[生成结果] ${result.images.length} 张图片`)
    for (const img of result.images) {
      console.log(`  - ${img.name}: ${img.path}`)
    }

    saveInteractionLog()

    expect(result.images.length).toBeGreaterThanOrEqual(1)
  }, 180000)

  it('AI 协同生成 5 张设计图', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('  测试: AI 协同生成完整设计方案')
    console.log('='.repeat(70))

    const task = `请帮我完成一套完整的儿童睡衣设计，需要生成以下 5 张图：

1. **大图案上衣设计** - "67"像素机器人的主图案，适合印在睡衣胸前
2. **无缝满印图案** - 提取元素排版成无缝重复图案，用于裤子
3. **睡衣套装预览** - 展示上衣+裤子的完整套装效果
4. **电商实拍图** - 专业的产品展示图（平铺或挂拍）
5. **儿童模特图** - 穿着睡衣的儿童全身照

设计约束：
- 所有图片必须包含 "67" 元素
- 像素艺术风格，保持统一
- 青蓝色主色调，粉红色边框
- 图片比例 3:4

请按顺序生成，每张图都要用上一张的结果作为参考（系统会自动处理）。
你需要自己设计每张图的 prompt，然后调用工具生成。

重要：你是自主 Agent，直接执行所有任务，不要询问确认。每一轮都必须调用工具。`

    const result = await designAgentLoop(task, referenceImageBase64, 20)

    console.log('\n' + '='.repeat(70))
    console.log('  生成结果汇总')
    console.log('='.repeat(70))

    console.log(`\n共生成 ${result.images.length} 张图片：`)
    for (const img of result.images) {
      console.log(`  - ${img.name}: ${img.path}`)
    }

    // 保存交互日志
    saveInteractionLog()

    console.log(`\n[输出目录] ${OUTPUT_DIR}`)

    expect(result.images.length).toBeGreaterThanOrEqual(3)
  }, 600000) // 10 分钟超时

  it('验证 VCP 解析器', () => {
    console.log('\n' + '='.repeat(70))
    console.log('  测试: VCP 解析器')
    console.log('='.repeat(70))

    const testInput = `好的，我来生成第一张图。

<<<[TOOL_REQUEST]>>>
tool_name:「始」GeminiImageGen「末」,
command:「始」edit「末」,
prompt:「始」Create a cute pixel art "67" robot character design for children's pajamas. The numbers 6 and 7 form a LEGO-style robot with cyan blue color and pink outline. Aspect ratio 3:4.「末」,
image_url:「始」PROVIDED_BY_SYSTEM「末」
<<<[END_TOOL_REQUEST]>>>

这个 prompt 包含了所有要求的元素。`

    const parsed = parseVCPToolRequest(testInput)

    console.log('[解析结果]')
    console.log(JSON.stringify(parsed, null, 2))

    expect(parsed.length).toBe(1)
    expect(parsed[0].tool_name).toBe('GeminiImageGen')
    expect(parsed[0].command).toBe('edit')
    expect(parsed[0].params.prompt).toContain('67')
  })

  it('保存最终日志', () => {
    const logContent = saveInteractionLog()
    console.log(`\n[日志内容预览]\n${logContent.slice(0, 500)}...`)
    expect(fs.existsSync(LOG_FILE)).toBe(true)
  })
})
