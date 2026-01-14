/**
 * Vector Services Redux Slice
 *
 * 管理向量数据库后端配置和状态
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

/**
 * 云向量后端类型
 */
export type CloudVectorBackend = 'pinecone' | 'milvus' | 'qdrant' | 'weaviate'

/**
 * 本地向量后端类型
 */
export type LocalVectorBackend = 'vexus' | 'libsql' | 'memory' | 'usearch'

/**
 * Pinecone 配置
 */
export interface PineconeBackendConfig {
  enabled: boolean
  apiKey: string
  environment?: string
  indexName: string
  namespace?: string
}

/**
 * Milvus 配置
 */
export interface MilvusBackendConfig {
  enabled: boolean
  address: string
  username?: string
  password?: string
  collectionName: string
  ssl?: boolean
}

/**
 * Qdrant 配置
 */
export interface QdrantBackendConfig {
  enabled: boolean
  url: string
  apiKey?: string
  collectionName: string
}

/**
 * Weaviate 配置
 */
export interface WeaviateBackendConfig {
  enabled: boolean
  host: string
  scheme?: 'http' | 'https'
  apiKey?: string
  className: string
}

/**
 * 检索策略
 */
export interface SearchStrategy {
  /** 混合模式 */
  hybridMode: 'vector' | 'bm25' | 'hybrid'
  /** BM25 权重 (0-1) */
  bm25Weight: number
  /** 是否启用云端搜索 */
  enableCloudSearch: boolean
  /** 是否并行搜索 */
  parallelSearch: boolean
  /** 是否启用重排序 */
  rerankEnabled: boolean
  /** 重排序模型 */
  rerankModel?: string
  /** RRF k 常数 */
  rrfK: number
  /** 默认返回数量 */
  defaultTopK: number
}

/**
 * 向量服务状态
 */
export interface VectorServicesState {
  /** 本地后端 */
  localBackend: LocalVectorBackend

  /** 云端后端配置 */
  cloudBackends: {
    pinecone: PineconeBackendConfig
    milvus: MilvusBackendConfig
    qdrant: QdrantBackendConfig
    weaviate: WeaviateBackendConfig
  }

  /** 检索策略 */
  searchStrategy: SearchStrategy

  /** 是否已初始化 */
  initialized: boolean
}

/**
 * 默认状态
 */
const initialState: VectorServicesState = {
  localBackend: 'vexus',

  cloudBackends: {
    pinecone: {
      enabled: false,
      apiKey: '',
      indexName: '',
      namespace: ''
    },
    milvus: {
      enabled: false,
      address: '',
      collectionName: ''
    },
    qdrant: {
      enabled: false,
      url: '',
      collectionName: ''
    },
    weaviate: {
      enabled: false,
      host: '',
      className: ''
    }
  },

  searchStrategy: {
    hybridMode: 'hybrid',
    bm25Weight: 0.3,
    enableCloudSearch: false,
    parallelSearch: true,
    rerankEnabled: false,
    rerankModel: undefined,
    rrfK: 60,
    defaultTopK: 10
  },

  initialized: false
}

/**
 * Vector Services Slice
 */
const vectorServicesSlice = createSlice({
  name: 'vectorServices',
  initialState,
  reducers: {
    /**
     * 设置本地后端
     */
    setLocalBackend: (state, action: PayloadAction<LocalVectorBackend>) => {
      state.localBackend = action.payload
    },

    /**
     * 更新 Pinecone 配置
     */
    updatePineconeConfig: (state, action: PayloadAction<Partial<PineconeBackendConfig>>) => {
      state.cloudBackends.pinecone = {
        ...state.cloudBackends.pinecone,
        ...action.payload
      }
    },

    /**
     * 更新 Milvus 配置
     */
    updateMilvusConfig: (state, action: PayloadAction<Partial<MilvusBackendConfig>>) => {
      state.cloudBackends.milvus = {
        ...state.cloudBackends.milvus,
        ...action.payload
      }
    },

    /**
     * 更新 Qdrant 配置
     */
    updateQdrantConfig: (state, action: PayloadAction<Partial<QdrantBackendConfig>>) => {
      state.cloudBackends.qdrant = {
        ...state.cloudBackends.qdrant,
        ...action.payload
      }
    },

    /**
     * 更新 Weaviate 配置
     */
    updateWeaviateConfig: (state, action: PayloadAction<Partial<WeaviateBackendConfig>>) => {
      state.cloudBackends.weaviate = {
        ...state.cloudBackends.weaviate,
        ...action.payload
      }
    },

    /**
     * 更新检索策略
     */
    updateSearchStrategy: (state, action: PayloadAction<Partial<SearchStrategy>>) => {
      state.searchStrategy = {
        ...state.searchStrategy,
        ...action.payload
      }
    },

    /**
     * 启用/禁用云端后端
     */
    toggleCloudBackend: (state, action: PayloadAction<{ backend: CloudVectorBackend; enabled: boolean }>) => {
      const { backend, enabled } = action.payload
      state.cloudBackends[backend].enabled = enabled
    },

    /**
     * 设置初始化状态
     */
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.initialized = action.payload
    },

    /**
     * 重置为默认配置
     */
    resetToDefault: () => initialState
  }
})

export const {
  setLocalBackend,
  updatePineconeConfig,
  updateMilvusConfig,
  updateQdrantConfig,
  updateWeaviateConfig,
  updateSearchStrategy,
  toggleCloudBackend,
  setInitialized,
  resetToDefault
} = vectorServicesSlice.actions

export default vectorServicesSlice.reducer
