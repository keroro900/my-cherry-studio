/**
 * 增强型浏览器工具 - 等待
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

export const WaitSchema = z.object({
  action: z.enum(['selector', 'hidden', 'network', 'time']).describe('Wait action type'),
  selector: z.string().optional().describe('CSS selector to wait for (action=selector or hidden)'),
  timeout: z.number().min(100).max(60000).default(10000).describe('Timeout in milliseconds'),
  time: z.number().min(100).max(60000).optional().describe('Fixed wait time in ms (action=time)'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type WaitArgs = z.infer<typeof WaitSchema>

export const waitToolDefinition = {
  name: 'browser_wait',
  description: `Wait for various conditions in the browser.

Wait actions:
- selector: Wait for CSS selector to appear in DOM
- hidden: Wait for CSS selector to disappear from DOM
- network: Wait for network activity to become idle
- time: Fixed delay (for debugging or rate limiting)

Useful for:
- Waiting for dynamic content to load
- Waiting for modals/overlays to close
- Synchronizing with AJAX requests`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['selector', 'hidden', 'network', 'time'],
        description: 'Wait action type'
      },
      selector: { type: 'string', description: 'CSS selector (for selector/hidden actions)' },
      timeout: { type: 'number', minimum: 100, maximum: 60000, default: 10000, description: 'Timeout in ms' },
      time: { type: 'number', minimum: 100, maximum: 60000, description: 'Fixed wait time (for time action)' },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    },
    required: ['action']
  }
}

export async function handleWait(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = WaitSchema.parse(args)
    const { action, selector, timeout, time, sessionId } = parsed

    const startTime = Date.now()
    const result: Record<string, any> = { success: true, action }

    switch (action) {
      case 'selector':
        if (!selector) {
          throw new Error('Selector required for selector wait')
        }
        await controller.waitForSelector(selector, timeout, sessionId)
        result.selector = selector
        result.found = true
        break

      case 'hidden':
        if (!selector) {
          throw new Error('Selector required for hidden wait')
        }
        await controller.waitForSelectorHidden(selector, timeout, sessionId)
        result.selector = selector
        result.hidden = true
        break

      case 'network':
        await controller.waitForNetworkIdle(timeout, 500, sessionId)
        result.networkIdle = true
        break

      case 'time':
        if (!time) {
          throw new Error('Time required for time wait')
        }
        await new Promise((resolve) => setTimeout(resolve, time))
        result.waited = time
        break
    }

    result.elapsed = Date.now() - startTime

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Wait failed: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    }
  }
}
