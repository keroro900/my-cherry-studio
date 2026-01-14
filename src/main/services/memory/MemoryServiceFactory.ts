/**
 * MemoryServiceFactory - 统一记忆服务工厂
 *
 * 整合所有记忆服务的获取逻辑，提供统一入口：
 * - LightMemoService: 轻量级 BM25 + 向量检索
 * - DeepMemoService: 深度检索 (Tantivy + Reranker)
 * - MeshMemoService: 元数据过滤 + 向量检索
 * - MemoryMasterService: 自动标签、批量整理、去重
 * - SelfLearningService: 学习权重、反馈记录
 *
 * 替代原本分散在各个 IpcHandler 中的服务获取逻辑。
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { createDeepMemoService, type DeepMemoService } from '@main/knowledge/deepMemo'
import { createLightMemoService, type LightMemoService } from '@main/knowledge/lightMemo'
import {
  getNativeMeshMemoService,
  type NativeMeshMemoService,
  type GenericMetadata
} from '@main/knowledge/meshMemo'
import { getSelfLearningService, type SelfLearningService } from '@main/knowledge/tagmemo/SelfLearningService'
import { getMemoryMasterService, type MemoryMasterService } from './MemoryMasterService'
import { getAIMemoService, type AIMemoService } from './AIMemoService'

const logger = loggerService.withContext('MemoryServiceFactory')

// ==================== 服务实例缓存 (懒加载) ====================

let _lightMemoService: LightMemoService | null = null
let _deepMemoService: DeepMemoService | null = null
let _meshMemoService: NativeMeshMemoService<GenericMetadata> | null = null
let _selfLearningService: SelfLearningService | null = null
let _memoryMasterService: MemoryMasterService | null = null
let _aiMemoService: AIMemoService | null = null

// ==================== 服务获取函数 ====================

/**
 * 获取 LightMemo 服务
 */
export function getLightMemoService(): LightMemoService {
  if (!_lightMemoService) {
    _lightMemoService = createLightMemoService()
    logger.info('LightMemoService initialized')
  }
  return _lightMemoService
}

/**
 * 获取 DeepMemo 服务
 */
export function getDeepMemoService(): DeepMemoService {
  if (!_deepMemoService) {
    _deepMemoService = createDeepMemoService()
    logger.info('DeepMemoService initialized')
  }
  return _deepMemoService
}

/**
 * 获取 MeshMemo 服务
 */
export function getMeshMemoService(): NativeMeshMemoService<GenericMetadata> {
  if (!_meshMemoService) {
    _meshMemoService = getNativeMeshMemoService<GenericMetadata>()
    logger.info('NativeMeshMemoService initialized (using Rust backend)')
  }
  return _meshMemoService
}

/**
 * 获取 SelfLearning 服务
 */
export function getSelfLearningServiceInstance(): SelfLearningService {
  if (!_selfLearningService) {
    _selfLearningService = getSelfLearningService()
    logger.info('SelfLearningService initialized')
  }
  return _selfLearningService
}

/**
 * 获取 MemoryMaster 服务
 */
export function getMemoryMasterServiceInstance(): MemoryMasterService {
  if (!_memoryMasterService) {
    _memoryMasterService = getMemoryMasterService()
    logger.info('MemoryMasterService initialized')
  }
  return _memoryMasterService
}

/**
 * 获取 AIMemo 服务
 */
export function getAIMemoServiceInstance(): AIMemoService {
  if (!_aiMemoService) {
    _aiMemoService = getAIMemoService()
    logger.info('AIMemoService initialized')
  }
  return _aiMemoService
}

// ==================== 统一服务获取 (兼容旧接口) ====================

/**
 * 获取高级记忆服务集合
 *
 * 这是 IntegratedMemoryCoordinator 使用的接口
 * 替代原本 AdvancedMemoryIpcHandler 中的 getAdvancedMemoryServices
 */
export function getAdvancedMemoryServices() {
  return {
    lightMemo: getLightMemoService,
    deepMemo: getDeepMemoService,
    meshMemo: getMeshMemoService
  }
}

/**
 * 获取所有记忆服务
 */
export function getAllMemoryServices() {
  return {
    lightMemo: getLightMemoService,
    deepMemo: getDeepMemoService,
    meshMemo: getMeshMemoService,
    selfLearning: getSelfLearningServiceInstance,
    memoryMaster: getMemoryMasterServiceInstance,
    aiMemo: getAIMemoServiceInstance
  }
}

// ==================== 服务重置 (仅用于测试) ====================

/**
 * 重置所有服务实例
 * 仅用于测试目的
 */
export function resetAllMemoryServices(): void {
  _lightMemoService = null
  _deepMemoService = null
  _meshMemoService = null
  _selfLearningService = null
  _memoryMasterService = null
  _aiMemoService = null
  logger.info('All memory services reset')
}

// ==================== 类型导出 ====================

export type {
  LightMemoService,
  DeepMemoService,
  MemoryMasterService,
  SelfLearningService,
  AIMemoService
}

export type { NativeMeshMemoService, GenericMetadata }
