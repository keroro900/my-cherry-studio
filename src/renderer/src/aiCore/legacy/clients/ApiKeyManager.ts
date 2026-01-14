import { loggerService } from '@logger'

const logger = loggerService.withContext('ApiKeyManager')

/**
 * Manages API key rotation with request-scoped caching.
 * Ensures that the same API key is used throughout a single request,
 * while still rotating keys between different requests.
 *
 * This follows the VCPToolBox pattern for request lifecycle management.
 */
export class ApiKeyManager {
  private keys: string[]
  private providerId: string
  private keyName: string
  private requestScopedKey: string | null = null

  constructor(apiKeyString: string, providerId: string) {
    this.keys = apiKeyString
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    this.providerId = providerId
    this.keyName = `provider:${providerId}:last_used_key`

    if (this.keys.length === 0) {
      logger.warn(`No API keys configured for provider ${providerId}`)
    }
  }

  /**
   * Get API key for a new request (rotates to next key).
   * Call this once at the start of a request.
   * @returns The API key to use for this request
   */
  public getKeyForNewRequest(): string {
    if (this.keys.length === 0) {
      this.requestScopedKey = ''
      return ''
    }

    if (this.keys.length === 1) {
      this.requestScopedKey = this.keys[0]
      return this.keys[0]
    }

    const lastUsedKey = window.keyv.get(this.keyName) as string | undefined

    let nextKey: string
    if (!lastUsedKey) {
      nextKey = this.keys[0]
    } else {
      const currentIndex = this.keys.indexOf(lastUsedKey)
      const nextIndex = (currentIndex + 1) % this.keys.length
      nextKey = this.keys[nextIndex]
    }

    window.keyv.set(this.keyName, nextKey)
    this.requestScopedKey = nextKey

    logger.debug(`Rotated to key index ${this.keys.indexOf(nextKey)} for provider ${this.providerId}`)
    return nextKey
  }

  /**
   * Get the current request's API key (does NOT rotate).
   * Use this for retries or subsequent calls within the same request.
   * @returns The cached API key for the current request
   */
  public getCurrentRequestKey(): string {
    if (this.requestScopedKey !== null) {
      return this.requestScopedKey
    }
    // Fallback: get new key if none was set
    return this.getKeyForNewRequest()
  }

  /**
   * Clear request-scoped key (call at end of request).
   * This allows the next request to get a rotated key.
   */
  public clearRequestScope(): void {
    this.requestScopedKey = null
  }

  /**
   * Check if multiple keys are configured.
   * @returns true if more than one key is available
   */
  public hasMultipleKeys(): boolean {
    return this.keys.length > 1
  }

  /**
   * Get the total number of configured keys.
   * @returns The number of API keys
   */
  public getKeyCount(): number {
    return this.keys.length
  }

  /**
   * Update the API keys (e.g., when provider settings change).
   * @param apiKeyString - Comma-separated API keys
   */
  public updateKeys(apiKeyString: string): void {
    this.keys = apiKeyString
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    // Don't clear request scope - let current request finish with its key
  }
}
