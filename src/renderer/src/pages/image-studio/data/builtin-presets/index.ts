/**
 * 内置预设入口
 * Builtin Presets Entry
 *
 * 汇总所有模块的内置预设
 */

import type { StudioModule } from '../../types'
import type { StudioPreset } from '../../types/preset-market'
import { ECOM_PRESETS } from './ecom-presets'
import { MODEL_PRESETS } from './model-presets'
import { PATTERN_PRESETS } from './pattern-presets'

// ============================================================================
// 导出单独的预设列表
// ============================================================================

export { ECOM_PRESETS } from './ecom-presets'
export { MODEL_PRESETS } from './model-presets'
export { PATTERN_PRESETS } from './pattern-presets'

// ============================================================================
// 合并的预设列表
// ============================================================================

/**
 * 所有内置预设
 */
export const ALL_BUILTIN_PRESETS: StudioPreset[] = [...ECOM_PRESETS, ...MODEL_PRESETS, ...PATTERN_PRESETS]

/**
 * 按模块分组的预设
 */
export const PRESETS_BY_MODULE: Record<StudioModule, StudioPreset[]> = {
  ecom: ECOM_PRESETS,
  model: MODEL_PRESETS,
  pattern: PATTERN_PRESETS
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取指定模块的预设列表
 */
export function getPresetsByModule(module: StudioModule): StudioPreset[] {
  return PRESETS_BY_MODULE[module] || []
}

/**
 * 根据 ID 获取预设
 */
export function getPresetById(id: string): StudioPreset | undefined {
  return ALL_BUILTIN_PRESETS.find((preset) => preset.id === id)
}

/**
 * 搜索预设
 */
export function searchPresets(
  keyword: string,
  options?: {
    module?: StudioModule
    limit?: number
  }
): StudioPreset[] {
  const { module, limit = 20 } = options || {}

  const lowerKeyword = keyword.toLowerCase()

  const presets = module ? PRESETS_BY_MODULE[module] : ALL_BUILTIN_PRESETS

  const results = presets.filter((preset) => {
    return (
      preset.name.toLowerCase().includes(lowerKeyword) ||
      preset.nameEn?.toLowerCase().includes(lowerKeyword) ||
      preset.description.toLowerCase().includes(lowerKeyword) ||
      preset.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword))
    )
  })

  return results.slice(0, limit)
}

/**
 * 获取预设统计信息
 */
export function getPresetStats(): {
  total: number
  byModule: Record<StudioModule, number>
  byCategory: Record<string, number>
} {
  const byCategory: Record<string, number> = {}

  for (const preset of ALL_BUILTIN_PRESETS) {
    byCategory[preset.category] = (byCategory[preset.category] || 0) + 1
  }

  return {
    total: ALL_BUILTIN_PRESETS.length,
    byModule: {
      ecom: ECOM_PRESETS.length,
      model: MODEL_PRESETS.length,
      pattern: PATTERN_PRESETS.length
    },
    byCategory
  }
}
