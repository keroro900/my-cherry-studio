import { loggerService } from '@logger'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'
import { createTransform } from 'redux-persist'

import storeSyncService from '../services/StoreSyncService'
import assistants from './assistants'
import backup from './backup'
import codeTools from './codeTools'
import copilot from './copilot'
import externalServices from './externalServices'
// 使用 IndexedDB 替代 localStorage，避免同步阻塞主线程
import storage from './indexedDBStorage'
import inputToolsReducer from './inputTools'
import knowledge from './knowledge'
import llm from './llm'
import mcp from './mcp'
import memory from './memory'
import messageBlocksReducer from './messageBlock'
import migrate from './migrate'
import minapps from './minapps'
import newMessagesReducer from './newMessage'
import { setNotesPath } from './note'
import note from './note'
import nutstore from './nutstore'
import ocr from './ocr'
import paintings from './paintings'
import preprocess from './preprocess'
import runtime from './runtime'
import selectionStore from './selectionStore'
import settings from './settings'
import shortcuts from './shortcuts'
import tabs from './tabs'
import toolPermissions from './toolPermissions'
import translate from './translate'
import unifiedPaintings from './unifiedPaintings'
import websearch from './websearch'
import workflow from './workflow'
import imageStudio from './imageStudio'

const logger = loggerService.withContext('Store')

// ============================================================================
// 数据清理工具：防止 localStorage 配额超出
// ============================================================================

/**
 * 清理字符串中的大型 base64 数据
 * 保留 http/https URL 和 file:// 路径，只清理内联的 base64 数据
 */
function cleanLargeStringData(value: string, threshold = 1000): string {
  if (!value || typeof value !== 'string') return value
  if (value.length <= threshold) return value

  // 保留这些格式的数据
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('indexeddb://')
  ) {
    return value
  }

  // 清理 base64 数据
  if (value.startsWith('data:') || /^[A-Za-z0-9+/=]{100,}$/.test(value)) {
    return '[BASE64_DATA_CLEARED]'
  }

  return value
}

/**
 * 递归清理对象中的大型数据
 */
function cleanLargeDataInObject(obj: any, depth = 0): any {
  if (depth > 10) return obj // 防止无限递归
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => cleanLargeDataInObject(item, depth + 1))
  }

  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // 对于 urls 字段，清理其中的 base64 数据
      cleaned[key] = cleanLargeStringData(value)
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = cleanLargeDataInObject(value, depth + 1)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

/**
 * 限制数组长度，保留最新的记录
 */
function limitArrayLength<T>(arr: T[], maxLength: number): T[] {
  if (!Array.isArray(arr)) return arr
  if (arr.length <= maxLength) return arr
  return arr.slice(0, maxLength)
}

/**
 * 创建绘画数据的 Redux Persist Transform
 * 在持久化前清理大型数据，防止 localStorage 配额超出
 */
function createPaintingsTransform() {
  return createTransform(
    // 序列化时（存储前）清理数据
    (inboundState: any, key) => {
      if (key === 'paintings') {
        // 清理每个命名空间的绘画数据
        const cleaned: Record<string, any> = {}
        for (const [namespace, paintings] of Object.entries(inboundState)) {
          if (Array.isArray(paintings)) {
            // 限制每个命名空间最多保留 100 条记录，并清理大型数据
            const limited = limitArrayLength(paintings, 100)
            cleaned[namespace] = limited.map((painting: any) => cleanLargeDataInObject(painting))
          } else {
            cleaned[namespace] = paintings
          }
        }
        return cleaned
      }

      if (key === 'unifiedPaintings') {
        const cleaned = { ...inboundState }
        // 限制绘画记录数量
        if (Array.isArray(cleaned.paintings)) {
          cleaned.paintings = limitArrayLength(cleaned.paintings, 200).map((p: any) => cleanLargeDataInObject(p))
        }
        // 限制提示词历史
        if (Array.isArray(cleaned.promptHistory)) {
          cleaned.promptHistory = limitArrayLength(cleaned.promptHistory, 100)
        }
        // 清理生成队列（只保留未完成的任务）
        if (Array.isArray(cleaned.generationQueue)) {
          cleaned.generationQueue = cleaned.generationQueue
            .filter((t: any) => !['completed', 'failed', 'cancelled'].includes(t.status))
            .map((t: any) => cleanLargeDataInObject(t))
        }
        return cleaned
      }

            if (key === 'imageStudio') {
        const cleaned = { ...inboundState }
        // 限制项目数量
        if (Array.isArray(cleaned.projects)) {
          cleaned.projects = limitArrayLength(cleaned.projects, 50).map((p: any) => ({
            ...cleanLargeDataInObject(p),
            // 限制每个项目的版本数量
            versions: Array.isArray(p.versions) ? limitArrayLength(p.versions, 20).map((v: any) => cleanLargeDataInObject(v)) : []
          }))
        }
        // 清理任务队列（只保留未完成的任务）
        if (Array.isArray(cleaned.taskQueue)) {
          cleaned.taskQueue = cleaned.taskQueue
            .filter((t: any) => !['completed', 'failed', 'cancelled'].includes(t.status))
            .map((t: any) => cleanLargeDataInObject(t))
        }
        return cleaned
      }

      return inboundState
    },
    // 反序列化时（读取后）不做处理
    (outboundState) => outboundState,
    // 只对这些 slice 应用
    { whitelist: ['paintings', 'unifiedPaintings', 'imageStudio'] }
  )
}

const rootReducer = combineReducers({
  assistants,
  backup,
  codeTools,
  nutstore,
  paintings,
  unifiedPaintings,
  llm,
  settings,
  runtime,
  shortcuts,
  knowledge,
  minapps,
  websearch,
  mcp,
  memory,
  copilot,
  selectionStore,
  tabs,
  preprocess,
  messages: newMessagesReducer,
  messageBlocks: messageBlocksReducer,
  inputTools: inputToolsReducer,
  translate,
  ocr,
  note,
  toolPermissions,
  workflow,
  externalServices,
  imageStudio
})

const persistedReducer = persistReducer(
  {
    key: 'cherry-studio',
    storage,
    version: 181,
    blacklist: ['runtime', 'messages', 'messageBlocks', 'tabs', 'toolPermissions', 'workflow'],
    migrate,
    // 设置足够长的超时时间（1小时），避免 rehydrate timeout 警告
    // 注意：setTimeout 最大值是 2^31-1 ms，不能用 Number.MAX_SAFE_INTEGER
    timeout: 3600000,
    // 在序列化前清理大型数据，防止 localStorage 配额超出
    transforms: [createPaintingsTransform()] as any
  },
  rootReducer
)

/**
 * Configures the store sync service to synchronize specific state slices across all windows.
 * For detailed implementation, see @renderer/services/StoreSyncService.ts
 *
 * Usage:
 * - 'xxxx/' - Synchronizes the entire state slice
 * - 'xxxx/sliceName' - Synchronizes a specific slice within the state
 *
 * To listen for store changes in a window:
 * Call storeSyncService.subscribe() in the window's entryPoint.tsx
 */
storeSyncService.setOptions({
  syncList: ['assistants/', 'settings/', 'llm/', 'selectionStore/', 'note/', 'externalServices/']
})

const store = configureStore({
  // @ts-ignore store type is unknown
  reducer: persistedReducer as typeof rootReducer,
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      },
      // 性能优化：禁用对大型 slice 的不可变性检查
      // workflow slice 包含大量节点、边和历史记录，检查速度慢
      immutableCheck: {
        ignoredPaths: ['workflow']
      }
    }).concat(storeSyncService.createMiddleware())
  },
  devTools: true
})

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch

export const persistor = persistStore(store, undefined, () => {
  // Initialize notes path after rehydration if empty
  const state = store.getState()
  if (!state.note.notesPath) {
    // Use setTimeout to ensure this runs after the store is fully initialized
    setTimeout(async () => {
      try {
        const info = await window.api.getAppInfo()
        store.dispatch(setNotesPath(info.notesPath))
        logger.info('Initialized notes path on startup:', info.notesPath)
      } catch (error) {
        logger.error('Failed to initialize notes path on startup:', error as Error)
      }
    }, 0)
  }
})

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<typeof store>()
window.store = store

export async function handleSaveData() {
  logger.info('Flushing redux persistor data')
  await persistor.flush()
  logger.info('Flushed redux persistor data')
}

export default store
