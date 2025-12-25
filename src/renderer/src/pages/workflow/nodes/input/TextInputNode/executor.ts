/**
 * 文本输入节点执行器 v2.0
 *
 * 深度优化版本，支持：
 * - 模板变量替换（多种语法）
 * - 多行文本处理
 * - 文本列表模式
 * - 文件读取模式
 * - 字符统计
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface TextInputConfig {
  // 输入模式
  inputMode?: 'text' | 'list' | 'file'
  // 直接输入
  text?: string
  defaultValue?: string
  // 文本列表
  textList?: string
  listSeparator?: 'newline' | 'comma' | 'semicolon' | 'tab' | 'custom'
  customSeparator?: string
  // 文件读取
  filePath?: string
  encoding?: string
  // 模板选项
  enableTemplate?: boolean
  templateSyntax?: 'mustache' | 'dollar' | 'percent'
  // 文本处理
  trimWhitespace?: boolean
  removeEmptyLines?: boolean
  maxLength?: number
  // 旧版兼容
  placeholder?: string
  multiline?: boolean
}

// 分隔符映射
const SEPARATOR_MAP: Record<string, string> = {
  newline: '\n',
  comma: ',',
  semicolon: ';',
  tab: '\t'
}

export class TextInputExecutor extends BaseNodeExecutor {
  constructor() {
    super('text_input')
  }

  async execute(
    inputs: Record<string, any>,
    config: TextInputConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '执行文本输入节点 v2.0')

      // 1. 获取原始文本
      let text = await this.getRawText(config, context)

      // 2. 应用模板变量替换
      if (config.enableTemplate !== false) {
        text = this.applyTemplate(text, inputs, config.templateSyntax || 'mustache')
      }

      // 3. 文本处理
      text = this.processText(text, config)

      // 4. 分割为行
      const lines = text.split('\n')
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0)

      // 5. 构建输出
      const outputs: Record<string, any> = {
        text,
        lines: nonEmptyLines,
        lineCount: String(nonEmptyLines.length),
        charCount: String(text.length),
        metadata: {
          inputMode: config.inputMode || 'text',
          totalLines: lines.length,
          nonEmptyLines: nonEmptyLines.length,
          charCount: text.length,
          wordCount: this.countWords(text),
          templateVariables: this.extractTemplateVariables(config.text || '', config.templateSyntax || 'mustache')
        }
      }

      const duration = Date.now() - startTime
      this.log(context, '文本输入完成', {
        charCount: text.length,
        lineCount: nonEmptyLines.length,
        duration: `${duration}ms`
      })

      return this.success(outputs, duration)
    } catch (error) {
      this.logError(context, '文本输入失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 获取原始文本
   */
  private async getRawText(config: TextInputConfig, context: NodeExecutionContext): Promise<string> {
    const inputMode = config.inputMode || 'text'

    switch (inputMode) {
      case 'text':
        return config.text || config.defaultValue || ''

      case 'list': {
        const listText = config.textList || ''
        const separator =
          config.listSeparator === 'custom'
            ? config.customSeparator || '\n'
            : SEPARATOR_MAP[config.listSeparator || 'newline'] || '\n'

        // 将列表转换为换行分隔的文本
        const items = listText.split(separator).map((item) => item.trim())
        return items.join('\n')
      }

      case 'file': {
        if (!config.filePath) {
          return ''
        }

        try {
          this.log(context, `读取文件: ${config.filePath}`)
          // 使用 Electron API 读取文件
          const content = await window.api?.fs?.read?.(config.filePath)
          if (content) {
            // 如果返回的是 Buffer，转换为字符串
            if (content instanceof Uint8Array || ArrayBuffer.isView(content)) {
              const decoder = new TextDecoder(config.encoding || 'utf-8')
              return decoder.decode(content)
            }
            return String(content)
          }
          return ''
        } catch (error) {
          this.log(context, `文件读取失败: ${error}`)
          throw new Error(`无法读取文件: ${config.filePath}`)
        }
      }

      default:
        return config.text || config.defaultValue || ''
    }
  }

  /**
   * 应用模板变量替换
   */
  private applyTemplate(text: string, inputs: Record<string, any>, syntax: string): string {
    if (!text) return text

    let result = text

    // 根据语法选择正则表达式
    let pattern: RegExp
    switch (syntax) {
      case 'dollar':
        pattern = /\$\{(\w+)\}/g
        break
      case 'percent':
        pattern = /%(\w+)%/g
        break
      case 'mustache':
      default:
        pattern = /\{\{(\w+)\}\}/g
        break
    }

    // 替换模板变量
    result = result.replace(pattern, (match, varName) => {
      // 检查输入中是否有对应的值
      if (inputs[varName] !== undefined && inputs[varName] !== null) {
        return String(inputs[varName])
      }
      // 检查 var_1, var_2, var_3 格式
      if (inputs[`var_${varName}`] !== undefined && inputs[`var_${varName}`] !== null) {
        return String(inputs[`var_${varName}`])
      }
      // 保留原始占位符
      return match
    })

    return result
  }

  /**
   * 处理文本
   */
  private processText(text: string, config: TextInputConfig): string {
    let result = text

    // 去除首尾空白
    if (config.trimWhitespace !== false) {
      result = result.trim()
    }

    // 移除空行
    if (config.removeEmptyLines) {
      result = result
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .join('\n')
    }

    // 限制最大长度
    if (config.maxLength && config.maxLength > 0 && result.length > config.maxLength) {
      result = result.substring(0, config.maxLength)
    }

    return result
  }

  /**
   * 统计单词数
   */
  private countWords(text: string): number {
    if (!text) return 0

    // 中文按字符计数，英文按单词计数
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length

    return chineseChars + englishWords
  }

  /**
   * 提取模板变量
   */
  private extractTemplateVariables(text: string, syntax: string): string[] {
    if (!text) return []

    let pattern: RegExp
    switch (syntax) {
      case 'dollar':
        pattern = /\$\{(\w+)\}/g
        break
      case 'percent':
        pattern = /%(\w+)%/g
        break
      case 'mustache':
      default:
        pattern = /\{\{(\w+)\}\}/g
        break
    }

    const variables: string[] = []
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    return variables
  }
}

export default TextInputExecutor
