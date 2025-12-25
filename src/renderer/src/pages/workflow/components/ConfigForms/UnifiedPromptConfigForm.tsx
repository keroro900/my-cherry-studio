/**
 * 智能提示词节点配置表单
 *
 * 功能：
 * - 动态图片输入端口管理
 * - 输出模式选择（模特/图案/电商图）
 * - 根据输出模式动态调整输出端口
 * - 根据输出模式动态显示配置项
 * - 模型选择（用户手动选择）
 * - 支持系统提示词编辑（类似助手功能）
 */

import './FormTheme.css'

import { useAppSelector } from '@renderer/store'
import type { Provider } from '@renderer/types'
import { Alert, Collapse, Divider, Input } from 'antd'
import { memo, useCallback, useEffect, useMemo } from 'react'

import { PLATFORM_STYLE_OPTIONS as PLATFORM_STYLE_OPTIONS_BASE, PRESETS_VERSION } from '../../constants/presets'
import {
  AGE_PRESETS,
  ETHNICITY_PRESETS,
  FILL_MODE_PRESETS,
  GENDER_PRESETS,
  LAYOUT_PRESETS,
  PATTERN_STYLE_PRESETS,
  PATTERN_TYPE_PRESETS,
  POSE_PRESETS,
  SCENE_PRESETS,
  STYLE_MODE_PRESETS
} from '../../presets'
import type { DynamicInputPort } from './DynamicInputPortManager'
import { FormRadioGroup, FormRow, FormSection, FormSelect } from './FormComponents'
import ModelSelectorButton from './ModelSelectorButton'
import PresetGalleryButton from './PresetGalleryButton'
import { ImageInputPortSection, PromptEditorSection } from './sections'

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

const { TextArea } = Input

// 输出端口定义
interface OutputPort {
  id: string
  label: string
  dataType: string
  description?: string
}

interface UnifiedPromptConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel: (providerId: string, modelId: string) => void
  onInputsChange?: (inputs: { id: string; label: string; dataType: string; required?: boolean }[]) => void
  onOutputsChange?: (outputs: OutputPort[]) => void
}

// 默认图片输入端口
const DEFAULT_IMAGE_INPUTS: DynamicInputPort[] = [
  { id: 'image_1', label: '图片 1 (主图)', dataType: 'image', required: true, description: '主要服装图片' },
  { id: 'image_2', label: '图片 2 (可选)', dataType: 'image', required: false, description: '可选的参考图片' },
  { id: 'image_3', label: '图片 3 (可选)', dataType: 'image', required: false, description: '可选的参考图片' }
]

// 输出模式选项
const OUTPUT_MODE_OPTIONS = [
  { label: '🧑 模特提示词', value: 'model', description: '生成模特展示图的提示词' },
  { label: '🎨 图案提示词', value: 'pattern', description: '生成图案设计的提示词' },
  { label: '📸 电商图提示词', value: 'ecom', description: '生成电商产品图的提示词' },
  { label: '📦 全部输出', value: 'all', description: '同时生成三种提示词' }
]

const toFormOptions = (opts: Array<{ id: string; name: string; description?: string }>) =>
  opts.map((o) => ({ label: o.name, value: o.id, description: o.description }))

// 使用预设注册表获取选项
const AGE_GROUP_OPTIONS = toFormOptions(AGE_PRESETS.getOptions())
const GENDER_OPTIONS = toFormOptions(GENDER_PRESETS.getOptions())
const STYLE_MODE_OPTIONS = toFormOptions(STYLE_MODE_PRESETS.getOptions())
const ETHNICITY_OPTIONS = toFormOptions(ETHNICITY_PRESETS.getOptions())
const PATTERN_TYPE_OPTIONS = toFormOptions(PATTERN_TYPE_PRESETS.getOptions())
const PATTERN_STYLE_OPTIONS = toFormOptions(PATTERN_STYLE_PRESETS.getOptions())
const LAYOUT_MODE_OPTIONS = toFormOptions(LAYOUT_PRESETS.getOptions())
const FILL_MODE_OPTIONS = toFormOptions(FILL_MODE_PRESETS.getOptions())
const PLATFORM_STYLE_OPTIONS = toFormOptions(PLATFORM_STYLE_OPTIONS_BASE)

// 输出模式对应的输出端口定义
// 统一使用 promptJson 端口，避免切换模式时边连接失效
const UNIFIED_OUTPUT_PORT: OutputPort = {
  id: 'promptJson',
  label: '提示词 JSON',
  dataType: 'json',
  description: '生成的提示词 JSON（根据输出模式不同，内容格式会有所不同）'
}

/**
 * 获取输出端口（统一为 promptJson）
 */
function getOutputPorts(): OutputPort[] {
  return [UNIFIED_OUTPUT_PORT]
}

function UnifiedPromptConfigForm({
  config,
  providerId,
  modelId,
  onUpdateConfig,
  onUpdateModel,
  onInputsChange
}: UnifiedPromptConfigFormProps) {
  // 从 Redux store 获取 providers
  const providers = useAppSelector((state) => state.llm?.providers ?? []) as Provider[]

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 当前输出模式
  const outputMode = config.outputMode || 'model'

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

  // 输出端口现在是固定的，不再需要根据输出模式变化
  // 删除了之前的 prevOutputModeRef 和相关 useEffect

  useEffect(() => {
    if (typeof onUpdateConfig === 'function') {
      if (config.presetsVersion !== PRESETS_VERSION) {
        onUpdateConfig('presetsVersion', PRESETS_VERSION)
      }
    }
  }, [config.presetsVersion, onUpdateConfig])

  // 处理模型选择变化
  const handleModelChange = useCallback(
    (newProviderId: string, newModelId: string) => {
      if (typeof onUpdateConfig === 'function') {
        onUpdateConfig('providerId', newProviderId)
        onUpdateConfig('modelId', newModelId)
      }
      onUpdateModel(newProviderId, newModelId)
    },
    [onUpdateConfig, onUpdateModel]
  )

  // 处理图片输入端口变化
  const handleImageInputsChange = useCallback(
    (ports: DynamicInputPort[]) => {
      if (typeof onUpdateConfig === 'function') {
        onUpdateConfig('imageInputPorts', ports)
      }

      // 同时通知父组件更新节点的 inputs
      if (onInputsChange) {
        const inputs = ports.map((port) => ({
          id: port.id,
          label: port.label,
          dataType: port.dataType,
          required: port.required
        }))
        onInputsChange(inputs)
      }
    },
    [onUpdateConfig, onInputsChange]
  )

  // 处理输出模式变化
  // 注意：输出端口现在是固定的 promptJson，只需要更新 outputMode
  const handleOutputModeChange = useCallback(
    (value: string) => {
      // 只更新 outputMode，输出端口保持不变
      if (typeof onUpdateConfig === 'function') {
        onUpdateConfig('outputMode', value)
      }
    },
    [onUpdateConfig]
  )

  // 获取当前图片输入端口配置
  const imageInputPorts = config.imageInputPorts || DEFAULT_IMAGE_INPUTS

  // 判断是否显示特定配置
  const showModelConfig = outputMode === 'model' || outputMode === 'all'
  const showPatternConfig = outputMode === 'pattern' || outputMode === 'all'
  const showEcomConfig = outputMode === 'ecom' || outputMode === 'all'

  // 输出端口现在是固定的
  const currentOutputPorts = getOutputPorts()

  return (
    <div className="workflow-root">
      {/* 图片输入端口管理 - 使用统一组件 */}
      <ImageInputPortSection
        mode="advanced"
        ports={imageInputPorts.map((p) => ({
          id: p.id,
          label: p.label,
          dataType: 'image' as const,
          required: p.required ?? false,
          description: p.description ?? ''
        }))}
        min={1}
        max={10}
        onPortsChange={(ports) => {
          const dynamicPorts: DynamicInputPort[] = ports.map((p) => ({
            id: p.id,
            label: p.label,
            dataType: p.dataType,
            required: p.required,
            description: p.description
          }))
          handleImageInputsChange(dynamicPorts)
        }}
        portPrefix="image"
        title="📥 输入端口配置"
      />

      {/* 模型选择 */}
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

        {/* 系统提示词编辑 - 独立显示，不包裹在 FormRow 中 */}
        <div style={{ marginTop: 8 }}>
          <PromptEditorSection
            nodeType="unified_prompt"
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => onUpdateConfig('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="primary"
            modalTitle={`智能提示词 - ${
              outputMode === 'model'
                ? '模特模式'
                : outputMode === 'pattern'
                  ? '图案模式'
                  : outputMode === 'ecom'
                    ? '电商模式'
                    : '全部模式'
            } 提示词配置`}
          />
        </div>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 输出模式选择 */}
      <FormSection title="🎯 输出模式">
        <FormRadioGroup value={outputMode} onChange={handleOutputModeChange} options={OUTPUT_MODE_OPTIONS} />
        {/* 动态输出端口说明 */}
        <Alert
          message="📤 当前输出端口"
          description={
            <div style={{ fontSize: 12 }}>
              {currentOutputPorts.map((port) => (
                <div key={port.id} style={{ marginBottom: 2 }}>
                  • <strong style={{ color: 'var(--ant-color-primary)' }}>{port.label}</strong>
                  <span style={{ color: 'var(--ant-color-text-secondary)', marginLeft: 8 }}>({port.id})</span>
                </div>
              ))}
            </div>
          }
          type="success"
          showIcon
          style={{ marginTop: 12 }}
        />
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      {/* 通用配置 */}
      <FormSection title="👤 基础配置">
        <FormRow label="年龄段">
          <FormSelect
            value={config.ageGroup || 'small_kid'}
            onChange={(value) => onUpdateConfig('ageGroup', value)}
            options={AGE_GROUP_OPTIONS}
          />
        </FormRow>
        <FormRow label="性别">
          <FormSelect
            value={config.gender || 'female'}
            onChange={(value) => onUpdateConfig('gender', value)}
            options={GENDER_OPTIONS}
          />
        </FormRow>
      </FormSection>

      {/* 模特模式专用配置 */}
      {showModelConfig && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormSection title="🧑 模特配置">
            <FormRow label="风格模式" description="选择照片的整体风格">
              <FormSelect
                value={config.styleMode || 'daily'}
                onChange={(value) => onUpdateConfig('styleMode', value)}
                options={STYLE_MODE_OPTIONS}
              />
            </FormRow>
            {/* 风格说明 */}
            <Alert
              message={config.styleMode === 'commercial' ? '商拍感模式' : '日常感模式'}
              description={
                config.styleMode === 'commercial'
                  ? '专业摄影棚级别：三点布光、均匀肤色、杂志级构图、商业目录品质。适合高端电商、品牌宣传。'
                  : '真实照片风格：iPhone抓拍感、自然皮肤纹理、真实光影、生活瞬间感。适合社交媒体、生活化展示。'
              }
              type={config.styleMode === 'commercial' ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 12, fontSize: 12 }}
            />
            <FormRow label="场景预设">
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
            <FormRow label="人种预设">
              <FormSelect
                value={config.ethnicityPreset || 'asian'}
                onChange={(value) => onUpdateConfig('ethnicityPreset', value)}
                options={ETHNICITY_OPTIONS}
              />
            </FormRow>
            <FormRow label="姿态预设">
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
          </FormSection>
        </>
      )}

      {/* 图案模式专用配置 */}
      {showPatternConfig && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormSection title="🎨 图案配置">
            <FormRow label="图案类型">
              <FormSelect
                value={config.patternType || 'seamless'}
                onChange={(value) => onUpdateConfig('patternType', value)}
                options={PATTERN_TYPE_OPTIONS}
              />
            </FormRow>
            <FormRow label="图案风格">
              <FormSelect
                value={config.patternStyle || 'auto'}
                onChange={(value) => onUpdateConfig('patternStyle', value)}
                options={PATTERN_STYLE_OPTIONS}
              />
            </FormRow>
          </FormSection>
        </>
      )}

      {/* 电商图模式专用配置 */}
      {showEcomConfig && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormSection title="📸 电商图配置">
            <FormRow label="布局模式">
              <FormSelect
                value={config.layoutMode || 'flat_lay'}
                onChange={(value) => onUpdateConfig('layoutMode', value)}
                options={LAYOUT_MODE_OPTIONS}
              />
            </FormRow>
            <FormRow label="填充模式">
              <FormSelect
                value={config.fillMode || 'filled'}
                onChange={(value) => onUpdateConfig('fillMode', value)}
                options={FILL_MODE_OPTIONS}
              />
            </FormRow>
            <FormRow label="平台风格">
              <FormSelect
                value={config.platformStyle || 'shein'}
                onChange={(value) => onUpdateConfig('platformStyle', value)}
                options={PLATFORM_STYLE_OPTIONS}
              />
            </FormRow>
          </FormSection>
        </>
      )}

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
                {/* 约束提示词 */}
                <FormRow label="约束提示词" description="自定义约束条件，会添加到系统提示词中">
                  <TextArea
                    value={config.constraintPrompt || ''}
                    onChange={(e) => onUpdateConfig('constraintPrompt', e.target.value)}
                    placeholder="例如：双手叉腰、眼神看向镜头、背景需要有绿植等"
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

export default memo(UnifiedPromptConfigForm)
