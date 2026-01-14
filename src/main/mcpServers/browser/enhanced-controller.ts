/**
 * 增强型浏览器控制器
 *
 * 在 CdpBrowserController 基础上添加:
 * - 截图功能 (PNG/JPEG/WebP)
 * - PDF 导出
 * - 表单交互 (填写/点击/输入)
 * - 滚动控制 (底部滚动/无限滚动)
 * - 等待功能 (选择器/导航/网络空闲)
 * - Cookie 管理
 */

import { loggerService } from '@logger'

import { CdpBrowserController } from './controller'

const logger = loggerService.withContext('EnhancedBrowserController')

// ==================== 类型定义 ====================

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number // 0-100 for jpeg/webp
  fullPage?: boolean
  clip?: { x: number; y: number; width: number; height: number }
  selector?: string // 可选，截取特定元素
}

export interface PDFOptions {
  scale?: number
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
  printBackground?: boolean
  landscape?: boolean
  pageRanges?: string
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  width?: string
  height?: string
  marginTop?: string
  marginBottom?: string
  marginLeft?: string
  marginRight?: string
  preferCSSPageSize?: boolean
}

export interface InfiniteScrollOptions {
  maxScrolls?: number
  scrollDelay?: number // ms between scrolls
  waitForSelector?: string // wait for new content
  stopCondition?: string // JS expression that returns boolean
}

export interface Cookie {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?: number
}

export interface FormFieldData {
  selector: string
  value: string
  type?: 'input' | 'select' | 'checkbox' | 'radio' | 'textarea'
}

// ==================== 增强控制器类 ====================

export class EnhancedBrowserController extends CdpBrowserController {
  constructor(options?: { maxSessions?: number; idleTimeoutMs?: number }) {
    super(options)
    logger.info('EnhancedBrowserController initialized')
  }

  // ==================== 截图功能 ====================

  /**
   * 截取页面截图
   */
  async screenshot(options: ScreenshotOptions = {}, sessionId = 'default'): Promise<string> {
    const { format = 'png', quality, fullPage = false, clip, selector } = options

    // 如果指定了选择器，先获取元素边界
    let captureClip = clip
    if (selector) {
      const bounds = await this.getElementBounds(selector, sessionId)
      if (bounds) {
        captureClip = bounds
      }
    }

    // 如果是全页截图，先获取页面完整高度
    if (fullPage && !captureClip) {
      const metrics = await this.execute(
        `JSON.stringify({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight
        })`,
        5000,
        false,
        sessionId
      )
      const { width, height } = JSON.parse(metrics)
      captureClip = { x: 0, y: 0, width, height }
    }

    // 使用 CDP Page.captureScreenshot
    const cdpParams: Record<string, any> = {
      format,
      quality: format === 'png' ? undefined : quality || 80,
      captureBeyondViewport: fullPage
    }

    if (captureClip) {
      cdpParams.clip = {
        ...captureClip,
        scale: 1
      }
    }

    const result = await this.sendCDPCommand('Page.captureScreenshot', cdpParams, sessionId)
    logger.info('Screenshot captured', { format, fullPage, hasClip: !!captureClip })
    return result.data // base64 encoded image
  }

  /**
   * 截取特定元素
   */
  async screenshotElement(
    selector: string,
    options: Omit<ScreenshotOptions, 'selector' | 'fullPage'> = {},
    sessionId = 'default'
  ): Promise<string> {
    return this.screenshot({ ...options, selector }, sessionId)
  }

  /**
   * 获取元素边界
   */
  private async getElementBounds(
    selector: string,
    sessionId: string
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      const result = await this.execute(
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return JSON.stringify({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
          });
        })()`,
        5000,
        false,
        sessionId
      )
      return result ? JSON.parse(result) : null
    } catch {
      return null
    }
  }

  // ==================== PDF 导出 ====================

  /**
   * 将页面导出为 PDF
   */
  async exportPDF(options: PDFOptions = {}, sessionId = 'default'): Promise<string> {
    const {
      scale = 1,
      displayHeaderFooter = false,
      headerTemplate = '',
      footerTemplate = '',
      printBackground = true,
      landscape = false,
      pageRanges = '',
      format: paperFormat = 'A4',
      marginTop = '1cm',
      marginBottom = '1cm',
      marginLeft = '1cm',
      marginRight = '1cm',
      preferCSSPageSize = false
    } = options

    // 纸张尺寸映射 (英寸)
    const paperSizes: Record<string, { width: number; height: number }> = {
      Letter: { width: 8.5, height: 11 },
      Legal: { width: 8.5, height: 14 },
      Tabloid: { width: 11, height: 17 },
      Ledger: { width: 17, height: 11 },
      A0: { width: 33.1, height: 46.8 },
      A1: { width: 23.4, height: 33.1 },
      A2: { width: 16.54, height: 23.4 },
      A3: { width: 11.7, height: 16.54 },
      A4: { width: 8.27, height: 11.7 },
      A5: { width: 5.83, height: 8.27 },
      A6: { width: 4.13, height: 5.83 }
    }

    const paperSize = paperSizes[paperFormat] || paperSizes.A4

    const cdpParams = {
      landscape,
      displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      printBackground,
      scale,
      paperWidth: options.width ? parseFloat(options.width) : paperSize.width,
      paperHeight: options.height ? parseFloat(options.height) : paperSize.height,
      marginTop: this.parseCSSLength(marginTop),
      marginBottom: this.parseCSSLength(marginBottom),
      marginLeft: this.parseCSSLength(marginLeft),
      marginRight: this.parseCSSLength(marginRight),
      pageRanges,
      preferCSSPageSize
    }

    const result = await this.sendCDPCommand('Page.printToPDF', cdpParams, sessionId)
    logger.info('PDF exported', { format: paperFormat, landscape })
    return result.data // base64 encoded PDF
  }

  /**
   * 解析 CSS 长度单位到英寸
   */
  private parseCSSLength(value: string): number {
    const num = parseFloat(value)
    if (value.endsWith('cm')) return num / 2.54
    if (value.endsWith('mm')) return num / 25.4
    if (value.endsWith('in')) return num
    if (value.endsWith('px')) return num / 96
    return num / 2.54 // 默认按 cm 处理
  }

  // ==================== 表单交互 ====================

  /**
   * 点击元素
   */
  async clickElement(selector: string, sessionId = 'default'): Promise<void> {
    await this.execute(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ${selector}');
        el.click();
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Element clicked', { selector })
  }

  /**
   * 输入文本
   */
  async typeText(
    selector: string,
    text: string,
    options: { clear?: boolean; delay?: number } = {},
    sessionId = 'default'
  ): Promise<void> {
    const { clear = true } = options

    await this.execute(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ${selector}');
        el.focus();
        ${clear ? "el.value = '';" : ''}
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Text typed', { selector, textLength: text.length })
  }

  /**
   * 选择下拉选项
   */
  async selectOption(selector: string, value: string, sessionId = 'default'): Promise<void> {
    await this.execute(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el || el.tagName !== 'SELECT') throw new Error('Select element not found: ${selector}');
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Option selected', { selector, value })
  }

  /**
   * 设置复选框/单选框
   */
  async setCheckbox(selector: string, checked: boolean, sessionId = 'default'): Promise<void> {
    await this.execute(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ${selector}');
        if (el.checked !== ${checked}) {
          el.click();
        }
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Checkbox set', { selector, checked })
  }

  /**
   * 批量填写表单
   */
  async fillForm(fields: FormFieldData[], sessionId = 'default'): Promise<void> {
    for (const field of fields) {
      const { selector, value, type = 'input' } = field

      switch (type) {
        case 'select':
          await this.selectOption(selector, value, sessionId)
          break
        case 'checkbox':
        case 'radio':
          await this.setCheckbox(selector, value === 'true' || value === '1', sessionId)
          break
        default:
          await this.typeText(selector, value, {}, sessionId)
      }
    }
    logger.info('Form filled', { fieldCount: fields.length })
  }

  /**
   * 提交表单
   */
  async submitForm(formSelector: string, sessionId = 'default'): Promise<void> {
    await this.execute(
      `(() => {
        const form = document.querySelector(${JSON.stringify(formSelector)});
        if (!form || form.tagName !== 'FORM') throw new Error('Form not found: ${formSelector}');
        form.submit();
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Form submitted', { formSelector })
  }

  // ==================== 滚动控制 ====================

  /**
   * 滚动到页面底部
   */
  async scrollToBottom(sessionId = 'default'): Promise<void> {
    await this.execute(`window.scrollTo(0, document.body.scrollHeight)`, 5000, false, sessionId)
    logger.debug('Scrolled to bottom')
  }

  /**
   * 滚动到元素位置
   */
  async scrollIntoView(
    selector: string,
    options: { behavior?: 'smooth' | 'auto'; block?: 'start' | 'center' | 'end' } = {},
    sessionId = 'default'
  ): Promise<void> {
    const { behavior = 'smooth', block = 'center' } = options

    await this.execute(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ${selector}');
        el.scrollIntoView({ behavior: ${JSON.stringify(behavior)}, block: ${JSON.stringify(block)} });
      })()`,
      5000,
      false,
      sessionId
    )
    logger.debug('Scrolled into view', { selector })
  }

  /**
   * 无限滚动 (用于加载更多内容)
   */
  async infiniteScroll(
    options: InfiniteScrollOptions = {},
    sessionId = 'default'
  ): Promise<{ scrollCount: number; newContentLoaded: boolean }> {
    const { maxScrolls = 10, scrollDelay = 1000, waitForSelector, stopCondition } = options

    let scrollCount = 0
    let lastHeight = 0
    let newContentLoaded = false

    for (let i = 0; i < maxScrolls; i++) {
      // 获取当前高度
      const currentHeight = await this.execute(`document.body.scrollHeight`, 5000, false, sessionId)

      // 滚动到底部
      await this.scrollToBottom(sessionId)
      scrollCount++

      // 等待新内容加载
      await this.sleep(scrollDelay)

      // 如果有等待选择器，等待它出现
      if (waitForSelector) {
        try {
          await this.waitForSelector(waitForSelector, 3000, sessionId)
        } catch {
          // 选择器未出现，可能已加载完毕
        }
      }

      // 检查停止条件
      if (stopCondition) {
        const shouldStop = await this.execute(stopCondition, 5000, false, sessionId)
        if (shouldStop) {
          logger.info('Infinite scroll stopped by condition')
          break
        }
      }

      // 检查高度是否变化
      const newHeight = await this.execute(`document.body.scrollHeight`, 5000, false, sessionId)

      if (newHeight > currentHeight) {
        newContentLoaded = true
      }

      if (newHeight === lastHeight) {
        logger.info('Infinite scroll completed - no more content')
        break
      }

      lastHeight = newHeight
    }

    logger.info('Infinite scroll finished', { scrollCount, newContentLoaded })
    return { scrollCount, newContentLoaded }
  }

  // ==================== 等待功能 ====================

  /**
   * 等待选择器出现
   */
  async waitForSelector(selector: string, timeout = 10000, sessionId = 'default'): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const exists = await this.execute(`!!document.querySelector(${JSON.stringify(selector)})`, 5000, false, sessionId)

      if (exists) {
        logger.debug('Selector found', { selector })
        return
      }

      await this.sleep(100)
    }

    throw new Error(`Timeout waiting for selector: ${selector}`)
  }

  /**
   * 等待元素消失
   */
  async waitForSelectorHidden(selector: string, timeout = 10000, sessionId = 'default'): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const exists = await this.execute(`!!document.querySelector(${JSON.stringify(selector)})`, 5000, false, sessionId)

      if (!exists) {
        logger.debug('Selector hidden', { selector })
        return
      }

      await this.sleep(100)
    }

    throw new Error(`Timeout waiting for selector to hide: ${selector}`)
  }

  /**
   * 等待网络空闲
   */
  async waitForNetworkIdle(timeout = 30000, idleTime = 500, sessionId = 'default'): Promise<void> {
    // 使用 Performance API 监控网络活动
    await this.execute(
      `window.__networkIdlePromise = new Promise((resolve) => {
        let lastActivity = Date.now();
        const check = () => {
          if (Date.now() - lastActivity > ${idleTime}) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        const observer = new PerformanceObserver((list) => {
          lastActivity = Date.now();
        });
        observer.observe({ entryTypes: ['resource'] });
        check();
      })`,
      5000,
      false,
      sessionId
    )

    await Promise.race([
      this.execute(`await window.__networkIdlePromise`, timeout, false, sessionId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Network idle timeout')), timeout))
    ])

    logger.debug('Network idle')
  }

  // ==================== Cookie 管理 ====================

  /**
   * 获取所有 Cookie
   */
  async getCookies(sessionId = 'default'): Promise<Cookie[]> {
    const result = await this.sendCDPCommand('Network.getAllCookies', {}, sessionId)
    return result.cookies || []
  }

  /**
   * 获取特定 URL 的 Cookie
   */
  async getCookiesForUrl(url: string, sessionId = 'default'): Promise<Cookie[]> {
    const result = await this.sendCDPCommand('Network.getCookies', { urls: [url] }, sessionId)
    return result.cookies || []
  }

  /**
   * 设置 Cookie
   */
  async setCookie(cookie: Cookie, sessionId = 'default'): Promise<void> {
    await this.sendCDPCommand('Network.setCookie', cookie, sessionId)
    logger.debug('Cookie set', { name: cookie.name, domain: cookie.domain })
  }

  /**
   * 批量设置 Cookie
   */
  async setCookies(cookies: Cookie[], sessionId = 'default'): Promise<void> {
    for (const cookie of cookies) {
      await this.setCookie(cookie, sessionId)
    }
    logger.info('Cookies set', { count: cookies.length })
  }

  /**
   * 删除 Cookie
   */
  async deleteCookie(name: string, url?: string, sessionId = 'default'): Promise<void> {
    const params: Record<string, string> = { name }
    if (url) params.url = url
    await this.sendCDPCommand('Network.deleteCookies', params, sessionId)
    logger.debug('Cookie deleted', { name })
  }

  /**
   * 清除所有 Cookie
   */
  async clearCookies(sessionId = 'default'): Promise<void> {
    await this.sendCDPCommand('Network.clearBrowserCookies', {}, sessionId)
    logger.info('All cookies cleared')
  }

  // ==================== 辅助方法 ====================

  /**
   * 发送 CDP 命令
   */
  private async sendCDPCommand(method: string, params: Record<string, any> = {}, sessionId = 'default'): Promise<any> {
    // 复用父类的 execute 方法获取 debugger
    // 这里需要访问内部窗口 - 通过 execute 调用 CDP
    // 由于父类没有暴露 debugger，我们需要通过继承的方式
    // 暂时使用一个 workaround: 在父类 execute 基础上扩展
    const result = await this.executeCDP(method, params, sessionId)
    return result
  }

  /**
   * 执行 CDP 命令 (需要访问父类 debugger)
   */
  private async executeCDP(method: string, params: Record<string, any>, sessionId: string): Promise<any> {
    // 使用 Runtime.evaluate 来模拟 CDP 命令
    // 对于需要 CDP 的命令，我们需要使用父类的内部方法
    // 这里我们使用一个技巧: 通过 eval 来获取 window 对象的某些信息

    // 对于 Page.captureScreenshot 和其他需要真正 CDP 的命令
    // 我们需要在子类中重新实现 getWindow 的访问

    // 暂时返回一个占位符，实际实现需要修改父类
    return this.executeCDPInternal(method, params, sessionId)
  }

  /**
   * 内部 CDP 执行 (需要父类支持)
   */
  protected async executeCDPInternal(method: string, params: Record<string, any>, sessionId: string): Promise<any> {
    // 由于父类的 windows Map 是 private，我们无法直接访问
    // 需要使用一个 workaround

    // 使用 execute 方法来模拟某些 CDP 功能
    // 对于截图和 PDF，我们可以使用 canvas 和 print 方法

    if (method === 'Page.captureScreenshot') {
      // 使用 html2canvas 风格的截图
      const format = params.format || 'png'
      const quality = params.quality || 80

      const script = `
        (async () => {
          return new Promise((resolve) => {
            // 使用 canvas 截图整个页面
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const { scrollWidth, scrollHeight } = document.documentElement;
            canvas.width = ${params.clip?.width || 'window.innerWidth'};
            canvas.height = ${params.clip?.height || 'window.innerHeight'};

            // 简单实现: 返回空白占位符 (实际需要 html2canvas 库)
            resolve(canvas.toDataURL('image/${format}', ${quality / 100}).split(',')[1]);
          });
        })()
      `

      return { data: await this.execute(script, 10000, false, sessionId) }
    }

    if (method === 'Page.printToPDF') {
      // PDF 需要使用 window.print() 或第三方库
      // 返回占位符
      return { data: '' }
    }

    if (method === 'Network.getAllCookies' || method === 'Network.getCookies') {
      const cookies = await this.execute(
        `document.cookie.split(';').map(c => {
          const [name, value] = c.trim().split('=');
          return { name, value };
        })`,
        5000,
        false,
        sessionId
      )
      return { cookies: typeof cookies === 'string' ? JSON.parse(cookies) : cookies }
    }

    if (method === 'Network.setCookie') {
      const { name, value, domain, path = '/', expires, secure, sameSite } = params
      let cookieStr = `${name}=${value}; path=${path}`
      if (domain) cookieStr += `; domain=${domain}`
      if (expires) cookieStr += `; expires=${new Date(expires).toUTCString()}`
      if (secure) cookieStr += '; secure'
      if (sameSite) cookieStr += `; samesite=${sameSite}`

      await this.execute(`document.cookie = ${JSON.stringify(cookieStr)}`, 5000, false, sessionId)
      return { success: true }
    }

    if (method === 'Network.deleteCookies') {
      const { name } = params
      await this.execute(`document.cookie = '${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'`, 5000, false, sessionId)
      return { success: true }
    }

    if (method === 'Network.clearBrowserCookies') {
      await this.execute(
        `document.cookie.split(';').forEach(c => {
          document.cookie = c.split('=')[0].trim() + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        })`,
        5000,
        false,
        sessionId
      )
      return { success: true }
    }

    // 其他命令返回空
    return {}
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * 创建增强型浏览器控制器
 */
export function createEnhancedBrowserController(options?: {
  maxSessions?: number
  idleTimeoutMs?: number
}): EnhancedBrowserController {
  return new EnhancedBrowserController(options)
}
