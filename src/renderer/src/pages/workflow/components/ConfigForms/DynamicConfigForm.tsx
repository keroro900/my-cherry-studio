/**
 * 动态配置表单组件
 * 根据节点的 configSchema 自动渲染配置表单
 *
 * 支持的字段类型：
 * - text: 单行文本输入
 * - textarea: 多行文本输入
 * - number: 数字输入
 * - select: 下拉选择
 * - checkbox: 开关
 * - model-selector: 模型选择器
 * - preset-selector: 预设选择器
 * - constraint-prompt: 约束提示词输入
 * - image-input-ports: 图片输入端口配置
 *
 * **Feature: ui-prompt-optimization, Task 6.1**
 * **Validates: Requirements 11.4**
 */

import { memo, useCallback, useMemo } from 'react'

import type { NodeConfigField, NodeConfigSchema } from '../../nodes/base/types'
import { FormInput, FormNumber, FormRow, FormSelect, FormSwitch, FormTextArea } from './FormComponents'
import ModelSelectorButton, { imageGenerationModelFilter, videoGenerationModelFilter } from './ModelSelectorButton'
import { ConstraintPromptSection, ImageInputPortSection } from './sections'

interface DynamicConfigFormProps {
  /** 配置 Schema */
  configSchema: NodeConfigSchema
  /** 当前配置值 */
  config: Record<string, any>
  /** 配置更新回调 - 即时响应（用于开关、选择器等） */
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  /** 配置更新回调 - 防抖版本（用于文本输入，可选） */
  onDebouncedUpdateConfig?: (key: string, value: any) => void
  /** Provider ID (用于模型选择) */
  providerId?: string
  /** Model ID (用于模型选择) */
  modelId?: string
  /** 模型更新回调 */
  onUpdateModel?: (providerId: string, modelId: string) => void
}

/**
 * 检查字段是否应该显示
 */
function shouldShowField(field: NodeConfigField, config: Record<string, any>): boolean {
  if (!field.showWhen) {
    return true
  }
  const { field: conditionField, value: conditionValue } = field.showWhen
  const currentValue = config[conditionField]

  // 支持数组匹配
  if (Array.isArray(conditionValue)) {
    return conditionValue.includes(currentValue)
  }

  return currentValue === conditionValue
}

/**
 * 渲染单个字段
 */
function FieldRenderer({
  field,
  value,
  onChange,
  onDebouncedChange,
  providerId,
  modelId,
  onUpdateModel
}: {
  field: NodeConfigField
  value: any
  onChange: (value: any) => void
  /** 防抖版本的 onChange，用于文本输入 */
  onDebouncedChange?: (value: any) => void
  providerId?: string
  modelId?: string
  onUpdateModel?: (providerId: string, modelId: string) => void
}) {
  const handleChange = useCallback(
    (newValue: any) => {
      onChange(newValue)
    },
    [onChange]
  )

  // 文本输入使用防抖版本（如果提供）
  const handleTextChange = useCallback(
    (newValue: any) => {
      if (onDebouncedChange) {
        onDebouncedChange(newValue)
      } else {
        onChange(newValue)
      }
    },
    [onChange, onDebouncedChange]
  )

  switch (field.type) {
    case 'text':
      return <FormInput value={value ?? field.default ?? ''} onChange={handleTextChange} placeholder={field.placeholder} />

    case 'textarea':
      return (
        <FormTextArea
          value={value ?? field.default ?? ''}
          onChange={handleTextChange}
          placeholder={field.placeholder}
          rows={4}
        />
      )

    case 'number':
      return (
        <FormNumber
          value={value ?? field.default}
          onChange={handleChange}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
        />
      )

    case 'select':
      return (
        <FormSelect
          value={value ?? field.default}
          onChange={handleChange}
          options={field.options || []}
          placeholder={field.placeholder}
        />
      )

    case 'checkbox':
      return <FormSwitch checked={value ?? field.default ?? false} onChange={handleChange} />

    case 'model-selector':
      if (!onUpdateModel) {
        return <div style={{ color: 'var(--color-text-3)', fontSize: '12px' }}>模型选择不可用</div>
      }
      // 支持 modelFilter 配置：'image-generation' | 'video-generation' | undefined
      // 'image-generation' - 只显示图片生成模型
      // 'video-generation' - 只显示视频生成模型
      // undefined - 显示所有模型
      const modelFilter =
        field.modelFilter === 'image-generation'
          ? imageGenerationModelFilter
          : field.modelFilter === 'video-generation'
            ? videoGenerationModelFilter
            : undefined
      return (
        <ModelSelectorButton
          providerId={providerId}
          modelId={modelId}
          filter={modelFilter}
          showTagFilter={true}
          onModelChange={(newProviderId, newModelId) => {
            onUpdateModel(newProviderId, newModelId)
          }}
        />
      )

    case 'preset-selector':
      // 预设选择器 - 使用 select 组件，但支持预设特定的样式
      // presetType 可以是 'style' | 'scene' | 'age' | 'gender' | 'pattern' 等
      return (
        <FormSelect
          value={value ?? field.default}
          onChange={handleChange}
          options={field.options || []}
          placeholder={field.placeholder || '选择预设...'}
        />
      )

    case 'constraint-prompt':
      // 约束提示词输入 - 使用专用的约束提示词组件样式
      return (
        <ConstraintPromptSection
          value={value ?? field.default ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder || '输入额外的约束条件，例如：保持服装颜色不变、背景使用暖色调...'}
        />
      )

    default:
      return (
        <FormInput
          value={String(value ?? field.default ?? '')}
          onChange={handleChange}
          placeholder={field.placeholder}
        />
      )
  }
}

/**
 * 动态配置表单
 * 根据 configSchema 自动渲染表单字段
 */
function DynamicConfigForm({
  configSchema,
  config,
  onUpdateConfig,
  onDebouncedUpdateConfig,
  providerId,
  modelId,
  onUpdateModel
}: DynamicConfigFormProps) {
  // 过滤可见字段
  const visibleFields = useMemo(() => {
    return configSchema.fields.filter((field) => shouldShowField(field, config))
  }, [configSchema.fields, config])

  const handleFieldChange = useCallback(
    (key: string) => (value: any) => {
      onUpdateConfig(key, value)
    },
    [onUpdateConfig]
  )

  // 防抖版本的字段变更处理
  const handleDebouncedFieldChange = useCallback(
    (key: string) => (value: any) => {
      if (onDebouncedUpdateConfig) {
        onDebouncedUpdateConfig(key, value)
      } else {
        onUpdateConfig(key, value)
      }
    },
    [onUpdateConfig, onDebouncedUpdateConfig]
  )

  if (visibleFields.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--color-text-3)',
          fontSize: '13px'
        }}>
        该节点没有可配置的选项
      </div>
    )
  }

  return (
    <div>
      {visibleFields.map((field) => {
        // 特殊处理图片输入端口配置
        if (field.type === 'image-input-ports') {
          const imageInputCount = config.imageInputCount ?? field.min ?? 1
          const imageInputPorts = config.imageInputPorts ?? []
          return (
            <ImageInputPortSection
              key={field.key}
              mode="simple"
              count={imageInputCount}
              ports={imageInputPorts}
              min={field.min ?? 1}
              max={field.max ?? 5}
              onCountChange={(count) => {
                // 生成新的端口配置
                const newPorts: Array<{
                  id: string
                  label: string
                  dataType: 'image'
                  required: boolean
                  description: string
                }> = []
                for (let i = 1; i <= count; i++) {
                  newPorts.push({
                    id: `image_${i}`,
                    label: `图片 ${i}`,
                    dataType: 'image',
                    required: i === 1,
                    description: i === 1 ? '主要输入图片' : `可选参考图片 ${i}`
                  })
                }
                // 批量更新
                onUpdateConfig({
                  imageInputCount: count,
                  imageInputPorts: newPorts
                })
              }}
              title={field.label || '📷 图片输入'}
              showDivider={false}
              showAlert={true}
            />
          )
        }

        return (
          <FormRow key={field.key} label={field.label} description={field.description} required={field.required}>
            <FieldRenderer
              field={field}
              value={config[field.key]}
              onChange={handleFieldChange(field.key)}
              onDebouncedChange={handleDebouncedFieldChange(field.key)}
              providerId={providerId}
              modelId={modelId}
              onUpdateModel={onUpdateModel}
            />
          </FormRow>
        )
      })}
    </div>
  )
}

export default memo(DynamicConfigForm)
