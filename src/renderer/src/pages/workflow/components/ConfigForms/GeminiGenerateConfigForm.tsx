/**
 * Gemini 图像生成节点配置表单 - Cherry 风格
 *
 * 使用统一的 imageGenerationConfig 配置系统
 * 支持动态参数显示，根据模型自动调整
 * 支持约束提示词和电商风格预设
 * 支持系统提示词编辑（类似助手功能）
 *
 * 重构版本：使用可复用的区块组件
 */

import { memo, useCallback, useMemo } from 'react'

import EcomPresetSelector from './EcomPresetSelector'
import { FormRow, FormSection, FormTextArea } from './FormComponents'
import { generateImageInputPorts, ImageInputPortSection, ModelSelectorSection, PromptEditorSection } from './sections'
import type { ImageInputPort } from './sections/ImageInputPortSection'
import { WorkflowDynamicImageForm } from './WorkflowDynamicImageForm'

interface GeminiGenerateConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (key: string, value: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
}

function GeminiGenerateConfigForm({
  config,
  providerId,
  modelId,
  onUpdateConfig,
  onUpdateModel
}: GeminiGenerateConfigFormProps) {
  // 图片输入端口数量 (默认 1 个)
  const imageInputCount = config.imageInputCount ?? 1

  // 获取当前图片输入端口配置（如果没有则根据数量生成）
  const imageInputPorts: ImageInputPort[] = useMemo(() => {
    if (config.imageInputPorts && config.imageInputPorts.length > 0) {
      return config.imageInputPorts
    }
    return generateImageInputPorts(imageInputCount, 'image')
  }, [config.imageInputPorts, imageInputCount])

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (onUpdateModel) {
        onUpdateModel(newProviderId, newModelId)
      }
    },
    [onUpdateModel]
  )

  return (
    <div>
      {/* 模型选择 - 使用可复用组件 */}
      <FormSection title="🤖 AI 模型">
        <FormRow label="视觉模型" description="选择支持视觉分析的 AI 模型">
          <ModelSelectorSection
            providerId={currentProviderId}
            modelId={currentModelId}
            config={config}
            onModelChange={handleModelChange}
            onUpdateConfig={onUpdateConfig}
            preserveKeys={['prompt', 'negativePrompt', 'customPrompts']}
          />
        </FormRow>

        {/* 系统提示词编辑 - 独立显示，不包裹在 FormRow 中 */}
        <div style={{ marginTop: 8 }}>
          <PromptEditorSection
            nodeType="gemini_generate"
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => onUpdateConfig('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="primary"
            modalTitle="图片生成 - 系统提示词配置"
          />
        </div>
      </FormSection>

      {/* 图片输入端口配置 - 使用 advanced 模式，与其他节点保持一致 */}
      <ImageInputPortSection
        mode="advanced"
        ports={imageInputPorts}
        min={0}
        max={10}
        onPortsChange={(ports) => {
          onUpdateConfig('imageInputPorts', ports)
          onUpdateConfig('imageInputCount', ports.length)
        }}
        portPrefix="image"
        title="📷 图片输入端口"
      />

      {/* 提示词 - 单独渲染，因为工作流节点可能需要特殊处理 */}
      <FormSection title="✏️ 提示词">
        <FormRow label="正向提示词" description="可以从上游 Vision Prompt 节点自动获取">
          <FormTextArea
            value={config.prompt || ''}
            onChange={(value) => onUpdateConfig('prompt', value)}
            placeholder="描述你想生成的图片...&#10;例如：一个穿着红色连衣裙的女孩在公园里玩耍"
            rows={4}
          />
        </FormRow>
      </FormSection>

      {/* 使用动态表单组件渲染其他参数 */}
      {currentModelId && (
        <WorkflowDynamicImageForm
          modelId={currentModelId}
          providerId={currentProviderId}
          config={config}
          onUpdateConfig={onUpdateConfig}
          showBasic={true}
          showAdvanced={true}
          showStyle={true}
          showOutput={true}
          excludeFields={['prompt']}
        />
      )}

      {/* 预设配置 - 包含约束提示词、电商预设、模特预设、场景预设 */}
      <EcomPresetSelector
        config={config}
        onUpdateConfig={onUpdateConfig}
        showConstraintPrompt={true}
        showEcomPresets={true}
        showModelPresets={true}
        showScenePresets={true}
      />
    </div>
  )
}

export default memo(GeminiGenerateConfigForm)
