/**
 * MultiModelCodeCrew VCP Plugin
 *
 * 将 MultiModelCodeCrew 封装为 VCP 内置服务
 * 支持通过 VCP 协议调用多模型协同编码功能
 */

import { loggerService } from '@logger'
import { v4 as uuidv4 } from 'uuid'

import { CodeCrewOrchestrator } from './CodeCrewOrchestrator'
import type { CodeFile, CodeIssue, CrewConfig, CrewProgress, CrewRole, CrewSession } from './types'

const logger = loggerService.withContext('MultiModelCodeCrewPlugin')

// ==================== VCP 服务接口 ====================

/**
 * Crew 启动参数
 */
export interface StartCrewParams {
  /** 需求描述 */
  requirement: string
  /** 启用的角色 */
  roles?: CrewRole[]
  /** 会话名称 */
  name?: string
  /** 会话描述 */
  description?: string
  /** 项目上下文 */
  projectContext?: {
    name?: string
    techStack?: string[]
    conventions?: string
  }
  /** 配置覆盖 */
  config?: Partial<CrewConfig>
}

/**
 * Crew 执行结果
 */
export interface CrewExecutionResult {
  success: boolean
  sessionId: string
  files: CodeFile[]
  issues: CodeIssue[]
  summary: string
  error?: string
}

/**
 * 应用结果参数
 */
export interface ApplyResultParams {
  sessionId: string
  files?: string[] // 指定要应用的文件，空则应用全部
}

/**
 * 应用结果返回
 */
export interface ApplyResult {
  success: boolean
  appliedFiles: string[]
  error?: string
}

// ==================== VCP 服务实现 ====================

/**
 * 活动会话存储
 */
const activeSessions: Map<
  string,
  {
    orchestrator: CodeCrewOrchestrator
    session: CrewSession
    result?: CrewExecutionResult
  }
> = new Map()

/**
 * 启动协同任务
 */
export async function startCrew(params: StartCrewParams): Promise<CrewExecutionResult> {
  const {
    requirement,
    roles,
    name = `Crew_${Date.now()}`,
    description = requirement.slice(0, 100),
    projectContext,
    config
  } = params

  logger.info('Starting crew session', { name, roles, requirement: requirement.slice(0, 50) })

  const orchestrator = new CodeCrewOrchestrator(config)

  try {
    // 初始化会话
    const session = await orchestrator.initSession({
      name,
      description,
      requirement,
      roles
    })

    // 设置项目上下文
    if (projectContext) {
      orchestrator.updateProjectContext(projectContext)
    }

    // 存储活动会话
    activeSessions.set(session.id, { orchestrator, session })

    // 执行任务
    const result = await orchestrator.execute(requirement)

    const executionResult: CrewExecutionResult = {
      success: true,
      sessionId: session.id,
      files: result.files,
      issues: result.issues,
      summary: result.summary
    }

    // 更新存储的结果
    const stored = activeSessions.get(session.id)
    if (stored) {
      stored.result = executionResult
    }

    logger.info('Crew session completed', {
      sessionId: session.id,
      filesCount: result.files.length,
      issuesCount: result.issues.length
    })

    return executionResult
  } catch (error) {
    logger.error('Crew session failed', error as Error)

    return {
      success: false,
      sessionId: orchestrator.getSession()?.id || uuidv4(),
      files: [],
      issues: [],
      summary: '',
      error: (error as Error).message
    }
  }
}

/**
 * 获取进度
 */
export function getProgress(sessionId: string): CrewProgress | null {
  const stored = activeSessions.get(sessionId)
  if (!stored) {
    logger.warn('Session not found', { sessionId })
    return null
  }

  return stored.orchestrator.getProgress()
}

/**
 * 获取会话
 */
export function getSession(sessionId: string): CrewSession | null {
  const stored = activeSessions.get(sessionId)
  return stored?.session || null
}

/**
 * 获取执行结果
 */
export function getResult(sessionId: string): CrewExecutionResult | null {
  const stored = activeSessions.get(sessionId)
  return stored?.result || null
}

/**
 * 停止会话
 */
export function stopSession(sessionId: string): boolean {
  const stored = activeSessions.get(sessionId)
  if (!stored) {
    return false
  }

  stored.orchestrator.stop()
  return true
}

/**
 * 应用结果到 Canvas
 */
export async function applyResults(params: ApplyResultParams): Promise<ApplyResult> {
  const { sessionId, files: fileFilter } = params

  const stored = activeSessions.get(sessionId)
  if (!stored?.result) {
    return {
      success: false,
      appliedFiles: [],
      error: 'Session or result not found'
    }
  }

  const { files } = stored.result
  const appliedFiles: string[] = []

  try {
    for (const file of files) {
      // 如果指定了文件过滤，检查是否在列表中
      if (fileFilter && fileFilter.length > 0 && !fileFilter.includes(file.path)) {
        continue
      }

      if (file.action === 'create' || file.action === 'modify') {
        // 尝试创建或保存文件到 Canvas
        if (window.api?.canvas) {
          try {
            await window.api.canvas.createFile(file.path.split('/').pop() || file.path)
          } catch {
            // 文件可能已存在
          }
          await window.api.canvas.saveFile({ path: file.path, content: file.content })
          appliedFiles.push(file.path)
        }
      }
    }

    logger.info('Applied results to Canvas', { sessionId, appliedCount: appliedFiles.length })

    return {
      success: true,
      appliedFiles
    }
  } catch (error) {
    logger.error('Failed to apply results', error as Error)

    return {
      success: false,
      appliedFiles,
      error: (error as Error).message
    }
  }
}

/**
 * 清理会话
 */
export function cleanupSession(sessionId: string): boolean {
  return activeSessions.delete(sessionId)
}

/**
 * 列出所有活动会话
 */
export function listActiveSessions(): Array<{
  id: string
  name: string
  status: string
  phase: string
}> {
  const sessions: Array<{
    id: string
    name: string
    status: string
    phase: string
  }> = []

  for (const [id, stored] of activeSessions) {
    sessions.push({
      id,
      name: stored.session.name,
      status: stored.session.status,
      phase: stored.session.phase
    })
  }

  return sessions
}

// ==================== VCP 工具定义 ====================

/**
 * VCP 工具描述 - 用于 AI 调用
 */
export const VCP_TOOLS_DESCRIPTION = `
## MultiModelCodeCrew 多模型协同编码工具

### start_crew - 启动协同编码任务
启动一个多模型协同编码会话，多个 AI 角色协作完成复杂编码任务。

参数:
- requirement (必需): 需求描述
- roles (可选): 启用的角色列表，可选: architect, developer, frontend, reviewer, tester, researcher
- name (可选): 会话名称
- techStack (可选): 技术栈列表

示例:
<<<[TOOL_REQUEST]>>>
pluginName:「始」start_crew「末」
requirement:「始」实现一个用户登录功能，包含表单验证和 JWT 认证「末」
roles:「始」architect,developer,reviewer,tester「末」
techStack:「始」React,TypeScript,Node.js「末」
<<<[END_TOOL_REQUEST]>>>

### get_crew_progress - 获取进度
获取协同任务的当前进度。

参数:
- sessionId (必需): 会话 ID

### apply_crew_results - 应用结果
将生成的代码应用到 Canvas。

参数:
- sessionId (必需): 会话 ID
- files (可选): 要应用的文件列表，逗号分隔
`

/**
 * VCP 工具执行器
 */
export async function executeVCPTool(
  toolName: string,
  params: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    switch (toolName.toLowerCase()) {
      case 'start_crew': {
        const roles = params.roles ? (params.roles.split(',').map((r) => r.trim()) as CrewRole[]) : undefined

        const techStack = params.techStack ? params.techStack.split(',').map((t) => t.trim()) : undefined

        const result = await startCrew({
          requirement: params.requirement,
          roles,
          name: params.name,
          projectContext: techStack ? { techStack } : undefined
        })

        if (result.success) {
          return {
            success: true,
            result: `协同任务已完成！

会话 ID: ${result.sessionId}
生成文件: ${result.files.length} 个
发现问题: ${result.issues.length} 个

${result.summary}

文件列表:
${result.files.map((f) => `- ${f.path} (${f.action})`).join('\n')}

使用 apply_crew_results 应用代码到 Canvas。`
          }
        } else {
          return {
            success: false,
            error: result.error || '协同任务失败'
          }
        }
      }

      case 'get_crew_progress': {
        const progress = getProgress(params.sessionId)
        if (!progress) {
          return {
            success: false,
            error: '会话不存在'
          }
        }

        return {
          success: true,
          result: `进度: ${progress.completedTasks}/${progress.totalTasks} 任务完成
阶段: ${progress.phase}
生成文件: ${progress.generatedFiles} 个
发现问题: ${progress.foundIssues} 个`
        }
      }

      case 'apply_crew_results': {
        const files = params.files ? params.files.split(',').map((f) => f.trim()) : undefined

        const result = await applyResults({
          sessionId: params.sessionId,
          files
        })

        if (result.success) {
          return {
            success: true,
            result: `已应用 ${result.appliedFiles.length} 个文件:
${result.appliedFiles.map((f) => `- ${f}`).join('\n')}`
          }
        } else {
          return {
            success: false,
            error: result.error || '应用失败'
          }
        }
      }

      case 'stop_crew': {
        const stopped = stopSession(params.sessionId)
        return {
          success: stopped,
          result: stopped ? '会话已停止' : '会话不存在',
          error: stopped ? undefined : '会话不存在'
        }
      }

      case 'list_crew_sessions': {
        const sessions = listActiveSessions()
        if (sessions.length === 0) {
          return {
            success: true,
            result: '当前没有活动会话'
          }
        }

        return {
          success: true,
          result: `活动会话 (${sessions.length}):
${sessions.map((s) => `- ${s.id}: ${s.name} [${s.status}] @ ${s.phase}`).join('\n')}`
        }
      }

      default:
        return {
          success: false,
          error: `未知工具: ${toolName}`
        }
    }
  } catch (error) {
    logger.error('VCP tool execution failed', error as Error, { toolName, params })
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

// ==================== VCP 服务注册 ====================

/**
 * VCP 内置服务接口
 */
export interface IMultiModelCodeCrewService {
  id: 'multi_model_code_crew'
  startCrew: typeof startCrew
  getProgress: typeof getProgress
  getSession: typeof getSession
  getResult: typeof getResult
  stopSession: typeof stopSession
  applyResults: typeof applyResults
  cleanupSession: typeof cleanupSession
  listActiveSessions: typeof listActiveSessions
  executeVCPTool: typeof executeVCPTool
  toolsDescription: typeof VCP_TOOLS_DESCRIPTION
}

/**
 * 创建 VCP 服务实例
 */
export function createMultiModelCodeCrewService(): IMultiModelCodeCrewService {
  return {
    id: 'multi_model_code_crew',
    startCrew,
    getProgress,
    getSession,
    getResult,
    stopSession,
    applyResults,
    cleanupSession,
    listActiveSessions,
    executeVCPTool,
    toolsDescription: VCP_TOOLS_DESCRIPTION
  }
}

// 导出服务实例
export const multiModelCodeCrewService = createMultiModelCodeCrewService()

export default multiModelCodeCrewService
