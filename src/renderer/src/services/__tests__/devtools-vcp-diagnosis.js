/**
 * VCP 工具调用诊断脚本
 *
 * 诊断目标：分析为什么内置服务（如 DailyNoteWrite）不工作
 *
 * 使用方法：
 * 1. 启动 Cherry Studio (yarn dev)
 * 2. 打开 DevTools (Ctrl+Shift+I 或 F12)
 * 3. 复制此脚本到 Console 中执行
 *
 * 更新日期：2026-01-10
 */

;(async function runVCPDiagnosis() {
  console.log('\n' + '='.repeat(70))
  console.log('  VCP 工具调用诊断 (2026-01-10)')
  console.log('  检查内置服务链路是否正常')
  console.log('='.repeat(70))

  const results = []

  // ==================== 1. 检查 IPC API 可用性 ====================
  console.log('\n[诊断 1] IPC API 可用性')
  console.log('-'.repeat(50))

  const apis = {
    'vcpUnified.executeTool': !!window.api?.vcpUnified?.executeTool,
    'vcpTool.execute': !!window.api?.vcpTool?.execute,
    'vcpPlaceholder.resolve': !!window.api?.vcpPlaceholder?.resolve,
    'vcpPlugin.list': !!window.api?.vcpPlugin?.list
  }

  let allApisOk = true
  for (const [name, available] of Object.entries(apis)) {
    const status = available ? '✅' : '❌'
    console.log(`  ${status} ${name}`)
    if (!available) allApisOk = false
  }
  results.push({ name: 'IPC API 可用性', pass: allApisOk })

  // ==================== 2. 检查服务列表 ====================
  console.log('\n[诊断 2] 内置服务列表')
  console.log('-'.repeat(50))

  try {
    const pluginsResult = await window.api.vcpPlugin.list()
    const plugins = pluginsResult?.success && pluginsResult?.data
      ? pluginsResult.data
      : Array.isArray(pluginsResult)
        ? pluginsResult
        : []

    const builtinServices = plugins.filter(p => p.isBuiltin || p.isNative)
    console.log(`  发现 ${builtinServices.length} 个内置服务:`)
    
    const hasDailyNoteWrite = builtinServices.some(s => 
      s.name === 'DailyNoteWrite' || s.name === 'Diary'
    )
    
    builtinServices.slice(0, 10).forEach(s => {
      console.log(`    - ${s.name} (${s.displayName || s.name})`)
    })
    if (builtinServices.length > 10) {
      console.log(`    ... 还有 ${builtinServices.length - 10} 个服务`)
    }
    
    console.log(`\n  DailyNoteWrite 服务: ${hasDailyNoteWrite ? '✅ 存在' : '❌ 未找到'}`)
    results.push({ name: '内置服务列表', pass: builtinServices.length > 0 })
    results.push({ name: 'DailyNoteWrite 服务', pass: hasDailyNoteWrite })
  } catch (e) {
    console.error(`  ❌ 获取服务列表失败: ${e.message}`)
    results.push({ name: '内置服务列表', pass: false })
  }

  // ==================== 3. 测试占位符解析 ====================
  console.log('\n[诊断 3] 占位符解析测试')
  console.log('-'.repeat(50))

  try {
    const testText = '{{VCPDailyNoteWrite}}'
    console.log(`  输入: "${testText}"`)
    
    const resolveResult = await window.api.vcpPlaceholder?.resolve(testText)
    console.log(`  原始返回:`, resolveResult)
    
    if (resolveResult?.success) {
      const resolved = resolveResult.result || ''
      const changed = resolved !== testText && resolved.length > 0
      console.log(`  解析成功: ${changed ? '✅ 已替换' : '⚠️ 未变化或为空'}`)
      
      if (changed && resolved) {
        console.log(`  输出长度: ${resolved.length} 字符`)
        console.log(`  输出预览:\n${resolved.substring(0, 800)}`)
        
        // 检查是否包含关键元素
        const hasToolExample = resolved.includes('<<<[TOOL_REQUEST]>>>')
        const hasToolName = resolved.includes('tool_name')
        console.log(`\n  包含工具调用示例: ${hasToolExample ? '✅' : '❌'}`)
        console.log(`  包含 tool_name: ${hasToolName ? '✅' : '❌'}`)
        
        results.push({ name: '占位符解析', pass: hasToolExample && hasToolName })
      } else if (resolved === '') {
        console.log(`  ⚠️ 返回空字符串，服务描述生成可能失败`)
        console.log(`  提示: 检查 PlaceholderEngine.generateSingleServiceDescription()`)
        results.push({ name: '占位符解析', pass: false })
      } else {
        console.log(`  ⚠️ 占位符未被替换，可能服务未注册`)
        results.push({ name: '占位符解析', pass: false })
      }
    } else {
      console.error(`  ❌ 解析失败: ${resolveResult?.error}`)
      results.push({ name: '占位符解析', pass: false })
    }
  } catch (e) {
    console.error(`  ❌ 占位符解析异常: ${e.message}`)
    console.error(`  堆栈:`, e.stack)
    results.push({ name: '占位符解析', pass: false })
  }

  // ==================== 4. 测试工具直接执行 ====================
  console.log('\n[诊断 4] 工具直接执行测试')
  console.log('-'.repeat(50))

  try {
    console.log('  测试: DailyNoteWrite:ListNotes')
    
    const result = await window.api.vcpUnified.executeTool({
      toolName: 'DailyNoteWrite:ListNotes',
      params: { limit: '3' },
      source: 'vcp'
    })
    
    if (result.success) {
      console.log(`  ✅ 执行成功 (${result.executionTimeMs}ms)`)
      console.log(`  来源: ${result.source}`)
      console.log(`  输出: ${String(result.output).substring(0, 200)}...`)
      results.push({ name: '工具直接执行', pass: true })
    } else {
      console.error(`  ❌ 执行失败: ${result.error}`)
      results.push({ name: '工具直接执行', pass: false })
    }
  } catch (e) {
    console.error(`  ❌ 执行异常: ${e.message}`)
    results.push({ name: '工具直接执行', pass: false })
  }

  // ==================== 5. 测试 VCP 协议解析 ====================
  console.log('\n[诊断 5] VCP 协议解析测试')
  console.log('-'.repeat(50))

  const testVCPRequest = `好的，我来帮你查看日记本。

<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」,
command:「始」ListNotes「末」,
limit:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`

  console.log('  模拟 AI 输出（包含工具调用）:')
  console.log(testVCPRequest.substring(0, 200) + '...')
  
  // 使用正则检测
  const vcpPattern = /<<<?(?:\[TOOL_REQUEST\])>>>?([\s\S]*?)<<<?(?:\[END_TOOL_REQUEST\])>>>?/g
  const matches = [...testVCPRequest.matchAll(vcpPattern)]
  
  console.log(`\n  检测到工具请求: ${matches.length} 个`)
  if (matches.length > 0) {
    console.log(`  ✅ VCP 协议格式正确`)
    results.push({ name: 'VCP 协议解析', pass: true })
  } else {
    console.log(`  ❌ 未检测到有效的工具请求`)
    results.push({ name: 'VCP 协议解析', pass: false })
  }

  // ==================== 汇总 ====================
  console.log('\n' + '='.repeat(70))
  console.log('  诊断结果汇总')
  console.log('='.repeat(70))

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length

  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`)
  }

  console.log(`\n  通过: ${passed}, 失败: ${failed}`)

  if (failed === 0) {
    console.log('\n✅ 所有诊断通过！工具调用链路正常。')
    console.log('\n如果 AI 仍然不使用工具，请检查：')
    console.log('  1. 助手系统提示词中是否包含 {{VCPDailyNoteWrite}} 或 {{VCPAllTools}}')
    console.log('  2. 使用的模型是否支持结构化输出/工具调用')
    console.log('  3. 角色扮演模式是否覆盖了工具调用指令')
  } else {
    console.log('\n⚠️ 存在问题，请检查上述失败项。')
  }

  console.log('\n' + '='.repeat(70))
})()

