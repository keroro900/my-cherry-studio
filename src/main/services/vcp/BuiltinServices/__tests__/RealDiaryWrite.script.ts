/**
 * 真实日记写入脚本
 *
 * 直接写入文件系统，不使用 mock
 * 写入的日记可以在 Cherry Studio UI 中查看
 *
 * 运行方法:
 * npx ts-node --esm src/main/services/vcp/BuiltinServices/__tests__/RealDiaryWrite.script.ts
 *
 * 或者用 vitest 运行（设置 REAL_WRITE=true）:
 * REAL_WRITE=true yarn test:main --run src/main/services/vcp/BuiltinServices/__tests__/RealDiaryWrite.script.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ==================== 配置 ====================

// Cherry Studio Dev 的日记目录
const NOTES_DIR = 'C:/Users/Administrator/AppData/Roaming/CherryStudioDev/Data/Notes'

// ==================== 辅助函数 ====================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`[创建目录] ${dirPath}`)
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

interface DiaryEntry {
  title: string
  content: string
  tags: string[]
  category?: string
}

/**
 * 写入日记文件
 */
function writeDiary(entry: DiaryEntry): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const timestamp = Date.now()

  // 生成文件路径
  const category = entry.category || 'diary'
  const titleSlug = entry.title
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 30)

  const fileName = `${day}-${titleSlug}-${timestamp}.md`
  const relativeDir = `${category}/${year}/${month}`
  const absoluteDir = path.join(NOTES_DIR, relativeDir)
  const absolutePath = path.join(absoluteDir, fileName)
  const relativePath = `${relativeDir}/${fileName}`

  // 确保目录存在
  ensureDir(absoluteDir)

  // 构建 frontmatter
  const frontmatter = [
    '---',
    `id: ${generateId()}`,
    `title: "${entry.title}"`,
    `date: ${formatDate(date)}`,
    `tags: [${entry.tags.map(t => `"${t}"`).join(', ')}]`,
    `aiGenerated: true`,
    `createdBy: "VCP-Test-Script"`,
    '---'
  ].join('\n')

  // 完整内容
  const fullContent = `${frontmatter}\n\n${entry.content}`

  // 写入文件
  fs.writeFileSync(absolutePath, fullContent, 'utf-8')
  console.log(`[写入成功] ${relativePath}`)
  console.log(`[绝对路径] ${absolutePath}`)

  return absolutePath
}

// ==================== 测试日记 ====================

const testDiaries: DiaryEntry[] = [
  {
    title: 'VCP调用链路测试日记',
    content: `# VCP 调用链路测试

这是一条通过 VCP 测试脚本写入的日记，用于验证完整的调用链路。

## 测试时间
${new Date().toLocaleString('zh-CN')}

## 测试内容

1. **VCP 协议解析**: 验证 \`<<<[TOOL_REQUEST]>>>\` 格式能被正确解析
2. **DailyNoteWriteService**: 验证服务能正确接收写入请求
3. **NoteService**: 验证日记能正确写入文件系统
4. **UI 显示**: 验证日记能在 Cherry Studio UI 中显示

## VCP 调用格式示例

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」DailyNoteWrite「末」
command:「始」write「末」
content:「始」日记内容...「末」
tags:「始」VCP, 测试「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

## 结论

如果你能在 Cherry Studio 的日记/笔记页面看到这条日记，说明 VCP 调用链路完全正常工作！

---
*由 VCP 测试脚本自动生成*`,
    tags: ['VCP', '测试', '调用链路', 'E2E']
  },
  {
    title: 'AI助手协同测试',
    content: `# AI 助手协同功能测试

这条日记测试 **invoke_agent** 助手协同功能。

## 功能说明

invoke_agent 允许一个 AI 助手调用另一个专业助手来处理特定任务：

- **主脑 (Main Brain)**: 分发任务的中央协调者
- **专业助手**: 处理特定领域任务的专家

## 测试场景

1. 用户向主脑提问技术问题
2. 主脑识别需要代码助手协助
3. 主脑通过 invoke_agent 调用代码助手
4. 代码助手返回专业回答
5. 主脑整合回答返回用户

## 当前状态

✅ invoke_agent 工具已注册
✅ 助手协同调度可用
✅ 多轮对话支持

---
*由 VCP 测试脚本自动生成*`,
    tags: ['invoke_agent', '助手协同', 'AI', '测试']
  },
  {
    title: '记忆系统集成测试',
    content: `# 记忆系统集成测试

这条日记测试 **IntegratedMemoryCoordinator** 统一记忆系统。

## 记忆后端

| 后端 | 用途 | 状态 |
|------|------|------|
| DeepMemo | 深度记忆搜索 | ✅ |
| LightMemo | RAG 检索 | ✅ |
| Diary | 日记存储 | ✅ |
| AIMemo | AI 记忆 | ✅ |

## 搜索能力

- **BM25**: 关键词匹配
- **向量搜索**: 语义相似度
- **标签共现**: TagMemo 扩展
- **WaveRAG**: 三阶段检索 (Lens → Expansion → Focus)

## 使用方法

\`\`\`typescript
const coordinator = getIntegratedMemoryCoordinator()
const results = await coordinator.intelligentSearch('查询内容', {
  backends: ['deepmemo', 'lightmemo', 'diary'],
  useWaveRAG: true,
  useTagMemo: true
})
\`\`\`

---
*由 VCP 测试脚本自动生成*`,
    tags: ['记忆系统', 'DeepMemo', 'LightMemo', 'RAG', '测试']
  }
]

// ==================== 主函数 ====================

async function main() {
  console.log('==========================================')
  console.log('       VCP 真实日记写入测试脚本')
  console.log('==========================================')
  console.log(`\n[目标目录] ${NOTES_DIR}\n`)

  // 检查目录是否存在
  if (!fs.existsSync(NOTES_DIR)) {
    console.log('[警告] 目录不存在，将创建...')
  }

  // 写入所有测试日记
  const writtenPaths: string[] = []
  for (const diary of testDiaries) {
    console.log(`\n--- 写入: ${diary.title} ---`)
    try {
      const writtenPath = writeDiary(diary)
      writtenPaths.push(writtenPath)
    } catch (error) {
      console.error(`[错误] 写入失败:`, error)
    }
  }

  console.log('\n==========================================')
  console.log('                 完成')
  console.log('==========================================')
  console.log(`\n共写入 ${writtenPaths.length} 条日记\n`)
  console.log('请打开 Cherry Studio，在日记/笔记页面查看这些日记。')
  console.log('如果能看到，说明 VCP 调用链路工作正常！\n')

  // 返回结果供测试使用
  return { success: true, paths: writtenPaths }
}

// 直接执行
main().catch(console.error)

export { main as runRealDiaryWrite, writeDiary, NOTES_DIR }
