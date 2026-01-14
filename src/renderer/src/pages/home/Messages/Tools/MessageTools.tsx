/**
 * VCP 统一协议工具路由组件
 *
 * 所有工具调用都通过 VCP 协议统一处理：
 * - MCP 服务器工具 (tool.type === 'mcp') - 自动转换为 VCP 格式执行
 * - 内置工具 (tool.type === 'builtin')
 * - Provider 工具 (tool.type === 'provider')
 *
 * VCP 是执行协议层面的统一，不是工具类型
 * @see src/renderer/src/aiCore/legacy/middleware/VCPToolExecutorMiddleware.ts
 */
import type { ToolMessageBlock } from '@renderer/types/newMessage'

import MessageMcpTool from './MessageMcpTool'
import MessageTool from './MessageTool'

// VCP 统一协议：导出别名，便于未来迁移
export const MessageVCPTool = MessageMcpTool

interface Props {
  block: ToolMessageBlock
}

export default function MessageTools({ block }: Props) {
  const toolResponse = block.metadata?.rawMcpToolResponse
  if (!toolResponse) return null

  const tool = toolResponse.tool

  // VCP 统一协议：MCP 服务器工具通过 VCP 协议执行，使用统一组件显示
  if (tool.type === 'mcp') {
    return <MessageMcpTool block={block} />
  }

  // 内置工具和 Provider 工具使用基础工具组件
  return <MessageTool block={block} />
}
