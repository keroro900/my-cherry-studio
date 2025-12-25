/**
 * 产品描述生成节点配置表单
 * Product Description Config Form
 *
 * 功能：
 * - AI 模型选择
 * - 目标平台设置
 * - 输出语言选择
 * - 文案风格设置
 * - SEO 和输出格式选项
 * - 提示词编辑器
 */

import './FormTheme.css'

import { Alert, Collapse, Divider, InputNumber, Switch } from 'antd'
import { memo, useCallback, useMemo } from 'react'

import { FormRow, FormSection, FormSelect } from './FormComponents'
import ModelSelectorButton from './ModelSelectorButton'
import { PromptEditorSection } from './sections'

interface ProductDescriptionConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
}

// ==================== 平台选项 ====================
const PLATFORM_OPTIONS = [
  { value: 'general', label: '通用' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'taobao', label: '淘宝/天猫' },
  { value: 'shein', label: 'SHEIN' },
  { value: 'temu', label: 'TEMU' }
]

// ==================== 语言选项 ====================
const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'multi', label: '多语言' }
]

// ==================== 风格选项 ====================
const TONE_STYLE_OPTIONS = [
  { value: 'professional', label: '专业' },
  { value: 'casual', label: '休闲' },
  { value: 'luxury', label: '奢华' },
  { value: 'playful', label: '活泼' },
  { value: 'technical', label: '技术' },
  { value: 'emotional', label: '情感' }
]

// ==================== 输出格式选项 ====================
const OUTPUT_FORMAT_OPTIONS = [
  { value: 'title_bullets', label: '标题 + 卖点' },
  { value: 'paragraph', label: '段落描述' },
  { value: 'full_listing', label: '完整列表' },
  { value: 'json', label: 'JSON 格式' }
]

function ProductDescriptionConfigForm({
  config,
  providerId,
  modelId,
  onUpdateConfig,
  onUpdateModel
}: ProductDescriptionConfigFormProps) {
  // ==================== 事件处理 ====================

  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (onUpdateModel) {
        onUpdateModel(newProviderId, newModelId)
      }
    },
    [onUpdateModel]
  )

  const handleConfigChange = useCallback(
    (key: string, value: any) => {
      onUpdateConfig(key, value)
    },
    [onUpdateConfig]
  )

  // ==================== 平台特定的默认值 ====================
  const platformDefaults = useMemo(() => {
    const platform = config.platform || 'general'
    switch (platform) {
      case 'amazon':
        return { maxTitleLength: 200, maxDescriptionLength: 2000, bulletCount: 5 }
      case 'shopify':
        return { maxTitleLength: 150, maxDescriptionLength: 5000, bulletCount: 4 }
      case 'taobao':
        return { maxTitleLength: 60, maxDescriptionLength: 3000, bulletCount: 5 }
      case 'shein':
        return { maxTitleLength: 100, maxDescriptionLength: 1000, bulletCount: 4 }
      case 'temu':
        return { maxTitleLength: 120, maxDescriptionLength: 1500, bulletCount: 5 }
      default:
        return { maxTitleLength: 150, maxDescriptionLength: 2000, bulletCount: 5 }
    }
  }, [config.platform])

  // ==================== 渲染 ====================

  return (
    <div className="config-form-container">
      {/* 节点描述 */}
      <Alert
        message="产品描述生成"
        description="使用 AI 生成多语言产品描述、卖点列表和 SEO 关键词，支持多个电商平台的风格优化"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 模型选择 */}
      <FormSection title="🤖 AI 模型">
        <ModelSelectorButton
          providerId={providerId}
          modelId={modelId}
          onModelChange={handleModelChange}
          placeholder="点击选择 AI 模型"
          showTagFilter={true}
        />

        {/* 提示词编辑按钮 */}
        <div style={{ marginTop: 8 }}>
          <PromptEditorSection
            nodeType="product_description"
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => handleConfigChange('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="default"
            modalTitle="产品描述 - 提示词配置"
            showStatus={true}
            showReset={true}
          />
        </div>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 平台设置 */}
      <FormSection title="🛒 平台设置">
        <FormRow label="目标平台">
          <FormSelect
            value={config.platform || 'general'}
            options={PLATFORM_OPTIONS}
            onChange={(value) => handleConfigChange('platform', value)}
          />
        </FormRow>

        <FormRow label="输出语言">
          <FormSelect
            value={config.language || 'zh-CN'}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => handleConfigChange('language', value)}
          />
        </FormRow>

        <FormRow label="文案风格">
          <FormSelect
            value={config.toneStyle || 'professional'}
            options={TONE_STYLE_OPTIONS}
            onChange={(value) => handleConfigChange('toneStyle', value)}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 输出设置 */}
      <FormSection title="📝 输出设置">
        <FormRow label="输出格式">
          <FormSelect
            value={config.outputFormat || 'full_listing'}
            options={OUTPUT_FORMAT_OPTIONS}
            onChange={(value) => handleConfigChange('outputFormat', value)}
          />
        </FormRow>

        <FormRow label="包含 SEO 关键词">
          <Switch
            checked={config.includeSEO !== false}
            onChange={(checked) => handleConfigChange('includeSEO', checked)}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '12px 0' }} />

      {/* 高级设置 - 折叠面板 */}
      <Collapse
        ghost
        items={[
          {
            key: 'advanced',
            label: '⚙️ 高级设置',
            children: (
              <>
                <FormRow label={`卖点数量 (${platformDefaults.bulletCount})`}>
                  <InputNumber
                    value={config.bulletCount || platformDefaults.bulletCount}
                    min={3}
                    max={10}
                    onChange={(value) => handleConfigChange('bulletCount', value)}
                    style={{ width: '100%' }}
                  />
                </FormRow>

                <FormRow label={`标题最大字符 (${platformDefaults.maxTitleLength})`}>
                  <InputNumber
                    value={config.maxTitleLength || platformDefaults.maxTitleLength}
                    min={50}
                    max={300}
                    onChange={(value) => handleConfigChange('maxTitleLength', value)}
                    style={{ width: '100%' }}
                  />
                </FormRow>

                <FormRow label={`描述最大字符 (${platformDefaults.maxDescriptionLength})`}>
                  <InputNumber
                    value={config.maxDescriptionLength || platformDefaults.maxDescriptionLength}
                    min={500}
                    max={10000}
                    step={100}
                    onChange={(value) => handleConfigChange('maxDescriptionLength', value)}
                    style={{ width: '100%' }}
                  />
                </FormRow>

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

export default memo(ProductDescriptionConfigForm)
