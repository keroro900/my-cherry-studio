/**
 * 外部服务配置 Redux Store
 *
 * 管理非 LLM 的外部服务配置，例如：
 * - RunningHub: AI 应用换装平台
 * - Kling: 可灵视频生成
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

/**
 * 外部服务状态
 */
export interface ExternalServicesState {
  runningHub: RunningHubConfig
  kling: KlingConfig
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
