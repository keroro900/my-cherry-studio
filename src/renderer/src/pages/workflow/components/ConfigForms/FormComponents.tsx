/**
 * Cherry 风格的工作流表单组件
 * 完全使用 Ant Design + Cherry CSS 变量
 */

import { Input, InputNumber, Select, Slider, Switch } from 'antd'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import styled from 'styled-components'

// ==================== FormGroup - 表单分组 ====================

interface FormGroupProps {
  children: ReactNode
  style?: React.CSSProperties
}

export const FormGroup = styled.div<FormGroupProps>`
  margin-bottom: 20px;
`

// ==================== FormRow - 表单行 ====================

interface FormRowProps {
  label: string
  children: ReactNode
  description?: string
  required?: boolean
}

const FormRowContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`

const FormLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const RequiredMark = styled.span`
  color: var(--color-error);
`

const FormDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.4;
`

export const FormRow: FC<FormRowProps> = ({ label, children, description, required }) => {
  return (
    <FormRowContainer>
      <FormLabel>
        {label}
        {required && <RequiredMark>*</RequiredMark>}
      </FormLabel>
      {children}
      {description && <FormDescription>{description}</FormDescription>}
    </FormRowContainer>
  )
}

// ==================== FormInput - 文本输入 ====================

interface FormInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  type?: 'text' | 'password'
}

export const FormInput: FC<FormInputProps> = ({ value, onChange, placeholder, disabled, maxLength, type = 'text' }) => {
  const InputComponent = type === 'password' ? Input.Password : Input
  return (
    <InputComponent
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      style={{
        borderRadius: 'var(--list-item-border-radius)',
        fontSize: '13px'
      }}
    />
  )
}

// ==================== FormTextArea - 多行文本 ====================

interface FormTextAreaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  maxLength?: number
}

export const FormTextArea: FC<FormTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 4,
  maxLength
}) => {
  return (
    <Input.TextArea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      maxLength={maxLength}
      style={{
        borderRadius: 'var(--list-item-border-radius)',
        fontSize: '13px'
      }}
    />
  )
}

// ==================== FormSelect - 下拉选择 ====================

interface FormSelectProps {
  value: any
  onChange: (value: any) => void
  options: Array<{ label: string; value: any; description?: string }>
  placeholder?: string
  disabled?: boolean
  mode?: 'multiple' | 'tags'
  maxTagCount?: number | 'responsive'
}

export const FormSelect: FC<FormSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  mode,
  maxTagCount = 'responsive'
}) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      mode={mode}
      maxTagCount={mode ? maxTagCount : undefined}
      style={{ width: '100%' }}
      popupMatchSelectWidth={true}
    />
  )
}

// ==================== FormNumber - 数字输入 ====================

interface FormNumberProps {
  value: number | undefined
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
}

export const FormNumber: FC<FormNumberProps> = ({ value, onChange, min, max, step, placeholder, disabled }) => {
  return (
    <InputNumber
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        borderRadius: 'var(--list-item-border-radius)'
      }}
    />
  )
}

// ==================== FormSlider - 滑块 ====================

interface FormSliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  marks?: Record<number, string>
}

export const FormSlider: FC<FormSliderProps> = ({ value, onChange, min, max, step = 0.1, disabled, marks }) => {
  return (
    <div>
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} disabled={disabled} marks={marks} />
      <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textAlign: 'right', marginTop: '4px' }}>
        当前值: {value}
      </div>
    </div>
  )
}

// ==================== FormSwitch - 开关 ====================

interface FormSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  checkedChildren?: ReactNode
  unCheckedChildren?: ReactNode
}

export const FormSwitch: FC<FormSwitchProps> = ({
  checked,
  onChange,
  disabled,
  checkedChildren,
  unCheckedChildren
}) => {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
    />
  )
}

// ==================== FormSection - 表单分组标题 ====================

interface FormSectionProps {
  title: string
  icon?: string
  children: ReactNode
}

const FormSectionContainer = styled.div`
  margin-bottom: 24px;
`

const FormSectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-mute);
`

export const FormSection: FC<FormSectionProps> = ({ title, icon, children }) => {
  return (
    <FormSectionContainer>
      <FormSectionTitle>
        {icon && <span>{icon}</span>}
        {title}
      </FormSectionTitle>
      {children}
    </FormSectionContainer>
  )
}

// ==================== FormDivider - 分割线 ====================

export const FormDivider = styled.div`
  height: 1px;
  background: var(--color-border-mute);
  margin: 20px 0;
`

// ==================== HelpText - 帮助文本 ====================

interface HelpTextProps {
  children: ReactNode
}

export const HelpText = styled.div<HelpTextProps>`
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.5;
  margin-top: 4px;
`

// ==================== FieldGroup - 字段组 ====================

interface FieldGroupProps {
  direction?: 'horizontal' | 'vertical'
  gap?: number
  children: ReactNode
}

export const FieldGroup = styled.div<FieldGroupProps>`
  display: flex;
  flex-direction: ${(props) => (props.direction === 'horizontal' ? 'row' : 'column')};
  gap: ${(props) => props.gap || 12}px;
  align-items: ${(props) => (props.direction === 'horizontal' ? 'center' : 'stretch')};
`

// ==================== InlineFields - 行内字段 ====================

interface InlineFieldsProps {
  children: ReactNode
}

export const InlineFields = styled.div<InlineFieldsProps>`
  display: flex;
  gap: 12px;
  align-items: flex-end;

  & > * {
    flex: 1;
  }
`

// ==================== FormLabelStyled - 独立标签样式 ====================

export const FormLabelStyled = FormLabel

// ==================== RequiredMarkStyled - 必填标记样式 ====================

export const RequiredMarkStyled = RequiredMark

// ==================== FormCard - 表单卡片容器 ====================

interface FormCardProps {
  children: ReactNode
  title?: string
  collapsible?: boolean
}

const FormCardContainer = styled.div`
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border-mute);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`

const FormCardTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
`

export const FormCard: FC<FormCardProps> = ({ children, title }) => {
  return (
    <FormCardContainer>
      {title && <FormCardTitle>{title}</FormCardTitle>}
      {children}
    </FormCardContainer>
  )
}

// ==================== FormAlert - 警告/提示信息 ====================

interface FormAlertProps {
  type?: 'info' | 'warning' | 'error' | 'success'
  message: string
  description?: string
}

const alertColors = {
  info: { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
  warning: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806' },
  error: { bg: '#fff2f0', border: '#ffccc7', text: '#cf1322' },
  success: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' }
}

const FormAlertContainer = styled.div<{ $type: FormAlertProps['type'] }>`
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  background: ${(props) => alertColors[props.$type || 'info'].bg};
  border: 1px solid ${(props) => alertColors[props.$type || 'info'].border};
  color: ${(props) => alertColors[props.$type || 'info'].text};
  font-size: 13px;
  line-height: 1.5;
`

const FormAlertTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
`

export const FormAlert: FC<FormAlertProps> = ({ type = 'info', message, description }) => {
  return (
    <FormAlertContainer $type={type}>
      <FormAlertTitle>{message}</FormAlertTitle>
      {description && <div>{description}</div>}
    </FormAlertContainer>
  )
}

// ==================== FormTabs - 表单标签页 ====================

interface FormTabItem {
  key: string
  label: string
  children: ReactNode
}

interface FormTabsProps {
  items: FormTabItem[]
  activeKey?: string
  onChange?: (key: string) => void
}

const FormTabsHeader = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg-soft);
  border-radius: 6px;
  margin-bottom: 16px;
`

const FormTabItem = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: ${(props) => (props.$active ? 'var(--color-bg)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-2)')};
  font-size: 13px;
  font-weight: ${(props) => (props.$active ? 600 : 400)};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-bg)' : 'var(--color-bg-mute)')};
  }
`

export const FormTabs: FC<FormTabsProps> = ({ items, activeKey, onChange }) => {
  const [internalKey, setInternalKey] = useState(activeKey || items[0]?.key)

  const currentKey = activeKey !== undefined ? activeKey : internalKey
  const activeItem = items.find((item) => item.key === currentKey)

  const handleChange = (key: string) => {
    if (onChange) {
      onChange(key)
    } else {
      setInternalKey(key)
    }
  }

  return (
    <div>
      <FormTabsHeader>
        {items.map((item) => (
          <FormTabItem key={item.key} $active={item.key === currentKey} onClick={() => handleChange(item.key)}>
            {item.label}
          </FormTabItem>
        ))}
      </FormTabsHeader>
      {activeItem?.children}
    </div>
  )
}

// ==================== FormRadioGroup - 单选组 ====================

interface FormRadioGroupProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string; description?: string }>
  direction?: 'horizontal' | 'vertical'
}

const RadioGroupContainer = styled.div<{ $direction: string }>`
  display: flex;
  flex-direction: ${(props) => (props.$direction === 'horizontal' ? 'row' : 'column')};
  gap: ${(props) => (props.$direction === 'horizontal' ? '12px' : '8px')};
`

const RadioOption = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: ${(props) => (props.$checked ? '10px 12px' : '10px 12px')};
  border: 1px solid ${(props) => (props.$checked ? 'var(--color-primary)' : 'var(--color-border-mute)')};
  border-radius: 6px;
  cursor: pointer;
  background: ${(props) => (props.$checked ? 'var(--color-primary-bg)' : 'var(--color-bg)')};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const RadioDot = styled.div<{ $checked: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${(props) => (props.$checked ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$checked ? 'var(--color-primary)' : 'transparent')};
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: white;
    opacity: ${(props) => (props.$checked ? 1 : 0)};
  }
`

const RadioContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const RadioLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const RadioDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

export const FormRadioGroup: FC<FormRadioGroupProps> = ({ value, onChange, options, direction = 'vertical' }) => {
  return (
    <RadioGroupContainer $direction={direction}>
      {options.map((option) => (
        <RadioOption key={option.value} $checked={value === option.value} onClick={() => onChange(option.value)}>
          <RadioDot $checked={value === option.value} />
          <RadioContent>
            <RadioLabel>{option.label}</RadioLabel>
            {option.description && <RadioDescription>{option.description}</RadioDescription>}
          </RadioContent>
        </RadioOption>
      ))}
    </RadioGroupContainer>
  )
}

// ==================== FormCheckboxGroup - 多选组 ====================

interface FormCheckboxGroupProps {
  value: string[]
  onChange: (value: string[]) => void
  options: Array<{ label: string; value: string }>
  direction?: 'horizontal' | 'vertical'
}

const CheckboxOption = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid ${(props) => (props.$checked ? 'var(--color-primary)' : 'var(--color-border-mute)')};
  border-radius: 6px;
  cursor: pointer;
  background: ${(props) => (props.$checked ? 'var(--color-primary-bg)' : 'var(--color-bg)')};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const CheckboxBox = styled.div<{ $checked: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid ${(props) => (props.$checked ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$checked ? 'var(--color-primary)' : 'transparent')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &::after {
    content: '✓';
    color: white;
    font-size: 10px;
    opacity: ${(props) => (props.$checked ? 1 : 0)};
  }
`

export const FormCheckboxGroup: FC<FormCheckboxGroupProps> = ({ value, onChange, options, direction = 'vertical' }) => {
  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]
    onChange(newValue)
  }

  return (
    <RadioGroupContainer $direction={direction}>
      {options.map((option) => (
        <CheckboxOption
          key={option.value}
          $checked={value.includes(option.value)}
          onClick={() => handleToggle(option.value)}>
          <CheckboxBox $checked={value.includes(option.value)} />
          <RadioLabel>{option.label}</RadioLabel>
        </CheckboxOption>
      ))}
    </RadioGroupContainer>
  )
}
