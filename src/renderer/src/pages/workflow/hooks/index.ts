/**
 * Workflow Hooks 统一导出
 *
 * @module hooks
 */

// Clipboard
export { useClipboard } from './useClipboard'

// Workflow
export { useWorkflow } from './useWorkflow'
export { useWorkflowHistory } from './useWorkflowHistory'
export { useWorkflowTheme } from './useWorkflowTheme'

// Preset 相关
export { usePresetFavorites, type UsePresetFavoritesOptions, type UsePresetFavoritesReturn } from './usePresetFavorites'
export {
  defaultSearchFilter,
  type SearchablePreset,
  usePresetSearch,
  type UsePresetSearchOptions,
  type UsePresetSearchReturn
} from './usePresetSearch'
export { useRecentPresets, type UseRecentPresetsOptions, type UseRecentPresetsReturn } from './useRecentPresets'
