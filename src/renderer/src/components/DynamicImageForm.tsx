/**
 * 配置驱动的动态表单组件
 *
 * 根据模型配置自动渲染对应的表单字段
 * 统一用于绘画界面和工作流界面
 */

import { InfoCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { FieldConfig } from '@renderer/config/imageGenerationConfig'
import { getFieldsByGroup, getModelFieldConfigs } from '@renderer/config/imageGenerationConfig'
import { Button, Collapse, Input, InputNumber, Select, Slider, Switch, Tooltip, Upload } from 'antd'
import type { ReactNode } from 'react'
import { memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

const { TextArea } = Input

// ============================================================================
// 样式组件
// ============================================================================

const Section = styled.div`
  margin-bottom: 16px;
`

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
`

const LabelWithIcon = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
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

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

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
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
`

const ImagePreview = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    font-size: 10px;
  }

  &:hover .remove-btn {
    opacity: 1;
  }
`

const UploadButton = styled.div`
  aspect-ratio: 1;
  border-radius: 6px;
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-secondary);
  font-size: 16px;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

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
        <Section>
          <SectionLabel>
            <LabelWithIcon>
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </LabelWithIcon>
          </SectionLabel>
          <Input
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        </Section>
      )

    case 'textarea':
      return (
        <Section>
          <SectionLabel>
            <LabelWithIcon>
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </LabelWithIcon>
          </SectionLabel>
          <StyledTextArea
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={field.key === 'prompt' ? 4 : 2}
          />
        </Section>
      )

    case 'number':
      return (
        <Section>
          <ConfigRow>
            <span className="label">
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </span>
            <StyledInputNumber
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
            />
          </ConfigRow>
        </Section>
      )

    case 'slider':
      return (
        <Section>
          <ConfigRow>
            <span className="label">
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </span>
            <StyledInputNumber
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.defaultValue}
              onChange={(v) => onChange(field.key, v)}
            />
          </ConfigRow>
          <Slider
            min={field.min}
            max={field.max}
            step={field.step}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
          />
        </Section>
      )

    case 'select':
      return (
        <Section>
          <SectionLabel>
            <LabelWithIcon>
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </LabelWithIcon>
          </SectionLabel>
          <Select
            style={{ width: '100%' }}
            value={value ?? field.defaultValue}
            onChange={(v) => onChange(field.key, v)}
            options={field.options?.map((opt) => ({ label: opt.label, value: opt.value }))}
          />
        </Section>
      )

    case 'switch':
      return (
        <Section>
          <ConfigRow>
            <span className="label">
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </span>
            <Switch
              size="small"
              checked={value ?? field.defaultValue ?? false}
              onChange={(v) => onChange(field.key, v)}
            />
          </ConfigRow>
        </Section>
      )

    case 'seed':
      return (
        <Section>
          <ConfigRow>
            <span className="label">
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </span>
          </ConfigRow>
          <SeedRow>
            <StyledInputNumber
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
          </SeedRow>
        </Section>
      )

    case 'aspectRatio':
      return (
        <Section>
          <SectionLabel>
            <LabelWithIcon>
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </LabelWithIcon>
          </SectionLabel>
          <RatioGrid>
            {field.options?.map((opt) => (
              <RatioButton
                key={String(opt.value)}
                $active={(value ?? field.defaultValue) === opt.value}
                onClick={() => onChange(field.key, opt.value)}>
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
          <SectionLabel>
            <LabelWithIcon>
              {field.label}
              {field.description && (
                <Tooltip title={field.description}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-secondary)' }} />
                </Tooltip>
              )}
            </LabelWithIcon>
          </SectionLabel>
          <ImageGrid>
            {images.map((img: string, index: number) => (
              <ImagePreview key={index}>
                <img src={img} alt="" />
                <div className="remove-btn" onClick={() => handleRemoveImage(index)}>
                  ×
                </div>
              </ImagePreview>
            ))}
            <Upload accept="image/*" multiple showUploadList={false} beforeUpload={handleImageUpload}>
              <UploadButton>
                <PlusOutlined />
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
// 动态表单组件
// ============================================================================

export interface DynamicImageFormProps {
  /** 模型 ID */
  modelId: string
  /** Provider ID */
  providerId?: string
  /** 表单值 */
  values: Record<string, any>
  /** 值变更回调 */
  onChange: (key: string, value: any) => void
  /** 是否显示高级选项 */
  showAdvanced?: boolean
  /** 是否显示风格选项 */
  showStyle?: boolean
  /** 是否显示输出选项 */
  showOutput?: boolean
}

export const DynamicImageForm = memo(function DynamicImageForm({
  modelId,
  providerId,
  values,
  onChange,
  showAdvanced = true,
  showStyle = true,
  showOutput = true
}: DynamicImageFormProps) {
  // 获取模型对应的字段配置
  const allFields = useMemo(() => getModelFieldConfigs(modelId, providerId), [modelId, providerId])

  // 按分组获取字段
  const basicFields = useMemo(() => getFieldsByGroup(allFields, 'basic'), [allFields])
  const advancedFields = useMemo(() => getFieldsByGroup(allFields, 'advanced'), [allFields])
  const styleFields = useMemo(() => getFieldsByGroup(allFields, 'style'), [allFields])
  const outputFields = useMemo(() => getFieldsByGroup(allFields, 'output'), [allFields])

  // 构建折叠面板项
  const collapseItems = useMemo(() => {
    const items: Array<{ key: string; label: string; children: ReactNode }> = []

    if (showAdvanced && advancedFields.length > 0) {
      items.push({
        key: 'advanced',
        label: '高级设置',
        children: advancedFields.map((field) => (
          <FieldRenderer key={field.key} field={field} value={values[field.key]} onChange={onChange} />
        ))
      })
    }

    if (showStyle && styleFields.length > 0) {
      items.push({
        key: 'style',
        label: '风格设置',
        children: styleFields.map((field) => (
          <FieldRenderer key={field.key} field={field} value={values[field.key]} onChange={onChange} />
        ))
      })
    }

    if (showOutput && outputFields.length > 0) {
      items.push({
        key: 'output',
        label: '输出设置',
        children: outputFields.map((field) => (
          <FieldRenderer key={field.key} field={field} value={values[field.key]} onChange={onChange} />
        ))
      })
    }

    return items
  }, [showAdvanced, showStyle, showOutput, advancedFields, styleFields, outputFields, values, onChange])

  return (
    <>
      {/* 基础字段 */}
      {basicFields.map((field) => (
        <FieldRenderer key={field.key} field={field} value={values[field.key]} onChange={onChange} />
      ))}

      {/* 折叠面板（高级/风格/输出）*/}
      {collapseItems.length > 0 && <Collapse ghost items={collapseItems} />}
    </>
  )
})

export default DynamicImageForm
