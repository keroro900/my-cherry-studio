/**
 * 布局模块
 * Layout Module
 *
 * 处理电商图的布局方式：平铺、挂拍、模特等
 */

import type { PromptModule } from './types'

/**
 * 布局模式提示词
 */
const LAYOUT_TEXTS: Record<string, string> = {
  flat_lay: `[Layout: Flat Lay]
Top-down photography, garment laid flat naturally.
Top and bottom coordinated as complete set.
Slight 5-15° angle for dynamic feel.
Sleeves naturally bent, not stiff.`,

  hanging: `[Layout: Hanging Shot]
Front eye-level view, natural drape on hanger.
Display garment silhouette and fabric flow.
Shoulders aligned, natural V-shape for pants.`,

  model_shot: `[Layout: Model Shot]
Invisible mannequin/ghost effect.
3D volume showing wearing shape.
Natural body posture implied.`
}

/**
 * 布局模块
 */
export const LayoutModule = {
  /**
   * 获取布局模块
   * @param type 布局类型
   */
  get(type: 'flat_lay' | 'hanging' | 'model_shot' = 'flat_lay'): PromptModule {
    return {
      type: 'layout',
      text: LAYOUT_TEXTS[type] || LAYOUT_TEXTS.flat_lay,
      priority: 80
    }
  },

  /**
   * 获取所有可用的布局类型
   */
  getTypes(): string[] {
    return Object.keys(LAYOUT_TEXTS)
  }
}
