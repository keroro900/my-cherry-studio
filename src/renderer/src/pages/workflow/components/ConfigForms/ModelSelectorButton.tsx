/**
 * 模型选择按钮组件
 * 点击后弹出 Cherry 原生的 SelectModelPopup 弹窗
 * 用于工作流节点的模型选择
 */

import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import { SelectModelPopup } from '@renderer/components/Popups/SelectModelPopup'
import { useProviders } from '@renderer/hooks/useProvider'
import type { Model, Provider } from '@renderer/types'
import { Button } from 'antd'
import { ChevronDown } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

interface ModelSelectorButtonProps {
  /** 当前选中的 provider ID */
  providerId?: string
  /** 当前选中的 model ID */
  modelId?: string
  /** 所有可用的 providers（可选，如果不传则使用 useProviders hook） */
  providers?: Provider[]
  /** 模型过滤函数 */
  filter?: (model: Model) => boolean
  /** 是否显示标签筛选 */
  showTagFilter?: boolean
  /** 选择模型后的回调 */
  onModelChange: (providerId: string, modelId: string) => void
  /** 占位文本 */
  placeholder?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

const ButtonContainer = styled.div`
  width: 100%;
`

const ModelButton = styled(Button)`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  height: auto;
  min-height: 36px;
  text-align: left;

  .model-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow: hidden;
  }

  .model-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-provider {
    font-size: 11px;
    color: var(--ant-color-text-tertiary);
    margin-left: 4px;
  }

  .placeholder {
    color: var(--ant-color-text-placeholder);
  }

  .chevron {
    flex-shrink: 0;
    opacity: 0.5;
  }
`

function ModelSelectorButton({
  providerId,
  modelId,
  providers: propProviders,
  filter,
  showTagFilter = true,
  onModelChange,
  placeholder = '选择模型',
  style
}: ModelSelectorButtonProps) {
  // 使用 useProviders hook 获取所有 providers（当 propProviders 为空时使用）
  // 注意：useProviders() 返回 { providers: Provider[], ... } 对象
  const { providers: hookProviders } = useProviders()

  // 合并 providers：优先使用传入的，否则使用 hook 获取的
  const providers = useMemo(() => {
    if (propProviders && propProviders.length > 0) {
      return propProviders
    }
    return hookProviders || []
  }, [propProviders, hookProviders])

  // 获取当前选中的模型
  const currentModel = useMemo(() => {
    if (!providerId || !modelId) return undefined

    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return undefined

    return provider.models?.find((m) => m.id === modelId)
  }, [providerId, modelId, providers])

  // 获取当前 provider 名称
  const currentProviderName = useMemo(() => {
    if (!providerId) return undefined
    const provider = providers.find((p) => p.id === providerId)
    return provider?.name
  }, [providerId, providers])

  // 点击按钮打开弹窗
  // 注意：SelectModelPopup 内部使用 useProviders() 获取所有 providers
  // 不需要传入 providers 参数，这样可以显示所有可用模型
  const handleClick = useCallback(async () => {
    const selectedModel = await SelectModelPopup.show({
      model: currentModel,
      filter,
      showTagFilter
    })

    if (selectedModel) {
      // 从模型对象中获取 provider ID
      const newProviderId = selectedModel.provider
      if (newProviderId) {
        onModelChange(newProviderId, selectedModel.id)
      }
    }
  }, [currentModel, filter, showTagFilter, onModelChange])

  return (
    <ButtonContainer style={style}>
      <ModelButton onClick={handleClick}>
        <div className="model-info">
          {currentModel ? (
            <>
              <ModelAvatar model={currentModel} size={20} />
              <span className="model-name">
                {currentModel.name}
                {currentProviderName && <span className="model-provider">| {currentProviderName}</span>}
              </span>
            </>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className="chevron" />
      </ModelButton>
    </ButtonContainer>
  )
}

export default memo(ModelSelectorButton)

/**
 * 图片生成模型过滤器
 * 只显示支持图片生成的模型
 */
export function imageGenerationModelFilter(model: Model): boolean {
  // 检查 endpoint_type
  if (
    model.endpoint_type === 'image-generation' ||
    model.endpoint_type === 'gemini-image' ||
    model.endpoint_type === 'gemini-image-edit'
  ) {
    return true
  }

  // 检查模型分组名称
  if (model.group) {
    const groupLower = model.group.toLowerCase()
    if (
      groupLower.includes('图像生成') ||
      groupLower.includes('图片生成') ||
      groupLower.includes('图片编辑') ||
      groupLower.includes('image generation') ||
      groupLower.includes('image-generation') ||
      groupLower.includes('image edit') ||
      groupLower === 'image'
    ) {
      return true
    }
  }

  // 检查模型 ID
  const modelIdLower = model.id.toLowerCase()
  if (
    modelIdLower.includes('dall-e') ||
    modelIdLower.includes('dalle') ||
    modelIdLower.includes('stable-diffusion') ||
    modelIdLower.includes('midjourney') ||
    modelIdLower.includes('imagen') ||
    (modelIdLower.includes('gemini') && modelIdLower.includes('image'))
  ) {
    return true
  }

  return false
}

/**
 * 视频生成模型过滤器
 * 只显示支持视频生成的模型
 */
export function videoGenerationModelFilter(model: Model): boolean {
  // 检查 endpoint_type
  if (model.endpoint_type === 'video-generation') {
    return true
  }

  // 检查模型分组名称
  if (model.group) {
    const groupLower = model.group.toLowerCase()
    if (
      groupLower.includes('视频生成') ||
      groupLower.includes('video generation') ||
      groupLower.includes('video-generation') ||
      groupLower === 'video'
    ) {
      return true
    }
  }

  // 检查模型 ID
  const modelIdLower = model.id.toLowerCase()
  if (
    modelIdLower.includes('sora') ||
    modelIdLower.includes('veo') ||
    modelIdLower.includes('kling') ||
    modelIdLower.includes('runway') ||
    modelIdLower.includes('pika') ||
    modelIdLower.includes('luma') ||
    modelIdLower.includes('cogvideo') ||
    modelIdLower.includes('hailuo') ||
    modelIdLower.includes('minimax-video') ||
    modelIdLower.includes('video-01') ||
    modelIdLower.includes('t2v-') ||
    modelIdLower.includes('i2v-') ||
    modelIdLower.includes('gen-2') ||
    modelIdLower.includes('gen-3') ||
    modelIdLower.includes('stable-video') ||
    modelIdLower.includes('hunyuan-video') ||
    modelIdLower.includes('mochi') ||
    modelIdLower.includes('ltx-video')
  ) {
    return true
  }

  return false
}

/**
 * 视觉模型过滤器
 * 只显示支持视觉输入的模型
 */
export function visionModelFilter(model: Model): boolean {
  // 检查模型标签
  if (model.capabilities?.some((c) => c.type === 'vision')) {
    return true
  }

  // 检查模型类型
  if (model.type?.includes('vision')) {
    return true
  }

  // 检查模型 ID 中的关键词
  const modelIdLower = model.id.toLowerCase()
  const modelNameLower = (model.name || '').toLowerCase()

  // 视觉模型关键词列表
  const visionKeywords = [
    'vision',
    'vl', // qwen-vl, qwen3-vl
    'gpt-4o',
    'gpt-4-turbo',
    'claude-3',
    'gemini-2', // gemini-2.x 系列支持视觉
    'gemini-1.5', // gemini-1.5 系列支持视觉
    'gemini-pro',
    'gemini-flash',
    'glm-4v',
    'yi-vision',
    'internvl',
    'cogvlm',
    'llava'
  ]

  // 排除图片生成模型（它们不是视觉分析模型）
  const imageGenKeywords = ['imagen', 'image-generation', 'dall-e', 'stable-diffusion', 'midjourney']

  // 如果是图片生成模型，排除
  for (const keyword of imageGenKeywords) {
    if (modelIdLower.includes(keyword) || modelNameLower.includes(keyword)) {
      return false
    }
  }

  // 检查是否匹配视觉模型关键词
  for (const keyword of visionKeywords) {
    if (modelIdLower.includes(keyword) || modelNameLower.includes(keyword)) {
      return true
    }
  }

  return false
}
