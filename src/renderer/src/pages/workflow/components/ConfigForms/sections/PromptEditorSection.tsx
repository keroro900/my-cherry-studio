/**
 * 统一提示词编辑区域组件
 * Unified Prompt Editor Section
 *
 * 用于在节点配置表单中提供一致的提示词编辑体验
 * 自动根据节点类型获取默认提示词并支持自定义覆盖
 *
 * 功能：
 * - 自动从 nodePromptSteps 获取该节点类型的默认提示词
 * - 显示"编辑提示词"按钮，点击打开 PromptEditorModal
 * - 显示当前是否有自定义提示词的状态指示
 * - 支持重置为默认提示词
 */

import { EditOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Tag, Tooltip } from 'antd'
import { memo, useCallback, useMemo, useState } from 'react'

import PromptEditorModal, { type PromptStep } from '../../PromptEditorModal'
import { getPromptStepsForNode, getPromptVariables, hasCustomPrompts, stepsToCustomPrompts } from '../nodePromptSteps'

/**
 * 组件 Props
 */
interface PromptEditorSectionProps {
  /** 节点类型 */
  nodeType: string
  /** 节点配置（用于生成默认提示词） */
  config: Record<string, any>
  /** 当前自定义提示词 */
  customPrompts?: Record<string, string>
  /** 更新自定义提示词回调 */
  onUpdateCustomPrompts: (prompts: Record<string, string> | undefined) => void
  /** 按钮文本 */
  buttonText?: string
  /** 模态框标题 */
  modalTitle?: string
  /** 是否显示状态标签 */
  showStatus?: boolean
  /** 是否显示重置按钮 */
  showReset?: boolean
  /** 按钮类型 */
  buttonType?: 'default' | 'primary' | 'link' | 'text' | 'dashed'
  /** 按钮大小 */
  buttonSize?: 'small' | 'middle' | 'large'
  /** 额外的样式类名 */
  className?: string
}

/**
 * 获取节点类型的显示名称
 */
function getNodeTypeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    gemini_pattern: '图案生成',
    gemini_ecom: '电商图片',
    gemini_generate: '图片生成',
    gemini_generate_model: '模特图',
    gemini_model_from_clothes: '服装模特',
    gemini_edit: '图片编辑',
    unified_prompt: '智能提示词',
    video_prompt: '视频提示词',
    // 行业摄影节点
    jewelry_photo: '珠宝摄影',
    food_photo: '食品摄影',
    product_scene: '产品场景',
    jewelry_tryon: '首饰试戴',
    eyewear_tryon: '眼镜试戴',
    footwear_display: '鞋类展示',
    cosmetics_photo: '美妆产品',
    furniture_scene: '家具场景',
    electronics_photo: '电子产品',
    // 电商内容节点
    product_description: '产品描述',
    platform_resize: '平台适配',
    aplus_content: 'A+内容'
  }
  return labels[nodeType] || '提示词'
}

/**
 * 统一提示词编辑区域组件
 */
const PromptEditorSection = memo<PromptEditorSectionProps>(
  ({
    nodeType,
    config,
    customPrompts,
    onUpdateCustomPrompts,
    buttonText,
    modalTitle,
    showStatus = true,
    showReset = true,
    buttonType = 'default',
    buttonSize = 'middle',
    className
  }) => {
    // 模态框打开状态
    const [isModalOpen, setIsModalOpen] = useState(false)

    // 计算是否有自定义提示词
    const hasCustom = useMemo(() => hasCustomPrompts(customPrompts), [customPrompts])

    // 提取影响提示词生成的关键配置属性作为稳定的依赖键
    // 解决 React useMemo 浅比较问题：当 config 对象引用不变但属性变化时也能触发重新计算
    const configDepsKey = useMemo(() => {
      return JSON.stringify({
        // unified_prompt 关键属性
        outputMode: config.outputMode,
        // gemini_pattern 关键属性
        generationMode: config.generationMode,
        stylePreset: config.stylePreset,
        outputType: config.outputType,
        // 通用属性
        ageGroup: config.ageGroup,
        gender: config.gender,
        layout: config.layout,
        fillMode: config.fillMode,
        // gemini_ecom 光影模式
        lightingMode: config.lightingMode
      })
    }, [
      config.outputMode,
      config.generationMode,
      config.stylePreset,
      config.outputType,
      config.ageGroup,
      config.gender,
      config.layout,
      config.fillMode,
      config.lightingMode
    ])

    // 获取提示词步骤 - 使用 configDepsKey 确保配置变化时重新计算
    const promptSteps = useMemo(() => {
      return getPromptStepsForNode({
        nodeType,
        config,
        customPrompts
      })
    }, [nodeType, config, customPrompts, configDepsKey])

    // 计算预览附加内容
    const previewAddons = useMemo(() => {
      const addons: Record<string, string> = {}
      if (config.visualAnchors) {
        addons['Visual Anchors'] = `[Visual Anchors - STRICTLY PRESERVE]\n${config.visualAnchors}`
      }
      if (config.constraintPrompt) {
        addons['Additional Constraints'] = `[Additional Constraints]\n${config.constraintPrompt}`
      }
      return addons
    }, [config.visualAnchors, config.constraintPrompt])

    // 获取可用变量
    const availableVariables = useMemo(() => {
      return getPromptVariables(nodeType)
    }, [nodeType])

    // 打开模态框
    const handleOpenModal = useCallback(() => {
      setIsModalOpen(true)
    }, [])

    // 关闭模态框
    const handleCloseModal = useCallback(() => {
      setIsModalOpen(false)
    }, [])

    // 保存提示词
    const handleSavePrompts = useCallback(
      (steps: PromptStep[]) => {
        const newCustomPrompts = stepsToCustomPrompts(steps)
        // 如果没有自定义内容，设置为 undefined 以清除
        onUpdateCustomPrompts(Object.keys(newCustomPrompts).length > 0 ? newCustomPrompts : undefined)
      },
      [onUpdateCustomPrompts]
    )

    // 重置为默认
    const handleReset = useCallback(() => {
      onUpdateCustomPrompts(undefined)
    }, [onUpdateCustomPrompts])

    // 如果没有可用的提示词步骤，不渲染组件
    if (promptSteps.length === 0) {
      return null
    }

    // 生成按钮文本
    const finalButtonText = buttonText || `编辑${getNodeTypeLabel(nodeType)}提示词`
    const finalModalTitle = modalTitle || `编辑 ${getNodeTypeLabel(nodeType)} 提示词`

    return (
      <div className={className} style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tooltip title={hasCustom ? '已自定义提示词，点击编辑' : '使用默认提示词，点击编辑'}>
              <Button
                type={buttonType}
                size={buttonSize}
                icon={<EditOutlined />}
                onClick={handleOpenModal}
                block
                style={{
                  flex: 1,
                  textAlign: 'center',
                  height: 36
                }}>
                {finalButtonText}
              </Button>
            </Tooltip>

            {showReset && hasCustom && (
              <Tooltip title="重置为默认提示词">
                <Button type="text" size={buttonSize} icon={<ReloadOutlined />} onClick={handleReset} danger />
              </Tooltip>
            )}
          </div>

          {showStatus && hasCustom && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tag color="blue" style={{ margin: 0 }}>
                已自定义
              </Tag>
            </div>
          )}
        </div>

        <PromptEditorModal
          open={isModalOpen}
          title={finalModalTitle}
          steps={promptSteps}
          previewAddons={previewAddons}
          availableVariables={availableVariables}
          onClose={handleCloseModal}
          onSave={handleSavePrompts}
        />
      </div>
    )
  }
)

PromptEditorSection.displayName = 'PromptEditorSection'

export default PromptEditorSection
