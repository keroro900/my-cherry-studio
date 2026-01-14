/**
 * QuickCommandResolver - @ 快捷指令解析服务
 *
 * 将 @ 指令解析为实际内容
 */

import { loggerService } from '@logger'
import { VCPToolBridge } from '@renderer/pages/workflow/agents/collaboration/MultiModelCodeCrew/bridge/VCPToolBridge'

const logger = loggerService.withContext('QuickCommandResolver')

// ==================== 类型定义 ====================

export interface ResolvedCommand {
  command: string
  parameter?: string
  content: string
  success: boolean
  error?: string
}

export interface ResolveContext {
  workingDirectory?: string
  currentFilePath?: string
  currentSelection?: string
  terminalOutput?: string
  lastError?: string
}

// ==================== 指令解析器 ====================

/**
 * 解析文本中的所有 @ 指令并返回解析后的上下文
 */
export async function resolveQuickCommands(
  text: string,
  context: ResolveContext
): Promise<{ resolvedText: string; contextAdditions: string[] }> {
  const contextAdditions: string[] = []
  let resolvedText = text

  // 匹配所有 @command 或 @command parameter 格式
  const regex = /@(\w+)(?:\s+([^\s@]+))?/g
  const matches: Array<{ full: string; cmd: string; param?: string }> = []

  let match
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      full: match[0],
      cmd: match[1],
      param: match[2]
    })
  }

  // 并行解析所有指令
  const resolvedPromises = matches.map((m) => resolveCommand(m.cmd, m.param, context))
  const resolved = await Promise.all(resolvedPromises)

  // 收集解析结果
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const result = resolved[i]

    if (result.success && result.content) {
      // 将指令内容添加到上下文
      contextAdditions.push(result.content)
      // 从原文本中移除指令（保留描述性标记）
      resolvedText = resolvedText.replace(m.full, `[${m.cmd}${m.param ? `:${m.param}` : ''}]`)
    }
  }

  return { resolvedText, contextAdditions }
}

/**
 * 解析单个指令
 */
async function resolveCommand(
  command: string,
  parameter: string | undefined,
  context: ResolveContext
): Promise<ResolvedCommand> {
  const baseResult = {
    command: `@${command}`,
    parameter
  }

  try {
    switch (command.toLowerCase()) {
      case 'file':
        return await resolveFileCommand(parameter, context)

      case 'folder':
        return await resolveFolderCommand(parameter, context)

      case 'git':
        return await resolveGitCommand(context)

      case 'selection':
        return resolveSelectionCommand(context)

      case 'terminal':
        return resolveTerminalCommand(context)

      case 'error':
        return resolveErrorCommand(context)

      case 'code':
        return resolveCodeCommand(parameter)

      default:
        return {
          ...baseResult,
          content: '',
          success: false,
          error: `Unknown command: @${command}`
        }
    }
  } catch (error) {
    logger.error('Failed to resolve command', { command, parameter, error })
    return {
      ...baseResult,
      content: '',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 解析 @file 指令
 */
async function resolveFileCommand(
  parameter: string | undefined,
  context: ResolveContext
): Promise<ResolvedCommand> {
  if (!parameter) {
    return {
      command: '@file',
      content: '',
      success: false,
      error: 'Missing file path parameter'
    }
  }

  // 构建完整路径
  let filePath = parameter
  if (context.workingDirectory && !parameter.startsWith('/') && !parameter.match(/^[A-Za-z]:/)) {
    filePath = `${context.workingDirectory}/${parameter}`
  }

  const result = await VCPToolBridge.executeTool('read_file', { path: filePath })

  if (!result.success) {
    return {
      command: '@file',
      parameter,
      content: '',
      success: false,
      error: result.error || 'Failed to read file'
    }
  }

  const content = result.output || ''
  const language = detectLanguage(parameter)

  return {
    command: '@file',
    parameter,
    content: `## 文件: ${parameter}\n\`\`\`${language}\n${content}\n\`\`\``,
    success: true
  }
}

/**
 * 解析 @folder 指令
 */
async function resolveFolderCommand(
  parameter: string | undefined,
  context: ResolveContext
): Promise<ResolvedCommand> {
  const folderPath = parameter || context.workingDirectory || '.'

  // 构建完整路径
  let fullPath = folderPath
  if (context.workingDirectory && !folderPath.startsWith('/') && !folderPath.match(/^[A-Za-z]:/)) {
    fullPath = `${context.workingDirectory}/${folderPath}`
  }

  const result = await VCPToolBridge.executeTool('list_directory', { path: fullPath })

  if (!result.success) {
    return {
      command: '@folder',
      parameter,
      content: '',
      success: false,
      error: result.error || 'Failed to list directory'
    }
  }

  return {
    command: '@folder',
    parameter,
    content: `## 目录结构: ${folderPath}\n\`\`\`\n${result.output}\n\`\`\``,
    success: true
  }
}

/**
 * 解析 @git 指令
 */
async function resolveGitCommand(context: ResolveContext): Promise<ResolvedCommand> {
  const results: string[] = []

  // 获取 Git 状态
  const statusResult = await VCPToolBridge.executeTool('execute_command', {
    command: 'git status --short',
    cwd: context.workingDirectory
  })

  if (statusResult.success && statusResult.output) {
    results.push(`### Git 状态\n\`\`\`\n${statusResult.output}\n\`\`\``)
  }

  // 获取当前分支
  const branchResult = await VCPToolBridge.executeTool('execute_command', {
    command: 'git branch --show-current',
    cwd: context.workingDirectory
  })

  if (branchResult.success && branchResult.output) {
    results.push(`**当前分支:** ${branchResult.output.trim()}`)
  }

  // 获取最近提交
  const logResult = await VCPToolBridge.executeTool('execute_command', {
    command: 'git log -3 --oneline',
    cwd: context.workingDirectory
  })

  if (logResult.success && logResult.output) {
    results.push(`### 最近提交\n\`\`\`\n${logResult.output}\n\`\`\``)
  }

  if (results.length === 0) {
    return {
      command: '@git',
      content: '',
      success: false,
      error: 'Failed to get Git information (not a Git repository?)'
    }
  }

  return {
    command: '@git',
    content: `## Git 上下文\n${results.join('\n\n')}`,
    success: true
  }
}

/**
 * 解析 @selection 指令
 */
function resolveSelectionCommand(context: ResolveContext): ResolvedCommand {
  if (!context.currentSelection) {
    return {
      command: '@selection',
      content: '',
      success: false,
      error: 'No code is currently selected'
    }
  }

  const language = context.currentFilePath ? detectLanguage(context.currentFilePath) : ''

  return {
    command: '@selection',
    content: `## 选中的代码\n\`\`\`${language}\n${context.currentSelection}\n\`\`\``,
    success: true
  }
}

/**
 * 解析 @terminal 指令
 */
function resolveTerminalCommand(context: ResolveContext): ResolvedCommand {
  if (!context.terminalOutput) {
    return {
      command: '@terminal',
      content: '',
      success: false,
      error: 'No terminal output available'
    }
  }

  return {
    command: '@terminal',
    content: `## 终端输出\n\`\`\`\n${context.terminalOutput}\n\`\`\``,
    success: true
  }
}

/**
 * 解析 @error 指令
 */
function resolveErrorCommand(context: ResolveContext): ResolvedCommand {
  if (!context.lastError) {
    return {
      command: '@error',
      content: '',
      success: false,
      error: 'No error information available'
    }
  }

  return {
    command: '@error',
    content: `## 错误信息\n\`\`\`\n${context.lastError}\n\`\`\``,
    success: true
  }
}

/**
 * 解析 @code 指令
 */
function resolveCodeCommand(language?: string): ResolvedCommand {
  const lang = language || 'typescript'

  return {
    command: '@code',
    parameter: lang,
    content: `\`\`\`${lang}\n// 在此输入代码\n\`\`\``,
    success: true
  }
}

/**
 * 根据文件扩展名检测语言
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''

  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    xml: 'xml',
    toml: 'toml'
  }

  return langMap[ext] || ext
}

export default {
  resolveQuickCommands,
  detectLanguage
}
