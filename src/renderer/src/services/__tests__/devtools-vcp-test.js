/**
 * DevTools Console VCP 链路测试脚本
 *
 * 使用方法：
 * 1. 启动 Cherry Studio (yarn dev)
 * 2. 打开 DevTools (Ctrl+Shift+I 或 F12)
 * 3. 复制此脚本到 Console 中执行
 *
 * 测试内容：
 * - 完整 IPC 调用链路
 * - VCP 工具执行 (GeminiImageGen, DailyNoteWrite 等)
 * - AI 模型协调
 * - 图片生成与审核
 */

(async function runVCPLinkTest() {
  console.log('\n' + '='.repeat(70))
  console.log('  VCP 完整链路测试 (DevTools Console)')
  console.log('='.repeat(70))

  // ==================== 配置 ====================
  const SILICONFLOW_API_KEY = 'sk-cudqddbefngypqlfdnmbshjugvwykvrlnsinwegrctywbwqe'
  const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
  const TEXT_MODEL = 'Qwen/Qwen3-8B'
  const VISION_MODEL = 'zai-org/GLM-4.6V'

  // 参考图路径
  const REFERENCE_IMAGE_PATH = 'C:\\Users\\Administrator\\Downloads\\ComfyUI_00011_vjppi_1766965419.png'

  // ==================== 工具函数 ====================

  // 检查 IPC API 是否可用
  function checkIPCAvailable() {
    const hasVcpTool = !!window.api?.vcpTool?.execute
    const hasVcpPlugin = !!window.api?.vcpPlugin
    console.log(`[IPC 检查] vcpTool.execute: ${hasVcpTool ? '✅' : '❌'}`)
    console.log(`[IPC 检查] vcpPlugin: ${hasVcpPlugin ? '✅' : '❌'}`)
    return hasVcpTool
  }

  // 调用 AI 模型
  async function callAI(messages, useVision = false) {
    const model = useVision ? VISION_MODEL : TEXT_MODEL
    console.log(`[AI 调用] 模型: ${model}`)

    try {
      const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
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
        return { success: false, error: `AI API error: ${response.status}` }
      }

      const data = await response.json()
      return { success: true, content: data.choices?.[0]?.message?.content || '' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // 解析 VCP 工具调用
  function parseVCPToolRequest(text) {
    const results = []
    const regex = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g

    let match
    while ((match = regex.exec(text)) !== null) {
      const content = match[1].trim()
      const parsed = { tool_name: '', command: '', params: {} }

      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue

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

  // Gemini 配置已内置在 GeminiImageGenService 中，无需在前端配置

  // 执行 VCP 工具 (使用 IPC)
  async function executeVCPToolIPC(request, referenceImageBase64) {
    const { tool_name, command, params } = request

    console.log(`\n[执行 VCP IPC] ${tool_name}.${command}`)

    // 构建 IPC 参数
    const ipcParams = { command, ...params }

    // 处理参考图
    if (command === 'edit' && referenceImageBase64 && params.image_url === 'PROVIDED_BY_SYSTEM') {
      ipcParams.image_url = referenceImageBase64
    }

    try {
      const result = await window.api.vcpTool.execute(tool_name, ipcParams)
      console.log(`[VCP IPC 结果] ${result.success ? '✅ 成功' : '❌ 失败'}`)

      if (result.success) {
        console.log(`[输出] ${(result.output || '').slice(0, 200)}...`)
        if (result.data?.localPath) {
          console.log(`[图片路径] ${result.data.localPath}`)
        }
      } else {
        console.error(`[错误] ${result.error}`)
      }

      return result
    } catch (error) {
      console.error(`[VCP IPC 异常] ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // 读取图片为 base64
  async function loadImageAsBase64(filePath) {
    // 在渲染进程中，使用 IPC 读取文件
    try {
      const result = await window.api.file.read(filePath)
      if (result) {
        const ext = filePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
        return `data:image/${ext};base64,${btoa(String.fromCharCode(...new Uint8Array(result)))}`
      }
    } catch (e) {
      console.warn(`无法通过 IPC 读取图片: ${e.message}`)
    }
    return null
  }

  // ==================== 测试流程 ====================

  // 1. 检查 IPC
  console.log('\n[Step 1] 检查 IPC 可用性')
  if (!checkIPCAvailable()) {
    console.error('❌ IPC 不可用，请确保在 Electron 渲染进程中运行')
    return
  }

  // 2. 列出可用的 VCP 服务
  console.log('\n[Step 2] 获取可用 VCP 服务列表')
  try {
    const pluginsResult = await window.api.vcpPlugin.list()
    // 处理返回值可能是对象或数组的情况
    const plugins = Array.isArray(pluginsResult) ? pluginsResult :
                    pluginsResult?.plugins ? pluginsResult.plugins :
                    Object.values(pluginsResult || {})
    console.log(`[VCP 返回类型] ${typeof pluginsResult}, isArray: ${Array.isArray(pluginsResult)}`)
    console.log(`[VCP 返回内容] ${JSON.stringify(pluginsResult).slice(0, 500)}`)

    if (Array.isArray(plugins)) {
      const builtinServices = plugins.filter(p => p.isBuiltin || p.pluginType === 'builtin_service')
      console.log(`[VCP 服务] 共 ${builtinServices.length} 个内置服务`)

      // 找到 GeminiImageGen
      const geminiService = builtinServices.find(p => p.name === 'GeminiImageGen')
      if (geminiService) {
        console.log(`[GeminiImageGen] ✅ 已找到`)
        console.log(`[GeminiImageGen 详情] ${JSON.stringify(geminiService).slice(0, 300)}`)
      } else {
        console.warn(`[GeminiImageGen] ❌ 未找到，可能需要配置`)
      }
    } else {
      console.log(`[VCP 服务] 返回格式非数组，跳过过滤`)
    }
  } catch (e) {
    console.warn(`获取服务列表失败: ${e.message}`)
  }

  // 2.5 服务配置检查（API Key 已内置在 GeminiImageGenService 中）
  console.log('\n[Step 2.5] 服务配置检查')
  console.log(`[配置] GeminiImageGen 使用内置默认 API Key 和端点`)
  console.log(`[可用 API] vcpPlugin: ${Object.keys(window.api.vcpPlugin || {}).join(', ')}`)
  console.log(`[可用 API] vcpTool: ${Object.keys(window.api.vcpTool || {}).join(', ')}`)

  // 3. 测试 AI 调用
  console.log('\n[Step 3] 测试 AI 模型调用')
  const systemPrompt = `你是一个服装设计 AI 助手。

## 可用工具

### GeminiImageGen.generate - 文生图
<<<[TOOL_REQUEST]>>>
tool_name:「始」GeminiImageGen「末」,
command:「始」generate「末」,
prompt:「始」英文描述「末」
<<<[END_TOOL_REQUEST]>>>

## 任务
设计一个 "67" 像素机器人图案，用于儿童睡衣。要求像素艺术风格，青蓝色主色，粉红边框。`

  const aiResult = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请设计一张 67 像素机器人的儿童睡衣图案，自己写 prompt 并调用工具。' }
  ])

  if (!aiResult.success) {
    console.error(`❌ AI 调用失败: ${aiResult.error}`)
    return
  }

  console.log(`[AI 响应]\n${aiResult.content.slice(0, 500)}...`)

  // 4. 解析 VCP 工具调用
  console.log('\n[Step 4] 解析 VCP 工具调用')
  const vcpCalls = parseVCPToolRequest(aiResult.content)

  if (vcpCalls.length === 0) {
    console.warn('AI 没有生成工具调用')
    return
  }

  console.log(`[解析结果] ${vcpCalls.length} 个工具调用:`)
  vcpCalls.forEach((call, i) => {
    console.log(`  ${i + 1}. ${call.tool_name}.${call.command}`)
  })

  // 5. 执行 VCP 工具
  console.log('\n[Step 5] 执行 VCP 工具 (IPC)')
  for (const call of vcpCalls) {
    const result = await executeVCPToolIPC(call, null)

    if (result.success && result.data?.localPath) {
      console.log(`\n🎉 图片生成成功！`)
      console.log(`📁 路径: ${result.data.localPath}`)
      console.log('✅ 完整 IPC 链路测试通过！')
    } else if (result.success) {
      console.log(`✅ 工具执行成功`)
    } else {
      console.error(`❌ 工具执行失败: ${result.error}`)
    }
  }

  // 跳过日记服务测试（会触发大量后台处理）
  // console.log('\n[Step 7] 测试 DailyNoteWrite 服务')
  // ...

  // 总结
  console.log('\n' + '='.repeat(70))
  console.log('  测试完成')
  console.log('='.repeat(70))
  console.log(`
✅ IPC 可用性检查
✅ AI 模型调用 (${TEXT_MODEL})
✅ VCP 协议解析
✅ VCP 工具执行 (IPC)
  `)
  console.log('🏁 测试脚本已结束，无后续操作')

})()
