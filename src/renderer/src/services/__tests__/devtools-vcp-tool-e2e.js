/**
 * VCP 工具调用端到端测试脚本
 *
 * 测试目标：验证 VCPToolExecutorMiddleware 统一后的工具调用流程
 *
 * 使用方法：
 * 1. 启动 Cherry Studio (yarn dev)
 * 2. 打开 DevTools (Ctrl+Shift+I 或 F12)
 * 3. 复制此脚本到 Console 中执行
 *
 * 测试覆盖：
 * - vcpUnified.executeTool API（统一入口）
 * - vcpTool.execute API（回退路径）
 * - DailyNoteWrite 日记服务
 * - MetaThinking 元思考服务
 * - Native 模块状态
 * - VCP 协议解析与执行
 *
 * 更新日期：2026-01-08
 */

;(async function runVCPToolE2ETest() {
  console.log('\n' + '='.repeat(70))
  console.log('  VCP 工具调用 E2E 测试 (2026-01-08)')
  console.log('  测试 VCPToolExecutorMiddleware 统一入口')
  console.log('='.repeat(70))

  // ==================== 测试结果收集 ====================
  const testResults = {
    passed: [],
    failed: [],
    skipped: []
  }

  function recordResult(name, success, detail = '') {
    if (success === null) {
      testResults.skipped.push({ name, detail })
      console.log(`⏭️  [跳过] ${name}: ${detail}`)
    } else if (success) {
      testResults.passed.push({ name, detail })
      console.log(`✅ [通过] ${name}`)
    } else {
      testResults.failed.push({ name, detail })
      console.error(`❌ [失败] ${name}: ${detail}`)
    }
  }

  // ==================== 1. IPC 可用性检查 ====================
  console.log('\n[Test 1] IPC API 可用性检查')
  console.log('-'.repeat(50))

  const apis = {
    'vcpUnified.executeTool': !!window.api?.vcpUnified?.executeTool,
    'vcpTool.execute': !!window.api?.vcpTool?.execute,
    'vcpPlugin.list': !!window.api?.vcpPlugin?.list,
    'vcpNative (invoke)': typeof window.api?.invoke === 'function'
  }

  for (const [name, available] of Object.entries(apis)) {
    console.log(`  ${name}: ${available ? '✅' : '❌'}`)
  }

  recordResult('IPC API 可用性', apis['vcpUnified.executeTool'] || apis['vcpTool.execute'])

  if (!apis['vcpUnified.executeTool'] && !apis['vcpTool.execute']) {
    console.error('\n❌ 没有可用的 VCP 工具 API，测试终止')
    return
  }

  // ==================== 2. Native 模块状态检查 ====================
  console.log('\n[Test 2] Native 模块状态检查')
  console.log('-'.repeat(50))

  try {
    // 正确的 API 路径: window.api.vcp.getNativeStatus()
    const nativeStatus = await window.api?.vcp?.getNativeStatus()
    console.log(`  Native 状态: ${JSON.stringify(nativeStatus, null, 2)}`)
    if (nativeStatus?.success && nativeStatus?.data) {
      console.log(`  isNative: ${nativeStatus.data.isNative}`)
      console.log(`  version: ${nativeStatus.data.version}`)
      console.log(`  features: ${nativeStatus.data.features?.join(', ')}`)
    }
    recordResult('Native 模块状态', nativeStatus?.success, nativeStatus?.error || '')
  } catch (e) {
    recordResult('Native 模块状态', false, e.message)
  }

  // ==================== 3. 列出可用服务 ====================
  console.log('\n[Test 3] 可用服务列表')
  console.log('-'.repeat(50))

  let availableServices = []
  try {
    const pluginsResult = await window.api.vcpPlugin.list()
    // 正确处理返回格式: { success: boolean, data?: Array<...> }
    const plugins = pluginsResult?.success && pluginsResult?.data
      ? pluginsResult.data
      : Array.isArray(pluginsResult)
        ? pluginsResult
        : []

    availableServices = plugins.map((p) => p.name).filter(Boolean)
    console.log(`  共 ${availableServices.length} 个服务`)
    console.log(`  示例: ${availableServices.slice(0, 10).join(', ')}${availableServices.length > 10 ? '...' : ''}`)
    recordResult('服务列表获取', availableServices.length > 0, pluginsResult?.error || '')
  } catch (e) {
    recordResult('服务列表获取', false, e.message)
  }

  // ==================== 4. 测试 vcpUnified.executeTool ====================
  console.log('\n[Test 4] vcpUnified.executeTool 统一 API 测试')
  console.log('-'.repeat(50))

  // 4.1 测试 DailyNoteWrite:ListNotes
  console.log('\n  4.1 DailyNoteWrite:ListNotes (列出日记)')
  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: 'DailyNoteWrite:ListNotes', // ListNotes 是正确的命令名
        params: { limit: '5' },
        source: 'vcp'
      })
      console.log(`    结果: ${result.success ? '成功' : '失败'}`)
      console.log(`    来源: ${result.source || 'unknown'}`)
      if (result.output) {
        console.log(`    输出预览: ${String(result.output).slice(0, 200)}...`)
      }
      recordResult('DailyNoteWrite:ListNotes', result.success, result.error || '')
    } else {
      recordResult('DailyNoteWrite:ListNotes', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('DailyNoteWrite:ListNotes', false, e.message)
  }

  // 4.2 测试 DailyNoteWrite:write (写入测试日记) - 注意小写 write
  console.log('\n  4.2 DailyNoteWrite:write (写入测试日记)')
  const testDiaryContent = `[E2E 测试] 工具调用测试日记
时间: ${new Date().toISOString()}
测试内容: VCPToolExecutorMiddleware 统一入口验证
这是一条自动生成的测试日记，用于验证工具调用流程。`

  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: 'DailyNoteWrite:write', // 小写 write
        params: {
          content: testDiaryContent,
          character: 'E2E测试角色'
        },
        source: 'vcp'
      })
      console.log(`    结果: ${result.success ? '成功' : '失败'}`)
      console.log(`    来源: ${result.source || 'unknown'}`)
      recordResult('DailyNoteWrite:write', result.success, result.error || '')
    } else {
      recordResult('DailyNoteWrite:write', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('DailyNoteWrite:write', false, e.message)
  }

  // 4.3 测试 MetaThinking:ThinkVCP (VCP 风格元思考) - 使用 ThinkVCP 命令
  console.log('\n  4.3 MetaThinking:ThinkVCP (VCP 风格元思考)')
  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: 'MetaThinking:ThinkVCP', // 使用 ThinkVCP 命令
        params: {
          topic: '如何测试工具调用系统',
          chain: 'quick' // VCP 链类型: default/quick/deep/creative
        },
        source: 'vcp'
      })
      console.log(`    结果: ${result.success ? '成功' : '失败'}`)
      console.log(`    来源: ${result.source || 'unknown'}`)
      if (result.output) {
        console.log(`    思考结果预览: ${String(result.output).slice(0, 300)}...`)
      }
      recordResult('MetaThinking:ThinkVCP', result.success, result.error || '')
    } else {
      recordResult('MetaThinking:ThinkVCP', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('MetaThinking:ThinkVCP', false, e.message)
  }

  // ==================== 5. 测试 vcpTool.execute 回退路径 ====================
  console.log('\n[Test 5] vcpTool.execute 回退路径测试')
  console.log('-'.repeat(50))

  try {
    if (window.api?.vcpTool?.execute) {
      // 使用旧格式调用
      const result = await window.api.vcpTool.execute('DailyNoteWrite', {
        command: 'ListNotes',
        limit: '3'
      })
      console.log(`  结果: ${result?.success ? '成功' : '失败'}`)
      recordResult('vcpTool.execute 回退', result?.success, result?.error || '')
    } else {
      recordResult('vcpTool.execute 回退', null, 'vcpTool API 不可用')
    }
  } catch (e) {
    recordResult('vcpTool.execute 回退', false, e.message)
  }

  // ==================== 6. 模拟 AI 工具调用场景 ====================
  console.log('\n[Test 6] 模拟 AI 工具调用场景')
  console.log('-'.repeat(50))

  // 模拟 AI 返回的 tool_use 格式，转换为 VCP 请求
  const mockToolUseResponse = {
    tool: {
      name: 'DailyNoteWrite:SearchNotes', // 正确的命令名
      id: 'dailynote_search'
    },
    arguments: {
      query: 'E2E测试', // 正确的参数名是 query 而不是 keyword
      limit: 10
    }
  }

  console.log('  模拟 tool_use 请求:')
  console.log(`    工具: ${mockToolUseResponse.tool.name}`)
  console.log(`    参数: ${JSON.stringify(mockToolUseResponse.arguments)}`)

  // 转换为 VCP 格式（模拟 convertToolUseToVCPRequest 逻辑）
  const vcpRequest = {
    toolName: mockToolUseResponse.tool.name,
    params: {}
  }
  for (const [key, value] of Object.entries(mockToolUseResponse.arguments)) {
    vcpRequest.params[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }

  console.log('  转换为 VCP 请求:')
  console.log(`    toolName: ${vcpRequest.toolName}`)
  console.log(`    params: ${JSON.stringify(vcpRequest.params)}`)

  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: vcpRequest.toolName,
        params: vcpRequest.params,
        source: 'mcp' // 模拟来自 MCP 的调用
      })
      console.log(`  执行结果: ${result.success ? '成功' : '失败'}`)
      console.log(`  执行来源: ${result.source || 'unknown'}`)
      recordResult('模拟 AI tool_use 调用', result.success, result.error || '')
    } else {
      recordResult('模拟 AI tool_use 调用', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('模拟 AI tool_use 调用', false, e.message)
  }

  // ==================== 7. 测试 AIMemo 服务 ====================
  console.log('\n[Test 7] AIMemo 服务测试')
  console.log('-'.repeat(50))

  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: 'AIMemo:Recall', // 正确的命令名：Recall 用于召回/搜索
        params: {
          query: '工具调用',
          topK: '5'
        },
        source: 'vcp'
      })
      console.log(`  结果: ${result.success ? '成功' : '失败'}`)
      if (result.output) {
        console.log(`  输出预览: ${String(result.output).slice(0, 200)}...`)
      }
      recordResult('AIMemo:Recall', result.success, result.error || '')
    } else {
      recordResult('AIMemo:Recall', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('AIMemo:Recall', false, e.message)
  }

  // ==================== 8. 测试 MetaThinking:List (列出可用链) ====================
  console.log('\n[Test 8] MetaThinking:List 服务测试')
  console.log('-'.repeat(50))

  try {
    if (window.api?.vcpUnified?.executeTool) {
      const result = await window.api.vcpUnified.executeTool({
        toolName: 'MetaThinking:List', // 列出可用的思考链
        params: {},
        source: 'vcp'
      })
      console.log(`  结果: ${result.success ? '成功' : '失败'}`)
      if (result.output) {
        console.log(`  可用链: ${String(result.output).slice(0, 300)}...`)
      }
      recordResult('MetaThinking:List', result.success, result.error || '')
    } else {
      recordResult('MetaThinking:List', null, 'vcpUnified API 不可用')
    }
  } catch (e) {
    recordResult('MetaThinking:List', false, e.message)
  }

  // ==================== 9. VCP 协议解析测试 ====================
  console.log('\n[Test 9] VCP 协议格式解析测试')
  console.log('-'.repeat(50))

  // 模拟 AI 返回的 VCP 格式文本
  const vcpProtocolText = `好的，我来帮你写一条日记。

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」,
command:「始」write「末」,
content:「始」今天测试了 VCP 工具调用系统，一切运行正常。「末」,
character:「始」测试助手「末」
<<<[END_TOOL_REQUEST]>>>

日记已写入完成。`

  // 解析 VCP 协议（模拟 vcpProtocolParser.parseToolRequests 逻辑）
  function parseVCPProtocol(text) {
    const results = []
    const regex = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g

    let match
    while ((match = regex.exec(text)) !== null) {
      const content = match[1].trim()
      const parsed = { toolName: '', params: {} }

      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let keyMatch = trimmed.match(/^(\w+):「始」([\s\S]*?)「末」,?$/)
        if (!keyMatch) keyMatch = trimmed.match(/^(\w+):\s*(.+?),?$/)

        if (keyMatch) {
          const [, key, value] = keyMatch
          const cleanValue = value.trim().replace(/,\s*$/, '')
          if (key === 'tool_name') {
            parsed.toolName = cleanValue
          } else if (key === 'command') {
            parsed.toolName = `${parsed.toolName}:${cleanValue}`
          } else {
            parsed.params[key] = cleanValue
          }
        }
      }

      if (parsed.toolName) results.push(parsed)
    }

    return results
  }

  const parsedRequests = parseVCPProtocol(vcpProtocolText)
  console.log(`  解析到 ${parsedRequests.length} 个工具请求`)

  if (parsedRequests.length > 0) {
    const req = parsedRequests[0]
    console.log(`  工具名: ${req.toolName}`)
    console.log(`  参数: ${JSON.stringify(req.params)}`)

    // 执行解析出的请求
    try {
      if (window.api?.vcpUnified?.executeTool) {
        const result = await window.api.vcpUnified.executeTool({
          toolName: req.toolName,
          params: req.params,
          source: 'vcp'
        })
        console.log(`  执行结果: ${result.success ? '成功' : '失败'}`)
        recordResult('VCP 协议解析与执行', result.success, result.error || '')
      } else {
        recordResult('VCP 协议解析与执行', null, 'vcpUnified API 不可用')
      }
    } catch (e) {
      recordResult('VCP 协议解析与执行', false, e.message)
    }
  } else {
    recordResult('VCP 协议解析与执行', false, '解析失败，未找到工具请求')
  }

  // ==================== 测试总结 ====================
  console.log('\n' + '='.repeat(70))
  console.log('  测试总结')
  console.log('='.repeat(70))

  console.log(`\n✅ 通过: ${testResults.passed.length}`)
  testResults.passed.forEach((t) => console.log(`   - ${t.name}`))

  console.log(`\n❌ 失败: ${testResults.failed.length}`)
  testResults.failed.forEach((t) => console.log(`   - ${t.name}: ${t.detail}`))

  console.log(`\n⏭️  跳过: ${testResults.skipped.length}`)
  testResults.skipped.forEach((t) => console.log(`   - ${t.name}: ${t.detail}`))

  const successRate = ((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(1)
  console.log(`\n📊 成功率: ${successRate}%`)

  console.log('\n' + '='.repeat(70))
  console.log('  测试完成')
  console.log('='.repeat(70))

  // 返回测试结果供外部使用
  return testResults
})()
