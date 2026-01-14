import { loggerService } from '@logger'
import type { MCPTool } from '@renderer/types'

const logger = loggerService.withContext('MCP-utils')

/**
 * VCP 统一协议 - 不再使用 AI SDK 原生工具
 *
 * 所有工具（包括 MCP 工具）都通过 VCP 协议格式调用：
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」ToolName「末」
 * param:「始」value「末」
 * <<<[END_TOOL_REQUEST]>>>
 *
 * @deprecated AI SDK 原生工具已废弃，统一使用 VCP 协议
 */
export function setupToolsConfig(_mcpTools?: MCPTool[]): undefined {
  // VCP 统一协议：不再返回 AI SDK 工具格式
  // 工具信息将通过 VCP 占位符 {{VCPAllTools}} 注入到系统提示词中
  logger.debug('VCP unified protocol: AI SDK native tools disabled, using VCP format instead')
  return undefined
}

/**
 * 将 MCP 工具转换为 VCP 格式的工具描述
 *
 * 输出格式兼容 VCPToolBox invocationCommands
 */
export function convertMcpToolsToVCPDescription(mcpTools: MCPTool[]): string {
  if (!mcpTools?.length) {
    return ''
  }

  const descriptions: string[] = []

  for (const mcpTool of mcpTools) {
    const toolName = mcpTool.name
    const serverName = mcpTool.serverName || 'MCP'

    // 构建参数描述
    const params = mcpTool.inputSchema?.properties
      ? Object.entries(mcpTool.inputSchema.properties as Record<string, { description?: string; type?: string }>)
          .map(([name, prop]) => {
            const required = (mcpTool.inputSchema?.required as string[])?.includes(name) ? '(必需)' : '(可选)'
            const type = prop.type || 'string'
            return `${name}:「始」${required} ${type} - ${prop.description || '无描述'}「末」`
          })
          .join(',\n')
      : ''

    // 生成 VCP 格式的调用示例
    const exampleParams = mcpTool.inputSchema?.properties
      ? Object.entries(mcpTool.inputSchema.properties as Record<string, { description?: string }>)
          .map(([name, prop]) => `${name}:「始」${prop.description || '...'} 的值「末」`)
          .join(',\n')
      : ''

    const description = `## ${toolName} (${serverName})
描述: ${mcpTool.description || '无描述'}

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」${toolName}「末」,
${params || 'command:「始」execute「末」'}
<<<[END_TOOL_REQUEST]>>>

调用示例:
<<<[TOOL_REQUEST]>>>
tool_name:「始」${toolName}「末」,
${exampleParams || 'command:「始」execute「末」'}
<<<[END_TOOL_REQUEST]>>>`

    descriptions.push(description)
  }

  logger.debug('Converted MCP tools to VCP format', { toolCount: mcpTools.length })
  return descriptions.join('\n\n---\n\n')
}

/**
 * 生成 VCP 协议使用说明
 *
 * @param isLayeredMode 是否为分层模式（使用 {{VCPToolCatalog}}）
 */
export function generateVCPProtocolGuide(isLayeredMode: boolean = false): string {
  const layeredGuide = isLayeredMode
    ? `
## 分层工具发现

你已获得精简的工具目录。要使用某个工具，请先查询其详细用法：

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_get_tool_info「末」,
name:「始」工具名称「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

然后根据返回的详细用法调用具体工具。
`
    : ''

  return `## VCP 工具调用协议

当需要调用工具时，请使用以下格式：

<<<[TOOL_REQUEST]>>>
tool_name:「始」工具名称「末」,
参数1:「始」参数值「末」,
参数2:「始」参数值「末」
<<<[END_TOOL_REQUEST]>>>

重要说明：
1. 所有参数值必须用「始」和「末」包裹
2. tool_name 是必需参数，指定要调用的工具
3. 调用完成后，您将收到工具执行结果
4. 请等待工具结果后再继续回复用户${layeredGuide}`
}

/**
 * @deprecated 已废弃，统一使用 VCP 协议
 */
export function convertMcpToolsToAiSdkTools(_mcpTools: MCPTool[]): Record<string, never> {
  logger.warn('convertMcpToolsToAiSdkTools is deprecated, use VCP protocol instead')
  return {}
}
