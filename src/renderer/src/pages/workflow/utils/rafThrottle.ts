/**
 * requestAnimationFrame 节流工具
 *
 * 用于优化高频交互事件（如拖拽、缩放），确保回调最多每帧执行一次
 * 避免在单帧内触发多次状态更新导致的性能问题
 */

/**
 * RAF 节流函数
 * 确保回调最多每帧执行一次，使用最新的参数
 *
 * @param fn 需要节流的函数
 * @returns 节流后的函数，附带 cancel 方法
 *
 * @example
 * const throttledHandler = rafThrottle((event: MouseEvent) => {
 *   console.log(event.clientX, event.clientY)
 * })
 *
 * element.addEventListener('mousemove', throttledHandler)
 *
 * // 清理时取消
 * throttledHandler.cancel()
 */
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T & { cancel: () => void } {
  let rafId: number | null = null
  let latestArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    latestArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (latestArgs !== null) {
          fn(...latestArgs)
          latestArgs = null
        }
      })
    }
  }) as T & { cancel: () => void }

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    latestArgs = null
  }

  return throttled
}

/**
 * 批量更新收集器
 * 收集多次更新，合并为单次 dispatch
 *
 * @param flush 批量处理函数，接收收集到的所有项目
 * @param delay 延迟时间（毫秒），默认使用 RAF
 * @returns 收集器对象
 *
 * @example
 * const batchUpdater = createBatchUpdater<NodeChange>((changes) => {
 *   setNodes((nds) => applyNodeChanges(changes, nds))
 * })
 *
 * // 多次调用 add，只会触发一次 flush
 * batchUpdater.add(change1)
 * batchUpdater.add(change2)
 * batchUpdater.add(change3)
 *
 * // 或者立即执行
 * batchUpdater.flush()
 */
export function createBatchUpdater<T>(
  flush: (items: T[]) => void,
  delay?: number
): {
  add: (item: T) => void
  addMany: (items: T[]) => void
  flush: () => void
  clear: () => void
  size: () => number
} {
  let items: T[] = []
  let timerId: number | null = null
  let rafId: number | null = null

  const scheduleFlush = () => {
    if (delay !== undefined) {
      // 使用 setTimeout
      if (timerId === null) {
        timerId = window.setTimeout(() => {
          timerId = null
          doFlush()
        }, delay)
      }
    } else {
      // 使用 RAF
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null
          doFlush()
        })
      }
    }
  }

  const doFlush = () => {
    if (items.length > 0) {
      const batch = items
      items = []
      flush(batch)
    }
  }

  return {
    add: (item: T) => {
      items.push(item)
      scheduleFlush()
    },

    addMany: (newItems: T[]) => {
      items.push(...newItems)
      scheduleFlush()
    },

    flush: () => {
      // 取消定时器
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      doFlush()
    },

    clear: () => {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      items = []
    },

    size: () => items.length
  }
}

/**
 * 防抖函数
 * 延迟执行，直到停止调用后的指定时间
 *
 * @param fn 需要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 *
 * @example
 * const debouncedSave = debounce((data) => {
 *   saveToStore(data)
 * }, 150)
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
): T & { cancel: () => void; flush: () => void } {
  let timerId: number | null = null
  let latestArgs: Parameters<T> | null = null

  const debounced = ((...args: Parameters<T>) => {
    latestArgs = args

    if (timerId !== null) {
      clearTimeout(timerId)
    }

    timerId = window.setTimeout(() => {
      timerId = null
      if (latestArgs !== null) {
        fn(...latestArgs)
        latestArgs = null
      }
    }, wait)
  }) as T & { cancel: () => void; flush: () => void }

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    latestArgs = null
  }

  debounced.flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    if (latestArgs !== null) {
      fn(...latestArgs)
      latestArgs = null
    }
  }

  return debounced
}

/**
 * 节流函数（基于时间间隔）
 * 确保函数在指定时间间隔内最多执行一次
 *
 * @param fn 需要节流的函数
 * @param limit 时间间隔（毫秒）
 * @param options 选项
 * @returns 节流后的函数
 *
 * @example
 * const throttledScroll = throttle((event) => {
 *   console.log('scrolled')
 * }, 100)
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number,
  options?: {
    leading?: boolean // 是否在开始时立即执行，默认 true
    trailing?: boolean // 是否在结束时执行，默认 true
  }
): T & { cancel: () => void } {
  const { leading = true, trailing = true } = options || {}
  let lastTime = 0
  let timerId: number | null = null
  let latestArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now()
    latestArgs = args

    if (!lastTime && !leading) {
      lastTime = now
    }

    const remaining = limit - (now - lastTime)

    if (remaining <= 0 || remaining > limit) {
      // 到达时间间隔
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      lastTime = now
      fn(...args)
      latestArgs = null
    } else if (timerId === null && trailing) {
      // 设置尾部调用
      timerId = window.setTimeout(() => {
        lastTime = leading ? Date.now() : 0
        timerId = null
        if (latestArgs !== null) {
          fn(...latestArgs)
          latestArgs = null
        }
      }, remaining)
    }
  }) as T & { cancel: () => void }

  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    lastTime = 0
    latestArgs = null
  }

  return throttled
}
