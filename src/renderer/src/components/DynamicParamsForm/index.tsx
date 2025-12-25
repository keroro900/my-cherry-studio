/**
 * 动态参数表单组件（共享版本）
 *
 * 根据远程获取的参数 Schema 动态渲染表单
 * 支持绘画页面和工作流节点复用
 *
 * 功能：
 * - 动态字段类型
 * - 参数依赖关系
 * - 动态范围
 * - 实时验证
 *
 * @requirements 5.2
 */

import { InfoCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { DynamicFieldConfig } from '@renderer/hooks/useModelParams'
import useModelParams from '@renderer/hooks/useModelParams'
import type { Model, Provider } from '@renderer/types'
import { Alert, Button, Collapse, Input, InputNumber, Select, Skeleton, Slider, Switch, Tooltip, Upload } from 'antd'
import type { FC, ReactNode } from 'react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'

const { TextArea } = Input

// ============================================================================
// 类型定义
// ============================================================================

export interface DynamicParamsFormProps {
  /** Provider 配置 */
  provider?: Provider
  /** Model 配置 */
  model?: Model
  /** 表单值 */
  values: Record<string, any>
  /** 值变更回调 */
  onChange: (key: string, value: any) => void
  /** 批量设置值 */
  onValuesChange?: (values: Record<string, any>) => void
  /** 是否显示高级选项 */
  showAdvanced?: boolean
  /** 是否显示风格选项 */
  showStyle?: boolean
  /** 是否显示输出选项 */
  showOutput?: boolean
  /** 验证错误 */
  errors?: Record<string, string>
  /** 要排除的字段（不渲染） */
  excludeFields?: string[]
  /** 当前模式 */
  mode?: 'generate' | 'edit'
  /** 是否禁用 */
  disabled?: boolean
}

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

const LabelWithIcon = styled.span`
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
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
`

const RatioButton = styled.button<{ $active: boolean }>`
  padding: 6px 2px;
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

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
`

const ErrorContainer = styled.div`
  padding: 12px 0;
`

// ============================================================================
// 字段渲染器
// ============================================================================

interface FieldRendererProps {
  field: DynamicFieldConfig
  value: any
  onChange: (key: string, value: any) => void
  allValues: Record<string, any>
  getFieldRange: (key: string, values: Record<string, any>) => { min?: number; max?: number }
  error?: string
  disabled?: boolean
}

const FieldRenderer: FC<FieldRendererProps> = memo(function FieldRenderer({
  field,
  value,
  onChange,
  allValues,
  getFieldRange,
  error,
  disabled = false
}) {
  // 获取动态范围
  const range = useMemo(() => getFieldRange(field.key, allValues), [field.key, allValues, getFieldRange])

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

  const isDisabled = disabled || field.disabled

  // 渲染标签
  const renderLabel = () => (
    <LabelWithIcon>
      {field.label}
      {(field.description || field.tooltip) && (
        <Tooltip title={field.tooltip || field.description}>
          <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
        </Tooltip>
      )}
    </LabelWithIcon>
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
            disabled={isDisabled}
            status={error ? 'error' : undefined}
          />
          {error && <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>{error}</div>}
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
            disabled={isDisabled}
            status={error ? 'error' : undefined}
          />
          {error && <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>{error}</div>}
        </Section>
      )

    case 'number':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
            <StyledInputNumber
              min={range.min ?? field.min}
              max={range.max ?? field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
              disabled={isDisabled}
              status={error ? 'error' : undefined}
            />
          </ConfigRow>
          {error && <div style={{ color: 'var(--color-error)', fontSize: 11 }}>{error}</div>}
        </Section>
      )

    case 'slider':
      return (
        <Section>
          <ConfigRow>
            <span className="label">{renderLabel()}</span>
            <StyledInputNumber
              min={range.min ?? field.min}
              max={range.max ?? field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
              disabled={isDisabled}
            />
          </ConfigRow>
          <Slider
            min={range.min ?? field.min}
            max={range.max ?? field.max}
            step={field.step}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
            disabled={isDisabled}
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
            disabled={isDisabled}
            status={error ? 'error' : undefined}
          />
          {error && <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>{error}</div>}
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
              disabled={isDisabled}
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
              disabled={isDisabled}
            />
            <Tooltip title="生成随机种子">
              <Button size="small" icon={<ReloadOutlined />} onClick={generateRandomSeed} disabled={isDisabled} />
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
                disabled={isDisabled}>
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
                {!isDisabled && (
                  <div className="remove-btn" onClick={() => handleRemoveImage(index)}>
                    ×
                  </div>
                )}
              </ImagePreview>
            ))}
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={handleImageUpload}
              disabled={isDisabled}>
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

export const DynamicParamsForm: FC<DynamicParamsFormProps> = memo(function DynamicParamsForm({
  provider,
  model,
  values,
  onChange,
  onValuesChange,
  showAdvanced = true,
  showStyle = true,
  showOutput = true,
  errors = {},
  excludeFields = [],
  mode = 'generate',
  disabled = false
}) {
  const {
    isLoading,
    error,
    fields: _fields,
    fieldsByGroup,
    defaultValues,
    isFieldVisible,
    getFieldRange
  } = useModelParams(provider, model)
  void _fields // 使用 fieldsByGroup 替代扁平的 fields 列表

  // 默认排除的字段（由父组件单独渲染）
  const defaultExcludeFields = ['prompt']
  const allExcludedFields = useMemo(() => [...defaultExcludeFields, ...excludeFields], [excludeFields])

  // 检查字段是否应该显示
  const shouldShowField = useCallback(
    (fieldKey: string) => {
      // 排除的字段不显示
      if (allExcludedFields.includes(fieldKey)) return false

      // 参考图片字段只在编辑模式显示
      if (fieldKey === 'reference_images' && mode !== 'edit') return false

      return true
    },
    [allExcludedFields, mode]
  )

  // 当默认值变化时，初始化表单值
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0 && onValuesChange) {
      // 只设置未设置的值
      const newValues = { ...values }
      let hasChanges = false

      for (const [key, defaultValue] of Object.entries(defaultValues)) {
        if (values[key] === undefined) {
          newValues[key] = defaultValue
          hasChanges = true
        }
      }

      if (hasChanges) {
        onValuesChange(newValues)
      }
    }
  }, [defaultValues]) // eslint-disable-line react-hooks/exhaustive-deps

  // 渲染加载状态
  if (isLoading) {
    return (
      <LoadingContainer>
        <Skeleton.Input active block style={{ height: 32 }} />
        <Skeleton.Input active block style={{ height: 32 }} />
        <Skeleton.Input active block style={{ height: 32 }} />
      </LoadingContainer>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <ErrorContainer>
        <Alert type="warning" message="参数加载失败" description={error} showIcon />
      </ErrorContainer>
    )
  }

  // 过滤可见字段（排除不需要显示的字段）
  const visibleBasicFields =
    fieldsByGroup.basic?.filter((f) => isFieldVisible(f.key, values) && shouldShowField(f.key)) || []
  const visibleAdvancedFields =
    fieldsByGroup.advanced?.filter((f) => isFieldVisible(f.key, values) && shouldShowField(f.key)) || []
  const visibleStyleFields =
    fieldsByGroup.style?.filter((f) => isFieldVisible(f.key, values) && shouldShowField(f.key)) || []
  const visibleOutputFields =
    fieldsByGroup.output?.filter((f) => isFieldVisible(f.key, values) && shouldShowField(f.key)) || []

  // 构建折叠面板项
  const collapseItems: Array<{ key: string; label: string; children: ReactNode }> = []

  if (showAdvanced && visibleAdvancedFields.length > 0) {
    collapseItems.push({
      key: 'advanced',
      label: '🔧 高级设置',
      children: (
        <>
          {visibleAdvancedFields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={onChange}
              allValues={values}
              getFieldRange={getFieldRange}
              error={errors[field.key]}
              disabled={disabled}
            />
          ))}
        </>
      )
    })
  }

  if (showStyle && visibleStyleFields.length > 0) {
    collapseItems.push({
      key: 'style',
      label: '🎨 风格设置',
      children: (
        <>
          {visibleStyleFields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={onChange}
              allValues={values}
              getFieldRange={getFieldRange}
              error={errors[field.key]}
              disabled={disabled}
            />
          ))}
        </>
      )
    })
  }

  if (showOutput && visibleOutputFields.length > 0) {
    collapseItems.push({
      key: 'output',
      label: '📤 输出设置',
      children: (
        <>
          {visibleOutputFields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={onChange}
              allValues={values}
              getFieldRange={getFieldRange}
              error={errors[field.key]}
              disabled={disabled}
            />
          ))}
        </>
      )
    })
  }

  return (
    <FormContainer>
      {/* 基础字段 */}
      {visibleBasicFields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={onChange}
          allValues={values}
          getFieldRange={getFieldRange}
          error={errors[field.key]}
          disabled={disabled}
        />
      ))}

      {/* 折叠面板（高级/风格/输出）*/}
      {collapseItems.length > 0 && <Collapse ghost items={collapseItems} />}
    </FormContainer>
  )
})

export default DynamicParamsForm
