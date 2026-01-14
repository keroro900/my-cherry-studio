/**
 * VCP 内置服务手动测试脚本
 *
 * 在 Electron 主进程中运行此脚本测试内置服务
 * 可以在 main/index.ts 的 app.whenReady() 中调用
 */

import { getBuiltinServiceRegistry } from '../index'

export async function testBuiltinServices() {
  console.log('=== VCP 内置服务测试 ===\n')

  const registry = getBuiltinServiceRegistry()
  await registry.initialize()

  // 1. 测试 VCPForum - 创建帖子
  console.log('--- 测试 VCPForum ---')
  const forumResult = await registry.execute('VCPForum', 'CreatePost', {
    maid: 'test-user',
    board: '测试板块',
    title: '测试帖子',
    content: '这是一个测试帖子内容'
  })
  console.log('CreatePost:', forumResult.success ? '✅' : '❌', forumResult.output || forumResult.error)

  // 列出帖子
  const listResult = await registry.execute('VCPForum', 'ListAllPosts', {})
  console.log('ListAllPosts:', listResult.success ? '✅' : '❌')

  // 2. 测试 DailyNoteWrite - 写日记
  console.log('\n--- 测试 DailyNoteWrite ---')
  const diaryResult = await registry.execute('DailyNoteWrite', 'write', {
    content: '这是一条测试日记，由 VCP 测试脚本创建。',
    tags: ['测试', 'VCP'],
    category: 'test'
  })
  console.log('write:', diaryResult.success ? '✅' : '❌', diaryResult.output || diaryResult.error)

  // 获取统计
  const statsResult = await registry.execute('DailyNoteWrite', 'GetStats', {})
  console.log('GetStats:', statsResult.success ? '✅' : '❌', statsResult.data)

  // 3. 测试 LightMemo - 搜索
  console.log('\n--- 测试 LightMemo ---')
  const searchResult = await registry.execute('LightMemo', 'SearchRAG', {
    query: '测试',
    k: 3
  })
  console.log('SearchRAG:', searchResult.success ? '✅' : '❌', `找到 ${(searchResult.data as any)?.results?.length || 0} 条`)

  // 4. 测试 VCPToolInfo - 获取工具信息
  console.log('\n--- 测试 VCPToolInfo ---')
  const toolInfoResult = await registry.execute('vcp_tool_info', 'GetToolInfo', {
    tool_name: 'DailyNoteWrite'
  })
  console.log('GetToolInfo:', toolInfoResult.success ? '✅' : '❌')

  console.log('\n=== 测试完成 ===')

  return {
    forum: forumResult.success,
    diary: diaryResult.success,
    search: searchResult.success,
    toolInfo: toolInfoResult.success
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testBuiltinServices()
    .then((results) => console.log('Results:', results))
    .catch((err) => console.error('Error:', err))
}
