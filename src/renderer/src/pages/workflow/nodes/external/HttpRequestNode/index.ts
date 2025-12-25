/**
 * HTTP 请求节点
 * HTTP Request Node
 *
 * 通用 HTTP API 调用节点：
 * - 支持 GET/POST/PUT/DELETE/PATCH 方法
 * - 支持自定义 Headers
 * - 支持 JSON/Form/Raw 请求体
 * - 支持响应解析和错误处理
 * - 支持变量插值
 */

import type { NodeDefinition } from '../../base/types'
import { HttpRequestExecutor } from './executor'

export const HttpRequestNode: NodeDefinition = {
  metadata: {
    type: 'http_request',
    label: 'HTTP 请求',
    icon: '🌐',
    category: 'external',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '调用外部 HTTP API，支持 RESTful 接口和 Webhook',
    tags: ['external', 'http', 'api', 'request', 'webhook', 'rest']
  },

  inputs: [
    {
      id: 'url',
      label: 'URL',
      dataType: 'text',
      required: false,
      description: '请求 URL（可覆盖配置中的 URL）'
    },
    {
      id: 'body',
      label: '请求体',
      dataType: 'json',
      required: false,
      description: '请求体数据（JSON 格式）'
    },
    {
      id: 'headers',
      label: 'Headers',
      dataType: 'json',
      required: false,
      description: '自定义请求头（可覆盖配置中的 Headers）'
    },
    {
      id: 'variables',
      label: '变量',
      dataType: 'json',
      required: false,
      description: '用于 URL 和请求体中的变量插值 {{key}}'
    }
  ],

  outputs: [
    {
      id: 'response',
      label: '响应体',
      dataType: 'json',
      description: '完整响应数据'
    },
    {
      id: 'data',
      label: '响应数据',
      dataType: 'json',
      description: '解析后的响应数据（JSON）'
    },
    {
      id: 'text',
      label: '响应文本',
      dataType: 'text',
      description: '原始响应文本'
    },
    {
      id: 'status',
      label: '状态码',
      dataType: 'number',
      description: 'HTTP 状态码'
    },
    {
      id: 'headers',
      label: '响应头',
      dataType: 'json',
      description: '响应 Headers'
    },
    {
      id: 'success',
      label: '是否成功',
      dataType: 'boolean',
      description: '请求是否成功（2xx 状态码）'
    }
  ],

  configSchema: {
    fields: [
      // ========== 基本配置 ==========
      {
        key: 'url',
        label: '请求 URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.example.com/endpoint',
        description: '支持变量插值：{{variable}}'
      },
      {
        key: 'method',
        label: '请求方法',
        type: 'select',
        required: true,
        default: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'PATCH', value: 'PATCH' }
        ],
        description: 'HTTP 请求方法'
      },

      // ========== 请求头 ==========
      {
        key: 'headers',
        label: '请求头',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "Authorization": "Bearer {{token}}",\n  "Content-Type": "application/json"\n}',
        description: 'JSON 格式的 Headers，支持变量插值'
      },

      // ========== 请求体配置 ==========
      {
        key: 'bodyType',
        label: '请求体类型',
        type: 'select',
        required: false,
        default: 'json',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'Form Data', value: 'form' },
          { label: 'Raw Text', value: 'raw' },
          { label: '无', value: 'none' }
        ],
        description: '请求体格式类型'
      },
      {
        key: 'body',
        label: '请求体',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "key": "value",\n  "data": {{inputData}}\n}',
        description: '请求体内容，支持变量插值'
      },

      // ========== 认证配置 ==========
      {
        key: 'authType',
        label: '认证方式',
        type: 'select',
        required: false,
        default: 'none',
        options: [
          { label: '无', value: 'none' },
          { label: 'Bearer Token', value: 'bearer' },
          { label: 'Basic Auth', value: 'basic' },
          { label: 'API Key', value: 'apikey' }
        ],
        description: 'API 认证方式'
      },
      {
        key: 'authToken',
        label: '认证凭证',
        type: 'text',
        required: false,
        placeholder: 'Bearer Token 或 API Key',
        description: '认证令牌或密钥'
      },
      {
        key: 'basicUsername',
        label: '用户名',
        type: 'text',
        required: false,
        placeholder: 'Basic Auth 用户名',
        description: 'Basic 认证用户名'
      },
      {
        key: 'basicPassword',
        label: '密码',
        type: 'text',
        required: false,
        placeholder: 'Basic Auth 密码',
        description: 'Basic 认证密码'
      },
      {
        key: 'apiKeyName',
        label: 'API Key 名称',
        type: 'text',
        required: false,
        default: 'X-API-Key',
        placeholder: 'Header 名称',
        description: 'API Key 的 Header 名称'
      },

      // ========== 响应处理 ==========
      {
        key: 'responseType',
        label: '响应类型',
        type: 'select',
        required: false,
        default: 'json',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'Text', value: 'text' },
          { label: 'Binary', value: 'binary' }
        ],
        description: '预期的响应格式'
      },
      {
        key: 'jsonPath',
        label: 'JSON 路径',
        type: 'text',
        required: false,
        placeholder: '$.data.results',
        description: '从响应中提取特定数据的 JSON 路径'
      },

      // ========== 高级配置 ==========
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        required: false,
        default: 30,
        min: 1,
        max: 300,
        description: '请求超时时间（秒）'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        required: false,
        default: 0,
        min: 0,
        max: 5,
        description: '请求失败时的重试次数'
      },
      {
        key: 'retryDelay',
        label: '重试延迟',
        type: 'number',
        required: false,
        default: 1,
        min: 0,
        max: 30,
        description: '重试间隔时间（秒）'
      },
      {
        key: 'followRedirects',
        label: '跟随重定向',
        type: 'checkbox',
        default: true,
        description: '是否自动跟随 HTTP 重定向'
      },
      {
        key: 'validateStatus',
        label: '验证状态码',
        type: 'checkbox',
        default: true,
        description: '非 2xx 状态码是否视为错误'
      },
      {
        key: 'ignoreSSL',
        label: '忽略 SSL 证书',
        type: 'checkbox',
        default: false,
        description: '是否忽略 SSL 证书验证（仅开发环境使用）'
      }
    ]
  },

  defaultConfig: {
    method: 'GET',
    bodyType: 'json',
    authType: 'none',
    responseType: 'json',
    timeout: 30,
    retryCount: 0,
    retryDelay: 1,
    followRedirects: true,
    validateStatus: true,
    ignoreSSL: false
  },

  executor: new HttpRequestExecutor()
}

export { HttpRequestExecutor } from './executor'
export default HttpRequestNode
