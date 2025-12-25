/**
 * 工作流版本的动态图像表单组件
 *
 * 复用 imageGenerationConfig 统一配置
 * 适配工作流节点的配置面板样式
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { FieldConfig } from '@renderer/config/imageGenerationConfig'
import { getFieldsByGroup, getModelDefaults, getModelFieldConfigs } from '@renderer/config/imageGenerationConfig'
import type { CollapseProps } from 'antd'
import { Button, Collapse, InputNumber, Slider, Tooltip, Upload } from 'antd'
import { memo, useCallback, useMemo } from 'react'

import { FormInput, FormNumber, FormRow, FormSelect, FormSwitch, FormTextArea } from './FormComponents'

// 定义折叠面板项类型
type CollapseItem = NonNullable<CollapseProps['items']>[number]

// ============================================================================
// 类型定义
// ============================================================================

export interface WorkflowDynamicImageFormProps {
  /** 模型 ID */
  modelId: string
  /** Provider ID */
  providerId?: string
  /** 配置值 */
  config: Record<string, any>
  /** 值变更回调 */
  onUpdateConfig: (key: string, value: any) => void
  /** 是否显示基础字段 */
  showBasic?: boolean
  /** 是否显示高级选项 */
  showAdvanced?: boolean
  /** 是否显示风格选项 */
  showStyle?: boolean
  /** 是否显示输出选项 */
  showOutput?: boolean
  /** 排除的字段（某些节点可能需要自己渲染 prompt 等字段）*/
  excludeFields?: string[]
}

// ============================================================================
// 宽高比按钮组
// ============================================================================

interface AspectRatioGroupProps {
  value: string
  options: Array<{ label: string; value: string | number }>
  onChange: (value: string) => void
}

const AspectRatioGroup = memo(function AspectRatioGroup({ value, options, onChange }: AspectRatioGroupProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
        gap: '4px'
      }}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(String(opt.value))}
          style={{
            padding: '6px 4px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            border: `1px solid ${value === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: value === opt.value ? 'var(--color-primary)' : 'var(--color-background)',
            color: value === opt.value ? 'white' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
})

// ============================================================================
// 单个字段渲染器
// ============================================================================

interface FieldRendererProps {
  field: FieldConfig
  value: any
  onChange: (key: string, value: any) => void
}

const FieldRenderer = memo(function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  // 生成随机种子
  const generateRandomSeed = useCallback(() => {
    onChange(field.key, Math.floor(Math.random() * 1000000))
  }, [field.key, onChange])

  // 处理图片上传
  const handleImageUpload = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        const currentImages = Array.isArray(value) ? value : []
        onChange(field.key, [...currentImages, base64])
      }
      reader.readAsDataURL(file)
      return false
    },
    [field.key, value, onChange]
  )

  // 移除图片
  const handleRemoveImage = useCallback(
    (index: number) => {
      const currentImages = Array.isArray(value) ? value : []
      onChange(
        field.key,
        currentImages.filter((_: any, i: number) => i !== index)
      )
    },
    [field.key, value, onChange]
  )

  switch (field.type) {
    case 'text':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormInput value={value || ''} onChange={(v) => onChange(field.key, v)} placeholder={field.placeholder} />
        </FormRow>
      )

    case 'textarea':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormTextArea
            value={value || ''}
            onChange={(v) => onChange(field.key, v)}
            placeholder={field.placeholder}
            rows={field.key === 'prompt' ? 4 : 3}
          />
        </FormRow>
      )

    case 'number':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormNumber
            min={field.min}
            max={field.max}
            step={field.step}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
          />
        </FormRow>
      )

    case 'slider':
      return (
        <FormRow label={field.label} description={field.description}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <Slider
                min={field.min}
                max={field.max}
                step={field.step}
                value={value ?? field.defaultValue}
                onChange={(v) => onChange(field.key, v)}
              />
            </div>
            <InputNumber
              size="small"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
              style={{ width: '70px' }}
            />
          </div>
        </FormRow>
      )

    case 'select':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormSelect
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
            options={field.options?.map((opt) => ({ label: opt.label, value: opt.value })) || []}
          />
        </FormRow>
      )

    case 'switch':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormSwitch checked={value ?? field.defaultValue ?? false} onChange={(v) => onChange(field.key, v)} />
        </FormRow>
      )

    case 'seed':
      return (
        <FormRow label={field.label} description={field.description}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <InputNumber
              min={0}
              max={999999999}
              value={value}
              onChange={(v) => onChange(field.key, v)}
              placeholder={field.placeholder || '随机'}
              style={{ flex: 1 }}
            />
            <Tooltip title="生成随机种子">
              <Button size="small" icon={<ReloadOutlined />} onClick={generateRandomSeed} />
            </Tooltip>
          </div>
        </FormRow>
      )

    case 'aspectRatio':
      return (
        <FormRow label={field.label} description={field.description}>
          <AspectRatioGroup
            value={value ?? field.defaultValue}
            options={field.options?.map((opt) => ({ label: opt.label, value: String(opt.value) })) || []}
            onChange={(v) => onChange(field.key, v)}
          />
        </FormRow>
      )

    case 'images':
      const images = Array.isArray(value) ? value : []
      return (
        <FormRow label={field.label} description={field.description}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px'
            }}>
            {images.map((img: string, index: number) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)'
                }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div
                  onClick={() => handleRemoveImage(index)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}>
                  ×
                </div>
              </div>
            ))}
            <Upload accept="image/*" multiple showUploadList={false} beforeUpload={handleImageUpload}>
              <div
                style={{
                  aspectRatio: '1',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  fontSize: '16px',
                  transition: 'all 0.2s'
                }}>
                <PlusOutlined />
              </div>
            </Upload>
          </div>
        </FormRow>
      )

    default:
      return null
  }
})

// ============================================================================
// 动态表单组件
// ============================================================================

export const WorkflowDynamicImageForm = memo(function WorkflowDynamicImageForm({
  modelId,
  providerId,
  config,
  onUpdateConfig,
  showBasic = true,
  showAdvanced = true,
  showStyle = true,
  showOutput = true,
  excludeFields = []
}: WorkflowDynamicImageFormProps) {
  // 获取模型对应的字段配置
  const allFields = useMemo(
    () => getModelFieldConfigs(modelId, providerId).filter((f) => !excludeFields.includes(f.key)),
    [modelId, providerId, excludeFields]
  )

  // 按分组获取字段
  const basicFields = useMemo(() => getFieldsByGroup(allFields, 'basic'), [allFields])
  const advancedFields = useMemo(() => getFieldsByGroup(allFields, 'advanced'), [allFields])
  const styleFields = useMemo(() => getFieldsByGroup(allFields, 'style'), [allFields])
  const outputFields = useMemo(() => getFieldsByGroup(allFields, 'output'), [allFields])

  // 构建折叠面板项
  const collapseItems = useMemo(() => {
    const items: CollapseItem[] = []

    if (showAdvanced && advancedFields.length > 0) {
      items.push({
        key: 'advanced',
        label: '🔧 高级设置',
        children: (
          <div>
            {advancedFields.map((field) => (
              <FieldRenderer key={field.key} field={field} value={config[field.key]} onChange={onUpdateConfig} />
            ))}
          </div>
        )
      })
    }

    if (showStyle && styleFields.length > 0) {
      items.push({
        key: 'style',
        label: '🎨 风格设置',
        children: (
          <div>
            {styleFields.map((field) => (
              <FieldRenderer key={field.key} field={field} value={config[field.key]} onChange={onUpdateConfig} />
            ))}
          </div>
        )
      })
    }

    if (showOutput && outputFields.length > 0) {
      items.push({
        key: 'output',
        label: '📤 输出设置',
        children: (
          <div>
            {outputFields.map((field) => (
              <FieldRenderer key={field.key} field={field} value={config[field.key]} onChange={onUpdateConfig} />
            ))}
          </div>
        )
      })
    }

    return items
  }, [showAdvanced, showStyle, showOutput, advancedFields, styleFields, outputFields, config, onUpdateConfig])

  // 如果没有 modelId，显示提示
  if (!modelId) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: '13px'
        }}>
        请先选择模型
      </div>
    )
  }

  return (
    <>
      {/* 基础字段 */}
      {showBasic &&
        basicFields.map((field) => (
          <FieldRenderer key={field.key} field={field} value={config[field.key]} onChange={onUpdateConfig} />
        ))}

      {/* 折叠面板（高级/风格/输出）*/}
      {collapseItems.length > 0 && <Collapse ghost items={collapseItems} style={{ marginTop: '8px' }} />}
    </>
  )
})

// ============================================================================
// 导出工具函数
// ============================================================================

/**
 * snake_case 到 camelCase 的字段名映射
 * imageGenerationConfig 使用 snake_case，而工作流节点使用 camelCase
 */
const FIELD_NAME_MAP: Record<string, string> = {
  aspect_ratio: 'aspectRatio',
  image_size: 'imageSize',
  negative_prompt: 'negativePrompt',
  guidance_scale: 'guidanceScale',
  prompt_strength: 'promptStrength'
}

/**
 * 将 snake_case 键转换为 camelCase
 */
function snakeToCamelKey(key: string): string {
  return FIELD_NAME_MAP[key] || key
}

/**
 * 获取模型默认配置（转换为 camelCase 键名）
 * 供工作流节点使用
 *
 * @param modelId 模型 ID
 * @param providerId Provider ID
 * @returns 使用 camelCase 键名的默认值对象
 */
export function getWorkflowModelDefaults(modelId: string, providerId?: string): Record<string, any> {
  const defaults = getModelDefaults(modelId, providerId)
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(defaults)) {
    const camelKey = snakeToCamelKey(key)
    result[camelKey] = value
  }

  return result
}

/**
 * 应用模型默认值到配置
 * 保留用户已输入的值（prompt、negativePrompt 等）
 *
 * @param modelId 模型 ID
 * @param providerId Provider ID
 * @param currentConfig 当前配置
 * @param onUpdateConfig 更新配置的回调
 * @param preserveKeys 需要保留的键名列表（如果当前值存在则不覆盖）
 */
export function applyModelDefaults(
  modelId: string,
  providerId: string | undefined,
  currentConfig: Record<string, any>,
  onUpdateConfig: (key: string, value: any) => void,
  preserveKeys: string[] = ['prompt', 'negativePrompt']
): void {
  const defaults = getWorkflowModelDefaults(modelId, providerId)

  for (const [key, value] of Object.entries(defaults)) {
    // 如果是需要保留的键且当前值存在，则跳过
    if (preserveKeys.includes(key) && currentConfig[key]) {
      continue
    }
    onUpdateConfig(key, value)
  }
}

/**
 * 获取模型默认配置，用于初始化节点（原始 snake_case）
 * @deprecated 推荐使用 getWorkflowModelDefaults 获取 camelCase 键名
 */
export { getModelDefaults, getModelFieldConfigs }

export default WorkflowDynamicImageForm
