/**
 * 行业摄影节点通用配置表单
 *
 * 支持的节点类型：
 * - jewelry_photo: 珠宝摄影
 * - food_photo: 食品摄影
 * - product_scene: 产品场景
 * - jewelry_tryon: 首饰试戴
 *
 * 功能：
 * - 模型选择
 * - 提示词编辑（使用 PromptEditorSection）
 * - 预设画廊选择器
 * - 动态图片输入端口
 * - 节点特定配置选项
 */

import './FormTheme.css'

import { Alert, Collapse, Divider } from 'antd'
import { memo, useCallback, useMemo } from 'react'

import { ASPECT_RATIO_OPTIONS, IMAGE_SIZE_OPTIONS } from '../../constants/formOptions'
import { FormNumber, FormRow, FormSection, FormSelect, FormSwitch, FormTextArea } from './FormComponents'
import ModelSelectorButton, { imageGenerationModelFilter } from './ModelSelectorButton'
import PresetGalleryButton from './PresetGalleryButton'
import { ImageInputPortSection, PromptEditorSection } from './sections'

interface IndustryPhotoConfigFormProps {
  config: Record<string, any>
  providerId?: string
  modelId?: string
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  onUpdateModel?: (providerId: string, modelId: string) => void
  /** 节点类型 */
  nodeType: string
}

/**
 * 节点类型到显示名称的映射
 */
const NODE_TYPE_LABELS: Record<string, string> = {
  jewelry_photo: '珠宝摄影',
  food_photo: '食品摄影',
  product_scene: '产品场景',
  jewelry_tryon: '首饰试戴',
  eyewear_tryon: '眼镜试戴',
  footwear_display: '鞋类展示',
  cosmetics_photo: '美妆产品',
  furniture_scene: '家具场景',
  electronics_photo: '电子产品'
}

/**
 * 节点类型到描述的映射
 */
const NODE_TYPE_DESCRIPTIONS: Record<string, string> = {
  jewelry_photo: '专业珠宝产品摄影生成，支持金属表面光线控制和宝石折射效果',
  food_photo: '专业食品摄影生成，支持新鲜感、蒸汽和水珠等动态效果',
  product_scene: '将产品融入指定场景，支持光影匹配与自然融合',
  jewelry_tryon: '虚拟首饰试戴效果生成，支持项链、耳环、手链等多种首饰类型',
  eyewear_tryon: '虚拟眼镜试戴效果生成，支持眼镜、太阳镜、护目镜等多种镜框风格',
  footwear_display: '专业鞋类产品展示图片生成，支持运动鞋、皮鞋、靴子等多种类型',
  cosmetics_photo: '专业美妆护肤产品摄影生成，支持产品质感、光泽和包装清晰度',
  furniture_scene: '专业家具室内场景合成，支持多种装修风格和空间大小',
  electronics_photo: '专业电子产品摄影生成，支持反光处理、屏幕内容和科技感营造'
}

import type { PresetCategory } from './PresetCard'
import type { PresetItem } from './PresetGalleryModal'

// ==================== 珠宝摄影预设 ====================

const JEWELRY_TYPE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别珠宝类型', category: 'artistic' as PresetCategory },
  {
    id: 'ring',
    label: '戒指',
    description: '各类戒指，包括订婚戒、结婚戒、时尚戒指',
    category: 'artistic' as PresetCategory
  },
  {
    id: 'necklace',
    label: '项链',
    description: '吊坠项链、链条项链、珍珠项链等',
    category: 'artistic' as PresetCategory
  },
  { id: 'earring', label: '耳环', description: '耳钉、耳环、耳坠等各类耳饰', category: 'artistic' as PresetCategory },
  { id: 'bracelet', label: '手链', description: '手链、手镯、charm 手链等', category: 'artistic' as PresetCategory },
  { id: 'watch', label: '手表', description: '奢华腕表、时尚手表', category: 'artistic' as PresetCategory },
  { id: 'brooch', label: '胸针', description: '胸针、别针等装饰品', category: 'artistic' as PresetCategory },
  { id: 'pendant', label: '吊坠', description: '单独吊坠配饰', category: 'artistic' as PresetCategory },
  { id: 'cufflinks', label: '袖扣', description: '男士袖扣配饰', category: 'artistic' as PresetCategory }
]

const METAL_TYPE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别金属类型', category: 'artistic' as PresetCategory },
  { id: 'gold', label: '黄金', description: '温暖的黄金色泽，18K/24K', category: 'artistic' as PresetCategory },
  { id: 'white_gold', label: '白金', description: '白金合金，明亮高贵', category: 'artistic' as PresetCategory },
  { id: 'silver', label: '白银', description: '明亮的银色光泽，925银', category: 'artistic' as PresetCategory },
  { id: 'platinum', label: '铂金', description: '高贵的铂金质感', category: 'artistic' as PresetCategory },
  { id: 'rose_gold', label: '玫瑰金', description: '浪漫的玫瑰金色调', category: 'artistic' as PresetCategory },
  { id: 'titanium', label: '钛金属', description: '现代感钛金属质感', category: 'commercial' as PresetCategory },
  { id: 'stainless', label: '不锈钢', description: '时尚不锈钢材质', category: 'commercial' as PresetCategory },
  { id: 'mixed', label: '混合金属', description: '双色/多色金属搭配', category: 'artistic' as PresetCategory }
]

const STONE_TYPE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别宝石类型', category: 'artistic' as PresetCategory },
  { id: 'none', label: '无宝石', description: '纯金属设计，无宝石', category: 'commercial' as PresetCategory },
  { id: 'diamond', label: '钻石', description: '闪耀的钻石，捕捉火彩与亮度', category: 'artistic' as PresetCategory },
  { id: 'ruby', label: '红宝石', description: '深红色的红宝石，热情华贵', category: 'artistic' as PresetCategory },
  { id: 'sapphire', label: '蓝宝石', description: '深邃的蓝宝石，皇室气质', category: 'artistic' as PresetCategory },
  { id: 'emerald', label: '祖母绿', description: '翠绿的祖母绿，生机盎然', category: 'artistic' as PresetCategory },
  { id: 'pearl', label: '珍珠', description: '温润的珍珠光泽，优雅典范', category: 'lifestyle' as PresetCategory },
  { id: 'aquamarine', label: '海蓝宝', description: '清澈的海蓝色调', category: 'artistic' as PresetCategory },
  { id: 'amethyst', label: '紫水晶', description: '神秘的紫色光芒', category: 'artistic' as PresetCategory },
  { id: 'opal', label: '欧泊', description: '变彩效果的欧泊石', category: 'artistic' as PresetCategory },
  { id: 'tanzanite', label: '坦桑石', description: '稀有的蓝紫色宝石', category: 'artistic' as PresetCategory },
  { id: 'turquoise', label: '绿松石', description: '天蓝色的绿松石', category: 'lifestyle' as PresetCategory },
  { id: 'crystal', label: '水晶', description: '透明或彩色水晶', category: 'commercial' as PresetCategory }
]

const LIGHTING_SETUP_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳打光方式',
    category: 'commercial' as PresetCategory
  },
  {
    id: 'soft_box',
    label: '柔光箱',
    description: '专业柔光箱，均匀照明，减少反光',
    category: 'commercial' as PresetCategory
  },
  {
    id: 'ring_light',
    label: '环形灯',
    description: '环形灯，对称照明，无死角',
    category: 'commercial' as PresetCategory
  },
  { id: 'natural', label: '自然光', description: '窗户自然光，温暖柔和氛围', category: 'lifestyle' as PresetCategory },
  {
    id: 'dramatic',
    label: '戏剧光',
    description: '强对比戏剧性光线，突出质感',
    category: 'artistic' as PresetCategory
  },
  { id: 'backlit', label: '逆光', description: '背光效果，轮廓分明', category: 'artistic' as PresetCategory },
  { id: 'tent', label: '灯罩帐篷', description: '360°柔光帐篷，消除反射', category: 'commercial' as PresetCategory },
  { id: 'spotlight', label: '聚光灯', description: '聚焦照明，突出焦点', category: 'artistic' as PresetCategory }
]

const BACKGROUND_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳背景',
    category: 'commercial' as PresetCategory
  },
  { id: 'white', label: '纯白', description: '干净的纯白背景，电商标准', category: 'commercial' as PresetCategory },
  { id: 'black', label: '纯黑', description: '高级感的黑色背景，奢华风', category: 'artistic' as PresetCategory },
  { id: 'gradient', label: '渐变', description: '柔和的渐变背景，层次丰富', category: 'pattern' as PresetCategory },
  {
    id: 'lifestyle',
    label: '生活场景',
    description: '场景化背景展示，有氛围感',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'velvet', label: '丝绒', description: '丝绒质感背景，奢华质感', category: 'artistic' as PresetCategory },
  { id: 'marble', label: '大理石', description: '大理石纹理背景，高端大气', category: 'artistic' as PresetCategory },
  { id: 'bokeh', label: '虚化光斑', description: '柔美的光斑虚化背景', category: 'artistic' as PresetCategory },
  { id: 'reflective', label: '镜面反射', description: '镜面反射效果，现代感', category: 'commercial' as PresetCategory }
]

// ==================== 食品摄影预设 ====================

const FOOD_CATEGORY_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别食品类别',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'beverage', label: '饮品', description: '咖啡、茶、果汁、鸡尾酒等', category: 'lifestyle' as PresetCategory },
  { id: 'dessert', label: '甜点', description: '蛋糕、冰淇淋、糕点、巧克力', category: 'lifestyle' as PresetCategory },
  { id: 'main_dish', label: '主菜', description: '正餐主菜、肉类、鱼类料理', category: 'lifestyle' as PresetCategory },
  { id: 'snack', label: '零食', description: '休闲零食小吃、薯片、坚果', category: 'lifestyle' as PresetCategory },
  { id: 'ingredient', label: '原料', description: '新鲜食材、蔬菜、水果原料', category: 'lifestyle' as PresetCategory },
  {
    id: 'breakfast',
    label: '早餐',
    description: '早餐食品、面包、麦片、鸡蛋',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'salad', label: '沙拉', description: '健康沙拉、轻食料理', category: 'lifestyle' as PresetCategory },
  { id: 'soup', label: '汤品', description: '各类汤品、炖品', category: 'lifestyle' as PresetCategory },
  { id: 'seafood', label: '海鲜', description: '海鲜料理、刺身、寿司', category: 'lifestyle' as PresetCategory },
  { id: 'bakery', label: '烘焙', description: '面包、糕点、烘焙食品', category: 'lifestyle' as PresetCategory },
  { id: 'fast_food', label: '快餐', description: '汉堡、披萨、炸鸡等快餐', category: 'commercial' as PresetCategory },
  { id: 'asian', label: '亚洲菜', description: '中餐、日料、韩餐等亚洲美食', category: 'lifestyle' as PresetCategory }
]

const FOOD_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据食物类型自动选择最佳风格',
    category: 'commercial' as PresetCategory
  },
  {
    id: 'minimalist',
    label: '极简',
    description: '简约干净的风格，突出食物本身',
    category: 'commercial' as PresetCategory
  },
  { id: 'rustic', label: '乡村', description: '温暖的乡村风格，质朴自然', category: 'lifestyle' as PresetCategory },
  { id: 'modern', label: '现代', description: '时尚现代的呈现，几何构图', category: 'commercial' as PresetCategory },
  { id: 'traditional', label: '传统', description: '经典传统的风格，怀旧感', category: 'lifestyle' as PresetCategory },
  { id: 'nordic', label: '北欧', description: '北欧简约风格，清新自然', category: 'lifestyle' as PresetCategory },
  { id: 'asian_style', label: '东方', description: '东方美学风格，意境深远', category: 'artistic' as PresetCategory },
  {
    id: 'mediterranean',
    label: '地中海',
    description: '地中海风格，阳光海岸感',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'dark_mood', label: '暗调', description: '暗调摄影风格，戏剧性强', category: 'artistic' as PresetCategory },
  { id: 'bright_airy', label: '明亮通透', description: '明亮通透风格，清新感', category: 'lifestyle' as PresetCategory }
]

const FOOD_MOOD_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据食物自动选择最佳氛围',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'warm', label: '温暖', description: '温馨舒适的氛围，暖色调', category: 'lifestyle' as PresetCategory },
  { id: 'fresh', label: '清新', description: '清爽新鲜的感觉，绿色系', category: 'lifestyle' as PresetCategory },
  { id: 'cozy', label: '舒适', description: '放松惬意的氛围，居家感', category: 'lifestyle' as PresetCategory },
  { id: 'elegant', label: '优雅', description: '精致高雅的格调，餐厅级别', category: 'artistic' as PresetCategory },
  {
    id: 'appetizing',
    label: '诱人',
    description: '勾起食欲的感觉，色彩鲜艳',
    category: 'commercial' as PresetCategory
  },
  { id: 'healthy', label: '健康', description: '健康活力的感觉，清淡系', category: 'lifestyle' as PresetCategory },
  { id: 'indulgent', label: '奢享', description: '奢华享受的感觉，高热量', category: 'artistic' as PresetCategory },
  { id: 'festive', label: '节日', description: '节日庆祝的氛围，喜庆感', category: 'lifestyle' as PresetCategory }
]

const FOOD_BACKGROUND_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据食物自动选择最佳背景',
    category: 'commercial' as PresetCategory
  },
  { id: 'white', label: '纯白', description: '干净的白色背景，电商标准', category: 'commercial' as PresetCategory },
  { id: 'wood', label: '木质', description: '温暖的木质纹理，自然感', category: 'lifestyle' as PresetCategory },
  { id: 'marble', label: '大理石', description: '高级大理石台面，精致感', category: 'artistic' as PresetCategory },
  { id: 'dark', label: '深色', description: '深色调背景，突出食物', category: 'artistic' as PresetCategory },
  { id: 'colorful', label: '彩色', description: '丰富多彩的背景，活泼感', category: 'pattern' as PresetCategory },
  { id: 'slate', label: '石板', description: '石板质感背景，质朴感', category: 'lifestyle' as PresetCategory },
  { id: 'linen', label: '亚麻布', description: '亚麻布纹理，自然质感', category: 'lifestyle' as PresetCategory },
  { id: 'concrete', label: '水泥', description: '工业风水泥质感', category: 'commercial' as PresetCategory },
  { id: 'ceramic', label: '陶瓷', description: '陶瓷/瓷砖质感背景', category: 'lifestyle' as PresetCategory },
  { id: 'paper', label: '牛皮纸', description: '牛皮纸/烘焙纸背景', category: 'lifestyle' as PresetCategory }
]

// ==================== 产品场景预设 ====================

const SCENE_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳场景',
    category: 'commercial' as PresetCategory
  },
  { id: 'studio', label: '摄影棚', description: '专业摄影棚环境，可控照明', category: 'commercial' as PresetCategory },
  { id: 'outdoor', label: '户外', description: '自然户外场景，阳光草地', category: 'scene' as PresetCategory },
  { id: 'lifestyle', label: '生活场景', description: '日常生活场景，真实感', category: 'lifestyle' as PresetCategory },
  { id: 'minimalist', label: '极简', description: '极简主义环境，纯净背景', category: 'commercial' as PresetCategory },
  { id: 'luxury', label: '奢华', description: '奢华高端场景，大理石/丝绒', category: 'artistic' as PresetCategory },
  { id: 'office', label: '办公室', description: '现代办公环境，商务感', category: 'commercial' as PresetCategory },
  { id: 'cafe', label: '咖啡馆', description: '温馨咖啡馆场景，休闲感', category: 'lifestyle' as PresetCategory },
  { id: 'kitchen', label: '厨房', description: '现代厨房场景，家居感', category: 'lifestyle' as PresetCategory },
  { id: 'bedroom', label: '卧室', description: '温馨卧室场景，舒适感', category: 'lifestyle' as PresetCategory },
  { id: 'bathroom', label: '浴室', description: '现代浴室场景，清洁感', category: 'lifestyle' as PresetCategory },
  { id: 'garden', label: '花园', description: '户外花园场景，自然感', category: 'scene' as PresetCategory },
  { id: 'beach', label: '海滩', description: '海滩度假场景，夏日感', category: 'scene' as PresetCategory },
  { id: 'urban', label: '都市', description: '城市街景场景，时尚感', category: 'scene' as PresetCategory }
]

const LIGHTING_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳光线',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'natural', label: '自然光', description: '柔和的自然光线，最真实', category: 'lifestyle' as PresetCategory },
  { id: 'studio', label: '棚拍光', description: '专业摄影棚灯光，可控性强', category: 'commercial' as PresetCategory },
  { id: 'dramatic', label: '戏剧光', description: '强对比戏剧效果，有冲击力', category: 'artistic' as PresetCategory },
  { id: 'soft', label: '柔和光', description: '温柔柔和的光线，无阴影', category: 'lifestyle' as PresetCategory },
  {
    id: 'golden_hour',
    label: '黄金时刻',
    description: '日落黄金光线，温暖浪漫',
    category: 'artistic' as PresetCategory
  },
  { id: 'blue_hour', label: '蓝调时刻', description: '日出前/日落后蓝调光', category: 'artistic' as PresetCategory },
  { id: 'rim_light', label: '轮廓光', description: '边缘轮廓光，突出形状', category: 'commercial' as PresetCategory },
  { id: 'high_key', label: '高调光', description: '高亮度低对比，明亮感', category: 'commercial' as PresetCategory },
  { id: 'low_key', label: '低调光', description: '低亮度高对比，神秘感', category: 'artistic' as PresetCategory }
]

const MOOD_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳氛围',
    category: 'commercial' as PresetCategory
  },
  { id: 'professional', label: '专业', description: '商业专业风格，信任感', category: 'commercial' as PresetCategory },
  { id: 'warm', label: '温暖', description: '温馨舒适的感觉，亲和力', category: 'lifestyle' as PresetCategory },
  { id: 'cool', label: '冷调', description: '冷静现代的氛围，科技感', category: 'commercial' as PresetCategory },
  { id: 'vibrant', label: '活力', description: '充满活力的感觉，年轻态', category: 'artistic' as PresetCategory },
  { id: 'serene', label: '宁静', description: '平静祥和的氛围，放松感', category: 'lifestyle' as PresetCategory },
  { id: 'energetic', label: '动感', description: '充满能量的感觉，运动感', category: 'artistic' as PresetCategory },
  { id: 'romantic', label: '浪漫', description: '浪漫柔美的氛围，情感化', category: 'lifestyle' as PresetCategory },
  { id: 'sophisticated', label: '精致', description: '精致优雅的感觉，高端感', category: 'artistic' as PresetCategory }
]

const PRODUCT_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别产品类型',
    category: 'commercial' as PresetCategory
  },
  { id: 'general', label: '通用产品', description: '各类通用产品，标准展示', category: 'commercial' as PresetCategory },
  { id: 'fashion', label: '时尚服饰', description: '服装配饰类，模特展示', category: 'model' as PresetCategory },
  { id: 'electronics', label: '电子产品', description: '数码电子类，科技感', category: 'commercial' as PresetCategory },
  { id: 'cosmetics', label: '美妆护肤', description: '化妆品护肤品，精致感', category: 'artistic' as PresetCategory },
  { id: 'home', label: '家居生活', description: '家居用品类，生活感', category: 'lifestyle' as PresetCategory },
  { id: 'food', label: '食品饮料', description: '食品饮料类，诱人感', category: 'lifestyle' as PresetCategory },
  { id: 'sports', label: '运动健身', description: '运动器材类，动感', category: 'artistic' as PresetCategory },
  { id: 'toys', label: '玩具母婴', description: '玩具母婴类，童趣感', category: 'lifestyle' as PresetCategory },
  {
    id: 'automotive',
    label: '汽车配件',
    description: '汽车相关产品，工业感',
    category: 'commercial' as PresetCategory
  },
  { id: 'pet', label: '宠物用品', description: '宠物相关产品，可爱感', category: 'lifestyle' as PresetCategory }
]

// ==================== 首饰试戴预设 ====================

const TRYON_JEWELRY_TYPE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别首饰类型', category: 'model' as PresetCategory },
  { id: 'necklace', label: '项链', description: '项链试戴效果，颈部展示', category: 'model' as PresetCategory },
  { id: 'earring', label: '耳环', description: '耳环试戴效果，耳部展示', category: 'model' as PresetCategory },
  { id: 'bracelet', label: '手链', description: '手链试戴效果，手腕展示', category: 'model' as PresetCategory },
  { id: 'ring', label: '戒指', description: '戒指试戴效果，手指展示', category: 'model' as PresetCategory },
  { id: 'watch', label: '手表', description: '手表试戴效果，腕表展示', category: 'model' as PresetCategory },
  { id: 'brooch', label: '胸针', description: '胸针试戴效果，胸前展示', category: 'model' as PresetCategory },
  { id: 'anklet', label: '脚链', description: '脚链试戴效果，脚踝展示', category: 'model' as PresetCategory },
  { id: 'hairpin', label: '发饰', description: '发饰试戴效果，头发展示', category: 'model' as PresetCategory }
]

const TRYON_POSITION_PRESETS: PresetItem[] = [
  { id: 'auto', label: '自动', description: '自动检测最佳位置，智能识别', category: 'model' as PresetCategory },
  { id: 'centered', label: '居中', description: '居中佩戴位置，对称展示', category: 'model' as PresetCategory },
  { id: 'left', label: '偏左', description: '偏左佩戴位置，单侧展示', category: 'model' as PresetCategory },
  { id: 'right', label: '偏右', description: '偏右佩戴位置，单侧展示', category: 'model' as PresetCategory },
  { id: 'front', label: '正面', description: '正面展示位置，完整视角', category: 'model' as PresetCategory },
  { id: 'side', label: '侧面', description: '侧面展示位置，轮廓视角', category: 'model' as PresetCategory }
]

const TRYON_BLEND_MODE_PRESETS: PresetItem[] = [
  { id: 'natural', label: '自然', description: '自然融合效果，最真实', category: 'model' as PresetCategory },
  { id: 'enhanced', label: '增强', description: '增强光泽效果，更闪亮', category: 'artistic' as PresetCategory },
  { id: 'subtle', label: '柔和', description: '柔和淡雅效果，低调奢华', category: 'lifestyle' as PresetCategory },
  { id: 'vivid', label: '鲜艳', description: '鲜艳明亮效果，色彩饱和', category: 'artistic' as PresetCategory },
  { id: 'matte', label: '哑光', description: '哑光质感效果，现代感', category: 'commercial' as PresetCategory }
]

// ==================== 眼镜试戴预设 ====================

const EYEWEAR_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别眼镜类型',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'glasses', label: '眼镜', description: '日常配镜眼镜，清晰透明镜片', category: 'lifestyle' as PresetCategory },
  { id: 'sunglasses', label: '太阳镜', description: '时尚太阳镜，防晒遮阳', category: 'artistic' as PresetCategory },
  { id: 'goggles', label: '护目镜', description: '运动护目镜，保护眼睛', category: 'commercial' as PresetCategory },
  { id: 'sports', label: '运动眼镜', description: '运动专用眼镜，防滑设计', category: 'commercial' as PresetCategory },
  { id: 'reading', label: '老花镜', description: '阅读用老花镜，舒适设计', category: 'lifestyle' as PresetCategory },
  {
    id: 'blue_light',
    label: '防蓝光',
    description: '防蓝光护眼镜，电脑专用',
    category: 'commercial' as PresetCategory
  },
  { id: 'fashion', label: '时尚眼镜', description: '潮流设计眼镜，装饰为主', category: 'artistic' as PresetCategory }
]

const FRAME_STYLE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别镜框风格', category: 'artistic' as PresetCategory },
  { id: 'round', label: '圆框', description: '经典圆形镜框，复古风格', category: 'artistic' as PresetCategory },
  { id: 'square', label: '方框', description: '方正镜框，干练专业', category: 'commercial' as PresetCategory },
  { id: 'aviator', label: '飞行员', description: '经典飞行员款式，时尚大气', category: 'artistic' as PresetCategory },
  { id: 'cat_eye', label: '猫眼', description: '上扬猫眼设计，优雅女性', category: 'artistic' as PresetCategory },
  { id: 'oval', label: '椭圆', description: '柔和椭圆形状，百搭经典', category: 'lifestyle' as PresetCategory },
  { id: 'rectangular', label: '长方', description: '宽长方形镜框，稳重大方', category: 'commercial' as PresetCategory },
  { id: 'rimless', label: '无框', description: '极简无框设计，轻盈自然', category: 'lifestyle' as PresetCategory },
  { id: 'half_rim', label: '半框', description: '上半框设计，知性优雅', category: 'lifestyle' as PresetCategory },
  { id: 'oversized', label: '大框', description: '超大镜框设计，时尚个性', category: 'artistic' as PresetCategory },
  { id: 'geometric', label: '几何', description: '不规则几何设计，前卫潮流', category: 'artistic' as PresetCategory }
]

const LENS_EFFECT_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别镜片效果',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'clear', label: '透明', description: '完全透明镜片，日常佩戴', category: 'lifestyle' as PresetCategory },
  { id: 'tinted', label: '染色', description: '均匀染色镜片，柔和遮光', category: 'artistic' as PresetCategory },
  { id: 'gradient', label: '渐变', description: '从上到下渐变色，时尚感', category: 'artistic' as PresetCategory },
  { id: 'mirror', label: '镜面', description: '反光镜面效果，炫酷个性', category: 'artistic' as PresetCategory },
  { id: 'polarized', label: '偏光', description: '偏光镜片，减少眩光', category: 'commercial' as PresetCategory },
  { id: 'photochromic', label: '变色', description: '自动感光变色镜片', category: 'commercial' as PresetCategory },
  { id: 'blue_block', label: '防蓝光', description: '过滤蓝光，保护眼睛', category: 'lifestyle' as PresetCategory }
]

// ==================== 鞋类展示预设 ====================

const FOOTWEAR_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别鞋类类型',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'sneakers', label: '运动鞋', description: '休闲运动风格，时尚舒适', category: 'lifestyle' as PresetCategory },
  { id: 'leather', label: '皮鞋', description: '正装皮鞋，商务精英', category: 'commercial' as PresetCategory },
  { id: 'boots', label: '靴子', description: '各类靴款，帅气有型', category: 'artistic' as PresetCategory },
  { id: 'sandals', label: '凉鞋', description: '夏日凉鞋，清爽舒适', category: 'lifestyle' as PresetCategory },
  { id: 'loafers', label: '乐福鞋', description: '休闲便鞋，轻松优雅', category: 'lifestyle' as PresetCategory },
  { id: 'heels', label: '高跟鞋', description: '女性高跟鞋，优雅性感', category: 'artistic' as PresetCategory },
  { id: 'flats', label: '平底鞋', description: '舒适平底鞋，日常百搭', category: 'lifestyle' as PresetCategory },
  {
    id: 'athletic',
    label: '专业运动鞋',
    description: '专业运动装备，性能优先',
    category: 'commercial' as PresetCategory
  }
]

const DISPLAY_ANGLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳展示角度',
    category: 'commercial' as PresetCategory
  },
  { id: 'front', label: '正面', description: '正面展示，完整视角', category: 'commercial' as PresetCategory },
  { id: 'side', label: '侧面', description: '侧面轮廓，展示设计', category: 'artistic' as PresetCategory },
  { id: 'back', label: '背面', description: '背面展示，细节呈现', category: 'commercial' as PresetCategory },
  { id: 'top', label: '俯视', description: '俯视角度，整体布局', category: 'artistic' as PresetCategory },
  { id: 'three_quarter', label: '斜侧', description: '45度角度，立体感强', category: 'commercial' as PresetCategory },
  { id: 'pair', label: '成对', description: '双鞋并排展示', category: 'lifestyle' as PresetCategory },
  { id: 'worn', label: '穿着', description: '穿着效果展示', category: 'lifestyle' as PresetCategory }
]

const MATERIAL_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别材质类型',
    category: 'commercial' as PresetCategory
  },
  { id: 'leather', label: '皮革', description: '真皮材质，质感高级', category: 'commercial' as PresetCategory },
  { id: 'canvas', label: '帆布', description: '帆布面料，休闲自然', category: 'lifestyle' as PresetCategory },
  { id: 'suede', label: '麂皮', description: '绒面质感，柔软舒适', category: 'artistic' as PresetCategory },
  { id: 'mesh', label: '网面', description: '透气网眼，运动轻盈', category: 'lifestyle' as PresetCategory },
  { id: 'synthetic', label: '合成革', description: '人造材料，经济实用', category: 'commercial' as PresetCategory },
  { id: 'fabric', label: '织物', description: '纺织面料，柔软舒适', category: 'lifestyle' as PresetCategory }
]

const FOOTWEAR_BACKGROUND_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳背景',
    category: 'commercial' as PresetCategory
  },
  { id: 'white', label: '纯白', description: '纯白背景，干净专业', category: 'commercial' as PresetCategory },
  { id: 'gradient', label: '渐变', description: '柔和渐变，层次感强', category: 'artistic' as PresetCategory },
  { id: 'lifestyle', label: '生活', description: '生活场景，真实自然', category: 'lifestyle' as PresetCategory },
  { id: 'outdoor', label: '户外', description: '户外环境，活力展示', category: 'lifestyle' as PresetCategory },
  { id: 'studio', label: '影棚', description: '专业影棚，商业品质', category: 'commercial' as PresetCategory },
  { id: 'minimalist', label: '极简', description: '极简风格，突出产品', category: 'artistic' as PresetCategory }
]

const FOOTWEAR_LIGHTING_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳光线',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'soft', label: '柔光', description: '柔和光线，自然舒适', category: 'lifestyle' as PresetCategory },
  { id: 'dramatic', label: '戏剧', description: '强烈对比，视觉冲击', category: 'artistic' as PresetCategory },
  { id: 'natural', label: '自然', description: '自然光照，真实呈现', category: 'lifestyle' as PresetCategory },
  { id: 'studio', label: '影棚', description: '专业打光，商业标准', category: 'commercial' as PresetCategory },
  { id: 'rim', label: '轮廓', description: '边缘光效，高级质感', category: 'artistic' as PresetCategory }
]

// ==================== 美妆产品预设 ====================

const COSMETICS_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别美妆类型',
    category: 'lifestyle' as PresetCategory
  },
  {
    id: 'skincare',
    label: '护肤品',
    description: '精华、面霜、乳液、爽肤水等',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'makeup', label: '彩妆', description: '口红、眼影、粉底、睫毛膏等', category: 'artistic' as PresetCategory },
  { id: 'perfume', label: '香水', description: '香水瓶、香氛产品', category: 'artistic' as PresetCategory },
  { id: 'haircare', label: '洗护', description: '洗发水、护发素、发膜等', category: 'lifestyle' as PresetCategory },
  { id: 'nail', label: '美甲', description: '指甲油、美甲产品', category: 'artistic' as PresetCategory },
  {
    id: 'bodycare',
    label: '身体护理',
    description: '身体乳、沐浴露、磨砂膏等',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'tools', label: '美容工具', description: '化妆刷、美容仪、化妆镜等', category: 'commercial' as PresetCategory }
]

const PRODUCT_TEXTURE_PRESETS: PresetItem[] = [
  { id: 'auto', label: '🔍 自动检测', description: '根据图片自动识别产品质感', category: 'artistic' as PresetCategory },
  { id: 'glossy', label: '光泽', description: '高光亮泽表面，反射强烈', category: 'artistic' as PresetCategory },
  { id: 'matte', label: '哑光', description: '柔和哑光表面，现代感', category: 'commercial' as PresetCategory },
  { id: 'metallic', label: '金属', description: '金属质感，奢华高端', category: 'artistic' as PresetCategory },
  { id: 'glass', label: '玻璃', description: '透明玻璃，清透质感', category: 'lifestyle' as PresetCategory },
  { id: 'frosted', label: '磨砂', description: '磨砂质感，低调优雅', category: 'lifestyle' as PresetCategory },
  { id: 'cream', label: '乳霜', description: '展示产品乳霜质地', category: 'lifestyle' as PresetCategory }
]

const COSMETICS_DISPLAY_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳展示风格',
    category: 'commercial' as PresetCategory
  },
  { id: 'clean', label: '简洁', description: '干净简洁的展示风格', category: 'commercial' as PresetCategory },
  { id: 'luxury', label: '奢华', description: '高端奢华的呈现方式', category: 'artistic' as PresetCategory },
  { id: 'natural', label: '自然', description: '自然清新的风格', category: 'lifestyle' as PresetCategory },
  { id: 'artistic', label: '艺术', description: '艺术创意的表达', category: 'artistic' as PresetCategory },
  { id: 'clinical', label: '专业', description: '专业科学的展示', category: 'commercial' as PresetCategory },
  { id: 'lifestyle', label: '生活', description: '生活场景化展示', category: 'lifestyle' as PresetCategory }
]

const COSMETICS_BACKGROUND_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳背景',
    category: 'commercial' as PresetCategory
  },
  { id: 'white', label: '纯白', description: '干净纯白背景', category: 'commercial' as PresetCategory },
  { id: 'gradient', label: '渐变', description: '柔和渐变背景', category: 'artistic' as PresetCategory },
  { id: 'marble', label: '大理石', description: '大理石纹理背景', category: 'artistic' as PresetCategory },
  { id: 'botanical', label: '植物', description: '植物叶子点缀', category: 'lifestyle' as PresetCategory },
  { id: 'water', label: '水滴', description: '水滴/水面效果', category: 'lifestyle' as PresetCategory },
  { id: 'fabric', label: '织物', description: '丝绸/布料背景', category: 'artistic' as PresetCategory }
]

const COSMETICS_LIGHTING_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳光线',
    category: 'commercial' as PresetCategory
  },
  { id: 'soft', label: '柔光', description: '柔和均匀的照明', category: 'commercial' as PresetCategory },
  { id: 'bright', label: '明亮', description: '明亮清新的光线', category: 'lifestyle' as PresetCategory },
  { id: 'dramatic', label: '戏剧', description: '强对比戏剧性光线', category: 'artistic' as PresetCategory },
  { id: 'natural', label: '自然', description: '模拟自然日光', category: 'lifestyle' as PresetCategory },
  { id: 'rim', label: '轮廓', description: '边缘轮廓光效', category: 'artistic' as PresetCategory }
]

// ==================== 家具场景预设 ====================

const FURNITURE_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别家具类型',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'sofa', label: '沙发', description: '沙发、沙发床、懒人沙发等', category: 'lifestyle' as PresetCategory },
  { id: 'chair', label: '椅子', description: '餐椅、办公椅、休闲椅等', category: 'lifestyle' as PresetCategory },
  { id: 'table', label: '桌子', description: '餐桌、书桌、茶几等', category: 'lifestyle' as PresetCategory },
  { id: 'bed', label: '床具', description: '床架、床头柜、床垫等', category: 'lifestyle' as PresetCategory },
  { id: 'cabinet', label: '柜类', description: '衣柜、书柜、电视柜等', category: 'commercial' as PresetCategory },
  { id: 'lighting', label: '灯具', description: '吊灯、台灯、落地灯等', category: 'artistic' as PresetCategory },
  { id: 'storage', label: '收纳', description: '收纳架、储物柜等', category: 'commercial' as PresetCategory },
  { id: 'outdoor', label: '户外', description: '户外家具、花园家具等', category: 'lifestyle' as PresetCategory }
]

const FURNITURE_SCENE_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据家具自动选择最佳室内风格',
    category: 'commercial' as PresetCategory
  },
  { id: 'modern', label: '现代', description: '简洁现代的设计风格', category: 'commercial' as PresetCategory },
  { id: 'minimalist', label: '极简', description: '极简主义，少即是多', category: 'commercial' as PresetCategory },
  { id: 'scandinavian', label: '北欧', description: '北欧风格，自然温馨', category: 'lifestyle' as PresetCategory },
  { id: 'industrial', label: '工业', description: '工业风格，原始质感', category: 'artistic' as PresetCategory },
  { id: 'traditional', label: '传统', description: '传统经典的设计', category: 'lifestyle' as PresetCategory },
  { id: 'luxury', label: '奢华', description: '奢华高端的装饰', category: 'artistic' as PresetCategory },
  { id: 'bohemian', label: '波西米亚', description: '波西米亚风格，色彩丰富', category: 'artistic' as PresetCategory }
]

const FURNITURE_ROOM_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据家具自动选择最佳房间类型',
    category: 'lifestyle' as PresetCategory
  },
  { id: 'living_room', label: '客厅', description: '客厅空间展示', category: 'lifestyle' as PresetCategory },
  { id: 'bedroom', label: '卧室', description: '卧室空间展示', category: 'lifestyle' as PresetCategory },
  { id: 'dining_room', label: '餐厅', description: '餐厅空间展示', category: 'lifestyle' as PresetCategory },
  { id: 'office', label: '办公室', description: '办公空间展示', category: 'commercial' as PresetCategory },
  { id: 'outdoor', label: '户外', description: '户外空间展示', category: 'lifestyle' as PresetCategory },
  { id: 'studio', label: '工作室', description: '开放式工作室', category: 'commercial' as PresetCategory }
]

const FURNITURE_LIGHTING_MOOD_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据家具自动选择最佳光线氛围',
    category: 'commercial' as PresetCategory
  },
  { id: 'bright', label: '明亮', description: '明亮通透的光线', category: 'commercial' as PresetCategory },
  { id: 'warm', label: '温暖', description: '温暖舒适的氛围', category: 'lifestyle' as PresetCategory },
  { id: 'dramatic', label: '戏剧', description: '戏剧性强烈对比', category: 'artistic' as PresetCategory },
  { id: 'natural', label: '自然', description: '自然日光效果', category: 'lifestyle' as PresetCategory },
  { id: 'evening', label: '傍晚', description: '傍晚温馨氛围', category: 'lifestyle' as PresetCategory },
  { id: 'morning', label: '清晨', description: '清晨清新光线', category: 'lifestyle' as PresetCategory }
]

const FURNITURE_SPACE_SIZE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据家具自动选择最佳空间大小',
    category: 'commercial' as PresetCategory
  },
  { id: 'compact', label: '紧凑', description: '小空间，紧凑布局', category: 'commercial' as PresetCategory },
  { id: 'medium', label: '中等', description: '中等空间，标准布局', category: 'lifestyle' as PresetCategory },
  { id: 'spacious', label: '宽敞', description: '宽敞空间，舒适布局', category: 'lifestyle' as PresetCategory },
  { id: 'open_plan', label: '开放式', description: '开放式大空间', category: 'artistic' as PresetCategory }
]

// ==================== 电子产品预设 ====================

const ELECTRONICS_TYPE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别电子产品类型',
    category: 'commercial' as PresetCategory
  },
  { id: 'smartphone', label: '手机', description: '智能手机、移动设备', category: 'commercial' as PresetCategory },
  { id: 'laptop', label: '笔记本', description: '笔记本电脑、便携电脑', category: 'commercial' as PresetCategory },
  { id: 'tablet', label: '平板', description: '平板电脑、电子阅读器', category: 'commercial' as PresetCategory },
  { id: 'headphones', label: '耳机', description: '耳机、耳塞、音频设备', category: 'lifestyle' as PresetCategory },
  { id: 'smartwatch', label: '智能手表', description: '智能手表、可穿戴设备', category: 'lifestyle' as PresetCategory },
  { id: 'camera', label: '相机', description: '数码相机、摄影设备', category: 'artistic' as PresetCategory },
  { id: 'speaker', label: '音箱', description: '蓝牙音箱、智能音箱', category: 'lifestyle' as PresetCategory },
  { id: 'gaming', label: '游戏设备', description: '游戏机、游戏配件', category: 'artistic' as PresetCategory }
]

const ELECTRONICS_DISPLAY_STYLE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳展示风格',
    category: 'commercial' as PresetCategory
  },
  { id: 'minimal', label: '极简', description: '简洁干净的展示', category: 'commercial' as PresetCategory },
  { id: 'tech', label: '科技', description: '科技感未来感', category: 'artistic' as PresetCategory },
  { id: 'lifestyle', label: '生活', description: '生活场景展示', category: 'lifestyle' as PresetCategory },
  { id: 'studio', label: '影棚', description: '专业影棚拍摄', category: 'commercial' as PresetCategory },
  { id: 'floating', label: '悬浮', description: '悬浮漂浮效果', category: 'artistic' as PresetCategory },
  { id: 'contextual', label: '场景', description: '使用场景展示', category: 'lifestyle' as PresetCategory }
]

const ELECTRONICS_SURFACE_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据图片自动识别产品表面材质',
    category: 'artistic' as PresetCategory
  },
  { id: 'glossy', label: '光泽', description: '高光亮泽表面', category: 'artistic' as PresetCategory },
  { id: 'matte', label: '哑光', description: '哑光防指纹表面', category: 'commercial' as PresetCategory },
  { id: 'metallic', label: '金属', description: '金属质感表面', category: 'artistic' as PresetCategory },
  { id: 'glass', label: '玻璃', description: '玻璃透明表面', category: 'lifestyle' as PresetCategory },
  { id: 'textured', label: '纹理', description: '特殊纹理表面', category: 'commercial' as PresetCategory }
]

const ELECTRONICS_LIGHTING_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳光线',
    category: 'commercial' as PresetCategory
  },
  { id: 'soft', label: '柔光', description: '柔和均匀光线', category: 'commercial' as PresetCategory },
  { id: 'dramatic', label: '戏剧', description: '高对比戏剧光线', category: 'artistic' as PresetCategory },
  { id: 'neon', label: '霓虹', description: 'RGB霓虹灯效果', category: 'artistic' as PresetCategory },
  { id: 'natural', label: '自然', description: '自然日光效果', category: 'lifestyle' as PresetCategory },
  { id: 'gradient', label: '渐变', description: '渐变背景光效', category: 'artistic' as PresetCategory },
  { id: 'rim', label: '轮廓', description: '边缘轮廓光效', category: 'commercial' as PresetCategory }
]

const ELECTRONICS_SCREEN_PRESETS: PresetItem[] = [
  {
    id: 'auto',
    label: '🔍 自动检测',
    description: '根据产品自动选择最佳屏幕内容',
    category: 'commercial' as PresetCategory
  },
  { id: 'blank', label: '空白', description: '干净空白屏幕', category: 'commercial' as PresetCategory },
  { id: 'ui_demo', label: 'UI展示', description: '用户界面演示', category: 'commercial' as PresetCategory },
  { id: 'app_showcase', label: '应用展示', description: '应用程序展示', category: 'lifestyle' as PresetCategory },
  { id: 'wallpaper', label: '壁纸', description: '精美壁纸展示', category: 'artistic' as PresetCategory },
  { id: 'off', label: '关闭', description: '屏幕关闭状态', category: 'commercial' as PresetCategory }
]

// ==================== 预设分类定义 ====================

const BASIC_CATEGORIES = [{ key: 'basic', label: '基础' }]
const METAL_CATEGORIES = [{ key: 'metal', label: '金属' }]
const STONE_CATEGORIES = [{ key: 'stone', label: '宝石' }]
const LIGHTING_CATEGORIES = [{ key: 'lighting', label: '光线' }]
const BACKGROUND_CATEGORIES = [{ key: 'background', label: '背景' }]
const FOOD_CATEGORIES = [{ key: 'food', label: '食品' }]
const STYLE_CATEGORIES = [{ key: 'style', label: '风格' }]
const MOOD_CATEGORIES = [{ key: 'mood', label: '氛围' }]
const SCENE_CATEGORIES = [{ key: 'scene', label: '场景' }]
const PRODUCT_CATEGORIES = [{ key: 'product', label: '产品' }]
const JEWELRY_CATEGORIES = [{ key: 'jewelry', label: '首饰' }]
const POSITION_CATEGORIES = [{ key: 'position', label: '位置' }]
const BLEND_CATEGORIES = [{ key: 'blend', label: '融合' }]
const EYEWEAR_CATEGORIES = [{ key: 'eyewear', label: '眼镜' }]
const FRAME_CATEGORIES = [{ key: 'frame', label: '镜框' }]
const LENS_CATEGORIES = [{ key: 'lens', label: '镜片' }]
const FOOTWEAR_CATEGORIES = [{ key: 'footwear', label: '鞋类' }]
const ANGLE_CATEGORIES = [{ key: 'angle', label: '角度' }]
const MATERIAL_CATEGORIES = [{ key: 'material', label: '材质' }]
const COSMETICS_CATEGORIES = [{ key: 'cosmetics', label: '美妆' }]
const TEXTURE_CATEGORIES = [{ key: 'texture', label: '质感' }]
const DISPLAY_CATEGORIES = [{ key: 'display', label: '展示' }]
const FURNITURE_CATEGORIES = [{ key: 'furniture', label: '家具' }]
const ROOM_CATEGORIES = [{ key: 'room', label: '房间' }]
const SPACE_CATEGORIES = [{ key: 'space', label: '空间' }]
const ELECTRONICS_CATEGORIES = [{ key: 'electronics', label: '电子' }]
const SURFACE_CATEGORIES = [{ key: 'surface', label: '表面' }]
const SCREEN_CATEGORIES = [{ key: 'screen', label: '屏幕' }]

function IndustryPhotoConfigForm({
  config,
  providerId,
  modelId,
  onUpdateConfig,
  onUpdateModel,
  nodeType
}: IndustryPhotoConfigFormProps) {
  // 获取当前选中的 provider 和 model ID
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

  // 处理图片端口数量变化
  const handleImagePortCountChange = useCallback(
    (count: number) => {
      const newPorts: Array<{
        id: string
        label: string
        dataType: 'image'
        required: boolean
        description: string
      }> = []
      for (let i = 1; i <= count; i++) {
        newPorts.push({
          id: `image_${i}`,
          label: `图片 ${i}`,
          dataType: 'image',
          required: i === 1 || (nodeType === 'jewelry_tryon' && i === 2),
          description: i === 1 ? '主要输入图片' : `可选参考图片 ${i}`
        })
      }
      onUpdateConfig({
        imageInputCount: count,
        imageInputPorts: newPorts
      })
    },
    [onUpdateConfig, nodeType]
  )

  // 获取节点默认配置
  const defaultImageCount = useMemo(() => {
    switch (nodeType) {
      case 'jewelry_tryon':
        return 3
      case 'eyewear_tryon':
        return 2
      case 'product_scene':
        return 3
      case 'footwear_display':
        return 2
      case 'cosmetics_photo':
        return 2
      case 'furniture_scene':
        return 2
      case 'electronics_photo':
        return 2
      default:
        return 2
    }
  }, [nodeType])

  const nodeLabel = NODE_TYPE_LABELS[nodeType] || nodeType
  const nodeDescription = NODE_TYPE_DESCRIPTIONS[nodeType] || ''

  // 渲染节点特定的预设配置
  const renderNodeSpecificPresets = () => {
    switch (nodeType) {
      case 'jewelry_photo':
        return renderJewelryPresets()
      case 'food_photo':
        return renderFoodPresets()
      case 'product_scene':
        return renderProductScenePresets()
      case 'jewelry_tryon':
        return renderJewelryTryonPresets()
      case 'eyewear_tryon':
        return renderEyewearTryonPresets()
      case 'footwear_display':
        return renderFootwearDisplayPresets()
      case 'cosmetics_photo':
        return renderCosmeticsPhotoPresets()
      case 'furniture_scene':
        return renderFurnitureScenePresets()
      case 'electronics_photo':
        return renderElectronicsPhotoPresets()
      default:
        return null
    }
  }

  // 珠宝摄影预设
  const renderJewelryPresets = () => (
    <>
      <FormSection title="💎 珠宝配置">
        <FormRow label="珠宝类型" description="选择珠宝类型">
          <PresetGalleryButton
            presets={JEWELRY_TYPE_PRESETS}
            selectedId={config.jewelryType || 'ring'}
            onSelect={(preset) => onUpdateConfig('jewelryType', preset.id)}
            placeholder="选择珠宝类型..."
            modalTitle="选择珠宝类型"
            categories={BASIC_CATEGORIES}
            getCategoryKey={() => 'basic'}
            searchPlaceholder="搜索珠宝..."
          />
        </FormRow>

        <FormRow label="金属类型" description="选择金属材质">
          <PresetGalleryButton
            presets={METAL_TYPE_PRESETS}
            selectedId={config.metalType || 'gold'}
            onSelect={(preset) => onUpdateConfig('metalType', preset.id)}
            placeholder="选择金属类型..."
            modalTitle="选择金属类型"
            categories={METAL_CATEGORIES}
            getCategoryKey={() => 'metal'}
            searchPlaceholder="搜索金属..."
          />
        </FormRow>

        <FormRow label="宝石类型" description="选择宝石（可选）">
          <PresetGalleryButton
            presets={STONE_TYPE_PRESETS}
            selectedId={config.stoneType || 'diamond'}
            onSelect={(preset) => onUpdateConfig('stoneType', preset.id)}
            placeholder="选择宝石类型..."
            modalTitle="选择宝石类型"
            categories={STONE_CATEGORIES}
            getCategoryKey={() => 'stone'}
            searchPlaceholder="搜索宝石..."
          />
        </FormRow>
      </FormSection>

      <FormSection title="📸 拍摄设置">
        <FormRow label="光线设置" description="选择打光方式">
          <PresetGalleryButton
            presets={LIGHTING_SETUP_PRESETS}
            selectedId={config.lightingSetup || 'soft_box'}
            onSelect={(preset) => onUpdateConfig('lightingSetup', preset.id)}
            placeholder="选择光线设置..."
            modalTitle="选择光线设置"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光线..."
          />
        </FormRow>

        <FormRow label="背景风格" description="选择背景风格">
          <PresetGalleryButton
            presets={BACKGROUND_STYLE_PRESETS}
            selectedId={config.backgroundStyle || 'white'}
            onSelect={(preset) => onUpdateConfig('backgroundStyle', preset.id)}
            placeholder="选择背景风格..."
            modalTitle="选择背景风格"
            categories={BACKGROUND_CATEGORIES}
            getCategoryKey={() => 'background'}
            searchPlaceholder="搜索背景..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 食品摄影预设
  const renderFoodPresets = () => (
    <>
      <FormSection title="🍽️ 食品配置">
        <FormRow label="食品类别" description="选择食品类别">
          <PresetGalleryButton
            presets={FOOD_CATEGORY_PRESETS}
            selectedId={config.foodCategory || 'main_dish'}
            onSelect={(preset) => onUpdateConfig('foodCategory', preset.id)}
            placeholder="选择食品类别..."
            modalTitle="选择食品类别"
            categories={FOOD_CATEGORIES}
            getCategoryKey={() => 'food'}
            searchPlaceholder="搜索食品..."
          />
        </FormRow>

        <FormRow label="风格预设" description="选择拍摄风格">
          <PresetGalleryButton
            presets={FOOD_STYLE_PRESETS}
            selectedId={config.stylePreset || 'modern'}
            onSelect={(preset) => onUpdateConfig('stylePreset', preset.id)}
            placeholder="选择风格预设..."
            modalTitle="选择风格预设"
            categories={STYLE_CATEGORIES}
            getCategoryKey={() => 'style'}
            searchPlaceholder="搜索风格..."
          />
        </FormRow>

        <FormRow label="氛围预设" description="选择拍摄氛围">
          <PresetGalleryButton
            presets={FOOD_MOOD_PRESETS}
            selectedId={config.moodPreset || 'warm'}
            onSelect={(preset) => onUpdateConfig('moodPreset', preset.id)}
            placeholder="选择氛围预设..."
            modalTitle="选择氛围预设"
            categories={MOOD_CATEGORIES}
            getCategoryKey={() => 'mood'}
            searchPlaceholder="搜索氛围..."
          />
        </FormRow>

        <FormRow label="背景风格" description="选择背景风格">
          <PresetGalleryButton
            presets={FOOD_BACKGROUND_PRESETS}
            selectedId={config.backgroundStyle || 'white'}
            onSelect={(preset) => onUpdateConfig('backgroundStyle', preset.id)}
            placeholder="选择背景风格..."
            modalTitle="选择背景风格"
            categories={BACKGROUND_CATEGORIES}
            getCategoryKey={() => 'background'}
            searchPlaceholder="搜索背景..."
          />
        </FormRow>
      </FormSection>

      <FormSection title="✨ 动态效果">
        <FormRow label="蒸汽效果" description="为热食添加蒸汽效果">
          <FormSwitch
            checked={config.enableSteam ?? false}
            onChange={(checked) => onUpdateConfig('enableSteam', checked)}
          />
        </FormRow>
        <FormRow label="水珠效果" description="添加新鲜水珠/凝结效果">
          <FormSwitch
            checked={config.enableDroplets ?? false}
            onChange={(checked) => onUpdateConfig('enableDroplets', checked)}
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 产品场景预设
  const renderProductScenePresets = () => (
    <>
      <FormSection title="🏞️ 场景配置">
        <FormRow label="场景类型" description="选择场景类型">
          <PresetGalleryButton
            presets={SCENE_TYPE_PRESETS}
            selectedId={config.sceneType || 'studio'}
            onSelect={(preset) => onUpdateConfig('sceneType', preset.id)}
            placeholder="选择场景类型..."
            modalTitle="选择场景类型"
            categories={SCENE_CATEGORIES}
            getCategoryKey={() => 'scene'}
            searchPlaceholder="搜索场景..."
          />
        </FormRow>

        <FormRow label="光影风格" description="选择光影风格">
          <PresetGalleryButton
            presets={LIGHTING_STYLE_PRESETS}
            selectedId={config.lightingStyle || 'natural'}
            onSelect={(preset) => onUpdateConfig('lightingStyle', preset.id)}
            placeholder="选择光影风格..."
            modalTitle="选择光影风格"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光影..."
          />
        </FormRow>

        <FormRow label="氛围风格" description="选择氛围风格">
          <PresetGalleryButton
            presets={MOOD_STYLE_PRESETS}
            selectedId={config.moodStyle || 'professional'}
            onSelect={(preset) => onUpdateConfig('moodStyle', preset.id)}
            placeholder="选择氛围风格..."
            modalTitle="选择氛围风格"
            categories={MOOD_CATEGORIES}
            getCategoryKey={() => 'mood'}
            searchPlaceholder="搜索氛围..."
          />
        </FormRow>

        <FormRow label="产品类型" description="选择产品类型">
          <PresetGalleryButton
            presets={PRODUCT_TYPE_PRESETS}
            selectedId={config.productType || 'general'}
            onSelect={(preset) => onUpdateConfig('productType', preset.id)}
            placeholder="选择产品类型..."
            modalTitle="选择产品类型"
            categories={PRODUCT_CATEGORIES}
            getCategoryKey={() => 'product'}
            searchPlaceholder="搜索产品..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 首饰试戴预设
  const renderJewelryTryonPresets = () => (
    <>
      <FormSection title="💍 试戴配置">
        <FormRow label="首饰类型" description="选择首饰类型">
          <PresetGalleryButton
            presets={TRYON_JEWELRY_TYPE_PRESETS}
            selectedId={config.jewelryType || 'necklace'}
            onSelect={(preset) => onUpdateConfig('jewelryType', preset.id)}
            placeholder="选择首饰类型..."
            modalTitle="选择首饰类型"
            categories={JEWELRY_CATEGORIES}
            getCategoryKey={() => 'jewelry'}
            searchPlaceholder="搜索首饰..."
          />
        </FormRow>

        <FormRow label="佩戴位置" description="选择佩戴位置偏好">
          <PresetGalleryButton
            presets={TRYON_POSITION_PRESETS}
            selectedId={config.position || 'auto'}
            onSelect={(preset) => onUpdateConfig('position', preset.id)}
            placeholder="选择佩戴位置..."
            modalTitle="选择佩戴位置"
            categories={POSITION_CATEGORIES}
            getCategoryKey={() => 'position'}
            searchPlaceholder="搜索位置..."
          />
        </FormRow>

        <FormRow label="融合模式" description="首饰与模特的融合方式">
          <PresetGalleryButton
            presets={TRYON_BLEND_MODE_PRESETS}
            selectedId={config.blendMode || 'natural'}
            onSelect={(preset) => onUpdateConfig('blendMode', preset.id)}
            placeholder="选择融合模式..."
            modalTitle="选择融合模式"
            categories={BLEND_CATEGORIES}
            getCategoryKey={() => 'blend'}
            searchPlaceholder="搜索融合..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 眼镜试戴预设
  const renderEyewearTryonPresets = () => (
    <>
      <FormSection title="👓 眼镜配置">
        <FormRow label="眼镜类型" description="选择眼镜类型">
          <PresetGalleryButton
            presets={EYEWEAR_TYPE_PRESETS}
            selectedId={config.eyewearType || 'glasses'}
            onSelect={(preset) => onUpdateConfig('eyewearType', preset.id)}
            placeholder="选择眼镜类型..."
            modalTitle="选择眼镜类型"
            categories={EYEWEAR_CATEGORIES}
            getCategoryKey={() => 'eyewear'}
            searchPlaceholder="搜索眼镜..."
          />
        </FormRow>

        <FormRow label="镜框风格" description="选择镜框设计风格">
          <PresetGalleryButton
            presets={FRAME_STYLE_PRESETS}
            selectedId={config.frameStyle || 'round'}
            onSelect={(preset) => onUpdateConfig('frameStyle', preset.id)}
            placeholder="选择镜框风格..."
            modalTitle="选择镜框风格"
            categories={FRAME_CATEGORIES}
            getCategoryKey={() => 'frame'}
            searchPlaceholder="搜索镜框..."
          />
        </FormRow>

        <FormRow label="镜片效果" description="选择镜片材质和效果">
          <PresetGalleryButton
            presets={LENS_EFFECT_PRESETS}
            selectedId={config.lensEffect || 'clear'}
            onSelect={(preset) => onUpdateConfig('lensEffect', preset.id)}
            placeholder="选择镜片效果..."
            modalTitle="选择镜片效果"
            categories={LENS_CATEGORIES}
            getCategoryKey={() => 'lens'}
            searchPlaceholder="搜索镜片..."
          />
        </FormRow>

        <FormRow label="融合模式" description="眼镜与模特的融合方式">
          <PresetGalleryButton
            presets={TRYON_BLEND_MODE_PRESETS}
            selectedId={config.blendMode || 'natural'}
            onSelect={(preset) => onUpdateConfig('blendMode', preset.id)}
            placeholder="选择融合模式..."
            modalTitle="选择融合模式"
            categories={BLEND_CATEGORIES}
            getCategoryKey={() => 'blend'}
            searchPlaceholder="搜索融合..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 鞋类展示预设
  const renderFootwearDisplayPresets = () => (
    <>
      <FormSection title="👟 鞋类配置">
        <FormRow label="鞋类类型" description="选择鞋类产品类型">
          <PresetGalleryButton
            presets={FOOTWEAR_TYPE_PRESETS}
            selectedId={config.footwearType || 'sneakers'}
            onSelect={(preset) => onUpdateConfig('footwearType', preset.id)}
            placeholder="选择鞋类类型..."
            modalTitle="选择鞋类类型"
            categories={FOOTWEAR_CATEGORIES}
            getCategoryKey={() => 'footwear'}
            searchPlaceholder="搜索鞋类..."
          />
        </FormRow>

        <FormRow label="展示角度" description="选择产品展示角度">
          <PresetGalleryButton
            presets={DISPLAY_ANGLE_PRESETS}
            selectedId={config.displayAngle || 'three_quarter'}
            onSelect={(preset) => onUpdateConfig('displayAngle', preset.id)}
            placeholder="选择展示角度..."
            modalTitle="选择展示角度"
            categories={ANGLE_CATEGORIES}
            getCategoryKey={() => 'angle'}
            searchPlaceholder="搜索角度..."
          />
        </FormRow>

        <FormRow label="材质风格" description="选择鞋类材质">
          <PresetGalleryButton
            presets={MATERIAL_STYLE_PRESETS}
            selectedId={config.materialStyle || 'leather'}
            onSelect={(preset) => onUpdateConfig('materialStyle', preset.id)}
            placeholder="选择材质风格..."
            modalTitle="选择材质风格"
            categories={MATERIAL_CATEGORIES}
            getCategoryKey={() => 'material'}
            searchPlaceholder="搜索材质..."
          />
        </FormRow>

        <FormRow label="场景背景" description="选择展示背景">
          <PresetGalleryButton
            presets={FOOTWEAR_BACKGROUND_PRESETS}
            selectedId={config.sceneBackground || 'white'}
            onSelect={(preset) => onUpdateConfig('sceneBackground', preset.id)}
            placeholder="选择场景背景..."
            modalTitle="选择场景背景"
            categories={BACKGROUND_CATEGORIES}
            getCategoryKey={() => 'background'}
            searchPlaceholder="搜索背景..."
          />
        </FormRow>

        <FormRow label="光影效果" description="选择光线效果">
          <PresetGalleryButton
            presets={FOOTWEAR_LIGHTING_PRESETS}
            selectedId={config.lightingEffect || 'soft'}
            onSelect={(preset) => onUpdateConfig('lightingEffect', preset.id)}
            placeholder="选择光影效果..."
            modalTitle="选择光影效果"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光效..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 美妆产品预设
  const renderCosmeticsPhotoPresets = () => (
    <>
      <FormSection title="💄 美妆配置">
        <FormRow label="产品类型" description="选择美妆产品类型">
          <PresetGalleryButton
            presets={COSMETICS_TYPE_PRESETS}
            selectedId={config.cosmeticsType || 'skincare'}
            onSelect={(preset) => onUpdateConfig('cosmeticsType', preset.id)}
            placeholder="选择产品类型..."
            modalTitle="选择产品类型"
            categories={COSMETICS_CATEGORIES}
            getCategoryKey={() => 'cosmetics'}
            searchPlaceholder="搜索产品..."
          />
        </FormRow>

        <FormRow label="产品质感" description="选择产品表面质感">
          <PresetGalleryButton
            presets={PRODUCT_TEXTURE_PRESETS}
            selectedId={config.productTexture || 'glossy'}
            onSelect={(preset) => onUpdateConfig('productTexture', preset.id)}
            placeholder="选择产品质感..."
            modalTitle="选择产品质感"
            categories={TEXTURE_CATEGORIES}
            getCategoryKey={() => 'texture'}
            searchPlaceholder="搜索质感..."
          />
        </FormRow>

        <FormRow label="展示风格" description="选择展示风格">
          <PresetGalleryButton
            presets={COSMETICS_DISPLAY_STYLE_PRESETS}
            selectedId={config.displayStyle || 'clean'}
            onSelect={(preset) => onUpdateConfig('displayStyle', preset.id)}
            placeholder="选择展示风格..."
            modalTitle="选择展示风格"
            categories={DISPLAY_CATEGORIES}
            getCategoryKey={() => 'display'}
            searchPlaceholder="搜索风格..."
          />
        </FormRow>

        <FormRow label="背景设置" description="选择背景设置">
          <PresetGalleryButton
            presets={COSMETICS_BACKGROUND_PRESETS}
            selectedId={config.backgroundSetting || 'white'}
            onSelect={(preset) => onUpdateConfig('backgroundSetting', preset.id)}
            placeholder="选择背景设置..."
            modalTitle="选择背景设置"
            categories={BACKGROUND_CATEGORIES}
            getCategoryKey={() => 'background'}
            searchPlaceholder="搜索背景..."
          />
        </FormRow>

        <FormRow label="光效风格" description="选择光线效果">
          <PresetGalleryButton
            presets={COSMETICS_LIGHTING_PRESETS}
            selectedId={config.lightingEffect || 'soft'}
            onSelect={(preset) => onUpdateConfig('lightingEffect', preset.id)}
            placeholder="选择光效风格..."
            modalTitle="选择光效风格"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光效..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 家具场景预设
  const renderFurnitureScenePresets = () => (
    <>
      <FormSection title="🛋️ 家具配置">
        <FormRow label="家具类型" description="选择家具类型">
          <PresetGalleryButton
            presets={FURNITURE_TYPE_PRESETS}
            selectedId={config.furnitureType || 'sofa'}
            onSelect={(preset) => onUpdateConfig('furnitureType', preset.id)}
            placeholder="选择家具类型..."
            modalTitle="选择家具类型"
            categories={FURNITURE_CATEGORIES}
            getCategoryKey={() => 'furniture'}
            searchPlaceholder="搜索家具..."
          />
        </FormRow>

        <FormRow label="场景风格" description="选择室内设计风格">
          <PresetGalleryButton
            presets={FURNITURE_SCENE_STYLE_PRESETS}
            selectedId={config.sceneStyle || 'modern'}
            onSelect={(preset) => onUpdateConfig('sceneStyle', preset.id)}
            placeholder="选择场景风格..."
            modalTitle="选择场景风格"
            categories={STYLE_CATEGORIES}
            getCategoryKey={() => 'style'}
            searchPlaceholder="搜索风格..."
          />
        </FormRow>

        <FormRow label="房间类型" description="选择房间类型">
          <PresetGalleryButton
            presets={FURNITURE_ROOM_TYPE_PRESETS}
            selectedId={config.roomType || 'living_room'}
            onSelect={(preset) => onUpdateConfig('roomType', preset.id)}
            placeholder="选择房间类型..."
            modalTitle="选择房间类型"
            categories={ROOM_CATEGORIES}
            getCategoryKey={() => 'room'}
            searchPlaceholder="搜索房间..."
          />
        </FormRow>

        <FormRow label="光线氛围" description="选择光线氛围">
          <PresetGalleryButton
            presets={FURNITURE_LIGHTING_MOOD_PRESETS}
            selectedId={config.lightingMood || 'natural'}
            onSelect={(preset) => onUpdateConfig('lightingMood', preset.id)}
            placeholder="选择光线氛围..."
            modalTitle="选择光线氛围"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光线..."
          />
        </FormRow>

        <FormRow label="空间大小" description="选择空间大小">
          <PresetGalleryButton
            presets={FURNITURE_SPACE_SIZE_PRESETS}
            selectedId={config.spaceSize || 'medium'}
            onSelect={(preset) => onUpdateConfig('spaceSize', preset.id)}
            placeholder="选择空间大小..."
            modalTitle="选择空间大小"
            categories={SPACE_CATEGORIES}
            getCategoryKey={() => 'space'}
            searchPlaceholder="搜索空间..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  // 电子产品预设
  const renderElectronicsPhotoPresets = () => (
    <>
      <FormSection title="📱 电子产品配置">
        <FormRow label="产品类型" description="选择电子产品类型">
          <PresetGalleryButton
            presets={ELECTRONICS_TYPE_PRESETS}
            selectedId={config.electronicsType || 'smartphone'}
            onSelect={(preset) => onUpdateConfig('electronicsType', preset.id)}
            placeholder="选择产品类型..."
            modalTitle="选择产品类型"
            categories={ELECTRONICS_CATEGORIES}
            getCategoryKey={() => 'electronics'}
            searchPlaceholder="搜索产品..."
          />
        </FormRow>

        <FormRow label="展示风格" description="选择展示风格">
          <PresetGalleryButton
            presets={ELECTRONICS_DISPLAY_STYLE_PRESETS}
            selectedId={config.displayStyle || 'minimal'}
            onSelect={(preset) => onUpdateConfig('displayStyle', preset.id)}
            placeholder="选择展示风格..."
            modalTitle="选择展示风格"
            categories={DISPLAY_CATEGORIES}
            getCategoryKey={() => 'display'}
            searchPlaceholder="搜索风格..."
          />
        </FormRow>

        <FormRow label="表面质感" description="选择产品表面质感">
          <PresetGalleryButton
            presets={ELECTRONICS_SURFACE_PRESETS}
            selectedId={config.surfaceFinish || 'glossy'}
            onSelect={(preset) => onUpdateConfig('surfaceFinish', preset.id)}
            placeholder="选择表面质感..."
            modalTitle="选择表面质感"
            categories={SURFACE_CATEGORIES}
            getCategoryKey={() => 'surface'}
            searchPlaceholder="搜索质感..."
          />
        </FormRow>

        <FormRow label="光效风格" description="选择光线效果">
          <PresetGalleryButton
            presets={ELECTRONICS_LIGHTING_PRESETS}
            selectedId={config.lightingStyle || 'soft'}
            onSelect={(preset) => onUpdateConfig('lightingStyle', preset.id)}
            placeholder="选择光效风格..."
            modalTitle="选择光效风格"
            categories={LIGHTING_CATEGORIES}
            getCategoryKey={() => 'lighting'}
            searchPlaceholder="搜索光效..."
          />
        </FormRow>

        <FormRow label="屏幕内容" description="选择屏幕显示内容">
          <PresetGalleryButton
            presets={ELECTRONICS_SCREEN_PRESETS}
            selectedId={config.screenContent || 'blank'}
            onSelect={(preset) => onUpdateConfig('screenContent', preset.id)}
            placeholder="选择屏幕内容..."
            modalTitle="选择屏幕内容"
            categories={SCREEN_CATEGORIES}
            getCategoryKey={() => 'screen'}
            searchPlaceholder="搜索内容..."
          />
        </FormRow>
      </FormSection>
    </>
  )

  return (
    <div className="workflow-root">
      {/* 功能说明 */}
      <Alert message={nodeLabel} description={nodeDescription} type="info" showIcon style={{ marginBottom: 16 }} />

      {/* 模型选择 */}
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

        {/* 提示词编辑按钮 - 使用 PromptEditorSection */}
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <PromptEditorSection
            nodeType={nodeType}
            config={config}
            customPrompts={config.customPrompts}
            onUpdateCustomPrompts={(prompts) => onUpdateConfig('customPrompts', prompts)}
            buttonText="✏️ 编辑提示词"
            buttonType="primary"
            modalTitle={`${nodeLabel} - 提示词配置`}
            showStatus={true}
            showReset={true}
          />
        </div>
      </FormSection>

      {/* 输出设置 */}
      <FormSection title="📐 输出设置">
        <FormRow label="输出尺寸" description="生成图片的分辨率">
          <FormSelect
            value={config.imageSize || '2K'}
            onChange={(value) => onUpdateConfig('imageSize', value)}
            options={IMAGE_SIZE_OPTIONS}
          />
        </FormRow>
        <FormRow label="宽高比" description="生成图片的宽高比">
          <FormSelect
            value={config.aspectRatio || '1:1'}
            onChange={(value) => onUpdateConfig('aspectRatio', value)}
            options={ASPECT_RATIO_OPTIONS}
          />
        </FormRow>
      </FormSection>

      {/* 节点特定配置 - 使用预设画廊 */}
      {renderNodeSpecificPresets()}

      {/* 额外描述 */}
      <FormSection title="📝 额外描述">
        <FormRow label="额外描述" description="补充拍摄要求">
          <FormTextArea
            value={config.extraDescription || ''}
            onChange={(value) => onUpdateConfig('extraDescription', value)}
            placeholder="添加额外的拍摄要求..."
            rows={3}
          />
        </FormRow>
      </FormSection>

      {/* 图片输入端口 */}
      <ImageInputPortSection
        mode="simple"
        count={config.imageInputCount ?? defaultImageCount}
        ports={config.imageInputPorts ?? []}
        min={nodeType === 'jewelry_tryon' ? 2 : 1}
        max={5}
        onCountChange={handleImagePortCountChange}
        title="📷 图片输入"
        showDivider={false}
        showAlert={true}
      />

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
                <FormRow label="📝 使用系统提示词" description="启用专业摄影生成提示词">
                  <FormSwitch
                    checked={config.useSystemPrompt ?? true}
                    onChange={(checked) => onUpdateConfig('useSystemPrompt', checked)}
                  />
                </FormRow>

                <Divider style={{ margin: '12px 0' }} />

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
    </div>
  )
}

export default memo(IndustryPhotoConfigForm)
