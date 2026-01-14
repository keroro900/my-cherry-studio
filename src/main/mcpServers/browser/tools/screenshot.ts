/**
 * 增强型浏览器工具 - 截图
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

export const ScreenshotSchema = z.object({
  url: z.string().url().optional().describe('URL to screenshot (uses current page if not provided)'),
  format: z.enum(['png', 'jpeg', 'webp']).default('png').describe('Image format'),
  quality: z.number().min(0).max(100).default(80).describe('Quality for JPEG/WebP (0-100)'),
  fullPage: z.boolean().default(false).describe('Capture full page (including scroll)'),
  selector: z.string().optional().describe('CSS selector to capture specific element'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type ScreenshotArgs = z.infer<typeof ScreenshotSchema>

export const screenshotToolDefinition = {
  name: 'browser_screenshot',
  description: `Capture a screenshot of the current page or a specific element.

Features:
- Full page screenshot (captures entire scrollable content)
- Element screenshot (capture specific CSS selector)
- Multiple formats: PNG, JPEG, WebP
- Quality control for JPEG/WebP

Returns base64-encoded image data.`,
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to screenshot (uses current page if not provided)' },
      format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png', description: 'Image format' },
      quality: { type: 'number', minimum: 0, maximum: 100, default: 80, description: 'Quality for JPEG/WebP' },
      fullPage: { type: 'boolean', default: false, description: 'Capture full page' },
      selector: { type: 'string', description: 'CSS selector to capture specific element' },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    }
  }
}

export async function handleScreenshot(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = ScreenshotSchema.parse(args)
    const { url, format, quality, fullPage, selector, sessionId } = parsed

    // Navigate if URL provided
    if (url) {
      await controller.open(url, 30000, false, false, false, sessionId)
    }

    // Capture screenshot
    const base64Data = await controller.screenshot({ format, quality, fullPage, selector }, sessionId)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              format,
              fullPage,
              selector: selector || null,
              dataLength: base64Data.length,
              data: base64Data
            },
            null,
            2
          )
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    }
  }
}
