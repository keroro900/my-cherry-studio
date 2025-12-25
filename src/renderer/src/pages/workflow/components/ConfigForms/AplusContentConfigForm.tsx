/**
 * A+ 内容生成节点配置表单
 * Aplus Content Config Form
 *
 * 功能：
 * - AI 模型选择
 * - A+ 模块类型选择
 * - 内容风格设置
 * - 语言选择
 * - 品牌信息配置
 */

import './FormTheme.css'

import { Alert, Collapse, Divider, InputNumber } from 'antd'
import { memo, useCallback } from 'react'

import { FormRow, FormSection, FormSelect, FormTextArea } from './FormComponents'
import ModelSelectorButton from './ModelSelectorButton'
import { PromptEditorSection } from './sections'

interface AplusContentConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
}

// ==================== A+ 模块类型选项 ====================
const MODULE_TYPE_OPTIONS = [
  { value: 'standard_header', label: '品牌标题' },
  { value: 'standard_image_text', label: '图文模块' },
  { value: 'standard_four_image', label: '四图模块' },
  { value: 'standard_comparison', label: '对比图表' },
  { value: 'standard_text', label: '纯文本' },
  { value: 'standard_single_image', label: '单图模块' },
  { value: 'premium_header', label: '高级标题' },
  { value: 'premium_video', label: '视频模块' }
]

// ==================== 内容风格选项 ====================
const CONTENT_STYLE_OPTIONS = [
  { value: 'professional', label: '专业' },
  { value: 'emotional', label: '情感' },
  { value: 'technical', label: '技术' },
  { value: 'lifestyle', label: '生活' },
  { value: 'premium', label: '奢华' }
]

// ==================== 语言选项 ====================
const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-UK', label: 'English (UK)' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' }
]

function AplusContentConfigForm({
  config,
  providerId,
  modelId,
  onUpdateConfig,
  onUpdateModel
}: AplusContentConfigFormProps) {
  // ==================== 事件处理 ====================

  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      onUpdateConfig('providerId', newProviderId)
      onUpdateConfig('modelId', newModelId)
      if (onUpdateModel) {
        onUpdateModel(newProviderId, newModelId)
      }
    },
    [onUpdateConfig, onUpdateModel]
  )

  const handleConfigChange = useCallback(
    (key: string, value: any) => {
      onUpdateConfig(key, value)
    },
    [onUpdateConfig]
  )

  const handleModuleTypesChange = useCallback(
    (values: string[]) => {
      onUpdateConfig('moduleTypes', values)
    },
    [onUpdateConfig]
  )

  // 获取当前选中的模块类型
  const currentModuleTypes = config.moduleTypes || ['standard_header', 'standard_image_text', 'standard_four_image']

  // ==================== 渲染 ====================

  return (
    <div className="config-form-container">
      {/* 节点描述 */}
      <Alert
        message="A+ 内容生成"
        description="生成亚马逊 A+ 页面（Enhanced Brand Content）的图文内容，支持多种模块类型和布局"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 模型选择 */}
      <FormSection title="🤖 AI 模型">
        <ModelSelectorButton
          providerId={config.providerId || providerId}
          modelId={config.modelId || modelId}
          onModelChange={handleModelChange}
          placeholder="点击选择 AI 模型"
          showTagFilter={true}
        />

        {/* 提示词编辑按钮 */}
        <div style={{ marginTop: 8 }}>
          <PromptEditorSection
            nodeType="aplus_content"
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => handleConfigChange('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="default"
            modalTitle="A+ 内容 - 提示词配置"
            showStatus={true}
            showReset={true}
          />
        </div>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* A+ 模块配置 */}
      <FormSection title="📄 A+ 模块">
        <FormRow label="模块类型" description="选择要生成的 A+ 模块类型（可多选）">
          <FormSelect
            mode="multiple"
            value={currentModuleTypes}
            options={MODULE_TYPE_OPTIONS}
            onChange={handleModuleTypesChange}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 内容设置 */}
      <FormSection title="✍️ 内容设置">
        <FormRow label="内容风格">
          <FormSelect
            value={config.contentStyle || 'professional'}
            options={CONTENT_STYLE_OPTIONS}
            onChange={(value) => handleConfigChange('contentStyle', value)}
          />
        </FormRow>

        <FormRow label="输出语言">
          <FormSelect
            value={config.language || 'en-US'}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => handleConfigChange('language', value)}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 品牌信息 */}
      <FormSection title="🏷️ 品牌信息">
        <FormRow label="品牌名称">
          <input
            type="text"
            value={config.brandName || ''}
            onChange={(e) => handleConfigChange('brandName', e.target.value)}
            placeholder="输入品牌名称"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--ant-color-border)',
              backgroundColor: 'var(--ant-color-bg-container)'
            }}
          />
        </FormRow>

        <FormRow label="目标受众">
          <input
            type="text"
            value={config.targetAudience || ''}
            onChange={(e) => handleConfigChange('targetAudience', e.target.value)}
            placeholder="如：25-45岁女性消费者"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--ant-color-border)',
              backgroundColor: 'var(--ant-color-bg-container)'
            }}
          />
        </FormRow>

        <FormRow label="关键词">
          <FormTextArea
            value={config.keywords || ''}
            onChange={(value) => handleConfigChange('keywords', value)}
            placeholder="输入要包含的关键词，用逗号分隔"
            rows={2}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 高级设置 */}
      <Collapse
        ghost
        items={[
          {
            key: 'advanced',
            label: '⚙️ 高级设置',
            children: (
              <>
                <FormRow label="创意度">
                  <InputNumber
                    value={config.temperature ?? 0.7}
                    min={0}
                    max={2}
                    step={0.1}
                    onChange={(value) => handleConfigChange('temperature', value)}
                    style={{ width: '100%' }}
                  />
                </FormRow>
              </>
            )
          }
        ]}
      />
    </div>
  )
}

export default memo(AplusContentConfigForm)
