/**
 * 全局样式 Provider
 * Global Style Provider
 *
 * 统一处理所有样式注入
 *
 * 样式优先级（从低到高）：
 * 1. 基础 CSS 文件（index.css, themeVariables.css 等）
 * 2. 壁纸预设 CSS（注入到 <style id="wallpaper-preset-css">）
 * 3. 用户自定义 CSS（最高优先级，注入到 <style id="user-defined-custom-css">）
 *
 * 壁纸预设 = 主题预设（包含壁纸图片 + 完整组件样式）
 */

import { useAppSelector } from '@renderer/store'
import { getPresetById } from '@renderer/types/wallpaperPresets'
import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'

// CSS 样式元素 ID
const PRESET_CSS_ELEMENT_ID = 'wallpaper-preset-css'
const CUSTOM_CSS_ELEMENT_ID = 'user-defined-custom-css'

/**
 * 应用壁纸预设 CSS
 * 优先级低于用户自定义 CSS
 */
function applyPresetCSS(presetId: string | undefined) {
  // 移除现有的预设 CSS 元素
  let presetCssElement = document.getElementById(PRESET_CSS_ELEMENT_ID) as HTMLStyleElement
  if (presetCssElement) {
    presetCssElement.remove()
  }

  // 如果没有选择预设，直接返回
  if (!presetId) {
    return
  }

  // 获取预设
  const preset = getPresetById(presetId)
  if (!preset || !preset.presetCss) {
    return
  }

  // 创建新的 style 元素并插入到 head 中
  // 确保在自定义 CSS 之前插入，以便自定义 CSS 可以覆盖
  presetCssElement = document.createElement('style')
  presetCssElement.id = PRESET_CSS_ELEMENT_ID
  presetCssElement.textContent = preset.presetCss

  // 查找自定义 CSS 元素的位置
  const customCssElement = document.getElementById(CUSTOM_CSS_ELEMENT_ID)
  if (customCssElement) {
    // 在自定义 CSS 之前插入
    customCssElement.parentNode?.insertBefore(presetCssElement, customCssElement)
  } else {
    // 如果没有自定义 CSS，直接添加到 head 末尾
    document.head.appendChild(presetCssElement)
  }
}

/**
 * 应用用户自定义 CSS
 * 优先级最高，可以覆盖预设 CSS
 */
function applyCustomCSS(customCss: string) {
  // 移除现有的自定义 CSS 元素
  let customCssElement = document.getElementById(CUSTOM_CSS_ELEMENT_ID) as HTMLStyleElement
  if (customCssElement) {
    customCssElement.remove()
  }

  // 如果有自定义 CSS，创建新的 style 元素
  if (customCss && customCss.trim()) {
    customCssElement = document.createElement('style')
    customCssElement.id = CUSTOM_CSS_ELEMENT_ID
    customCssElement.textContent = customCss
    document.head.appendChild(customCssElement)
  }
}

/**
 * 全局样式 Provider 组件
 */
export const GlobalStyleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  // 获取壁纸预设ID（壁纸预设 = 主题预设）
  const activePresetId = useAppSelector((state) => state.settings.wallpaper?.activePresetId)

  // 获取用户自定义 CSS
  const customCss = useAppSelector((state) => state.settings.customCss)

  // 应用壁纸预设 CSS
  useEffect(() => {
    applyPresetCSS(activePresetId)
  }, [activePresetId])

  // 应用用户自定义 CSS（最高优先级）
  useEffect(() => {
    applyCustomCSS(customCss || '')
  }, [customCss])

  return <>{children}</>
}

export default GlobalStyleProvider
