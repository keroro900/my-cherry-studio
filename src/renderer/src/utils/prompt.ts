import { DEFAULT_SYSTEM_PROMPT } from '@cherrystudio/ai-core/built-in/plugins'
import { loggerService } from '@logger'
import store from '@renderer/store'
import type { MCPTool } from '@renderer/types'
import { containsVariables, getFestivalInfo, resolveBasicSyncVariables } from '@shared/variables'
import * as lunarCalendar from 'chinese-lunar-calendar'

const logger = loggerService.withContext('Utils:Prompt')

export { DEFAULT_SYSTEM_PROMPT as SYSTEM_PROMPT }

export const THINK_TOOL_PROMPT = `{{ USER_SYSTEM_PROMPT }}`

export const ToolUseExamples = `
Here are a few examples using notional tools:
---
User: Generate an image of the oldest person in this document.

Assistant: I can use the document_qa tool to find out who the oldest person is in the document.
<tool_use>
  <name>document_qa</name>
  <arguments>{"document": "document.pdf", "question": "Who is the oldest person mentioned?"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>document_qa</name>
  <result>John Doe, a 55 year old lumberjack living in Newfoundland.</result>
</tool_use_result>

Assistant: I can use the image_generator tool to create a portrait of John Doe.
<tool_use>
  <name>image_generator</name>
  <arguments>{"prompt": "A portrait of John Doe, a 55-year-old man living in Canada."}</arguments>
</tool_use>

User: <tool_use_result>
  <name>image_generator</name>
  <result>image.png</result>
</tool_use_result>

Assistant: the image is generated as image.png

---
User: "What is the result of the following operation: 5 + 3 + 1294.678?"

Assistant: I can use the python_interpreter tool to calculate the result of the operation.
<tool_use>
  <name>python_interpreter</name>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>python_interpreter</name>
  <result>1302.678</result>
</tool_use_result>

Assistant: The result of the operation is 1302.678.

---
User: "Which city has the highest population , Guangzhou or Shanghai?"

Assistant: I can use the search tool to find the population of Guangzhou.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Guangzhou"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>Guangzhou has a population of 15 million inhabitants as of 2021.</result>
</tool_use_result>

Assistant: I can use the search tool to find the population of Shanghai.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Shanghai"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>26 million (2019)</result>
</tool_use_result>
Assistant: The population of Shanghai is 26 million, while Guangzhou has a population of 15 million. Therefore, Shanghai has the highest population.
`

export const AvailableTools = (tools: MCPTool[]) => {
  const availableTools = tools
    .map((tool) => {
      return `
<tool>
  <name>${tool.id}</name>
  <description>${tool.description}</description>
  <arguments>
    ${tool.inputSchema ? JSON.stringify(tool.inputSchema) : ''}
  </arguments>
</tool>
`
    })
    .join('\n')
  return `<tools>
${availableTools}
</tools>`
}

const supportedVariables = [
  // ==================== VCP 标准变量（首字母大写） ====================
  '{{Date}}',        // 当前日期，格式：YYYY/M/D
  '{{Time}}',        // 当前时间，格式：HH:mm:ss
  '{{Today}}',       // 完整日期描述，如：2025年1月2日 星期四
  '{{Year}}',        // 当前年份
  '{{Month}}',       // 当前月份（01-12）
  '{{Day}}',         // 当前日期（01-31）
  '{{Hour}}',        // 当前小时（00-23）
  '{{Minute}}',      // 当前分钟（00-59）
  '{{Weekday}}',     // 当前星期几（日/一/二/三/四/五/六）
  '{{Username}}',    // 用户名
  '{{System}}',      // 系统类型
  '{{Language}}',    // 语言设置
  '{{Arch}}',        // 系统架构
  '{{ModelName}}',   // 模型名称
  '{{Lunar}}',       // 农历
  '{{Greeting}}',    // 问候语
  '{{Stickers}}',    // 表情包
  '{{Festival}}',    // 农历日期、生肖、节气
  // ==================== 兼容旧版小写变量（映射到 VCP 格式） ====================
  '{{date}}',        // -> {{Date}}
  '{{time}}',        // -> {{Time}}
  '{{datetime}}',    // -> {{Today}}
  '{{weekday}}',     // -> {{Weekday}}
  '{{username}}',    // -> {{Username}}
  '{{system}}',      // -> {{System}}
  '{{language}}',    // -> {{Language}}
  '{{arch}}',        // -> {{Arch}}
  '{{model_name}}',  // -> {{ModelName}}
  '{{lunar}}',       // -> {{Lunar}}
  '{{greeting}}',    // -> {{Greeting}}
  '{{stickers}}',    // -> {{Stickers}}
  // ==================== 中文别名 ====================
  '{{农历}}',        // -> {{Lunar}}
  '{{问候语}}',      // -> {{Greeting}}
  '{{星期}}',        // -> {{Weekday}}
  '{{表情包}}'       // -> {{Stickers}}
]

// Helper: Get lunar calendar info
function getLunarInfo(): string {
  try {
    const now = new Date()
    const lunar = lunarCalendar.getLunar(now.getFullYear(), now.getMonth() + 1, now.getDate())
    // Format: 甲辰龙年·腊月初十
    return `${lunar.yearCyl}${lunar.zodiac}年·${lunar.dateStr}`
  } catch {
    return ''
  }
}

export const containsSupportedVariables = (userSystemPrompt: string): boolean => {
  // 使用共享模块的检测函数
  return containsVariables(userSystemPrompt) ||
    supportedVariables.some((variable) => userSystemPrompt.includes(variable))
}

export const replacePromptVariables = async (userSystemPrompt: string, modelName?: string): Promise<string> => {
  if (typeof userSystemPrompt !== 'string') {
    logger.warn('User system prompt is not a string:', userSystemPrompt)
    return userSystemPrompt
  }

  // ==================== 使用共享模块解析基础同步变量 ====================
  // 日期时间变量、问候语等由共享模块统一处理
  const basicResult = resolveBasicSyncVariables(userSystemPrompt, { modelName })
  userSystemPrompt = basicResult.text

  // ==================== 处理需要异步获取的变量 ====================

  // 1. 农历变量（需要 lunar 库，保留在 renderer）
  if (userSystemPrompt.includes('{{Lunar}}') || userSystemPrompt.includes('{{lunar}}') || userSystemPrompt.includes('{{农历}}')) {
    const lunarInfo = getLunarInfo() || '[农历信息不可用]'
    userSystemPrompt = userSystemPrompt
      .replace(/\{\{Lunar\}\}/g, lunarInfo)
      .replace(/\{\{lunar\}\}/g, lunarInfo)
      .replace(/\{\{农历\}\}/g, lunarInfo)
  }

  // 1.5 Festival 变量（农历日期、生肖、节气）
  if (userSystemPrompt.includes('{{Festival}}')) {
    try {
      // 先尝试获取公历节日
      let festivalInfo = getFestivalInfo()

      // 如果没有公历节日，获取农历信息
      if (!festivalInfo) {
        const lunarInfo = getLunarInfo()
        if (lunarInfo) {
          festivalInfo = lunarInfo
        }
      } else {
        // 如果有公历节日，附加农历信息
        const lunarInfo = getLunarInfo()
        if (lunarInfo) {
          festivalInfo = `${festivalInfo} · ${lunarInfo}`
        }
      }

      userSystemPrompt = userSystemPrompt.replace(/\{\{Festival\}\}/g, festivalInfo || '[节日信息不可用]')
    } catch (error) {
      logger.error('Failed to get festival info:', error as Error)
      userSystemPrompt = userSystemPrompt.replace(/\{\{Festival\}\}/g, '[节日信息不可用]')
    }
  }

  // 2. 用户名变量
  if (userSystemPrompt.includes('{{Username}}') || userSystemPrompt.includes('{{username}}')) {
    try {
      const userName = store.getState().settings.userName || 'Unknown Username'
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Username\}\}/g, userName)
        .replace(/\{\{username\}\}/g, userName)
    } catch (error) {
      logger.error('Failed to get username:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Username\}\}/g, 'Unknown Username')
        .replace(/\{\{username\}\}/g, 'Unknown Username')
    }
  }

  // 3. 系统信息变量
  if (userSystemPrompt.includes('{{System}}') || userSystemPrompt.includes('{{system}}')) {
    try {
      const systemType = await window.api.system.getDeviceType()
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{System\}\}/g, systemType)
        .replace(/\{\{system\}\}/g, systemType)
    } catch (error) {
      logger.error('Failed to get system type:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{System\}\}/g, 'Unknown System')
        .replace(/\{\{system\}\}/g, 'Unknown System')
    }
  }

  // 4. 语言设置变量
  if (userSystemPrompt.includes('{{Language}}') || userSystemPrompt.includes('{{language}}')) {
    try {
      const language = store.getState().settings.language
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Language\}\}/g, language)
        .replace(/\{\{language\}\}/g, language)
    } catch (error) {
      logger.error('Failed to get language:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Language\}\}/g, 'Unknown Language')
        .replace(/\{\{language\}\}/g, 'Unknown Language')
    }
  }

  // 5. 系统架构变量
  if (userSystemPrompt.includes('{{Arch}}') || userSystemPrompt.includes('{{arch}}')) {
    try {
      const appInfo = await window.api.getAppInfo()
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Arch\}\}/g, appInfo.arch)
        .replace(/\{\{arch\}\}/g, appInfo.arch)
    } catch (error) {
      logger.error('Failed to get architecture:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Arch\}\}/g, 'Unknown Architecture')
        .replace(/\{\{arch\}\}/g, 'Unknown Architecture')
    }
  }

  // 6. 模型名称变量（如果共享模块未处理）
  if (userSystemPrompt.includes('{{ModelName}}') || userSystemPrompt.includes('{{model_name}}')) {
    try {
      const name = modelName || store.getState().llm.defaultModel?.name || 'Unknown Model'
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{ModelName\}\}/g, name)
        .replace(/\{\{model_name\}\}/g, name)
    } catch (error) {
      logger.error('Failed to get model name:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{ModelName\}\}/g, 'Unknown Model')
        .replace(/\{\{model_name\}\}/g, 'Unknown Model')
    }
  }

  // 7. 表情包变量
  if (userSystemPrompt.includes('{{Stickers}}') || userSystemPrompt.includes('{{stickers}}') || userSystemPrompt.includes('{{表情包}}')) {
    try {
      const [stickerList, stickerDir] = await Promise.all([
        window.api.sticker.getListForPrompt(),
        window.api.sticker.getDirPath()
      ])

      if (stickerList) {
        const stickerInstruction = `可用表情包（使用 ![表情名](file://${stickerDir}/包名/文件名) 格式发送）:\n${stickerList}`
        userSystemPrompt = userSystemPrompt
          .replace(/\{\{Stickers\}\}/g, stickerInstruction)
          .replace(/\{\{stickers\}\}/g, stickerInstruction)
          .replace(/\{\{表情包\}\}/g, stickerInstruction)
      } else {
        userSystemPrompt = userSystemPrompt
          .replace(/\{\{Stickers\}\}/g, '[无可用表情包]')
          .replace(/\{\{stickers\}\}/g, '[无可用表情包]')
          .replace(/\{\{表情包\}\}/g, '[无可用表情包]')
      }
    } catch (error) {
      logger.error('Failed to get sticker list:', error as Error)
      userSystemPrompt = userSystemPrompt
        .replace(/\{\{Stickers\}\}/g, '[表情包加载失败]')
        .replace(/\{\{stickers\}\}/g, '[表情包加载失败]')
        .replace(/\{\{表情包\}\}/g, '[表情包加载失败]')
    }
  }

  // 8. 动态表情包变量 {{xx表情包}} - 匹配特定表情包名称
  // 格式：{{通用表情包}}、{{猫咪表情包}} 等，返回该表情包的图片文件名列表（以 | 分隔）
  const dynamicStickerPattern = /\{\{(.+?)表情包\}\}/g
  const dynamicStickerMatches = userSystemPrompt.match(dynamicStickerPattern)
  if (dynamicStickerMatches && dynamicStickerMatches.length > 0) {
    try {
      const stickerDir = await window.api.sticker.getDirPath()

      for (const match of dynamicStickerMatches) {
        // 跳过已处理的通用表情包变量
        if (match === '{{表情包}}') continue

        // 提取表情包名称
        const packName = match.replace(/\{\{(.+?)表情包\}\}/, '$1')

        try {
          // 获取该表情包的文件列表
          const files = await window.api.sticker.getPackFiles(packName)
          if (files && files.length > 0) {
            // 返回文件名列表，以 | 分隔，符合 VCPToolBox 格式
            const fileList = files.join('|')
            userSystemPrompt = userSystemPrompt.replace(
              new RegExp(`\\{\\{${packName}表情包\\}\\}`, 'g'),
              `表情包[${packName}]文件列表(使用 ![](file://${stickerDir}/${packName}/文件名) 发送): ${fileList}`
            )
          } else {
            userSystemPrompt = userSystemPrompt.replace(
              new RegExp(`\\{\\{${packName}表情包\\}\\}`, 'g'),
              `[表情包"${packName}"不存在或为空]`
            )
          }
        } catch {
          userSystemPrompt = userSystemPrompt.replace(
            new RegExp(`\\{\\{${packName}表情包\\}\\}`, 'g'),
            `[表情包"${packName}"加载失败]`
          )
        }
      }
    } catch (error) {
      logger.error('Failed to process dynamic sticker packs:', error as Error)
    }
  }

  // 9. Agent 模板变量 {{Agent:助手名}} - 获取助手的系统提示词
  // 格式：{{Agent:Nova}}、{{Agent:翻译助手}} 等
  const agentTemplatePattern = /\{\{Agent:([^:}]+)(?::([^}]*))?\}\}/g
  const agentMatches = userSystemPrompt.match(agentTemplatePattern)
  if (agentMatches && agentMatches.length > 0) {
    try {
      // 调用 VCP 占位符解析器处理 Agent 变量
      const result = await window.api.vcpPlaceholder.resolve(userSystemPrompt)
      if (result.success && result.result) {
        userSystemPrompt = result.result
      }
    } catch (error) {
      logger.error('Failed to resolve Agent template variables:', error as Error)
      // 替换为错误提示
      for (const match of agentMatches) {
        const agentName = match.replace(/\{\{Agent:([^:}]+)(?::([^}]*))?\}\}/, '$1')
        userSystemPrompt = userSystemPrompt.replace(
          match,
          `[Agent "${agentName}" 模板加载失败]`
        )
      }
    }
  }

  return userSystemPrompt
}

export const buildSystemPromptWithTools = (userSystemPrompt: string, tools?: MCPTool[]): string => {
  if (tools && tools.length > 0) {
    return DEFAULT_SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt || '')
      .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
      .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools))
  }
  return userSystemPrompt
}

export const buildSystemPromptWithThinkTool = (userSystemPrompt: string): string => {
  return THINK_TOOL_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt || '')
}
