/**
 * 配置表单组件索引
 * 导出所有节点的配置表单组件
 */

export { default as AIModelConfigForm } from './AIModelConfigForm'
export { default as FileInputConfigForm } from './FileInputConfigForm'
export { default as GeminiEditConfigForm } from './GeminiEditConfigForm'
export { default as GeminiGenerateConfigForm } from './GeminiGenerateConfigForm'
export { default as ImageInputConfigForm } from './ImageInputConfigForm'
export { default as ImageModelConfigForm } from './ImageModelConfigForm'
export { default as KlingVideoConfigForm } from './KlingVideoConfigForm'
export { default as RunningHubConfigForm } from './RunningHubConfigForm'

// 导出专用节点配置表单
export { default as ConditionConfigForm } from './ConditionConfigForm'
export { default as EcomConfigForm } from './EcomConfigForm'
export { default as IndustryPhotoConfigForm } from './IndustryPhotoConfigForm'
export { default as OutputConfigForm } from './OutputConfigForm'
export { default as PatternConfigForm } from './PatternConfigForm'
export { default as TextInputConfigForm } from './TextInputConfigForm'
export { default as UnifiedPromptConfigForm } from './UnifiedPromptConfigForm'
export { default as VideoPromptConfigForm } from './VideoPromptConfigForm'

// 导出动态配置表单渲染器
export { default as DynamicConfigForm } from './DynamicConfigForm'

// 导出 Cherry 风格表单组件
export * from './FormComponents'

// 导出智能图片输入组件
export type { SmartImageItem } from './SmartImageInput'
export { default as SmartImageInput } from './SmartImageInput'

// 导出动态图片输入端口组件
export type { DynamicImageInput } from './DynamicImageInputs'
export { default as DynamicImageInputs } from './DynamicImageInputs'
export { createInitialInputs, getImageInputsFromNode } from './DynamicImageInputs'

// 导出文件夹路径输入组件
export { default as FolderPathInput } from './FolderPathInput'

// 导出动态输入端口管理器
export { default as DynamicInputPortManager } from './DynamicInputPortManager'

// 导出提示词预设选择器
export { default as PromptPresetSelector } from './PromptPresetSelector'
export { CommercialSelector, EthnicitySelector, ModelSelector, PatternSelector } from './PromptPresetSelector'

// 导出通用预设组件
export type { PresetCardProps } from './PresetCard'
export { default as PresetCard } from './PresetCard'
export type { PresetItem, PresetSelectorBaseProps } from './PresetSelectorBase'
export { default as PresetSelectorBase } from './PresetSelectorBase'

// 导出模型选择按钮组件 (使用 Cherry 原生 SelectModelPopup)
export { default as ModelSelectorButton } from './ModelSelectorButton'
export { imageGenerationModelFilter, visionModelFilter } from './ModelSelectorButton'

// 导出工作流动态图像表单（复用统一配置系统）
export { default as WorkflowDynamicImageForm } from './WorkflowDynamicImageForm'
export {
  applyModelDefaults,
  getModelDefaults,
  getModelFieldConfigs,
  getWorkflowModelDefaults
} from './WorkflowDynamicImageForm'

// 导出工作流动态参数表单（使用 useModelParams hook 从中转服务获取参数）
export { default as WorkflowDynamicParamsForm } from './WorkflowDynamicParamsForm'

// 保留旧版兼容 (deprecated)
export type { ImageItem } from './MultiImageInput'
export { default as MultiImageInput } from './MultiImageInput'

// 导出配置表单注册机制
export { type ConfigFormProps, type ConfigFormRegistration, configFormRegistry } from './ConfigFormRegistry'
export { ensureDefaultFormsRegistered, registerDefaultConfigForms } from './defaultRegistrations'
