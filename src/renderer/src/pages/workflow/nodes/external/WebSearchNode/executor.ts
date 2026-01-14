/**
 * Web Search Node Executor
 * 网络搜索节点执行器
 *
 * 使用 Cherry Studio 内置的 WebSearchService 执行搜索
 */

import WebSearchService from '@renderer/services/WebSearchService'
import store from '@renderer/store'
import type { WebSearchProvider, WebSearchProviderResponse } from '@renderer/types'

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { WebSearchNodeConfig, WebSearchResult } from './types'

export class WebSearchExecutor extends BaseNodeExecutor {
  constructor() {
    super('web_search')
  }

  async execute(
    inputs: Record<string, unknown>,
    config: WebSearchNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 获取查询输入
      const query = (inputs.query as string) || ''

      if (!query.trim()) {
        return this.error('搜索查询不能为空', Date.now() - startTime)
      }

      this.log(context, `开始搜索: "${query}"`)

      // 获取搜索提供商配置
      const { providers } = store.getState().websearch
      const provider = providers.find((p) => p.id === config.providerId)

      if (!provider) {
        return this.error(`未找到搜索提供商: ${config.providerId}`, Date.now() - startTime)
      }

      // 检查提供商是否可用
      if (!WebSearchService.isWebSearchEnabled(config.providerId)) {
        return this.error(`搜索提供商 ${config.providerId} 未配置或不可用`, Date.now() - startTime)
      }

      // 构建提供商配置
      const searchProvider: WebSearchProvider = {
        ...provider
      }

      // 执行搜索
      let response: WebSearchProviderResponse

      try {
        response = await WebSearchService.search(searchProvider, query)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        this.log(context, `搜索失败: ${errorMessage}`)
        return this.error(`搜索失败: ${errorMessage}`, Date.now() - startTime)
      }

      // 处理结果
      let results = response.results || []
      this.log(context, `搜索返回 ${results.length} 条结果`)

      // 限制结果数量
      if (config.maxResults && config.maxResults > 0) {
        results = results.slice(0, config.maxResults)
      }

      // 处理结果内容
      const processedResults: WebSearchResult[] = results.map((result, index) => {
        const processed: WebSearchResult = {
          ...result,
          index
        }

        // 截断内容
        if (config.contentMaxLength && result.content.length > config.contentMaxLength) {
          processed.truncatedContent = result.content.slice(0, config.contentMaxLength) + '...'
        }

        return processed
      })

      // 构建摘要文本
      const summaryText = processedResults
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.truncatedContent || r.content}\nURL: ${r.url}`)
        .join('\n\n')

      this.log(context, `搜索完成，返回 ${processedResults.length} 条结果`)

      return this.success(
        {
          results: processedResults,
          query: response.query || query,
          count: processedResults.length,
          success: true,
          summary: summaryText,
          urls: processedResults.map((r) => r.url),
          titles: processedResults.map((r) => r.title)
        },
        Date.now() - startTime
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.log(context, `执行错误: ${errorMessage}`)
      return this.error(errorMessage, Date.now() - startTime)
    }
  }
}
