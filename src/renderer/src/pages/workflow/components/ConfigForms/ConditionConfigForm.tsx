/**
 * 条件分支节点配置表单 - Cherry 风格
 * 支持 condition 节点的配置
 */

import { memo } from 'react'

import { FormCard, FormInput, FormRow, FormSection, FormSelect } from './FormComponents'

interface ConditionConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
}

/**
 * 操作符选项
 */
const OPERATOR_OPTIONS = [
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not_contains' },
  { label: '以...开头', value: 'starts_with' },
  { label: '以...结尾', value: 'ends_with' },
  { label: '存在', value: 'exists' },
  { label: '不存在', value: 'not_exists' }
]

function ConditionConfigForm({ config, onUpdateConfig }: ConditionConfigFormProps) {
  const operator = config.operator || 'equals'
  const needsValue = !['exists', 'not_exists'].includes(operator)

  return (
    <div>
      <FormSection title="🔀 条件配置">
        {/* 字段名 */}
        <FormRow label="检查字段" description="从输入 JSON 中检查的字段路径" required>
          <FormInput
            value={config.field || ''}
            onChange={(value) => onUpdateConfig('field', value)}
            placeholder="例如：status 或 data.type"
          />
        </FormRow>

        {/* 操作符 */}
        <FormRow label="比较操作" description="条件判断的方式">
          <FormSelect
            value={operator}
            onChange={(value) => onUpdateConfig('operator', value)}
            options={OPERATOR_OPTIONS}
          />
        </FormRow>

        {/* 期望值 */}
        {needsValue && (
          <FormRow label="期望值" description="与字段值进行比较的值">
            <FormInput
              value={config.value || ''}
              onChange={(value) => onUpdateConfig('value', value)}
              placeholder="输入期望的值..."
            />
          </FormRow>
        )}
      </FormSection>

      {/* 输出说明 */}
      <FormCard title="输出端口">
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
          <div>
            • <strong>满足条件 (true)</strong>: 条件成立时，数据从此端口输出
          </div>
          <div>
            • <strong>不满足 (false)</strong>: 条件不成立时，数据从此端口输出
          </div>
        </div>
      </FormCard>
    </div>
  )
}

export default memo(ConditionConfigForm)
