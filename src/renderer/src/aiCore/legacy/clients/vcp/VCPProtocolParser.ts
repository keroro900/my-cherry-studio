import { loggerService } from '@logger'

import type { VCPToolRequest } from './types'
import { VCP_MARKERS } from './types'

const { PARAM_START, PARAM_END } = VCP_MARKERS

const logger = loggerService.withContext('VCPProtocolParser')

/**
 * 正则表达式匹配 2-3 个 < 和 > 的 TOOL_REQUEST 标记
 * 兼容格式:
 * - <<[TOOL_REQUEST]>> (2个 <)
 * - <<<[TOOL_REQUEST]>>> (3个 <)
 * - <<[END_TOOL_REQUEST]>> / <<<[END_TOOL_REQUEST]>>>
 */
const FLEXIBLE_TOOL_REQUEST_REGEX = /<<<?(?:\[TOOL_REQUEST\])>>>?([\s\S]*?)<<<?(?:\[END_TOOL_REQUEST\])>>>?/g

/**
 * Parses VCP TOOL_REQUEST protocol from AI response text.
 * Supports the VCPToolBox format with 「始」...「末」 delimiters.
 */
export class VCPProtocolParser {
  /**
   * Parse all tool requests from text
   *
   * @param text - The AI response text to parse
   * @returns Array of parsed tool requests
   */
  public parseToolRequests(text: string): VCPToolRequest[] {
    const requests: VCPToolRequest[] = []

    // 使用灵活格式正则表达式，统一处理 2-3 个 < 的所有情况
    // 这样可以处理混合模式（例如 <<[TOOL_REQUEST]>> 开始，<<<[END_TOOL_REQUEST]>>> 结束）
    FLEXIBLE_TOOL_REQUEST_REGEX.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = FLEXIBLE_TOOL_REQUEST_REGEX.exec(text)) !== null) {
      const blockContent = match[1].trim()
      const startIndex = match.index
      const endIndex = match.index + match[0].length

      const parsed = this.parseBlockContent(blockContent)

      if (parsed.toolName) {
        logger.debug('Parsed VCP request', {
          toolName: parsed.toolName,
          params: Object.keys(parsed.params),
          matchedText: match[0].substring(0, 80),
          startIndex,
          endIndex
        })
        requests.push({
          ...parsed,
          rawText: match[0],
          startIndex,
          endIndex
        })
      } else {
        // 详细日志以便调试
        logger.warn('Parsed block without tool_name', {
          preview: blockContent.substring(0, 200),
          blockContentLength: blockContent.length,
          firstLine: blockContent.split('\n')[0],
          hasParamStart: blockContent.includes(PARAM_START),
          hasParamEnd: blockContent.includes(PARAM_END),
          parsedParams: Object.keys(parsed.params),
          parsedParamsValues: parsed.params
        })
      }
    }

    if (requests.length > 0) {
      logger.info(`Parsed ${requests.length} VCP tool request(s)`, {
        tools: requests.map((r) => r.toolName)
      })
    }

    return requests
  }

  /**
   * Parse block content to extract tool name and parameters
   */
  private parseBlockContent(content: string): Omit<VCPToolRequest, 'rawText' | 'startIndex' | 'endIndex'> {
    const { PARAM_START, PARAM_END } = VCP_MARKERS
    const params: Record<string, string> = {}
    let toolName = ''
    let archery = false

    // 添加调试日志查看原始内容
    logger.debug('[VCP-Parse] Parsing block content', {
      contentLength: content.length,
      firstLine: content.split('\n')[0],
      hasParamStart: content.includes(PARAM_START),
      hasParamEnd: content.includes(PARAM_END),
      paramStartCodePoints: Array.from(PARAM_START).map(c => c.codePointAt(0)),
      paramEndCodePoints: Array.from(PARAM_END).map(c => c.codePointAt(0))
    })

    // State machine for multi-line parameter parsing
    type ParseState = 'idle' | 'in_block'
    let state: ParseState = 'idle'
    let currentKey = ''
    let currentValue = ''

    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      if (state === 'idle') {
        if (!trimmed) continue

        // Match: key:「始」... (支持全角冒号)
        const blockStartMatch = trimmed.match(/^([\w_-]+)\s*[:：]\s*「始」(.*)$/)
        if (blockStartMatch) {
          const [, key, rest] = blockStartMatch
          currentKey = this.normalizeKey(key)

          // Check if single-line: key:「始」value「末」 (处理行尾逗号)
          const restClean = rest.replace(/[,，]\s*$/, '')
          if (restClean.endsWith(PARAM_END)) {
            const value = restClean.slice(0, -PARAM_END.length).trim()
            this.setParam(
              currentKey,
              value,
              params,
              (name) => {
                toolName = name
              },
              (val) => {
                archery = val
              }
            )
            currentKey = ''
            currentValue = ''
          } else {
            // Multi-line block
            state = 'in_block'
            currentValue = rest
          }
          continue
        }

        // Match simple format: key: value (without delimiters, 支持全角冒号)
        const simpleMatch = trimmed.match(/^([\w_-]+)\s*[:：]\s*(.+)$/)
        if (simpleMatch && !simpleMatch[2].startsWith(PARAM_START)) {
          const [, key, value] = simpleMatch
          const normalizedKey = this.normalizeKey(key)
          this.setParam(
            normalizedKey,
            value.trim(),
            params,
            (name) => {
              toolName = name
            },
            (val) => {
              archery = val
            }
          )
        }
      } else if (state === 'in_block') {
        const endPos = line.indexOf(PARAM_END)

        if (endPos !== -1) {
          // Found end marker
          const beforeEnd = line.slice(0, endPos)
          currentValue = currentValue ? currentValue + '\n' + beforeEnd : beforeEnd

          this.setParam(
            currentKey,
            currentValue.trim(),
            params,
            (name) => {
              toolName = name
            },
            (val) => {
              archery = val
            }
          )

          currentKey = ''
          currentValue = ''
          state = 'idle'
        } else {
          // Continue accumulating
          currentValue = currentValue ? currentValue + '\n' + line : line
        }
      }
    }

    // Handle unclosed block
    if (state === 'in_block' && currentKey && currentValue) {
      logger.warn('Unclosed VCP block, using accumulated value')
      this.setParam(
        currentKey,
        currentValue.trim(),
        params,
        (name) => {
          toolName = name
        },
        (val) => {
          archery = val
        }
      )
    }

    return { toolName, params, archery }
  }

  /**
   * Normalize parameter key to snake_case (对齐 vcpContextPlugin.normalizeVCPKey)
   * 支持: camelCase, PascalCase, kebab-case, UPPER_CASE → snake_case
   */
  private normalizeKey(key: string): string {
    return key
      // 在大写字母前插入下划线 (处理 camelCase 和 PascalCase)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      // 将连字符转为下划线
      .replace(/-/g, '_')
      // 转为小写
      .toLowerCase()
      // 移除重复的下划线
      .replace(/_+/g, '_')
      // 移除首尾下划线
      .replace(/^_|_$/g, '')
  }

  /**
   * Set parameter or special values
   */
  private setParam(
    key: string,
    value: string,
    params: Record<string, string>,
    setToolName: (name: string) => void,
    setArchery: (val: boolean) => void
  ): void {
    // 支持多种工具名称键的变体（tool_name, toolname, plugin_name, pluginname）
    const normalizedKey = key.replace(/_/g, '')
    if (normalizedKey === 'toolname' || normalizedKey === 'pluginname') {
      setToolName(value)
    } else if (key === 'archery') {
      setArchery(value === 'true' || value === 'no_reply')
    } else {
      params[key] = value
    }
  }

  /**
   * Format tool result for response
   *
   * @param toolName - Name of the tool
   * @param result - The result or error
   * @param success - Whether the execution was successful
   * @returns Formatted result string
   */
  public formatToolResult(toolName: string, result: unknown, success: boolean): string {
    const { TOOL_RESULT, TOOL_RESULT_END, TOOL_ERROR, TOOL_ERROR_END } = VCP_MARKERS

    if (success) {
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      return `${TOOL_RESULT}\n[${toolName}]\n${resultStr}\n${TOOL_RESULT_END}`
    } else {
      const errorStr = result instanceof Error ? result.message : String(result)
      return `${TOOL_ERROR}\nTool ${toolName} execution failed: ${errorStr}\n${TOOL_ERROR_END}`
    }
  }

  /**
   * Check if text contains VCP tool requests
   * 支持 2个和3个 < 的格式，以及混合模式（开始和结束标记可以使用不同数量的 <）
   *
   * @param text - Text to check
   * @returns true if tool requests are present
   */
  public hasToolRequests(text: string): boolean {
    // 检查是否有开始标记（2个或3个 <）
    const hasStart =
      text.includes(VCP_MARKERS.TOOL_REQUEST_START) || // <<<[TOOL_REQUEST]>>>
      text.includes('<<[TOOL_REQUEST]>>') // <<[TOOL_REQUEST]>>

    // 检查是否有结束标记（2个或3个 <）
    const hasEnd =
      text.includes(VCP_MARKERS.TOOL_REQUEST_END) || // <<<[END_TOOL_REQUEST]>>>
      text.includes('<<[END_TOOL_REQUEST]>>') // <<[END_TOOL_REQUEST]>>

    // 开始和结束标记都存在即可（支持混合模式）
    return hasStart && hasEnd
  }

  /**
   * Remove all tool request blocks from text
   *
   * @param text - Text to clean
   * @returns Text with tool request blocks removed
   */
  public removeToolRequestBlocks(text: string): string {
    const requests = this.parseToolRequests(text)
    if (requests.length === 0) {
      return text
    }

    // Sort by startIndex descending to remove from end first
    const sorted = [...requests].sort((a, b) => b.startIndex - a.startIndex)

    let result = text
    for (const request of sorted) {
      result = result.substring(0, request.startIndex) + result.substring(request.endIndex)
    }

    return result.trim()
  }
}

/**
 * Singleton instance of VCPProtocolParser
 */
export const vcpProtocolParser = new VCPProtocolParser()
