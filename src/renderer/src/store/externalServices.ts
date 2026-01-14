/**
 * 外部服务配置 Redux Store
 *
 * 管理非 LLM 的外部服务配置，例如：
 * - RunningHub: AI 应用换装平台
 * - Kling: 可灵视频生成
 * - Neo4j: 知识图谱数据库
 * - Wikidata: 结构化知识库
 * - Elasticsearch: 全文搜索引擎
 *
 * 这些服务不是标准的 LLM Provider，所以单独管理配置
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

// ==================== 类型定义 ====================

/**
 * RunningHub 服务配置
 */
export interface RunningHubConfig {
  /** API 密钥 */
  apiKey: string
  /** API 基础地址 */
  baseUrl: string
  /** 是否启用 */
  enabled: boolean
  /** 默认超时时间（秒） */
  timeout: number
  /** 失败重试次数 */
  retryCount: number
}

/**
 * 可灵 (Kling) 服务配置
 */
export interface KlingConfig {
  /** Access Key */
  accessKey: string
  /** Secret Key (用于生成 JWT Token) */
  secretKey: string
  /** API 基础地址 */
  baseUrl: string
  /** 是否启用 */
  enabled: boolean
  /** 默认超时时间（秒） */
  timeout: number
  /** 失败重试次数 */
  retryCount: number
  /** 默认视频时长（秒） */
  defaultDuration: 5 | 10
  /** 默认视频模式 */
  defaultMode: 'std' | 'pro'
  /** 默认模型版本 - 用户可自定义填写 */
  defaultModel: string
}

// ==================== 外部知识源配置 ====================

/**
 * Neo4j 知识图谱配置
 */
export interface Neo4jKnowledgeConfig {
  /** 连接端点 (如 bolt://localhost:7687) */
  endpoint: string
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 数据库名 (默认 neo4j) */
  database: string
  /** 是否启用 */
  enabled: boolean
  /** 是否加密连接 */
  encrypted: boolean
  /** 超时时间（毫秒） */
  timeout: number
}

/**
 * Wikidata 知识库配置
 */
export interface WikidataKnowledgeConfig {
  /** SPARQL 端点 */
  endpoint: string
  /** 默认语言 */
  language: string
  /** 是否启用 */
  enabled: boolean
  /** 是否启用缓存 */
  cacheEnabled: boolean
  /** 缓存 TTL（秒） */
  cacheTTL: number
  /** 用户代理 */
  userAgent: string
}

/**
 * Elasticsearch 全文搜索配置
 */
export interface ElasticsearchKnowledgeConfig {
  /** 连接端点 (如 http://localhost:9200) */
  endpoint: string
  /** 认证类型 */
  authType: 'none' | 'basic' | 'apikey'
  /** 用户名 (basic 认证) */
  username: string
  /** 密码 (basic 认证) */
  password: string
  /** API Key (apikey 认证) */
  apiKey: string
  /** 默认索引 */
  defaultIndex: string
  /** 索引模式 (支持通配符) */
  indexPattern: string
  /** 是否启用 */
  enabled: boolean
  /** 超时时间（毫秒） */
  timeout: number
}

/**
 * 外部服务状态
 */
export interface ExternalServicesState {
  runningHub: RunningHubConfig
  kling: KlingConfig
  // 外部知识源
  neo4j: Neo4jKnowledgeConfig
  wikidata: WikidataKnowledgeConfig
  elasticsearch: ElasticsearchKnowledgeConfig
}

// ==================== 初始状态 ====================

const initialState: ExternalServicesState = {
  runningHub: {
    apiKey: '',
    baseUrl: 'https://www.runninghub.cn',
    enabled: false,
    timeout: 300,
    retryCount: 2
  },
  kling: {
    accessKey: '',
    secretKey: '',
    baseUrl: 'https://api.klingai.com',
    enabled: false,
    timeout: 600,
    retryCount: 2,
    defaultDuration: 5,
    defaultMode: 'std',
    defaultModel: 'kling-v1-6'
  },
  // 外部知识源初始配置
  neo4j: {
    endpoint: 'bolt://localhost:7687',
    username: 'neo4j',
    password: '',
    database: 'neo4j',
    enabled: false,
    encrypted: false,
    timeout: 30000
  },
  wikidata: {
    endpoint: 'https://query.wikidata.org/sparql',
    language: 'zh',
    enabled: false,
    cacheEnabled: true,
    cacheTTL: 3600,
    userAgent: 'CherryStudio/1.0'
  },
  elasticsearch: {
    endpoint: 'http://localhost:9200',
    authType: 'none',
    username: '',
    password: '',
    apiKey: '',
    defaultIndex: '',
    indexPattern: '*',
    enabled: false,
    timeout: 30000
  }
}

// ==================== Slice ====================

const externalServicesSlice = createSlice({
  name: 'externalServices',
  initialState,
  reducers: {
    // ===== RunningHub =====

    /**
     * 更新 RunningHub 配置
     */
    updateRunningHubConfig: (state, action: PayloadAction<Partial<RunningHubConfig>>) => {
      state.runningHub = { ...state.runningHub, ...action.payload }
    },

    /**
     * 设置 RunningHub API Key
     */
    setRunningHubApiKey: (state, action: PayloadAction<string>) => {
      state.runningHub.apiKey = action.payload
      // 有 API Key 时自动启用
      if (action.payload) {
        state.runningHub.enabled = true
      }
    },

    /**
     * 启用/禁用 RunningHub
     */
    setRunningHubEnabled: (state, action: PayloadAction<boolean>) => {
      state.runningHub.enabled = action.payload
    },

    // ===== Kling =====

    /**
     * 更新 Kling 配置
     */
    updateKlingConfig: (state, action: PayloadAction<Partial<KlingConfig>>) => {
      state.kling = { ...state.kling, ...action.payload }
    },

    /**
     * 设置 Kling Access Key
     */
    setKlingAccessKey: (state, action: PayloadAction<string>) => {
      state.kling.accessKey = action.payload
    },

    /**
     * 设置 Kling Secret Key
     */
    setKlingSecretKey: (state, action: PayloadAction<string>) => {
      state.kling.secretKey = action.payload
      // 同时有 Access Key 和 Secret Key 时自动启用
      if (action.payload && state.kling.accessKey) {
        state.kling.enabled = true
      }
    },

    /**
     * 启用/禁用 Kling
     */
    setKlingEnabled: (state, action: PayloadAction<boolean>) => {
      state.kling.enabled = action.payload
    },

    // ===== Neo4j =====

    /**
     * 更新 Neo4j 配置
     */
    updateNeo4jConfig: (state, action: PayloadAction<Partial<Neo4jKnowledgeConfig>>) => {
      state.neo4j = { ...state.neo4j, ...action.payload }
    },

    /**
     * 启用/禁用 Neo4j
     */
    setNeo4jEnabled: (state, action: PayloadAction<boolean>) => {
      state.neo4j.enabled = action.payload
    },

    // ===== Wikidata =====

    /**
     * 更新 Wikidata 配置
     */
    updateWikidataConfig: (state, action: PayloadAction<Partial<WikidataKnowledgeConfig>>) => {
      state.wikidata = { ...state.wikidata, ...action.payload }
    },

    /**
     * 启用/禁用 Wikidata
     */
    setWikidataEnabled: (state, action: PayloadAction<boolean>) => {
      state.wikidata.enabled = action.payload
    },

    // ===== Elasticsearch =====

    /**
     * 更新 Elasticsearch 配置
     */
    updateElasticsearchConfig: (state, action: PayloadAction<Partial<ElasticsearchKnowledgeConfig>>) => {
      state.elasticsearch = { ...state.elasticsearch, ...action.payload }
    },

    /**
     * 启用/禁用 Elasticsearch
     */
    setElasticsearchEnabled: (state, action: PayloadAction<boolean>) => {
      state.elasticsearch.enabled = action.payload
    },

    // ===== 通用 =====

    /**
     * 重置所有配置到初始状态
     */
    resetAllConfigs: () => initialState
  }
})

// ==================== 导出 ====================

export const {
  updateRunningHubConfig,
  setRunningHubApiKey,
  setRunningHubEnabled,
  updateKlingConfig,
  setKlingAccessKey,
  setKlingSecretKey,
  setKlingEnabled,
  // Neo4j
  updateNeo4jConfig,
  setNeo4jEnabled,
  // Wikidata
  updateWikidataConfig,
  setWikidataEnabled,
  // Elasticsearch
  updateElasticsearchConfig,
  setElasticsearchEnabled,
  // 通用
  resetAllConfigs
} = externalServicesSlice.actions

export default externalServicesSlice.reducer

// ==================== Selectors ====================

/**
 * 获取 RunningHub 配置
 */
export const selectRunningHubConfig = (state: { externalServices: ExternalServicesState }) =>
  state.externalServices.runningHub

/**
 * 获取 Kling 配置
 */
export const selectKlingConfig = (state: { externalServices: ExternalServicesState }) => state.externalServices.kling

/**
 * 检查 RunningHub 是否可用
 */
export const selectRunningHubAvailable = (state: { externalServices: ExternalServicesState }) =>
  state.externalServices.runningHub.enabled && !!state.externalServices.runningHub.apiKey

/**
 * 检查 Kling 是否可用
 */
export const selectKlingAvailable = (state: { externalServices: ExternalServicesState }) =>
  state.externalServices.kling.enabled &&
  !!state.externalServices.kling.accessKey &&
  !!state.externalServices.kling.secretKey

// ==================== 外部知识源 Selectors ====================

/**
 * 获取 Neo4j 配置
 */
export const selectNeo4jConfig = (state: { externalServices: ExternalServicesState }) =>
  state.externalServices.neo4j ?? initialState.neo4j

/**
 * 检查 Neo4j 是否可用
 */
export const selectNeo4jAvailable = (state: { externalServices: ExternalServicesState }) => {
  const config = state.externalServices.neo4j ?? initialState.neo4j
  return config.enabled && !!config.endpoint && !!config.password
}

/**
 * 获取 Wikidata 配置
 */
export const selectWikidataConfig = (state: { externalServices: ExternalServicesState }) =>
  state.externalServices.wikidata ?? initialState.wikidata

/**
 * 检查 Wikidata 是否可用
 */
export const selectWikidataAvailable = (state: { externalServices: ExternalServicesState }) => {
  const config = state.externalServices.wikidata ?? initialState.wikidata
  return config.enabled && !!config.endpoint
}

/**
 * 获取 Elasticsearch 配置
 */
export const selectElasticsearchConfig = (state: { externalServices: ExternalServicesState }) => {
  const config = state.externalServices.elasticsearch
  if (!config) return initialState.elasticsearch
  // 确保 authType 有默认值
  return {
    ...initialState.elasticsearch,
    ...config,
    authType: config.authType || 'none'
  }
}

/**
 * 检查 Elasticsearch 是否可用
 */
export const selectElasticsearchAvailable = (state: { externalServices: ExternalServicesState }) => {
  const config = state.externalServices.elasticsearch ?? initialState.elasticsearch
  if (!config.enabled || !config.endpoint) return false

  // 根据认证类型检查必要的凭据
  switch (config.authType) {
    case 'basic':
      return !!config.username && !!config.password
    case 'apikey':
      return !!config.apiKey
    case 'none':
    default:
      return true
  }
}

/**
 * 获取所有已启用的外部知识源
 */
export const selectEnabledKnowledgeSources = (state: { externalServices: ExternalServicesState }) => {
  const sources: Array<'neo4j' | 'wikidata' | 'elasticsearch'> = []
  const neo4j = state.externalServices.neo4j ?? initialState.neo4j
  const wikidata = state.externalServices.wikidata ?? initialState.wikidata
  const elasticsearch = state.externalServices.elasticsearch ?? initialState.elasticsearch
  if (neo4j.enabled) sources.push('neo4j')
  if (wikidata.enabled) sources.push('wikidata')
  if (elasticsearch.enabled) sources.push('elasticsearch')
  return sources
}
