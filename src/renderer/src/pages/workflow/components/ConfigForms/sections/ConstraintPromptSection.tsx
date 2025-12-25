/**
 * 约束提示词区块组件
 *
 * 可复用的约束提示词输入 UI 组件
 */

import { Divider, Input } from 'antd'
import { memo } from 'react'

import { FormRow, FormSection } from '../FormComponents'

const { TextArea } = Input

export interface ConstraintPromptSectionProps {
  /** 当前值 */
  value?: string
  /** 值变更回调 */
  onChange: (value: string) => void
  /** 区块标题 */
  title?: string
  /** 输入标签 */
  label?: string
  /** 输入描述 */
  description?: string
  /** 占位符 */
  placeholder?: string
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
  /** 是否显示分隔线 */
  showDivider?: boolean
}

function ConstraintPromptSection({
  value = '',
  onChange,
  title = '📝 约束提示词',
  label = '自定义约束',
  description = '添加额外的约束条件到提示词中',
  placeholder = '例如：双手叉腰、眼神看向镜头、背景需要有绿植、穿白色运动鞋等',
  minRows = 2,
  maxRows = 4,
  showDivider = true
}: ConstraintPromptSectionProps) {
  return (
    <>
      {showDivider && <Divider style={{ margin: '16px 0' }} />}
      <FormSection title={title}>
        <FormRow label={label} description={description}>
          <TextArea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoSize={{ minRows, maxRows }}
            style={{ fontSize: '12px' }}
          />
        </FormRow>
      </FormSection>
    </>
  )
}

export default memo(ConstraintPromptSection)
