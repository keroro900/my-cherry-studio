/**
 * 电商实拍图生成节点配置表单 - Cherry 风格
 * 基于参考脚本 商拍.py 的专业电商图生成功能
 *
 * 功能：
 * - 生成 SHEIN/TEMU 风格的电商主图
 * - 支持平铺图/挂拍图布局
 * - Ghost Mannequin 3D立体效果
 * - 智能风格预设与背景匹配
 * - 主图/背面图/细节图生成
 * - 支持 1K/2K/4K 高清输出
 * - 支持系统提示词编辑（类似助手功能）
 */

import './FormTheme.css'

import { EditOutlined } from '@ant-design/icons'
import { Alert, Button, Collapse, Divider, Steps, Tag } from 'antd'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { ASPECT_RATIO_OPTIONS, IMAGE_SIZE_OPTIONS } from '../../constants/formOptions'
import { PRESETS_VERSION } from '../../constants/presets'
import { FILL_MODE_PRESETS, LAYOUT_PRESETS, LIGHTING_PRESETS } from '../../presets'
import FormModal from '../FormModal'
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
import { getEcomNodePromptSteps, getPromptVariables } from './nodePromptSteps'
import PresetGalleryButton from './PresetGalleryButton'
import { ImageInputPortSection } from './sections'

interface EcomConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  // 支持单个 key-value 或批量更新 (传入对象)
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
}

/**
 * 布局模式选项 - 使用预设注册表
 */
const LAYOUT_OPTIONS = LAYOUT_PRESETS.getOptions().map((o) => ({
  label: o.name,
  value: o.id,
  description: o.description
}))

/**
 * 填充模式选项 (Ghost Mannequin 效果) - 使用预设注册表
 */
const FILL_MODE_OPTIONS = FILL_MODE_PRESETS.getOptions().map((o) => ({
  label: o.name,
  value: o.id,
  description: o.description
}))

/**
 * 光影模式选项 - 使用预设注册表
 */
const LIGHTING_OPTIONS = LIGHTING_PRESETS.getOptions().map((o) => ({
  label: o.name,
  value: o.id,
  description: o.description
}))

/**
 * 风格预设选项 - 基于参考脚本
 * 转换为 PresetGalleryButton 需要的格式
 */
const STYLE_PRESETS = [
  { id: 'none', label: '无（自由发挥）', description: '完全由AI自由判断', category: 'basic' },
  { id: 'auto', label: '自动识别', description: 'AI 根据服装图案和颜色自动判断风格', category: 'basic' },
  
  // Cute
  { id: 'sweet', label: '甜美风格', description: '草莓/樱桃/格纹/爱心，温暖柔和', category: 'cute' },
  { id: 'ip_theme', label: 'IP主题', description: '根据IP角色设计背景道具', category: 'cute' },
  { id: 'lolita', label: '洛丽塔', description: '蕾丝蝴蝶结，粉嫩公主感', category: 'cute' },
  { id: 'fairy_kei', label: '梦幻粉彩', description: '糖果色系，独角兽，彩虹', category: 'cute' },
  { id: 'princess', label: '公主风', description: '皇冠，薄纱，城堡背景', category: 'cute' },
  { id: 'mori_girl', label: '森系少女', description: '自然棉麻，森林，清新', category: 'cute' },

  // Kids Homewear (New)
  { id: 'cute_cartoon', label: '可爱卡通', description: '卡通印花，童趣满满', category: 'cute' },
  { id: 'soft_pastel', label: '柔和粉彩', description: '马卡龙色系，温柔舒适', category: 'cute' },
  { id: 'organic_cotton', label: '有机棉感', description: '天然纯棉质感，亲肤柔软', category: 'lifestyle' },
  { id: 'playful_vibe', label: '活泼童趣', description: '高饱和度，积木玩具，活力', category: 'cute' },
  { id: 'fairytale', label: '童话世界', description: '梦幻童话书场景，魔法感', category: 'cute' },

  // Fashion
  { id: 'kpop', label: 'Kpop/韩系', description: '韩系潮流，简洁时尚', category: 'fashion' },
  { id: 'school', label: '校服/制服', description: '干净端正，规整对称', category: 'fashion' },
  { id: 'preppy', label: '学院/英伦', description: '格子格纹，学术优雅', category: 'fashion' },
  { id: 'french_chic', label: '法式优雅', description: '慵懒优雅，红唇贝雷帽', category: 'fashion' },
  { id: 'scandi_minimal', label: '北欧极简', description: '冷淡色调，自然光，高级感', category: 'fashion' },
  { id: 'italian_casual', label: '意式休闲', description: '地中海风情，精致剪裁', category: 'fashion' },
  { id: 'y2k', label: 'Y2K千禧', description: '金属色，辣妹风，复古未来', category: 'fashion' },
  { id: 'boho', label: '波西米亚', description: '流苏，民族花纹，自由奔放', category: 'fashion' },
  { id: 'avant_garde', label: '前卫先锋', description: '夸张造型，艺术感，非主流', category: 'fashion' },

  // Texture & Material (New)
  { id: 'leather_biker', label: '机车皮衣', description: '皮革光泽，金属拉链，硬朗', category: 'fashion' },
  { id: 'knitted_cozy', label: '温暖针织', description: '毛线纹理，柔软蓬松，秋冬感', category: 'fashion' },
  { id: 'velvet_elegance', label: '丝绒复古', description: '丝绒反光，深邃贵气', category: 'fashion' },
  { id: 'silk_satin', label: '真丝缎面', description: '丝滑流光，高级垂坠感', category: 'fashion' },
  { id: 'denim_raw', label: '原牛质感', description: '粗犷丹宁，车缝线细节', category: 'fashion' },
  { id: 'linen_natural', label: '亚麻自然', description: '天然褶皱，透气纹理', category: 'fashion' },

  // Sporty
  { id: 'sporty', label: '运动/活力', description: '动感氛围，运动元素道具', category: 'sporty' },
  { id: 'yoga', label: '瑜伽/普拉提', description: '瑜伽垫，宁静，身体线条', category: 'sporty' },
  { id: 'gym_workout', label: '健身训练', description: '健身房背景，力量感', category: 'sporty' },
  { id: 'skater', label: '滑板街头', description: '滑板场，宽松T恤，板鞋', category: 'sporty' },
  { id: 'tennis', label: '网球风', description: '网球场，百褶裙，阳光', category: 'sporty' },
  { id: 'hiking', label: '户外徒步', description: '山野背景，冲锋衣，机能风', category: 'sporty' },

  // Street
  { id: 'street', label: '街头/酷感', description: '工业风背景，街头活力', category: 'street' },
  { id: 'denim', label: '牛仔风格', description: '休闲经典，突出牛仔质感', category: 'street' },
  { id: 'hiphop', label: '嘻哈风格', description: '涂鸦，金链，宽松廓形', category: 'street' },
  { id: 'punk', label: '朋克摇滚', description: '皮衣，铆钉，暗黑破坏', category: 'street' },
  { id: 'techwear', label: '赛博机能', description: '未来感，黑色，多口袋', category: 'street' },
  { id: 'grunge', label: '废土/Grunge', description: '做旧，颓废美学，格子衬衫', category: 'street' },
  { id: 'vintage_american', label: '美式复古', description: '棒球夹克，加油站，66号公路', category: 'street' },

  // Lifestyle
  { id: 'pajamas', label: '睡衣/家居服', description: '温馨放松，毛毯床品氛围', category: 'lifestyle' },
  { id: 'summer', label: '夏日风格', description: '沙滩海洋，度假氛围', category: 'lifestyle' },
  { id: 'picnic', label: '野餐聚会', description: '草地，野餐篮，自然阳光', category: 'lifestyle' },
  { id: 'cafe_lifestyle', label: '咖啡探店', description: '咖啡馆，精致下午茶', category: 'lifestyle' },
  { id: 'travel', label: '旅行度假', description: '机场，地标，行李箱', category: 'lifestyle' },
  { id: 'party', label: '派对聚会', description: '气球，香槟，狂欢氛围', category: 'lifestyle' },

  // Home & Cozy (New)
  { id: 'cotton_linen', label: '棉麻亲肤', description: '天然棉麻材质，透气舒适', category: 'lifestyle' },
  { id: 'silk_luxury', label: '真丝奢华', description: '丝绸光泽，高端优雅', category: 'lifestyle' },
  { id: 'morandi_home', label: '莫兰迪居家', description: '低饱和度配色，高级灰', category: 'lifestyle' },
  { id: 'muji_style', label: '日系无印风', description: '原木色，纯白，极简自然', category: 'lifestyle' },
  { id: 'scandinavian_home', label: '北欧居家', description: '冷淡风，几何地毯，绿植', category: 'lifestyle' },
  { id: 'warm_lighting', label: '暖光氛围', description: '夜晚台灯，温馨暖色调', category: 'lifestyle' },

  // Minimal
  { id: 'minimalist', label: '简约风格', description: '大量留白，极简高级', category: 'minimal' },
  { id: 'monochrome', label: '黑白单色', description: '黑白灰，光影质感', category: 'minimal' },
  { id: 'architectural', label: '建筑几何', description: '线条感，混凝土，几何构动', category: 'minimal' },

  // Professional Furniture (New)
  { id: 'ad_style', label: 'AD杂志风', description: '建筑文摘风格，广角对称，顶级质感', category: 'minimal' },
  { id: 'nordic_luxury', label: '北欧奢华', description: '高级灰，实木质感，冷淡而昂贵', category: 'lifestyle' },
  { id: 'italian_modern', label: '意式极简', description: '皮革，大理石，金属，深沉色调', category: 'fashion' },
  { id: 'wabi_sabi_luxury', label: '赤贫风奢华', description: '侘寂美学，粗糙纹理，有机形态', category: 'minimal' },
  { id: 'hotel_collection', label: '酒店臻选', description: '五星级酒店床品，洁白，暖光', category: 'lifestyle' },

  // Vintage
  { id: 'vintage_70s', label: '70年代迪斯科', description: '喇叭裤，鲜艳色彩，迪斯科球', category: 'vintage' },
  { id: 'vintage_80s', label: '80年代霓虹', description: '垫肩，高饱和度，复古滤镜', category: 'vintage' },
  { id: 'vintage_90s', label: '90年代经典', description: '极简主义，胶片质感', category: 'vintage' },
  { id: 'retro_pop', label: '复古波普', description: '波点，漫画风，高对比度', category: 'vintage' },

  // Atmosphere & Art (New)
  { id: 'film_noir', label: '黑色电影', description: '高对比度，黑白光影，神秘', category: 'vintage' },
  { id: 'dreamy_pastel', label: '梦幻柔光', description: '柔焦效果，马卡龙色系，少女心', category: 'vintage' },
  { id: 'cyberpunk', label: '赛博朋克', description: '霓虹灯光，雨夜，科技感', category: 'street' },
  { id: 'vaporwave', label: '蒸汽波', description: '复古未来，粉紫渐变，雕塑', category: 'street' },
  { id: 'wes_anderson', label: '韦斯安德森', description: '对称构图，高饱和度，糖果色', category: 'vintage' },
  { id: 'moody_dark', label: '暗调情绪', description: '低调光影，深色背景，高级感', category: 'minimal' },

  // Ethnic
  { id: 'chinese_style', label: '新中式', description: '盘扣，竹影，水墨意境', category: 'ethnic' },
  { id: 'hanbok', label: '现代韩服', description: '传统韩服元素，现代改良', category: 'ethnic' },
  { id: 'kimono', label: '和风物语', description: '和服元素，樱花，木屐', category: 'ethnic' },

  // Seasonal
  { id: 'spring_floral', label: '春日花卉', description: '鲜花盛开，嫩绿，生机', category: 'seasonal' },
  { id: 'autumn_warm', label: '金秋暖阳', description: '落叶，大地色系，温暖', category: 'seasonal' },
  { id: 'winter_cozy', label: '冬日暖心', description: '雪景，毛衣，热可可', category: 'seasonal' },
  { id: 'christmas_theme', label: '圣诞主题', description: '红绿配色，圣诞树，礼物', category: 'seasonal' }
]

/**
 * 风格预设分类定义
 */
const STYLE_CATEGORY_DEFINITIONS = [
  { key: 'basic', label: '基础' },
  { key: 'cute', label: '可爱甜美' },
  { key: 'fashion', label: '时尚潮流' },
  { key: 'sporty', label: '运动活力' },
  { key: 'street', label: '街头酷感' },
  { key: 'lifestyle', label: '生活场景' },
  { key: 'minimal', label: '极简风格' },
  { key: 'vintage', label: '复古怀旧' },
  { key: 'ethnic', label: '民族风情' },
  { key: 'seasonal', label: '季节限定' }
]

/**
 * 细节图预设选项
 */
const DETAIL_PRESET_OPTIONS = [
  { label: '领口细节', value: 'collar', description: '展示缝线、罗纹、内标' },
  { label: '袖口细节', value: 'sleeve', description: '展示袖口缝线、面料厚度' },
  { label: '下摆细节', value: 'hem', description: '展示缝线质量和垂坠感' },
  { label: '印花/图案细节', value: 'print', description: '微距展示印花墨水纹理' },
  { label: '裤腰细节', value: 'waistband', description: '展示松紧、抽绳、纽扣' },
  { label: '面料纹理', value: 'fabric', description: '微距展示编织纹理' },
  { label: '裤脚/袜口细节', value: 'ankle', description: '展示缝线和弹性' },
  { label: '后领与肩线', value: 'backneck', description: '展示背部加强带和标签' }
]

/**
 * 获取最小输入端口数
 */
function getMinInputCount(): number {
  return 2 // 至少需要上装和下装
}

/**
 * 获取输入端口说明
 * 使用统一的 image_N 命名规范
 */
function getInputPortsDescription(enableBack: boolean): { title: string; description: string }[] {
  const ports = [
    { title: 'image_1', description: '上装图片 (T恤/上衣)' },
    { title: 'image_2', description: '下装图片 (裤子/裙子，可选)' },
    { title: 'image_3', description: '额外参考图 (印花/吊牌近景，可选)' }
  ]

  if (enableBack) {
    ports.push(
      { title: 'image_4', description: '上装背面图 (可选，提供可让AI更准确生成背面)' },
      { title: 'image_5', description: '下装背面图 (可选，提供可让AI更准确生成背面)' }
    )
  }

  return ports
}

/**
 * 根据配置生成动态输入端口
 * 使用统一的 image_N 命名规范
 */
function buildImageInputPorts(enableBack: boolean, extraRefCount: number = 1) {
  const ports = [
    {
      id: 'image_1',
      label: '上装图片',
      dataType: 'image' as const,
      required: true,
      description: '上装服装图片 (T恤/上衣)'
    },
    {
      id: 'image_2',
      label: '下装图片',
      dataType: 'image' as const,
      required: false,
      description: '下装服装图片 (裤子/裙子)'
    }
  ]

  // 添加额外参考图端口
  if (extraRefCount > 0) {
    ports.push({
      id: 'image_3',
      label: '额外参考图',
      dataType: 'image' as const,
      required: false,
      description: '印花/吊牌近景，可选'
    })
  }

  // 如果启用背面图，添加背面图输入端口
  if (enableBack) {
    ports.push(
      {
        id: 'image_4',
        label: '上装背面图',
        dataType: 'image' as const,
        required: false,
        description: '上装背面照片（可选，用于生成背面图）'
      },
      {
        id: 'image_5',
        label: '下装背面图',
        dataType: 'image' as const,
        required: false,
        description: '下装背面照片（可选，用于生成背面图）'
      }
    )
  }

  return ports
}

function EcomConfigForm({ config, providerId, modelId, onUpdateConfig, onUpdateModel }: EcomConfigFormProps) {
  const [openEcomModal, setOpenEcomModal] = useState(false)
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)
  const layout = config.layout || 'flat_lay'
  const fillMode = config.fillMode || 'filled'
  const lightingMode = config.lightingMode || 'auto'
  const enableBack = config.enableBack ?? false
  const enableDetail = config.enableDetail ?? false
  const minInputCount = getMinInputCount()
  const imageInputCount = config.imageInputCount ?? minInputCount

  // 合并自定义预设和内置预设
  const allStylePresets = useMemo(() => {
    const customList = (config.ecomCustomPresets || []).map((p: any) => ({
      id: p.id,
      label: p.name,
      description: p.description || '',
      category: 'custom'
    }))
    return [...customList, ...STYLE_PRESETS]
  }, [config.ecomCustomPresets])

  // 获取当前选中的 provider 和 model ID
  const currentProviderId = config.providerId || providerId
  const currentModelId = config.modelId || modelId

  // 获取提示词步骤定义（根据当前配置动态生成，合并自定义提示词）
  const promptSteps = useMemo(
    () =>
      getEcomNodePromptSteps({
        nodeType: 'gemini_ecom',
        config: {
          layout,
          fillMode,
          lightingMode,
          garmentDescription: config.garmentDescription,
          stylePreset: config.stylePreset,
          styleConstraint: config.styleConstraint,
          extraNote: config.extraNote,
          imageSize: config.imageSize,
          aspectRatio: config.aspectRatio
        },
        customPrompts: config.customPrompts
      }),
    [
      layout,
      fillMode,
      lightingMode,
      config.garmentDescription,
      config.stylePreset,
      config.styleConstraint,
      config.extraNote,
      config.imageSize,
      config.aspectRatio,
      config.customPrompts
    ]
  )

  // 获取可用变量列表（用于提示词编辑器）
  const availableVariables = useMemo(() => getPromptVariables('gemini_ecom'), [])

  useEffect(() => {
    if (config.presetsVersion !== PRESETS_VERSION) {
      onUpdateConfig('presetsVersion', PRESETS_VERSION)
    }
  }, [config.presetsVersion, onUpdateConfig])

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

  // 处理 enableBack 变化时更新 imageInputPorts
  // 使用批量更新避免 React 闭包导致的状态覆盖问题
  const handleEnableBackChange = useCallback(
    (checked: boolean) => {
      const newPorts = buildImageInputPorts(checked, imageInputCount > 2 ? 1 : 0)
      // 批量更新 enableBack 和 imageInputPorts
      onUpdateConfig({
        enableBack: checked,
        imageInputPorts: newPorts
      })
    },
    [onUpdateConfig, imageInputCount]
  )

  // 处理提示词保存
  const handleSavePrompts = useCallback(
    (steps: typeof promptSteps) => {
      const customPrompts: Record<string, string> = {}
      steps.forEach((step) => {
        // 只保存与默认值不同的提示词
        if (step.prompt !== step.defaultPrompt) {
          customPrompts[step.id] = step.prompt
        }
      })
      onUpdateConfig('customPrompts', Object.keys(customPrompts).length > 0 ? customPrompts : undefined)
    },
    [onUpdateConfig]
  )

  const inputPorts = getInputPortsDescription(enableBack)

  return (
    <div className="workflow-root">
      {/* 功能说明 */}
      <Alert
        message="电商实拍图生成"
        description="将服装照片重新编辑成 SHEIN/TEMU 风格的高品质电商主图，支持主图、背面图、细节图生成"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 模型选择 - 使用 Cherry 原生 SelectModelPopup */}
      <FormSection title="🤖 AI 模型">
        <FormRow label="图像生成模型" description="选择支持图像生成的 AI 模型">
          <ModelSelectorButton
            providerId={currentProviderId}
            modelId={currentModelId}
            filter={imageGenerationModelFilter}
            showTagFilter={true}
            onModelChange={handleModelChange}
            placeholder="点击选择模型"
          />
        </FormRow>
        {/* 系统提示词编辑按钮 - 独立行显示，更醒目 */}
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setPromptEditorOpen(true)}
            title="编辑系统提示词"
            block>
            ✏️ 编辑提示词
          </Button>
        </div>

        <FormRow label="输出尺寸" description="更高分辨率需要更长生成时间">
          <FormSelect
            value={config.imageSize || '2K'}
            onChange={(value) => onUpdateConfig('imageSize', value)}
            options={IMAGE_SIZE_OPTIONS}
          />
        </FormRow>

        <FormRow label="宽高比" description="电商标准为 3:4">
          <FormSelect
            value={config.aspectRatio || '3:4'}
            onChange={(value) => onUpdateConfig('aspectRatio', value)}
            options={ASPECT_RATIO_OPTIONS}
          />
        </FormRow>
      </FormSection>

      {/* 布局模式选择 */}
      <FormSection title="📐 布局模式">
        <Button type="default" size="small" onClick={() => setOpenEcomModal(true)} style={{ marginBottom: 8 }}>
          打开电商图配置
        </Button>
        <FormModal open={openEcomModal} title="电商图配置" onClose={() => setOpenEcomModal(false)}>
          <FormRow label="布局模式">
            <FormRadioGroup
              value={layout}
              onChange={(value) => onUpdateConfig('layout', value)}
              options={LAYOUT_OPTIONS}
            />
          </FormRow>
          <Alert
            message={LAYOUT_PRESETS.getPreset(layout)?.description || '选择服装拍摄展示方式'}
            type="info"
            showIcon
            style={{ marginTop: 8, fontSize: 12 }}
          />
          <FormRow label="立体效果 (Ghost Mannequin)">
            <FormRadioGroup
              value={fillMode}
              onChange={(value) => onUpdateConfig('fillMode', value)}
              options={FILL_MODE_OPTIONS}
            />
          </FormRow>
          <FormRow label="光影模式">
            <FormRadioGroup
              value={lightingMode}
              onChange={(value) => onUpdateConfig('lightingMode', value)}
              options={LIGHTING_OPTIONS}
            />
          </FormRow>
          <Alert
            message={LIGHTING_PRESETS.getPreset(lightingMode)?.description || '选择拍摄灯光设置'}
            type="info"
            showIcon
            style={{ marginTop: 8, fontSize: 12 }}
          />
        </FormModal>
      </FormSection>

      {/* 填充模式说明卡片 */}
      <FormSection title="👻 立体效果说明">
        <FormCard title="Ghost Mannequin 3D 立体效果">
          <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.8 }}>
            {fillMode === 'filled' ? (
              <>
                <div>
                  <Tag color="blue">核心</Tag> 模拟隐形模特，衣服内部有体积感
                </div>
                <div>
                  <Tag color="green">领口</Tag> 内部阴影，让人感觉有空间
                </div>
                <div>
                  <Tag color="orange">轮廓</Tag> 与背景有接触阴影，形成深度
                </div>
                <div>
                  <Tag color="purple">精修</Tag> 减少褶皱，保持版型整洁
                </div>
              </>
            ) : (
              <>
                <div>• 自然平铺，布料略显扁平</div>
                <div>• 专业精修，去除多余褶皱</div>
                <div>• 适合简约风格和日系风格</div>
              </>
            )}
          </div>
        </FormCard>
      </FormSection>

      {/* 风格预设 - 使用画廊式选择器 */}
      <FormSection title="🎨 风格预设">
        <PresetGalleryButton
          presets={allStylePresets}
          selectedId={config.stylePreset}
          onSelect={(preset) => {
            onUpdateConfig('stylePreset', preset.id)
          }}
          placeholder="选择风格预设..."
          modalTitle="选择电商风格"
          categories={STYLE_CATEGORY_DEFINITIONS}
          getCategoryKey={(p) => (p as any).category || 'basic'}
          getPresetCategory={() => 'commercial'}
          favoritesStorageKey="workflow-ecom-style-favorites"
          searchPlaceholder="搜索风格..."
        />

        <div style={{ marginTop: 12 }}>
          <FormRow label="自定义风格约束" description="补充风格预设的额外要求">
            <FormTextArea
              value={config.styleConstraint || ''}
              onChange={(value) => onUpdateConfig('styleConstraint', value)}
              placeholder="例如：背景使用浅粉色毛毯，搭配 Hello Kitty 玩偶..."
              rows={2}
            />
          </FormRow>
        </div>
      </FormSection>

      {/* 图片输入端口配置 - 使用统一组件 */}
      <ImageInputPortSection
        mode="simple"
        count={imageInputCount}
        ports={config.imageInputPorts || buildImageInputPorts(enableBack, imageInputCount > 2 ? 1 : 0)}
        min={minInputCount}
        max={6}
        onCountChange={(count) => {
          const newPorts = buildImageInputPorts(enableBack, count > 2 ? count - 2 : 0)
          onUpdateConfig({
            imageInputCount: count,
            imageInputPorts: newPorts
          })
        }}
        title="📷 图片输入"
        showDivider={false}
        showAlert={false}
      />

      {/* 输入端口说明 */}
      <FormCard title="输入端口说明">
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={inputPorts.slice(0, 3).map((port) => ({
            title: <code style={{ fontSize: 12 }}>{port.title}</code>,
            description: port.description
          }))}
        />
      </FormCard>

      {/* 生成选项 */}
      <FormSection title="🖼️ 生成选项">
        {/* 背面图 */}
        <FormRow label="生成背面图" description="生成与主图风格一致的背面展示图">
          <FormSwitch checked={enableBack} onChange={handleEnableBackChange} />
        </FormRow>

        {/* 背面图输入端口说明 */}
        {enableBack && (
          <FormCard title="背面图输入端口">
            <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.8 }}>
              <div>
                <code style={{ fontSize: 11 }}>image_4</code> - 上装背面照片（可选）
              </div>
              <div>
                <code style={{ fontSize: 11 }}>image_5</code> - 下装背面照片（可选）
              </div>
              <div style={{ marginTop: 8, color: 'var(--color-text-3)' }}>
                提供背面照片可以让AI更准确地生成背面图，如果不提供则AI会根据正面图推测背面
              </div>
            </div>
          </FormCard>
        )}

        {/* 细节图 */}
        <FormRow label="生成细节图" description="生成特写细节图（领口、袖口等）">
          <FormSwitch checked={enableDetail} onChange={(checked) => onUpdateConfig('enableDetail', checked)} />
        </FormRow>

        {enableDetail && (
          <FormRow label="细节类型" description="选择要生成的细节图类型">
            <FormSelect
              value={config.detailTypes || ['collar', 'print', 'fabric']}
              onChange={(value) => onUpdateConfig('detailTypes', value)}
              options={DETAIL_PRESET_OPTIONS}
              mode="multiple"
            />
          </FormRow>
        )}
      </FormSection>

      {/* 服装描述 */}
      <FormSection title="📝 服装描述">
        <FormRow label="服装描述" description="帮助 AI 更准确理解服装类型">
          <FormTextArea
            value={config.garmentDescription || ''}
            onChange={(value) => onUpdateConfig('garmentDescription', value)}
            placeholder="例如：女童家居服睡衣套装，上衣 + 长裤，Kpop 风格卡通印花，涤纶面料"
            rows={2}
          />
        </FormRow>

        <FormRow label="额外指令" description="给 AI 的额外生成指令">
          <FormTextArea
            value={config.extraNote || ''}
            onChange={(value) => onUpdateConfig('extraNote', value)}
            placeholder="例如：保持印花清晰度、增强色彩饱和度..."
            rows={2}
          />
        </FormRow>
      </FormSection>

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
                <FormRow label="📝 使用系统提示词" description="启用专业电商图生成提示词">
                  <FormSwitch
                    checked={config.useSystemPrompt ?? true}
                    onChange={(checked) => onUpdateConfig('useSystemPrompt', checked)}
                  />
                </FormRow>

                {/* 专业精修 */}
                <FormRow label="✨ 专业精修" description="自动去除多余褶皱，优化版型">
                  <FormSwitch
                    checked={config.professionalRetouch ?? true}
                    onChange={(checked) => onUpdateConfig('professionalRetouch', checked)}
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
                <FormRow label="🔄 重试次数" description="失败时自动重试">
                  <FormNumber
                    value={config.retryCount ?? 2}
                    onChange={(value) => onUpdateConfig('retryCount', value)}
                    min={0}
                    max={5}
                  />
                </FormRow>

                {/* 超时时间 */}
                <FormRow label="⏱️ 超时时间" description="单个请求的最大等待时间（秒）">
                  <FormNumber
                    value={config.timeout ?? 180}
                    onChange={(value) => onUpdateConfig('timeout', value)}
                    min={60}
                    max={600}
                  />
                </FormRow>
              </div>
            )
          }
        ]}
      />

      {/* 质量标准说明 */}
      <FormCard title="SHEIN/TEMU 质量标准">
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.8 }}>
          <div>
            <Tag color="blue">版型</Tag> 精修整洁，褶皱合理（仅保留结构褶皱）
          </div>
          <div>
            <Tag color="green">背景</Tag> 与服装风格匹配，有氛围感
          </div>
          <div>
            <Tag color="orange">立体</Tag> 3D 体积感，不是扁平效果
          </div>
          <div>
            <Tag color="purple">光影</Tag> 柔和自然，无硬阴影
          </div>
          <div>
            <Tag color="cyan">细节</Tag> 清晰可见，色彩准确
          </div>
        </div>
      </FormCard>

      {/* 系统提示词编辑模态框 */}
      <PromptEditorModal
        open={promptEditorOpen}
        title="电商实拍图 - 系统提示词配置"
        steps={promptSteps}
        availableVariables={availableVariables}
        onClose={() => setPromptEditorOpen(false)}
        onSave={handleSavePrompts}
      />
    </div>
  )
}

export default memo(EcomConfigForm)
