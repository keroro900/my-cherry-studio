/**
 * AgentInvocationTool - Agent 调用工具
 *
 * 让 AI 能够通过工具调用其他 Agent，实现多 Agent 协同
 * 类似于 VCP 的 TOOL_REQUEST 机制，但使用标准的 Function Call
 *
 * 使用场景：
 * 1. 主持人 Agent 需要调用图片生成 Agent
 * 2. 代码专家 Agent 需要调用翻译 Agent
 * 3. 任何 Agent 需要另一个 Agent 的专业能力
 */

import { loggerService } from '@logger'
import type { MCPTool } from '@renderer/types'

import { type AgentResponse, getGroupAgentRunner } from './GroupAgentRunner'
import type { AgentConfig } from './GroupChatCoordinator'

const logger = loggerService.withContext('AgentInvocationTool')

/**
 * 清理 AI 输出中意外包含的发言标记
 */
function stripSpeakerTag(content: string | undefined, agentName: string): string {
  if (!content) return ''

  // 转义正则特殊字符
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 模式1: 完全匹配 [agentName的发言]: 开头
  const exactPattern = new RegExp(`^\\[${escapeRegExp(agentName)}的发言\\][:：]\\s*`, 'i')
  let cleaned = content.replace(exactPattern, '')

  // 模式2: 匹配任意 [xxx的发言]: 开头
  const genericPattern = /^\[[\u4e00-\u9fa5\w]+的发言\][:：]\s*/i
  cleaned = cleaned.replace(genericPattern, '')

  // 模式3: 匹配 xxx: 或 xxx：开头
  const simplePattern = new RegExp(`^${escapeRegExp(agentName)}[:：]\\s*`, 'i')
  cleaned = cleaned.replace(simplePattern, '')

  return cleaned.trim()
}

/**
 * Agent 调用结果
 */
export interface AgentInvocationResult {
  success: boolean
  agentId: string
  agentName: string
  response?: string
  images?: string[]
  error?: string
}

/**
 * Agent 调用上下文
 */
export interface AgentInvocationContext {
  /** 当前会话 ID */
  sessionId: string
  /** 可调用的 Agent 列表 */
  availableAgents: AgentConfig[]
  /** 调用来源 Agent */
  sourceAgentId: string
  /** 当前对话上下文 */
  conversationContext: string
  /** 调用深度（防止无限递归） */
  currentDepth: number
  /** 最大调用深度 */
  maxDepth: number
  /** 群组设定（共同背景） */
  groupPrompt?: string
}

/**
 * 创建 Agent 调用工具定义
 * 返回符合 MCP Tool 格式的工具定义
 */
export function createAgentInvocationToolDefinition(context: AgentInvocationContext): MCPTool {
  // 构建可用 Agent 列表描述
  const agentDescriptions = context.availableAgents
    .filter((a) => a.id !== context.sourceAgentId) // 排除自己
    .map((a) => {
      const expertise = a.expertise?.join('、') || '通用'
      const role = getRoleLabel(a.role)
      return `- ${a.displayName} (${role}): ${expertise}`
    })
    .join('\n')

  return {
    id: 'invoke_agent',
    name: 'invoke_agent',
    description: `调用群聊中的其他 Agent 获取帮助或专业意见。

可调用的 Agent:
${agentDescriptions}

使用场景:
- 需要图片生成能力时，调用图片助手
- 需要代码专业意见时，调用代码专家
- 需要翻译时，调用翻译助手
- 需要其他专业领域的帮助时

注意: 每次只能调用一个 Agent，等待其响应后再决定是否需要调用其他 Agent。`,
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: '要调用的 Agent 名称（必须是上述列表中的名称）'
        },
        request: {
          type: 'string',
          description: '发送给该 Agent 的请求内容，要清晰描述你需要什么'
        },
        context: {
          type: 'string',
          description: '可选的额外上下文信息，帮助 Agent 更好地理解任务'
        }
      },
      required: ['agent_name', 'request']
    },
    serverName: 'built-in',
    serverId: 'group-chat-agents',
    type: 'mcp',
    isBuiltIn: true
  }
}

/**
 * 执行 Agent 调用
 */
export async function executeAgentInvocation(
  params: { agent_name: string; request: string; context?: string },
  invocationContext: AgentInvocationContext
): Promise<AgentInvocationResult> {
  const { agent_name, request, context: extraContext } = params

  logger.info('Executing agent invocation', {
    targetAgent: agent_name,
    sourceAgent: invocationContext.sourceAgentId,
    depth: invocationContext.currentDepth
  })

  // 检查递归深度
  if (invocationContext.currentDepth >= invocationContext.maxDepth) {
    logger.warn('Max agent invocation depth reached', {
      depth: invocationContext.currentDepth,
      maxDepth: invocationContext.maxDepth
    })
    return {
      success: false,
      agentId: '',
      agentName: agent_name,
      error: `已达到最大调用深度 (${invocationContext.maxDepth})，无法继续调用其他 Agent`
    }
  }

  // 查找目标 Agent
  const targetAgent = invocationContext.availableAgents.find(
    (a) =>
      a.displayName === agent_name || a.displayName.toLowerCase() === agent_name.toLowerCase() || a.id === agent_name
  )

  if (!targetAgent) {
    const availableNames = invocationContext.availableAgents
      .filter((a) => a.id !== invocationContext.sourceAgentId)
      .map((a) => a.displayName)
      .join('、')

    return {
      success: false,
      agentId: '',
      agentName: agent_name,
      error: `未找到名为 "${agent_name}" 的 Agent。可用的 Agent: ${availableNames}`
    }
  }

  // 不能调用自己
  if (targetAgent.id === invocationContext.sourceAgentId) {
    return {
      success: false,
      agentId: targetAgent.id,
      agentName: targetAgent.displayName,
      error: '不能调用自己'
    }
  }

  try {
    // 构建完整的用户输入
    const fullRequest = extraContext ? `${request}\n\n背景信息: ${extraContext}` : request

    // 构建增强的系统提示词（包含群组设定）
    const enhancedSystemPrompt = buildEnhancedSystemPrompt(
      targetAgent.systemPrompt || '',
      invocationContext.groupPrompt
    )

    // 使用 GroupAgentRunner 执行调用
    const runner = getGroupAgentRunner()
    const response: AgentResponse = await runner.runAgent({
      agentId: targetAgent.id,
      agentName: targetAgent.displayName,
      assistant: targetAgent.assistant,
      provider: targetAgent.provider,
      userInput: fullRequest,
      systemPromptOverride: enhancedSystemPrompt,
      stream: false, // 工具调用使用非流式
      role: targetAgent.role,
      expertise: targetAgent.expertise || [],
      // 传递调用上下文
      invitePrompt: `你被 ${invocationContext.sourceAgentId} 邀请来回答以下问题。请直接给出你的专业回答。`
    })

    if (response.success) {
      logger.info('Agent invocation successful', {
        targetAgent: targetAgent.displayName,
        hasImages: !!response.images?.length
      })

      // 清理 AI 意外添加的发言标记
      const cleanedResponse = stripSpeakerTag(response.content, targetAgent.displayName)

      return {
        success: true,
        agentId: targetAgent.id,
        agentName: targetAgent.displayName,
        response: cleanedResponse,
        images: response.images
      }
    } else {
      return {
        success: false,
        agentId: targetAgent.id,
        agentName: targetAgent.displayName,
        error: response.error || '调用失败'
      }
    }
  } catch (error) {
    logger.error('Agent invocation failed', error as Error)
    return {
      success: false,
      agentId: targetAgent.id,
      agentName: targetAgent.displayName,
      error: (error as Error).message || '调用过程发生错误'
    }
  }
}

/**
 * 格式化 Agent 调用结果为 AI 可读的文本
 */
export function formatAgentInvocationResult(result: AgentInvocationResult): string {
  if (result.success) {
    let text = `【${result.agentName} 的回复】\n${result.response}`

    if (result.images && result.images.length > 0) {
      text += `\n\n[已生成 ${result.images.length} 张图片]`
    }

    return text
  } else {
    return `【调用 ${result.agentName} 失败】\n错误: ${result.error}`
  }
}

/**
 * 获取角色标签
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    host: '主持人',
    moderator: '协调者',
    expert: '专家',
    participant: '参与者',
    observer: '观察者'
  }
  return labels[role] || '参与者'
}

/**
 * 构建增强的系统提示词（包含群组设定）
 */
function buildEnhancedSystemPrompt(agentPrompt: string, groupPrompt?: string): string {
  const parts: string[] = []

  // 1. 群组设定（共同背景）
  if (groupPrompt) {
    parts.push(`## 群组背景设定\n${groupPrompt}`)
  }

  // 2. Agent 原始提示词
  if (agentPrompt) {
    parts.push(`## 你的角色设定\n${agentPrompt}`)
  }

  // 3. 发言规则
  parts.push(`## 发言规则
- 系统会自动为每条消息添加 [发言者的发言]: 格式的标记
- 你不需要手动添加发言标记，直接输出回复内容即可
- 专注于对话内容，不要讨论发言标记系统`)

  return parts.join('\n\n')
}

/**
 * VCP 风格的 Agent 调用协议
 *
 * 除了标准 Function Call，也支持 VCP 文本协议格式：
 *
 * <<<[AGENT_REQUEST]>>>
 * agent_name:「始」图片助手「末」
 * request:「始」请帮我生成一张猫的图片「末」
 * <<<[END_AGENT_REQUEST]>>>
 */
export const VCP_AGENT_MARKERS = {
  REQUEST_START: '<<<[AGENT_REQUEST]>>>',
  REQUEST_END: '<<<[END_AGENT_REQUEST]>>>',
  RESULT_START: '<<<[AGENT_RESULT]>>>',
  RESULT_END: '<<<[END_AGENT_RESULT]>>>',
  PARAM_START: '「始」',
  PARAM_END: '「末」'
} as const

/**
 * 解析 VCP 风格的 Agent 调用请求
 */
export function parseVCPAgentRequest(text: string): { agent_name: string; request: string; context?: string } | null {
  const startIdx = text.indexOf(VCP_AGENT_MARKERS.REQUEST_START)
  const endIdx = text.indexOf(VCP_AGENT_MARKERS.REQUEST_END)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null
  }

  const content = text.slice(startIdx + VCP_AGENT_MARKERS.REQUEST_START.length, endIdx)

  // 解析参数
  const params: Record<string, string> = {}
  const paramRegex = /(\w+):「始」([^」]*)「末」/g
  let match

  while ((match = paramRegex.exec(content)) !== null) {
    params[match[1]] = match[2]
  }

  if (!params.agent_name || !params.request) {
    return null
  }

  return {
    agent_name: params.agent_name,
    request: params.request,
    context: params.context
  }
}

/**
 * 格式化 VCP 风格的 Agent 调用结果
 */
export function formatVCPAgentResult(result: AgentInvocationResult): string {
  const status = result.success ? 'success' : 'error'
  const content = result.success ? result.response : result.error

  return `${VCP_AGENT_MARKERS.RESULT_START}
agent_name:「始」${result.agentName}「末」
status:「始」${status}「末」
result:「始」${content}「末」
${VCP_AGENT_MARKERS.RESULT_END}`
}
