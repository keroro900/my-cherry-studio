/**
 * 统一绘画表单组件
 *
 * 基于 imageGenerationConfig 动态渲染参数表单
 * 复用 WorkflowDynamicImageForm 的逻辑，适配绘画页面样式
 *
 * 核心功能：
 * - 根据模型 ID 自动获取字段配置
 * - 支持基础/高级/风格/输出分组
 * - 统一的字段渲染器
 * - 与工作流节点共享配置系统
 *
 * @requirements 4.1, 4.3
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { FieldConfig } from '@renderer/config/imageGenerationConfig'
import { getFieldsByGroup, getModelDefaults, getModelFieldConfigs } from '@renderer/config/imageGenerationConfig'
import type { CollapseProps } from 'antd'
import { Button, Collapse, Input, InputNumber, Select, Slider, Switch, Tooltip, Upload } from 'antd'
import type { FC, ReactNode } from 'react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'

const { TextArea } = Input

// ============================================================================
// 类型定义
// ============================================================================

export interface UnifiedPaintingFormProps {
  /** 模型 ID */
  modelId: string
  /** Provider ID */
  providerId?: string
  /** 表单值 */
  values: Record<string, any>
  /** 值变更回调 */
  onChange: (key: string, value: any) => void
  /** 批量设置值 */
  onValuesChange?: (values: Record<string, any>) => void
  /** 是否显示基础字段 */
  showBasic?: boolean
  /** 是否显示高级选项 */
  showAdvanced?: boolean
  /** 是否显示风格选项 */
  showStyle?: boolean
  /** 是否显示输出选项 */
  showOutput?: boolean
  /** 排除的字段（某些页面可能需要自己渲染 prompt 等字段）*/
  excludeFields?: string[]
  /** 是否禁用 */
  disabled?: boolean
}

// 定义折叠面板项类型
type CollapseItem = NonNullable<CollapseProps['items']>[number]

// ============================================================================
// 样式组件
// ============================================================================

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Section = styled.div`
  margin-bottom: 12px;
`

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
`

const LabelWithTooltip = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  .label {
    font-size: 12px;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 4px;
  }
`

const StyledInputNumber = styled(InputNumber)`
  width: 80px;

  .ant-input-number-input {
    font-size: 12px;
  }
`

const StyledTextArea = styled(TextArea)`
  border-radius: 8px !important;
  background: var(--color-background-soft) !important;
  border: 1px solid var(--color-border) !important;
  font-size: 13px !important;
  resize: none !important;

  &:focus {
    border-color: var(--color-primary) !important;
  }
`

const RatioGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 4px;
`

const RatioButton = styled.button<{ $active: boolean }>`
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background)')};
  color: ${(props) => (props.$active ? 'white' : 'var(--color-text-secondary)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const SeedRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  .ant-input-number {
    flex: 1;
  }
`

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
`

const ImagePreview = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  min-height: 80px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    font-size: 12px;
  }

  &:hover .remove-btn {
    opacity: 1;
  }
`

const UploadButton = styled.div`
  aspect-ratio: 1;
  border-radius: 8px;
  border: 2px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-secondary);
  font-size: 20px;
  min-height: 80px;
  gap: 4px;

  .upload-text {
    font-size: 11px;
    margin-top: 4px;
  }

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
`

const EmptyMessage = styled.div`
  padding: 16px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 13px;
`

// ============================================================================
// 字段渲染器
// ============================================================================

interface FieldRendererProps {
  field: FieldConfig
  value: any
  onChange: (key: string, value: any) => void
  disabled?: boolean
}

const FieldRenderer: FC<FieldRendererProps> = memo(function FieldRenderer({ field, value, onChange, disabled }) {
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

  // 渲染标签
  const renderLabel = (): ReactNode => (
    <LabelWithTooltip>
      {field.label}
      {field.description && (
        <Tooltip title={field.description}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'help' }}>ⓘ</span>
        </Tooltip>
      )}
    </LabelWithTooltip>
  )

  // 根据字段类型渲染控件
  switch (field.type) {
    case 'text':
      return (
        <Section>
          <SectionLabel>{renderLabel()}</SectionLabel>
          <Input
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </Section>
      )

    case 'textarea':
      return (
        <Section>
          <SectionLabel>{renderLabel()}</SectionLabel>
          <StyledTextArea
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={field.key === 'prompt' ? 4 : 2}
            disabled={disabled}
          />
        </Section>
      )

    case 'number':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
            <StyledInputNumber
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
              disabled={disabled}
            />
          </ConfigRow>
        </Section>
      )

    case 'slider':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
            <StyledInputNumber
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
              disabled={disabled}
            />
          </ConfigRow>
          <Slider
            min={field.min}
            max={field.max}
            step={field.step}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          />
        </Section>
      )

    case 'select':
      return (
        <Section>
          <SectionLabel>{renderLabel()}</SectionLabel>
          <Select
            style={{ width: '100%' }}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
            options={field.options?.map((opt) => ({ label: opt.label, value: opt.value }))}
            disabled={disabled}
          />
        </Section>
      )

    case 'switch':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
            <Switch
              size="small"
              checked={value ?? field.defaultValue ?? false}
              onChange={(v) => onChange(field.key, v)}
              disabled={disabled}
            />
          </ConfigRow>
        </Section>
      )

    case 'seed':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
          </ConfigRow>
          <SeedRow>
            <StyledInputNumber
              min={0}
              max={999999999}
              value={value}
              onChange={(v) => onChange(field.key, v)}
              placeholder={field.placeholder || '随机'}
              style={{ flex: 1 }}
              disabled={disabled}
            />
            <Tooltip title="生成随机种子">
              <Button size="small" icon={<ReloadOutlined />} onClick={generateRandomSeed} disabled={disabled} />
            </Tooltip>
          </SeedRow>
        </Section>
      )

    case 'aspectRatio':
      return (
        <Section>
          <SectionLabel>{renderLabel()}</SectionLabel>
          <RatioGrid>
            {field.options?.map((opt) => (
              <RatioButton
                key={String(opt.value)}
                $active={(value ?? field.defaultValue) === opt.value}
                onClick={() => onChange(field.key, opt.value)}
                disabled={disabled}>
                {opt.label}
              </RatioButton>
            ))}
          </RatioGrid>
        </Section>
      )

    case 'images':
      const images = Array.isArray(value) ? value : []
      return (
        <Section>
          <SectionLabel>{renderLabel()}</SectionLabel>
          <ImageGrid>
            {images.map((img: string, index: number) => (
              <ImagePreview key={index}>
                <img src={img} alt="" />
                <div className="remove-btn" onClick={() => !disabled && handleRemoveImage(index)}>
                  ×
                </div>
              </ImagePreview>
            ))}
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={handleImageUpload}
              disabled={disabled}>
              <UploadButton>
                <PlusOutlined />
                <span className="upload-text">添加图片</span>
              </UploadButton>
            </Upload>
          </ImageGrid>
        </Section>
      )

    default:
      return null
  }
})

// ============================================================================
// 主组件
// ============================================================================

export const UnifiedPaintingForm: FC<UnifiedPaintingFormProps> = memo(function UnifiedPaintingForm({
  modelId,
  providerId,
  values,
  onChange,
  onValuesChange,
  showBasic = true,
  showAdvanced = true,
  showStyle = true,
  showOutput = true,
  excludeFields = [],
  disabled = false
}) {
  // 默认排除的字段（由父组件单独渲染）
  const defaultExcludeFields = ['prompt']
  const allExcludedFields = useMemo(() => [...defaultExcludeFields, ...excludeFields], [excludeFields])

  // 获取模型对应的字段配置
  const allFields = useMemo(
    () => getModelFieldConfigs(modelId, providerId).filter((f) => !allExcludedFields.includes(f.key)),
    [modelId, providerId, allExcludedFields]
  )

  // 获取模型默认值
  const defaultValues = useMemo(() => getModelDefaults(modelId, providerId), [modelId, providerId])

  // 按分组获取字段
  const basicFields = useMemo(() => getFieldsByGroup(allFields, 'basic'), [allFields])
  const advancedFields = useMemo(() => getFieldsByGroup(allFields, 'advanced'), [allFields])
  const styleFields = useMemo(() => getFieldsByGroup(allFields, 'style'), [allFields])
  const outputFields = useMemo(() => getFieldsByGroup(allFields, 'output'), [allFields])

  // 当模型变化时，初始化默认值
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0 && onValuesChange) {
      // 只设置未设置的值
      const newValues = { ...values }
      let hasChanges = false

      for (const [key, defaultValue] of Object.entries(defaultValues)) {
        // 跳过排除的字段
        if (allExcludedFields.includes(key)) continue
        // 只设置未定义的值
        if (values[key] === undefined) {
          newValues[key] = defaultValue
          hasChanges = true
        }
      }

      if (hasChanges) {
        onValuesChange(newValues)
      }
    }
  }, [modelId, providerId]) // 只在模型变化时触发

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
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={onChange}
                disabled={disabled}
              />
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
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={onChange}
                disabled={disabled}
              />
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
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={onChange}
                disabled={disabled}
              />
            ))}
          </div>
        )
      })
    }

    return items
  }, [showAdvanced, showStyle, showOutput, advancedFields, styleFields, outputFields, values, onChange, disabled])

  // 如果没有 modelId，显示提示
  if (!modelId) {
    return <EmptyMessage>请先选择模型</EmptyMessage>
  }

  return (
    <FormContainer>
      {/* 基础字段 */}
      {showBasic &&
        basicFields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={onChange}
            disabled={disabled}
          />
        ))}

      {/* 折叠面板（高级/风格/输出）*/}
      {collapseItems.length > 0 && <Collapse ghost items={collapseItems} />}
    </FormContainer>
  )
})

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取模型默认配置
 * 供绘画页面使用
 */
export function getPaintingModelDefaults(modelId: string, providerId?: string): Record<string, any> {
  return getModelDefaults(modelId, providerId)
}

/**
 * 应用模型默认值到配置
 * 保留用户已输入的值（prompt 等）
 */
export function applyPaintingModelDefaults(
  modelId: string,
  providerId: string | undefined,
  currentValues: Record<string, any>,
  onChange: (key: string, value: any) => void,
  preserveKeys: string[] = ['prompt', 'negative_prompt']
): void {
  const defaults = getModelDefaults(modelId, providerId)

  for (const [key, value] of Object.entries(defaults)) {
    // 如果是需要保留的键且当前值存在，则跳过
    if (preserveKeys.includes(key) && currentValues[key]) {
      continue
    }
    onChange(key, value)
  }
}

export default UnifiedPaintingForm
