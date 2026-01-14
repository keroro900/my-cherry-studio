/**
 * 增强型浏览器工具 - Cookie 管理
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

const CookieSchema = z.object({
  name: z.string().describe('Cookie name'),
  value: z.string().describe('Cookie value'),
  domain: z.string().optional().describe('Cookie domain'),
  path: z.string().default('/').describe('Cookie path'),
  secure: z.boolean().default(false).describe('Secure flag'),
  httpOnly: z.boolean().default(false).describe('HttpOnly flag'),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('SameSite attribute'),
  expires: z.number().optional().describe('Expiration timestamp')
})

export const CookiesSchema = z.object({
  action: z.enum(['get', 'set', 'delete', 'clear']).describe('Cookie action'),
  url: z.string().url().optional().describe('URL for cookie operations'),
  cookies: z.array(CookieSchema).optional().describe('Cookies to set (action=set)'),
  names: z.array(z.string()).optional().describe('Cookie names to delete (action=delete)'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type CookiesArgs = z.infer<typeof CookiesSchema>

export const cookiesToolDefinition = {
  name: 'browser_cookies',
  description: `Manage browser cookies.

Actions:
- get: Get all cookies or cookies for specific URL
- set: Set one or more cookies
- delete: Delete specific cookies by name
- clear: Clear all cookies

Cookie properties:
- name, value: Required for set
- domain: Cookie domain (defaults to current)
- path: Cookie path (defaults to /)
- secure: HTTPS only flag
- httpOnly: JavaScript inaccessible
- sameSite: Cross-site request policy
- expires: Expiration timestamp`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'delete', 'clear'],
        description: 'Cookie action'
      },
      url: { type: 'string', description: 'URL for cookie operations' },
      cookies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            domain: { type: 'string' },
            path: { type: 'string', default: '/' },
            secure: { type: 'boolean', default: false },
            httpOnly: { type: 'boolean', default: false },
            sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] },
            expires: { type: 'number' }
          },
          required: ['name', 'value']
        },
        description: 'Cookies to set'
      },
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cookie names to delete'
      },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    },
    required: ['action']
  }
}

export async function handleCookies(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = CookiesSchema.parse(args)
    const { action, url, cookies, names, sessionId } = parsed

    const result: Record<string, any> = { success: true, action }

    switch (action) {
      case 'get': {
        const gotCookies = url
          ? await controller.getCookiesForUrl(url, sessionId)
          : await controller.getCookies(sessionId)
        result.cookies = gotCookies
        result.count = gotCookies.length
        break
      }

      case 'set': {
        if (!cookies || cookies.length === 0) {
          throw new Error('Cookies required for set action')
        }
        await controller.setCookies(cookies, sessionId)
        result.set = cookies.length
        break
      }

      case 'delete': {
        if (!names || names.length === 0) {
          throw new Error('Cookie names required for delete action')
        }
        for (const name of names) {
          await controller.deleteCookie(name, url, sessionId)
        }
        result.deleted = names
        break
      }

      case 'clear': {
        await controller.clearCookies(sessionId)
        result.cleared = true
        break
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `Cookie operation failed: ${error instanceof Error ? error.message : String(error)}` }
      ],
      isError: true
    }
  }
}
