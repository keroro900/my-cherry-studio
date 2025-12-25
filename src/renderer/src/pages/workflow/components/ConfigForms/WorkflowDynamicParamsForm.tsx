/**
 * 工作流动态参数表单
 *
 * 使用 useModelParams hook 从中转服务动态获取模型参数定义
 * 支持远程 Schema 和本地静态配置的降级
 */

import useModelParams, { type DynamicFieldConfig } from '@renderer/hooks/useModelParams'
import { useProviders } from '@renderer/hooks/useProvider'
import { Spin } from 'antd'
import { ChevronDown } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { FormInput, FormNumber, FormRow, FormSelect, FormSlider, FormSwitch, FormTextArea } from './FormComponents'

// ============================================================================
// 类型定义
// ============================================================================

interface WorkflowDynamicParamsFormProps {
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** 当前配置值 */
  config: Record<string, any>
  /** 配置更新回调 */
  onUpdateConfig: (key: string, value: any) => void
  /** 显示基础字段组 */
  showBasic?: boolean
  /** 显示高级字段组 */
  showAdvanced?: boolean
  /** 显示风格字段组 */
  showStyle?: boolean
  /** 显示输出字段组 */
  showOutput?: boolean
  /** 排除的字段 (不渲染) */
  excludeFields?: string[]
  /** 自定义标题 */
  title?: string
  /** 默认展开 */
  defaultExpanded?: boolean
}

// ============================================================================
// 样式组件
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  color: var(--color-text-3);
`

const ErrorContainer = styled.div`
  padding: 12px;
  background: var(--color-error-bg, rgba(255, 77, 79, 0.1));
  border: 1px solid var(--color-error, #ff4d4f);
  border-radius: 6px;
  color: var(--color-error, #ff4d4f);
  font-size: 13px;
`

const EmptyContainer = styled.div`
  padding: 16px;
  text-align: center;
  color: var(--color-text-3);
  font-size: 13px;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

// 简单的折叠区域组件
const SectionHeader = styled.div<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: ${(props) => (props.$isOpen ? '12px' : '0')};

  &:hover {
    color: var(--color-primary);
  }
`

const SectionTitle = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const SectionIcon = styled.span<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;
  transform: rotate(${(props) => (props.$isOpen ? '180deg' : '0deg')});
  color: var(--color-text-3);
`

const SectionContent = styled.div<{ $isOpen: boolean }>`
  display: ${(props) => (props.$isOpen ? 'block' : 'none')};
  padding-bottom: 8px;
`

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({ title, defaultExpanded = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded)

  return (
    <div>
      <SectionHeader $isOpen={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <SectionTitle>{title}</SectionTitle>
        <SectionIcon $isOpen={isOpen}>
          <ChevronDown size={14} />
        </SectionIcon>
      </SectionHeader>
      <SectionContent $isOpen={isOpen}>{children}</SectionContent>
    </div>
  )
}

// ============================================================================
// 字段渲染器
// ============================================================================

interface FieldRendererProps {
  field: DynamicFieldConfig
  value: any
  onChange: (value: any) => void
  allValues: Record<string, any>
  getFieldRange: (fieldKey: string, values: Record<string, any>) => { min?: number; max?: number }
}

const FieldRenderer: FC<FieldRendererProps> = ({ field, value, onChange, allValues, getFieldRange }) => {
  // 获取动态范围
  const range = getFieldRange(field.key, allValues)
  const min = range.min ?? field.min
  const max = range.max ?? field.max

  // 使用默认值
  const currentValue = value ?? field.defaultValue

  switch (field.type) {
    case 'text':
      return (
        <FormRow label={field.label} description={field.description} required={field.validation?.required}>
          <FormInput
            value={currentValue || ''}
            onChange={onChange}
            placeholder={field.placeholder}
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'textarea':
      return (
        <FormRow label={field.label} description={field.description} required={field.validation?.required}>
          <FormTextArea
            value={currentValue || ''}
            onChange={onChange}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={4}
          />
        </FormRow>
      )

    case 'number':
      return (
        <FormRow label={field.label} description={field.description} required={field.validation?.required}>
          <FormNumber
            value={currentValue}
            onChange={onChange}
            min={min}
            max={max}
            step={field.step}
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'slider':
      return (
        <FormRow label={field.label} description={field.description} required={field.validation?.required}>
          <FormSlider
            value={currentValue ?? min ?? 0}
            onChange={onChange}
            min={min ?? 0}
            max={max ?? 100}
            step={field.step ?? 1}
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'select':
      return (
        <FormRow label={field.label} description={field.description} required={field.validation?.required}>
          <FormSelect
            value={currentValue}
            onChange={onChange}
            options={field.options || []}
            placeholder={field.placeholder}
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'switch':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormSwitch checked={!!currentValue} onChange={onChange} disabled={field.disabled} />
        </FormRow>
      )

    case 'seed':
      return (
        <FormRow label={field.label} description={field.description || '随机种子，-1 表示随机'}>
          <FormNumber
            value={currentValue ?? -1}
            onChange={onChange}
            min={-1}
            max={2147483647}
            step={1}
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'aspectRatio':
      return (
        <FormRow label={field.label} description={field.description}>
          <FormSelect
            value={currentValue || '1:1'}
            onChange={onChange}
            options={
              field.options || [
                { label: '1:1 (正方形)', value: '1:1' },
                { label: '16:9 (横向)', value: '16:9' },
                { label: '9:16 (纵向)', value: '9:16' },
                { label: '4:3', value: '4:3' },
                { label: '3:4', value: '3:4' }
              ]
            }
            disabled={field.disabled}
          />
        </FormRow>
      )

    case 'images':
      // 图片上传字段 - 暂时显示提示
      return (
        <FormRow label={field.label} description={field.description}>
          <EmptyContainer>图片上传请使用专用输入节点</EmptyContainer>
        </FormRow>
      )

    default:
      return (
        <FormRow label={field.label} description={field.description}>
          <FormInput
            value={String(currentValue || '')}
            onChange={onChange}
            placeholder={field.placeholder}
            disabled={field.disabled}
          />
        </FormRow>
      )
  }
}

// ============================================================================
// 主组件
// ============================================================================

export const WorkflowDynamicParamsForm: FC<WorkflowDynamicParamsFormProps> = ({
  providerId,
  modelId,
  config,
  onUpdateConfig,
  showBasic = true,
  showAdvanced = true,
  showStyle = false,
  showOutput = false,
  excludeFields = [],
  title = '模型参数',
  defaultExpanded = true
}) => {
  // 获取 providers
  const { providers } = useProviders()

  // 查找 provider 和 model 对象
  const provider = useMemo(() => {
    return providers.find((p) => p.id === providerId)
  }, [providers, providerId])

  const model = useMemo(() => {
    if (!provider) return undefined
    return provider.models?.find((m) => m.id === modelId)
  }, [provider, modelId])

  // 使用动态参数 hook
  const { isLoading, error, fields, fieldsByGroup, isFieldVisible, getFieldRange, defaultValues } = useModelParams(
    provider,
    model
  )

  // 初始化默认值
  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      // 只设置未定义的字段
      for (const [key, value] of Object.entries(defaultValues)) {
        if (config[key] === undefined && !excludeFields.includes(key)) {
          onUpdateConfig(key, value)
        }
      }
    }
  }, [defaultValues, config, excludeFields, onUpdateConfig])

  // 过滤可见字段
  const getVisibleFields = useCallback(
    (groupFields: DynamicFieldConfig[]) => {
      return groupFields.filter((field) => {
        // 排除指定字段
        if (excludeFields.includes(field.key)) return false
        // 检查字段可见性
        return isFieldVisible(field.key, config)
      })
    },
    [excludeFields, isFieldVisible, config]
  )

  // 渲染字段组
  const renderFieldGroup = useCallback(
    (groupFields: DynamicFieldConfig[], groupTitle?: string, collapsed?: boolean) => {
      const visibleFields = getVisibleFields(groupFields)
      if (visibleFields.length === 0) return null

      const content = (
        <FieldGroup>
          {visibleFields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) => onUpdateConfig(field.key, value)}
              allValues={config}
              getFieldRange={getFieldRange}
            />
          ))}
        </FieldGroup>
      )

      if (groupTitle) {
        return (
          <CollapsibleSection title={groupTitle} defaultExpanded={!collapsed}>
            {content}
          </CollapsibleSection>
        )
      }

      return content
    },
    [getVisibleFields, config, onUpdateConfig, getFieldRange]
  )

  // 加载状态
  if (isLoading) {
    return (
      <LoadingContainer>
        <Spin size="small" />
        <span style={{ marginLeft: 8 }}>加载模型参数...</span>
      </LoadingContainer>
    )
  }

  // 错误状态
  if (error) {
    return <ErrorContainer>加载模型参数失败: {error}</ErrorContainer>
  }

  // 无字段
  if (fields.length === 0) {
    return <EmptyContainer>该模型暂无可配置参数</EmptyContainer>
  }

  // 渲染表单
  const basicFields = fieldsByGroup.basic || []
  const advancedFields = fieldsByGroup.advanced || []
  const styleFields = fieldsByGroup.style || []
  const outputFields = fieldsByGroup.output || []

  const hasContent =
    (showBasic && getVisibleFields(basicFields).length > 0) ||
    (showAdvanced && getVisibleFields(advancedFields).length > 0) ||
    (showStyle && getVisibleFields(styleFields).length > 0) ||
    (showOutput && getVisibleFields(outputFields).length > 0)

  if (!hasContent) {
    return null
  }

  return (
    <CollapsibleSection title={title} defaultExpanded={defaultExpanded}>
      <Container>
        {showBasic && renderFieldGroup(basicFields)}
        {showAdvanced &&
          getVisibleFields(advancedFields).length > 0 &&
          renderFieldGroup(advancedFields, '高级参数', true)}
        {showStyle && getVisibleFields(styleFields).length > 0 && renderFieldGroup(styleFields, '风格参数', true)}
        {showOutput && getVisibleFields(outputFields).length > 0 && renderFieldGroup(outputFields, '输出参数', true)}
      </Container>
    </CollapsibleSection>
  )
}

export default WorkflowDynamicParamsForm
