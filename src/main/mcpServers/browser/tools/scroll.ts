/**
 * 增强型浏览器工具 - 滚动控制
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

export const ScrollSchema = z.object({
  url: z.string().url().optional().describe('URL to navigate to before scrolling'),
  action: z.enum(['bottom', 'element', 'infinite']).default('bottom').describe('Scroll action type'),
  selector: z.string().optional().describe('CSS selector for element scroll (action=element)'),
  maxScrolls: z.number().min(1).max(100).default(10).describe('Max scroll count for infinite scroll'),
  scrollDelay: z.number().min(100).max(10000).default(1000).describe('Delay between scrolls (ms)'),
  waitForSelector: z.string().optional().describe('Wait for this selector after each scroll'),
  stopCondition: z.string().optional().describe('JS expression that returns true to stop scrolling'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type ScrollArgs = z.infer<typeof ScrollSchema>

export const scrollToolDefinition = {
  name: 'browser_scroll',
  description: `Control page scrolling with multiple modes.

Scroll actions:
- bottom: Scroll to page bottom once
- element: Scroll specific element into view
- infinite: Handle infinite scroll pages (lazy loading)

Infinite scroll features:
- Automatic content loading detection
- Configurable scroll delay
- Custom stop conditions via JS expression
- Wait for specific selector after each scroll`,
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to before scrolling' },
      action: {
        type: 'string',
        enum: ['bottom', 'element', 'infinite'],
        default: 'bottom',
        description: 'Scroll action'
      },
      selector: { type: 'string', description: 'CSS selector for element scroll' },
      maxScrolls: { type: 'number', minimum: 1, maximum: 100, default: 10, description: 'Max scroll count' },
      scrollDelay: {
        type: 'number',
        minimum: 100,
        maximum: 10000,
        default: 1000,
        description: 'Delay between scrolls (ms)'
      },
      waitForSelector: { type: 'string', description: 'Wait for this selector after each scroll' },
      stopCondition: { type: 'string', description: 'JS expression to stop scrolling' },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    }
  }
}

export async function handleScroll(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = ScrollSchema.parse(args)
    const { url, action, selector, maxScrolls, scrollDelay, waitForSelector, stopCondition, sessionId } = parsed

    // Navigate if URL provided
    if (url) {
      await controller.open(url, 30000, false, false, false, sessionId)
    }

    let result: Record<string, any> = { success: true, action }

    switch (action) {
      case 'bottom':
        await controller.scrollToBottom(sessionId)
        result.scrolled = true
        break

      case 'element':
        if (!selector) {
          throw new Error('Selector required for element scroll')
        }
        await controller.scrollIntoView(selector, {}, sessionId)
        result.scrolled = true
        result.selector = selector
        break

      case 'infinite': {
        const scrollResult = await controller.infiniteScroll(
          {
            maxScrolls,
            scrollDelay,
            waitForSelector,
            stopCondition
          },
          sessionId
        )
        result = { ...result, ...scrollResult }
        break
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Scroll failed: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    }
  }
}
