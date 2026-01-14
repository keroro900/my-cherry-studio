/**
 * VCP 工具信息查询服务
 *
 * 提供元工具 vcp_get_tool_info，让 AI 可以按需查询工具详情
 * 配合 {{VCPToolCatalog}} 占位符实现分层工具发现机制：
 *
 * 1. 第一层：{{VCPToolCatalog}} - 精简的工具目录（~500 tokens）
 * 2. 第二层：vcp_get_tool_info - 按需查询具体工具详情
 * 3. 第三层：VCP 协议调用 - 执行具体工具
 *
 * 这种分层机制可以将 token 消耗从 10000+ 降低到按需加载
 */

import { loggerService } from '@logger'

import { getBuiltinServiceRegistry } from './index'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'

const logger = loggerService.withContext('VCP:ToolInfoService')

export class VCPToolInfoService implements IBuiltinService {
  name = 'vcp_tool_info'
  displayName = '工具信息查询'
  description = '查询 VCP 工具的详细用法。配合 {{VCPToolCatalog}} 实现按需加载工具信息，大幅减少 token 消耗。'
  version = '1.0.0'
  type: 'builtin_service' = 'builtin_service'
  author = 'Cherry Studio'
  category = 'system'

  documentation = `
# VCP 工具信息查询服务

## 概述
提供按需查询工具详细用法的元工具，配合 \`{{VCPToolCatalog}}\` 占位符实现分层工具发现。

## 分层工具发现机制

### 第一层：工具目录
在 system prompt 中使用 \`{{VCPToolCatalog}}\` 注入精简的工具列表：
- 只包含工具名称和一句话描述
- Token 消耗约 500（相比完整描述的 10000+）

### 第二层：查询工具详情
当需要使用某个工具时，先调用 \`vcp_get_tool_info\` 获取详细用法：
\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_get_tool_info「末」,
name:「始」GoogleSearch「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`

### 第三层：调用工具
根据获取的详细用法，使用 VCP 协议调用具体工具。

## 优势
- 大幅减少 system prompt 的 token 消耗
- 按需加载，只获取实际需要的工具信息
- 避免 token 超限问题
`

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'GetToolInfo',
      description: '获取指定工具的详细用法，包括参数说明和调用示例',
      parameters: [
        {
          name: 'name',
          description: '工具名称（从工具目录中获取）',
          required: true,
          type: 'string'
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_tool_info「末」,
command:「始」GetToolInfo「末」,
name:「始」GoogleSearch「末」
<<<[END_TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'ListToolsByCategory',
      description: '列出指定分类下的所有工具',
      parameters: [
        {
          name: 'category',
          description: '工具分类（如 search, image, memory, file 等）',
          required: true,
          type: 'string'
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_tool_info「末」,
command:「始」ListToolsByCategory「末」,
category:「始」search「末」
<<<[END_TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'SearchTools',
      description: '根据关键词搜索相关工具',
      parameters: [
        {
          name: 'keyword',
          description: '搜索关键词',
          required: true,
          type: 'string'
        }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」vcp_tool_info「末」,
command:「始」SearchTools「末」,
keyword:「始」图片生成「末」
<<<[END_TOOL_REQUEST]>>>`
    }
  ]

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const normalizedCommand = command.toLowerCase().replace(/_/g, '')

    switch (normalizedCommand) {
      case 'gettoolinfo':
      case 'get_tool_info':
      case 'info':
        return this.getToolInfo(params.name as string)

      case 'listtoolsbycategory':
      case 'list_by_category':
      case 'category':
        return this.listToolsByCategory(params.category as string)

      case 'searchtools':
      case 'search':
        return this.searchTools(params.keyword as string)

      default:
        // 如果没有指定命令，默认查询工具信息
        if (params.name) {
          return this.getToolInfo(params.name as string)
        }
        return {
          success: false,
          error: `未知命令: ${command}。支持的命令: GetToolInfo, ListToolsByCategory, SearchTools`
        }
    }
  }

  /**
   * 获取工具详细信息
   */
  private async getToolInfo(toolName: string): Promise<BuiltinServiceResult> {
    if (!toolName) {
      return {
        success: false,
        error: '请提供工具名称（name 参数）'
      }
    }

    logger.debug('Getting tool info', { toolName })

    // 1. 先在内置服务中查找
    const builtinRegistry = getBuiltinServiceRegistry()
    const builtinService = builtinRegistry.get(toolName)

    if (builtinService) {
      const info = this.formatBuiltinServiceInfo(builtinService)
      return {
        success: true,
        output: info
      }
    }

    // 2. 在 VCP 插件中查找
    try {
      const { getVCPRuntime } = await import('../index')
      const runtime = getVCPRuntime()
      const plugin = runtime.getPlugin(toolName)

      if (plugin) {
        const info = this.formatPluginInfo(plugin)
        return {
          success: true,
          output: info
        }
      }
    } catch {
      // VCP Runtime 可能未初始化
    }

    // 3. 模糊匹配
    const similarTools = await this.findSimilarTools(toolName)
    if (similarTools.length > 0) {
      return {
        success: false,
        output: `未找到工具 "${toolName}"。\n\n相似工具：\n${similarTools.map((t) => `- ${t}`).join('\n')}`
      }
    }

    return {
      success: false,
      error: `未找到工具: ${toolName}`
    }
  }

  /**
   * 格式化内置服务信息
   */
  private formatBuiltinServiceInfo(service: IBuiltinService): string {
    const lines: string[] = []

    lines.push(`## ${service.displayName} (${service.name})`)
    lines.push('')
    lines.push(`**类型**: 内置服务`)
    lines.push(`**版本**: ${service.version}`)
    if (service.author) lines.push(`**作者**: ${service.author}`)
    if (service.category) lines.push(`**分类**: ${service.category}`)
    lines.push('')
    lines.push('### 描述')
    lines.push(service.description)
    lines.push('')

    if (service.toolDefinitions.length > 0) {
      lines.push('### 可用命令')
      lines.push('')

      for (const tool of service.toolDefinitions) {
        lines.push(`#### ${tool.commandIdentifier}`)
        lines.push(tool.description)
        lines.push('')

        if (tool.parameters && tool.parameters.length > 0) {
          lines.push('**参数:**')
          for (const param of tool.parameters) {
            const required = param.required ? '(必需)' : '(可选)'
            lines.push(`- \`${param.name}\` ${required}: ${param.description}`)
          }
          lines.push('')
        }

        if (tool.example) {
          lines.push('**调用示例:**')
          lines.push('```')
          lines.push(tool.example)
          lines.push('```')
          lines.push('')
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * 格式化 VCP 插件信息
   */
  private formatPluginInfo(plugin: any): string {
    const manifest = plugin.manifest
    const lines: string[] = []

    lines.push(`## ${manifest.displayName || manifest.name} (${manifest.name})`)
    lines.push('')
    lines.push(`**类型**: VCP 插件`)
    lines.push(`**版本**: ${manifest.version || '1.0.0'}`)
    if (manifest.author) lines.push(`**作者**: ${manifest.author}`)
    lines.push('')
    lines.push('### 描述')
    lines.push(manifest.description || '无描述')
    lines.push('')

    const capabilities = manifest.capabilities

    // 处理 invocationCommands
    if (capabilities?.invocationCommands && capabilities.invocationCommands.length > 0) {
      lines.push('### 可用命令')
      lines.push('')

      for (const cmd of capabilities.invocationCommands) {
        if (cmd.commandIdentifier) {
          lines.push(`#### ${cmd.commandIdentifier}`)
        }
        lines.push(cmd.description || '无描述')
        lines.push('')

        if (cmd.parameters && cmd.parameters.length > 0) {
          lines.push('**参数:**')
          for (const param of cmd.parameters) {
            const required = param.required ? '(必需)' : '(可选)'
            lines.push(`- \`${param.name}\` ${required}: ${param.description || '无描述'}`)
          }
          lines.push('')
        }

        if (cmd.example) {
          lines.push('**调用示例:**')
          lines.push('```')
          lines.push(cmd.example)
          lines.push('```')
          lines.push('')
        }
      }
    }

    // 处理 toolFunctions
    if (capabilities?.toolFunctions && capabilities.toolFunctions.length > 0) {
      lines.push('### 工具函数')
      lines.push('')

      for (const tool of capabilities.toolFunctions) {
        lines.push(`#### ${tool.name}`)
        lines.push(tool.description || '无描述')
        lines.push('')

        if (tool.parameters?.properties) {
          lines.push('**参数:**')
          for (const [name, prop] of Object.entries(tool.parameters.properties as Record<string, any>)) {
            const required = tool.parameters.required?.includes(name) ? '(必需)' : '(可选)'
            lines.push(`- \`${name}\` ${required}: ${prop.description || '无描述'}`)
          }
          lines.push('')
        }

        // 生成 VCP 调用示例
        lines.push('**VCP 调用格式:**')
        lines.push('```')
        lines.push('<<<[TOOL_REQUEST]>>>')
        lines.push(`tool_name:「始」${tool.name}「末」`)
        if (tool.parameters?.properties) {
          for (const name of Object.keys(tool.parameters.properties)) {
            lines.push(`${name}:「始」...「末」`)
          }
        }
        lines.push('<<<[END_TOOL_REQUEST]>>>')
        lines.push('```')
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /**
   * 按分类列出工具
   */
  private async listToolsByCategory(category: string): Promise<BuiltinServiceResult> {
    if (!category) {
      return {
        success: false,
        error: '请提供分类名称（category 参数）'
      }
    }

    const normalizedCategory = category.toLowerCase()
    const tools: string[] = []

    // 1. 从内置服务中筛选
    const builtinRegistry = getBuiltinServiceRegistry()
    for (const service of builtinRegistry.getAll()) {
      const serviceCategory = (service.category || '').toLowerCase()
      if (
        serviceCategory.includes(normalizedCategory) ||
        service.description.toLowerCase().includes(normalizedCategory)
      ) {
        tools.push(`- **${service.displayName}** [内置]: ${service.description.split('\n')[0].slice(0, 60)}`)
      }
    }

    // 2. 从 VCP 插件中筛选
    try {
      const { getVCPRuntime } = await import('../index')
      const runtime = getVCPRuntime()
      const plugins = runtime.getRegistry()?.getAllPlugins() || []

      for (const plugin of plugins) {
        if (!plugin.enabled) continue
        const pluginCategory = (plugin.manifest.category || '').toLowerCase()
        const pluginDesc = (plugin.manifest.description || '').toLowerCase()
        const pluginName = (plugin.manifest.name || '').toLowerCase()

        if (
          pluginCategory.includes(normalizedCategory) ||
          pluginDesc.includes(normalizedCategory) ||
          pluginName.includes(normalizedCategory)
        ) {
          const displayName = plugin.manifest.displayName || plugin.manifest.name
          const shortDesc = (plugin.manifest.description || '').split('\n')[0].slice(0, 60)
          tools.push(`- **${displayName}**: ${shortDesc}`)
        }
      }
    } catch {
      // VCP Runtime 可能未初始化
    }

    if (tools.length === 0) {
      return {
        success: true,
        output: `未找到分类为 "${category}" 的工具。\n\n常见分类: search, image, memory, file, system, ai, video, audio`
      }
    }

    return {
      success: true,
      output: `## 分类 "${category}" 下的工具 (${tools.length} 个)\n\n${tools.join('\n')}`
    }
  }

  /**
   * 搜索工具
   */
  private async searchTools(keyword: string): Promise<BuiltinServiceResult> {
    if (!keyword) {
      return {
        success: false,
        error: '请提供搜索关键词（keyword 参数）'
      }
    }

    const normalizedKeyword = keyword.toLowerCase()
    const results: Array<{ name: string; displayName: string; score: number; desc: string }> = []

    // 1. 从内置服务中搜索
    const builtinRegistry = getBuiltinServiceRegistry()
    for (const service of builtinRegistry.getAll()) {
      let score = 0
      const name = service.name.toLowerCase()
      const displayName = service.displayName.toLowerCase()
      const desc = service.description.toLowerCase()

      if (name.includes(normalizedKeyword)) score += 10
      if (displayName.includes(normalizedKeyword)) score += 8
      if (desc.includes(normalizedKeyword)) score += 3

      // 检查命令名称
      for (const tool of service.toolDefinitions) {
        if (tool.commandIdentifier.toLowerCase().includes(normalizedKeyword)) score += 5
        if (tool.description.toLowerCase().includes(normalizedKeyword)) score += 2
      }

      if (score > 0) {
        results.push({
          name: service.name,
          displayName: `${service.displayName} [内置]`,
          score,
          desc: service.description.split('\n')[0].slice(0, 60)
        })
      }
    }

    // 2. 从 VCP 插件中搜索
    try {
      const { getVCPRuntime } = await import('../index')
      const runtime = getVCPRuntime()
      const plugins = runtime.getRegistry()?.getAllPlugins() || []

      for (const plugin of plugins) {
        if (!plugin.enabled) continue

        let score = 0
        const name = plugin.manifest.name.toLowerCase()
        const displayName = (plugin.manifest.displayName || '').toLowerCase()
        const desc = (plugin.manifest.description || '').toLowerCase()

        if (name.includes(normalizedKeyword)) score += 10
        if (displayName.includes(normalizedKeyword)) score += 8
        if (desc.includes(normalizedKeyword)) score += 3

        if (score > 0) {
          results.push({
            name: plugin.manifest.name,
            displayName: plugin.manifest.displayName || plugin.manifest.name,
            score,
            desc: (plugin.manifest.description || '').split('\n')[0].slice(0, 60)
          })
        }
      }
    } catch {
      // VCP Runtime 可能未初始化
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    if (results.length === 0) {
      return {
        success: true,
        output: `未找到与 "${keyword}" 相关的工具。`
      }
    }

    const output = results
      .slice(0, 10)
      .map((r) => `- **${r.displayName}** (${r.name}): ${r.desc}`)
      .join('\n')

    return {
      success: true,
      output: `## 搜索 "${keyword}" 的结果 (${Math.min(results.length, 10)}/${results.length} 个)\n\n${output}\n\n使用 \`vcp_get_tool_info\` 获取具体工具的详细用法。`
    }
  }

  /**
   * 查找相似工具名称
   */
  private async findSimilarTools(toolName: string): Promise<string[]> {
    const normalizedName = toolName.toLowerCase()
    const similar: string[] = []

    // 从内置服务中查找
    const builtinRegistry = getBuiltinServiceRegistry()
    for (const service of builtinRegistry.getAll()) {
      const name = service.name.toLowerCase()
      const displayName = service.displayName.toLowerCase()

      if (name.includes(normalizedName) || normalizedName.includes(name)) {
        similar.push(`${service.displayName} (${service.name})`)
      } else if (displayName.includes(normalizedName) || normalizedName.includes(displayName)) {
        similar.push(`${service.displayName} (${service.name})`)
      }
    }

    // 从 VCP 插件中查找
    try {
      const { getVCPRuntime } = await import('../index')
      const runtime = getVCPRuntime()
      const plugins = runtime.getRegistry()?.getAllPlugins() || []

      for (const plugin of plugins) {
        if (!plugin.enabled) continue

        const name = plugin.manifest.name.toLowerCase()
        const displayName = (plugin.manifest.displayName || '').toLowerCase()

        if (name.includes(normalizedName) || normalizedName.includes(name)) {
          similar.push(plugin.manifest.displayName || plugin.manifest.name)
        } else if (displayName.includes(normalizedName) || normalizedName.includes(displayName)) {
          similar.push(plugin.manifest.displayName || plugin.manifest.name)
        }
      }
    } catch {
      // VCP Runtime 可能未初始化
    }

    return similar.slice(0, 5)
  }
}
