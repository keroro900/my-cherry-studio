/**
 * ContentReplacer - 内容替换算法
 *
 * 移植自 Eclipse Theia 的 content-replacer.ts
 * 提供精确的字符串替换功能，支持多步匹配策略
 *
 * @license EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 * @see https://github.com/eclipse-theia/theia/blob/master/packages/core/src/common/content-replacer.ts
 */

/**
 * 替换操作定义
 */
export interface Replacement {
  /** 要被替换的原始内容 */
  oldContent: string
  /** 替换后的新内容 */
  newContent: string
  /** 是否替换所有匹配项 (默认 false，只替换第一个) */
  multiple?: boolean
}

/**
 * 替换结果
 */
export interface ReplacementResult {
  /** 替换后的内容 */
  updatedContent: string
  /** 错误消息列表 */
  errors: string[]
  /** 成功替换的数量 */
  successCount: number
  /** 失败的数量 */
  failCount: number
}

/**
 * 内容替换器接口
 */
export interface IContentReplacer {
  /**
   * 应用替换列表到原始内容
   * @param originalContent 原始文件内容
   * @param replacements 替换操作列表
   * @returns 替换结果
   */
  applyReplacements(originalContent: string, replacements: Replacement[]): ReplacementResult
}

/**
 * 内容替换器实现 (V1)
 *
 * 使用多步匹配策略：
 * 1. 精确匹配
 * 2. 去除空白后匹配
 */
export class ContentReplacer implements IContentReplacer {
  /**
   * 应用替换列表到原始内容
   */
  applyReplacements(originalContent: string, replacements: Replacement[]): ReplacementResult {
    let updatedContent = originalContent
    const errors: string[] = []
    let successCount = 0
    let failCount = 0

    // 检测冲突的替换：相同的 oldContent 对应不同的 newContent
    const conflictMap = new Map<string, string>()
    for (const replacement of replacements) {
      if (
        conflictMap.has(replacement.oldContent) &&
        conflictMap.get(replacement.oldContent) !== replacement.newContent
      ) {
        return {
          updatedContent: originalContent,
          errors: [`Conflicting replacement values for: "${this.truncate(replacement.oldContent)}"`],
          successCount: 0,
          failCount: replacements.length
        }
      }
      conflictMap.set(replacement.oldContent, replacement.newContent)
    }

    for (const { oldContent, newContent, multiple } of replacements) {
      // 空内容表示在文件开头插入
      if (oldContent === '') {
        updatedContent = newContent + updatedContent
        successCount++
        continue
      }

      // 第一步：尝试精确匹配
      let matchIndices = this.findExactMatches(updatedContent, oldContent)

      // 第二步：尝试去除行首尾空白后匹配
      if (matchIndices.length === 0) {
        matchIndices = this.findLineTrimmedMatches(updatedContent, oldContent)
      }

      if (matchIndices.length === 0) {
        errors.push(`Content to replace not found: "${this.truncate(oldContent)}"`)
        failCount++
      } else if (matchIndices.length > 1) {
        if (multiple) {
          updatedContent = this.replaceContentAll(updatedContent, oldContent, newContent)
          successCount++
        } else {
          errors.push(
            `Multiple occurrences (${matchIndices.length}) found for: "${this.truncate(oldContent)}". ` +
              `Set 'multiple' to true to replace all occurrences.`
          )
          failCount++
        }
      } else {
        updatedContent = this.replaceContentOnce(updatedContent, oldContent, newContent)
        successCount++
      }
    }

    return { updatedContent, errors, successCount, failCount }
  }

  /**
   * 查找所有精确匹配的位置
   */
  private findExactMatches(content: string, search: string): number[] {
    const indices: number[] = []
    let startIndex = 0

    while ((startIndex = content.indexOf(search, startIndex)) !== -1) {
      indices.push(startIndex)
      startIndex += search.length
    }

    return indices
  }

  /**
   * 尝试通过去除行首尾空白来匹配
   */
  private findLineTrimmedMatches(content: string, search: string): number[] {
    const trimmedSearch = search.trim()
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim()
      if (trimmedLine === trimmedSearch) {
        const startIndex = this.getLineStartIndex(content, i)
        return [startIndex]
      }
    }

    return []
  }

  /**
   * 获取指定行号在内容中的起始索引
   */
  private getLineStartIndex(content: string, lineNumber: number): number {
    const lines = content.split('\n')
    let index = 0
    for (let i = 0; i < lineNumber; i++) {
      index += lines[i].length + 1 // +1 for newline
    }
    return index
  }

  /**
   * 替换第一个匹配项
   */
  private replaceContentOnce(content: string, oldContent: string, newContent: string): string {
    const index = content.indexOf(oldContent)
    if (index === -1) return content
    return content.substring(0, index) + newContent + content.substring(index + oldContent.length)
  }

  /**
   * 替换所有匹配项
   */
  private replaceContentAll(content: string, oldContent: string, newContent: string): string {
    return content.split(oldContent).join(newContent)
  }

  /**
   * 截断过长的字符串用于错误消息显示
   */
  private truncate(str: string, maxLength: number = 50): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
  }
}

/**
 * 内容替换器 V2 - 增强版本
 *
 * 相比 V1，增加了：
 * - 模糊匹配（忽略连续空白差异）
 * - 上下文感知匹配
 */
export class ContentReplacerV2 implements IContentReplacer {
  applyReplacements(originalContent: string, replacements: Replacement[]): ReplacementResult {
    let updatedContent = originalContent
    const errors: string[] = []
    let successCount = 0
    let failCount = 0

    for (const { oldContent, newContent, multiple } of replacements) {
      if (oldContent === '') {
        updatedContent = newContent + updatedContent
        successCount++
        continue
      }

      // 尝试精确匹配
      let matchIndices = this.findExactMatches(updatedContent, oldContent)

      // 尝试标准化空白后匹配
      if (matchIndices.length === 0) {
        const normalizedSearch = this.normalizeWhitespace(oldContent)
        const normalizedContent = this.normalizeWhitespace(updatedContent)
        const normalizedIndex = normalizedContent.indexOf(normalizedSearch)

        if (normalizedIndex !== -1) {
          // 找到标准化匹配，尝试恢复原始位置
          const result = this.findOriginalPosition(updatedContent, oldContent, normalizedIndex)
          if (result) {
            matchIndices = [result.index]
          }
        }
      }

      // 尝试行级别模糊匹配
      if (matchIndices.length === 0) {
        matchIndices = this.findFuzzyLineMatches(updatedContent, oldContent)
      }

      if (matchIndices.length === 0) {
        errors.push(`Content to replace not found: "${this.truncate(oldContent)}"`)
        failCount++
      } else if (matchIndices.length > 1 && !multiple) {
        errors.push(`Multiple occurrences found for: "${this.truncate(oldContent)}"`)
        failCount++
      } else {
        if (multiple) {
          updatedContent = this.replaceAll(updatedContent, oldContent, newContent, matchIndices)
        } else {
          updatedContent = this.replaceAtIndex(updatedContent, matchIndices[0], oldContent.length, newContent)
        }
        successCount++
      }
    }

    return { updatedContent, errors, successCount, failCount }
  }

  private findExactMatches(content: string, search: string): number[] {
    const indices: number[] = []
    let startIndex = 0
    while ((startIndex = content.indexOf(search, startIndex)) !== -1) {
      indices.push(startIndex)
      startIndex += search.length
    }
    return indices
  }

  private normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim()
  }

  private findOriginalPosition(
    content: string,
    search: string,
    _normalizedIndex: number
  ): { index: number; length: number } | null {
    // 简化实现：按行搜索
    const searchLines = search.split('\n').map((l) => l.trim())
    const contentLines = content.split('\n')

    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
      let matches = true
      for (let j = 0; j < searchLines.length; j++) {
        if (contentLines[i + j].trim() !== searchLines[j]) {
          matches = false
          break
        }
      }
      if (matches) {
        // 计算开始索引
        let index = 0
        for (let k = 0; k < i; k++) {
          index += contentLines[k].length + 1
        }
        // 计算长度
        let length = 0
        for (let k = 0; k < searchLines.length; k++) {
          length += contentLines[i + k].length + 1
        }
        return { index, length: length - 1 }
      }
    }
    return null
  }

  private findFuzzyLineMatches(content: string, search: string): number[] {
    const searchLines = search
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const contentLines = content.split('\n')
    const indices: number[] = []

    outer: for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
      for (let j = 0; j < searchLines.length; j++) {
        if (contentLines[i + j].trim() !== searchLines[j]) {
          continue outer
        }
      }
      // 找到匹配
      let index = 0
      for (let k = 0; k < i; k++) {
        index += contentLines[k].length + 1
      }
      indices.push(index)
    }

    return indices
  }

  private replaceAtIndex(content: string, index: number, length: number, replacement: string): string {
    return content.substring(0, index) + replacement + content.substring(index + length)
  }

  private replaceAll(content: string, oldContent: string, newContent: string, _indices: number[]): string {
    return content.split(oldContent).join(newContent)
  }

  private truncate(str: string, maxLength: number = 50): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
  }
}

// 导出默认实例
export const contentReplacer = new ContentReplacer()
export const contentReplacerV2 = new ContentReplacerV2()
