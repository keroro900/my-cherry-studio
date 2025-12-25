/**
 * 视频提示词节点配置表单
 *
 * 功能：
 * - 视频时长和动作风格配置
 * - 安全约束配置（禁止转身、禁止快速动作）
 * - 系统提示词编辑（使用 PromptEditorSection）
 * - 不包含模型选择器（由 ConfigPanel 自动添加）
 */

import './FormTheme.css'

import { useAppSelector } from '@renderer/store'
import type { Provider } from '@renderer/types'
import { Checkbox, Collapse, Divider, Input } from 'antd'
import { memo, useCallback } from 'react'

import { DURATION_PRESETS, MOTION_TYPE_PRESETS } from '../../nodes/ai/VideoPromptNode/prompts'
import type { ConfigFormProps } from './ConfigFormRegistry'
import { FormRow, FormSection, FormSelect } from './FormComponents'
import ModelSelectorButton from './ModelSelectorButton'
import { PromptEditorSection } from './sections'

const { TextArea } = Input

// 将预设转换为表单选项
const DURATION_OPTIONS = DURATION_PRESETS.map((p) => ({
  label: p.name,
  value: p.id,
  description: p.description
}))

const MOTION_TYPE_OPTIONS = MOTION_TYPE_PRESETS.map((p) => ({
  label: p.name,
  value: p.id,
  description: p.description
}))

/**
 * 视频提示词节点配置表单
 */
function VideoPromptConfigForm({ config, providerId, modelId, onUpdateConfig, onUpdateModel }: ConfigFormProps) {
  // 从 Redux store 获取 providers
  const providers = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (typeof onUpdateConfig === 'function') {
        onUpdateConfig('providerId', newProviderId)
        onUpdateConfig('modelId', newModelId)
      }
      onUpdateModel?.(newProviderId, newModelId)
    },
    [onUpdateConfig, onUpdateModel]
  )

  return (
    <div className="workflow-root">
      {/* AI 模型选择 */}
      <FormSection title="🤖 AI 模型">
        <FormRow label="视觉模型" description="选择支持视觉分析的 AI 模型">
          <ModelSelectorButton
            providerId={currentProviderId}
            modelId={currentModelId}
            providers={providers}
            showTagFilter={true}
            onModelChange={handleModelChange}
            placeholder="点击选择 AI 模型"
          />
        </FormRow>

        {/* 系统提示词编辑 */}
        <div style={{ marginTop: 8 }}>
          <PromptEditorSection
            nodeType="video_prompt"
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => onUpdateConfig('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="primary"
            modalTitle="视频提示词配置"
          />
        </div>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 视频配置 */}
      <FormSection title="🎬 视频配置">
        <FormRow label="视频时长" description="选择视频时长">
          <FormSelect
            value={config.duration || '5s'}
            onChange={(value) => onUpdateConfig('duration', value)}
            options={DURATION_OPTIONS}
          />
        </FormRow>
        <FormRow label="动作风格" description="选择动作风格">
          <FormSelect
            value={config.motionType || 'gentle'}
            onChange={(value) => onUpdateConfig('motionType', value)}
            options={MOTION_TYPE_OPTIONS}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 安全约束配置 */}
      <FormSection title="⚠️ 安全约束">
        <FormRow label="禁止转身" description="禁止模特转身、转体、旋转（强烈建议开启）">
          <Checkbox
            checked={config.noTurning !== false}
            onChange={(e) => onUpdateConfig('noTurning', e.target.checked)}>
            开启
          </Checkbox>
        </FormRow>
        <FormRow label="禁止快速动作" description="禁止跳跃、奔跑等快速动作">
          <Checkbox
            checked={config.noFastMotion !== false}
            onChange={(e) => onUpdateConfig('noFastMotion', e.target.checked)}>
            开启
          </Checkbox>
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 高级配置 */}
      <Collapse
        ghost
        items={[
          {
            key: 'advanced',
            label: <span style={{ fontSize: 13, fontWeight: 500 }}>⚙️ 高级配置</span>,
            children: (
              <div style={{ padding: '8px 0' }}>
                {/* 额外约束 */}
                <FormRow label="额外约束" description="自定义约束条件，例如：保持微笑、头发要飘动等">
                  <TextArea
                    value={config.constraintPrompt || ''}
                    onChange={(e) => onUpdateConfig('constraintPrompt', e.target.value)}
                    placeholder="自定义约束条件..."
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    style={{ fontSize: 12 }}
                  />
                </FormRow>

                {/* Temperature */}
                <FormRow label="创意度 (Temperature)" description={`当前值: ${config.temperature ?? 0.7}`}>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature ?? 0.7}
                    onChange={(e) => onUpdateConfig('temperature', parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </FormRow>
              </div>
            )
          }
        ]}
      />
    </div>
  )
}

export default memo(VideoPromptConfigForm)
