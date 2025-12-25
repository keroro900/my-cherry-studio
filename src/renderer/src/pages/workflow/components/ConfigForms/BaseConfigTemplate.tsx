/**
 * BaseConfigTemplate - 统一的节点配置表单模板
 *
 * 功能：
 * - 提供统一的表单布局结构
 * - 标准化各个配置区域（模型选择、图片输入、预设、高级选项）
 * - 统一的系统提示词编辑入口
 * - 统一的风格预设模态框
 *
 * 使用方式：
 * 各节点 ConfigForm 组件通过 children 或 render props 的方式
 * 在各个槽位中插入自定义内容
 */

import './FormTheme.css'

import { EditOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Collapse } from 'antd'
import type { FC, ReactNode } from 'react'
import { memo, useCallback, useState } from 'react'

import type { PromptStep } from '../PromptEditorModal'
import PromptEditorModal from '../PromptEditorModal'
import { FormSection } from './FormComponents'
import ModelSelectorButton, { imageGenerationModelFilter } from './ModelSelectorButton'

// ==================== 类型定义 ====================

/**
 * 基础配置表单 Props
 */
export interface BaseConfigTemplateProps {
  /** 节点类型 */
  nodeType: string
  /** 节点显示名称 */
  nodeLabel: string
  /** 节点图标 */
  nodeIcon?: string
  /** 节点描述 */
  nodeDescription?: string

  /** 当前配置 */
  config: Record<string, any>
  /** 配置更新回调 */
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void

  // === 模型配置 ===
  /** 是否显示模型选择器 */
  showModelSelector?: boolean
  /** 模型过滤器类型 */
  modelFilterType?: 'image' | 'text' | 'all'
  /** 当前 providerId */
  providerId?: string
  /** 当前 modelId */
  modelId?: string
  /** 模型变更回调 */
  onUpdateModel?: (providerId: string, modelId: string) => void

  // === 系统提示词配置 ===
  /** 是否显示提示词编辑按钮 */
  showPromptEditor?: boolean
  /** 提示词步骤定义 */
  promptSteps?: PromptStep[]
  /** 可用变量列表 */
  availableVariables?: Array<{ key: string; label: string; description?: string }>
  /** 提示词保存回调 */
  onSavePrompts?: (steps: PromptStep[]) => void

  // === 区域内容插槽 ===
  /** 模型配置区域额外内容 */
  modelSectionExtra?: ReactNode
  /** 主要配置区域内容 */
  mainContent?: ReactNode
  /** 预设配置区域内容 */
  presetContent?: ReactNode
  /** 图片输入配置区域内容 */
  imageInputContent?: ReactNode
  /** 生成选项区域内容 */
  generateOptionsContent?: ReactNode
  /** 高级选项区域内容 */
  advancedContent?: ReactNode
  /** 底部额外内容 */
  footerContent?: ReactNode

  /** 是否显示高级选项 */
  showAdvancedOptions?: boolean
  /** 高级选项默认展开 */
  advancedDefaultOpen?: boolean
}

/**
 * 统一的节点配置表单模板
 */
const BaseConfigTemplate: FC<BaseConfigTemplateProps> = ({
  nodeType: _nodeType,
  nodeLabel,
  nodeIcon,
  nodeDescription,
  config,
  onUpdateConfig,
  showModelSelector = true,
  modelFilterType = 'image',
  providerId,
  modelId,
  onUpdateModel,
  showPromptEditor = false,
  promptSteps = [],
  availableVariables = [],
  onSavePrompts,
  modelSectionExtra,
  mainContent,
  presetContent,
  imageInputContent,
  generateOptionsContent,
  advancedContent,
  footerContent,
  showAdvancedOptions = true,
  advancedDefaultOpen = false
}) => {
  // nodeType 保留用于未来扩展（如条件渲染）
  void _nodeType

  // 提示词编辑模态框状态
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)

  // 获取当前模型配置
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 处理模型选择变化
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

  // 处理提示词保存
  const handleSavePrompts = useCallback(
    (steps: PromptStep[]) => {
      // 将编辑后的提示词保存到配置中
      const customPrompts: Record<string, string> = {}
      steps.forEach((step) => {
        if (step.prompt !== step.defaultPrompt) {
          customPrompts[step.id] = step.prompt
        }
      })
      onUpdateConfig('customPrompts', customPrompts)

      if (onSavePrompts) {
        onSavePrompts(steps)
      }
    },
    [onUpdateConfig, onSavePrompts]
  )

  // 获取模型过滤器
  const getModelFilter = () => {
    switch (modelFilterType) {
      case 'image':
        return imageGenerationModelFilter
      case 'text':
        return undefined // TODO: 添加文本模型过滤器
      default:
        return undefined
    }
  }

  // 准备提示词步骤（合并自定义提示词）
  const preparedPromptSteps = promptSteps.map((step) => ({
    ...step,
    prompt: config.customPrompts?.[step.id] || step.prompt
  }))

  return (
    <div className="workflow-root">
      {/* 节点说明 */}
      {nodeDescription && (
        <Alert
          message={
            <span>
              {nodeIcon && <span style={{ marginRight: 8 }}>{nodeIcon}</span>}
              {nodeLabel}
            </span>
          }
          description={nodeDescription}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 模型配置区域 */}
      {showModelSelector && (
        <FormSection title="🤖 AI 模型">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ModelSelectorButton
              providerId={currentProviderId}
              modelId={currentModelId}
              filter={getModelFilter()}
              showTagFilter={true}
              onModelChange={handleModelChange}
              placeholder="点击选择模型"
            />

            {/* 系统提示词编辑按钮 */}
            {showPromptEditor && promptSteps.length > 0 && (
              <Button
                type="default"
                icon={<EditOutlined />}
                onClick={() => setPromptEditorOpen(true)}
                title="编辑系统提示词">
                编辑提示词
              </Button>
            )}
          </div>

          {/* 模型配置额外内容 */}
          {modelSectionExtra}
        </FormSection>
      )}

      {/* 主要配置区域 */}
      {mainContent}

      {/* 预设配置区域 */}
      {presetContent}

      {/* 图片输入配置区域 */}
      {imageInputContent}

      {/* 生成选项区域 */}
      {generateOptionsContent}

      {/* 高级选项区域 */}
      {showAdvancedOptions && advancedContent && (
        <Collapse
          ghost
          defaultActiveKey={advancedDefaultOpen ? ['advanced'] : []}
          items={[
            {
              key: 'advanced',
              label: (
                <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>
                  <SettingOutlined style={{ marginRight: 8 }} />
                  高级选项
                </span>
              ),
              children: <div style={{ paddingTop: '8px' }}>{advancedContent}</div>
            }
          ]}
        />
      )}

      {/* 底部额外内容 */}
      {footerContent}

      {/* 提示词编辑模态框 */}
      {showPromptEditor && (
        <PromptEditorModal
          open={promptEditorOpen}
          title={`${nodeLabel} - 系统提示词配置`}
          steps={preparedPromptSteps}
          availableVariables={availableVariables}
          onClose={() => setPromptEditorOpen(false)}
          onSave={handleSavePrompts}
        />
      )}
    </div>
  )
}

export default memo(BaseConfigTemplate)

// ==================== 辅助组件导出 ====================

/**
 * 预设选择器包装组件
 * 用于统一的风格预设模态框
 */
export interface PresetSelectorProps {
  /** 当前选中的预设 */
  value: string
  /** 预设变更回调 */
  onChange: (value: string) => void
  /** 预设选项列表 */
  options: Array<{
    label: string
    value: string
    description?: string
    icon?: string
  }>
  /** 按钮文本 */
  buttonText?: string
  /** 模态框标题 */
  modalTitle?: string
}

// 预设选择器将在单独的文件中实现，这里只导出类型
export type { PromptStep }
