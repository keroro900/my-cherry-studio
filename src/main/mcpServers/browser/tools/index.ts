/**
 * 增强型浏览器工具导出
 */

// 基础工具导出
export { ExecuteSchema, executeToolDefinition, handleExecute } from './execute'
export { FetchSchema, fetchToolDefinition, handleFetch } from './fetch'
export { handleOpen, OpenSchema, openToolDefinition } from './open'
export { handleReset, resetToolDefinition } from './reset'

// 增强型工具导出
export { CookiesSchema, cookiesToolDefinition, handleCookies } from './cookies'
export { FormSchema, formToolDefinition, handleForm } from './form'
export { handlePDF, PDFSchema, pdfToolDefinition } from './pdf'
export { handleScreenshot, ScreenshotSchema, screenshotToolDefinition } from './screenshot'
export { handleScroll, ScrollSchema, scrollToolDefinition } from './scroll'
export { handleWait, WaitSchema, waitToolDefinition } from './wait'

import type { CdpBrowserController } from '../controller'
import type { EnhancedBrowserController } from '../enhanced-controller'
import { cookiesToolDefinition, handleCookies } from './cookies'
import { executeToolDefinition, handleExecute } from './execute'
import { fetchToolDefinition, handleFetch } from './fetch'
import { formToolDefinition, handleForm } from './form'
import { handleOpen, openToolDefinition } from './open'
import { handlePDF, pdfToolDefinition } from './pdf'
import { handleReset, resetToolDefinition } from './reset'
import { handleScreenshot, screenshotToolDefinition } from './screenshot'
import { handleScroll, scrollToolDefinition } from './scroll'
import { handleWait, waitToolDefinition } from './wait'

// 基础工具定义
export const toolDefinitions = [openToolDefinition, executeToolDefinition, resetToolDefinition, fetchToolDefinition]

// 增强型工具定义
export const enhancedToolDefinitions = [
  openToolDefinition,
  executeToolDefinition,
  resetToolDefinition,
  fetchToolDefinition,
  screenshotToolDefinition,
  pdfToolDefinition,
  formToolDefinition,
  scrollToolDefinition,
  waitToolDefinition,
  cookiesToolDefinition
]

// 基础工具处理器
export const toolHandlers: Record<
  string,
  (
    controller: CdpBrowserController,
    args: unknown
  ) => Promise<{ content: { type: string; text: string }[]; isError: boolean }>
> = {
  open: handleOpen,
  execute: handleExecute,
  reset: handleReset,
  fetch: handleFetch
}

// 增强型工具处理器
export const enhancedToolHandlers: Record<
  string,
  (
    controller: EnhancedBrowserController,
    args: unknown
  ) => Promise<{ content: { type: string; text: string }[]; isError: boolean }>
> = {
  // 基础工具
  open: handleOpen as any,
  execute: handleExecute as any,
  reset: handleReset as any,
  fetch: handleFetch as any,
  // 增强型工具
  browser_screenshot: handleScreenshot,
  browser_pdf: handlePDF,
  browser_form: handleForm,
  browser_scroll: handleScroll,
  browser_wait: handleWait,
  browser_cookies: handleCookies
}
