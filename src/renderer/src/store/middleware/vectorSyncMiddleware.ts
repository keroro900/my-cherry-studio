/**
 * Vector Backend 同步中间件
 *
 * 同步 memory.memoryConfig.vectorBackend 和 vectorServices.localBackend
 * 确保两个 Redux slice 中的向量后端配置保持一致
 */

import type { Middleware } from '@reduxjs/toolkit'

import type { RootState } from '../index'
import { updateMemoryConfig } from '../memory'
import type { LocalVectorBackend } from '../vectorServices'
import { setLocalBackend } from '../vectorServices'

// 防止循环调用的标志
let isSyncing = false

/**
 * 向量后端同步中间件
 *
 * 监听以下 action 并同步状态：
 * - memory/updateMemoryConfig: 如果 vectorBackend 变化，同步到 vectorServices.localBackend
 * - vectorServices/setLocalBackend: 如果 localBackend 变化，同步到 memory.memoryConfig.vectorBackend
 */
export const vectorSyncMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // 先执行 action
  const result = next(action)

  // 如果正在同步中，跳过以避免循环
  if (isSyncing) {
    return result
  }

  const state = store.getState()

  // 处理 memory/updateMemoryConfig
  if (updateMemoryConfig.match(action)) {
    const newVectorBackend = action.payload.vectorBackend
    const currentLocalBackend = state.vectorServices?.localBackend

    // 如果 vectorBackend 有值且与 localBackend 不同，同步
    if (newVectorBackend && newVectorBackend !== currentLocalBackend) {
      isSyncing = true
      try {
        store.dispatch(setLocalBackend(newVectorBackend as LocalVectorBackend))
      } finally {
        isSyncing = false
      }
    }
  }

  // 处理 vectorServices/setLocalBackend
  if (setLocalBackend.match(action)) {
    const newLocalBackend = action.payload
    const currentVectorBackend = state.memory?.memoryConfig?.vectorBackend

    // 如果 localBackend 与 vectorBackend 不同，同步
    if (newLocalBackend !== currentVectorBackend) {
      isSyncing = true
      try {
        const currentMemoryConfig = state.memory?.memoryConfig || {}
        store.dispatch(
          updateMemoryConfig({
            ...currentMemoryConfig,
            vectorBackend: newLocalBackend
          })
        )
      } finally {
        isSyncing = false
      }
    }
  }

  return result
}

export default vectorSyncMiddleware
