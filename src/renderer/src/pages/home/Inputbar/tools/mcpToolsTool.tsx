/**
 * VCP 统一协议工具注册
 *
 * 虽然命名为 "mcpToolsTool"，但这是 VCP 统一协议的一部分：
 * - 用户配置的 MCP 服务器工具会自动转换为 VCP 格式
 * - 工具调用统一使用 VCP 协议: <<<[TOOL_REQUEST]>>>
 * - 执行由 VCPToolExecutorMiddleware 统一处理
 *
 * @see src/renderer/src/aiCore/legacy/middleware/VCPToolExecutorMiddleware.ts
 * @see src/main/knowledge/vcp/MCPOBridge.ts
 */
import { defineTool, registerTool, TopicType } from '@renderer/pages/home/Inputbar/types'
import { isPromptToolUse, isSupportedToolUse } from '@renderer/utils/mcp-tools'

import MCPToolsButton from './components/MCPToolsButton'

// VCP 统一协议：MCP 服务器工具配置入口
const mcpToolsTool = defineTool({
  key: 'mcp_tools',
  label: (t) => t('settings.mcp.title'),
  visibleInScopes: [TopicType.Chat],
  condition: ({ assistant }) => isSupportedToolUse(assistant) || isPromptToolUse(assistant),
  dependencies: {
    actions: ['onTextChange', 'resizeTextArea'] as const
  },
  render: ({ assistant, actions, quickPanel }) => (
    <MCPToolsButton
      assistantId={assistant.id}
      quickPanel={quickPanel}
      setInputValue={actions.onTextChange}
      resizeTextArea={actions.resizeTextArea}
    />
  )
})

registerTool(mcpToolsTool)

export default mcpToolsTool
