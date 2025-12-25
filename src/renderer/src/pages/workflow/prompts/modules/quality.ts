/**
 * 质量模块
 * Quality Module
 *
 * 处理输出质量相关参数：分辨率、宽高比、光影等
 */

import type { PromptModule } from './types'

/**
 * 分辨率映射
 */
const RESOLUTION_MAP: Record<string, string> = {
  '1K': '1024px',
  '2K': '2048px',
  '4K': '4096px'
}

/**
 * 质量模块
 */
export const QualityModule = {
  /**
   * 获取质量模块
   * @param size 输出尺寸 (1K/2K/4K)
   * @param aspectRatio 宽高比 (3:4, 1:1, etc.)
   */
  get(size: string = '2K', aspectRatio: string = '3:4'): PromptModule {
    const resolution = RESOLUTION_MAP[size] || RESOLUTION_MAP['2K']

    return {
      type: 'quality',
      text: `[Quality Standards]
Resolution: ${resolution} (${size})
Aspect Ratio: ${aspectRatio}
High resolution, accurate colors, even lighting, clean background.
Garment fills 70-85% of frame.`,
      priority: 40
    }
  },

  /**
   * 获取电商平台标准质量模块
   * @param platform 平台名称
   */
  getForPlatform(platform: 'shein' | 'temu' | 'amazon' | 'taobao' = 'shein'): PromptModule {
    const platformSpecs: Record<string, { ratio: string; style: string }> = {
      shein: { ratio: '3:4', style: 'Instagram-worthy aesthetic, vibrant colors' },
      temu: { ratio: '1:1', style: 'Clear display, product-focused' },
      amazon: { ratio: '1:1', style: 'Pure white (#FFFFFF), professional standard' },
      taobao: { ratio: '3:4', style: 'Lifestyle scene, approachable' }
    }

    const spec = platformSpecs[platform] || platformSpecs.shein

    return {
      type: 'quality',
      text: `[Quality: ${platform.toUpperCase()} Standard]
Aspect Ratio: ${spec.ratio}
Style: ${spec.style}
High resolution, accurate colors, even lighting.`,
      priority: 40
    }
  }
}
