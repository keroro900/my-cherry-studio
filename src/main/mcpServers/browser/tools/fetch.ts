import * as z from 'zod'

import type { CdpBrowserController } from '../controller'
import { logger } from '../types'
import { errorResponse, successResponse } from './utils'

export const FetchSchema = z.object({
  url: z.url().describe('URL to fetch'),
  format: z
    .enum(['html', 'txt', 'markdown', 'json'])
    .optional()
    .default('markdown')
    .describe("Output format: 'html', 'txt', 'markdown', or 'json' (default: markdown)"),
  timeout: z.number().optional().describe('Navigation timeout in ms (default: 10000)'),
  privateMode: z.boolean().optional().describe('Use incognito mode, no data persisted (default: false)'),
  newTab: z.boolean().optional().describe('Open in new tab, required for parallel requests (default: false)'),
  showWindow: z.boolean().optional().default(true).describe('Show browser window (default: true)'),
  tabId: z.string().optional().describe('Reuse an existing tab ID')
})

export const fetchToolDefinition = {
  name: 'fetch',
  description: 'Fetch a URL and return page content in the requested format, plus tabId.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch'
      },
      format: {
        type: 'string',
        enum: ['html', 'txt', 'markdown', 'json'],
        description: "Output format: 'html', 'txt', 'markdown', or 'json' (default: markdown)"
      },
      timeout: {
        type: 'number',
        description: 'Navigation timeout in ms (default: 10000)'
      },
      privateMode: {
        type: 'boolean',
        description: 'Use incognito mode, no data persisted (default: false)'
      },
      newTab: {
        type: 'boolean',
        description: 'Open in new tab, required for parallel requests (default: false)'
      },
      showWindow: {
        type: 'boolean',
        description: 'Show browser window (default: true)'
      },
      tabId: {
        type: 'string',
        description: 'Reuse an existing tab ID'
      }
    },
    required: ['url']
  }
}

export async function handleFetch(controller: CdpBrowserController, args: unknown) {
  try {
    const { url, format, timeout, privateMode, newTab, showWindow, tabId } = FetchSchema.parse(args)
    const res = await controller.fetch(
      url,
      format,
      timeout ?? 10000,
      privateMode ?? false,
      newTab ?? false,
      showWindow,
      tabId
    )
    return successResponse(JSON.stringify(res))
  } catch (error) {
    logger.error('Fetch failed', {
      error,
      url: args && typeof args === 'object' && 'url' in args ? args.url : undefined
    })
    return errorResponse(error instanceof Error ? error : String(error))
  }
}

