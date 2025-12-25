/**
 * 图案生成节点配置表单 - Cherry 风格
 * 基于参考脚本 图案.py 的专业图案生成功能
 *
 * 功能：
 * - 三种生成模式（元素重组/纯无缝化/设计大师）
 * - 两种输出类型（仅图案/套装大图+无缝）
 * - 100+ 风格预设支持
 * - 多参考图融合
 * - 图案类型选择（无缝图案/T恤图案/派生图案）
 * - 支持系统提示词编辑（类似助手功能）
 */

import './FormTheme.css'

import { DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { useAppSelector } from '@renderer/store'
import type { Provider } from '@renderer/types'
import { Alert, Button, Collapse, Divider, message, Tag } from 'antd'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { IMAGE_SIZE_OPTIONS } from '../../constants/formOptions'
import { PRESETS_VERSION } from '../../constants/presets'
import { COMPLEX_PATTERN_STYLE_PRESETS, PATTERN_TYPE_PRESETS, type PatternStylePresetDefinition } from '../../presets'
import PromptEditorModal from '../PromptEditorModal'
import {
  FormCard,
  FormNumber,
  FormRadioGroup,
  FormRow,
  FormSection,
  FormSelect,
  FormSwitch,
  FormTextArea
} from './FormComponents'
import ModelSelectorButton, { imageGenerationModelFilter } from './ModelSelectorButton'
import { getPatternNodePromptSteps, getPromptVariables } from './nodePromptSteps'
import PresetGalleryButton from './PresetGalleryButton'
import { ImageInputPortSection } from './sections'

interface PatternConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
}

/**
 * 生成模式选项 - 基于参考脚本
 */
const GENERATION_MODE_OPTIONS = [
  {
    label: 'Mode A: 元素重组',
    value: 'mode_a',
    description: '参考图 + 提示词，提取元素重新排列'
  },
  {
    label: 'Mode B: 纯无缝化',
    value: 'mode_b',
    description: '仅参考图，将图片转换为无缝图案'
  },
  {
    label: 'Mode C: 设计大师',
    value: 'mode_c',
    description: '纯文本生成，无需参考图'
  }
]

/**
 * 输出类型选项
 */
const OUTPUT_TYPE_OPTIONS = [
  {
    label: '仅生成无缝图案',
    value: 'pattern_only',
    description: '生成单张可平铺的无缝图案'
  },
  {
    label: '套装: 大图 + 无缝',
    value: 'set',
    description: '生成 T恤大图 + 配套无缝图案'
  }
]

/**
 * 图案类型选项 - 使用预设注册表
 */
const PATTERN_TYPE_OPTIONS = [
  ...PATTERN_TYPE_PRESETS.getOptions().map((o) => ({
    label: o.name,
    value: o.id,
    description: o.description
  })),
  { label: '从参考图派生', value: 'derived', description: '从上游图片提取元素生成' }
]

/**
 * 密度选项
 */
const DENSITY_OPTIONS = [
  { label: '无（自由发挥）', value: 'none' },
  { label: '稀疏 (留白多)', value: 'sparse' },
  { label: '适中 (推荐)', value: 'medium' },
  { label: '密集 (填充满)', value: 'dense' }
]

/**
 * 色调选项
 */
const COLOR_TONE_OPTIONS = [
  { label: '无（自由发挥）', value: 'none' },
  { label: '自动匹配', value: 'auto' },
  { label: '明亮活泼', value: 'bright' },
  { label: '柔和淡雅', value: 'soft' },
  { label: '深色沉稳', value: 'dark' },
  { label: '高对比度', value: 'contrast' }
]

/**
 * 图案专用宽高比选项
 * 注：图案生成通常不需要 16:9 宽屏比例，因此不使用 formOptions.ts 中的通用选项
 */
const PATTERN_ASPECT_RATIO_OPTIONS = [
  { label: '1:1 (正方形)', value: '1:1' },
  { label: '3:4 (纵向)', value: '3:4' },
  { label: '4:3 (横向)', value: '4:3' },
  { label: '9:16 (竖屏)', value: '9:16' }
]

/**
 * 风格预设分类定义（用于 PresetGalleryButton）
 */
const STYLE_CATEGORY_DEFINITIONS = [
  { key: 'fashion', label: '潮流时尚' },
  { key: 'kids', label: '童趣可爱' },
  { key: 'animal', label: '动物主题' },
  { key: 'sports', label: '运动元素' },
  { key: 'holiday', label: '节日主题' },
  { key: 'minimal', label: '简约几何' },
  { key: 'food', label: '食物主题' },
  { key: 'dreamy', label: '梦幻柔和' }
]

/**
 * 分类标签映射
 */
const CATEGORY_TAG_MAP: Record<string, string[]> = {
  fashion: ['潮流', '复古', '街头', '涂鸦', '霓虹'],
  kids: ['童趣', '可爱', '软萌', '日系', '糖果色', '恐龙', '独角兽'],
  animal: ['动物', '丛林', '森林', '农场', '北极', '海洋'],
  sports: ['运动', '赛车', '校园'],
  holiday: ['圣诞', '万圣节', '节日'],
  minimal: ['极简', '几何', '现代', '简约', '圆点'],
  food: ['水果', '冰淇淋', '甜品', '烘焙'],
  dreamy: ['梦幻', '仙子', '公主', '柔和', '治愈']
}

/**
 * 根据标签获取分类
 */
function getPresetCategory(preset: PatternStylePresetDefinition): string {
  for (const [category, tags] of Object.entries(CATEGORY_TAG_MAP)) {
    if (preset.tags.some((tag) => tags.includes(tag))) {
      return category
    }
  }
  return 'other'
}

/**
 * 获取生成模式对应的最小输入端口数
 */
function getMinInputCount(mode: string): number {
  return mode === 'mode_c' ? 0 : 1
}

// ==================== 样式组件 ====================

const UploadBox = styled.div<{ $hasImage: boolean }>`
  border: 2px dashed ${({ $hasImage }) => ($hasImage ? 'var(--ant-color-success)' : 'var(--ant-color-border)')};
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--color-background);
  position: relative;

  &:hover {
    border-color: var(--ant-color-primary);
    background: var(--ant-color-primary-bg);
  }
`

const UploadedImage = styled.div`
  position: relative;
  width: 100%;
  max-width: 200px;
  margin: 0 auto;

  img {
    width: 100%;
    border-radius: 6px;
    object-fit: cover;
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
  }
`

// ==================== 工具函数 ====================

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
}

function PatternConfigForm({ config, providerId, modelId, onUpdateConfig, onUpdateModel }: PatternConfigFormProps) {
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)

  // 从 Redux store 获取真实的 providers
  const providers = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 获取提示词步骤定义（根据当前配置动态生成，合并自定义提示词）
  const promptSteps = useMemo(
    () =>
      getPatternNodePromptSteps({
        nodeType: 'gemini_pattern',
        config: {
          outputType: config.outputType,
          generationMode: config.generationMode,
          stylePreset: config.stylePreset,
          stylePresetId: config.stylePresetId,
          stylePresetPrompt: config.stylePresetPrompt,
          customPrompt: config.customPrompt,
          density: config.density,
          colorTone: config.colorTone,
          imageSize: config.imageSize,
          aspectRatio: config.aspectRatio,
          mockupType: config.mockupType
        },
        customPrompts: config.customPrompts
      }),
    [
      config.outputType,
      config.generationMode,
      config.stylePreset,
      config.stylePresetId,
      config.stylePresetPrompt,
      config.customPrompt,
      config.density,
      config.colorTone,
      config.imageSize,
      config.aspectRatio,
      config.mockupType,
      config.customPrompts
    ]
  )

  // 获取可用变量列表（用于提示词编辑器）
  const availableVariables = useMemo(() => getPromptVariables('gemini_pattern'), [])

  // 转换预设为 PresetGalleryButton 需要的格式
  // 使用统一的 COMPLEX_PATTERN_STYLE_PRESETS
  const stylePresets = useMemo(() => {
    const customList = (config.patternCustomPresets || []).map((p: any) => ({
      id: p.id,
      label: p.name,
      nameEn: p.name,
      description: p.description || '',
      prompt: p.description || '',
      tags: p.tags || []
    }))
    return [
      ...customList,
      ...COMPLEX_PATTERN_STYLE_PRESETS.getAllPresets().map((p) => ({
        id: p.id,
        label: p.label,
        nameEn: p.nameEn,
        description: p.description,
        prompt: p.prompt,
        tags: p.tags
      }))
    ]
  }, [config.patternCustomPresets])

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
    (steps: typeof promptSteps) => {
      const customPrompts: Record<string, string> = {}
      steps.forEach((step) => {
        if (step.prompt !== step.defaultPrompt) {
          customPrompts[step.id] = step.prompt
        }
      })
      onUpdateConfig('customPrompts', Object.keys(customPrompts).length > 0 ? customPrompts : undefined)
    },
    [onUpdateConfig]
  )

  // 配置值
  const generationMode = config.generationMode || 'mode_a'
  const outputType = config.outputType || 'pattern_only'
  const patternType = config.patternType || 'seamless'
  const minInputCount = getMinInputCount(generationMode)
  const imageInputCount = config.imageInputCount ?? (minInputCount > 0 ? 1 : 0)
  useEffect(() => {
    if (config.presetsVersion !== PRESETS_VERSION) {
      onUpdateConfig('presetsVersion', PRESETS_VERSION)
    }
  }, [config.presetsVersion, onUpdateConfig])

  // 生成端口配置的辅助函数
  const generateImageInputPorts = (count: number) => {
    const ports: Array<{
      id: string
      label: string
      dataType: 'image'
      required: boolean
      description: string
    }> = []
    for (let i = 1; i <= count; i++) {
      ports.push({
        id: `reference_${i}`,
        label: `参考图 ${i}`,
        dataType: 'image',
        required: i === 1,
        description: i === 1 ? '主要参考图片' : `额外参考图片 ${i}`
      })
    }
    return ports
  }

  // 切换生成模式时调整输入端口
  // 注意：必须将所有更新合并为一次调用，否则由于 React 状态更新是异步的，
  // 后面的更新会覆盖前面的更新，导致 generationMode 丢失
  const handleModeChange = (mode: string) => {
    const newMinCount = getMinInputCount(mode)

    if (mode === 'mode_c') {
      // Mode C 不需要图片输入，清空端口
      onUpdateConfig({
        generationMode: mode,
        imageInputCount: 0,
        imageInputPorts: []
      })
    } else {
      // Mode A/B 需要至少一个图片输入
      const currentCount = config.imageInputCount ?? 1
      const newCount = Math.max(currentCount, newMinCount)
      const newPorts = generateImageInputPorts(newCount)

      onUpdateConfig({
        generationMode: mode,
        imageInputCount: newCount,
        imageInputPorts: newPorts
      })
    }
  }

  // Mockup 底图上传处理
  const handleMockupImageDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      const imageFile = files.find((file) => isImageFile(file.name))

      if (!imageFile) {
        message.warning('请拖拽图片文件（支持 jpg, png, gif, webp 等格式）')
        return
      }

      // 使用 Electron 的 getPathForFile API 获取文件路径
      try {
        const filePath = window.api?.file?.getPathForFile?.(imageFile)
        if (filePath) {
          onUpdateConfig('mockupBaseImage', filePath)
          message.success('底图上传成功')
        } else {
          message.error('无法获取文件路径')
        }
      } catch (error) {
        message.error('上传失败')
      }
    },
    [onUpdateConfig]
  )

  // 删除 Mockup 底图
  const handleDeleteMockupImage = useCallback(() => {
    onUpdateConfig('mockupBaseImage', '')
  }, [onUpdateConfig])

  return (
    <div className="workflow-root">
      {/* 模型选择 - 使用 Cherry 原生 SelectModelPopup */}
      <FormSection title="🤖 AI 模型">
        <FormRow label="图像生成模型" description="选择支持图像生成的 AI 模型">
          <ModelSelectorButton
            providerId={currentProviderId}
            modelId={currentModelId}
            providers={providers}
            filter={imageGenerationModelFilter}
            showTagFilter={true}
            onModelChange={handleModelChange}
            placeholder="点击选择模型"
          />
        </FormRow>
        {/* 系统提示词编辑按钮 - 独立行显示，更醒目 */}
        <div style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setPromptEditorOpen(true)}
            title="编辑系统提示词"
            block>
            ✏️ 编辑提示词
          </Button>
        </div>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 生成模式选择 */}
      <FormSection title="🎯 生成模式">
        <FormRadioGroup value={generationMode} onChange={handleModeChange} options={GENERATION_MODE_OPTIONS} />
        <Alert
          message={
            generationMode === 'mode_a'
              ? '元素重组：从参考图提取元素，结合提示词生成新图案'
              : generationMode === 'mode_b'
                ? '纯无缝化：将参考图转换为可平铺的无缝图案'
                : '设计大师：纯文本驱动，AI 自由创作图案'
          }
          type="info"
          showIcon
          style={{ marginTop: 8, fontSize: 12 }}
        />
      </FormSection>

      {/* 输出类型选择 */}
      <FormSection title="📦 输出类型">
        <FormRadioGroup
          value={outputType}
          onChange={(value) => onUpdateConfig('outputType', value)}
          options={OUTPUT_TYPE_OPTIONS}
        />
        {outputType === 'set' && (
          <Alert
            message="套装模式：先生成 T恤胸前大图，再派生配套的无缝图案"
            type="success"
            showIcon
            style={{ marginTop: 8, fontSize: 12 }}
          />
        )}
      </FormSection>

      {/* 图片输入端口配置 - 非 Mode C 时显示，使用统一组件 */}
      {generationMode !== 'mode_c' && (
        <>
          <ImageInputPortSection
            mode="simple"
            count={imageInputCount}
            ports={config.imageInputPorts || generateImageInputPorts(imageInputCount)}
            min={minInputCount}
            max={5}
            onCountChange={(count) => {
              const newPorts = generateImageInputPorts(count)
              onUpdateConfig({
                imageInputCount: count,
                imageInputPorts: newPorts
              })
            }}
            title="📷 图片输入端口"
            showDivider={false}
            showAlert={false}
            portPrefix="reference"
          />
          {imageInputCount > 1 && (
            <Alert
              message="多图融合：AI 将从所有参考图中提取元素，创建融合设计"
              type="warning"
              showIcon
              style={{ fontSize: 12, marginBottom: 16 }}
            />
          )}
        </>
      )}

      {/* 风格预设选择 - 使用画廊式选择器 */}
      <FormSection title="🎨 风格预设 (100+ 款式)">
        <PresetGalleryButton
          presets={stylePresets}
          selectedId={config.stylePresetId}
          onSelect={(preset) => {
            onUpdateConfig({
              stylePresetId: preset.id,
              stylePresetName: preset.label,
              stylePresetPrompt: (preset as any).prompt
            })
          }}
          placeholder="选择风格预设..."
          modalTitle="选择风格预设 (100+ 款式)"
          categories={STYLE_CATEGORY_DEFINITIONS}
          getCategoryKey={(p) => getPresetCategory(p as unknown as PatternStylePresetDefinition)}
          getPresetCategory={() => 'pattern'}
          favoritesStorageKey="workflow-pattern-preset-favorites"
          searchPlaceholder="搜索风格名称或描述..."
          getSelectedInfo={(p) => ({
            label: p.label,
            description: (p as any).nameEn || p.description
          })}
        />
      </FormSection>

      {/* 图案类型 - 仅图案模式时显示 */}
      {outputType === 'pattern_only' && (
        <FormSection title="🧩 图案类型">
          <FormRadioGroup
            value={patternType}
            onChange={(value) => onUpdateConfig('patternType', value)}
            options={PATTERN_TYPE_OPTIONS}
          />
        </FormSection>
      )}

      {/* 自定义提示词 */}
      <FormSection title="✏️ 自定义描述">
        <FormRow label="额外描述" description="补充风格预设之外的细节要求">
          <FormTextArea
            value={config.customPrompt || ''}
            onChange={(value) => onUpdateConfig('customPrompt', value)}
            placeholder={
              generationMode === 'mode_c'
                ? '详细描述你想要的图案...\n例如：可爱的粉色小兔子和胡萝卜，柔和马卡龙色调，适合女童睡衣'
                : '补充说明...\n例如：增加一些星星元素，整体色调偏暖'
            }
            rows={3}
          />
        </FormRow>

        <FormRow label="负面提示词" description="不希望出现的元素">
          <FormTextArea
            value={config.negativePrompt || ''}
            onChange={(value) => onUpdateConfig('negativePrompt', value)}
            placeholder="例如：文字、水印、模糊、变形、人脸"
            rows={2}
          />
        </FormRow>
      </FormSection>

      {/* 图案设置 */}
      <FormSection title="📊 图案参数">
        {/* 密度 */}
        <FormRow label="图案密度" description="元素的分布疏密程度">
          <FormSelect
            value={config.density || 'medium'}
            onChange={(value) => onUpdateConfig('density', value)}
            options={DENSITY_OPTIONS}
          />
        </FormRow>

        {/* 色调 */}
        <FormRow label="色调风格" description="整体色彩倾向">
          <FormSelect
            value={config.colorTone || 'auto'}
            onChange={(value) => onUpdateConfig('colorTone', value)}
            options={COLOR_TONE_OPTIONS}
          />
        </FormRow>

        {/* 图片尺寸 */}
        <FormRow label="输出尺寸" description="生成图片的分辨率">
          <FormSelect
            value={config.imageSize || '2K'}
            onChange={(value) => onUpdateConfig('imageSize', value)}
            options={IMAGE_SIZE_OPTIONS}
          />
        </FormRow>

        {/* 宽高比 */}
        <FormRow label="宽高比" description="图案的比例">
          <FormSelect
            value={config.aspectRatio || '1:1'}
            onChange={(value) => onUpdateConfig('aspectRatio', value)}
            options={PATTERN_ASPECT_RATIO_OPTIONS}
          />
        </FormRow>
      </FormSection>

      {/* Mockup 贴图配置 */}
      <FormSection title="👕 Mockup 贴图">
        <FormRow label="启用 Mockup" description="将图案贴到商品底图上">
          <FormSwitch
            checked={config.enableMockup ?? false}
            onChange={(checked) => onUpdateConfig('enableMockup', checked)}
          />
        </FormRow>

        {config.enableMockup && (
          <>
            {/* 底图上传区域 */}
            <FormRow label="商品底图" description="白色底的服装商品图">
              {config.mockupBaseImage ? (
                <UploadedImage>
                  <img
                    src={`file://${config.mockupBaseImage}`}
                    alt="Mockup 底图"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="50" text-anchor="middle" fill="%23999">加载失败</text></svg>'
                    }}
                  />
                  <Button
                    className="delete-btn"
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteMockupImage}
                  />
                </UploadedImage>
              ) : (
                <UploadBox $hasImage={false} onDragOver={(e) => e.preventDefault()} onDrop={handleMockupImageDrop}>
                  <UploadOutlined style={{ fontSize: 24, color: 'var(--ant-color-text-tertiary)' }} />
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                    拖拽白色底商品图到此处
                  </div>
                </UploadBox>
              )}
            </FormRow>

            <FormRow label="智能面料比例" description="图案元素约 5-8cm 高度，不会被拉伸">
              <FormSwitch
                checked={config.enableSmartScaling ?? true}
                onChange={(checked) => onUpdateConfig('enableSmartScaling', checked)}
              />
            </FormRow>

            <FormRow label="自动配色" description="根据图案主色调为上衣染色">
              <FormSwitch
                checked={config.enableAutoColorMatch ?? true}
                onChange={(checked) => onUpdateConfig('enableAutoColorMatch', checked)}
              />
            </FormRow>

            <FormRow label="Mockup 类型" description="选择贴图模式">
              <FormSelect
                value={config.mockupType || 'set'}
                onChange={(value) => onUpdateConfig('mockupType', value)}
                options={[
                  { label: '套装（大图+无缝图案）', value: 'set' },
                  { label: '单品（仅无缝图案）', value: 'single' }
                ]}
              />
            </FormRow>
          </>
        )}
      </FormSection>

      {/* 技术说明卡片 */}
      <FormCard title="无缝图案技术要求">
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.8 }}>
          <div>
            <Tag color="blue">布局</Tag> 有机多方向排布，无明显网格或行列
          </div>
          <div>
            <Tag color="green">比例</Tag> 大中小元素混合，自然变化间距
          </div>
          <div>
            <Tag color="orange">边缘</Tag> 触边元素完美对齐，无缝平铺
          </div>
          <div>
            <Tag color="purple">面料</Tag> 元素尺寸约 5-8cm，适合真实印刷
          </div>
        </div>
      </FormCard>

      {/* 高级选项 */}
      <Collapse
        ghost
        items={[
          {
            key: 'advanced',
            label: <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>⚙️ 高级选项</span>,
            children: (
              <div style={{ paddingTop: '8px' }}>
                {/* 使用系统提示词 */}
                <FormRow label="📝 使用系统提示词" description="启用专业图案生成提示词">
                  <FormSwitch
                    checked={config.useSystemPrompt ?? true}
                    onChange={(checked) => onUpdateConfig('useSystemPrompt', checked)}
                  />
                </FormRow>

                {/* 提示词增强 */}
                <FormRow label="✨ 提示词增强" description="AI 自动优化和扩展提示词">
                  <FormSwitch
                    checked={config.promptEnhancement ?? false}
                    onChange={(checked) => onUpdateConfig('promptEnhancement', checked)}
                  />
                </FormRow>

                <Divider style={{ margin: '12px 0' }} />

                {/* 种子值 */}
                <FormRow label="🎲 种子值" description="固定种子可生成相似结果">
                  <FormNumber
                    value={config.seed}
                    onChange={(value) => onUpdateConfig('seed', value)}
                    placeholder="留空则随机"
                    min={0}
                  />
                </FormRow>

                {/* 重试次数 */}
                <FormRow label="🔄 重试次数" description="生成失败时自动重试">
                  <FormNumber
                    value={config.retryCount ?? 1}
                    onChange={(value) => onUpdateConfig('retryCount', value)}
                    min={0}
                    max={3}
                  />
                </FormRow>

                {/* 批量生成数量 */}
                <FormRow label="📦 批量数量" description="每个参考图生成的变体数">
                  <FormNumber
                    value={config.batchSize ?? 1}
                    onChange={(value) => onUpdateConfig('batchSize', value)}
                    min={1}
                    max={10}
                  />
                </FormRow>
              </div>
            )
          }
        ]}
      />

      {/* 系统提示词编辑模态框 */}
      <PromptEditorModal
        open={promptEditorOpen}
        title="图案生成 - 系统提示词配置"
        steps={promptSteps}
        availableVariables={availableVariables}
        onClose={() => setPromptEditorOpen(false)}
        onSave={handleSavePrompts}
      />
    </div>
  )
}

export default memo(PatternConfigForm)
