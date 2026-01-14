/**
 * Web Search Node
 * 网络搜索节点
 *
 * 支持多种搜索引擎：
 * - Tavily (推荐，专为 AI 优化)
 * - Google (本地浏览器)
 * - Bing (本地浏览器)
 * - Baidu (本地浏览器)
 * - SearXNG (自托管)
 * - Exa (语义搜索)
 */

import type { NodeDefinition } from '../../base/types'
import { WebSearchExecutor } from './executor'

export const WebSearchNode: NodeDefinition = {
  metadata: {
    type: 'web_search',
    label: '网络搜索',
    icon: '🔍',
    category: 'external',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '执行网络搜索，获取实时信息（支持 Tavily、Google、Bing 等）',
    tags: ['external', 'search', 'web', 'tavily', 'google', 'bing', 'internet']
  },

  inputs: [
    {
      id: 'query',
      label: '搜索查询',
      dataType: 'text',
      required: true,
      description: '要搜索的关键词或问题'
    },
    {
      id: 'variables',
      label: '变量',
      dataType: 'json',
      required: false,
      description: '用于查询中的变量插值 {{key}}'
    }
  ],

  outputs: [
    {
      id: 'results',
      label: '搜索结果',
      dataType: 'json',
      description: '搜索结果数组 [{title, content, url}]'
    },
    {
      id: 'query',
      label: '查询',
      dataType: 'text',
      description: '实际执行的搜索查询'
    },
    {
      id: 'count',
      label: '结果数量',
      dataType: 'number',
      description: '返回的搜索结果数量'
    },
    {
      id: 'success',
      label: '是否成功',
      dataType: 'boolean',
      description: '搜索是否成功'
    },
    {
      id: 'summary',
      label: '结果摘要',
      dataType: 'text',
      description: '格式化的搜索结果摘要文本'
    },
    {
      id: 'urls',
      label: 'URL 列表',
      dataType: 'json',
      description: '所有结果的 URL 数组'
    },
    {
      id: 'titles',
      label: '标题列表',
      dataType: 'json',
      description: '所有结果的标题数组'
    }
  ],

  configSchema: {
    fields: [
      // ========== 基本配置 ==========
      {
        key: 'providerId',
        label: '搜索引擎',
        type: 'select',
        required: true,
        default: 'tavily',
        options: [
          { label: 'Tavily (AI 优化)', value: 'tavily' },
          { label: 'Google (本地)', value: 'local-google' },
          { label: 'Bing (本地)', value: 'local-bing' },
          { label: 'Baidu (本地)', value: 'local-baidu' },
          { label: 'SearXNG', value: 'searxng' },
          { label: 'Exa (语义搜索)', value: 'exa' },
          { label: 'Exa MCP', value: 'exa-mcp' },
          { label: 'Bocha', value: 'bocha' },
          { label: 'Zhipu', value: 'zhipu' }
        ],
        description: '选择网络搜索引擎（需要在设置中配置 API Key）'
      },

      // ========== 结果配置 ==========
      {
        key: 'maxResults',
        label: '最大结果数',
        type: 'number',
        required: false,
        default: 5,
        min: 1,
        max: 20,
        description: '返回的最大搜索结果数量'
      },
      {
        key: 'contentMaxLength',
        label: '内容最大长度',
        type: 'number',
        required: false,
        default: 1000,
        min: 100,
        max: 10000,
        description: '每条结果内容的最大字符数（超过会截断）'
      },

      // ========== 高级配置 ==========
      {
        key: 'searchWithTime',
        label: '时间上下文',
        type: 'checkbox',
        default: false,
        description: '在搜索时自动添加当前日期上下文'
      },
      {
        key: 'returnRawResults',
        label: '返回原始结果',
        type: 'checkbox',
        default: false,
        description: '在输出中包含原始 API 响应'
      },
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        required: false,
        default: 30,
        min: 5,
        max: 120,
        description: '搜索超时时间（秒）'
      },

      // ========== 地区配置 ==========
      {
        key: 'language',
        label: '搜索语言',
        type: 'select',
        required: false,
        options: [
          { label: '自动', value: '' },
          { label: '中文', value: 'zh' },
          { label: 'English', value: 'en' },
          { label: '日本語', value: 'ja' },
          { label: '한국어', value: 'ko' }
        ],
        description: '搜索结果的首选语言'
      },
      {
        key: 'region',
        label: '搜索地区',
        type: 'select',
        required: false,
        options: [
          { label: '全球', value: '' },
          { label: '中国', value: 'cn' },
          { label: '美国', value: 'us' },
          { label: '日本', value: 'jp' },
          { label: '韩国', value: 'kr' }
        ],
        description: '搜索结果的首选地区'
      }
    ]
  },

  defaultConfig: {
    providerId: 'tavily',
    maxResults: 5,
    contentMaxLength: 1000,
    searchWithTime: false,
    returnRawResults: false,
    timeout: 30,
    language: '',
    region: ''
  },

  executor: new WebSearchExecutor()
}

export { WebSearchExecutor } from './executor'
export default WebSearchNode
