/**
 * 云向量库类型定义
 *
 * 定义云端向量数据库的配置和接口
 */

import type { VectorDbConfig, VectorSearchResult } from '../types'

/**
 * 云向量库后端类型
 */
export type CloudVectorBackend = 'pinecone' | 'milvus' | 'qdrant' | 'weaviate'

/**
 * 基础云向量库配置
 */
export interface CloudVectorConfig extends VectorDbConfig {
  /** API 密钥 */
  apiKey: string
  /** 环境/区域 (可选) */
  environment?: string
  /** 索引/集合名称 */
  indexName: string
  /** 命名空间 (可选) */
  namespace?: string
  /** 距离度量类型 */
  metric?: 'cosine' | 'euclidean' | 'dotproduct'
  /** 连接超时 (毫秒) */
  timeout?: number
}

/**
 * Pinecone 配置
 */
export interface PineconeConfig extends CloudVectorConfig {
  /** Pinecone 控制器主机 (可选，用于 Serverless) */
  controllerHost?: string
}

/**
 * Milvus 配置
 */
export interface MilvusConfig extends CloudVectorConfig {
  /** Milvus 地址 */
  address: string
  /** 用户名 (可选) */
  username?: string
  /** 密码 (可选) */
  password?: string
  /** 是否使用 SSL */
  ssl?: boolean
}

/**
 * Qdrant 配置
 */
export interface QdrantConfig extends CloudVectorConfig {
  /** Qdrant URL */
  url: string
  /** 集合名称 */
  collectionName: string
}

/**
 * Weaviate 配置
 */
export interface WeaviateConfig extends CloudVectorConfig {
  /** Weaviate 主机 */
  host: string
  /** Weaviate 方案 (http/https) */
  scheme?: 'http' | 'https'
  /** 类名 */
  className: string
}

/**
 * 云向量库状态
 */
export interface CloudVectorStatus {
  /** 是否已连接 */
  connected: boolean
  /** 索引/集合是否存在 */
  indexExists: boolean
  /** 向量数量 */
  vectorCount: number
  /** 维度 */
  dimensions?: number
  /** 最后同步时间 */
  lastSyncTime?: Date
  /** 错误信息 (如有) */
  error?: string
}

/**
 * 云向量库操作结果
 */
export interface CloudVectorOperationResult {
  success: boolean
  affectedCount: number
  error?: string
  durationMs: number
}

/**
 * 云向量搜索结果 (扩展基础结果)
 */
export interface CloudVectorSearchResult extends VectorSearchResult {
  /** 云端返回的原始分数 */
  cloudScore?: number
  /** 命名空间 */
  namespace?: string
  /** 分区/分片信息 */
  partition?: string
}
