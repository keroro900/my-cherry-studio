/**
 * 图片助手选择弹窗
 *
 * 显示可用的图片助手预设，让用户选择并创建新的图片助手
 * 支持从预设创建或自定义创建
 */

import { TopView } from '@renderer/components/TopView'
import { useImageAssistantPresets } from '@renderer/hooks/useImageAssistantPresets'
import type { ImageAssistant, ImageAssistantPreset, ImageAssistantType } from '@renderer/types'
import { Input, Modal, Tabs, Tooltip } from 'antd'
import {
  Armchair,
  Box,
  ChevronDown,
  ChevronUp,
  Cpu,
  Footprints,
  Gem,
  Palette,
  Pencil,
  Plus,
  Scissors,
  ShoppingBag,
  Sparkles,
  User,
  Utensils
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ShowParams {
  onSelect: (assistant: ImageAssistant) => void
}

interface Props extends ShowParams {
  resolve: (data: { assistant?: ImageAssistant }) => void
}

const typeConfigs: Array<{
  type: ImageAssistantType
  icon: typeof ShoppingBag
  color: string
  emoji: string
}> = [
  // 核心功能
  { type: 'ecom', icon: ShoppingBag, color: '#10B981', emoji: '🛍️' },
  { type: 'model', icon: User, color: '#8B5CF6', emoji: '👗' },
  { type: 'pattern', icon: Palette, color: '#F59E0B', emoji: '🎨' },
  { type: 'edit', icon: Scissors, color: '#EC4899', emoji: '✂️' },
  { type: 'generate', icon: Sparkles, color: '#6366F1', emoji: '✨' },
  // 产品摄影
  { type: 'cosmetics', icon: Pencil, color: '#F472B6', emoji: '💄' },
  { type: 'food', icon: Utensils, color: '#EF4444', emoji: '🍽️' },
  { type: 'electronics', icon: Cpu, color: '#0EA5E9', emoji: '📱' },
  { type: 'jewelry', icon: Gem, color: '#A855F7', emoji: '💎' },
  { type: 'furniture', icon: Armchair, color: '#84CC16', emoji: '🛋️' },
  { type: 'footwear', icon: Footprints, color: '#14B8A6', emoji: '👟' },
  { type: 'product', icon: Box, color: '#6B7280', emoji: '📦' },
  { type: 'general', icon: Sparkles, color: '#3B82F6', emoji: '🖼️' }
]

const PopupContainer: React.FC<Props> = ({ onSelect, resolve }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset')
  const [customName, setCustomName] = useState('')
  const [selectedType, setSelectedType] = useState<ImageAssistantType>('ecom')
  const { presets, createAssistantFromPreset, createCustomAssistant } = useImageAssistantPresets()

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve({})
  }

  const handleSelectPreset = (preset: ImageAssistantPreset) => {
    const assistant = createAssistantFromPreset(preset)
    setOpen(false)
    onSelect(assistant)
    resolve({ assistant })
  }

  const handleCreateCustom = () => {
    const assistant = createCustomAssistant(selectedType, customName || undefined)
    setOpen(false)
    onSelect(assistant)
    resolve({ assistant })
  }

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedId(expandedId === id ? null : id)
  }

  ImageAssistantSelectPopup.hide = onCancel

  const getTypeColor = (type: string) => {
    const config = typeConfigs.find((c) => c.type === type)
    return config?.color || 'var(--color-primary)'
  }

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'ecom':
        return t('image_studio.types.ecom_desc', '生成电商产品展示图')
      case 'model':
        return t('image_studio.types.model_desc', '生成模特穿搭展示图')
      case 'pattern':
        return t('image_studio.types.pattern_desc', '生成无缝图案纹理')
      case 'edit':
        return t('image_studio.types.edit_desc', '编辑和修改图片内容')
      case 'generate':
        return t('image_studio.types.generate_desc', '根据描述生成图片')
      case 'cosmetics':
        return t('image_studio.types.cosmetics_desc', '美妆产品摄影')
      case 'food':
        return t('image_studio.types.food_desc', '专业食品摄影')
      case 'electronics':
        return t('image_studio.types.electronics_desc', '电子产品摄影')
      case 'jewelry':
        return t('image_studio.types.jewelry_desc', '珠宝首饰摄影')
      case 'furniture':
        return t('image_studio.types.furniture_desc', '家具场景摄影')
      case 'footwear':
        return t('image_studio.types.footwear_desc', '鞋履展示摄影')
      case 'product':
        return t('image_studio.types.product_desc', '通用产品摄影')
      default:
        return t('image_studio.types.general_desc', '通用图片生成')
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'ecom':
        return t('image_studio.types.ecom', '电商')
      case 'model':
        return t('image_studio.types.model', '模特')
      case 'pattern':
        return t('image_studio.types.pattern', '图案')
      case 'edit':
        return t('image_studio.types.edit', '编辑')
      case 'generate':
        return t('image_studio.types.generate', '生成')
      case 'cosmetics':
        return t('image_studio.types.cosmetics', '美妆')
      case 'food':
        return t('image_studio.types.food', '食品')
      case 'electronics':
        return t('image_studio.types.electronics', '电子')
      case 'jewelry':
        return t('image_studio.types.jewelry', '珠宝')
      case 'furniture':
        return t('image_studio.types.furniture', '家具')
      case 'footwear':
        return t('image_studio.types.footwear', '鞋履')
      case 'product':
        return t('image_studio.types.product', '产品')
      default:
        return t('image_studio.types.general', '通用')
    }
  }

  return (
    <Modal
      title={t('chat.add.image_assistant.select_title', '创建图片助手')}
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered
      footer={null}
      width={640}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'preset' | 'custom')}
        items={[
          {
            key: 'preset',
            label: t('chat.add.image_assistant.from_preset', '从预设创建'),
            children: (
              <div className="py-2">
                <div className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-1">
                  {presets.map((preset) => (
                    <div key={preset.id} className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        onMouseEnter={() => setHoveredId(preset.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="flex w-full items-center gap-3 bg-[var(--color-background-soft)] p-3 transition-all hover:bg-[var(--color-hover)]"
                        style={{
                          borderColor: hoveredId === preset.id ? getTypeColor(preset.imageType) : undefined
                        }}>
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                          style={{ backgroundColor: `${getTypeColor(preset.imageType)}15` }}>
                          {preset.emoji}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-medium text-[var(--color-text-1)] text-sm">{preset.name}</h3>
                          <p className="text-[var(--color-text-3)] text-xs">{getTypeDescription(preset.imageType)}</p>
                        </div>
                        <div
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: `${getTypeColor(preset.imageType)}15`,
                            color: getTypeColor(preset.imageType)
                          }}>
                          {getTypeName(preset.imageType)}
                        </div>
                        <Tooltip title={expandedId === preset.id ? '收起提示词' : '查看提示词'}>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => toggleExpand(e, preset.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                toggleExpand(e as unknown as React.MouseEvent, preset.id)
                              }
                            }}
                            className="ml-1 inline-flex cursor-pointer items-center rounded p-1 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-background)] hover:text-[var(--color-text-1)]">
                            {expandedId === preset.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </Tooltip>
                      </button>
                      {expandedId === preset.id && (
                        <div className="border-[var(--color-border)] border-t bg-[var(--color-background)] p-3">
                          <div className="mb-1 font-medium text-[var(--color-text-2)] text-xs">
                            {t('chat.add.image_assistant.system_prompt', '系统提示词')}
                          </div>
                          <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap text-[var(--color-text-3)] text-xs leading-relaxed">
                            {preset.prompt || t('common.empty', '(空)')}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          },
          {
            key: 'custom',
            label: t('chat.add.image_assistant.create_custom', '自定义创建'),
            children: (
              <div className="py-4">
                <div className="mb-4">
                  <label className="mb-2 block text-[var(--color-text-2)] text-sm">
                    {t('chat.add.image_assistant.select_type', '选择类型')}
                  </label>
                  <div className="grid max-h-[280px] grid-cols-5 gap-2 overflow-y-auto">
                    {typeConfigs.map((config) => {
                      const Icon = config.icon
                      const isSelected = selectedType === config.type
                      return (
                        <button
                          key={config.type}
                          type="button"
                          onClick={() => setSelectedType(config.type)}
                          className="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
                          style={{
                            borderColor: isSelected ? config.color : 'var(--color-border)',
                            backgroundColor: isSelected ? `${config.color}10` : 'var(--color-background-soft)'
                          }}>
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${config.color}20` }}>
                            <Icon size={16} style={{ color: config.color }} />
                          </div>
                          <span
                            className="font-medium text-xs"
                            style={{ color: isSelected ? config.color : 'var(--color-text-2)' }}>
                            {getTypeName(config.type)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[var(--color-text-2)] text-sm">
                    {t('chat.add.image_assistant.name', '助手名称')}
                    <span className="ml-1 text-[var(--color-text-4)]">({t('common.optional', '可选')})</span>
                  </label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={t('chat.add.image_assistant.name_placeholder', '留空将使用默认名称')}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateCustom}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] py-3 text-white transition-opacity hover:opacity-90">
                  <Plus size={18} />
                  <span>{t('chat.add.image_assistant.create', '创建图片助手')}</span>
                </button>
              </div>
            )
          }
        ]}
      />
    </Modal>
  )
}

const TopViewKey = 'ImageAssistantSelectPopup'

export default class ImageAssistantSelectPopup {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show(props: ShowParams) {
    return new Promise<{ assistant?: ImageAssistant }>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
