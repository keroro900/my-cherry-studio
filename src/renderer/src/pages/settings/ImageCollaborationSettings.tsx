/**
 * 图片协作设置组件
 *
 * 配置多Agent协同图片生成的模型选择
 */

import { QuestionCircleOutlined } from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useProviders } from '@renderer/hooks/useProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import {
  setImageCollaborationEnabled,
  setImageCollaborationMaxRetries,
  setImageCollaborationRoleModel,
  setImageCollaborationShowThinking,
  setImageCollaborationTemplate
} from '@renderer/store/settings'
import { InputNumber, Select, Switch, Tooltip } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  SettingContainer,
  SettingDescription,
  SettingDivider,
  SettingGroup,
  SettingRow,
  SettingRowTitle,
  SettingSubtitle,
  SettingTitle
} from '.'

// 协作角色定义
const COLLABORATION_ROLES = [
  { key: 'analyst', label: '分析师', labelEn: 'Analyst', icon: '🔍', description: '分析图片内容，提取特征' },
  { key: 'planner', label: '规划师', labelEn: 'Planner', icon: '📋', description: '制定生成计划和策略' },
  { key: 'generator', label: '生成师', labelEn: 'Generator', icon: '🎨', description: '执行图片生成' },
  { key: 'quality_checker', label: '质检师', labelEn: 'QC', icon: '✅', description: '检查质量，决定是否重试' }
] as const

// 协作模板定义
const COLLABORATION_TEMPLATES = [
  { value: 'gemini_all', label: 'Gemini 全能协作', description: '所有角色都使用 Gemini 模型' },
  { value: 'multi_model', label: '多模型协作', description: 'Claude 规划 + Gemini 生成' },
  { value: 'premium', label: '高质量协作', description: 'GPT-4 规划 + Gemini 生成' },
  { value: 'custom', label: '自定义', description: '手动为每个角色选择模型' }
] as const

const ImageCollaborationSettings: FC = () => {
  const { i18n } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const settings = useSettings()
  const { providers } = useProviders()

  // 提供默认值，防止 undefined 错误
  const imageCollaboration = settings.imageCollaboration ?? {
    enabled: true,
    template: 'gemini_all' as const,
    maxRetries: 2,
    showThinking: true,
    roleModels: {
      analyst: null,
      planner: null,
      generator: null,
      quality_checker: null
    }
  }

  const isZh = i18n.language.startsWith('zh')

  // 获取可用的模型选项
  const getModelOptions = () => {
    const options: { label: string; options: { value: string; label: string }[] }[] = []

    for (const provider of providers) {
      if (!provider.apiKey) continue

      const providerModels = provider.models.map((model) => ({
        value: JSON.stringify({ providerId: provider.id, modelId: model.id }),
        label: `${model.name || model.id}`
      }))

      if (providerModels.length > 0) {
        options.push({
          label: provider.name || provider.id,
          options: providerModels
        })
      }
    }

    return options
  }

  const modelOptions = getModelOptions()

  // 获取当前选中的模型值
  const getSelectedModelValue = (role: (typeof COLLABORATION_ROLES)[number]['key']) => {
    const config = imageCollaboration.roleModels[role]
    if (!config) return undefined
    return JSON.stringify(config)
  }

  // 处理模型选择变化
  const handleModelChange = (role: (typeof COLLABORATION_ROLES)[number]['key'], value: string | undefined) => {
    if (!value) {
      dispatch(setImageCollaborationRoleModel({ role, model: null }))
      return
    }

    try {
      const parsed = JSON.parse(value)
      dispatch(setImageCollaborationRoleModel({ role, model: parsed }))
    } catch {
      dispatch(setImageCollaborationRoleModel({ role, model: null }))
    }
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>
          {isZh ? '多Agent协作图片生成' : 'Multi-Agent Image Collaboration'}
          <Tooltip
            title={
              isZh
                ? '让多个 AI Agent 分工协作：分析师分析图片 → 规划师制定计划 → 生成师执行生成 → 质检师检查质量'
                : 'Multiple AI agents collaborate: Analyst analyzes → Planner makes plan → Generator creates → QC checks quality'
            }>
            <QuestionCircleOutlined style={{ marginLeft: 8, fontSize: 14, color: 'var(--color-text-3)' }} />
          </Tooltip>
        </SettingTitle>

        <SettingDivider />

        <SettingRow>
          <SettingRowTitle>{isZh ? '启用协作模式' : 'Enable Collaboration'}</SettingRowTitle>
          <Switch
            checked={imageCollaboration.enabled}
            onChange={(checked) => dispatch(setImageCollaborationEnabled(checked))}
          />
        </SettingRow>

        {imageCollaboration.enabled && (
          <>
            <SettingRow>
              <SettingRowTitle>{isZh ? '协作模板' : 'Collaboration Template'}</SettingRowTitle>
              <Select
                value={imageCollaboration.template}
                onChange={(value) => dispatch(setImageCollaborationTemplate(value))}
                style={{ width: 200 }}
                options={COLLABORATION_TEMPLATES.map((t) => ({
                  value: t.value,
                  label: isZh ? t.label : t.value.replace(/_/g, ' ')
                }))}
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{isZh ? '最大重试次数' : 'Max Retries'}</SettingRowTitle>
              <InputNumber
                value={imageCollaboration.maxRetries}
                onChange={(value) => dispatch(setImageCollaborationMaxRetries(value || 2))}
                min={0}
                max={5}
                style={{ width: 80 }}
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{isZh ? '显示思考过程' : 'Show Thinking'}</SettingRowTitle>
              <Switch
                checked={imageCollaboration.showThinking}
                onChange={(checked) => dispatch(setImageCollaborationShowThinking(checked))}
              />
            </SettingRow>

            {imageCollaboration.template === 'custom' && (
              <>
                <SettingDivider />
                <SettingSubtitle>{isZh ? '角色模型配置' : 'Role Model Configuration'}</SettingSubtitle>
                <SettingDescription>
                  {isZh
                    ? '为每个协作角色选择使用的模型。如果不选择，将使用系统默认模型。'
                    : 'Select model for each collaboration role. If not selected, system default will be used.'}
                </SettingDescription>

                {COLLABORATION_ROLES.map((role) => (
                  <RoleModelRow key={role.key}>
                    <RoleInfo>
                      <RoleIcon>{role.icon}</RoleIcon>
                      <RoleLabel>
                        <RoleName>{isZh ? role.label : role.labelEn}</RoleName>
                        <RoleDesc>{role.description}</RoleDesc>
                      </RoleLabel>
                    </RoleInfo>
                    <Select
                      value={getSelectedModelValue(role.key)}
                      onChange={(value) => handleModelChange(role.key, value)}
                      allowClear
                      placeholder={isZh ? '选择模型' : 'Select model'}
                      style={{ width: 280 }}
                      options={modelOptions}
                      showSearch
                      optionFilterProp="label"
                    />
                  </RoleModelRow>
                ))}
              </>
            )}
          </>
        )}
      </SettingGroup>
    </SettingContainer>
  )
}

// Styled components
const RoleModelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`

const RoleInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const RoleIcon = styled.span`
  font-size: 24px;
`

const RoleLabel = styled.div`
  display: flex;
  flex-direction: column;
`

const RoleName = styled.span`
  font-weight: 500;
  font-size: 14px;
`

const RoleDesc = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

export default ImageCollaborationSettings
