/**
 * IndexedDB 存储适配器 for redux-persist
 * 使用异步的 IndexedDB 替代同步的 localStorage，避免阻塞主线程
 * 包含 LRU 配额管理策略，避免配额超限时丢失所有数据
 */

import localforage from 'localforage'

// 配置 localforage 使用 IndexedDB
const storage = localforage.createInstance({
  name: 'cherry-studio',
  storeName: 'redux-persist',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE], // 优先使用 IndexedDB，降级到 localStorage
  description: 'Cherry Studio Redux Persist Storage'
})

// 元数据存储实例，用于跟踪 LRU 信息
const metadataStorage = localforage.createInstance({
  name: 'cherry-studio',
  storeName: 'storage-metadata',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
  description: 'Cherry Studio Storage Metadata for LRU'
})

// 关键 key 列表，这些 key 永远不会被 LRU 清理
const CRITICAL_KEYS = ['persist:cherry-studio']

// 存储元数据接口
interface StorageMetadata {
  key: string
  size: number
  lastAccessed: number
}

// 初始化状态
let isReady = false
let initPromise: Promise<void> | null = null

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

/**
 * 更新存储元数据
 */
async function updateMetadata(key: string, size: number): Promise<void> {
  try {
    const metadata: StorageMetadata = {
      key,
      size,
      lastAccessed: Date.now()
    }
    await metadataStorage.setItem(key, metadata)
  } catch (error) {
    console.warn('[indexedDBStorage] Failed to update metadata:', error)
  }
}

/**
 * 获取所有存储元数据
 */
async function getAllMetadata(): Promise<StorageMetadata[]> {
  const metadata: StorageMetadata[] = []
  try {
    await metadataStorage.iterate<StorageMetadata, void>((value) => {
      if (value && typeof value.lastAccessed === 'number') {
        metadata.push(value)
      }
    })
  } catch (error) {
    console.warn('[indexedDBStorage] Failed to get metadata:', error)
  }
  return metadata
}

/**
 * LRU 清理策略：清理最久未使用的数据
 * @param targetBytes 目标清理字节数
 * @returns 实际清理的字节数
 */
async function evictLRUEntries(targetBytes: number): Promise<number> {
  try {
    const metadata = await getAllMetadata()

    // 按最后访问时间排序（最旧的在前）
    metadata.sort((a, b) => a.lastAccessed - b.lastAccessed)

    let freedBytes = 0
    const keysToEvict: string[] = []

    for (const item of metadata) {
      // 跳过关键 key
      if (CRITICAL_KEYS.includes(item.key)) {
        continue
      }

      keysToEvict.push(item.key)
      freedBytes += item.size

      if (freedBytes >= targetBytes) {
        break
      }
    }

    // 执行清理
    for (const key of keysToEvict) {
      await storage.removeItem(key)
      await metadataStorage.removeItem(key)
      console.info(`[indexedDBStorage] LRU evicted: ${key}`)
    }

    if (freedBytes > 0) {
      console.info(`[indexedDBStorage] LRU eviction freed ${Math.round(freedBytes / 1024)}KB`)
    }

    return freedBytes
  } catch (error) {
    console.error('[indexedDBStorage] LRU eviction error:', error)
    return 0
  }
}

/**
 * 初始化存储并执行迁移（带超时保护）
 */
async function initStorage(): Promise<void> {
  if (isReady) return

  try {
    // 确保 localforage 驱动已初始化（带 5 秒超时）
    await withTimeout(storage.ready(), 5000, undefined)
    await withTimeout(metadataStorage.ready(), 5000, undefined)

    // 尝试从 localStorage 迁移数据（带 3 秒超时）
    await withTimeout(migrateFromLocalStorage(), 3000, undefined)

    isReady = true
    console.info('[indexedDBStorage] Storage initialized successfully')
  } catch (error) {
    console.error('[indexedDBStorage] Storage initialization error:', error)
    // 即使初始化失败，也标记为就绪，让应用继续运行
    isReady = true
  }
}

/**
 * 从 localStorage 迁移数据到 IndexedDB（一次性）
 */
async function migrateFromLocalStorage(): Promise<void> {
  try {
    // 检查 IndexedDB 中是否已有 persist 数据
    const existingData = await storage.getItem<string>('persist:cherry-studio')

    // 检查 localStorage 中是否有旧数据
    const oldData = localStorage.getItem('persist:cherry-studio')

    // 如果 IndexedDB 没有数据，但 localStorage 有，执行迁移
    if (!existingData && oldData) {
      console.info('[indexedDBStorage] Migrating data from localStorage to IndexedDB...')
      await storage.setItem('persist:cherry-studio', oldData)
      // 更新元数据
      await updateMetadata('persist:cherry-studio', new Blob([oldData]).size)
      console.info('[indexedDBStorage] Migration completed successfully')
    }
  } catch (error) {
    console.error('[indexedDBStorage] Migration error:', error)
  }
}

/**
 * 确保存储已初始化
 */
function ensureReady(): Promise<void> {
  if (isReady) return Promise.resolve()
  if (!initPromise) {
    initPromise = initStorage()
  }
  return initPromise
}

// redux-persist 需要的存储接口
const indexedDBStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // 确保存储已初始化
      await ensureReady()

      // 读取数据 - 不设超时，宁愿等待也不能丢失用户数据
      // IndexedDB 读取通常很快，只有数据量极大时才会慢
      const value = await storage.getItem<string>(key)

      // 更新 LRU 访问时间
      if (value !== null) {
        const size = new Blob([value]).size
        // 异步更新元数据，不阻塞读取
        updateMetadata(key, size).catch(() => {})
      }

      return value
    } catch (error) {
      console.error('[indexedDBStorage] getItem error:', error)
      // 出错时返回 null，让应用可以启动（使用默认状态）
      // 但这只应该在真正的错误情况下发生，不是超时
      return null
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const valueSize = new Blob([value]).size

    try {
      // 写入数据 - 不设超时，确保数据完整保存
      await storage.setItem(key, value)
      // 更新元数据
      await updateMetadata(key, valueSize)
    } catch (error) {
      console.error('[indexedDBStorage] setItem error:', error)

      // 如果存储失败（可能是配额超出），尝试 LRU 清理
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[indexedDBStorage] Quota exceeded, attempting LRU eviction')

        // 尝试清理至少 2 倍于当前值大小的空间
        const targetEviction = valueSize * 2
        const freed = await evictLRUEntries(targetEviction)

        if (freed > 0) {
          // 重试写入
          try {
            await storage.setItem(key, value)
            await updateMetadata(key, valueSize)
            console.info('[indexedDBStorage] Write succeeded after LRU eviction')
            return
          } catch (retryError) {
            console.error('[indexedDBStorage] Retry after eviction failed:', retryError)
          }
        }

        // 如果 LRU 清理后仍然失败，发送警告事件
        console.error('[indexedDBStorage] Could not free enough space, storage write failed')

        // 发送自定义事件通知 UI
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('storage-quota-warning', {
              detail: { key, size: valueSize }
            })
          )
        }
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await storage.removeItem(key)
      await metadataStorage.removeItem(key)
    } catch (error) {
      console.error('[indexedDBStorage] removeItem error:', error)
    }
  }
}

export default indexedDBStorage
