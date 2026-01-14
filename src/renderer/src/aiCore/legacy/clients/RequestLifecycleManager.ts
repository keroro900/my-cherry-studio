import { loggerService } from '@logger'

const logger = loggerService.withContext('RequestLifecycleManager')

/**
 * Represents an active request with its associated resources
 */
export interface ActiveRequest {
  messageId: string
  controller: AbortController
  startTime: number
  cleanup: () => void
  aborted: boolean
}

/**
 * Centralized request lifecycle management.
 * Follows VCPToolBox's activeRequests pattern for consistent request handling.
 *
 * Features:
 * - Register requests with unique message IDs
 * - Abort individual or all active requests
 * - Track request lifecycle (start, complete, abort)
 * - Cleanup resources on request end
 */
class RequestLifecycleManager {
  private activeRequests: Map<string, ActiveRequest> = new Map()

  /**
   * Register a new request.
   * If a request with the same ID already exists, it will be aborted first.
   *
   * @param messageId - Unique identifier for the request
   * @param cleanup - Optional cleanup function to call when request ends
   * @returns AbortController for the request
   */
  public register(messageId: string, cleanup?: () => void): AbortController {
    // Cancel existing request with same ID
    if (this.activeRequests.has(messageId)) {
      logger.warn(`Request ${messageId} already exists, aborting previous`)
      this.abort(messageId)
    }

    const controller = new AbortController()

    this.activeRequests.set(messageId, {
      messageId,
      controller,
      startTime: Date.now(),
      cleanup: cleanup || (() => {}),
      aborted: false
    })

    logger.debug(`Registered request: ${messageId}`)
    return controller
  }

  /**
   * Abort a specific request.
   *
   * @param messageId - The request ID to abort
   * @returns true if the request was found and aborted
   */
  public abort(messageId: string): boolean {
    const request = this.activeRequests.get(messageId)
    if (!request) {
      logger.debug(`No active request found for: ${messageId}`)
      return false
    }

    if (request.aborted) {
      logger.debug(`Request ${messageId} already aborted`)
      return true
    }

    try {
      request.aborted = true
      request.controller.abort()
      request.cleanup()
      logger.info(`Aborted request: ${messageId}`)
    } catch (error) {
      logger.error(`Error aborting request ${messageId}:`, error as Error)
    } finally {
      this.activeRequests.delete(messageId)
    }

    return true
  }

  /**
   * Complete a request (normal end).
   * Runs cleanup and removes from tracking.
   *
   * @param messageId - The request ID to complete
   */
  public complete(messageId: string): void {
    const request = this.activeRequests.get(messageId)
    if (request && !request.aborted) {
      try {
        request.cleanup()
      } catch (error) {
        logger.error(`Error during cleanup for request ${messageId}:`, error as Error)
      }
    }
    this.activeRequests.delete(messageId)
    logger.debug(`Completed request: ${messageId}`)
  }

  /**
   * Check if a request is currently active.
   *
   * @param messageId - The request ID to check
   * @returns true if the request is active and not aborted
   */
  public isActive(messageId: string): boolean {
    const request = this.activeRequests.get(messageId)
    return request !== undefined && !request.aborted
  }

  /**
   * Get the abort signal for a request.
   *
   * @param messageId - The request ID
   * @returns The AbortSignal or undefined if not found
   */
  public getSignal(messageId: string): AbortSignal | undefined {
    return this.activeRequests.get(messageId)?.controller.signal
  }

  /**
   * Get the AbortController for a request.
   *
   * @param messageId - The request ID
   * @returns The AbortController or undefined if not found
   */
  public getController(messageId: string): AbortController | undefined {
    return this.activeRequests.get(messageId)?.controller
  }

  /**
   * Abort all active requests.
   */
  public abortAll(): void {
    const count = this.activeRequests.size
    if (count === 0) {
      return
    }

    logger.info(`Aborting all ${count} active requests`)
    for (const [messageId] of this.activeRequests) {
      this.abort(messageId)
    }
  }

  /**
   * Get the count of active requests.
   */
  public get count(): number {
    return this.activeRequests.size
  }

  /**
   * Get all active request IDs.
   */
  public getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys())
  }

  /**
   * Get the duration of an active request in milliseconds.
   *
   * @param messageId - The request ID
   * @returns Duration in ms or undefined if not found
   */
  public getRequestDuration(messageId: string): number | undefined {
    const request = this.activeRequests.get(messageId)
    if (request) {
      return Date.now() - request.startTime
    }
    return undefined
  }
}

/**
 * Singleton instance of RequestLifecycleManager.
 * Use this for global request lifecycle management.
 */
export const requestLifecycleManager = new RequestLifecycleManager()
