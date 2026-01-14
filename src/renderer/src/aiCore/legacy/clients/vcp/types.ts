/**
 * VCP (Virtual Context Protocol) Types
 *
 * These types support the VCPToolBox protocol for tool calling.
 * Format: <<<[TOOL_REQUEST]>>> ... <<<[END_TOOL_REQUEST]>>>
 */

/**
 * VCP Protocol markers for parsing
 */
export const VCP_MARKERS = {
  TOOL_REQUEST_START: '<<<[TOOL_REQUEST]>>>',
  TOOL_REQUEST_END: '<<<[END_TOOL_REQUEST]>>>',
  TOOL_RESULT: '<<<[TOOL_RESULT]>>>',
  TOOL_RESULT_END: '<<<[/TOOL_RESULT]>>>',
  TOOL_ERROR: '<<<[TOOL_ERROR]>>>',
  TOOL_ERROR_END: '<<<[/TOOL_ERROR]>>>',
  PARAM_START: '「始」',
  PARAM_END: '「末」'
} as const

/**
 * VCP Tool Request structure
 *
 * Parsed from:
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」PluginName「末」
 * param1:「始」value1「末」
 * <<<[END_TOOL_REQUEST]>>>
 */
export interface VCPToolRequest {
  toolName: string
  params: Record<string, string>
  rawText: string
  startIndex: number
  endIndex: number
  archery?: boolean // Fire-and-forget mode (no_reply)
}

/**
 * VCP Tool Response structure
 */
export interface VCPToolResponse {
  status: 'success' | 'error'
  result?: unknown
  error?: string
  timestamp?: string
}

/**
 * VCP Tool Execution Result
 */
export interface VCPToolExecutionResult {
  request: VCPToolRequest
  response: VCPToolResponse
  executionTimeMs: number
}

/**
 * VCP Tool Executor function type
 */
export type VCPToolExecutor = (toolName: string, params: Record<string, string>) => Promise<VCPToolResponse>

// ==================== Agent Invoke Types ====================

/**
 * VCP Agent Invoke Request
 *
 * Parsed from:
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」invoke_agent「末」
 * agent_id:「始」target_agent_id「末」
 * prompt:「始」用户问题「末」
 * mode:「始」sync|async「末」
 * <<<[END_TOOL_REQUEST]>>>
 */
export interface VCPAgentInvokeRequest {
  /** 目标 Agent ID 或名称 */
  agentId: string
  /** 调用提示词 */
  prompt: string
  /** 调用模式 */
  mode: 'sync' | 'async'
  /** 调用者 Agent ID (可选) */
  callerAgentId?: string
  /** 会话 ID (可选) */
  sessionId?: string
  /** 超时时间 (毫秒) */
  timeout?: number
  /** 回调 URL (异步模式) */
  callbackUrl?: string
}

/**
 * VCP Agent Invoke Result
 */
export interface VCPAgentInvokeResult {
  /** 状态 */
  status: 'success' | 'error' | 'timeout' | 'pending'
  /** 响应内容 (同步模式) */
  response?: string
  /** 任务 ID (异步模式) */
  taskId?: string
  /** 错误信息 */
  error?: string
  /** Token 使用量 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 执行时间 (毫秒) */
  executionTimeMs?: number
}

/**
 * 解析 VCP Agent 调用请求
 */
export function parseAgentInvokeRequest(params: Record<string, string>): VCPAgentInvokeRequest | null {
  const agentId = params.agentid || params.agent_id || params.targetagentid
  const prompt = params.prompt || params.message || params.content

  if (!agentId || !prompt) {
    return null
  }

  return {
    agentId,
    prompt,
    mode: (params.mode as 'sync' | 'async') || 'sync',
    callerAgentId: params.calleragentid || params.caller_agent_id,
    sessionId: params.sessionid || params.session_id,
    timeout: params.timeout ? parseInt(params.timeout, 10) : undefined,
    callbackUrl: params.callbackurl || params.callback_url
  }
}

/**
 * 格式化 Agent 调用结果为 VCP 格式
 */
export function formatAgentInvokeResult(result: VCPAgentInvokeResult): string {
  const { TOOL_RESULT, TOOL_RESULT_END, TOOL_ERROR, TOOL_ERROR_END } = VCP_MARKERS

  if (result.status === 'success' && result.response) {
    return `${TOOL_RESULT}
[invoke_agent]
${result.response}
${TOOL_RESULT_END}`
  } else if (result.status === 'pending' && result.taskId) {
    return `${TOOL_RESULT}
[invoke_agent - async]
Task created: ${result.taskId}
Use get_agent_task_status to check result.
${TOOL_RESULT_END}`
  } else {
    return `${TOOL_ERROR}
invoke_agent failed: ${result.error || 'Unknown error'}
${TOOL_ERROR_END}`
  }
}
