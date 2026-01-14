/**
 * Agentic Tool Calling - VCP 原生工具调用
 *
 * 使用项目已有的 VCP 协议基础设施：
 * - VCPProtocolParser 解析 VCP 格式
 * - VCPToolBridge 执行工具
 * - VCP_MARKERS 定义协议标记
 *
 * VCP 协议格式：
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」工具名称「末」
 * param1:「始」参数值「末」
 * <<<[END_TOOL_REQUEST]>>>
 */

import { loggerService } from '@logger'
import { vcpProtocolParser } from '@renderer/aiCore/legacy/clients/vcp/VCPProtocolParser'
import { VCP_MARKERS, type VCPToolRequest } from '@renderer/aiCore/legacy/clients/vcp/types'
import { VCPToolBridge, type ToolResult } from '@renderer/pages/workflow/agents/collaboration/MultiModelCodeCrew/bridge/VCPToolBridge'

const logger = loggerService.withContext('AgenticToolCalling')

// ==================== 类型定义 ====================

/** 工具调用结果 */
export interface ToolCallResult {
  toolName: string
  result: ToolResult
  formattedOutput: string
}

/** 对话消息（用于 agentic loop） */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolRequest?: VCPToolRequest
}

/** Agentic Loop 选项 */
export interface AgentLoopOptions {
  /** 最大工具调用轮数 */
  maxIterations?: number
  /** 是否启用工具调用 */
  enableTools?: boolean
  /** 工作目录 */
  workingDirectory?: string
  /** 当前文件路径 */
  currentFilePath?: string
  /** 流式输出回调 */
  onStream?: (chunk: string) => void
  /** 工具调用回调 */
  onToolCall?: (request: VCPToolRequest) => void
  /** 工具结果回调 */
  onToolResult?: (result: ToolCallResult) => void
}

// ==================== VCP 工具 Schema 定义 ====================

/**
 * 获取工具定义的系统提示词（VCP 格式）
 */
export function getToolsSystemPrompt(workingDirectory?: string): string {
  const cwd = workingDirectory || 'unknown'
  const { TOOL_REQUEST_START, TOOL_REQUEST_END, PARAM_START, PARAM_END } = VCP_MARKERS

  return `
## 可用工具

你可以使用以下工具来完成任务。当需要使用工具时，请使用 VCP 协议格式调用：

\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}工具名称${PARAM_END}
参数名:${PARAM_START}参数值${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### read_file
读取文件内容。
参数:
- path (必需): 文件的绝对路径或相对于工作目录的路径

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}read_file${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### list_directory
列出目录内容。
参数:
- path (必需): 目录路径

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}list_directory${PARAM_END}
path:${PARAM_START}src/components${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### search_files
搜索匹配模式的文件。
参数:
- pattern (必需): Glob 模式，如 "**/*.tsx"
- path (可选): 搜索的基础目录

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}search_files${PARAM_END}
pattern:${PARAM_START}**/*.tsx${PARAM_END}
path:${PARAM_START}src${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### grep_search
在文件内容中搜索匹配的文本。
参数:
- pattern (必需): 搜索的正则表达式模式
- path (可选): 搜索目录，默认为工作目录
- include (可选): 文件包含模式，如 "*.ts"

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}grep_search${PARAM_END}
pattern:${PARAM_START}function handleSubmit${PARAM_END}
path:${PARAM_START}src${PARAM_END}
include:${PARAM_START}*.tsx${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### write_file
写入文件内容（创建或覆盖）。
参数:
- path (必需): 文件路径
- content (必需): 要写入的内容

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}write_file${PARAM_END}
path:${PARAM_START}src/utils/helper.ts${PARAM_END}
content:${PARAM_START}export function helper() { return 'hello'; }${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### edit_file
编辑文件的特定部分（查找并替换）。
参数:
- path (必需): 文件路径
- old_text (必需): 要替换的原始文本（必须精确匹配）
- new_text (必需): 替换后的新文本

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}edit_file${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
old_text:${PARAM_START}const Button = () => {
  return <button>Click</button>
}${PARAM_END}
new_text:${PARAM_START}const Button = ({ label }: { label: string }) => {
  return <button>{label}</button>
}${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### insert_code
在文件的特定位置插入代码。
参数:
- path (必需): 文件路径
- position (必需): 插入位置 - "start" | "end" | "after:搜索文本" | "before:搜索文本" | "line:行号"
- content (必需): 要插入的代码

示例（在文件开头插入 import）:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}insert_code${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
position:${PARAM_START}start${PARAM_END}
content:${PARAM_START}import { useState } from 'react'${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

示例（在特定代码后插入）:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}insert_code${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
position:${PARAM_START}after:import React from 'react'${PARAM_END}
content:${PARAM_START}
import { useState } from 'react'${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### execute_command
执行 Shell 命令。
参数:
- command (必需): 要执行的命令
- cwd (可选): 工作目录

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}execute_command${PARAM_END}
command:${PARAM_START}npm run build${PARAM_END}
cwd:${PARAM_START}${cwd}${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### run_code
运行代码片段（支持 JavaScript/TypeScript/Python）。
参数:
- language (必需): 编程语言 - "javascript" | "typescript" | "python"
- code (必需): 要运行的代码

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}run_code${PARAM_END}
language:${PARAM_START}javascript${PARAM_END}
code:${PARAM_START}console.log('Hello, World!');
const result = 1 + 2;
console.log('Result:', result);${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### create_file
创建新文件（自动创建父目录）。
参数:
- path (必需): 文件路径
- content (必需): 文件内容
- overwrite (可选): 是否覆盖已存在的文件，默认 false

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}create_file${PARAM_END}
path:${PARAM_START}src/utils/newHelper.ts${PARAM_END}
content:${PARAM_START}export function newHelper() {
  return 'Hello!'
}${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### delete_file
删除文件或目录。
参数:
- path (必需): 文件或目录路径
- recursive (可选): 递归删除目录，默认 false

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}delete_file${PARAM_END}
path:${PARAM_START}src/old/deprecated.ts${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### move_file
移动或重命名文件/目录。
参数:
- source (必需): 源路径
- destination (必需): 目标路径

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}move_file${PARAM_END}
source:${PARAM_START}src/utils/old.ts${PARAM_END}
destination:${PARAM_START}src/utils/new.ts${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### multi_edit
批量编辑多个文件。
参数:
- edits (必需): JSON 格式的编辑数组，每项包含 path, old_text, new_text

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}multi_edit${PARAM_END}
edits:${PARAM_START}[
  {"path": "src/a.ts", "old_text": "const a = 1", "new_text": "const a = 2"},
  {"path": "src/b.ts", "old_text": "const b = 1", "new_text": "const b = 2"}
]${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_status
获取 Git 仓库状态。
参数: 无

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_status${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_diff
获取 Git 差异。
参数:
- path (可选): 特定文件路径，不指定则显示所有差异
- staged (可选): 是否显示暂存区差异，默认 false

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_diff${PARAM_END}
staged:${PARAM_START}true${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_add
暂存文件到 Git。
参数:
- path (可选): 文件路径，不指定则暂存所有更改
- all (可选): 暂存所有更改，默认 false

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_add${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_commit
提交暂存的更改。
参数:
- message (必需): 提交信息

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_commit${PARAM_END}
message:${PARAM_START}feat: add new Button component${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_log
获取 Git 提交历史。
参数:
- count (可选): 显示的提交数量，默认 10
- oneline (可选): 单行格式显示，默认 true

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_log${PARAM_END}
count:${PARAM_START}20${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_branch
列出或切换分支。
参数:
- list (可选): 列出所有分支，默认 true
- switch (可选): 切换到指定分支
- create (可选): 创建新分支

示例（列出分支）:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_branch${PARAM_END}
list:${PARAM_START}true${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

示例（切换分支）:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_branch${PARAM_END}
switch:${PARAM_START}feature/new-ui${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

### git_reset
重置 Git 更改。
参数:
- path (可选): 特定文件路径
- hard (可选): 硬重置（丢弃所有更改），默认 false
- soft (可选): 软重置（保留更改在暂存区），默认 false

示例:
\`\`\`
${TOOL_REQUEST_START}
tool_name:${PARAM_START}git_reset${PARAM_END}
path:${PARAM_START}src/components/Button.tsx${PARAM_END}
${TOOL_REQUEST_END}
\`\`\`

## 工作目录
当前工作目录: ${cwd}

## 使用指南
1. 当用户询问代码相关问题时，主动使用 read_file 或 search_files 来查看相关代码
2. 在修改代码前，先阅读相关文件了解上下文
3. 使用 list_directory 了解项目结构
4. 使用 grep_search 搜索特定代码模式
5. 使用 edit_file 进行精确的代码修改（推荐）
6. 使用 insert_code 在特定位置添加代码
7. 使用 run_code 运行和测试代码片段
8. 可以连续调用多个工具来完成复杂任务
9. 每次工具调用后，会返回结果，你可以根据结果继续操作

## 重要
- 当需要查看代码时，直接调用工具，不要猜测
- 优先使用相对路径
- 编辑代码时，优先使用 edit_file 进行精确修改
- 工具调用后会返回结果，请根据结果回复用户
`
}

// ==================== 工具调用解析（使用 VCPProtocolParser） ====================

/**
 * 从 LLM 响应中解析工具调用
 */
export function parseToolCalls(response: string): VCPToolRequest[] {
  return vcpProtocolParser.parseToolRequests(response)
}

/**
 * 从响应中移除工具调用块，保留其他文本
 */
export function removeToolCallBlocks(response: string): string {
  return vcpProtocolParser.removeToolRequestBlocks(response)
}

/**
 * 检查响应是否包含工具调用
 */
export function hasToolCalls(response: string): boolean {
  return vcpProtocolParser.hasToolRequests(response)
}

// ==================== 工具执行 ====================

/**
 * 执行单个工具调用
 */
export async function executeToolCall(
  request: VCPToolRequest,
  workingDirectory?: string
): Promise<ToolCallResult> {
  const startTime = Date.now()
  const toolName = request.toolName
  logger.info('Executing tool call:', { name: toolName, params: request.params })

  // 处理路径参数，添加工作目录前缀
  const params: Record<string, unknown> = { ...request.params }
  if (workingDirectory && params.path && typeof params.path === 'string') {
    // 如果是相对路径，添加工作目录前缀
    if (!params.path.startsWith('/') && !params.path.match(/^[A-Za-z]:/)) {
      params.path = `${workingDirectory}/${params.path}`
    }
  }

  // 根据工具类型执行不同的处理
  let result: ToolResult

  switch (toolName) {
    case 'grep_search':
      result = await executeGrepSearch(params, workingDirectory)
      break

    case 'edit_file':
      result = await executeEditFile(params, workingDirectory)
      break

    case 'insert_code':
      result = await executeInsertCode(params, workingDirectory)
      break

    case 'run_code':
      result = await executeRunCode(params, workingDirectory)
      break

    // 文件管理工具
    case 'create_file':
      result = await executeCreateFile(params, workingDirectory)
      break

    case 'delete_file':
      result = await executeDeleteFile(params, workingDirectory)
      break

    case 'move_file':
      result = await executeMoveFile(params, workingDirectory)
      break

    case 'multi_edit':
      result = await executeMultiEdit(params, workingDirectory)
      break

    // Git 工具
    case 'git_status':
      result = await executeGitStatus(params, workingDirectory)
      break

    case 'git_diff':
      result = await executeGitDiff(params, workingDirectory)
      break

    case 'git_add':
      result = await executeGitAdd(params, workingDirectory)
      break

    case 'git_commit':
      result = await executeGitCommit(params, workingDirectory)
      break

    case 'git_log':
      result = await executeGitLog(params, workingDirectory)
      break

    case 'git_branch':
      result = await executeGitBranch(params, workingDirectory)
      break

    case 'git_reset':
      result = await executeGitReset(params, workingDirectory)
      break

    default:
      result = await VCPToolBridge.executeTool(toolName, params)
  }

  const duration = Date.now() - startTime
  logger.info('Tool call result:', { name: toolName, success: result.success, duration })

  // 格式化输出
  const formattedOutput = formatToolOutput(toolName, result)

  return {
    toolName,
    result,
    formattedOutput
  }
}

/**
 * 执行 grep 搜索
 */
async function executeGrepSearch(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const pattern = params.pattern as string
  const searchPath = (params.path as string) || workingDirectory || '.'
  const include = params.include as string | undefined

  try {
    // 使用 VCPToolBridge 的 execute_command 来运行 grep
    // 在 Windows 上使用 findstr，在 Unix 上使用 grep
    const isWindows = navigator.platform.toLowerCase().includes('win')

    let command: string
    if (isWindows) {
      // Windows: findstr /S /N /R pattern *.ext
      const filePattern = include || '*.*'
      command = `findstr /S /N /R "${pattern}" ${searchPath}\\${filePattern}`
    } else {
      // Unix: grep -rn pattern path --include=pattern
      command = `grep -rn "${pattern}" "${searchPath}"`
      if (include) {
        command += ` --include="${include}"`
      }
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    return result
  } catch (error) {
    return {
      success: false,
      error: `Grep search failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 执行文件编辑（查找并替换）
 */
async function executeEditFile(
  params: Record<string, unknown>,
  _workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string
  const oldText = params.old_text as string || params.oldtext as string
  const newText = params.new_text as string || params.newtext as string

  if (!filePath || oldText === undefined || newText === undefined) {
    return {
      success: false,
      error: 'Missing required parameters: path, old_text, new_text'
    }
  }

  try {
    // 先读取文件内容
    const readResult = await VCPToolBridge.executeTool('read_file', { path: filePath })
    if (!readResult.success) {
      return {
        success: false,
        error: `Cannot read file: ${readResult.error}`
      }
    }

    const content = readResult.output || ''

    // 检查是否包含要替换的文本
    if (!content.includes(oldText)) {
      return {
        success: false,
        error: 'old_text not found in file. Please ensure the text matches exactly (including whitespace and indentation).'
      }
    }

    // 执行替换
    const newContent = content.replace(oldText, newText)

    // 写回文件
    const writeResult = await VCPToolBridge.executeTool('write_file', {
      path: filePath,
      content: newContent
    })

    if (!writeResult.success) {
      return {
        success: false,
        error: `Cannot write file: ${writeResult.error}`
      }
    }

    return {
      success: true,
      output: `File edited successfully. Replaced ${oldText.split('\n').length} lines with ${newText.split('\n').length} lines.`,
      data: { path: filePath, linesChanged: newText.split('\n').length }
    }
  } catch (error) {
    return {
      success: false,
      error: `Edit failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 执行代码插入
 */
async function executeInsertCode(
  params: Record<string, unknown>,
  _workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string
  const position = params.position as string
  const insertContent = params.content as string

  if (!filePath || !position || insertContent === undefined) {
    return {
      success: false,
      error: 'Missing required parameters: path, position, content'
    }
  }

  try {
    // 先读取文件内容
    const readResult = await VCPToolBridge.executeTool('read_file', { path: filePath })
    if (!readResult.success) {
      return {
        success: false,
        error: `Cannot read file: ${readResult.error}`
      }
    }

    let content = readResult.output || ''
    let newContent: string

    if (position === 'start') {
      // 在文件开头插入
      newContent = insertContent + '\n' + content
    } else if (position === 'end') {
      // 在文件末尾插入
      newContent = content + '\n' + insertContent
    } else if (position.startsWith('after:')) {
      // 在特定文本后插入
      const searchText = position.substring(6)
      const index = content.indexOf(searchText)
      if (index === -1) {
        return {
          success: false,
          error: `Search text not found: "${searchText}"`
        }
      }
      const insertIndex = index + searchText.length
      newContent = content.slice(0, insertIndex) + '\n' + insertContent + content.slice(insertIndex)
    } else if (position.startsWith('before:')) {
      // 在特定文本前插入
      const searchText = position.substring(7)
      const index = content.indexOf(searchText)
      if (index === -1) {
        return {
          success: false,
          error: `Search text not found: "${searchText}"`
        }
      }
      newContent = content.slice(0, index) + insertContent + '\n' + content.slice(index)
    } else if (position.startsWith('line:')) {
      // 在特定行插入
      const lineNum = parseInt(position.substring(5), 10)
      if (isNaN(lineNum) || lineNum < 1) {
        return {
          success: false,
          error: `Invalid line number: ${position.substring(5)}`
        }
      }
      const lines = content.split('\n')
      lines.splice(lineNum - 1, 0, insertContent)
      newContent = lines.join('\n')
    } else {
      return {
        success: false,
        error: `Invalid position format. Use: start, end, after:text, before:text, or line:number`
      }
    }

    // 写回文件
    const writeResult = await VCPToolBridge.executeTool('write_file', {
      path: filePath,
      content: newContent
    })

    if (!writeResult.success) {
      return {
        success: false,
        error: `Cannot write file: ${writeResult.error}`
      }
    }

    return {
      success: true,
      output: `Code inserted successfully at position: ${position}`,
      data: { path: filePath, position, linesInserted: insertContent.split('\n').length }
    }
  } catch (error) {
    return {
      success: false,
      error: `Insert failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 执行代码运行
 */
async function executeRunCode(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const language = (params.language as string)?.toLowerCase()
  const code = params.code as string

  if (!language || !code) {
    return {
      success: false,
      error: 'Missing required parameters: language, code'
    }
  }

  try {
    let command: string
    const isWindows = navigator.platform.toLowerCase().includes('win')

    switch (language) {
      case 'javascript':
      case 'js':
        // 使用 node -e 执行 JavaScript
        // 转义代码中的引号
        const jsCode = code.replace(/"/g, '\\"').replace(/\n/g, '\\n')
        command = `node -e "${jsCode}"`
        break

      case 'typescript':
      case 'ts':
        // 使用 npx ts-node -e 执行 TypeScript
        const tsCode = code.replace(/"/g, '\\"').replace(/\n/g, '\\n')
        command = `npx ts-node -e "${tsCode}"`
        break

      case 'python':
      case 'py':
        // 使用 python -c 执行 Python
        const pyCode = code.replace(/"/g, '\\"').replace(/\n/g, '\\n')
        if (isWindows) {
          command = `python -c "${pyCode}"`
        } else {
          command = `python3 -c "${pyCode}"`
        }
        break

      default:
        return {
          success: false,
          error: `Unsupported language: ${language}. Supported: javascript, typescript, python`
        }
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    return result
  } catch (error) {
    return {
      success: false,
      error: `Code execution failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// ==================== 文件管理工具 ====================

/**
 * 创建新文件（自动创建父目录）
 */
async function executeCreateFile(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string
  const content = params.content as string
  const overwrite = params.overwrite as boolean || false

  if (!filePath || content === undefined) {
    return {
      success: false,
      error: 'Missing required parameters: path, content'
    }
  }

  try {
    // 检查文件是否已存在
    if (!overwrite) {
      const readResult = await VCPToolBridge.executeTool('read_file', { path: filePath })
      if (readResult.success) {
        return {
          success: false,
          error: `File already exists: ${filePath}. Use overwrite=true to replace it.`
        }
      }
    }

    // 创建父目录（通过 execute_command）
    const isWindows = navigator.platform.toLowerCase().includes('win')
    const pathSeparator = isWindows ? '\\' : '/'
    const dirPath = filePath.split(pathSeparator).slice(0, -1).join(pathSeparator)

    if (dirPath) {
      const mkdirCommand = isWindows
        ? `if not exist "${dirPath}" mkdir "${dirPath}"`
        : `mkdir -p "${dirPath}"`

      await VCPToolBridge.executeTool('execute_command', {
        command: mkdirCommand,
        cwd: workingDirectory
      })
    }

    // 写入文件
    const writeResult = await VCPToolBridge.executeTool('write_file', {
      path: filePath,
      content
    })

    if (!writeResult.success) {
      return {
        success: false,
        error: `Cannot create file: ${writeResult.error}`
      }
    }

    return {
      success: true,
      output: `File created successfully: ${filePath}`,
      data: { path: filePath, size: content.length }
    }
  } catch (error) {
    return {
      success: false,
      error: `Create file failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 删除文件或目录
 */
async function executeDeleteFile(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string
  const recursive = params.recursive as boolean || false

  if (!filePath) {
    return {
      success: false,
      error: 'Missing required parameter: path'
    }
  }

  try {
    const isWindows = navigator.platform.toLowerCase().includes('win')
    let command: string

    if (recursive) {
      command = isWindows
        ? `rmdir /S /Q "${filePath}"`
        : `rm -rf "${filePath}"`
    } else {
      command = isWindows
        ? `del /F /Q "${filePath}"`
        : `rm -f "${filePath}"`
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Cannot delete: ${result.error}`
      }
    }

    return {
      success: true,
      output: `Deleted successfully: ${filePath}`,
      data: { path: filePath, recursive }
    }
  } catch (error) {
    return {
      success: false,
      error: `Delete failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 移动或重命名文件
 */
async function executeMoveFile(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const source = params.source as string
  const destination = params.destination as string

  if (!source || !destination) {
    return {
      success: false,
      error: 'Missing required parameters: source, destination'
    }
  }

  try {
    const isWindows = navigator.platform.toLowerCase().includes('win')
    const command = isWindows
      ? `move /Y "${source}" "${destination}"`
      : `mv "${source}" "${destination}"`

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Cannot move file: ${result.error}`
      }
    }

    return {
      success: true,
      output: `Moved successfully: ${source} -> ${destination}`,
      data: { source, destination }
    }
  } catch (error) {
    return {
      success: false,
      error: `Move failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 批量编辑多个文件
 */
async function executeMultiEdit(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const editsStr = params.edits as string
  let edits: Array<{ path: string; old_text: string; new_text: string }>

  try {
    edits = typeof editsStr === 'string' ? JSON.parse(editsStr) : editsStr as any
  } catch {
    return {
      success: false,
      error: 'Invalid edits format. Expected JSON array of {path, old_text, new_text}'
    }
  }

  if (!Array.isArray(edits) || edits.length === 0) {
    return {
      success: false,
      error: 'edits must be a non-empty array'
    }
  }

  const results: Array<{ path: string; success: boolean; error?: string }> = []

  for (const edit of edits) {
    const editResult = await executeEditFile(
      {
        path: edit.path,
        old_text: edit.old_text,
        new_text: edit.new_text
      },
      workingDirectory
    )

    results.push({
      path: edit.path,
      success: editResult.success,
      error: editResult.error
    })
  }

  const successCount = results.filter((r) => r.success).length
  const failedResults = results.filter((r) => !r.success)

  if (failedResults.length > 0) {
    return {
      success: successCount > 0,
      output: `Edited ${successCount}/${edits.length} files. Failures:\n${failedResults.map((r) => `- ${r.path}: ${r.error}`).join('\n')}`,
      data: { results }
    }
  }

  return {
    success: true,
    output: `Successfully edited ${successCount} files`,
    data: { results }
  }
}

// ==================== Git 工具 ====================

/**
 * 获取 Git 状态
 */
async function executeGitStatus(
  _params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  try {
    const result = await VCPToolBridge.executeTool('execute_command', {
      command: 'git status',
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git status failed: ${result.error}`
      }
    }

    return {
      success: true,
      output: result.output || '',
      data: { raw: result.output }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git status failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 获取 Git 差异
 */
async function executeGitDiff(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string | undefined
  const staged = params.staged as boolean || false

  try {
    let command = 'git diff'
    if (staged) {
      command += ' --staged'
    }
    if (filePath) {
      command += ` "${filePath}"`
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git diff failed: ${result.error}`
      }
    }

    const output = result.output || ''
    if (!output.trim()) {
      return {
        success: true,
        output: staged ? 'No staged changes' : 'No unstaged changes',
        data: { diff: '' }
      }
    }

    return {
      success: true,
      output: output,
      data: { diff: output }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git diff failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 暂存文件
 */
async function executeGitAdd(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string | undefined
  const all = params.all as boolean || false

  try {
    let command = 'git add'
    if (all || !filePath) {
      command += ' -A'
    } else {
      command += ` "${filePath}"`
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git add failed: ${result.error}`
      }
    }

    return {
      success: true,
      output: filePath ? `Staged: ${filePath}` : 'Staged all changes',
      data: { path: filePath || 'all' }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git add failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Git 提交
 */
async function executeGitCommit(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const message = params.message as string

  if (!message) {
    return {
      success: false,
      error: 'Missing required parameter: message'
    }
  }

  try {
    // 转义消息中的引号
    const escapedMessage = message.replace(/"/g, '\\"')
    const command = `git commit -m "${escapedMessage}"`

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git commit failed: ${result.error}`
      }
    }

    return {
      success: true,
      output: result.output || `Committed with message: ${message}`,
      data: { message }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git commit failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Git 日志
 */
async function executeGitLog(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const count = (params.count as number) || 10
  const oneline = params.oneline !== false

  try {
    let command = `git log -${count}`
    if (oneline) {
      command += ' --oneline'
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git log failed: ${result.error}`
      }
    }

    return {
      success: true,
      output: result.output || 'No commits',
      data: { count }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git log failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Git 分支操作
 */
async function executeGitBranch(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const list = params.list as boolean || true
  const switchBranch = params.switch as string | undefined
  const createBranch = params.create as string | undefined

  try {
    let command = 'git branch'

    if (createBranch) {
      command = `git checkout -b "${createBranch}"`
    } else if (switchBranch) {
      command = `git checkout "${switchBranch}"`
    } else if (list) {
      command = 'git branch -a'
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git branch failed: ${result.error}`
      }
    }

    let output = result.output || ''
    if (createBranch) {
      output = `Created and switched to branch: ${createBranch}`
    } else if (switchBranch) {
      output = `Switched to branch: ${switchBranch}`
    }

    return {
      success: true,
      output,
      data: { created: createBranch, switched: switchBranch }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git branch failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Git 重置
 */
async function executeGitReset(
  params: Record<string, unknown>,
  workingDirectory?: string
): Promise<ToolResult> {
  const filePath = params.path as string | undefined
  const hard = params.hard as boolean || false
  const soft = params.soft as boolean || false

  try {
    let command = 'git reset'

    if (hard) {
      command += ' --hard'
    } else if (soft) {
      command += ' --soft'
    }

    if (filePath) {
      command += ` "${filePath}"`
    }

    const result = await VCPToolBridge.executeTool('execute_command', {
      command,
      cwd: workingDirectory
    })

    if (!result.success) {
      return {
        success: false,
        error: `Git reset failed: ${result.error}`
      }
    }

    return {
      success: true,
      output: result.output || `Reset completed${filePath ? ` for ${filePath}` : ''}`,
      data: { path: filePath, hard, soft }
    }
  } catch (error) {
    return {
      success: false,
      error: `Git reset failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 格式化工具输出
 */
function formatToolOutput(toolName: string, result: ToolResult): string {
  if (!result.success) {
    return `Error: ${result.error}`
  }

  const output = result.output || ''

  switch (toolName) {
    case 'read_file':
      // 限制输出长度
      if (output.length > 5000) {
        const lines = output.split('\n')
        return `File content (${lines.length} lines, showing first 100):\n${lines.slice(0, 100).join('\n')}\n... (truncated)`
      }
      return `File content:\n${output}`

    case 'list_directory':
      return `Directory listing:\n${output}`

    case 'search_files':
      return `Found files:\n${output}`

    case 'grep_search':
      if (output.length > 3000) {
        const lines = output.split('\n')
        return `Search results (${lines.length} matches, showing first 50):\n${lines.slice(0, 50).join('\n')}\n... (truncated)`
      }
      return `Search results:\n${output}`

    case 'write_file':
      return `File written successfully: ${(result.data as any)?.path || 'unknown'}`

    case 'edit_file':
      return output || `File edited successfully`

    case 'insert_code':
      return output || `Code inserted successfully`

    case 'run_code':
      return `Code execution output:\n${output}`

    case 'execute_command':
      return `Command output:\n${output}`

    // 文件管理工具
    case 'create_file':
      return output || `File created successfully`

    case 'delete_file':
      return output || `File deleted successfully`

    case 'move_file':
      return output || `File moved successfully`

    case 'multi_edit':
      return output || `Multiple files edited`

    // Git 工具
    case 'git_status':
      return `Git status:\n${output}`

    case 'git_diff':
      if (output.length > 5000) {
        const lines = output.split('\n')
        return `Git diff (${lines.length} lines, showing first 100):\n${lines.slice(0, 100).join('\n')}\n... (truncated)`
      }
      return `Git diff:\n${output}`

    case 'git_add':
      return output || `Files staged successfully`

    case 'git_commit':
      return output || `Commit created successfully`

    case 'git_log':
      return `Git log:\n${output}`

    case 'git_branch':
      return output || `Branch operation completed`

    case 'git_reset':
      return output || `Git reset completed`

    default:
      return output
  }
}

/**
 * 格式化工具结果为 VCP 格式
 */
export function formatVCPToolResult(toolName: string, result: ToolResult): string {
  return vcpProtocolParser.formatToolResult(toolName, result.output || result.data, result.success)
}

// ==================== Agentic Loop ====================

/**
 * 执行 Agentic Loop
 *
 * 递归调用工具直到 AI 不再请求工具调用
 */
export async function runAgenticLoop(
  generateFn: (messages: AgentMessage[]) => Promise<string>,
  initialMessages: AgentMessage[],
  options: AgentLoopOptions = {}
): Promise<{ finalResponse: string; messages: AgentMessage[]; toolCallCount: number }> {
  const {
    maxIterations = 10,
    enableTools = true,
    workingDirectory,
    onStream,
    onToolCall,
    onToolResult
  } = options

  let messages = [...initialMessages]
  let iteration = 0
  let toolCallCount = 0
  let finalResponse = ''

  while (iteration < maxIterations) {
    iteration++
    logger.debug(`Agentic loop iteration ${iteration}`)

    // 调用 LLM
    const response = await generateFn(messages)

    // 流式输出非工具调用部分
    const textContent = removeToolCallBlocks(response)
    if (textContent && onStream) {
      onStream(textContent)
    }

    // 检查是否有工具调用
    if (!enableTools || !hasToolCalls(response)) {
      // 没有工具调用，结束循环
      finalResponse = textContent || response
      messages.push({
        role: 'assistant',
        content: response
      })
      break
    }

    // 解析工具调用
    const toolRequests = parseToolCalls(response)

    if (toolRequests.length === 0) {
      // 解析失败，结束循环
      finalResponse = textContent || response
      messages.push({
        role: 'assistant',
        content: response
      })
      break
    }

    // 添加助手消息
    messages.push({
      role: 'assistant',
      content: response
    })

    // 执行工具调用
    for (const request of toolRequests) {
      toolCallCount++

      // 回调
      if (onToolCall) {
        onToolCall(request)
      }

      // 执行工具
      const result = await executeToolCall(request, workingDirectory)

      // 回调
      if (onToolResult) {
        onToolResult(result)
      }

      // 添加工具结果消息（使用 VCP 格式）
      const vcpResult = formatVCPToolResult(request.toolName, result.result)
      messages.push({
        role: 'tool',
        content: vcpResult,
        toolRequest: request
      })
    }
  }

  if (iteration >= maxIterations) {
    logger.warn('Agentic loop reached max iterations')
    finalResponse = finalResponse || '已达到最大工具调用次数限制。'
  }

  return {
    finalResponse,
    messages,
    toolCallCount
  }
}

/**
 * 构建带工具的系统提示词
 */
export function buildSystemPromptWithTools(
  basePrompt: string,
  options: {
    workingDirectory?: string
    currentFilePath?: string
    enableTools?: boolean
  } = {}
): string {
  const { workingDirectory, currentFilePath, enableTools = true } = options

  let prompt = basePrompt

  if (enableTools) {
    prompt += '\n\n' + getToolsSystemPrompt(workingDirectory)
  }

  if (currentFilePath) {
    prompt += `\n\n## 当前文件\n当前用户打开的文件: ${currentFilePath}`
  }

  return prompt
}

/**
 * 将 AgentMessage 转换为简单的消息格式（用于 API 调用）
 */
export function convertMessagesToSimpleFormat(
  messages: AgentMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      // 系统消息作为第一条用户消息的前缀
      continue
    }

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content })
    } else if (msg.role === 'tool') {
      // 工具结果作为用户消息添加
      const toolName = msg.toolRequest?.toolName || 'unknown'
      result.push({
        role: 'user',
        content: `[Tool Result: ${toolName}]\n${msg.content}`
      })
    }
  }

  return result
}

// Re-export VCPToolRequest for convenience
export type { VCPToolRequest }

export default {
  getToolsSystemPrompt,
  parseToolCalls,
  removeToolCallBlocks,
  hasToolCalls,
  executeToolCall,
  formatVCPToolResult,
  runAgenticLoop,
  buildSystemPromptWithTools,
  convertMessagesToSimpleFormat
}
