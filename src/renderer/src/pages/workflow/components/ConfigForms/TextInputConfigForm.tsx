/**
 * 文本输入节点配置表单 - Cherry 风格
 * 支持 text_input 节点的配置
 */

import { memo } from 'react'

import { FormInput, FormRow, FormSection, FormSwitch, FormTextArea } from './FormComponents'

interface TextInputConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
}

function TextInputConfigForm({ config, onUpdateConfig }: TextInputConfigFormProps) {
  return (
    <div>
      <FormSection title="📝 文本配置">
        {/* 默认文本 */}
        <FormRow label="默认文本" description="节点初始化时的默认文本内容">
          <FormTextArea
            value={config.text || config.defaultValue || ''}
            onChange={(value) => onUpdateConfig('text', value)}
            placeholder="输入默认文本内容..."
            rows={4}
          />
        </FormRow>

        {/* 占位提示 */}
        <FormRow label="占位提示" description="输入框为空时显示的提示文本">
          <FormInput
            value={config.placeholder || ''}
            onChange={(value) => onUpdateConfig('placeholder', value)}
            placeholder="输入占位提示..."
          />
        </FormRow>

        {/* 多行模式 */}
        <FormRow label="多行输入" description="启用多行文本输入">
          <FormSwitch checked={config.multiline ?? true} onChange={(checked) => onUpdateConfig('multiline', checked)} />
        </FormRow>
      </FormSection>
    </div>
  )
}

export default memo(TextInputConfigForm)
