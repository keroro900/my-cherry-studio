/**
 * 并发控制器
 *
 * 用于限制并行 API 调用数量，防止 API 限流
 * 支持优先级队列、超时控制和取消操作
 */

interface QueueItem<T> {
  id: string
  priority: number
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: any) => void
  signal?: AbortSignal
  addedAt: number
}

/**
 * 并发限制器类
 *
 * @example
 * ```typescript
 * const limiter = new ConcurrencyLimiter(3) // 最多 3 个并发
 *
 * // 提交任务
 * const result = await limiter.submit(async () => {
 *   return fetch('/api/generate')
 * })
 *
 * // 批量提交并等待全部完成
 * const results = await limiter.all([
 *   () => fetch('/api/1'),
 *   () => fetch('/api/2'),
 *   () => fetch('/api/3'),
 *   () => fetch('/api/4'), // 这个会等待前面的完成
 * ])
 * ```
 */
export class ConcurrencyLimiter {
  private maxConcurrency: number
  private currentRunning: number = 0
  private queue: QueueItem<any>[] = []
  private idCounter: number = 0

  /**
   * 创建并发限制器
   * @param maxConcurrency 最大并发数，默认为 3
   */
  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency
  }

  /**
   * 获取当前正在运行的任务数
   */
  get running(): number {
    return this.currentRunning
  }

  /**
   * 获取队列中等待的任务数
   */
  get pending(): number {
    return this.queue.length
  }

  /**
   * 提交一个任务
   * @param fn 要执行的异步函数
   * @param options 选项
   * @returns Promise，任务完成时 resolve
   */
  submit<T>(
    fn: () => Promise<T>,
    options?: {
      priority?: number // 优先级，数字越大越先执行，默认 0
      signal?: AbortSignal // 取消信号
    }
  ): Promise<T> {
    const { priority = 0, signal } = options || {}

    // 如果已经取消，直接拒绝
    if (signal?.aborted) {
      return Promise.reject(new Error('Task aborted before execution'))
    }

    return new Promise<T>((resolve, reject) => {
      const id = `task-${++this.idCounter}`

      const item: QueueItem<T> = {
        id,
        priority,
        fn,
        resolve,
        reject,
        signal,
        addedAt: Date.now()
      }

      // 监听取消信号
      if (signal) {
        const abortHandler = () => {
          // 从队列中移除
          const index = this.queue.findIndex((q) => q.id === id)
          if (index !== -1) {
            this.queue.splice(index, 1)
            reject(new Error('Task aborted'))
          }
        }
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      // 按优先级插入队列
      this.insertByPriority(item)

      // 尝试执行
      this.tryExecuteNext()
    })
  }

  /**
   * 批量提交任务并等待全部完成
   * @param fns 任务函数数组
   * @param options 选项
   * @returns 所有任务的结果数组
   */
  async all<T>(
    fns: (() => Promise<T>)[],
    options?: {
      signal?: AbortSignal
      onProgress?: (completed: number, total: number) => void
    }
  ): Promise<T[]> {
    const { signal, onProgress } = options || {}
    let completed = 0
    const total = fns.length

    const promises = fns.map((fn) =>
      this.submit(fn, { signal }).then((result) => {
        completed++
        onProgress?.(completed, total)
        return result
      })
    )

    return Promise.all(promises)
  }

  /**
   * 批量提交任务，返回已完成的结果（忽略失败）
   * @param fns 任务函数数组
   * @param options 选项
   * @returns PromiseSettledResult 数组
   */
  async allSettled<T>(
    fns: (() => Promise<T>)[],
    options?: {
      signal?: AbortSignal
      onProgress?: (completed: number, total: number) => void
    }
  ): Promise<PromiseSettledResult<T>[]> {
    const { signal, onProgress } = options || {}
    let completed = 0
    const total = fns.length

    const promises = fns.map((fn) =>
      this.submit(fn, { signal })
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }))
        .finally(() => {
          completed++
          onProgress?.(completed, total)
        })
    )

    return Promise.all(promises)
  }

  /**
   * 清空队列中的所有等待任务
   */
  clear(): void {
    const pendingItems = [...this.queue]
    this.queue = []

    for (const item of pendingItems) {
      item.reject(new Error('Queue cleared'))
    }
  }

  /**
   * 修改最大并发数
   */
  setMaxConcurrency(max: number): void {
    this.maxConcurrency = max
    // 尝试执行更多任务
    this.tryExecuteNext()
  }

  /**
   * 按优先级插入队列
   */
  private insertByPriority(item: QueueItem<any>): void {
    // 找到第一个优先级小于当前项的位置
    const index = this.queue.findIndex((q) => q.priority < item.priority)
    if (index === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(index, 0, item)
    }
  }

  /**
   * 尝试执行下一个任务
   */
  private tryExecuteNext(): void {
    while (this.currentRunning < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift()!

      // 检查是否已取消
      if (item.signal?.aborted) {
        item.reject(new Error('Task aborted'))
        continue
      }

      this.executeItem(item)
    }
  }

  /**
   * 执行单个任务
   */
  private async executeItem<T>(item: QueueItem<T>): Promise<void> {
    this.currentRunning++

    try {
      const result = await item.fn()
      item.resolve(result)
    } catch (error) {
      item.reject(error)
    } finally {
      this.currentRunning--
      this.tryExecuteNext()
    }
  }
}

// 默认全局实例，用于 API 调用限流
// 默认限制 3 个并发 API 调用
export const globalApiLimiter = new ConcurrencyLimiter(3)

// 图片处理专用限制器
// 图片处理消耗内存较大，限制为 2 个并发
export const imageProcessingLimiter = new ConcurrencyLimiter(2)

export default ConcurrencyLimiter
