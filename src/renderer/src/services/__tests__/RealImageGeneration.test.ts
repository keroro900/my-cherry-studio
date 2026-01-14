/**
 * 真实图片生成测试 - AI 多 Agent 协同设计
 *
 * 使用 Gemini 3 Pro Image Preview 生成图片
 * 使用硅基流动 Qwen 模型进行 AI 协调
 *
 * 任务：基于像素机器人图案设计儿童睡衣套装
 * 1. 图案变体大图案上衣
 * 2. 无缝满印服装印花（裤子）
 * 3. 涤纶面料睡衣样衣预览
 * 4. 电商实拍图（挂拍/平铺）
 * 5. 儿童模特上身全身照
 *
 * 运行命令:
 * SILICONFLOW_API_KEY=$VITE_SILICONFLOW_API_KEY yarn test:renderer --run src/renderer/src/services/__tests__/RealImageGeneration.test.ts
 */

import * as fs from 'fs'
import * as path from 'path'

import { describe, expect, it } from 'vitest'

// ==================== 配置 ====================

// 硅基流动 - AI 协调
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
const AI_MODEL = 'Qwen/Qwen3-8B'

// Gemini 图片生成
const GEMINI_API_KEY = 'sk-HAkNgRz5C9vAD3E1BgNqViOg8Anksu9pTJ0YGYu2gENb0cDR'
const GEMINI_BASE_URL = 'https://open.cherryin.net/v1'
const GEMINI_IMAGE_MODEL = 'google/gemini-3-pro-image-preview'

const hasApiKey = SILICONFLOW_API_KEY.length > 0

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'test-output', 'fashion-design')

// ==================== 工具函数 ====================

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function saveBase64Image(base64Data: string, filename: string): string {
  ensureOutputDir()
  const filepath = path.join(OUTPUT_DIR, filename)

  // 移除 data:image/xxx;base64, 前缀
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Clean, 'base64')
  fs.writeFileSync(filepath, buffer)

  console.log(`[保存图片] ${filepath}`)
  return filepath
}

// ==================== AI 调用 ====================

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

async function callAI(messages: Message[]): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `AI API error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ==================== Gemini 图片生成 ====================

interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  base64?: string
  error?: string
}

async function generateImage(prompt: string, retries = 2): Promise<ImageGenerationResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[Gemini] 生成图片 (尝试 ${attempt + 1}/${retries + 1})...`)
      console.log(`[Prompt] ${prompt.slice(0, 150)}...`)

      const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GEMINI_API_KEY}`
        },
        body: JSON.stringify({
          model: GEMINI_IMAGE_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4096
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Gemini] API error: ${response.status} - ${errorText}`)
        if (attempt < retries) continue
        return { success: false, error: `Gemini API error: ${response.status}` }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      // 检查是否返回了图片（base64 或 URL）
      // Gemini 可能返回 markdown 格式的图片 ![](data:image/...) 或 URL
      const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
      const urlMatch = content.match(/https?:\/\/[^\s)]+\.(png|jpg|jpeg|webp)/i)

      if (base64Match) {
        console.log(`[Gemini] 成功获取 base64 图片`)
        return { success: true, base64: base64Match[0] }
      } else if (urlMatch) {
        console.log(`[Gemini] 成功获取图片 URL: ${urlMatch[0]}`)
        return { success: true, imageUrl: urlMatch[0] }
      } else {
        // 可能整个 content 就是描述，尝试其他方式
        console.log(`[Gemini] 返回内容: ${content.slice(0, 200)}...`)

        // 检查是否有图片数据在其他字段
        if (data.choices?.[0]?.message?.images) {
          const images = data.choices[0].message.images
          if (images.length > 0) {
            return { success: true, base64: images[0] }
          }
        }

        if (attempt < retries) continue
        return { success: false, error: '未能从响应中提取图片' }
      }
    } catch (error) {
      console.error(`[Gemini] 错误: ${error}`)
      if (attempt < retries) continue
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return { success: false, error: '所有重试都失败了' }
}

// ==================== 设计 Agent 提示词 ====================

const DESIGN_COORDINATOR_PROMPT = `你是一个专业的服装设计协调 AI，负责协调多个设计任务。

## 当前项目：儿童睡衣套装设计

基于参考图案（蓝色像素风格乐高机器人，有故障艺术效果，竖起大拇指），设计一套儿童睡衣。

### 参考图案特征：
- 风格：像素艺术 (Pixel Art)
- 主题：蓝色乐高风格机器人角色
- 主色调：青蓝色 (#00BFFF)，深蓝色 (#4169E1)
- 辅助色：粉红色边框，绿色荧光效果
- 特征：方块状身体，单眼设计，竖起大拇指，故障艺术(Glitch)效果
- 情绪：友好、可爱、科技感

### 目标受众：
- 儿童（5-10岁）
- 男女通用
- 睡衣用途

### 需要生成的 5 张设计图：

1. **大图案上衣设计** - 图案变体，适合作为上衣的大图案印花
2. **无缝满印图案** - 提取元素排版的无缝重复图案，用于裤子
3. **样衣预览** - 涤纶面料睡衣套装预览（上衣+裤子）
4. **电商实拍图** - 专业的挂拍或平铺拍摄效果
5. **儿童模特图** - 穿着睡衣的儿童全身照

请为每张图生成详细的英文 prompt，要求专业、具体、可执行。`

// ==================== 测试 ====================

describe.skipIf(!hasApiKey)('真实图片生成 - AI 多 Agent 协同设计', () => {
  it('应该生成完整的儿童睡衣设计方案', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('  AI 多 Agent 协同设计 - 儿童睡衣套装')
    console.log('='.repeat(70))

    // Step 1: 让 AI 生成设计 prompts
    console.log('\n[Step 1] 请求 AI 生成设计 prompts...')

    const promptRequest = await callAI([
      { role: 'system', content: DESIGN_COORDINATOR_PROMPT },
      {
        role: 'user',
        content: `请为以下 5 张设计图生成专业的英文 prompt，每个 prompt 用 --- 分隔：

1. 大图案上衣设计
2. 无缝满印图案（裤子用）
3. 涤纶面料睡衣样衣预览
4. 电商实拍图
5. 儿童模特全身照

要求：
- 每个 prompt 200-300 词
- 包含详细的风格、颜色、构图描述
- 适合 AI 图片生成模型理解
- 保持像素机器人的可爱科技风格`
      }
    ])

    expect(promptRequest.success).toBe(true)
    console.log('\n[AI 生成的 Prompts]')
    console.log(promptRequest.content?.slice(0, 1500) + '...')

    // 解析 prompts
    const prompts = promptRequest.content?.split('---').map((p) => p.trim()).filter((p) => p.length > 50) || []
    console.log(`\n[解析结果] 共 ${prompts.length} 个 prompt`)

    // 如果 AI 没有按格式返回，使用预设 prompts
    const designPrompts = prompts.length >= 5 ? prompts : getDefaultPrompts()

    // Step 2: 生成 5 张图片
    const results: { name: string; prompt: string; result: ImageGenerationResult }[] = []
    const names = [
      '1_large_pattern_top',
      '2_seamless_pattern_pants',
      '3_pajama_mockup',
      '4_ecommerce_photo',
      '5_child_model'
    ]

    for (let i = 0; i < 5; i++) {
      console.log(`\n${'='.repeat(50)}`)
      console.log(`[图片 ${i + 1}/5] ${names[i]}`)
      console.log('='.repeat(50))

      const result = await generateImage(designPrompts[i])
      results.push({ name: names[i], prompt: designPrompts[i], result })

      if (result.success && result.base64) {
        saveBase64Image(result.base64, `${names[i]}_${Date.now()}.png`)
      }

      // 避免 API 限流
      if (i < 4) {
        console.log('[等待 3 秒...]')
        await new Promise((r) => setTimeout(r, 3000))
      }
    }

    // Step 3: 汇总结果
    console.log('\n' + '='.repeat(70))
    console.log('  设计结果汇总')
    console.log('='.repeat(70))

    let successCount = 0
    for (const r of results) {
      const status = r.result.success ? '✅ 成功' : '❌ 失败'
      console.log(`\n[${r.name}] ${status}`)
      if (r.result.success) {
        successCount++
        if (r.result.imageUrl) console.log(`  URL: ${r.result.imageUrl}`)
        if (r.result.base64) console.log(`  Base64: ${r.result.base64.slice(0, 50)}...`)
      } else {
        console.log(`  错误: ${r.result.error}`)
      }
    }

    console.log(`\n[总结] 成功生成 ${successCount}/5 张图片`)
    console.log(`[输出目录] ${OUTPUT_DIR}`)

    // 至少要有 1 张图片生成成功
    expect(successCount).toBeGreaterThanOrEqual(1)
  }, 300000) // 5 分钟超时

  it('应该能单独生成一张测试图片', async () => {
    console.log('\n[单张图片测试]')

    const testPrompt = `Generate a cute pixel art style blue robot character design for children's pajamas.
The robot should have:
- Blocky LEGO-like body shape
- Single eye design with friendly expression
- Thumbs up gesture
- Cyan blue (#00BFFF) and deep blue (#4169E1) color scheme
- Pink outline and green glow effects
- Glitch art aesthetic
- White background
- High resolution, clean edges
Style: kawaii, pixel art, children's apparel design`

    const result = await generateImage(testPrompt)

    console.log(`[结果] ${result.success ? '成功' : '失败'}`)
    if (result.success) {
      if (result.base64) {
        const filepath = saveBase64Image(result.base64, `test_robot_${Date.now()}.png`)
        console.log(`[保存] ${filepath}`)
      }
      if (result.imageUrl) {
        console.log(`[URL] ${result.imageUrl}`)
      }
    } else {
      console.log(`[错误] ${result.error}`)
    }

    expect(result.success).toBe(true)
  }, 120000)
})

// ==================== 预设 Prompts ====================

function getDefaultPrompts(): string[] {
  return [
    // 1. 大图案上衣设计
    `Create a large-scale graphic design for a children's pajama top featuring a cute pixel art style blue robot character.

Design specifications:
- Central large robot character (30cm print size)
- Blocky LEGO-inspired robot with single friendly eye
- Thumbs up pose, welcoming and playful
- Color palette: cyan blue (#00BFFF), deep blue (#4169E1), pink accents, green glow effects
- Glitch art aesthetic with digital distortion elements
- Surrounded by small emoji icons and pixel decorations
- Clean white/light blue background for contrast

Style: Kawaii pixel art, children's apparel, vector-clean edges
Output: Front chest graphic design, print-ready, high resolution PNG with transparent background`,

    // 2. 无缝满印图案
    `Design a seamless repeating pattern for children's pajama pants using pixel robot elements.

Pattern specifications:
- Small-scale repeating motifs (5-8cm repeat)
- Extract key elements: robot faces, thumbs up hands, pixel blocks, emoji icons
- Arranged in a playful scattered layout
- Seamless tile that repeats horizontally and vertically
- Color palette: cyan blue, deep blue, pink, green accents on navy or white base
- Glitch art lines and digital effects as connecting elements
- Balanced density - not too crowded, not too sparse

Style: All-over print, children's textile design, seamless pattern
Output: Square seamless tile, high resolution, ready for fabric printing`,

    // 3. 涤纶面料睡衣样衣预览
    `Professional product mockup of a children's polyester pajama set.

Mockup specifications:
- Two-piece pajama set: long sleeve top + pants
- Top: Large pixel robot graphic on chest (from design 1)
- Pants: All-over seamless robot pattern (from design 2)
- Fabric: Polyester with slight sheen, smooth texture
- Color: Light blue base with vibrant print
- Styling: Flat lay or ghost mannequin style
- Show both pieces together as a coordinated set
- Professional studio lighting, soft shadows
- Size reference: Children's size 6-8

Style: Product photography, apparel mockup, e-commerce ready
Output: Clean product shot on white background`,

    // 4. 电商实拍图
    `Professional e-commerce product photography of children's pixel robot pajama set.

Photography specifications:
- Flat lay or hanger shot composition
- Styled with complementary props: stuffed toys, pillows, fairy lights
- Background: Soft blue gradient or cozy bedroom setting
- Matches the pajama's tech-cute aesthetic
- Professional lighting with soft highlights
- Show fabric texture and print quality
- Include both top and pants in frame
- Color-coordinated styling elements

Style: Commercial product photography, lifestyle e-commerce
Output: High-resolution marketing image, Instagram-ready`,

    // 5. 儿童模特全身照
    `Professional children's fashion photography featuring pixel robot pajama set.

Model and styling specifications:
- Child model: 6-8 years old, friendly smile
- Asian or mixed ethnicity, gender-neutral styling
- Full body shot, standing pose
- Wearing the complete pajama set (top + pants)
- Natural, playful expression matching the cute robot theme
- Background: Soft pastel bedroom or studio setting
- Warm, inviting lighting
- Model interacting naturally (holding plush toy, waving)
- Hair styled simply, barefoot or with cozy slippers

Style: Children's fashion photography, catalog shot
Output: Full-length portrait, professional quality, family-friendly`
  ]
}
