/**
 * 电商预设选择器组件
 *
 * 统一的电商风格预设、约束提示词、模特预设、场景预设选择器
 * 可复用于所有 AI 节点配置表单
 *
 * 【Single Source of Truth】
 * 所有预设选项从 presets/ 自动生成
 * 添加/删除预设时 UI 自动同步
 */

import { ShopOutlined } from '@ant-design/icons'
import { Collapse, type CollapseProps, Input } from 'antd'
import { memo, useMemo } from 'react'

import { AGE_PRESETS, ECOM_STYLE_PRESETS, GENDER_PRESETS, POSE_PRESETS, SCENE_PRESETS } from '../../presets'
import { FormRow, FormSection } from './FormComponents'
import PresetGalleryButton from './PresetGalleryButton'
import PresetSelectorBase from './PresetSelectorBase'

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

// 姿势 ID 到分类的映射
const POSE_CATEGORY_MAP: Record<string, string> = {
  // 基础姿势
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
  // 站姿类
  leaning_wall: 'standing',
  hands_in_pockets: 'standing',
  crossed_arms: 'standing',
  looking_back: 'standing',
  side_profile: 'standing',
  one_leg_up: 'standing',
  tiptoe: 'standing',
  // 坐姿类
  sitting_floor: 'sitting',
  kneeling: 'sitting',
  sitting_stool: 'sitting',
  reclining: 'sitting',
  sitting_steps: 'sitting',
  hugging_knees: 'sitting',
  // 居家舒适
  waking_up: 'home',
  couch_potato: 'home',
  holding_pillow: 'home',
  skin_care: 'home',
  brushing_teeth: 'home',
  cooking: 'home',
  stretching_bed: 'home',
  sitting_window: 'home',
  // 运动健身
  yoga_tree: 'sports',
  yoga_lotus: 'sports',
  plank: 'sports',
  jogging: 'sports',
  // 职场工作
  typing: 'work',
  presentation: 'work',
  writing: 'work',
  on_call: 'work',
  // 情绪表达
  laughing: 'emotion',
  surprised: 'emotion',
  thinking: 'emotion',
  sad: 'emotion',
  // 动态类
  twirling: 'dynamic',
  kicking: 'dynamic',
  stretching: 'dynamic',
  waving: 'dynamic',
  clapping: 'dynamic',
  dancing: 'dynamic',
  // 互动类
  reading: 'interactive',
  holding_flower: 'interactive',
  drinking: 'interactive',
  eating: 'interactive',
  using_phone: 'interactive',
  holding_bag: 'interactive',
  // 时尚类
  catwalk: 'fashion',
  hair_touch: 'fashion',
  face_framing: 'fashion',
  looking_up: 'fashion',
  jacket_drape: 'fashion',
  // 儿童专用
  hiding_face: 'kids',
  finger_heart: 'kids',
  peace_sign: 'kids',
  crawling: 'kids',
  lying_stomach: 'kids',
  // 儿童家居
  playing_toys: 'kids_home',
  reading_floor: 'kids_home',
  hugging_plushie: 'kids_home',
  jumping_bed: 'kids_home',
  napping: 'kids_home',
  parent_child: 'kids_home',
  // 家居展示（专业）
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

// 场景 ID 到分类的映射
const SCENE_CATEGORY_MAP: Record<string, string> = {
  // 基础场景
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
  // 居家生活
  living_room_sunny: 'home',
  bathroom_luxury: 'home',
  bathroom_mirror: 'home',
  walk_in_closet: 'home',
  balcony_garden: 'home',
  entrance_hall: 'home',
  laundry_room: 'home',
  home_office: 'home',
  // 交通出行
  car_interior: 'transport',
  subway_station: 'transport',
  airport_terminal: 'transport',
  airplane_cabin: 'transport',
  // 专业场所
  classroom: 'professional',
  art_studio: 'professional',
  science_lab: 'professional',
  // 休闲娱乐
  swimming_pool: 'entertainment',
  cinema: 'entertainment',
  concert_stage: 'entertainment',
  // 室内场景
  cafe: 'indoor',
  library: 'indoor',
  supermarket: 'indoor',
  hotel_lobby: 'indoor',
  gym: 'indoor',
  bedroom: 'indoor',
  kitchen: 'indoor',
  // 户外场景
  rooftop: 'outdoor',
  bridge: 'outdoor',
  bus_stop: 'outdoor',
  tunnel: 'outdoor',
  parking_lot: 'outdoor',
  // 自然场景
  forest_path: 'nature',
  flower_field: 'nature',
  snow_field: 'nature',
  desert: 'nature',
  waterfall: 'nature',
  lake_pier: 'nature',
  // 商业场景
  mall: 'commercial',
  office_modern: 'commercial',
  boutique: 'commercial',
  meeting_room: 'commercial',
  // 特色场景
  amusement_park: 'special',
  aquarium: 'special',
  museum: 'special',
  zoo: 'special',
  // 氛围场景
  neon_night: 'mood',
  rainy_window: 'mood',
  sunset_silhouette: 'mood',
  foggy_morning: 'mood',
  starry_night: 'mood',
  // 节日场景
  christmas: 'festival',
  halloween: 'festival',
  birthday: 'festival',
  new_year: 'festival',
  // 儿童家居
  kids_bedroom: 'kids_home',
  play_tent: 'kids_home',
  toy_room: 'kids_home',
  messy_corner: 'kids_home',
  story_time: 'kids_home',
  // 专业家居
  luxury_penthouse: 'pro_home',
  scandinavian_living: 'pro_home',
  italian_kitchen: 'pro_home',
  mid_century_corner: 'pro_home',
  zen_bathroom: 'pro_home'
}

const { TextArea } = Input

interface EcomPresetSelectorProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
  // 显示选项
  showConstraintPrompt?: boolean
  showEcomPresets?: boolean
  showModelPresets?: boolean
  showScenePresets?: boolean
  // 约束提示词占位符
  constraintPlaceholder?: string
}

function EcomPresetSelector({
  config,
  onUpdateConfig,
  showConstraintPrompt = true,
  showEcomPresets = true,
  showModelPresets = true,
  showScenePresets = true,
  constraintPlaceholder = '例如：双手叉腰、眼神看向镜头、背景需要有绿植等'
}: EcomPresetSelectorProps) {
  const collapseItems: CollapseProps['items'] = []

  // 从注册表获取预设选项 - 添加/删除预设时自动同步
  const ecomStyleOptions = useMemo(() => ECOM_STYLE_PRESETS.getOptions(), [])

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

  // 电商风格预设
  if (showEcomPresets) {
    collapseItems.push({
      key: 'ecom-presets',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <ShopOutlined style={{ marginRight: 8 }} />
          电商风格预设
        </span>
      ),
      children: (
        <div style={{ padding: '8px 0' }}>
          <PresetSelectorBase
            presets={ecomStyleOptions.map((p) => ({ id: p.id, label: p.name, description: p.description }))}
            selectedId={config.ecomPresetId}
            onSelect={(preset) => {
              onUpdateConfig('ecomPresetId', preset.id)
              onUpdateConfig('ecomPresetName', preset.label)
            }}
            layout="flex"
            showSearch={false}
            maxHeight={null}
          />
          {config.ecomPresetId && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: 'var(--ant-color-fill-tertiary)',
                borderRadius: '6px',
                fontSize: '11px'
              }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>已选择: {config.ecomPresetName}</div>
              <div style={{ color: 'var(--ant-color-text-secondary)' }}>风格特点将自动应用到提示词生成中</div>
            </div>
          )}
        </div>
      )
    })
  }

  // 模特预设
  if (showModelPresets) {
    collapseItems.push({
      key: 'model-presets',
      label: <span style={{ fontSize: 13, fontWeight: 500 }}>👤 模特预设</span>,
      children: (
        <div style={{ padding: '8px 0' }}>
          {/* 年龄段 - 使用芯片选择器（选项少） */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>年龄段</div>
            <PresetSelectorBase
              presets={AGE_PRESETS.getOptions().map((p) => ({ id: p.id, label: p.name }))}
              selectedId={config.ageGroup}
              onSelect={(preset) => onUpdateConfig('ageGroup', preset.id)}
              layout="flex"
              chipSize="small"
              showSearch={false}
              maxHeight={null}
            />
          </div>
          {/* 性别 - 使用芯片选择器（选项少） */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>性别</div>
            <PresetSelectorBase
              presets={GENDER_PRESETS.getOptions().map((p) => ({ id: p.id, label: p.name }))}
              selectedId={config.gender}
              onSelect={(preset) => onUpdateConfig('gender', preset.id)}
              layout="flex"
              chipSize="small"
              showSearch={false}
              maxHeight={null}
            />
          </div>
          {/* 姿势 - 使用画廊选择器（选项多） */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>姿势</div>
            <PresetGalleryButton
              presets={posePresets}
              selectedId={config.modelPose}
              onSelect={(preset) => onUpdateConfig('modelPose', preset.id)}
              placeholder="选择姿势..."
              modalTitle="选择姿势预设"
              categories={POSE_CATEGORY_DEFINITIONS}
              getCategoryKey={(p) => POSE_CATEGORY_MAP[p.id] || 'basic'}
              getPresetCategory={() => 'model'}
              favoritesStorageKey="workflow-pose-favorites"
              searchPlaceholder="搜索姿势..."
            />
          </div>
        </div>
      )
    })
  }

  // 场景预设
  if (showScenePresets) {
    collapseItems.push({
      key: 'scene-presets',
      label: <span style={{ fontSize: 13, fontWeight: 500 }}>🏠 场景预设</span>,
      children: (
        <div style={{ padding: '8px 0' }}>
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
        </div>
      )
    })
  }

  return (
    <div>
      {/* 约束提示词 */}
      {showConstraintPrompt && (
        <FormSection title="📝 约束提示词">
          <FormRow label="自定义约束" description="添加额外的约束条件到提示词中">
            <TextArea
              value={config.constraintPrompt || ''}
              onChange={(e) => onUpdateConfig('constraintPrompt', e.target.value)}
              placeholder={constraintPlaceholder}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ fontSize: '12px' }}
            />
          </FormRow>
        </FormSection>
      )}

      {/* 预设折叠面板 */}
      {collapseItems.length > 0 && <Collapse ghost style={{ marginTop: '8px' }} items={collapseItems} />}
    </div>
  )
}

export default memo(EcomPresetSelector)
