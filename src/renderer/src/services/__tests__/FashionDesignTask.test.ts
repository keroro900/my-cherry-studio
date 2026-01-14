/**
 * 服装设计任务编排测试
 *
 * 让 AI 自己编排服装设计任务：
 * 1. 分析输入的图案图片
 * 2. 设计多个变体
 * 3. 生成满印裤子印花
 * 4. 生成服装效果图
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/FashionDesignTask.test.ts
 */

import { describe, expect, it } from 'vitest'

// ==================== 配置 ====================

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
const MODEL = 'Qwen/Qwen3-8B'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// ==================== VCP 解析器 ====================

interface ParsedVCPRequest {
  tool_name: string
  command: string
  params: Record<string, string>
}

function parseVCPToolRequest(text: string): ParsedVCPRequest[] {
  const results: ParsedVCPRequest[] = []
  // 正确转义 VCP 标签中的特殊字符
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

      let keyMatch = trimmed.match(/^(\w+):「始」(.*)「末」$/)
      if (!keyMatch) keyMatch = trimmed.match(/^(\w+):\s*(.+)$/)

      if (keyMatch) {
        const [, key, value] = keyMatch
        if (key === 'tool_name') parsed.tool_name = value.trim()
        else if (key === 'command') parsed.command = value.trim()
        else parsed.params[key] = value.trim()
      }
    }

    if (parsed.tool_name) results.push(parsed)
  }

  return results
}

// ==================== AI 调用 ====================

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

async function chat(messages: Message[]): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const res = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 3000
      })
    })

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` }
    }

    const data = await res.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ==================== 服装设计系统提示词 ====================

const FASHION_DESIGN_SYSTEM_PROMPT = `你是一个专业的服装设计 AI 助手，可以使用以下工具来完成设计任务：

## 图片分析工具

### FashionPipeline.AnalyzeGarment - 分析服装/图案
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」FashionPipeline「末」
command:「始」AnalyzeGarment「末」
image_url:「始」图片路径或URL「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### ImageGeneration.AnalyzeImage - 分析图片内容
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」ImageGeneration「末」
command:「始」AnalyzeImage「末」
image_url:「始」图片路径或URL「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 图片生成工具

### ImageGeneration.Generate - 生成图片
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」ImageGeneration「末」
command:「始」Generate「末」
prompt:「始」详细的图片描述（英文）「末」
style:「始」图片风格「末」
aspect_ratio:「始」1:1 或 16:9 或 9:16「末」
backend:「始」gemini 或 flux 或 qwen「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### ImageGeneration.GenerateVariations - 生成变体
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」ImageGeneration「末」
command:「始」GenerateVariations「末」
image_url:「始」原图URL「末」
count:「始」变体数量「末」
style_variation:「始」变体风格描述「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### FashionPipeline.GeneratePattern - 生成满印图案
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」FashionPipeline「末」
command:「始」GeneratePattern「末」
base_image:「始」基础图案URL「末」
pattern_type:「始」seamless_repeat 或 all_over「末」
scale:「始」图案缩放比例「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### FashionPipeline.GenerateModelImage - 生成服装效果图
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」FashionPipeline「末」
command:「始」GenerateModelImage「末」
garment_type:「始」pants 或 shirt 或 dress「末」
pattern_image:「始」印花图案URL「末」
model_style:「始」asian_female 或 asian_male 或 western_female「末」
background:「始」studio_white 或 street_fashion「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 任务规划工具

### TaskPlanner.CreatePlan - 创建任务计划
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」TaskPlanner「末」
command:「始」CreatePlan「末」
task_description:「始」任务描述「末」
steps:「始」步骤列表，用分号分隔「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 工作流程

当用户给你一个设计任务时，你应该：
1. 首先分析任务需求
2. 制定详细的执行计划
3. 按步骤调用相应工具
4. 在每一步说明你在做什么

如果缺少必要信息（如图片、参数等），主动询问用户。`

// ==================== 模拟工具执行 ====================

interface ToolResult {
  success: boolean
  output: string
  data?: any
}

function executeDesignTool(request: ParsedVCPRequest): ToolResult {
  const { tool_name, command, params } = request

  // FashionPipeline.AnalyzeGarment
  if (tool_name === 'FashionPipeline' && command === 'AnalyzeGarment') {
    return {
      success: true,
      output: `图案分析完成：
- 风格: 像素艺术 (Pixel Art)
- 主题: 蓝色乐高风格机器人角色
- 主色调: 青蓝色 (#00BFFF)，深蓝色 (#4169E1)
- 辅助色: 粉红色边框，绿色荧光效果
- 特征: 方块状身体，单眼设计，竖起大拇指，故障艺术(Glitch)效果
- 情绪: 友好、可爱、科技感
- 适合: 街头服饰、潮流单品、年轻人服装
- 建议印花类型: 满印(all-over print)、局部图案`,
      data: {
        style: 'pixel_art',
        theme: 'robot_character',
        colors: ['#00BFFF', '#4169E1', '#FF69B4', '#00FF00'],
        mood: 'friendly_tech',
        suitable_for: ['streetwear', 'casual', 'youth']
      }
    }
  }

  // ImageGeneration.Generate
  if (tool_name === 'ImageGeneration' && command === 'Generate') {
    const prompt = params.prompt || ''
    return {
      success: true,
      output: `图片生成任务已提交：
- 提示词: ${prompt.slice(0, 100)}...
- 风格: ${params.style || 'default'}
- 比例: ${params.aspect_ratio || '1:1'}
- 后端: ${params.backend || 'auto'}

[模拟] 生成的图片 URL: https://generated-image.example.com/${Date.now()}.png`,
      data: {
        image_url: `https://generated-image.example.com/${Date.now()}.png`,
        prompt: prompt
      }
    }
  }

  // ImageGeneration.GenerateVariations
  if (tool_name === 'ImageGeneration' && command === 'GenerateVariations') {
    const count = parseInt(params.count) || 4
    const urls = Array.from({ length: count }, (_, i) =>
      `https://variation-${i + 1}.example.com/${Date.now()}.png`
    )
    return {
      success: true,
      output: `变体生成完成，共 ${count} 个：
${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

变体风格: ${params.style_variation || '默认'}`,
      data: { variations: urls }
    }
  }

  // FashionPipeline.GeneratePattern
  if (tool_name === 'FashionPipeline' && command === 'GeneratePattern') {
    return {
      success: true,
      output: `满印图案生成完成：
- 图案类型: ${params.pattern_type || 'seamless_repeat'}
- 缩放比例: ${params.scale || '1.0'}
- 图案URL: https://pattern.example.com/${Date.now()}.png

图案特点：
- 无缝拼接，可用于大面积印花
- 保持原图案的像素风格
- 颜色鲜艳，适合潮流服饰`,
      data: {
        pattern_url: `https://pattern.example.com/${Date.now()}.png`,
        type: params.pattern_type
      }
    }
  }

  // FashionPipeline.GenerateModelImage
  if (tool_name === 'FashionPipeline' && command === 'GenerateModelImage') {
    return {
      success: true,
      output: `服装效果图生成完成：
- 服装类型: ${params.garment_type || 'pants'}
- 模特风格: ${params.model_style || 'asian_female'}
- 背景: ${params.background || 'studio_white'}
- 效果图URL: https://model-image.example.com/${Date.now()}.png

效果说明：
- 展示了满印印花在实际服装上的效果
- 模特穿着自然，展示正面视角
- 印花清晰可见，色彩还原准确`,
      data: {
        model_image_url: `https://model-image.example.com/${Date.now()}.png`,
        garment_type: params.garment_type
      }
    }
  }

  // TaskPlanner.CreatePlan
  if (tool_name === 'TaskPlanner' && command === 'CreatePlan') {
    return {
      success: true,
      output: `任务计划已创建：
${params.task_description}

执行步骤：
${params.steps?.split(';').map((s, i) => `${i + 1}. ${s.trim()}`).join('\n') || '无'}`,
      data: { plan_id: `plan_${Date.now()}` }
    }
  }

  return { success: false, output: `未知工具: ${tool_name}.${command}` }
}

// ==================== Agent 循环 ====================

async function designAgent(userMessage: string, maxTurns = 5): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: FASHION_DESIGN_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]

  let finalResponse = ''

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`[Turn ${turn + 1}] 调用 AI...`)
    console.log('='.repeat(50))

    const result = await chat(messages)
    if (!result.success || !result.content) {
      return `AI 调用失败: ${result.error}`
    }

    const aiResponse = result.content
    console.log(`\n[AI 回复]\n${aiResponse}`)

    // 解析工具调用
    const toolCalls = parseVCPToolRequest(aiResponse)

    if (toolCalls.length === 0) {
      finalResponse = aiResponse
      break
    }

    // 执行工具
    console.log(`\n[执行工具] 找到 ${toolCalls.length} 个工具调用`)

    const toolResults: string[] = []
    for (const call of toolCalls) {
      console.log(`\n  → ${call.tool_name}.${call.command}`)
      console.log(`    参数: ${JSON.stringify(call.params, null, 2).slice(0, 200)}`)

      const toolResult = executeDesignTool(call)
      console.log(`    结果: ${toolResult.success ? '✓ 成功' : '✗ 失败'}`)

      toolResults.push(`[工具: ${call.tool_name}.${call.command}]\n${toolResult.output}`)
    }

    // 将结果返回给 AI
    messages.push({ role: 'assistant', content: aiResponse })
    messages.push({
      role: 'user',
      content: `工具执行结果：\n\n${toolResults.join('\n\n---\n\n')}\n\n请继续执行下一步，或者根据结果回复用户。`
    })
  }

  return finalResponse
}

// ==================== 测试 ====================

describe.skipIf(!hasApiKey)('服装设计任务编排测试', () => {
  it('应该分析图案并规划设计任务', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('  服装设计任务: 分析像素机器人图案')
    console.log('='.repeat(60))

    const response = await designAgent(`
我有一张像素风格的蓝色乐高机器人图案（见附图），我想用它来设计服装。请帮我：

1. 分析这个图案的特点
2. 设计 3-4 个风格变体
3. 生成适合做满印裤子的印花图案
4. 生成服装效果图

图案描述：蓝色像素风格的乐高机器人角色，方块状身体，单眼设计，竖起大拇指，有故障艺术效果，周围有小表情符号装饰。
`)

    console.log('\n' + '='.repeat(60))
    console.log('  最终回复')
    console.log('='.repeat(60))
    console.log(response)

    expect(response).toBeDefined()
    expect(response.length).toBeGreaterThan(0)
  }, 180000)

  it('应该询问缺少的信息', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('  测试: AI 询问缺少的信息')
    console.log('='.repeat(60))

    const response = await designAgent('帮我设计一个潮流服装')

    console.log('\n[最终回复]')
    console.log(response)

    // AI 应该询问更多信息
    expect(response.toLowerCase()).toMatch(/什么|哪种|请提供|需要|告诉|图片|风格|类型/)
  }, 60000)

  it('应该生成完整的设计方案', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('  测试: 完整设计方案')
    console.log('='.repeat(60))

    const response = await designAgent(`
基于以下图案设计一条满印裤子：
- 图案: 蓝色像素机器人
- 风格: 街头潮流
- 目标人群: 年轻人
- 颜色要求: 以蓝色为主

请给出完整的设计方案和效果图。
`)

    console.log('\n[最终回复]')
    console.log(response)

    expect(response).toBeDefined()
  }, 180000)
})
