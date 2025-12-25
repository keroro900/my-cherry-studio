/**
 * 填充模块
 * Fill Module
 *
 * 处理 Ghost Mannequin 立体效果
 */

import type { PromptModule } from './types'

/**
 * 填充模式提示词
 */
const FILL_TEXTS: Record<string, string> = {
  ghost_mannequin: `[Fill: Ghost Mannequin 3D Effect]
Create invisible mannequin effect with internal volume.
Collar shows inner shadow/depth.
Garment has body-like shape, not flat.
Ground contact shadow for depth.
Professional retouching: remove excess wrinkles, keep structural folds only.`,

  natural_flat: `[Fill: Natural Flat]
Garment laid naturally without mannequin.
Slight fabric softness, not overly stiff.
Clean silhouette, professional steamed appearance.
Suitable for minimalist/Japanese style.`
}

/**
 * 填充模块
 */
export const FillModule = {
  /**
   * 获取填充模块
   * @param type 填充类型
   */
  get(type: 'ghost_mannequin' | 'natural_flat' = 'ghost_mannequin'): PromptModule {
    return {
      type: 'fill',
      text: FILL_TEXTS[type] || FILL_TEXTS.ghost_mannequin,
      priority: 75
    }
  },

  /**
   * 获取所有可用的填充类型
   */
  getTypes(): string[] {
    return Object.keys(FILL_TEXTS)
  }
}
