import type { AiPlugin } from '@cherrystudio/ai-core'
import { createPromptToolUsePlugin, webSearchPlugin } from '@cherrystudio/ai-core/built-in/plugins'
import { loggerService } from '@logger'
import { getEnableDeveloperMode } from '@renderer/hooks/useSettings'
import type { Assistant } from '@renderer/types'

import type { AiSdkMiddlewareConfig } from '../middleware/AiSdkMiddlewareBuilder'
import { searchOrchestrationPlugin } from './searchOrchestrationPlugin'
import { createTelemetryPlugin } from './telemetryPlugin'
import { vcpContextPlugin } from './vcpContextPlugin'

const logger = loggerService.withContext('PluginBuilder')
/**
 * 根据条件构建插件数组
 */
export function buildPlugins(
  middlewareConfig: AiSdkMiddlewareConfig & { assistant: Assistant; topicId?: string }
): AiPlugin[] {
  const plugins: AiPlugin[] = []

  if (middlewareConfig.topicId && getEnableDeveloperMode()) {
    // 0. 添加 telemetry 插件
    plugins.push(
      createTelemetryPlugin({
        enabled: true,
        topicId: middlewareConfig.topicId,
        assistant: middlewareConfig.assistant
      })
    )
  }

  // 1. 模型内置搜索
  if (middlewareConfig.enableWebSearch && middlewareConfig.webSearchPluginConfig) {
    plugins.push(webSearchPlugin(middlewareConfig.webSearchPluginConfig))
  }
  // 2. 支持工具调用时添加搜索插件
  if (middlewareConfig.isSupportedToolUse || middlewareConfig.isPromptToolUse) {
    plugins.push(searchOrchestrationPlugin(middlewareConfig.assistant, middlewareConfig.topicId || ''))
  }

  // 3. 推理模型时添加推理插件
  // if (middlewareConfig.enableReasoning) {
  //   plugins.push(reasoningTimePlugin)
  // }

  // 4. 启用Prompt工具调用时添加工具插件
  if (middlewareConfig.isPromptToolUse) {
    plugins.push(
      createPromptToolUsePlugin({
        enabled: true,
        createSystemMessage: (systemPrompt, params, context) => {
          const modelId = typeof context.model === 'string' ? context.model : context.model.modelId
          if (modelId.includes('o1-mini') || modelId.includes('o1-preview')) {
            if (context.isRecursiveCall) {
              return null
            }
            params.messages = [
              {
                role: 'assistant',
                content: systemPrompt
              },
              ...params.messages
            ]
            return null
          }
          return systemPrompt
        }
      })
    )
  }

  // if (middlewareConfig.enableUrlContext && middlewareConfig.) {
  //   plugins.push(googleToolsPlugin({ urlContext: true }))
  // }

  // 5. VCP 上下文注入插件 (如果 Agent 启用、配置了知识库、系统提示词包含 VCP 占位符、或绑定了角色卡)
  // 统一模型：助手即智能体，使用助手 ID 作为 Agent ID
  const vcpAgentId = middlewareConfig.assistant.vcpConfig?.enabled ? middlewareConfig.assistant.id : undefined
  const hasKnowledgeBases = (middlewareConfig.assistant.knowledge_bases?.length ?? 0) > 0
  // 检查系统提示词是否包含 VCP 占位符 {{VCPAllTools}}, {{VCPPluginName}} 等
  const hasVCPPlaceholder = middlewareConfig.assistant.prompt?.includes('{{VCP') ?? false
  // 检查是否绑定了角色卡
  const hasCharacterCard = !!middlewareConfig.assistant.profile?.characterCardId

  if (vcpAgentId || hasKnowledgeBases || hasVCPPlaceholder || hasCharacterCard) {
    plugins.push(vcpContextPlugin(middlewareConfig.assistant, middlewareConfig.topicId || ''))
    logger.debug('VCP context plugin added', { vcpAgentId: !!vcpAgentId, hasKnowledgeBases, hasVCPPlaceholder, hasCharacterCard })
  }

  logger.debug(
    'Final plugin list:',
    plugins.map((p) => p.name)
  )
  return plugins
}
