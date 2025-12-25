/**
 * Gemini 图片编辑节点配置表单 - Cherry 风格
 * 支持预设模式和自定义模式
 * 支持动态图片输入端口管理
 * 使用 Cherry 原生 SelectModelPopup 进行模型选择
 * 支持约束提示词和电商风格预设
 *
 * 重构版本：使用可复用的区块组件
 */

import { EditOutlined } from '@ant-design/icons'
import { getModelFieldConfigs } from '@renderer/config/imageGenerationConfig'
import type { Provider } from '@renderer/types'
import { Alert, Button, Divider } from 'antd'
import { memo, useCallback, useMemo, useState } from 'react'

import { POSE_PRESETS, SCENE_PRESETS } from '../../presets'
import PromptEditorModal from '../PromptEditorModal'
import { FormRow, FormSection, FormSelect, FormSlider, FormSwitch, FormTextArea } from './FormComponents'
import { getGeminiEditPromptSteps, getPromptVariables, type PromptStep } from './nodePromptSteps'
import PresetGalleryButton from './PresetGalleryButton'
import { ConstraintPromptSection, EcomPresetSection, ImageInputPortSection, ModelSelectorSection } from './sections'
import type { ImageInputPort } from './sections/ImageInputPortSection'

// ==================== 姿势分类定义 ====================
const POSE_CATEGORY_DEFINITIONS = [
  { key: 'basic', label: '基础姿势' },
  { key: 'standing', label: '站姿类' },
  { key: 'sitting', label: '坐姿类' },
  { key: 'home', label: '居家舒适' },
  { key: 'sports', label: '运动健身' },
  { key: 'work', label: '职场工作' },
  { key: 'emotion', label: '情绪表达' },
  { key: 'dynamic', label: '动态类' },
  { key: 'interactive', label: '互动类' },
  { key: 'fashion', label: '时尚类' },
  { key: 'kids', label: '儿童专用' },
  { key: 'kids_home', label: '儿童家居' },
  { key: 'pro_home', label: '家居展示' }
]

const POSE_CATEGORY_MAP: Record<string, string> = {
  random: 'basic',
  natural: 'basic',
  sitting: 'basic',
  playing: 'basic',
  walking: 'basic',
  confident: 'basic',
  editorial: 'basic',
  hands_on_hips: 'basic',
  running: 'basic',
  jumping: 'basic',
  leaning_wall: 'standing',
  hands_in_pockets: 'standing',
  crossed_arms: 'standing',
  looking_back: 'standing',
  side_profile: 'standing',
  one_leg_up: 'standing',
  tiptoe: 'standing',
  sitting_floor: 'sitting',
  kneeling: 'sitting',
  sitting_stool: 'sitting',
  reclining: 'sitting',
  sitting_steps: 'sitting',
  hugging_knees: 'sitting',
  waking_up: 'home',
  couch_potato: 'home',
  holding_pillow: 'home',
  skin_care: 'home',
  brushing_teeth: 'home',
  cooking: 'home',
  stretching_bed: 'home',
  sitting_window: 'home',
  yoga_tree: 'sports',
  yoga_lotus: 'sports',
  plank: 'sports',
  jogging: 'sports',
  typing: 'work',
  presentation: 'work',
  writing: 'work',
  on_call: 'work',
  laughing: 'emotion',
  surprised: 'emotion',
  thinking: 'emotion',
  sad: 'emotion',
  twirling: 'dynamic',
  kicking: 'dynamic',
  stretching: 'dynamic',
  waving: 'dynamic',
  clapping: 'dynamic',
  dancing: 'dynamic',
  reading: 'interactive',
  holding_flower: 'interactive',
  drinking: 'interactive',
  eating: 'interactive',
  using_phone: 'interactive',
  holding_bag: 'interactive',
  catwalk: 'fashion',
  hair_touch: 'fashion',
  face_framing: 'fashion',
  looking_up: 'fashion',
  jacket_drape: 'fashion',
  hiding_face: 'kids',
  finger_heart: 'kids',
  peace_sign: 'kids',
  crawling: 'kids',
  lying_stomach: 'kids',
  playing_toys: 'kids_home',
  reading_floor: 'kids_home',
  hugging_plushie: 'kids_home',
  jumping_bed: 'kids_home',
  napping: 'kids_home',
  parent_child: 'kids_home',
  lounging_sofa: 'pro_home',
  sitting_armchair: 'pro_home',
  leaning_counter: 'pro_home',
  standing_window: 'pro_home',
  touching_fabric: 'pro_home'
}

// ==================== 场景分类定义 ====================
const SCENE_CATEGORY_DEFINITIONS = [
  { key: 'basic', label: '基础场景' },
  { key: 'home', label: '居家生活' },
  { key: 'transport', label: '交通出行' },
  { key: 'professional', label: '专业场所' },
  { key: 'entertainment', label: '休闲娱乐' },
  { key: 'indoor', label: '室内场景' },
  { key: 'outdoor', label: '户外场景' },
  { key: 'nature', label: '自然场景' },
  { key: 'commercial', label: '商业场景' },
  { key: 'special', label: '特色场景' },
  { key: 'mood', label: '氛围场景' },
  { key: 'festival', label: '节日场景' },
  { key: 'kids_home', label: '儿童家居' },
  { key: 'pro_home', label: '专业家居' }
]

const SCENE_CATEGORY_MAP: Record<string, string> = {
  random: 'basic',
  studio: 'basic',
  home: 'basic',
  outdoor: 'basic',
  playground: 'basic',
  nature: 'basic',
  beach: 'basic',
  urban: 'basic',
  campus: 'basic',
  sakura: 'basic',
  gallery: 'basic',
  living_room_sunny: 'home',
  bathroom_luxury: 'home',
  bathroom_mirror: 'home',
  walk_in_closet: 'home',
  balcony_garden: 'home',
  entrance_hall: 'home',
  laundry_room: 'home',
  home_office: 'home',
  car_interior: 'transport',
  subway_station: 'transport',
  airport_terminal: 'transport',
  airplane_cabin: 'transport',
  classroom: 'professional',
  art_studio: 'professional',
  science_lab: 'professional',
  swimming_pool: 'entertainment',
  cinema: 'entertainment',
  concert_stage: 'entertainment',
  cafe: 'indoor',
  library: 'indoor',
  supermarket: 'indoor',
  hotel_lobby: 'indoor',
  gym: 'indoor',
  bedroom: 'indoor',
  kitchen: 'indoor',
  rooftop: 'outdoor',
  bridge: 'outdoor',
  bus_stop: 'outdoor',
  tunnel: 'outdoor',
  parking_lot: 'outdoor',
  forest_path: 'nature',
  flower_field: 'nature',
  snow_field: 'nature',
  desert: 'nature',
  waterfall: 'nature',
  lake_pier: 'nature',
  mall: 'commercial',
  office_modern: 'commercial',
  boutique: 'commercial',
  meeting_room: 'commercial',
  amusement_park: 'special',
  aquarium: 'special',
  museum: 'special',
  zoo: 'special',
  neon_night: 'mood',
  rainy_window: 'mood',
  sunset_silhouette: 'mood',
  foggy_morning: 'mood',
  starry_night: 'mood',
  christmas: 'festival',
  halloween: 'festival',
  birthday: 'festival',
  new_year: 'festival',
  kids_bedroom: 'kids_home',
  play_tent: 'kids_home',
  toy_room: 'kids_home',
  messy_corner: 'kids_home',
  story_time: 'kids_home',
  luxury_penthouse: 'pro_home',
  scandinavian_living: 'pro_home',
  italian_kitchen: 'pro_home',
  mid_century_corner: 'pro_home',
  zen_bathroom: 'pro_home'
}

// 默认输入端口（参考老代码 gemini_edit）
const DEFAULT_IMAGE_INPUTS: ImageInputPort[] = [
  { id: 'base_image', label: '基础图片', dataType: 'image', required: true, description: '需要编辑的原始图片' },
  { id: 'top_image', label: '上衣图片', dataType: 'image', required: false, description: '上衣服装图片（可选）' },
  { id: 'bottom_image', label: '下装图片', dataType: 'image', required: false, description: '下装服装图片（可选）' }
]

interface GeminiEditConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  llmProviders?: Provider[]
  onUpdateConfig: (key: string, value: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
  onInputsChange?: (inputs: { id: string; label: string; dataType: string; required?: boolean }[]) => void
}

function GeminiEditConfigForm({
  config,
  providerId,
  modelId,
  llmProviders = [],
  onUpdateConfig,
  onUpdateModel,
  onInputsChange
}: GeminiEditConfigFormProps) {
  const mode = config.mode || 'preset'
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 获取模型对应的字段配置（动态选项）
  const fieldConfigs = useMemo(
    () => getModelFieldConfigs(currentModelId || '', currentProviderId),
    [currentModelId, currentProviderId]
  )

  // 获取动态的图片尺寸选项
  const imageSizeOptions = useMemo(() => {
    const imageSizeField = fieldConfigs.find((f) => f.key === 'image_size')
    if (imageSizeField?.options) {
      return imageSizeField.options.map((opt) => ({
        label: String(opt.label),
        value: String(opt.value)
      }))
    }
    return [
      { label: '1K (1024px)', value: '1K' },
      { label: '2K (2048px)', value: '2K' },
      { label: '4K (4096px)', value: '4K' }
    ]
  }, [fieldConfigs])

  // 获取动态的宽高比选项
  const aspectRatioOptions = useMemo(() => {
    const aspectRatioField = fieldConfigs.find((f) => f.key === 'aspect_ratio')
    if (aspectRatioField?.options) {
      return aspectRatioField.options.map((opt) => ({
        label: String(opt.label),
        value: String(opt.value)
      }))
    }
    return [
      { label: '1:1', value: '1:1' },
      { label: '3:4', value: '3:4' },
      { label: '4:3', value: '4:3' },
      { label: '9:16', value: '9:16' },
      { label: '16:9', value: '16:9' }
    ]
  }, [fieldConfigs])

  // 姿势预设列表
  const posePresets = useMemo(
    () =>
      POSE_PRESETS.getOptions().map((p) => ({
        id: p.id,
        label: p.name,
        description: p.description
      })),
    []
  )

  // 场景预设列表
  const scenePresets = useMemo(
    () =>
      SCENE_PRESETS.getOptions().map((p) => ({
        id: p.id,
        label: p.name,
        description: p.description
      })),
    []
  )

  // 获取提示词步骤定义
  const promptSteps = useMemo(
    () => getGeminiEditPromptSteps({ nodeType: 'gemini_edit', config, customPrompts: config.customPrompts }),
    [config]
  )

  // 获取可用变量列表（用于提示词编辑器）
  const availableVariables = useMemo(() => getPromptVariables('gemini_edit'), [])

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (onUpdateModel) {
        onUpdateModel(newProviderId, newModelId)
      }
    },
    [onUpdateModel]
  )

  // 处理提示词保存
  const handleSavePrompts = useCallback(
    (steps: PromptStep[]) => {
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

  // 处理图片输入端口变化
  const handleImageInputsChange = useCallback(
    (ports: ImageInputPort[]) => {
      onUpdateConfig('imageInputPorts', ports)
      onUpdateConfig('imageInputCount', ports.length)
      if (onInputsChange) {
        const inputs: { id: string; label: string; dataType: string; required?: boolean }[] = ports.map((port) => ({
          id: port.id,
          label: port.label,
          dataType: port.dataType,
          required: port.required
        }))
        inputs.push({
          id: 'promptJson',
          label: '提示词JSON',
          dataType: 'json',
          required: false
        })
        onInputsChange(inputs)
      }
    },
    [onUpdateConfig, onInputsChange]
  )

  // 处理电商预设变化
  const handleEcomPresetChange = useCallback(
    (presetId: string, presetName: string) => {
      onUpdateConfig('ecomPresetId', presetId)
      onUpdateConfig('ecomPresetName', presetName)
    },
    [onUpdateConfig]
  )

  // 获取当前图片输入端口配置
  const imageInputPorts = config.imageInputPorts || DEFAULT_IMAGE_INPUTS

  return (
    <div>
      {/* 模型选择 - 使用可复用组件 */}
      <ModelSelectorSection
        label="图片编辑模型"
        description="选择支持图片编辑的 AI 模型"
        providerId={currentProviderId}
        modelId={currentModelId}
        config={config}
        providers={llmProviders.length > 0 ? llmProviders : undefined}
        onModelChange={handleModelChange}
        onUpdateConfig={onUpdateConfig}
        preserveKeys={['customPrompt', 'constraintPrompt', 'customPrompts']}
      />

      {/* 系统提示词编辑按钮 - 使用 primary 类型更醒目 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setPromptEditorOpen(true)}
          title="编辑系统提示词"
          block>
          ✏️ 编辑提示词
        </Button>
      </div>

      {/* 图片输入端口管理 - 使用统一组件 */}
      <ImageInputPortSection
        mode="advanced"
        ports={imageInputPorts}
        min={1}
        max={10}
        onPortsChange={handleImageInputsChange}
        portPrefix="image"
        title="📷 图片输入端口"
      />

      {/* 输出图片设置 */}
      <FormSection title="📐 输出图片设置">
        <FormRow label="输出尺寸" description="更高分辨率需要更长生成时间">
          <FormSelect
            value={config.imageSize}
            onChange={(value) => onUpdateConfig('imageSize', value)}
            options={imageSizeOptions}
          />
        </FormRow>
        <FormRow label="宽高比" description="生成图片的宽高比例">
          <FormSelect
            value={config.aspectRatio}
            onChange={(value) => onUpdateConfig('aspectRatio', value)}
            options={aspectRatioOptions}
          />
        </FormRow>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      <FormSection title="编辑设置">
        <FormRow label="🎯 编辑模式">
          <FormSelect
            value={mode}
            onChange={(value) => onUpdateConfig('mode', value)}
            options={[
              { label: '🎭 预设模式 (快速配置)', value: 'preset' },
              { label: '✏️ 自定义模式 (自由编辑)', value: 'custom' }
            ]}
          />
        </FormRow>
      </FormSection>

      {/* 预设模式配置 */}
      {mode === 'preset' && (
        <FormSection title="预设参数">
          <FormRow label="👶 年龄组">
            <FormSelect
              value={config.ageGroup || 'big_kid'}
              onChange={(value) => onUpdateConfig('ageGroup', value)}
              options={[
                { label: '小童 (4-7岁)', value: 'small_kid' },
                { label: '大童 (8-12岁)', value: 'big_kid' },
                { label: '成人 (20-28岁)', value: 'adult' }
              ]}
            />
          </FormRow>
          <FormRow label="⚧ 性别">
            <FormSelect
              value={config.gender || 'female'}
              onChange={(value) => onUpdateConfig('gender', value)}
              options={[
                { label: '👧 女', value: 'female' },
                { label: '👦 男', value: 'male' }
              ]}
            />
          </FormRow>
          <FormRow label="🌍 人种预设">
            <FormSelect
              value={config.ethnicityPreset || 'asian'}
              onChange={(value) => onUpdateConfig('ethnicityPreset', value)}
              options={[
                { label: '无（自由发挥）', value: 'none' },
                { label: '亚洲人', value: 'asian' },
                { label: '欧美白人', value: 'caucasian' },
                { label: '非裔', value: 'african_american' },
                { label: '拉丁裔', value: 'hispanic' },
                { label: '混血', value: 'mixed' }
              ]}
            />
          </FormRow>
          <FormRow label="📸 拍摄风格" description="日常感=iPhone抓拍风格，商拍感=专业棚拍风格">
            <FormSelect
              value={config.styleMode || 'daily'}
              onChange={(value) => onUpdateConfig('styleMode', value)}
              options={[
                { label: '无（自由发挥）', value: 'none' },
                { label: '📱 日常感 (iPhone抓拍)', value: 'daily' },
                { label: '📸 商拍感 (专业棚拍)', value: 'commercial' }
              ]}
            />
          </FormRow>
          <FormRow label="🏠 场景预设">
            <PresetGalleryButton
              presets={scenePresets}
              selectedId={config.scenePreset}
              onSelect={(preset) => onUpdateConfig('scenePreset', preset.id)}
              placeholder="选择场景..."
              modalTitle="选择场景预设"
              categories={SCENE_CATEGORY_DEFINITIONS}
              getCategoryKey={(p) => SCENE_CATEGORY_MAP[p.id] || 'basic'}
              getPresetCategory={() => 'scene'}
              favoritesStorageKey="workflow-scene-favorites"
              searchPlaceholder="搜索场景..."
            />
          </FormRow>
          <FormRow label="🧍 姿态预设">
            <PresetGalleryButton
              presets={posePresets}
              selectedId={config.posePreset}
              onSelect={(preset) => onUpdateConfig('posePreset', preset.id)}
              placeholder="选择姿势..."
              modalTitle="选择姿势预设"
              categories={POSE_CATEGORY_DEFINITIONS}
              getCategoryKey={(p) => POSE_CATEGORY_MAP[p.id] || 'basic'}
              getPresetCategory={() => 'model'}
              favoritesStorageKey="workflow-pose-favorites"
              searchPlaceholder="搜索姿势..."
            />
          </FormRow>
          <Alert
            message={config.styleMode === 'commercial' ? '📸 商拍感模式' : '📱 日常感模式'}
            description={
              config.styleMode === 'commercial'
                ? '专业摄影棚级别：三点布光、均匀肤色、杂志级构图、商业目录品质。适合高端电商、品牌宣传。'
                : '真实照片风格：iPhone抓拍感、自然皮肤纹理、真实光影、生活瞬间感。适合社交媒体、生活化展示。'
            }
            type={config.styleMode === 'commercial' ? 'warning' : 'info'}
            showIcon
            style={{ marginTop: '16px' }}
          />
        </FormSection>
      )}

      {/* 自定义模式配置 */}
      {mode === 'custom' && (
        <FormSection title="自定义配置">
          <FormRow label="✏️ 自定义提示词" description="描述你想要的编辑效果">
            <FormTextArea
              value={config.customPrompt || ''}
              onChange={(value) => onUpdateConfig('customPrompt', value)}
              placeholder="例如：将背景替换为海滩场景，保持服装不变"
              rows={4}
            />
          </FormRow>
          <FormRow label="💪 编辑强度" description="0=轻微编辑，1=完全替换">
            <FormSlider
              value={config.editStrength ?? 0.7}
              onChange={(value) => onUpdateConfig('editStrength', value)}
              min={0}
              max={1}
              step={0.1}
            />
          </FormRow>
          <FormRow label="👕 保留服装不变" description="仅编辑背景和模特姿态，保持服装原样">
            <FormSwitch
              checked={config.preserveClothing ?? true}
              onChange={(checked) => onUpdateConfig('preserveClothing', checked)}
            />
          </FormRow>
        </FormSection>
      )}

      {/* 约束提示词 - 使用可复用组件 */}
      <ConstraintPromptSection
        value={config.constraintPrompt}
        onChange={(value) => onUpdateConfig('constraintPrompt', value)}
        placeholder="例如：保持服装颜色不变、背景使用暖色调、模特表情自然等"
      />

      {/* 电商风格预设 - 使用可复用组件 */}
      <EcomPresetSection selectedPresetId={config.ecomPresetId} onPresetChange={handleEcomPresetChange} />

      {/* 输出说明 */}
      <Alert
        message="📤 输出端口"
        description={
          <>
            <div>
              • <strong>result</strong>: JSON 格式的编辑结果
            </div>
            <div>
              • <strong>image</strong>: 编辑后的图片
            </div>
          </>
        }
        type="success"
        showIcon
        style={{ marginTop: '16px' }}
      />

      {/* 系统提示词编辑模态框 */}
      <PromptEditorModal
        open={promptEditorOpen}
        title="模特换装 - 系统提示词配置"
        steps={promptSteps}
        availableVariables={availableVariables}
        onClose={() => setPromptEditorOpen(false)}
        onSave={handleSavePrompts}
      />
    </div>
  )
}

export default memo(GeminiEditConfigForm)
